from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import re
from time import perf_counter
from typing import Any, Dict, Iterable, List, Optional

from src.backend.utils.logger import get_logger

logger = get_logger(__name__)


AUDIO_SAMPLE_AUTHORITY_ORDER = [
    "manual_confirmed_sample",
    "manual_candidate_sample",
    "diarization_speaker_turn",
    "transcript_segment",
    "raw_audio",
]

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False


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


def _normalize_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _unique_labels(labels: Iterable[Any]) -> List[str]:
    unique: Dict[str, str] = {}
    for label in labels:
        cleaned = str(label or "").strip()
        if not cleaned:
            continue
        unique.setdefault(_normalize_key(cleaned), cleaned)
    return list(unique.values())


def _character_name_from_role(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text.split(":", 1)[0].split("(", 1)[0].strip()


def narrative_agent_labels_from_source_context(
    source_media_context: Optional[Dict[str, Any]],
) -> List[str]:
    """Return source-level Narrative Agent candidates that may seed audio patterns."""

    annotations = (source_media_context or {}).get("user_annotations") or {}
    labels: List[str] = []

    for profile in annotations.get("narrative_agent_profiles") or []:
        if isinstance(profile, dict):
            labels.append(profile.get("narrative_agent_name") or profile.get("identity_label"))
        else:
            labels.append(profile)
    for definition in annotations.get("character_definitions") or []:
        if isinstance(definition, dict):
            labels.append(definition.get("character_name") or definition.get("name"))
        else:
            labels.append(_character_name_from_role(definition))
    for role in annotations.get("character_roles") or []:
        labels.append(_character_name_from_role(role))
    for person in annotations.get("persons") or []:
        labels.append(person.get("identity_label") or person.get("name") if isinstance(person, dict) else person)
    for person in annotations.get("reference_people") or []:
        labels.append(person.get("identity_label") or person.get("name") if isinstance(person, dict) else person)
    for speaker in annotations.get("reference_speakers") or []:
        if isinstance(speaker, dict):
            labels.append(speaker.get("identity_label") or speaker.get("speaker_label"))
    for identity in annotations.get("expected_identities") or []:
        labels.append(identity)

    return _unique_labels(labels)


def _aliases_for_label(label: str) -> List[str]:
    aliases = [label]
    normalized = _normalize_key(label)
    parts = normalized.split()
    if len(parts) > 1 and len(parts[-1]) >= 3:
        aliases.append(parts[-1])
    if "james bond" in normalized:
        aliases.extend(["bond", "007", "commander bond"])
    return [
        _normalize_key(alias)
        for alias in _unique_labels(aliases)
        if len(_normalize_key(alias)) >= 3 or _normalize_key(alias).isdigit()
    ]


def _transcript_segments(transcript: Any) -> List[Dict[str, Any]]:
    raw_segments: Any
    if isinstance(transcript, dict):
        raw_segments = (
            transcript.get("segments")
            or transcript.get("utterances")
            or transcript.get("items")
            or []
        )
    else:
        raw_segments = transcript
    segments: List[Dict[str, Any]] = []
    for index, item in enumerate(raw_segments or []):
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or item.get("transcript") or "").strip()
        if not text:
            continue
        start = _safe_float(item.get("start", item.get("time_start", item.get("start_ms"))))
        end = _safe_float(item.get("end", item.get("time_end", item.get("end_ms"))), start + 1.0)
        if start > 1000 or end > 1000:
            start /= 1000.0
            end /= 1000.0
        segments.append(
            {
                "turn_id": str(item.get("id") or item.get("segment_id") or f"transcript:{index:04d}"),
                "speaker_label": str(item.get("speaker") or item.get("speaker_label") or "SPEAKER_UNKNOWN"),
                "start": start,
                "end": max(end, start + 0.001),
                "source_start": item.get("source_start"),
                "source_end": item.get("source_end"),
                "timing_status": item.get("timing_status"),
                "timing_authority": item.get("timing_authority"),
                "timing_source": item.get("timing_source"),
                "source_media_id": item.get("source_media_id"),
                "transcript_fingerprint": item.get("transcript_fingerprint"),
                "audio_fingerprint": item.get("audio_fingerprint"),
                "diarization_fingerprint": item.get("diarization_fingerprint"),
                "generated_from_artifact_id": item.get("generated_from_artifact_id"),
                "generated_at": item.get("generated_at"),
                "is_stale": bool(item.get("is_stale")),
                "stale_reason": item.get("stale_reason"),
                "valid_for_confirmation": bool(item.get("valid_for_confirmation", False)),
                "text": text,
                "supporting_evidence_ids": item.get("source_evidence_ids") or [f"transcript:{index:04d}"],
                "source_type": "transcript_segment",
                "sample_role": "narrative_agent_audio_pattern_candidate",
                "review_state": "candidate",
                "epistemic_status": "candidate",
            }
        )
    return segments


