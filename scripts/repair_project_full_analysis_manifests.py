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
