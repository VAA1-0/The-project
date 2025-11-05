"""
Pipeline Manager
----------------
Runs the full VAA1 video analysis sequence:
Video → Audio → Transcript → Summary → Frame Analysis
"""

import os
from pathlib import Path
from src.backend.analysis.pipeline_ingestion import run_ingestion_pipeline
from src.backend.analysis.pipeline_audio_text import AudioTranscriptionPipeline
from src.backend.analysis.pipeline_summary import SummarizationPipeline
from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
from src.backend.utils.logger import get_logger

logger = get_logger(__name__)


def run_full_pipeline(video_path: str):
    video_path = Path(video_path)
    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    logger.info(f"=== Starting full analysis for: {video_path.name} ===")

    # Step 1 — Video → Audio extraction
    ingestion_result = run_ingestion_pipeline(str(video_path))
    audio_path = ingestion_result["audio_path"]
    logger.info(f"Audio extracted: {audio_path}")

    # Step 2 — Audio → Transcript
    audio_pipeline = AudioTranscriptionPipeline(audio_path)
    transcript = audio_pipeline.run()

    # Step 3 — Transcript → Summary
    summary_pipeline = SummarizationPipeline(transcript)
    summary = summary_pipeline.run()

    # Step 4 — Video → Visual detections
    frame_pipeline = FrameAnalysisPipeline(str(video_path))
    frame_results = frame_pipeline.analyze(save_video=True, display=False)

    # Step 5 — Final summary report
    report = {
        "video": str(video_path),
        "audio": str(audio_path),
        "transcript_file": audio_pipeline.output_dir / f"{audio_path.stem}_transcript.json",
        "summary_file": summary_pipeline.output_dir,
        "frame_results": frame_results,
    }

    logger.info(f"✅ Full pipeline completed for {video_path.name}")
    return report

