from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol


@dataclass(frozen=True)
class DiarizationRequest:
    analysis_id: str
    audio_path: str | Path
    reference_speakers: Optional[List[Dict[str, Any]]] = None
    realtime: bool = False


class DiarizationAdapter(Protocol):
    provider: str

    def run(self, request: DiarizationRequest) -> Dict[str, Any]:
        ...


class UnavailableDiarizationAdapter:
    def __init__(
        self,
        *,
        provider: str = "pyannote.audio",
        realtime_provider: str = "diart",
        alternative_embeddings: str = "SpeechBrain",
    ) -> None:
        self.provider = provider
        self.realtime_provider = realtime_provider
        self.alternative_embeddings = alternative_embeddings

    def run(self, request: DiarizationRequest) -> Dict[str, Any]:
        return {
            "analysis_id": request.analysis_id,
            "status": "runtime_unavailable",
            "provider": self.realtime_provider if request.realtime else self.provider,
            "audio_path": str(request.audio_path),
            "reference_speaker_count": len(request.reference_speakers or []),
            "speaker_turns": [],
            "embedding_index": {
                "status": "runtime_unavailable",
                "provider": self.provider,
                "alternative_provider": self.alternative_embeddings,
                "items": [],
            },
            "notes": [
                "Adapter boundary is ready; install runtime dependencies before executing diarization.",
                "diart should use the same request and speaker-turn response shape for streaming mode.",
            ],
        }


def get_default_diarization_adapter() -> DiarizationAdapter:
    return UnavailableDiarizationAdapter()
