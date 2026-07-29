import unittest

from src.backend.analysis.speaker_prosody_projection import (
    project_confirmed_speaker_prosody,
)


class SpeakerProsodyProjectionContractTests(unittest.TestCase):
    def test_confirmed_agent_receives_overlapping_measured_prosody(self):
        payload = project_confirmed_speaker_prosody(
            "analysis-1",
            corrections={
                "text_substitutions": [{
                    "id": "line-1",
                    "raw_value": "We all have our secrets.",
                    "corrected_value": "We all have our secrets.",
                    "target_start_timestamp": 7.82,
                    "target_end_timestamp": 8.92,
                    "speaker_confirmation": "James Bond",
                }],
            },
            audio_prosody={
                "cues": [{
                    "cue_id": "cue-1",
                    "start": 7.7,
                    "end": 9.0,
                    "pace": {"label": "measured"},
                    "emphasis": {"label": "emphatic", "score": 0.8},
                }],
            },
        )
        self.assertEqual(payload["projection_count"], 1)
        projection = payload["projections"][0]
        self.assertEqual(projection["speaker_label"], "James Bond")
        self.assertEqual(projection["assignment_kind"], "narrative_agent")
        self.assertTrue(projection["narrative_agent_eligible"])
        self.assertEqual(
            projection["source_time"]["clock_id"],
            "source_media.clock",
        )
        self.assertEqual(
            projection["authority"]["speaker_assignment"],
            "explicit_user_confirmation",
        )
        self.assertFalse(projection["identity_auto_promotion_allowed"])
        for target in (
            "master_schema",
            "meaning_network",
            "narrative_agent_graph",
            "audio_sample_cloud",
            "evidence_proliferation_matcher",
            "stats_interpretation",
            "scene_cards",
            "time_bank",
        ):
            self.assertIn(target, projection["motor_targets"])

    def test_source_classes_do_not_create_narrative_agents(self):
        payload = project_confirmed_speaker_prosody(
            "analysis-1",
            corrections={
                "text_substitutions": [{
                    "id": "line-crowd",
                    "raw_value": "[voices]",
                    "target_start_timestamp": 2,
                    "target_end_timestamp": 4,
                    "speaker_confirmation": "Crowd",
                }],
            },
            audio_prosody={
                "cues": [{"cue_id": "cue-crowd", "start": 2, "end": 4}],
            },
        )
        projection = payload["projections"][0]
        self.assertEqual(projection["assignment_kind"], "audio_source_class")
        self.assertFalse(projection["narrative_agent_eligible"])

    def test_unknown_and_non_overlapping_cues_do_not_project(self):
        payload = project_confirmed_speaker_prosody(
            "analysis-1",
            corrections={
                "text_substitutions": [
                    {
                        "id": "unknown",
                        "target_start_timestamp": 0,
                        "target_end_timestamp": 1,
                        "speaker_confirmation": "UNKNOWN",
                    },
                    {
                        "id": "bond",
                        "target_start_timestamp": 10,
                        "target_end_timestamp": 11,
                        "speaker_confirmation": "James Bond",
                    },
                ],
            },
            audio_prosody={
                "cues": [{"cue_id": "cue-early", "start": 2, "end": 3}],
            },
        )
        self.assertEqual(payload["confirmed_span_count"], 1)
        self.assertEqual(payload["projection_count"], 0)


if __name__ == "__main__":
    unittest.main()
