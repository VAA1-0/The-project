import importlib
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path


def _install_pipeline_stubs():
    stubbed_modules = [
        "cv2",
        "numpy",
        "pandas",
        "ultralytics",
        "easyocr",
        "app.pipeline.face_analysis",
        "app.pipeline.face_anonymizer",
        "src.backend.utils.logger",
    ]
    originals = {name: sys.modules.get(name) for name in stubbed_modules}

    cv2 = types.ModuleType("cv2")
    cv2.CAP_PROP_FPS = 1
    cv2.CAP_PROP_FRAME_WIDTH = 2
    cv2.CAP_PROP_FRAME_HEIGHT = 3
    cv2.CAP_PROP_FRAME_COUNT = 4
    cv2.CAP_PROP_POS_MSEC = 5
    cv2.COLOR_BGR2GRAY = 10
    cv2.COLOR_GRAY2RGB = 11
    cv2.THRESH_BINARY = 12
    cv2.INTER_CUBIC = 13
    cv2.COLOR_BGR2RGB = 14
    cv2.ADAPTIVE_THRESH_GAUSSIAN_C = 15
    cv2.COLOR_BGR2HSV = 16
    cv2.FONT_HERSHEY_SIMPLEX = 0

    class FakeRegion:
        size = 1

        def mean(self, axis=None):
            return [32.0, 32.0, 32.0]

    class FakeFrame:
        def __init__(self, index):
            self.index = index
            self.shape = (480, 640, 3)

        def __getitem__(self, key):
            return FakeRegion()

    class VideoCapture:
        def __init__(self, path):
            self.frames = [FakeFrame(0), FakeFrame(1), FakeFrame(2)]
            self.cursor = 0

        def isOpened(self):
            return True

        def get(self, prop):
            mapping = {
                cv2.CAP_PROP_FPS: 2.0,
                cv2.CAP_PROP_FRAME_WIDTH: 640,
                cv2.CAP_PROP_FRAME_HEIGHT: 480,
                cv2.CAP_PROP_FRAME_COUNT: len(self.frames),
            }
            return mapping[prop]

        def set(self, prop, value):
            if prop == cv2.CAP_PROP_POS_MSEC:
                self.cursor = min(
                    len(self.frames),
                    max(0, int(round((float(value) / 1000.0) * 2.0))),
                )
            return True

        def read(self):
            if self.cursor >= len(self.frames):
                return False, None
            frame = self.frames[self.cursor]
            self.cursor += 1
            return True, frame

        def release(self):
            pass

    class VideoWriter:
        def __init__(self, *args, **kwargs):
            pass

        def write(self, frame):
            pass

        def release(self):
            pass

    cv2.VideoCapture = VideoCapture
    cv2.VideoWriter = VideoWriter
    cv2.VideoWriter_fourcc = lambda *args: 0
    cv2.imwrite = lambda path, frame: Path(path).write_text(
        f"frame-{frame.index}", encoding="utf-8"
    ) or True
    cv2.destroyAllWindows = lambda: None
    cv2.imshow = lambda *args, **kwargs: None
    cv2.waitKey = lambda *args, **kwargs: -1
    cv2.cvtColor = lambda frame, code: frame
    cv2.resize = lambda frame, *args, **kwargs: frame
    cv2.adaptiveThreshold = lambda frame, *args, **kwargs: frame
    cv2.threshold = lambda frame, a, b, c: (None, frame)
    cv2.polylines = lambda *args, **kwargs: None
    cv2.putText = lambda *args, **kwargs: None
    sys.modules["cv2"] = cv2

    numpy = types.ModuleType("numpy")
    numpy.int32 = int
    numpy.ndarray = object
    numpy.array = lambda value, dtype=None: value
    numpy.mean = lambda values: sum(values) / len(values) if values else 0.0
    def arange(start, stop=None, step=1.0):
        if stop is None:
            current = 0.0
            end = float(start)
        else:
            current = float(start)
            end = float(stop)
        values = []
        while current < end:
            values.append(current)
            current += float(step)
        return values

    numpy.arange = arange
    sys.modules["numpy"] = numpy

    pandas = types.ModuleType("pandas")

    class DataFrame:
        def __init__(self, rows):
            self.rows = rows

        def __len__(self):
            return len(self.rows)

        def to_csv(self, path, index=False):
            Path(path).write_text(json.dumps(self.rows), encoding="utf-8")

    class Series:
        def __init__(self, data):
            self.data = data

        def to_json(self, path):
            Path(path).write_text(json.dumps(self.data), encoding="utf-8")

    pandas.DataFrame = DataFrame
    pandas.Series = Series
    sys.modules["pandas"] = pandas

    ultralytics = types.ModuleType("ultralytics")

    class FakeArray:
        def __init__(self, values):
            self._values = values

        def tolist(self):
            return list(self._values)

    class FakeDet:
        def __init__(self, cls, conf, bbox):
            self.cls = cls
            self.conf = conf
            self.xyxy = [FakeArray(bbox)]

    class FakeResult:
        def __init__(self, frame):
            if frame.index == 0:
                self.boxes = [FakeDet(0, 0.95, [1, 2, 20, 30])]
            elif frame.index == 2:
                self.boxes = [FakeDet(1, 0.80, [3, 4, 10, 12])]
            else:
                self.boxes = []

        def plot(self):
            return "annotated"

    class YOLO:
        names = {0: "person", 1: "car"}

        def __init__(self, model_path):
            self.names = YOLO.names

        def __call__(self, frame):
            return [FakeResult(frame)]

    ultralytics.YOLO = YOLO
    sys.modules["ultralytics"] = ultralytics

    easyocr = types.ModuleType("easyocr")

    class Reader:
        def __init__(self, languages):
            self.languages = languages

        def readtext(self, frame):
            return []

    easyocr.Reader = Reader
    sys.modules["easyocr"] = easyocr

    face_analysis = types.ModuleType("app.pipeline.face_analysis")

    def analyze_face_images_batch(frame_items, output_dir, style_mode):
        return {
            "success": True,
            "style_mode": style_mode,
            "combined_csv_path": str(Path(output_dir) / "faces.csv"),
            "frames": [
                {
                    "image_path": item["image_path"],
                    "source_timestamp": item["source_timestamp"],
                    "frame_index": item["frame_index"],
                    "person_detected_by_yolo": item.get("person_detected_by_yolo"),
                }
                for item in frame_items
            ],
        }

    face_analysis.analyze_face_images_batch = analyze_face_images_batch
    sys.modules["app.pipeline.face_analysis"] = face_analysis

    face_anonymizer = types.ModuleType("app.pipeline.face_anonymizer")
    face_anonymizer.anonymize_face_batch_results = lambda *args, **kwargs: {
        "success": True
    }
    sys.modules["app.pipeline.face_anonymizer"] = face_anonymizer

    logger_mod = types.ModuleType("src.backend.utils.logger")

    class _Logger:
        def info(self, *args, **kwargs):
            pass

        def error(self, *args, **kwargs):
            pass

    logger_mod.get_logger = lambda name: _Logger()
    sys.modules["src.backend.utils.logger"] = logger_mod

    return originals


class FrameAnalysisPipelineContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._module_originals = _install_pipeline_stubs()
        sys.modules.pop("src.backend.analysis.pipeline_video_frames", None)
        cls.mod = importlib.import_module("src.backend.analysis.pipeline_video_frames")

    @classmethod
    def tearDownClass(cls):
        sys.modules.pop("src.backend.analysis.pipeline_video_frames", None)
        for name, module in cls._module_originals.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module

    def test_person_gate_filters_sampled_frames_and_preserves_source_timestamps(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            video_path = Path(tmpdir) / "clip.mp4"
            video_path.write_text("video", encoding="utf-8")

            pipeline = self.mod.FrameAnalysisPipeline(
                video_path=str(video_path),
                output_dir=str(Path(tmpdir) / "output"),
                apply_face_anonymization=False,
                face_message_style="starfleet",
                face_requires_person_detection=True,
            )

            result = pipeline.analyze(save_video=False, display=False)

            self.assertTrue(result["face_requires_person_detection"])
            self.assertEqual(result["face_sampling"]["frames_considered"], 2)
            self.assertEqual(result["face_sampling"]["frames_selected"], 1)
            self.assertEqual(result["face_sampling"]["frames_skipped_no_person"], 1)
            self.assertEqual(len(result["face_results"]["frames"]), 1)
            self.assertEqual(
                result["face_results"]["frames"][0]["source_timestamp"], 0.0
            )
            self.assertTrue(
                result["face_results"]["frames"][0]["person_detected_by_yolo"]
            )

    def test_summary_json_includes_generated_timestamp(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            video_path = Path(tmpdir) / "clip.mp4"
            video_path.write_text("video", encoding="utf-8")

            pipeline = self.mod.FrameAnalysisPipeline(
                video_path=str(video_path),
                output_dir=str(Path(tmpdir) / "output"),
                face_requires_person_detection=False,
            )

            result = pipeline.analyze(save_video=False, display=False)
            summary_path = Path(result["summary_json"])
            summary = json.loads(summary_path.read_text(encoding="utf-8"))

            self.assertIn("timestamp", summary)
            self.assertIn("generated_at", summary)


if __name__ == "__main__":
    unittest.main()
