from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence


SCHEMA = "vaa1.second_order_label_proliferation_plan.v1"

STATUS_THRESHOLDS = {
    "candidate": 0.0,
    "probable": 0.45,
    "strongly_supported": 0.68,
    "analyst_confirmed": 0.9,
}

HIGH_IMPACT_LABELS = {"Identification", "ReportClaim", "ForensicObservation"}

OPEN_SCORE_WEIGHTS = {
    "base_event_confidence": 0.35,
    "evidence_authority": 0.2,
    "cross_modal_support": 0.15,
    "target_label_fit": 0.15,
    "manual_support": 0.15,
}

PRIORITY_WEIGHTS = {
    "delivery_priority": {
        "speed_score": 0.35,
        "interpretive_power_score": 0.4,
        "scale_power_score": 0.25,
    },
    "quick_sweep_priority": {
        "speed_score": 0.5,
        "interpretive_power_score": 0.35,
        "scale_power_score": 0.15,
    },
    "research_priority": {
        "speed_score": 0.2,
        "interpretive_power_score": 0.35,
        "scale_power_score": 0.45,
    },
}

TARGET_LABEL_PROFILES = {
    "Interaction": {"speed": 0.8, "interpretive_power": 0.9, "scale_power": 0.9},
    "Action": {"speed": 0.75, "interpretive_power": 0.8, "scale_power": 0.82},
    "Movement": {"speed": 0.72, "interpretive_power": 0.7, "scale_power": 0.8},
    "Identification": {"speed": 0.55, "interpretive_power": 0.95, "scale_power": 0.95},
    "Role": {"speed": 0.62, "interpretive_power": 0.95, "scale_power": 0.95},
    "Relationship": {"speed": 0.6, "interpretive_power": 0.92, "scale_power": 0.88},
    "Scene": {"speed": 0.62, "interpretive_power": 0.82, "scale_power": 0.9},
    "Episode": {"speed": 0.55, "interpretive_power": 0.86, "scale_power": 0.9},
    "Situation": {"speed": 0.58, "interpretive_power": 0.95, "scale_power": 0.95},
    "Expression": {"speed": 0.65, "interpretive_power": 0.65, "scale_power": 0.6},
    "Intensity": {"speed": 0.72, "interpretive_power": 0.78, "scale_power": 0.78},
    "Object": {"speed": 0.8, "interpretive_power": 0.75, "scale_power": 0.8},
    "ReportClaim": {"speed": 0.45, "interpretive_power": 1.0, "scale_power": 0.95},
    "ForensicObservation": {"speed": 0.25, "interpretive_power": 1.0, "scale_power": 0.65},
}

