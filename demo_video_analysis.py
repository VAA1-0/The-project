"""
Demo Video Analysis Runner
--------------------------
Runs the full visual analysis pipeline (YOLOv8 + EasyOCR)
on a sample video and saves annotated outputs + CSV/JSON results.
"""

from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
from src.backend.utils.logger import get_logger
from pathlib import Path

logger = get_logger(__name__)

if __name__ == "__main__":
    # Choose your test video
    video_path = Path("./samples/Helsinki_main_street.mp4")

    if not video_path.exists():
        logger.error(f"Sample video not found at {video_path}")
        exit()

    logger.info(f"Starting analysis for {video_path.name}")

    pipeline = FrameAnalysisPipeline(
        video_path=str(video_path),
        output_dir="outputs/frames",
        yolo_model_path="yolov8n.pt",
        languages=["en"]
    )

    result = pipeline.analyze(save_video=True, display=False)

    logger.info(f"Analysis complete.")
    logger.info(f"Annotated video saved to: {result['annotated_video']}")
