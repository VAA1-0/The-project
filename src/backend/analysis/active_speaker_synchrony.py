"""Measured mouth-motion / speech-energy synchrony for governed speaker evidence.

This producer is intentionally conservative.  It needs a source-timed visual
identity box, detects a face inside that box, measures lower-face motion, and
correlates that signal with source audio energy.  Mere temporal overlap is
never reported as lip synchrony.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import wave
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

import cv2
import numpy as np


SCHEMA = "vaa1.active_speaker_synchrony.v1"
PROVIDER = "opencv_haar_lower_face_motion_plus_pcm_energy"
PROVIDER_VERSION = f"opencv.{cv2.__version__}"


def _number(value: Any) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _coordinates_at(row: Mapping[str, Any], timestamp: float) -> Optional[Dict[str, float]]:
    keyframes = [item for item in row.get("geometry_keyframes") or [] if isinstance(item, dict)]
    points = sorted(
        ((float(item.get("time")), item.get("coordinates")) for item in keyframes if _number(item.get("time")) is not None and isinstance(item.get("coordinates"), dict)),
        key=lambda item: item[0],
    )
    coords = row.get("coordinates") if isinstance(row.get("coordinates"), dict) else None
    if not points:
        return dict(coords) if coords else None
    before = max((item for item in points if item[0] <= timestamp), default=points[0], key=lambda item: item[0])
    after = min((item for item in points if item[0] >= timestamp), default=points[-1], key=lambda item: item[0])
    if before[0] == after[0]:
        return dict(before[1])
    ratio = (timestamp - before[0]) / (after[0] - before[0])
    return {key: float(before[1].get(key, 0)) + ratio * (float(after[1].get(key, 0)) - float(before[1].get(key, 0))) for key in ("x", "y", "w", "h")}


def _audio_energy(audio_path: Path, timestamps: Sequence[float], radius_seconds: float = 0.04) -> np.ndarray:
    with wave.open(str(audio_path), "rb") as handle:
        rate = handle.getframerate()
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        frames = handle.readframes(handle.getnframes())
    if width != 2:
        raise ValueError("active-speaker measurement currently requires 16-bit PCM audio")
    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32)
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    samples /= 32768.0
    radius = max(1, int(rate * radius_seconds))
    values = []
    for timestamp in timestamps:
        center = int(timestamp * rate)
        window = samples[max(0, center - radius):min(len(samples), center + radius)]
        values.append(float(np.sqrt(np.mean(window * window))) if window.size else 0.0)
    return np.asarray(values, dtype=np.float32)


def _best_correlation(motion: np.ndarray, energy: np.ndarray, max_lag_frames: int) -> Tuple[Optional[float], int]:
    if motion.size < 6 or energy.size != motion.size or np.std(motion) < 1e-7 or np.std(energy) < 1e-7:
        return None, 0
    best: Tuple[float, int] = (-1.0, 0)
    for lag in range(-max_lag_frames, max_lag_frames + 1):
        left = motion[max(0, lag):motion.size + min(0, lag)]
        right = energy[max(0, -lag):energy.size - max(0, lag)]
        if left.size < 6:
            continue
        correlation = float(np.corrcoef(left, right)[0, 1])
        if math.isfinite(correlation) and correlation > best[0]:
            best = (correlation, lag)
    return (max(0.0, best[0]), best[1]) if best[0] >= 0 else (None, 0)


def measure_active_speaker_synchrony(
    *,
    source_video_path: str | Path,
    source_audio_path: str | Path,
    identity_annotation: Mapping[str, Any],
    start_seconds: float,
    end_seconds: float,
    sample_fps: float = 18.0,
) -> Dict[str, Any]:
    video_path, audio_path = Path(source_video_path), Path(source_audio_path)
    result: Dict[str, Any] = {
        "schema": SCHEMA,
        "provider": PROVIDER,
        "provider_version": PROVIDER_VERSION,
        "source_interval": {"start": start_seconds, "end": end_seconds},
        "identity_label": identity_annotation.get("identity_affirmation") or identity_annotation.get("label"),
        "identity_annotation_id": identity_annotation.get("id"),
        "state": "not_measured",
        "valid_for_constellational_support": False,
    }
    if end_seconds <= start_seconds or not video_path.exists() or not audio_path.exists():
        result["reason"] = "missing_source_or_invalid_interval"
        return result

    capture = cv2.VideoCapture(str(video_path))
    source_fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
    if source_fps <= 0:
        capture.release()
        result["reason"] = "source_fps_unavailable"
        return result
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    timestamps = np.arange(start_seconds, end_seconds, 1.0 / max(1.0, sample_fps)).tolist()
    accepted_times: List[float] = []
    motion: List[float] = []
    previous_mouth: Optional[np.ndarray] = None
    attempted = 0
    for timestamp in timestamps:
        coords = _coordinates_at(identity_annotation, timestamp)
        if not coords:
            continue
        capture.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000.0)
        ok, frame = capture.read()
        if not ok:
            continue
        attempted += 1
        height, width = frame.shape[:2]
        x = max(0, min(width - 1, int(float(coords.get("x", 0)) * width)))
        y = max(0, min(height - 1, int(float(coords.get("y", 0)) * height)))
        w = max(1, min(width - x, int(float(coords.get("w", 0)) * width)))
        h = max(1, min(height - y, int(float(coords.get("h", 0)) * height)))
        body = frame[y:y + h, x:x + w]
        gray = cv2.cvtColor(body, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(24, 24))
        if len(faces) == 0:
            previous_mouth = None
            continue
        fx, fy, fw, fh = max(faces, key=lambda face: int(face[2]) * int(face[3]))
        mouth = gray[fy + int(fh * 0.55):fy + int(fh * 0.92), fx + int(fw * 0.15):fx + int(fw * 0.85)]
        if mouth.size == 0:
            continue
        mouth = cv2.resize(mouth, (64, 32), interpolation=cv2.INTER_AREA)
        mouth = cv2.GaussianBlur(mouth, (3, 3), 0)
        if previous_mouth is not None:
            motion.append(float(np.mean(cv2.absdiff(mouth, previous_mouth))) / 255.0)
            accepted_times.append(timestamp)
        previous_mouth = mouth
    capture.release()

    coverage = len(accepted_times) / max(1, attempted - 1)
    if len(accepted_times) < 6 or coverage < 0.35:
        result.update({"reason": "insufficient_source_timed_face_coverage", "face_coverage": round(coverage, 4), "measured_frame_pairs": len(accepted_times)})
        return result
    energy = _audio_energy(audio_path, accepted_times)
    correlation, lag = _best_correlation(np.asarray(motion, dtype=np.float32), energy, max(1, int(sample_fps * 0.3)))
    if correlation is None:
        result.update({"reason": "signals_lack_measurable_variation", "face_coverage": round(coverage, 4), "measured_frame_pairs": len(accepted_times)})
        return result
    quality = min(1.0, coverage * min(1.0, len(accepted_times) / 18.0))
    probability = max(0.0, min(0.98, 0.5 + correlation * 0.38 * quality))
    result.update({
        "state": "measured",
        "method": "lower_face_frame_difference_correlated_with_pcm_rms",
        "mouth_audio_correlation": round(correlation, 4),
        "best_lag_seconds": round(lag / sample_fps, 4),
        "face_coverage": round(coverage, 4),
        "measured_frame_pairs": len(accepted_times),
        "probability": round(probability, 4),
        "quality": round(quality, 4),
        "valid_for_constellational_support": True,
        "authority": "measured_candidate_evidence",
        "governance": {"may_proliferate_as_candidate": True, "may_auto_confirm_identity": False, "analyst_authority_preserved": True},
        "provenance": {
            "source_video_path": str(video_path),
            "source_audio_path": str(audio_path),
            "measurement_fingerprint": hashlib.sha256(json.dumps({"video": str(video_path), "audio": str(audio_path), "annotation": identity_annotation.get("id"), "start": start_seconds, "end": end_seconds, "provider": PROVIDER_VERSION}, sort_keys=True).encode()).hexdigest(),
        },
    })
    return result


def build_active_speaker_synchrony_artifact(status: Mapping[str, Any]) -> Dict[str, Any]:
    """Measure every transcript turn overlapping a confirmed visual identity ROI."""
    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    audio_analysis = results.get("audio_analysis") if isinstance(results.get("audio_analysis"), dict) else {}
    transcript = audio_analysis.get("transcript") if isinstance(audio_analysis.get("transcript"), dict) else {}
    segments = transcript.get("segments") or transcript.get("utterances") or []
    corrections = status.get("annotation_corrections") if isinstance(status.get("annotation_corrections"), dict) else {}
    annotations = [
        row for row in corrections.get("manual_visual_annotations") or []
        if isinstance(row, dict)
        and (row.get("identity_affirmation") or row.get("label"))
        and isinstance(row.get("coordinates"), dict)
    ]
    video_path = status.get("source_video_path") or output_files.get("source_video")
    audio_path = output_files.get("audio") or audio_analysis.get("audio_path")
    measurements: List[Dict[str, Any]] = []
    seen = set()
    for annotation in annotations:
        visual_start = _number(annotation.get("start_seconds") or annotation.get("timestamp_seconds"))
        visual_end = _number(annotation.get("end_seconds"))
        if visual_start is None:
            continue
        visual_end = visual_end if visual_end is not None else visual_start
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            speech_start = _number(segment.get("start") or segment.get("start_seconds"))
            speech_end = _number(segment.get("end") or segment.get("end_seconds"))
            if speech_start is None:
                continue
            speech_end = speech_end if speech_end is not None else speech_start
            start, end = max(visual_start, speech_start), min(visual_end, speech_end)
            if end - start < 0.45:
                continue
            key = (annotation.get("id"), round(start, 3), round(end, 3))
            if key in seen:
                continue
            seen.add(key)
            measurement = measure_active_speaker_synchrony(
                source_video_path=video_path or "",
                source_audio_path=audio_path or "",
                identity_annotation=annotation,
                start_seconds=start,
                end_seconds=end,
            )
            measurement["utterance_ref"] = segment.get("id") or segment.get("segment_id")
            measurement["transcript_text"] = segment.get("text")
            measurements.append(measurement)
    return {
        "schema": "vaa1.active_speaker_synchrony_artifact.v1",
        "analysis_id": status.get("analysis_id"),
        "provider": PROVIDER,
        "provider_version": PROVIDER_VERSION,
        "annotation_revision": status.get("annotations_revision") or status.get("annotation_corrections_revision") or 0,
        "measurement_count": len(measurements),
        "measured_count": sum(row.get("state") == "measured" for row in measurements),
        "measurements": measurements,
        "governance": {
            "measured_results_proliferate_as_candidate_evidence": True,
            "manual_identity_confirmation_remains_authoritative": True,
            "lip_sync_alone_does_not_establish_identity": True,
        },
    }
