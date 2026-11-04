"""Append-only object-detector runs and their active consumer projection."""

from __future__ import annotations

from copy import deepcopy
import csv
from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Mapping
from pathlib import Path


SCHEMA = "datascene.object_detection_run_registry.v1"


def _rows(value: Any) -> list[dict[str, Any]]:
    return [deepcopy(dict(row)) for row in value or [] if isinstance(row, Mapping)]


def _provider(receipt: Mapping[str, Any], detections: list[dict[str, Any]]) -> str:
    return str(
        receipt.get("provider")
        or next((row.get("detector_provider") for row in detections if row.get("detector_provider")), None)
        or "legacy_unknown_detector"
    )


def _run_id(provider: str, created_at: str, detections: list[dict[str, Any]]) -> str:
    payload = json.dumps(
        {
            "provider": provider,
            "created_at": created_at,
            "detections": detections,
        },
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return "object-run:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _run_from_visual(visual: Mapping[str, Any], *, legacy: bool = False) -> dict[str, Any] | None:
    detections = _rows(visual.get("yolo_results"))
    tracks = _rows(visual.get("tracked_objects"))
    if not detections and not tracks:
        return None
    receipt = dict(visual.get("object_detector") or {})
    provider = _provider(receipt, detections)
    created_at = str(
        receipt.get("completed_at")
        or visual.get("generated_at")
        or ("legacy_import" if legacy else datetime.now(timezone.utc).isoformat())
    )
    run_id = str(receipt.get("run_id") or _run_id(provider, created_at, detections))
    for row in detections:
        row.setdefault("detector_provider", provider)
        row["detector_run_id"] = run_id
    for row in tracks:
        row.setdefault("detector_provider", provider)
        row["detector_run_id"] = run_id
        row["detector_track_uid"] = f"{run_id}:{row.get('track_id', 'track')}"
    return {
        "schema": "datascene.object_detection_run.v1",
        "run_id": run_id,
        "created_at": created_at,
        "provider": provider,
        "provider_receipt": receipt,
        "legacy_import": legacy,
        "detections": detections,
        "tracked_objects": tracks,
        "artifacts": {
            key: visual.get(key)
            for key in ("yolo_csv", "tracked_objects_csv", "tracked_objects_json", "summary_json")
            if visual.get(key)
        },
    }


def _detection_key(row: Mapping[str, Any]) -> tuple[Any, ...]:
    return (
        row.get("detector_provider"),
        round(float(row.get("timestamp") or 0.0), 3),
        row.get("class_name"),
        *(round(float(row.get(key) or 0.0), 1) for key in ("bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2")),
    )


def append_object_detection_run(
    previous_visual: Mapping[str, Any] | None,
    current_visual: Mapping[str, Any],
) -> dict[str, Any]:
    previous = dict(previous_visual or {})
    runs = _rows(previous.get("object_detection_runs"))
    if not runs:
        legacy_run = _run_from_visual(previous, legacy=True)
        if legacy_run:
            runs.append(legacy_run)
    current_run = _run_from_visual(current_visual)
    if current_run and all(run.get("run_id") != current_run["run_id"] for run in runs):
        runs.append(current_run)

    detections_by_key: dict[tuple[Any, ...], dict[str, Any]] = {}
    projected_tracks: list[dict[str, Any]] = []
    for run in runs:
        for row in _rows(run.get("detections")):
            key = _detection_key(row)
            if key in detections_by_key:
                prior_ids = detections_by_key[key].setdefault("detector_run_ids", [])
                prior_ids.extend(identifier for identifier in [row.get("detector_run_id")] if identifier and identifier not in prior_ids)
            else:
                row["detector_run_ids"] = [row.get("detector_run_id")] if row.get("detector_run_id") else []
                detections_by_key[key] = row
        projected_tracks.extend(_rows(run.get("tracked_objects")))

    return {
        "schema": SCHEMA,
        "object_detection_runs": runs,
        "yolo_results": list(detections_by_key.values()),
        "tracked_objects": projected_tracks,
        "active_provider_count": len({run.get("provider") for run in runs}),
        "run_count": len(runs),
        "projection_policy": "append_only_runs_union; mature_master_schema_decisions_are_not_reopened",
    }


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = sorted({key for row in rows for key in row.keys()})
    with path.open("w", newline="", encoding="utf-8") as handle:
        if not fieldnames:
            handle.write("")
            return
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({
                key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value
                for key, value in row.items()
            })


def write_object_detection_projection(
    output_dir: Path,
    registry: Mapping[str, Any],
) -> dict[str, str]:
    """Materialize the governed union consumed by existing CSV-based panels."""
    raw_csv = output_dir / "object_detection_active_projection.csv"
    tracked_csv = output_dir / "object_detection_active_tracks.csv"
    registry_json = output_dir / "object_detection_run_registry.json"
    tracked_json = output_dir / "object_detection_active_tracks.json"
    detections = _rows(registry.get("yolo_results"))
    tracks = _rows(registry.get("tracked_objects"))
    _write_csv(raw_csv, detections)
    _write_csv(tracked_csv, tracks)
    registry_json.write_text(json.dumps(dict(registry), indent=2, ensure_ascii=False), encoding="utf-8")
    tracked_json.write_text(json.dumps(tracks, indent=2, ensure_ascii=False), encoding="utf-8")
    return {
        "yolo_csv": str(raw_csv),
        "tracked_objects_csv": str(tracked_csv),
        "tracked_objects_json": str(tracked_json),
        "object_detection_run_registry": str(registry_json),
    }
