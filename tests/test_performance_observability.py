import json
from pathlib import Path

from src.backend.analysis.performance_observability import write_performance_observation


def test_observer_persists_actual_analysis_record(tmp_path: Path):
    source = tmp_path / "test.mp4"
    source.write_bytes(b"source")
    artifact = tmp_path / "transcript.json"
    artifact.write_text(json.dumps({"segments": []}), encoding="utf-8")
    status = {
        "analysis_id": "analysis-observed",
        "status": "completed",
        "progress": 100,
        "start_time": 1_700_000_000,
        "analysis_completed_at": "2026-08-02T12:00:00+00:00",
        "source_size_bytes": source.stat().st_size,
        "source_media_metadata": {"duration": 10, "fps": 25, "width": 1280, "height": 720},
        "output_files": {"transcript": str(artifact)},
        "event_log": [{"event_id": "event:1", "event_type": "analysis_completed", "stage": "science_scan", "timestamp": "2026-08-02T12:00:00+00:00"}],
    }
    record = write_performance_observation(status, tmp_path / "results")
    assert record["schema_version"] == "1.0.0"
    assert record["pipeline_observations"][0]["stage_name"] == "science_scan"
    assert record["analysis_target"]["duration_seconds"] == 10
    assert "operational_verdict" in record
    assert (tmp_path / "results" / "analysis-observed" / "observability" / "performance_observability_latest.json").is_file()
