import json
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "backend"
    / "analysis"
    / "saved_analysis_hydration_loader.py"
)

spec = importlib.util.spec_from_file_location(
    "saved_analysis_hydration_loader",
    MODULE_PATH,
)
saved_analysis_hydration_loader = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(saved_analysis_hydration_loader)

hydrate_saved_analysis_status = (
    saved_analysis_hydration_loader.hydrate_saved_analysis_status
)


class SavedAnalysisHydrationLoaderTests(unittest.TestCase):
    def write_json(self, path: Path, payload):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload), encoding="utf-8")

    def test_hydrates_saved_artifacts_into_canonical_status(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            results_dir = Path(tmpdir)
            analysis_id = "analysis-hydration"
            analysis_dir = results_dir / analysis_id
            status = {
                "analysis_id": analysis_id,
                "output_files": {},
                "results": {},
            }

            tracked_objects = [
                {
                    "track_id": "track-1",
                    "class_name": "person",
                    "timestamp": 12.0,
                }
            ]
            corrections = {
                "analysis_id": analysis_id,
                "manual_visual_annotations": [
                    {
                        "id": "manual-1",
                        "label": "Presenter",
                        "timestamp_seconds": 0,
                        "teaches_regime": True,
                    }
                ],
                "proliferation_decisions": [],
            }
            sample = {
                "sample_id": "sample-1",
                "sample_type": "visual_audio",
                "time_start": 0,
                "time_end": 2,
            }
            match = {
                "schema": "vaa1.evidence_proliferation_match.v1",
                "request_id": "request-1",
                "status": "completed",
                "candidate_count": 1,
                "created_at": "2026-06-10T00:00:00+00:00",
                "candidates": [{"candidate_id": "candidate-1"}],
            }

            self.write_json(analysis_dir / "tracked_objects.json", tracked_objects)
            shot_boundaries = {
                "schema": "vaa1.shot_boundaries.v1",
                "intervals": [{"shot_id": "shot-1", "start": 0, "end": 1}],
            }
            spatial_tone = {
                "schema": "vaa1.spatial_tone_scan.v1",
                "samples": [{"timestamp": 0, "brightness": 42}],
            }
            self.write_json(analysis_dir / "shot_boundaries.json", shot_boundaries)
            self.write_json(analysis_dir / "spatial_tone_scan.json", spatial_tone)
            self.write_json(analysis_dir / "annotation_corrections.json", corrections)
            self.write_json(
                analysis_dir / "vaa1_annotation_master_schema.json",
                {"analysis_id": analysis_id, "temporal_segments": []},
            )
            self.write_json(analysis_dir / "source_samples" / "samples.json", [sample])
            self.write_json(
                analysis_dir / "evidence_proliferation_match_request-1.json",
                match,
            )

            hydrated = hydrate_saved_analysis_status(status, results_dir=results_dir)

            self.assertEqual(hydrated["annotation_corrections"], corrections)
            self.assertEqual(hydrated["tracked_objects"], tracked_objects)
            self.assertEqual(
                hydrated["results"]["visual_analysis"]["tracked_objects"],
                tracked_objects,
            )
            self.assertEqual(
                hydrated["results"]["visual_analysis"]["shot_boundaries"],
                shot_boundaries,
            )
            self.assertEqual(
                hydrated["results"]["visual_analysis"]["spatial_tone_scan"],
                spatial_tone,
            )
            self.assertEqual(hydrated["source_samples"], [sample])
            self.assertEqual(len(hydrated["evidence_proliferation_matches"]), 1)
            self.assertEqual(
                hydrated["evidence_proliferation_matches"][0]["request_id"],
                "request-1",
            )
            self.assertIn(
                "source_samples",
                hydrated["saved_analysis_hydration_audit"]["hydrated"],
            )
            self.assertIn(
                "results.visual_analysis.tracked_objects",
                hydrated["saved_analysis_hydration_audit"]["hydrated"],
            )
            self.assertIn(
                "results.visual_analysis.shot_boundaries",
                hydrated["saved_analysis_hydration_audit"]["hydrated"],
            )
            self.assertIn(
                "results.visual_analysis.spatial_tone_scan",
                hydrated["saved_analysis_hydration_audit"]["hydrated"],
            )

    def test_existing_status_values_are_preserved_while_paths_register(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            results_dir = Path(tmpdir)
            analysis_id = "analysis-preserve"
            analysis_dir = results_dir / analysis_id
            existing_corrections = {
                "analysis_id": analysis_id,
                "manual_visual_annotations": [{"id": "existing"}],
            }
            disk_corrections = {
                "analysis_id": analysis_id,
                "manual_visual_annotations": [{"id": "disk"}],
            }
            status = {
                "analysis_id": analysis_id,
                "annotation_corrections": existing_corrections,
                "output_files": {},
            }

            self.write_json(analysis_dir / "annotation_corrections.json", disk_corrections)
            hydrated = hydrate_saved_analysis_status(status, results_dir=results_dir)

            self.assertEqual(hydrated["annotation_corrections"], existing_corrections)
            self.assertEqual(
                hydrated["output_files"]["annotation_corrections"],
                str(analysis_dir / "annotation_corrections.json"),
            )
            self.assertIn(
                "annotation_corrections",
                hydrated["saved_analysis_hydration_audit"]["already_present"],
            )


if __name__ == "__main__":
    unittest.main()
