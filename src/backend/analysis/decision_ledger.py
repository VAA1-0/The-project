"""Append-only canonical decision ledger primitives for the VAA1 pilot."""

from __future__ import annotations

import copy
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional


LEDGER_SCHEMA = "vaa1.canonical_decision_ledger.v0"
DECISION_SCHEMA = "vaa1.canonical_decision.v0"
INVALIDATION_SCHEMA = "vaa1.canonical_invalidation.v0"

AUTHORITATIVE_ACTIONS = {
    "correct_assignment",
    "drop_assignment",
    "confirm_candidate",
    "reject_candidate",
    "defer_candidate",
    "review_candidate",
}
ANALYST_AUTHORITIES = {
    "explicit_user_correction",
    "manual_correction",
    "manual_confirmation",
    "manual_rejection",
    "manual_review",
    "explicit_user_confirmation",
}
CANDIDATE_WRITER_CLASSES = {
    "candidate_service",
    "matcher",
    "model",
    "automatic_pipeline",
    "proliferation_candidate_service",
}


def empty_decision_ledger(analysis_id: str) -> Dict[str, Any]:
    return {
        "schema": LEDGER_SCHEMA,
        "analysis_id": analysis_id,
        "version": 1,
        "decisions": [],
    }


def _number(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _overlaps(left: Dict[str, Any], right: Dict[str, Any]) -> bool:
    left_start = _number(left.get("start_seconds"))
    left_end = _number(left.get("end_seconds"))
    right_start = _number(right.get("start_seconds"))
    right_end = _number(right.get("end_seconds"))
    if not left or not right:
        return True
    if None in (left_start, left_end, right_start, right_end):
        return False
    return max(min(left_start, left_end), min(right_start, right_end)) <= min(
        max(left_start, left_end), max(right_start, right_end)
    ) + 0.03


def superseded_decision_ids(decisions: Iterable[Dict[str, Any]]) -> set[str]:
    result: set[str] = set()
    for decision in decisions:
        if not isinstance(decision, dict):
            continue
        result.update(str(item) for item in decision.get("supersedes", []) if item)
    return result


def invalidated_decision_ids(decisions: Iterable[Dict[str, Any]]) -> set[str]:
    result: set[str] = set()
    for decision in decisions:
        if not isinstance(decision, dict) or decision.get("decision_action") != "invalidate":
            continue
        result.update(str(item) for item in decision.get("target_decision_refs", []) if item)
    return result


def validate_canonical_write_policy(payload: Dict[str, Any]) -> None:
    """Prevent proposal-producing services from declaring canonical truth."""
    action = str(payload.get("decision_action") or "correct_assignment")
    authority = str(payload.get("authority") or "explicit_user_correction")
    provenance = payload.get("provenance") if isinstance(payload.get("provenance"), dict) else {}
    writer_class = str(provenance.get("writer_class") or "analyst_interaction")
    if action not in AUTHORITATIVE_ACTIONS:
        raise ValueError(f"Unsupported canonical decision action: {action}")
    if writer_class in CANDIDATE_WRITER_CLASSES:
        raise ValueError("Candidate services may produce proposals but may not append canonical decisions")
    if authority not in ANALYST_AUTHORITIES:
        raise ValueError("Canonical decisions require explicit analyst authority")


def append_invalidation(
    ledger: Dict[str, Any],
    payload: Dict[str, Any],
    *,
    analysis_id: str,
) -> tuple[Dict[str, Any], Dict[str, Any], bool]:
    """Append an immutable invalidation event for matching canonical decisions."""
    current = copy.deepcopy(ledger) if isinstance(ledger, dict) else empty_decision_ledger(analysis_id)
    decisions: List[Dict[str, Any]] = current.setdefault("decisions", [])
    explicit_refs = {str(item) for item in payload.get("target_decision_refs", []) if item}
    correction_ref = str(payload.get("correction_ref") or "").strip()
    if correction_ref:
        explicit_refs.update(
            str(item.get("decision_id"))
            for item in decisions
            if isinstance(item, dict) and correction_ref in item.get("correction_refs", [])
        )
    target_refs = sorted(item for item in explicit_refs if item)
    if not target_refs:
        raise ValueError("At least one existing target decision is required")
    known_ids = {str(item.get("decision_id")) for item in decisions if isinstance(item, dict)}
    if any(item not in known_ids for item in target_refs):
        raise ValueError("Every target decision must already exist in this ledger")

    event = {
        "schema": INVALIDATION_SCHEMA,
        "decision_id": str(payload.get("decision_id") or uuid.uuid4().hex),
        "analysis_id": analysis_id,
        "decision_action": "invalidate",
        "target_decision_refs": target_refs,
        "reason_code": str(payload.get("reason_code") or "source_record_changed"),
        "reason": str(payload.get("reason") or "The source-linked assertion is no longer current."),
        "dependency_ref": payload.get("dependency_ref"),
        "validity_effect": str(payload.get("validity_effect") or "invalid"),
        "authority": str(payload.get("authority") or "explicit_user_correction"),
        "validity": "current",
        "review_status": str(payload.get("review_status") or "accepted"),
        "projection_status": "active",
        "created_at": str(payload.get("created_at") or datetime.now(timezone.utc).isoformat()),
        "created_by": str(payload.get("created_by") or "analyst"),
    }
    existing = next((item for item in decisions if item.get("decision_id") == event["decision_id"]), None)
    if existing is not None:
        if json.dumps(existing, sort_keys=True) != json.dumps(event, sort_keys=True):
            raise ValueError("decision_id already exists with different content")
        return current, copy.deepcopy(existing), False
    decisions.append(event)
    return current, copy.deepcopy(event), True


def append_dependency_invalidation(
    ledger: Dict[str, Any],
    payload: Dict[str, Any],
    *,
    analysis_id: str,
) -> tuple[Dict[str, Any], Dict[str, Any], bool]:
    """Select active decisions affected by a declared dependency change."""
    decisions = ledger.get("decisions", []) if isinstance(ledger, dict) else []
    superseded = superseded_decision_ids(decisions)
    invalidated = invalidated_decision_ids(decisions)
    requested_ids = {str(item) for item in payload.get("target_decision_refs", []) if item}
    subject_ids = {str(item) for item in payload.get("affected_subject_refs", []) if item}
    properties = {str(item) for item in payload.get("affected_properties", []) if item}
    evidence_refs = {str(item) for item in payload.get("affected_evidence_refs", []) if item}
    require_temporal_scope = bool(payload.get("require_temporal_scope"))
    selected: set[str] = set(requested_ids)
    for item in decisions:
        if not isinstance(item, dict) or item.get("decision_action") == "invalidate":
            continue
        decision_id = str(item.get("decision_id") or "")
        if not decision_id or decision_id in superseded | invalidated:
            continue
        if require_temporal_scope and item.get("scope", {}).get("start_seconds") is None:
            continue
        subject_match = bool(subject_ids and str(item.get("subject_ref", {}).get("id") or "") in subject_ids)
        property_match = bool(properties and str(item.get("property") or "") in properties)
        evidence_match = bool(evidence_refs.intersection(str(ref) for ref in item.get("evidence_refs", [])))
        if subject_match or property_match or evidence_match or (
            require_temporal_scope and not subject_ids and not properties and not evidence_refs
        ):
            selected.add(decision_id)
    forwarded = copy.deepcopy(payload)
    forwarded["target_decision_refs"] = sorted(selected)
    return append_invalidation(ledger, forwarded, analysis_id=analysis_id)


def append_decision(
    ledger: Dict[str, Any],
    payload: Dict[str, Any],
    *,
    analysis_id: str,
) -> tuple[Dict[str, Any], Dict[str, Any], bool]:
    """Return a copied ledger with one immutable decision appended.

    Repeating an identical decision id is idempotent. Reusing it for different
    content is rejected so an accepted record can never be silently rewritten.
    """
    current = copy.deepcopy(ledger) if isinstance(ledger, dict) else empty_decision_ledger(analysis_id)
    current.setdefault("schema", LEDGER_SCHEMA)
    current.setdefault("analysis_id", analysis_id)
    current.setdefault("version", 1)
    decisions: List[Dict[str, Any]] = current.setdefault("decisions", [])

    subject = payload.get("subject_ref")
    scope = payload.get("scope")
    value = str(payload.get("value") or "").strip()
    if not isinstance(subject, dict) or not str(subject.get("id") or "").strip():
        raise ValueError("subject_ref.id is required")
    if not isinstance(scope, dict):
        raise ValueError("scope is required")
    if not value:
        raise ValueError("value is required")
    validate_canonical_write_policy(payload)

    decision = copy.deepcopy(payload)
    decision["schema"] = DECISION_SCHEMA
    decision["decision_id"] = str(payload.get("decision_id") or uuid.uuid4().hex)
    decision["analysis_id"] = analysis_id
    decision["decision_action"] = str(payload.get("decision_action") or "correct_assignment")
    decision["property"] = str(payload.get("property") or "label")
    decision["value"] = value
    decision["authority"] = str(payload.get("authority") or "explicit_user_correction")
    decision["maturity"] = str(payload.get("maturity") or "analyst_confirmed")
    decision["validity"] = str(payload.get("validity") or "current")
    decision["review_status"] = str(payload.get("review_status") or "accepted")
    decision["conflict_status"] = str(payload.get("conflict_status") or "none_detected")
    decision["projection_status"] = str(payload.get("projection_status") or "active")
    decision["created_at"] = str(payload.get("created_at") or datetime.now(timezone.utc).isoformat())
    decision["created_by"] = str(payload.get("created_by") or "analyst")
    decision["evidence_refs"] = [str(item) for item in payload.get("evidence_refs", []) if item]
    decision["correction_refs"] = [str(item) for item in payload.get("correction_refs", []) if item]

    supersedes = {str(item) for item in payload.get("supersedes", []) if item}
    already_superseded = superseded_decision_ids(decisions)
    for prior in decisions:
        if not isinstance(prior, dict) or prior.get("decision_id") in already_superseded:
            continue
        same_subject = prior.get("subject_ref", {}).get("id") == subject.get("id")
        if same_subject and prior.get("property", "label") == decision["property"] and _overlaps(prior.get("scope", {}), scope):
            supersedes.add(str(prior.get("decision_id")))
    decision["supersedes"] = sorted(item for item in supersedes if item and item != decision["decision_id"])

    existing = next((item for item in decisions if item.get("decision_id") == decision["decision_id"]), None)
    if existing is not None:
        if json.dumps(existing, sort_keys=True) != json.dumps(decision, sort_keys=True):
            raise ValueError("decision_id already exists with different content")
        return current, copy.deepcopy(existing), False

    decisions.append(decision)
    return current, copy.deepcopy(decision), True
