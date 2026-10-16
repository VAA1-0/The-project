"""Canonical cross-consumer projection for governed Narrative Agent continuity."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Dict, Mapping, Sequence

from .narrative_agent_continuity_decisions import project_continuity_decisions


SCHEMA = "vaa1.narrative_agent_continuity_projection_envelope.v1"
CONSUMERS = (
    "video",
    "audio",
    "transcript",
    "narrative_agent",
    "meaning_plot",
    "master_schema",
    "data_maturation",
    "search",
    "traceback",
    "measurements",
)


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


def _blocking_diagnostics(inventory: Mapping[str, Any], selected_key: str) -> list[Dict[str, Any]]:
    diagnostics = inventory.get("diagnostics") if isinstance(inventory.get("diagnostics"), dict) else {}
    blocked: list[Dict[str, Any]] = []
    for risk in _list(diagnostics.get("false_join_risks")):
        if isinstance(risk, dict) and selected_key in _list(risk.get("narrative_agent_keys")):
            blocked.append({"kind": "false_join_risk", **copy.deepcopy(risk)})
    for risk in _list(diagnostics.get("incomplete_source_anchors")):
        blocked.append({"kind": "incomplete_source_anchor", "occurrence_id": risk})
    return blocked


def build_continuity_projection_envelope(
    inventory: Mapping[str, Any],
    ledger: Mapping[str, Any],
    *,
    project_id: str,
    collection_id: str,
) -> Dict[str, Any]:
    """Project one accepted collection identically to every named consumer."""
    if _text(inventory.get("project_id")) != project_id:
        raise ValueError("Continuity projection project boundary mismatch")
    projection = project_continuity_decisions(
        ledger, project_id=project_id, collection_id=collection_id
    )
    occurrences = _all_occurrences(inventory)
    member_ids = projection["included_occurrence_ids"]
    missing_ids = [occurrence_id for occurrence_id in member_ids if occurrence_id not in occurrences]
    if missing_ids:
        raise ValueError("Continuity projection references occurrences absent from the inventory")
    members = [occurrences[occurrence_id] for occurrence_id in member_ids]
    selected = inventory.get("selected_agent") if isinstance(inventory.get("selected_agent"), dict) else {}
    selected_key = _text(selected.get("narrative_agent_key"))
    if any(_text(member.get("narrative_agent_key")) != selected_key for member in members):
        raise ValueError("Continuity member belongs to another Narrative Agent")
    blocking = _blocking_diagnostics(inventory, selected_key)
    confirmation = projection.get("collection_confirmation")
    resolved = []
    if confirmation and members and all(
        _text(member.get("authority")) == "explicit_analyst_confirmation"
        for member in members
    ):
        resolved = [item for item in blocking if item.get("kind") == "false_join_risk"]
        blocking = [item for item in blocking if item.get("kind") != "false_join_risk"]
    accepted = bool(confirmation) and bool(members) and not blocking
    maturity = "mature_governed_agent_track" if accepted else "membership_review"
    authority = "explicit_analyst_confirmation" if accepted else "candidate_collection"
    traceback_refs = sorted(
        {
            ref
            for member in members
            for ref in [
                _text(member.get("occurrence_id")),
                *[_text(item) for item in _list(member.get("traceback_refs"))],
            ]
            if ref
        }
        | set(projection["active_decision_ids"])
    )
    canonical = {
        "collection_id": collection_id,
        "project_id": project_id,
        "narrative_agent_key": selected_key,
        "narrative_agent_label": _text(selected.get("narrative_agent_label")),
        "member_occurrence_ids": member_ids,
        "members": members,
        "excluded_occurrence_ids": projection["excluded_occurrence_ids"],
        "deferred_occurrence_ids": projection["deferred_occurrence_ids"],
        "authority": authority,
        "maturity": maturity,
        "continuity_claim": "accepted" if accepted else "not_accepted",
        "blocking_diagnostics": blocking,
        "resolved_diagnostics": resolved,
        "traceback_refs": traceback_refs,
    }
    revision_input = {
        "inventory_fingerprint": _text(inventory.get("inventory_fingerprint")),
        "collection": canonical,
        "decision_ids": projection["active_decision_ids"],
    }
    revision = hashlib.sha256(
        json.dumps(revision_input, sort_keys=True).encode("utf-8")
    ).hexdigest()
    canonical["revision"] = revision
    canonical["measurement_eligibility"] = {
        "eligible": accepted,
        "reason": "accepted_governed_continuity" if accepted else "continuity_not_mature",
        "denominator": len(members),
    }
    consumer_views = {
        consumer: {
            "consumer": consumer,
            "schema": "vaa1.narrative_agent_continuity_consumer_view.v1",
            "project_id": project_id,
            "collection_id": collection_id,
            "revision": revision,
            "authority": authority,
            "maturity": maturity,
            "continuity_claim": canonical["continuity_claim"],
            "member_occurrence_ids": list(member_ids),
            "source_navigation": [
                {
                    "occurrence_id": member["occurrence_id"],
                    "analysis_id": member["analysis_id"],
                    "source_interval": copy.deepcopy(member.get("source_interval")),
                    "source_geometry": copy.deepcopy(member.get("source_geometry")),
                    "evidence_modality": _text(member.get("evidence_modality") or "visual"),
                }
                for member in members
            ],
            "traceback_refs": list(traceback_refs),
            "blocking_diagnostics": copy.deepcopy(blocking),
            "resolved_diagnostics": copy.deepcopy(resolved),
        }
        for consumer in CONSUMERS
    }
    return {
        "schema": SCHEMA,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "revision": revision,
        "canonical_collection": canonical,
        "consumer_views": consumer_views,
        "projection_policy": {
            "one_canonical_revision_for_all_consumers": True,
            "rejected_and_deferred_occurrences_are_not_mature_members": True,
            "raw_tracking_cannot_establish_membership": True,
            "missing_consumer_must_report_stale_or_retry": True,
        },
    }


def build_multi_agent_projection_matrix(
    corridors: Sequence[Mapping[str, Any]], *, project_id: str
) -> Dict[str, Any]:
    """Assemble verified agent envelopes without cross-agent membership bleed."""
    envelopes: Dict[str, Dict[str, Any]] = {}
    member_owner: Dict[str, str] = {}
    conflicts: list[Dict[str, str]] = []
    for corridor in corridors:
        inventory = corridor.get("inventory")
        ledger = corridor.get("decision_ledger")
        collection_id = _text(corridor.get("collection_id"))
        if not isinstance(inventory, dict) or not isinstance(ledger, dict) or not collection_id:
            raise ValueError("Every continuity corridor requires inventory, decision ledger, and collection_id")
        envelope = build_continuity_projection_envelope(
            inventory,
            ledger,
            project_id=project_id,
            collection_id=collection_id,
        )
        agent_key = _text(envelope["canonical_collection"].get("narrative_agent_key"))
        if not agent_key:
            raise ValueError("Every continuity corridor requires a Narrative Agent key")
        if agent_key in envelopes:
            raise ValueError("Duplicate Narrative Agent corridor")
        for occurrence_id in envelope["canonical_collection"]["member_occurrence_ids"]:
            prior = member_owner.get(occurrence_id)
            if prior and prior != agent_key:
                conflicts.append(
                    {
                        "occurrence_id": occurrence_id,
                        "first_agent_key": prior,
                        "second_agent_key": agent_key,
                    }
                )
            else:
                member_owner[occurrence_id] = agent_key
        envelopes[agent_key] = envelope
    if conflicts:
        raise ValueError("One occurrence cannot be a mature member of multiple Narrative Agent corridors")
    matrix_fingerprint = hashlib.sha256(
        json.dumps(
            {
                "project_id": project_id,
                "revisions": {
                    key: envelope["revision"] for key, envelope in sorted(envelopes.items())
                },
            },
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()
    return {
        "schema": "vaa1.narrative_agent_continuity_projection_matrix.v1",
        "project_id": project_id,
        "matrix_revision": matrix_fingerprint,
        "agent_corridors": envelopes,
        "summary": {
            "agent_count": len(envelopes),
            "accepted_agent_count": sum(
                envelope["canonical_collection"]["continuity_claim"] == "accepted"
                for envelope in envelopes.values()
            ),
            "unique_member_occurrence_count": len(member_owner),
        },
        "governance": {
            "cross_agent_occurrence_membership_forbidden": True,
            "shared_raw_track_does_not_merge_agents": True,
            "project_boundary_is_hermetic": True,
        },
    }
