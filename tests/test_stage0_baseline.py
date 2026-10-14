import hashlib
import json
from pathlib import Path

from scripts.verify_stage0_baseline import build_baseline
from scripts.repair_project_full_analysis_manifests import repair


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_stage0_baseline_proves_identity_artifacts_and_recovery(tmp_path: Path) -> None:
    analysis_id = "analysis-a"
    source = tmp_path / "uploads" / f"{analysis_id}.mp4"
    source.parent.mkdir()
    source.write_bytes(b"source")
    artifact = tmp_path / "outputs" / "artifact.json"
    _write_json(artifact, {"rows": [1]})
    checksum = "sha256:" + hashlib.sha256(artifact.read_bytes()).hexdigest()
    directory = tmp_path / "outputs" / "api_results" / analysis_id
    _write_json(
        directory / "analysis_record.json",
        {
            "analysis_id": analysis_id,
            "project_id": "project-a",
            "filename": source.name,
            "source_video_path": str(source.relative_to(tmp_path)),
            "status": "completed",
            "canonical_decision_ledger": {"analysis_id": analysis_id, "decisions": []},
        },
    )
    _write_json(
        directory / "full_analysis_manifest.json",
        {
            "analysis_id": analysis_id,
            "branches": [{"branch_id": "fixture", "artifact_path": str(artifact), "artifact_checksum": checksum}],
        },
    )
    _write_json(directory / "annotation_corrections.json", {"analysis_id": analysis_id, "rules": []})

    report = build_baseline(tmp_path, "project-a")

    assert report["summary"] == {"gate": "pass", "analysis_count": 1, "completed_count": 1, "issue_count": 0}
    assert report["analyses"][0]["artifacts"] == {"registered": 1, "present": 1, "checksum_verified": 1}
    assert report["analyses"][0]["source_media"]["fingerprint"].startswith("sha256:")
    assert set(report["analyses"][0]["recovery_fingerprints"]) == {
        "analysis_record.json",
        "annotation_corrections.json",
        "embedded_canonical_decision_ledger",
    }


def test_stage0_baseline_fails_closed_on_cross_identity_and_missing_artifact(tmp_path: Path) -> None:
    directory = tmp_path / "outputs" / "api_results" / "directory-id"
    _write_json(
        directory / "analysis_record.json",
        {
            "analysis_id": "record-id",
            "project_id": "project-a",
            "source_video_path": "uploads/missing.mp4",
            "status": "completed",
            "canonical_decision_ledger": {"analysis_id": "foreign-id", "decisions": []},
        },
    )
    _write_json(
        directory / "full_analysis_manifest.json",
        {
            "analysis_id": "foreign-id",
            "branches": [{"branch_id": "missing", "artifact_path": "outputs/missing.json"}],
        },
    )

    report = build_baseline(tmp_path, "project-a")

    assert report["summary"]["gate"] == "fail"
    assert {issue["code"] for issue in report["issues"]} >= {
        "ANALYSIS_DIRECTORY_ID_MISMATCH",
        "SOURCE_MEDIA_MISSING",
        "MANIFEST_ANALYSIS_ID_MISMATCH",
        "ARTIFACT_MISSING:missing",
        "CANONICAL_LEDGER_ID_MISMATCH",
    }


def test_manifest_repair_is_dry_run_by_default(tmp_path: Path) -> None:
    directory = tmp_path / "outputs" / "api_results" / "analysis-a"
    _write_json(directory / "analysis_record.json", {"analysis_id": "analysis-a", "project_id": "project-a"})

    result = repair(tmp_path, "project-a", apply=False)

    assert result == {"project_id": "project-a", "mode": "dry_run", "analysis_count": 1}
    assert not (tmp_path / "backups").exists()
