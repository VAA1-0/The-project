"""Content-addressed source identity and fail-closed relinking."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any, Mapping


SCHEMA = "vaa1.source_integrity.v1"


class SourceIntegrityError(ValueError):
    pass


def fingerprint_file(path: str | Path) -> tuple[str, int]:
    source = Path(path).resolve(strict=True)
    if not source.is_file():
        raise SourceIntegrityError("Source candidate is not a regular file")
    before = source.stat()
    digest = hashlib.sha256()
    with source.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    after = source.stat()
    signature_before = (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
    signature_after = (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
    if signature_before != signature_after:
        raise SourceIntegrityError("Source changed while its identity was being verified; retry")
    return "sha256:" + digest.hexdigest(), after.st_size


def capture_source_integrity(
    path: str | Path, *, original_filename: str | None = None
) -> dict[str, Any]:
    source = Path(path).resolve(strict=True)
    fingerprint, size = fingerprint_file(source)
    return {
        "schema": SCHEMA,
        "identity_status": "content_verified",
        "source_fingerprint": fingerprint,
        "size_bytes": size,
        "original_filename": original_filename or source.name,
        "bound_path": str(source),
        "algorithm": "sha256",
        "relink_policy": "exact_content_match_only",
    }


def assess_source_relink(
    expected: Mapping[str, Any] | None, candidate_path: str | Path
) -> dict[str, Any]:
    if not isinstance(expected, Mapping) or expected.get("schema") != SCHEMA:
        raise SourceIntegrityError(
            "No governed source fingerprint is available; restore the original source before relinking"
        )
    expected_fingerprint = str(expected.get("source_fingerprint") or "")
    if not expected_fingerprint.startswith("sha256:"):
        raise SourceIntegrityError("Stored source identity is incomplete")
    candidate = Path(candidate_path).resolve(strict=True)
    fingerprint, size = fingerprint_file(candidate)
    expected_size = expected.get("size_bytes")
    matches = fingerprint == expected_fingerprint and (
        expected_size is None or int(expected_size) == size
    )
    return {
        "schema": "vaa1.source_relink_assessment.v1",
        "accepted": matches,
        "candidate_path": str(candidate),
        "candidate_fingerprint": fingerprint,
        "candidate_size_bytes": size,
        "expected_fingerprint": expected_fingerprint,
        "expected_size_bytes": expected_size,
        "reason": "exact_content_match" if matches else "content_identity_mismatch",
        "write_effect": "relink_allowed" if matches else "none_candidate_rejected",
    }


def build_missing_source_notice(status: Mapping[str, Any]) -> dict[str, Any] | None:
    source_path = status.get("source_video_path")
    if source_path and Path(str(source_path)).is_file():
        return None
    integrity = status.get("source_integrity")
    integrity = integrity if isinstance(integrity, Mapping) else {}
    return {
        "schema": "vaa1.missing_source_notice.v1",
        "analysis_id": str(status.get("analysis_id") or ""),
        "original_filename": status.get("original_filename") or status.get("filename"),
        "last_known_source_location": source_path,
        "expected_source_fingerprint": integrity.get("source_fingerprint"),
        "expected_size_bytes": integrity.get("size_bytes"),
        "state": "source_file_required",
        "user_action": "Locate the original source file or an exact byte-identical copy.",
        "relink_policy": "exact_content_match_only",
    }
