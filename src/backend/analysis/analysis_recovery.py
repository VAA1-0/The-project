"""Durable stage checkpoints for restart-safe VAA1 analysis runs."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Iterable


CHECKPOINT_FILENAME = "analysis_checkpoint.json"


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False, default=str)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


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
