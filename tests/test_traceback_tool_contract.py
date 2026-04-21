import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load_traceback_tool_module():
    module_path = Path(__file__).resolve().parents[1] / "src/backend/analysis/traceback_tool.py"
    spec = importlib.util.spec_from_file_location("traceback_tool", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


traceback_tool = load_traceback_tool_module()


class TracebackToolContractTest(unittest.TestCase):
    def test_build_traceback_record_preserves_artifact_chain(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_video = Path(tmpdir) / "snippet.mp4"
            output_json = Path(tmpdir) / "render_job.json"
            output_video.write_bytes(b"video-bytes")
            output_json.write_text("{}", encoding="utf-8")

            record = traceback_tool.build_traceback_record(
                {
                    "render_job_id": "job-1",
                    "analysis_id": "analysis-1",
                    "source_video_path": "uploads/source.mp4",
                    "time_start": 43.0,
                    "time_end": 44.5,
                    "frame_start": 1032,
                    "frame_end": 1068,
                    "region_type": "static_box",
                    "region_intent": "identification",
                    "region": {"x": 10, "y": 20, "w": 30, "h": 40},
                    "mode": "science_grade",
                    "source_fps": 24.0,
                    "target_fps": 6.0,
                    "frame_stride": 4,
                    "rendered_frames": 9,
                    "requested_by": "test",
                    "reason": "Character present",
                    "input_evidence_ids": ["manual-1"],
                    "adopted_context": {
                        "manual_annotation_refs": [{"id": "manual-1"}],
                        "object_refs": [{"track_id": 21}],
                        "ocr_refs": [{"timestamp": 43.2}],
                    },
                    "output_video_path": str(output_video),
                    "output_json_path": str(output_json),
                }
            )

            self.assertEqual(record["traceback_schema"], "vaa1.traceback_record.v1")
            self.assertEqual(record["artifact_id"], "job-1")
            self.assertEqual(record["artifact_type"], "forensic_render")
            self.assertEqual(record["source"]["time_start"], 43.0)
            self.assertEqual(record["region"]["region_intent"], "identification")
            self.assertEqual(record["evidence_chain"]["manual_annotation_refs"], ["manual-1"])
            self.assertEqual(record["evidence_chain"]["object_refs"], ["21"])
            self.assertIsNotNone(record["reproducibility"]["output_video_sha256"])

    def test_static_multi_second_roi_warns_about_moving_targets(self):
        warnings = traceback_tool.build_traceback_warnings(
            {
                "time_start": 10.0,
                "time_end": 14.0,
                "region_type": "static_box",
                "adopted_context": {"object_refs": []},
            }
        )
        codes = {warning["code"] for warning in warnings}
        self.assertIn("static_roi_over_multi_second_window", codes)
        self.assertIn("roi_has_no_adopted_object_refs", codes)

    def test_write_traceback_record_persists_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "traceback_record.json"
            record = traceback_tool.write_traceback_record(
                {
                    "render_job_id": "job-2",
                    "analysis_id": "analysis-1",
                    "time_start": 0.0,
                    "time_end": 1.0,
                    "region_type": "full_frame",
                },
                output_path,
            )

            self.assertTrue(output_path.exists())
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["artifact_id"], record["artifact_id"])


if __name__ == "__main__":
    unittest.main()
