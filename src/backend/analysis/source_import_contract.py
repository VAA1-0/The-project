"""Governed source-type and coordinate contracts for Stage 9.6 imports."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping


SCHEMA = "vaa1.source_import_preflight.v1"
ACCEPTANCE_SCHEMA = "vaa1.source_consumer_acceptance.v1"
DATASCENE_ACCEPTANCE_GATES = (
    "source_identity_bound",
    "coordinate_anchors_canonical",
    "project_analysis_context_valid",
    "panel_projection_hydrated",
    "reciprocal_source_navigation",
    "panel_local_workflow_preserved",
    "save_reopen_verified",
    "export_restore_verified",
)

SOURCE_TYPES: dict[str, dict[str, Any]] = {
    "video": {
        "extensions": {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm"},
        "mime_prefixes": ("video/",),
        "coordinate_contract": {"kind": "temporal", "unit": "source_media_seconds", "spatial": "normalized_frame_xywh"},
        "default_scan": "quick_sweep",
        "supported": True,
        "applicable_panels": ["Video", "Audio", "Transcript", "Objects", "OCR", "Narrative Agent"],
        "missing_capabilities": [],
    },
    "audio": {
        "extensions": {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"},
        "mime_prefixes": ("audio/",),
        "coordinate_contract": {"kind": "temporal", "unit": "source_media_seconds", "spatial": None},
        "default_scan": "quick_sweep",
        "supported": False,
        "applicable_panels": ["Audio", "Transcript", "Narrative Agent"],
        "missing_capabilities": ["standalone_audio_admission", "audio_only_publication_acceptance"],
    },
    "image": {
        "extensions": {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".webp"},
        "mime_prefixes": ("image/",),
        "coordinate_contract": {"kind": "spatial", "unit": "normalized_image_xywh", "frame_index": 0},
        "default_scan": "quick_sweep",
        "supported": False,
        "applicable_panels": ["Video", "Objects", "OCR", "Narrative Agent"],
        "missing_capabilities": ["single_frame_admission", "non_temporal_panel_navigation"],
    },
    "graphics": {
        "extensions": {".svg", ".ai", ".eps", ".psd"},
        "mime_prefixes": ("image/svg", "application/postscript"),
        "coordinate_contract": {"kind": "spatial", "unit": "normalized_canvas_xywh", "page_or_artboard": 0},
        "default_scan": "quick_sweep",
        "supported": False,
        "applicable_panels": ["Video", "Objects", "OCR"],
        "missing_capabilities": ["graphics_admission", "layer_or_artboard_preservation"],
    },
    "text": {
        "extensions": {".txt", ".md", ".rtf", ".docx", ".odt"},
        "mime_prefixes": ("text/plain", "text/markdown", "application/rtf"),
        "coordinate_contract": {"kind": "textual", "unit": "unicode_codepoint_offset", "secondary": "line_column"},
        "default_scan": "quick_sweep",
        "supported": False,
        "applicable_panels": ["Transcript", "POS", "Quantitative Analysis", "Meaning Knowledge Graph"],
        "missing_capabilities": ["text_only_admission", "document_parser_selection", "textual_source_navigation"],
    },
    "web_page": {
        "extensions": {".html", ".htm", ".mhtml", ".webarchive"},
        "mime_prefixes": ("text/html", "multipart/related"),
        "coordinate_contract": {"kind": "document", "unit": "capture_dom_path_and_codepoint_offset", "live_fetch": False},
        "default_scan": "quick_sweep",
        "supported": False,
        "applicable_panels": ["Transcript", "OCR", "Meaning Knowledge Graph", "Source Media"],
        "missing_capabilities": ["saved_web_capture_admission", "dom_source_navigation", "web_capture_publication"],
    },
    "reference_data": {
        "extensions": {".csv", ".tsv", ".json", ".jsonl", ".xlsx", ".parquet"},
        "mime_prefixes": ("text/csv", "application/json", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml"),
        "coordinate_contract": {"kind": "tabular_or_record", "unit": "record_id", "secondary": "sheet_row_column_or_json_pointer"},
        "default_scan": "quick_sweep",
        "supported": False,
        "applicable_panels": ["Source Media", "Master Schema", "Meaning Knowledge Graph"],
        "missing_capabilities": ["reference_data_admission", "schema_mapping_review", "record_source_navigation"],
    },
}


def classify_source(filename: str, mime_type: str | None = None) -> str | None:
    suffix = Path(filename or "").suffix.lower()
    normalized_mime = (mime_type or "").lower().split(";", 1)[0].strip()
    for source_type, contract in SOURCE_TYPES.items():
        if suffix in contract["extensions"]:
            return source_type
    for source_type, contract in SOURCE_TYPES.items():
        if normalized_mime and any(normalized_mime.startswith(prefix) for prefix in contract["mime_prefixes"]):
            return source_type
    return None


def build_source_import_preflight(payload: Mapping[str, Any]) -> dict[str, Any]:
    filename = str(payload.get("filename") or "").strip()
    mime_type = str(payload.get("mime_type") or "").strip() or None
    requested_type = str(payload.get("source_type") or "").strip() or None
    detected_type = classify_source(filename, mime_type)
    source_type = requested_type or detected_type
    contract = SOURCE_TYPES.get(source_type or "")
    reasons: list[str] = []
    if not filename:
        reasons.append("filename_required")
    if not contract:
        reasons.append("unsupported_source_type")
    elif requested_type and detected_type and requested_type != detected_type:
        reasons.append("declared_detected_type_mismatch")
    elif not contract["supported"]:
        reasons.append("admission_not_yet_operational")

    return {
        "schema": SCHEMA,
        "filename": filename or None,
        "mime_type": mime_type,
        "declared_source_type": requested_type,
        "detected_source_type": detected_type,
        "source_type": source_type,
        "accepted": not reasons,
        "state": "admission_operational" if contract and contract["supported"] and not reasons else "declared_not_operational",
        "reasons": reasons,
        "coordinate_contract": contract["coordinate_contract"] if contract else None,
        "default_scan": contract["default_scan"] if contract else None,
        "applicable_panels": list(contract["applicable_panels"]) if contract else [],
        "panel_routes": [
            {
                "panel": panel,
                "eligibility": "eligible",
                "hydration_state": "requires_post_analysis_verification",
                "source_return_state": "requires_reciprocal_navigation_verification",
            }
            for panel in (contract["applicable_panels"] if contract else [])
        ],
        "missing_capabilities": list(contract["missing_capabilities"]) if contract else [],
        "provenance": {
            "source_bytes_required": True,
            "original_filename_preserved": True,
            "mime_type_preserved": True,
            "live_network_fetch_authorized": False,
        },
        "export_behavior": "source_plus_receipt_and_eligible_artifacts" if contract and contract["supported"] else "not_exportable_until_admitted",
        "workflow_acceptance": {
            "state": "not_yet_evaluated" if contract and contract["supported"] and not reasons else "blocked",
            "required_gates": list(DATASCENE_ACCEPTANCE_GATES),
            "principles": {
                "source_linked_data_first": True,
                "saloon_doors_swing_both_ways": True,
                "raised_here_navigable_here": True,
                "confirm_once_mature_everywhere": True,
                "hermeneutic_space_private": True,
                "no_operational_claim_from_ui_presence": True,
            },
        },
    }


def evaluate_source_consumer_acceptance(
    preflight: Mapping[str, Any],
    evidence: Mapping[str, Any],
) -> dict[str, Any]:
    """Accept a source workflow only after every source and consumer gate is proven."""

    panel_evidence = evidence.get("panel_routes")
    panel_evidence = panel_evidence if isinstance(panel_evidence, Mapping) else {}
    route_results = []
    for panel in preflight.get("applicable_panels") or []:
        observed = panel_evidence.get(panel)
        observed = observed if isinstance(observed, Mapping) else {}
        hydrated = bool(observed.get("hydrated"))
        source_return = bool(observed.get("source_return_verified"))
        local_workflow = bool(observed.get("panel_local_workflow_preserved"))
        route_results.append(
            {
                "panel": panel,
                "hydrated": hydrated,
                "source_return_verified": source_return,
                "panel_local_workflow_preserved": local_workflow,
                "accepted": hydrated and source_return and local_workflow,
                "consumer_route": observed.get("consumer_route"),
            }
        )

    gates = {
        "source_identity_bound": bool(evidence.get("source_identity_bound")),
        "coordinate_anchors_canonical": bool(evidence.get("coordinate_anchors_canonical")),
        "project_analysis_context_valid": bool(evidence.get("project_analysis_context_valid")),
        "panel_projection_hydrated": bool(route_results) and all(row["hydrated"] for row in route_results),
        "reciprocal_source_navigation": bool(route_results) and all(row["source_return_verified"] for row in route_results),
        "panel_local_workflow_preserved": bool(route_results) and all(row["panel_local_workflow_preserved"] for row in route_results),
        "save_reopen_verified": bool(evidence.get("save_reopen_verified")),
        "export_restore_verified": bool(evidence.get("export_restore_verified")),
    }
    admission_accepted = bool(preflight.get("accepted"))
    accepted = admission_accepted and all(gates.values())
    return {
        "schema": ACCEPTANCE_SCHEMA,
        "source_type": preflight.get("source_type"),
        "admission_accepted": admission_accepted,
        "accepted": accepted,
        "state": "operational" if accepted else "not_operational",
        "gates": gates,
        "panel_routes": route_results,
        "blocking_gates": [name for name, passed in gates.items() if not passed],
    }
