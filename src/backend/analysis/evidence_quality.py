"""Graded evidence fitness without turning quality into a binary visibility gate."""

from __future__ import annotations

from typing import Any, Dict


DIMENSIONS = (
    "clarity",
    "audibility",
    "occlusion_control",
    "temporal_precision",
    "completeness",
    "representativeness",
    "source_independence",
    "corroboration",
    "transcription_quality",
    "assignment_stability",
)

DEFAULT_WEIGHTS = {
    "clarity": 1.0,
    "audibility": 1.0,
    "occlusion_control": 0.8,
    "temporal_precision": 1.2,
    "completeness": 1.1,
    "representativeness": 1.1,
    "source_independence": 0.9,
    "corroboration": 1.1,
    "transcription_quality": 1.0,
    "assignment_stability": 1.0,
}


def _score(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Evidence quality scores must be numeric: {value!r}")
    if not 0.0 <= result <= 1.0:
        raise ValueError("Evidence quality scores must be between 0 and 1")
    return result


def _fitness_band(score: float | None, coverage: float) -> str:
    if score is None or coverage == 0:
        return "unassessed"
    if score >= 0.8 and coverage >= 0.75:
        return "robust"
    if score >= 0.6 and coverage >= 0.5:
        return "qualified"
    if score >= 0.35:
        return "exploratory"
    return "limited"


def assess_evidence_quality(payload: Dict[str, Any]) -> Dict[str, Any]:
    raw_dimensions = payload.get("dimensions") if isinstance(payload.get("dimensions"), dict) else payload
    dimensions = {name: _score(raw_dimensions.get(name)) for name in DIMENSIONS}
    provided = {name: value for name, value in dimensions.items() if value is not None}
    weights = dict(DEFAULT_WEIGHTS)
    for name, value in (payload.get("weights") or {}).items():
        if name in weights:
            numeric = float(value)
            if numeric < 0:
                raise ValueError("Evidence quality weights cannot be negative")
            weights[name] = numeric
    denominator = sum(weights[name] for name in provided)
    overall = (
        sum(value * weights[name] for name, value in provided.items()) / denominator
        if denominator
        else None
    )
    coverage = len(provided) / len(DIMENSIONS)
    band = _fitness_band(overall, coverage)
    limitations = [str(item) for item in payload.get("limitations", []) if item]
    missing = [name for name, value in dimensions.items() if value is None]
    if missing:
        limitations.append("Quality is not assessed for: " + ", ".join(missing) + ".")
    if band == "limited":
        limitations.append("Use as descriptive or exploratory evidence; confirm before inference or promotion.")
    elif band == "exploratory":
        limitations.append("Exploratory use is supported; comparative inference should retain this qualification.")
    return {
        "schema": "vaa1.evidence_quality.v1",
        "evidence_ref": str(payload.get("evidence_ref") or ""),
        "dimensions": dimensions,
        "weights": weights,
        "overall_score": round(overall, 6) if overall is not None else None,
        "assessment_coverage": round(coverage, 6),
        "fitness_band": band,
        "limitations": list(dict.fromkeys(limitations)),
        "confidence": payload.get("confidence"),
        "maturity": payload.get("maturity"),
        "authority": payload.get("authority"),
        "separation_note": "Evidence quality is independent from confidence, maturity, and authority.",
    }


def evaluate_quality_use(assessment: Dict[str, Any], use: str) -> Dict[str, Any]:
    use = str(use or "").strip()
    if not use:
        raise ValueError("use is required")
    score = assessment.get("overall_score")
    coverage = float(assessment.get("assessment_coverage") or 0.0)
    dimensions = assessment.get("dimensions") or {}
    band = str(assessment.get("fitness_band") or "unassessed")
    limitations = list(assessment.get("limitations") or [])

    eligible = True
    mode = "full"
    reason_codes: list[str] = []
    if use == "inspect":
        mode = "inspectable"
    elif use == "exploratory_analysis":
        mode = "exploratory"
        if score is None:
            reason_codes.append("quality_unassessed")
            limitations.append("Results remain visible, but quality has not yet been assessed.")
    elif use == "descriptive_measurement":
        mode = "qualified" if band in {"qualified", "robust"} else "exploratory"
        if score is None or score < 0.35:
            mode = "descriptive_only"
            reason_codes.append("limited_evidence_fitness")
    elif use == "comparative_inference":
        eligible = bool(
            score is not None
            and score >= 0.6
            and coverage >= 0.5
            and (dimensions.get("representativeness") or 0) >= 0.5
        )
        mode = "qualified" if eligible else "exploratory_only"
        if not eligible:
            reason_codes.append("comparative_support_incomplete")
    elif use == "proposition_candidate":
        eligible = bool(score is not None and score >= 0.45 and coverage >= 0.4)
        mode = "candidate" if eligible else "observation_only"
        if not eligible:
            reason_codes.append("candidate_support_incomplete")
    elif use in {"mature_projection", "verified_report_claim"}:
        eligible = bool(
            score is not None
            and score >= 0.75
            and coverage >= 0.75
            and (dimensions.get("corroboration") or 0) >= 0.6
            and (dimensions.get("temporal_precision") or 0) >= 0.6
        )
        mode = "promotion_eligible" if eligible else "candidate_only"
        if not eligible:
            reason_codes.append("promotion_support_incomplete")
    else:
        raise ValueError(f"Unknown evidence-quality use: {use}")

    return {
        "schema": "vaa1.evidence_quality_use.v1",
        "use": use,
        "eligible": eligible,
        "mode": mode,
        "reason_codes": reason_codes,
        "limitations": list(dict.fromkeys(limitations)),
        "visibility": "visible",
        "guidance": "Surface the result calmly with its mode and limitations; do not promote beyond eligibility.",
    }
