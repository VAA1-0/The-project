import json
import zipfile
from pathlib import Path

import pytest

from src.backend.analysis.data_book_publication import (
    FEATURES,
    build_corpus_publication,
    build_video_publication,
    restore_corpus_publication,
    restore_video_publication,
)
from src.backend.analysis.narrative_agent_continuity_persistence import build_saved_continuity_state


def _status(tmp_path: Path, analysis_id: str = "analysis-001") -> dict:
    tmp_path.mkdir(parents=True, exist_ok=True)
    source = tmp_path / "Interview Sample.mp4"
    source.write_bytes(b"governed-video-source")
    transcript = tmp_path / "transcript.json"
    transcript.write_text(json.dumps({"segments": [{"start": 0, "end": 1, "text": "Test."}]}), encoding="utf-8")
    return {
        "analysis_id": analysis_id,
        "project_id": "Research Project",
        "status": "completed",
        "analysis_completed_at": "2026-08-02T12:00:00+00:00",
        "original_filename": source.name,
        "source_video_path": str(source),
        "source_media_metadata": {"duration": 1.0, "fps": 25.0},
        "output_files": {"transcript": str(transcript)},
    }


def test_video_publication_includes_canonical_annotation_sidecars(tmp_path: Path, monkeypatch):
    status = _status(tmp_path, "analysis-with-corrections")
    status["status"] = "uploaded"
    results_dir = tmp_path / "api_results"
    analysis_dir = results_dir / status["analysis_id"]
    analysis_dir.mkdir(parents=True)
    corrections = {
        "text_substitutions": [{"from": "UNKNOWN", "to": "Agent A"}],
        "manual_transcript_entries": [{"text": "confirmed line"}],
        "manual_visual_annotations": [{"label": "speaker"}],
        "master_schema_presence_intervals": [{"start": 1, "end": 2}],
    }
    master = {"review_layer": {"annotation_corrections": corrections}}
    (analysis_dir / "annotation_corrections.json").write_text(json.dumps(corrections), encoding="utf-8")
    (analysis_dir / "vaa1_annotation_master_schema.json").write_text(json.dumps(master), encoding="utf-8")
    monkeypatch.setattr("src.backend.analysis.data_book_publication.DEFAULT_RESULTS_DIR", results_dir)

    built = build_video_publication(status, tmp_path / "publication")

    with zipfile.ZipFile(built["archive_path"]) as archive:
        names = archive.namelist()
        assert "Data Book/Chapters/16 - Master Schema and Governance/Files/Annotation Corrections.json" in names
        assert "Data Book/Chapters/16 - Master Schema and Governance/Files/Annotation Master Schema.json" in names
        correction_payload = json.loads(
            archive.read("Data Book/Chapters/16 - Master Schema and Governance/Files/Annotation Corrections.json")
        )
        assert len(correction_payload["manual_visual_annotations"]) == 1
    validation = built["package"]["video_package"]["validation"]
    assert validation["status"] == "complete_with_warnings"
    assert any(check["check_id"] == "PUB-004" for check in validation["checks"])


def test_video_publication_has_readable_complete_chapter_tree_and_is_repeatable(tmp_path: Path):
    status = _status(tmp_path)
    first = build_video_publication(status, tmp_path / "publication")
    second = build_video_publication(status, tmp_path / "publication")
    assert first["archive_checksum"] == second["archive_checksum"]
    with zipfile.ZipFile(first["archive_path"]) as archive:
        names = archive.namelist()
        assert "Data Book/Chapters/01 - Video and Source Media/Chapter.json" in names
        assert "Data Book/Chapters/02 - Transcript/Files/Transcript.json" in names
        assert len([name for name in names if name.endswith("/Chapter.json")]) == len(FEATURES)
        assert not any("video_source_media" in name or "statskit" in name for name in names)
        empty = json.loads(archive.read("Data Book/Chapters/03 - Parts of Speech/Chapter.json"))
        assert empty["content_state"] == "empty_confirmed"
        assert empty["empty_state"]["reason_code"] == "no_eligible_observations"


