"""Traceable multimodal pattern scanner agent.

The agent searches known detections and confirmed anchors for repeatable
multimodal constellations. It does not promote mature truth. It returns
source-linked candidates that the Mature Data Proliferation bus can govern.
"""
from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set


SCHEMA = "vaa1.multimodal_pattern_scanner_agent.v1"

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


def as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in ("items", "objects", "tracked_objects", "samples", "segments", "speaker_turns"):
            items = value.get(key)
            if isinstance(items, list):
                return items
    return []


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


def tokens_for(*values: Any) -> Set[str]:
    tokens: Set[str] = set()
    for value in values:
        for token in re.findall(r"[a-z0-9]+", str(value or "").lower()):
            if len(token) >= 3 and token not in STOPWORDS:
                tokens.add(token)
    return tokens


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


def ranges_overlap(
    left: Dict[str, Any],
    right: Dict[str, Any],
    *,
    tolerance: float = 0.0,
) -> bool:
    left_start = to_float(left.get("start"))
    left_end = to_float(left.get("end")) or left_start
    right_start = to_float(right.get("start"))
    right_end = to_float(right.get("end")) or right_start
    if left_start is None or right_start is None:
        return False
    if left_end is None:
        left_end = left_start
    if right_end is None:
        right_end = right_start
    return max(left_start, right_start) <= min(left_end, right_end) + tolerance


def window_around_time_range(item_range: Dict[str, Any], padding: float = 1.25) -> Dict[str, float]:
    start = to_float(item_range.get("start"))
    end = to_float(item_range.get("end")) or start
    if start is None:
        return {"start": 0.0, "end": 0.0}
    if end is None or end < start:
        end = start
    return {"start": max(0.0, start - padding), "end": end + padding}


