#!/usr/bin/env python3
"""Audit the fixed seven-video Datascene publication cohort."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "outputs" / "api_results"
OUTPUT = RESULTS / "seven_video_publication_readiness_audit.json"
REPORT = RESULTS / "seven_video_publication_readiness_audit.md"


def load(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError, TypeError):
        return {}


def sha256(path: Path) -> str | None:
    if not path.exists() or not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def decision_state(item: dict[str, Any]) -> str:
    return str(item.get("decision") or item.get("status") or "").casefold()


def main() -> None:
    analysis_dirs = sorted(
        path.parent
        for path in RESULTS.glob("*/full_analysis_manifest.json")
        if path.parent.name.count("-") == 4
    )
    analyses: list[dict[str, Any]] = []
    hard_failures: list[str] = []
    warnings: list[str] = []

    for directory in analysis_dirs:
        analysis_id = directory.name
        manifest_path = directory / "full_analysis_manifest.json"
        manifest = load(manifest_path)
        branches = [item for item in manifest.get("branches", []) if isinstance(item, dict)]
        required = [item for item in branches if item.get("required") is True]
        failed_required = [
            item.get("branch_id")
            for item in required
            if item.get("state") != "computed" or item.get("parity_verified") is not True
        ]
        missing_checksums = [
            item.get("branch_id") for item in required if not item.get("artifact_checksum")
        ]
        corrections_path = directory / "annotation_corrections.json"
        corrections = load(corrections_path)
        decisions = [
            item for item in corrections.get("proliferation_decisions", [])
            if isinstance(item, dict)
        ]
        confirmed = [item for item in decisions if "confirm" in decision_state(item)]
        dt_confirmed = [
            item for item in confirmed
            if str(item.get("candidate_id") or "").startswith("narrative-agent-digital-twin:")
        ]
        anchors = [
            item for item in corrections.get("manual_visual_annotations", [])
            if isinstance(item, dict)
        ]
        unanchored_confirmed = [
            item.get("decision_id")
            for item in confirmed
            if not any(
                isinstance(anchor, dict)
                and isinstance(anchor.get("source_time"), dict)
                and anchor["source_time"].get("start") is not None
                for anchor in item.get("source_anchors", [])
            )
        ]
        stale_projection_files = []
        if corrections_path.exists():
            for name in (
                "vaa1_annotation_master_schema.json",
                "mise_en_scene_scene_cards.json",
                "datascene_meaning_network.json",
                "live_mature_data_proliferation_audit.json",
                "decision_ledger.json",
            ):
                candidate = directory / name
                if candidate.exists() and candidate.stat().st_mtime_ns < corrections_path.stat().st_mtime_ns:
                    stale_projection_files.append(name)
        record = load(directory / "analysis_record.json")
        source_path = ROOT / str(record.get("source_video_path") or record.get("file_path") or "")
        source_metadata = load(directory / "source_media_metadata.json")
        source_clock = {
            "duration": source_metadata.get("duration"),
            "fps": source_metadata.get("fps"),
            "timebase": "source_video_seconds",
        }
        manifest_ok = (
            len(required) == int(manifest.get("required_count") or len(required))
            and not failed_required
            and not missing_checksums
            and not manifest.get("blocking_reasons")
        )
        if not manifest_ok:
            hard_failures.append(f"{analysis_id}: manifest is not fully verified")
        if unanchored_confirmed:
            hard_failures.append(f"{analysis_id}: confirmed decisions lack source time")
        if stale_projection_files:
            warnings.append(
                f"{analysis_id}: projections older than the latest corrections: "
                + ", ".join(stale_projection_files)
            )
        analyses.append({
            "analysis_id": analysis_id,
            "original_filename": record.get("original_filename"),
            "manifest": {
                "path": str(manifest_path.relative_to(ROOT)),
                "checksum": sha256(manifest_path),
                "required_count": len(required),
                "delivered_count": manifest.get("delivered_count"),
                "delivery_percentage": manifest.get("delivery_percentage"),
                "overall_state": manifest.get("overall_state"),
                "blocking_reasons": manifest.get("blocking_reasons") or [],
                "failed_required_branches": failed_required,
                "required_branches_without_checksums": missing_checksums,
                "pass": manifest_ok,
            },
            "source": {
                "path": str(source_path.relative_to(ROOT)) if source_path.exists() else str(source_path),
                "checksum": sha256(source_path),
                "clock": source_clock,
            },
            "governance": {
                "manual_visual_annotations": len(anchors),
                "proliferation_decisions": len(decisions),
                "confirmed_decisions": len(confirmed),
                "confirmed_digital_twins": len(dt_confirmed),
                "confirmed_decisions_without_source_time": unanchored_confirmed,
                "decision_ledger_checksum": sha256(directory / "decision_ledger.json"),
                "stale_projection_files": stale_projection_files,
            },
        })

    if len(analyses) != 7:
        hard_failures.append(f"Publication cohort contains {len(analyses)} analyses, expected 7")
    payload = {
        "schema": "datascene.seven_video_publication_readiness.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cohort": {
            "analysis_ids": [item["analysis_id"] for item in analyses],
            "analysis_count": len(analyses),
            "selection_method": "seven analyses with full_analysis_manifest.json",
            "immutable_input_rule": "Do not rerun analysis to obtain newer timestamps.",
        },
        "summary": {
            "manifest_pass_count": sum(item["manifest"]["pass"] for item in analyses),
            "hard_failure_count": len(hard_failures),
            "warning_count": len(warnings),
            "technical_send_state": (
                "blocked"
                if hard_failures
                else "pass_with_warnings"
                if warnings
                else "pass"
            ),
        },
        "analyses": analyses,
        "hard_failures": hard_failures,
        "warnings": warnings,
        "analyst_or_legal_signoff_required": [
            "recipient and source-media distribution intent",
            "privacy and consent boundaries",
            "licensing and copyright-sensitive material",
            "substantive correctness of Narrative Agent recognitions and interpretive claims",
        ],
        "known_platform_limitations": [
            "contradiction resolution is unsupported; conflicts must remain disclosed",
            "cross-video matcher output remains candidate-only unless explicitly confirmed",
        ],
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = [
        "# Seven-video publication readiness audit",
        "",
        f"Technical send state: **{payload['summary']['technical_send_state']}**",
        f"Manifest coverage: **{payload['summary']['manifest_pass_count']}/7 passed**",
        f"Hard failures: **{len(hard_failures)}** · Warnings: **{len(warnings)}**",
        "",
        "## Cohort",
        "",
    ]
    for item in analyses:
        lines.append(
            f"- `{item['analysis_id']}` — {item['original_filename'] or 'unnamed'} — "
            f"manifest {'PASS' if item['manifest']['pass'] else 'FAIL'}, "
            f"{item['governance']['confirmed_digital_twins']} confirmed DT decision(s)"
        )
    lines.extend(["", "## Hard failures", ""])
    lines.extend(f"- {item}" for item in hard_failures or ["None."])
    lines.extend(["", "## Warnings", ""])
    lines.extend(f"- {item}" for item in warnings or ["None."])
    lines.extend(["", "## Requires analyst/legal sign-off", ""])
    lines.extend(f"- {item}" for item in payload["analyst_or_legal_signoff_required"])
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(payload["summary"], indent=2))
    print(OUTPUT)
    print(REPORT)


if __name__ == "__main__":
    main()
