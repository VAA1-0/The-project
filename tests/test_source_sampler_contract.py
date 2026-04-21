import importlib.util
import json
import math
import sys
import tempfile
import unittest
import wave
from pathlib import Path


def load_source_sampler_module():
    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    module_path = project_root / "src/backend/analysis/source_sampler.py"
    spec = importlib.util.spec_from_file_location("source_sampler", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


source_sampler = load_source_sampler_module()


class SourceSamplerContractTest(unittest.TestCase):
    def test_create_source_sample_writes_visual_audio_and_ledger(self):
        try:
            import cv2
            import numpy as np
        except ModuleNotFoundError as exc:
            self.skipTest(f"OpenCV integration dependencies unavailable: {exc}")

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_video = tmp_path / "source.mp4"
            source_audio = tmp_path / "source.wav"

            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(str(source_video), fourcc, 10.0, (64, 48))
            self.assertTrue(writer.isOpened())
            try:
                for index in range(20):
                    frame = np.zeros((48, 64, 3), dtype=np.uint8)
                    frame[:, :, 1] = index * 5
                    frame[:, :, 2] = 120
                    writer.write(frame)
            finally:
                writer.release()

            sample_rate = 8000
            with wave.open(str(source_audio), "wb") as audio:
                audio.setnchannels(1)
                audio.setsampwidth(2)
                audio.setframerate(sample_rate)
                frames = bytearray()
                for index in range(sample_rate * 2):
                    value = int(1000 * math.sin(index / 20))
                    frames.extend(value.to_bytes(2, byteorder="little", signed=True))
                audio.writeframes(bytes(frames))

            sample = source_sampler.create_source_sample(
                analysis_id="analysis-1",
                source_video_path=source_video,
                source_audio_path=source_audio,
                output_root=tmp_path / "samples",
                request={
                    "sample_type": "visual_audio",
                    "time_start": 0.2,
                    "time_end": 0.8,
                    "region": {"x": 3, "y": 4, "w": 20, "h": 16},
                    "label": "contract sample",
                },
            )

            self.assertEqual(sample["status"], "completed")
            self.assertEqual(sample["sample_type"], "visual_audio")
            self.assertTrue(Path(sample["visual"]["output_image_path"]).exists())
            self.assertTrue(Path(sample["audio"]["output_audio_path"]).exists())
            samples = json.loads((tmp_path / "samples" / "samples.json").read_text())
            self.assertEqual(samples[0]["sample_id"], sample["sample_id"])


if __name__ == "__main__":
    unittest.main()
