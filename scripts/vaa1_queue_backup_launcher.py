#!/usr/bin/env python3
"""Checkpoint-aware backup launcher for a persisted Datascene analysis queue."""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TERMINAL_FAILURES = {"error", "failed", "partial"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def request_json(url: str, method: str = "GET") -> dict[str, Any]:
    request = urllib.request.Request(url, method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def start_url(api_root: str, analysis_id: str, profile: dict[str, Any]) -> str:
    query = urllib.parse.urlencode(
        {
            "pipeline_type": profile.get("pipeline_type", "full"),
            "analysis_tier": profile.get("analysis_tier", "science_scan"),
            "modality_focus": profile.get("modality_focus", "multimodal"),
            "morphology_pack_policy": profile.get("morphology_pack_policy", "core_only"),
            "allow_rough_interpretation": str(
                bool(profile.get("allow_rough_interpretation", True))
            ).lower(),
        }
    )
    return f"{api_root}/api/analyze/{analysis_id}?{query}"


def queue_decision(status: str) -> str:
    if status == "completed":
        return "advance"
    if status == "processing":
        return "monitor"
    if status in TERMINAL_FAILURES:
        return "stop"
    return "start"


class QueueLauncher:
    def __init__(self, manifest_path: Path) -> None:
        self.manifest_path = manifest_path
        self.manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.api_root = str(self.manifest.get("api_root") or "http://127.0.0.1:8000").rstrip("/")
        self.analysis_ids = [str(item) for item in self.manifest.get("analysis_ids") or []]
        self.profile = self.manifest.get("profile") if isinstance(self.manifest.get("profile"), dict) else {}
        self.poll_seconds = max(10, int(self.manifest.get("poll_seconds") or 30))
        self.cooling_seconds = max(0, int(self.manifest.get("cooling_seconds") or 600))
        state_value = self.manifest.get("state_path") or "outputs/runtime/analysis_queue_backup_state.json"
        state_path = Path(str(state_value))
        self.state_path = state_path if state_path.is_absolute() else Path.cwd() / state_path
        self.running = True
        self.state: dict[str, Any] = {
            "schema": "vaa1.analysis_queue_backup_state.v1",
            "manifest": str(manifest_path),
            "analysis_ids": self.analysis_ids,
            "status": "starting",
            "current_analysis_id": None,
            "completed_analysis_ids": [],
            "started_at": utc_now(),
            "updated_at": utc_now(),
            "last_message": "Backup launcher starting.",
            "cooling_until_epoch": None,
            "backend_failure_count": 0,
        }

    def save(self, **updates: Any) -> None:
        self.state.update(updates, updated_at=utc_now())
        atomic_json(self.state_path, self.state)

    def status(self, analysis_id: str) -> dict[str, Any]:
        return request_json(f"{self.api_root}/api/status/{analysis_id}/summary")

    def cool(self) -> None:
        if not self.cooling_seconds:
            return
        until = time.time() + self.cooling_seconds
        self.save(
            status="cooling",
            cooling_until_epoch=until,
            last_message=f"Cooling for {self.cooling_seconds} seconds.",
        )
        while self.running and time.time() < until:
            time.sleep(min(self.poll_seconds, max(1, until - time.time())))
        self.save(cooling_until_epoch=None)

    def run(self) -> int:
        if not self.analysis_ids:
            self.save(status="configuration_error", last_message="No analysis IDs in queue manifest.")
            return 2

        completed: list[str] = []
        for index, analysis_id in enumerate(self.analysis_ids):
            if not self.running:
                break
            self.save(current_analysis_id=analysis_id, status="checking")
            while self.running:
                try:
                    record = self.status(analysis_id)
                    self.state["backend_failure_count"] = 0
                except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
                    failures = int(self.state.get("backend_failure_count") or 0) + 1
                    self.save(
                        status="waiting_for_backend",
                        backend_failure_count=failures,
                        last_message=f"Backend unavailable; retrying: {exc}",
                    )
                    time.sleep(self.poll_seconds)
                    continue

                status = str(record.get("status") or "unknown")
                decision = queue_decision(status)
                message = str(record.get("mission_message") or status)
                self.save(
                    status="monitoring" if decision == "monitor" else decision,
                    current_analysis_id=analysis_id,
                    current_analysis_status=status,
                    current_progress=record.get("progress"),
                    last_message=message,
                )

                if decision == "advance":
                    completed.append(analysis_id)
                    self.save(completed_analysis_ids=completed)
                    break
                if decision == "stop":
                    self.save(
                        status="stopped_on_terminal_failure",
                        last_message=f"Queue stopped because {analysis_id} reached {status}.",
                    )
                    return 1
                if decision == "start":
                    try:
                        request_json(start_url(self.api_root, analysis_id, self.profile), method="POST")
                        self.save(status="launched", last_message=f"Started {analysis_id} from governed state {status}.")
                    except urllib.error.HTTPError as exc:
                        # A 409 means another governed run won admission. Wait and
                        # re-evaluate instead of creating a competing process.
                        if exc.code != 409:
                            self.save(status="launch_error", last_message=f"Could not start {analysis_id}: {exc}")
                            return 1
                    time.sleep(self.poll_seconds)
                    continue
                time.sleep(self.poll_seconds)

            if self.running and index < len(self.analysis_ids) - 1:
                self.cool()

        final_status = "completed" if self.running else "stopped"
        self.save(
            status=final_status,
            current_analysis_id=None,
            completed_analysis_ids=completed,
            last_message="Backup queue completed." if self.running else "Backup queue stopped by signal.",
        )
        return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Path to a Datascene queue manifest JSON file")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    launcher = QueueLauncher(args.manifest.resolve())

    def stop(_signum: int, _frame: Any) -> None:
        launcher.running = False

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    return launcher.run()


if __name__ == "__main__":
    sys.exit(main())
