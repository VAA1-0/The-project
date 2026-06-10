import json
import unittest
from pathlib import Path


SCHEMA_PATH = (
    Path(__file__).resolve().parents[1]
    / "docs"
    / "schemas"
    / "vaa1_mature_data_proliferation_regime_overhaul_v2.schema.json"
)


class MatureDataProliferationRegimeOverhaulSchemaTests(unittest.TestCase):
    def setUp(self):
        self.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    def test_schema_is_canonical_v2_architecture_contract(self):
        self.assertTrue(SCHEMA_PATH.exists())
        self.assertEqual(
            self.schema["schema_name"],
            "vaa1.mature_data_proliferation_regime_overhaul.v2",
        )
        self.assertEqual(self.schema["version"], "2.0.0")
        self.assertEqual(self.schema["status"], "architecture_and_delivery_schema")
        self.assertIn(
            "Corrected and governed mature data should stand corrected everywhere except traceback.",
            self.schema["core_promise"]["statement"],
        )

    def test_defects_cover_actual_audit_bottlenecks(self):
        defect_ids = {
            item["defect_id"] for item in self.schema["current_defect_states"]
        }
        self.assertEqual(
            defect_ids,
            {
                "D001_ON_DEMAND_MATCHER_NOT_LIVE_BUS",
                "D002_MATCHER_OUTPUT_IS_NOT_PROMOTION",
                "D003_POLICY_TOO_CONSERVATIVE_FOR_MATURE_HYPOTHESES",
                "D004_SCENE_CARDS_LOCAL_OVERLAP_ONLY",
                "D005_IMPORTED_SAVED_WORK_HYDRATION_GAP",
                "D006_MEANING_NETWORK_NO_CONTINUITY",
                "D007_AUDIOVISUAL_SOURCE_SAMPLING_NOT_OPERATIONALIZED",
            },
        )
        release_gates = {
            item["defect_id"]: item["release_gate"]
            for item in self.schema["current_defect_states"]
        }
        self.assertEqual(
            release_gates["D001_ON_DEMAND_MATCHER_NOT_LIVE_BUS"], "fail"
        )
        self.assertEqual(
            release_gates["D005_IMPORTED_SAVED_WORK_HYDRATION_GAP"], "fail"
        )
        self.assertEqual(
            release_gates["D007_AUDIOVISUAL_SOURCE_SAMPLING_NOT_OPERATIONALIZED"],
            "warn",
        )

    def test_pipeline_and_backend_components_define_live_bus_delivery(self):
        pipeline = self.schema["target_architecture"]["pipeline"]
        self.assertLess(
            pipeline.index("artifact_hydration"),
            pipeline.index("candidate_generation"),
        )
        self.assertLess(
            pipeline.index("promotion_decision_ledger"),
            pipeline.index("panel_projection"),
        )
        self.assertIn("cross_scene_sweep", pipeline)
        self.assertIn("cross_modal_sweep", pipeline)
        self.assertIn("meaning_network_continuity_update", pipeline)

        components = self.schema["backend_components"]
        for key in (
            "saved_analysis_hydration_loader",
            "live_mature_data_proliferation_bus",
            "mature_data_promotion_engine",
            "scene_continuity_sweeper",
            "meaning_network_continuity_builder",
            "sample_cloud_memory_manager",
            "master_schema_quality_agent",
        ):
            self.assertIn(key, components)
            self.assertTrue(components[key]["module_path"].startswith("src/backend/analysis/"))

        self.assertIn(
            "source_samples",
            components["saved_analysis_hydration_loader"]["must_hydrate"],
        )
        self.assertIn(
            "poll_sample_clouds_during_live_sweeps",
            components["sample_cloud_memory_manager"]["required_behavior"],
        )

    def test_authority_vocab_is_consistent_across_records(self):
        authority_classes = {
            item["authority_class"] for item in self.schema["authority_classes"]
        }
        self.assertEqual(
            authority_classes,
            {
                "confirmed_mature",
                "governed_mature_hypothesis",
                "review_candidate",
                "raw_substrate",
                "rejected_or_canceled",
            },
        )
        self.assertEqual(
            set(
                self.schema["promotion_decision_record"]["properties"][
                    "authority_class"
                ]["enum"]
            ),
            authority_classes,
        )
        self.assertEqual(
            set(
                self.schema["meaning_network_edge_record"]["properties"][
                    "authority_class"
                ]["enum"]
            ),
            authority_classes,
        )
        self.assertEqual(
            set(
                self.schema["continuity_anchor_record"]["properties"][
                    "authority_class"
                ]["enum"]
            ),
            {
                "confirmed_mature",
                "governed_mature_hypothesis",
                "review_candidate",
            },
        )

    def test_acceptance_tests_guard_the_missing_operational_loop(self):
        acceptance_ids = {
            item["test_id"] for item in self.schema["acceptance_tests"]
        }
        self.assertEqual(
            acceptance_ids,
            {
                "AT001_LIVE_BUS_RUNS_AFTER_ANALYSIS_COMPLETION",
                "AT002_MATCHER_OUTPUT_NOT_PROMOTED_WITHOUT_DECISION",
                "AT003_GOVERNED_HYPOTHESIS_PROJECTS_WITH_BADGE",
                "AT004_SCENE_1_CONFIRMATION_SWEEPS_TO_SCENE_2",
                "AT005_SAVED_ARTIFACT_HYDRATION_COMPLETE",
                "AT006_MEANING_NETWORK_CONTINUITY_NONZERO",
                "AT007_SAMPLE_CLOUD_AS_MEMORY_SUBSTRATE",
                "AT008_PROJECT_REOPEN_PRESERVES_AUTHORITY",
            },
        )


if __name__ == "__main__":
    unittest.main()
