"""
Video/Audio Ingestion Pipeline
------------------------------
Handles:
 - Video validation (format, duration, metadata)
 - Audio extraction (via FFmpeg)
 - Speech-to-text transcription (via Whisper)
 - Output structured transcript data (timestamps, text)
"""

import os
import subprocess
import tempfile
import json
from datetime import datetime
from pathlib import Path
import ffmpeg
import whisper

from src.backend.utils.logger import get_logger

logger = get_logger(__name__)

SUPPORTED_VIDEO_FORMATS = [".mp4", ".mkv", ".avi", ".mov"]
AUDIO_OUTPUT_FORMAT = "wav"


class VideoIngestionError(Exception):
    """Custom exception for ingestion-related errors."""
    pass


def validate_video(video_path: str) -> dict:
    """
    Validate uploaded video file and extract metadata.
    """
    if not os.path.exists(video_path):
        raise VideoIngestionError(f"File not found: {video_path}")

    ext = Path(video_path).suffix.lower()
    if ext not in SUPPORTED_VIDEO_FORMATS:
        raise VideoIngestionError(f"Unsupported video format: {ext}")

    try:
        probe = ffmpeg.probe(video_path)
        format_info = probe.get("format", {})
        duration = float(format_info.get("duration", 0))
        size = int(format_info.get("size", 0))
        video_streams = [s for s in probe["streams"] if s["codec_type"] == "video"]
        audio_streams = [s for s in probe["streams"] if s["codec_type"] == "audio"]
    except ffmpeg.Error as e:
        raise VideoIngestionError(f"ffmpeg probe failed: {e.stderr.decode()}")

    if not audio_streams:
        raise VideoIngestionError("Video has no audio track.")

    return {
        "duration": duration,
        "size_bytes": size,
        "video_codec": video_streams[0].get("codec_name", "unknown"),
        "audio_codec": audio_streams[0].get("codec_name", "unknown"),
        "has_audio": True,
    }


def extract_audio(video_path: str, output_dir: str = None) -> str:
    """
    Extract audio track from video using FFmpeg.
    Returns path to extracted audio file.
    """
    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="vaa1_audio_")

    audio_path = os.path.join(
        output_dir, Path(video_path).stem + f".{AUDIO_OUTPUT_FORMAT}"
    )

    try:
        (
            ffmpeg
            .input(video_path)
            .output(audio_path, format=AUDIO_OUTPUT_FORMAT, acodec="pcm_s16le", ac=1, ar="16000")
            .overwrite_output()
            .run(quiet=True)
        )
        logger.info(f"Audio extracted: {audio_path}")
    except ffmpeg.Error as e:
        raise VideoIngestionError(f"FFmpeg extraction failed: {e.stderr.decode()}")

    return audio_path


def transcribe_audio(audio_path: str, model_name: str = "base") -> dict:
    """
    Transcribe extracted audio into text using Whisper.
    Returns transcript as structured JSON with timestamps.
    """
    if not os.path.exists(audio_path):
        raise VideoIngestionError(f"Audio file not found: {audio_path}")

    logger.info(f"Loading Whisper model: {model_name}")
    model = whisper.load_model(model_name)

    logger.info("Starting transcription...")
    result = model.transcribe(audio_path, fp16=False)

    transcript = {
        "segments": [
            {
                "start": round(seg["start"], 2),
                "end": round(seg["end"], 2),
                "text": seg["text"].strip(),
            }
            for seg in result["segments"]
        ],
        "language": result.get("language", "unknown"),
        "created_at": datetime.utcnow().isoformat(),
    }

    logger.info(f"Transcription completed: {len(transcript['segments'])} segments")
    return transcript


def run_ingestion_pipeline(video_path: str, model_name: str = "base") -> dict:
    """
    Orchestrates video ingestion process.
    Returns dictionary with metadata, transcript, and audio path.
    """
    logger.info(f"Starting ingestion pipeline for: {video_path}")

    metadata = validate_video(video_path)
    audio_path = extract_audio(video_path)
    transcript = transcribe_audio(audio_path, model_name)

    result = {
        "metadata": metadata,
        "transcript": transcript,
        "audio_path": audio_path,
    }

    # Save structured output
    output_json = Path(audio_path).with_suffix(".json")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    logger.info(f"Ingestion pipeline output saved: {output_json}")

    return result
