from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from src.backend.analysis.timestamp_schema import (
    ActivityRecord,
    Anchor,
    EvidenceObject,
    MediaRef,
    RegionBox,
    TraceEnvelope,
)


def seconds_to_ms(value: Any) -> int:
    """Normalize second-based timestamps into integer milliseconds."""
    try:
        return max(0, int(round(float(value) * 1000)))
    except (TypeError, ValueError):
        return 0


def link_transcript_to_trace(
    transcript_data: dict[str, Any],
    media_ref: MediaRef,
    *,
    created_by: str = "whisper_transcription",
    version: str = "v1",
    support_level: str | None = None,
) -> TraceEnvelope:
    """
    Convert the current VAA1 transcript JSON shape into anchored evidence.

    Input shape expected today:
    {
        "segments": [
            {"start": 0.0, "end": 1.2, "text": "..."},
            ...
        ],
        "language": "en",
        ...
    }
    """
    segments = transcript_data.get("timeline_segments") or transcript_data.get("segments") or []
    anchors: list[Anchor] = []
    objects: list[EvidenceObject] = []

    for index, segment in enumerate(segments):
        start_ms = seconds_to_ms(segment.get("start"))
        end_ms = seconds_to_ms(segment.get("end"))
        text = str(segment.get("text") or "").strip()
        segment_type = str(segment.get("segment_type") or "utterance")
        synthetic = bool(segment.get("synthetic"))

        anchor = Anchor(
            media_id=media_ref.media_id,
            t_start_ms=start_ms,
            t_end_ms=end_ms,
            anchor_type="interval" if end_ms > start_ms else "point",
        )
        anchors.append(anchor)

        utterance = EvidenceObject(
            object_type=(
                "utterance"
                if segment_type == "utterance"
                else "transcript_interval_marker"
            ),
            anchor_id=anchor.anchor_id,
            payload={
                "text": text,
                "segment_index": index,
                "segment_type": segment_type,
                "synthetic": synthetic,
                "language": transcript_data.get("language"),
                "language_name": transcript_data.get("language_name"),
                "language_info": transcript_data.get("language_info"),
                "audio_file": transcript_data.get("audio_file"),
            },
            confidence=None,
            support_level=support_level,
            created_by=created_by,
            version=version,
            raw_or_corrected="raw",
        )
        objects.append(utterance)

    activity = ActivityRecord(
        activity_type="transcript_linking",
        used=[media_ref.media_id],
        generated=[obj.id for obj in objects],
        parameters={
            "segment_count": len(objects),
            "language": transcript_data.get("language"),
            "created_by": created_by,
        },
        associated_agent=created_by,
    )

    return TraceEnvelope(
        media_ref=media_ref,
        anchors=anchors,
        objects=objects,
        activities=[activity],
    )


def link_audio_prosody_to_trace(
    audio_prosody_data: dict[str, Any],
    media_ref: MediaRef,
    *,
    created_by: str = "audio_prosody_analysis",
    version: str = "v1",
) -> TraceEnvelope:
    cues = audio_prosody_data.get("cues") or []
    anchors: list[Anchor] = []
    objects: list[EvidenceObject] = []

    for index, cue in enumerate(cues):
        start_ms = seconds_to_ms(cue.get("start"))
        end_ms = seconds_to_ms(cue.get("end"))
        anchor = Anchor(
            media_id=media_ref.media_id,
            t_start_ms=start_ms,
            t_end_ms=end_ms,
            anchor_type="interval" if end_ms > start_ms else "point",
        )
        anchors.append(anchor)
        objects.append(
            EvidenceObject(
                object_type="audio_prosody",
                anchor_id=anchor.anchor_id,
                payload={
                    "text": cue.get("text", ""),
                    "word_count": cue.get("word_count"),
                    "pace": cue.get("pace") or {},
                    "pauses": cue.get("pauses") or {},
                    "turn_structure": cue.get("turn_structure") or {},
                    "emphasis": cue.get("emphasis") or {},
                    "pitch_energy_contour": cue.get("pitch_energy_contour") or {},
                    "sound_environment": cue.get("sound_environment") or {},
                    "cue_index": index,
                },
                confidence=_safe_float((cue.get("emphasis") or {}).get("score")),
                created_by=created_by,
                version=version,
                raw_or_corrected="raw",
            )
        )

    activity = ActivityRecord(
        activity_type="audio_prosody_linking",
        used=[media_ref.media_id],
        generated=[obj.id for obj in objects],
        parameters={"cue_count": len(objects)},
        associated_agent=created_by,
    )
    return TraceEnvelope(media_ref=media_ref, anchors=anchors, objects=objects, activities=[activity])


