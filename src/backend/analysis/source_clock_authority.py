"""Canonical source-clock selection and local affected-scope planning."""

from __future__ import annotations

import math
from typing import Any, Dict, Iterable


AUTHORITY_RANK = {
    "explicit_user_correction": 500,
    "anchor_verified": 400,
    "vad_anchor_verified": 350,
    "source_measured": 300,
    "candidate": 200,
    "inherited": 100,
    "degraded": 50,
    "unknown": 0,
}


def _number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Clock values must be finite numbers, not booleans")
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError("Clock values must be finite numbers") from exc
    if not math.isfinite(number):
        raise ValueError("Clock values must be finite numbers")
    return number


def bind_analysis_scope(payload: Dict[str, Any], analysis_id: str) -> Dict[str, Any]:
    """Bind legacy evidence refs to the owning analysis without changing them."""
    if not isinstance(payload, dict):
        raise ValueError("Clock scope must be an object")
    declared = payload.get("analysis_id")
    if declared is not None and declared != analysis_id:
        raise ValueError("Clock scope belongs to a different analysis")
    return {**payload, "analysis_id": analysis_id}


def _same_source(left: Dict[str, Any], right: Dict[str, Any]) -> bool:
    # The API supplies the owning analysis; source_ref may be an evidence-row ID.
    # Outside that boundary, explicit source references must match exactly.
    if left.get("source_fingerprint") and right.get("source_fingerprint") and left["source_fingerprint"] != right["source_fingerprint"]:
        return False
    if left.get("analysis_id") or right.get("analysis_id"):
        return bool(left.get("analysis_id")) and left.get("analysis_id") == right.get("analysis_id")
    return left.get("source_ref", "") == right.get("source_ref", "")


def normalize_time_scope(
    payload: Dict[str, Any], *, duration_seconds: float | None = None
) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Clock scope must be an object")
    if payload.get("clock_id", "source_media.clock") != "source_media.clock":
        raise ValueError("Unsupported clock_id")
    for field in ("analysis_id", "source_ref"):
        if field in payload and (not isinstance(payload[field], str) or (field == "analysis_id" and not payload[field].strip())):
            raise ValueError(f"{field} must be a nonempty string when supplied")
    for field in ("source_fingerprint", "clock_revision"):
        if field in payload and (not isinstance(payload[field], str) or not payload[field].strip()):
            raise ValueError(f"{field} must be a nonempty string when supplied")
    if ("source_fingerprint" in payload) != ("clock_revision" in payload):
        raise ValueError("source_fingerprint and clock_revision must be supplied together")
    precision = _number(payload.get("precision_seconds"))
    if precision is not None and precision < 0:
        raise ValueError("precision_seconds must be nonnegative")
    start = _number(payload.get("start_seconds"))
    end = _number(payload.get("end_seconds"))
    if start is None and payload.get("t_start_ms") is not None:
        start = _number(payload.get("t_start_ms"))
        start = start / 1000 if start is not None else None
    if end is None and payload.get("t_end_ms") is not None:
        end = _number(payload.get("t_end_ms"))
        end = end / 1000 if end is not None else None
    if start is None:
        raise ValueError("start_seconds or t_start_ms is required")
    # A researcher-authored boundary must never be silently changed by clamping.
    explicit_correction = (payload.get("timing_status") or payload.get("authority")) == "explicit_user_correction"
    if explicit_correction and (start < 0 or (end is not None and end < start)):
        raise ValueError("Explicit clock corrections require nonnegative, ordered bounds")
    start = max(0.0, start)
    end = start if end is None else max(start, end)
    if duration_seconds is not None:
        duration = _number(duration_seconds)
        if duration < 0:
            raise ValueError("duration_seconds must be nonnegative")
        if explicit_correction and (start > duration or end > duration):
            raise ValueError("Explicit clock correction exceeds source duration")
        start = min(start, duration)
        end = min(max(start, end), duration)
    timing_status = str(payload.get("timing_status") or payload.get("authority") or "unknown")
    if timing_status not in AUTHORITY_RANK:
        raise ValueError(f"Unknown timing_status: {timing_status}")
    return {
        "clock_id": str(payload.get("clock_id") or "source_media.clock"),
        "source_ref": str(payload.get("source_ref") or ""),
        "start_seconds": round(start, 6),
        "end_seconds": round(end, 6),
        "precision_seconds": precision,
        **({"analysis_id": payload["analysis_id"]} if "analysis_id" in payload else {}),
        **({key: payload[key] for key in ("source_fingerprint", "clock_revision")} if "source_fingerprint" in payload else {}),
        "timing_status": timing_status,
        "authority_rank": AUTHORITY_RANK[timing_status],
        "revision_ref": payload.get("revision_ref"),
    }


