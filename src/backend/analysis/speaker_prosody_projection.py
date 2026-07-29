"""Governed projection from confirmed transcript speakers to measured prosody cues."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List


SCHEMA = "vaa1.speaker_prosody_projection.v1"
NON_IDENTITY_SOURCE_CLASSES = {"background noise", "crowd"}
NON_AGENT_SPEAKER_ROLES = {"announcer", "voice-over narration"}
UNKNOWN_SPEAKERS = {"unknown", "unknown speaker", "speaker", "speaker 1"}
MOTOR_TARGETS = [
    "master_schema",
    "meaning_network",
    "narrative_agent_graph",
    "audio_sample_cloud",
    "evidence_proliferation_matcher",
    "stats_interpretation",
    "scene_cards",
    "time_bank",
]


def _text(value: Any) -> str:
    return str(value or "").strip()


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalized_speaker(value: Any) -> str:
    return _text(value).lower().replace("_", " ")


def _valid_speaker(value: Any) -> bool:
    normalized = _normalized_speaker(value)
    return bool(
        normalized
        and normalized not in UNKNOWN_SPEAKERS
        and not normalized.startswith("speaker ")
    )


def _overlaps(left_start: float, left_end: float, right_start: float, right_end: float) -> bool:
    return min(left_end, right_end) >= max(left_start, right_start) - 0.03


def _confirmed_spans(corrections: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    for rule in corrections.get("text_substitutions", []) or []:
        if not isinstance(rule, dict) or not _valid_speaker(rule.get("speaker_confirmation")):
            continue
        start = _number(rule.get("corrected_start_timestamp", rule.get("target_start_timestamp")))
        end = _number(rule.get("corrected_end_timestamp", rule.get("target_end_timestamp")))
        if start is None or end is None:
            continue
        yield {
            "correction_ref": _text(rule.get("id")),
            "speaker_label": _text(rule.get("speaker_confirmation")),
            "start": max(0.0, start),
            "end": max(max(0.0, start), end),
            "transcript_text": _text(rule.get("corrected_value") or rule.get("raw_value")),
        }


def project_confirmed_speaker_prosody(
    analysis_id: str,
    *,
    corrections: Dict[str, Any] | None,
    audio_prosody: Dict[str, Any] | None,
) -> Dict[str, Any]:
    """Link measured prosody to explicit speaker decisions without changing identity truth."""
    spans = list(_confirmed_spans(corrections or {}))
    cues = [
        item
        for item in (audio_prosody or {}).get("cues", []) or []
        if isinstance(item, dict)
    ]
    projections: List[Dict[str, Any]] = []
    for cue_index, cue in enumerate(cues):
        cue_start = _number(cue.get("start"))
        cue_end = _number(cue.get("end"))
        if cue_start is None or cue_end is None:
            continue
        for span in spans:
            if not _overlaps(cue_start, cue_end, span["start"], span["end"]):
                continue
            normalized = _normalized_speaker(span["speaker_label"])
            source_class = normalized in NON_IDENTITY_SOURCE_CLASSES
            role_profile = normalized in NON_AGENT_SPEAKER_ROLES
            cue_ref = _text(cue.get("cue_id") or cue.get("id")) or f"prosody:{cue_index}"
            projections.append({
                "projection_id": (
                    f"speaker-prosody:{span['correction_ref']}:{cue_ref}"
                ),
                "analysis_id": analysis_id,
                "speaker_label": span["speaker_label"],
                "assignment_kind": (
                    "audio_source_class"
                    if source_class
                    else "speaker_role"
                    if role_profile
                    else "narrative_agent"
                ),
                "narrative_agent_eligible": not source_class and not role_profile,
                "speaker_assignment_ref": span["correction_ref"],
                "prosody_cue_ref": cue_ref,
                "source_time": {
                    "start_seconds": max(cue_start, span["start"]),
                    "end_seconds": min(cue_end, span["end"]),
                    "clock_id": "source_media.clock",
                },
                "transcript_text": span["transcript_text"],
                "prosody": {
                    "pace": cue.get("pace"),
                    "pauses": cue.get("pauses"),
                    "turn_structure": cue.get("turn_structure"),
                    "interaction_cues": cue.get("interaction_cues"),
                    "rhythm_profile": cue.get("rhythm_profile"),
                    "tonality_profile": cue.get("tonality_profile"),
                    "emphasis": cue.get("emphasis"),
                    "pitch_energy_contour": cue.get("pitch_energy_contour"),
                    "sound_environment": cue.get("sound_environment"),
                },
                "authority": {
                    "speaker_assignment": "explicit_user_confirmation",
                    "prosody_measurement": "source_measured",
                    "projection": "governed_source_time_join",
                },
                "maturity": "governed_evidence_link",
                "identity_auto_promotion_allowed": False,
                "motor_targets": list(MOTOR_TARGETS),
                "evidence_refs": [span["correction_ref"], cue_ref],
            })
    return {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "projection_count": len(projections),
        "confirmed_span_count": len(spans),
        "prosody_cue_count": len(cues),
        "motor_targets": list(MOTOR_TARGETS),
        "projections": projections,
        "governance": {
            "source_time_join_required": True,
            "speaker_confirmation_required": True,
            "unknown_speakers_excluded": True,
            "source_classes_do_not_create_agents": True,
            "identity_auto_promotion_allowed": False,
        },
    }