def transcript_segments(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = as_dict(status.get("results"))
    audio = as_dict(results.get("audio_analysis"))
    candidates = (
        status.get("transcript_segments")
        or status.get("transcript")
        or audio.get("transcript_segments")
        or audio.get("segments")
    )
    return [item for item in as_list(candidates) if isinstance(item, dict)]


def ocr_results(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = as_dict(status.get("results"))
    visual = as_dict(results.get("visual_analysis"))
    return [
        item
        for item in as_list(visual.get("ocr_results") or status.get("ocr_results"))
        if isinstance(item, dict)
    ]


def scene_cards(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    payload = as_dict(status.get("mise_en_scene_scene_cards"))
    return [item for item in as_list(payload.get("scene_cards")) if isinstance(item, dict)]


def audio_evidence_items(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for index, segment in enumerate(transcript_segments(status)):
        items.append(
            {
                "source_panel": "transcript_panel",
                "source_ref": safe_text(segment.get("id"), f"transcript:{index}"),
                "label": safe_text(segment.get("speaker") or segment.get("speaker_label"), "transcript"),
                "text_preview": safe_text(segment.get("text") or segment.get("transcript_text"))[:160],
                "time": time_range(segment),
                "support_type": "transcript_overlap",
            }
        )

    audio_diarization = as_dict(status.get("audio_diarization"))
    for index, turn in enumerate(as_list(audio_diarization.get("speaker_turns"))):
        if not isinstance(turn, dict):
            continue
        items.append(
            {
                "source_panel": "audio_panel",
                "source_ref": safe_text(turn.get("turn_id"), f"audio_turn:{index}"),
                "label": safe_text(turn.get("speaker_label"), "speaker_turn"),
                "text_preview": safe_text(turn.get("text") or turn.get("transcript_text"))[:160],
                "time": time_range(turn),
                "support_type": "audio_speaker_turn_overlap",
            }
        )
    return items


def ocr_evidence_items(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for index, item in enumerate(ocr_results(status)):
        label = safe_text(item.get("text") or item.get("label"))
        if not label:
            continue
        items.append(
            {
                "source_panel": "ocr_panel",
                "source_ref": safe_text(item.get("id"), f"ocr:{index}"),
                "label": label,
                "time": time_range(item),
                "support_type": "ocr_overlap",
            }
        )
    return items


def scene_card_evidence_items(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for index, card in enumerate(scene_cards(status)):
        label = (
            safe_text(card.get("title"))
            or safe_text(card.get("scene_label"))
            or safe_text(card.get("summary"))
            or f"scene_card:{index}"
        )
        items.append(
            {
                "source_panel": "scene_cards",
                "source_ref": safe_text(card.get("scene_id"), f"scene_card:{index}"),
                "label": label,
                "time": time_range(card),
                "support_type": "scene_card_overlap",
            }
        )
    return items


def scan_constellation_for_candidate(
    status: Dict[str, Any],
    seed: Dict[str, Any],
    candidate: Dict[str, Any],
) -> Dict[str, Any]:
    """Return source-linked multimodal support around a candidate time window."""
    candidate_window = window_around_time_range(as_dict(candidate.get("time")))
    support: List[Dict[str, Any]] = [
        {
            "source_panel": candidate.get("source_panel"),
            "source_ref": candidate.get("source_ref"),
            "label": candidate.get("label"),
            "time": candidate.get("time"),
            "support_type": "visual_candidate_anchor",
        }
    ]

    for item in (
        audio_evidence_items(status)
        + ocr_evidence_items(status)
        + scene_card_evidence_items(status)
    ):
        if ranges_overlap(candidate_window, as_dict(item.get("time")), tolerance=0.25):
            support.append(item)

    seed_tokens = set(seed.get("tokens") or [])
    support_panels = {
        safe_text(item.get("source_panel"), "unknown")
        for item in support
        if isinstance(item, dict)
    }
    token_hits = sum(
        1
        for item in support
        if seed_tokens & tokens_for(item.get("label"), item.get("text_preview"))
    )
    support_count = len(support)
    modality_count = len(support_panels)
    visual_audio_support = "objects_panel" in support_panels and (
        "audio_panel" in support_panels or "transcript_panel" in support_panels
    )
    visual_text_support = "objects_panel" in support_panels and "ocr_panel" in support_panels
    scene_support = "scene_cards" in support_panels
    confidence = min(
        0.98,
        0.42
        + min(support_count, 6) * 0.055
        + min(modality_count, 5) * 0.045
        + (0.08 if visual_audio_support else 0.0)
        + (0.05 if visual_text_support else 0.0)
        + (0.04 if scene_support else 0.0)
        + min(token_hits, 3) * 0.035,
    )
    return {
        "schema": SCHEMA,
        "agent": "multimodal_pattern_scanner",
        "support_count": support_count,
        "modality_count": modality_count,
        "support_panels": sorted(support_panels),
        "support": support[:12],
        "confidence": round(confidence, 3),
        "match_basis": [
            item
            for item, present in (
                ("visual_candidate_anchor", True),
                ("visual_audio_support", visual_audio_support),
                ("visual_text_support", visual_text_support),
                ("scene_context_support", scene_support),
                ("token_overlap_support", token_hits > 0),
            )
            if present
        ],
        "governance": {
            "diagnostic_only": True,
            "candidate_is_not_mature_truth": True,
            "promotion_requires_decision": True,
            "manual_correction_wins": True,
        },
    }


def scan_multimodal_patterns(
    status: Dict[str, Any],
    seeds: Sequence[Dict[str, Any]],
    candidates: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    pattern_candidates = []
    for seed in seeds:
        for candidate in candidates:
            pattern_candidates.append(
                {
                    "seed_id": seed.get("seed_id"),
                    "candidate_id": candidate.get("candidate_id"),
                    "constellational_support": scan_constellation_for_candidate(
                        status,
                        seed,
                        candidate,
                    ),
                }
            )
    return {
        "schema": SCHEMA,
        "status": "completed",
        "created_at": utc_now_iso(),
        "pattern_candidate_count": len(pattern_candidates),
        "pattern_candidates": pattern_candidates,
    }
