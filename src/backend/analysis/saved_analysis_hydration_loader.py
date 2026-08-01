from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, Optional


CANONICAL_ARTIFACTS = {
    "annotation_corrections": ("annotation_corrections.json", "annotation_corrections"),
    "vaa1_annotation_master_schema": (
        "vaa1_annotation_master_schema.json",
        "vaa1_annotation_master_schema",
    ),
    "agent_persistence_scene_cut": (
        "agent_persistence_scene_cut.json",
        "agent_persistence_scene_cut",
    ),
    "second_order_label_proliferation": (
        "second_order_label_proliferation.json",
        "second_order_label_proliferation",
    ),
    "narrative_lens_reading": ("narrative_lens_reading.json", "narrative_lens_reading"),
    "character_path_reading": ("character_path_reading.json", "character_path_reading"),
    "datascene_meaning_network": (
        "datascene_meaning_network.json",
        "datascene_meaning_network",
    ),
    "mise_en_scene_scene_cards": (
        "mise_en_scene_scene_cards.json",
        "mise_en_scene_scene_cards",
    ),
    "source_extraction_metadata_summary": (
        "source_extraction_metadata_summary.json",
        "source_extraction_metadata_summary",
    ),
    "identity_triangulation": (
        "identity_triangulation_bundle.json",
        "identity_triangulation",
    ),
    "source_media_metadata_json": ("source_media_metadata.json", "source_media_metadata"),
    "pos_matrix": ("pos_matrix.json", "pos_matrix"),
    "quant_matrix": ("quant_matrix.json", "quant_matrix"),
    "tracked_objects_json": ("tracked_objects.json", "tracked_objects"),
}

VISUAL_RESULT_ARTIFACTS = {
    "shot_boundaries": "shot_boundaries.json",
    "spatial_tone_scan": "spatial_tone_scan.json",
    "adaptive_visual_scan": "adaptive_visual_scan.json",
}


