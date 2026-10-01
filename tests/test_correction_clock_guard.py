import ast
import copy
from contextlib import nullcontext
import json
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src/backend/analysis'))
from source_clock_context import canonical_clock_corrections, validate_correction_clock_guard, build_source_clock_context, ClockRevisionConflict


class CorrectionClockGuardTests(unittest.TestCase):
    def test_sidecar_offset_changes_revision_despite_stale_backend_cache(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'source.mp4'
            source.write_bytes(b'fixture')
            sidecar = Path(folder) / 'corrections.json'
            sidecar.write_text(json.dumps({'transcript_clock_offset_seconds': 0}))
            status = {'source_video_path': str(source), 'annotation_corrections': {'transcript_clock_offset_seconds': 99},
                      'output_files': {'annotation_corrections': str(sidecar)}}
            before = copy.deepcopy(status)
            old = build_source_clock_context('clock-guard-fixture', status, {})
            self.assertEqual(old['timebase']['transcript_clock_offset_seconds'], 0)
            sidecar.write_text(json.dumps({'transcript_clock_offset_seconds': 2}))
            self.assertNotEqual(old['clock_revision'], build_source_clock_context('clock-guard-fixture', status, {})['clock_revision'])
            self.assertEqual(status, before)
            sidecar.write_text('broken')
            with self.assertRaises(ClockRevisionConflict):
                canonical_clock_corrections('clock-guard-fixture', status)

    def test_legacy_and_guarded_offset_contract(self):
        guard = {'analysis_id': 'a', 'transcript_clock_offset_seconds': 0}
        validate_correction_clock_guard('a', {}, {'_clock_write_guard': guard, 'transcript_clock_offset_seconds': 2})
        validate_correction_clock_guard('a', {}, {})
        with self.assertRaises(ClockRevisionConflict):
            validate_correction_clock_guard('a', {'transcript_clock_offset_seconds': 2}, {'_clock_write_guard': guard})
        with self.assertRaises(ClockRevisionConflict):
            validate_correction_clock_guard('a', {}, {'transcript_clock_offset_seconds': 2})

    def test_actual_backend_rejects_before_mutating_status_or_saving(self):
        class HTTPException(Exception):
            def __init__(self, status_code, detail):
                self.status_code = status_code
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'update_annotation_corrections')
        node.decorator_list = []
        status = {'annotation_corrections': {'transcript_clock_offset_seconds': 2}}
        before = copy.deepcopy(status)
        env = dict(globals(), BackgroundTasks=object, Body=lambda *a, **k: None,
                   HTTPException=HTTPException, get_analysis_entry=lambda _: status,
                   correction_write_lock=lambda *a: nullcontext(), RESULTS_DIR=Path("/unused/outputs/api_results"),
                   CorrectionWriteBusy=RuntimeError)
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<actual-correction-route>', 'exec'), env)
        with self.assertRaises(HTTPException) as caught:
            env['update_annotation_corrections']('guard-fixture', None, {'_clock_write_guard': {'analysis_id': 'guard-fixture', 'transcript_clock_offset_seconds': 0}})
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(status, before)

    def test_correction_generation_prevents_same_clock_stale_or_unguarded_writes(self):
        current = {'correction_generation': 'generation-2'}
        for guard in [None, {'analysis_id': 'a', 'transcript_clock_offset_seconds': 0},
                      {'analysis_id': 'a', 'transcript_clock_offset_seconds': 0, 'correction_generation': 'generation-1'}]:
            with self.assertRaises(ClockRevisionConflict):
                validate_correction_clock_guard('a', current, {'_clock_write_guard': guard})
        validate_correction_clock_guard('a', current, {'_clock_write_guard': {
            'analysis_id': 'a', 'transcript_clock_offset_seconds': 0, 'correction_generation': 'generation-2'}})
