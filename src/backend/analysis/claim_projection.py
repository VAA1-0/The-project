"""Deterministic cross-panel projection of canonical VAA1 claims."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple


AUTHORITY_ORDER = {
    "explicit_user_correction": 60,
    "manual_correction": 60,
    "manual_confirmation": 50,
    "explicit_user_confirmation": 50,
    "manual_rejection": 50,
    "manual_review": 40,
}


def _number(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _created(item: Dict[str, Any]) -> float:
    try:
        return datetime.fromisoformat(str(item.get("created_at") or "").replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def _in_scope(item: Dict[str, Any], timestamp: Optional[float]) -> bool:
    if timestamp is None:
        return True
    scope = item.get("scope") if isinstance(item.get("scope"), dict) else {}
    start = _number(scope.get("start_seconds"))
    end = _number(scope.get("end_seconds"))
    if start is None:
        return True
    if end is None:
        end = start
    return min(start, end) - 0.03 <= timestamp <= max(start, end) + 0.03


def project_canonical_claims(
    *,
    analysis_id: str,
    decisions: Iterable[Dict[str, Any]],
    subject_refs: Iterable[str] = (),
    properties: Iterable[str] = (),
    timestamp: Optional[float] = None,
) -> Dict[str, Any]:
    snapshot = [item for item in decisions if isinstance(item, dict)]
    requested_subjects = {str(item) for item in subject_refs if item}
    requested_properties = {str(item) for item in properties if item}
    superseded = {
        str(ref) for item in snapshot for ref in item.get("supersedes", []) if ref
    }
    invalidation_events = [item for item in snapshot if item.get("decision_action") == "invalidate"]
    invalidated = {
        str(ref) for item in invalidation_events for ref in item.get("target_decision_refs", []) if ref
    }
    groups: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
    for item in snapshot:
        decision_id = str(item.get("decision_id") or "")
        if not decision_id or item.get("decision_action") == "invalidate":
            continue
        if decision_id in superseded | invalidated or not _in_scope(item, timestamp):
            continue
        subject = item.get("subject_ref") if isinstance(item.get("subject_ref"), dict) else {}
        subject_id = str(subject.get("id") or "")
        property_name = str(item.get("property") or "")
        if requested_subjects and subject_id not in requested_subjects:
            continue
        if requested_properties and property_name not in requested_properties:
            continue
        key = (str(subject.get("type") or "unknown"), subject_id, property_name)
        groups.setdefault(key, []).append(item)

    claims: List[Dict[str, Any]] = []
    for (subject_type, subject_id, property_name), candidates in sorted(groups.items()):
        winner = max(
            candidates,
            key=lambda item: (AUTHORITY_ORDER.get(str(item.get("authority") or ""), 0), _created(item)),
        )
        action = str(winner.get("decision_action") or "correct_assignment")
        suppressed = action in {"drop_assignment", "reject_candidate"}
        claims.append({
            "schema": "vaa1.projected_claim.v0",
            "analysis_id": analysis_id,
            "subject_ref": {"type": subject_type, "id": subject_id},
            "property": property_name,
            "projected_value": None if suppressed else winner.get("value"),
            "authority": winner.get("authority"),
            "maturity": winner.get("maturity"),
            "validity": "current",
            "review_status": winner.get("review_status", "accepted"),
            "projection_status": "suppressed" if suppressed else "projected",
            "scope": winner.get("scope", {}),
            "decision_refs": [winner.get("decision_id")],
            "evidence_refs": winner.get("evidence_refs", []),
            "correction_refs": winner.get("correction_refs", []),
            "traceback_refs": [winner.get("decision_id")] + winner.get("correction_refs", []) + winner.get("evidence_refs", []),
            "indication": None,
        })
    return {
        "schema": "vaa1.projected_claim_collection.v0",
        "analysis_id": analysis_id,
        "claim_count": len(claims),
        "claims": claims,
    }
