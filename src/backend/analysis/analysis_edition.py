"""Analyst-governed, immutable completion editions for a saved analysis."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any, Mapping


SCHEMA = "vaa1.analysis_edition.v1"


def _mapping(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def _decisions(status: Mapping[str, Any]) -> list[dict[str, Any]]:
    ledger = _mapping(status.get("canonical_decision_ledger"))
    return [dict(item) for item in ledger.get("decisions", []) if isinstance(item, Mapping)]


def build_completion_account(status: Mapping[str, Any]) -> dict[str, Any]:
    decisions = _decisions(status)
    current = [item for item in decisions if item.get("validity", "current") == "current"]
    accepted = [item for item in current if item.get("review_status") in {"accepted", "confirmed"}]
    candidates = [item for item in current if item.get("review_status") in {"candidate", "unreviewed", None}]
    withheld = [item for item in current if item.get("review_status") in {"rejected", "deferred", "withheld"}]
    outputs = _mapping(status.get("output_files"))
    results = _mapping(status.get("results"))
    limitations = sorted(
        f"{key}: {value}" for key, value in results.items()
        if value and (key.endswith("_error") or "missing" in key or "fallback" in key)
    )
    return {
        "analysis_id": str(status.get("analysis_id") or ""),
        "project_id": str(status.get("project_id") or ""),
        "source": {
            "filename": status.get("original_filename") or status.get("filename"),
            "duration_seconds": _mapping(status.get("source_media_metadata")).get("duration"),
            "clock": "source_media_seconds",
        },
        "scope": {
            "analysis_tier": status.get("analysis_tier") or _mapping(status.get("analysis_profile")).get("analysis_tier"),
            "modality_focus": status.get("modality_focus") or _mapping(status.get("analysis_profile")).get("modality_focus"),
            "pipeline_type": status.get("pipeline_type"),
        },
        "methods": _mapping(status.get("provider_versions")),
        "evidence": {
            "confirmed": len(accepted), "candidates": len(candidates), "withheld": len(withheld),
            "artifact_count": len([value for value in outputs.values() if value]),
        },
        "corrections_and_history": {
            "decision_count": len(decisions),
            "superseded_count": len([item for item in decisions if item.get("validity") == "superseded"]),
        },
        "limitations": limitations,
        "routes": {
            "evidence_navigation": "source-linked panels",
            "runtime_record": outputs.get("analysis_run_record"),
            "publication": "Data Book publication",
        },
    }


def freeze_analysis_edition(status: Mapping[str, Any], output_dir: Path, analyst_note: str = "") -> dict[str, Any]:
    if status.get("status") != "completed":
        raise ValueError("Only a completed analysis can be declared Analysis 1.0 complete")
    output_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted(output_dir.glob("analysis_edition_*.json"))
    edition = len(existing) + 1
    account = build_completion_account(status)
    canonical = json.dumps(account, sort_keys=True, separators=(",", ":")).encode("utf-8")
    receipt = {
        "schema": SCHEMA,
        "edition": edition,
        "label": f"Analysis {edition}.0",
        "decision": "complete",
        "authority": "explicit_analyst_confirmation",
        "frozen_at": datetime.now(timezone.utc).isoformat(),
        "analyst_note": analyst_note.strip() or None,
        "content_identity": hashlib.sha256(canonical).hexdigest(),
        "account": account,
        "later_corrections_policy": "fork_new_edition_do_not_rewrite",
    }
    path = output_dir / f"analysis_edition_{edition}.json"
    path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False), encoding="utf-8")
    return {**receipt, "receipt_path": str(path)}


def latest_analysis_edition(output_dir: Path) -> dict[str, Any] | None:
    candidates = sorted(output_dir.glob("analysis_edition_*.json"))
    if not candidates:
        return None
    return {**json.loads(candidates[-1].read_text(encoding="utf-8")), "receipt_path": str(candidates[-1])}
