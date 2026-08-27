import tempfile
import unittest
from pathlib import Path

from api_server import build_analysis_completeness
from src.backend.analysis.full_analysis_manifest import BRANCHES, evaluate_full_analysis_manifest, write_full_analysis_manifest


class AnalysisCompletenessNavigationContractTests(unittest.TestCase):
    def test_missing_artifacts_are_named_and_repairable(self):
        status = {
            "analysis_id": "video-2",
            "pipeline_type": "full",
            "output_files": {},
        }

        completeness = build_analysis_completeness(status)

        self.assertEqual(completeness["overall_state"], "completed_with_gaps")
        self.assertIn("pos_analysis", completeness["missing_branch_ids"])
        self.assertIn("quan_analysis", completeness["missing_branch_ids"])
        self.assertTrue(completeness["can_repair"])

    def test_existing_artifacts_remain_partial_until_parity_is_verified(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            artifact = Path(temp_dir) / "artifact.json"
            artifact.write_text('{"status": "completed_measured"}', encoding="utf-8")
            output_files = {branch[2]: str(artifact) for branch in BRANCHES}
            status = {
                "analysis_id": "video-2",
                "pipeline_type": "full",
                "output_files": output_files,
                "native_statistical_interpretation": {
                    "status": "completed",
                    "findings": [{"finding_id": "f-1"}],
                },
            }

            completeness = build_analysis_completeness(status)

        self.assertEqual(completeness["overall_state"], "completed_with_gaps")
        self.assertGreater(completeness["missing_count"], 0)
        self.assertTrue(all(item["state"] != "computed" for item in completeness["branches"]))

    def test_source_layer_row_parity_verifies_projection_hydration_and_consumer(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            artifact = Path(temp_dir) / "spatial.json"
            payload = {"schema": "vaa1.spatial_tone_measurement.v1", "samples": [{"id": 1}, {"id": 2}]}
            artifact.write_text(__import__("json").dumps(payload), encoding="utf-8")
            status = {
                "analysis_id": "video-2",
                "pipeline_type": "visual_only",
                "output_files": {"spatial_tone_scan": str(artifact)},
                "results": {"visual_analysis": {"spatial_tone_scan": payload}},
                "vaa1_annotation_master_schema": {"foundational_source_layers": {"layers": {
                    "spatial_tone_measurements": {
                        "status": "available", "row_count": 2,
                        "maturity_route": "master_schema.spatial_tone_measurement_maturity",
                    }
                }}},
            }
            manifest = evaluate_full_analysis_manifest(status)
            branch = next(item for item in manifest["branches"] if item["branch_id"] == "spatial_tone_scan")

        self.assertEqual(branch["state"], "computed")
        self.assertTrue(branch["parity_verified"])
        self.assertEqual(branch["projected_row_count"], 2)
        self.assertEqual(branch["hydrated_row_count"], 2)

    def test_row_mismatch_blocks_branch_and_names_evidence(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            artifact = Path(temp_dir) / "adaptive.json"
            payload = {"samples": [{"id": 1}, {"id": 2}]}
            artifact.write_text(__import__("json").dumps(payload), encoding="utf-8")
            status = {
                "analysis_id": "video-2", "pipeline_type": "visual_only",
                "output_files": {"adaptive_visual_scan": str(artifact)},
                "results": {"visual_analysis": {"adaptive_visual_scan": payload}},
                "vaa1_annotation_master_schema": {"foundational_source_layers": {"layers": {
                    "adaptive_temporal_visual_measurements": {
                        "status": "available", "row_count": 1,
                        "maturity_route": "master_schema.adaptive_visual_measurement_maturity",
                    }
                }}},
            }
            branch = next(item for item in evaluate_full_analysis_manifest(status)["branches"] if item["branch_id"] == "adaptive_visual_scan")

        self.assertEqual(branch["state"], "projection_missing")
        self.assertFalse(branch["parity_verified"])
        self.assertIn("artifact_rows=2; projected_rows=1", branch["parity_reason"])

    def test_visual_detection_rows_verify_artifact_hydration_and_consumer(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            objects = [{"track_id": "one"}, {"track_id": "two"}]
            artifact = root / "objects.json"
            artifact.write_text(__import__("json").dumps(objects), encoding="utf-8")
            status = {
                "analysis_id": "video-2", "pipeline_type": "visual_only",
                "output_files": {"tracked_objects_json": str(artifact)},
                "results": {"visual_analysis": {"tracked_objects": objects}},
                "visual_analysis_parity": {"tracked_objects": {"row_count": 2, "consumer_route": "panel.objects.detection_evidence"}},
            }
            branch = next(item for item in evaluate_full_analysis_manifest(status)["branches"] if item["branch_id"] == "tracked_objects")

        self.assertEqual(branch["state"], "computed")
        self.assertTrue(branch["parity_verified"])
        self.assertEqual(branch["hydrated_row_count"], 2)

    def test_audio_rows_verify_artifact_hydration_and_consumer(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            prosody = {"cues": [{"timestamp": 1}, {"timestamp": 2}]}
            artifact = root / "prosody.json"
            artifact.write_text(__import__("json").dumps(prosody), encoding="utf-8")
            status = {
                "analysis_id": "video-2", "pipeline_type": "audio_only",
                "output_files": {"audio_prosody": str(artifact)},
                "results": {"audio_analysis": {"audio_prosody": prosody}},
                "audio_analysis_parity": {"audio_prosody": {"row_count": 2, "consumer_route": "panel.audio.prosody_evidence"}},
            }
            branch = next(item for item in evaluate_full_analysis_manifest(status)["branches"] if item["branch_id"] == "audio_prosody")

        self.assertEqual(branch["state"], "computed")
        self.assertTrue(branch["parity_verified"])

    def test_relational_connectivity_verifies_rows_and_statskit_route(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            native = {
                "relationships": [{"id": "r1"}, {"id": "r2"}],
                "panel_routes": {"statskit": {"status": "operational"}},
            }
            artifact = root / "native.json"
            artifact.write_text(__import__("json").dumps(native), encoding="utf-8")
            status = {
                "analysis_id": "video-2", "pipeline_type": "full",
                "output_files": {"native_statistical_interpretation": str(artifact)},
                "native_statistical_interpretation": native,
            }
            branch = next(item for item in evaluate_full_analysis_manifest(status)["branches"] if item["branch_id"] == "native_statistical_interpretation")

        self.assertEqual(branch["state"], "computed")
        self.assertEqual(branch["consumer_state"], "verified")
        self.assertEqual(branch["row_count"], 2)

    def test_manifest_is_written_atomically_and_survives_reload(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            artifact = root / "artifact.json"
            artifact.write_text('{"schema": "fixture.v1", "status": "completed_measured", "records": [{"id": 1}]}', encoding="utf-8")
            status = {
                "analysis_id": "video-2",
                "pipeline_type": "full",
                "output_files": {branch[2]: str(artifact) for branch in BRANCHES},
            }
            manifest = write_full_analysis_manifest(status, root)
            reloaded = __import__("json").loads((root / "full_analysis_manifest.json").read_text(encoding="utf-8"))

        self.assertEqual(manifest["schema"], "vaa1.full_analysis_manifest.v1")
        self.assertEqual(reloaded["analysis_id"], "video-2")
        self.assertEqual(reloaded["delivery_percentage"], 0.0)
        self.assertTrue(all(item["artifact_checksum"].startswith("sha256:") for item in reloaded["branches"] if item["required"]))


if __name__ == "__main__":
    unittest.main()
