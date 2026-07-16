"""Canonical source-clock selection and local affected-scope planning."""

from __future__ import annotations

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
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_time_scope(
    payload: Dict[str, Any], *, duration_seconds: float | None = None
) -> Dict[str, Any]:
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
    start = max(0.0, start)
    end = start if end is None else max(start, end)
    if duration_seconds is not None:
        duration = max(0.0, float(duration_seconds))
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
        "precision_seconds": _number(payload.get("precision_seconds")),
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
    changed_scope: Dict[str, Any], dependents: Iterable[Dict[str, Any]]
) -> list[str]:
    changed = normalize_time_scope(changed_scope)
    affected: list[str] = []
    for dependent in dependents:
        reference = str(dependent.get("id") or dependent.get("ref") or "").strip()
        if not reference:
            continue
        try:
            scope = normalize_time_scope(dependent)
        except ValueError:
            continue
        if max(changed["start_seconds"], scope["start_seconds"]) <= min(
            changed["end_seconds"], scope["end_seconds"]
        ) + 0.03:
            affected.append(reference)
    return affected


def clock_affected_decision_refs(
    ledger: Dict[str, Any], changed_scope: Dict[str, Any]
) -> list[str]:
    """Return active canonical decisions whose own time scope overlaps a clock change."""
    changed = normalize_time_scope(changed_scope)
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
            normalized = normalize_time_scope({**scope, "timing_status": "inherited"})
        except ValueError:
            continue
        if max(changed["start_seconds"], normalized["start_seconds"]) <= min(
            changed["end_seconds"], normalized["end_seconds"]
        ) + 0.03:
            affected.append(decision_id)
    return affected
