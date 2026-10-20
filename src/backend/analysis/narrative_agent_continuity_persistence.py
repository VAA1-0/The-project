"""Durable, hermetic persistence for Narrative Agent continuity artifacts."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Mapping, Sequence


SCHEMA = "vaa1.narrative_agent_continuity_saved_state.v1"


def _text(value: Any) -> str:
    return str(value or "").strip()


def _canonical_bytes(payload: Mapping[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _checksum(payload: Mapping[str, Any]) -> str:
    return hashlib.sha256(_canonical_bytes(payload)).hexdigest()


def changed_correction_occurrence_ids(
    previous: Mapping[str, Any], current: Mapping[str, Any]
) -> list[str]:
    """Return stable source ids whose correction row was added, changed or removed."""
    collections = ("manual_visual_annotations", "text_substitutions")

    def indexed(payload: Mapping[str, Any]) -> Dict[str, Any]:
        rows: Dict[str, Any] = {}
        for collection in collections:
            values = payload.get(collection) if isinstance(payload.get(collection), list) else []
            for row in values:
                if not isinstance(row, dict):
                    continue
                occurrence_id = _text(row.get("id"))
                if occurrence_id:
                    rows[occurrence_id] = row
        return rows

    before, after = indexed(previous), indexed(current)
    return sorted(
        occurrence_id
        for occurrence_id in set(before) | set(after)
        if before.get(occurrence_id) != after.get(occurrence_id)
    )


def build_saved_continuity_state(
    *,
    inventory: Mapping[str, Any],
    decision_ledger: Mapping[str, Any],
    projection: Mapping[str, Any],
    project_id: str,
    analysis_ids: Sequence[str],
) -> Dict[str, Any]:
    """Build a portable snapshot whose checksum excludes volatile save time."""
    if _text(inventory.get("project_id")) != project_id:
        raise ValueError("Continuity inventory project boundary mismatch")
    canonical = projection.get("canonical_collection")
    if not isinstance(canonical, dict) or _text(canonical.get("project_id")) != project_id:
        raise ValueError("Continuity projection project boundary mismatch")
    payload = {
        "schema": SCHEMA,
        "project_id": project_id,
        "analysis_ids": sorted({_text(item) for item in analysis_ids if _text(item)}),
        "inventory": copy.deepcopy(dict(inventory)),
        "decision_ledger": copy.deepcopy(dict(decision_ledger)),
        "projection": copy.deepcopy(dict(projection)),
        "projection_revision": _text(projection.get("revision")),
    }
    return {
        **payload,
        "content_checksum": _checksum(payload),
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }


def validate_saved_continuity_state(
    state: Mapping[str, Any], *, expected_project_id: str | None = None
) -> Dict[str, Any]:
    if _text(state.get("schema")) != SCHEMA:
        raise ValueError("Unsupported continuity saved-state schema")
    project_id = _text(state.get("project_id"))
    if not project_id:
        raise ValueError("Continuity saved state requires project_id")
    if expected_project_id and project_id != expected_project_id:
        raise ValueError("Continuity saved state belongs to another project")
    projection = state.get("projection")
    inventory = state.get("inventory")
    ledger = state.get("decision_ledger")
    if not all(isinstance(item, dict) for item in (projection, inventory, ledger)):
        raise ValueError("Continuity saved state is incomplete")
    if _text(inventory.get("project_id")) != project_id:
        raise ValueError("Continuity inventory project mismatch")
    canonical = projection.get("canonical_collection")
    if not isinstance(canonical, dict) or _text(canonical.get("project_id")) != project_id:
        raise ValueError("Continuity projection project mismatch")
    if _text(projection.get("revision")) != _text(state.get("projection_revision")):
        raise ValueError("Continuity projection revision mismatch")
    signed_payload = {
        key: copy.deepcopy(state.get(key))
        for key in (
            "schema",
            "project_id",
            "analysis_ids",
            "inventory",
            "decision_ledger",
            "projection",
            "projection_revision",
        )
    }
    if _checksum(signed_payload) != _text(state.get("content_checksum")):
        raise ValueError("Continuity saved-state checksum mismatch")
    return copy.deepcopy(dict(state))


def write_saved_continuity_state(
    path: str | Path,
    *,
    inventory: Mapping[str, Any],
    decision_ledger: Mapping[str, Any],
    projection: Mapping[str, Any],
    project_id: str,
    analysis_ids: Sequence[str],
) -> Dict[str, Any]:
    """Atomically write and read-verify a continuity snapshot."""
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = build_saved_continuity_state(
        inventory=inventory,
        decision_ledger=decision_ledger,
        projection=projection,
        project_id=project_id,
        analysis_ids=analysis_ids,
    )
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    verified = validate_saved_continuity_state(
        json.loads(temporary.read_text(encoding="utf-8")),
        expected_project_id=project_id,
    )
    temporary.replace(destination)
    return verified


def load_saved_continuity_state(
    path: str | Path, *, expected_project_id: str
) -> Dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Continuity saved state must be an object")
    return validate_saved_continuity_state(payload, expected_project_id=expected_project_id)


def write_continuity_artifacts(
    analysis_dir: str | Path,
    *,
    inventory: Mapping[str, Any],
    decision_ledger: Mapping[str, Any],
    projection: Mapping[str, Any],
    project_id: str,
    analysis_ids: Sequence[str],
) -> Dict[str, Any]:
    """Commit canonical state, then its replaceable UI/export projection."""
    directory = Path(analysis_dir)
    state_path = directory / "narrative_agent_continuity_state.json"
    saved = write_saved_continuity_state(
        state_path,
        inventory=inventory,
        decision_ledger=decision_ledger,
        projection=projection,
        project_id=project_id,
        analysis_ids=analysis_ids,
    )
    projection_path = directory / "narrative_agent_continuity_projection.json"
    projection_tmp = projection_path.with_suffix(".json.tmp")
    projection_tmp.write_text(
        json.dumps(saved["projection"], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    projected = json.loads(projection_tmp.read_text(encoding="utf-8"))
    if _text(projected.get("revision")) != saved["projection_revision"]:
        raise ValueError("Continuity projection readback revision mismatch")
    projection_tmp.replace(projection_path)
    return {
        "state": saved,
        "state_path": str(state_path),
        "projection_path": str(projection_path),
        "save_committed": True,
    }


def selectively_invalidate_projection(
    projection: Mapping[str, Any], *, changed_occurrence_ids: Sequence[str]
) -> Dict[str, Any]:
    """Invalidate only collection or relation projections fed by changed evidence."""
    changed = {_text(item) for item in changed_occurrence_ids if _text(item)}
    result = copy.deepcopy(dict(projection))
    canonical = result.get("canonical_collection")
    if not isinstance(canonical, dict):
        raise ValueError("Continuity projection has no canonical collection")
    members = {_text(item) for item in canonical.get("member_occurrence_ids") or []}
    affected = sorted(changed & members)
    graph = result.get("graph_projection") if isinstance(result.get("graph_projection"), dict) else {}
    affected_tickets = []
    affected_edge_ids = set()
    for ticket in graph.get("relation_tickets") or []:
        if not isinstance(ticket, dict):
            continue
        evidence_ids = {
            _text(ref.get("evidence_id"))
            for ref in ticket.get("evidence_refs") or []
            if isinstance(ref, dict) and _text(ref.get("evidence_id"))
        }
        dependency_hits = sorted(changed & evidence_ids)
        if not dependency_hits:
            continue
        previous_state = _text(ticket.get("state")) or "candidate"
        ticket["state"] = "stale"
        ticket["allowed_decisions"] = []
        ticket["uncertainty"] = "dependency_recompute_required"
        ticket["invalidation"] = {
            "state": "recompute_required",
            "previous_state": previous_state,
            "changed_evidence_ids": dependency_hits,
            "history_preserved": True,
        }
        affected_tickets.append(_text(ticket.get("ticket_id")))
        affected_edge_ids.add(_text(ticket.get("edge_id")))
    for edge in graph.get("edges") or []:
        if not isinstance(edge, dict) or _text(edge.get("edge_id")) not in affected_edge_ids:
            continue
        maturity = edge.get("maturity") if isinstance(edge.get("maturity"), dict) else {}
        edge["invalidation"] = {
            "state": "recompute_required",
            "previous_maturity": copy.deepcopy(maturity),
            "history_preserved": True,
        }
        edge["maturity"] = {"level": "stale", "authority": "dependency_invalidation"}
    if graph and affected_edge_ids:
        graph["invalidation"] = {
            "state": "targeted_recompute_required",
            "affected_edge_ids": sorted(affected_edge_ids),
            "affected_ticket_ids": sorted(affected_tickets),
        }

    snapshot = result.get("constellational_snapshot") if isinstance(result.get("constellational_snapshot"), dict) else {}
    layers = snapshot.get("layers") if isinstance(snapshot.get("layers"), dict) else {}
    for layer in layers.values():
        if not isinstance(layer, dict):
            continue
        invalidated = []
        for candidate in layer.get("candidates") or []:
            if not isinstance(candidate, dict):
                continue
            occurrence_id = _text(candidate.get("audio_occurrence_id"))
            if occurrence_id and occurrence_id in changed:
                candidate["previous_state"] = _text(candidate.get("state")) or "candidate"
                candidate["state"] = "stale"
                candidate["invalidation_reason"] = "source_occurrence_changed"
                invalidated.append(occurrence_id)
        if invalidated:
            layer["state"] = "stale"
            layer["affected_occurrence_ids"] = sorted(set(invalidated))

    result["invalidation"] = {
        "state": "recompute_required" if affected or affected_edge_ids else "current",
        "affected_occurrence_ids": affected,
        "affected_relation_edge_ids": sorted(affected_edge_ids),
        "affected_relation_ticket_ids": sorted(affected_tickets),
        "unrelated_changes_ignored": sorted(changed - members - {
            evidence_id
            for ticket in graph.get("relation_tickets") or []
            if isinstance(ticket, dict)
            for evidence_id in [
                _text(ref.get("evidence_id"))
                for ref in ticket.get("evidence_refs") or []
                if isinstance(ref, dict)
            ]
            if evidence_id
        }),
        "history_preserved": True,
    }
    if not affected and not affected_edge_ids:
        return result
    if affected:
        canonical["continuity_claim"] = "stale"
        canonical["maturity"] = "recompute_required"
        canonical["measurement_eligibility"] = {
            "eligible": False,
            "reason": "source_occurrence_changed",
            "denominator": len(members),
        }
    for view in (result.get("consumer_views") or {}).values():
        if not isinstance(view, dict):
            continue
        if affected:
            view["continuity_claim"] = "stale"
            view["maturity"] = "recompute_required"
            view["affected_occurrence_ids"] = affected
        view["hydration_state"] = "stale_retry" if affected else "targeted_relation_retry"
        view["affected_relation_edge_ids"] = sorted(affected_edge_ids)
    return result
