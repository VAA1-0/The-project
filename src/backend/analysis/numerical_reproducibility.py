"""Bounded numerical reproducibility receipts and repeat-run comparison."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any, Mapping


SCHEMA = "vaa1.numerical_reproducibility_receipt.v1"


def _canonical(value: Any) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    ).encode("utf-8")


def _digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(value if isinstance(value, bytes) else _canonical(value)).hexdigest()


def _file_digest(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest(), path.stat().st_size


def build_reproducibility_receipt(status: Mapping[str, Any]) -> dict[str, Any]:
    source_integrity = status.get("source_integrity")
    source_integrity = source_integrity if isinstance(source_integrity, Mapping) else {}
    parameters = status.get("analysis_profile")
    parameters = parameters if isinstance(parameters, Mapping) else {}
    versions = status.get("provider_versions")
    versions = versions if isinstance(versions, Mapping) else {}
    controls = status.get("reproducibility_controls")
    controls = controls if isinstance(controls, Mapping) else {}
    seeds = controls.get("random_seeds")
    seeds = seeds if isinstance(seeds, Mapping) else {}
    stochastic = sorted(str(item) for item in controls.get("stochastic_components") or [])
    unseeded = sorted(component for component in stochastic if component not in seeds)

    outputs: dict[str, Any] = {}
    unavailable: list[str] = []
    for role, raw_path in sorted((status.get("output_files") or {}).items()):
        if not raw_path:
            unavailable.append(str(role))
            continue
        path = Path(str(raw_path))
        try:
            checksum, size = _file_digest(path)
        except OSError:
            unavailable.append(str(role))
            continue
        outputs[str(role)] = {"sha256": checksum, "size_bytes": size}

    missing_controls: list[str] = []
    if not source_integrity.get("source_fingerprint"):
        missing_controls.append("source_fingerprint")
    if not parameters:
        missing_controls.append("effective_parameters")
    if not versions:
        missing_controls.append("provider_versions")
    if unseeded:
        missing_controls.append("random_seeds")
    if not outputs:
        missing_controls.append("output_checksums")

    execution_signature_content = {
        "source_fingerprint": source_integrity.get("source_fingerprint"),
        "parameters": parameters,
        "provider_versions": versions,
        "model_choices": status.get("model_choices") or {},
        "random_seeds": seeds,
        "determinism_flags": controls.get("determinism_flags") or {},
    }
    output_signature = _digest(outputs)
    state = (
        "controlled_exact_replay_eligible"
        if not missing_controls
        else "uncontrolled_stochastic_components"
        if unseeded
        else "incomplete_reproducibility_evidence"
    )
    return {
        "schema": SCHEMA,
        "analysis_id": status.get("analysis_id"),
        "project_id": status.get("project_id"),
        "state": state,
        "execution_signature": _digest(execution_signature_content),
        "execution_signature_content": execution_signature_content,
        "output_signature": output_signature,
        "outputs": outputs,
        "unavailable_output_roles": unavailable,
        "stochastic_components": stochastic,
        "unseeded_components": unseeded,
        "missing_controls": missing_controls,
        "comparison_policy": {
            "exact": "execution and output signatures must both match",
            "numeric_default_absolute_tolerance": 1e-9,
            "numeric_default_relative_tolerance": 1e-9,
            "semantic_equivalence_not_inferred": True,
        },
    }


def _numeric_differences(
    left: Any,
    right: Any,
    *,
    absolute_tolerance: float,
    relative_tolerance: float,
    path: str = "$",
) -> list[dict[str, Any]]:
    if isinstance(left, bool) or isinstance(right, bool):
        return [] if left == right else [{"path": path, "left": left, "right": right}]
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        if math.isclose(float(left), float(right), abs_tol=absolute_tolerance, rel_tol=relative_tolerance):
            return []
        return [{"path": path, "left": left, "right": right, "absolute_delta": abs(float(left) - float(right))}]
    if isinstance(left, Mapping) and isinstance(right, Mapping):
        differences: list[dict[str, Any]] = []
        for key in sorted(set(left) | set(right)):
            if key not in left or key not in right:
                differences.append({"path": f"{path}.{key}", "left": left.get(key), "right": right.get(key)})
            else:
                differences.extend(_numeric_differences(left[key], right[key], absolute_tolerance=absolute_tolerance, relative_tolerance=relative_tolerance, path=f"{path}.{key}"))
        return differences
    if isinstance(left, list) and isinstance(right, list):
        if len(left) != len(right):
            return [{"path": path, "left_length": len(left), "right_length": len(right)}]
        differences: list[dict[str, Any]] = []
        for index, (a, b) in enumerate(zip(left, right)):
            differences.extend(_numeric_differences(a, b, absolute_tolerance=absolute_tolerance, relative_tolerance=relative_tolerance, path=f"{path}[{index}]"))
        return differences
    return [] if left == right else [{"path": path, "left": left, "right": right}]


def compare_reproducibility_receipts(
    baseline: Mapping[str, Any],
    current: Mapping[str, Any],
    *,
    baseline_metrics: Any = None,
    current_metrics: Any = None,
    absolute_tolerance: float = 1e-9,
    relative_tolerance: float = 1e-9,
) -> dict[str, Any]:
    if baseline.get("schema") != SCHEMA or current.get("schema") != SCHEMA:
        raise ValueError("Both reproducibility receipts must use the current schema")
    same_execution = baseline.get("execution_signature") == current.get("execution_signature")
    same_outputs = baseline.get("output_signature") == current.get("output_signature")
    differences = _numeric_differences(
        baseline_metrics,
        current_metrics,
        absolute_tolerance=absolute_tolerance,
        relative_tolerance=relative_tolerance,
    ) if baseline_metrics is not None or current_metrics is not None else []
    classification = (
        "exact_reproduction"
        if same_execution and same_outputs and not differences
        else "numerically_equivalent_within_tolerance"
        if same_execution and not differences and baseline_metrics is not None
        else "configuration_or_input_changed"
        if not same_execution
        else "output_drift"
    )
    return {
        "schema": "vaa1.numerical_reproducibility_comparison.v1",
        "classification": classification,
        "same_execution_signature": same_execution,
        "same_output_signature": same_outputs,
        "within_numeric_tolerance": not differences,
        "numeric_differences": differences,
        "absolute_tolerance": absolute_tolerance,
        "relative_tolerance": relative_tolerance,
    }
