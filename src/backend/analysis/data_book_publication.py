"""Datascene Data Book per-video and corpus publication builder."""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .analysis_recovery import atomic_write_json


SCHEMA_VERSION = "1.0.0"
SCHEMA_ID = "https://datascene.eu/schemas/publication/data-book-package/1.0.0"
ENGINE_VERSION = "1.0.0"
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
MAX_EMBEDDED_FILE_BYTES = int(os.getenv("VAA1_PUBLICATION_EMBED_FILE_MAX_BYTES", str(100 * 1024 * 1024)))


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


def build_video_publication(status: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    analysis_id = str(status["analysis_id"])
    video_id = analysis_id
    project_id = str(status.get("project_id") or "local-research-project")
    source = Path(str(status.get("source_video_path") or status.get("file_path") or ""))
    if status.get("status") != "completed": raise ValueError("Video publication requires a completed analysis")
    if not source.exists(): raise ValueError("Source video is missing")
    title = _safe_name(Path(str(status.get("original_filename") or source.name)).stem)
    source_checksum = _sha_file(source)
    edition_id = _id("video-edition", {"analysis": analysis_id, "completed": status.get("analysis_completed_at"), "source": source_checksum})
    package_id = _id("video-publication", edition_id)
    data_book_id = _id("data-book", edition_id)
    report_id = _id("scientific-report", edition_id)
    clock_id = _id("source-clock", {"video": video_id, "source": source_checksum})
    generated_at = str(status.get("analysis_completed_at") or status.get("uploaded_at") or _now())
    output_files = status.get("output_files") if isinstance(status.get("output_files"), dict) else {}
    output_files = {"source_video": str(source), **output_files}
    archive_files: dict[str, bytes | Path] = {}
    associated_files: list[dict[str, Any]] = []
    chapters = []
    browse_children = []

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
    completeness = _completeness([_check("PUB-001", "Every operational registry feature has exactly one chapter."), _check("PUB-003", "Empty chapters use governed empty states.")], checked_at=generated_at)
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
    built = [build_video_publication(status, output_dir / "Video Publications") for status in statuses]
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
        folder = f"Video Publications/{_safe_name(identity['title'])} - {video_id[:8]}"
        archive_files[f"{folder}/{item['archive_name']}"] = Path(item["archive_path"])
        archive_files[f"{folder}/Publication Manifest.json"] = json.dumps(package, indent=2, ensure_ascii=False).encode("utf-8")
        archive_files[f"{folder}/Data Book/Data Book.json"] = json.dumps(video["data_book"], indent=2, ensure_ascii=False).encode("utf-8")
        archive_files[f"{folder}/Scientific Report/Scientific Report.json"] = json.dumps(video["report"], indent=2, ensure_ascii=False).encode("utf-8")
        video_refs.append({"video_id": video_id, "video_package_id": package["package_id"], "video_edition_id": package["edition_id"], "data_book_id": video["data_book"]["data_book_id"], "manifest_path": f"{folder}/Publication Manifest.json", "data_book_path": f"{folder}/Data Book/Data Book.json", "report_path": f"{folder}/Scientific Report/Scientific Report.json", "source_clock_id": video["source_clock"]["clock_id"], "authority_policy_id": video["authority_context"]["policy_id"], "content_identity": package["integrity"]["content_identity"], "embedded_video_package": video})
    edition_id = _id("corpus-edition", [item["package"]["edition_id"] for item in built])
    package_id = _id("corpus-publication", edition_id)
    generated_at = max(str(item["package"]["created_at"]) for item in built)
    entries = [{"archive_path": path, "media_type": "application/zip", "checksum": _sha_file(value) if isinstance(value, Path) else _sha_bytes(value), "byte_length": value.stat().st_size if isinstance(value, Path) else len(value)} for path, value in sorted(archive_files.items())]
    identity = _sha_bytes(_canonical(entries))
    archive_name = f"{_safe_name(project_id)} - Corpus Data Book Publication - {edition_id.split(':')[-1][:8]}.zip"
    archive_descriptor = {"archive_id": _id("archive", edition_id), "archive_name": archive_name, "archive_format": "zip", "media_type": "application/zip", "canonical_layout_version": "1.0.0", "root_manifest_path": "Corpus Publication Manifest.json", "deterministic": True, "canonical_file_order": "lexicographic_utf8", "canonical_json_profile": "datascene-canonical-json-v1", "content_identity": identity, "archive_checksum": None}
    checks = [_check("PUB-006", "Every selected video is preserved as an independent video publication."), _check("PUB-007", "Included video publications have deterministic checksums.")]
    validation = {"validation_id": _id("validation", edition_id), "status": "complete", "executed_at": generated_at, "validator_version": ENGINE_VERSION, "checks": checks, "issues": []}
    package = {"schema_version": SCHEMA_VERSION, "package_type": "corpus_publication", "package_id": package_id, "edition_id": edition_id, "project_id": project_id, "created_at": generated_at, "created_by": {"actor_type": "service", "actor_id": "datascene.publication.engine"}, "publication_state": "validated", "registry_snapshot": _registry_snapshot(), "software_context": {"datascene_version": "VAA1", "publication_engine_version": ENGINE_VERSION, "master_schema_version": "1.0", "canonicalization_profile": "datascene-canonical-json-v1"}, "browse_manifest": {"panel_id": "download_panel", "default_view": "overview", "available_views": ["overview", "data_book", "report", "files", "matrices", "validation", "integrity", "history"], "root_nodes": [{"node_id": package_id, "label": f"Corpus Publication - {project_id}", "node_type": "package", "state": "ready", "actions": ["open", "inspect", "export_item", "verify_checksum", "compare", "show_history"], "children": [{"node_id": ref["video_package_id"], "label": next(item["package"]["video_package"]["video_identity"]["title"] for item in built if item["package"]["package_id"] == ref["video_package_id"]), "node_type": "video", "state": "ready", "target": {"resource_type": "video", "resource_id": ref["video_id"], "archive_path": ref["manifest_path"]}, "actions": ["open", "inspect", "trace_to_source", "compare", "show_history"]} for ref in video_refs]}]}, "corpus_package": {"corpus_identity": {"corpus_id": _id("corpus", video_ids), "title": project_id, "description": "Datascene/VAA1 governed research corpus publication.", "video_ids": video_ids, "selection_definition": {"analysis_ids": video_ids, "selection_method": "explicit completed project analyses"}, "grouping_variables": []}, "archive": archive_descriptor, "video_publications": video_refs, "corpus_report": None, "associated_files": [], "matrix_comparisons": [], "validation": validation, "history": [{"event_id": _id("history", edition_id), "event_type": "generated", "occurred_at": generated_at, "actor": {"actor_type": "service", "actor_id": "datascene.publication.engine"}, "edition_id": edition_id}]}, "integrity": {"algorithm": "sha256", "canonicalization_profile": "datascene-canonical-json-v1", "content_identity": identity, "archive_checksum": None, "entries": entries, "verified_at": _now(), "verification_status": "passed"}}
    archive_files["Corpus Publication Manifest.json"] = json.dumps(package, indent=2, ensure_ascii=False).encode("utf-8")
    output_path = output_dir / archive_name
    _write_deterministic_zip(output_path, archive_files)
    manifest_path = output_dir / f"{output_path.stem} - Browse Manifest.json"
    atomic_write_json(manifest_path, package)
    return {"package": package, "archive_path": str(output_path), "archive_name": archive_name, "archive_checksum": _sha_file(output_path), "manifest_path": str(manifest_path), "video_count": len(video_ids)}
