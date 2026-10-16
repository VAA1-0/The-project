"""Append-only analyst decisions for governed Narrative Agent collections."""
from __future__ import annotations

import copy
from typing import Any, Dict, Mapping, Sequence

from .decision_ledger import append_decision, empty_decision_ledger


SCHEMA = "vaa1.narrative_agent_continuity_decision.v1"
MEMBERSHIP_OPERATIONS = {"include", "exclude", "confirm", "reject", "defer"}
STRUCTURE_OPERATIONS = {"split", "merge"}
OPERATIONS = MEMBERSHIP_OPERATIONS | STRUCTURE_OPERATIONS | {"undo"}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _all_occurrences(inventory: Mapping[str, Any]) -> Dict[str, Dict[str, Any]]:
    rows = list(_list(inventory.get("confirmed_occurrences")))
    corridor = inventory.get("selected_continuity_corridor")
    if isinstance(corridor, dict):
        rows.extend(_list(corridor.get("proposed_members")))
    return {
        _text(row.get("occurrence_id")): copy.deepcopy(row)
        for row in rows
        if isinstance(row, dict) and _text(row.get("occurrence_id"))
    }


def _validate_boundary(inventory: Mapping[str, Any], project_id: str) -> None:
    inventory_project = _text(inventory.get("project_id"))
    if not project_id or not inventory_project or inventory_project != project_id:
        raise ValueError("Continuity decision project boundary mismatch")


def _find_decision(ledger: Mapping[str, Any], decision_id: str) -> Dict[str, Any] | None:
    for decision in _list(ledger.get("decisions")):
        if isinstance(decision, dict) and _text(decision.get("decision_id")) == decision_id:
            return decision
    return None


def append_continuity_decision(
    ledger: Mapping[str, Any] | None,
    payload: Mapping[str, Any],
    *,
    analysis_id: str,
    project_id: str,
    inventory: Mapping[str, Any],
) -> tuple[Dict[str, Any], Dict[str, Any], bool]:
    """Append one analyst decision without modifying inventory occurrences."""
    _validate_boundary(inventory, project_id)
    operation = _text(payload.get("operation")).casefold()
    if operation not in OPERATIONS:
        raise ValueError(f"Unsupported continuity operation: {operation}")
    collection_id = _text(payload.get("collection_id"))
    if not collection_id:
        raise ValueError("collection_id is required")
    actor = _text(payload.get("created_by")) or "analyst"
    occurrences = _all_occurrences(inventory)
    decision_payload: Dict[str, Any]

    if operation == "undo":
        target_id = _text(payload.get("target_decision_id"))
        target = _find_decision(ledger or {}, target_id)
        if target is None:
            raise ValueError("Undo target must exist in this continuity ledger")
        if _text(target.get("project_id")) != project_id:
            raise ValueError("Undo target belongs to another project")
        decision_payload = {
            "decision_id": payload.get("decision_id"),
            "decision_action": "correct_assignment",
            "subject_ref": copy.deepcopy(target.get("subject_ref")),
            "property": _text(target.get("property")),
            "value": "undone",
            "scope": copy.deepcopy(target.get("scope") or {}),
            "supersedes": [target_id],
            "authority": "explicit_user_correction",
            "created_by": actor,
            "evidence_refs": list(target.get("evidence_refs") or []),
            "provenance": {"writer_class": "analyst_interaction"},
            "continuity_operation": "undo",
            "undo_target_decision_id": target_id,
        }
    elif operation == "confirm" and _text(payload.get("target_kind")) == "collection":
        decision_payload = {
            "decision_id": payload.get("decision_id"),
            "decision_action": "confirm_candidate",
            "subject_ref": {"type": "narrative_agent_collection", "id": collection_id},
            "property": "narrative_agent.continuity_claim",
            "value": "accepted",
            "scope": {},
            "authority": "explicit_user_confirmation",
            "created_by": actor,
            "evidence_refs": [_text(item) for item in _list(payload.get("evidence_refs")) if _text(item)],
            "provenance": {"writer_class": "analyst_interaction"},
            "continuity_operation": "confirm_collection",
        }
    elif operation in MEMBERSHIP_OPERATIONS:
        occurrence_id = _text(payload.get("occurrence_id"))
        occurrence = occurrences.get(occurrence_id)
        if occurrence is None:
            raise ValueError("Continuity membership decision requires an occurrence in this inventory")
        if _text(occurrence.get("analysis_id")) != analysis_id:
            raise ValueError("Occurrence belongs to another analysis")
        interval = occurrence.get("source_interval") if isinstance(occurrence.get("source_interval"), dict) else {}
        decision_payload = {
            "decision_id": payload.get("decision_id"),
            "decision_action": (
                "confirm_candidate"
                if operation in {"include", "confirm"}
                else "reject_candidate"
                if operation in {"exclude", "reject"}
                else "defer_candidate"
            ),
            "subject_ref": {"type": "narrative_agent_occurrence", "id": occurrence_id},
            "property": "narrative_agent.continuity_membership",
            "value": operation,
            "scope": {
                "start_seconds": interval.get("start"),
                "end_seconds": interval.get("end"),
            },
            "authority": "explicit_user_confirmation" if operation in {"include", "confirm"} else "manual_review",
            "created_by": actor,
            "evidence_refs": [occurrence_id, *list(occurrence.get("traceback_refs") or [])],
            "provenance": {"writer_class": "analyst_interaction"},
            "continuity_operation": operation,
            "occurrence_snapshot": occurrence,
        }
    else:
        related = [_text(item) for item in _list(payload.get("related_collection_ids")) if _text(item)]
        if not related:
            raise ValueError(f"{operation} requires related_collection_ids")
        decision_payload = {
            "decision_id": payload.get("decision_id"),
            "decision_action": "correct_assignment",
            "subject_ref": {"type": "narrative_agent_collection", "id": collection_id},
            "property": f"narrative_agent.continuity_{operation}",
            "value": operation,
            "scope": {},
            "authority": "explicit_user_correction",
            "created_by": actor,
            "evidence_refs": related,
            "provenance": {"writer_class": "analyst_interaction"},
            "continuity_operation": operation,
            "related_collection_ids": related,
        }

    decision_payload.update(
        {
            "continuity_schema": SCHEMA,
            "project_id": project_id,
            "collection_id": collection_id,
            "inventory_fingerprint": _text(inventory.get("inventory_fingerprint")),
            "reason": _text(payload.get("reason")),
        }
    )
    return append_decision(
        dict(ledger) if isinstance(ledger, dict) else empty_decision_ledger(analysis_id),
        decision_payload,
        analysis_id=analysis_id,
    )


