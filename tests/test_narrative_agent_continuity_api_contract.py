import asyncio
from pathlib import Path
import sys
import types

import pytest
from fastapi import HTTPException

expression_detector = types.ModuleType("src.backend.analysis.expression_detector")
expression_detector.ExpressionDetectorDeepFace = type("ExpressionDetectorDeepFace", (), {})
sys.modules["src.backend.analysis.expression_detector"] = expression_detector

pos_analysis = types.ModuleType("src.backend.analysis.pos_analysis")
pos_analysis.POSAnalysis = type("POSAnalysis", (), {})
sys.modules["src.backend.analysis.pos_analysis"] = pos_analysis

quantitative_analysis = types.ModuleType("src.backend.analysis.quantitative_analysis")
quantitative_analysis.QuantitativeAnalysis = type("QuantitativeAnalysis", (), {})
quantitative_analysis.attach_quant_evidence_to_transcript = lambda transcript, *args, **kwargs: transcript
sys.modules["src.backend.analysis.quantitative_analysis"] = quantitative_analysis

multipart = types.ModuleType("multipart")
multipart.__version__ = "0.0-test"
multipart_parser = types.ModuleType("multipart.multipart")
multipart_parser.parse_options_header = lambda value: (value, {})
sys.modules["multipart"] = multipart
sys.modules["multipart.multipart"] = multipart_parser

import api_server


def status(analysis_id: str, project_id: str = "project-one") -> dict:
    return {
        "analysis_id": analysis_id,
        "project_id": project_id,
        "original_filename": f"{analysis_id}.mp4",
        "status": "processing",
        "output_files": {},
        "annotation_corrections": {
            "manual_visual_annotations": [],
            "text_substitutions": [],
        },
    }


def install_project(monkeypatch, tmp_path: Path, records: list[dict]) -> None:
    monkeypatch.setattr(api_server, "RESULTS_DIR", tmp_path / "results")
    monkeypatch.setattr(api_server, "continuity_project_records", lambda project_id: records)
    monkeypatch.setattr(api_server, "persist_analysis_record_for_status", lambda _status: None)
    monkeypatch.setattr(api_server, "refresh_master_schema_metadata_surfaces", lambda _status: None)


def test_artifact_owned_audio_confirmation_is_saved_and_inventory_visible(monkeypatch, tmp_path):
    records = [status("video-a"), status("video-b")]
    install_project(monkeypatch, tmp_path, records)

    result = asyncio.run(
        api_server.confirm_project_narrative_agent_evidence(
            "project-one",
            {
                "analysis_id": "video-a",
                "agent": "James Bond",
                "modality": "audio",
                "start_seconds": 12.25,
                "end_seconds": 14.5,
                "source_ref": "speaker:7",
                "evidence_id": "bond-audio-1",
            },
        )
    )

    assert result["save_committed"] is True
    assert result["artifact_occurrence"]["analysis_id"] == "video-a"
    assert result["artifact_occurrence"]["evidence_modality"] == "audio"
    assert result["artifact_occurrence"]["source_interval"] == {"start": 12.25, "end": 14.5}
    assert "transcript" in result["saloon_doors"]
    sidecar = tmp_path / "results" / "video-a" / "annotation_corrections.json"
    assert sidecar.exists()
    assert not (tmp_path / "results" / "video-b" / "annotation_corrections.json").exists()


def test_repeated_source_confirmation_is_semantically_idempotent(monkeypatch, tmp_path):
    records = [status("video-a")]
    install_project(monkeypatch, tmp_path, records)
    base = {
        "analysis_id": "video-a",
        "agent": "Nomi",
        "modality": "audio",
        "start_seconds": 41.920,
        "end_seconds": 43.180,
        "source_ref": "",
    }
    first = asyncio.run(api_server.confirm_project_narrative_agent_evidence(
        "project-one", {**base, "evidence_id": "nomi-audio-first"}
    ))
    repeated = asyncio.run(api_server.confirm_project_narrative_agent_evidence(
        "project-one", {
            **base,
            "start_seconds": 41.900,
            "source_ref": "turn_0010",
            "evidence_id": "nomi-audio-repeat",
        }
    ))

    assert first["status"] == "saved"
    assert repeated["status"] == "unchanged"
    assert repeated["duplicate_of"] == "nomi-audio-first"
    assert repeated["evidence_id"] == "nomi-audio-first"
    assert len(records[0]["annotation_corrections"]["manual_visual_annotations"]) == 1


