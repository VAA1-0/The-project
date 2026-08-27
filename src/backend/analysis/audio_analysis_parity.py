"""Evidence contract for governed audio analysis consumers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _count(value: Any, key: str) -> int:
    return len(value.get(key) or []) if isinstance(value, dict) and isinstance(value.get(key), list) else 0


def build_audio_analysis_parity(
    audio_prosody: Any,
    audio_event_intervals: Any,
    audio_diarization: Any,
    audio_sample_clouds: Any,
) -> dict[str, Any]:
    specs = {
        "audio_prosody": (audio_prosody, "cues", "panel.audio.prosody_evidence"),
        "audio_event_intervals": (audio_event_intervals, "intervals", "panel.audio.event_intervals"),
        "audio_diarization": (audio_diarization, "speaker_turns", "panel.audio.speaker_diarization"),
        "audio_sample_clouds": (audio_sample_clouds, "clouds", "panel.audio.sample_clouds"),
    }
    payload: dict[str, Any] = {"schema": "vaa1.audio_analysis_parity.v1"}
    for branch, (value, rows_key, route) in specs.items():
        row_count = _count(value, rows_key)
        payload[branch] = {
            "row_count": row_count,
            "rows_key": rows_key,
            "available": row_count > 0,
            "consumer_route": route,
        }
    payload["verified_at"] = datetime.now(timezone.utc).isoformat()
    return payload
