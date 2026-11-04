import json
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from src.backend.analysis.object_appearance_embedding import (
    DEFAULT_MODEL,
    SCHEMA,
    appearance_embedding,
    build_object_appearance_measurement,
    cosine_similarity,
    write_object_appearance_measurement,
)


class ObjectAppearanceEmbeddingTest(unittest.TestCase):
    def test_descriptor_is_deterministic_and_discriminates_colour(self):
        red = np.zeros((80, 80, 3), dtype=np.uint8)
        red[:, :] = (0, 0, 220)
        blue = np.zeros((80, 80, 3), dtype=np.uint8)
        blue[:, :] = (220, 0, 0)

        red_a, metadata = appearance_embedding(red)
        red_b, _ = appearance_embedding(red.copy())
        blue_vector, _ = appearance_embedding(blue)

        self.assertEqual(red_a, red_b)
        self.assertGreater(len(red_a), 1000)
        self.assertEqual(metadata["embedding_dimensions"], len(red_a))
        self.assertGreater(cosine_similarity(red_a, red_b), 0.999)
        self.assertLess(cosine_similarity(red_a, blue_vector), 0.95)

    def test_source_linked_tracks_produce_private_measured_artifact(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            video_path = root / "objects.avi"
            writer = cv2.VideoWriter(
                str(video_path),
                cv2.VideoWriter_fourcc(*"MJPG"),
                5.0,
                (160, 96),
            )
            self.assertTrue(writer.isOpened())
            for index in range(15):
                frame = np.zeros((96, 160, 3), dtype=np.uint8)
                frame[15:75, 10:70] = (0, 0, 180 + index)
                frame[15:75, 90:150] = (180 + index, 0, 0)
                writer.write(frame)
            writer.release()

            request = {
                "request_id": "object-test",
                "model": DEFAULT_MODEL,
                "sample_count": 3,
                "review_context": {
                    "media_genre": "drama / fiction",
                    "situational_genre": "confrontation",
                    "privacy": "public",
                },
                "families": [
                    {
                        "key": "red prop",
                        "members": [
                            {
                                "evidence_id": "red:1",
                                "track_id": "1",
                                "source_time": {"start": 0.0, "end": 1.5},
                                "geometry": {"coordinate_system": "normalized", "bbox": {"x1": 0.06, "y1": 0.15, "x2": 0.44, "y2": 0.8}},
                            }
                        ],
                    },
                    {
                        "key": "blue prop",
                        "members": [
                            {
                                "evidence_id": "blue:1",
                                "track_id": "2",
                                "source_time": {"start": 0.0, "end": 1.5},
                                "geometry": {"coordinate_system": "normalized", "bbox": {"x1": 0.56, "y1": 0.15, "x2": 0.94, "y2": 0.8}},
                            }
                        ],
                    },
                ],
            }
            result = build_object_appearance_measurement(
                "analysis-1",
                {"source_video_path": str(video_path), "model_choices": {}},
                request,
            )

            self.assertEqual(result["schema"], SCHEMA)
            self.assertEqual(result["status"], "completed_measured")
            self.assertEqual(result["measured_member_count"], 2)
            self.assertEqual(len(result["embedding_index"]), 2)
            self.assertTrue(result["governance"]["score_is_not_calibrated_probability"])
            self.assertTrue(result["governance"]["detector_confidence_is_not_embedding_similarity"])
            self.assertTrue(result["governance"]["genre_and_situation_do_not_change_similarity"])
            self.assertEqual(result["review_context"]["axes"]["situational_genre"], "confrontation")
            self.assertEqual(result["review_context"]["measurement_effect"], "none")
            self.assertEqual(
                result["review_context"]["semantic_effect"],
                "none_until_governed_analyst_decision",
            )
            self.assertEqual(result["families"][0]["members"][0]["measurement_state"], "measured")
            self.assertNotIn("embedding", result["families"][0]["members"][0])

            output_path = root / "object_appearance.json"
            persisted = write_object_appearance_measurement(
                "analysis-1",
                {"source_video_path": str(video_path), "model_choices": {}},
                request,
                output_path,
            )
            self.assertTrue(output_path.exists())
            on_disk = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(on_disk["embedding_index"].keys(), persisted["embedding_index"].keys())

    def test_missing_source_fails_closed(self):
        result = build_object_appearance_measurement("missing", {}, {"families": []})
        self.assertEqual(result["status"], "source_video_missing")
        self.assertEqual(result["families"], [])


if __name__ == "__main__":
    unittest.main()