def test_scene_presence_is_not_rejected_for_missing_bbox(monkeypatch, tmp_path):
    records = [status("video-a")]
    install_project(monkeypatch, tmp_path, records)
    result = asyncio.run(
        api_server.confirm_project_narrative_agent_evidence(
            "project-one",
            {
                "analysis_id": "video-a",
                "agent": "Nomi",
                "modality": "scene_presence",
                "start_seconds": 38,
                "end_seconds": 42,
                "scene_id": "scene:12",
                "evidence_id": "nomi-scene-12",
            },
        )
    )
    assert result["artifact_occurrence"]["evidence_modality"] == "scene_presence"
    inventory = api_server.build_continuity_inventory(records, selected_agent="Nomi", project_id="project-one")
    assert "nomi-scene-12" not in inventory["diagnostics"]["incomplete_source_anchors"]


def test_evidence_endpoint_rejects_analysis_outside_project(monkeypatch, tmp_path):
    install_project(monkeypatch, tmp_path, [status("video-a")])
    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            api_server.confirm_project_narrative_agent_evidence(
                "project-one",
                {
                    "analysis_id": "foreign-video",
                    "agent": "James Bond",
                    "modality": "visual",
                    "start_seconds": 1,
                    "end_seconds": 2,
                },
            )
        )
    assert raised.value.status_code == 403


def test_visual_confirmation_requires_real_normalized_bbox(monkeypatch, tmp_path):
    install_project(monkeypatch, tmp_path, [status("video-a")])
    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            api_server.confirm_project_narrative_agent_evidence(
                "project-one",
                {
                    "analysis_id": "video-a",
                    "agent": "James Bond",
                    "modality": "visual",
                    "start_seconds": 1,
                    "end_seconds": 2,
                },
            )
        )
    assert raised.value.status_code == 400
    assert "BBox" in raised.value.detail


def test_body_movement_confirmation_is_bbox_bound_and_surfaces_as_candidate_support(monkeypatch, tmp_path):
    records = [status("video-a")]
    install_project(monkeypatch, tmp_path, records)

    result = asyncio.run(
        api_server.confirm_project_narrative_agent_evidence(
            "project-one",
            {
                "analysis_id": "video-a",
                "agent": "James Bond",
                "modality": "body_movement",
                "start_seconds": 8.25,
                "end_seconds": 9.75,
                "source_ref": "person-track:7",
                "evidence_id": "bond-movement-1",
                "movement_type": "turning left",
                "movement_intensity": 0.72,
                "pose_ref": "pose:frame-248",
                "coordinates": {"x": 0.2, "y": 0.1, "w": 0.3, "h": 0.7},
            },
        )
    )

    assert result["save_committed"] is True
    assert result["artifact_occurrence"]["evidence_modality"] == "body_movement"
    saved = records[0]["annotation_corrections"]["manual_visual_annotations"][0]
    assert saved["category"] == "Movement"
    assert saved["movement_type"] == "turning left"
    assert saved["movement_intensity"] == 0.72
    assert saved["pose_ref"] == "pose:frame-248"
    assert saved["coordinates"] == {"x": 0.2, "y": 0.1, "w": 0.3, "h": 0.7}
    assert saved["metadata_correlation"]["manual_confirmation_event"]["confirmed_fields"]["body_movement"] is True
    assert saved["metadata_correlation"]["interpretation_is_candidate_only"] is True


def test_body_movement_confirmation_requires_real_normalized_bbox(monkeypatch, tmp_path):
    install_project(monkeypatch, tmp_path, [status("video-a")])
    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            api_server.confirm_project_narrative_agent_evidence(
                "project-one",
                {
                    "analysis_id": "video-a",
                    "agent": "James Bond",
                    "modality": "body_movement",
                    "start_seconds": 1,
                    "end_seconds": 2,
                    "movement_type": "walking",
                },
            )
        )
    assert raised.value.status_code == 400
    assert "BBox" in raised.value.detail


def test_membership_commit_projects_one_revision_to_every_project_artifact(monkeypatch, tmp_path):
    records = [status("video-a"), status("video-b")]
    install_project(monkeypatch, tmp_path, records)
    evidence = asyncio.run(
        api_server.confirm_project_narrative_agent_evidence(
            "project-one",
            {
                "analysis_id": "video-a",
                "agent": "James Bond",
                "modality": "audio",
                "start_seconds": 3,
                "end_seconds": 4,
                "evidence_id": "bond-audio-membership",
            },
        )
    )
    decision = asyncio.run(
        api_server.decide_project_narrative_agent_continuity(
            "project-one",
            {
                "analysis_id": "video-a",
                "agent": "James Bond",
                "collection_id": evidence["collection_id"],
                "operation": "include",
                "occurrence_id": "bond-audio-membership",
            },
        )
    )
    assert decision["save_committed"] is True
    revisions = {
        record["narrative_agent_continuity_projection"]["revision"] for record in records
    }
    assert revisions == {decision["continuity_projection"]["revision"]}
    assert all(
        (tmp_path / "results" / record["analysis_id"] / "narrative_agent_continuity_projection.json").exists()
        for record in records
    )
