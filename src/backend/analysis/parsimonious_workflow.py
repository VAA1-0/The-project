"""Economical Quick Sweep -> Science Sweep workflow planning for Datascene.

This module plans work; it does not invent analytical truth.  Compatible results
are reused, manual decisions remain authoritative, and Science Sweep deepens only
the unresolved, conflicting, novel, or researcher-prioritized source intervals.
"""
from __future__ import annotations

from hashlib import sha256
import json
from typing import Any, Dict, Iterable, Mapping, Optional


SCHEMA = "vaa1.parsimonious_workflow_plan.v1"

TIER_ALIASES = {
    "quick_sweep": "quick_sweep",
    "science_sweep": "science_sweep",
    # The running analysis API historically calls this profile Science Scan.
    # Keep that public value compatible while the workflow contract uses the
    # analyst-facing Science Sweep name.
    "science_scan": "science_sweep",
}

TRACKING_PROGRAMS: Dict[str, Dict[str, Any]] = {
    "narrative_agents": {
        "label": "Narrative agents",
        "quick_capsules": [
            "narrative_agent.confirmed_anchor_reuse",
            "narrative_agent.transcript_speaker_candidates",
            "narrative_agent.audio_turn_clusters",
            "narrative_agent.sparse_visual_presence",
        ],
        "science_capsules": [
            "narrative_agent.active_speaker_synchrony",
            "narrative_agent.visual_identity_continuity",
            "narrative_agent.voice_prosody_continuity",
            "narrative_agent.constellation_resolution",
        ],
    },
    "actions_movements": {
        "label": "Actions and movements",
        "quick_capsules": [
            "action.transcript_process_candidates",
            "action.audio_event_candidates",
            "action.sparse_motion_change",
            "action.confirmed_anchor_reuse",
        ],
        "science_capsules": [
            "action.pose_movement_measurement",
            "action.object_agent_interaction",
            "action.temporal_action_continuity",
            "action.constellation_resolution",
        ],
    },
    "episodic_scene_continuums": {
        "label": "Episodic scene continuums",
        "quick_capsules": [
            "episode.confirmed_scene_reuse",
            "episode.shot_transition_scout",
            "episode.transcript_topic_turns",
            "episode.sparse_constellation_signature",
        ],
        "science_capsules": [
            "episode.scene_boundary_resolution",
            "episode.agent_action_object_continuity",
            "episode.situation_transition_resolution",
            "episode.constellation_narrative_summary",
        ],
    },
}

CAPSULE_COSTS = {
    "confirmed_anchor_reuse": "negligible",
    "transcript": "low",
    "audio": "low",
    "sparse": "low",
    "shot": "low",
    "topic": "low",
    "active_speaker": "medium",
    "voice_prosody": "medium",
    "pose": "medium",
    "object_agent": "medium",
    "scene_boundary": "medium",
    "continuity": "medium",
    "constellation": "medium",
}


