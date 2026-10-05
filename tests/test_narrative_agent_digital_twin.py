import unittest

from src.backend.analysis.narrative_agent_digital_twin import (
    SCHEMA,
    build_array_digital_twin_report,
    build_digital_twins,
    build_occurrence_signatures,
    build_proliferation_event,
    score_occurrence,
)


def status_fixture():
    return {
        "analysis_id": "analysis-1",
        "annotation_corrections": {
            "manual_visual_annotations": [
                {
                    "id": "anchor-1",
                    "category": "Identification",
                    "narrative_agent_affirmation": "Agent A",
                    "start_seconds": 10,
                    "end_seconds": 12,
                    "coordinates": {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.3},
                    "metadata_correlation": {
                        "manual_confirmation_event": {
                            "authority_level": "manual_correction",
                            "confirmed_fields": {"narrative_agent": True},
                        }
                    },
                }
            ]
        },
        "tracked_objects": [
            {
                "id": "visual-1", "class_name": "person", "start_seconds": 10,
                "end_seconds": 12, "movement_type": "turning", "motion_score": 0.72,
                "pose_ref": "pose:visual-1",
            }
        ],
        "audio_diarization": {
            "speaker_turns": [
                {
                    "turn_id": "turn-1", "speaker_label": "SPEAKER_00", "start": 10,
                    "end": 11.5, "turn_transition": "speaker_change",
                    "overlap_seconds": 0.2, "embedding_ref": "voice:turn-1",
                }
            ]
        },
        "transcript": [
            {"id": "speech-1", "text": "Agent A speaks", "start_seconds": 10, "end_seconds": 11}
        ],
        "ocr_results": [
            {"id": "ocr-1", "text": "Agent A", "start_seconds": 10, "end_seconds": 12}
        ],
        "mise_en_scene_scene_cards": {
            "scene_cards": [
                {"id": "scene-1", "label": "Agent A participates", "start_seconds": 9, "end_seconds": 15}
            ]
        },
        "source_media_metadata": {"title": "Example", "genre": "Interview"},
    }


class NarrativeAgentDigitalTwinTests(unittest.TestCase):
    def test_v2_report_registers_speaker_turn_and_body_movement_modalities(self):
        report = build_array_digital_twin_report([status_fixture()])
        self.assertEqual(SCHEMA, "vaa1.narrative_agent_digital_twin_array.v2")
        self.assertEqual(report["summary"]["modality_coverage_by_twin_count"]["speaker_turn"], 1)
        self.assertEqual(report["summary"]["modality_coverage_by_twin_count"]["body_movement"], 1)

    def test_occurrence_signature_collects_source_timed_support(self):
        signature = build_occurrence_signatures([status_fixture()])[0]
        self.assertEqual(signature["source_interval"], {"start": 10.0, "end": 12.0})
        self.assertIn("transcript", signature["available_modalities"])
        self.assertIn("ocr", signature["available_modalities"])
        self.assertEqual(signature["visual_signature"]["measurement_state"], "embedding_required")

    def test_twin_preserves_each_modality_as_governed_evidence(self):
        twin = build_digital_twins([status_fixture()])[0]
        self.assertEqual(twin["narrative_agent_label"], "Agent A")
        self.assertTrue(twin["evidence"]["visual"])
        self.assertTrue(twin["evidence"]["speaker_turn"])
        self.assertTrue(twin["evidence"]["body_movement"])
        self.assertTrue(twin["evidence"]["transcript"])
        self.assertTrue(twin["evidence"]["ocr"])
        self.assertTrue(twin["evidence"]["source_media_data"])
        self.assertTrue(twin["evidence"]["scene_card"])
        self.assertTrue(twin["evidence"]["manual_confirmation"])
        self.assertTrue(
            twin["recognition_policy"]["not_a_biometric_or_natural_person_identity_profile"]
        )
        self.assertFalse(twin["visual_quality_guard"]["automatic_recognition_ready"])
        self.assertTrue(twin["visual_quality_guard"]["single_first_frame_cannot_auto_confirm"])
        turn = twin["evidence"]["speaker_turn"][0]["speaker_turn"]
        self.assertEqual(turn["turn_transition"], "speaker_change")
        self.assertTrue(turn["identity_is_candidate_only"])
        movement = twin["evidence"]["body_movement"][0]["body_movement"]
        self.assertEqual(movement["movement_type"], "turning")
        self.assertTrue(movement["interpretation_is_candidate_only"])

    def test_multimodal_match_can_confirm_and_project_to_consumers(self):
        twin = build_digital_twins([status_fixture()])[0]
        occurrence = {
            "occurrence_id": "occurrence-2",
            "analysis_id": "analysis-1",
            "source_interval": {"start": 20, "end": 22},
            "source_geometry": {"x": 0.2, "y": 0.2, "w": 0.2, "h": 0.3},
            "modality_scores": {
                "visual": 0.96,
                "audio": 0.91,
                "transcript": 0.90,
                "ocr": 0.89,
                "source_media_data": 1.0,
            },
            "best_competing_agent_score": 0.70,
            "source_refs": ["visual-2", "audio-2", "speech-2"],
        }
        recognition = score_occurrence(twin, occurrence)
        self.assertEqual(recognition["recognition_state"], "automatically_confirmed")
        event = build_proliferation_event(recognition)
        consumers = {target["consumer"] for target in event["projection_targets"]}
        self.assertIn("MasterSchema", consumers)
        self.assertIn("NarrativeAgent", consumers)
        self.assertIn("ScientificReport", consumers)
        scene_target = next(
            target for target in event["projection_targets"] if target["consumer"] == "SceneCards"
        )
        self.assertEqual(scene_target["state"], "queued_for_overlapping_scene_rebuild")
        self.assertTrue(scene_target["preserve_manual_scene_evidence"])

    def test_weak_or_ambiguous_match_remains_candidate(self):
        twin = build_digital_twins([status_fixture()])[0]
        recognition = score_occurrence(
            twin,
            {
                "occurrence_id": "weak",
                "analysis_id": "analysis-1",
                "source_interval": {"start": 20, "end": 22},
                "modality_scores": {"visual": 0.83, "audio": 0.70},
                "best_competing_agent_score": 0.80,
            },
        )
        self.assertEqual(recognition["recognition_state"], "candidate")
        with self.assertRaises(ValueError):
            build_proliferation_event(recognition)


if __name__ == "__main__":
    unittest.main()
