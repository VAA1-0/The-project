import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ObjectDetectorLicenseAuthorityContractTest(unittest.TestCase):
    def test_api_rejects_licence_sensitive_detector_without_analyst_authority(self):
        source = (ROOT / "api_server.py").read_text(encoding="utf-8")

        self.assertIn('"Ultralytics YOLOv8n"', source)
        self.assertIn('"YOLO-NAS"', source)
        self.assertIn('"LICENSED_MODEL_ANALYST_SELECTION_REQUIRED"', source)
        self.assertIn('"analyst_explicit_selection"', source)
        self.assertIn('"analyst_model_licence_authority"', source)

    def test_permissive_detr_is_the_no_choice_default(self):
        source = (ROOT / "api_server.py").read_text(encoding="utf-8")

        self.assertIn(
            'parsed_model_choices.get("object_detection") or "Meta DETR ResNet-50"',
            source,
        )

    def test_detector_threshold_is_bounded_and_passed_to_pipeline(self):
        source = (ROOT / "api_server.py").read_text(encoding="utf-8")

        self.assertIn('"object_detection_confidence_threshold"', source)
        self.assertIn("0.01 <= object_detection_confidence_threshold <= 0.99", source)
        self.assertIn(
            "object_detection_confidence_threshold=object_detection_confidence_threshold",
            source,
        )

    def test_model_change_recomputes_visual_stage_without_reopening_mature_data(self):
        source = (ROOT / "api_server.py").read_text(encoding="utf-8")

        self.assertIn('"object_detection_configuration_changed"', source)
        self.assertIn('completed_stages.discard("visual")', source)
        self.assertIn('"targeted_visual_recompute_append_run"', source)
        self.assertIn('"mature_master_schema_data_preserved": True', source)


if __name__ == "__main__":
    unittest.main()
