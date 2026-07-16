"""Governed taxonomy applications using the canonical decision ledger."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict

try:
    from .decision_ledger import append_decision
    from .vocabulary_service import canonical_term_value, resolve_term
except ImportError:  # Direct dependency-free contract-test loading.
    from decision_ledger import append_decision
    from vocabulary_service import canonical_term_value, resolve_term


def _content_id(payload: Dict[str, Any]) -> str:
    stable = {key: value for key, value in payload.items() if key not in {"created_at"}}
    digest = hashlib.sha256(
        json.dumps(stable, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    ).hexdigest()[:24]
    return f"taxonomy-application:{digest}"


def apply_taxonomy_term(
    ledger: Dict[str, Any],
    registry: Dict[str, Any],
    payload: Dict[str, Any],
    *,
    analysis_id: str,
) -> tuple[Dict[str, Any], Dict[str, Any], bool]:
    vocabulary_id = str(payload.get("vocabulary_id") or "").strip()
    term_id = str(payload.get("term_id") or "").strip()
    subject_ref = payload.get("subject_ref")
    scope = payload.get("scope")
    if not vocabulary_id or not term_id:
        raise ValueError("vocabulary_id and term_id are required")
    if not isinstance(subject_ref, dict) or not subject_ref.get("id"):
        raise ValueError("subject_ref.id is required")
    if not isinstance(scope, dict):
        raise ValueError("scope is required")
    term_ref = resolve_term(
        registry,
        vocabulary_id,
        term_id,
        version=payload.get("vocabulary_version"),
        language=str(payload.get("language") or "en"),
    )
    decision_payload = {
        "decision_action": str(payload.get("decision_action") or "correct_assignment"),
        "subject_ref": subject_ref,
        "property": str(payload.get("property") or "taxonomy.application"),
        "scope": scope,
        "value": canonical_term_value(term_ref),
        "authority": str(payload.get("authority") or "explicit_user_confirmation"),
        "maturity": str(payload.get("maturity") or "analyst_confirmed"),
        "validity": str(payload.get("validity") or "current"),
        "evidence_refs": [str(item) for item in payload.get("evidence_refs", []) if item],
        "correction_refs": [str(item) for item in payload.get("correction_refs", []) if item],
        "created_by": str(payload.get("created_by") or "analyst"),
        "provenance": {
            "writer_class": "analyst_interaction",
            "source_surface": str(payload.get("source_surface") or "taxonomy_application_service"),
            "term_ref": term_ref,
        },
    }
    if payload.get("created_at"):
        decision_payload["created_at"] = payload["created_at"]
    decision_payload["decision_id"] = str(payload.get("decision_id") or _content_id(decision_payload))
    existing = next(
        (
            item
            for item in ledger.get("decisions", [])
            if isinstance(item, dict) and item.get("decision_id") == decision_payload["decision_id"]
        ),
        None,
    )
    if existing is not None:
        return ledger, dict(existing), False
    return append_decision(ledger, decision_payload, analysis_id=analysis_id)
