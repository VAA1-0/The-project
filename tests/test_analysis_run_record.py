from pathlib import Path

from src.backend.analysis.analysis_run_record import (
    RECORD_FILENAME,
    SCHEMA,
    analysis_run_record_path,
    build_analysis_run_record,
    capture_resource_observation,
    runtime_provider_versions,
    update_resource_use,
)


def test_canonical_run_receipt_is_bounded_and_preserves_effective_setup() -> None:
    record = build_analysis_run_record(
        {
            "analysis_id": "analysis-1",
            "project_id": "project-1",
            "status": "processing",
            "original_filename": "source.mp4",
            "analysis_started_at": "2026-10-22T10:00:00+00:00",
            "analysis_tier": "quick_sweep",
            "modality_focus": "multimodal",
            "pipeline_type": "full",
            "analysis_profile": {
                "analysis_tier": "quick_sweep",
                "modality_focus": "multimodal",
                "pipeline_type": "full",
                "detection_interval_seconds": 10.0,
            },
            "model_choices": {"transcript": "local-whisper"},
            "provider_versions": {"transcript": "whisper:1"},
            "runtime_dependencies": {
                "ready": True,
                "executables": {"ffmpeg": "/runtime/ffmpeg", "ffprobe": "/runtime/ffprobe"},
                "missing": [],
            },
            "resource_use": {"memory_peak_bytes": 10},
            "output_files": {"transcript": "/tmp/transcript.json"},
            "results": {"objects_error": "disabled by quick sweep"},
        }
    )

    assert record["schema"] == SCHEMA
    assert record["setup"]["analysis_tier"] == "quick_sweep"
    assert record["setup"]["effective_settings"]["detection_interval_seconds"] == 10.0
    assert record["runtime"]["model_choices"]["transcript"] == "local-whisper"
    assert record["runtime"]["dependencies"]["ready"] is True
    assert record["artifact_references"] == [
        {"role": "transcript", "path": "/tmp/transcript.json"}
    ]
    assert "disabled by quick sweep" in record["outcome"]["fallback_reasons"]
    assert record["missing_fields"] == []


def test_canonical_run_receipt_exposes_unknown_legacy_fields_without_invention() -> None:
    record = build_analysis_run_record(
        {"analysis_id": "legacy", "status": "completed", "pipeline_type": "full"}
    )

    assert record["runtime"]["model_choices"] == {}
    assert record["runtime"]["provider_versions"] == {}
    assert record["resources"] == {}
    assert record["missing_fields"] == [
        "runtime.model_choices",
        "runtime.provider_versions",
        "resources",
    ]


def test_run_receipt_has_one_canonical_filename() -> None:
    assert analysis_run_record_path(Path("/analysis")) == Path("/analysis") / RECORD_FILENAME


def test_runtime_and_resource_observations_are_real_and_bounded(tmp_path: Path) -> None:
    versions = runtime_provider_versions()
    first = capture_resource_observation(tmp_path)
    second = {**first, "process_rss_bytes": int(first.get("process_rss_bytes") or 0) + 10}
    resource_use = update_resource_use(update_resource_use({}, first), second)

    assert versions["python"]
    assert versions["datascene_analysis_run_record"] == "1.0.0"
    assert resource_use["start"]["observed_at"] == first["observed_at"]
    assert resource_use["current"]["process_rss_bytes"] == second["process_rss_bytes"]
    assert resource_use["peak"]["process_rss_bytes"] == second["process_rss_bytes"]
    assert set(resource_use) == {"start", "current", "peak"}
