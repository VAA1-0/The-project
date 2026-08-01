import tempfile
import unittest
from pathlib import Path

from src.backend.analysis.stats_research_question import StatsResearchQuestionService


class StatsResearchQuestionServiceTests(unittest.TestCase):
    def test_expression_prosody_vertical_slice_is_persisted_and_source_linked(self):
        with tempfile.TemporaryDirectory() as directory:
            service = StatsResearchQuestionService("analysis-1", Path(directory))
            plan = service.create_plan({"motor": "expression_prosody"})
            native = {
                "run_id": "native-1",
                "relationships": [{
                    "relationship_id": "relationship-1",
                    "coupling": "expression_prosody",
                    "left_metric": "expression_label_diversity",
                    "right_metric": "mean_vocal_emphasis",
                    "method": "spearman_rank_correlation",
                    "coefficient": .6,
                    "scene_count": 3,
                    "direction": "positive",
                    "strength_label": "moderate",
                    "substantive_reading": "Scenes with more varied detected expressions also carry stronger vocal emphasis.",
                    "paired_observations": [
                        {"scene_ref": f"scene:{index}", "start_seconds": index * 10, "end_seconds": index * 10 + 10, "left_value": index, "right_value": index / 2}
                        for index in range(1, 4)
                    ],
                }],
            }
            delivered = service.record_run(plan, native)
            result = delivered["run"]["results"][0]
            self.assertEqual("computed", result["status"])
            self.assertEqual("paired_scene_scatterplot", result["visualization"]["chart"])
            self.assertEqual(3, len(result["evidence"]))
            self.assertEqual("draft_from_measured_result", result["report_sentence"]["status"])
            self.assertEqual(1, len(service.load()["runs"]))

    def test_run_refuses_absent_or_uncomputed_motor(self):
        with tempfile.TemporaryDirectory() as directory:
            service = StatsResearchQuestionService("analysis-1", Path(directory))
            plan = service.create_plan({})
            with self.assertRaisesRegex(ValueError, "constant"):
                service.record_run(plan, {"relationship_diagnostics": [{"coupling": "expression_prosody", "reason": "constant expression values"}]})

    def test_all_delivered_cross_signal_motors_create_validated_plans(self):
        with tempfile.TemporaryDirectory() as directory:
            service = StatsResearchQuestionService("analysis-1", Path(directory))
            for motor in ("expression_prosody", "expression_transcript", "sfl_prosody", "props_sfl", "transcript_prosody"):
                plan = service.create_plan({"motor": motor})
                self.assertEqual(motor, plan["motor"])
                self.assertEqual("validated", plan["status"])
                self.assertGreaterEqual(len(plan["variables"]), 2)
                self.assertGreaterEqual(len(plan["required_source_layers"]), 3)


if __name__ == "__main__":
    unittest.main()
