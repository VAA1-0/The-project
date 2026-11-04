"""Local measured object-appearance embeddings for governed cluster review.

The first motor deliberately uses deterministic OpenCV/NumPy measurements so
it can operate without downloading model weights.  It measures appearance; it
does not assert semantic identity and it never turns similarity into maturity.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple


SCHEMA = "datascene.measured_object_appearance.v1"
MODEL_CHOICE_KEY = "object_appearance_embedding"
DEFAULT_MODEL = "Datascene Native Object Appearance v1"
DEFAULT_COSINE_THRESHOLD = 0.78
DEFAULT_AMBIGUITY_MARGIN = 0.04
DEFAULT_SAMPLE_COUNT = 5
CONTEXT_AXIS_KEYS = (
    "media_genre",
    "media_subgenre",
    "situational_genre",
    "situational_subgenre",
    "privacy",
    "expertise",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _number(value: Any) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _mapping(value: Any) -> Dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def _items(value: Any) -> List[Dict[str, Any]]:
    return [dict(item) for item in value or [] if isinstance(item, Mapping)]


def _review_context(value: Any) -> Dict[str, str]:
    context = _mapping(value)
    return {
        key: str(context.get(key) or "").strip()
        for key in CONTEXT_AXIS_KEYS
        if str(context.get(key) or "").strip()
    }


def _source_video(status: Mapping[str, Any]) -> Optional[Path]:
    for candidate in (
        status.get("source_video_path"),
        status.get("video_path"),
        _mapping(status.get("results")).get("source_video_path"),
    ):
        if candidate:
            path = Path(str(candidate)).expanduser()
            if path.is_file():
                return path
    return None


def model_runtime_state() -> Dict[str, Any]:
    try:
        import cv2
        import numpy

        return {
            "available": True,
            "provider": "OpenCV + NumPy",
            "provider_version": f"opencv {cv2.__version__}; numpy {numpy.__version__}",
            "model_files": [],
            "missing": [],
            "network_access": "disabled_by_design",
            "installation_command": None,
            "readiness": "installed_and_ready",
        }
    except ImportError as exc:
        return {
            "available": False,
            "provider": "OpenCV + NumPy",
            "provider_version": None,
            "model_files": [],
            "missing": [str(exc)],
            "network_access": "disabled_by_design",
            "installation_command": "install the pinned OpenCV and NumPy environment",
            "readiness": "runtime_missing",
        }


def _normalize(values: Sequence[float]) -> List[float]:
    magnitude = math.sqrt(sum(float(value) ** 2 for value in values))
    return [float(value) / magnitude for value in values] if magnitude else [0.0 for value in values]


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> Optional[float]:
    if not left or not right or len(left) != len(right):
        return None
    normalized_left = _normalize(left)
    normalized_right = _normalize(right)
    return max(-1.0, min(1.0, sum(a * b for a, b in zip(normalized_left, normalized_right))))


def _mean_embedding(vectors: Sequence[Sequence[float]]) -> Optional[List[float]]:
    rows = [list(vector) for vector in vectors if vector]
    if not rows or any(len(row) != len(rows[0]) for row in rows):
        return None
    return _normalize([sum(row[index] for row in rows) / len(rows) for index in range(len(rows[0]))])


def _bbox_pixels(geometry: Any, width: int, height: int) -> Optional[Tuple[int, int, int, int, bool]]:
    wrapper = _mapping(geometry)
    bbox = _mapping(wrapper.get("bbox")) or wrapper
    x1 = _number(bbox.get("x1", bbox.get("x", bbox.get("left"))))
    y1 = _number(bbox.get("y1", bbox.get("y", bbox.get("top"))))
    x2 = _number(bbox.get("x2"))
    y2 = _number(bbox.get("y2"))
    box_width = _number(bbox.get("width", bbox.get("w")))
    box_height = _number(bbox.get("height", bbox.get("h")))
    if x2 is None and x1 is not None and box_width is not None:
        x2 = x1 + box_width
    if y2 is None and y1 is not None and box_height is not None:
        y2 = y1 + box_height
    if None in {x1, y1, x2, y2}:
        return None
    normalized = (
        str(wrapper.get("coordinate_system") or "").lower() == "normalized"
        or max(abs(x1), abs(y1), abs(x2), abs(y2)) <= 1.5
    )
    if normalized:
        x1, x2 = x1 * width, x2 * width
        y1, y2 = y1 * height, y2 * height
    x1, x2 = sorted((x1, x2))
    y1, y2 = sorted((y1, y2))
    clipped = x1 < 0 or y1 < 0 or x2 > width or y2 > height
    pad_x, pad_y = (x2 - x1) * 0.08, (y2 - y1) * 0.08
    left = max(0, min(width - 1, int(round(x1 - pad_x))))
    top = max(0, min(height - 1, int(round(y1 - pad_y))))
    right = max(left + 1, min(width, int(round(x2 + pad_x))))
    bottom = max(top + 1, min(height, int(round(y2 + pad_y))))
    return left, top, right, bottom, clipped


def appearance_embedding(crop: Any) -> Tuple[List[float], Dict[str, Any]]:
    """Return a deterministic, fixed-length colour/shape/texture descriptor."""
    import cv2
    import numpy as np

    resized = cv2.resize(crop, (64, 64), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    hsv_hist = cv2.calcHist([hsv], [0, 1], None, [16, 8], [0, 180, 0, 256]).flatten()
    lab_hist = cv2.calcHist([lab], [1, 2], None, [8, 8], [0, 256, 0, 256]).flatten()
    hog = cv2.HOGDescriptor((64, 64), (16, 16), (8, 8), (8, 8), 9).compute(gray).flatten()
    coarse = cv2.resize(gray, (16, 16), interpolation=cv2.INTER_AREA).astype(np.float32).flatten()
    coarse = (coarse - float(coarse.mean())) / max(float(coarse.std()), 1.0)

    groups = [_normalize(hsv_hist.tolist()), _normalize(lab_hist.tolist()), _normalize(hog.tolist()), _normalize(coarse.tolist())]
    embedding = _normalize([value for group in groups for value in group])
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    return embedding, {
        "embedding_dimensions": len(embedding),
        "blur_variance": round(blur_variance, 6),
        "mean_luminance": round(float(gray.mean()), 6),
        "contrast": round(float(gray.std()), 6),
    }


def _sample_times(item: Mapping[str, Any], sample_count: int) -> List[float]:
    interval = _mapping(item.get("source_time")) or _mapping(item.get("time"))
    start = _number(interval.get("start", interval.get("start_seconds", item.get("start"))))
    end = _number(interval.get("end", interval.get("end_seconds", item.get("end"))))
    if start is None:
        return []
    end = max(start, end if end is not None else start)
    if end - start <= 0.04 or sample_count <= 1:
        return [start]
    safe_end = max(start, end - 0.001)
    return sorted({round(start + (safe_end - start) * index / (sample_count - 1), 6) for index in range(sample_count)})


def _measure_member(capture: Any, item: Mapping[str, Any], sample_count: int) -> Dict[str, Any]:
    import cv2

    member_id = str(item.get("evidence_id") or item.get("sample_id") or item.get("track_id") or "object")
    timestamps = _sample_times(item, sample_count)
    if not timestamps:
        return {"evidence_id": member_id, "measurement_state": "excluded", "exclusion_reasons": ["missing_source_time"]}
    vectors: List[List[float]] = []
    samples: List[Dict[str, Any]] = []
    reasons: List[str] = []
    for timestamp in timestamps:
        capture.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000.0)
        ok, frame = capture.read()
        if not ok or frame is None:
            reasons.append("frame_decode_failed")
            continue
        height, width = frame.shape[:2]
        bounds = _bbox_pixels(item.get("geometry") or item.get("bbox"), width, height)
        if bounds is None:
            reasons.append("missing_or_invalid_bbox")
            continue
        left, top, right, bottom, clipped = bounds
        crop = frame[top:bottom, left:right]
        if crop.size == 0 or min(crop.shape[:2]) < 20:
            reasons.append("crop_too_small")
            continue
        vector, metrics = appearance_embedding(crop)
        vectors.append(vector)
        samples.append({
            "source_time": timestamp,
            "crop_pixels": {"width": int(crop.shape[1]), "height": int(crop.shape[0])},
            "boundary_clipped": clipped,
            **metrics,
        })
    embedding = _mean_embedding(vectors)
    if embedding is None:
        return {
            "evidence_id": member_id,
            "track_id": item.get("track_id"),
            "measurement_state": "excluded",
            "sample_count": 0,
            "exclusion_reasons": sorted(set(reasons)) or ["no_usable_source_crop"],
        }
    digest = hashlib.sha256(json.dumps(embedding, separators=(",", ":")).encode("utf-8")).hexdigest()
    within = [cosine_similarity(vector, embedding) or 0.0 for vector in vectors]
    return {
        "evidence_id": member_id,
        "track_id": item.get("track_id"),
        "source_time": item.get("source_time") or item.get("time"),
        "measurement_state": "measured",
        "requested_sample_count": len(timestamps),
        "sample_count": len(samples),
        "sample_cohesion": round(sum(within) / len(within), 6),
        "embedding_dimensions": len(embedding),
        "embedding_sha256": digest,
        "samples": samples,
        "exclusion_reasons": sorted(set(reasons)),
        "embedding": embedding,
    }


def build_object_appearance_measurement(
    analysis_id: str,
    status: Mapping[str, Any],
    request: Mapping[str, Any],
) -> Dict[str, Any]:
    runtime = model_runtime_state()
    selected_model = str(request.get("model") or _mapping(status.get("model_choices")).get(MODEL_CHOICE_KEY) or DEFAULT_MODEL)
    threshold = _number(request.get("cosine_similarity_threshold")) or DEFAULT_COSINE_THRESHOLD
    ambiguity = _number(request.get("ambiguity_margin")) or DEFAULT_AMBIGUITY_MARGIN
    sample_count = max(1, min(9, int(_number(request.get("sample_count")) or DEFAULT_SAMPLE_COUNT)))
    review_context = _review_context(request.get("review_context"))
    base = {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "request_id": request.get("request_id"),
        "created_at": _now_iso(),
        "model": {
            "choice_key": MODEL_CHOICE_KEY,
            "name": selected_model,
            "provider": "Datascene / OpenCV + NumPy",
            "feature_groups": ["HSV colour", "Lab colour", "HOG edge orientation", "coarse luminance layout"],
            "distance_metric": "cosine_similarity",
            "license": "Datascene code; OpenCV Apache-2.0; NumPy BSD-3-Clause",
            "local_processing": True,
        },
        "settings": {"cosine_similarity_threshold": threshold, "ambiguity_margin": ambiguity, "samples_per_track": sample_count},
        "runtime": runtime,
        "governance": {
            "candidate_only_until_analyst_confirmation": True,
            "score_is_not_calibrated_probability": True,
            "detector_confidence_is_not_embedding_similarity": True,
            "raw_detector_label_preserved": True,
            "embedding_export_default": "withheld",
            "manual_correction_wins": True,
            "genre_and_situation_do_not_change_similarity": True,
            "context_cannot_create_semantic_object_truth": True,
            "ontology_relations_require_separate_governed_decisions": True,
        },
        "review_context": {
            "axes": review_context,
            "effect": "review_priority_and_specialist_sweep_context_only",
            "measurement_effect": "none",
            "semantic_effect": "none_until_governed_analyst_decision",
            "genre_detection_state": "not_inferred_by_object_appearance",
            "situational_claim_state": "not_inferred_by_object_appearance",
        },
    }
    if selected_model != DEFAULT_MODEL:
        return {**base, "status": "model_not_operational", "message": f"The selected second-iteration provider is not installed: {selected_model}", "families": []}
    if not runtime["available"]:
        return {**base, "status": "runtime_missing", "message": "OpenCV and NumPy are required for native appearance measurement.", "families": []}
    source = _source_video(status)
    if source is None:
        return {**base, "status": "source_video_missing", "message": "The selected analysis has no readable source video.", "families": []}

    import cv2

    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        return {**base, "status": "source_video_unreadable", "message": "OpenCV could not open the source video.", "families": []}
    measured: Dict[str, Dict[str, Any]] = {}
    family_rows: List[Dict[str, Any]] = []
    try:
        for family_index, family in enumerate(_items(request.get("families"))):
            key = str(family.get("key") or family.get("label") or f"family:{family_index}")
            members = []
            for member in _items(family.get("members")):
                member_id = str(member.get("evidence_id") or member.get("sample_id") or member.get("track_id") or f"{key}:{len(members)}")
                measurement = measured.get(member_id)
                if measurement is None:
                    measurement = _measure_member(capture, {**member, "evidence_id": member_id}, sample_count)
                    measured[member_id] = measurement
                members.append(measurement)
            vectors = [member.get("embedding") for member in members if member.get("measurement_state") == "measured"]
            centroid = _mean_embedding(vectors)
            public_members = []
            for member in members:
                public = {name: value for name, value in member.items() if name != "embedding"}
                similarity = cosine_similarity(member.get("embedding") or [], centroid or [])
                public["family_cosine_similarity"] = round(similarity, 6) if similarity is not None else None
                public_members.append(public)
            ranked = sorted(
                [member for member in public_members if member.get("family_cosine_similarity") is not None],
                key=lambda item: (-item["family_cosine_similarity"], item["evidence_id"]),
            )
            family_rows.append({
                "key": key,
                "label": family.get("label") or key,
                "member_count": len(members),
                "measured_member_count": len(ranked),
                "measurement_state": "measured" if centroid else "embedding_required",
                "cohesion": round(sum(item["family_cosine_similarity"] for item in ranked) / len(ranked), 6) if ranked else None,
                "representative_evidence_id": ranked[0]["evidence_id"] if ranked else None,
                "boundary_evidence_id": ranked[-1]["evidence_id"] if ranked else None,
                "members": public_members,
                "centroid": centroid,
            })
    finally:
        capture.release()

    for family in family_rows:
        centroid = family.get("centroid")
        competitors = []
        for other in family_rows:
            if other["key"] == family["key"] or not centroid or not other.get("centroid"):
                continue
            similarity = cosine_similarity(centroid, other["centroid"])
            if similarity is not None:
                competitors.append((similarity, other["key"], other["label"]))
        competitors.sort(reverse=True)
        nearest = competitors[0] if competitors else None
        family["nearest_competing_family_key"] = nearest[1] if nearest else None
        family["nearest_competing_family_label"] = nearest[2] if nearest else None
        family["nearest_competing_similarity"] = round(nearest[0], 6) if nearest else None
        family["ambiguity_margin"] = round((family.get("cohesion") or 0.0) - nearest[0], 6) if nearest else None
        family["eligible_for_review"] = bool(
            family.get("cohesion") is not None
            and family["cohesion"] >= threshold
            and (nearest is None or family["cohesion"] - nearest[0] >= ambiguity)
        )
        family.pop("centroid", None)

    embedding_index = {
        member_id: {
            "embedding": row.get("embedding"),
            "embedding_dimensions": row.get("embedding_dimensions"),
            "embedding_sha256": row.get("embedding_sha256"),
        }
        for member_id, row in measured.items()
        if row.get("embedding")
    }
    return {
        **base,
        "status": "completed_measured",
        "source_video_path": str(source),
        "family_count": len(family_rows),
        "member_count": sum(row["member_count"] for row in family_rows),
        "measured_member_count": sum(row["measured_member_count"] for row in family_rows),
        "families": family_rows,
        "embedding_index": embedding_index,
    }


def write_object_appearance_measurement(
    analysis_id: str,
    status: Mapping[str, Any],
    request: Mapping[str, Any],
    output_path: Path,
) -> Dict[str, Any]:
    result = build_object_appearance_measurement(analysis_id, status, request)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result
