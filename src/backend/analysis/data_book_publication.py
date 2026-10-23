"""Datascene Data Book per-video and corpus publication builder."""

from __future__ import annotations

import hashlib
import html
import json
import mimetypes
import os
import re
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .analysis_recovery import atomic_write_json
from .narrative_agent_continuity_persistence import validate_saved_continuity_state


SCHEMA_VERSION = "1.0.0"
SCHEMA_ID = "https://datascene.eu/schemas/publication/data-book-package/1.0.0"
ENGINE_VERSION = "1.0.0"
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
MAX_EMBEDDED_FILE_BYTES = int(os.getenv("VAA1_PUBLICATION_EMBED_FILE_MAX_BYTES", str(100 * 1024 * 1024)))
DEFAULT_RESULTS_DIR = Path(os.getenv("VAA1_RESULTS_DIR", "outputs/api_results"))


FEATURES = [
    ("video_source_media", "Video and Source Media", "video", ["source_video", "source_media_metadata_json", "source_media_metadata_csv"]),
    ("transcript", "Transcript", "transcript", ["transcript", "linked_transcript", "lm_transcript"]),
    ("pos", "Parts of Speech", "pos", ["pos_analysis"]),
    ("quant", "Quantitative Language Analysis", "quant", ["quan_analysis"]),
    ("objects_props", "Objects and Props", "objects", ["yolo_csv", "tracked_objects_csv", "tracked_objects_json", "time_bank_objects"]),
    ("ocr", "On-Screen Text", "ocr", ["ocr_csv", "time_bank_ocr"]),
    ("expressions", "Expressions", "expressions", ["expression_json", "time_bank_expressions"]),
    ("audio_prosody", "Audio and Prosody", "audio", ["audio_prosody", "audio_event_intervals", "time_bank_audio"]),
    ("speaker_diarization", "Speakers and Diarization", "audio", ["audio_diarization", "audio_sample_clouds"]),
    ("scene_cards", "Scene Cards", "scene_cards", ["mise_en_scene_scene_cards", "source_extraction_metadata_summary"]),
    ("sfl", "Systemic Functional Language", "sfl", ["dependency_sfl_stage1"]),
    ("meaning_plot", "Meaning and Plot", "meaning_plot", ["multimodal_meaning_stage1", "narrative_lens_reading", "character_path_reading", "datascene_meaning_network"]),
    ("narrative_agents", "Narrative Agents", "narrative_agents", ["identity_triangulation", "agent_persistence_scene_cut", "second_order_label_proliferation"]),
    ("statskit", "Statistical Analysis", "statskit", ["native_statistical_interpretation", "stats_research_question"]),
    ("matrices", "POS and Quant Matrices", "matrices", ["pos_matrix", "quant_matrix"]),
    ("master_schema", "Master Schema and Governance", "master_schema", ["vaa1_annotation_master_schema", "annotation_corrections", "live_mature_data_proliferation_audit"]),
    ("search", "Search and Retrieval", "search", []),
]


HUMAN_FILE_NAMES = {
    "source_video": "Source Video",
    "source_media_metadata_json": "Source Media Metadata.json",
    "source_media_metadata_csv": "Source Media Metadata.csv",
    "transcript": "Transcript.json",
    "linked_transcript": "Source-Linked Transcript.json",
    "lm_transcript": "Language Model Transcript.json",
    "pos_analysis": "Parts of Speech Analysis.json",
    "quan_analysis": "Quantitative Language Analysis.json",
    "yolo_csv": "Object Detections.csv",
    "tracked_objects_csv": "Tracked Objects.csv",
    "tracked_objects_json": "Tracked Objects.json",
    "time_bank_objects": "Object Source Timeline.json",
    "ocr_csv": "On-Screen Text.csv",
    "time_bank_ocr": "On-Screen Text Source Timeline.json",
    "expression_json": "Expression Detections.json",
    "time_bank_expressions": "Expression Source Timeline.json",
    "audio_prosody": "Prosodic Measurements.json",
    "audio_event_intervals": "Audio Event Intervals.json",
    "time_bank_audio": "Audio Source Timeline.json",
    "audio_diarization": "Speaker Diarization.json",
    "audio_sample_clouds": "Speaker Audio Samples.json",
    "mise_en_scene_scene_cards": "Scene Cards.json",
    "source_extraction_metadata_summary": "Scene Card Source Metadata.json",
    "dependency_sfl_stage1": "Systemic Functional Language Analysis.json",
    "multimodal_meaning_stage1": "Multimodal Meaning Analysis.json",
    "narrative_lens_reading": "Narrative Lens Readings.json",
    "character_path_reading": "Character Paths.json",
    "datascene_meaning_network": "Meaning Network.json",
    "identity_triangulation": "Identity Triangulation.json",
    "agent_persistence_scene_cut": "Narrative Agent Persistence.json",
    "second_order_label_proliferation": "Second-Order Meaning Candidates.json",
    "native_statistical_interpretation": "Statistical Interpretation.json",
    "stats_research_question": "Research Question Analysis.json",
    "pos_matrix": "Parts of Speech Matrix.json",
    "quant_matrix": "Quantitative Language Matrix.json",
    "vaa1_annotation_master_schema": "Annotation Master Schema.json",
    "annotation_corrections": "Annotation Corrections.json",
    "live_mature_data_proliferation_audit": "Mature Data Governance Audit.json",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode("utf-8")


def _sha_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def _sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def _id(prefix: str, value: Any) -> str:
    return f"{prefix}:{hashlib.sha256(_canonical(value)).hexdigest()[:20]}"


def _safe_name(value: str) -> str:
    clean = re.sub(r"[\\/:*?\"<>|]+", " - ", str(value)).strip(" .")
    return clean or "Untitled"


def _provenance(method: str = "Datascene publication adapter", created_at: str | None = None) -> dict[str, Any]:
    return {"produced_by": "script", "production_method": method, "created_at": created_at or _now(), "script_version": ENGINE_VERSION}


def _authority() -> dict[str, Any]:
    return {"authority_state": "system_generated", "authority_policy_id": "datascene.authority.precedence.v1"}


def _check(check_id: str, message: str, status: str = "passed", severity: str = "info") -> dict[str, Any]:
    return {"check_id": check_id, "status": status, "severity": severity, "message": message}


def _completeness(checks: list[dict[str, Any]], missing: list[str] | None = None, checked_at: str | None = None) -> dict[str, Any]:
    errors = sum(item["status"] == "failed" for item in checks)
    warnings = sum(item["status"] == "warning" for item in checks)
    return {
        "status": "invalid" if errors else "complete_with_warnings" if warnings else "complete",
        "checked_at": checked_at or _now(), "checks": checks, "missing_feature_ids": missing or [],
        "warning_count": warnings, "error_count": errors,
    }


def _registry_snapshot(captured_at: str | None = None) -> dict[str, Any]:
    entries = []
    for index, (feature_id, title, panel_id, _) in enumerate(FEATURES, 1):
        folder = f"Data Book/Chapters/{index:02d} - {_safe_name(title)}"
        entries.append({
            "feature_id": feature_id, "canonical_name": title, "panel_id": panel_id,
            "feature_version": "1.0.0", "publication_status": "operational",
            "publication_scope": ["per_video", "corpus"], "chapter_type": "feature_chapter",
            "chapter_schema_id": SCHEMA_ID + "#/$defs/featureChapter",
            "publication_adapter": f"datascene.adapter.{feature_id}.v1",
            "empty_state_policy": "publish_governed_empty_chapter",
            "claim_eligibility_policy_id": "datascene.claim.eligibility.v1",
            "archive_path_template": folder + "/Chapter.json",
        })
    return {
        "registry_id": "datascene.operational.features.v1", "registry_version": "1.0.0",
        "captured_at": captured_at or _now(), "checksum": _sha_bytes(_canonical(entries)), "entries": entries,
    }


def _artifact_count(path: Path) -> int:
    try:
        if path.suffix.lower() == ".json":
            value = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(value, list): return len(value)
            if isinstance(value, dict):
                for key in ("records", "segments", "items", "rows", "scene_cards", "relationships", "detections"):
                    if isinstance(value.get(key), list): return len(value[key])
        if path.suffix.lower() == ".csv":
            with path.open("r", encoding="utf-8", errors="ignore") as handle:
                return max(0, sum(1 for _ in handle) - 1)
    except Exception:
        pass
    return 1


def _analysis_results_dir(status: dict[str, Any]) -> Path | None:
    analysis_id = str(status.get("analysis_id") or status.get("id") or "").strip()
    if not analysis_id:
        return None
    return DEFAULT_RESULTS_DIR / analysis_id


def _overlay_canonical_artifact_paths(status: dict[str, Any]) -> dict[str, str]:
    """Return output files plus canonical sidecars that must win for publication."""
    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    merged = {str(key): str(value) for key, value in output_files.items() if value}
    analysis_dir = _analysis_results_dir(status)
    if analysis_dir is None:
        return merged
    canonical_files = {
        "annotation_corrections": "annotation_corrections.json",
        "vaa1_annotation_master_schema": "vaa1_annotation_master_schema.json",
        "live_mature_data_proliferation_audit": "live_mature_data_proliferation_audit.json",
        "decision_ledger": "decision_ledger.json",
        "interpretation_registry": "interpretation_registry.json",
        "framework_projections": "framework_projections.json",
        "narrative_agent_continuity_projection": "narrative_agent_continuity_projection.json",
        "narrative_agent_continuity_state": "narrative_agent_continuity_state.json",
    }
    for artifact_key, filename in canonical_files.items():
        canonical_path = analysis_dir / filename
        if canonical_path.is_file():
            merged[artifact_key] = str(canonical_path)
    return merged


CHAPTER_FIVE_RESEARCH_QUESTION = (
    "How can the Datascene method operationalize and compare prospective narrative "
    "constructions across a small, heterogeneous corpus of multimodal broadcast news reports?"
)


def _read_json_artifact(path_value: Any) -> Any:
    try:
        path = Path(str(path_value))
        return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None
    except (OSError, ValueError, TypeError):
        return None


def _list_at(payload: Any, *keys: str) -> list[Any]:
    if not isinstance(payload, dict):
        return payload if isinstance(payload, list) else []
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list):
            return value
    return []


