from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set


SCHEMA = "vaa1.evidence_proliferation_match.v1"
GOVERNANCE_SCHEMA = "vaa1.mature_data_proliferation_governance.v1"

NEAR_MATCH_PROBABILITY_POLICY = {
    "candidate_floor": 0.20,
    "surface_to_analyst": 0.35,
    "probable_candidate": 0.45,
    "strongly_supported": 0.85,
    "very_high_probability": 0.95,
    "auto_proliferation_allowed_above": 0.95,
    "manual_confirmation_required_below": 0.95,
    "notes": [
        "Near matches are surfaced as review candidates, not mature semantic authority.",
        "Only manual confirmation, manual correction, or very high probability may proliferate.",
        "Probability boundaries are open policy values and should remain analyst-discussable.",
    ],
}

PROJECTION_TARGETS_BY_SOURCE_PANEL = {
    "objects_panel": ["video_panel", "bbox_roi_panel", "objects_panel", "traceback_drawer"],
    "manual_visual_annotations": ["video_panel", "bbox_roi_panel", "objects_panel", "traceback_drawer"],
    "visual_sample_cloud": ["video_panel", "bbox_roi_panel", "sample_cloud_panel", "traceback_drawer"],
    "audio_panel": ["audio_panel", "sample_cloud_panel", "diarization_panel", "traceback_drawer"],
    "transcript_panel": ["transcript_panel", "narrative_agent_panel", "traceback_drawer"],
    "source_media_metadata": ["master_schema_panel", "narrative_agent_panel", "traceback_drawer"],
    "visual_cues": ["video_panel", "scene_card_panel", "traceback_drawer"],
    "cinematic_clues": ["scene_card_panel", "mise_en_scene_panel", "traceback_drawer"],
}

AUTHORITY_POLICY = {
    "manual_correction_wins": True,
    "manual_annotation_wins": True,
    "manual_confirmation_wins": True,
    "outputs_are_candidates_until_supported_by_evidence": True,
    "evidence_linked_not_timeline_linear": True,
    "proliferated_candidates_do_not_mutate_source_evidence": True,
    "near_matches_surface_to_analyst": True,
    "near_matches_require_confirm_or_cancel": True,
    "situational_mirror_candidates_require_review": True,
    "probability_policy": NEAR_MATCH_PROBABILITY_POLICY,
    "governance_schema": GOVERNANCE_SCHEMA,
}

TARGET_CATEGORY_HINTS = {
    "character_continuity": {"identification", "person", "character", "face", "speaker"},
    "object": {"object", "ocr", "tool", "gun", "racket", "ball", "clothes"},
    "named_entity": {"ocr", "text", "name", "person", "place", "org", "organization", "entity"},
    "scene_setting": {"scene", "setting", "sky", "sea", "forest", "city", "cityscape", "street", "studio"},
    "role": {"role", "character", "person", "speaker"},
    "action": {"action", "movement", "interaction"},
    "interaction": {"interaction", "person", "speaker", "dialogue"},
    "scene_episode": {"scene", "episode", "situation", "plot"},
    "ocr_text_phrase": {"ocr", "text", "caption"},
    "speaker_voice_continuity": {"speaker", "voice", "audio"},
    "sound_event": {"sound", "audio", "event"},
    "music_motif": {"music", "audio", "motif"},
    "ambient_sound": {"ambient", "audio", "sound"},
    "prosody_delivery_pattern": {"prosody", "voice", "speech", "audio"},
    "visual_pattern": {"visual", "object", "person", "expression"},
}

SETTING_TOKENS = {
    "sky",
    "sea",
    "forest",
    "city",
    "cityscape",
    "street",
    "studio",
    "office",
    "conference",
    "courtroom",
    "beach",
    "interior",
    "battlefield",
    "crowd",
}

CHARACTER_GENERIC_TOKENS = {
    "agent",
    "anchor",
    "bystander",
    "character",
    "face",
    "human",
    "person",
    "presenter",
    "reporter",
    "speaker",
    "subject",
}

