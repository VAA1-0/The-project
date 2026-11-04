"""Shared evidence, reuse, and escalation contract for Datascene classifiers.

The router does not classify media itself.  It gives local and hosted providers
one deterministic contract for deciding whether a previous result is compatible,
whether a proposal may be accepted as a candidate, and when the case must
abstain or be escalated.  Canonical analyst decisions remain outside this
candidate-result registry and always supersede machine proposals.
"""
from __future__ import annotations

from hashlib import sha256
import json
import math
from typing import Any, Dict, Iterable, Mapping, Optional


EVIDENCE_SLICE_SCHEMA = "vaa1.contextual_evidence_slice.v1"
CLASSIFICATION_RESULT_SCHEMA = "vaa1.contextual_classification_result.v1"
ROUTING_DECISION_SCHEMA = "vaa1.contextual_classification_route.v1"

ROUTE_STATES = {
    "reused",
    "locally_classified",
    "accepted_candidate",
    "escalated",
    "analyst_review",
    "abstained",
}


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _digest(value: Any) -> str:
    return sha256(_canonical(value)).hexdigest()


def _nonempty(value: Any, field: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field} must be a nonempty string")
    return text


def _finite(value: Any, field: str) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{field} must be a finite number")
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be a finite number") from exc
    if not math.isfinite(number):
        raise ValueError(f"{field} must be a finite number")
    return number


def _sorted_strings(values: Iterable[Any]) -> list[str]:
    return sorted({str(value).strip() for value in values if str(value).strip()})


def normalize_evidence_slice(payload: Mapping[str, Any]) -> Dict[str, Any]:
    """Validate and normalize one source-bound analytical question."""
    if not isinstance(payload, Mapping):
        raise ValueError("Evidence slice must be an object")
    analysis_id = _nonempty(payload.get("analysis_id"), "analysis_id")
    source_fingerprint = _nonempty(payload.get("source_fingerprint"), "source_fingerprint")
    clock_revision = _nonempty(payload.get("clock_revision"), "clock_revision")
    task = _nonempty(payload.get("task"), "task")
    scope = payload.get("scope")
    if not isinstance(scope, Mapping):
        raise ValueError("scope must be an object")
    start = _finite(scope.get("start_seconds"), "scope.start_seconds")
    end = _finite(scope.get("end_seconds"), "scope.end_seconds")
    if start < 0 or end < start:
        raise ValueError("Evidence scope requires nonnegative, ordered bounds")

    dependencies = payload.get("dependencies") or {}
    if not isinstance(dependencies, Mapping):
        raise ValueError("dependencies must be an object")
    models = payload.get("models") or {}
    if not isinstance(models, Mapping):
        raise ValueError("models must be an object")
    label_definitions = payload.get("label_definitions") or {}
    if not isinstance(label_definitions, Mapping):
        raise ValueError("label_definitions must be an object")

    normalized = {
        "schema": EVIDENCE_SLICE_SCHEMA,
        "analysis_id": analysis_id,
        "source_fingerprint": source_fingerprint,
        "clock_revision": clock_revision,
        "task": task,
        "scope": {
            "clock_id": str(scope.get("clock_id") or "source_media.clock"),
            "start_seconds": round(start, 6),
            "end_seconds": round(end, 6),
            **({"spatial_region": scope["spatial_region"]} if scope.get("spatial_region") is not None else {}),
            **({"text_span": scope["text_span"]} if scope.get("text_span") is not None else {}),
        },
        "evidence_refs": _sorted_strings(payload.get("evidence_refs") or []),
        "dependencies": dict(sorted((str(key), value) for key, value in dependencies.items())),
        "models": dict(sorted((str(key), value) for key, value in models.items())),
        "label_definitions": dict(sorted((str(key), value) for key, value in label_definitions.items())),
        "correction_generation": _nonempty(payload.get("correction_generation"), "correction_generation"),
    }
    normalized["compatibility_key"] = compatibility_key(normalized)
    return normalized


def compatibility_key(evidence_slice: Mapping[str, Any]) -> str:
    """Return the exact analytical reuse key; omit display-only metadata."""
    material = {
        "schema": EVIDENCE_SLICE_SCHEMA,
        "analysis_id": evidence_slice.get("analysis_id"),
        "source_fingerprint": evidence_slice.get("source_fingerprint"),
        "clock_revision": evidence_slice.get("clock_revision"),
        "task": evidence_slice.get("task"),
        "scope": evidence_slice.get("scope"),
        "evidence_refs": evidence_slice.get("evidence_refs") or [],
        "dependencies": evidence_slice.get("dependencies") or {},
        "models": evidence_slice.get("models") or {},
        "label_definitions": evidence_slice.get("label_definitions") or {},
        "correction_generation": evidence_slice.get("correction_generation"),
    }
    return f"contextual-result:{_digest(material)}"


