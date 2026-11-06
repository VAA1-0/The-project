"""Fail-closed representative-workload and analyst-usability qualification."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping


REGISTER_SCHEMA = "vaa1.release_workload_qualification.v1"
RECEIPT_SCHEMA = "vaa1.workload_evidence_receipt.v1"
OPERATORS = {
    ">=": lambda actual, expected: actual >= expected,
    "<=": lambda actual, expected: actual <= expected,
    "==": lambda actual, expected: actual == expected,
}


def _exact_zero(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value == 0


def load_workload_register(path: Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("schema") != REGISTER_SCHEMA:
        raise ValueError("Unsupported workload qualification register")
    scenarios = payload.get("scenarios")
    if not isinstance(scenarios, list) or not scenarios:
        raise ValueError("Workload register must contain scenarios")
    identities: set[str] = set()
    for scenario in scenarios:
        scenario_id = str(scenario.get("id") or "")
        if not scenario_id or scenario_id in identities:
            raise ValueError("Workload scenario identities must be unique and non-empty")
        identities.add(scenario_id)
        if not scenario.get("owner") or not isinstance(scenario.get("criteria"), list) or not scenario["criteria"]:
            raise ValueError(f"Workload scenario is incomplete: {scenario_id}")
        for criterion in scenario["criteria"]:
            if criterion.get("operator") not in OPERATORS or not criterion.get("metric") or "threshold" not in criterion:
                raise ValueError(f"Invalid workload criterion: {scenario_id}")
    return payload


def assess_workload_receipt(scenario: Mapping[str, Any], receipt: Mapping[str, Any]) -> dict[str, Any]:
    if receipt.get("schema") != RECEIPT_SCHEMA:
        raise ValueError("Unsupported workload evidence receipt")
    if receipt.get("scenario_id") != scenario.get("id"):
        raise ValueError("Workload receipt belongs to another scenario")
    required_context = ("conducted_at", "system_revision", "dataset_edition", "executor_role", "environment", "project_boundary", "metrics", "evidence_artifacts")
    missing_context = [name for name in required_context if receipt.get(name) in (None, "")]
    if missing_context:
        raise ValueError(f"Workload receipt context is incomplete: {', '.join(missing_context)}")
    metrics = receipt["metrics"]
    if not isinstance(metrics, Mapping):
        raise ValueError("Workload receipt metrics must be an object")
    boundary = receipt["project_boundary"]
    if not isinstance(boundary, Mapping):
        raise ValueError("Workload receipt project_boundary must be an object")
    project_ids = boundary.get("project_ids")
    bindings = boundary.get("analysis_project_bindings")
    boundary_passed = (
        isinstance(project_ids, list)
        and bool(project_ids)
        and all(isinstance(item, str) and bool(item.strip()) for item in project_ids)
        and len(project_ids) == len(set(project_ids))
        and isinstance(bindings, Mapping)
        and bool(bindings)
        and all(isinstance(analysis_id, str) and bool(analysis_id.strip()) and project_id in project_ids for analysis_id, project_id in bindings.items())
        and _exact_zero(boundary.get("unbound_analysis_count"))
        and _exact_zero(boundary.get("foreign_project_access_count"))
        and _exact_zero(boundary.get("boundary_violation_count"))
        and boundary.get("verified") is True
    )
    checks = [{
        "metric": "project_boundary_integrity",
        "operator": "governed",
        "threshold": True,
        "actual": boundary_passed,
        "passed": boundary_passed,
        "reason": "project_boundary_verified" if boundary_passed else "project_boundary_failed",
    }]
    for criterion in scenario["criteria"]:
        metric = criterion["metric"]
        actual = metrics.get(metric)
        if actual is None:
            passed = False
            reason = "metric_missing"
        else:
            try:
                passed = bool(OPERATORS[criterion["operator"]](actual, criterion["threshold"]))
                reason = "threshold_met" if passed else "threshold_not_met"
            except TypeError:
                passed = False
                reason = "metric_type_invalid"
        checks.append({**criterion, "actual": actual, "passed": passed, "reason": reason})
    qualified = all(item["passed"] for item in checks)
    return {
        "scenario_id": scenario["id"],
        "status": "qualified" if qualified else "failed",
        "checks": checks,
        "receipt_context": {name: receipt[name] for name in required_context if name != "metrics"},
    }


def build_workload_qualification(register_path: Path, evidence_dir: Path) -> dict[str, Any]:
    register = load_workload_register(register_path)
    receipts: dict[str, Mapping[str, Any]] = {}
    evidence_dir = Path(evidence_dir)
    if evidence_dir.is_dir():
        for path in sorted(evidence_dir.glob("*.json")):
            payload = json.loads(path.read_text(encoding="utf-8"))
            scenario_id = str(payload.get("scenario_id") or "")
            if scenario_id in receipts:
                raise ValueError(f"Duplicate workload receipt: {scenario_id}")
            receipts[scenario_id] = payload
    results = []
    for scenario in register["scenarios"]:
        receipt = receipts.get(scenario["id"])
        if receipt is None:
            results.append({
                "scenario_id": scenario["id"],
                "label": scenario["label"],
                "status": "pending",
                "current_state": scenario["current_state"],
                "current_evidence": scenario["current_evidence"],
                "criteria": scenario["criteria"],
            })
        else:
            results.append({"label": scenario["label"], **assess_workload_receipt(scenario, receipt)})
    blockers = [item["scenario_id"] for item in results if item["status"] != "qualified"]
    return {
        "schema": "vaa1.release_workload_assessment.v1",
        "product_release": register["product_release"],
        "qualification": "qualified" if not blockers else "blocked",
        "release_blockers": blockers,
        "scenario_results": results,
        "claim_boundary": "Functional fragments do not substitute for a complete representative workload receipt.",
    }
