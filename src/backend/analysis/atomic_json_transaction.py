"""Cross-thread/process atomic JSON read-modify-write transactions."""

from __future__ import annotations

from contextlib import contextmanager
import json
import os
from pathlib import Path
import time
from typing import Any, Callable, Iterator, Mapping
import uuid

from .analysis_recovery import atomic_write_json


class JsonTransactionBusy(RuntimeError):
    pass


class JsonTransactionInvalid(RuntimeError):
    pass


ABANDONED_LOCK_GRACE_SECONDS = 60.0


def _lock_path(path: Path) -> Path:
    return path.with_name(f".{path.name}.transaction.lock")


def _recover_dead_owner(lock_path: Path) -> bool:
    try:
        owner = json.loads((lock_path / "owner.json").read_text(encoding="utf-8"))
        pid = int(owner["pid"])
        age = time.time() - float(owner["created_at"])
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return False
    if pid <= 0 or age < ABANDONED_LOCK_GRACE_SECONDS:
        return False
    try:
        os.kill(pid, 0)
        return False
    except ProcessLookupError:
        pass
    except (PermissionError, OSError):
        return False
    quarantine = lock_path.with_name(f"{lock_path.name}.abandoned-{uuid.uuid4().hex}")
    try:
        lock_path.rename(quarantine)
    except FileNotFoundError:
        return True
    except OSError:
        return False
    for child in quarantine.iterdir():
        child.unlink(missing_ok=True)
    quarantine.rmdir()
    return True


@contextmanager
def json_transaction_lock(path: Path, timeout_seconds: float = 5.0) -> Iterator[None]:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    lock_path = _lock_path(destination)
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            lock_path.mkdir()
            break
        except FileExistsError:
            if _recover_dead_owner(lock_path):
                continue
            if time.monotonic() >= deadline:
                raise JsonTransactionBusy(f"Timed out waiting to update {destination.name}")
            time.sleep(0.01)
    token = uuid.uuid4().hex
    owner_path = lock_path / "owner.json"
    owner_created = False
    try:
        try:
            owner_path.write_text(
                json.dumps({"token": token, "pid": os.getpid(), "created_at": time.time()}),
                encoding="utf-8",
            )
            owner_created = True
        except BaseException:
            owner_path.unlink(missing_ok=True)
            lock_path.rmdir()
            raise
        yield
    finally:
        if owner_created:
            try:
                recorded = json.loads(owner_path.read_text(encoding="utf-8"))
                if recorded.get("token") != token:
                    raise JsonTransactionBusy("Transaction lock ownership changed")
                owner_path.unlink()
                lock_path.rmdir()
            except FileNotFoundError as exc:
                raise JsonTransactionBusy("Transaction lock disappeared") from exc


def update_json_transaction(
    path: Path,
    *,
    default: Mapping[str, Any],
    mutate: Callable[[dict[str, Any]], None],
    validate: Callable[[Mapping[str, Any]], None] | None = None,
    timeout_seconds: float = 5.0,
) -> dict[str, Any]:
    """Lock, reload, mutate, validate and atomically replace one JSON object."""
    destination = Path(path)
    with json_transaction_lock(destination, timeout_seconds=timeout_seconds):
        if destination.exists():
            try:
                loaded = json.loads(destination.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise JsonTransactionInvalid(f"Existing {destination.name} is unreadable") from exc
            if not isinstance(loaded, dict):
                raise JsonTransactionInvalid(f"Existing {destination.name} must contain an object")
            value = loaded
        else:
            value = json.loads(json.dumps(default))
        mutate(value)
        if validate is not None:
            validate(value)
        atomic_write_json(destination, value)
        return value