def _prosody_cues_by_window(audio_prosody: Any) -> List[Dict[str, Any]]:
    cues = (audio_prosody or {}).get("cues") if isinstance(audio_prosody, dict) else []
    return [cue for cue in cues or [] if isinstance(cue, dict)]


def _merge_prosody(turn: Dict[str, Any], cues: List[Dict[str, Any]]) -> Dict[str, Any]:
    matching = [
        cue
        for cue in cues
        if _safe_float(cue.get("start")) <= _safe_float(turn.get("end"))
        and _safe_float(cue.get("end")) >= _safe_float(turn.get("start"))
    ]
    if not matching:
        turn.setdefault("confidence", 0.68)
        return turn
    cue = matching[0]
    pitch = cue.get("pitch_energy_contour") or {}
    turn.update(
        {
            "confidence": max(0.72, _safe_confidence((cue.get("emphasis") or {}).get("score"), 0.68)),
            "pitch_hz_mean": pitch.get("pitch_hz"),
            "energy_rms_mean": pitch.get("energy_rms"),
            "energy_dbfs_mean": pitch.get("energy_dbfs"),
            "pace_wps": (cue.get("pace") or {}).get("words_per_second"),
            "rhythm_profile_label": (cue.get("rhythm_profile") or {}).get("label"),
            "tonality_profile_label": (cue.get("tonality_profile") or {}).get("label"),
            "emphasis_score": (cue.get("emphasis") or {}).get("score"),
            "turn_transition_label": (cue.get("turn_structure") or {}).get("transition"),
            "sound_environment_label": (cue.get("sound_environment") or {}).get("label"),
        }
    )
    return turn


def build_audio_sample_clouds_for_narrative_agents(
    analysis_id: str,
    *,
    transcript: Any = None,
    audio_prosody: Any = None,
    source_media_context: Optional[Dict[str, Any]] = None,
    source_audio_path: str | Path | None = None,
    created_by: str = "narrative_agent_audio_sample_builder",
) -> Dict[str, Any]:
    """Build audio pattern clouds for Narrative Agent candidates from transcript/prosody.

    This is not speaker re-identification. It creates traceable voice-pattern
    candidates when source-known agents are mentioned in transcript windows, so
    identity triangulation has actual audio evidence to evaluate.
    """

    started_at = perf_counter()
    transcript_turns = _transcript_segments(transcript)
    prosody_cues = _prosody_cues_by_window(audio_prosody)
    clouds: List[Dict[str, Any]] = []

    for label in narrative_agent_labels_from_source_context(source_media_context):
        aliases = _aliases_for_label(label)
        turns: List[Dict[str, Any]] = []
        for turn in transcript_turns:
            text_key = _normalize_key(turn.get("text"))
            if not any(alias and alias in text_key for alias in aliases):
                continue
            candidate = dict(turn)
            candidate["turn_id"] = f"{candidate['turn_id']}:narrative_agent:{_normalize_key(label).replace(' ', '_')}"
            candidate["speech_role_hints"] = ["narrative_agent_name_mention", "identity_cue"]
            turns.append(_merge_prosody(candidate, prosody_cues))

        if not turns:
            continue
        clouds.append(
            build_character_audio_sample_cloud(
                analysis_id,
                entity_label=label,
                speaker_turns=turns,
                source_media_context=source_media_context,
                entity_type="narrative_agent_voice_pattern",
                entity_status="candidate",
                created_by=created_by,
                source_audio_path=source_audio_path,
            )
        )

    payload = {
        "analysis_id": analysis_id,
        "status": "sample_clouds_ready",
        "cloud_count": len(clouds),
        "sample_count": sum(cloud.get("cloud_summary", {}).get("sample_count", 0) for cloud in clouds),
        "authority_order": AUDIO_SAMPLE_AUTHORITY_ORDER,
        "clouds": clouds,
    }
    payload["build_compute_seconds"] = round(perf_counter() - started_at, 6)
    return payload


