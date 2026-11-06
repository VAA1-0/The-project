import json
from pathlib import Path

from src.backend.analysis.release_maintenance import (
    build_redacted_diagnostic_bundle,
    load_maintenance_register,
    maintenance_assessment,
)


ROOT = Path(__file__).resolve().parents[1]
REGISTER = ROOT / "config" / "release_maintenance_register.json"


def test_current_maintenance_state_is_blocked_without_invented_assignees():
    result = maintenance_assessment(REGISTER, ROOT)
    assert result["qualification"] == "blocked"
    assert "accountable_roles_unassigned" in result["release_blockers"]
    assert result["blocking_known_issue_ids"] == ["REL-SUPPLY-001", "REL-WORKLOAD-001"]


def test_redacted_diagnostics_drop_raw_content_secrets_and_absolute_paths():
    policy = load_maintenance_register(REGISTER)["diagnostic_bundle_policy"]
    bundle = build_redacted_diagnostic_bundle({
        "runtime": {"source_path": "/Users/researcher/private/movie.mp4", "token": "secret", "transcript": "private speech"},
        "component_versions": {"datascene": "0.1"},
        "error_classes": [{"type": "ValueError", "text": "private sentence"}],
        "known_issue_refs": ["REL-SUPPLY-001"],
        "raw_analysis": {"should": "drop"},
    }, policy)
    rendered = json.dumps(bundle)
    assert "private speech" not in rendered
    assert "private sentence" not in rendered
    assert '"token": "secret"' not in rendered
    assert "/Users/researcher" not in rendered
    assert "raw_analysis" not in rendered
    assert bundle["raw_payload_included"] is False


def test_invalid_known_issue_owner_fails_closed(tmp_path: Path):
    payload = load_maintenance_register(REGISTER)
    payload["known_issues"][0]["owner_role"] = "nobody"
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    try:
        load_maintenance_register(path)
    except ValueError as exc:
        assert "governance is incomplete" in str(exc)
    else:
        raise AssertionError("invalid owner was accepted")
