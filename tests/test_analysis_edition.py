from pathlib import Path

import pytest

from src.backend.analysis.analysis_edition import build_completion_account, freeze_analysis_edition, latest_analysis_edition


def status():
    return {
        "analysis_id": "a-1", "project_id": "p-1", "status": "completed", "filename": "source.mp4",
        "pipeline_type": "full", "output_files": {"transcript": "t.json", "audio": "a.wav"},
        "canonical_decision_ledger": {"decisions": [
            {"validity": "current", "review_status": "accepted"},
            {"validity": "current", "review_status": "candidate"},
            {"validity": "current", "review_status": "deferred"},
            {"validity": "superseded", "review_status": "accepted"},
        ]},
    }


def test_completion_account_is_human_bounded_and_state_explicit():
    account = build_completion_account(status())
    assert account["evidence"] == {"confirmed": 1, "candidates": 1, "withheld": 1, "artifact_count": 2}
    assert account["corrections_and_history"]["superseded_count"] == 1
    assert account["source"]["clock"] == "source_media_seconds"


def test_completion_decision_freezes_append_only_editions(tmp_path: Path):
    first = freeze_analysis_edition(status(), tmp_path, "Enough reviewed evidence")
    second = freeze_analysis_edition(status(), tmp_path)
    assert first["label"] == "Analysis 1.0"
    assert second["label"] == "Analysis 2.0"
    assert first["authority"] == "explicit_analyst_confirmation"
    assert latest_analysis_edition(tmp_path)["edition"] == 2
    assert len(list(tmp_path.glob("analysis_edition_*.json"))) == 2


def test_incomplete_analysis_cannot_be_frozen(tmp_path: Path):
    incomplete = {**status(), "status": "processing"}
    with pytest.raises(ValueError, match="completed analysis"):
        freeze_analysis_edition(incomplete, tmp_path)
