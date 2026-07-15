#!/usr/bin/env python3
"""
VAA1 Tune + Lyrics Recognition with Musical Analysis
Tune + Lyrics Recognition for VAA1 (revised)

Class:
    TuneLyricsDetector

Improvements:
- Defensive ffmpeg invocation with error handling and configurable sample rate.
- Lazy Dejavu initialization (avoid DB work during object construction).
- Optional pre-fingerprinting helper.
- Added musical analysis (tempo, key) using librosa.
- Added placeholder for lyric-to-transcript matching.
- Expanded output schema to include musical analysis and lyric matches.
- Configurable confidence threshold and better result validation.
- Logging and clearer error messages.
- Optional temporary audio cleanup.
"""

from __future__ import annotations

import logging
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

try:
    from dejavu import Dejavu
    from dejavu.recognize import FileRecognizer
except Exception:  # pragma: no cover - optional runtime dependency
    Dejavu = None  # type: ignore[assignment]
    FileRecognizer = None  # type: ignore[assignment]

try:
    import lyricsgenius
except Exception:  # pragma: no cover - optional runtime dependency
    lyricsgenius = None  # type: ignore[assignment]

try:
    import librosa
    import numpy as np
except Exception:  # pragma: no cover - optional runtime dependency
    librosa = None  # type: ignore[assignment]
    np = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)
DEFAULT_FINGERPRINT_DIR = "fingerprinted_songs"


