import unittest

from src.backend.analysis.narrative_agent_continuity import build_continuity_inventory


def confirmed(agent, occurrence_id, start, end, track, scene, analysis_id="bond-a"):
    return {
        "analysis_id": analysis_id,
        "project_id": "bond-cop30-helsinki",
        "annotation_corrections": {
            "manual_visual_annotations": [
                {
                    "id": occurrence_id,
                    "category": "Identification",
                    "identity_affirmation": agent,
                    "start_seconds": start,
                    "end_seconds": end,
                    "coordinates": {"x": 0.1, "y": 0.2, "w": 0.2, "h": 0.4},
                    "metadata_correlation": {
                        "target_id": track,
                        "scene_id": scene,
                        "manual_confirmation_event": {
                            "authority_level": "manual_confirmation",
                            "confirmed_fields": {"narrative_agent": True},
                        },
                    },
                }
            ]
        },
    }


class NarrativeAgentContinuityContractTests(unittest.TestCase):
    def test_named_audio_candidate_carries_matching_active_speaker_measurement(self):
        status = confirmed("James Bond", "bond-visual", 55.0, 57.0, "track-7", "scene-1")
        status["audio_sample_clouds"] = {"clouds": [{
            "entity_label": "James Bond",
            "samples": [{
                "sample_id": "bond-line-55",
                "time_start": 55.28,
                "time_end": 56.077,
                "text": "You know what I mean.",
                "confidence": 0.8,
            }],
        }]}
        status["active_speaker_synchrony"] = {"measurements": [{
            "identity_label": "James Bond",
            "source_interval": {"start": 55.28, "end": 56.077},
            "probability": 0.5182,
            "correlation": 0.1886,
        }]}

        result = build_continuity_inventory([status], selected_agent="James Bond", project_id="bond-cop30-helsinki")
        candidate = next(
            row for row in result["selected_continuity_corridor"]["proposed_members"]
            if row["occurrence_id"] == "bond-line-55"
        )

        self.assertEqual(candidate["evidence_modality"], "transcript_audio")
        self.assertEqual(candidate["authority"], "named_audio_sample_candidate")
        self.assertEqual(candidate["transcript_text"], "You know what I mean.")
        self.assertEqual(candidate["scores"]["active_speaker_probability"], 0.5182)
        self.assertTrue(candidate["interpretation_is_candidate_only"])

    def test_source_media_confirmed_roles_are_mature_selected_agent_authority(self):
        status = confirmed("James Bond", "bond-1", 1, 2, "track-1", "scene-1")
        status["source_media_metadata"] = {"user_annotations": {
            "narrative_agent_profiles": [{
                "narrative_agent_name": "James Bond",
                "source_metadata": {"role_labels": ["protagonist", "secret agent"]},
            }],
            "character_roles": ["James Bond (Daniel Craig): protagonist, leading character"],
        }}

        result = build_continuity_inventory([status], selected_agent="James Bond", project_id="bond-cop30-helsinki")

        self.assertEqual(result["selected_agent"]["role_probability"], 1.0)
        self.assertEqual(result["selected_agent"]["confirmed_roles"], ["leading character", "protagonist", "secret agent"])
        self.assertEqual(result["selected_agent"]["role_authority"], "explicit_source_media_metadata_confirmation")

    def test_source_media_metadata_confirms_identity_without_inventing_a_timed_occurrence(self):
        status = {
            "analysis_id": "bond-a",
            "project_id": "bond-cop30-helsinki",
            "source_media_metadata": {
                "user_annotations": {
                    "persons": ["Nomi", "James Bond and Nomi", "Directed by", "Music by JOHN BARRY", "person track 19"],
                    "narrative_agent_profiles": [{"narrative_agent_name": "James Bond"}],
                    "character_definitions": [{"character_name": "Q"}],
                }
            },
        }

        result = build_continuity_inventory(
            [status], selected_agent="Nomi", project_id="bond-cop30-helsinki"
        )

        self.assertEqual(
            {row["narrative_agent_label"] for row in result["confirmed_agents"]},
            {"James Bond", "Nomi", "Q"},
        )
        self.assertTrue(result["selected_agent"]["confirmed_reference_present"])
        self.assertTrue(result["selected_agent"]["metadata_identity_confirmed"])
        self.assertEqual(result["selected_continuity_corridor"]["state"], "source_occurrence_required")
        self.assertEqual(result["confirmed_occurrences"], [])

    def test_confirmed_audio_and_transcript_speaker_occurrences_join_agent_inventory_without_vad_authority(self):
        status = confirmed("James Bond", "bond-visual", 8, 12, "track-7", "scene-1")
        corrections = status["annotation_corrections"]
        corrections["manual_visual_annotations"].append({
            "id": "bond-audio",
            "category": "Audio",
            "identity_affirmation": "James Bond",
            "start_seconds": 8.2,
            "end_seconds": 11.4,
            "metadata_correlation": {
                "target_id": "vad-speaker-01",
                "manual_confirmation_event": {
                    "event_id": "audio-confirm-1",
                    "authority_level": "manual_confirmation",
                    "confirmed_fields": {"narrative_agent": True},
                },
            },
        })
        corrections["text_substitutions"] = [
            {"id": "bond-line", "speaker_confirmation": "James Bond", "target_start_timestamp": 8.2, "target_end_timestamp": 11.4},
            {"id": "crowd-line", "speaker_confirmation": "Crowd", "target_start_timestamp": 12, "target_end_timestamp": 13},
        ]

        result = build_continuity_inventory([status], project_id="bond-cop30-helsinki")
        rows = result["selected_continuity_corridor"]["confirmed_members"]
        self.assertEqual({row["evidence_modality"] for row in rows}, {"visual", "audio", "transcript_audio"})
        self.assertNotIn("crowd-line", {row["occurrence_id"] for row in rows})
        audio = next(row for row in rows if row["occurrence_id"] == "bond-audio")
        self.assertEqual(audio["supporting_audio_ref"], "vad-speaker-01")
        self.assertEqual(audio["authority"], "explicit_analyst_confirmation")
        transcript_audio = next(row for row in rows if row["occurrence_id"] == "bond-line")
        self.assertEqual(transcript_audio["transcript_text"], "")

    def test_james_bond_corridor_preserves_occurrences_and_keeps_track_supporting(self):
        first = confirmed("James Bond", "bond-1", 8, 12, "track-7", "scene-1")
        second = confirmed("James Bond", "bond-2", 74, 81, "track-19", "scene-4", "bond-b")
        second["narrative_agent_recognition_candidates"] = [
            {
                "candidate_id": "bond-candidate-3",
                "narrative_agent_label": "James Bond",
                "start_seconds": 120,
                "end_seconds": 124,
                "scene_id": "scene-6",
                "track_id": "track-31",
                "bbox": {"x": 0.2, "y": 0.1, "w": 0.3, "h": 0.6},
                "scores": {"overall": 0.97, "visual": 0.95, "voice": 0.82},
            }
        ]

        result = build_continuity_inventory(
            [first, second], project_id="bond-cop30-helsinki"
        )

        corridor = result["selected_continuity_corridor"]
        self.assertEqual(corridor["state"], "membership_review")
        self.assertEqual(corridor["continuity_claim"], "not_accepted")
        self.assertEqual(len(corridor["confirmed_members"]), 2)
        self.assertEqual(len(corridor["proposed_members"]), 1)
        self.assertTrue(result["governance"]["tracking_is_supporting_evidence_only"])
        self.assertEqual(
            corridor["confirmed_members"][0]["membership_state"],
            "confirmed_source_occurrence",
        )
        self.assertTrue(result["diagnostics"]["fragmentation"])
        self.assertTrue(result["diagnostics"]["scene_boundary_review"])

    def test_agent_labelled_body_movement_detection_surfaces_as_review_only_membership(self):
        status = confirmed("James Bond", "bond-visual", 8, 12, "track-7", "scene-1")
        status["body_movement_detections"] = [{
            "evidence_id": "movement-candidate-1",
            "narrative_agent_label": "James Bond",
            "movement_type": "turning left",
            "start_seconds": 12.5,
            "end_seconds": 13.2,
            "track_id": "track-7",
            "pose_ref": "pose:375",
            "confidence": 0.81,
            "coordinates": {"x": 0.1, "y": 0.2, "w": 0.2, "h": 0.4},
        }]

        result = build_continuity_inventory([status], project_id="bond-cop30-helsinki")
        proposal = result["selected_continuity_corridor"]["proposed_members"][0]
        self.assertEqual(proposal["occurrence_id"], "movement-candidate-1")
        self.assertEqual(proposal["evidence_modality"], "body_movement")
        self.assertTrue(proposal["interpretation_is_candidate_only"])
        self.assertEqual(proposal["authority"], "precomputed_behavioral_candidate")
        self.assertEqual(result["selected_continuity_corridor"]["continuity_claim"], "not_accepted")

    def test_same_raw_track_with_different_confirmed_agents_is_false_join_risk(self):
        bond = confirmed("James Bond", "bond-1", 43, 46, "track-9", "scene-2")
        nomi = confirmed("Nomi", "nomi-1", 47, 49, "track-9", "scene-2")

        result = build_continuity_inventory([bond, nomi])

        risks = result["diagnostics"]["false_join_risks"]
        self.assertEqual(len(risks), 1)
        self.assertEqual(risks[0]["narrative_agent_keys"], ["james bond", "nomi"])
        self.assertEqual(len(result["confirmed_occurrences"]), 2)

    def test_inventory_fails_closed_across_project_boundaries(self):
        bond = confirmed("James Bond", "bond-1", 1, 2, "track-1", "scene-1")
        foreign = confirmed("Foreign agent", "foreign-1", 1, 2, "track-2", "scene-1")
        foreign["project_id"] = "foreign-project"

        with self.assertRaisesRegex(ValueError, "cannot cross project boundaries"):
            build_continuity_inventory([bond, foreign])

    def test_audio_match_candidates_cannot_bleed_between_artifact_hermeneutic_spaces(self):
        bond = confirmed("Nomi", "nomi-visual", 40, 44, "track-1", "scene-1", "bond-a")
        bond["annotation_corrections"]["manual_visual_annotations"].append({
            "id": "nomi-audio", "category": "Audio", "identity_affirmation": "Nomi",
            "start_seconds": 41.92, "end_seconds": 43.18,
            "metadata_correlation": {"manual_confirmation_event": {"confirmed_fields": {"narrative_agent": True}}},
        })
        bond["audio_sample_clouds"] = {"clouds": [{"entity_label": "SPEAKER_01", "samples": [
            {"sample_id": "bond-window", "time_start": 50, "time_end": 52, "text": "Bond artifact"}
        ]}]}
        galaxy = confirmed("Other", "other-visual", 1, 2, "track-2", "scene-1", "galaxy-a")
        galaxy["audio_sample_clouds"] = {"clouds": [{"entity_label": "SPEAKER_00", "samples": [
            {"sample_id": "galaxy-window", "time_start": 26.16, "time_end": 28.16, "text": "Galaxy Song"}
        ]}]}

        result = build_continuity_inventory(
            [bond, galaxy], selected_agent="Nomi", project_id="bond-cop30-helsinki"
        )
        matching = result["audio_sample_matching"]

        self.assertEqual([row["candidate_id"] for row in matching["suggestions"]], ["bond-window"])
        self.assertEqual(matching["suggestions"][0]["hermeneutic_space_id"], "bond-a")
        self.assertTrue(matching["boundary_policy"]["cross_artifact_candidate_generation_forbidden"])
        self.assertEqual(matching["aggregate_support"]["state"], "awaiting_voice_comparison")
        self.assertIsNone(matching["aggregate_support"]["aggregate_probability"])
        self.assertEqual(matching["active_speaker_synchrony"]["state"], "not_measured")
        self.assertIn("mouth_motion_signal", matching["active_speaker_synchrony"]["required_inputs"])

    def test_distinct_measured_audio_turns_accumulate_but_duplicate_rows_count_once(self):
        bond = confirmed("Nomi", "nomi-visual", 40, 44, "track-1", "scene-1", "bond-a")
        bond["annotation_corrections"]["manual_visual_annotations"].append({
            "id": "nomi-audio", "category": "Audio", "identity_affirmation": "Nomi",
            "start_seconds": 41.92, "end_seconds": 43.18,
            "metadata_correlation": {"manual_confirmation_event": {"confirmed_fields": {"narrative_agent": True}}},
        })
        bond["audio_sample_clouds"] = {"clouds": [{"entity_label": "SPEAKER_01", "samples": [
            {"sample_id": "turn-1-a", "time_start": 50, "time_end": 52, "voice_similarity": .8},
            {"sample_id": "turn-1-duplicate", "time_start": 50, "time_end": 52, "voice_similarity": .75},
            {"sample_id": "turn-2", "time_start": 60, "time_end": 62, "voice_similarity": .7},
        ]}]}

        result = build_continuity_inventory([bond], selected_agent="Nomi", project_id="bond-cop30-helsinki")
        aggregate = result["audio_sample_matching"]["aggregate_support"]

        self.assertEqual(aggregate["probable_match_count"], 3)
        self.assertEqual(aggregate["independent_probable_match_count"], 2)
        self.assertEqual(aggregate["correlated_representation_count"], 1)
        self.assertEqual(aggregate["aggregate_probability"], .88)
        self.assertEqual(aggregate["calibration"], "descriptive_not_auto_maturing")


if __name__ == "__main__":
    unittest.main()