def make_result(
    evidence_slice: Mapping[str, Any],
    *,
    provider: str,
    proposal: Mapping[str, Any],
    status: str = "candidate",
) -> Dict[str, Any]:
    normalized = normalize_evidence_slice(evidence_slice)
    if status not in {"candidate", "abstained", "review_required"}:
        raise ValueError("Machine results may only be candidate, abstained, or review_required")
    result = {
        "schema": CLASSIFICATION_RESULT_SCHEMA,
        "result_id": f"classification:{_digest([normalized['compatibility_key'], provider, proposal])[:24]}",
        "compatibility_key": normalized["compatibility_key"],
        "evidence_slice": normalized,
        "provider": _nonempty(provider, "provider"),
        "proposal": dict(proposal),
        "status": status,
        "authority": "candidate_service",
        "canonical_write": False,
        "manual_correction_wins": True,
        "validity": "current",
    }
    return result


class CompatibleResultRegistry:
    """Small deterministic registry suitable for persistence behind an API."""

    def __init__(self, results: Optional[Iterable[Mapping[str, Any]]] = None):
        self._results: Dict[str, Dict[str, Any]] = {}
        for result in results or []:
            self.put(result)

    def put(self, result: Mapping[str, Any]) -> Dict[str, Any]:
        if result.get("schema") != CLASSIFICATION_RESULT_SCHEMA:
            raise ValueError("Unsupported classification result schema")
        key = _nonempty(result.get("compatibility_key"), "compatibility_key")
        current = self._results.get(key)
        candidate = dict(result)
        if current is not None and _canonical(current) != _canonical(candidate):
            raise ValueError("A compatibility key cannot identify different results")
        self._results[key] = candidate
        return dict(candidate)

    def compatible(self, evidence_slice: Mapping[str, Any]) -> Optional[Dict[str, Any]]:
        key = normalize_evidence_slice(evidence_slice)["compatibility_key"]
        result = self._results.get(key)
        if not result or result.get("validity") != "current":
            return None
        return dict(result)

    def invalidate_dependencies(self, changed_refs: Iterable[str]) -> list[str]:
        changed = set(_sorted_strings(changed_refs))
        invalidated: list[str] = []
        for key, result in list(self._results.items()):
            evidence_slice = result.get("evidence_slice") or {}
            dependencies = evidence_slice.get("dependencies") or {}
            declared = set(_sorted_strings([*dependencies.keys(), *dependencies.values()]))
            if changed & declared:
                self._results[key] = {**result, "validity": "invalid", "invalidation_refs": sorted(changed & declared)}
                invalidated.append(str(result.get("result_id") or key))
        return sorted(invalidated)


def route_classification(
    evidence_slice: Mapping[str, Any],
    *,
    registry: CompatibleResultRegistry,
    local_available: bool,
    local_reliability: Optional[float] = None,
    acceptance_threshold: float = 0.8,
    conflicting_evidence: bool = False,
    unfamiliar_category: bool = False,
    researcher_prioritized: bool = False,
) -> Dict[str, Any]:
    """Choose reuse, local work, escalation, review, or abstention."""
    normalized = normalize_evidence_slice(evidence_slice)
    reused = registry.compatible(normalized)
    if reused is not None:
        state, reason = "reused", "exact_compatibility_key_match"
    elif researcher_prioritized:
        state, reason = "analyst_review", "researcher_priority"
    elif conflicting_evidence:
        state, reason = "analyst_review", "conflicting_evidence"
    elif unfamiliar_category:
        state, reason = "abstained", "unfamiliar_category"
    elif not local_available:
        state, reason = "escalated", "no_validated_local_provider"
    elif local_reliability is None:
        state, reason = "locally_classified", "local_measurement_required"
    elif local_reliability >= acceptance_threshold:
        state, reason = "accepted_candidate", "validated_local_threshold_met"
    else:
        state, reason = "escalated", "local_reliability_below_threshold"
    if state not in ROUTE_STATES:
        raise AssertionError("Invalid route state")
    return {
        "schema": ROUTING_DECISION_SCHEMA,
        "route_state": state,
        "reason": reason,
        "compatibility_key": normalized["compatibility_key"],
        "reused_result_id": reused.get("result_id") if reused else None,
        "canonical_write": False,
        "manual_correction_wins": True,
    }
