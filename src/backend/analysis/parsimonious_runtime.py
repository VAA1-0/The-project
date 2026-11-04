"""Persistent, content-addressed decision runtime for Datascene.

The store indexes immutable JSON artifacts in SQLite. Candidate services can
write evidence, features and proposals; only explicit analyst decisions may be
canonical. Reuse requires an exact compatibility key and invalidation is
append-only. Corrections enter a governed learning quarantine independently of
their immediate authority in the current analysis.
"""
from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import sqlite3
from typing import Any, Iterable, Mapping, Optional
import uuid


SCHEMA_VERSION = "vaa1.parsimonious_runtime.v1"
SCORE_SEMANTICS = {
    "deterministic_rule",
    "similarity_score",
    "uncalibrated_model_score",
    "calibrated_probability",
    "conformal_prediction_set",
    "analyst_decision",
}
LEARNING_STATES = (
    "captured",
    "consent_pending",
    "quarantined",
    "eligible",
    "included_in_named_training_manifest",
    "evaluated",
    "approved_for_deployment",
)
LEARNING_TRANSITIONS = {
    "captured": {"consent_pending", "quarantined"},
    "consent_pending": {"quarantined", "eligible"},
    "quarantined": {"consent_pending", "eligible"},
    "eligible": {"quarantined", "included_in_named_training_manifest"},
    "included_in_named_training_manifest": {"quarantined", "evaluated"},
    "evaluated": {"quarantined", "approved_for_deployment"},
    "approved_for_deployment": {"quarantined"},
}