def _publication_interpretation_payload(status: dict[str, Any]) -> dict[str, Any] | None:
    """Recheck and preserve a continuity construct without flattening state."""
    files = _overlay_canonical_artifact_paths(status)
    projection = status.get("narrative_agent_continuity_projection")
    if not isinstance(projection, dict):
        projection = _read_json_artifact(files.get("narrative_agent_continuity_projection"))
    state = status.get("narrative_agent_continuity_state")
    if not isinstance(state, dict):
        state = _read_json_artifact(files.get("narrative_agent_continuity_state"))
    if not isinstance(projection, dict) and isinstance(state, dict):
        projection = state.get("projection")
    if not isinstance(projection, dict):
        return None

    project_id = str(status.get("project_id") or "")
    analysis_id = str(status.get("analysis_id") or "")
    canonical = projection.get("canonical_collection")
    graph = projection.get("graph_projection")
    snapshot = projection.get("constellational_snapshot")
    if not all(isinstance(item, dict) for item in (canonical, graph, snapshot)):
        raise ValueError("Interpretation projection is incomplete at publication time")
    if str(canonical.get("project_id") or "") != project_id:
        raise ValueError("Interpretation projection project boundary mismatch")
    revision = str(projection.get("revision") or "")
    if not revision:
        raise ValueError("Interpretation projection revision is missing")
    invalidation = projection.get("invalidation") if isinstance(projection.get("invalidation"), dict) else {}
    if str(invalidation.get("state") or "current") != "current":
        raise ValueError("Stale interpretation projection is not publication eligible")
    for surface_name, surface in (("graph", graph), ("snapshot", snapshot)):
        surface_revision = str(surface.get("revision") or revision)
        if surface_revision != revision:
            raise ValueError(f"Interpretation {surface_name} revision mismatch")

    ledger: dict[str, Any] = {}
    authorized_analysis_ids = {analysis_id}
    if isinstance(state, dict):
        validated = validate_saved_continuity_state(state, expected_project_id=project_id)
        if analysis_id not in (validated.get("analysis_ids") or []):
            raise ValueError("Interpretation saved state does not include this analysis")
        if str(validated.get("projection_revision") or "") != revision:
            raise ValueError("Interpretation saved-state revision is stale")
        ledger = validated.get("decision_ledger") or {}
        authorized_analysis_ids = {str(value) for value in validated.get("analysis_ids") or [] if str(value)}
    elif isinstance(status.get("canonical_decision_ledger"), dict):
        ledger = status["canonical_decision_ledger"]

    tickets = [dict(row) for row in graph.get("relation_tickets") or [] if isinstance(row, dict)]
    decisions = [dict(row) for row in ledger.get("decisions") or [] if isinstance(row, dict)]
    ticket_states: dict[str, int] = {}
    for ticket in tickets:
        value = str(ticket.get("state") or "candidate")
        ticket_states[value] = ticket_states.get(value, 0) + 1
    history_states: dict[str, int] = {}
    for decision in decisions:
        value = str(decision.get("value") or decision.get("review_status") or "unresolved")
        history_states[value] = history_states.get(value, 0) + 1
    publication_claims = []
    withheld_claims = []
    for ticket in tickets:
        evidence_refs = [dict(ref) for ref in ticket.get("evidence_refs") or [] if isinstance(ref, dict)]
        navigation = ticket.get("source_navigation") if isinstance(ticket.get("source_navigation"), dict) else {}
        if not navigation and evidence_refs:
            first_ref = evidence_refs[0]
            time_range = first_ref.get("time_range") if isinstance(first_ref.get("time_range"), dict) else {}
            if first_ref.get("analysis_id") and time_range.get("start") is not None and time_range.get("end") is not None:
                navigation = {
                    "analysis_id": first_ref.get("analysis_id"),
                    "source_interval": dict(time_range),
                    "return_panel": "narrative_agent",
                    "return_ticket_id": ticket.get("ticket_id"),
                    "preserve_review_position": True,
                    "derived_from_evidence_ref": True,
                }
        interval = navigation.get("source_interval") if isinstance(navigation.get("source_interval"), dict) else {}
        source_linked = bool(
            evidence_refs
            and str(navigation.get("analysis_id") or "") in authorized_analysis_ids
            and interval.get("start") is not None
            and interval.get("end") is not None
        )
        claim = {
            "claim_id": ticket.get("assertion_id") or ticket.get("ticket_id"),
            "ticket_id": ticket.get("ticket_id"),
            "edge_id": ticket.get("edge_id"),
            "subject_node_id": ticket.get("subject_node_id"),
            "predicate": ticket.get("predicate"),
            "object_node_id": ticket.get("object_node_id"),
            "state": ticket.get("state") or "candidate",
            "authority": ticket.get("authority"),
            "analyst_meaning": ticket.get("analyst_meaning") or "",
            "warrant": ticket.get("warrant") or "",
            "alternatives": ticket.get("alternatives") or [],
            "evidence_refs": evidence_refs,
            "source_navigation": navigation or None,
            "producer": {
                "id": "datascene.stage8.data_book_interpretation_adapter.v1",
                "projection_schema": projection.get("schema"),
                "canonical_revision": revision,
            },
            "publication_eligibility": "eligible" if source_linked else "withheld_missing_exact_source_chain",
        }
        (publication_claims if source_linked else withheld_claims).append(claim)
    source_chain_core = {
        "schema": "vaa1.data_book_interpretation_source_chain.v1",
        "project_id": project_id,
        "analysis_id": analysis_id,
        "canonical_revision": revision,
        "producer": {
            "id": "datascene.stage8.data_book_interpretation_adapter.v1",
            "version": ENGINE_VERSION,
            "projection_schema": projection.get("schema"),
        },
        "published_claims": publication_claims,
        "withheld_claims": withheld_claims,
        "summary": {
            "eligible_claim_count": len(publication_claims),
            "withheld_claim_count": len(withheld_claims),
            "all_published_claims_have_exact_source_navigation": all(
                claim["publication_eligibility"] == "eligible" for claim in publication_claims
            ),
            "withheld_claims_are_not_rendered_as_findings": True,
        },
    }
    source_chain_manifest = {
        **source_chain_core,
        "content_checksum": _sha_bytes(_canonical(source_chain_core)),
    }
    core = {
        "schema": "vaa1.data_book_interpretation_construct.v1",
        "project_id": project_id,
        "analysis_id": analysis_id,
        "collection_id": canonical.get("collection_id"),
        "canonical_revision": revision,
        "narrative_agent": {
            "key": canonical.get("narrative_agent_key"),
            "label": canonical.get("narrative_agent_label"),
        },
        "eligibility": {
            "eligible": True,
            "checked_at_export": True,
            "freshness_state": "current",
            "project_boundary_verified": True,
            "saved_revision_verified": bool(state),
        },
        "canonical_collection": canonical,
        "constellational_snapshot": snapshot,
        "graph_projection": graph,
        "decision_history": decisions,
        "publication_claims": publication_claims,
        "withheld_claims": withheld_claims,
        "source_chain_manifest": source_chain_manifest,
        "state_distinctions": {
            "relation_ticket_counts": ticket_states,
            "decision_history_counts": history_states,
            "preserved_states": ["mature", "confirmed", "candidate", "rejected", "deferred", "superseded", "stale"],
            "flattened": False,
        },
    }
    return {**core, "content_checksum": _sha_bytes(_canonical(core))}


