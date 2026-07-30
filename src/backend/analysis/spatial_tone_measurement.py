"""Source-linked color, brightness, contrast, and entropy measurements."""

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


SCHEMA = "vaa1.spatial_tone_measurement.v1"
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


def _band(value: float, low: float, high: float, labels: tuple[str, str, str]) -> str:
    if value < low:
        return labels[0]
    if value < high:
        return labels[1]
    return labels[2]


def _tone_family(mean_bgr: np.ndarray) -> str:
    blue, green, red = [float(value) for value in mean_bgr]
    if max(blue, green, red) - min(blue, green, red) < 18:
        return "dark neutral" if max(blue, green, red) < 70 else (
            "light neutral" if max(blue, green, red) > 190 else "neutral"
        )
    if green >= blue and green >= red:
        return "green"
    if blue >= green and blue >= red:
        return "blue-cyan"
    return "red-magenta" if red >= green and red >= blue else "mixed"


def _entropy(channel: np.ndarray) -> float:
    histogram = cv2.calcHist([channel], [0], None, [256], [0, 256]).ravel()
    total = float(histogram.sum())
    if total <= 0:
        return 0.0
    probabilities = histogram[histogram > 0] / total
    return float(-np.sum(probabilities * np.log2(probabilities)))


def _region_measurement(region: np.ndarray) -> Dict[str, Any]:
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    mean_bgr = region.mean(axis=(0, 1))
    mean_hsv = hsv.mean(axis=(0, 1))
    brightness = float(gray.mean())
    contrast = float(gray.std())
    saturation = float(mean_hsv[1])
    return {
        "dominant_tone": _tone_family(mean_bgr),
        "mean_bgr": {
            "blue": round(float(mean_bgr[0]), 3),
            "green": round(float(mean_bgr[1]), 3),
            "red": round(float(mean_bgr[2]), 3),
        },
        "brightness": round(brightness, 3),
        "brightness_band": _band(brightness, 70, 170, ("dark", "mid", "bright")),
        "contrast": round(contrast, 3),
        "contrast_band": _band(contrast, 22, 55, ("low", "moderate", "high")),
        "saturation": round(saturation, 3),
        "saturation_band": _band(saturation, 40, 110, ("low", "moderate", "high")),
        "luminance_entropy": round(_entropy(gray), 6),
    }


def measure_spatial_tone(
    video_path: str | Path,
    *,
    analysis_id: str,
    sample_interval_seconds: float = 1.0,
    output_path: str | Path | None = None,
) -> Dict[str, Any]:
    """Measure source-timed visual tone samples without inventing missing values."""

    source = Path(video_path)
    if not source.exists():
        raise FileNotFoundError(f"Source video not found: {source}")
    if sample_interval_seconds <= 0:
        raise ValueError("sample_interval_seconds must be positive")

    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise ValueError(f"Could not open source video: {source}")
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if fps <= 0:
        capture.release()
        raise ValueError("Source video has no usable frame rate")
    duration = frame_count / fps if frame_count > 0 else 0.0
    step_frames = max(1, int(round(sample_interval_seconds * fps)))
    rows: list[Dict[str, Any]] = []
    frame_index = 0

    try:
        while frame_count <= 0 or frame_index < frame_count:
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = capture.read()
            if not ok:
                break
            height, width = frame.shape[:2]
            timestamp = frame_index / fps
            next_timestamp = min(duration, (frame_index + step_frames) / fps) if duration else (
                timestamp + sample_interval_seconds
            )
            third_x, third_y = width // 3, height // 3
            regions = {
                "whole_frame": frame,
                "upper_left": frame[:third_y, :third_x],
                "upper_center": frame[:third_y, third_x : 2 * third_x],
                "upper_right": frame[:third_y, 2 * third_x :],
                "middle_left": frame[third_y : 2 * third_y, :third_x],
                "center": frame[third_y : 2 * third_y, third_x : 2 * third_x],
                "middle_right": frame[third_y : 2 * third_y, 2 * third_x :],
                "lower_left": frame[2 * third_y :, :third_x],
                "lower_center": frame[2 * third_y :, third_x : 2 * third_x],
                "lower_right": frame[2 * third_y :, 2 * third_x :],
            }
            rows.append({
                "sample_id": f"spatial-tone:{len(rows) + 1:06d}",
                "timestamp": round(timestamp, 6),
                "frame_index": frame_index,
                "interval": {
                    "start_seconds": round(timestamp, 6),
                    "end_seconds": round(max(timestamp, next_timestamp), 6),
                },
                "source_clock": "source_media.clock",
                "zones": {
                    name: _region_measurement(region)
                    for name, region in regions.items()
                    if region.size
                },
                "authority": "measured_automatic_detection",
                "review_state": "available",
            })
            frame_index += step_frames
    finally:
        capture.release()

    whole_frames = [row["zones"]["whole_frame"] for row in rows]
    tone_distribution: Dict[str, int] = {}
    for item in whole_frames:
        tone = str(item["dominant_tone"])
        tone_distribution[tone] = tone_distribution.get(tone, 0) + 1

    def mean_of(field: str) -> float | None:
        values = [float(item[field]) for item in whole_frames if item.get(field) is not None]
        return round(sum(values) / len(values), 6) if values else None

    payload = {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "status": "completed_measured",
        "method": "OpenCV source-frame window measurement",
        "provider": "opencv",
        "provider_version": PROVIDER_VERSION,
        "parameters": {"sample_interval_seconds": float(sample_interval_seconds)},
        "source": "source_video_sampled_frames",
        "source_video_path": str(source),
        "source_video_sha256": _sha256(source),
        "source_clock": "source_media.clock",
        "samples": rows,
        "summary": {
            "sample_count": len(rows),
            "mean_brightness": mean_of("brightness"),
            "mean_contrast": mean_of("contrast"),
            "mean_saturation": mean_of("saturation"),
            "mean_luminance_entropy": mean_of("luminance_entropy"),
            "dominant_tone_distribution": tone_distribution,
        },
        "governance": {
            "measured_not_interpreted": True,
            "semantic_color_meaning_requires_review": True,
            "no_zero_fill_for_missing_samples": True,
            "source_timed": True,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if output_path:
        _atomic_json(Path(output_path), payload)
    return payload
