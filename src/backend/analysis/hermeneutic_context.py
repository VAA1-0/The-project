"""Governed project/analysis context carried across analytical consumers."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


class HermeneuticContextViolation(ValueError):
    def __init__(self, code: str, message: str, *, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def _text(value: Any) -> str:
    return str(value or "").strip()


def _generation(status: dict[str, Any]) -> str | None:
    corrections = status.get("annotation_corrections") or {}
    value = corrections.get("correction_generation")
    return _text(value) or None


def build_hermeneutic_context_ticket(
    *,
    project_id: str,
    analysis_id: str,
    status: dict[str, Any],
    clock_context: dict[str, Any],
    active_lens: str | None = None,
    research_question: str | None = None,
    interval: dict[str, Any] | None = None,
    authority: str = "analyst_governed",
    provenance: str = "datascene.fastapi",
    actor_id: str | None = None,
) -> dict[str, Any]:
    source_metadata = status.get("source_media_metadata") or {}
    source_identity = {
        "source_fingerprint": clock_context.get("source_fingerprint"),
        "source_edition": _text(source_metadata.get("source_edition") or source_metadata.get("edition_id")) or None,
        "filename": _text(status.get("original_filename") or status.get("filename")) or None,
    }
    body = {
        "schema": "vaa1.hermeneutic_context_ticket.v1",
        "project_id": project_id,
        "analysis_id": analysis_id,
        "source_identity": source_identity,
        "clock": {
            "clock_id": clock_context.get("clock_id"),
            "clock_revision": clock_context.get("clock_revision"),
            "binding_status": clock_context.get("binding_status"),
        },
        "correction_generation": _generation(status),
        "active_lens": _text(active_lens) or None,
        "research_question": _text(research_question) or None,
        "interval": interval,
        "interpretation_authority": authority,
        "provenance": provenance,
        "actor_id": _text(actor_id) or None,
    }
    digest = hashlib.sha256(
        json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    return {**body, "ticket_id": f"hctx-v1:{digest}"}


def validate_and_build_hermeneutic_context(
    *,
    project_id: str | None,
    context_analysis_id: str | None,
    analysis_id: str,
    status: dict[str, Any],
    clock_builder: Callable[[str, dict[str, Any], dict[str, Any]], dict[str, Any]],
    **ticket_fields: Any,
) -> dict[str, Any]:
    requested_project = _text(project_id)
    if not requested_project:
        raise HermeneuticContextViolation(
            "PROJECT_CONTEXT_REQUIRED", "A governed project context is required", status_code=428
        )
    requested_analysis = _text(context_analysis_id)
    if requested_analysis != analysis_id:
        raise HermeneuticContextViolation(
            "ANALYSIS_CONTEXT_MISMATCH", "The context analysis does not match the route analysis", status_code=409
        )
    actual_project = _text(status.get("project_id") or "local-research-project")
    if actual_project != requested_project:
        raise HermeneuticContextViolation(
            "PROJECT_MEMBERSHIP_MISMATCH", "The analysis does not belong to the active project", status_code=403
        )
    metadata = status.get("source_media_metadata") or {}
    clock_context = clock_builder(analysis_id, status, metadata)
    return build_hermeneutic_context_ticket(
        project_id=actual_project,
        analysis_id=analysis_id,
        status=status,
        clock_context=clock_context,
        **ticket_fields,
    )


def append_boundary_violation(path: Path, *, entry_path: str, analysis_id: str, project_id: str | None,
                              context_analysis_id: str | None, violation: HermeneuticContextViolation) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "schema": "vaa1.hermeneutic_context_boundary_violation.v1",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "boundary": "project_analysis_hermeneutic_context",
        "entry_path": entry_path,
        "analysis_id": analysis_id,
        "project_id": project_id,
        "context_analysis_id": context_analysis_id,
        "code": violation.code,
        "message": str(violation),
    }
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(record, sort_keys=True, ensure_ascii=False) + "\n")
