"""Behavioral tests for backend clock scope boundaries; no live writes."""
import ast
import asyncio
import tempfile
from src.backend.analysis.correction_write_lock import correction_write_lock, CorrectionWriteBusy
import copy
import sys
import unittest
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src/backend/analysis'))
from source_clock_context import build_source_clock_context, validate_clock_binding, ClockRevisionConflict
from source_clock_authority import (bind_analysis_scope, normalize_time_scope,
    select_authoritative_time_scope, overlapping_dependents, clock_affected_decision_refs)


def scope(**changes):
    return {'source_ref': 'source-a', 'start_seconds': 5, 'end_seconds': 8,
            'timing_status': 'source_measured', **changes}


class ClockIsolationTests(unittest.TestCase):
    def test_invalid_numbers_are_rejected_not_clamped(self):
        for field in ['start_seconds', 'end_seconds', 'precision_seconds']:
            for value in [float('nan'), float('inf'), -float('inf'), True, 'bad', []]:
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    normalize_time_scope(scope(**{field: value}))
        for duration in [float('nan'), float('inf'), -1, True]:
            with self.assertRaises(ValueError):
                normalize_time_scope(scope(), duration_seconds=duration)
        with self.assertRaises(ValueError):
            normalize_time_scope(scope(precision_seconds=-.1))

    def test_explicit_bad_seconds_do_not_fall_back_to_milliseconds(self):
        with self.assertRaises(ValueError):
            normalize_time_scope(scope(start_seconds='bad', t_start_ms=5000))

    def test_clock_and_payload_validation(self):
        for value in [None, [], scope(clock_id='wall-clock')]:
            with self.assertRaises(ValueError):
                normalize_time_scope(value)

    def test_source_comparison_precedes_authority(self):
        with self.assertRaises(ValueError):
            select_authoritative_time_scope([scope(), scope(source_ref='source-b', timing_status='explicit_user_correction')])

    def test_overlap_does_not_cross_sources_or_unknown_identity(self):
        values = [scope(id='same'), scope(id='foreign', source_ref='source-b'),
                  scope(id='unknown', source_ref=''), scope(id='invalid', start_seconds=float('nan')), None]
        self.assertEqual(overlapping_dependents(scope(), values), ['same'])

    def test_legacy_scopes_remain_supported_inside_analysis(self):
        original = scope(source_ref='evidence-row-a')
        before = copy.deepcopy(original)
        selected = select_authoritative_time_scope([
            bind_analysis_scope(original, 'analysis-a'),
            bind_analysis_scope(scope(source_ref='evidence-row-b'), 'analysis-a')])
        self.assertEqual(original, before)
        self.assertEqual(selected['analysis_id'], 'analysis-a')
        self.assertEqual(overlapping_dependents(selected, [bind_analysis_scope(scope(id='legacy', source_ref=''), 'analysis-a')]), ['legacy'])

    def test_binding_rejects_foreign_analysis(self):
        with self.assertRaises(ValueError):
            bind_analysis_scope(scope(analysis_id='analysis-b'), 'analysis-a')

    def test_decisions_remain_analysis_isolated_and_active_only(self):
        ledger = {'analysis_id': 'analysis-a', 'decisions': [
            {'decision_id': 'legacy', 'scope': {'start_seconds': 6, 'end_seconds': 7}},
            {'decision_id': 'foreign', 'analysis_id': 'analysis-b', 'scope': scope()},
            {'decision_id': 'foreign-scope', 'scope': scope(analysis_id='analysis-b')},
            {'decision_id': 'outside', 'scope': scope(start_seconds=20, end_seconds=22)},
            {'decision_id': 'old', 'scope': scope()},
            {'decision_id': 'invalidator', 'decision_action': 'invalidate', 'target_decision_refs': ['old']},
        ]}
        before = copy.deepcopy(ledger)
        self.assertEqual(clock_affected_decision_refs(ledger, bind_analysis_scope(scope(), 'analysis-a')), ['legacy'])
        self.assertEqual(clock_affected_decision_refs(ledger, bind_analysis_scope(scope(), 'analysis-b')), [])
        self.assertEqual(clock_affected_decision_refs(ledger, bind_analysis_scope(scope(), 'analysis-a'), whole_source=True), ['legacy', 'outside'])
        self.assertEqual(ledger, before)

    def test_standalone_decision_sources_are_isolated(self):
        ledger = {'decisions': [{'decision_id': name, 'scope': scope(source_ref=name)} for name in ['source-a', 'source-b']]}
        self.assertEqual(clock_affected_decision_refs(ledger, scope()), ['source-a'])

    def test_existing_clamp_and_unit_contract_is_preserved(self):
        value = normalize_time_scope({'t_start_ms': 1200, 't_end_ms': 5000}, duration_seconds=3)
        self.assertEqual((value['start_seconds'], value['end_seconds']), (1.2, 3))
        self.assertEqual(normalize_time_scope(scope(start_seconds=1200, end_seconds=1202))['start_seconds'], 1200)

    def test_explicit_corrections_are_not_silently_clamped(self):
        for bounds in [dict(start_seconds=-1), dict(start_seconds=8, end_seconds=5),
                       dict(start_seconds=101, end_seconds=102)]:
            with self.subTest(bounds=bounds), self.assertRaises(ValueError):
                normalize_time_scope(scope(timing_status='explicit_user_correction', **bounds), duration_seconds=100)
        value = normalize_time_scope(scope(timing_status='explicit_user_correction', start_seconds=0, end_seconds=100), duration_seconds=100)
        self.assertEqual((value['start_seconds'], value['end_seconds']), (0, 100))

    def test_real_endpoint_binds_scope_and_rejects_before_any_write(self):
        # Compile the actual handler in isolation, avoiding heavy model imports.
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        node = next(n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == 'resolve_analysis_source_clock')
        node.decorator_list = []
        class HTTPException(Exception):
            def __init__(self, status_code, detail):
                self.status_code, self.detail = status_code, detail
        lock_folder = tempfile.TemporaryDirectory()
        self.addCleanup(lock_folder.cleanup)
        env = dict(globals(), RESULTS_DIR=Path(lock_folder.name) / 'outputs/api_results', HTTPException=HTTPException, Body=lambda *a, **k: None,
                   get_analysis_entry=lambda _: {'source_media_metadata': {'duration_seconds': 100}},
                   safe_float=float)
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<clock-handler>', 'exec'), env)
        handler = env['resolve_analysis_source_clock']
        result = handler('analysis-a', {'candidates': [scope()]})
        self.assertEqual(result['selected_time_scope']['analysis_id'], 'analysis-a')
        for payload in [
            {'candidates': [scope()], 'change_scope': 'unknown'},
            {'candidates': [scope()], 'apply_invalidation': 'false'},
            {'candidates': [scope()], 'apply_invalidation': 1},
            {'candidates': [scope(analysis_id='analysis-b')], 'apply_invalidation': True},
            {'candidates': [scope()], 'dependents': [scope(analysis_id='analysis-b')], 'apply_invalidation': True},
            {'candidates': [scope(start_seconds='NaN')], 'apply_invalidation': True},
        ]:
            with self.assertRaises(HTTPException) as caught:
                handler('analysis-a', payload)
            self.assertEqual(caught.exception.status_code, 400)


if __name__ == '__main__':
    unittest.main()
