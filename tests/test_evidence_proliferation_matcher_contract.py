import importlib.util
import tempfile
import unittest
from pathlib import Path


def load_matcher_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/evidence_proliferation_matcher.py"
    )
    spec = importlib.util.spec_from_file_location(
        "evidence_proliferation_matcher",
        module_path,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


matcher = load_matcher_module()


class EvidenceProliferationMatcherContractTest(unittest.TestCase):
    def test_matcher_returns_candidate_evidence_without_mutating_authority(self):
        status = {
            "vaa1_annotation_master_schema": {
                "categories": {
                    "Identification": [
                        {
                            "id": "manual-ident-1",
                            "label": "Justin Rowlatt, news reporter",
                            "start": 10.0,
                            "end": 16.0,
                        }
                    ]
                }
            },
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": 64,
                            "label": "person track 64",
                            "start": 63.5,
                            "end": 124.5,
                            "x": 0.2,
                            "y": 0.1,
                            "width": 0.4,
                            "height": 0.7,
                        }
                    ],
                    "ocr_results": [
                        {"text": "Justin Rowlatt BBC Climate Editor", "timestamp": 14.0}
                    ],
                }
            },
        }
        request = {
            "request_id": "request-1",
            "target": "character_continuity",
            "scope": "same_video",
            "evidence": {
                "overlay_key": "manual-ident-1",
                "label": "Justin Rowlatt, news reporter",
                "source_label": "person track 64",
                "category": "Identification",
                "interval": {"start": 10.0, "end": 16.0},
            },
            "governance": {"manual_correction_wins": True},
        }

        result = matcher.build_evidence_proliferation_match(
            "analysis-1",
            status,
            request,
        )

        self.assertEqual(result["schema"], "vaa1.evidence_proliferation_match.v1")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["progress"]["request_preparation"], 100)
        self.assertEqual(result["progress"]["candidate_matching"], 100)
        self.assertGreaterEqual(result["candidate_count"], 1)
        self.assertTrue(result["governance"]["manual_correction_wins"])
        self.assertTrue(
            result["governance"]["proliferated_candidates_do_not_mutate_source_evidence"]
        )
        self.assertTrue(
            result["governance"]["outputs_are_candidates_until_supported_by_evidence"]
        )
        self.assertTrue(
            any(
                candidate["source_panel"] in {"objects_panel", "ocr_panel"}
                for candidate in result["candidates"]
            )
        )
        self.assertEqual(
            result["governance_schema"],
            "vaa1.mature_data_proliferation_governance.v1",
        )
        self.assertIn("probability_policy", result)
        self.assertTrue(result["governance"]["near_matches_surface_to_analyst"])
        self.assertTrue(result["governance"]["near_matches_require_confirm_or_cancel"])
        self.assertTrue(
            all(
                "master_object_projection" in candidate
                and "governance_status" in candidate["master_object_projection"]
                for candidate in result["candidates"]
            )
        )
        self.assertTrue(
            all(
                candidate["review_state"]
                in {
                    "candidate_manual_source",
                    "review_candidate",
                    "to_be_confirmed_or_canceled",
                    "very_high_probability_candidate",
                    "below_surface_candidate",
                }
                for candidate in result["candidates"]
            )
        )

    def test_matcher_writes_json_ledger(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "match.json"
            result = matcher.write_evidence_proliferation_match(
                "analysis-1",
                {"results": {"visual_analysis": {"tracked_objects": [{"label": "gun"}]}}},
                {
                    "request_id": "request-2",
                    "target": "object",
                    "evidence": {"label": "gun", "category": "Object"},
                },
                output_path,
            )

            self.assertTrue(output_path.exists())
            self.assertEqual(result["candidate_count"], 1)

    def test_matcher_reads_manual_visual_annotation_corrections(self):
        status = {
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "analysis:object-indication:person:3.733:1166",
                        "category": "Identification",
                        "subcategory": "Character",
                        "label": "Sari Multala",
                        "identity_affirmation": "Sari Multala",
                        "coordinates": {"x": 0.19, "y": 0.0, "w": 0.33, "h": 0.56},
                        "start_seconds": 3.733,
                        "end_seconds": 3.734,
                    },
                    {
                        "id": "analysis:object-indication:person:4.367:1180",
                        "category": "Identification",
                        "subcategory": "Character",
                        "label": "Sari Multala",
                        "identity_affirmation": "Sari Multala",
                        "coordinates": {"x": 0.40, "y": 0.0, "w": 0.57, "h": 0.98},
                        "start_seconds": 4.367,
                        "end_seconds": 4.467,
                    },
                ]
            }
        }
        request = {
            "request_id": "request-3",
            "target": "character_continuity",
            "scope": "same_video",
            "evidence": {
                "overlay_key": "analysis:object-indication:person:3.733:1166",
                "label": "Sari Multala",
                "source_label": "person",
                "category": "Identification",
                "interval": {"start": 3.733, "end": 3.734},
            },
        }

        result = matcher.build_evidence_proliferation_match(
            "analysis-1",
            status,
            request,
        )

        self.assertEqual(result["candidate_count"], 1)
        candidate = result["candidates"][0]
        self.assertEqual(candidate["source_panel"], "manual_visual_annotations")
        self.assertEqual(candidate["label"], "Sari Multala")
        self.assertEqual(candidate["time"]["start"], 4.367)
        self.assertEqual(candidate["geometry"]["bbox"]["width"], 0.57)

    def test_character_proliferation_triangulates_person_tracks_with_context(self):
        status = {
            "source_media_metadata": {
                "user_annotations": {
                    "reference_people": [
                        {
                            "identity_label": "Sari Multala",
                            "role": "Finnish public official",
                        }
                    ],
                    "description": "Sari Multala gives a statement to Yle Uutiset.",
                }
            },
            "transcript": {
                "segments": [
                    {
                        "id": "transcript:statement:1",
                        "start": 3.6,
                        "end": 6.5,
                        "speaker": "SPEAKER_01",
                        "text": "No, nyt nayttaa silta, etta olemme saamassa tekstin jossa otetaan askeleita eteenpain.",
                    }
                ]
            },
            "audio_diarization": {
                "speaker_turns": [
                    {
                        "turn_id": "speaker-turn-1",
                        "speaker_label": "SPEAKER_01",
                        "start": 3.6,
                        "end": 6.5,
                        "text": "statement",
                    }
                ]
            },
            "audio_sample_clouds": {
                "clouds": [
                    {
                        "entity_label": "Sari Multala",
                        "samples": [
                            {
                                "sample_id": "audio-sample-sari-1",
                                "speaker_label": "SPEAKER_01",
                                "time_start": 3.6,
                                "time_end": 6.5,
                                "transcript_text": "statement",
                            }
                        ],
                    }
                ]
            },
            "visual_sample_clouds": {
                "clouds": [
                    {
                        "cloud_id": "visual:sari",
                        "entity_label": "Sari Multala",
                        "cloud_summary": {"average_confidence": 0.88, "sample_count": 1},
                        "samples": [
                            {
                                "sample_id": "visual-sample-sari-1",
                                "timestamp_start": 3.733,
                                "timestamp_end": 3.833,
                                "bbox": {"x": 0.34, "y": 0.02, "w": 0.32, "h": 0.78},
                                "source_type": "manual_identification",
                                "confidence": 0.88,
                                "epistemic_status": "likely",
                            }
                        ],
                    }
                ]
            },
            "summary": {
                "cinematic_clues": {
                    "shot_size": {
                        "samples": [
                            {
                                "evidence_id": "cinematic:closeup:sari",
                                "timestamp": 3.8,
                                "label": "close_up",
                                "person_count": 1,
                            }
                        ]
                    }
                },
                "spatial_tone_scan": {
                    "samples": [
                        {
                            "id": "visual:centered-speaker",
                            "timestamp": 3.8,
                            "label": "centered speaker",
                        }
                    ]
                },
            },
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": 1,
                            "label": "person",
                            "start": 3.733,
                            "end": 3.833,
                            "x": 0.34,
                            "y": 0.02,
                            "width": 0.32,
                            "height": 0.78,
                        },
                        {
                            "track_id": 2,
                            "label": "person",
                            "start": 5.0,
                            "end": 5.1,
                            "x": 0.35,
                            "y": 0.02,
                            "width": 0.31,
                            "height": 0.77,
                        },
                        {
                            "track_id": 3,
                            "label": "person",
                            "start": 3.733,
                            "end": 3.833,
                            "x": 0.02,
                            "y": 0.55,
                            "width": 0.12,
                            "height": 0.28,
                        },
                    ]
                }
            },
        }
        request = {
            "request_id": "request-4",
            "target": "character_continuity",
            "scope": "same_video",
            "evidence": {
                "overlay_key": "analysis:object-indication:person:3.733:1166",
                "label": "Sari Multala",
                "source_label": "person",
                "category": "Identification",
                "source_track_id": "1",
                "geometry": {
                    "geometry_type": "bbox",
                    "coordinate_system": "normalized",
                    "bbox": {"x": 0.34, "y": 0.02, "width": 0.32, "height": 0.78},
                },
                "interval": {"start": 3.733, "end": 3.833},
            },
        }

        result = matcher.build_evidence_proliferation_match(
            "analysis-1",
            status,
            request,
        )
        source_panels = {candidate["source_panel"] for candidate in result["candidates"]}

        self.assertGreaterEqual(result["candidate_count"], 6)
        self.assertIn("objects_panel", source_panels)
        self.assertIn("transcript_panel", source_panels)
        self.assertIn("source_media_metadata", source_panels)
        self.assertIn("audio_panel", source_panels)
        self.assertIn("visual_sample_cloud", source_panels)
        self.assertIn("visual_cues", source_panels)
        self.assertIn("cinematic_clues", source_panels)
        self.assertTrue(
            any(
                candidate["label"] == "person"
                and candidate["source_panel"] == "objects_panel"
                for candidate in result["candidates"]
            )
        )
        self.assertFalse(
            any(candidate["evidence_id"] == "object:3" for candidate in result["candidates"])
        )
        object_candidate = next(
            candidate for candidate in result["candidates"] if candidate["evidence_id"] == "object:1"
        )
        self.assertGreaterEqual(object_candidate["match_probability"], 0.55)
        self.assertEqual(object_candidate["closest_match"]["principle"], "closest_match")
        self.assertGreater(
            object_candidate["closest_match"]["components"]["spatial_consistency"],
            0.8,
        )
        visual_sample = next(
            candidate
            for candidate in result["candidates"]
            if candidate["source_panel"] == "visual_sample_cloud"
        )
        self.assertGreaterEqual(
            visual_sample["closest_match"]["components"]["sample_cloud_support"],
            0.8,
        )

    def test_near_matches_surface_for_confirm_or_cancel_without_silent_proliferation(self):
        status = {
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": 8,
                            "label": "person",
                            "start": 12.0,
                            "end": 12.2,
                            "x": 0.32,
                            "y": 0.1,
                            "width": 0.3,
                            "height": 0.7,
                        }
                    ]
                }
            }
        }
        request = {
            "request_id": "request-near",
            "target": "character_continuity",
            "scope": "same_video",
            "evidence": {
                "overlay_key": "manual:origin",
                "label": "Confirmed suited agent",
                "source_label": "person",
                "category": "Identification",
                "geometry": {
                    "geometry_type": "bbox",
                    "bbox": {"x": 0.3, "y": 0.1, "width": 0.3, "height": 0.7},
                },
                "interval": {"start": 10.0, "end": 10.2},
            },
        }

        result = matcher.build_evidence_proliferation_match("analysis-1", status, request)

        self.assertEqual(result["candidate_count"], 1)
        candidate = result["candidates"][0]
        self.assertEqual(candidate["probability_band"], "probable_candidate")
        self.assertTrue(candidate["decision_required"])
        self.assertFalse(candidate["proliferation_allowed"])
        self.assertEqual(candidate["review_state"], "to_be_confirmed_or_canceled")
        self.assertIn("confirm", candidate["allowed_actions"])
        self.assertIn("cancel", candidate["allowed_actions"])
        projection = candidate["master_object_projection"]
        self.assertEqual(projection["schema"], "vaa1.mature_data_proliferation_governance.v1")
        self.assertTrue(projection["governance_status"]["review_required"])
        self.assertFalse(projection["governance_status"]["proliferation_allowed"])
        self.assertGreaterEqual(len(projection["source_anchors"]), 2)
        self.assertIn("bbox_roi_panel", projection["projection_targets"])
        self.assertGreaterEqual(len(candidate["situational_options"]), 1)
        self.assertFalse(candidate["situational_options"][0]["proliferation_allowed"])

    def test_manual_source_candidate_can_proliferate_when_traceable(self):
        status = {
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual:bond:2",
                        "category": "Identification",
                        "label": "James Bond",
                        "identity_affirmation": "James Bond",
                        "coordinates": {"x": 0.31, "y": 0.1, "w": 0.3, "h": 0.7},
                        "start_seconds": 8.0,
                        "end_seconds": 8.1,
                    }
                ]
            }
        }
        request = {
            "request_id": "request-manual",
            "target": "character_continuity",
            "evidence": {
                "overlay_key": "manual:bond:1",
                "label": "James Bond",
                "source_label": "person",
                "category": "Identification",
                "interval": {"start": 8.0, "end": 8.1},
            },
        }

        result = matcher.build_evidence_proliferation_match("analysis-1", status, request)

        self.assertEqual(result["candidate_count"], 1)
        candidate = result["candidates"][0]
        self.assertEqual(candidate["review_state"], "candidate_manual_source")
        self.assertTrue(candidate["proliferation_allowed"])
        self.assertFalse(candidate["decision_required"])
        self.assertEqual(
            candidate["master_object_projection"]["authority_level"],
            "manual_annotation",
        )


if __name__ == "__main__":
    unittest.main()
