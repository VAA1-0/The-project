"""
Video Frame Analysis Pipeline
-----------------------------
Performs:
 - Frame extraction from video
 - Object detection (YOLOv8)
 - Text detection (EasyOCR)
 - Annotated output video generation
 - Structured results (CSV/JSON)
"""

import cv2
import json
import numpy as np
import pandas as pd
from ultralytics import YOLO
import easyocr
import os
import re
from pathlib import Path
from datetime import datetime, timezone
from app.pipeline.face_analysis import analyze_face_images_batch
from app.pipeline.face_anonymizer import anonymize_face_batch_results
from src.backend.utils.logger import get_logger

logger = get_logger(__name__)


def _classify_shot_size(height_ratio: float, width_ratio: float) -> str:
    if height_ratio >= 0.9 or width_ratio >= 0.75:
        return "extreme close-up"
    if height_ratio >= 0.72 or width_ratio >= 0.58:
        return "close-up"
    if height_ratio >= 0.58:
        return "cowboy shot"
    if height_ratio >= 0.42:
        return "medium close-up"
    if height_ratio >= 0.28:
        return "medium shot"
    if height_ratio >= 0.12:
        return "long shot"
    return "extreme long shot"


def _calculate_iou(left: dict | None, right: dict | None) -> float:
    if not left or not right:
        return 0.0
    try:
        x_left = max(float(left["bbox_x1"]), float(right["bbox_x1"]))
        y_top = max(float(left["bbox_y1"]), float(right["bbox_y1"]))
        x_right = min(float(left["bbox_x2"]), float(right["bbox_x2"]))
        y_bottom = min(float(left["bbox_y2"]), float(right["bbox_y2"]))
    except Exception:
        return 0.0

    if x_right <= x_left or y_bottom <= y_top:
        return 0.0

    intersection = (x_right - x_left) * (y_bottom - y_top)
    left_area = max(0.0, float(left["bbox_x2"]) - float(left["bbox_x1"])) * max(
        0.0, float(left["bbox_y2"]) - float(left["bbox_y1"])
    )
    right_area = max(0.0, float(right["bbox_x2"]) - float(right["bbox_x1"])) * max(
        0.0, float(right["bbox_y2"]) - float(right["bbox_y1"])
    )
    union = left_area + right_area - intersection
    if union <= 0:
        return 0.0
    return intersection / union


def _calculate_center_distance(left: dict | None, right: dict | None) -> float:
    if not left or not right:
        return float("inf")
    try:
        left_cx = (float(left["bbox_x1"]) + float(left["bbox_x2"])) / 2
        left_cy = (float(left["bbox_y1"]) + float(left["bbox_y2"])) / 2
        right_cx = (float(right["bbox_x1"]) + float(right["bbox_x2"])) / 2
        right_cy = (float(right["bbox_y1"]) + float(right["bbox_y2"])) / 2
    except Exception:
        return float("inf")
    return float(np.hypot(left_cx - right_cx, left_cy - right_cy))


def _classify_tone_family(bgr: np.ndarray) -> str:
    blue, green, red = [float(value) for value in bgr]
    if max(blue, green, red) - min(blue, green, red) < 18:
        if max(blue, green, red) < 70:
            return "dark neutral"
        if max(blue, green, red) > 190:
            return "light neutral"
        return "neutral"
    if green >= blue and green >= red:
        return "green"
    if blue >= green and blue >= red:
        return "blue-cyan"
    if red >= green and red >= blue:
        return "red-magenta"
    return "mixed"


def _classify_brightness(value: float) -> str:
    if value < 70:
        return "dark"
    if value < 170:
        return "mid"
    return "bright"


def _classify_saturation(value: float) -> str:
    if value < 40:
        return "low"
    if value < 110:
        return "moderate"
    return "high"


def _transition_label(frame_class_changed: bool, zone_tone_shift: int, occupancy_shift: float) -> str:
    if frame_class_changed or zone_tone_shift >= 4 or occupancy_shift >= 0.42:
        return "possible cut"
    if zone_tone_shift >= 2 or occupancy_shift >= 0.18:
        return "possible dissolve/fade"
    return "continuity stable"


def _movement_hint_label(occupancy_shift: float, zone_tone_shift: int) -> str:
    if occupancy_shift >= 0.35:
        return "strong camera or scene motion"
    if occupancy_shift >= 0.16 or zone_tone_shift >= 2:
        return "mild motion or reframing"
    return "mostly static"


def _motion_intensity_label(
    occupancy_shift: float,
    foreground_delta: float,
    background_delta: float,
    zone_tone_shift: int,
) -> str:
    if (
        occupancy_shift >= 0.35
        or foreground_delta >= 0.2
        or background_delta >= 0.16
        or zone_tone_shift >= 4
    ):
        return "high motion"
    if (
        occupancy_shift >= 0.16
        or foreground_delta >= 0.08
        or background_delta >= 0.06
        or zone_tone_shift >= 2
    ):
        return "moderate motion"
    return "low motion"


def _activity_band_label(foreground_activity: float, background_activity: float) -> str:
    combined_activity = max(foreground_activity, 0.0) + max(background_activity, 0.0)
    if combined_activity >= 0.5:
        return "dense visual activity"
    if combined_activity >= 0.22:
        return "moderate visual activity"
    return "sparse visual activity"


def _composition_hint_label(left_zone: dict, center_zone: dict, right_zone: dict) -> str:
    left_mass = float(left_zone.get("occupancy_mass", 0.0))
    center_mass = float(center_zone.get("occupancy_mass", 0.0))
    right_mass = float(right_zone.get("occupancy_mass", 0.0))
    center_text = int(center_zone.get("text_count", 0) or 0)
    center_people = int(center_zone.get("person_count", 0) or 0)
    total_text = center_text + int(left_zone.get("text_count", 0) or 0) + int(right_zone.get("text_count", 0) or 0)

    if total_text >= 2 and center_text >= 1:
        return "text-led"
    if center_people >= 1 and center_mass >= max(left_mass, right_mass):
        return "center-weighted human framing"
    if center_mass >= left_mass * 1.25 and center_mass >= right_mass * 1.25:
        return "center-weighted"
    if left_mass >= right_mass * 1.25 and left_mass >= center_mass:
        return "left-weighted"
    if right_mass >= left_mass * 1.25 and right_mass >= center_mass:
        return "right-weighted"
    return "balanced or dispersed"


def _subject_arrangement_hint_label(
    *,
    person_count: int,
    total_text: int,
    center_text: int,
    zones: dict,
) -> str:
    total_occupancy = sum(float((zones.get(name) or {}).get("occupancy_mass", 0.0)) for name in zones.keys())
    center_zone = zones.get("center") or {}
    center_people = int(center_zone.get("person_count", 0) or 0)

    if total_text >= 3 and center_text >= 1 and person_count == 0:
        return "text-dominant"
    if person_count >= 1 and total_text >= 2:
        return "human-plus-graphic"
    if person_count >= 2:
        return "multi-subject"
    if person_count == 1 and center_people >= 1:
        return "single-subject"
    if total_occupancy >= 0.18:
        return "scene-dominant"
    return "dispersed or low-activity"


