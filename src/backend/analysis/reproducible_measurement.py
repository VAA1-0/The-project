"""Reproducible native measurements over governed VAA1 source artifacts."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable

from .evidence_quality import assess_evidence_quality, evaluate_quality_use
from .execution_graph_planner import load_execution_graph, plan_affected_branches


SCHEMA = "vaa1.measurement_run.v1"
METHOD_VERSION = "native_core_measurements.1.1.0"


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _fingerprint(value: Any) -> str:
    return hashlib.sha256(value if isinstance(value, bytes) else _canonical(value)).hexdigest()


def _read(path: Path) -> Any:
    value = json.loads(path.read_text(encoding="utf-8"))
    return value


def _atomic_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _interval(item: Dict[str, Any]) -> tuple[float, float] | None:
    raw = item.get("interval") if isinstance(item.get("interval"), dict) else item
    try:
        start, end = float(raw.get("start_seconds", raw.get("start"))), float(raw.get("end_seconds", raw.get("end")))
    except (TypeError, ValueError):
        return None
    return (start, end) if start >= 0 and end > start else None


def _union_duration(intervals: Iterable[tuple[float, float]], limit: float) -> float:
    valid = sorted((max(0.0, a), min(limit, b)) for a, b in intervals if b > 0 and a < limit)
    merged: list[list[float]] = []
    for start, end in valid:
        if end <= start:
            continue
        if not merged or start > merged[-1][1]:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    return sum(end - start for start, end in merged)


def _quality(ref: str, modality: str, timing: str = "canonical") -> Dict[str, Any]:
    profiles = {
        "transcript": dict(clarity=.8, audibility=.7, temporal_precision=.9, completeness=.75, transcription_quality=.8, assignment_stability=.55),
        "audio": dict(clarity=.65, audibility=.8, temporal_precision=.95, completeness=.85, assignment_stability=.5),
        "scene": dict(clarity=.65, temporal_precision=.7, completeness=.6, representativeness=.7, assignment_stability=.6),
        "object": dict(clarity=.6, occlusion_control=.45, temporal_precision=.75, completeness=.55, representativeness=.55, assignment_stability=.6),
        "ocr": dict(clarity=.55, occlusion_control=.5, temporal_precision=.8, completeness=.5, transcription_quality=.6, assignment_stability=.55),
        "expression": dict(clarity=.5, occlusion_control=.45, temporal_precision=.8, completeness=.45, representativeness=.4, assignment_stability=.45),
        "prosody": dict(clarity=.65, audibility=.75, temporal_precision=.7, completeness=.65, representativeness=.6, assignment_stability=.55),
        "shot": dict(clarity=.75, temporal_precision=.9, completeness=.8, representativeness=.8, assignment_stability=.75),
    }
    dimensions = profiles[modality]
    if timing != "canonical":
        dimensions["temporal_precision"] = min(dimensions.get("temporal_precision", 1), .45)
    assessment = assess_evidence_quality({"evidence_ref": ref, "dimensions": dimensions})
    return {
        "assessment": assessment,
        "uses": {name: evaluate_quality_use(assessment, name) for name in (
            "inspect", "descriptive_measurement", "comparative_inference", "proposition_candidate", "mature_projection"
        )},
    }


class ReproducibleMeasurementService:
    """Creates a deterministic-content measurement run and source-traceable findings."""

    def __init__(self, analysis_id: str, analysis_dir: Path, output_root: Path | None = None):
        self.analysis_id = analysis_id
        self.analysis_dir = Path(analysis_dir)
        self.output_root = Path(output_root or self.analysis_dir.parents[1])

    def _sources(self) -> Dict[str, Path]:
        choices = {
            "transcript": [
                self.output_root / "transcripts" / f"{self.analysis_id}_transcript.json",
                self.output_root / "transcripts" / f"{self.analysis_id}_transcript_raw_whisper.json",
            ],
            "diarization": [self.output_root / "transcripts" / f"{self.analysis_id}_audio_diarization.json"],
            "metadata": [self.analysis_dir / "source_media_metadata.json"],
            "master_schema": [self.analysis_dir / "vaa1_annotation_master_schema.json"],
            "scene_cards": [self.analysis_dir / "mise_en_scene_scene_cards.json"],
            "analysis_record": [self.analysis_dir / "analysis_record.json"],
        }
        resolved = {name: next((path for path in paths if path.exists()), paths[0]) for name, paths in choices.items()}
        record = _read(resolved["analysis_record"]) if resolved["analysis_record"].exists() else {}
        output_files = record.get("output_files", {}) if isinstance(record, dict) else {}
        dynamic = {
            "objects": "tracked_objects_json",
            "ocr": "time_bank_ocr",
            "expressions": "expression_json",
            "prosody": "audio_prosody",
            "shot_boundaries": "shot_boundaries",
            "camera_composition": "camera_composition",
        }
        for role, key in dynamic.items():
            candidate = Path(str(output_files.get(key) or self.analysis_dir / f"{role}.json"))
            resolved[role] = candidate
        return resolved

    def run(self, *, persist: bool = True, parameters: Dict[str, Any] | None = None) -> Dict[str, Any]:
        parameters = {"clock_basis": "source_media_seconds", **(parameters or {})}
        paths = self._sources()
        available = {name: _read(path) for name, path in paths.items() if path.exists()}
        manifests = [{
            "role": name,
            "path": str(path),
            "sha256": _fingerprint(path.read_bytes()) if path.exists() else None,
            "available": path.exists(),
        } for name, path in paths.items()]
        metadata = available.get("metadata", {})
        diarization = available.get("diarization", {})
        transcript = available.get("transcript", {})
        master = available.get("master_schema", {})
        duration = float(metadata.get("duration_seconds") or diarization.get("measurement", {}).get("duration_seconds") or 0)
        exclusions: list[Dict[str, Any]] = []

        def valid_rows(role: str, rows: list[Dict[str, Any]]) -> list[tuple[Dict[str, Any], tuple[float, float]]]:
            output = []
            for index, row in enumerate(rows):
                interval = _interval(row)
                if not interval or (duration and interval[0] >= duration):
                    exclusions.append({"source": role, "row": index, "reason": "invalid_or_out_of_scope_interval"})
                else:
                    output.append((row, interval))
            return output

        segments = valid_rows("transcript", list(transcript.get("segments") or []))
        turns = valid_rows("diarization.speaker_turns", list(diarization.get("speaker_turns") or []))
        vad = valid_rows("diarization.vad_segments", list(diarization.get("vad_segments") or []))
        scenes = valid_rows("master_schema.temporal_segments", [x for x in master.get("temporal_segments", []) if x.get("segment_type") == "scene"])
        objects_raw = available.get("objects", [])
        objects = objects_raw if isinstance(objects_raw, list) else list(objects_raw.get("tracked_objects") or objects_raw.get("items") or [])
        object_rows = []
        for index, row in enumerate(objects):
            try:
                timestamp = float(row.get("timestamp", row.get("start_timestamp")))
                confidence = float(row.get("confidence")) if row.get("confidence") is not None else None
            except (TypeError, ValueError):
                exclusions.append({"source": "objects", "row": index, "reason": "invalid_timestamp_or_confidence"})
                continue
            if timestamp < 0 or (duration and timestamp > duration):
                exclusions.append({"source": "objects", "row": index, "reason": "out_of_scope_timestamp"})
                continue
            object_rows.append((row, timestamp, confidence))

        ocr_raw = available.get("ocr", {})
        anchors = {str(item.get("anchor_id")): item for item in ocr_raw.get("anchors", [])} if isinstance(ocr_raw, dict) else {}
        ocr_rows = []
        for index, row in enumerate(ocr_raw.get("objects", []) if isinstance(ocr_raw, dict) else []):
            anchor = anchors.get(str(row.get("anchor_id")), {})
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            text = str(payload.get("text") or "").strip()
            try:
                timestamp = float(anchor.get("t_start_ms")) / 1000
            except (TypeError, ValueError):
                exclusions.append({"source": "ocr", "row": index, "reason": "missing_anchor_time"})
                continue
            if not text:
                exclusions.append({"source": "ocr", "row": index, "reason": "empty_text"})
                continue
            ocr_rows.append((row, timestamp, text))

        expressions_raw = available.get("expressions", [])
        expressions = expressions_raw if isinstance(expressions_raw, list) else list(expressions_raw.get("items") or [])
        expression_rows = []
        for index, row in enumerate(expressions):
            try:
                timestamp = float(row.get("timestamp"))
            except (TypeError, ValueError):
                exclusions.append({"source": "expressions", "row": index, "reason": "missing_timestamp"})
                continue
            if timestamp < 0 or (duration and timestamp > duration):
                exclusions.append({"source": "expressions", "row": index, "reason": "out_of_scope_timestamp"})
                continue
            expression_rows.append((row, timestamp))

        prosody_raw = available.get("prosody", {})
        prosody = valid_rows("prosody.cues", list(prosody_raw.get("cues") or [])) if isinstance(prosody_raw, dict) else []
        shots = valid_rows("shot_boundaries", list(available.get("shot_boundaries", {}).get("intervals") or [])) if isinstance(available.get("shot_boundaries"), dict) else []
        words = re.findall(r"\b[\w']+\b", " ".join(str(row.get("text") or "") for row, _ in segments).lower())
        speaker_seconds: Counter[str] = Counter()
        for row, (start, end) in turns:
            speaker_seconds[str(row.get("speaker_label") or "unassigned")] += end - start
        speech_seconds = _union_duration((interval for _, interval in vad), duration) if duration else 0
        measurements = {
            "media_duration_seconds": round(duration, 6),
            "transcript": {"segment_count": len(segments), "word_count": len(words), "unique_word_count": len(set(words)), "top_terms": Counter(words).most_common(20)},
            "speaker_turns": {"turn_count": len(turns), "cluster_count": len(speaker_seconds), "duration_by_cluster_seconds": {k: round(v, 6) for k, v in sorted(speaker_seconds.items())}},
            "voice_activity": {"segment_count": len(vad), "speech_seconds": round(speech_seconds, 6), "silence_seconds": round(max(0, duration - speech_seconds), 6), "speech_ratio": round(speech_seconds / duration, 6) if duration else None},
            "scenes": {"scene_count": len(scenes), "durations_seconds": [round(end - start, 6) for _, (start, end) in scenes]},
            "objects": {
                "status": "measured" if paths["objects"].exists() else "unavailable",
                "detection_count": len(object_rows),
                "track_count": len({str(row.get("track_id")) for row, _, _ in object_rows if row.get("track_id") is not None}),
                "class_counts": dict(sorted(Counter(str(row.get("class_name") or "unassigned") for row, _, _ in object_rows).items())),
                "mean_confidence": round(sum(value for _, _, value in object_rows if value is not None) / max(1, sum(value is not None for _, _, value in object_rows)), 6),
            },
            "ocr": {
                "status": "measured" if paths["ocr"].exists() else "unavailable",
                "region_count": len(ocr_rows), "unique_text_count": len({text.casefold() for _, _, text in ocr_rows}),
                "surfaced_text": [text for _, _, text in ocr_rows[:30]],
            },
            "expressions": {
                "status": "measured" if paths["expressions"].exists() else "unavailable",
                "sample_count": len(expression_rows),
                "face_present_count": sum((row.get("face_signal") or {}).get("level") != "absent" for row, _ in expression_rows),
                "expression_ready_count": sum(bool((row.get("expression_evidence") or {}).get("dominant_emotion_ready")) for row, _ in expression_rows),
                "quality_counts": dict(sorted(Counter(str(row.get("quality") or "unassessed") for row, _ in expression_rows).items())),
            },
            "prosody": {
                "status": "measured" if paths["prosody"].exists() else "unavailable",
                "cue_count": len(prosody),
                "mean_words_per_second": round(sum(float((row.get("pace") or {}).get("words_per_second") or 0) for row, _ in prosody) / len(prosody), 6) if prosody else None,
                "emphasis_counts": dict(sorted(Counter(str((row.get("emphasis") or {}).get("label") or "unassessed") for row, _ in prosody).items())),
            },
            "shot_boundaries": {"status": "measured" if paths["shot_boundaries"].exists() else "unavailable", "interval_count": len(shots), "reason": None if paths["shot_boundaries"].exists() else "No registered measured shot-boundary artifact."},
            "camera_composition": {"status": "measured" if paths["camera_composition"].exists() else "unavailable", "reason": None if paths["camera_composition"].exists() else "No registered measured camera-composition artifact."},
        }
        quality = {
            "transcript": _quality("artifact:transcript", "transcript", str(transcript.get("timing_authority") or "canonical")),
            "voice_and_speakers": _quality("artifact:diarization", "audio", str(diarization.get("measurement", {}).get("transcript_timing_authority", {}).get("strategy") or "canonical")),
            "scenes": _quality("artifact:master_schema:scenes", "scene"),
            "objects": _quality("artifact:tracked_objects", "object"),
            "ocr": _quality("artifact:ocr", "ocr"),
            "expressions": _quality("artifact:expressions", "expression"),
            "prosody": _quality("artifact:audio_prosody", "prosody"),
            "shot_boundaries": _quality("artifact:shot_boundaries", "shot"),
        }
        reproducible_content = {
            "schema": SCHEMA, "analysis_id": self.analysis_id, "method": {"id": "native_core_measurements", "version": METHOD_VERSION},
            "parameters": parameters, "inputs": manifests, "analytical_unit": "source media with canonical temporal intervals",
            "measurements": measurements, "exclusions": exclusions, "evidence_quality": quality,
            "limitations": [
                "Speaker labels identify acoustic clusters, not people, unless separately confirmed.",
                "Scene intervals are measured as registered boundaries; they do not by themselves establish interpretive meaning.",
                "Descriptive measurements remain visible even when evidence quality limits comparative or mature use.",
                "Object classes, OCR strings, facial-expression samples, and prosodic cues remain detector observations unless governed confirmation adds semantic authority.",
                "Unavailable shot or camera-composition evidence is reported and is not synthesized from scene or metadata proxies.",
            ],
        }
        content_fingerprint = _fingerprint(reproducible_content)
        run_id = f"native-core-{content_fingerprint[:16]}"
        plan = plan_affected_branches(load_execution_graph(), ["measurement_run_service"])
        findings = self._findings(run_id, measurements, manifests, quality)
        run = {**reproducible_content, "run_id": run_id, "content_fingerprint": content_fingerprint,
               "created_at": datetime.now(timezone.utc).isoformat(), "status": "completed", "affected_branch_plan": plan,
               "native_finding_refs": [item["finding_id"] for item in findings]}
        if persist:
            directory = self.analysis_dir / "stats_runs" / run_id
            _atomic_json(directory / "measurement_run.json", run)
            _atomic_json(directory / "native_findings.json", {"schema": "vaa1.native_findings.v1", "run_id": run_id, "findings": findings})
        return {"measurement_run": run, "native_findings": findings, "persisted": persist}

    def _findings(self, run_id: str, measurements: Dict[str, Any], inputs: list[Dict[str, Any]], quality: Dict[str, Any]) -> list[Dict[str, Any]]:
        specs = [
            ("transcript_extent", measurements["transcript"], "transcript"),
            ("speaker_turn_extent", measurements["speaker_turns"], "voice_and_speakers"),
            ("voice_activity_extent", measurements["voice_activity"], "voice_and_speakers"),
            ("scene_interval_extent", measurements["scenes"], "scenes"),
            ("object_detection_extent", measurements["objects"], "objects"),
            ("ocr_extent", measurements["ocr"], "ocr"),
            ("expression_sampling_extent", measurements["expressions"], "expressions"),
            ("prosody_extent", measurements["prosody"], "prosody"),
            ("shot_boundary_extent", measurements["shot_boundaries"], "shot_boundaries"),
        ]
        return [{
            "schema": "vaa1.native_finding.v1", "finding_id": f"finding-{_fingerprint([run_id, name])[:16]}",
            "run_id": run_id, "finding_type": "descriptive_measurement", "label": name,
            "value": value, "evidence_refs": [item["path"] for item in inputs if item["available"]],
            "quality_ref": quality[qkey]["assessment"]["evidence_ref"], "authority": "computed_native_measurement",
            "maturity": "native_finding", "interpretation_status": "not_interpreted",
        } for name, value, qkey in specs]
