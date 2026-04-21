"""Forensic snippet rendering utilities.

This module creates governed derivative video artifacts from a source video.
It is intentionally small and ledger-first: every render job produces a JSON
record that explains what was rendered, from where, at which sampling mode.
"""

from __future__ import annotations

import json
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


VALID_FORENSIC_RENDER_MODES = {"science_grade", "forensic_accuracy"}


class ForensicRenderError(ValueError):
    """Raised when a forensic render request cannot be completed safely."""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def resolve_forensic_fps(
    *,
    mode: str,
    source_fps: float,
    requested_fps: Optional[float] = None,
) -> float:
    """Resolve the output FPS for a governed forensic render.

    science_grade deliberately samples a lighter representation suitable for
    research review; forensic_accuracy preserves the source frame rate.
    """

    if mode not in VALID_FORENSIC_RENDER_MODES:
        raise ForensicRenderError(f"Unsupported forensic render mode: {mode}")

    effective_source_fps = source_fps if source_fps > 0 else 25.0

    if requested_fps and requested_fps > 0:
        return min(float(requested_fps), effective_source_fps)

    if mode == "science_grade":
        return min(6.0, effective_source_fps)

    return effective_source_fps


def clamp_region(
    region: Optional[Dict[str, Any]],
    *,
    frame_width: int,
    frame_height: int,
) -> Optional[Dict[str, int]]:
    if not region:
        return None

    x = int(round(safe_float(region.get("x"), 0.0)))
    y = int(round(safe_float(region.get("y"), 0.0)))
    w = int(round(safe_float(region.get("w"), 0.0)))
    h = int(round(safe_float(region.get("h"), 0.0)))

    x = max(0, min(x, max(0, frame_width - 1)))
    y = max(0, min(y, max(0, frame_height - 1)))
    w = max(1, min(w, frame_width - x))
    h = max(1, min(h, frame_height - y))

    return {"x": x, "y": y, "w": w, "h": h}


def even_dimension(value: int) -> int:
    if value <= 2:
        return max(2, value)
    return value if value % 2 == 0 else value - 1


def normalize_output_geometry(
    *,
    frame_width: int,
    frame_height: int,
    region: Optional[Dict[str, int]],
) -> tuple[int, int, Optional[Dict[str, int]]]:
    if region:
        normalized_region = dict(region)
        normalized_region["w"] = even_dimension(normalized_region["w"])
        normalized_region["h"] = even_dimension(normalized_region["h"])
        return normalized_region["w"], normalized_region["h"], normalized_region

    return even_dimension(frame_width), even_dimension(frame_height), None


def normalize_region_track(
    keyframes: Any,
    *,
    frame_width: int,
    frame_height: int,
    time_start: float,
    time_end: float,
) -> list[Dict[str, Any]]:
    if not isinstance(keyframes, list):
        return []

    normalized: list[Dict[str, Any]] = []
    for item in keyframes:
        if not isinstance(item, dict):
            continue
        region = clamp_region(
            item.get("region"),
            frame_width=frame_width,
            frame_height=frame_height,
        )
        if not region:
            continue
        timestamp = safe_float(item.get("time"), time_start)
        timestamp = max(time_start, min(time_end, timestamp))
        normalized.append(
            {
                "time": round(timestamp, 6),
                "region": region,
                "intent": str(item.get("intent") or "").strip(),
                "note": str(item.get("note") or "").strip(),
            }
        )

    normalized.sort(key=lambda item: item["time"])
    deduped: list[Dict[str, Any]] = []
    for item in normalized:
        if deduped and item["time"] == deduped[-1]["time"]:
            deduped[-1] = item
        else:
            deduped.append(item)
    return deduped