def select_authoritative_time_scope(
    candidates: Iterable[Dict[str, Any]], *, duration_seconds: float | None = None
) -> Dict[str, Any]:
    normalized = [normalize_time_scope(item, duration_seconds=duration_seconds) for item in candidates]
    if not normalized:
        raise ValueError("At least one time candidate is required")
    if any(not _same_source(normalized[0], item) for item in normalized[1:]):
        raise ValueError("Clock candidates must belong to the same source")
    if len({item.get("clock_revision") for item in normalized}) > 1:
        raise ValueError("Clock candidates must share one revision; do not mix unversioned and bound evidence")
    normalized.sort(
        key=lambda item: (
            item["authority_rank"],
            -float(item["precision_seconds"] if item["precision_seconds"] is not None else 1e9),
        ),
        reverse=True,
    )
    selected = dict(normalized[0])
    selected["candidate_count"] = len(normalized)
    selected["superseded_time_refs"] = [
        item.get("revision_ref") for item in normalized[1:] if item.get("revision_ref")
    ]
    return selected


def overlapping_dependents(
    changed_scope: Dict[str, Any], dependents: Iterable[Dict[str, Any]], *, whole_source: bool = False
) -> list[str]:
    changed = normalize_time_scope(changed_scope)
    affected: list[str] = []
    for dependent in dependents:
        if not isinstance(dependent, dict):
            continue
        reference = str(dependent.get("id") or dependent.get("ref") or "").strip()
        if not reference:
            continue
        try:
            scope = normalize_time_scope(dependent)
        except ValueError:
            continue
        if not (whole_source and changed.get("analysis_id") and changed.get("analysis_id") == scope.get("analysis_id")) and not _same_source(changed, scope):
            continue
        if whole_source or max(changed["start_seconds"], scope["start_seconds"]) <= min(
            changed["end_seconds"], scope["end_seconds"]
        ) + 0.03:
            affected.append(reference)
    return affected


def clock_affected_decision_refs(
    ledger: Dict[str, Any], changed_scope: Dict[str, Any], *, whole_source: bool = False
) -> list[str]:
    """Return active canonical decisions whose own time scope overlaps a clock change."""
    changed = normalize_time_scope(changed_scope)
    if changed.get("analysis_id") and ledger.get("analysis_id") != changed["analysis_id"]:
        return []
    decisions = [item for item in ledger.get("decisions", []) if isinstance(item, dict)]
    superseded = {
        str(reference)
        for item in decisions
        for reference in item.get("supersedes", [])
        if reference
    }
    invalidated = {
        str(reference)
        for item in decisions
        if item.get("decision_action") == "invalidate"
        for reference in item.get("target_decision_refs", [])
        if reference
    }
    affected: list[str] = []
    for decision in decisions:
        decision_id = str(decision.get("decision_id") or "")
        if (
            not decision_id
            or decision.get("decision_action") == "invalidate"
            or decision_id in superseded
            or decision_id in invalidated
        ):
            continue
        scope = decision.get("scope") if isinstance(decision.get("scope"), dict) else {}
        if scope.get("start_seconds") is None:
            continue
        try:
            if changed.get("analysis_id"):
                if decision.get("analysis_id", ledger.get("analysis_id")) != changed["analysis_id"]:
                    continue
                scope = bind_analysis_scope(scope, changed["analysis_id"])
            normalized = normalize_time_scope({**scope, "timing_status": "inherited"})
        except ValueError:
            continue
        if not (whole_source and changed.get("analysis_id") and changed.get("analysis_id") == normalized.get("analysis_id")) and not _same_source(changed, normalized):
            continue
        if whole_source or max(changed["start_seconds"], normalized["start_seconds"]) <= min(
            changed["end_seconds"], normalized["end_seconds"]
        ) + 0.03:
            affected.append(decision_id)
    return affected
