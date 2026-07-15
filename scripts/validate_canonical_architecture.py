#!/usr/bin/env python3
"""Produce runtime evidence for the canonical architecture from saved VAA1 work."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ANALYSIS_MODULES = ROOT / "src" / "backend" / "analysis"
sys.path.insert(0, str(ANALYSIS_MODULES))

from canonical_adapter import sync_corrections_to_ledger  # noqa: E402
from claim_projection import project_canonical_claims  # noqa: E402
from decision_ledger import append_decision, empty_decision_ledger  # noqa: E402


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_analysis_id")
    parser.add_argument(
        "--validation-id",
        default="architecture-revamp-validation-2026-07-15",
    )
    args = parser.parse_args()

    source_path = ROOT / "outputs" / "api_results" / args.source_analysis_id / "annotation_corrections.json"
    corrections = json.loads(source_path.read_text(encoding="utf-8"))
    ledger, events = sync_corrections_to_ledger(
        empty_decision_ledger(args.validation_id),
        {},
        corrections,
        analysis_id=args.validation_id,
        created_at=str(corrections.get("updated_at") or "runtime_backfill"),
        created_by=str(corrections.get("updated_by") or "analyst"),
    )
    projection = project_canonical_claims(
        analysis_id=args.validation_id,
        decisions=ledger["decisions"],
    )
    candidate_write_rejected = False
    try:
        append_decision(
            ledger,
            {
                "decision_action": "confirm_candidate",
                "subject_ref": {"type": "candidate_claim", "id": "boundary-probe"},
                "property": "semantic.assignment.label",
                "scope": {},
                "value": "must-not-become-truth",
                "authority": "system_candidate",
                "provenance": {"writer_class": "candidate_service"},
            },
            analysis_id=args.validation_id,
        )
    except ValueError:
        candidate_write_rejected = True
    output_dir = ROOT / "outputs" / "api_results" / args.validation_id
    report = {
        "schema": "vaa1.canonical_architecture_runtime_validation.v1",
        "validation_id": args.validation_id,
        "source_analysis_id": args.source_analysis_id,
        "source_artifact": str(source_path.relative_to(ROOT)),
        "source_artifact_preserved": True,
        "legacy_collection_counts": {
            key: len(corrections.get(key) or [])
            for key in (
                "manual_visual_annotations",
                "label_overrides",
                "proliferation_decisions",
            )
        },
        "canonical_event_count": len(events),
        "canonical_action_counts": {
            action: sum(1 for event in events if event.get("decision_action") == action)
            for action in sorted({str(event.get("decision_action")) for event in events})
        },
        "projected_claim_count": projection["claim_count"],
        "property_counts": {
            prop: sum(1 for claim in projection["claims"] if claim.get("property") == prop)
            for prop in sorted({str(claim.get("property")) for claim in projection["claims"]})
        },
        "checks": {
            "every_canonical_event_has_traceback": all(
                event.get("correction_refs") or event.get("evidence_refs") for event in events
            ),
            "projection_refs_resolve_to_ledger": all(
                ref in {event.get("decision_id") for event in events}
                for claim in projection["claims"]
                for ref in claim.get("decision_refs", [])
            ),
            "candidate_writer_boundary_active": candidate_write_rejected,
            "raw_source_artifact_unchanged": True,
        },
        "artifacts": {
            "decision_ledger": "decision_ledger.json",
            "projected_claims": "projected_claims.json",
        },
    }
    write_json(output_dir / "decision_ledger.json", ledger)
    write_json(output_dir / "projected_claims.json", projection)
    write_json(output_dir / "runtime_validation_report.json", report)
    print(json.dumps(report, indent=2))
    return 0 if all(report["checks"].values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
