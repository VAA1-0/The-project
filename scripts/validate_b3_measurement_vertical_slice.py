#!/usr/bin/env python3
"""Validate B3 without modifying a saved user analysis."""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.backend.analysis.reproducible_measurement import ReproducibleMeasurementService


with tempfile.TemporaryDirectory(prefix="vaa1-b3-") as temporary:
    root = Path(temporary) / "outputs"
    analysis_id = "validation-analysis"
    analysis = root / "api_results" / analysis_id
    sources = root / "transcripts"
    sources.mkdir(parents=True)
    analysis.mkdir(parents=True)
    (sources / f"{analysis_id}_transcript.json").write_text(json.dumps({"timing_authority": "canonical", "segments": [{"start": 0, "end": 1, "text": "one measured utterance"}]}))
    (sources / f"{analysis_id}_audio_diarization.json").write_text(json.dumps({"measurement": {"duration_seconds": 4}, "speaker_turns": [{"speaker_label": "SPEAKER_00", "start": 0, "end": 1}], "vad_segments": [{"start": 0, "end": 1.5}]}))
    (analysis / "source_media_metadata.json").write_text(json.dumps({"duration_seconds": 4}))
    (analysis / "vaa1_annotation_master_schema.json").write_text(json.dumps({"temporal_segments": [{"segment_type": "scene", "start": 0, "end": 4}]}))
    service = ReproducibleMeasurementService(analysis_id, analysis, root)
    first, second = service.run(), service.run()
    assert first["measurement_run"]["content_fingerprint"] == second["measurement_run"]["content_fingerprint"]
    assert first["measurement_run"]["measurements"]["voice_activity"]["speech_ratio"] == .375
    assert first["native_findings"]
print("B3 reproducible measurement vertical slice: passed")
