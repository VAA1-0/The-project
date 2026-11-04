"""Measured face landmarks and embeddings for governed Narrative Agent review.

The motor is deliberately local and optional. It uses OpenCV YuNet to measure a
face box plus five landmarks, then OpenCV SFace to calculate an embedding. Model
files are never downloaded implicitly: missing weights produce an explicit
runtime state that the UI can explain.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


SCHEMA = "datascene.measured_face_discrimination.v1"
MODEL_CHOICE_KEY = "facial_landmark_embedding"
DEFAULT_MODEL = "OpenCV YuNet + SFace"
DEFAULT_COSINE_THRESHOLD = 0.363
DEFAULT_AMBIGUITY_MARGIN = 0.05
DEFAULT_DETECTION_THRESHOLD = 0.85
MODEL_FILENAMES = {
    "detector": "face_detection_yunet_2023mar.onnx",
    "embedding": "face_recognition_sface_2021dec.onnx",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _float(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _mapping(value: Any) -> Dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def _items(value: Any) -> List[Dict[str, Any]]:
    return [dict(item) for item in value or [] if isinstance(item, Mapping)]


def _source_video(status: Mapping[str, Any]) -> Optional[Path]:
    candidates = [
        status.get("source_video_path"),
        status.get("video_path"),
        _mapping(status.get("results")).get("source_video_path"),
    ]
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(str(candidate)).expanduser()
        if path.exists() and path.is_file():
            return path
    return None


def default_model_dir() -> Path:
    configured = str(os.environ.get("DATASCENE_FACE_MODEL_DIR") or "").strip()
    if configured:
        return Path(configured).expanduser()
    return Path(__file__).resolve().parents[3] / "models" / "face"


def model_runtime_state(model_dir: Optional[Path] = None) -> Dict[str, Any]:
    root = model_dir or default_model_dir()
    files = {key: root / filename for key, filename in MODEL_FILENAMES.items()}
    missing = [str(path) for path in files.values() if not path.is_file()]
    return {
        "model": DEFAULT_MODEL,
        "provider": "OpenCV DNN",
        "provider_version": None,
        "model_dir": str(root),
        "files": {key: str(path) for key, path in files.items()},
        "available": not missing,
        "missing": missing,
        "network_access": "disabled_by_design",
        "installation_command": "python scripts/install_face_measurement_models.py",
    }


def _bbox_pixels(geometry: Any, width: int, height: int) -> Optional[Tuple[int, int, int, int]]:
    wrapper = _mapping(geometry)
    bbox = _mapping(wrapper.get("bbox")) or wrapper
    x = _float(bbox.get("x", bbox.get("left", bbox.get("x1"))))
    y = _float(bbox.get("y", bbox.get("top", bbox.get("y1"))))
    box_width = _float(bbox.get("width", bbox.get("w")))
    box_height = _float(bbox.get("height", bbox.get("h")))
    x2 = _float(bbox.get("x2"))
    y2 = _float(bbox.get("y2"))
    if box_width is None and x is not None and x2 is not None:
        box_width = x2 - x
    if box_height is None and y is not None and y2 is not None:
        box_height = y2 - y
    if None in {x, y, box_width, box_height}:
        return None
    normalized = (
        str(wrapper.get("coordinate_system") or "").lower() == "normalized"
        or max(abs(x), abs(y), abs(box_width), abs(box_height)) <= 1.5
    )
    if normalized:
        x, box_width = x * width, box_width * width
        y, box_height = y * height, box_height * height
    left = max(0, min(width - 1, int(round(x))))
    top = max(0, min(height - 1, int(round(y))))
    right = max(left + 1, min(width, int(round(x + abs(box_width)))))
    bottom = max(top + 1, min(height, int(round(y + abs(box_height)))))
    return left, top, right, bottom


def _cosine(left: Sequence[float], right: Sequence[float]) -> Optional[float]:
    if not left or not right or len(left) != len(right):
        return None
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return None
    return max(-1.0, min(1.0, dot / (left_norm * right_norm)))


def _mean_embedding(vectors: Iterable[Sequence[float]]) -> Optional[List[float]]:
    rows = [list(vector) for vector in vectors if vector]
    if not rows or any(len(row) != len(rows[0]) for row in rows):
        return None
    mean = [sum(row[index] for row in rows) / len(rows) for index in range(len(rows[0]))]
    norm = math.sqrt(sum(value * value for value in mean))
    return [value / norm for value in mean] if norm else None


def _stable_occurrence_id(item: Mapping[str, Any], prefix: str, index: int) -> str:
    return str(item.get("evidence_id") or item.get("sample_id") or item.get("occurrence_id") or f"{prefix}:{index}")


def _time(item: Mapping[str, Any]) -> Optional[float]:
    interval = _mapping(item.get("time")) or _mapping(item.get("source_interval"))
    return _float(interval.get("start", interval.get("start_seconds", item.get("start"))))


def _measure_occurrence(
    *,
    capture: Any,
    detector: Any,
    recognizer: Any,
    item: Mapping[str, Any],
    occurrence_id: str,
    detection_threshold: float,
) -> Dict[str, Any]:
    import cv2

    timestamp = _time(item)
    if timestamp is None:
        return {"occurrence_id": occurrence_id, "measurement_state": "excluded", "exclusion_reason": "missing_source_time"}
    capture.set(cv2.CAP_PROP_POS_MSEC, max(0.0, timestamp) * 1000.0)
    ok, frame = capture.read()
    if not ok or frame is None:
        return {"occurrence_id": occurrence_id, "source_time": timestamp, "measurement_state": "excluded", "exclusion_reason": "frame_decode_failed"}
    frame_height, frame_width = frame.shape[:2]
    person_box = _bbox_pixels(item.get("geometry") or item.get("bbox"), frame_width, frame_height)
    if person_box:
        left, top, right, bottom = person_box
        pad_x = int((right - left) * 0.12)
        pad_y = int((bottom - top) * 0.08)
        left, top = max(0, left - pad_x), max(0, top - pad_y)
        right, bottom = min(frame_width, right + pad_x), min(frame_height, bottom + pad_y)
        crop = frame[top:bottom, left:right]
    else:
        left, top, right, bottom = 0, 0, frame_width, frame_height
        crop = frame
    if crop.size == 0 or min(crop.shape[:2]) < 20:
        return {"occurrence_id": occurrence_id, "source_time": timestamp, "measurement_state": "excluded", "exclusion_reason": "crop_too_small"}
    detector.setInputSize((crop.shape[1], crop.shape[0]))
    _, faces = detector.detect(crop)
    if faces is None or not len(faces):
        return {"occurrence_id": occurrence_id, "source_time": timestamp, "measurement_state": "excluded", "exclusion_reason": "no_face_detected"}
    ranked = sorted(faces, key=lambda row: float(row[-1]) * max(1.0, float(row[2]) * float(row[3])), reverse=True)
    face = ranked[0]
    confidence = float(face[-1])
    if confidence < detection_threshold:
        return {"occurrence_id": occurrence_id, "source_time": timestamp, "measurement_state": "excluded", "exclusion_reason": "face_confidence_below_threshold", "face_confidence": round(confidence, 6)}
    aligned = recognizer.alignCrop(crop, face)
    feature = recognizer.feature(aligned).flatten().astype(float)
    norm = float((feature @ feature) ** 0.5)
    embedding = (feature / norm).tolist() if norm else feature.tolist()
    face_x, face_y, face_width, face_height = [float(value) for value in face[:4]]
    absolute_x, absolute_y = left + face_x, top + face_y
    face_geometry = {
        "geometry_type": "bbox",
        "coordinate_system": "normalized",
        "bbox": {
            "x": round(absolute_x / frame_width, 8),
            "y": round(absolute_y / frame_height, 8),
            "width": round(face_width / frame_width, 8),
            "height": round(face_height / frame_height, 8),
        },
    }
    landmark_names = ["right_eye", "left_eye", "nose", "right_mouth", "left_mouth"]
    landmark_values = list(face[4:14])
    landmarks = {
        name: {
            "x": round((left + float(landmark_values[index * 2])) / frame_width, 8),
            "y": round((top + float(landmark_values[index * 2 + 1])) / frame_height, 8),
        }
        for index, name in enumerate(landmark_names)
    }
    digest = hashlib.sha256(json.dumps(embedding, separators=(",", ":")).encode("utf-8")).hexdigest()
    return {
        "occurrence_id": occurrence_id,
        "source_time": timestamp,
        "measurement_state": "measured",
        "face_confidence": round(confidence, 6),
        "face_geometry": face_geometry,
        "landmarks": landmarks,
        "landmark_count": len(landmarks),
        "embedding": embedding,
        "embedding_dimensions": len(embedding),
        "embedding_sha256": digest,
    }


def build_face_discrimination(
    analysis_id: str,
    status: Mapping[str, Any],
    request: Mapping[str, Any],
    *,
    model_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    runtime = model_runtime_state(model_dir)
    selected_model = str(request.get("model") or _mapping(status.get("model_choices")).get(MODEL_CHOICE_KEY) or DEFAULT_MODEL)
    base = {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "request_id": request.get("request_id"),
        "created_at": _now_iso(),
        "model": {
            "choice_key": MODEL_CHOICE_KEY,
            "name": selected_model,
            "provider": "OpenCV DNN",
            "detector": "YuNet 2023mar",
            "embedding": "SFace 2021dec",
            "distance_metric": "cosine_similarity",
            "license": "YuNet MIT; SFace Apache-2.0",
            "local_processing": True,
        },
        "settings": {
            "face_detection_threshold": _float(request.get("face_detection_threshold")) or DEFAULT_DETECTION_THRESHOLD,
            "cosine_similarity_threshold": _float(request.get("cosine_similarity_threshold")) or DEFAULT_COSINE_THRESHOLD,
            "ambiguity_margin": _float(request.get("ambiguity_margin")) or DEFAULT_AMBIGUITY_MARGIN,
        },
        "runtime": runtime,
        "governance": {
            "candidate_only_until_analyst_confirmation": True,
            "score_is_not_calibrated_probability": True,
            "raw_person_geometry_preserved": True,
            "biometric_derivative_local_only": True,
            "embedding_export_default": "withheld",
            "manual_correction_wins": True,
        },
    }
    if selected_model != DEFAULT_MODEL:
        return {**base, "status": "model_not_supported", "message": f"Selected model is not operational: {selected_model}", "families": [], "candidates": []}
    if not runtime["available"]:
        return {**base, "status": "model_files_missing", "message": "Install the explicitly selected local face models before measurement.", "families": [], "candidates": []}
    source_video = _source_video(status)
    if source_video is None:
        return {**base, "status": "source_video_missing", "message": "The selected analysis has no readable source video.", "families": [], "candidates": []}

    import cv2

    runtime["provider_version"] = cv2.__version__
    detector = cv2.FaceDetectorYN_create(runtime["files"]["detector"], "", (320, 320), base["settings"]["face_detection_threshold"], 0.3, 5000)
    recognizer = cv2.FaceRecognizerSF_create(runtime["files"]["embedding"], "")
    capture = cv2.VideoCapture(str(source_video))
    if not capture.isOpened():
        return {**base, "status": "source_video_unreadable", "message": "OpenCV could not open the source video.", "families": [], "candidates": []}
    try:
        family_measurements: List[Dict[str, Any]] = []
        centroids: Dict[str, List[float]] = {}
        measured_cache: Dict[str, Dict[str, Any]] = {}
        requested_families = _items(request.get("families"))
        for family_index, family in enumerate(requested_families):
            family_key = str(family.get("key") or f"family:{family_index}")
            seeds = []
            for seed_index, seed in enumerate(_items(family.get("seeds"))):
                occurrence_id = _stable_occurrence_id(seed, f"{family_key}:seed", seed_index)
                measurement = measured_cache.get(occurrence_id)
                if measurement is None:
                    measurement = _measure_occurrence(capture=capture, detector=detector, recognizer=recognizer, item=seed, occurrence_id=occurrence_id, detection_threshold=base["settings"]["face_detection_threshold"])
                    measured_cache[occurrence_id] = measurement
                seeds.append({key: value for key, value in measurement.items() if key != "embedding"})
            vectors = [measured_cache[_stable_occurrence_id(seed, f"{family_key}:seed", index)].get("embedding") for index, seed in enumerate(_items(family.get("seeds")))]
            centroid = _mean_embedding(vector for vector in vectors if vector)
            if centroid:
                centroids[family_key] = centroid
            family_measurements.append({
                "key": family_key,
                "label": family.get("label") or family_key,
                "seed_count": len(seeds),
                "measured_seed_count": sum(1 for seed in seeds if seed.get("measurement_state") == "measured"),
                "measurement_state": "measured" if centroid else "embedding_required",
                "seeds": seeds,
            })

        candidate_results = []
        similarity_threshold = base["settings"]["cosine_similarity_threshold"]
        ambiguity_margin = base["settings"]["ambiguity_margin"]
        for candidate_index, candidate in enumerate(_items(request.get("candidates"))):
            occurrence_id = _stable_occurrence_id(candidate, "candidate", candidate_index)
            measurement = measured_cache.get(occurrence_id)
            if measurement is None:
                measurement = _measure_occurrence(capture=capture, detector=detector, recognizer=recognizer, item=candidate, occurrence_id=occurrence_id, detection_threshold=base["settings"]["face_detection_threshold"])
                measured_cache[occurrence_id] = measurement
            public_measurement = {key: value for key, value in measurement.items() if key != "embedding"}
            vector = measurement.get("embedding")
            scores = sorted(
                ({"family_key": key, "cosine_similarity": round(_cosine(vector, centroid) or -1.0, 6)} for key, centroid in centroids.items()),
                key=lambda item: item["cosine_similarity"],
                reverse=True,
            ) if vector else []
            best = scores[0] if scores else None
            runner_up = scores[1] if len(scores) > 1 else None
            margin = (best["cosine_similarity"] - runner_up["cosine_similarity"]) if best and runner_up else (1.0 if best else None)
            competing_measurement_ready = len(requested_families) <= 1 or len(centroids) >= 2
            eligible = bool(
                competing_measurement_ready
                and best
                and best["cosine_similarity"] >= similarity_threshold
                and margin is not None
                and margin >= ambiguity_margin
            )
            exclusion_reason = public_measurement.get("exclusion_reason")
            if not exclusion_reason and not centroids:
                exclusion_reason = "no_measured_family_seed"
            elif not exclusion_reason and not competing_measurement_ready:
                exclusion_reason = "insufficient_competing_family_measurement"
            elif not exclusion_reason and best and best["cosine_similarity"] < similarity_threshold:
                exclusion_reason = "below_face_similarity_threshold"
            elif not exclusion_reason and margin is not None and margin < ambiguity_margin:
                exclusion_reason = "competing_family_margin"
            candidate_results.append({
                **public_measurement,
                "evidence_id": occurrence_id,
                "scores": scores,
                "best_family_key": best["family_key"] if best else None,
                "cosine_similarity": best["cosine_similarity"] if best else None,
                "runner_up_similarity": runner_up["cosine_similarity"] if runner_up else None,
                "ambiguity_margin": round(margin, 6) if margin is not None else None,
                "eligible_for_family_review": eligible,
                "review_state": "measured_candidate" if eligible else "unresolved",
                "exclusion_reason": None if eligible else exclusion_reason,
            })
    finally:
        capture.release()

    return {
        **base,
        "status": "completed_measured",
        "source_video_path": str(source_video),
        "family_count": len(family_measurements),
        "candidate_count": len(candidate_results),
        "measured_candidate_count": sum(1 for item in candidate_results if item.get("measurement_state") == "measured"),
        "eligible_candidate_count": sum(1 for item in candidate_results if item.get("eligible_for_family_review")),
        "families": family_measurements,
        "candidates": candidate_results,
        "embedding_index": {
            occurrence_id: {
                "embedding": measurement.get("embedding"),
                "embedding_dimensions": measurement.get("embedding_dimensions"),
                "embedding_sha256": measurement.get("embedding_sha256"),
            }
            for occurrence_id, measurement in measured_cache.items()
            if measurement.get("measurement_state") == "measured" and measurement.get("embedding")
        },
    }


def write_face_discrimination(
    analysis_id: str,
    status: Mapping[str, Any],
    request: Mapping[str, Any],
    output_path: Path,
    *,
    model_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    result = build_face_discrimination(analysis_id, status, request, model_dir=model_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result
