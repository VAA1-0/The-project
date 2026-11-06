"""Bounded, auditable deletion of an analysis and its managed derivatives."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any, Mapping


SCHEMA = "vaa1.analysis_deletion_receipt.v1"
SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,160}$")


def _inside(path: Path, root: Path) -> bool:
    try:
        path.resolve(strict=False).relative_to(root.resolve(strict=False))
        return True
    except ValueError:
        return False


def _slug(value: Any) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "")).strip("-.") or "research-project"


def _delete_preserving(path: Path, protected: list[Path]) -> int:
    resolved = path.resolve(strict=False)
    if any(resolved == item for item in protected):
        return 0
    if path.is_symlink() or path.is_file():
        size = path.stat().st_size
        path.unlink()
        return size
    removed = 0
    for child in path.iterdir():
        removed += _delete_preserving(child, protected)
    try:
        path.rmdir()
    except OSError:
        # The directory legitimately remains when it contains a protected source.
        pass
    return removed


def build_deletion_plan(
    analysis_id: str,
    status: Mapping[str, Any],
    *,
    upload_root: Path,
    results_root: Path,
    imported_root: Path,
    publication_root: Path,
    audio_root: Path,
    transcript_root: Path,
) -> dict[str, Any]:
    if not SAFE_ID.fullmatch(analysis_id):
        raise ValueError("Invalid analysis ID")
    roots = [Path(item).resolve(strict=False) for item in (
        upload_root, results_root, imported_root, publication_root, audio_root, transcript_root
    )]
    candidates: list[tuple[Path, str]] = [
        (Path(results_root) / analysis_id, "analysis_outputs"),
        (Path(imported_root) / analysis_id, "imported_work"),
        (Path(publication_root) / "videos" / analysis_id, "video_publication"),
        (Path(results_root) / f"{analysis_id}_bundle.zip", "analysis_bundle"),
        (Path(results_root) / f"{analysis_id}_expressions.json", "legacy_expression_output"),
    ]
    project_id = str(status.get("project_id") or "")
    if project_id:
        candidates.extend([
            (Path(results_root) / "project_continuity" / project_id, "project_continuity_derivatives"),
            (Path(publication_root) / "corpora" / _slug(project_id), "corpus_publication"),
            (Path(results_root) / f"{_slug(status.get('project_name') or project_id)}_project_bundle.zip", "project_bundle"),
        ])
    retained_sources: list[dict[str, str]] = []
    for key in ("file_path", "source_video_path"):
        raw = status.get(key)
        if raw:
            retained_sources.append({
                "category": f"original_source:{key}",
                "path": str(raw),
                "reason": "source_deletion_requires_separate_navigation_and_authority",
            })
    for key, raw in (status.get("output_files") or {}).items():
        if raw:
            if key == "source_video":
                retained_sources.append({
                    "category": "original_source:output:source_video",
                    "path": str(raw),
                    "reason": "source_deletion_requires_separate_navigation_and_authority",
                })
                continue
            candidates.append((Path(str(raw)), f"output:{key}"))

    managed: dict[str, dict[str, str]] = {}
    retained: list[dict[str, str]] = []
    for candidate, category in candidates:
        resolved = candidate.resolve(strict=False)
        if not any(_inside(resolved, root) for root in roots):
            retained.append({"category": category, "path": str(candidate), "reason": "external_user_owned_or_unmanaged"})
            continue
        managed[str(resolved)] = {"category": category, "path": str(resolved)}

    ordered = sorted(managed.values(), key=lambda item: len(Path(item["path"]).parts))
    targets: list[dict[str, str]] = []
    for item in ordered:
        path = Path(item["path"])
        if any(_inside(path, Path(parent["path"])) for parent in targets):
            continue
        targets.append(item)
    return {
        "schema": "vaa1.analysis_deletion_plan.v1",
        "analysis_id": analysis_id,
        "managed_targets": targets,
        "retained_external": [*retained_sources, *retained],
        "protected_source_paths": sorted({str(Path(item["path"]).resolve(strict=False)) for item in retained_sources}),
        "policy": {
            "delete_analysis_derivatives": True,
            "delete_original_source_media": False,
            "source_deletion_authority": "separate_navigation_required",
            "retain_external_source_media": True,
            "retain_downloaded_exports_outside_datascene": True,
            "retain_decision_receipts": False,
            "backup_retention": "analysis-local backups are deleted with the analysis",
            "diagnostic_retention": "shared rotating application logs are retained and may contain the analysis identifier, but not source or derived content",
        },
    }


def execute_deletion_plan(plan: Mapping[str, Any]) -> dict[str, Any]:
    deleted: list[dict[str, Any]] = []
    missing: list[dict[str, str]] = []
    failures: list[dict[str, str]] = []
    protected = [Path(str(item)).resolve(strict=False) for item in plan.get("protected_source_paths") or []]
    for target in plan.get("managed_targets") or []:
        path = Path(str(target["path"]))
        if not path.exists():
            missing.append(dict(target))
            continue
        try:
            if path.is_dir():
                size = _delete_preserving(path, protected)
            else:
                size = path.stat().st_size
                path.unlink()
            deleted.append({**dict(target), "bytes_removed": size})
        except OSError as exc:
            failures.append({**dict(target), "error": f"{type(exc).__name__}: {exc}"})
    return {
        "schema": SCHEMA,
        "analysis_id": plan["analysis_id"],
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "status": "complete" if not failures else "partial_failure",
        "deleted": deleted,
        "already_missing": missing,
        "retained_external": list(plan.get("retained_external") or []),
        "failures": failures,
        "policy": dict(plan.get("policy") or {}),
    }