COMPATIBILITY_FIELDS = (
    "source_fingerprint",
    "clock_revision",
    "scope",
    "evidence_dependencies",
    "correction_generation",
    "ontology_version",
    "preprocessing_version",
    "model_artifact_hash",
    "calibration_artifact_version",
    "decision_capsule_version",
    "feature_schema_version",
    "parameter_hash",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def _digest(value: Any) -> str:
    return sha256(_json(value).encode("utf-8")).hexdigest()


def _text(value: Any, name: str) -> str:
    result = str(value or "").strip()
    if not result:
        raise ValueError(f"{name} is required")
    return result


def _finite(value: Any, name: str) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{name} must be numeric")
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError(f"{name} must be numeric") from exc
    if not math.isfinite(number):
        raise ValueError(f"{name} must be finite")
    return number


def normalize_compatibility(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Build the exact, fail-closed analytical reuse identity."""
    if not isinstance(payload, Mapping):
        raise ValueError("compatibility must be an object")
    missing = [field for field in COMPATIBILITY_FIELDS if payload.get(field) in (None, "")]
    if missing:
        raise ValueError("compatibility is missing: " + ", ".join(missing))
    scope = payload.get("scope")
    if not isinstance(scope, Mapping):
        raise ValueError("scope must be an object")
    start = _finite(scope.get("start_seconds"), "scope.start_seconds")
    end = _finite(scope.get("end_seconds"), "scope.end_seconds")
    if start < 0 or end < start:
        raise ValueError("scope must have ordered nonnegative bounds")
    dependencies = payload.get("evidence_dependencies")
    if not isinstance(dependencies, Mapping):
        raise ValueError("evidence_dependencies must be an object")
    if not dependencies:
        raise ValueError("evidence_dependencies must declare at least one fingerprint")
    for name, fingerprint in dependencies.items():
        _text(name, "evidence dependency name")
        _text(fingerprint, f"evidence dependency {name}")
    normalized_scope = {
        "clock_id": _text(scope.get("clock_id") or "source_media.clock", "scope.clock_id"),
        "start_seconds": round(start, 6),
        "end_seconds": round(end, 6),
    }
    for name in ("spatial_region", "text_span"):
        if scope.get(name) is not None:
            normalized_scope[name] = scope[name]
    normalized = {
        "source_fingerprint": _text(payload["source_fingerprint"], "source_fingerprint"),
        "clock_revision": _text(payload["clock_revision"], "clock_revision"),
        "scope": normalized_scope,
        "evidence_dependencies": dict(sorted((str(k), v) for k, v in dependencies.items())),
        "correction_generation": _text(payload["correction_generation"], "correction_generation"),
        "ontology_version": _text(payload["ontology_version"], "ontology_version"),
        "preprocessing_version": _text(payload["preprocessing_version"], "preprocessing_version"),
        "model_artifact_hash": _text(payload["model_artifact_hash"], "model_artifact_hash"),
        "calibration_artifact_version": _text(payload["calibration_artifact_version"], "calibration_artifact_version"),
        "decision_capsule_version": _text(payload["decision_capsule_version"], "decision_capsule_version"),
        "feature_schema_version": _text(payload["feature_schema_version"], "feature_schema_version"),
        "parameter_hash": _text(payload["parameter_hash"], "parameter_hash"),
    }
    normalized["compatibility_key"] = "pde:" + _digest(normalized)
    return normalized


def validate_score(payload: Mapping[str, Any], *, canonical: bool = False) -> dict[str, Any]:
    semantics = _text(payload.get("score_semantics"), "score_semantics")
    if semantics not in SCORE_SEMANTICS:
        raise ValueError("unsupported score_semantics")
    if canonical != (semantics == "analyst_decision"):
        raise ValueError("analyst_decision is required only for canonical analyst decisions")
    score = payload.get("score")
    if semantics in {"similarity_score", "uncalibrated_model_score", "calibrated_probability"}:
        score = _finite(score, "score")
        if semantics == "calibrated_probability" and not 0 <= score <= 1:
            raise ValueError("calibrated_probability must be between 0 and 1")
    elif score is not None:
        raise ValueError(f"{semantics} must not claim a scalar score")
    if semantics == "conformal_prediction_set":
        labels = payload.get("prediction_set")
        if not isinstance(labels, list) or not labels:
            raise ValueError("conformal_prediction_set requires prediction_set")
    return {
        "score_semantics": semantics,
        **({"score": score} if score is not None else {}),
        **({"prediction_set": list(payload["prediction_set"])} if semantics == "conformal_prediction_set" else {}),
        **({"calibration_ref": _text(payload.get("calibration_ref"), "calibration_ref")} if semantics == "calibrated_probability" else {}),
    }


INITIAL_CAPSULES = {
    "narrative_agent_speaker_resolution": {
        "task": "narrative-agent-speaker-resolution", "version": "1.0.0",
        "required_features": ["transcript_segments", "audio_turns"],
        "optional_features": ["active_speaker_sync", "face_identity", "voice_prosody", "scene_membership"],
        "deterministic_rules": ["single_confirmed_visible_active_speaker", "manual_assignment_wins"],
        "provider": "local_constellation", "calibration_state": "review_gated",
        "thresholds": {"review": 0.55, "accept_candidate": 0.8, "abstain_below": 0.35},
        "cost_class": "medium", "hardware": ["cpu"], "authority_ceiling": "candidate",
        "proliferation_permissions": ["after_analyst_confirmation"],
        "dependencies": ["source_clock", "corrections", "identity_ontology"],
    },
    "object_identity_context_resolution": {
        "task": "object-identity-context-resolution", "version": "1.0.0",
        "required_features": ["object_detections"], "optional_features": ["visual_embeddings", "scene_membership", "agent_object_relations"],
        "deterministic_rules": ["manual_object_identity_wins"], "provider": "local_object_context",
        "calibration_state": "review_gated", "thresholds": {"review": 0.5, "accept_candidate": 0.82, "abstain_below": 0.3},
        "cost_class": "medium", "hardware": ["cpu", "gpu_optional"], "authority_ceiling": "candidate",
        "proliferation_permissions": ["after_analyst_confirmation"], "dependencies": ["source_clock", "corrections", "object_ontology"],
    },
    "contextual_segment_classification": {
        "task": "contextual-segment-classification", "version": "1.0.0",
        "required_features": ["segment_evidence"], "optional_features": ["visual_embeddings", "audio_embeddings", "text_embeddings", "metadata"],
        "deterministic_rules": [], "provider": "local_context_classifier", "calibration_state": "task_calibrated",
        "thresholds": {"review": 0.55, "accept_candidate": 0.8, "abstain_below": 0.35},
        "cost_class": "low", "hardware": ["cpu"], "authority_ceiling": "candidate",
        "proliferation_permissions": ["after_governed_maturity_gate"], "dependencies": ["source_clock", "corrections", "context_ontology"],
    },
    "situation_boundary_detection": {
        "task": "situation-boundary-detection", "version": "1.0.0", "required_features": ["shot_boundaries"],
        "optional_features": ["topic_turns", "agent_continuity", "action_continuity", "setting_continuity"],
        "deterministic_rules": ["manual_scene_boundary_wins"], "provider": "local_temporal_boundary",
        "calibration_state": "review_gated", "thresholds": {"review": 0.5, "accept_candidate": 0.85, "abstain_below": 0.3},
        "cost_class": "low", "hardware": ["cpu"], "authority_ceiling": "candidate",
        "proliferation_permissions": ["after_analyst_confirmation"], "dependencies": ["source_clock", "corrections", "scene_ontology"],
    },
    "cluster_labelling": {
        "task": "cluster-labelling", "version": "1.0.0", "required_features": ["cluster_members", "embeddings"],
        "optional_features": ["confirmed_member_labels"], "deterministic_rules": ["unanimous_confirmed_member_label"],
        "provider": "local_cluster_labeller", "calibration_state": "descriptive", "thresholds": {"review": 0.5, "accept_candidate": 0.9, "abstain_below": 0.25},
        "cost_class": "low", "hardware": ["cpu"], "authority_ceiling": "candidate", "proliferation_permissions": ["never_automatic"],
        "dependencies": ["feature_schema", "corrections", "label_ontology"],
    },
    "outlier_review": {
        "task": "outlier-review", "version": "1.0.0", "required_features": ["cluster_members", "distance_measurements"],
        "optional_features": ["analytical_significance_notes"], "deterministic_rules": [], "provider": "local_outlier_ranker",
        "calibration_state": "descriptive", "thresholds": {"review": 0.0, "accept_candidate": 1.0, "abstain_below": 0.0},
        "cost_class": "low", "hardware": ["cpu"], "authority_ceiling": "review_priority", "proliferation_permissions": ["never_automatic"],
        "dependencies": ["feature_schema", "distance_definition"],
    },
    "constellation_retrieval": {
        "task": "constellation-retrieval", "version": "1.0.0", "required_features": ["constellation_signature"],
        "optional_features": ["multimodal_embeddings", "confirmed_relations"], "deterministic_rules": ["exact_confirmed_constellation_match"],
        "provider": "local_constellation_index", "calibration_state": "similarity_only", "thresholds": {"review": 0.5, "accept_candidate": 0.85, "abstain_below": 0.2},
        "cost_class": "low", "hardware": ["cpu"], "authority_ceiling": "candidate", "proliferation_permissions": ["never_automatic"],
        "dependencies": ["feature_schema", "corrections", "relation_ontology"],
    },
    "evidence_role_classification": {
        "task": "evidence-role-classification", "version": "1.0.0", "required_features": ["evidence_record"],
        "optional_features": ["claim_context", "source_metadata"], "deterministic_rules": ["explicit_source_role"],
        "provider": "local_evidence_role", "calibration_state": "review_gated", "thresholds": {"review": 0.5, "accept_candidate": 0.85, "abstain_below": 0.3},
        "cost_class": "low", "hardware": ["cpu"], "authority_ceiling": "candidate", "proliferation_permissions": ["after_analyst_confirmation"],
        "dependencies": ["evidence_ontology", "corrections"],
    },
}


class ParsimoniousRuntime:
    """Durable decision runtime rooted in one analysis directory."""

    def __init__(self, root: str | Path, analysis_id: str):
        self.analysis_id = _text(analysis_id, "analysis_id")
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.blobs = self.root / "parsimonious_artifacts" / "sha256"
        self.blobs.mkdir(parents=True, exist_ok=True)
        self.db_path = self.root / "parsimonious_runtime.sqlite3"
        self._initialize()
        self.register_initial_capsules()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=20)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")
        return connection

    def _initialize(self) -> None:
        with self._connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS artifacts(
                    digest TEXT PRIMARY KEY, kind TEXT NOT NULL, path TEXT NOT NULL,
                    created_at TEXT NOT NULL, payload_bytes INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS compatibility_results(
                    compatibility_key TEXT PRIMARY KEY, result_digest TEXT NOT NULL,
                    validity TEXT NOT NULL, created_at TEXT NOT NULL,
                    FOREIGN KEY(result_digest) REFERENCES artifacts(digest));
                CREATE TABLE IF NOT EXISTS feature_index(
                    compatibility_key TEXT PRIMARY KEY, feature_digest TEXT NOT NULL,
                    validity TEXT NOT NULL, created_at TEXT NOT NULL,
                    FOREIGN KEY(feature_digest) REFERENCES artifacts(digest));
                CREATE TABLE IF NOT EXISTS capsules(
                    capsule_id TEXT NOT NULL, version TEXT NOT NULL, spec_digest TEXT NOT NULL,
                    active INTEGER NOT NULL, PRIMARY KEY(capsule_id, version),
                    FOREIGN KEY(spec_digest) REFERENCES artifacts(digest));
                CREATE TABLE IF NOT EXISTS invalidations(
                    invalidation_id TEXT PRIMARY KEY, target_digest TEXT NOT NULL,
                    dependency_ref TEXT NOT NULL, reason TEXT NOT NULL,
                    event_digest TEXT NOT NULL, created_at TEXT NOT NULL,
                    FOREIGN KEY(event_digest) REFERENCES artifacts(digest));
                CREATE TABLE IF NOT EXISTS runtime_traces(
                    trace_id TEXT PRIMARY KEY, compatibility_key TEXT,
                    route_state TEXT NOT NULL, trace_digest TEXT NOT NULL, created_at TEXT NOT NULL,
                    FOREIGN KEY(trace_digest) REFERENCES artifacts(digest));
                CREATE TABLE IF NOT EXISTS learning_items(
                    learning_id TEXT PRIMARY KEY, correction_digest TEXT NOT NULL,
                    state TEXT NOT NULL, manifest_name TEXT, updated_at TEXT NOT NULL,
                    FOREIGN KEY(correction_digest) REFERENCES artifacts(digest));
                CREATE TABLE IF NOT EXISTS learning_events(
                    event_id TEXT PRIMARY KEY, learning_id TEXT NOT NULL,
                    from_state TEXT, to_state TEXT NOT NULL, event_digest TEXT NOT NULL,
                    created_at TEXT NOT NULL, FOREIGN KEY(learning_id) REFERENCES learning_items(learning_id),
                    FOREIGN KEY(event_digest) REFERENCES artifacts(digest));
            """)

    def put_artifact(self, kind: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        envelope = {"schema": SCHEMA_VERSION, "analysis_id": self.analysis_id, "kind": _text(kind, "kind"), "payload": dict(payload)}
        encoded = (_json(envelope) + "\n").encode("utf-8")
        digest = sha256(encoded).hexdigest()
        folder = self.blobs / digest[:2]
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{digest}.json"
        if path.exists():
            if path.read_bytes() != encoded:
                raise RuntimeError("content-address collision")
        else:
            temporary = folder / f".{digest}.{uuid.uuid4().hex}.tmp"
            try:
                with temporary.open("xb") as target:
                    target.write(encoded)
                    target.flush()
                    os.fsync(target.fileno())
                os.replace(temporary, path)
            finally:
                temporary.unlink(missing_ok=True)
        with self._connect() as db:
            db.execute(
                "INSERT OR IGNORE INTO artifacts(digest,kind,path,created_at,payload_bytes) VALUES(?,?,?,?,?)",
                (digest, kind, str(path), _now(), len(encoded)),
            )
        return {"digest": digest, "kind": kind, "artifact_ref": str(path)}

    def read_artifact(self, digest: str) -> dict[str, Any]:
        with self._connect() as db:
            row = db.execute("SELECT path FROM artifacts WHERE digest=?", (digest,)).fetchone()
        if row is None:
            raise KeyError(digest)
        return json.loads(Path(row["path"]).read_text(encoding="utf-8"))

    def register_initial_capsules(self) -> None:
        for capsule_id, spec in INITIAL_CAPSULES.items():
            record = {"capsule_id": capsule_id, **spec}
            artifact = self.put_artifact("decision_capsule_manifest", record)
            with self._connect() as db:
                db.execute("UPDATE capsules SET active=0 WHERE capsule_id=?", (capsule_id,))
                db.execute(
                    "INSERT OR REPLACE INTO capsules(capsule_id,version,spec_digest,active) VALUES(?,?,?,1)",
                    (capsule_id, spec["version"], artifact["digest"]),
                )

    def put_evidence_slice(self, compatibility: Mapping[str, Any], evidence: Mapping[str, Any]) -> dict[str, Any]:
        key = normalize_compatibility(compatibility)
        return self.put_artifact(
            "evidence_slice",
            {"compatibility": key, "evidence": dict(evidence)},
        )

    def put_manifest(self, manifest_type: str, manifest: Mapping[str, Any]) -> dict[str, Any]:
        if manifest_type not in {"model", "ontology", "calibration", "preprocessing", "training"}:
            raise ValueError("unsupported manifest_type")
        return self.put_artifact(f"{manifest_type}_manifest", dict(manifest))

    def capsules(self) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute("SELECT capsule_id,version,spec_digest FROM capsules WHERE active=1 ORDER BY capsule_id").fetchall()
        return [self.read_artifact(row["spec_digest"])["payload"] for row in rows]

    def put_feature(self, compatibility: Mapping[str, Any], feature: Mapping[str, Any]) -> dict[str, Any]:
        key = normalize_compatibility(compatibility)
        artifact = self.put_artifact("feature_snapshot", {"compatibility": key, "feature": dict(feature)})
        with self._connect() as db:
            existing = db.execute("SELECT feature_digest FROM feature_index WHERE compatibility_key=?", (key["compatibility_key"],)).fetchone()
            if existing and existing["feature_digest"] != artifact["digest"]:
                raise ValueError("compatibility key already identifies a different immutable feature")
            db.execute("INSERT OR REPLACE INTO feature_index VALUES(?,?,?,?)", (key["compatibility_key"], artifact["digest"], "current", _now()))
        return {**artifact, "compatibility_key": key["compatibility_key"]}

    def compatible_feature(self, compatibility: Mapping[str, Any]) -> Optional[dict[str, Any]]:
        key = normalize_compatibility(compatibility)["compatibility_key"]
        with self._connect() as db:
            row = db.execute("SELECT feature_digest FROM feature_index WHERE compatibility_key=? AND validity='current'", (key,)).fetchone()
        return self.read_artifact(row["feature_digest"])["payload"] if row else None

    def put_result(self, compatibility: Mapping[str, Any], result: Mapping[str, Any], *, canonical: bool = False) -> dict[str, Any]:
        key = normalize_compatibility(compatibility)
        if canonical and str(result.get("authority") or "") not in {
            "explicit_user_correction", "manual_correction", "manual_confirmation",
            "explicit_user_confirmation",
        }:
            raise ValueError("canonical decisions require explicit analyst authority")
        score = validate_score(result, canonical=canonical)
        kind = "canonical_analyst_decision" if canonical else "candidate_decision_result"
        payload = {
            "compatibility": key, "decision": dict(result.get("decision") or {}), **score,
            "authority": str(result.get("authority")) if canonical else "candidate_service",
            "canonical": canonical, "proliferation_allowed": canonical,
        }
        artifact = self.put_artifact(kind, payload)
        if not canonical:
            with self._connect() as db:
                existing = db.execute("SELECT result_digest FROM compatibility_results WHERE compatibility_key=?", (key["compatibility_key"],)).fetchone()
                if existing and existing["result_digest"] != artifact["digest"]:
                    raise ValueError("compatibility key already identifies a different immutable result")
                db.execute("INSERT OR REPLACE INTO compatibility_results VALUES(?,?,?,?)", (key["compatibility_key"], artifact["digest"], "current", _now()))
        learning_item = None
        if canonical:
            learning_item = self.capture_correction_for_learning({
                "canonical_decision_digest": artifact["digest"],
                "compatibility_key": key["compatibility_key"],
                "decision": payload["decision"],
                "authority": payload["authority"],
            })
        return {
            **artifact,
            "compatibility_key": key["compatibility_key"],
            "canonical": canonical,
            **({"learning_item": learning_item} if learning_item else {}),
        }

    def compatible_result(self, compatibility: Mapping[str, Any]) -> Optional[dict[str, Any]]:
        key = normalize_compatibility(compatibility)["compatibility_key"]
        with self._connect() as db:
            row = db.execute("SELECT result_digest FROM compatibility_results WHERE compatibility_key=? AND validity='current'", (key,)).fetchone()
        return self.read_artifact(row["result_digest"])["payload"] if row else None

    def invalidate(self, dependency_ref: str, reason: str) -> dict[str, Any]:
        dependency_ref = _text(dependency_ref, "dependency_ref")
        affected: list[str] = []
        with self._connect() as db:
            rows = db.execute("SELECT compatibility_key,result_digest FROM compatibility_results WHERE validity='current'").fetchall()
            for row in rows:
                payload = self.read_artifact(row["result_digest"])["payload"]
                deps = payload["compatibility"].get("evidence_dependencies") or {}
                if dependency_ref in deps or dependency_ref in {str(value) for value in deps.values()}:
                    db.execute("UPDATE compatibility_results SET validity='invalid' WHERE compatibility_key=?", (row["compatibility_key"],))
                    affected.append(row["result_digest"])
            feature_rows = db.execute("SELECT compatibility_key,feature_digest FROM feature_index WHERE validity='current'").fetchall()
            for row in feature_rows:
                payload = self.read_artifact(row["feature_digest"])["payload"]
                deps = payload["compatibility"].get("evidence_dependencies") or {}
                if dependency_ref in deps or dependency_ref in {str(value) for value in deps.values()}:
                    db.execute("UPDATE feature_index SET validity='invalid' WHERE compatibility_key=?", (row["compatibility_key"],))
                    affected.append(row["feature_digest"])
        event = {"dependency_ref": dependency_ref, "reason": _text(reason, "reason"), "affected_digests": sorted(set(affected)), "created_at": _now()}
        artifact = self.put_artifact("invalidation_event", event)
        invalidation_id = "invalidation:" + artifact["digest"][:24]
        with self._connect() as db:
            for digest in sorted(set(affected)) or [artifact["digest"]]:
                db.execute("INSERT OR IGNORE INTO invalidations VALUES(?,?,?,?,?,?)", (invalidation_id + ":" + digest[:12], digest, dependency_ref, reason, artifact["digest"], event["created_at"]))
        return {"invalidation_id": invalidation_id, **event, **artifact}

    def route(
        self,
        capsule_id: str,
        compatibility: Mapping[str, Any],
        providers: Iterable[Mapping[str, Any]],
        deterministic_rule: Optional[Mapping[str, Any]] = None,
    ) -> dict[str, Any]:
        capsule = next((item for item in self.capsules() if item["capsule_id"] == capsule_id), None)
        if capsule is None:
            raise ValueError("unknown decision capsule")
        key = normalize_compatibility(compatibility)
        reused = self.compatible_result(key)
        steps: list[dict[str, Any]] = []
        selected = None
        if reused:
            state = "reused_existing_result"
            steps.append({"action": state, "result_digest": _digest(reused)})
        elif deterministic_rule:
            state = "applied_deterministic_rule"
            steps.append({
                "action": state,
                "rule_id": _text(deterministic_rule.get("rule_id"), "rule_id"),
                "evidence_refs": sorted({str(item) for item in deterministic_rule.get("evidence_refs", []) if item}),
                "result": dict(deterministic_rule.get("result") or {}),
            })
        else:
            feature = self.compatible_feature(key)
            if feature:
                steps.append({"action": "reused_cached_features", "feature_digest": _digest(feature)})
            ranked = []
            for provider in providers:
                wall = max(0.0, _finite(provider.get("wall_clock_seconds", 0), "wall_clock_seconds"))
                cpu = max(0.0, _finite(provider.get("cpu_seconds", 0), "cpu_seconds"))
                gpu = max(0.0, _finite(provider.get("gpu_seconds", 0), "gpu_seconds"))
                memory = max(0.0, _finite(provider.get("peak_memory_mb", 0), "peak_memory_mb"))
                energy = max(0.0, _finite(provider.get("energy_class", 1), "energy_class"))
                value = _finite(provider.get("expected_uncertainty_reduction", 0), "expected_uncertainty_reduction")
                if value <= 0 or not bool(provider.get("available", True)):
                    continue
                feature_penalty = 0.25 if bool(provider.get("required_features_exist")) else 1.0
                batch_factor = 0.8 if bool(provider.get("batching_available")) else 1.0
                cost = (wall + cpu + 2 * gpu + memory / 1024 + energy) * feature_penalty * batch_factor
                ranked.append((cost / value, _text(provider.get("provider_id"), "provider_id"), dict(provider), cost))
            ranked.sort(key=lambda item: (item[0], item[1]))
            if ranked:
                ratio, _, selected, cost = ranked[0]
                state = "local_capsule_selected" if selected.get("local", True) else "specialist_model_selected"
                steps.append({"action": state, "provider_id": selected["provider_id"], "incremental_cost": cost, "expected_uncertainty_reduction": selected["expected_uncertainty_reduction"], "cost_value_ratio": ratio})
            else:
                state = "abstained"
                steps.append({"action": "abstained", "reason": "no_available_provider_with_positive_expected_value"})
                steps.append({"action": "sent_to_analyst_review"})
        trace = {
            "trace_id": "trace:" + uuid.uuid4().hex, "analysis_id": self.analysis_id,
            "capsule_id": capsule_id, "capsule_version": capsule["version"],
            "compatibility_key": key["compatibility_key"], "route_state": state,
            "steps": steps, "selected_provider": selected, "created_at": _now(),
        }
        artifact = self.put_artifact("runtime_decision_trace", trace)
        with self._connect() as db:
            db.execute("INSERT INTO runtime_traces VALUES(?,?,?,?,?)", (trace["trace_id"], key["compatibility_key"], state, artifact["digest"], trace["created_at"]))
        return {**trace, "trace_artifact": artifact}

    def traces(self, limit: int = 100) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit), 1000))
        with self._connect() as db:
            rows = db.execute("SELECT trace_digest FROM runtime_traces ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [self.read_artifact(row["trace_digest"])["payload"] for row in rows]

    def capture_correction_for_learning(self, correction: Mapping[str, Any]) -> dict[str, Any]:
        artifact = self.put_artifact("learning_correction_snapshot", dict(correction))
        learning_id = "learning:" + artifact["digest"][:24]
        event = {"learning_id": learning_id, "from_state": None, "to_state": "captured", "created_at": _now()}
        event_artifact = self.put_artifact("learning_state_event", event)
        with self._connect() as db:
            db.execute("INSERT OR IGNORE INTO learning_items VALUES(?,?,?,?,?)", (learning_id, artifact["digest"], "captured", None, event["created_at"]))
            db.execute("INSERT OR IGNORE INTO learning_events VALUES(?,?,?,?,?,?)", ("learning-event:" + event_artifact["digest"][:24], learning_id, None, "captured", event_artifact["digest"], event["created_at"]))
        return {**event, "correction_digest": artifact["digest"]}

    def transition_learning(self, learning_id: str, to_state: str, *, manifest_name: Optional[str] = None, authority: str = "analyst") -> dict[str, Any]:
        if to_state not in LEARNING_STATES:
            raise ValueError("unknown learning state")
        with self._connect() as db:
            row = db.execute("SELECT state FROM learning_items WHERE learning_id=?", (learning_id,)).fetchone()
            if row is None:
                raise KeyError(learning_id)
            current = row["state"]
            if to_state not in LEARNING_TRANSITIONS[current]:
                raise ValueError(f"invalid learning transition: {current} -> {to_state}")
            if to_state == "included_in_named_training_manifest" and not str(manifest_name or "").strip():
                raise ValueError("a named training manifest is required")
            event = {"learning_id": learning_id, "from_state": current, "to_state": to_state, "manifest_name": manifest_name, "authority": _text(authority, "authority"), "created_at": _now()}
            artifact = self.put_artifact("learning_state_event", event)
            db.execute("UPDATE learning_items SET state=?,manifest_name=COALESCE(?,manifest_name),updated_at=? WHERE learning_id=?", (to_state, manifest_name, event["created_at"], learning_id))
            db.execute("INSERT INTO learning_events VALUES(?,?,?,?,?,?)", ("learning-event:" + artifact["digest"][:24], learning_id, current, to_state, artifact["digest"], event["created_at"]))
        return {**event, "event_digest": artifact["digest"]}

    def summary(self) -> dict[str, Any]:
        with self._connect() as db:
            counts = {table: db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in (
                "artifacts", "compatibility_results", "feature_index", "capsules", "invalidations", "runtime_traces", "learning_items", "learning_events"
            )}
        return {"schema": SCHEMA_VERSION, "analysis_id": self.analysis_id, "database": str(self.db_path), "counts": counts}
