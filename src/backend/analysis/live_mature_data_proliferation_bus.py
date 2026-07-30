"""
Live mature-data proliferation bus audit.

This module intentionally audits proliferation readiness without promoting raw
or candidate evidence. Promotion still belongs to the governed decision ledger.
"""
from __future__ import annotations

from datetime import datetime, timezone
import importlib.util
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

try:
    from src.backend.analysis.multimodal_pattern_scanner_agent import (
        scan_constellation_for_candidate,
    )
except ModuleNotFoundError:
    _agent_path = Path(__file__).with_name("multimodal_pattern_scanner_agent.py")
    _agent_spec = importlib.util.spec_from_file_location(
        "multimodal_pattern_scanner_agent",
        _agent_path,
    )
    _agent_module = importlib.util.module_from_spec(_agent_spec)
    assert _agent_spec and _agent_spec.loader
    _agent_spec.loader.exec_module(_agent_module)
    scan_constellation_for_candidate = _agent_module.scan_constellation_for_candidate


SCHEMA = "vaa1.live_mature_data_proliferation_audit.v1"

# Object tracking remains raw traceback substrate until a configured tracker has
# passed identity-continuity, scene-boundary, and cross-character bleed tests.
# Mature review operates on individual, source-timed detections in the interim.
TRACK_DERIVED_PROMOTION_ENABLED = False

PERSON_HINTS = {
    "person",
    "people",
    "human",
    "face",
    "character",
    "identity",
    "identification",
    "speaker",
    "presenter",
    "reporter",
    "anchor",
    "bond",
    "james",
    "sari",
    "felix",
}

STOPWORDS = {
    "the",
    "and",
    "with",
    "from",
    "that",
    "this",
    "manual",
    "visual",
    "annotation",
    "sample",
    "source",
    "audio",
    "video",
    "track",
    "object",
    "detection",
    "unknown",
}

SOURCE_METADATA_MATURE_FIELDS = (
    "title",
    "persons",
    "character_roles",
    "organizations",
    "source_context",
    "description",
    "situation_event",
    "location_country",
    "location_city",
    "location_place",
    "location_room",
    "time_moment",
    "time_year",
    "genre",
    "genre_subtype",
    "situational_genre",
    "situational_subtype",
)

NEWS_GENRE_TOKENS = {"news", "current", "affairs", "journalism", "broadcast"}
REJECTION_DECISIONS = {"canceled", "cancelled", "rejected", "drop", "dropped", "blocked"}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def as_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in ("items", "objects", "tracked_objects", "samples", "segments"):
            items = value.get(key)
            if isinstance(items, list):
                return items
    return []


def as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def confidence_percent(value: Any, fallback: float) -> int:
    numeric = to_float(value)
    if numeric is None:
        numeric = fallback
    if numeric <= 1:
        numeric *= 100
    return max(0, min(100, int(round(numeric))))


def to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def first_float(item: Dict[str, Any], keys: Sequence[str]) -> Optional[float]:
    for key in keys:
        value = to_float(item.get(key))
        if value is not None:
            return value
    interval = item.get("interval") if isinstance(item.get("interval"), dict) else {}
    for key in keys:
        value = to_float(interval.get(key))
        if value is not None:
            return value
    return None


def time_range(item: Dict[str, Any]) -> Dict[str, Optional[float]]:
    start = first_float(
        item,
        (
            "start",
            "start_seconds",
            "timestamp_seconds",
            "timestamp",
            "time_start",
            "frame_time",
        ),
    )
    end = first_float(
        item,
        ("end", "end_seconds", "time_end", "timestamp_end", "timestamp_seconds", "timestamp"),
    )
    if end is None and start is not None:
        duration = to_float(item.get("duration_seconds") or item.get("duration"))
        end = start + duration if duration is not None else start
    return {"start": start, "end": end}


def read_json_path(path: Any) -> Dict[str, Any]:
    text = safe_text(path)
    if not text:
        return {}
    try:
        file_path = Path(text)
        if file_path.exists() and file_path.is_file():
            payload = json.loads(file_path.read_text(encoding="utf-8"))
            return payload if isinstance(payload, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}
    return {}


def tokens_for(*values: Any) -> Set[str]:
    tokens: Set[str] = set()
    for value in values:
        for token in re.findall(r"[a-z0-9]+", str(value or "").lower()):
            if len(token) >= 3 and token not in STOPWORDS:
                tokens.add(token)
    return tokens


def label_from_manual(item: Dict[str, Any]) -> str:
    metadata = as_dict(item.get("metadata_correlation"))
    return (
        safe_text(item.get("identity_affirmation"))
        or safe_text(item.get("custom_label"))
        or safe_text(item.get("label"))
        or safe_text(metadata.get("target_label"))
        or "Manual visual annotation"
    )


def category_from_manual(item: Dict[str, Any]) -> str:
    metadata = as_dict(item.get("metadata_correlation"))
    return (
        safe_text(item.get("category"))
        or safe_text(item.get("subcategory"))
        or safe_text(metadata.get("target_type"))
        or "Manual visual annotation"
    )


