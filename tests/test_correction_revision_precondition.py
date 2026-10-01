"""Exercise actual save preconditions against replaceable temporary source bytes."""
import ast
import copy
import json
from pathlib import Path
from typing import Any, Dict

import pytest

from src.backend.analysis.correction_write_lock import correction_write_lock, CorrectionWriteBusy
from src.backend.analysis.source_clock_context import (
    build_source_clock_context, canonical_clock_corrections,
    validate_correction_clock_guard, validate_clock_binding, ClockRevisionConflict,
)

ROOT = Path(__file__).resolve().parents[1]


class HTTPException(Exception):
    def __init__(self, status_code, detail, headers=None):
        super().__init__(detail)
        self.status_code = status_code


class PreconditionsPassed(Exception):
    pass


@pytest.mark.parametrize('change,expected', [
    ('media', 409), ('fps', 409), ('duration', 409), ('sample_rate', 409),
    ('missing_media', 409), ('partial', 400), ('null_binding', 409),
    ('current', None), ('legacy', None),
])
def test_actual_handler_checks_revision_under_lock_before_mutation(tmp_path, change, expected):
    source = tmp_path / 'source.mp4'
    source.write_bytes(b'original source')
    sidecar = tmp_path / 'corrections.json'
    sidecar.write_text(json.dumps({'transcript_clock_offset_seconds': 0}))
    status = {
        'source_video_path': str(source),
        'output_files': {'annotation_corrections': str(sidecar)},
        'annotation_corrections': {'manual_visual_annotations': [{'id': 'preserve'}]},
        'source_media_metadata': {'duration_seconds': 10, 'fps': 24, 'audio_sample_rate': 44100},
    }
    aid = 'revision-precondition-fixture'
    context = build_source_clock_context(aid, status, status['source_media_metadata'])
    guard = {'analysis_id': aid, 'transcript_clock_offset_seconds': 0,
             'source_fingerprint': context['source_fingerprint'], 'clock_revision': context['clock_revision']}
    if change == 'media':
        source.write_bytes(b'replaced source')
    elif change in ('fps', 'duration', 'sample_rate'):
        field = {'fps': 'fps', 'duration': 'duration_seconds', 'sample_rate': 'audio_sample_rate'}[change]
        status['source_media_metadata'][field] += 1
    elif change == 'missing_media':
        source.unlink()
    elif change == 'partial':
        del guard['clock_revision']
    elif change == 'null_binding':
        guard.update(source_fingerprint=None, clock_revision=None)
    elif change == 'legacy':
        del guard['clock_revision']
        del guard['source_fingerprint']
    before = copy.deepcopy(status)
    saved = sidecar.read_bytes()
    def checked_context(*args):
        assert list((tmp_path / '.cache/correction-write-locks').glob('*.lock'))
        return build_source_clock_context(*args)
    def stop_before_writes():
        raise PreconditionsPassed()
    tree = ast.parse((ROOT / 'api_server.py').read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'update_annotation_corrections')
    node.decorator_list = []
    env = dict(globals(), BackgroundTasks=object, Body=lambda *a, **kw: None,
               RESULTS_DIR=tmp_path / 'outputs/api_results', get_analysis_entry=lambda _: status,
               build_source_clock_context=checked_context, utc_now_iso=stop_before_writes)
    exec(compile(ast.Module(body=[node], type_ignores=[]), '<actual-revision-save>', 'exec'), env)
    if expected:
        with pytest.raises(HTTPException) as exc:
            env['update_annotation_corrections'](aid, None, {'_clock_write_guard': guard})
        assert exc.value.status_code == expected
        assert status == before
    else:
        # Deliberately stop after preconditions; this is not a persistence test.
        with pytest.raises(PreconditionsPassed):
            env['update_annotation_corrections'](aid, None, {'_clock_write_guard': guard})
    assert sidecar.read_bytes() == saved
    assert not list((tmp_path / '.cache/correction-write-locks').glob('*.lock'))
