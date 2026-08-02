from src.backend.analysis.analysis_recovery import (
    load_analysis_checkpoint,
    recover_interrupted_record,
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
