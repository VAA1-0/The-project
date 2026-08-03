"""Application-scoped system-sleep inhibition for governed analysis runs."""

from __future__ import annotations

import ctypes
import os
import platform
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AnalysisPowerAssertion:
    system: str = field(default_factory=platform.system)
    process: subprocess.Popen[Any] | None = None
    active: bool = False
    provider: str = "unsupported"
    error: str | None = None
    started_at: str | None = None
    released_at: str | None = None

    def acquire(self) -> "AnalysisPowerAssertion":
        self.started_at = _utc_now()
        try:
            if self.system == "Darwin":
                self.provider = "macos.caffeinate"
                self.process = subprocess.Popen(
                    ["/usr/bin/caffeinate", "-i", "-w", str(os.getpid())],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                self.active = self.process.poll() is None
                if not self.active:
                    self.error = "caffeinate exited before the assertion became active"
            elif self.system == "Windows":
                self.provider = "windows.SetThreadExecutionState"
                # ES_CONTINUOUS | ES_SYSTEM_REQUIRED. Display sleep remains allowed.
                result = ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)
                self.active = bool(result)
                if not self.active:
                    self.error = "SetThreadExecutionState returned zero"
            else:
                self.error = f"No sleep-inhibition provider configured for {self.system}"
        except Exception as exc:  # analysis must remain possible if the OS API is unavailable
            self.error = str(exc)
            self.active = False
        return self

    def release(self) -> None:
        try:
            if self.system == "Darwin" and self.process is not None:
                if self.process.poll() is None:
                    self.process.terminate()
                    try:
                        self.process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        self.process.kill()
                        self.process.wait(timeout=5)
            elif self.system == "Windows" and self.active:
                ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
        finally:
            self.active = False
            self.released_at = _utc_now()

    def record(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "platform": self.system,
            "active": self.active,
            "started_at": self.started_at,
            "released_at": self.released_at,
            "pid": self.process.pid if self.process is not None else None,
            "error": self.error,
            "scope": "system sleep only; display sleep remains allowed",
        }

    def __enter__(self) -> "AnalysisPowerAssertion":
        return self.acquire()

    def __exit__(self, exc_type, exc, traceback) -> None:
        self.release()
