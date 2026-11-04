#!/usr/bin/env python3
"""Explicitly install the local YuNet/SFace measurement models.

Datascene never downloads model weights during analysis. Running this command is
the operator's explicit installation action; every file is checksum verified.
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import tempfile
import urllib.request


MODELS = (
    {
        "name": "YuNet 2023mar",
        "filename": "face_detection_yunet_2023mar.onnx",
        "url": "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "sha256": "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
        "license": "MIT",
    },
    {
        "name": "SFace 2021dec",
        "filename": "face_recognition_sface_2021dec.onnx",
        "url": "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "sha256": "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
        "license": "Apache-2.0",
    },
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    repository = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Install checksum-verified local face measurement models")
    parser.add_argument("--destination", type=Path, default=repository / "models" / "face")
    parser.add_argument("--replace", action="store_true", help="Replace a present file only when its checksum is wrong")
    args = parser.parse_args()
    destination = args.destination.expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    for model in MODELS:
        target = destination / model["filename"]
        if target.is_file() and sha256(target) == model["sha256"]:
            print(f"ready: {model['name']} ({model['license']}) -> {target}")
            continue
        if target.exists() and not args.replace:
            raise SystemExit(f"checksum mismatch: {target}; rerun with --replace after reviewing the file")
        with tempfile.NamedTemporaryFile(prefix=f".{target.name}.", dir=destination, delete=False) as temporary:
            temporary_path = Path(temporary.name)
        try:
            print(f"downloading: {model['name']} ({model['license']})")
            urllib.request.urlretrieve(model["url"], temporary_path)
            actual = sha256(temporary_path)
            if actual != model["sha256"]:
                raise SystemExit(f"checksum mismatch for {model['name']}: expected {model['sha256']}, received {actual}")
            temporary_path.replace(target)
            print(f"installed: {target}")
        finally:
            if temporary_path.exists():
                temporary_path.unlink()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
