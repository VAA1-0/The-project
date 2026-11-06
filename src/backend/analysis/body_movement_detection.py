"""Conservative source-timed movement measurements from governed track geometry.

This producer measures displacement and scale change.  It deliberately does not
infer gestures, intention, emotion, or identity.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Mapping


SCHEMA = "vaa1.body_movement_detections.v1"
PROVIDER = "governed_identity_track_geometry_derivative"
PROVIDER_VERSION = "1.0.0"


def _number(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _point(item: Mapping[str, Any]) -> dict[str, float] | None:
    time = _number(item.get("time"))
    coords = item.get("coordinates") if isinstance(item.get("coordinates"), dict) else {}
    values = {key: _number(coords.get(key)) for key in ("x", "y", "w", "h")}
    if time is None or any(value is None for value in values.values()):
        return None
    if values["w"] <= 0 or values["h"] <= 0:
        return None
    return {"time": time, **values}  # type: ignore[arg-type]


def _movement_type(speed: float, scale_rate: float) -> str:
    if speed < 0.012 and abs(scale_rate) < 0.035:
        return "stationary_or_subthreshold_motion"
    if scale_rate >= 0.08:
        return "approaching_camera"
    if scale_rate <= -0.08:
        return "withdrawing_from_camera"
    return "translational_body_motion"


def build_body_movement_detections(status: Mapping[str, Any]) -> dict[str, Any]:
    corrections = status.get("annotation_corrections") if isinstance(status.get("annotation_corrections"), dict) else {}
    rows = []
    for annotation in corrections.get("manual_visual_annotations") or []:
        if not isinstance(annotation, dict):
            continue
        # Movement is only attached to an explicitly governed identity track.
        # A generic detector label (for example ``person``) is not sufficient.
        label = str(annotation.get("identity_affirmation") or annotation.get("narrative_agent_affirmation") or "").strip()
        if not label or not isinstance(annotation.get("geometry_keyframes"), list):
            continue
        points = sorted(filter(None, (_point(item) for item in annotation["geometry_keyframes"] if isinstance(item, dict))), key=lambda item: item["time"])
        if len(points) < 2:
            continue
        segments = []
        for left, right in zip(points, points[1:]):
            duration = right["time"] - left["time"]
            if duration <= 0 or duration > 15:
                continue
            left_center = (left["x"] + left["w"] / 2, left["y"] + left["h"] / 2)
            right_center = (right["x"] + right["w"] / 2, right["y"] + right["h"] / 2)
            displacement = math.dist(left_center, right_center)
            speed = displacement / duration
            left_area, right_area = left["w"] * left["h"], right["w"] * right["h"]
            scale_rate = (math.sqrt(right_area / left_area) - 1) / duration
            segments.append({"start": left["time"], "end": right["time"], "speed": speed, "scale_rate": scale_rate})
        if not segments:
            continue
        duration = sum(item["end"] - item["start"] for item in segments)
        mean_speed = sum(item["speed"] * (item["end"] - item["start"]) for item in segments) / duration
        mean_scale_rate = sum(item["scale_rate"] * (item["end"] - item["start"]) for item in segments) / duration
        movement_type = _movement_type(mean_speed, mean_scale_rate)
        measured_start = segments[0]["start"]
        measured_end = segments[-1]["end"]
        evidence_id = f"body-movement:{annotation.get('id')}:{measured_start:.3f}:{measured_end:.3f}"
        rows.append({
            "evidence_id": evidence_id,
            "analysis_id": status.get("analysis_id"),
            "source_annotation_id": annotation.get("id"),
            "narrative_agent_label": label,
            "start_seconds": measured_start,
            "end_seconds": measured_end,
            "movement_type": movement_type,
            "movement_intensity": round(min(1.0, mean_speed / 0.25), 6),
            "normalized_centroid_speed_per_second": round(mean_speed, 6),
            "normalized_scale_rate_per_second": round(mean_scale_rate, 6),
            "sample_count": len(points),
            "segment_count": len(segments),
            "bbox": {"x1": points[0]["x"], "y1": points[0]["y"], "x2": points[0]["x"] + points[0]["w"], "y2": points[0]["y"] + points[0]["h"]},
            "confidence": round(min(1.0, len(segments) / 12), 6),
            "state": "measured",
            "authority": "measured_candidate_evidence",
            "maturity": "candidate_only",
            "valid_for_constellational_support": True,
            "provider": PROVIDER,
            "provider_version": PROVIDER_VERSION,
            "limitations": ["Geometry motion does not establish gesture, intention, emotion, or speaker identity."],
            "traceback_refs": [str(annotation.get("id") or evidence_id)],
        })
    return {
        "schema": SCHEMA,
        "analysis_id": status.get("analysis_id"),
        "provider": PROVIDER,
        "provider_version": PROVIDER_VERSION,
        "measurement_count": len(rows),
        "measurements": rows,
        "items": rows,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "governance": {"candidate_only": True, "analyst_confirmation_overrides": True, "semantic_gesture_inference": False},
    }
