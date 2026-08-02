"""Capacity and streaming helpers for governed multi-video ingestion."""

from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Iterable


GIB = 1024 ** 3
DEFAULT_MAX_FILE_BYTES = 6 * GIB
DEFAULT_MAX_CORPUS_BYTES = 12 * GIB
DEFAULT_WORKING_RESERVE_BYTES = 8 * GIB
DEFAULT_COPY_CHUNK_BYTES = 8 * 1024 ** 2


def _env_bytes(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return max(0, value)


@dataclass(frozen=True)
class IngestionLimits:
    max_file_bytes: int = DEFAULT_MAX_FILE_BYTES
    max_corpus_bytes: int = DEFAULT_MAX_CORPUS_BYTES
    working_reserve_bytes: int = DEFAULT_WORKING_RESERVE_BYTES

    @classmethod
    def from_environment(cls) -> "IngestionLimits":
        return cls(
            max_file_bytes=_env_bytes("VAA1_MAX_VIDEO_UPLOAD_BYTES", DEFAULT_MAX_FILE_BYTES),
            max_corpus_bytes=_env_bytes("VAA1_MAX_RESEARCH_CORPUS_BYTES", DEFAULT_MAX_CORPUS_BYTES),
            working_reserve_bytes=_env_bytes("VAA1_RESEARCH_WORKING_RESERVE_BYTES", DEFAULT_WORKING_RESERVE_BYTES),
        )


def assess_corpus_capacity(
    file_sizes: Iterable[int],
    destination: Path,
    *,
    limits: IngestionLimits | None = None,
    free_bytes: int | None = None,
) -> dict:
    limits = limits or IngestionLimits.from_environment()
    sizes = [max(0, int(size)) for size in file_sizes]
    total_bytes = sum(sizes)
    available_bytes = (
        int(free_bytes)
        if free_bytes is not None
        else int(shutil.disk_usage(destination).free)
    )
    reasons: list[str] = []
    if not sizes:
        reasons.append("No video files were supplied.")
    if any(size > limits.max_file_bytes for size in sizes):
        reasons.append("At least one video exceeds the configured per-file upload limit.")
    if total_bytes > limits.max_corpus_bytes:
        reasons.append("The selected videos exceed the configured research-corpus upload limit.")
    required_bytes = total_bytes + limits.working_reserve_bytes
    if required_bytes > available_bytes:
        reasons.append("The workspace lacks the configured free-space reserve for ingestion and analysis outputs.")
    return {
        "accepted": not reasons,
        "file_count": len(sizes),
        "total_bytes": total_bytes,
        "available_bytes": available_bytes,
        "required_bytes": required_bytes,
        "remaining_after_upload_bytes": max(0, available_bytes - total_bytes),
        "max_file_bytes": limits.max_file_bytes,
        "max_corpus_bytes": limits.max_corpus_bytes,
        "working_reserve_bytes": limits.working_reserve_bytes,
        "reasons": reasons,
    }


def copy_upload_bounded(
    source: BinaryIO,
    destination: Path,
    *,
    max_bytes: int,
    expected_bytes: int | None = None,
    chunk_bytes: int = DEFAULT_COPY_CHUNK_BYTES,
) -> int:
    """Copy without loading the source into memory and remove incomplete output."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    try:
        with destination.open("wb") as target:
            while True:
                chunk = source.read(chunk_bytes)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise ValueError("Video exceeds the configured per-file upload limit.")
                target.write(chunk)
            target.flush()
            os.fsync(target.fileno())
        if expected_bytes is not None and expected_bytes >= 0 and written != expected_bytes:
            raise ValueError(
                f"Upload size mismatch: received {written} bytes; expected {expected_bytes} bytes."
            )
        return written
    except Exception:
        destination.unlink(missing_ok=True)
        raise
