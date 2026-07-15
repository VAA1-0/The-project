"""Atomic adapters from VAA1 compatibility corrections to canonical events."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Iterable, List, Tuple

try:
    from .decision_ledger import append_decision, append_invalidation
except ImportError:  # Direct contract-test loading.
    from decision_ledger import append_decision, append_invalidation


DROP_VALUE = "__DROP__"
ANALYST_AUTHORITIES = {
    "explicit_user_correction",
    "manual_correction",
    "manual_confirmation",
    "manual_rejection",
    "manual_review",
    "explicit_user_confirmation",
}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _digest(prefix: str, payload: Dict[str, Any]) -> str:
    content = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return f"{prefix}:{hashlib.sha256(content.encode('utf-8')).hexdigest()[:20]}"


def _content_decision_id(prefix: str, payload: Dict[str, Any]) -> str:
    stable = {
        key: value for key, value in payload.items()
        if key not in {"decision_id", "created_at", "created_by"}
    }
    return _digest(prefix, stable)


def _scope(start: Any, end: Any = None, geometry: Any = None) -> Dict[str, Any]:
    start_value = _number(start)
    end_value = _number(end)
    result: Dict[str, Any] = {}
    if start_value is not None:
        result["start_seconds"] = max(0.0, start_value)
        result["end_seconds"] = max(result["start_seconds"], end_value if end_value is not None else start_value)
    if isinstance(geometry, dict):
        result["geometry"] = geometry
    return result


def _evidence_ids(items: Iterable[Any]) -> List[str]:
    result: List[str] = []
    for item in items:
        value = item.get("evidence_id") if isinstance(item, dict) else item
        normalized = _text(value)
        if normalized and normalized not in result:
            result.append(normalized)
    return result


def _compatibility_authority(value: Any, *, action: str) -> str:
    """Translate descriptive legacy authority labels into canonical write authority."""
    normalized = _text(value)
    if normalized in ANALYST_AUTHORITIES:
        return normalized
    if normalized.startswith("manual_") or normalized.startswith("analyst_"):
        if action == "reject_candidate":
            return "manual_rejection"
        if action in {"review_candidate", "defer_candidate"}:
            return "manual_review"
        return "explicit_user_confirmation"
    return "explicit_user_correction"


def _manual_visual_payload(item: Dict[str, Any], *, created_at: str, created_by: str) -> Dict[str, Any] | None:
    metadata = item.get("metadata_correlation") if isinstance(item.get("metadata_correlation"), dict) else {}
    subject_id = _text(metadata.get("target_id") or item.get("id"))
    value = _text(
        item.get("identity_affirmation")
        or item.get("role_affirmation")
        or item.get("custom_label")
        or item.get("label")
    )
    if not subject_id or not value:
        return None
    correction_ref = _text(item.get("id"))
    payload = {
        "decision_action": "correct_assignment",
        "subject_ref": {"type": "visual_track_or_observation", "id": subject_id},
        "property": "narrative_agent.assignment" if item.get("identity_affirmation") else "semantic.assignment.label",
        "scope": _scope(
            item.get("start_seconds", item.get("timestamp_seconds")),
            item.get("end_seconds", item.get("timestamp_seconds")),
            {"coordinate_system": metadata.get("coordinate_system") or "normalized_video", "box": item.get("coordinates")}
            if isinstance(item.get("coordinates"), dict) else None,
        ),
        "value": value,
        "authority": _compatibility_authority(
            metadata.get("authority_state"), action="correct_assignment"
        ),
        "maturity": metadata.get("maturity_state") or "analyst_confirmed",
        "evidence_refs": [subject_id],
        "correction_refs": [correction_ref] if correction_ref else [],
        "provenance": {"source_surface": "annotation_corrections.manual_visual_annotations"},
        "created_at": item.get("updated_at") or created_at,
        "created_by": item.get("updated_by") or created_by,
    }
    payload["decision_id"] = _content_decision_id("manual-visual", payload)
    return payload


def _label_override_payload(item: Dict[str, Any], *, created_at: str, created_by: str) -> Dict[str, Any] | None:
    correction_ref = _text(item.get("id"))
    raw_value = _text(item.get("raw_value"))
    corrected_value = _text(item.get("corrected_value"))
    if not correction_ref or not corrected_value:
        return None
    modality = _text(item.get("modality") or "object")
    subject_id = _text(item.get("target_track_id") or correction_ref)
    action = "drop_assignment" if corrected_value == DROP_VALUE else "correct_assignment"
    payload = {
        "decision_action": action,
        "subject_ref": {"type": f"{modality}_observation", "id": subject_id},
        "property": "governance.visibility" if action == "drop_assignment" else "semantic.assignment.label",
        "scope": _scope(
            item.get("target_start_timestamp", item.get("target_timestamp")),
            item.get("target_end_timestamp", item.get("target_timestamp")),
        ),
        "value": "suppressed" if action == "drop_assignment" else corrected_value,
        "authority": "explicit_user_correction",
        "maturity": "analyst_confirmed",
        "evidence_refs": [raw_value] if raw_value else [],
        "correction_refs": [correction_ref],
        "provenance": {
            "source_surface": "annotation_corrections.label_overrides",
            "modality": modality,
            "raw_value": raw_value,
        },
        "created_at": item.get("updated_at") or created_at,
        "created_by": item.get("updated_by") or created_by,
    }
    payload["decision_id"] = _content_decision_id("label-override", payload)
    return payload


def _proliferation_payload(item: Dict[str, Any], *, created_at: str, created_by: str) -> Dict[str, Any] | None:
    candidate_id = _text(item.get("candidate_id"))
    legacy_id = _text(item.get("decision_id"))
    decision = _text(item.get("decision")).lower()
    if not candidate_id or not decision:
        return None
    action = {
        "confirmed": "confirm_candidate",
        "canceled": "reject_candidate",
        "rejected": "reject_candidate",
        "deferred": "defer_candidate",
        "inspected": "review_candidate",
    }.get(decision, "review_candidate")
    anchors = item.get("source_anchors") if isinstance(item.get("source_anchors"), list) else []
    anchor = anchors[0] if anchors and isinstance(anchors[0], dict) else {}
    governance = item.get("governance_status") if isinstance(item.get("governance_status"), dict) else {}
    source_panel = _text(item.get("source_panel"))
    property_name = (
        "meaning_network.relationship"
        if "edge" in legacy_id or governance.get("edge_id")
        else "narrative_agent.assignment"
        if governance.get("matcher_anchor_kind") in {"narrative_agent", "identity"}
        or governance.get("confirmed_presence_facets")
        else "semantic.assignment.label"
    )
    payload = {
        "decision_action": action,
        "subject_ref": {"type": "candidate_claim", "id": candidate_id},
        "property": property_name,
        "scope": _scope(anchor.get("start_seconds"), anchor.get("end_seconds"), anchor.get("geometry")),
        "value": _text(item.get("applied_label") or item.get("candidate_label") or decision),
        "authority": _compatibility_authority(
            item.get("authority_level"), action=action
        ),
        "maturity": _text(governance.get("maturity_result") or "analyst_reviewed"),
        "evidence_refs": _evidence_ids(item.get("evidence_refs") or []),
        "correction_refs": [legacy_id] if legacy_id else [],
        "provenance": {
            "source_surface": "annotation_corrections.proliferation_decisions",
            "source_panel": source_panel,
            "request_id": item.get("request_id"),
            "projection_targets": item.get("projection_targets") or item.get("proliferates_to") or [],
        },
        "created_at": item.get("created_at") or created_at,
        "created_by": item.get("created_by") or created_by,
    }
    payload["decision_id"] = _content_decision_id("candidate-review", payload)
    return payload


COLLECTION_ADAPTERS = {
    "manual_visual_annotations": _manual_visual_payload,
    "label_overrides": _label_override_payload,
    "proliferation_decisions": _proliferation_payload,
}


def sync_corrections_to_ledger(
    ledger: Dict[str, Any],
    previous: Dict[str, Any],
    current: Dict[str, Any],
    *,
    analysis_id: str,
    created_at: str,
    created_by: str,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Atomically mirror governed compatibility writes as canonical events."""
    result = ledger
    appended_events: List[Dict[str, Any]] = []
    existing_decision_ids = {
        _text(item.get("decision_id"))
        for item in result.get("decisions", [])
        if isinstance(item, dict)
    }
    for collection, adapter in COLLECTION_ADAPTERS.items():
        prior_items = [item for item in previous.get(collection, []) if isinstance(item, dict)]
        current_items = [item for item in current.get(collection, []) if isinstance(item, dict)]
        prior_ids = {_text(item.get("id") or item.get("decision_id")) for item in prior_items}
        current_ids = {_text(item.get("id") or item.get("decision_id")) for item in current_items}
        for item in current_items:
            payload = adapter(item, created_at=created_at, created_by=created_by)
            if payload is None:
                continue
            if payload["decision_id"] in existing_decision_ids:
                continue
            result, event, appended = append_decision(result, payload, analysis_id=analysis_id)
            if appended:
                appended_events.append(event)
                existing_decision_ids.add(event["decision_id"])
        for removed_ref in sorted((prior_ids - current_ids) - {""}):
            try:
                result, event, appended = append_invalidation(
                    result,
                    {
                        "decision_id": _digest(
                            "compatibility-removal",
                            {"collection": collection, "correction_ref": removed_ref, "created_at": created_at},
                        ),
                        "correction_ref": removed_ref,
                        "reason_code": "source_record_removed",
                        "reason": f"The linked {collection} record was removed.",
                        "dependency_ref": f"annotation_corrections.{collection}",
                        "created_at": created_at,
                        "created_by": created_by,
                    },
                    analysis_id=analysis_id,
                )
            except ValueError:
                continue
            if appended:
                appended_events.append(event)
    return result, appended_events
