"""Release ownership, known-issue and diagnostic-redaction qualification."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
from typing import Any, Mapping


SCHEMA = "vaa1.release_maintenance_register.v1"
SEVERITIES = {"P0", "P1", "P2", "P3"}
ISSUE_STATES = {"open", "mitigated", "closed", "accepted_risk"}


def load_maintenance_register(path: Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("schema") != SCHEMA:
        raise ValueError("Unsupported release maintenance register")
    roles = payload.get("roles")
    if not isinstance(roles, list) or not roles:
        raise ValueError("Release roles are missing")
    role_ids = {str(item.get("id") or "") for item in roles}
    if "" in role_ids or len(role_ids) != len(roles):
        raise ValueError("Release role identities must be unique")
    severity_rows = payload.get("severity_policy")
    if not isinstance(severity_rows, list) or {item.get("severity") for item in severity_rows} != SEVERITIES:
        raise ValueError("Severity policy must define P0 through P3")
    issues = payload.get("known_issues")
    if not isinstance(issues, list):
        raise ValueError("Known-issues register is missing")
    issue_ids: set[str] = set()
    for issue in issues:
        issue_id = str(issue.get("id") or "")
        if not issue_id or issue_id in issue_ids:
            raise ValueError("Known issue identities must be unique")
        issue_ids.add(issue_id)
        if issue.get("severity") not in SEVERITIES or issue.get("status") not in ISSUE_STATES:
            raise ValueError(f"Known issue classification is invalid: {issue_id}")
        if issue.get("owner_role") not in role_ids or not issue.get("summary") or not issue.get("mitigation"):
            raise ValueError(f"Known issue governance is incomplete: {issue_id}")
    return payload


def maintenance_assessment(register_path: Path, root: Path) -> dict[str, Any]:
    register = load_maintenance_register(register_path)
    severity = {item["severity"]: item for item in register["severity_policy"]}
    blockers = []
    unassigned = [item["id"] for item in register["roles"] if not str(item.get("assignee") or "").strip()]
    if unassigned:
        blockers.append("accountable_roles_unassigned")
    blocking_issues = [
        issue["id"] for issue in register["known_issues"]
        if severity[issue["severity"]]["release_blocking"] and issue["status"] != "closed"
    ]
    if blocking_issues:
        blockers.append("release_blocking_known_issues_open")
    missing_evidence = []
    for issue in register["known_issues"]:
        for evidence in issue.get("evidence") or []:
            if not (Path(root) / evidence).is_file():
                missing_evidence.append(evidence)
    release_notes = str(register.get("release_notes") or "")
    if not release_notes or not (Path(root) / release_notes).is_file():
        blockers.append("release_notes_missing")
    if missing_evidence:
        blockers.append("known_issue_evidence_missing")
    return {
        "schema": "vaa1.release_maintenance_assessment.v1",
        "product_release": register["product_release"],
        "qualification": "qualified" if not blockers else "blocked",
        "release_blockers": blockers,
        "unassigned_roles": unassigned,
        "blocking_known_issue_ids": blocking_issues,
        "missing_evidence": sorted(set(missing_evidence)),
        "severity_policy": register["severity_policy"],
        "known_issues": register["known_issues"],
        "patch_and_rollback": register["patch_and_rollback"],
        "model_update_policy": register["model_update_policy"],
        "release_notes": release_notes,
    }


def _redact_value(key: str, value: Any, policy: Mapping[str, Any], account: dict[str, int]) -> Any:
    normalized = key.casefold()
    if any(token in normalized for token in policy["redact_keys"]):
        account["secret_fields_redacted"] += 1
        return "[REDACTED]"
    if normalized in policy["withhold_content_keys"]:
        account["content_fields_withheld"] += 1
        return "[WITHHELD]"
    if isinstance(value, Mapping):
        return {str(child): _redact_value(str(child), nested, policy, account) for child, nested in value.items()}
    if isinstance(value, list):
        return [_redact_value(key, nested, policy, account) for nested in value]
    if isinstance(value, str) and ("path" in normalized or re.match(r"^(?:/|[A-Za-z]:[\\/])", value)):
        account["paths_reduced"] += 1
        return f"<redacted-root>/{Path(value).name}"
    return value


def build_redacted_diagnostic_bundle(payload: Mapping[str, Any], policy: Mapping[str, Any]) -> dict[str, Any]:
    allowed = ("runtime", "component_versions", "error_classes", "known_issue_refs")
    account = {"secret_fields_redacted": 0, "content_fields_withheld": 0, "paths_reduced": 0, "top_level_fields_dropped": 0}
    projected = {}
    for key in allowed:
        if key in payload:
            projected[key] = _redact_value(key, payload[key], policy, account)
    account["top_level_fields_dropped"] = len(set(payload) - set(allowed))
    identity = hashlib.sha256(json.dumps(projected, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
    return {
        "schema": policy["schema"],
        **projected,
        "redaction_account": account,
        "content_identity_sha256": identity,
        "raw_payload_included": False,
    }
