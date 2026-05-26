from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

from src.backend.analysis.antenarrative_lexicon_engine import evaluate_antenarrative_cues


SCHEMA = "vaa1.multimodal_meaning.stage1.v1"

AUTHORITY_POLICY = {
    "manual_annotation_wins": True,
    "manual_correction_wins": True,
    "meaning_events_do_not_override_source_evidence": True,
    "derived_scene_state_is_candidate_only": True,
    "pattern_level_recognition_may_seed_candidates": True,
    "analyst_corrections_scale_across_candidate_families": True,
    "authority_order": [
        "manual_correction",
        "manual_annotation",
        "analyst_confirmed_interpretation",
        "external_llm_reviewed_candidate",
        "multimodal_pattern_candidate",
        "single_modality_pattern_candidate",
        "raw_detection",
    ],
}

OPEN_WEIGHTS = {
    "manual_annotation": 1.0,
    "metadata_reference": 0.75,
    "sfl_dependency_pattern": 0.65,
    "transcript_pattern": 0.55,
    "audio_pattern": 0.55,
    "visual_cue": 0.5,
    "cinematic_clue": 0.45,
    "ocr_reference": 0.45,
    "cross_modal_alignment_bonus": 0.15,
    "genre_culture_context_bonus": 0.1,
    "external_llm_review_bonus": 0.1,
}

COMPUTE_PROFILE = {
    "cost_class": "low",
    "requires_gpu": False,
    "recommended_wave": "meaning_making_stage1",
    "purpose": "Use cheap transcript, metadata, audio, visual cue, and cinematic clue signals before expensive visual deepening.",
}

PRONOUNS_SECOND_PERSON = {"you", "your", "yours", "yourself", "yourselves"}
REPAIR_MARKERS = {"uh", "um", "er", "sorry", "rather", "actually", "i mean", "no wait", "well"}
RITUAL_PATTERNS = {
    "greeting": {"hello", "hi", "good morning", "good evening"},
    "farewell": {"goodbye", "bye", "see you"},
    "apology_acceptance": {"sorry", "apologize", "forgive"},
    "challenge_response": {"prove", "try me", "you cannot", "can't"},
    "boundary_setting": {"stop", "leave", "enough", "do not"},
}
AFFILIATION_CARE_PATTERNS = {
    "affirmation": {"yes", "exactly", "right", "true", "confirmed", "i agree"},
    "approval": {"good", "well done", "excellent", "beautiful", "perfect"},
    "encouragement": {"you can", "keep going", "come on", "you got this"},
    "consolation": {"it's okay", "it is okay", "don't worry", "do not worry", "i'm here"},
    "gratitude": {"thank you", "thanks", "grateful"},
    "apology": {"sorry", "i apologize", "forgive me"},
    "offering_help": {"let me help", "i can help", "help you", "protect you"},
}
INTIMACY_COMMITMENT_PATTERNS = {
    "flirting": {"darling", "beautiful", "handsome", "come closer"},
    "affection": {"i love", "miss you", "my dear", "beloved"},
    "invitation": {"come with me", "join me", "stay with me"},
    "vow": {"i promise", "i swear", "i will always", "i'll always", "never leave"},
    "trust_building": {"trust me", "believe me", "you can trust"},
}
JUDGMENT_DENIGRATION_PATTERNS = {
    "disapproval": {"wrong", "unacceptable", "not good enough"},
    "belittling": {"pathetic", "stupid", "weak", "ridiculous", "laughable"},
    "scorn": {"so-called", "nothing but", "you people"},
    "blame": {"your fault", "because of you", "shame on you"},
    "smear": {"liar", "corrupt", "fake", "traitor"},
    "dismissal": {"whatever", "irrelevant", "doesn't matter", "do not care"},
}
PLOT_FUNCTION_PATTERNS = {
    "setup_exposition": {"this is", "there is", "once", "welcome to", "in a world"},
    "goal_mission": {"we need to", "must find", "our mission", "save", "escape", "find"},
    "obstacle_conflict": {"can't", "cannot", "blocked", "too late", "impossible", "stopped us"},
    "reversal_revelation": {"but", "however", "suddenly", "turns out", "truth", "secret", "found out"},
    "stakes_escalation": {"danger", "die", "kill", "lose everything", "time runs out", "before it's too late"},
    "resolution_transformation": {"finally", "it's over", "it is over", "changed", "return", "home"},
    "flashback_memory": {"remember", "years ago", "back then", "used to"},
    "episode_transition": {"meanwhile", "later", "next", "after that", "now"},
    "voice_over_commentary": {"as we see", "he is about to", "they are about to", "what a move"},
    "montage_trailer_escalation": {"this time", "coming", "only one", "every", "all"},
}
TOPIC_STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "is",
    "are",
    "was",
    "were",
    "you",
    "i",
    "he",
    "she",
    "it",
    "we",
    "they",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _score(value: float) -> float:
    return min(1.0, max(0.0, round(value, 4)))


