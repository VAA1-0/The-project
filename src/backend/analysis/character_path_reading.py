from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


SCHEMA = "vaa1.character_path_reading.v1"

AUTHORITY_POLICY = {
    "manual_correction_wins": True,
    "manual_annotation_wins": True,
    "character_path_outputs_are_candidates": True,
    "archetypes_are_dramaturgical_tendencies_not_identities": True,
    "must_not_create_natural_person_identity_profile": True,
    "readings_do_not_mutate_source_evidence": True,
}

READING_TYPES = [
    "scene_presence",
    "participant_ranking",
    "dramatic_archetype",
    "relation",
    "trajectory",
]

ARCHETYPE_CUES = {
    "performed_agency": ["agency", "authority", "command", "status", "pressure"],
    "narrative_function": ["helper", "opponent", "task", "quest", "dispatch"],
    "symbolic_shadow": ["shadow", "mask", "fear", "threat", "projection"],
    "actant_relation": ["subject", "object", "sender", "receiver", "helper", "opponent"],
    "motive_scene": ["act", "scene", "agent", "agency", "purpose", "motive"],
}

MATURITY_CONFIG = {
    "candidate_support_threshold": 0.45,
    "cross_modal_support_threshold": 0.68,
    "max_readings_per_agent": 5,
    "blocked_states": ["blocked_no_source_anchor", "blocked_no_agent_profile"],
    "surface_low_support_candidates": True,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _normalize(value: Any) -> str:
    return " ".join(_safe_text(value).lower().replace("_", " ").split())


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _score(value: Any, fallback: float = 0.0) -> float:
    return max(0.0, min(1.0, round(_safe_float(value, fallback), 4)))


def _profile_label(profile: Dict[str, Any], index: int) -> str:
    performer = profile.get("attached_performer_metadata") or {}
    return (
        _safe_text(profile.get("narrative_agent_name"))
        or _safe_text(profile.get("current_label"))
        or _safe_text(profile.get("character_name"))
        or _safe_text(performer.get("actor_name") if isinstance(performer, dict) else "")
        or f"Narrative Agent {index + 1}"
    )


def _profile_key(profile: Dict[str, Any], index: int) -> str:
    return _normalize(profile.get("profile_id") or _profile_label(profile, index)).replace(" ", "_")


def _instruction_touches_agent(instruction: Dict[str, Any], label: str) -> bool:
    label_key = _normalize(label)
    if not label_key:
        return False
    values = [
        instruction.get("candidate_label"),
        instruction.get("target_label_family"),
        instruction.get("source_feature_type"),
        *(instruction.get("participants_involved") or []),
    ]
    text = _normalize(" ".join(map(str, values)))
    return label_key in text or any(
        label_key in _normalize(participant) or _normalize(participant) in label_key
        for participant in instruction.get("participants_involved") or []
        if _normalize(participant)
    )


def _evidence_refs(instruction: Dict[str, Any]) -> List[Dict[str, Any]]:
    refs = [ref for ref in instruction.get("source_evidence_refs") or [] if isinstance(ref, dict)]
    if refs:
        return refs
    return [
        {
            "evidence_id": _safe_text(instruction.get("instruction_id"), "instruction"),
            "evidence_kind": "second_order_label_instruction",
            "source_surface": "second_order_label_proliferation",
        }
    ]


def _time_span(instruction: Dict[str, Any]) -> Dict[str, int]:
    span = instruction.get("time_span") or {}
    start = span.get("start_ms", span.get("start", 0))
    end = span.get("end_ms", span.get("end", start))
    if _safe_float(start) < 1000 and "start_ms" not in span:
        start = int(round(_safe_float(start) * 1000))
    if _safe_float(end) < 1000 and "end_ms" not in span:
        end = int(round(_safe_float(end) * 1000))
    return {"start_ms": int(_safe_float(start)), "end_ms": int(_safe_float(end, start))}


def _archetype_scores(instructions: Iterable[Dict[str, Any]]) -> Dict[str, float]:
    instruction_text = _normalize(
        " ".join(
            " ".join(
                map(
                    str,
                    [
                        item.get("candidate_label"),
                        item.get("target_label_family"),
                        item.get("source_feature_type"),
                        *(item.get("participants_involved") or []),
                    ],
                )
            )
            for item in instructions
        )
    )
    scores: Dict[str, float] = {}
    for archetype, cues in ARCHETYPE_CUES.items():
        hits = sum(1 for cue in cues if cue in instruction_text)
        scores[archetype] = _score(hits / max(1, len(cues)))
    return scores


def _evidence_kinds(evidence_refs: Iterable[Dict[str, Any]]) -> List[str]:
    kinds: List[str] = []
    for ref in evidence_refs:
        kind = _safe_text(ref.get("evidence_kind") or ref.get("source_surface"), "source")
        if kind and kind not in kinds:
            kinds.append(kind)
    return kinds


def _maturity_gate(
    profile_key: str,
    evidence_refs: List[Dict[str, Any]],
    support_score: float,
) -> Dict[str, Any]:
    source_anchor_present = bool(evidence_refs)
    agent_profile_present = bool(_safe_text(profile_key))
    evidence_kinds = _evidence_kinds(evidence_refs)
    manual_supported = any(
        ref.get("evidence_kind") in {"manual_annotation", "manual_correction"}
        for ref in evidence_refs
    )
    cross_modal = len(evidence_kinds) >= 2
    if not agent_profile_present:
        state = "blocked_no_agent_profile"
        reason = "No Narrative Agent profile is available, so this path cannot mature."
    elif not source_anchor_present:
        state = "blocked_no_source_anchor"
        reason = "No source evidence anchor is available, so this path must not surface as interpretation."
    elif manual_supported:
        state = "analyst_supported"
        reason = "Manual Narrative Agent support is present; generated readings stay subordinate."
    elif cross_modal or support_score >= MATURITY_CONFIG["cross_modal_support_threshold"]:
        state = "cross_modal_supported"
        reason = "The path has stronger or multiple evidence surfaces."
    elif support_score < MATURITY_CONFIG["candidate_support_threshold"]:
        state = "candidate_low_support"
        reason = "The path is source-linked but weak; show as a review question."
    else:
        state = "candidate_source_linked"
        reason = "The path has source evidence and may be reviewed as a candidate."
    return {
        "state": state,
        "reason": reason,
        "source_anchor_present": source_anchor_present,
        "narrative_agent_profile_present": agent_profile_present,
        "source_ref_count": len(evidence_refs),
        "evidence_kinds": evidence_kinds,
        "manual_authority_present": manual_supported,
        "cross_modal_evidence": cross_modal,
        "support_band": "strong" if support_score >= 0.75 else "moderate" if support_score >= 0.62 else "low",
        "can_surface": state not in MATURITY_CONFIG["blocked_states"],
        "requires_review": state != "analyst_supported",
    }


def _reading(
    analysis_id: str,
    profile_key: str,
    label: str,
    reading_type: str,
    instructions: List[Dict[str, Any]],
    index: int,
    *,
    scene_refs: Optional[Iterable[Dict[str, Any]]] = None,
    visual_audio_refs: Optional[Iterable[Dict[str, Any]]] = None,
    manual_agent_annotations: Optional[Iterable[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    evidence_refs: List[Dict[str, Any]] = []
    for instruction in instructions[:6]:
        evidence_refs.extend(_evidence_refs(instruction))
    evidence_refs.extend(ref for ref in (visual_audio_refs or []) if isinstance(ref, dict))
    evidence_refs.extend(
        {
            "evidence_id": _safe_text(annotation.get("id"), f"manual_agent_annotation:{index}"),
            "evidence_kind": "manual_annotation",
            "source_surface": "NarrativeAgent",
        }
        for annotation in (manual_agent_annotations or [])
        if isinstance(annotation, dict)
    )
    if not evidence_refs:
        evidence_refs.append(
            {
                "evidence_id": profile_key,
                "evidence_kind": "source_metadata",
                "source_surface": "NarrativeAgentProfile",
            }
        )
    manual_supported = any(ref.get("evidence_kind") in {"manual_annotation", "manual_correction"} for ref in evidence_refs)
    first_span = _time_span(instructions[0]) if instructions else {"start_ms": 0, "end_ms": 0}
    archetype_scores = _archetype_scores(instructions)
    strongest_archetype = max(archetype_scores, key=archetype_scores.get) if archetype_scores else "performed_agency"
    prose_by_type = {
        "scene_presence": f"{label} has a scene-presence reading supported by linked scene or source evidence.",
        "participant_ranking": f"{label} has a participant-ranking reading suggested by interaction and source-support density.",
        "dramatic_archetype": (
            f"{label} has a {strongest_archetype.replace('_', ' ')} archetype tendency reading; "
            "this is not an identity label."
        ),
        "relation": f"{label} has relation cues that may connect the agent to other scene participants.",
        "trajectory": f"{label} has a trajectory reading suggested by recurring cues across time or scenes.",
    }
    support_score = _score(0.35 + min(0.45, len(instructions) * 0.1) + (0.2 if manual_supported else 0.0))
    maturity_gate = _maturity_gate(profile_key, evidence_refs, support_score)
    return {
        "reading_id": f"character_path:{analysis_id}:{profile_key}:{reading_type}:{index}",
        "analysis_id": analysis_id,
        "artifact_schema": SCHEMA,
        "narrative_agent": {
            "profile_key": profile_key,
            "current_label": label,
            "boundary": "Narrative Agent Profile, not Natural Person Identity Profile",
        },
        "reading_type": reading_type,
        "claim_prose": prose_by_type[reading_type],
        "support_score": support_score,
        "maturity_state": maturity_gate["state"],
        "maturity_gate": maturity_gate,
        "authority_level": "manual_annotation" if manual_supported else "governed_interpretive_reading",
        "time_span": first_span,
        "scene_refs": list(scene_refs or []),
        "archetype_scores": archetype_scores if reading_type == "dramatic_archetype" else {},
        "evidence_refs": evidence_refs,
        "counter_evidence_refs": [],
        "analyst_actions": ["confirm", "reject", "revise", "defer", "open_traceback"],
        "profile_extension_policy": {
            "may_extend_narrative_agent_profile": True,
            "must_not_create_natural_person_identity_profile": True,
        },
    }


def build_character_path_reading_artifact(
    analysis_id: str,
    narrative_agent_profiles: Iterable[Dict[str, Any]],
    second_order_label_proliferation: Dict[str, Any],
    *,
    scene_refs: Optional[Iterable[Dict[str, Any]]] = None,
    utterance_refs: Optional[Iterable[Dict[str, Any]]] = None,
    visual_audio_refs: Optional[Iterable[Dict[str, Any]]] = None,
    manual_agent_annotations: Optional[Iterable[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    profiles = [profile for profile in narrative_agent_profiles if isinstance(profile, dict)]
    instructions = [
        item
        for item in second_order_label_proliferation.get("instructions") or []
        if isinstance(item, dict)
    ]
    readings: List[Dict[str, Any]] = []
    for profile_index, profile in enumerate(profiles):
        label = _profile_label(profile, profile_index)
        profile_key = _profile_key(profile, profile_index)
        agent_instructions = [
            instruction for instruction in instructions if _instruction_touches_agent(instruction, label)
        ]
        for reading_type in READING_TYPES:
            readings.append(
                _reading(
                    analysis_id,
                    profile_key,
                    label,
                    reading_type,
                    agent_instructions,
                    len(readings),
                    scene_refs=scene_refs,
                    visual_audio_refs=visual_audio_refs,
                    manual_agent_annotations=manual_agent_annotations,
                )
            )

    return {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "created_at": _now_iso(),
        "authority_policy": AUTHORITY_POLICY,
        "maturity_config": MATURITY_CONFIG,
        "source_artifacts": {
            "second_order_label_proliferation": second_order_label_proliferation.get("schema"),
            "profile_count": len(profiles),
            "utterance_ref_count": len(list(utterance_refs or [])),
        },
        "reading_types": READING_TYPES,
        "readings": readings,
        "summary": {
            "reading_count": len(readings),
            "narrative_agent_count": len(profiles),
            "candidate_count": sum(1 for reading in readings if str(reading["maturity_state"]).startswith("candidate")),
            "supported_count": sum(1 for reading in readings if reading["maturity_state"] in {"cross_modal_supported", "analyst_supported"}),
            "blocked_count": sum(1 for reading in readings if not reading["maturity_gate"]["can_surface"]),
        },
        "quality_control": {
            "requires_human_review": bool(readings),
            "known_limitations": [
                "Archetype and trajectory readings are candidates until analyst confirmation.",
                "Readings describe media-internal Narrative Agents, not real-person identity profiles.",
            ],
        },
    }


def write_character_path_reading_artifact(
    analysis_id: str,
    narrative_agent_profiles: Iterable[Dict[str, Any]],
    second_order_label_proliferation: Dict[str, Any],
    output_path: str | Path,
    **kwargs: Any,
) -> Dict[str, Any]:
    artifact = build_character_path_reading_artifact(
        analysis_id,
        narrative_agent_profiles,
        second_order_label_proliferation,
        **kwargs,
    )
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    return artifact
