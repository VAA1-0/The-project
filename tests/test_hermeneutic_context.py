import json

import pytest

from src.backend.analysis.hermeneutic_context import (
    HermeneuticContextViolation,
    append_boundary_violation,
    validate_and_build_hermeneutic_context,
)


def _clock_builder(analysis_id, status, metadata):
    return {
        "clock_id": "source_media.clock",
        "analysis_id": analysis_id,
        "binding_status": "content_bound",
        "source_fingerprint": "sha256:source",
        "clock_revision": "clock-v1:revision",
    }


def _status():
    return {
        "analysis_id": "analysis-a",
        "project_id": "project-a",
        "filename": "source.mp4",
        "source_media_metadata": {"source_edition": "edition-1"},
        "annotation_corrections": {"correction_generation": "generation-4"},
    }


def test_ticket_binds_project_analysis_source_clock_and_correction_generation():
    ticket = validate_and_build_hermeneutic_context(
        project_id="project-a",
        context_analysis_id="analysis-a",
        analysis_id="analysis-a",
        status=_status(),
        clock_builder=_clock_builder,
        active_lens="statskit",
        research_question="What changes?",
    )
    assert ticket["project_id"] == "project-a"
    assert ticket["analysis_id"] == "analysis-a"
    assert ticket["source_identity"]["source_fingerprint"] == "sha256:source"
    assert ticket["clock"]["clock_revision"] == "clock-v1:revision"
    assert ticket["correction_generation"] == "generation-4"
    assert ticket["ticket_id"].startswith("hctx-v1:")


@pytest.mark.parametrize(
    ("project_id", "context_analysis_id", "code", "status_code"),
    [
        (None, "analysis-a", "PROJECT_CONTEXT_REQUIRED", 428),
        ("project-a", "analysis-b", "ANALYSIS_CONTEXT_MISMATCH", 409),
        ("project-b", "analysis-a", "PROJECT_MEMBERSHIP_MISMATCH", 403),
    ],
)
def test_context_boundary_fails_closed(project_id, context_analysis_id, code, status_code):
    with pytest.raises(HermeneuticContextViolation) as raised:
        validate_and_build_hermeneutic_context(
            project_id=project_id,
            context_analysis_id=context_analysis_id,
            analysis_id="analysis-a",
            status=_status(),
            clock_builder=_clock_builder,
        )
    assert raised.value.code == code
    assert raised.value.status_code == status_code


def test_boundary_audit_is_append_only_jsonl(tmp_path):
    path = tmp_path / "audit.jsonl"
    violation = HermeneuticContextViolation("PROJECT_CONTEXT_REQUIRED", "missing", status_code=428)
    for entry_path in ("statskit.run", "publication.video.prepare"):
        append_boundary_violation(
            path,
            entry_path=entry_path,
            analysis_id="analysis-a",
            project_id=None,
            context_analysis_id="analysis-a",
            violation=violation,
        )
    records = [json.loads(line) for line in path.read_text().splitlines()]
    assert [record["entry_path"] for record in records] == [
        "statskit.run",
        "publication.video.prepare",
    ]
