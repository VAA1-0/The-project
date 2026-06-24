import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load_bus_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/live_mature_data_proliferation_bus.py"
    )
    spec = importlib.util.spec_from_file_location(
        "live_mature_data_proliferation_bus",
        module_path,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


bus = load_bus_module()


class LiveMatureDataProliferationBusTests(unittest.TestCase):
    def test_bus_surfaces_later_opportunities_without_promoting_them(self):
        status = {
            "analysis_id": "analysis-live-bus",
            "saved_analysis_hydration_audit": {
                "hydrated": ["annotation_corrections", "results.visual_analysis.tracked_objects"]
            },
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual-presenter-1",
                        "category": "Identification",
                        "subcategory": "Character",
                        "label": "Presenter",
                        "identity_affirmation": "Presenter",
                        "start_seconds": 0.0,
                        "end_seconds": 2.0,
                        "teaches_regime": True,
                    }
                ],
                "proliferation_decisions": [],
            },
            "source_samples": [
                {
                    "sample_id": "presenter-av-sample-1",
                    "sample_type": "visual_audio",
                    "label": "Presenter source sample",
                    "time_start": 0.0,
                    "time_end": 2.0,
                    "visual": {"path": "presenter_crop.jpg"},
                    "audio": {"path": "presenter_voice.wav"},
                }
            ],
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": "early-person",
                            "class_name": "person",
                            "label": "person",
                            "start": 0.25,
                            "end": 0.75,
                            "confidence": 0.91,
                        },
                        {
                            "track_id": "later-person",
                            "class_name": "person",
                            "label": "person",
                            "start": 22.0,
                            "end": 25.0,
                            "confidence": 0.88,
                        },
                    ]
                }
            },
        }

        audit = bus.build_live_mature_data_proliferation_audit(status)

        self.assertEqual(
            audit["schema"],
            "vaa1.live_mature_data_proliferation_audit.v1",
        )
        self.assertEqual(audit["status"], "audit_ready")
        self.assertTrue(audit["authority_policy"]["candidate_is_not_promotion"])
        self.assertTrue(
            audit["authority_policy"]["promotion_requires_decision_ledger_entry"]
        )
        self.assertEqual(audit["summary"]["manual_seed_count"], 1)
        self.assertEqual(audit["summary"]["source_sample_seed_count"], 1)
        self.assertGreaterEqual(audit["summary"]["candidate_opportunity_count"], 1)
        self.assertEqual(
            audit["summary"]["candidate_opportunity_count"],
            audit["summary"]["blocked_promotion_count"],
        )
        self.assertEqual(
            audit["summary"]["candidate_opportunity_count"],
            audit["summary"]["governed_mature_hypothesis_count"],
        )
        self.assertEqual(
            audit["summary"]["governed_mature_hypothesis_count"],
            audit["summary"]["automatic_review_projection_count"],
        )
        self.assertTrue(
            all(
                opportunity["candidate_is_not_promotion"]
                for opportunity in audit["candidate_opportunities"]
            )
        )
        self.assertTrue(
            all(
                blocked["reason"] == "promotion_decision_required"
                for blocked in audit["blocked_promotions"]
            )
        )
        self.assertTrue(
            all(
                hypothesis["authority_class"] == "governed_mature_hypothesis"
                and hypothesis["maturity_projection_state"] == "review_visible_not_mature"
                and hypothesis["can_project_as_review_pressure"] is True
                and hypothesis["can_override_manual_authority"] is False
                and hypothesis["promotion_requires_decision"] is True
                and hypothesis["candidate_is_not_promotion"] is True
                for hypothesis in audit["governed_mature_hypotheses"]
            )
        )
        self.assertEqual(
            audit["next_required_stage"],
            "P2_PROMOTION_LEDGER_AND_REVIEW_PROJECTION",
        )
        self.assertEqual(status["annotation_corrections"]["proliferation_decisions"], [])

    def test_bus_writes_audit_json_without_mutating_existing_decisions(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "live_bus.json"
            status = {
                "analysis_id": "analysis-write-live-bus",
                "annotation_corrections": {
                    "manual_visual_annotations": [
                        {
                            "id": "manual-bond-1",
                            "category": "Identification",
                            "label": "James Bond",
                            "start_seconds": 1.0,
                            "end_seconds": 2.0,
                        }
                    ],
                    "proliferation_decisions": [
                        {
                            "id": "decision-existing-1",
                            "decision": "deferred",
                            "label": "James Bond",
                        }
                    ],
                },
                "results": {
                    "visual_analysis": {
                        "tracked_objects": [
                            {
                                "track_id": "late-person",
                                "class_name": "person",
                                "label": "person",
                                "start": 10.0,
                                "end": 12.0,
                            }
                        ]
                    }
                },
            }

            before_decisions = list(status["annotation_corrections"]["proliferation_decisions"])
            audit = bus.write_live_mature_data_proliferation_audit(status, output_path)
            disk_payload = json.loads(output_path.read_text(encoding="utf-8"))

            self.assertTrue(output_path.exists())
            self.assertEqual(disk_payload["schema"], audit["schema"])
            self.assertEqual(
                status["annotation_corrections"]["proliferation_decisions"],
                before_decisions,
            )
            self.assertEqual(audit["summary"]["promotion_decision_count"], 1)
            self.assertGreaterEqual(audit["summary"]["candidate_opportunity_count"], 1)
            self.assertEqual(
                audit["summary"]["candidate_opportunity_count"],
                audit["summary"]["governed_mature_hypothesis_count"],
            )

    def test_governed_hypotheses_project_review_pressure_not_mature_truth(self):
        status = {
            "analysis_id": "analysis-hypothesis-live-bus",
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual-sari-1",
                        "category": "Identification",
                        "label": "Sari",
                        "identity_affirmation": "Sari presenter",
                        "start_seconds": 3.0,
                        "end_seconds": 4.0,
                    }
                ],
                "proliferation_decisions": [],
            },
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": "later-sari-presenter",
                            "class_name": "person",
                            "label": "Sari presenter",
                            "start": 30.0,
                            "end": 33.0,
                            "confidence": 0.81,
                        }
                    ]
                }
            },
        }

        before_decisions = list(status["annotation_corrections"]["proliferation_decisions"])
        audit = bus.build_live_mature_data_proliferation_audit(status)
        hypotheses = audit["governed_mature_hypotheses"]

        self.assertGreaterEqual(len(hypotheses), 1)
        self.assertEqual(audit["summary"]["governed_mature_hypothesis_count"], len(hypotheses))
        self.assertEqual(audit["summary"]["automatic_review_projection_count"], len(hypotheses))
        self.assertTrue(audit["authority_policy"]["governed_hypothesis_is_not_confirmed_mature"])
        self.assertTrue(audit["authority_policy"]["governed_hypothesis_projects_review_pressure"])
        self.assertTrue(
            all(
                hypothesis["authority"] == "system_supported_hypothesis"
                and hypothesis["review_badge"] == "needs_review"
                and hypothesis["promotion_ledger"]
                == "annotation_corrections.proliferation_decisions"
                for hypothesis in hypotheses
            )
        )
        self.assertEqual(
            status["annotation_corrections"]["proliferation_decisions"],
            before_decisions,
        )

    def test_content_scene_entity_and_news_lower_third_cascade_into_live_bus(self):
        status = {
            "analysis_id": "analysis-news-cascade",
            "source_media_metadata": {
                "user_annotations": {
                    "genre": "news report",
                    "genre_subtype": "current affairs",
                    "location_city": "Belem",
                    "situation_event": "COP30 climate summit",
                },
                "field_confidences": {
                    "genre": 0.96,
                    "location_city": 0.91,
                },
            },
            "mise_en_scene_scene_cards": {
                "scene_cards": [
                    {
                        "scene_id": "analysis-news-cascade:scene:001",
                        "start": 10.0,
                        "end": 20.0,
                        "items": [
                            {
                                "label": "COP30 climate summit",
                                "category": "subject_domain",
                                "symbol": "✓",
                            }
                        ],
                    }
                ]
            },
            "results": {
                "visual_analysis": {
                    "ocr_results": [
                        {
                            "id": "ocr-lower-third-1",
                            "timestamp": 12.0,
                            "text": "MARIA SILVA COP30 BELEM",
                            "confidence": 0.93,
                        }
                    ],
                    "tracked_objects": [
                        {
                            "track_id": "maria-person-track",
                            "class_name": "person",
                            "label": "person",
                            "start": 12.2,
                            "end": 18.0,
                            "confidence": 0.87,
                        }
                    ],
                }
            },
            "evidence_proliferation_matches": [
                {
                    "request_id": "entity-match-maria",
                    "label": "Maria Silva",
                    "category": "PERSON_NAME",
                    "source_panel": "entity_registry",
                    "overall_score": 0.89,
                }
            ],
            "annotation_corrections": {
                "manual_visual_annotations": [],
                "proliferation_decisions": [],
            },
        }

        audit = bus.build_live_mature_data_proliferation_audit(status)
        summary = audit["summary"]

        self.assertGreaterEqual(summary["content_derived_mature_observation_count"], 3)
        self.assertEqual(summary["genre_rule_observation_count"], 1)
        self.assertEqual(summary["proposed_audiovisual_sample_count"], 1)
        self.assertEqual(summary["entity_match_candidate_count"], 1)
        self.assertGreaterEqual(summary["governed_mature_hypothesis_count"], 1)
        self.assertTrue(
            audit["authority_policy"][
                "content_derived_metadata_can_project_mature_with_confidence"
            ]
        )
        self.assertTrue(
            audit["authority_policy"]["entity_matches_must_surface_proliferation_bus"]
        )
        self.assertTrue(
            audit["authority_policy"]["genre_knowns_can_seed_governed_proliferation"]
        )
        self.assertEqual(
            audit["genre_rule_observations"][0]["genre_rule_id"],
            "news_lower_third_ocr_entities_are_on_screen",
        )
        self.assertEqual(
            audit["proposed_audiovisual_samples"][0]["creation_state"],
            "proposed_for_source_sampler",
        )
        self.assertTrue(
            any(
                opportunity.get("source_kind") == "entity_match"
                and opportunity.get("surfaces_proliferation_bus") is True
                for opportunity in audit["candidate_opportunities"]
            )
        )

    def test_manual_decision_can_drop_individual_candidate_from_live_bus(self):
        status = {
            "analysis_id": "analysis-drop-candidate",
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual-presenter",
                        "category": "Identification",
                        "label": "Presenter",
                        "start_seconds": 0.0,
                        "end_seconds": 1.0,
                    }
                ],
                "proliferation_decisions": [
                    {
                        "decision_id": "drop:candidate:tracked_object:later-person",
                        "candidate_id": "tracked_object:later-person",
                        "decision": "canceled",
                        "decision_scope": "candidate",
                    }
                ],
            },
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": "later-person",
                            "class_name": "person",
                            "label": "person",
                            "start": 12.0,
                            "end": 14.0,
                        }
                    ]
                }
            },
        }

        audit = bus.build_live_mature_data_proliferation_audit(status)

        self.assertEqual(audit["summary"]["governed_mature_hypothesis_count"], 0)
        self.assertEqual(audit["summary"]["candidate_opportunity_count"], 0)
        self.assertEqual(audit["summary"]["suppressed_candidate_opportunity_count"], 1)
        self.assertEqual(
            audit["suppressed_candidate_opportunities"][0]["suppression_reason"],
            "candidate_canceled_by_analyst",
        )
        self.assertTrue(
            audit["suppressed_candidate_opportunities"][0][
                "manual_annotation_principle_applied"
            ]
        )

    def test_late_central_person_confirmation_need_launches_scanner_matcher(self):
        status = {
            "analysis_id": "analysis-central-person-confirmation-need",
            "duration_seconds": 150.0,
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual-reporter-track-64",
                        "category": "Identification",
                        "label": "Justin Rowlatt, news reporter",
                        "identity_affirmation": "Justin Rowlatt, news reporter",
                        "metadata_correlation": {
                            "target_type": "object",
                            "target_id": "64",
                            "target_label": "person track 64",
                        },
                        "start_seconds": 60.0,
                        "end_seconds": 124.0,
                    }
                ],
                "proliferation_decisions": [],
            },
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": "64",
                            "class_name": "person",
                            "label": "person",
                            "start": 60.0,
                            "end": 124.0,
                            "confidence": 0.95,
                            "bbox": {
                                "x1": 540,
                                "y1": 120,
                                "x2": 1300,
                                "y2": 1040,
                            },
                        },
                        {
                            "track_id": "162",
                            "class_name": "person",
                            "label": "person",
                            "start": 142.4,
                            "end": 148.1,
                            "confidence": 0.97,
                            "occurrence_count": 174,
                            "bbox": {
                                "x1": 259,
                                "y1": 10,
                                "x2": 821,
                                "y2": 608,
                            },
                        },
                    ]
                }
            },
        }

        audit = bus.build_live_mature_data_proliferation_audit(status)
        needs = audit["confirmation_needs"]
        requests = audit["scanner_matcher_launch_requests"]

        self.assertEqual(audit["summary"]["confirmation_need_count"], 1)
        self.assertEqual(audit["summary"]["scanner_matcher_launch_request_count"], 1)
        self.assertTrue(audit["authority_policy"]["confirmation_needs_launch_scanner_matcher"])
        self.assertTrue(
            audit["authority_policy"]["som_open_topology_scanner_is_diagnostic_not_authority"]
        )
        self.assertEqual(needs[0]["source_ref"], "162")
        self.assertIn("late_video_central_person", needs[0]["trigger_reasons"])
        self.assertEqual(
            needs[0]["confirmation_state"],
            "needs_scanner_matcher_support",
        )
        self.assertEqual(
            requests[0]["matcher_endpoint"],
            "/api/analysis/analysis-central-person-confirmation-need/proliferation/match",
        )
        self.assertEqual(requests[0]["launch_state"], "queued_for_diagnostic_scan")
        self.assertTrue(requests[0]["request_payload"]["governance"]["diagnostic_only"])
        self.assertTrue(requests[0]["candidate_is_not_promotion"])

    def test_manual_narrative_agent_identity_creates_audiovisual_memory_for_late_continuity(self):
        status = {
            "analysis_id": "analysis-bond-identity-memory",
            "duration_seconds": 180.0,
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual-bond-tux",
                        "category": "Identification",
                        "label": "James Bond",
                        "identity_affirmation": "James Bond",
                        "start_seconds": 8.0,
                        "end_seconds": 12.0,
                        "metadata_correlation": {
                            "target_type": "object",
                            "target_id": "7",
                            "bbox": {"x": 0.42, "y": 0.12, "w": 0.21, "h": 0.68},
                        },
                    },
                    {
                        "id": "manual-bond-coat",
                        "category": "Identification",
                        "label": "James Bond",
                        "identity_affirmation": "James Bond",
                        "start_seconds": 74.0,
                        "end_seconds": 81.0,
                        "metadata_correlation": {
                            "target_type": "object",
                            "target_id": "19",
                            "bbox": {"x": 0.28, "y": 0.18, "w": 0.26, "h": 0.72},
                        },
                    },
                ],
                "proliferation_decisions": [],
            },
            "transcript_segments": [
                {
                    "id": "line-bond-1",
                    "start": 8.2,
                    "end": 11.4,
                    "speaker": "James Bond",
                    "text": "Bond. James Bond.",
                }
            ],
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": "7",
                            "class_name": "person",
                            "label": "person",
                            "start": 8.0,
                            "end": 12.0,
                            "confidence": 0.94,
                            "bbox": {"x1": 806, "y1": 130, "x2": 1210, "y2": 865},
                        },
                        {
                            "track_id": "99",
                            "class_name": "person",
                            "label": "person",
                            "start": 170.0,
                            "end": 178.0,
                            "confidence": 0.96,
                            "occurrence_count": 121,
                            "bbox": {"x1": 720, "y1": 98, "x2": 1215, "y2": 1010},
                        },
                    ]
                }
            },
        }

        audit = bus.build_live_mature_data_proliferation_audit(status)
        memories = audit["narrative_agent_identity_memories"]
        candidates = audit["identity_continuity_candidates"]

        self.assertEqual(audit["summary"]["narrative_agent_identity_memory_count"], 1)
        self.assertEqual(audit["summary"]["identity_continuity_candidate_count"], 1)
        self.assertTrue(
            audit["authority_policy"]["narrative_agent_identity_memory_is_audiovisual"]
        )
        self.assertTrue(
            audit["authority_policy"]["central_character_requires_multiple_visual_samples"]
        )
        self.assertTrue(
            audit["authority_policy"][
                "constellational_scanning_uses_manual_audio_visual_and_context"
            ]
        )
        memory = memories[0]
        self.assertEqual(memory["canonical_label"], "James Bond")
        self.assertEqual(memory["manual_anchor_count"], 2)
        self.assertGreaterEqual(len(memory["visual_sample_slots"]), 2)
        self.assertGreaterEqual(len(memory["audio_sample_slots"]), 1)
        self.assertGreaterEqual(len(memory["audiovisual_sample_slots"]), 2)
        self.assertTrue(memory["sample_policy"]["audiovisual_sample_required"])
        self.assertTrue(memory["sample_policy"]["multiple_visual_samples_required"])
        self.assertIn(
            "voice_similarity",
            memory["constellational_matching_policy"]["allowed_match_basis"],
        )
        self.assertIn(
            "appearance_similarity",
            memory["constellational_matching_policy"]["allowed_match_basis"],
        )
        self.assertEqual(candidates[0]["candidate_label"], "James Bond")
        self.assertEqual(candidates[0]["target_source_ref"], "99")
        self.assertTrue(candidates[0]["promotion_requires_decision"])
        self.assertTrue(candidates[0]["candidate_is_not_promotion"])

    def test_manual_decision_can_drop_confirmable_cluster_from_live_bus(self):
        base_status = {
            "analysis_id": "analysis-drop-cluster",
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual-presenter",
                        "category": "Identification",
                        "label": "Presenter",
                        "start_seconds": 0.0,
                        "end_seconds": 1.0,
                    }
                ],
                "proliferation_decisions": [],
            },
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": "later-person-a",
                            "class_name": "person",
                            "label": "person",
                            "start": 12.0,
                            "end": 14.0,
                        },
                        {
                            "track_id": "later-person-b",
                            "class_name": "person",
                            "label": "person",
                            "start": 18.0,
                            "end": 20.0,
                        },
                    ]
                }
            },
        }
        first_audit = bus.build_live_mature_data_proliferation_audit(base_status)
        cluster_key = first_audit["candidate_opportunities"][0]["cluster_key"]

        base_status["annotation_corrections"]["proliferation_decisions"] = [
            {
                "decision_id": f"drop:cluster:{cluster_key}",
                "candidate_id": cluster_key,
                "cluster_key": cluster_key,
                "decision": "canceled",
                "decision_scope": "cluster",
            }
        ]
        audit = bus.build_live_mature_data_proliferation_audit(base_status)

        self.assertEqual(audit["summary"]["governed_mature_hypothesis_count"], 0)
        self.assertEqual(audit["summary"]["candidate_opportunity_count"], 0)
        self.assertEqual(audit["summary"]["suppressed_candidate_opportunity_count"], 2)
        self.assertTrue(
            all(
                item["suppression_reason"] == "cluster_canceled_by_analyst"
                for item in audit["suppressed_candidate_opportunities"]
            )
        )


if __name__ == "__main__":
    unittest.main()
