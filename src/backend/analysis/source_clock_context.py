"""Content-addressed source/timebase identity; does not rewrite saved evidence."""
from __future__ import annotations

import hashlib
import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]


class ClockRevisionConflict(ValueError):
    """The caller's source/timebase is missing or no longer current."""


def _signature(path: Path) -> tuple[int, ...]:
    info = path.stat()
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


@lru_cache(maxsize=128)
def _fingerprint(path_text: str, signature: tuple[int, ...]) -> str:
    path = Path(path_text)
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if _signature(path) != signature:
        raise ClockRevisionConflict("Source changed while its clock identity was being read; retry")
    return "sha256:" + digest.hexdigest()


def _finite(value: Any, name: str, *, signed: bool = False) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError(f"{name} must be numeric")
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError(f"{name} must be numeric") from exc
    if not math.isfinite(result) or (not signed and result < 0):
        raise ValueError(f"{name} must be finite with valid bounds")
    return 0.0 if result == 0 else result


def canonical_clock_corrections(analysis_id: str, status: dict) -> dict:
    """The interactive sidecar wins over the backend's potentially stale cache."""
    paths = [ROOT / "outputs" / "api_results" / analysis_id / "annotation_corrections.json"]
    recorded = (status.get("output_files") or {}).get("annotation_corrections")
    if recorded:
        path = Path(recorded)
        paths.append(path if path.is_absolute() else ROOT / path)
    for path in paths:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            continue
        except (OSError, ValueError) as exc:
            raise ClockRevisionConflict("Canonical corrections cannot be read; reload before continuing") from exc
        if not isinstance(payload, dict):
            raise ClockRevisionConflict("Canonical corrections must be an object")
        return payload
    return status.get("annotation_corrections") or {}


def correction_clock_read_payload(analysis_id: str, corrections: dict) -> dict:
    return {**corrections, "_clock_write_guard": {
        "analysis_id": analysis_id,
        "correction_generation": corrections.get("correction_generation"),
        "transcript_clock_offset_seconds": _finite(corrections.get("transcript_clock_offset_seconds"), "transcript_clock_offset_seconds", signed=True) or 0.0,
    }}


def validate_correction_clock_guard(analysis_id: str, existing: dict, incoming: dict) -> None:
    current = _finite(existing.get("transcript_clock_offset_seconds"), "transcript_clock_offset_seconds", signed=True) or 0.0
    requested = _finite(incoming.get("transcript_clock_offset_seconds", current), "transcript_clock_offset_seconds", signed=True) or 0.0
    guard = incoming.get("_clock_write_guard")
    generation = existing.get("correction_generation")
    supplied = guard.get("correction_generation") if isinstance(guard, dict) else None
    if generation is not None or supplied is not None:
        if not isinstance(generation, str) or not generation or supplied != generation:
            raise ClockRevisionConflict("Corrections changed since this editor was loaded; reload before saving")
    if guard is None:
        if requested != current:
            raise ClockRevisionConflict("Reload corrections before changing the source clock")
        return
    if not isinstance(guard, dict) or guard.get("analysis_id") != analysis_id or "transcript_clock_offset_seconds" not in guard:
        raise ClockRevisionConflict("Correction clock guard is missing or belongs to another analysis")
    expected = _finite(guard["transcript_clock_offset_seconds"], "guard clock offset", signed=True) or 0.0
    if expected != current:
        raise ClockRevisionConflict("The source clock changed since these corrections were loaded; reload before saving")


def build_source_clock_context(analysis_id: str, status: dict, metadata: dict) -> dict:
    outputs = status.get("output_files") or {}
    source = (status.get("source_video_path") or status.get("file_path")
              or outputs.get("source_video") or metadata.get("source_video_path"))
    context = {"clock_id": "source_media.clock", "analysis_id": analysis_id,
               "binding_status": "source_unavailable", "source_fingerprint": None,
               "clock_revision": None}
    if not source:
        return context
    path = Path(source)
    if not path.is_absolute():
        path = ROOT / path
    try:
        path = path.resolve(strict=True)
        if not path.is_file():
            return context
        signature = _signature(path)
        fingerprint = _fingerprint(str(path), signature)
        # Also protects the cached-hash path against a replacement during lookup.
        if _signature(path) != signature:
            raise ClockRevisionConflict("Source changed during clock identity lookup; retry")
    except (OSError, RuntimeError):
        return context
    corrections = canonical_clock_corrections(analysis_id, status)
    timebase = {
        "contract": "source-clock-context.v1",
        "source_fingerprint": fingerprint,
        "duration_seconds": _finite(metadata.get("duration_seconds"), "duration_seconds"),
        "fps": _finite(metadata.get("fps"), "fps"),
        "audio_sample_rate": _finite(metadata.get("audio_sample_rate"), "audio_sample_rate"),
        "transcript_clock_offset_seconds": _finite(
            corrections.get("transcript_clock_offset_seconds"), "transcript_clock_offset_seconds", signed=True) or 0.0,
    }
    frame_mode = metadata.get("frame_rate_mode", "unknown")
    if frame_mode not in ("constant", "variable", "unknown"):
        raise ValueError("frame_rate_mode must be constant, variable or unknown")
    if frame_mode != "unknown":
        timebase["frame_rate_mode"] = frame_mode
    revision = hashlib.sha256(json.dumps(timebase, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
    return {**context, "binding_status": "content_bound", "source_fingerprint": fingerprint,
            "clock_revision": "clock-v1:" + revision, "timebase": timebase,
            "precision": {"display_resolution_seconds": 0.001, "frame_rate_mode": frame_mode,
                          "frame_precision_seconds": 1 / timebase["fps"] if frame_mode == "constant" and timebase["fps"] else None,
                          "nominal_frame_duration_seconds": 1 / timebase["fps"] if timebase["fps"] else None,
                          "sample_precision_seconds": 1 / timebase["audio_sample_rate"] if timebase["audio_sample_rate"] else None}}


def validate_clock_binding(scope: dict, context: dict, *, required: bool = False) -> str:
    fingerprint, revision = scope.get("source_fingerprint"), scope.get("clock_revision")
    if fingerprint is None and revision is None:
        if required:
            raise ClockRevisionConflict("A current source fingerprint and clock revision are required for invalidation")
        return "legacy_unversioned"
    if not isinstance(fingerprint, str) or not fingerprint or not isinstance(revision, str) or not revision:
        raise ValueError("source_fingerprint and clock_revision must be supplied together as nonempty strings")
    if context.get("binding_status") != "content_bound":
        raise ClockRevisionConflict("Source media is unavailable; its clock binding cannot be verified")
    if fingerprint != context["source_fingerprint"] or revision != context["clock_revision"]:
        raise ClockRevisionConflict("Source or clock revision changed; reload the evidence before continuing")
    return "content_bound"
