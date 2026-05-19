from __future__ import annotations

import csv
from copy import deepcopy
from datetime import datetime, timezone
import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


SCENE_CARD_SCHEMA = "vaa1.scene_card.v1"
SOURCE_EXTRACTION_METADATA_SUMMARY_SCHEMA = "vaa1.source_extraction_metadata_summary.v1"
SCENE_CARD_REPORT_TITLE = "Mise-en-Scene Scene Card Report"
SOURCE_EXTRACTION_METADATA_SUMMARY_TITLE = "Scene Card Source Extraction Metadata Summary"
NLP_SCENE_SUMMARY_VERSION = 8

LIKELIHOOD_SYMBOLS = {
    "manual": "✓",
    "observed": "●",
    "likely": "◐",
    "possible": "○",
}

DROP_CORRECTION_VALUE = "__drop__"

AUTHORITY_POLICY = {
    "manual_annotation_wins": True,
    "manual_correction_wins": True,
    "system_output_is_preserved": True,
    "scene_cards_do_not_mutate_source_metadata": True,
    "exact_transcript_remains_visible": True,
}

FACETS = [
    "persons",
    "places",
    "speech",
    "situations",
    "events",
    "themes",
    "props",
    "costume",
    "actions",
    "cinematic_cues",
    "genre_form",
    "subject_domain",
]

ACTION_KEYWORDS = {
    "speaking": {"say", "says", "said", "tell", "tells", "talk", "speak", "speaks"},
    "listening": {"listen", "listening", "hear", "hears"},
    "looking": {"look", "looks", "see", "sees", "watch", "watches"},
    "walking": {"walk", "walks", "walking"},
    "running": {"run", "runs", "running"},
    "entering": {"enter", "enters", "arrive", "arrives"},
    "leaving": {"leave", "leaves", "go", "goes"},
    "working": {"work", "works", "working", "finish", "deadline", "meeting", "file", "files"},
    "kissing": {"kiss", "kisses", "kissing"},
    "hugging": {"hug", "hugs", "hugging", "embrace", "embraces", "embracing"},
    "laughing": {"laugh", "laughs", "laughing"},
    "fighting": {"fight", "fights", "hit", "hits", "attack", "attacks"},
    "waiting": {"wait", "waits", "waiting"},
}

COSTUME_KEYWORDS = {
    "sports wear": {"sportswear", "jersey", "tracksuit", "football shirt", "sport shirt"},
    "evening dress": {"evening dress", "gown", "formal dress"},
    "uniform": {"uniform", "police", "military", "nurse", "doctor"},
    "formal wear": {"suit", "tie", "tuxedo", "formal"},
    "workwear": {"helmet", "hard hat", "apron", "overalls", "workwear"},
    "accessory": {"hat", "glasses", "watch", "bag"},
}

THEME_KEYWORDS = {
    "urgency": {"urgent", "deadline", "now", "quickly", "before tomorrow", "hurry"},
    "authority": {"must", "should", "order", "command", "tell", "told", "need to"},
    "uncertainty": {"maybe", "perhaps", "probably", "unsure", "unknown", "might"},
    "risk": {"risk", "danger", "threat", "unsafe", "warning"},
    "identity": {"name", "called", "identity", "who are you"},
    "care": {"help", "protect", "care", "sorry"},
    "existential reflection": {"exist", "exists", "co-exists", "coexists", "universe", "planet"},
    "place and belonging": {"planet", "universe", "spaces", "where", "place"},
}

SITUATION_KEYWORDS = {
    "work discussion": {"work", "deadline", "meeting", "files", "office"},
    "confrontation": {"must", "stop", "leave", "fight", "angry"},
    "explanation": {"because", "means", "explain", "why", "reason"},
    "interview": {"question", "answer", "interview", "ask", "asks"},
    "street interview": {"sir,", "ma'am", "madam", "what are you doing", "planet", "where are you"},
    "existential questioning": {"what are you doing", "exist", "exists", "co-exists", "universe", "planet"},
}

TRANSCRIPT_TOPIC_KEYWORDS = {
    "existence": {"exist", "exists", "co-exists", "coexists", "existence"},
    "universe": {"universe", "planet", "spaces"},
    "place": {"planet", "where", "spaces", "place"},
    "harm avoidance": {"without hurting", "hurt", "hurting", "harm"},
    "climate action": {"climate change", "climate", "warming", "emissions", "carbon dioxide"},
    "climate summit": {"cop30", "cop conferences", "climate summit", "un climate", "belem"},
    "government climate policy": {"ministeri", "kommentoi", "ilmastonmuutoksen", "hillinnassa", "talouden"},
    "espionage": {"bond", "007", "double-o", "secrets", "commander"},
    "betrayal and trust": {"betray", "secrets", "trust", "favor", "brother"},
    "threat": {"kill", "danger", "world is arming", "weapon", "dungeon"},
}

TRANSCRIPT_TOPIC_MODELS = [
    {
        "label": "street interview about existential belonging",
        "summary": "existence, universe, harm avoidance, and place",
        "situation": "street interview",
        "meaning": "questions of existence, universe, harm avoidance, and place",
        "phenomena": "street-interview speech about existence and belonging",
        "hints": {
            "what are you doing",
            "universe",
            "planet",
            "exist",
            "exists",
            "co-exists",
            "coexists",
            "without hurting",
            "spaces",
        },
    },
    {
        "label": "climate summit report",
        "summary": "climate change, COP summit politics, emissions, and global response",
        "situation": "news or documentary report about climate negotiations",
        "meaning": "climate responsibility, international coordination, and emissions reduction",
        "phenomena": "report speech about COP conferences, the Amazon setting, warming, and emissions",
        "hints": {
            "climate change",
            "cop30",
            "cop conferences",
            "climate summit",
            "un climate",
            "emissions",
            "carbon dioxide",
            "warming",
            "amazon",
            "belem",
            "countries come together",
        },
    },
    {
        "label": "government climate-policy comment",
        "summary": "ministerial comment, climate mitigation, and policy progress",
        "situation": "news comment about climate-policy action",
        "meaning": "official climate-policy framing and promised progress",
        "phenomena": "Finnish-language political speech about climate mitigation",
        "hints": {
            "ministeri",
            "kommentoi",
            "ilmastonmuutoksen",
            "hillinnassa",
            "olemme saamassa",
            "askeleita eteenpain",
            "talouden pelastamiseksi",
        },
    },
    {
        "label": "spy-thriller betrayal and secrets",
        "summary": "betrayal, secrets, trust, weapons, and James Bond identity",
        "situation": "trailer-style spy-thriller exchange",
        "meaning": "loyalty, secrecy, threat, and heroic identity",
        "phenomena": "dialogue and trailer narration around betrayal, secrets, weapons, and Bond",
        "hints": {
            "betray",
            "secrets",
            "trust",
            "bond",
            "007",
            "double-o",
            "commander bond",
            "world is arming",
            "dungeon",
            "brother",
        },
    },
    {
        "label": "Bond action-trailer threat",
        "summary": "Bond identity, waiting, confrontation, killing, and spectacle",
        "situation": "action-trailer scene built around arrival and threat",
        "meaning": "return, danger, identity, and action spectacle",
        "phenomena": "trailer dialogue about Bond, threats, Blofeld, and action spectacle",
        "hints": {
            "james bond",
            "he's back",
            "kill him",
            "blofeld",
            "spectacular",
            "great movies",
            "outrageous",
            "thrills",
            "waiting for him",
        },
    },
]

