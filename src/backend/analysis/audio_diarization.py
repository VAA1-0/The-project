import json
import importlib.util
import sys
from pathlib import Path
from typing import Any, Dict, Optional

try:
    from src.backend.analysis.diarization_adapter import (
        DiarizationRequest,
        get_default_diarization_adapter,
    )
except ModuleNotFoundError:
    adapter_path = Path(__file__).with_name("diarization_adapter.py")
    spec = importlib.util.spec_from_file_location("diarization_adapter", adapter_path)
    diarization_adapter = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules["diarization_adapter"] = diarization_adapter
    spec.loader.exec_module(diarization_adapter)
    DiarizationRequest = diarization_adapter.DiarizationRequest
    get_default_diarization_adapter = diarization_adapter.get_default_diarization_adapter


DIARIZATION_STACK_PLAN = {
    "vad": {
        "enabled": True,
        "provider": "pyannote.audio",
        "runtime_status": "planned_dependency",
    },
    "diarization": {
        "provider": "pyannote.audio",
        "runtime_status": "planned_dependency",
    },
    "speaker_embeddings": {
        "primary_provider": "pyannote.audio",
        "alternative_provider": "SpeechBrain",
        "runtime_status": "planned_dependency",
    },
    "reference_upload": {
        "provider": "custom",
        "runtime_status": "contract_ready",
    },
    "real_time": {
        "provider": "diart",
        "runtime_status": "planned_optional_dependency",
    },
}


def build_audio_diarization_scaffold(
    analysis_id: str,
    *,
    audio_path: str | Path,
    transcript: Optional[Dict[str, Any]] = None,
    audio_prosody: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    segments = (transcript or {}).get("segments", [])
    adapter_probe = get_default_diarization_adapter().run(
        DiarizationRequest(
            analysis_id=analysis_id,
            audio_path=audio_path,
            reference_speakers=[],
        )
    )
    turns = []
    for index, segment in enumerate(segments):
        if not isinstance(segment, dict):
            continue
        turns.append(
            {
                "turn_id": f"turn_{index:04d}",
                "speaker_label": segment.get("speaker") or "SPEAKER_UNKNOWN",
                "start": segment.get("start"),
                "end": segment.get("end"),
                "text": segment.get("text"),
                "diarization_status": "pending",
                "embedding_ref": None,
                "reference_match": None,
            }
        )

    return {
        "analysis_id": analysis_id,
        "status": "scaffold_ready",
        "audio_path": str(audio_path),
        "stack_plan": DIARIZATION_STACK_PLAN,
        "adapter_probe": {
            "status": adapter_probe.get("status"),
            "provider": adapter_probe.get("provider"),
            "reference_speaker_count": adapter_probe.get("reference_speaker_count"),
        },
        "turn_count": len(turns),
        "speaker_turns": turns,
        "reference_speakers": [],
        "embedding_index": {
            "status": "pending",
            "provider": "pyannote.audio",
            "alternative_provider": "SpeechBrain",
            "items": [],
        },
        "vad_segments": [],
        "prosody_cue_count": len((audio_prosody or {}).get("cues", [])),
        "notes": [
            "This artifact is a contract scaffold. Runtime diarization dependencies are not imported here.",
            "diart is reserved for later real-time streaming diarization over the same speaker-turn contract.",
        ],
    }


def write_audio_diarization_scaffold(
    analysis_id: str,
    *,
    audio_path: str | Path,
    output_json_path: str | Path,
    transcript: Optional[Dict[str, Any]] = None,
    audio_prosody: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload = build_audio_diarization_scaffold(
        analysis_id,
        audio_path=audio_path,
        transcript=transcript,
        audio_prosody=audio_prosody,
    )
    path = Path(output_json_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload
