import pytest

from src.backend.analysis.contextual_classification_router import (
    CompatibleResultRegistry,
    compatibility_key,
    make_result,
    normalize_evidence_slice,
    route_classification,
)


def evidence(**updates):
    value = {
        "analysis_id": "analysis-1",
        "source_fingerprint": "sha256:source",
        "clock_revision": "clock:v3",
        "task": "contextual_segment_classification",
        "scope": {"start_seconds": 6.0, "end_seconds": 9.0},
        "evidence_refs": ["transcript:4", "visual:face:8", "audio:turn:2"],
        "dependencies": {"transcript": "transcript:v4", "visual": "objects:v7"},
        "models": {"embedding": "native-mm:v1", "classifier": "local-context:v2"},
        "label_definitions": {"context_ontology": "context:v1"},
        "correction_generation": "corrections:12",
    }
    value.update(updates)
    return value


def test_normalized_slice_has_stable_exact_compatibility_key():
    first = normalize_evidence_slice(evidence())
    reordered = evidence(
        evidence_refs=["audio:turn:2", "visual:face:8", "transcript:4"],
        dependencies={"visual": "objects:v7", "transcript": "transcript:v4"},
    )
    assert first["compatibility_key"] == normalize_evidence_slice(reordered)["compatibility_key"]
    assert first["compatibility_key"] == compatibility_key(first)


@pytest.mark.parametrize(
    "change",
    [
        {"source_fingerprint": "sha256:other"},
        {"clock_revision": "clock:v4"},
        {"scope": {"start_seconds": 6.0, "end_seconds": 9.1}},
        {"models": {"embedding": "native-mm:v2", "classifier": "local-context:v2"}},
        {"label_definitions": {"context_ontology": "context:v2"}},
        {"correction_generation": "corrections:13"},
    ],
)
def test_any_analytical_compatibility_change_prevents_reuse(change):
    registry = CompatibleResultRegistry()
    original = evidence()
    registry.put(make_result(original, provider="local", proposal={"labels": ["car chase"]}))
    assert registry.compatible({**original, **change}) is None


def test_exact_result_is_reused_without_becoming_canonical_truth():
    registry = CompatibleResultRegistry()
    result = make_result(evidence(), provider="local", proposal={"labels": ["car chase"]})
    registry.put(result)
    route = route_classification(evidence(), registry=registry, local_available=True)
    assert route["route_state"] == "reused"
    assert route["reused_result_id"] == result["result_id"]
    assert route["canonical_write"] is False
    assert result["manual_correction_wins"] is True


def test_conflict_novelty_and_low_reliability_do_not_silently_pass():
    registry = CompatibleResultRegistry()
    assert route_classification(evidence(), registry=registry, local_available=True, conflicting_evidence=True)["route_state"] == "analyst_review"
    assert route_classification(evidence(), registry=registry, local_available=True, unfamiliar_category=True)["route_state"] == "abstained"
    assert route_classification(evidence(), registry=registry, local_available=True, local_reliability=0.6)["route_state"] == "escalated"
    assert route_classification(evidence(), registry=registry, local_available=True, local_reliability=0.9)["route_state"] == "accepted_candidate"


def test_dependency_change_invalidates_only_affected_results():
    first = make_result(evidence(), provider="local", proposal={"labels": ["car chase"]})
    second_slice = evidence(
        task="cluster_label",
        dependencies={"audio": "audio:v2"},
        models={"embedding": "audio:v1", "classifier": "cluster:v1"},
    )
    second = make_result(second_slice, provider="local", proposal={"label": "engine"})
    registry = CompatibleResultRegistry([first, second])
    invalidated = registry.invalidate_dependencies(["objects:v7"])
    assert invalidated == [first["result_id"]]
    assert registry.compatible(evidence()) is None
    assert registry.compatible(second_slice)["result_id"] == second["result_id"]


def test_invalid_or_unbound_scope_is_rejected():
    with pytest.raises(ValueError):
        normalize_evidence_slice(evidence(source_fingerprint=""))
    with pytest.raises(ValueError):
        normalize_evidence_slice(evidence(scope={"start_seconds": 9, "end_seconds": 6}))
