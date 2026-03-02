#!/usr/bin/env python3
"""
DeepFace Expression Recognition for VAA1 (multi-face + DNN detector)
------------------------------------------------------------------

This revision implements:
- Multi-face handling: when multiple faces are detected at a timestamp,
  the detector will crop and analyze each face, returning one result entry
  per face (with face_id and bbox).
- Configurable face detector: supports 'dnn' (OpenCV DNN SSD) and 'haar'
  (OpenCV Haar cascade). The DNN detector can be provided model files or
  will attempt to download default ResNet-SSD files to a local cache.
- Seek-based sampling for speed on long videos, and per-sample detection
  using the chosen fast detector before calling DeepFace for emotion inference.

Note: The DNN model files (prototxt + caffemodel) are moderately large (~2-12MB).
If automatic download is enabled the code uses urllib to fetch them into a cache
directory under the user's home folder.
"""

from __future__ import annotations

import logging
import json
import os
import shutil
import urllib.request
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import cv2
from deepface import DeepFace

logger = logging.getLogger(__name__)

# Default URLs for OpenCV's ResNet SSD face detector (deploy + caffemodel)
# Sources: OpenCV's github / model zoo
DEFAULT_DNN_PROTO_URL = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
DEFAULT_DNN_MODEL_URL = "https://huggingface.co/Durraiya/res10_300x300_ssd_iter_140000_fp16.caffemodel/resolve/main/res10_300x300_ssd_iter_140000_fp16.caffemodel?download=true"

# Cache directory for downloaded DNN files
DNN_CACHE_DIR = Path.home() / ".cache" / "expression_detector" / "dnn_models"