def project_continuity_decisions(
    ledger: Mapping[str, Any], *, project_id: str, collection_id: str
) -> Dict[str, Any]:
    """Project current collection state, honoring append-only undo events."""
    decisions = [
        row
        for row in _list(ledger.get("decisions"))
        if isinstance(row, dict)
        and _text(row.get("project_id")) == project_id
        and _text(row.get("collection_id")) == collection_id
    ]
    undone = {
        _text(row.get("undo_target_decision_id"))
        for row in decisions
        if _text(row.get("continuity_operation")) == "undo"
    }
    active = [
        row
        for row in decisions
        if _text(row.get("decision_id")) not in undone
        and _text(row.get("continuity_operation")) != "undo"
    ]
    latest_by_subject: Dict[str, Dict[str, Any]] = {}
    for row in active:
        subject = row.get("subject_ref") if isinstance(row.get("subject_ref"), dict) else {}
        subject_id = _text(subject.get("id"))
        if subject_id:
            latest_by_subject[subject_id] = row
    included = []
    excluded = []
    deferred = []
    for subject_id, row in latest_by_subject.items():
        operation = _text(row.get("continuity_operation"))
        if operation in {"include", "confirm"}:
            included.append(subject_id)
        elif operation in {"exclude", "reject"}:
            excluded.append(subject_id)
        elif operation == "defer":
            deferred.append(subject_id)
    return {
        "schema": "vaa1.narrative_agent_continuity_projection.v1",
        "project_id": project_id,
        "collection_id": collection_id,
        "included_occurrence_ids": sorted(included),
        "excluded_occurrence_ids": sorted(excluded),
        "deferred_occurrence_ids": sorted(deferred),
        "structure_decisions": [
            copy.deepcopy(row)
            for row in active
            if _text(row.get("continuity_operation")) in STRUCTURE_OPERATIONS
        ],
        "collection_confirmation": next(
            (
                copy.deepcopy(row)
                for row in reversed(active)
                if _text(row.get("continuity_operation")) == "confirm_collection"
            ),
            None,
        ),
        "active_decision_ids": [_text(row.get("decision_id")) for row in active],
        "undone_decision_ids": sorted(item for item in undone if item),
    }
