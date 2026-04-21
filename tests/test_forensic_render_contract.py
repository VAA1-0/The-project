import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load_forensic_render_module():
    module_path = Path(__file__).resolve().parents[1] / "src/backend/analysis/forensic_render.py"
    spec = importlib.util.spec_from_file_location("forensic_render", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


forensic_render = load_forensic_render_module()


class ForensicRenderContractTest(unittest.TestCase):
    def test_resolve_forensic_fps_presets(self):
        self.assertEqual(
            forensic_render.resolve_forensic_fps(mode="science_grade", source_fps=25.0),
            6.0,
        )
        self.assertEqual(
            forensic_render.resolve_forensic_fps(mode="science_grade", source_fps=4.0),
            4.0,
        )
        self.assertEqual(
            forensic_render.resolve_forensic_fps(
                mode="forensic_accuracy",
                source_fps=25.0,
            ),
            25.0,
        )
        self.assertEqual(
            forensic_render.resolve_forensic_fps(
                mode="forensic_accuracy",
                source_fps=25.0,
                requested_fps=12.0,
            ),
            12.0,
        )

    def test_resolve_forensic_fps_rejects_unknown_mode(self):
        with self.assertRaises(forensic_render.ForensicRenderError):
            forensic_render.resolve_forensic_fps(
                mode="cinematic_magic",
                source_fps=25.0,
            )

    def test_clamp_region_keeps_roi_inside_frame(self):
        self.assertEqual(
            forensic_render.clamp_region(
                {"x": -10, "y": 4, "w": 1000, "h": 1000},
                frame_width=64,
                frame_height=48,
            ),
            {"x": 0, "y": 4, "w": 64, "h": 44},
        )

    def test_create_forensic_render_job_writes_video_and_ledger(self):
        try:
            import cv2
            import numpy as np
        except ModuleNotFoundError as exc:
            self.skipTest(f"OpenCV integration dependencies unavailable: {exc}")

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_video = tmp_path / "source.mp4"
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(str(source_video), fourcc, 10.0, (64, 48))
            self.assertTrue(writer.isOpened())
            try:
                for index in range(20):
                    frame = np.zeros((48, 64, 3), dtype=np.uint8)
                    frame[:, :, 0] = index * 5
                    frame[:, :, 1] = 80
                    frame[:, :, 2] = 180
                    writer.write(frame)
            finally:
                writer.release()

            job = forensic_render.create_forensic_render_job(
                analysis_id="analysis-1",
                source_video_path=source_video,
                output_root=tmp_path / "renders",
                request={
                    "mode": "science_grade",
                    "time_start": 0.0,
                    "time_end": 1.0,
                    "region": {"x": 4, "y": 6, "w": 24, "h": 18},
                    "reason": "contract test",
                },
            )

            output_video_path = Path(job["output_video_path"])
            output_json_path = Path(job["output_json_path"])
            jobs_path = tmp_path / "renders" / "jobs.json"

            self.assertEqual(job["status"], "completed")
            self.assertEqual(job["mode"], "science_grade")
            self.assertEqual(job["region_type"], "static_box")
            self.assertGreater(job["rendered_frames"], 0)
            self.assertTrue(output_video_path.exists())
            self.assertTrue(output_json_path.exists())
            self.assertTrue(jobs_path.exists())

            persisted_job = json.loads(output_json_path.read_text(encoding="utf-8"))
            jobs = json.loads(jobs_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted_job["render_job_id"], job["render_job_id"])
            self.assertEqual(jobs[0]["render_job_id"], job["render_job_id"])

    def test_odd_roi_dimensions_are_normalized_for_mp4(self):
        self.assertEqual(
            forensic_render.normalize_output_geometry(
                frame_width=65,
                frame_height=49,
                region={"x": 0, "y": 0, "w": 31, "h": 17},
            ),
            (30, 16, {"x": 0, "y": 0, "w": 30, "h": 16}),
        )

    def test_region_track_is_sorted_clamped_and_deduped(self):
        track = forensic_render.normalize_region_track(
            [
                {"time": 2.0, "region": {"x": 60, "y": 40, "w": 20, "h": 20}, "intent": "object"},
                {"time": -5.0, "region": {"x": -10, "y": 5, "w": 30, "h": 20}, "intent": "identification"},
                {"time": 2.0, "region": {"x": 5, "y": 5, "w": 10, "h": 10}, "intent": "ocr"},
                {"time": 99.0, "region": {"x": 1, "y": 2, "w": 3, "h": 4}},
            ],
            frame_width=64,
            frame_height=48,
            time_start=1.0,
            time_end=3.0,
        )

        self.assertEqual([item["time"] for item in track], [1.0, 2.0, 3.0])
        self.assertEqual(track[0]["region"], {"x": 0, "y": 5, "w": 30, "h": 20})
        self.assertEqual(track[1]["region"], {"x": 5, "y": 5, "w": 10, "h": 10})
        self.assertEqual(track[1]["intent"], "ocr")

    def test_interpolate_region_between_keyframes(self):
        region = forensic_render.interpolate_region(
            [
                {"time": 10.0, "region": {"x": 10, "y": 20, "w": 30, "h": 40}},
                {"time": 12.0, "region": {"x": 30, "y": 40, "w": 50, "h": 60}},
            ],
            11.0,
        )

        self.assertEqual(region, {"x": 20, "y": 30, "w": 40, "h": 50})

    def test_missing_source_video_raises_clear_error(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with self.assertRaisesRegex(
                forensic_render.ForensicRenderError,
                "Source video does not exist",
            ):
                forensic_render.create_forensic_render_job(
                    analysis_id="analysis-1",
                    source_video_path=Path(tmpdir) / "missing.mp4",
                    output_root=Path(tmpdir) / "renders",
                    request={
                        "mode": "science_grade",
                        "time_start": 0.0,
                        "time_end": 1.0,
                    },
                )


if __name__ == "__main__":
    unittest.main()
