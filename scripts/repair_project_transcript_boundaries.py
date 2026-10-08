#!/usr/bin/env python3
"""Repair persisted transcript pointers that crossed an analysis boundary."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import api_server


def repair(project_id: str) -> list[dict[str, object]]:
    repaired: list[dict[str, object]] = []
    for record_path in sorted(api_server.RESULTS_DIR.glob("*/analysis_record.json")):
        status = json.loads(record_path.read_text(encoding="utf-8"))
        if str(status.get("project_id") or "") != project_id:
            continue
        analysis_id = str(status.get("analysis_id") or record_path.parent.name)
        output_files = status.setdefault("output_files", {})
        own_raw = api_server.TRANSCRIPTS_DIR / f"{analysis_id}_transcript_raw_whisper.json"
        current = str(output_files.get("transcript") or "")
        foreign = bool(current and analysis_id not in current)
        if not foreign:
            continue
        if not own_raw.is_file():
            repaired.append({"analysis_id": analysis_id, "status": "blocked_missing_own_raw"})
            continue

        transcript = json.loads(own_raw.read_text(encoding="utf-8"))
        output_files["transcript"] = str(own_raw)
        output_files["raw_whisper_transcript"] = str(own_raw)
        output_files["operational_transcript"] = str(own_raw)
        status.setdefault("results", {}).setdefault("audio_analysis", {})["transcript"] = transcript
        status["results"]["audio_analysis"]["transcript_path"] = str(own_raw)
        rewritten = api_server.rebuild_transcript_dependents_for_operational_clock(status)
        api_server.write_second_order_meaning_artifacts_for_status(status)
        api_server.write_source_media_metadata_files(status)
        api_server.write_full_analysis_manifest(status, api_server.RESULTS_DIR / analysis_id)
        api_server.append_analysis_event(
            status,
            "cross_analysis_transcript_boundary_repaired",
            details={
                "previous_transcript": current,
                "operational_transcript": str(own_raw),
                "rewritten_artifacts": rewritten,
            },
        )
        api_server.persist_analysis_record_for_status(status)
        repaired.append(
            {
                "analysis_id": analysis_id,
                "status": "repaired",
                "language": transcript.get("language"),
                "rewritten_artifacts": rewritten,
            }
        )
    return repaired


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    args = parser.parse_args()
    print(json.dumps(repair(args.project), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
