"""Authoritative #0.1 capability disposition and freeze-readiness contract."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping


SCHEMA = "vaa1.release_capability_register.v1"
ALLOWED_STATUSES = ("supported", "experimental", "disabled", "deferred")
DEFAULT_REGISTER_PATH = Path(__file__).resolve().parents[3] / "config" / "release_capability_register.json"
REQUIRED_FIELDS = (
    "id",
    "label",
    "status",
    "owner",
    "supported_inputs",
    "known_limitations",
    "acceptance_evidence",
    "runtime_consequence",
)


def _text(value: Any) -> str:
    return str(value or "").strip()


def validate_release_capability_register(payload: Mapping[str, Any]) -> list[str]:
    errors: list[str] = []
    if payload.get("schema") != SCHEMA:
        errors.append("schema must be vaa1.release_capability_register.v1")
    if payload.get("product_release") != "#0.1":
        errors.append("product_release must be #0.1")
    if payload.get("analysis_edition_label") != "Analysis 1.0":
        errors.append("analysis_edition_label must be Analysis 1.0")
    if tuple(payload.get("status_vocabulary") or ()) != ALLOWED_STATUSES:
        errors.append("status_vocabulary must declare the frozen four-state vocabulary")

    capabilities = payload.get("capabilities")
    if not isinstance(capabilities, list) or not capabilities:
        return [*errors, "capabilities must be a non-empty array"]
    seen: set[str] = set()
    for index, raw in enumerate(capabilities):
        if not isinstance(raw, Mapping):
            errors.append(f"capabilities[{index}] must be an object")
            continue
        capability_id = _text(raw.get("id"))
        prefix = capability_id or f"capabilities[{index}]"
        if capability_id in seen:
            errors.append(f"{prefix}: duplicate id")
        seen.add(capability_id)
        for field in REQUIRED_FIELDS:
            value = raw.get(field)
            if field in {"supported_inputs", "known_limitations", "acceptance_evidence"}:
                if not isinstance(value, list):
                    errors.append(f"{prefix}: {field} must be an array")
            elif not _text(value):
                errors.append(f"{prefix}: {field} is required")
        status = raw.get("status")
        if status not in ALLOWED_STATUSES:
            errors.append(f"{prefix}: unsupported status {status!r}")
        evidence = raw.get("acceptance_evidence")
        if status in {"supported", "experimental"} and isinstance(evidence, list) and not evidence:
            errors.append(f"{prefix}: active capability requires acceptance evidence")
        limitations = raw.get("known_limitations")
        if status != "supported" and isinstance(limitations, list) and not limitations:
            errors.append(f"{prefix}: non-supported capability requires a visible limitation")
    return errors


def load_release_capability_register(path: Path = DEFAULT_REGISTER_PATH) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    errors = validate_release_capability_register(payload)
    if errors:
        raise ValueError("Invalid release capability register: " + "; ".join(errors))
    return payload


def release_capability_account(path: Path = DEFAULT_REGISTER_PATH) -> dict[str, Any]:
    register = load_release_capability_register(path)
    capabilities = register["capabilities"]
    counts = {status: 0 for status in ALLOWED_STATUSES}
    for capability in capabilities:
        counts[capability["status"]] += 1
    freeze_blockers = [
        capability["id"]
        for capability in capabilities
        if capability["status"] == "supported" and not capability["acceptance_evidence"]
    ]
    return {
        **register,
        "summary": {
            "capability_count": len(capabilities),
            "status_counts": counts,
            "freeze_blockers": freeze_blockers,
            "freeze_ready": not freeze_blockers,
            "rule": "Experimental, disabled and deferred capabilities require an explicit disposition but do not masquerade as supported.",
        },
    }
