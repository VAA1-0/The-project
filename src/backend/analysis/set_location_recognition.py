"""Measured wide-frame recurrence for set/location cluster exploration.

This native motor groups visually recurring environments. It does not infer a
geographic place or mature a semantic set name. Source Media location metadata
is joined by consumers as separately attributed proposal evidence.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile
from typing import Any, Dict, List

import cv2
import numpy as np


SCHEMA = "datascene.measured_set_location_recurrence.v1"
PROVIDER_VERSION = f"datascene-native-opencv.{cv2.__version__}"


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


def _normalize(vector: np.ndarray) -> np.ndarray:
    magnitude = float(np.linalg.norm(vector))
    return vector / magnitude if magnitude else np.zeros_like(vector)


def wide_frame_embedding(frame: np.ndarray) -> tuple[np.ndarray, Dict[str, float]]:
    """Describe colour, layout, edges and texture without semantic inference."""
    resized = cv2.resize(frame, (96, 54), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    colour = cv2.calcHist([hsv], [0, 1], None, [18, 8], [0, 180, 0, 256]).ravel()
    colour = _normalize(colour.astype(np.float32))
    layout = cv2.resize(gray, (16, 9), interpolation=cv2.INTER_AREA).astype(np.float32).ravel()
    layout = _normalize(layout - float(layout.mean()))
    edges = cv2.Canny(gray, 70, 150)
    edge_layout = cv2.resize(edges, (16, 9), interpolation=cv2.INTER_AREA).astype(np.float32).ravel()
    edge_layout = _normalize(edge_layout)
    embedding = _normalize(np.concatenate([colour, layout, edge_layout]))
    return embedding, {
        "brightness": round(float(gray.mean()), 6),
        "contrast": round(float(gray.std()), 6),
        "edge_density": round(float(np.count_nonzero(edges)) / float(edges.size), 6),
        "sharpness": round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 6),
    }


def _similarity(left: np.ndarray, right: np.ndarray) -> float:
    return float(np.clip(np.dot(_normalize(left), _normalize(right)), -1.0, 1.0))


def measure_set_location_recurrence(
    video_path: str | Path,
    *,
    analysis_id: str,
    sample_interval_seconds: float = 1.0,
    similarity_threshold: float = 0.82,
    minimum_cluster_size: int = 2,
    output_path: str | Path | None = None,
) -> Dict[str, Any]:
    source = Path(video_path)
    if not source.is_file():
        raise FileNotFoundError(f"Source video not found: {source}")
    if sample_interval_seconds <= 0 or not 0.0 < similarity_threshold <= 1.0:
        raise ValueError("sample interval and similarity threshold must be positive")
    if minimum_cluster_size < 1:
        raise ValueError("minimum_cluster_size must be positive")

    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise ValueError(f"Could not open source video: {source}")
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if fps <= 0:
        capture.release()
        raise ValueError("Source video has no usable frame rate")
    step = max(1, int(round(fps * sample_interval_seconds)))
    samples: List[Dict[str, Any]] = []
    vectors: List[np.ndarray] = []
    thumbnail_dir = Path(output_path).parent / "set_location_thumbnails" if output_path else None
    if thumbnail_dir:
        thumbnail_dir.mkdir(parents=True, exist_ok=True)
    try:
        for frame_index in range(0, frame_count, step):
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = capture.read()
            if not ok or frame is None:
                continue
            vector, metrics = wide_frame_embedding(frame)
            digest = hashlib.sha256(vector.tobytes()).hexdigest()
            timestamp = frame_index / fps
            sample_id = f"set-frame:{len(samples) + 1:06d}"
            thumbnail_name = f"{sample_id.replace(':', '-')}.jpg"
            if thumbnail_dir:
                thumbnail = cv2.resize(frame, (192, 108), interpolation=cv2.INTER_AREA)
                cv2.imwrite(str(thumbnail_dir / thumbnail_name), thumbnail, [cv2.IMWRITE_JPEG_QUALITY, 82])
            samples.append({
                "sample_id": sample_id,
                "timestamp": round(timestamp, 6),
                "frame_index": frame_index,
                "source_ref": f"source_video#t={timestamp:.6f}",
                "thumbnail_ref": f"set_location_thumbnails/{thumbnail_name}" if thumbnail_dir else None,
                "embedding_sha256": digest,
                "embedding_dimensions": int(vector.size),
                "authority": "measured_automatic_detection",
                "review_state": "candidate",
                **metrics,
            })
            vectors.append(vector)
    finally:
        capture.release()

    cluster_vectors: List[np.ndarray] = []
    memberships: List[List[int]] = []
    for sample_index, vector in enumerate(vectors):
        scores = [_similarity(vector, centroid) for centroid in cluster_vectors]
        best_index = int(np.argmax(scores)) if scores else -1
        if best_index >= 0 and scores[best_index] >= similarity_threshold:
            memberships[best_index].append(sample_index)
            cluster_vectors[best_index] = _normalize(np.mean([vectors[i] for i in memberships[best_index]], axis=0))
        else:
            memberships.append([sample_index])
            cluster_vectors.append(vector.copy())

    clusters: List[Dict[str, Any]] = []
    excluded: List[Dict[str, Any]] = []
    for raw_index, member_indexes in enumerate(memberships, start=1):
        centroid = cluster_vectors[raw_index - 1]
        scored = sorted(
            ((index, _similarity(vectors[index], centroid)) for index in member_indexes),
            key=lambda item: item[1],
            reverse=True,
        )
        if len(member_indexes) < minimum_cluster_size:
            excluded.extend({
                "sample_id": samples[index]["sample_id"],
                "source_ref": samples[index]["source_ref"],
                "reason": "below_minimum_recurrence_count",
            } for index in member_indexes)
            continue
        cluster_id = f"set-cluster:{len(clusters) + 1:04d}"
        member_rows = []
        for index, cohesion in scored:
            samples[index]["cluster_id"] = cluster_id
            samples[index]["cohesion"] = round(cohesion, 6)
            member_rows.append({
                "sample_id": samples[index]["sample_id"],
                "timestamp": samples[index]["timestamp"],
                "source_ref": samples[index]["source_ref"],
                "thumbnail_ref": samples[index]["thumbnail_ref"],
                "cohesion": round(cohesion, 6),
            })
        competing = sorted(
            (_similarity(centroid, other) for index, other in enumerate(cluster_vectors) if index != raw_index - 1),
            reverse=True,
        )
        clusters.append({
            "cluster_id": cluster_id,
            "semantic_label": None,
            "maturity": "candidate",
            "sample_count": len(member_rows),
            "representative": member_rows[0],
            "boundary_sample": member_rows[-1],
            "cohesion": round(sum(row["cohesion"] for row in member_rows) / len(member_rows), 6),
            "nearest_competing_similarity": round(competing[0], 6) if competing else None,
            "temporal_distribution": [row["timestamp"] for row in sorted(member_rows, key=lambda row: row["timestamp"])],
            "members": member_rows,
        })

    payload = {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "status": "completed_measured",
        "method": "Datascene Native wide-frame colour/layout/edge recurrence",
        "provider": "OpenCV + NumPy",
        "provider_version": PROVIDER_VERSION,
        "parameters": {
            "sample_interval_seconds": sample_interval_seconds,
            "similarity_threshold": similarity_threshold,
            "minimum_cluster_size": minimum_cluster_size,
        },
        "source_video_path": str(source),
        "source_video_sha256": _sha256(source),
        "source_clock": "source_media.clock",
        "samples": samples,
        "clusters": clusters,
        "excluded": excluded,
        "summary": {
            "measured_sample_count": len(samples),
            "recurring_cluster_count": len(clusters),
            "eligible_sample_count": sum(cluster["sample_count"] for cluster in clusters),
            "excluded_sample_count": len(excluded),
        },
        "governance": {
            "measured_not_interpreted": True,
            "recurrence_is_not_location_identity": True,
            "metadata_proposals_remain_separately_attributed": True,
            "analyst_confirmation_required_for_semantic_set_name": True,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if output_path:
        _atomic_json(Path(output_path), payload)
    return payload
