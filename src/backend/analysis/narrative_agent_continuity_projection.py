"""Canonical cross-consumer projection for governed Narrative Agent continuity."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Dict, Mapping, Sequence

from .narrative_agent_continuity_decisions import project_continuity_decisions


SCHEMA = "vaa1.narrative_agent_continuity_projection_envelope.v1"
CONSUMERS = (
    "video",
    "audio",
    "transcript",
    "narrative_agent",
    "meaning_plot",
    "master_schema",
    "data_maturation",
    "search",
    "traceback",
    "measurements",
)


def _text(value: Any) -> str:
    return str(value or "").strip()


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _all_occurrences(inventory: Mapping[str, Any]) -> Dict[str, Dict[str, Any]]:
    rows = list(_list(inventory.get("confirmed_occurrences")))
    corridor = inventory.get("selected_continuity_corridor")
    if isinstance(corridor, dict):
        rows.extend(_list(corridor.get("proposed_members")))
    return {
        _text(row.get("occurrence_id")): copy.deepcopy(row)
        for row in rows
        if isinstance(row, dict) and _text(row.get("occurrence_id"))
    }


def _blocking_diagnostics(inventory: Mapping[str, Any], selected_key: str) -> list[Dict[str, Any]]:
    diagnostics = inventory.get("diagnostics") if isinstance(inventory.get("diagnostics"), dict) else {}
    blocked: list[Dict[str, Any]] = []
    for risk in _list(diagnostics.get("false_join_risks")):
        if isinstance(risk, dict) and selected_key in _list(risk.get("narrative_agent_keys")):
            blocked.append({"kind": "false_join_risk", **copy.deepcopy(risk)})
    for risk in _list(diagnostics.get("incomplete_source_anchors")):
        blocked.append({"kind": "incomplete_source_anchor", "occurrence_id": risk})
    return blocked


def _graph_id(kind: str, *parts: Any) -> str:
    identity = "|".join(_text(part) for part in parts)
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    return f"continuity:{kind}:{digest}"


def _dialogue_candidates(
    inventory: Mapping[str, Any], members: Sequence[Mapping[str, Any]], selected_key: str
) -> list[Dict[str, Any]]:
    """Raise bounded interlocutor candidates without equating co-presence with dialogue."""
    others = [
        row for row in _list(inventory.get("confirmed_occurrences"))
        if isinstance(row, dict) and _text(row.get("narrative_agent_key")) != selected_key
    ]
    candidates: Dict[str, Dict[str, Any]] = {}
    for member in members:
        left = member.get("source_interval") if isinstance(member.get("source_interval"), dict) else {}
        left_start, left_end = left.get("start"), left.get("end")
        if left_start is None or left_end is None:
            continue
        for other in others:
            if _text(other.get("analysis_id")) != _text(member.get("analysis_id")):
                continue
            right = other.get("source_interval") if isinstance(other.get("source_interval"), dict) else {}
            right_start, right_end = right.get("start"), right.get("end")
            if right_start is None or right_end is None:
                continue
            distance = max(0.0, float(right_start) - float(left_end), float(left_start) - float(right_end))
            modalities = {_text(member.get("evidence_modality")), _text(other.get("evidence_modality"))}
            if distance > 5.0 or not modalities.intersection({"audio", "transcript_audio"}):
                continue
            audio_count = len(modalities.intersection({"audio", "transcript_audio"}))
            proximity_support = max(0.0, 1.0 - (distance / 5.0))
            constellational_probability = min(
                0.95,
                0.55 + (0.15 if audio_count > 1 else 0.0) + (0.25 * proximity_support),
            )
            other_key = _text(other.get("narrative_agent_key"))
            candidate_id = _graph_id("dialogue-candidate", _text(member.get("analysis_id")), selected_key, other_key)
            candidate = candidates.setdefault(candidate_id, {
                "candidate_id": candidate_id,
                "analysis_id": _text(member.get("analysis_id")),
                "interlocutor_key": other_key,
                "interlocutor_label": _text(other.get("narrative_agent_label")),
                "state": "candidate",
                "authority": "source_timed_dialogue_candidate",
                "constellational_probability": round(constellational_probability, 4),
                "probability_basis": {
                    "method": "source_timed_multimodal_dialogue_support_v1",
                    "temporal_distance_seconds": round(distance, 3),
                    "audio_bearing_modalities": audio_count,
                    "calibration": "bounded_support_probability_not_identity_authority",
                },
                "evidence_occurrence_ids": [],
                "warrant": "Confirmed identity evidence is source-time adjacent and at least one occurrence is audio-bearing.",
                "alternatives": [
                    "The agents are co-present but not speaking to each other.",
                    "The audio belongs to another speaker or is non-diegetic.",
                    "The source-time proximity crosses a dialogue boundary.",
                ],
            })
            candidate["evidence_occurrence_ids"] = sorted(set(candidate["evidence_occurrence_ids"] + [_text(member.get("occurrence_id")), _text(other.get("occurrence_id"))]))
    return list(candidates.values())


def _topic_candidates(members: Sequence[Mapping[str, Any]]) -> list[Dict[str, Any]]:
    """Raise transcript-grounded topic accounts without keyword interpretation."""
    candidates: list[Dict[str, Any]] = []
    for member in members:
        if _text(member.get("evidence_modality")) not in {"audio", "transcript_audio"}:
            continue
        transcript_text = _text(member.get("transcript_text"))
        if not transcript_text:
            continue
        occurrence_id = _text(member.get("occurrence_id"))
        candidates.append({
            "candidate_id": _graph_id("topic-candidate", _text(member.get("analysis_id")), occurrence_id),
            "analysis_id": _text(member.get("analysis_id")),
            "occurrence_id": occurrence_id,
            "source_interval": copy.deepcopy(member.get("source_interval") or {}),
            "transcript_text": transcript_text,
            "state": "candidate",
            "authority": "confirmed_speaker_transcript_candidate",
            "warrant": "The utterance text and its Narrative Agent speaker assignment are explicitly source-confirmed; the topic account remains interpretive.",
            "alternatives": [
                "The utterance is literal content but not the scene's principal topic.",
                "The utterance is ironic, quoted, indirect, or addressed outside the apparent exchange.",
                "Additional surrounding turns are required before naming the topic.",
            ],
        })
    return candidates


def _confirmed_speaker_attributions(members: Sequence[Mapping[str, Any]]) -> list[Dict[str, Any]]:
    """Project mature speaker facts from explicitly confirmed audio identity."""
    return [
        {
            "attribution_id": _graph_id("confirmed-speaker", _text(member.get("analysis_id")), _text(member.get("occurrence_id"))),
            "analysis_id": _text(member.get("analysis_id")),
            "audio_occurrence_id": _text(member.get("occurrence_id")),
            "narrative_agent_key": _text(member.get("narrative_agent_key")),
            "narrative_agent_label": _text(member.get("narrative_agent_label")),
            "source_interval": copy.deepcopy(member.get("source_interval") or {}),
            "transcript_text": _text(member.get("transcript_text")),
            "speaker_cluster_label": _text(member.get("speaker_cluster_label")),
            "state": "confirmed",
            "authority": "explicit_analyst_confirmation",
            "evidence_occurrence_ids": [_text(member.get("occurrence_id"))],
        }
        for member in members
        if _text(member.get("evidence_modality")) in {"audio", "transcript_audio"}
        and _text(member.get("authority")) == "explicit_analyst_confirmation"
    ]


def _bodily_expression_snapshot(canonical: Mapping[str, Any]) -> Dict[str, Any]:
    evidence: list[Dict[str, Any]] = []
    for member in _list(canonical.get("members")):
        for row in _list(member.get("time_aligned_bodily_evidence")):
            if isinstance(row, dict):
                evidence.append(copy.deepcopy(row))
    unique = {( _text(row.get("evidence_id")), _text(row.get("label"))): row for row in evidence}
    candidates = [
        {
            "label": _text(row.get("label")),
            "state": "candidate",
            "source_interval": copy.deepcopy(row.get("source_interval") or {}),
            "evidence_id": _text(row.get("evidence_id")),
        }
        for row in unique.values()
    ]
    return {
        "state": "candidate" if candidates else "missing",
        "claims": [],
        "candidates": candidates,
        "reason": "These analyst-confirmed bodily cues are source-time aligned with speech; their relationship to meaning remains non-causal and reviewable." if candidates else "No eligible time-aligned bodily-expression assertion is attached; temporal alignment would remain non-causal.",
    }


def _scene_presence_estimates(
    inventory: Mapping[str, Any], selected_key: str, agent_label: str
) -> list[Dict[str, Any]]:
    """Estimate scene presence from independent source occurrences.

    This is a contextual candidate metric, not identity authority.  Each row
    carries a leave-one-out probability so a candidate cannot inflate the
    scene prior later used to score that same candidate.
    """
    rows = [
        row for row in _all_occurrences(inventory).values()
        if _text(row.get("narrative_agent_key")) == selected_key and _text(row.get("scene_id"))
    ]
    grouped: Dict[tuple[str, str], list[Dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault((_text(row.get("analysis_id")), _text(row.get("scene_id"))), []).append(row)

    def contribution(row: Mapping[str, Any]) -> tuple[str, float, bool]:
        authority = _text(row.get("authority"))
        modality = _text(row.get("evidence_modality") or "visual")
        scene_anchor = _dict(row.get("scene_anchor"))
        if _text(scene_anchor.get("review_state")) == "candidate_review_required":
            return modality, 0.55, False
        if authority == "explicit_analyst_confirmation":
            return modality, 1.0, True
        scores = row.get("scores") if isinstance(row.get("scores"), dict) else {}
        numeric = [
            float(value) for value in scores.values()
            if isinstance(value, (int, float)) and 0.0 <= float(value) <= 1.0
        ]
        measured = max(numeric, default=0.5)
        reliability = {
            "visual": 0.72,
            "audio": 0.82,
            "transcript_audio": 0.78,
            "body_movement": 0.45,
            "scene_presence": 0.55,
        }.get(modality, 0.5)
        return modality, round(measured * reliability, 4), False

    def combine(evidence: Sequence[Mapping[str, Any]]) -> float:
        by_modality: Dict[str, float] = {}
        for row in evidence:
            modality, support, confirmed = contribution(row)
            if confirmed:
                return 1.0
            by_modality[modality] = max(by_modality.get(modality, 0.0), support)
        residual = 1.0
        for support in by_modality.values():
            residual *= 1.0 - support
        return round(min(0.98, 1.0 - residual), 4) if by_modality else 0.0

    estimates = []
    for (analysis_id, scene_id), evidence in sorted(grouped.items()):
        probability = combine(evidence)
        confirmed = any(contribution(row)[2] for row in evidence)
        leave_one_out = {
            _text(row.get("occurrence_id")): combine(
                [other for other in evidence if _text(other.get("occurrence_id")) != _text(row.get("occurrence_id"))]
            )
            for row in evidence
            if _text(row.get("occurrence_id"))
        }
        modalities = sorted({contribution(row)[0] for row in evidence})
        estimates.append({
            "estimate_id": _graph_id("scene-presence-estimate", analysis_id, scene_id, selected_key),
            "analysis_id": analysis_id,
            "scene_id": scene_id,
            "narrative_agent_key": selected_key,
            "narrative_agent_label": agent_label,
            "presence_probability": probability,
            "state": "confirmed" if confirmed else "candidate",
            "authority": "explicit_analyst_confirmation" if confirmed else "derived_constellational_scene_metric",
            "evidence_occurrence_ids": sorted(_text(row.get("occurrence_id")) for row in evidence),
            "independent_modalities": modalities,
            "leave_one_out_probability_by_occurrence": leave_one_out,
            "probability_basis": {
                "method": "independent_modality_noisy_or_v1",
                "duplicate_same_modality_policy": "strongest_support_only",
                "candidate_self_support_excluded_when_used_for_triangulation": True,
                "calibration": "contextual_candidate_metric_not_identity_authority",
            },
        })
    return estimates


def _speaker_attribution_candidates(
    inventory: Mapping[str, Any], members: Sequence[Mapping[str, Any]], selected_key: str
) -> list[Dict[str, Any]]:
    """Triangulate source-timed speaker candidates without inventing voice identity."""
    corridor = _dict(inventory.get("selected_continuity_corridor"))
    audio_candidates = [
        row for row in _list(corridor.get("proposed_members"))
        if isinstance(row, dict)
        and _text(row.get("narrative_agent_key")) == selected_key
        and _text(row.get("evidence_modality")) == "transcript_audio"
        and _text(row.get("authority")) == "named_audio_sample_candidate"
    ]
    mature_visuals = [
        row for row in members
        if isinstance(row, dict)
        and _text(row.get("evidence_modality") or "visual") == "visual"
        and _text(row.get("authority")) == "explicit_analyst_confirmation"
    ]

    def overlaps(left: Mapping[str, Any], right: Mapping[str, Any]) -> bool:
        if _text(left.get("analysis_id")) != _text(right.get("analysis_id")):
            return False
        left_interval, right_interval = _dict(left.get("source_interval")), _dict(right.get("source_interval"))
        try:
            return max(float(left_interval["start"]), float(right_interval["start"])) < min(
                float(left_interval["end"]), float(right_interval["end"])
            )
        except (KeyError, TypeError, ValueError):
            return False

    results = []
    for audio in audio_candidates:
        visual_support = [row for row in mature_visuals if overlaps(audio, row)]
        scores = _dict(audio.get("scores"))
        identity_cue = scores.get("identity_cue_confidence")
        synchrony = scores.get("active_speaker_probability")
        identity_cue = float(identity_cue) if isinstance(identity_cue, (int, float)) else 0.0
        synchrony = float(synchrony) if isinstance(synchrony, (int, float)) else 0.0
        probability = min(
            0.94,
            0.15 + (0.25 * identity_cue) + (0.35 if visual_support else 0.0) + (0.20 * synchrony),
        )
        occurrence_id = _text(audio.get("occurrence_id"))
        results.append({
            "candidate_id": _graph_id("speaker-attribution", _text(audio.get("analysis_id")), occurrence_id, selected_key),
            "analysis_id": _text(audio.get("analysis_id")),
            "audio_occurrence_id": occurrence_id,
            "narrative_agent_key": selected_key,
            "narrative_agent_label": _text(audio.get("narrative_agent_label")),
            "source_interval": copy.deepcopy(audio.get("source_interval") or {}),
            "transcript_text": _text(audio.get("transcript_text")),
            "state": "candidate",
            "authority": "constellational_speaker_attribution_candidate",
            "constellational_probability": round(probability, 4),
            "evidence_occurrence_ids": [occurrence_id] + [_text(row.get("occurrence_id")) for row in visual_support],
            "probability_basis": {
                "method": "bounded_audio_visual_synchrony_triangulation_v1",
                "named_audio_identity_cue": round(identity_cue, 4),
                "mature_visual_presence_overlap": bool(visual_support),
                "mature_visual_support_count": len(visual_support),
                "active_speaker_synchrony_probability": round(synchrony, 4) if synchrony else None,
                "voice_identity_comparison_present": False,
                "calibration": "review_candidate_not_identity_authority",
            },
            "warrant": "A named source-timed audio candidate is triangulated with mature visual presence and measured active-speaker synchrony where available.",
            "alternatives": [
                "The visible agent is present but another person is speaking.",
                "Mouth motion is coincidental, dubbed, or insufficiently sampled.",
                "The named audio cue is not a measured voice-identity match.",
            ],
        })
    return results


def _interval_recurrence_and_role_hypotheses(
    inventory: Mapping[str, Any], selected_key: str, agent_label: str, confirmed_roles: Sequence[str]
) -> Dict[str, Any]:
    """Build descriptive recurrence metrics and reviewable role deductions."""
    all_rows = list(_all_occurrences(inventory).values())
    selected_rows = [row for row in all_rows if _text(row.get("narrative_agent_key")) == selected_key]

    def union_duration(rows: Sequence[Mapping[str, Any]]) -> float:
        intervals = []
        for row in rows:
            interval = row.get("source_interval") if isinstance(row.get("source_interval"), dict) else {}
            try:
                start = float(interval.get("start"))
                end = float(interval.get("end"))
            except (TypeError, ValueError):
                continue
            intervals.append((start, max(start, end)))
        merged = []
        for start, end in sorted(intervals):
            if merged and start <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
            else:
                merged.append((start, end))
        return round(sum(end - start for start, end in merged), 3)

    all_scenes = {_text(row.get("scene_id")) for row in all_rows if _text(row.get("scene_id"))}
    selected_scenes = {_text(row.get("scene_id")) for row in selected_rows if _text(row.get("scene_id"))}
    selected_modalities = {_text(row.get("evidence_modality") or "visual") for row in selected_rows}
    occurrence_share = len(selected_rows) / len(all_rows) if all_rows else 0.0
    scene_coverage = len(selected_scenes) / len(all_scenes) if all_scenes else 0.0
    confirmed_count = sum(_text(row.get("authority")) == "explicit_analyst_confirmation" for row in selected_rows)
    per_analysis: Dict[str, Dict[str, Any]] = {}
    for analysis_id in sorted({_text(row.get("analysis_id")) for row in selected_rows}):
        rows = [row for row in selected_rows if _text(row.get("analysis_id")) == analysis_id]
        starts = []
        for row in rows:
            interval = row.get("source_interval") if isinstance(row.get("source_interval"), dict) else {}
            try:
                starts.append(float(interval.get("start")))
            except (TypeError, ValueError):
                pass
        per_analysis[analysis_id] = {
            "occurrence_count": len(rows),
            "interval_union_seconds": union_duration(rows),
            "first_occurrence_seconds": min(starts) if starts else None,
            "last_occurrence_seconds": max(starts) if starts else None,
            "scene_count": len({_text(row.get("scene_id")) for row in rows if _text(row.get("scene_id"))}),
        }

    recurrence_strength = min(1.0, max(0, len(selected_rows) - 1) / 5.0)
    modality_strength = min(1.0, len(selected_modalities) / 3.0)
    leading_probability = round(min(0.96, 0.18 + occurrence_share * 0.30 + scene_coverage * 0.22 + recurrence_strength * 0.18 + modality_strength * 0.08), 4)
    persistence = sum(1 for row in per_analysis.values() if row["occurrence_count"] >= 2) / max(1, len(per_analysis))
    protagonist_probability = round(min(0.94, leading_probability * 0.72 + persistence * 0.18 + (0.06 if confirmed_count else 0.0)), 4)
    confirmed_keys = {_text(role).casefold() for role in confirmed_roles}

    def hypothesis(role: str, probability: float, warrant: str) -> Dict[str, Any]:
        confirmed = role.casefold() in confirmed_keys
        return {
            "role": role,
            "probability": 1.0 if confirmed else probability,
            "state": "confirmed" if confirmed else "candidate",
            "authority": "explicit_source_media_metadata_confirmation" if confirmed else "occurrence_metric_deduction",
            "warrant": "Analyst-confirmed Source Media metadata assigns this role." if confirmed else warrant,
            "alternatives": [] if confirmed else [
                "High recurrence reflects trailer editing or sampling density rather than narrative centrality.",
                "Another Narrative Agent may dominate unsampled or missing scenes.",
            ],
        }

    hypotheses = [
        hypothesis("leading character", leading_probability, "Occurrence share, scene coverage, recurrence and modality diversity support a leading-character hypothesis."),
        hypothesis("protagonist", protagonist_probability, "Repeated source intervals and persistence across the analyzed artifact support a protagonist hypothesis; goals and focalization remain interpretive."),
    ]
    structures = []
    if len(selected_rows) >= 2:
        structures.append({"structure": "recurring_presence", "state": "candidate", "support": round(recurrence_strength, 4)})
    if len(selected_scenes) >= 2:
        structures.append({"structure": "cross_scene_return", "state": "candidate", "support": round(min(0.95, 0.45 + len(selected_scenes) * 0.08), 4)})
    if len(selected_modalities) >= 2:
        structures.append({"structure": "multimodal_agent_continuity", "state": "candidate", "support": round(modality_strength, 4)})
    return {
        "schema": "vaa1.narrative_agent_interval_recurrence_metrics.v1",
        "narrative_agent_key": selected_key,
        "narrative_agent_label": agent_label,
        "metrics": {
            "occurrence_count": len(selected_rows),
            "confirmed_occurrence_count": confirmed_count,
            "candidate_occurrence_count": max(0, len(selected_rows) - confirmed_count),
            "occurrence_share": round(occurrence_share, 4),
            "scene_count": len(selected_scenes),
            "scene_coverage": round(scene_coverage, 4),
            "modality_count": len(selected_modalities),
            "modalities": sorted(selected_modalities),
            "interval_union_seconds": union_duration(selected_rows),
            "per_analysis": per_analysis,
        },
        "role_hypotheses": hypotheses,
        "narrative_structure_hypotheses": structures,
        "withheld_hypotheses": [{
            "role": "antagonist",
            "reason": "Occurrence volume cannot establish opposition; governed conflict, obstruction or incompatible-goal relations are required.",
        }],
        "governance": {
            "descriptive_metrics_may_proliferate_automatically": True,
            "unconfirmed_roles_remain_reviewable_interpretations": True,
            "confirmed_metadata_roles_are_mature": True,
        },
    }


def _build_graph_and_snapshot(
    canonical: Mapping[str, Any], revision: str
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    """Build shared graph tickets and an evidence-honest constellation.

    Direct source/identity relations inherit explicit analyst authority. Any
    downstream narrative relation remains a candidate until separately decided.
    """
    project_id = _text(canonical.get("project_id"))
    collection_id = _text(canonical.get("collection_id"))
    agent_key = _text(canonical.get("narrative_agent_key"))
    agent_label = _text(canonical.get("narrative_agent_label"))
    agent_node_id = _graph_id("agent", project_id, agent_key)
    nodes: list[Dict[str, Any]] = [
        {
            "node_id": agent_node_id,
            "node_type": "narrative_agent",
            "label": agent_label,
            "maturity": {
                "level": "mature",
                "authority": _text(canonical.get("authority")),
            },
            "evidence_refs": [],
        }
    ]
    edges: list[Dict[str, Any]] = []
    relation_tickets: list[Dict[str, Any]] = []
    source_occurrences: list[Dict[str, Any]] = []
    scene_ids: set[str] = set()
    candidate_scene_ids: set[str] = set()
    relation_decisions = canonical.get("relation_decisions") if isinstance(canonical.get("relation_decisions"), dict) else {}

    def add_edge(
        source_node_id: str,
        target_node_id: str,
        edge_type: str,
        *,
        state: str,
        authority: str,
        evidence_refs: list[Dict[str, Any]],
        warrant: str,
        alternatives: list[str],
    ) -> None:
        edge_id = _graph_id("edge", project_id, source_node_id, edge_type, target_node_id)
        relation_decision = relation_decisions.get(edge_id) if isinstance(relation_decisions.get(edge_id), dict) else None
        effective_state = _text(relation_decision.get("value")) if relation_decision else state
        effective_authority = _text(relation_decision.get("authority")) if relation_decision else authority
        edge = {
            "edge_id": edge_id,
            "source_node_id": source_node_id,
            "target_node_id": target_node_id,
            "edge_type": edge_type,
            "maturity": {"level": effective_state, "authority": effective_authority},
            "evidence_refs": copy.deepcopy(evidence_refs),
            "ui": {
                "annotation_sheet_enabled": True,
                "update_enabled": True,
                "source_navigation_enabled": True,
            },
        }
        edges.append(edge)
        allowed_decisions = ["revise", "reject"] if effective_state in {"mature", "confirmed"} else ["confirm", "revise", "reject", "defer"]
        relation_tickets.append(
            {
                "ticket_id": _graph_id("relation-ticket", edge_id),
                "edge_id": edge_id,
                "assertion_id": _graph_id("assertion", edge_id),
                "subject_node_id": source_node_id,
                "predicate": edge_type,
                "object_node_id": target_node_id,
                "state": effective_state,
                "authority": effective_authority,
                "editable": True,
                "allowed_decisions": allowed_decisions,
                "warrant": warrant,
                "alternatives": alternatives,
                "uncertainty": "none" if state == "mature" else "analyst_review_required",
                "analyst_meaning": _text(relation_decision.get("analyst_meaning")) if relation_decision else "",
                "decision_id": _text(relation_decision.get("decision_id")) if relation_decision else "",
                "evidence_refs": copy.deepcopy(evidence_refs),
                "source_navigation": (
                    {
                        "analysis_id": _text(evidence_refs[0].get("analysis_id")),
                        "source_interval": copy.deepcopy(evidence_refs[0].get("time_range") or {}),
                        "return_panel": "narrative_agent",
                        "return_ticket_id": _graph_id("relation-ticket", edge_id),
                        "preserve_review_position": True,
                    }
                    if evidence_refs
                    else None
                ),
                "counter_evidence_refs": [],
                "dependency_revision": revision,
                "traceback_refs": list(canonical.get("traceback_refs") or []),
            }
        )

    confirmed_roles = [_text(role) for role in _list(canonical.get("confirmed_roles")) if _text(role)]
    confirmed_role_authority = _text(canonical.get("role_authority")) or "explicit_analyst_role_confirmation"
    for role in confirmed_roles:
        role_node_id = _graph_id("narrative-role", project_id, agent_key, role.casefold())
        nodes.append({
            "node_id": role_node_id,
            "node_type": "narrative_role",
            "label": role,
            "maturity": {"level": "mature", "authority": confirmed_role_authority},
            "evidence_refs": [],
        })
        add_edge(
            agent_node_id,
            role_node_id,
            "has_narrative_role",
            state="mature",
            authority=confirmed_role_authority,
            evidence_refs=[],
            warrant="An explicit analyst confirmation assigns this Narrative Agent role.",
            alternatives=[],
        )
    for hypothesis in _list(_dict(canonical.get("interval_recurrence")).get("role_hypotheses")):
        if not isinstance(hypothesis, dict) or _text(hypothesis.get("state")) == "confirmed":
            continue
        role = _text(hypothesis.get("role"))
        role_node_id = _graph_id("narrative-role-hypothesis", project_id, agent_key, role.casefold())
        nodes.append({
            "node_id": role_node_id,
            "node_type": "narrative_role_hypothesis",
            "label": role,
            "attributes": {"probability": hypothesis.get("probability")},
            "maturity": {"level": "candidate", "authority": "occurrence_metric_deduction"},
            "evidence_refs": [],
        })
        add_edge(
            agent_node_id, role_node_id, "may_have_narrative_role",
            state="candidate", authority="occurrence_metric_deduction", evidence_refs=[],
            warrant=_text(hypothesis.get("warrant")),
            alternatives=[_text(value) for value in _list(hypothesis.get("alternatives"))],
        )

    for member in _list(canonical.get("members")):
        occurrence_id = _text(member.get("occurrence_id"))
        interval = member.get("source_interval") if isinstance(member.get("source_interval"), dict) else {}
        evidence_ref = {
            "evidence_id": occurrence_id,
            "analysis_id": _text(member.get("analysis_id")),
            "source_type": _text(member.get("evidence_modality") or "visual"),
            "time_range": {
                "start": interval.get("start"),
                "end": interval.get("end"),
            },
            "traceback_record_id": next(
                iter(_list(member.get("traceback_refs"))), occurrence_id
            ),
        }
        occurrence_node_id = _graph_id("occurrence", project_id, occurrence_id)
        beat_node_id = _graph_id(
            "narrative-beat",
            project_id,
            _text(member.get("analysis_id")),
            interval.get("start"),
            interval.get("end"),
        )
        nodes.extend(
            [
                {
                    "node_id": occurrence_node_id,
                    "node_type": "source_occurrence",
                    "label": f"{agent_label} {_text(member.get('evidence_modality') or 'source')} occurrence",
                    "attributes": {
                        "occurrence_id": occurrence_id,
                        "analysis_id": _text(member.get("analysis_id")),
                        "source_interval": copy.deepcopy(interval),
                    },
                    "maturity": {"level": "mature", "authority": _text(member.get("authority"))},
                    "evidence_refs": [copy.deepcopy(evidence_ref)],
                },
                {
                    "node_id": beat_node_id,
                    "node_type": "narrative_beat",
                    "label": f"Narrative beat {interval.get('start')}–{interval.get('end')}",
                    "attributes": {
                        "analysis_id": _text(member.get("analysis_id")),
                        "source_interval": copy.deepcopy(interval),
                    },
                    "maturity": {"level": "candidate", "authority": "derived_source_boundary"},
                    "evidence_refs": [copy.deepcopy(evidence_ref)],
                },
            ]
        )
        add_edge(
            occurrence_node_id,
            agent_node_id,
            "evidence_of_identity",
            state="mature",
            authority="explicit_analyst_confirmation",
            evidence_refs=[evidence_ref],
            warrant="The source occurrence was explicitly confirmed as this Narrative Agent.",
            alternatives=[],
        )
        add_edge(
            occurrence_node_id,
            beat_node_id,
            "occurs_during",
            state="mature",
            authority="explicit_analyst_confirmation",
            evidence_refs=[evidence_ref],
            warrant="The confirmed source interval defines this bounded beat anchor.",
            alternatives=[],
        )
        add_edge(
            agent_node_id,
            beat_node_id,
            "participates_in",
            state="mature",
            authority="entailed_by_mature_source_presence",
            evidence_refs=[evidence_ref],
            warrant=(
                f"The mature {_text(member.get('evidence_modality') or 'source')} occurrence "
                "directly entails that this Narrative Agent participates in its bounded source beat."
            ),
            alternatives=[],
        )
        scene_id = _text(member.get("scene_id"))
        if scene_id and scene_id not in scene_ids:
            scene_ids.add(scene_id)
            scene_anchor = _dict(member.get("scene_anchor"))
            scene_is_candidate = _text(scene_anchor.get("review_state")) == "candidate_review_required"
            if scene_is_candidate:
                candidate_scene_ids.add(scene_id)
            scene_node_id = _graph_id("scene", project_id, _text(member.get("analysis_id")), scene_id)
            nodes.append(
                {
                    "node_id": scene_node_id,
                    "node_type": "scene_situation",
                    "label": scene_id,
                    "attributes": {"scene_id": scene_id, "analysis_id": _text(member.get("analysis_id"))},
                    "maturity": {"level": "candidate" if scene_is_candidate else "confirmed", "authority": _text(scene_anchor.get("authority")) or "source_scene_anchor"},
                    "evidence_refs": [copy.deepcopy(evidence_ref)],
                }
            )
            add_edge(
                occurrence_node_id,
                scene_node_id,
                "situated_in",
                state="candidate" if scene_is_candidate else "mature",
                authority=_text(scene_anchor.get("authority")) or "explicit_analyst_confirmation",
                evidence_refs=[evidence_ref],
                warrant="The confirmed occurrence overlaps this governed scene interval.",
                alternatives=["The synthesized scene boundary requires analyst revision."] if scene_is_candidate else [],
            )
        source_occurrences.append(copy.deepcopy(evidence_ref))

    dialogue_claims = []
    for candidate in _list(canonical.get("dialogue_candidates")):
        other_key = _text(candidate.get("interlocutor_key"))
        other_label = _text(candidate.get("interlocutor_label"))
        other_node_id = _graph_id("agent", project_id, other_key)
        if not any(_text(node.get("node_id")) == other_node_id for node in nodes):
            nodes.append({
                "node_id": other_node_id,
                "node_type": "narrative_agent",
                "label": other_label,
                "maturity": {"level": "mature", "authority": "explicit_analyst_confirmation"},
                "evidence_refs": [],
            })
        evidence_refs = [
            ref for ref in source_occurrences
            if _text(ref.get("evidence_id")) in set(_list(candidate.get("evidence_occurrence_ids")))
        ]
        add_edge(
            agent_node_id,
            other_node_id,
            "dialogue_with",
            state="candidate",
            authority="source_timed_dialogue_candidate",
            evidence_refs=evidence_refs,
            warrant=_text(candidate.get("warrant")),
            alternatives=[_text(item) for item in _list(candidate.get("alternatives"))],
        )
        dialogue_claims.append({
            "label": other_label,
            "probability": candidate.get("constellational_probability"),
            "probability_basis": copy.deepcopy(candidate.get("probability_basis") or {}),
        })

    topic_claims = []
    for candidate in _list(canonical.get("topic_candidates")):
        occurrence_id = _text(candidate.get("occurrence_id"))
        transcript_text = _text(candidate.get("transcript_text"))
        topic_node_id = _graph_id("dialogue-topic", project_id, _text(candidate.get("candidate_id")))
        nodes.append({
            "node_id": topic_node_id,
            "node_type": "dialogue_topic_candidate",
            "label": transcript_text,
            "attributes": {
                "analysis_id": _text(candidate.get("analysis_id")),
                "source_interval": copy.deepcopy(candidate.get("source_interval") or {}),
                "verbatim_source_text": transcript_text,
            },
            "maturity": {"level": "candidate", "authority": "confirmed_speaker_transcript_candidate"},
            "evidence_refs": [],
        })
        evidence_refs = [ref for ref in source_occurrences if _text(ref.get("evidence_id")) == occurrence_id]
        add_edge(
            agent_node_id,
            topic_node_id,
            "speaks_about",
            state="candidate",
            authority="confirmed_speaker_transcript_candidate",
            evidence_refs=evidence_refs,
            warrant=_text(candidate.get("warrant")),
            alternatives=[_text(item) for item in _list(candidate.get("alternatives"))],
        )
        topic_claims.append(transcript_text)

    confirmed_speaker_claims = []
    for attribution in _list(canonical.get("confirmed_speaker_attributions")):
        interval = _dict(attribution.get("source_interval"))
        occurrence_id = _text(attribution.get("audio_occurrence_id"))
        utterance_node_id = _graph_id("confirmed-utterance", project_id, occurrence_id)
        evidence_refs = [ref for ref in source_occurrences if _text(ref.get("evidence_id")) == occurrence_id]
        nodes.append({
            "node_id": utterance_node_id,
            "node_type": "confirmed_utterance",
            "label": _text(attribution.get("transcript_text")) or f"Confirmed utterance {interval.get('start')}–{interval.get('end')}",
            "attributes": {"analysis_id": _text(attribution.get("analysis_id")), "source_interval": copy.deepcopy(interval)},
            "maturity": {"level": "mature", "authority": "explicit_analyst_confirmation"},
            "evidence_refs": copy.deepcopy(evidence_refs),
        })
        add_edge(
            utterance_node_id, agent_node_id, "spoken_by", state="mature",
            authority="explicit_analyst_confirmation", evidence_refs=evidence_refs,
            warrant="The analyst explicitly confirmed this bounded audio occurrence as the Narrative Agent.",
            alternatives=[],
        )
        confirmed_speaker_claims.append({
            "label": _text(attribution.get("narrative_agent_label")),
            "transcript_text": _text(attribution.get("transcript_text")),
            "source_interval": copy.deepcopy(interval),
            "state": "confirmed",
        })

    speaker_claims = []
    for candidate in _list(canonical.get("speaker_attribution_candidates")):
        interval = _dict(candidate.get("source_interval"))
        candidate_id = _text(candidate.get("candidate_id"))
        utterance_node_id = _graph_id("utterance-candidate", project_id, candidate_id)
        evidence_refs = [{
            "evidence_id": _text(candidate.get("audio_occurrence_id")),
            "analysis_id": _text(candidate.get("analysis_id")),
            "source_type": "transcript_audio",
            "time_range": {"start": interval.get("start"), "end": interval.get("end")},
            "traceback_record_id": _text(candidate.get("audio_occurrence_id")),
        }]
        nodes.append({
            "node_id": utterance_node_id,
            "node_type": "utterance_candidate",
            "label": _text(candidate.get("transcript_text")) or f"Utterance {interval.get('start')}–{interval.get('end')}",
            "attributes": {
                "analysis_id": _text(candidate.get("analysis_id")),
                "source_interval": copy.deepcopy(interval),
                "constellational_probability": candidate.get("constellational_probability"),
                "probability_basis": copy.deepcopy(candidate.get("probability_basis") or {}),
            },
            "maturity": {"level": "candidate", "authority": "constellational_speaker_attribution_candidate"},
            "evidence_refs": copy.deepcopy(evidence_refs),
        })
        add_edge(
            utterance_node_id,
            agent_node_id,
            "spoken_by",
            state="candidate",
            authority="constellational_speaker_attribution_candidate",
            evidence_refs=evidence_refs,
            warrant=_text(candidate.get("warrant")),
            alternatives=[_text(item) for item in _list(candidate.get("alternatives"))],
        )
        speaker_claims.append({
            "candidate_id": candidate_id,
            "audio_occurrence_id": _text(candidate.get("audio_occurrence_id")),
            "label": _text(candidate.get("narrative_agent_label")),
            "transcript_text": _text(candidate.get("transcript_text")),
            "source_interval": copy.deepcopy(interval),
            "probability": candidate.get("constellational_probability"),
            "probability_basis": copy.deepcopy(candidate.get("probability_basis") or {}),
        })

    graph_projection = {
        "schema": "vaa1.stage7.shared_interpretation_graph.v1",
        "project_id": project_id,
        "collection_id": collection_id,
        "revision": revision,
        "nodes": nodes,
        "edges": edges,
        "relation_tickets": relation_tickets,
        "projection_targets": ["meaning_knowledge_graph", "narrative_agent_graph"],
        "one_canonical_relation_ticket_for_both_graphs": True,
    }
    has_scene = bool(scene_ids)
    all_scenes_confirmed = has_scene and not candidate_scene_ids
    scene_presence_estimates = _list(canonical.get("scene_presence_estimates"))
    snapshot = {
        "schema": "vaa1.constellational_snapshot.v1",
        "snapshot_id": _graph_id("constellation", project_id, collection_id, revision),
        "project_id": project_id,
        "collection_id": collection_id,
        "revision": revision,
        "source_occurrences": source_occurrences,
        "layers": {
            "who_is_present": {
                "state": "confirmed" if source_occurrences else "missing",
                "claims": [agent_label] if source_occurrences else [],
                "evidence_refs": copy.deepcopy(source_occurrences),
                "scene_presence_estimates": copy.deepcopy(scene_presence_estimates),
                "candidates": [
                    {
                        "label": f"{agent_label} in {_text(estimate.get('scene_id'))}",
                        "probability": estimate.get("presence_probability"),
                        "probability_basis": copy.deepcopy(estimate.get("probability_basis") or {}),
                        "state": estimate.get("state"),
                    }
                    for estimate in scene_presence_estimates
                    if isinstance(estimate, dict)
                ],
            },
            "who_is_in_dialogue": {
                "state": "candidate" if dialogue_claims else "missing",
                "claims": sorted({_text(item.get("label")) for item in dialogue_claims if _text(item.get("label"))}),
                "candidates": dialogue_claims,
                "reason": "Source-timed audio proximity requires analyst confirmation; co-presence alone is insufficient." if dialogue_claims else "A confirmed occurrence alone does not establish a dialogue partner or addressee.",
            },
            "who_is_speaking": {
                "state": "confirmed" if confirmed_speaker_claims else "candidate" if speaker_claims else "missing",
                "claims": sorted({_text(item.get("label")) for item in confirmed_speaker_claims if _text(item.get("label"))}),
                "confirmed_occurrences": confirmed_speaker_claims,
                "candidates": speaker_claims,
                "reason": "The bounded audio identity was explicitly confirmed by the analyst." if confirmed_speaker_claims else "Audio, mature visual presence, and measured lip synchrony are triangulated for analyst review." if speaker_claims else "No eligible named, source-timed audio candidate is available.",
            },
            "what_they_are_talking_about": {
                "state": "candidate" if topic_claims else "missing",
                "claims": topic_claims,
                "reason": "Confirmed speaker transcript supports review, but the topic account requires its own analyst decision." if topic_claims else "No governed transcript proposition or topic decision is attached to this continuity projection.",
            },
            "scenic_and_situational_context": {
                "state": "confirmed" if all_scenes_confirmed else "candidate" if has_scene else "missing",
                "claims": sorted(scene_ids),
                "reason": "The source occurrence overlaps a Master Schema scene candidate; the scene interpretation remains reviewable." if candidate_scene_ids else None if has_scene else "No governed scene anchor is attached to the occurrence.",
            },
            "bodily_expression_in_relation_to_speech": _bodily_expression_snapshot(canonical),
            "narrative_roles": {
                "state": "confirmed" if confirmed_roles else "missing",
                "claims": confirmed_roles,
                "probability": 1.0 if confirmed_roles else None,
                "authority": confirmed_role_authority if confirmed_roles else None,
                "reason": None if confirmed_roles else "No analyst-confirmed Source Media Narrative Agent role is available.",
            },
            "narrative_role_hypotheses": {
                "state": "candidate" if _list(_dict(canonical.get("interval_recurrence")).get("role_hypotheses")) else "missing",
                "claims": [],
                "candidates": [
                    {"label": item.get("role"), "probability": item.get("probability"), "state": item.get("state")}
                    for item in _list(_dict(canonical.get("interval_recurrence")).get("role_hypotheses"))
                    if isinstance(item, dict)
                ],
                "withheld": copy.deepcopy(_dict(canonical.get("interval_recurrence")).get("withheld_hypotheses") or []),
            },
        },
        "policy": {
            "missing_layers_are_not_filled_with_generated_prose": True,
            "temporal_alignment_does_not_imply_cause_intention_or_emotion": True,
            "mature_presence_entails_participation_without_duplicate_confirmation": True,
            "semantic_dialogue_topic_and_intent_relations_require_review": True,
        },
    }
    return graph_projection, snapshot


def build_continuity_projection_envelope(
    inventory: Mapping[str, Any],
    ledger: Mapping[str, Any],
    *,
    project_id: str,
    collection_id: str,
) -> Dict[str, Any]:
    """Project one accepted collection identically to every named consumer."""
    if _text(inventory.get("project_id")) != project_id:
        raise ValueError("Continuity projection project boundary mismatch")
    projection = project_continuity_decisions(
        ledger, project_id=project_id, collection_id=collection_id
    )
    occurrences = _all_occurrences(inventory)
    selected_corridor = inventory.get("selected_continuity_corridor") if isinstance(inventory.get("selected_continuity_corridor"), dict) else {}
    auto_mature_ids = {
        _text(row.get("occurrence_id"))
        for row in _list(selected_corridor.get("confirmed_members"))
        if isinstance(row, dict) and _text(row.get("authority")) == "explicit_analyst_confirmation"
    }
    excluded_or_deferred = set(projection["excluded_occurrence_ids"]) | set(projection["deferred_occurrence_ids"])
    # Explicit user confirmation is itself the canonical acceptance act. The
    # continuity ledger may correct it later, but must never require the user to
    # confirm the same source occurrence a second time.
    member_ids = sorted((auto_mature_ids | set(projection["included_occurrence_ids"])) - excluded_or_deferred)
    missing_ids = [occurrence_id for occurrence_id in member_ids if occurrence_id not in occurrences]
    if missing_ids:
        raise ValueError("Continuity projection references occurrences absent from the inventory")
    members = [occurrences[occurrence_id] for occurrence_id in member_ids]
    selected = inventory.get("selected_agent") if isinstance(inventory.get("selected_agent"), dict) else {}
    selected_key = _text(selected.get("narrative_agent_key"))
    if any(_text(member.get("narrative_agent_key")) != selected_key for member in members):
        raise ValueError("Continuity member belongs to another Narrative Agent")
    blocking = _blocking_diagnostics(inventory, selected_key)
    confirmation = projection.get("collection_confirmation")
    all_members_explicit = bool(members) and all(
        _text(member.get("authority")) == "explicit_analyst_confirmation"
        for member in members
    )
    resolved = []
    if all_members_explicit:
        # Explicit user confirmation is the mature authority. Diagnostics stay
        # traceable, but they cannot demote or block confirmed Master Schema
        # data. A later user correction supersedes the confirmation.
        resolved = copy.deepcopy(blocking)
        blocking = []
    accepted = bool(members) and not blocking and (all_members_explicit or bool(confirmation))
    maturity = "mature_governed_agent_track" if accepted else "membership_review"
    authority = "explicit_analyst_confirmation" if accepted else "candidate_collection"
    traceback_refs = sorted(
        {
            ref
            for member in members
            for ref in [
                _text(member.get("occurrence_id")),
                *[_text(item) for item in _list(member.get("traceback_refs"))],
            ]
            if ref
        }
        | set(projection["active_decision_ids"])
    )
    canonical = {
        "collection_id": collection_id,
        "project_id": project_id,
        "narrative_agent_key": selected_key,
        "narrative_agent_label": _text(selected.get("narrative_agent_label")),
        "confirmed_roles": copy.deepcopy(selected.get("confirmed_roles") or []),
        "role_authority": _text(selected.get("role_authority")),
        "role_probability": selected.get("role_probability"),
        "member_occurrence_ids": member_ids,
        "automatic_mature_occurrence_ids": sorted(auto_mature_ids - excluded_or_deferred),
        "members": members,
        "excluded_occurrence_ids": projection["excluded_occurrence_ids"],
        "deferred_occurrence_ids": projection["deferred_occurrence_ids"],
        "authority": authority,
        "maturity": maturity,
        "continuity_claim": "accepted" if accepted else "not_accepted",
        "blocking_diagnostics": blocking,
        "resolved_diagnostics": resolved,
        "traceback_refs": traceback_refs,
        "relation_decisions": copy.deepcopy(projection.get("relation_decisions") or {}),
    }
    canonical["dialogue_candidates"] = _dialogue_candidates(inventory, members, selected_key)
    canonical["topic_candidates"] = _topic_candidates(members)
    canonical["confirmed_speaker_attributions"] = _confirmed_speaker_attributions(members)
    canonical["speaker_attribution_candidates"] = _speaker_attribution_candidates(inventory, members, selected_key)
    canonical["scene_presence_estimates"] = _scene_presence_estimates(
        inventory,
        selected_key,
        _text(selected.get("narrative_agent_label")),
    )
    canonical["interval_recurrence"] = _interval_recurrence_and_role_hypotheses(
        inventory,
        selected_key,
        _text(selected.get("narrative_agent_label")),
        canonical["confirmed_roles"],
    )
    audio_matching = copy.deepcopy(inventory.get("audio_sample_matching") or {})
    audio_decisions = projection.get("audio_match_decisions") or {}
    for candidate in _list(audio_matching.get("suggestions")):
        decision = audio_decisions.get(_text(candidate.get("candidate_id")))
        candidate["decision_state"] = _text(decision.get("value")) if isinstance(decision, dict) else "unreviewed"
        candidate["decision_id"] = _text(decision.get("decision_id")) if isinstance(decision, dict) else ""
        if candidate["decision_state"] == "confirmed":
            candidate["maturity"] = "mature"
            candidate["authority"] = "explicit_user_confirmation"
    canonical["audio_sample_matching"] = audio_matching
    revision_input = {
        "inventory_fingerprint": _text(inventory.get("inventory_fingerprint")),
        "collection": canonical,
        "decision_ids": projection["active_decision_ids"],
    }
    revision = hashlib.sha256(
        json.dumps(revision_input, sort_keys=True).encode("utf-8")
    ).hexdigest()
    canonical["revision"] = revision
    canonical["measurement_eligibility"] = {
        "eligible": accepted,
        "reason": "accepted_governed_continuity" if accepted else "continuity_not_mature",
        "denominator": len(members),
    }
    graph_projection, constellational_snapshot = _build_graph_and_snapshot(canonical, revision)
    consumer_views = {
        consumer: {
            "consumer": consumer,
            "schema": "vaa1.narrative_agent_continuity_consumer_view.v1",
            "project_id": project_id,
            "collection_id": collection_id,
            "revision": revision,
            "authority": authority,
            "maturity": maturity,
            "continuity_claim": canonical["continuity_claim"],
            "member_occurrence_ids": list(member_ids),
            "source_navigation": [
                {
                    "occurrence_id": member["occurrence_id"],
                    "analysis_id": member["analysis_id"],
                    "source_interval": copy.deepcopy(member.get("source_interval")),
                    "source_geometry": copy.deepcopy(member.get("source_geometry")),
                    "evidence_modality": _text(member.get("evidence_modality") or "visual"),
                }
                for member in members
            ],
            "traceback_refs": list(traceback_refs),
            "blocking_diagnostics": copy.deepcopy(blocking),
            "resolved_diagnostics": copy.deepcopy(resolved),
            "graph_projection": copy.deepcopy(graph_projection)
            if consumer in {"narrative_agent", "meaning_plot"}
            else None,
            "constellational_snapshot": copy.deepcopy(constellational_snapshot)
            if consumer in {"narrative_agent", "meaning_plot", "master_schema", "traceback"}
            else None,
        }
        for consumer in CONSUMERS
    }
    return {
        "schema": SCHEMA,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "revision": revision,
        "canonical_collection": canonical,
        "audio_sample_matching": audio_matching,
        "consumer_views": consumer_views,
        "graph_projection": graph_projection,
        "constellational_snapshot": constellational_snapshot,
        "projection_policy": {
            "one_canonical_revision_for_all_consumers": True,
            "explicit_user_confirmation_is_immediately_mature": True,
            "rejected_and_deferred_occurrences_are_not_mature_members": True,
            "raw_tracking_cannot_establish_membership": True,
            "missing_consumer_must_report_stale_or_retry": True,
        },
    }


def build_multi_agent_projection_matrix(
    corridors: Sequence[Mapping[str, Any]], *, project_id: str
) -> Dict[str, Any]:
    """Assemble verified agent envelopes without cross-agent membership bleed."""
    envelopes: Dict[str, Dict[str, Any]] = {}
    member_owner: Dict[str, str] = {}
    conflicts: list[Dict[str, str]] = []
    for corridor in corridors:
        inventory = corridor.get("inventory")
        ledger = corridor.get("decision_ledger")
        collection_id = _text(corridor.get("collection_id"))
        if not isinstance(inventory, dict) or not isinstance(ledger, dict) or not collection_id:
            raise ValueError("Every continuity corridor requires inventory, decision ledger, and collection_id")
        envelope = build_continuity_projection_envelope(
            inventory,
            ledger,
            project_id=project_id,
            collection_id=collection_id,
        )
        agent_key = _text(envelope["canonical_collection"].get("narrative_agent_key"))
        if not agent_key:
            raise ValueError("Every continuity corridor requires a Narrative Agent key")
        if agent_key in envelopes:
            raise ValueError("Duplicate Narrative Agent corridor")
        for occurrence_id in envelope["canonical_collection"]["member_occurrence_ids"]:
            prior = member_owner.get(occurrence_id)
            if prior and prior != agent_key:
                conflicts.append(
                    {
                        "occurrence_id": occurrence_id,
                        "first_agent_key": prior,
                        "second_agent_key": agent_key,
                    }
                )
            else:
                member_owner[occurrence_id] = agent_key
        envelopes[agent_key] = envelope
    if conflicts:
        raise ValueError("One occurrence cannot be a mature member of multiple Narrative Agent corridors")
    matrix_fingerprint = hashlib.sha256(
        json.dumps(
            {
                "project_id": project_id,
                "revisions": {
                    key: envelope["revision"] for key, envelope in sorted(envelopes.items())
                },
            },
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()
    return {
        "schema": "vaa1.narrative_agent_continuity_projection_matrix.v1",
        "project_id": project_id,
        "matrix_revision": matrix_fingerprint,
        "agent_corridors": envelopes,
        "summary": {
            "agent_count": len(envelopes),
            "accepted_agent_count": sum(
                envelope["canonical_collection"]["continuity_claim"] == "accepted"
                for envelope in envelopes.values()
            ),
            "unique_member_occurrence_count": len(member_owner),
        },
        "governance": {
            "cross_agent_occurrence_membership_forbidden": True,
            "shared_raw_track_does_not_merge_agents": True,
            "project_boundary_is_hermetic": True,
        },
    }
