from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


SCHEMA = "vaa1.narrative_lens_reading.v1"

AUTHORITY_POLICY = {
    "manual_correction_wins": True,
    "manual_annotation_wins": True,
    "parser_outputs_are_candidates": True,
    "interpretive_lens_outputs_are_candidates": True,
    "readings_do_not_mutate_source_evidence": True,
    "derived_readings_do_not_override_manual_interpretation": True,
}

LENS_PROFILES = {
    "aristotelian": {
        "label": "Aristotelian",
        "question": "What action, recognition, reversal, or causal movement is suggested?",
        "cue_terms": ["action", "scene", "situation", "recognition", "reversal", "cause"],
    },
    "freytagian": {
        "label": "Freytagian",
        "question": "Where does this scene appear to sit in dramatic escalation or release?",
        "cue_terms": ["exposition", "rising", "climax", "falling", "resolution", "tension"],
    },
    "campbellian": {
        "label": "Campbellian",
        "question": "Does the evidence suggest threshold, trial, ordeal, aid, or return?",
        "cue_terms": ["threshold", "trial", "ordeal", "mentor", "return", "quest"],
    },
    "fryean": {
        "label": "Fryean",
        "question": "Which broad mythos or mode is weakly supported by the scene evidence?",
        "cue_terms": ["comic", "tragic", "romantic", "ironic", "mythos", "mode"],
    },
    "bookerian": {
        "label": "Bookerian",
        "question": "Which plot pattern is suggested by conflict, quest, return, loss, or rebirth cues?",
        "cue_terms": ["quest", "voyage", "return", "tragedy", "comedy", "rebirth", "monster"],
    },
    "burkean_motive": {
        "label": "Burkean motive",
        "question": "How do act, scene, agent, agency, and purpose relate?",
        "cue_terms": ["act", "scene", "agent", "agency", "purpose", "motive"],
    },
}

CONTEXTUAL_LABEL_FAMILIES = {
    "Action",
    "Scene",
    "Episode",
    "Situation",
    "Interaction",
    "ReportClaim",
    "ForensicObservation",
}