CHARACTER_IDENTITY_NOISE_TOKENS = CHARACTER_GENERIC_TOKENS | {
    "actor",
    "agent",
    "analyst",
    "confirm",
    "confirmed",
    "continuity",
    "dr",
    "identification",
    "manual",
    "metadata",
    "miss",
    "mister",
    "mrs",
    "ms",
    "narrative",
    "profile",
    "role",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _safe_float(value: Any, fallback: Optional[float] = None) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _first_float(*values: Any) -> Optional[float]:
    for value in values:
        parsed = _safe_float(value)
        if parsed is not None:
            return parsed
    return None


def _tokenize(value: Any) -> Set[str]:
    text = _safe_text(value).lower()
    return {
        token
        for token in re.split(r"[^a-z0-9]+", text)
        if len(token) >= 2 and token not in {"track", "probable", "candidate"}
    }


def _character_identity_tokens(value: Any) -> Set[str]:
    return {
        token
        for token in (_tokenize(value) - CHARACTER_IDENTITY_NOISE_TOKENS)
        if token.isalpha()
    }


def _character_candidate_compatibility(
    request: Dict[str, Any],
    candidate: Dict[str, Any],
) -> str:
    if _safe_text(request.get("target")) != "character_continuity":
        return "not_applicable"

    evidence = request.get("evidence") or {}
    seed_identity = (
        _character_identity_tokens(evidence.get("label"))
        | _character_identity_tokens(evidence.get("source_label"))
    )
    candidate_label_tokens = _tokenize(candidate.get("label"))
    candidate_category_tokens = _tokenize(candidate.get("category"))
    candidate_raw = candidate.get("raw") if isinstance(candidate.get("raw"), dict) else {}
    candidate_descriptor_tokens = (
        candidate_label_tokens
        | candidate_category_tokens
        | _tokenize(candidate_raw.get("class"))
        | _tokenize(candidate_raw.get("subcategory"))
        | _tokenize(candidate_raw.get("identity_affirmation"))
    )
    candidate_identity = (
        _character_identity_tokens(candidate.get("label"))
        | _character_identity_tokens(candidate_raw.get("identity_affirmation"))
    )
    source_panel = _safe_text(candidate.get("source_panel"))

    if seed_identity and candidate_identity & seed_identity:
        return "direct_identity"

    is_generic_person = bool(candidate_descriptor_tokens & CHARACTER_GENERIC_TOKENS)
    if source_panel == "objects_panel":
        return "unknown_person" if is_generic_person else "incompatible"

    if source_panel == "manual_visual_annotations":
        is_identity_annotation = bool(
            candidate_descriptor_tokens
            & {"identification", "character", "person", "face", "narrative", "agent"}
        )
        if not is_identity_annotation:
            return "incompatible"
        if not candidate_identity or is_generic_person and not candidate_identity:
            return "unknown_person"
        if not seed_identity:
            return "known_identity_option"
        # A manually named different person is authoritative evidence of a conflict,
        # not a high-confidence match to the selected identity.
        return "incompatible"

    if source_panel == "source_samples":
        # Source samples can support a character constellation, but a sample
        # created for another named identity is not an unknown visual person.
        return "contextual_support"

    if source_panel == "visual_sample_cloud":
        return "unknown_person" if is_generic_person else "contextual_support"

    if source_panel in {
        "transcript_panel",
        "ocr_panel",
        "source_media_metadata",
        "audio_panel",
        "visual_cues",
        "cinematic_clues",
    }:
        return "contextual_support"

    return "incompatible"


def _interval_from_mapping(item: Dict[str, Any]) -> Dict[str, Optional[float]]:
    start = _first_float(
        item.get("start"),
        item.get("start_time"),
        item.get("start_seconds"),
        item.get("start_timestamp"),
        item.get("time_start"),
        item.get("startTimestamp"),
        item.get("timestamp_seconds"),
        item.get("timestamp"),
        item.get("time"),
    )
    end = _first_float(
        item.get("end"),
        item.get("end_time"),
        item.get("end_seconds"),
        item.get("end_timestamp"),
        item.get("time_end"),
        item.get("endTimestamp"),
    )
    if end is None:
        end = start
    return {"start": start, "end": end}


def _geometry_from_mapping(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    bbox = item.get("bbox")
    if isinstance(bbox, dict):
        return {"geometry_type": "bbox", "bbox": bbox}
    coordinates = item.get("coordinates")
    if isinstance(coordinates, dict):
        width = coordinates.get("width", coordinates.get("w"))
        height = coordinates.get("height", coordinates.get("h"))
        if (
            all(coordinates.get(key) is not None for key in ("x", "y"))
            and width is not None
            and height is not None
        ):
            return {
                "geometry_type": "bbox",
                "bbox": {
                    "x": coordinates.get("x"),
                    "y": coordinates.get("y"),
                    "width": width,
                    "height": height,
                },
            }
    keys = ("x", "y", "width", "height")
    if all(key in item for key in keys):
        return {
            "geometry_type": "bbox",
            "bbox": {key: item.get(key) for key in keys},
        }
    x1 = _safe_float(item.get("bbox_x1"))
    y1 = _safe_float(item.get("bbox_y1"))
    x2 = _safe_float(item.get("bbox_x2"))
    y2 = _safe_float(item.get("bbox_y2"))
    if None not in {x1, y1, x2, y2}:
        frame_width = _safe_float(item.get("frame_width"))
        frame_height = _safe_float(item.get("frame_height"))
        if frame_width and frame_height and frame_width > 0 and frame_height > 0:
            return {
                "geometry_type": "bbox",
                "coordinate_system": "normalized",
                "bbox": {
                    "x": x1 / frame_width,
                    "y": y1 / frame_height,
                    "width": abs(x2 - x1) / frame_width,
                    "height": abs(y2 - y1) / frame_height,
                },
                "source_bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "frame_width": frame_width,
                    "frame_height": frame_height,
                },
            }
        return {
            "geometry_type": "bbox",
            "coordinate_system": "source_pixels",
            "bbox": {
                "x": x1,
                "y": y1,
                "width": abs(x2 - x1),
                "height": abs(y2 - y1),
            },
        }
    return None


def _bbox_from_geometry(geometry: Any) -> Optional[Dict[str, float]]:
    if not isinstance(geometry, dict):
        return None
    bbox = geometry.get("bbox") if isinstance(geometry.get("bbox"), dict) else geometry
    if not isinstance(bbox, dict):
        return None
    x = _first_float(bbox.get("x"), bbox.get("left"), bbox.get("x1"))
    y = _first_float(bbox.get("y"), bbox.get("top"), bbox.get("y1"))
    width = _first_float(bbox.get("width"), bbox.get("w"))
    height = _first_float(bbox.get("height"), bbox.get("h"))
    x2 = _safe_float(bbox.get("x2"))
    y2 = _safe_float(bbox.get("y2"))
    if width is None and x is not None and x2 is not None:
        width = x2 - x
    if height is None and y is not None and y2 is not None:
        height = y2 - y
    if x is None or y is None or width is None or height is None:
        return None
    width = abs(width)
    height = abs(height)
    if width <= 0 or height <= 0:
        return None
    return {"x": x, "y": y, "width": width, "height": height}


def _bbox_iou(left: Dict[str, float], right: Dict[str, float]) -> float:
    left_x2 = left["x"] + left["width"]
    left_y2 = left["y"] + left["height"]
    right_x2 = right["x"] + right["width"]
    right_y2 = right["y"] + right["height"]
    intersection_w = max(0.0, min(left_x2, right_x2) - max(left["x"], right["x"]))
    intersection_h = max(0.0, min(left_y2, right_y2) - max(left["y"], right["y"]))
    intersection = intersection_w * intersection_h
    union = (left["width"] * left["height"]) + (right["width"] * right["height"]) - intersection
    return intersection / union if union > 0 else 0.0


def _bbox_center_distance(left: Dict[str, float], right: Dict[str, float]) -> float:
    left_cx = left["x"] + (left["width"] / 2.0)
    left_cy = left["y"] + (left["height"] / 2.0)
    right_cx = right["x"] + (right["width"] / 2.0)
    right_cy = right["y"] + (right["height"] / 2.0)
    return ((left_cx - right_cx) ** 2 + (left_cy - right_cy) ** 2) ** 0.5


def _canonical_constellation_key(value: Any) -> str:
    tokens = sorted(_character_identity_tokens(value) or _tokenize(value))
    return " ".join(tokens)


def _decision_anchor_time(anchor: Dict[str, Any]) -> Dict[str, Optional[float]]:
    if not isinstance(anchor, dict):
        return {"start": None, "end": None}
    time_interval = anchor.get("time_interval") if isinstance(anchor.get("time_interval"), dict) else {}
    start = _first_float(
        anchor.get("start_seconds"),
        anchor.get("start"),
        time_interval.get("start_seconds"),
        time_interval.get("start"),
    )
    end = _first_float(
        anchor.get("end_seconds"),
        anchor.get("end"),
        time_interval.get("end_seconds"),
        time_interval.get("end"),
    )
    if end is None:
        end = start
    return {"start": start, "end": end}


def _decision_anchor_geometry(anchor: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(anchor, dict):
        return None
    if isinstance(anchor.get("geometry"), dict):
        return anchor.get("geometry")
    if isinstance(anchor.get("bbox"), dict):
        return {"geometry_type": "bbox", "bbox": anchor.get("bbox")}
    return None


def _decision_source_anchors(decision: Dict[str, Any]) -> List[Dict[str, Any]]:
    anchors = [
        anchor
        for anchor in decision.get("source_anchors") or []
        if isinstance(anchor, dict)
    ]
    if anchors:
        return anchors
    fallback: Dict[str, Any] = {}
    start = _first_float(decision.get("start_seconds"), decision.get("time_start"))
    end = _first_float(decision.get("end_seconds"), decision.get("time_end"))
    if start is not None:
        fallback["start_seconds"] = start
        fallback["end_seconds"] = end if end is not None else start
    geometry = _first_mapping(decision.get("geometry"), decision.get("bbox"))
    if geometry:
        fallback["geometry"] = geometry
    return [fallback] if fallback else []


def build_mature_constellation_index(status: Dict[str, Any]) -> Dict[str, Any]:
    """Build an analysis-local memory of matcher confirmations and rejections."""
    corrections = status.get("annotation_corrections")
    if not isinstance(corrections, dict):
        return {
            "schema": "vaa1.mature_constellation_index.v1",
            "positive_count": 0,
            "negative_count": 0,
            "constellations": {},
        }

    constellations: Dict[str, Dict[str, Any]] = {}
    positive_count = 0
    negative_count = 0
    for decision in corrections.get("proliferation_decisions") or []:
        if not isinstance(decision, dict):
            continue
        label = (
            _safe_text(decision.get("applied_label"))
            or _safe_text(decision.get("target_label"))
            or _safe_text(decision.get("candidate_label"))
        )
        key = _canonical_constellation_key(label)
        if not key:
            continue
        constellation = constellations.setdefault(
            key,
            {
                "label": label,
                "positive": [],
                "negative": [],
                "deferred": [],
            },
        )
        record = {
            "decision_id": decision.get("decision_id"),
            "candidate_id": decision.get("candidate_id"),
            "target_evidence_id": decision.get("target_evidence_id"),
            "label": label,
            "source_panel": decision.get("source_panel"),
            "source_anchors": _decision_source_anchors(decision),
            "presence_facets": (
                (decision.get("governance_status") or {}).get("confirmed_presence_facets")
                or []
            ),
            "match_probability": _safe_float(
                (decision.get("governance_status") or {}).get("match_probability"),
                0.0,
            )
            or 0.0,
            "created_at": decision.get("created_at"),
        }
        decision_value = _safe_text(decision.get("decision")).lower()
        authority = _safe_text(decision.get("authority_level")).lower()
        maturity_result = _safe_text(
            (decision.get("governance_status") or {}).get("maturity_result")
        ).lower()
        if (
            decision_value == "confirmed"
            or authority == "manual_confirmation"
            or maturity_result == "user_confirmed_truth"
        ):
            constellation["positive"].append(record)
            positive_count += 1
        elif decision_value in {"canceled", "rejected"} or "rejected" in maturity_result:
            constellation["negative"].append(record)
            negative_count += 1
        elif decision_value == "deferred":
            constellation["deferred"].append(record)

    return {
        "schema": "vaa1.mature_constellation_index.v1",
        "positive_count": positive_count,
        "negative_count": negative_count,
        "constellations": constellations,
    }


def _candidate(
    *,
    analysis_id: str,
    evidence_id: str,
    label: str,
    category: str,
    source_kind: str,
    source_panel: str,
    item: Dict[str, Any],
) -> Dict[str, Any]:
    candidate = {
        "evidence_id": evidence_id,
        "analysis_id": analysis_id,
        "label": label,
        "category": category,
        "source_kind": source_kind,
        "source_panel": source_panel,
        "time": _interval_from_mapping(item),
        "geometry": _geometry_from_mapping(item),
        "raw": {
            key: item.get(key)
            for key in (
                "track_id",
                "id",
                "label",
                "class",
                "class_name",
                "display_label",
                "name",
                "text",
                "emotion",
                "confidence",
                "score",
                "occurrence_count",
                "semantic_status",
                "detector_substrate",
                "representative_timestamp",
                "parent_track_interval",
                "review_sample_duration_seconds",
                "overlapping_measured_speaker_turns",
            )
            if key in item
        },
    }
    candidate["source_timesphere"] = _timesphere_from_candidate(candidate)
    return candidate


def _timesphere_from_candidate(candidate: Dict[str, Any]) -> Dict[str, Any]:
    time = candidate.get("time") or {}
    start = _safe_float(time.get("start"))
    end = _safe_float(time.get("end"), start)
    geometry = candidate.get("geometry") or {}
    box = _bbox_from_geometry(geometry)
    return {
        "time": {
            "start": start,
            "end": end,
            "center": ((start or 0.0) + (end or start or 0.0)) / 2.0
            if start is not None
            else None,
        },
        "coordinate": {
            "bbox": box,
            "center": {
                "x": box["x"] + (box["width"] / 2.0),
                "y": box["y"] + (box["height"] / 2.0),
            }
            if box
            else None,
            "area": box["width"] * box["height"] if box else None,
        },
        "modality": candidate.get("source_panel"),
        "source_kind": candidate.get("source_kind"),
    }


def _as_items(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, dict):
        for key in ("segments", "timeline_segments", "utterances", "speaker_turns", "samples"):
            nested = value.get(key)
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _first_mapping(*values: Any) -> Dict[str, Any]:
    for value in values:
        if isinstance(value, dict):
            return value
    return {}


def _label_from_fields(item: Dict[str, Any], fields: Iterable[str], fallback: str) -> str:
    parts = [_safe_text(item.get(field)) for field in fields]
    label = " ".join(part for part in parts if part)
    return label or fallback


def _item_with_interval(
    item: Dict[str, Any],
    *,
    start: Any = None,
    end: Any = None,
    text: Optional[str] = None,
) -> Dict[str, Any]:
    next_item = dict(item)
    if start is not None:
        next_item.setdefault("start", start)
    if end is not None:
        next_item.setdefault("end", end)
    if text is not None:
        next_item.setdefault("text", text)
    return next_item


def _walk_master_schema(
    analysis_id: str,
    master_schema: Dict[str, Any],
) -> Iterable[Dict[str, Any]]:
    categories = master_schema.get("categories")
    if isinstance(categories, dict):
        for category, entries in categories.items():
            if not isinstance(entries, list):
                continue
            for index, item in enumerate(entries):
                if not isinstance(item, dict):
                    continue
                label = (
                    _safe_text(item.get("label"))
                    or _safe_text(item.get("identity"))
                    or _safe_text(item.get("value"))
                    or _safe_text(item.get("note"))
                    or category
                )
                yield _candidate(
                    analysis_id=analysis_id,
                    evidence_id=_safe_text(item.get("id"), f"manual:{category}:{index}"),
                    label=label,
                    category=str(category),
                    source_kind="manual_annotation",
                    source_panel="master_schema",
                    item=item,
                )


def _walk_transcript(analysis_id: str, status: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    transcript_sources = [
        status.get("transcript"),
        status.get("transcript_data"),
        status.get("linked_transcript"),
        results.get("transcript") if isinstance(results, dict) else None,
        results.get("transcription") if isinstance(results, dict) else None,
    ]
    seen: Set[str] = set()
    for source in transcript_sources:
        for index, item in enumerate(_as_items(source)):
            label = _label_from_fields(
                item,
                ("speaker", "speaker_label", "text", "transcript_text"),
                "Transcript segment",
            )
            text = _safe_text(item.get("text")) or _safe_text(item.get("transcript_text"))
            evidence_id = _safe_text(item.get("id"), f"transcript:{index}")
            if evidence_id in seen:
                continue
            seen.add(evidence_id)
            yield _candidate(
                analysis_id=analysis_id,
                evidence_id=evidence_id,
                label=label,
                category="Transcript",
                source_kind="transcript_evidence",
                source_panel="transcript_panel",
                item=_item_with_interval(item, text=text),
            )


def _walk_source_metadata(analysis_id: str, status: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    metadata = _first_mapping(
        status.get("source_media_metadata"),
        status.get("metadata"),
        (status.get("results") or {}).get("source_media_metadata")
        if isinstance(status.get("results"), dict)
        else None,
    )
    annotations = _first_mapping(metadata.get("user_annotations"), metadata.get("annotations"))

    people = (
        annotations.get("reference_people")
        or annotations.get("persons")
        or annotations.get("people")
        or []
    )
    for index, item in enumerate(_as_items(people)):
        label = _label_from_fields(
            item,
            ("identity_label", "name", "label", "person", "role", "description"),
            f"Metadata person {index + 1}",
        )
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=_safe_text(item.get("id"), f"metadata:person:{index}"),
            label=label,
            category="Metadata person",
            source_kind="metadata_reference",
            source_panel="source_media_metadata",
            item=item,
        )

    speakers = annotations.get("reference_speakers") or annotations.get("speakers") or []
    for index, item in enumerate(_as_items(speakers)):
        label = _label_from_fields(
            item,
            ("speaker_label", "identity_label", "name", "label", "description"),
            f"Metadata speaker {index + 1}",
        )
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=_safe_text(item.get("id"), f"metadata:speaker:{index}"),
            label=label,
            category="Metadata speaker",
            source_kind="metadata_reference",
            source_panel="source_media_metadata",
            item=item,
        )

    for key in (
        "title",
        "description",
        "source_context",
        "editor_notes",
        "provenance_notes",
        "relations",
        "situation_event",
        "narrative_development",
        "performance_expression",
        "keywords",
    ):
        value = annotations.get(key)
        if isinstance(value, list):
            text = " ".join(_safe_text(item) for item in value if _safe_text(item))
        else:
            text = _safe_text(value)
        if not text:
            continue
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=f"metadata:{key}",
            label=text,
            category=f"Metadata {key}",
            source_kind="metadata_reference",
            source_panel="source_media_metadata",
            item={"id": f"metadata:{key}", "text": text, "label": text},
        )


def _walk_visual_sample_clouds(analysis_id: str, status: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    visual = results.get("visual_analysis") if isinstance(results.get("visual_analysis"), dict) else {}
    cloud_payloads = [
        status.get("visual_sample_clouds"),
        visual.get("visual_sample_clouds") if isinstance(visual, dict) else None,
    ]
    for payload in cloud_payloads:
        for cloud_index, cloud in enumerate(_as_items((payload or {}).get("clouds") if isinstance(payload, dict) else None)):
            cloud_label = _safe_text(cloud.get("entity_label"), f"Visual cloud {cloud_index + 1}")
            samples = _as_items(cloud.get("samples"))
            if not samples:
                summary = cloud.get("cloud_summary") or {}
                yield _candidate(
                    analysis_id=analysis_id,
                    evidence_id=_safe_text(cloud.get("cloud_id"), f"visual:cloud:{cloud_index}"),
                    label=cloud_label,
                    category="Visual sample cloud",
                    source_kind="visual_sample_cloud",
                    source_panel="visual_sample_cloud",
                    item={
                        "id": cloud.get("cloud_id"),
                        "label": cloud_label,
                        "confidence": summary.get("average_confidence"),
                    },
                )
                continue
            for sample_index, sample in enumerate(samples):
                item = dict(sample)
                item.setdefault("label", cloud_label)
                if "timestamp_start" in item:
                    item.setdefault("start", item.get("timestamp_start"))
                if "timestamp_end" in item:
                    item.setdefault("end", item.get("timestamp_end"))
                yield _candidate(
                    analysis_id=analysis_id,
                    evidence_id=_safe_text(
                        item.get("sample_id"),
                        f"visual:sample:{cloud_index}:{sample_index}",
                    ),
                    label=_label_from_fields(
                        item,
                        ("label", "sample_role", "source_type", "open_note"),
                        cloud_label,
                    ),
                    category="Visual sample",
                    source_kind="visual_sample",
                    source_panel="visual_sample_cloud",
                    item=item,
                )


def _walk_source_samples(analysis_id: str, status: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    for index, item in enumerate(_as_items(status.get("source_samples"))):
        sample_type = _safe_text(item.get("sample_type"), "source_sample")
        visual = item.get("visual") if isinstance(item.get("visual"), dict) else {}
        region = visual.get("region") if isinstance(visual, dict) else None
        normalized_item = dict(item)
        if isinstance(region, dict):
            normalized_item["bbox"] = {
                "x": region.get("x"),
                "y": region.get("y"),
                "width": region.get("w"),
                "height": region.get("h"),
            }
        normalized_item.setdefault("start", item.get("time_start"))
        normalized_item.setdefault("end", item.get("time_end"))
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=_safe_text(item.get("sample_id"), f"source_sample:{index}"),
            label=_label_from_fields(item, ("label", "purpose", "sample_type"), "Source sample"),
            category=sample_type,
            source_kind="source_sample",
            source_panel="source_samples",
            item=normalized_item,
        )


def _walk_annotation_corrections(
    analysis_id: str,
    annotation_corrections: Dict[str, Any],
) -> Iterable[Dict[str, Any]]:
    for index, item in enumerate(annotation_corrections.get("manual_visual_annotations") or []):
        if not isinstance(item, dict):
            continue
        metadata = item.get("metadata_correlation") or {}
        label = (
            _safe_text(item.get("identity_affirmation"))
            or _safe_text(item.get("custom_label"))
            or _safe_text(item.get("label"))
            or _safe_text(metadata.get("target_label"))
            or "Manual visual annotation"
        )
        category = (
            _safe_text(item.get("category"))
            or _safe_text(item.get("subcategory"))
            or _safe_text(metadata.get("target_type"))
            or "Manual visual annotation"
        )
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=_safe_text(item.get("id"), f"manual_visual:{index}"),
            label=label,
            category=category,
            source_kind="manual_annotation",
            source_panel="manual_visual_annotations",
            item=item,
        )

    for index, item in enumerate(annotation_corrections.get("label_overrides") or []):
        if not isinstance(item, dict):
            continue
        corrected_value = _safe_text(item.get("corrected_value"))
        if corrected_value == "__drop__":
            continue
        label = corrected_value or _safe_text(item.get("raw_value")) or "Label correction"
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=_safe_text(item.get("id"), f"label_override:{index}"),
            label=label,
            category=_safe_text(item.get("modality"), "Correction"),
            source_kind="manual_correction",
            source_panel="annotation_corrections",
            item=item,
        )


