"""Persisted research-question plans and governed StatsKit result projections."""

from __future__ import annotations

import hashlib
import json
import math
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


SCHEMA = "vaa1.stats_research_question_workflow.v1"
MOTOR_SPECS = {
    "expression_prosody": {
        "label": "Expressions and vocal delivery",
        "question": "How do detected expressions vary with vocal emphasis and speech rate across scenes?",
        "unit": "governed_scene",
        "method": "spearman_rank_correlation",
        "variables": ["expression_label_diversity", "mean_vocal_emphasis", "mean_speech_rate"],
        "required_layers": ["scene_intervals", "expression_detections", "audio_prosody"],
    },
    "expression_transcript": {
        "label": "Expressions and transcript",
        "question": "How do detected expressions vary with wording density, questions, and negation across scenes?",
        "unit": "governed_scene", "method": "spearman_rank_correlation",
        "variables": ["expression_label_diversity", "transcript_word_rate", "question_utterance_ratio", "negation_token_ratio"],
        "required_layers": ["scene_intervals", "expression_detections", "transcript"],
    },
    "sfl_prosody": {
        "label": "SFL and vocal delivery",
        "question": "How do modality and proposals vary with vocal emphasis and speech rate across scenes?",
        "unit": "governed_scene", "method": "spearman_rank_correlation",
        "variables": ["sfl_modality_ratio", "sfl_proposal_ratio", "mean_vocal_emphasis", "mean_speech_rate"],
        "required_layers": ["scene_intervals", "sfl_analysis", "audio_prosody"],
    },
    "props_sfl": {
        "label": "Props and SFL processes",
        "question": "How do visible props vary with material processes and proposals across scenes?",
        "unit": "governed_scene", "method": "spearman_rank_correlation",
        "variables": ["prop_occurrence_rate", "prop_label_diversity", "sfl_material_process_ratio", "sfl_proposal_ratio"],
        "required_layers": ["scene_intervals", "object_detections", "sfl_analysis"],
    },
    "transcript_prosody": {
        "label": "Transcript and vocal emphasis",
        "question": "How does spoken-word density vary with vocal emphasis across scenes?",
        "unit": "governed_scene", "method": "spearman_rank_correlation",
        "variables": ["transcript_word_rate", "mean_vocal_emphasis"],
        "required_layers": ["scene_intervals", "transcript", "audio_prosody"],
    },
}


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _stable_id(prefix: str, value: Any) -> str:
    return f"{prefix}-{hashlib.sha256(_canonical(value)).hexdigest()[:20]}"


