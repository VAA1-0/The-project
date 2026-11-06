"""Durable stage checkpoints for restart-safe VAA1 analysis runs."""

from __future__ import annotations

import json
import hashlib
import os
import uuid
from pathlib import Path
from typing import Any, Iterable


CHECKPOINT_FILENAME = "analysis_checkpoint.json"


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _atomic_write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # A panel save and the background analysis may persist the same record at
    # nearly the same time. A per-write temporary name prevents one writer from
    # replacing or unlinking the other writer's temporary file.
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False, default=str)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def write_recoverable_json(path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    """Atomically write JSON while retaining the exact previous committed bytes."""
    destination = Path(path)
    backup_path = destination.with_suffix(destination.suffix + ".bak")
    receipt_path = destination.with_suffix(destination.suffix + ".recovery.json")
    previous = destination.read_bytes() if destination.exists() else None
    if previous is not None:
        # Never promote unreadable state into the recovery slot.
        decoded = json.loads(previous.decode("utf-8"))
        if not isinstance(decoded, dict):
            raise ValueError(f"Existing {destination.name} is not a JSON object")
        _atomic_write_bytes(backup_path, previous)

    atomic_write_json(destination, payload)
    committed = destination.read_bytes()
    verified = json.loads(committed.decode("utf-8"))
    if not isinstance(verified, dict):
        raise ValueError(f"Committed {destination.name} is not a JSON object")
    receipt = {
        "schema": "vaa1.recoverable_json_write.v1",
        "primary_path": str(destination),
        "primary_sha256": _sha256(committed),
        "backup_path": str(backup_path) if backup_path.exists() else None,
        "backup_sha256": _sha256(backup_path.read_bytes()) if backup_path.exists() else None,
        "write_verified": True,
    }
    atomic_write_json(receipt_path, receipt)
    return receipt


def load_recoverable_json(path: Path) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Load the primary object, or quarantine it and restore a verified backup."""
    destination = Path(path)

    def decode(content: bytes, label: str) -> dict[str, Any]:
        try:
            value = json.loads(content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError(f"{label} is unreadable") from exc
        if not isinstance(value, dict):
            raise ValueError(f"{label} must contain a JSON object")
        return value

    try:
        return decode(destination.read_bytes(), destination.name), None
    except (OSError, ValueError) as primary_error:
        backup_path = destination.with_suffix(destination.suffix + ".bak")
        try:
            backup_bytes = backup_path.read_bytes()
            restored = decode(backup_bytes, backup_path.name)
        except (OSError, ValueError) as backup_error:
            raise ValueError(
                f"Primary and backup are unavailable: {primary_error}; {backup_error}"
            ) from backup_error
        quarantine_path = destination.with_name(
            f"{destination.name}.corrupt-{uuid.uuid4().hex}"
        )
        if destination.exists():
            destination.replace(quarantine_path)
        _atomic_write_bytes(destination, backup_bytes)
        recovery = {
            "schema": "vaa1.recoverable_json_restore.v1",
            "restored": True,
            "restored_from": str(backup_path),
            "restored_sha256": _sha256(backup_bytes),
            "quarantined_primary": str(quarantine_path) if quarantine_path.exists() else None,
            "reason": str(primary_error),
        }
        atomic_write_json(
            destination.with_suffix(destination.suffix + ".restore.json"), recovery
        )
        return restored, recovery


def checkpoint_path(results_dir: Path, analysis_id: str) -> Path:
    return results_dir / analysis_id / CHECKPOINT_FILENAME


def write_analysis_checkpoint(
    results_dir: Path,
    analysis_id: str,
    *,
    completed_stages: Iterable[str],
    results: dict[str, Any],
    output_files: dict[str, Any],
    updated_at: str,
) -> Path:
    path = checkpoint_path(results_dir, analysis_id)
    atomic_write_json(path, {
        "schema": "vaa1.analysis_checkpoint.v1",
        "analysis_id": analysis_id,
        "completed_stages": sorted(set(completed_stages)),
        "results": results,
        "output_files": output_files,
        "updated_at": updated_at,
    })
    return path


def load_analysis_checkpoint(results_dir: Path, analysis_id: str) -> dict[str, Any]:
    path = checkpoint_path(results_dir, analysis_id)
    if not path.exists():
        return {
            "completed_stages": [],
            "results": {},
            "output_files": {},
        }
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "completed_stages": [],
            "results": {},
            "output_files": {},
            "checkpoint_invalid": True,
        }
    if payload.get("analysis_id") != analysis_id:
        return {
            "completed_stages": [],
            "results": {},
            "output_files": {},
            "checkpoint_invalid": True,
        }

    output_files = payload.get("output_files") if isinstance(payload.get("output_files"), dict) else {}
    missing = [
        key
        for key, value in output_files.items()
        if value and not Path(str(value)).exists()
    ]
    if missing:
        return {
            "completed_stages": [],
            "results": {},
            "output_files": {},
            "checkpoint_invalid": True,
            "missing_output_keys": missing,
        }
    return payload


def recover_interrupted_record(status: dict[str, Any], *, recovered_at: str) -> bool:
    """Make a persisted in-flight record launchable after process restart."""
    if status.get("status") != "processing":
        return False
    previous_stage = status.get("mission_stage")
    previous_progress = status.get("progress")
    status["status"] = "uploaded"
    status["mission_stage"] = "interrupted"
    status["mission_message"] = "Previous runtime stopped. Analysis can resume from its latest checkpoint."
    status["recovery"] = {
        **(status.get("recovery") if isinstance(status.get("recovery"), dict) else {}),
        "resumable": True,
        "interrupted_stage": previous_stage,
        "interrupted_progress": previous_progress,
        "recovered_at": recovered_at,
    }
    return True
