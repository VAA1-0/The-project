#!/usr/bin/env python3
"""
Tune + Lyrics Recognition for VAA1 (revised)

Class:
    TuneLyricsDetector

Improvements:
- Defensive ffmpeg invocation with error handling and configurable sample rate.
- Lazy Dejavu initialization (avoid DB work during object construction).
- Optional pre-fingerprinting helper.
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
from typing import Optional, Dict, Any

from dejavu import Dejavu
from dejavu.recognize import FileRecognizer
import lyricsgenius

logger = logging.getLogger(__name__)
DEFAULT_FINGERPRINT_DIR = "fingerprinted_songs"


class TuneLyricsDetector:
    """
    Detect a tune/song from video/audio and fetch lyrics.

    Usage example:
        detector = TuneLyricsDetector(db_config, genius_api_key)
        result = detector.run("video.mp4", keep_audio=False)
    """

    def __init__(
        self,
        db_config: Dict[str, Any],
        genius_api_key: str,
        fingerprint_dir: str = DEFAULT_FINGERPRINT_DIR,
        confidence_threshold: float = 30.0,
        sample_rate: int = 16000,
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
        if not genius_api_key or not isinstance(genius_api_key, str):
            raise ValueError("genius_api_key must be a non-empty string")

        self._db_config = db_config
        self._dejavu: Optional[Dejavu] = None  # lazy init
        self.fingerprint_dir = Path(fingerprint_dir)
        self.fingerprint_dir.mkdir(parents=True, exist_ok=True)

        # Genius client
        self.genius = lyricsgenius.Genius(genius_api_key, timeout=10, retries=3)

        # Tunables
        self.confidence_threshold = float(confidence_threshold)
        self.sample_rate = int(sample_rate)

    @property
    def dejavu(self) -> Dejavu:
        """Lazy-create Dejavu instance to avoid connecting during __init__."""
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
    # 4. Optional: Fingerprint a directory of songs for Dejavu
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
    # 5. Master call for VAA1
    # ---------------------------------------------------------
    def run(self, media_path: str | Path, keep_audio: bool = False, out_audio_path: Optional[str | Path] = None) -> Dict[str, Any]:
        """
        High-level interface:
            video/audio → tune recognition → lyrics → JSON

        Parameters
        ----------
        media_path: path to video or audio file
        keep_audio: if False, temporary audio file will be removed after processing
        out_audio_path: if provided, the extracted audio will be saved to this path (and not removed)

        Output schema:
        {
            'success': bool,
            'song_metadata': { ... } | None,
            'lyrics': str | None,
            'audio_path': str,
            'error': str | None
        }
        """
        media_path = Path(media_path)
        if not media_path.exists():
            return {"success": False, "audio_path": None, "song_metadata": None, "lyrics": None, "error": "media not found"}

        temp_audio: Optional[Path] = None
        audio_path: Optional[Path] = None

        try:
            # Extract audio (either to provided path or temp file)
            audio_path = self.extract_audio(media_path, out_path=out_audio_path) if out_audio_path else self.extract_audio(media_path)
            temp_audio = audio_path if out_audio_path is None else None

            # Recognize tune
            tune = self.recognize_tune(audio_path)
            if tune is None:
                return {
                    "success": False,
                    "audio_path": str(audio_path),
                    "song_metadata": None,
                    "lyrics": None,
                    "error": "No tune recognized",
                }

            # Fetch lyrics (best-effort)
            lyrics = self.get_lyrics(tune.get("song_name", ""), tune.get("artist", ""))

            return {
                "success": True,
                "audio_path": str(audio_path),
                "song_metadata": tune,
                "lyrics": lyrics,
                "error": None,
            }
        except Exception as exc:
            logger.exception("Run failed")
            return {
                "success": False,
                "audio_path": str(audio_path) if audio_path else None,
                "song_metadata": None,
                "lyrics": None,
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