def read_json_file(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def path_from_status(status: Dict[str, Any], file_key: str) -> Optional[Path]:
    for collection_key in ("output_files", "internal_artifacts"):
        collection = status.get(collection_key)
        if not isinstance(collection, dict):
            continue
        raw = collection.get(file_key)
        if raw:
            path = Path(str(raw))
            if path.exists():
                return path
    return None


def artifact_candidates(analysis_dir: Path, status: Dict[str, Any], file_key: str, filename: str) -> Iterable[Path]:
    registered = path_from_status(status, file_key)
    if registered:
        yield registered
    direct = analysis_dir / filename
    if direct.exists():
        yield direct
    for match in sorted(analysis_dir.glob(filename)):
        if match.exists():
            yield match


def load_first_json(candidates: Iterable[Path]) -> tuple[Any, Optional[Path]]:
    for path in candidates:
        payload = read_json_file(path)
        if payload is not None:
            return payload, path
    return None, None


def hydrate_artifact(
    status: Dict[str, Any],
    *,
    analysis_dir: Path,
    file_key: str,
    filename: str,
    status_key: str,
    audit: Dict[str, Any],
) -> None:
    payload, path = load_first_json(artifact_candidates(analysis_dir, status, file_key, filename))
    if payload is None or path is None:
        return

    status.setdefault("output_files", {}).setdefault(file_key, str(path))
    if status.get(status_key) in (None, "", []):
        status[status_key] = payload
        audit["hydrated"].append(status_key)
    else:
        audit["already_present"].append(status_key)


def hydrate_evidence_proliferation_matches(
    status: Dict[str, Any],
    *,
    analysis_dir: Path,
    audit: Dict[str, Any],
) -> None:
    existing = status.get("evidence_proliferation_matches")
    existing_records = existing if isinstance(existing, list) else []
    by_request_id = {
        str(item.get("request_id")): dict(item)
        for item in existing_records
        if isinstance(item, dict) and item.get("request_id")
    }

    for path in sorted(analysis_dir.glob("evidence_proliferation_match_*.json")):
        payload = read_json_file(path)
        if not isinstance(payload, dict):
            continue
        request_id = str(payload.get("request_id") or path.stem.replace("evidence_proliferation_match_", ""))
        by_request_id[request_id] = {
            "request_id": request_id,
            "status": payload.get("status", "completed"),
            "candidate_count": int(payload.get("candidate_count") or len(payload.get("candidates") or [])),
            "output_json_path": str(path),
            "updated_at": payload.get("created_at") or payload.get("updated_at"),
        }
        status.setdefault("internal_artifacts", {})[
            f"evidence_proliferation_match:{request_id}"
        ] = str(path)

    records = sorted(
        by_request_id.values(),
        key=lambda item: str(item.get("updated_at") or ""),
        reverse=True,
    )
    if records and records != existing_records:
        status["evidence_proliferation_matches"] = records[:25]
        audit["hydrated"].append("evidence_proliferation_matches")


def hydrate_source_samples(
    status: Dict[str, Any],
    *,
    analysis_dir: Path,
    audit: Dict[str, Any],
) -> None:
    samples_path = analysis_dir / "source_samples" / "samples.json"
    payload = read_json_file(samples_path) if samples_path.exists() else None
    if not isinstance(payload, list):
        return
    status.setdefault("internal_artifacts", {})["source_samples"] = str(samples_path)
    if status.get("source_samples") != payload:
        status["source_samples"] = payload
        audit["hydrated"].append("source_samples")


def hydrate_visual_results(
    status: Dict[str, Any],
    *,
    analysis_dir: Path,
    audit: Dict[str, Any],
) -> None:
    tracked = status.get("tracked_objects")
    results = status.setdefault("results", {})
    if not isinstance(results, dict):
        status["results"] = {}
        results = status["results"]
    visual = results.setdefault("visual_analysis", {})
    if not isinstance(visual, dict):
        results["visual_analysis"] = {}
        visual = results["visual_analysis"]
    if isinstance(tracked, list) and not visual.get("tracked_objects"):
        visual["tracked_objects"] = tracked
        audit["hydrated"].append("results.visual_analysis.tracked_objects")
    for result_key, filename in VISUAL_RESULT_ARTIFACTS.items():
        payload, path = load_first_json(
            artifact_candidates(analysis_dir, status, result_key, filename)
        )
        if not isinstance(payload, dict) or path is None:
            continue
        status.setdefault("output_files", {}).setdefault(result_key, str(path))
        audit_key = f"results.visual_analysis.{result_key}"
        if not visual.get(result_key):
            visual[result_key] = payload
            audit["hydrated"].append(audit_key)
        else:
            audit["already_present"].append(audit_key)


def build_hydration_audit(status: Dict[str, Any], hydrated_before: list[str]) -> Dict[str, Any]:
    return {
        "schema": "vaa1.saved_analysis_hydration_audit.v1",
        "analysis_id": status.get("analysis_id"),
        "hydrated": hydrated_before,
        "already_present": [],
        "required_artifacts": sorted(CANONICAL_ARTIFACTS.keys()),
        "complete": True,
    }


def hydrate_saved_analysis_status(
    status: Dict[str, Any],
    *,
    results_dir: str | Path = "outputs/api_results",
) -> Dict[str, Any]:
    analysis_id = str(status.get("analysis_id") or "").strip()
    audit = build_hydration_audit(status, [])
    if not analysis_id:
        audit["complete"] = False
        audit["error"] = "missing_analysis_id"
        status["saved_analysis_hydration_audit"] = audit
        return status

    analysis_dir = Path(results_dir) / analysis_id
    audit["analysis_dir"] = str(analysis_dir)
    for file_key, (filename, status_key) in CANONICAL_ARTIFACTS.items():
        hydrate_artifact(
            status,
            analysis_dir=analysis_dir,
            file_key=file_key,
            filename=filename,
            status_key=status_key,
            audit=audit,
        )

    hydrate_source_samples(status, analysis_dir=analysis_dir, audit=audit)
    hydrate_evidence_proliferation_matches(status, analysis_dir=analysis_dir, audit=audit)
    hydrate_visual_results(status, analysis_dir=analysis_dir, audit=audit)
    status["saved_analysis_hydration_audit"] = audit
    return status
