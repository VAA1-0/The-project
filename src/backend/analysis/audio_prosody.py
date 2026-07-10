"""
Lightweight audio prosody analysis
----------------------------------
Provides a first timestamp-linked prosody layer without adding heavy new
dependencies. This module is intentionally conservative: it derives pace and
pause structure from transcript timings, and energy / pitch cues from the
already-extracted WAV audio signal using Python's standard library.
"""

from __future__ import annotations

import audioop
import math
import re
import wave
from array import array
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple


_WORD_RE = re.compile(r"\b[\w'-]+\b", re.UNICODE)


@dataclass
class AudioWindow:
    sample_rate: int
    sample_width: int
    channel_count: int
    pcm_bytes: bytes


def _read_audio_window(audio_path: str | Path) -> AudioWindow:
    with wave.open(str(audio_path), "rb") as wav_file:
        sample_rate = wav_file.getframerate()
        sample_width = wav_file.getsampwidth()
        channel_count = wav_file.getnchannels()
        pcm_bytes = wav_file.readframes(wav_file.getnframes())
    return AudioWindow(
        sample_rate=sample_rate,
        sample_width=sample_width,
        channel_count=channel_count,
        pcm_bytes=pcm_bytes,
    )


def _mono_bytes(window: AudioWindow) -> bytes:
    if window.channel_count <= 1:
        return window.pcm_bytes
    return audioop.tomono(window.pcm_bytes, window.sample_width, 0.5, 0.5)


def _slice_pcm(
    mono_pcm: bytes,
    sample_rate: int,
    sample_width: int,
    start_s: float,
    end_s: float,
) -> bytes:
    if end_s <= start_s:
        return b""
    start_index = max(0, int(start_s * sample_rate))
    end_index = max(start_index, int(end_s * sample_rate))
    byte_start = start_index * sample_width
    byte_end = end_index * sample_width
    return mono_pcm[byte_start:byte_end]


def _bytes_to_int_array(pcm_bytes: bytes, sample_width: int) -> array:
    typecode = "h" if sample_width == 2 else "b"
    values = array(typecode)
    if pcm_bytes:
        values.frombytes(pcm_bytes)
    return values


