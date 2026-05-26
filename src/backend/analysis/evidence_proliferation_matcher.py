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


def _interval_from_mapping(item: Dict[str, Any]) -> Dict[str, Optional[float]]:
    start = _first_float(
        item.get("start"),
        item.get("start_time"),
        item.get("start_seconds"),
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
                "name",
                "text",
                "emotion",
                "confidence",
                "score",
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
    audio_diarization = _first_mapping(status.get("audio_diarization"))
    for index, item in enumerate(_as_items(audio_diarization.get("speaker_turns"))):
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

    audio_sample_clouds = _first_mapping(status.get("audio_sample_clouds"))
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

    audio_prosody = _first_mapping(status.get("audio_prosody"))
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
    for index, item in enumerate(visual.get("tracked_objects") or []):
        if not isinstance(item, dict):
            continue
        label = (
            _safe_text(item.get("label"))
            or _safe_text(item.get("class"))
            or _safe_text(item.get("name"))
            or _safe_text(item.get("track_label"))
            or f"track {item.get('track_id', index)}"
        )
        yield _candidate(
            analysis_id=analysis_id,
            evidence_id=f"object:{item.get('track_id', index)}",
            label=label,
            category="Object",
            source_kind="grouped_detection",
            source_panel="objects_panel",
            item=item,
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
    return 0.0


def _contextual_probability(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    target = _safe_text(request.get("target"))
    source_panel = _safe_text(candidate.get("source_panel"))
    category = _safe_text(candidate.get("category")).lower()
    if target == "character_continuity":
        if source_panel in {"manual_visual_annotations", "visual_sample_cloud"}:
            return 0.9
        if source_panel in {"objects_panel", "transcript_panel", "source_media_metadata", "audio_panel"}:
            return 0.75
        if source_panel in {"visual_cues", "cinematic_clues"}:
            return 0.65
    if target in {"speaker_voice_continuity", "prosody_delivery_pattern"} and source_panel == "audio_panel":
        return 0.9
    if target in {"action", "interaction", "scene_episode", "visual_pattern"} and (
        "visual" in category or "cinematic" in category or source_panel == "objects_panel"
    ):
        return 0.8
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


def _closest_match_profile(request: Dict[str, Any], candidate: Dict[str, Any]) -> Dict[str, Any]:
    spatial = _spatial_consistency_probability(request, candidate)
    components = {
        "text_semantic": round(_text_probability(request, candidate), 4),
        "time_proximity": round(_temporal_closeness_probability(request, candidate), 4),
        "spatial_consistency": None if spatial is None else round(spatial, 4),
        "track_continuity": round(_track_continuity_probability(request, candidate), 4),
        "contextual_modality": round(_contextual_probability(request, candidate), 4),
        "sample_cloud_support": round(_sample_cloud_probability(request, candidate), 4),
    }
    weights = {
        "text_semantic": 0.16,
        "time_proximity": 0.18,
        "spatial_consistency": 0.26 if spatial is not None else 0.0,
        "track_continuity": 0.18,
        "contextual_modality": 0.12,
        "sample_cloud_support": 0.1,
    }
    active_weight = sum(weight for key, weight in weights.items() if components.get(key) is not None)
    probability = 0.0
    for key, weight in weights.items():
        value = components.get(key)
        if value is None or active_weight <= 0:
            continue
        probability += (value * weight) / active_weight
    return {
        "principle": "closest_match",
        "match_probability": round(max(0.0, min(1.0, probability)), 4),
        "components": components,
        "weights": weights,
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


def _candidate_projection_targets(candidate: Dict[str, Any], request: Dict[str, Any]) -> List[str]:
    targets = set(PROJECTION_TARGETS_BY_SOURCE_PANEL.get(_safe_text(candidate.get("source_panel")), []))
    target = _safe_text(request.get("target"))
    if target in {"character_continuity", "speaker_voice_continuity"}:
        targets.update(["narrative_agent_panel", "evidence_graph"])
    if target in {"scene_episode", "action", "interaction", "visual_pattern"}:
        targets.update(["scene_card_panel", "meaning_plot_panel", "evidence_graph"])
    targets.update(["governance_matrix", "search_index"])
    return sorted(targets)


def _governance_status(candidate: Dict[str, Any], probability: float, source_anchors: List[Dict[str, Any]]) -> Dict[str, Any]:
    source_kind = _safe_text(candidate.get("source_kind"))
    manual_authority = source_kind in {"manual_correction", "manual_annotation"}
    very_high = probability >= NEAR_MATCH_PROBABILITY_POLICY["auto_proliferation_allowed_above"]
    has_anchor = bool(source_anchors)
    proliferation_allowed = bool((manual_authority or very_high) and has_anchor)
    review_required = not proliferation_allowed
    if not has_anchor:
        review_reason = "Candidate lacks a source anchor and cannot proliferate."
    elif proliferation_allowed:
        review_reason = "Proliferation allowed by manual authority or very high probability with traceback."
    else:
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
        "metadata_support": 1.0 if candidate.get("source_panel") == "source_media_metadata" else 0.0,
    }
    open_weights = {
        "manual_authority": 0.22,
        "source_traceability": 0.18,
        "cross_modal_support": 0.14,
        "temporal_spatial_fit": 0.18,
        "semantic_fit": 0.12,
        "sample_cloud_support": 0.1,
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
    authority_level = _authority_level_for_candidate(item, probability)
    maturity_state = "probable" if band in {"probable_candidate", "strongly_supported"} else band
    governance_status = _governance_status(item, probability, source_anchors)
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
        "probability_band": band,
        "legacy_match_score": score,
        "closest_match": closest_match,
        "review_state": _review_state_for_candidate(item, probability),
        "decision_required": governance_status["review_required"],
        "allowed_actions": ["confirm", "cancel", "defer", "inspect_sources"],
        "proliferation_allowed": governance_status["proliferation_allowed"],
        "proliferation_reason": governance_status["review_reason"],
        "source_anchors": source_anchors,
        "evidence_refs": evidence_refs,
        "projection_targets": _candidate_projection_targets(item, request),
        "situational_options": _situational_options_for_candidate(request, item, probability),
        "provenance": {
            "request_id": request.get("request_id"),
            "source_evidence": request.get("evidence"),
            "candidate_evidence_id": item["evidence_id"],
            "candidate_source_kind": item["source_kind"],
            "governance_schema": GOVERNANCE_SCHEMA,
        },
        **item,
    }


def _score_candidate(request: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    evidence = request.get("evidence") or {}
    if candidate.get("evidence_id") == evidence.get("overlay_key"):
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


def build_evidence_proliferation_match(
    analysis_id: str,
    status: Dict[str, Any],
    request: Dict[str, Any],
    *,
    limit: int = 25,
) -> Dict[str, Any]:
    evidence_pool = collect_matchable_evidence(analysis_id, status)
    scored = []
    for item in evidence_pool:
        score = _score_candidate(request, item)
        if score <= 0:
            continue
        closest_match = _closest_match_profile(request, item)
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
    candidates = _cluster_same_timespace_candidates(scored)[:limit]
    return {
        "schema": SCHEMA,
        "governance_schema": GOVERNANCE_SCHEMA,
        "analysis_id": analysis_id,
        "request_id": request.get("request_id"),
        "created_at": _now_iso(),
        "status": "completed",
        "progress": {"request_preparation": 100, "candidate_matching": 100},
        "candidate_count": len(candidates),
        "governance": AUTHORITY_POLICY,
        "probability_policy": NEAR_MATCH_PROBABILITY_POLICY,
        "request": request,
        "candidates": candidates,
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