class FrameAnalysisPipeline:
    def __init__(
    self,
    video_path: str,
    output_dir: str = "outputs/frames",
    yolo_model_path: str = "models/yolov8n.pt",
    languages: list = ["en"],
    enable_object_detection: bool = True,
    enable_ocr: bool = True,
    detection_interval_seconds: float = 0.0,
    ocr_interval_seconds: float = 1.0,
    enable_face_sampling: bool = True,
    apply_face_anonymization: bool = False,
    face_message_style: str = "plain",
    face_requires_person_detection: bool = False,
):
        self.video_path = Path(video_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.apply_face_anonymization = apply_face_anonymization
        self.face_message_style = face_message_style
        self.face_requires_person_detection = face_requires_person_detection
        self.enable_object_detection = enable_object_detection
        self.enable_ocr = enable_ocr
        self.enable_face_sampling = enable_face_sampling
        self.detection_interval_seconds = max(0.0, float(detection_interval_seconds))
        self.ocr_interval_seconds = max(0.1, float(ocr_interval_seconds))

    # Create subdirectories for organized output
        self.videos_dir = self.output_dir / "videos"
        self.csv_dir = self.output_dir / "csv"
        self.json_dir = self.output_dir / "json"
        self.faces_dir = self.output_dir / "faces"
    
    # Ensure subdirectories exist
        self.videos_dir.mkdir(exist_ok=True)
        self.csv_dir.mkdir(exist_ok=True)
        self.json_dir.mkdir(exist_ok=True)
        self.faces_dir.mkdir(exist_ok=True)

    # Initialize only the models the selected profile actually needs
        self.yolo = YOLO(yolo_model_path) if self.enable_object_detection else None
        self.ocr = easyocr.Reader(languages) if self.enable_ocr else None

        self.video_name = self.video_path.stem
        # Store output video in videos subdirectory
        self.output_video_path = self.videos_dir / f"{self.video_name}_annotated.mp4"
    # Containers for detection data
        self.yolo_results_list = []
        self.grouped_yolo_results_list = []
        self.ocr_results_list = []
        self.spatial_tone_samples = []
        self.face_frame_items = []
        self.face_frames_considered = 0
        self.face_frames_selected = 0
        self.face_frames_skipped_no_person = 0

    @staticmethod
    def _normalize_ocr_text(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").strip())

    @staticmethod
    def _ocr_text_quality_ok(text: str, confidence: float) -> bool:
        cleaned = FrameAnalysisPipeline._normalize_ocr_text(text)
        if len(cleaned) < 2:
            return False
        if confidence < 0.18:
            return False

        meaningful_chars = sum(char.isalnum() for char in cleaned)
        if meaningful_chars < 2:
            return False

        punctuation_chars = sum(not char.isalnum() and not char.isspace() for char in cleaned)
        if punctuation_chars > meaningful_chars:
            return False

        if len(cleaned) >= 5 and meaningful_chars / max(len(cleaned), 1) < 0.45:
            return False

        return True

    @staticmethod
    def _scale_bbox_points(bbox, scale_x: float, scale_y: float):
        return [
            [float(point[0]) / max(scale_x, 1e-6), float(point[1]) / max(scale_y, 1e-6)]
            for point in bbox
        ]

    def _dedupe_ocr_results(self, records: list[dict]) -> list[dict]:
        deduped: list[dict] = []
        for record in sorted(records, key=lambda item: float(item.get("confidence", 0.0)), reverse=True):
            bbox = record.get("bbox") or []
            if len(bbox) < 4:
                continue
            xs = [float(point[0]) for point in bbox]
            ys = [float(point[1]) for point in bbox]
            candidate_box = {
                "bbox_x1": min(xs),
                "bbox_y1": min(ys),
                "bbox_x2": max(xs),
                "bbox_y2": max(ys),
            }
            normalized_text = self._normalize_ocr_text(str(record.get("text", ""))).lower()

            duplicate = next(
                (
                    existing
                    for existing in deduped
                    if normalized_text == self._normalize_ocr_text(str(existing.get("text", ""))).lower()
                    and (
                        _calculate_iou(
                            {
                                "bbox_x1": min(point[0] for point in existing["bbox"]),
                                "bbox_y1": min(point[1] for point in existing["bbox"]),
                                "bbox_x2": max(point[0] for point in existing["bbox"]),
                                "bbox_y2": max(point[1] for point in existing["bbox"]),
                            },
                            candidate_box,
                        )
                        >= 0.35
                        or _calculate_center_distance(
                            {
                                "bbox_x1": min(point[0] for point in existing["bbox"]),
                                "bbox_y1": min(point[1] for point in existing["bbox"]),
                                "bbox_x2": max(point[0] for point in existing["bbox"]),
                                "bbox_y2": max(point[1] for point in existing["bbox"]),
                            },
                            candidate_box,
                        )
                        <= 60.0
                    )
                ),
                None,
            )
            if duplicate:
                continue
            deduped.append(record)
        return deduped

    def _build_ocr_variants(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        upscale = cv2.resize(frame, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
        adaptive = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            11,
        )
        adaptive_rgb = cv2.cvtColor(adaptive, cv2.COLOR_GRAY2RGB)
        gray_rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
        original_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        upscale_rgb = cv2.cvtColor(upscale, cv2.COLOR_BGR2RGB)

        return [
            (original_rgb, 1.0, 1.0),
            (gray_rgb, 1.0, 1.0),
            (adaptive_rgb, 1.0, 1.0),
            (upscale_rgb, 1.5, 1.5),
        ]

    def _process_frame_sample(
        self,
        frame,
        *,
        timestamp: float,
        frame_index: int,
        previous_detection_timestamp: float,
        previous_ocr_timestamp: float,
    ) -> tuple[float, float]:
        detections = []
        ocr_results: list[dict] = []

        should_detect_objects = self.enable_object_detection and (
            self.detection_interval_seconds == 0.0
            or (timestamp - previous_detection_timestamp) >= self.detection_interval_seconds
            or frame_index == 0
        )

        if should_detect_objects and self.yolo is not None:
            yolo_results = self.yolo(frame)
            detections = yolo_results[0].boxes

            for det in detections:
                class_id = int(det.cls)
                class_name = self.yolo.names[class_id]
                confidence = float(det.conf)
                bbox = det.xyxy[0].tolist()
                self.yolo_results_list.append({
                    "timestamp": timestamp,
                    "class_id": class_id,
                    "class_name": class_name,
                    "confidence": confidence,
                    "bbox_x1": bbox[0],
                    "bbox_y1": bbox[1],
                    "bbox_x2": bbox[2],
                    "bbox_y2": bbox[3],
                })

            previous_detection_timestamp = timestamp

        if (timestamp - previous_ocr_timestamp) >= self.ocr_interval_seconds or frame_index == 0:
            if self.enable_face_sampling:
                self.face_frames_considered += 1
            if self.enable_ocr:
                ocr_results = self.run_ocr(frame, timestamp)
                self.ocr_results_list.extend(ocr_results)

            person_detected = any(
                self.yolo is not None and self.yolo.names[int(det.cls)] == "person"
                for det in detections
            )

            if self.enable_face_sampling:
                if self.face_requires_person_detection and not person_detected:
                    self.face_frames_skipped_no_person += 1
                else:
                    face_frame_path = self.faces_dir / f"{self.video_name}_frame_{frame_index:06d}.jpg"
                    cv2.imwrite(str(face_frame_path), frame)
                    self.face_frame_items.append({
                        "image_path": str(face_frame_path),
                        "source_timestamp": timestamp,
                        "frame_index": frame_index,
                        "person_detected_by_yolo": person_detected,
                    })
                    self.face_frames_selected += 1

            previous_ocr_timestamp = timestamp

        self.spatial_tone_samples.append(
            self._sample_spatial_tone_scan(
                frame,
                timestamp=timestamp,
                detections=list(detections),
                ocr_results=ocr_results,
            )
        )

        return previous_detection_timestamp, previous_ocr_timestamp

    def _run_sampled_analysis(
        self,
        cap: cv2.VideoCapture,
        *,
        fps: float,
        duration_seconds: float,
    ) -> None:
        positive_intervals = [
            interval
            for interval in [self.detection_interval_seconds, self.ocr_interval_seconds]
            if interval and interval > 0
        ]
        sample_interval = min(positive_intervals) if positive_intervals else 1.0
        sample_timestamps = np.arange(0.0, max(duration_seconds, 0.0) + 0.001, sample_interval)
        previous_ocr_timestamp = -float("inf")
        previous_detection_timestamp = -float("inf")

        logger.info(
            "Using sparse sampled sweep at %.2fs interval across %.2fs video.",
            sample_interval,
            duration_seconds,
        )

        for timestamp in sample_timestamps:
            cap.set(cv2.CAP_PROP_POS_MSEC, float(timestamp) * 1000.0)
            ret, frame = cap.read()
            if not ret:
                continue

            frame_index = int(round(float(timestamp) * fps)) if fps > 0 else int(round(timestamp))
            previous_detection_timestamp, previous_ocr_timestamp = self._process_frame_sample(
                frame,
                timestamp=float(timestamp),
                frame_index=frame_index,
                previous_detection_timestamp=previous_detection_timestamp,
                previous_ocr_timestamp=previous_ocr_timestamp,
            )

    def _group_yolo_results(
        self,
        time_window: float = 1.2,
        iou_threshold: float = 0.2,
        center_distance_threshold: float = 80.0,
    ) -> list[dict]:
        if not self.yolo_results_list:
            return []

        sorted_items = sorted(
            self.yolo_results_list,
            key=lambda item: float(item.get("timestamp", 0.0)),
        )
        grouped: list[dict] = []
        track_counters: dict[str, int] = {}

        for item in sorted_items:
            candidate_tracks = []
            for index, grouped_item in enumerate(grouped):
                grouped_end = float(grouped_item.get("end_timestamp", grouped_item.get("timestamp", 0.0)))
                if grouped_item.get("class_name") != item.get("class_name"):
                    continue
                if abs(float(item.get("timestamp", 0.0)) - grouped_end) > time_window:
                    continue
                iou = _calculate_iou(grouped_item, item)
                center_distance = _calculate_center_distance(grouped_item, item)
                if iou >= iou_threshold or center_distance <= center_distance_threshold:
                    candidate_tracks.append((index, grouped_item, iou, center_distance))

            candidate_tracks.sort(key=lambda candidate: (-candidate[2], candidate[3]))
            best_match = candidate_tracks[0] if candidate_tracks else None

            if best_match:
                _, grouped_item, _, _ = best_match
                grouped_item["end_timestamp"] = float(item.get("timestamp", 0.0))
                grouped_item["occurrence_count"] = int(grouped_item.get("occurrence_count", 1)) + 1
                if float(item.get("confidence", 0.0)) >= float(grouped_item.get("confidence", 0.0)):
                    grouped_item["confidence"] = float(item.get("confidence", 0.0))
                    grouped_item["timestamp"] = float(item.get("timestamp", 0.0))
                    grouped_item["bbox_x1"] = float(item.get("bbox_x1", 0.0))
                    grouped_item["bbox_y1"] = float(item.get("bbox_y1", 0.0))
                    grouped_item["bbox_x2"] = float(item.get("bbox_x2", 0.0))
                    grouped_item["bbox_y2"] = float(item.get("bbox_y2", 0.0))
                continue

            class_name = str(item.get("class_name", "object"))
            next_track_id = track_counters.get(class_name, 0) + 1
            track_counters[class_name] = next_track_id
            grouped.append(
                {
                    **item,
                    "start_timestamp": float(item.get("timestamp", 0.0)),
                    "end_timestamp": float(item.get("timestamp", 0.0)),
                    "occurrence_count": 1,
                    "track_id": next_track_id,
                    "display_label": f"{class_name} track {next_track_id}",
                }
            )

        return grouped

    def _sample_spatial_tone_scan(
        self,
        frame,
        *,
        timestamp: float,
        detections: list | None = None,
        ocr_results: list[dict] | None = None,
    ) -> dict:
        frame_height, frame_width = frame.shape[:2]
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        zones = {
            "left": (0, 0, frame_width // 3, frame_height),
            "center": (frame_width // 3, 0, (frame_width * 2) // 3, frame_height),
            "right": ((frame_width * 2) // 3, 0, frame_width, frame_height),
            "upper": (0, 0, frame_width, frame_height // 3),
            "middle": (0, frame_height // 3, frame_width, (frame_height * 2) // 3),
            "lower": (0, (frame_height * 2) // 3, frame_width, frame_height),
            "upper_left": (0, 0, frame_width // 3, frame_height // 3),
            "upper_right": ((frame_width * 2) // 3, 0, frame_width, frame_height // 3),
            "lower_left": (0, (frame_height * 2) // 3, frame_width // 3, frame_height),
            "lower_right": (
                (frame_width * 2) // 3,
                (frame_height * 2) // 3,
                frame_width,
                frame_height,
            ),
        }

        normalized_boxes: list[dict] = []
        for item in detections or []:
            try:
                bbox = item.xyxy[0].tolist()
                normalized_boxes.append(
                    {
                        "label": str(self.yolo.names[int(item.cls)] if self.yolo is not None else "object"),
                        "x1": float(bbox[0]),
                        "y1": float(bbox[1]),
                        "x2": float(bbox[2]),
                        "y2": float(bbox[3]),
                    }
                )
            except Exception:
                continue

        for item in ocr_results or []:
            bbox = item.get("bbox") or []
            if len(bbox) < 4:
                continue
            xs = [float(point[0]) for point in bbox]
            ys = [float(point[1]) for point in bbox]
            normalized_boxes.append(
                {
                    "label": "text",
                    "x1": min(xs),
                    "y1": min(ys),
                    "x2": max(xs),
                    "y2": max(ys),
                }
            )

        zone_summaries: dict[str, dict] = {}
        total_people = sum(1 for box in normalized_boxes if box["label"] == "person")
        total_text = sum(1 for box in normalized_boxes if box["label"] == "text")
        for zone_name, (x1, y1, x2, y2) in zones.items():
            region = frame[y1:y2, x1:x2]
            region_hsv = hsv[y1:y2, x1:x2]
            if region.size == 0 or region_hsv.size == 0:
                continue
            mean_bgr = region.mean(axis=(0, 1))
            mean_hsv = region_hsv.mean(axis=(0, 1))
            zone_area = max(float((x2 - x1) * (y2 - y1)), 1.0)

            occupancy = 0.0
            person_count = 0
            text_count = 0
            object_count = 0
            for box in normalized_boxes:
                overlap_x1 = max(float(x1), box["x1"])
                overlap_y1 = max(float(y1), box["y1"])
                overlap_x2 = min(float(x2), box["x2"])
                overlap_y2 = min(float(y2), box["y2"])
                if overlap_x2 <= overlap_x1 or overlap_y2 <= overlap_y1:
                    continue
                occupancy += ((overlap_x2 - overlap_x1) * (overlap_y2 - overlap_y1)) / zone_area
                if box["label"] == "person":
                    person_count += 1
                elif box["label"] == "text":
                    text_count += 1
                else:
                    object_count += 1

            zone_summaries[zone_name] = {
                "occupancy_mass": round(min(occupancy, 1.0), 4),
                "person_count": person_count,
                "text_count": text_count,
                "object_count": object_count,
                "dominant_tone": _classify_tone_family(mean_bgr),
                "brightness_band": _classify_brightness(float(mean_hsv[2])),
                "saturation_band": _classify_saturation(float(mean_hsv[1])),
            }

        if total_people > 0:
            frame_class = "human-centered"
        elif total_text > 1:
            frame_class = "graphic"
        elif normalized_boxes:
            frame_class = "mixed"
        else:
            frame_class = "scene-centered"

        return {
            "timestamp": round(float(timestamp), 3),
            "frame_class": frame_class,
            "zones": zone_summaries,
            "foreground_activity": zone_summaries.get("center", {}).get("occupancy_mass", 0.0),
            "background_activity": (
                zone_summaries.get("upper", {}).get("occupancy_mass", 0.0)
                + zone_summaries.get("lower", {}).get("occupancy_mass", 0.0)
            ) / 2.0,
        }

    def _build_spatial_tone_summary(self) -> dict:
        if not self.spatial_tone_samples:
            return {
                "sample_count": 0,
                "frame_class_distribution": {},
                "dominant_tone_by_zone": {},
            }

        frame_class_counts: dict[str, int] = {}
        dominant_tone_by_zone: dict[str, dict[str, int]] = {}
        for sample in self.spatial_tone_samples:
            frame_class = str(sample.get("frame_class") or "unknown")
            frame_class_counts[frame_class] = frame_class_counts.get(frame_class, 0) + 1
            for zone_name, zone_data in (sample.get("zones") or {}).items():
                tone = str((zone_data or {}).get("dominant_tone") or "unknown")
                zone_bucket = dominant_tone_by_zone.setdefault(zone_name, {})
                zone_bucket[tone] = zone_bucket.get(tone, 0) + 1

        zone_dominants = {
            zone_name: max(counts.items(), key=lambda item: (item[1], item[0]))[0]
            for zone_name, counts in dominant_tone_by_zone.items()
            if counts
        }
        dominant_frame_class = max(
            frame_class_counts.items(),
            key=lambda item: (item[1], item[0]),
        )[0]
        return {
            "sample_count": len(self.spatial_tone_samples),
            "dominant_frame_class": dominant_frame_class,
            "frame_class_distribution": frame_class_counts,
            "dominant_tone_by_zone": zone_dominants,
        }

    def _build_cinematic_clues(self, *, frame_width: int, frame_height: int) -> dict:
        frame_area = max(float(frame_width * frame_height), 1.0)
        person_detections = [
            item
            for item in self.yolo_results_list
            if str(item.get("class_name", "")).lower() == "person"
        ]

        per_timestamp: dict[float, list[dict]] = {}
        for item in person_detections:
            timestamp = round(float(item.get("timestamp", 0.0)), 3)
            per_timestamp.setdefault(timestamp, []).append(item)

        shot_size_samples: list[dict] = []
        counts: dict[str, int] = {}

        for timestamp in sorted(per_timestamp.keys()):
            detections = per_timestamp[timestamp]
            dominant = max(
                detections,
                key=lambda item: max(
                    0.0,
                    (float(item.get("bbox_x2", 0.0)) - float(item.get("bbox_x1", 0.0)))
                    * (float(item.get("bbox_y2", 0.0)) - float(item.get("bbox_y1", 0.0))),
                ),
            )
            width = max(
                0.0,
                float(dominant.get("bbox_x2", 0.0)) - float(dominant.get("bbox_x1", 0.0)),
            )
            height = max(
                0.0,
                float(dominant.get("bbox_y2", 0.0)) - float(dominant.get("bbox_y1", 0.0)),
            )
            area_share = (width * height) / frame_area
            height_ratio = height / max(float(frame_height), 1.0)
            width_ratio = width / max(float(frame_width), 1.0)
            label = _classify_shot_size(height_ratio, width_ratio)
            counts[label] = counts.get(label, 0) + 1
            shot_size_samples.append(
                {
                    "timestamp": float(timestamp),
                    "label": label,
                    "person_count": len(detections),
                    "dominant_area_share": round(area_share, 4),
                    "dominant_height_ratio": round(height_ratio, 4),
                    "dominant_width_ratio": round(width_ratio, 4),
                    "confidence": round(float(dominant.get("confidence", 0.0)), 4),
                }
            )

        dominant_label = None
        if counts:
            dominant_label = max(counts.items(), key=lambda item: (item[1], item[0]))[0]

        transition_samples: list[dict] = []
        transition_counts: dict[str, int] = {}
        movement_samples: list[dict] = []
        movement_counts: dict[str, int] = {}
        composition_samples: list[dict] = []
        composition_counts: dict[str, int] = {}
        subject_arrangement_samples: list[dict] = []
        subject_arrangement_counts: dict[str, int] = {}
        transition_boundaries: list[float] = []
        previous_sample: dict | None = None
        for sample in self.spatial_tone_samples:
            zones = sample.get("zones") or {}
            left_zone = zones.get("left") or {}
            center_zone = zones.get("center") or {}
            right_zone = zones.get("right") or {}
            total_text = (
                int(left_zone.get("text_count", 0) or 0)
                + int(center_zone.get("text_count", 0) or 0)
                + int(right_zone.get("text_count", 0) or 0)
            )
            person_count = sum(
                int((zone or {}).get("person_count", 0) or 0)
                for zone in zones.values()
            )
            label = _composition_hint_label(left_zone, center_zone, right_zone)
            composition_counts[label] = composition_counts.get(label, 0) + 1
            composition_samples.append(
                {
                    "timestamp": float(sample.get("timestamp", 0.0)),
                    "label": label,
                    "left_occupancy": round(float(left_zone.get("occupancy_mass", 0.0)), 4),
                    "center_occupancy": round(float(center_zone.get("occupancy_mass", 0.0)), 4),
                    "right_occupancy": round(float(right_zone.get("occupancy_mass", 0.0)), 4),
                    "frame_class": str(sample.get("frame_class") or "unknown"),
                }
            )
            arrangement_label = _subject_arrangement_hint_label(
                person_count=person_count,
                total_text=total_text,
                center_text=int(center_zone.get("text_count", 0) or 0),
                zones=zones,
            )
            subject_arrangement_counts[arrangement_label] = (
                subject_arrangement_counts.get(arrangement_label, 0) + 1
            )
            subject_arrangement_samples.append(
                {
                    "timestamp": float(sample.get("timestamp", 0.0)),
                    "label": arrangement_label,
                    "person_count": person_count,
                    "text_count": total_text,
                    "frame_class": str(sample.get("frame_class") or "unknown"),
                }
            )

        for sample in self.spatial_tone_samples:
            if not previous_sample:
                previous_sample = sample
                continue
            current_zones = sample.get("zones") or {}
            previous_zones = previous_sample.get("zones") or {}
            shared_zones = set(current_zones.keys()) & set(previous_zones.keys())
            zone_tone_shift = 0
            occupancy_shift = 0.0
            for zone_name in shared_zones:
                current_zone = current_zones.get(zone_name) or {}
                previous_zone = previous_zones.get(zone_name) or {}
                if current_zone.get("dominant_tone") != previous_zone.get("dominant_tone"):
                    zone_tone_shift += 1
                occupancy_shift += abs(
                    float(current_zone.get("occupancy_mass", 0.0))
                    - float(previous_zone.get("occupancy_mass", 0.0))
                )

            label = _transition_label(
                frame_class_changed=str(sample.get("frame_class") or "")
                != str(previous_sample.get("frame_class") or ""),
                zone_tone_shift=zone_tone_shift,
                occupancy_shift=occupancy_shift,
            )
            transition_counts[label] = transition_counts.get(label, 0) + 1
            transition_samples.append(
                {
                    "timestamp": float(sample.get("timestamp", 0.0)),
                    "label": label,
                    "zone_tone_shift": zone_tone_shift,
                    "occupancy_shift": round(occupancy_shift, 4),
                    "frame_class": str(sample.get("frame_class") or "unknown"),
                }
            )
            if label != "continuity stable":
                transition_boundaries.append(float(sample.get("timestamp", 0.0)))

            movement_label = _movement_hint_label(
                occupancy_shift=occupancy_shift,
                zone_tone_shift=zone_tone_shift,
            )
            movement_counts[movement_label] = movement_counts.get(movement_label, 0) + 1
            movement_samples.append(
                {
                    "timestamp": float(sample.get("timestamp", 0.0)),
                    "label": movement_label,
                    "zone_tone_shift": zone_tone_shift,
                    "occupancy_shift": round(occupancy_shift, 4),
                    "frame_class": str(sample.get("frame_class") or "unknown"),
                }
            )
            previous_sample = sample

        dominant_transition = None
        if transition_counts:
            dominant_transition = max(
                transition_counts.items(),
                key=lambda item: (item[1], item[0]),
            )[0]

        dominant_movement = None
        if movement_counts:
            dominant_movement = max(
                movement_counts.items(),
                key=lambda item: (item[1], item[0]),
            )[0]

        dominant_composition = None
        if composition_counts:
            dominant_composition = max(
                composition_counts.items(),
                key=lambda item: (item[1], item[0]),
            )[0]

        dominant_subject_arrangement = None
        if subject_arrangement_counts:
            dominant_subject_arrangement = max(
                subject_arrangement_counts.items(),
                key=lambda item: (item[1], item[0]),
            )[0]

        interval_summaries = []
        sorted_boundaries = sorted(set(transition_boundaries))
        spatial_timestamps = sorted(
            round(float(sample.get("timestamp", 0.0)), 3) for sample in self.spatial_tone_samples
        )

        if spatial_timestamps:
            timeline_end = spatial_timestamps[-1]
            interval_start = spatial_timestamps[0]
            boundary_pointer = 0

            while interval_start <= timeline_end:
                interval_end = min(interval_start + 5.0, timeline_end)
                while boundary_pointer < len(sorted_boundaries):
                    boundary = float(sorted_boundaries[boundary_pointer])
                    if boundary <= interval_start:
                        boundary_pointer += 1
                        continue
                    if boundary < interval_end:
                        interval_end = boundary
                        break
                    break

                interval_samples = [
                    sample
                    for sample in shot_size_samples
                    if interval_start <= float(sample.get("timestamp", 0.0)) < interval_end
                ]
                if not interval_samples and interval_end == timeline_end:
                    interval_samples = [
                        sample
                        for sample in shot_size_samples
                        if interval_start <= float(sample.get("timestamp", 0.0)) <= interval_end
                    ]

                if interval_samples:
                    distribution: dict[str, int] = {}
                    for interval_sample in interval_samples:
                        interval_label = str(interval_sample.get("label") or "unknown")
                        distribution[interval_label] = distribution.get(interval_label, 0) + 1
                    dominant_interval_label = max(
                        distribution.items(), key=lambda item: (item[1], item[0])
                    )[0]
                else:
                    distribution = {"no human framing": 1}
                    dominant_interval_label = "no human framing"

                interval_summaries.append(
                    {
                        "start": round(float(interval_start), 3),
                        "end": round(float(interval_end), 3),
                        "dominant_label": dominant_interval_label,
                        "distribution": distribution,
                    }
                )

                if interval_end >= timeline_end:
                    break
                interval_start = interval_end

        return {
            "shot_size": {
                "method": "largest visible person detection per sampled frame",
                "samples": shot_size_samples,
                "summary": {
                    "dominant_label": dominant_label,
                    "sample_count": len(shot_size_samples),
                    "distribution": counts,
                    "interval_summaries": interval_summaries,
                },
            },
            "transition_clues": {
                "method": "frame-class, tone-zone, and occupancy change between sampled frames",
                "samples": transition_samples,
                "summary": {
                    "dominant_label": dominant_transition,
                    "sample_count": len(transition_samples),
                    "distribution": transition_counts,
                },
            },
            "movement_hint": {
                "method": "occupancy and tone-zone shift between sampled frames",
                "samples": movement_samples,
                "summary": {
                    "dominant_label": dominant_movement,
                    "sample_count": len(movement_samples),
                    "distribution": movement_counts,
                },
            },
            "composition_hint": {
                "method": "left-center-right occupancy and human/text balance per sampled frame",
                "samples": composition_samples,
                "summary": {
                    "dominant_label": dominant_composition,
                    "sample_count": len(composition_samples),
                    "distribution": composition_counts,
                },
            },
            "subject_arrangement_hint": {
                "method": "person presence and text balance across sampled spatial zones",
                "samples": subject_arrangement_samples,
                "summary": {
                    "dominant_label": dominant_subject_arrangement,
                    "sample_count": len(subject_arrangement_samples),
                    "distribution": subject_arrangement_counts,
                },
            },
        }

    def _build_motion_evidence(self) -> dict:
        if len(self.spatial_tone_samples) < 2:
            return {
                "method": "spatial occupancy and tonal-change comparison between sampled frames",
                "samples": [],
                "summary": {
                    "sample_count": 0,
                    "dominant_motion": None,
                    "distribution": {},
                    "activity_distribution": {},
                    "high_motion_samples": 0,
                    "mean_occupancy_shift": 0.0,
                },
            }

        samples: list[dict] = []
        motion_counts: dict[str, int] = {}
        activity_counts: dict[str, int] = {}
        occupancy_shifts: list[float] = []

        previous_sample: dict | None = None
        for sample in self.spatial_tone_samples:
            if previous_sample is None:
                previous_sample = sample
                continue

            current_zones = sample.get("zones") or {}
            previous_zones = previous_sample.get("zones") or {}
            shared_zones = set(current_zones.keys()) & set(previous_zones.keys())
            zone_tone_shift = 0
            occupancy_shift = 0.0
            for zone_name in shared_zones:
                current_zone = current_zones.get(zone_name) or {}
                previous_zone = previous_zones.get(zone_name) or {}
                if current_zone.get("dominant_tone") != previous_zone.get("dominant_tone"):
                    zone_tone_shift += 1
                occupancy_shift += abs(
                    float(current_zone.get("occupancy_mass", 0.0))
                    - float(previous_zone.get("occupancy_mass", 0.0))
                )

            foreground_delta = abs(
                float(sample.get("foreground_activity", 0.0))
                - float(previous_sample.get("foreground_activity", 0.0))
            )
            background_delta = abs(
                float(sample.get("background_activity", 0.0))
                - float(previous_sample.get("background_activity", 0.0))
            )
            motion_label = _motion_intensity_label(
                occupancy_shift=occupancy_shift,
                foreground_delta=foreground_delta,
                background_delta=background_delta,
                zone_tone_shift=zone_tone_shift,
            )
            activity_label = _activity_band_label(
                float(sample.get("foreground_activity", 0.0)),
                float(sample.get("background_activity", 0.0)),
            )
            motion_counts[motion_label] = motion_counts.get(motion_label, 0) + 1
            activity_counts[activity_label] = activity_counts.get(activity_label, 0) + 1
            occupancy_shifts.append(float(occupancy_shift))
            samples.append(
                {
                    "timestamp": round(float(sample.get("timestamp", 0.0)), 3),
                    "motion_label": motion_label,
                    "activity_label": activity_label,
                    "occupancy_shift": round(float(occupancy_shift), 4),
                    "foreground_delta": round(float(foreground_delta), 4),
                    "background_delta": round(float(background_delta), 4),
                    "zone_tone_shift": int(zone_tone_shift),
                    "frame_class": str(sample.get("frame_class") or "unknown"),
                }
            )
            previous_sample = sample

        dominant_motion = (
            max(motion_counts.items(), key=lambda item: (item[1], item[0]))[0]
            if motion_counts
            else None
        )
        return {
            "method": "spatial occupancy and tonal-change comparison between sampled frames",
            "samples": samples,
            "summary": {
                "sample_count": len(samples),
                "dominant_motion": dominant_motion,
                "distribution": motion_counts,
                "activity_distribution": activity_counts,
                "high_motion_samples": sum(
                    1 for sample in samples if sample.get("motion_label") == "high motion"
                ),
                "mean_occupancy_shift": round(
                    float(np.mean(occupancy_shifts)) if occupancy_shifts else 0.0,
                    4,
                ),
            },
        }

    def _build_scene_segments(self) -> dict:
        if not self.spatial_tone_samples:
            return {
                "method": "scene boundaries unavailable",
                "source": "none",
                "segments": [],
                "summary": {
                    "scene_count": 0,
                    "mean_scene_duration": 0.0,
                },
            }

        timestamps = [
            round(float(sample.get("timestamp", 0.0)), 3) for sample in self.spatial_tone_samples
        ]
        timeline_start = timestamps[0]
        timeline_end = timestamps[-1]
        segments: list[dict] = []
        source = "derived"
        method = "derived from sampled transition clues"

        try:
            from scenedetect import ContentDetector, SceneManager, open_video

            video = open_video(str(self.video_path))
            scene_manager = SceneManager()
            scene_manager.add_detector(ContentDetector())
            scene_manager.detect_scenes(video)
            detected_scenes = scene_manager.get_scene_list()
            if detected_scenes:
                for index, (start_time, end_time) in enumerate(detected_scenes, start=1):
                    start_seconds = round(float(start_time.get_seconds()), 3)
                    end_seconds = round(float(end_time.get_seconds()), 3)
                    segments.append(
                        {
                            "scene_index": index,
                            "start": start_seconds,
                            "end": end_seconds,
                            "duration": round(max(end_seconds - start_seconds, 0.0), 3),
                        }
                    )
                source = "scenedetect"
                method = "PySceneDetect content detector"
        except Exception as exc:
            logger.info("SceneDetect unavailable or failed, using derived scene basis: %s", exc)

        if not segments:
            boundaries: list[float] = []
            previous_sample: dict | None = None
            for sample in self.spatial_tone_samples:
                if previous_sample is None:
                    previous_sample = sample
                    continue
                current_zones = sample.get("zones") or {}
                previous_zones = previous_sample.get("zones") or {}
                shared_zones = set(current_zones.keys()) & set(previous_zones.keys())
                zone_tone_shift = 0
                occupancy_shift = 0.0
                for zone_name in shared_zones:
                    current_zone = current_zones.get(zone_name) or {}
                    previous_zone = previous_zones.get(zone_name) or {}
                    if current_zone.get("dominant_tone") != previous_zone.get("dominant_tone"):
                        zone_tone_shift += 1
                    occupancy_shift += abs(
                        float(current_zone.get("occupancy_mass", 0.0))
                        - float(previous_zone.get("occupancy_mass", 0.0))
                    )
                label = _transition_label(
                    frame_class_changed=str(sample.get("frame_class") or "")
                    != str(previous_sample.get("frame_class") or ""),
                    zone_tone_shift=zone_tone_shift,
                    occupancy_shift=occupancy_shift,
                )
                if label != "continuity stable":
                    boundaries.append(round(float(sample.get("timestamp", 0.0)), 3))
                previous_sample = sample

            cut_points = [timeline_start] + sorted(set(boundaries)) + [timeline_end]
            for index in range(len(cut_points) - 1):
                start_seconds = cut_points[index]
                end_seconds = cut_points[index + 1]
                if end_seconds <= start_seconds:
                    continue
                segments.append(
                    {
                        "scene_index": len(segments) + 1,
                        "start": round(float(start_seconds), 3),
                        "end": round(float(end_seconds), 3),
                        "duration": round(float(end_seconds - start_seconds), 3),
                    }
                )

        mean_scene_duration = (
            float(np.mean([segment["duration"] for segment in segments]))
            if segments
            else 0.0
        )
        return {
            "method": method,
            "source": source,
            "segments": segments,
            "summary": {
                "scene_count": len(segments),
                "mean_scene_duration": round(mean_scene_duration, 3),
            },
        }

    def _build_shot_boundary_intervals(self, cinematic_clues: dict | None = None) -> dict:
        timestamps = sorted(
            round(float(sample.get("timestamp", 0.0)), 3)
            for sample in self.spatial_tone_samples
        )
        timeline_start = timestamps[0] if timestamps else 0.0
        timeline_end = timestamps[-1] if timestamps else 0.0
        intervals: list[dict] = []
        boundaries: list[dict] = []
        source = "none"
        method = "shot boundaries unavailable"
        true_boundary_intervals = False

        try:
            from scenedetect import ContentDetector, SceneManager, open_video

            video = open_video(str(self.video_path))
            scene_manager = SceneManager()
            scene_manager.add_detector(ContentDetector())
            scene_manager.detect_scenes(video)
            detected_shots = scene_manager.get_scene_list()
            if detected_shots:
                source = "pyscenedetect"
                method = "PySceneDetect ContentDetector shot boundary intervals"
                true_boundary_intervals = True
                for index, (start_time, end_time) in enumerate(detected_shots, start=1):
                    start_seconds = round(float(start_time.get_seconds()), 3)
                    end_seconds = round(float(end_time.get_seconds()), 3)
                    if end_seconds <= start_seconds:
                        continue
                    intervals.append(
                        {
                            "shot_id": f"shot:{index:04d}",
                            "start": start_seconds,
                            "end": end_seconds,
                            "duration": round(end_seconds - start_seconds, 3),
                            "boundary_in": start_seconds if index > 1 else None,
                            "boundary_out": end_seconds,
                            "confidence": 0.82,
                            "source": source,
                            "review_state": "available",
                        }
                    )
        except Exception as exc:
            logger.info("Shot boundary detection unavailable or failed, using transition fallback: %s", exc)

        if not intervals:
            transition_samples = (
                (cinematic_clues or {})
                .get("transition_clues", {})
                .get("samples", [])
            )
            fallback_boundaries = [
                round(float(sample.get("timestamp", 0.0)), 3)
                for sample in transition_samples
                if str(sample.get("label") or "") != "continuity stable"
            ]
            cut_points = [timeline_start] + sorted(set(fallback_boundaries)) + [timeline_end]
            source = "sampled_transition_proxy" if fallback_boundaries else "sampled_timeline_extent"
            method = "sampled frame transition fallback; not a finished true shot detector"
            true_boundary_intervals = False
            for index in range(len(cut_points) - 1):
                start_seconds = cut_points[index]
                end_seconds = cut_points[index + 1]
                if end_seconds <= start_seconds:
                    continue
                intervals.append(
                    {
                        "shot_id": f"shot-proxy:{len(intervals) + 1:04d}",
                        "start": round(float(start_seconds), 3),
                        "end": round(float(end_seconds), 3),
                        "duration": round(float(end_seconds - start_seconds), 3),
                        "boundary_in": start_seconds if intervals else None,
                        "boundary_out": end_seconds,
                        "confidence": 0.48 if fallback_boundaries else 0.25,
                        "source": source,
                        "review_state": "candidate_review_required",
                    }
                )

        for index, interval in enumerate(intervals[:-1], start=1):
            boundary_time = interval.get("boundary_out")
            if boundary_time is None:
                continue
            boundaries.append(
                {
                    "boundary_id": f"shot-boundary:{index:04d}",
                    "time": boundary_time,
                    "pre_shot_id": interval.get("shot_id"),
                    "post_shot_id": intervals[index].get("shot_id") if index < len(intervals) else None,
                    "confidence": interval.get("confidence"),
                    "source": source,
                }
            )

        mean_duration = (
            float(np.mean([interval["duration"] for interval in intervals]))
            if intervals
            else 0.0
        )
        return {
            "schema": "vaa1.shot_boundary_intervals.v1",
            "method": method,
            "source": source,
            "true_boundary_intervals": true_boundary_intervals,
            "intervals": intervals,
            "boundaries": boundaries,
            "summary": {
                "shot_count": len(intervals),
                "boundary_count": len(boundaries),
                "mean_shot_duration": round(mean_duration, 3),
            },
            "governance": {
                "not_scene_segments": True,
                "fallback_must_not_be_reported_as_true_shots": not true_boundary_intervals,
                "source_review_required": not true_boundary_intervals,
            },
        }

    def analyze(self, save_video: bool = True, display: bool = False):
        """Main processing loop"""
        logger.info(f"Starting frame analysis on {self.video_path}")

        cap = cv2.VideoCapture(str(self.video_path))
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {self.video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration_seconds = (total_frames / fps) if fps and fps > 0 else 0.0
        frame_count = 0
        previous_ocr_timestamp = -float("inf")
        previous_detection_timestamp = -float("inf")

        # Setup video writer if needed
        out = None
        if save_video:
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(str(self.output_video_path), fourcc, fps, (width, height))

        use_sampled_sweep = (
            not save_video
            and not display
            and (
                self.detection_interval_seconds > 0.0
                or self.ocr_interval_seconds > 0.0
            )
        )

        if use_sampled_sweep:
            self._run_sampled_analysis(
                cap,
                fps=fps,
                duration_seconds=duration_seconds,
            )
            cap.release()
            cv2.destroyAllWindows()
            out = None
        else:
            while True:
                ret, frame = cap.read()
                if not ret:
                    logger.info("End of video reached.")
                    break

                timestamp = frame_count / fps
                detections = []
                ocr_results: list[dict] = []
                annotated_frame = frame.copy()

                should_detect_objects = self.enable_object_detection and (
                    self.detection_interval_seconds == 0.0
                    or (timestamp - previous_detection_timestamp) >= self.detection_interval_seconds
                    or frame_count == 0
                )

                if should_detect_objects and self.yolo is not None:
                    yolo_results = self.yolo(frame)
                    detections = yolo_results[0].boxes

                    for det in detections:
                        class_id = int(det.cls)
                        class_name = self.yolo.names[class_id]
                        confidence = float(det.conf)
                        bbox = det.xyxy[0].tolist()
                        self.yolo_results_list.append({
                            "timestamp": timestamp,
                            "class_id": class_id,
                            "class_name": class_name,
                            "confidence": confidence,
                            "bbox_x1": bbox[0],
                            "bbox_y1": bbox[1],
                            "bbox_x2": bbox[2],
                            "bbox_y2": bbox[3],
                        })

                    annotated_frame = yolo_results[0].plot()
                    previous_detection_timestamp = timestamp

                if (timestamp - previous_ocr_timestamp) >= self.ocr_interval_seconds or frame_count == 0:
                    if self.enable_face_sampling:
                        self.face_frames_considered += 1
                    if self.enable_ocr:
                        ocr_results = self.run_ocr(frame, timestamp)
                        self.ocr_results_list.extend(ocr_results)

                    person_detected = any(
                        self.yolo is not None and self.yolo.names[int(det.cls)] == "person"
                        for det in detections
                    )

                    if self.enable_face_sampling:
                        if self.face_requires_person_detection and not person_detected:
                            self.face_frames_skipped_no_person += 1
                        else:
                            face_frame_path = self.faces_dir / f"{self.video_name}_frame_{frame_count:06d}.jpg"
                            cv2.imwrite(str(face_frame_path), frame)
                            self.face_frame_items.append({
                                "image_path": str(face_frame_path),
                                "source_timestamp": timestamp,
                                "frame_index": frame_count,
                                "person_detected_by_yolo": person_detected,
                            })
                            self.face_frames_selected += 1

                    previous_ocr_timestamp = timestamp

                self.spatial_tone_samples.append(
                    self._sample_spatial_tone_scan(
                        frame,
                        timestamp=timestamp,
                        detections=list(detections),
                        ocr_results=ocr_results,
                    )
                )

                if save_video:
                    out.write(annotated_frame)
                if display:
                    cv2.imshow("Frame Analysis", annotated_frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                frame_count += 1

            cap.release()
            if out:
                out.release()
            cv2.destroyAllWindows()

        face_batch_result = None
        face_anonymization_result = None
        if self.enable_face_sampling and self.face_frame_items:
            face_batch_result = analyze_face_images_batch(
                frame_items=self.face_frame_items,
                output_dir=self.faces_dir / "batch_analysis",
                style_mode=self.face_message_style,
            )
            if self.apply_face_anonymization:
                face_anonymization_result = anonymize_face_batch_results(
                    face_batch_result=face_batch_result,
                    output_dir=self.faces_dir / "anonymized",
                )

        self.grouped_yolo_results_list = self._group_yolo_results()
        cinematic_clues = self._build_cinematic_clues(
            frame_width=width,
            frame_height=height,
        )
        spatial_tone_scan = {
            "summary": self._build_spatial_tone_summary(),
            "samples": self.spatial_tone_samples,
        }
        motion_evidence = self._build_motion_evidence()
        scene_segments = self._build_scene_segments()
        shot_boundaries = self._build_shot_boundary_intervals(cinematic_clues)

        # Save results
        self._save_results(
            cinematic_clues=cinematic_clues,
            spatial_tone_scan=spatial_tone_scan,
            motion_evidence=motion_evidence,
            scene_segments=scene_segments,
            shot_boundaries=shot_boundaries,
        )

        logger.info("Frame analysis complete.")
        return {
            "yolo_results": self.yolo_results_list,
            "tracked_objects": self.grouped_yolo_results_list,
            "ocr_results": self.ocr_results_list,
            "face_results": face_batch_result,
            "face_anonymization": face_anonymization_result,
            "face_anonymization_enabled": self.apply_face_anonymization,
            "face_requires_person_detection": self.face_requires_person_detection,
            "face_sampling": {
                "frames_considered": self.face_frames_considered,
                "frames_selected": self.face_frames_selected,
                "frames_skipped_no_person": self.face_frames_skipped_no_person,
            },
            "cinematic_clues": cinematic_clues,
            "spatial_tone_scan": spatial_tone_scan,
            "motion_evidence": motion_evidence,
            "scene_segments": scene_segments,
            "shot_boundaries": shot_boundaries,
            "annotated_video": str(self.output_video_path) if save_video else None,
            "yolo_csv": str(self.yolo_csv_path),
            "tracked_objects_csv": str(self.tracked_objects_csv_path),
            "tracked_objects_json": str(self.tracked_objects_json_path),
            "ocr_csv": str(self.ocr_csv_path),
            "summary_json": str(self.json_path),
            "output_directory": str(self.output_dir)
        }

    def run_ocr(self, frame, timestamp: float):
        """Run OCR on a frame and return detected texts."""
        collected = []
        for prepared_frame, scale_x, scale_y in self._build_ocr_variants(frame):
            try:
                results = self.ocr.readtext(prepared_frame)
            except Exception as exc:
                logger.warning("OCR variant failed at %.2fs: %s", timestamp, exc)
                continue

            for bbox, text, conf in results:
                confidence = float(conf or 0.0)
                normalized_text = self._normalize_ocr_text(str(text))
                if not self._ocr_text_quality_ok(normalized_text, confidence):
                    continue
                scaled_bbox = self._scale_bbox_points(bbox, scale_x, scale_y)
                collected.append(
                    {
                        "timestamp": timestamp,
                        "text": normalized_text,
                        "confidence": confidence,
                        "bbox": scaled_bbox,
                    }
                )

        ocr_data = self._dedupe_ocr_results(collected)
        for item in ocr_data:
            pts = np.array(item["bbox"], np.int32)
            cv2.polylines(frame, [pts], True, (0, 255, 0), 2)
            cv2.putText(
                frame,
                item["text"],
                (pts[0][0], pts[0][1] - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                2,
            )
        return ocr_data
    def _save_results(
        self,
        *,
        cinematic_clues: dict | None = None,
        spatial_tone_scan: dict | None = None,
        motion_evidence: dict | None = None,
        scene_segments: dict | None = None,
        shot_boundaries: dict | None = None,
    ):
        """Save YOLO and OCR results as CSV and JSON in organized directories."""
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        yolo_df = pd.DataFrame(self.yolo_results_list)
        tracked_df = pd.DataFrame(self.grouped_yolo_results_list)
        ocr_df = pd.DataFrame(self.ocr_results_list)
    # Save CSV files in csv subdirectory
        yolo_csv = self.csv_dir / f"{self.video_name}_yolo_{timestamp_str}.csv"
        tracked_csv = self.csv_dir / f"{self.video_name}_tracked_objects_{timestamp_str}.csv"
        ocr_csv = self.csv_dir / f"{self.video_name}_ocr_{timestamp_str}.csv"

        yolo_df.to_csv(yolo_csv, index=False)
        tracked_df.to_csv(tracked_csv, index=False)
        ocr_df.to_csv(ocr_csv, index=False)

        tracked_json = self.json_dir / f"{self.video_name}_tracked_objects.json"
        tracked_json.write_text(
            json.dumps(self.grouped_yolo_results_list, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        summary_json = {
            "video_name": self.video_name,
            "timestamp": timestamp_str,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "num_yolo_detections": len(yolo_df),
            "num_tracked_objects": len(tracked_df),
            "num_ocr_detections": len(ocr_df),
            "cinematic_clues": cinematic_clues or {},
            "spatial_tone_scan": spatial_tone_scan or {},
            "motion_evidence": motion_evidence or {},
            "scene_segments": scene_segments or {},
            "shot_boundaries": shot_boundaries or {},
            "output_video": str(self.output_video_path),
            "output_files": {
                "yolo_csv": str(yolo_csv),
                "tracked_objects_csv": str(tracked_csv),
                "tracked_objects_json": str(tracked_json),
                "ocr_csv": str(ocr_csv)
            }
        }

        # Save JSON in json subdirectory
        json_path = self.json_dir / f"{self.video_name}_summary.json"
        pd.Series(summary_json).to_json(json_path)

        logger.info(f"Saved organized results:")
        logger.info(f" - Video: {self.output_video_path}")
        logger.info(f" - YOLO CSV: {yolo_csv}")
        logger.info(f" - Tracked Objects CSV: {tracked_csv}")
        logger.info(f" - Tracked Objects JSON: {tracked_json}")
        logger.info(f" - OCR CSV: {ocr_csv}")
        logger.info(f" - Summary: {json_path}")
        
        # Store these for the return statement
        self.yolo_csv_path = yolo_csv
        self.tracked_objects_csv_path = tracked_csv
        self.tracked_objects_json_path = tracked_json
        self.ocr_csv_path = ocr_csv
        self.json_path = json_path
