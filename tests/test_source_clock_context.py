"""Revision isolation using temporary source files and the actual API handler."""
import ast
import asyncio
import tempfile
from src.backend.analysis.correction_write_lock import correction_write_lock, CorrectionWriteBusy
import copy
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src/backend/analysis'))
from source_clock_context import build_source_clock_context, validate_clock_binding, ClockRevisionConflict
from source_clock_authority import bind_analysis_scope, select_authoritative_time_scope, overlapping_dependents, clock_affected_decision_refs

from decision_ledger import empty_decision_ledger, append_decision, append_dependency_invalidation
from claim_projection import project_canonical_claims


class SourceClockContextTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / 'source.mp4'
        self.path.write_bytes(b'original-media-bytes')
        self.status = {'source_video_path': str(self.path), 'annotation_corrections': {}}
        self.metadata = {'duration_seconds': 1200, 'fps': 24, 'audio_sample_rate': 48000}

    def context(self):
        return build_source_clock_context('analysis-a', self.status, self.metadata)

    def scope(self, context=None):
        context = context or self.context()
        return {key: context[key] for key in ['source_fingerprint', 'clock_revision']} | {
            'analysis_id': 'analysis-a', 'source_ref': 'evidence-row-a',
            'start_seconds': 71, 'end_seconds': 72, 'timing_status': 'source_measured'}

    def test_identity_is_content_based_and_survives_path_move_and_reopen(self):
        original = self.context()
        moved = self.path.with_name('renamed.mp4')
        self.path.rename(moved)
        self.status['source_video_path'] = str(moved)
        restored = json.loads(json.dumps(self.status))
        self.assertEqual(original, build_source_clock_context('analysis-a', restored, self.metadata))
        self.assertEqual(original['binding_status'], 'content_bound')

    def test_replacement_with_same_size_and_restored_mtime_is_detected(self):
        original = self.context()
        stat = self.path.stat()
        self.path.write_bytes(b'replaced-media-byte!')
        self.assertEqual(self.path.stat().st_size, stat.st_size)
        os.utime(self.path, ns=(stat.st_atime_ns, stat.st_mtime_ns))
        current = self.context()
        self.assertNotEqual(original['source_fingerprint'], current['source_fingerprint'])
        with self.assertRaises(ClockRevisionConflict):
            validate_clock_binding(self.scope(original), current)

    def test_timebase_changes_revision_but_editor_notes_do_not(self):
        original = self.context()
        self.metadata['user_annotations'] = {'editor_notes': 'reviewed'}
        self.assertEqual(original, self.context())
        for field, value in [('duration_seconds', 1201), ('fps', 25), ('audio_sample_rate', 44100)]:
            before = self.metadata[field]
            self.metadata[field] = value
            self.assertNotEqual(original['clock_revision'], self.context()['clock_revision'])
            self.metadata[field] = before
        self.status['annotation_corrections']['transcript_clock_offset_seconds'] = -.5
        current = self.context()
        self.assertEqual(original['source_fingerprint'], current['source_fingerprint'])
        self.assertNotEqual(original['clock_revision'], current['clock_revision'])
        with self.assertRaises(ClockRevisionConflict):
            validate_clock_binding(self.scope(original), current)

    def test_missing_source_preserves_readonly_legacy_inspection(self):
        original = self.context()
        self.path.unlink()
        missing = self.context()
        self.assertEqual(missing['binding_status'], 'source_unavailable')
        self.assertIsNone(missing['clock_revision'])
        self.assertEqual(validate_clock_binding({}, missing), 'legacy_unversioned')
        with self.assertRaises(ClockRevisionConflict):
            validate_clock_binding({}, missing, required=True)
        with self.assertRaises(ClockRevisionConflict):
            validate_clock_binding(self.scope(original), missing)

    def test_no_mutation_and_no_partial_or_mixed_binding(self):
        before = copy.deepcopy(self.status)
        current = self.context()
        scope = self.scope(current)
        self.assertEqual(validate_clock_binding(scope, current, required=True), 'content_bound')
        self.assertEqual(self.status, before)
        for partial in [{'source_fingerprint': current['source_fingerprint']}, {'clock_revision': ''}]:
            with self.assertRaises(ValueError):
                validate_clock_binding(partial, current)
        selected = select_authoritative_time_scope([scope])
        self.assertEqual(selected['clock_revision'], current['clock_revision'])
        with self.assertRaises(ValueError):
            select_authoritative_time_scope([scope, {**scope, 'clock_revision': 'old'}])
        self.assertEqual(overlapping_dependents(scope, [{**scope, 'id': 'other', 'source_fingerprint': 'sha256:other'}]), [])

    def test_ledger_rejects_incomplete_or_foreign_clock_traceback(self):
        ledger = empty_decision_ledger('analysis-a')
        ledger['decisions'] = [{'decision_id': 'existing'}]
        for clock_scope in [{}, {**self.scope(), 'clock_id': 'wall-clock'},
                            {**self.scope(), 'clock_id': 'source_media.clock', 'analysis_id': 'foreign'},
                            {**self.scope(), 'clock_id': 'source_media.clock', 'start_seconds': float('nan')}]:
            with self.subTest(clock_scope=clock_scope), self.assertRaises(ValueError):
                append_dependency_invalidation(ledger, {
                    'target_decision_refs': ['existing'], 'source_clock_scope': clock_scope,
                }, analysis_id='analysis-a')
        self.assertEqual(len(ledger['decisions']), 1)

    def test_bound_invalidation_is_append_only_survives_reopen_and_is_idempotent(self):
        ledger = empty_decision_ledger('analysis-a')
        for name, start in [('inside', 71), ('outside', 90)]:
            ledger, _, _ = append_decision(ledger, {
                'decision_id': name, 'decision_action': 'correct_assignment',
                'subject_ref': {'type': 'utterance', 'id': name}, 'property': 'label',
                'scope': {'start_seconds': start, 'end_seconds': start + 1},
                'value': name, 'authority': 'explicit_user_correction',
            }, analysis_id='analysis-a')
        original = copy.deepcopy(ledger)
        status = {**self.status, 'analysis_id': 'analysis-a',
                  'source_media_metadata': self.metadata, 'canonical_decision_ledger': ledger}
        events = []
        class HTTPException(Exception):
            def __init__(self, status_code, detail):
                self.status_code, self.detail = status_code, detail
        names = {'resolve_analysis_source_clock', 'write_decision_ledger_file', 'decision_ledger_for_status'}
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
        self.assertEqual(len(nodes), len(names))
        for node in nodes:
            node.decorator_list = []
        lock_folder = tempfile.TemporaryDirectory()
        self.addCleanup(lock_folder.cleanup)
        env = dict(globals(), HTTPException=HTTPException, Body=lambda *a, **k: None,
                   get_analysis_entry=lambda _: status, safe_float=float,
                   RESULTS_DIR=Path(lock_folder.name) / 'outputs/api_results',
                   append_analysis_event=lambda *args, **kwargs: events.append(kwargs.get('details')),
                   persist_analysis_record_for_status=lambda _: None)
        exec(compile(ast.Module(body=nodes, type_ignores=[]), '<actual-clock-persistence>', 'exec'), env)
        request = {'candidates': [self.scope()], 'apply_invalidation': True}
        response = env['resolve_analysis_source_clock']('analysis-a', request)
        self.assertEqual(ledger, original)
        event = response['invalidation']
        self.assertEqual(event['target_decision_refs'], ['inside'])
        self.assertEqual(event['validity_effect'], 'stale')
        self.assertEqual(event['source_clock_scope']['clock_revision'], self.context()['clock_revision'])
        path = Path(status['output_files']['decision_ledger'])
        saved_bytes = path.read_bytes()
        status.pop('canonical_decision_ledger')
        reopened = env['decision_ledger_for_status'](status)
        self.assertEqual(reopened['decisions'][:2], original['decisions'])
        projection = project_canonical_claims(analysis_id='analysis-a', decisions=reopened['decisions'])
        self.assertEqual([claim['subject_ref']['id'] for claim in projection['claims']], ['outside'])
        repeated = env['resolve_analysis_source_clock']('analysis-a', request)
        self.assertIsNone(repeated['invalidation'])
        self.assertEqual(path.read_bytes(), saved_bytes)
        self.assertEqual(len(events), 1)
        # A whole-source change reaches temporal decisions outside the selected interval.
        global_request = {**request, 'change_scope': 'source'}
        global_result = env['resolve_analysis_source_clock']('analysis-a', global_request)
        self.assertEqual(global_result['invalidation']['target_decision_refs'], ['outside'])
        self.assertEqual(global_result['invalidation']['source_clock_scope']['change_scope'], 'source')
        status.pop('canonical_decision_ledger')
        reopened = env['decision_ledger_for_status'](status)
        self.assertEqual(reopened['decisions'][:2], original['decisions'])
        self.assertEqual(project_canonical_claims(analysis_id='analysis-a', decisions=reopened['decisions'])['claims'], [])
        self.assertIsNone(env['resolve_analysis_source_clock']('analysis-a', global_request)['invalidation'])

    def test_real_api_rejects_stale_binding_before_any_persistence(self):
        class HTTPException(Exception):
            def __init__(self, status_code, detail):
                self.status_code, self.detail = status_code, detail
        status = {**self.status, 'source_media_metadata': self.metadata}
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        node = next(n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == 'resolve_analysis_source_clock')
        node.decorator_list = []
        # Intentionally omit writers: reaching any persistence function fails the test.
        lock_folder = tempfile.TemporaryDirectory()
        self.addCleanup(lock_folder.cleanup)
        env = dict(globals(), RESULTS_DIR=Path(lock_folder.name) / 'outputs/api_results', HTTPException=HTTPException, Body=lambda *a, **k: None,
                   get_analysis_entry=lambda _: status, safe_float=float)
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<actual-clock-api>', 'exec'), env)
        handler = env['resolve_analysis_source_clock']
        scope = self.scope()
        result = handler('analysis-a', {'candidates': [scope]})
        self.assertEqual(result['binding_status'], 'content_bound')
        status['annotation_corrections']['transcript_clock_offset_seconds'] = 1
        for payload in [
            {'candidates': [scope], 'apply_invalidation': True},
            {'candidates': [{'start_seconds': 71}], 'apply_invalidation': True},
            {'candidates': [self.scope()], 'dependents': [{**scope, 'id': 'old'}]},
        ]:
            with self.assertRaises(HTTPException) as caught:
                handler('analysis-a', payload)
            self.assertEqual(caught.exception.status_code, 409)
        legacy = handler('analysis-a', {'candidates': [{'start_seconds': 71}]})
        self.assertEqual(legacy['binding_status'], 'legacy_unversioned')
        self.assertNotIn('clock_revision', legacy['selected_time_scope'])


if __name__ == '__main__':
    unittest.main()
