"""Calm, enforceable source-use policy evaluation."""

from __future__ import annotations

from typing import Any, Dict


LOCAL_PURPOSES = {"local_analysis", "local_review", "internal_research"}
TRANSFER_PURPOSES = {"external_provider", "cvat_transfer", "report_export", "data_export"}


def normalize_source_policy(metadata: Dict[str, Any] | None) -> Dict[str, Any]:
    source = metadata if isinstance(metadata, dict) else {}
    annotations = source.get("user_annotations") if isinstance(source.get("user_annotations"), dict) else {}
    policy = source.get("source_policy") if isinstance(source.get("source_policy"), dict) else {}
    if not policy and isinstance(annotations.get("source_policy"), dict):
        policy = annotations["source_policy"]
    permitted = policy.get("permitted_purposes")
    restrictions = policy.get("export_restrictions")
    return {
        "lawful_basis": str(policy.get("lawful_basis") or "not_recorded"),
        "sensitivity": str(policy.get("sensitivity") or "not_assessed"),
        "consent_state": str(policy.get("consent_state") or "not_recorded"),
        "retention_policy": str(policy.get("retention_policy") or "not_recorded"),
        "permitted_purposes": sorted({str(item) for item in permitted or [] if item}),
        "export_restrictions": sorted({str(item) for item in restrictions or [] if item}),
        "policy_version": str(policy.get("policy_version") or "vaa1.source_policy.v1"),
    }


def evaluate_source_use(
    metadata: Dict[str, Any] | None,
    purpose: str,
    *,
    provider_id: str | None = None,
) -> Dict[str, Any]:
    policy = normalize_source_policy(metadata)
    purpose = str(purpose or "").strip()
    if not purpose:
        raise ValueError("purpose is required")
    reasons: list[str] = []
    restrictions = set(policy["export_restrictions"])
    permitted = set(policy["permitted_purposes"])
    explicitly_blocked = purpose in restrictions or "all_external_transfer" in restrictions and purpose in TRANSFER_PURPOSES
    if explicitly_blocked:
        reasons.append("purpose_restricted")
    if purpose in TRANSFER_PURPOSES and purpose not in permitted:
        reasons.append("purpose_not_explicitly_permitted")
    if provider_id and f"provider:{provider_id}" in restrictions:
        reasons.append("provider_restricted")
    allowed = not reasons
    review_state = "ready" if allowed else "review_required"
    if purpose in LOCAL_PURPOSES and not explicitly_blocked:
        allowed = True
        review_state = "policy_incomplete" if not permitted else "ready"
        reasons = []
    return {
        "schema": "vaa1.source_policy_decision.v1",
        "purpose": purpose,
        "provider_id": provider_id,
        "allowed": allowed,
        "review_state": review_state,
        "reason_codes": reasons,
        "policy": policy,
    }
