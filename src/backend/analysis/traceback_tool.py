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


def build_traceback_tree(record: Dict[str, Any]) -> Dict[str, Any]:
    """Build a navigable node/edge view from a traceback record.

    The tree is deliberately JSON-first so the frontend can later render it as a
    tree, graph, or drawer without reinterpreting forensic provenance.
    """

    artifact_id = str(record.get("artifact_id") or "artifact")
    analysis_id = str(record.get("analysis_id") or "")
    source = record.get("source") if isinstance(record.get("source"), dict) else {}
    region = record.get("region") if isinstance(record.get("region"), dict) else {}
    render_parameters = (
        record.get("render_parameters")
        if isinstance(record.get("render_parameters"), dict)
        else {}
    )
    evidence_chain = (
        record.get("evidence_chain")
        if isinstance(record.get("evidence_chain"), dict)
        else {}
    )

    nodes: list[Dict[str, Any]] = []
    edges: list[Dict[str, str]] = []

    def add_node(node_id: str, node_type: str, label: str, payload: Dict[str, Any]) -> None:
        if any(node["id"] == node_id for node in nodes):
            return
        nodes.append(
            {
                "id": node_id,
                "type": node_type,
                "label": label,
                "payload": payload,
            }
        )

    def add_edge(source_id: str, target_id: str, relation: str) -> None:
        edge = {"source": source_id, "target": target_id, "relation": relation}
        if edge not in edges:
            edges.append(edge)

    artifact_node_id = f"artifact:{artifact_id}"
    source_node_id = f"source:{analysis_id or artifact_id}"
    time_node_id = f"time:{artifact_id}"
    region_node_id = f"region:{artifact_id}"
    render_node_id = f"render:{artifact_id}"
    warning_root_id = f"warnings:{artifact_id}"
    limitation_root_id = f"limitations:{artifact_id}"

    add_node(
        artifact_node_id,
        "artifact",
        str(record.get("artifact_type") or "artifact"),
        {
            "artifact_id": artifact_id,
            "artifact_type": record.get("artifact_type"),
            "created_at": record.get("created_at"),
            "reproducibility": record.get("reproducibility") or {},
        },
    )
    add_node(
        source_node_id,
        "source_media",
        "Source media",
        {
            "analysis_id": analysis_id,
            "source_video_path": source.get("source_video_path"),
        },
    )
    add_node(
        time_node_id,
        "time_window",
        "Source time window",
        {
            "time_start": source.get("time_start"),
            "time_end": source.get("time_end"),
            "frame_start": source.get("frame_start"),
            "frame_end": source.get("frame_end"),
        },
    )
    add_node(region_node_id, "region", "Rendered region", region)
    add_node(render_node_id, "render_parameters", "Render parameters", render_parameters)

    add_edge(source_node_id, time_node_id, "contains_time_window")
    add_edge(time_node_id, region_node_id, "localizes_region")
    add_edge(region_node_id, artifact_node_id, "renders_artifact")
    add_edge(render_node_id, artifact_node_id, "produces_artifact")

    for chain_key, refs in evidence_chain.items():
        if not isinstance(refs, list):
            continue
        group_node_id = f"evidence_group:{artifact_id}:{chain_key}"
        add_node(
            group_node_id,
            "evidence_group",
            chain_key,
            {"chain_key": chain_key, "count": len(refs)},
        )
        add_edge(group_node_id, artifact_node_id, "supports_artifact")
        for index, ref in enumerate(refs):
            ref_id = str(ref)
            evidence_node_id = f"evidence:{chain_key}:{ref_id}"
            add_node(
                evidence_node_id,
                "evidence_ref",
                ref_id,
                {"chain_key": chain_key, "ref_id": ref_id, "index": index},
            )
            add_edge(evidence_node_id, group_node_id, "belongs_to_group")

    warnings = record.get("warnings") if isinstance(record.get("warnings"), list) else []
    if warnings:
        add_node(warning_root_id, "warning_group", "Traceback warnings", {"count": len(warnings)})
        add_edge(warning_root_id, artifact_node_id, "qualifies_artifact")
        for index, warning in enumerate(warnings):
            if not isinstance(warning, dict):
                continue
            warning_node_id = f"warning:{artifact_id}:{index}"
            add_node(
                warning_node_id,
                "warning",
                str(warning.get("code") or f"warning_{index}"),
                warning,
            )
            add_edge(warning_node_id, warning_root_id, "belongs_to_group")

    limitations = (
        record.get("known_limitations")
        if isinstance(record.get("known_limitations"), list)
        else []
    )
    if limitations:
        add_node(
            limitation_root_id,
            "limitation_group",
            "Known limitations",
            {"count": len(limitations)},
        )
        add_edge(limitation_root_id, artifact_node_id, "qualifies_artifact")
        for index, limitation in enumerate(limitations):
            limitation_node_id = f"limitation:{artifact_id}:{index}"
            add_node(
                limitation_node_id,
                "limitation",
                f"Limitation {index + 1}",
                {"text": str(limitation)},
            )
            add_edge(limitation_node_id, limitation_root_id, "belongs_to_group")

    return {
        "traceback_tree_schema": "vaa1.traceback_tree.v1",
        "analysis_id": analysis_id,
        "artifact_id": artifact_id,
        "root_node_id": artifact_node_id,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "nodes": nodes,
        "edges": edges,
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


def write_traceback_tree(record: Dict[str, Any], output_path: str | Path) -> Dict[str, Any]:
    tree = build_traceback_tree(record)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(tree, indent=2, ensure_ascii=False), encoding="utf-8")
    return tree