class ExpressionDetectorDeepFace:
    """
    Detect facial expressions in a video using DeepFace emotion classifier.

    Key features in this class:
      - Sample video at `interval` seconds (seek-based sampling supported)
      - Fast face detection using either OpenCV Haar cascade or OpenCV DNN SSD
      - Multi-face support: analyze every detected face and return per-face results
      - Optional cropping to face bbox before calling DeepFace.analyze
    """

    def __init__(
        self,
        interval: float = 0.5,
        enforce_detection: bool = False,
        model_name: str = "VGG-Face",
        detector_backend: str = "opencv",
        face_detector: str = "dnn",  # 'dnn' or 'haar'
        haar_cascade_path: Optional[str] = None,
        dnn_proto_path: Optional[str] = None,
        dnn_model_path: Optional[str] = None,
        dnn_confidence: float = 0.5,
        precheck: bool = True,
        skip_by_seek: bool = True,
        min_face_size: Tuple[int, int] = (30, 30),
    ) -> None:
        """
        Parameters
        ----------
        interval : float
            Seconds between frames to analyze.
        enforce_detection : bool
            Passed to DeepFace.analyze; if True, missing faces may raise errors.
        model_name : str
            DeepFace model name (kept for compatibility).
        detector_backend : str
            Backend passed to DeepFace.analyze (e.g., 'opencv', 'mtcnn', 'retinaface').
        face_detector : str
            Fast detector to use before DeepFace: 'dnn' (recommended) or 'haar'.
        haar_cascade_path : Optional[str]
            Path to Haar cascade xml. If None, OpenCV default cascade is used.
        dnn_proto_path, dnn_model_path : Optional[str]
            Paths to the DNN proto/caffemodel files. If missing and face_detector='dnn'
            the code will attempt to download defaults into a cache dir.
        dnn_confidence : float
            Minimum confidence for DNN detections to be considered.
        precheck : bool
            When True, run the fast detector and skip DeepFace on frames with no faces.
        skip_by_seek : bool
            Seek to timestamps (fast) instead of reading all frames.
        min_face_size : Tuple[int,int]
            Minimum face size (w,h) to accept for Haar cascade.
        """
        if interval <= 0:
            raise ValueError("interval must be > 0")

        self.interval = float(interval)
        self.enforce_detection = bool(enforce_detection)
        self.model_name = model_name
        self.detector_backend = detector_backend

        self.face_detector = face_detector.lower()
        if self.face_detector not in ("dnn", "haar"):
            raise ValueError("face_detector must be 'dnn' or 'haar'")

        self.precheck = bool(precheck)
        self.skip_by_seek = bool(skip_by_seek)
        self.min_face_size = tuple(min_face_size)
        self.dnn_confidence = float(dnn_confidence)

        # Haar cascade setup
        if haar_cascade_path:
            self.haar_cascade_path = Path(haar_cascade_path)
        else:
            try:
                haar_dir = cv2.data.haarcascades  # type: ignore[attr-defined]
                self.haar_cascade_path = Path(haar_dir) / "haarcascade_frontalface_default.xml"
            except Exception:
                self.haar_cascade_path = None

        self._haar = None
        if self.haar_cascade_path and self.face_detector == "haar":
            try:
                self._haar = cv2.CascadeClassifier(str(self.haar_cascade_path))
                if self._haar.empty():
                    logger.warning("Loaded Haar cascade appears empty: %s", self.haar_cascade_path)
                    self._haar = None
            except Exception:
                logger.exception("Failed to load Haar cascade")
                self._haar = None

        # DNN setup: get or download proto/model if needed
        self._dnn_net = None
        self.dnn_proto_path = Path(dnn_proto_path) if dnn_proto_path else None
        self.dnn_model_path = Path(dnn_model_path) if dnn_model_path else None

        if self.face_detector == "dnn":
            self._prepare_dnn_paths()

    # -------------------------
    # DNN model helpers
    # -------------------------
    def _prepare_dnn_paths(self) -> None:
        """
        Ensure DNN proto and model paths are present. If not provided, attempt to
        download default files into a user cache directory.
        """
        DNN_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        if not self.dnn_proto_path:
            self.dnn_proto_path = DNN_CACHE_DIR / "deploy.prototxt"
        if not self.dnn_model_path:
            self.dnn_model_path = DNN_CACHE_DIR / "res10_300x300_ssd_iter_140000_fp16.caffemodel"

        # Download if missing
        if not self.dnn_proto_path.exists():
            logger.info("Downloading default DNN proto to %s", self.dnn_proto_path)
            try:
                urllib.request.urlretrieve(DEFAULT_DNN_PROTO_URL, str(self.dnn_proto_path))
            except Exception as exc:
                logger.warning("Failed to download DNN proto: %s", exc)
        if not self.dnn_model_path.exists():
            logger.info("Downloading default DNN model to %s", self.dnn_model_path)
            try:
                urllib.request.urlretrieve(DEFAULT_DNN_MODEL_URL, str(self.dnn_model_path))
            except Exception as exc:
                logger.warning("Failed to download DNN model: %s", exc)

        # Attempt to load net (deferred; do not crash here)
        try:
            if self.dnn_proto_path.exists() and self.dnn_model_path.exists():
                self._dnn_net = cv2.dnn.readNetFromCaffe(str(self.dnn_proto_path), str(self.dnn_model_path))
                # Prefer CPU backend; user can change if OpenCV built with CUDA
                self._dnn_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_DEFAULT)
                self._dnn_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
            else:
                logger.warning("DNN model files missing; DNN detector will be unavailable")
                self._dnn_net = None
        except Exception:
            logger.exception("Failed to load DNN network")
            self._dnn_net = None

    # -------------------------
    # Fast face detectors (Haar or DNN)
    # -------------------------
    def _detect_faces_haar(self, frame) -> List[Tuple[int, int, int, int]]:
        if self._haar is None:
            return []
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self._haar.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=self.min_face_size,
        )
        return [tuple(map(int, f)) for f in faces]

    def _detect_faces_dnn(self, frame) -> List[Tuple[int, int, int, int]]:
        if self._dnn_net is None:
            return []
        h, w = frame.shape[:2]
        # Prepare blob: 300x300, mean subtraction as per model
        blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 1.0,
                                     (300, 300), (104.0, 177.0, 123.0), swapRB=False, crop=False)
        self._dnn_net.setInput(blob)
        detections = self._dnn_net.forward()
        boxes: List[Tuple[int, int, int, int]] = []
        # detections shape: [1,1,N,7] where [0,0,i,2]=confidence, [0,0,i,3..6]=bbox (normalized)
        for i in range(detections.shape[2]):
            conf = float(detections[0, 0, i, 2])
            if conf < self.dnn_confidence:
                continue
            x1 = int(detections[0, 0, i, 3] * w)
            y1 = int(detections[0, 0, i, 4] * h)
            x2 = int(detections[0, 0, i, 5] * w)
            y2 = int(detections[0, 0, i, 6] * h)
            # clamp
            x1c = max(0, min(w - 1, x1))
            y1c = max(0, min(h - 1, y1))
            x2c = max(0, min(w - 1, x2))
            y2c = max(0, min(h - 1, y2))
            if x2c <= x1c or y2c <= y1c:
                continue
            boxes.append((x1c, y1c, x2c - x1c, y2c - y1c))
        return boxes

    def _detect_faces(self, frame) -> List[Tuple[int, int, int, int]]:
        """
        Run the configured fast detector and return list of bboxes (x,y,w,h).
        """
        try:
            if self.face_detector == "dnn":
                faces = self._detect_faces_dnn(frame)
                if faces:
                    return faces
                # fallback to haar if dnn produced nothing but Haar is available
                if self._haar is not None:
                    return self._detect_faces_haar(frame)
                return []
            else:
                return self._detect_faces_haar(frame)
        except Exception:
            logger.exception("Fast detector failed")
            return []

    # -------------------------
    # Analyze a single face crop with DeepFace
    # -------------------------
    def _analyze_face_crop(self, img_crop) -> Dict[str, Any]:
        try:
            analysis = DeepFace.analyze(
                img_crop,
                actions=["emotion"],
                enforce_detection=self.enforce_detection,
                detector_backend=self.detector_backend,
                prog_bar=False,
            )
            return {
                "dominant_emotion": analysis.get("dominant_emotion"),
                "emotion": analysis.get("emotion"),
                "error": None,
            }
        except Exception as exc:
            logger.debug("DeepFace analyze error for face crop: %s", exc, exc_info=True)
            return {"dominant_emotion": None, "emotion": None, "error": str(exc)}

    # -------------------------
    # Main method — analyze entire video (multi-face)
    # -------------------------
    def run(self, video_path: str | Path, max_duration: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Analyze a video and return per-face detection results sampled every `interval` seconds.

        Output format (one entry per detected face per sample time):
        {
            "frame_index": int,        # sample sequence index (0..N-1)
            "timestamp": float,        # seconds into video
            "face_id": int,            # index of face at this timestamp (0..F-1)
            "bbox": [x,y,w,h],         # face bbox in frame coordinates
            "dominant_emotion": str|None,
            "emotion": {emotion: prob}|None,
            "detector": "dnn"|"haar",
            "error": str|None
        }
        """
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {video_path}")

        try:
            fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            duration_seconds = (total_frames / fps) if (fps > 0 and total_frames > 0) else None
            logger.debug("Video opened (fps=%.2f, frames=%d, duration=%s)", fps, total_frames, duration_seconds)

            end_time = float(max_duration) if max_duration is not None else (duration_seconds if duration_seconds is not None else float("inf"))

            # Build sample timestamps
            sample_times: List[float] = []
            if self.skip_by_seek and duration_seconds is not None:
                t = 0.0
                while t <= end_time + 1e-6:
                    sample_times.append(round(t, 6))
                    t += self.interval
            else:
                if duration_seconds is None:
                    logger.info("Container did not report duration/fps; falling back to sequential sampling")
                    # sample by reading frames (approximate timestamps)
                    timestamp = 0.0
                    frame_index = 0
                    while True:
                        ret, frame = cap.read()
                        if not ret:
                            break
                        if fps > 0:
                            timestamp = frame_index / fps
                        else:
                            timestamp = frame_index * self.interval
                        if timestamp > end_time:
                            break
                        # if this frame is near a sampling point
                        if abs((timestamp / self.interval) - round(timestamp / self.interval)) < 1e-3:
                            sample_times.append(round(timestamp, 6))
                        frame_index += 1
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                else:
                    t = 0.0
                    while t <= end_time + 1e-6:
                        sample_times.append(round(t, 6))
                        t += self.interval

            results: List[Dict[str, Any]] = []
            sample_index = 0

            for tsec in sample_times:
                # Seek if requested and feasible
                if self.skip_by_seek and duration_seconds is not None:
                    cap.set(cv2.CAP_PROP_POS_MSEC, float(tsec) * 1000.0)
                    ret, frame = cap.read()
                    if not ret or frame is None:
                        logger.debug("Failed to read frame at %.3fs (seek)", tsec)
                        # produce a placeholder with no faces
                        results.append({
                            "frame_index": sample_index,
                            "timestamp": round(float(tsec), 3),
                            "face_id": None,
                            "bbox": None,
                            "dominant_emotion": None,
                            "emotion": None,
                            "detector": self.face_detector,
                            "error": "frame unreadable at seek position",
                        })
                        sample_index += 1
                        continue
                    timestamp = float(tsec)
                else:
                    ret, frame = cap.read()
                    if not ret or frame is None:
                        break
                    if fps > 0:
                        current_frame = cap.get(cv2.CAP_PROP_POS_FRAMES) or 0
                        timestamp = (current_frame - 1) / fps
                    else:
                        timestamp = float(tsec)

                # Run fast detector (Haar or DNN) if enabled
                face_bboxes: List[Tuple[int, int, int, int]] = []
                if self.precheck:
                    face_bboxes = self._detect_faces(frame)

                if not face_bboxes:
                    # No face found --> produce a single entry signifying absence
                    results.append({
                        "frame_index": sample_index,
                        "timestamp": round(float(timestamp), 3),
                        "face_id": None,
                        "bbox": None,
                        "dominant_emotion": None,
                        "emotion": None,
                        "detector": self.face_detector,
                        "error": "no face detected (fast detector)",
                    })
                    sample_index += 1
                    continue

                # For each detected face (multi-face), crop and analyze
                for face_id, bbox in enumerate(face_bboxes):
                    x, y, w, h = bbox
                    # Clamp coords
                    h_frame, w_frame = frame.shape[:2]
                    x0 = max(0, x)
                    y0 = max(0, y)
                    x1 = min(w_frame, x + w)
                    y1 = min(h_frame, y + h)
                    if x1 <= x0 or y1 <= y0:
                        # Skip invalid bbox
                        logger.debug("Skipping invalid bbox %s at timestamp %.3f", bbox, timestamp)
                        continue
                    face_crop = frame[y0:y1, x0:x1]

                    analysis = self._analyze_face_crop(face_crop)

                    results.append({
                        "frame_index": sample_index,
                        "timestamp": round(float(timestamp), 3),
                        "face_id": face_id,
                        "bbox": [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
                        "dominant_emotion": analysis.get("dominant_emotion"),
                        "emotion": analysis.get("emotion"),
                        "detector": self.face_detector,
                        "error": analysis.get("error"),
                    })

                sample_index += 1

                if timestamp >= end_time:
                    break

            return results

        finally:
            cap.release()


# -------------------------------------------------------------
# CLI entrypoint (updated flags for multi-face & dnn/haar)
# -------------------------------------------------------------
if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser(description="DeepFace multi-face expression detection (DNN/Haar fast detectors)")
    parser.add_argument("video", help="Path to input video file")
    parser.add_argument("--interval", type=float, default=0.5, help="Seconds between analyzed samples (default: 0.5)")
    parser.add_argument("--enforce-detection", action="store_true", help="Raise if no face detected in a crop (not recommended for multi-face noisy video)")
    parser.add_argument("--detector-backend", type=str, default="opencv", help="DeepFace detector backend (opencv, mtcnn, retinaface, mediapipe, ssd)")
    parser.add_argument("--face-detector", choices=["dnn", "haar"], default="dnn", help="Fast detector to use before DeepFace (default: dnn)")
    parser.add_argument("--haar-cascade", type=str, default=None, help="Path to Haar cascade xml (optional)")
    parser.add_argument("--dnn-proto", type=str, default=None, help="Path to DNN proto file (optional)")
    parser.add_argument("--dnn-model", type=str, default=None, help="Path to DNN caffemodel file (optional)")
    parser.add_argument("--dnn-confidence", type=float, default=0.5, help="Min confidence for DNN detections (default: 0.5)")
    parser.add_argument("--max-duration", type=float, default=None, help="Maximum video seconds to analyze")
    parser.add_argument("--output", type=str, default=None, help="Path to write JSON results")
    parser.add_argument("--no-precheck", dest="precheck", action="store_false", help="Disable fast pre-check (will run DeepFace on each sample)")
    parser.add_argument("--no-skip-by-seek", dest="skip_by_seek", action="store_false", help="Disable seek-based sampling (sequential read fallback)")
    args = parser.parse_args()

    detector = ExpressionDetectorDeepFace(
        interval=args.interval,
        enforce_detection=args.enforce_detection,
        detector_backend=args.detector_backend,
        face_detector=args.face_detector,
        haar_cascade_path=args.haar_cascade,
        dnn_proto_path=args.dnn_proto,
        dnn_model_path=args.dnn_model,
        dnn_confidence=args.dnn_confidence,
        precheck=args.precheck,
        skip_by_seek=args.skip_by_seek,
    )

    try:
        res = detector.run(args.video, max_duration=args.max_duration)
        if args.output:
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json.dumps(res, indent=2), encoding="utf-8")
            print(f"Results written to {out_path}")
        else:
            print(json.dumps(res, indent=2))
    except Exception as exc:
        logger.exception("Processing failed")
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(2)