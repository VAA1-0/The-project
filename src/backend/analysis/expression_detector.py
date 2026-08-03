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
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Callable

import cv2
from deepface import DeepFace

logger = logging.getLogger(__name__)

EXPRESSION_ONTOLOGY_MAP: Dict[str, Dict[str, Any]] = {
    "serious": {
        "near_neighbors": ["focused", "formal_neutral", "composed"],
        "social_function": ["authority", "credibility", "task-orientation"],
    },
    "focused": {
        "near_neighbors": ["serious", "attentive", "analytical"],
        "social_function": ["attention", "competence", "task-management"],
    },
    "formal_neutral": {
        "near_neighbors": ["serious", "composed", "restrained"],
        "social_function": ["neutrality", "procedural legitimacy", "role containment"],
    },
    "composed": {
        "near_neighbors": ["formal_neutral", "serious", "reassuring"],
        "social_function": ["stability", "calm authority", "self-regulation"],
    },
    "restrained": {
        "near_neighbors": ["formal_neutral", "composed", "deliberate"],
        "social_function": ["decorum", "distance", "institutional fit"],
    },
    "deliberate": {
        "near_neighbors": ["focused", "restrained", "reflective"],
        "social_function": ["carefulness", "credibility", "discursive control"],
    },
    "concerned": {
        "near_neighbors": ["serious", "tense", "reassuring"],
        "social_function": ["warning", "problem-signaling", "care orientation"],
    },
    "reflective": {
        "near_neighbors": ["deliberate", "analytical", "focused"],
        "social_function": ["thoughtfulness", "evaluation", "discursive pacing"],
    },
    "skeptical": {
        "near_neighbors": ["reflective", "critical", "concerned"],
        "social_function": ["critical filtering", "distance", "epistemic caution"],
    },
    "attentive": {
        "near_neighbors": ["focused", "reflective", "warm"],
        "social_function": ["listening", "engagement", "responsiveness"],
    },
    "emphatic": {
        "near_neighbors": ["assertive", "authoritative", "serious"],
        "social_function": ["persuasion", "salience marking", "mobilization"],
    },
    "assertive": {
        "near_neighbors": ["authoritative", "emphatic", "serious"],
        "social_function": ["stance-taking", "boundary-setting", "persuasion"],
    },
    "authoritative": {
        "near_neighbors": ["assertive", "composed", "serious"],
        "social_function": ["authority", "coordination", "trust projection"],
    },
    "warm": {
        "near_neighbors": ["reassuring", "empathetic", "approving"],
        "social_function": ["affiliation", "trust-building", "social ease"],
    },
    "reassuring": {
        "near_neighbors": ["warm", "composed", "concerned"],
        "social_function": ["calming", "trust support", "anxiety reduction"],
    },
    "empathetic": {
        "near_neighbors": ["warm", "concerned", "reassuring"],
        "social_function": ["affiliation", "solidarity", "care signaling"],
    },
    "amused": {
        "near_neighbors": ["warm", "approving", "lightly_pleased"],
        "social_function": ["bonding", "softening", "tension relief"],
    },
    "approving": {
        "near_neighbors": ["warm", "reassuring", "amused"],
        "social_function": ["endorsement", "reward", "alignment"],
    },
    "tense": {
        "near_neighbors": ["concerned", "assertive", "uneasy"],
        "social_function": ["strain signal", "pressure indication", "alertness"],
    },
    "uneasy": {
        "near_neighbors": ["concerned", "tense", "skeptical"],
        "social_function": ["uncertainty signal", "guardedness", "distance"],
    },
}

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
        min_dominant_score: float = 0.35,
        min_score_margin: float = 0.10,
        uncertain_label: str = "uncertain",
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
        min_dominant_score : float
            Minimum top emotion score required before the detector commits to a
            dominant label.
        min_score_margin : float
            Minimum difference required between the top and second emotion scores
            before the detector commits to a dominant label.
        uncertain_label : str
            Label used when an emotion signal is present but too weak or ambiguous
            to treat as a trustworthy dominant emotion.
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
        self.min_dominant_score = float(min_dominant_score)
        self.min_score_margin = float(min_score_margin)
        self.uncertain_label = str(uncertain_label)

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
            )
            if isinstance(analysis, list):
                if not analysis:
                    return {
                        "dominant_emotion": None,
                        "emotion": None,
                        "error": "DeepFace returned an empty result list",
                    }
                analysis = analysis[0]
            if not isinstance(analysis, dict):
                return {
                    "dominant_emotion": None,
                    "emotion": None,
                    "top_emotion_score": None,
                    "score_margin": None,
                    "quality": "error",
                    "error": f"Unexpected DeepFace result type: {type(analysis).__name__}",
                }
            emotion_scores = analysis.get("emotion")
            dominant_emotion = analysis.get("dominant_emotion")
            top_emotion_score = None
            score_margin = None
            quality = "clear"

            if isinstance(emotion_scores, dict) and emotion_scores:
                ranked = sorted(
                    (
                        (str(label), float(score) / 100.0 if float(score) > 1.0 else float(score))
                        for label, score in emotion_scores.items()
                    ),
                    key=lambda item: item[1],
                    reverse=True,
                )
                top_label, top_emotion_score = ranked[0]
                second_score = ranked[1][1] if len(ranked) > 1 else 0.0
                score_margin = top_emotion_score - second_score

                if (
                    top_emotion_score < self.min_dominant_score
                    or score_margin < self.min_score_margin
                ):
                    dominant_emotion = self.uncertain_label
                    quality = "weak"
                else:
                    dominant_emotion = top_label

            return {
                "dominant_emotion": dominant_emotion,
                "emotion": emotion_scores,
                "top_emotion_score": top_emotion_score,
                "score_margin": score_margin,
                "quality": quality,
                "expression_evidence": self._build_expression_evidence(
                    dominant_emotion=dominant_emotion,
                    emotion_scores=emotion_scores,
                    top_emotion_score=top_emotion_score,
                    score_margin=score_margin,
                    quality=quality,
                ),
                "affect_hints": self._derive_affect_hints(
                    emotion_scores=emotion_scores,
                    quality=quality,
                ),
                "error": None,
            }
        except Exception as exc:
            logger.debug("DeepFace analyze error for face crop: %s", exc, exc_info=True)
            return {
                "dominant_emotion": None,
                "emotion": None,
                "top_emotion_score": None,
                "score_margin": None,
                "quality": "error",
                "expression_evidence": {
                    "level": "error",
                    "dominant_emotion_ready": False,
                },
                "affect_hints": {
                    "valence": "unavailable",
                    "activation": "unavailable",
                    "confidence": "none",
                },
                "error": str(exc),
            }

    def _build_expression_evidence(
        self,
        *,
        dominant_emotion: Optional[str],
        emotion_scores: Optional[Dict[str, Any]],
        top_emotion_score: Optional[float],
        score_margin: Optional[float],
        quality: str,
    ) -> Dict[str, Any]:
        if quality == "error":
            return {
                "level": "error",
                "dominant_emotion_ready": False,
            }

        if not emotion_scores:
            return {
                "level": "none",
                "dominant_emotion_ready": False,
            }

        if quality == "weak" or dominant_emotion == self.uncertain_label:
            return {
                "level": "weak",
                "dominant_emotion_ready": False,
                "top_score": top_emotion_score,
                "score_margin": score_margin,
            }

        return {
            "level": "clear",
            "dominant_emotion_ready": True,
            "top_score": top_emotion_score,
            "score_margin": score_margin,
        }

    def _derive_affect_hints(
        self,
        *,
        emotion_scores: Optional[Dict[str, Any]],
        quality: str,
    ) -> Dict[str, Any]:
        if not emotion_scores or quality == "error":
            return {
                "valence": "unavailable",
                "activation": "unavailable",
                "valence_score": None,
                "activation_score": None,
                "confidence": "none",
            }

        normalized_scores: Dict[str, float] = {}
        for label, raw_score in emotion_scores.items():
            try:
                score = float(raw_score)
            except Exception:
                continue
            normalized_scores[str(label).lower()] = score / 100.0 if score > 1.0 else score

        if not normalized_scores:
            return {
                "valence": "unavailable",
                "activation": "unavailable",
                "valence_score": None,
                "activation_score": None,
                "confidence": "none",
            }

        positive = (
            normalized_scores.get("happy", 0.0)
            + normalized_scores.get("surprise", 0.0) * 0.3
        )
        negative = (
            normalized_scores.get("sad", 0.0)
            + normalized_scores.get("angry", 0.0)
            + normalized_scores.get("fear", 0.0)
            + normalized_scores.get("disgust", 0.0)
        )

        high_activation = (
            normalized_scores.get("angry", 0.0)
            + normalized_scores.get("fear", 0.0)
            + normalized_scores.get("surprise", 0.0)
            + normalized_scores.get("happy", 0.0) * 0.5
        )
        low_activation = (
            normalized_scores.get("sad", 0.0)
            + normalized_scores.get("neutral", 0.0) * 0.6
        )

        valence_delta = positive - negative
        activation_delta = high_activation - low_activation

        if quality == "weak":
            confidence = "low"
        elif max(normalized_scores.values()) >= 0.6:
            confidence = "high"
        else:
            confidence = "medium"

        def label_delta(delta: float, positive_label: str, negative_label: str) -> str:
            if delta >= 0.2:
                return positive_label
            if delta <= -0.2:
                return negative_label
            return "mixed_or_uncertain"

        return {
            "valence": label_delta(valence_delta, "positive_tilt", "negative_tilt"),
            "activation": label_delta(activation_delta, "higher_activation", "lower_activation"),
            "valence_score": round(max(0.0, min(1.0, (valence_delta + 1.0) / 2.0)), 6),
            "activation_score": round(max(0.0, min(1.0, (activation_delta + 1.0) / 2.0)), 6),
            "score_method": "weighted_emotion_probability_contrast_v1",
            "confidence": confidence,
        }

    def _derive_social_function(
        self,
        *,
        affect_hints: Dict[str, Any],
        quality: str,
        face_area_share: float,
    ) -> Dict[str, float]:
        valence = affect_hints.get("valence")
        activation = affect_hints.get("activation")
        confidence = affect_hints.get("confidence")

        base = {
            "authority_signal": 0.0,
            "affiliation_signal": 0.0,
            "persuasion_signal": 0.0,
            "distance_signal": 0.0,
            "reassurance_signal": 0.0,
        }

        if confidence == "none" or quality == "error":
            return base

        if valence == "positive_tilt":
            base["affiliation_signal"] += 0.5
            base["reassurance_signal"] += 0.3
        elif valence == "negative_tilt":
            base["distance_signal"] += 0.35
            base["authority_signal"] += 0.15

        if activation == "higher_activation":
            base["persuasion_signal"] += 0.45
            base["authority_signal"] += 0.25
        elif activation == "lower_activation":
            base["reassurance_signal"] += 0.35
            base["authority_signal"] += 0.2

        if face_area_share >= 0.12:
            base["authority_signal"] += 0.1

        return {key: round(min(1.0, value), 3) for key, value in base.items()}

    def _interpret_expression(
        self,
        *,
        dominant_emotion: Optional[str],
        quality: str,
        face_signal_level: str,
        affect_hints: Dict[str, Any],
        social_function_profile: Dict[str, float],
    ) -> Dict[str, Any]:
        valence = affect_hints.get("valence")
        activation = affect_hints.get("activation")
        confidence = affect_hints.get("confidence")
        raw = (dominant_emotion or "").lower()

        label = "formal_neutral"
        basis = ["ontology_guarded_interpretation"]

        if quality == "no_face":
            label = "formal_neutral"
            basis.append("no_face_detected")
        elif quality == "weak" or raw == self.uncertain_label:
            if valence == "negative_tilt" and activation == "higher_activation":
                label = "tense"
            elif valence == "negative_tilt":
                label = "concerned"
            elif valence == "positive_tilt":
                label = "warm"
            elif face_signal_level in ("strong", "moderate"):
                label = "serious"
            else:
                label = "restrained"
            basis.append("weak_signal_guard")
        elif raw in {"happy"}:
            label = "warm" if activation != "higher_activation" else "amused"
            basis.append("raw_happy")
        elif raw in {"surprise"}:
            label = "emphatic" if activation == "higher_activation" else "attentive"
            basis.append("raw_surprise")
        elif raw in {"sad"}:
            label = "concerned" if activation != "lower_activation" else "reflective"
            basis.append("guard_sad_to_concerned_or_reflective")
        elif raw in {"angry"}:
            label = "assertive" if activation == "higher_activation" else "serious"
            basis.append("guard_angry_to_serious_or_assertive")
        elif raw in {"fear"}:
            label = "uneasy" if activation != "higher_activation" else "tense"
            basis.append("raw_fear")
        elif raw in {"disgust"}:
            label = "skeptical"
            basis.append("raw_disgust")
        elif raw in {"neutral"}:
            if social_function_profile.get("authority_signal", 0.0) >= 0.4:
                label = "authoritative"
            elif social_function_profile.get("reassurance_signal", 0.0) >= 0.35:
                label = "reassuring"
            elif face_signal_level == "small":
                label = "restrained"
            else:
                label = "formal_neutral"
            basis.append("raw_neutral")
        else:
            if valence == "positive_tilt":
                label = "warm"
            elif valence == "negative_tilt" and activation == "higher_activation":
                label = "tense"
            elif valence == "negative_tilt":
                label = "concerned"
            elif activation == "lower_activation":
                label = "composed"
            else:
                label = "serious"
            basis.append("fallback_mapping")

        ontology = EXPRESSION_ONTOLOGY_MAP.get(label, {})
        return {
            "label": label,
            "confidence": confidence or "low",
            "near_neighbors": ontology.get("near_neighbors", []),
            "social_function": ontology.get("social_function", []),
            "basis": basis,
        }

    # -------------------------
    # Main method — analyze entire video (multi-face)
    # -------------------------
    def run(
        self,
        video_path: str | Path,
        max_duration: Optional[float] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        checkpoint_path: str | Path | None = None,
        checkpoint_every_samples: int = 10,
    ) -> List[Dict[str, Any]]:
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
            completed_sample_indices: set[int] = set()
            checkpoint = Path(checkpoint_path) if checkpoint_path else None
            source_signature = {
                "path": str(video_path.resolve()),
                "size": video_path.stat().st_size,
                "mtime_ns": video_path.stat().st_mtime_ns,
                "interval": self.interval,
                "face_detector": self.face_detector,
            }
            if checkpoint and checkpoint.is_file():
                try:
                    saved = json.loads(checkpoint.read_text(encoding="utf-8"))
                    if saved.get("source_signature") == source_signature:
                        results = saved.get("results") if isinstance(saved.get("results"), list) else []
                        completed_sample_indices = {
                            int(value) for value in saved.get("completed_sample_indices", [])
                        }
                except (OSError, ValueError, TypeError, json.JSONDecodeError):
                    results = []
                    completed_sample_indices = set()

            def persist_checkpoint() -> None:
                if checkpoint is None:
                    return
                checkpoint.parent.mkdir(parents=True, exist_ok=True)
                temporary = checkpoint.with_name(f".{checkpoint.name}.tmp")
                payload = {
                    "schema": "vaa1.expression_analysis_checkpoint.v1",
                    "source_signature": source_signature,
                    "completed_sample_indices": sorted(completed_sample_indices),
                    "results": results,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                try:
                    with temporary.open("w", encoding="utf-8") as handle:
                        json.dump(payload, handle, indent=2, ensure_ascii=False, default=str)
                        handle.flush()
                        os.fsync(handle.fileno())
                    os.replace(temporary, checkpoint)
                finally:
                    temporary.unlink(missing_ok=True)

            sample_index = 0

            for tsec in sample_times:
                if sample_index in completed_sample_indices:
                    if progress_callback:
                        progress_callback({
                            "fraction": (sample_index + 1) / max(len(sample_times), 1),
                            "processed_items": sample_index + 1,
                            "total_items": len(sample_times),
                            "resumed_items": len(completed_sample_indices),
                            "source_seconds": float(tsec),
                            "duration_seconds": float(end_time) if end_time != float("inf") else 0.0,
                        })
                    sample_index += 1
                    continue
                if progress_callback:
                    progress_callback({
                        "fraction": sample_index / max(len(sample_times), 1),
                        "processed_items": sample_index,
                        "total_items": len(sample_times),
                        "source_seconds": float(tsec),
                        "duration_seconds": float(end_time) if end_time != float("inf") else 0.0,
                    })
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
                            "top_emotion_score": None,
                            "score_margin": None,
                            "quality": "error",
                            "detector": self.face_detector,
                            "error": "frame unreadable at seek position",
                        })
                        completed_sample_indices.add(sample_index)
                        if len(completed_sample_indices) % max(1, checkpoint_every_samples) == 0:
                            persist_checkpoint()
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
                        "top_emotion_score": None,
                        "score_margin": None,
                        "quality": "no_face",
                        "face_signal": {
                            "level": "absent",
                            "face_count_in_frame": 0,
                            "face_area_share": 0.0,
                        },
                        "expression_evidence": {
                            "level": "none",
                            "dominant_emotion_ready": False,
                        },
                        "affect_hints": {
                            "valence": "unavailable",
                            "activation": "unavailable",
                            "confidence": "none",
                        },
                        "detector": self.face_detector,
                        "error": "no face detected (fast detector)",
                    })
                    completed_sample_indices.add(sample_index)
                    if len(completed_sample_indices) % max(1, checkpoint_every_samples) == 0:
                        persist_checkpoint()
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
                    face_area_share = ((x1 - x0) * (y1 - y0)) / max(1, (w_frame * h_frame))
                    face_signal_level = (
                        "strong"
                        if face_area_share >= 0.12
                        else "moderate"
                        if face_area_share >= 0.04
                        else "small"
                    )
                    affect_hints = analysis.get("affect_hints") or {
                        "valence": "unavailable",
                        "activation": "unavailable",
                        "confidence": "none",
                    }
                    social_function_profile = self._derive_social_function(
                        affect_hints=affect_hints,
                        quality=str(analysis.get("quality") or ""),
                        face_area_share=float(face_area_share),
                    )
                    interpreted_expression = self._interpret_expression(
                        dominant_emotion=analysis.get("dominant_emotion"),
                        quality=str(analysis.get("quality") or ""),
                        face_signal_level=face_signal_level,
                        affect_hints=affect_hints,
                        social_function_profile=social_function_profile,
                    )

                    results.append({
                        "frame_index": sample_index,
                        "timestamp": round(float(timestamp), 3),
                        "face_id": face_id,
                        "bbox": [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
                        "dominant_emotion": analysis.get("dominant_emotion"),
                        "emotion": analysis.get("emotion"),
                        "top_emotion_score": analysis.get("top_emotion_score"),
                        "score_margin": analysis.get("score_margin"),
                        "quality": analysis.get("quality"),
                        "face_signal": {
                            "level": face_signal_level,
                            "face_count_in_frame": len(face_bboxes),
                            "face_area_share": round(float(face_area_share), 4),
                        },
                        "expression_evidence": analysis.get("expression_evidence"),
                        "affect_hints": affect_hints,
                        "social_function_profile": social_function_profile,
                        "interpreted_expression": interpreted_expression,
                        "detector": self.face_detector,
                        "error": analysis.get("error"),
                    })

                completed_sample_indices.add(sample_index)
                if len(completed_sample_indices) % max(1, checkpoint_every_samples) == 0:
                    persist_checkpoint()
                sample_index += 1

                if timestamp >= end_time:
                    break

            if progress_callback:
                progress_callback({
                    "fraction": 1.0,
                    "processed_items": len(sample_times),
                    "total_items": len(sample_times),
                    "source_seconds": float(end_time) if end_time != float("inf") else 0.0,
                    "duration_seconds": float(end_time) if end_time != float("inf") else 0.0,
                })
            persist_checkpoint()
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