def _render_interpretation_review(payload: dict[str, Any]) -> str:
    agent = payload.get("narrative_agent") or {}
    manifest = payload.get("source_chain_manifest") or {}
    summary = manifest.get("summary") or {}
    lines = [
        f"# Governed Narrative Agent Interpretation — {agent.get('label') or 'Unknown agent'}",
        "",
        f"Canonical revision: `{payload.get('canonical_revision')}`",
        f"Publication eligibility checked: `{str((payload.get('eligibility') or {}).get('checked_at_export', False)).lower()}`",
        f"Source-chain eligible claims: {summary.get('eligible_claim_count', 0)}",
        f"Withheld claims: {summary.get('withheld_claim_count', 0)}",
        "",
        "## Source-linked claims",
        "",
    ]
    for claim_number, claim in enumerate(payload.get("publication_claims") or [], start=1):
        navigation = claim.get("source_navigation") or {}
        interval = navigation.get("source_interval") or {}
        subject = claim.get("subject_node_id") or "unknown subject"
        target = claim.get("object_node_id") or "unknown object"
        claim_id = claim.get("claim_id") or claim.get("ticket_id") or "unknown claim"
        lines.append(
            f"{claim_number}. **{claim.get('predicate')}** — {claim.get('state')} — "
            f"{navigation.get('analysis_id')} @ {interval.get('start')}–{interval.get('end')} s  "
            f"  `{subject}` → `{target}`  "
            f"  Claim: `{claim_id}`"
        )
    if not payload.get("publication_claims"):
        lines.append("- No interpretation claim passed exact source-chain eligibility.")
    lines.extend(["", "## Withheld from findings", ""])
    for claim in payload.get("withheld_claims") or []:
        lines.append(
            f"- **{claim.get('predicate')}** — {claim.get('state')} — "
            "withheld because exact source navigation is unavailable."
        )
    if not payload.get("withheld_claims"):
        lines.append("- None.")
    lines.extend([
        "",
        "Candidate and withheld relations are preserved for review and are not rendered as accepted findings.",
        "",
    ])
    return "\n".join(lines)


def _narrative_agent_confirmation_register(status: dict[str, Any]) -> dict[str, Any] | None:
    """Publish every active analyst-governed agent assignment, not only the open agent."""
    files = _overlay_canonical_artifact_paths(status)
    ledger = status.get("canonical_decision_ledger")
    if not isinstance(ledger, dict) or not isinstance(ledger.get("decisions"), list) or not ledger.get("decisions"):
        ledger = _read_json_artifact(files.get("decision_ledger"))
    if not isinstance(ledger, dict):
        return None
    analysis_id = str(status.get("analysis_id") or "")
    confirmations = []
    seen = set()
    for decision in ledger.get("decisions") or []:
        if not isinstance(decision, dict) or decision.get("property") != "narrative_agent.assignment":
            continue
        if str(decision.get("validity") or "current") != "current":
            continue
        if str(decision.get("review_status") or "accepted") != "accepted":
            continue
        if str(decision.get("projection_status") or "active") != "active":
            continue
        decision_id = str(decision.get("decision_id") or "")
        if not decision_id or decision_id in seen:
            continue
        seen.add(decision_id)
        scope = decision.get("scope") if isinstance(decision.get("scope"), dict) else {}
        confirmations.append({
            "decision_id": decision_id,
            "narrative_agent_label": decision.get("value"),
            "analysis_id": str(decision.get("analysis_id") or analysis_id),
            "source_interval": {
                "start": scope.get("start_seconds"),
                "end": scope.get("end_seconds"),
            },
            "source_geometry": scope.get("geometry"),
            "authority": decision.get("authority"),
            "maturity": decision.get("maturity"),
            "evidence_refs": list(decision.get("evidence_refs") or []),
            "correction_refs": list(decision.get("correction_refs") or []),
            "created_at": decision.get("created_at"),
            "created_by": decision.get("created_by"),
        })
    if not confirmations:
        return None
    confirmations.sort(key=lambda row: (
        float((row.get("source_interval") or {}).get("start") or 0),
        str(row.get("narrative_agent_label") or "").casefold(),
        str(row.get("decision_id") or ""),
    ))
    label_counts: dict[str, int] = {}
    for row in confirmations:
        label = str(row.get("narrative_agent_label") or "Unlabelled")
        label_counts[label] = label_counts.get(label, 0) + 1
    core = {
        "schema": "vaa1.data_book_narrative_agent_confirmation_register.v1",
        "project_id": str(status.get("project_id") or ""),
        "analysis_id": analysis_id,
        "confirmation_count": len(confirmations),
        "label_counts": dict(sorted(label_counts.items(), key=lambda item: item[0].casefold())),
        "confirmations": confirmations,
        "policy": {
            "complete_active_accepted_assignments": True,
            "selected_panel_agent_is_not_a_publication_filter": True,
            "labels_are_preserved_without_silent_alias_merging": True,
        },
    }
    return {**core, "content_checksum": _sha_bytes(_canonical(core))}


def _render_narrative_agent_confirmation_register(payload: dict[str, Any]) -> str:
    lines = [
        "# All Governed Narrative Agent Confirmations",
        "",
        f"Active accepted confirmations: {payload.get('confirmation_count', 0)}",
        f"Distinct preserved labels: {len(payload.get('label_counts') or {})}",
        "",
        "Labels are reproduced as governed. Apparent aliases remain distinct until an analyst-governed merge resolves them.",
        "",
        "## Confirmation register",
        "",
    ]
    for number, row in enumerate(payload.get("confirmations") or [], start=1):
        interval = row.get("source_interval") or {}
        lines.append(
            f"{number}. **{row.get('narrative_agent_label')}** — {row.get('maturity')} — "
            f"{row.get('analysis_id')} @ {interval.get('start')}–{interval.get('end')} s  "
            f"  Decision: `{row.get('decision_id')}`"
        )
    return "\n".join(lines) + "\n"


def _chapter_five_case(status: dict[str, Any], video_package: dict[str, Any]) -> dict[str, Any]:
    files = _overlay_canonical_artifact_paths(status)
    decisions = _list_at(_read_json_artifact(files.get("decision_ledger")), "decisions")
    interpretations = _list_at(_read_json_artifact(files.get("interpretation_registry")), "records")
    current_decisions = [item for item in decisions if isinstance(item, dict) and item.get("validity", "current") == "current"]
    decision_states: dict[str, int] = {}
    for item in current_decisions:
        state = str(item.get("review_status") or "unresolved")
        decision_states[state] = decision_states.get(state, 0) + 1
    interpretation_states: dict[str, int] = {}
    for item in interpretations:
        if not isinstance(item, dict) or item.get("validity", "current") != "current":
            continue
        state = str(item.get("status") or item.get("maturity") or "unresolved")
        interpretation_states[state] = interpretation_states.get(state, 0) + 1
    chapters = video_package["data_book"]["chapters"]
    feature_counts = {
        chapter["feature_id"]: sum(
            int(record.get("value", {}).get("record_count") or 0)
            for record in chapter.get("content", {}).get("records", [])
        )
        for chapter in chapters
    }
    identity = video_package["video_identity"]
    return {
        "analysis_id": identity["video_id"],
        "title": identity["title"],
        "source_identity": identity["source_identity"],
        "source_checksum": identity["media_checksum"],
        "duration_ms": identity["duration_ms"],
        "clock_id": video_package["source_clock"]["clock_id"],
        "feature_record_counts": feature_counts,
        "decision_summary": {"total_current": len(current_decisions), "states": decision_states},
        "interpretation_summary": {"total": len(interpretations), "states": interpretation_states},
        "confirmed_decisions": [
            {
                "decision_id": item.get("decision_id"),
                "property": item.get("property"),
                "value": item.get("value"),
                "scope": item.get("scope"),
                "evidence_refs": item.get("evidence_refs") or [],
                "created_by": item.get("created_by"),
            }
            for item in current_decisions
            if item.get("review_status") == "accepted"
        ],
        "candidate_notice": "Candidate interpretations require analyst review and are not reported as findings.",
    }


