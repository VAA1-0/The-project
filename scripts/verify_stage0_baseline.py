#!/usr/bin/env python3
"""Verify the General Sprint Stage 0 baseline without mutating saved work."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def _json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _git(root: Path, *args: str) -> str | None:
    try:
        return subprocess.run(
            ["git", *args], cwd=root, check=True, capture_output=True, text=True
        ).stdout.strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None


def build_baseline(root: Path, project_id: str) -> dict[str, Any]:
    records_root = root / "outputs" / "api_results"
    issues: list[dict[str, str]] = []
    analyses: list[dict[str, Any]] = []
    source_owners: dict[str, str] = {}

    for record_path in sorted(records_root.glob("*/analysis_record.json")):
        try:
            record = _json(record_path)
        except (OSError, json.JSONDecodeError) as exc:
            issues.append({"code": "INVALID_ANALYSIS_RECORD", "path": str(record_path), "detail": str(exc)})
            continue
        if str(record.get("project_id") or "") != project_id:
            continue

        analysis_id = str(record.get("analysis_id") or "")
        analysis_dir = record_path.parent
        item_issues: list[str] = []
        if not analysis_id or analysis_dir.name != analysis_id:
            item_issues.append("ANALYSIS_DIRECTORY_ID_MISMATCH")

        source_value = str(record.get("source_video_path") or "")
        source_path = Path(source_value)
        if not source_path.is_absolute():
            source_path = root / source_path
        source_key = str(source_path.resolve(strict=False))
        if not source_value or not source_path.is_file():
            item_issues.append("SOURCE_MEDIA_MISSING")
        elif source_key in source_owners and source_owners[source_key] != analysis_id:
            item_issues.append("SOURCE_MEDIA_SHARED_ACROSS_ANALYSES")
        else:
            source_owners[source_key] = analysis_id

        manifest_path = analysis_dir / "full_analysis_manifest.json"
        artifact_checks = {"registered": 0, "present": 0, "checksum_verified": 0}
        if not manifest_path.is_file():
            item_issues.append("FULL_ANALYSIS_MANIFEST_MISSING")
        else:
            try:
                manifest = _json(manifest_path)
                if str(manifest.get("analysis_id") or "") != analysis_id:
                    item_issues.append("MANIFEST_ANALYSIS_ID_MISMATCH")
                for branch in manifest.get("branches") or []:
                    value = branch.get("artifact_path")
                    if not value:
                        continue
                    artifact_checks["registered"] += 1
                    artifact_path = Path(str(value))
                    if not artifact_path.is_absolute():
                        artifact_path = root / artifact_path
                    if not artifact_path.is_file():
                        item_issues.append(f"ARTIFACT_MISSING:{branch.get('branch_id', 'unknown')}")
                        continue
                    artifact_checks["present"] += 1
                    expected = branch.get("artifact_checksum")
                    if expected:
                        if _sha256(artifact_path) != expected:
                            item_issues.append(f"ARTIFACT_CHECKSUM_MISMATCH:{branch.get('branch_id', 'unknown')}")
                        else:
                            artifact_checks["checksum_verified"] += 1
            except (OSError, json.JSONDecodeError) as exc:
                item_issues.append(f"INVALID_FULL_ANALYSIS_MANIFEST:{exc}")

        recovery_files: dict[str, str] = {"analysis_record.json": _sha256(record_path)}
        correction_path = analysis_dir / "annotation_corrections.json"
        if correction_path.is_file():
            try:
                corrections = _json(correction_path)
                correction_analysis = str(corrections.get("analysis_id") or "") if isinstance(corrections, dict) else ""
                if correction_analysis and correction_analysis != analysis_id:
                    item_issues.append("CORRECTION_ANALYSIS_ID_MISMATCH")
                recovery_files["annotation_corrections.json"] = _sha256(correction_path)
            except (OSError, json.JSONDecodeError) as exc:
                item_issues.append(f"INVALID_CORRECTION_FILE:{exc}")

        ledger = record.get("canonical_decision_ledger")
        if not isinstance(ledger, dict) or str(ledger.get("analysis_id") or "") != analysis_id:
            item_issues.append("CANONICAL_LEDGER_ID_MISMATCH")
        else:
            recovery_files["embedded_canonical_decision_ledger"] = "sha256:" + hashlib.sha256(
                json.dumps(ledger, sort_keys=True, separators=(",", ":")).encode("utf-8")
            ).hexdigest()

        analyses.append(
            {
                "analysis_id": analysis_id,
                "project_id": project_id,
                "filename": record.get("filename"),
                "status": record.get("status"),
                "source_media": {
                    "path": source_value,
                    "size_bytes": source_path.stat().st_size if source_path.is_file() else None,
                    "fingerprint": _sha256(source_path) if source_path.is_file() else None,
                },
                "artifacts": artifact_checks,
                "recovery_fingerprints": recovery_files,
                "issues": item_issues,
            }
        )
        issues.extend({"code": issue, "analysis_id": analysis_id} for issue in item_issues)

    if not analyses:
        issues.append({"code": "PROJECT_HAS_NO_ANALYSES", "project_id": project_id})

    return {
        "schema": "datascene.general_sprint.stage0_baseline.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "repository": {
            "head": _git(root, "rev-parse", "HEAD"),
            "branch": _git(root, "branch", "--show-current"),
            "worktree_status": (_git(root, "status", "--short") or "").splitlines(),
        },
        "summary": {
            "gate": "pass" if not issues else "fail",
            "analysis_count": len(analyses),
            "completed_count": sum(item["status"] == "completed" for item in analyses),
            "issue_count": len(issues),
        },
        "analyses": analyses,
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, help="Exact governed project ID")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    report = build_baseline(args.root.resolve(), args.project)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["summary"]["gate"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
