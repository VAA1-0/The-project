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
import urllib.parse
import urllib.request
from typing import Dict, Any, Optional, List
import asyncio
import csv
from datetime import datetime, timezone
from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
from src.backend.analysis.pipeline_manager import run_full_pipeline
from src.backend.analysis.pipeline_ingestion import run_ingestion_pipeline, validate_video
from src.backend.analysis.pipeline_audio_text import AudioTranscriptionPipeline
from src.backend.analysis.audio_prosody import analyze_audio_prosody
from src.backend.analysis.audio_diarization import write_audio_diarization_scaffold
from src.backend.analysis.audio_sample_cloud import (
    build_audio_sample_clouds_from_diarization,
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


def build_transcript_quality_report(
    transcript: Dict[str, Any],
    *,
    media_duration_seconds: Any = None,
    audio_duration_seconds: Any = None,
    trailing_gap_warn_seconds: float = 8.0,
    trailing_gap_warn_ratio: float = 0.08,
) -> Dict[str, Any]:
    segments = transcript.get("segments") or []
    last_end_seconds = max(
        (safe_float(segment.get("end")) or 0.0 for segment in segments),
        default=0.0,
    )
    media_duration = safe_float(media_duration_seconds)
    audio_duration = safe_float(audio_duration_seconds)

    target_duration = media_duration or audio_duration or last_end_seconds
    trailing_uncovered_seconds = max(0.0, (target_duration or 0.0) - last_end_seconds)
    coverage_ratio = (
        min(1.0, max(0.0, last_end_seconds / target_duration))
        if target_duration and target_duration > 0
        else 1.0
    )

    coverage_shortfall = trailing_uncovered_seconds > max(
        trailing_gap_warn_seconds,
        (target_duration or 0.0) * trailing_gap_warn_ratio,
    )

    reasons: List[str] = []
    if not segments:
        reasons.append("no_transcript_segments")
    if coverage_shortfall:
        reasons.append("trailing_coverage_shortfall")

    return {
        "status": "degraded" if reasons else "ok",
        "segment_count": len(segments),
        "last_segment_end_seconds": round(last_end_seconds, 3),
        "media_duration_seconds": round(media_duration, 3) if media_duration is not None else None,
        "audio_duration_seconds": round(audio_duration, 3) if audio_duration is not None else None,
        "coverage_target_seconds": round(target_duration, 3) if target_duration is not None else None,
        "coverage_ratio": round(coverage_ratio, 4),
        "trailing_uncovered_seconds": round(trailing_uncovered_seconds, 3),
        "thresholds": {
            "warn_gap_seconds": trailing_gap_warn_seconds,
            "warn_gap_ratio": trailing_gap_warn_ratio,
        },
        "reasons": reasons,
    }


def build_transcript_timeline_segments(
    transcript: Dict[str, Any],
    *,
    coverage_target_seconds: Any = None,
) -> List[Dict[str, Any]]:
    utterances = sorted(
        [
            {
                **segment,
                "start": safe_float(segment.get("start")) or 0.0,
                "end": safe_float(segment.get("end")) or 0.0,
            }
            for segment in (transcript.get("segments") or [])
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


def build_source_media_metadata_payload(
    status: Dict[str, Any],
    *,
    media_probe: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    source_video_path = status.get("source_video_path") or status.get("file_path")
    path_obj = Path(source_video_path) if source_video_path else None
    probe = media_probe or status.get("source_media_metadata") or {}
    user_annotations = status.get("source_media_annotations") or probe.get("user_annotations") or {}

    payload = {
        "analysis_id": status.get("analysis_id"),
        "original_filename": status.get("original_filename"),
        "stored_filename": status.get("filename"),
        "source_video_path": source_video_path,
        "source_video_exists": bool(path_obj and path_obj.exists()),
        "mime_type": probe.get("mime_type"),
        "format_name": probe.get("format_name"),
        "container_extension": probe.get("container_extension"),
        "duration_seconds": probe.get("duration"),
        "size_bytes": probe.get("size_bytes") or probe.get("size"),
        "video_codec": probe.get("video_codec"),
        "audio_codec": probe.get("audio_codec"),
        "has_audio": probe.get("has_audio"),
        "width": probe.get("width"),
        "height": probe.get("height"),
        "fps": probe.get("fps"),
        "video_bitrate": probe.get("video_bitrate"),
        "audio_bitrate": probe.get("audio_bitrate"),
        "audio_channels": probe.get("audio_channels"),
        "audio_sample_rate": probe.get("audio_sample_rate"),
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
            "reference_speakers": user_annotations.get("reference_speakers", []),
            "reference_relation": user_annotations.get("reference_relation", ""),
            "reference_source": user_annotations.get("reference_source", ""),
            "confidence": user_annotations.get("confidence", ""),
            "notes": user_annotations.get("notes", ""),
        },
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
    }


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

    return {
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
        "genre_annotations": genre_annotations,
        "cinematic_cues": {},
        "object_annotations": object_annotations,
        "track_annotations": track_annotations,
        "temporal_segments": temporal_segments,
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
    analysis_status[analysis_id] = status
    return status


def get_analysis_entry(analysis_id: str) -> Optional[Dict[str, Any]]:
    status = analysis_status.get(analysis_id)
    if status is not None:
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
        json.dumps(audio_prosody, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    output_files["audio_prosody"] = str(prosody_path)
    status["output_files"] = output_files
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
    return {
        "analysis_id": status.get("analysis_id"),
        "original_filename": status.get("original_filename"),
        "source_video_path": source_video_path,
        "source_video_exists_at_save_time": source_video_exists,
        "source_media_metadata": status.get("source_media_metadata", {}),
        "analysis_completed_at": status.get("analysis_completed_at"),
        "pipeline_type": status.get("pipeline_type", "full"),
        "analysis_tier": status.get("analysis_tier", "science_scan"),
        "modality_focus": status.get("modality_focus", "multimodal"),
        "matrix_files": [
            file_type for file_type in output_files.keys() if file_type.endswith("_matrix")
        ],
    }


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
        "transcript.json": "transcript",
        "linked_transcript.json": "linked_transcript",
        "audio_prosody.json": "audio_prosody",
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
                    transcript = audio_pipeline.rerun_with_chunked_fallback(
                        primary_transcript=transcript,
                    )
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
                            "strategy": transcript.get("transcription_strategy"),
                            "quality": transcript_quality,
                            "comparison": transcript.get("fallback_comparison") or {},
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
                lm_transcript_filename = f"{analysis_id}_lm_transcript.json"
                audio_prosody_filename = f"{analysis_id}_audio_prosody.json"
                audio_diarization_filename = f"{analysis_id}_audio_diarization_scaffold.json"
                audio_sample_clouds_filename = f"{analysis_id}_audio_sample_clouds.json"

                organized_audio_path = AUDIO_DIR / audio_filename
                organized_transcript_path = TRANSCRIPTS_DIR / transcript_filename
                organized_lm_path = TRANSCRIPTS_DIR / lm_transcript_filename
                organized_audio_prosody_path = TRANSCRIPTS_DIR / audio_prosody_filename
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

                if not original_transcript_path.exists():
                    alternative_path = audio_pipeline.output_dir / f"{Path(audio_path).stem}_transcript.json"
                    original_transcript_path = alternative_path

                if not original_transcript_path.exists():
                    raise FileNotFoundError("Transcript file not found")

                # Step 6: Move transcript
                shutil.move(str(original_transcript_path), organized_transcript_path)
                with open(organized_transcript_path, "w", encoding="utf-8") as f:
                    json.dump(transcript, f, indent=2, ensure_ascii=False)
                output_files["audio"] = str(organized_audio_path)
                output_files["transcript"] = str(organized_transcript_path)
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
                except Exception as prosody_error:
                    logger.warning("Audio prosody analysis failed: %s", prosody_error)
                    results["audio_prosody_error"] = str(prosody_error)
                    audio_prosody = None

                try:
                    audio_diarization = write_audio_diarization_scaffold(
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
                    audio_sample_clouds = build_audio_sample_clouds_from_diarization(
                        analysis_id,
                        audio_diarization=audio_diarization,
                        source_media_context=build_source_media_metadata_payload(status),
                        source_audio_path=organized_audio_path,
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

@app.get("/api/status/{analysis_id}", response_model=dict)
async def get_analysis_status(analysis_id: str) -> dict:
    """
    Get current status of analysis
    """
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

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
        "cvat_ingest": status.get("cvat_ingest"),
        "internal_artifacts": status.get("internal_artifacts"),
        "forensic_render_jobs": status.get("forensic_render_jobs", []),
        "source_samples": status.get("source_samples", []),
        "identity_refinement": status.get("identity_refinement"),
        "identity_triangulation": status.get("identity_triangulation"),
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
        linked_transcript_regenerated = regenerate_linked_transcript_if_needed(status)
        audio_prosody_regenerated = regenerate_audio_prosody_if_needed(status)
        visual_time_bank_regenerated = regenerate_time_bank_visual_artifacts_if_needed(status)
        if (
            linked_transcript_regenerated
            or audio_prosody_regenerated
            or visual_time_bank_regenerated
        ):
            persist_analysis_record_for_status(status)
            output_files = status.get("output_files", {})
        
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
    linked_transcript, audio_prosody, audio_diarization, time_bank_audio, lm_transcript, pos_analysis, expression_json, quan_analysis, face_anonymization_manifest
    """
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    if status["status"] != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")
    
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
        "audio_diarization": ("audio_diarization_scaffold.json", "application/json"),
        "audio_sample_clouds": ("audio_sample_clouds.json", "application/json"),
        "identity_triangulation": ("identity_triangulation_bundle.json", "application/json"),
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
        filename=download_filename
    )


@app.get("/api/download-bundle/{analysis_id}")
async def download_bundle(analysis_id: str):
    """Download all available analysis outputs as a single zip bundle."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")
    if status["status"] != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

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
        "audio_diarization": "audio_diarization_scaffold.json",
        "audio_sample_clouds": "audio_sample_clouds.json",
        "identity_triangulation": "identity_triangulation_bundle.json",
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
        "pos_matrix": "pos_matrix.json",
        "quant_matrix": "quant_matrix.json",
        "face_anonymization_manifest": "face_anonymization_manifest.json",
    }

    original_name = status["original_filename"]
    base_name = Path(original_name).stem
    archive_buffer = io.BytesIO()

    with zipfile.ZipFile(archive_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_type, file_path in output_files.items():
            path_obj = Path(file_path)
            if not path_obj.exists():
                continue
            archive_name = file_mapping.get(file_type, path_obj.name)
            archive.write(path_obj, arcname=f"{base_name}_{archive_name}")
        manifest_name = f"{base_name}_saved_work_manifest.json"
        archive.writestr(
            manifest_name,
            json.dumps(build_saved_work_manifest(status), indent=2, ensure_ascii=False),
        )

    archive_buffer.seek(0)
    bundle_path = RESULTS_DIR / f"{analysis_id}_bundle.zip"
    bundle_path.write_bytes(archive_buffer.getvalue())

    return FileResponse(
        path=bundle_path,
        media_type="application/zip",
        filename=f"{base_name}_analysis_bundle.zip",
    )


@app.post("/api/download-project-bundle")
async def download_project_bundle(payload: Dict[str, Any] = Body(...)):
    """Download a whole project bundle containing multiple completed analyses and project state."""
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
        "audio_diarization": "audio_diarization_scaffold.json",
        "audio_sample_clouds": "audio_sample_clouds.json",
        "identity_triangulation": "identity_triangulation_bundle.json",
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
            for file_type, file_path in output_files.items():
                path_obj = Path(file_path)
                if not path_obj.exists():
                    continue
                archive_name = file_mapping.get(file_type, path_obj.name)
                archive.write(path_obj, arcname=f"{folder_name}/{archive_name}")

            archive.writestr(
                f"{folder_name}/saved_work_manifest.json",
                json.dumps(
                    build_saved_work_manifest(status),
                    indent=2,
                    ensure_ascii=False,
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


@app.get("/api/source-media/{analysis_id}", response_model=dict)
async def get_source_media_metadata(analysis_id: str) -> dict:
    """Return the stored source media metadata for an analysis."""
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    if not status.get("source_media_metadata"):
        write_source_media_metadata_files(status)
        persist_analysis_record_for_status(status)

    return {
        "analysis_id": analysis_id,
        "source_media_metadata": status.get("source_media_metadata", {}),
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
    ):
        if key in payload:
            value = payload.get(key)
            if key in ("persons", "keywords", "references", "reference_speakers"):
                annotations[key] = value if isinstance(value, list) else []
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


@app.post("/api/annotation-corrections/{analysis_id}", response_model=dict)
async def update_annotation_corrections(
    analysis_id: str, payload: Dict[str, Any] = Body(...)
) -> dict:
    status = get_analysis_entry(analysis_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Analysis ID not found")

    corrections = status.setdefault("annotation_corrections", {})
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

    write_annotation_corrections_file(status)
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
