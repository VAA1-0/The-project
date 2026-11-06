import json
from pathlib import Path

import pytest

from src.backend.analysis.project_format_migration import (
    CURRENT_FORMAT_VERSION,
    ProjectFormatError,
    build_bundle_output_inventory,
    build_current_project_manifest,
    inspect_project_manifest,
    migrate_legacy_project_manifest,
    restore_bundle_output_inventory,
)


def test_current_manifest_is_accepted_without_migration():
    manifest = build_current_project_manifest(
        {"project_type": "vaa1_project_bundle", "project_id": "p-1"}
    )
    inspection = inspect_project_manifest(manifest)
    assert inspection.disposition == "current"
    assert inspection.requires_migration is False


def test_current_envelope_preserves_project_domain_fields():
    manifest = build_current_project_manifest(
        {
            "project_type": "vaa1_project_bundle",
            "project_id": "p-1",
            "project_name": "Project One",
            "matrices": {"comparison": [1, 2]},
        }
    )
    assert manifest["project_id"] == "p-1"
    assert manifest["matrices"] == {"comparison": [1, 2]}
    assert manifest["compatibility"]["downgrade_policy"] == "unsupported_fail_closed"


def test_legacy_manifest_is_migrated_after_byte_exact_backup(tmp_path: Path):
    original = b'{"project_type":"vaa1_project_bundle","project_id":"legacy"}'
    migrated, receipt = migrate_legacy_project_manifest(
        json.loads(original),
        original_bytes=original,
        backup_root=tmp_path,
        migrated_at="2026-11-06T00:00:00+00:00",
    )
    assert migrated["format_version"] == CURRENT_FORMAT_VERSION
    assert Path(receipt["backup_path"]).read_bytes() == original
    assert receipt["source_preserved"] is True
    assert Path(receipt["receipt_path"]).exists()


def test_newer_manifest_fails_closed_instead_of_downgrading():
    with pytest.raises(ProjectFormatError, match="newer than supported"):
        inspect_project_manifest(
            {
                "schema": "vaa1.project_manifest.v2",
                "format_version": CURRENT_FORMAT_VERSION + 1,
                "project_type": "vaa1_project_bundle",
            }
        )


@pytest.mark.parametrize(
    "manifest",
    [
        {},
        {"project_type": "another_bundle"},
        {"project_type": "vaa1_project_bundle", "format_version": "1"},
        {"project_type": "vaa1_project_bundle", "format_version": 1},
    ],
)
def test_malformed_or_ambiguous_manifests_are_rejected(manifest):
    with pytest.raises(ProjectFormatError):
        inspect_project_manifest(manifest)


def test_output_inventory_restores_unknown_semantic_file_key(tmp_path: Path):
    source = tmp_path / "novel_artifact.data"
    source.write_bytes(b"mature-data")
    inventory = build_bundle_output_inventory(
        {"future_mature_artifact": str(source)},
        {"future_mature_artifact": "preserved.data"},
    )
    bundled = tmp_path / "bundle"
    bundled.mkdir()
    (bundled / "preserved.data").write_bytes(source.read_bytes())
    restored = restore_bundle_output_inventory(bundled, inventory)
    assert restored["future_mature_artifact"] == str((bundled / "preserved.data").resolve())


def test_output_inventory_rejects_tampering_and_traversal(tmp_path: Path):
    bundled = tmp_path / "bundle"
    bundled.mkdir()
    artifact = bundled / "artifact.json"
    artifact.write_bytes(b"original")
    inventory = build_bundle_output_inventory({"artifact": str(artifact)}, {})
    artifact.write_bytes(b"tampered")
    with pytest.raises(ProjectFormatError, match="mismatch"):
        restore_bundle_output_inventory(bundled, inventory)
    unsafe = {"artifact": {"archive_name": "../outside", "size_bytes": 0, "sha256": ""}}
    (tmp_path / "outside").write_bytes(b"")
    with pytest.raises(ProjectFormatError, match="Unsafe"):
        restore_bundle_output_inventory(bundled, unsafe)
