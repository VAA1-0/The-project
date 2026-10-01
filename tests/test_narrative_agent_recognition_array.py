import unittest

from src.backend.analysis.narrative_agent_recognition_array import build_array_extension


def confirmed_status(analysis_id="analysis-1"):
    return {
        "analysis_id": analysis_id,
        "annotation_corrections": {
            "manual_visual_annotations": [
                {
                    "id": "anchor-1",
                    "category": "Identification",
                    "identity_affirmation": "Narrative Agent A",
                    "start_seconds": 1.0,
                    "end_seconds": 2.0,
                    "coordinates": {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.3},
                    "metadata_correlation": {
                        "manual_confirmation_event": {
                            "event_id": "event-1",
                            "authority_level": "manual_correction",
                            "confirmed_fields": {"narrative_agent": True},
                        }
                    },
                }
            ]
        },
    }


class NarrativeAgentRecognitionArrayTests(unittest.TestCase):
    def test_legacy_anchor_is_translated_to_narrative_agent_contract(self):
        result = build_array_extension([confirmed_status()])
        anchor = result["confirmed_recognition_anchors"][0]
        self.assertEqual(anchor["narrative_agent_label"], "Narrative Agent A")
        self.assertNotIn("identity_label", anchor)
        self.assertTrue(result["governance"]["raw_track_id_cannot_define_a_narrative_agent"])

    def test_only_fully_measured_occurrence_is_automatically_extended(self):
        status = confirmed_status()
        status["narrative_agent_recognition_candidates"] = [
            {
                "candidate_id": "candidate-1",
                "narrative_agent_label": "Narrative Agent A",
                "start_seconds": 5.0,
                "end_seconds": 6.0,
                "bbox": {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.3},
                "scores": {
                    "overall": 0.96,
                    "visual": 0.93,
                    "voice": 0.81,
                    "competing_agent": 0.70,
                    "margin": 0.26,
                },
            }
        ]
        result = build_array_extension([status])
        self.assertEqual(result["summary"]["automatically_extended_occurrence_count"], 1)
        self.assertEqual(result["automatic_recognition_extensions"][0]["gate_failures"], [])

    def test_missing_similarity_evidence_never_becomes_recognition(self):
        status = confirmed_status()
        status["identity_continuity_candidates"] = [
            {
                "candidate_id": "candidate-legacy",
                "candidate_label": "Narrative Agent A",
                "start_seconds": 5.0,
                "bbox": {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.3},
                "confidence": 0.96,
            }
        ]
        result = build_array_extension([status])
        self.assertEqual(result["summary"]["automatically_extended_occurrence_count"], 0)
        failures = result["blocked_recognition_occurrences"][0]["gate_failures"]
        self.assertIn("missing_visual_similarity_score", failures)
        self.assertIn("missing_independent_secondary_modality", failures)

    def test_raw_person_track_is_counted_but_never_treated_as_recognition(self):
        status = confirmed_status()
        status["tracked_objects"] = [
            {
                "class_name": "person",
                "track_id": 7,
                "start_timestamp": 7.0,
                "end_timestamp": 9.0,
                "bbox_x1": 1,
                "bbox_y1": 2,
                "bbox_x2": 10,
                "bbox_y2": 20,
            }
        ]
        result = build_array_extension([status])
        self.assertEqual(result["summary"]["candidate_occurrence_count"], 1)
        self.assertEqual(result["summary"]["automatically_extended_occurrence_count"], 0)
        candidate = result["blocked_recognition_occurrences"][0]
        self.assertTrue(candidate["raw_track_id_is_not_recognition"])
        self.assertIn("missing_overall_similarity_score", candidate["gate_failures"])


if __name__ == "__main__":
    unittest.main()