def _chapter_five_report(statuses: list[dict[str, Any]], built: list[dict[str, Any]], project_id: str, generated_at: str) -> tuple[dict[str, Any], str, str]:
    cases = [
        _chapter_five_case(status, item["package"]["video_package"])
        for status, item in zip(statuses, built)
    ]
    feature_ids = [feature_id for feature_id, *_ in FEATURES]
    report = {
        "schema": "datascene.chapter_five_research_report.v1",
        "title": "Chapter 5 research report — anticipatory narrative corpus",
        "project_id": project_id,
        "generated_at": generated_at,
        "research_question": CHAPTER_FIVE_RESEARCH_QUESTION,
        "methodological_answer": (
            "Datascene operationalizes prospective narrative comparison by binding each case to a "
            "versioned source and Global Clock, surfacing multimodal evidence as candidate material, "
            "preserving analyst decisions separately from candidates, and retaining source traceback "
            "for cross-case inspection and recovery."
        ),
        "scope_boundary": (
            "This is a small heterogeneous case corpus. Counts describe available governed records; "
            "they are not substantive findings or representative claims."
        ),
        "cases": cases,
        "comparison_matrix": [
            {"feature_id": feature_id, **{case["analysis_id"]: case["feature_record_counts"].get(feature_id, 0) for case in cases}}
            for feature_id in feature_ids
        ],
        "analyst_completion": {
            "corpus_matching": "requires_analyst_statement",
            "anticipatory_configuration": "report_confirmed_decisions_only",
            "cross_case_synthesis": "requires_analyst_statement",
            "limitations": "requires_analyst_review",
        },
        "verification": {
            "case_count": len(cases),
            "source_checksums_present": all(bool(case["source_checksum"]) for case in cases),
            "clock_ids_present": all(bool(case["clock_id"]) for case in cases),
            "restart_basis": "published from persisted saved analyses and canonical sidecars",
        },
    }
    lines = [
        f"# {report['title']}", "", f"**Research question:** {CHAPTER_FIVE_RESEARCH_QUESTION}", "",
        "## Methodological answer", "", report["methodological_answer"], "", report["scope_boundary"], "",
        "## Case readiness", "", "| Case | Duration | Current decisions | Candidate/interpretive records | Source checksum |", "|---|---:|---:|---:|---|",
    ]
    for case in cases:
        lines.append(f"| {case['title']} | {case['duration_ms'] / 1000:.3f}s | {case['decision_summary']['total_current']} | {case['interpretation_summary']['total']} | `{case['source_checksum']}` |")
    lines += ["", "## Cross-case evidence matrix", "", "| Feature | " + " | ".join(case["title"] for case in cases) + " |", "|---|" + "---:|" * len(cases)]
    for row in report["comparison_matrix"]:
        lines.append("| " + row["feature_id"] + " | " + " | ".join(str(row[case["analysis_id"]]) for case in cases) + " |")
    lines += ["", "## Analyst completion", "", "The analyst must add the corpus-matching rationale, confirmed anticipatory configurations, cross-case synthesis, and limitations. Candidate records are not automatically promoted to findings.", ""]
    markdown = "\n".join(lines)
    html_body = "<br>".join(html.escape(line) for line in lines)
    printable = f"""<!doctype html><html><head><meta charset=\"utf-8\"><title>{html.escape(report['title'])}</title><style>@page{{size:A4;margin:16mm}}body{{font:11pt/1.45 system-ui,sans-serif;color:#111}}table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #bbb;padding:5px;text-align:left}}code{{font-size:8pt;overflow-wrap:anywhere}}@media print{{button{{display:none}}}}</style></head><body><button onclick=\"print()\">Print report</button><pre style=\"white-space:pre-wrap;font:inherit\">{html.escape(markdown)}</pre></body></html>"""
    return report, markdown, printable