def _safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _normalize_bbox_payload(row: dict[str, Any]) -> dict[str, float]:
    if "bbox" in row and row["bbox"]:
        try:
            raw = row["bbox"]
            if isinstance(raw, str):
                parsed = json.loads(raw)
            else:
                parsed = raw
            if isinstance(parsed, list) and len(parsed) >= 4:
                return RegionBox(
                    x=float(parsed[0]),
                    y=float(parsed[1]),
                    w=float(parsed[2]),
                    h=float(parsed[3]),
                ).model_dump()
            if isinstance(parsed, dict):
                if {"x", "y", "w", "h"}.issubset(parsed.keys()):
                    return RegionBox(
                        x=float(parsed.get("x", 0)),
                        y=float(parsed.get("y", 0)),
                        w=float(parsed.get("w", 0)),
                        h=float(parsed.get("h", 0)),
                    ).model_dump()
                if {"x1", "y1", "x2", "y2"}.issubset(parsed.keys()):
                    x1 = float(parsed.get("x1", 0))
                    y1 = float(parsed.get("y1", 0))
                    x2 = float(parsed.get("x2", x1))
                    y2 = float(parsed.get("y2", y1))
                    return RegionBox(
                        x=x1,
                        y=y1,
                        w=max(0.0, x2 - x1),
                        h=max(0.0, y2 - y1),
                    ).model_dump()
        except Exception:
            pass

    x1 = _safe_float(row.get("bbox_x1"))
    y1 = _safe_float(row.get("bbox_y1"))
    x2 = _safe_float(row.get("bbox_x2"))
    y2 = _safe_float(row.get("bbox_y2"))
    if None not in {x1, y1, x2, y2}:
        return RegionBox(
            x=x1,
            y=y1,
            w=max(0.0, x2 - x1),
            h=max(0.0, y2 - y1),
        ).model_dump()
    return {}


def _load_csv_records(csv_path: str | Path) -> list[dict[str, Any]]:
    path_obj = Path(csv_path)
    with path_obj.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def link_ocr_to_trace(
    ocr_records: list[dict[str, Any]],
    media_ref: MediaRef,
    *,
    created_by: str = "ocr_detection",
    version: str = "v1",
) -> TraceEnvelope:
    anchors: list[Anchor] = []
    objects: list[EvidenceObject] = []

    for index, row in enumerate(ocr_records):
        timestamp_ms = seconds_to_ms(row.get("timestamp"))
        anchor = Anchor(
            media_id=media_ref.media_id,
            t_start_ms=timestamp_ms,
            t_end_ms=timestamp_ms,
            anchor_type="frame_region",
            frame_index=_safe_int(row.get("frame_index")),
        )
        anchors.append(anchor)
        objects.append(
            EvidenceObject(
                object_type="ocr_region",
                anchor_id=anchor.anchor_id,
                payload={
                    "text": row.get("label") or row.get("text") or "",
                    "confidence": _safe_float(row.get("confidence")),
                    "bbox": _normalize_bbox_payload(row),
                    "row_index": index,
                },
                confidence=_safe_float(row.get("confidence")),
                created_by=created_by,
                version=version,
                raw_or_corrected="raw",
            )
        )

    activity = ActivityRecord(
        activity_type="ocr_linking",
        used=[media_ref.media_id],
        generated=[obj.id for obj in objects],
        parameters={"record_count": len(objects)},
        associated_agent=created_by,
    )
    return TraceEnvelope(media_ref=media_ref, anchors=anchors, objects=objects, activities=[activity])


