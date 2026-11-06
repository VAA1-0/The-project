"""Governed separation of development evidence from independent evaluation."""

from __future__ import annotations

from datetime import datetime
import hashlib
import json
from pathlib import Path
from typing import Any, Mapping, Sequence


SCHEMA = "vaa1.evaluation_independence_assessment.v1"
COHORT_ROLES = {
    "development",
    "training",
    "calibration",
    "internal_regression",
    "independent_holdout",
}
INDEPENDENCE_REQUIRED_CLAIMS = {
    "accuracy",
    "generalization",
    "comparative_performance",
    "population_benchmark",
}
DEFAULT_REGISTER_PATH = Path(__file__).resolve().parents[3] / "config" / "release_evaluation_register.json"


def _text(value: Any) -> str:
    return str(value or "").strip()


def _time(value: Any, field: str) -> datetime:
    text = _text(value)
    if not text:
        raise ValueError(f"{field} is required")
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"{field} must include a timezone")
    return parsed


def _cohort(raw: Mapping[str, Any]) -> dict[str, Any]:
    cohort_id = _text(raw.get("cohort_id"))
    role = _text(raw.get("role"))
    source_ids = sorted({_text(item) for item in raw.get("source_ids") or [] if _text(item)})
    if not cohort_id:
        raise ValueError("Every evaluation cohort requires cohort_id")
    if role not in COHORT_ROLES:
        raise ValueError(f"Unsupported evaluation cohort role: {role}")
    if not source_ids:
        raise ValueError(f"Cohort {cohort_id} requires source_ids")
    fingerprint = "sha256:" + hashlib.sha256(
        json.dumps(source_ids, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    declared = _text(raw.get("source_set_fingerprint"))
    if declared and declared != fingerprint:
        raise ValueError(f"Cohort {cohort_id} source_set_fingerprint does not match source_ids")
    return {
        "cohort_id": cohort_id,
        "role": role,
        "source_ids": source_ids,
        "source_set_fingerprint": fingerprint,
        "frozen_at": _text(raw.get("frozen_at")) or None,
    }


def assess_evaluation_independence(payload: Mapping[str, Any]) -> dict[str, Any]:
    claim_type = _text(payload.get("claim_type")) or "functional_acceptance"
    system_revision = _text(payload.get("system_revision"))
    evaluator_id = _text(payload.get("evaluator_id"))
    implementation_actors = sorted(
        {_text(item) for item in payload.get("implementation_actors") or [] if _text(item)}
    )
    metrics = sorted({_text(item) for item in payload.get("predeclared_metrics") or [] if _text(item)})
    cohorts = [_cohort(item) for item in payload.get("cohorts") or [] if isinstance(item, Mapping)]
    if not system_revision:
        raise ValueError("system_revision is required")
    if not evaluator_id:
        raise ValueError("evaluator_id is required")
    if not cohorts:
        raise ValueError("At least one evaluation cohort is required")

    by_role: dict[str, set[str]] = {role: set() for role in COHORT_ROLES}
    for cohort in cohorts:
        by_role[cohort["role"]].update(cohort["source_ids"])
    development_ids = set().union(
        by_role["development"], by_role["training"], by_role["calibration"]
    )
    independent_ids = by_role["independent_holdout"]
    overlap = sorted(development_ids & independent_ids)
    independence_required = claim_type in INDEPENDENCE_REQUIRED_CLAIMS
    reasons: list[str] = []
    if independence_required and not independent_ids:
        reasons.append("independent_holdout_missing")
    if overlap:
        reasons.append("independent_holdout_overlaps_development_or_calibration")
    if independence_required and evaluator_id in implementation_actors:
        reasons.append("evaluator_is_implementation_actor")
    if independence_required and not metrics:
        reasons.append("metrics_not_predeclared")
    evaluated_at = _time(payload.get("evaluated_at"), "evaluated_at")
    for cohort in cohorts:
        if cohort["role"] != "independent_holdout":
            continue
        if not cohort["frozen_at"]:
            reasons.append(f"holdout_not_frozen:{cohort['cohort_id']}")
            continue
        if _time(cohort["frozen_at"], "frozen_at") > evaluated_at:
            reasons.append(f"holdout_frozen_after_evaluation:{cohort['cohort_id']}")

    independent = independence_required and not reasons
    claim_disposition = (
        "independently_evaluated"
        if independent
        else "withheld_independence_not_proven"
        if independence_required
        else "internal_functional_evidence_only"
    )
    return {
        "schema": SCHEMA,
        "claim_id": _text(payload.get("claim_id")),
        "claim_type": claim_type,
        "system_revision": system_revision,
        "evaluator_id": evaluator_id,
        "implementation_actors": implementation_actors,
        "predeclared_metrics": metrics,
        "cohorts": cohorts,
        "independence_required": independence_required,
        "independent": independent,
        "claim_disposition": claim_disposition,
        "blocking_reasons": sorted(set(reasons)),
        "overlapping_source_ids": overlap,
        "governance": {
            "development_evidence_cannot_count_as_independent": True,
            "calibration_evidence_cannot_count_as_holdout": True,
            "withheld_claim_is_not_a_failed_functional_test": True,
        },
    }


def load_release_evaluation_register(
    path: Path = DEFAULT_REGISTER_PATH,
) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("schema") != "vaa1.release_evaluation_register.v1":
        raise ValueError("Unsupported release evaluation register schema")
    rows = payload.get("evidence_dispositions")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Release evaluation register requires dispositions")
    allowed = {"internal_functional_evidence_only", "independently_evaluated", "withheld_independence_not_proven"}
    for row in rows:
        if not isinstance(row, Mapping) or row.get("disposition") not in allowed:
            raise ValueError("Invalid release evidence disposition")
        if row.get("disposition") == "independently_evaluated" and not row.get("evidence"):
            raise ValueError("Independent disposition requires evidence")
        if row.get("claim_type") in INDEPENDENCE_REQUIRED_CLAIMS and row.get("disposition") == "internal_functional_evidence_only":
            raise ValueError("Performance claims cannot use internal functional evidence")
    return payload


def evaluation_policy() -> dict[str, Any]:
    return {
        "schema": "vaa1.evaluation_independence_policy.v1",
        "cohort_roles": sorted(COHORT_ROLES),
        "independence_required_claim_types": sorted(INDEPENDENCE_REQUIRED_CLAIMS),
        "release_rule": (
            "Internal tests may qualify functional behavior; accuracy, generalization, comparative "
            "performance and population benchmark claims require a frozen non-overlapping holdout "
            "and an evaluator outside the implementation actor set."
        ),
        "current_release_evidence": load_release_evaluation_register(),
    }