class TuneLyricsDetector:
    """
    Detect a tune/song from video/audio, fetch lyrics, and perform musical analysis.

    Usage example:
        detector = TuneLyricsDetector(db_config, genius_api_key)
        # Assuming transcript_data is loaded from VAA1 analysis artifacts
        result = detector.run("video.mp4", transcript_data=transcript, keep_audio=False)
    """

    def __init__(
        self,
        db_config: Dict[str, Any],
        genius_api_key: str,
        fingerprint_dir: str = DEFAULT_FINGERPRINT_DIR,
        confidence_threshold: float = 30.0,
        sample_rate: int = 16000,
        allow_online_lyrics_lookup: bool = False,
    ) -> None:
        """
        Parameters
        ----------
        db_config : dict
            Dejavu-compatible DB configuration.
        genius_api_key : str
            API key for Genius lyrics.
        fingerprint_dir : str
            Directory that holds pre-fingerprinted songs or will be used for fingerprinting.
        confidence_threshold : float
            Minimum recognition confidence to accept a match.
        sample_rate : int
            Output audio sample rate (Hz) produced by ffmpeg (default 16000).
        """
        if not isinstance(db_config, dict):
            raise ValueError("db_config must be a dict for Dejavu")
        if genius_api_key is None or not isinstance(genius_api_key, str):
            genius_api_key = ""

        self._db_config = db_config
        self._dejavu: Optional[Any] = None  # lazy init
        self.fingerprint_dir = Path(fingerprint_dir)
        self.fingerprint_dir.mkdir(parents=True, exist_ok=True)

        # Genius client
        self.genius = lyricsgenius.Genius(genius_api_key, timeout=10, retries=3) if lyricsgenius and genius_api_key else None

        # Tunables
        self.confidence_threshold = float(confidence_threshold)
        self.sample_rate = int(sample_rate)
        self.allow_online_lyrics_lookup = bool(allow_online_lyrics_lookup)

    @property
    def dejavu(self) -> Any:
        """Lazy-create Dejavu instance to avoid connecting during __init__."""
        if Dejavu is None:
            raise RuntimeError("dejavu-audio is not installed; tune fingerprint recognition is unavailable")
        if self._dejavu is None:
            logger.debug("Initializing Dejavu with provided DB config")
            self._dejavu = Dejavu(self._db_config)
        return self._dejavu

    # ---------------------------------------------------------
    # 1. Extract audio from video (ffmpeg)
    # ---------------------------------------------------------
    def extract_audio(self, media_path: str | Path, out_path: Optional[str | Path] = None) -> Path:
        """
        Extract audio using ffmpeg. If out_path is None a temporary .wav file is created.

        Returns Path to the extracted WAV file (mono, sample rate = self.sample_rate).
        Raises RuntimeError on failure.
        """
        media_path = Path(media_path)
        if not media_path.exists():
            raise FileNotFoundError(f"Media file not found: {media_path}")

        if out_path:
            audio_path = Path(out_path)
            audio_path.parent.mkdir(parents=True, exist_ok=True)
        else:
            tmp = tempfile.NamedTemporaryFile(prefix="tune_", suffix=".wav", delete=False)
            tmp.close()
            audio_path = Path(tmp.name)

        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(media_path),
            "-ac",
            "1",
            "-ar",
            str(self.sample_rate),
            "-vn",
            str(audio_path),
            "-y",
        ]

        logger.debug("Running ffmpeg to extract audio: %s", " ".join(cmd))
        completed = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        if completed.returncode != 0:
            # If ffmpeg fails, remove the produced file (if any) and raise
            stderr = completed.stderr.decode(errors="ignore")
            if audio_path.exists():
                try:
                    audio_path.unlink()
                except Exception:
                    logger.debug("Failed to remove partial audio file %s", audio_path, exc_info=True)
            raise RuntimeError(f"ffmpeg failed extracting audio: {stderr.strip() or 'unknown error'}")

        logger.debug("Audio extracted to %s", audio_path)
        return audio_path

    # ---------------------------------------------------------
    # 2. Recognize song from audio using Dejavu
    # ---------------------------------------------------------
    def recognize_tune(self, audio_path: str | Path) -> Optional[Dict[str, Any]]:
        """
        Recognize a song from an audio file.

        Returns a dict with keys: 'song_name', 'artist', 'confidence' or None.
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        if FileRecognizer is None:
            raise RuntimeError("dejavu-audio is not installed; tune fingerprint recognition is unavailable")

        try:
            logger.debug("Recognizing tune for %s", audio_path)
            result = self.dejavu.recognize(FileRecognizer, str(audio_path))
        except Exception as exc:
            logger.exception("Dejavu recognition failed")
            raise RuntimeError(f"Dejavu recognition error: {exc}") from exc

        # Dejavu returns None when nothing found, otherwise a dict with fields.
        if not result:
            logger.info("No match returned by Dejavu")
            return None

        # Normalize result keys and values
        # Typical Dejavu keys: 'song_name', 'artist_name', 'confidence'
        song_name = result.get("song_name") or result.get("track_name") or result.get("title")
        artist = result.get("artist_name") or result.get("artist") or result.get("album_artist")
        conf = result.get("confidence")
        try:
            confidence = float(conf) if conf is not None else 0.0
        except Exception:
            confidence = 0.0

        logger.debug("Recognition result: %s - %s (confidence=%s)", artist, song_name, confidence)

        if confidence < self.confidence_threshold:
            logger.info("Match confidence (%.1f) below threshold (%.1f)", confidence, self.confidence_threshold)
            return None

        return {"song_name": song_name, "artist": artist, "confidence": confidence}

    # ---------------------------------------------------------
    # 3. Retrieve lyrics from Genius
    # ---------------------------------------------------------
    def get_lyrics(self, song_name: str, artist: str) -> Optional[str]:
        """
        Search Genius for lyrics. Returns lyrics text or None.
        """
        if not song_name:
            return None
        if not self.allow_online_lyrics_lookup:
            logger.info("Online lyrics lookup is disabled by policy; lyrics lookup skipped")
            return None
        if self.genius is None:
            logger.info("lyricsgenius is unavailable; lyrics lookup skipped")
            return None
        try:
            logger.debug("Searching Genius for %s - %s", artist, song_name)
            song = self.genius.search_song(song_name, artist)
            if song and getattr(song, "lyrics", None):
                # lyricsgenius may include metadata headers — keep raw lyrics for now
                return song.lyrics
            logger.info("No lyrics found on Genius for %s - %s", artist, song_name)
            return None
        except Exception as exc:
            logger.exception("Genius lookup failed")
            return None

    # ---------------------------------------------------------
    # 4. Perform musical analysis
    # ---------------------------------------------------------
    def analyze_music(self, audio_path: str | Path) -> Dict[str, Any]:
        """
        Analyze audio for tempo (BPS) and key (major/minor).
        """
        results: Dict[str, Any] = {
            "schema": "vaa1.music_analysis.v1",
            "status": "not_computed",
            "beats_per_second": None,
            "average_key_indication": None,
            "per_second_key_indication": [],
        }
        if librosa is None or np is None:
            results["error"] = "librosa/numpy unavailable"
            return results
        try:
            y, sr = librosa.load(str(audio_path), sr=self.sample_rate)

            # BPS
            tempo_bpm, _ = librosa.beat.beat_track(y=y, sr=sr)
            results["beats_per_second"] = round(float(tempo_bpm) / 60.0, 2) if tempo_bpm else None

            # Key analysis
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)

            # Per-second key
            key_indications = []
            for i in range(chroma.shape[1]):
                # Simplified key finding for each frame (approx 1 sec)
                frame_chroma = chroma[:, i]
                key_idx = np.argmax(frame_chroma)
                # This is a simplification; a full key-finding algorithm is more complex
                # but this gives a per-second dominant chroma indication.
                # For now, we just indicate the dominant pitch class.
                # A true major/minor requires a more sophisticated model.
                # Placeholder for major/minor logic:
                key_indications.append({"time": i, "dominant_pitch_class": int(key_idx)})
            results["per_second_key_indication"] = key_indications

            # Average key
            avg_chroma = np.mean(chroma, axis=1)
            # Placeholder for a more robust key-finding algorithm
            # For now, we just indicate a dominant pitch class for the segment
            dominant_pitch_class = int(np.argmax(avg_chroma))
            results["average_key_indication"] = f"Dominant pitch class: {dominant_pitch_class}"
            results["status"] = "computed"

        except Exception:
            logger.exception("Musical analysis failed for %s", audio_path)

        return results

    # ---------------------------------------------------------
    # 5. Match lyrics against transcript
    # ---------------------------------------------------------
    def match_lyrics_to_transcript(self, lyrics: str, transcript_data: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Find occurrences of lyric lines within the transcript.
        This is a simplified version based on text matching.
        """
        if not lyrics or not transcript_data or not transcript_data.get("segments"):
            return []

        matched_segments = []
        lyric_lines = {line.strip().lower() for line in lyrics.split('\n') if line.strip()}

        for segment in transcript_data["segments"]:
            segment_text = segment.get("text", "").strip().lower()
            if segment_text in lyric_lines:
                matched_segments.append({
                    "schema": "vaa1.lyric_transcript_match.v1",
                    "transcript_segment": segment,
                    "matched_lyric_line": segment_text,
                    "start": segment.get("start"),
                    "end": segment.get("end"),
                    "maturity_route": "master_schema.lyric_transcript_match_maturity",
                })
        return matched_segments

    # ---------------------------------------------------------
    # 6. Optional: Fingerprint a directory of songs for Dejavu
    # ---------------------------------------------------------
    def fingerprint_directory(self, music_dir: str | Path, pattern: str = "*.mp3") -> None:
        """
        Fingerprint all files in music_dir (recursive) matching pattern.
        This calls Dejavu's fingerprinting and may take long time.
        """
        music_path = Path(music_dir)
        if not music_path.exists():
            raise FileNotFoundError(f"Music directory not found: {music_path}")
        logger.info("Starting fingerprinting for %s (pattern=%s)", music_path, pattern)
        # Dejavu API expects a directory; ensure we pass string
        try:
            self.dejavu.fingerprint_directory(str(music_path), [pattern])
        except Exception:
            logger.exception("Fingerprinting failed")
            raise

    # ---------------------------------------------------------
    # 7. Master call for VAA1
    # ---------------------------------------------------------
    def run(
        self,
        media_path: str | Path,
        transcript_data: Optional[Dict[str, Any]] = None,
        keep_audio: bool = False,
        out_audio_path: Optional[str | Path] = None,
    ) -> Dict[str, Any]:
        """
        High-level interface:
            video/audio → tune recognition → lyrics → musical analysis → JSON

        Parameters
        ----------
        media_path: path to video or audio file
        transcript_data: optional transcript artifact from VAA1 analysis
        keep_audio: if False, temporary audio file will be removed after processing
        out_audio_path: if provided, the extracted audio will be saved to this path (and not removed)

        Output schema:
        {
            'success': bool,
            'audio_path': str,
            'song_metadata': { ... } | None,
            'lyrics': str | None,
            'musical_analysis': { ... } | None,
            'lyrics_in_transcript': [ ... ] | None,
            'error': str | None
        }
        """
        media_path = Path(media_path)
        if not media_path.exists():
            return {"success": False, "error": "media not found"}

        temp_audio: Optional[Path] = None
        audio_path: Optional[Path] = None

        try:
            # Extract audio (either to provided path or temp file)
            audio_path = self.extract_audio(media_path, out_path=out_audio_path) if out_audio_path else self.extract_audio(media_path)
            temp_audio = audio_path if out_audio_path is None else None

            # Perform musical analysis even if fingerprint recognition is unavailable.
            musical_analysis = self.analyze_music(audio_path)

            # Recognize tune
            tune = None
            recognition_error = None
            try:
                tune = self.recognize_tune(audio_path)
            except Exception as exc:
                recognition_error = str(exc)
                logger.info("Tune recognition unavailable or failed: %s", recognition_error)

            # Fetch lyrics (best-effort)
            lyrics = self.get_lyrics(tune.get("song_name", ""), tune.get("artist", "")) if tune else None

            # Match lyrics to transcript
            lyrics_in_transcript = []
            if lyrics and transcript_data:
                lyrics_in_transcript = self.match_lyrics_to_transcript(lyrics, transcript_data)

            return {
                "schema": "vaa1.tune_lyrics_detector.v1",
                "success": bool(tune or musical_analysis.get("status") == "computed" or lyrics_in_transcript),
                "status": "computed" if tune else "partial",
                "audio_path": str(audio_path),
                "song_metadata": tune,
                "lyrics": lyrics,
                "musical_analysis": musical_analysis,
                "lyrics_in_transcript": lyrics_in_transcript,
                "master_schema_ready": {
                    "music_analysis_surface": "temporal_segments[event_family=music_analysis]",
                    "lyrics_surface": "temporal_segments[event_family=lyric_transcript_match]",
                    "maturity_route": "master_schema.music_lyrics_maturity",
                },
                "runtime_policy": {
                    "core_mode": "license_free_offline_first",
                    "online_lyrics_lookup": "enabled" if self.allow_online_lyrics_lookup else "disabled",
                    "licensed_or_remote_features": "explicit_user_activation_required",
                },
                "error": recognition_error,
            }
        except Exception as exc:
            logger.exception("Run failed")
            return {
                "success": False,
                "audio_path": str(audio_path) if audio_path else None,
                "song_metadata": None,
                "lyrics": None,
                "musical_analysis": None,
                "lyrics_in_transcript": None,
                "error": str(exc),
            }
        finally:
            # Cleanup temporary audio if requested
            if temp_audio and temp_audio.exists() and not keep_audio:
                try:
                    temp_audio.unlink()
                    logger.debug("Removed temporary audio file %s", temp_audio)
                except Exception:
                    logger.debug("Failed to remove temporary audio %s", temp_audio, exc_info=True)