TRANSCRIPT_TOPIC_STOPWORDS = {
    "a",
    "about",
    "after",
    "all",
    "also",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "being",
    "but",
    "by",
    "can",
    "come",
    "do",
    "does",
    "doing",
    "for",
    "from",
    "get",
    "go",
    "have",
    "he",
    "her",
    "here",
    "him",
    "his",
    "how",
    "i",
    "in",
    "is",
    "it",
    "its",
    "like",
    "me",
    "my",
    "no",
    "not",
    "now",
    "of",
    "on",
    "one",
    "or",
    "our",
    "she",
    "sir",
    "so",
    "that",
    "the",
    "their",
    "this",
    "to",
    "up",
    "we",
    "what",
    "when",
    "where",
    "who",
    "why",
    "with",
    "would",
    "you",
    "your",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _clean_metadata_label(value: Any) -> str:
    text = _safe_text(value)
    if not text:
        return ""
    replacements = {
        "Finaland": "Finland",
        "jounalism": "journalism",
        "REsearcher": "Researcher",
        "interveiws": "interviews",
    }
    for raw, corrected in replacements.items():
        text = re.sub(rf"\b{re.escape(raw)}\b", corrected, text)
    return " ".join(text.split())


def _fold_text(value: Any) -> str:
    text = _clean_metadata_label(value).lower()
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def _dedupe_text(values: Iterable[Any]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for value in values:
        text = _clean_metadata_label(value)
        key = text.lower()
        if text and key not in seen:
            seen.add(key)
            result.append(text)
    return result


def _safe_float(value: Any, fallback: Optional[float] = None) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _seconds_to_ms(value: Any, fallback: int = 0) -> int:
    parsed = _safe_float(value)
    if parsed is None:
        return fallback
    if 0 < parsed < 10_000:
        return int(round(parsed * 1000))
    return int(round(parsed))


def _first_value(mapping: Dict[str, Any], keys: Iterable[str]) -> Any:
    for key in keys:
        if key in mapping and mapping.get(key) is not None:
            return mapping.get(key)
    return None


def _interval_ms(item: Dict[str, Any]) -> Tuple[int, int]:
    interval = item.get("time_interval") if isinstance(item.get("time_interval"), dict) else {}
    if interval:
        merged = dict(item)
        for source_key, target_key in (
            ("start_ms", "start_ms"),
            ("end_ms", "end_ms"),
            ("start", "start"),
            ("end", "end"),
            ("start_seconds", "start_seconds"),
            ("end_seconds", "end_seconds"),
        ):
            if merged.get(target_key) is None and interval.get(source_key) is not None:
                merged[target_key] = interval.get(source_key)
        item = merged
    start = _first_value(
        item,
        (
            "start_ms",
            "start",
            "start_time",
            "start_seconds",
            "time_start",
            "timestamp_seconds",
            "timestamp",
            "time",
            "startTimestamp",
        ),
    )
    end = _first_value(
        item,
        (
            "end_ms",
            "end",
            "end_time",
            "end_seconds",
            "time_end",
            "endTimestamp",
        ),
    )
    start_ms = _seconds_to_ms(start, 0)
    end_ms = _seconds_to_ms(end, start_ms)
    return min(start_ms, end_ms), max(start_ms, end_ms)


def _overlaps(item: Dict[str, Any], start_ms: int, end_ms: int) -> bool:
    item_start, item_end = _interval_ms(item)
    if item_start == item_end:
        return start_ms <= item_start <= end_ms
    return item_end >= start_ms and item_start <= end_ms


def _scene_id(analysis_id: str, index: int, scene: Dict[str, Any]) -> str:
    raw_id = scene.get("scene_id") or scene.get("id")
    return str(raw_id) if raw_id else f"{analysis_id}:scene:{index:03d}"


def _extract_status_list(status: Dict[str, Any], paths: Iterable[Tuple[str, ...]]) -> List[Dict[str, Any]]:
    for path in paths:
        current: Any = status
        for key in path:
            if isinstance(current, dict):
                current = current.get(key)
            else:
                current = None
                break
        if isinstance(current, list):
            return [item for item in current if isinstance(item, dict)]
    return []


def _output_file(status: Dict[str, Any], file_type: str) -> Optional[Path]:
    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    raw_path = output_files.get(file_type)
    if not raw_path:
        return None
    path = Path(str(raw_path))
    return path if path.exists() else None


def _read_json_artifact(path: Optional[Path]) -> Any:
    if not path:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _read_csv_artifact(path: Optional[Path]) -> List[Dict[str, Any]]:
    if not path:
        return []
    try:
        with path.open("r", encoding="utf-8", newline="") as handle:
            return [dict(row) for row in csv.DictReader(handle)]
    except Exception:
        return []


def _list_from_json_payload(payload: Any, keys: Iterable[str]) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _normalize_transcript_segment(item: Dict[str, Any], index: int) -> Dict[str, Any]:
    normalized = dict(item)
    if "id" not in normalized:
        normalized["id"] = f"transcript:{index:04d}"
    return normalized


def _normalize_csv_object(row: Dict[str, Any], index: int) -> Dict[str, Any]:
    normalized = dict(row)
    for source_key, target_key in (
        ("bbox_x1", "bbox_x1"),
        ("bbox_y1", "bbox_y1"),
        ("bbox_x2", "bbox_x2"),
        ("bbox_y2", "bbox_y2"),
        ("start_timestamp", "start"),
        ("end_timestamp", "end"),
        ("timestamp", "timestamp"),
    ):
        value = _safe_float(row.get(source_key))
        if value is not None:
            normalized[target_key] = value
    if "track_id" not in normalized:
        normalized["track_id"] = row.get("trackId") or f"object:{index:04d}"
    return normalized


def _extract_source_metadata(status: Dict[str, Any]) -> Dict[str, Any]:
    merged: Dict[str, Any] = {}
    for key in ("metadata", "archive_metadata", "source_metadata", "source_media_metadata"):
        value = status.get(key)
        if isinstance(value, dict):
            merged.update(deepcopy(value))
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    for key in ("metadata", "archive_metadata", "source_metadata", "source_media_metadata"):
        value = results.get(key)
        if isinstance(value, dict):
            merged.update(deepcopy(value))
    artifact = _read_json_artifact(_output_file(status, "source_media_metadata_json"))
    if isinstance(artifact, dict):
        merged.update(deepcopy(artifact))
    return merged


def _extract_scenes(
    status: Dict[str, Any],
    analysis_id: str,
    transcript_override: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    transcript = transcript_override if transcript_override is not None else _extract_transcript(status)
    master_schema = status.get("vaa1_annotation_master_schema")
    if isinstance(master_schema, dict):
        master_scenes: List[Dict[str, Any]] = []
        for index, segment in enumerate(master_schema.get("temporal_segments") or []):
            if not isinstance(segment, dict):
                continue
            family = _safe_text(segment.get("event_family") or segment.get("segment_family")).lower()
            segment_type = _safe_text(segment.get("segment_type") or segment.get("type")).lower()
            if "scene" not in family and segment_type != "scene" and not segment.get("scene_id"):
                continue
            normalized = dict(segment)
            normalized.setdefault("scene_index", index + 1)
            normalized.setdefault("scene_boundary_source", "master_schema_temporal_segments")
            normalized.setdefault("scene_id", f"{analysis_id}:scene:{index + 1:03d}")
            master_scenes.append(normalized)
        if master_scenes:
            return master_scenes

    scenes = _extract_status_list(
        status,
        (
            ("scenes",),
            ("results", "scenes"),
            ("results", "scene_analysis", "scenes"),
            ("results", "visual_analysis", "scenes"),
            ("results", "scene_segments", "segments"),
            ("results", "visual_analysis", "scene_segments", "segments"),
            ("summary", "scene_segments", "segments"),
        ),
    )
    if scenes:
        if len(scenes) == 1:
            start_ms, end_ms = _interval_ms(scenes[0])
            transcript_windows = _transcript_window_scenes(
                analysis_id,
                transcript,
                fallback_start_ms=start_ms,
                fallback_end_ms=end_ms,
            )
            if len(transcript_windows) > 1:
                return transcript_windows
        return scenes

    transcript_windows = _transcript_window_scenes(analysis_id, transcript)
    if transcript_windows:
        if len(transcript_windows) > 1:
            return transcript_windows
        first = transcript_windows[0]
        return [
            {
                "scene_id": f"{analysis_id}:scene:001",
                "start_ms": first["start_ms"],
                "end_ms": first["end_ms"],
                "scene_boundary_source": "fallback_transcript_extent",
            }
        ]

    return [
        {
            "scene_id": f"{analysis_id}:scene:001",
            "start_ms": 0,
            "end_ms": _seconds_to_ms(status.get("duration") or status.get("duration_seconds"), 0),
            "scene_boundary_source": "fallback_whole_media",
        }
    ]


def _transcript_window_scenes(
    analysis_id: str,
    transcript: List[Dict[str, Any]],
    *,
    fallback_start_ms: Optional[int] = None,
    fallback_end_ms: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if not transcript:
        return []

    intervals = [_interval_ms(item) for item in transcript]
    starts = [start for start, _end in intervals]
    ends = [end for _start, end in intervals]
    first_start = min(starts) if fallback_start_ms is None else min(fallback_start_ms, min(starts))
    last_end = max(ends) if fallback_end_ms is None else max(fallback_end_ms, max(ends))
    transcript_span = max(0, max(ends) - min(starts))
    scene_span = max(0, last_end - first_start)
    if len(transcript) < 6 or max(transcript_span, scene_span) <= 45_000:
        return [
            {
                "scene_id": f"{analysis_id}:scene:001",
                "start_ms": first_start,
                "end_ms": last_end,
                "scene_boundary_source": "fallback_transcript_extent",
            }
        ]

    windows: List[Dict[str, Any]] = []
    window_start = first_start
    window_end = max(first_start, first_start + 45_000)
    previous_end = first_start
    for start, end in sorted(intervals):
        gap_ms = max(0, start - previous_end)
        should_split = (
            start >= window_start + 45_000
            or (gap_ms >= 7_000 and start >= window_start + 25_000)
        )
        if should_split and window_end > window_start:
            index = len(windows) + 1
            windows.append(
                {
                    "scene_id": f"{analysis_id}:scene:{index:03d}",
                    "start_ms": window_start,
                    "end_ms": window_end,
                    "scene_boundary_source": "fallback_transcript_window",
                }
            )
            window_start = start
            window_end = max(end, start)
        else:
            window_end = max(window_end, end)
        previous_end = max(previous_end, end)

    index = len(windows) + 1
    windows.append(
        {
            "scene_id": f"{analysis_id}:scene:{index:03d}",
            "start_ms": window_start,
            "end_ms": window_end,
            "scene_boundary_source": "fallback_transcript_window",
        }
    )
    return windows


def _extract_transcript(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    transcript = _extract_status_list(
        status,
        (
            ("transcript", "segments"),
            ("results", "transcript", "segments"),
            ("results", "transcription", "segments"),
            ("results", "audio_analysis", "transcript", "segments"),
            ("results", "audio_analysis", "segments"),
        ),
    )
    if transcript:
        return transcript

    transcript_payload = _read_json_artifact(_output_file(status, "transcript"))
    transcript = _list_from_json_payload(transcript_payload, ("segments", "timeline_segments", "items"))
    if transcript:
        return [_normalize_transcript_segment(item, index) for index, item in enumerate(transcript)]

    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    raw = results.get("transcript") or status.get("transcript")
    if isinstance(raw, str) and raw.strip():
        return [{"id": "transcript:0", "start_ms": 0, "end_ms": 0, "text": raw.strip()}]
    return []


def _extract_objects(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    objects = _extract_status_list(
        status,
        (
            ("results", "visual_analysis", "tracked_objects"),
            ("results", "visual_analysis", "objects"),
            ("results", "visual_analysis", "yolo_results"),
            ("visual_analysis", "tracked_objects"),
            ("objects",),
        ),
    )
    if objects:
        return objects

    json_payload = _read_json_artifact(_output_file(status, "tracked_objects_json"))
    objects = _list_from_json_payload(json_payload, ("objects", "tracked_objects", "items"))
    if objects:
        return objects

    rows = _read_csv_artifact(_output_file(status, "tracked_objects_csv"))
    if not rows:
        rows = _read_csv_artifact(_output_file(status, "yolo_csv"))
    return [_normalize_csv_object(row, index) for index, row in enumerate(rows)]


def _extract_ocr(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    ocr = _extract_status_list(
        status,
        (
            ("results", "visual_analysis", "ocr_results"),
            ("results", "ocr_results"),
            ("ocr_results",),
        ),
    )
    if ocr:
        return ocr
    return _read_csv_artifact(_output_file(status, "ocr_csv"))


def _extract_expressions(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    expressions = _extract_status_list(
        status,
        (
            ("results", "visual_analysis", "expression_results"),
            ("results", "expressions"),
            ("expression_results",),
        ),
    )
    if expressions:
        return expressions
    payload = _read_json_artifact(_output_file(status, "expression_json"))
    return _list_from_json_payload(payload, ("expression_results", "expressions", "items", "frames"))


def _extract_audio_prosody(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    prosody = _extract_status_list(
        status,
        (
            ("results", "audio_prosody", "cues"),
            ("results", "audio_prosody", "events"),
            ("results", "audio_analysis", "audio_prosody", "cues"),
            ("results", "audio_analysis", "audio_prosody", "events"),
            ("results", "audio_analysis", "prosody_events"),
            ("audio_prosody", "cues"),
            ("audio_prosody", "events"),
        ),
    )
    if prosody:
        return prosody
    payload = _read_json_artifact(_output_file(status, "audio_prosody"))
    return _list_from_json_payload(payload, ("cues", "events", "items"))


PLOT_MEANING_FAMILIES = {"Scene", "Episode", "Situation", "Action", "ReportClaim"}


def _extract_second_order_instructions(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    payload = status.get("second_order_label_proliferation") or results.get("second_order_label_proliferation")
    if isinstance(payload, dict) and isinstance(payload.get("instructions"), list):
        return [item for item in payload.get("instructions") or [] if isinstance(item, dict)]
    artifact = _read_json_artifact(_output_file(status, "second_order_label_proliferation"))
    return _list_from_json_payload(artifact, ("instructions", "items"))


def _extract_meaning_events(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    artifact = _read_json_artifact(_output_file(status, "multimodal_meaning_stage1"))
    return _list_from_json_payload(artifact, ("feature_events", "events", "items"))


def _extract_sfl_utterances(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    payload = status.get("dependency_sfl_stage1") or results.get("dependency_sfl_stage1")
    if isinstance(payload, dict):
        utterances = _list_from_json_payload(payload, ("utterances", "items", "segments"))
        if utterances:
            return utterances
    artifact = _read_json_artifact(_output_file(status, "dependency_sfl_stage1"))
    return _list_from_json_payload(artifact, ("utterances", "items", "segments"))


def _extract_pos_analysis(status: Dict[str, Any]) -> Dict[str, Any]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    for payload in (
        status.get("pos_analysis"),
        results.get("pos_analysis"),
        results.get("pos"),
    ):
        if isinstance(payload, dict):
            return payload
    artifact = _read_json_artifact(_output_file(status, "pos_analysis"))
    return artifact if isinstance(artifact, dict) else {}


def _seconds_value(value: Any, fallback: float = 0.0) -> float:
    parsed = _safe_float(value)
    if parsed is None:
        return fallback
    if parsed > 10_000:
        return parsed / 1000.0
    return parsed


def _instruction_interval_ms(item: Dict[str, Any]) -> Tuple[int, int]:
    span = item.get("time_span") if isinstance(item.get("time_span"), dict) else {}
    start = span.get("start_ms") if span.get("start_ms") is not None else span.get("start")
    end = span.get("end_ms") if span.get("end_ms") is not None else span.get("end")
    if start is None or end is None:
        traceback = item.get("traceback") if isinstance(item.get("traceback"), dict) else {}
        primary = traceback.get("primary_time_span") if isinstance(traceback.get("primary_time_span"), dict) else {}
        start = primary.get("start_ms") if start is None else start
        end = primary.get("end_ms") if end is None else end
    start_ms = _seconds_to_ms(start, 0)
    end_ms = _seconds_to_ms(end, start_ms)
    return min(start_ms, end_ms), max(start_ms, end_ms)


def _meaning_instruction_label(item: Dict[str, Any]) -> str:
    family = _safe_text(item.get("target_label_family"))
    label = _safe_text(item.get("candidate_label"))
    if family and label:
        return f"{family}: {label.replace('_', ' ')}"
    return label or family or "meaning candidate"


def _meaning_event_label(item: Dict[str, Any]) -> str:
    payload = item.get("feature_payload") if isinstance(item.get("feature_payload"), dict) else {}
    plot_function = _safe_text(payload.get("plot_function"))
    feature_type = _safe_text(item.get("feature_type"))
    if plot_function:
        return f"Plot function: {plot_function.replace('_', ' ')}"
    return feature_type.replace("_", " ") if feature_type else "meaning event"


def _meaning_lens_terms(item: Dict[str, Any]) -> List[str]:
    payload = item.get("source_feature_payload") or item.get("feature_payload")
    payload = payload if isinstance(payload, dict) else {}
    lenses = payload.get("alternative_plot_lenses") if isinstance(payload.get("alternative_plot_lenses"), dict) else {}
    terms: List[str] = []
    for lens in ("freytag", "aristotle", "campbell", "frye", "booker"):
        value = lenses.get(lens)
        if isinstance(value, list):
            for term in value[:3]:
                clean = _safe_text(term).replace("_", " ")
                if clean and clean not in terms:
                    terms.append(clean)
    return terms[:8]


def _scene_meaning_plot(
    *,
    analysis_id: str,
    source_video_id: str,
    scene_id: str,
    scene_start_ms: int,
    scene_end_ms: int,
    instructions: List[Dict[str, Any]],
    meaning_events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    plot_instructions: List[Dict[str, Any]] = []
    for index, instruction in enumerate(instructions):
        family = _safe_text(instruction.get("target_label_family"))
        if family not in PLOT_MEANING_FAMILIES:
            continue
        start_ms, end_ms = _instruction_interval_ms(instruction)
        if end_ms < scene_start_ms or start_ms > scene_end_ms:
            continue
        label = _meaning_instruction_label(instruction)
        plot_instructions.append(
            {
                "instruction_id": instruction.get("instruction_id") or f"{scene_id}:meaning_instruction:{index:03d}",
                "label": label,
                "target_label_family": family,
                "candidate_label": instruction.get("candidate_label"),
                "status": instruction.get("status"),
                "confidence": round(_safe_float((instruction.get("open_scores") or {}).get("weighted_support_score"), 0.0) or 0.0, 3),
                "time_interval": {"start_ms": start_ms, "end_ms": end_ms},
                "lens_terms": _meaning_lens_terms(instruction),
                "evidence_refs": instruction.get("source_evidence_refs") or [],
                "navigation": _navigation(
                    analysis_id=analysis_id,
                    source_video_id=source_video_id,
                    time_ms=start_ms,
                    panel="MeaningPlotPanel",
                    evidence_refs=[_safe_text(instruction.get("instruction_id"), label)],
                ),
            }
        )

    event_summaries: List[Dict[str, Any]] = []
    for index, event in enumerate(meaning_events):
        start_ms, end_ms = _instruction_interval_ms(event)
        if end_ms < scene_start_ms or start_ms > scene_end_ms:
            continue
        label = _meaning_event_label(event)
        event_summaries.append(
            {
                "event_id": event.get("event_id") or f"{scene_id}:meaning_event:{index:03d}",
                "label": label,
                "feature_type": event.get("feature_type"),
                "epistemic_status": event.get("epistemic_status"),
                "time_interval": {"start_ms": start_ms, "end_ms": end_ms},
                "lens_terms": _meaning_lens_terms(event),
                "navigation": _navigation(
                    analysis_id=analysis_id,
                    source_video_id=source_video_id,
                    time_ms=start_ms,
                    panel="MeaningPlotPanel",
                    evidence_refs=[_safe_text(event.get("event_id"), label)],
                ),
            }
        )

    leading = plot_instructions[:5]
    labels = [item["label"] for item in leading]
    summary = "No plot / meaning candidates surfaced for this scene yet."
    if labels:
        summary = "Meaning / plot candidates: " + "; ".join(labels[:3]) + "."
    elif event_summaries:
        summary = "Meaning events: " + "; ".join(item["label"] for item in event_summaries[:3]) + "."

    return {
        "scene_id": scene_id,
        "summary": summary,
        "instructions": plot_instructions[:12],
        "meaning_events": event_summaries[:12],
        "authority": "mature_interpretive_candidate",
        "source": "multimodal_meaning_and_second_order_proliferation",
    }


def _evidence_id(prefix: str, scene_index: int, index: int, item: Dict[str, Any]) -> str:
    raw = item.get("id") or item.get("evidence_id") or item.get("track_id") or item.get("trackId")
    return str(raw) if raw not in (None, "") else f"scene:{scene_index:03d}:{prefix}:{index:03d}"


def _navigation(
    *,
    analysis_id: str,
    source_video_id: str,
    time_ms: int,
    panel: str,
    evidence_refs: List[str],
) -> Dict[str, Any]:
    return {
        "analysis_id": analysis_id,
        "video_id": source_video_id,
        "time_seconds": round(time_ms / 1000.0, 3),
        "panel": panel,
        "evidence_refs": evidence_refs,
    }


def _new_item(
    *,
    scene_id: str,
    category: str,
    label: str,
    likelihood: str,
    evidence_refs: List[str],
    navigation: Dict[str, Any],
    source: str,
    path: Optional[List[str]] = None,
) -> Dict[str, Any]:
    clean_label = _safe_text(label)
    item_id_label = re.sub(r"[^a-z0-9]+", "-", clean_label.lower()).strip("-") or "item"
    item = {
        "item_id": f"{scene_id}:{category}:{item_id_label}",
        "category": category,
        "label": clean_label,
        "likelihood": likelihood,
        "symbol": LIKELIHOOD_SYMBOLS.get(likelihood, LIKELIHOOD_SYMBOLS["possible"]),
        "evidence_refs": evidence_refs,
        "navigation": navigation,
        "status": "system",
        "source": source,
    }
    if path:
        item["path"] = path
    return item


def _add_item(items: List[Dict[str, Any]], item: Dict[str, Any]) -> None:
    identity = (item.get("category"), str(item.get("label", "")).lower())
    for existing in items:
        if (existing.get("category"), str(existing.get("label", "")).lower()) == identity:
            existing_refs = set(existing.get("evidence_refs") or [])
            existing_refs.update(item.get("evidence_refs") or [])
            existing["evidence_refs"] = sorted(existing_refs)
            return
    items.append(item)


def _token_set(text: str) -> set[str]:
    return {token for token in re.split(r"[^a-z0-9]+", text.lower()) if token}


def _contains_any(text: str, hints: Iterable[str]) -> bool:
    lowered = text.lower()
    tokens = _token_set(lowered)
    for hint in hints:
        hint_lower = hint.lower()
        if " " in hint_lower and hint_lower in lowered:
            return True
        if hint_lower in tokens:
            return True
    return False


def _correction_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_correction_value(value: Any) -> str:
    return re.sub(r"\s+", " ", _correction_text(value).lower()).strip()


def _correction_context_matches(rule: Dict[str, Any], item: Dict[str, Any]) -> bool:
    track = rule.get("target_track_id")
    item_track = item.get("track_id") or item.get("trackId")
    if track not in (None, "") and item_track not in (None, "") and str(track) != str(item_track):
        return False

    item_start_ms, item_end_ms = _interval_ms(item)
    if rule.get("target_start_timestamp") is not None or rule.get("target_end_timestamp") is not None:
        rule_start = _seconds_to_ms(rule.get("target_start_timestamp"), item_start_ms)
        rule_end = _seconds_to_ms(rule.get("target_end_timestamp"), rule_start)
        return item_end_ms >= min(rule_start, rule_end) - 150 and item_start_ms <= max(rule_start, rule_end) + 150

    if rule.get("target_timestamp") is not None:
        rule_time = _seconds_to_ms(rule.get("target_timestamp"), item_start_ms)
        return item_start_ms - 150 <= rule_time <= item_end_ms + 150

    return True


def _apply_text_substitutions(text: Any, rules: Iterable[Dict[str, Any]]) -> str:
    result = _correction_text(text)
    for rule in rules:
        raw = _correction_text(rule.get("raw_value"))
        corrected = _correction_text(rule.get("corrected_value"))
        if raw:
            result = re.sub(re.escape(raw), corrected, result, flags=re.IGNORECASE)
    return result


def _apply_label_override(
    label: Any,
    modality: str,
    rules: Iterable[Dict[str, Any]],
    item: Dict[str, Any],
) -> Optional[str]:
    normalized = _normalize_correction_value(label)
    result = _correction_text(label)
    for rule in rules:
        if _correction_text(rule.get("modality")).lower() != modality:
            continue
        if _normalize_correction_value(rule.get("raw_value")) != normalized:
            continue
        if not _correction_context_matches(rule, item):
            continue
        corrected = _correction_text(rule.get("corrected_value"))
        if corrected == DROP_CORRECTION_VALUE:
            return None
        result = corrected or result
    return result


def _corrections_payload(status: Dict[str, Any]) -> Dict[str, Any]:
    corrections = status.get("annotation_corrections")
    return corrections if isinstance(corrections, dict) else {}


def _apply_transcript_corrections(
    transcript: List[Dict[str, Any]],
    corrections: Dict[str, Any],
) -> List[Dict[str, Any]]:
    text_rules = [rule for rule in corrections.get("text_substitutions", []) or [] if isinstance(rule, dict)]
    corrected = []
    for item in transcript:
        next_item = dict(item)
        next_item["raw_text"] = next_item.get("raw_text") or next_item.get("text")
        next_item["text"] = _apply_text_substitutions(next_item.get("text"), text_rules)
        next_item.setdefault("correction_source", "transcript")
        corrected.append(next_item)

    for index, entry in enumerate(corrections.get("manual_transcript_entries", []) or []):
        if not isinstance(entry, dict):
            continue
        text = _apply_text_substitutions(entry.get("text") or "Unconfirmed", text_rules)
        corrected.append(
            {
                "id": entry.get("id") or f"manual_transcript:{index:04d}",
                "speaker": "Analyst note",
                "start": entry.get("start", 0),
                "end": entry.get("end", entry.get("start", 0)),
                "text": text,
                "status": entry.get("status") or ("confirmed" if text else "unconfirmed"),
                "correction_source": "manual",
            }
        )
    return sorted(corrected, key=lambda item: _interval_ms(item))


def _apply_detection_label_corrections(
    items: List[Dict[str, Any]],
    corrections: Dict[str, Any],
    *,
    modality: str,
    label_keys: Tuple[str, ...],
) -> List[Dict[str, Any]]:
    text_rules = [rule for rule in corrections.get("text_substitutions", []) or [] if isinstance(rule, dict)]
    label_rules = [rule for rule in corrections.get("label_overrides", []) or [] if isinstance(rule, dict)]
    corrected: List[Dict[str, Any]] = []
    for item in items:
        next_item = dict(item)
        raw_label = _compact_expression_label(next_item) if modality == "expression" else _first_value(next_item, label_keys)
        replacement = _apply_label_override(raw_label, modality, label_rules, next_item)
        if replacement is None:
            continue
        replacement = _apply_text_substitutions(replacement, text_rules)
        next_item["raw_label"] = raw_label
        primary_key = label_keys[0]
        next_item[primary_key] = replacement
        if modality == "object":
            next_item["displayLabel"] = replacement
        if modality == "ocr":
            next_item["text"] = replacement
        if modality == "expression":
            next_item["dominant_emotion"] = replacement
        next_item.setdefault("correction_source", "corrected")
        corrected.append(next_item)
    return corrected


def _manual_visual_annotations_for_scene(
    corrections: Dict[str, Any],
    start_ms: int,
    end_ms: int,
) -> List[Dict[str, Any]]:
    annotations = corrections.get("manual_visual_annotations") or []
    return [
        item
        for item in annotations
        if isinstance(item, dict) and _overlaps(item, start_ms, end_ms)
    ]


def _manual_scene_account_override(scene_manual: List[Dict[str, Any]]) -> str:
    for item in reversed(scene_manual):
        correlation = (
            item.get("metadata_correlation")
            if isinstance(item.get("metadata_correlation"), dict)
            else {}
        )
        target_type = _safe_text(correlation.get("target_type")).lower()
        subcategory = _safe_text(item.get("subcategory")).lower()
        if target_type in {"scene_card_account", "scene_account"} or "scene account" in subcategory:
            note = _clean_metadata_label(item.get("open_note"))
            if note:
                return note
    return ""


def _compact_expression_label(item: Dict[str, Any]) -> str:
    raw_label = (
        item.get("dominant_emotion")
        or item.get("dominant_expression")
        or item.get("expression")
        or item.get("label")
        or item.get("emotion")
    )
    if isinstance(raw_label, dict):
        numeric_scores = {
            str(key): _safe_float(value, 0.0) or 0.0
            for key, value in raw_label.items()
        }
        if numeric_scores:
            return max(numeric_scores.items(), key=lambda pair: pair[1])[0]
        return ""
    return _safe_text(raw_label)


def _speech_labels(transcript: List[Dict[str, Any]]) -> List[str]:
    if not transcript:
        return ["no speech"]
    speakers = {_safe_text(item.get("speaker") or item.get("speaker_id")) for item in transcript}
    speakers.discard("")
    labels = ["dialogue"] if len(speakers) > 1 else ["monologue"]
    joined = " ".join(_safe_text(item.get("text")) for item in transcript)
    if "?" in joined:
        labels.append("question")
    if _contains_any(joined, {"must", "should", "need to", "go", "stop", "listen"}):
        labels.append("instruction")
    if _contains_any(joined, {"because", "means", "explain", "why"}):
        labels.append("explanation")
    return labels


def _genre_labels(source_metadata: Dict[str, Any], transcript: List[Dict[str, Any]]) -> List[Tuple[str, List[str]]]:
    labels: List[Tuple[str, List[str]]] = []
    genre = _safe_text(source_metadata.get("genre") or source_metadata.get("genre_form"))
    if genre:
        labels.append((genre, [genre]))
    joined = " ".join(_safe_text(item.get("text")) for item in transcript)
    if "?" in joined and len({_safe_text(item.get("speaker")) for item in transcript if item.get("speaker")}) > 1:
        labels.append(("interview segment", ["nonfiction", "interview segment"]))
    return labels


def _overview(
    *,
    transcript: List[Dict[str, Any]],
    person_count: int,
    prop_labels: List[str],
    place_labels: List[str],
    situation_labels: List[str],
) -> str:
    parts: List[str] = []
    if person_count:
        people = "one visible person" if person_count == 1 else "people visible in the frame"
        parts.append(people)
    if transcript:
        parts.append("linked transcript speech")
    if prop_labels:
        unique_props = list(dict.fromkeys(prop_labels))
        parts.append("object cues: " + ", ".join(unique_props[:3]))
    if place_labels:
        unique_places = list(dict.fromkeys(place_labels))
        parts.append("place cues: " + ", ".join(unique_places[:2]))
    if situation_labels:
        unique_situations = list(dict.fromkeys(situation_labels))
        parts.append("situation cues: " + ", ".join(unique_situations[:2]))
    if not parts:
        return "This scene has limited extracted evidence so far."
    return "Scene evidence: " + "; ".join(parts) + "."


def _unique_item_labels(
    items: List[Dict[str, Any]],
    categories: Iterable[str],
    *,
    limit: int = 3,
) -> List[str]:
    allowed = set(categories)
    labels: List[str] = []
    for item in items:
        if item.get("category") not in allowed:
            continue
        label = _safe_text(item.get("label")).replace(" expression cue", "")
        if label and label not in labels:
            labels.append(label)
        if len(labels) >= limit:
            break
    return labels


def _join_phrase(values: List[str]) -> str:
    clean = _dedupe_text(value for value in values if _safe_text(value))
    if not clean:
        return ""
    if len(clean) == 1:
        return clean[0]
    if len(clean) == 2:
        return f"{clean[0]} and {clean[1]}"
    return ", ".join(clean[:-1]) + f", and {clean[-1]}"


def _speech_activity_clause(transcript: List[Dict[str, Any]]) -> str:
    if not transcript:
        return ""
    speakers = {_safe_text(item.get("speaker") or item.get("speaker_id")) for item in transcript}
    speakers.discard("")
    joined = " ".join(_safe_text(item.get("text")) for item in transcript)
    lowered = joined.lower()
    if "what are you doing" in lowered and any(term in lowered for term in ("planet", "universe")):
        return "a street-style interviewer asks people what they are doing in the world"
    if "?" in joined and len(speakers) > 1:
        return "speakers exchange questions"
    if "?" in joined:
        return "a speaker asks a question"
    if len(speakers) > 1:
        return "speakers discuss the situation"
    return "a speaker addresses the scene"


GENERIC_PERSON_LABEL_PATTERNS = (
    "person",
    "speaker_unknown",
    "speaker unknown",
    "unknown",
    "door",
    "microphone",
    "tv",
    "screen",
)

ROLE_LABEL_PATTERNS = (
    "anchor",
    "editor",
    "interviewer",
    "interviewed",
    "minister",
    "presenter",
    "reporter",
    "respondent",
)


def _is_mature_identity_label(value: str) -> bool:
    label = _safe_text(value)
    lowered = label.lower()
    if not label:
        return False
    if any(lowered == pattern for pattern in GENERIC_PERSON_LABEL_PATTERNS):
        return False
    if re.fullmatch(r"person(?:\s+track)?\s+\d+", lowered):
        return False
    if re.fullmatch(r"person\s+untracked\s+\d+", lowered):
        return False
    return True


def _is_role_label(value: str) -> bool:
    lowered = _safe_text(value).lower()
    if any(separator in lowered for separator in (" - ", " — ", "/", ";")):
        return False
    return any(
        lowered == term
        or lowered.startswith(f"{term} ")
        or lowered.endswith(f" {term}")
        for term in ROLE_LABEL_PATTERNS
    )


def _identity_context_from_items(items: List[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
    identities: List[str] = []
    roles: List[str] = []
    for item in items:
        category = _safe_text(item.get("category"))
        label = _safe_text(item.get("label"))
        manual_category = _safe_text(item.get("manual_category"))
        status = _safe_text(item.get("status"))
        if _is_role_label(label):
            if label and label not in roles:
                roles.append(label)
            continue
        if category == "persons" and _is_mature_identity_label(label):
            if label not in identities:
                identities.append(label)
        if manual_category in {"Role", "Genre", "Identification"} and _is_mature_identity_label(label):
            target = roles if _is_role_label(label) else identities
            if label not in target:
                target.append(label)
        if status == "manual" and category == "persons" and _is_mature_identity_label(label):
            if label not in identities:
                identities.append(label)
    return identities[:4], roles[:4]


def _speaking_description(
    transcript: List[Dict[str, Any]],
    discourse_form: str = "",
    identity_labels: Optional[List[str]] = None,
    role_labels: Optional[List[str]] = None,
) -> str:
    identity_labels = identity_labels or []
    role_labels = role_labels or []
    if role_labels and identity_labels:
        return (
            f"{_join_phrase(role_labels[:2])} appears in the scene; "
            f"identified person evidence includes {_join_phrase(identity_labels[:3])}."
        )
    if role_labels:
        return f"{_join_phrase(role_labels[:3])} appears to be the speaking role in this scene."
    if identity_labels:
        return f"Identified person evidence includes {_join_phrase(identity_labels[:3])}."
    if not transcript:
        return "No linked speech is available for this scene."
    if discourse_form == "street interview":
        return (
            "An unidentified interviewer conducts street interviews; "
            "the visible speech turns include respondent answers."
        )
    speakers = []
    for item in transcript:
        speaker = _safe_text(item.get("speaker") or item.get("speaker_id"), "SPEAKER_UNKNOWN")
        if speaker not in speakers:
            speakers.append(speaker)
    if len(speakers) == 1:
        if speakers[0] in {"SPEAKER_UNKNOWN", "Speaker 1", "speaker 1"}:
            return "An unidentified speaker is speaking."
        return f"{speakers[0]} is speaking."
    return f"{_join_phrase(speakers[:4])} are speaking."


def _transcript_topic_labels(transcript: List[Dict[str, Any]]) -> List[str]:
    joined = " ".join(_safe_text(item.get("text")) for item in transcript).lower()
    labels: List[str] = []
    for label, hints in TRANSCRIPT_TOPIC_KEYWORDS.items():
        if any(hint in joined for hint in hints):
            labels.append(label)
    return labels


def _transcript_topic_model_matches(transcript: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    joined = " ".join(_safe_text(item.get("text")) for item in transcript).lower()
    if not joined:
        return []
    matches: List[Dict[str, Any]] = []
    for model in TRANSCRIPT_TOPIC_MODELS:
        cues = []
        score = 0
        for hint in model["hints"]:
            if hint in joined:
                cues.append(hint)
                score += 2 if " " in hint else 1
        if score >= 2:
            matches.append(
                {
                    "label": model["label"],
                    "summary": model["summary"],
                    "situation": model["situation"],
                    "meaning": model["meaning"],
                    "phenomena": model["phenomena"],
                    "score": score,
                    "matched_cues": cues[:8],
                }
            )
    matches.sort(key=lambda item: (-int(item["score"]), str(item["label"])))
    return matches


def _fallback_transcript_terms(transcript: List[Dict[str, Any]], limit: int = 4) -> List[str]:
    joined = " ".join(_safe_text(item.get("text")) for item in transcript).lower()
    words = re.findall(r"[a-zA-Z][a-zA-Z'-]{2,}", joined)
    counts: Dict[str, int] = {}
    for word in words:
        normalized = word.strip("'").lower()
        if normalized in TRANSCRIPT_TOPIC_STOPWORDS:
            continue
        if normalized.endswith("'s"):
            normalized = normalized[:-2]
        if len(normalized) < 4:
            continue
        counts[normalized] = counts.get(normalized, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [word for word, _count in ranked[:limit]]


def _transcript_topic_summary(transcript: List[Dict[str, Any]]) -> Dict[str, Any]:
    model_matches = _transcript_topic_model_matches(transcript)
    keyword_labels = _transcript_topic_labels(transcript)
    fallback_terms = _fallback_transcript_terms(transcript)
    if model_matches:
        primary = model_matches[0]
        labels = [str(item["label"]) for item in model_matches[:3]]
        return {
            "summary": primary["summary"],
            "primary_label": primary["label"],
            "labels": labels,
            "situation": primary["situation"],
            "meaning": primary["meaning"],
            "phenomena": primary["phenomena"],
            "model_matches": model_matches[:3],
            "keyword_labels": keyword_labels,
            "fallback_terms": fallback_terms,
        }
    if keyword_labels:
        summary = _join_phrase(keyword_labels[:4])
        return {
            "summary": summary,
            "primary_label": keyword_labels[0],
            "labels": keyword_labels[:4],
            "situation": f"speech-led material about {summary}",
            "meaning": f"questions and claims around {summary}",
            "phenomena": f"speech evidence around {summary}",
            "model_matches": [],
            "keyword_labels": keyword_labels,
            "fallback_terms": fallback_terms,
        }
    if fallback_terms:
        summary = _join_phrase(fallback_terms[:4])
        return {
            "summary": summary,
            "primary_label": fallback_terms[0],
            "labels": fallback_terms[:4],
            "situation": f"speech-led material about {summary}",
            "meaning": f"recurring transcript terms around {summary}",
            "phenomena": f"speech evidence with repeated terms such as {summary}",
            "model_matches": [],
            "keyword_labels": [],
            "fallback_terms": fallback_terms,
        }
    return {
        "summary": "",
        "primary_label": "",
        "labels": [],
        "situation": "",
        "meaning": "",
        "phenomena": "",
        "model_matches": [],
        "keyword_labels": [],
        "fallback_terms": [],
    }


def _transcript_discourse_form(transcript: List[Dict[str, Any]]) -> str:
    joined = " ".join(_safe_text(item.get("text")) for item in transcript).lower()
    if "what are you doing" in joined and any(term in joined for term in ("sir", "ma'am", "madam")):
        return "street interview"
    if any(term in joined for term in ("cop30", "climate summit", "emissions", "warming", "ministeri", "ilmastonmuutoksen")):
        return "news report"
    if any(term in joined for term in ("bond", "007", "double-o", "blofeld", "spectacular", "thrills")):
        return "trailer narration"
    if "?" in joined:
        return "question-led exchange"
    if len({_safe_text(item.get("speaker") or item.get("speaker_id")) for item in transcript}) > 1:
        return "dialogue"
    if transcript:
        return "monologue"
    return ""


def _meaning_summary_labels(meaning_plot: Dict[str, Any], limit: int = 2) -> List[str]:
    labels: List[str] = []
    for item in meaning_plot.get("instructions") or []:
        label = _safe_text(item.get("candidate_label") or item.get("label")).replace("_", " ")
        if ":" in label:
            label = label.split(":", 1)[1].strip()
        if label and label not in labels:
            labels.append(label)
        if len(labels) >= limit:
            return labels
    for item in meaning_plot.get("meaning_events") or []:
        label = _safe_text(item.get("label")).replace("_", " ")
        if label and label not in labels:
            labels.append(label)
        if len(labels) >= limit:
            break
    return labels


def _source_annotations(source_metadata: Dict[str, Any]) -> Dict[str, Any]:
    annotations = source_metadata.get("user_annotations")
    return annotations if isinstance(annotations, dict) else {}


def _listish_text(value: Any) -> List[str]:
    if isinstance(value, list):
        return [_clean_metadata_label(item) for item in value if _clean_metadata_label(item)]
    text = _clean_metadata_label(value)
    return [text] if text else []


def _metadata_place_bits(source_metadata: Dict[str, Any]) -> List[str]:
    annotations = _source_annotations(source_metadata)
    bits: List[str] = []
    for key in ("location_place", "location_city", "location_country", "location_room"):
        value = _clean_metadata_label(annotations.get(key) or source_metadata.get(key))
        if value and value not in bits:
            bits.append(value)
    return bits


def _metadata_time_bits(source_metadata: Dict[str, Any]) -> List[str]:
    annotations = _source_annotations(source_metadata)
    bits: List[str] = []
    for key in ("time_moment", "time_year", "time_era"):
        value = _clean_metadata_label(annotations.get(key) or source_metadata.get(key))
        if value and value not in bits:
            bits.append(value)
    if len(bits) > 1:
        bits = [bit for bit in bits if not any(bit != other and bit in other for other in bits)]
    return bits


def _metadata_format_bits(source_metadata: Dict[str, Any]) -> List[str]:
    annotations = _source_annotations(source_metadata)
    bits: List[str] = []
    for key in ("genre", "genre_subtype", "situational_genre", "situational_subtype"):
        value = _clean_metadata_label(annotations.get(key) or source_metadata.get(key))
        if value and value not in bits:
            bits.append(value)
    return bits


def _metadata_person_role_context(source_metadata: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    annotations = _source_annotations(source_metadata)
    text_sources = [
        _clean_metadata_label(annotations.get("editor_notes")),
        _clean_metadata_label(annotations.get("source_context")),
        _clean_metadata_label(annotations.get("provenance_notes")),
    ]
    people = _listish_text(annotations.get("persons")) + _listish_text(
        annotations.get("reference_speakers")
    )
    roles: List[str] = []
    joined = " ".join(text_sources)
    researcher_match = re.search(
        r"\b(PhD\s+Researcher\s+[A-ZÅÄÖ][\wÅÄÖåäö'´-]+(?:\s+[A-ZÅÄÖ][\wÅÄÖåäö'´-]+){0,3})",
        joined,
    )
    if researcher_match:
        label = researcher_match.group(1).replace("  ", " ").strip()
        if label not in people:
            people.append(label)
        if "interviewer" not in roles:
            roles.append("interviewer")
    if any(term in joined.lower() for term in ("interview", "searching for wisdom")):
        if "interviewer" not in roles:
            roles.append("interviewer")
    relation = _safe_text(annotations.get("relations"))
    if "interviewer" in relation.lower() and "interviewer" not in roles:
        roles.append("interviewer")
    return people[:4], roles[:4]


def _metadata_context_sentence(source_metadata: Dict[str, Any]) -> str:
    annotations = _source_annotations(source_metadata)
    for key in ("source_context", "editor_notes", "description"):
        value = _clean_metadata_label(annotations.get(key))
        if value:
            return value
    return ""


def _metadata_description_text(source_metadata: Dict[str, Any]) -> str:
    annotations = _source_annotations(source_metadata)
    parts: List[str] = []
    for key in (
        "description",
        "synopsis",
        "summary",
        "source_context",
        "editor_notes",
        "scope",
    ):
        parts.extend(_listish_text(annotations.get(key)))
        parts.extend(_listish_text(source_metadata.get(key)))
    return " ".join(_dedupe_text(parts))


def _description_interrogative_evidence(source_metadata: Dict[str, Any]) -> Dict[str, List[str]]:
    annotations = _source_annotations(source_metadata)
    evidence: Dict[str, List[str]] = {
        "by_what_means": [],
        "towards_what_end": [],
        "by_what_consequences": [],
    }
    explicit_keys = {
        "by_what_means": ("by_what_means", "means", "method", "methods"),
        "towards_what_end": ("towards_what_end", "purpose", "goal", "intended_outcome"),
        "by_what_consequences": (
            "by_what_consequence",
            "by_what_consequences",
            "consequence",
            "consequences",
            "effects",
            "outcomes",
        ),
    }
    for target, keys in explicit_keys.items():
        for key in keys:
            evidence[target].extend(_listish_text(annotations.get(key)))
            evidence[target].extend(_listish_text(source_metadata.get(key)))

    description = _metadata_description_text(source_metadata)
    if not description:
        return {key: _dedupe_text(values)[:4] for key, values in evidence.items() if values}

    sentences = [
        _clean_metadata_label(sentence)
        for sentence in re.split(r"(?<=[.!?])\s+|[;\n]+", description)
        if _clean_metadata_label(sentence)
    ]
    marker_patterns = {
        "by_what_means": re.compile(
            r"\b(by|through|via|using|with|from|through the use of|by means of)\b",
            re.IGNORECASE,
        ),
        "towards_what_end": re.compile(
            r"\b(to|in order to|so as to|for the purpose of|aims? to|intends? to|seeks? to)\b",
            re.IGNORECASE,
        ),
        "by_what_consequences": re.compile(
            r"\b(so|therefore|thus|hence|leading to|resulting in|causing|causes|as a result|consequently|which leads to)\b",
            re.IGNORECASE,
        ),
    }
    for sentence in sentences:
        for target, pattern in marker_patterns.items():
            if pattern.search(sentence):
                evidence[target].append(sentence)

    return {key: _dedupe_text(values)[:4] for key, values in evidence.items() if values}


def _short_metadata_terms(text: str, limit: int = 4) -> List[str]:
    clean = _safe_text(text)
    if not clean:
        return []
    phrases = re.split(r"[.;\n]+", clean)
    terms: List[str] = []
    for phrase in phrases:
        compact = " ".join(phrase.split()).strip(" ,")
        if 3 <= len(compact) <= 90 and compact not in terms:
            terms.append(compact)
        if len(terms) >= limit:
            break
    return terms


def _metadata_schema_facets(source_metadata: Dict[str, Any]) -> Dict[str, List[Tuple[str, str, str]]]:
    annotations = _source_annotations(source_metadata)
    facets: Dict[str, List[Tuple[str, str, str]]] = {facet: [] for facet in FACETS}

    def add(category: str, label: Any, key: str, likelihood: str = "observed") -> None:
        clean = _safe_text(label)
        if not clean or category not in facets:
            return
        pair = (clean, key, likelihood)
        if pair not in facets[category]:
            facets[category].append(pair)

    for key in ("location_place", "location_city", "location_country", "location_room"):
        if _safe_text(annotations.get(key)):
            add("places", _clean_metadata_label(annotations.get(key)), key, "manual")
        else:
            add("places", _clean_metadata_label(source_metadata.get(key)), key, "observed")
    for key in ("genre", "genre_subtype", "situational_genre", "situational_subtype"):
        if _safe_text(annotations.get(key)):
            add("genre_form", _clean_metadata_label(annotations.get(key)), key, "manual")
        else:
            add("genre_form", _clean_metadata_label(source_metadata.get(key)), key, "observed")
    for key in ("situation_event", "interaction_dynamics", "relations"):
        if _safe_text(annotations.get(key)):
            add("situations", _clean_metadata_label(annotations.get(key)), key, "manual")
        else:
            add("situations", _clean_metadata_label(source_metadata.get(key)), key, "observed")
    for key in ("narrative_development", "performance_expression", "privacy_axis", "expertise_axis"):
        if _safe_text(annotations.get(key)):
            add("themes", _clean_metadata_label(annotations.get(key)), key, "manual")
        else:
            add("themes", _clean_metadata_label(source_metadata.get(key)), key, "observed")
    for key in ("title", "scope", "description", "source_context", "editor_notes"):
        annotation_value = annotations.get(key)
        source_value = source_metadata.get(key)
        likelihood = "manual" if _safe_text(annotation_value) else "observed"
        for term in _short_metadata_terms(annotation_value or source_value, limit=3):
            add("subject_domain", term, key, likelihood)
    for keyword in _listish_text(annotations.get("keywords") or source_metadata.get("keywords")):
        add("subject_domain", keyword, "keywords", "manual" if annotations.get("keywords") else "observed")

    metadata_people, metadata_roles = _metadata_person_role_context(source_metadata)
    for person in metadata_people:
        add("persons", person, "persons", "manual")
    for role in metadata_roles:
        add("persons", role, "roles", "manual")
    return facets


def _ocr_text(item: Dict[str, Any]) -> str:
    return _clean_metadata_label(
        item.get("text")
        or item.get("ocr_text")
        or item.get("label")
        or item.get("raw_text")
    )


def _ocr_place_labels(text: str, source_metadata: Dict[str, Any]) -> List[str]:
    folded = _fold_text(text)
    labels: List[str] = []
    for place in _metadata_place_bits(source_metadata):
        place_folded = _fold_text(place)
        if place_folded and place_folded in folded:
            labels.append(place)
    known_places = {
        "helsinki": "Helsinki",
        "finland": "Finland",
        "belem": "Belem",
        "brazil": "Brazil",
    }
    for needle, label in known_places.items():
        if re.search(rf"\b{re.escape(needle)}\b", folded):
            labels.append(label)
    return _dedupe_text(labels)


def _ocr_subject_labels(text: str) -> List[str]:
    clean = _clean_metadata_label(text)
    folded = _fold_text(clean)
    labels: List[str] = []
    if re.search(r"\bcop\s*30\b", folded):
        labels.append("COP30")
    if re.search(r"\bbbc\b", folded):
        labels.append("BBC")
    if "planet helsinki" in folded:
        labels.append("Planet Helsinki")
    return _dedupe_text(labels)


def _clean_sfl_candidate_label(value: Any) -> str:
    if isinstance(value, dict):
        label = _safe_text(value.get("candidate_label") or value.get("label"))
        family = _safe_text(value.get("label_family") or value.get("target_label_family"))
        if family and label:
            return f"{family}: {label.replace('_', ' ')}"
        return (label or family).replace("_", " ")
    return _safe_text(value).replace("_", " ")


def _sfl_scene_profile(sfl_utterances: List[Dict[str, Any]]) -> Dict[str, Any]:
    speech_functions: List[str] = []
    process_types: List[str] = []
    affect: List[str] = []
    stance: List[str] = []
    modality: List[str] = []
    candidate_labels: List[str] = []

    for utterance in sfl_utterances:
        sfl = utterance.get("sfl_lite") if isinstance(utterance.get("sfl_lite"), dict) else {}
        interpersonal = (
            sfl.get("interpersonal") if isinstance(sfl.get("interpersonal"), dict) else {}
        )
        ideational = sfl.get("ideational") if isinstance(sfl.get("ideational"), dict) else {}
        support = (
            utterance.get("interpretation_support")
            if isinstance(utterance.get("interpretation_support"), dict)
            else {}
        )
        for target, value in (
            (speech_functions, interpersonal.get("speech_function")),
            (process_types, ideational.get("process_type")),
            (affect, interpersonal.get("affect")),
            (stance, interpersonal.get("stance")),
            (modality, interpersonal.get("modality")),
        ):
            clean = _safe_text(value).replace("_", " ")
            if clean and clean not in target:
                target.append(clean)
        for label in support.get("candidate_labels") or []:
            clean = _clean_sfl_candidate_label(label)
            if clean and clean not in candidate_labels:
                candidate_labels.append(clean)

    return {
        "utterance_count": len(sfl_utterances),
        "speech_functions": speech_functions[:6],
        "process_types": process_types[:6],
        "affect": affect[:6],
        "stance": stance[:6],
        "modality": modality[:6],
        "candidate_labels": candidate_labels[:8],
    }


def _sentence(text: str) -> str:
    clean = " ".join(_safe_text(text).split())
    if not clean:
        return ""
    return clean if clean.endswith((".", "!", "?")) else clean + "."


def _evidence_basis_sentence(
    *,
    transcript: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
    sfl_profile: Dict[str, Any],
    meaning_plot: Dict[str, Any],
) -> str:
    basis: List[str] = []
    if transcript:
        basis.append("mature transcript")
    if sfl_profile.get("utterance_count"):
        basis.append("SFL interaction analysis")
    if meaning_plot.get("instructions") or meaning_plot.get("meaning_events"):
        basis.append("Plot / Meaning indicators")
    mature_sources = []
    for item in items:
        source = _safe_text(item.get("source"))
        status = _safe_text(item.get("status"))
        if status in {"manual", "observed"} and source and source not in mature_sources:
            mature_sources.append(source)
    if mature_sources:
        basis.append("resolved " + _join_phrase(mature_sources[:3]))
    if not basis:
        return "The prose is based on the available scene-card evidence; raw detections remain preserved separately for audit."
    return (
        "The prose is routed through "
        + _join_phrase(basis[:4])
        + "; raw detections remain preserved separately for audit."
    )


def _pos_interrogative_lens(pos_analysis: Optional[Dict[str, Any]]) -> Dict[str, List[str]]:
    if not isinstance(pos_analysis, dict):
        return {}
    lens = pos_analysis.get("interrogative_lens")
    if not isinstance(lens, dict):
        return {}
    normalized: Dict[str, List[str]] = {}
    for key, value in lens.items():
        if isinstance(value, list):
            normalized[str(key)] = _dedupe_text(value)[:6]
    return normalized


def _scene_interrogative_schema(
    *,
    who_is_speaking: str,
    topic_summary: Dict[str, Any],
    discourse_form: str,
    place_labels: List[str],
    prop_labels: List[str],
    source_metadata: Dict[str, Any],
    meanings_constructed: str,
    phenomena: str,
    sfl_profile: Dict[str, Any],
    event_labels: List[str],
    action_labels: List[str],
    meaning_labels: List[str],
    subject_labels: List[str],
    description_evidence: Dict[str, List[str]],
    pos_analysis: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    pos_lens = _pos_interrogative_lens(pos_analysis)
    places = _dedupe_text([*_metadata_place_bits(source_metadata), *place_labels])
    times = _metadata_time_bits(source_metadata)
    what_bits = _dedupe_text(
        [
            *subject_labels[:3],
            topic_summary.get("summary"),
            topic_summary.get("situation"),
            *_metadata_format_bits(source_metadata)[:2],
        ]
    )
    how_bits = _dedupe_text(
        [
            discourse_form,
            *_safe_list(sfl_profile.get("speech_functions")),
            *_safe_list(sfl_profile.get("process_types")),
            *action_labels,
            *event_labels,
        ]
    )
    why_bits = _dedupe_text(
        [
            topic_summary.get("meaning"),
            topic_summary.get("phenomena"),
            *meaning_labels,
        ]
    )

    schema: Dict[str, Any] = {
        "who": _sentence(who_is_speaking) if who_is_speaking else "",
        "what": _sentence(_join_phrase(what_bits[:4])) if what_bits else "",
        "where": _sentence(_join_phrase(places[:4])) if places else "",
        "when": _sentence(_join_phrase(times[:3])) if times else "",
        "how": _sentence(_join_phrase(how_bits[:5])) if how_bits else "",
        "why_or_meaning": meanings_constructed or _sentence(_join_phrase(why_bits[:4])),
        "by_what_means": _sentence(
            _join_phrase(
                [
                    *description_evidence.get("by_what_means", [])[:3],
                    *pos_lens.get("by_what_means", [])[:2],
                ][:4]
            )
        ),
        "towards_what_end": _sentence(
            _join_phrase(
                [
                    *description_evidence.get("towards_what_end", [])[:3],
                    *pos_lens.get("towards_what_end", [])[:2],
                ][:4]
            )
        ),
        "by_what_consequences": _sentence(
            _join_phrase(
                [
                    *description_evidence.get("by_what_consequences", [])[:3],
                    *pos_lens.get("by_what_consequence", [])[:2],
                    *pos_lens.get("by_what_consequences", [])[:2],
                ][:4]
            )
        ),
        "phenomena": phenomena,
        "pos_support": pos_lens,
        "description_evidence": description_evidence,
    }
    for key, pos_key in (
        ("who", "who"),
        ("what", "what"),
        ("where", "where"),
        ("when", "when"),
        ("how", "how"),
        ("why_or_meaning", "why"),
        ("by_what_means", "by_what_means"),
        ("towards_what_end", "towards_what_end"),
        ("by_what_consequences", "by_what_consequence"),
    ):
        if not schema.get(key) and pos_lens.get(pos_key):
            schema[key] = _sentence(_join_phrase(pos_lens[pos_key][:4]))
    return {key: value for key, value in schema.items() if value}


def _safe_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [_safe_text(item) for item in value if _safe_text(item)]
    text = _safe_text(value)
    return [text] if text else []


def _scene_prose_sections(
    *,
    transcript: List[Dict[str, Any]],
    person_count: int,
    place_labels: List[str],
    prop_labels: List[str],
    items: List[Dict[str, Any]],
    meaning_plot: Dict[str, Any],
    sfl_utterances: List[Dict[str, Any]],
    scene_boundary_source: str,
    overview: str,
    speech_clause: str,
    discourse_form: str,
    topic_summary: Dict[str, Any],
    identity_labels: List[str],
    role_labels: List[str],
    source_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, str]:
    source_metadata = source_metadata or {}
    sfl_profile = _sfl_scene_profile(sfl_utterances)
    action_labels = _unique_item_labels(items, ("actions",), limit=3)
    situation_labels = _unique_item_labels(items, ("situations",), limit=3)
    event_labels = _unique_item_labels(items, ("events",), limit=3)
    theme_labels = _unique_item_labels(items, ("themes",), limit=3)
    expression_labels = _unique_item_labels(items, ("situations",), limit=4)
    costume_labels = _unique_item_labels(items, ("costume",), limit=3)
    cinematic_labels = _unique_item_labels(items, ("cinematic_cues",), limit=4)
    genre_labels = _unique_item_labels(items, ("genre_form",), limit=2)
    topic_labels = topic_summary.get("labels") or _transcript_topic_labels(transcript)
    meaning_labels = _meaning_summary_labels(meaning_plot, limit=4)
    unique_places = _dedupe_text(place_labels)[:3]
    unique_props = _dedupe_text(prop_labels)[:5]
    metadata_places = _metadata_place_bits(source_metadata)
    metadata_times = _metadata_time_bits(source_metadata)
    metadata_formats = _metadata_format_bits(source_metadata)
    metadata_people, metadata_roles = _metadata_person_role_context(source_metadata)
    metadata_context = _metadata_context_sentence(source_metadata)

    role_terms = _dedupe_text([*role_labels[:3], *metadata_roles[:3]])
    identity_terms = _dedupe_text([*identity_labels[:3], *metadata_people[:3]])
    role_phrase = _join_phrase(_dedupe_text([*role_terms[:2], *identity_terms[:2]]))
    topic_phrase = topic_summary.get("summary") or _join_phrase(topic_labels[:3])
    meaning_phrase = (
        topic_summary.get("meaning")
        or meaning_plot.get("summary")
        or _join_phrase([*meaning_labels[:2], *theme_labels[:2]])
    )

    summary_parts: List[str] = []
    if discourse_form:
        summary_parts.append(f"a {discourse_form}")
    if topic_phrase:
        summary_parts.append(f"about {topic_phrase}")
    summary_role_terms = role_terms
    if discourse_form and "interview" in discourse_form and identity_terms:
        summary_role_terms = []
    summary_role_phrase = _join_phrase(_dedupe_text([*summary_role_terms[:2], *identity_terms[:2]]))
    if summary_role_phrase:
        summary_parts.append(f"with {summary_role_phrase}")
    elif speech_clause:
        summary_parts.append(speech_clause)
    if meaning_phrase:
        summary_parts.append(f"constructing {meaning_phrase}")
    if unique_props:
        summary_parts.append(f"while visible cues include {_join_phrase(unique_props[:3])}")
    if summary_parts:
        summary = "This mise-en-scene reads as " + "; ".join(summary_parts[:5])
    elif overview:
        summary = overview
    else:
        summary = "This mise-en-scene has limited mature evidence for a coherent prose account"

    if metadata_places or unique_places or metadata_times or metadata_formats:
        setting = "The setting is anchored by "
        setting_bits = []
        if metadata_places:
            setting_bits.append(_join_phrase(metadata_places))
        if metadata_times:
            setting_bits.append(_join_phrase(metadata_times[:2]))
        non_repeated_places = [
            place
            for place in unique_places
            if place.lower() not in {metadata_place.lower() for metadata_place in metadata_places}
        ]
        if non_repeated_places:
            setting_bits.append(_join_phrase(non_repeated_places))
        if metadata_formats:
            setting_bits.append(f"source metadata frames it as {_join_phrase(metadata_formats[:3])}")
        elif genre_labels:
            setting_bits.append(f"genre-form evidence such as {_join_phrase(genre_labels)}")
        setting += _join_phrase(setting_bits)
    else:
        setting = ""

    props = (
        f"Props and set-dressing cues foreground {_join_phrase(unique_props)}"
        if unique_props
        else ""
    )

    costume = (
        f"Costume, hair, and makeup evidence currently points to {_join_phrase(costume_labels)}"
        if costume_labels
        else ""
    )

    performance_bits: List[str] = []
    if role_terms and identity_terms:
        performance_bits.append(
            f"{_join_phrase(role_terms[:2])} structures the speaking role, with identified participant evidence including {_join_phrase(identity_terms[:2])}"
        )
    elif role_terms:
        performance_bits.append(f"{_join_phrase(role_terms[:2])} structures the speaking role")
    elif identity_terms:
        performance_bits.append(
            f"identified participant evidence includes {_join_phrase(identity_terms[:2])}"
        )
    elif speech_clause:
        performance_bits.append(speech_clause)
    if sfl_profile["speech_functions"]:
        performance_bits.append(
            "SFL reads the interaction as "
            + _join_phrase([str(value) for value in sfl_profile["speech_functions"][:3]])
        )
    if sfl_profile["process_types"]:
        performance_bits.append(
            "with "
            + _join_phrase([str(value) for value in sfl_profile["process_types"][:3]])
            + " process cues"
        )
    if action_labels:
        performance_bits.append(f"blocking/action cues include {_join_phrase(action_labels)}")
    if expression_labels:
        performance_bits.append(f"expression evidence includes {_join_phrase(expression_labels[:2])}")
    performance = (
        "; ".join(performance_bits[:4])
        if performance_bits
        else ""
    )

    outdoor_context = any(
        term in " ".join([metadata_context, *metadata_places]).lower()
        for term in ("square", "city center", "city centre", "outdoor", "street")
    )
    if any("light" in label.lower() or "color" in label.lower() or "colour" in label.lower() for label in cinematic_labels):
        lighting = f"Lighting and colour are represented by mature cinematic cues such as {_join_phrase(cinematic_labels)}"
    elif outdoor_context:
        lighting = "Lighting and colour read as outdoor public-space footage from the source context and visible city-square setting"
    else:
        lighting = ""

    framing = (
        f"Cinematography and framing evidence currently surfaces {_join_phrase(cinematic_labels)}"
        if cinematic_labels
        else ""
    )

    editing = ""
    if scene_boundary_source:
        if "transcript" in scene_boundary_source:
            editing = "The scene boundary is currently a working transcript-window division rather than a final edit decision"
        else:
            editing = "The scene boundary follows the available visual or detected transition evidence"
    if meaning_labels:
        editing += (
            (", and " if editing else "")
            + "Plot / Meaning cues mark "
            + _join_phrase(meaning_labels[:3])
        )

    sound_bits: List[str] = []
    joined_events = " ".join(event_labels).lower()
    if transcript:
        if "foreground speech" not in joined_events:
            sound_bits.append("foreground speech")
    if event_labels:
        sound_bits.append(_join_phrase(event_labels[:3]))
    if sfl_profile["affect"]:
        sound_bits.append("SFL affect cues such as " + _join_phrase(sfl_profile["affect"][:3]))
    sound = (
        "Sound design evidence includes " + _join_phrase(sound_bits)
        if sound_bits
        else ""
    )

    meaning_plot_text = meaning_phrase or "No stable Plot / Meaning indicator has surfaced yet"
    if meaning_labels:
        meaning_plot_text += "; Plot / Meaning indicators include " + _join_phrase(meaning_labels[:3])
    if sfl_profile["candidate_labels"]:
        meaning_plot_text += "; SFL interaction cues include " + _join_phrase(sfl_profile["candidate_labels"][:3])
    if theme_labels:
        meaning_plot_text += "; thematic evidence includes " + _join_phrase(theme_labels[:3])

    return {
        "summary": _sentence(summary),
        "setting_and_set_design": _sentence(setting),
        "props": _sentence(props),
        "costume_hair_makeup": _sentence(costume),
        "performance_and_blocking": _sentence(performance),
        "lighting_and_color": _sentence(lighting),
        "cinematography_and_framing": _sentence(framing),
        "editing": _sentence(editing),
        "sound_design": _sentence(sound),
        "meaning_and_plot": _sentence(str(meaning_plot_text)),
        "evidence_basis": _sentence(
            _evidence_basis_sentence(
                transcript=transcript,
                items=items,
                sfl_profile=sfl_profile,
                meaning_plot=meaning_plot,
            )
        ),
    }


def _scene_nlp_summary(
    *,
    transcript: List[Dict[str, Any]],
    person_count: int,
    place_labels: List[str],
    prop_labels: List[str],
    items: List[Dict[str, Any]],
    meaning_plot: Dict[str, Any],
    sfl_utterances: Optional[List[Dict[str, Any]]] = None,
    scene_boundary_source: str = "",
    overview: str = "",
    source_metadata: Optional[Dict[str, Any]] = None,
    pos_analysis: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    source_metadata = source_metadata or {}
    clauses: List[str] = []
    evidence_ids: List[str] = []

    speech_clause = _speech_activity_clause(transcript)
    if speech_clause:
        clauses.append(speech_clause)
        evidence_ids.extend(
            _safe_text(item.get("id") or item.get("evidence_id"))
            for item in transcript[:4]
            if _safe_text(item.get("id") or item.get("evidence_id"))
        )

    situation_labels = _unique_item_labels(items, ("situations",), limit=2)
    theme_labels = _unique_item_labels(items, ("themes",), limit=2)
    event_labels = _unique_item_labels(items, ("events",), limit=2)
    subject_labels = _unique_item_labels(items, ("subject_domain",), limit=4)
    meaning_labels = _meaning_summary_labels(meaning_plot, limit=2)
    transcript_topics = _transcript_topic_labels(transcript)
    topic_summary = _transcript_topic_summary(transcript)
    topic_labels = topic_summary.get("labels") or transcript_topics
    discourse_form = _transcript_discourse_form(transcript)
    identity_labels, role_labels = _identity_context_from_items(items)
    metadata_identity_labels, metadata_role_labels = _metadata_person_role_context(source_metadata)
    for label in metadata_identity_labels:
        if label not in identity_labels:
            identity_labels.append(label)
    for label in metadata_role_labels:
        if label not in role_labels:
            role_labels.append(label)
    if topic_summary.get("summary"):
        clauses.append(f"the transcript centers on {topic_summary['summary']}")

    if person_count:
        clauses.append("one visible person is present" if person_count == 1 else "people are visible")

    action_labels = _unique_item_labels(items, ("actions",), limit=2)
    if action_labels:
        clauses.append(f"action cues suggest {_join_phrase(action_labels)}")

    setting_bits: List[str] = []
    unique_places = list(dict.fromkeys(place_labels))[:2]
    unique_props = list(dict.fromkeys(prop_labels))[:3]
    if unique_places:
        setting_bits.append(f"the setting is linked to {_join_phrase(unique_places)}")
    if unique_props:
        setting_bits.append(f"visible object cues include {_join_phrase(unique_props)}")
    clauses.extend(setting_bits)

    interpretive_bits = topic_labels or meaning_labels or situation_labels or theme_labels or event_labels
    if interpretive_bits:
        clauses.append(f"the scene carries {_join_phrase(interpretive_bits[:3])} cues")

    if not clauses:
        sentence = "This scene has limited mature evidence for a sentence-level mise-en-scene summary."
    else:
        sentence = "In this scene, " + "; ".join(clauses[:5]) + "."

    what_is_happening = sentence
    who_is_speaking = _speaking_description(
        transcript,
        discourse_form,
        identity_labels=identity_labels,
        role_labels=role_labels,
    )
    if topic_summary.get("situation"):
        situation = str(topic_summary["situation"])
    elif discourse_form and transcript_topics:
        situation = (
            f"The situation is a {discourse_form} about "
            f"{_join_phrase(transcript_topics[:3])}."
        )
    elif situation_labels:
        situation = f"The situation is framed by {_join_phrase(situation_labels[:3])}."
    elif action_labels:
        situation = f"The situation is organized around {_join_phrase(action_labels[:3])}."
    elif transcript:
        situation = "The situation is primarily speech-led."
    else:
        situation = "The situation is not yet strongly characterized by mature evidence."

    if topic_summary.get("meaning"):
        meanings_constructed = f"The transcript constructs {topic_summary['meaning']}."
    elif transcript_topics:
        meanings_constructed = f"The transcript constructs questions of {_join_phrase(transcript_topics[:3])}."
    elif meaning_labels:
        meanings_constructed = f"The scene constructs {_join_phrase(meaning_labels[:3])} meanings."
    elif theme_labels:
        meanings_constructed = f"The scene suggests {_join_phrase(theme_labels[:3])} themes."
    else:
        meanings_constructed = "No stable meaning construction has surfaced beyond the basic evidence yet."

    phenomena_parts = []
    if topic_summary.get("phenomena"):
        phenomena_parts.append(str(topic_summary["phenomena"]))
    if event_labels:
        phenomena_parts.append(_join_phrase(event_labels[:3]))
    if unique_props:
        phenomena_parts.append(f"visible objects such as {_join_phrase(unique_props[:3])}")
    if unique_places:
        phenomena_parts.append(f"place cues linked to {_join_phrase(unique_places[:2])}")
    if not phenomena_parts:
        phenomena = "No distinct material phenomena have been summarized yet."
    else:
        phenomena = "The material includes " + "; ".join(phenomena_parts[:3]) + "."

    prose_sections = _scene_prose_sections(
        transcript=transcript,
        person_count=person_count,
        place_labels=place_labels,
        prop_labels=prop_labels,
        items=items,
        meaning_plot=meaning_plot,
        sfl_utterances=sfl_utterances or [],
        scene_boundary_source=scene_boundary_source,
        overview=overview,
        speech_clause=speech_clause,
        discourse_form=discourse_form,
        topic_summary=topic_summary,
        identity_labels=identity_labels,
        role_labels=role_labels,
        source_metadata=source_metadata,
    )
    sentence = prose_sections.get("summary") or sentence
    what_is_happening = sentence
    sfl_profile = _sfl_scene_profile(sfl_utterances or [])
    interrogative_schema = _scene_interrogative_schema(
        who_is_speaking=who_is_speaking,
        topic_summary=topic_summary,
        discourse_form=discourse_form,
        place_labels=place_labels,
        prop_labels=unique_props,
        source_metadata=source_metadata or {},
        meanings_constructed=meanings_constructed,
        phenomena=phenomena,
        sfl_profile=sfl_profile,
        event_labels=event_labels,
        action_labels=action_labels,
        meaning_labels=meaning_labels,
        subject_labels=subject_labels,
        description_evidence=_description_interrogative_evidence(source_metadata),
        pos_analysis=pos_analysis,
    )

    item_evidence_refs: List[str] = []
    for item in items:
        for ref in item.get("evidence_refs") or []:
            ref_text = _safe_text(ref)
            if ref_text and ref_text not in item_evidence_refs:
                item_evidence_refs.append(ref_text)
        if len(item_evidence_refs) >= 8:
            break

    return {
        "version": NLP_SCENE_SUMMARY_VERSION,
        "sentence": sentence,
        "prose_sections": prose_sections,
        "interrogative_schema": interrogative_schema,
        "description": {
            "what_is_happening": what_is_happening,
            "who_is_speaking": who_is_speaking,
            "situation": situation,
            "meanings_constructed": meanings_constructed,
            "phenomena": phenomena,
        },
        "authority": "mature_evidence_deterministic_nlp",
        "summary_inputs": {
            "transcript_segments": len(transcript),
            "person_count": person_count,
            "places": unique_places,
            "props": unique_props,
            "actions": action_labels,
            "situations": situation_labels,
            "themes": theme_labels,
            "events": event_labels,
            "meaning_plot": meaning_labels,
            "subject_domain": subject_labels,
            "transcript_topics": transcript_topics,
            "transcript_topic_model": topic_summary,
            "description_interrogatives": interrogative_schema.get("description_evidence", {}),
            "identity_labels": identity_labels,
            "role_labels": role_labels,
            "discourse_form": discourse_form,
            "sfl_profile": sfl_profile,
            "pos_interrogative_lens": _pos_interrogative_lens(pos_analysis),
        },
        "source_evidence_ids": list(dict.fromkeys([*evidence_ids, *item_evidence_refs]))[:12],
    }


def _scene_card_tags(items: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    tags = {facet: [] for facet in FACETS}
    for item in items:
        category = str(item.get("category") or "")
        facet = category if category in tags else f"{category}s"
        if facet not in tags:
            continue
        tags[facet].append(f"{item.get('symbol')} {item.get('label')}")
    return tags


def build_mise_en_scene_scene_cards(
    analysis_id: str,
    status: Dict[str, Any],
    *,
    source_video_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build concise, evidence-linked scene cards from existing VAA1 outputs.

    The function is deterministic and deliberately modest: it indexes evidence
    by scene and proposes lightweight facets without mutating source metadata.
    """

    source_video_id = source_video_id or _safe_text(status.get("video_id"), analysis_id)
    source_metadata = _extract_source_metadata(status)
    metadata_facets = _metadata_schema_facets(source_metadata)
    corrections = _corrections_payload(status)
    transcript = _apply_transcript_corrections(_extract_transcript(status), corrections)
    scenes = _extract_scenes(status, analysis_id, transcript)
    objects = _apply_detection_label_corrections(
        _extract_objects(status),
        corrections,
        modality="object",
        label_keys=("displayLabel", "class_name", "raw_class_name", "label"),
    )
    ocr = _apply_detection_label_corrections(
        _extract_ocr(status),
        corrections,
        modality="ocr",
        label_keys=("text", "label"),
    )
    expressions = _apply_detection_label_corrections(
        _extract_expressions(status),
        corrections,
        modality="expression",
        label_keys=("dominant_emotion", "dominant_expression", "expression", "label"),
    )
    audio_prosody = _extract_audio_prosody(status)
    meaning_instructions = _extract_second_order_instructions(status)
    meaning_events = _extract_meaning_events(status)
    sfl_utterances = _extract_sfl_utterances(status)
    pos_analysis = _extract_pos_analysis(status)
    cards: List[Dict[str, Any]] = []

    for scene_index, scene in enumerate(scenes, start=1):
        scene_start_ms, scene_end_ms = _interval_ms(scene)
        scene_id = _scene_id(analysis_id, scene_index, scene)
        scene_transcript = [item for item in transcript if _overlaps(item, scene_start_ms, scene_end_ms)]
        scene_objects = [item for item in objects if _overlaps(item, scene_start_ms, scene_end_ms)]
        scene_ocr = [item for item in ocr if _overlaps(item, scene_start_ms, scene_end_ms)]
        scene_expressions = [item for item in expressions if _overlaps(item, scene_start_ms, scene_end_ms)]
        scene_audio = [item for item in audio_prosody if _overlaps(item, scene_start_ms, scene_end_ms)]
        scene_sfl_utterances = [
            item for item in sfl_utterances if _overlaps(item, scene_start_ms, scene_end_ms)
        ]
        scene_manual = _manual_visual_annotations_for_scene(corrections, scene_start_ms, scene_end_ms)

        items: List[Dict[str, Any]] = []
        said_in_scene: List[Dict[str, Any]] = []
        joined_transcript = " ".join(_safe_text(item.get("text")) for item in scene_transcript)

        for index, item in enumerate(scene_transcript):
            start_ms, end_ms = _interval_ms(item)
            evidence_ref = _evidence_id("utt", scene_index, index, item)
            said_in_scene.append(
                {
                    "evidence_id": evidence_ref,
                    "speaker": _safe_text(item.get("speaker") or item.get("speaker_id"), "SPEAKER_UNKNOWN"),
                    "text": _safe_text(item.get("text")),
                    "time_interval": {"start_ms": start_ms, "end_ms": end_ms},
                    "navigation_time_seconds": round(start_ms / 1000.0, 3),
                    "navigation": _navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=start_ms,
                        panel="TranscriptPanel",
                        evidence_refs=[evidence_ref],
                    ),
                }
            )

        transcript_refs = [item["evidence_id"] for item in said_in_scene]
        for label in _speech_labels(scene_transcript):
            _add_item(
                items,
                _new_item(
                    scene_id=scene_id,
                    category="speech",
                    label=label,
                    likelihood="observed" if scene_transcript else "possible",
                    evidence_refs=transcript_refs,
                    navigation=_navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=scene_start_ms,
                        panel="TranscriptPanel",
                        evidence_refs=transcript_refs,
                    ),
                    source="transcript",
                ),
            )

        person_count = 0
        prop_labels: List[str] = []
        place_labels: List[str] = []
        for index, obj in enumerate(scene_objects):
            label = _safe_text(
                obj.get("displayLabel")
                or obj.get("class_name")
                or obj.get("raw_class_name")
                or obj.get("label")
            )
            if not label:
                continue
            evidence_ref = _evidence_id("object", scene_index, index, obj)
            start_ms, _ = _interval_ms(obj)
            category = "persons" if "person" in label.lower() else "props"
            clean_category = "person" if category == "persons" else "prop"
            if clean_category == "person":
                person_count += 1
            else:
                prop_labels.append(label)
            _add_item(
                items,
                _new_item(
                    scene_id=scene_id,
                    category=category,
                    label=label,
                    likelihood="observed",
                    evidence_refs=[evidence_ref],
                    navigation=_navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=start_ms,
                        panel="OBJDetectionPanel",
                        evidence_refs=[evidence_ref],
                    ),
                    source="object_detection",
                ),
            )
            for costume_label, hints in COSTUME_KEYWORDS.items():
                if _contains_any(label, hints):
                    _add_item(
                        items,
                        _new_item(
                            scene_id=scene_id,
                            category="costume",
                            label=costume_label,
                            likelihood="possible",
                            evidence_refs=[evidence_ref],
                            navigation=_navigation(
                                analysis_id=analysis_id,
                                source_video_id=source_video_id,
                                time_ms=start_ms,
                                panel="OBJDetectionPanel",
                                evidence_refs=[evidence_ref],
                            ),
                            source="object_detection",
                        ),
                    )

        for index, item in enumerate(scene_ocr):
            text = _ocr_text(item)
            if not text:
                continue
            evidence_ref = _evidence_id("ocr", scene_index, index, item)
            start_ms, _ = _interval_ms(item)
            _add_item(
                items,
                _new_item(
                    scene_id=scene_id,
                    category="props",
                    label="document/screen text",
                    likelihood="observed",
                    evidence_refs=[evidence_ref],
                    navigation=_navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=start_ms,
                        panel="OCRPanel",
                        evidence_refs=[evidence_ref],
                    ),
                    source="ocr",
                ),
            )
            for place_label in _ocr_place_labels(text, source_metadata):
                place_labels.append(place_label)
                _add_item(
                    items,
                    _new_item(
                        scene_id=scene_id,
                        category="places",
                        label=place_label,
                        likelihood="observed",
                        evidence_refs=[evidence_ref],
                        navigation=_navigation(
                            analysis_id=analysis_id,
                            source_video_id=source_video_id,
                            time_ms=start_ms,
                            panel="OCRPanel",
                            evidence_refs=[evidence_ref],
                        ),
                        source="ocr",
                    ),
                )
            for subject_label in _ocr_subject_labels(text):
                _add_item(
                    items,
                    _new_item(
                        scene_id=scene_id,
                        category="subject_domain",
                        label=subject_label,
                        likelihood="observed",
                        evidence_refs=[evidence_ref],
                        navigation=_navigation(
                            analysis_id=analysis_id,
                            source_video_id=source_video_id,
                            time_ms=start_ms,
                            panel="OCRPanel",
                            evidence_refs=[evidence_ref],
                        ),
                        source="ocr",
                    ),
                )

        for index, item in enumerate(scene_expressions):
            label = _compact_expression_label(item)
            if not label:
                continue
            evidence_ref = _evidence_id("expression", scene_index, index, item)
            start_ms, _ = _interval_ms(item)
            _add_item(
                items,
                _new_item(
                    scene_id=scene_id,
                    category="situations",
                    label=f"{label} expression cue",
                    likelihood="possible",
                    evidence_refs=[evidence_ref],
                    navigation=_navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=start_ms,
                        panel="ExpressionPanel",
                        evidence_refs=[evidence_ref],
                    ),
                    source="expression_detection",
                ),
            )

        for index, item in enumerate(scene_audio):
            label = _safe_text(
                item.get("label")
                or item.get("event")
                or item.get("prosody")
                or (item.get("sound_environment") or {}).get("label")
                or (item.get("emphasis") or {}).get("label")
                or (item.get("rhythm_profile") or {}).get("label")
                or (item.get("tonality_profile") or {}).get("label")
            )
            if not label:
                continue
            evidence_ref = _evidence_id("audio", scene_index, index, item)
            start_ms, _ = _interval_ms(item)
            _add_item(
                items,
                _new_item(
                    scene_id=scene_id,
                    category="events",
                    label=label,
                    likelihood="observed",
                    evidence_refs=[evidence_ref],
                    navigation=_navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=start_ms,
                        panel="AudioProsodyPanel",
                        evidence_refs=[evidence_ref],
                    ),
                    source="audio_prosody",
                ),
            )

        for index, item in enumerate(scene_manual):
            category = _safe_text(item.get("category"), "Notes")
            label = _safe_text(
                item.get("custom_label")
                or item.get("label")
                or item.get("open_note")
                or item.get("subcategory"),
                "manual annotation",
            )
            evidence_ref = item.get("id") or f"manual:{scene_index:03d}:{index:03d}"
            start_ms, _ = _interval_ms(item)
            facet = {
                "Action": "actions",
                "Audio": "events",
                "Cinematic Cues": "cinematic_cues",
                "Expressions": "situations",
                "Genre": "genre_form",
                "Identification": "persons",
                "Interaction": "situations",
                "Metadata": "subject_domain",
                "Movement": "actions",
                "Notes": "themes",
                "OBJ": "props",
                "OCR": "props",
                "Role": "persons",
                "Scene": "situations",
                "Transcription": "speech",
            }.get(category, "themes")
            if facet == "props" and category == "OBJ" and "person" in label.lower():
                facet = "persons"
            _add_item(
                items,
                {
                    **_new_item(
                        scene_id=scene_id,
                        category=facet,
                        label=label,
                        likelihood="manual",
                        evidence_refs=[str(evidence_ref)],
                        navigation=_navigation(
                            analysis_id=analysis_id,
                            source_video_id=source_video_id,
                            time_ms=start_ms,
                            panel="ManualScene" if category == "Scene" else "MasterSchemaPanel",
                            evidence_refs=[str(evidence_ref)],
                        ),
                        source="manual_visual_annotation",
                    ),
                    "status": "manual",
                    "manual_note": item.get("open_note"),
                    "manual_category": category,
                    "metadata_correlation": item.get("metadata_correlation"),
                },
            )

        for action, hints in ACTION_KEYWORDS.items():
            if _contains_any(joined_transcript, hints):
                _add_item(
                    items,
                    _new_item(
                        scene_id=scene_id,
                        category="actions",
                        label=action,
                        likelihood="likely" if action != "speaking" else "observed",
                        evidence_refs=transcript_refs,
                        navigation=_navigation(
                            analysis_id=analysis_id,
                            source_video_id=source_video_id,
                            time_ms=scene_start_ms,
                            panel="TranscriptPanel",
                            evidence_refs=transcript_refs,
                        ),
                        source="transcript_keywords",
                    ),
                )

        situation_labels: List[str] = []
        for situation, hints in SITUATION_KEYWORDS.items():
            if _contains_any(joined_transcript, hints):
                situation_labels.append(situation)
                _add_item(
                    items,
                    _new_item(
                        scene_id=scene_id,
                        category="situations",
                        label=situation,
                        likelihood="likely",
                        evidence_refs=transcript_refs,
                        navigation=_navigation(
                            analysis_id=analysis_id,
                            source_video_id=source_video_id,
                            time_ms=scene_start_ms,
                            panel="TranscriptPanel",
                            evidence_refs=transcript_refs,
                        ),
                        source="transcript_keywords",
                    ),
                )

        for theme, hints in THEME_KEYWORDS.items():
            if _contains_any(joined_transcript, hints):
                _add_item(
                    items,
                    _new_item(
                        scene_id=scene_id,
                        category="themes",
                        label=theme,
                        likelihood="likely",
                        evidence_refs=transcript_refs,
                        navigation=_navigation(
                            analysis_id=analysis_id,
                            source_video_id=source_video_id,
                            time_ms=scene_start_ms,
                            panel="TranscriptPanel",
                            evidence_refs=transcript_refs,
                        ),
                        source="transcript_keywords",
                    ),
                )

        topic_summary = _transcript_topic_summary(scene_transcript)
        for topic_label in topic_summary.get("labels") or []:
            _add_item(
                items,
                _new_item(
                    scene_id=scene_id,
                    category="subject_domain",
                    label=str(topic_label),
                    likelihood="likely",
                    evidence_refs=transcript_refs,
                    navigation=_navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=scene_start_ms,
                        panel="TranscriptPanel",
                        evidence_refs=transcript_refs,
                    ),
                    source="transcript_topic_model",
                ),
            )

        for key in ("place", "location", "setting"):
            value = _safe_text(source_metadata.get(key))
            if value:
                place_labels.append(value)
                _add_item(
                    items,
                    _new_item(
                        scene_id=scene_id,
                        category="places",
                        label=value,
                        likelihood="observed",
                        evidence_refs=["source_metadata"],
                        navigation=_navigation(
                            analysis_id=analysis_id,
                            source_video_id=source_video_id,
                            time_ms=scene_start_ms,
                            panel="MetadataPanel",
                            evidence_refs=["source_metadata"],
                        ),
                        source="source_metadata",
                    ),
                )

        for category, pairs in metadata_facets.items():
            for label, key, likelihood in pairs:
                if category == "places" and label in place_labels:
                    continue
                if category == "places":
                    place_labels.append(label)
                metadata_item = _new_item(
                    scene_id=scene_id,
                    category=category,
                    label=label,
                    likelihood=likelihood,
                    evidence_refs=[f"source_media_metadata:{key}"],
                    navigation=_navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=scene_start_ms,
                        panel="MetadataPanel",
                        evidence_refs=[f"source_media_metadata:{key}"],
                    ),
                    source="source_media_metadata",
                )
                if key == "roles":
                    metadata_item["manual_category"] = "Role"
                _add_item(
                    items,
                    metadata_item,
                )

        for label, path in _genre_labels(source_metadata, scene_transcript):
            source_genre = _safe_text(source_metadata.get("genre") or source_metadata.get("genre_form"))
            _add_item(
                items,
                _new_item(
                    scene_id=scene_id,
                    category="genre_form",
                    label=label,
                    likelihood="observed" if label == source_genre else "likely",
                    evidence_refs=transcript_refs or ["source_metadata"],
                    navigation=_navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=scene_start_ms,
                        panel="MetadataPanel",
                        evidence_refs=transcript_refs or ["source_metadata"],
                    ),
                    source="metadata_transcript_alignment",
                    path=path,
                ),
            )

        shot = _safe_text(scene.get("shot_size") or scene.get("framing") or scene.get("lighting"))
        if shot:
            _add_item(
                items,
                _new_item(
                    scene_id=scene_id,
                    category="cinematic_cues",
                    label=shot,
                    likelihood="observed",
                    evidence_refs=[scene_id],
                    navigation=_navigation(
                        analysis_id=analysis_id,
                        source_video_id=source_video_id,
                        time_ms=scene_start_ms,
                        panel="VideoPanel",
                        evidence_refs=[scene_id],
                    ),
                    source="scene_metadata",
                ),
            )

        meaning_plot = _scene_meaning_plot(
            analysis_id=analysis_id,
            source_video_id=source_video_id,
            scene_id=scene_id,
            scene_start_ms=scene_start_ms,
            scene_end_ms=scene_end_ms,
            instructions=meaning_instructions,
            meaning_events=meaning_events,
        )
        scene_boundary_source = scene.get("scene_boundary_source") or scene.get("source") or "detected"
        overview = _overview(
            transcript=scene_transcript,
            person_count=person_count,
            prop_labels=prop_labels,
            place_labels=place_labels,
            situation_labels=situation_labels,
        )
        nlp_summary = _scene_nlp_summary(
            transcript=scene_transcript,
            person_count=person_count,
            place_labels=place_labels,
            prop_labels=prop_labels,
            items=items,
            meaning_plot=meaning_plot,
            sfl_utterances=scene_sfl_utterances,
            scene_boundary_source=scene_boundary_source,
            overview=overview,
            source_metadata=source_metadata,
            pos_analysis=pos_analysis,
        )
        manual_account = _manual_scene_account_override(scene_manual)
        if manual_account:
            nlp_summary["sentence"] = _sentence(manual_account)
            nlp_summary["prose_sections"]["summary"] = _sentence(manual_account)
            nlp_summary["description"]["what_is_happening"] = _sentence(manual_account)
            nlp_summary["summary_inputs"]["manual_scene_account_override"] = True

        card = {
            "schema": SCENE_CARD_SCHEMA,
            "title": f"Scene Card {scene_index:03d}",
            "display_title": f"Scene Card {scene_index:03d}",
            "scene_id": scene_id,
            "analysis_id": analysis_id,
            "source_video_id": source_video_id,
            "time_interval": {"start_ms": scene_start_ms, "end_ms": scene_end_ms},
            "scene_boundary_source": scene_boundary_source,
            "overview": overview,
            "nlp_scene_summary_sentence": nlp_summary["sentence"],
            "nlp_scene_summary": nlp_summary,
            "mise_en_scene_description": nlp_summary["description"],
            "prose_sections": nlp_summary["prose_sections"],
            "interrogative_schema": nlp_summary["interrogative_schema"],
            "tags": _scene_card_tags(items),
            "said_in_scene": said_in_scene,
            "meaning_plot": meaning_plot,
            "items": items,
            "manual_corrections": [],
            "authority_policy": AUTHORITY_POLICY,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        cards.append(card)

    return {
        "schema": "vaa1.mise_en_scene_scene_cards.v1",
        "title": SCENE_CARD_REPORT_TITLE,
        "artifact_type": "mise_en_scene_scene_card_report",
        "analysis_id": analysis_id,
        "source_video_id": source_video_id,
        "source_metadata_unchanged": source_metadata,
        "mature_evidence_policy": {
            "annotation_corrections_applied": bool(corrections),
            "manual_transcript_entries": len(corrections.get("manual_transcript_entries") or []),
            "manual_visual_annotations": len(corrections.get("manual_visual_annotations") or []),
            "label_overrides": len(corrections.get("label_overrides") or []),
            "text_substitutions": len(corrections.get("text_substitutions") or []),
            "raw_artifacts_preserved": True,
        },
        "scene_cards": cards,
        "authority_policy": AUTHORITY_POLICY,
        "created_at": _now_iso(),
    }


def apply_scene_card_corrections(
    card: Dict[str, Any],
    corrections: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    """Return a resolved card view where manual corrections win.

    Original system items remain in ``items`` and manual changes are added to
    ``resolved_items`` and ``manual_corrections``.
    """

    resolved = deepcopy(card)
    resolved_items = deepcopy(card.get("items") if isinstance(card.get("items"), list) else [])
    manual_corrections: List[Dict[str, Any]] = deepcopy(
        card.get("manual_corrections") if isinstance(card.get("manual_corrections"), list) else []
    )

    for correction in corrections:
        if not isinstance(correction, dict):
            continue
        action = _safe_text(correction.get("action"), "rename")
        target_item_id = _safe_text(correction.get("target_item_id"))
        manual_item = deepcopy(correction)
        manual_item["status"] = "manual"
        manual_item["likelihood"] = "manual"
        manual_item["symbol"] = LIKELIHOOD_SYMBOLS["manual"]
        manual_item["derived_from"] = target_item_id
        manual_corrections.append(manual_item)

        if action == "remove":
            resolved_items = [
                item for item in resolved_items if item.get("item_id") != target_item_id
            ]
            continue

        replacement = None
        for item in resolved_items:
            if item.get("item_id") == target_item_id:
                replacement = deepcopy(item)
                break
        if replacement is None:
            replacement = {
                "item_id": correction.get("item_id") or f"{card.get('scene_id')}:manual:{len(manual_corrections):03d}",
                "category": correction.get("category") or "themes",
                "evidence_refs": correction.get("evidence_refs") or [],
                "navigation": correction.get("navigation") or {},
                "source": "manual",
            }
        replacement.update(
            {
                "label": _safe_text(correction.get("label"), _safe_text(replacement.get("label"))),
                "likelihood": "manual",
                "symbol": LIKELIHOOD_SYMBOLS["manual"],
                "status": "manual",
                "manual_note": correction.get("note"),
                "derived_from": target_item_id or replacement.get("derived_from"),
            }
        )
        resolved_items = [
            item for item in resolved_items if item.get("item_id") != target_item_id
        ]
        resolved_items.append(replacement)

    resolved["manual_corrections"] = manual_corrections
    resolved["resolved_items"] = resolved_items
    resolved["resolved_tags"] = _scene_card_tags(resolved_items)
    resolved["updated_at"] = _now_iso()
    return resolved


def build_source_extraction_metadata_summary(
    scene_card_bundle: Dict[str, Any],
    *,
    source_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    source_metadata_copy = deepcopy(
        source_metadata
        if source_metadata is not None
        else scene_card_bundle.get("source_metadata_unchanged", {})
    )
    facets: Dict[str, List[Dict[str, Any]]] = {facet: [] for facet in FACETS}
    supporting_scenes: List[str] = []

    for card in scene_card_bundle.get("scene_cards", []):
        if not isinstance(card, dict):
            continue
        scene_id = _safe_text(card.get("scene_id"))
        if scene_id:
            supporting_scenes.append(scene_id)
        for item in card.get("resolved_items") or card.get("items") or []:
            if not isinstance(item, dict):
                continue
            category = str(item.get("category") or "")
            if category not in facets:
                continue
            label = _safe_text(item.get("label"))
            if not label:
                continue
            if any(existing.get("label") == label for existing in facets[category]):
                continue
            facets[category].append(
                {
                    "label": label,
                    "likelihood": item.get("likelihood"),
                    "symbol": item.get("symbol"),
                    "supporting_scene": scene_id,
                    "evidence_refs": item.get("evidence_refs") or [],
                    "origin": item.get("status") or "system",
                }
            )

    dominant = []
    for facet in ("genre_form", "subject_domain", "places", "speech", "themes", "props"):
        for item in facets.get(facet, [])[:3]:
            label = _safe_text(item.get("label"))
            if not label or len(label) > 80 or "{" in label:
                continue
            if label not in dominant:
                dominant.append(label)

    summary = "VAA1 extracted scene cards are available for this media item."
    if dominant:
        summary = "Scene cards highlight " + ", ".join(dominant[:6]) + "."

    return {
        "schema": SOURCE_EXTRACTION_METADATA_SUMMARY_SCHEMA,
        "title": SOURCE_EXTRACTION_METADATA_SUMMARY_TITLE,
        "artifact_type": "scene_card_source_extraction_metadata_summary",
        "status": "system_generated",
        "analysis_id": scene_card_bundle.get("analysis_id"),
        "source_video_id": scene_card_bundle.get("source_video_id"),
        "source_metadata_unchanged": source_metadata_copy,
        "derived_from": [
            "scene_cards",
            "transcript",
            "objects",
            "ocr",
            "expressions",
            "audio_prosody",
            "metadata",
        ],
        "summary": summary,
        "facets": facets,
        "supporting_scenes": supporting_scenes,
        "authority_policy": AUTHORITY_POLICY,
        "created_at": _now_iso(),
    }


def write_mise_en_scene_scene_cards(
    analysis_id: str,
    status: Dict[str, Any],
    output_path: str | Path,
    *,
    source_video_id: Optional[str] = None,
) -> Dict[str, Any]:
    bundle = build_mise_en_scene_scene_cards(
        analysis_id,
        status,
        source_video_id=source_video_id,
    )
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    return bundle


def write_source_extraction_metadata_summary(
    scene_card_bundle: Dict[str, Any],
    output_path: str | Path,
    *,
    source_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    summary = build_source_extraction_metadata_summary(
        scene_card_bundle,
        source_metadata=source_metadata,
    )
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary
