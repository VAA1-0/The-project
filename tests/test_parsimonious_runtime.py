import sqlite3

import pytest

from src.backend.analysis.parsimonious_runtime import (
    ParsimoniousRuntime,
    normalize_compatibility,
    validate_score,
)


def compatibility(**updates):
    value = {
        "source_fingerprint": "sha256:source",
        "clock_revision": "clock-v1:one",
        "scope": {"clock_id": "source_media.clock", "start_seconds": 6, "end_seconds": 9, "text_span": "Why?"},
        "evidence_dependencies": {"transcript": "sha256:transcript", "faces": "sha256:faces"},
        "correction_generation": "corrections:2",
        "ontology_version": "ontology:1",
        "preprocessing_version": "preprocess:1",
        "model_artifact_hash": "sha256:model",
        "calibration_artifact_version": "calibration:1",
        "decision_capsule_version": "1.0.0",
        "feature_schema_version": "features:1",
        "parameter_hash": "sha256:parameters",
    }
    value.update(updates)
    return value


def runtime(tmp_path):
    return ParsimoniousRuntime(tmp_path / "analysis-1", "analysis-1")


def test_strict_key_changes_for_every_analytical_dependency():
    original = normalize_compatibility(compatibility())["compatibility_key"]
    changes = {
        "source_fingerprint": "sha256:other",
        "clock_revision": "clock-v1:two",
        "scope": {"start_seconds": 6, "end_seconds": 9.1},
        "evidence_dependencies": {"transcript": "sha256:new"},
        "correction_generation": "corrections:3",
        "ontology_version": "ontology:2",
        "preprocessing_version": "preprocess:2",
        "model_artifact_hash": "sha256:model2",
        "calibration_artifact_version": "calibration:2",
        "decision_capsule_version": "1.0.1",
        "feature_schema_version": "features:2",
        "parameter_hash": "sha256:parameters2",
    }
    assert all(normalize_compatibility(compatibility(**{key: value}))["compatibility_key"] != original for key, value in changes.items())


def test_missing_compatibility_field_fails_closed():
    value = compatibility()
    value.pop("model_artifact_hash")
    with pytest.raises(ValueError, match="model_artifact_hash"):
        normalize_compatibility(value)


def test_feature_and_result_survive_reopen_and_are_immutable(tmp_path):
    first = runtime(tmp_path)
    feature = first.put_feature(compatibility(), {"embedding": [0.1, 0.2]})
    result = first.put_result(
        compatibility(),
        {"decision": {"label": "car chase"}, "score_semantics": "calibrated_probability", "score": 0.91, "calibration_ref": "calibration:1"},
    )
    reopened = runtime(tmp_path)
    assert reopened.compatible_feature(compatibility())["feature"]["embedding"] == [0.1, 0.2]
    assert reopened.compatible_result(compatibility())["decision"]["label"] == "car chase"
    assert reopened.read_artifact(feature["digest"])["kind"] == "feature_snapshot"
    assert reopened.read_artifact(result["digest"])["kind"] == "candidate_decision_result"
    with pytest.raises(ValueError, match="different immutable result"):
        reopened.put_result(
            compatibility(),
            {"decision": {"label": "not a chase"}, "score_semantics": "deterministic_rule"},
        )


def test_evidence_manifests_and_canonical_decisions_are_separate_artifact_families(tmp_path):
    store = runtime(tmp_path)
    evidence = store.put_evidence_slice(compatibility(), {"transcript": "Why would I betray you?"})
    model = store.put_manifest("model", {"model_id": "speaker-local", "artifact_hash": "sha256:model"})
    ontology = store.put_manifest("ontology", {"ontology_id": "agents", "version": "1"})
    canonical = store.put_result(
        compatibility(),
        {
            "decision": {"speaker": "Madeleine Swann"},
            "score_semantics": "analyst_decision",
            "authority": "explicit_user_confirmation",
        },
        canonical=True,
    )
    assert store.read_artifact(evidence["digest"])["kind"] == "evidence_slice"
    assert store.read_artifact(model["digest"])["kind"] == "model_manifest"
    assert store.read_artifact(ontology["digest"])["kind"] == "ontology_manifest"
    assert store.read_artifact(canonical["digest"])["kind"] == "canonical_analyst_decision"
    assert canonical["learning_item"]["to_state"] == "captured"
    assert store.compatible_result(compatibility()) is None


def test_invalidation_is_selective_and_append_only(tmp_path):
    store = runtime(tmp_path)
    first = compatibility()
    second = compatibility(scope={"start_seconds": 20, "end_seconds": 21}, evidence_dependencies={"audio": "sha256:audio"})
    store.put_result(first, {"decision": {"label": "first"}, "score_semantics": "deterministic_rule"})
    store.put_result(second, {"decision": {"label": "second"}, "score_semantics": "deterministic_rule"})
    event = store.invalidate("sha256:faces", "face correction changed")
    assert len(event["affected_digests"]) == 1
    assert store.compatible_result(first) is None
    assert store.compatible_result(second)["decision"]["label"] == "second"
    assert store.read_artifact(event["digest"])["kind"] == "invalidation_event"


def test_capsule_registry_has_all_initial_operational_tasks(tmp_path):
    capsules = runtime(tmp_path).capsules()
    assert {item["capsule_id"] for item in capsules} == {
        "narrative_agent_speaker_resolution", "object_identity_context_resolution",
        "contextual_segment_classification", "situation_boundary_detection",
        "cluster_labelling", "outlier_review", "constellation_retrieval",
        "evidence_role_classification",
    }
    assert all(item["required_features"] and item["authority_ceiling"] for item in capsules)


def test_cost_router_reuses_first_then_selects_lowest_marginal_cost_per_value(tmp_path):
    store = runtime(tmp_path)
    providers = [
        {"provider_id": "expensive", "wall_clock_seconds": 10, "cpu_seconds": 4, "gpu_seconds": 2, "peak_memory_mb": 2048, "energy_class": 3, "expected_uncertainty_reduction": 0.9, "local": False},
        {"provider_id": "local", "wall_clock_seconds": 2, "cpu_seconds": 1, "gpu_seconds": 0, "peak_memory_mb": 256, "energy_class": 1, "expected_uncertainty_reduction": 0.7, "required_features_exist": True, "batching_available": True},
    ]
    routed = store.route("contextual_segment_classification", compatibility(), providers)
    assert routed["route_state"] == "local_capsule_selected"
    assert routed["selected_provider"]["provider_id"] == "local"
    store.put_result(compatibility(), {"decision": {"label": "car chase"}, "score_semantics": "deterministic_rule"})
    reused = store.route("contextual_segment_classification", compatibility(), providers)
    assert reused["route_state"] == "reused_existing_result"
    assert reused["steps"][0]["action"] == "reused_existing_result"
    assert len(store.traces()) == 2


def test_deterministic_rule_precedes_provider_computation(tmp_path):
    store = runtime(tmp_path)
    routed = store.route(
        "narrative_agent_speaker_resolution",
        compatibility(),
        [{"provider_id": "model", "wall_clock_seconds": 1, "cpu_seconds": 1, "gpu_seconds": 0, "peak_memory_mb": 10, "energy_class": 1, "expected_uncertainty_reduction": 0.9}],
        {"rule_id": "single_confirmed_visible_active_speaker", "evidence_refs": ["face:1", "lipsync:1"], "result": {"speaker": "Madeleine Swann"}},
    )
    assert routed["route_state"] == "applied_deterministic_rule"
    assert routed["selected_provider"] is None


def test_probability_semantics_prevent_false_precision():
    assert validate_score({"score_semantics": "deterministic_rule"}) == {"score_semantics": "deterministic_rule"}
    with pytest.raises(ValueError):
        validate_score({"score_semantics": "deterministic_rule", "score": 0.9})
    with pytest.raises(ValueError):
        validate_score({"score_semantics": "calibrated_probability", "score": 1.1, "calibration_ref": "c"})
    with pytest.raises(ValueError):
        validate_score({"score_semantics": "uncalibrated_model_score"}, canonical=True)


def test_learning_correction_is_quarantined_from_training_until_governed_transitions(tmp_path):
    store = runtime(tmp_path)
    captured = store.capture_correction_for_learning({"correction_id": "c1", "label": "Madeleine Swann"})
    learning_id = captured["learning_id"]
    store.transition_learning(learning_id, "consent_pending")
    store.transition_learning(learning_id, "eligible")
    with pytest.raises(ValueError, match="named training manifest"):
        store.transition_learning(learning_id, "included_in_named_training_manifest")
    included = store.transition_learning(learning_id, "included_in_named_training_manifest", manifest_name="speaker-resolution-2026-11")
    assert included["manifest_name"] == "speaker-resolution-2026-11"
    store.transition_learning(learning_id, "evaluated")
    store.transition_learning(learning_id, "approved_for_deployment")
    assert store.summary()["counts"]["learning_events"] == 6


def test_sqlite_wal_and_artifact_indexes_are_real(tmp_path):
    store = runtime(tmp_path)
    store.put_feature(compatibility(), {"vector": [1, 2, 3]})
    with sqlite3.connect(store.db_path) as db:
        assert db.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0] >= 9
        assert db.execute("SELECT COUNT(*) FROM feature_index").fetchone()[0] == 1
