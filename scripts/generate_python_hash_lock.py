#!/usr/bin/env python3
"""Generate a pip --require-hashes lock from exact PyPI requirements.

The script queries only PyPI release metadata. It does not install or execute
downloaded packages. All published files for the exact version are admitted so
one reviewed lock can support multiple release platforms.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import ssl
import urllib.parse
import urllib.request
import urllib.error


PIN = re.compile(r"^([A-Za-z0-9_.-]+)==([^\s;]+)$")


def exact_requirements(path: Path) -> list[tuple[str, str]]:
    rows = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = PIN.fullmatch(line)
        if not match:
            raise ValueError(f"Requirement is not an exact PyPI pin: {line}")
        rows.append(match.groups())
    return rows


def release_hashes(name: str, version: str) -> list[str]:
    url = f"https://pypi.org/pypi/{urllib.parse.quote(name)}/{urllib.parse.quote(version)}/json"
    request = urllib.request.Request(url, headers={"User-Agent": "Datascene-release-lock/0.1"})
    try:
        import certifi
        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        context = ssl.create_default_context()
    try:
        with urllib.request.urlopen(request, timeout=30, context=context) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        raise ValueError(f"PyPI metadata unavailable for {name}=={version}: HTTP {exc.code}") from exc
    hashes = sorted({
        str(item.get("digests", {}).get("sha256") or "")
        for item in payload.get("urls", [])
        if item.get("yanked") is not True
    } - {""})
    if not hashes:
        raise ValueError(f"PyPI publishes no SHA-256 artifacts for {name}=={version}")
    return hashes


def render_lock(requirements: list[tuple[str, str]]) -> str:
    lines = [
        "# Datascene #0.1 pip artifact lock",
        "# Generated from exact requirements.txt pins using published PyPI SHA-256 metadata.",
        "# Install with: python -m pip install --require-hashes -r requirements-pip.lock",
        "",
    ]
    for name, version in requirements:
        hashes = release_hashes(name, version)
        lines.append(f"{name}=={version} \\")
        for index, digest in enumerate(hashes):
            suffix = " \\" if index < len(hashes) - 1 else ""
            lines.append(f"    --hash=sha256:{digest}{suffix}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("requirements.txt"))
    parser.add_argument("--output", type=Path, default=Path("requirements-pip.lock"))
    args = parser.parse_args()
    rendered = render_lock(exact_requirements(args.input))
    args.output.write_text(rendered, encoding="utf-8")
    print(f"Wrote {args.output} with {len(exact_requirements(args.input))} exact distributions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