def _time_span(start_ms: Any, end_ms: Any) -> Dict[str, int]:
    start = int(round(float(start_ms or 0)))
    end = int(round(float(end_ms if end_ms is not None else start)))
    if end < start:
        end = start
    return {"start_ms": start, "end_ms": end}


def _tokens(text: str) -> List[str]:
    return re.findall(r"[A-Za-z0-9']+", text.lower())


def _content_terms(text: str) -> Set[str]:
    return {token for token in _tokens(text) if token not in TOPIC_STOPWORDS and len(token) > 2}


def _matched_pattern_groups(
    text_lower: str,
    patterns: Dict[str, Set[str]],
) -> List[Dict[str, Any]]:
    matches: List[Dict[str, Any]] = []
    for group, markers in patterns.items():
        found = sorted(marker for marker in markers if marker in text_lower)
        if found:
            matches.append({"group": group, "markers": found})
    return matches


def _event_id(analysis_id: str, feature_type: str, index: int) -> str:
    return f"{analysis_id}:meaning:{feature_type}:{index}"


def _confidence(score: float, method: str = "rule", notes: str = "") -> Dict[str, Any]:
    return {"score": _score(score), "method": method, "notes": notes}


def _review_status() -> Dict[str, str]:
    return {
        "status": "auto_generated",
        "human_review_required": True,
        "external_llm_review_allowed": True,
    }


