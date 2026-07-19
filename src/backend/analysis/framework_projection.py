"""Traceable framework projections over eligible interpretation candidates."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from .decision_ledger import append_decision


BOJE_5B = {"bet", "beneath", "between", "beyond", "becoming"}


def _id(prefix: str, *values: Any) -> str:
    raw = json.dumps(values, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return f"{prefix}-{hashlib.sha256(raw).hexdigest()[:20]}"


def write_framework_projections(path: str | Path, payload: Dict[str, Any]) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _current(records: list[Dict[str, Any]]) -> dict[str, Dict[str, Any]]:
    return {str(item.get("record_id")): item for item in records
            if item.get("kind") != "invalidation" and item.get("effective_validity", item.get("validity")) == "current"}


def build_framework_projections(analysis_id: str, registry_view: Dict[str, Any]) -> Dict[str, Any]:
    """Project candidates without strengthening their authority or maturity."""
    current = _current(list(registry_view.get("records") or []))
    claims = {
        key: item
        for key, item in current.items()
        if item.get("kind") == "claim" and item.get("status") == "candidate"
    }
    propositions = {}
    excluded = []
    for key, item in current.items():
        if item.get("kind") != "proposition":
            continue
        support = [current.get(str(ref)) for ref in item.get("support_refs", [])]
        eligible = bool(support) and all(
            source and (source.get("kind") != "claim" or source.get("status") == "candidate")
            for source in support
        )
        if eligible:
            propositions[key] = item
        else:
            excluded.append({"record_ref": key, "reason": "support_is_missing_invalid_or_observation_only"})

    nodes = [{
        "node_id": f"proposition:{key}", "node_type": "analytical_proposition",
        "label": item["statement"], "record_ref": key, "subject_ref": item.get("subject_ref"),
        "scope": item.get("scope", {}), "authority": item.get("authority"), "maturity": item.get("maturity"),
        "support_refs": item.get("support_refs", []), "counter_evidence_refs": item.get("counter_evidence_refs", []),
        "traceback_refs": item.get("support_refs", []),
    } for key, item in sorted(propositions.items())]
    edges = []
    for key, item in current.items():
        if item.get("kind") != "relation":
            continue
        if item.get("source_ref") not in propositions and item.get("source_ref") not in claims:
            continue
        if item.get("target_ref") not in propositions and item.get("target_ref") not in claims:
            continue
        edges.append({
            "edge_id": f"relation:{key}", "source_record_ref": item["source_ref"],
            "target_record_ref": item["target_ref"], "edge_type": item["relation_type"],
            "authority": item["authority"], "maturity": item["maturity"],
            "evidence_refs": item.get("evidence_refs", []), "counter_evidence_refs": item.get("counter_evidence_refs", []),
        })

    narrative_agents = []
    for key, item in propositions.items():
        subject = item.get("subject_ref") or {}
        if subject.get("type") not in {"narrative_agent", "character"}:
            continue
        narrative_agents.append({
            "projection_id": _id("narrative-agent", key), "record_ref": key, "narrative_agent_ref": subject,
            "candidate_reading": item["statement"], "scope": item.get("scope", {}),
            "alternatives": item.get("alternatives", []), "support_refs": item.get("support_refs", []),
            "counter_evidence_refs": item.get("counter_evidence_refs", []),
            "authority": "candidate_service", "canonical": False,
        })

    transitions = []
    for key, item in current.items():
        if item.get("kind") != "state_transition":
            continue
        eligible_state_refs = set(claims) | set(propositions)
        if item.get("before_ref") not in eligible_state_refs or item.get("after_ref") not in eligible_state_refs:
            continue
        transitions.append({
            "projection_id": _id("transition", key), "record_ref": key, "subject_ref": item.get("subject_ref"),
            "state_property": item.get("state_property"), "before_ref": item.get("before_ref"),
            "after_ref": item.get("after_ref"), "boundary": item.get("boundary"),
            "evidence_refs": item.get("evidence_refs", []), "authority": "candidate_service", "canonical": False,
        })

    boje_events = []
    for key, item in propositions.items():
        framework_ref = str(item.get("framework_ref") or "")
        orientation = framework_ref.removeprefix("boje_5b.") if framework_ref.startswith("boje_5b.") else ""
        if orientation not in BOJE_5B:
            continue
        boje_events.append({
            "event_id": _id("boje-5b", orientation, key), "orientation": orientation,
            "record_ref": key, "candidate_reading": item["statement"], "subject_ref": item.get("subject_ref"),
            "scope": item.get("scope", {}), "support_refs": item.get("support_refs", []),
            "counter_evidence_refs": item.get("counter_evidence_refs", []), "alternatives": item.get("alternatives", []),
            "framework_assignment": "explicit", "authority": "candidate_service", "canonical": False,
        })

    return {
        "schema": "vaa1.framework_projections.v1", "analysis_id": analysis_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "meaning_network": {"schema": "vaa1.meaning_network_candidate_projection.v1", "nodes": nodes, "edges": edges},
        "narrative_agent": {"schema": "vaa1.narrative_agent_candidate_projection.v1", "readings": narrative_agents, "state_transitions": transitions},
        "boje_5b": {"schema": "vaa1.boje_5b_candidate_projection.v1", "events": boje_events,
                    "rule": "A 5B orientation requires an explicit framework_ref; it is never guessed from keywords."},
        "excluded_records": excluded,
        "governance": {"candidate_authority_preserved": True, "canonical_write": False,
                       "observation_only_support_excluded": True, "counter_evidence_preserved": True},
    }


def confirm_proposition_to_ledger(
    *, analysis_id: str, ledger: Dict[str, Any], proposition: Dict[str, Any], payload: Dict[str, Any]
) -> tuple[Dict[str, Any], Dict[str, Any], bool]:
    """Explicit analyst action adapting one proposition into the canonical ledger."""
    if proposition.get("kind") != "proposition" or proposition.get("effective_validity", proposition.get("validity")) != "current":
        raise ValueError("A current proposition record is required")
    if str(payload.get("confirmation_action") or "") != "confirm_proposition":
        raise ValueError("confirmation_action must be confirm_proposition")
    authority = str(payload.get("authority") or "")
    if authority not in {"manual_confirmation", "explicit_user_confirmation"}:
        raise ValueError("Explicit analyst confirmation authority is required")
    subject = proposition.get("subject_ref") or {}
    decision_payload = {
        "decision_id": payload.get("decision_id") or _id("decision", proposition["record_id"], payload.get("value") or proposition["statement"]),
        "decision_action": "confirm_candidate", "subject_ref": subject,
        "property": str(payload.get("property") or "proposition.analytical"),
        "value": str(payload.get("value") or proposition["statement"]), "scope": proposition.get("scope") or {},
        "authority": authority, "maturity": "analyst_confirmed", "review_status": "accepted",
        "evidence_refs": list(dict.fromkeys([*proposition.get("support_refs", []), *payload.get("evidence_refs", [])])),
        "correction_refs": [proposition["record_id"]], "created_by": str(payload.get("created_by") or "analyst"),
        "provenance": {"writer_class": "analyst_interaction", "source_service": "interpretation_registry_confirmation"},
    }
    return append_decision(ledger, decision_payload, analysis_id=analysis_id)
