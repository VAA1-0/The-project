import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from src.backend.analysis.atomic_json_transaction import (
    JsonTransactionInvalid,
    update_json_transaction,
)
from src.backend.analysis.background_generation_fence import projection_admission


def test_concurrent_catalogue_updates_do_not_erase_siblings(tmp_path: Path):
    path = tmp_path / "catalogue_index.json"

    def add(index: int):
        def mutate(payload):
            payload.setdefault("analyses", {})[f"a-{index}"] = {"project_id": "p"}

        update_json_transaction(
            path,
            default={"schema": "vaa1.catalogue_index.v1", "analyses": {}},
            mutate=mutate,
        )

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(add, range(40)))

    payload = json.loads(path.read_text(encoding="utf-8"))
    assert len(payload["analyses"]) == 40
    assert not list(tmp_path.glob(".*.tmp"))
    assert not list(tmp_path.glob("*.transaction.lock"))


def test_invalid_existing_json_fails_closed_without_replacement(tmp_path: Path):
    path = tmp_path / "catalogue_index.json"
    path.write_text("{broken", encoding="utf-8")
    with pytest.raises(JsonTransactionInvalid, match="unreadable"):
        update_json_transaction(path, default={}, mutate=lambda payload: payload.update(x=1))
    assert path.read_text(encoding="utf-8") == "{broken"


def test_stale_background_generation_has_no_write_effect():
    decision = projection_admission(
        expected_generation="old",
        canonical_corrections={"correction_generation": "new"},
    )
    assert decision["admitted"] is False
    assert decision["write_effect"] == "none_stale_job_discarded"


def test_current_background_generation_is_admitted():
    decision = projection_admission(
        expected_generation="current",
        canonical_corrections={"correction_generation": "current"},
    )
    assert decision["admitted"] is True