AUTHORITY_POLICY = {
    "manual_annotation_wins": True,
    "manual_correction_wins": True,
    "proliferated_labels_do_not_mutate_source_evidence": True,
    "open_weights_must_be_preserved": True,
    "analyst_confirmation_is_not_required_for_every_candidate": True,
    "immediate_confirmation_only_at_authority_boundaries": True,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _score(value: Any, fallback: float = 0.0) -> float:
    return min(1.0, max(0.0, round(_safe_float(value, fallback), 4)))


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _evidence_refs(event: Dict[str, Any]) -> List[Dict[str, Any]]:
    refs = event.get("evidence_refs") or []
    return [ref for ref in refs if isinstance(ref, dict)]


def _manual_support_score(event: Dict[str, Any]) -> float:
    refs = _evidence_refs(event)
    has_manual = any(
        str(ref.get("evidence_kind")) in {"manual_annotation", "manual_correction"}
        or str(ref.get("evidence_id", "")).startswith("manual")
        for ref in refs
    )
    return 1.0 if has_manual else 0.0


def _evidence_authority_score(event: Dict[str, Any]) -> float:
    refs = _evidence_refs(event)
    if not refs:
        return 0.2
    max_authority = max(_safe_float(ref.get("authority_level"), 20.0) for ref in refs)
    return _score(max_authority / 40.0, 0.5)


def _cross_modal_score(event: Dict[str, Any]) -> float:
    kinds = {str(ref.get("evidence_kind")) for ref in _evidence_refs(event) if ref.get("evidence_kind")}
    if len(kinds) >= 3:
        return 1.0
    if len(kinds) == 2:
        return 0.75
    if len(kinds) == 1:
        return 0.35
    return 0.0


def _target_label_fit(event: Dict[str, Any], target_label: str) -> float:
    feature_type = event.get("feature_type")
    direct_map = {
        "turn_taking": {"Interaction": 0.9, "Role": 0.65},
        "addressivity": {"Interaction": 0.85, "Identification": 0.55, "Role": 0.7},
        "repair_self_correction": {"Interaction": 0.7, "Expression": 0.65, "Role": 0.55},
        "repetition": {"Action": 0.55, "Interaction": 0.6, "Scene": 0.65},
        "scene_power_balance": {"Interaction": 0.85, "Role": 0.9, "Situation": 0.8},
        "object_significance_escalation": {"Object": 0.9, "Action": 0.65, "Scene": 0.7, "Situation": 0.65},
        "spatial_relationship": {"Interaction": 0.8, "Movement": 0.85, "Action": 0.7},
        "gaze_target_priority": {"Interaction": 0.75, "Identification": 0.55, "Object": 0.7},
        "topic_shift": {"Scene": 0.8, "Episode": 0.85, "Interaction": 0.65},
        "micro_ritual": {"Interaction": 0.85, "Role": 0.75, "Situation": 0.8},
        "affiliation_care": {"Interaction": 0.88, "Role": 0.7, "Affect": 0.82, "Situation": 0.72},
        "intimacy_commitment": {"Interaction": 0.86, "Role": 0.68, "Relationship": 0.9, "Situation": 0.76},
        "judgment_denigration": {
            "Interaction": 0.88,
            "Role": 0.78,
            "Situation": 0.8,
            "Affect": 0.8,
            "Intensity": 0.75,
            "ReportClaim": 0.58,
        },
        "plot_function": {
            "Scene": 0.88,
            "Episode": 0.88,
            "Situation": 0.82,
            "Action": 0.68,
            "Interaction": 0.62,
            "Role": 0.58,
            "ReportClaim": 0.62,
        },
    }
    return direct_map.get(str(feature_type), {}).get(target_label, 0.35)


def _open_support_score(event: Dict[str, Any], target_label: str) -> Dict[str, float]:
    event_confidence = _score((event.get("confidence") or {}).get("score"), 0.4)
    components = {
        "base_event_confidence": event_confidence,
        "evidence_authority": _evidence_authority_score(event),
        "cross_modal_support": _cross_modal_score(event),
        "target_label_fit": _target_label_fit(event, target_label),
        "manual_support": _manual_support_score(event),
    }
    weighted = sum(components[key] * OPEN_SCORE_WEIGHTS[key] for key in OPEN_SCORE_WEIGHTS)
    components["weighted_support_score"] = _score(weighted)
    return components


def _graduated_status(score: float, manual_support: float) -> str:
    if manual_support >= 1.0 and score >= STATUS_THRESHOLDS["analyst_confirmed"]:
        return "analyst_confirmed"
    if score >= STATUS_THRESHOLDS["strongly_supported"]:
        return "strongly_supported"
    if score >= STATUS_THRESHOLDS["probable"]:
        return "probable"
    return "candidate"


def _priority_scores(target_label: str) -> Dict[str, float]:
    profile = TARGET_LABEL_PROFILES.get(
        target_label,
        {"speed": 0.5, "interpretive_power": 0.5, "scale_power": 0.5},
    )
    speed = profile["speed"]
    interpretive = profile["interpretive_power"]
    scale = profile["scale_power"]
    scores = {
        "speed_score": speed,
        "interpretive_power_score": interpretive,
        "scale_power_score": scale,
    }
    for key, weights in PRIORITY_WEIGHTS.items():
        scores[key] = _score(
            speed * weights["speed_score"]
            + interpretive * weights["interpretive_power_score"]
            + scale * weights["scale_power_score"]
        )
    return scores


def _requires_immediate_confirmation(target_label: str, status: str, event: Dict[str, Any]) -> bool:
    if status in {"candidate", "probable"}:
        return False
    if target_label in HIGH_IMPACT_LABELS:
        return True
    tags = set(event.get("interpretive_tags") or [])
    return bool(tags & {"threat", "dramatic_turning_point"}) and target_label in {"Situation", "Role"}


def _ui_surfaces(target_label: str) -> List[str]:
    surfaces = {
        "Identification": ["bbox_roi_overlay", "identification_panel", "master_schema", "printout"],
        "Interaction": ["bbox_roi_overlay", "objects_panel", "meaning_panel", "printout"],
        "Action": ["bbox_roi_overlay", "objects_panel", "meaning_panel", "printout"],
        "Movement": ["bbox_roi_overlay", "objects_panel", "meaning_panel"],
        "Role": ["identification_panel", "master_schema", "meaning_panel", "printout"],
        "Scene": ["scene_panel", "meaning_panel", "printout"],
        "Episode": ["scene_panel", "meaning_panel", "printout"],
        "Situation": ["meaning_panel", "master_schema", "printout"],
        "Expression": ["expressions_panel", "meaning_panel", "printout"],
        "Object": ["bbox_roi_overlay", "objects_panel", "meaning_panel"],
        "ReportClaim": ["report_builder", "printout"],
        "ForensicObservation": ["forensic_panel", "traceback_panel", "printout"],
    }
    return surfaces.get(target_label, ["meaning_panel"])


def _candidate_targets(event: Dict[str, Any]) -> List[str]:
    support = event.get("proliferation_support") or {}
    targets = support.get("candidate_target_labels") or []
    return [str(target) for target in targets if target]


def build_label_instruction(
    analysis_id: str,
    event: Dict[str, Any],
    target_label: str,
) -> Dict[str, Any]:
    open_scores = _open_support_score(event, target_label)
    support_score = open_scores["weighted_support_score"]
    status = _graduated_status(support_score, open_scores["manual_support"])
    priorities = _priority_scores(target_label)
    immediate_confirmation = _requires_immediate_confirmation(target_label, status, event)
    source_event_id = _safe_text(event.get("event_id"))
    instruction_id = f"{analysis_id}:label:{source_event_id}:{target_label}".replace(" ", "_")

    return {
        "instruction_id": instruction_id,
        "source_event_id": source_event_id,
        "target_label_family": target_label,
        "candidate_label": _candidate_label_for_event(event, target_label),
        "status": status,
        "may_surface_in_ui": True,
        "may_proliferate": status in {"probable", "strongly_supported", "analyst_confirmed"},
        "may_auto_confirm": status == "analyst_confirmed",
        "requires_immediate_confirmation": immediate_confirmation,
        "manual_override_available": True,
        "confirmation_policy": {
            "analyst_confirmation_is_welcome": True,
            "analyst_confirmation_is_not_required_for_every_candidate": True,
            "interrupt_analyst": immediate_confirmation,
            "surface_as": "badge" if not immediate_confirmation else "review_prompt",
        },
        "ui_surfaces": _ui_surfaces(target_label),
        "time_span": event.get("time_span") or {},
        "participants_involved": event.get("participants_involved") or [],
        "objects_involved": event.get("objects_involved") or [],
        "source_feature_type": event.get("feature_type"),
        "source_feature_payload": event.get("feature_payload") or {},
        "source_evidence_refs": _evidence_refs(event),
        "traceback": event.get("traceback") or {},
        "open_scores": {**open_scores, **priorities},
        "open_score_weights": OPEN_SCORE_WEIGHTS,
        "must_preserve": ["time_interval", "geometry", "source_evidence_refs", "traceback"],
        "forbidden_updates": [
            "source_detection_time",
            "source_detection_geometry",
            "manual_annotation_without_analyst_action",
        ],
    }


def _candidate_label_for_event(event: Dict[str, Any], target_label: str) -> str:
    payload = event.get("feature_payload") or {}
    feature_type = str(event.get("feature_type") or "")
    if feature_type == "turn_taking":
        return _safe_text(payload.get("kind"), "turn_taking_candidate")
    if feature_type == "addressivity":
        return _safe_text(payload.get("addressivity_type"), "addressivity_candidate")
    if feature_type == "scene_power_balance":
        return "power_balance_candidate" if target_label != "Role" else "dominant_role_candidate"
    if feature_type == "topic_shift":
        return _safe_text(payload.get("shift_type"), "topic_shift_candidate")
    if feature_type == "micro_ritual":
        return _safe_text(payload.get("ritual_type"), "micro_ritual_candidate")
    if feature_type == "object_significance_escalation":
        return _safe_text(payload.get("significance_stage"), "object_significance_candidate")
    if feature_type == "spatial_relationship":
        return _safe_text(payload.get("relation_type"), "spatial_relationship_candidate")
    if feature_type == "gaze_target_priority":
        return _safe_text(payload.get("gaze_shift_type"), "gaze_target_candidate")
    if feature_type == "repair_self_correction":
        return _safe_text(payload.get("repair_type"), "repair_candidate")
    if feature_type == "repetition":
        return _safe_text(payload.get("repetition_type"), "repetition_candidate")
    if feature_type == "affiliation_care":
        return _safe_text(payload.get("care_signal_type"), "affiliation_care_candidate")
    if feature_type == "intimacy_commitment":
        return _safe_text(payload.get("intimacy_signal_type"), "intimacy_commitment_candidate")
    if feature_type == "judgment_denigration":
        return _safe_text(payload.get("judgment_signal_type"), "judgment_denigration_candidate")
    if feature_type == "plot_function":
        return _safe_text(payload.get("plot_function"), "plot_function_candidate")
    return f"{target_label.lower()}_candidate"


def build_second_order_label_proliferation_plan(
    analysis_id: str,
    meaning_artifact: Dict[str, Any],
    *,
    target_label_families: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    requested_targets = {str(label) for label in target_label_families or [] if label}
    instructions: List[Dict[str, Any]] = []
    for event in meaning_artifact.get("feature_events") or []:
        if not isinstance(event, dict):
            continue
        targets = _candidate_targets(event)
        if requested_targets:
            targets = [target for target in targets if target in requested_targets]
        for target in targets:
            instructions.append(build_label_instruction(analysis_id, event, target))

    status_counts: Dict[str, int] = {}
    for instruction in instructions:
        status_counts[instruction["status"]] = status_counts.get(instruction["status"], 0) + 1

    return {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "source_meaning_artifact_schema": meaning_artifact.get("schema"),
        "source_media_id": meaning_artifact.get("source_media_id"),
        "authority_policy": AUTHORITY_POLICY,
        "open_score_weights": OPEN_SCORE_WEIGHTS,
        "priority_weights": PRIORITY_WEIGHTS,
        "graduated_status_thresholds": STATUS_THRESHOLDS,
        "instructions": instructions,
        "summary": {
            "instruction_count": len(instructions),
            "status_counts": status_counts,
            "immediate_confirmation_count": sum(
                1 for instruction in instructions if instruction["requires_immediate_confirmation"]
            ),
            "ui_surface_count": sum(
                1 for instruction in instructions if instruction["may_surface_in_ui"]
            ),
        },
        "governance": {
            "analyst_confirmation_is_not_required_for_every_candidate": True,
            "manual_correction_overrides_proliferated_labels": True,
            "open_weights_are_part_of_the_record": True,
            "external_llm_review_allowed": True,
            "external_llm_may_auto_confirm": False,
        },
        "provenance": {
            "created_at": _now_iso(),
            "traceback_required": True,
        },
    }


def write_second_order_label_proliferation_plan(
    analysis_id: str,
    meaning_artifact: Dict[str, Any],
    output_path: str | Path,
    *,
    target_label_families: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    plan = build_second_order_label_proliferation_plan(
        analysis_id,
        meaning_artifact,
        target_label_families=target_label_families,
    )
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    return plan