def _walk_audio_evidence(analysis_id: str, status: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    nested_audio = (
        results.get("audio_analysis")
        if isinstance(results.get("audio_analysis"), dict)
        else {}
    )
    audio_diarization = _first_mapping(
        status.get("audio_diarization"),
        nested_audio.get("audio_diarization"),
    )
    measured_audio = audio_diarization.get("status") == "completed_measured"
    for index, item in enumerate(
        _as_items(audio_diarization.get("speaker_turns")) if measured_audio else []
    ):
        label = _label_from_fields(
            item,
            ("speaker_label", "text", "transcript_text", "speech_role_hint"),
            "Speaker turn",
        )
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=_safe_text(item.get("turn_id"), f"audio:turn:{index}"),
            label=label,
            category="Audio speaker turn",
            source_kind="audio_detection",
            source_panel="audio_panel",
            item=item,
        )

    audio_sample_clouds = _first_mapping(
        status.get("audio_sample_clouds"),
        nested_audio.get("audio_sample_clouds"),
    )
    for cloud_index, cloud in enumerate(_as_items(audio_sample_clouds.get("clouds"))):
        cloud_label = _safe_text(cloud.get("entity_label"), f"Audio cloud {cloud_index + 1}")
        for sample_index, sample in enumerate(_as_items(cloud.get("samples"))):
            label = _label_from_fields(
                sample,
                ("speaker_label", "transcript_text", "sample_role", "source_type"),
                cloud_label,
            )
            sample = {**sample, "label": f"{cloud_label} {label}"}
            yield _candidate(
                analysis_id=analysis_id,
                evidence_id=_safe_text(
                    sample.get("sample_id"),
                    f"audio:sample:{cloud_index}:{sample_index}",
                ),
                label=sample["label"],
                category="Audio sample",
                source_kind="audio_sample",
                source_panel="audio_panel",
                item=sample,
            )

    audio_prosody = _first_mapping(
        status.get("audio_prosody"),
        nested_audio.get("audio_prosody"),
    )
    for index, item in enumerate(_as_items(audio_prosody.get("cues") or status.get("audio_prosody"))):
        label = _label_from_fields(
            item,
            (
                "speaker_label",
                "rhythm_profile_label",
                "tonality_profile_label",
                "turn_transition_label",
                "sound_environment_label",
                "label",
            ),
            "Audio prosody cue",
        )
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=_safe_text(item.get("id"), f"audio:prosody:{index}"),
            label=label,
            category="Audio prosody",
            source_kind="audio_detection",
            source_panel="audio_panel",
            item=item,
        )


def _walk_visual_results(analysis_id: str, results: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    visual = results.get("visual_analysis") or {}
    tracked_objects = [
        item
        for item in visual.get("tracked_objects") or []
        if isinstance(item, dict)
    ]
    max_x = max(
        (_safe_float(item.get("bbox_x2"), 0.0) or 0.0 for item in tracked_objects),
        default=0.0,
    )
    max_y = max(
        (_safe_float(item.get("bbox_y2"), 0.0) or 0.0 for item in tracked_objects),
        default=0.0,
    )
    frame_width = 1280.0 if 1180 <= max_x <= 1320 else max_x
    frame_height = 720.0 if 650 <= max_y <= 760 else max_y
    audio_analysis = (
        results.get("audio_analysis")
        if isinstance(results.get("audio_analysis"), dict)
        else {}
    )
    audio_diarization = (
        audio_analysis.get("audio_diarization")
        if isinstance(audio_analysis.get("audio_diarization"), dict)
        and audio_analysis.get("audio_diarization", {}).get("status") == "completed_measured"
        else {}
    )
    measured_speaker_turns = [
        turn
        for turn in audio_diarization.get("speaker_turns") or []
        if isinstance(turn, dict)
    ]
    for index, item in enumerate(tracked_objects):
        if not isinstance(item, dict):
            continue
        class_name = (
            _safe_text(item.get("class_name"))
            or _safe_text(item.get("class"))
            or _safe_text(item.get("name"))
            or "object"
        )
        label = (
            _safe_text(item.get("label"))
            or _safe_text(item.get("display_label"))
            or _safe_text(item.get("class"))
            or _safe_text(item.get("class_name"))
            or _safe_text(item.get("name"))
            or _safe_text(item.get("track_label"))
            or f"track {item.get('track_id', index)}"
        )
        parent_start = _first_float(
            item.get("start"),
            item.get("start_timestamp"),
            item.get("timestamp"),
        )
        parent_end = _first_float(
            item.get("end"),
            item.get("end_timestamp"),
            item.get("timestamp"),
        )
        representative_time = _first_float(
            item.get("timestamp"),
            parent_start,
            parent_end,
        )
        review_start = max(0.0, (representative_time or 0.0) - 0.25)
        review_end = (representative_time or review_start) + 0.25
        overlapping_turns = []
        for turn in measured_speaker_turns:
            turn_start = _safe_float(turn.get("start"))
            turn_end = _safe_float(turn.get("end"), turn_start)
            if turn_start is None or turn_end is None:
                continue
            if turn_end >= review_start and turn_start <= review_end:
                overlapping_turns.append(
                    {
                        "turn_id": turn.get("turn_id"),
                        "speaker_label": turn.get("speaker_label"),
                        "start": turn_start,
                        "end": turn_end,
                        "text": turn.get("text"),
                        "diarization_confidence": turn.get("diarization_confidence"),
                        "measurement_status": turn.get("diarization_status"),
                    }
                )
        normalized_item = {
            **item,
            "class": class_name,
            "label": label,
            "start": review_start,
            "end": review_end,
            "representative_timestamp": representative_time,
            "parent_track_interval": {
                "start": parent_start,
                "end": parent_end,
            },
            "review_sample_duration_seconds": round(review_end - review_start, 3),
            "overlapping_measured_speaker_turns": overlapping_turns,
            "frame_width": frame_width,
            "frame_height": frame_height,
            "semantic_status": "unresolved_detector_substrate",
            "detector_substrate": True,
        }
        start_key = _safe_float(normalized_item.get("start"), 0.0) or 0.0
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=(
                f"detector:{class_name}:{item.get('track_id', index)}:"
                f"{start_key:.3f}:{index}"
            ),
            label=label,
            category=f"Detector substrate: {class_name}",
            source_kind="detector_substrate",
            source_panel="objects_panel",
            item=normalized_item,
        )
    for index, item in enumerate(visual.get("ocr_results") or []):
        if not isinstance(item, dict):
            continue
        label = _safe_text(item.get("text")) or _safe_text(item.get("label")) or "OCR text"
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=f"ocr:{index}",
            label=label,
            category="OCR",
            source_kind="raw_detection",
            source_panel="ocr_panel",
            item=item,
        )
    for index, item in enumerate(visual.get("expressions") or visual.get("expression_results") or []):
        if not isinstance(item, dict):
            continue
        label = _safe_text(item.get("emotion")) or _safe_text(item.get("label")) or "Expression"
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=f"expression:{index}",
            label=label,
            category="Expression",
            source_kind="raw_detection",
            source_panel="expressions_panel",
            item=item,
        )


