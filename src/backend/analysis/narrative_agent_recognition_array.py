"""Governed Narrative Agent recognition extension across an analysis array.

Legacy payloads may still expose ``identity_*`` compatibility fields.  This
module translates those fields at its boundary and only emits Narrative Agent
recognition contracts.  It never treats a tracker id, face, speaker cluster, or
name mention as a Narrative Agent on its own.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence


SCHEMA = "vaa1.narrative_agent_recognition_array_extension.v1"
DEFAULT_GATES = {
    "minimum_overall_score": 0.90,
    "minimum_visual_score": 0.85,
    "minimum_secondary_modality_score": 0.72,
    "minimum_competing_agent_margin": 0.08,
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text(value: Any) -> str:
    return str(value or "").strip()


def _number(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _first_number(*values: Any) -> float | None:
    for value in values:
        number = _number(value)
        if number is not None:
            return number
    return None


def _list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _canonical_key(label: str) -> str:
    return " ".join(label.casefold().split())


def _analysis_id(status: Mapping[str, Any]) -> str:
    return _text(status.get("analysis_id")) or "unknown-analysis"


def _corrections(status: Mapping[str, Any]) -> Dict[str, Any]:
    return _dict(status.get("annotation_corrections"))


def _source_interval(item: Mapping[str, Any]) -> Dict[str, float | None]:
    start = _number(item.get("start_seconds"))
    if start is None:
        start = _number(item.get("timestamp_seconds"))
    if start is None:
        start = _number(_dict(item.get("time")).get("start"))
    end = _number(item.get("end_seconds"))
    if end is None:
        end = _number(_dict(item.get("time")).get("end"))
    if end is None:
        end = start
    return {"start": start, "end": end}


def _recognition_label(item: Mapping[str, Any]) -> str:
    # ``identity_affirmation`` is a legacy compatibility field at this boundary.
    return (
        _text(item.get("narrative_agent_affirmation"))
        or _text(item.get("narrative_agent_label"))
        or _text(item.get("identity_affirmation"))
    )


def collect_confirmed_recognition_anchors(
    status: Mapping[str, Any],
) -> List[Dict[str, Any]]:
    """Collect explicit, source-linked Narrative Agent confirmations."""
    analysis_id = _analysis_id(status)
    anchors: List[Dict[str, Any]] = []
    for index, item in enumerate(
        _list(_corrections(status).get("manual_visual_annotations"))
    ):
        if not isinstance(item, dict):
            continue
        label = _recognition_label(item)
        if not label:
            continue
        event = _dict(_dict(item.get("metadata_correlation")).get("manual_confirmation_event"))
        fields = _dict(event.get("confirmed_fields"))
        explicitly_confirmed = (
            _text(item.get("category")).casefold() == "identification"
            and (
                fields.get("narrative_agent") is True
                or _text(item.get("review_state")).casefold() == "confirmed"
                or _text(event.get("authority_level")).casefold()
                in {"manual_confirmation", "manual_correction"}
            )
        )
        if not explicitly_confirmed:
            continue
        interval = _source_interval(item)
        if interval["start"] is None:
            continue
        anchor_id = _text(item.get("id")) or f"{analysis_id}:narrative-agent-anchor:{index}"
        anchors.append(
            {
                "anchor_id": anchor_id,
                "analysis_id": analysis_id,
                "narrative_agent_key": _canonical_key(label),
                "narrative_agent_label": label,
                "source_interval": interval,
                "source_geometry": item.get("coordinates"),
                "authority": "explicit_analyst_confirmation",
                "traceback_refs": [
                    ref
                    for ref in (
                        _text(event.get("event_id")),
                        _text(_dict(item.get("metadata_correlation")).get("geometry_track_id")),
                    )
                    if ref
                ],
            }
        )
    return anchors


def _candidate_label(candidate: Mapping[str, Any]) -> str:
    # Legacy candidate payloads are translated here and never emitted unchanged.
    return (
        _text(candidate.get("narrative_agent_label"))
        or _text(candidate.get("candidate_label"))
        or _text(candidate.get("identity_label"))
        or _text(candidate.get("target_label"))
    )


def _candidate_scores(candidate: Mapping[str, Any]) -> Dict[str, float | None]:
    scores = _dict(candidate.get("scores"))
    closest = _dict(candidate.get("closest_match"))
    overall = _number(
        candidate.get("overall_score")
        or candidate.get("similarity_score")
        or candidate.get("confidence")
        or scores.get("overall")
    )
    visual = _number(
        candidate.get("visual_similarity")
        or scores.get("visual")
        or closest.get("visual_similarity")
    )
    voice = _number(
        candidate.get("voice_similarity")
        or candidate.get("audio_similarity")
        or scores.get("voice")
        or scores.get("audio")
    )
    context = _number(
        candidate.get("context_similarity")
        or scores.get("context")
        or closest.get("context_similarity")
    )
    competing = _number(
        candidate.get("competing_agent_score")
        or scores.get("competing_agent")
    )
    margin = _number(candidate.get("competing_agent_margin") or scores.get("margin"))
    if margin is None and overall is not None and competing is not None:
        margin = overall - competing
    return {
        "overall": overall,
        "visual": visual,
        "voice": voice,
        "context": context,
        "competing_agent": competing,
        "margin": margin,
    }


def collect_recognition_candidates(status: Mapping[str, Any]) -> List[Dict[str, Any]]:
    """Collect already-computed recognition candidates without inventing scores."""
    sources: List[tuple[str, Sequence[Any]]] = [
        ("narrative_agent_recognition_candidates", _list(status.get("narrative_agent_recognition_candidates"))),
        ("identity_continuity_candidates", _list(status.get("identity_continuity_candidates"))),
    ]
    for match in _list(status.get("evidence_proliferation_matches")):
        if isinstance(match, dict):
            sources.append(("evidence_proliferation_match", _list(match.get("candidates"))))

    analysis_id = _analysis_id(status)
    collected: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for source_surface, items in sources:
        for index, candidate in enumerate(items):
            if not isinstance(candidate, dict):
                continue
            label = _candidate_label(candidate)
            if not label:
                continue
            candidate_id = (
                _text(candidate.get("candidate_id"))
                or _text(candidate.get("evidence_id"))
                or f"{analysis_id}:{source_surface}:{index}"
            )
            if candidate_id in seen:
                continue
            seen.add(candidate_id)
            collected.append(
                {
                    "candidate_id": candidate_id,
                    "analysis_id": analysis_id,
                    "narrative_agent_key": _canonical_key(label),
                    "narrative_agent_label": label,
                    "source_interval": _source_interval(candidate),
                    "source_geometry": candidate.get("bbox") or candidate.get("geometry"),
                    "scores": _candidate_scores(candidate),
                    "negative_evidence": bool(candidate.get("negative_evidence")),
                    "source_surface": source_surface,
                    "source_refs": [
                        ref
                        for ref in (
                            _text(candidate.get("source_ref")),
                            _text(candidate.get("target_source_ref")),
                        )
                        if ref
                    ],
                    "method": _text(candidate.get("method")) or "precomputed_candidate",
                }
            )
    return collected


def collect_unmeasured_person_occurrences(
    status: Mapping[str, Any],
    narrative_agents: Mapping[str, Sequence[Mapping[str, Any]]],
) -> List[Dict[str, Any]]:
    """Expose every raw person occurrence to the governed recognition scorer.

    Each occurrence is paired with every confirmed Narrative Agent anchor as an
    *unmeasured* possibility.  No similarity is inferred from a track number.
    This makes missing recognition work countable without manufacturing results.
    """
    analysis_id = _analysis_id(status)
    tracked = status.get("tracked_objects")
    if isinstance(tracked, dict):
        tracked = tracked.get("tracked_objects") or tracked.get("objects") or tracked.get("items")
    occurrences: List[Dict[str, Any]] = []
    for index, item in enumerate(_list(tracked)):
        if not isinstance(item, dict):
            continue
        category = _text(item.get("class_name") or item.get("category") or item.get("label"))
        if category.casefold() not in {"person", "people", "human", "face"}:
            continue
        interval = {
            "start": _first_number(item.get("start_timestamp"), item.get("start_seconds"), item.get("timestamp")),
            "end": _first_number(item.get("end_timestamp"), item.get("end_seconds"), item.get("timestamp")),
        }
        if interval["start"] is None:
            continue
        geometry = None
        if all(item.get(key) is not None for key in ("bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2")):
            geometry = {
                "x1": item.get("bbox_x1"),
                "y1": item.get("bbox_y1"),
                "x2": item.get("bbox_x2"),
                "y2": item.get("bbox_y2"),
                "coordinate_system": "source_pixels",
            }
        source_ref = f"{analysis_id}:tracked-person:{item.get('track_id', index)}:{interval['start']}:{interval['end']}"
        for key, anchors in narrative_agents.items():
            label = _text(anchors[0].get("narrative_agent_label"))
            occurrences.append(
                {
                    "candidate_id": f"recognition-possibility:{key}:{source_ref}",
                    "analysis_id": analysis_id,
                    "narrative_agent_key": key,
                    "narrative_agent_label": label,
                    "source_interval": interval,
                    "source_geometry": geometry,
                    "scores": {
                        "overall": None,
                        "visual": None,
                        "voice": None,
                        "context": None,
                        "competing_agent": None,
                        "margin": None,
                    },
                    "negative_evidence": False,
                    "source_surface": "tracked_objects",
                    "source_refs": [source_ref],
                    "method": "awaiting_narrative_agent_occurrence_measurement",
                    "raw_track_id_is_not_recognition": True,
                }
            )
    return occurrences


def evaluate_candidate(
    candidate: Mapping[str, Any],
    anchors_by_key: Mapping[str, Sequence[Mapping[str, Any]]],
    gates: Mapping[str, float],
) -> Dict[str, Any]:
    reasons: List[str] = []
    key = _text(candidate.get("narrative_agent_key"))
    anchors = list(anchors_by_key.get(key) or [])
    interval = _dict(candidate.get("source_interval"))
    scores = _dict(candidate.get("scores"))
    secondary = max(
        [score for score in (scores.get("voice"), scores.get("context")) if score is not None],
        default=None,
    )
    if not anchors:
        reasons.append("no_explicitly_confirmed_narrative_agent_anchor")
    if interval.get("start") is None:
        reasons.append("missing_source_time")
    if candidate.get("source_geometry") is None:
        reasons.append("missing_source_geometry")
    if scores.get("overall") is None:
        reasons.append("missing_overall_similarity_score")
    elif scores["overall"] < gates["minimum_overall_score"]:
        reasons.append("overall_similarity_below_gate")
    if scores.get("visual") is None:
        reasons.append("missing_visual_similarity_score")
    elif scores["visual"] < gates["minimum_visual_score"]:
        reasons.append("visual_similarity_below_gate")
    if secondary is None:
        reasons.append("missing_independent_secondary_modality")
    elif secondary < gates["minimum_secondary_modality_score"]:
        reasons.append("secondary_modality_below_gate")
    if scores.get("margin") is None:
        reasons.append("missing_competing_agent_margin")
    elif scores["margin"] < gates["minimum_competing_agent_margin"]:
        reasons.append("competing_agent_margin_below_gate")
    if candidate.get("negative_evidence"):
        reasons.append("negative_evidence_present")

    state = "automatically_extended" if not reasons else "review_or_measurement_required"
    return {
        **dict(candidate),
        "extension_state": state,
        "gate_failures": reasons,
        "anchor_refs": [anchor.get("anchor_id") for anchor in anchors],
    }


def build_array_extension(
    statuses: Iterable[Mapping[str, Any]],
    *,
    gates: Mapping[str, float] | None = None,
) -> Dict[str, Any]:
    statuses = list(statuses)
    effective_gates = {**DEFAULT_GATES, **dict(gates or {})}
    anchors = [
        anchor
        for status in statuses
        for anchor in collect_confirmed_recognition_anchors(status)
    ]
    anchors_by_key: Dict[str, List[Dict[str, Any]]] = {}
    for anchor in anchors:
        anchors_by_key.setdefault(anchor["narrative_agent_key"], []).append(anchor)
    candidates = [
        candidate
        for status in statuses
        for candidate in collect_recognition_candidates(status)
    ]
    measured_ids = {candidate["candidate_id"] for candidate in candidates}
    unmeasured = [
        candidate
        for status in statuses
        for candidate in collect_unmeasured_person_occurrences(status, anchors_by_key)
        if candidate["candidate_id"] not in measured_ids
    ]
    candidates.extend(unmeasured)
    evaluated = [
        evaluate_candidate(candidate, anchors_by_key, effective_gates)
        for candidate in candidates
    ]
    extensions = [item for item in evaluated if item["extension_state"] == "automatically_extended"]
    blocked = [item for item in evaluated if item["extension_state"] != "automatically_extended"]
    created_at = _now()
    fingerprint_input = json.dumps(
        {
            "analyses": sorted(_analysis_id(status) for status in statuses),
            "anchors": sorted(anchor["anchor_id"] for anchor in anchors),
            "candidates": sorted(candidate["candidate_id"] for candidate in candidates),
            "gates": effective_gates,
        },
        sort_keys=True,
    ).encode("utf-8")
    return {
        "schema": SCHEMA,
        "created_at": created_at,
        "array_fingerprint": hashlib.sha256(fingerprint_input).hexdigest(),
        "analysis_ids": sorted(_analysis_id(status) for status in statuses),
        "governance": {
            "terminology": "Narrative Agent recognition",
            "legacy_identity_fields_are_compatibility_inputs_only": True,
            "explicit_analyst_confirmation_is_anchor_authority": True,
            "automatic_extension_is_source_occurrence_scoped": True,
            "raw_track_id_cannot_define_a_narrative_agent": True,
            "all_extensions_are_reversible_and_traceable": True,
        },
        "gates": effective_gates,
        "summary": {
            "analysis_count": len(statuses),
            "confirmed_anchor_count": len(anchors),
            "confirmed_narrative_agent_count": len(anchors_by_key),
            "candidate_occurrence_count": len(candidates),
            "automatically_extended_occurrence_count": len(extensions),
            "blocked_occurrence_count": len(blocked),
        },
        "confirmed_recognition_anchors": anchors,
        "automatic_recognition_extensions": extensions,
        "blocked_recognition_occurrences": blocked,
    }


def write_array_extension(
    statuses: Iterable[Mapping[str, Any]],
    output_path: str | Path,
    *,
    gates: Mapping[str, float] | None = None,
) -> Dict[str, Any]:
    payload = build_array_extension(statuses, gates=gates)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload
