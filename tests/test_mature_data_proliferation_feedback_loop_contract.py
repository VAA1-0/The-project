import json
import sys
import tempfile
import types
import unittest
from pathlib import Path

expression_detector = types.ModuleType("src.backend.analysis.expression_detector")
expression_detector.ExpressionDetectorDeepFace = type(
    "ExpressionDetectorDeepFace", (), {}
)
sys.modules["src.backend.analysis.expression_detector"] = expression_detector

quantitative_analysis = types.ModuleType("src.backend.analysis.quantitative_analysis")


class QuantitativeAnalysis:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def run(self):
        return {}


quantitative_analysis.QuantitativeAnalysis = QuantitativeAnalysis
quantitative_analysis.attach_quant_evidence_to_transcript = (
    lambda transcript, *args, **kwargs: transcript
)
sys.modules["src.backend.analysis.quantitative_analysis"] = quantitative_analysis

from api_server import (
    build_vaa1_master_schema_from_cvat,
    should_run_agent_persistence_for_status,
    write_agent_persistence_artifact_for_status,
)


class MatureDataProliferationFeedbackLoopContractTests(unittest.TestCase):
    """
    Contract tests for the VAA1 maturity loop:

    evidence/corrections -> Master Schema authority -> downstream proliferation
    and UI-consumable indicators, with source traceback preserved.
    """

    def test_master_schema_routes_metadata_manual_bbox_and_audit_for_panel_consumers(self):
        status = {
            "analysis_id": "analysis-mature-loop",
            "source_media_metadata": {"fps": 25, "duration_seconds": 90},
            "source_media_annotations": {
                "title": "No Time To Die trailer",
                "genre": "spy thriller",
                "character_roles": [
                    "James Bond / 007 (Daniel Craig): retired MI6 agent",
                    "Madeleine Swann (Lea Seydoux): psychiatrist and relational anchor",
                    "unknown_speaker",
                ],
                "character_definitions": [
                    {
                        "character_name": "James Bond",
                        "actor_name": "Daniel Craig",
                        "role_labels": ["protagonist", "agent"],
                        "role_description": "Retired MI6 agent pulled back into mission logic.",
                        "relations": ["Madeleine Swann"],
                    }
                ],
                "narrative_agent_profiles": [
                    {
                        "profile_id": "nap:james-bond",
                        "profile_type": "Narrative Agent Profile",
                        "narrative_agent_name": "James Bond",
                        "aliases": ["007"],
                        "source_metadata": {"role_description": "Retired MI6 agent"},
                        "evidence_slots": {"scene_links": [], "visual_patterns": []},
                    }
                ],
            },
            "source_media_web_metadata_sources": [
                {"source_url": "https://example.test/no-time-to-die", "status": "main"}
            ],
            "second_order_label_proliferation": {
                "instructions": [
                    {
                        "instruction_id": "meaning:bond:1",
                        "candidate_label": "James Bond mission return",
                        "time_span": {"start": 0, "end": 12},
                    }
                ]
            },
            "results": {"visual_analysis": {"yolo_results": [{"class_name": "person"}]}},
        }

        master_schema = build_vaa1_master_schema_from_cvat(
            analysis_id="analysis-mature-loop",
            status=status,
            task_id=10,
            job_id=20,
            cvat_annotations={
                "shapes": [
                    {
                        "id": 1,
                        "label_id": "1",
                        "frame": 125,
                        "type": "rectangle",
                        "points": [10, 20, 110, 220],
                        "attributes": [
                            {"name": "identity_affirmation", "value": "James Bond"}
                        ],
                    }
                ],
                "tracks": [],
            },
            label_lookup={"1": "person"},
        )

        self.assertEqual(master_schema["source_context_snapshot"]["title"], "No Time To Die trailer")
        self.assertEqual(len(master_schema["object_annotations"]), 1)
        self.assertEqual(len(master_schema["character_definition_annotations"]), 1)
        self.assertEqual(len(master_schema["narrative_agent_profile_annotations"]), 1)
        self.assertGreaterEqual(len(master_schema["character_role_annotations"]), 2)

        role_labels = [item["label"] for item in master_schema["character_role_annotations"]]
        self.assertIn("James Bond / 007 (Daniel Craig): retired MI6 agent", role_labels)
        self.assertNotIn("unknown_speaker", [item.lower() for item in role_labels])

        profile = master_schema["narrative_agent_profile_annotations"][0]
        self.assertEqual(profile["narrative_agent_name"], "James Bond")
        self.assertEqual(profile["maturity_route"], "master_schema.source_media_narrative_agent_profile_maturity")
        self.assertEqual(profile["provenance"]["source_type"], "mature_metadata")

        obj = master_schema["object_annotations"][0]
        self.assertEqual(obj["label_mapping"]["mapped_label"], "person")
        self.assertIn("geometry", obj)
        self.assertEqual(obj["provenance"]["source_system"], "cvat")

        audit = master_schema["master_schema_maturity_audit"]
        self.assertEqual(audit["audit_schema"], "vaa1.master_schema_maturity_audit.v1")
        self.assertEqual(audit["authority_order"][0], "manual_correction")
        self.assertTrue(audit["confirmation_program"]["consults_user_confirmed_anchor"])
        self.assertGreaterEqual(audit["mature_surfaces"]["object_annotations"], 1)
        self.assertGreaterEqual(audit["mature_surfaces"]["narrative_agent_profile_annotations"], 1)
        self.assertTrue(
            any(
                consumer["panel"] == "VideoPanel BBox / ROIBox"
                and consumer["status"] == "must_consume_master_schema_first"
                for consumer in audit["panel_consumers"]
            )
        )
        self.assertIn(
            "make BBox/ROIBox consume Master Schema mature labels first",
            audit["next_required_hardening"],
        )

    def test_agent_persistence_runs_only_when_scene_cuts_tracks_and_features_are_available(self):
        status = {
            "analysis_id": "analysis-agent-persistence-loop",
            "results": {
                "visual_analysis": {
                    "scene_segments": {
                        "segments": [
                            {"scene_id": "scene-a", "start": 0.0, "end": 10.0},
                            {"scene_id": "scene-b", "start": 10.0, "end": 20.0},
                        ]
                    },
                    "tracked_objects": [
                        {
                            "track_id": "track-7",
                            "class_name": "person",
                            "agent_label": "James Bond",
                            "start": 6.0,
                            "end": 9.8,
                            "face_embedding": [0.9, 0.1, 0.0],
                            "torso_histogram": [0.8, 0.2, 0.0],
                            "feature_cloud_ref": "visual-cloud:bond:pre",
                            "frame_ref": "frame:0099",
                            "bbox_ref": "bbox:track-7:last",
                        },
                        {
                            "track_id": "track-12",
                            "class_name": "person",
                            "start": 10.2,
                            "end": 14.0,
                            "face_embedding": [0.88, 0.12, 0.0],
                            "torso_histogram": [0.78, 0.22, 0.0],
                            "feature_cloud_ref": "visual-cloud:bond:post",
                            "frame_ref": "frame:0110",
                            "bbox_ref": "bbox:track-12:first",
                        },
                    ],
                }
            },
        }

        self.assertTrue(should_run_agent_persistence_for_status(status))

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "agent_persistence_scene_cut.json"
            payload = write_agent_persistence_artifact_for_status(status, output_path)

            self.assertTrue(output_path.exists())
            self.assertEqual(payload["schema"], "vaa1.agent_persistence_bundle.v1")
            self.assertEqual(payload["scene_cut_count"], 1)
            self.assertEqual(payload["track_count"], 2)
            self.assertEqual(payload["summary"]["accepted_count"], 1)
            self.assertEqual(payload["feature_events"][0]["feature_type"], "agent_persistence_scene_cut")
            self.assertEqual(
                payload["feature_events"][0]["evidence_refs"][0]["evidence_kind"],
                "agent_persistence_scene_cut",
            )
            traceback = payload["checks"][0]["matches"][0]["traceback"]
            self.assertEqual(traceback["departed_feature_cloud_ref"], "visual-cloud:bond:pre")
            self.assertEqual(traceback["arrived_feature_cloud_ref"], "visual-cloud:bond:post")

            reloaded = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(reloaded["summary"]["accepted_count"], 1)

    def test_agent_persistence_persists_traceable_empty_artifact_without_comparable_feature_clouds(self):
        status = {
            "analysis_id": "analysis-agent-persistence-skip",
            "results": {
                "visual_analysis": {
                    "scene_segments": {
                        "segments": [
                            {"scene_id": "scene-a", "start": 0.0, "end": 10.0},
                            {"scene_id": "scene-b", "start": 10.0, "end": 20.0},
                        ]
                    },
                    "tracked_objects": [
                        {"track_id": "track-7", "class_name": "person", "start": 6.0, "end": 9.8},
                        {"track_id": "track-12", "class_name": "person", "start": 10.2, "end": 14.0},
                    ],
                }
            },
        }

        self.assertTrue(should_run_agent_persistence_for_status(status))
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "agent_persistence_scene_cut.json"
            payload = write_agent_persistence_artifact_for_status(status, output_path)

            self.assertTrue(output_path.exists())
            self.assertEqual(payload["track_count"], 2)
            self.assertEqual(payload["tracks_with_comparable_features"], 0)
            self.assertEqual(payload["summary"]["candidate_count"], 0)


if __name__ == "__main__":
    unittest.main()
