"""Resolve media executables from the active runtime before pipeline imports."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import sys
from typing import Any


def configure_media_executables() -> dict[str, Any]:
    required = ("ffmpeg", "ffprobe")
    resolved = {name: shutil.which(name) for name in required}
    runtime_bin = Path(sys.executable).resolve().parent
    sibling_hits = {
        name: str(runtime_bin / name)
        for name in required
        if not resolved[name] and (runtime_bin / name).is_file()
    }
    if sibling_hits:
        current = os.environ.get("PATH", "")
        os.environ["PATH"] = f"{runtime_bin}{os.pathsep}{current}"
        resolved = {name: shutil.which(name) for name in required}
    return {
        "runtime_bin": str(runtime_bin),
        "executables": resolved,
        "ready": all(resolved.values()),
        "missing": [name for name, path in resolved.items() if not path],
    }
