#!/usr/bin/env python3
"""Explicitly install the permissive DETR object detector for Datascene.

This is never called by analysis.  The analyst/developer invokes it once; the
resulting local model is then loaded with ``local_files_only=True``.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from huggingface_hub import HfApi, snapshot_download


MODEL_ID = "facebook/detr-resnet-50"
REVISION = "main"
TARGET = Path(__file__).resolve().parents[1] / "models" / "object" / "detr-resnet-50"
ALLOW = ["config.json", "preprocessor_config.json", "model.safetensors", "README.md"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    resolved_revision = HfApi().model_info(MODEL_ID, revision=REVISION).sha
    snapshot_path = Path(snapshot_download(
        repo_id=MODEL_ID,
        revision=resolved_revision,
        local_dir=str(TARGET),
        allow_patterns=ALLOW,
    ))
    required = [TARGET / "config.json", TARGET / "preprocessor_config.json", TARGET / "model.safetensors"]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise RuntimeError(f"DETR installation incomplete: {missing}")
    manifest = {
        "schema": "datascene.local_model_installation.v1",
        "model_id": MODEL_ID,
        "requested_revision": REVISION,
        "provider": "Meta / Hugging Face Transformers",
        "license": "Apache-2.0",
        "local_only_after_install": True,
        "resolved_revision": resolved_revision,
        "files": {path.name: {"bytes": path.stat().st_size, "sha256": sha256(path)} for path in required},
        "literature": "https://doi.org/10.1007/978-3-030-58452-8_13",
    }
    (TARGET / "datascene_model_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
