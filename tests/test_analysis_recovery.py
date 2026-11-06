import json
from pathlib import Path

import pytest

from src.backend.analysis.analysis_recovery import (
    load_recoverable_json,
    load_analysis_checkpoint,
    recover_interrupted_record,
    write_recoverable_json,
    write_analysis_checkpoint,
)


def test_checkpoint_round_trip_reuses_completed_stage(tmp_path):
    artifact = tmp_path / "visual.json"
    artifact.write_text("{}", encoding="utf-8")
    write_analysis_checkpoint(
        tmp_path,
        "analysis-1",
        completed_stages=["visual"],
        results={"visual_analysis": {"count": 4}},
        output_files={"summary_json": str(artifact)},
        updated_at="2026-08-02T12:00:00Z",
    )

    loaded = load_analysis_checkpoint(tmp_path, "analysis-1")

    assert loaded["completed_stages"] == ["visual"]
    assert loaded["results"]["visual_analysis"]["count"] == 4


def test_checkpoint_is_invalidated_when_an_output_disappears(tmp_path):
    artifact = tmp_path / "gone.json"
    artifact.write_text("{}", encoding="utf-8")
    write_analysis_checkpoint(
        tmp_path,
        "analysis-2",
        completed_stages=["audio"],
        results={"audio_analysis": {}},
        output_files={"transcript": str(artifact)},
        updated_at="2026-08-02T12:00:00Z",
    )
    artifact.unlink()

    loaded = load_analysis_checkpoint(tmp_path, "analysis-2")

    assert loaded["completed_stages"] == []
    assert loaded["checkpoint_invalid"] is True


def test_processing_record_becomes_resumable_after_restart():
    status = {"status": "processing", "mission_stage": "transcription", "progress": 60}

    changed = recover_interrupted_record(status, recovered_at="2026-08-02T12:00:00Z")

    assert changed is True
    assert status["status"] == "uploaded"
    assert status["mission_stage"] == "interrupted"
    assert status["recovery"]["interrupted_stage"] == "transcription"


def test_recoverable_write_keeps_exact_previous_commit_and_receipt(tmp_path):
    path = tmp_path / "analysis_record.json"
    write_recoverable_json(path, {"revision": 1, "value": "first"})
    previous = path.read_bytes()
    receipt = write_recoverable_json(path, {"revision": 2, "value": "second"})

    assert path.with_suffix(".json.bak").read_bytes() == previous
    assert receipt["write_verified"] is True
    assert receipt["backup_sha256"] is not None
    loaded, recovery = load_recoverable_json(path)
    assert loaded["revision"] == 2
    assert recovery is None


def test_corrupt_primary_is_quarantined_and_backup_is_restored(tmp_path):
    path = tmp_path / "analysis_record.json"
    write_recoverable_json(path, {"revision": 1})
    write_recoverable_json(path, {"revision": 2})
    path.write_text("{interrupted", encoding="utf-8")

    restored, receipt = load_recoverable_json(path)

    assert restored == {"revision": 1}
    assert receipt["restored"] is True
    assert Path(receipt["quarantined_primary"]).read_text(encoding="utf-8") == "{interrupted"
    assert json.loads(path.read_text(encoding="utf-8")) == {"revision": 1}


def test_recovery_fails_closed_when_primary_and_backup_are_invalid(tmp_path):
    path = tmp_path / "analysis_record.json"
    path.write_text("broken", encoding="utf-8")
    path.with_suffix(".json.bak").write_text("also broken", encoding="utf-8")

    with pytest.raises(ValueError, match="Primary and backup"):
        load_recoverable_json(path)

    assert path.read_text(encoding="utf-8") == "broken"
