"""Evidence-backed full-analysis manifest evaluation and persistence."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .analysis_recovery import atomic_write_json

BRANCHES = (
    ("transcript", "Transcript", "transcript", "audio_text"),
    ("linked_transcript", "Linked transcript", "linked_transcript", "transcript_linker"),
    ("pos_analysis", "POS analysis", "pos_analysis", "pos_analysis"),
    ("quan_analysis", "Quant analysis", "quan_analysis", "quantitative_analysis"),
    ("audio_prosody", "Audio prosody", "audio_prosody", "audio_prosody"),
    ("audio_event_intervals", "Audio event intervals", "audio_event_intervals", "audio_event_measurement"),
    ("audio_diarization", "Speaker diarization", "audio_diarization", "diarization_adapter"),
    ("audio_sample_clouds", "Audio sample clouds", "audio_sample_clouds", "audio_sample_clouds"),
    ("tracked_objects", "Tracked objects", "tracked_objects_json", "visual_pipeline"),
    ("ocr", "OCR", "ocr_csv", "visual_pipeline"),
    ("expressions", "Expression analysis", "expression_json", "expression_detector"),
    ("shot_boundaries", "Shot boundaries", "shot_boundaries", "shot_boundary_measurement"),
    ("spatial_tone_scan", "Color / brightness / contrast", "spatial_tone_scan", "spatial_tone_measurement"),
    ("adaptive_visual_scan", "Adaptive visual measurement", "adaptive_visual_scan", "adaptive_visual_measurement"),
    ("native_statistical_interpretation", "Relational connectivity", "native_statistical_interpretation", "native_statistical_interpretation"),
)

PARITY_SPECS: dict[str, dict[str, Any]] = {
    "audio_event_intervals": {"projection_layer": "audio_event_intervals", "hydration_path": ("results", "audio_analysis", "audio_event_intervals"), "rows_key": "intervals"},
    "audio_diarization": {"projection_layer": "speaker_diarization_turns", "hydration_path": ("results", "audio_analysis", "audio_diarization"), "rows_key": "speaker_turns"},
    "shot_boundaries": {"projection_layer": "shot_boundary_intervals", "hydration_path": ("results", "visual_analysis", "shot_boundaries"), "rows_key": "intervals"},
    "spatial_tone_scan": {"projection_layer": "spatial_tone_measurements", "hydration_path": ("results", "visual_analysis", "spatial_tone_scan"), "rows_key": "samples"},
    "adaptive_visual_scan": {"projection_layer": "adaptive_temporal_visual_measurements", "hydration_path": ("results", "visual_analysis", "adaptive_visual_scan"), "rows_key": "samples"},
}


def _nested(value: Any, path: tuple[str, ...]) -> Any:
    current = value
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _row_count(value: Any, rows_key: str | None = None) -> int | None:
    if isinstance(value, list):
        return len(value)
    if not isinstance(value, dict):
        return None
    if rows_key and isinstance(value.get(rows_key), list):
        return len(value[rows_key])
    for key in ("segments", "intervals", "samples", "findings", "records", "relationships", "speaker_turns", "cues", "clouds"):
        if isinstance(value.get(key), list):
            return len(value[key])
    return None


def _parity_evidence(status: dict[str, Any], branch_id: str, artifact_rows: int | None) -> dict[str, Any]:
    if branch_id in {"transcript", "linked_transcript", "pos_analysis", "quan_analysis"}:
        parity = status.get("language_analysis_parity") if isinstance(status.get("language_analysis_parity"), dict) else None
        if parity is None:
            parity_path = (status.get("output_files") or {}).get("language_analysis_parity")
            try:
                parity = json.loads(Path(str(parity_path)).read_text(encoding="utf-8")) if parity_path else None
            except (OSError, json.JSONDecodeError):
                parity = None
        audio = _nested(status, ("results", "audio_analysis")) or {}
        pos_hydrated = audio.get("pos_analysis")
        quant_hydrated = audio.get("quan_analysis")
        pos_hydrated_rows = (
            int(pos_hydrated.get("token_count") or 0)
            if isinstance(pos_hydrated, dict)
            else _artifact_metadata(pos_hydrated).get("row_count")
            if isinstance(pos_hydrated, str)
            else None
        )
        quant_hydrated_rows = (
            len(((quant_hydrated.get("token_info") or {}).get("tokens") or []))
            if isinstance(quant_hydrated, dict)
            else _artifact_metadata(quant_hydrated).get("row_count")
            if isinstance(quant_hydrated, str)
            else None
        )
        settings = {
            "transcript": ("transcript", "segment_count", _row_count(audio.get("transcript"), "segments"), "panel.transcript.language_metaview"),
            "linked_transcript": ("linked_transcript", "anchor_count", artifact_rows if audio.get("linked_transcript_path") else None, "panel.transcript.linked_evidence"),
            "pos_analysis": ("pos", "input_token_count", pos_hydrated_rows, "panel.pos.language_metaview"),
            "quan_analysis": ("quant", "input_token_count", quant_hydrated_rows, "panel.quant.language_metaview"),
        }
        section, count_key, hydrated_rows, route = settings[branch_id]
        projected_rows = int(((parity or {}).get(section) or {}).get(count_key) or 0) if parity else None
        projection_ok = projected_rows is not None and artifact_rows == projected_rows
        hydration_ok = hydrated_rows is not None and artifact_rows == hydrated_rows
        consumer_ok = bool(parity and projection_ok and hydration_ok)
        mismatches = []
        if not projection_ok:
            mismatches.append(f"artifact_rows={artifact_rows}; language_parity_rows={projected_rows}")
        if not hydration_ok:
            mismatches.append(f"artifact_rows={artifact_rows}; hydrated_rows={hydrated_rows}")
        return {
            "projection_state": "verified" if projection_ok else "missing_or_mismatched",
            "hydration_state": "verified" if hydration_ok else "missing_or_mismatched",
            "consumer_state": "verified" if consumer_ok else "missing",
            "projected_row_count": projected_rows,
            "hydrated_row_count": hydrated_rows,
            "consumer_route": route if consumer_ok else None,
            "parity_verified": projection_ok and hydration_ok and consumer_ok,
            "parity_reason": "; ".join(mismatches) if mismatches else None,
        }
    if branch_id in {"tracked_objects", "ocr", "expressions"}:
        parity = status.get("visual_analysis_parity") if isinstance(status.get("visual_analysis_parity"), dict) else None
        if parity is None:
            parity_path = (status.get("output_files") or {}).get("visual_analysis_parity")
            try:
                parity = json.loads(Path(str(parity_path)).read_text(encoding="utf-8")) if parity_path else None
            except (OSError, json.JSONDecodeError):
                parity = None
        visual = _nested(status, ("results", "visual_analysis")) or {}
        section, hydration_key = {
            "tracked_objects": ("tracked_objects", "tracked_objects"),
            "ocr": ("ocr", "ocr_results"),
            "expressions": ("expressions", "expression_results"),
        }[branch_id]
        hydrated_rows = _row_count(visual.get(hydration_key))
        projected_rows = int(((parity or {}).get(section) or {}).get("row_count") or 0) if parity else None
        route = ((parity or {}).get(section) or {}).get("consumer_route") if parity else None
        projection_ok = projected_rows is not None and artifact_rows == projected_rows
        hydration_ok = hydrated_rows is not None and artifact_rows == hydrated_rows
        consumer_ok = bool(route and projection_ok and hydration_ok)
        mismatches = []
        if not projection_ok:
            mismatches.append(f"artifact_rows={artifact_rows}; visual_parity_rows={projected_rows}")
        if not hydration_ok:
            mismatches.append(f"artifact_rows={artifact_rows}; hydrated_rows={hydrated_rows}")
        if not route:
            mismatches.append("visual consumer route missing")
        return {
            "projection_state": "verified" if projection_ok else "missing_or_mismatched",
            "hydration_state": "verified" if hydration_ok else "missing_or_mismatched",
            "consumer_state": "verified" if consumer_ok else "missing",
            "projected_row_count": projected_rows,
            "hydrated_row_count": hydrated_rows,
            "consumer_route": route if consumer_ok else None,
            "parity_verified": projection_ok and hydration_ok and consumer_ok,
            "parity_reason": "; ".join(mismatches) if mismatches else None,
        }
    if branch_id in {"audio_prosody", "audio_event_intervals", "audio_diarization", "audio_sample_clouds"}:
        parity = status.get("audio_analysis_parity") if isinstance(status.get("audio_analysis_parity"), dict) else None
        if parity is None:
            parity_path = (status.get("output_files") or {}).get("audio_analysis_parity")
            try:
                parity = json.loads(Path(str(parity_path)).read_text(encoding="utf-8")) if parity_path else None
            except (OSError, json.JSONDecodeError):
                parity = None
        audio = _nested(status, ("results", "audio_analysis")) or {}
        rows_keys = {
            "audio_prosody": "cues", "audio_event_intervals": "intervals",
            "audio_diarization": "speaker_turns", "audio_sample_clouds": "clouds",
        }
        hydrated_rows = _row_count(audio.get(branch_id), rows_keys[branch_id])
        projected_rows = int(((parity or {}).get(branch_id) or {}).get("row_count") or 0) if parity else None
        route = ((parity or {}).get(branch_id) or {}).get("consumer_route") if parity else None
        projection_ok = projected_rows is not None and artifact_rows == projected_rows
        hydration_ok = hydrated_rows is not None and artifact_rows == hydrated_rows
        consumer_ok = bool(route and projection_ok and hydration_ok)
        mismatches = []
        if not projection_ok:
            mismatches.append(f"artifact_rows={artifact_rows}; audio_parity_rows={projected_rows}")
        if not hydration_ok:
            mismatches.append(f"artifact_rows={artifact_rows}; hydrated_rows={hydrated_rows}")
        if not route:
            mismatches.append("audio consumer route missing")
        return {
            "projection_state": "verified" if projection_ok else "missing_or_mismatched",
            "hydration_state": "verified" if hydration_ok else "missing_or_mismatched",
            "consumer_state": "verified" if consumer_ok else "missing",
            "projected_row_count": projected_rows, "hydrated_row_count": hydrated_rows,
            "consumer_route": route if consumer_ok else None,
            "parity_verified": projection_ok and hydration_ok and consumer_ok,
            "parity_reason": "; ".join(mismatches) if mismatches else None,
        }
    if branch_id == "native_statistical_interpretation":
        native = status.get("native_statistical_interpretation") if isinstance(status.get("native_statistical_interpretation"), dict) else None
        if native is None:
            native_path = (status.get("output_files") or {}).get("native_statistical_interpretation")
            try:
                native = json.loads(Path(str(native_path)).read_text(encoding="utf-8")) if native_path else None
            except (OSError, json.JSONDecodeError):
                native = None
        hydrated_rows = _row_count(native)
        statskit = ((native or {}).get("panel_routes") or {}).get("statskit") if native else None
        consumer_ok = bool(isinstance(statskit, dict) and statskit.get("status") == "operational")
        rows_ok = artifact_rows is not None and hydrated_rows == artifact_rows
        return {
            "projection_state": "verified" if rows_ok else "missing_or_mismatched",
            "hydration_state": "verified" if rows_ok else "missing_or_mismatched",
            "consumer_state": "verified" if consumer_ok else "missing",
            "projected_row_count": hydrated_rows,
            "hydrated_row_count": hydrated_rows,
            "consumer_route": "panel.statskit.native_statistical_interpretation" if consumer_ok else None,
            "parity_verified": rows_ok and consumer_ok,
            "parity_reason": None if rows_ok and consumer_ok else (
                f"artifact_rows={artifact_rows}; hydrated_rows={hydrated_rows}; "
                f"statskit_operational={consumer_ok}"
            ),
        }
    spec = PARITY_SPECS.get(branch_id)
    if not spec:
        return {
            "projection_state": "pending_verification",
            "hydration_state": "pending_verification",
            "consumer_state": "pending_verification",
            "projected_row_count": None,
            "hydrated_row_count": None,
            "parity_verified": False,
            "parity_reason": "branch_parity_contract_pending",
        }
    master = status.get("vaa1_annotation_master_schema") if isinstance(status.get("vaa1_annotation_master_schema"), dict) else {}
    layers = _nested(master, ("foundational_source_layers", "layers")) or {}
    layer = layers.get(spec["projection_layer"]) if isinstance(layers, dict) else None
    projected_rows = int(layer.get("row_count") or 0) if isinstance(layer, dict) and layer.get("status") == "available" else None
    hydrated = _nested(status, spec["hydration_path"])
    hydrated_rows = _row_count(hydrated, spec.get("rows_key"))
    projection_ok = projected_rows is not None and artifact_rows is not None and projected_rows == artifact_rows
    hydration_ok = hydrated_rows is not None and artifact_rows is not None and hydrated_rows == artifact_rows
    consumer_ok = bool(isinstance(layer, dict) and layer.get("maturity_route"))
    mismatches = []
    if not projection_ok:
        mismatches.append(f"artifact_rows={artifact_rows}; projected_rows={projected_rows}")
    if not hydration_ok:
        mismatches.append(f"artifact_rows={artifact_rows}; hydrated_rows={hydrated_rows}")
    if not consumer_ok:
        mismatches.append("StatsKit maturity route missing")
    return {
        "projection_state": "verified" if projection_ok else "missing_or_mismatched",
        "hydration_state": "verified" if hydration_ok else "missing_or_mismatched",
        "consumer_state": "verified" if consumer_ok else "missing",
        "projected_row_count": projected_rows,
        "hydrated_row_count": hydrated_rows,
        "consumer_route": layer.get("maturity_route") if isinstance(layer, dict) else None,
        "parity_verified": projection_ok and hydration_ok and consumer_ok,
        "parity_reason": "; ".join(mismatches) if mismatches else None,
    }


def _artifact_metadata(path_value: Any) -> dict[str, Any]:
    path = Path(str(path_value)) if path_value else None
    if not path or not path.is_file():
        return {"artifact_path": str(path) if path else None, "artifact_checksum": None,
                "artifact_schema": None, "row_count": None}
    raw = path.read_bytes()
    schema = None
    row_count = None
    try:
        value = json.loads(raw)
        if isinstance(value, dict):
            schema = value.get("schema")
            for key in ("segments", "anchors", "intervals", "samples", "findings", "records", "relationships", "speaker_turns", "cues", "clouds"):
                if isinstance(value.get(key), list):
                    row_count = len(value[key])
                    break
            if row_count is None and value.get("token_count") is not None:
                row_count = int(value.get("token_count") or 0)
            if row_count is None and isinstance(value.get("token_info"), dict):
                tokens = value["token_info"].get("tokens")
                if isinstance(tokens, list):
                    row_count = len(tokens)
        elif isinstance(value, list):
            row_count = len(value)
    except (UnicodeDecodeError, json.JSONDecodeError):
        if path.suffix.lower() == ".csv":
            row_count = max(0, raw.count(b"\n") - 1)
    return {"artifact_path": str(path), "artifact_checksum": f"sha256:{hashlib.sha256(raw).hexdigest()}",
            "artifact_schema": schema, "row_count": row_count}


def evaluate_full_analysis_manifest(status: dict[str, Any]) -> dict[str, Any]:
    analysis_id = str(status.get("analysis_id") or "")
    profile = str(status.get("pipeline_type") or "full")
    outputs = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    branches = []
    for branch_id, label, artifact_key, producer in BRANCHES:
        relevant = profile == "full" or (profile == "visual_only" and branch_id in {"tracked_objects", "ocr", "expressions", "shot_boundaries", "spatial_tone_scan", "adaptive_visual_scan"}) or (profile == "audio_only" and branch_id in {"transcript", "linked_transcript", "pos_analysis", "quan_analysis", "audio_prosody", "audio_event_intervals", "audio_diarization", "audio_sample_clouds"})
        metadata = _artifact_metadata(outputs.get(artifact_key))
        exists = metadata["artifact_checksum"] is not None
        state = "computed" if exists else "artifact_missing"
        parity = _parity_evidence(status, branch_id, metadata.get("row_count")) if exists else {
            "projection_state": "missing", "hydration_state": "missing", "consumer_state": "missing",
            "projected_row_count": None, "hydrated_row_count": None, "parity_verified": False,
            "parity_reason": "canonical artifact missing",
        }
        error = results.get(f"{branch_id}_error") or results.get("quan_error" if branch_id == "quan_analysis" else "pos_error" if branch_id == "pos_analysis" else "")
        if error:
            state = "failed"
        if branch_id == "audio_diarization" and exists:
            try:
                payload = json.loads(Path(metadata["artifact_path"]).read_text(encoding="utf-8"))
                if payload.get("status") != "completed_measured":
                    state = "computed_degraded"
            except (OSError, json.JSONDecodeError):
                state = "failed"
        if state == "computed" and not parity["parity_verified"]:
            if parity["projection_state"] != "verified":
                state = "projection_missing"
            elif parity["hydration_state"] != "verified":
                state = "hydration_missing"
            else:
                state = "consumer_missing"
        branches.append({"branch_id": branch_id, "label": label, "required": relevant,
                         "state": state if relevant else "not_applicable", "producer": producer,
                         "method_version": None, **metadata,
                         **parity,
                         "error": str(error) if error else None,
                         "retryable": branch_id != "audio_diarization",
                         "recovery_action": "refresh_projections" if exists and not parity["parity_verified"] else "repair_missing" if not exists else "none"})
    branches.append({"branch_id": "contradiction_resolution", "label": "Contradiction resolution",
                     "required": False, "state": "unsupported_platform_capability", "producer": None,
                     "method_version": None, "artifact_path": None, "artifact_checksum": None,
                     "artifact_schema": None, "row_count": None, "projection_state": None,
                     "hydration_state": None, "consumer_state": None, "error": None,
                     "retryable": False, "recovery_action": "capability_enhancement"})
    blocking = [f"{item['label']}: {item['state']}" for item in branches if item["required"] and item["state"] != "computed"]
    delivered = sum(item["required"] and item["state"] == "computed" for item in branches)
    required = sum(item["required"] for item in branches)
    percentage = round(100 * delivered / required, 1) if required else 100.0
    return {"schema": "vaa1.full_analysis_manifest.v1", "analysis_id": analysis_id,
            "requested_profile": profile, "overall_state": "full" if not blocking else "partial",
            "delivery_percentage": percentage, "delivered_count": delivered,
            "required_count": required, "branches": branches, "blocking_reasons": blocking,
            "verified_at": datetime.now(timezone.utc).isoformat()}


def write_full_analysis_manifest(status: dict[str, Any], analysis_dir: Path) -> dict[str, Any]:
    manifest = evaluate_full_analysis_manifest(status)
    path = analysis_dir / "full_analysis_manifest.json"
    atomic_write_json(path, manifest)
    status["full_analysis_manifest"] = manifest
    status.setdefault("output_files", {})["full_analysis_manifest"] = str(path)
    return manifest
