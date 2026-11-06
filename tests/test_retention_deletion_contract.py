from pathlib import Path

from src.backend.analysis.retention_deletion import build_deletion_plan, execute_deletion_plan


def roots(tmp_path: Path) -> dict:
    values = {
        "upload_root": tmp_path / "uploads",
        "results_root": tmp_path / "outputs" / "api_results",
        "imported_root": tmp_path / "outputs" / "imported_work",
        "publication_root": tmp_path / "outputs" / "publications",
        "audio_root": tmp_path / "outputs" / "audio",
        "transcript_root": tmp_path / "outputs" / "transcripts",
    }
    for value in values.values():
        value.mkdir(parents=True, exist_ok=True)
    return values


def test_deletion_removes_managed_derivatives_but_preserves_external_source(tmp_path: Path):
    configured = roots(tmp_path)
    analysis_id = "analysis-1"
    analysis_dir = configured["results_root"] / analysis_id
    analysis_dir.mkdir()
    (analysis_dir / "embedding.json").write_text("sensitive", encoding="utf-8")
    publication = configured["publication_root"] / "videos" / analysis_id
    publication.mkdir(parents=True)
    (publication / "package.zip").write_bytes(b"publication")
    external = tmp_path / "user-library" / "source.mp4"
    external.parent.mkdir()
    external.write_bytes(b"source")
    plan = build_deletion_plan(analysis_id, {"source_video_path": str(external), "source_video_external": True}, **configured)
    receipt = execute_deletion_plan(plan)
    assert receipt["status"] == "complete"
    assert not analysis_dir.exists()
    assert not publication.exists()
    assert external.read_bytes() == b"source"
    assert receipt["retained_external"][0]["reason"] == "source_deletion_requires_separate_navigation_and_authority"


def test_analysis_deletion_preserves_managed_original_source(tmp_path: Path):
    configured = roots(tmp_path)
    source = configured["upload_root"] / "original.mp4"
    source.write_bytes(b"original")
    plan = build_deletion_plan(
        "analysis-source-split",
        {"file_path": str(source), "output_files": {"source_video": str(source)}},
        **configured,
    )
    receipt = execute_deletion_plan(plan)
    assert receipt["status"] == "complete"
    assert source.read_bytes() == b"original"
    assert receipt["policy"]["delete_original_source_media"] is False
    assert all(item["path"] != str(source.resolve()) for item in plan["managed_targets"])


def test_nested_original_survives_analysis_directory_deletion(tmp_path: Path):
    configured = roots(tmp_path)
    analysis_dir = configured["results_root"] / "nested-source"
    analysis_dir.mkdir()
    source = analysis_dir / "source_video.mp4"
    derivative = analysis_dir / "transcript.json"
    source.write_bytes(b"original")
    derivative.write_text("derived", encoding="utf-8")
    plan = build_deletion_plan(
        "nested-source",
        {"source_video_path": str(source), "output_files": {"source_video": str(source), "transcript": str(derivative)}},
        **configured,
    )
    receipt = execute_deletion_plan(plan)
    assert receipt["status"] == "complete"
    assert source.read_bytes() == b"original"
    assert not derivative.exists()


def test_project_derivatives_and_local_backups_leave_with_analysis(tmp_path: Path):
    configured = roots(tmp_path)
    analysis_id = "analysis-2"
    analysis_dir = configured["results_root"] / analysis_id
    analysis_dir.mkdir()
    (analysis_dir / "analysis_record.json.bak").write_text("backup", encoding="utf-8")
    continuity = configured["results_root"] / "project_continuity" / "project-a"
    continuity.mkdir(parents=True)
    (continuity / "state.json").write_text(analysis_id, encoding="utf-8")
    corpus = configured["publication_root"] / "corpora" / "project-a"
    corpus.mkdir(parents=True)
    (corpus / "report.json").write_text(analysis_id, encoding="utf-8")
    receipt = execute_deletion_plan(build_deletion_plan(analysis_id, {"project_id": "project-a"}, **configured))
    assert receipt["status"] == "complete"
    assert not analysis_dir.exists()
    assert not continuity.exists()
    assert not corpus.exists()


def test_invalid_analysis_identity_is_rejected(tmp_path: Path):
    configured = roots(tmp_path)
    try:
        build_deletion_plan("../escape", {}, **configured)
    except ValueError as exc:
        assert "Invalid analysis ID" in str(exc)
    else:
        raise AssertionError("unsafe identity was accepted")


def test_filesystem_failure_is_reported_as_partial_not_success(tmp_path: Path, monkeypatch):
    configured = roots(tmp_path)
    analysis_id = "analysis-3"
    bundle = configured["results_root"] / f"{analysis_id}_bundle.zip"
    bundle.write_bytes(b"bundle")
    original_unlink = Path.unlink

    def fail_bundle(path: Path, *args, **kwargs):
        if path == bundle:
            raise OSError("simulated unavailable drive")
        return original_unlink(path, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", fail_bundle)
    receipt = execute_deletion_plan(build_deletion_plan(analysis_id, {}, **configured))
    assert receipt["status"] == "partial_failure"
    assert receipt["failures"][0]["category"] == "analysis_bundle"
    assert bundle.exists()
