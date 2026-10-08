#!/usr/bin/env python3
"""Refresh timeline-distributed language and morphology profiles for a project."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import api_server
from src.backend.analysis.language_pack_policy import associate_detected_language_morphologies
from src.backend.analysis.language_utils import build_language_profile


def refresh(project_id: str) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for record_path in sorted(api_server.RESULTS_DIR.glob("*/analysis_record.json")):
        status = json.loads(record_path.read_text(encoding="utf-8"))
        if str(status.get("project_id") or "") != project_id:
            continue
        analysis_id = str(status.get("analysis_id") or record_path.parent.name)
        transcript_path = Path(str((status.get("output_files") or {}).get("transcript") or ""))
        if not transcript_path.is_file():
            results.append({"analysis_id": analysis_id, "status": "missing_transcript"})
            continue
        transcript = json.loads(transcript_path.read_text(encoding="utf-8"))
        segments = transcript.get("segments") or []
        text = " ".join(str(item.get("text") or "") for item in segments if isinstance(item, dict))
        previous_language = str(transcript.get("language") or "unknown")
        profile = build_language_profile(previous_language, text, segments=segments)
        transcript["language"] = profile["code"]
        transcript["language_name"] = profile["name"]
        transcript["language_info"] = profile
        api_server.atomic_write_json(transcript_path, transcript)
        status.setdefault("results", {}).setdefault("audio_analysis", {})["transcript"] = transcript
        status["language_pack_policy"] = associate_detected_language_morphologies(
            status.get("language_pack_policy") or {},
            profile,
        )
        api_server.append_analysis_event(
            status,
            "timeline_language_profile_refreshed",
            details={
                "previous_language": previous_language,
                "selected_language": profile["code"],
                "sampling_method": (profile.get("timeline_distribution") or {}).get("method"),
                "associated_morphologies": status["language_pack_policy"].get("associated_morphologies", []),
            },
        )
        api_server.persist_analysis_record_for_status(status)
        results.append(
            {
                "analysis_id": analysis_id,
                "filename": status.get("original_filename"),
                "previous_language": previous_language,
                "selected_language": profile["code"],
                "associated_morphologies": status["language_pack_policy"].get("associated_morphologies", []),
            }
        )
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    args = parser.parse_args()
    print(json.dumps(refresh(args.project), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
