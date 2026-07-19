#!/usr/bin/env python3
"""Safe B2 persistence and local invalidation probe using an isolated temp bundle."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ANALYSIS_MODULES = ROOT / "src" / "backend" / "analysis"
sys.path.insert(0, str(ANALYSIS_MODULES))

from decision_ledger import append_dependency_invalidation, empty_decision_ledger
from evidence_quality import assess_evidence_quality, evaluate_quality_use
from execution_graph_planner import load_execution_graph, plan_affected_branches
from source_clock_authority import clock_affected_decision_refs
from source_policy_service import evaluate_source_use
from taxonomy_application_service import apply_taxonomy_term
from vocabulary_service import load_vocabulary_registry


def atomic_write(path: Path, payload: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    analysis_id = "b2-isolated-validation"
    registry = load_vocabulary_registry()
    with tempfile.TemporaryDirectory(prefix="vaa1-b2-") as directory:
        bundle = Path(directory)
        ledger_path = bundle / "decision_ledger.json"
        metadata_path = bundle / "source_media_metadata.json"

        ledger, application, appended = apply_taxonomy_term(
            empty_decision_ledger(analysis_id),
            registry,
            {
                "vocabulary_id": "vaa1.validity",
                "term_id": "current",
                "subject_ref": {"type": "validation_interval", "id": "interval:1"},
                "scope": {"start_seconds": 4.0, "end_seconds": 8.0},
                "evidence_refs": ["validation:source:1"],
                "created_by": "b2-validator",
            },
            analysis_id=analysis_id,
        )
        atomic_write(ledger_path, ledger)
        reopened_ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        reopened_ledger, repeated_application, repeated = apply_taxonomy_term(
            reopened_ledger,
            registry,
            {
                "vocabulary_id": "vaa1.validity",
                "term_id": "current",
                "subject_ref": {"type": "validation_interval", "id": "interval:1"},
                "scope": {"start_seconds": 4.0, "end_seconds": 8.0},
                "evidence_refs": ["validation:source:1"],
                "created_by": "b2-validator",
            },
            analysis_id=analysis_id,
        )

        metadata = {
            "analysis_id": analysis_id,
            "user_annotations": {
                "source_policy": {
                    "policy_version": "vaa1.source_policy.v1",
                    "lawful_basis": "research_use",
                    "permitted_purposes": ["local_analysis"],
                    "export_restrictions": ["report_export"],
                }
            },
        }
        atomic_write(metadata_path, metadata)
        reopened_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        local_policy = evaluate_source_use(reopened_metadata, "local_analysis")
        export_policy = evaluate_source_use(reopened_metadata, "report_export")

        targets = clock_affected_decision_refs(
            reopened_ledger,
            {
                "start_seconds": 5.0,
                "end_seconds": 6.0,
                "timing_status": "explicit_user_correction",
            },
        )
        invalidated_ledger, invalidation, invalidation_appended = append_dependency_invalidation(
            reopened_ledger,
            {
                "dependency_ref": "source_media.clock",
                "target_decision_refs": targets,
                "validity_effect": "stale",
                "reason_code": "source_clock_changed",
            },
            analysis_id=analysis_id,
        )
        atomic_write(ledger_path, invalidated_ledger)
        final_ledger = json.loads(ledger_path.read_text(encoding="utf-8"))

        quality = assess_evidence_quality(
            {
                "evidence_ref": "validation:source:1",
                "dimensions": {
                    "clarity": 0.55,
                    "temporal_precision": 0.7,
                    "completeness": 0.45,
                    "representativeness": 0.4,
                    "corroboration": 0.3,
                },
            }
        )
        descriptive = evaluate_quality_use(quality, "descriptive_measurement")
        promotion = evaluate_quality_use(quality, "mature_projection")
        branch_plan = plan_affected_branches(
            load_execution_graph(), ["source_clock_authority"]
        )

        checks = {
            "taxonomy_initial_append": appended,
            "taxonomy_idempotent_after_reopen": not repeated,
            "taxonomy_identity_preserved": application["decision_id"] == repeated_application["decision_id"],
            "local_policy_allowed": local_policy["allowed"],
            "restricted_export_blocked": not export_policy["allowed"],
            "clock_targets_local": targets == [application["decision_id"]],
            "clock_invalidation_appended": invalidation_appended,
            "clock_invalidation_survives_reopen": invalidation["decision_id"] in {item["decision_id"] for item in final_ledger["decisions"]},
            "descriptive_result_available": descriptive["eligible"] and descriptive["visibility"] == "visible",
            "promotion_remains_guarded": not promotion["eligible"] and promotion["visibility"] == "visible",
            "branch_plan_reaches_measurement": "measurement_run_service" in {item["node_id"] for item in branch_plan["affected_nodes"]},
            "branch_plan_keeps_policy_unaffected": "source_policy_gate" in branch_plan["unaffected_nodes"],
        }
        result = {
            "status": "pass" if all(checks.values()) else "fail",
            "analysis_id": analysis_id,
            "temporary_bundle_removed_on_exit": True,
            "checks": checks,
        }
        print(json.dumps(result, indent=2))
        return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