def interpolate_region(
    region_track: list[Dict[str, Any]],
    timestamp: float,
) -> Optional[Dict[str, int]]:
    if not region_track:
        return None
    if len(region_track) == 1 or timestamp <= region_track[0]["time"]:
        return dict(region_track[0]["region"])
    if timestamp >= region_track[-1]["time"]:
        return dict(region_track[-1]["region"])

    for left, right in zip(region_track, region_track[1:]):
        if left["time"] <= timestamp <= right["time"]:
            span = max(0.000001, right["time"] - left["time"])
            ratio = (timestamp - left["time"]) / span
            left_region = left["region"]
            right_region = right["region"]
            return {
                key: int(
                    round(
                        safe_float(left_region.get(key), 0.0)
                        + (
                            safe_float(right_region.get(key), 0.0)
                            - safe_float(left_region.get(key), 0.0)
                        )
                        * ratio
                    )
                )
                for key in ("x", "y", "w", "h")
            }
    return dict(region_track[-1]["region"])


def load_forensic_render_jobs(root_dir: str | Path) -> list[Dict[str, Any]]:
    jobs_path = Path(root_dir) / "jobs.json"
    if not jobs_path.exists():
        return []

    try:
        payload = json.loads(jobs_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def write_forensic_render_jobs(root_dir: str | Path, jobs: list[Dict[str, Any]]) -> None:
    root = Path(root_dir)
    root.mkdir(parents=True, exist_ok=True)
    (root / "jobs.json").write_text(
        json.dumps(make_json_safe(jobs), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def make_json_safe(value: Any) -> Any:
    """Recursively normalize values for strict JSON responses and ledgers."""

    if isinstance(value, dict):
        return {str(key): make_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [make_json_safe(item) for item in value]
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if hasattr(value, "item"):
        try:
            return make_json_safe(value.item())
        except Exception:
            return str(value)
    if isinstance(value, Path):
        return str(value)
    return value


def create_forensic_render_job(
    *,
    analysis_id: str,
    source_video_path: str | Path,
    output_root: str | Path,
    request: Dict[str, Any],
) -> Dict[str, Any]:
    """Render a governed time/region snippet and return the job ledger entry."""

    import cv2

    source_path = Path(source_video_path)
    if not source_path.exists():
        raise ForensicRenderError(f"Source video does not exist: {source_path}")

    mode = str(request.get("mode") or "science_grade")
    if mode not in VALID_FORENSIC_RENDER_MODES:
        raise ForensicRenderError(f"Unsupported forensic render mode: {mode}")

    start_seconds = max(0.0, safe_float(request.get("time_start"), 0.0))
    end_seconds = max(start_seconds, safe_float(request.get("time_end"), start_seconds))
    max_duration = max(1.0, safe_float(request.get("max_duration_seconds"), 60.0))
    if end_seconds - start_seconds > max_duration:
        raise ForensicRenderError(
            f"Forensic render window exceeds {max_duration:.1f}s safety limit"
        )

    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        raise ForensicRenderError(f"Could not open source video: {source_path}")

    try:
        source_fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if frame_width <= 0 or frame_height <= 0:
            raise ForensicRenderError("Source video did not report valid dimensions")

        effective_source_fps = source_fps if source_fps > 0 else 25.0
        target_fps = resolve_forensic_fps(
            mode=mode,
            source_fps=effective_source_fps,
            requested_fps=safe_float(request.get("requested_fps"), 0.0) or None,
        )
        frame_stride = max(1, int(round(effective_source_fps / target_fps)))
        output_fps = effective_source_fps / frame_stride

        start_frame = int(start_seconds * effective_source_fps)
        end_frame = int(end_seconds * effective_source_fps)
        if total_frames > 0:
            start_frame = min(start_frame, max(0, total_frames - 1))
            end_frame = min(max(start_frame, end_frame), max(0, total_frames - 1))

        region = clamp_region(
            request.get("region"),
            frame_width=frame_width,
            frame_height=frame_height,
        )
        region_track = normalize_region_track(
            request.get("region_track"),
            frame_width=frame_width,
            frame_height=frame_height,
            time_start=start_seconds,
            time_end=end_seconds,
        )
        if region_track and not region:
            region = dict(region_track[0]["region"])
        output_width, output_height, region = normalize_output_geometry(
            frame_width=frame_width,
            frame_height=frame_height,
            region=region,
        )

        render_root = Path(output_root)
        render_root.mkdir(parents=True, exist_ok=True)
        job_id = str(request.get("render_job_id") or uuid.uuid4().hex)
        job_dir = render_root / job_id
        frames_dir = job_dir / "frames"
        job_dir.mkdir(parents=True, exist_ok=True)
        frames_dir.mkdir(parents=True, exist_ok=True)

        output_video_path = job_dir / "snippet.mp4"
        output_json_path = job_dir / "render_job.json"
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(
            str(output_video_path),
            fourcc,
            output_fps,
            (output_width, output_height),
        )
        if not writer.isOpened():
            raise ForensicRenderError("Could not open forensic render writer")

        rendered_frames = 0
        saved_frame_paths: list[str] = []
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        current_frame = start_frame

        while current_frame <= end_frame:
            ok, frame = cap.read()
            if not ok or frame is None:
                break

            if (current_frame - start_frame) % frame_stride == 0:
                frame_timestamp = current_frame / effective_source_fps
                active_region = interpolate_region(region_track, frame_timestamp) or region
                if active_region:
                    active_region = clamp_region(
                        active_region,
                        frame_width=frame_width,
                        frame_height=frame_height,
                    )
                    x, y, w, h = (
                        active_region["x"],
                        active_region["y"],
                        active_region["w"],
                        active_region["h"],
                    )
                    frame = frame[y : y + h, x : x + w]
                    if frame.shape[1] != output_width or frame.shape[0] != output_height:
                        frame = cv2.resize(frame, (output_width, output_height))
                else:
                    frame = frame[:output_height, :output_width]

                writer.write(frame)
                frame_path = frames_dir / f"frame_{current_frame:06d}.jpg"
                cv2.imwrite(str(frame_path), frame)
                saved_frame_paths.append(str(frame_path))
                rendered_frames += 1

            current_frame += 1

        writer.release()

        if rendered_frames == 0:
            raise ForensicRenderError("No frames were rendered for the requested window")

        job = make_json_safe({
            "render_job_id": job_id,
            "analysis_id": analysis_id,
            "source_video_path": str(source_path),
            "requested_by": str(request.get("requested_by") or "analyst"),
            "requested_at": utc_now_iso(),
            "reason": str(request.get("reason") or ""),
            "mode": mode,
            "source_fps": source_fps,
            "target_fps": output_fps,
            "frame_stride": frame_stride,
            "time_start": round(start_seconds, 6),
            "time_end": round(end_seconds, 6),
            "frame_start": start_frame,
            "frame_end": end_frame,
            "region_type": "tracked_box" if region_track else ("static_box" if region else "full_frame"),
            "region": region,
            "region_intent": str(request.get("region_intent") or ""),
            "region_track": region_track,
            "adopted_context": request.get("adopted_context") or {},
            "input_evidence_ids": request.get("input_evidence_ids") or [],
            "output_video_path": str(output_video_path),
            "output_frame_dir": str(frames_dir),
            "output_json_path": str(output_json_path),
            "saved_frame_paths": saved_frame_paths,
            "rendered_frames": rendered_frames,
            "status": "completed",
            "created_at": utc_now_iso(),
        })

        output_json_path.write_text(
            json.dumps(job, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        jobs = [
            existing
            for existing in load_forensic_render_jobs(render_root)
            if existing.get("render_job_id") != job_id
        ]
        jobs.append(job)
        jobs.sort(key=lambda item: str(item.get("created_at", "")))
        write_forensic_render_jobs(render_root, jobs)
        return job
    finally:
        cap.release()