def link_objects_to_trace(
    object_records: list[dict[str, Any]],
    media_ref: MediaRef,
    *,
    created_by: str = "object_detection",
    version: str = "v1",
) -> TraceEnvelope:
    anchors: list[Anchor] = []
    objects: list[EvidenceObject] = []

    for index, row in enumerate(object_records):
        timestamp_ms = seconds_to_ms(row.get("timestamp"))
        anchor = Anchor(
            media_id=media_ref.media_id,
            t_start_ms=timestamp_ms,
            t_end_ms=timestamp_ms,
            anchor_type="frame_region",
            frame_index=_safe_int(row.get("frame_index")),
        )
        anchors.append(anchor)
        objects.append(
            EvidenceObject(
                object_type="object_detection",
                anchor_id=anchor.anchor_id,
                payload={
                    "label": row.get("label") or row.get("class_name") or "",
                    "class_id": _safe_int(row.get("class_id")),
                    "bbox": _normalize_bbox_payload(row),
                    "row_index": index,
                },
                confidence=_safe_float(row.get("confidence")),
                created_by=created_by,
                version=version,
                raw_or_corrected="raw",
            )
        )

    activity = ActivityRecord(
        activity_type="object_linking",
        used=[media_ref.media_id],
        generated=[obj.id for obj in objects],
        parameters={"record_count": len(objects)},
        associated_agent=created_by,
    )
    return TraceEnvelope(media_ref=media_ref, anchors=anchors, objects=objects, activities=[activity])


def link_expressions_to_trace(
    expression_records: list[dict[str, Any]],
    media_ref: MediaRef,
    *,
    created_by: str = "expression_detection",
    version: str = "v1",
) -> TraceEnvelope:
    anchors: list[Anchor] = []
    objects: list[EvidenceObject] = []

    for index, row in enumerate(expression_records):
        timestamp_ms = seconds_to_ms(row.get("timestamp"))
        anchor = Anchor(
            media_id=media_ref.media_id,
            t_start_ms=timestamp_ms,
            t_end_ms=timestamp_ms,
            anchor_type="frame_region",
            frame_index=_safe_int(row.get("frame_index")),
        )
        anchors.append(anchor)
        objects.append(
            EvidenceObject(
                object_type="emotion_signal",
                anchor_id=anchor.anchor_id,
                payload={
                    "dominant_emotion": row.get("dominant_emotion"),
                    "emotion": row.get("emotion"),
                    "face_id": row.get("face_id"),
                    "bbox": _normalize_bbox_payload(row),
                    "error": row.get("error"),
                    "row_index": index,
                },
                confidence=_safe_float(row.get("confidence")),
                created_by=created_by,
                version=version,
                raw_or_corrected="raw",
            )
        )

    activity = ActivityRecord(
        activity_type="expression_linking",
        used=[media_ref.media_id],
        generated=[obj.id for obj in objects],
        parameters={"record_count": len(objects)},
        associated_agent=created_by,
    )
    return TraceEnvelope(media_ref=media_ref, anchors=anchors, objects=objects, activities=[activity])


def link_ocr_csv_to_trace(csv_path: str | Path, media_ref: MediaRef, **kwargs: Any) -> TraceEnvelope:
    return link_ocr_to_trace(_load_csv_records(csv_path), media_ref, **kwargs)


def link_object_csv_to_trace(csv_path: str | Path, media_ref: MediaRef, **kwargs: Any) -> TraceEnvelope:
    return link_objects_to_trace(_load_csv_records(csv_path), media_ref, **kwargs)


def link_expression_json_to_trace(
    json_path: str | Path,
    media_ref: MediaRef,
    **kwargs: Any,
) -> TraceEnvelope:
    data = json.loads(Path(json_path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        data = []
    return link_expressions_to_trace(data, media_ref, **kwargs)


def link_audio_prosody_json_to_trace(
    json_path: str | Path,
    media_ref: MediaRef,
    **kwargs: Any,
) -> TraceEnvelope:
    data = json.loads(Path(json_path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        data = {}
    return link_audio_prosody_to_trace(data, media_ref, **kwargs)
