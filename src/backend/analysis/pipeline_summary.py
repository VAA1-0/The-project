"""
Text Summarization Pipeline
---------------------------
Takes transcript text as input and generates:
 - Concise summary (bullet or paragraph)
 - Key points or highlights
Uses transformer-based summarization model or GPT-compatible endpoint.
"""

import os
import json
from datetime import datetime
from pathlib import Path
from transformers import pipeline
from src.backend.analysis.utils.logger import get_logger

logger = get_logger(__name__)


class SummarizationPipeline:
    def __init__(self, transcript_data: dict, model_name: str = "facebook/bart-large-cnn"):
        """
        Args:
            transcript_data (dict): Structured transcript (as produced by pipeline_audio_text).
            model_name (str): Hugging Face model for summarization.
        """
        self.transcript_data = transcript_data
        self.model_name = model_name
        self.output_dir = Path("outputs/summaries")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def run(self) -> dict:
        """Generate summary and key points."""
        logger.info(f"Initializing summarization model: {self.model_name}")
        summarizer = pipeline("summarization", model=self.model_name)

        # Combine transcript text (truncate for model limits)
        full_text = " ".join([seg["text"] for seg in self.transcript_data["segments"]])
        full_text = full_text.strip().replace("\n", " ")
        if len(full_text.split()) < 50:
            logger.warning("Transcript too short for summarization. Returning original text.")
            summary_text = full_text
        else:
            # Split into manageable chunks for summarization (max tokens per request)
            max_chunk = 1500
            sentences = full_text.split(". ")
            chunks, current_chunk = [], ""

            for sentence in sentences:
                if len(current_chunk.split()) + len(sentence.split()) < max_chunk:
                    current_chunk += sentence + ". "
                else:
                    chunks.append(current_chunk.strip())
                    current_chunk = sentence + ". "
            chunks.append(current_chunk.strip())

            logger.info(f"Summarizing {len(chunks)} text chunks...")
            partial_summaries = []
            for chunk in chunks:
                try:
                    summary = summarizer(chunk, max_length=200, min_length=50, do_sample=False)
                    partial_summaries.append(summary[0]["summary_text"].strip())
                except Exception as e:
                    logger.error(f"Summarization failed on chunk: {e}")
                    partial_summaries.append("")

            summary_text = " ".join(partial_summaries)

        summary_data = {
            "summary": summary_text.strip(),
            "model": self.model_name,
            "created_at": datetime.utcnow().isoformat(),
            "num_segments": len(self.transcript_data.get("segments", [])),
        }

        output_path = self.output_dir / f"summary_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary_data, f, indent=2, ensure_ascii=False)

        logger.info(f"Summary saved: {output_path}")
        return summary_data
