import json
import tempfile
import unittest
from pathlib import Path

from src.backend.analysis.reproducible_measurement import ReproducibleMeasurementService
from src.backend.analysis.statskit_agent import StatsKitAgent


def write(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")


def fixture(tmp_path: Path):
    analysis_id = "analysis-1"
    root = tmp_path / "outputs"
    analysis = root / "api_results" / analysis_id
    write(root / "transcripts" / f"{analysis_id}_transcript.json", {
        "timing_authority": "original_whisper_timecode",
        "segments": [{"id": "s1", "start": 0, "end": 2, "text": "Measured words arrive."},
                     {"id": "bad", "start": 3, "end": 3, "text": "excluded"}],
    })
    write(root / "transcripts" / f"{analysis_id}_audio_diarization.json", {
        "measurement": {"duration_seconds": 10, "transcript_timing_authority": {"strategy": "canonical"}},
        "speaker_turns": [{"turn_id": "t1", "speaker_label": "SPEAKER_00", "start": 0, "end": 2}],
        "vad_segments": [{"segment_id": "v1", "start": 1, "end": 4}, {"segment_id": "v2", "start": 3, "end": 5}],
    })
    write(analysis / "source_media_metadata.json", {"duration_seconds": 10})
    write(analysis / "vaa1_annotation_master_schema.json", {"temporal_segments": [
        {"segment_id": "scene1", "segment_type": "scene", "start": 0, "end": 5},
        {"segment_id": "scene2", "segment_type": "scene", "start": 5, "end": 10},
    ]})
    objects = root / "artifacts" / "objects.json"
    ocr = root / "artifacts" / "ocr.json"
    expressions = root / "artifacts" / "expressions.json"
    prosody = root / "artifacts" / "prosody.json"
    shots = root / "artifacts" / "shots.json"
    write(objects, [{"timestamp": 1, "track_id": 1, "class_name": "person", "confidence": .8},
                    {"timestamp": 2, "track_id": 2, "class_name": "car", "confidence": .6}])
    write(ocr, {"anchors": [{"anchor_id": "a1", "t_start_ms": 1000}],
                "objects": [{"anchor_id": "a1", "payload": {"text": "Title"}}]})
    write(expressions, [{"timestamp": 1, "quality": "measured", "face_signal": {"level": "present"},
                         "expression_evidence": {"dominant_emotion_ready": True}}])
    write(prosody, {"cues": [{"start": 0, "end": 2, "pace": {"words_per_second": 2},
                                "emphasis": {"label": "strong"}}]})
    write(shots, {"intervals": [{"start": 0, "end": 4}, {"start": 4, "end": 10}]})
    write(analysis / "analysis_record.json", {"output_files": {
        "tracked_objects_json": str(objects), "time_bank_ocr": str(ocr),
        "expression_json": str(expressions), "audio_prosody": str(prosody),
        "shot_boundaries": str(shots),
    }})
    return analysis_id, root, analysis


class ReproducibleMeasurementTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="vaa1-measurement-test-")
        self.tmp_path = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def test_run_is_reproducible_traceable_and_persisted(self):
        analysis_id, root, analysis = fixture(self.tmp_path)
        service = ReproducibleMeasurementService(analysis_id, analysis, root)
        first, second = service.run(), service.run()
        a, b = first["measurement_run"], second["measurement_run"]
        self.assertEqual(a["content_fingerprint"], b["content_fingerprint"])
        self.assertEqual(a["run_id"], b["run_id"])
        self.assertEqual(a["measurements"]["voice_activity"]["speech_seconds"], 4)
        self.assertEqual(a["measurements"]["voice_activity"]["speech_ratio"], .4)
        self.assertEqual(a["exclusions"][0]["reason"], "invalid_or_out_of_scope_interval")
        self.assertEqual(a["affected_branch_plan"]["changed_nodes"], ["measurement_run_service"])
        self.assertTrue(all(item["evidence_refs"] for item in first["native_findings"]))
        self.assertEqual(a["measurements"]["objects"]["detection_count"], 2)
        self.assertEqual(a["measurements"]["ocr"]["region_count"], 1)
        self.assertEqual(a["measurements"]["expressions"]["expression_ready_count"], 1)
        self.assertEqual(a["measurements"]["prosody"]["cue_count"], 1)
        self.assertEqual(a["measurements"]["shot_boundaries"]["interval_count"], 2)
        stored = analysis / "stats_runs" / a["run_id"] / "measurement_run.json"
        self.assertEqual(json.loads(stored.read_text())["content_fingerprint"], a["content_fingerprint"])

    def test_quality_controls_use_without_hiding_measurement(self):
        analysis_id, root, analysis = fixture(self.tmp_path)
        run = ReproducibleMeasurementService(analysis_id, analysis, root).run(persist=False)["measurement_run"]
        speaker_quality = run["evidence_quality"]["voice_and_speakers"]
        self.assertEqual(speaker_quality["uses"]["inspect"]["visibility"], "visible")
        self.assertIsNone(speaker_quality["assessment"]["confidence"])
        self.assertEqual(run["measurements"]["speaker_turns"]["turn_count"], 1)

    def test_legacy_mock_branches_no_longer_emit_results(self):
        agent = StatsKitAgent("a", self.tmp_path)
        base = {"method_id": "m", "output_type": "matrix", "input_variables": []}
        self.assertEqual(agent._execute_method({**base, "method_family": "correlation", "method_name": "correlation_heatmap"}, {}), [])
        self.assertEqual(agent._execute_method({**base, "method_family": "network", "method_name": "simple_network_metrics"}, {}), [])


if __name__ == "__main__":
    unittest.main()
