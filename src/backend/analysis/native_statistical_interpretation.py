"""Governed statistical interpretation over already measured source observations.

This module deliberately separates descriptive statistics, standardized deviation,
effect magnitude, salience, statistical significance, and interpretation.  Salience
is a transparent review-priority index; it is never reported as a p-value or as proof
of a causal or theoretically meaningful event.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import statistics
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable

from .evidence_quality import assess_evidence_quality
from .interpretation_registry import InterpretationRegistry


SCHEMA = "vaa1.native_statistical_interpretation.v1"
METHOD_VERSION = "cross_signal_salience.1.0.0"


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _stable_id(prefix: str, value: Any) -> str:
    return f"{prefix}-{hashlib.sha256(_canonical(value)).hexdigest()[:20]}"


def _atomic_json(path: Path, value: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _finite_number(value: Any, field: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be numeric") from exc
    if not math.isfinite(number):
        raise ValueError(f"{field} must be finite")
    return number


def _interval(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("source_interval must be an object")
    start = _finite_number(value.get("start_seconds"), "source_interval.start_seconds")
    end = _finite_number(value.get("end_seconds"), "source_interval.end_seconds")
    if start < 0 or end <= start:
        raise ValueError("source_interval requires 0 <= start_seconds < end_seconds")
    return {
        "source_media_id": str(value.get("source_media_id") or "").strip(),
        "clock_id": str(value.get("clock_id") or "source_media.clock"),
        "start_seconds": start,
        "end_seconds": end,
        "timing_status": str(value.get("timing_status") or "measured"),
    }


def _median_absolute_deviation(values: Iterable[float], median: float) -> float:
    return statistics.median(abs(value - median) for value in values)


def _ranks(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=values.__getitem__)
    ranks = [0.0] * len(values)
    index = 0
    while index < len(order):
        end = index + 1
        while end < len(order) and values[order[end]] == values[order[index]]:
            end += 1
        average_rank = (index + 1 + end) / 2
        for position in range(index, end):
            ranks[order[position]] = average_rank
        index = end
    return ranks


def _spearman(left: list[float], right: list[float]) -> float | None:
    if len(left) != len(right) or len(left) < 4 or len(set(left)) < 2 or len(set(right)) < 2:
        return None
    a, b = _ranks(left), _ranks(right)
    mean_a, mean_b = statistics.fmean(a), statistics.fmean(b)
    numerator = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b))
    denominator = math.sqrt(sum((x - mean_a) ** 2 for x in a) * sum((y - mean_b) ** 2 for y in b))
    return numerator / denominator if denominator else None


def _substantive_relationship_reading(left: str, right: str, rho: float) -> str:
    amount = "more" if rho > 0 else "less"
    level = "higher" if rho > 0 else "lower"
    pace = "faster" if rho > 0 else "slower"
    emphasis = "stronger" if rho > 0 else "weaker"
    readings = {
        ("expression_label_diversity", "transcript_word_rate"): f"Scenes with a wider range of detected expression labels tend to have {level} spoken-word density. Visible expressive variety and verbal density are distributed differently across this video's scenes.",
        ("expression_label_diversity", "negation_token_ratio"): f"Scenes with a wider range of detected expression labels tend to contain {amount} explicit verbal negation. Visible expression variety and verbal denial do not peak in the same scenes.",
        ("expression_label_diversity", "question_utterance_ratio"): f"Scenes with a wider range of detected expression labels tend to contain {amount} questioning language. This connects visible expressive variety with how often dialogue asks rather than states.",
        ("expression_label_diversity", "mean_speech_rate"): f"Scenes with a wider range of detected expression labels tend to use {pace} vocal delivery. Visible expressive variety and speaking pace move together across scenes.",
        ("expression_label_diversity", "mean_vocal_emphasis"): f"Scenes with a wider range of detected expression labels tend to carry {emphasis} vocal emphasis. Visible expressive variety and prosodic stress move together across scenes.",
        ("sfl_modality_ratio", "mean_vocal_emphasis"): f"Scenes containing more modal language—possibility, obligation, permission, or inclination—tend to carry {emphasis} vocal emphasis. Stance marking and prosodic stress move together across scenes.",
        ("sfl_proposal_ratio", "mean_speech_rate"): f"Scenes containing more proposals, commands, or offers tend to use {pace} vocal delivery. Directive language and speaking pace move together across scenes.",
        ("prop_occurrence_rate", "sfl_material_process_ratio"): f"Scenes with more visible non-person objects tend to contain {amount} action- and event-oriented clauses. Material setting and language about doing or happening move together across scenes.",
        ("prop_label_diversity", "sfl_proposal_ratio"): f"Scenes with a wider variety of visible prop labels tend to contain {amount} proposals, commands, or offers. Material variety and directive language move together across scenes.",
        ("transcript_word_rate", "mean_vocal_emphasis"): f"Scenes with denser spoken wording tend to carry {emphasis} vocal emphasis. Verbal density and prosodic stress move together across scenes.",
    }
    return readings.get((left, right), f"Across scenes, higher {left.replace('_', ' ')} tends to accompany {level} {right.replace('_', ' ')}.")


def normalize_observation(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize one observation without claiming inferential significance."""
    metric_id = str(raw.get("metric_id") or "").strip()
    metric_label = str(raw.get("metric_label") or metric_id).strip()
    signal_family = str(raw.get("signal_family") or "").strip()
    analytical_unit = str(raw.get("analytical_unit") or "").strip()
    unit = str(raw.get("unit") or "").strip()
    evidence_refs = [str(item) for item in raw.get("evidence_refs", []) if item]
    population = raw.get("population")
    baseline_values = [_finite_number(item, "baseline_values[]") for item in raw.get("baseline_values", [])]
    observed = _finite_number(raw.get("observed_value"), "observed_value")
    if not metric_id or not signal_family or not analytical_unit or not unit:
        raise ValueError("metric_id, signal_family, analytical_unit, and unit are required")
    if not isinstance(population, dict) or int(population.get("included_count") or 0) < 1:
        raise ValueError("population.included_count must be at least one")
    if not evidence_refs:
        raise ValueError("Every observation requires evidence_refs")
    if len(baseline_values) < 3:
        raise ValueError("At least three baseline observations are required for robust standardization")

    baseline_median = statistics.median(baseline_values)
    mad = _median_absolute_deviation(baseline_values, baseline_median)
    robust_z = None if mad == 0 else 0.6744897501960817 * (observed - baseline_median) / mad
    direction = "above" if observed > baseline_median else "below" if observed < baseline_median else "equal"
    return {
        "observation_id": _stable_id("observation", raw),
        "metric_id": metric_id,
        "metric_label": metric_label,
        "signal_family": signal_family,
        "analytical_unit": analytical_unit,
        "source_interval": _interval(raw.get("source_interval")),
        "observed_value": observed,
        "unit": unit,
        "population": population,
        "baseline": {
            "definition": str(raw.get("baseline_definition") or "").strip(),
            "sample_size": len(baseline_values),
            "median": baseline_median,
            "median_absolute_deviation": mad,
        },
        "standardized_deviation": {
            "method": "median_mad_robust_z",
            "value": robust_z,
            "available": robust_z is not None,
            "direction": direction,
            "reason_unavailable": "Baseline MAD is zero." if robust_z is None else None,
        },
        "evidence_refs": evidence_refs,
        "limitations": [str(item) for item in raw.get("limitations", []) if item],
        "statistical_terms": {
            "observed_value": "A descriptive statistic for the declared analytical unit and population.",
            "baseline_median": "The median of the declared comparison observations.",
            "robust_z_score": "A standardized descriptive deviation based on the median and MAD; not a p-value.",
        },
    }


