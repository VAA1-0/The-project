#!/usr/bin/env python
"""
Object-oriented Meta MMS ASR (language interpretation)integration for VAA1.

Class:
    MMSASRTranscriber
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional, Union

import logging

from transformers import pipeline, Pipeline

DEFAULT_MMS_MODEL_ID = "facebook/mms-1b-l1107"

logger = logging.getLogger(__name__)


class MMSASRTranscriber:
    """
    Wrapper around Meta's MMS ASR models for multilingual transcription.

    Typical usage:
        transcriber = MMSASRTranscriber(target_lang="fin")
        text = transcriber.transcribe("audio.wav")
    """

    def __init__(
        self,
        target_lang: str = "eng",
        model_id: str = DEFAULT_MMS_MODEL_ID,
        chunk_length_s: float = 30.0,
        device: Optional[int] = None,
    ) -> None:
        """
        Parameters
        ----------
        target_lang : str
            ISO 639-3 language code, e.g. "eng", "fin", "fra".
        model_id : str
            Hugging Face model ID, e.g. "facebook/mms-1b-l1107".
        chunk_length_s : float
            Maximum chunk length (seconds) for long audio.
        device : Optional[int]
            Device to load the pipeline on. Use None to auto-detect CUDA (0) or CPU (-1).
            Use -1 explicitly for CPU or 0,1,... for CUDA device ids.
        """
        if not isinstance(target_lang, str) or len(target_lang.strip()) == 0:
            raise ValueError("target_lang must be a non-empty ISO 639-3 string")
        self.target_lang = target_lang.strip()

        if float(chunk_length_s) <= 0:
            raise ValueError("chunk_length_s must be > 0")
        self.chunk_length_s = float(chunk_length_s)

        self.model_id = model_id

        self._pipe: Optional[Pipeline] = None  # lazy-loaded
        self._device = device

    @staticmethod
    def _auto_detect_device() -> int:
        """Return device id for transformers.pipeline: 0..N for cuda devices, -1 for CPU."""
        try:
            import torch

            return 0 if torch.cuda.is_available() else -1
        except Exception:
            # If torch is not installed or import fails, fall back to CPU
            return -1

    @property
    def device(self) -> int:
        """Device used by the pipeline: -1 for CPU, >=0 for CUDA device id."""
        if self._device is None:
            self._device = self._auto_detect_device()
        return self._device  # type: ignore[return-value]

    @property
    def pipe(self) -> Pipeline:
        """Lazy-loaded ASR pipeline."""
        if self._pipe is None:
            logger.info("Loading ASR pipeline (model=%s, lang=%s, device=%s)", self.model_id, self.target_lang, self.device)
            # Pass device to pipeline: -1 for CPU, >=0 for CUDA device index
            try:
                self._pipe = pipeline(
                    task="automatic-speech-recognition",
                    model=self.model_id,
                    device=self.device,
                    # keep model_kwargs for backwards compatibility; some models accept generation args here
                    model_kwargs={
                        "target_lang": self.target_lang,
                        "ignore_mismatched_sizes": True,
                    },
                )
            except Exception as exc:
                logger.exception("Failed to instantiate transformers pipeline")
                raise RuntimeError(f"Could not create ASR pipeline for model {self.model_id}: {exc}") from exc

            # Try to load language-specific adapter if the model supports it.
            # Not all models expose load_adapter; wrap in try/except to avoid breaking.
            try:
                model_obj = getattr(self._pipe, "model", None)
                if model_obj is not None and hasattr(model_obj, "load_adapter"):
                    try:
                        model_obj.load_adapter(self.target_lang)
                        logger.debug("Loaded adapter for language: %s", self.target_lang)
                    except Exception as exc:
                        # Non-fatal: some adapters may not exist or require different args
                        logger.debug("Could not load adapter '%s' for model: %s", self.target_lang, exc)
            except Exception:
                # Be defensive; adapter loading must not break pipeline creation.
                logger.debug("Adapter loading skipped due to unexpected error", exc_info=True)

        return self._pipe  # type: ignore[return-value]

    def transcribe(self, audio_path: Union[str, Path]) -> str:
        """
        Transcribe an audio file into text.

        Parameters
        ----------
        audio_path : str or Path
            Path to an audio file (prefer 16 kHz mono .wav).

        Returns
        -------
        str
            Transcribed text.
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Use the pipeline to transcribe. chunk_length_s is supported by HF ASR pipelines.
        try:
            result = self.pipe(
                str(audio_path),
                chunk_length_s=self.chunk_length_s,
                # MMS is a CTC pipeline. Transformers requires an explicit
                # character- or word-level timestamp mode; False is rejected.
                return_timestamps="word",
            )
        except Exception as exc:
            logger.exception("Transcription failed for %s", audio_path)
            raise RuntimeError(f"Transcription failed: {exc}") from exc

        # Result can be a dict or list of dicts
        if isinstance(result, list):
            text = " ".join((chunk.get("text") or "") for chunk in result)
        elif isinstance(result, dict):
            text = result.get("text", "")
        else:
            # Unexpected result type: best-effort string conversion
            text = str(result)

        return text.strip()

    def transcribe_to_file(self, audio_path: Union[str, Path], output_path: Union[str, Path]) -> Path:
        """
        Transcribe audio and save the text to a file.

        Parameters
        ----------
        audio_path : str or Path
            Path to audio file.
        output_path : str or Path
            Path to output text file.

        Returns
        -------
        Path
            Path to the written file.
        """
        transcript = self.transcribe(audio_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(transcript, encoding="utf-8")
        return output_path

    def close(self) -> None:
        """
        Attempt to free model resources. After calling this the pipeline will be re-created on next use.
        """
        if self._pipe is None:
            return
        try:
            # Some pipeline models have a 'cpu' method or can be deleted
            model_obj = getattr(self._pipe, "model", None)
            if model_obj is not None and hasattr(model_obj, "cpu"):
                try:
                    model_obj.cpu()
                except Exception:
                    pass
        finally:
            # Drop references and let GC/freeing do its job
            self._pipe = None


# Optional small CLI entrypoint
if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(
        description="Meta MMS ASR (OO wrapper) – transcribe audio to text."
    )
    parser.add_argument("audio_path", help="Path to audio file.")
    parser.add_argument(
        "--lang",
        type=str,
        default="eng",
        help="ISO 639-3 language code (default: eng).",
    )
    parser.add_argument(
        "--model-id",
        type=str,
        default=DEFAULT_MMS_MODEL_ID,
        help=f"Hugging Face model id (default: {DEFAULT_MMS_MODEL_ID}).",
    )
    parser.add_argument(
        "--chunk-length",
        type=float,
        default=30.0,
        help="Chunk length in seconds for long audio (default: 30.0).",
    )
    parser.add_argument(
        "--device",
        type=int,
        default=None,
        help="Device id to run on. Use -1 for CPU, 0..N for CUDA GPU. Default auto-detects CUDA if available.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Optional path to save transcript as .txt.",
    )

    args = parser.parse_args()

    try:
        transcriber = MMSASRTranscriber(
            target_lang=args.lang,
            model_id=args.model_id,
            chunk_length_s=args.chunk_length,
            device=args.device,
        )

        text = transcriber.transcribe(args.audio_path)
        print(text)

        if args.output:
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(text, encoding="utf-8")
            print(f"\nTranscript saved to {out_path}")
    except Exception as exc:
        logger.exception("Fatal error during transcription")
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(2)