MATURITY_CONFIG = {
    "candidate_support_threshold": 0.45,
    "cross_modal_support_threshold": 0.68,
    "max_readings_per_surface": 12,
    "blocked_states": ["blocked_no_source_anchor"],
    "surface_low_support_candidates": True,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _score(value: Any, fallback: float = 0.0) -> float:
    return max(0.0, min(1.0, round(_safe_float(value, fallback), 4)))


def _time_span_from_instruction(instruction: Dict[str, Any]) -> Dict[str, int]:
    span = instruction.get("time_span") or {}
    start = span.get("start_ms", span.get("start", 0))
    end = span.get("end_ms", span.get("end", start))
    if _safe_float(start) < 1000 and "start_ms" not in span:
        start = int(round(_safe_float(start) * 1000))
    if _safe_float(end) < 1000 and "end_ms" not in span:
        end = int(round(_safe_float(end) * 1000))
    return {
        "start_ms": int(_safe_float(start)),
        "end_ms": int(_safe_float(end, start)),
    }


def _source_refs_from_instruction(instruction: Dict[str, Any]) -> List[Dict[str, Any]]:
    refs = [ref for ref in instruction.get("source_evidence_refs") or [] if isinstance(ref, dict)]
    if refs:
        return refs
    return [
        {
            "evidence_id": _safe_text(instruction.get("instruction_id"), "instruction"),
            "evidence_kind": "second_order_label_instruction",
            "source_surface": "second_order_label_proliferation",
            "time_span": _time_span_from_instruction(instruction),
        }
    ]


def _manual_support(evidence_refs: Iterable[Dict[str, Any]]) -> bool:
    return any(
        str(ref.get("evidence_kind")) in {"manual_annotation", "manual_correction"}
        or str(ref.get("evidence_id", "")).startswith("manual")
        for ref in evidence_refs
    )


def _evidence_kinds(evidence_refs: Iterable[Dict[str, Any]]) -> List[str]:
    kinds: List[str] = []
    for ref in evidence_refs:
        kind = _safe_text(ref.get("evidence_kind") or ref.get("source_surface"), "source")
        if kind and kind not in kinds:
            kinds.append(kind)
    return kinds


def _maturity_gate(
    evidence_refs: List[Dict[str, Any]],
    support_score: float,
    status: str,
) -> Dict[str, Any]:
    source_anchor_present = bool(evidence_refs)
    manual_supported = _manual_support(evidence_refs)
    evidence_kinds = _evidence_kinds(evidence_refs)
    cross_modal = len(evidence_kinds) >= 2
    if not source_anchor_present:
        state = "blocked_no_source_anchor"
        reason = "No source evidence anchor is available, so this reading must not surface as interpretation."
    elif status == "analyst_confirmed" or manual_supported:
        state = "analyst_supported"
        reason = "Manual or analyst-confirmed support is present; automated interpretation remains subordinate."
    elif cross_modal or support_score >= MATURITY_CONFIG["cross_modal_support_threshold"]:
        state = "cross_modal_supported"
        reason = "The reading has stronger support or multiple evidence surfaces."
    elif support_score < MATURITY_CONFIG["candidate_support_threshold"]:
        state = "candidate_low_support"
        reason = "The reading is source-linked but support is weak; show as a question, not a claim."
    else:
        state = "candidate_source_linked"
        reason = "The reading has source evidence and may be reviewed as a candidate."
    return {
        "state": state,
        "reason": reason,
        "source_anchor_present": source_anchor_present,
        "source_ref_count": len(evidence_refs),
        "evidence_kinds": evidence_kinds,
        "manual_authority_present": manual_supported,
        "cross_modal_evidence": cross_modal,
        "support_band": "strong" if support_score >= 0.75 else "moderate" if support_score >= 0.62 else "low",
        "can_surface": state not in MATURITY_CONFIG["blocked_states"],
        "requires_review": state != "analyst_supported",
    }


def _lens_support_score(instruction: Dict[str, Any], lens_id: str) -> float:
    lens = LENS_PROFILES[lens_id]
    text = " ".join(
        [
            _safe_text(instruction.get("target_label_family")),
            _safe_text(instruction.get("candidate_label")),
            _safe_text(instruction.get("source_feature_type")),
            " ".join(map(str, instruction.get("participants_involved") or [])),
        ]
    ).lower()
    cue_hits = sum(1 for term in lens["cue_terms"] if term in text)
    open_scores = instruction.get("open_scores") or {}
    base = _score(open_scores.get("overall_support"), 0.45)
    return _score(base + min(0.35, cue_hits * 0.12))


def _reading_for_lens(
    analysis_id: str,
    instruction: Dict[str, Any],
    lens_id: str,
    index: int,
) -> Dict[str, Any]:
    lens = LENS_PROFILES[lens_id]
    evidence_refs = _source_refs_from_instruction(instruction)
    support_score = _lens_support_score(instruction, lens_id)
    status = _safe_text(instruction.get("status"), "candidate")
    label = _safe_text(instruction.get("candidate_label"), _safe_text(instruction.get("target_label_family"), "scene claim"))
    target_family = _safe_text(instruction.get("target_label_family"), "Scene")
    claim = (
        f"{lens['label']} reading is suggested by {target_family.lower()} evidence around "
        f"'{label}'."
    )
    maturity_gate = _maturity_gate(evidence_refs, support_score, status)
    return {
        "reading_id": f"narrative_lens:{analysis_id}:{lens_id}:{index}",
        "analysis_id": analysis_id,
        "artifact_schema": SCHEMA,
        "lens_id": lens_id,
        "lens_label": lens["label"],
        "lens_question": lens["question"],
        "target": {
            "target_type": "scene" if target_family in {"Scene", "Situation", "Action", "Interaction"} else "episode",
            "target_label_family": target_family,
            "source_instruction_id": instruction.get("instruction_id"),
            "time_span": _time_span_from_instruction(instruction),
        },
        "claim_label": label,
        "claim_prose": claim,
        "support_score": support_score,
        "maturity_state": maturity_gate["state"],
        "maturity_gate": maturity_gate,
        "authority_level": "manual_annotation" if _manual_support(evidence_refs) else "governed_interpretive_reading",
        "evidence_refs": evidence_refs,
        "counter_evidence_refs": [],
        "prose_policy": {
            "must_phrase_as_suggested_reading": True,
            "must_not_state_lens_as_fact": True,
            "must_expose_source_anchors": True,
        },
        "analyst_actions": ["confirm", "reject", "revise", "defer", "open_traceback"],
    }


def build_narrative_lens_reading_artifact(
    analysis_id: str,
    second_order_label_proliferation: Dict[str, Any],
    *,
    dependency_sfl_stage1: Optional[Dict[str, Any]] = None,
    multimodal_meaning_stage1: Optional[Dict[str, Any]] = None,
    scene_cards: Optional[Iterable[Dict[str, Any]]] = None,
    source_metadata: Optional[Dict[str, Any]] = None,
    manual_interpretations: Optional[Iterable[Dict[str, Any]]] = None,
    lens_ids: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    active_lens_ids = [lens for lens in (lens_ids or LENS_PROFILES.keys()) if lens in LENS_PROFILES]
    instructions = [
        item
        for item in second_order_label_proliferation.get("instructions") or []
        if isinstance(item, dict)
        and _safe_text(item.get("target_label_family")) in CONTEXTUAL_LABEL_FAMILIES
    ]
    readings: List[Dict[str, Any]] = []
    for index, instruction in enumerate(instructions):
        best_lens = max(
            active_lens_ids,
            key=lambda lens_id: _lens_support_score(instruction, lens_id),
            default="freytagian",
        )
        readings.append(_reading_for_lens(analysis_id, instruction, best_lens, index))

    return {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "created_at": _now_iso(),
        "authority_policy": AUTHORITY_POLICY,
        "maturity_config": MATURITY_CONFIG,
        "source_artifacts": {
            "second_order_label_proliferation": second_order_label_proliferation.get("schema"),
            "dependency_sfl_stage1": (dependency_sfl_stage1 or {}).get("schema"),
            "multimodal_meaning_stage1": (multimodal_meaning_stage1 or {}).get("schema"),
            "scene_card_count": len(list(scene_cards or [])),
            "manual_interpretation_count": len(list(manual_interpretations or [])),
            "source_metadata_present": bool(source_metadata),
        },
        "lens_profiles": LENS_PROFILES,
        "readings": readings,
        "summary": {
            "reading_count": len(readings),
            "candidate_count": sum(1 for reading in readings if str(reading["maturity_state"]).startswith("candidate")),
            "supported_count": sum(1 for reading in readings if reading["maturity_state"] in {"cross_modal_supported", "analyst_supported"}),
            "blocked_count": sum(1 for reading in readings if not reading["maturity_gate"]["can_surface"]),
        },
        "quality_control": {
            "requires_human_review": bool(readings),
            "known_limitations": [
                "Lens readings are disciplined views over evidence, not final truth claims.",
                "SFL/dependency and second-order labels remain candidate support until governed review.",
            ],
        },
    }


def write_narrative_lens_reading_artifact(
    analysis_id: str,
    second_order_label_proliferation: Dict[str, Any],
    output_path: str | Path,
    **kwargs: Any,
) -> Dict[str, Any]:
    artifact = build_narrative_lens_reading_artifact(
        analysis_id,
        second_order_label_proliferation,
        **kwargs,
    )
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    return artifact
