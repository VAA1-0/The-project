import pytest

from src.backend.analysis.parsimonious_workflow import (
    TRACKING_PROGRAMS,
    build_parsimonious_workflow_plan,
)


def plan(**updates):
    values = {
        "analysis_id": "analysis-1",
        "source_fingerprint": "sha256:source",
        "clock_revision": "clock:1",
        "correction_generation": "corrections:1",
        "requested_tier": "quick_sweep",
    }
    values.update(updates)
    return build_parsimonious_workflow_plan(**values)


def test_quick_sweep_is_sparse_local_and_covers_all_tracking_programs():
    result = plan()
    assert set(result["tracking_programs"]) == set(TRACKING_PROGRAMS)
    assert result["summary"]["job_count"] == 12
    assert all(job["scope"] == "source_wide_sparse" for job in result["jobs"])
    assert all(job["incremental_cost"] in {"low", "medium", "negligible"} for job in result["jobs"])
    assert result["governance"]["automatic_canonical_write"] is False


def test_science_sweep_deepens_only_declared_intervals():
    result = plan(
        requested_tier="science_sweep",
        uncertainty_hotspots=[{"start_seconds": 6, "end_seconds": 9, "reason": "unknown_speaker"}],
        researcher_priorities=[{"start_seconds": 40, "end_seconds": 45, "reason": "scene_transition"}],
    )
    assert result["summary"]["bounded_science_interval_count"] == 2
    assert result["summary"]["computed_job_count"] == 24
    assert all(job["scope"] == "bounded_interval" for job in result["jobs"])
    assert {job["interval"]["start_seconds"] for job in result["jobs"]} == {6.0, 40.0}


def test_science_sweep_without_a_gap_does_not_schedule_unbounded_work():
    result = plan(requested_tier="science_sweep")
    assert result["jobs"] == []
    assert result["summary"]["computed_job_count"] == 0


def test_running_science_scan_profile_normalizes_to_science_sweep():
    result = plan(
        requested_tier="science_scan",
        uncertainty_hotspots=[{"start_seconds": 6, "end_seconds": 9}],
    )
    assert result["requested_tier"] == "science_sweep"
    assert result["requested_tier_alias"] == "science_scan"
    assert result["summary"]["computed_job_count"] == 12


def test_compatible_capsule_result_is_reused_without_recomputation():
    capsule = "narrative_agent.confirmed_anchor_reuse"
    result = plan(compatible_results={capsule: "classification:known"})
    job = next(job for job in result["jobs"] if job["capsule_id"] == capsule)
    assert job["route"] == "reuse_exact_result"
    assert job["incremental_cost"] == "none"
    assert result["summary"]["reused_job_count"] == 1


def test_unknown_tier_fails_closed():
    with pytest.raises(ValueError):
        plan(requested_tier="expensive_everything")
