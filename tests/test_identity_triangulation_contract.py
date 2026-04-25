import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load_identity_triangulation_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/identity_triangulation.py"
    )
    spec = importlib.util.spec_from_file_location("identity_triangulation", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


identity_triangulation = load_identity_triangulation_module()


class IdentityTriangulationContractTest(unittest.TestCase):
    def test_audio_visual_metadata_triangulation_allows_candidate_proliferation(self):
        result = identity_triangulation.resolve_identity_triangulation(
            "analysis-1",
            identity_label="James Bond",
            source_media_metadata={
                "user_annotations": {
                    "reference_speakers": [
                        {
                            "speaker_label": "SPEAKER_01",
                            "identity_label": "James Bond",
                        }
                    ]
                }
            },
            visual_sample_clouds={
                "clouds": [
                    {
                        "cloud_id": "visual:bond",
                        "entity_label": "James Bond",
                        "cloud_summary": {
                            "sample_count": 3,
                            "average_confidence": 0.82,
                        },
                        "samples": [{"sample_id": "visual:bond:1"}],
                    }
                ]
            },
            audio_sample_clouds={
                "clouds": [
                    {
                        "cloud_id": "audio:bond",
                        "entity_label": "James Bond",
                        "cloud_summary": {
                            "sample_count": 2,
                            "average_confidence": 0.86,
                        },
                        "samples": [{"sample_id": "audio:bond:1"}],
                    }
                ]
            },
        )

        self.assertEqual(result["schema"], "vaa1.identity_triangulation.v1")
        self.assertEqual(result["status"], "ready_for_proliferation")
        self.assertEqual(result["proliferation_level"], "media_array_candidate")
        self.assertTrue(result["should_proliferate"])
        self.assertTrue(
            result["proliferation_policy"]["may_auto_apply_as_candidate"]
        )
        self.assertFalse(result["proliferation_policy"]["may_auto_confirm"])
        self.assertTrue(result["proliferation_policy"]["requires_analyst_review"])
        self.assertEqual(result["proliferation_policy"]["propagate_as"], "candidate_identity")
        self.assertIn("metadata_reference", result["authority_order"])

    def test_analyst_confirmed_identity_can_propagate_as_confirmed(self):
        result = identity_triangulation.resolve_identity_triangulation(
            "analysis-1",
            identity_label="James Bond",
            source_media_metadata={
                "user_annotations": {
                    "reference_speakers": [
                        {"speaker_label": "SPEAKER_01", "identity_label": "James Bond"}
                    ]
                }
            },
            visual_sample_clouds={
                "clouds": [
                    {
                        "entity_label": "James Bond",
                        "cloud_summary": {"average_confidence": 0.9, "sample_count": 4},
                    }
                ]
            },
            audio_sample_clouds={
                "clouds": [
                    {
                        "entity_label": "James Bond",
                        "cloud_summary": {"average_confidence": 0.9, "sample_count": 4},
                    }
                ]
            },
            manual_annotations=[
                {
                    "annotation_id": "manual-1",
                    "identity_affirmation": "James Bond",
                    "attributes": {"identity_status": "confirmed"},
                }
            ],
        )

        self.assertEqual(result["proliferation_level"], "analyst_confirmed")
        self.assertTrue(result["proliferation_policy"]["may_auto_confirm"])
        self.assertFalse(result["proliferation_policy"]["requires_analyst_review"])
        self.assertEqual(result["proliferation_policy"]["propagate_as"], "confirmed_identity")

    def test_single_modality_audio_match_is_not_enough_to_proliferate(self):
        result = identity_triangulation.resolve_identity_triangulation(
            "analysis-1",
            identity_label="James Bond",
            audio_sample_clouds={
                "clouds": [
                    {
                        "entity_label": "James Bond",
                        "cloud_summary": {
                            "sample_count": 2,
                            "average_confidence": 0.86,
                        },
                    }
                ]
            },
        )

        self.assertEqual(result["status"], "insufficient_evidence")
        self.assertFalse(result["should_proliferate"])
        self.assertEqual(result["modality_count"], 1)
        self.assertEqual(
            result["proliferation_policy"]["propagate_as"],
            "candidate_identity",
        )

    def test_identity_dependent_plan_enriches_labels_without_mutating_geometry_or_time(self):
        triangulation = identity_triangulation.resolve_identity_triangulation(
            "analysis-1",
            identity_label="James Bond",
            source_media_metadata={
                "user_annotations": {
                    "reference_speakers": [
                        {"speaker_label": "SPEAKER_01", "identity_label": "James Bond"}
                    ]
                }
            },
            visual_sample_clouds={
                "clouds": [
                    {
                        "entity_label": "James Bond",
                        "cloud_summary": {"average_confidence": 0.9, "sample_count": 4},
                    }
                ]
            },
            audio_sample_clouds={
                "clouds": [
                    {
                        "entity_label": "James Bond",
                        "cloud_summary": {"average_confidence": 0.9, "sample_count": 4},
                    }
                ]
            },
            manual_annotations=[
                {
                    "annotation_id": "manual-1",
                    "identity_affirmation": "James Bond",
                    "attributes": {"identity_status": "confirmed"},
                }
            ],
        )

        plan = identity_triangulation.build_identity_dependent_proliferation_plan(
            triangulation,
            target_labels=["Interaction", "Movement", "Action", "Audio", "ReportClaim"],
        )

        self.assertEqual(
            plan["schema"],
            "vaa1.identity_dependent_proliferation_plan.v1",
        )
        self.assertEqual(plan["status"], "ready")
        by_label = {item["label"]: item for item in plan["instructions"]}
        self.assertIn("participant_identity_refs", by_label["Interaction"]["allowed_updates"])
        self.assertIn("actor_identity_refs", by_label["Movement"]["allowed_updates"])
        self.assertIn("actor_identity_refs", by_label["Action"]["allowed_updates"])
        self.assertIn("speaker_identity_refs", by_label["Audio"]["allowed_updates"])
        self.assertIn("claim_support_refs", by_label["ReportClaim"]["allowed_updates"])
        for instruction in plan["instructions"]:
            self.assertIn("time_interval", instruction["must_preserve"])
            self.assertIn("geometry", instruction["must_preserve"])
            self.assertNotIn("time_interval", instruction["allowed_updates"])
            self.assertNotIn("geometry", instruction["allowed_updates"])

    def test_unsupported_dependent_label_is_blocked(self):
        triangulation = {
            "schema": "vaa1.identity_triangulation.v1",
            "analysis_id": "analysis-1",
            "identity_label": "James Bond",
            "should_proliferate": True,
            "proliferation_policy": {"propagate_as": "candidate_identity"},
        }

        plan = identity_triangulation.build_identity_dependent_proliferation_plan(
            triangulation,
            target_labels=["UnsupportedLabel"],
        )

        self.assertEqual(plan["instructions"][0]["status"], "blocked")
        self.assertEqual(
            plan["instructions"][0]["reason"],
            "unsupported_dependent_label",
        )
        self.assertEqual(plan["instructions"][0]["forbidden_updates"], ["all"])

    def test_triangulation_bundle_collects_identities_and_writes_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "identity_triangulation_bundle.json"
            payload = identity_triangulation.write_identity_triangulation_bundle(
                "analysis-1",
                output_path,
                source_media_metadata={
                    "user_annotations": {
                        "reference_speakers": [
                            {"speaker_label": "SPEAKER_01", "identity_label": "James Bond"}
                        ],
                        "expected_identities": ["M"],
                    }
                },
                audio_sample_clouds={
                    "clouds": [
                        {
                            "entity_label": "James Bond",
                            "cloud_summary": {"average_confidence": 0.9, "sample_count": 2},
                        }
                    ]
                },
                visual_sample_clouds={
                    "clouds": [
                        {
                            "entity_label": "James Bond",
                            "cloud_summary": {"average_confidence": 0.9, "sample_count": 2},
                        }
                    ]
                },
            )

            self.assertTrue(output_path.exists())
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["schema"], "vaa1.identity_triangulation_bundle.v1")
            self.assertEqual(persisted["identity_count"], 2)
            self.assertIn("James Bond", persisted["identity_labels"])
            self.assertEqual(persisted["proliferation_ready_count"], 1)
            self.assertEqual(
                persisted["dependent_proliferation_plans"][0]["schema"],
                "vaa1.identity_dependent_proliferation_plan.v1",
            )


if __name__ == "__main__":
    unittest.main()
