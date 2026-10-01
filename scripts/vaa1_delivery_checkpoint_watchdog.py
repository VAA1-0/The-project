#!/usr/bin/env python3
"""Unattended, checkpoint-safe recovery for the final Datascene delivery queue."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "outputs" / "api_results"
RUNTIME = ROOT / "outputs" / "runtime"
SNAPSHOTS = ROOT / "backups" / "delivery-watchdog"
STATE = RUNTIME / "delivery_watchdog_state.json"
LOG = RUNTIME / "delivery_watchdog.log"
API_ROOT = "http://127.0.0.1:8000"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def log(message: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as handle:
        handle.write(f"{now()} {message}\n")


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def request(path: str, method: str = "GET", timeout: int = 10) -> dict[str, Any]:
    req = urllib.request.Request(f"{API_ROOT}{path}", method=method)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        value = json.loads(response.read().decode("utf-8"))
        return value if isinstance(value, dict) else {}


def launch(analysis_id: str) -> None:
    path = (
        f"/api/analyze/{analysis_id}?pipeline_type=full&analysis_tier=science_scan"
        "&modality_focus=multimodal&morphology_pack_policy=core_only"
        "&allow_rough_interpretation=true"
    )
    try:
        request(path, method="POST", timeout=30)
        log(f"launched {analysis_id} through governed resume endpoint")
    except urllib.error.HTTPError as exc:
        if exc.code != 409:
            raise
        log(f"launch admission deferred for {analysis_id}; another worker is active")


def snapshot(analysis_id: str, reason: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    destination = SNAPSHOTS / f"{stamp}-{analysis_id}-{reason}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["cp", "-cR", str(RESULTS / analysis_id), str(destination)],
        check=True,
    )
    log(f"snapshot {destination}")
    return destination


def restart_backend() -> subprocess.Popen[bytes]:
    log("checkpoint stall confirmed; restarting backend only")
    process = subprocess.Popen(
        ["bash", str(ROOT / "scripts" / "start_vaa1_macos.sh"), "--backend-only", "--replace"],
        cwd=ROOT,
        stdout=(RUNTIME / "delivery_watchdog_backend.log").open("ab"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    deadline = time.time() + 120
    while time.time() < deadline:
        try:
            request("/api/health", timeout=3)
            log("backend recovered and health endpoint is responding")
            return process
        except Exception:
            time.sleep(2)
    raise RuntimeError("backend did not recover within 120 seconds")


def signature(analysis_id: str) -> tuple[str, dict[str, Any]]:
    directory = RESULTS / analysis_id
    record = read_json(directory / "analysis_record.json")
    checkpoint = read_json(directory / "visual_frame_scan_checkpoint.json")
    status = str(record.get("status") or "unknown")
    visual_error = record.get("visual_error")
    checkpoint_present = bool(checkpoint)
    visual_checkpoint_incomplete = checkpoint_present and checkpoint.get("completed") is not True
    visual_payload = ((record.get("results") or {}).get("visual_analysis") or {})
    visual_payload_missing = status == "completed" and not bool(visual_payload)
    complete = (
        status == "completed"
        and not visual_error
        and not visual_checkpoint_incomplete
        and not visual_payload_missing
    )
    value = "|".join(
        str(item)
        for item in (
            status,
            record.get("mission_stage"),
            record.get("progress"),
            checkpoint.get("next_index"),
            checkpoint.get("completed"),
        )
    )
    return value, {
        "status": status,
        "complete": complete,
        "visual_error": visual_error,
        "visual_checkpoint_incomplete": visual_checkpoint_incomplete,
        "visual_payload_missing": visual_payload_missing,
        "mission_stage": record.get("mission_stage"),
        "progress": record.get("progress"),
        "next_index": checkpoint.get("next_index"),
        "checkpoint_updated_at": checkpoint.get("updated_at"),
    }


def run(
    queue: list[str],
    poll_seconds: int,
    stall_seconds: int,
    max_recoveries: int,
    cycle_cooling_seconds: int,
) -> int:
    state = read_json(STATE)
    state.update({"schema": "vaa1.delivery_watchdog.v1", "queue": queue, "pid": os.getpid()})
    last_signature: dict[str, str] = {}
    last_advance: dict[str, float] = {}
    recoveries: dict[str, int] = {
        key: int(value) for key, value in (state.get("recoveries") or {}).items()
    }
    cycle_attempts: dict[str, int] = {
        key: int(value) for key, value in (state.get("cycle_attempts") or {}).items()
    }
    recovery_cycles: dict[str, int] = {
        key: int(value) for key, value in (state.get("recovery_cycles") or {}).items()
    }
    log(f"watchdog started pid={os.getpid()} queue={queue}")

    while True:
        current = next((item for item in queue if not signature(item)[1]["complete"]), None)
        if current is None:
            state.update(status="completed", current_analysis_id=None, updated_at=now())
            atomic_json(STATE, state)
            log("delivery queue completed")
            return 0

        current_signature, detail = signature(current)
        current_time = time.time()
        if last_signature.get(current) != current_signature:
            last_signature[current] = current_signature
            last_advance[current] = current_time
            log(f"progress {current} {detail}")
        elif current not in last_advance:
            last_advance[current] = current_time

        status = detail["status"]
        stage = str(detail.get("mission_stage") or "")
        processing = status == "processing"
        stalled = processing and current_time - last_advance[current] >= stall_seconds

        state.update(
            status="recovering" if stalled else "monitoring",
            current_analysis_id=current,
            current_detail=detail,
            last_advance_at=datetime.fromtimestamp(last_advance[current], timezone.utc).isoformat(),
            recoveries=recoveries,
            cycle_attempts=cycle_attempts,
            recovery_cycles=recovery_cycles,
            updated_at=now(),
        )
        atomic_json(STATE, state)

        if stalled:
            attempt = cycle_attempts.get(current, 0)
            if attempt >= max_recoveries:
                recovery_cycles[current] = recovery_cycles.get(current, 0) + 1
                cooling_until = time.time() + cycle_cooling_seconds
                state.update(
                    status="recovery_cycle_cooling",
                    cooling_until_epoch=cooling_until,
                    recoveries=recoveries,
                    cycle_attempts=cycle_attempts,
                    recovery_cycles=recovery_cycles,
                    updated_at=now(),
                )
                atomic_json(STATE, state)
                log(
                    f"{current} completed {max_recoveries} recovery attempts; "
                    f"cooling {cycle_cooling_seconds}s before renewed checkpoint evaluation"
                )
                while time.time() < cooling_until:
                    time.sleep(min(poll_seconds, max(1, cooling_until - time.time())))
                cycle_attempts[current] = 0
                last_advance[current] = time.time()
                last_signature.pop(current, None)
                state.pop("cooling_until_epoch", None)
                continue
            snapshot(current, f"stall-{stage or 'unknown'}")
            restart_backend()
            launch(current)
            recoveries[current] = recoveries.get(current, 0) + 1
            cycle_attempts[current] = attempt + 1
            last_advance[current] = time.time()
            last_signature.pop(current, None)
        elif status != "processing":
            try:
                launch(current)
            except Exception as exc:
                log(f"launch retry failed for {current}: {exc}")

        time.sleep(poll_seconds)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("analysis_ids", nargs="+")
    parser.add_argument("--poll-seconds", type=int, default=30)
    parser.add_argument("--stall-seconds", type=int, default=300)
    parser.add_argument("--max-recoveries", type=int, default=3)
    parser.add_argument("--cycle-cooling-seconds", type=int, default=600)
    args = parser.parse_args()
    return run(
        args.analysis_ids,
        max(10, args.poll_seconds),
        max(300, args.stall_seconds),
        max(1, args.max_recoveries),
        max(10, args.cycle_cooling_seconds),
    )


if __name__ == "__main__":
    raise SystemExit(main())
