"""Offline supply-chain inventory and fail-closed release qualification."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
from typing import Any, Mapping


SCHEMA = "vaa1.supply_chain_assessment.v1"
REQUIREMENT = re.compile(r"^([A-Za-z0-9_.-]+)==([^\s;]+)(.*)$")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def assess_python_requirements(path: Path) -> dict[str, Any]:
    pinned: list[dict[str, Any]] = []
    unpinned: list[str] = []
    unhashed: list[str] = []
    logical_lines: list[str] = []
    continuation = ""
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        stripped = raw.strip()
        continuation = f"{continuation} {stripped}".strip()
        if continuation.endswith("\\"):
            continuation = continuation[:-1].rstrip()
            continue
        logical_lines.append(continuation)
        continuation = ""
    if continuation:
        logical_lines.append(continuation)
    for raw in logical_lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = REQUIREMENT.match(line)
        if not match:
            unpinned.append(line)
            continue
        name, version, suffix = match.groups()
        has_hash = "--hash=sha256:" in suffix
        pinned.append({"name": name.lower(), "version": version, "artifact_hash_pinned": has_hash})
        if not has_hash:
            unhashed.append(name.lower())
    return {
        "manifest": str(path),
        "manifest_sha256": _sha256(Path(path)),
        "dependency_count": len(pinned) + len(unpinned),
        "pinned_count": len(pinned),
        "unpinned_entries": unpinned,
        "unhashed_dependencies": sorted(unhashed),
        "artifact_integrity_complete": not unpinned and not unhashed,
        "components": pinned,
    }


def assess_npm_lock(path: Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("lockfileVersion") not in {2, 3}:
        raise ValueError(f"Unsupported npm lockfile version in {path}")
    missing: list[str] = []
    components: list[dict[str, Any]] = []
    for location, raw in sorted((payload.get("packages") or {}).items()):
        if not location or not isinstance(raw, Mapping) or "node_modules/" not in location:
            continue
        version = raw.get("version")
        resolved = raw.get("resolved")
        integrity = raw.get("integrity")
        local_link = bool(raw.get("link")) or (isinstance(resolved, str) and resolved.startswith("file:"))
        if not local_link and (not version or not resolved or not integrity):
            missing.append(location)
        components.append(
            {
                "location": location,
                "version": version,
                "resolved": resolved,
                "integrity": integrity,
                "local_link": local_link,
            }
        )
    return {
        "manifest": str(path),
        "manifest_sha256": _sha256(Path(path)),
        "lockfile_version": payload.get("lockfileVersion"),
        "component_count": len(components),
        "missing_integrity_entries": missing,
        "artifact_integrity_complete": not missing,
        "components": components,
    }


def assess_model_manifest(path: Path) -> dict[str, Any]:
    manifest_path = Path(path)
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    failures: list[str] = []
    files: list[dict[str, Any]] = []
    if payload.get("schema") != "datascene.local_model_installation.v1":
        failures.append("schema_unsupported")
    if not payload.get("files"):
        failures.append("file_inventory_missing")
    for name, descriptor in sorted((payload.get("files") or {}).items()):
        candidate = manifest_path.parent / name
        expected_hash = str((descriptor or {}).get("sha256") or "")
        expected_size = (descriptor or {}).get("bytes")
        if not candidate.is_file():
            failures.append(f"missing:{name}")
            continue
        actual_hash = _sha256(candidate)
        actual_size = candidate.stat().st_size
        if actual_hash != expected_hash:
            failures.append(f"checksum:{name}")
        if expected_size is None or actual_size != int(expected_size):
            failures.append(f"size:{name}")
        files.append({"name": name, "sha256": actual_hash, "size_bytes": actual_size})
    revision = str(payload.get("resolved_revision") or "")
    if not re.fullmatch(r"[0-9a-f]{40,64}", revision):
        failures.append("resolved_revision_not_immutable")
    if not payload.get("license"):
        failures.append("license_missing")
    if payload.get("local_only_after_install") is not True:
        failures.append("local_only_policy_missing")
    return {
        "manifest": str(manifest_path),
        "model_id": payload.get("model_id"),
        "resolved_revision": revision,
        "license": payload.get("license"),
        "local_only_after_install": payload.get("local_only_after_install") is True,
        "files": files,
        "verification_failures": failures,
        "verified": not failures,
    }


def build_supply_chain_assessment(root: Path) -> dict[str, Any]:
    root = Path(root)
    lock_path = root / "requirements-pip.lock"
    python = assess_python_requirements(lock_path if lock_path.is_file() else root / "requirements.txt")
    npm = [
        assess_npm_lock(root / "package-lock.json"),
        assess_npm_lock(root / "src/frontend/package-lock.json"),
    ]
    model_manifests = sorted(root.glob("models/**/datascene_model_manifest.json"))
    models = [assess_model_manifest(path) for path in model_manifests]
    for assessment in [python, *npm, *models]:
        assessment["manifest"] = str(Path(assessment["manifest"]).relative_to(root))
    blockers: list[str] = []
    if python["unpinned_entries"]:
        blockers.append("python_dependencies_not_exactly_pinned")
    if python["unhashed_dependencies"]:
        blockers.append("python_distribution_hashes_missing")
    if any(not item["artifact_integrity_complete"] for item in npm):
        blockers.append("npm_lock_integrity_incomplete")
    if not models:
        blockers.append("model_inventory_missing")
    if any(not item["verified"] for item in models):
        blockers.append("model_artifact_verification_failed")
    install_receipts = []
    evidence_dir = root / "outputs" / "release_install_evidence"
    lock_sha = python["manifest_sha256"]
    for platform in ("macos", "windows"):
        receipt_path = evidence_dir / f"{platform}.json"
        if not receipt_path.is_file():
            install_receipts.append({"platform": platform, "status": "missing"})
            continue
        try:
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            verified = (
                receipt.get("schema") == "vaa1.clean_install_receipt.v1"
                and receipt.get("platform") == platform
                and receipt.get("requirements_lock_sha256") == lock_sha
                and receipt.get("clean_install_passed") is True
                and receipt.get("startup_passed") is True
                and receipt.get("installer_integrity_verified") is True
                and bool(receipt.get("installer_sha256"))
                and bool(receipt.get("system_revision"))
            )
            install_receipts.append({"platform": platform, "status": "verified" if verified else "invalid"})
        except (OSError, json.JSONDecodeError):
            install_receipts.append({"platform": platform, "status": "invalid"})
    if any(item["status"] != "verified" for item in install_receipts):
        blockers.append("platform_install_and_installer_integrity_evidence_missing")
    return {
        "schema": SCHEMA,
        "qualification": "qualified" if not blockers else "blocked",
        "release_blockers": blockers,
        "python": python,
        "npm": npm,
        "models": models,
        "platform_install_receipts": install_receipts,
        "network_install_policy": "no_unverified_runtime_downloads",
        "secret_policy": "credentials_external_to_manifests_and_exports",
        "limitations": [
            "This offline assessment does not replace a current vulnerability advisory scan.",
            "A pinned version is not artifact integrity unless its distribution hash is also pinned.",
        ],
    }
