import unittest

from src.backend.analysis.body_movement_detection import build_body_movement_detections


class BodyMovementDetectionTests(unittest.TestCase):
    def test_measures_track_geometry_without_inventing_gesture_semantics(self):
        status = {"analysis_id": "a1", "annotation_corrections": {"manual_visual_annotations": [{
            "id": "person-1", "identity_affirmation": "Agent A",
            "geometry_keyframes": [
                {"time": 1, "coordinates": {"x": .1, "y": .1, "w": .2, "h": .4}},
                {"time": 2, "coordinates": {"x": .3, "y": .1, "w": .2, "h": .4}},
            ],
        }]}}
        result = build_body_movement_detections(status)
        self.assertEqual(result["measurement_count"], 1)
        row = result["measurements"][0]
        self.assertEqual(row["movement_type"], "translational_body_motion")
        self.assertEqual(row["narrative_agent_label"], "Agent A")
        self.assertEqual(row["maturity"], "candidate_only")
        self.assertFalse(result["governance"]["semantic_gesture_inference"])

    def test_invalid_or_single_keyframe_rows_do_not_become_measurements(self):
        status = {"analysis_id": "a1", "annotation_corrections": {"manual_visual_annotations": [{
            "id": "person-1", "identity_affirmation": "Agent A",
            "geometry_keyframes": [{"time": 1, "coordinates": {"x": .1, "y": .1, "w": .2, "h": .4}}],
        }]}}
        self.assertEqual(build_body_movement_detections(status)["measurement_count"], 0)


if __name__ == "__main__":
    unittest.main()
