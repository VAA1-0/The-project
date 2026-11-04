import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "src/backend/analysis/facial_landmark_embedding.py"
SPEC = importlib.util.spec_from_file_location("facial_landmark_embedding", MODULE_PATH)
face = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = face
assert SPEC.loader is not None
SPEC.loader.exec_module(face)


class FacialLandmarkEmbeddingTest(unittest.TestCase):
    def test_missing_models_are_explicit_and_never_trigger_a_download(self):
        with tempfile.TemporaryDirectory() as directory:
            result = face.build_face_discrimination(
                "analysis-1",
                {"source_video_path": "missing.mp4"},
                {"request_id": "face-1", "families": [], "candidates": []},
                model_dir=Path(directory),
            )
        self.assertEqual(result["schema"], face.SCHEMA)
        self.assertEqual(result["status"], "model_files_missing")
        self.assertFalse(result["runtime"]["available"])
        self.assertEqual(result["runtime"]["network_access"], "disabled_by_design")
        self.assertIn("install_face_measurement_models.py", result["runtime"]["installation_command"])

    def test_cosine_and_centroid_are_real_vector_measurements(self):
        centroid = face._mean_embedding([[1.0, 0.0], [0.8, 0.2]])
        self.assertIsNotNone(centroid)
        same = face._cosine([1.0, 0.0], centroid)
        different = face._cosine([0.0, 1.0], centroid)
        self.assertGreater(same, different)

    def test_normalized_bbox_projects_to_source_pixels(self):
        box = face._bbox_pixels(
            {"coordinate_system": "normalized", "bbox": {"x": 0.25, "y": 0.2, "width": 0.5, "height": 0.6}},
            1280,
            720,
        )
        self.assertEqual(box, (320, 144, 960, 576))

    def test_unsupported_model_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for filename in face.MODEL_FILENAMES.values():
                (root / filename).write_bytes(b"present")
            result = face.build_face_discrimination(
                "analysis-1",
                {},
                {"request_id": "face-2", "model": "Unlicensed remote face model"},
                model_dir=root,
            )
        self.assertEqual(result["status"], "model_not_supported")


if __name__ == "__main__":
    unittest.main()
