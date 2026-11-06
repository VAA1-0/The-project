import pytest

from src.backend.analysis.evaluation_independence import (
    assess_evaluation_independence,
    load_release_evaluation_register,
)


def payload():
    return {
        "claim_id": "object-accuracy-1",
        "claim_type": "accuracy",
        "system_revision": "git:abc123",
        "evaluator_id": "independent-reviewer",
        "implementation_actors": ["runtime-team"],
        "predeclared_metrics": ["precision", "recall"],
        "evaluated_at": "2026-11-06T12:00:00Z",
        "cohorts": [
            {"cohort_id": "development", "role": "development", "source_ids": ["a", "b"]},
            {"cohort_id": "holdout", "role": "independent_holdout", "source_ids": ["c", "d"], "frozen_at": "2026-11-05T12:00:00Z"},
        ],
    }


def test_non_overlapping_frozen_holdout_and_independent_evaluator_pass():
    result = assess_evaluation_independence(payload())
    assert result["independent"] is True
    assert result["claim_disposition"] == "independently_evaluated"


def test_development_overlap_withholds_accuracy_claim():
    value = payload()
    value["cohorts"][1]["source_ids"] = ["b", "d"]
    result = assess_evaluation_independence(value)
    assert result["independent"] is False
    assert result["overlapping_source_ids"] == ["b"]
    assert "independent_holdout_overlaps_development_or_calibration" in result["blocking_reasons"]


def test_implementer_cannot_self_certify_independent_performance():
    value = payload()
    value["evaluator_id"] = "runtime-team"
    result = assess_evaluation_independence(value)
    assert "evaluator_is_implementation_actor" in result["blocking_reasons"]


def test_internal_functional_test_stays_useful_without_becoming_accuracy_evidence():
    value = payload()
    value["claim_type"] = "functional_acceptance"
    value["cohorts"] = [value["cohorts"][0]]
    value["evaluator_id"] = "runtime-team"
    result = assess_evaluation_independence(value)
    assert result["claim_disposition"] == "internal_functional_evidence_only"
    assert result["independent"] is False


def test_holdout_must_be_frozen_before_evaluation_and_metrics_predeclared():
    value = payload()
    value["predeclared_metrics"] = []
    value["cohorts"][1]["frozen_at"] = "2026-11-07T12:00:00Z"
    result = assess_evaluation_independence(value)
    assert "metrics_not_predeclared" in result["blocking_reasons"]
    assert any(reason.startswith("holdout_frozen_after_evaluation") for reason in result["blocking_reasons"])


def test_declared_cohort_fingerprint_must_match_membership():
    value = payload()
    value["cohorts"][1]["source_set_fingerprint"] = "sha256:wrong"
    with pytest.raises(ValueError, match="does not match"):
        assess_evaluation_independence(value)


def test_release_register_does_not_present_internal_tests_as_independent_performance():
    register = load_release_evaluation_register()
    for row in register["evidence_dispositions"]:
        if row["claim_type"] in {"accuracy", "generalization", "comparative_performance", "population_benchmark"}:
            assert row["disposition"] != "internal_functional_evidence_only"