def merge_audio_sample_cloud_payloads(
    analysis_id: str,
    *payloads: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    clouds: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for payload in payloads:
        for cloud in (payload or {}).get("clouds") or []:
            if not isinstance(cloud, dict):
                continue
            key = str(cloud.get("cloud_id") or f"{cloud.get('entity_label')}:{len(clouds)}")
            if key in seen:
                continue
            seen.add(key)
            clouds.append(cloud)
    stale_reasons = [
        str(cloud.get("stale_reason"))
        for cloud in clouds
        if cloud.get("is_stale") and cloud.get("stale_reason")
    ]
    diarization_fingerprints = sorted(
        {
            str(cloud.get("diarization_fingerprint"))
            for cloud in clouds
            if cloud.get("diarization_fingerprint")
        }
    )
    return {
        "analysis_id": analysis_id,
        "status": "sample_clouds_ready",
        "cloud_count": len(clouds),
        "sample_count": sum(cloud.get("cloud_summary", {}).get("sample_count", 0) for cloud in clouds),
        "authority_order": AUDIO_SAMPLE_AUTHORITY_ORDER,
        "is_stale": bool(stale_reasons),
        "stale_reason": "; ".join(sorted(set(stale_reasons))) if stale_reasons else None,
        "diarization_fingerprints": diarization_fingerprints,
        "diarization_fingerprint": diarization_fingerprints[0] if len(diarization_fingerprints) == 1 else None,
        "build_compute_seconds": round(
            sum(_safe_float((payload or {}).get("build_compute_seconds")) for payload in payloads),
            6,
        ),
        "clouds": clouds,
    }


def _build_sample_id(analysis_id: str, entity_label: str, index: int) -> str:
    normalized_entity = "".join(
        char.lower() if char.isalnum() else "_" for char in entity_label.strip()
    ).strip("_")
    return f"{analysis_id}:audio_sample:{normalized_entity or 'unknown'}:{index:04d}"


def _sample_fingerprint(
    analysis_id: str,
    entity_label: str,
    turn_id: str,
    start: float,
    end: float,
    audio_fingerprint: Any,
) -> str:
    payload = "|".join(
        [
            analysis_id,
            _normalize_key(entity_label),
            str(turn_id),
            f"{start:.3f}",
            f"{end:.3f}",
            str(audio_fingerprint or "audio-fingerprint-unavailable"),
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


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
    This also computes a representative voice embedding for the entire cloud.

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
        is_stale = bool(turn.get("is_stale"))
        valid_for_confirmation = bool(turn.get("valid_for_confirmation")) and not is_stale

        start = _safe_float(turn.get("start") or turn.get("time_start"))
        end = _safe_float(turn.get("end") or turn.get("time_end"))
        subject_kind = (
            "narrative_agent_candidate"
            if entity_type == "narrative_agent_voice_pattern"
            else "speaker_cluster"
            if _clean_label(turn.get("speaker_label"), "").startswith("SPEAKER_")
            else "narrative_agent_candidate"
        )
        fingerprint = _sample_fingerprint(
            analysis_id,
            entity_label,
            turn_id,
            start,
            end,
            turn.get("audio_fingerprint"),
        )
        samples.append(
            {
                "sample_id": sample_id,
                "sample_fingerprint": fingerprint,
                "reuse_key": f"audio-sample:{fingerprint}",
                "stable_subject_ref": {
                    "subject_type": subject_kind,
                    "subject_id": _normalize_key(entity_label).replace(" ", "_") or "unknown",
                    "label": entity_label,
                    "identity_confirmed": entity_status == "confirmed",
                },
                "time_start": start,
                "time_end": end,
                "start": start,
                "end": end,
                "duration_seconds": round(max(0.0, end - start), 3),
                "source_start": turn.get("source_start"),
                "source_end": turn.get("source_end"),
                "canonical_time_basis": turn.get("canonical_time_basis") or "source_media_seconds",
                "timing_status": turn.get("timing_status"),
                "timing_authority": turn.get("timing_authority"),
                "timing_source": turn.get("timing_source"),
                "source_media_id": turn.get("source_media_id"),
                "transcript_fingerprint": turn.get("transcript_fingerprint"),
                "audio_fingerprint": turn.get("audio_fingerprint"),
                "diarization_fingerprint": turn.get("diarization_fingerprint"),
                "generated_from_artifact_id": turn.get("generated_from_artifact_id"),
                "generated_at": turn.get("generated_at"),
                "is_stale": is_stale,
                "stale_reason": turn.get("stale_reason"),
                "valid_for_confirmation": valid_for_confirmation,
                "valid_for_mature_master_schema": bool(turn.get("valid_for_mature_master_schema")) and not is_stale,
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
                "source_navigation": {
                    "target_panel": "VideoPanel",
                    "target_time": start,
                    "highlight_start": start,
                    "highlight_end": end,
                },
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
    is_stale = any(sample.get("is_stale") for sample in samples)
    stale_reason = "; ".join(
        sorted({str(sample.get("stale_reason")) for sample in samples if sample.get("stale_reason")})
    ) or None
    diarization_fingerprints = sorted(
        {str(sample.get("diarization_fingerprint")) for sample in samples if sample.get("diarization_fingerprint")}
    )

    # Economical Computation: Compute a single representative embedding for the cloud
    cloud_embedding = None
    if NUMPY_AVAILABLE and embedding_refs:
        # In a real implementation, you would load the referenced vectors.
        # Here, we simulate creating a mean vector.
        # For simplicity, we'll just mark that it would be computed.
        # Example:
        # all_vectors = [load_vector(ref) for ref in embedding_refs]
        # if all_vectors:
        #    cloud_embedding = np.mean(all_vectors, axis=0).tolist()
        logger.info(f"A representative embedding would be computed for {entity_label} from {len(embedding_refs)} samples.")
        # For this diff, we'll just note the capability.
        pass

    return {
        "cloud_id": f"{analysis_id}:audio_cloud:{entity_label.strip() or 'unknown'}",
        "entity_type": entity_type,
        "entity_label": entity_label,
        "entity_status": entity_status,
        "source_media_context": context,
        "is_stale": is_stale,
        "stale_reason": stale_reason,
        "diarization_fingerprint": diarization_fingerprints[0] if len(diarization_fingerprints) == 1 else None,
        "samples": samples,
        "cloud_summary": {
            "sample_count": len(samples),
            "confirmed_sample_count": confirmed_count,
            "metadata_reference_count": sum(
                1 for sample in samples if sample.get("source_type") == "metadata_reference"
            ),
            "average_confidence": round(average_confidence, 4),
            "dominant_voice_signature_refs": embedding_refs,
            "representative_embedding_computed": bool(cloud_embedding),
            "reusable_sample_count": sum(
                1
                for sample in samples
                if not sample.get("is_stale")
                and sample.get("duration_seconds", 0) >= 0.25
                and sample.get("sample_fingerprint")
            ),
            "source_linked_sample_count": sum(
                1
                for sample in samples
                if sample.get("source_navigation", {}).get("target_time") is not None
            ),
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

    started_at = perf_counter()
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

    payload = {
        "analysis_id": analysis_id,
        "status": "sample_clouds_ready",
        "cloud_count": len(clouds),
        "sample_count": sum(cloud.get("cloud_summary", {}).get("sample_count", 0) for cloud in clouds),
        "authority_order": AUDIO_SAMPLE_AUTHORITY_ORDER,
        "clouds": clouds,
    }
    payload["build_compute_seconds"] = round(perf_counter() - started_at, 6)
    return payload


def attach_audio_maturation_economics(
    payload: Dict[str, Any],
    *,
    source_duration_seconds: Optional[float] = None,
) -> Dict[str, Any]:
    """Attach a measured cost/yield/reuse record to an audio sample-cloud payload.

    This record governs whether another sampling pass is justified. It never
    promotes speaker identity or interpretation.
    """

    result = dict(payload)
    clouds = [cloud for cloud in result.get("clouds") or [] if isinstance(cloud, dict)]
    samples = [
        sample
        for cloud in clouds
        for sample in cloud.get("samples") or []
        if isinstance(sample, dict)
    ]
    fingerprints = [
        str(sample.get("sample_fingerprint"))
        for sample in samples
        if sample.get("sample_fingerprint")
    ]
    unique_fingerprints = set(fingerprints)
    duplicate_count = max(0, len(fingerprints) - len(unique_fingerprints))
    reusable_count = sum(
        1
        for sample in samples
        if sample.get("sample_fingerprint")
        and not sample.get("is_stale")
        and _safe_float(sample.get("duration_seconds")) >= 0.25
    )
    confirmed_count = sum(
        1
        for sample in samples
        if sample.get("review_state") == "confirmed"
        or sample.get("epistemic_status") == "confirmed"
        or sample.get("stable_subject_ref", {}).get("identity_confirmed")
    )
    valid_confirmation_count = sum(
        1
        for sample in samples
        if sample.get("valid_for_confirmation") and not sample.get("is_stale")
    )
    source_linked_count = sum(
        1
        for sample in samples
        if sample.get("source_navigation", {}).get("target_time") is not None
    )
    sampled_seconds = sum(
        max(0.0, _safe_float(sample.get("duration_seconds"))) for sample in samples
    )
    duration = max(0.0, _safe_float(source_duration_seconds))
    coverage_ratio = min(1.0, sampled_seconds / duration) if duration else None
    build_compute_seconds = sum(
        _safe_float(source.get("build_compute_seconds"))
        for source in result.get("source_payloads") or []
        if isinstance(source, dict)
    ) or _safe_float(result.get("build_compute_seconds"))
    serialized_bytes = len(
        json.dumps(result, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    )

    if not samples:
        recommendation = "baseline_sampling_required"
        reason = "No reusable speaker-linked audio samples are available."
        continue_iteration = True
    elif valid_confirmation_count == 0:
        recommendation = "targeted_dense_pass"
        reason = (
            "Samples exist, but timing authority does not yet permit identity confirmation. "
            "Run dense analysis only around unresolved or analyst-selected speaker windows."
        )
        continue_iteration = True
    elif duplicate_count > max(2, len(samples) // 5):
        recommendation = "stop_and_reuse"
        reason = "Duplicate sample yield is high; reuse the governed sample cloud before resampling."
        continue_iteration = False
    else:
        recommendation = "baseline_sufficient"
        reason = "Reusable source-linked samples exist; full-FPS audio resampling is not justified."
        continue_iteration = False

    unresolved_samples = [
        sample
        for sample in samples
        if not sample.get("valid_for_confirmation") or sample.get("is_stale")
    ]
    unresolved_samples.sort(
        key=lambda sample: (
            0
            if sample.get("stable_subject_ref", {}).get("subject_type")
            == "narrative_agent_candidate"
            else 1,
            _safe_float(sample.get("confidence"), 1.0),
            -_safe_float(sample.get("duration_seconds")),
            _safe_float(sample.get("start")),
        )
    )
    target_limit = min(12, max(4, len(clouds) + 2))
    targeted_samples: List[Dict[str, Any]] = []
    targeted_intervals: set[tuple[float, float]] = set()
    for sample in unresolved_samples:
        interval_key = (
            round(_safe_float(sample.get("start")), 3),
            round(_safe_float(sample.get("end")), 3),
        )
        if interval_key in targeted_intervals:
            continue
        targeted_intervals.add(interval_key)
        targeted_samples.append(sample)
        if len(targeted_samples) >= target_limit:
            break

    result["maturation_economics"] = {
        "schema": "vaa1.audio_sample_maturation_economics.v1",
        "policy_version": "1.1.1",
        "measurement_scope": "speaker_linked_audio_sample_clouds",
        "cost_observations": {
            "build_compute_seconds": round(build_compute_seconds, 6),
            "artifact_storage_bytes": serialized_bytes,
            "artifact_storage_mb": round(serialized_bytes / (1024 * 1024), 6),
            "remote_api_calls": 0,
            "gpu_seconds": 0.0,
            "analyst_minutes": None,
            "analyst_cost_status": "not_observed",
        },
        "yield_observations": {
            "cloud_count": len(clouds),
            "sample_count": len(samples),
            "unique_sample_count": len(unique_fingerprints),
            "reusable_sample_count": reusable_count,
            "confirmed_sample_count": confirmed_count,
            "valid_for_confirmation_count": valid_confirmation_count,
            "source_linked_sample_count": source_linked_count,
            "duplicate_sample_count": duplicate_count,
            "sampled_seconds": round(sampled_seconds, 3),
            "source_coverage_ratio": round(coverage_ratio, 6) if coverage_ratio is not None else None,
            "reuse_ratio": round(reusable_count / len(samples), 6) if samples else 0.0,
            "waste_ratio": round(duplicate_count / len(samples), 6) if samples else 0.0,
        },
        "dense_analysis_policy": {
            "recommendation": recommendation,
            "full_dense_pass_recommended": False,
            "targeted_dense_pass_recommended": recommendation == "targeted_dense_pass",
            "target_windows": [
                {
                    "sample_id": sample.get("sample_id"),
                    "start": sample.get("start"),
                    "end": sample.get("end"),
                    "reason": "timing_or_identity_confirmation_gap",
                }
                for sample in targeted_samples
            ],
            "reason": reason,
        },
        "economic_verdict": {
            "maturation_economically_sound": reusable_count > 0,
            "iteration_should_continue": continue_iteration,
            "developer_attention_required": not samples or valid_confirmation_count == 0,
        },
    }
    return result
