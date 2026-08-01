import json
import tempfile
import unittest
from pathlib import Path

from src.backend.analysis.interpretation_registry import InterpretationRegistry
from src.backend.analysis.native_statistical_interpretation import (
    NativeStatisticalInterpretationService,
    normalize_observation,
)


class NativeStatisticalInterpretationTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.registry = InterpretationRegistry("a1", self.root / "interpretation_registry.json")
        self.service = NativeStatisticalInterpretationService("a1", self.root, self.registry)

    def tearDown(self):
        self.temporary.cleanup()

    @staticmethod
    def observation(metric_id, family, observed, baseline, start=10, end=20):
        return {
            "metric_id": metric_id,
            "metric_label": metric_id.replace("_", " "),
            "signal_family": family,
            "analytical_unit": "scene",
            "observed_value": observed,
            "unit": "ratio",
            "baseline_values": baseline,
            "baseline_definition": "preceding governed scenes",
            "population": {"included_count": 12, "excluded_count": 1, "denominator": "eligible governed turns"},
            "source_interval": {"source_media_id": "video-1", "clock_id": "source_media.clock", "start_seconds": start, "end_seconds": end},
            "evidence_refs": [f"artifact:{metric_id}"],
        }

    def test_normalization_names_robust_z_without_significance_claim(self):
        item = normalize_observation(self.observation("speech_share", "speech", .78, [.2, .3, .31, .35, .4]))
        self.assertEqual(item["standardized_deviation"]["method"], "median_mad_robust_z")
        self.assertIn("not a p-value", item["statistical_terms"]["robust_z_score"])

    def test_cross_signal_run_persists_candidate_chain_and_routes(self):
        result = self.service.run({"observations": [
            self.observation("speech_share", "speech", .78, [.2, .3, .31, .35, .4]),
            self.observation("vocal_intensity", "prosody", .91, [.25, .32, .4, .45, .5]),
        ]})
        self.assertFalse(result["governance"]["statistical_significance_claimed"])
        self.assertFalse(result["governance"]["causal_claim_created"])
        self.assertEqual(result["proposition"]["authority"], "candidate_service")
        self.assertEqual(result["panel_routes"]["statskit"]["role"], "method_and_measurement_owner")
        self.assertIn("data_maturation", result["panel_routes"])
        self.assertTrue((self.root / "native_statistical_interpretation.json").exists())
        records = self.registry.view()["records"]
        self.assertEqual([item["kind"] for item in records], ["claim", "proposition"])

    def test_rejects_single_family_or_nonconcurrent_inputs(self):
        first = self.observation("speech_share", "speech", .78, [.2, .3, .31, .35, .4])
        same_family = self.observation("interruptions", "speech", 8, [1, 2, 3, 4, 5])
        with self.assertRaisesRegex(ValueError, "distinct signal families"):
            self.service.run({"observations": [first, same_family]}, persist=False)
        later = self.observation("vocal_intensity", "prosody", .91, [.2, .3, .4, .5, .6], 21, 30)
        with self.assertRaisesRegex(ValueError, "concurrence interval"):
            self.service.run({"observations": [first, later]}, persist=False)

    def test_checked_in_schema_accepts_governance_constants(self):
        schema = json.loads(Path("docs/schemas/vaa1.native_statistical_interpretation.v1.schema.json").read_text())
        self.assertEqual(schema["properties"]["governance"]["properties"]["canonical_write"]["const"], False)

    def test_automatic_run_builds_scene_statistics_from_persisted_layers(self):
        scenes = [{"scene_id": f"scene-{index + 1}", "start": index * 10, "end": (index + 1) * 10} for index in range(5)]
        brightness = [10, 20, 30, 40, 95]
        motion = [.1, .2, .3, .4, .95]
        status = {
            "analysis_id": "a1",
            "summary": {
                "scene_segments": {"segments": scenes},
                "spatial_tone_scan": {"samples": [
                    {"timestamp": index * 10 + 5, "brightness": brightness[index], "contrast": brightness[index] / 2}
                    for index in range(5)
                ]},
                "adaptive_visual_scan": {"samples": [
                    {"timestamp": index * 10 + 5, "changed_fraction": motion[index]}
                    for index in range(5)
                ]},
            },
        }
        result = self.service.run_from_status(status, persist=False)
        self.assertEqual(result["selection"]["selected_scene_index"], 4)
        self.assertGreaterEqual(result["selection"]["eligible_scene_count"], 1)
        self.assertEqual(result["proposition"]["subject_ref"]["id"], "scene-5")

    def test_automatic_run_couples_expression_prosody_transcript_props_and_sfl(self):
        scenes = [{"scene_id": f"scene-{i + 1}", "start": i * 10, "end": (i + 1) * 10} for i in range(5)]
        status = {
            "analysis_id": "a1",
            "summary": {
                "scene_segments": {"segments": scenes},
                "spatial_tone_scan": {"samples": [{"timestamp": i * 10 + 5, "brightness": 10 + i * i * 5} for i in range(5)]},
                "adaptive_visual_scan": {"samples": [{"timestamp": i * 10 + 5, "changed_fraction": .1 + i * i * .05} for i in range(5)]},
            },
            "audio_prosody": {"cues": [{"start": i * 10 + 1, "end": i * 10 + 4, "pace": {"words_per_second": 1 + i}, "emphasis": {"score": .1 + i * .2}} for i in range(5)]},
            "transcript": {"segments": [{"start": i * 10 + 1, "end": i * 10 + 4, "text": ("No, we must act now? " * (i + 1)).strip()} for i in range(5)]},
            "expression_json": {"items": [{"timestamp": i * 10 + 2, "dominant_emotion": "fear" if i > 2 else "neutral", "expression_evidence": {"dominant_emotion_ready": True}, "affect_hints": {"activation": ["low", "low", "medium", "high", "high"][i]}} for i in range(5)]},
            "tracked_objects_json": {"items": [item for i in range(5) for item in [{"timestamp": i * 10 + 2 + j * .1, "class_name": f"prop-{j}"} for j in range(i + 1)]]},
            "dependency_sfl_stage1": {"utterances": [{"utterance_id": f"u-{i}", "time_interval": {"start_ms": (i * 10 + 1) * 1000, "end_ms": (i * 10 + 4) * 1000}, "sfl_lite": {"ideational": {"process_type": "material" if i > 1 else "verbal"}, "interpersonal": {"speech_function": "proposal" if i > 1 else "statement", "modality": "obligation" if i > 1 else ""}}} for i in range(5)]},
        }
        result = self.service.run_from_status(status, persist=False)
        couplings = {item["coupling"] for item in result["relationships"]}
        self.assertIn("expression_prosody", couplings)
        self.assertIn("expression_transcript", couplings)
        self.assertIn("props_sfl", couplings)
        self.assertIn("sfl_prosody", couplings)


if __name__ == "__main__":
    unittest.main()
