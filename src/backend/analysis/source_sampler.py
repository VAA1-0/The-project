from __future__ import annotations

import json
import importlib.util
import uuid
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

try:
    from src.backend.analysis.forensic_render import clamp_region, make_json_safe, safe_float
except ModuleNotFoundError:
    render_path = Path(__file__).with_name("forensic_render.py")
    spec = importlib.util.spec_from_file_location("forensic_render", render_path)
    forensic_render = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(forensic_render)
    clamp_region = forensic_render.clamp_region
    make_json_safe = forensic_render.make_json_safe
    safe_float = forensic_render.safe_float


VALID_SAMPLE_TYPES = {"visual", "audio", "visual_audio"}


class SourceSamplerError(ValueError):
    pass


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_source_samples(root_dir: str | Path) -> list[Dict[str, Any]]:
    samples_path = Path(root_dir) / "samples.json"
    if not samples_path.exists():
        return []
    try:
        payload = json.loads(samples_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    return [item for item in payload if isinstance(item, dict)] if isinstance(payload, list) else []


def write_source_samples(root_dir: str | Path, samples: list[Dict[str, Any]]) -> None:
    root = Path(root_dir)
    root.mkdir(parents=True, exist_ok=True)
    (root / "samples.json").write_text(
        json.dumps(make_json_safe(samples), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def write_wav_segment(
    *,
    source_audio_path: str | Path,
    output_audio_path: str | Path,
    time_start: float,
    time_end: float,
) -> Dict[str, Any]:
    source_path = Path(source_audio_path)
    if not source_path.exists():
        raise SourceSamplerError(f"Audio source does not exist: {source_path}")

    with wave.open(str(source_path), "rb") as reader:
        frame_rate = reader.getframerate()
        start_frame = max(0, int(time_start * frame_rate))
        end_frame = max(start_frame + 1, int(time_end * frame_rate))
        total_frames = reader.getnframes()
        start_frame = min(start_frame, max(0, total_frames - 1))
        end_frame = min(end_frame, total_frames)
        reader.setpos(start_frame)
        frames = reader.readframes(max(1, end_frame - start_frame))
        output_path = Path(output_audio_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(output_path), "wb") as writer:
            writer.setnchannels(reader.getnchannels())
            writer.setsampwidth(reader.getsampwidth())
            writer.setframerate(frame_rate)
            writer.writeframes(frames)

    return {
        "output_audio_path": str(output_path),
        "audio_start_frame": start_frame,
        "audio_end_frame": end_frame,
        "sample_rate": frame_rate,
    }


def write_visual_sample(
    *,
    source_video_path: str | Path,
    output_image_path: str | Path,
    time_start: float,
    region: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    import cv2

    source_path = Path(source_video_path)
    if not source_path.exists():
        raise SourceSamplerError(f"Video source does not exist: {source_path}")

    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        raise SourceSamplerError(f"Could not open source video: {source_path}")

    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        frame_index = max(0, int(time_start * fps))
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, frame = cap.read()
        if not ok or frame is None:
            raise SourceSamplerError("Could not read visual sample frame")

        resolved_region = clamp_region(
            region,
            frame_width=frame_width,
            frame_height=frame_height,
        )
        if resolved_region:
            x, y, w, h = (
                resolved_region["x"],
                resolved_region["y"],
                resolved_region["w"],
                resolved_region["h"],
            )
            frame = frame[y : y + h, x : x + w]

        output_path = Path(output_image_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        if not cv2.imwrite(str(output_path), frame):
            raise SourceSamplerError("Could not write visual sample image")

        return {
            "output_image_path": str(output_path),
            "frame_index": frame_index,
            "source_fps": fps,
            "region": resolved_region,
        }
    finally:
        cap.release()


def create_source_sample(
    *,
    analysis_id: str,
    source_video_path: str | Path,
    source_audio_path: Optional[str | Path],
    output_root: str | Path,
    request: Dict[str, Any],
) -> Dict[str, Any]:
    sample_type = str(request.get("sample_type") or "visual_audio")
    if sample_type not in VALID_SAMPLE_TYPES:
        raise SourceSamplerError(f"Unsupported source sample type: {sample_type}")

    time_start = max(0.0, safe_float(request.get("time_start"), 0.0))
    time_end = max(time_start + 0.001, safe_float(request.get("time_end"), time_start + 1.0))
    max_duration = max(0.5, safe_float(request.get("max_duration_seconds"), 30.0))
    if time_end - time_start > max_duration:
        raise SourceSamplerError(f"Source sample window exceeds {max_duration:.1f}s safety limit")

    sample_id = str(request.get("sample_id") or uuid.uuid4().hex)
    root = Path(output_root)
    sample_dir = root / sample_id
    sample_dir.mkdir(parents=True, exist_ok=True)

    visual_payload: Dict[str, Any] | None = None
    audio_payload: Dict[str, Any] | None = None
    if sample_type in {"visual", "visual_audio"}:
        visual_payload = write_visual_sample(
            source_video_path=source_video_path,
            output_image_path=sample_dir / "visual_sample.jpg",
            time_start=time_start,
            region=request.get("region"),
        )
    if sample_type in {"audio", "visual_audio"}:
        if not source_audio_path:
            raise SourceSamplerError("Analysis has no extracted WAV audio sample source")
        audio_payload = write_wav_segment(
            source_audio_path=source_audio_path,
            output_audio_path=sample_dir / "audio_sample.wav",
            time_start=time_start,
            time_end=time_end,
        )

    sample = make_json_safe(
        {
            "sample_id": sample_id,
            "analysis_id": analysis_id,
            "sample_type": sample_type,
            "requested_by": str(request.get("requested_by") or "analyst"),
            "requested_at": utc_now_iso(),
            "label": str(request.get("label") or ""),
            "purpose": str(request.get("purpose") or ""),
            "time_start": round(time_start, 6),
            "time_end": round(time_end, 6),
            "visual": visual_payload,
            "audio": audio_payload,
            "status": "completed",
            "created_at": utc_now_iso(),
        }
    )
    (sample_dir / "source_sample.json").write_text(
        json.dumps(sample, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    samples = [
        existing
        for existing in load_source_samples(root)
        if existing.get("sample_id") != sample_id
    ]
    samples.append(sample)
    samples.sort(key=lambda item: str(item.get("created_at", "")))
    write_source_samples(root, samples)
    return sample
