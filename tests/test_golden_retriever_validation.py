from copy import deepcopy
from pathlib import Path

from jsonschema import Draft202012Validator

from src.backend.analysis.golden_retriever_validation import (
    load_schema,
    validate_package,
)


def _package():
    return {
        "schema_version": "1.0.0",
        "package_id": "package:test",
        "created_at": "2026-09-29T12:00:00Z",
        "study": {
            "study_id": "study:test",
            "title": "Test acquisition",
            "purpose": "Contract validation",
            "acquisition_lanes": ["research_analysis"],
            "target_modalities": ["text"],
            "processing_profile": "reference",
            "budget": {"max_requests": 1},
            "created_at": "2026-09-29T12:00:00Z",
        },
        "connectors": [],
        "sources": [],
        "economics": {
            "budget": {"max_requests": 1},
            "cost_records": [],
            "utility_assessments": [],
            "budget_state": "available",
        },
        "governance": {
            "private_deployment": True,
            "secret_storage_external_to_manifest": True,
            "manual_correction_wins": True,
            "default_acquisition_lane": "research_analysis",
            "permitted_acquisition_lanes": ["research_analysis"],
            "export_requires_policy_validation": True,
        },
    }


def test_vendored_schema_is_valid_draft_2020_12():
    Draft202012Validator.check_schema(load_schema())


def test_api_exposes_non_mutating_package_validation_boundary():
    source = Path("api_server.py").read_text(encoding="utf-8")

    assert '@app.post("/api/acquisition/packages/validate"' in source
    assert "return validate_acquisition_package(payload)" in source


def test_minimal_package_passes_structural_and_semantic_validation():
    result = validate_package(_package())

    assert result["valid"] is True
    assert result["issues"] == []


def test_semantic_validation_rejects_unresolved_and_cyclic_lineage():
    package = _package()
    package["connectors"] = [{
        "connector_id": "connector:local",
        "name": "Local",
        "connector_class": "local_filesystem",
        "implementation_version": "1.0.0",
        "source_root_id": "root:test",
        "capabilities": ["list"],
        "modalities": ["text"],
        "authentication_mode": "none",
        "allowed_operations": ["read"],
        "health_state": "healthy",
    }]
    package["sources"] = [
        {
            "source_id": "source:one",
            "connector_id": "connector:local",
            "source_type": "document",
            "location": {"kind": "local_file", "root_id": "root:test", "relative_path": "one.txt"},
            "first_observed_at": "2026-09-29T12:00:00Z",
            "rights_status": "user_licensed_local",
            "access_classification": "customer_local",
            "supersedes_source_id": "source:two",
        },
        {
            "source_id": "source:two",
            "connector_id": "connector:missing",
            "source_type": "document",
            "location": {"kind": "local_file", "root_id": "root:test", "relative_path": "two.txt"},
            "first_observed_at": "2026-09-29T12:00:00Z",
            "rights_status": "user_licensed_local",
            "access_classification": "customer_local",
            "supersedes_source_id": "source:one",
        },
    ]

    result = validate_package(package)
    codes = {issue["code"] for issue in result["issues"]}

    assert result["structural_valid"] is True
    assert result["semantic_valid"] is False
    assert {"unresolved_reference", "lineage_cycle"} <= codes


def test_admission_rights_grounding_lane_and_budget_are_enforced():
    package = deepcopy(_package())
    package["analytical_objects"] = [{
        "analytical_object_id": "object:test",
        "object_type": "topic",
        "label": "Candidate",
        "maturity_state": "candidate_interpretation",
        "grounding_state": "ungrounded",
    }]
    package["corpus_admissions"] = [{
        "corpus_admission_id": "admission:test",
        "candidate_reference": {"record_type": "analytical_object", "record_id": "object:test"},
        "decision": "accepted",
        "target_collections": ["general"],
        "eligible_tasks": ["classification"],
        "permitted_outputs": ["redistributable_asset", "training_example"],
        "rights_status": "unknown",
        "maturity_state": "candidate_interpretation",
        "decided_at": "2026-09-29T12:00:00Z",
    }]
    package["economics"]["cost_records"] = [{
        "cost_record_id": "cost:test",
        "scope_type": "study",
        "scope_id": "study:test",
        "cost_state": "realized",
        "request_count": 2,
    }]

    result = validate_package(package)
    codes = {issue["code"] for issue in result["issues"]}

    assert result["structural_valid"] is True
    assert {
        "admission_rights_incompatible",
        "admission_lane_incompatible",
        "admission_not_grounded",
        "budget_exceeded",
    } <= codes
