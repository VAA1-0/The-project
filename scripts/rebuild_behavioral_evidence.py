#!/usr/bin/env python3
"""Rebuild measured lip synchrony and conservative movement evidence."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.backend.analysis.active_speaker_synchrony import build_active_speaker_synchrony_artifact
from src.backend.analysis.analysis_recovery import atomic_write_json
from src.backend.analysis.body_movement_detection import build_body_movement_detections


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--analysis-dir", required=True, type=Path)
    args = parser.parse_args()
    analysis_dir = args.analysis_dir.resolve()
    record_path = analysis_dir / "analysis_record.json"
    record = json.loads(record_path.read_text(encoding="utf-8"))
    lip = build_active_speaker_synchrony_artifact(record)
    movement = build_body_movement_detections(record)
    revision = record.get("annotations_revision") or record.get("annotation_corrections_revision") or 0
    movement["annotation_revision"] = revision
    lip_path = analysis_dir / "active_speaker_synchrony.json"
    movement_path = analysis_dir / "body_movement_detections.json"
    atomic_write_json(lip_path, lip)
    atomic_write_json(movement_path, movement)
    record["active_speaker_synchrony"] = lip
    record["body_movement_detections"] = movement
    record.setdefault("results", {}).setdefault("visual_analysis", {})["body_movement_detections"] = movement
    record.setdefault("output_files", {})["active_speaker_synchrony"] = str(lip_path)
    record["output_files"]["body_movement_detections"] = str(movement_path)
    atomic_write_json(record_path, record)
    print(json.dumps({
        "analysis_id": record.get("analysis_id"),
        "lip_sync": {"attempted": lip["measurement_count"], "measured": lip["measured_count"]},
        "movement": {"measured": movement["measurement_count"]},
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