def _write_deterministic_zip(path: Path, files: dict[str, bytes | Path]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            for archive_path in sorted(files):
                value = files[archive_path]
                info = zipfile.ZipInfo(archive_path, FIXED_ZIP_TIME)
                info.compress_type = zipfile.ZIP_STORED
                info.external_attr = 0o100644 << 16
                if isinstance(value, Path):
                    with value.open("rb") as source, archive.open(info, "w", force_zip64=True) as target:
                        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
                            target.write(chunk)
                else:
                    archive.writestr(info, value)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _write_atomic_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        temporary.write_bytes(content)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def build_video_publication(status: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    analysis_id = str(status["analysis_id"])
    video_id = analysis_id
    project_id = str(status.get("project_id") or "local-research-project")
    source = Path(str(status.get("source_video_path") or status.get("file_path") or ""))
    if not source.exists(): raise ValueError("Source video is missing")
    is_completed = status.get("status") == "completed"
    title = _safe_name(Path(str(status.get("original_filename") or source.name)).stem)
    source_checksum = _sha_file(source)
    edition_id = _id("video-edition", {"analysis": analysis_id, "completed": status.get("analysis_completed_at"), "source": source_checksum})
    package_id = _id("video-publication", edition_id)
    data_book_id = _id("data-book", edition_id)
    report_id = _id("scientific-report", edition_id)
    clock_id = _id("source-clock", {"video": video_id, "source": source_checksum})
    generated_at = str(status.get("analysis_completed_at") or status.get("uploaded_at") or _now())
    output_files = _overlay_canonical_artifact_paths(status)
    output_files = {"source_video": str(source), **output_files}
    archive_files: dict[str, bytes | Path] = {}
    associated_files: list[dict[str, Any]] = []
    chapters = []
    browse_children = []
    interpretation_payload = _publication_interpretation_payload(status)
    confirmation_register = _narrative_agent_confirmation_register(status)

    for index, (feature_id, chapter_title, panel_id, artifact_keys) in enumerate(FEATURES, 1):
        chapter_id = _id("chapter", {"edition": edition_id, "feature": feature_id})
        folder = f"Data Book/Chapters/{index:02d} - {_safe_name(chapter_title)}"
        records = []
        chapter_file_refs = []
        for artifact_key in artifact_keys:
            raw_path = output_files.get(artifact_key)
            if not raw_path: continue
            path = Path(str(raw_path))
            if not path.exists() or not path.is_file(): continue
            human_name = (_safe_name(str(status.get("original_filename") or path.name)) if artifact_key == "source_video" else HUMAN_FILE_NAMES.get(artifact_key) or _safe_name(path.name))
            archive_path = f"{folder}/Files/{human_name}"
            checksum = _sha_file(path)
            file_id = _id("file", {"edition": edition_id, "path": archive_path, "checksum": checksum})
            include = path.stat().st_size <= MAX_EMBEDDED_FILE_BYTES
            if include: archive_files[archive_path] = path
            associated_files.append({
                "file_id": file_id, "archive_path": archive_path, "role": "source_media" if artifact_key == "source_video" else "feature_records",
                "media_type": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
                "size_bytes": path.stat().st_size, "inclusion_state": "included" if include else "referenced",
                "checksum": checksum, "related_video_ids": [video_id], "related_chapter_ids": [chapter_id],
                "generated_by": _provenance(f"Existing VAA1 artifact: {artifact_key}", generated_at), "deterministic": True,
            })
            chapter_file_refs.append(file_id)
            records.append({
                "record_id": _id("record", {"chapter": chapter_id, "artifact": artifact_key, "checksum": checksum}),
                "record_type": "published_artifact", "video_id": video_id,
                "source_coordinates": {"video_id": video_id, "clock_id": clock_id, "availability_state": "not_temporal"},
                "value": {"artifact_key": artifact_key, "file_id": file_id, "archive_path": archive_path, "checksum": checksum, "record_count": _artifact_count(path)},
                "unit": None, "confidence": None, "maturity_state": "mature", "authority": _authority(),
                "provenance": _provenance(f"Publication projection from {artifact_key}", generated_at), "reference_ids": [],
            })
        if feature_id == "narrative_agents" and interpretation_payload is not None:
            archive_path = f"{folder}/Files/Governed Narrative Agent Interpretation.json"
            content = json.dumps(interpretation_payload, indent=2, ensure_ascii=False).encode("utf-8")
            checksum = _sha_bytes(content)
            file_id = _id("file", {"edition": edition_id, "path": archive_path, "checksum": checksum})
            archive_files[archive_path] = content
            associated_files.append({
                "file_id": file_id,
                "archive_path": archive_path,
                "role": "governed_interpretation_construct",
                "media_type": "application/json",
                "size_bytes": len(content),
                "inclusion_state": "included",
                "checksum": checksum,
                "related_video_ids": [video_id],
                "related_chapter_ids": [chapter_id],
                "generated_by": _provenance("Stage 8 publication-time interpretation eligibility adapter", generated_at),
                "deterministic": True,
            })
            chapter_file_refs.append(file_id)
            source_chain_path = f"{folder}/Files/Interpretation Source Chain Manifest.json"
            source_chain_content = json.dumps(
                interpretation_payload["source_chain_manifest"], indent=2, ensure_ascii=False
            ).encode("utf-8")
            review_path = f"{folder}/Governed Interpretation Review.md"
            review_content = _render_interpretation_review(interpretation_payload).encode("utf-8")
            supplemental_files = [
                (source_chain_path, source_chain_content, "interpretation_source_chain_manifest", "application/json"),
                (review_path, review_content, "analyst_review_render", "text/markdown"),
            ]
            supplemental_ids = []
            for supplemental_path, supplemental_content, role, media_type in supplemental_files:
                supplemental_checksum = _sha_bytes(supplemental_content)
                supplemental_id = _id("file", {"edition": edition_id, "path": supplemental_path, "checksum": supplemental_checksum})
                archive_files[supplemental_path] = supplemental_content
                associated_files.append({
                    "file_id": supplemental_id,
                    "archive_path": supplemental_path,
                    "role": role,
                    "media_type": media_type,
                    "size_bytes": len(supplemental_content),
                    "inclusion_state": "included",
                    "checksum": supplemental_checksum,
                    "related_video_ids": [video_id],
                    "related_chapter_ids": [chapter_id],
                    "generated_by": _provenance("Stage 8 source-chain publication adapter", generated_at),
                    "deterministic": True,
                })
                supplemental_ids.append(supplemental_id)
            chapter_file_refs.extend(supplemental_ids)
            records.append({
                "record_id": _id("record", {"chapter": chapter_id, "revision": interpretation_payload["canonical_revision"]}),
                "record_type": "governed_interpretation_construct",
                "video_id": video_id,
                "source_coordinates": {"video_id": video_id, "clock_id": clock_id, "availability_state": "source_chain_embedded"},
                "value": {
                    "file_id": file_id,
                    "archive_path": archive_path,
                    "checksum": checksum,
                    "canonical_revision": interpretation_payload["canonical_revision"],
                    "state_distinctions": interpretation_payload["state_distinctions"],
                    "source_chain_manifest_path": source_chain_path,
                    "review_render_path": review_path,
                    "eligible_claim_count": interpretation_payload["source_chain_manifest"]["summary"]["eligible_claim_count"],
                    "withheld_claim_count": interpretation_payload["source_chain_manifest"]["summary"]["withheld_claim_count"],
                },
                "unit": None,
                "confidence": None,
                "maturity_state": "mixed_governed_states",
                "authority": _authority(),
                "provenance": _provenance("Current canonical interpretation projection", generated_at),
                "reference_ids": [],
            })
        if feature_id == "narrative_agents" and confirmation_register is not None:
            register_path = f"{folder}/Files/All Narrative Agent Confirmations.json"
            register_review_path = f"{folder}/All Narrative Agent Confirmations.md"
            register_content = json.dumps(confirmation_register, indent=2, ensure_ascii=False).encode("utf-8")
            register_review_content = _render_narrative_agent_confirmation_register(
                confirmation_register
            ).encode("utf-8")
            register_file_ids = []
            for publication_path, content, role, media_type in [
                (register_path, register_content, "narrative_agent_confirmation_register", "application/json"),
                (register_review_path, register_review_content, "narrative_agent_confirmation_review", "text/markdown"),
            ]:
                checksum = _sha_bytes(content)
                file_id = _id("file", {"edition": edition_id, "path": publication_path, "checksum": checksum})
                archive_files[publication_path] = content
                associated_files.append({
                    "file_id": file_id,
                    "archive_path": publication_path,
                    "role": role,
                    "media_type": media_type,
                    "size_bytes": len(content),
                    "inclusion_state": "included",
                    "checksum": checksum,
                    "related_video_ids": [video_id],
                    "related_chapter_ids": [chapter_id],
                    "generated_by": _provenance("Complete governed Narrative Agent confirmation register", generated_at),
                    "deterministic": True,
                })
                register_file_ids.append(file_id)
            chapter_file_refs.extend(register_file_ids)
            records.append({
                "record_id": _id("record", {"chapter": chapter_id, "confirmation_register": confirmation_register["content_checksum"]}),
                "record_type": "narrative_agent_confirmation_register",
                "video_id": video_id,
                "source_coordinates": {"video_id": video_id, "clock_id": clock_id, "availability_state": "source_time_resolved"},
                "value": {
                    "archive_path": register_path,
                    "review_render_path": register_review_path,
                    "confirmation_count": confirmation_register["confirmation_count"],
                    "distinct_preserved_label_count": len(confirmation_register["label_counts"]),
                    "content_checksum": confirmation_register["content_checksum"],
                },
                "unit": "confirmations",
                "confidence": 1.0,
                "maturity_state": "analyst_confirmed",
                "authority": _authority(),
                "provenance": _provenance("Canonical decision ledger Narrative Agent assignments", generated_at),
                "reference_ids": [],
            })
        populated = bool(records)
        checks = [_check(f"chapter-{index}-state", "Chapter contains records or a governed empty state.")]
        chapter = {
            "chapter_id": chapter_id, "chapter_order": index, "title": chapter_title,
            "feature_id": feature_id, "panel_id": panel_id, "video_id": video_id,
            "feature_version": "1.0.0", "chapter_schema_id": SCHEMA_ID + "#/$defs/featureChapter",
            "publication_state": "validated", "content_state": "populated" if populated else "empty_confirmed",
            "generated_at": generated_at,
            "source_scope": {"video_id": video_id, "clock_id": clock_id, "scope_type": "full_video"},
            "chapter_summary": {"summary_state": "generated" if populated else "empty_state_summary", "language": "en", "paragraphs": [f"{len(records)} governed artifact{'s' if len(records) != 1 else ''} published for {chapter_title}." if populated else f"No publishable {chapter_title} records are available for this edition."]},
            "content": {"storage_mode": "inline", "record_count": len(records), "records": records},
            "claims": [], "reference_ids": [], "associated_file_refs": chapter_file_refs,
            "completeness": _completeness(checks, checked_at=generated_at),
        }
        if not populated:
            chapter["empty_state"] = {"reason_code": "no_eligible_observations", "statement": f"No publishable {chapter_title} records are available.", "feature_was_run": bool(artifact_keys), "source_was_available": True, "processing_succeeded": True, "excluded_record_count": 0}
        chapter_bytes = json.dumps(chapter, indent=2, ensure_ascii=False).encode("utf-8")
        archive_files[f"{folder}/Chapter.json"] = chapter_bytes
        chapters.append(chapter)
        browse_children.append({"node_id": chapter_id, "label": f"{index:02d} - {chapter_title}", "node_type": "chapter", "state": "ready" if populated else "empty", "target": {"resource_type": "chapter", "resource_id": chapter_id, "archive_path": f"{folder}/Chapter.json"}, "actions": ["open", "inspect", "trace_to_source", "show_provenance", "export_item"]})

    chapter_ids = [item["chapter_id"] for item in chapters]
    validation_checks = [
        _check("PUB-001", "Every operational registry feature has exactly one chapter."),
        _check("PUB-003", "Empty chapters use governed empty states."),
    ]
    if not is_completed:
        validation_checks.append(
            _check(
                "PUB-004",
                "Analysis is not marked completed; Data Book publishes the mature saved artifacts available now.",
                status="warning",
                severity="warning",
            )
        )
    completeness = _completeness(validation_checks, checked_at=generated_at)
    report = {
        "report_id": report_id, "report_type": "video_scientific_report", "edition_id": edition_id,
        "video_id": video_id, "title": f"Scientific Report - {title}", "language": "en",
        "renderer_id": "datascene.scientific.report.v1", "renderer_version": ENGINE_VERSION,
        "eligibility_policy_id": "datascene.claim.eligibility.v1",
        "sections": [{"section_id": _id("report-section", edition_id), "section_order": 1, "title": "Publication scope", "chapter_refs": chapter_ids,
            "sentences": [{"sentence_id": _id("report-sentence", edition_id), "sentence_order": 1, "sentence_type": "methodological", "text": f"This edition publishes {len(chapters)} governed feature chapters for {title}; empirical and interpretive prose is emitted only when eligible claims are available.", "eligibility_status": "non_empirical", "rendering": {"renderer_id": "datascene.scientific.report.v1", "renderer_version": ENGINE_VERSION}}]}],
        "completeness": completeness,
    }
    report_path = "Scientific Report/Scientific Report.json"
    archive_files[report_path] = json.dumps(report, indent=2, ensure_ascii=False).encode("utf-8")
    report_md = f"# Scientific Report - {title}\n\nThis edition publishes {len(chapters)} governed feature chapters. Empirical and interpretive prose is emitted only from eligible governed claims.\n"
    archive_files["Scientific Report/Scientific Report.md"] = report_md.encode("utf-8")
    registry = _registry_snapshot(generated_at)
    data_book = {"data_book_id": data_book_id, "edition_id": edition_id, "video_id": video_id, "title": f"Data Book - {title}", "generated_at": generated_at, "chapter_order": chapter_ids, "chapters": chapters, "reference_index": [], "claim_index": [], "associated_file_refs": [item["file_id"] for item in associated_files], "report_ref": {"report_id": report_id, "archive_path": report_path}, "completeness": completeness}
    archive_files["Data Book/Data Book.json"] = json.dumps(data_book, indent=2, ensure_ascii=False).encode("utf-8")

    integrity_entries = []
    for archive_path, value in sorted(archive_files.items()):
        checksum = _sha_file(value) if isinstance(value, Path) else _sha_bytes(value)
        size = value.stat().st_size if isinstance(value, Path) else len(value)
        integrity_entries.append({"archive_path": archive_path, "media_type": mimetypes.guess_type(archive_path)[0] or "application/octet-stream", "checksum": checksum, "byte_length": size})
    content_identity = _sha_bytes(_canonical(integrity_entries))
    archive_name = f"{title} - Data Book Publication - {edition_id.split(':')[-1][:8]}.zip"
    archive_descriptor = {"archive_id": _id("archive", edition_id), "archive_name": archive_name, "archive_format": "zip", "media_type": "application/zip", "canonical_layout_version": "1.0.0", "root_manifest_path": "Publication Manifest.json", "deterministic": True, "canonical_file_order": "lexicographic_utf8", "canonical_json_profile": "datascene-canonical-json-v1", "content_identity": content_identity, "archive_checksum": None}
    validation = {"validation_id": _id("validation", edition_id), "status": completeness["status"], "executed_at": generated_at, "validator_version": ENGINE_VERSION, "checks": completeness["checks"], "issues": []}
    package = {
        "schema_version": SCHEMA_VERSION, "package_type": "video_publication", "package_id": package_id,
        "edition_id": edition_id, "project_id": project_id, "created_at": generated_at,
        "hermeneutic_context_ticket": status.get("hermeneutic_context_ticket"),
        "created_by": {"actor_type": "service", "actor_id": "datascene.publication.engine"},
        "publication_state": "validated", "registry_snapshot": registry,
        "software_context": {"datascene_version": "VAA1", "publication_engine_version": ENGINE_VERSION, "master_schema_version": "1.0", "canonicalization_profile": "datascene-canonical-json-v1"},
        "browse_manifest": {"panel_id": "download_panel", "default_view": "data_book", "available_views": ["overview", "data_book", "report", "files", "validation", "integrity", "history"], "root_nodes": [{"node_id": data_book_id, "label": f"Data Book - {title}", "node_type": "data_book", "state": "ready", "target": {"resource_type": "data_book", "resource_id": data_book_id, "archive_path": "Data Book/Data Book.json"}, "actions": ["open", "inspect", "export_item", "verify_checksum", "show_history"], "children": browse_children}]},
        "video_package": {"video_identity": {"video_id": video_id, "canonical_media_id": _id("media", source_checksum), "title": title, "source_identity": {"source_type": "uploaded_file", "source_reference": str(status.get("original_filename") or source.name)}, "media_checksum": source_checksum, "duration_ms": max(0, int(float((status.get("source_media_metadata") or {}).get("duration") or 0) * 1000)), "frame_rate": (status.get("source_media_metadata") or {}).get("fps"), "language_codes": [], "metadata": status.get("source_media_metadata") or {}}, "source_clock": {"clock_id": clock_id, "video_id": video_id, "timebase": "milliseconds", "duration_ms": max(0, int(float((status.get("source_media_metadata") or {}).get("duration") or 0) * 1000)), "mapping_version": "1.0.0", "validation_state": "valid_with_warnings", "global_timeline_offset_ms": 0}, "authority_context": {"policy_id": "datascene.authority.precedence.v1", "policy_version": "1.0.0", "precedence_order": ["user_confirmed", "analyst_reviewed", "rule_generated", "model_generated", "system_generated"], "manual_correction_wins": True, "privacy_policy_id": None, "license_policy_id": None}, "archive": archive_descriptor, "data_book": data_book, "report": report, "associated_files": associated_files, "validation": validation, "history": [{"event_id": _id("history", edition_id), "event_type": "generated", "occurred_at": generated_at, "actor": {"actor_type": "service", "actor_id": "datascene.publication.engine"}, "edition_id": edition_id}]},
        "integrity": {"algorithm": "sha256", "canonicalization_profile": "datascene-canonical-json-v1", "content_identity": content_identity, "archive_checksum": None, "entries": integrity_entries, "verified_at": generated_at, "verification_status": "passed"},
    }
    archive_files["Publication Manifest.json"] = json.dumps(package, indent=2, ensure_ascii=False).encode("utf-8")
    output_path = output_dir / archive_name
    _write_deterministic_zip(output_path, archive_files)
    manifest_path = output_dir / f"{output_path.stem} - Browse Manifest.json"
    atomic_write_json(manifest_path, package)
    return {"package": package, "archive_path": str(output_path), "archive_name": archive_name, "archive_checksum": _sha_file(output_path), "manifest_path": str(manifest_path)}


def build_corpus_publication(statuses: Iterable[dict[str, Any]], output_dir: Path, project_id: str) -> dict[str, Any]:
    status_list = list(statuses)
    if any(str(status.get("project_id") or "") != str(project_id) for status in status_list):
        raise ValueError("Corpus publication cannot cross project boundaries")
    analysis_ids = [str(status.get("analysis_id") or "") for status in status_list]
    if any(not value for value in analysis_ids) or len(analysis_ids) != len(set(analysis_ids)):
        raise ValueError("Corpus publication requires unique video identities")
    built = [build_video_publication(status, output_dir / "Video Publications") for status in status_list]
    if not built: raise ValueError("Corpus publication requires completed videos")
    video_refs = []
    archive_files: dict[str, bytes | Path] = {}
    video_ids = []
    for item in built:
        package = item["package"]
        video = package["video_package"]
        identity = video["video_identity"]
        video_id = identity["video_id"]
        video_ids.append(video_id)
        folder = f"Video Publications/{_safe_name(identity['title'])} - {_safe_name(video_id)}"
        nested_archive_path = f"{folder}/{item['archive_name']}"
        archive_files[nested_archive_path] = Path(item["archive_path"])
        archive_files[f"{folder}/Publication Manifest.json"] = json.dumps(package, indent=2, ensure_ascii=False).encode("utf-8")
        archive_files[f"{folder}/Data Book/Data Book.json"] = json.dumps(video["data_book"], indent=2, ensure_ascii=False).encode("utf-8")
        archive_files[f"{folder}/Scientific Report/Scientific Report.json"] = json.dumps(video["report"], indent=2, ensure_ascii=False).encode("utf-8")
        video_refs.append({"video_id": video_id, "video_package_id": package["package_id"], "video_edition_id": package["edition_id"], "data_book_id": video["data_book"]["data_book_id"], "archive_path": nested_archive_path, "manifest_path": f"{folder}/Publication Manifest.json", "data_book_path": f"{folder}/Data Book/Data Book.json", "report_path": f"{folder}/Scientific Report/Scientific Report.json", "source_clock_id": video["source_clock"]["clock_id"], "authority_policy_id": video["authority_context"]["policy_id"], "content_identity": package["integrity"]["content_identity"], "embedded_video_package": video})
    edition_id = _id("corpus-edition", [item["package"]["edition_id"] for item in built])
    package_id = _id("corpus-publication", edition_id)
    generated_at = max(str(item["package"]["created_at"]) for item in built)
    chapter_five_report, chapter_five_markdown, chapter_five_html = _chapter_five_report(
        status_list, built, project_id, generated_at
    )
    archive_files["Chapter 5 Research Report/Chapter 5 Research Report.json"] = json.dumps(
        chapter_five_report, indent=2, ensure_ascii=False
    ).encode("utf-8")
    archive_files["Chapter 5 Research Report/Chapter 5 Research Report.md"] = chapter_five_markdown.encode("utf-8")
    archive_files["Chapter 5 Research Report/Chapter 5 Research Report.html"] = chapter_five_html.encode("utf-8")
    entries = [{"archive_path": path, "media_type": "application/zip", "checksum": _sha_file(value) if isinstance(value, Path) else _sha_bytes(value), "byte_length": value.stat().st_size if isinstance(value, Path) else len(value)} for path, value in sorted(archive_files.items())]
    identity = _sha_bytes(_canonical(entries))
    archive_name = f"{_safe_name(project_id)} - Corpus Data Book Publication - {edition_id.split(':')[-1][:8]}.zip"
    archive_descriptor = {"archive_id": _id("archive", edition_id), "archive_name": archive_name, "archive_format": "zip", "media_type": "application/zip", "canonical_layout_version": "1.0.0", "root_manifest_path": "Corpus Publication Manifest.json", "deterministic": True, "canonical_file_order": "lexicographic_utf8", "canonical_json_profile": "datascene-canonical-json-v1", "content_identity": identity, "archive_checksum": None}
    checks = [_check("PUB-006", "Every selected video is preserved as an independent video publication."), _check("PUB-007", "Included video publications have deterministic checksums.")]
    validation = {"validation_id": _id("validation", edition_id), "status": "complete", "executed_at": generated_at, "validator_version": ENGINE_VERSION, "checks": checks, "issues": []}
    report_node = {"node_id": _id("chapter-five-report", edition_id), "label": "Chapter 5 Research Report", "node_type": "report", "state": "ready", "target": {"resource_type": "report", "archive_path": "Chapter 5 Research Report/Chapter 5 Research Report.html"}, "actions": ["open", "inspect", "print", "export_item", "trace_to_source"]}
    package = {"schema_version": SCHEMA_VERSION, "package_type": "corpus_publication", "package_id": package_id, "edition_id": edition_id, "project_id": project_id, "created_at": generated_at, "hermeneutic_context_tickets": [item["package"].get("hermeneutic_context_ticket") for item in built], "created_by": {"actor_type": "service", "actor_id": "datascene.publication.engine"}, "publication_state": "validated", "registry_snapshot": _registry_snapshot(), "software_context": {"datascene_version": "VAA1", "publication_engine_version": ENGINE_VERSION, "master_schema_version": "1.0", "canonicalization_profile": "datascene-canonical-json-v1"}, "browse_manifest": {"panel_id": "download_panel", "default_view": "overview", "available_views": ["overview", "data_book", "report", "files", "matrices", "validation", "integrity", "history"], "root_nodes": [{"node_id": package_id, "label": f"Corpus Publication - {project_id}", "node_type": "package", "state": "ready", "actions": ["open", "inspect", "export_item", "verify_checksum", "compare", "show_history"], "children": [report_node, *[{"node_id": ref["video_package_id"], "label": next(item["package"]["video_package"]["video_identity"]["title"] for item in built if item["package"]["package_id"] == ref["video_package_id"]), "node_type": "video", "state": "ready", "target": {"resource_type": "video", "resource_id": ref["video_id"], "archive_path": ref["manifest_path"]}, "actions": ["open", "inspect", "trace_to_source", "compare", "show_history"]} for ref in video_refs]]}]}, "corpus_package": {"corpus_identity": {"corpus_id": _id("corpus", video_ids), "title": project_id, "description": "Datascene/VAA1 governed research corpus publication.", "video_ids": video_ids, "selection_definition": {"analysis_ids": video_ids, "selection_method": "explicit completed project analyses"}, "grouping_variables": []}, "archive": archive_descriptor, "video_publications": video_refs, "corpus_report": chapter_five_report, "associated_files": [], "matrix_comparisons": chapter_five_report["comparison_matrix"], "validation": validation, "history": [{"event_id": _id("history", edition_id), "event_type": "generated", "occurred_at": generated_at, "actor": {"actor_type": "service", "actor_id": "datascene.publication.engine"}, "edition_id": edition_id}]}, "integrity": {"algorithm": "sha256", "canonicalization_profile": "datascene-canonical-json-v1", "content_identity": identity, "archive_checksum": None, "entries": entries, "verified_at": generated_at, "verification_status": "passed"}}
    package["registry_snapshot"] = _registry_snapshot(generated_at)
    archive_files["Corpus Publication Manifest.json"] = json.dumps(package, indent=2, ensure_ascii=False).encode("utf-8")
    output_path = output_dir / archive_name
    _write_deterministic_zip(output_path, archive_files)
    report_name = f"{_safe_name(project_id)} - Chapter 5 Research Report.html"
    report_path = output_dir / report_name
    _write_atomic_bytes(report_path, chapter_five_html.encode("utf-8"))
    manifest_path = output_dir / f"{output_path.stem} - Browse Manifest.json"
    atomic_write_json(manifest_path, package)
    return {"package": package, "archive_path": str(output_path), "archive_name": archive_name, "archive_checksum": _sha_file(output_path), "manifest_path": str(manifest_path), "video_count": len(video_ids), "report_path": str(report_path), "report_name": report_name}


def restore_video_publication(
    archive_path: Path, *, expected_project_id: str | None = None
) -> dict[str, Any]:
    """Verify and reopen one video Data Book without trusting its host workspace."""
    archive_path = Path(archive_path)
    if not archive_path.is_file():
        raise ValueError("Publication archive is missing")
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Publication archive contains duplicate paths")
        if any(name.startswith(("/", "\\")) or ".." in Path(name).parts for name in names):
            raise ValueError("Publication archive contains an unsafe path")
        manifest_path = "Publication Manifest.json"
        if manifest_path not in names:
            raise ValueError("Publication manifest is missing")
        package = json.loads(archive.read(manifest_path))
        if package.get("package_type") != "video_publication":
            raise ValueError("Archive is not a video publication")
        project_id = str(package.get("project_id") or "")
        if expected_project_id is not None and project_id != str(expected_project_id):
            raise ValueError("Publication belongs to another project")
        integrity = package.get("integrity") if isinstance(package.get("integrity"), dict) else {}
        entries = integrity.get("entries") if isinstance(integrity.get("entries"), list) else []
        if not entries:
            raise ValueError("Publication integrity manifest is empty")
        for entry in entries:
            name = str(entry.get("archive_path") or "")
            if name not in names:
                raise ValueError(f"Publication entry is missing: {name}")
            content = archive.read(name)
            if _sha_bytes(content) != str(entry.get("checksum") or ""):
                raise ValueError(f"Publication checksum mismatch: {name}")
            if len(content) != int(entry.get("byte_length") or -1):
                raise ValueError(f"Publication byte length mismatch: {name}")
        if _sha_bytes(_canonical(entries)) != str(integrity.get("content_identity") or ""):
            raise ValueError("Publication content identity mismatch")
        data_book_path = "Data Book/Data Book.json"
        report_path = "Scientific Report/Scientific Report.json"
        if data_book_path not in names or report_path not in names:
            raise ValueError("Publication is missing its Data Book or report")
        data_book = json.loads(archive.read(data_book_path))
        report = json.loads(archive.read(report_path))
        video_package = package.get("video_package") if isinstance(package.get("video_package"), dict) else {}
        if data_book.get("edition_id") != package.get("edition_id") or report.get("edition_id") != package.get("edition_id"):
            raise ValueError("Publication edition identity is inconsistent")
        if data_book.get("video_id") != (video_package.get("video_identity") or {}).get("video_id"):
            raise ValueError("Publication video identity is inconsistent")
        interpretation_paths = [name for name in names if name.endswith("/Governed Narrative Agent Interpretation.json")]
        interpretation_constructs = []
        for name in interpretation_paths:
            construct = json.loads(archive.read(name))
            signed = {key: value for key, value in construct.items() if key != "content_checksum"}
            if _sha_bytes(_canonical(signed)) != str(construct.get("content_checksum") or ""):
                raise ValueError("Published interpretation construct checksum mismatch")
            if str(construct.get("project_id") or "") != project_id:
                raise ValueError("Published interpretation construct project mismatch")
            if str(construct.get("analysis_id") or "") != str(data_book.get("video_id") or ""):
                raise ValueError("Published interpretation construct analysis mismatch")
            if (construct.get("state_distinctions") or {}).get("flattened") is not False:
                raise ValueError("Published interpretation states were flattened")
            folder = name.rsplit("/Files/", 1)[0]
            source_chain_path = f"{folder}/Files/Interpretation Source Chain Manifest.json"
            review_path = f"{folder}/Governed Interpretation Review.md"
            if source_chain_path not in names or review_path not in names:
                raise ValueError("Published interpretation source-chain render is incomplete")
            source_chain = json.loads(archive.read(source_chain_path))
            source_chain_signed = {key: value for key, value in source_chain.items() if key != "content_checksum"}
            if _sha_bytes(_canonical(source_chain_signed)) != str(source_chain.get("content_checksum") or ""):
                raise ValueError("Published interpretation source-chain checksum mismatch")
            if source_chain != construct.get("source_chain_manifest"):
                raise ValueError("Published interpretation source-chain projections disagree")
            if not (source_chain.get("summary") or {}).get("withheld_claims_are_not_rendered_as_findings"):
                raise ValueError("Published interpretation withholding policy is missing")
            interpretation_constructs.append(construct)
        return {
            "schema": "vaa1.data_book_isolated_restore_receipt.v1",
            "restore_state": "verified",
            "project_id": project_id,
            "package_id": package.get("package_id"),
            "edition_id": package.get("edition_id"),
            "video_id": data_book.get("video_id"),
            "content_identity": integrity.get("content_identity"),
            "archive_checksum": _sha_file(archive_path),
            "entry_count": len(entries),
            "chapter_count": len(data_book.get("chapters") or []),
            "publication_state": package.get("publication_state"),
            "interpretation_constructs": interpretation_constructs,
            "package": package,
            "data_book": data_book,
            "report": report,
        }


def restore_corpus_publication(
    archive_path: Path, *, expected_project_id: str | None = None
) -> dict[str, Any]:
    """Verify a whole-project publication and each isolated nested video edition."""
    archive_path = Path(archive_path)
    if not archive_path.is_file():
        raise ValueError("Corpus publication archive is missing")
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Corpus publication contains duplicate paths")
        if any(name.startswith(("/", "\\")) or ".." in Path(name).parts for name in names):
            raise ValueError("Corpus publication contains an unsafe path")
        manifest_path = "Corpus Publication Manifest.json"
        if manifest_path not in names:
            raise ValueError("Corpus publication manifest is missing")
        package = json.loads(archive.read(manifest_path))
        if package.get("package_type") != "corpus_publication":
            raise ValueError("Archive is not a corpus publication")
        project_id = str(package.get("project_id") or "")
        if expected_project_id is not None and project_id != str(expected_project_id):
            raise ValueError("Corpus publication belongs to another project")

        integrity = package.get("integrity") if isinstance(package.get("integrity"), dict) else {}
        entries = integrity.get("entries") if isinstance(integrity.get("entries"), list) else []
        if not entries:
            raise ValueError("Corpus publication integrity manifest is empty")
        for entry in entries:
            name = str(entry.get("archive_path") or "")
            if name not in names:
                raise ValueError(f"Corpus publication entry is missing: {name}")
            content = archive.read(name)
            if _sha_bytes(content) != str(entry.get("checksum") or ""):
                raise ValueError(f"Corpus publication checksum mismatch: {name}")
            if len(content) != int(entry.get("byte_length") or -1):
                raise ValueError(f"Corpus publication byte length mismatch: {name}")
        if _sha_bytes(_canonical(entries)) != str(integrity.get("content_identity") or ""):
            raise ValueError("Corpus publication content identity mismatch")

        corpus = package.get("corpus_package") if isinstance(package.get("corpus_package"), dict) else {}
        corpus_identity = corpus.get("corpus_identity") if isinstance(corpus.get("corpus_identity"), dict) else {}
        refs = corpus.get("video_publications") if isinstance(corpus.get("video_publications"), list) else []
        declared_video_ids = [str(value) for value in corpus_identity.get("video_ids") or []]
        ref_video_ids = [str(ref.get("video_id") or "") for ref in refs if isinstance(ref, dict)]
        if not refs or ref_video_ids != declared_video_ids:
            raise ValueError("Corpus video selection and publication references disagree")
        if len(ref_video_ids) != len(set(ref_video_ids)):
            raise ValueError("Corpus publication flattens duplicate video identities")

        restored_videos = []
        edition_ids: set[str] = set()
        clock_ids: set[str] = set()
        with tempfile.TemporaryDirectory(prefix="datascene-corpus-restore-") as temp_dir:
            for index, ref in enumerate(refs):
                if not isinstance(ref, dict):
                    raise ValueError("Corpus video publication reference is invalid")
                for key in ("archive_path", "manifest_path", "data_book_path", "report_path"):
                    if str(ref.get(key) or "") not in names:
                        raise ValueError(f"Corpus video publication path is missing: {key}")
                nested_path = Path(temp_dir) / f"video-{index}.zip"
                nested_path.write_bytes(archive.read(str(ref["archive_path"])))
                receipt = restore_video_publication(nested_path, expected_project_id=project_id)
                if receipt["video_id"] != str(ref.get("video_id") or ""):
                    raise ValueError("Nested video identity disagrees with corpus reference")
                if receipt["package_id"] != ref.get("video_package_id"):
                    raise ValueError("Nested video package identity disagrees with corpus reference")
                if receipt["edition_id"] != ref.get("video_edition_id"):
                    raise ValueError("Nested video edition disagrees with corpus reference")
                if receipt["content_identity"] != ref.get("content_identity"):
                    raise ValueError("Nested video content identity disagrees with corpus reference")
                outer_manifest = json.loads(archive.read(str(ref["manifest_path"])))
                if _canonical(outer_manifest) != _canonical(receipt["package"]):
                    raise ValueError("Nested and browsable video manifests disagree")
                edition_id = str(receipt["edition_id"] or "")
                clock_id = str(ref.get("source_clock_id") or "")
                if not edition_id or edition_id in edition_ids:
                    raise ValueError("Corpus publication flattens video editions")
                if not clock_id or clock_id in clock_ids:
                    raise ValueError("Corpus publication flattens source clocks")
                edition_ids.add(edition_id)
                clock_ids.add(clock_id)
                restored_videos.append(receipt)

        return {
            "schema": "vaa1.corpus_data_book_isolated_restore_receipt.v1",
            "restore_state": "verified",
            "project_id": project_id,
            "package_id": package.get("package_id"),
            "edition_id": package.get("edition_id"),
            "content_identity": integrity.get("content_identity"),
            "archive_checksum": _sha_file(archive_path),
            "entry_count": len(entries),
            "video_count": len(restored_videos),
            "video_ids": ref_video_ids,
            "video_editions_preserved": len(edition_ids),
            "source_clocks_preserved": len(clock_ids),
            "publication_state": package.get("publication_state"),
            "video_restore_receipts": restored_videos,
            "package": package,
        }
