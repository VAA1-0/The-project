import json
from pathlib import Path

from src.backend.analysis.supply_chain_security import (
    assess_model_manifest,
    assess_npm_lock,
    assess_python_requirements,
    build_supply_chain_assessment,
)


def test_python_versions_without_distribution_hashes_are_not_fully_qualified(tmp_path: Path):
    requirements = tmp_path / "requirements.txt"
    requirements.write_text("alpha==1.2.3\nbeta>=2\n", encoding="utf-8")
    result = assess_python_requirements(requirements)
    assert result["unpinned_entries"] == ["beta>=2"]
    assert result["unhashed_dependencies"] == ["alpha"]
    assert result["artifact_integrity_complete"] is False


def test_hashed_python_requirement_is_qualified(tmp_path: Path):
    requirements = tmp_path / "requirements.txt"
    requirements.write_text("alpha==1.2.3 --hash=sha256:abc\n", encoding="utf-8")
    result = assess_python_requirements(requirements)
    assert result["artifact_integrity_complete"] is True


def test_multiline_hashed_python_requirement_is_qualified(tmp_path: Path):
    requirements = tmp_path / "requirements.txt"
    requirements.write_text("alpha==1.2.3 \\\n+    --hash=sha256:abc\n", encoding="utf-8")
    result = assess_python_requirements(requirements)
    assert result["artifact_integrity_complete"] is True


def test_npm_dependency_requires_resolved_integrity(tmp_path: Path):
    lock = tmp_path / "package-lock.json"
    lock.write_text(json.dumps({"lockfileVersion": 3, "packages": {"": {}, "node_modules/a": {"version": "1.0", "resolved": "https://registry/a.tgz"}}}), encoding="utf-8")
    result = assess_npm_lock(lock)
    assert result["missing_integrity_entries"] == ["node_modules/a"]


def test_model_manifest_verifies_commit_hash_license_size_and_content(tmp_path: Path):
    model = tmp_path / "model.bin"
    model.write_bytes(b"model")
    import hashlib
    manifest = tmp_path / "datascene_model_manifest.json"
    manifest.write_text(json.dumps({
        "schema": "datascene.local_model_installation.v1",
        "model_id": "fixture/model",
        "resolved_revision": "a" * 40,
        "license": "Apache-2.0",
        "local_only_after_install": True,
        "files": {"model.bin": {"bytes": 5, "sha256": hashlib.sha256(b"model").hexdigest()}},
    }), encoding="utf-8")
    assert assess_model_manifest(manifest)["verified"] is True
    model.write_bytes(b"other")
    assert assess_model_manifest(manifest)["verified"] is False


def test_repository_assessment_does_not_confuse_hash_lock_with_platform_install_acceptance():
    result = build_supply_chain_assessment(Path(__file__).resolve().parents[1])
    assert result["python"]["artifact_integrity_complete"] is True
    assert "python_distribution_hashes_missing" not in result["release_blockers"]
    assert "platform_install_and_installer_integrity_evidence_missing" in result["release_blockers"]