def _evidence_refs(
    *,
    utterance: Optional[Dict[str, Any]] = None,
    source_type: str = "derived_feature",
    extra_refs: Optional[Iterable[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    refs: List[Dict[str, Any]] = []
    if utterance:
        for evidence_id in utterance.get("source_evidence_ids") or []:
            refs.append(
                {
                    "evidence_id": str(evidence_id),
                    "evidence_kind": "transcript_utterance",
                    "authority_level": 20,
                }
            )
        refs.append(
            {
                "evidence_id": str(utterance.get("utterance_id")),
                "evidence_kind": source_type,
                "authority_level": 20,
            }
        )
    for ref in extra_refs or []:
        if isinstance(ref, dict):
            refs.append(dict(ref))
    return refs


def _traceback(
    time_span: Dict[str, int],
    *,
    panel_hint: str,
    source_refs: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        "traceback_required": True,
        "primary_time_span": time_span,
        "source_refs": source_refs,
        "panel_hints": sorted({panel_hint, "meaning_panel"}),
    }


def _base_event(
    analysis_id: str,
    feature_type: str,
    index: int,
    time_span: Dict[str, int],
    payload: Dict[str, Any],
    *,
    participants: Optional[List[str]] = None,
    objects: Optional[List[str]] = None,
    evidence_refs: Optional[List[Dict[str, Any]]] = None,
    traceback_refs: Optional[List[Dict[str, Any]]] = None,
    interpretive_tags: Optional[List[str]] = None,
    confidence_score: float = 0.5,
    confidence_notes: str = "Pattern-level candidate.",
) -> Dict[str, Any]:
    return {
        "event_id": _event_id(analysis_id, feature_type, index),
        "feature_type": feature_type,
        "time_span": time_span,
        "participants_involved": participants or [],
        "objects_involved": objects or [],
        "feature_payload": payload,
        "evidence_refs": evidence_refs or [],
        "interpretive_tags": interpretive_tags or [],
        "epistemic_status": "multimodal_candidate"
        if len({ref.get("evidence_kind") for ref in evidence_refs or []}) > 1
        else "single_modality_pattern_candidate",
        "confidence": _confidence(confidence_score, notes=confidence_notes),
        "review_status": _review_status(),
        "proliferation_support": {
            "may_proliferate_as_candidate": True,
            "may_auto_confirm": False,
            "candidate_target_labels": _candidate_target_labels(feature_type),
            "must_preserve": ["time_interval", "geometry", "source_evidence_refs"],
        },
        "traceback": _traceback(time_span, panel_hint="timeline", source_refs=traceback_refs or []),
    }


def _candidate_target_labels(feature_type: str) -> List[str]:
    mapping = {
        "turn_taking": ["Interaction", "Role"],
        "addressivity": ["Interaction", "Identification", "Role"],
        "repair_self_correction": ["Interaction", "Expression", "Role"],
        "repetition": ["Action", "Interaction", "Scene"],
        "scene_power_balance": ["Interaction", "Role", "Situation"],
        "object_significance_escalation": ["Object", "Action", "Scene", "Situation"],
        "spatial_relationship": ["Interaction", "Movement", "Action"],
        "gaze_target_priority": ["Interaction", "Identification", "Object"],
        "topic_shift": ["Scene", "Episode", "Interaction"],
        "micro_ritual": ["Interaction", "Role", "Situation"],
        "affiliation_care": ["Interaction", "Role", "Affect", "Situation"],
        "intimacy_commitment": ["Interaction", "Role", "Relationship", "Situation"],
        "judgment_denigration": ["Interaction", "Role", "Situation", "Affect", "Intensity", "ReportClaim"],
        "plot_function": ["Scene", "Episode", "Situation", "Action", "Interaction", "Role", "ReportClaim"],
        "person_identity_prompt": ["Identification", "Role"],
        "expression_owner_prompt": ["Expression", "Identification"],
        "scene_participant_prompt": ["Interaction", "Identification", "Scene"],
        "antenarrative_bet": ["Scene", "Episode", "Situation", "ReportClaim"],
        "antenarrative_beneath": ["Interaction", "Role", "Situation", "ReportClaim"],
        "antenarrative_between": ["Scene", "Episode", "Situation", "ReportClaim"],
        "antenarrative_beyond": ["Scene", "Episode", "Situation", "ReportClaim"],
        "antenarrative_becoming": ["Scene", "Episode", "Situation", "Action", "Role", "ReportClaim"],
    }
    return mapping.get(feature_type, [])


def _utterances(sfl_artifact: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [item for item in sfl_artifact.get("utterances") or [] if isinstance(item, dict)]


def _utterance_speaker(utterance: Dict[str, Any]) -> str:
    return _safe_text(utterance.get("speaker_id"), "unknown_speaker")


def _utterance_text(utterance: Dict[str, Any]) -> str:
    return _safe_text(utterance.get("text"))


def _utterance_span(utterance: Dict[str, Any]) -> Dict[str, int]:
    interval = utterance.get("time_interval") or {}
    return _time_span(interval.get("start_ms"), interval.get("end_ms"))


def _source_refs_for_utterance(utterance: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        {
            "source_type": "transcript_utterance",
            "source_id": str(utterance.get("utterance_id")),
            "time_span": _utterance_span(utterance),
            "panel_hint": "transcript_panel",
        }
    ]


def _participant_catalog(
    utterances: Sequence[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    labels = {}
    for utterance in utterances:
        speaker = _utterance_speaker(utterance)
        labels.setdefault(speaker, {"participant_id": speaker, "label": speaker, "speaker_id": speaker})

    annotations = ((metadata or {}).get("user_annotations") or {})
    for person in annotations.get("reference_people") or []:
        if not isinstance(person, dict):
            continue
        label = _safe_text(person.get("identity_label") or person.get("name"))
        if label:
            participant_id = _safe_text(person.get("participant_id"), f"metadata:person:{label}")
            labels[participant_id] = {
                "participant_id": participant_id,
                "label": label,
                "role_type": _safe_text(person.get("role_type"), "person"),
                "metadata_ref": person,
            }
    for speaker in annotations.get("reference_speakers") or []:
        if not isinstance(speaker, dict):
            continue
        speaker_id = _safe_text(speaker.get("speaker_label") or speaker.get("speaker_id"))
        identity = _safe_text(speaker.get("identity_label"), speaker_id)
        if speaker_id:
            labels[speaker_id] = {
                "participant_id": speaker_id,
                "label": identity,
                "speaker_id": speaker_id,
                "role_type": "speaker",
                "metadata_ref": speaker,
            }
    return sorted(labels.values(), key=lambda item: item["participant_id"])


def _metadata_refs(metadata: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    refs: List[Dict[str, Any]] = []
    annotations = ((metadata or {}).get("user_annotations") or {})
    for key in ("reference_people", "reference_speakers", "expected_identities", "genre_tags"):
        values = annotations.get(key) or []
        if isinstance(values, str):
            values = [values]
        for index, _value in enumerate(values):
            refs.append(
                {
                    "evidence_id": f"metadata:{key}:{index}",
                    "evidence_kind": "metadata_reference",
                    "authority_level": 30,
                }
            )
    return refs


def _build_linguistic_events(
    analysis_id: str,
    sfl_artifact: Dict[str, Any],
    metadata: Optional[Dict[str, Any]],
    *,
    genre: str = "",
    prosody_cues: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    utterances = _utterances(sfl_artifact)
    metadata_refs = _metadata_refs(metadata)
    event_index = 0

    previous: Optional[Dict[str, Any]] = None
    previous_terms: Set[str] = set()
    seen_terms: Dict[str, int] = {}
    known_names = {
        str(ref.get("identity_label") or ref.get("name") or "").lower()
        for ref in (((metadata or {}).get("user_annotations") or {}).get("reference_people") or [])
        if isinstance(ref, dict)
    }

    for utterance in utterances:
        span = _utterance_span(utterance)
        speaker = _utterance_speaker(utterance)
        text = _utterance_text(utterance)
        text_lower = text.lower()
        terms = _content_terms(text)
        evidence_refs = _evidence_refs(utterance=utterance)
        traceback_refs = _source_refs_for_utterance(utterance)

        if previous and _utterance_speaker(previous) != speaker:
            previous_span = _utterance_span(previous)
            pause_ms = max(0, span["start_ms"] - previous_span["end_ms"])
            kind = "long_silence" if pause_ms >= 1500 else "speaker_change"
            events.append(
                _base_event(
                    analysis_id,
                    "turn_taking",
                    event_index,
                    span,
                    {
                        "kind": kind,
                        "from_speaker": _utterance_speaker(previous),
                        "to_speaker": speaker,
                        "response_latency_ms": pause_ms,
                    },
                    participants=[_utterance_speaker(previous), speaker],
                    evidence_refs=evidence_refs,
                    traceback_refs=traceback_refs,
                    interpretive_tags=["topic_control"] if pause_ms > 0 else [],
                    confidence_score=0.62,
                )
            )
            event_index += 1

        tokens = _tokens(text)
        address_terms = [token for token in tokens if token in PRONOUNS_SECOND_PERSON]
        address_terms.extend([name for name in known_names if name and name in text_lower])
        if address_terms:
            events.append(
                _base_event(
                    analysis_id,
                    "addressivity",
                    event_index,
                    span,
                    {
                        "addressivity_type": "direct_second_person"
                        if any(term in PRONOUNS_SECOND_PERSON for term in address_terms)
                        else "name_calling",
                        "addresser": speaker,
                        "addressee_candidates": sorted(set(address_terms)),
                        "address_terms": sorted(set(address_terms)),
                        "directness_score": 0.75,
                    },
                    participants=[speaker],
                    evidence_refs=[*evidence_refs, *metadata_refs],
                    traceback_refs=traceback_refs,
                    interpretive_tags=["control"],
                    confidence_score=0.66,
                    confidence_notes="Addressivity pattern seeded from transcript and metadata names.",
                )
            )
            event_index += 1

        markers = [marker for marker in REPAIR_MARKERS if marker in text_lower]
        if markers:
            events.append(
                _base_event(
                    analysis_id,
                    "repair_self_correction",
                    event_index,
                    span,
                    {"repair_type": "hesitation_marker", "markers": markers, "repair_intensity": 0.45},
                    participants=[speaker],
                    evidence_refs=evidence_refs,
                    traceback_refs=traceback_refs,
                    interpretive_tags=["hesitation", "uncertainty"],
                    confidence_score=0.58,
                )
            )
            event_index += 1

        for term in sorted(terms):
            seen_terms[term] = seen_terms.get(term, 0) + 1
            if seen_terms[term] == 2:
                events.append(
                    _base_event(
                        analysis_id,
                        "repetition",
                        event_index,
                        span,
                        {
                            "repetition_type": "word_repetition",
                            "repeated_item": term,
                            "count": seen_terms[term],
                            "window_ms": span["end_ms"] - span["start_ms"],
                            "emphasis_score": 0.45,
                        },
                        participants=[speaker],
                        evidence_refs=evidence_refs,
                        traceback_refs=traceback_refs,
                        interpretive_tags=["foreshadowing"],
                        confidence_score=0.5,
                    )
                )
                event_index += 1

        if previous and previous_terms:
            overlap = len(previous_terms & terms)
            union = len(previous_terms | terms) or 1
            distance = 1 - (overlap / union)
            if distance >= 0.8 and terms:
                events.append(
                    _base_event(
                        analysis_id,
                        "topic_shift",
                        event_index,
                        span,
                        {
                            "shift_type": "abrupt_shift",
                            "previous_topic_terms": sorted(previous_terms),
                            "new_topic_terms": sorted(terms),
                            "initiating_participant": speaker,
                            "semantic_distance": _score(distance),
                            "topic_control_score": 0.55,
                            "linearity_note": "Story-world meaning may be episodic; this marks discourse shift, not chronological plot order.",
                        },
                        participants=[speaker],
                        evidence_refs=evidence_refs,
                        traceback_refs=traceback_refs,
                        interpretive_tags=["dramatic_turning_point"],
                        confidence_score=0.48,
                    )
                )
                event_index += 1

        for ritual_type, patterns in RITUAL_PATTERNS.items():
            matched = sorted(pattern for pattern in patterns if pattern in text_lower)
            if matched:
                events.append(
                    _base_event(
                        analysis_id,
                        "micro_ritual",
                        event_index,
                        span,
                        {
                            "ritual_type": ritual_type,
                            "markers": matched,
                            "completion_status": "ambiguous",
                            "ritual_strength": 0.5,
                        },
                        participants=[speaker],
                        evidence_refs=evidence_refs,
                        traceback_refs=traceback_refs,
                        interpretive_tags=["ritual_confirmation"],
                        confidence_score=0.5,
                    )
                )
                event_index += 1

        for match in _matched_pattern_groups(text_lower, AFFILIATION_CARE_PATTERNS):
            events.append(
                _base_event(
                    analysis_id,
                    "affiliation_care",
                    event_index,
                    span,
                    {
                        "care_signal_type": match["group"],
                        "markers": match["markers"],
                        "social_orientation": "alignment_or_support",
                        "compassionate_understanding_note": (
                            "Candidate evidence of affiliation, care, reassurance, or social repair."
                        ),
                    },
                    participants=[speaker],
                    evidence_refs=evidence_refs,
                    traceback_refs=traceback_refs,
                    interpretive_tags=["affiliation", "care", match["group"]],
                    confidence_score=0.52,
                    confidence_notes="Affiliation/care pattern candidate; genre and context remain open.",
                )
            )
            event_index += 1

        for match in _matched_pattern_groups(text_lower, INTIMACY_COMMITMENT_PATTERNS):
            events.append(
                _base_event(
                    analysis_id,
                    "intimacy_commitment",
                    event_index,
                    span,
                    {
                        "intimacy_signal_type": match["group"],
                        "markers": match["markers"],
                        "relationship_movement": "closeness_or_commitment_candidate",
                    },
                    participants=[speaker],
                    evidence_refs=evidence_refs,
                    traceback_refs=traceback_refs,
                    interpretive_tags=["intimacy", "commitment", match["group"]],
                    confidence_score=0.5,
                    confidence_notes="Intimacy/commitment candidate; analyst review may separate sincerity, irony, and genre performance.",
                )
            )
            event_index += 1

        for match in _matched_pattern_groups(text_lower, JUDGMENT_DENIGRATION_PATTERNS):
            events.append(
                _base_event(
                    analysis_id,
                    "judgment_denigration",
                    event_index,
                    span,
                    {
                        "judgment_signal_type": match["group"],
                        "markers": match["markers"],
                        "social_positioning": "downward_or_condemning_candidate",
                        "uncertainty_note": (
                            "Judgment and denigration candidates must remain genre-sensitive and traceback-first."
                        ),
                    },
                    participants=[speaker],
                    evidence_refs=evidence_refs,
                    traceback_refs=traceback_refs,
                    interpretive_tags=["judgment", "denigration", match["group"]],
                    confidence_score=0.5,
                    confidence_notes="Judgment/denigration candidate; not a factual claim without review.",
                )
            )
            event_index += 1

        for match in _matched_pattern_groups(text_lower, PLOT_FUNCTION_PATTERNS):
            events.append(
                _base_event(
                    analysis_id,
                    "plot_function",
                    event_index,
                    span,
                    {
                        "plot_function": match["group"],
                        "markers": match["markers"],
                        "story_world_change_candidate": True,
                        "alternative_plot_lenses": {
                            "aristotle": ["reversal", "recognition", "suffering", "causal_necessity", "catharsis"],
                            "freytag": ["exposition", "rising_action", "climax", "falling_action", "resolution_or_catastrophe"],
                            "campbell": ["call", "refusal", "mentor", "threshold", "trials", "abyss", "transformation", "return"],
                            "frye": ["comedy_integration", "romance_quest", "tragedy_fall", "irony_disintegration"],
                            "booker": ["monster", "quest", "voyage_return", "comedy", "tragedy", "rebirth", "rags_riches"],
                        },
                        "linearity_note": (
                            "Plot meaning may be nonlinear, episodic, narrated, montage-like, or cross-cut."
                        ),
                    },
                    participants=[speaker],
                    evidence_refs=evidence_refs,
                    traceback_refs=traceback_refs,
                    interpretive_tags=["plot", match["group"]],
                    confidence_score=0.5,
                    confidence_notes="Plot-function candidate from transcript pattern; requires source-aware interpretation.",
                )
            )
            event_index += 1

        sfl = utterance.get("sfl_lite") or {}
        interpersonal = sfl.get("interpersonal") or {}
        speech_function = interpersonal.get("speech_function")
        if speech_function in {"directive_candidate", "proposal_candidate"}:
            events.append(
                _base_event(
                    analysis_id,
                    "scene_power_balance",
                    event_index,
                    span,
                    {
                        "dominant_candidate": speaker,
                        "basis": ["directive_language"],
                        "power_delta": 0.25,
                        "stability": "unclear",
                    },
                    participants=[speaker],
                    evidence_refs=evidence_refs,
                    traceback_refs=traceback_refs,
                    interpretive_tags=["control", "dominance"],
                    confidence_score=0.52,
                )
            )
            event_index += 1

        token_trace = utterance.get("token_trace") or []
        if token_trace:
            parsed_tokens = [{"lemma": t.get("lemma", ""), "text": t.get("text", "")} for t in token_trace]
            id_to_text = {t.get("token_id"): t.get("text", "").lower() for t in token_trace}
            deps = [
                {
                    "relation": t.get("dep", ""),
                    "head": id_to_text.get(t.get("head_token_id"), "")
                }
                for t in token_trace
            ]
        else:
            parsed_tokens = [{"lemma": tok.lower(), "text": tok} for tok in tokens]
            deps = []

        utt_prosody = []
        if prosody_cues:
            utt_start_s = span["start_ms"] / 1000.0
            utt_end_s = span["end_ms"] / 1000.0
            for cue in prosody_cues:
                cue_start = float(cue.get("start", 0.0))
                cue_end = float(cue.get("end", 0.0))
                if max(utt_start_s, cue_start) <= min(utt_end_s, cue_end):
                    utt_prosody.append(cue)

        ante_candidates = evaluate_antenarrative_cues(
            parsed_tokens=parsed_tokens,
            dependencies=deps,
            genre=genre,
            prosody_cues=utt_prosody
        )

        for cand in ante_candidates:
            events.append(
                _base_event(
                    analysis_id,
                    cand["feature_type"],
                    event_index,
                    span,
                    cand["feature_payload"],
                    participants=[speaker],
                    evidence_refs=evidence_refs,
                    traceback_refs=traceback_refs,
                    interpretive_tags=["antenarrative", cand["feature_type"].split("_")[-1]],
                    confidence_score=cand.get("confidence", 0.5),
                    confidence_notes="Antenarrative candidate from lexicon engine."
                )
            )
            event_index += 1

        previous = utterance
        previous_terms = terms

    return events


def _build_visual_events(
    analysis_id: str,
    visual_cues: Optional[Iterable[Dict[str, Any]]],
    cinematic_clues: Optional[Iterable[Dict[str, Any]]],
    start_index: int,
) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    index = start_index
    for cue in visual_cues or []:
        if not isinstance(cue, dict):
            continue
        span = _time_span(cue.get("start_ms", cue.get("start", 0)), cue.get("end_ms", cue.get("end", 0)))
        cue_type = _safe_text(cue.get("cue_type") or cue.get("type"))
        evidence_ref = {
            "evidence_id": _safe_text(cue.get("evidence_id"), f"visual_cue:{index}"),
            "evidence_kind": "visual_cue",
            "authority_level": 20,
        }
        if cue_type in {"gaze", "look", "fixation"}:
            events.append(
                _base_event(
                    analysis_id,
                    "gaze_target_priority",
                    index,
                    span,
                    {
                        "gaze_holder": _safe_text(cue.get("participant_id"), "unknown"),
                        "target_type": _safe_text(cue.get("target_type"), "unknown"),
                        "target_id": cue.get("target_id"),
                        "duration_ms": span["end_ms"] - span["start_ms"],
                        "priority_rank": int(cue.get("priority_rank") or 1),
                        "gaze_shift_type": _safe_text(cue.get("gaze_shift_type"), "unknown"),
                    },
                    participants=[_safe_text(cue.get("participant_id"), "unknown")],
                    objects=[_safe_text(cue.get("target_id"))] if cue.get("target_id") else [],
                    evidence_refs=[evidence_ref],
                    traceback_refs=[
                        {
                            "source_type": "gaze_track",
                            "source_id": evidence_ref["evidence_id"],
                            "time_span": span,
                            "panel_hint": "bbox_panel",
                        }
                    ],
                    interpretive_tags=["avoidance"] if cue.get("gaze_shift_type") == "avoidance" else [],
                    confidence_score=0.46,
                    confidence_notes="Visual cue candidate; requires source overlay review.",
                )
            )
            index += 1
        elif cue_type in {"object_foregrounded", "object_handled", "object_mentioned"}:
            object_id = _safe_text(cue.get("object_id"), "unknown_object")
            events.append(
                _base_event(
                    analysis_id,
                    "object_significance_escalation",
                    index,
                    span,
                    {
                        "object_id": object_id,
                        "significance_stage": _safe_text(cue.get("significance_stage"), "noticed"),
                        "significance_score": _score(float(cue.get("score") or 0.45)),
                    },
                    objects=[object_id],
                    evidence_refs=[evidence_ref],
                    traceback_refs=[
                        {
                            "source_type": "object_track",
                            "source_id": evidence_ref["evidence_id"],
                            "time_span": span,
                            "panel_hint": "object_panel",
                        }
                    ],
                    interpretive_tags=["symbolic_object"],
                    confidence_score=0.45,
                )
            )
            index += 1
        elif cue_type == "person_identity_prompt":
            object_id = _safe_text(cue.get("object_id"), "unknown_person")
            events.append(
                _base_event(
                    analysis_id,
                    "person_identity_prompt",
                    index,
                    span,
                    {
                        "prompt": _safe_text(cue.get("prompt"), "Who is this person?"),
                        "object_id": object_id,
                    },
                    objects=[object_id],
                    evidence_refs=[evidence_ref],
                    traceback_refs=[
                        {
                            "source_type": "object_track",
                            "source_id": evidence_ref["evidence_id"],
                            "time_span": span,
                            "panel_hint": "bbox_panel",
                        }
                    ],
                    interpretive_tags=["identity_question"],
                    confidence_score=0.5,
                    confidence_notes="Person detection requires analyst-identifiable subject ownership.",
                )
            )
            index += 1
        elif cue_type == "expression_owner_prompt":
            object_id = _safe_text(cue.get("object_id"), "unknown_expression_subject")
            events.append(
                _base_event(
                    analysis_id,
                    "expression_owner_prompt",
                    index,
                    span,
                    {
                        "prompt": _safe_text(cue.get("prompt"), "Whose expression is this?"),
                        "object_id": object_id,
                        "expression_label": _safe_text(cue.get("expression_label"), "expression"),
                    },
                    objects=[object_id],
                    evidence_refs=[evidence_ref],
                    traceback_refs=[
                        {
                            "source_type": "expression_detection",
                            "source_id": evidence_ref["evidence_id"],
                            "time_span": span,
                            "panel_hint": "expressions_panel",
                        }
                    ],
                    interpretive_tags=["expression_ownership_question"],
                    confidence_score=0.48,
                    confidence_notes="Expression evidence requires subject ownership before mature interpretation.",
                )
            )
            index += 1
        elif cue_type == "scene_participant_prompt":
            participant_ids = [
                _safe_text(value)
                for value in cue.get("participant_ids", [])
                if _safe_text(value)
            ]
            events.append(
                _base_event(
                    analysis_id,
                    "scene_participant_prompt",
                    index,
                    span,
                    {
                        "prompt": _safe_text(cue.get("prompt"), "Who are in this scene?"),
                        "participant_ids": participant_ids,
                    },
                    participants=participant_ids,
                    evidence_refs=[evidence_ref],
                    traceback_refs=[
                        {
                            "source_type": "scene_participant_group",
                            "source_id": evidence_ref["evidence_id"],
                            "time_span": span,
                            "panel_hint": "scene_panel",
                        }
                    ],
                    interpretive_tags=["scene_participant_question"],
                    confidence_score=0.5,
                    confidence_notes="Multiple person detections require scene participant identification.",
                )
            )
            index += 1

    for clue in cinematic_clues or []:
        if not isinstance(clue, dict):
            continue
        span = _time_span(clue.get("start_ms", clue.get("start", 0)), clue.get("end_ms", clue.get("end", 0)))
        clue_type = _safe_text(clue.get("clue_type") or clue.get("type"))
        if clue_type not in {"close_up", "screen_dominance", "blocking", "approach", "withdrawal"}:
            continue
        participant = _safe_text(clue.get("participant_id"), "unknown")
        evidence_ref = {
            "evidence_id": _safe_text(clue.get("evidence_id"), f"cinematic_clue:{index}"),
            "evidence_kind": "cinematic_clue",
            "authority_level": 20,
        }
        events.append(
            _base_event(
                analysis_id,
                "spatial_relationship",
                index,
                span,
                {
                    "relation_type": "approach" if clue_type == "approach" else "territorial_claim",
                    "subject_participant": participant,
                    "target_participant_or_object": clue.get("target_id"),
                    "distance_before": clue.get("distance_before"),
                    "distance_after": clue.get("distance_after"),
                    "distance_unit": _safe_text(clue.get("distance_unit"), "unknown"),
                    "directionality": "toward" if clue_type == "approach" else "unknown",
                    "cinematic_basis": clue_type,
                },
                participants=[participant],
                evidence_refs=[evidence_ref],
                traceback_refs=[
                    {
                        "source_type": "bbox",
                        "source_id": evidence_ref["evidence_id"],
                        "time_span": span,
                        "panel_hint": "bbox_panel",
                    }
                ],
                interpretive_tags=["dominance"] if clue_type in {"close_up", "screen_dominance"} else [],
                confidence_score=0.44,
            )
        )
        index += 1
    return events


def _derived_scene_state(events: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    tags = [tag for event in events for tag in event.get("interpretive_tags") or []]
    foregrounded_objects = [
        object_id
        for event in events
        if event.get("feature_type") == "object_significance_escalation"
        for object_id in event.get("objects_involved") or []
        if object_id
    ]
    dominant_candidates = [
        (event.get("feature_payload") or {}).get("dominant_candidate")
        for event in events
        if event.get("feature_type") == "scene_power_balance"
    ]
    topic_owner_candidates = [
        (event.get("feature_payload") or {}).get("initiating_participant")
        for event in events
        if event.get("feature_type") == "topic_shift"
    ]
    return {
        "epistemic_status": "candidate",
        "linearity_policy": {
            "does_not_assume_linear_story_world": True,
            "episode_links_may_cross_chronological_order": True,
        },
        "supporting_event_ids": [event["event_id"] for event in events],
        "dominant_participant_candidate": next((item for item in dominant_candidates if item), None),
        "topic_owner_candidate": next((item for item in topic_owner_candidates if item), None),
        "foregrounded_objects": sorted(set(foregrounded_objects)),
        "current_tension_score": _score(tags.count("tension") * 0.2 + tags.count("conflict") * 0.2),
        "current_conflict_score": _score(tags.count("conflict") * 0.25 + tags.count("threat") * 0.2),
        "current_cooperation_score": _score(tags.count("cooperation") * 0.25 + tags.count("alliance") * 0.2),
        "current_intimacy_score": _score(tags.count("intimacy") * 0.25),
        "dramatic_phase_candidate": "reversal" if any(tag == "dramatic_turning_point" for tag in tags) else "ambiguous",
    }


def build_multimodal_meaning_stage1_artifact(
    analysis_id: str,
    sfl_artifact: Dict[str, Any],
    *,
    source_media_id: Optional[str] = None,
    source_metadata: Optional[Dict[str, Any]] = None,
    visual_cues: Optional[Iterable[Dict[str, Any]]] = None,
    cinematic_clues: Optional[Iterable[Dict[str, Any]]] = None,
    audio_features: Optional[Dict[str, Any]] = None,
    ocr_features: Optional[Dict[str, Any]] = None,
    genre_profile: Optional[Dict[str, Any]] = None,
    culture_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    utterances = _utterances(sfl_artifact)

    annotations = (source_metadata or {}).get("user_annotations") or {}
    genre_tags = annotations.get("genre_tags") or []
    if isinstance(genre_tags, str):
        genre_tags = [genre_tags]
    genre_hint = _safe_text((genre_profile or {}).get("genre") or (genre_tags[0] if genre_tags else ""))
    prosody_cues = (audio_features or {}).get("cues") or []

    linguistic_events = _build_linguistic_events(
        analysis_id,
        sfl_artifact,
        source_metadata,
        genre=genre_hint,
        prosody_cues=prosody_cues
    )
    visual_events = _build_visual_events(
        analysis_id,
        visual_cues,
        cinematic_clues,
        start_index=len(linguistic_events),
    )
    events = [*linguistic_events, *visual_events]
    if audio_features:
        for event in events:
            event["evidence_refs"].append(
                {
                    "evidence_id": _safe_text(audio_features.get("artifact_id"), "audio_features"),
                    "evidence_kind": "audio_pattern",
                    "authority_level": 20,
                }
            )
    if ocr_features:
        for event in events:
            event["evidence_refs"].append(
                {
                    "evidence_id": _safe_text(ocr_features.get("artifact_id"), "ocr_features"),
                    "evidence_kind": "ocr_reference",
                    "authority_level": 20,
                }
            )

    return {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "source_media_id": source_media_id or sfl_artifact.get("source_media_id"),
        "time_span": _time_span(
            min(((_utterance_span(item)["start_ms"]) for item in utterances), default=0),
            max(((_utterance_span(item)["end_ms"]) for item in utterances), default=0),
        ),
        "authority_policy": AUTHORITY_POLICY,
        "open_weights": OPEN_WEIGHTS,
        "compute_profile": COMPUTE_PROFILE,
        "interpretive_context": {
            "source_metadata": source_metadata or {},
            "genre_profile": genre_profile or {},
            "culture_context": culture_context or {},
            "metadata_can_seed_reference_patterns": True,
            "pattern_level_recognition_is_sufficient_for_candidate_creation": True,
            "external_llm_label_checkup": {
                "allowed": True,
                "may_auto_confirm": False,
                "must_return_traceback": True,
            },
        },
        "participants": _participant_catalog(utterances, source_metadata),
        "objects_of_interest": [],
        "feature_events": events,
        "derived_scene_state": _derived_scene_state(events),
        "interpretive_summary": {
            "plain_language_summary": "",
            "dramatic_understanding_candidate": "",
            "meaning_making_claims": [],
            "candidate_only": True,
        },
        "quality_control": {
            "requires_human_review": True,
            "review_priority": "medium" if events else "low",
            "known_limitations": [
                "Pattern-level events are candidates until analyst or governed review.",
                "Episodic narration may make story-world meaning non-linear relative to timeline order.",
                "Visual and cinematic clue events depend on upstream cue quality.",
            ],
        },
        "provenance": {
            "created_at": _now_iso(),
            "source_artifacts": [sfl_artifact.get("schema")],
            "traceback_required": True,
        },
    }


def write_multimodal_meaning_stage1_artifact(
    analysis_id: str,
    sfl_artifact: Dict[str, Any],
    output_path: str | Path,
    **kwargs: Any,
) -> Dict[str, Any]:
    artifact = build_multimodal_meaning_stage1_artifact(analysis_id, sfl_artifact, **kwargs)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    return artifact
