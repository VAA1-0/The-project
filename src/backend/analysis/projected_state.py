"""Read-only compatibility projection over existing VAA1 evidence and corrections.

This module does not create canonical decisions. It gives the future Projection
Engine a deterministic baseline while legacy correction records remain active.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional


AUTHORITY_ORDER = {
    "explicit_user_correction": 50,
    "manual_correction": 50,
    "explicit_user_confirmation": 40,
    "manual_annotation": 40,
    "mature_triangulated": 30,
    "interpreted_automatic": 20,
    "raw_detection": 10,
}


def _number(value: Any) -> Optional[float]:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result


def _updated_sort_value(item: Dict[str, Any]) -> float:
    value = item.get("updated_at") or item.get("created_at")
    if not value:
        return 0.0
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def _manual_label(item: Dict[str, Any]) -> str:
    return str(
        item.get("identity_affirmation")
        or item.get("role_affirmation")
        or item.get("custom_label")
        or item.get("label")
        or ""
    ).strip()


def _time_bounds(item: Dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
    start = _number(item.get("start_seconds"))
    if start is None:
        start = _number(item.get("timestamp_seconds"))
    end = _number(item.get("end_seconds"))
    if end is None:
        end = start
    if start is None or end is None:
        return None, None
    return min(start, end), max(start, end)


def _visible_at(item: Dict[str, Any], timestamp: float) -> bool:
    start, end = _time_bounds(item)
    if start is None or end is None:
        return False
    return start - 0.03 <= timestamp <= end + 0.03


def _target_ref(item: Dict[str, Any]) -> str:
    metadata = item.get("metadata_correlation")
    if not isinstance(metadata, dict):
        return ""
    return str(metadata.get("target_id") or "").strip()


def _raw_ref(item: Dict[str, Any]) -> str:
    return str(
        item.get("track_id")
        or item.get("trackId")
        or item.get("object_id")
        or item.get("id")
        or ""
    ).strip()


def _raw_label(item: Dict[str, Any]) -> str:
    return str(
        item.get("class_name")
        or item.get("raw_class_name")
        or item.get("label")
        or item.get("display_label")
        or "unknown object"
    ).strip()


def _raw_time_distance(item: Dict[str, Any], timestamp: float) -> float:
    start = _number(item.get("start_timestamp"))
    if start is None:
        start = _number(item.get("timestamp"))
    end = _number(item.get("end_timestamp"))
    if end is None:
        end = start
    if start is None:
        return float("inf")
    if end is not None and start <= timestamp <= end:
        return 0.0
    return min(abs(timestamp - start), abs(timestamp - (end if end is not None else start)))


def _decision_matches(item: Dict[str, Any], subject_ref: str, timestamp: float) -> bool:
    subject = item.get("subject_ref")
    return (
        isinstance(subject, dict)
        and str(subject.get("id") or "") == subject_ref
        and item.get("property", "label") in {
            "label", "semantic.assignment.label", "narrative_agent.assignment"
        }
        and item.get("validity", "current") == "current"
        and item.get("projection_status", "active") == "active"
        and bool(str(item.get("value") or "").strip())
        and _visible_at(item.get("scope", {}), timestamp)
    )


def _geometry(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    coordinates = item.get("coordinates")
    if isinstance(coordinates, dict):
        return {"coordinate_system": "normalized_video", "box": coordinates}
    values = [_number(item.get(key)) for key in ("bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2")]
    if all(value is not None for value in values):
        return {
            "coordinate_system": "pixel_video",
            "box": {"x1": values[0], "y1": values[1], "x2": values[2], "y2": values[3]},
        }
    return None


def project_subject_state(
    *,
    analysis_id: str,
    subject_ref: str,
    timestamp: float,
    tracked_objects: Iterable[Dict[str, Any]],
    corrections: Dict[str, Any],
    decisions: Iterable[Dict[str, Any]] = (),
) -> Dict[str, Any]:
    """Resolve the best current label without mutating evidence or corrections."""

    raw_matches = [item for item in tracked_objects if isinstance(item, dict) and _raw_ref(item) == subject_ref]
    raw_match = min(raw_matches, key=lambda item: _raw_time_distance(item, timestamp), default=None)

    decision_snapshot = [item for item in decisions if isinstance(item, dict)]
    decision_by_id = {
        str(item.get("decision_id")): item for item in decision_snapshot if item.get("decision_id")
    }
    invalidated_ids = {
        str(target)
        for event in decision_snapshot
        if event.get("decision_action") == "invalidate"
        for target in event.get("target_decision_refs", [])
        if target
    }
    invalidated_correction_refs = {
        str(ref)
        for decision_id in invalidated_ids
        for ref in decision_by_id.get(decision_id, {}).get("correction_refs", [])
        if ref
    }

    manual_matches: List[Dict[str, Any]] = []
    for item in corrections.get("manual_visual_annotations", []) or []:
        if not isinstance(item, dict) or _target_ref(item) != subject_ref:
            continue
        if str(item.get("id") or "") in invalidated_correction_refs:
            continue
        if _visible_at(item, timestamp) and _manual_label(item):
            manual_matches.append(item)
    manual_match = max(manual_matches, key=_updated_sort_value, default=None)

    superseded_ids = {
        str(item)
        for decision in decision_snapshot
        for item in decision.get("supersedes", [])
        if item
    }
    decision_match = max(
        (
            item for item in decision_snapshot
            if item.get("decision_id") not in superseded_ids | invalidated_ids
            and _decision_matches(item, subject_ref, timestamp)
        ),
        key=_updated_sort_value,
        default=None,
    )

    raw_value = _raw_label(raw_match) if raw_match else None
    if decision_match:
        authority = str(decision_match.get("authority") or "explicit_user_correction")
        projected_value = str(decision_match.get("value"))
        maturity = str(decision_match.get("maturity") or "analyst_confirmed")
        source_kind = "canonical_decision"
        decision_refs = [str(decision_match.get("decision_id"))]
        correction_refs = [str(item) for item in decision_match.get("correction_refs", []) if item]
        evidence_refs = [str(item) for item in decision_match.get("evidence_refs", []) if item]
        scope_start, scope_end = _time_bounds(decision_match.get("scope", {}))
        geometry = decision_match.get("scope", {}).get("geometry")
    elif manual_match:
        metadata = manual_match.get("metadata_correlation") or {}
        authority = str(metadata.get("authority_state") or "manual_correction")
        projected_value = _manual_label(manual_match)
        maturity = str(metadata.get("maturity_state") or "manual_correction")
        source_kind = "manual_visual_annotation"
        correction_refs = [str(manual_match.get("id"))]
        decision_refs = []
        evidence_refs = [subject_ref]
        scope_start, scope_end = _time_bounds(manual_match)
        geometry = _geometry(manual_match)
    elif raw_match:
        authority = "raw_detection"
        projected_value = raw_value
        maturity = "raw"
        source_kind = "tracked_object"
        correction_refs = []
        decision_refs = []
        evidence_refs = [subject_ref]
        scope_start = _number(raw_match.get("start_timestamp") or raw_match.get("timestamp"))
        scope_end = _number(raw_match.get("end_timestamp") or raw_match.get("timestamp"))
        geometry = _geometry(raw_match)
    else:
        authority = "raw_detection"
        projected_value = None
        maturity = "missing"
        source_kind = "none"
        correction_refs = []
        decision_refs = []
        evidence_refs = []
        scope_start = scope_end = None
        geometry = None

    relevant_invalidated_ids = sorted(
        decision_id
        for decision_id in invalidated_ids
        if decision_by_id.get(decision_id, {}).get("subject_ref", {}).get("id") == subject_ref
        and _visible_at(decision_by_id.get(decision_id, {}).get("scope", {}), timestamp)
    )
    relevant_validity_effects = sorted({
        str(event.get("validity_effect") or "invalid")
        for event in decision_snapshot
        if event.get("decision_action") == "invalidate"
        and any(str(target) in relevant_invalidated_ids for target in event.get("target_decision_refs", []))
    })
    indication = None
    if projected_value is None:
        indication = {
            "tone": "quiet",
            "code": "no_projectable_state",
            "message": "No source-linked indication is available for this subject and time.",
            "suggested_action": "Inspect source or create an annotation when useful.",
        }
    elif relevant_invalidated_ids and not decision_match and not manual_match:
        stale = "stale" in relevant_validity_effects
        indication = {
            "tone": "quiet",
            "code": "reviewed_assignment_requires_review" if stale else "reviewed_assignment_no_longer_current",
            "message": (
                "Using source evidence; the prior reviewed assignment should be reviewed after a dependency change."
                if stale else
                "Using source evidence; the prior reviewed assignment is no longer current."
            ),
            "suggested_action": "Review the subject when a replacement assignment is useful.",
        }

    return {
        "schema": "vaa1.projected_subject_state.v0.compatibility",
        "analysis_id": analysis_id,
        "subject_ref": {"type": "visual_track_or_observation", "id": subject_ref},
        "timestamp_seconds": round(float(timestamp), 3),
        "raw_value": raw_value,
        "projected_value": projected_value,
        "authority": authority,
        "authority_rank": AUTHORITY_ORDER.get(authority, 0),
        "maturity": maturity,
        "validity": "current" if projected_value is not None else "unknown",
        "review_status": "accepted" if decision_match or manual_match else "not_reviewed",
        "conflict_status": "none_detected",
        "projection_status": "projected" if projected_value is not None else "unavailable",
        "source_kind": source_kind,
        "scope": {"start_seconds": scope_start, "end_seconds": scope_end, "geometry": geometry},
        "evidence_refs": evidence_refs,
        "correction_refs": correction_refs,
        "decision_refs": decision_refs,
        "invalidated_decision_refs": relevant_invalidated_ids,
        "suppressed_validity_effects": relevant_validity_effects,
        "traceback_refs": decision_refs + correction_refs or evidence_refs,
        "compatibility_mode": True,
        "indication": indication,
    }


def project_subject_states(
    *,
    analysis_id: str,
    requests: Iterable[Dict[str, Any]],
    tracked_objects: Iterable[Dict[str, Any]],
    corrections: Dict[str, Any],
    decisions: Iterable[Dict[str, Any]] = (),
) -> Dict[str, Any]:
    """Resolve several subjects against one loaded evidence snapshot."""
    tracked_snapshot = [item for item in tracked_objects if isinstance(item, dict)]
    projections = []
    for request in requests:
        if not isinstance(request, dict):
            continue
        subject_ref = str(request.get("subject_ref") or "").strip()
        timestamp = _number(request.get("timestamp"))
        if not subject_ref or timestamp is None or timestamp < 0:
            continue
        projections.append(
            project_subject_state(
                analysis_id=analysis_id,
                subject_ref=subject_ref,
                timestamp=timestamp,
                tracked_objects=tracked_snapshot,
                corrections=corrections,
                decisions=decisions,
            )
        )
    return {
        "schema": "vaa1.projected_subject_state_batch.v0.compatibility",
        "analysis_id": analysis_id,
        "projection_count": len(projections),
        "projections": projections,
        "compatibility_mode": True,
    }
