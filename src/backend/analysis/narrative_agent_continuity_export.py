"""Governed portable export for one Stage 7 Narrative Agent construct."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Mapping


SCHEMA = "vaa1.narrative_agent_interpretation_export.v1"
PRODUCER = "datascene.stage7.narrative_agent_interpretation_export.v1"


def _text(value: Any) -> str:
    return str(value or "").strip()


def _canonical_bytes(payload: Mapping[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _checksum(payload: Mapping[str, Any]) -> str:
    return hashlib.sha256(_canonical_bytes(payload)).hexdigest()


def build_continuity_interpretation_export(
    projection: Mapping[str, Any], decision_ledger: Mapping[str, Any]
) -> Dict[str, Any]:
    """Build a source-chain-preserving package without flattening decision state."""
    invalidation = projection.get("invalidation") if isinstance(projection.get("invalidation"), dict) else {}
    if invalidation and _text(invalidation.get("state")) not in {"", "current"}:
        raise ValueError("Stale continuity projection is not export eligible")
    canonical = projection.get("canonical_collection")
    graph = projection.get("graph_projection")
    snapshot = projection.get("constellational_snapshot")
    if not all(isinstance(item, dict) for item in (canonical, graph, snapshot)):
        raise ValueError("Continuity projection is incomplete")
    revision = _text(projection.get("revision"))
    project_id = _text(canonical.get("project_id"))
    collection_id = _text(canonical.get("collection_id"))
    if not revision or not project_id or not collection_id:
        raise ValueError("Continuity export requires project, collection and revision")

    tickets = [
        copy.deepcopy(ticket) for ticket in graph.get("relation_tickets") or []
        if isinstance(ticket, dict) and _text(ticket.get("predicate")) == "spoken_by"
    ]
    edge_ids = {_text(ticket.get("edge_id")) for ticket in tickets}
    edges = [
        copy.deepcopy(edge) for edge in graph.get("edges") or []
        if isinstance(edge, dict) and _text(edge.get("edge_id")) in edge_ids
    ]
    node_ids = {
        _text(value)
        for ticket in tickets
        for value in (ticket.get("subject_node_id"), ticket.get("object_node_id"))
        if _text(value)
    }
    nodes = [
        copy.deepcopy(node) for node in graph.get("nodes") or []
        if isinstance(node, dict) and _text(node.get("node_id")) in node_ids
    ]
    evidence_ids = {
        _text(ref.get("evidence_id"))
        for ticket in tickets
        for ref in ticket.get("evidence_refs") or []
        if isinstance(ref, dict) and _text(ref.get("evidence_id"))
    }
    decision_history = [
        copy.deepcopy(decision) for decision in decision_ledger.get("decisions") or []
        if isinstance(decision, dict)
        and (
            _text((decision.get("subject_ref") or {}).get("id")) in edge_ids
            or bool(evidence_ids & {_text(item) for item in decision.get("evidence_refs") or []})
        )
    ]
    source_chain = [
        {
            "ticket_id": _text(ticket.get("ticket_id")),
            "edge_id": _text(ticket.get("edge_id")),
            "state": _text(ticket.get("state")),
            "authority": _text(ticket.get("authority")),
            "evidence_refs": copy.deepcopy(ticket.get("evidence_refs") or []),
            "source_navigation": copy.deepcopy(ticket.get("source_navigation")),
            "traceback_refs": copy.deepcopy(ticket.get("traceback_refs") or []),
        }
        for ticket in tickets
    ]
    states: Dict[str, int] = {}
    for ticket in tickets:
        state = _text(ticket.get("state")) or "candidate"
        states[state] = states.get(state, 0) + 1
    core = {
        "schema": SCHEMA,
        "project_id": project_id,
        "collection_id": collection_id,
        "canonical_revision": revision,
        "producer": {"id": PRODUCER, "projection_schema": _text(projection.get("schema"))},
        "eligibility": {"eligible": True, "checked_at_export": True, "reason": "current_canonical_projection"},
        "construct": {
            "construct_type": "speaker_attribution",
            "narrative_agent_key": _text(canonical.get("narrative_agent_key")),
            "narrative_agent_label": _text(canonical.get("narrative_agent_label")),
            "relation_tickets": tickets,
            "edges": edges,
            "nodes": nodes,
            "constellational_layer": copy.deepcopy((snapshot.get("layers") or {}).get("who_is_speaking")),
        },
        "decision_history": decision_history,
        "source_chain": source_chain,
        "state_distinctions": {"counts": states, "flattened": False},
    }
    return {
        **core,
        "content_checksum": _checksum(core),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def restore_continuity_interpretation_export(
    payload: Mapping[str, Any], *, expected_project_id: str
) -> Dict[str, Any]:
    """Validate and restore an export in isolation."""
    if _text(payload.get("schema")) != SCHEMA:
        raise ValueError("Unsupported continuity interpretation export schema")
    if _text(payload.get("project_id")) != expected_project_id:
        raise ValueError("Continuity interpretation export belongs to another project")
    core = {
        key: copy.deepcopy(payload.get(key))
        for key in (
            "schema", "project_id", "collection_id", "canonical_revision", "producer",
            "eligibility", "construct", "decision_history", "source_chain", "state_distinctions",
        )
    }
    if _checksum(core) != _text(payload.get("content_checksum")):
        raise ValueError("Continuity interpretation export checksum mismatch")
    if not (payload.get("eligibility") or {}).get("eligible"):
        raise ValueError("Continuity interpretation export is not eligible")
    return copy.deepcopy(dict(payload))


def write_continuity_interpretation_export(
    path: str | Path, projection: Mapping[str, Any], decision_ledger: Mapping[str, Any]
) -> Dict[str, Any]:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = build_continuity_interpretation_export(projection, decision_ledger)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    restored = restore_continuity_interpretation_export(
        json.loads(temporary.read_text(encoding="utf-8")),
        expected_project_id=payload["project_id"],
    )
    temporary.replace(destination)
    return restored
