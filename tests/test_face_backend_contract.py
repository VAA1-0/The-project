import asyncio
import importlib
import io
import shutil
import sys
import tempfile
import types
import unittest
from pathlib import Path


def _install_api_server_stubs():
    fastapi = types.ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class BackgroundTasks:
        def __init__(self):
            self.tasks = []

        def add_task(self, func, *args, **kwargs):
            self.tasks.append((func, args, kwargs))

    class FastAPI:
        def __init__(self, *args, **kwargs):
            self.routes = []

        def add_middleware(self, *args, **kwargs):
            return None

        def mount(self, *args, **kwargs):
            return None

        def post(self, *args, **kwargs):
            def decorator(func):
                return func

            return decorator

        def get(self, *args, **kwargs):
            def decorator(func):
                return func

            return decorator

        def delete(self, *args, **kwargs):
            def decorator(func):
                return func

            return decorator

    fastapi.FastAPI = FastAPI
    fastapi.File = lambda *args, **kwargs: None
    fastapi.UploadFile = object
    fastapi.HTTPException = HTTPException
    fastapi.BackgroundTasks = BackgroundTasks
    fastapi.Body = lambda *args, **kwargs: None
    fastapi.Form = lambda *args, **kwargs: None
    sys.modules["fastapi"] = fastapi

    responses = types.ModuleType("fastapi.responses")

    class FileResponse:
        def __init__(self, path, media_type=None, filename=None):
            self.path = str(path)
            self.media_type = media_type
            self.filename = filename

    class JSONResponse:
        def __init__(self, content=None, status_code=200):
            self.content = content
            self.status_code = status_code

    responses.FileResponse = FileResponse
    responses.JSONResponse = JSONResponse
    sys.modules["fastapi.responses"] = responses

    cors = types.ModuleType("fastapi.middleware.cors")
    cors.CORSMiddleware = type("CORSMiddleware", (), {})
    sys.modules["fastapi.middleware.cors"] = cors

    staticfiles = types.ModuleType("fastapi.staticfiles")

    class StaticFiles:
        def __init__(self, *args, **kwargs):
            pass

    staticfiles.StaticFiles = StaticFiles
    sys.modules["fastapi.staticfiles"] = staticfiles

    pipeline_video_frames = types.ModuleType(
        "src.backend.analysis.pipeline_video_frames"
    )

    class FrameAnalysisPipeline:
        def __init__(self, *args, **kwargs):
            self.kwargs = kwargs

        def analyze(self, *args, **kwargs):
            return {}

    pipeline_video_frames.FrameAnalysisPipeline = FrameAnalysisPipeline
    sys.modules["src.backend.analysis.pipeline_video_frames"] = pipeline_video_frames

    pipeline_manager = types.ModuleType("src.backend.analysis.pipeline_manager")
    pipeline_manager.run_full_pipeline = lambda *args, **kwargs: {}
    sys.modules["src.backend.analysis.pipeline_manager"] = pipeline_manager

    pipeline_ingestion = types.ModuleType("src.backend.analysis.pipeline_ingestion")
    pipeline_ingestion.run_ingestion_pipeline = lambda *args, **kwargs: {}
    pipeline_ingestion.validate_video = lambda *args, **kwargs: (True, None)
    sys.modules["src.backend.analysis.pipeline_ingestion"] = pipeline_ingestion

    audio_text = types.ModuleType("src.backend.analysis.pipeline_audio_text")
    audio_text.AudioTranscriptionPipeline = type(
        "AudioTranscriptionPipeline", (), {}
    )
    sys.modules["src.backend.analysis.pipeline_audio_text"] = audio_text

    language_modeller = types.ModuleType("src.backend.analysis.language_modeller")
    language_modeller.MMSASRTranscriber = type("MMSASRTranscriber", (), {})
    language_modeller.DEFAULT_MMS_MODEL_ID = "stub-model"
    sys.modules["src.backend.analysis.language_modeller"] = language_modeller

    expression_detector = types.ModuleType("src.backend.analysis.expression_detector")
    expression_detector.ExpressionDetectorDeepFace = type(
        "ExpressionDetectorDeepFace", (), {}
    )
    sys.modules["src.backend.analysis.expression_detector"] = expression_detector

    pos_analysis = types.ModuleType("src.backend.analysis.pos_analysis")

    class POSAnalysis:
        def __init__(self, text, language_code="en", nlp=None):
            self.text = text
            self.language_code = language_code

        def run(self):
            return {
                "text": self.text,
                "language": self.language_code,
                "analysis_mode": "lexical_fallback",
                "token_count": len(self.text.split()),
                "notes": ["stub-pos"],
                "pos_counts": {"NOUN": 2, "VERB": 1, "ADP": 1, "ADV": 0},
                "pos_ratios": {"verb_noun_ratio": 0.5},
                "interrogative_lens": {"who": [], "what": []},
                "pos_words": {
                    "NOUN": ["ilmasto", "kokous"],
                    "VERB": ["etenee"],
                    "ADP": ["kohti"],
                    "ADV": [],
                },
            }

    pos_analysis.POSAnalysis = POSAnalysis
    sys.modules["src.backend.analysis.pos_analysis"] = pos_analysis

    quantitative_analysis = types.ModuleType(
        "src.backend.analysis.quantitative_analysis"
    )

    class QuantitativeAnalysis:
        def __init__(self, *args, **kwargs):
            self.kwargs = kwargs

        def run(self):
            return {
                "stats_df": [],
                "token_info": {
                    "tokens": ["cop30", "climate", "cop30"],
                    "tokens_filtered": ["cop30", "climate", "cop30"],
                    "ttr": 0.667,
                    "freq_dist": {"cop30": 2, "climate": 1},
                },
                "tfidf_df": [],
                "bigrams": [],
                "sentence_tags": [],
                "concordance": {
                    "keyword": "cop30",
                    "lines": ["cop30 climate cop30"],
                    "width": 80,
                    "requested_lines": 10,
                },
            }

    quantitative_analysis.QuantitativeAnalysis = QuantitativeAnalysis
    quantitative_analysis.attach_quant_evidence_to_transcript = (
        lambda *args, **kwargs: args[0] if args else None
    )
    sys.modules["src.backend.analysis.quantitative_analysis"] = (
        quantitative_analysis
    )

    logger_mod = types.ModuleType("src.backend.utils.logger")

    class _Logger:
        def info(self, *args, **kwargs):
            pass

        def error(self, *args, **kwargs):
            pass

        def warning(self, *args, **kwargs):
            pass

    logger_mod.get_logger = lambda name: _Logger()
    sys.modules["src.backend.utils.logger"] = logger_mod


class ApiServerContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _install_api_server_stubs()
        sys.modules.pop("api_server", None)
        cls.api_server = importlib.import_module("api_server")

    def setUp(self):
        self.api_server.analysis_status.clear()

    def test_start_analysis_response_tracks_face_flags_and_start_timestamps(self):
        self.api_server.analysis_status["analysis-start"] = {
            "status": "uploaded",
            "progress": 0,
            "original_filename": "clip.mp4",
            "file_path": "uploads/clip.mp4",
            "cvatID": 9,
        }

        background_tasks = self.api_server.BackgroundTasks()
        result = asyncio.run(
            self.api_server.start_analysis(
                "analysis-start",
                background_tasks,
                pipeline_type="full",
                apply_face_anonymization=True,
                face_message_style="starfleet",
                face_requires_person_detection=True,
            )
        )

        status = self.api_server.analysis_status["analysis-start"]
        self.assertEqual(result["analysis_id"], "analysis-start")
        self.assertEqual(result["status"], "processing")
        self.assertTrue(result["apply_face_anonymization"])
        self.assertEqual(result["face_message_style"], "starfleet")
        self.assertTrue(result["face_requires_person_detection"])
        self.assertEqual(status["status"], "processing")
        self.assertEqual(status["progress"], 5)
        self.assertEqual(status["mission_stage"], "queued")
        self.assertIsNotNone(status["start_time"])
        self.assertIsNotNone(status["analysis_started_at"])
        self.assertIsNone(status["analysis_completed_at"])
        self.assertEqual(len(background_tasks.tasks), 1)
        self.assertEqual(
            background_tasks.tasks[0][1],
            ("analysis-start", "full", True, "starfleet", True),
        )

    def test_status_exposes_face_flags_and_sampling_summary(self):
        self.api_server.analysis_status["analysis-1"] = {
            "status": "completed",
            "progress": 100,
            "original_filename": "clip.mp4",
            "cvatID": 7,
            "pipeline_type": "full",
            "apply_face_anonymization": True,
            "face_message_style": "starfleet",
            "face_requires_person_detection": True,
            "uploaded_at": "2026-03-20T10:00:00+00:00",
            "analysis_started_at": "2026-03-20T10:01:00+00:00",
            "analysis_completed_at": "2026-03-20T10:02:30+00:00",
            "start_time": 100.0,
            "end_time": 190.0,
            "results": {
                "visual_analysis": {
                    "yolo_results": [{"id": 1}, {"id": 2}],
                    "ocr_results": [{"id": 1}],
                    "expression_results": [{"id": 1}],
                    "expression_status": "completed",
                    "face_sampling": {
                        "frames_considered": 5,
                        "frames_selected": 3,
                        "frames_skipped_no_person": 2,
                    },
                },
                "audio_analysis": {
                    "transcript": {
                        "segments": [{"text": "Hei maailma"}],
                        "language": "fi",
                        "language_info": {
                            "name": "Finnish",
                            "source": "whisper+text",
                            "confidence": 0.95,
                            "support": {
                                "quant": "enhanced",
                                "pos": "basic",
                            },
                        },
                    }
                },
            },
            "output_files": {
                "face_anonymization_manifest": "outputs/api_results/analysis-1/manifest.json",
                "expression_json": "outputs/api_results/analysis-1/expressions.json",
            },
        }

        result = asyncio.run(self.api_server.get_analysis_status("analysis-1"))

        self.assertTrue(result["apply_face_anonymization"])
        self.assertEqual(result["face_message_style"], "starfleet")
        self.assertTrue(result["face_requires_person_detection"])
        self.assertEqual(result["uploaded_at"], "2026-03-20T10:00:00+00:00")
        self.assertEqual(result["analysis_started_at"], "2026-03-20T10:01:00+00:00")
        self.assertEqual(result["analysis_completed_at"], "2026-03-20T10:02:30+00:00")
        self.assertEqual(result["processing_time"], 90.0)
        self.assertEqual(result["summary"]["expression_samples"], 1)
        self.assertEqual(result["summary"]["expression_status"], "completed")
        self.assertEqual(result["summary"]["face_frames_considered"], 5)
        self.assertEqual(result["summary"]["face_frames_selected"], 3)
        self.assertEqual(result["summary"]["face_frames_skipped_no_person"], 2)
        self.assertEqual(result["summary"]["audio_language"], "fi")
        self.assertEqual(result["summary"]["audio_language_name"], "Finnish")
        self.assertEqual(result["summary"]["audio_language_source"], "whisper+text")
        self.assertEqual(result["summary"]["language_support"]["quant"], "enhanced")
        self.assertIn("face_anonymization_manifest", result["download_links"])
        self.assertIn("expression_json", result["download_links"])

    def test_download_supports_face_anonymization_manifest(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manifest_path = Path(tmpdir) / "manifest.json"
            manifest_path.write_text('{"success": true}', encoding="utf-8")

            self.api_server.analysis_status["analysis-2"] = {
                "status": "completed",
                "progress": 100,
                "original_filename": "clip.mp4",
                "cvatID": 3,
                "output_files": {
                    "face_anonymization_manifest": str(manifest_path),
                },
            }

            response = asyncio.run(
                self.api_server.download_file(
                    "analysis-2", "face_anonymization_manifest"
                )
            )

            self.assertEqual(response.path, str(manifest_path))
            self.assertEqual(response.media_type, "application/json")
            self.assertEqual(
                response.filename,
                "clip_face_anonymization_manifest.json",
            )

    def test_download_bundle_collects_available_outputs_into_zip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yolo_path = Path(tmpdir) / "yolo.csv"
            summary_path = Path(tmpdir) / "summary.json"
            yolo_path.write_text("timestamp,class_name\n0.0,person\n", encoding="utf-8")
            summary_path.write_text('{"ok": true}', encoding="utf-8")

            self.api_server.analysis_status["analysis-bundle"] = {
                "status": "completed",
                "progress": 100,
                "original_filename": "clip.mp4",
                "cvatID": 4,
                "output_files": {
                    "yolo_csv": str(yolo_path),
                    "summary_json": str(summary_path),
                },
            }

            original_results_dir = self.api_server.RESULTS_DIR
            self.api_server.RESULTS_DIR = Path(tmpdir)
            try:
                response = asyncio.run(
                    self.api_server.download_bundle("analysis-bundle")
                )
                bundle_path = Path(response.path)
                self.assertTrue(bundle_path.exists())
                self.assertEqual(response.media_type, "application/zip")
                self.assertEqual(response.filename, "clip_analysis_bundle.zip")
            finally:
                self.api_server.RESULTS_DIR = original_results_dir

    def test_delete_analysis_removes_analysis_output_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            uploads_dir = root / "uploads"
            results_dir = root / "results"
            uploads_dir.mkdir()
            results_dir.mkdir()

            uploaded_file = uploads_dir / "clip.mp4"
            uploaded_file.write_text("video", encoding="utf-8")

            analysis_dir = results_dir / "analysis-3"
            analysis_dir.mkdir()
            nested_file = analysis_dir / "nested.json"
            nested_file.write_text("{}", encoding="utf-8")

            top_level_file = root / "summary.json"
            top_level_file.write_text("{}", encoding="utf-8")

            original_results_dir = self.api_server.RESULTS_DIR
            self.api_server.RESULTS_DIR = results_dir

            try:
                self.api_server.analysis_status["analysis-3"] = {
                    "status": "completed",
                    "progress": 100,
                    "original_filename": "clip.mp4",
                    "file_path": str(uploaded_file),
                    "output_files": {
                        "summary_json": str(top_level_file),
                    },
                }

                response = asyncio.run(self.api_server.delete_analysis("analysis-3"))

                self.assertEqual(
                    response["message"], "Analysis deleted successfully"
                )
                self.assertFalse(uploaded_file.exists())
                self.assertFalse(top_level_file.exists())
                self.assertFalse(analysis_dir.exists())
                self.assertNotIn("analysis-3", self.api_server.analysis_status)
            finally:
                self.api_server.RESULTS_DIR = original_results_dir

    def test_persisted_analysis_can_be_reopened_after_memory_reset(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            results_dir = Path(tmpdir) / "api_results"
            results_dir.mkdir(parents=True)

            original_results_dir = self.api_server.RESULTS_DIR
            self.api_server.RESULTS_DIR = results_dir
            try:
                status = {
                    "analysis_id": "analysis-saved",
                    "status": "completed",
                    "progress": 100,
                    "original_filename": "clip.mp4",
                    "file_path": str(results_dir / "clip.mp4"),
                    "cvatID": 12,
                    "pipeline_type": "full",
                    "mission_stage": "complete",
                    "mission_message": "All available stations have reported in.",
                    "uploaded_at": "2026-03-25T10:00:00+00:00",
                    "analysis_started_at": "2026-03-25T10:01:00+00:00",
                    "analysis_completed_at": "2026-03-25T10:02:30+00:00",
                    "start_time": 100.0,
                    "end_time": 190.0,
                    "event_log": [
                        {
                            "timestamp": "2026-03-25T10:00:00+00:00",
                            "event_type": "uploaded",
                            "progress": 0,
                            "mission_stage": "uploaded",
                            "mission_message": "File secured. Standing by for orders.",
                            "details": {},
                        },
                        {
                            "timestamp": "2026-03-25T10:02:30+00:00",
                            "event_type": "analysis_completed",
                            "progress": 100,
                            "mission_stage": "complete",
                            "mission_message": "All available stations have reported in.",
                            "details": {},
                        },
                    ],
                    "results": {
                        "visual_analysis": {
                            "yolo_results": [{"id": 1}],
                            "ocr_results": [],
                            "expression_results": [],
                        }
                    },
                    "output_files": {},
                }

                self.api_server.analysis_status["analysis-saved"] = status
                self.api_server.persist_analysis_record_for_status(status)

                self.api_server.analysis_status.clear()

                reopened = asyncio.run(
                    self.api_server.get_analysis_status("analysis-saved")
                )
                listing = asyncio.run(self.api_server.list_analyses(limit=5))

                self.assertEqual(reopened["analysis_id"], "analysis-saved")
                self.assertEqual(reopened["status"], "completed")
                self.assertEqual(reopened["processing_time"], 90.0)
                self.assertEqual(len(reopened["event_log"]), 2)
                self.assertEqual(
                    reopened["event_log"][-1]["event_type"], "analysis_completed"
                )
                self.assertIn("analysis-saved", listing["analyses"])
                self.assertEqual(
                    listing["analyses"]["analysis-saved"]["filename"], "clip.mp4"
                )
            finally:
                self.api_server.RESULTS_DIR = original_results_dir

    def test_clear_session_removes_completed_analyses_but_skips_processing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            results_dir = root / "results"
            uploads_dir = root / "uploads"
            results_dir.mkdir()
            uploads_dir.mkdir()

            completed_upload = uploads_dir / "completed.mp4"
            completed_upload.write_text("video", encoding="utf-8")
            completed_dir = results_dir / "analysis-complete"
            completed_dir.mkdir()
            (completed_dir / "analysis_record.json").write_text("{}", encoding="utf-8")
            completed_output = root / "summary.json"
            completed_output.write_text("{}", encoding="utf-8")

            processing_upload = uploads_dir / "processing.mp4"
            processing_upload.write_text("video", encoding="utf-8")
            processing_dir = results_dir / "analysis-processing"
            processing_dir.mkdir()
            (processing_dir / "analysis_record.json").write_text("{}", encoding="utf-8")

            original_results_dir = self.api_server.RESULTS_DIR
            self.api_server.RESULTS_DIR = results_dir
            try:
                self.api_server.analysis_status["analysis-complete"] = {
                    "analysis_id": "analysis-complete",
                    "status": "completed",
                    "progress": 100,
                    "original_filename": "completed.mp4",
                    "file_path": str(completed_upload),
                    "output_files": {"summary_json": str(completed_output)},
                }
                self.api_server.analysis_status["analysis-processing"] = {
                    "analysis_id": "analysis-processing",
                    "status": "processing",
                    "progress": 55,
                    "original_filename": "processing.mp4",
                    "file_path": str(processing_upload),
                    "output_files": {},
                }

                response = asyncio.run(self.api_server.clear_session())

                self.assertIn("analysis-complete", response["cleared_analysis_ids"])
                self.assertIn(
                    "analysis-processing", response["skipped_processing_ids"]
                )
                self.assertNotIn("analysis-complete", self.api_server.analysis_status)
                self.assertIn("analysis-processing", self.api_server.analysis_status)
                self.assertFalse(completed_upload.exists())
                self.assertFalse(completed_output.exists())
                self.assertFalse(completed_dir.exists())
                self.assertTrue(processing_upload.exists())
                self.assertTrue(processing_dir.exists())
            finally:
                self.api_server.RESULTS_DIR = original_results_dir

    def test_import_saved_work_creates_completed_analysis_with_download_links(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            results_dir = root / "results"
            imported_dir = root / "imported"
            results_dir.mkdir()
            imported_dir.mkdir()

            archive_buffer = io.BytesIO()
            with self.api_server.zipfile.ZipFile(
                archive_buffer, "w", compression=self.api_server.zipfile.ZIP_DEFLATED
            ) as archive:
                archive.writestr(
                    "finnish_news_analysis_summary.json",
                    '{"ok": true}',
                )

            upload = types.SimpleNamespace(
                filename="finnish_news_analysis_bundle.zip",
                file=io.BytesIO(archive_buffer.getvalue()),
            )

            original_results_dir = self.api_server.RESULTS_DIR
            original_imported_dir = self.api_server.IMPORTED_WORK_DIR
            self.api_server.RESULTS_DIR = results_dir
            self.api_server.IMPORTED_WORK_DIR = imported_dir
            try:
                imported = asyncio.run(self.api_server.import_saved_work(upload))
                analysis_id = imported["analysis_id"]

                status = asyncio.run(self.api_server.get_analysis_status(analysis_id))

                self.assertEqual(imported["status"], "completed")
                self.assertEqual(status["status"], "completed")
                self.assertEqual(status["filename"], "finnish_news.zip")
                self.assertIn("summary_json", status["download_links"])
                self.assertTrue(
                    (results_dir / analysis_id / "analysis_record.json").exists()
                )
            finally:
                self.api_server.RESULTS_DIR = original_results_dir
                self.api_server.IMPORTED_WORK_DIR = original_imported_dir

    def test_import_saved_work_regenerates_empty_pos_from_transcript(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            results_dir = root / "results"
            imported_dir = root / "imported"
            results_dir.mkdir()
            imported_dir.mkdir()

            archive_buffer = io.BytesIO()
            with self.api_server.zipfile.ZipFile(
                archive_buffer, "w", compression=self.api_server.zipfile.ZIP_DEFLATED
            ) as archive:
                archive.writestr(
                    "cop30_transcript.json",
                    (
                        '{"language":"fi","segments":['
                        '{"start":0.0,"end":2.0,"text":"Ilmastokokous etenee nyt."}'
                        "],"
                        '"language_info":{"code":"fi"}}'
                    ),
                )
                archive.writestr("cop30_pos_analysis.json", '{"pos_counts":{},"pos_words":{}}')

            upload = types.SimpleNamespace(
                filename="cop30_analysis_bundle.zip",
                file=io.BytesIO(archive_buffer.getvalue()),
            )

            original_results_dir = self.api_server.RESULTS_DIR
            original_imported_dir = self.api_server.IMPORTED_WORK_DIR
            self.api_server.RESULTS_DIR = results_dir
            self.api_server.IMPORTED_WORK_DIR = imported_dir
            try:
                imported = asyncio.run(self.api_server.import_saved_work(upload))
                status = self.api_server.analysis_status[imported["analysis_id"]]
                pos_path = Path(status["output_files"]["pos_analysis"])
                pos_payload = pos_path.read_text(encoding="utf-8")

                self.assertIn('"analysis_mode": "lexical_fallback"', pos_payload)
                self.assertIn('"NOUN": 2', pos_payload)
                self.assertEqual(
                    status["event_log"][-1]["details"]["pos_regenerated"], True
                )
            finally:
                self.api_server.RESULTS_DIR = original_results_dir
                self.api_server.IMPORTED_WORK_DIR = original_imported_dir


class MainAppContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _install_api_server_stubs()
        sys.modules.pop("app.main", None)
        cls.main_app = importlib.import_module("app.main")

    def setUp(self):
        self.main_app.analysis_status.clear()

    def test_start_analysis_response_tracks_face_flags_and_start_timestamps(self):
        self.main_app.analysis_status["analysis-start"] = {
            "status": "uploaded",
            "progress": 0,
            "original_filename": "clip.mp4",
            "file_path": "uploads/clip.mp4",
        }

        background_tasks = self.main_app.BackgroundTasks()
        result = asyncio.run(
            self.main_app.analyze_video(
                "analysis-start",
                background_tasks,
                apply_face_anonymization=True,
                face_message_style="starfleet",
                face_requires_person_detection=True,
            )
        )

        status = self.main_app.analysis_status["analysis-start"]
        self.assertEqual(result["analysis_id"], "analysis-start")
        self.assertEqual(result["status"], "processing")
        self.assertTrue(result["apply_face_anonymization"])
        self.assertEqual(result["face_message_style"], "starfleet")
        self.assertTrue(result["face_requires_person_detection"])
        self.assertEqual(status["status"], "processing")
        self.assertEqual(status["progress"], 0)
        self.assertIsNotNone(status["start_time"])
        self.assertIsNotNone(status["analysis_started_at"])
        self.assertIsNone(status["analysis_completed_at"])
        self.assertEqual(len(background_tasks.tasks), 1)
        self.assertEqual(
            background_tasks.tasks[0][1],
            ("analysis-start", True, "starfleet", True),
        )

    def test_completed_status_exposes_summary_and_download_links(self):
        self.main_app.analysis_status["analysis-complete"] = {
            "status": "completed",
            "progress": 100,
            "original_filename": "clip.mp4",
            "apply_face_anonymization": True,
            "face_message_style": "starfleet",
            "face_requires_person_detection": True,
            "uploaded_at": "2026-03-20T10:00:00+00:00",
            "analysis_started_at": "2026-03-20T10:01:00+00:00",
            "analysis_completed_at": "2026-03-20T10:02:30+00:00",
            "start_time": 100.0,
            "end_time": 190.0,
            "results": {
                "yolo_results": [{"id": 1}, {"id": 2}],
                "ocr_results": [{"id": 1}],
                "face_sampling": {
                    "frames_considered": 5,
                    "frames_selected": 3,
                    "frames_skipped_no_person": 2,
                },
            },
            "output_files": {
                "summary_json": "outputs/api_results/analysis-complete/summary.json",
                "face_anonymization_manifest": "outputs/api_results/analysis-complete/manifest.json",
            },
        }

        result = asyncio.run(self.main_app.get_analysis_status("analysis-complete"))

        self.assertEqual(result["processing_time"], 90.0)
        self.assertEqual(result["summary"]["yolo_detections"], 2)
        self.assertEqual(result["summary"]["ocr_detections"], 1)
        self.assertEqual(result["summary"]["face_frames_considered"], 5)
        self.assertEqual(result["summary"]["face_frames_selected"], 3)
        self.assertEqual(result["summary"]["face_frames_skipped_no_person"], 2)
        self.assertIn("summary_json", result["download_links"])
        self.assertIn("face_anonymization_manifest", result["download_links"])

    def test_download_supports_face_anonymization_manifest(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manifest_path = Path(tmpdir) / "manifest.json"
            manifest_path.write_text('{"success": true}', encoding="utf-8")

            self.main_app.analysis_status["analysis-dl"] = {
                "status": "completed",
                "progress": 100,
                "original_filename": "clip.mp4",
                "output_files": {
                    "face_anonymization_manifest": str(manifest_path),
                },
            }

            response = asyncio.run(
                self.main_app.download_file(
                    "analysis-dl", "face_anonymization_manifest"
                )
            )

            self.assertEqual(response.path, str(manifest_path))
            self.assertEqual(response.media_type, "application/json")
            self.assertEqual(
                response.filename,
                "clip_face_anonymization_manifest.json",
            )


if __name__ == "__main__":
    unittest.main()
