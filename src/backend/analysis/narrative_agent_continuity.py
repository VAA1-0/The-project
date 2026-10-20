"""Governed Narrative Agent continuity inventory and proposal assembly.

This module is deliberately read-only.  It inventories source-local, governed
Narrative Agent occurrences and assembles a review proposal without allowing a
raw detector or tracker id to establish identity.  Acceptance, rejection,
split, and merge decisions belong to the canonical decision ledger.
"""
from __future__ import annotations

from collections import defaultdict
import copy
from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Dict, Iterable, List, Mapping, Sequence

from .narrative_agent_recognition_array import collect_confirmed_recognition_anchors


SCHEMA = "vaa1.narrative_agent_continuity_proposal.v1"


def _text(value: Any) -> str:
    return str(value or "").strip()


def _key(value: Any) -> str:
    return " ".join(_text(value).casefold().split())


def _dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _number(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _analysis_id(status: Mapping[str, Any]) -> str:
    return _text(status.get("analysis_id")) or "unknown-analysis"


def _project_id(status: Mapping[str, Any]) -> str:
    return _text(status.get("project_id") or status.get("active_project_id"))


def _manual_visual_rows(status: Mapping[str, Any]) -> List[Mapping[str, Any]]:
    corrections = _dict(status.get("annotation_corrections"))
    return [row for row in _list(corrections.get("manual_visual_annotations")) if isinstance(row, dict)]


def _individual_agent_label(value: Any) -> str:
    """Return a canonical identity suggestion, never a cast/relationship phrase."""
    label = " ".join(_text(value).split())
    if ":" in label:
        label = label.split(":", 1)[0].strip()
    if label.endswith(")") and " (" in label:
        label = label.rsplit(" (", 1)[0].strip()
    lowered = label.casefold()
    if (
        not label
        or len(label) > 100
        or lowered in {
            "unknown", "unknown speaker", "person", "object", "track", "agent", "character",
            "character present", "chaser", "door", "foe", "friend", "guard", "microphone",
            "narrative agent", "news anchor", "police officer", "protagonist", "speaker", "villain",
        }
        or "," in label
        or any(separator in lowered for separator in (" and ", " with ", " versus ", " vs. "))
        or lowered.startswith(("directed by", "music by", "produced by", "man in "))
        or ("track" in lowered and any(character.isdigit() for character in lowered))
    ):
        return ""
    return label


def _metadata_confirmed_agents(status: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """Identity confirmations declared in Source Media Metadata.

    These confirm that an agent belongs to the analysis identity registry. They
    deliberately do not manufacture a source-time occurrence or collection
    membership.
    """
    metadata = _dict(status.get("source_media_metadata"))
    annotations = _dict(metadata.get("user_annotations"))
    analysis_id = _analysis_id(status)
    candidates: List[tuple[Any, str, List[str]]] = []
    candidates.extend((value, "persons", []) for value in _list(annotations.get("persons")))
    for profile in _list(annotations.get("narrative_agent_profiles")):
        if isinstance(profile, dict):
            source_metadata = _dict(profile.get("source_metadata"))
            roles = [str(value).strip() for value in _list(source_metadata.get("role_labels")) if str(value).strip()]
            candidates.append((
                profile.get("narrative_agent_name") or profile.get("character_name") or profile.get("name"),
                "narrative_agent_profiles",
                roles,
            ))
    for definition in _list(annotations.get("character_definitions")):
        if isinstance(definition, dict):
            candidates.append((
                definition.get("character_name") or definition.get("narrative_agent_name") or definition.get("name"),
                "character_definitions",
                [str(value).strip() for value in _list(definition.get("role_labels")) if str(value).strip()],
            ))
    for role_line in _list(annotations.get("character_roles")):
        text = _text(role_line)
        if not text:
            continue
        subject, separator, role_text = text.partition(":")
        label = subject.split("(", 1)[0].strip()
        roles = [part.strip() for chunk in role_text.split(";") for part in chunk.split(",") if part.strip()] if separator else []
        candidates.append((label, "character_roles", roles))

    confirmed: Dict[str, Dict[str, Any]] = {}
    for value, field, roles in candidates:
        label = _individual_agent_label(value)
        key = _key(label)
        if not key:
            continue
        record = confirmed.setdefault(key, {
                "narrative_agent_key": key,
                "narrative_agent_label": label,
                "authority": "source_media_metadata_identity_confirmation",
                "confirmation_scope": "identity_registry_and_confirmed_roles",
                "source_analysis_ids": [analysis_id],
                "traceback_refs": [],
                "source_occurrence_confirmed": False,
                "confirmed_roles": [],
                "role_authority": "explicit_source_media_metadata_confirmation",
                "role_probability": 1.0,
            })
        record["traceback_refs"] = sorted(set(record["traceback_refs"] + [f"{analysis_id}:source_media_metadata.user_annotations.{field}"]))
        record["confirmed_roles"] = sorted(set(record["confirmed_roles"] + roles), key=str.casefold)
    return list(confirmed.values())


def _scene_id(row: Mapping[str, Any]) -> str:
    correlation = _dict(row.get("metadata_correlation"))
    return _text(row.get("scene_id") or correlation.get("scene_id"))


def _track_ref(row: Mapping[str, Any]) -> str:
    correlation = _dict(row.get("metadata_correlation"))
    return _text(
        correlation.get("geometry_track_id")
        or correlation.get("target_id")
        or row.get("track_id")
    )


def _confirmed_occurrences(status: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """Return independently governed occurrences; never merge by track id."""
    analysis_id = _analysis_id(status)
    rows_by_id = {_text(row.get("id")): row for row in _manual_visual_rows(status)}
    occurrences: List[Dict[str, Any]] = []
    for anchor in collect_confirmed_recognition_anchors(status):
        source_row = rows_by_id.get(_text(anchor.get("anchor_id")), {})
        occurrences.append(
            {
                "occurrence_id": anchor["anchor_id"],
                "analysis_id": analysis_id,
                "narrative_agent_key": anchor["narrative_agent_key"],
                "narrative_agent_label": anchor["narrative_agent_label"],
                "source_interval": anchor["source_interval"],
                "source_geometry": anchor.get("source_geometry"),
                "evidence_modality": anchor.get("evidence_modality") or "visual",
                "scene_id": _scene_id(source_row),
                "supporting_track_ref": _track_ref(source_row),
                "authority": "explicit_analyst_confirmation",
                "membership_state": "confirmed_source_occurrence",
                "traceback_refs": list(anchor.get("traceback_refs") or []),
            }
        )
    corrections = _dict(status.get("annotation_corrections"))
    for index, row in enumerate(_manual_visual_rows(status)):
        if _text(row.get("category")).casefold() != "audio":
            continue
        label = _text(row.get("identity_affirmation") or row.get("narrative_agent_label"))
        event = _dict(_dict(row.get("metadata_correlation")).get("manual_confirmation_event"))
        if not label or _dict(event.get("confirmed_fields")).get("narrative_agent") is not True:
            continue
        start = _number(row.get("start_seconds") if row.get("start_seconds") is not None else row.get("timestamp_seconds"))
        if start is None:
            continue
        end = _number(row.get("end_seconds"))
        occurrence_id = _text(row.get("id")) or f"{analysis_id}:audio-agent:{index}"
        occurrences.append({
            "occurrence_id": occurrence_id,
            "analysis_id": analysis_id,
            "narrative_agent_key": _key(label),
            "narrative_agent_label": label,
            "source_interval": {"start": start, "end": end if end is not None else start},
            "source_geometry": None,
            "scene_id": _scene_id(row),
            "supporting_track_ref": "",
            "supporting_audio_ref": _text(_dict(row.get("metadata_correlation")).get("target_id")),
            "evidence_modality": "audio",
            "authority": "explicit_analyst_confirmation",
            "membership_state": "confirmed_source_occurrence",
            "traceback_refs": [ref for ref in (_text(event.get("event_id")),) if ref],
        })
    non_agent_sources = {"unknown", "crowd", "background noise", "announcer", "voice-over narration"}
    for index, row in enumerate(_list(corrections.get("text_substitutions"))):
        if not isinstance(row, dict):
            continue
        label = _text(row.get("speaker_confirmation"))
        if not label or _key(label) in non_agent_sources:
            continue
        start = _number(row.get("target_start_timestamp"))
        if start is None:
            continue
        end = _number(row.get("target_end_timestamp"))
        occurrence_id = _text(row.get("id")) or f"{analysis_id}:confirmed-speaker:{index}"
        occurrences.append({
            "occurrence_id": occurrence_id,
            "analysis_id": analysis_id,
            "narrative_agent_key": _key(label),
            "narrative_agent_label": label,
            "source_interval": {"start": start, "end": end if end is not None else start},
            "source_geometry": None,
            "scene_id": _text(row.get("scene_id")),
            "supporting_track_ref": "",
            "supporting_audio_ref": _text(row.get("speaker_label")),
            "transcript_text": _text(row.get("corrected_value") or row.get("original_value")),
            "evidence_modality": "transcript_audio",
            "authority": "explicit_analyst_confirmation",
            "membership_state": "confirmed_source_occurrence",
            "traceback_refs": [occurrence_id],
        })
    return occurrences


def _candidate_occurrences(status: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """Normalize precomputed recognition candidates as review-only membership."""
    analysis_id = _analysis_id(status)
    candidates: List[Dict[str, Any]] = []
    for index, row in enumerate(_list(status.get("narrative_agent_recognition_candidates"))):
        if not isinstance(row, dict):
            continue
        label = _text(row.get("narrative_agent_label") or row.get("candidate_label"))
        start = _number(row.get("start_seconds") or row.get("timestamp_seconds"))
        if not label or start is None:
            continue
        end = _number(row.get("end_seconds"))
        candidates.append(
            {
                "occurrence_id": _text(row.get("candidate_id")) or f"{analysis_id}:continuity-candidate:{index}",
                "analysis_id": analysis_id,
                "narrative_agent_key": _key(label),
                "narrative_agent_label": label,
                "source_interval": {"start": start, "end": end if end is not None else start},
                "source_geometry": row.get("bbox") or row.get("geometry"),
                "scene_id": _text(row.get("scene_id")),
                "supporting_track_ref": _text(row.get("track_id")),
                "authority": "precomputed_recognition_candidate",
                "membership_state": "proposed_membership",
                "traceback_refs": [ref for ref in [_text(row.get("source_ref"))] if ref],
                "scores": _dict(row.get("scores")),
            }
        )
    return candidates


def _audio_sample_payload(status: Mapping[str, Any]) -> Mapping[str, Any]:
    direct = status.get("audio_sample_clouds")
    if isinstance(direct, dict):
        return direct
    results = _dict(status.get("results"))
    audio = _dict(results.get("audio_analysis"))
    nested = audio.get("audio_sample_clouds")
    return nested if isinstance(nested, dict) else {}


def _audio_agent_candidate_occurrences(status: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """Expose named audio-cloud rows as source-timed attribution candidates."""
    analysis_id = _analysis_id(status)
    synchrony_rows = _list(_dict(status.get("active_speaker_synchrony")).get("measurements"))
    candidates = []
    for cloud in _list(_audio_sample_payload(status).get("clouds")):
        if not isinstance(cloud, dict):
            continue
        label = _individual_agent_label(cloud.get("entity_label"))
        if not label or label.casefold().startswith("speaker_"):
            continue
        for index, sample in enumerate(_list(cloud.get("samples"))):
            if not isinstance(sample, dict):
                continue
            start = _number(sample.get("time_start", sample.get("start")))
            end = _number(sample.get("time_end", sample.get("end")))
            if start is None:
                continue
            end = end if end is not None else start
            synchrony = next((
                row for row in synchrony_rows
                if isinstance(row, dict)
                and _key(row.get("identity_label")) == _key(label)
                and _number(_dict(row.get("source_interval")).get("start")) is not None
                and max(start, float(_dict(row.get("source_interval"))["start"]))
                < min(end, float(_dict(row.get("source_interval")).get("end") or _dict(row.get("source_interval"))["start"]))
            ), None)
            sample_id = _text(sample.get("sample_id")) or f"{analysis_id}:named-audio:{index}"
            candidates.append({
                "occurrence_id": sample_id,
                "analysis_id": analysis_id,
                "narrative_agent_key": _key(label),
                "narrative_agent_label": label,
                "source_interval": {"start": start, "end": end},
                "source_geometry": None,
                "scene_id": _text(sample.get("scene_id")),
                "supporting_track_ref": "",
                "supporting_audio_ref": _text(sample.get("voice_embedding_ref") or sample_id),
                "evidence_modality": "transcript_audio",
                "authority": "named_audio_sample_candidate",
                "membership_state": "proposed_membership",
                "traceback_refs": [sample_id],
                "transcript_text": _text(sample.get("transcript_text") or sample.get("text")),
                "scores": {
                    "identity_cue_confidence": _number(sample.get("confidence")) or 0.0,
                    "active_speaker_probability": _number(_dict(synchrony).get("probability")),
                },
                "active_speaker_synchrony": copy.deepcopy(synchrony) if synchrony else None,
                "interpretation_is_candidate_only": True,
            })
    return candidates


def _audio_sample_matching(
    statuses: Sequence[Mapping[str, Any]], selected_confirmed: Sequence[Mapping[str, Any]]
) -> Dict[str, Any]:
    """Expose confirmed audio anchors and measured sample windows for review.

    This deliberately does not invent voice similarity. Existing matcher scores
    are preserved; otherwise the window remains an unscored comparison target.
    """
    seeds = []
    for row in selected_confirmed:
        if _text(row.get("evidence_modality")) not in {"audio", "transcript_audio"}:
            continue
        seeds.append({
            "seed_id": _text(row.get("occurrence_id")),
            "analysis_id": _text(row.get("analysis_id")),
            "narrative_agent_label": _text(row.get("narrative_agent_label")),
            "source_interval": copy.deepcopy(_dict(row.get("source_interval"))),
            "supporting_audio_ref": _text(row.get("supporting_audio_ref")),
            "maturity": "mature",
            "authority": "explicit_analyst_confirmation",
        })
    seed_ids_by_analysis: Dict[str, List[str]] = defaultdict(list)
    for seed in seeds:
        seed_ids_by_analysis[seed["analysis_id"]].append(seed["seed_id"])
    suggestions: List[Dict[str, Any]] = []
    for status in statuses:
        analysis_id = _analysis_id(status)
        # An artifact is a private hermeneutic space. A confirmed seed in one
        # analysis never authorizes candidate generation from another analysis.
        if analysis_id not in seed_ids_by_analysis:
            continue
        for cloud in _list(_audio_sample_payload(status).get("clouds")):
            if not isinstance(cloud, dict):
                continue
            for index, sample in enumerate(_list(cloud.get("samples"))):
                if not isinstance(sample, dict):
                    continue
                start = _number(sample.get("time_start", sample.get("start")))
                end = _number(sample.get("time_end", sample.get("end")))
                if start is None:
                    continue
                sample_id = _text(sample.get("sample_id")) or f"{analysis_id}:audio-sample:{index}"
                if any(seed["analysis_id"] == analysis_id and abs(float(seed["source_interval"].get("start", -1)) - start) <= .05 and abs(float(seed["source_interval"].get("end", -1)) - (end if end is not None else start)) <= .05 for seed in seeds):
                    continue
                score = next((_number(sample.get(key)) for key in ("voice_similarity", "audio_similarity", "reference_match_confidence", "similarity_score") if _number(sample.get(key)) is not None), None)
                stale = bool(sample.get("is_stale") or cloud.get("is_stale"))
                suggestions.append({
                    "candidate_id": sample_id,
                    "analysis_id": analysis_id,
                    "hermeneutic_space_id": analysis_id,
                    "confirmed_seed_ids": list(seed_ids_by_analysis[analysis_id]),
                    "source_interval": {"start": start, "end": end if end is not None else start},
                    "speaker_label": _text(sample.get("speaker_label") or cloud.get("entity_label")),
                    "transcript_text": _text(sample.get("transcript_text") or sample.get("text")),
                    "comparison_score": score,
                    "comparison_state": "measured" if score is not None else "awaiting_voice_comparison",
                    "eligible_for_confirmation": not stale,
                    "ineligible_reason": _text(sample.get("stale_reason") or cloud.get("stale_reason")) if stale else "",
                    "source_ref": _text(sample.get("stable_subject_ref") or sample_id),
                })
    measured = [row for row in suggestions if row.get("comparison_score") is not None]
    probable = [row for row in measured if float(row["comparison_score"]) >= 0.45]
    # Count a source turn once. Transcript, diarization and sample-cloud rows can
    # otherwise make one utterance look like several independent confirmations.
    independent: Dict[tuple, Dict[str, Any]] = {}
    for row in probable:
        interval = _dict(row.get("source_interval"))
        key = (
            row.get("analysis_id"),
            round(float(interval.get("start") or 0.0), 2),
            round(float(interval.get("end") or interval.get("start") or 0.0), 2),
        )
        previous = independent.get(key)
        if previous is None or float(row["comparison_score"]) > float(previous["comparison_score"]):
            independent[key] = row

    # Conservative cumulative support: each score contributes only its margin
    # above chance. This is descriptive candidate support, never authority for
    # maturation unless the separately governed proof policy is satisfied.
    residual = 1.0
    for row in independent.values():
        chance_adjusted = max(0.0, min(1.0, (float(row["comparison_score"]) - 0.5) * 2.0))
        residual *= 1.0 - chance_adjusted
    aggregate_probability = None
    if independent:
        aggregate_probability = round(0.5 + (0.5 * (1.0 - residual)), 4)

    synchrony_measurements = []
    for status in statuses:
        if _analysis_id(status) not in seed_ids_by_analysis:
            continue
        synchrony = _dict(status.get("active_speaker_synchrony"))
        synchrony_measurements.extend(
            row for row in _list(synchrony.get("measurements"))
            if isinstance(row, dict) and row.get("state") == "measured"
        )

    return {
        "schema": "vaa1.narrative_agent_audio_sample_matching.v1",
        "confirmed_seed_samples": seeds,
        "suggestions": suggestions,
        "aggregate_support": {
            "schema": "vaa1.narrative_agent_audio_aggregate_support.v1",
            "measured_match_count": len(measured),
            "probable_match_count": len(probable),
            "independent_probable_match_count": len(independent),
            "correlated_representation_count": max(0, len(probable) - len(independent)),
            "aggregate_probability": aggregate_probability,
            "state": "measured" if independent else "awaiting_voice_comparison",
            "method": "chance_adjusted_noisy_or_over_distinct_source_turns",
            "calibration": "descriptive_not_auto_maturing",
        },
        "active_speaker_synchrony": {
            "state": "measured" if synchrony_measurements else "not_measured",
            "method": "lower_face_frame_difference_correlated_with_pcm_rms" if synchrony_measurements else None,
            "measurement_count": len(synchrony_measurements),
            "measurements": copy.deepcopy(synchrony_measurements),
            "required_inputs": [
                "source_timed_face_track",
                "mouth_motion_signal",
                "source_timed_speech_activity",
            ],
            "reason": "Behavioral and pose detections do not constitute lip-sync evidence.",
        },
        "policy": {
            "unmeasured_similarity_is_never_fabricated": True,
            "user_confirmed_match_is_mature": True,
            "distinct_source_turns_accumulate_support": True,
            "duplicate_representations_count_once": True,
            "aggregate_candidate_probability_is_not_confirmation": True,
        },
        "boundary_policy": {
            "artifact_hermeneutic_space_is_private": True,
            "cross_artifact_candidate_generation_forbidden": True,
            "comparison_requires_a_confirmed_seed_in_the_same_analysis": True,
        },
    }


def _behavioral_candidate_occurrences(status: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """Expose agent-labelled movement detections as review-only graph evidence.

    A detector-provided label is never promoted here.  It merely makes the
    source-timed behavioral proposal visible in the governed continuity graph.
    """
    analysis_id = _analysis_id(status)
    results = _dict(status.get("results"))
    visual = _dict(results.get("visual_analysis"))
    sources = (
        status.get("body_movement_detections"),
        status.get("pose_detections"),
        visual.get("body_movement_detections"),
        visual.get("pose_detections"),
    )
    candidates: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for source in sources:
        for index, row in enumerate(_list(source)):
            if not isinstance(row, dict):
                continue
            label = _text(
                row.get("narrative_agent_label")
                or row.get("candidate_label")
                or row.get("identity_affirmation")
            )
            start = _number(
                row.get("start_seconds")
                if row.get("start_seconds") is not None
                else row.get("start_timestamp")
                if row.get("start_timestamp") is not None
                else row.get("timestamp_seconds")
                if row.get("timestamp_seconds") is not None
                else row.get("timestamp")
            )
            if not label or start is None:
                continue
            end = _number(row.get("end_seconds") if row.get("end_seconds") is not None else row.get("end_timestamp"))
            occurrence_id = _text(row.get("id") or row.get("evidence_id") or row.get("sample_id")) or f"{analysis_id}:body-movement:{index}"
            if occurrence_id in seen:
                continue
            seen.add(occurrence_id)
            confidence = _number(row.get("confidence") if row.get("confidence") is not None else row.get("motion_score"))
            candidates.append({
                "occurrence_id": occurrence_id,
                "analysis_id": analysis_id,
                "narrative_agent_key": _key(label),
                "narrative_agent_label": label,
                "source_interval": {"start": start, "end": end if end is not None else start},
                "source_geometry": row.get("coordinates") or row.get("bbox"),
                "scene_id": _text(row.get("scene_id")),
                "supporting_track_ref": _text(row.get("track_id")),
                "supporting_pose_ref": _text(row.get("pose_ref") or row.get("skeleton_ref")),
                "evidence_modality": "body_movement",
                "authority": "precomputed_behavioral_candidate",
                "membership_state": "proposed_membership",
                "interpretation_is_candidate_only": True,
                "scores": {"body_movement": confidence},
                "traceback_refs": [occurrence_id],
            })
    return candidates


def _diagnostics(
    confirmed: Sequence[Mapping[str, Any]],
    proposed: Sequence[Mapping[str, Any]],
) -> Dict[str, Any]:
    all_rows = [*confirmed, *proposed]
    track_labels: Dict[tuple[str, str], set[str]] = defaultdict(set)
    agent_tracks: Dict[str, set[tuple[str, str]]] = defaultdict(set)
    agent_scenes: Dict[str, set[tuple[str, str]]] = defaultdict(set)
    for row in all_rows:
        analysis_id = _text(row.get("analysis_id"))
        agent_key = _text(row.get("narrative_agent_key"))
        track_ref = _text(row.get("supporting_track_ref"))
        scene_id = _text(row.get("scene_id"))
        if track_ref:
            track_labels[(analysis_id, track_ref)].add(agent_key)
            agent_tracks[agent_key].add((analysis_id, track_ref))
        if scene_id:
            agent_scenes[agent_key].add((analysis_id, scene_id))

    false_join_risks = [
        {
            "analysis_id": analysis_id,
            "supporting_track_ref": track_ref,
            "narrative_agent_keys": sorted(labels),
            "reason": "one raw track supports occurrences confirmed as different agents",
        }
        for (analysis_id, track_ref), labels in sorted(track_labels.items())
        if len(labels) > 1
    ]
    fragmentation = [
        {
            "narrative_agent_key": agent_key,
            "supporting_track_refs": [f"{analysis}:{track}" for analysis, track in sorted(tracks)],
            "reason": "one agent appears across multiple raw tracks; tracks remain supporting evidence",
        }
        for agent_key, tracks in sorted(agent_tracks.items())
        if len(tracks) > 1
    ]
    scene_boundary_review = [
        {
            "narrative_agent_key": agent_key,
            "scene_refs": [f"{analysis}:{scene}" for analysis, scene in sorted(scenes)],
            "reason": "cross-scene continuity requires analyst review",
        }
        for agent_key, scenes in sorted(agent_scenes.items())
        if len(scenes) > 1
    ]
    missing = [
        row["occurrence_id"]
        for row in all_rows
        if _number(_dict(row.get("source_interval")).get("start")) is None
        or (
            _text(row.get("evidence_modality") or "visual") == "visual"
            and row.get("source_geometry") is None
        )
    ]
    return {
        "false_join_risks": false_join_risks,
        "fragmentation": fragmentation,
        "scene_boundary_review": scene_boundary_review,
        "incomplete_source_anchors": missing,
    }


def build_continuity_inventory(
    statuses: Iterable[Mapping[str, Any]],
    *,
    selected_agent: str = "James Bond",
    project_id: str | None = None,
) -> Dict[str, Any]:
    """Build a project-scoped, non-mutating continuity review proposal."""
    statuses = list(statuses)
    declared_projects = {_project_id(status) for status in statuses if _project_id(status)}
    expected_project = _text(project_id)
    if len(declared_projects) > 1:
        raise ValueError("Narrative Agent continuity inventory cannot cross project boundaries")
    if expected_project and declared_projects and declared_projects != {expected_project}:
        raise ValueError("Narrative Agent continuity inventory project mismatch")

    confirmed = [row for status in statuses for row in _confirmed_occurrences(status)]
    metadata_agents_by_key: Dict[str, Dict[str, Any]] = {}
    for status in statuses:
        for row in _metadata_confirmed_agents(status):
            key = row["narrative_agent_key"]
            existing = metadata_agents_by_key.get(key)
            if existing:
                existing["source_analysis_ids"] = sorted(set(existing["source_analysis_ids"] + row["source_analysis_ids"]))
                existing["traceback_refs"] = sorted(set(existing["traceback_refs"] + row["traceback_refs"]))
                existing["confirmed_roles"] = sorted(set(existing.get("confirmed_roles", []) + row.get("confirmed_roles", [])), key=str.casefold)
            else:
                metadata_agents_by_key[key] = row
    metadata_confirmed_agents = sorted(metadata_agents_by_key.values(), key=lambda row: row["narrative_agent_label"].casefold())
    proposed = [
        row
        for status in statuses
        for row in [*_candidate_occurrences(status), *_behavioral_candidate_occurrences(status), *_audio_agent_candidate_occurrences(status)]
    ]
    selected_key = _key(selected_agent)
    selected_confirmed = [row for row in confirmed if row["narrative_agent_key"] == selected_key]
    selected_metadata_confirmation = metadata_agents_by_key.get(selected_key)
    selected_proposed = [row for row in proposed if row["narrative_agent_key"] == selected_key]
    audio_sample_matching = _audio_sample_matching(statuses, selected_confirmed)
    diagnostics = _diagnostics(confirmed, proposed)
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "project_id": expected_project or next(iter(declared_projects), ""),
                "analyses": sorted(_analysis_id(status) for status in statuses),
                "selected_agent": selected_key,
                "confirmed": sorted(row["occurrence_id"] for row in confirmed),
                "proposed": sorted(row["occurrence_id"] for row in proposed),
            },
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()
    return {
        "schema": SCHEMA,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "project_id": expected_project or next(iter(declared_projects), ""),
        "inventory_fingerprint": fingerprint,
        "selected_agent": {
            "narrative_agent_key": selected_key,
            "narrative_agent_label": selected_agent,
            "confirmed_reference_present": bool(selected_confirmed or selected_metadata_confirmation),
            "metadata_identity_confirmed": bool(selected_metadata_confirmation),
            "confirmed_roles": copy.deepcopy((selected_metadata_confirmation or {}).get("confirmed_roles") or []),
            "role_authority": _text((selected_metadata_confirmation or {}).get("role_authority")),
            "role_probability": (selected_metadata_confirmation or {}).get("role_probability"),
        },
        "governance": {
            "read_only_proposal": True,
            "tracking_is_supporting_evidence_only": True,
            "tracking_cannot_establish_identity_or_membership": True,
            "source_occurrences_remain_independently_governed": True,
            "analyst_decision_required_for_collection_membership": True,
            "project_boundary_is_hermetic": True,
        },
        "summary": {
            "analysis_count": len(statuses),
            "confirmed_agent_count": len({row["narrative_agent_key"] for row in confirmed} | set(metadata_agents_by_key)),
            "metadata_confirmed_agent_count": len(metadata_confirmed_agents),
            "confirmed_occurrence_count": len(confirmed),
            "selected_confirmed_occurrence_count": len(selected_confirmed),
            "selected_proposed_occurrence_count": len(selected_proposed),
        },
        "confirmed_agents": metadata_confirmed_agents,
        "confirmed_occurrences": confirmed,
        "audio_sample_matching": audio_sample_matching,
        "selected_continuity_corridor": {
            "state": "membership_review" if selected_confirmed else "source_occurrence_required" if selected_metadata_confirmation else "confirmed_reference_required",
            "confirmed_members": selected_confirmed,
            "proposed_members": selected_proposed,
            "continuity_claim": "not_accepted",
        },
        "diagnostics": diagnostics,
    }