def _digest(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return sha256(encoded).hexdigest()


def _cost(capsule_id: str) -> str:
    for token, cost in CAPSULE_COSTS.items():
        if token in capsule_id:
            return cost
    return "medium"


def _interval(value: Mapping[str, Any]) -> Dict[str, Any]:
    start = max(0.0, float(value.get("start_seconds") or 0.0))
    end = max(start, float(value.get("end_seconds") or start))
    return {
        "start_seconds": round(start, 6),
        "end_seconds": round(end, 6),
        "reason": str(value.get("reason") or "unresolved_evidence"),
        "priority": str(value.get("priority") or "normal"),
        "evidence_refs": sorted({str(item) for item in value.get("evidence_refs", []) if item}),
    }


def build_parsimonious_workflow_plan(
    *,
    analysis_id: str,
    source_fingerprint: str,
    clock_revision: str,
    correction_generation: str,
    requested_tier: str,
    compatible_results: Optional[Mapping[str, str]] = None,
    uncertainty_hotspots: Iterable[Mapping[str, Any]] = (),
    researcher_priorities: Iterable[Mapping[str, Any]] = (),
) -> Dict[str, Any]:
    """Build a bounded, reuse-first work plan for one analysis.

    ``compatible_results`` maps capsule IDs to exact compatible result IDs.
    Quick Sweep is source-wide and sparse. Science Sweep is interval-selective:
    absent hotspots or priorities, it performs no unbounded deepening work.
    """
    supplied_tier = str(requested_tier or "").strip()
    requested_tier = TIER_ALIASES.get(supplied_tier, "")
    if not requested_tier:
        raise ValueError("requested_tier must be quick_sweep, science_sweep, or science_scan")
    for name, value in {
        "analysis_id": analysis_id,
        "source_fingerprint": source_fingerprint,
        "clock_revision": clock_revision,
        "correction_generation": correction_generation,
    }.items():
        if not str(value).strip():
            raise ValueError(f"{name} is required")

    reuse = dict(compatible_results or {})
    hotspots = [_interval(item) for item in uncertainty_hotspots]
    priorities = [_interval(item) for item in researcher_priorities]
    target_intervals = sorted(
        hotspots + priorities,
        key=lambda item: (item["start_seconds"], item["end_seconds"], item["reason"]),
    )
    jobs = []
    tracking = {}
    for program_id, program in TRACKING_PROGRAMS.items():
        capsule_key = "quick_capsules" if requested_tier == "quick_sweep" else "science_capsules"
        program_jobs = []
        for capsule_id in program[capsule_key]:
            result_id = reuse.get(capsule_id)
            if result_id:
                job = {
                    "capsule_id": capsule_id,
                    "tracking_program": program_id,
                    "route": "reuse_exact_result",
                    "compatible_result_id": result_id,
                    "incremental_cost": "none",
                    "scope": "compatible_source_scope",
                }
                jobs.append(job)
                program_jobs.append(job)
                continue
            scopes = (
                [{"scope": "source_wide_sparse"}]
                if requested_tier == "quick_sweep"
                else [{"scope": "bounded_interval", "interval": item} for item in target_intervals]
            )
            for scope in scopes:
                job = {
                    "capsule_id": capsule_id,
                    "tracking_program": program_id,
                    "route": "compute_local_candidate",
                    "incremental_cost": _cost(capsule_id),
                    **scope,
                }
                jobs.append(job)
                program_jobs.append(job)
        tracking[program_id] = {
            "label": program["label"],
            "jobs": program_jobs,
            "output_authority": "candidate_only",
            "master_schema_projection": "after_governed_acceptance",
        }

    plan_material = {
        "analysis_id": analysis_id,
        "source_fingerprint": source_fingerprint,
        "clock_revision": clock_revision,
        "correction_generation": correction_generation,
        "requested_tier": requested_tier,
        "requested_tier_alias": supplied_tier,
        "jobs": jobs,
    }
    return {
        "schema": SCHEMA,
        "plan_id": f"workflow:{_digest(plan_material)[:24]}",
        **plan_material,
        "execution_principle": [
            "manual_authority_first",
            "exact_result_reuse",
            "compatible_feature_reuse",
            "deterministic_rules",
            "lightweight_local_capsules",
            "bounded_specialist_deepening",
            "analyst_review_or_abstention",
        ],
        "tracking_programs": tracking,
        "uncertainty_hotspots": hotspots,
        "researcher_priorities": priorities,
        "summary": {
            "job_count": len(jobs),
            "reused_job_count": sum(job["route"] == "reuse_exact_result" for job in jobs),
            "computed_job_count": sum(job["route"] == "compute_local_candidate" for job in jobs),
            "bounded_science_interval_count": len(target_intervals) if requested_tier == "science_sweep" else 0,
        },
        "governance": {
            "manual_correction_wins": True,
            "raw_evidence_immutable": True,
            "automatic_canonical_write": False,
            "selective_recomputation": True,
            "abstain_when_support_is_inadequate": True,
        },
    }
