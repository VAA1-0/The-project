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


dependency_sfl_stage1 = load_module(
    "src/backend/analysis/dependency_sfl_stage1.py",
    "dependency_sfl_stage1",
)
multimodal_meaning_stage1 = load_module(
    "src/backend/analysis/multimodal_meaning_stage1.py",
    "multimodal_meaning_stage1",
)
second_order_label_proliferation = load_module(
    "src/backend/analysis/second_order_label_proliferation.py",
    "second_order_label_proliferation",
)


class SecondOrderLabelProliferationContractTest(unittest.TestCase):
    def build_meaning_artifact(self):
        sfl = dependency_sfl_stage1.build_dependency_sfl_stage1_artifact(
            "analysis-prolif",
            {
                "language": "en",
                "segments": [
                    {
                        "id": "utt-1",
                        "start": 1.0,
                        "end": 2.0,
                        "speaker": "SPEAKER_01",
                        "text": "Hello Bond, you must listen.",
                        "source_evidence_ids": ["transcript:1"],
                    },
                    {
                        "id": "utt-2",
                        "start": 3.0,
                        "end": 4.0,
                        "speaker": "SPEAKER_02",
                        "text": "The device is gone.",
                        "source_evidence_ids": ["transcript:2"],
                    },
                ],
            },
            source_media_id="media-1",
            model_name="__missing_model__",
        )
        return multimodal_meaning_stage1.build_multimodal_meaning_stage1_artifact(
            "analysis-prolif",
            sfl,
            source_metadata={
                "user_annotations": {
                    "reference_people": [{"identity_label": "Bond"}],
                    "reference_speakers": [
                        {"speaker_label": "SPEAKER_01", "identity_label": "Bond"}
                    ],
                }
            },
            visual_cues=[
                {
                    "evidence_id": "visual:gaze:1",
                    "cue_type": "gaze",
                    "participant_id": "SPEAKER_01",
                    "target_type": "object",
                    "target_id": "object:device",
                    "start_ms": 1200,
                    "end_ms": 1800,
                }
            ],
        )

    def test_plan_surfaces_graduated_affirmations_without_confirmation_tax(self):
        plan = second_order_label_proliferation.build_second_order_label_proliferation_plan(
            "analysis-prolif",
            self.build_meaning_artifact(),
        )

        self.assertEqual(plan["schema"], "vaa1.second_order_label_proliferation_plan.v1")
        self.assertTrue(
            plan["governance"]["analyst_confirmation_is_not_required_for_every_candidate"]
        )
        self.assertTrue(plan["governance"]["open_weights_are_part_of_the_record"])
        self.assertGreater(plan["summary"]["instruction_count"], 0)

        for instruction in plan["instructions"]:
            self.assertTrue(instruction["may_surface_in_ui"])
            self.assertTrue(instruction["manual_override_available"])
            self.assertTrue(
                instruction["confirmation_policy"][
                    "analyst_confirmation_is_not_required_for_every_candidate"
                ]
            )

    def test_open_scores_drive_probable_or_strong_support_statuses(self):
        meaning = self.build_meaning_artifact()
        event = meaning["feature_events"][0]
        event["confidence"]["score"] = 0.9
        event["evidence_refs"].append(
            {
                "evidence_id": "manual:annotation:1",
                "evidence_kind": "manual_annotation",
                "authority_level": 40,
            }
        )
        event["evidence_refs"].append(
            {
                "evidence_id": "metadata:reference_people:0",
                "evidence_kind": "metadata_reference",
                "authority_level": 30,
            }
        )

        plan = second_order_label_proliferation.build_second_order_label_proliferation_plan(
            "analysis-prolif",
            meaning,
            target_label_families=["Interaction"],
        )

        interaction = next(
            item for item in plan["instructions"] if item["target_label_family"] == "Interaction"
        )
        self.assertIn(interaction["status"], {"strongly_supported", "analyst_confirmed"})
        self.assertTrue(interaction["may_proliferate"])
        self.assertIn("base_event_confidence", interaction["open_scores"])
        self.assertIn("delivery_priority", interaction["open_scores"])
        self.assertIn("open_score_weights", interaction)

    def test_high_impact_identity_strong_support_prompts_review_but_does_not_auto_confirm(self):
        meaning = self.build_meaning_artifact()
        identity_event = next(
            event
            for event in meaning["feature_events"]
            if "Identification" in event["proliferation_support"]["candidate_target_labels"]
        )
        identity_event["confidence"]["score"] = 0.95
        identity_event["evidence_refs"].append(
            {
                "evidence_id": "metadata:reference_people:0",
                "evidence_kind": "metadata_reference",
                "authority_level": 30,
            }
        )
        identity_event["evidence_refs"].append(
            {
                "evidence_id": "visual:gaze:1",
                "evidence_kind": "visual_cue",
                "authority_level": 20,
            }
        )

        plan = second_order_label_proliferation.build_second_order_label_proliferation_plan(
            "analysis-prolif",
            meaning,
            target_label_families=["Identification"],
        )
        identity_instruction = plan["instructions"][0]

        self.assertEqual(identity_instruction["target_label_family"], "Identification")
        self.assertTrue(identity_instruction["requires_immediate_confirmation"])
        self.assertFalse(identity_instruction["may_auto_confirm"])
        self.assertEqual(identity_instruction["confirmation_policy"]["surface_as"], "review_prompt")

    def test_write_plan_persists_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "second_order_plan.json"
            plan = second_order_label_proliferation.write_second_order_label_proliferation_plan(
                "analysis-prolif",
                self.build_meaning_artifact(),
                output_path,
            )

            self.assertTrue(output_path.exists())
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["schema"], plan["schema"])
            self.assertEqual(persisted["analysis_id"], "analysis-prolif")


if __name__ == "__main__":
    unittest.main()
