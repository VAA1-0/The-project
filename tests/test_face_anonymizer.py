import importlib
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path


def _install_cv2_stub():
    original_cv2 = sys.modules.get("cv2")
    cv2 = types.ModuleType("cv2")

    class _Image:
        def __init__(self, width=100, height=80):
            self.shape = (height, width, 3)
            self._regions = {}

        def __getitem__(self, key):
            y_slice, x_slice = key
            y1 = y_slice.start or 0
            y2 = y_slice.stop or 0
            x1 = x_slice.start or 0
            x2 = x_slice.stop or 0
            return _Roi(self, (x1, y1, x2, y2))

        def __setitem__(self, key, value):
            y_slice, x_slice = key
            y1 = y_slice.start or 0
            y2 = y_slice.stop or 0
            x1 = x_slice.start or 0
            x2 = x_slice.stop or 0
            self._regions[(x1, y1, x2, y2)] = value

    class _Roi:
        def __init__(self, image, bounds):
            self.image = image
            self.bounds = bounds
            x1, y1, x2, y2 = bounds
            self.size = max(0, x2 - x1) * max(0, y2 - y1) * 3

    cv2._Image = _Image
    cv2.imread = lambda path: _Image() if Path(path).exists() else None
    cv2.GaussianBlur = (
        lambda roi, kernel, sigma: {"blurred": True, "bounds": roi.bounds}
    )
    cv2.imwrite = lambda path, image: Path(path).write_text("stub-image", encoding="utf-8") or True

    sys.modules["cv2"] = cv2
    return original_cv2


class FaceAnonymizerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._original_cv2 = _install_cv2_stub()
        sys.modules.pop("app.pipeline.face_anonymizer", None)
        cls.mod = importlib.import_module("app.pipeline.face_anonymizer")

    @classmethod
    def tearDownClass(cls):
        sys.modules.pop("app.pipeline.face_anonymizer", None)
        if cls._original_cv2 is None:
            sys.modules.pop("cv2", None)
        else:
            sys.modules["cv2"] = cls._original_cv2

    def test_clamp_region_rejects_invalid_boxes_and_clamps_valid_ones(self):
        self.assertIsNone(self.mod._clamp_region({"x": 1, "y": 2, "w": 0, "h": 5}, 100, 80))
        self.assertEqual(
            self.mod._clamp_region({"x": -5, "y": -4, "w": 20, "h": 10}, 100, 80),
            (0, 0, 20, 10),
        )

    def test_anonymize_face_image_reports_applied_faces_and_writes_output(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            input_path = tmpdir_path / "frame.jpg"
            input_path.write_text("raw-image", encoding="utf-8")
            output_path = tmpdir_path / "anon" / "frame.jpg"

            result = self.mod.anonymize_face_image(
                image_path=input_path,
                faces=[
                    {"region": {"x": 10, "y": 12, "w": 20, "h": 18}},
                    {"region": {"x": 0, "y": 0, "w": 0, "h": 10}},
                ],
                output_path=output_path,
            )

            self.assertTrue(result["success"])
            self.assertIsNone(result["error"])
            self.assertEqual(result["faces_applied"], 1)
            self.assertEqual(result["output_path"], str(output_path))
            self.assertTrue(output_path.exists())

    def test_batch_anonymizer_manifest_contains_frame_metadata(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            image_a = tmpdir_path / "frame_a.jpg"
            image_b = tmpdir_path / "frame_b.jpg"
            image_a.write_text("a", encoding="utf-8")
            image_b.write_text("b", encoding="utf-8")

            result = self.mod.anonymize_face_batch_results(
                {
                    "frames": [
                        {
                            "image_path": str(image_a),
                            "frame_index": 0,
                            "source_timestamp": 0.0,
                            "faces": [{"region": {"x": 1, "y": 2, "w": 10, "h": 10}}],
                        },
                        {
                            "image_path": str(image_b),
                            "frame_index": 1,
                            "source_timestamp": 1.0,
                            "faces": [],
                        },
                    ]
                },
                output_dir=tmpdir_path / "anonymized",
            )

            manifest_path = Path(result["manifest_path"])
            self.assertTrue(result["success"])
            self.assertTrue(manifest_path.exists())
            self.assertEqual(len(result["frames"]), 2)
            self.assertEqual(result["frames"][0]["frame_index"], 0)
            self.assertEqual(result["frames"][1]["source_timestamp"], 1.0)

            manifest_on_disk = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertIn("generated_at", result)
            self.assertEqual(manifest_on_disk["output_dir"], str(tmpdir_path / "anonymized"))
            self.assertIn("generated_at", manifest_on_disk)
            self.assertEqual(len(manifest_on_disk["frames"]), 2)
            self.assertEqual(manifest_on_disk["frames"][0]["faces_applied"], 1)
            self.assertEqual(manifest_on_disk["frames"][1]["faces_applied"], 0)


if __name__ == "__main__":
    unittest.main()