def _atomic_json(path: Path, value: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class StatsResearchQuestionService:
    """Own the question -> plan -> run -> result -> proposition -> sentence path."""

    def __init__(self, analysis_id: str, analysis_dir: str | Path):
        self.analysis_id = analysis_id
        self.analysis_dir = Path(analysis_dir)
        self.path = self.analysis_dir / "stats_research_question_workflow.json"

    def load(self) -> Dict[str, Any]:
        if not self.path.exists():
            return {"schema": SCHEMA, "analysis_id": self.analysis_id, "plans": [], "runs": []}
        value = json.loads(self.path.read_text(encoding="utf-8"))
        if value.get("schema") != SCHEMA or value.get("analysis_id") != self.analysis_id:
            raise ValueError("Stats research-question workflow identity does not match the analysis")
        return value

    def create_plan(self, payload: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        motor = str(payload.get("motor") or "expression_prosody")
        if motor not in MOTOR_SPECS:
            raise ValueError(f"Unsupported Stats motor: {motor}")
        spec = MOTOR_SPECS[motor]
        question = str(payload.get("research_question") or spec["question"]).strip()
        if not question:
            raise ValueError("research_question is required")
        scope = str(payload.get("scope") or "video")
        if scope not in {"scene", "video", "collection"}:
            raise ValueError("scope must be scene, video, or collection")
        core = {
            "analysis_id": self.analysis_id,
            "research_question": question,
            "motor": motor,
            "motor_label": spec["label"],
            "scope": scope,
            "analytical_unit": spec["unit"],
            "method": spec["method"],
            "variables": list(spec["variables"]),
            "required_source_layers": list(spec["required_layers"]),
            "output_consumers": ["stats_workbench", "visualization", "significance_workbench", "report_writing"],
        }
        plan = {
            "schema": "vaa1.stats_analysis_plan.v1",
            "plan_id": _stable_id("stats-plan", core),
            **core,
            "status": "validated",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        workflow = self.load()
        workflow["plans"] = [item for item in workflow["plans"] if item.get("plan_id") != plan["plan_id"]]
        workflow["plans"].append(plan)
        if persist:
            _atomic_json(self.path, workflow)
        return plan

    def record_run(self, plan: Dict[str, Any], native_run: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        relationships = [
            row for row in native_run.get("relationships", [])
            if isinstance(row, dict)
            and row.get("coupling") == plan["motor"]
            and isinstance(row.get("coefficient"), (int, float))
            and math.isfinite(float(row["coefficient"]))
        ]
        if not relationships:
            diagnostics = [
                row for row in native_run.get("relationship_diagnostics", [])
                if isinstance(row, dict) and row.get("coupling") == plan["motor"]
            ]
            reason = diagnostics[0].get("reason") if diagnostics else "No measured relationship was returned for the selected motor."
            raise ValueError(str(reason))

        results = []
        for relationship in relationships:
            coefficient = float(relationship["coefficient"])
            paired = list(relationship.get("paired_observations") or [])
            evidence = []
            for row in paired:
                evidence.append({
                    "scene_ref": row.get("scene_ref"),
                    "source_interval": {
                        "source_media_id": self.analysis_id,
                        "clock_id": "source_media.clock",
                        "start_seconds": row.get("start_seconds"),
                        "end_seconds": row.get("end_seconds"),
                        "timing_status": "measured",
                    },
                    "left_value": row.get("left_value"),
                    "right_value": row.get("right_value"),
                })
            result_core = {
                "plan_ref": plan["plan_id"],
                "native_relationship_ref": relationship.get("relationship_id"),
                "left_variable": relationship.get("left_metric"),
                "right_variable": relationship.get("right_metric"),
                "method": relationship.get("method"),
                "coefficient": coefficient,
                "sample_size": int(relationship.get("scene_count") or len(paired)),
            }
            result_id = _stable_id("stats-result", result_core)
            proposition = str(relationship.get("substantive_reading") or relationship.get("interpretation") or "").strip()
            results.append({
                "schema": "vaa1.governed_statistical_result.v1",
                "result_id": result_id,
                **result_core,
                "direction": relationship.get("direction"),
                "association_strength": relationship.get("strength_label"),
                "uncertainty": {"status": "unavailable", "reason": "This descriptive scene-level run does not estimate a confidence interval."},
                "statistical_significance": {"status": "not_tested"},
                "evidence": evidence,
                "proposition": {
                    "proposition_id": _stable_id("stats-proposition", [result_id, proposition]),
                    "text": proposition,
                    "status": "analyst_review_candidate",
                    "analytical_frames": relationship.get("analytical_frames") or {},
                },
                "visualization": {
                    "chart": "paired_scene_scatterplot",
                    "x_variable": relationship.get("left_metric"),
                    "y_variable": relationship.get("right_metric"),
                    "points": evidence,
                    "source_navigation": "source_interval",
                },
                "report_sentence": {
                    "text": proposition,
                    "status": "draft_from_measured_result",
                    "result_refs": [result_id],
                    "source_scene_refs": [item.get("scene_ref") for item in evidence if item.get("scene_ref")],
                },
                "status": "computed",
            })
        run_core = {"plan_ref": plan["plan_id"], "native_run_ref": native_run.get("run_id"), "result_refs": [item["result_id"] for item in results]}
        run = {
            "schema": "vaa1.stats_analysis_run.v1",
            "run_id": _stable_id("stats-question-run", run_core),
            **run_core,
            "analysis_id": self.analysis_id,
            "status": "computed",
            "results": results,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        workflow = self.load()
        if not any(item.get("plan_id") == plan["plan_id"] for item in workflow["plans"]):
            workflow["plans"].append(plan)
        workflow["runs"] = [item for item in workflow["runs"] if item.get("run_id") != run["run_id"]]
        workflow["runs"].append(run)
        if persist:
            _atomic_json(self.path, workflow)
        return {"plan": plan, "run": run}
