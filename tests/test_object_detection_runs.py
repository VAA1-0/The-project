import unittest
import csv
import json
import tempfile
from pathlib import Path

from src.backend.analysis.object_detection_runs import (
    append_object_detection_run,
    write_object_detection_projection,
)


def visual(provider, timestamp, label, track_id=1):
    return {
        "object_detector": {"provider": provider, "license": "test"},
        "generated_at": f"2026-10-25T12:00:{timestamp:02d}+00:00",
        "yolo_results": [{
            "timestamp": float(timestamp), "class_name": label, "confidence": 0.8,
            "bbox_x1": 1, "bbox_y1": 2, "bbox_x2": 30, "bbox_y2": 40,
        }],
        "tracked_objects": [{"track_id": track_id, "class_name": label}],
    }


class ObjectDetectionRunRegistryTest(unittest.TestCase):
    def test_model_change_keeps_both_provider_layers_active(self):
        previous = visual("Ultralytics YOLOv8n", 10, "car")
        current = visual("Meta DETR ResNet-50", 20, "person")

        result = append_object_detection_run(previous, current)

        self.assertEqual(result["run_count"], 2)
        self.assertEqual(result["active_provider_count"], 2)
        self.assertEqual({row["class_name"] for row in result["yolo_results"]}, {"car", "person"})
        self.assertTrue(all(row.get("detector_run_id") for row in result["tracked_objects"]))
        self.assertIn("mature_master_schema_decisions_are_not_reopened", result["projection_policy"])

    def test_same_provider_exact_observation_is_projected_once_with_run_lineage(self):
        first = visual("Ultralytics YOLOv8n", 10, "car")
        second = visual("Ultralytics YOLOv8n", 10, "car")
        second["generated_at"] = "2026-10-25T13:00:00+00:00"

        result = append_object_detection_run(first, second)

        self.assertEqual(result["run_count"], 2)
        self.assertEqual(len(result["yolo_results"]), 1)
        self.assertEqual(len(result["yolo_results"][0]["detector_run_ids"]), 2)

    def test_union_projection_is_materialized_for_existing_panel_consumers(self):
        result = append_object_detection_run(
            visual("Ultralytics YOLOv8n", 10, "car"),
            visual("Meta DETR ResNet-50", 20, "person"),
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            files = write_object_detection_projection(Path(tmpdir), result)
            with Path(files["tracked_objects_csv"]).open(encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            registry = json.loads(Path(files["object_detection_run_registry"]).read_text(encoding="utf-8"))

        self.assertEqual({row["detector_provider"] for row in rows}, {"Ultralytics YOLOv8n", "Meta DETR ResNet-50"})
        self.assertEqual(registry["run_count"], 2)


if __name__ == "__main__":
    unittest.main()
