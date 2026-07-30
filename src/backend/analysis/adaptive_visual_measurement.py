"""Adaptive source-linked temporal visual measurements.

The baseline pass measures motion, spatial activity, lighting change, visual
structure, and transition candidates at an economical cadence. High-change
windows are then resampled more densely without promoting candidates to
semantic facts.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import cv2
import numpy as np


SCHEMA = "vaa1.adaptive_visual_measurement.v1"
PROVIDER_VERSION = f"opencv.{cv2.__version__}"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _atomic_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _small_gray(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    scale = min(1.0, 320.0 / max(width, 1), 180.0 / max(height, 1))
    resized = cv2.resize(
        frame,
        (max(1, int(width * scale)), max(1, int(height * scale))),
        interpolation=cv2.INTER_AREA,
    )
    return cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)


def _frame_class(gray: np.ndarray, edge_density: float, entropy: float) -> str:
    if float(gray.mean()) < 8 and entropy < 1.5:
        return "near-black frame"
    if edge_density < 0.025 and entropy < 4.5:
        return "low-detail visual frame"
    if edge_density > 0.16 or entropy > 7.0:
        return "high-detail visual frame"
    return "balanced-detail visual frame"


def _motion_label(frame_delta: float, changed_fraction: float) -> str:
    if frame_delta >= 32 or changed_fraction >= 0.48:
        return "strong visual change"
    if frame_delta >= 14 or changed_fraction >= 0.20:
        return "moderate visual change"
    if frame_delta >= 5 or changed_fraction >= 0.06:
        return "mild visual change"
    return "visually stable"


def _transition_label(
    frame_delta: float,
    changed_fraction: float,
    brightness_delta: float,
) -> str:
    if frame_delta >= 38 and changed_fraction >= 0.55:
        return "hard-cut candidate"
    if abs(brightness_delta) >= 28 and frame_delta >= 18:
        return "flash/fade transition candidate"
    if frame_delta >= 20 and changed_fraction >= 0.30:
        return "soft-transition candidate"
    return "continuity"


def _lighting_event(brightness: float, brightness_delta: float) -> str:
    if brightness_delta >= 30:
        return "rapid illumination rise"
    if brightness_delta <= -30:
        return "rapid illumination drop"
    if brightness >= 185:
        return "sustained bright frame"
    if brightness <= 25:
        return "sustained dark frame"
    return "no rapid lighting event"


def _measure_frame(
    frame: np.ndarray,
    *,
    previous_gray: np.ndarray | None,
    timestamp: float,
    frame_index: int,
    cadence: str,
) -> tuple[Dict[str, Any], np.ndarray]:
    gray = _small_gray(frame)
    brightness = float(gray.mean())
    edges = cv2.Canny(gray, 70, 150)
    edge_density = float(np.count_nonzero(edges) / max(edges.size, 1))
    histogram = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
    probabilities = histogram[histogram > 0] / max(float(histogram.sum()), 1.0)
    entropy = float(-np.sum(probabilities * np.log2(probabilities)))

    if previous_gray is None:
        delta = np.zeros_like(gray)
        frame_delta = 0.0
        changed_fraction = 0.0
        brightness_delta = 0.0
    else:
        if previous_gray.shape != gray.shape:
            previous_gray = cv2.resize(previous_gray, (gray.shape[1], gray.shape[0]))
        delta = cv2.absdiff(gray, previous_gray)
        frame_delta = float(delta.mean())
        changed_fraction = float(np.count_nonzero(delta >= 20) / max(delta.size, 1))
        brightness_delta = brightness - float(previous_gray.mean())

    height, width = gray.shape
    third_x, third_y = width // 3, height // 3
    spatial: Dict[str, Any] = {}
    for row_index, row_name in enumerate(("upper", "middle", "lower")):
        for column_index, column_name in enumerate(("left", "center", "right")):
            y1 = row_index * third_y
            y2 = height if row_index == 2 else (row_index + 1) * third_y
            x1 = column_index * third_x
            x2 = width if column_index == 2 else (column_index + 1) * third_x
            region_delta = delta[y1:y2, x1:x2]
            region_edges = edges[y1:y2, x1:x2]
            spatial[f"{row_name}_{column_name}"] = {
                "activity_occupancy": round(
                    float(np.count_nonzero(region_delta >= 20) / max(region_delta.size, 1)),
                    6,
                ),
                "edge_occupancy": round(
                    float(np.count_nonzero(region_edges) / max(region_edges.size, 1)),
                    6,
                ),
            }

    row = {
        "sample_id": f"adaptive-visual:{frame_index:08d}",
        "timestamp": round(timestamp, 6),
        "frame_index": frame_index,
        "cadence": cadence,
        "source_clock": "source_media.clock",
        "frame_class": _frame_class(gray, edge_density, entropy),
        "frame_class_basis": {
            "edge_density": round(edge_density, 6),
            "luminance_entropy": round(entropy, 6),
        },
        "lighting": {
            "brightness": round(brightness, 3),
            "brightness_delta": round(brightness_delta, 3),
            "event": _lighting_event(brightness, brightness_delta),
        },
        "motion": {
            "frame_delta": round(frame_delta, 3),
            "changed_fraction": round(changed_fraction, 6),
            "label": _motion_label(frame_delta, changed_fraction),
        },
        "spatial_occupancy": spatial,
        "transition": {
            "label": _transition_label(frame_delta, changed_fraction, brightness_delta),
            "candidate": frame_delta >= 18 or abs(brightness_delta) >= 28,
        },
        "authority": "measured_automatic_detection",
        "review_state": "available",
    }
    return row, gray


def _merge_windows(timestamps: list[float], radius: float, duration: float) -> list[Dict[str, float]]:
    windows: list[list[float]] = []
    for timestamp in sorted(timestamps):
        start = max(0.0, timestamp - radius)
        end = min(duration, timestamp + radius)
        if windows and start <= windows[-1][1]:
            windows[-1][1] = max(windows[-1][1], end)
        else:
            windows.append([start, end])
    return [
        {"start_seconds": round(start, 6), "end_seconds": round(end, 6)}
        for start, end in windows
    ]


def measure_adaptive_visual(
    video_path: str | Path,
    *,
    analysis_id: str,
    baseline_fps: float = 4.0,
    dense_fps: float = 12.0,
    candidate_window_seconds: float = 0.5,
    output_path: str | Path | None = None,
) -> Dict[str, Any]:
    source = Path(video_path)
    if not source.exists():
        raise FileNotFoundError(f"Source video not found: {source}")
    if baseline_fps <= 0 or dense_fps < baseline_fps:
        raise ValueError("Cadence must satisfy 0 < baseline_fps <= dense_fps")

    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise ValueError(f"Could not open source video: {source}")
    source_fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if source_fps <= 0:
        capture.release()
        raise ValueError("Source video has no usable frame rate")
    duration = frame_count / source_fps if frame_count > 0 else 0.0

    baseline_step = max(1, int(round(source_fps / baseline_fps)))
    dense_step = max(1, int(round(source_fps / dense_fps)))
    baseline_rows: list[Dict[str, Any]] = []
    previous_gray: np.ndarray | None = None
    frame_index = 0
    try:
        while frame_count <= 0 or frame_index < frame_count:
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = capture.read()
            if not ok:
                break
            row, previous_gray = _measure_frame(
                frame,
                previous_gray=previous_gray,
                timestamp=frame_index / source_fps,
                frame_index=frame_index,
                cadence="baseline",
            )
            baseline_rows.append(row)
            frame_index += baseline_step

        candidate_times = [
            float(row["timestamp"])
            for row in baseline_rows
            if bool(row["transition"]["candidate"])
            or row["lighting"]["event"]
            in {"rapid illumination rise", "rapid illumination drop"}
        ]
        candidate_windows = _merge_windows(
            candidate_times,
            candidate_window_seconds,
            duration,
        )
        baseline_indices = {int(row["frame_index"]) for row in baseline_rows}
        dense_indices: set[int] = set()
        for window in candidate_windows:
            start_frame = int(float(window["start_seconds"]) * source_fps)
            end_frame = int(float(window["end_seconds"]) * source_fps)
            dense_indices.update(range(start_frame, end_frame + 1, dense_step))

        dense_rows: list[Dict[str, Any]] = []
        previous_dense_gray: np.ndarray | None = None
        for dense_index in sorted(dense_indices - baseline_indices):
            capture.set(cv2.CAP_PROP_POS_FRAMES, dense_index)
            ok, frame = capture.read()
            if not ok:
                continue
            row, previous_dense_gray = _measure_frame(
                frame,
                previous_gray=previous_dense_gray,
                timestamp=dense_index / source_fps,
                frame_index=dense_index,
                cadence="dense_candidate_window",
            )
            dense_rows.append(row)
    finally:
        capture.release()

    samples = sorted(
        [*baseline_rows, *dense_rows],
        key=lambda row: (float(row["timestamp"]), int(row["frame_index"])),
    )
    payload = {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "status": "completed_measured",
        "method": "OpenCV adaptive temporal visual measurement",
        "provider": "opencv",
        "provider_version": PROVIDER_VERSION,
        "parameters": {
            "source_fps": source_fps,
            "baseline_fps": baseline_fps,
            "dense_fps": dense_fps,
            "candidate_window_seconds": candidate_window_seconds,
        },
        "source_video_path": str(source),
        "source_video_sha256": _sha256(source),
        "source_clock": "source_media.clock",
        "candidate_windows": candidate_windows,
        "samples": samples,
        "summary": {
            "sample_count": len(samples),
            "baseline_sample_count": len(baseline_rows),
            "dense_sample_count": len(dense_rows),
            "candidate_window_count": len(candidate_windows),
            "motion_sample_count": max(0, len(samples) - 1),
            "transition_candidate_count": sum(
                1 for row in samples if row["transition"]["candidate"]
            ),
            "lighting_event_count": sum(
                1
                for row in samples
                if row["lighting"]["event"]
                in {"rapid illumination rise", "rapid illumination drop"}
            ),
        },
        "governance": {
            "measured_not_interpreted": True,
            "transition_and_lighting_events_are_candidates": True,
            "cadence_disclosed_per_sample": True,
            "source_timed": True,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if output_path:
        _atomic_json(Path(output_path), payload)
    return payload