def collect_manual_mature_seeds(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    corrections = as_dict(status.get("annotation_corrections"))
    seeds: List[Dict[str, Any]] = []
    for index, item in enumerate(as_list(corrections.get("manual_visual_annotations"))):
        if not isinstance(item, dict):
            continue
        label = label_from_manual(item)
        category = category_from_manual(item)
        item_range = time_range(item)
        seed_id = safe_text(item.get("id"), f"manual_visual:{index}")
        seeds.append(
            {
                "seed_id": seed_id,
                "source_panel": "manual_visual_annotations",
                "authority": "manual_confirmation",
                "label": label,
                "category": category,
                "time": item_range,
                "teaches_regime": bool(item.get("teaches_regime")),
                "source_ref": seed_id,
                "tokens": sorted(tokens_for(label, category)),
            }
        )
    return seeds


def collect_source_sample_seeds(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    seeds: List[Dict[str, Any]] = []
    for index, item in enumerate(as_list(status.get("source_samples"))):
        if not isinstance(item, dict):
            continue
        label = (
            safe_text(item.get("label"))
            or safe_text(item.get("purpose"))
            or safe_text(item.get("sample_type"))
            or "Source sample"
        )
        sample_id = safe_text(item.get("sample_id"), f"source_sample:{index}")
        sample_type = safe_text(item.get("sample_type"), "source_sample")
        seeds.append(
            {
                "seed_id": sample_id,
                "source_panel": "source_samples",
                "authority": "source_sample",
                "label": label,
                "category": sample_type,
                "time": time_range(item),
                "teaches_regime": True,
                "source_ref": sample_id,
                "has_visual_sample": isinstance(item.get("visual"), dict),
                "has_audio_sample": isinstance(item.get("audio"), dict),
                "tokens": sorted(tokens_for(label, sample_type)),
            }
        )
    return seeds


def collect_proliferation_decision_seeds(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    corrections = as_dict(status.get("annotation_corrections"))
    seeds: List[Dict[str, Any]] = []
    for index, item in enumerate(as_list(corrections.get("proliferation_decisions"))):
        if not isinstance(item, dict):
            continue
        if safe_text(item.get("decision")).lower() != "confirmed":
            continue
        label = (
            safe_text(item.get("label"))
            or safe_text(item.get("target_label"))
            or safe_text(item.get("source_label"))
            or "Confirmed proliferation decision"
        )
        decision_id = safe_text(item.get("id"), f"proliferation_decision:{index}")
        seeds.append(
            {
                "seed_id": decision_id,
                "source_panel": "proliferation_decisions",
                "authority": "confirmed_proliferation_decision",
                "label": label,
                "category": safe_text(item.get("category"), "Decision"),
                "time": time_range(item),
                "teaches_regime": True,
                "source_ref": decision_id,
                "tokens": sorted(tokens_for(label, item.get("category"))),
            }
        )
    return seeds


def scene_card_payload(status: Dict[str, Any]) -> Dict[str, Any]:
    payload = as_dict(status.get("mise_en_scene_scene_cards"))
    if as_list(payload.get("scene_cards")):
        return payload
    output_path = safe_text(payload.get("output_json_path"))
    if output_path:
        loaded = read_json_path(output_path)
        if loaded:
            return loaded
    internal_artifacts = as_dict(status.get("internal_artifacts"))
    output_files = as_dict(status.get("output_files"))
    for path in (
        internal_artifacts.get("mise_en_scene_scene_cards"),
        output_files.get("mise_en_scene_scene_cards"),
    ):
        loaded = read_json_path(path)
        if loaded:
            return loaded
    return payload


def collect_content_derived_mature_observations(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    seeds: List[Dict[str, Any]] = []
    metadata = as_dict(status.get("source_media_metadata"))
    annotations = as_dict(metadata.get("user_annotations") or metadata.get("annotations"))
    field_confidences = as_dict(metadata.get("field_confidences"))

    for key in SOURCE_METADATA_MATURE_FIELDS:
        value = annotations.get(key) if key in annotations else metadata.get(key)
        if isinstance(value, list):
            values = [safe_text(item) for item in value if safe_text(item)]
        else:
            values = [safe_text(value)] if safe_text(value) else []
        for index, label in enumerate(values):
            confidence = confidence_percent(field_confidences.get(key), 0.86)
            user_confirmed = key in annotations and bool(annotations.get(key))
            seeds.append(
                {
                    "seed_id": f"source_metadata:{key}:{index}",
                    "source_panel": "source_media_metadata",
                    "authority": "user_confirmed_source_metadata" if user_confirmed else "content_derived_mature_observation",
                    "authority_class": "user_confirmed_source_metadata" if user_confirmed else "content_derived_mature_observation",
                    "label": label,
                    "category": f"source_metadata:{key}",
                    "time": {"start": None, "end": None},
                    "confidence_percent": confidence,
                    "confidence": round(confidence / 100, 2),
                    "maturity_projection_state": "user_confirmed" if user_confirmed else "mature_with_confidence_rating",
                    "teaches_regime": True,
                    "source_ref": f"source_media_metadata:{key}",
                    "tokens": sorted(tokens_for(label, key)),
                }
            )

    cards = as_list(scene_card_payload(status).get("scene_cards"))
    for card_index, card in enumerate(cards):
        if not isinstance(card, dict):
            continue
        card_range = time_range(card)
        for item_index, item in enumerate(as_list(card.get("items"))):
            if not isinstance(item, dict):
                continue
            label = safe_text(item.get("label"))
            if not label:
                continue
            symbol = safe_text(item.get("symbol"))
            fallback_confidence = 0.92 if symbol in {"✓", "●"} else 0.74 if symbol == "◐" else 0.58
            confidence = confidence_percent(item.get("confidence"), fallback_confidence)
            seeds.append(
                {
                    "seed_id": f"scene_card:{card_index}:item:{item_index}",
                    "source_panel": "mise_en_scene_scene_cards",
                    "authority": "content_derived_mature_observation",
                    "authority_class": "content_derived_mature_observation",
                    "label": label,
                    "category": safe_text(item.get("category"), "scene_card_item"),
                    "time": card_range,
                    "confidence_percent": confidence,
                    "confidence": round(confidence / 100, 2),
                    "maturity_projection_state": "mature_with_confidence_rating",
                    "teaches_regime": True,
                    "source_ref": safe_text(card.get("scene_id"), f"scene_card:{card_index}"),
                    "tokens": sorted(tokens_for(label, item.get("category"))),
                }
            )
    return seeds


def collect_mature_seeds(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    return (
        collect_manual_mature_seeds(status)
        + collect_source_sample_seeds(status)
        + collect_proliferation_decision_seeds(status)
        + collect_content_derived_mature_observations(status)
        + collect_genre_rule_mature_seeds(status)
    )


def visual_tracked_objects(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = as_dict(status.get("results"))
    visual = as_dict(results.get("visual_analysis"))
    items = as_list(visual.get("tracked_objects"))
    if not items:
        items = as_list(status.get("tracked_objects"))
    return [item for item in items if isinstance(item, dict)]


def ocr_results(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = as_dict(status.get("results"))
    visual = as_dict(results.get("visual_analysis"))
    return [
        item
        for item in as_list(visual.get("ocr_results") or status.get("ocr_results"))
        if isinstance(item, dict)
    ]


def label_from_track(item: Dict[str, Any], index: int) -> str:
    return (
        safe_text(item.get("display_label"))
        or safe_text(item.get("label"))
        or safe_text(item.get("class_name"))
        or safe_text(item.get("class"))
        or safe_text(item.get("name"))
        or f"track {item.get('track_id', index)}"
    )


def track_candidate(
    item: Dict[str, Any],
    index: int,
    status: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    raw_label = label_from_track(item, index)
    source_ref = safe_text(item.get("track_id"), f"tracked_object:{index}")
    category = safe_text(item.get("category") or item.get("class_name") or item.get("class"), "Object")
    manual_identity = canonical_manual_identity_for_track(status or {}, item, index)
    label = safe_text(manual_identity.get("label"), raw_label)
    candidate = {
        "candidate_id": f"tracked_object:{source_ref}",
        "source_panel": "objects_panel",
        "source_kind": "tracked_object",
        "source_ref": source_ref,
        "label": label,
        "detector_label": raw_label,
        "category": category,
        "time": time_range(item),
        "bbox": normalized_bbox_from_track(item),
        "confidence": item.get("confidence"),
        "tokens": sorted(tokens_for(label, category)),
    }
    if manual_identity:
        candidate.update(
            {
                "canonical_identity_label": manual_identity.get("label"),
                "canonical_identity_status": "manual_confirmed",
                "manual_identity_anchor_ref": manual_identity.get("annotation_ref"),
                "manual_identity_match_basis": manual_identity.get("match_basis"),
                "manual_identity_bbox": manual_identity.get("bbox"),
                "promotion_required": False,
            }
        )
    return candidate


def normalized_bbox_from_track(item: Dict[str, Any]) -> Optional[Dict[str, float]]:
    bbox = item.get("bbox") if isinstance(item.get("bbox"), dict) else {}
    x1 = to_float(bbox.get("x1") if bbox else item.get("bbox_x1"))
    y1 = to_float(bbox.get("y1") if bbox else item.get("bbox_y1"))
    x2 = to_float(bbox.get("x2") if bbox else item.get("bbox_x2"))
    y2 = to_float(bbox.get("y2") if bbox else item.get("bbox_y2"))
    x = to_float(bbox.get("x") if bbox else item.get("x"))
    y = to_float(bbox.get("y") if bbox else item.get("y"))
    width = to_float(bbox.get("w") if bbox else item.get("w"))
    if width is None:
        width = to_float(bbox.get("width") if bbox else item.get("width"))
    height = to_float(bbox.get("h") if bbox else item.get("h"))
    if height is None:
        height = to_float(bbox.get("height") if bbox else item.get("height"))

    if x is None and x1 is not None:
        x = x1
    if y is None and y1 is not None:
        y = y1
    if width is None and x1 is not None and x2 is not None:
        width = x2 - x1
    if height is None and y1 is not None and y2 is not None:
        height = y2 - y1
    if x is None or y is None or width is None or height is None:
        return None

    width = abs(width)
    height = abs(height)
    if width <= 0 or height <= 0:
        return None

    if max(x, y, width, height) > 1.5:
        x = x / 1920.0
        width = width / 1920.0
        y = y / 1080.0
        height = height / 1080.0

    return {
        "x": max(0.0, min(1.0, x)),
        "y": max(0.0, min(1.0, y)),
        "w": max(0.0, min(1.0, width)),
        "h": max(0.0, min(1.0, height)),
    }


def central_presence_score(bbox: Optional[Dict[str, float]]) -> float:
    if not bbox:
        return 0.0
    center_x = bbox["x"] + bbox["w"] / 2.0
    center_y = bbox["y"] + bbox["h"] / 2.0
    center_distance = ((center_x - 0.5) ** 2 + (center_y - 0.48) ** 2) ** 0.5
    area = bbox["w"] * bbox["h"]
    centrality = max(0.0, 1.0 - center_distance / 0.55)
    return round(min(1.0, centrality * 0.55 + min(area / 0.20, 1.0) * 0.45), 3)


def media_duration_seconds(status: Dict[str, Any]) -> Optional[float]:
    for source in (
        status,
        as_dict(status.get("metadata")),
        as_dict(status.get("source_media_metadata")),
        as_dict(status.get("source_extraction_metadata_summary")),
    ):
        for key in (
            "duration_seconds",
            "media_duration_seconds",
            "video_duration_seconds",
            "duration",
        ):
            value = to_float(source.get(key))
            if value is not None and value > 0:
                return value
    return None


def manually_confirmed_track_ids(status: Dict[str, Any]) -> Set[str]:
    corrections = as_dict(status.get("annotation_corrections"))
    track_ids: Set[str] = set()
    for item in as_list(corrections.get("manual_visual_annotations")):
        if not isinstance(item, dict):
            continue
        metadata = as_dict(item.get("metadata_correlation"))
        if safe_text(item.get("category")) not in {"Identification", "Role"}:
            continue
        target_id = safe_text(metadata.get("target_id"))
        if target_id:
            track_ids.add(target_id)
    return track_ids


def identity_label_from_manual(item: Dict[str, Any]) -> str:
    label = (
        safe_text(item.get("identity_affirmation"))
        or safe_text(item.get("role_affirmation"))
        or safe_text(item.get("custom_label"))
        or safe_text(item.get("label"))
    )
    if not label:
        return ""
    lowered = label.lower().strip()
    if lowered.startswith("confirm ") or lowered in {"person", "unknown", "unknown person"}:
        return ""
    return label


def canonical_identity_key(label: str) -> str:
    label = canonical_identity_label(label)
    return " ".join(
        token
        for token in re.findall(r"[a-z0-9]+", label.lower())
        if token not in STOPWORDS
    )


def canonical_identity_label(label: str) -> str:
    """Collapse governed profile prose to the stable Narrative Agent name."""
    value = safe_text(label).strip()
    if not value:
        return ""
    value = re.split(r"\s*\(|\s*:\s*", value, maxsplit=1)[0].strip()
    return value or safe_text(label).strip()


def bbox_from_manual_annotation(item: Dict[str, Any]) -> Optional[Dict[str, float]]:
    metadata = as_dict(item.get("metadata_correlation"))
    bbox = as_dict(
        item.get("bbox")
        or item.get("roi")
        or item.get("coordinates")
        or metadata.get("bbox")
        or metadata.get("roi")
    )
    x = to_float(bbox.get("x") or bbox.get("left") or item.get("x"))
    y = to_float(bbox.get("y") or bbox.get("top") or item.get("y"))
    width = to_float(
        bbox.get("w")
        or bbox.get("width")
        or item.get("w")
        or item.get("width")
    )
    height = to_float(
        bbox.get("h")
        or bbox.get("height")
        or item.get("h")
        or item.get("height")
    )
    x1 = to_float(bbox.get("x1") or item.get("bbox_x1"))
    y1 = to_float(bbox.get("y1") or item.get("bbox_y1"))
    x2 = to_float(bbox.get("x2") or item.get("bbox_x2"))
    y2 = to_float(bbox.get("y2") or item.get("bbox_y2"))
    if x is None and x1 is not None:
        x = x1
    if y is None and y1 is not None:
        y = y1
    if width is None and x1 is not None and x2 is not None:
        width = x2 - x1
    if height is None and y1 is not None and y2 is not None:
        height = y2 - y1
    if x is None or y is None or width is None or height is None:
        return None
    width = abs(width)
    height = abs(height)
    if width <= 0 or height <= 0:
        return None
    if max(x, y, width, height) > 1.5:
        x = x / 1920.0
        width = width / 1920.0
        y = y / 1080.0
        height = height / 1080.0
    return {
        "x": max(0.0, min(1.0, x)),
        "y": max(0.0, min(1.0, y)),
        "w": max(0.0, min(1.0, width)),
        "h": max(0.0, min(1.0, height)),
    }


def bbox_iou(left: Optional[Dict[str, float]], right: Optional[Dict[str, float]]) -> float:
    if not left or not right:
        return 0.0
    left_x2 = left["x"] + left["w"]
    left_y2 = left["y"] + left["h"]
    right_x2 = right["x"] + right["w"]
    right_y2 = right["y"] + right["h"]
    intersection_w = max(0.0, min(left_x2, right_x2) - max(left["x"], right["x"]))
    intersection_h = max(0.0, min(left_y2, right_y2) - max(left["y"], right["y"]))
    intersection = intersection_w * intersection_h
    union = left["w"] * left["h"] + right["w"] * right["h"] - intersection
    return intersection / union if union > 0 else 0.0


def time_ranges_overlap(
    left: Dict[str, Any],
    right: Dict[str, Any],
    tolerance_seconds: float = 0.25,
) -> bool:
    left_start = to_float(left.get("start"))
    right_start = to_float(right.get("start"))
    if left_start is None or right_start is None:
        return False
    left_end = to_float(left.get("end"))
    right_end = to_float(right.get("end"))
    left_end = left_start if left_end is None else left_end
    right_end = right_start if right_end is None else right_end
    return left_start <= right_end + tolerance_seconds and right_start <= left_end + tolerance_seconds


def canonical_manual_identity_for_track(
    status: Dict[str, Any],
    track: Dict[str, Any],
    index: int,
) -> Dict[str, Any]:
    """Resolve a track to canonical manual identity without trusting detector labels.

    Explicit track references win. When panel-local IDs differ, a time-overlapping
    BBox with meaningful spatial overlap can establish the same source occurrence.
    Ambiguous spatial matches are deliberately rejected.
    """
    corrections = as_dict(status.get("annotation_corrections"))
    source_ref = safe_text(track.get("track_id"), f"tracked_object:{index}")
    track_refs = {
        source_ref,
        f"tracked_object:{source_ref}",
        safe_text(track.get("id")),
        safe_text(track.get("object_id")),
    } - {""}
    track_time = time_range(track)
    track_bbox = normalized_bbox_from_track(track)
    matches: List[Dict[str, Any]] = []

    for annotation_index, item in enumerate(as_list(corrections.get("manual_visual_annotations"))):
        if not isinstance(item, dict):
            continue
        label = identity_label_from_manual(item)
        if not label:
            continue
        metadata = as_dict(item.get("metadata_correlation"))
        annotation_refs = {
            safe_text(metadata.get("target_id")),
            safe_text(metadata.get("geometry_track_id")),
            safe_text(metadata.get("track_id")),
            safe_text(item.get("track_id")),
            safe_text(item.get("target_id")),
        } - {""}
        for reference in (
            safe_text(item.get("id")),
            safe_text(metadata.get("target_id")),
            safe_text(as_dict(metadata.get("manual_confirmation_event")).get("bbox_roi_id")),
        ):
            object_match = re.search(r"(?:^|:)indication:object:([^:]+)", reference)
            if object_match:
                annotation_refs.add(object_match.group(1))
        explicit = bool(track_refs & annotation_refs)
        manual_bbox = bbox_from_manual_annotation(item)
        overlap = bbox_iou(track_bbox, manual_bbox)
        spatial = time_ranges_overlap(track_time, time_range(item)) and overlap >= 0.35
        if not explicit and not spatial:
            continue
        matches.append(
            {
                "label": label,
                "annotation_ref": safe_text(item.get("id"), f"manual_identity:{annotation_index}"),
                "match_basis": "explicit_track_reference" if explicit else "source_time_bbox_overlap",
                "bbox": manual_bbox,
                "iou": round(overlap, 4),
            }
        )

    identity_keys = {canonical_identity_key(safe_text(match.get("label"))) for match in matches}
    identity_keys.discard("")
    if len(identity_keys) != 1:
        return {}
    return max(
        matches,
        key=lambda match: (
            match.get("match_basis") == "explicit_track_reference",
            float(match.get("iou") or 0.0),
        ),
    )


def transcript_segments(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = as_dict(status.get("results"))
    audio = as_dict(results.get("audio_analysis"))
    candidates = (
        status.get("transcript_segments")
        or status.get("transcript")
        or audio.get("transcript_segments")
        or audio.get("segments")
    )
    return [item for item in as_list(candidates) if isinstance(item, dict)]


def overlapping_transcript_audio_slots(
    status: Dict[str, Any],
    label: str,
    visual_slots: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    slots: List[Dict[str, Any]] = []
    label_tokens = tokens_for(label)
    for visual_index, visual in enumerate(visual_slots[:6]):
        visual_time = as_dict(visual.get("time"))
        visual_start = to_float(visual_time.get("start"))
        visual_end = to_float(visual_time.get("end"))
        if visual_start is None:
            continue
        if visual_end is None or visual_end < visual_start:
            visual_end = visual_start
        window_start = max(0.0, visual_start - 1.0)
        window_end = visual_end + 1.0
        best_segment: Optional[Dict[str, Any]] = None
        for segment in transcript_segments(status):
            segment_time = time_range(segment)
            segment_start = to_float(segment_time.get("start"))
            segment_end = to_float(segment_time.get("end"))
            if segment_start is None:
                continue
            if segment_end is None:
                segment_end = segment_start
            if segment_end < window_start or segment_start > window_end:
                continue
            if not best_segment:
                best_segment = segment
            segment_tokens = tokens_for(segment.get("text"), segment.get("speaker"), segment.get("speaker_label"))
            if label_tokens & segment_tokens:
                best_segment = segment
                break
        if best_segment:
            segment_time = time_range(best_segment)
            slots.append(
                {
                    "sample_id": f"audio_window:{visual.get('source_ref')}:{visual_index}",
                    "sample_type": "audio_identity_window",
                    "source_ref": safe_text(best_segment.get("id"), f"transcript:{visual_index}"),
                    "time": segment_time,
                    "sample_state": "transcript_audio_window_available",
                    "match_basis": ["voice_similarity", "transcript_speaker_link"],
                    "text_preview": safe_text(best_segment.get("text"))[:160],
                }
            )
        else:
            slots.append(
                {
                    "sample_id": f"audio_window:proposed:{visual.get('source_ref')}:{visual_index}",
                    "sample_type": "audio_identity_window",
                    "source_ref": visual.get("source_ref"),
                    "time": {"start": window_start, "end": window_end},
                    "sample_state": "proposed_for_audio_source_sampler",
                    "match_basis": ["voice_similarity"],
                    "text_preview": "",
                }
            )
    return slots


def source_sample_slots_for_identity(
    status: Dict[str, Any],
    label: str,
) -> List[Dict[str, Any]]:
    label_tokens = tokens_for(label)
    slots: List[Dict[str, Any]] = []
    for index, sample in enumerate(as_list(status.get("source_samples"))):
        if not isinstance(sample, dict):
            continue
        sample_tokens = tokens_for(sample.get("label"), sample.get("purpose"), sample.get("sample_type"))
        if label_tokens and sample_tokens and not label_tokens & sample_tokens:
            continue
        slots.append(
            {
                "sample_id": safe_text(sample.get("sample_id"), f"source_sample:{index}"),
                "sample_type": safe_text(sample.get("sample_type"), "source_sample"),
                "source_ref": safe_text(sample.get("sample_id"), f"source_sample:{index}"),
                "time": time_range(sample),
                "has_visual_sample": isinstance(sample.get("visual"), dict),
                "has_audio_sample": isinstance(sample.get("audio"), dict),
                "sample_state": "attached_source_sample",
            }
        )
    return slots


def collect_narrative_agent_identity_memories(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    corrections = as_dict(status.get("annotation_corrections"))
    groups: Dict[str, Dict[str, Any]] = {}
    for index, item in enumerate(as_list(corrections.get("manual_visual_annotations"))):
        if not isinstance(item, dict):
            continue
        label = identity_label_from_manual(item)
        if not label:
            continue
        category = safe_text(item.get("category"))
        if category not in {"Identification", "Role", "Audio"} and not item.get("identity_affirmation"):
            continue
        canonical_label = canonical_identity_label(label)
        key = canonical_identity_key(canonical_label)
        if not key:
            continue
        item_range = time_range(item)
        source_ref = safe_text(item.get("id"), f"manual_identity:{index}")
        group = groups.setdefault(
            key,
            {
                "identity_key": key,
                "canonical_label": canonical_label,
                "aliases": set(),
                "manual_anchor_refs": [],
                "visual_sample_slots": [],
                "audio_sample_slots": [],
            },
        )
        group["aliases"].add(label)
        fallback_label = safe_text(item.get("label") or item.get("custom_label"))
        if fallback_label:
            group["aliases"].add(fallback_label)
        group["manual_anchor_refs"].append(source_ref)
        if category == "Audio":
            group["audio_sample_slots"].append(
                {
                    "sample_id": f"audio_identity:{source_ref}",
                    "sample_type": "confirmed_narrative_agent_audio_anchor",
                    "source_ref": source_ref,
                    "time": item_range,
                    "sample_state": "manual_audio_anchor_available",
                    "match_basis": [
                        "manual_agent_assertion",
                        "voice_similarity",
                        "speaker_diarization",
                    ],
                    "transcript_text": safe_text(item.get("open_note")),
                }
            )
        else:
            group["visual_sample_slots"].append(
                {
                    "sample_id": f"visual_identity:{source_ref}",
                    "sample_type": "visual_identity_appearance_anchor",
                    "source_ref": source_ref,
                    "time": item_range,
                    "bbox": bbox_from_manual_annotation(item),
                    "sample_state": "manual_anchor_available",
                    "match_basis": ["manual_agent_assertion", "appearance_similarity"],
                    "appearance_variation_role": "one_of_multiple_possible_costume_or_scene_looks",
                }
            )

    memories: List[Dict[str, Any]] = []
    analysis_id = safe_text(status.get("analysis_id"), "unknown-analysis")
    for key, group in groups.items():
        label = safe_text(group.get("canonical_label"), key)
        visual_slots = group["visual_sample_slots"]
        audio_slots = list(group.get("audio_sample_slots") or []) + [
            sample
            for sample in source_sample_slots_for_identity(status, label)
            if sample.get("has_audio_sample")
        ] + overlapping_transcript_audio_slots(status, label, visual_slots)
        source_sample_slots = source_sample_slots_for_identity(status, label)
        audiovisual_slots = [
            {
                "sample_id": f"audiovisual_identity:{slot.get('sample_id')}",
                "sample_type": "audiovisual_identity_memory",
                "visual_sample_ref": slot.get("sample_id"),
                "audio_sample_ref": audio_slots[index % len(audio_slots)].get("sample_id")
                if audio_slots
                else None,
                "time": slot.get("time"),
                "bbox": slot.get("bbox"),
                "sample_state": "audiovisual_ready" if audio_slots else "audio_sample_needed",
                "match_basis": ["appearance_similarity", "voice_similarity", "manual_agent_assertion"],
            }
            for index, slot in enumerate(visual_slots[:6])
        ]
        has_visual_basis = len(visual_slots) >= 2
        has_confirmed_audio_basis = any(
            safe_text(slot.get("sample_state")) in {
                "attached_source_sample",
                "transcript_audio_window_available",
                "manual_audio_anchor_available",
            }
            for slot in audio_slots
            if isinstance(slot, dict)
        )
        meta_anchor_ready = (
            len(group["manual_anchor_refs"]) >= 2
            and has_visual_basis
            and has_confirmed_audio_basis
        )
        memories.append(
            {
                "memory_id": f"narrative_agent_identity_memory:{analysis_id}:{key}",
                "analysis_id": analysis_id,
                "agent_id": key,
                "canonical_label": label,
                "aliases": sorted(group["aliases"]),
                "authority": "manual_narrative_agent_confirmation",
                "maturity_state": "identity_memory_governed_by_manual_anchors",
                "manual_anchor_count": len(group["manual_anchor_refs"]),
                "manual_anchor_refs": group["manual_anchor_refs"],
                "visual_sample_slots": visual_slots[:12],
                "audio_sample_slots": audio_slots[:12],
                "audiovisual_sample_slots": audiovisual_slots[:12],
                "source_sample_slots": source_sample_slots[:12],
                "meta_anchor": {
                    "schema": "vaa1.narrative_agent_meta_anchor.v1",
                    "anchor_id": f"narrative_agent_meta_anchor:{analysis_id}:{key}",
                    "canonical_identity_key": key,
                    "canonical_label": label,
                    "aliases": sorted(group["aliases"]),
                    "authority": "manual_narrative_agent_confirmation",
                    "visual_anchor_count": len(visual_slots),
                    "confirmed_audio_anchor_count": len(
                        [
                            slot
                            for slot in audio_slots
                            if isinstance(slot, dict)
                            and safe_text(slot.get("sample_state"))
                            in {
                                "attached_source_sample",
                                "transcript_audio_window_available",
                                "manual_audio_anchor_available",
                            }
                        ]
                    ),
                    "audiovisual_anchor_count": len(
                        [
                            slot
                            for slot in audiovisual_slots
                            if slot.get("sample_state") == "audiovisual_ready"
                        ]
                    ),
                    "automatic_confirmation_ready": meta_anchor_ready,
                    "required_independent_modalities": 2,
                    "required_occurrence_guards": [
                        "source_timed_candidate",
                        "visual_similarity_threshold_met",
                        "voice_or_speaker_link_threshold_met",
                        "no_competing_identity_within_margin",
                        "no_negative_evidence",
                        "manual_correction_wins",
                    ],
                    "proliferation_scope": "source_occurrence_only",
                    "track_id_is_not_identity": True,
                },
                "sample_policy": {
                    "audiovisual_sample_required": True,
                    "multiple_visual_samples_required": True,
                    "minimum_visual_samples_per_central_character": 2,
                    "appearance_variation_reason": (
                        "Central characters can change clothing, lighting, scale, and scene context; "
                        "the bus should retain multiple manual visual anchors rather than one global look."
                    ),
                    "audio_window_required_for_voice_continuity": True,
                },
                "constellational_matching_policy": {
                    "allowed_match_basis": [
                        "manual_agent_assertion",
                        "appearance_similarity",
                        "voice_similarity",
                        "transcript_speaker_link",
                        "role_relation_context",
                        "scene_cooccurrence",
                        "object_association",
                        "negative_evidence",
                    ],
                    "manual_correction_wins": True,
                    "track_id_is_not_global_identity": True,
                    "analysis_scoped": True,
                    "candidate_requires_review_when_not_source_anchored": True,
                    "automatic_confirmation_allowed_when_meta_anchor_ready": True,
                    "automatic_confirmation_is_occurrence_scoped": True,
                },
                "proliferates_to": [
                    "NarrativeAgentPanel",
                    "BBox/ROI",
                    "MeaningNetwork",
                    "MasterSchema",
                    "DataMaturation",
                    "ContentSearch",
                ],
            }
        )
    return sorted(memories, key=lambda item: safe_text(item.get("canonical_label")).lower())


def build_identity_continuity_candidates(
    status: Dict[str, Any],
    memories: Sequence[Dict[str, Any]],
    confirmation_needs: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    if not memories:
        return candidates
    for need_index, need in enumerate(confirmation_needs):
        need_time = as_dict(need.get("candidate_time"))
        need_start = to_float(need_time.get("start"))
        source_ref = safe_text(need.get("source_ref"), f"need:{need_index}")
        for memory in memories:
            visual_slots = as_list(memory.get("visual_sample_slots"))
            meta_anchor = as_dict(memory.get("meta_anchor"))
            automatic_ready = bool(
                meta_anchor.get("automatic_confirmation_ready")
                and need_start is not None
                and need.get("bbox")
            )
            later_than_anchor = True
            if need_start is not None and visual_slots:
                anchor_ends = [
                    to_float(as_dict(slot.get("time")).get("end"))
                    or to_float(as_dict(slot.get("time")).get("start"))
                    for slot in visual_slots
                ]
                anchor_ends = [value for value in anchor_ends if value is not None]
                later_than_anchor = not anchor_ends or need_start >= min(anchor_ends)
            confidence = min(
                0.97,
                max(0.58, float(need.get("central_presence_score") or 0.0))
                + min(len(visual_slots), 4) * 0.04
                + (0.06 if as_list(memory.get("audio_sample_slots")) else 0.0),
            )
            candidates.append(
                {
                    "candidate_id": (
                        f"identity_continuity:{memory.get('agent_id')}:{source_ref}"
                    ),
                    "analysis_id": safe_text(status.get("analysis_id"), "unknown-analysis"),
                    "agent_id": memory.get("agent_id"),
                    "candidate_label": memory.get("canonical_label"),
                    "target_source_ref": source_ref,
                    "target_time": need.get("candidate_time"),
                    "target_bbox": need.get("bbox"),
                    "target_need_id": need.get("need_id"),
                    "authority": "manual_identity_memory_projection",
                    "maturity_projection_state": "review_visible_not_mature",
                    "confidence": round(confidence, 3),
                    "match_basis": [
                        "manual_agent_assertion",
                        "appearance_similarity",
                        "voice_similarity" if as_list(memory.get("audio_sample_slots")) else "audio_sample_needed",
                        "central_onscreen_person",
                    ],
                    "provenance_refs": [
                        *(memory.get("manual_anchor_refs") or []),
                        source_ref,
                    ],
                    "sample_refs": [
                        *[
                            slot.get("sample_id")
                            for slot in visual_slots[:4]
                            if isinstance(slot, dict) and slot.get("sample_id")
                        ],
                        *[
                            slot.get("sample_id")
                            for slot in as_list(memory.get("audio_sample_slots"))[:4]
                            if isinstance(slot, dict) and slot.get("sample_id")
                        ],
                    ],
                    "review_state": "confirm_or_drop_identity_continuity",
                    "automatic_confirmation_eligible": automatic_ready,
                    "automatic_confirmation_state": (
                        "awaiting_occurrence_similarity_and_conflict_gate"
                        if automatic_ready
                        else "analyst_review_required"
                    ),
                    "meta_anchor_ref": meta_anchor.get("anchor_id"),
                    "promotion_requires_decision": not automatic_ready,
                    "candidate_is_not_promotion": True,
                    "blocked_if_missing_source_time": not later_than_anchor,
                }
            )
    return candidates


def confirmation_need_from_track(
    status: Dict[str, Any],
    item: Dict[str, Any],
    index: int,
    confirmed_track_ids: Set[str],
) -> Optional[Dict[str, Any]]:
    candidate = track_candidate(item, index, status)
    if not candidate_looks_person(candidate):
        return None
    if candidate.get("canonical_identity_status") == "manual_confirmed":
        return None
    source_ref = safe_text(candidate.get("source_ref"))
    if source_ref and source_ref in confirmed_track_ids:
        return None

    bbox = normalized_bbox_from_track(item)
    presence_score = central_presence_score(bbox)
    confidence = to_float(item.get("confidence")) or 0.0
    occurrence_count = to_float(item.get("occurrence_count")) or to_float(item.get("occurrenceCount")) or 0.0
    item_time = as_dict(candidate.get("time"))
    start = to_float(item_time.get("start"))
    end = to_float(item_time.get("end")) or start
    duration = media_duration_seconds(status)
    late_video = (
        duration is not None
        and end is not None
        and end >= max(duration * 0.80, duration - 15.0)
    )
    if presence_score < 0.58 and not late_video:
        return None
    if confidence < 0.55 and occurrence_count < 12:
        return None

    reasons = ["central_onscreen_person_confirmation_need"]
    if late_video:
        reasons.append("late_video_central_person")
    if occurrence_count >= 30:
        reasons.append("persistent_person_track")

    need_id = f"confirmation_need:{candidate.get('candidate_id')}"
    return {
        "need_id": need_id,
        "analysis_id": safe_text(status.get("analysis_id"), "unknown-analysis"),
        "need_type": "narrative_agent_identity_confirmation",
        "trigger_reasons": reasons,
        "source_panel": "objects_panel",
        "source_ref": source_ref,
        "candidate_id": candidate.get("candidate_id"),
        "candidate_label": candidate.get("label"),
        "candidate_category": candidate.get("category"),
        "candidate_time": candidate.get("time"),
        "confidence": confidence or candidate.get("confidence"),
        "central_presence_score": presence_score,
        "bbox": bbox,
        "confirmation_state": "needs_scanner_matcher_support",
        "manual_confirmation_still_available": True,
        "candidate_is_not_promotion": True,
    }


def collect_confirmation_needs(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not TRACK_DERIVED_PROMOTION_ENABLED:
        return []
    confirmed_track_ids = manually_confirmed_track_ids(status)
    needs: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for index, item in enumerate(visual_tracked_objects(status)):
        need = confirmation_need_from_track(status, item, index, confirmed_track_ids)
        if not need:
            continue
        key = safe_text(need.get("candidate_id"), need["need_id"])
        if key in seen:
            continue
        seen.add(key)
        needs.append(need)
    return needs


def build_scanner_matcher_launch_requests(
    analysis_id: str,
    confirmation_needs: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    requests: List[Dict[str, Any]] = []
    for index, need in enumerate(confirmation_needs):
        request_id = f"auto-confirmation-need-{index + 1}:{need.get('source_ref')}"
        requests.append(
            {
                "request_id": request_id,
                "analysis_id": analysis_id,
                "launch_reason": "confirmation_need",
                "trigger_need_id": need.get("need_id"),
                "trigger_reasons": need.get("trigger_reasons") or [],
                "scanner": "SOM/open-topology evidence proliferation matcher",
                "matcher_endpoint": f"/api/analysis/{analysis_id}/proliferation/match",
                "launch_state": "queued_for_diagnostic_scan",
                "target_category": "narrative_agent_identity_continuity",
                "source_panel": need.get("source_panel"),
                "source_ref": need.get("source_ref"),
                "source_candidate_id": need.get("candidate_id"),
                "source_time": need.get("candidate_time"),
                "source_bbox": need.get("bbox"),
                "central_presence_score": need.get("central_presence_score"),
                "request_payload": {
                    "request_id": request_id,
                    "target_category": "character_continuity",
                    "source_panel": need.get("source_panel"),
                    "source_id": need.get("source_ref"),
                    "source_label": need.get("candidate_label"),
                    "time": need.get("candidate_time"),
                    "geometry": {"bbox": need.get("bbox")} if need.get("bbox") else None,
                    "reason": "central unresolved on-screen person needs identity support",
                    "governance": {
                        "diagnostic_only": True,
                        "candidate_is_not_promotion": True,
                        "manual_confirmation_wins": True,
                    },
                },
                "candidate_is_not_promotion": True,
                "manual_confirmation_wins": True,
            }
        )
    return requests


def entity_match_candidates(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    for match_index, match in enumerate(as_list(status.get("evidence_proliferation_matches"))):
        if not isinstance(match, dict):
            continue
        items = as_list(match.get("candidates")) or [match]
        for candidate_index, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            label = (
                safe_text(item.get("label"))
                or safe_text(item.get("target_label"))
                or safe_text(item.get("candidate_label"))
                or safe_text(match.get("label"))
                or safe_text(match.get("target_label"))
            )
            if not label:
                continue
            source_panel = safe_text(
                item.get("source_panel") or match.get("source_panel"),
                "entity_match",
            )
            confidence = (
                item.get("overall_score")
                or item.get("similarity_score")
                or item.get("confidence")
                or match.get("overall_score")
                or match.get("confidence")
            )
            source_ref = safe_text(
                item.get("candidate_id")
                or item.get("evidence_id")
                or item.get("id")
                or match.get("request_id"),
                f"entity_match:{match_index}:{candidate_index}",
            )
            candidates.append(
                {
                    "candidate_id": f"entity_match:{source_ref}",
                    "source_panel": source_panel,
                    "source_kind": "entity_match",
                    "source_ref": source_ref,
                    "label": label,
                    "category": safe_text(item.get("category") or match.get("category"), "Entity match"),
                    "time": time_range(item),
                    "confidence": confidence,
                    "tokens": sorted(tokens_for(label, item.get("category"), match.get("category"))),
                    "surfaces_proliferation_bus": True,
                }
            )
    return candidates


def source_genre_tokens(status: Dict[str, Any]) -> Set[str]:
    metadata = as_dict(status.get("source_media_metadata"))
    annotations = as_dict(metadata.get("user_annotations") or metadata.get("annotations"))
    return tokens_for(
        metadata.get("genre"),
        metadata.get("genre_subtype"),
        metadata.get("situational_genre"),
        annotations.get("genre"),
        annotations.get("genre_subtype"),
        annotations.get("situational_genre"),
        annotations.get("situational_subtype"),
    )


def looks_like_news(status: Dict[str, Any]) -> bool:
    return bool(source_genre_tokens(status) & NEWS_GENRE_TOKENS)


def collect_genre_rule_observations(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not looks_like_news(status):
        return []
    observations: List[Dict[str, Any]] = []
    for index, item in enumerate(ocr_results(status)):
        text = safe_text(item.get("text") or item.get("label"))
        if len(tokens_for(text)) < 2:
            continue
        observation_id = safe_text(item.get("id"), f"news_lower_third:{index}")
        item_range = time_range(item)
        confidence = confidence_percent(item.get("confidence"), 0.88)
        observations.append(
            {
                "observation_id": observation_id,
                "genre_rule_id": "news_lower_third_ocr_entities_are_on_screen",
                "source_panel": "ocr",
                "authority": "genre_specific_known",
                "authority_class": "content_derived_mature_observation",
                "label": text,
                "category": "news_lower_third_entity",
                "time": item_range,
                "confidence_percent": confidence,
                "confidence": round(confidence / 100, 2),
                "maturity_projection_state": "mature_with_confidence_rating",
                "source_ref": observation_id,
                "tokens": sorted(tokens_for(text, "news lower third")),
                "triangulation": {
                    "ocr_text_names_on_screen": True,
                    "visual_presence_required": True,
                    "audio_window_recommended": True,
                },
            }
        )
    return observations


def collect_genre_rule_mature_seeds(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        {
            "seed_id": f"genre_rule:{item.get('observation_id')}",
            "source_panel": item.get("source_panel"),
            "authority": item.get("authority"),
            "authority_class": item.get("authority_class"),
            "label": item.get("label"),
            "category": item.get("category"),
            "time": item.get("time"),
            "confidence_percent": item.get("confidence_percent"),
            "confidence": item.get("confidence"),
            "maturity_projection_state": item.get("maturity_projection_state"),
            "teaches_regime": True,
            "source_ref": item.get("source_ref"),
            "tokens": item.get("tokens") or [],
            "genre_rule_id": item.get("genre_rule_id"),
        }
        for item in collect_genre_rule_observations(status)
    ]


def seed_looks_person(seed: Dict[str, Any]) -> bool:
    seed_tokens = set(seed.get("tokens") or [])
    return bool(seed_tokens & PERSON_HINTS)


def candidate_looks_person(candidate: Dict[str, Any]) -> bool:
    candidate_tokens = set(candidate.get("tokens") or [])
    return bool(candidate_tokens & PERSON_HINTS)


def starts_after_seed(seed: Dict[str, Any], candidate: Dict[str, Any]) -> bool:
    seed_time = as_dict(seed.get("time"))
    candidate_time = as_dict(candidate.get("time"))
    seed_end = to_float(seed_time.get("end"))
    seed_start = to_float(seed_time.get("start"))
    candidate_start = to_float(candidate_time.get("start"))
    if candidate_start is None:
        return True
    boundary = seed_end if seed_end is not None else seed_start
    if boundary is None:
        return True
    return candidate_start > boundary + 0.5


def collect_constellational_support(
    status: Dict[str, Any],
    seed: Dict[str, Any],
    candidate: Dict[str, Any],
) -> Dict[str, Any]:
    return scan_constellation_for_candidate(status, seed, candidate)


def match_reason(seed: Dict[str, Any], candidate: Dict[str, Any]) -> Optional[str]:
    seed_tokens = set(seed.get("tokens") or [])
    candidate_tokens = set(candidate.get("tokens") or [])
    overlap = sorted(seed_tokens & candidate_tokens)
    if overlap:
        return f"token_overlap:{','.join(overlap[:5])}"
    if seed_looks_person(seed) and candidate_looks_person(candidate):
        return "person_track_continuity"
    return None


def collect_candidate_opportunities(
    status: Dict[str, Any],
    mature_seeds: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    opportunities: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    candidates = entity_match_candidates(status)
    if TRACK_DERIVED_PROMOTION_ENABLED:
        candidates = [
            track_candidate(item, index, status)
            for index, item in enumerate(visual_tracked_objects(status))
        ] + candidates
    for seed in mature_seeds:
        for candidate in candidates:
            if candidate.get("canonical_identity_status") == "manual_confirmed":
                continue
            if candidate["source_ref"] == seed.get("source_ref"):
                continue
            if not starts_after_seed(seed, candidate):
                continue
            reason = match_reason(seed, candidate)
            if not reason:
                continue
            constellational_support = collect_constellational_support(status, seed, candidate)
            key = f"{seed.get('seed_id')}::{candidate.get('candidate_id')}"
            if key in seen:
                continue
            seen.add(key)
            candidate_confidence = to_float(candidate.get("confidence"))
            confidence_values = [
                value
                for value in (
                    candidate_confidence,
                    constellational_support.get("confidence"),
                )
                if isinstance(value, (int, float))
            ]
            confidence = max(confidence_values) if confidence_values else None
            opportunities.append(
                {
                    "opportunity_id": f"opportunity:{len(opportunities) + 1}",
                    "cluster_key": cluster_key_for_opportunity(seed, candidate),
                    "seed_id": seed.get("seed_id"),
                    "seed_label": seed.get("label"),
                    "candidate_id": candidate.get("candidate_id"),
                    "candidate_label": candidate.get("label"),
                    "candidate_category": candidate.get("category"),
                    "candidate_source_panel": candidate.get("source_panel"),
                    "candidate_source_ref": candidate.get("source_ref"),
                    "candidate_time": candidate.get("time"),
                    "candidate_bbox": candidate.get("bbox"),
                    "canonical_identity_label": candidate.get("canonical_identity_label"),
                    "canonical_identity_status": candidate.get("canonical_identity_status"),
                    "manual_identity_anchor_ref": candidate.get("manual_identity_anchor_ref"),
                    "manual_identity_match_basis": candidate.get("manual_identity_match_basis"),
                    "confidence": round(confidence, 3) if confidence is not None else None,
                    "match_reason": reason,
                    "constellational_support": constellational_support,
                    "constellational_support_count": constellational_support.get("support_count"),
                    "constellational_modality_count": constellational_support.get("modality_count"),
                    "constellational_match_basis": constellational_support.get("match_basis"),
                    "source_kind": candidate.get("source_kind"),
                    "surfaces_proliferation_bus": bool(
                        candidate.get("surfaces_proliferation_bus")
                    ),
                    "review_state": "candidate_requires_governed_decision",
                    "candidate_is_not_promotion": True,
                }
            )
    return opportunities


def cluster_key_for_opportunity(seed: Dict[str, Any], candidate: Dict[str, Any]) -> str:
    return ":".join(
        [
            "cluster",
            safe_text(seed.get("seed_id"), "seed"),
            safe_text(candidate.get("category"), "candidate").lower().replace(" ", "_"),
            safe_text(candidate.get("label"), "label").lower().replace(" ", "_"),
        ]
    )


def decision_is_rejection(decision: Dict[str, Any]) -> bool:
    return safe_text(decision.get("decision")).lower() in REJECTION_DECISIONS


def rejected_opportunity_decisions(
    decisions: Sequence[Any],
) -> Dict[str, Set[str]]:
    rejected = {
        "candidate_ids": set(),
        "opportunity_ids": set(),
        "hypothesis_ids": set(),
        "cluster_keys": set(),
    }
    for item in decisions:
        if not isinstance(item, dict) or not decision_is_rejection(item):
            continue
        for key, target in (
            ("candidate_ids", item.get("candidate_id")),
            ("opportunity_ids", item.get("opportunity_id") or item.get("source_opportunity_id")),
            ("hypothesis_ids", item.get("hypothesis_id") or item.get("target_hypothesis_id")),
            ("cluster_keys", item.get("cluster_key")),
        ):
            text = safe_text(target)
            if text:
                rejected[key].add(text)
    return rejected


def opportunity_rejection_reason(
    opportunity: Dict[str, Any],
    rejected: Dict[str, Set[str]],
) -> Optional[str]:
    if safe_text(opportunity.get("candidate_id")) in rejected["candidate_ids"]:
        return "candidate_canceled_by_analyst"
    if safe_text(opportunity.get("opportunity_id")) in rejected["opportunity_ids"]:
        return "opportunity_canceled_by_analyst"
    if safe_text(opportunity.get("cluster_key")) in rejected["cluster_keys"]:
        return "cluster_canceled_by_analyst"
    return None


def apply_proliferation_decision_suppression(
    opportunities: Sequence[Dict[str, Any]],
    decisions: Sequence[Any],
) -> Dict[str, List[Dict[str, Any]]]:
    rejected = rejected_opportunity_decisions(decisions)
    active: List[Dict[str, Any]] = []
    suppressed: List[Dict[str, Any]] = []
    for opportunity in opportunities:
        reason = opportunity_rejection_reason(opportunity, rejected)
        if reason:
            suppressed.append(
                {
                    **opportunity,
                    "review_state": "canceled_by_analyst",
                    "suppression_reason": reason,
                    "candidate_is_not_promotion": True,
                    "manual_annotation_principle_applied": True,
                }
            )
        else:
            active.append(opportunity)
    return {"active": active, "suppressed": suppressed}


def build_proposed_audiovisual_samples(
    analysis_id: str,
    genre_rule_observations: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    proposed: List[Dict[str, Any]] = []
    for index, observation in enumerate(genre_rule_observations):
        observation_time = as_dict(observation.get("time"))
        start = to_float(observation_time.get("start"))
        end = to_float(observation_time.get("end"))
        if start is None:
            continue
        if end is None or end <= start:
            end = start + 4.0
        proposed.append(
            {
                "sample_id": f"proposed_av_sample:{index + 1}",
                "analysis_id": analysis_id,
                "source_observation_id": observation.get("observation_id"),
                "label": observation.get("label"),
                "sample_type": "audiovisual_news_lower_third_identity_anchor",
                "time_start": max(0.0, start - 1.0),
                "time_end": end + 1.0,
                "confidence_percent": observation.get("confidence_percent"),
                "source_rule_id": observation.get("genre_rule_id"),
                "creation_state": "proposed_for_source_sampler",
                "triangulation": observation.get("triangulation"),
                "purpose": (
                    "Create visual/audio anchor from news lower-third OCR for "
                    "later audiovisual sample-cloud matching."
                ),
            }
        )
    return proposed


def build_governed_mature_hypotheses(
    analysis_id: str,
    opportunities: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    hypotheses: List[Dict[str, Any]] = []
    for index, opportunity in enumerate(opportunities):
        hypothesis_id = f"governed_hypothesis:{index + 1}"
        hypotheses.append(
            {
                "hypothesis_id": hypothesis_id,
                "analysis_id": analysis_id,
                "authority_class": "governed_mature_hypothesis",
                "authority": "system_supported_hypothesis",
                "maturity_projection_state": "review_visible_not_mature",
                "review_badge": "needs_review",
                "hypothesis_state": "governed_mature_hypothesis",
                "cluster_key": opportunity.get("cluster_key"),
                "seed_id": opportunity.get("seed_id"),
                "seed_label": opportunity.get("seed_label"),
                "candidate_id": opportunity.get("candidate_id"),
                "candidate_label": opportunity.get("candidate_label"),
                "candidate_category": opportunity.get("candidate_category"),
                "candidate_source_panel": opportunity.get("candidate_source_panel"),
                "candidate_source_ref": opportunity.get("candidate_source_ref"),
                "source_kind": opportunity.get("source_kind"),
                "candidate_time": opportunity.get("candidate_time"),
                "candidate_bbox": opportunity.get("candidate_bbox"),
                "canonical_identity_label": opportunity.get("canonical_identity_label"),
                "canonical_identity_status": opportunity.get("canonical_identity_status"),
                "manual_identity_anchor_ref": opportunity.get("manual_identity_anchor_ref"),
                "manual_identity_match_basis": opportunity.get("manual_identity_match_basis"),
                "confidence": opportunity.get("confidence"),
                "match_reason": opportunity.get("match_reason"),
                "traceback_refs": [
                    ref
                    for ref in (
                        opportunity.get("seed_id"),
                        opportunity.get("candidate_source_ref"),
                    )
                    if ref
                ],
                "can_project_as_review_pressure": True,
                "can_override_manual_authority": False,
                "promotion_requires_decision": True,
                "promotion_ledger": "annotation_corrections.proliferation_decisions",
                "candidate_is_not_promotion": True,
                "source_opportunity_id": opportunity.get("opportunity_id"),
            }
        )
    return hypotheses


def build_live_mature_data_proliferation_audit(status: Dict[str, Any]) -> Dict[str, Any]:
    analysis_id = safe_text(status.get("analysis_id"), "unknown-analysis")
    genre_rule_observations = collect_genre_rule_observations(status)
    seeds = collect_mature_seeds(status)
    corrections = as_dict(status.get("annotation_corrections"))
    decisions = as_list(corrections.get("proliferation_decisions"))
    all_opportunities = collect_candidate_opportunities(status, seeds)
    suppression = apply_proliferation_decision_suppression(all_opportunities, decisions)
    opportunities = suppression["active"]
    suppressed_opportunities = suppression["suppressed"]
    governed_hypotheses = build_governed_mature_hypotheses(analysis_id, opportunities)
    confirmation_needs = collect_confirmation_needs(status)
    scanner_matcher_launch_requests = build_scanner_matcher_launch_requests(
        analysis_id,
        confirmation_needs,
    )
    narrative_agent_identity_memories = collect_narrative_agent_identity_memories(status)
    identity_continuity_candidates = build_identity_continuity_candidates(
        status,
        narrative_agent_identity_memories,
        confirmation_needs,
    )
    proposed_audiovisual_samples = build_proposed_audiovisual_samples(
        analysis_id,
        genre_rule_observations,
    )
    source_sample_count = len(as_list(status.get("source_samples")))
    tracked_count = len(visual_tracked_objects(status))
    entity_match_count = len(entity_match_candidates(status))
    content_observation_count = len(
        [
            seed
            for seed in seeds
            if seed.get("authority_class") in {
                "content_derived_mature_observation",
                "user_confirmed_source_metadata",
            }
        ]
    )
    user_confirmed_source_metadata_count = len(
        [seed for seed in seeds if seed.get("authority_class") == "user_confirmed_source_metadata"]
    )
    blocked_promotions = [
        {
            "opportunity_id": opportunity.get("opportunity_id"),
            "candidate_id": opportunity.get("candidate_id"),
            "seed_id": opportunity.get("seed_id"),
            "reason": "promotion_decision_required",
            "required_ledger": "annotation_corrections.proliferation_decisions",
        }
        for opportunity in opportunities
    ]
    return {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "status": "audit_ready",
        "created_at": utc_now_iso(),
        "authority_policy": {
            "candidate_is_not_promotion": True,
            "governed_hypothesis_is_not_confirmed_mature": True,
            "governed_hypothesis_projects_review_pressure": True,
            "promotion_requires_decision_ledger_entry": True,
            "manual_correction_wins": True,
            "raw_detection_never_overrides_mature_data": True,
            "content_derived_metadata_can_project_mature_with_confidence": True,
            "entity_matches_must_surface_proliferation_bus": True,
            "genre_knowns_can_seed_governed_proliferation": True,
            "manual_annotation_can_cancel_candidate_or_cluster": True,
            "confirmation_needs_launch_scanner_matcher": True,
            "som_open_topology_scanner_is_diagnostic_not_authority": True,
            "narrative_agent_identity_memory_is_audiovisual": True,
            "central_character_requires_multiple_visual_samples": True,
            "identity_memory_provenance_lands_in_narrative_agent_panel": True,
            "constellational_scanning_uses_manual_audio_visual_and_context": True,
            "narrative_agent_meta_anchor_governs_automatic_confirmation": True,
            "automatic_confirmation_is_source_occurrence_scoped": True,
        },
        "hydration": status.get("saved_analysis_hydration_audit"),
        "summary": {
            "seed_count": len(seeds),
            "manual_seed_count": len(
                [seed for seed in seeds if seed.get("source_panel") == "manual_visual_annotations"]
            ),
            "source_sample_seed_count": source_sample_count,
            "promotion_decision_count": len(decisions),
            "tracked_candidate_count": tracked_count,
            "entity_match_candidate_count": entity_match_count,
            "candidate_opportunity_count": len(opportunities),
            "suppressed_candidate_opportunity_count": len(suppressed_opportunities),
            "content_derived_mature_observation_count": content_observation_count,
            "user_confirmed_source_metadata_count": user_confirmed_source_metadata_count,
            "genre_rule_observation_count": len(genre_rule_observations),
            "proposed_audiovisual_sample_count": len(proposed_audiovisual_samples),
            "governed_mature_hypothesis_count": len(governed_hypotheses),
            "automatic_review_projection_count": len(governed_hypotheses),
            "confirmation_need_count": len(confirmation_needs),
            "scanner_matcher_launch_request_count": len(scanner_matcher_launch_requests),
            "narrative_agent_identity_memory_count": len(narrative_agent_identity_memories),
            "identity_continuity_candidate_count": len(identity_continuity_candidates),
            "automatic_confirmation_ready_meta_anchor_count": len(
                [
                    memory
                    for memory in narrative_agent_identity_memories
                    if as_dict(memory.get("meta_anchor")).get(
                        "automatic_confirmation_ready"
                    )
                ]
            ),
            "audiovisual_identity_sample_slot_count": sum(
                len(as_list(memory.get("audiovisual_sample_slots")))
                for memory in narrative_agent_identity_memories
            ),
            "blocked_promotion_count": len(blocked_promotions),
        },
        "mature_seeds": seeds,
        "genre_rule_observations": genre_rule_observations,
        "proposed_audiovisual_samples": proposed_audiovisual_samples,
        "confirmation_needs": confirmation_needs,
        "scanner_matcher_launch_requests": scanner_matcher_launch_requests,
        "narrative_agent_identity_memories": narrative_agent_identity_memories,
        "identity_continuity_candidates": identity_continuity_candidates,
        "candidate_opportunities": opportunities,
        "suppressed_candidate_opportunities": suppressed_opportunities,
        "governed_mature_hypotheses": governed_hypotheses,
        "blocked_promotions": blocked_promotions,
        "next_required_stage": "P2_PROMOTION_LEDGER_AND_REVIEW_PROJECTION",
    }


def write_live_mature_data_proliferation_audit(
    status: Dict[str, Any],
    output_path: str | Path,
) -> Dict[str, Any]:
    payload = build_live_mature_data_proliferation_audit(status)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return payload
