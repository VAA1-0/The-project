from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


AUDIO_SAMPLE_AUTHORITY_ORDER = [
    "manual_confirmed_sample",
    "manual_candidate_sample",
    "diarization_speaker_turn",
    "transcript_segment",
    "raw_audio",
]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _safe_confidence(value: Any, fallback: float = 0.55) -> float:
    return min(1.0, max(0.0, _safe_float(value, fallback)))


def _clean_label(value: Any, fallback: str) -> str:
    text = str(value or "").strip()
    return text or fallback


def _build_sample_id(analysis_id: str, entity_label: str, index: int) -> str:
    normalized_entity = "".join(
        char.lower() if char.isalnum() else "_" for char in entity_label.strip()
    ).strip("_")
    return f"{analysis_id}:audio_sample:{normalized_entity or 'unknown'}:{index:04d}"


def _normalize_supporting_ids(raw_ids: Any, fallback_id: Optional[str]) -> List[str]:
    ids: List[str] = []
    if isinstance(raw_ids, Iterable) and not isinstance(raw_ids, (str, bytes, dict)):
        ids = [str(item) for item in raw_ids if item]
    if fallback_id and fallback_id not in ids:
        ids.append(fallback_id)
    return ids


def build_character_audio_sample_cloud(
    analysis_id: str,
    *,
    entity_label: str,
    speaker_turns: Iterable[Dict[str, Any]],
    source_media_context: Optional[Dict[str, Any]] = None,
    entity_type: str = "character_voice",
    entity_status: str = "suspected",
    created_by: str = "audio_sample_cloud_builder",
    source_audio_path: str | Path | None = None,
) -> Dict[str, Any]:
    """Build a governed audio sample array for one character or speaker entity.

    This is a contract layer, not runtime speaker recognition. It turns diarization
    turns, transcript segments, and analyst-promoted voice candidates into the
    same sample-cloud shape used by the rest of VAA1.
    """

    context = dict(source_media_context or {})
    context.setdefault("analysis_id", analysis_id)
    if source_audio_path is not None:
        context.setdefault("source_audio_path", str(source_audio_path))

    samples: List[Dict[str, Any]] = []
    for index, turn in enumerate(speaker_turns):
        if not isinstance(turn, dict):
            continue

        turn_id = _clean_label(turn.get("turn_id"), f"turn_{index:04d}")
        sample_id = _clean_label(
            turn.get("sample_id"),
            _build_sample_id(analysis_id, entity_label, index),
        )
        confidence = _safe_confidence(
            turn.get("confidence")
            or turn.get("reference_match_confidence")
            or turn.get("diarization_confidence"),
            0.55,
        )
        review_state = _clean_label(turn.get("review_state"), "candidate")
        epistemic_status = _clean_label(turn.get("epistemic_status"), entity_status)
        source_type = _clean_label(turn.get("source_type"), "automatic_detection")
        embedding_ref = turn.get("embedding_ref") or turn.get("voice_embedding_ref")

        samples.append(
            {
                "sample_id": sample_id,
                "time_start": _safe_float(turn.get("start") or turn.get("time_start")),
                "time_end": _safe_float(turn.get("end") or turn.get("time_end")),
                "transcript_text": str(turn.get("text") or turn.get("transcript_text") or ""),
                "source_type": source_type,
                "speaker_label": _clean_label(turn.get("speaker_label"), "SPEAKER_UNKNOWN"),
                "source_turn_id": turn_id,
                "sample_role": _clean_label(turn.get("sample_role"), "candidate_reference"),
                "supporting_evidence_ids": _normalize_supporting_ids(
                    turn.get("supporting_evidence_ids"),
                    turn_id,
                ),
                "confidence": confidence,
                "epistemic_status": epistemic_status,
                "review_state": review_state,
                "audio_features": {
                    "voice_embedding_ref": embedding_ref,
                    "pitch_hz_mean": turn.get("pitch_hz_mean"),
                    "pitch_hz_range": turn.get("pitch_hz_range"),
                    "energy_rms_mean": turn.get("energy_rms_mean"),
                    "energy_dbfs_mean": turn.get("energy_dbfs_mean"),
                    "pace_wps": turn.get("pace_wps"),
                    "rhythm_profile_label": turn.get("rhythm_profile_label"),
                    "tonality_profile_label": turn.get("tonality_profile_label"),
                    "emphasis_score": turn.get("emphasis_score"),
                    "overlap_seconds": turn.get("overlap_seconds"),
                    "turn_transition_label": turn.get("turn_transition_label"),
                    "sound_environment_label": turn.get("sound_environment_label"),
                },
                "speech_role_hints": list(turn.get("speech_role_hints") or []),
                "language_context": dict(turn.get("language_context") or {}),
                "open_note": str(turn.get("open_note") or ""),
            }
        )

    average_confidence = (
        sum(sample["confidence"] for sample in samples) / len(samples) if samples else 0.0
    )
    confirmed_count = sum(
        1
        for sample in samples
        if sample.get("review_state") == "confirmed"
        or sample.get("epistemic_status") == "confirmed"
    )
    embedding_refs = [
        sample["audio_features"]["voice_embedding_ref"]
        for sample in samples
        if sample.get("audio_features", {}).get("voice_embedding_ref")
    ]
    now = _utc_now()

    return {
        "cloud_id": f"{analysis_id}:audio_cloud:{entity_label.strip() or 'unknown'}",
        "entity_type": entity_type,
        "entity_label": entity_label,
        "entity_status": entity_status,
        "source_media_context": context,
        "samples": samples,
        "cloud_summary": {
            "sample_count": len(samples),
            "confirmed_sample_count": confirmed_count,
            "metadata_reference_count": sum(
                1 for sample in samples if sample.get("source_type") == "metadata_reference"
            ),
            "average_confidence": round(average_confidence, 4),
            "dominant_voice_signature_refs": embedding_refs,
            "authority_order": AUDIO_SAMPLE_AUTHORITY_ORDER,
        },
        "provenance": {
            "created_at": now,
            "updated_at": now,
            "created_by": created_by,
            "updated_by": created_by,
        },
    }


def build_audio_sample_clouds_from_diarization(
    analysis_id: str,
    *,
    audio_diarization: Optional[Dict[str, Any]],
    source_media_context: Optional[Dict[str, Any]] = None,
    source_audio_path: str | Path | None = None,
    created_by: str = "audio_sample_cloud_builder",
) -> Dict[str, Any]:
    """Group diarization turns into one governed audio sample cloud per speaker label."""

    turns = (audio_diarization or {}).get("speaker_turns") or []
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for turn in turns:
        if not isinstance(turn, dict):
            continue
        speaker_label = _clean_label(turn.get("speaker_label"), "SPEAKER_UNKNOWN")
        grouped.setdefault(speaker_label, []).append(turn)

    clouds = [
        build_character_audio_sample_cloud(
            analysis_id,
            entity_label=speaker_label,
            speaker_turns=speaker_turns,
            source_media_context=source_media_context,
            entity_type="speaker" if speaker_label.startswith("SPEAKER_") else "character_voice",
            entity_status="suspected",
            created_by=created_by,
            source_audio_path=source_audio_path,
        )
        for speaker_label, speaker_turns in sorted(grouped.items())
    ]

    return {
        "analysis_id": analysis_id,
        "status": "sample_clouds_ready",
        "cloud_count": len(clouds),
        "sample_count": sum(cloud.get("cloud_summary", {}).get("sample_count", 0) for cloud in clouds),
        "authority_order": AUDIO_SAMPLE_AUTHORITY_ORDER,
        "clouds": clouds,
    }
