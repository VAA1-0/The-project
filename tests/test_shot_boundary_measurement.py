import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from src.backend.analysis.shot_boundary_measurement import measure_shot_boundaries


class ShotBoundaryMeasurementTests(unittest.TestCase):
    def test_detects_source_video_cut_and_persists_contract(self):
        with tempfile.TemporaryDirectory(prefix="vaa1-shot-test-") as temporary:
            root = Path(temporary)
            video_path = root / "cut.avi"
            writer = cv2.VideoWriter(str(video_path), cv2.VideoWriter_fourcc(*"MJPG"), 10, (96, 64))
            self.assertTrue(writer.isOpened())
            for value in ([0] * 20 + [255] * 20):
                writer.write(np.full((64, 96, 3), value, dtype=np.uint8))
            writer.release()
            output_path = root / "shot_boundaries.json"
            result = measure_shot_boundaries(
                video_path, analysis_id="analysis-1", threshold=10, min_scene_len_frames=5,
                output_path=output_path,
            )
            self.assertEqual(result["schema"], "vaa1.shot_boundary_intervals.v1")
            self.assertTrue(result["true_boundary_intervals"])
            self.assertGreaterEqual(result["summary"]["shot_count"], 2)
            self.assertEqual(result["summary"]["boundary_count"], result["summary"]["shot_count"] - 1)
            self.assertNotEqual(result["boundaries"][0]["pre_shot_id"], result["boundaries"][0]["post_shot_id"])
            self.assertTrue(result["source_video_sha256"])
            self.assertTrue(output_path.exists())


if __name__ == "__main__":
    unittest.main()
