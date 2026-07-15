from __future__ import annotations

import json
import hashlib
import math
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy.fft import dct
from scipy.signal import resample_poly
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


TARGET_SAMPLE_RATE = 16000
FRAME_SECONDS = 0.025
HOP_SECONDS = 0.010
AUDIO_DIARIZATION_CLOCK_VERSION = "vaa1.audio_diarization.clock.v2"
PUNCTUAL_TIMING_STATUSES = {"original_whisper_timecode", "manual_correction", "manual_source_verified"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def _stable_hash(payload: Any) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def transcript_timing_fingerprint(transcript: Optional[Dict[str, Any]]) -> str:
    """Fingerprint the canonical transcript clock, not only transcript text."""

    rows: List[Dict[str, Any]] = []
    for index, segment in enumerate((transcript or {}).get("segments") or []):
        if not isinstance(segment, dict):
            continue
        start = _safe_float(segment.get("start"))
        end = _safe_float(segment.get("end"), start)
        rows.append(
            {
                "index": index,
                "start": round(start, 3),
                "end": round(end, 3),
                "text": str(segment.get("text") or ""),
                "timing_status": segment.get("timing_status"),
                "timing_authority": segment.get("timing_authority"),
                "timing_source": segment.get("timing_source"),
            }
        )
    return _stable_hash(
        {
            "schema": "vaa1.transcript_timing_fingerprint.v1",
            "strategy": (transcript or {}).get("transcription_strategy"),
            "timing_repair": (transcript or {}).get("timing_repair"),
            "rows": rows,
        }
    )


def audio_source_fingerprint(audio_path: str | Path | None) -> str:
    if not audio_path:
        return _stable_hash({"schema": "vaa1.audio_source_fingerprint.v1", "path": None})
    path = Path(audio_path)
    stat_payload: Dict[str, Any] = {
        "schema": "vaa1.audio_source_fingerprint.v1",
        "path": str(path),
        "exists": path.exists(),
    }
    try:
        stat = path.stat()
        stat_payload.update({"size": stat.st_size, "mtime_ns": stat.st_mtime_ns})
    except OSError:
        pass
    try:
        with wave.open(str(path), "rb") as wav:
            stat_payload.update(
                {
                    "channels": wav.getnchannels(),
                    "sample_width": wav.getsampwidth(),
                    "sample_rate": wav.getframerate(),
                    "frame_count": wav.getnframes(),
                }
            )
    except Exception:
        pass
    return _stable_hash(stat_payload)


def audio_timing_contract(
    transcript: Optional[Dict[str, Any]],
    audio_path: str | Path | None,
) -> Dict[str, Any]:
    segments = [
        segment for segment in (transcript or {}).get("segments") or [] if isinstance(segment, dict)
    ]
    starts = [_safe_float(segment.get("start")) for segment in segments]
    ends = [_safe_float(segment.get("end"), _safe_float(segment.get("start"))) for segment in segments]
    return {
        "schema": "vaa1.audio_timing_contract.v1",
        "clock_version": AUDIO_DIARIZATION_CLOCK_VERSION,
        "transcript_fingerprint": transcript_timing_fingerprint(transcript),
        "audio_fingerprint": audio_source_fingerprint(audio_path),
        "transcript_segment_count": len(segments),
        "clock_range": {
            "start": round(min(starts), 3) if starts else None,
            "end": round(max(ends), 3) if ends else None,
        },
    }


def audio_diarization_staleness(
    diarization: Optional[Dict[str, Any]],
    transcript: Optional[Dict[str, Any]],
    audio_path: str | Path | None = None,
    *,
    tolerance_seconds: float = 0.001,
) -> Dict[str, Any]:
    """Return whether a saved diarization artifact is valid for the current clock."""

    if not isinstance(diarization, dict) or not diarization:
        return {"is_stale": True, "stale_reason": "missing_audio_diarization_artifact"}
    if diarization.get("status") != "completed_measured":
        return {"is_stale": True, "stale_reason": "audio_diarization_not_completed_measured"}

    expected = audio_timing_contract(transcript, audio_path)
    actual = diarization.get("timing_contract") if isinstance(diarization.get("timing_contract"), dict) else {}
    if not actual:
        return {"is_stale": True, "stale_reason": "missing_audio_timing_contract", "expected": expected}
    for key in ("clock_version", "transcript_fingerprint"):
        if actual.get(key) != expected.get(key):
            return {
                "is_stale": True,
                "stale_reason": f"{key}_mismatch",
                "expected": expected.get(key),
                "actual": actual.get(key),
            }
    if audio_path and actual.get("audio_fingerprint") != expected.get("audio_fingerprint"):
        return {
            "is_stale": True,
            "stale_reason": "audio_fingerprint_mismatch",
            "expected": expected.get("audio_fingerprint"),
            "actual": actual.get("audio_fingerprint"),
        }

    segments = [s for s in (transcript or {}).get("segments") or [] if isinstance(s, dict)]
    turns = [t for t in diarization.get("speaker_turns") or [] if isinstance(t, dict)]
    if len(turns) != len(segments):
        return {
            "is_stale": True,
            "stale_reason": "speaker_turn_count_mismatch",
            "expected": len(segments),
            "actual": len(turns),
        }
    for index, (turn, segment) in enumerate(zip(turns, segments)):
        start_delta = abs(_safe_float(turn.get("start")) - _safe_float(segment.get("start")))
        end_delta = abs(_safe_float(turn.get("end")) - _safe_float(segment.get("end"), _safe_float(segment.get("start"))))
        if start_delta > tolerance_seconds or end_delta > tolerance_seconds:
            return {
                "is_stale": True,
                "stale_reason": "speaker_turn_clock_mismatch",
                "index": index,
                "start_delta": round(start_delta, 6),
                "end_delta": round(end_delta, 6),
            }
    if any(turn.get("is_stale") for turn in turns):
        return {"is_stale": True, "stale_reason": "speaker_turn_marked_stale"}
    return {"is_stale": False, "stale_reason": None}


def _transcript_timing_authority(transcript: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(transcript, dict):
        return {
            "status": "missing",
            "strategy": None,
            "speaker_turn_timing_source": "audio_only",
            "segments_can_seed_mature_speaker_turns": False,
        }

    segments = [
        segment for segment in transcript.get("segments") or [] if isinstance(segment, dict)
    ]
    timing_repair = transcript.get("timing_repair") if isinstance(transcript.get("timing_repair"), dict) else {}
    strategy = transcript.get("transcription_strategy")
    timing_status_counts: Dict[str, int] = {}
    for segment in segments:
        status = str(segment.get("timing_status") or "unmarked")
        timing_status_counts[status] = timing_status_counts.get(status, 0) + 1

    durations = []
    starts = []
    for segment in segments:
        start = _safe_float(segment.get("start"))
        end = _safe_float(segment.get("end"), start)
        if end > start:
            starts.append(round(start, 3))
            durations.append(round(end - start, 3))
    dominant_ratio = 0.0
    if durations:
        dominant_duration = max(set(durations), key=durations.count)
        dominant_ratio = durations.count(dominant_duration) / len(durations)
    scaffold_suspected = bool(starts and min(starts) <= 0.05 and dominant_ratio >= 0.65)

    if strategy == "anchored_vad_timing_repair" or timing_status_counts:
        status = timing_repair.get("status") or "partially_repaired"
    elif scaffold_suspected:
        status = "scaffold_suspected"
    else:
        status = "unverified"

    mature_statuses = {"original_whisper_timecode", "manual_correction", "manual_source_verified"}
    segments_can_seed = bool(
        timing_status_counts
        and all(
            status_name in mature_statuses
            for status_name in timing_status_counts
            if timing_status_counts.get(status_name)
        )
    )
    return {
        "status": status,
        "strategy": strategy,
        "timing_repair_reason": timing_repair.get("reason"),
        "timing_status_counts": timing_status_counts,
        "scaffold_suspected": scaffold_suspected,
        "speaker_turn_timing_source": "transcript_segments",
        "segments_can_seed_mature_speaker_turns": segments_can_seed,
    }


def _read_pcm_audio(audio_path: str | Path) -> Tuple[np.ndarray, int]:
    path = Path(audio_path)
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        sample_rate = wav.getframerate()
        frame_count = wav.getnframes()
        payload = wav.readframes(frame_count)

    dtype_by_width = {
        1: np.uint8,
        2: np.int16,
        4: np.int32,
    }
    dtype = dtype_by_width.get(sample_width)
    if dtype is None:
        raise ValueError(f"Unsupported PCM sample width: {sample_width}")
    samples = np.frombuffer(payload, dtype=dtype).astype(np.float32)
    if sample_width == 1:
        samples = (samples - 128.0) / 128.0
    else:
        samples /= float(2 ** ((sample_width * 8) - 1))
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if sample_rate != TARGET_SAMPLE_RATE:
        divisor = math.gcd(sample_rate, TARGET_SAMPLE_RATE)
        samples = resample_poly(
            samples,
            TARGET_SAMPLE_RATE // divisor,
            sample_rate // divisor,
        ).astype(np.float32)
        sample_rate = TARGET_SAMPLE_RATE
    return samples, sample_rate


def _frame_audio(samples: np.ndarray, sample_rate: int) -> np.ndarray:
    frame_length = max(1, int(FRAME_SECONDS * sample_rate))
    hop_length = max(1, int(HOP_SECONDS * sample_rate))
    if len(samples) < frame_length:
        samples = np.pad(samples, (0, frame_length - len(samples)))
    frame_count = 1 + max(0, (len(samples) - frame_length) // hop_length)
    shape = (frame_count, frame_length)
    strides = (samples.strides[0] * hop_length, samples.strides[0])
    return np.lib.stride_tricks.as_strided(
        samples,
        shape=shape,
        strides=strides,
        writeable=False,
    ).copy()


def _frame_features(samples: np.ndarray, sample_rate: int) -> Dict[str, np.ndarray]:
    frames = _frame_audio(samples, sample_rate)
    windowed = frames * np.hanning(frames.shape[1])[None, :]
    spectrum = np.abs(np.fft.rfft(windowed, axis=1)) + 1e-10
    power = spectrum ** 2
    frequencies = np.fft.rfftfreq(frames.shape[1], 1.0 / sample_rate)
    energy = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)
    energy_db = 20.0 * np.log10(energy + 1e-12)
    zcr = np.mean(np.diff(np.signbit(frames), axis=1), axis=1)
    spectral_sum = spectrum.sum(axis=1) + 1e-10
    centroid = (spectrum * frequencies[None, :]).sum(axis=1) / spectral_sum
    flatness = np.exp(np.mean(np.log(spectrum), axis=1)) / np.mean(spectrum, axis=1)

    cumulative = np.cumsum(power, axis=1)
    rolloff_threshold = cumulative[:, -1:] * 0.85
    rolloff_index = np.argmax(cumulative >= rolloff_threshold, axis=1)
    rolloff = frequencies[np.clip(rolloff_index, 0, len(frequencies) - 1)]

    band_edges = np.geomspace(80.0, min(7600.0, sample_rate / 2.0), 21)
    log_bands = []
    for low, high in zip(band_edges[:-1], band_edges[1:]):
        mask = (frequencies >= low) & (frequencies < high)
        band_power = power[:, mask].mean(axis=1) if np.any(mask) else np.zeros(len(frames))
        log_bands.append(np.log(band_power + 1e-10))
    log_bands_array = np.stack(log_bands, axis=1)
    cepstral = dct(log_bands_array, type=2, axis=1, norm="ortho")[:, :12]
    return {
        "energy_db": energy_db,
        "zcr": zcr,
        "centroid": centroid / max(1.0, sample_rate / 2.0),
        "flatness": flatness,
        "rolloff": rolloff / max(1.0, sample_rate / 2.0),
        "cepstral": cepstral,
    }


def _transcript_intervals(transcript: Optional[Dict[str, Any]]) -> List[Tuple[float, float]]:
    intervals = []
    for segment in (transcript or {}).get("segments") or []:
        if not isinstance(segment, dict):
            continue
        start = max(0.0, _safe_float(segment.get("start")))
        end = max(start, _safe_float(segment.get("end"), start))
        if end > start:
            intervals.append((start, end))
    return intervals


def _measured_vad(
    features: Dict[str, np.ndarray],
    transcript: Optional[Dict[str, Any]],
) -> Tuple[np.ndarray, Dict[str, float]]:
    energy_db = features["energy_db"]
    noise_floor = float(np.percentile(energy_db, 20))
    energy_threshold = min(-22.0, noise_floor + 8.0)
    voiced = (
        (energy_db >= energy_threshold)
        & (features["zcr"] >= 0.008)
        & (features["zcr"] <= 0.42)
        & (features["flatness"] <= 0.72)
    )
    transcript_mask = np.zeros(len(voiced), dtype=bool)
    for start, end in _transcript_intervals(transcript):
        first = max(0, int(start / HOP_SECONDS))
        last = min(len(voiced), int(math.ceil(end / HOP_SECONDS)))
        transcript_mask[first:last] = True
    # ASR timing is supporting evidence, but waveform energy must still be present.
    voiced |= transcript_mask & (energy_db >= noise_floor + 3.0)
    if len(voiced) >= 5:
        voiced = np.convolve(voiced.astype(np.int8), np.ones(5, dtype=np.int8), mode="same") >= 3
    return voiced, {
        "noise_floor_db": round(noise_floor, 3),
        "energy_threshold_db": round(float(energy_threshold), 3),
    }


def _vad_segments(voiced: np.ndarray) -> List[Dict[str, Any]]:
    segments: List[Dict[str, Any]] = []
    start_index: Optional[int] = None
    for index, active in enumerate(np.append(voiced, False)):
        if active and start_index is None:
            start_index = index
        elif not active and start_index is not None:
            start = start_index * HOP_SECONDS
            end = index * HOP_SECONDS + FRAME_SECONDS
            if end - start >= 0.08:
                segments.append(
                    {
                        "segment_id": f"vad_{len(segments):04d}",
                        "start": round(start, 3),
                        "end": round(end, 3),
                        "duration": round(end - start, 3),
                        "measurement_status": "waveform_measured",
                    }
                )
            start_index = None
    return segments


def _segment_embedding(
    features: Dict[str, np.ndarray],
    voiced: np.ndarray,
    start: float,
    end: float,
) -> Optional[np.ndarray]:
    first = max(0, int(start / HOP_SECONDS))
    last = min(len(voiced), max(first + 1, int(math.ceil(end / HOP_SECONDS))))
    active = voiced[first:last]
    indices = np.arange(first, last)[active]
    if len(indices) < 3:
        indices = np.arange(first, last)
    if len(indices) < 1:
        return None
    base = np.column_stack(
        [
            features["energy_db"][indices],
            features["zcr"][indices],
            features["centroid"][indices],
            features["flatness"][indices],
            features["rolloff"][indices],
            features["cepstral"][indices],
        ]
    )
    return np.concatenate([base.mean(axis=0), base.std(axis=0)])


def _cluster_embeddings(embeddings: np.ndarray) -> Tuple[np.ndarray, np.ndarray, int, float]:
    count = len(embeddings)
    if count < 3:
        return np.zeros(count, dtype=int), np.ones(count), 1, 0.0
    scaled = StandardScaler().fit_transform(embeddings)
    best_labels = np.zeros(count, dtype=int)
    best_score = -1.0
    best_model: Optional[KMeans] = None
    max_clusters = min(8, count - 1)
    for cluster_count in range(2, max_clusters + 1):
        model = KMeans(n_clusters=cluster_count, random_state=17, n_init=20)
        labels = model.fit_predict(scaled)
        if len(set(labels)) < 2:
            continue
        score = float(silhouette_score(scaled, labels))
        if score > best_score:
            best_score = score
            best_labels = labels
            best_model = model
    if best_model is None or best_score < 0.05:
        return np.zeros(count, dtype=int), np.ones(count), 1, max(0.0, best_score)
    distances = best_model.transform(scaled)
    assigned = distances[np.arange(count), best_labels]
    alternatives = np.partition(distances, 1, axis=1)[:, 1]
    confidence = np.clip(1.0 - (assigned / (alternatives + 1e-8)), 0.0, 1.0)
    return best_labels, confidence, best_model.n_clusters, best_score


def build_audio_diarization(
    analysis_id: str,
    *,
    audio_path: str | Path,
    transcript: Optional[Dict[str, Any]] = None,
    audio_prosody: Optional[Dict[str, Any]] = None,
    reference_speakers: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    samples, sample_rate = _read_pcm_audio(audio_path)
    features = _frame_features(samples, sample_rate)
    voiced, thresholds = _measured_vad(features, transcript)
    vad_segments = _vad_segments(voiced)
    timing_authority = _transcript_timing_authority(transcript)
    timing_contract = audio_timing_contract(transcript, audio_path)
    generated_at = _utc_now()

    transcript_segments = [
        segment
        for segment in (transcript or {}).get("segments") or []
        if isinstance(segment, dict)
    ]
    measured_segments = []
    measured_embeddings = []
    for index, segment in enumerate(transcript_segments):
        start = max(0.0, _safe_float(segment.get("start")))
        end = max(start, _safe_float(segment.get("end"), start))
        embedding = _segment_embedding(features, voiced, start, end)
        if embedding is None:
            continue
        measured_segments.append((index, segment, start, end))
        measured_embeddings.append(embedding)

    if measured_embeddings:
        labels, confidences, speaker_count, silhouette = _cluster_embeddings(
            np.stack(measured_embeddings)
        )
    else:
        labels = np.array([], dtype=int)
        confidences = np.array([], dtype=float)
        speaker_count = 0
        silhouette = 0.0

    turns = []
    embedding_items = []
    for measured_index, (segment_index, segment, start, end) in enumerate(measured_segments):
        speaker_label = f"SPEAKER_{int(labels[measured_index]):02d}"
        confidence = float(confidences[measured_index])
        turn_id = f"turn_{segment_index:04d}"
        timing_status = segment.get("timing_status") or timing_authority["status"]
        row_authority = str(segment.get("timing_authority") or timing_authority["strategy"] or "")
        source_time_valid = (
            timing_status in PUNCTUAL_TIMING_STATUSES
            or row_authority in {"original_whisper_timecode", "manual_correction"}
        )
        turns.append(
            {
                "turn_id": turn_id,
                "speaker_label": speaker_label,
                "start": round(start, 3),
                "end": round(end, 3),
                "source_start": segment.get("source_start"),
                "source_end": segment.get("source_end"),
                "text": segment.get("text"),
                "diarization_status": "measured_acoustic_cluster",
                "diarization_confidence": round(confidence, 4),
                "timing_status": timing_status,
                "timing_authority": row_authority,
                "timing_source": segment.get("timing_source") or timing_authority["speaker_turn_timing_source"],
                "source_media_id": str(audio_path),
                "canonical_time_basis": "source_media_seconds",
                "transcript_fingerprint": timing_contract["transcript_fingerprint"],
                "audio_fingerprint": timing_contract["audio_fingerprint"],
                "generated_from_artifact_id": f"{analysis_id}:transcript:{segment_index:04d}",
                "generated_at": generated_at,
                "is_stale": False,
                "stale_reason": None,
                "valid_for_confirmation": source_time_valid,
                "valid_for_mature_master_schema": source_time_valid,
                "embedding_ref": f"embedding:{turn_id}",
                "reference_match": None,
            }
        )
        embedding_items.append(
            {
                "embedding_id": f"embedding:{turn_id}",
                "turn_id": turn_id,
                "speaker_label": speaker_label,
                "vector": [round(float(value), 6) for value in measured_embeddings[measured_index]],
            }
        )

    duration = len(samples) / float(sample_rate)
    diarization_fingerprint = _stable_hash(
        {
            "schema": "vaa1.audio_diarization_fingerprint.v1",
            "analysis_id": analysis_id,
            "provider": "local_waveform_vad_acoustic_clustering",
            "timing_contract": timing_contract,
            "turns": [
                {
                    "turn_id": turn.get("turn_id"),
                    "speaker_label": turn.get("speaker_label"),
                    "start": turn.get("start"),
                    "end": turn.get("end"),
                    "timing_status": turn.get("timing_status"),
                }
                for turn in turns
            ],
        }
    )
    for turn in turns:
        turn["diarization_fingerprint"] = diarization_fingerprint

    return {
        "schema": "vaa1.audio_diarization.measured.v1",
        "analysis_id": analysis_id,
        "status": "completed_measured",
        "provider": "local_waveform_vad_acoustic_clustering",
        "audio_path": str(audio_path),
        "timing_contract": timing_contract,
        "transcript_fingerprint": timing_contract["transcript_fingerprint"],
        "audio_fingerprint": timing_contract["audio_fingerprint"],
        "diarization_fingerprint": diarization_fingerprint,
        "generated_at": generated_at,
        "is_stale": False,
        "stale_reason": None,
        "measurement": {
            "sample_rate": sample_rate,
            "duration_seconds": round(duration, 3),
            "frame_seconds": FRAME_SECONDS,
            "hop_seconds": HOP_SECONDS,
            **thresholds,
            "speaker_cluster_count": speaker_count,
            "cluster_silhouette": round(float(silhouette), 4),
            "identity_recognition_performed": False,
            "transcript_timing_authority": timing_authority,
        },
        "turn_count": len(turns),
        "speaker_turns": turns,
        "reference_speakers": [
            speaker for speaker in (reference_speakers or []) if isinstance(speaker, dict)
        ],
        "embedding_index": {
            "status": "completed_measured",
            "provider": "local_cepstral_acoustic_embedding",
            "items": embedding_items,
        },
        "vad_segments": vad_segments,
        "prosody_cue_count": len((audio_prosody or {}).get("cues", [])),
        "governance": {
            "measured_audio_only": True,
            "speaker_labels_are_clusters_not_identities": True,
            "speaker_turns_depend_on_transcript_timing": True,
            "speaker_turns_can_seed_mature_claims": bool(
                timing_authority.get("segments_can_seed_mature_speaker_turns")
            ),
            "identity_requires_verified_voice_or_analyst_confirmation": True,
            "listening_requires_visible_presence_and_another_speaker_turn": True,
        },
        "notes": [
            "Voice activity and acoustic clusters were computed from the source waveform.",
            "Speaker cluster labels do not identify a named person without verified reference evidence.",
            "Canonical start/end values are source-media seconds. source_start/source_end are provenance only.",
        ],
    }


def write_audio_diarization(
    analysis_id: str,
    *,
    audio_path: str | Path,
    output_json_path: str | Path,
    transcript: Optional[Dict[str, Any]] = None,
    audio_prosody: Optional[Dict[str, Any]] = None,
    reference_speakers: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    try:
        payload = build_audio_diarization(
            analysis_id,
            audio_path=audio_path,
            transcript=transcript,
            audio_prosody=audio_prosody,
            reference_speakers=reference_speakers,
        )
    except Exception as exc:
        payload = {
            "schema": "vaa1.audio_diarization.measured.v1",
            "analysis_id": analysis_id,
            "status": "measurement_failed",
            "provider": "local_waveform_vad_acoustic_clustering",
            "audio_path": str(audio_path),
            "turn_count": 0,
            "speaker_turns": [],
            "reference_speakers": [
                speaker for speaker in (reference_speakers or []) if isinstance(speaker, dict)
            ],
            "embedding_index": {
                "status": "measurement_failed",
                "provider": "local_cepstral_acoustic_embedding",
                "items": [],
            },
            "vad_segments": [],
            "prosody_cue_count": len((audio_prosody or {}).get("cues", [])),
            "measurement_error": {
                "type": type(exc).__name__,
                "message": str(exc) or "Audio waveform could not be measured.",
            },
            "governance": {
                "measured_audio_only": True,
                "audio_evidence_available": False,
                "failed_measurement_must_not_proliferate": True,
            },
            "notes": [
                "Audio measurement failed. No speaker, speaking, or listening evidence was produced."
            ],
        }
    path = Path(output_json_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload


# Compatibility aliases for older imports. These now execute measured analysis.
build_audio_diarization_scaffold = build_audio_diarization
write_audio_diarization_scaffold = write_audio_diarization
