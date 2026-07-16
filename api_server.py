"""
FastAPI Server for Video Analysis with Audio Pipeline
Connects to your existing pipeline and provides endpoints for frontend
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Body
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid
import shutil
import time
from pathlib import Path
import json
import io
import zipfile
import subprocess
import wave
import mimetypes
import urllib.parse
import urllib.request
import re
import html
from html.parser import HTMLParser
from typing import Dict, Any, Optional, List
import asyncio
import csv
from datetime import datetime, timezone
from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
from src.backend.analysis.pipeline_manager import run_full_pipeline
from src.backend.analysis.pipeline_ingestion import run_ingestion_pipeline, validate_video
from src.backend.analysis.pipeline_audio_text import AudioTranscriptionPipeline
from src.backend.analysis.audio_prosody import analyze_audio_prosody
from src.backend.analysis.audio_diarization import (
    audio_diarization_staleness,
    write_audio_diarization,
)
from src.backend.analysis.audio_sample_cloud import (
    build_audio_sample_clouds_from_diarization,
    build_audio_sample_clouds_for_narrative_agents,
    merge_audio_sample_cloud_payloads,
)
from src.backend.analysis.language_modeller import MMSASRTranscriber, DEFAULT_MMS_MODEL_ID
from src.backend.analysis.expression_detector import ExpressionDetectorDeepFace
from src.backend.utils.logger import get_logger
from src.backend.analysis.pos_analysis import POSAnalysis
from src.backend.analysis.quantitative_analysis import (
    QuantitativeAnalysis,
    attach_quant_evidence_to_transcript,
)
from src.backend.analysis.forensic_render import (
    ForensicRenderError,
    create_forensic_render_job,
    load_forensic_render_jobs,
    make_json_safe,
)
from src.backend.analysis.source_sampler import (
    SourceSamplerError,
    create_source_sample,
    load_source_samples,
)
from src.backend.analysis.language_pack_policy import (
    MORPHOLOGY_PACK_LIMITS,
    build_language_pack_policy,
)
from src.backend.analysis.morphology_catalog import list_morphology_catalog
from src.backend.analysis.language_utils import build_language_profile
from src.backend.analysis.transcript_timing_guard import (
    build_transcript_quality_report,
    build_transcript_timing_authority,
    promote_automatic_transcript_timing,
    rebuild_transcript_from_quick_sweep_candidate,
    transcript_timing_looks_scaffolded,
    transcript_timing_repair_needed,
)
from src.backend.analysis.evidence_linker import link_transcript_to_trace
from src.backend.analysis.evidence_linker import (
    link_audio_prosody_json_to_trace,
    link_expression_json_to_trace,
    link_object_csv_to_trace,
    link_ocr_csv_to_trace,
)
from src.backend.analysis.timestamp_schema import MediaProfile, MediaRef
from src.backend.analysis.identification_refinery import (
    load_identity_candidate_ledger,
    promote_identity_candidate,
    refine_identities,
)
from src.backend.analysis.identity_triangulation import write_identity_triangulation_bundle
from src.backend.analysis.dependency_sfl_stage1 import write_dependency_sfl_stage1_artifact
from src.backend.analysis.multimodal_meaning_stage1 import (
    write_multimodal_meaning_stage1_artifact,
)
from src.backend.analysis.second_order_label_proliferation import (
    write_second_order_label_proliferation_plan,
)
from src.backend.analysis.narrative_lens_reading import (
    write_narrative_lens_reading_artifact,
)
from src.backend.analysis.character_path_reading import (
    write_character_path_reading_artifact,
)
from src.backend.analysis.datascene_meaning_network import (
    write_datascene_meaning_network_artifact,
)
from src.backend.analysis.agent_persistence import (
    build_agent_persistence_feature_event,
)
from src.backend.analysis.agent_persistence_manager import AgentPersistenceManager
from src.backend.analysis.evidence_proliferation_matcher import (
    run_open_topology_scanner_refresh,
    write_evidence_proliferation_match,
)
from src.backend.analysis.saved_analysis_hydration_loader import (
    hydrate_saved_analysis_status,
)
from src.backend.analysis.live_mature_data_proliferation_bus import (
    write_live_mature_data_proliferation_audit,
)
from src.backend.analysis.mise_en_scene_scene_card import (
    write_mise_en_scene_scene_cards,
    write_source_extraction_metadata_summary,
)
from src.backend.analysis.ai_agent_feature_starters import (
    build_feature_starter_manifest,
    render_report_markdown,
    write_feature_starter_manifest,
)
from src.backend.analysis.statskit_agent import StatsKitAgent, StatsKitAgentError
from src.backend.analysis.projected_state import project_subject_state, project_subject_states
from src.backend.analysis.decision_ledger import (
    append_decision,
    append_dependency_invalidation,
    append_invalidation,
    empty_decision_ledger,
)
from src.backend.analysis.canonical_adapter import sync_corrections_to_ledger
from src.backend.analysis.claim_projection import project_canonical_claims
from src.backend.analysis.source_clock_authority import (
    clock_affected_decision_refs,
    overlapping_dependents,
    select_authoritative_time_scope,
)
from src.backend.analysis.evidence_quality import assess_evidence_quality, evaluate_quality_use
from src.backend.analysis.execution_graph_planner import load_execution_graph, plan_affected_branches
from src.backend.analysis.reproducible_measurement import ReproducibleMeasurementService
from src.backend.analysis.shot_boundary_measurement import measure_shot_boundaries
from src.backend.analysis.interpretation_registry import InterpretationRegistry
from src.backend.analysis.framework_projection import (
    build_framework_projections,
    confirm_proposition_to_ledger,
    write_framework_projections,
)
from src.backend.analysis.source_policy_service import evaluate_source_use
from src.backend.analysis.taxonomy_application_service import apply_taxonomy_term
from src.backend.analysis.vocabulary_service import (
    VocabularyError,
    list_vocabularies,
    load_vocabulary_registry,
    public_registry,
    resolve_term,
)
from fastapi import Form


logger = get_logger(__name__)

app = FastAPI(
    title="Video Analysis API",
    description="Backend for video analysis with YOLOv8, EasyOCR, and Whisper Audio Transcription",
    version="1.1.0"
)

# CORS middleware - configure for your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000", 
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories for API operations
UPLOAD_DIR = Path("uploads")
RESULTS_DIR = Path("outputs/api_results")
AUDIO_DIR = Path("outputs/audio")
TRANSCRIPTS_DIR = Path("outputs/transcripts")
STATIC_DIR = Path("static")
IMPORTED_WORK_DIR = Path("outputs/imported_work")
TAXONOMY_DIR = Path("outputs/taxonomy")
SHARED_TAXONOMY_PATH = TAXONOMY_DIR / "shared_taxonomy.json"
CVAT_BRIDGE_BASE = os.getenv("CVAT_BRIDGE_URL", "http://localhost:3001")

UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)
TRANSCRIPTS_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)
IMPORTED_WORK_DIR.mkdir(parents=True, exist_ok=True)
TAXONOMY_DIR.mkdir(parents=True, exist_ok=True)

# Serve static files (for downloaded files)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Store analysis status and results
analysis_status: Dict[str, Dict[str, Any]] = {}
ALLOWED_TAXONOMY_SCOPES = {
    "media_genre",
    "media_subgenre",
    "situational_genre",
    "situational_subgenre",
    "privacy_axis",
    "expertise_axis",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_taxonomy_label(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def get_shared_taxonomy_store() -> Dict[str, Any]:
    if not SHARED_TAXONOMY_PATH.exists():
        return {"version": 1, "updated_at": None, "labels": []}

    try:
        payload = json.loads(SHARED_TAXONOMY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"version": 1, "updated_at": None, "labels": []}

    if not isinstance(payload, dict):
        return {"version": 1, "updated_at": None, "labels": []}

    labels = payload.get("labels")
    if not isinstance(labels, list):
        payload["labels"] = []
    return payload


def write_shared_taxonomy_store(store: Dict[str, Any]) -> None:
    store["updated_at"] = utc_now_iso()
    SHARED_TAXONOMY_PATH.write_text(
        json.dumps(store, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def list_shared_taxonomy_labels(
    *,
    scope: Optional[str] = None,
    parent_value: Optional[str] = None,
    status: str = "approved_shared",
) -> List[Dict[str, Any]]:
    store = get_shared_taxonomy_store()
    normalized_parent = normalize_taxonomy_label(parent_value).lower()
    labels: List[Dict[str, Any]] = []
    for entry in store.get("labels", []):
        if not isinstance(entry, dict):
            continue
        if scope and entry.get("scope") != scope:
            continue
        if status and entry.get("status") != status:
            continue
        entry_parent = normalize_taxonomy_label(entry.get("parent_value")).lower()
        if normalized_parent:
            if entry_parent != normalized_parent:
                continue
        else:
            if entry_parent:
                continue
        labels.append(entry)

    labels.sort(
        key=lambda entry: (
            str(entry.get("scope", "")),
            str(entry.get("parent_value", "")),
            str(entry.get("label", "")).lower(),
        )
    )
    return labels


def upsert_shared_taxonomy_label(
    *,
    scope: str,
    label: str,
    parent_value: Optional[str] = None,
    created_by: str = "analyst",
    source: str = "manual_share",
    notes: str = "",
) -> Dict[str, Any]:
    normalized_scope = normalize_taxonomy_label(scope)
    if normalized_scope not in ALLOWED_TAXONOMY_SCOPES:
        raise HTTPException(status_code=400, detail="Unsupported taxonomy scope")

    normalized_label = normalize_taxonomy_label(label)
    if not normalized_label:
        raise HTTPException(status_code=400, detail="label is required")

    normalized_parent = normalize_taxonomy_label(parent_value)
    store = get_shared_taxonomy_store()
    labels = store.setdefault("labels", [])
    normalized_match = normalized_label.lower()
    normalized_parent_match = normalized_parent.lower()

    for entry in labels:
        if not isinstance(entry, dict):
            continue
        if entry.get("scope") != normalized_scope:
            continue
        if normalize_taxonomy_label(entry.get("label")).lower() != normalized_match:
            continue
        if normalize_taxonomy_label(entry.get("parent_value")).lower() != normalized_parent_match:
            continue

        entry["status"] = "approved_shared"
        entry["label"] = normalized_label
        entry["parent_value"] = normalized_parent
        entry["notes"] = notes or entry.get("notes", "")
        entry["source"] = source or entry.get("source", "manual_share")
        entry["approved_at"] = entry.get("approved_at") or utc_now_iso()
        entry["approved_by"] = entry.get("approved_by") or created_by
        write_shared_taxonomy_store(store)
        return entry

    entry = {
        "id": uuid.uuid4().hex,
        "scope": normalized_scope,
        "label": normalized_label,
        "normalized_label": normalized_match,
        "parent_value": normalized_parent,
        "status": "approved_shared",
        "source": source,
        "created_by": created_by,
        "created_at": utc_now_iso(),
        "approved_by": created_by,
        "approved_at": utc_now_iso(),
        "notes": notes,
    }
    labels.append(entry)
    write_shared_taxonomy_store(store)
    return entry


def get_analysis_record_path(analysis_id: str) -> Path:
    return RESULTS_DIR / analysis_id / "analysis_record.json"


def append_analysis_event(
    status: Dict[str, Any],
    event_type: str,
    *,
    progress: Optional[int] = None,
    stage: Optional[str] = None,
    message: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    event_log = status.setdefault("event_log", [])
    event_log.append(
        {
            "timestamp": utc_now_iso(),
            "event_type": event_type,
            "progress": progress if progress is not None else status.get("progress"),
            "mission_stage": stage if stage is not None else status.get("mission_stage"),
            "mission_message": (
                message if message is not None else status.get("mission_message")
            ),
            "details": details or {},
        }
    )


def persist_analysis_record_for_status(status: Dict[str, Any]) -> None:
    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return

    record_path = get_analysis_record_path(analysis_id)
    record_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.loads(json.dumps(status, default=str))
    record_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def csv_escape(value: Any) -> str:
    return str(value).replace('"', '""')


def safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: Any) -> Optional[int]:
    try:
        if value in {None, ""}:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_object_label(value: Any) -> str:
    normalized = normalize_taxonomy_label(value)
    if not normalized:
        return "unknown"
    return normalized.lower().replace(" ", "_")


def cvat_bridge_get_json(path: str, query: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{CVAT_BRIDGE_BASE}{path}"
    if query:
        query_string = urllib.parse.urlencode(
            {
                key: value
                for key, value in query.items()
                if value not in {None, ""}
            }
        )
        if query_string:
            url = f"{url}?{query_string}"

    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read().decode("utf-8")
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach CVAT bridge: {exc}",
        ) from exc

    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="CVAT bridge returned invalid JSON",
        ) from exc


def get_wav_duration_seconds(audio_path: str | Path) -> Optional[float]:
    path_obj = Path(audio_path)
    if not path_obj.exists() or path_obj.suffix.lower() != ".wav":
        return None

    try:
        with wave.open(str(path_obj), "rb") as handle:
            frame_rate = handle.getframerate()
            if frame_rate <= 0:
                return None
            return handle.getnframes() / float(frame_rate)
    except Exception:
        return None


def build_transcript_timeline_segments(
    transcript: Dict[str, Any],
    *,
    coverage_target_seconds: Any = None,
) -> List[Dict[str, Any]]:
    raw_segments = [segment for segment in (transcript.get("segments") or []) if isinstance(segment, dict)]
    utterances = sorted(
        [
            {
                **segment,
                "start": safe_float(segment.get("start")) or 0.0,
                "end": safe_float(segment.get("end")) or 0.0,
            }
            for segment in raw_segments
        ],
        key=lambda segment: (segment.get("start", 0.0), segment.get("end", 0.0)),
    )

    target_seconds = max(
        safe_float(coverage_target_seconds) or 0.0,
        max((segment.get("end", 0.0) for segment in utterances), default=0.0),
    )
    timeline_segments: List[Dict[str, Any]] = []
    cursor = 0.0

    for index, segment in enumerate(utterances):
        start = max(0.0, float(segment.get("start") or 0.0))
        end = max(start, float(segment.get("end") or start))
        if start > cursor:
            timeline_segments.append(
                {
                    "start": round(cursor, 3),
                    "end": round(start, 3),
                    "text": "[Unresolved audio interval]",
                    "segment_type": "unresolved_interval",
                    "synthetic": True,
                    "timeline_index": len(timeline_segments),
                    "source_segment_index": None,
                }
            )

        timeline_segments.append(
            {
                **segment,
                "start": round(start, 3),
                "end": round(end, 3),
                "segment_type": "utterance",
                "synthetic": False,
                "timeline_index": len(timeline_segments),
                "source_segment_index": index,
            }
        )
        cursor = max(cursor, end)

    if target_seconds > cursor:
        timeline_segments.append(
            {
                "start": round(cursor, 3),
                "end": round(target_seconds, 3),
                "text": "[Unresolved audio tail]",
                "segment_type": "unresolved_tail",
                "synthetic": True,
                "timeline_index": len(timeline_segments),
                "source_segment_index": None,
            }
        )

    return timeline_segments


def source_timed_transcript_segments(transcript: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [segment for segment in (transcript.get("segments") or []) if isinstance(segment, dict)]


def first_present(mapping: Dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value not in (None, ""):
            return value
    return None


def parse_frame_rate(raw_value: Any) -> Optional[float]:
    if raw_value in (None, ""):
        return None
    text = str(raw_value)
    try:
        if "/" in text:
            numerator, denominator = text.split("/", 1)
            denominator_value = float(denominator)
            if denominator_value == 0:
                return None
            return round(float(numerator) / denominator_value, 3)
        return round(float(text), 3)
    except (TypeError, ValueError):
        return None


def int_or_none(value: Any) -> Optional[int]:
    try:
        if value in (None, ""):
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def float_or_none(value: Any) -> Optional[float]:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_media_tag_key(value: Any) -> str:
    return (
        str(value or "")
        .lower()
        .replace("com.apple.quicktime.", "")
        .replace(".", "_")
        .replace("-", "_")
        .replace(" ", "_")
    )


def first_media_tag(tags: Dict[str, Any], *keys: str) -> Any:
    normalized_tags = {normalize_media_tag_key(key): value for key, value in tags.items()}
    for key in keys:
        value = normalized_tags.get(normalize_media_tag_key(key))
        if value not in (None, ""):
            return value
    return None


def extract_embedded_media_metadata(tags: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize common camera/phone/drone metadata exposed by ffprobe tags."""

    if not tags:
        return {}
    embedded = {
        "date_time": first_media_tag(
            tags,
            "creation_time",
            "date",
            "date_time_original",
            "datetimeoriginal",
            "recorded_date",
            "creationdate",
            "encoded_date",
            "tagged_date",
        ),
        "gps_coordinates": first_media_tag(
            tags,
            "location",
            "location_iso6709",
            "gps_coordinates",
            "gpsposition",
            "gps_latitude",
        ),
        "camera_make": first_media_tag(tags, "make", "camera_make", "manufacturer"),
        "camera_model": first_media_tag(tags, "model", "camera_model", "device_model"),
        "recording_device": first_media_tag(tags, "device", "device_name", "camera_device"),
        "software": first_media_tag(tags, "software", "encoder", "encoding_tool"),
        "filmed_by": first_media_tag(
            tags,
            "filmed_by",
            "camera_operator",
            "photographer",
            "videographer",
            "operator",
        ),
        "title": first_media_tag(tags, "title", "display_name"),
        "description": first_media_tag(tags, "description", "comment", "synopsis"),
        "copyright": first_media_tag(tags, "copyright"),
    }
    embedded = {key: value for key, value in embedded.items() if value not in (None, "")}
    raw_tags: Dict[str, Any] = {}
    for key, value in tags.items():
        if value in (None, ""):
            continue
        normalized_key = normalize_media_tag_key(key)
        if any(
            token in normalized_key
            for token in (
                "creation",
                "date",
                "location",
                "gps",
                "make",
                "model",
                "device",
                "artist",
                "author",
                "creator",
                "encoder",
                "software",
                "title",
                "description",
                "comment",
                "copyright",
            )
        ):
            raw_tags[str(key)] = value
    if raw_tags:
        embedded["raw_tags"] = raw_tags
    return embedded


def probe_source_media_file(path_obj: Optional[Path]) -> Dict[str, Any]:
    """Best-effort media facts from the source file itself."""

    if not path_obj or not path_obj.exists():
        return {}

    probe: Dict[str, Any] = {
        "container_extension": path_obj.suffix.lower() or None,
        "mime_type": mimetypes.guess_type(str(path_obj))[0],
    }
    try:
        stat = path_obj.stat()
        probe["size_bytes"] = stat.st_size
    except Exception:
        pass

    try:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_format",
                "-show_streams",
                "-print_format",
                "json",
                str(path_obj),
            ],
            capture_output=True,
            text=True,
            timeout=12,
            check=True,
        )
        ffprobe_payload = json.loads(completed.stdout or "{}")
    except Exception:
        return probe

    format_info = ffprobe_payload.get("format") if isinstance(ffprobe_payload, dict) else {}
    streams = ffprobe_payload.get("streams") if isinstance(ffprobe_payload, dict) else []
    merged_tags: Dict[str, Any] = {}
    if isinstance(format_info, dict):
        probe["duration"] = float_or_none(format_info.get("duration"))
        probe["format_name"] = format_info.get("format_name")
        probe["size_bytes"] = int_or_none(format_info.get("size")) or probe.get("size_bytes")
        probe["video_bitrate"] = int_or_none(format_info.get("bit_rate"))
        if isinstance(format_info.get("tags"), dict):
            merged_tags.update(format_info.get("tags") or {})
    for stream in streams:
        if isinstance(stream, dict) and isinstance(stream.get("tags"), dict):
            merged_tags.update(stream.get("tags") or {})
    video_stream = next(
        (stream for stream in streams if isinstance(stream, dict) and stream.get("codec_type") == "video"),
        {},
    )
    audio_stream = next(
        (stream for stream in streams if isinstance(stream, dict) and stream.get("codec_type") == "audio"),
        {},
    )
    if video_stream:
        probe["video_codec"] = video_stream.get("codec_name")
        probe["width"] = int_or_none(video_stream.get("width"))
        probe["height"] = int_or_none(video_stream.get("height"))
        probe["fps"] = parse_frame_rate(
            video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate")
        )
        probe["video_bitrate"] = int_or_none(video_stream.get("bit_rate")) or probe.get("video_bitrate")
    probe["has_audio"] = bool(audio_stream)
    if audio_stream:
        probe["audio_codec"] = audio_stream.get("codec_name")
        probe["audio_bitrate"] = int_or_none(audio_stream.get("bit_rate"))
        probe["audio_channels"] = int_or_none(audio_stream.get("channels"))
        probe["audio_sample_rate"] = int_or_none(audio_stream.get("sample_rate"))
    embedded_metadata = extract_embedded_media_metadata(merged_tags)
    if embedded_metadata:
        probe["embedded_metadata"] = embedded_metadata
        probe["recorded_at"] = embedded_metadata.get("date_time")
        probe["gps_coordinates"] = embedded_metadata.get("gps_coordinates")
        probe["camera_make"] = embedded_metadata.get("camera_make")
        probe["camera_model"] = embedded_metadata.get("camera_model")
        probe["recording_device"] = embedded_metadata.get("recording_device")
        probe["recording_software"] = embedded_metadata.get("software")
        probe["filmed_by"] = embedded_metadata.get("filmed_by")
    return {key: value for key, value in probe.items() if value not in (None, "")}


def annotation_has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return bool(value)
    return True


def clean_source_label(value: Any) -> str:
    return " ".join(str(value or "").replace("_", " ").strip().split())


def append_unique_text(items: List[str], value: Any, *, limit: int = 12) -> None:
    cleaned = clean_source_label(value)
    if not cleaned:
        return
    lower_seen = {item.lower() for item in items}
    if cleaned.lower() not in lower_seen and len(items) < limit:
        items.append(cleaned)


def append_unique_record(items: List[Dict[str, str]], record: Dict[str, Any], *, limit: int = 24) -> None:
    cleaned_record = {
        key: clean_source_label(value)
        for key, value in record.items()
        if clean_source_label(value)
    }
    if not cleaned_record:
        return
    record_key = "|".join(
        cleaned_record.get(key, "").lower()
        for key in ("character", "actor", "role", "description", "department")
    )
    seen = {
        "|".join(
            clean_source_label(item.get(key)).lower()
            for key in ("character", "actor", "role", "description", "department")
        )
        for item in items
    }
    if record_key not in seen and len(items) < limit:
        items.append(cleaned_record)


METADATA_KEYWORD_STOP_TERMS = {
    "i",
    "me",
    "my",
    "mine",
    "we",
    "us",
    "our",
    "ours",
    "you",
    "your",
    "yours",
    "he",
    "him",
    "his",
    "she",
    "her",
    "hers",
    "it",
    "its",
    "they",
    "them",
    "their",
    "theirs",
    "this",
    "that",
    "these",
    "those",
    "there",
    "here",
    "what",
    "where",
    "when",
    "why",
    "how",
    "who",
}


def append_metadata_keyword(items: List[str], value: Any, *, limit: int = 24) -> None:
    cleaned = clean_source_label(value)
    if not cleaned:
        return
    lower = cleaned.lower().strip("?.!,;:")
    if lower in METADATA_KEYWORD_STOP_TERMS:
        return
    if "?" in cleaned and len(cleaned.split()) > 2:
        return
    if len(cleaned.split()) > 5:
        return
    append_unique_text(items, cleaned, limit=limit)


class WebMetadataHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title_parts: List[str] = []
        self.visible_parts: List[str] = []
        self.meta: Dict[str, str] = {}
        self.json_ld: List[str] = []
        self._capture_title = False
        self._capture_script = False
        self._script_parts: List[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: List[tuple[str, Optional[str]]]) -> None:
        attr_map = {str(key).lower(): value or "" for key, value in attrs}
        tag_lower = tag.lower()
        if tag_lower == "title":
            self._capture_title = True
        elif tag_lower == "meta":
            key = (
                attr_map.get("property")
                or attr_map.get("name")
                or attr_map.get("itemprop")
                or ""
            ).strip().lower()
            content = clean_source_label(attr_map.get("content"))
            if key and content:
                self.meta[key] = content
        elif tag_lower == "script":
            script_type = attr_map.get("type", "").lower()
            if "ld+json" in script_type:
                self._capture_script = True
                self._script_parts = []
            else:
                self._skip_depth += 1
        elif tag_lower in {"style", "noscript", "svg"}:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if tag_lower == "title":
            self._capture_title = False
        elif tag_lower == "script":
            if self._capture_script:
                script_text = "".join(self._script_parts).strip()
                if script_text:
                    self.json_ld.append(script_text)
            self._capture_script = False
            self._script_parts = []
            if self._skip_depth > 0:
                self._skip_depth -= 1
        elif tag_lower in {"style", "noscript", "svg"} and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        cleaned = clean_source_label(data)
        if not cleaned:
            return
        if self._capture_title:
            self.title_parts.append(cleaned)
        elif self._capture_script:
            self._script_parts.append(data)
        elif self._skip_depth == 0 and len(self.visible_parts) < 80:
            self.visible_parts.append(cleaned)


def normalize_web_metadata_values(value: Any, *, limit: int = 12) -> List[str]:
    values: List[str] = []

    def append(value_item: Any) -> None:
        if isinstance(value_item, dict):
            for nested_key in ("name", "headline", "title", "@id"):
                if nested_key in value_item:
                    append(value_item.get(nested_key))
                    return
        elif isinstance(value_item, list):
            for nested in value_item:
                append(nested)
        else:
            append_unique_text(values, value_item, limit=limit)

    append(value)
    return values


WEB_SOURCE_AUTHOR_STOP_TERMS = {
    "contributors to wikimedia projects",
    "wikipedia",
    "wikimedia foundation",
    "mediawiki",
}


def strip_html_fragment(fragment: str) -> str:
    text = re.sub(r"(?is)<(script|style|noscript|sup)[^>]*>.*?</\1>", " ", fragment)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</tr>|</td>|</th>", "; ", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\[[^\]]+\]", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" ;")
    return clean_source_label(text)


def compact_web_excerpt(text: Any, *, limit: int = 640) -> str:
    cleaned = clean_source_label(text)
    if len(cleaned) <= limit:
        return cleaned
    boundary = max(cleaned.rfind(". ", 0, limit), cleaned.rfind("; ", 0, limit))
    if boundary > 180:
        return cleaned[: boundary + 1].strip()
    return cleaned[:limit].rsplit(" ", 1)[0].strip()


def extract_link_texts(fragment: str, *, limit: int = 32) -> List[str]:
    values: List[str] = []
    for match in re.finditer(r"(?is)<a\b[^>]*>(.*?)</a>", fragment):
        label = strip_html_fragment(match.group(1))
        if label.lower() in {"edit", "citation needed"}:
            continue
        if re.fullmatch(r"\d+", label):
            continue
        append_unique_text(values, label, limit=limit)
    return values


def split_metadata_text_values(value: Any, *, limit: int = 24) -> List[str]:
    values: List[str] = []
    text = clean_source_label(value)
    for item in re.split(r"\s*(?:;|\||/|\band\b)\s*", text):
        cleaned = clean_source_label(item)
        if cleaned and len(cleaned) <= 80:
            append_unique_text(values, cleaned, limit=limit)
    return values


def infer_character_role_label(character: Any, description: Any) -> str:
    character_text = clean_source_label(character).lower()
    description_text = clean_source_label(description).lower()
    text = f"{character_text} {description_text}"
    labels: List[str] = []
    if any(term in character_text for term in ("james bond", "bond", "007")):
        labels.append("protagonist")
    if any(term in character_text for term in ("james bond", "bond", "007")) or any(
        term in description_text[:160]
        for term in ("former mi6 agent", "agent 007", "cia agent", "mi6 agent", "field officer")
    ):
        append_unique_text(labels, "secret agent", limit=4)
    if any(term in text for term in ("villain", "adversary", "bioterrorist", "safin", "blofeld")):
        labels.append("antagonist")
    if any(term in text for term in ("mi6", "cia", "agent", "officer", "quartermaster")):
        append_unique_text(labels, "intelligence role", limit=4)
    if any(term in text for term in ("love interest", "daughter", "mother", "father", "family")):
        append_unique_text(labels, "family / relationship role", limit=4)
    if any(term in text for term in ("psychotherapist", "scientist", "doctor", "dr.", "professor")):
        append_unique_text(labels, "professional role", limit=4)
    return ", ".join(labels[:3])


QUOTE_ATTRIBUTION_PATTERN = re.compile(
    r"(?i)\b(?:director|producer|writer|actor|actress|filmmaker|screenwriter)\s+"
    r"[A-Z][A-Za-z .'-]+?\s+(?:described|compared|said|called|noted|stated|explained)\b.*$"
)


def compact_character_role_description(text: Any, *, limit: int = 140) -> str:
    cleaned = clean_source_label(text)
    if not cleaned:
        return ""
    cleaned = QUOTE_ATTRIBUTION_PATTERN.sub("", cleaned).strip(" ;.")
    lower = cleaned.lower()
    if "bioterrorist" in lower and "bond" in lower and "adversary" in lower:
        return "Bioterrorist scientist; Bond adversary"
    if "psychotherapist" in lower and "love interest" in lower:
        return "Psychotherapist; Bond's love interest"
    if "new 007" in lower or "007 number" in lower:
        return "MI6 agent assigned the 007 number"
    if "former mi6 agent" in lower or "retired for five years" in lower:
        return "Former MI6 agent 007; retired for five years"
    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    kept: List[str] = []
    for sentence in sentences:
        sentence = clean_source_label(sentence).strip(" ;")
        if not sentence:
            continue
        if re.search(r"(?i)\b(?:described|compared|said|called|noted|stated|explained)\b", sentence):
            continue
        kept.append(sentence)
        if len(" ".join(kept)) >= 60:
            break
    return compact_web_excerpt(" ".join(kept) or cleaned, limit=limit)


def format_character_role_candidate(role: Dict[str, Any]) -> str:
    actor = clean_source_label(role.get("actor"))
    character = clean_source_label(role.get("character"))
    role_label = clean_source_label(role.get("role"))
    description = compact_character_role_description(role.get("description"))
    head = character
    if actor:
        head = f"{head} ({actor})" if head else actor
    tail = "; ".join(part for part in (role_label, description) if part)
    return f"{head}: {tail}" if head and tail else head or tail


def normalize_character_role_candidate(value: Any) -> str:
    if isinstance(value, dict):
        return format_character_role_candidate(value)
    return clean_source_label(value)


def split_character_aliases(character_name: str) -> List[str]:
    aliases: List[str] = []
    for part in re.split(r"\s*(?:/|\bor\b)\s*", clean_source_label(character_name)):
        append_unique_text(aliases, part, limit=8)
    return aliases


def split_role_labels(role_label: Any) -> List[str]:
    labels: List[str] = []
    for part in re.split(r"\s*(?:,|;|/|\band\b)\s*", clean_source_label(role_label)):
        append_unique_text(labels, part, limit=8)
    return labels


NARRATIVE_AGENT_PROFILE_GOVERNANCE = {
    "profile_type": "Narrative Agent Profile",
    "identity_boundary": "VAA1 profiles media-internal narrative agents, not natural person identity profiles.",
    "actor_boundary": "Actor/performer data is attached source metadata; it is not the analytic identity target.",
    "dramatic_archetype_note": (
        "Dramatic archetypes are governed as probabilistic narrative functions, situational roles, "
        "relational positions, rhetorical behaviors, and evolving dramaturgical trajectories."
    ),
    "shakespearean_modality_note": (
        "Shakespearean modality asks how identity is performed, destabilized, revealed, concealed, "
        "inverted, or transformed through interaction. VAA1 should report dramaturgical tendencies "
        "and interactional functions, not fixed archetypal identities."
    ),
    "shakespearean_layers": [
        "character_modes",
        "relational_dynamics",
        "scene_modes",
        "status_dynamics",
        "linguistic_modes",
    ],
}


NARRATIVE_AGENT_PROFILE_EXTENSION_REGISTRY = [
    {
        "extension_id": "vaa1.base_narrative_agent_profile",
        "label": "Base Narrative Agent Profile",
        "status": "active",
        "compartments": [
            "source_metadata",
            "lines",
            "audio_samples",
            "visual_patterns",
            "identification_refs",
            "scene_links",
            "meaning_plot_refs",
            "dramaturgical_tendencies",
            "interpretive_readings",
        ],
    },
    {
        "extension_id": "vaa1.spy_action_agent_profile",
        "label": "Spy / Action Narrative Agent Extension",
        "status": "candidate",
        "applies_when": ["spy action", "secret agent", "intelligence role", "mission", "MI6", "CIA"],
        "compartments": [
            "mission_function",
            "cover_identity",
            "agency_affiliation",
            "threat_relation",
            "operational_loyalty",
        ],
    },
    {
        "extension_id": "vaa1.shakespearean_modality_profile",
        "label": "Shakespearean Modality Extension",
        "status": "electable",
        "applies_when": ["status shift", "deception", "wit combat", "soliloquy", "legitimacy struggle"],
        "compartments": [
            "character_modes",
            "relational_dynamics",
            "scene_modes",
            "status_dynamics",
            "linguistic_modes",
            "polyphony",
        ],
    },
]


def slugify_profile_id(value: Any, fallback: str) -> str:
    cleaned = clean_source_label(value).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", cleaned).strip("-")
    return slug or fallback


def narrative_agent_profile_extensions(definition: Dict[str, Any]) -> List[Dict[str, Any]]:
    text = " ".join(
        [
            clean_source_label(definition.get("character_name")),
            clean_source_label(definition.get("actor_name")),
            clean_source_label(definition.get("role_description")),
            " ".join(definition.get("role_labels") or []),
        ]
    ).lower()
    extensions: List[Dict[str, Any]] = []
    for extension in NARRATIVE_AGENT_PROFILE_EXTENSION_REGISTRY:
        extension_copy = dict(extension)
        if extension["extension_id"] == "vaa1.base_narrative_agent_profile":
            extension_copy["activation"] = "base"
            extensions.append(extension_copy)
            continue
        applies_when = extension.get("applies_when") or []
        if any(clean_source_label(term).lower() in text for term in applies_when):
            extension_copy["activation"] = "electable_candidate"
            extensions.append(extension_copy)
    return extensions


def build_narrative_agent_profile(
    definition: Dict[str, Any],
    index: int,
    *,
    diarization_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not isinstance(definition, dict):
        return {}
    character_name = clean_source_label(definition.get("character_name"))
    actor_name = clean_source_label(definition.get("actor_name"))
    profile_id = f"narrative-agent-{index + 1:04d}-{slugify_profile_id(character_name or actor_name, str(index + 1))}"
    source_url = clean_source_label(definition.get("source_url"))
    source_preference = clean_source_label(definition.get("source_preference")) or "supporting"
    role_labels = definition.get("role_labels") if isinstance(definition.get("role_labels"), list) else []
    profile = {
        "profile_id": profile_id,
        "profile_type": "Narrative Agent Profile",
        "narrative_agent_name": character_name,
        "aliases": definition.get("aliases") if isinstance(definition.get("aliases"), list) else [],
        "attached_performer_metadata": {
            "actor_name": actor_name or None,
            "boundary": NARRATIVE_AGENT_PROFILE_GOVERNANCE["actor_boundary"],
        },
        "source_metadata": {
            "role_labels": role_labels,
            "role_description": clean_source_label(definition.get("role_description")),
            "relations": definition.get("relations") if isinstance(definition.get("relations"), list) else [],
            "source_url": source_url,
            "source_preference": source_preference,
        },
        "evidence_slots": {
            "lines": [],
            "speaker_timeline": [],
            "audio_samples": [],
            "visual_patterns": [],
            "identification_refs": [],
            "scene_links": [],
            "meaning_plot_refs": [],
        },
        "dramaturgical_tendencies": [
            {
                "label": role_label,
                "status": "source_metadata_candidate",
                "confidence": "medium",
                "basis": "source_media.character_definitions.role_labels",
            }
            for role_label in role_labels
        ],
        "interpretive_readings": [
            {
                "reading_id": "base-source-role-reading",
                "label": "Source role reading",
                "branch": "base",
                "status": "candidate",
                "confidence": "medium",
                "summary": "Initial reading seeded from governed external source metadata.",
                "evidence_basis": ["source_media.character_definitions"],
            }
        ],
        "profile_extensions": narrative_agent_profile_extensions(definition),
        "profile_governance": definition.get("profile_governance")
        if isinstance(definition.get("profile_governance"), dict)
        else NARRATIVE_AGENT_PROFILE_GOVERNANCE,
        "constituent_evidence": definition.get("constituent_evidence") if isinstance(definition.get("constituent_evidence"), dict) else {},
        "maturity": "derived_external_metadata",
        "maturity_route": "master_schema.source_media_narrative_agent_profile_maturity",
        "traceback": {
            "route": "master_schema.source_media_narrative_agent_profile_maturity",
            "raw_preserved": True,
            "consulted": ["source_media_annotations.character_definitions", "source_media_web_metadata_sources"],
        },
    }

    # Find and attach all spoken lines for this agent from the diarization artifact
    if diarization_payload and character_name:
        agent_turns = [
            turn
            for turn in diarization_payload.get("speaker_turns", [])
            if (
                isinstance(turn, dict)
                and str(turn.get("speaker_label") or "").lower() == character_name.lower()
            )
        ]
        if agent_turns:
            profile["evidence_slots"]["lines"] = agent_turns
            profile["evidence_slots"]["speaker_timeline"] = agent_turns

    return {key: item for key, item in profile.items() if annotation_has_value(item)}


def build_narrative_agent_profiles(
    character_definitions: List[Dict[str, Any]],
    *,
    diarization_payload: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    profiles: List[Dict[str, Any]] = []
    for index, definition in enumerate(character_definitions):
        profile = build_narrative_agent_profile(
            definition, index, diarization_payload=diarization_payload
        )
        if profile:
            profiles.append(profile)
    return profiles


def normalize_character_definition(
    value: Any,
    *,
    source_url: str = "",
    source_preference: str = "",
) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    character_name = clean_source_label(value.get("character"))
    actor_name = clean_source_label(value.get("actor"))
    role_description = compact_character_role_description(value.get("description"))
    role_labels = split_role_labels(value.get("role"))
    if not role_labels and (character_name or role_description):
        inferred = infer_character_role_label(character_name, role_description)
        role_labels = split_role_labels(inferred)
    definition = {
        "character_name": character_name,
        "actor_name": actor_name,
        "aliases": split_character_aliases(character_name),
        "role_labels": role_labels,
        "role_description": role_description,
        "relations": [],
        "profile_governance": NARRATIVE_AGENT_PROFILE_GOVERNANCE,
        "constituent_evidence": {
            "character_name": {
                "value": character_name,
                "source_field": "fields.character_roles.character",
                "source_url": source_url,
            },
            "actor_name": {
                "value": actor_name,
                "source_field": "fields.character_roles.actor",
                "source_url": source_url,
            },
            "role_labels": {
                "value": role_labels,
                "source_field": "fields.character_roles.role",
                "source_url": source_url,
            },
            "role_description": {
                "value": role_description,
                "source_field": "fields.character_roles.description",
                "source_url": source_url,
            },
        },
        "source_url": source_url,
        "source_preference": source_preference or "supporting",
        "maturity": "derived_external_metadata",
        "maturity_route": "master_schema.source_media_character_definition_maturity",
    }
    return {key: item for key, item in definition.items() if annotation_has_value(item)}


def append_unique_character_definition(
    definitions: List[Dict[str, Any]],
    definition: Dict[str, Any],
    *,
    limit: int = 48,
) -> None:
    if not definition:
        return
    key = "|".join(
        clean_source_label(definition.get(field)).lower()
        for field in ("character_name", "actor_name", "role_description")
    )
    seen = {
        "|".join(
            clean_source_label(item.get(field)).lower()
            for field in ("character_name", "actor_name", "role_description")
        )
        for item in definitions
    }
    if key not in seen and len(definitions) < limit:
        definitions.append(definition)


def collect_web_metadata_character_role_candidates(status: Dict[str, Any]) -> List[str]:
    candidates: List[str] = []
    sources = status.get("source_media_web_metadata_sources")
    if not isinstance(sources, list):
        return candidates

    preference_rank = {"main": 0, "supporting": 1, "background": 2}
    sorted_sources = sorted(
        [source for source in sources if isinstance(source, dict)],
        key=lambda source: (
            preference_rank.get(str(source.get("preference") or "supporting"), 1),
            str(source.get("retrieved_at") or ""),
        ),
    )
    for source in sorted_sources:
        if str(source.get("status") or "").lower() not in {"", "ok", "success", "saved"}:
            continue
        fields = source.get("fields") if isinstance(source.get("fields"), dict) else {}
        for role in fields.get("character_roles") or []:
            append_unique_text(candidates, normalize_character_role_candidate(role), limit=48)
    return candidates


def collect_web_metadata_character_definitions(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    definitions: List[Dict[str, Any]] = []
    sources = status.get("source_media_web_metadata_sources")
    if not isinstance(sources, list):
        return definitions

    preference_rank = {"main": 0, "supporting": 1, "background": 2}
    sorted_sources = sorted(
        [source for source in sources if isinstance(source, dict)],
        key=lambda source: (
            preference_rank.get(str(source.get("preference") or "supporting"), 1),
            str(source.get("retrieved_at") or ""),
        ),
    )
    for source in sorted_sources:
        if str(source.get("status") or "").lower() not in {"", "ok", "success", "saved"}:
            continue
        fields = source.get("fields") if isinstance(source.get("fields"), dict) else {}
        for role in fields.get("character_roles") or []:
            append_unique_character_definition(
                definitions,
                normalize_character_definition(
                    role,
                    source_url=clean_source_label(source.get("url")),
                    source_preference=clean_source_label(source.get("preference")),
                ),
                limit=48,
            )
    return definitions


def format_production_crew_candidate(role: Dict[str, Any]) -> str:
    person = clean_source_label(role.get("person"))
    department = clean_source_label(role.get("department"))
    return f"{person}: {department}" if person and department else person or department


def is_source_author_noise(value: Any, *, source_url: str = "") -> bool:
    cleaned = clean_source_label(value).lower()
    if not cleaned:
        return True
    if any(term in cleaned for term in WEB_SOURCE_AUTHOR_STOP_TERMS):
        return True
    host = urllib.parse.urlparse(source_url).netloc.lower()
    return "wikipedia.org" in host and (
        "wikimedia" in cleaned or cleaned in {"wikipedia", "mediawiki"}
    )


def extract_date_candidates(text: Any, *, limit: int = 18) -> List[str]:
    values: List[str] = []
    cleaned = clean_source_label(text)
    patterns = [
        r"\b\d{1,2}\s+[A-Z][a-z]+\s+\d{4}\b",
        r"\b[A-Z][a-z]+\s+\d{1,2},\s+\d{4}\b",
        r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b",
        r"\b(?:19|20)\d{2}\b",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, cleaned):
            append_unique_text(values, match.group(0), limit=limit)
    return values


def wikipedia_section_html(html_text: str, section_id: str) -> str:
    for heading_text, section_html in wikipedia_sections(html_text):
        heading_lower = heading_text.lower()
        if heading_lower == section_id.lower() or heading_lower.startswith(f"{section_id.lower()} edit"):
            return section_html
    return ""


def wikipedia_sections(html_text: str) -> List[tuple[str, str]]:
    headings = list(re.finditer(r"(?is)<h2\b([^>]*)>(.*?)</h2>", html_text))
    sections: List[tuple[str, str]] = []
    for index, heading in enumerate(headings):
        heading_text = strip_html_fragment(heading.group(2) or "")
        if heading_text.lower().endswith(" edit"):
            heading_text = heading_text[:-5].strip()
        start = heading.end()
        end = headings[index + 1].start() if index + 1 < len(headings) else len(html_text)
        if heading_text:
            sections.append((heading_text, html_text[start:end]))
    return sections


def wikipedia_section_html_legacy(html_text: str, section_id: str) -> str:
    headings = list(re.finditer(r"(?is)<h2\b([^>]*)>(.*?)</h2>", html_text))
    match = None
    section_lower = section_id.lower()
    for heading in headings:
        attrs = heading.group(1) or ""
        inner_html = heading.group(2) or ""
        heading_text = strip_html_fragment(inner_html).lower()
        if re.search(rf"(?i)\bid=[\"']{re.escape(section_id)}[\"']", attrs + inner_html):
            match = heading
            break
        if heading_text == section_lower or heading_text.startswith(f"{section_lower} edit"):
            match = heading
            break
    if not match:
        return ""
    start = match.end()
    next_heading = next((heading for heading in headings if heading.start() > start), None)
    end = next_heading.start() if next_heading else len(html_text)
    return html_text[start:end]


def parse_wikipedia_cast_item(item_text: str, links: List[str]) -> Dict[str, str]:
    actor = links[0] if links else ""
    character = ""
    description = ""
    text = clean_source_label(item_text)
    split_match = re.match(r"(?is)(.+?)\s+as\s+(.+)$", text)
    if split_match:
        actor = clean_source_label(split_match.group(1))
        remainder = clean_source_label(split_match.group(2))
        if ":" in remainder:
            character_part, description_part = remainder.split(":", 1)
            character = clean_source_label(character_part)
            description = compact_character_role_description(description_part)
        else:
            character = remainder
    if not character and len(links) > 1:
        character = links[1]
    return {
        "actor": actor,
        "character": character,
        "description": description,
        "role": infer_character_role_label(character, description),
    }


def append_wikipedia_narrative_place(values: List[str], label: Any, *, limit: int = 28) -> None:
    cleaned = clean_source_label(label)
    if not cleaned or len(cleaned) > 80:
        return
    lower = cleaned.lower()
    narrative_place_terms = {
        "jamaica",
        "cuba",
        "norway",
        "london",
        "matera",
        "gravina in puglia",
        "belmarsh prison",
        "mi6",
        "cia",
        "spectre",
        "safin's island",
    }
    if lower in narrative_place_terms or any(token in lower for token in (" island", " prison", " laboratory", " headquarters")):
        append_unique_text(values, cleaned, limit=limit)


def append_operational_keyword(values: List[str], label: Any, *, limit: int = 24) -> None:
    cleaned = clean_source_label(label)
    lower = cleaned.lower()
    allowed_terms = (
        "james bond",
        "mi6",
        "cia",
        "spectre",
        "bioterror",
        "revenge",
        "secret agent",
        "mission",
    )
    if "james bond" in lower:
        append_metadata_keyword(values, cleaned, limit=limit)
        return
    blocked = (
        "american ",
        "british ",
        "english-language",
        " films",
        " film",
        "3d ",
        "imax",
        "4dx",
        "box office",
        "delayed",
        "pandemic",
    )
    if not cleaned or any(term in lower for term in blocked):
        return
    if any(term in lower for term in allowed_terms):
        append_metadata_keyword(values, cleaned, limit=limit)


def extract_narrative_time_candidates(text: Any, *, limit: int = 12) -> List[str]:
    values: List[str] = []
    cleaned = clean_source_label(text)
    for pattern in (
        r"\b(?:in the )?present day\b",
        r"\bfive years later\b",
        r"\b\d+\s+years later\b",
        r"\badolescent\b",
    ):
        for match in re.finditer(pattern, cleaned, flags=re.I):
            append_unique_text(values, match.group(0), limit=limit)
    return values


def extract_wikipedia_plot_synopsis(plot_section: str, *, limit: int = 900) -> str:
    paragraphs: List[str] = []
    for paragraph_match in re.finditer(r"(?is)<p\b[^>]*>(.*?)</p>", plot_section):
        paragraph = strip_html_fragment(paragraph_match.group(1))
        if len(paragraph) < 80:
            continue
        if re.search(r"(?i)\b(?:filming|production|directed by|released by|box office|critical response)\b", paragraph):
            continue
        paragraphs.append(paragraph)
        if len(" ".join(paragraphs)) >= limit:
            break
    return compact_web_excerpt(" ".join(paragraphs), limit=limit)


def score_wikipedia_synopsis_section(heading: str, section_html: str) -> int:
    heading_lower = heading.lower()
    section_text = strip_html_fragment(section_html).lower()
    if not section_text:
        return -100
    score = 0
    if heading_lower in {"plot", "synopsis", "premise", "story", "plot summary", "storyline", "scenario"}:
        score += 80
    elif any(term in heading_lower for term in ("plot", "synopsis", "premise", "story")):
        score += 55
    if any(term in heading_lower for term in ("production", "cast", "release", "reception", "box office", "music", "filming", "marketing")):
        score -= 90
    narrative_signals = (
        "follows",
        "centres on",
        "centers on",
        "tells the story",
        "is asked",
        "is assigned",
        "discovers",
        "uncovers",
        "travels",
        "meets",
        "kills",
        "escapes",
        "suspects",
        "investigates",
        "attempts",
        "returns",
        "living in",
    )
    production_signals = (
        "directed by",
        "produced by",
        "released",
        "box office",
        "grossed",
        "screenplay",
        "filming",
        "principal photography",
        "critical response",
        "review aggregator",
    )
    score += sum(8 for term in narrative_signals if term in section_text)
    score -= sum(14 for term in production_signals if term in section_text)
    paragraph_count = section_html.lower().count("<p")
    score += min(paragraph_count, 4) * 4
    return score


def wikipedia_best_synopsis_section(html_text: str) -> str:
    candidates = wikipedia_sections(html_text)
    if not candidates:
        return ""
    ranked = sorted(
        (
            (score_wikipedia_synopsis_section(heading, section_html), heading, section_html)
            for heading, section_html in candidates
        ),
        key=lambda item: item[0],
        reverse=True,
    )
    best_score, _, best_section = ranked[0]
    return best_section if best_score > 0 else ""


def append_wikipedia_place(values: List[str], label: Any, *, limit: int = 28) -> None:
    cleaned = clean_source_label(label)
    if not cleaned:
        return
    lower = cleaned.lower()
    blocked_terms = {
        "imax",
        "spectre",
        "casino royale",
        "quantum of solace",
        "aston martin",
        "db5",
        "dbs superleggera",
        "valhalla",
        "james bond",
        "no time to die",
    }
    if any(term in lower for term in blocked_terms):
        return
    if len(cleaned) > 60:
        return
    append_unique_text(values, cleaned, limit=limit)


def extract_wikipedia_metadata_profile(html_text: str) -> Dict[str, Any]:
    profile: Dict[str, Any] = {
        "description": "",
        "persons": [],
        "character_roles": [],
        "production_crew": [],
        "places": [],
        "dates": [],
        "keywords": [],
        "genre": "",
        "genre_subtype": "",
        "situational_genre": "",
        "source_types": ["Wikipedia article body"],
    }
    persons: List[str] = []
    character_roles: List[Dict[str, str]] = []
    production_crew: List[Dict[str, str]] = []
    places: List[str] = []
    dates: List[str] = []
    keywords: List[str] = []

    for paragraph_match in re.finditer(r"(?is)<p\b[^>]*>(.*?)</p>", html_text):
        paragraph = strip_html_fragment(paragraph_match.group(1))
        paragraph_lower = paragraph.lower()
        if len(paragraph) < 140:
            continue
        if paragraph_lower.startswith("for other uses"):
            continue
        profile["description"] = compact_web_excerpt(paragraph, limit=720)
        break

    synopsis_section = wikipedia_best_synopsis_section(html_text)
    plot_synopsis = extract_wikipedia_plot_synopsis(synopsis_section)
    if plot_synopsis:
        profile["description"] = plot_synopsis
        profile["source_types"].append("Wikipedia plot section")

    infobox_match = re.search(
        r"(?is)<table[^>]+class=[\"'][^\"']*\binfobox\b[^\"']*[\"'][^>]*>(.*?)</table>",
        html_text,
    )
    if infobox_match:
        for row_match in re.finditer(r"(?is)<tr\b[^>]*>(.*?)</tr>", infobox_match.group(1)):
            row_html = row_match.group(1)
            th_match = re.search(r"(?is)<th\b[^>]*>(.*?)</th>", row_html)
            td_match = re.search(r"(?is)<td\b[^>]*>(.*?)</td>", row_html)
            if not th_match or not td_match:
                continue
            key = strip_html_fragment(th_match.group(1)).lower()
            td_html = td_match.group(1)
            link_values = extract_link_texts(td_html, limit=24)
            text_value = strip_html_fragment(td_html)
            values = link_values or split_metadata_text_values(text_value, limit=18)
            if any(term in key for term in ("directed", "screenplay", "story", "produced", "cinematography", "edited", "music")):
                for person in values:
                    append_unique_record(
                        production_crew,
                        {"person": person, "department": key},
                        limit=32,
                    )

    cast_section = wikipedia_section_html(html_text, "Cast")
    for item_match in re.finditer(r"(?is)<li\b[^>]*>(.*?)</li>", cast_section):
        item_html = item_match.group(1)
        links = extract_link_texts(item_html, limit=4)
        item_text = strip_html_fragment(item_html)
        role = parse_wikipedia_cast_item(item_text, links)
        if role.get("character"):
            append_unique_text(persons, role.get("character"), limit=32)
        if role.get("actor") or role.get("character"):
            append_unique_record(character_roles, role, limit=36)

    for paragraph_match in re.finditer(r"(?is)<p\b[^>]*>(.*?)</p>", synopsis_section):
        paragraph_html = paragraph_match.group(1)
        paragraph_text = strip_html_fragment(paragraph_html)
        for place in extract_link_texts(paragraph_html, limit=48):
            append_wikipedia_narrative_place(places, place, limit=28)
        for time_value in extract_narrative_time_candidates(paragraph_text, limit=12):
            append_unique_text(dates, time_value, limit=12)

    filming_section = wikipedia_section_html(html_text, "Filming")
    for paragraph_match in re.finditer(r"(?is)<p\b[^>]*>(.*?)</p>", filming_section):
        paragraph_html = paragraph_match.group(1)
        paragraph_text = strip_html_fragment(paragraph_html)
        if not any(term in paragraph_text.lower() for term in ("filming", "location", "shot", "production moved")):
            continue
        for place in extract_link_texts(paragraph_html, limit=48):
            append_wikipedia_place(places, place, limit=28)
        for date_value in extract_date_candidates(paragraph_text, limit=18):
            append_unique_text(dates, date_value, limit=18)

    category_labels: List[str] = []
    for category_match in re.finditer(r"(?is)title=[\"']Category:([^\"']+)[\"']", html_text):
        category = html.unescape(category_match.group(1)).replace("_", " ")
        category = clean_source_label(category)
        if not category or category.lower().startswith(("hidden", "cs1", "articles")):
            continue
        append_unique_text(category_labels, category, limit=32)
        append_operational_keyword(keywords, category, limit=24)

    category_text = " ".join(category_labels).lower()
    if "film" in category_text or "james bond" in category_text:
        profile["genre"] = "movie drama / fiction"
    if "spy action" in category_text or "action thriller" in category_text or "action drama" in category_text:
        profile["genre_subtype"] = "action / adventure"
    elif "thriller" in category_text:
        profile["genre_subtype"] = "suspense / thriller"
    if any(term in category_text for term in ("spy", "terrorism", "cia", "mi6", "bioterrorism")):
        profile["situational_genre"] = "confrontation"

    for role in character_roles:
        for role_label in split_role_labels(role.get("role")):
            append_operational_keyword(keywords, role_label, limit=24)
        append_operational_keyword(keywords, role.get("character"), limit=24)

    profile["persons"] = persons
    profile["character_roles"] = character_roles
    profile["production_crew"] = production_crew
    profile["places"] = places
    profile["dates"] = dates
    profile["keywords"] = keywords
    return profile


def parse_web_metadata_html(html_text: str, source_url: str, retrieved_at: str) -> Dict[str, Any]:
    parser = WebMetadataHTMLParser()
    parser.feed(html_text)
    parsed_source = urllib.parse.urlparse(source_url)
    is_wikipedia_source = "wikipedia.org" in parsed_source.netloc.lower() or "mw-parser-output" in html_text
    wikipedia_profile = extract_wikipedia_metadata_profile(html_text) if is_wikipedia_source else {}
    title = (
        parser.meta.get("og:title")
        or parser.meta.get("twitter:title")
        or clean_source_label(" ".join(parser.title_parts))
    )
    description = (
        parser.meta.get("description")
        or parser.meta.get("og:description")
        or parser.meta.get("twitter:description")
    )
    if not description and wikipedia_profile.get("description"):
        description = wikipedia_profile.get("description")
    keywords: List[str] = []
    for raw_keyword in re.split(r"[,;|]", parser.meta.get("keywords", "")):
        append_metadata_keyword(keywords, raw_keyword, limit=16)

    persons: List[str] = []
    places: List[str] = []
    dates: List[str] = []
    json_ld_types: List[str] = []
    json_ld_payloads: List[Any] = []

    def inspect_json_ld(node: Any) -> None:
        if isinstance(node, list):
            for item in node:
                inspect_json_ld(item)
            return
        if not isinstance(node, dict):
            return
        json_ld_payloads.append(node)
        for type_value in normalize_web_metadata_values(node.get("@type"), limit=8):
            append_unique_text(json_ld_types, type_value, limit=12)
        for key in ("name", "headline"):
            if not title:
                pass
        for key in ("actor", "actors", "director", "creator", "performer"):
            if is_wikipedia_source:
                continue
            for person in normalize_web_metadata_values(node.get(key), limit=12):
                append_unique_text(persons, person, limit=18)
        for key in ("author", "contributor"):
            for person in normalize_web_metadata_values(node.get(key), limit=12):
                if not is_source_author_noise(person, source_url=source_url):
                    append_unique_text(persons, person, limit=18)
        for key in ("contentLocation", "location", "spatialCoverage", "place"):
            for place in normalize_web_metadata_values(node.get(key), limit=12):
                append_unique_text(places, place, limit=18)
        if not is_wikipedia_source:
            for key in ("datePublished", "uploadDate", "dateCreated", "temporalCoverage"):
                for date_value in normalize_web_metadata_values(node.get(key), limit=8):
                    append_unique_text(dates, date_value, limit=12)
        for keyword in normalize_web_metadata_values(node.get("keywords"), limit=18):
            append_metadata_keyword(keywords, keyword, limit=24)
        graph = node.get("@graph")
        if graph:
            inspect_json_ld(graph)

    for script in parser.json_ld:
        try:
            inspect_json_ld(json.loads(script))
        except Exception:
            continue

    if not is_wikipedia_source:
        for meta_key in ("article:published_time", "video:release_date", "date", "dc.date"):
            append_unique_text(dates, parser.meta.get(meta_key), limit=12)
    for meta_key in ("article:author", "author", "dc.creator"):
        person = parser.meta.get(meta_key)
        if not is_source_author_noise(person, source_url=source_url):
            append_unique_text(persons, person, limit=18)
    for meta_key in ("og:site_name", "application-name"):
        append_metadata_keyword(keywords, parser.meta.get(meta_key), limit=24)

    for person in wikipedia_profile.get("persons") or []:
        append_unique_text(persons, person, limit=32)
    character_roles: List[Dict[str, str]] = list(wikipedia_profile.get("character_roles") or [])
    production_crew: List[Dict[str, str]] = list(wikipedia_profile.get("production_crew") or [])
    for place in wikipedia_profile.get("places") or []:
        append_unique_text(places, place, limit=28)
    for date_value in wikipedia_profile.get("dates") or []:
        append_unique_text(dates, date_value, limit=18)
    for keyword in wikipedia_profile.get("keywords") or []:
        append_metadata_keyword(keywords, keyword, limit=32)
    for source_type in wikipedia_profile.get("source_types") or []:
        append_unique_text(json_ld_types, source_type, limit=12)

    combined_text = " ".join(
        [
            title or "",
            description or "",
            " ".join(keywords),
            " ".join(json_ld_types),
        ]
    ).lower()
    genre = ""
    genre_subtype = ""
    if "trailer" in combined_text:
        genre = "advertising / promo"
        genre_subtype = "movie trailer"
    elif any(term in combined_text for term in ("movie", "film", "videoobject")):
        genre = "movie drama / fiction"
    elif any(term in combined_text for term in ("news", "article", "report")):
        genre = "news"
    elif any(term in combined_text for term in ("interview", "conversation", "qa", "q&a")):
        genre = "interview"

    situational_genre = ""
    situational_subtype = ""
    if any(term in combined_text for term in ("interview", "conversation", "q&a")):
        situational_genre = "interview"
        situational_subtype = "profile interview"
    elif any(term in combined_text for term in ("conflict", "threat", "betray", "secret", "mission")):
        situational_genre = "confrontation"
    elif any(term in combined_text for term in ("summit", "conference", "cop", "climate")):
        situational_genre = "briefing"
        situational_subtype = "status update"
    elif "trailer" in combined_text:
        situational_genre = "performance / entertainment"

    genre = wikipedia_profile.get("genre") or genre
    genre_subtype = wikipedia_profile.get("genre_subtype") or genre_subtype
    situational_genre = wikipedia_profile.get("situational_genre") or situational_genre
    situational_subtype = wikipedia_profile.get("situational_subtype") or situational_subtype

    fields = {
        "title": title,
        "description": description,
        "persons": persons,
        "character_roles": character_roles,
        "production_crew": production_crew,
        "places": places,
        "dates": dates,
        "keywords": keywords,
        "genre": genre,
        "genre_subtype": genre_subtype,
        "situational_genre": situational_genre,
        "situational_subtype": situational_subtype,
        "source_url": source_url,
        "retrieved_at": retrieved_at,
        "source_types": json_ld_types,
    }
    candidates: List[Dict[str, Any]] = []
    candidate_specs = [
        ("title", fields.get("title"), "meta/title"),
        (
            "description",
            fields.get("description"),
            "wikipedia/plot_synopsis"
            if "Wikipedia plot section" in (wikipedia_profile.get("source_types") or [])
            else "meta/jsonld/article_lead",
        ),
        ("persons", fields.get("persons"), "jsonld/meta/infobox/cast"),
        ("character_roles", [format_character_role_candidate(role) for role in fields.get("character_roles", [])], "wikipedia/cast_role_descriptions"),
        ("production_crew", [format_production_crew_candidate(role) for role in fields.get("production_crew", [])], "wikipedia/infobox_production_crew"),
        ("places", fields.get("places"), "jsonld/meta/infobox/filming"),
        ("dates", fields.get("dates"), "jsonld/meta/infobox/article_body"),
        ("keywords", fields.get("keywords"), "meta/jsonld/categories"),
        ("genre", fields.get("genre"), "vaa1_taxonomy/categories/jsonld/meta/heuristic"),
        ("genre_subtype", fields.get("genre_subtype"), "vaa1_taxonomy/categories/jsonld/meta/heuristic"),
        ("situational_genre", fields.get("situational_genre"), "vaa1_taxonomy/categories/jsonld/meta/heuristic"),
        ("situational_subtype", fields.get("situational_subtype"), "vaa1_taxonomy/categories/jsonld/meta/heuristic"),
    ]
    for field, value, selector in candidate_specs:
        values = value if isinstance(value, list) else ([value] if value else [])
        for item in values:
            cleaned = clean_source_label(item)
            if not cleaned:
                continue
            candidates.append(
                {
                    "field": field,
                    "value": cleaned,
                    "source_url": source_url,
                    "retrieved_at": retrieved_at,
                    "selector": selector,
                    "raw_excerpt": cleaned[:240],
                    "confidence": "medium",
                    "review_state": "candidate",
                }
            )
    return {
        "fields": fields,
        "candidates": candidates,
        "visible_text_excerpt": clean_source_label(" ".join(parser.visible_parts))[:900],
        "json_ld_count": len(json_ld_payloads),
    }


def harvest_web_address_metadata(source_url: str) -> Dict[str, Any]:
    parsed = urllib.parse.urlparse(source_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Web metadata source must be an http or https URL")
    retrieved_at = datetime.now(timezone.utc).isoformat()
    request = urllib.request.Request(
        source_url,
        headers={
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.2",
            "User-Agent": "VAA1 metadata governance harvester/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            content_type = response.headers.get("Content-Type", "")
            status_code = getattr(response, "status", None)
            raw = response.read(2_000_000)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not retrieve web metadata source: {exc}") from exc
    charset_match = re.search(r"charset=([^;]+)", content_type, re.IGNORECASE)
    charset = charset_match.group(1).strip() if charset_match else "utf-8"
    html_text = raw.decode(charset, errors="replace")
    parsed_metadata = parse_web_metadata_html(html_text, source_url, retrieved_at)
    return {
        "id": uuid.uuid4().hex,
        "url": source_url,
        "preference": "supporting",
        "retrieved_at": retrieved_at,
        "status": "retrieved",
        "http_status": status_code,
        "content_type": content_type,
        **parsed_metadata,
    }


def canonical_web_metadata_url(value: Any) -> str:
    parsed = urllib.parse.urlparse(str(value or "").strip())
    if not parsed.scheme or not parsed.netloc:
        return str(value or "").strip().lower()
    return urllib.parse.urlunparse(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path.rstrip("/") or "/",
            "",
            parsed.query,
            "",
        )
    )


def web_metadata_source_sort_key(source: Dict[str, Any]) -> tuple[int, str]:
    preference_rank = {"main": 0, "supporting": 1, "background": 2}
    return (
        preference_rank.get(str(source.get("preference") or "supporting").lower(), 1),
        str(source.get("retrieved_at") or ""),
    )


def dedupe_web_metadata_sources(sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_url: Dict[str, Dict[str, Any]] = {}
    for source in sources:
        key = canonical_web_metadata_url(source.get("url") or source.get("fields", {}).get("source_url"))
        if not key:
            continue
        existing = by_url.get(key)
        if existing is None or str(source.get("retrieved_at") or "") >= str(existing.get("retrieved_at") or ""):
            by_url[key] = source
    return sorted(by_url.values(), key=web_metadata_source_sort_key)


def read_json_any_artifact(path_value: Any) -> Any:
    if not path_value:
        return None
    path = Path(str(path_value))
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def artifact_payload_from_status(status: Dict[str, Any], key: str) -> Any:
    if key in status and status.get(key) not in (None, ""):
        direct_payload = status.get(key)
        if isinstance(direct_payload, str):
            parsed_payload = read_json_any_artifact(direct_payload)
            if parsed_payload is not None:
                return parsed_payload
        if isinstance(direct_payload, dict) and direct_payload.get("output_json_path"):
            parsed_payload = read_json_any_artifact(direct_payload.get("output_json_path"))
            if parsed_payload is not None:
                return parsed_payload
        return direct_payload
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    if key in results and results.get(key) not in (None, ""):
        direct_payload = results.get(key)
        if isinstance(direct_payload, str):
            parsed_payload = read_json_any_artifact(direct_payload)
            if parsed_payload is not None:
                return parsed_payload
        if isinstance(direct_payload, dict) and direct_payload.get("output_json_path"):
            parsed_payload = read_json_any_artifact(direct_payload.get("output_json_path"))
            if parsed_payload is not None:
                return parsed_payload
        return direct_payload
    for collection_key in ("output_files", "internal_artifacts"):
        collection = status.get(collection_key)
        if isinstance(collection, dict):
            payload = read_json_any_artifact(collection.get(key))
            if payload is not None:
                return payload
    return None


def artifact_payload_from_status_any(status: Dict[str, Any], *keys: str) -> Any:
    for key in keys:
        payload = artifact_payload_from_status(status, key)
        if payload is not None:
            return payload
    return None


def collect_values_by_key(
    payload: Any,
    key_names: set[str],
    *,
    limit: int = 24,
) -> List[str]:
    values: List[str] = []

    def visit(value: Any) -> None:
        if len(values) >= limit:
            return
        if isinstance(value, dict):
            for key, nested in value.items():
                if len(values) >= limit:
                    return
                normalized_key = str(key).lower().replace("-", "_")
                if normalized_key in key_names:
                    if isinstance(nested, (str, int, float)):
                        append_unique_text(values, nested, limit=limit)
                    elif isinstance(nested, list):
                        for item in nested:
                            if isinstance(item, (str, int, float)):
                                append_unique_text(values, item, limit=limit)
                visit(nested)
        elif isinstance(value, list):
            for item in value:
                visit(item)

    visit(payload)
    return values


def collect_scene_card_accounts(payload: Any, *, limit: int = 8) -> List[str]:
    accounts: List[str] = []
    key_names = {
        "scene_account",
        "account",
        "summary",
        "description",
        "what_is_happening",
        "what_happens",
        "situation",
    }
    for value in collect_values_by_key(payload, key_names, limit=limit * 2):
        if len(value.split()) >= 4:
            append_unique_text(accounts, value, limit=limit)
    return accounts


def append_csv_terms(target: List[str], value: Any, *, limit: int = 24) -> None:
    if isinstance(value, list):
        for item in value:
            append_unique_text(target, item, limit=limit)
        return
    if isinstance(value, str):
        for part in value.replace("\n", ",").split(","):
            append_unique_text(target, part, limit=limit)


def detection_start_seconds(item: Dict[str, Any]) -> Optional[float]:
    for key in ("timestamp_seconds", "time_seconds", "start_seconds", "start", "time", "timestamp"):
        value = safe_float(item.get(key))
        if value is not None:
            return value / 1000.0 if value > 1000 else value
    interval = item.get("time_interval")
    if isinstance(interval, dict):
        value = safe_float(interval.get("start_ms") or interval.get("start"))
        if value is not None:
            return value / 1000.0 if value > 1000 else value
    return None


def detection_text_value(item: Dict[str, Any]) -> str:
    text = item.get("text") or item.get("ocr_text") or item.get("label")
    if text:
        return clean_source_label(text)
    payload = item.get("payload")
    if isinstance(payload, dict):
        return clean_source_label(payload.get("text") or payload.get("ocr_text") or payload.get("label"))
    return ""


def detection_confidence_value(item: Dict[str, Any]) -> Optional[float]:
    value = safe_float(item.get("confidence"))
    if value is not None:
        return value
    payload = item.get("payload")
    if isinstance(payload, dict):
        return safe_float(payload.get("confidence"))
    return None


def is_useful_ocr_metadata_text(text: str, confidence: Optional[float] = None) -> bool:
    cleaned = clean_source_label(text)
    if not cleaned:
        return False
    if confidence is not None and confidence < 0.72:
        return False
    letters = sum(1 for char in cleaned if char.isalpha())
    digits = sum(1 for char in cleaned if char.isdigit())
    if letters < 3 or digits > letters * 2:
        return False
    if any(char in cleaned for char in ("}", "{", '"', "\\", "|")):
        return False
    return True


OCR_SINGLE_TOKEN_METADATA_KEEP = {
    "007.com",
    "bbc",
    "cop30",
    "imdb",
    "mgm",
    "universal",
}


def is_boundary_ocr_metadata_text(text: str) -> bool:
    cleaned = clean_source_label(text)
    lower = cleaned.lower()
    if any(
        phrase in lower
        for phrase in (
            "directed by",
            "produced by",
            "written by",
            "filmed by",
            "camera",
            "cinematography",
            "starring",
            "editor",
            "music by",
        )
    ):
        return True
    if len(cleaned.split()) > 1:
        return True
    return lower in OCR_SINGLE_TOKEN_METADATA_KEEP


def collect_ocr_items_from_payload(payload: Any) -> List[Dict[str, Any]]:
    """Collect OCR rows from flat detections and time-bank OCR artifacts.

    Some VAA1 OCR exports keep text rows under ``objects`` and timing under a
    parallel ``anchors`` array. Pairing them here keeps beginning/end title OCR
    available to metadata maturity without mutating the raw artifact.
    """

    collected: List[Dict[str, Any]] = []

    if isinstance(payload, dict):
        anchors = payload.get("anchors")
        objects = payload.get("objects")
        if isinstance(anchors, list) and isinstance(objects, list):
            for index, item in enumerate(objects):
                if not isinstance(item, dict):
                    continue
                paired = dict(item)
                if detection_start_seconds(paired) is None and index < len(anchors):
                    anchor = anchors[index]
                    if isinstance(anchor, dict):
                        start = (
                            anchor.get("timestamp_seconds")
                            or anchor.get("time_seconds")
                            or anchor.get("start_seconds")
                            or anchor.get("t_start")
                            or anchor.get("start")
                        )
                        if start is None and anchor.get("t_start_ms") is not None:
                            start = safe_float(anchor.get("t_start_ms"))
                            if start is not None:
                                start = start / 1000.0
                        if start is not None:
                            paired["timestamp_seconds"] = start
                collected.append(paired)

    collected.extend(iter_detection_items(payload))

    seen: set[tuple[str, str]] = set()
    unique: List[Dict[str, Any]] = []
    for item in collected:
        if not isinstance(item, dict):
            continue
        text = detection_text_value(item)
        if not is_useful_ocr_metadata_text(text, detection_confidence_value(item)):
            continue
        start = detection_start_seconds(item)
        key = (text.lower(), "" if start is None else f"{start:.3f}")
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def collect_ocr_boundary_metadata(
    ocr_items: List[Dict[str, Any]],
    duration_seconds: Optional[float],
) -> Dict[str, Any]:
    timed_items: List[tuple[float, str]] = []
    untimed_text: List[str] = []
    for item in ocr_items:
        if not isinstance(item, dict):
            continue
        text = detection_text_value(item)
        if not is_useful_ocr_metadata_text(text, detection_confidence_value(item)):
            continue
        start = detection_start_seconds(item)
        if start is None:
            if is_boundary_ocr_metadata_text(text):
                append_unique_text(untimed_text, text, limit=18)
            continue
        timed_items.append((start, text))

    timed_items.sort(key=lambda pair: pair[0])
    max_time = max((time for time, _ in timed_items), default=duration_seconds or 0.0)
    duration = duration_seconds or max_time
    beginning_window = max(20.0, (duration or 0.0) * 0.12)
    ending_window_start = max(0.0, (duration or max_time or 0.0) - max(30.0, (duration or 0.0) * 0.15))

    beginning: List[str] = []
    ending: List[str] = []
    for start, text in timed_items:
        if start <= beginning_window:
            if is_boundary_ocr_metadata_text(text):
                append_unique_text(beginning, text, limit=24)
        if duration and start >= ending_window_start:
            if is_boundary_ocr_metadata_text(text):
                append_unique_text(ending, text, limit=32)

    if not timed_items and untimed_text:
        beginning = untimed_text[:12]

    crew_terms: List[str] = []
    title_terms: List[str] = []
    credit_phrases = (
        "directed by",
        "produced by",
        "written by",
        "filmed by",
        "camera",
        "cinematography",
        "starring",
        "editor",
        "music by",
    )
    for text in beginning + ending:
        lower = text.lower()
        if any(phrase in lower for phrase in credit_phrases):
            append_unique_text(crew_terms, text, limit=16)
        elif 1 < len(text.split()) <= 8 and not any(char.isdigit() for char in text):
            append_unique_text(title_terms, text, limit=8)

    return {
        "beginning_text": beginning,
        "ending_text": ending,
        "title_candidates": title_terms,
        "crew_candidates": crew_terms,
        "has_timed_ocr": bool(timed_items),
    }


def transcript_segments_from_status(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    candidates: List[Any] = []
    audio = ((status.get("results") or {}).get("audio_analysis") or {})
    if isinstance(audio.get("transcript"), dict):
        candidates.append(audio.get("transcript"))
    candidates.append(status.get("transcript"))
    for key in ("transcript", "linked_transcript"):
        candidates.append(read_json_any_artifact(output_files.get(key)))

    for payload in candidates:
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]
        if isinstance(payload, dict):
            raw_segments = payload.get("segments") or payload.get("transcript") or payload.get("timeline_segments")
            if isinstance(raw_segments, list):
                return [item for item in raw_segments if isinstance(item, dict)]
    return []


def video_internal_source_media_harvest(status: Dict[str, Any]) -> Dict[str, Any]:
    """Derive conservative source metadata candidates from existing video evidence.

    This is intentionally not a manual annotation writer. It proposes mature
    video-internal values that can fill empty fields in Source Media metadata,
    while explicit analyst metadata keeps authority.
    """

    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    visual = results.get("visual_analysis") if isinstance(results.get("visual_analysis"), dict) else {}
    original_filename = clean_source_label(status.get("original_filename") or status.get("filename"))
    title = Path(original_filename).stem if original_filename else ""
    title_lower = title.lower()

    transcript_segments = transcript_segments_from_status(status)
    transcript_text = " ".join(
        clean_source_label(segment.get("text"))
        for segment in transcript_segments[:80]
        if isinstance(segment, dict) and segment.get("text")
    )
    transcript_lower = transcript_text.lower()

    tracked_payload = visual.get("tracked_objects") or artifact_payload_from_status_any(
        status,
        "tracked_objects",
        "tracked_objects_json",
        "time_bank_objects",
        "object_tracks",
    )
    tracked_objects = iter_detection_items(tracked_payload)
    ocr_payload = visual.get("ocr_results") or artifact_payload_from_status_any(
        status,
        "time_bank_ocr",
        "ocr_results",
        "ocr",
        "ocr_json",
    )
    ocr_items = collect_ocr_items_from_payload(ocr_payload)
    ocr_text = " ".join(
        detection_text_value(item)
        for item in ocr_items[:80]
        if isinstance(item, dict)
    )
    ocr_lower = ocr_text.lower()
    stored_probe = status.get("source_media_metadata") if isinstance(status.get("source_media_metadata"), dict) else {}
    duration_seconds = safe_float(
        status.get("duration_seconds")
        or stored_probe.get("duration_seconds")
        or stored_probe.get("duration")
    )
    ocr_boundary_metadata = collect_ocr_boundary_metadata(ocr_items, duration_seconds)

    pos_analysis = artifact_payload_from_status_any(status, "pos_analysis", "pos")
    pos_matrix = artifact_payload_from_status_any(status, "pos_matrix", "pos_matrix_json")
    sfl_stage = artifact_payload_from_status_any(status, "dependency_sfl_stage1", "sfl_stage1")
    meaning_stage = artifact_payload_from_status_any(status, "multimodal_meaning_stage1", "meaning_plot_stage1")
    second_order = artifact_payload_from_status_any(status, "second_order_label_proliferation", "second_order_labels")
    scene_cards = artifact_payload_from_status_any(status, "mise_en_scene_scene_cards", "scene_cards")
    master_schema = artifact_payload_from_status_any(status, "vaa1_annotation_master_schema", "master_schema")
    cinematic_clues = visual.get("cinematic_clues") or artifact_payload_from_status_any(
        status,
        "cinematic_clues",
        "cinematic_clues_json",
    )

    interrogative_terms = collect_values_by_key(
        [pos_analysis, pos_matrix],
        {
            "who",
            "what",
            "where",
            "when",
            "why",
            "how",
            "by_what_means",
            "towards_what_end",
            "by_what_consequences",
            "interrogative",
            "interrogative_label",
        },
        limit=18,
    )
    case_terms = collect_values_by_key(
        [pos_analysis, pos_matrix],
        {"case", "case_label", "semantic_role", "role", "participant_role"},
        limit=16,
    )
    sfl_terms = collect_values_by_key(
        sfl_stage,
        {
            "speech_function",
            "candidate_label",
            "label_family",
            "process_type",
            "sfl_process_type",
            "interpersonal_function",
        },
        limit=18,
    )
    meaning_terms = collect_values_by_key(
        [meaning_stage, second_order],
        {
            "label",
            "candidate_label",
            "meaning_label",
            "plot_label",
            "event_label",
            "theme",
            "topic",
            "situation",
            "stage",
        },
        limit=20,
    )
    cinematic_terms = collect_values_by_key(
        cinematic_clues,
        {"label", "clue", "clue_type", "shot_type", "framing", "lighting", "camera", "color"},
        limit=14,
    )
    scene_accounts = collect_scene_card_accounts(scene_cards, limit=6)
    master_terms = collect_values_by_key(
        master_schema,
        {
            "title",
            "person",
            "person_name",
            "display_name",
            "role",
            "location",
            "place",
            "city",
            "country",
            "date",
            "genre",
            "situation",
            "description",
            "source_context",
        },
        limit=24,
    )

    persons: List[str] = []
    if "james bond" in title_lower or "james bond" in transcript_lower:
        append_unique_text(persons, "James Bond")
    if "007" in title_lower or "007" in transcript_lower:
        append_unique_text(persons, "007")
    append_csv_terms(persons, collect_values_by_key(master_schema, {"person", "person_name", "display_name"}, limit=10), limit=12)
    append_csv_terms(persons, ocr_boundary_metadata.get("crew_candidates"), limit=16)
    for item in tracked_objects[:120]:
        label = clean_source_label(
            item.get("display_label")
            or item.get("identity_label")
            or item.get("label")
            or item.get("class_name")
        )
        if "/" in label:
            label = label.split("/", 1)[0].strip()
        label_lower = label.lower()
        if not label or label_lower in {"person", "unknown"}:
            continue
        if "person track" in label_lower or "person untracked" in label_lower:
            continue
        if any(char.isupper() for char in label) and len(label.split()) <= 5:
            append_unique_text(persons, label)

    diarization_payload = artifact_payload_from_status_any(status, "audio_diarization")
    character_definitions = collect_web_metadata_character_definitions(status)
    narrative_agent_profiles = build_narrative_agent_profiles(
        character_definitions, diarization_payload=diarization_payload
    )
    character_roles = [
        normalize_character_role_candidate(
            {
                "character": definition.get("character_name"),
                "actor": definition.get("actor_name"),
                "role": ", ".join(definition.get("role_labels") or []),
                "description": definition.get("role_description"),
            }
        )
        for definition in character_definitions
    ]
    for definition in character_definitions:
        for person in (definition.get("character_name"), definition.get("actor_name")):
            if person and len(person.split()) <= 6:
                append_unique_text(persons, person, limit=32)

    keywords: List[str] = []
    for term in (
        "James Bond",
        "007",
        "secrets",
        "trust",
        "world",
        "weapon",
        "MI6",
        "commander",
        "brother",
        "trailer",
        "COP30",
        "climate",
        "Brazil",
        "Belem",
    ):
        if term.lower() in transcript_lower or term.lower() in title_lower or term.lower() in ocr_lower:
            append_metadata_keyword(keywords, term, limit=16)
    for term in interrogative_terms + case_terms + sfl_terms + meaning_terms + cinematic_terms:
        append_metadata_keyword(keywords, term, limit=24)
    for term in (
        (ocr_boundary_metadata.get("title_candidates") or [])
        + (ocr_boundary_metadata.get("crew_candidates") or [])
    ):
        append_metadata_keyword(keywords, term, limit=24)

    location_place = ""
    location_city = ""
    location_country = ""
    master_places = collect_values_by_key(master_schema, {"location_place", "place", "location", "city", "country"}, limit=12)
    if "belém" in ocr_lower or "belem" in ocr_lower:
        location_city = "Belem"
    if "brazil" in transcript_lower or "brazil" in ocr_lower:
        location_country = "Brazil"
    if "cop30" in ocr_lower:
        location_place = "COP30"
    for place in master_places:
        place_lower = place.lower()
        if not location_country and any(token in place_lower for token in ("finland", "brazil", "united kingdom", "uk", "usa")):
            location_country = place
        elif not location_city and any(token in place_lower for token in ("helsinki", "belem", "belém", "london")):
            location_city = place
        elif not location_place:
            location_place = place

    genre = ""
    genre_subtype = ""
    master_genres = collect_values_by_key(master_schema, {"genre", "genre_subtype", "form", "format"}, limit=8)
    if "trailer" in title_lower:
        genre = "trailer"
    if "james bond" in title_lower or "007" in title_lower:
        genre_subtype = "spy action"
    if not genre and master_genres:
        genre = master_genres[0]
    if not genre_subtype and len(master_genres) > 1:
        genre_subtype = master_genres[1]

    situational_genre = ""
    situational_subtype = ""
    situation_event = ""
    interaction_dynamics = ""
    narrative_development = ""
    if any(term in transcript_lower for term in ("where's 007", "double-o", "commander bond", "world is arming")):
        situation_event = "intelligence conflict"
        situational_genre = "conflict"
        situational_subtype = "mission briefing"
        interaction_dynamics = "Question-led exchanges and commands frame trust, secrecy, and threat."
        narrative_development = "The transcript introduces Bond, 007, secrecy, trust, and a wider armed threat."
    elif "climate" in transcript_lower or "cop30" in ocr_lower:
        situation_event = "climate summit report"
        situational_genre = "public issue report"
        situational_subtype = "climate reporting"
        narrative_development = "The transcript frames a climate-policy report around COP negotiations and public consequence."
    elif meaning_terms or scene_accounts:
        situation_event = clean_source_label((meaning_terms or scene_accounts)[0])
    if not interaction_dynamics and (interrogative_terms or sfl_terms):
        joined = ", ".join((interrogative_terms + sfl_terms)[:5])
        interaction_dynamics = f"POS/SFL evidence frames the interaction through {joined}."
    if not narrative_development and (meaning_terms or scene_accounts):
        joined = ", ".join((meaning_terms + scene_accounts)[:4])
        narrative_development = f"Plot and scene-card evidence foreground {joined}."
    performance_expression = ""
    if cinematic_terms:
        performance_expression = f"Cinematic clue evidence includes {', '.join(cinematic_terms[:5])}."
    boundary_ocr_context: List[str] = []
    for term in (
        (ocr_boundary_metadata.get("beginning_text") or [])[:4]
        + (ocr_boundary_metadata.get("ending_text") or [])[:4]
    ):
        append_unique_text(boundary_ocr_context, term, limit=8)

    description = ""
    if title or transcript_text:
        evidence_fragments: List[str] = []
        if title:
            evidence_fragments.append(f"Source filename identifies {title}.")
        if transcript_text:
            sample = " ".join(transcript_text.split()[:36])
            evidence_fragments.append(f"Transcript opening includes: {sample}.")
        if ocr_text:
            evidence_fragments.append(f"OCR includes: {'; '.join(ocr_text.split()[:16])}.")
        if ocr_boundary_metadata.get("beginning_text"):
            evidence_fragments.append(
                "Beginning OCR includes: "
                + "; ".join((ocr_boundary_metadata.get("beginning_text") or [])[:5])
                + "."
            )
        if ocr_boundary_metadata.get("ending_text"):
            evidence_fragments.append(
                "End-title OCR includes: "
                + "; ".join((ocr_boundary_metadata.get("ending_text") or [])[:5])
                + "."
            )
        if scene_accounts:
            evidence_fragments.append(f"Scene-card account: {scene_accounts[0]}")
        if meaning_terms:
            evidence_fragments.append(f"Plot/meaning cues include {', '.join(meaning_terms[:5])}.")
        if sfl_terms:
            evidence_fragments.append(f"SFL cues include {', '.join(sfl_terms[:5])}.")
        description = " ".join(evidence_fragments)

    annotations = {
        "title": title,
        "scope": "short clip" if safe_float(status.get("duration_seconds")) is None else "",
        "source_context": (
            "Beginning/end OCR is available as source metadata evidence: "
            + "; ".join(boundary_ocr_context)
            if boundary_ocr_context
            else ""
        ),
        "description": description,
        "persons": persons,
        "character_roles": character_roles,
        "character_definitions": character_definitions,
        "narrative_agent_profiles": narrative_agent_profiles,
        "location_country": location_country,
        "location_city": location_city,
        "location_place": location_place,
        "situation_event": situation_event,
        "keywords": keywords,
        "interaction_dynamics": interaction_dynamics,
        "narrative_development": narrative_development,
        "performance_expression": performance_expression,
        "genre": genre,
        "genre_subtype": genre_subtype,
        "situational_genre": situational_genre,
        "situational_subtype": situational_subtype,
        "confidence": "medium" if transcript_segments or tracked_objects or ocr_items else "",
    }
    annotations = {key: value for key, value in annotations.items() if annotation_has_value(value)}
    evidence_sources = []
    if title:
        evidence_sources.append("filename")
    if transcript_segments:
        evidence_sources.append("transcript")
    if tracked_objects:
        evidence_sources.append("tracked_objects")
    if ocr_items:
        evidence_sources.append("ocr")
    if ocr_boundary_metadata.get("beginning_text") or ocr_boundary_metadata.get("ending_text"):
        evidence_sources.append("beginning_end_title_ocr")
    if pos_analysis or pos_matrix:
        evidence_sources.append("pos_grammar_interrogatives_case")
    if sfl_stage:
        evidence_sources.append("dependency_sfl_stage1")
    if meaning_stage:
        evidence_sources.append("multimodal_meaning_stage1")
    if second_order:
        evidence_sources.append("second_order_label_proliferation")
    if cinematic_clues:
        evidence_sources.append("cinematic_clues")
    if scene_cards:
        evidence_sources.append("mise_en_scene_scene_cards")
    if master_schema:
        evidence_sources.append("master_schema")
    if character_roles:
        evidence_sources.append("web_metadata_character_roles")
    if narrative_agent_profiles:
        evidence_sources.append("narrative_agent_profile_seed")
    field_sources = {
        key: {
            "maturity": "derived_video_internal",
            "authority": "fills_empty_only",
            "evidence_sources": evidence_sources,
            "traceback": {
                "route": "source_media.video_internal_maturity_harvest",
                "raw_preserved": True,
                "consulted": evidence_sources,
            },
        }
        for key in annotations
    }
    if character_roles and "character_roles" in field_sources:
        field_sources["character_roles"] = {
            "maturity": "derived_external_metadata",
            "authority": "fills_empty_only",
            "evidence_sources": ["web_metadata_character_roles"],
            "traceback": {
                "route": "master_schema.source_media_character_role_maturity",
                "raw_preserved": True,
                "consulted": ["source_media_web_metadata_sources"],
            },
        }
    if character_definitions and "character_definitions" in field_sources:
        field_sources["character_definitions"] = {
            "maturity": "derived_external_metadata",
            "authority": "fills_empty_only",
            "evidence_sources": ["web_metadata_character_roles"],
            "traceback": {
                "route": "master_schema.source_media_character_definition_maturity",
                "raw_preserved": True,
                "consulted": ["source_media_web_metadata_sources"],
            },
        }
    if narrative_agent_profiles and "narrative_agent_profiles" in field_sources:
        field_sources["narrative_agent_profiles"] = {
            "maturity": "derived_external_metadata",
            "authority": "fills_empty_only",
            "evidence_sources": ["web_metadata_character_roles", "narrative_agent_profile_seed"],
            "traceback": {
                "route": "master_schema.source_media_narrative_agent_profile_maturity",
                "raw_preserved": True,
                "consulted": ["source_media_annotations.character_definitions", "source_media_web_metadata_sources"],
            },
        }

    return {
        "annotations": annotations,
        "field_sources": field_sources,
        "evidence_counts": {
            "transcript_segments": len(transcript_segments),
            "tracked_objects": len(tracked_objects),
            "ocr_items": len(ocr_items),
            "beginning_ocr_items": len(ocr_boundary_metadata.get("beginning_text") or []),
            "ending_ocr_items": len(ocr_boundary_metadata.get("ending_text") or []),
            "pos_terms": len(interrogative_terms) + len(case_terms),
            "sfl_terms": len(sfl_terms),
            "meaning_terms": len(meaning_terms),
            "cinematic_terms": len(cinematic_terms),
            "scene_card_accounts": len(scene_accounts),
            "master_terms": len(master_terms),
            "character_roles": len(character_roles),
            "character_definitions": len(character_definitions),
            "narrative_agent_profiles": len(narrative_agent_profiles),
        },
    }


def resolve_source_media_annotations(status: Dict[str, Any], stored_probe: Dict[str, Any]) -> Dict[str, Any]:
    manual_annotations = status.get("source_media_annotations") or stored_probe.get("user_annotations") or {}
    harvest = video_internal_source_media_harvest(status)
    derived_annotations = harvest.get("annotations") or {}
    resolved: Dict[str, Any] = {}
    field_maturity: Dict[str, Any] = {}
    annotation_keys = {
        "editor_notes",
        "source_context",
        "provenance_notes",
        "title",
        "scope",
        "description",
        "persons",
        "character_roles",
        "character_definitions",
        "narrative_agent_profiles",
        "relations",
        "location_country",
        "location_city",
        "location_place",
        "location_room",
        "time_era",
        "time_year",
        "time_moment",
        "situation_event",
        "keywords",
        "interaction_dynamics",
        "narrative_development",
        "performance_expression",
        "genre",
        "genre_subtype",
        "situational_genre",
        "situational_subtype",
        "privacy_axis",
        "expertise_axis",
        "references",
        "reference_speakers",
        "reference_relation",
        "reference_source",
        "confidence",
        "notes",
    }
    for key in annotation_keys:
        manual_value = manual_annotations.get(key)
        if annotation_has_value(manual_value):
            resolved[key] = manual_value
            field_maturity[key] = {
                "maturity": "manual",
                "authority": "manual_override",
                "evidence_sources": ["source_media_annotations"],
                "traceback": {
                    "route": "source_media.manual_metadata_governance",
                    "raw_preserved": True,
                    "consulted": ["source_media_annotations"],
                },
            }
            continue
        derived_value = derived_annotations.get(key)
        if annotation_has_value(derived_value):
            resolved[key] = derived_value
            field_maturity[key] = (harvest.get("field_sources") or {}).get(key, {})
    status["source_media_video_internal_harvest"] = harvest
    status["source_media_annotation_maturity"] = field_maturity
    return resolved


def build_source_media_maturity_iteration(status: Dict[str, Any]) -> Dict[str, Any]:
    manual_annotations = status.get("source_media_annotations") if isinstance(status.get("source_media_annotations"), dict) else {}
    harvest = status.get("source_media_video_internal_harvest") if isinstance(status.get("source_media_video_internal_harvest"), dict) else {}
    derived_annotations = harvest.get("annotations") if isinstance(harvest.get("annotations"), dict) else {}
    field_sources = harvest.get("field_sources") if isinstance(harvest.get("field_sources"), dict) else {}
    maturity = status.get("source_media_annotation_maturity") if isinstance(status.get("source_media_annotation_maturity"), dict) else {}

    filled_from_maturity: List[Dict[str, Any]] = []
    manual_protected_fields: List[str] = []
    review_candidates: List[Dict[str, Any]] = []
    for key, source in sorted(field_sources.items()):
        derived_value = derived_annotations.get(key)
        manual_value = manual_annotations.get(key)
        route = (source.get("traceback") or {}).get("route") or "source_media.video_internal_maturity_harvest"
        entry = {
            "field": key,
            "maturity": source.get("maturity") or "derived_video_internal",
            "route": route,
            "evidence_sources": source.get("evidence_sources") or [],
        }
        if annotation_has_value(manual_value):
            manual_protected_fields.append(key)
            if annotation_has_value(derived_value) and clean_source_label(manual_value) != clean_source_label(derived_value):
                review_candidates.append({**entry, "status": "manual_field_protected"})
            continue
        if annotation_has_value(derived_value):
            filled_from_maturity.append(entry)

    iteration = {
        "iteration_id": f"source-media-maturity-{utc_now_iso()}",
        "updated_at": utc_now_iso(),
        "process": [
            "harvest_available_source_evidence",
            "protect_manual_fields",
            "fill_empty_governed_fields",
            "surface_review_candidates",
            "route_mature_fields_to_master_schema",
        ],
        "filled_from_maturity": filled_from_maturity,
        "manual_protected_fields": manual_protected_fields,
        "review_candidates": review_candidates,
        "evidence_counts": harvest.get("evidence_counts") or {},
        "field_count": len(maturity),
        "filled_count": len(filled_from_maturity),
        "manual_protected_count": len(manual_protected_fields),
        "review_candidate_count": len(review_candidates),
    }
    status["source_media_maturity_iteration"] = iteration
    return iteration


def build_source_media_metadata_payload(
    status: Dict[str, Any],
    *,
    media_probe: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    source_video_path = (
        status.get("source_video_path")
        or status.get("file_path")
        or output_files.get("source_video")
    )
    path_obj = Path(source_video_path) if source_video_path else None
    stored_probe = status.get("source_media_metadata") if isinstance(status.get("source_media_metadata"), dict) else {}
    file_probe = probe_source_media_file(path_obj) if path_obj else {}
    probe = {
        **stored_probe,
        **file_probe,
        **(media_probe or {}),
    }
    user_annotations = resolve_source_media_annotations(status, stored_probe)
    maturity_iteration = build_source_media_maturity_iteration(status)

    payload = {
        "analysis_id": status.get("analysis_id"),
        "original_filename": status.get("original_filename") or probe.get("original_filename"),
        "stored_filename": status.get("filename") or probe.get("stored_filename") or (path_obj.name if path_obj else None),
        "source_video_path": source_video_path,
        "source_video_exists": bool(path_obj and path_obj.exists()),
        "mime_type": first_present(probe, "mime_type", "content_type"),
        "format_name": first_present(probe, "format_name", "format"),
        "container_extension": first_present(probe, "container_extension", "extension") or (path_obj.suffix.lower() if path_obj else None),
        "duration_seconds": first_present(probe, "duration_seconds", "duration"),
        "size_bytes": first_present(probe, "size_bytes", "size"),
        "video_codec": first_present(probe, "video_codec", "vcodec"),
        "audio_codec": first_present(probe, "audio_codec", "acodec"),
        "has_audio": first_present(probe, "has_audio"),
        "width": first_present(probe, "width"),
        "height": first_present(probe, "height"),
        "fps": first_present(probe, "fps", "frame_rate"),
        "video_bitrate": first_present(probe, "video_bitrate", "bit_rate"),
        "audio_bitrate": first_present(probe, "audio_bitrate"),
        "audio_channels": first_present(probe, "audio_channels", "channels"),
        "audio_sample_rate": first_present(probe, "audio_sample_rate", "sample_rate"),
        "recorded_at": first_present(probe, "recorded_at"),
        "gps_coordinates": first_present(probe, "gps_coordinates"),
        "camera_make": first_present(probe, "camera_make"),
        "camera_model": first_present(probe, "camera_model"),
        "recording_device": first_present(probe, "recording_device"),
        "recording_software": first_present(probe, "recording_software"),
        "filmed_by": first_present(probe, "filmed_by"),
        "embedded_metadata": probe.get("embedded_metadata") if isinstance(probe.get("embedded_metadata"), dict) else {},
        "uploaded_at": status.get("uploaded_at"),
        "analysis_started_at": status.get("analysis_started_at"),
        "analysis_completed_at": status.get("analysis_completed_at"),
        "pipeline_type": status.get("pipeline_type", "full"),
        "cvatID": status.get("cvatID"),
        "user_annotations": {
            "editor_notes": user_annotations.get("editor_notes", ""),
            "source_context": user_annotations.get("source_context", ""),
            "provenance_notes": user_annotations.get("provenance_notes", ""),
            "title": user_annotations.get("title", ""),
            "scope": user_annotations.get("scope", ""),
            "description": user_annotations.get("description", ""),
            "persons": user_annotations.get("persons", []),
            "character_roles": user_annotations.get("character_roles", []),
            "character_definitions": user_annotations.get("character_definitions", []),
            "narrative_agent_profiles": user_annotations.get("narrative_agent_profiles", []),
            "relations": user_annotations.get("relations", ""),
            "location_country": user_annotations.get("location_country", ""),
            "location_city": user_annotations.get("location_city", ""),
            "location_place": user_annotations.get("location_place", ""),
            "location_room": user_annotations.get("location_room", ""),
            "time_era": user_annotations.get("time_era", ""),
            "time_year": user_annotations.get("time_year", ""),
            "time_moment": user_annotations.get("time_moment", ""),
            "situation_event": user_annotations.get("situation_event", ""),
            "keywords": user_annotations.get("keywords", []),
            "interaction_dynamics": user_annotations.get("interaction_dynamics", ""),
            "narrative_development": user_annotations.get("narrative_development", ""),
            "performance_expression": user_annotations.get("performance_expression", ""),
            "genre": user_annotations.get("genre", ""),
            "genre_subtype": user_annotations.get("genre_subtype", ""),
            "situational_genre": user_annotations.get("situational_genre", ""),
            "situational_subtype": user_annotations.get("situational_subtype", ""),
            "privacy_axis": user_annotations.get("privacy_axis", ""),
            "expertise_axis": user_annotations.get("expertise_axis", ""),
            "references": user_annotations.get("references", []),
            "reference_files": status.get("source_media_reference_files", []),
            "web_metadata_sources": status.get("source_media_web_metadata_sources", []),
            "reference_speakers": user_annotations.get("reference_speakers", []),
            "reference_relation": user_annotations.get("reference_relation", ""),
            "reference_source": user_annotations.get("reference_source", ""),
            "expected_identities": user_annotations.get("expected_identities", []),
            "confidence": user_annotations.get("confidence", ""),
            "notes": user_annotations.get("notes", ""),
            "source_policy": user_annotations.get("source_policy", {}),
        },
        "annotation_maturity": status.get("source_media_annotation_maturity", {}),
        "video_internal_harvest": status.get("source_media_video_internal_harvest", {}),
        "maturity_iteration": maturity_iteration,
    }

    if path_obj and path_obj.exists():
        try:
            stat = path_obj.stat()
            payload["filesystem_modified_at"] = datetime.fromtimestamp(
                stat.st_mtime, timezone.utc
            ).isoformat()
        except Exception:
            pass

    return payload


def write_source_media_metadata_files(status: Dict[str, Any]) -> None:
    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return

    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)
    metadata_payload = build_source_media_metadata_payload(status)
    status["source_media_metadata"] = metadata_payload

    json_path = analysis_dir / "source_media_metadata.json"
    json_path.write_text(
        json.dumps(metadata_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    csv_path = analysis_dir / "source_media_metadata.csv"
    flat_payload = dict(metadata_payload)
    flat_payload["user_annotations"] = json.dumps(
        metadata_payload.get("user_annotations", {}),
        ensure_ascii=False,
    )
    fieldnames = list(flat_payload.keys())
    csv_buffer = io.StringIO()
    writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerow(flat_payload)
    csv_path.write_text(csv_buffer.getvalue(), encoding="utf-8")

    output_files = status.setdefault("output_files", {})
    output_files["source_media_metadata_json"] = str(json_path)
    output_files["source_media_metadata_csv"] = str(csv_path)
    refresher = globals().get("refresh_master_schema_metadata_surfaces")
    if callable(refresher):
        try:
            refresher(status)
        except Exception as exc:
            status.setdefault("summary", {})["master_schema_metadata_refresh_error"] = str(exc)


def build_annotation_corrections_payload(status: Dict[str, Any]) -> Dict[str, Any]:
    corrections = status.get("annotation_corrections") or {}
    return {
        "analysis_id": status.get("analysis_id"),
        "version": corrections.get("version", 1),
        "updated_at": corrections.get("updated_at"),
        "updated_by": corrections.get("updated_by", "analyst"),
        "text_substitutions": corrections.get("text_substitutions", []),
        "label_overrides": corrections.get("label_overrides", []),
        "manual_transcript_entries": corrections.get("manual_transcript_entries", []),
        "manual_visual_annotations": corrections.get("manual_visual_annotations", []),
        "proliferation_decisions": corrections.get("proliferation_decisions", []),
        "master_schema_presence_intervals": corrections.get(
            "master_schema_presence_intervals", []
        ),
        "meaning_network_custom_lanes": corrections.get(
            "meaning_network_custom_lanes", []
        ),
        "transcript_clock_offset_seconds": corrections.get(
            "transcript_clock_offset_seconds"
        ),
    }


def tracked_objects_for_projection(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Load tracked observations for the read-only compatibility projector."""
    visual = ((status.get("results") or {}).get("visual_analysis") or {})
    inline = visual.get("tracked_objects")
    if isinstance(inline, list):
        return [item for item in inline if isinstance(item, dict)]

    raw_path = (status.get("output_files") or {}).get("tracked_objects_json")
    if raw_path:
        try:
            payload = json.loads(Path(str(raw_path)).read_text(encoding="utf-8"))
            if isinstance(payload, list):
                return [item for item in payload if isinstance(item, dict)]
            if isinstance(payload, dict):
                items = payload.get("tracked_objects") or payload.get("items") or []
                return [item for item in items if isinstance(item, dict)]
        except (OSError, ValueError, TypeError):
            return []
    return []


def decision_ledger_for_status(status: Dict[str, Any]) -> Dict[str, Any]:
    analysis_id = str(status.get("analysis_id") or "")
    inline = status.get("canonical_decision_ledger")
    if isinstance(inline, dict):
        ledger = inline
    else:
        ledger = None
    path_value = (status.get("output_files") or {}).get("decision_ledger")
    if ledger is None and path_value:
        try:
            payload = json.loads(Path(str(path_value)).read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                status["canonical_decision_ledger"] = payload
                ledger = payload
        except (OSError, ValueError, TypeError):
            pass
    if ledger is None:
        ledger = empty_decision_ledger(analysis_id)
    status["canonical_decision_ledger"] = ledger

    corrections = status.get("annotation_corrections")
    if isinstance(corrections, dict) and any(
        corrections.get(collection)
        for collection in ("manual_visual_annotations", "label_overrides", "proliferation_decisions")
    ):
        created_at = str(corrections.get("updated_at") or utc_now_iso())
        created_by = str(corrections.get("updated_by") or "analyst")
        ledger, backfilled = sync_corrections_to_ledger(
            ledger,
            {},
            corrections,
            analysis_id=analysis_id,
            created_at=created_at,
            created_by=created_by,
        )
        status["canonical_decision_ledger"] = ledger
        if backfilled:
            analysis_dir = RESULTS_DIR / analysis_id
            analysis_dir.mkdir(parents=True, exist_ok=True)
            path = analysis_dir / "decision_ledger.json"
            path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False), encoding="utf-8")
            status.setdefault("output_files", {})["decision_ledger"] = str(path)
            append_analysis_event(
                status,
                "canonical_ledger_backfilled",
                details={
                    "event_count": len(backfilled),
                    "decision_refs": [event["decision_id"] for event in backfilled],
                },
            )
            persist_analysis_record_for_status(status)
    return ledger


def write_decision_ledger_file(status: Dict[str, Any]) -> Path:
    analysis_id = str(status.get("analysis_id") or "")
    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)
    path = analysis_dir / "decision_ledger.json"
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(decision_ledger_for_status(status), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    temporary.replace(path)
    status.setdefault("output_files", {})["decision_ledger"] = str(path)
    return path


def write_annotation_corrections_file(status: Dict[str, Any]) -> None:
    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return

    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)
    payload = build_annotation_corrections_payload(status)
    json_path = analysis_dir / "annotation_corrections.json"
    json_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    output_files = status.setdefault("output_files", {})
    output_files["annotation_corrections"] = str(json_path)
    refresher = globals().get("refresh_master_schema_metadata_surfaces")
    if callable(refresher):
        try:
            refresher(status)
        except Exception as exc:
            status.setdefault("summary", {})["master_schema_annotation_refresh_error"] = str(exc)


def collect_manual_identity_annotations(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    master = status.get("vaa1_annotation_master_schema") or {}
    for collection_name in [
        "manual_visual_annotations",
        "object_annotations",
        "track_annotations",
    ]:
        for item in master.get(collection_name, []) or []:
            if isinstance(item, dict) and (
                item.get("identity_affirmation")
                or (item.get("attributes") or {}).get("identity_label")
            ):
                items.append(item)

    corrections = build_annotation_corrections_payload(status)
    for item in corrections.get("manual_visual_annotations", []) or []:
        if isinstance(item, dict) and item.get("identity_affirmation"):
            items.append(item)
    return items


def write_identity_triangulation_artifact_for_status(
    status: Dict[str, Any],
    *,
    reviewed_by: str = "system",
) -> Optional[Dict[str, Any]]:
    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return None

    results = status.get("results") or {}
    visual = results.get("visual_analysis") or {}
    audio = results.get("audio_analysis") or {}
    output_path = RESULTS_DIR / analysis_id / "identity_triangulation_bundle.json"
    payload = write_identity_triangulation_bundle(
        analysis_id,
        output_path,
        source_media_metadata=status.get("source_media_metadata")
        or build_source_media_metadata_payload(status),
        visual_sample_clouds=visual.get("visual_sample_clouds"),
        audio_sample_clouds=audio.get("audio_sample_clouds"),
        manual_annotations=collect_manual_identity_annotations(status),
        reviewed_by=reviewed_by,
    )
    status.setdefault("internal_artifacts", {})["identity_triangulation_bundle"] = str(
        output_path
    )
    status.setdefault("output_files", {})["identity_triangulation"] = str(output_path)
    status["identity_triangulation"] = {
        "status": payload.get("status"),
        "identity_count": payload.get("identity_count", 0),
        "proliferation_ready_count": payload.get("proliferation_ready_count", 0),
        "output_json_path": str(output_path),
        "updated_at": utc_now_iso(),
    }
    return payload


def read_json_artifact_if_available(path_value: Any) -> Optional[Dict[str, Any]]:
    if not path_value:
        return None
    path = Path(str(path_value))
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def transcript_payload_has_timing_authority(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False
    if transcript_timing_looks_scaffolded(payload):
        return False
    timing_authority = payload.get("timing_authority")
    if isinstance(timing_authority, dict):
        operational_authority = str(timing_authority.get("operational_authority") or "")
        if operational_authority in {
            "original_whisper_timecode",
            "manual_correction",
            "manual_correction_for_verified_rows",
        }:
            return True
    if payload.get("transcription_strategy") in {
        "full_pass",
        "original_whisper_timecode",
    }:
        return True
    timing_repair = payload.get("timing_repair")
    if isinstance(timing_repair, dict) and timing_repair.get("strategy") in {
        "original_whisper_timecode",
        "manual_correction",
    }:
        return True
    segments = payload.get("segments") or []
    if not isinstance(segments, list):
        return False
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        if segment.get("timing_authority") in {
            "manual_correction",
            "original_whisper_timecode",
            "full_pass",
        }:
            return True
        if segment.get("timing_status") in {
            "manual_correction",
            "original_whisper_timecode",
        }:
            return True
    return False


def transcript_artifact_has_timing_authority(path_value: Any) -> bool:
    return transcript_payload_has_timing_authority(
        read_json_artifact_if_available(path_value)
    )


def prefer_authoritative_transcript_artifact(status: Dict[str, Any]) -> bool:
    """Prefer the preserved Whisper/manual clock artifact over candidates."""
    analysis_id = str(status.get("analysis_id") or "").strip()
    if not analysis_id:
        return False

    output_files = status.setdefault("output_files", {})
    current_transcript = output_files.get("transcript")

    candidates: List[Any] = []
    record = read_json_artifact_if_available(get_analysis_record_path(analysis_id))
    if isinstance(record, dict):
        record_output_files = record.get("output_files") or {}
        if isinstance(record_output_files, dict):
            candidates.append(record_output_files.get("raw_whisper_transcript"))
            candidates.append(record_output_files.get("operational_transcript"))
            candidates.append(record_output_files.get("transcript"))
        record_transcript = (
            (record.get("results") or {})
            .get("audio_analysis", {})
            .get("transcript")
        )
        if transcript_payload_has_timing_authority(record_transcript):
            status.setdefault("results", {}).setdefault("audio_analysis", {})[
                "transcript"
            ] = record_transcript

    audio_analysis = status.setdefault("results", {}).setdefault("audio_analysis", {})
    embedded_transcript = audio_analysis.get("transcript")
    if transcript_payload_has_timing_authority(embedded_transcript):
        embedded_path = embedded_transcript.get("output_path") or embedded_transcript.get(
            "path"
        )
        if embedded_path:
            candidates.insert(0, embedded_path)

    original_filename = str(status.get("original_filename") or "")
    source_video_path = status.get("source_video_path")
    if source_video_path:
        source_dir = Path(str(source_video_path)).parent
        source_stem = Path(str(source_video_path)).stem.replace("_source_video", "")
        candidates.append(source_dir / f"{source_stem}_transcript.json")
    if current_transcript:
        candidates.append(current_transcript)
        current_path = Path(str(current_transcript))
        candidates.append(
            current_path.with_name(
                current_path.name.replace("_transcript", "_transcript_raw_whisper")
            )
        )
        candidates.append(
            current_path.with_name(
                current_path.name.replace("_extracted_audio_transcript", "_transcript")
            )
        )
    if original_filename:
        imported_root = Path(str(current_transcript)).parent if current_transcript else None
        if imported_root:
            candidates.append(imported_root / f"{Path(original_filename).stem}_transcript.json")

    for candidate in candidates:
        if not candidate:
            continue
        candidate_path = Path(str(candidate))
        if not candidate_path.exists():
            continue
        candidate_payload = read_json_artifact_if_available(candidate_path)
        if not transcript_payload_has_timing_authority(candidate_payload):
            continue
        if str(candidate_path) == str(current_transcript):
            return False
        output_files["transcript"] = str(candidate_path)
        if candidate_payload.get("transcription_strategy") == "original_whisper_timecode":
            output_files.setdefault("raw_whisper_transcript", str(candidate_path))
        audio_analysis["transcript"] = candidate_payload
        status["output_files"] = output_files
        status["transcript_timing_repair"] = candidate_payload.get(
            "timing_repair",
            status.get("transcript_timing_repair")
            or {
                "status": "repaired",
                "reason": "authoritative_transcript_artifact_selected",
            },
        )
        return True
    return False


def output_file_exists(status: Dict[str, Any], file_type: str) -> bool:
    path_value = (status.get("output_files") or {}).get(file_type)
    return bool(path_value and Path(str(path_value)).exists())


def find_sibling_artifact(path_value: Any, suffix: str) -> Optional[str]:
    if not path_value:
        return None
    path = Path(str(path_value))
    parent = path.parent
    if not parent.exists():
        return None
    if path.name.endswith(suffix) and path.exists():
        return str(path)
    matches = sorted(parent.glob(f"*{suffix}"))
    return str(matches[0]) if matches else None


def find_plain_transcript_sibling(path_value: Any) -> Optional[str]:
    if not path_value:
        return None
    parent = Path(str(path_value)).parent
    if not parent.exists():
        return None
    matches = [
        path
        for path in sorted(parent.glob("*transcript.json"))
        if not path.name.endswith("linked_transcript.json")
    ]
    return str(matches[0]) if matches else None


def normalize_imported_output_files_for_status(status: Dict[str, Any]) -> bool:
    """Repair channel registrations that older imported bundles could misclassify."""

    output_files = status.setdefault("output_files", {})
    changed = False

    transcript_path = output_files.get("transcript")
    if transcript_path and Path(str(transcript_path)).name.endswith("linked_transcript.json"):
        output_files.setdefault("linked_transcript", str(transcript_path))
        real_transcript = find_plain_transcript_sibling(transcript_path)
        if real_transcript:
            output_files["transcript"] = real_transcript
        else:
            output_files.pop("transcript", None)
        changed = True

    for file_type, suffix in (
        ("linked_transcript", "linked_transcript.json"),
        ("transcript", "transcript.json"),
        ("tracked_objects_csv", "tracked_objects.csv"),
        ("tracked_objects_json", "tracked_objects.json"),
        ("dependency_sfl_stage1", "dependency_sfl_stage1.json"),
        ("multimodal_meaning_stage1", "multimodal_meaning_stage1.json"),
        ("agent_persistence_scene_cut", "agent_persistence_scene_cut.json"),
        ("second_order_label_proliferation", "second_order_label_proliferation.json"),
        ("narrative_lens_reading", "narrative_lens_reading.json"),
        ("character_path_reading", "character_path_reading.json"),
        ("datascene_meaning_network", "datascene_meaning_network.json"),
    ):
        if output_file_exists(status, file_type):
            continue
        anchor = (
            output_files.get("source_video")
            or output_files.get("summary_json")
            or output_files.get("transcript")
            or output_files.get("linked_transcript")
        )
        sibling = (
            find_plain_transcript_sibling(anchor)
            if file_type == "transcript"
            else find_sibling_artifact(anchor, suffix)
        )
        if sibling:
            output_files[file_type] = sibling
            changed = True

    status["output_files"] = output_files
    return changed


def write_tracked_objects_fallback_from_yolo_if_needed(status: Dict[str, Any]) -> bool:
    """Create explicit untracked-object artifacts when YOLO detections exist but tracking files do not."""

    if output_file_exists(status, "tracked_objects_csv") and output_file_exists(
        status, "tracked_objects_json"
    ):
        return False

    output_files = status.setdefault("output_files", {})
    yolo_path_raw = output_files.get("yolo_csv")
    if not yolo_path_raw:
        return False
    yolo_path = Path(str(yolo_path_raw))
    if not yolo_path.exists():
        return False

    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return False
    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)
    tracked_csv_path = analysis_dir / "tracked_objects.csv"
    tracked_json_path = analysis_dir / "tracked_objects.json"

    rows: List[Dict[str, Any]] = []
    try:
        with yolo_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for index, row in enumerate(reader, start=1):
                row = dict(row)
                timestamp = row.get("timestamp") or row.get("time") or row.get("start")
                class_name = row.get("class_name") or row.get("label") or "object"
                row.update(
                    {
                        "start_timestamp": timestamp,
                        "end_timestamp": timestamp,
                        "occurrence_count": "1",
                        "track_id": f"untracked_{index:05d}",
                        "display_label": f"{class_name} untracked {index}",
                        "tracking_status": "not_tracked_yolo_detection_fallback",
                    }
                )
                rows.append(row)
    except Exception as exc:
        logger.warning("Tracked-object fallback failed for %s: %s", yolo_path, exc)
        return False

    if not rows:
        return False

    fieldnames: List[str] = []
    for row in rows:
        for key in row.keys():
            if key not in fieldnames:
                fieldnames.append(key)

    with tracked_csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    tracked_json_path.write_text(
        json.dumps(rows, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    output_files["tracked_objects_csv"] = str(tracked_csv_path)
    output_files["tracked_objects_json"] = str(tracked_json_path)
    status["output_files"] = output_files
    return True


def write_iterative_audio_identity_artifacts_for_status(
    status: Dict[str, Any],
) -> List[str]:
    """Backfill measured audio and derived identity artifacts from saved media."""

    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return []

    output_files = status.setdefault("output_files", {})
    results = status.setdefault("results", {})
    audio_analysis = results.setdefault("audio_analysis", {})
    created: List[str] = []

    transcript = audio_analysis.get("transcript") or read_json_artifact_if_available(
        output_files.get("transcript")
    )
    audio_prosody = audio_analysis.get("audio_prosody") or read_json_artifact_if_available(
        output_files.get("audio_prosody")
    )
    audio_path = output_files.get("audio") or audio_analysis.get("audio_path")
    if audio_path:
        audio_analysis.setdefault("audio_path", str(audio_path))

    audio_diarization = audio_analysis.get("audio_diarization")
    persisted_audio_diarization = read_json_artifact_if_available(
        output_files.get("audio_diarization")
    )
    current_audio_diarization = audio_diarization or persisted_audio_diarization or {}
    diarization_clock_health = audio_diarization_staleness(
        current_audio_diarization,
        transcript if isinstance(transcript, dict) else {},
        audio_path,
    )
    if current_audio_diarization and diarization_clock_health.get("is_stale"):
        current_audio_diarization["is_stale"] = True
        current_audio_diarization["stale_reason"] = diarization_clock_health.get("stale_reason")
        for turn in current_audio_diarization.get("speaker_turns") or []:
            if isinstance(turn, dict):
                turn["is_stale"] = True
                turn["stale_reason"] = diarization_clock_health.get("stale_reason")
                turn["valid_for_confirmation"] = False
                turn["valid_for_mature_master_schema"] = False
        audio_analysis["audio_diarization"] = current_audio_diarization
    needs_measured_diarization = (
        current_audio_diarization.get("status") != "completed_measured"
        or not output_file_exists(status, "audio_diarization")
        or bool(diarization_clock_health.get("is_stale"))
    )
    if needs_measured_diarization and transcript and audio_path:
        diarization_path = (
            TRANSCRIPTS_DIR / f"{analysis_id}_audio_diarization.json"
        )
        audio_diarization = write_audio_diarization(
            analysis_id,
            audio_path=audio_path,
            output_json_path=diarization_path,
            transcript=transcript,
            audio_prosody=audio_prosody,
            reference_speakers=(status.get("source_media_metadata") or {}).get("user_annotations", {}).get("reference_speakers"),
        )
        audio_analysis["audio_diarization"] = audio_diarization
        audio_analysis["audio_diarization_path"] = str(diarization_path)
        output_files["audio_diarization"] = str(diarization_path)
        created.append("audio_diarization")
    elif not audio_diarization and persisted_audio_diarization:
        audio_diarization = persisted_audio_diarization
        audio_analysis["audio_diarization"] = audio_diarization

    audio_sample_clouds = audio_analysis.get("audio_sample_clouds")
    existing_audio_sample_clouds = audio_sample_clouds or read_json_artifact_if_available(
        output_files.get("audio_sample_clouds")
    )
    existing_sample_count = int(
        (existing_audio_sample_clouds or {}).get("sample_count")
        or sum(
            int((cloud.get("cloud_summary") or {}).get("sample_count") or 0)
            for cloud in (existing_audio_sample_clouds or {}).get("clouds") or []
            if isinstance(cloud, dict)
        )
        or 0
    )
    current_diarization_fingerprint = (audio_diarization or {}).get("diarization_fingerprint")
    existing_cloud_fingerprint = (existing_audio_sample_clouds or {}).get("diarization_fingerprint")
    if not existing_cloud_fingerprint:
        fingerprints = (existing_audio_sample_clouds or {}).get("diarization_fingerprints") or []
        existing_cloud_fingerprint = fingerprints[0] if len(fingerprints) == 1 else None
    existing_clouds_stale = bool((existing_audio_sample_clouds or {}).get("is_stale"))
    sample_clock_mismatch = bool(
        current_diarization_fingerprint
        and existing_cloud_fingerprint
        and existing_cloud_fingerprint != current_diarization_fingerprint
    )
    should_rebuild_audio_samples = (
        not output_file_exists(status, "audio_sample_clouds")
        or existing_sample_count == 0
        or "audio_diarization" in created
        or existing_clouds_stale
        or sample_clock_mismatch
        or (current_diarization_fingerprint and not existing_cloud_fingerprint)
        or (
            audio_diarization
            and audio_diarization.get("status") == "completed_measured"
            and (existing_audio_sample_clouds or {}).get("audio_diarization_status")
            != "completed_measured"
        )
    )
    if should_rebuild_audio_samples and (audio_diarization or transcript):
        sample_cloud_path = TRANSCRIPTS_DIR / f"{analysis_id}_audio_sample_clouds.json"
        source_media_context = build_source_media_metadata_payload(status)
        diarization_clouds = (
            build_audio_sample_clouds_from_diarization(
                analysis_id,
                audio_diarization=audio_diarization,
                source_media_context=source_media_context,
                source_audio_path=audio_path,
            )
            if audio_diarization
            and audio_diarization.get("status") == "completed_measured"
            else None
        )
        narrative_agent_clouds = (
            build_audio_sample_clouds_for_narrative_agents(
                analysis_id,
                transcript=transcript,
                audio_prosody=audio_prosody,
                source_media_context=source_media_context,
                source_audio_path=audio_path,
            )
            if audio_diarization
            and audio_diarization.get("status") == "completed_measured"
            else None
        )
        audio_sample_clouds = merge_audio_sample_cloud_payloads(
            analysis_id,
            diarization_clouds,
            narrative_agent_clouds,
        )
        audio_sample_clouds["audio_diarization_status"] = (
            (audio_diarization or {}).get("status")
        )
        audio_sample_clouds["audio_measurement_provider"] = (
            (audio_diarization or {}).get("provider")
        )
        audio_sample_clouds["timing_contract"] = (audio_diarization or {}).get("timing_contract")
        audio_sample_clouds["transcript_fingerprint"] = (audio_diarization or {}).get("transcript_fingerprint")
        audio_sample_clouds["audio_fingerprint"] = (audio_diarization or {}).get("audio_fingerprint")
        audio_sample_clouds["diarization_fingerprint"] = (audio_diarization or {}).get("diarization_fingerprint")
        audio_sample_clouds["generated_from_artifact_id"] = f"{analysis_id}:audio_diarization"
        audio_sample_clouds["is_stale"] = bool((audio_diarization or {}).get("is_stale"))
        audio_sample_clouds["stale_reason"] = (audio_diarization or {}).get("stale_reason")
        sample_cloud_path.parent.mkdir(parents=True, exist_ok=True)
        sample_cloud_path.write_text(
            json.dumps(audio_sample_clouds, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        audio_analysis["audio_sample_clouds"] = audio_sample_clouds
        audio_analysis["audio_sample_clouds_path"] = str(sample_cloud_path)
        output_files["audio_sample_clouds"] = str(sample_cloud_path)
        created.append("audio_sample_clouds")
    elif not audio_sample_clouds:
        audio_sample_clouds = existing_audio_sample_clouds
        if audio_sample_clouds:
            audio_analysis["audio_sample_clouds"] = audio_sample_clouds

    identity_triage_existing = read_json_artifact_if_available(output_files.get("identity_triangulation"))
    identity_triage_needs_rebuild = bool(created and "audio_sample_clouds" in created)
    if (
        not output_file_exists(status, "identity_triangulation")
        or identity_triage_needs_rebuild
        or not identity_triage_existing
    ):
        triangulation_bundle = write_identity_triangulation_artifact_for_status(status)
        if triangulation_bundle:
            created.append("identity_triangulation")

    return created


def write_iterative_matrix_artifacts_for_status(status: Dict[str, Any]) -> List[str]:
    """Create download-ready matrix snapshots from existing POS/Quant analyses."""

    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return []

    created: List[str] = []
    output_files = status.setdefault("output_files", {})
    results = status.get("results") or {}
    audio_analysis = results.get("audio_analysis") or {}
    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)

    for file_type, source_key, matrix_type in (
        ("pos_matrix", "pos_analysis", "pos"),
        ("quant_matrix", "quan_analysis", "quant"),
    ):
        if output_file_exists(status, file_type):
            continue
        source_payload = audio_analysis.get(source_key) or read_json_artifact_if_available(
            output_files.get(source_key)
        )
        if not source_payload:
            continue
        matrix_path = analysis_dir / f"{matrix_type}_matrix.json"
        snapshot = {
            "matrix_type": matrix_type,
            "snapshot_kind": "automatic_analysis_snapshot",
            "saved_at": utc_now_iso(),
            "owner_analysis_id": analysis_id,
            "source_file_type": source_key,
            "selected_sections": ["analysis"],
            "analyses": [
                {
                    "analysis_id": analysis_id,
                    "source": source_key,
                    "payload": source_payload,
                }
            ],
        }
        matrix_path.write_text(
            json.dumps(snapshot, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        output_files[file_type] = str(matrix_path)
        created.append(file_type)

    return created


def write_iterative_derived_artifacts_for_status(status: Dict[str, Any]) -> List[str]:
    created = []
    if normalize_imported_output_files_for_status(status):
        created.append("output_file_registration_repaired")
    if write_tracked_objects_fallback_from_yolo_if_needed(status):
        created.extend(["tracked_objects_csv", "tracked_objects_json"])
    created.extend(write_iterative_audio_identity_artifacts_for_status(status))
    created.extend(write_iterative_matrix_artifacts_for_status(status))
    return created


def value_to_ms(value: Any, default: int = 0) -> int:
    number = safe_float(value)
    if number is None:
        return default
    if 0 < number < 10_000:
        return int(round(number * 1000))
    return int(round(number))


def build_meaning_genre_profile(source_metadata: Dict[str, Any]) -> Dict[str, Any]:
    annotations = source_metadata.get("user_annotations") or {}
    return {
        "genre": annotations.get("genre", ""),
        "genre_subtype": annotations.get("genre_subtype", ""),
        "situational_genre": annotations.get("situational_genre", ""),
        "situational_subtype": annotations.get("situational_subtype", ""),
        "narrative_development": annotations.get("narrative_development", ""),
        "performance_expression": annotations.get("performance_expression", ""),
    }


def build_meaning_culture_context(status: Dict[str, Any]) -> Dict[str, Any]:
    source_metadata = status.get("source_media_metadata") or {}
    annotations = source_metadata.get("user_annotations") or {}
    return {
        "annotation_culture": "vaa1_default_open_weight_policy",
        "analysis_tier": status.get("analysis_tier", "science_scan"),
        "modality_focus": status.get("modality_focus", "multimodal"),
        "privacy_axis": annotations.get("privacy_axis", ""),
        "expertise_axis": annotations.get("expertise_axis", ""),
        "linearity_policy": {
            "does_not_assume_linear_story_world": True,
            "episode_links_may_cross_chronological_order": True,
        },
    }


def iter_detection_items(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        for key in ("detections", "items", "objects", "results"):
            nested = value.get(key)
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
    return []


def build_visual_cues_for_meaning(visual: Dict[str, Any]) -> List[Dict[str, Any]]:
    cues: List[Dict[str, Any]] = []
    for index, item in enumerate(iter_detection_items(visual.get("ocr_results"))[:80]):
        text = item.get("text") or item.get("label") or item.get("ocr_text")
        if not text:
            continue
        start_ms = value_to_ms(
            item.get("timestamp", item.get("time", item.get("start", item.get("start_ms"))))
        )
        end_ms = value_to_ms(
            item.get("end", item.get("end_ms")),
            default=start_ms + 1000,
        )
        cues.append(
            {
                "evidence_id": item.get("evidence_id") or f"ocr:{index}",
                "cue_type": "object_mentioned",
                "object_id": f"visible_text:{index}",
                "significance_stage": "visible_text_reference",
                "score": item.get("confidence", 0.45),
                "start_ms": start_ms,
                "end_ms": max(end_ms, start_ms),
                "text": text,
            }
        )

    for index, item in enumerate(iter_detection_items(visual.get("tracked_objects"))[:120]):
        label = str(
            item.get("class")
            or item.get("class_name")
            or item.get("label")
            or item.get("object_class")
            or ""
        ).strip()
        if not label:
            continue
        confidence = safe_float(item.get("confidence"), 0.0) or 0.0
        if confidence < 0.65 and label.lower() != "person":
            continue
        start_ms = value_to_ms(item.get("startTimestamp", item.get("start", item.get("timestamp"))))
        end_ms = value_to_ms(item.get("endTimestamp", item.get("end")), default=start_ms + 1000)
        cues.append(
            {
                "evidence_id": item.get("track_id") or item.get("id") or f"tracked_object:{index}",
                "cue_type": "object_foregrounded",
                "object_id": item.get("track_id") or item.get("id") or label,
                "significance_stage": "foregrounded",
                "score": confidence or 0.5,
                "start_ms": start_ms,
                "end_ms": max(end_ms, start_ms),
            }
        )
        if label.lower() in {"person", "human"}:
            track_id = item.get("track_id") or item.get("trackId") or item.get("id") or f"person:{index}"
            cues.append(
                {
                    "evidence_id": item.get("evidence_id") or f"person_identity:{track_id}",
                    "cue_type": "person_identity_prompt",
                    "object_id": str(track_id),
                    "prompt": "Who is this person?",
                    "score": confidence or 0.5,
                    "start_ms": start_ms,
                    "end_ms": max(end_ms, start_ms),
                }
            )

    expression_items = [
        item
        for item in iter_detection_items(visual.get("expression_results"))[:120]
        if (
            item.get("dominant_emotion")
            or item.get("dominant_expression")
            or item.get("expression")
            or (isinstance(item.get("interpreted_expression"), dict) and item["interpreted_expression"].get("label"))
        )
    ]
    for index, item in enumerate(expression_items):
        start_ms = value_to_ms(item.get("timestamp", item.get("time", item.get("start", item.get("start_ms")))))
        end_ms = value_to_ms(item.get("end", item.get("end_ms")), default=start_ms + 1000)
        interpreted_expression = item.get("interpreted_expression")
        interpreted_label = (
            interpreted_expression.get("label")
            if isinstance(interpreted_expression, dict)
            else None
        )
        expression_label = (
            item.get("dominant_emotion")
            or item.get("dominant_expression")
            or item.get("expression")
            or interpreted_label
            or "expression"
        )
        cues.append(
            {
                "evidence_id": item.get("evidence_id") or f"expression_owner:{index}",
                "cue_type": "expression_owner_prompt",
                "object_id": item.get("face_id") or item.get("track_id") or f"expression:{index}",
                "expression_label": expression_label,
                "prompt": "Whose expression is this?",
                "score": item.get("top_emotion_score") or item.get("confidence") or 0.45,
                "start_ms": start_ms,
                "end_ms": max(end_ms, start_ms),
            }
        )

    scene_groups: Dict[int, List[str]] = {}
    for cue in cues:
        if cue.get("cue_type") != "person_identity_prompt":
            continue
        bucket = int((safe_float(cue.get("start_ms"), 0.0) or 0.0) // 5000)
        scene_groups.setdefault(bucket, []).append(str(cue.get("object_id")))
    for bucket, object_ids in scene_groups.items():
        unique_ids = sorted(set(object_ids))
        if len(unique_ids) < 2:
            continue
        cues.append(
            {
                "evidence_id": f"scene_participants:{bucket}",
                "cue_type": "scene_participant_prompt",
                "object_id": f"scene:{bucket}",
                "participant_ids": unique_ids,
                "prompt": "Who are in this scene?",
                "score": 0.5,
                "start_ms": bucket * 5000,
                "end_ms": bucket * 5000 + 5000,
            }
        )
    return cues


def build_cinematic_clues_for_meaning(visual: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = visual.get("cinematic_clues") or {}
    clues: List[Dict[str, Any]] = []
    if not isinstance(raw, dict):
        return clues

    for group_name, group_value in raw.items():
        samples = group_value.get("samples") if isinstance(group_value, dict) else group_value
        if not isinstance(samples, list):
            continue
        for index, sample in enumerate(item for item in samples if isinstance(item, dict)):
            label = str(
                sample.get("label")
                or sample.get("shot_size")
                or sample.get("cue_type")
                or group_name
            ).lower()
            clue_type = ""
            if "close" in label:
                clue_type = "close_up"
            elif "domin" in label or "foreground" in label:
                clue_type = "screen_dominance"
            elif "approach" in label:
                clue_type = "approach"
            elif "withdraw" in label:
                clue_type = "withdrawal"
            elif "block" in label:
                clue_type = "blocking"
            if not clue_type:
                continue

            start_ms = value_to_ms(
                sample.get("timestamp", sample.get("time", sample.get("start", sample.get("start_ms"))))
            )
            end_ms = value_to_ms(sample.get("end", sample.get("end_ms")), default=start_ms + 1000)
            clues.append(
                {
                    "evidence_id": sample.get("evidence_id")
                    or f"cinematic:{group_name}:{index}",
                    "clue_type": clue_type,
                    "participant_id": sample.get("participant_id")
                    or sample.get("track_id")
                    or sample.get("subject_id")
                    or "unknown",
                    "target_id": sample.get("target_id"),
                    "start_ms": start_ms,
                    "end_ms": max(end_ms, start_ms),
                }
            )
    return clues


def scene_cuts_from_scene_segments(scene_segments_payload: Any) -> List[Dict[str, Any]]:
    if isinstance(scene_segments_payload, dict):
        segments = (
            scene_segments_payload.get("segments")
            or scene_segments_payload.get("sceneSegments")
            or scene_segments_payload.get("scene_cards")
            or scene_segments_payload.get("cards")
            or scene_segments_payload.get("scenes")
            or []
        )
    else:
        segments = scene_segments_payload if isinstance(scene_segments_payload, list) else []
    normalized_segments: List[Dict[str, Any]] = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        interval = segment.get("time_interval") if isinstance(segment.get("time_interval"), dict) else {}
        start = safe_float(segment.get("start"))
        end = safe_float(segment.get("end"))
        if start is None:
            start_ms = safe_float(interval.get("start_ms"))
            start = start_ms / 1000.0 if start_ms is not None else None
        if end is None:
            end_ms = safe_float(interval.get("end_ms"))
            end = end_ms / 1000.0 if end_ms is not None else None
        if start is None:
            continue
        normalized_segments.append({**segment, "start": start, "end": end if end is not None else start})
    normalized_segments.sort(key=lambda segment: safe_float(segment.get("start"), 0.0) or 0.0)
    cuts: List[Dict[str, Any]] = []
    for index in range(len(normalized_segments) - 1):
        left = normalized_segments[index]
        right = normalized_segments[index + 1]
        cut_time = safe_float(left.get("end"))
        if cut_time is None:
            cut_time = safe_float(right.get("start"))
        if cut_time is None:
            continue
        cuts.append(
            {
                "cut_id": f"scene_cut:{index + 1}",
                "time": cut_time,
                "pre_segment_id": left.get("scene_id") or left.get("id") or left.get("scene_index"),
                "post_segment_id": right.get("scene_id") or right.get("id") or right.get("scene_index"),
            }
        )
    return cuts


def is_scene_temporal_segment(segment: Any) -> bool:
    if not isinstance(segment, dict):
        return False
    family = str(segment.get("event_family") or segment.get("segment_family") or "").lower()
    segment_type = str(segment.get("segment_type") or segment.get("type") or "").lower()
    return (
        "scene" in family
        or segment_type == "scene"
        or str(segment.get("scene_id") or "").strip() != ""
    )


def build_master_schema_scene_temporal_segments(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Create Master Schema scene segments from the most mature available scene layer."""

    summary = status.get("summary") if isinstance(status.get("summary"), dict) else {}
    scene_segments_payload = summary.get("scene_segments") if isinstance(summary.get("scene_segments"), dict) else {}
    raw_segments = scene_segments_payload.get("segments") if isinstance(scene_segments_payload, dict) else []
    source = "summary.scene_segments"
    authority = "motion_scene_basis"
    review_state = "available"
    maturity_route = "master_schema.formal_media_scene_segments"

    if not raw_segments:
      second_order = status.get("second_order_label_proliferation") if isinstance(status.get("second_order_label_proliferation"), dict) else {}
      instructions = second_order.get("instructions") if isinstance(second_order.get("instructions"), list) else []
      ranges: List[Dict[str, float]] = []
      for instruction in instructions:
          if not isinstance(instruction, dict):
              continue
          time_span = instruction.get("time_span") if isinstance(instruction.get("time_span"), dict) else {}
          start_raw = time_span.get("start_ms", time_span.get("start", 0))
          end_raw = time_span.get("end_ms", time_span.get("end", start_raw))
          start = safe_float(start_raw, 0.0) or 0.0
          end = safe_float(end_raw, start) or start
          if "start_ms" in time_span or start > 1000:
              start = start / 1000.0
          if "end_ms" in time_span or end > 1000:
              end = end / 1000.0
          if start >= 0 and end >= start:
              ranges.append({"start": start, "end": max(end, start + 0.5)})
      if ranges:
          ranges.sort(key=lambda item: item["start"])
          window_seconds = 24.0
          first_start = max(0.0, int(ranges[0]["start"] // window_seconds) * window_seconds)
          last_end = max(max(item["end"] for item in ranges), first_start + window_seconds)
          raw_segments = []
          cursor = first_start
          while cursor <= last_end:
              end = min(cursor + window_seconds, max(last_end, cursor + 1.0))
              raw_segments.append({
                  "start": round(cursor, 3),
                  "end": round(end, 3),
                  "duration": round(end - cursor, 3),
              })
              cursor += window_seconds
          source = "second_order_label_proliferation.instructions"
          authority = "Master Schema candidate synthesis"
          review_state = "candidate_review_required"
          maturity_route = "master_schema.meaning_plot_interpretive_window_maturity"

    normalized: List[Dict[str, Any]] = []
    for index, segment in enumerate(raw_segments or []):
        if not isinstance(segment, dict):
            continue
        interval = segment.get("interval") if isinstance(segment.get("interval"), dict) else {}
        start = (
            safe_float(segment.get("start"))
            if safe_float(segment.get("start")) is not None
            else safe_float(segment.get("start_seconds"))
        )
        if start is None:
            start = safe_float(segment.get("start_ms"))
            if start is not None:
                start = start / 1000.0
        if start is None:
            start = safe_float(interval.get("start_seconds"))
        end = (
            safe_float(segment.get("end"))
            if safe_float(segment.get("end")) is not None
            else safe_float(segment.get("end_seconds"))
        )
        if end is None:
            end = safe_float(segment.get("end_ms"))
            if end is not None:
                end = end / 1000.0
        if end is None:
            end = safe_float(interval.get("end_seconds"))
        if start is None or end is None:
            continue
        scene_index = safe_int(segment.get("scene_index")) or index + 1
        start = max(0.0, min(start, end))
        end = max(start, end)
        normalized.append({
            "segment_id": segment.get("segment_id") or f"scene-understanding-{scene_index:04d}",
            "scene_id": segment.get("scene_id") or f"scene:{scene_index:03d}",
            "scene_index": scene_index,
            "segment_type": "scene",
            "event_family": "scene_understanding",
            "event_label": segment.get("event_label") or f"Scene {scene_index}",
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(end - start, 3),
            "interval": {
                "start_seconds": round(start, 3),
                "end_seconds": round(end, 3),
                "start_ms": int(round(start * 1000)),
                "end_ms": int(round(end * 1000)),
            },
            "authority": authority,
            "source": source,
            "review_state": segment.get("review_state") or review_state,
            "maturity_route": segment.get("maturity_route") or maturity_route,
            "provenance": build_provenance(
                source_system="vaa1",
                source_type="scene_governance",
                created_by="master-schema-scene-governance",
                note=f"Scene segment routed into Master Schema from {source}.",
            ),
        })
    return normalized


def master_schema_interval_seconds(item: Dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
    interval = item.get("interval") if isinstance(item.get("interval"), dict) else {}
    start = safe_float(item.get("start"))
    end = safe_float(item.get("end"))
    if start is None:
        start = safe_float(item.get("start_seconds"))
    if end is None:
        end = safe_float(item.get("end_seconds"))
    if start is None:
        start = safe_float(interval.get("start_seconds"))
    if end is None:
        end = safe_float(interval.get("end_seconds"))
    if start is None:
        start_ms = safe_float(item.get("start_ms")) or safe_float(interval.get("start_ms"))
        start = start_ms / 1000.0 if start_ms is not None else None
    if end is None:
        end_ms = safe_float(item.get("end_ms")) or safe_float(interval.get("end_ms"))
        end = end_ms / 1000.0 if end_ms is not None else None
    if start is None or end is None:
        return None, None
    start = max(0.0, min(start, end))
    end = max(start, end)
    return start, end


def build_master_schema_audio_event_temporal_segments(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Route governed speech/silence/noise/music intervals into Master Schema."""

    payload = artifact_payload_from_status_any(status, "audio_event_intervals", "audio_event_intervals_json")
    if not isinstance(payload, dict):
        audio_analysis = ((status.get("results") or {}).get("audio_analysis") or {}) if isinstance(status.get("results"), dict) else {}
        payload = audio_analysis.get("audio_event_intervals") if isinstance(audio_analysis, dict) else {}
    if not isinstance(payload, dict):
        return []
    raw_intervals = payload.get("intervals") if isinstance(payload.get("intervals"), list) else []
    normalized: List[Dict[str, Any]] = []
    for index, item in enumerate(raw_intervals):
        if not isinstance(item, dict):
            continue
        start, end = master_schema_interval_seconds(item)
        if start is None or end is None:
            continue
        event_type = str(
            item.get("event_type")
            or item.get("label")
            or item.get("type")
            or "audio_event"
        ).strip().lower().replace(" ", "_")
        if not event_type:
            event_type = "audio_event"
        segment_id = item.get("segment_id") or item.get("event_id") or f"audio-event-{index + 1:04d}"
        normalized.append({
            "segment_id": str(segment_id),
            "segment_type": "audio_event",
            "event_family": "audio_event_interval",
            "event_label": event_type,
            "audio_event_type": event_type,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(end - start, 3),
            "interval": {
                "start_seconds": round(start, 3),
                "end_seconds": round(end, 3),
                "start_ms": int(round(start * 1000)),
                "end_ms": int(round(end * 1000)),
            },
            "confidence": safe_float(item.get("confidence"), 1.0),
            "authority": "interpreted_automatic_detection",
            "source": "audio_event_intervals",
            "source_schema": payload.get("schema") or "vaa1.audio_event_intervals.v1",
            "review_state": item.get("review_state") or "available",
            "maturity_route": "master_schema.audio_event_interval_maturity",
            "measurements": {
                key: item.get(key)
                for key in ("energy_rms", "energy_dbfs", "zero_crossing_rate", "pitch_hz", "music_score", "speech_overlap_seconds")
                if item.get(key) is not None
            },
            "provenance": build_provenance(
                source_system="vaa1",
                source_type="audio_event_intervals",
                created_by="master-schema-audio-event-router",
                note="Speech/silence/noise/music interval routed through Master Schema.",
            ),
        })
    return normalized


def build_master_schema_speaker_diarization_temporal_segments(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Route speaker-linked diarization turns into Master Schema."""

    payload = artifact_payload_from_status_any(status, "audio_diarization", "audio_diarization_json")
    if not isinstance(payload, dict):
        audio_analysis = ((status.get("results") or {}).get("audio_analysis") or {}) if isinstance(status.get("results"), dict) else {}
        payload = audio_analysis.get("audio_diarization") if isinstance(audio_analysis, dict) else {}
    if not isinstance(payload, dict):
        return []
    raw_turns = payload.get("speaker_turns") if isinstance(payload.get("speaker_turns"), list) else []
    payload_stale = bool(payload.get("is_stale"))
    payload_stale_reason = payload.get("stale_reason")
    normalized: List[Dict[str, Any]] = []
    for index, item in enumerate(raw_turns):
        if not isinstance(item, dict):
            continue
        start, end = master_schema_interval_seconds(item)
        if start is None or end is None:
            continue
        speaker_label = str(
            item.get("speaker_label")
            or item.get("speaker")
            or item.get("cluster")
            or "speaker_unknown"
        ).strip()
        segment_id = item.get("turn_id") or item.get("segment_id") or f"speaker-turn-{index + 1:04d}"
        timing_status = str(item.get("timing_status") or "unverified")
        timing_authority = item.get("timing_authority")
        item_stale = payload_stale or bool(item.get("is_stale"))
        stale_reason = item.get("stale_reason") or payload_stale_reason
        can_seed_mature = (
            not item_stale
            and bool(item.get("valid_for_mature_master_schema", True))
            and timing_status in {"anchor_verified", "vad_anchor_verified", "manual_source_verified"}
        )
        normalized.append({
            "segment_id": str(segment_id),
            "segment_type": "speaker_turn",
            "event_family": "speaker_diarization_turn",
            "event_label": speaker_label,
            "speaker_label": speaker_label,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(end - start, 3),
            "interval": {
                "start_seconds": round(start, 3),
                "end_seconds": round(end, 3),
                "start_ms": int(round(start * 1000)),
                "end_ms": int(round(end * 1000)),
            },
            "transcript_text": item.get("text"),
            "confidence": safe_float(
                item.get("diarization_confidence")
                or item.get("confidence"),
                1.0,
            ),
            "authority": "source_verified_detection" if can_seed_mature else "interpreted_automatic_detection",
            "source": "audio_diarization.speaker_turns",
            "source_schema": payload.get("schema") or "vaa1.audio_diarization.measured.v1",
            "review_state": item.get("review_state") or (
                "stale_rebuild_required" if item_stale else (
                    "candidate_review_required" if not can_seed_mature else "source_interval_verified"
                )
            ),
            "maturity_route": "master_schema.speaker_diarization_maturity",
            "timing_status": timing_status,
            "timing_authority": timing_authority,
            "timing_source": item.get("timing_source"),
            "source_start": item.get("source_start"),
            "source_end": item.get("source_end"),
            "canonical_time_basis": item.get("canonical_time_basis") or "source_media_seconds",
            "source_media_id": item.get("source_media_id"),
            "transcript_fingerprint": item.get("transcript_fingerprint") or payload.get("transcript_fingerprint"),
            "audio_fingerprint": item.get("audio_fingerprint") or payload.get("audio_fingerprint"),
            "diarization_fingerprint": item.get("diarization_fingerprint") or payload.get("diarization_fingerprint"),
            "generated_from_artifact_id": item.get("generated_from_artifact_id") or f"{status.get('analysis_id')}:audio_diarization",
            "generated_at": item.get("generated_at") or payload.get("generated_at"),
            "is_stale": item_stale,
            "stale_reason": stale_reason,
            "valid_for_confirmation": bool(item.get("valid_for_confirmation")) and not item_stale,
            "can_seed_mature_speaker_claim": can_seed_mature,
            "measurements": {
                key: item.get(key)
                for key in ("cluster_id", "turn_index", "overlap_seconds", "energy_dbfs", "pitch_hz")
                if item.get(key) is not None
            },
            "provenance": build_provenance(
                source_system="vaa1",
                source_type="audio_diarization",
                created_by="master-schema-speaker-diarization-router",
                note=(
                    "Speaker diarization turn routed through Master Schema with timing authority preserved."
                ),
            ),
        })
    return normalized


def build_master_schema_shot_boundary_temporal_segments(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Route true or candidate shot-boundary intervals into Master Schema."""

    summary = status.get("summary") if isinstance(status.get("summary"), dict) else {}
    payload = summary.get("shot_boundaries") if isinstance(summary.get("shot_boundaries"), dict) else {}
    if not payload:
        visual_analysis = ((status.get("results") or {}).get("visual_analysis") or {}) if isinstance(status.get("results"), dict) else {}
        payload = visual_analysis.get("shot_boundaries") if isinstance(visual_analysis, dict) else {}
    if not isinstance(payload, dict):
        return []
    raw_intervals = payload.get("intervals") if isinstance(payload.get("intervals"), list) else []
    normalized: List[Dict[str, Any]] = []
    true_boundaries = bool(payload.get("true_boundary_intervals"))
    for index, item in enumerate(raw_intervals):
        if not isinstance(item, dict):
            continue
        start, end = master_schema_interval_seconds(item)
        if start is None or end is None:
            continue
        shot_id = item.get("shot_id") or item.get("segment_id") or f"shot-{index + 1:04d}"
        normalized.append({
            "segment_id": f"shot-boundary-{index + 1:04d}",
            "shot_id": str(shot_id),
            "segment_type": "shot",
            "event_family": "shot_boundary_interval",
            "event_label": f"Shot {index + 1}",
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(end - start, 3),
            "interval": {
                "start_seconds": round(start, 3),
                "end_seconds": round(end, 3),
                "start_ms": int(round(start * 1000)),
                "end_ms": int(round(end * 1000)),
            },
            "boundary_in": item.get("boundary_in"),
            "boundary_out": item.get("boundary_out"),
            "confidence": safe_float(item.get("confidence"), 1.0 if true_boundaries else 0.35),
            "authority": "interpreted_automatic_detection" if true_boundaries else "raw_detection",
            "source": payload.get("source") or item.get("source") or "shot_boundaries",
            "source_schema": payload.get("schema") or "vaa1.shot_boundary_intervals.v1",
            "true_boundary_interval": true_boundaries,
            "review_state": item.get("review_state") or ("available" if true_boundaries else "candidate_review_required"),
            "maturity_route": (
                "master_schema.true_shot_boundary_interval_maturity"
                if true_boundaries
                else "master_schema.shot_boundary_candidate_maturity"
            ),
            "provenance": build_provenance(
                source_system="vaa1",
                source_type="shot_boundary_intervals",
                created_by="master-schema-shot-boundary-router",
                note="Shot boundary interval routed through Master Schema.",
            ),
        })
    return normalized


def build_master_schema_music_lyric_temporal_segments(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Route music-analysis and lyric/transcript matches into Master Schema when present."""

    payload = artifact_payload_from_status_any(
        status,
        "music_lyrics_analysis",
        "tune_lyrics",
        "lyric_detector",
    )
    if not isinstance(payload, dict):
        return []
    normalized: List[Dict[str, Any]] = []
    music_analysis = payload.get("musical_analysis") if isinstance(payload.get("musical_analysis"), dict) else {}
    key_series = music_analysis.get("per_second_key_indication") if isinstance(music_analysis.get("per_second_key_indication"), list) else []
    if music_analysis:
        for index, item in enumerate(key_series[:600] or [{}]):
            if not isinstance(item, dict):
                continue
            start = safe_float(item.get("time"), 0.0) or 0.0
            end = start + 1.0
            normalized.append({
                "segment_id": f"music-analysis-{index + 1:04d}",
                "segment_type": "music_analysis",
                "event_family": "music_analysis",
                "event_label": "music analysis",
                "start": round(start, 3),
                "end": round(end, 3),
                "duration": round(end - start, 3),
                "interval": {
                    "start_seconds": round(start, 3),
                    "end_seconds": round(end, 3),
                    "start_ms": int(round(start * 1000)),
                    "end_ms": int(round(end * 1000)),
                },
                "measurements": {
                    "beats_per_second": music_analysis.get("beats_per_second"),
                    "average_key_indication": music_analysis.get("average_key_indication"),
                    "dominant_pitch_class": item.get("dominant_pitch_class"),
                },
                "authority": "interpreted_automatic_detection",
                "source": "music_lyrics_analysis.musical_analysis",
                "source_schema": music_analysis.get("schema") or "vaa1.music_analysis.v1",
                "review_state": "available" if music_analysis.get("status") == "computed" else "candidate_review_required",
                "maturity_route": "master_schema.music_analysis_maturity",
                "provenance": build_provenance(
                    source_system="vaa1",
                    source_type="music_analysis",
                    created_by="master-schema-music-lyrics-router",
                    note="Music/prosodic analysis routed through Master Schema.",
                ),
            })
    lyric_matches = payload.get("lyrics_in_transcript") if isinstance(payload.get("lyrics_in_transcript"), list) else []
    for index, item in enumerate(lyric_matches):
        if not isinstance(item, dict):
            continue
        start, end = master_schema_interval_seconds(item)
        transcript_segment = item.get("transcript_segment") if isinstance(item.get("transcript_segment"), dict) else {}
        if start is None:
            start = safe_float(transcript_segment.get("start"), 0.0) or 0.0
        if end is None:
            end = safe_float(transcript_segment.get("end"), start) or start
        normalized.append({
            "segment_id": f"lyric-match-{index + 1:04d}",
            "segment_type": "lyric_transcript_match",
            "event_family": "lyric_transcript_match",
            "event_label": item.get("matched_lyric_line") or "lyric match",
            "start": round(start, 3),
            "end": round(max(end, start), 3),
            "duration": round(max(end, start) - start, 3),
            "interval": {
                "start_seconds": round(start, 3),
                "end_seconds": round(max(end, start), 3),
                "start_ms": int(round(start * 1000)),
                "end_ms": int(round(max(end, start) * 1000)),
            },
            "lyrics_excerpt": item.get("matched_lyric_line"),
            "authority": "interpreted_automatic_detection",
            "source": "music_lyrics_analysis.lyrics_in_transcript",
            "source_schema": item.get("schema") or "vaa1.lyric_transcript_match.v1",
            "review_state": "candidate_review_required",
            "maturity_route": "master_schema.lyric_transcript_match_maturity",
            "provenance": build_provenance(
                source_system="vaa1",
                source_type="lyric_transcript_match",
                created_by="master-schema-music-lyrics-router",
                note="Lyric/transcript match routed through Master Schema.",
            ),
        })
    return normalized


def merge_master_schema_temporal_segments(*segment_groups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for group in segment_groups:
        for index, segment in enumerate(group or []):
            if not isinstance(segment, dict):
                continue
            segment_id = str(
                segment.get("segment_id")
                or f"{segment.get('event_family') or segment.get('segment_type') or 'segment'}:{index}"
            )
            merged[segment_id] = {**segment, "segment_id": segment_id}
    return list(merged.values())


def build_master_schema_foundational_source_layers(
    status: Dict[str, Any],
    *,
    temporal_segments: List[Dict[str, Any]],
) -> Dict[str, Any]:
    audio_segments = [
        segment for segment in temporal_segments
        if segment.get("event_family") == "audio_event_interval"
    ]
    shot_segments = [
        segment for segment in temporal_segments
        if segment.get("event_family") == "shot_boundary_interval"
    ]
    music_segments = [
        segment for segment in temporal_segments
        if segment.get("event_family") == "music_analysis"
    ]
    lyric_segments = [
        segment for segment in temporal_segments
        if segment.get("event_family") == "lyric_transcript_match"
    ]
    speaker_turn_segments = [
        segment for segment in temporal_segments
        if segment.get("event_family") == "speaker_diarization_turn"
    ]
    return {
        "schema": "vaa1.master_schema_foundational_source_layers.v1",
        "updated_at": utc_now_iso(),
        "principle": "Foundational detection products land in Master Schema before StatsKit, SignificanceKit, or RelevanceKit consume them.",
        "layers": {
            "audio_event_intervals": {
                "status": "available" if audio_segments else "missing",
                "schema": "vaa1.audio_event_intervals.v1",
                "master_schema_surface": "temporal_segments[event_family=audio_event_interval]",
                "row_count": len(audio_segments),
                "event_types": sorted({str(segment.get("audio_event_type") or segment.get("event_label")) for segment in audio_segments}),
                "maturity_route": "master_schema.audio_event_interval_maturity",
            },
            "shot_boundary_intervals": {
                "status": "available" if shot_segments else "missing",
                "schema": "vaa1.shot_boundary_intervals.v1",
                "master_schema_surface": "temporal_segments[event_family=shot_boundary_interval]",
                "row_count": len(shot_segments),
                "true_boundary_rows": len([segment for segment in shot_segments if segment.get("true_boundary_interval")]),
                "maturity_route": "master_schema.true_shot_boundary_interval_maturity",
            },
            "speaker_diarization_turns": {
                "status": "available" if speaker_turn_segments else "missing",
                "schema": "vaa1.audio_diarization.measured.v1",
                "master_schema_surface": "temporal_segments[event_family=speaker_diarization_turn]",
                "row_count": len(speaker_turn_segments),
                "speaker_labels": sorted({str(segment.get("speaker_label") or segment.get("event_label")) for segment in speaker_turn_segments}),
                "maturity_route": "master_schema.speaker_diarization_maturity",
            },
            "music_analysis": {
                "status": "available" if music_segments else "missing",
                "schema": "vaa1.music_analysis.v1",
                "master_schema_surface": "temporal_segments[event_family=music_analysis]",
                "row_count": len(music_segments),
                "maturity_route": "master_schema.music_analysis_maturity",
            },
            "lyric_transcript_matches": {
                "status": "available" if lyric_segments else "missing",
                "schema": "vaa1.lyric_transcript_match.v1",
                "master_schema_surface": "temporal_segments[event_family=lyric_transcript_match]",
                "row_count": len(lyric_segments),
                "maturity_route": "master_schema.lyric_transcript_match_maturity",
            },
        },
    }


def track_feature_vector_from_row(item: Dict[str, Any], *keys: str) -> Optional[List[float]]:
    for key in keys:
        value = item.get(key)
        if value in (None, ""):
            continue
        if isinstance(value, list):
            try:
                return [float(part) for part in value]
            except (TypeError, ValueError):
                continue
        if isinstance(value, dict):
            nested = value.get("vector") or value.get("values") or value.get("embedding")
            if isinstance(nested, list):
                try:
                    return [float(part) for part in nested]
                except (TypeError, ValueError):
                    continue
        if isinstance(value, str):
            parts = [part.strip() for part in re.split(r"[,\s;]+", value) if part.strip()]
            if not parts:
                continue
            try:
                return [float(part) for part in parts]
            except ValueError:
                continue
    return None


def normalize_track_for_agent_persistence(item: Dict[str, Any], index: int) -> Dict[str, Any]:
    track_id = item.get("track_id") or item.get("trackId") or item.get("id") or f"track:{index}"
    class_name = str(item.get("class_name") or item.get("label") or item.get("object_class") or "").lower()
    features: Dict[str, Any] = {}
    face_embedding = track_feature_vector_from_row(
        item,
        "face_embedding",
        "face_embedding_vector",
        "sample_embedding",
        "visual_embedding",
    )
    torso_histogram = track_feature_vector_from_row(
        item,
        "torso_histogram",
        "torso_color_histogram",
        "clothing_histogram",
    )
    if face_embedding:
        features["face_embedding"] = face_embedding
    if torso_histogram:
        features["torso_histogram"] = torso_histogram

    return {
        "track_id": str(track_id),
        "agent_label": item.get("agent_label")
        or item.get("narrative_agent_label")
        or item.get("identity_affirmation")
        or item.get("display_label")
        or item.get("label")
        or item.get("class_name")
        or str(track_id),
        "class_name": class_name,
        "start": safe_float(item.get("start_timestamp") or item.get("start") or item.get("timestamp"), 0.0),
        "end": safe_float(
            item.get("end_timestamp")
            or item.get("end")
            or item.get("timestamp")
            or item.get("start_timestamp"),
            0.0,
        ),
        "features": features,
        "feature_cloud_ref": item.get("feature_cloud_ref")
        or item.get("visual_sample_cloud_ref")
        or item.get("face_sample_cloud_ref"),
        "evidence_id": item.get("evidence_id") or f"object:{track_id}",
        "frame_ref": item.get("frame_ref"),
        "bbox_ref": item.get("bbox_ref") or f"bbox:{track_id}",
    }


def write_agent_persistence_artifact_for_status(
    status: Dict[str, Any],
    output_path: Path,
) -> Dict[str, Any]:
    analysis_id = status.get("analysis_id") or "unknown_analysis"
    visual = (status.get("results") or {}).get("visual_analysis") or {}
    tracked_payload = visual.get("tracked_objects") or artifact_payload_from_status_any(
        status,
        "tracked_objects",
        "tracked_objects_json",
        "time_bank_objects",
    )
    tracked_objects = [
        item
        for item in iter_detection_items(tracked_payload)
        if str(item.get("class_name") or item.get("label") or "").lower() in {"person", "human", "animate"}
        or item.get("agent_label")
        or item.get("narrative_agent_label")
    ]
    tracks = [
        normalize_track_for_agent_persistence(item, index)
        for index, item in enumerate(tracked_objects)
    ]
    scene_cuts = scene_cuts_from_scene_segments(
        visual.get("scene_segments")
        or artifact_payload_from_status_any(
            status,
            "scene_segments",
            "motion_scene_basis",
            "mise_en_scene_scene_cards",
        )
    )
    manager = AgentPersistenceManager()
    checks: List[Dict[str, Any]] = []
    feature_events: List[Dict[str, Any]] = []
    for scene_cut in scene_cuts:
        grouped = manager.tracks_near_scene_cut(tracks, scene_cut)
        check = manager.cross_scene_persistence_check(
            grouped["departed"],
            grouped["arrived"],
            scene_cut=scene_cut,
        )
        checks.append(check)
        for candidate in check.get("candidates") or []:
            feature_events.append(build_agent_persistence_feature_event(analysis_id, candidate))

    payload = {
        "schema": "vaa1.agent_persistence_bundle.v1",
        "analysis_id": analysis_id,
        "status": "ready",
        "scene_cut_count": len(scene_cuts),
        "track_count": len(tracks),
        "tracks_with_comparable_features": sum(1 for track in tracks if track.get("features")),
        "checks": checks,
        "feature_events": feature_events,
        "summary": {
            "candidate_count": sum((check.get("summary") or {}).get("candidate_count", 0) for check in checks),
            "accepted_count": sum((check.get("summary") or {}).get("accepted_count", 0) for check in checks),
            "review_candidate_count": sum(
                (check.get("summary") or {}).get("review_candidate_count", 0) for check in checks
            ),
        },
        "manual_testing_notes": {
            "requires_scene_segments": True,
            "requires_comparable_agent_sample_features": True,
            "empty_candidates_are_valid_when_feature_clouds_are_absent": True,
        },
        "governance": {
            "does_not_assert_natural_person_identity": True,
            "semantic_agent_sample_profile_only": True,
            "anti_drift_rule_preserved_for_continuous_tracking": True,
        },
        "provenance": {
            "created_at": utc_now_iso(),
            "created_by": "api_server.write_agent_persistence_artifact_for_status",
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload


def should_run_agent_persistence_for_status(status: Dict[str, Any]) -> bool:
    """Agent persistence writes a traceable scene-cut artifact when tracks and cuts exist."""

    visual = (status.get("results") or {}).get("visual_analysis") or {}
    tracked_payload = visual.get("tracked_objects") or artifact_payload_from_status_any(
        status,
        "tracked_objects",
        "tracked_objects_json",
        "time_bank_objects",
    )
    tracked_objects = [
        item
        for item in iter_detection_items(tracked_payload)
        if str(item.get("class_name") or item.get("label") or "").lower() in {"person", "human", "animate"}
        or item.get("agent_label")
        or item.get("narrative_agent_label")
    ]
    if not tracked_objects:
        return False

    scene_cuts = scene_cuts_from_scene_segments(
        visual.get("scene_segments")
        or artifact_payload_from_status_any(
            status,
            "scene_segments",
            "motion_scene_basis",
            "mise_en_scene_scene_cards",
        )
    )
    if not scene_cuts:
        return False

    return True


def load_json_artifact_for_meaning(path_value: Any) -> Optional[Dict[str, Any]]:
    if not path_value:
        return None
    try:
        artifact_path = Path(str(path_value))
        if not artifact_path.exists():
            return None
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else None
    except Exception as exc:
        logger.debug(f"Could not load second-order meaning artifact fallback {path_value}: {exc}")
        return None


def resolve_transcript_for_meaning(status: Dict[str, Any], audio: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    transcript = audio.get("transcript")
    if isinstance(transcript, dict) and (
        transcript.get("segments") or transcript.get("utterances") or transcript.get("text")
    ):
        return transcript

    output_files = status.get("output_files") or {}
    analysis_id = status.get("analysis_id")
    candidate_paths: List[Any] = [
        output_files.get("transcript"),
        TRANSCRIPTS_DIR / f"{analysis_id}_transcript.json" if analysis_id else None,
    ]
    for path_value in candidate_paths:
        payload = load_json_artifact_for_meaning(path_value)
        if payload and (payload.get("segments") or payload.get("utterances") or payload.get("text")):
            return payload
    return None


def resolve_audio_prosody_for_meaning(status: Dict[str, Any], audio: Dict[str, Any]) -> Dict[str, Any]:
    prosody = audio.get("audio_prosody")
    if isinstance(prosody, dict):
        return prosody

    output_files = status.get("output_files") or {}
    analysis_id = status.get("analysis_id")
    candidate_paths: List[Any] = [
        output_files.get("audio_prosody"),
        TRANSCRIPTS_DIR / f"{analysis_id}_audio_prosody.json" if analysis_id else None,
    ]
    for path_value in candidate_paths:
        payload = load_json_artifact_for_meaning(path_value)
        if payload:
            return payload
    return {}


def write_second_order_meaning_artifacts_for_status(
    status: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return None

    results = status.get("results") or {}
    audio = results.get("audio_analysis") or {}
    transcript = resolve_transcript_for_meaning(status, audio)
    if not transcript:
        return None
    audio_prosody = resolve_audio_prosody_for_meaning(status, audio)

    visual = results.get("visual_analysis") or {}
    visual = dict(visual) if isinstance(visual, dict) else {}
    if not visual.get("tracked_objects"):
        tracked_payload = artifact_payload_from_status_any(status, "tracked_objects", "tracked_objects_json", "time_bank_objects")
        if tracked_payload is not None:
            visual["tracked_objects"] = tracked_payload
    if not visual.get("ocr_results"):
        ocr_payload = artifact_payload_from_status_any(status, "ocr_results", "ocr_json", "time_bank_ocr")
        if ocr_payload is not None:
            visual["ocr_results"] = ocr_payload
    if not visual.get("expression_results"):
        expression_payload = artifact_payload_from_status_any(status, "expression_results", "expression_json", "time_bank_expressions")
        if expression_payload is not None:
            visual["expression_results"] = expression_payload
    if not visual.get("scene_segments"):
        scene_payload = artifact_payload_from_status_any(status, "scene_segments", "motion_scene_basis", "mise_en_scene_scene_cards")
        if scene_payload is not None:
            visual["scene_segments"] = scene_payload
    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)
    source_metadata = status.get("source_media_metadata") or build_source_media_metadata_payload(status)
    genre_profile = build_meaning_genre_profile(source_metadata)
    culture_context = build_meaning_culture_context(status)

    dependency_path = analysis_dir / "dependency_sfl_stage1.json"
    meaning_path = analysis_dir / "multimodal_meaning_stage1.json"
    proliferation_path = analysis_dir / "second_order_label_proliferation.json"
    narrative_lens_path = analysis_dir / "narrative_lens_reading.json"
    character_path_path = analysis_dir / "character_path_reading.json"
    datascene_meaning_network_path = analysis_dir / "datascene_meaning_network.json"
    agent_persistence_path = analysis_dir / "agent_persistence_scene_cut.json"

    sfl_artifact = write_dependency_sfl_stage1_artifact(
        analysis_id,
        transcript,
        dependency_path,
        source_media_id=analysis_id,
        language=transcript.get("language") if isinstance(transcript, dict) else None,
        source_metadata=source_metadata,
        genre_profile=genre_profile,
        culture_context=culture_context,
    )
    meaning_artifact = write_multimodal_meaning_stage1_artifact(
        analysis_id,
        sfl_artifact,
        meaning_path,
        source_media_id=analysis_id,
        source_metadata=source_metadata,
        visual_cues=build_visual_cues_for_meaning(visual),
        cinematic_clues=build_cinematic_clues_for_meaning(visual),
        audio_features={
            "artifact_id": "audio_prosody",
            "cue_count": len(audio_prosody.get("cues") or audio_prosody.get("events") or []),
        },
        ocr_features={
            "artifact_id": "ocr_results",
            "count": len(iter_detection_items(visual.get("ocr_results"))),
        },
        genre_profile=genre_profile,
        culture_context=culture_context,
    )

    agent_persistence = status.get("agent_persistence_scene_cut", {})
    agent_persistence_events = agent_persistence.get("feature_events") or []
    if agent_persistence_events:
        meaning_artifact.setdefault("feature_events", []).extend(agent_persistence_events)
        meaning_path.write_text(
            json.dumps(meaning_artifact, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    agent_persistence_path = (status.get("output_files") or {}).get("agent_persistence_scene_cut")
    plan = write_second_order_label_proliferation_plan(
        analysis_id,
        meaning_artifact,
        proliferation_path,
        agent_persistence_path=agent_persistence_path,
    )
    scene_cards = status.get("mise_en_scene_scene_cards")
    narrative_lens_artifact = write_narrative_lens_reading_artifact(
        analysis_id,
        plan,
        narrative_lens_path,
        dependency_sfl_stage1=sfl_artifact,
        multimodal_meaning_stage1=meaning_artifact,
        scene_cards=(scene_cards or {}).get("scene_cards") if isinstance(scene_cards, dict) else None,
        source_metadata=source_metadata,
    )
    narrative_agent_profiles = []
    if isinstance(source_metadata, dict):
        narrative_agent_profiles = [
            profile
            for profile in source_metadata.get("narrative_agent_profiles") or []
            if isinstance(profile, dict)
        ]
    master_schema = status.get("vaa1_annotation_master_schema")
    if not narrative_agent_profiles and isinstance(master_schema, dict):
        narrative_agent_profiles = [
            profile
            for profile in master_schema.get("narrative_agent_profile_annotations") or []
            if isinstance(profile, dict)
        ]
    character_path_artifact = write_character_path_reading_artifact(
        analysis_id,
        narrative_agent_profiles,
        plan,
        character_path_path,
        scene_refs=(scene_cards or {}).get("scene_cards") if isinstance(scene_cards, dict) else None,
        manual_agent_annotations=(
            master_schema.get("narrative_agent_profile_annotations") if isinstance(master_schema, dict) else None
        ),
    )
    datascene_meaning_network_artifact = write_datascene_meaning_network_artifact(
        analysis_id,
        status,
        datascene_meaning_network_path,
        transcript=transcript,
        visual_analysis=visual,
        scene_cards=scene_cards,
    )

    internal_artifacts = status.setdefault("internal_artifacts", {})
    output_files = status.setdefault("output_files", {})
    internal_artifacts["dependency_sfl_stage1"] = str(dependency_path)
    internal_artifacts["multimodal_meaning_stage1"] = str(meaning_path)
    internal_artifacts["second_order_label_proliferation"] = str(proliferation_path)
    internal_artifacts["narrative_lens_reading"] = str(narrative_lens_path)
    internal_artifacts["character_path_reading"] = str(character_path_path)
    internal_artifacts["datascene_meaning_network"] = str(datascene_meaning_network_path)
    output_files["dependency_sfl_stage1"] = str(dependency_path)
    output_files["multimodal_meaning_stage1"] = str(meaning_path)
    output_files["second_order_label_proliferation"] = str(proliferation_path)
    output_files["narrative_lens_reading"] = str(narrative_lens_path)
    output_files["character_path_reading"] = str(character_path_path)
    output_files["datascene_meaning_network"] = str(datascene_meaning_network_path)
    status["second_order_label_proliferation"] = {
        **plan,
        "output_json_path": str(proliferation_path),
        "updated_at": utc_now_iso(),
    }
    status["narrative_lens_reading"] = {
        **narrative_lens_artifact,
        "output_json_path": str(narrative_lens_path),
        "updated_at": utc_now_iso(),
    }
    status["character_path_reading"] = {
        **character_path_artifact,
        "output_json_path": str(character_path_path),
        "updated_at": utc_now_iso(),
    }
    status["datascene_meaning_network"] = {
        **datascene_meaning_network_artifact,
        "output_json_path": str(datascene_meaning_network_path),
        "updated_at": utc_now_iso(),
    }
    return plan


def write_mise_en_scene_artifacts_for_status(
    status: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return None

    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)
    scene_cards_path = analysis_dir / "mise_en_scene_scene_cards.json"
    metadata_summary_path = analysis_dir / "source_extraction_metadata_summary.json"

    refresh_master_schema_metadata_surfaces(status)
    scene_card_bundle = write_mise_en_scene_scene_cards(
        analysis_id,
        status,
        scene_cards_path,
        source_video_id=status.get("video_id") or analysis_id,
    )
    metadata_summary = write_source_extraction_metadata_summary(
        scene_card_bundle,
        metadata_summary_path,
        source_metadata=status.get("source_media_metadata")
        or scene_card_bundle.get("source_metadata_unchanged"),
    )

    internal_artifacts = status.setdefault("internal_artifacts", {})
    output_files = status.setdefault("output_files", {})
    internal_artifacts["mise_en_scene_scene_cards"] = str(scene_cards_path)
    internal_artifacts["source_extraction_metadata_summary"] = str(metadata_summary_path)
    output_files["mise_en_scene_scene_cards"] = str(scene_cards_path)
    output_files["source_extraction_metadata_summary"] = str(metadata_summary_path)
    status["mise_en_scene_scene_cards"] = {
        "schema": scene_card_bundle.get("schema"),
        "scene_card_count": len(scene_card_bundle.get("scene_cards") or []),
        "output_json_path": str(scene_cards_path),
        "source_extraction_metadata_summary_path": str(metadata_summary_path),
        "updated_at": utc_now_iso(),
    }
    status["source_extraction_metadata_summary"] = {
        "schema": metadata_summary.get("schema"),
        "status": metadata_summary.get("status"),
        "summary": metadata_summary.get("summary"),
        "supporting_scenes": metadata_summary.get("supporting_scenes", []),
        "output_json_path": str(metadata_summary_path),
        "updated_at": utc_now_iso(),
    }
    return scene_card_bundle


def mise_en_scene_artifacts_need_refresh(status: Dict[str, Any]) -> bool:
    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    scene_card_path = output_files.get("mise_en_scene_scene_cards")
    if not scene_card_path or not Path(str(scene_card_path)).exists():
        return True

    scene_bundle = read_json_artifact_if_available(scene_card_path)
    if not scene_bundle:
        return True

    scene_cards = scene_bundle.get("scene_cards") if isinstance(scene_bundle, dict) else []
    first_card = scene_cards[0] if isinstance(scene_cards, list) and scene_cards else {}
    if not isinstance(first_card, dict):
        return True

    has_registered_transcript = output_file_exists(status, "transcript")
    has_registered_objects = output_file_exists(status, "tracked_objects_csv") or output_file_exists(
        status,
        "tracked_objects_json",
    )
    card_speech_count = len(first_card.get("said_in_scene") or [])
    card_item_count = len(first_card.get("items") or [])
    if has_registered_transcript and card_speech_count == 0:
        return True
    if has_registered_objects and card_item_count <= 1:
        return True
    if not first_card.get("nlp_scene_summary_sentence"):
        return True
    nlp_summary = first_card.get("nlp_scene_summary")
    if not isinstance(nlp_summary, dict) or int(nlp_summary.get("version") or 0) < 8:
        return True
    if len(scene_cards) <= 1 and _status_has_long_transcript_for_scene_windows(status, first_card):
        return True
    corrections = status.get("annotation_corrections") if isinstance(status.get("annotation_corrections"), dict) else {}
    corrections_updated_at = corrections.get("updated_at")
    scene_updated_at = (status.get("mise_en_scene_scene_cards") or {}).get("updated_at")
    if corrections_updated_at and (not scene_updated_at or str(corrections_updated_at) > str(scene_updated_at)):
        return True
    return False


def _status_has_long_transcript_for_scene_windows(
    status: Dict[str, Any],
    first_card: Dict[str, Any],
) -> bool:
    transcript_segments: List[Dict[str, Any]] = []
    transcript_path = (status.get("output_files") or {}).get("transcript")
    if transcript_path and Path(str(transcript_path)).exists():
        try:
            transcript_payload = json.loads(Path(str(transcript_path)).read_text(encoding="utf-8"))
        except Exception:
            transcript_payload = None
        if isinstance(transcript_payload, list):
            transcript_segments = [item for item in transcript_payload if isinstance(item, dict)]
        elif isinstance(transcript_payload, dict):
            raw_segments = transcript_payload.get("segments") or transcript_payload.get("transcript") or []
            if isinstance(raw_segments, list):
                transcript_segments = [item for item in raw_segments if isinstance(item, dict)]
    if not transcript_segments:
        transcript_payload = read_json_artifact_if_available(transcript_path)
        raw_segments = (
            transcript_payload.get("segments") or transcript_payload.get("transcript") or []
            if isinstance(transcript_payload, dict)
            else []
        )
        if isinstance(raw_segments, list):
            transcript_segments = [item for item in raw_segments if isinstance(item, dict)]
    if not transcript_segments:
        raw_segments = ((status.get("transcript") or {}).get("segments") if isinstance(status.get("transcript"), dict) else [])
        if isinstance(raw_segments, list):
            transcript_segments = [item for item in raw_segments if isinstance(item, dict)]
    if not transcript_segments:
        results = status.get("results") if isinstance(status.get("results"), dict) else {}
        audio_analysis = results.get("audio_analysis") if isinstance(results.get("audio_analysis"), dict) else {}
        transcript = audio_analysis.get("transcript") if isinstance(audio_analysis.get("transcript"), dict) else {}
        raw_segments = transcript.get("segments") or transcript.get("transcript") or []
        if isinstance(raw_segments, list):
            transcript_segments = [item for item in raw_segments if isinstance(item, dict)]
    if len(transcript_segments) < 6:
        return False

    starts: List[float] = []
    ends: List[float] = []
    for segment in transcript_segments:
        start = safe_float(segment.get("start") or segment.get("timestamp") or segment.get("start_seconds"))
        end = safe_float(segment.get("end") or segment.get("endTimestamp") or segment.get("end_seconds"))
        if start is None:
            continue
        if end is None:
            end = start
        starts.append(start)
        ends.append(end)
    transcript_span = max(ends) - min(starts) if starts and ends else 0.0

    interval = first_card.get("time_interval") if isinstance(first_card.get("time_interval"), dict) else {}
    card_start_ms = safe_float(interval.get("start_ms")) or 0.0
    card_end_ms = safe_float(interval.get("end_ms")) or card_start_ms
    card_span_seconds = max(0.0, (card_end_ms - card_start_ms) / 1000.0)
    boundary_source = str(first_card.get("scene_boundary_source") or "")

    return max(transcript_span, card_span_seconds) > 45.0 and boundary_source in {
        "fallback_transcript_extent",
        "fallback_whole_media",
        "detected_single_extent",
        "detected",
        "",
    }


def intervals_overlap(
    item_start: Any,
    item_end: Any,
    window_start: float,
    window_end: float,
) -> bool:
    start = safe_float(item_start)
    end = safe_float(item_end)
    if start is None and end is None:
        return False
    if start is None:
        start = end
    if end is None:
        end = start
    if start is None or end is None:
        return False
    if end < start:
        start, end = end, start
    return start <= window_end and end >= window_start


def point_in_window(timestamp: Any, window_start: float, window_end: float) -> bool:
    value = safe_float(timestamp)
    return value is not None and window_start <= value <= window_end


def intervals_overlap(
    item_start: Any,
    item_end: Any,
    window_start: float,
    window_end: float,
) -> bool:
    start = safe_float(item_start)
    end = safe_float(item_end) if item_end is not None else start
    if start is None or end is None:
        return False
    return max(start, window_start) <= min(end, window_end)


def bbox_region_overlap(
    item: Dict[str, Any],
    region: Optional[Dict[str, Any]],
) -> Optional[float]:
    if not region:
        return None

    x1 = safe_float(item.get("bbox_x1"))
    y1 = safe_float(item.get("bbox_y1"))
    x2 = safe_float(item.get("bbox_x2"))
    y2 = safe_float(item.get("bbox_y2"))
    rx = safe_float(region.get("x"))
    ry = safe_float(region.get("y"))
    rw = safe_float(region.get("w"))
    rh = safe_float(region.get("h"))
    if None in (x1, y1, x2, y2, rx, ry, rw, rh):
        return None

    left, right = sorted((float(x1), float(x2)))
    top, bottom = sorted((float(y1), float(y2)))
    region_right = float(rx) + max(0.0, float(rw))
    region_bottom = float(ry) + max(0.0, float(rh))
    overlap_w = max(0.0, min(right, region_right) - max(left, float(rx)))
    overlap_h = max(0.0, min(bottom, region_bottom) - max(top, float(ry)))
    overlap_area = overlap_w * overlap_h
    if overlap_area <= 0:
        return 0.0

    item_area = max(0.0, right - left) * max(0.0, bottom - top)
    region_area = max(0.0, float(rw)) * max(0.0, float(rh))
    denominator = min(item_area, region_area)
    if denominator <= 0:
        return None
    return overlap_area / denominator


def compact_dict(item: Dict[str, Any], keys: List[str]) -> Dict[str, Any]:
    compact: Dict[str, Any] = {}
    for key in keys:
        value = item.get(key)
        if value is None or value == "" or value == []:
            continue
        compact[key] = value
    return compact


def limit_items(items: List[Dict[str, Any]], limit: int = 12) -> List[Dict[str, Any]]:
    return items[: max(0, limit)]


def build_forensic_adopted_context(
    status: Dict[str, Any],
    *,
    time_start: float,
    time_end: float,
    region: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Collect already-known VAA1 evidence for a forensic render window."""

    source_metadata = status.get("source_media_metadata") or {}
    source_annotations = source_metadata.get("user_annotations") or {}
    corrections = build_annotation_corrections_payload(status)
    results = status.get("results") or {}
    visual = results.get("visual_analysis") or {}
    audio = results.get("audio_analysis") or {}
    transcript = audio.get("transcript") or {}
    audio_prosody = audio.get("audio_prosody") or {}

    manual_annotations: List[Dict[str, Any]] = []
    identity_refs: List[Dict[str, Any]] = []
    interaction_refs: List[Dict[str, Any]] = []
    role_refs: List[Dict[str, Any]] = []
    expression_refs: List[Dict[str, Any]] = []
    object_track_refs: List[Dict[str, Any]] = []
    transcript_refs: List[Dict[str, Any]] = []
    prosody_refs: List[Dict[str, Any]] = []
    ocr_refs: List[Dict[str, Any]] = []

    for entry in corrections.get("manual_visual_annotations", []) or []:
        if not isinstance(entry, dict):
            continue
        start = entry.get("start_seconds", entry.get("timestamp_seconds"))
        end = entry.get("end_seconds", entry.get("timestamp_seconds"))
        if not intervals_overlap(start, end, time_start, time_end):
            continue

        compact = compact_dict(
            entry,
            [
                "id",
                "category",
                "subcategory",
                "label",
                "custom_label",
                "timestamp_seconds",
                "start_seconds",
                "end_seconds",
                "identity_affirmation",
                "role_affirmation",
                "open_note",
                "teaches_regime",
            ],
        )
        manual_annotations.append(compact)
        category = entry.get("category")
        if category == "Identification" or entry.get("identity_affirmation"):
            identity_refs.append(compact)
        if category == "Interaction":
            interaction_refs.append(compact)
        if category == "Role" or entry.get("role_affirmation"):
            role_refs.append(compact)

    for entry in visual.get("expression_results", []) or []:
        if not isinstance(entry, dict) or not point_in_window(entry.get("timestamp"), time_start, time_end):
            continue
        expression_refs.append(
            compact_dict(
                entry,
                [
                    "frame_index",
                    "timestamp",
                    "face_id",
                    "dominant_emotion",
                    "emotion",
                    "top_emotion_score",
                    "score_margin",
                    "quality",
                    "bbox",
                    "face_signal",
                    "expression_evidence",
                    "affect_hints",
                    "detector",
                    "error",
                ],
            )
        )

    for entry in visual.get("tracked_objects", []) or []:
        if not isinstance(entry, dict):
            continue
        start = entry.get("start_timestamp", entry.get("timestamp"))
        end = entry.get("end_timestamp", entry.get("timestamp"))
        if not intervals_overlap(start, end, time_start, time_end):
            continue
        raw_label = entry.get("class_name") or entry.get("raw_class_name") or "object"
        enriched_label = entry.get("display_label") or raw_label
        region_overlap = bbox_region_overlap(entry, region)
        if region and region_overlap is not None and region_overlap <= 0:
            continue
        object_track_refs.append(
            {
                **compact_dict(
                    entry,
                    [
                        "track_id",
                        "timestamp",
                        "start_timestamp",
                        "end_timestamp",
                        "class_id",
                        "class_name",
                        "confidence",
                        "bbox_x1",
                        "bbox_y1",
                        "bbox_x2",
                        "bbox_y2",
                        "occurrence_count",
                    ],
                ),
                "raw_label": raw_label,
                "enriched_label": enriched_label,
                "region_overlap": region_overlap,
            }
        )

    for entry in visual.get("ocr_results", []) or []:
        if not isinstance(entry, dict) or not point_in_window(entry.get("timestamp"), time_start, time_end):
            continue
        ocr_refs.append(compact_dict(entry, ["timestamp", "text", "confidence", "bbox"]))

    for entry in transcript.get("timeline_segments") or transcript.get("segments") or []:
        if not isinstance(entry, dict):
            continue
        if not intervals_overlap(entry.get("start"), entry.get("end"), time_start, time_end):
            continue
        transcript_refs.append(compact_dict(entry, ["id", "start", "end", "text", "speaker"]))

    for entry in audio_prosody.get("cues", []) or []:
        if not isinstance(entry, dict):
            continue
        if not intervals_overlap(entry.get("start"), entry.get("end"), time_start, time_end):
            continue
        prosody_refs.append(entry)

    metadata_refs = {
        "title": source_annotations.get("title"),
        "source_context": source_annotations.get("source_context"),
        "persons": source_annotations.get("persons") or [],
        "character_roles": source_annotations.get("character_roles") or [],
        "character_definitions": source_annotations.get("character_definitions") or [],
        "narrative_agent_profiles": source_annotations.get("narrative_agent_profiles") or [],
        "relations": source_annotations.get("relations"),
        "situation_event": source_annotations.get("situation_event"),
        "interaction_dynamics": source_annotations.get("interaction_dynamics"),
        "narrative_development": source_annotations.get("narrative_development"),
        "performance_expression": source_annotations.get("performance_expression"),
        "genre": source_annotations.get("genre"),
        "genre_subtype": source_annotations.get("genre_subtype"),
        "situational_genre": source_annotations.get("situational_genre"),
        "situational_subtype": source_annotations.get("situational_subtype"),
        "confidence": source_annotations.get("confidence"),
        "notes": source_annotations.get("notes"),
    }

    active_identity_labels = [
        value
        for item in identity_refs
        for value in [
            item.get("identity_affirmation"),
            item.get("custom_label"),
            item.get("label"),
        ]
        if value
    ]
    active_role_labels = [
        value
        for item in role_refs
        for value in [item.get("role_affirmation"), item.get("custom_label"), item.get("label")]
        if value
    ]

    return {
        "time_window": {
            "time_start": time_start,
            "time_end": time_end,
            "region": region,
        },
        "metadata_refs": metadata_refs,
        "manual_annotation_refs": limit_items(manual_annotations),
        "identity_refs": limit_items(identity_refs),
        "interaction_refs": limit_items(interaction_refs),
        "role_refs": limit_items(role_refs),
        "expression_refs": limit_items(expression_refs),
        "object_track_refs": limit_items(object_track_refs),
        "transcript_refs": limit_items(transcript_refs),
        "prosody_refs": limit_items(prosody_refs),
        "ocr_refs": limit_items(ocr_refs),
        "summary": {
            "manual_annotations": len(manual_annotations),
            "identities": len(identity_refs),
            "interactions": len(interaction_refs),
            "roles": len(role_refs),
            "expressions": len(expression_refs),
            "object_tracks": len(object_track_refs),
            "transcript_segments": len(transcript_refs),
            "prosody_cues": len(prosody_refs),
            "ocr_cues": len(ocr_refs),
            "active_identity_labels": sorted(set(map(str, active_identity_labels))),
            "active_role_labels": sorted(set(map(str, active_role_labels))),
        },
        "notes": [
            "Adopted context preserves existing VAA1 metadata, annotations, and detections for the forensic render window.",
            "Raw detector labels remain separate from enriched identity or role labels.",
        ],
    }


def build_cvat_label_lookup(task_payload: Dict[str, Any]) -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    for label in task_payload.get("labels", []) or []:
        label_id = safe_int(label.get("id"))
        label_name = normalize_taxonomy_label(label.get("name"))
        if label_id is None or not label_name:
            continue
        lookup[str(label_id)] = label_name
    return lookup


def build_interval_from_frames(
    start_frame: Optional[int],
    end_frame: Optional[int],
    fps: Optional[float],
) -> Dict[str, Any]:
    safe_start = max(0, start_frame or 0)
    safe_end = max(safe_start, end_frame if end_frame is not None else safe_start)
    effective_fps = fps if fps and fps > 0 else None
    return {
        "start_seconds": round(safe_start / effective_fps, 6) if effective_fps else float(safe_start),
        "end_seconds": round(safe_end / effective_fps, 6) if effective_fps else float(safe_end),
        "start_frame": safe_start,
        "end_frame": safe_end,
    }


def build_geometry_from_cvat_shape(shape: Dict[str, Any]) -> Dict[str, Any]:
    points = shape.get("points") or []
    shape_type = str(shape.get("type") or "unknown")
    geometry: Dict[str, Any] = {
        "shape_type": shape_type if shape_type else "unknown",
        "points": points if isinstance(points, list) else [],
        "x": None,
        "y": None,
        "width": None,
        "height": None,
        "rotation": safe_float(shape.get("rotation")),
    }

    if geometry["shape_type"] == "rectangle" and isinstance(points, list) and len(points) >= 4:
        x1, y1, x2, y2 = points[:4]
        geometry["x"] = round(float(x1), 3)
        geometry["y"] = round(float(y1), 3)
        geometry["width"] = round(float(x2) - float(x1), 3)
        geometry["height"] = round(float(y2) - float(y1), 3)
    elif geometry["shape_type"] == "ellipse" and isinstance(points, list) and len(points) >= 4:
        x1, y1, x2, y2 = points[:4]
        geometry["x"] = round(float(x1), 3)
        geometry["y"] = round(float(y1), 3)
        geometry["width"] = round(float(x2) - float(x1), 3)
        geometry["height"] = round(float(y2) - float(y1), 3)

    return geometry


def build_attributes_from_cvat(item: Dict[str, Any]) -> Dict[str, Any]:
    attributes: Dict[str, Any] = {}
    for attribute in item.get("attributes", []) or []:
        spec_id = attribute.get("spec_id")
        value = attribute.get("value")
        key = f"spec_{spec_id}" if spec_id not in {None, ""} else f"attribute_{len(attributes) + 1}"
        attributes[key] = value
    return attributes


def build_provenance(
    *,
    source_system: str,
    source_type: str,
    created_by: str,
    note: str,
) -> Dict[str, Any]:
    return {
        "source_system": source_system,
        "source_type": source_type,
        "created_by": created_by,
        "created_at": utc_now_iso(),
        "note": note,
    }


def build_vaa1_master_schema_from_cvat(
    *,
    analysis_id: str,
    status: Dict[str, Any],
    task_id: int,
    job_id: int,
    cvat_annotations: Dict[str, Any],
    label_lookup: Dict[str, str],
) -> Dict[str, Any]:
    user_annotations = status.get("source_media_annotations") or {}
    source_metadata = status.get("source_media_metadata") or {}
    fps = safe_float(source_metadata.get("fps"))
    object_annotations: List[Dict[str, Any]] = []
    track_annotations: List[Dict[str, Any]] = []
    temporal_segments: List[Dict[str, Any]] = []
    unresolved_labels: List[str] = []

    def resolve_label(item: Dict[str, Any]) -> str:
        label_id = item.get("label_id")
        if label_id is None:
            unresolved_labels.append("unknown")
            return "unknown"
        resolved = label_lookup.get(str(label_id))
        if not resolved:
            unresolved_labels.append(str(label_id))
            return f"label_{label_id}"
        return resolved

    for index, shape in enumerate(cvat_annotations.get("shapes", []) or []):
        frame = safe_int(shape.get("frame")) or 0
        raw_label = resolve_label(shape)
        object_annotations.append(
            {
                "annotation_id": f"obj-{index + 1:04d}",
                "track_id": None,
                "label_mapping": {
                    "raw_label": raw_label,
                    "mapped_label": normalize_object_label(raw_label),
                    "mapping_family": "object",
                    "mapping_confidence": 1.0,
                    "mapping_status": "direct",
                },
                "interval": build_interval_from_frames(frame, frame, fps),
                "geometry": build_geometry_from_cvat_shape(shape),
                "attributes": build_attributes_from_cvat(shape),
                "provenance": build_provenance(
                    source_system="cvat",
                    source_type="raw_export",
                    created_by="cvat-job-sync",
                    note=f"Imported from CVAT job {job_id} shape.",
                ),
            }
        )

    for index, track in enumerate(cvat_annotations.get("tracks", []) or []):
        raw_label = resolve_label(track)
        track_shapes = track.get("shapes", []) or []
        track_frames = [
            safe_int(track_shape.get("frame"))
            for track_shape in track_shapes
            if safe_int(track_shape.get("frame")) is not None
        ]
        start_frame = min(track_frames) if track_frames else 0
        end_frame = max(track_frames) if track_frames else start_frame
        track_id = f"track-{safe_int(track.get('id')) or index + 1}"
        track_annotations.append(
            {
                "track_id": track_id,
                "label_mapping": {
                    "raw_label": raw_label,
                    "mapped_label": normalize_object_label(raw_label),
                    "mapping_family": "track",
                    "mapping_confidence": 1.0,
                    "mapping_status": "direct",
                },
                "interval": build_interval_from_frames(start_frame, end_frame, fps),
                "frame_count": len(track_shapes),
                "attributes": build_attributes_from_cvat(track),
                "provenance": build_provenance(
                    source_system="cvat",
                    source_type="raw_export",
                    created_by="cvat-job-sync",
                    note=f"Imported from CVAT job {job_id} track.",
                ),
            }
        )

        temporal_segments.append(
            {
                "segment_id": f"seg-{index + 1:04d}",
                "interval": build_interval_from_frames(start_frame, end_frame, fps),
                "event_label": f"{normalize_object_label(raw_label)}_presence",
                "event_family": "cvat_track_presence",
                "confidence": 1.0,
                "note": f"Derived from CVAT track interval for {raw_label}.",
                "provenance": build_provenance(
                    source_system="automated_mapping",
                    source_type="mapped",
                    created_by="vaa1-cvat-mapper",
                    note=f"Derived from CVAT job {job_id} track interval.",
                ),
            }
        )

        for shape_index, track_shape in enumerate(track_shapes):
            frame = safe_int(track_shape.get("frame")) or 0
            object_annotations.append(
                {
                    "annotation_id": f"{track_id}-obj-{shape_index + 1:04d}",
                    "track_id": track_id,
                    "label_mapping": {
                        "raw_label": raw_label,
                        "mapped_label": normalize_object_label(raw_label),
                        "mapping_family": "object",
                        "mapping_confidence": 1.0,
                        "mapping_status": "direct",
                    },
                    "interval": build_interval_from_frames(frame, frame, fps),
                    "geometry": build_geometry_from_cvat_shape(track_shape),
                    "attributes": build_attributes_from_cvat(track_shape),
                    "provenance": build_provenance(
                        source_system="cvat",
                        source_type="raw_export",
                        created_by="cvat-job-sync",
                        note=f"Imported from CVAT job {job_id} track shape.",
                    ),
                }
            )

    if not any(is_scene_temporal_segment(segment) for segment in temporal_segments):
        temporal_segments.extend(build_master_schema_scene_temporal_segments(status))
    temporal_segments = merge_master_schema_temporal_segments(
        temporal_segments,
        build_master_schema_audio_event_temporal_segments(status),
        build_master_schema_speaker_diarization_temporal_segments(status),
        build_master_schema_shot_boundary_temporal_segments(status),
        build_master_schema_music_lyric_temporal_segments(status),
    )

    genre_annotations: List[Dict[str, Any]] = []
    if normalize_taxonomy_label(user_annotations.get("genre")):
        genre_annotations.append(
            {
                "annotation_id": "genre-primary-0001",
                "genre_label": normalize_taxonomy_label(user_annotations.get("genre")),
                "genre_subtype": normalize_taxonomy_label(user_annotations.get("genre_subtype")),
                "annotation_level": "primary",
                "weight": 1.0,
                "scope": "whole_media",
                "interval": None,
                "evidence_basis": ["source_media_annotations"],
                "note": "Imported from VAA1 source media metadata.",
                "provenance": build_provenance(
                    source_system="vaa1",
                    source_type="manual_entry",
                    created_by="analyst",
                    note="Source media metadata snapshot.",
                ),
            }
        )

    if normalize_taxonomy_label(user_annotations.get("situational_genre")):
        genre_annotations.append(
            {
                "annotation_id": "genre-situational-0001",
                "genre_label": normalize_taxonomy_label(user_annotations.get("situational_genre")),
                "genre_subtype": normalize_taxonomy_label(user_annotations.get("situational_subtype")),
                "annotation_level": "situational",
                "weight": 1.0,
                "scope": "whole_media",
                "interval": None,
                "evidence_basis": ["source_media_annotations"],
                "note": "Imported from VAA1 source media metadata.",
                "provenance": build_provenance(
                    source_system="vaa1",
                    source_type="manual_entry",
                    created_by="analyst",
                    note="Source media metadata snapshot.",
                ),
            }
        )

    character_role_annotations: List[Dict[str, Any]] = []
    character_definition_annotations: List[Dict[str, Any]] = []
    narrative_agent_profile_annotations: List[Dict[str, Any]] = []
    narrative_agent_profile_governance = dict(NARRATIVE_AGENT_PROFILE_GOVERNANCE)
    for index, role_text in enumerate(user_annotations.get("character_roles") or []):
        normalized_role = clean_source_label(role_text)
        if not normalized_role:
            continue
        character_role_annotations.append(
            {
                "annotation_id": f"character-role-{index + 1:04d}",
                "label": normalized_role,
                "annotation_level": "source_media",
                "scope": "whole_media",
                "interval": None,
                "evidence_basis": ["source_media_annotations.character_roles"],
                "maturity_route": "master_schema.source_media_character_role_maturity",
                "provenance": build_provenance(
                    source_system="vaa1",
                    source_type="mature_metadata",
                    created_by="analyst_or_metadata_harvest",
                    note="Character/actor role description routed from Source Media metadata.",
                ),
            }
        )
    for index, profile in enumerate(user_annotations.get("narrative_agent_profiles") or []):
        if not isinstance(profile, dict):
            continue
        agent_name = clean_source_label(profile.get("narrative_agent_name"))
        if not agent_name:
            continue
        narrative_agent_profile_annotations.append(
            {
                "annotation_id": f"narrative-agent-profile-{index + 1:04d}",
                "profile_id": clean_source_label(profile.get("profile_id")) or f"narrative-agent-profile-{index + 1:04d}",
                "profile_type": "Narrative Agent Profile",
                "narrative_agent_name": agent_name,
                "aliases": profile.get("aliases") if isinstance(profile.get("aliases"), list) else [],
                "attached_performer_metadata": profile.get("attached_performer_metadata") if isinstance(profile.get("attached_performer_metadata"), dict) else {},
                "source_metadata": profile.get("source_metadata") if isinstance(profile.get("source_metadata"), dict) else {},
                "evidence_slots": profile.get("evidence_slots") if isinstance(profile.get("evidence_slots"), dict) else {},
                "dramaturgical_tendencies": profile.get("dramaturgical_tendencies") if isinstance(profile.get("dramaturgical_tendencies"), list) else [],
                "interpretive_readings": profile.get("interpretive_readings") if isinstance(profile.get("interpretive_readings"), list) else [],
                "profile_extensions": profile.get("profile_extensions") if isinstance(profile.get("profile_extensions"), list) else [],
                "profile_governance": profile.get("profile_governance") if isinstance(profile.get("profile_governance"), dict) else narrative_agent_profile_governance,
                "constituent_evidence": profile.get("constituent_evidence") if isinstance(profile.get("constituent_evidence"), dict) else {},
                "annotation_level": "source_media",
                "scope": "whole_media",
                "interval": None,
                "evidence_basis": ["source_media_annotations.narrative_agent_profiles"],
                "maturity_route": "master_schema.source_media_narrative_agent_profile_maturity",
                "provenance": build_provenance(
                    source_system="vaa1",
                    source_type="mature_metadata",
                    created_by="analyst_or_metadata_harvest",
                    note="Narrative Agent Profile container routed from Source Media metadata.",
                ),
            }
        )
    for index, definition in enumerate(user_annotations.get("character_definitions") or []):
        if not isinstance(definition, dict):
            continue
        character_name = clean_source_label(definition.get("character_name"))
        actor_name = clean_source_label(definition.get("actor_name"))
        if not character_name and not actor_name:
            continue
        character_definition_annotations.append(
            {
                "annotation_id": f"character-definition-{index + 1:04d}",
                "character_name": character_name,
                "actor_name": actor_name,
                "aliases": definition.get("aliases") if isinstance(definition.get("aliases"), list) else [],
                "role_labels": definition.get("role_labels") if isinstance(definition.get("role_labels"), list) else [],
                "role_description": clean_source_label(definition.get("role_description")),
                "relations": definition.get("relations") if isinstance(definition.get("relations"), list) else [],
                "profile_governance": definition.get("profile_governance") if isinstance(definition.get("profile_governance"), dict) else narrative_agent_profile_governance,
                "constituent_evidence": definition.get("constituent_evidence") if isinstance(definition.get("constituent_evidence"), dict) else {},
                "annotation_level": "source_media",
                "scope": "whole_media",
                "interval": None,
                "evidence_basis": ["source_media_annotations.character_definitions"],
                "maturity_route": "master_schema.source_media_character_definition_maturity",
                "provenance": build_provenance(
                    source_system="vaa1",
                    source_type="mature_metadata",
                    created_by="analyst_or_metadata_harvest",
                    note="Structured character definition routed from Source Media metadata.",
                ),
            }
        )

    master_schema_payload = {
        "analysis_id": analysis_id,
        "exchange_protocol_version": "1.0",
        "vaa1_schema_version": "1.0",
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "linkage": {
            "analysis_id": analysis_id,
            "cvat_task_id": task_id,
            "cvat_job_id": job_id,
        },
        "source_context_snapshot": {
            "title": user_annotations.get("title", ""),
            "scope": user_annotations.get("scope", ""),
            "description": user_annotations.get("description", ""),
            "persons": user_annotations.get("persons", []),
            "character_roles": user_annotations.get("character_roles", []),
            "character_definitions": user_annotations.get("character_definitions", []),
            "narrative_agent_profiles": user_annotations.get("narrative_agent_profiles", []),
            "relations": user_annotations.get("relations", ""),
            "location_country": user_annotations.get("location_country", ""),
            "location_city": user_annotations.get("location_city", ""),
            "location_place": user_annotations.get("location_place", ""),
            "location_room": user_annotations.get("location_room", ""),
            "time_era": user_annotations.get("time_era", ""),
            "time_year": user_annotations.get("time_year", ""),
            "time_moment": user_annotations.get("time_moment", ""),
            "situation_event": user_annotations.get("situation_event", ""),
            "keywords": user_annotations.get("keywords", []),
            "interaction_dynamics": user_annotations.get("interaction_dynamics", ""),
            "narrative_development": user_annotations.get("narrative_development", ""),
            "performance_expression": user_annotations.get("performance_expression", ""),
            "genre": user_annotations.get("genre", ""),
            "genre_subtype": user_annotations.get("genre_subtype", ""),
            "situational_genre": user_annotations.get("situational_genre", ""),
            "situational_subtype": user_annotations.get("situational_subtype", ""),
            "privacy_axis": user_annotations.get("privacy_axis", ""),
            "expertise_axis": user_annotations.get("expertise_axis", ""),
            "references": user_annotations.get("references", []),
            "reference_speakers": user_annotations.get("reference_speakers", []),
            "reference_relation": user_annotations.get("reference_relation", ""),
            "reference_source": user_annotations.get("reference_source", ""),
            "expected_identities": user_annotations.get("expected_identities", []),
            "confidence": user_annotations.get("confidence", ""),
            "notes": user_annotations.get("notes", ""),
        },
        "raw_import_reference": {
            "export_format": "CVAT JSON",
            "exported_at": utc_now_iso(),
            "artifact_path": "",
            "artifact_sha256": "",
            "artifact_media_type": "application/json",
            "import_status": "mapped",
        },
        "narrative_agent_profile_governance": narrative_agent_profile_governance,
        "scene_constellation_governance": {},
        "genre_annotations": genre_annotations,
        "character_role_annotations": character_role_annotations,
        "character_definition_annotations": character_definition_annotations,
        "narrative_agent_profile_annotations": narrative_agent_profile_annotations,
        "cinematic_cues": {},
        "object_annotations": object_annotations,
        "track_annotations": track_annotations,
        "temporal_segments": temporal_segments,
        "foundational_source_layers": build_master_schema_foundational_source_layers(
            status,
            temporal_segments=temporal_segments,
        ),
        "expression_annotations": [],
        "review_layer": {
            "status": "unreviewed",
            "annotation_corrections": build_annotation_corrections_payload(status),
        },
        "mapping_notes": [
            "Initial CVAT-to-VAA1 ingest slice maps raw CVAT shapes and tracks into object and track annotations.",
            "Genre and situational context are currently copied from VAA1 source media metadata.",
        ],
        "validation": {
            "is_valid": True,
            "validated_at": utc_now_iso(),
            "errors": [],
            "warnings": [
                "Expression annotations and cinematic cues are not derived in this first ingest slice.",
            ],
            "unresolved_labels": sorted(set(unresolved_labels)),
        },
    }
    master_schema_payload["scene_constellation_governance"] = build_scene_constellation_governance(
        status=status,
        master_schema_payload=master_schema_payload,
    )
    master_schema_payload["master_schema_maturity_audit"] = build_master_schema_maturity_audit(
        status=status,
        master_schema_payload=master_schema_payload,
    )
    return master_schema_payload


def build_scene_constellation_governance(
    *,
    status: Dict[str, Any],
    master_schema_payload: Dict[str, Any],
) -> Dict[str, Any]:
    """Name the different scene layers so panels do not present rival counts as one truth."""

    summary = status.get("summary") if isinstance(status.get("summary"), dict) else {}
    formal_segments = (
        ((summary.get("scene_segments") or {}).get("segments") or [])
        if isinstance(summary.get("scene_segments"), dict)
        else []
    )
    scene_card_status = status.get("mise_en_scene_scene_cards") if isinstance(status.get("mise_en_scene_scene_cards"), dict) else {}
    second_order = status.get("second_order_label_proliferation") if isinstance(status.get("second_order_label_proliferation"), dict) else {}
    instructions = second_order.get("instructions") if isinstance(second_order.get("instructions"), list) else []
    temporal_segments = [
        segment
        for segment in (master_schema_payload.get("temporal_segments") or [])
        if is_scene_temporal_segment(segment)
    ]
    return {
        "schema": "vaa1.scene_constellation_governance.v1",
        "authority": "Master Schema",
        "principle": (
            "Scene counts are layer-specific. Formal media segmentation, Master Schema temporal "
            "segments, mise-en-scene Scene Cards, and meaning/plot interpretive windows remain "
            "linked but must not be collapsed into one counter."
        ),
        "attendee_boundary_rule": {
            "status": "active",
            "principle": (
                "Scene boundaries may be distinguished by who attends, enters, exits, disappears, "
                "reappears, speaks, or becomes narratively salient. Narrative Agent Profiles, track "
                "presence, transcript speakers, expression samples, and agent sample-profile "
                "persistence are valid evidence for interpreting and correcting scene boundaries."
            ),
            "consulted_surfaces": [
                "narrative_agent_profile_annotations",
                "character_definition_annotations",
                "track_annotations",
                "temporal_segments",
                "second_order_label_proliferation.agent_persistence_scene_cut",
                "transcript speakers",
                "expression annotations",
            ],
            "analyst_control": (
                "Attendee-based scene boundary candidates remain reviewable and correctable before "
                "they mature into Master Schema temporal segments."
            ),
        },
        "layers": [
            {
                "layer_id": "formal_media_scene_segments",
                "label": "Formal media scene segments",
                "count": len(formal_segments),
                "authority": "motion_scene_basis",
                "source": "summary.scene_segments",
                "status": "available" if formal_segments else "pending",
            },
            {
                "layer_id": "master_schema_temporal_segments",
                "label": "Master Schema temporal segments",
                "count": len(temporal_segments),
                "authority": "Master Schema",
                "source": "vaa1_annotation_master_schema.temporal_segments",
                "status": "available" if temporal_segments else "pending",
            },
            {
                "layer_id": "mise_en_scene_scene_cards",
                "label": "Mise-en-scene Scene Cards",
                "count": safe_int(scene_card_status.get("scene_card_count")) or 0,
                "authority": "Scene Cards",
                "source": "mise_en_scene_scene_cards",
                "status": "available" if safe_int(scene_card_status.get("scene_card_count")) else "pending",
            },
            {
                "layer_id": "meaning_plot_interpretive_windows",
                "label": "Meaning / Plot interpretive windows",
                "count": len(instructions),
                "authority": "second_order_label_proliferation",
                "source": "second_order_label_proliferation.instructions",
                "status": "available" if instructions else "pending",
            },
        ],
        "routing_rule": (
            "Panels must name which layer they are showing. Interpretive lenses may regroup "
            "evidence, but the formal media scene count remains governed by Master Schema."
        ),
        "updated_at": utc_now_iso(),
    }


def refresh_master_schema_metadata_surfaces(status: Dict[str, Any]) -> None:
    """Refresh Master Schema metadata surfaces after Source Media metadata changes."""

    analysis_id = str(status.get("analysis_id") or status.get("id") or "").strip()
    if not analysis_id:
        return
    analysis_dir = RESULTS_DIR / analysis_id
    internal_artifacts = status.setdefault("internal_artifacts", {})
    master_path = Path(
        str(internal_artifacts.get("vaa1_annotation_master_schema") or analysis_dir / "vaa1_annotation_master_schema.json")
    )
    existing = status.get("vaa1_annotation_master_schema") if isinstance(status.get("vaa1_annotation_master_schema"), dict) else {}
    if not existing and master_path.exists():
        try:
            existing = json.loads(master_path.read_text(encoding="utf-8"))
        except Exception:
            existing = {}

    linkage = existing.get("linkage") if isinstance(existing.get("linkage"), dict) else {}
    scaffold = build_vaa1_master_schema_from_cvat(
        analysis_id=analysis_id,
        status=status,
        task_id=safe_int(linkage.get("cvat_task_id")) or safe_int(status.get("cvatID")) or 0,
        job_id=safe_int(linkage.get("cvat_job_id")) or safe_int((status.get("cvat_ingest") or {}).get("job_id")) or 0,
        cvat_annotations={"shapes": [], "tracks": []},
        label_lookup={},
    )

    existing_temporal_segments = existing.get("temporal_segments") if isinstance(existing.get("temporal_segments"), list) else []
    scaffold_temporal_segments = scaffold.get("temporal_segments") if isinstance(scaffold.get("temporal_segments"), list) else []
    if any(is_scene_temporal_segment(segment) for segment in existing_temporal_segments):
        temporal_segments = existing_temporal_segments
    else:
        temporal_segments = [
            *existing_temporal_segments,
            *[
                segment
                for segment in scaffold_temporal_segments
                if is_scene_temporal_segment(segment)
            ],
        ]
    temporal_segments = merge_master_schema_temporal_segments(
        temporal_segments,
        build_master_schema_audio_event_temporal_segments(status),
        build_master_schema_speaker_diarization_temporal_segments(status),
        build_master_schema_shot_boundary_temporal_segments(status),
        build_master_schema_music_lyric_temporal_segments(status),
    )

    merged = {
        **scaffold,
        **existing,
        "updated_at": utc_now_iso(),
        "source_context_snapshot": scaffold.get("source_context_snapshot", {}),
        "narrative_agent_profile_governance": scaffold.get("narrative_agent_profile_governance", {}),
        "genre_annotations": scaffold.get("genre_annotations", []),
        "character_role_annotations": scaffold.get("character_role_annotations", []),
        "character_definition_annotations": scaffold.get("character_definition_annotations", []),
        "narrative_agent_profile_annotations": scaffold.get("narrative_agent_profile_annotations", []),
        "temporal_segments": temporal_segments,
        "foundational_source_layers": build_master_schema_foundational_source_layers(
            status,
            temporal_segments=temporal_segments,
        ),
    }
    merged["scene_constellation_governance"] = build_scene_constellation_governance(
        status=status,
        master_schema_payload=merged,
    )
    merged["master_schema_maturity_audit"] = build_master_schema_maturity_audit(
        status=status,
        master_schema_payload=merged,
    )
    master_path.parent.mkdir(parents=True, exist_ok=True)
    master_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
    internal_artifacts["vaa1_annotation_master_schema"] = str(master_path)
    status["vaa1_annotation_master_schema"] = merged


MASTER_SCHEMA_AUTHORITY_ORDER = [
    "manual_correction",
    "manual_annotation",
    "mature_triangulated_or_proliferated",
    "interpreted_automatic_detection",
    "raw_detection",
]


def build_master_schema_maturity_audit(
    *,
    status: Dict[str, Any],
    master_schema_payload: Dict[str, Any],
) -> Dict[str, Any]:
    """Summarize how mature-data producers and panel consumers relate to Master Schema.

    This is an acid-test artifact, not a second core. The Master Schema remains
    the mature coordination layer; this audit makes coverage and bypass risk
    explicit so maturation work can be hardened systematically.
    """

    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    internal_artifacts = status.get("internal_artifacts") if isinstance(status.get("internal_artifacts"), dict) else {}
    source_metadata = status.get("source_media_metadata") if isinstance(status.get("source_media_metadata"), dict) else {}
    source_annotations = status.get("source_media_annotations") if isinstance(status.get("source_media_annotations"), dict) else {}
    results = status.get("results") if isinstance(status.get("results"), dict) else {}

    producers = [
        {
            "producer": "source_media_metadata",
            "status": "active" if source_metadata or source_annotations else "missing",
            "master_schema_surface": "source_context_snapshot",
            "maturity_route": "source_media.metadata_maturity",
        },
        {
            "producer": "web_metadata_sources",
            "status": "active" if status.get("source_media_web_metadata_sources") else "missing",
            "master_schema_surface": "character_role_annotations / character_definition_annotations / narrative_agent_profile_annotations",
            "maturity_route": "master_schema.source_media_web_metadata_maturity",
        },
        {
            "producer": "narrative_agent_profiles",
            "status": "active" if master_schema_payload.get("narrative_agent_profile_annotations") else "missing",
            "master_schema_surface": "narrative_agent_profile_annotations",
            "maturity_route": "master_schema.source_media_narrative_agent_profile_maturity",
        },
        {
            "producer": "cvat_manual_annotations",
            "status": "active" if master_schema_payload.get("object_annotations") or master_schema_payload.get("track_annotations") else "missing",
            "master_schema_surface": "object_annotations / track_annotations / temporal_segments",
            "maturity_route": "master_schema.cvat_annotation_ingest",
        },
        {
            "producer": "linked_transcript",
            "status": "active" if output_files.get("linked_transcript") or internal_artifacts.get("linked_transcript") else "missing",
            "master_schema_surface": "pending_resolved_transcript_refs",
            "maturity_route": "master_schema.linked_transcript_maturity",
        },
        {
            "producer": "scene_cards",
            "status": "active" if internal_artifacts.get("mise_en_scene_scene_cards") or output_files.get("scene_cards") else "missing",
            "master_schema_surface": "pending_scene_card_refs",
            "maturity_route": "master_schema.scene_card_maturity",
        },
        {
            "producer": "audio_event_intervals",
            "status": "active" if output_files.get("audio_event_intervals") or any(
                segment.get("event_family") == "audio_event_interval"
                for segment in master_schema_payload.get("temporal_segments", []) or []
                if isinstance(segment, dict)
            ) else "missing",
            "master_schema_surface": "temporal_segments[event_family=audio_event_interval]",
            "maturity_route": "master_schema.audio_event_interval_maturity",
        },
        {
            "producer": "audio_diarization",
            "status": "active" if output_files.get("audio_diarization") or any(
                segment.get("event_family") == "speaker_diarization_turn"
                for segment in master_schema_payload.get("temporal_segments", []) or []
                if isinstance(segment, dict)
            ) else "missing",
            "master_schema_surface": "temporal_segments[event_family=speaker_diarization_turn]",
            "maturity_route": "master_schema.speaker_diarization_maturity",
        },
        {
            "producer": "shot_boundary_intervals",
            "status": "active" if any(
                segment.get("event_family") == "shot_boundary_interval"
                for segment in master_schema_payload.get("temporal_segments", []) or []
                if isinstance(segment, dict)
            ) else "missing",
            "master_schema_surface": "temporal_segments[event_family=shot_boundary_interval]",
            "maturity_route": "master_schema.true_shot_boundary_interval_maturity",
        },
        {
            "producer": "music_lyrics_analysis",
            "status": "active" if any(
                segment.get("event_family") in {"music_analysis", "lyric_transcript_match"}
                for segment in master_schema_payload.get("temporal_segments", []) or []
                if isinstance(segment, dict)
            ) else "missing",
            "master_schema_surface": "temporal_segments[event_family=music_analysis|lyric_transcript_match]",
            "maturity_route": "master_schema.music_lyrics_maturity",
        },
        {
            "producer": "identity_refinement",
            "status": "active" if status.get("identity_refinement") or internal_artifacts.get("identity_refinement_candidates") else "missing",
            "master_schema_surface": "review_layer.annotation_corrections / identity candidate ledgers",
            "maturity_route": "master_schema.identity_refinement_maturity",
        },
        {
            "producer": "proliferation_candidates",
            "status": "active" if status.get("second_order_label_proliferation") or internal_artifacts.get("second_order_label_proliferation") else "missing",
            "master_schema_surface": "pending_candidate_evidence_refs",
            "maturity_route": "master_schema.proliferation_candidate_maturity",
        },
        {
            "producer": "interpretive_lens_readings",
            "status": "active" if status.get("narrative_lens_reading") or internal_artifacts.get("narrative_lens_reading") else "missing",
            "master_schema_surface": "pending_interpretive_lens_evidence_refs",
            "maturity_route": "master_schema.interpretive_lens_reading_maturity",
        },
        {
            "producer": "character_path_readings",
            "status": "active" if status.get("character_path_reading") or internal_artifacts.get("character_path_reading") else "missing",
            "master_schema_surface": "pending_narrative_agent_path_evidence_refs",
            "maturity_route": "master_schema.character_path_reading_maturity",
        },
        {
            "producer": "datascene_meaning_network",
            "status": "active" if status.get("datascene_meaning_network") or internal_artifacts.get("datascene_meaning_network") else "missing",
            "master_schema_surface": "pending_meaning_network_nodes_edges / scene-bounded character presence candidates",
            "maturity_route": "master_schema.datascene_meaning_network_maturity",
        },
        {
            "producer": "forensic_render_jobs",
            "status": "active" if status.get("forensic_render_jobs") else "missing",
            "master_schema_surface": "pending_forensic_artifact_refs",
            "maturity_route": "master_schema.forensic_traceback_maturity",
        },
        {
            "producer": "raw_analysis_results",
            "status": "active" if results else "missing",
            "master_schema_surface": "raw evidence preserved outside Master Schema until matured",
            "maturity_route": "raw_evidence_preservation",
        },
    ]

    mature_surfaces = {
        "source_context_snapshot": annotation_has_value(master_schema_payload.get("source_context_snapshot")),
        "genre_annotations": len(master_schema_payload.get("genre_annotations") or []),
        "object_annotations": len(master_schema_payload.get("object_annotations") or []),
        "track_annotations": len(master_schema_payload.get("track_annotations") or []),
        "temporal_segments": len(master_schema_payload.get("temporal_segments") or []),
        "audio_event_interval_segments": len([
            segment for segment in master_schema_payload.get("temporal_segments", []) or []
            if isinstance(segment, dict) and segment.get("event_family") == "audio_event_interval"
        ]),
        "speaker_diarization_turn_segments": len([
            segment for segment in master_schema_payload.get("temporal_segments", []) or []
            if isinstance(segment, dict) and segment.get("event_family") == "speaker_diarization_turn"
        ]),
        "shot_boundary_interval_segments": len([
            segment for segment in master_schema_payload.get("temporal_segments", []) or []
            if isinstance(segment, dict) and segment.get("event_family") == "shot_boundary_interval"
        ]),
        "music_analysis_segments": len([
            segment for segment in master_schema_payload.get("temporal_segments", []) or []
            if isinstance(segment, dict) and segment.get("event_family") == "music_analysis"
        ]),
        "lyric_transcript_match_segments": len([
            segment for segment in master_schema_payload.get("temporal_segments", []) or []
            if isinstance(segment, dict) and segment.get("event_family") == "lyric_transcript_match"
        ]),
        "character_role_annotations": len(master_schema_payload.get("character_role_annotations") or []),
        "character_definition_annotations": len(master_schema_payload.get("character_definition_annotations") or []),
        "narrative_agent_profile_annotations": len(master_schema_payload.get("narrative_agent_profile_annotations") or []),
        "review_layer_corrections": len(
            ((master_schema_payload.get("review_layer") or {}).get("annotation_corrections") or [])
            if isinstance(master_schema_payload.get("review_layer"), dict)
            else []
        ),
    }
    user_confirmed_anchor = {
        "principle": "User confirmed corrections and annotations are the anchor evidence for sense-making.",
        "authority_priority": ["panel_corrections", "bbox_roi_corrections", "metadata_corrections", "manual_annotations"],
        "anchor_surfaces": [
            {
                "surface": "panel_corrections",
                "status": "active" if mature_surfaces["review_layer_corrections"] else "pending",
                "route": "master_schema.review_layer.annotation_corrections",
            },
            {
                "surface": "bbox_roi_corrections",
                "status": "active" if mature_surfaces["object_annotations"] else "pending",
                "route": "master_schema.object_annotations / track_annotations",
            },
            {
                "surface": "metadata_corrections",
                "status": "active" if source_annotations else "pending",
                "route": "master_schema.source_context_snapshot",
            },
            {
                "surface": "narrative_agent_profiles",
                "status": "active" if mature_surfaces["narrative_agent_profile_annotations"] else "pending",
                "route": "master_schema.narrative_agent_profile_annotations",
            },
        ],
    }
    confirmation_program = {
        "purpose": "Use confirmed anchors to propose concise, program-wide pattern confirmations for broader maturity proliferation.",
        "confirmation_mode": "concise_analyst_confirmation",
        "confirmation_families": [
            "character_audio_trail_recognition",
            "character_visual_pattern_recognition",
            "language_name_place_text_confirmation",
            "narrative_structure_meaning_plot_confirmation",
            "mise_en_scene_level_understanding",
        ],
        "consults_user_confirmed_anchor": True,
        "proliferation_rule": (
            "Detected patterns should become wider mature claims only after consulting "
            "existing user confirmations and preserving traceback to the originating evidence."
        ),
    }
    panel_consumers = [
        {"panel": "VideoPanel BBox / ROIBox", "status": "must_consume_master_schema_first", "risk": "high"},
        {"panel": "SourceMediaMetadataPanel", "status": "partially_consumes_maturity", "risk": "medium"},
        {"panel": "SceneCardPanel", "status": "partially_consumes_master_schema", "risk": "medium"},
        {"panel": "Identification", "status": "partially_consumes_identity_ledgers", "risk": "medium"},
        {"panel": "MeaningPlotPanel", "status": "traceback_ready_but_not_master_schema_first", "risk": "medium"},
        {"panel": "TimeBankPanel", "status": "traceback_ready_but_not_master_schema_first", "risk": "medium"},
        {"panel": "Tools / Forensic", "status": "traceback_records_exist", "risk": "medium"},
        {"panel": "Reports / Export", "status": "must_consume_master_schema_first", "risk": "high"},
    ]
    missing_active_surfaces = [
        item["producer"]
        for item in producers
        if item["status"] == "missing" and item["producer"] not in {"raw_analysis_results"}
    ]
    bypass_risks = [item for item in panel_consumers if item["risk"] in {"high", "medium"}]

    return {
        "audit_schema": "vaa1.master_schema_maturity_audit.v1",
        "updated_at": utc_now_iso(),
        "principle": "Master Schema is the mature-data core; raw evidence remains preserved and traceable.",
        "authority_order": MASTER_SCHEMA_AUTHORITY_ORDER,
        "evidence_producers": producers,
        "mature_surfaces": mature_surfaces,
        "user_confirmed_anchor": user_confirmed_anchor,
        "confirmation_program": confirmation_program,
        "panel_consumers": panel_consumers,
        "bypass_risks": bypass_risks,
        "missing_active_surfaces": missing_active_surfaces,
        "next_required_hardening": [
            "make every panel consult user-confirmed anchor evidence before raw or inferred claims",
            "surface concise pattern confirmations for character audio trails, visual patterns, language/name/place/text, meaning/plot, and mise-en-scene",
            "make BBox/ROIBox consume Master Schema mature labels first",
            "add in-app traceback viewer for Master Schema evidence refs",
            "add tests proving mature Master Schema data supersedes raw panel data",
        ],
    }


def persist_cvat_ingest_artifacts(
    status: Dict[str, Any],
    *,
    job_id: int,
    raw_payload: Dict[str, Any],
    master_schema_payload: Dict[str, Any],
) -> Dict[str, str]:
    analysis_id = status.get("analysis_id")
    if not analysis_id:
        raise HTTPException(status_code=400, detail="Analysis record is missing analysis_id")

    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)

    raw_path = analysis_dir / f"cvat_raw_annotations_job_{job_id}.json"
    raw_path.write_text(
        json.dumps(raw_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    master_path = analysis_dir / "vaa1_annotation_master_schema.json"
    master_schema_payload["raw_import_reference"]["artifact_path"] = str(raw_path)
    master_path.write_text(
        json.dumps(master_schema_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    internal_artifacts = status.setdefault("internal_artifacts", {})
    internal_artifacts["cvat_raw_annotations_json"] = str(raw_path)
    internal_artifacts["vaa1_annotation_master_schema"] = str(master_path)
    status["vaa1_annotation_master_schema"] = master_schema_payload
    status["cvat_ingest"] = {
        "status": "mapped",
        "job_id": job_id,
        "mapped_at": utc_now_iso(),
        "object_annotation_count": len(master_schema_payload.get("object_annotations", [])),
        "track_annotation_count": len(master_schema_payload.get("track_annotations", [])),
    }
    return {
        "raw_path": str(raw_path),
        "master_path": str(master_path),
    }


def build_media_ref_for_status(status: Dict[str, Any]) -> MediaRef:
    source_video_path = status.get("source_video_path") or status.get("file_path") or ""
    source_filename = status.get("original_filename") or Path(source_video_path).name or "unknown"
    source_metadata = status.get("source_media_metadata") or {}
    media_id = status.get("analysis_id") or Path(source_filename).stem

    media_profile = MediaProfile(
        duration_ms=(
            int(round(float(source_metadata.get("duration_seconds", 0)) * 1000))
            if source_metadata.get("duration_seconds") not in {None, ""}
            else None
        ),
        width=source_metadata.get("width"),
        height=source_metadata.get("height"),
        frame_rate=source_metadata.get("fps"),
        rate_mode="unknown",
        codec=source_metadata.get("video_codec"),
        audio_codec=source_metadata.get("audio_codec"),
    )

    return MediaRef(
        media_id=media_id,
        source_uri=f"vaa1://media/{media_id}",
        source_filename=source_filename,
        source_hash=None,
        processing_profile_id=status.get("pipeline_type", "full"),
        media_profile=media_profile,
    )


def write_linked_transcript_artifact(
    status: Dict[str, Any],
    transcript: Dict[str, Any],
    output_files: Dict[str, str],
) -> Path:
    analysis_id = status.get("analysis_id")
    if not analysis_id:
        raise ValueError("Missing analysis_id for linked transcript artifact")

    transcript_path_raw = output_files.get("transcript")
    transcript_path = Path(transcript_path_raw) if transcript_path_raw else (TRANSCRIPTS_DIR / f"{analysis_id}_transcript.json")
    linked_path = transcript_path.with_name(f"{analysis_id}_linked_transcript.json")

    envelope = link_transcript_to_trace(
        transcript,
        build_media_ref_for_status(status),
        created_by="whisper_transcription",
        version="v1",
        support_level=((transcript.get("language_info") or {}).get("support") or {}).get("pos"),
    )
    linked_path.write_text(
        envelope.model_dump_json(indent=2),
        encoding="utf-8",
    )
    output_files["linked_transcript"] = str(linked_path)
    return linked_path


def write_time_bank_artifact(
    status: Dict[str, Any],
    output_files: Dict[str, str],
    *,
    source_key: str,
    artifact_key: str,
    suffix: str,
    linker,
) -> Optional[Path]:
    analysis_id = status.get("analysis_id")
    source_path_raw = output_files.get(source_key)
    if not analysis_id or not source_path_raw:
        return None

    source_path = Path(source_path_raw)
    if not source_path.exists():
        return None

    artifact_path = source_path.with_name(f"{analysis_id}_{suffix}.json")
    envelope = linker(source_path, build_media_ref_for_status(status))
    artifact_path.write_text(
        envelope.model_dump_json(indent=2),
        encoding="utf-8",
    )
    output_files[artifact_key] = str(artifact_path)
    return artifact_path


def ensure_live_mature_data_proliferation_audit_for_status(
    status: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    analysis_id = status.get("analysis_id")
    if not analysis_id:
        return None

    analysis_dir = RESULTS_DIR / str(analysis_id)
    audit_path = analysis_dir / "live_mature_data_proliferation_audit.json"
    output_files = status.setdefault("output_files", {})
    internal_artifacts = status.setdefault("internal_artifacts", {})

    summary = status.get("live_mature_data_proliferation_audit")
    summary_counts = summary.get("summary", {}) if isinstance(summary, dict) else {}
    if (
        summary
        and audit_path.exists()
        and "governed_mature_hypothesis_count" in summary_counts
        and "scanner_matcher_launch_request_count" in summary_counts
    ):
        output_files.setdefault("live_mature_data_proliferation_audit", str(audit_path))
        internal_artifacts.setdefault("live_mature_data_proliferation_audit", str(audit_path))
        return summary

    payload = write_live_mature_data_proliferation_audit(status, audit_path)
    auto_launched_matches = auto_launch_confirmation_need_scanner_requests(
        status,
        payload,
    )
    if auto_launched_matches:
        payload.setdefault("summary", {})[
            "auto_launched_scanner_match_count"
        ] = len(auto_launched_matches)
    output_files["live_mature_data_proliferation_audit"] = str(audit_path)
    internal_artifacts["live_mature_data_proliferation_audit"] = str(audit_path)
    status["live_mature_data_proliferation_audit"] = {
        "schema": payload.get("schema"),
        "status": payload.get("status"),
        "summary": payload.get("summary"),
        "governed_mature_hypotheses_preview": (
            payload.get("governed_mature_hypotheses") or []
        )[:12],
        "content_derived_mature_observations_preview": [
            seed
            for seed in (payload.get("mature_seeds") or [])
            if isinstance(seed, dict)
            and seed.get("authority_class") == "content_derived_mature_observation"
        ][:12],
        "genre_rule_observations_preview": (
            payload.get("genre_rule_observations") or []
        )[:12],
        "proposed_audiovisual_samples_preview": (
            payload.get("proposed_audiovisual_samples") or []
        )[:12],
        "confirmation_needs_preview": (
            payload.get("confirmation_needs") or []
        )[:12],
        "scanner_matcher_launch_requests_preview": (
            payload.get("scanner_matcher_launch_requests") or []
        )[:12],
        "auto_launched_scanner_matches_preview": auto_launched_matches[:12],
        "suppressed_candidate_opportunities_preview": (
            payload.get("suppressed_candidate_opportunities") or []
        )[:12],
        "next_required_stage": payload.get("next_required_stage"),
        "output_json_path": str(audit_path),
        "updated_at": utc_now_iso(),
    }
    if auto_launched_matches:
        persist_analysis_record_for_status(status)
    return payload


def auto_launch_confirmation_need_scanner_requests(
    status: Dict[str, Any],
    audit_payload: Dict[str, Any],
) -> List[Dict[str, Any]]:
    analysis_id = str(status.get("analysis_id") or "").strip()
    if not analysis_id:
        return []

    existing_request_ids = {
        str(item.get("request_id"))
        for item in status.get("evidence_proliferation_matches", [])
        if isinstance(item, dict) and item.get("request_id")
    }
    analysis_dir = RESULTS_DIR / analysis_id
    launched: List[Dict[str, Any]] = []

    for request_item in (audit_payload.get("scanner_matcher_launch_requests") or [])[:3]:
        if not isinstance(request_item, dict):
            continue
        request = request_item.get("request_payload")
        if not isinstance(request, dict):
            continue
        request_id = str(
            request.get("request_id")
            or request_item.get("request_id")
            or f"auto-confirmation-need-{uuid.uuid4()}"
        ).strip()
        if not request_id or request_id in existing_request_ids:
            continue

        request["request_id"] = request_id
        safe_request_id = "".join(
            character if character.isalnum() or character in {"-", "_"} else "_"
            for character in request_id
        )[:96]
        output_json_path = (
            analysis_dir / f"evidence_proliferation_match_{safe_request_id}.json"
        )
        result = write_evidence_proliferation_match(
            analysis_id,
            status,
            request,
            output_json_path,
        )
        request_record = {
            "request_id": request_id,
            "status": result.get("status"),
            "candidate_count": result.get("candidate_count", 0),
            "output_json_path": str(output_json_path),
            "updated_at": utc_now_iso(),
            "launch_reason": "confirmation_need",
            "trigger_need_id": request_item.get("trigger_need_id"),
        }
        status.setdefault("evidence_proliferation_matches", [])
        status["evidence_proliferation_matches"] = [
            request_record,
            *[
                item
                for item in status.get("evidence_proliferation_matches", [])
                if item.get("request_id") != request_id
            ],
        ][:25]
        status.setdefault("internal_artifacts", {})[
            f"evidence_proliferation_match:{request_id}"
        ] = str(output_json_path)
        append_analysis_event(
            status,
            "evidence_proliferation_match_auto_launched",
            details={
                "request_id": request_id,
                "candidate_count": result.get("candidate_count", 0),
                "output_json_path": str(output_json_path),
                "trigger_need_id": request_item.get("trigger_need_id"),
            },
        )
        existing_request_ids.add(request_id)
        launched.append(request_record)

    return launched


def load_persisted_analysis(analysis_id: str) -> Optional[Dict[str, Any]]:
    record_path = get_analysis_record_path(analysis_id)
    if not record_path.exists():
        return None

    try:
        status = json.loads(record_path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to load persisted analysis %s: %s", analysis_id, exc)
        return None

    status.setdefault("analysis_id", analysis_id)
    status.setdefault("event_log", [])
    hydrate_saved_analysis_status(status, results_dir=RESULTS_DIR)
    ensure_live_mature_data_proliferation_audit_for_status(status)
    analysis_status[analysis_id] = status
    return status


def get_analysis_entry(analysis_id: str) -> Optional[Dict[str, Any]]:
    status = analysis_status.get(analysis_id)
    if status is not None:
        hydrate_saved_analysis_status(status, results_dir=RESULTS_DIR)
        ensure_live_mature_data_proliferation_audit_for_status(status)
        return status
    return load_persisted_analysis(analysis_id)


def collect_saved_analysis_records() -> Dict[str, Dict[str, Any]]:
    records: Dict[str, Dict[str, Any]] = {}
    if not RESULTS_DIR.exists():
        return records

    for record_path in RESULTS_DIR.glob("*/analysis_record.json"):
        try:
            status = json.loads(record_path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Skipping unreadable analysis record %s: %s", record_path, exc)
            continue

        analysis_id = status.get("analysis_id") or record_path.parent.name
        status.setdefault("analysis_id", analysis_id)
        status.setdefault("event_log", [])
        records[analysis_id] = status

    records.update(analysis_status)
    return records


def regenerate_pos_from_transcript_if_needed(output_files: Dict[str, str]) -> bool:
    """Regenerate stale or empty POS output from transcript data when possible."""
    transcript_path_raw = output_files.get("transcript")
    if not transcript_path_raw:
        return False

    transcript_path = Path(transcript_path_raw)
    if not transcript_path.exists():
        return False

    try:
        with open(transcript_path, "r", encoding="utf-8") as handle:
            transcript_data = json.load(handle)
    except Exception:
        return False

    transcript_segments = transcript_data.get("segments", [])
    transcript_text = " ".join(
        segment.get("text", "").strip()
        for segment in transcript_segments
        if segment.get("text")
    ).strip()
    if not transcript_text:
        return False

    pos_path_raw = output_files.get("pos_analysis")
    should_regenerate = not pos_path_raw
    pos_path = Path(pos_path_raw) if pos_path_raw else transcript_path.with_name(
        f"{transcript_path.stem.replace('_transcript', '')}_pos.json"
    )

    if pos_path_raw and pos_path.exists():
        try:
            with open(pos_path, "r", encoding="utf-8") as handle:
                existing_pos = json.load(handle)
            should_regenerate = not bool(existing_pos.get("pos_counts"))
        except Exception:
            should_regenerate = True

    if not should_regenerate:
        return False

    language_code = (
        transcript_data.get("language")
        or (transcript_data.get("language_info") or {}).get("code")
        or "en"
    )

    pos_result = POSAnalysis(
        transcript_text,
        language_code=language_code,
    ).run()
    pos_result["transcript_timing_authority"] = build_transcript_timing_authority(
        transcript_data
    )
    pos_result["source_transcript_clock"] = "operational_transcript"

    pos_path.parent.mkdir(parents=True, exist_ok=True)
    with open(pos_path, "w", encoding="utf-8") as handle:
        json.dump(pos_result, handle, indent=2, ensure_ascii=False)

    output_files["pos_analysis"] = str(pos_path)
    return True


def regenerate_linked_transcript_if_needed(status: Dict[str, Any]) -> bool:
    output_files = status.get("output_files", {})
    transcript_path_raw = output_files.get("transcript")
    if not transcript_path_raw:
        return False

    transcript_path = Path(transcript_path_raw)
    if not transcript_path.exists():
        return False

    linked_path_raw = output_files.get("linked_transcript")
    linked_path = (
        Path(linked_path_raw)
        if linked_path_raw
        else transcript_path.with_name(
            f"{transcript_path.stem.replace('_transcript', '')}_linked_transcript.json"
        )
    )
    if linked_path.exists():
        output_files["linked_transcript"] = str(linked_path)
        return False

    try:
        transcript = json.loads(transcript_path.read_text(encoding="utf-8"))
    except Exception:
        return False

    if not transcript.get("segments"):
        return False

    write_linked_transcript_artifact(status, transcript, output_files)
    status["output_files"] = output_files
    return True


def regenerate_audio_prosody_if_needed(status: Dict[str, Any]) -> bool:
    output_files = status.get("output_files", {})
    transcript_path_raw = output_files.get("transcript")
    audio_path_raw = output_files.get("audio")
    if not transcript_path_raw or not audio_path_raw:
        return False

    transcript_path = Path(transcript_path_raw)
    audio_path = Path(audio_path_raw)
    if not transcript_path.exists() or not audio_path.exists():
        return False

    prosody_path_raw = output_files.get("audio_prosody")
    prosody_path = (
        Path(prosody_path_raw)
        if prosody_path_raw
        else transcript_path.with_name(
            f"{transcript_path.stem.replace('_transcript', '')}_audio_prosody.json"
        )
    )
    should_regenerate = not prosody_path.exists()
    if prosody_path.exists():
        try:
            existing = json.loads(prosody_path.read_text(encoding="utf-8"))
            cues = existing.get("cues") if isinstance(existing, dict) else None
            first_cue = cues[0] if isinstance(cues, list) and cues else {}
            has_sound_environment = bool(
                isinstance(first_cue, dict) and first_cue.get("sound_environment")
            )
            has_interaction_cues = bool(
                isinstance(first_cue, dict) and first_cue.get("interaction_cues")
            )
            if has_sound_environment and has_interaction_cues:
                output_files["audio_prosody"] = str(prosody_path)
                return False
            should_regenerate = True
        except Exception:
            should_regenerate = True

    if not should_regenerate:
        output_files["audio_prosody"] = str(prosody_path)
        return False

    try:
        transcript = json.loads(transcript_path.read_text(encoding="utf-8"))
    except Exception:
        return False

    if not transcript.get("segments"):
        return False

    try:
        audio_prosody = analyze_audio_prosody(audio_path, transcript.get("segments", []))
    except Exception:
        return False

    prosody_path.write_text(
        json.dumps(normalize_analysis_json_for_write(audio_prosody), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    output_files["audio_prosody"] = str(prosody_path)
    audio_events = audio_prosody.get("audio_event_intervals") if isinstance(audio_prosody, dict) else None
    if isinstance(audio_events, dict):
        audio_events_path = prosody_path.with_name(
            f"{prosody_path.stem.replace('_audio_prosody', '')}_audio_event_intervals.json"
        )
        audio_events_path.write_text(
            json.dumps(audio_events, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        output_files["audio_event_intervals"] = str(audio_events_path)
    status["output_files"] = output_files
    return True


def normalize_analysis_json_for_write(value: Any) -> Any:
    try:
        import pandas as pd

        if isinstance(value, pd.DataFrame):
            return value.to_dict(orient="records")
        if isinstance(value, dict):
            return {
                str(key): normalize_analysis_json_for_write(item)
                for key, item in value.items()
            }
        if isinstance(value, (list, tuple)):
            return [normalize_analysis_json_for_write(item) for item in value]
    except Exception:
        pass
    return make_json_safe(value)


def rewrite_pos_quant_from_transcript(
    status: Dict[str, Any],
    transcript: Dict[str, Any],
    transcript_path: Path,
) -> List[str]:
    output_files = status.setdefault("output_files", {})
    language_code = (
        transcript.get("language")
        or (transcript.get("language_info") or {}).get("code")
        or "en"
    )
    transcript_text = " ".join(
        str(segment.get("text", "")).strip()
        for segment in transcript.get("segments", [])
        if str(segment.get("text", "")).strip()
    ).strip()
    if not transcript_text:
        return []

    rewritten: List[str] = []
    pos_path = (
        Path(output_files["pos_analysis"])
        if output_files.get("pos_analysis")
        else transcript_path.with_name(
            f"{transcript_path.stem.replace('_transcript', '')}_pos.json"
        )
    )
    timing_authority = build_transcript_timing_authority(transcript)
    pos_result = POSAnalysis(transcript_text, language_code=language_code).run()
    pos_result["transcript_timing_authority"] = timing_authority
    pos_result["source_transcript_clock"] = "operational_transcript"
    pos_path.parent.mkdir(parents=True, exist_ok=True)
    pos_path.write_text(
        json.dumps(normalize_analysis_json_for_write(pos_result), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    output_files["pos_analysis"] = str(pos_path)
    rewritten.append("pos_analysis")

    quant_path = (
        Path(output_files["quan_analysis"])
        if output_files.get("quan_analysis")
        else transcript_path.with_name(
            f"{transcript_path.stem.replace('_transcript', '')}_quan.json"
        )
    )
    qa = QuantitativeAnalysis(
        docs=[transcript_text],
        file_paths=[transcript_path],
        document_labels=[Path(status.get("original_filename") or transcript_path.name).stem],
        language_code=language_code,
    )
    quant_result = qa.run()
    quant_result = attach_quant_evidence_to_transcript(
        quant_result,
        transcript.get("segments", []),
    )
    quant_result["transcript_timing_authority"] = timing_authority
    quant_result["source_transcript_clock"] = "operational_transcript"
    quant_path.parent.mkdir(parents=True, exist_ok=True)
    quant_path.write_text(
        json.dumps(normalize_analysis_json_for_write(quant_result), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    output_files["quan_analysis"] = str(quant_path)
    rewritten.append("quan_analysis")
    return rewritten


def rebuild_audio_diarization_after_timing_change(
    status: Dict[str, Any],
    transcript: Dict[str, Any],
    audio_path: Path,
    audio_prosody: Dict[str, Any] | None,
) -> List[str]:
    analysis_id = str(status.get("analysis_id") or "").strip()
    if not analysis_id:
        return []

    output_files = status.setdefault("output_files", {})
    diarization_path = (
        Path(output_files["audio_diarization"])
        if output_files.get("audio_diarization")
        else TRANSCRIPTS_DIR / f"{analysis_id}_audio_diarization.json"
    )
    diarization_path.parent.mkdir(parents=True, exist_ok=True)
    audio_diarization = write_audio_diarization(
        analysis_id,
        audio_path=audio_path,
        output_json_path=diarization_path,
        transcript=transcript,
        audio_prosody=audio_prosody,
    )
    output_files["audio_diarization"] = str(diarization_path)

    audio_analysis = status.setdefault("results", {}).setdefault("audio_analysis", {})
    audio_analysis["audio_diarization"] = audio_diarization
    audio_analysis["audio_diarization_path"] = str(diarization_path)

    rewritten = ["audio_diarization"]
    if audio_diarization.get("status") == "completed_measured":
        source_media_context = build_source_media_metadata_payload(status)
        diarization_clouds = build_audio_sample_clouds_from_diarization(
            analysis_id,
            audio_diarization=audio_diarization,
            source_media_context=source_media_context,
            source_audio_path=audio_path,
        )
        narrative_agent_clouds = build_audio_sample_clouds_for_narrative_agents(
            analysis_id,
            transcript=transcript,
            audio_prosody=audio_prosody,
            source_media_context=source_media_context,
            source_audio_path=audio_path,
        )
        audio_sample_clouds = merge_audio_sample_cloud_payloads(
            analysis_id,
            diarization_clouds,
            narrative_agent_clouds,
        )
        audio_sample_clouds["audio_diarization_status"] = audio_diarization.get("status")
        audio_sample_clouds["audio_measurement_provider"] = audio_diarization.get("provider")
        audio_sample_clouds["transcript_timing_authority"] = (
            (audio_diarization.get("measurement") or {}).get("transcript_timing_authority")
        )
        sample_cloud_path = (
            Path(output_files["audio_sample_clouds"])
            if output_files.get("audio_sample_clouds")
            else TRANSCRIPTS_DIR / f"{analysis_id}_audio_sample_clouds.json"
        )
        sample_cloud_path.parent.mkdir(parents=True, exist_ok=True)
        sample_cloud_path.write_text(
            json.dumps(normalize_analysis_json_for_write(audio_sample_clouds), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        output_files["audio_sample_clouds"] = str(sample_cloud_path)
        audio_analysis["audio_sample_clouds"] = audio_sample_clouds
        audio_analysis["audio_sample_clouds_path"] = str(sample_cloud_path)
        rewritten.append("audio_sample_clouds")

    status["output_files"] = output_files
    return rewritten


def repair_transcript_timing_if_needed(status: Dict[str, Any]) -> bool:
    output_files = status.setdefault("output_files", {})
    transcript_path_raw = output_files.get("transcript")
    audio_path_raw = output_files.get("audio")
    if not transcript_path_raw or not audio_path_raw:
        return False

    transcript_path = Path(str(transcript_path_raw))
    audio_path = Path(str(audio_path_raw))
    if not transcript_path.exists() or not audio_path.exists():
        return False

    try:
        transcript = json.loads(transcript_path.read_text(encoding="utf-8"))
    except Exception as exc:
        status["transcript_timing_repair"] = {
            "status": "skipped",
            "reason": f"transcript_unreadable:{exc}",
        }
        return False

    source_metadata = (
        status.get("source_media_metadata")
        if isinstance(status.get("source_media_metadata"), dict)
        else {}
    )
    media_duration_seconds = (
        status.get("duration_seconds")
        or source_metadata.get("duration_seconds")
        or source_metadata.get("duration")
    )
    audio_duration_seconds = get_wav_duration_seconds(audio_path)
    quality_report = build_transcript_quality_report(
        transcript,
        media_duration_seconds=media_duration_seconds,
        audio_duration_seconds=audio_duration_seconds,
    )
    status.setdefault("results", {}).setdefault("audio_analysis", {})[
        "transcript_quality"
    ] = quality_report

    if not transcript_timing_repair_needed(transcript, quality_report):
        status["transcript_timing_repair"] = {
            "status": "not_needed",
            "quality": quality_report,
        }
        return False

    previous_repair = status.get("transcript_timing_repair")
    previous_reason = str((previous_repair or {}).get("reason") or "")
    if (
        isinstance(previous_repair, dict)
        and previous_repair.get("status") == "failed"
        and "ffmpeg" not in previous_reason.lower()
        and "fallback_did_not_improve_timeline_coverage" not in previous_reason
    ):
        return False

    backup_path = transcript_path.with_name(f"{transcript_path.stem}_degraded_backup.json")
    if not backup_path.exists():
        backup_path.write_text(
            json.dumps(transcript, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    if prefer_authoritative_transcript_artifact(status):
        status["transcript_timing_repair"] = {
            "status": "relinked",
            "reason": "preserved_whisper_or_manual_clock_artifact_selected",
            "quality_before": quality_report,
            "backup_path": str(backup_path),
            "vad_policy": "auxiliary_only_not_transcript_clock",
            "fallback_policy": "candidate_not_operational_source_truth",
        }
        return True

    status["transcript_timing_repair"] = {
        "status": "blocked",
        "reason": "automatic_repair_disabled_original_whisper_or_manual_clock_required",
        "quality_before": quality_report,
        "backup_path": str(backup_path),
        "vad_policy": "auxiliary_only_not_transcript_clock",
        "fallback_policy": "candidate_not_operational_source_truth",
    }
    return False

    try:
        repaired = AudioTranscriptionPipeline(str(audio_path)).rerun_with_chunked_fallback(
            primary_transcript=transcript,
        )
    except Exception as exc:
        logger.warning("Transcript timing repair failed for %s: %s", status.get("analysis_id"), exc)
        status["transcript_timing_repair"] = {
            "status": "failed",
            "reason": str(exc),
            "quality_before": quality_report,
        }
        return False

    repaired_quality = build_transcript_quality_report(
        repaired,
        media_duration_seconds=media_duration_seconds,
        audio_duration_seconds=audio_duration_seconds,
    )
    repair_reason = "degraded_transcript_coverage"
    before_end = safe_float(quality_report.get("last_segment_end_seconds")) or 0.0
    after_end = safe_float(repaired_quality.get("last_segment_end_seconds")) or 0.0
    if repaired_quality.get("status") != "ok" and after_end < before_end + 6.0:
        automatic_candidate = (
            repaired.get("automatic_fallback_candidate")
            if isinstance(repaired.get("automatic_fallback_candidate"), dict)
            else None
        )
        automatic_repair = None
        if automatic_candidate:
            promoted_repair = promote_automatic_transcript_timing(
                transcript,
                automatic_candidate,
                after_seconds=0.0,
            )
            automatic_repair = rebuild_transcript_from_quick_sweep_candidate(
                promoted_repair or transcript,
                automatic_candidate,
            )
            if automatic_repair is None:
                automatic_repair = promoted_repair
        if automatic_repair is None:
            logger.warning(
                "Transcript timing repair rejected VAD authority for %s: before_end=%s after_end=%s",
                status.get("analysis_id"),
                before_end,
                after_end,
            )
            status["transcript_timing_repair"] = {
                "status": "failed",
                "reason": "automatic_transcript_timing_unavailable_vad_rejected_as_clock_authority",
                "quality_before": quality_report,
                "quality_after": repaired_quality,
                "backup_path": str(backup_path),
            }
            return False

        repaired = automatic_repair
        repaired_quality = build_transcript_quality_report(
            repaired,
            media_duration_seconds=media_duration_seconds,
            audio_duration_seconds=audio_duration_seconds,
        )
        after_end = safe_float(repaired_quality.get("last_segment_end_seconds")) or 0.0
        repair_reason = "inherited_rows_promoted_from_automatic_transcript_timestamps"

    transcript_text = " ".join(
        str(segment.get("text", "")).strip()
        for segment in repaired.get("segments", [])
        if str(segment.get("text", "")).strip()
    )
    repaired["language_info"] = build_language_profile(
        repaired.get("language", "unknown"),
        transcript_text,
    )
    repaired["timeline_segments"] = build_transcript_timeline_segments(
        repaired,
        coverage_target_seconds=media_duration_seconds or audio_duration_seconds,
    )
    repaired["timing_repair"] = {
        "status": "repaired" if repaired_quality.get("status") == "ok" else "partially_repaired",
        "reason": repair_reason,
        "quality_before": quality_report,
        "quality_after": repaired_quality,
        "backup_path": str(backup_path),
    }
    repaired["timing_authority"] = build_transcript_timing_authority(repaired)

    transcript_path.write_text(
        json.dumps(repaired, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    output_files["transcript"] = str(transcript_path)

    write_linked_transcript_artifact(status, repaired, output_files)
    timed_segments = source_timed_transcript_segments(repaired)
    audio_prosody = analyze_audio_prosody(audio_path, timed_segments)
    prosody_path = (
        Path(output_files["audio_prosody"])
        if output_files.get("audio_prosody")
        else transcript_path.with_name(
            f"{transcript_path.stem.replace('_transcript', '')}_audio_prosody.json"
        )
    )
    prosody_path.write_text(
        json.dumps(audio_prosody, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    output_files["audio_prosody"] = str(prosody_path)
    audio_events = audio_prosody.get("audio_event_intervals") if isinstance(audio_prosody, dict) else None
    if isinstance(audio_events, dict):
        audio_events_path = prosody_path.with_name(
            f"{prosody_path.stem.replace('_audio_prosody', '')}_audio_event_intervals.json"
        )
        audio_events_path.write_text(
            json.dumps(normalize_analysis_json_for_write(audio_events), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        output_files["audio_event_intervals"] = str(audio_events_path)
    rewritten_audio = rebuild_audio_diarization_after_timing_change(
        status,
        {"segments": timed_segments, **{k: v for k, v in repaired.items() if k != "segments"}},
        audio_path,
        audio_prosody,
    )
    write_time_bank_artifact(
        status,
        output_files,
        source_key="audio_prosody",
        artifact_key="time_bank_audio",
        suffix="time_bank_audio",
        linker=link_audio_prosody_json_to_trace,
    )
    rewritten = rewrite_pos_quant_from_transcript(status, repaired, transcript_path)

    status["output_files"] = output_files
    status.setdefault("results", {}).setdefault("audio_analysis", {}).update(
        {
            "transcript": repaired,
            "transcript_quality": repaired_quality,
            "audio_prosody": audio_prosody,
        }
    )
    status["transcript_timing_repair"] = {
        "status": "repaired" if repaired_quality.get("status") == "ok" else "partially_repaired",
        "reason": repair_reason,
        "quality_before": quality_report,
        "quality_after": repaired_quality,
        "backup_path": str(backup_path),
        "rewritten_artifacts": [
            "transcript",
            "linked_transcript",
            "audio_prosody",
            *rewritten_audio,
            "time_bank_audio",
            *rewritten,
        ],
    }
    append_analysis_event(
        status,
        "transcript_timing_repaired",
        details=status["transcript_timing_repair"],
    )
    return True


def regenerate_time_bank_visual_artifacts_if_needed(status: Dict[str, Any]) -> bool:
    output_files = status.get("output_files", {})
    changed = False

    artifact_specs = [
        (("audio_prosody",), "time_bank_audio", "time_bank_audio", link_audio_prosody_json_to_trace),
        (("ocr_csv",), "time_bank_ocr", "time_bank_ocr", link_ocr_csv_to_trace),
        (("tracked_objects_csv", "yolo_csv"), "time_bank_objects", "time_bank_objects", link_object_csv_to_trace),
        (("expression_json",), "time_bank_expressions", "time_bank_expressions", link_expression_json_to_trace),
    ]

    for source_keys, artifact_key, suffix, linker in artifact_specs:
        existing_path_raw = output_files.get(artifact_key)
        if existing_path_raw and Path(existing_path_raw).exists():
            continue
        source_key = next((key for key in source_keys if output_files.get(key)), None)
        if not source_key:
            continue
        written = write_time_bank_artifact(
            status,
            output_files,
            source_key=source_key,
            artifact_key=artifact_key,
            suffix=suffix,
            linker=linker,
        )
        if written:
            changed = True

    status["output_files"] = output_files
    return changed


def remove_analysis_artifacts(analysis_id: str, status: Dict[str, Any]) -> None:
    uploaded_path = status.get("file_path")
    if uploaded_path:
        uploaded_file = Path(uploaded_path)
        if uploaded_file.exists():
            if uploaded_file.is_dir():
                shutil.rmtree(uploaded_file, ignore_errors=True)
            else:
                uploaded_file.unlink()

    output_files = status.get("output_files", {})
    external_source_video = (
        status.get("source_video_path")
        if status.get("source_video_external")
        else None
    )
    for file_path in output_files.values():
        if not file_path:
            continue
        result_file = Path(str(file_path))
        if external_source_video and str(result_file) == str(external_source_video):
            continue
        if result_file.exists():
            if result_file.is_dir():
                shutil.rmtree(result_file, ignore_errors=True)
            else:
                result_file.unlink()

    analysis_output_dir = RESULTS_DIR / analysis_id
    if analysis_output_dir.exists():
        shutil.rmtree(analysis_output_dir)

    imported_work_dir = IMPORTED_WORK_DIR / analysis_id
    if imported_work_dir.exists():
        shutil.rmtree(imported_work_dir)


def update_analysis_progress(
    status: Dict[str, Any],
    progress: int,
    stage: str,
    message: str,
) -> None:
    status["progress"] = progress
    status["mission_stage"] = stage
    status["mission_message"] = message
    append_analysis_event(
        status,
        "progress_update",
        progress=progress,
        stage=stage,
        message=message,
    )
    persist_analysis_record_for_status(status)


def build_download_links(analysis_id: str, output_files: Dict[str, str]) -> Dict[str, str]:
    return {
        file_type: f"/api/download/{analysis_id}/{file_type}"
        for file_type in output_files.keys()
    }


def slugify_name(value: str) -> str:
    cleaned = "".join(
        ch if ch.isalnum() or ch in {"-", "_"} else "_"
        for ch in value.strip()
    )
    cleaned = cleaned.strip("_")
    return cleaned or "vaa1_project"


def build_saved_work_manifest(status: Dict[str, Any]) -> Dict[str, Any]:
    source_video_path = status.get("source_video_path") or status.get("file_path")
    source_video_exists = bool(source_video_path and Path(source_video_path).exists())
    output_files = status.get("output_files", {})
    annotation_corrections = build_annotation_corrections_payload(status)
    return make_json_safe({
        "analysis_id": status.get("analysis_id"),
        "original_filename": status.get("original_filename"),
        "source_video_path": source_video_path,
        "source_video_exists_at_save_time": source_video_exists,
        "source_media_metadata": status.get("source_media_metadata", {}),
        "annotation_corrections": annotation_corrections,
        "annotation_corrections_counts": {
            "text_substitutions": len(annotation_corrections.get("text_substitutions", []) or []),
            "label_overrides": len(annotation_corrections.get("label_overrides", []) or []),
            "manual_transcript_entries": len(annotation_corrections.get("manual_transcript_entries", []) or []),
            "manual_visual_annotations": len(annotation_corrections.get("manual_visual_annotations", []) or []),
            "master_schema_presence_intervals": len(annotation_corrections.get("master_schema_presence_intervals", []) or []),
            "meaning_network_custom_lanes": len(annotation_corrections.get("meaning_network_custom_lanes", []) or []),
        },
        "analysis_completed_at": status.get("analysis_completed_at"),
        "pipeline_type": status.get("pipeline_type", "full"),
        "analysis_tier": status.get("analysis_tier", "science_scan"),
        "modality_focus": status.get("modality_focus", "multimodal"),
        "matrix_files": [
            file_type for file_type in output_files.keys() if file_type.endswith("_matrix")
        ],
    })


def add_available_output_files_to_archive(
    archive: zipfile.ZipFile,
    output_files: Dict[str, Any],
    file_mapping: Dict[str, str],
    *,
    archive_prefix: str,
) -> List[Dict[str, str]]:
    skipped: List[Dict[str, str]] = []
    for file_type, file_path in output_files.items():
        if not file_path:
            skipped.append({"file_type": str(file_type), "reason": "empty_path"})
            continue
        try:
            path_obj = Path(str(file_path))
        except TypeError as exc:
            skipped.append({
                "file_type": str(file_type),
                "reason": f"invalid_path:{exc}",
            })
            continue
        if not path_obj.exists() or not path_obj.is_file():
            skipped.append({
                "file_type": str(file_type),
                "reason": "missing_or_not_file",
            })
            continue
        archive_name = file_mapping.get(str(file_type), path_obj.name)
        try:
            archive.write(path_obj, arcname=f"{archive_prefix}{archive_name}")
        except Exception as exc:
            skipped.append({
                "file_type": str(file_type),
                "reason": f"archive_write_failed:{exc}",
            })
    return skipped


def refresh_mutable_saved_outputs(status: Dict[str, Any]) -> None:
    """Ensure analyst-editable outputs are written before export bundling."""
    write_source_media_metadata_files(status)
    write_annotation_corrections_file(status)
    persist_analysis_record_for_status(status)


def infer_output_files_from_bundle(extract_dir: Path, bundle_stem: str) -> Dict[str, str]:
    file_mapping = {
        "annotated_video.mp4": "video",
        "source_video.mp4": "source_video",
        "source_video.mov": "source_video",
        "source_video.mkv": "source_video",
        "source_video.avi": "source_video",
        "source_video.webm": "source_video",
        "yolo_detections.csv": "yolo_csv",
        "tracked_objects.csv": "tracked_objects_csv",
        "tracked_objects.json": "tracked_objects_json",
        "ocr_text.csv": "ocr_csv",
        "analysis_summary.json": "summary_json",
        "extracted_audio.wav": "audio",
        "linked_transcript.json": "linked_transcript",
        "transcript.json": "transcript",
        "audio_prosody.json": "audio_prosody",
        "audio_event_intervals.json": "audio_event_intervals",
        "time_bank_audio.json": "time_bank_audio",
        "time_bank_ocr.json": "time_bank_ocr",
        "time_bank_objects.json": "time_bank_objects",
        "time_bank_expressions.json": "time_bank_expressions",
        "lm_transcript.json": "lm_transcript",
        "pos_analysis.json": "pos_analysis",
        "expressions.json": "expression_json",
        "quan_analysis.json": "quan_analysis",
        "source_media_metadata.json": "source_media_metadata_json",
        "source_media_metadata.csv": "source_media_metadata_csv",
        "annotation_corrections.json": "annotation_corrections",
        "pos_matrix.json": "pos_matrix",
        "quant_matrix.json": "quant_matrix",
        "face_anonymization_manifest.json": "face_anonymization_manifest",
    }

    output_files: Dict[str, str] = {}
    for path_obj in extract_dir.iterdir():
        if not path_obj.is_file():
            continue

        filename = path_obj.name
        for expected_suffix, file_type in file_mapping.items():
            prefixed_suffix = f"{bundle_stem}_{expected_suffix}"
            if (
                filename == expected_suffix
                or filename == prefixed_suffix
                or filename.endswith(f"_{expected_suffix}")
            ):
                output_files[file_type] = str(path_obj)
                break

    return output_files


def read_saved_work_manifest(extract_dir: Path, bundle_stem: str) -> Dict[str, Any]:
    manifest_candidates = [
        extract_dir / f"{bundle_stem}_saved_work_manifest.json",
        extract_dir / "saved_work_manifest.json",
    ]

    for manifest_path in manifest_candidates:
        if manifest_path.exists():
            try:
                return json.loads(manifest_path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Failed to read saved work manifest %s: %s", manifest_path, exc)
                return {}

    return {}


def register_imported_analysis(
    *,
    import_dir: Path,
    bundle_filename: str,
    output_files: Dict[str, str],
    manifest: Dict[str, Any],
    original_filename_override: Optional[str] = None,
) -> Dict[str, Any]:
    analysis_id = str(uuid.uuid4())

    original_filename = original_filename_override
    if not original_filename:
        if manifest.get("original_filename"):
            original_filename = manifest.get("original_filename")
        elif "video" in output_files:
            original_filename = f"{import_dir.name}.mp4"
        elif "source_video" in output_files:
            original_filename = Path(output_files["source_video"]).name
        else:
            original_filename = f"{import_dir.name}.zip"

    source_video_path = output_files.get("source_video") or manifest.get("source_video_path")
    source_video_external = False
    if source_video_path and "source_video" not in output_files and Path(source_video_path).exists():
        output_files["source_video"] = source_video_path
        source_video_external = True

    regenerated_pos = False
    try:
        regenerated_pos = regenerate_pos_from_transcript_if_needed(output_files)
    except Exception as exc:
        logger.warning("Could not regenerate POS output for imported bundle %s: %s", bundle_filename, exc)

    marker_path = import_dir / "imported_bundle.txt"
    marker_path.write_text(bundle_filename, encoding="utf-8")

    status = {
        "analysis_id": analysis_id,
        "status": "completed",
        "filename": bundle_filename,
        "original_filename": original_filename,
        "file_path": str(marker_path),
        "source_video_path": source_video_path,
        "source_video_external": source_video_external,
        "progress": 100,
        "mission_stage": "complete",
        "mission_message": "Imported saved work is ready for review.",
        "results": {},
        "error": None,
        "start_time": None,
        "end_time": None,
        "uploaded_at": utc_now_iso(),
        "analysis_started_at": None,
        "analysis_completed_at": utc_now_iso(),
        "output_files": output_files,
        "pipeline_type": manifest.get("pipeline_type", "full"),
        "cvatID": 0,
        "event_log": [],
        "source_media_metadata": manifest.get("source_media_metadata", {}),
        "source_media_annotations": (
            manifest.get("source_media_metadata", {}).get("user_annotations", {})
            if isinstance(manifest.get("source_media_metadata"), dict)
            else {}
        ),
    }
    append_analysis_event(
        status,
        "imported_saved_work",
        progress=100,
        stage="complete",
        message="Imported saved work is ready for review.",
        details={
            "bundle_filename": bundle_filename,
            "pos_regenerated": regenerated_pos,
        },
    )
    analysis_status[analysis_id] = status
    write_source_media_metadata_files(status)
    persist_analysis_record_for_status(status)
    return status

@app.post("/api/upload", response_model=dict)
async def upload_video(file: UploadFile = File(...), cvatID: int = Form(...)) -> dict:
    """
    Upload a video file for analysis
    Returns analysis ID for tracking
    """
    # More flexible file type checking
    allowed_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'}
    file_extension = Path(file.filename).suffix.lower()
    
    # Check both content type and file extension
    is_video_content = file.content_type and file.content_type.startswith('video/')
    is_video_extension = file_extension in allowed_extensions
    
    if not (is_video_content or is_video_extension):
        raise HTTPException(
            status_code=400, 
            detail=f"File must be a video. Supported formats: {', '.join(allowed_extensions)}"
        )
    
    # Generate unique analysis ID
    analysis_id = str(uuid.uuid4())
    safe_filename = f"{analysis_id}{file_extension}"
    file_path = UPLOAD_DIR / safe_filename
    
    try:
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        media_probe: Dict[str, Any] = {}
        try:
            media_probe = validate_video(str(file_path))
            media_probe["mime_type"] = file.content_type
            media_probe["container_extension"] = file_extension
        except Exception as probe_exc:
            logger.warning("Initial media metadata probe failed for %s: %s", file.filename, probe_exc)
        
        # Initialize analysis status
        analysis_status[analysis_id] = {
            "analysis_id": analysis_id,
            "status": "uploaded",
            "filename": safe_filename,
            "original_filename": file.filename,
            "file_path": str(file_path),
            "source_video_path": str(file_path),
            "progress": 0,
            "mission_stage": "uploaded",
            "mission_message": "File secured. Standing by for orders.",
            "results": None,
            "error": None,
            "start_time": None,
            "end_time": None,
            "uploaded_at": utc_now_iso(),
            "analysis_started_at": None,
            "analysis_completed_at": None,
            "output_files": {},
            "pipeline_type": "full",
            "language_pack_policy": build_language_pack_policy(),
            "cvatID": cvatID,
            "event_log": [],
            "source_media_metadata": media_probe,
            "source_media_annotations": {
                "editor_notes": "",
                "source_context": "",
                "provenance_notes": "",
            },
            "source_media_reference_files": [],
        }
        append_analysis_event(
            analysis_status[analysis_id],
            "uploaded",
            progress=0,
            stage="uploaded",
            message="File secured. Standing by for orders.",
            details={
                "filename": file.filename,
                "stored_filename": safe_filename,
                "cvatID": cvatID,
            },
        )
        write_source_media_metadata_files(analysis_status[analysis_id])
        persist_analysis_record_for_status(analysis_status[analysis_id])
        
        logger.info(f"Video uploaded: {file.filename} -> {safe_filename} (ID: {analysis_id})")
        logger.info(f"Video uploaded: {cvatID})")
        logger.info(f"Video uploaded: {file.filename} -> {safe_filename} (ID: {analysis_id})")
        return {
            "analysis_id": analysis_id,
            "filename": file.filename,
            "cvatID": cvatID,
            "message": "Video uploaded successfully",
            "status": "uploaded"
        }
    
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


VALID_ANALYSIS_TIERS = {"quick_sweep", "science_scan", "forensic_sensor"}
VALID_MODALITY_FOCUS = {"multimodal", "graphics", "audio", "images", "text"}
VALID_MORPHOLOGY_PACK_POLICIES = set(MORPHOLOGY_PACK_LIMITS.keys())


def resolve_analysis_profile(
    pipeline_type: str,
    analysis_tier: str,
    modality_focus: str,
) -> Dict[str, Any]:
    tier_defaults = {
        "quick_sweep": {
            "detection_interval_seconds": 10.0,
            "ocr_interval_seconds": 10.0,
            "expression_interval_seconds": 10.0,
            "save_annotated_video": False,
            "enable_face_sampling": True,
        },
        "science_scan": {
            "detection_interval_seconds": 1.0,
            "ocr_interval_seconds": 1.0,
            "expression_interval_seconds": 1.0,
            "save_annotated_video": True,
            "enable_face_sampling": True,
        },
        "forensic_sensor": {
            "detection_interval_seconds": 0.0,
            "ocr_interval_seconds": 0.5,
            "expression_interval_seconds": 0.5,
            "save_annotated_video": True,
            "enable_face_sampling": True,
        },
    }

    focus_defaults = {
        "multimodal": {
            "pipeline_type": "full",
            "enable_object_detection": True,
            "enable_ocr": True,
            "enable_expression_detection": True,
            "enable_audio_analysis": True,
        },
        "graphics": {
            "pipeline_type": "visual_only",
            "enable_object_detection": True,
            "enable_ocr": False,
            "enable_expression_detection": True,
            "enable_audio_analysis": False,
        },
        "images": {
            "pipeline_type": "visual_only",
            "enable_object_detection": True,
            "enable_ocr": True,
            "enable_expression_detection": True,
            "enable_audio_analysis": False,
        },
        "audio": {
            "pipeline_type": "audio_only",
            "enable_object_detection": False,
            "enable_ocr": False,
            "enable_expression_detection": False,
            "enable_audio_analysis": True,
        },
        "text": {
            "pipeline_type": "full",
            "enable_object_detection": False,
            "enable_ocr": True,
            "enable_expression_detection": False,
            "enable_audio_analysis": True,
        },
    }

    resolved = {
        "pipeline_type": pipeline_type,
        **tier_defaults[analysis_tier],
        **focus_defaults[modality_focus],
        "analysis_tier": analysis_tier,
        "modality_focus": modality_focus,
    }

    if modality_focus == "multimodal" and pipeline_type in {"visual_only", "audio_only"}:
        resolved["pipeline_type"] = pipeline_type
        if pipeline_type == "visual_only":
            resolved["enable_audio_analysis"] = False
        elif pipeline_type == "audio_only":
            resolved["enable_object_detection"] = False
            resolved["enable_ocr"] = False
            resolved["enable_expression_detection"] = False

    if analysis_tier == "quick_sweep":
        resolved["pipeline_type"] = "full"
        resolved["enable_object_detection"] = False
        resolved["enable_ocr"] = False
        resolved["enable_expression_detection"] = False
        resolved["enable_face_sampling"] = False
        resolved["enable_audio_analysis"] = True
        resolved["save_annotated_video"] = False

    return resolved

@app.post("/api/analyze/{analysis_id}", response_model=dict)
async def start_analysis(
    analysis_id: str,
    background_tasks: BackgroundTasks,
    pipeline_type: str = "full",
    analysis_tier: str = "science_scan",
    modality_focus: str = "multimodal",
    morphology_pack_policy: str = "core_only",
    morphology_languages: str = "",
    special_use_morphology_language: str = "",
    allow_rough_interpretation: bool = True,
    apply_face_anonymization: bool = False,
    face_message_style: str = "plain",
    face_requires_person_detection: bool = False,
) -> dict:
    """
    Start video analysis for uploaded video
    Runs in background
    
    pipeline_type options:
    - "full": Video + Audio analysis (default)
    - "visual_only": Only video frame analysis  
    - "audio_only": Only audio transcription
    """
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    if status["status"] == "processing":
        raise HTTPException(status_code=400, detail="Analysis already in progress")
    if status["status"] == "completed":
        raise HTTPException(status_code=400, detail="Analysis already completed")
    
    # Validate pipeline type
    if pipeline_type not in ["full", "visual_only", "audio_only"]:
        raise HTTPException(status_code=400, detail="Invalid pipeline type")
    if analysis_tier not in VALID_ANALYSIS_TIERS:
        raise HTTPException(status_code=400, detail="Invalid analysis tier")
    if modality_focus not in VALID_MODALITY_FOCUS:
        raise HTTPException(status_code=400, detail="Invalid modality focus")
    if morphology_pack_policy not in VALID_MORPHOLOGY_PACK_POLICIES:
        raise HTTPException(status_code=400, detail="Invalid morphology pack policy")

    analysis_profile = resolve_analysis_profile(
        pipeline_type=pipeline_type,
        analysis_tier=analysis_tier,
        modality_focus=modality_focus,
    )
    language_pack_policy = build_language_pack_policy(
        morphology_pack_policy=morphology_pack_policy,
        morphology_languages=morphology_languages,
        special_use_morphology_language=special_use_morphology_language,
        allow_rough_interpretation=allow_rough_interpretation,
    )

    # Update status
    status["status"] = "processing"
    status["start_time"] = time.time()
    status["pipeline_type"] = analysis_profile["pipeline_type"]
    status["analysis_tier"] = analysis_tier
    status["modality_focus"] = modality_focus
    status["analysis_profile"] = analysis_profile
    status["language_pack_policy"] = language_pack_policy
    status["apply_face_anonymization"] = apply_face_anonymization
    status["face_message_style"] = face_message_style
    status["face_requires_person_detection"] = face_requires_person_detection
    status["analysis_started_at"] = utc_now_iso()
    status["analysis_completed_at"] = None
    append_analysis_event(
        status,
        "analysis_started",
        details={
            "pipeline_type": analysis_profile["pipeline_type"],
            "analysis_tier": analysis_tier,
            "modality_focus": modality_focus,
            "language_pack_policy": language_pack_policy,
            "apply_face_anonymization": apply_face_anonymization,
            "face_message_style": face_message_style,
            "face_requires_person_detection": face_requires_person_detection,
        },
    )
    update_analysis_progress(
        status,
        5,
        "queued",
        "Launch sequence accepted. Analysis crew is assembling.",
    )
    
    # Add analysis to background tasks
    background_tasks.add_task(
        run_complete_analysis,
        analysis_id,
        analysis_profile["pipeline_type"],
        analysis_tier,
        modality_focus,
        apply_face_anonymization,
        face_message_style,
        face_requires_person_detection,
    )

    logger.info(
        "Analysis started for %s with pipeline=%s tier=%s modality=%s",
        analysis_id,
        analysis_profile["pipeline_type"],
        analysis_tier,
        modality_focus,
    )
    
    return {
        "analysis_id": analysis_id,
        "status": "processing",
        "message": f"Analysis started with {analysis_profile['pipeline_type']} pipeline",
        "progress": 5,
        "pipeline_type": analysis_profile["pipeline_type"],
        "analysis_tier": analysis_tier,
        "modality_focus": modality_focus,
        "language_pack_policy": language_pack_policy,
        "apply_face_anonymization": apply_face_anonymization,
        "face_message_style": face_message_style,
        "face_requires_person_detection": face_requires_person_detection,
    }

def run_complete_analysis(
    analysis_id: str,
    pipeline_type: str,
    analysis_tier: str = "science_scan",
    modality_focus: str = "multimodal",
    apply_face_anonymization: bool = False,
    face_message_style: str = "plain",
    face_requires_person_detection: bool = False,
):
    """Run the complete analysis pipeline in background"""
    try:
        status = analysis_status[analysis_id]
        video_path = status["file_path"]
        analysis_profile = status.get("analysis_profile") or resolve_analysis_profile(
            pipeline_type=pipeline_type,
            analysis_tier=analysis_tier,
            modality_focus=modality_focus,
        )
        enable_object_detection = bool(analysis_profile.get("enable_object_detection", True))
        enable_ocr = bool(analysis_profile.get("enable_ocr", True))
        enable_expression_detection = bool(analysis_profile.get("enable_expression_detection", True))
        enable_audio_analysis = bool(analysis_profile.get("enable_audio_analysis", True))
        save_annotated_video = bool(analysis_profile.get("save_annotated_video", True))
        detection_interval_seconds = float(analysis_profile.get("detection_interval_seconds", 0.0))
        ocr_interval_seconds = float(analysis_profile.get("ocr_interval_seconds", 1.0))
        expression_interval_seconds = float(analysis_profile.get("expression_interval_seconds", 1.0))
        enable_face_sampling = bool(analysis_profile.get("enable_face_sampling", True)) and (
            enable_expression_detection or apply_face_anonymization
        )
        effective_face_requires_person_detection = bool(face_requires_person_detection)
        if analysis_tier == "quick_sweep" and enable_face_sampling:
            effective_face_requires_person_detection = True
        
        logger.info(f"🚀 Starting {pipeline_type} analysis pipeline for {analysis_id}")
        logger.info(f"📁 Video path: {video_path}")
        
        # Verify the video file exists
        if not Path(video_path).exists():
            error_msg = f"Video file not found: {video_path}"
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
        
        logger.info("✅ Video file exists")
        update_analysis_progress(
            status,
            10,
            "preflight",
            "Preflight checks complete. Main sensors are coming online.",
        )
        
        # Create output directory for this analysis
        analysis_output_dir = RESULTS_DIR / analysis_id
        analysis_output_dir.mkdir(exist_ok=True)
        
        results = {}
        output_files = {}
        
        # VISUAL PROCESSING (YOLO + OCR)
        if pipeline_type in ["full", "visual_only"]:
            try:
                logger.info("🎥 Starting visual analysis pipeline...")
                update_analysis_progress(
                    status,
                    20,
                    "visual_scan",
                    "Visual sensor sweep engaged.",
                )
                
                # Initialize frame analysis pipeline. Anonymization stays opt-in.
                frame_pipeline = FrameAnalysisPipeline(
                    video_path,
                    enable_object_detection=enable_object_detection,
                    enable_ocr=enable_ocr,
                    detection_interval_seconds=detection_interval_seconds,
                    ocr_interval_seconds=ocr_interval_seconds,
                    enable_face_sampling=enable_face_sampling,
                    apply_face_anonymization=apply_face_anonymization,
                    face_message_style=face_message_style,
                    face_requires_person_detection=effective_face_requires_person_detection,
                )
                
                # Run the analysis
                visual_results = frame_pipeline.analyze(
                    save_video=save_annotated_video,
                    display=False
                )
                update_analysis_progress(
                    status,
                    45 if pipeline_type == "full" else 90,
                    "visual_complete",
                    "Visual sweep complete. Detection logs are in hand.",
                )
                
                # Store visual results
                results["visual_analysis"] = {
                    "yolo_results": visual_results.get("yolo_results", []),
                    "tracked_objects": visual_results.get("tracked_objects", []),
                    "ocr_results": visual_results.get("ocr_results", []),
                    "cinematic_clues": visual_results.get("cinematic_clues", {}),
                    "spatial_tone_scan": visual_results.get("spatial_tone_scan", {}),
                    "motion_evidence": visual_results.get("motion_evidence", {}),
                    "scene_segments": visual_results.get("scene_segments", {}),
                    "shot_boundaries": visual_results.get("shot_boundaries", {}),
                    "face_results": visual_results.get("face_results"),
                    "face_anonymization": visual_results.get("face_anonymization"),
                    "face_anonymization_enabled": visual_results.get("face_anonymization_enabled", False),
                    "face_requires_person_detection": visual_results.get("face_requires_person_detection", False),
                    "face_sampling": visual_results.get("face_sampling", {}),
                    "annotated_video": visual_results.get("annotated_video"),
                    "yolo_csv": visual_results.get("yolo_csv"),
                    "tracked_objects_csv": visual_results.get("tracked_objects_csv"),
                    "tracked_objects_json": visual_results.get("tracked_objects_json"),
                    "ocr_csv": visual_results.get("ocr_csv"),
                    "summary_json": visual_results.get("summary_json")
                }
                
                # Expression detection
                if enable_expression_detection:
                    try:
                        logger.info("Starting expression detection...")
                        expression_detector = ExpressionDetectorDeepFace(
                            interval=expression_interval_seconds,
                            face_detector="dnn",
                            precheck=True,
                            skip_by_seek=True,
                        )
                        expression_results = expression_detector.run(video_path)
                        logger.info(f"Expression detection completed: {len(expression_results)} samples")

                        # Save expression results to JSON file
                        expression_json_path = RESULTS_DIR / f"{analysis_id}_expressions.json"
                        with open(expression_json_path, "w", encoding="utf-8") as f:
                            json.dump(expression_results, f, indent=2)
                        logger.info(f"Expression results saved: {expression_json_path}")
                        expression_status = "completed"
                        expression_error = None
                    except Exception as expr_exc:
                        logger.warning("Expression detection failed: %s", expr_exc)
                        expression_results = []
                        expression_json_path = None
                        expression_status = "failed"
                        expression_error = str(expr_exc)
                else:
                    expression_results = []
                    expression_json_path = None
                    expression_status = "not_run"
                    expression_error = None

                # Add expression results to visual_analysis
                results["visual_analysis"]["expression_results"] = expression_results
                results["visual_analysis"]["expression_status"] = expression_status
                results["visual_analysis"]["expression_error"] = expression_error
                
                # Add output files for download
                output_files["video"] = visual_results.get("annotated_video")
                output_files["yolo_csv"] = visual_results.get("yolo_csv")
                output_files["tracked_objects_csv"] = visual_results.get("tracked_objects_csv")
                output_files["tracked_objects_json"] = visual_results.get("tracked_objects_json")
                output_files["ocr_csv"] = visual_results.get("ocr_csv")
                output_files["summary_json"] = visual_results.get("summary_json")
                face_anonymization = visual_results.get("face_anonymization")
                if face_anonymization and face_anonymization.get("manifest_path"):
                    output_files["face_anonymization_manifest"] = face_anonymization["manifest_path"]
                if expression_json_path:
                    output_files["expression_json"] = str(expression_json_path)
                write_time_bank_artifact(
                    status,
                    output_files,
                    source_key="tracked_objects_csv",
                    artifact_key="time_bank_objects",
                    suffix="time_bank_objects",
                    linker=link_object_csv_to_trace,
                )
                write_time_bank_artifact(
                    status,
                    output_files,
                    source_key="ocr_csv",
                    artifact_key="time_bank_ocr",
                    suffix="time_bank_ocr",
                    linker=link_ocr_csv_to_trace,
                )
                if expression_json_path:
                    write_time_bank_artifact(
                        status,
                        output_files,
                        source_key="expression_json",
                        artifact_key="time_bank_expressions",
                        suffix="time_bank_expressions",
                        linker=link_expression_json_to_trace,
                    )
                
                logger.info(f"✅ Visual analysis completed: {len(visual_results.get('yolo_results', []))} detections")
                
            except Exception as visual_error:
                logger.error(f"❌ Visual pipeline failed: {str(visual_error)}")
                import traceback
                logger.error(f"📝 Traceback: {traceback.format_exc()}")
                results["visual_error"] = str(visual_error)
        
        # AUDIO PROCESSING 
        if pipeline_type in ["full", "audio_only"] and enable_audio_analysis:
            try:
                logger.info("🎵 Starting audio pipeline...")
                pos_path: Optional[Path] = None
                quan_path: Optional[Path] = None
                update_analysis_progress(
                    status,
                    50 if pipeline_type == "full" else 20,
                    "audio_extract",
                    "Audio channel aligned. Extracting signal from the source.",
                )

                # Step 1: Extract audio
                ingestion_result = run_ingestion_pipeline(video_path)
                audio_path = ingestion_result["audio_path"]
                if ingestion_result.get("metadata"):
                    enriched_probe = {
                        **(status.get("source_media_metadata") or {}),
                        **ingestion_result.get("metadata", {}),
                    }
                    status["source_media_metadata"] = enriched_probe

                if not Path(audio_path).exists():
                    raise FileNotFoundError(f"Audio file not found: {audio_path}")

                # Step 2a: Transcribe using the existing Whisper-based pipeline
                audio_pipeline = AudioTranscriptionPipeline(str(audio_path))
                update_analysis_progress(
                    status,
                    60 if pipeline_type == "full" else 35,
                    "transcription",
                    "Transcription relay engaged. Parsing spoken signal.",
                )
                transcript = audio_pipeline.run()
                transcript_quality = build_transcript_quality_report(
                    transcript,
                    media_duration_seconds=(
                        ingestion_result.get("metadata", {}) or {}
                    ).get("duration"),
                    audio_duration_seconds=get_wav_duration_seconds(audio_path),
                )
                if transcript_quality.get("status") != "ok":
                    logger.warning(
                        "Transcript coverage flagged as %s for %s: last_end=%ss target=%ss gap=%ss",
                        transcript_quality.get("status"),
                        analysis_id,
                        transcript_quality.get("last_segment_end_seconds"),
                        transcript_quality.get("coverage_target_seconds"),
                        transcript_quality.get("trailing_uncovered_seconds"),
                    )
                    append_analysis_event(
                        status,
                        "transcript_quality_flagged",
                        progress=status.get("progress"),
                        stage="transcription",
                        message="Transcript coverage flagged for review.",
                        details=transcript_quality,
                    )
                    update_analysis_progress(
                        status,
                        64 if pipeline_type == "full" else 40,
                        "transcription_fallback",
                        "Transcript coverage degraded. Retrying with chunked relay windows.",
                    )
                    fallback_candidate = audio_pipeline.rerun_with_chunked_fallback(
                        primary_transcript=transcript,
                    )
                    transcript["automatic_fallback_candidate"] = {
                        "transcription_strategy": fallback_candidate.get("transcription_strategy"),
                        "fallback_used": fallback_candidate.get("fallback_used"),
                        "chunking": fallback_candidate.get("chunking"),
                        "segments": fallback_candidate.get("segments", []),
                        "created_at": fallback_candidate.get("created_at"),
                        "fallback_comparison": fallback_candidate.get("fallback_comparison"),
                        "candidate_reason": "chunked_fallback_preserved_as_candidate_not_transcript_clock",
                    }
                    transcript_quality = build_transcript_quality_report(
                        transcript,
                        media_duration_seconds=(
                            ingestion_result.get("metadata", {}) or {}
                        ).get("duration"),
                        audio_duration_seconds=get_wav_duration_seconds(audio_path),
                    )
                    append_analysis_event(
                        status,
                        "transcript_fallback_completed",
                        progress=status.get("progress"),
                        stage="transcription_fallback",
                        message="Chunked transcript fallback completed.",
                        details={
                            "strategy": fallback_candidate.get("transcription_strategy"),
                            "quality": transcript_quality,
                            "comparison": fallback_candidate.get("fallback_comparison") or {},
                            "clock_policy": "fallback_candidate_not_transcript_time_authority",
                        },
                    )

                transcript_text = " ".join(
                    seg["text"] for seg in transcript.get("segments", [])
                )
                language_info = build_language_profile(
                    transcript.get("language"),
                    transcript_text,
                )
                transcript["language"] = language_info["code"]
                transcript["language_name"] = language_info["name"]
                transcript["language_info"] = language_info
                transcript["quality"] = transcript_quality
                transcript["timeline_segments"] = build_transcript_timeline_segments(
                    transcript,
                    coverage_target_seconds=transcript_quality.get(
                        "coverage_target_seconds"
                    ),
                )
                status["transcript_quality"] = transcript_quality

                # Step 2b: additionally run the Meta MMS language modeller and
                # stash its raw text alongside the Whisper result.  This is a
                # separate step so both engines are exercised independently.
                try:
                    update_analysis_progress(
                        status,
                        68 if pipeline_type == "full" else 45,
                        "language_model",
                        "Language model on standby. Calibrating the channel map.",
                    )
                    lm_transcriber = MMSASRTranscriber(
                        target_lang=language_info.get("iso6393") or "eng",
                        model_id=DEFAULT_MMS_MODEL_ID,
                        chunk_length_s=30.0,
                        device=None,
                    )
                    lm_text = lm_transcriber.transcribe(audio_path)
                    logger.info("✅ Language modeller transcript length: %d", len(lm_text))
                    # LM output will be saved in a separate file later; do not
                    # modify the Whisper pipeline result.
                except Exception as lm_exc:
                    logger.warning("Language modeller step failed: %s", lm_exc)
                    lm_text = None  # Indicate failure

                # Step 3: Prepare organized paths
                audio_filename = f"{analysis_id}_audio.wav"
                transcript_filename = f"{analysis_id}_transcript.json"  # Whisper output stays with original name
                raw_whisper_transcript_filename = f"{analysis_id}_transcript_raw_whisper.json"
                lm_transcript_filename = f"{analysis_id}_lm_transcript.json"
                audio_prosody_filename = f"{analysis_id}_audio_prosody.json"
                audio_event_intervals_filename = f"{analysis_id}_audio_event_intervals.json"
                audio_diarization_filename = f"{analysis_id}_audio_diarization.json"
                audio_sample_clouds_filename = f"{analysis_id}_audio_sample_clouds.json"

                organized_audio_path = AUDIO_DIR / audio_filename
                organized_transcript_path = TRANSCRIPTS_DIR / transcript_filename
                organized_raw_whisper_path = TRANSCRIPTS_DIR / raw_whisper_transcript_filename
                organized_lm_path = TRANSCRIPTS_DIR / lm_transcript_filename
                organized_audio_prosody_path = TRANSCRIPTS_DIR / audio_prosody_filename
                organized_audio_event_intervals_path = TRANSCRIPTS_DIR / audio_event_intervals_filename
                organized_audio_diarization_path = TRANSCRIPTS_DIR / audio_diarization_filename
                organized_audio_sample_clouds_path = TRANSCRIPTS_DIR / audio_sample_clouds_filename

                # Ensure dirs exist
                AUDIO_DIR.mkdir(parents=True, exist_ok=True)
                TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

                # Step 4: Move audio
                shutil.move(audio_path, organized_audio_path)

                # Step 5: Locate transcript file
                original_transcript_dir = Path(audio_path).parent / "transcripts"
                original_transcript_path = original_transcript_dir / f"{Path(audio_path).stem}_transcript.json"
                original_raw_whisper_path = original_transcript_dir / f"{Path(audio_path).stem}_transcript_raw_whisper.json"

                if not original_transcript_path.exists():
                    alternative_path = audio_pipeline.output_dir / f"{Path(audio_path).stem}_transcript.json"
                    original_transcript_path = alternative_path

                if not original_transcript_path.exists():
                    raise FileNotFoundError("Transcript file not found")

                # Step 6: Move transcript
                shutil.move(str(original_transcript_path), organized_transcript_path)
                with open(organized_transcript_path, "w", encoding="utf-8") as f:
                    json.dump(transcript, f, indent=2, ensure_ascii=False)
                if original_raw_whisper_path.exists():
                    shutil.copy2(str(original_raw_whisper_path), organized_raw_whisper_path)
                else:
                    with open(organized_raw_whisper_path, "w", encoding="utf-8") as f:
                        json.dump(
                            {
                                **transcript,
                                "transcription_strategy": "original_whisper_timecode",
                            },
                            f,
                            indent=2,
                            ensure_ascii=False,
                        )
                output_files["audio"] = str(organized_audio_path)
                output_files["transcript"] = str(organized_transcript_path)
                output_files["raw_whisper_transcript"] = str(organized_raw_whisper_path)
                write_linked_transcript_artifact(status, transcript, output_files)

                try:
                    update_analysis_progress(
                        status,
                        72 if pipeline_type == "full" else 52,
                        "audio_prosody",
                        "Prosody sensors are mapping pace, pauses, emphasis, and pitch-energy contours.",
                    )
                    audio_prosody = analyze_audio_prosody(
                        organized_audio_path,
                        transcript.get("segments", []),
                    )
                    with open(organized_audio_prosody_path, "w", encoding="utf-8") as f:
                        json.dump(audio_prosody, f, indent=2, ensure_ascii=False)
                    output_files["audio_prosody"] = str(organized_audio_prosody_path)
                    audio_events = audio_prosody.get("audio_event_intervals") if isinstance(audio_prosody, dict) else None
                    if isinstance(audio_events, dict):
                        with open(organized_audio_event_intervals_path, "w", encoding="utf-8") as f:
                            json.dump(audio_events, f, indent=2, ensure_ascii=False)
                        output_files["audio_event_intervals"] = str(organized_audio_event_intervals_path)
                except Exception as prosody_error:
                    logger.warning("Audio prosody analysis failed: %s", prosody_error)
                    results["audio_prosody_error"] = str(prosody_error)
                    audio_prosody = None

                try:
                    audio_diarization = write_audio_diarization(
                        analysis_id,
                        audio_path=organized_audio_path,
                        output_json_path=organized_audio_diarization_path,
                        transcript=transcript,
                        audio_prosody=audio_prosody,
                    )
                    output_files["audio_diarization"] = str(organized_audio_diarization_path)
                except Exception as diarization_error:
                    logger.warning("Audio diarization scaffold failed: %s", diarization_error)
                    results["audio_diarization_error"] = str(diarization_error)
                    audio_diarization = None

                try:
                    source_media_context = build_source_media_metadata_payload(status)
                    measured_audio_ready = bool(
                        audio_diarization
                        and audio_diarization.get("status") == "completed_measured"
                    )
                    diarization_clouds = (
                        build_audio_sample_clouds_from_diarization(
                            analysis_id,
                            audio_diarization=audio_diarization,
                            source_media_context=source_media_context,
                            source_audio_path=organized_audio_path,
                        )
                        if measured_audio_ready
                        else None
                    )
                    narrative_agent_clouds = (
                        build_audio_sample_clouds_for_narrative_agents(
                            analysis_id,
                            transcript=transcript,
                            audio_prosody=audio_prosody,
                            source_media_context=source_media_context,
                            source_audio_path=organized_audio_path,
                        )
                        if measured_audio_ready
                        else None
                    )
                    audio_sample_clouds = merge_audio_sample_cloud_payloads(
                        analysis_id,
                        diarization_clouds,
                        narrative_agent_clouds,
                    )
                    audio_sample_clouds["audio_diarization_status"] = (
                        (audio_diarization or {}).get("status")
                    )
                    audio_sample_clouds["audio_measurement_provider"] = (
                        (audio_diarization or {}).get("provider")
                    )
                    with open(organized_audio_sample_clouds_path, "w", encoding="utf-8") as f:
                        json.dump(audio_sample_clouds, f, indent=2, ensure_ascii=False)
                    output_files["audio_sample_clouds"] = str(organized_audio_sample_clouds_path)
                except Exception as sample_cloud_error:
                    logger.warning("Audio sample cloud build failed: %s", sample_cloud_error)
                    results["audio_sample_cloud_error"] = str(sample_cloud_error)
                    audio_sample_clouds = None

                # write the language model text to its own file
                if lm_text is not None:
                    try:
                        with open(organized_lm_path, "w", encoding="utf-8") as f:
                            json.dump({"lm_text": lm_text}, f, indent=2, ensure_ascii=False)
                        logger.info("LM transcript saved: %s", organized_lm_path)
                        output_files["lm_transcript"] = str(organized_lm_path)
                    except Exception as exc:
                        logger.warning("Failed to write LM transcript: %s", exc)
                else:
                    logger.info("Skipping LM transcript write due to earlier failure")

                # Step 7: POS analysis (AFTER transcript exists in final place)
                try:
                    logger.info("📝 Starting POS analysis on transcript...")
                    update_analysis_progress(
                        status,
                        76 if pipeline_type == "full" else 60,
                        "pos_analysis",
                        "Linguistic sensors are tagging the transcript structure.",
                    )
                    with open(organized_transcript_path, "r", encoding="utf-8") as f:
                        data = json.load(f)

                    text = " ".join(
                        seg["text"] for seg in data.get("segments", [])
                    )

                    pos_analyzer = POSAnalysis(
                        text,
                        language_code=transcript.get("language", "en"),
                    )
                    pos_result = pos_analyzer.run()
                    pos_result["transcript_timing_authority"] = build_transcript_timing_authority(
                        transcript
                    )
                    pos_result["source_transcript_clock"] = "operational_transcript"

                    pos_path_init = f"{analysis_id}_pos.json"
                    pos_path = TRANSCRIPTS_DIR / pos_path_init
                    pos_path.parent.mkdir(exist_ok=True, parents=True)

                    with open(pos_path, "w", encoding="utf-8") as f:
                        json.dump(pos_result, f, indent=2, ensure_ascii=False)

                    logger.info(f"POS Results saved: {pos_path}")
                    output_files["pos_analysis"] = str(pos_path)
                except Exception as pos_error:
                    logger.error(f"❌ POS analysis failed: {str(pos_error)}")
                    import traceback
                    logger.error(traceback.format_exc())
                    results["pos_error"] = str(pos_error)

                # Additional Quantitative Analysis

                transcript_language = transcript.get("language", "en")
                files = [organized_transcript_path]
                docs = [text]
                quant_document_label = (
                    Path(status.get("original_filename") or organized_transcript_path.name).stem
                )

                quan_path_init = f"{analysis_id}_quan.json"
                quan_path = TRANSCRIPTS_DIR / quan_path_init
                quan_path.parent.mkdir(exist_ok=True, parents=True)

                try:
                    update_analysis_progress(
                        status,
                        86 if pipeline_type == "full" else 75,
                        "quant_analysis",
                        "Quant lens engaged. Distilling signal into evidence patterns.",
                    )
                    qa = QuantitativeAnalysis(
                        docs=docs,
                        file_paths=files,
                        document_labels=[quant_document_label],
                        language_code=transcript_language,
                    )
                    quan_result = qa.run()
                    quan_result = attach_quant_evidence_to_transcript(
                        quan_result,
                        transcript.get("segments", []),
                    )
                    quan_result["transcript_timing_authority"] = build_transcript_timing_authority(
                        transcript
                    )
                    quan_result["source_transcript_clock"] = "operational_transcript"

                    def normalize_for_json(value):
                        try:
                            import pandas as pd
                            if isinstance(value, pd.DataFrame):
                                return value.to_dict(orient="records")
                        except Exception:
                            pass

                        if isinstance(value, dict):
                            return {k: normalize_for_json(v) for k, v in value.items()}
                        if isinstance(value, list):
                            return [normalize_for_json(v) for v in value]
                        return value

                    normalized_quan = normalize_for_json(quan_result)

                    with open(quan_path, "w", encoding="utf-8") as f:
                        json.dump(normalized_quan, f, indent=2, ensure_ascii=False)

                    logger.info(f"QuantitativeAnalysis Results saved: {quan_path}")
                    output_files["quan_analysis"] = str(quan_path)
                except Exception as quan_error:
                    logger.error(f"❌ Quantitative analysis failed: {str(quan_error)}")
                    import traceback
                    logger.error(traceback.format_exc())
                    results["quan_error"] = str(quan_error)

                # Step 8: Store results
                results["audio_analysis"] = {
                    "audio_path": str(organized_audio_path),
                    "transcript_path": str(organized_transcript_path),
                    "linked_transcript_path": output_files.get("linked_transcript"),
                    "audio_prosody_path": str(organized_audio_prosody_path)
                    if output_files.get("audio_prosody")
                    else None,
                    "audio_event_intervals_path": str(organized_audio_event_intervals_path)
                    if output_files.get("audio_event_intervals")
                    else None,
                    "audio_diarization_path": str(organized_audio_diarization_path)
                    if output_files.get("audio_diarization")
                    else None,
                    "audio_sample_clouds_path": str(organized_audio_sample_clouds_path)
                    if output_files.get("audio_sample_clouds")
                    else None,
                    "lm_transcript_path": str(organized_lm_path) if lm_text is not None else None,
                    "pos_analysis": str(pos_path) if pos_path else None,
                    "quan_analysis": str(quan_path) if quan_path else None,
                    "audio_prosody": audio_prosody,
                    "audio_event_intervals": (
                        audio_prosody.get("audio_event_intervals")
                        if isinstance(audio_prosody, dict)
                        else None
                    ),
                    "audio_diarization": audio_diarization,
                    "audio_sample_clouds": audio_sample_clouds,
                    "transcript": transcript,
                    "transcript_quality": transcript_quality,
                    "metadata": ingestion_result.get("metadata", {}),
                }

                logger.info("✅ Audio pipeline completed successfully")
                update_analysis_progress(
                    status,
                    95,
                    "audio_complete",
                    "Audio branch complete. Report consolidation underway.",
                )

            except Exception as audio_error:
                logger.error(f"❌ Audio pipeline failed: {str(audio_error)}")
                import traceback
                logger.error(traceback.format_exc())
                results["audio_error"] = str(audio_error)

        status["results"] = results
        status["output_files"] = output_files

        # AGENT PERSISTENCE
        if pipeline_type in ["full", "visual_only"]:
            if should_run_agent_persistence_for_status(status):
                try:
                    update_analysis_progress(
                        status,
                        92,
                        "agent_persistence",
                        "Running agent persistence analysis across scene cuts.",
                    )
                    agent_persistence_path = analysis_output_dir / "agent_persistence_scene_cut.json"
                    agent_persistence_payload = write_agent_persistence_artifact_for_status(
                        status,
                        agent_persistence_path,
                    )
                    status["agent_persistence_scene_cut"] = {
                        **agent_persistence_payload,
                        "output_json_path": str(agent_persistence_path),
                        "updated_at": utc_now_iso(),
                    }
                    output_files["agent_persistence_scene_cut"] = str(agent_persistence_path)
                    status.setdefault("internal_artifacts", {})["agent_persistence_scene_cut"] = str(
                        agent_persistence_path
                    )
                    append_analysis_event(
                        status,
                        "agent_persistence_created",
                        details={
                            "candidate_count": (agent_persistence_payload.get("summary") or {}).get(
                                "candidate_count", 0
                            ),
                            "accepted_count": (agent_persistence_payload.get("summary") or {}).get("accepted_count", 0),
                        },
                    )
                except Exception as agent_error:
                    logger.warning("Agent persistence analysis failed: %s", agent_error)
                    results["agent_persistence_error"] = str(agent_error)
            else:
                append_analysis_event(
                    status,
                    "agent_persistence_skipped",
                    details={
                        "reason": "requires visual scene cuts and comparable tracked-agent feature samples",
                    },
                )
        
        # MARK AS COMPLETED
        source_video_path = status.get("source_video_path") or status.get("file_path")
        if source_video_path and Path(source_video_path).exists():
            output_files["source_video"] = str(source_video_path)

        status.update({
            "status": "completed",
            "progress": 100,
            "results": results,
            "output_files": output_files,
            "end_time": time.time(),
            "analysis_completed_at": utc_now_iso(),
        })
        write_source_media_metadata_files(status)
        try:
            proliferation_plan = write_second_order_meaning_artifacts_for_status(status)
            if proliferation_plan:
                append_analysis_event(
                    status,
                    "second_order_label_proliferation_created",
                    details={
                        "instruction_count": (
                            proliferation_plan.get("summary") or {}
                        ).get("instruction_count", 0),
                        "immediate_confirmation_count": (
                            proliferation_plan.get("summary") or {}
                        ).get("immediate_confirmation_count", 0),
                    },
                )
        except Exception as proliferation_error:
            logger.warning(
                "Second-order label proliferation failed: %s",
                proliferation_error,
            )
            status.setdefault("results", {})[
                "second_order_label_proliferation_error"
            ] = str(proliferation_error)
        if results.get("agent_persistence_error"):
            status.setdefault("results", {})["agent_persistence_error"] = results[
                "agent_persistence_error"
            ]
        try:
            triangulation_bundle = write_identity_triangulation_artifact_for_status(status)
            if triangulation_bundle:
                append_analysis_event(
                    status,
                    "identity_triangulation_bundle_created",
                    details={
                        "identity_count": triangulation_bundle.get("identity_count", 0),
                        "proliferation_ready_count": triangulation_bundle.get(
                            "proliferation_ready_count",
                            0,
                        ),
                    },
                )
        except Exception as triangulation_error:
            logger.warning("Identity triangulation bundle failed: %s", triangulation_error)
            status.setdefault("results", {})["identity_triangulation_error"] = str(
                triangulation_error
            )
        try:
            scene_card_bundle = write_mise_en_scene_artifacts_for_status(status)
            if scene_card_bundle:
                append_analysis_event(
                    status,
                    "mise_en_scene_scene_cards_created",
                    details={
                        "scene_card_count": len(scene_card_bundle.get("scene_cards") or []),
                        "source_extraction_metadata_summary": (
                            status.get("source_extraction_metadata_summary") or {}
                        ).get("output_json_path"),
                    },
                )
        except Exception as scene_card_error:
            logger.warning("Mise-en-scene scene card build failed: %s", scene_card_error)
            status.setdefault("results", {})["mise_en_scene_scene_cards_error"] = str(
                scene_card_error
            )
        status["mission_stage"] = "complete"
        status["mission_message"] = "All available stations have reported in."
        append_analysis_event(
            status,
            "analysis_completed",
            progress=100,
            stage="complete",
            message="All available stations have reported in.",
            details={
                "result_keys": list(results.keys()),
                "output_file_types": sorted(output_files.keys()),
            },
        )
        persist_analysis_record_for_status(status)
        
        logger.info(f"🎉 Analysis marked as COMPLETED for {analysis_id}")
        logger.info(f"📊 Results keys: {list(results.keys())}")
        logger.info(f"📁 Output files: {output_files}")
        
    except Exception as e:
        logger.error(f"💥 Analysis failed for {analysis_id}: {str(e)}")
        import traceback
        logger.error(f"📝 Traceback: {traceback.format_exc()}")
        
        analysis_status[analysis_id].update({
            "status": "error", 
            "error": str(e),
            "progress": 0,
            "end_time": time.time(),
            "analysis_completed_at": utc_now_iso(),
        })
        analysis_status[analysis_id]["mission_stage"] = "red_alert"
        analysis_status[analysis_id]["mission_message"] = (
            "A critical subsystem went offline. Review the captain's log."
        )
        append_analysis_event(
            analysis_status[analysis_id],
            "analysis_failed",
            progress=0,
            stage="red_alert",
            message="A critical subsystem went offline. Review the captain's log.",
            details={"error": str(e)},
        )
        persist_analysis_record_for_status(analysis_status[analysis_id])

@app.post("/api/analysis/{analysis_id}/refine-identities", response_model=dict)
async def run_identity_refinement(analysis_id: str) -> dict:
    """
    Run iterative identification refinement loop to embed character/role tracking
    into the existing track and object annotations.
    """
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    analysis_dir = RESULTS_DIR / analysis_id
    internal_artifacts = status.setdefault("internal_artifacts", {})
    master_json_path = internal_artifacts.get("vaa1_annotation_master_schema")
    if not master_json_path:
        master_json_path = str(analysis_dir / "vaa1_annotation_master_schema.json")

    output_json_path = analysis_dir / "identity_refinement_candidates.json"

    result = refine_identities(
        analysis_id,
        master_json_path=master_json_path,
        output_json_path=output_json_path,
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))

    internal_artifacts["identity_refinement_candidates"] = result.get("output_json_path")
    status["identity_refinement"] = {
        "status": "candidate_review_required",
        "candidate_count": result.get("candidate_count", 0),
        "output_json_path": result.get("output_json_path"),
        "master_json_path": result.get("master_json_path"),
        "updated_at": utc_now_iso(),
    }
    append_analysis_event(
        status,
        "identity_refinement_candidates_created",
        details={
            "candidate_count": result.get("candidate_count", 0),
            "output_json_path": result.get("output_json_path"),
            "master_json_path": result.get("master_json_path"),
        },
    )
    persist_analysis_record_for_status(status)

    return make_json_safe(result)


@app.get("/api/analysis/{analysis_id}/identity-candidates", response_model=dict)
async def get_identity_candidates(analysis_id: str) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    output_json_path = (
        status.get("internal_artifacts", {}).get("identity_refinement_candidates")
        or RESULTS_DIR / analysis_id / "identity_refinement_candidates.json"
    )
    ledger = load_identity_candidate_ledger(
        analysis_id,
        output_json_path=output_json_path,
    )
    return make_json_safe(ledger)


@app.post("/api/analysis/{analysis_id}/identity-candidates/{candidate_id}/promote", response_model=dict)
async def promote_identity_candidate_endpoint(
    analysis_id: str,
    candidate_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    identity_label = str(payload.get("identity_label") or "").strip()
    reviewer = str(payload.get("reviewer") or "analyst").strip() or "analyst"
    internal_artifacts = status.setdefault("internal_artifacts", {})
    analysis_dir = RESULTS_DIR / analysis_id
    master_json_path = (
        internal_artifacts.get("vaa1_annotation_master_schema")
        or analysis_dir / "vaa1_annotation_master_schema.json"
    )
    output_json_path = (
        internal_artifacts.get("identity_refinement_candidates")
        or analysis_dir / "identity_refinement_candidates.json"
    )

    promoted_at = utc_now_iso()
    result = promote_identity_candidate(
        analysis_id,
        candidate_id=candidate_id,
        identity_label=identity_label,
        reviewer=reviewer,
        promoted_at=promoted_at,
        master_json_path=master_json_path,
        output_json_path=output_json_path,
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))

    status["vaa1_annotation_master_schema"] = json.loads(
        Path(str(master_json_path)).read_text(encoding="utf-8")
    )
    status.setdefault("identity_refinement", {})["last_promoted_candidate_id"] = candidate_id
    status.setdefault("identity_refinement", {})["last_promoted_at"] = promoted_at
    triangulation_bundle = write_identity_triangulation_artifact_for_status(
        status,
        reviewed_by=reviewer,
    )
    append_analysis_event(
        status,
        "identity_candidate_promoted",
        details={
            "candidate_id": candidate_id,
            "identity_label": identity_label,
            "master_json_path": str(master_json_path),
            "output_json_path": str(output_json_path),
            "triangulation_identity_count": (
                triangulation_bundle or {}
            ).get("identity_count"),
            "triangulation_proliferation_ready_count": (
                triangulation_bundle or {}
            ).get("proliferation_ready_count"),
        },
    )
    persist_analysis_record_for_status(status)

    return make_json_safe(result)


@app.post("/api/analysis/{analysis_id}/proliferation/match", response_model=dict)
async def match_evidence_proliferation_endpoint(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    request = payload.get("request") if isinstance(payload.get("request"), dict) else payload
    request_id = str(request.get("request_id") or f"proliferate-{uuid.uuid4()}").strip()
    request["request_id"] = request_id

    analysis_dir = RESULTS_DIR / analysis_id
    safe_request_id = "".join(
        character if character.isalnum() or character in {"-", "_"} else "_"
        for character in request_id
    )[:96]
    output_json_path = (
        analysis_dir / f"evidence_proliferation_match_{safe_request_id}.json"
    )

    result = write_evidence_proliferation_match(
        analysis_id,
        status,
        request,
        output_json_path,
    )

    request_record = {
        "request_id": request_id,
        "status": result.get("status"),
        "candidate_count": result.get("candidate_count", 0),
        "output_json_path": str(output_json_path),
        "open_topology_som": result.get("open_topology_som"),
        "updated_at": utc_now_iso(),
    }
    status.setdefault("evidence_proliferation_matches", [])
    status["evidence_proliferation_matches"] = [
        request_record,
        *[
            item
            for item in status.get("evidence_proliferation_matches", [])
            if item.get("request_id") != request_id
        ],
    ][:25]
    status.setdefault("internal_artifacts", {})[
        f"evidence_proliferation_match:{request_id}"
    ] = str(output_json_path)
    append_analysis_event(
        status,
        "evidence_proliferation_match_completed",
        details={
            "request_id": request_id,
            "candidate_count": result.get("candidate_count", 0),
            "output_json_path": str(output_json_path),
        },
    )
    persist_analysis_record_for_status(status)

    return make_json_safe(result)


@app.post("/api/analysis/{analysis_id}/proliferation/refresh", response_model=dict)
async def refresh_evidence_proliferation_matcher_endpoint(
    analysis_id: str,
    payload: Optional[Dict[str, Any]] = Body(default=None),
) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    analysis_dir = RESULTS_DIR / analysis_id
    request_payload = payload if isinstance(payload, dict) else {}
    request_limit = int(request_payload.get("request_limit") or 12)
    candidate_limit = int(request_payload.get("candidate_limit") or 25)
    result = run_open_topology_scanner_refresh(
        analysis_id,
        status,
        analysis_dir,
        request_limit=max(1, min(request_limit, 24)),
        candidate_limit=max(1, min(candidate_limit, 50)),
    )

    match_summaries = [
        {
            "request_id": item.get("request_id"),
            "status": item.get("status"),
            "candidate_count": item.get("candidate_count", 0),
            "output_json_path": item.get("output_json_path"),
            "open_topology_som": item.get("open_topology_som"),
            "updated_at": item.get("updated_at") or utc_now_iso(),
        }
        for item in result.get("matches", [])
        if isinstance(item, dict)
    ]
    existing = [
        item
        for item in status.get("evidence_proliferation_matches", [])
        if isinstance(item, dict)
        and item.get("request_id") not in {summary.get("request_id") for summary in match_summaries}
    ]
    status["evidence_proliferation_matches"] = [*match_summaries, *existing][:50]
    status.setdefault("internal_artifacts", {})[
        "open_topology_scanner_refresh"
    ] = result.get("created_at")
    status.setdefault("scanner_matcher_refreshes", [])
    status["scanner_matcher_refreshes"] = [
        {
            "created_at": result.get("created_at"),
            "request_count": result.get("request_count"),
            "match_count": result.get("match_count"),
            "candidate_count": result.get("candidate_count"),
            "governance": result.get("governance"),
        },
        *status["scanner_matcher_refreshes"],
    ][:12]
    append_analysis_event(
        status,
        "open_topology_scanner_matcher_refreshed",
        details={
            "request_count": result.get("request_count"),
            "match_count": result.get("match_count"),
            "candidate_count": result.get("candidate_count"),
        },
    )
    persist_analysis_record_for_status(status)

    return make_json_safe(result)


def _clock_range_for_rows(rows: Any) -> Dict[str, Any]:
    starts: List[float] = []
    ends: List[float] = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        start, end = master_schema_interval_seconds(row)
        if start is None or end is None:
            continue
        starts.append(start)
        ends.append(end)
    return {
        "row_count": len(starts),
        "start": round(min(starts), 3) if starts else None,
        "end": round(max(ends), 3) if ends else None,
    }


def build_audio_timing_health_report(status: Dict[str, Any]) -> Dict[str, Any]:
    analysis_id = status.get("analysis_id")
    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    audio_analysis = ((status.get("results") or {}).get("audio_analysis") or {}) if isinstance(status.get("results"), dict) else {}
    transcript = audio_analysis.get("transcript") or read_json_artifact_if_available(output_files.get("transcript")) or {}
    prosody = audio_analysis.get("audio_prosody") or read_json_artifact_if_available(output_files.get("audio_prosody")) or {}
    diarization = audio_analysis.get("audio_diarization") or read_json_artifact_if_available(output_files.get("audio_diarization")) or {}
    sample_clouds = audio_analysis.get("audio_sample_clouds") or read_json_artifact_if_available(output_files.get("audio_sample_clouds")) or {}
    audio_path = output_files.get("audio") or audio_analysis.get("audio_path")
    diarization_health = audio_diarization_staleness(
        diarization if isinstance(diarization, dict) else {},
        transcript if isinstance(transcript, dict) else {},
        audio_path,
    )
    sample_rows = []
    for cloud in (sample_clouds or {}).get("clouds") or []:
        if isinstance(cloud, dict):
            sample_rows.extend([sample for sample in cloud.get("samples") or [] if isinstance(sample, dict)])
    return {
        "analysis_id": analysis_id,
        "canonical_time_basis": "source_media_seconds",
        "audio_path": audio_path,
        "transcript": {
            **_clock_range_for_rows((transcript or {}).get("segments") if isinstance(transcript, dict) else []),
            "fingerprint": (diarization or {}).get("transcript_fingerprint"),
            "strategy": (transcript or {}).get("transcription_strategy") if isinstance(transcript, dict) else None,
            "timing_repair": (transcript or {}).get("timing_repair") if isinstance(transcript, dict) else None,
        },
        "prosody": {
            **_clock_range_for_rows((prosody or {}).get("cues") if isinstance(prosody, dict) else []),
            "status": (prosody or {}).get("status") if isinstance(prosody, dict) else None,
        },
        "audio_diarization": {
            **_clock_range_for_rows((diarization or {}).get("speaker_turns") if isinstance(diarization, dict) else []),
            "status": (diarization or {}).get("status") if isinstance(diarization, dict) else None,
            "fingerprint": (diarization or {}).get("diarization_fingerprint") if isinstance(diarization, dict) else None,
            "timing_contract": (diarization or {}).get("timing_contract") if isinstance(diarization, dict) else None,
            "is_stale": diarization_health.get("is_stale"),
            "stale_reason": diarization_health.get("stale_reason"),
            "valid_for_confirmation_rows": sum(
                1
                for turn in ((diarization or {}).get("speaker_turns") or [])
                if isinstance(turn, dict) and turn.get("valid_for_confirmation") and not turn.get("is_stale")
            ),
        },
        "audio_sample_clouds": {
            **_clock_range_for_rows(sample_rows),
            "status": (sample_clouds or {}).get("status") if isinstance(sample_clouds, dict) else None,
            "fingerprint": (sample_clouds or {}).get("diarization_fingerprint") if isinstance(sample_clouds, dict) else None,
            "is_stale": bool((sample_clouds or {}).get("is_stale")) if isinstance(sample_clouds, dict) else None,
            "stale_reason": (sample_clouds or {}).get("stale_reason") if isinstance(sample_clouds, dict) else None,
            "valid_for_confirmation_rows": sum(
                1
                for sample in sample_rows
                if sample.get("valid_for_confirmation") and not sample.get("is_stale")
            ),
        },
    }


@app.get("/api/analysis/{analysis_id}/audio-timing-health", response_model=dict)
async def get_audio_timing_health(analysis_id: str) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    return make_json_safe(build_audio_timing_health_report(status))


@app.get("/api/status/{analysis_id}/summary", response_model=dict)
async def get_analysis_status_summary(analysis_id: str) -> dict:
    """Return the bounded shell/panel bootstrap view without materializing artifacts."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    visual = results.get("visual_analysis") if isinstance(results.get("visual_analysis"), dict) else {}
    audio = results.get("audio_analysis") if isinstance(results.get("audio_analysis"), dict) else {}
    source_video_path = status.get("source_video_path")
    return make_json_safe({
        "schema": "vaa1.analysis_status_summary.v1",
        "analysis_id": analysis_id,
        "status": status.get("status"),
        "progress": status.get("progress"),
        "mission_stage": status.get("mission_stage"),
        "mission_message": status.get("mission_message"),
        "filename": status.get("original_filename"),
        "error": status.get("error"),
        "pipeline_type": status.get("pipeline_type", "full"),
        "analysis_tier": status.get("analysis_tier", "science_scan"),
        "modality_focus": status.get("modality_focus", "multimodal"),
        "uploaded_at": status.get("uploaded_at"),
        "analysis_started_at": status.get("analysis_started_at"),
        "analysis_completed_at": status.get("analysis_completed_at"),
        "cvatID": status.get("cvatID", 0),
        "source_video_path": source_video_path,
        "source_video_exists": bool(source_video_path and Path(str(source_video_path)).exists()),
        "source_media_metadata": status.get("source_media_metadata"),
        "transcript_timing_repair": status.get("transcript_timing_repair"),
        "summary": {
            "yolo_detections": len(visual.get("yolo_results") or []),
            "tracked_objects": len(visual.get("tracked_objects") or []),
            "ocr_detections": len(visual.get("ocr_results") or []),
            "expression_samples": len(visual.get("expression_results") or []),
            "expression_status": visual.get("expression_status", "not_run"),
            "motion_evidence": visual.get("motion_evidence", {}),
            "scene_segments": visual.get("scene_segments", {}),
            "audio_segments": len((audio.get("transcript") or {}).get("segments") or []),
            "audio_language": (audio.get("transcript") or {}).get("language", "unknown"),
        },
        "canonical_summary": {
            "decision_count": len((status.get("canonical_decision_ledger") or {}).get("decisions") or []),
            "corrections_updated_at": (status.get("annotation_corrections") or {}).get("updated_at"),
        },
        "download_links": build_download_links(analysis_id, status.get("output_files") or {}),
    })


@app.get("/api/status/{analysis_id}", response_model=dict)
async def get_analysis_status(analysis_id: str) -> dict:
    """
    Get current status of analysis
    """
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    canonical_ledger = decision_ledger_for_status(status)
    canonical_projection = project_canonical_claims(
        analysis_id=analysis_id,
        decisions=canonical_ledger.get("decisions", []),
    )

    response_data = {
        "analysis_id": analysis_id,
        "status": status["status"],
        "progress": status["progress"],
        "mission_stage": status.get("mission_stage"),
        "mission_message": status.get("mission_message"),
        "filename": status["original_filename"],
        "error": status.get("error"),
        "pipeline_type": status.get("pipeline_type", "full"),
        "analysis_tier": status.get("analysis_tier", "science_scan"),
        "modality_focus": status.get("modality_focus", "multimodal"),
        "language_pack_policy": status.get("language_pack_policy"),
        "apply_face_anonymization": status.get("apply_face_anonymization", False),
        "face_message_style": status.get("face_message_style", "plain"),
        "face_requires_person_detection": status.get("face_requires_person_detection", False),
        "uploaded_at": status.get("uploaded_at"),
        "analysis_started_at": status.get("analysis_started_at"),
        "analysis_completed_at": status.get("analysis_completed_at"),
        "cvatID" : status["cvatID"],
        "event_log": status.get("event_log", []),
        "source_video_path": status.get("source_video_path"),
        "source_media_metadata": status.get("source_media_metadata"),
        "annotation_corrections": status.get("annotation_corrections"),
        "canonical_decision_ledger": canonical_ledger,
        "projected_canonical_claims": canonical_projection,
        "cvat_ingest": status.get("cvat_ingest"),
        "internal_artifacts": status.get("internal_artifacts"),
        "forensic_render_jobs": status.get("forensic_render_jobs", []),
        "source_samples": status.get("source_samples", []),
        "identity_refinement": status.get("identity_refinement"),
        "identity_triangulation": status.get("identity_triangulation"),
        "agent_persistence_scene_cut": status.get("agent_persistence_scene_cut"),
        "second_order_label_proliferation": status.get("second_order_label_proliferation"),
        "narrative_lens_reading": status.get("narrative_lens_reading"),
        "character_path_reading": status.get("character_path_reading"),
        "datascene_meaning_network": status.get("datascene_meaning_network"),
        "mise_en_scene_scene_cards": status.get("mise_en_scene_scene_cards"),
        "source_extraction_metadata_summary": status.get("source_extraction_metadata_summary"),
        "vaa1_annotation_master_schema": status.get("vaa1_annotation_master_schema"),
        "evidence_proliferation_matches": status.get("evidence_proliferation_matches", []),
        "live_mature_data_proliferation_audit": status.get(
            "live_mature_data_proliferation_audit"
        ),
        "audio_event_intervals": (status.get("results", {}).get("audio_analysis", {}) or {}).get("audio_event_intervals"),
    }

    source_video_path = status.get("source_video_path")
    if source_video_path:
        source_video_exists = Path(source_video_path).exists()
        response_data["source_video_exists"] = source_video_exists
        if not source_video_exists:
            response_data["source_video_message"] = (
                f"Video file is missing from {source_video_path}. "
                "Restore the video there if you want playback with this analysis."
            )

    # Add results if completed
    if status["status"] == "completed":
        results = status.get("results") or {}
        output_files = status.get("output_files", {})
        transcript_timing_repair_before = status.get("transcript_timing_repair")
        authoritative_transcript_selected = prefer_authoritative_transcript_artifact(status)
        transcript_timing_repaired = repair_transcript_timing_if_needed(status)
        transcript_timing_repair_state = status.get("transcript_timing_repair")
        transcript_timing_repair_changed = (
            transcript_timing_repair_state != transcript_timing_repair_before
        )
        if transcript_timing_repair_state:
            response_data["transcript_timing_repair"] = transcript_timing_repair_state
        linked_transcript_regenerated = regenerate_linked_transcript_if_needed(status)
        audio_prosody_regenerated = regenerate_audio_prosody_if_needed(status)
        visual_time_bank_regenerated = regenerate_time_bank_visual_artifacts_if_needed(status)
        iterative_artifacts_created = write_iterative_derived_artifacts_for_status(status)
        if (
            authoritative_transcript_selected
            or
            transcript_timing_repaired
            or transcript_timing_repair_changed
            or
            linked_transcript_regenerated
            or audio_prosody_regenerated
            or visual_time_bank_regenerated
            or iterative_artifacts_created
        ):
            if iterative_artifacts_created:
                append_analysis_event(
                    status,
                    "iterative_derived_artifacts_created",
                    details={
                        "file_types": iterative_artifacts_created,
                        "created_during": "status_refresh",
                    },
                )
            persist_analysis_record_for_status(status)
            output_files = status.get("output_files", {})
        if (
            not status.get("second_order_label_proliferation")
            or not status.get("narrative_lens_reading")
            or not status.get("character_path_reading")
            or not status.get("datascene_meaning_network")
        ):
            try:
                proliferation_plan = write_second_order_meaning_artifacts_for_status(status)
                if proliferation_plan:
                    append_analysis_event(
                        status,
                        "second_order_label_proliferation_created",
                        details={
                            "instruction_count": (
                                proliferation_plan.get("summary") or {}
                            ).get("instruction_count", 0),
                            "created_during": "status_refresh",
                        },
                    )
                    persist_analysis_record_for_status(status)
                    output_files = status.get("output_files", {})
                    response_data["second_order_label_proliferation"] = status.get(
                        "second_order_label_proliferation"
                    )
                    response_data["narrative_lens_reading"] = status.get(
                        "narrative_lens_reading"
                    )
                    response_data["character_path_reading"] = status.get(
                        "character_path_reading"
                    )
                    response_data["datascene_meaning_network"] = status.get(
                        "datascene_meaning_network"
                    )
            except Exception as proliferation_error:
                logger.warning(
                    "Second-order label proliferation refresh failed: %s",
                    proliferation_error,
                )
                status.setdefault("results", {})[
                    "second_order_label_proliferation_error"
                ] = str(proliferation_error)
        if (
            not status.get("mise_en_scene_scene_cards")
            or mise_en_scene_artifacts_need_refresh(status)
        ):
            try:
                scene_card_bundle = write_mise_en_scene_artifacts_for_status(status)
                if scene_card_bundle:
                    append_analysis_event(
                        status,
                        "mise_en_scene_scene_cards_created",
                        details={
                            "scene_card_count": len(scene_card_bundle.get("scene_cards") or []),
                            "created_during": "status_refresh",
                            "refresh_reason": "missing_or_thin_artifact",
                        },
                    )
                    persist_analysis_record_for_status(status)
                    output_files = status.get("output_files", {})
                    response_data["mise_en_scene_scene_cards"] = status.get(
                        "mise_en_scene_scene_cards"
                    )
                    response_data["source_extraction_metadata_summary"] = status.get(
                        "source_extraction_metadata_summary"
                    )
            except Exception as scene_card_error:
                logger.warning(
                    "Mise-en-scene scene card refresh failed: %s",
                    scene_card_error,
                )
                status.setdefault("results", {})[
                    "mise_en_scene_scene_cards_error"
                ] = str(scene_card_error)
        
        # Add processing time
        if status.get("start_time") and status.get("end_time"):
            processing_time = status["end_time"] - status["start_time"]
            response_data["processing_time"] = round(processing_time, 2)
        
        # Add analysis summary
        response_data["summary"] = {}

        if "visual_analysis" in results:
            va = results["visual_analysis"]
            response_data["summary"]["yolo_detections"] = len(va.get("yolo_results", []))
            response_data["summary"]["tracked_objects"] = len(va.get("tracked_objects", []))
            response_data["summary"]["ocr_detections"] = len(va.get("ocr_results", []))
            response_data["summary"]["cinematic_clues"] = va.get("cinematic_clues", {})
            response_data["summary"]["spatial_tone_scan"] = va.get("spatial_tone_scan", {})
            response_data["summary"]["motion_evidence"] = va.get("motion_evidence", {})
            response_data["summary"]["scene_segments"] = va.get("scene_segments", {})
            response_data["summary"]["shot_boundaries"] = va.get("shot_boundaries", {})
            response_data["summary"]["expression_samples"] = len(va.get("expression_results", []))
            response_data["summary"]["expression_status"] = va.get(
                "expression_status", "not_run"
            )
            response_data["summary"]["face_frames_considered"] = va.get("face_sampling", {}).get("frames_considered", 0)
            response_data["summary"]["face_frames_selected"] = va.get("face_sampling", {}).get("frames_selected", 0)
            response_data["summary"]["face_frames_skipped_no_person"] = va.get("face_sampling", {}).get("frames_skipped_no_person", 0)
            response_data["face_results"] = va.get("face_results")
            if va.get("expression_error"):
                response_data["summary"]["expression_error"] = va.get("expression_error")

        if "audio_analysis" in results:
            aa = results["audio_analysis"]
            response_data["audio_diarization"] = aa.get("audio_diarization")
            response_data["audio_sample_clouds"] = aa.get("audio_sample_clouds")
            # Whisper transcript summary
            response_data["summary"]["audio_segments"] = len(
                aa.get("transcript", {}).get("segments", [])
            )
            response_data["summary"]["audio_prosody_cues"] = len(
                aa.get("audio_prosody", {}).get("cues", [])
            )
            audio_events = aa.get("audio_event_intervals") or (
                aa.get("audio_prosody", {}).get("audio_event_intervals", {})
                if isinstance(aa.get("audio_prosody"), dict)
                else {}
            )
            response_data["summary"]["audio_event_intervals"] = len(
                audio_events.get("intervals", []) if isinstance(audio_events, dict) else []
            )
            response_data["summary"]["audio_event_ratios"] = (
                audio_events.get("summary", {}).get("ratios", {})
                if isinstance(audio_events, dict)
                else {}
            )
            response_data["summary"]["audio_sample_clouds"] = (
                aa.get("audio_sample_clouds", {}).get("cloud_count", 0)
            )
            response_data["summary"]["audio_sample_count"] = (
                aa.get("audio_sample_clouds", {}).get("sample_count", 0)
            )
            response_data["summary"]["audio_language"] = aa.get("transcript", {}).get("language", "unknown")
            language_info = aa.get("transcript", {}).get("language_info", {})
            if language_info:
                response_data["summary"]["audio_language_name"] = language_info.get("name")
                response_data["summary"]["audio_language_source"] = language_info.get("source")
                response_data["summary"]["audio_language_confidence"] = language_info.get("confidence")
                response_data["summary"]["language_support"] = language_info.get("support", {})
                response_data["summary"]["language_pack_policy"] = status.get("language_pack_policy")
                response_data["summary"]["language_profile"] = {
                    "code": language_info.get("code"),
                    "name": language_info.get("name"),
                    "iso6393": language_info.get("iso6393"),
                    "source": language_info.get("source"),
                    "confidence": language_info.get("confidence"),
                    "hint": language_info.get("hint"),
                    "text_guess": language_info.get("text_guess"),
                    "support": language_info.get("support", {}),
                }
            # LM transcript length (if available)
            if aa.get("lm_transcript_path"):
                try:
                    lm_text = Path(aa["lm_transcript_path"]).read_text(encoding="utf-8")
                    response_data["summary"]["lm_length"] = len(lm_text)
                except Exception:
                    pass
        if results.get("audio_error"):
            response_data["summary"]["audio_error"] = results.get("audio_error")
        if results.get("audio_prosody_error"):
            response_data["summary"]["audio_prosody_error"] = results.get("audio_prosody_error")
        if results.get("audio_diarization_error"):
            response_data["summary"]["audio_diarization_error"] = results.get("audio_diarization_error")
        if results.get("audio_sample_cloud_error"):
            response_data["summary"]["audio_sample_cloud_error"] = results.get("audio_sample_cloud_error")
        if results.get("identity_triangulation_error"):
            response_data["summary"]["identity_triangulation_error"] = results.get("identity_triangulation_error")
        if results.get("second_order_label_proliferation_error"):
            response_data["summary"]["second_order_label_proliferation_error"] = results.get("second_order_label_proliferation_error")
        if results.get("mise_en_scene_scene_cards_error"):
            response_data["summary"]["mise_en_scene_scene_cards_error"] = results.get("mise_en_scene_scene_cards_error")
        if results.get("pos_error"):
            response_data["summary"]["pos_error"] = results.get("pos_error")
        if results.get("quan_error"):
            response_data["summary"]["quan_error"] = results.get("quan_error")
        
        # Add download links
        response_data["download_links"] = build_download_links(analysis_id, output_files)
    return response_data


def get_forensic_render_root(analysis_id: str) -> Path:
    return RESULTS_DIR / analysis_id / "forensic_renders"


def get_source_sample_root(analysis_id: str) -> Path:
    return RESULTS_DIR / analysis_id / "source_samples"


@app.get("/api/forensic-render/{analysis_id}/jobs", response_model=dict)
async def list_forensic_render_jobs(analysis_id: str) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    render_root = get_forensic_render_root(analysis_id)
    jobs = make_json_safe(load_forensic_render_jobs(render_root))
    status["forensic_render_jobs"] = jobs
    persist_analysis_record_for_status(status)
    return {"analysis_id": analysis_id, "jobs": jobs}


@app.get("/api/forensic-render/{analysis_id}/jobs/{render_job_id}", response_model=dict)
async def get_forensic_render_job(analysis_id: str, render_job_id: str) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    jobs = make_json_safe(load_forensic_render_jobs(get_forensic_render_root(analysis_id)))
    for job in jobs:
        if job.get("render_job_id") == render_job_id:
            return {"analysis_id": analysis_id, "job": job}

    raise HTTPException(status_code=404, detail="Forensic render job not found")


@app.get("/api/forensic-render/{analysis_id}/jobs/{render_job_id}/traceback", response_model=dict)
async def get_forensic_render_traceback(analysis_id: str, render_job_id: str) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    jobs = make_json_safe(load_forensic_render_jobs(get_forensic_render_root(analysis_id)))
    for job in jobs:
        if job.get("render_job_id") != render_job_id:
            continue
        traceback_path = Path(str(job.get("traceback_record_path") or ""))
        if not traceback_path.exists():
            raise HTTPException(status_code=404, detail="Forensic render traceback missing")
        try:
            record = json.loads(traceback_path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Forensic render traceback could not be read: {exc}",
            ) from exc
        tree = None
        traceback_tree_path = Path(str(job.get("traceback_tree_path") or ""))
        if traceback_tree_path.exists():
            try:
                tree = json.loads(traceback_tree_path.read_text(encoding="utf-8"))
            except Exception:
                tree = None
        return make_json_safe({"analysis_id": analysis_id, "traceback": record, "tree": tree})

    raise HTTPException(status_code=404, detail="Forensic render job not found")


@app.get("/api/source-samples/{analysis_id}", response_model=dict)
async def list_source_samples(analysis_id: str) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    samples = make_json_safe(load_source_samples(get_source_sample_root(analysis_id)))
    status["source_samples"] = samples
    persist_analysis_record_for_status(status)
    return {"analysis_id": analysis_id, "samples": samples}


@app.post("/api/source-samples/{analysis_id}", response_model=dict)
async def create_source_sample_endpoint(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    try:
        status = get_analysis_entry(analysis_id)
        if status is None:
            raise HTTPException(status_code=404, detail="Analysis ID not found")

        source_video_path = status.get("source_video_path") or status.get("file_path")
        if not source_video_path:
            raise HTTPException(status_code=400, detail="Analysis has no source video path")
        if not Path(source_video_path).exists():
            raise HTTPException(status_code=404, detail="Source video is missing on server")

        output_files = status.get("output_files", {})
        source_audio_path = output_files.get("audio")
        sample = create_source_sample(
            analysis_id=analysis_id,
            source_video_path=source_video_path,
            source_audio_path=source_audio_path,
            output_root=get_source_sample_root(analysis_id),
            request={
                **payload,
                "max_duration_seconds": payload.get("max_duration_seconds", 30.0),
            },
        )

        samples = make_json_safe(load_source_samples(get_source_sample_root(analysis_id)))
        status["source_samples"] = samples
        status.setdefault("internal_artifacts", {})["source_samples"] = str(
            get_source_sample_root(analysis_id) / "samples.json"
        )
        append_analysis_event(
            status,
            "source_sample_created",
            details={
                "sample_id": sample.get("sample_id"),
                "sample_type": sample.get("sample_type"),
                "time_start": sample.get("time_start"),
                "time_end": sample.get("time_end"),
            },
        )
        persist_analysis_record_for_status(status)
        return make_json_safe({"analysis_id": analysis_id, "sample": sample, "samples": samples})
    except HTTPException:
        raise
    except SourceSamplerError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Source sample failed for analysis %s", analysis_id)
        raise HTTPException(
            status_code=500,
            detail={
                "type": type(exc).__name__,
                "error": str(exc),
                "phase": "create_source_sample_endpoint",
            },
        ) from exc


@app.api_route(
    "/api/source-samples/{analysis_id}/{sample_id}/{asset_type}",
    methods=["GET", "HEAD"],
)
async def download_source_sample_asset(
    analysis_id: str,
    sample_id: str,
    asset_type: str,
):
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    samples = load_source_samples(get_source_sample_root(analysis_id))
    sample = next((item for item in samples if item.get("sample_id") == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail="Source sample not found")

    if asset_type == "visual":
        asset_path = Path(str(sample.get("visual", {}).get("output_image_path") or ""))
        media_type = "image/jpeg"
        filename = f"{sample_id}_visual_sample.jpg"
    elif asset_type == "audio":
        asset_path = Path(str(sample.get("audio", {}).get("output_audio_path") or ""))
        media_type = "audio/wav"
        filename = f"{sample_id}_audio_sample.wav"
    else:
        raise HTTPException(status_code=400, detail="Unsupported source sample asset")

    if not asset_path.exists():
        raise HTTPException(status_code=404, detail="Source sample asset missing")
    return FileResponse(path=asset_path, media_type=media_type, filename=filename)


@app.post("/api/forensic-render/{analysis_id}/jobs", response_model=dict)
async def create_forensic_render_endpoint(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    try:
        status = get_analysis_entry(analysis_id)
        if status is None:
            raise HTTPException(status_code=404, detail="Analysis ID not found")

        source_video_path = status.get("source_video_path") or status.get("file_path")
        if not source_video_path:
            raise HTTPException(status_code=400, detail="Analysis has no source video path")
        if not Path(source_video_path).exists():
            raise HTTPException(status_code=404, detail="Source video is missing on server")

        time_start = max(0.0, safe_float(payload.get("time_start"), 0.0) or 0.0)
        time_end = max(time_start, safe_float(payload.get("time_end"), time_start) or time_start)
        enriched_payload = {
            **payload,
            "adopted_context": build_forensic_adopted_context(
                status,
                time_start=time_start,
                time_end=time_end,
                region=payload.get("region"),
            ),
        }

        job = create_forensic_render_job(
            analysis_id=analysis_id,
            source_video_path=source_video_path,
            output_root=get_forensic_render_root(analysis_id),
            request=enriched_payload,
        )

        jobs = make_json_safe(load_forensic_render_jobs(get_forensic_render_root(analysis_id)))
        status["forensic_render_jobs"] = jobs
        status.setdefault("internal_artifacts", {})["forensic_render_jobs"] = str(
            get_forensic_render_root(analysis_id) / "jobs.json"
        )
        append_analysis_event(
            status,
            "forensic_render_created",
            details={
                "render_job_id": job.get("render_job_id"),
                "mode": job.get("mode"),
                "time_start": job.get("time_start"),
                "time_end": job.get("time_end"),
                "region_type": job.get("region_type"),
            },
        )
        persist_analysis_record_for_status(status)
        return make_json_safe({"analysis_id": analysis_id, "job": job, "jobs": jobs})
    except HTTPException:
        raise
    except ForensicRenderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Forensic render failed for analysis %s", analysis_id)
        raise HTTPException(
            status_code=500,
            detail={
                "type": type(exc).__name__,
                "error": str(exc),
                "phase": "create_forensic_render_endpoint",
            },
        ) from exc


@app.get("/api/forensic-render/{analysis_id}/jobs/{render_job_id}/download")
async def download_forensic_render_job(analysis_id: str, render_job_id: str):
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    jobs = load_forensic_render_jobs(get_forensic_render_root(analysis_id))
    for job in jobs:
        if job.get("render_job_id") != render_job_id:
            continue
        output_path = Path(str(job.get("output_video_path") or ""))
        if not output_path.exists():
            raise HTTPException(status_code=404, detail="Forensic render video missing")
        base_name = Path(status.get("original_filename") or analysis_id).stem
        return FileResponse(
            path=output_path,
            media_type="video/mp4",
            filename=f"{base_name}_forensic_{render_job_id}.mp4",
        )

    raise HTTPException(status_code=404, detail="Forensic render job not found")


@app.get("/api/morphology/catalog", response_model=dict)
async def get_morphology_catalog(query: str = "") -> dict:
    return {
        "items": list_morphology_catalog(query=query),
        "query": query,
        "feed_repair_api_ready": True,
        "notes": [
            "Installed means a named morphology pipeline is available in the current runtime.",
            "Declared but not installed means the code knows the model alias, but the local environment does not currently provide it.",
            "Rough interpretation only means VAA1 currently expects lexical fallback rather than structured morphology.",
        ],
    }

@app.get("/api/download/{analysis_id}/{file_type}")
async def download_file(analysis_id: str, file_type: str):
    """
    Download analysis results
    Supported file_types: video, yolo_csv, ocr_csv, summary_json, audio, transcript,
    linked_transcript, audio_prosody, audio_diarization, time_bank_audio, lm_transcript, pos_analysis, expression_json,
    quan_analysis, dependency_sfl_stage1, multimodal_meaning_stage1, agent_persistence_scene_cut, second_order_label_proliferation,
    narrative_lens_reading, character_path_reading, datascene_meaning_network,
    mise_en_scene_scene_cards, source_extraction_metadata_summary, mise_en_scene_scene_card_report_draft_md,
    face_anonymization_manifest
    """
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    if status["status"] != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

    if file_type == "transcript":
        if prefer_authoritative_transcript_artifact(status):
            persist_analysis_record_for_status(status)
    
    output_files = status.get("output_files", {})
    
    # Map file types to actual file paths and download names
    file_mapping = {
        "video": ("annotated_video.mp4", "video/mp4"),
        "source_video": ("source_video.mp4", "video/mp4"),
        "yolo_csv": ("yolo_detections.csv", "text/csv"),
        "tracked_objects_csv": ("tracked_objects.csv", "text/csv"),
        "tracked_objects_json": ("tracked_objects.json", "application/json"),
        "ocr_csv": ("ocr_text.csv", "text/csv"),
        "summary_json": ("analysis_summary.json", "application/json"),
        "audio": ("extracted_audio.wav", "audio/wav"),
        "transcript": ("transcript.json", "application/json"),
        "linked_transcript": ("linked_transcript.json", "application/json"),
        "audio_prosody": ("audio_prosody.json", "application/json"),
        "audio_event_intervals": ("audio_event_intervals.json", "application/json"),
        "audio_diarization": ("audio_diarization.json", "application/json"),
        "audio_sample_clouds": ("audio_sample_clouds.json", "application/json"),
        "identity_triangulation": ("identity_triangulation_bundle.json", "application/json"),
        "dependency_sfl_stage1": ("dependency_sfl_stage1.json", "application/json"),
        "multimodal_meaning_stage1": ("multimodal_meaning_stage1.json", "application/json"),
        "agent_persistence_scene_cut": ("agent_persistence_scene_cut.json", "application/json"),
        "second_order_label_proliferation": (
            "second_order_label_proliferation.json",
            "application/json",
        ),
        "narrative_lens_reading": (
            "narrative_lens_reading.json",
            "application/json",
        ),
        "character_path_reading": (
            "character_path_reading.json",
            "application/json",
        ),
        "datascene_meaning_network": (
            "datascene_meaning_network.json",
            "application/json",
        ),
        "vaa1_annotation_master_schema": (
            "vaa1_annotation_master_schema.json",
            "application/json",
        ),
        "mise_en_scene_scene_cards": ("mise_en_scene_scene_card_report.json", "application/json"),
        "mise_en_scene_scene_card_report_draft_md": (
            "mise_en_scene_scene_card_report_draft.md",
            "text/markdown",
        ),
        "source_extraction_metadata_summary": (
            "scene_card_source_extraction_metadata_summary.json",
            "application/json",
        ),
        "time_bank_audio": ("time_bank_audio.json", "application/json"),
        "time_bank_ocr": ("time_bank_ocr.json", "application/json"),
        "time_bank_objects": ("time_bank_objects.json", "application/json"),
        "time_bank_expressions": ("time_bank_expressions.json", "application/json"),
        "lm_transcript": ("lm_transcript.json", "application/json"),
        "pos_analysis": ("pos_analysis.json", "application/json"),
        "expression_json": ("expressions.json", "application/json"),
        "quan_analysis": ("quan_analysis.json", "application/json"),
        "source_media_metadata_json": ("source_media_metadata.json", "application/json"),
        "source_media_metadata_csv": ("source_media_metadata.csv", "text/csv"),
        "annotation_corrections": ("annotation_corrections.json", "application/json"),
        "pos_matrix": ("pos_matrix.json", "application/json"),
        "quant_matrix": ("quant_matrix.json", "application/json"),
        "face_anonymization_manifest": (
            "face_anonymization_manifest.json",
            "application/json",
        ),
    }
    
    if file_type not in file_mapping:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    if file_type not in output_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = Path(output_files[file_type])
    filename, media_type = file_mapping[file_type]
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")
    
    # Create a nice download filename
    original_name = status["original_filename"]
    base_name = Path(original_name).stem
    download_filename = f"{base_name}_{filename}"
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=download_filename,
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/download-bundle/{analysis_id}")
async def download_bundle(analysis_id: str):
    """Download all available analysis outputs as a single zip bundle."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    if status["status"] != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

    refresh_mutable_saved_outputs(status)
    output_files = status.get("output_files", {})
    if not output_files:
        raise HTTPException(status_code=404, detail="No output files available")

    file_mapping = {
        "video": "annotated_video.mp4",
        "source_video": "source_video.mp4",
        "yolo_csv": "yolo_detections.csv",
        "tracked_objects_csv": "tracked_objects.csv",
        "tracked_objects_json": "tracked_objects.json",
        "ocr_csv": "ocr_text.csv",
        "summary_json": "analysis_summary.json",
        "audio": "extracted_audio.wav",
        "transcript": "transcript.json",
        "linked_transcript": "linked_transcript.json",
        "audio_prosody": "audio_prosody.json",
        "audio_event_intervals": "audio_event_intervals.json",
        "audio_diarization": "audio_diarization.json",
        "audio_sample_clouds": "audio_sample_clouds.json",
        "identity_triangulation": "identity_triangulation_bundle.json",
        "dependency_sfl_stage1": "dependency_sfl_stage1.json",
        "multimodal_meaning_stage1": "multimodal_meaning_stage1.json",
        "agent_persistence_scene_cut": "agent_persistence_scene_cut.json",
        "second_order_label_proliferation": "second_order_label_proliferation.json",
        "narrative_lens_reading": "narrative_lens_reading.json",
        "character_path_reading": "character_path_reading.json",
        "datascene_meaning_network": "datascene_meaning_network.json",
        "mise_en_scene_scene_cards": "mise_en_scene_scene_card_report.json",
        "mise_en_scene_scene_card_report_draft_md": "mise_en_scene_scene_card_report_draft.md",
        "source_extraction_metadata_summary": "scene_card_source_extraction_metadata_summary.json",
        "time_bank_audio": "time_bank_audio.json",
        "time_bank_ocr": "time_bank_ocr.json",
        "time_bank_objects": "time_bank_objects.json",
        "time_bank_expressions": "time_bank_expressions.json",
        "lm_transcript": "lm_transcript.json",
        "pos_analysis": "pos_analysis.json",
        "expression_json": "expressions.json",
        "quan_analysis": "quan_analysis.json",
        "source_media_metadata_json": "source_media_metadata.json",
        "source_media_metadata_csv": "source_media_metadata.csv",
        "annotation_corrections": "annotation_corrections.json",
        "pos_matrix": "pos_matrix.json",
        "quant_matrix": "quant_matrix.json",
        "face_anonymization_manifest": "face_anonymization_manifest.json",
    }

    original_name = status["original_filename"]
    base_name = Path(original_name).stem
    archive_buffer = io.BytesIO()

    with zipfile.ZipFile(archive_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        skipped_files = add_available_output_files_to_archive(
            archive,
            output_files,
            file_mapping,
            archive_prefix=f"{base_name}_",
        )
        manifest_name = f"{base_name}_saved_work_manifest.json"
        archive.writestr(
            manifest_name,
            json.dumps(
                {
                    **build_saved_work_manifest(status),
                    "skipped_output_files": skipped_files,
                },
                indent=2,
                ensure_ascii=False,
                default=str,
            ),
        )

    archive_buffer.seek(0)
    bundle_path = RESULTS_DIR / f"{analysis_id}_bundle.zip"
    bundle_path.write_bytes(archive_buffer.getvalue())

    return FileResponse(
        path=bundle_path,
        media_type="application/zip",
        filename=f"{base_name}_analysis_bundle.zip",
    )


def build_project_bundle_file(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Create a project bundle file and return download metadata."""
    analysis_ids = payload.get("analysis_ids") or []
    if not analysis_ids:
        raise HTTPException(status_code=400, detail="No analyses were provided for the project bundle")

    project_name = payload.get("project_name") or "vaa1_project"
    matrices = payload.get("matrices") or {}

    file_mapping = {
        "video": "annotated_video.mp4",
        "source_video": "source_video.mp4",
        "yolo_csv": "yolo_detections.csv",
        "tracked_objects_csv": "tracked_objects.csv",
        "tracked_objects_json": "tracked_objects.json",
        "ocr_csv": "ocr_text.csv",
        "summary_json": "analysis_summary.json",
        "audio": "extracted_audio.wav",
        "transcript": "transcript.json",
        "linked_transcript": "linked_transcript.json",
        "audio_prosody": "audio_prosody.json",
        "audio_event_intervals": "audio_event_intervals.json",
        "audio_diarization": "audio_diarization.json",
        "audio_sample_clouds": "audio_sample_clouds.json",
        "identity_triangulation": "identity_triangulation_bundle.json",
        "dependency_sfl_stage1": "dependency_sfl_stage1.json",
        "multimodal_meaning_stage1": "multimodal_meaning_stage1.json",
        "agent_persistence_scene_cut": "agent_persistence_scene_cut.json",
        "second_order_label_proliferation": "second_order_label_proliferation.json",
        "narrative_lens_reading": "narrative_lens_reading.json",
        "character_path_reading": "character_path_reading.json",
        "datascene_meaning_network": "datascene_meaning_network.json",
        "mise_en_scene_scene_cards": "mise_en_scene_scene_card_report.json",
        "mise_en_scene_scene_card_report_draft_md": "mise_en_scene_scene_card_report_draft.md",
        "source_extraction_metadata_summary": "scene_card_source_extraction_metadata_summary.json",
        "time_bank_audio": "time_bank_audio.json",
        "time_bank_ocr": "time_bank_ocr.json",
        "time_bank_objects": "time_bank_objects.json",
        "time_bank_expressions": "time_bank_expressions.json",
        "lm_transcript": "lm_transcript.json",
        "pos_analysis": "pos_analysis.json",
        "expression_json": "expressions.json",
        "quan_analysis": "quan_analysis.json",
        "source_media_metadata_json": "source_media_metadata.json",
        "source_media_metadata_csv": "source_media_metadata.csv",
        "annotation_corrections": "annotation_corrections.json",
        "quant_matrix": "quant_matrix.json",
        "face_anonymization_manifest": "face_anonymization_manifest.json",
    }

    archive_buffer = io.BytesIO()
    included_analyses = []
    skipped_analyses = []

    with zipfile.ZipFile(archive_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for analysis_id in analysis_ids:
            status = get_analysis_entry(analysis_id)
            if status is None or status.get("status") != "completed":
                skipped_analyses.append(
                    {
                        "analysis_id": analysis_id,
                        "reason": "missing_or_not_completed",
                    }
                )
                continue

            refresh_mutable_saved_outputs(status)
            output_files = status.get("output_files", {})
            if not output_files:
                skipped_analyses.append(
                    {
                        "analysis_id": analysis_id,
                        "reason": "no_output_files",
                    }
                )
                continue

            base_name = Path(status["original_filename"]).stem
            folder_name = f"analyses/{slugify_name(base_name)}_{analysis_id[:8]}"
            skipped_files = add_available_output_files_to_archive(
                archive,
                output_files,
                file_mapping,
                archive_prefix=f"{folder_name}/",
            )

            archive.writestr(
                f"{folder_name}/saved_work_manifest.json",
                json.dumps(
                    {
                        **build_saved_work_manifest(status),
                        "skipped_output_files": skipped_files,
                    },
                    indent=2,
                    ensure_ascii=False,
                    default=str,
                ),
            )
            included_analyses.append(
                {
                    "analysis_id": analysis_id,
                    "filename": status.get("original_filename"),
                    "folder": folder_name,
                }
            )

        project_manifest = {
            "project_type": "vaa1_project_bundle",
            "project_name": project_name,
            "saved_at": utc_now_iso(),
            "analysis_count": len(included_analyses),
            "included_analyses": included_analyses,
            "skipped_analyses": skipped_analyses,
            "matrices": matrices,
        }
        archive.writestr(
            "project_manifest.json",
            json.dumps(project_manifest, indent=2, ensure_ascii=False),
        )

    archive_buffer.seek(0)
    bundle_name = f"{slugify_name(project_name)}_project_bundle.zip"
    bundle_path = RESULTS_DIR / bundle_name
    bundle_path.write_bytes(archive_buffer.getvalue())

    return {
        "bundle_name": bundle_name,
        "bundle_path": bundle_path,
        "project_manifest": project_manifest,
    }


@app.post("/api/prepare-project-bundle", response_model=dict)
async def prepare_project_bundle(payload: Dict[str, Any] = Body(...)):
    """Create a project bundle and return a direct browser-download URL."""
    result = build_project_bundle_file(payload)
    bundle_name = result["bundle_name"]
    return {
        "status": "ready",
        "filename": bundle_name,
        "download_url": f"/api/project-bundles/{bundle_name}",
        "project_manifest": result["project_manifest"],
    }


@app.get("/api/project-bundles/{bundle_name}")
async def download_prepared_project_bundle(bundle_name: str):
    """Download a project bundle that has already been prepared server-side."""
    safe_name = Path(bundle_name).name
    if safe_name != bundle_name or not safe_name.endswith("_project_bundle.zip"):
        raise HTTPException(status_code=400, detail="Invalid project bundle name")
    bundle_path = RESULTS_DIR / safe_name
    if not bundle_path.exists() or not bundle_path.is_file():
        raise HTTPException(status_code=404, detail="Project bundle not found")
    return FileResponse(
        path=bundle_path,
        media_type="application/zip",
        filename=safe_name,
    )


@app.post("/api/download-project-bundle")
async def download_project_bundle(payload: Dict[str, Any] = Body(...)):
    """Download a whole project bundle containing multiple completed analyses and project state."""
    result = build_project_bundle_file(payload)
    bundle_name = result["bundle_name"]
    bundle_path = result["bundle_path"]
    return FileResponse(
        path=bundle_path,
        media_type="application/zip",
        filename=bundle_name,
    )


@app.get("/api/workspace-info", response_model=dict)
async def workspace_info() -> dict:
    """Return the main VAA1 workspace paths used for saved and imported work."""
    return {
        "results_dir": str(RESULTS_DIR.resolve()),
        "imported_work_dir": str(IMPORTED_WORK_DIR.resolve()),
        "downloads_note": (
            "Analysis bundles downloaded from the browser are saved to your browser or system download location."
        ),
    }


@app.get("/api/ai-agent/feature-starters", response_model=dict)
async def get_ai_agent_feature_starters() -> dict:
    """Return governed starter contracts for optional AI-agent feature families."""
    return build_feature_starter_manifest()


@app.post("/api/ai-agent/feature-starters/write", response_model=dict)
async def write_ai_agent_feature_starters() -> dict:
    """Persist the AI-agent feature-starter manifest into outputs for audit/review."""
    output_path = RESULTS_DIR / "ai_agent_feature_starters_manifest.json"
    manifest = write_feature_starter_manifest(output_path)
    return {
        "status": "written",
        "path": str(output_path),
        "feature_count": len(manifest.get("features", [])),
        "manifest": manifest,
    }


@app.post("/api/ai-agent/{analysis_id}/scene-card-report-draft", response_model=dict)
async def write_ai_agent_scene_card_report_draft(analysis_id: str) -> dict:
    """Write a Markdown report draft from existing scene-card evidence."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    output_files = status.setdefault("output_files", {})
    scene_card_path = output_files.get("mise_en_scene_scene_cards")
    if not scene_card_path or not Path(scene_card_path).exists():
        raise HTTPException(
            status_code=404,
            detail="Scene card artifact is not available for this analysis",
        )

    try:
        scene_bundle = json.loads(Path(scene_card_path).read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read scene card artifact: {exc}",
        ) from exc

    cards = scene_bundle.get("scene_cards")
    if not isinstance(cards, list):
        cards = []

    sections: List[Dict[str, Any]] = []
    evidence_refs: List[Dict[str, Any]] = []
    for index, card in enumerate(cards[:12], start=1):
        if not isinstance(card, dict):
            continue
        time_range = card.get("time_range") or {}
        start = time_range.get("start_seconds", card.get("start_seconds", 0))
        end = time_range.get("end_seconds", card.get("end_seconds", start))
        heading = str(card.get("title") or f"Scene {index}")
        summary = str(
            card.get("overview")
            or card.get("summary")
            or "No scene summary is available."
        )
        nlp_summary = str(
            card.get("nlp_scene_summary_sentence")
            or (card.get("nlp_scene_summary") or {}).get("sentence")
            or ""
        ).strip()
        description = card.get("mise_en_scene_description") or (
            (card.get("nlp_scene_summary") or {}).get("description")
            if isinstance(card.get("nlp_scene_summary"), dict)
            else {}
        )
        description_lines = []
        if isinstance(description, dict):
            description_labels = [
                ("What is happening", description.get("what_is_happening")),
                ("Who is speaking", description.get("who_is_speaking")),
                ("In what situation", description.get("situation")),
                (
                    "What meanings are being constructed",
                    description.get("meanings_constructed"),
                ),
                (
                    "What phenomena occur in the material",
                    description.get("phenomena"),
                ),
            ]
            description_lines = [
                f"- {label}: {value}"
                for label, value in description_labels
                if str(value or "").strip()
            ]
        speech_items = card.get("speech") or card.get("said_in_scene") or []
        speech_lines = []
        if isinstance(speech_items, list):
            for speech in speech_items[:8]:
                if not isinstance(speech, dict):
                    continue
                text = str(speech.get("text") or "").strip()
                if text:
                    speech_lines.append(f"- {text}")
        meaning = card.get("meaning_plot") or {}
        meaning_summary = (
            str(meaning.get("summary") or "").strip()
            if isinstance(meaning, dict)
            else ""
        )
        body_parts = [summary]
        if nlp_summary:
            body_parts.append(f"What is happening: {nlp_summary}")
        if description_lines:
            body_parts.append("Mise-en-scene description:\n" + "\n".join(description_lines))
        if meaning_summary:
            body_parts.append(f"Meaning / plot: {meaning_summary}")
        if speech_lines:
            body_parts.append("Said in scene:\n" + "\n".join(speech_lines))
        sections.append(
            {
                "heading": heading,
                "body": "\n\n".join(body_parts),
            }
        )
        evidence_refs.append(
            {
                "evidence_id": card.get("scene_card_id") or card.get("id") or f"scene-card:{index}",
                "label": heading,
                "target": f"t={start},{end}",
            }
        )

    markdown = render_report_markdown(
        title=f"Mise-en-Scene Scene Card Report - {status.get('filename') or analysis_id}",
        sections=sections,
        evidence_refs=evidence_refs,
    )
    output_path = RESULTS_DIR / analysis_id / "mise_en_scene_scene_card_report_draft.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    output_files["mise_en_scene_scene_card_report_draft_md"] = str(output_path)
    append_analysis_event(
        status,
        "ai_agent_scene_card_report_draft_written",
        details={"path": str(output_path), "scene_count": len(sections)},
    )
    return {
        "status": "written",
        "analysis_id": analysis_id,
        "path": str(output_path),
        "scene_count": len(sections),
        "markdown": markdown,
    }


@app.post("/api/matrices/quant/{analysis_id}", response_model=dict)
async def save_quant_matrix_snapshot(analysis_id: str, payload: Dict[str, Any] = Body(...)) -> dict:
    """Persist a Quant matrix snapshot so it can be downloaded and included in saved bundles."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)
    matrix_path = analysis_dir / "quant_matrix.json"

    snapshot = {
        "matrix_type": "quant",
        "saved_at": utc_now_iso(),
        "owner_analysis_id": analysis_id,
        **payload,
    }
    matrix_path.write_text(
        json.dumps(snapshot, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    output_files = status.setdefault("output_files", {})
    output_files["quant_matrix"] = str(matrix_path)
    append_analysis_event(
        status,
        "quant_matrix_saved",
        details={
            "selected_sections": payload.get("selected_sections", []),
            "analysis_count": len(payload.get("analyses", [])),
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "path": str(matrix_path),
    }


@app.post("/api/matrices/pos/{analysis_id}", response_model=dict)
async def save_pos_matrix_snapshot(analysis_id: str, payload: Dict[str, Any] = Body(...)) -> dict:
    """Persist a POS matrix snapshot so it can be downloaded and included in saved bundles."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    analysis_dir = RESULTS_DIR / analysis_id
    analysis_dir.mkdir(parents=True, exist_ok=True)
    matrix_path = analysis_dir / "pos_matrix.json"

    snapshot = {
        "matrix_type": "pos",
        "saved_at": utc_now_iso(),
        "owner_analysis_id": analysis_id,
        **payload,
    }
    matrix_path.write_text(
        json.dumps(snapshot, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    output_files = status.setdefault("output_files", {})
    output_files["pos_matrix"] = str(matrix_path)
    append_analysis_event(
        status,
        "pos_matrix_saved",
        details={
            "selected_sections": payload.get("selected_sections", []),
            "analysis_count": len(payload.get("analyses", [])),
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "path": str(matrix_path),
    }

@app.post("/api/analysis/{analysis_id}/statskit/run", response_model=dict)
async def run_statskit_analysis(
    analysis_id: str,
    stats_run_config: Dict[str, Any] = Body(...),
) -> dict:
    """
    Execute a StatsKit analysis run based on the provided configuration.
    """
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    try:
        analysis_dir = RESULTS_DIR / analysis_id
        agent = StatsKitAgent(analysis_id, analysis_dir)
        result_artifact = agent.run_stats_analysis(stats_run_config)
        return make_json_safe(result_artifact)
    except StatsKitAgentError as exc:
        logger.error("StatsKit run failed for analysis %s: %s", analysis_id, exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error during StatsKit run for analysis %s", analysis_id)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during the StatsKit run: {exc}",
        )

@app.get("/api/source-media/{analysis_id}", response_model=dict)
async def get_source_media_metadata(analysis_id: str) -> dict:
    """Return the stored source media metadata for an analysis."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    write_source_media_metadata_files(status)
    persist_analysis_record_for_status(status)

    return {
        "analysis_id": analysis_id,
        "source_media_metadata": status.get("source_media_metadata", {}),
    }


@app.post("/api/source-media/{analysis_id}/refresh-maturity", response_model=dict)
async def refresh_source_media_maturity(analysis_id: str) -> dict:
    """Run a visible Source Media metadata maturity iteration."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    write_source_media_metadata_files(status)
    persist_analysis_record_for_status(status)
    metadata = status.get("source_media_metadata", {})
    append_analysis_event(
        status,
        "source_media_maturity_refreshed",
        {
            "field_count": (metadata.get("maturity_iteration") or {}).get("field_count", 0),
            "filled_count": (metadata.get("maturity_iteration") or {}).get("filled_count", 0),
            "manual_protected_count": (metadata.get("maturity_iteration") or {}).get("manual_protected_count", 0),
            "review_candidate_count": (metadata.get("maturity_iteration") or {}).get("review_candidate_count", 0),
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "analysis_id": analysis_id,
        "source_media_metadata": metadata,
        "maturity_iteration": metadata.get("maturity_iteration", {}),
    }


@app.post("/api/status/{analysis_id}/cvat-link", response_model=dict)
async def update_cvat_link(analysis_id: str, payload: Dict[str, Any] = Body(...)) -> dict:
    """Persist or update the CVAT task linkage for an analysis."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    raw_cvat_id = payload.get("cvatID")
    try:
        cvat_id = int(raw_cvat_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="cvatID must be an integer")

    if cvat_id < 0:
        raise HTTPException(status_code=400, detail="cvatID must be non-negative")

    status["cvatID"] = cvat_id
    append_analysis_event(
        status,
        "cvat_link_updated",
        details={
            "cvatID": cvat_id,
            "origin": payload.get("origin", "manual_link"),
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "cvatID": cvat_id,
    }


@app.post("/api/annotations/{analysis_id}/sync-cvat", response_model=dict)
async def sync_cvat_annotations(
    analysis_id: str,
    payload: Dict[str, Any] = Body(default={}),
) -> dict:
    """Fetch raw CVAT job annotations and map a first ingest slice into the VAA1 master schema."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    task_id = safe_int(payload.get("task_id")) or safe_int(status.get("cvatID"))
    if task_id is None or task_id <= 0:
        raise HTTPException(status_code=400, detail="No CVAT task is linked to this analysis")

    requested_job_id = safe_int(payload.get("job_id"))

    tasks_payload = cvat_bridge_get_json("/api/tasks")
    task_payload = next(
        (
            task
            for task in (tasks_payload.get("results") or [])
            if safe_int(task.get("id")) == task_id
        ),
        None,
    )
    if task_payload is None:
        raise HTTPException(status_code=404, detail=f"CVAT task {task_id} was not found")

    jobs_payload = cvat_bridge_get_json(f"/api/tasks/{task_id}/jobs")
    jobs = jobs_payload.get("results") or []
    if not jobs:
        raise HTTPException(
            status_code=400,
            detail=f"CVAT task {task_id} has no jobs available yet",
        )

    if requested_job_id is not None:
        selected_job = next(
            (job for job in jobs if safe_int(job.get("id")) == requested_job_id),
            None,
        )
        if selected_job is None:
            raise HTTPException(
                status_code=404,
                detail=f"CVAT job {requested_job_id} was not found for task {task_id}",
            )
    else:
        selected_job = jobs[0]

    job_id = safe_int(selected_job.get("id"))
    if job_id is None:
        raise HTTPException(status_code=502, detail="CVAT bridge returned a job without an id")

    annotations_payload = cvat_bridge_get_json(f"/api/jobs/{job_id}/annotations")
    label_lookup = build_cvat_label_lookup(task_payload)
    master_schema_payload = build_vaa1_master_schema_from_cvat(
        analysis_id=analysis_id,
        status=status,
        task_id=task_id,
        job_id=job_id,
        cvat_annotations=annotations_payload,
        label_lookup=label_lookup,
    )
    artifact_paths = persist_cvat_ingest_artifacts(
        status,
        job_id=job_id,
        raw_payload=annotations_payload,
        master_schema_payload=master_schema_payload,
    )

    append_analysis_event(
        status,
        "cvat_annotations_synced",
        details={
            "task_id": task_id,
            "job_id": job_id,
            "raw_path": artifact_paths["raw_path"],
            "master_path": artifact_paths["master_path"],
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "mapped",
        "analysis_id": analysis_id,
        "task_id": task_id,
        "job_id": job_id,
        "object_annotation_count": len(master_schema_payload.get("object_annotations", [])),
        "track_annotation_count": len(master_schema_payload.get("track_annotations", [])),
        "paths": artifact_paths,
    }


@app.post("/api/source-media/{analysis_id}", response_model=dict)
async def update_source_media_metadata(analysis_id: str, payload: Dict[str, Any] = Body(...)) -> dict:
    """Update user-added source media metadata notes for an analysis."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    annotations = status.setdefault("source_media_annotations", {})
    for key in (
        "editor_notes",
        "source_context",
        "provenance_notes",
        "title",
        "scope",
        "description",
        "persons",
        "character_roles",
        "character_definitions",
        "narrative_agent_profiles",
        "relations",
        "location_country",
        "location_city",
        "location_place",
        "location_room",
        "time_era",
        "time_year",
        "time_moment",
        "situation_event",
        "keywords",
        "interaction_dynamics",
        "narrative_development",
        "performance_expression",
        "genre",
        "genre_subtype",
        "situational_genre",
        "situational_subtype",
        "privacy_axis",
        "expertise_axis",
        "references",
        "reference_speakers",
        "reference_relation",
        "reference_source",
        "confidence",
        "notes",
        "source_policy",
    ):
        if key in payload:
            value = payload.get(key)
            if key in ("persons", "character_roles", "character_definitions", "narrative_agent_profiles", "keywords", "references", "reference_speakers"):
                annotations[key] = value if isinstance(value, list) else []
            elif key == "source_policy":
                annotations[key] = value if isinstance(value, dict) else {}
            else:
                annotations[key] = value or ""

    write_source_media_metadata_files(status)
    append_analysis_event(
        status,
        "source_media_metadata_updated",
        details={
            "fields": [
                key
                for key in (
                    "editor_notes",
                    "source_context",
                    "provenance_notes",
                    "title",
                    "scope",
                    "description",
                    "persons",
                    "character_roles",
                    "character_definitions",
                    "narrative_agent_profiles",
                    "relations",
                    "location_country",
                    "location_city",
                    "location_place",
                    "location_room",
                    "time_era",
                    "time_year",
                    "time_moment",
                    "situation_event",
                    "keywords",
                    "interaction_dynamics",
                    "narrative_development",
                    "performance_expression",
                    "genre",
                    "genre_subtype",
                    "situational_genre",
                    "situational_subtype",
                    "privacy_axis",
                    "expertise_axis",
                    "references",
                    "reference_speakers",
                    "reference_relation",
                    "reference_source",
                    "confidence",
                    "notes",
                    "source_policy",
                )
                if key in payload
            ]
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "source_media_metadata": status.get("source_media_metadata", {}),
    }


@app.get("/api/vocabularies", response_model=dict)
async def get_canonical_vocabularies(include_terms: bool = False) -> dict:
    """Return versioned vocabulary contracts used by governed applications."""
    try:
        registry = load_vocabulary_registry()
    except (OSError, ValueError, VocabularyError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {
        "status": "ok",
        "vocabularies": public_registry(registry)["vocabularies"]
        if include_terms
        else list_vocabularies(registry),
    }


@app.post("/api/vocabularies/resolve", response_model=dict)
async def resolve_canonical_vocabulary_term(payload: Dict[str, Any] = Body(...)) -> dict:
    """Resolve a stable term id, version, label, and replacement lineage."""
    try:
        term = resolve_term(
            load_vocabulary_registry(),
            str(payload.get("vocabulary_id") or ""),
            str(payload.get("term_id") or ""),
            version=payload.get("vocabulary_version"),
            language=str(payload.get("language") or "en"),
            follow_replacement=bool(payload.get("follow_replacement", True)),
        )
    except (OSError, ValueError, VocabularyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "resolved", "term": term}


@app.post("/api/source-media/{analysis_id}/policy/evaluate", response_model=dict)
async def evaluate_source_media_policy(
    analysis_id: str, payload: Dict[str, Any] = Body(...)
) -> dict:
    """Evaluate a local, provider, transfer, or export use without changing evidence."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    metadata = status.get("source_media_metadata") or build_source_media_metadata_payload(status)
    try:
        decision = evaluate_source_use(
            metadata,
            str(payload.get("purpose") or ""),
            provider_id=payload.get("provider_id"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    append_analysis_event(
        status,
        "source_policy_evaluated",
        details={
            "purpose": decision["purpose"],
            "provider_id": decision["provider_id"],
            "allowed": decision["allowed"],
            "review_state": decision["review_state"],
            "reason_codes": decision["reason_codes"],
        },
    )
    persist_analysis_record_for_status(status)
    return {"analysis_id": analysis_id, "policy_decision": decision}


@app.post("/api/analysis/{analysis_id}/source-clock/resolve", response_model=dict)
async def resolve_analysis_source_clock(
    analysis_id: str, payload: Dict[str, Any] = Body(...)
) -> dict:
    """Resolve timing authority and identify only overlapping dependents."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        raise HTTPException(status_code=400, detail="candidates must be a list")
    metadata = status.get("source_media_metadata") or build_source_media_metadata_payload(status)
    duration = safe_float(metadata.get("duration_seconds"))
    try:
        selected = select_authoritative_time_scope(candidates, duration_seconds=duration)
        affected = overlapping_dependents(
            selected,
            payload.get("dependents") if isinstance(payload.get("dependents"), list) else [],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    invalidation = None
    if bool(payload.get("apply_invalidation")):
        ledger = decision_ledger_for_status(status)
        target_decision_refs = clock_affected_decision_refs(ledger, selected)
        if target_decision_refs:
            try:
                ledger, invalidation, appended = append_dependency_invalidation(
                    ledger,
                    {
                        "dependency_ref": "source_media.clock",
                        "target_decision_refs": target_decision_refs,
                        "reason_code": "source_clock_changed",
                        "reason": "The canonical source timing changed within this decision scope.",
                        "validity_effect": "stale",
                        "authority": str(payload.get("authority") or "explicit_user_correction"),
                        "created_by": str(payload.get("created_by") or "analyst"),
                    },
                    analysis_id=analysis_id,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            status["canonical_decision_ledger"] = ledger
            write_decision_ledger_file(status)
            if appended:
                append_analysis_event(
                    status,
                    "source_clock_dependency_invalidation",
                    details={
                        "target_decision_refs": target_decision_refs,
                        "changed_scope": selected,
                    },
                )
            persist_analysis_record_for_status(status)
    return {
        "analysis_id": analysis_id,
        "selected_time_scope": selected,
        "affected_dependent_refs": affected,
        "invalidation": invalidation,
    }


@app.post("/api/evidence-quality/assess", response_model=dict)
async def assess_evidence_quality_route(payload: Dict[str, Any] = Body(...)) -> dict:
    """Assess evidence fitness while keeping every result calmly inspectable."""
    try:
        assessment = assess_evidence_quality(payload)
        uses = payload.get("evaluate_uses") or [
            "inspect",
            "exploratory_analysis",
            "descriptive_measurement",
            "comparative_inference",
            "proposition_candidate",
            "mature_projection",
            "verified_report_claim",
        ]
        evaluations = {
            str(use): evaluate_quality_use(assessment, str(use)) for use in uses
        }
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "assessed", "assessment": assessment, "use_evaluations": evaluations}


@app.post("/api/analysis/{analysis_id}/execution-graph/affected-plan", response_model=dict)
async def plan_analysis_affected_branches(
    analysis_id: str, payload: Dict[str, Any] = Body(...)
) -> dict:
    """Return deterministic downstream work for changed scientific feature stages."""
    if get_analysis_entry(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    changed_nodes = payload.get("changed_nodes")
    if not isinstance(changed_nodes, list):
        raise HTTPException(status_code=400, detail="changed_nodes must be a list")
    try:
        plan = plan_affected_branches(
            load_execution_graph(),
            changed_nodes,
            include_operational_edges=bool(payload.get("include_operational_edges")),
        )
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"analysis_id": analysis_id, "affected_branch_plan": plan}


@app.post("/api/analysis/{analysis_id}/measurement-runs/native-core", response_model=dict)
async def run_native_core_measurements(
    analysis_id: str, payload: Dict[str, Any] = Body(default={})
) -> dict:
    """Run source-traceable transcript, speaker, VAD, and scene measurements."""
    if get_analysis_entry(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    try:
        service = ReproducibleMeasurementService(
            analysis_id,
            RESULTS_DIR / analysis_id,
            RESULTS_DIR.parent,
        )
        return service.run(
            persist=bool(payload.get("persist", True)),
            parameters=payload.get("parameters") if isinstance(payload.get("parameters"), dict) else None,
        )
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/analysis/{analysis_id}/shot-boundaries/measure", response_model=dict)
async def measure_analysis_shot_boundaries(
    analysis_id: str, payload: Dict[str, Any] = Body(default={})
) -> dict:
    """Measure true source-video shot intervals with the local governed provider."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    source = Path(str(status.get("source_video_path") or status.get("file_path") or ""))
    persist = bool(payload.get("persist", True))
    output_path = RESULTS_DIR / analysis_id / "shot_boundaries.json" if persist else None
    try:
        measured = measure_shot_boundaries(
            source,
            analysis_id=analysis_id,
            threshold=float(payload.get("threshold", 27.0)),
            min_scene_len_frames=int(payload.get("min_scene_len_frames", 10)),
            output_path=output_path,
        )
    except (FileNotFoundError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if persist:
        status.setdefault("output_files", {})["shot_boundaries"] = str(output_path)
        status.setdefault("results", {}).setdefault("visual_analysis", {})["shot_boundaries"] = measured
        refresh_master_schema_metadata_surfaces(status)
        persist_analysis_record_for_status(status)
    return {"analysis_id": analysis_id, "persisted": persist, "shot_boundaries": measured}


def interpretation_registry_for_analysis(analysis_id: str) -> InterpretationRegistry:
    return InterpretationRegistry(
        analysis_id,
        RESULTS_DIR / analysis_id / "interpretation_registry.json",
    )


@app.get("/api/analysis/{analysis_id}/interpretation-registry", response_model=dict)
async def get_interpretation_registry(analysis_id: str) -> dict:
    if get_analysis_entry(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    return interpretation_registry_for_analysis(analysis_id).view()


@app.post("/api/analysis/{analysis_id}/interpretation-registry/{record_kind}", response_model=dict)
async def append_interpretation_record(
    analysis_id: str, record_kind: str, payload: Dict[str, Any] = Body(...)
) -> dict:
    if get_analysis_entry(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    registry = interpretation_registry_for_analysis(analysis_id)
    handlers = {
        "claims": registry.append_claim,
        "propositions": registry.append_proposition,
        "relations": registry.append_relation,
        "state-transitions": registry.append_transition,
        "invalidations": registry.invalidate,
    }
    if record_kind not in handlers:
        raise HTTPException(status_code=404, detail="Unknown interpretation record kind")
    try:
        result = handlers[record_kind](payload, persist=bool(payload.get("persist", True)))
    except (OSError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"analysis_id": analysis_id, **result}


@app.post("/api/analysis/{analysis_id}/framework-projections", response_model=dict)
async def project_analysis_frameworks(
    analysis_id: str, payload: Dict[str, Any] = Body(default={})
) -> dict:
    if get_analysis_entry(analysis_id) is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    projections = build_framework_projections(
        analysis_id,
        interpretation_registry_for_analysis(analysis_id).view(),
    )
    persisted = bool(payload.get("persist", True))
    if persisted:
        write_framework_projections(
            RESULTS_DIR / analysis_id / "framework_projections.json",
            projections,
        )
    return {"analysis_id": analysis_id, "persisted": persisted, "framework_projections": projections}


@app.post("/api/analysis/{analysis_id}/interpretation-registry/propositions/{proposition_id}/confirm", response_model=dict)
async def confirm_interpretation_proposition(
    analysis_id: str, proposition_id: str, payload: Dict[str, Any] = Body(...)
) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    registry = interpretation_registry_for_analysis(analysis_id).view()
    proposition = next(
        (item for item in registry.get("records", []) if item.get("record_id") == proposition_id),
        None,
    )
    if proposition is None:
        raise HTTPException(status_code=404, detail="Proposition not found")
    try:
        ledger, decision, appended = confirm_proposition_to_ledger(
            analysis_id=analysis_id,
            ledger=decision_ledger_for_status(status),
            proposition=proposition,
            payload=payload,
        )
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    status["canonical_decision_ledger"] = ledger
    write_decision_ledger_file(status)
    persist_analysis_record_for_status(status)
    return {"analysis_id": analysis_id, "appended": appended, "decision": decision}


@app.post("/api/source-media/{analysis_id}/references", response_model=dict)
async def upload_source_media_references(
    analysis_id: str,
    files: List[UploadFile] = File(...),
) -> dict:
    """Attach reference files to an analysis source-media record."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    allowed_extensions = {
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".jpeg",
        ".jpg",
        ".png",
        ".webp",
        ".wav",
        ".mp3",
        ".m4a",
        ".aac",
        ".flac",
        ".ogg",
    }
    analysis_dir = RESULTS_DIR / analysis_id
    references_dir = analysis_dir / "reference_materials"
    references_dir.mkdir(parents=True, exist_ok=True)

    saved_files = status.setdefault("source_media_reference_files", [])
    uploaded_items = []

    for file in files:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported reference file type: {suffix or 'unknown'}",
            )
        safe_stem = slugify_name(Path(file.filename or "reference").stem)
        stored_name = f"{safe_stem}_{uuid.uuid4().hex[:8]}{suffix}"
        destination = references_dir / stored_name
        with open(destination, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        item = {
            "filename": file.filename,
            "stored_filename": stored_name,
            "media_type": file.content_type or "",
            "size_bytes": destination.stat().st_size,
            "download_url": f"/api/source-media/{analysis_id}/references/{stored_name}",
        }
        saved_files.append(item)
        uploaded_items.append(item)

    write_source_media_metadata_files(status)
    append_analysis_event(
        status,
        "source_media_references_uploaded",
        details={"count": len(uploaded_items)},
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "reference_files": uploaded_items,
        "source_media_metadata": status.get("source_media_metadata", {}),
    }


@app.post("/api/source-media/{analysis_id}/web-metadata", response_model=dict)
async def harvest_source_media_web_metadata(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    """Retrieve governed candidate metadata from a web address."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    source_url = str(payload.get("url") or "").strip()
    if not source_url:
        raise HTTPException(status_code=400, detail="Missing web metadata URL")

    harvest = harvest_web_address_metadata(source_url)
    sources = status.setdefault("source_media_web_metadata_sources", [])
    source_key = canonical_web_metadata_url(source_url)
    sources[:] = [
        item
        for item in sources
        if canonical_web_metadata_url(item.get("url") or item.get("fields", {}).get("source_url")) != source_key
    ]
    sources.append(harvest)
    sources[:] = sorted(sources, key=web_metadata_source_sort_key)

    write_source_media_metadata_files(status)
    append_analysis_event(
        status,
        "source_media_web_metadata_retrieved",
        details={
            "url": source_url,
            "retrieved_at": harvest.get("retrieved_at"),
            "candidate_count": len(harvest.get("candidates") or []),
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "web_metadata_source": harvest,
        "source_media_metadata": build_source_media_metadata_payload(status),
    }


@app.post("/api/source-media/{analysis_id}/web-metadata/dedupe", response_model=dict)
async def dedupe_source_media_web_metadata(analysis_id: str) -> dict:
    """Drop duplicate web metadata sources by canonical URL, keeping the newest source."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    sources = status.setdefault("source_media_web_metadata_sources", [])
    before_count = len(sources)
    sources[:] = dedupe_web_metadata_sources(sources)

    write_source_media_metadata_files(status)
    append_analysis_event(
        status,
        "source_media_web_metadata_deduped",
        details={
            "before_count": before_count,
            "after_count": len(sources),
            "dropped_count": max(0, before_count - len(sources)),
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "dropped_count": max(0, before_count - len(sources)),
        "source_media_metadata": build_source_media_metadata_payload(status),
    }


@app.patch("/api/source-media/{analysis_id}/web-metadata/{source_id}", response_model=dict)
async def update_source_media_web_metadata_source(
    analysis_id: str,
    source_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    """Update governed web metadata source preference."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    sources = status.setdefault("source_media_web_metadata_sources", [])
    target = next((item for item in sources if str(item.get("id")) == source_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Web metadata source not found")

    preference = str(payload.get("preference") or "").strip().lower()
    if "preference" in payload:
        if preference not in {"main", "supporting", "background"}:
            raise HTTPException(status_code=400, detail="Preference must be main, supporting, or background")
        target["preference"] = preference
    if "fields" in payload:
        fields = payload.get("fields")
        if not isinstance(fields, dict):
            raise HTTPException(status_code=400, detail="Web metadata fields must be an object")
        existing_fields = target.get("fields") if isinstance(target.get("fields"), dict) else {}
        existing_fields.update(fields)
        target["fields"] = existing_fields
        target["corrected_at"] = utc_now_iso()
        target["review_state"] = "corrected_candidate"
    if "candidates" in payload:
        candidates = payload.get("candidates")
        if not isinstance(candidates, list):
            raise HTTPException(status_code=400, detail="Web metadata candidates must be a list")
        target["candidates"] = [item for item in candidates if isinstance(item, dict)]
        target["corrected_at"] = utc_now_iso()
        target["review_state"] = "corrected_candidate"
    sources[:] = sorted(sources, key=web_metadata_source_sort_key)

    write_source_media_metadata_files(status)
    append_analysis_event(
        status,
        "source_media_web_metadata_source_updated",
        details={
            "source_id": source_id,
            "url": target.get("url"),
            "preference": target.get("preference"),
            "fields_corrected": "fields" in payload,
            "candidates_corrected": "candidates" in payload,
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "web_metadata_source": target,
        "source_media_metadata": build_source_media_metadata_payload(status),
    }


@app.delete("/api/source-media/{analysis_id}/web-metadata/{source_id}", response_model=dict)
async def delete_source_media_web_metadata_source(
    analysis_id: str,
    source_id: str,
) -> dict:
    """Remove a governed web metadata source from the evidence tray."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    sources = status.setdefault("source_media_web_metadata_sources", [])
    removed = next((item for item in sources if str(item.get("id")) == source_id), None)
    if removed is None:
        raise HTTPException(status_code=404, detail="Web metadata source not found")
    sources[:] = [item for item in sources if str(item.get("id")) != source_id]

    write_source_media_metadata_files(status)
    append_analysis_event(
        status,
        "source_media_web_metadata_deleted",
        details={
            "source_id": source_id,
            "url": removed.get("url"),
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "deleted_source_id": source_id,
        "source_media_metadata": build_source_media_metadata_payload(status),
    }


@app.get("/api/taxonomy/shared", response_model=dict)
async def get_shared_taxonomy(
    scope: Optional[str] = None,
    parent_value: Optional[str] = None,
) -> dict:
    if scope and scope not in ALLOWED_TAXONOMY_SCOPES:
        raise HTTPException(status_code=400, detail="Unsupported taxonomy scope")

    labels = list_shared_taxonomy_labels(scope=scope, parent_value=parent_value)
    return {
        "status": "ok",
        "scope": scope,
        "parent_value": parent_value or "",
        "labels": labels,
    }


@app.post("/api/taxonomy/shared/labels", response_model=dict)
async def save_shared_taxonomy_label(payload: Dict[str, Any] = Body(...)) -> dict:
    entry = upsert_shared_taxonomy_label(
        scope=str(payload.get("scope") or ""),
        label=str(payload.get("label") or ""),
        parent_value=payload.get("parent_value"),
        created_by=str(payload.get("created_by") or "analyst"),
        source=str(payload.get("source") or "manual_share"),
        notes=str(payload.get("notes") or ""),
    )
    return {
        "status": "saved",
        "label": entry,
    }


@app.post("/api/pos-analysis/{analysis_id}/refresh", response_model=dict)
async def refresh_pos_analysis(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    """Rebuild POS analysis from corrected transcript content."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    output_files = status.setdefault("output_files", {})
    transcript_segments = payload.get("segments") or []
    language_code = (
        payload.get("language_code")
        or payload.get("language")
        or (
            ((status.get("results") or {}).get("analysis_artifacts") or {})
            .get("transcript", {})
            .get("language")
        )
        or "en"
    )

    transcript_text = " ".join(
        str(segment.get("text", "")).strip()
        for segment in transcript_segments
        if isinstance(segment, dict) and str(segment.get("text", "")).strip()
    ).strip()
    timing_transcript = {
        "segments": transcript_segments,
        "transcription_strategy": payload.get("transcription_strategy")
        or "manual_correction",
    }

    if not transcript_text:
        transcript_path_raw = output_files.get("transcript")
        if transcript_path_raw and Path(transcript_path_raw).exists():
            try:
                transcript_data = json.loads(
                    Path(transcript_path_raw).read_text(encoding="utf-8")
                )
                transcript_text = " ".join(
                    str(segment.get("text", "")).strip()
                    for segment in transcript_data.get("segments", [])
                    if str(segment.get("text", "")).strip()
                ).strip()
                language_code = (
                    transcript_data.get("language")
                    or (transcript_data.get("language_info") or {}).get("code")
                    or language_code
                )
                timing_transcript = transcript_data
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not read transcript for POS refresh: {exc}",
                ) from exc

    if not transcript_text:
        raise HTTPException(
            status_code=400,
            detail="No corrected transcript text available for POS refresh",
        )

    pos_result = POSAnalysis(transcript_text, language_code=language_code).run()
    pos_result["transcript_timing_authority"] = build_transcript_timing_authority(
        timing_transcript
    )
    pos_result["source_transcript_clock"] = "operational_transcript"

    pos_path_raw = output_files.get("pos_analysis")
    if pos_path_raw:
        pos_path = Path(pos_path_raw)
    else:
        transcript_path_raw = output_files.get("transcript")
        if transcript_path_raw:
            transcript_path = Path(transcript_path_raw)
            pos_path = transcript_path.with_name(
                f"{transcript_path.stem.replace('_transcript', '')}_pos.json"
            )
        else:
            pos_path = TRANSCRIPTS_DIR / f"{analysis_id}_pos.json"

    pos_path.parent.mkdir(parents=True, exist_ok=True)
    pos_path.write_text(
        json.dumps(pos_result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    output_files["pos_analysis"] = str(pos_path)

    append_analysis_event(
        status,
        "pos_analysis_refreshed",
        details={
            "language_code": language_code,
            "segment_count": len(transcript_segments),
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "output_path": str(pos_path),
    }


@app.get("/api/source-media/{analysis_id}/references/{stored_filename}")
async def download_source_media_reference(analysis_id: str, stored_filename: str):
    """Download an attached source-media reference file."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    references_dir = RESULTS_DIR / analysis_id / "reference_materials"
    file_path = references_dir / stored_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Reference file not found")

    metadata = next(
        (
            item
            for item in status.get("source_media_reference_files", [])
            if item.get("stored_filename") == stored_filename
        ),
        None,
    )
    filename = metadata.get("filename") if isinstance(metadata, dict) else stored_filename
    media_type = metadata.get("media_type") if isinstance(metadata, dict) else None
    return FileResponse(path=file_path, filename=filename, media_type=media_type)


@app.get("/api/annotation-corrections/{analysis_id}", response_model=dict)
async def get_annotation_corrections(analysis_id: str) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    if status.get("annotation_corrections"):
        write_annotation_corrections_file(status)
        persist_analysis_record_for_status(status)

    return {
        "status": "ok",
        "analysis_id": analysis_id,
        "annotation_corrections": build_annotation_corrections_payload(status),
    }


@app.get("/api/analysis/{analysis_id}/projected-state", response_model=dict)
async def get_projected_state(
    analysis_id: str,
    subject_ref: str,
    timestamp: float,
) -> dict:
    """Return a calm, read-only projection over current legacy evidence."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    return project_subject_state(
        analysis_id=analysis_id,
        subject_ref=subject_ref,
        timestamp=timestamp,
        tracked_objects=tracked_objects_for_projection(status),
        corrections=build_annotation_corrections_payload(status),
        decisions=decision_ledger_for_status(status).get("decisions", []),
    )


@app.post("/api/analysis/{analysis_id}/projected-state/batch", response_model=dict)
async def get_projected_state_batch(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    """Resolve visible subjects in one quiet, read-only request."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    requests = payload.get("requests") or []
    if not isinstance(requests, list):
        raise HTTPException(status_code=400, detail="requests must be a list")
    if len(requests) > 500:
        raise HTTPException(status_code=400, detail="At most 500 projections may be requested")
    return project_subject_states(
        analysis_id=analysis_id,
        requests=requests,
        tracked_objects=tracked_objects_for_projection(status),
        corrections=build_annotation_corrections_payload(status),
        decisions=decision_ledger_for_status(status).get("decisions", []),
    )


@app.post("/api/analysis/{analysis_id}/claims/projected", response_model=dict)
async def get_projected_canonical_claims(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    """Resolve canonical claims for any governed subject/property family."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    subject_refs = payload.get("subject_refs") or []
    properties = payload.get("properties") or []
    if not isinstance(subject_refs, list) or not isinstance(properties, list):
        raise HTTPException(status_code=400, detail="subject_refs and properties must be lists")
    if len(subject_refs) > 1000 or len(properties) > 100:
        raise HTTPException(status_code=400, detail="Projection request is too large")
    timestamp = payload.get("timestamp")
    if timestamp is not None:
        timestamp = safe_float(timestamp)
        if timestamp is None or timestamp < 0:
            raise HTTPException(status_code=400, detail="timestamp must be a non-negative number")
    return project_canonical_claims(
        analysis_id=analysis_id,
        decisions=decision_ledger_for_status(status).get("decisions", []),
        subject_refs=subject_refs,
        properties=properties,
        timestamp=timestamp,
    )


@app.get("/api/analysis/{analysis_id}/decisions", response_model=dict)
async def get_canonical_decisions(analysis_id: str) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    return {"status": "ok", "decision_ledger": decision_ledger_for_status(status)}


@app.post("/api/analysis/{analysis_id}/taxonomy-applications", response_model=dict)
async def create_taxonomy_application(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    """Resolve a canonical term and append its scoped analyst application."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    try:
        ledger, decision, appended = apply_taxonomy_term(
            decision_ledger_for_status(status),
            load_vocabulary_registry(),
            payload,
            analysis_id=analysis_id,
        )
    except (OSError, ValueError, VocabularyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    status["canonical_decision_ledger"] = ledger
    write_decision_ledger_file(status)
    if appended:
        append_analysis_event(
            status,
            "taxonomy_application_appended",
            details={
                "decision_id": decision["decision_id"],
                "subject_ref": decision["subject_ref"],
                "term_ref": (decision.get("provenance") or {}).get("term_ref"),
            },
        )
    persist_analysis_record_for_status(status)
    return {
        "status": "appended" if appended else "unchanged",
        "analysis_id": analysis_id,
        "taxonomy_application": decision,
        "decision_count": len(ledger.get("decisions", [])),
    }


@app.post("/api/analysis/{analysis_id}/decisions", response_model=dict)
async def create_canonical_decision(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    """Append an accepted pilot decision without rewriting earlier records."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    try:
        ledger, decision, appended = append_decision(
            decision_ledger_for_status(status), payload, analysis_id=analysis_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    status["canonical_decision_ledger"] = ledger
    write_decision_ledger_file(status)
    if appended:
        append_analysis_event(
            status,
            "canonical_decision_appended",
            details={"decision_id": decision["decision_id"], "property": decision["property"]},
        )
    persist_analysis_record_for_status(status)
    return {
        "status": "appended" if appended else "unchanged",
        "analysis_id": analysis_id,
        "decision": decision,
        "decision_count": len(ledger.get("decisions", [])),
    }


@app.post("/api/analysis/{analysis_id}/decisions/invalidate", response_model=dict)
async def invalidate_canonical_decisions(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    """Append a validity event; original decisions remain immutable."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    try:
        ledger, event, appended = append_invalidation(
            decision_ledger_for_status(status), payload, analysis_id=analysis_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    status["canonical_decision_ledger"] = ledger
    write_decision_ledger_file(status)
    if appended:
        append_analysis_event(
            status,
            "canonical_decision_invalidated",
            details={
                "invalidation_id": event["decision_id"],
                "target_decision_refs": event["target_decision_refs"],
                "reason_code": event["reason_code"],
            },
        )
    persist_analysis_record_for_status(status)
    return {
        "status": "appended" if appended else "unchanged",
        "analysis_id": analysis_id,
        "invalidation": event,
        "decision_count": len(ledger.get("decisions", [])),
    }


@app.post("/api/analysis/{analysis_id}/decisions/dependency-change", response_model=dict)
async def invalidate_decisions_for_dependency_change(
    analysis_id: str,
    payload: Dict[str, Any] = Body(...),
) -> dict:
    """Apply a declared clock, track, geometry, evidence, or taxonomy change."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    dependency_ref = str(payload.get("dependency_ref") or "").strip()
    if not dependency_ref:
        raise HTTPException(status_code=400, detail="dependency_ref is required")
    try:
        ledger, event, appended = append_dependency_invalidation(
            decision_ledger_for_status(status), payload, analysis_id=analysis_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    status["canonical_decision_ledger"] = ledger
    write_decision_ledger_file(status)
    if appended:
        append_analysis_event(
            status,
            "canonical_dependency_invalidation",
            details={
                "dependency_ref": dependency_ref,
                "validity_effect": event["validity_effect"],
                "target_decision_refs": event["target_decision_refs"],
            },
        )
    persist_analysis_record_for_status(status)
    return {
        "status": "appended" if appended else "unchanged",
        "analysis_id": analysis_id,
        "invalidation": event,
    }


@app.post("/api/annotation-corrections/{analysis_id}", response_model=dict)
async def update_annotation_corrections(
    analysis_id: str, payload: Dict[str, Any] = Body(...)
) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    corrections = status.setdefault("annotation_corrections", {})
    previous_corrections = json.loads(json.dumps(corrections, default=str))
    corrections["version"] = 1
    corrections["updated_at"] = utc_now_iso()
    corrections["updated_by"] = payload.get("updated_by") or "analyst"

    if "text_substitutions" in payload:
        corrections["text_substitutions"] = payload.get("text_substitutions") or []
    else:
        corrections.setdefault("text_substitutions", [])

    if "label_overrides" in payload:
        corrections["label_overrides"] = payload.get("label_overrides") or []
    else:
        corrections.setdefault("label_overrides", [])

    if "manual_transcript_entries" in payload:
        corrections["manual_transcript_entries"] = (
            payload.get("manual_transcript_entries") or []
        )
    else:
        corrections.setdefault("manual_transcript_entries", [])

    if "manual_visual_annotations" in payload:
        corrections["manual_visual_annotations"] = (
            payload.get("manual_visual_annotations") or []
        )
    else:
        corrections.setdefault("manual_visual_annotations", [])

    if "proliferation_decisions" in payload:
        corrections["proliferation_decisions"] = (
            payload.get("proliferation_decisions") or []
        )
    else:
        corrections.setdefault("proliferation_decisions", [])

    if "master_schema_presence_intervals" in payload:
        corrections["master_schema_presence_intervals"] = (
            payload.get("master_schema_presence_intervals") or []
        )
    else:
        corrections.setdefault("master_schema_presence_intervals", [])

    if "meaning_network_custom_lanes" in payload:
        corrections["meaning_network_custom_lanes"] = (
            payload.get("meaning_network_custom_lanes") or []
        )
    else:
        corrections.setdefault("meaning_network_custom_lanes", [])

    if "transcript_clock_offset_seconds" in payload:
        corrections["transcript_clock_offset_seconds"] = payload.get(
            "transcript_clock_offset_seconds"
        )
    else:
        corrections.setdefault("transcript_clock_offset_seconds", None)

    ledger, canonical_events = sync_corrections_to_ledger(
        decision_ledger_for_status(status),
        previous_corrections,
        corrections,
        analysis_id=analysis_id,
        created_at=corrections["updated_at"],
        created_by=corrections["updated_by"],
    )
    status["canonical_decision_ledger"] = ledger
    previous_clock_offset = previous_corrections.get("transcript_clock_offset_seconds")
    current_clock_offset = corrections.get("transcript_clock_offset_seconds")
    if previous_clock_offset != current_clock_offset:
        try:
            ledger, clock_event, clock_appended = append_dependency_invalidation(
                ledger,
                {
                    "dependency_ref": "source_media.clock",
                    "reason_code": "transcript_clock_offset_changed",
                    "reason": "The operational media clock changed; time-scoped decisions require review.",
                    "validity_effect": "stale",
                    "require_temporal_scope": True,
                    "created_at": corrections["updated_at"],
                    "created_by": corrections["updated_by"],
                },
                analysis_id=analysis_id,
            )
        except ValueError:
            clock_event = None
            clock_appended = False
        if clock_appended and clock_event:
            canonical_events.append(clock_event)
            status["canonical_decision_ledger"] = ledger
    if canonical_events:
        write_decision_ledger_file(status)
        append_analysis_event(
            status,
            "canonical_correction_sync",
            details={
                "event_count": len(canonical_events),
                "decision_refs": [event["decision_id"] for event in canonical_events],
                "actions": [event["decision_action"] for event in canonical_events],
            },
        )

    write_annotation_corrections_file(status)
    write_mise_en_scene_artifacts_for_status(status)
    append_analysis_event(
        status,
        "annotation_corrections_updated",
        details={
            "text_substitutions": len(corrections.get("text_substitutions", [])),
            "label_overrides": len(corrections.get("label_overrides", [])),
            "manual_transcript_entries": len(
                corrections.get("manual_transcript_entries", [])
            ),
            "manual_visual_annotations": len(
                corrections.get("manual_visual_annotations", [])
            ),
            "master_schema_presence_intervals": len(
                corrections.get("master_schema_presence_intervals", [])
            ),
            "meaning_network_custom_lanes": len(
                corrections.get("meaning_network_custom_lanes", [])
            ),
        },
    )
    persist_analysis_record_for_status(status)

    return {
        "status": "saved",
        "analysis_id": analysis_id,
        "annotation_corrections": build_annotation_corrections_payload(status),
    }


@app.post("/api/reveal-workspace-path/{path_type}", response_model=dict)
async def reveal_workspace_path(path_type: str) -> dict:
    """Reveal a VAA1 workspace folder in the local file manager."""
    path_map = {
        "results": RESULTS_DIR.resolve(),
        "imports": IMPORTED_WORK_DIR.resolve(),
    }

    target_path = path_map.get(path_type)
    if target_path is None:
        raise HTTPException(status_code=400, detail="Invalid workspace path type")

    if not target_path.exists():
        raise HTTPException(status_code=404, detail="Workspace path not found")

    try:
        if sys.platform == "darwin":
            subprocess.run(["open", str(target_path)], check=True)
        elif os.name == "nt":
            os.startfile(str(target_path))  # type: ignore[attr-defined]
        else:
            subprocess.run(["xdg-open", str(target_path)], check=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not reveal workspace path: {exc}")

    return {
        "message": "Workspace path revealed",
        "path": str(target_path),
    }

# Keep your existing endpoints (they work well)
@app.get("/api/analyses", response_model=dict)
async def list_analyses(limit: int = 10) -> dict:
    """
    List recent analyses (for admin/debugging)
    """
    # Fix: Handle None values in sorting
    all_records = collect_saved_analysis_records()
    recent_analyses = dict(sorted(
        all_records.items(),
        key=lambda x: (
            x[1].get('start_time', 0) or 0,
            x[1].get('uploaded_at', ""),
        ),
        reverse=True
    )[:limit])
    
    return {
        "analyses": {
            aid: {
                "status": info["status"],
                "filename": info["original_filename"],
                "progress": info["progress"],
                "pipeline_type": info.get("pipeline_type", "full"),
                "start_time": info.get("start_time"),
                "uploaded_at": info.get("uploaded_at"),
                "analysis_completed_at": info.get("analysis_completed_at"),
                "cvatID": info.get("cvatID"),
            }
            for aid, info in recent_analyses.items()
        }
    }

@app.delete("/api/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str) -> dict:
    """Delete analysis and associated files"""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    
    try:
        remove_analysis_artifacts(analysis_id, status)
        
        # Remove from status tracking
        analysis_status.pop(analysis_id, None)
        
        logger.info(f"Analysis {analysis_id} deleted successfully")
        
        return {"message": "Analysis deleted successfully"}
    
    except Exception as e:
        logger.error(f"Failed to delete analysis {analysis_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete analysis")


@app.post("/api/session/clear", response_model=dict)
async def clear_session() -> dict:
    """
    Clear completed/uploaded/error analyses and their files from the backend.
    Processing analyses are left intact because FastAPI background tasks are not
    cancelable through the current runtime model.
    """
    cleared = []
    skipped_processing = []

    for analysis_id, status in list(collect_saved_analysis_records().items()):
        if status.get("status") == "processing":
            skipped_processing.append(analysis_id)
            continue

        try:
            remove_analysis_artifacts(analysis_id, status)
            analysis_status.pop(analysis_id, None)
            cleared.append(analysis_id)
        except Exception as exc:
            logger.warning("Failed to clear analysis %s during session reset: %s", analysis_id, exc)

    return {
        "message": "Backend session cleared",
        "cleared_analysis_ids": cleared,
        "skipped_processing_ids": skipped_processing,
    }


@app.post("/api/import-bundle", response_model=dict)
async def import_saved_work(file: UploadFile = File(...)) -> dict:
    """
    Import a saved VAA1 analysis bundle (.zip) from disk into the local backend
    workspace so it appears in Saved Work and can be reopened.
    """
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Saved work import requires a .zip file")

    session_import_id = str(uuid.uuid4())
    import_dir = IMPORTED_WORK_DIR / session_import_id
    import_dir.mkdir(parents=True, exist_ok=True)

    archive_path = import_dir / file.filename
    with open(archive_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        with zipfile.ZipFile(archive_path, "r") as archive:
            archive.extractall(import_dir)
    except zipfile.BadZipFile as exc:
        shutil.rmtree(import_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Invalid zip bundle: {exc}")

    bundle_stem = Path(file.filename).stem.replace("_analysis_bundle", "")
    project_manifest_path = import_dir / "project_manifest.json"
    if project_manifest_path.exists():
        try:
            project_manifest = json.loads(project_manifest_path.read_text(encoding="utf-8"))
        except Exception as exc:
            shutil.rmtree(import_dir, ignore_errors=True)
            raise HTTPException(status_code=400, detail=f"Invalid project bundle manifest: {exc}")

        analyses_root = import_dir / "analyses"
        if not analyses_root.exists():
            shutil.rmtree(import_dir, ignore_errors=True)
            raise HTTPException(status_code=400, detail="Project bundle did not contain an analyses folder")

        imported_statuses = []
        for analysis_folder in analyses_root.iterdir():
            if not analysis_folder.is_dir():
                continue

            final_import_dir = IMPORTED_WORK_DIR / str(uuid.uuid4())
            shutil.copytree(analysis_folder, final_import_dir)
            output_files = infer_output_files_from_bundle(final_import_dir, analysis_folder.name)
            manifest = read_saved_work_manifest(final_import_dir, analysis_folder.name)
            if not output_files:
                shutil.rmtree(final_import_dir, ignore_errors=True)
                continue

            imported_statuses.append(
                register_imported_analysis(
                    import_dir=final_import_dir,
                    bundle_filename=file.filename,
                    output_files=output_files,
                    manifest=manifest,
                    original_filename_override=manifest.get("original_filename"),
                )
            )

        shutil.rmtree(import_dir, ignore_errors=True)

        if not imported_statuses:
            raise HTTPException(
                status_code=400,
                detail="No recognized VAA1 analyses were found inside the project bundle",
            )

        first_status = imported_statuses[0]
        return {
            "analysis_id": first_status["analysis_id"],
            "filename": first_status["original_filename"],
            "message": f"Project bundle imported with {len(imported_statuses)} analyses",
            "status": "completed",
            "bundle_type": "project",
            "imported_analysis_ids": [status["analysis_id"] for status in imported_statuses],
            "imported_count": len(imported_statuses),
            "project_name": project_manifest.get("project_name"),
        }

    output_files = infer_output_files_from_bundle(import_dir, bundle_stem)
    manifest = read_saved_work_manifest(import_dir, bundle_stem)
    if not output_files:
        shutil.rmtree(import_dir, ignore_errors=True)
        raise HTTPException(
            status_code=400,
            detail="No recognized VAA1 analysis files were found in the zip bundle",
        )

    status = register_imported_analysis(
        import_dir=import_dir,
        bundle_filename=file.filename,
        output_files=output_files,
        manifest=manifest,
        original_filename_override=manifest.get("original_filename") or (
            f"{bundle_stem}.mp4" if "video" in output_files else None
        ),
    )

    return {
        "analysis_id": status["analysis_id"],
        "filename": status["original_filename"],
        "message": "Saved work imported successfully",
        "status": "completed",
        "bundle_type": "analysis",
    }

@app.get("/", response_model=dict)
async def root() -> dict:
    """API root endpoint"""
    return {
        "message": "Video Analysis API with Audio Pipeline",
        "version": "1.1.0",
        "endpoints": {
            "upload": "/api/upload",
            "analyze": "/api/analyze/{id}?pipeline_type=full|visual_only|audio_only",
            "status": "/api/status/{id}",
            "download": "/api/download/{id}/{type}",
            "analyses": "/api/analyses"
        }
    }

@app.get("/api/health", response_model=dict)
async def health_check() -> dict:
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Video Analysis API with Audio",
        "timestamp": asyncio.get_event_loop().time()
    }

# Frontend serving (keep your existing code)
frontend_build_dir = Path("src/frontend/out")
if frontend_build_dir.exists():
    app.mount("/static", StaticFiles(directory=frontend_build_dir / "static"), name="static")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all routes not handled by API"""
        frontend_paths = [
            frontend_build_dir / full_path,
            frontend_build_dir / f"{full_path}.html", 
            frontend_build_dir / "index.html"
        ]
        
        for path in frontend_paths:
            if path.exists() and path.is_file():
                return FileResponse(path)
        
        return FileResponse(frontend_build_dir / "index.html")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Video Analysis API with Audio on http://localhost:8000")
    logger.info("API Documentation: http://localhost:8000/docs")
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0", 
        port=8000, 
        reload=False
    )
