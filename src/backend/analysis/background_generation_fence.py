"""Admission decisions for replaceable background projections."""

from __future__ import annotations

from typing import Any, Mapping


def correction_generation(payload: Mapping[str, Any] | None) -> str:
    return str((payload or {}).get("correction_generation") or "uncorrected:initial")


def projection_admission(
    *, expected_generation: str, canonical_corrections: Mapping[str, Any] | None
) -> dict[str, Any]:
    current = correction_generation(canonical_corrections)
    admitted = bool(expected_generation) and expected_generation == current
    return {
        "schema": "vaa1.background_projection_admission.v1",
        "admitted": admitted,
        "expected_generation": expected_generation,
        "current_generation": current,
        "reason": "current_generation" if admitted else "superseded_generation",
        "write_effect": "projection_allowed" if admitted else "none_stale_job_discarded",
    }
