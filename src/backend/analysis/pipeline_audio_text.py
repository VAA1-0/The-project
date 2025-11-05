"""
Audio → Text Transcription Pipeline
-----------------------------------
Handles:
 - Audio file validation and preprocessing
 - Transcription using OpenAI Whisper or compatible model
 - Output structured transcript JSON (timestamps + text)
"""

import os
import json
from datetime import datetime
from pathlib import Path
import whisper
from src.backend.utils.logger import get_logger

logger = get_logger(__name__)

SUPPORTED_AUDIO_FORMATS = [".wav", ".mp3", ".m4a"]


class AudioTranscriptionPipeline:
    def __init__(self, audio_path: str, model_name: str = "base"):
        self.audio_path = Path(audio_path)
        self.model_name = model_name

        if not self.audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {self.audio_path}")
        if self.audio_path.suffix.lower() not in SUPPORTED_AUDIO_FORMATS:
            raise ValueError(f"Unsupported audio format: {self.audio_path.suffix}")

        self.output_dir = self.audio_path.parent / "transcripts"
        self.output_dir.mkdir(exist_ok=True)

    def run(self) -> dict:
        """Transcribe the audio file using Whisper model."""
        logger.info(f"Starting transcription for: {self.audio_path}")

        model = whisper.load_model(self.model_name)
        result = model.transcribe(str(self.audio_path), fp16=False)

        transcript_data = {
            "audio_file": str(self.audio_path),
            "language": result.get("language", "unknown"),
            "segments": [
                {
                    "start": round(seg["start"], 2),
                    "end": round(seg["end"], 2),
                    "text": seg["text"].strip(),
                }
                for seg in result["segments"]
            ],
            "created_at": datetime.utcnow().isoformat(),
        }

        output_file = self.output_dir / f"{self.audio_path.stem}_transcript.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=2, ensure_ascii=False)

        logger.info(f"Transcription saved: {output_file}")
        return transcript_data
