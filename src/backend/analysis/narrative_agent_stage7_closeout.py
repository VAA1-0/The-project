"""Closeout gate for the bounded Stage 7 speaker-attribution construct."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Mapping


SCHEMA = "vaa1.stage7_construct_closeout.v1"
MANUAL_GATES = (
    "rendered_graph_parity",
    "originating_panel_source_return",
    "cross_consumer_hydration_without_reconfirmation",
    "save_reopen_and_detached_panel_parity",
    "isolated_export_restore",
)


def _text(value: Any) -> str:
    return str(value or "").strip()


def _checksum(payload: Mapping[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_stage7_closeout_record(
    projection: Mapping[str, Any],
    export_package: Mapping[str, Any],
    *,
    automated_verification: Mapping[str, Any],
    manual_acceptance: Mapping[str, Any] | None = None,
) -> Dict[str, Any]:
    """Reconcile automated delivery and analyst-observed acceptance honestly."""
    canonical = projection.get("canonical_collection") if isinstance(projection.get("canonical_collection"), dict) else {}
    revision = _text(projection.get("revision"))
    if not revision or revision != _text(export_package.get("canonical_revision")):
        raise ValueError("Stage 7 closeout requires one current canonical revision")
    if not (export_package.get("eligibility") or {}).get("eligible"):
        raise ValueError("Stage 7 closeout requires an eligible governed export")
    invalidation = projection.get("invalidation") if isinstance(projection.get("invalidation"), dict) else {}
    if invalidation and _text(invalidation.get("state")) not in {"", "current"}:
        raise ValueError("Stage 7 closeout cannot use a stale projection")

    required_automated = (
        "backend_contracts_passed",
        "frontend_contracts_passed",
        "typecheck_passed",
        "compile_passed",
        "diff_check_passed",
    )
    automated_gates = {
        gate: bool(automated_verification.get(gate)) for gate in required_automated
    }
    automated_complete = all(automated_gates.values())
    receipt = copy.deepcopy(dict(manual_acceptance or {}))
    manual_gates = {
        gate: bool((receipt.get("gates") or {}).get(gate)) for gate in MANUAL_GATES
    }
    manual_receipt_valid = bool(
        _text(receipt.get("accepted_by"))
        and _text(receipt.get("accepted_at"))
        and receipt.get("evidence_refs")
        and all(manual_gates.values())
    )
    operational = automated_complete and manual_receipt_valid
    core = {
        "schema": SCHEMA,
        "project_id": _text(canonical.get("project_id")),
        "collection_id": _text(canonical.get("collection_id")),
        "canonical_revision": revision,
        "construct": "speaker_attribution",
        "construct_status": "operational" if operational else "manual_acceptance_required" if automated_complete else "automated_verification_incomplete",
        "stage7_status": "partial",
        "automated_verification": {
            "gates": automated_gates,
            "complete": automated_complete,
            "evidence": copy.deepcopy(automated_verification.get("evidence") or {}),
        },
        "manual_acceptance": {
            "gates": manual_gates,
            "complete": manual_receipt_valid,
            "accepted_by": _text(receipt.get("accepted_by")),
            "accepted_at": _text(receipt.get("accepted_at")),
            "evidence_refs": copy.deepcopy(receipt.get("evidence_refs") or []),
            "analyst_effort_minutes": receipt.get("analyst_effort_minutes"),
            "limitations": copy.deepcopy(receipt.get("limitations") or []),
            "optional_deferrals": copy.deepcopy(receipt.get("optional_deferrals") or []),
        },
        "export_receipt": {
            "schema": _text(export_package.get("schema")),
            "content_checksum": _text(export_package.get("content_checksum")),
            "state_distinctions": copy.deepcopy(export_package.get("state_distinctions") or {}),
        },
        "next_construct_selection": {
            "authorized": operational,
            "policy": "select_only_from_constructs_with_satisfied_stage3_to_stage6_dependencies",
            "reason": "bounded_construct_accepted" if operational else "finish_rendered_manual_acceptance_first",
        },
        "non_claims": [
            "This record does not mark all Stage 7 interpretation constructs operational.",
            "Automated contracts do not substitute for rendered analyst acceptance.",
            "Candidate interpretations remain candidates until explicitly confirmed.",
        ],
    }
    return {**core, "content_checksum": _checksum(core), "created_at": datetime.now(timezone.utc).isoformat()}


def write_stage7_closeout_record(
    path: str | Path,
    projection: Mapping[str, Any],
    export_package: Mapping[str, Any],
    *,
    automated_verification: Mapping[str, Any],
    manual_acceptance: Mapping[str, Any] | None = None,
) -> Dict[str, Any]:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    record = build_stage7_closeout_record(
        projection,
        export_package,
        automated_verification=automated_verification,
        manual_acceptance=manual_acceptance,
    )
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(destination)
    return record
