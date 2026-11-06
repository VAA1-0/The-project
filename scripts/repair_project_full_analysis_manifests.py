#!/usr/bin/env python3
"""Rebuild project manifests from current artifacts, with a recovery backup."""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.backend.analysis.analysis_recovery import atomic_write_json
from src.backend.analysis.full_analysis_manifest import write_full_analysis_manifest
from src.backend.analysis.audio_analysis_parity import build_audio_analysis_parity
from src.backend.analysis.language_analysis_parity import build_language_analysis_parity
from src.backend.analysis.visual_analysis_parity import build_visual_analysis_parity


def _load_output(record: dict[str, object], key: str) -> object:
    path_value = (record.get("output_files") or {}).get(key) if isinstance(record.get("output_files"), dict) else None
    if not path_value:
        return {}
    try:
        return json.loads(Path(str(path_value)).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _refresh_parity(record: dict[str, object], analysis_dir: Path) -> None:
    transcript = _load_output(record, "transcript")
    linked = _load_output(record, "linked_transcript")
    pos = _load_output(record, "pos_analysis")
    quant = _load_output(record, "quan_analysis")
    objects = _load_output(record, "tracked_objects_json")
    ocr_time_bank = _load_output(record, "time_bank_ocr")
    expressions = _load_output(record, "expression_json")
    shots = _load_output(record, "shot_boundaries")
    spatial = _load_output(record, "spatial_tone_scan")
    adaptive = _load_output(record, "adaptive_visual_scan")
    prosody = _load_output(record, "audio_prosody")
    events = _load_output(record, "audio_event_intervals")
    diarization = _load_output(record, "audio_diarization")
    clouds = _load_output(record, "audio_sample_clouds")
    ocr_rows = (ocr_time_bank.get("objects") or []) if isinstance(ocr_time_bank, dict) else ocr_time_bank

    language = build_language_analysis_parity(transcript if isinstance(transcript, dict) else {}, pos if isinstance(pos, dict) else {}, quant if isinstance(quant, dict) else {}, linked if isinstance(linked, dict) else {})
    visual = build_visual_analysis_parity(objects, ocr_rows, expressions)
    audio = build_audio_analysis_parity(prosody, events, diarization, clouds)
    results = record.setdefault("results", {})
    if not isinstance(results, dict):
        results = record["results"] = {}
    results["audio_analysis"] = {
        "transcript": transcript, "linked_transcript_path": (record.get("output_files") or {}).get("linked_transcript"),
        "pos_analysis": pos, "quan_analysis": quant, "audio_prosody": prosody,
        "audio_event_intervals": events, "audio_diarization": diarization, "audio_sample_clouds": clouds,
    }
    results["visual_analysis"] = {
        "tracked_objects": objects, "ocr_results": ocr_rows, "expression_results": expressions,
        "shot_boundaries": shots, "spatial_tone_scan": spatial, "adaptive_visual_scan": adaptive,
    }
    for name, payload in (("language_analysis_parity", language), ("visual_analysis_parity", visual), ("audio_analysis_parity", audio)):
        path = analysis_dir / f"{name}.json"
        atomic_write_json(path, payload)
        record[name] = payload
        record.setdefault("output_files", {})[name] = str(path)


def repair(root: Path, project_id: str, apply: bool) -> dict[str, object]:
    results_root = root / "outputs" / "api_results"
    selected: list[tuple[Path, dict[str, object]]] = []
    for record_path in sorted(results_root.glob("*/analysis_record.json")):
        record = json.loads(record_path.read_text(encoding="utf-8"))
        if str(record.get("project_id") or "") == project_id:
            selected.append((record_path, record))
    if not apply:
        return {"project_id": project_id, "mode": "dry_run", "analysis_count": len(selected)}

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_root = root / "backups" / "stage0-manifest-repair" / stamp
    repaired: list[str] = []
    for record_path, record in selected:
        analysis_id = str(record.get("analysis_id") or record_path.parent.name)
        backup_dir = backup_root / analysis_id
        backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(record_path, backup_dir / "analysis_record.json")
        manifest_path = record_path.parent / "full_analysis_manifest.json"
        if manifest_path.is_file():
            shutil.copy2(manifest_path, backup_dir / "full_analysis_manifest.json")
        _refresh_parity(record, record_path.parent)
        write_full_analysis_manifest(record, record_path.parent)
        atomic_write_json(record_path, record)
        repaired.append(analysis_id)
    return {
        "project_id": project_id,
        "mode": "applied",
        "analysis_count": len(repaired),
        "analysis_ids": repaired,
        "backup_root": str(backup_root.relative_to(root)),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--apply", action="store_true", help="Write repaired manifests after backing up current records")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = repair(args.root.resolve(), args.project, args.apply)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
