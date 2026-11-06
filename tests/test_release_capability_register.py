import json
from pathlib import Path

import pytest

from src.backend.analysis.release_capability_register import (
    ALLOWED_STATUSES,
    SCHEMA,
    load_release_capability_register,
    release_capability_account,
    validate_release_capability_register,
)


def test_repository_release_register_is_valid_and_bounded() -> None:
    register = load_release_capability_register()
    assert register["schema"] == SCHEMA
    assert register["product_release"] == "#0.1"
    assert register["analysis_edition_label"] == "Analysis 1.0"
    assert tuple(register["status_vocabulary"]) == ALLOWED_STATUSES
    assert {row["status"] for row in register["capabilities"]} <= set(ALLOWED_STATUSES)
    assert len({row["id"] for row in register["capabilities"]}) == len(register["capabilities"])


def test_every_capability_has_owner_limitations_evidence_and_runtime_disposition() -> None:
    register = load_release_capability_register()
    for row in register["capabilities"]:
        assert row["owner"]
        assert isinstance(row["supported_inputs"], list)
        assert row["known_limitations"]
        assert row["acceptance_evidence"]
        assert row["runtime_consequence"]


def test_account_never_counts_deferred_or_disabled_as_supported() -> None:
    account = release_capability_account()
    counts = account["summary"]["status_counts"]
    assert sum(counts.values()) == account["summary"]["capability_count"]
    assert counts["deferred"] > 0
    assert counts["disabled"] > 0
    assert account["summary"]["freeze_ready"] is True


def test_invalid_or_unproven_supported_capability_fails_closed(tmp_path: Path) -> None:
    payload = load_release_capability_register()
    payload["capabilities"][0]["acceptance_evidence"] = []
    errors = validate_release_capability_register(payload)
    assert any("active capability requires acceptance evidence" in error for error in errors)
    path = tmp_path / "register.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match="Invalid release capability register"):
        load_release_capability_register(path)
