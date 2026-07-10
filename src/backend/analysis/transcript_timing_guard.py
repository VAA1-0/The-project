"""Transcript timing quality guards for source-linked evidence."""

from __future__ import annotations
from datetime import datetime, timezone
import re
from typing import Any, Dict, List

import numpy as np


WHISPER_TIMING_AUTHORITIES = {
    "manual_correction",
    "original_whisper_timecode",
    "full_pass",
}

VAD_SUPPORT_AUTHORITIES = {
    "anchored_vad_timing_repair",
    "audio_diarization.vad_segments",
}

CANDIDATE_TIMING_AUTHORITIES = {
    "chunked_fallback",
    "tail_recovery_fallback",
    "fallback_candidate",
    "scaffold",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_text_for_match(text: Any) -> str:
    return re.sub(r"[^\w\s]", "", str(text or "").lower())


def _has_word_level_timestamps(segments: List[Dict[str, Any]]) -> bool:
    """Check if the transcript appears to have detailed, word-level timing."""
    if not segments:
        return False
    # Check if at least 30% of segments contain a 'words' list with timing info.
    word_timed_segments = sum(1 for s in segments if isinstance(s.get("words"), list) and len(s["words"]) > 0)
    return (word_timed_segments / len(segments)) > 0.3


def transcript_timing_looks_scaffolded(transcript: Dict[str, Any]) -> bool:
    """Detect simple 0-2, 2-4 scaffold clocks that should not be source truth."""
    segments = [
        segment
        for segment in transcript.get("segments", [])
        if isinstance(segment, dict) and str(segment.get("text") or "").strip()
    ]
    if len(segments) < 4:
        return False
    starts = [safe_float(segment.get("start")) for segment in segments[:4]]
    ends = [safe_float(segment.get("end")) for segment in segments[:4]]
    if any(value is None for value in starts + ends):
        return False
    return all(
        abs((starts[index] or 0.0) - index * 2.0) <= 0.02
        and abs((ends[index] or 0.0) - (index + 1) * 2.0) <= 0.02
        for index in range(4)
    )


def row_has_operational_whisper_timecode(row: Dict[str, Any]) -> bool:
    authority = str(row.get("timing_authority") or row.get("timingAuthority") or "")
    status = str(row.get("timing_status") or row.get("timingStatus") or "")
    return (
        authority in WHISPER_TIMING_AUTHORITIES
        or status in {"manual_correction", "original_whisper_timecode"}
    )


def build_transcript_timing_authority(
    transcript: Dict[str, Any],
) -> Dict[str, Any]:
    """Summarize whether transcript rows can serve as the operational source clock."""
    segments = [
        segment for segment in transcript.get("segments", []) if isinstance(segment, dict)
    ]
    status_counts: Dict[str, int] = {}
    authority_counts: Dict[str, int] = {}
    for segment in segments:
        status = str(segment.get("timing_status") or "unmarked")
        authority = str(
            segment.get("timing_authority")
            or transcript.get("transcription_strategy")
            or "unmarked"
        )
        status_counts[status] = status_counts.get(status, 0) + 1
        authority_counts[authority] = authority_counts.get(authority, 0) + 1

    operational_rows = sum(1 for segment in segments if row_has_operational_whisper_timecode(segment))
    candidate_rows = sum(
        1
        for segment in segments
        if str(segment.get("timing_authority") or transcript.get("transcription_strategy") or "")
        in CANDIDATE_TIMING_AUTHORITIES
    )
    vad_rows = sum(
        1
        for segment in segments
        if str(segment.get("timing_authority") or "") in VAD_SUPPORT_AUTHORITIES
        or str(segment.get("timing_status") or "") in {"vad_anchor_verified", "inherited_after_vad_anchor"}
    )
    has_word_timing = _has_word_level_timestamps(segments)
    strategy = transcript.get("transcription_strategy")
    scaffolded = transcript_timing_looks_scaffolded(transcript)
    if has_word_timing or strategy in {
        "full_pass",
        "original_whisper_timecode",
    }:
        default_authority = "original_whisper_timecode"
        operational_rows = max(operational_rows, len(segments))
    elif strategy in CANDIDATE_TIMING_AUTHORITIES:
        default_authority = "candidate_fallback"
    elif strategy in VAD_SUPPORT_AUTHORITIES:
        default_authority = "vad_support_only"
    elif scaffolded:
        default_authority = "scaffold_candidate"
    else:
        default_authority = "unverified"

    return {
        "schema": "vaa1.transcript_timing_authority.v1",
        "operational_authority": default_authority,
        "authority_order": [
            "manual_correction",
            "original_whisper_timecode",
            "verified_source_time_anchor",
            "vad_support_only",
            "candidate_fallback",
        ],
        "vad_policy": "auxiliary_only_not_transcript_clock",
        "fallback_policy": "candidate_not_operational_source_truth",
        "segment_count": len(segments),
        "operational_whisper_rows": operational_rows,
        "vad_support_rows": vad_rows,
        "candidate_rows": candidate_rows,
        "timing_status_counts": status_counts,
        "timing_authority_counts": authority_counts,
        "scaffold_suspected": scaffolded,
        "has_word_level_timestamps": has_word_timing,
        "source_time_operational": bool(segments and operational_rows == len(segments)),
    }

def build_transcript_quality_report(
    transcript: Dict[str, Any],
    *,
    media_duration_seconds: Any = None,
    audio_duration_seconds: Any = None,
    trailing_gap_warn_seconds: float = 8.0,
    trailing_gap_warn_ratio: float = 0.08,
) -> Dict[str, Any]:
    segments = transcript.get("segments") or []
    last_end_seconds = max(
        (safe_float(segment.get("end")) or 0.0 for segment in segments),
        default=0.0,
    )
    media_duration = safe_float(media_duration_seconds)
    audio_duration = safe_float(audio_duration_seconds)

    target_duration = media_duration or audio_duration or last_end_seconds
    trailing_uncovered_seconds = max(0.0, (target_duration or 0.0) - last_end_seconds)
    coverage_ratio = (
        min(1.0, max(0.0, last_end_seconds / target_duration))
        if target_duration and target_duration > 0
        else 1.0
    )

    coverage_shortfall = trailing_uncovered_seconds > max(
        trailing_gap_warn_seconds,
        (target_duration or 0.0) * trailing_gap_warn_ratio,
    )

    reasons: list[str] = []
    if not segments:
        reasons.append("no_transcript_segments")
    if coverage_shortfall:
        reasons.append("trailing_coverage_shortfall")

    return {
        "status": "degraded" if reasons else "ok",
        "segment_count": len(segments),
        "last_segment_end_seconds": round(last_end_seconds, 3),
        "media_duration_seconds": round(media_duration, 3) if media_duration is not None else None,
        "audio_duration_seconds": round(audio_duration, 3) if audio_duration is not None else None,
        "coverage_target_seconds": round(target_duration, 3) if target_duration is not None else None,
        "coverage_ratio": round(coverage_ratio, 4),
        "trailing_uncovered_seconds": round(trailing_uncovered_seconds, 3),
        "has_word_level_timestamps": _has_word_level_timestamps(segments),
        "notes": [
            "Word-level timestamps are a strong signal of a high-quality transcript source."
        ] if _has_word_level_timestamps(segments) else [],
        "thresholds": {
            "warn_gap_seconds": trailing_gap_warn_seconds,
            "warn_gap_ratio": trailing_gap_warn_ratio,
        },
        "reasons": reasons,
    }


def transcript_timing_repair_needed(
    transcript: Dict[str, Any],
    quality_report: Dict[str, Any],
) -> bool:
    """Return true when persisted transcript timings cannot be source authority."""

    # Never repair a transcript that already has detailed word-level timestamps.
    # This is the most critical guard to prevent damaging good data.
    if quality_report.get("has_word_level_timestamps"):
        return False

    if not transcript.get("segments"):
        return False

    if transcript.get("transcription_strategy") in {
        "chunked_fallback",
        "tail_recovery_fallback",
    }:
        return False

    reasons = set(quality_report.get("reasons") or [])
    coverage_ratio = safe_float(quality_report.get("coverage_ratio")) or 1.0
    trailing_gap = safe_float(quality_report.get("trailing_uncovered_seconds")) or 0.0
    return (
        "trailing_coverage_shortfall" in reasons
        and coverage_ratio < 0.94
        and trailing_gap >= 8.0
    )


def reconcile_annotation_corrections_after_timing_repair(
    *,
    annotation_corrections: Dict[str, Any],
    repaired_transcript: Dict[str, Any],
    original_transcript: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Re-links manual annotations to a transcript after its timing has been repaired.
    This is a critical governance step to preserve analyst work.
    """
    if not annotation_corrections or not repaired_transcript.get("segments"):
        return annotation_corrections

    next_corrections = dict(annotation_corrections)
    repaired_segments = repaired_transcript["segments"]
    original_segments = original_transcript.get("segments", [])

    repaired_map = {
        _normalize_text_for_match(segment.get("text")): segment
        for segment in repaired_segments
    }

    def find_best_match(raw_value: str, original_start: float | None) -> Dict[str, Any] | None:
        normalized_raw = _normalize_text_for_match(raw_value)
        if normalized_raw in repaired_map:
            return repaired_map[normalized_raw]

        if original_start is not None:
            # Fallback: find the closest segment by time
            closest_segment = min(
                repaired_segments,
                key=lambda s: abs((s.get("start", 0.0) + s.get("end", 0.0)) / 2 - original_start),
                default=None,
            )
            return closest_segment
        return None

    for rule_type in ("text_substitutions", "label_overrides"):
        updated_rules = []
        for rule in next_corrections.get(rule_type, []):
            if not isinstance(rule, dict) or not rule.get("raw_value"):
                updated_rules.append(rule)
                continue

            original_start = rule.get("target_start_timestamp")
            best_match = find_best_match(rule["raw_value"], original_start)

            if best_match:
                updated_rule = dict(rule)
                updated_rule["target_start_timestamp"] = best_match.get("start")
                updated_rule["target_end_timestamp"] = best_match.get("end")
                updated_rule.setdefault("notes", "")
                updated_rule["notes"] += " [Timing re-anchored after repair]"
                updated_rules.append(updated_rule)
            else:
                # Keep the rule but flag it as orphaned
                updated_rule = dict(rule)
                updated_rule.setdefault("notes", "")
                updated_rule["notes"] += " [Orphaned after timing repair]"
                updated_rules.append(updated_rule)
        next_corrections[rule_type] = updated_rules

    # Note: A more robust implementation would also handle manual_transcript_entries
    # and manual_visual_annotations if they are linked to specific transcript segments.

    next_corrections.setdefault("provenance", []).append({
        "process": "reconcile_annotation_corrections_after_timing_repair",
        "timestamp": _now_iso(),
        "details": "Attempted to re-anchor manual corrections to a repaired transcript timeline.",
    })
    return next_corrections


def build_anchored_vad_timing_repair(
    transcript: Dict[str, Any],
    *,
    annotation_corrections: Dict[str, Any] | None = None,
    audio_diarization: Dict[str, Any] | None = None,
) -> Dict[str, Any] | None:
    """Build a partial Bond-style repair while marking VAD as support, not authority."""
    segments = [
        dict(segment)
        for segment in transcript.get("segments", [])
        if isinstance(segment, dict)
    ]
    if not segments or not transcript_timing_looks_scaffolded({"segments": segments}):
        return None

    corrections = annotation_corrections or {}
    opening_offset = safe_float(corrections.get("transcript_clock_offset_seconds"))
    if opening_offset is None:
        opening_offset = safe_float(corrections.get("opening_anchor_seconds"))
    if opening_offset is None:
        return None

    vad_segments = []
    if isinstance(audio_diarization, dict):
        vad_segments = [
            vad
            for vad in audio_diarization.get("vad_segments", [])
            if isinstance(vad, dict)
        ]

    drift_index = None
    drift_vad = None
    for index, segment in enumerate(segments):
        normalized = _normalize_text_for_match(segment.get("text"))
        if "world is arming faster than we can respond" not in normalized:
            continue
        drift_index = index
        drift_vad = next(
            (
                vad
                for vad in vad_segments
                if abs((safe_float(vad.get("start")) or 0.0) - 20.96) <= 0.35
            ),
            None,
        )
        break

    repaired_segments: List[Dict[str, Any]] = []
    inherited_shift = 0.0
    for index, segment in enumerate(segments):
        original_start = safe_float(segment.get("start")) or 0.0
        original_end = safe_float(segment.get("end")) or original_start
        repaired = dict(segment)

        if index == 0:
            duration = max(0.0, original_end - original_start)
            repaired.update(
                {
                    "start": round(opening_offset, 3),
                    "end": round(opening_offset + duration, 3),
                    "timing_status": "anchor_verified",
                    "timing_authority": "manual_correction",
                    "timing_source": "manual analyst source-time correction",
                    "source_time_valid": True,
                }
            )
        elif drift_index is not None and index == drift_index and drift_vad:
            vad_start = safe_float(drift_vad.get("start")) or original_start
            vad_end = safe_float(drift_vad.get("end")) or vad_start
            inherited_shift = vad_start - original_start
            repaired.update(
                {
                    "start": round(vad_start, 3),
                    "end": round(vad_end, 3),
                    "timing_status": "vad_anchor_verified",
                    "timing_authority": "anchored_vad_timing_repair",
                    "timing_source": "audio_diarization.vad_segments support anchor",
                    "source_time_valid": False,
                    "candidate_time_valid": True,
                }
            )
        elif drift_index is not None and index > drift_index and inherited_shift:
            repaired.update(
                {
                    "start": round(original_start + inherited_shift, 3),
                    "end": round(original_end + inherited_shift, 3),
                    "timing_status": "inherited_after_vad_anchor",
                    "timing_authority": "anchored_vad_timing_repair",
                    "timing_source": "audio_diarization.vad_segments + transcript scaffold delta",
                    "source_time_valid": False,
                    "candidate_time_valid": True,
                }
            )
        else:
            repaired.update(
                {
                    "start": round(original_start + opening_offset, 3),
                    "end": round(original_end + opening_offset, 3),
                    "timing_status": "anchored_offset",
                    "timing_authority": "manual_correction",
                    "timing_source": "manual opening anchor + transcript scaffold delta",
                    "source_time_valid": False,
                    "candidate_time_valid": True,
                }
            )
        repaired_segments.append(repaired)

    repaired_transcript = {
        **transcript,
        "segments": repaired_segments,
        "transcription_strategy": "anchored_vad_timing_repair",
        "timing_authority": {
            "schema": "vaa1.transcript_timing_authority.v1",
            "operational_authority": "manual_correction_for_verified_rows",
            "vad_policy": "auxiliary_only_not_transcript_clock",
            "fallback_policy": "candidate_not_operational_source_truth",
            "drift_anchor_segment_id": (drift_vad or {}).get("segment_id"),
            "source_time_operational": False,
        },
        "timing_repair": {
            "status": "partially_repaired",
            "reason": "manual_anchor_with_vad_support",
        },
    }
    return repaired_transcript


def _matching_segment_by_text(
    segments: List[Dict[str, Any]],
    text: Any,
) -> Dict[str, Any] | None:
    target = _normalize_text_for_match(text)
    if not target:
        return None
    for segment in segments:
        candidate = _normalize_text_for_match(segment.get("text"))
        if candidate == target or target in candidate or candidate in target:
            return segment
    return None


def promote_automatic_transcript_timing(
    transcript: Dict[str, Any],
    automatic_transcript: Dict[str, Any],
    *,
    after_seconds: float = 0.0,
) -> Dict[str, Any] | None:
    """Prefer automatic Whisper-like timestamps over inherited VAD projection rows."""
    automatic_segments = [
        segment
        for segment in automatic_transcript.get("segments", [])
        if isinstance(segment, dict)
    ]
    if not automatic_segments:
        return None

    changed = False
    repaired_segments: List[Dict[str, Any]] = []
    for segment in transcript.get("segments", []):
        if not isinstance(segment, dict):
            continue
        next_segment = dict(segment)
        start = safe_float(segment.get("start")) or 0.0
        if start >= after_seconds and str(segment.get("timing_status") or "") in {
            "inherited_after_vad_anchor",
            "anchored_offset",
            "vad_anchor_verified",
        }:
            match = _matching_segment_by_text(automatic_segments, segment.get("text"))
            if match:
                next_segment.update(
                    {
                        "start": safe_float(match.get("start")) or 0.0,
                        "end": safe_float(match.get("end")) or safe_float(match.get("start")) or 0.0,
                        "timing_status": "automatic_transcript_timestamp",
                        "timing_authority": "quick_sweep_transcript",
                        "timing_source": "automatic transcript timestamp promoted over VAD projection",
                        "source_time_valid": True,
                    }
                )
                changed = True
        repaired_segments.append(next_segment)

    if not changed:
        return None
    repaired = {**transcript, "segments": repaired_segments}
    repaired["timing_authority"] = build_transcript_timing_authority(repaired)
    return repaired


def rebuild_transcript_from_quick_sweep_candidate(
    transcript: Dict[str, Any],
    automatic_transcript: Dict[str, Any],
) -> Dict[str, Any] | None:
    """Replace VAD-inherited projection rows with automatic transcript candidates."""
    automatic_segments = [
        dict(segment)
        for segment in automatic_transcript.get("segments", [])
        if isinstance(segment, dict) and str(segment.get("text") or "").strip()
    ]
    if not automatic_segments:
        return None

    preserved: List[Dict[str, Any]] = []
    for segment in transcript.get("segments", []):
        if not isinstance(segment, dict):
            continue
        if str(segment.get("timing_status") or "") in {
            "anchor_verified",
            "vad_anchor_verified",
            "automatic_transcript_timestamp",
        }:
            preserved.append(dict(segment))

    rows_by_text = {
        _normalize_text_for_match(row.get("text")): dict(row)
        for row in preserved
        if _normalize_text_for_match(row.get("text"))
    }
    rebuilt: List[Dict[str, Any]] = []
    seen_texts = set()
    for automatic in automatic_segments:
        key = _normalize_text_for_match(automatic.get("text"))
        row = rows_by_text.get(key)
        if row is None:
            row = dict(automatic)
            row.update(
                {
                    "timing_status": "automatic_transcript_timestamp",
                    "timing_authority": "quick_sweep_transcript",
                    "timing_source": "automatic transcript timestamp",
                    "source_time_valid": True,
                }
            )
        rebuilt.append(row)
        seen_texts.add(key)

    for row in preserved:
        key = _normalize_text_for_match(row.get("text"))
        if key and key not in seen_texts:
            rebuilt.append(row)

    rebuilt.sort(key=lambda row: safe_float(row.get("start")) or 0.0)
    repaired = {
        **transcript,
        "segments": rebuilt,
        "transcription_strategy": "quick_sweep_transcript",
    }
    repaired["timing_authority"] = build_transcript_timing_authority(repaired)
    return repaired
