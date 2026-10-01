"""Narrative Agent Digital Twin samples and governed recognition projections."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Any, Dict, Iterable, List, Mapping, Sequence

from src.backend.analysis.narrative_agent_recognition_array import (
    collect_confirmed_recognition_anchors,
)


SCHEMA = "vaa1.narrative_agent_digital_twin_array.v1"
MODALITIES = (
    "visual",
    "audio",
    "transcript",
    "ocr",
    "music_theme",
    "source_media_data",
    "scene_card",
    "manual_confirmation",
)
WEIGHTS = {
    "visual": 0.30,
    "audio": 0.20,
    "transcript": 0.14,
    "ocr": 0.08,
    "music_theme": 0.08,
    "source_media_data": 0.06,
    "scene_card": 0.08,
    "manual_confirmation": 0.10,
}
DEFAULT_GATES = {
    "minimum_overall_score": 0.88,
    "minimum_visual_score": 0.82,
    "minimum_supporting_modalities": 3,
    "minimum_competing_agent_margin": 0.08,
}
CONSUMERS = (
    "Video/BBox/ROI",
    "Audio",
    "Transcript",
    "OCR",
    "SceneCards",
    "MeaningNetwork",
    "Meaning/Plot",
    "NarrativeAgent",
    "MasterSchema",
    "DataMaturation",
    "Search",
    "StatsKit",
    "Traceback",
    "DataBook",
    "ScientificReport",
    "Export",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text(value: Any) -> str:
    return str(value or "").strip()


def _dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in ("items", "segments", "turns", "results", "events", "intervals", "cues", "rows", "clouds", "scene_cards"):
            if isinstance(value.get(key), list):
                return value[key]
    return []


def _number(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _interval(item: Mapping[str, Any]) -> Dict[str, float | None]:
    nested = _dict(item.get("time") or item.get("interval") or item.get("time_interval"))
    start = next(
        (
            number
            for number in (
                _number(item.get("start_seconds")),
                _number(item.get("start_timestamp")),
                _number(item.get("start")),
                _number(item.get("timestamp_seconds")),
                _number(item.get("timestamp")),
                _number(nested.get("start")),
                (_number(nested.get("start_ms")) / 1000 if _number(nested.get("start_ms")) is not None else None),
            )
            if number is not None
        ),
        None,
    )
    end = next(
        (
            number
            for number in (
                _number(item.get("end_seconds")),
                _number(item.get("end_timestamp")),
                _number(item.get("end")),
                _number(nested.get("end")),
                (_number(nested.get("end_ms")) / 1000 if _number(nested.get("end_ms")) is not None else None),
            )
            if number is not None
        ),
        start,
    )
    return {"start": start, "end": end}


def _overlaps(left: Mapping[str, Any], right: Mapping[str, Any]) -> bool:
    ls, le = _number(left.get("start")), _number(left.get("end"))
    rs, re_ = _number(right.get("start")), _number(right.get("end"))
    if ls is None or rs is None:
        return False
    le = ls if le is None else le
    re_ = rs if re_ is None else re_
    return ls <= re_ and rs <= le


def _tokens(*values: Any) -> List[str]:
    return sorted(
        {
            token
            for value in values
            for token in re.findall(r"[a-z0-9]+", _text(value).casefold())
            if len(token) > 1
        }
    )


def _analysis_id(status: Mapping[str, Any]) -> str:
    return _text(status.get("analysis_id")) or "unknown-analysis"


def _artifact_rows(status: Mapping[str, Any], *keys: str) -> List[Dict[str, Any]]:
    results = _dict(status.get("results"))
    surfaces = (
        status,
        results,
        _dict(results.get("audio_analysis")),
        _dict(results.get("visual_analysis")),
    )
    collected: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for surface_index, surface in enumerate(surfaces):
        for key in keys:
            value = surface.get(key)
            if isinstance(value, dict) and not _list(value):
                artifact_path = _text(value.get("output_json_path"))
                if artifact_path:
                    try:
                        value = json.loads(Path(artifact_path).read_text(encoding="utf-8"))
                    except (OSError, json.JSONDecodeError):
                        pass
            rows = [item for item in _list(value) if isinstance(item, dict)]
            for row_index, row in enumerate(rows):
                marker = _text(row.get("id") or row.get("evidence_id") or row.get("sample_id"))
                marker = marker or f"{surface_index}:{key}:{row_index}:{json.dumps(row, sort_keys=True, default=str)[:200]}"
                if marker in seen:
                    continue
                seen.add(marker)
                collected.append(row)
    return collected


def _evidence_record(
    analysis_id: str,
    modality: str,
    item: Mapping[str, Any],
    index: int,
) -> Dict[str, Any]:
    evidence_id = (
        _text(item.get("id"))
        or _text(item.get("evidence_id"))
        or _text(item.get("sample_id"))
        or f"{analysis_id}:{modality}:{index}"
    )
    label = _text(
        item.get("text")
        or item.get("label")
        or item.get("entity_label")
        or item.get("class_name")
        or item.get("speaker_label")
        or item.get("event_type")
    )
    return {
        "evidence_id": evidence_id,
        "analysis_id": analysis_id,
        "modality": modality,
        "source_interval": _interval(item),
        "label": label,
        "tokens": _tokens(label),
        "confidence": _number(item.get("confidence") or item.get("score")),
        "method": _text(item.get("method") or item.get("provider")) or "registered_artifact",
        "traceback_refs": [evidence_id],
    }


def _modality_rows(status: Mapping[str, Any], modality: str) -> List[Dict[str, Any]]:
    analysis_id = _analysis_id(status)
    key_map = {
        "visual": ("tracked_objects", "visual_detections", "face_results"),
        "audio": ("audio_sample_clouds", "speaker_diarization", "audio_prosody"),
        "transcript": ("linked_transcript", "transcript", "transcript_segments"),
        "ocr": ("ocr_results", "ocr", "text_detections"),
        "music_theme": ("music_theme", "music_intervals", "audio_event_intervals"),
        "scene_card": ("scene_cards", "mise_en_scene_scene_cards"),
    }
    rows = _artifact_rows(status, *key_map.get(modality, ()))
    if modality == "music_theme":
        rows = [
            row
            for row in rows
            if any(token in _tokens(row.get("label"), row.get("event_type"), row.get("category"))
                   for token in ("music", "theme", "score", "song"))
        ]
    return [_evidence_record(analysis_id, modality, row, index) for index, row in enumerate(rows)]


def _source_media_record(status: Mapping[str, Any]) -> Dict[str, Any]:
    analysis_id = _analysis_id(status)
    metadata = _dict(status.get("source_media_metadata"))
    annotations = _dict(metadata.get("user_annotations") or metadata.get("annotations"))
    fields = {
        key: value
        for key, value in {**metadata, **annotations}.items()
        if key in {
            "title", "description", "genre", "genre_subtype", "source_context",
            "persons", "character_roles", "organizations", "location_country",
            "location_city", "location_place", "situation_event",
        }
        and value not in (None, "", [], {})
    }
    return {
        "evidence_id": f"{analysis_id}:source-media-data",
        "analysis_id": analysis_id,
        "modality": "source_media_data",
        "source_interval": {"start": None, "end": None},
        "fields": fields,
        "tokens": _tokens(*fields.values()),
        "authority": "source_media_governed_context",
        "traceback_refs": [f"{analysis_id}:source-media-data"],
    }


def build_digital_twins(statuses: Iterable[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    statuses = list(statuses)
    status_by_id = {_analysis_id(status): status for status in statuses}
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for status in statuses:
        for anchor in collect_confirmed_recognition_anchors(status):
            grouped.setdefault(anchor["narrative_agent_key"], []).append(anchor)

    twins: List[Dict[str, Any]] = []
    for key, anchors in sorted(grouped.items()):
        evidence: Dict[str, List[Dict[str, Any]]] = {modality: [] for modality in MODALITIES}
        for anchor in anchors:
            status = status_by_id[anchor["analysis_id"]]
            anchor_interval = anchor["source_interval"]
            evidence["manual_confirmation"].append(
                {
                    "evidence_id": anchor["anchor_id"],
                    "analysis_id": anchor["analysis_id"],
                    "modality": "manual_confirmation",
                    "source_interval": anchor_interval,
                    "source_geometry": anchor.get("source_geometry"),
                    "authority": anchor["authority"],
                    "traceback_refs": anchor.get("traceback_refs") or [],
                }
            )
            for modality in ("visual", "audio", "transcript", "ocr", "music_theme", "scene_card"):
                evidence[modality].extend(
                    record
                    for record in _modality_rows(status, modality)
                    if _overlaps(anchor_interval, record["source_interval"])
                )
            source_record = _source_media_record(status)
            if source_record["fields"]:
                evidence["source_media_data"].append(source_record)

        for modality in MODALITIES:
            unique = {record["evidence_id"]: record for record in evidence[modality]}
            evidence[modality] = list(unique.values())
        present = [modality for modality in MODALITIES if evidence[modality]]
        missing = [modality for modality in MODALITIES if not evidence[modality]]
        twin_id = f"narrative-agent-digital-twin:{key.replace(' ', '-')}"
        twins.append(
            {
                "twin_id": twin_id,
                "narrative_agent_key": key,
                "narrative_agent_label": anchors[0]["narrative_agent_label"],
                "authority": "explicit_analyst_confirmation_constellation",
                "maturity_state": "governed_digital_twin_sample",
                "anchor_count": len(anchors),
                "modality_coverage": {
                    "present": present,
                    "missing": missing,
                    "percentage": round(len(present) / len(MODALITIES) * 100, 1),
                },
                "evidence": evidence,
                "recognition_policy": {
                    "not_a_biometric_or_natural_person_identity_profile": True,
                    "modality_records_remain_independently_governed": True,
                    "manual_confirmation_is_anchor_authority": True,
                    "automatic_visual_recognition_requires_multiple_independent_samples": True,
                },
                "visual_quality_guard": {
                    "automatic_recognition_ready": len(anchors) >= 2,
                    "manual_confirmation_count": len(anchors),
                    "minimum_independent_confirmations": 2,
                    "single_first_frame_cannot_auto_confirm": True,
                    "transition_and_cross_dissolve_check_required": True,
                    "dominant_colour_or_filter_check_required": True,
                    "shot_and_temporal_diversity_required": True,
                    "explicit_analyst_100_percent_confirmation_may_override": True,
                },
            }
        )
    return twins


def build_occurrence_signatures(statuses: Iterable[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    """Build source-timed multimodal signatures for unresolved person occurrences."""
    signatures: List[Dict[str, Any]] = []
    for status in statuses:
        analysis_id = _analysis_id(status)
        visual_rows = _artifact_rows(status, "tracked_objects")
        supporting = {
            modality: _modality_rows(status, modality)
            for modality in ("audio", "transcript", "ocr", "music_theme", "scene_card")
        }
        source_media = _source_media_record(status)
        for index, row in enumerate(visual_rows):
            if _text(row.get("class_name") or row.get("label")).casefold() not in {
                "person", "people", "human", "face",
            }:
                continue
            interval = _interval(row)
            if interval["start"] is None:
                continue
            source_ref = (
                _text(row.get("id"))
                or f"{analysis_id}:person:{row.get('track_id', index)}:{interval['start']}:{interval['end']}"
            )
            evidence = {
                modality: [record for record in records if _overlaps(interval, record["source_interval"])]
                for modality, records in supporting.items()
            }
            evidence["source_media_data"] = [source_media] if source_media["fields"] else []
            signatures.append(
                {
                    "occurrence_id": source_ref,
                    "analysis_id": analysis_id,
                    "source_interval": interval,
                    "source_geometry": {
                        "x1": row.get("bbox_x1"), "y1": row.get("bbox_y1"),
                        "x2": row.get("bbox_x2"), "y2": row.get("bbox_y2"),
                    },
                    "visual_signature": {
                        "embedding": row.get("embedding") or row.get("face_embedding"),
                        "embedding_ref": row.get("embedding_ref") or row.get("face_embedding_ref"),
                        "measurement_state": (
                            "measured" if row.get("embedding") or row.get("face_embedding")
                            else "embedding_required"
                        ),
                    },
                    "supporting_evidence": evidence,
                    "available_modalities": [
                        modality for modality, records in evidence.items() if records
                    ],
                    "recognition_state": "awaiting_multimodal_comparison",
                }
            )
    return signatures


def score_occurrence(
    twin: Mapping[str, Any],
    occurrence: Mapping[str, Any],
    *,
    gates: Mapping[str, float] | None = None,
) -> Dict[str, Any]:
    effective_gates = {**DEFAULT_GATES, **dict(gates or {})}
    scores = {
        modality: _number(_dict(occurrence.get("modality_scores")).get(modality))
        for modality in MODALITIES
    }
    available = {key: value for key, value in scores.items() if value is not None}
    weight_total = sum(WEIGHTS[key] for key in available)
    overall = (
        sum(value * WEIGHTS[key] for key, value in available.items()) / weight_total
        if weight_total
        else None
    )
    competing = _number(occurrence.get("best_competing_agent_score"))
    margin = overall - competing if overall is not None and competing is not None else None
    supporting = len([value for key, value in available.items() if key != "manual_confirmation" and value >= 0.65])
    failures: List[str] = []
    if _number(_dict(occurrence.get("source_interval")).get("start")) is None:
        failures.append("missing_source_time")
    if scores["visual"] is None:
        failures.append("missing_visual_measurement")
    elif scores["visual"] < effective_gates["minimum_visual_score"]:
        failures.append("visual_score_below_gate")
    if supporting < int(effective_gates["minimum_supporting_modalities"]):
        failures.append("insufficient_supporting_modalities")
    if overall is None:
        failures.append("missing_multimodal_score")
    elif overall < effective_gates["minimum_overall_score"]:
        failures.append("overall_score_below_gate")
    if margin is None:
        failures.append("missing_competing_agent_margin")
    elif margin < effective_gates["minimum_competing_agent_margin"]:
        failures.append("competing_agent_margin_below_gate")
    if occurrence.get("negative_evidence"):
        failures.append("negative_evidence_present")
    return {
        "occurrence_id": _text(occurrence.get("occurrence_id")) or "unidentified-occurrence",
        "analysis_id": _text(occurrence.get("analysis_id")),
        "narrative_agent_twin_ref": twin.get("twin_id"),
        "narrative_agent_label": twin.get("narrative_agent_label"),
        "source_interval": occurrence.get("source_interval"),
        "source_geometry": occurrence.get("source_geometry"),
        "modality_scores": scores,
        "available_modality_count": len(available),
        "supporting_modality_count": supporting,
        "overall_score": round(overall, 4) if overall is not None else None,
        "competing_agent_margin": round(margin, 4) if margin is not None else None,
        "recognition_state": "automatically_confirmed" if not failures else "candidate",
        "gate_failures": failures,
        "source_refs": list(occurrence.get("source_refs") or []),
    }


def build_proliferation_event(recognition: Mapping[str, Any]) -> Dict[str, Any]:
    if recognition.get("recognition_state") != "automatically_confirmed":
        raise ValueError("Only an automatically confirmed recognition may proliferate")
    recognition_id = (
        f"narrative-agent-recognition:{recognition.get('analysis_id')}:"
        f"{recognition.get('occurrence_id')}:{recognition.get('narrative_agent_twin_ref')}"
    )
    return {
        "schema": "vaa1.narrative_agent_recognition_proliferation_event.v1",
        "event_id": f"proliferation:{hashlib.sha256(recognition_id.encode()).hexdigest()[:20]}",
        "recognition_id": recognition_id,
        "decision": "automatically_confirmed_narrative_agent_recognition",
        "authority": "governed_digital_twin_match",
        "maturity_state": "mature_source_occurrence_recognition",
        "source_interval": recognition.get("source_interval"),
        "source_geometry": recognition.get("source_geometry"),
        "digital_twin_ref": recognition.get("narrative_agent_twin_ref"),
        "narrative_agent_label": recognition.get("narrative_agent_label"),
        "measurement": {
            "modality_scores": recognition.get("modality_scores"),
            "overall_score": recognition.get("overall_score"),
            "competing_agent_margin": recognition.get("competing_agent_margin"),
        },
        "projection_targets": [
            {
                "consumer": consumer,
                "state": "queued_for_overlapping_scene_rebuild"
                if consumer == "SceneCards"
                else "queued_for_canonical_projection",
                **(
                    {
                        "rebuild_scope": "source_interval_overlap_only",
                        "preserve_manual_scene_evidence": True,
                    }
                    if consumer == "SceneCards"
                    else {}
                ),
            }
            for consumer in CONSUMERS
        ],
        "reversible": True,
        "raw_evidence_unchanged": True,
        "traceback_refs": list(recognition.get("source_refs") or []),
        "created_at": _now(),
    }


def build_array_digital_twin_report(statuses: Iterable[Mapping[str, Any]]) -> Dict[str, Any]:
    statuses = list(statuses)
    twins = build_digital_twins(statuses)
    occurrences = build_occurrence_signatures(statuses)
    coverage = {
        modality: sum(1 for twin in twins if modality in twin["modality_coverage"]["present"])
        for modality in MODALITIES
    }
    return {
        "schema": SCHEMA,
        "created_at": _now(),
        "analysis_ids": sorted(_analysis_id(status) for status in statuses),
        "summary": {
            "analysis_count": len(statuses),
            "digital_twin_count": len(twins),
            "modality_coverage_by_twin_count": coverage,
            "occurrence_signature_count": len(occurrences),
            "occurrences_with_visual_embeddings": sum(
                occurrence["visual_signature"]["measurement_state"] == "measured"
                for occurrence in occurrences
            ),
            "recognition_candidates_scored": 0,
            "automatic_recognitions": 0,
            "consumer_projection_events": 0,
        },
        "gates": DEFAULT_GATES,
        "consumer_projection_contract": list(CONSUMERS),
        "digital_twins": twins,
        "occurrence_signatures": occurrences,
        "next_required_stage": "COMPUTE_MODALITY_SIGNATURES_AND_SCORE_OCCURRENCES",
    }


def write_array_digital_twin_report(
    statuses: Iterable[Mapping[str, Any]], output_path: str | Path
) -> Dict[str, Any]:
    payload = build_array_digital_twin_report(statuses)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload
