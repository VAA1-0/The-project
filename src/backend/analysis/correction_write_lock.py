"""Cooperative correction-save lock shared with the dashboard process.

Crash-abandoned locks fail closed. They are never stolen using age or PID guesses.
"""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import time
import uuid


class CorrectionWriteBusy(RuntimeError):
    pass


@contextmanager
def correction_write_lock(root: Path, analysis_id: str, timeout_seconds: float = 5):
    if not isinstance(analysis_id, str) or not analysis_id:
        raise ValueError("analysis_id is required")
    key = hashlib.sha256(analysis_id.encode()).hexdigest()
    folder = Path(root) / '.cache' / 'correction-write-locks' / (key + '.lock')
    folder.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            folder.mkdir()
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise CorrectionWriteBusy("Corrections are locked by another writer; retry after it finishes. An abandoned lock requires recovery.")
            time.sleep(.025)
    token = uuid.uuid4().hex
    owner = folder / 'owner.json'
    try:
        owner.write_text(json.dumps({'token': token, 'pid': os.getpid(), 'analysis_id': analysis_id, 'created_at': time.time()}), encoding='utf-8')
    except BaseException:
        # This process created the directory and no other compliant writer can enter.
        owner.unlink(missing_ok=True)
        folder.rmdir()
        raise
    try:
        yield
    finally:
        recorded = json.loads(owner.read_text(encoding='utf-8'))
        if recorded.get('token') != token:
            raise CorrectionWriteBusy("Correction lock ownership changed; refusing to remove another writer's lock")
        owner.unlink()
        folder.rmdir()
