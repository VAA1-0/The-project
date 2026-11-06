#!/usr/bin/env python3
"""Write a governed speaker-suggestion evaluation receipt."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.backend.analysis.analysis_recovery import atomic_write_json
from src.backend.analysis.speaker_suggestion_evaluation import (
    confirmed_speaker_seeds,
    evaluate_speaker_suggestions,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corrections", required=True, type=Path)
    parser.add_argument("--diarization", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    corrections = json.loads(args.corrections.read_text(encoding="utf-8"))
    diarization = json.loads(args.diarization.read_text(encoding="utf-8"))
    receipt = evaluate_speaker_suggestions(confirmed_speaker_seeds(corrections, diarization))
    receipt["analysis_id"] = str(corrections.get("analysis_id") or diarization.get("analysis_id") or "")
    receipt["source_records"] = {
        "corrections": str(args.corrections),
        "diarization": str(args.diarization),
    }
    atomic_write_json(args.output, receipt)
    print(json.dumps({"output": str(args.output), "population": receipt["population"], "top_1": receipt["top_1"], "abstention_curve": receipt["abstention_curve"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
