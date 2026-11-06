import json
from pathlib import Path

from src.backend.analysis.representative_workload_qualification import (
    assess_workload_receipt,
    build_workload_qualification,
    load_workload_register,
)


ROOT = Path(__file__).resolve().parents[1]
REGISTER = ROOT / "config" / "release_workload_qualification.json"


def receipt(scenario_id: str, metrics: dict) -> dict:
    return {
        "schema": "vaa1.workload_evidence_receipt.v1",
        "scenario_id": scenario_id,
        "conducted_at": "2026-11-06T12:00:00Z",
        "system_revision": "frozen-revision",
        "dataset_edition": "holdout-edition-1",
        "executor_role": "independent_release_tester",
        "environment": {"os": "fixture", "ram_gb": 8},
        "project_boundary": {
            "project_ids": ["project-a", "project-b"],
            "analysis_project_bindings": {"analysis-a": "project-a", "analysis-b": "project-b"},
            "unbound_analysis_count": 0,
            "foreign_project_access_count": 0,
            "boundary_violation_count": 0,
            "verified": True
        },
        "metrics": metrics,
        "evidence_artifacts": ["screen-recording", "machine-observation"],
    }


def test_current_repository_is_blocked_without_fabricated_workload_receipts(tmp_path: Path):
    result = build_workload_qualification(REGISTER, tmp_path / "absent")
    assert result["qualification"] == "blocked"
    assert len(result["release_blockers"]) == 8
    assert all(item["status"] == "pending" for item in result["scenario_results"])


def test_exact_scenario_thresholds_qualify_and_missing_metric_fails():
    scenario = next(item for item in load_workload_register(REGISTER)["scenarios"] if item["id"] == "many_short_clips")
    passing = assess_workload_receipt(scenario, receipt("many_short_clips", {
        "source_count": 50,
        "completed_fraction": 0.98,
        "cross_project_contamination_count": 0,
        "unrecoverable_data_loss_count": 0,
    }))
    assert passing["status"] == "qualified"
    failing = assess_workload_receipt(scenario, receipt("many_short_clips", {"source_count": 50}))
    assert failing["status"] == "failed"
    assert any(item["reason"] == "metric_missing" for item in failing["checks"])


def test_persisted_receipt_is_assessed_not_trusted(tmp_path: Path):
    evidence = tmp_path / "evidence"
    evidence.mkdir()
    payload = receipt("long_source", {
        "source_duration_seconds": 7200,
        "pipeline_completed": True,
        "save_reopen_verified": False,
        "unrecoverable_data_loss_count": 0,
    })
    (evidence / "long-source.json").write_text(json.dumps(payload), encoding="utf-8")
    result = build_workload_qualification(REGISTER, evidence)
    long_source = next(item for item in result["scenario_results"] if item["scenario_id"] == "long_source")
    assert long_source["status"] == "failed"
    assert next(item for item in long_source["checks"] if item["metric"] == "save_reopen_verified")["passed"] is False


def test_project_boundary_failure_blocks_otherwise_passing_workload():
    scenario = next(item for item in load_workload_register(REGISTER)["scenarios"] if item["id"] == "many_short_clips")
    payload = receipt("many_short_clips", {
        "source_count": 50,
        "completed_fraction": 1,
        "cross_project_contamination_count": 0,
        "unrecoverable_data_loss_count": 0,
    })
    payload["project_boundary"]["foreign_project_access_count"] = 1
    result = assess_workload_receipt(scenario, payload)
    assert result["status"] == "failed"
    assert result["checks"][0]["metric"] == "project_boundary_integrity"
    assert result["checks"][0]["passed"] is False
