from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Assuming these imports are available in the VAA1 backend environment
from src.backend.analysis.quantitative_analysis import QuantitativeAnalysis, attach_quant_evidence_to_transcript
from src.backend.analysis.pos_analysis import POSAnalysis
from src.backend.analysis.language_utils import normalize_language_code

logger = logging.getLogger(__name__)


class StatsKitAgentError(Exception):
    """Custom exception for StatsKit Agent errors."""


class StatsKitAgent:
    """
    Backend agent for executing StatsKit runs, processing data, and generating results.
    """

    def __init__(self, analysis_id: str, results_dir: Path):
        self.analysis_id = analysis_id
        self.results_dir = results_dir
        self.stats_run_output_dir = self.results_dir / "stats_runs"
        self.stats_run_output_dir.mkdir(parents=True, exist_ok=True)

    def _load_artifact(self, artifact_path: Path) -> Optional[Dict[str, Any]]:
        if not artifact_path.exists():
            logger.warning("Artifact not found: %s", artifact_path)
            return None
        try:
            return json.loads(artifact_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            logger.error("Failed to decode JSON from %s: %s", artifact_path, e)
            return None

    def _load_first_existing_artifact(self, artifact_paths: List[Path]) -> Optional[Dict[str, Any]]:
        for artifact_path in artifact_paths:
            if artifact_path.exists():
                return self._load_artifact(artifact_path)
        logger.warning(
            "None of the StatsKit source artifacts were found: %s",
            [str(path) for path in artifact_paths],
        )
        return None

    def _get_source_data(self, input_scope: Dict[str, Any]) -> Dict[str, Any]:
        """
        Collects and filters source data (transcripts, objects, etc.) based on input_scope.
        For now, this is a simplified example focusing on transcript data.
        """
        source_data: Dict[str, Any] = {}

        output_root = self.results_dir.parent.parent if self.results_dir.parent.name == "api_results" else self.results_dir.parent

        # Load main transcript from both legacy analysis-local and current shared output locations.
        transcript = self._load_first_existing_artifact(
            [
                self.results_dir / "transcript" / f"{self.analysis_id}_transcript.json",
                self.results_dir / f"{self.analysis_id}_transcript.json",
                output_root / "transcripts" / f"{self.analysis_id}_transcript.json",
                Path("outputs") / "transcripts" / f"{self.analysis_id}_transcript.json",
            ]
        )
        if transcript:
            source_data["transcript"] = transcript
            source_data["transcript_segments"] = transcript.get("segments", [])
            source_data["language"] = normalize_language_code(transcript.get("language"))

        # Load audio diarization for VAD segments
        diarization = self._load_first_existing_artifact(
            [
                self.results_dir / "audio_diarization.json",
                self.results_dir / f"{self.analysis_id}_audio_diarization.json",
                output_root / "transcripts" / f"{self.analysis_id}_audio_diarization.json",
                output_root / "audio" / f"{self.analysis_id}_audio_diarization.json",
                Path("outputs") / "transcripts" / f"{self.analysis_id}_audio_diarization.json",
                Path("outputs") / "audio" / f"{self.analysis_id}_audio_diarization.json",
            ]
        )
        if diarization:
            source_data["diarization"] = diarization

        # Load source media metadata for total duration
        metadata = self._load_first_existing_artifact(
            [
                self.results_dir / "source_media_metadata.json",
                self.results_dir / f"{self.analysis_id}_source_media_metadata.json",
                output_root / "source_media" / f"{self.analysis_id}_source_media_metadata.json",
                Path("outputs") / "source_media" / f"{self.analysis_id}_source_media_metadata.json",
            ]
        )
        if metadata:
            source_data["metadata"] = metadata

        # TODO: Extend to load object detections, scene cards, etc., based on scope_type
        # For example, if scope_type is 'scene', load relevant scene cards and filter data.

        return source_data

    def _execute_method(
        self,
        method_config: Dict[str, Any],
        source_data: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Executes a specific statistical method and returns a list of StatsResult objects.
        """
        method_id = method_config["method_id"]
        method_name = method_config["method_name"]
        method_family = method_config["method_family"]
        output_type = method_config["output_type"]
        input_variables = method_config.get("input_variables", [])

        results: List[Dict[str, Any]] = []
        current_time_iso = datetime.now(timezone.utc).isoformat()

        if method_family == "linguistic" and method_name == "pos_analysis":
            text_to_analyze = " ".join([s.get("text", "") for s in source_data.get("transcript_segments", [])])
            if not text_to_analyze:
                logger.warning("No text found for POS analysis.")
                return []

            lang_code = source_data.get("language", "en")
            pos_analyzer = POSAnalysis(text_to_analyze, language_code=lang_code)
            pos_result = pos_analyzer.run()

            results.append({
                "result_id": f"result-{uuid.uuid4().hex}",
                "method_id": method_id,
                "result_label": "POS Analysis Summary",
                "result_type": "model_summary",
                "value": pos_result,
                "confidence": {"confidence_score": 0.8, "confidence_basis": "model"},
                "linked_evidence": [
                    {
                        "evidence_id": f"ev-{uuid.uuid4().hex}",
                        "video_id": self.analysis_id,
                        "scene_id": None,
                        "timestamp": {
                            "start_seconds": s.get("start", 0.0),
                            "end_seconds": s.get("end", 0.0),
                        },
                        "modality": "transcript",
                        "source_object_id": s.get("id"),
                    }
                    for s in source_data.get("transcript_segments", [])
                ],
                "interpretation_status": "raw",
                "analyst_notes": [f"Generated by {method_name} on {current_time_iso}"],
            })

        elif method_family == "descriptive" and method_name == "word_frequency":
            segments = source_data.get("transcript_segments", [])
            docs = [s.get("text", "") for s in segments]
            if not docs:
                logger.warning("No documents for word frequency analysis.")
                return []

            lang_code = source_data.get("language", "en")
            qa = QuantitativeAnalysis(docs=docs, language_code=lang_code)
            qa_results = qa.run(compute_tfidf=False, compute_bigrams=False)

            freq_dist = qa_results.get("token_info", {}).get("freq_dist", {})
            top_words = dict(freq_dist.most_common(50))

            # Generate evidence links for each of the top words
            linked_evidence_by_word = {}
            for word in top_words.keys():
                word_evidence = []
                for s in segments:
                    if word in s.get("text", "").lower().split():
                        word_evidence.append({
                            "evidence_id": f"ev-{uuid.uuid4().hex}",
                            "video_id": self.analysis_id,
                            "scene_id": None,
                            "timestamp": {"start_seconds": s.get("start", 0.0), "end_seconds": s.get("end", 0.0)},
                            "modality": "transcript",
                            "source_object_id": s.get("id"),
                            "highlight_text": word,
                        })
                linked_evidence_by_word[word] = word_evidence

            results.append({
                "result_id": f"result-{uuid.uuid4().hex}",
                "method_id": method_id,
                "result_label": "Word Frequency Distribution",
                "result_type": "distribution",
                "value": top_words,
                "linked_evidence_map": linked_evidence_by_word, # Attach the evidence map
                "confidence": {"confidence_score": 0.7, "confidence_basis": "model"},
                "linked_evidence": [], # TODO: Populate with EvidenceLink objects
                "interpretation_status": "raw",
                "analyst_notes": [f"Generated by {method_name} on {current_time_iso}"],
            })

        elif method_family == "temporal" and method_name == "event_rate_curve":
            transcript_segments = source_data.get("transcript_segments", [])
            if not transcript_segments:
                return []

            time_series_data = []
            linked_evidence_by_point = {}

            last_timestamp = 0
            if transcript_segments:
                last_timestamp = max(s.get("end", 0) for s in transcript_segments)

            for i in range(0, int(last_timestamp), 5):
                count = sum(1 for seg in transcript_segments if i <= seg['start'] < i + 5)
                time_series_data.append({"time": i, "value": count})

                point_evidence = []
                for seg in transcript_segments:
                    if i <= seg['start'] < i + 5:
                        point_evidence.append({
                            "evidence_id": f"ev-{uuid.uuid4().hex}",
                            "video_id": self.analysis_id,
                            "timestamp": {"start_seconds": seg.get("start", 0.0), "end_seconds": seg.get("end", 0.0)},
                            "modality": "transcript",
                            "source_object_id": seg.get("id"),
                        })
                linked_evidence_by_point[i] = point_evidence

            results.append({
                "result_id": f"result-{uuid.uuid4().hex}",
                "method_id": method_id,
                "result_label": "Utterance Rate Over Time",
                "result_type": "time_series",
                "value": time_series_data,
                "linked_evidence_map": linked_evidence_by_point,
                "confidence": {"confidence_score": 0.8, "confidence_basis": "model"},
                "linked_evidence": [],
                "interpretation_status": "raw",
                "analyst_notes": [f"Generated by {method_name} on {current_time_iso}"],
            })

        elif method_family == "correlation" and method_name == "correlation_heatmap":
            logger.warning("Correlation output withheld: aligned observed variables are not yet available.")
            return []

        elif method_family == "network" and method_name == "simple_network_metrics":
            logger.warning("Network output withheld: a governed observed graph is not yet available.")
            return []

        elif method_family == "audio" and method_name == "speech_ratio_analysis":
            diarization = source_data.get("diarization", {})
            vad_segments = diarization.get("vad_segments", [])
            metadata = source_data.get("metadata", {})
            total_duration = metadata.get("duration_seconds")

            if not vad_segments or not total_duration:
                logger.warning("VAD segments or total duration not available for speech ratio analysis.")
                return []

            speech_duration = sum(
                (seg.get("end", 0) - seg.get("start", 0)) for seg in vad_segments
            )
            speech_ratio = (speech_duration / total_duration) if total_duration > 0 else 0.0

            results.append({
                "result_id": f"result-{uuid.uuid4().hex}",
                "method_id": method_id,
                "result_label": "Speech Ratio",
                "result_type": "scalar",
                "value": round(speech_ratio, 4),
                "confidence": {"confidence_score": 0.85, "confidence_basis": "model"},
                "linked_evidence": [
                    {
                        "evidence_id": f"ev-{uuid.uuid4().hex}",
                        "video_id": self.analysis_id,
                        "scene_id": None,
                        "timestamp": {"start_seconds": s.get("start", 0.0), "end_seconds": s.get("end", 0.0)},
                        "modality": "audio",
                        "source_object_id": s.get("segment_id"),
                    }
                    for s in vad_segments
                ],
                "interpretation_status": "raw",
                "analyst_notes": [
                    f"Calculated from {len(vad_segments)} VAD segments over a total duration of {total_duration:.2f}s."
                ],
            })

        # TODO: Add more method implementations here, mapping to existing VAA1 analysis modules
        # e.g., for visual statistics, audio statistics, etc.

        return results

    def run_stats_analysis(self, stats_run_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Orchestrates a StatsRun based on the provided configuration.
        """
        run_id = stats_run_config.get("run_id", f"run-{uuid.uuid4().hex}")
        run_name = stats_run_config.get("run_name", "Untitled Stats Run")
        created_by = stats_run_config.get("created_by", "system_agent")
        input_scope = stats_run_config["input_scope"]
        selected_methods = stats_run_config.get("selected_methods", [])

        logger.info("Starting StatsRun '%s' (%s) for analysis %s", run_name, run_id, self.analysis_id)

        source_data = self._get_source_data(input_scope)
        generated_results: List[Dict[str, Any]] = []
        generated_interpretations: List[Dict[str, Any]] = []
        generated_visualizations: List[Dict[str, Any]] = []

        for method_config in selected_methods:
            try:
                method_results = self._execute_method(method_config, source_data)
                generated_results.extend(method_results)
                # TODO: Generate visualizations and interpretations based on method_results
            except Exception as e:
                logger.error("Error executing method %s for run %s: %s", method_config.get("method_name"), run_id, e)

        provenance_id = f"provenance-{uuid.uuid4().hex}"
        provenance = {
            "provenance_id": provenance_id,
            "pipeline_version": "VAA1_StatsKit_0.1.0",
            "model_versions": ["spacy_en_core_web_sm", "nltk_stopwords"], # Example models
            "manual_annotation_versions": [],
            "data_sources_used": ["transcript_segments"],
            "excluded_sources": [],
            "processing_log": [f"StatsRun executed on {datetime.now(timezone.utc).isoformat()}"],
            "known_limitations": [],
            "reproducibility_package": {
                "exportable": True,
                "includes_data_dictionary": True,
                "includes_method_config": True,
                "includes_visualization_config": False, # Not yet implemented
                "includes_evidence_links": True,
            },
        }

        final_stats_run_artifact = {
            "run_id": run_id,
            "run_name": run_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": created_by,
            "input_scope": input_scope,
            "selected_methods": selected_methods,
            "generated_results": generated_results,
            "generated_visualizations": generated_visualizations,
            "generated_interpretations": generated_interpretations,
            "provenance": provenance,
        }

        output_path = self.stats_run_output_dir / f"{run_id}.json"
        try:
            output_path.write_text(json.dumps(final_stats_run_artifact, indent=2, ensure_ascii=False), encoding="utf-8")
            logger.info("StatsRun artifact saved to %s", output_path)
        except Exception as e:
            logger.error("Failed to save StatsRun artifact to %s: %s", output_path, e)
            raise StatsKitAgentError(f"Failed to save StatsRun artifact: {e}")

        return final_stats_run_artifact


# Example usage (for testing/demonstration)
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Mock analysis_id and results_dir
    mock_analysis_id = "test_analysis_123"
    mock_results_dir = Path("./mock_analysis_results")
    mock_results_dir.mkdir(exist_ok=True)
    (mock_results_dir / "transcript").mkdir(exist_ok=True)

    # Create a dummy transcript file for testing
    dummy_transcript_data = {
        "segments": [
            {"start": 0.0, "end": 2.5, "text": "This is a test sentence for word frequency."},
            {"start": 3.0, "end": 5.0, "text": "Another test sentence to check POS analysis."},
            {"start": 5.5, "end": 7.0, "text": "The quick brown fox jumps over the lazy dog."},
        ],
        "language": "en"
    }
    (mock_results_dir / "transcript" / f"{mock_analysis_id}_transcript.json").write_text(
        json.dumps(dummy_transcript_data, indent=2)
    )

    agent = StatsKitAgent(mock_analysis_id, mock_results_dir)

    # Example StatsRun configuration
    example_stats_run_config = {
        "run_id": "my_first_stats_run",
        "run_name": "Transcript Linguistic Analysis",
        "created_by": "analyst_user",
        "input_scope": {
            "scope_type": "video",
            "video_ids": [mock_analysis_id],
            "time_window": {"start_seconds": 0, "end_seconds": 1000}
        },
        "selected_methods": [
            {
                "method_id": "method-pos-001",
                "method_family": "linguistic",
                "method_name": "pos_analysis",
                "output_type": "model_summary",
                "input_variables": []
            },
            {
                "method_id": "method-freq-001",
                "method_family": "descriptive",
                "method_name": "word_frequency",
                "output_type": "distribution",
                "input_variables": []
            }
        ]
    }

    try:
        result_artifact = agent.run_stats_analysis(example_stats_run_config)
        print("\nStatsRun completed successfully. Result artifact:")
        print(json.dumps(result_artifact, indent=2))
    except StatsKitAgentError as e:
        print(f"StatsRun failed: {e}")
    finally:
        # Clean up mock results
        shutil.rmtree(mock_results_dir)
