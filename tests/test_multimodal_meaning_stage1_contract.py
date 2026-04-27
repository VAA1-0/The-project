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


class MultimodalMeaningStage1ContractTest(unittest.TestCase):
    def build_sfl_artifact(self):
        return dependency_sfl_stage1.build_dependency_sfl_stage1_artifact(
            "analysis-meaning",
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
                        "start": 3.2,
                        "end": 4.0,
                        "speaker": "SPEAKER_02",
                        "text": "Um, actually the device is gone.",
                        "source_evidence_ids": ["transcript:2"],
                    },
                    {
                        "id": "utt-3",
                        "start": 6.0,
                        "end": 7.0,
                        "speaker": "SPEAKER_01",
                        "text": "The device, the device will return.",
                        "source_evidence_ids": ["transcript:3"],
                    },
                ],
            },
            source_media_id="media-1",
            source_metadata={
                "user_annotations": {
                    "reference_people": [{"identity_label": "Bond"}],
                }
            },
            genre_profile={"genre": "trailer"},
            culture_context={"annotation_culture": "film_analysis"},
            model_name="__missing_model__",
        )

    def test_metadata_open_weights_and_authority_are_first_class(self):
        artifact = multimodal_meaning_stage1.build_multimodal_meaning_stage1_artifact(
            "analysis-meaning",
            self.build_sfl_artifact(),
            source_metadata={
                "user_annotations": {
                    "reference_people": [{"identity_label": "Bond"}],
                    "reference_speakers": [
                        {"speaker_label": "SPEAKER_01", "identity_label": "Bond"}
                    ],
                    "genre_tags": ["trailer"],
                }
            },
            genre_profile={"genre": "trailer"},
            culture_context={"annotation_culture": "film_analysis"},
        )

        self.assertEqual(artifact["schema"], "vaa1.multimodal_meaning.stage1.v1")
        self.assertTrue(artifact["authority_policy"]["manual_annotation_wins"])
        self.assertTrue(artifact["authority_policy"]["pattern_level_recognition_may_seed_candidates"])
        self.assertIn("metadata_reference", artifact["open_weights"])
        self.assertTrue(
            artifact["interpretive_context"]["metadata_can_seed_reference_patterns"]
        )
        self.assertFalse(
            artifact["interpretive_context"]["external_llm_label_checkup"]["may_auto_confirm"]
        )
        self.assertTrue(artifact["participants"])

    def test_low_hanging_events_are_candidate_only_and_traceable(self):
        artifact = multimodal_meaning_stage1.build_multimodal_meaning_stage1_artifact(
            "analysis-meaning",
            self.build_sfl_artifact(),
            source_metadata={
                "user_annotations": {
                    "reference_people": [{"identity_label": "Bond"}],
                }
            },
        )

        feature_types = {event["feature_type"] for event in artifact["feature_events"]}
        self.assertIn("addressivity", feature_types)
        self.assertIn("turn_taking", feature_types)
        self.assertIn("repair_self_correction", feature_types)
        self.assertIn("repetition", feature_types)
        self.assertIn("topic_shift", feature_types)
        self.assertIn("micro_ritual", feature_types)

        for event in artifact["feature_events"]:
            self.assertTrue(event["traceback"]["traceback_required"])
            self.assertIn(event["review_status"]["status"], {"auto_generated"})
            self.assertFalse(event["proliferation_support"]["may_auto_confirm"])
            self.assertIn("time_interval", event["proliferation_support"]["must_preserve"])

    def test_visual_and_cinematic_clues_feed_role_action_interaction_candidates(self):
        artifact = multimodal_meaning_stage1.build_multimodal_meaning_stage1_artifact(
            "analysis-meaning",
            self.build_sfl_artifact(),
            visual_cues=[
                {
                    "evidence_id": "visual:gaze:1",
                    "cue_type": "gaze",
                    "participant_id": "SPEAKER_01",
                    "target_type": "object",
                    "target_id": "object:device",
                    "start_ms": 1200,
                    "end_ms": 1800,
                },
                {
                    "evidence_id": "visual:object:1",
                    "cue_type": "object_foregrounded",
                    "object_id": "object:device",
                    "significance_stage": "noticed",
                    "start_ms": 3200,
                    "end_ms": 3600,
                },
            ],
            cinematic_clues=[
                {
                    "evidence_id": "cinematic:closeup:1",
                    "clue_type": "close_up",
                    "participant_id": "SPEAKER_01",
                    "start_ms": 1000,
                    "end_ms": 2000,
                }
            ],
        )

        by_type = {event["feature_type"]: event for event in artifact["feature_events"]}
        self.assertIn("gaze_target_priority", by_type)
        self.assertIn("object_significance_escalation", by_type)
        self.assertIn("spatial_relationship", by_type)
        target_labels = {
            label
            for event in artifact["feature_events"]
            for label in event["proliferation_support"]["candidate_target_labels"]
        }
        self.assertIn("Interaction", target_labels)
        self.assertIn("Action", target_labels)
        self.assertIn("Identification", target_labels)
        self.assertTrue(
            artifact["derived_scene_state"]["linearity_policy"][
                "does_not_assume_linear_story_world"
            ]
        )

    def test_write_artifact_persists_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "meaning_stage1.json"
            artifact = multimodal_meaning_stage1.write_multimodal_meaning_stage1_artifact(
                "analysis-meaning",
                self.build_sfl_artifact(),
                output_path,
            )

            self.assertTrue(output_path.exists())
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["schema"], artifact["schema"])
            self.assertEqual(persisted["analysis_id"], "analysis-meaning")


if __name__ == "__main__":
    unittest.main()