class NativeStatisticalInterpretationService:
    """Create reviewable salience findings and candidate registry projections."""

    def __init__(self, analysis_id: str, analysis_dir: str | Path, registry: InterpretationRegistry):
        self.analysis_id = analysis_id
        self.analysis_dir = Path(analysis_dir)
        self.registry = registry

    @staticmethod
    def _rows(value: Any, *keys: str) -> list[Dict[str, Any]]:
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if not isinstance(value, dict):
            return []
        for key in keys:
            candidate = value.get(key)
            if isinstance(candidate, list):
                return [item for item in candidate if isinstance(item, dict)]
        return []

    @staticmethod
    def _overlap(start: float, end: float, item_start: float, item_end: float) -> float:
        return max(0.0, min(end, item_end) - max(start, item_start))

    @staticmethod
    def _time(row: Dict[str, Any]) -> float | None:
        for key in ("timestamp", "time", "start_seconds", "start", "source_timestamp"):
            try:
                value = float(row.get(key))
            except (TypeError, ValueError):
                continue
            if value >= 0:
                return value
        interval = row.get("interval")
        return NativeStatisticalInterpretationService._time(interval) if isinstance(interval, dict) else None

    @staticmethod
    def _extent(row: Dict[str, Any]) -> tuple[float, float] | None:
        interval = row.get("interval") if isinstance(row.get("interval"), dict) else row
        try:
            start = float(interval.get("start_seconds", interval.get("start")))
            end = float(interval.get("end_seconds", interval.get("end")))
        except (TypeError, ValueError):
            return None
        return (start, end) if start >= 0 and end > start else None

    @staticmethod
    def _number(row: Dict[str, Any], *paths: str) -> float | None:
        for path in paths:
            value: Any = row
            for key in path.split("."):
                value = value.get(key) if isinstance(value, dict) else None
            try:
                result = float(value)
            except (TypeError, ValueError):
                continue
            if math.isfinite(result):
                return result
        return None

    def _load_artifact(self, status: Dict[str, Any], key: str, filename: str) -> Any:
        direct = status.get(key)
        if direct is not None:
            return direct
        summary = status.get("summary") if isinstance(status.get("summary"), dict) else {}
        if summary.get(key) is not None:
            return summary[key]
        visual = ((status.get("results") or {}).get("visual_analysis") or {}) if isinstance(status.get("results"), dict) else {}
        if visual.get(key) is not None:
            return visual[key]
        registered = (status.get("output_files") or {}).get(key) if isinstance(status.get("output_files"), dict) else None
        paths = [Path(str(registered))] if registered else []
        paths.append(self.analysis_dir / filename)
        for path in paths:
            if path.exists():
                try:
                    return json.loads(path.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    continue
        return {}

    def run_from_status(self, status: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        """Discover the strongest eligible scene-level concurrence from persisted data."""
        master = status.get("vaa1_annotation_master_schema") if isinstance(status.get("vaa1_annotation_master_schema"), dict) else {}
        summary = status.get("summary") if isinstance(status.get("summary"), dict) else {}
        scene_payload = summary.get("scene_segments") if isinstance(summary.get("scene_segments"), dict) else {}
        scenes = self._rows(scene_payload, "segments")
        if not scenes:
            scenes = [item for item in self._rows(master, "temporal_segments") if str(item.get("segment_type") or "").lower() == "scene"]
        scene_extents = [(row, extent) for row in scenes if (extent := self._extent(row))]
        if len(scene_extents) < 4:
            raise ValueError("Automatic statistical interpretation requires at least four governed scene intervals")

        tone = self._load_artifact(status, "spatial_tone_scan", "spatial_tone_scan.json")
        adaptive = self._load_artifact(status, "adaptive_visual_scan", "adaptive_visual_scan.json")
        audio_events = self._load_artifact(status, "audio_event_intervals", "audio_event_intervals.json")
        diarization = self._load_artifact(status, "audio_diarization", "audio_diarization.json")
        prosody = self._load_artifact(status, "audio_prosody", "audio_prosody.json")
        transcript = self._load_artifact(status, "transcript", "transcript.json")
        expressions = self._load_artifact(status, "expression_json", "expressions.json")
        objects = self._load_artifact(status, "tracked_objects_json", "tracked_objects.json")
        sfl = self._load_artifact(status, "dependency_sfl_stage1", "dependency_sfl_stage1.json")
        tone_rows = self._rows(tone, "samples", "windows")
        adaptive_rows = self._rows(adaptive, "samples", "windows")
        event_rows = self._rows(audio_events, "intervals", "events")
        turn_rows = self._rows(diarization, "speaker_turns", "turns", "vad_segments")
        prosody_rows = self._rows(prosody, "cues", "items", "segments")
        transcript_rows = self._rows(transcript, "segments", "items", "utterances")
        expression_rows = self._rows(expressions, "items", "samples", "frames")
        object_rows = self._rows(objects, "tracked_objects", "items", "objects", "detections")
        sfl_rows = self._rows(sfl, "utterances", "items")

        scene_metrics: list[Dict[str, Any]] = []
        for index, (scene, (start, end)) in enumerate(scene_extents):
            duration = end - start
            metrics: Dict[str, tuple[str, float, str, list[str]]] = {}
            within_tone = [row for row in tone_rows if (time := self._time(row)) is not None and start <= time < end]
            for metric, paths in {
                "mean_brightness": ("brightness", "zones.whole_frame.brightness"),
                "mean_contrast": ("contrast", "zones.whole_frame.contrast"),
                "mean_saturation": ("saturation", "zones.whole_frame.saturation"),
            }.items():
                values = [value for row in within_tone if (value := self._number(row, *paths)) is not None]
                if values:
                    metrics[metric] = ("visual_tone", statistics.fmean(values), "index", ["artifact:spatial_tone_scan"])
            within_motion = [row for row in adaptive_rows if (time := self._time(row)) is not None and start <= time < end]
            motion_values = [value for row in within_motion if (value := self._number(row, "changed_fraction", "frame_delta", "motion_score")) is not None]
            if motion_values:
                metrics["mean_visual_change"] = ("visual_motion", statistics.fmean(motion_values), "ratio", ["artifact:adaptive_visual_scan"])
            speech_duration = sum(self._overlap(start, end, *extent) for row in turn_rows if (extent := self._extent(row)))
            if turn_rows:
                metrics["speech_coverage_ratio"] = ("speech", min(1.0, speech_duration / duration), "ratio", ["artifact:audio_diarization"])
            for event_class in ("music", "noise", "silence"):
                matching = [row for row in event_rows if event_class in str(row.get("class_name") or row.get("label") or row.get("event_type") or "").lower()]
                if matching:
                    covered = sum(self._overlap(start, end, *extent) for row in matching if (extent := self._extent(row)))
                    metrics[f"{event_class}_coverage_ratio"] = ("audio_event", min(1.0, covered / duration), "ratio", ["artifact:audio_event_intervals"])
            within_prosody = [row for row in prosody_rows if (extent := self._extent(row)) and self._overlap(start, end, *extent) > 0]
            pace = [value for row in within_prosody if (value := self._number(row, "pace.words_per_second", "words_per_second", "speech_rate")) is not None]
            if pace:
                metrics["mean_speech_rate"] = ("prosody", statistics.fmean(pace), "words_per_second", ["artifact:audio_prosody"])
            emphasis = [value for row in within_prosody if (value := self._number(row, "emphasis.score", "emphasis_score")) is not None]
            if emphasis:
                metrics["mean_vocal_emphasis"] = ("prosody", statistics.fmean(emphasis), "index", ["artifact:audio_prosody"])

            scene_transcript = [row for row in transcript_rows if (extent := self._extent(row)) and self._overlap(start, end, *extent) > 0]
            words = [word for row in scene_transcript for word in str(row.get("text") or "").lower().split()]
            if scene_transcript:
                metrics["transcript_word_rate"] = ("transcript", len(words) / duration, "words_per_second", ["artifact:transcript"])
                metrics["question_utterance_ratio"] = ("transcript", sum("?" in str(row.get("text") or "") for row in scene_transcript) / len(scene_transcript), "ratio", ["artifact:transcript"])
                negations = sum(word.strip(".,!?;:") in {"no", "not", "never", "none", "without", "cannot", "can't", "won't", "isn't", "don't"} for word in words)
                metrics["negation_token_ratio"] = ("transcript", negations / max(1, len(words)), "ratio", ["artifact:transcript"])

            scene_sfl = []
            for row in sfl_rows:
                interval = row.get("time_interval") if isinstance(row.get("time_interval"), dict) else {}
                try:
                    extent = (float(interval.get("start_ms")) / 1000, float(interval.get("end_ms")) / 1000)
                except (TypeError, ValueError):
                    extent = self._extent(row)
                if extent and self._overlap(start, end, *extent) > 0:
                    scene_sfl.append(row)
            if scene_sfl:
                process_types = [str(((row.get("sfl_lite") or {}).get("ideational") or {}).get("process_type") or "").lower() for row in scene_sfl]
                interpersonal = [((row.get("sfl_lite") or {}).get("interpersonal") or {}) for row in scene_sfl]
                statistical_features = [((row.get("sfl_lite") or {}).get("statistical_features") or {}) for row in scene_sfl]
                feature_mean = lambda key, fallback: statistics.fmean([
                    float(features[key]) if key in features else float(fallback(index))
                    for index, features in enumerate(statistical_features)
                ])
                metrics["sfl_material_process_ratio"] = ("sfl", feature_mean("material_process_indicator", lambda index: process_types[index] == "material"), "ratio", ["artifact:dependency_sfl_stage1"])
                metrics["sfl_verbal_process_ratio"] = ("sfl", feature_mean("verbal_process_indicator", lambda index: process_types[index] == "verbal"), "ratio", ["artifact:dependency_sfl_stage1"])
                metrics["sfl_modality_ratio"] = ("sfl", feature_mean("modality_indicator", lambda index: bool(interpersonal[index].get("modality"))), "ratio", ["artifact:dependency_sfl_stage1"])
                metrics["sfl_proposal_ratio"] = ("sfl", feature_mean("proposal_indicator", lambda index: str(interpersonal[index].get("speech_function") or "").lower() in {"proposal", "proposal_candidate", "directive_candidate", "command", "offer"}), "ratio", ["artifact:dependency_sfl_stage1"])

            scene_expressions = [row for row in expression_rows if (time := self._time(row)) is not None and start <= time < end and bool((row.get("expression_evidence") or {}).get("dominant_emotion_ready"))]
            if scene_expressions:
                activations = []
                for row in scene_expressions:
                    affect_hints = row.get("affect_hints") or {}
                    activation_score = affect_hints.get("activation_score")
                    if isinstance(activation_score, (int, float)):
                        activations.append(float(activation_score))
                        continue
                    activation = str(affect_hints.get("activation") or "").lower()
                    measured_activation = {
                        "high": 1.0,
                        "higher_activation": 1.0,
                        "medium": 0.5,
                        "mixed_or_uncertain": 0.5,
                        "low": 0.0,
                        "lower_activation": 0.0,
                    }.get(activation)
                    if measured_activation is not None:
                        activations.append(measured_activation)
                labels = {str(row.get("dominant_emotion") or "").lower() for row in scene_expressions if row.get("dominant_emotion")}
                if activations:
                    metrics["expression_activation_index"] = ("expression", statistics.fmean(activations), "index", ["artifact:expressions"])
                metrics["expression_label_diversity"] = ("expression", len(labels) / len(scene_expressions), "ratio", ["artifact:expressions"])

            scene_objects = []
            for row in object_rows:
                time = self._time(row)
                if time is None or not start <= time < end:
                    continue
                label = str(row.get("class_name") or row.get("label") or row.get("custom_label") or "").strip().lower()
                if label and label not in {"person", "face", "character", "unknown"}:
                    scene_objects.append(label)
            if object_rows:
                metrics["prop_occurrence_rate"] = ("props", len(scene_objects) / duration, "occurrences_per_second", ["artifact:tracked_objects"])
                metrics["prop_label_diversity"] = ("props", len(set(scene_objects)), "unique_labels", ["artifact:tracked_objects"])
            scene_metrics.append({"index": index, "scene": scene, "start": start, "end": end, "metrics": metrics})

        metric_populations: Dict[str, list[float]] = {}
        for item in scene_metrics:
            for metric, (_, value, _, _) in item["metrics"].items():
                metric_populations.setdefault(metric, []).append(value)
        candidates = []
        source_media_id = str(status.get("source_media_id") or status.get("analysis_id") or self.analysis_id)
        for item in scene_metrics:
            observations = []
            for metric, (family, value, unit, refs) in item["metrics"].items():
                baseline = [other["metrics"][metric][1] for other in scene_metrics if other is not item and metric in other["metrics"]]
                if len(baseline) < 3 or _median_absolute_deviation(baseline, statistics.median(baseline)) == 0:
                    continue
                observations.append({
                    "metric_id": metric,
                    "metric_label": metric.replace("_", " "),
                    "signal_family": family,
                    "analytical_unit": "scene",
                    "observed_value": value,
                    "unit": unit,
                    "baseline_values": baseline,
                    "baseline_definition": "other governed scenes in the same analysis",
                    "population": {"included_count": len(metric_populations[metric]), "excluded_count": 0, "denominator": "governed scenes with this measured statistic"},
                    "source_interval": {"source_media_id": source_media_id, "clock_id": "source_media.clock", "start_seconds": item["start"], "end_seconds": item["end"], "timing_status": "governed_scene_interval"},
                    "evidence_refs": refs,
                    "limitations": ["The baseline is internal to this analysis and does not represent a reference population."],
                })
            families = {row["signal_family"] for row in observations}
            if len(observations) >= 2 and len(families) >= 2:
                normalized = [normalize_observation(row) for row in observations]
                score = statistics.fmean(min(abs(row["standardized_deviation"]["value"]), 5.0) for row in normalized)
                candidates.append((score, item, observations))
        if not candidates:
            raise ValueError("No scene has two eligible measured signal families with variable baselines")
        _, selected, observations = max(candidates, key=lambda item: item[0])
        result = self.run({
            "observations": observations,
            "subject_ref": {"type": "scene", "id": str(selected["scene"].get("scene_id") or selected["scene"].get("segment_id") or f"scene-{selected['index'] + 1}")},
        }, persist=persist)
        result["selection"] = {
            "method": "highest_mean_absolute_robust_z_across_eligible_scenes",
            "eligible_scene_count": len(candidates),
            "selected_scene_index": selected["index"],
            "selected_scene_ref": result["proposition"].get("subject_ref"),
        }
        coupling_specs = [
            ("expression_activation_index", "mean_vocal_emphasis", "expression_prosody"),
            ("expression_activation_index", "mean_speech_rate", "expression_prosody"),
            ("expression_activation_index", "negation_token_ratio", "expression_transcript"),
            ("expression_activation_index", "question_utterance_ratio", "expression_transcript"),
            ("expression_activation_index", "transcript_word_rate", "expression_transcript"),
            ("expression_label_diversity", "mean_vocal_emphasis", "expression_prosody"),
            ("expression_label_diversity", "mean_speech_rate", "expression_prosody"),
            ("expression_label_diversity", "negation_token_ratio", "expression_transcript"),
            ("expression_label_diversity", "question_utterance_ratio", "expression_transcript"),
            ("expression_label_diversity", "transcript_word_rate", "expression_transcript"),
            ("sfl_modality_ratio", "mean_vocal_emphasis", "sfl_prosody"),
            ("sfl_proposal_ratio", "mean_speech_rate", "sfl_prosody"),
            ("prop_occurrence_rate", "sfl_material_process_ratio", "props_sfl"),
            ("prop_label_diversity", "sfl_proposal_ratio", "props_sfl"),
            ("transcript_word_rate", "mean_vocal_emphasis", "transcript_prosody"),
        ]
        relationships = []
        relationship_diagnostics = []
        for left_key, right_key, coupling in coupling_specs:
            paired = [item for item in scene_metrics if left_key in item["metrics"] and right_key in item["metrics"]]
            left_values = [item["metrics"][left_key][1] for item in paired]
            right_values = [item["metrics"][right_key][1] for item in paired]
            rho = _spearman(left_values, right_values)
            if rho is None:
                left_unique = len(set(left_values))
                right_unique = len(set(right_values))
                constant = len(paired) >= 2 and (left_unique < 2 or right_unique < 2)
                relationship_diagnostics.append({
                    "coupling": coupling,
                    "left_metric": left_key,
                    "right_metric": right_key,
                    "status": "constant_pattern" if constant else "insufficient_data",
                    "paired_scene_count": len(paired),
                    "left_unique_value_count": left_unique,
                    "right_unique_value_count": right_unique,
                    "left_constant_value": left_values[0] if left_unique == 1 else None,
                    "right_constant_value": right_values[0] if right_unique == 1 else None,
                    "reason": "fewer than two paired governed scenes" if len(paired) < 2 else "a rank association is not estimable because one or both attributes are constant across the paired scenes",
                })
                continue
            orientation_frames = {
                "expression_prosody": ["intrinsic"],
                "expression_transcript": ["intrinsic", "social"],
                "sfl_prosody": ["intrinsic", "social"],
                "props_sfl": ["social"],
                "transcript_prosody": ["intrinsic", "social"],
            }.get(coupling, ["intrinsic"])
            evidence_frames = {
                "expression_prosody": ["implicit"],
                "expression_transcript": ["implicit", "explicit"],
                "sfl_prosody": ["explicit", "implicit"],
                "props_sfl": ["explicit"],
                "transcript_prosody": ["explicit", "implicit"],
            }.get(coupling, ["implicit"])
            relationships.append({
                "relationship_id": _stable_id("relationship", [self.analysis_id, left_key, right_key, rho]),
                "coupling": coupling,
                "left_metric": left_key,
                "right_metric": right_key,
                "method": "spearman_rank_correlation",
                "coefficient": round(rho, 6),
                "scene_count": len(paired),
                "direction": "positive" if rho > 0 else "negative" if rho < 0 else "none",
                "strength_label": "strong" if abs(rho) >= .7 else "moderate" if abs(rho) >= .4 else "weak",
                "scene_refs": [str(item["scene"].get("scene_id") or item["scene"].get("segment_id") or f"scene-{item['index'] + 1}") for item in paired],
                "source_intervals": [{"start_seconds": item["start"], "end_seconds": item["end"]} for item in paired],
                "paired_observations": [{
                    "scene_ref": str(item["scene"].get("scene_id") or item["scene"].get("segment_id") or f"scene-{item['index'] + 1}"),
                    "start_seconds": item["start"],
                    "end_seconds": item["end"],
                    "left_value": item["metrics"][left_key][1],
                    "right_value": item["metrics"][right_key][1],
                } for item in paired],
                "interpretation": f"Across {len(paired)} governed scenes, {left_key.replace('_', ' ')} and {right_key.replace('_', ' ')} show a {('positive' if rho > 0 else 'negative')} rank association.",
                "substantive_reading": _substantive_relationship_reading(left_key, right_key, rho),
                "status": "analyst_review_candidate",
                "analytical_frames": {
                    "scale": {
                        "micro": "source intervals available",
                        "meso": "computed across governed scenes",
                        "macro": "comparison candidate; requires a multi-video corpus",
                        "computed_level": "meso",
                    },
                    "orientation": orientation_frames,
                    "evidence_expression": evidence_frames,
                    "relationship_expression": "inferred",
                },
            })
        result["relationships"] = sorted(relationships, key=lambda row: abs(row["coefficient"]), reverse=True)
        result["relationship_diagnostics"] = relationship_diagnostics
        if persist:
            _atomic_json(self.analysis_dir / "native_statistical_interpretation.json", result)
        return result

    def run(self, payload: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        temporary_registry_dir = tempfile.TemporaryDirectory(prefix="vaa1-statistical-interpretation-") if not persist else None
        registry = self.registry if persist else InterpretationRegistry(
            self.analysis_id,
            Path(temporary_registry_dir.name) / "interpretation_registry.json",
        )
        observations = [normalize_observation(item) for item in payload.get("observations", [])]
        if len(observations) < 2:
            raise ValueError("Cross-signal salience requires at least two observations")
        families = sorted({item["signal_family"] for item in observations})
        if len(families) < 2:
            raise ValueError("Cross-signal salience requires at least two distinct signal families")
        intervals = [item["source_interval"] for item in observations]
        media_ids = {item["source_media_id"] for item in intervals}
        clock_ids = {item["clock_id"] for item in intervals}
        if "" in media_ids or len(media_ids) != 1 or clock_ids != {"source_media.clock"}:
            raise ValueError("All observations must resolve to one source_media_id on source_media.clock")
        concurrence_start = max(item["start_seconds"] for item in intervals)
        concurrence_end = min(item["end_seconds"] for item in intervals)
        if concurrence_end <= concurrence_start:
            raise ValueError("Cross-signal observations must have a non-empty concurrence interval")

        available = [item for item in observations if item["standardized_deviation"]["available"]]
        if len(available) < 2:
            raise ValueError("At least two observations require a non-zero baseline MAD")
        component_scores = [min(abs(item["standardized_deviation"]["value"]), 5.0) / 5.0 for item in available]
        salience_index = sum(component_scores) / len(component_scores)
        finding_core = {
            "analysis_id": self.analysis_id,
            "source_interval": {
                "source_media_id": next(iter(media_ids)),
                "clock_id": "source_media.clock",
                "start_seconds": concurrence_start,
                "end_seconds": concurrence_end,
                "timing_status": "measured_concurrence",
            },
            "observations": observations,
            "independent_signal_family_count": len(families),
            "signal_families": families,
            "salience_index": round(salience_index, 6),
        }
        finding_id = _stable_id("salience-finding", finding_core)
        finding = {
            "schema": "vaa1.cross_signal_salience_finding.v1",
            "finding_id": finding_id,
            **finding_core,
            "method": {
                "id": "cross_signal_salience",
                "version": METHOD_VERSION,
                "standardization": "median_mad_robust_z",
                "aggregation": "mean_of_capped_absolute_robust_z_components",
            },
            "status": "review_candidate",
            "authority": "computed_native_finding",
            "maturity": "native_finding",
            "interpretation_status": "not_interpreted",
            "statistical_terms": {
                "salience_index": "A bounded composite review-priority index; not statistical significance, a p-value, an effect size, or causal evidence.",
                "cross_signal": "Signals from distinct declared families that overlap in source time; overlap does not establish independence or causation.",
                "finding": "A reproducible computational result eligible for analyst inspection, not an interpretation.",
            },
            "limitations": list(dict.fromkeys([
                "Temporal concurrence does not establish causation.",
                "The composite index is descriptive and has no null-hypothesis significance interpretation.",
                *[note for item in observations for note in item["limitations"]],
            ])),
        }

        quality = assess_evidence_quality({
            "evidence_ref": f"native-finding:{finding_id}",
            "dimensions": {
                "clarity": 0.8,
                "temporal_precision": 0.9,
                "completeness": min(1.0, len(available) / len(observations)),
                "representativeness": 0.6,
                "source_independence": min(1.0, len(families) / 4),
                "corroboration": min(1.0, len(families) / 3),
                "assignment_stability": 0.7,
            },
        })
        evidence_refs = list(dict.fromkeys(ref for item in observations for ref in item["evidence_refs"]))
        claim_text = (
            f"{len(families)} measured signal families show concurrent standardized deviations "
            f"during {concurrence_start:.3f}–{concurrence_end:.3f} seconds."
        )
        claim_result = registry.append_claim({
            "claim_text": claim_text,
            "claim_type": "cross_signal_salience",
            "finding_refs": [finding_id],
            "evidence_refs": evidence_refs,
            "counter_evidence_refs": [],
            "quality_assessment": quality,
            "scope": finding["source_interval"],
            "source_run_refs": [finding_id],
        }, persist=True)
        claim = claim_result["record"]
        proposition_result = registry.append_proposition({
            "statement": claim_text + " This interval is a candidate for analyst review.",
            "proposition_type": "salience_review_candidate",
            "support_refs": [claim["record_id"]],
            "counter_evidence_refs": [],
            "scope": finding["source_interval"],
            "subject_ref": payload.get("subject_ref") or {"type": "analysis", "id": self.analysis_id},
            "alternatives": ["The concurrence may reflect editing, shared exposure, or measurement dependence rather than narrative change."],
        }, persist=True)
        proposition = proposition_result["record"]

        panel_routes = {
            "statskit": {"role": "method_and_measurement_owner", "record_refs": [finding_id], "status": "operational"},
            "search": {"role": "governed_discovery_projection", "record_refs": [proposition["record_id"]], "status": "operational"},
            "scene_cards": {"role": "scene_local_finding_projection", "record_refs": [proposition["record_id"]], "status": "eligible_when_scene_membership_resolves"},
            "narrative_agent": {"role": "subject_local_candidate_projection", "record_refs": [proposition["record_id"]], "status": "eligible_when_subject_is_governed"},
            "meaning_network": {"role": "candidate_node_and_relation_projection", "record_refs": [proposition["record_id"]], "status": "candidate_only"},
            "meaning_plot": {"role": "lens_input_after_proposition_review", "record_refs": [proposition["record_id"]], "status": "not_a_direct_statistical_owner"},
            "data_maturation": {"role": "review_and_confirmation_queue", "record_refs": [proposition["record_id"]], "status": "operational_control_surface"},
            "master_schema": {"role": "canonical_projection_after_confirmation", "record_refs": [], "status": "awaiting_analyst_confirmation"},
            "traceback": {"role": "source_and_method_verification", "record_refs": [finding_id, proposition["record_id"]], "status": "operational_control_surface"},
            "publication": {"role": "data_book_and_report_claim_source", "record_refs": [finding_id, proposition["record_id"]], "status": "candidate_until_report_eligibility"},
        }
        result = {
            "schema": SCHEMA,
            "analysis_id": self.analysis_id,
            "run_id": _stable_id("native-statistical-interpretation", finding_core),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "finding": finding,
            "claim": claim,
            "proposition": proposition,
            "panel_routes": panel_routes,
            "governance": {
                "canonical_write": False,
                "analyst_confirmation_required": True,
                "causal_claim_created": False,
                "statistical_significance_claimed": False,
                "raw_evidence_preserved": True,
            },
        }
        if persist:
            _atomic_json(self.analysis_dir / "native_statistical_interpretation.json", result)
        if temporary_registry_dir is not None:
            temporary_registry_dir.cleanup()
        return result
