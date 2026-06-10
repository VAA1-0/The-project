"""
Live mature-data proliferation bus audit.

This module intentionally audits proliferation readiness without promoting raw
or candidate evidence. Promotion still belongs to the governed decision ledger.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set


SCHEMA = "vaa1.live_mature_data_proliferation_audit.v1"

PERSON_HINTS = {
    "person",
    "people",
    "human",
    "face",
    "character",
    "identity",
    "identification",
    "speaker",
    "presenter",
    "reporter",
    "anchor",
    "bond",
    "james",
    "sari",
    "felix",
}

STOPWORDS = {
    "the",
    "and",
    "with",
    "from",
    "that",
    "this",
    "manual",
    "visual",
    "annotation",
    "sample",
    "source",
    "audio",
    "video",
    "track",
    "object",
    "detection",
    "unknown",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def as_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in ("items", "objects", "tracked_objects", "samples", "segments"):
            items = value.get(key)
            if isinstance(items, list):
                return items
    return []


def as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def first_float(item: Dict[str, Any], keys: Sequence[str]) -> Optional[float]:
    for key in keys:
        value = to_float(item.get(key))
        if value is not None:
            return value
    interval = item.get("interval") if isinstance(item.get("interval"), dict) else {}
    for key in keys:
        value = to_float(interval.get(key))
        if value is not None:
            return value
    return None


def time_range(item: Dict[str, Any]) -> Dict[str, Optional[float]]:
    start = first_float(
        item,
        (
            "start",
            "start_seconds",
            "timestamp_seconds",
            "timestamp",
            "time_start",
            "frame_time",
        ),
    )
    end = first_float(
        item,
        ("end", "end_seconds", "time_end", "timestamp_end", "timestamp_seconds", "timestamp"),
    )
    if end is None and start is not None:
        duration = to_float(item.get("duration_seconds") or item.get("duration"))
        end = start + duration if duration is not None else start
    return {"start": start, "end": end}


def tokens_for(*values: Any) -> Set[str]:
    tokens: Set[str] = set()
    for value in values:
        for token in re.findall(r"[a-z0-9]+", str(value or "").lower()):
            if len(token) >= 3 and token not in STOPWORDS:
                tokens.add(token)
    return tokens


def label_from_manual(item: Dict[str, Any]) -> str:
    metadata = as_dict(item.get("metadata_correlation"))
    return (
        safe_text(item.get("identity_affirmation"))
        or safe_text(item.get("custom_label"))
        or safe_text(item.get("label"))
        or safe_text(metadata.get("target_label"))
        or "Manual visual annotation"
    )


def category_from_manual(item: Dict[str, Any]) -> str:
    metadata = as_dict(item.get("metadata_correlation"))
    return (
        safe_text(item.get("category"))
        or safe_text(item.get("subcategory"))
        or safe_text(metadata.get("target_type"))
        or "Manual visual annotation"
    )


def collect_manual_mature_seeds(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    corrections = as_dict(status.get("annotation_corrections"))
    seeds: List[Dict[str, Any]] = []
    for index, item in enumerate(as_list(corrections.get("manual_visual_annotations"))):
        if not isinstance(item, dict):
            continue
        label = label_from_manual(item)
        category = category_from_manual(item)
        item_range = time_range(item)
        seed_id = safe_text(item.get("id"), f"manual_visual:{index}")
        seeds.append(
            {
                "seed_id": seed_id,
                "source_panel": "manual_visual_annotations",
                "authority": "manual_confirmation",
                "label": label,
                "category": category,
                "time": item_range,
                "teaches_regime": bool(item.get("teaches_regime")),
                "source_ref": seed_id,
                "tokens": sorted(tokens_for(label, category)),
            }
        )
    return seeds


def collect_source_sample_seeds(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    seeds: List[Dict[str, Any]] = []
    for index, item in enumerate(as_list(status.get("source_samples"))):
        if not isinstance(item, dict):
            continue
        label = (
            safe_text(item.get("label"))
            or safe_text(item.get("purpose"))
            or safe_text(item.get("sample_type"))
            or "Source sample"
        )
        sample_id = safe_text(item.get("sample_id"), f"source_sample:{index}")
        sample_type = safe_text(item.get("sample_type"), "source_sample")
        seeds.append(
            {
                "seed_id": sample_id,
                "source_panel": "source_samples",
                "authority": "source_sample",
                "label": label,
                "category": sample_type,
                "time": time_range(item),
                "teaches_regime": True,
                "source_ref": sample_id,
                "has_visual_sample": isinstance(item.get("visual"), dict),
                "has_audio_sample": isinstance(item.get("audio"), dict),
                "tokens": sorted(tokens_for(label, sample_type)),
            }
        )
    return seeds


def collect_proliferation_decision_seeds(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    corrections = as_dict(status.get("annotation_corrections"))
    seeds: List[Dict[str, Any]] = []
    for index, item in enumerate(as_list(corrections.get("proliferation_decisions"))):
        if not isinstance(item, dict):
            continue
        if safe_text(item.get("decision")).lower() != "confirmed":
            continue
        label = (
            safe_text(item.get("label"))
            or safe_text(item.get("target_label"))
            or safe_text(item.get("source_label"))
            or "Confirmed proliferation decision"
        )
        decision_id = safe_text(item.get("id"), f"proliferation_decision:{index}")
        seeds.append(
            {
                "seed_id": decision_id,
                "source_panel": "proliferation_decisions",
                "authority": "confirmed_proliferation_decision",
                "label": label,
                "category": safe_text(item.get("category"), "Decision"),
                "time": time_range(item),
                "teaches_regime": True,
                "source_ref": decision_id,
                "tokens": sorted(tokens_for(label, item.get("category"))),
            }
        )
    return seeds


def collect_mature_seeds(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    return (
        collect_manual_mature_seeds(status)
        + collect_source_sample_seeds(status)
        + collect_proliferation_decision_seeds(status)
    )


def visual_tracked_objects(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = as_dict(status.get("results"))
    visual = as_dict(results.get("visual_analysis"))
    items = as_list(visual.get("tracked_objects"))
    if not items:
        items = as_list(status.get("tracked_objects"))
    return [item for item in items if isinstance(item, dict)]


def label_from_track(item: Dict[str, Any], index: int) -> str:
    return (
        safe_text(item.get("display_label"))
        or safe_text(item.get("label"))
        or safe_text(item.get("class_name"))
        or safe_text(item.get("class"))
        or safe_text(item.get("name"))
        or f"track {item.get('track_id', index)}"
    )


def track_candidate(item: Dict[str, Any], index: int) -> Dict[str, Any]:
    label = label_from_track(item, index)
    source_ref = safe_text(item.get("track_id"), f"tracked_object:{index}")
    category = safe_text(item.get("category") or item.get("class_name") or item.get("class"), "Object")
    return {
        "candidate_id": f"tracked_object:{source_ref}",
        "source_panel": "objects_panel",
        "source_kind": "tracked_object",
        "source_ref": source_ref,
        "label": label,
        "category": category,
        "time": time_range(item),
        "confidence": item.get("confidence"),
        "tokens": sorted(tokens_for(label, category)),
    }


def seed_looks_person(seed: Dict[str, Any]) -> bool:
    seed_tokens = set(seed.get("tokens") or [])
    return bool(seed_tokens & PERSON_HINTS)


def candidate_looks_person(candidate: Dict[str, Any]) -> bool:
    candidate_tokens = set(candidate.get("tokens") or [])
    return bool(candidate_tokens & PERSON_HINTS)


def starts_after_seed(seed: Dict[str, Any], candidate: Dict[str, Any]) -> bool:
    seed_time = as_dict(seed.get("time"))
    candidate_time = as_dict(candidate.get("time"))
    seed_end = to_float(seed_time.get("end"))
    seed_start = to_float(seed_time.get("start"))
    candidate_start = to_float(candidate_time.get("start"))
    if candidate_start is None:
        return False
    boundary = seed_end if seed_end is not None else seed_start
    if boundary is None:
        return True
    return candidate_start > boundary + 0.5


def match_reason(seed: Dict[str, Any], candidate: Dict[str, Any]) -> Optional[str]:
    seed_tokens = set(seed.get("tokens") or [])
    candidate_tokens = set(candidate.get("tokens") or [])
    overlap = sorted(seed_tokens & candidate_tokens)
    if overlap:
        return f"token_overlap:{','.join(overlap[:5])}"
    if seed_looks_person(seed) and candidate_looks_person(candidate):
        return "person_track_continuity"
    return None


def collect_candidate_opportunities(
    status: Dict[str, Any],
    mature_seeds: Sequence[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    opportunities: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    candidates = [track_candidate(item, index) for index, item in enumerate(visual_tracked_objects(status))]
    for seed in mature_seeds:
        for candidate in candidates:
            if candidate["source_ref"] == seed.get("source_ref"):
                continue
            if not starts_after_seed(seed, candidate):
                continue
            reason = match_reason(seed, candidate)
            if not reason:
                continue
            key = f"{seed.get('seed_id')}::{candidate.get('candidate_id')}"
            if key in seen:
                continue
            seen.add(key)
            opportunities.append(
                {
                    "opportunity_id": f"opportunity:{len(opportunities) + 1}",
                    "seed_id": seed.get("seed_id"),
                    "seed_label": seed.get("label"),
                    "candidate_id": candidate.get("candidate_id"),
                    "candidate_label": candidate.get("label"),
                    "candidate_category": candidate.get("category"),
                    "candidate_source_panel": candidate.get("source_panel"),
                    "candidate_source_ref": candidate.get("source_ref"),
                    "candidate_time": candidate.get("time"),
                    "confidence": candidate.get("confidence"),
                    "match_reason": reason,
                    "review_state": "candidate_requires_governed_decision",
                    "candidate_is_not_promotion": True,
                }
            )
    return opportunities


def build_live_mature_data_proliferation_audit(status: Dict[str, Any]) -> Dict[str, Any]:
    analysis_id = safe_text(status.get("analysis_id"), "unknown-analysis")
    seeds = collect_mature_seeds(status)
    opportunities = collect_candidate_opportunities(status, seeds)
    corrections = as_dict(status.get("annotation_corrections"))
    decisions = as_list(corrections.get("proliferation_decisions"))
    source_sample_count = len(as_list(status.get("source_samples")))
    tracked_count = len(visual_tracked_objects(status))
    blocked_promotions = [
        {
            "opportunity_id": opportunity.get("opportunity_id"),
            "candidate_id": opportunity.get("candidate_id"),
            "seed_id": opportunity.get("seed_id"),
            "reason": "promotion_decision_required",
            "required_ledger": "annotation_corrections.proliferation_decisions",
        }
        for opportunity in opportunities
    ]
    return {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "status": "audit_ready",
        "created_at": utc_now_iso(),
        "authority_policy": {
            "candidate_is_not_promotion": True,
            "promotion_requires_decision_ledger_entry": True,
            "manual_correction_wins": True,
            "raw_detection_never_overrides_mature_data": True,
        },
        "hydration": status.get("saved_analysis_hydration_audit"),
        "summary": {
            "seed_count": len(seeds),
            "manual_seed_count": len(
                [seed for seed in seeds if seed.get("source_panel") == "manual_visual_annotations"]
            ),
            "source_sample_seed_count": source_sample_count,
            "promotion_decision_count": len(decisions),
            "tracked_candidate_count": tracked_count,
            "candidate_opportunity_count": len(opportunities),
            "blocked_promotion_count": len(blocked_promotions),
        },
        "mature_seeds": seeds,
        "candidate_opportunities": opportunities,
        "blocked_promotions": blocked_promotions,
        "next_required_stage": "P2_PROMOTION_LEDGER",
    }


def write_live_mature_data_proliferation_audit(
    status: Dict[str, Any],
    output_path: str | Path,
) -> Dict[str, Any]:
    payload = build_live_mature_data_proliferation_audit(status)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return payload
