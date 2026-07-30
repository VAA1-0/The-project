import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from src.backend.analysis.adaptive_visual_measurement import measure_adaptive_visual


class AdaptiveVisualMeasurementTests(unittest.TestCase):
    def test_measures_baseline_and_escalates_change_windows(self):
        with tempfile.TemporaryDirectory(prefix="vaa1-adaptive-test-") as temporary:
            root = Path(temporary)
            video_path = root / "adaptive.avi"
            writer = cv2.VideoWriter(
                str(video_path),
                cv2.VideoWriter_fourcc(*"MJPG"),
                24,
                (96, 64),
            )
            self.assertTrue(writer.isOpened())
            for index in range(72):
                value = 25 if index < 24 else (240 if index < 30 else 90)
                frame = np.full((64, 96, 3), value, dtype=np.uint8)
                if index >= 36:
                    x = min(72, (index - 36) * 2)
                    frame[20:44, x : x + 20] = (230, 230, 230)
                writer.write(frame)
            writer.release()

            output_path = root / "adaptive_visual_scan.json"
            result = measure_adaptive_visual(
                video_path,
                analysis_id="analysis-1",
                baseline_fps=4,
                dense_fps=12,
                output_path=output_path,
            )

            self.assertEqual(result["schema"], "vaa1.adaptive_visual_measurement.v1")
            self.assertTrue(output_path.exists())
            self.assertGreater(result["summary"]["baseline_sample_count"], 0)
            self.assertGreater(result["summary"]["dense_sample_count"], 0)
            self.assertGreater(result["summary"]["candidate_window_count"], 0)
            self.assertTrue(
                any(sample["transition"]["candidate"] for sample in result["samples"])
            )
            self.assertTrue(
                any(
                    sample["lighting"]["event"] == "rapid illumination rise"
                    for sample in result["samples"]
                )
            )
            sample = result["samples"][-1]
            self.assertIn("frame_class", sample)
            self.assertIn("motion", sample)
            self.assertEqual(len(sample["spatial_occupancy"]), 9)
            self.assertIn(sample["cadence"], {"baseline", "dense_candidate_window"})

    def test_rejects_dense_cadence_below_baseline(self):
        with self.assertRaises(ValueError):
            measure_adaptive_visual(
                __file__,
                analysis_id="analysis-1",
                baseline_fps=12,
                dense_fps=4,
            )


if __name__ == "__main__":
    unittest.main()
