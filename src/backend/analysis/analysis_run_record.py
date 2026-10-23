"""Bounded canonical receipt for every governed Datascene analysis run."""

from __future__ import annotations

from datetime import datetime, timezone
from importlib import metadata
import os
from pathlib import Path
import platform
import shutil
import sys
from typing import Any, Mapping


SCHEMA = "vaa1.analysis_run_record.v1"
RECORD_FILENAME = "analysis_run_record.json"


def runtime_provider_versions() -> dict[str, str]:
    """Report the local runtime actually available without importing heavy models."""

    versions = {
        "python": platform.python_version(),
        "datascene_analysis_run_record": "1.0.0",
    }
    for distribution in ("opencv-python", "torch", "openai-whisper", "spacy", "transformers"):
        try:
            versions[distribution] = metadata.version(distribution)
        except metadata.PackageNotFoundError:
            continue
    return versions


def capture_resource_observation(workspace: Path) -> dict[str, Any]:
    """Take one lightweight local process/storage observation."""

    observation: dict[str, Any] = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "process_id": os.getpid(),
        "platform": sys.platform,
    }
    try:
        disk = shutil.disk_usage(workspace)
        observation.update(
            {
                "workspace_free_bytes": disk.free,
                "workspace_total_bytes": disk.total,
            }
        )
    except OSError as exc:
        observation["storage_observation_error"] = str(exc)
    try:
        import psutil

        process = psutil.Process(os.getpid())
        memory = process.memory_info()
        observation.update(
            {
                "process_rss_bytes": memory.rss,
                "process_memory_percent": process.memory_percent(),
                "process_cpu_percent": process.cpu_percent(None),
            }
        )
        try:
            io = process.io_counters()
            observation.update(
                {"disk_read_bytes": io.read_bytes, "disk_write_bytes": io.write_bytes}
            )
        except (AttributeError, NotImplementedError) as exc:
            observation["io_observation_error"] = str(exc)
    except Exception as exc:
        observation["process_observation_error"] = str(exc)
    return observation


def update_resource_use(
    current: Any,
    observation: Mapping[str, Any],
) -> dict[str, Any]:
    """Keep bounded start/current/peak telemetry rather than an unbounded timeline."""

    existing = _mapping(current)
    start = _mapping(existing.get("start")) or dict(observation)
    peak = _mapping(existing.get("peak"))
    for key in (
        "process_rss_bytes",
        "process_memory_percent",
        "process_cpu_percent",
        "disk_read_bytes",
        "disk_write_bytes",
    ):
        value = observation.get(key)
        if isinstance(value, (int, float)):
            peak[key] = max(float(peak.get(key) or 0), value)
    return {"start": start, "current": dict(observation), "peak": peak}


def _mapping(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def _text(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _iso_from_epoch(value: Any) -> str | None:
    try:
        return datetime.fromtimestamp(float(value), timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def _artifact_references(value: Any) -> list[dict[str, Any]]:
    references: list[dict[str, Any]] = []
    for role, raw_path in sorted(_mapping(value).items()):
        path = _text(raw_path)
        if not path:
            continue
        references.append({"role": str(role), "path": path})
    return references


def build_analysis_run_record(status: Mapping[str, Any]) -> dict[str, Any]:
    """Project the large compatibility record into one stable bounded receipt."""

    profile = _mapping(status.get("analysis_profile"))
    language_policy = _mapping(status.get("language_pack_policy"))
    recovery = _mapping(status.get("recovery"))
    results = _mapping(status.get("results"))
    missing_fields: list[str] = []

    model_choices = _mapping(status.get("model_choices"))
    if not model_choices:
        missing_fields.append("runtime.model_choices")
    provider_versions = _mapping(status.get("provider_versions"))
    if not provider_versions:
        missing_fields.append("runtime.provider_versions")
    resource_use = _mapping(status.get("resource_use"))
    if not resource_use:
        missing_fields.append("resources")

    started_at = _text(status.get("analysis_started_at")) or _iso_from_epoch(
        status.get("start_time")
    )
    completed_at = _text(status.get("analysis_completed_at")) or _iso_from_epoch(
        status.get("end_time")
    )
    fallback_reasons = sorted(
        str(value)
        for key, value in results.items()
        if (key.endswith("_error") or "fallback" in key) and value
    )

    return {
        "schema": SCHEMA,
        "analysis_id": _text(status.get("analysis_id")),
        "project_id": _text(status.get("project_id")),
        "state": _text(status.get("status")) or "unknown",
        "source": {
            "filename": _text(status.get("original_filename") or status.get("filename")),
            "path": _text(status.get("source_video_path") or status.get("file_path")),
            "media_identity": _text(status.get("source_media_identity")),
        },
        "setup": {
            "analysis_tier": _text(status.get("analysis_tier") or profile.get("analysis_tier")),
            "modality_focus": _text(status.get("modality_focus") or profile.get("modality_focus")),
            "pipeline_type": _text(status.get("pipeline_type") or profile.get("pipeline_type")),
            "effective_settings": profile,
            "language_pack_policy": language_policy,
        },
        "runtime": {
            "model_choices": model_choices,
            "provider_versions": provider_versions,
            "dependencies": _mapping(status.get("runtime_dependencies")),
        },
        "timing": {
            "started_at": started_at,
            "completed_at": completed_at,
            "source_clock": "source_media_seconds",
        },
        "resources": resource_use,
        "recovery": {
            "resumable": bool(recovery.get("resumable")),
            "resume_count": int(recovery.get("resume_count") or 0),
            "interrupted_stage": _text(recovery.get("interrupted_stage")),
            "last_resumed_at": _text(recovery.get("last_resumed_at")),
        },
        "outcome": {
            "progress_percent": status.get("progress"),
            "mission_stage": _text(status.get("mission_stage")),
            "fallback_reasons": fallback_reasons,
        },
        "artifact_references": _artifact_references(status.get("output_files")),
        "missing_fields": missing_fields,
    }


def analysis_run_record_path(analysis_dir: Path) -> Path:
    return Path(analysis_dir) / RECORD_FILENAME
