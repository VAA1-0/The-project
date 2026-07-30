import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from src.backend.analysis.spatial_tone_measurement import measure_spatial_tone


class SpatialToneMeasurementTests(unittest.TestCase):
    def test_measures_source_timed_visual_properties_and_persists_contract(self):
        with tempfile.TemporaryDirectory(prefix="vaa1-tone-test-") as temporary:
            root = Path(temporary)
            video_path = root / "tone.avi"
            writer = cv2.VideoWriter(
                str(video_path),
                cv2.VideoWriter_fourcc(*"MJPG"),
                10,
                (96, 64),
            )
            self.assertTrue(writer.isOpened())
            for index in range(30):
                value = 30 if index < 10 else (120 if index < 20 else 230)
                frame = np.full((64, 96, 3), value, dtype=np.uint8)
                frame[:, 48:] = np.clip(frame[:, 48:] + 20, 0, 255)
                writer.write(frame)
            writer.release()

            output_path = root / "spatial_tone_scan.json"
            result = measure_spatial_tone(
                video_path,
                analysis_id="analysis-1",
                sample_interval_seconds=1.0,
                output_path=output_path,
            )

            self.assertEqual(result["schema"], "vaa1.spatial_tone_measurement.v1")
            self.assertEqual(result["source_clock"], "source_media.clock")
            self.assertEqual(result["summary"]["sample_count"], 3)
            self.assertTrue(result["source_video_sha256"])
            self.assertTrue(output_path.exists())
            sample = result["samples"][0]
            self.assertEqual(sample["frame_index"], 0)
            self.assertIn("whole_frame", sample["zones"])
            self.assertIn("brightness", sample["zones"]["whole_frame"])
            self.assertIn("contrast", sample["zones"]["whole_frame"])
            self.assertIn("luminance_entropy", sample["zones"]["whole_frame"])
            self.assertLess(
                result["samples"][0]["zones"]["whole_frame"]["brightness"],
                result["samples"][-1]["zones"]["whole_frame"]["brightness"],
            )

    def test_rejects_non_positive_sample_interval(self):
        with self.assertRaises(ValueError):
            measure_spatial_tone(
                __file__,
                analysis_id="analysis-1",
                sample_interval_seconds=0,
            )


if __name__ == "__main__":
    unittest.main()
