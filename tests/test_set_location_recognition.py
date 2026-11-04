import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from src.backend.analysis.set_location_recognition import measure_set_location_recurrence


class SetLocationRecognitionTests(unittest.TestCase):
    def test_recurring_wide_frames_are_measured_without_location_inference(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "sets.avi"
            output = root / "set_location_recognition.json"
            writer = cv2.VideoWriter(str(source), cv2.VideoWriter_fourcc(*"MJPG"), 2.0, (160, 90))
            self.assertTrue(writer.isOpened())
            for index in range(12):
                frame = np.zeros((90, 160, 3), dtype=np.uint8)
                if index < 6:
                    frame[:] = (45, 85, 135)
                    cv2.rectangle(frame, (15, 15), (70, 75), (180, 180, 180), -1)
                else:
                    frame[:] = (110, 55, 25)
                    cv2.circle(frame, (115, 45), 28, (30, 170, 80), -1)
                writer.write(frame)
            writer.release()

            payload = measure_set_location_recurrence(
                source,
                analysis_id="analysis-1",
                sample_interval_seconds=0.5,
                similarity_threshold=0.94,
                minimum_cluster_size=2,
                output_path=output,
            )

            self.assertEqual(payload["schema"], "datascene.measured_set_location_recurrence.v1")
            self.assertGreaterEqual(payload["summary"]["recurring_cluster_count"], 2)
            self.assertEqual(payload["governance"]["recurrence_is_not_location_identity"], True)
            self.assertTrue(output.is_file())
            self.assertTrue((root / "set_location_thumbnails").is_dir())
            for cluster in payload["clusters"]:
                self.assertIn("representative", cluster)
                self.assertIn("boundary_sample", cluster)
                self.assertIn("temporal_distribution", cluster)
                self.assertIsNone(cluster["semantic_label"])
                self.assertTrue(cluster["representative"]["thumbnail_ref"].endswith(".jpg"))
                self.assertTrue((root / cluster["representative"]["thumbnail_ref"]).is_file())

    def test_invalid_threshold_is_rejected(self):
        with self.assertRaises(ValueError):
            measure_set_location_recurrence(
                __file__,
                analysis_id="analysis-1",
                similarity_threshold=0.0,
            )


if __name__ == "__main__":
    unittest.main()
