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
import tempfile
import wave
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
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

    def _build_transcript_data(
        self,
        result: dict[str, Any],
        *,
        strategy: str = "full_pass",
        fallback_used: bool = False,
    ) -> dict[str, Any]:
        return {
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
            "transcription_strategy": strategy,
            "fallback_used": fallback_used,
        }

    def _write_transcript_file(self, transcript_data: dict[str, Any]) -> None:
        output_file = self.output_dir / f"{self.audio_path.stem}_transcript.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=2, ensure_ascii=False)
        logger.info(f"Transcription saved: {output_file}")

    def _transcribe_with_model(self, model: Any, audio_path: Path | str) -> dict[str, Any]:
        result = model.transcribe(str(audio_path), fp16=False)
        return self._build_transcript_data(result)

    def _get_wav_duration_seconds(self) -> Optional[float]:
        if self.audio_path.suffix.lower() != ".wav":
            return None
        try:
            with wave.open(str(self.audio_path), "rb") as handle:
                frame_rate = handle.getframerate()
                if frame_rate <= 0:
                    return None
                return handle.getnframes() / float(frame_rate)
        except Exception:
            return None

    @staticmethod
    def _last_segment_end_seconds(transcript_data: dict[str, Any]) -> float:
        segments = transcript_data.get("segments") or []
        return max(
            (float(seg.get("end") or 0.0) for seg in segments),
            default=0.0,
        )

    def _transcribe_chunked(
        self,
        model: Any,
        *,
        chunk_length_seconds: float = 30.0,
        overlap_seconds: float = 2.0,
    ) -> dict[str, Any]:
        if self.audio_path.suffix.lower() != ".wav":
            raise ValueError("Chunked transcription fallback currently requires WAV input.")

        duration_seconds = self._get_wav_duration_seconds()
        if duration_seconds is None or duration_seconds <= 0:
            raise ValueError("Could not determine WAV duration for chunked fallback.")

        stride_seconds = max(1.0, chunk_length_seconds - overlap_seconds)
        stitched_segments: list[dict[str, Any]] = []
        last_kept_end = 0.0
        language = "unknown"

        with wave.open(str(self.audio_path), "rb") as handle:
            params = handle.getparams()
            frame_rate = handle.getframerate()
            frame_size = handle.getsampwidth() * handle.getnchannels()
            raw_frames = handle.readframes(handle.getnframes())

        chunk_start = 0.0
        while chunk_start < duration_seconds:
            chunk_end = min(duration_seconds, chunk_start + chunk_length_seconds)
            start_frame = int(chunk_start * frame_rate)
            end_frame = int(chunk_end * frame_rate)
            chunk_bytes = raw_frames[start_frame * frame_size:end_frame * frame_size]

            fd, temp_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)
            try:
                with wave.open(temp_path, "wb") as out:
                    out.setparams(params)
                    out.writeframes(chunk_bytes)
                result = model.transcribe(temp_path, fp16=False)
                language = result.get("language", language)
                for seg in result.get("segments", []):
                    adjusted_start = chunk_start + float(seg.get("start") or 0.0)
                    adjusted_end = chunk_start + float(seg.get("end") or adjusted_start)
                    text = str(seg.get("text") or "").strip()
                    if not text:
                        continue
                    if adjusted_end <= last_kept_end + 0.15:
                        continue
                    if adjusted_start < last_kept_end:
                        adjusted_start = last_kept_end
                    stitched_segments.append(
                        {
                            "start": round(adjusted_start, 2),
                            "end": round(max(adjusted_start, adjusted_end), 2),
                            "text": text,
                        }
                    )
                    last_kept_end = max(last_kept_end, adjusted_end)
            finally:
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

            chunk_start += stride_seconds

        return {
            "audio_file": str(self.audio_path),
            "language": language,
            "segments": stitched_segments,
            "created_at": datetime.utcnow().isoformat(),
            "transcription_strategy": "chunked_fallback",
            "fallback_used": True,
            "chunking": {
                "chunk_length_seconds": chunk_length_seconds,
                "overlap_seconds": overlap_seconds,
            },
        }

    def _recover_trailing_tail(
        self,
        model: Any,
        primary: dict[str, Any],
        *,
        tail_chunk_seconds: float = 12.0,
        overlap_seconds: float = 2.0,
        pre_roll_seconds: float = 6.0,
    ) -> dict[str, Any]:
        if self.audio_path.suffix.lower() != ".wav":
            return primary

        duration_seconds = self._get_wav_duration_seconds()
        if duration_seconds is None or duration_seconds <= 0:
            return primary

        primary_end = self._last_segment_end_seconds(primary)
        if primary_end >= duration_seconds - 1.0:
            return primary

        with wave.open(str(self.audio_path), "rb") as handle:
            params = handle.getparams()
            frame_rate = handle.getframerate()
            frame_size = handle.getsampwidth() * handle.getnchannels()
            raw_frames = handle.readframes(handle.getnframes())

        stitched_segments = list(primary.get("segments") or [])
        last_kept_end = primary_end
        chunk_start = max(0.0, primary_end - pre_roll_seconds)
        stride_seconds = max(1.0, tail_chunk_seconds - overlap_seconds)
        language = primary.get("language", "unknown")

        while chunk_start < duration_seconds:
            chunk_end = min(duration_seconds, chunk_start + tail_chunk_seconds)
            start_frame = int(chunk_start * frame_rate)
            end_frame = int(chunk_end * frame_rate)
            chunk_bytes = raw_frames[start_frame * frame_size:end_frame * frame_size]

            fd, temp_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)
            try:
                with wave.open(temp_path, "wb") as out:
                    out.setparams(params)
                    out.writeframes(chunk_bytes)
                result = model.transcribe(temp_path, fp16=False)
                language = result.get("language", language)
                for seg in result.get("segments", []):
                    adjusted_start = chunk_start + float(seg.get("start") or 0.0)
                    adjusted_end = chunk_start + float(seg.get("end") or adjusted_start)
                    text = str(seg.get("text") or "").strip()
                    if not text:
                        continue
                    if adjusted_end <= last_kept_end + 0.15:
                        continue
                    if adjusted_start < last_kept_end:
                        adjusted_start = last_kept_end
                    stitched_segments.append(
                        {
                            "start": round(adjusted_start, 2),
                            "end": round(max(adjusted_start, adjusted_end), 2),
                            "text": text,
                        }
                    )
                    last_kept_end = max(last_kept_end, adjusted_end)
            finally:
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

            chunk_start += stride_seconds

        return {
            "audio_file": str(self.audio_path),
            "language": language,
            "segments": stitched_segments,
            "created_at": datetime.utcnow().isoformat(),
            "transcription_strategy": "tail_recovery_fallback",
            "fallback_used": True,
            "chunking": {
                "tail_chunk_seconds": tail_chunk_seconds,
                "overlap_seconds": overlap_seconds,
                "pre_roll_seconds": pre_roll_seconds,
            },
        }

    def run(self) -> dict:
        """Transcribe the audio file using Whisper model."""
        logger.info(f"Starting transcription for: {self.audio_path}")

        model = whisper.load_model(self.model_name)
        transcript_data = self._transcribe_with_model(model, self.audio_path)
        transcript_data["transcription_strategy"] = "full_pass"
        transcript_data["fallback_used"] = False
        self._write_transcript_file(transcript_data)
        return transcript_data

    def rerun_with_chunked_fallback(
        self,
        *,
        primary_transcript: Optional[dict[str, Any]] = None,
        minimum_improvement_seconds: float = 6.0,
        chunk_length_seconds: float = 30.0,
        overlap_seconds: float = 2.0,
    ) -> dict[str, Any]:
        logger.info(
            "Starting chunked fallback transcription for: %s",
            self.audio_path,
        )
        model = whisper.load_model(self.model_name)
        primary = primary_transcript or self._transcribe_with_model(model, self.audio_path)
        primary["transcription_strategy"] = primary.get("transcription_strategy") or "full_pass"
        primary["fallback_used"] = False
        fallback = self._transcribe_chunked(
            model,
            chunk_length_seconds=chunk_length_seconds,
            overlap_seconds=overlap_seconds,
        )
        if self._last_segment_end_seconds(fallback) < self._last_segment_end_seconds(primary) + minimum_improvement_seconds:
            fallback = self._recover_trailing_tail(model, primary)

        primary_end = self._last_segment_end_seconds(primary)
        fallback_end = self._last_segment_end_seconds(fallback)
        improvement = fallback_end - primary_end
        chosen = fallback if improvement >= minimum_improvement_seconds else primary
        chosen["fallback_considered"] = True
        chosen["fallback_comparison"] = {
            "primary_last_end_seconds": round(primary_end, 3),
            "fallback_last_end_seconds": round(fallback_end, 3),
            "minimum_improvement_seconds": minimum_improvement_seconds,
            "improvement_seconds": round(improvement, 3),
            "selected_strategy": chosen.get("transcription_strategy"),
        }
        self._write_transcript_file(chosen)
        return chosen
