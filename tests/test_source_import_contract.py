import pytest

from src.backend.analysis.source_import_contract import (
    ACCEPTANCE_SCHEMA,
    DATASCENE_ACCEPTANCE_GATES,
    SCHEMA,
    build_source_import_preflight,
    classify_source,
    evaluate_source_consumer_acceptance,
)


@pytest.mark.parametrize(
    ("filename", "mime", "expected"),
    [
        ("clip.mp4", "video/mp4", "video"),
        ("interview.wav", "audio/wav", "audio"),
        ("frame.png", "image/png", "image"),
        ("diagram.svg", "image/svg+xml", "graphics"),
        ("notes.txt", "text/plain", "text"),
        ("capture.html", "text/html", "web_page"),
        ("registry.csv", "text/csv", "reference_data"),
    ],
)
def test_requested_stage_96_source_families_are_classified(filename, mime, expected) -> None:
    assert classify_source(filename, mime) == expected


def test_video_is_operational_with_temporal_and_spatial_coordinates() -> None:
    result = build_source_import_preflight({"filename": "clip.mp4", "mime_type": "video/mp4"})
    assert result["schema"] == SCHEMA
    assert result["accepted"] is True
    assert result["state"] == "admission_operational"
    assert result["coordinate_contract"] == {
        "kind": "temporal",
        "unit": "source_media_seconds",
        "spatial": "normalized_frame_xywh",
    }
    assert result["provenance"]["live_network_fetch_authorized"] is False
    assert result["workflow_acceptance"]["state"] == "not_yet_evaluated"
    assert result["workflow_acceptance"]["required_gates"] == list(DATASCENE_ACCEPTANCE_GATES)
    assert all(route["hydration_state"] == "requires_post_analysis_verification" for route in result["panel_routes"])


@pytest.mark.parametrize("filename", ["notes.txt", "frame.png", "sound.wav", "diagram.svg", "capture.html", "data.csv"])
def test_declared_but_unimplemented_imports_are_never_false_acceptances(filename) -> None:
    result = build_source_import_preflight({"filename": filename})
    assert result["accepted"] is False
    assert result["state"] == "declared_not_operational"
    assert result["missing_capabilities"]
    assert result["export_behavior"] == "not_exportable_until_admitted"


def test_declared_type_mismatch_is_blocked() -> None:
    result = build_source_import_preflight(
        {"filename": "evidence.csv", "mime_type": "text/csv", "source_type": "text"}
    )
    assert result["accepted"] is False
    assert "declared_detected_type_mismatch" in result["reasons"]


def test_admission_does_not_falsely_certify_panel_hydration() -> None:
    preflight = build_source_import_preflight({"filename": "clip.mp4"})
    result = evaluate_source_consumer_acceptance(preflight, {})

    assert result["schema"] == ACCEPTANCE_SCHEMA
    assert result["admission_accepted"] is True
    assert result["accepted"] is False
    assert result["state"] == "not_operational"
    assert set(result["blocking_gates"]) == set(DATASCENE_ACCEPTANCE_GATES)


def test_source_workflow_requires_every_panel_to_hydrate_and_return_to_source() -> None:
    preflight = build_source_import_preflight({"filename": "clip.mp4"})
    panel_routes = {
        panel: {
            "hydrated": True,
            "source_return_verified": True,
            "panel_local_workflow_preserved": True,
            "consumer_route": f"panel.{panel.lower().replace(' ', '_')}",
        }
        for panel in preflight["applicable_panels"]
    }
    evidence = {
        "source_identity_bound": True,
        "coordinate_anchors_canonical": True,
        "project_analysis_context_valid": True,
        "save_reopen_verified": True,
        "export_restore_verified": True,
        "panel_routes": panel_routes,
    }
    accepted = evaluate_source_consumer_acceptance(preflight, evidence)
    assert accepted["accepted"] is True
    assert accepted["state"] == "operational"

    panel_routes["Transcript"]["source_return_verified"] = False
    rejected = evaluate_source_consumer_acceptance(preflight, evidence)
    assert rejected["accepted"] is False
    assert "reciprocal_source_navigation" in rejected["blocking_gates"]
    assert next(row for row in rejected["panel_routes"] if row["panel"] == "Transcript")["accepted"] is False
