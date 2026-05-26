import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


def load_module(path_suffix: str, name: str):
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    module_path = repo_root / path_suffix
    spec = importlib.util.spec_from_file_location(name, module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


narrative_lens_reading = load_module(
    "src/backend/analysis/narrative_lens_reading.py",
    "narrative_lens_reading",
)
character_path_reading = load_module(
    "src/backend/analysis/character_path_reading.py",
    "character_path_reading",
)


def second_order_plan():
    return {
        "schema": "vaa1.second_order_label_proliferation_plan.v1",
        "instructions": [
            {
                "instruction_id": "inst-scene-1",
                "target_label_family": "Scene",
                "candidate_label": "rising action pressure",
                "status": "strongly_supported",
                "source_feature_type": "plot_function",
                "participants_involved": ["Bond", "Interviewer"],
                "time_span": {"start_ms": 1000, "end_ms": 5000},
                "source_evidence_refs": [
                    {
                        "evidence_id": "sfl:utt-1",
                        "evidence_kind": "dependency_sfl_candidate",
                        "source_surface": "DependencySFL",
                        "authority_level": 20,
                    }
                ],
                "open_scores": {"overall_support": 0.7},
            },
            {
                "instruction_id": "inst-agent-1",
                "target_label_family": "Role",
                "candidate_label": "Bond controls withheld information",
                "status": "candidate",
                "source_feature_type": "scene_power_balance",
                "participants_involved": ["Bond"],
                "time_span": {"start_ms": 2000, "end_ms": 4500},
                "source_evidence_refs": [
                    {
                        "evidence_id": "manual:agent-bond",
                        "evidence_kind": "manual_annotation",
                        "source_surface": "NarrativeAgent",
                        "authority_level": 35,
                    }
                ],
                "open_scores": {"overall_support": 0.62},
            },
        ],
    }


class InterpretiveLensReadingContractTest(unittest.TestCase):
    def test_narrative_lens_readings_are_suggested_source_linked_candidates(self):
        artifact = narrative_lens_reading.build_narrative_lens_reading_artifact(
            "analysis-lens",
            second_order_plan(),
            dependency_sfl_stage1={"schema": "vaa1.dependency_sfl_stage1.v1"},
            multimodal_meaning_stage1={"schema": "vaa1.multimodal_meaning.stage1.v1"},
        )

        self.assertEqual(artifact["schema"], "vaa1.narrative_lens_reading.v1")
        self.assertTrue(artifact["authority_policy"]["interpretive_lens_outputs_are_candidates"])
        self.assertEqual(
            artifact["maturity_config"]["blocked_states"],
            ["blocked_no_source_anchor"],
        )
        self.assertGreater(artifact["summary"]["reading_count"], 0)

        reading = artifact["readings"][0]
        self.assertIn("suggested by", reading["claim_prose"])
        self.assertNotIn(" is Campbellian", reading["claim_prose"])
        self.assertTrue(reading["prose_policy"]["must_phrase_as_suggested_reading"])
        self.assertTrue(reading["evidence_refs"])
        self.assertIn(
            reading["maturity_state"],
            {"candidate_low_support", "candidate_source_linked", "cross_modal_supported", "analyst_supported"},
        )
        self.assertTrue(reading["maturity_gate"]["source_anchor_present"])
        self.assertTrue(reading["maturity_gate"]["can_surface"])
        self.assertIn("reason", reading["maturity_gate"])
        self.assertIn("open_traceback", reading["analyst_actions"])

    def test_character_path_readings_remain_narrative_agent_profile_extensions(self):
        artifact = character_path_reading.build_character_path_reading_artifact(
            "analysis-agent",
            [
                {
                    "profile_id": "na-bond",
                    "profile_type": "narrative_agent_profile",
                    "narrative_agent_name": "Bond",
                    "evidence_slots": {"scene_links": ["scene-1"]},
                }
            ],
            second_order_plan(),
            scene_refs=[{"scene_id": "scene-1", "start_ms": 1000, "end_ms": 5000}],
        )

        self.assertEqual(artifact["schema"], "vaa1.character_path_reading.v1")
        self.assertTrue(
            artifact["authority_policy"]["must_not_create_natural_person_identity_profile"]
        )
        self.assertIn("blocked_no_agent_profile", artifact["maturity_config"]["blocked_states"])
        self.assertEqual(artifact["summary"]["narrative_agent_count"], 1)
        self.assertEqual(
            {reading["reading_type"] for reading in artifact["readings"]},
            {
                "scene_presence",
                "participant_ranking",
                "dramatic_archetype",
                "relation",
                "trajectory",
            },
        )

        archetype = next(
            reading for reading in artifact["readings"]
            if reading["reading_type"] == "dramatic_archetype"
        )
        self.assertIn("not an identity label", archetype["claim_prose"])
        self.assertIn(
            archetype["maturity_state"],
            {"candidate_low_support", "candidate_source_linked", "cross_modal_supported", "analyst_supported"},
        )
        self.assertTrue(archetype["maturity_gate"]["narrative_agent_profile_present"])
        self.assertTrue(archetype["maturity_gate"]["can_surface"])
        self.assertIn("reason", archetype["maturity_gate"])
        self.assertTrue(archetype["evidence_refs"])
        self.assertTrue(
            archetype["profile_extension_policy"][
                "must_not_create_natural_person_identity_profile"
            ]
        )

    def test_interpretive_artifacts_write_json_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            lens_path = Path(tmpdir) / "narrative_lens_reading.json"
            path_artifact = narrative_lens_reading.write_narrative_lens_reading_artifact(
                "analysis-write",
                second_order_plan(),
                lens_path,
            )
            self.assertTrue(lens_path.exists())
            self.assertEqual(json.loads(lens_path.read_text())["schema"], path_artifact["schema"])

            character_path = Path(tmpdir) / "character_path_reading.json"
            character_artifact = character_path_reading.write_character_path_reading_artifact(
                "analysis-write",
                [{"profile_id": "na-bond", "narrative_agent_name": "Bond"}],
                second_order_plan(),
                character_path,
            )
            self.assertTrue(character_path.exists())
            self.assertEqual(
                json.loads(character_path.read_text())["schema"],
                character_artifact["schema"],
            )


if __name__ == "__main__":
    unittest.main()