def _walk_visual_and_cinematic_context(
    analysis_id: str,
    status: Dict[str, Any],
) -> Iterable[Dict[str, Any]]:
    summary = status.get("summary") if isinstance(status.get("summary"), dict) else {}
    visual = (
        (status.get("results") or {}).get("visual_analysis")
        if isinstance(status.get("results"), dict)
        else {}
    )
    context_groups = [
        ("visual_cue", "visual_cues", visual.get("visual_cues") if isinstance(visual, dict) else None),
        ("cinematic_clue", "cinematic_clues", visual.get("cinematic_clues") if isinstance(visual, dict) else None),
        ("cinematic_clue", "cinematic_clues", summary.get("cinematic_clues")),
        ("visual_cue", "visual_cues", summary.get("spatial_tone_scan")),
        ("visual_cue", "visual_cues", summary.get("motion_evidence")),
        ("cinematic_clue", "cinematic_clues", summary.get("scene_segments")),
    ]

    for source_kind, source_panel, group in context_groups:
        if not isinstance(group, (dict, list)):
            continue
        if isinstance(group, list):
            iterable = [("items", group)]
        else:
            iterable = list(group.items())
        for group_key, group_value in iterable:
            for index, item in enumerate(_as_items(group_value)):
                start = _first_float(item.get("start"), item.get("time_start"), item.get("start_ms"))
                end = _first_float(item.get("end"), item.get("time_end"), item.get("end_ms"))
                if start is not None and start > 1000:
                    start = start / 1000.0
                if end is not None and end > 1000:
                    end = end / 1000.0
                label = _label_from_fields(
                    item,
                    (
                        "label",
                        "cue_type",
                        "clue_type",
                        "dominant_label",
                        "frame_class",
                        "participant_id",
                        "target_id",
                    ),
                    str(group_key),
                )
                evidence_id = _safe_text(
                    item.get("evidence_id") or item.get("id"),
                    f"{source_panel}:{group_key}:{index}",
                )
                yield _candidate(
                    analysis_id=analysis_id,
                    evidence_id=evidence_id,
                    label=label,
                    category=source_panel.replace("_", " ").title(),
                    source_kind=source_kind,
                    source_panel=source_panel,
                    item=_item_with_interval(item, start=start, end=end),
                )


def collect_matchable_evidence(analysis_id: str, status: Dict[str, Any]) -> List[Dict[str, Any]]:
    evidence: List[Dict[str, Any]] = []
    evidence.extend(_walk_transcript(analysis_id, status))
    evidence.extend(_walk_source_metadata(analysis_id, status))
    evidence.extend(_walk_visual_sample_clouds(analysis_id, status))
    evidence.extend(_walk_source_samples(analysis_id, status))
    master_schema = status.get("vaa1_annotation_master_schema")
    if isinstance(master_schema, dict):
        evidence.extend(_walk_master_schema(analysis_id, master_schema))
    annotation_corrections = status.get("annotation_corrections")
    if isinstance(annotation_corrections, dict):
        evidence.extend(_walk_annotation_corrections(analysis_id, annotation_corrections))
    evidence.extend(_walk_audio_evidence(analysis_id, status))
    results = status.get("results")
    if isinstance(results, dict):
        evidence.extend(_walk_visual_results(analysis_id, results))
    evidence.extend(_walk_visual_and_cinematic_context(analysis_id, status))
    return evidence


