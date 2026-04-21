"""Traceback records for derived VAA1 forensic artifacts.

The traceback layer is intentionally plain JSON: it records where an artifact
came from, which evidence was adopted, how it can be reproduced, and what
limitations should stay visible to the analyst.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Optional


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: str | Path) -> Optional[str]:
    file_path = Path(path)
    if not file_path.exists() or not file_path.is_file():
        return None

    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _compact_ref_ids(items: Iterable[Any], fallback_prefix: str) -> list[str]:
    refs: list[str] = []
    for index, item in enumerate(items):
        if isinstance(item, dict):
            raw = (
                item.get("id")
                or item.get("sample_id")
                or item.get("render_job_id")
                or item.get("track_id")
                or item.get("trackId")
                or item.get("timestamp")
                or item.get("time")
            )
        else:
            raw = None
        refs.append(str(raw) if raw not in (None, "") else f"{fallback_prefix}_{index}")
    return refs


def build_traceback_warnings(job: Dict[str, Any]) -> list[Dict[str, str]]:
    warnings: list[Dict[str, str]] = []
    region_type = str(job.get("region_type") or "full_frame")
    region_track = _safe_list(job.get("region_track"))
    adopted_context = job.get("adopted_context") if isinstance(job.get("adopted_context"), dict) else {}

    if region_type == "tracked_box" and len(region_track) < 2:
        warnings.append(
            {
                "code": "tracked_roi_has_fewer_than_two_keyframes",
                "message": "Tracked ROI render has fewer than two keyframes; motion fit may behave like a static crop.",
            }
        )

    if region_type == "static_box" and job.get("time_end", 0) != job.get("time_start", 0):
        duration = float(job.get("time_end") or 0) - float(job.get("time_start") or 0)
        if duration > 2.0:
            warnings.append(
                {
                    "code": "static_roi_over_multi_second_window",
                    "message": "Static ROI spans more than two seconds; moving targets can leave the box.",
                }
            )

    object_refs = _safe_list(
        adopted_context.get("object_refs") or adopted_context.get("object_track_refs")
    )
    if region_type in {"static_box", "tracked_box"} and not object_refs:
        warnings.append(
            {
                "code": "roi_has_no_adopted_object_refs",
                "message": "No overlapping object references were adopted for this ROI window.",
            }
        )

    return warnings


def build_traceback_record(
    job: Dict[str, Any],
    *,
    artifact_type: str = "forensic_render",
    known_limitations: Optional[list[str]] = None,
) -> Dict[str, Any]:
    adopted_context = job.get("adopted_context") if isinstance(job.get("adopted_context"), dict) else {}
    output_video_path = job.get("output_video_path")
    output_json_path = job.get("output_json_path")

    evidence_chain = {
        "input_evidence_ids": _safe_list(job.get("input_evidence_ids")),
        "metadata_refs": _compact_ref_ids(_safe_list(adopted_context.get("metadata_refs")), "metadata"),
        "manual_annotation_refs": _compact_ref_ids(
            _safe_list(adopted_context.get("manual_annotation_refs")),
            "manual_annotation",
        ),
        "identity_refs": _compact_ref_ids(_safe_list(adopted_context.get("identity_refs")), "identity"),
        "object_refs": _compact_ref_ids(
            _safe_list(adopted_context.get("object_refs") or adopted_context.get("object_track_refs")),
            "object",
        ),
        "ocr_refs": _compact_ref_ids(_safe_list(adopted_context.get("ocr_refs")), "ocr"),
        "transcript_refs": _compact_ref_ids(
            _safe_list(adopted_context.get("transcript_refs")),
            "transcript",
        ),
    }

    return {
        "traceback_schema": "vaa1.traceback_record.v1",
        "artifact_id": str(job.get("render_job_id") or ""),
        "artifact_type": artifact_type,
        "analysis_id": str(job.get("analysis_id") or ""),
        "created_at": utc_now_iso(),
        "source": {
            "source_video_path": str(job.get("source_video_path") or ""),
            "time_start": job.get("time_start"),
            "time_end": job.get("time_end"),
            "frame_start": job.get("frame_start"),
            "frame_end": job.get("frame_end"),
        },
        "region": {
            "region_type": job.get("region_type") or "full_frame",
            "region_intent": job.get("region_intent") or "",
            "region": job.get("region"),
            "region_track": _safe_list(job.get("region_track")),
        },
        "render_parameters": {
            "mode": job.get("mode"),
            "source_fps": job.get("source_fps"),
            "target_fps": job.get("target_fps"),
            "frame_stride": job.get("frame_stride"),
            "rendered_frames": job.get("rendered_frames"),
            "requested_by": job.get("requested_by"),
            "reason": job.get("reason") or "",
        },
        "evidence_chain": evidence_chain,
        "adopted_context_counts": {
            key: len(value)
            for key, value in evidence_chain.items()
            if isinstance(value, list)
        },
        "reproducibility": {
            "output_video_path": str(output_video_path or ""),
            "output_video_sha256": sha256_file(output_video_path) if output_video_path else None,
            "output_json_path": str(output_json_path or ""),
            "output_json_sha256": sha256_file(output_json_path) if output_json_path else None,
        },
        "warnings": build_traceback_warnings(job),
        "known_limitations": known_limitations or [],
    }


def write_traceback_record(
    job: Dict[str, Any],
    output_path: str | Path,
    *,
    artifact_type: str = "forensic_render",
    known_limitations: Optional[list[str]] = None,
) -> Dict[str, Any]:
    record = build_traceback_record(
        job,
        artifact_type=artifact_type,
        known_limitations=known_limitations,
    )
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    return record