def test_narrative_agent_chapter_publishes_all_confirmations_not_only_selected_agent(tmp_path: Path):
    status = _status(tmp_path)
    status["canonical_decision_ledger"] = {"decisions": [
        {
            "decision_id": "agent-bond-1", "property": "narrative_agent.assignment",
            "value": "James Bond", "analysis_id": "analysis-001",
            "scope": {"start_seconds": 2.0, "end_seconds": 3.0},
            "validity": "current", "review_status": "accepted", "projection_status": "active",
            "authority": "explicit_user_confirmation", "maturity": "analyst_confirmed",
            "evidence_refs": ["track-2"],
        },
        {
            "decision_id": "agent-nomi-1", "property": "narrative_agent.assignment",
            "value": "Nomi", "analysis_id": "analysis-001",
            "scope": {"start_seconds": 41.92, "end_seconds": 43.18},
            "validity": "current", "review_status": "accepted", "projection_status": "active",
            "authority": "explicit_user_confirmation", "maturity": "analyst_confirmed",
            "evidence_refs": ["audio-nomi"],
        },
    ]}

    built = build_video_publication(status, tmp_path / "publication")
    with zipfile.ZipFile(built["archive_path"]) as archive:
        base = "Data Book/Chapters/13 - Narrative Agents/"
        register = json.loads(archive.read(base + "Files/All Narrative Agent Confirmations.json"))
        review = archive.read(base + "All Narrative Agent Confirmations.md").decode("utf-8")
        assert register["confirmation_count"] == 2
        assert set(register["label_counts"]) == {"James Bond", "Nomi"}
        assert "1. **James Bond**" in review
        assert "2. **Nomi**" in review


def test_video_publication_restores_in_isolation_and_fails_closed_on_tampering(tmp_path: Path):
    built = build_video_publication(_status(tmp_path), tmp_path / "publication")
    receipt = restore_video_publication(
        Path(built["archive_path"]), expected_project_id="Research Project"
    )
    assert receipt["restore_state"] == "verified"
    assert receipt["chapter_count"] == len(FEATURES)
    assert receipt["content_identity"] == built["package"]["integrity"]["content_identity"]

    with pytest.raises(ValueError, match="another project"):
        restore_video_publication(Path(built["archive_path"]), expected_project_id="Foreign Project")

    tampered = tmp_path / "tampered.zip"
    with zipfile.ZipFile(built["archive_path"]) as source, zipfile.ZipFile(tampered, "w") as target:
        for info in source.infolist():
            content = source.read(info.filename)
            if info.filename == "Scientific Report/Scientific Report.json":
                content += b"tampered"
            target.writestr(info, content)
    with pytest.raises(ValueError, match="checksum mismatch"):
        restore_video_publication(tampered, expected_project_id="Research Project")


def test_publication_rechecks_current_revision_and_preserves_interpretation_states(tmp_path: Path):
    status = _status(tmp_path, "analysis-nomi")
    projection = {
        "schema": "vaa1.narrative_agent_continuity_projection_envelope.v1",
        "revision": "nomi-revision-8-2",
        "canonical_collection": {
            "project_id": "Research Project", "collection_id": "nomi-agent",
            "narrative_agent_key": "nomi", "narrative_agent_label": "Nomi",
        },
        "graph_projection": {
            "revision": "nomi-revision-8-2",
            "relation_tickets": [
                {
                    "ticket_id": "speaker", "assertion_id": "speaker-assertion",
                    "state": "mature", "predicate": "spoken_by",
                    "authority": "explicit_analyst_confirmation",
                    "evidence_refs": [{
                        "evidence_id": "nomi-audio", "analysis_id": "analysis-nomi",
                        "time_range": {"start": 41.92, "end": 43.18},
                    }],
                    "source_navigation": {
                        "analysis_id": "analysis-nomi",
                        "source_interval": {"start": 41.92, "end": 43.18},
                        "return_panel": "narrative_agent",
                    },
                },
                {"ticket_id": "dialogue", "state": "candidate", "predicate": "dialogue_with"},
            ],
            "nodes": [], "edges": [],
        },
        "constellational_snapshot": {
            "revision": "nomi-revision-8-2",
            "layers": {
                "who_is_speaking": {"state": "confirmed", "claims": ["Nomi"]},
                "who_is_in_dialogue": {"state": "candidate", "claims": []},
            },
        },
    }
    ledger = {"decisions": [
        {"decision_id": "confirmed-1", "value": "confirmed"},
        {"decision_id": "rejected-1", "value": "rejected"},
        {"decision_id": "deferred-1", "value": "deferred"},
        {"decision_id": "superseded-1", "value": "superseded"},
    ]}
    state = build_saved_continuity_state(
        inventory={"project_id": "Research Project"}, decision_ledger=ledger,
        projection=projection, project_id="Research Project", analysis_ids=["analysis-nomi"],
    )
    status["narrative_agent_continuity_projection"] = projection
    status["narrative_agent_continuity_state"] = state

    built = build_video_publication(status, tmp_path / "publication")
    restored = restore_video_publication(Path(built["archive_path"]), expected_project_id="Research Project")
    construct = restored["interpretation_constructs"][0]

    assert construct["eligibility"]["checked_at_export"] is True
    assert construct["eligibility"]["saved_revision_verified"] is True
    assert construct["state_distinctions"]["flattened"] is False
    assert construct["state_distinctions"]["relation_ticket_counts"] == {"mature": 1, "candidate": 1}
    assert construct["state_distinctions"]["decision_history_counts"] == {
        "confirmed": 1, "rejected": 1, "deferred": 1, "superseded": 1,
    }
    manifest = construct["source_chain_manifest"]
    assert manifest["summary"]["eligible_claim_count"] == 1
    assert manifest["summary"]["withheld_claim_count"] == 1
    assert manifest["published_claims"][0]["source_navigation"]["source_interval"] == {
        "start": 41.92, "end": 43.18,
    }
    assert manifest["withheld_claims"][0]["publication_eligibility"] == "withheld_missing_exact_source_chain"
    with zipfile.ZipFile(built["archive_path"]) as archive:
        names = archive.namelist()
        manifest_name = next(name for name in names if name.endswith("Interpretation Source Chain Manifest.json"))
        review_name = next(name for name in names if name.endswith("Governed Interpretation Review.md"))
        assert json.loads(archive.read(manifest_name))["canonical_revision"] == "nomi-revision-8-2"
        review = archive.read(review_name).decode("utf-8")
        assert "spoken_by" in review
        assert "Source-chain eligible claims: 1" in review
        assert "1. **spoken_by**" in review
        assert "Claim: `speaker-assertion`" in review
        assert "withheld because exact source navigation is unavailable" in review

    status["narrative_agent_continuity_projection"] = {**projection, "revision": "stale-other-revision"}
    with pytest.raises(ValueError, match="revision"):
        build_video_publication(status, tmp_path / "stale-publication")


