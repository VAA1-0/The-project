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
import numpy as np
import pandas as pd
from ultralytics import YOLO
import easyocr
import os
from pathlib import Path
from datetime import datetime
from src.backend.utils.logger import get_logger

logger = get_logger(__name__)


class FrameAnalysisPipeline:
    def __init__(
    self,
    video_path: str,
    output_dir: str = "outputs/frames",
    yolo_model_path: str = "models/yolov8n.pt",
    languages: list = ["en"]
):
        self.video_path = Path(video_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    # Create subdirectories for organized output
        self.videos_dir = self.output_dir / "videos"
        self.csv_dir = self.output_dir / "csv"
        self.json_dir = self.output_dir / "json"
    
    # Ensure subdirectories exist
        self.videos_dir.mkdir(exist_ok=True)
        self.csv_dir.mkdir(exist_ok=True)
        self.json_dir.mkdir(exist_ok=True)

    # Initialize models
        self.yolo = YOLO(yolo_model_path)
        self.ocr = easyocr.Reader(languages)

        self.video_name = self.video_path.stem
        # Store output video in videos subdirectory
        self.output_video_path = self.videos_dir / f"{self.video_name}_annotated.mp4"
    # Containers for detection data
        self.yolo_results_list = []
        self.ocr_results_list = []

    def analyze(self, save_video: bool = True, display: bool = False):
        """Main processing loop"""
        logger.info(f"Starting frame analysis on {self.video_path}")

        cap = cv2.VideoCapture(str(self.video_path))
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {self.video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        frame_count = 0
        previous_second = -1

        # Setup video writer if needed
        out = None
        if save_video:
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(str(self.output_video_path), fourcc, fps, (width, height))

        while True:
            ret, frame = cap.read()
            if not ret:
                logger.info("End of video reached.")
                break

            timestamp = frame_count / fps
            # --- YOLOv8 object detection ---
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

            # --- OCR once per second ---
            current_second = int(timestamp)
            if current_second != previous_second:
                ocr_results = self.run_ocr(frame, timestamp)
                self.ocr_results_list.extend(ocr_results)
                previous_second = current_second

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

        # Save results
        self._save_results()

        logger.info("Frame analysis complete.")
        return {
            "yolo_results": self.yolo_results_list,
            "ocr_results": self.ocr_results_list,
            "annotated_video": str(self.output_video_path),
            "yolo_csv": str(self.yolo_csv_path),
            "ocr_csv": str(self.ocr_csv_path),
            "summary_json": str(self.json_path),
            "output_directory": str(self.output_dir)
        }

    def run_ocr(self, frame, timestamp: float):
        """Run OCR on a frame and return detected texts."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
        frame_rgb = cv2.cvtColor(thresh, cv2.COLOR_GRAY2RGB)
        results = self.ocr.readtext(frame_rgb)

        ocr_data = []
        for bbox, text, conf in results:
            ocr_data.append({
                "timestamp": timestamp,
                "text": text,
                "confidence": conf,
                "bbox": bbox
            })
            pts = np.array(bbox, np.int32)
            cv2.polylines(frame, [pts], True, (0, 255, 0), 2)
            cv2.putText(frame, text, (pts[0][0], pts[0][1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        return ocr_data
    def _save_results(self):
        """Save YOLO and OCR results as CSV and JSON in organized directories."""
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        yolo_df = pd.DataFrame(self.yolo_results_list)
        ocr_df = pd.DataFrame(self.ocr_results_list)
    # Save CSV files in csv subdirectory
        yolo_csv = self.csv_dir / f"{self.video_name}_yolo_{timestamp_str}.csv"
        ocr_csv = self.csv_dir / f"{self.video_name}_ocr_{timestamp_str}.csv"

        yolo_df.to_csv(yolo_csv, index=False)
        ocr_df.to_csv(ocr_csv, index=False)

        summary_json = {
            "video_name": self.video_name,
            "timestamp": timestamp_str,
            "num_yolo_detections": len(yolo_df),
            "num_ocr_detections": len(ocr_df),
            "output_video": str(self.output_video_path),
            "output_files": {
                "yolo_csv": str(yolo_csv),
                "ocr_csv": str(ocr_csv)
            }
        }

        # Save JSON in json subdirectory
        json_path = self.json_dir / f"{self.video_name}_summary.json"
        pd.Series(summary_json).to_json(json_path)

        logger.info(f"Saved organized results:")
        logger.info(f" - Video: {self.output_video_path}")
        logger.info(f" - YOLO CSV: {yolo_csv}")
        logger.info(f" - OCR CSV: {ocr_csv}")
        logger.info(f" - Summary: {json_path}")
        
        # Store these for the return statement
        self.yolo_csv_path = yolo_csv
        self.ocr_csv_path = ocr_csv
        self.json_path = json_path