def _estimate_pitch_hz(
    segment_bytes: bytes,
    sample_rate: int,
    sample_width: int,
) -> Optional[float]:
    if sample_width != 2 or len(segment_bytes) < sample_rate * sample_width * 0.08:
        return None

    samples = _bytes_to_int_array(segment_bytes, sample_width)
    if len(samples) < 128:
        return None

    step = max(1, len(samples) // 1600)
    reduced = [samples[i] for i in range(0, len(samples), step)]
    if len(reduced) < 128:
        return None

    mean_value = sum(reduced) / len(reduced)
    centered = [value - mean_value for value in reduced]
    energy = sum(value * value for value in centered)
    if energy <= 0:
        return None

    reduced_rate = sample_rate / step
    min_lag = max(1, int(reduced_rate / 300))
    max_lag = min(len(centered) // 2, int(reduced_rate / 70))
    if max_lag <= min_lag:
        return None

    best_lag = None
    best_corr = 0.0
    for lag in range(min_lag, max_lag + 1):
        corr = 0.0
        limit = len(centered) - lag
        for index in range(limit):
            corr += centered[index] * centered[index + lag]
        if corr > best_corr:
            best_corr = corr
            best_lag = lag

    if not best_lag or best_corr <= 0:
        return None

    pitch_hz = reduced_rate / best_lag
    if 70 <= pitch_hz <= 300:
        return round(pitch_hz, 2)
    return None


def _energy_dbfs(rms_value: float, sample_width: int) -> Optional[float]:
    if rms_value <= 0:
        return None
    max_amplitude = float((1 << ((8 * sample_width) - 1)) - 1)
    if max_amplitude <= 0:
        return None
    return round(20 * math.log10(rms_value / max_amplitude), 2)


def _label_pause(duration_s: float) -> str:
    if duration_s >= 1.2:
        return "long"
    if duration_s >= 0.45:
        return "marked"
    if duration_s > 0.1:
        return "brief"
    return "minimal"


def _label_pace(words_per_second: float) -> str:
    if words_per_second >= 3.8:
        return "rapid"
    if words_per_second >= 2.3:
        return "steady"
    if words_per_second > 0:
        return "measured"
    return "undetermined"


def _label_emphasis(score: float) -> str:
    if score >= 0.7:
        return "strong"
    if score >= 0.4:
        return "moderate"
    return "light"


def _turn_transition_label(pause_before: float) -> str:
    if pause_before < -0.02:
        return "possible overlap"
    if pause_before >= 1.0:
        return "speaker-change window"
    if pause_before >= 0.35:
        return "clear break"
    if pause_before > 0.08:
        return "soft break"
    return "continuous flow"


def _contiguous_run_lengths(
    transcript_segments: Sequence[Dict[str, Any]],
    *,
    gap_threshold_s: float = 0.35,
) -> List[int]:
    if not transcript_segments:
        return []

    run_lengths = [1] * len(transcript_segments)
    run_start = 0
    run_length = 1

    for index in range(1, len(transcript_segments)):
        previous_end = float(transcript_segments[index - 1].get("end") or 0.0)
        current_start = float(transcript_segments[index].get("start") or 0.0)
        gap = current_start - previous_end

        if gap <= gap_threshold_s:
            run_length += 1
            continue

        for fill_index in range(run_start, index):
            run_lengths[fill_index] = run_length
        run_start = index
        run_length = 1

    for fill_index in range(run_start, len(transcript_segments)):
        run_lengths[fill_index] = run_length
    return run_lengths


def _role_support_label(
    raw_gap_before: float,
    run_length: int,
    run_position: int,
) -> str:
    if raw_gap_before < -0.02:
        return "possible interruption"
    if run_length >= 4 and run_position == 1:
        return "floor opening"
    if run_length >= 4 and run_position < run_length:
        return "floor holding"
    if run_length >= 4 and run_position == run_length:
        return "floor closing"
    if raw_gap_before >= 1.0:
        return "new turn entry"
    if raw_gap_before >= 0.35:
        return "turn reset"
    return "continuing delivery"


def _rhythm_profile_label(
    words_per_second: float,
    previous_words_per_second: Optional[float],
    pause_before: float,
    emphasis_score: float,
) -> str:
    if pause_before >= 1.0 and emphasis_score >= 0.6:
        return "reset and drive"
    if previous_words_per_second is not None:
        delta = words_per_second - previous_words_per_second
        if delta >= 0.9:
            return "accelerating"
        if delta <= -0.9:
            return "decelerating"
    if emphasis_score >= 0.8:
        return "bursty emphasis"
    if pause_before >= 0.35:
        return "stop-start"
    if words_per_second >= 3.8:
        return "quick flow"
    if words_per_second >= 2.3:
        return "even flow"
    return "measured flow"


def _tonality_profile_label(
    pitch_hz: Optional[float],
    previous_pitch_hz: Optional[float],
    energy_dbfs: Optional[float],
    emphasis_score: float,
) -> str:
    if pitch_hz is None and energy_dbfs is None:
        return "tonality unclear"
    if previous_pitch_hz is not None and pitch_hz is not None:
        pitch_delta = pitch_hz - previous_pitch_hz
        if pitch_delta >= 18:
            return "rising delivery"
        if pitch_delta <= -18:
            return "falling delivery"
    if emphasis_score >= 0.8 and energy_dbfs is not None and energy_dbfs >= -24:
        return "assertive delivery"
    if energy_dbfs is not None and energy_dbfs <= -30:
        return "restrained delivery"
    if pitch_hz is not None and 105 <= pitch_hz <= 170 and emphasis_score < 0.65:
        return "steady delivery"
    return "animated delivery"


def _contour_label(pitch_hz: Optional[float], energy_dbfs: Optional[float]) -> str:
    pitch_part = "pitch unclear"
    if pitch_hz is not None:
        if pitch_hz >= 190:
            pitch_part = "higher pitch contour"
        elif pitch_hz >= 120:
            pitch_part = "mid pitch contour"
        else:
            pitch_part = "lower pitch contour"

    energy_part = "low energy"
    if energy_dbfs is not None:
        if energy_dbfs >= -18:
            energy_part = "high energy"
        elif energy_dbfs >= -28:
            energy_part = "moderate energy"

    return f"{pitch_part}, {energy_part}"


def _zero_crossing_rate(samples: Sequence[int]) -> float:
    if len(samples) < 2:
        return 0.0
    crossings = 0
    previous = samples[0]
    for current in samples[1:]:
        if (previous < 0 <= current) or (previous >= 0 > current):
            crossings += 1
        previous = current
    return crossings / (len(samples) - 1)


def _spectral_variation(samples: Sequence[int]) -> float:
    if len(samples) < 4:
        return 0.0
    total = 0.0
    count = 0
    for index in range(1, len(samples)):
        total += abs(samples[index] - samples[index - 1])
        count += 1
    return total / max(1, count)


def _sound_environment_label(
    energy_dbfs: Optional[float],
    pitch_hz: Optional[float],
    zero_crossing_rate: float,
    duration_s: float,
    words_per_second: float,
    text: str,
) -> str:
    text_present = bool(text.strip())

    if energy_dbfs is None or energy_dbfs <= -42:
        return "silence / low activity"
    if text_present and duration_s <= 1.0 and words_per_second <= 1.2:
        return "speech punctuated by pause"
    if text_present and pitch_hz is not None and zero_crossing_rate < 0.14:
        return "foreground speech"
    if text_present and zero_crossing_rate >= 0.14:
        return "speech with noisy background"
    if not text_present and energy_dbfs >= -20 and zero_crossing_rate < 0.1:
        return "music-like bed"
    if not text_present and energy_dbfs >= -24 and zero_crossing_rate >= 0.18:
        return "crowd / street noise"
    if zero_crossing_rate >= 0.22:
        return "traffic / textured ambience"
    return "ambient sound"


def _audio_duration_seconds(mono_pcm: bytes, sample_rate: int, sample_width: int) -> float:
    if sample_rate <= 0 or sample_width <= 0:
        return 0.0
    return len(mono_pcm) / float(sample_rate * sample_width)


def _interval_overlap_seconds(
    left_start: float,
    left_end: float,
    right_start: float,
    right_end: float,
) -> float:
    return max(0.0, min(left_end, right_end) - max(left_start, right_start))


def _has_transcript_overlap(
    start_s: float,
    end_s: float,
    transcript_segments: Sequence[Dict[str, Any]],
) -> bool:
    for segment in transcript_segments:
        segment_start = float(segment.get("start") or 0.0)
        segment_end = float(segment.get("end") or segment_start)
        if _interval_overlap_seconds(start_s, end_s, segment_start, segment_end) >= 0.08:
            return True
    return False


def _audio_event_type(
    environment_label: str,
    *,
    has_transcript: bool,
    energy_dbfs: Optional[float],
    zero_crossing_rate: float,
) -> Tuple[str, float]:
    label = environment_label.lower()
    if has_transcript and energy_dbfs is not None and energy_dbfs > -45:
        return "speech", 0.86
    if energy_dbfs is None or energy_dbfs <= -42:
        return "silence", 0.88
    if "music" in label:
        return "music", 0.74
    if any(token in label for token in ("noise", "crowd", "street", "traffic", "ambience", "ambient")):
        return "noise", 0.68
    if zero_crossing_rate >= 0.2:
        return "noise", 0.62
    return "noise", 0.52


def _merge_audio_event_intervals(intervals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not intervals:
        return []

    merged: List[Dict[str, Any]] = []
    for interval in intervals:
        if not merged:
            merged.append({**interval})
            continue
        previous = merged[-1]
        if (
            previous.get("event_type") == interval.get("event_type")
            and float(interval.get("start", 0.0)) - float(previous.get("end", 0.0)) <= 0.08
        ):
            previous["end"] = interval["end"]
            previous["duration"] = round(
                float(previous["end"]) - float(previous["start"]),
                3,
            )
            previous["confidence"] = round(
                (float(previous.get("confidence", 0.0)) + float(interval.get("confidence", 0.0))) / 2.0,
                3,
            )
            previous.setdefault("classifier_labels", [])
            previous["classifier_labels"].extend(interval.get("classifier_labels") or [])
            continue
        merged.append({**interval})

    for index, interval in enumerate(merged, start=1):
        interval["interval_id"] = f"audio-event-{index:04d}"
        labels = interval.get("classifier_labels") or []
        interval["classifier_labels"] = sorted(set(str(label) for label in labels if label))
    return merged


def _build_audio_event_intervals(
    mono_pcm: bytes,
    window: AudioWindow,
    transcript_segments: Sequence[Dict[str, Any]],
    *,
    window_seconds: float = 1.0,
) -> Dict[str, Any]:
    duration_seconds = _audio_duration_seconds(mono_pcm, window.sample_rate, window.sample_width)
    if duration_seconds <= 0:
        return {
            "schema": "vaa1.audio_event_intervals.v1",
            "method": "waveform windows plus transcript timing and prosody sound-environment classifier",
            "status": "empty",
            "duration_seconds": 0.0,
            "intervals": [],
            "summary": {"speech": 0.0, "silence": 0.0, "music": 0.0, "noise": 0.0},
        }

    raw_intervals: List[Dict[str, Any]] = []
    cursor = 0.0
    while cursor < duration_seconds:
        start_s = round(cursor, 3)
        end_s = round(min(duration_seconds, cursor + window_seconds), 3)
        segment_bytes = _slice_pcm(
            mono_pcm,
            window.sample_rate,
            window.sample_width,
            start_s,
            end_s,
        )
        sample_values = _bytes_to_int_array(segment_bytes, window.sample_width)
        rms_value = float(audioop.rms(segment_bytes, window.sample_width)) if segment_bytes else 0.0
        energy_dbfs = _energy_dbfs(rms_value, window.sample_width)
        pitch_hz = _estimate_pitch_hz(segment_bytes, window.sample_rate, window.sample_width)
        zero_crossing_rate = round(_zero_crossing_rate(sample_values), 4)
        spectral_variation = round(_spectral_variation(sample_values), 2)
        has_transcript = _has_transcript_overlap(start_s, end_s, transcript_segments)
        environment_label = _sound_environment_label(
            energy_dbfs,
            pitch_hz,
            zero_crossing_rate,
            max(0.0, end_s - start_s),
            1.0 if has_transcript else 0.0,
            "speech" if has_transcript else "",
        )
        event_type, confidence = _audio_event_type(
            environment_label,
            has_transcript=has_transcript,
            energy_dbfs=energy_dbfs,
            zero_crossing_rate=zero_crossing_rate,
        )
        raw_intervals.append(
            {
                "interval_id": "",
                "event_type": event_type,
                "start": start_s,
                "end": end_s,
                "duration": round(end_s - start_s, 3),
                "confidence": confidence,
                "source_layer": "audio_prosody.waveform_window_classifier",
                "classifier_labels": [environment_label],
                "measurements": {
                    "energy_dbfs": energy_dbfs,
                    "pitch_hz": pitch_hz,
                    "zero_crossing_rate": zero_crossing_rate,
                    "spectral_variation": spectral_variation,
                    "transcript_overlap": has_transcript,
                },
            }
        )
        cursor += window_seconds

    intervals = _merge_audio_event_intervals(raw_intervals)
    summary = {"speech": 0.0, "silence": 0.0, "music": 0.0, "noise": 0.0}
    for interval in intervals:
        event_type = str(interval.get("event_type") or "")
        if event_type in summary:
            summary[event_type] = round(summary[event_type] + float(interval.get("duration") or 0.0), 3)
    total = max(duration_seconds, 0.001)
    ratios = {
        key: round(value / total, 4)
        for key, value in summary.items()
    }
    return {
        "schema": "vaa1.audio_event_intervals.v1",
        "method": "waveform windows plus transcript timing and prosody sound-environment classifier",
        "status": "computed",
        "duration_seconds": round(duration_seconds, 3),
        "window_seconds": window_seconds,
        "intervals": intervals,
        "summary": {
            **summary,
            "ratios": ratios,
            "interval_count": len(intervals),
        },
        "governance": {
            "speech_intervals_are_supported_by_transcript_timing": True,
            "music_and_noise_are_local_classifier_candidates": True,
            "requires_review_before_mature_semantic_claims": True,
        },
    }


def _segment_word_count(text: str) -> int:
    return len(_WORD_RE.findall(text or ""))


def _normalize_emphasis(
    words_per_second: float,
    energy_dbfs: Optional[float],
    text: str,
) -> float:
    pace_score = min(1.0, max(0.0, (words_per_second - 1.5) / 3.5))
    energy_score = 0.0
    if energy_dbfs is not None:
        energy_score = min(1.0, max(0.0, (energy_dbfs + 36.0) / 18.0))

    punctuation_bonus = 0.0
    if "!" in text:
        punctuation_bonus += 0.2
    if "?" in text:
        punctuation_bonus += 0.1

    score = (pace_score * 0.35) + (energy_score * 0.55) + punctuation_bonus
    return round(min(1.0, score), 3)


def analyze_audio_prosody(
    audio_path: str | Path,
    transcript_segments: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    window = _read_audio_window(audio_path)
    mono_pcm = _mono_bytes(window)
    run_lengths = _contiguous_run_lengths(transcript_segments)

    cues: List[Dict[str, Any]] = []
    for index, segment in enumerate(transcript_segments):
        start_s = float(segment.get("start") or 0.0)
        end_s = float(segment.get("end") or 0.0)
        text = str(segment.get("text") or "").strip()
        duration_s = max(0.0, end_s - start_s)
        word_count = _segment_word_count(text)
        words_per_second = round(word_count / duration_s, 3) if duration_s > 0 else 0.0

        previous_end = (
            float(transcript_segments[index - 1].get("end") or 0.0)
            if index > 0
            else 0.0
        )
        next_start = (
            float(transcript_segments[index + 1].get("start") or end_s)
            if index + 1 < len(transcript_segments)
            else end_s
        )
        pause_before = round(max(0.0, start_s - previous_end), 3)
        pause_after = round(max(0.0, next_start - end_s), 3)
        raw_gap_before = round(start_s - previous_end, 3)
        overlap_seconds = round(abs(raw_gap_before), 3) if raw_gap_before < 0 else 0.0
        run_length = run_lengths[index] if index < len(run_lengths) else 1
        run_position = 1
        if index > 0 and run_length > 1:
            contiguous_index = index
            while contiguous_index > 0:
                earlier_end = float(transcript_segments[contiguous_index - 1].get("end") or 0.0)
                current_start_for_run = float(transcript_segments[contiguous_index].get("start") or 0.0)
                if current_start_for_run - earlier_end > 0.35:
                    break
                contiguous_index -= 1
            run_position = index - contiguous_index + 1

        segment_bytes = _slice_pcm(
            mono_pcm,
            window.sample_rate,
            window.sample_width,
            start_s,
            end_s,
        )
        sample_values = _bytes_to_int_array(segment_bytes, window.sample_width)
        rms_value = float(audioop.rms(segment_bytes, window.sample_width)) if segment_bytes else 0.0
        energy_dbfs = _energy_dbfs(rms_value, window.sample_width)
        pitch_hz = _estimate_pitch_hz(
            segment_bytes,
            window.sample_rate,
            window.sample_width,
        )
        previous_words_per_second = cues[-1]["pace"]["words_per_second"] if cues else None
        previous_pitch_hz = (
            cues[-1]["pitch_energy_contour"].get("pitch_hz")
            if cues and isinstance(cues[-1].get("pitch_energy_contour"), dict)
            else None
        )
        zero_crossing_rate = round(_zero_crossing_rate(sample_values), 4)
        spectral_variation = round(_spectral_variation(sample_values), 2)
        emphasis_score = _normalize_emphasis(words_per_second, energy_dbfs, text)
        environment_label = _sound_environment_label(
            energy_dbfs,
            pitch_hz,
            zero_crossing_rate,
            duration_s,
            words_per_second,
            text,
        )

        cues.append(
            {
                "cue_id": f"audio-prosody-{index + 1}",
                "start": round(start_s, 2),
                "end": round(end_s, 2),
                "text": text,
                "word_count": word_count,
                "pace": {
                    "words_per_second": words_per_second,
                    "label": _label_pace(words_per_second),
                },
                "pauses": {
                    "before_seconds": pause_before,
                    "after_seconds": pause_after,
                    "before_label": _label_pause(pause_before),
                    "after_label": _label_pause(pause_after),
                },
                "turn_structure": {
                    "gap_before_seconds": raw_gap_before,
                    "transition": _turn_transition_label(raw_gap_before),
                    "likely_turn_boundary": raw_gap_before >= 0.35,
                    "overlap_seconds": overlap_seconds,
                    "overlap_cue": overlap_seconds > 0,
                },
                "interaction_cues": {
                    "run_length": run_length,
                    "run_position": run_position,
                    "role_support": _role_support_label(
                        raw_gap_before,
                        run_length,
                        run_position,
                    ),
                },
                "rhythm_profile": {
                    "label": _rhythm_profile_label(
                        words_per_second,
                        previous_words_per_second,
                        pause_before,
                        emphasis_score,
                    ),
                },
                "tonality_profile": {
                    "label": _tonality_profile_label(
                        pitch_hz,
                        previous_pitch_hz,
                        energy_dbfs,
                        emphasis_score,
                    ),
                },
                "emphasis": {
                    "score": emphasis_score,
                    "label": _label_emphasis(emphasis_score),
                },
                "pitch_energy_contour": {
                    "pitch_hz": pitch_hz,
                    "energy_rms": round(rms_value, 2),
                    "energy_dbfs": energy_dbfs,
                    "label": _contour_label(pitch_hz, energy_dbfs),
                },
                "sound_environment": {
                    "label": environment_label,
                    "zero_crossing_rate": zero_crossing_rate,
                    "spectral_variation": spectral_variation,
                },
            }
        )

    return {
        "audio_file": str(audio_path),
        "cue_count": len(cues),
        "sample_rate": window.sample_rate,
        "sample_width": window.sample_width,
        "channel_count": window.channel_count,
        "cues": cues,
        "audio_event_intervals": _build_audio_event_intervals(
            mono_pcm,
            window,
            transcript_segments,
        ),
    }