def _interval_overlap_score(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    evidence_interval = (request.get("evidence") or {}).get("interval") or {}
    request_start = _safe_float(evidence_interval.get("start"))
    request_end = _safe_float(evidence_interval.get("end"), request_start)
    candidate_time = candidate.get("time") or {}
    candidate_start = _safe_float(candidate_time.get("start"))
    candidate_end = _safe_float(candidate_time.get("end"), candidate_start)
    if request_start is None or candidate_start is None:
        return 0.0
    request_end = request_end if request_end is not None else request_start
    candidate_end = candidate_end if candidate_end is not None else candidate_start
    if max(request_start, candidate_start) <= min(request_end, candidate_end):
        return 0.25
    distance = min(abs(candidate_start - request_end), abs(request_start - candidate_end))
    if distance <= 1.0:
        return 0.15
    if distance <= 5.0:
        return 0.08
    return 0.0


def _temporal_closeness_probability(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    evidence_interval = (request.get("evidence") or {}).get("interval") or {}
    request_start = _safe_float(evidence_interval.get("start"))
    request_end = _safe_float(evidence_interval.get("end"), request_start)
    candidate_time = candidate.get("time") or {}
    candidate_start = _safe_float(candidate_time.get("start"))
    candidate_end = _safe_float(candidate_time.get("end"), candidate_start)
    if request_start is None or candidate_start is None:
        return 0.0
    request_center = (request_start + (request_end if request_end is not None else request_start)) / 2.0
    candidate_center = (candidate_start + (candidate_end if candidate_end is not None else candidate_start)) / 2.0
    distance = abs(candidate_center - request_center)
    if distance <= 0.25:
        return 1.0
    if distance <= 1.0:
        return 0.85
    if distance <= 3.0:
        return 0.55
    if distance <= 8.0:
        return 0.25
    return 0.0


def _contextual_source_score(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    target = _safe_text(request.get("target"))
    source_panel = _safe_text(candidate.get("source_panel"))
    category = _safe_text(candidate.get("category")).lower()
    if target == "character_continuity" and source_panel in {
        "transcript_panel",
        "source_media_metadata",
        "audio_panel",
        "visual_cues",
        "cinematic_clues",
    }:
        return 0.1
    if target in {"action", "interaction", "scene_episode", "visual_pattern"} and (
        "visual" in category or "cinematic" in category
    ):
        return 0.1
    if target in {"speaker_voice_continuity", "sound_event", "music_motif", "ambient_sound", "prosody_delivery_pattern"} and (
        source_panel == "audio_panel" or category.startswith("audio")
    ):
        return 0.1
    if target == "named_entity" and source_panel in {
        "ocr_panel",
        "transcript_panel",
        "source_media_metadata",
        "manual_visual_annotations",
    }:
        return 0.1
    if target == "scene_setting" and (
        source_panel in {"visual_cues", "cinematic_clues", "source_media_metadata"}
        or bool(_tokenize(candidate.get("label")) & SETTING_TOKENS)
    ):
        return 0.1
    return 0.0


def _contextual_probability(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    target = _safe_text(request.get("target"))
    source_panel = _safe_text(candidate.get("source_panel"))
    category = _safe_text(candidate.get("category")).lower()
    if target == "character_continuity":
        compatibility = _character_candidate_compatibility(request, candidate)
        if compatibility == "direct_identity":
            return 0.9
        if compatibility in {"unknown_person", "known_identity_option"}:
            return 0.55
        if compatibility == "contextual_support":
            return 0.3
        return 0.0
    if target in {"speaker_voice_continuity", "prosody_delivery_pattern"} and source_panel == "audio_panel":
        return 0.9
    if target in {"action", "interaction", "scene_episode", "visual_pattern"} and (
        "visual" in category or "cinematic" in category or source_panel == "objects_panel"
    ):
        return 0.8
    if target == "named_entity" and source_panel in {
        "ocr_panel",
        "transcript_panel",
        "source_media_metadata",
        "manual_visual_annotations",
    }:
        return 0.82
    if target == "scene_setting" and (
        source_panel in {"visual_cues", "cinematic_clues", "source_media_metadata"}
        or bool(_tokenize(candidate.get("label")) & SETTING_TOKENS)
    ):
        return 0.78
    return 0.35


def _track_continuity_score(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    evidence = request.get("evidence") or {}
    source_track_id = _safe_text(evidence.get("source_track_id"))
    candidate_track_id = _safe_text((candidate.get("raw") or {}).get("track_id"))
    if source_track_id and candidate_track_id and source_track_id == candidate_track_id:
        return 0.35
    return 0.0


def _track_continuity_probability(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    return 1.0 if _track_continuity_score(request, candidate) > 0 else 0.0


def _spatial_consistency_probability(request: Dict[str, Any], candidate: Dict[str, Any]) -> Optional[float]:
    evidence = request.get("evidence") or {}
    seed_box = _bbox_from_geometry(evidence.get("geometry"))
    candidate_box = _bbox_from_geometry(candidate.get("geometry"))
    if not seed_box or not candidate_box:
        return None
    iou = _bbox_iou(seed_box, candidate_box)
    distance = _bbox_center_distance(seed_box, candidate_box)
    if iou >= 0.45:
        return 1.0
    if iou >= 0.25:
        return 0.82
    if iou >= 0.08:
        return 0.58
    if distance <= 0.12:
        return 0.45
    if distance <= 0.18:
        return 0.3
    return 0.0


def _spatial_consistency_score(request: Dict[str, Any], candidate: Dict[str, Any]) -> Optional[float]:
    probability = _spatial_consistency_probability(request, candidate)
    return None if probability is None else round(probability * 0.3, 4)


def _is_person_continuity_candidate(request: Dict[str, Any], candidate: Dict[str, Any]) -> bool:
    if _safe_text(request.get("target")) != "character_continuity":
        return False
    if candidate.get("source_panel") != "objects_panel":
        return False
    candidate_tokens = _tokenize(candidate.get("label")) | _tokenize(candidate.get("category"))
    seed_tokens = _tokenize((request.get("evidence") or {}).get("source_label"))
    return "person" in candidate_tokens or "person" in seed_tokens


def _text_probability(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    evidence = request.get("evidence") or {}
    seed_tokens = (
        _tokenize(evidence.get("label"))
        | _tokenize(evidence.get("source_label"))
        | _tokenize(evidence.get("category"))
    )
    candidate_tokens = _tokenize(candidate.get("label")) | _tokenize(candidate.get("category"))
    union = len(seed_tokens | candidate_tokens) or 1
    return len(seed_tokens & candidate_tokens) / union


def _sample_cloud_probability(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    source_panel = _safe_text(candidate.get("source_panel"))
    if source_panel not in {"visual_sample_cloud", "audio_panel", "source_samples"}:
        return 0.0
    confidence = _safe_float((candidate.get("raw") or {}).get("confidence"))
    text = _text_probability(request, candidate)
    if confidence is None:
        return text
    return max(text, confidence)


def _is_known_or_sample_anchor(candidate: Dict[str, Any]) -> bool:
    return _safe_text(candidate.get("source_kind")) in {
        "manual_correction",
        "manual_annotation",
        "visual_sample",
        "visual_sample_cloud",
        "audio_sample",
        "source_sample",
        "metadata_reference",
    } or _safe_text(candidate.get("source_panel")) in {
        "manual_visual_annotations",
        "visual_sample_cloud",
        "audio_panel",
        "source_samples",
        "source_media_metadata",
        "master_schema",
    }


def _cross_scene_continuity_probability(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    target = _safe_text(request.get("target"))
    if target not in {"character_continuity", "speaker_voice_continuity", "object", "visual_pattern"}:
        return 0.0

    source_kind = _safe_text(candidate.get("source_kind"))
    source_panel = _safe_text(candidate.get("source_panel"))
    source_anchors = _candidate_source_anchors(candidate)
    if not source_anchors:
        return 0.0

    if target == "character_continuity":
        compatibility = _character_candidate_compatibility(request, candidate)
        if compatibility == "incompatible":
            return 0.0
        if compatibility == "direct_identity":
            if source_kind in {"manual_correction", "manual_annotation"}:
                return 0.95
            if source_panel in {"visual_sample_cloud", "source_samples"}:
                return 0.9
            if source_panel == "source_media_metadata":
                return 0.72
        if compatibility in {"unknown_person", "known_identity_option"}:
            if compatibility == "known_identity_option" and source_kind in {
                "manual_correction",
                "manual_annotation",
            }:
                return 0.72
            if _track_continuity_probability(request, candidate) > 0:
                return 0.82
            spatial = _spatial_consistency_probability(request, candidate)
            if spatial is not None and spatial >= 0.58:
                return 0.62
        return 0.0

    if source_kind in {"manual_correction", "manual_annotation"}:
        return 0.95
    if source_panel in {"visual_sample_cloud", "source_samples"}:
        return 0.9
    if source_panel == "audio_panel" and target == "speaker_voice_continuity":
        return 0.9
    if source_panel == "source_media_metadata" and target == "character_continuity":
        return 0.72
    if _track_continuity_probability(request, candidate) > 0:
        return 0.82
    spatial = _spatial_consistency_probability(request, candidate)
    if spatial is not None and spatial >= 0.58:
        return 0.62
    return 0.0


def _constellation_anchor_fit(
    candidate: Dict[str, Any],
    record: Dict[str, Any],
) -> Dict[str, Any]:
    candidate_time = candidate.get("time") or {}
    candidate_start = _safe_float(candidate_time.get("start"))
    candidate_end = _safe_float(candidate_time.get("end"), candidate_start)
    candidate_box = _bbox_from_geometry(candidate.get("geometry"))
    time_fit = 0.0
    spatial_fit = 0.0
    for anchor in record.get("source_anchors") or []:
        if not isinstance(anchor, dict):
            continue
        anchor_time = _decision_anchor_time(anchor)
        anchor_start = anchor_time.get("start")
        anchor_end = anchor_time.get("end")
        if candidate_start is not None and anchor_start is not None:
            candidate_center = (
                candidate_start + (candidate_end if candidate_end is not None else candidate_start)
            ) / 2.0
            anchor_center = (
                anchor_start + (anchor_end if anchor_end is not None else anchor_start)
            ) / 2.0
            distance = abs(candidate_center - anchor_center)
            if distance <= 0.25:
                time_fit = max(time_fit, 1.0)
            elif distance <= 1.0:
                time_fit = max(time_fit, 0.85)
            elif distance <= 4.0:
                time_fit = max(time_fit, 0.55)
            elif distance <= 12.0:
                time_fit = max(time_fit, 0.25)
        anchor_box = _bbox_from_geometry(_decision_anchor_geometry(anchor))
        if candidate_box and anchor_box:
            iou = _bbox_iou(candidate_box, anchor_box)
            distance = _bbox_center_distance(candidate_box, anchor_box)
            if iou >= 0.45:
                spatial_fit = max(spatial_fit, 1.0)
            elif iou >= 0.25:
                spatial_fit = max(spatial_fit, 0.82)
            elif iou >= 0.08:
                spatial_fit = max(spatial_fit, 0.58)
            elif distance <= 0.12:
                spatial_fit = max(spatial_fit, 0.45)
            elif distance <= 0.18:
                spatial_fit = max(spatial_fit, 0.3)
    target_evidence_id = _safe_text(record.get("target_evidence_id"))
    evidence_id = _safe_text(candidate.get("evidence_id"))
    candidate_id = _safe_text(candidate.get("candidate_id"))
    id_fit = 1.0 if target_evidence_id and target_evidence_id in {evidence_id, candidate_id} else 0.0
    return {
        "time_fit": round(time_fit, 4),
        "spatial_fit": round(spatial_fit, 4),
        "id_fit": round(id_fit, 4),
        "overall": round(max(time_fit * 0.5 + spatial_fit * 0.5, spatial_fit, id_fit), 4),
    }


def _constellation_memory_profile(
    request: Dict[str, Any],
    candidate: Dict[str, Any],
    constellation_index: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    if not constellation_index:
        return {"positive_support": 0.0, "negative_support": 0.0, "net_support": 0.0}
    evidence = request.get("evidence") or {}
    key = _canonical_constellation_key(evidence.get("label") or evidence.get("source_label"))
    constellation = (constellation_index.get("constellations") or {}).get(key)
    if not constellation:
        return {"positive_support": 0.0, "negative_support": 0.0, "net_support": 0.0}

    positive_fits = [
        _constellation_anchor_fit(candidate, record)
        for record in constellation.get("positive") or []
        if isinstance(record, dict)
    ]
    negative_fits = [
        _constellation_anchor_fit(candidate, record)
        for record in constellation.get("negative") or []
        if isinstance(record, dict)
    ]
    positive_support = max((fit["overall"] for fit in positive_fits), default=0.0)
    negative_support = max((fit["overall"] for fit in negative_fits), default=0.0)
    positive_count = len(constellation.get("positive") or [])
    # A larger confirmed constellation should make nearby raw detections easier
    # to place, but it should not erase the need for source-linked review.
    density_boost = min(0.18, max(0, positive_count - 1) * 0.035)
    positive_support = min(1.0, positive_support + density_boost) if positive_support > 0 else 0.0
    net_support = max(0.0, positive_support - (negative_support * 0.9))
    return {
        "schema": "vaa1.mature_constellation_memory_profile.v1",
        "constellation_key": key,
        "constellation_label": constellation.get("label"),
        "positive_anchor_count": positive_count,
        "negative_anchor_count": len(constellation.get("negative") or []),
        "positive_support": round(positive_support, 4),
        "negative_support": round(negative_support, 4),
        "net_support": round(net_support, 4),
        "best_positive_fit": max(positive_fits, key=lambda item: item["overall"], default=None),
        "best_negative_fit": max(negative_fits, key=lambda item: item["overall"], default=None),
    }


def _closest_match_profile(
    request: Dict[str, Any],
    candidate: Dict[str, Any],
    constellation_index: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    spatial = _spatial_consistency_probability(request, candidate)
    cross_scene = _cross_scene_continuity_probability(request, candidate)
    constellation_memory = _constellation_memory_profile(
        request,
        candidate,
        constellation_index,
    )
    components = {
        "text_semantic": round(_text_probability(request, candidate), 4),
        "time_proximity": round(_temporal_closeness_probability(request, candidate), 4),
        "spatial_consistency": None if spatial is None else round(spatial, 4),
        "track_continuity": round(_track_continuity_probability(request, candidate), 4),
        "contextual_modality": round(_contextual_probability(request, candidate), 4),
        "sample_cloud_support": round(_sample_cloud_probability(request, candidate), 4),
        "cross_scene_continuity": round(cross_scene, 4),
    }
    weights = {
        "text_semantic": 0.16,
        "time_proximity": 0.12,
        "spatial_consistency": 0.22 if spatial is not None else 0.0,
        "track_continuity": 0.18,
        "contextual_modality": 0.12,
        "sample_cloud_support": 0.1,
        "cross_scene_continuity": 0.22,
    }
    active_weight = sum(
        weight
        for key, weight in weights.items()
        if components.get(key) is not None and float(components.get(key) or 0.0) > 0.0
    )
    probability = 0.0
    for key, weight in weights.items():
        value = components.get(key)
        if value is None or float(value or 0.0) <= 0.0 or active_weight <= 0:
            continue
        probability += (value * weight) / active_weight
    memory_support = float(constellation_memory.get("net_support") or 0.0)
    if memory_support > 0:
        probability = max(probability, min(0.88, probability + (memory_support * 0.22)))
    negative_support = float(constellation_memory.get("negative_support") or 0.0)
    if negative_support > 0:
        probability = max(0.0, probability - (negative_support * 0.2))
    compatibility = _character_candidate_compatibility(request, candidate)
    if compatibility in {"unknown_person", "known_identity_option"}:
        probability = min(probability, 0.86 if memory_support > 0 else 0.62)
    elif compatibility == "contextual_support":
        probability = min(probability, 0.44)
    elif compatibility == "incompatible":
        probability = 0.0
    return {
        "principle": "closest_match",
        "match_probability": round(max(0.0, min(1.0, probability)), 4),
        "identity_compatibility": compatibility,
        "components": components,
        "weights": weights,
        "constellation_memory": constellation_memory,
        "source_timesphere": candidate.get("source_timesphere"),
        "seed_timesphere": _timesphere_from_seed(request),
    }


def _timesphere_from_seed(request: Dict[str, Any]) -> Dict[str, Any]:
    evidence = request.get("evidence") or {}
    interval = evidence.get("interval") or {}
    start = _safe_float(interval.get("start"))
    end = _safe_float(interval.get("end"), start)
    box = _bbox_from_geometry(evidence.get("geometry"))
    return {
        "time": {
            "start": start,
            "end": end,
            "center": ((start or 0.0) + (end or start or 0.0)) / 2.0
            if start is not None
            else None,
        },
        "coordinate": {
            "bbox": box,
            "center": {
                "x": box["x"] + (box["width"] / 2.0),
                "y": box["y"] + (box["height"] / 2.0),
            }
            if box
            else None,
            "area": box["width"] * box["height"] if box else None,
        },
        "source_track_id": evidence.get("source_track_id"),
        "modality": evidence.get("modality"),
    }


def _probability_band(probability: float) -> str:
    if probability >= NEAR_MATCH_PROBABILITY_POLICY["very_high_probability"]:
        return "very_high_probability"
    if probability >= NEAR_MATCH_PROBABILITY_POLICY["strongly_supported"]:
        return "strongly_supported"
    if probability >= NEAR_MATCH_PROBABILITY_POLICY["probable_candidate"]:
        return "probable_candidate"
    if probability >= NEAR_MATCH_PROBABILITY_POLICY["surface_to_analyst"]:
        return "surface_to_analyst"
    if probability >= NEAR_MATCH_PROBABILITY_POLICY["candidate_floor"]:
        return "below_surface_candidate"
    return "blocked_from_proliferation"


def _candidate_source_anchors(candidate: Dict[str, Any]) -> List[Dict[str, Any]]:
    anchors: List[Dict[str, Any]] = []
    time = candidate.get("time") or {}
    start = _safe_float(time.get("start"))
    end = _safe_float(time.get("end"), start)
    if start is not None:
        anchors.append(
            {
                "anchor_id": f"{candidate.get('evidence_id', 'candidate')}:time",
                "anchor_type": "media_time_interval",
                "time_interval": {
                    "start_seconds": start,
                    "end_seconds": end,
                    "start_ms": int(start * 1000),
                    "end_ms": int((end if end is not None else start) * 1000),
                },
                "panel_source": candidate.get("source_panel"),
            }
        )
    box = _bbox_from_geometry(candidate.get("geometry"))
    if box:
        anchors.append(
            {
                "anchor_id": f"{candidate.get('evidence_id', 'candidate')}:bbox",
                "anchor_type": "bbox",
                "bbox": {**box, "coordinate_system": "normalized_or_source_frame"},
                "panel_source": candidate.get("source_panel"),
            }
        )
    return anchors


def _authority_level_for_candidate(candidate: Dict[str, Any], probability: float) -> str:
    source_kind = _safe_text(candidate.get("source_kind"))
    if source_kind == "manual_correction":
        return "manual_correction"
    if source_kind == "manual_annotation":
        return "manual_annotation"
    if probability >= NEAR_MATCH_PROBABILITY_POLICY["very_high_probability"]:
        return "mature_triangulated_evidence"
    if probability >= NEAR_MATCH_PROBABILITY_POLICY["surface_to_analyst"]:
        return "supported_candidate"
    return "single_modality_candidate"


def _review_state_for_candidate(candidate: Dict[str, Any], probability: float) -> str:
    if candidate.get("source_kind") in {"manual_correction", "manual_annotation"}:
        return "candidate_manual_source"
    band = _probability_band(probability)
    if band == "very_high_probability":
        return "very_high_probability_candidate"
    if band in {"strongly_supported", "probable_candidate"}:
        return "to_be_confirmed_or_canceled"
    if band == "surface_to_analyst":
        return "review_candidate"
    return "below_surface_candidate"


def _candidate_role_for_match(
    request: Dict[str, Any],
    candidate: Dict[str, Any],
) -> str:
    if _safe_text(request.get("target")) != "character_continuity":
        return "identity_candidate"

    compatibility = _character_candidate_compatibility(request, candidate)
    if _safe_text(candidate.get("source_panel")) in {
        "transcript_panel",
        "ocr_panel",
        "source_media_metadata",
        "audio_panel",
        "visual_cues",
        "cinematic_clues",
    }:
        return "context_support"
    if compatibility == "contextual_support":
        return "context_support"
    if compatibility == "incompatible":
        return "conflict"
    if compatibility == "direct_identity" and _is_known_or_sample_anchor(candidate):
        return "anchor_sample"
    return "identity_candidate"


def _allowed_actions_for_candidate_role(role: str) -> List[str]:
    if role == "identity_candidate":
        return ["confirm", "cancel", "defer", "inspect_sources"]
    if role == "anchor_sample":
        return ["inspect_sources"]
    if role == "context_support":
        return ["inspect_sources", "defer"]
    return ["inspect_sources", "defer"]


def _candidate_projection_targets(candidate: Dict[str, Any], request: Dict[str, Any]) -> List[str]:
    targets = set(PROJECTION_TARGETS_BY_SOURCE_PANEL.get(_safe_text(candidate.get("source_panel")), []))
    target = _safe_text(request.get("target"))
    if target in {"character_continuity", "speaker_voice_continuity"}:
        targets.update(["narrative_agent_panel", "evidence_graph"])
    if target in {"scene_episode", "action", "interaction", "visual_pattern"}:
        targets.update(["scene_card_panel", "meaning_plot_panel", "evidence_graph"])
    targets.update(["governance_matrix", "search_index"])
    return sorted(targets)


def _governance_status(
    candidate: Dict[str, Any],
    probability: float,
    source_anchors: List[Dict[str, Any]],
    candidate_role: str,
) -> Dict[str, Any]:
    source_kind = _safe_text(candidate.get("source_kind"))
    manual_authority = source_kind in {"manual_correction", "manual_annotation"}
    very_high = probability >= NEAR_MATCH_PROBABILITY_POLICY["auto_proliferation_allowed_above"]
    has_anchor = bool(source_anchors)
    if candidate_role == "anchor_sample":
        proliferation_allowed = False
        review_required = False
        review_reason = "Known identity sample already has mature authority and is guidance, not a new promotion."
    elif candidate_role == "context_support":
        proliferation_allowed = False
        review_required = False
        review_reason = "Context supports interpretation but cannot be confirmed as visual identity."
    elif candidate_role == "conflict":
        proliferation_allowed = False
        review_required = True
        review_reason = "Conflicting identity evidence is inspection-only and cannot be promoted as this identity."
    elif not has_anchor:
        proliferation_allowed = False
        review_required = True
        review_reason = "Candidate lacks a source anchor and cannot proliferate."
    else:
        proliferation_allowed = bool((manual_authority or very_high) and has_anchor)
        review_required = not proliferation_allowed
    if candidate_role == "identity_candidate" and has_anchor and proliferation_allowed:
        review_reason = "Proliferation allowed by manual authority or very high probability with traceback."
    elif candidate_role == "identity_candidate" and has_anchor:
        review_reason = "Near match must be confirmed or canceled before it can proliferate."
    return {
        "active": True,
        "proliferation_allowed": proliferation_allowed,
        "review_required": review_required,
        "review_reason": review_reason,
        "conflict_state": "none",
        "unknown_override_blocked": True,
    }


def _maturity_score_from_match(
    closest_match: Dict[str, Any],
    candidate: Dict[str, Any],
    probability: float,
) -> Dict[str, Any]:
    components = closest_match.get("components") or {}
    source_kind = _safe_text(candidate.get("source_kind"))
    manual_authority = 1.0 if source_kind in {"manual_correction", "manual_annotation"} else 0.0
    source_traceability = 1.0 if _candidate_source_anchors(candidate) else 0.0
    cross_modal_support = 1.0 if components.get("sample_cloud_support", 0) and components.get("contextual_modality", 0) else 0.0
    temporal_spatial_values = [
        value
        for value in (components.get("time_proximity"), components.get("spatial_consistency"))
        if isinstance(value, (int, float))
    ]
    temporal_spatial_fit = (
        sum(float(value) for value in temporal_spatial_values) / len(temporal_spatial_values)
        if temporal_spatial_values
        else 0.0
    )
    score_components = {
        "manual_authority": round(manual_authority, 4),
        "source_traceability": round(source_traceability, 4),
        "cross_modal_support": round(cross_modal_support, 4),
        "temporal_spatial_fit": round(temporal_spatial_fit, 4),
        "semantic_fit": round(float(components.get("text_semantic") or 0.0), 4),
        "sample_cloud_support": round(float(components.get("sample_cloud_support") or 0.0), 4),
        "cross_scene_continuity": round(float(components.get("cross_scene_continuity") or 0.0), 4),
        "metadata_support": 1.0 if candidate.get("source_panel") == "source_media_metadata" else 0.0,
    }
    open_weights = {
        "manual_authority": 0.22,
        "source_traceability": 0.18,
        "cross_modal_support": 0.14,
        "temporal_spatial_fit": 0.14,
        "semantic_fit": 0.12,
        "sample_cloud_support": 0.1,
        "cross_scene_continuity": 0.14,
        "metadata_support": 0.06,
    }
    return {
        "overall_score": round(probability, 4),
        "components": score_components,
        "open_weights": open_weights,
    }


def _situational_options_for_candidate(
    request: Dict[str, Any],
    candidate: Dict[str, Any],
    probability: float,
) -> List[Dict[str, Any]]:
    target = _safe_text(request.get("target"))
    source_panel = _safe_text(candidate.get("source_panel"))
    if target not in {"character_continuity", "visual_pattern", "interaction", "scene_episode"}:
        return []
    if probability < NEAR_MATCH_PROBABILITY_POLICY["probable_candidate"]:
        return []
    options = []
    if source_panel in {"objects_panel", "visual_sample_cloud", "manual_visual_annotations"}:
        options.append("similar_visual_situation")
    if source_panel in {"transcript_panel", "audio_panel"}:
        options.append("similar_speaking_situation")
    if source_panel in {"visual_cues", "cinematic_clues"}:
        options.append("similar_scene_situation")
    return [
        {
            "candidate_type": "situational_mirror_candidate",
            "situational_option": option,
            "origin_request_id": request.get("request_id"),
            "candidate_evidence_id": candidate.get("evidence_id"),
            "probability": probability,
            "review_state": "to_be_confirmed_or_canceled",
            "proliferation_allowed": False,
            "proliferation_reason": "Situational mirrors are suggestions until analyst confirmation or very high evidence support.",
            "allowed_actions": ["confirm", "cancel", "defer", "inspect_sources"],
        }
        for option in options
    ]


def _govern_candidate(
    *,
    analysis_id: str,
    request: Dict[str, Any],
    item: Dict[str, Any],
    score: float,
    closest_match: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    probability = closest_match["match_probability"]
    band = _probability_band(probability)
    if probability < NEAR_MATCH_PROBABILITY_POLICY["candidate_floor"]:
        return None
    source_anchors = _candidate_source_anchors(item)
    candidate_role = _candidate_role_for_match(request, item)
    authority_level = _authority_level_for_candidate(item, probability)
    maturity_state = "probable" if band in {"probable_candidate", "strongly_supported"} else band
    governance_status = _governance_status(
        item,
        probability,
        source_anchors,
        candidate_role,
    )
    candidate_id = f"{request.get('request_id', 'request')}:{item['evidence_id']}"
    evidence_refs = [
        {
            "evidence_id": item["evidence_id"],
            "evidence_kind": "proliferated_candidate",
            "authority_level": authority_level,
            "support_score": probability,
            "provenance_note": "Evidence surfaced by mature-data proliferation matcher.",
        }
    ]
    cluster_context = {
        "cluster_id": f"open-topology:{request.get('target', 'pattern')}:{item.get('source_panel')}:{band}",
        "cluster_basis": [
            "source_panel",
            "probability_band",
            "target_category",
        ],
        "topology_mode": "open_topology_som",
    }
    raw = item.get("raw") if isinstance(item.get("raw"), dict) else {}
    parent_track_interval = (
        raw.get("parent_track_interval")
        if isinstance(raw.get("parent_track_interval"), dict)
        else {}
    )
    measured_turns = [
        turn
        for turn in raw.get("overlapping_measured_speaker_turns") or []
        if isinstance(turn, dict)
    ]
    constellation_memory = closest_match.get("constellation_memory") or {}
    memory_reason = (
        "mature_constellation_memory"
        if float(constellation_memory.get("net_support") or 0.0) > 0
        else ""
    )
    presence_claims = {
        "visual_presence": {
            "status": "confirmable",
            "time": item.get("time"),
            "geometry": item.get("geometry"),
            "evidence_basis": "representative_detector_frame",
        },
        "scene_presence": {
            "status": "review_supported",
            "time": parent_track_interval or item.get("time"),
            "evidence_basis": "parent_detector_track",
            "requires_scene_boundary_join": True,
        },
        "speaking": {
            "status": "review_required" if measured_turns else "audio_evidence_absent",
            "measured_speaker_turns": measured_turns,
            "identity_attribution": "unresolved",
            "evidence_basis": "measured_audio_overlap" if measured_turns else None,
        },
        "listening": {
            "status": "review_required" if measured_turns else "audio_evidence_absent",
            "measured_speaker_turns": measured_turns,
            "identity_attribution": "unresolved",
            "evidence_basis": "visible_during_measured_speech" if measured_turns else None,
        },
    }
    return {
        "candidate_id": candidate_id,
        "master_object_projection": {
            "schema": GOVERNANCE_SCHEMA,
            "master_object_id": f"candidate:{candidate_id}",
            "object_family": "NarrativeAgent"
            if _safe_text(request.get("target")) in {"character_continuity", "speaker_voice_continuity"}
            else "TracebackNode",
            "current_label": item.get("label"),
            "maturity_state": maturity_state,
            "authority_level": authority_level,
            "confidence": probability,
            "maturity_score": _maturity_score_from_match(closest_match, item, probability),
            "source_anchors": source_anchors,
            "evidence_refs": evidence_refs,
            "traceback_ref": f"traceback:{candidate_id}",
            "projection_targets": _candidate_projection_targets(item, request),
            "governance_status": governance_status,
        },
        "match_score": probability,
        "match_probability": probability,
        "similarity_score": probability,
        "probability_band": band,
        "legacy_match_score": score,
        "closest_match": closest_match,
        "candidate_role": candidate_role,
        "review_state": _review_state_for_candidate(item, probability),
        "review_required": governance_status["review_required"],
        "decision_required": candidate_role == "identity_candidate"
        and governance_status["review_required"],
        "allowed_actions": _allowed_actions_for_candidate_role(candidate_role),
        "blocked_actions": [] if governance_status["proliferation_allowed"] else ["auto_promote_without_decision"],
        "proliferation_allowed": governance_status["proliferation_allowed"],
        "proliferation_reason": governance_status["review_reason"],
        "source_verification_class": "known_verified_sample"
        if _is_known_or_sample_anchor(item)
        else "unknown_similar_candidate",
        "source_navigation": {
            "has_time": any(
                anchor.get("anchor_type") == "media_time_interval"
                for anchor in source_anchors
                if isinstance(anchor, dict)
            ),
            "has_bbox": any(
                anchor.get("anchor_type") == "bbox"
                for anchor in source_anchors
                if isinstance(anchor, dict)
            ),
            "open_actions": ["open_source_time", "show_bbox_roi", "open_traceback"],
        },
        "source_anchors": source_anchors,
        "source_refs": [
            anchor.get("anchor_id")
            for anchor in source_anchors
            if isinstance(anchor, dict) and anchor.get("anchor_id")
        ],
        "evidence_refs": evidence_refs,
        "projection_targets": _candidate_projection_targets(item, request),
        "cluster_context": cluster_context,
        "presence_claims": presence_claims,
        "reason_for_match": ", ".join(
            [
                *[
                    key
                    for key, value in (closest_match.get("components") or {}).items()
                    if isinstance(value, (int, float)) and value > 0
                ],
                *([memory_reason] if memory_reason else []),
            ]
        )
        or "open topology candidate support",
        "constellation_memory": constellation_memory,
        "situational_options": _situational_options_for_candidate(request, item, probability),
        "provenance": {
            "request_id": request.get("request_id"),
            "source_evidence": request.get("evidence"),
            "candidate_evidence_id": item["evidence_id"],
            "candidate_source_kind": item["source_kind"],
            "governance_schema": GOVERNANCE_SCHEMA,
            "constellation_memory": constellation_memory,
        },
        **item,
    }


def _score_candidate(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    evidence = request.get("evidence") or {}
    if candidate.get("evidence_id") == evidence.get("overlay_key"):
        return 0.0
    compatibility = _character_candidate_compatibility(request, candidate)
    if compatibility == "incompatible":
        return 0.0
    seed_tokens = (
        _tokenize(evidence.get("label"))
        | _tokenize(evidence.get("source_label"))
        | _tokenize(evidence.get("category"))
    )
    candidate_tokens = _tokenize(candidate.get("label")) | _tokenize(candidate.get("category"))
    overlap = len(seed_tokens & candidate_tokens)
    union = len(seed_tokens | candidate_tokens) or 1
    text_score = overlap / union

    target = _safe_text(request.get("target"))
    target_hints = TARGET_CATEGORY_HINTS.get(target, set())
    hint_score = 0.2 if target_hints & candidate_tokens else 0.0
    manual_score = 0.15 if candidate.get("source_kind") == "manual_annotation" else 0.0
    cross_scene_score = 0.2 if _cross_scene_continuity_probability(request, candidate) > 0 else 0.0
    track_score = _track_continuity_score(request, candidate)
    spatial_score = _spatial_consistency_score(request, candidate)
    if (
        track_score <= 0
        and spatial_score == 0.0
        and _is_person_continuity_candidate(request, candidate)
    ):
        return 0.0
    temporal_score = _interval_overlap_score(request, candidate)
    contextual_score = _contextual_source_score(request, candidate)
    score = (
        text_score
        + hint_score
        + manual_score
        + cross_scene_score
        + track_score
        + (spatial_score or 0.0)
        + temporal_score
        + contextual_score
    )
    return max(0.0, min(1.0, round(score, 4)))


def _candidate_time_center(candidate: Dict[str, Any]) -> Optional[float]:
    time = candidate.get("time") or {}
    start = _safe_float(time.get("start"))
    end = _safe_float(time.get("end"), start)
    if start is None:
        return None
    return ((start or 0.0) + (end or start or 0.0)) / 2.0


def _same_timespace_continuum(left: Dict[str, Any], right: Dict[str, Any]) -> bool:
    if left.get("source_panel") != "objects_panel" or right.get("source_panel") != "objects_panel":
        return False
    left_tokens = _tokenize(left.get("label")) | _tokenize(left.get("category"))
    right_tokens = _tokenize(right.get("label")) | _tokenize(right.get("category"))
    if "person" not in left_tokens and "person" not in right_tokens:
        return False
    left_center = _candidate_time_center(left)
    right_center = _candidate_time_center(right)
    if left_center is None or right_center is None or abs(left_center - right_center) > 0.2:
        return False
    left_box = _bbox_from_geometry(left.get("geometry"))
    right_box = _bbox_from_geometry(right.get("geometry"))
    if not left_box or not right_box:
        return False
    return _bbox_iou(left_box, right_box) >= 0.45 or _bbox_center_distance(left_box, right_box) <= 0.08


def _cluster_same_timespace_candidates(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    clustered: List[Dict[str, Any]] = []
    for candidate in candidates:
        cluster_index = next(
            (
                index
                for index, existing in enumerate(clustered)
                if _same_timespace_continuum(existing, candidate)
            ),
            None,
        )
        if cluster_index is None:
            candidate.setdefault("maturity_state", "supported_candidate")
            clustered.append(candidate)
            continue

        existing = clustered[cluster_index]
        winner = candidate if candidate.get("match_probability", 0) > existing.get("match_probability", 0) else existing
        loser = existing if winner is candidate else candidate
        provenance = dict(winner.get("provenance") or {})
        merged_ids = list(provenance.get("merged_candidate_evidence_ids") or [])
        for evidence_id in (
            loser.get("evidence_id"),
            (loser.get("provenance") or {}).get("candidate_evidence_id"),
        ):
            if evidence_id and evidence_id not in merged_ids:
                merged_ids.append(evidence_id)
        provenance["merged_candidate_evidence_ids"] = merged_ids
        raw = dict(winner.get("raw") or {})
        loser_raw = loser.get("raw") if isinstance(loser.get("raw"), dict) else {}
        raw["proliferation_hit_count"] = int(raw.get("proliferation_hit_count") or 1) + int(
            loser_raw.get("proliferation_hit_count") or 1
        )
        if loser_raw.get("track_id") is not None:
            raw.setdefault("merged_track_ids", [])
            if loser_raw["track_id"] not in raw["merged_track_ids"]:
                raw["merged_track_ids"].append(loser_raw["track_id"])
        clustered[cluster_index] = {
            **winner,
            "label": "Person track" if _safe_text(winner.get("label")).lower() == "person" else winner.get("label"),
            "maturity_state": winner.get("maturity_state") or "supported_candidate",
            "provenance": provenance,
            "raw": raw,
        }
    return clustered


def _candidate_review_quality(candidate: Dict[str, Any]) -> float:
    raw = candidate.get("raw") if isinstance(candidate.get("raw"), dict) else {}
    confidence = _safe_float(raw.get("confidence"), 0.0) or 0.0
    occurrence_count = _safe_float(raw.get("occurrence_count"), 1.0) or 1.0
    box = _bbox_from_geometry(candidate.get("geometry"))
    area = (box["width"] * box["height"]) if box else 0.0
    return confidence + min(0.25, occurrence_count * 0.025) + min(0.15, area * 0.25)


def _sample_candidates_across_video(
    candidates: List[Dict[str, Any]],
    limit: int,
) -> List[Dict[str, Any]]:
    if len(candidates) <= limit:
        return sorted(
            candidates,
            key=lambda item: (
                _candidate_time_center(item)
                if _candidate_time_center(item) is not None
                else float("inf"),
                -_candidate_review_quality(item),
            ),
        )
    timed = sorted(
        (
            item
            for item in candidates
            if _candidate_time_center(item) is not None
        ),
        key=lambda item: _candidate_time_center(item) or 0.0,
    )
    if not timed:
        return sorted(candidates, key=_candidate_review_quality, reverse=True)[:limit]
    start = _candidate_time_center(timed[0]) or 0.0
    end = _candidate_time_center(timed[-1]) or start
    span = max(0.001, end - start)
    buckets: List[List[Dict[str, Any]]] = [[] for _ in range(limit)]
    for candidate in timed:
        center = _candidate_time_center(candidate) or start
        bucket_index = min(limit - 1, int(((center - start) / span) * limit))
        buckets[bucket_index].append(candidate)
    selected = [
        max(bucket, key=_candidate_review_quality)
        for bucket in buckets
        if bucket
    ]
    if len(selected) < limit:
        selected_ids = {item.get("candidate_id") for item in selected}
        remaining = sorted(
            (
                item
                for item in timed
                if item.get("candidate_id") not in selected_ids
            ),
            key=_candidate_review_quality,
            reverse=True,
        )
        selected.extend(remaining[: limit - len(selected)])
    return sorted(
        selected[:limit],
        key=lambda item: _candidate_time_center(item) or 0.0,
    )


def _select_governed_candidates(
    request: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    limit: int,
) -> List[Dict[str, Any]]:
    if _safe_text(request.get("target")) != "character_continuity":
        return sorted(candidates, key=lambda item: item["match_score"], reverse=True)[:limit]

    anchors = [
        item for item in candidates
        if item.get("candidate_role") == "anchor_sample"
    ]
    identity_candidates = [
        item for item in candidates
        if item.get("candidate_role") == "identity_candidate"
    ]
    context = [
        item for item in candidates
        if item.get("candidate_role") in {"context_support", "conflict"}
    ]
    anchor_limit = min(4, len(anchors), limit)
    context_limit = min(8, len(context), max(0, limit - anchor_limit))
    identity_limit = max(0, limit - anchor_limit - context_limit)
    selected = [
        *sorted(anchors, key=lambda item: item["match_score"], reverse=True)[:anchor_limit],
        *_sample_candidates_across_video(identity_candidates, identity_limit),
        *sorted(context, key=lambda item: item["match_score"], reverse=True)[:context_limit],
    ]
    return selected[:limit]


def _open_topology_som_for_match(
    request: Dict[str, Any],
    candidates: List[Dict[str, Any]],
) -> Dict[str, Any]:
    seed_id = _safe_text((request.get("evidence") or {}).get("overlay_key"), "seed")
    nodes = [
        {
            "node_id": f"seed:{seed_id}",
            "node_type": "mature_anchor",
            "label": _safe_text((request.get("evidence") or {}).get("label"), "Mature anchor"),
            "source_refs": [seed_id],
            "traceback_refs": [f"request:{request.get('request_id')}"],
        }
    ]
    edges: List[Dict[str, Any]] = []
    clusters: Dict[str, Dict[str, Any]] = {}
    for index, candidate in enumerate(candidates):
        candidate_id = _safe_text(candidate.get("candidate_id"), f"candidate:{index}")
        cluster_id = _safe_text(
            (candidate.get("cluster_context") or {}).get("cluster_id"),
            f"open-topology:{candidate.get('source_panel')}:{candidate.get('probability_band')}",
        )
        clusters.setdefault(
            cluster_id,
            {
                "cluster_id": cluster_id,
                "cluster_type": "open_topology_candidate_cluster",
                "candidate_ids": [],
                "source_panels": set(),
                "probability_bands": set(),
            },
        )
        clusters[cluster_id]["candidate_ids"].append(candidate_id)
        clusters[cluster_id]["source_panels"].add(_safe_text(candidate.get("source_panel"), "unknown"))
        clusters[cluster_id]["probability_bands"].add(_safe_text(candidate.get("probability_band"), "unknown"))
        nodes.append(
            {
                "node_id": candidate_id,
                "node_type": "candidate",
                "label": _safe_text(candidate.get("label"), "candidate"),
                "cluster_id": cluster_id,
                "source_panel": candidate.get("source_panel"),
                "source_kind": candidate.get("source_kind"),
                "candidate_role": candidate.get("candidate_role"),
                "source_time": candidate.get("time"),
                "source_anchors": candidate.get("source_anchors") or [],
                "source_refs": candidate.get("source_refs") or [],
                "similarity_score": candidate.get("similarity_score"),
                "review_required": candidate.get("review_required"),
                "traceback_refs": [
                    f"request:{request.get('request_id')}",
                    f"candidate:{candidate_id}",
                ],
            }
        )
        edges.append(
            {
                "edge_id": f"edge:{seed_id}:{candidate_id}",
                "from_node": f"seed:{seed_id}",
                "to_node": candidate_id,
                "edge_type": "traceable_similarity",
                "weight": candidate.get("similarity_score") or candidate.get("match_probability") or 0,
                "match_basis": candidate.get("reason_for_match"),
                "review_required": candidate.get("review_required"),
            }
        )
    normalized_clusters = []
    for cluster in clusters.values():
        normalized_clusters.append(
            {
                **cluster,
                "source_panels": sorted(cluster["source_panels"]),
                "probability_bands": sorted(cluster["probability_bands"]),
                "candidate_count": len(cluster["candidate_ids"]),
            }
        )
    return {
        "schema": "vaa1.open_topology_som_traceable.v1",
        "topology_mode": "open_topology_som",
        "fixed_grid": False,
        "diagnostic_only": True,
        "manual_confirmation_required_for_promotion": True,
        "traceability": {
            "analysis_scoped": True,
            "source_anchors_required_for_promotion": True,
            "manual_correction_wins": True,
            "candidate_is_not_mature_truth": True,
        },
        "nodes": nodes,
        "edges": edges,
        "clusters": normalized_clusters,
    }


def _target_for_scanner_seed(seed: Dict[str, Any]) -> str:
    tokens = _tokenize(seed.get("label")) | _tokenize(seed.get("category"))
    source_panel = _safe_text(seed.get("source_panel"))
    source_kind = _safe_text(seed.get("source_kind"))
    if tokens & {"person", "character", "speaker", "reporter", "presenter", "agent"}:
        return "character_continuity"
    if source_panel == "audio_panel" or "audio" in tokens or "voice" in tokens:
        return "speaker_voice_continuity"
    if source_panel == "ocr_panel" or source_panel == "transcript_panel" or tokens & {"name", "org", "place", "entity"}:
        return "named_entity"
    if tokens & SETTING_TOKENS or source_panel in {"visual_cues", "cinematic_clues"}:
        return "scene_setting"
    if source_panel == "objects_panel" or source_kind in {"grouped_detection", "manual_annotation"}:
        return "object"
    return "visual_pattern"


def _scanner_seed_request(analysis_id: str, seed: Dict[str, Any], index: int) -> Dict[str, Any]:
    time = seed.get("time") or {}
    raw = seed.get("raw") if isinstance(seed.get("raw"), dict) else {}
    return {
        "request_id": f"matcher-refresh:{index + 1}:{seed.get('evidence_id')}",
        "created_at": _now_iso(),
        "video_id": analysis_id,
        "target": _target_for_scanner_seed(seed),
        "scope": "same_video_open_topology_refresh",
        "evidence": {
            "overlay_key": seed.get("evidence_id"),
            "label": seed.get("label"),
            "source_label": seed.get("label"),
            "category": seed.get("category"),
            "interval": time,
            "geometry": seed.get("geometry"),
            "source_track_id": raw.get("track_id"),
            "modality": seed.get("source_panel"),
        },
        "governance": {
            "manual_correction_wins": True,
            "open_topology_som": True,
            "diagnostic_only": True,
            "outputs_are_candidates_until_supported_by_evidence": True,
            "candidate_clusters_require_confirm_cancel_or_defer": True,
        },
    }


def build_scanner_refresh_requests(
    analysis_id: str,
    status: Dict[str, Any],
    *,
    limit: int = 12,
) -> List[Dict[str, Any]]:
    evidence = collect_matchable_evidence(analysis_id, status)
    preferred_panels = {
        "manual_visual_annotations",
        "source_samples",
        "source_media_metadata",
        "visual_sample_cloud",
        "audio_panel",
        "ocr_panel",
        "objects_panel",
        "visual_cues",
        "cinematic_clues",
    }
    seeds: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for item in evidence:
        evidence_id = _safe_text(item.get("evidence_id"))
        if not evidence_id or evidence_id in seen:
            continue
        if item.get("source_panel") not in preferred_panels:
            continue
        tokens = _tokenize(item.get("label")) | _tokenize(item.get("category"))
        if len(tokens) < 1:
            continue
        seen.add(evidence_id)
        seeds.append(item)
        if len(seeds) >= limit:
            break
    return [_scanner_seed_request(analysis_id, seed, index) for index, seed in enumerate(seeds)]


def run_open_topology_scanner_refresh(
    analysis_id: str,
    status: Dict[str, Any],
    output_dir: Path,
    *,
    request_limit: int = 12,
    candidate_limit: int = 25,
) -> Dict[str, Any]:
    requests = build_scanner_refresh_requests(analysis_id, status, limit=request_limit)
    matches: List[Dict[str, Any]] = []
    for request in requests:
        safe_request_id = "".join(
            character if character.isalnum() or character in {"-", "_"} else "_"
            for character in _safe_text(request.get("request_id"), "matcher-refresh")
        )[:96]
        output_json_path = output_dir / f"evidence_proliferation_match_{safe_request_id}.json"
        result = write_evidence_proliferation_match(
            analysis_id,
            status,
            request,
            output_json_path,
            limit=candidate_limit,
        )
        matches.append(
            {
                "request_id": request.get("request_id"),
                "target": request.get("target"),
                "status": result.get("status"),
                "candidate_count": result.get("candidate_count", 0),
                "output_json_path": str(output_json_path),
                "updated_at": _now_iso(),
                "open_topology_som": result.get("open_topology_som"),
            }
        )
    return {
        "schema": "vaa1.open_topology_scanner_refresh.v1",
        "analysis_id": analysis_id,
        "status": "completed",
        "created_at": _now_iso(),
        "request_count": len(requests),
        "match_count": len(matches),
        "candidate_count": sum(int(item.get("candidate_count") or 0) for item in matches),
        "governance": {
            "diagnostic_only": True,
            "candidate_is_not_mature_truth": True,
            "manual_correction_wins": True,
            "review_ledger": "annotation_corrections.proliferation_decisions",
        },
        "requests": requests,
        "matches": matches,
    }


def build_evidence_proliferation_match(
    analysis_id: str,
    status: Dict[str, Any],
    request: Dict[str, Any],
    *,
    limit: int = 25,
) -> Dict[str, Any]:
    evidence_pool = collect_matchable_evidence(analysis_id, status)
    constellation_index = build_mature_constellation_index(status)
    scored = []
    for item in evidence_pool:
        score = _score_candidate(request, item)
        if score <= 0:
            continue
        closest_match = _closest_match_profile(request, item, constellation_index)
        probability = closest_match["match_probability"]
        if probability <= 0:
            continue
        governed = _govern_candidate(
            analysis_id=analysis_id,
            request=request,
            item=item,
            score=score,
            closest_match=closest_match,
        )
        if governed is None:
            continue
        scored.append(governed)
    scored.sort(key=lambda item: item["match_score"], reverse=True)
    candidates = _select_governed_candidates(
        request,
        _cluster_same_timespace_candidates(scored),
        limit,
    )
    open_topology_som = _open_topology_som_for_match(request, candidates)
    return {
        "schema": SCHEMA,
        "governance_schema": GOVERNANCE_SCHEMA,
        "analysis_id": analysis_id,
        "request_id": request.get("request_id"),
        "created_at": _now_iso(),
        "status": "completed",
        "progress": {"request_preparation": 100, "candidate_matching": 100},
        "candidate_count": len(candidates),
        "mature_constellation_index": constellation_index,
        "governance": AUTHORITY_POLICY,
        "probability_policy": NEAR_MATCH_PROBABILITY_POLICY,
        "request": request,
        "candidates": candidates,
        "open_topology_som": open_topology_som,
    }


def write_evidence_proliferation_match(
    analysis_id: str,
    status: Dict[str, Any],
    request: Dict[str, Any],
    output_json_path: Path,
    *,
    limit: int = 25,
) -> Dict[str, Any]:
    payload = build_evidence_proliferation_match(
        analysis_id,
        status,
        request,
        limit=limit,
    )
    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    output_json_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return payload
