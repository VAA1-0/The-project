from pathlib import Path

from src.backend.analysis.numerical_reproducibility import (
    build_reproducibility_receipt,
    compare_reproducibility_receipts,
)


def status(tmp_path: Path):
    output = tmp_path / "measurement.json"
    output.write_text('{"value":1}', encoding="utf-8")
    return {
        "analysis_id": "a-1",
        "project_id": "p-1",
        "source_integrity": {"source_fingerprint": "sha256:source"},
        "analysis_profile": {"tier": "science", "threshold": 0.5},
        "provider_versions": {"python": "3.11", "detector": "1.0"},
        "model_choices": {"objects": "detector-a"},
        "reproducibility_controls": {
            "stochastic_components": ["objects"],
            "random_seeds": {"objects": 17},
            "determinism_flags": {"objects": True},
        },
        "output_files": {"measurement": str(output)},
    }


def test_same_controlled_run_has_stable_signatures(tmp_path: Path):
    first = build_reproducibility_receipt(status(tmp_path))
    second = build_reproducibility_receipt(status(tmp_path))
    assert first["state"] == "controlled_exact_replay_eligible"
    assert first["execution_signature"] == second["execution_signature"]
    assert first["output_signature"] == second["output_signature"]
    assert compare_reproducibility_receipts(first, second)["classification"] == "exact_reproduction"


def test_unseeded_stochastic_component_is_never_called_reproducible(tmp_path: Path):
    value = status(tmp_path)
    value["reproducibility_controls"]["random_seeds"] = {}
    receipt = build_reproducibility_receipt(value)
    assert receipt["state"] == "uncontrolled_stochastic_components"
    assert receipt["unseeded_components"] == ["objects"]


def test_parameter_change_is_classified_separately_from_output_drift(tmp_path: Path):
    first_status = status(tmp_path)
    first = build_reproducibility_receipt(first_status)
    second_status = status(tmp_path)
    second_status["analysis_profile"]["threshold"] = 0.7
    second = build_reproducibility_receipt(second_status)
    comparison = compare_reproducibility_receipts(first, second)
    assert comparison["classification"] == "configuration_or_input_changed"


def test_numeric_tolerance_is_explicit(tmp_path: Path):
    first = build_reproducibility_receipt(status(tmp_path))
    second_status = status(tmp_path)
    output = tmp_path / "measurement.json"
    output.write_text('{"value":1.0000000001}', encoding="utf-8")
    second = build_reproducibility_receipt(second_status)
    comparison = compare_reproducibility_receipts(
        first,
        second,
        baseline_metrics={"value": 1.0},
        current_metrics={"value": 1.0000000001},
        absolute_tolerance=1e-8,
    )
    assert comparison["classification"] == "numerically_equivalent_within_tolerance"
    assert comparison["same_output_signature"] is False