def test_corpus_preserves_browsable_video_publications(tmp_path: Path):
    statuses = [_status(tmp_path / "one", "analysis-001"), _status(tmp_path / "two", "analysis-002")]
    built = build_corpus_publication(statuses, tmp_path / "corpus", "Research Project")
    repeated = build_corpus_publication(statuses, tmp_path / "corpus-repeat", "Research Project")
    assert repeated["archive_checksum"] == built["archive_checksum"]
    with zipfile.ZipFile(built["archive_path"]) as archive:
        names = archive.namelist()
        assert any(name.endswith("/Publication Manifest.json") for name in names)
        assert any(name.endswith("/Data Book/Data Book.json") for name in names)
        assert any(name.endswith("/Scientific Report/Scientific Report.json") for name in names)
        assert "Chapter 5 Research Report/Chapter 5 Research Report.json" in names
        assert "Chapter 5 Research Report/Chapter 5 Research Report.md" in names
        assert "Chapter 5 Research Report/Chapter 5 Research Report.html" in names
        report = json.loads(archive.read("Chapter 5 Research Report/Chapter 5 Research Report.json"))
        assert report["schema"] == "datascene.chapter_five_research_report.v1"
        assert report["research_question"].startswith("How can the Datascene method")
        assert report["verification"]["case_count"] == 2
        assert report["analyst_completion"]["cross_case_synthesis"] == "requires_analyst_statement"
        assert len(report["comparison_matrix"]) == len(FEATURES)
    assert built["package"]["corpus_package"]["corpus_report"]["scope_boundary"]
    assert built["package"]["browse_manifest"]["root_nodes"][0]["children"][0]["node_type"] == "report"
    assert built["video_count"] == 2

    receipt = restore_corpus_publication(
        Path(built["archive_path"]), expected_project_id="Research Project"
    )
    assert receipt["restore_state"] == "verified"
    assert receipt["video_count"] == 2
    assert receipt["video_editions_preserved"] == 2
    assert receipt["source_clocks_preserved"] == 2
    assert receipt["video_ids"] == ["analysis-001", "analysis-002"]

    with pytest.raises(ValueError, match="another project"):
        restore_corpus_publication(
            Path(built["archive_path"]), expected_project_id="Foreign Project"
        )


def test_corpus_publication_rejects_cross_project_input_and_tampering(tmp_path: Path):
    first = _status(tmp_path / "one", "analysis-001")
    foreign = _status(tmp_path / "two", "analysis-002")
    foreign["project_id"] = "Foreign Project"
    with pytest.raises(ValueError, match="cross project"):
        build_corpus_publication([first, foreign], tmp_path / "foreign", "Research Project")

    second = _status(tmp_path / "three", "analysis-003")
    built = build_corpus_publication([first, second], tmp_path / "corpus", "Research Project")
    tampered = tmp_path / "tampered-corpus.zip"
    with zipfile.ZipFile(built["archive_path"]) as source, zipfile.ZipFile(tampered, "w") as target:
        for info in source.infolist():
            content = source.read(info.filename)
            if info.filename.endswith("/Data Book/Data Book.json"):
                content += b"tampered"
            target.writestr(info, content)
    with pytest.raises(ValueError, match="checksum mismatch"):
        restore_corpus_publication(tampered, expected_project_id="Research Project")
