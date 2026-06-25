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
        self.assertEqual(
            result["open_topology_som"]["schema"],
            "vaa1.open_topology_som_traceable.v1",
        )
        self.assertTrue(result["open_topology_som"]["diagnostic_only"])
        self.assertFalse(result["open_topology_som"]["fixed_grid"])
        self.assertGreaterEqual(len(result["open_topology_som"]["nodes"]), 2)
        self.assertGreaterEqual(len(result["open_topology_som"]["edges"]), 1)
        self.assertTrue(
            all(
                "source_refs" in candidate
                and "similarity_score" in candidate
                and "cluster_context" in candidate
                and "reason_for_match" in candidate
                and "review_required" in candidate
                and "blocked_actions" in candidate
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

    def test_open_topology_refresh_builds_requests_for_agents_objects_entities_and_settings(self):
        status = {
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual-bond",
                        "category": "Identification",
                        "label": "James Bond",
                        "identity_affirmation": "James Bond",
                        "start_seconds": 1.0,
                        "end_seconds": 2.0,
                    },
                    {
                        "id": "manual-car",
                        "category": "OBJ",
                        "label": "Aston Martin",
                        "start_seconds": 3.0,
                        "end_seconds": 4.0,
                    },
                ]
            },
            "source_media_metadata": {
                "user_annotations": {
                    "description": "Bond drives through a cityscape by the sea.",
                    "location_place": "coastal city",
                }
            },
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": "99",
                            "label": "person",
                            "class": "person",
                            "start": 80.0,
                            "end": 82.0,
                            "x": 0.4,
                            "y": 0.1,
                            "width": 0.2,
                            "height": 0.7,
                        },
                        {
                            "track_id": "car-2",
                            "label": "car",
                            "class": "car",
                            "start": 12.0,
                            "end": 14.0,
                        },
                    ],
                    "ocr_results": [
                        {"id": "ocr-1", "text": "MI6 LONDON", "timestamp": 7.0}
                    ],
                }
            },
            "summary": {
                "spatial_tone_scan": [
                    {"id": "setting-sea", "label": "sea", "start": 20.0, "end": 24.0},
                    {"id": "setting-city", "label": "cityscape", "start": 25.0, "end": 30.0},
                ]
            },
        }

        requests = matcher.build_scanner_refresh_requests(
            "analysis-open-topology",
            status,
            limit=12,
        )
        targets = {request["target"] for request in requests}

        self.assertIn("character_continuity", targets)
        self.assertIn("object", targets)
        self.assertIn("named_entity", targets)
        self.assertIn("scene_setting", targets)
        self.assertTrue(
            all(request["governance"]["open_topology_som"] for request in requests)
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            result = matcher.run_open_topology_scanner_refresh(
                "analysis-open-topology",
                status,
                Path(tmpdir),
                request_limit=8,
                candidate_limit=10,
            )

            self.assertEqual(
                result["schema"],
                "vaa1.open_topology_scanner_refresh.v1",
            )
            self.assertEqual(result["status"], "completed")
            self.assertGreaterEqual(result["request_count"], 4)
            self.assertTrue(result["governance"]["diagnostic_only"])
            self.assertTrue(result["governance"]["candidate_is_not_mature_truth"])
            self.assertTrue(
                all(
                    match.get("open_topology_som", {}).get("schema")
                    == "vaa1.open_topology_som_traceable.v1"
                    for match in result["matches"]
                )
            )

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

    def test_character_matcher_rejects_objects_and_known_other_identities(self):
        status = {
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual-madeleine-2",
                        "category": "Identification",
                        "subcategory": "Character",
                        "label": "Dr. Madeleine Swann",
                        "identity_affirmation": "Dr. Madeleine Swann",
                        "start_seconds": 20.0,
                        "end_seconds": 21.0,
                    },
                    {
                        "id": "manual-bond",
                        "category": "Identification",
                        "subcategory": "Character",
                        "label": "James Bond",
                        "identity_affirmation": "James Bond",
                        "start_seconds": 22.0,
                        "end_seconds": 23.0,
                    },
                    {
                        "id": "manual-car",
                        "category": "OBJ",
                        "label": "Old Aston Martin",
                        "start_seconds": 24.0,
                        "end_seconds": 25.0,
                    },
                    {
                        "id": "manual-unknown-person",
                        "category": "Identification",
                        "subcategory": "Character",
                        "label": "person track 5",
                        "start_seconds": 26.0,
                        "end_seconds": 27.0,
                    },
                ]
            }
        }
        request = {
            "request_id": "request-madeleine",
            "target": "character_continuity",
            "scope": "same_video_open_topology",
            "evidence": {
                "overlay_key": "profile:madeleine",
                "label": "Dr. Madeleine Swann",
                "source_label": "Dr. Madeleine Swann",
                "category": "narrative_agent",
            },
        }

        result = matcher.build_evidence_proliferation_match(
            "analysis-1",
            status,
            request,
        )
        labels = {candidate["label"] for candidate in result["candidates"]}

        self.assertIn("Dr. Madeleine Swann", labels)
        self.assertIn("person track 5", labels)
        self.assertNotIn("James Bond", labels)
        self.assertNotIn("Old Aston Martin", labels)
        unknown_person = next(
            candidate
            for candidate in result["candidates"]
            if candidate["label"] == "person track 5"
        )
        self.assertLessEqual(unknown_person["match_probability"], 0.62)
        self.assertEqual(
            unknown_person["closest_match"]["identity_compatibility"],
            "unknown_person",
        )
        direct_match = next(
            candidate
            for candidate in result["candidates"]
            if candidate["label"] == "Dr. Madeleine Swann"
        )
        self.assertEqual(
            direct_match["closest_match"]["identity_compatibility"],
            "direct_identity",
        )
        self.assertEqual(direct_match["candidate_role"], "anchor_sample")
        self.assertFalse(direct_match["decision_required"])
        self.assertNotIn("confirm", direct_match["allowed_actions"])
        self.assertEqual(unknown_person["candidate_role"], "identity_candidate")
        self.assertIn("confirm", unknown_person["allowed_actions"])
        som_nodes = {
            node["node_id"]: node
            for node in result["open_topology_som"]["nodes"]
        }
        self.assertEqual(
            som_nodes[direct_match["candidate_id"]]["candidate_role"],
            "anchor_sample",
        )

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
                "status": "completed_measured",
                "speaker_turns": [
                    {
                        "turn_id": "speaker-turn-1",
                        "speaker_label": "SPEAKER_01",
                        "start": 3.6,
                        "end": 6.5,
                        "text": "statement",
                        "diarization_status": "measured_acoustic_cluster",
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
            any(
                candidate["source_panel"] == "objects_panel"
                and str((candidate.get("raw") or {}).get("track_id")) == "3"
                for candidate in result["candidates"]
            )
        )
        object_candidate = next(
            candidate
            for candidate in result["candidates"]
            if candidate["source_panel"] == "objects_panel"
            and str((candidate.get("raw") or {}).get("track_id")) == "1"
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
        self.assertFalse(candidate["proliferation_allowed"])
        self.assertFalse(candidate["decision_required"])
        self.assertEqual(candidate["candidate_role"], "anchor_sample")
        self.assertEqual(candidate["allowed_actions"], ["inspect_sources"])
        self.assertGreaterEqual(len(candidate["source_anchors"]), 2)
        self.assertIn("bbox_roi_panel", candidate["projection_targets"])
        self.assertIn("traceback_drawer", candidate["projection_targets"])
        self.assertFalse(
            candidate["master_object_projection"]["governance_status"]["review_required"]
        )
        self.assertEqual(
            candidate["master_object_projection"]["authority_level"],
            "manual_annotation",
        )

    def test_cross_scene_manual_anchor_surfaces_for_late_character_confirmation(self):
        status = {
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual:bond:early",
                        "category": "Identification",
                        "label": "James Bond",
                        "identity_affirmation": "James Bond",
                        "coordinates": {"x": 0.32, "y": 0.12, "w": 0.28, "h": 0.68},
                        "start_seconds": 4.9,
                        "end_seconds": 6.1,
                    }
                ]
            },
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": 28,
                            "label": "person",
                            "start": 96.0,
                            "end": 96.2,
                            "x": 0.53,
                            "y": 0.10,
                            "width": 0.28,
                            "height": 0.70,
                        }
                    ]
                }
            },
        }
        request = {
            "request_id": "request-bond-late",
            "target": "character_continuity",
            "scope": "same_video",
            "evidence": {
                "overlay_key": "bbox-confirm-late",
                "label": "Confirm Narrative Agent 93%",
                "source_label": "person",
                "category": "Identification",
                "geometry": {
                    "geometry_type": "bbox",
                    "bbox": {"x": 0.53, "y": 0.10, "width": 0.28, "height": 0.70},
                },
                "interval": {"start": 96.0, "end": 96.2},
            },
        }

        result = matcher.build_evidence_proliferation_match("analysis-1", status, request)

        manual_candidate = next(
            candidate
            for candidate in result["candidates"]
            if candidate["evidence_id"] == "manual:bond:early"
        )
        self.assertEqual(manual_candidate["label"], "James Bond")
        self.assertEqual(manual_candidate["source_verification_class"], "known_verified_sample")
        self.assertTrue(manual_candidate["source_navigation"]["has_time"])
        self.assertTrue(manual_candidate["source_navigation"]["has_bbox"])
        self.assertGreaterEqual(
            manual_candidate["closest_match"]["components"]["cross_scene_continuity"],
            0.72,
        )
        self.assertEqual(
            manual_candidate["closest_match"]["identity_compatibility"],
            "known_identity_option",
        )
        self.assertGreaterEqual(manual_candidate["match_probability"], 0.35)
        self.assertEqual(manual_candidate["candidate_role"], "identity_candidate")
        self.assertIn("confirm", manual_candidate["allowed_actions"])

    def test_character_context_support_is_not_confirmable_identity_evidence(self):
        status = {
            "transcript": {
                "segments": [
                    {
                        "id": "transcript:madeleine:1",
                        "start": 12.0,
                        "end": 13.0,
                        "text": "Madeleine arrives at the clinic.",
                    }
                ]
            }
        }
        request = {
            "request_id": "request-madeleine-context",
            "target": "character_continuity",
            "scope": "same_video",
            "evidence": {
                "overlay_key": "profile:madeleine",
                "label": "Dr. Madeleine Swann",
                "source_label": "Dr. Madeleine Swann",
                "category": "narrative_agent",
            },
        }

        result = matcher.build_evidence_proliferation_match("analysis-1", status, request)

        self.assertEqual(result["candidate_count"], 1)
        candidate = result["candidates"][0]
        self.assertEqual(candidate["candidate_role"], "context_support")
        self.assertFalse(candidate["decision_required"])
        self.assertFalse(candidate["proliferation_allowed"])
        self.assertNotIn("confirm", candidate["allowed_actions"])

    def test_scene_anchor_surfaces_unresolved_person_detections_across_full_video(self):
        tracked_objects = []
        for index in range(40):
            start = float(index * 3)
            tracked_objects.append(
                {
                    "timestamp": start,
                    "start_timestamp": start,
                    "end_timestamp": start + 1.0,
                    "class_id": 0,
                    "class_name": "person",
                    "display_label": f"person track {index + 1}",
                    "confidence": 0.55 + ((index % 5) * 0.05),
                    "occurrence_count": (index % 4) + 1,
                    "track_id": index + 1,
                    "bbox_x1": 320.0,
                    "bbox_y1": 72.0,
                    "bbox_x2": 704.0,
                    "bbox_y2": 648.0,
                }
            )
        status = {
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "known-scene-madeleine",
                        "category": "Identification",
                        "subcategory": "Character",
                        "label": "Dr. Madeleine Swann",
                        "identity_affirmation": "Dr. Madeleine Swann",
                        "start_seconds": 6.0,
                        "end_seconds": 8.0,
                        "coordinates": {"x": 0.25, "y": 0.1, "w": 0.4, "h": 0.8},
                    }
                ]
            },
            "results": {
                "visual_analysis": {
                    "tracked_objects": tracked_objects,
                }
            },
        }
        request = {
            "request_id": "request-scene-anchor-full-video",
            "target": "character_continuity",
            "scope": "same_video_open_topology",
            "evidence": {
                "overlay_key": "profile:madeleine",
                "label": "Dr. Madeleine Swann",
                "source_label": "Dr. Madeleine Swann",
                "category": "narrative_agent",
            },
        }

        result = matcher.build_evidence_proliferation_match(
            "analysis-1",
            status,
            request,
            limit=12,
        )
        identity_candidates = [
            item
            for item in result["candidates"]
            if item["candidate_role"] == "identity_candidate"
        ]
        starts = [item["time"]["start"] for item in identity_candidates]

        self.assertEqual(
            len([item for item in result["candidates"] if item["candidate_role"] == "anchor_sample"]),
            1,
        )
        self.assertGreaterEqual(len(identity_candidates), 8)
        self.assertTrue(all(item["source_kind"] == "detector_substrate" for item in identity_candidates))
        self.assertTrue(
            all(
                (item.get("raw") or {}).get("semantic_status")
                == "unresolved_detector_substrate"
                for item in identity_candidates
            )
        )
        self.assertLess(min(starts), 15.0)
        self.assertGreater(max(starts), 100.0)
        self.assertTrue(
            all(
                0.0 <= item["geometry"]["bbox"]["x"] <= 1.0
                and 0.0 < item["geometry"]["bbox"]["width"] <= 1.0
                for item in identity_candidates
            )
        )


if __name__ == "__main__":
    unittest.main()
