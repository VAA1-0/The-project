"""Version and migrate VAA1 project manifests without rewriting source evidence."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping
from uuid import uuid4


SCHEMA = "vaa1.project_manifest.v1"
CURRENT_FORMAT_VERSION = 1
PROJECT_TYPE = "vaa1_project_bundle"
DOWNGRADE_POLICY = "unsupported_fail_closed"


class ProjectFormatError(ValueError):
    """Raised when a project manifest cannot be safely interpreted."""


@dataclass(frozen=True)
class ProjectFormatInspection:
    disposition: str
    source_version: int | None
    target_version: int
    requires_migration: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "disposition": self.disposition,
            "source_version": self.source_version,
            "target_version": self.target_version,
            "requires_migration": self.requires_migration,
            "downgrade_policy": DOWNGRADE_POLICY,
        }


def inspect_project_manifest(payload: Mapping[str, Any]) -> ProjectFormatInspection:
    if not isinstance(payload, Mapping):
        raise ProjectFormatError("Project manifest must be a JSON object")
    if payload.get("project_type") != PROJECT_TYPE:
        raise ProjectFormatError("Unsupported or missing project_type")

    raw_version = payload.get("format_version")
    schema = payload.get("schema")
    if raw_version is None and schema is None:
        return ProjectFormatInspection("legacy_migration_required", None, CURRENT_FORMAT_VERSION, True)
    if isinstance(raw_version, bool) or not isinstance(raw_version, int) or raw_version < 1:
        raise ProjectFormatError("format_version must be a positive integer")
    if raw_version > CURRENT_FORMAT_VERSION:
        raise ProjectFormatError(
            f"Project format {raw_version} is newer than supported format {CURRENT_FORMAT_VERSION}; "
            "downgrade is not automatic"
        )
    if raw_version < CURRENT_FORMAT_VERSION:
        raise ProjectFormatError(
            f"No governed migration path exists from project format {raw_version}"
        )
    if schema != SCHEMA:
        raise ProjectFormatError(f"Project format {raw_version} requires schema {SCHEMA}")
    return ProjectFormatInspection("current", raw_version, CURRENT_FORMAT_VERSION, False)


def build_current_project_manifest(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Return the current envelope while preserving project-domain fields."""
    manifest = dict(payload)
    manifest.update(
        {
            "schema": SCHEMA,
            "format_version": CURRENT_FORMAT_VERSION,
            "project_type": PROJECT_TYPE,
            "compatibility": {
                "minimum_reader_version": CURRENT_FORMAT_VERSION,
                "downgrade_policy": DOWNGRADE_POLICY,
            },
        }
    )
    return manifest


def migrate_legacy_project_manifest(
    payload: Mapping[str, Any],
    *,
    original_bytes: bytes,
    backup_root: Path,
    migrated_at: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    inspection = inspect_project_manifest(payload)
    if not inspection.requires_migration:
        return dict(payload), {**inspection.as_dict(), "backup_path": None, "source_sha256": None}

    backup_root = Path(backup_root)
    backup_root.mkdir(parents=True, exist_ok=True)
    migration_id = f"project-manifest-{uuid4()}"
    backup_path = backup_root / f"{migration_id}.legacy.json"
    backup_path.write_bytes(original_bytes)
    source_sha256 = hashlib.sha256(original_bytes).hexdigest()
    timestamp = migrated_at or datetime.now(timezone.utc).isoformat()
    migrated = build_current_project_manifest(payload)
    receipt = {
        **inspection.as_dict(),
        "schema": "vaa1.project_manifest_migration_receipt.v1",
        "migration_id": migration_id,
        "migrated_at": timestamp,
        "backup_path": str(backup_path),
        "source_sha256": source_sha256,
        "source_preserved": backup_path.read_bytes() == original_bytes,
        "changes": ["add schema", "add format_version", "add compatibility policy"],
    }
    receipt_path = backup_root / f"{migration_id}.receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False), encoding="utf-8")
    receipt["receipt_path"] = str(receipt_path)
    return migrated, receipt


def build_bundle_output_inventory(
    output_files: Mapping[str, Any], file_mapping: Mapping[str, str]
) -> dict[str, Any]:
    inventory: dict[str, Any] = {}
    for file_type, raw_path in output_files.items():
        if not raw_path:
            continue
        path = Path(str(raw_path))
        if not path.is_file():
            continue
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        inventory[str(file_type)] = {
            "archive_name": file_mapping.get(str(file_type), path.name),
            "size_bytes": path.stat().st_size,
            "sha256": digest.hexdigest(),
        }
    return inventory


def restore_bundle_output_inventory(
    root: Path, inventory: Mapping[str, Any] | None
) -> dict[str, str]:
    restored: dict[str, str] = {}
    root = Path(root).resolve(strict=True)
    for file_type, descriptor in (inventory or {}).items():
        if not isinstance(descriptor, Mapping):
            raise ProjectFormatError(f"Invalid output inventory entry for {file_type}")
        archive_name = str(descriptor.get("archive_name") or "")
        candidate = (root / archive_name).resolve(strict=True)
        if candidate.parent != root or not candidate.is_file():
            raise ProjectFormatError(f"Unsafe or missing bundled output for {file_type}")
        content = candidate.read_bytes()
        if len(content) != int(descriptor.get("size_bytes")):
            raise ProjectFormatError(f"Bundled output size mismatch for {file_type}")
        if hashlib.sha256(content).hexdigest() != descriptor.get("sha256"):
            raise ProjectFormatError(f"Bundled output checksum mismatch for {file_type}")
        restored[str(file_type)] = str(candidate)
    return restored
