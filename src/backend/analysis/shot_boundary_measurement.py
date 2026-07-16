"""Measured source-video shot boundaries using the local PySceneDetect provider."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


SCHEMA = "vaa1.shot_boundary_intervals.v1"
PROVIDER_VERSION = "pyscenedetect-content-detector.1.0.0"


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


def measure_shot_boundaries(
    video_path: str | Path,
    *,
    analysis_id: str,
    threshold: float = 27.0,
    min_scene_len_frames: int = 10,
    output_path: str | Path | None = None,
) -> Dict[str, Any]:
    """Measure complete shot intervals; never substitutes scene-card intervals."""
    from scenedetect import ContentDetector, SceneManager, open_video

    source = Path(video_path)
    if not source.exists():
        raise FileNotFoundError(f"Source video not found: {source}")
    if threshold <= 0 or min_scene_len_frames < 1:
        raise ValueError("threshold and min_scene_len_frames must be positive")
    video = open_video(str(source))
    manager = SceneManager()
    manager.add_detector(ContentDetector(threshold=float(threshold), min_scene_len=int(min_scene_len_frames)))
    manager.detect_scenes(video, show_progress=False)
    detected = manager.get_scene_list(start_in_scene=True)
    intervals = []
    for index, (start_time, end_time) in enumerate(detected, start=1):
        start, end = float(start_time.get_seconds()), float(end_time.get_seconds())
        if end <= start:
            continue
        intervals.append({
            "shot_id": f"shot:{index:04d}", "start": round(start, 6), "end": round(end, 6),
            "duration": round(end - start, 6), "boundary_in": round(start, 6) if index > 1 else None,
            "boundary_out": round(end, 6) if index < len(detected) else None,
            "confidence": None, "source": "pyscenedetect_content_detector", "review_state": "available",
        })
    boundaries = [{
        "boundary_id": f"shot-boundary:{index:04d}", "time": item["boundary_out"],
        "pre_shot_id": item["shot_id"], "post_shot_id": intervals[index + 1]["shot_id"],
        "source": "pyscenedetect_content_detector",
    } for index, item in enumerate(intervals[:-1])]
    payload = {
        "schema": SCHEMA, "analysis_id": analysis_id, "status": "completed_measured",
        "method": "PySceneDetect ContentDetector", "provider_version": PROVIDER_VERSION,
        "parameters": {"threshold": float(threshold), "min_scene_len_frames": int(min_scene_len_frames)},
        "source": "pyscenedetect_content_detector", "source_video_path": str(source),
        "source_video_sha256": _sha256(source), "true_boundary_intervals": True,
        "intervals": intervals, "boundaries": boundaries,
        "summary": {"shot_count": len(intervals), "boundary_count": len(boundaries),
                    "mean_shot_duration": round(sum(x["duration"] for x in intervals) / len(intervals), 6) if intervals else None},
        "governance": {"not_scene_segments": True, "algorithmic_boundaries_require_review_for_semantic_use": True,
                       "no_proxy_fallback": True},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if output_path:
        _atomic_json(Path(output_path), payload)
    return payload
