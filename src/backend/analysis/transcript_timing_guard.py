"""Transcript timing quality guards for source-linked evidence."""

from __future__ import annotations

from typing import Any, Dict


def safe_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


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
