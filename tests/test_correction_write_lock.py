import ast
import json
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src/backend/analysis'))
from correction_write_lock import correction_write_lock, CorrectionWriteBusy
from source_clock_context import canonical_clock_corrections, correction_clock_read_payload
from src.backend.analysis.analysis_recovery import atomic_write_json


class CorrectionWriteLockTests(unittest.TestCase):
    def test_python_exception_releases_ownership(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(RuntimeError, 'fixture'):
                with correction_write_lock(Path(folder), 'a'):
                    raise RuntimeError('fixture')
            with correction_write_lock(Path(folder), 'a', .05):
                pass
            self.assertEqual(list((Path(folder) / '.cache/correction-write-locks').iterdir()), [])

    def test_python_recovers_only_dead_expired_owner(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            key = __import__('hashlib').sha256(b'a').hexdigest()
            lock = root / '.cache/correction-write-locks' / (key + '.lock')
            lock.mkdir(parents=True)
            (lock / 'owner.json').write_text(json.dumps({
                'token': 'orphan', 'pid': 99999999, 'analysis_id': 'a',
                'created_at': __import__('time').time() - 120,
            }))
            with correction_write_lock(root, 'a', .05):
                pass
            self.assertEqual(list((root / '.cache/correction-write-locks').iterdir()), [])

    def test_actual_save_route_returns_busy_before_read_or_mutation(self):
        class HTTPException(Exception):
            def __init__(self, status_code, detail, headers=None):
                self.status_code, self.headers = status_code, headers
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'update_annotation_corrections')
        node.decorator_list = []
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            def unexpected_read(_):
                raise AssertionError('Handler reached status while another writer owns the lock')
            env = dict(globals(), BackgroundTasks=object, Body=lambda *a, **k: None,
                       HTTPException=HTTPException, RESULTS_DIR=root / 'outputs/api_results',
                       get_analysis_entry=unexpected_read,
                       correction_write_lock=lambda root, aid: correction_write_lock(root, aid, .05))
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<actual-save-lock>', 'exec'), env)
            with correction_write_lock(root, 'a'):
                with self.assertRaises(HTTPException) as caught:
                    env['update_annotation_corrections']('a', None, {})
                self.assertEqual(caught.exception.status_code, 503)
                self.assertEqual(caught.exception.headers['Retry-After'], '1')

    def test_correction_get_does_not_replace_shared_writer_memory(self):
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'get_annotation_corrections')
        node.decorator_list = []
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'a').mkdir()
            (root / 'a/annotation_corrections.json').write_text(json.dumps({'transcript_clock_offset_seconds': 2}))
            status = {'annotation_corrections': {'transcript_clock_offset_seconds': 3}, 'output_files': {}}
            before = json.loads(json.dumps(status))
            env = dict(globals(), RESULTS_DIR=root, get_analysis_entry=lambda _: status,
                       hydrate_richer_persisted_annotation_corrections=lambda item: item.update(annotation_corrections=json.loads((root / 'a/annotation_corrections.json').read_text())),
                       build_annotation_corrections_payload=lambda item: item['annotation_corrections'])
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<actual-correction-read>', 'exec'), env)
            result = env['get_annotation_corrections']('a')
            self.assertEqual(result['annotation_corrections']['transcript_clock_offset_seconds'], 2)
            self.assertEqual(status, before)

    def test_correction_get_hydrates_restored_mature_ledger(self):
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'get_annotation_corrections')
        node.decorator_list = []
        status = {'analysis_id': 'a', 'annotation_corrections': {'manual_visual_annotations': []},
                  'output_files': {'annotation_corrections': '/restored/corrections.json'}}
        before = json.loads(json.dumps(status))
        restored = {'manual_visual_annotations': [{'id': 'mature-bbox'}]}
        def hydrate(item):
            item['annotation_corrections'] = restored
        env = dict(globals(), get_analysis_entry=lambda _: status,
                   hydrate_richer_persisted_annotation_corrections=hydrate,
                   build_annotation_corrections_payload=lambda item: item['annotation_corrections'])
        exec(compile(ast.Module(body=[node], type_ignores=[]), '<mature-correction-read>', 'exec'), env)
        result = env['get_annotation_corrections']('a')
        self.assertEqual(result['annotation_corrections']['manual_visual_annotations'], [{'id': 'mature-bbox'}])
        self.assertEqual(status, before)

    def test_richer_imported_arrays_cannot_replace_canonical_global_clock(self):
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        names = {'annotation_correction_maturity_score', 'hydrate_richer_persisted_annotation_corrections'}
        nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
        with tempfile.TemporaryDirectory() as folder:
            results = Path(folder)
            analysis_id = 'clock-authority'
            canonical_path = results / analysis_id / 'annotation_corrections.json'
            imported_path = results / 'restored/annotation_corrections.json'
            canonical_path.parent.mkdir(parents=True)
            imported_path.parent.mkdir(parents=True)
            canonical_path.write_text(json.dumps({
                'transcript_clock_offset_seconds': 2.5,
                'correction_generation': 'canonical-generation',
                'manual_visual_annotations': [],
            }))
            imported_path.write_text(json.dumps({
                'transcript_clock_offset_seconds': 99,
                'correction_generation': 'imported-generation',
                'manual_visual_annotations': [{'id': 'mature-bbox'}],
            }))
            status = {'analysis_id': analysis_id, 'annotation_corrections': {},
                      'output_files': {'annotation_corrections': str(imported_path)}}
            env = dict(globals(), RESULTS_DIR=results,
                       ANNOTATION_CORRECTION_COLLECTIONS=('manual_visual_annotations',))
            exec(compile(ast.Module(body=nodes, type_ignores=[]), '<clock-authority-hydration>', 'exec'), env)
            env['hydrate_richer_persisted_annotation_corrections'](status)
            self.assertEqual(status['annotation_corrections']['manual_visual_annotations'], [{'id': 'mature-bbox'}])
            self.assertEqual(status['annotation_corrections']['transcript_clock_offset_seconds'], 2.5)
            self.assertEqual(status['annotation_corrections']['correction_generation'], 'canonical-generation')

    def test_export_refresh_reads_canonical_data_inside_shared_lock(self):
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'refresh_mutable_saved_outputs')
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            sidecar = root / 'corrections.json'
            sidecar.write_text(json.dumps({'transcript_clock_offset_seconds': 2, 'manual_visual_annotations': [{'id': 'saved'}]}))
            status = {'analysis_id': 'export-fixture', 'annotation_corrections': {'transcript_clock_offset_seconds': 99},
                      'output_files': {'annotation_corrections': str(sidecar)}}
            captured = []
            def capture(item):
                self.assertTrue(list((root / '.cache/correction-write-locks').glob('*.lock')))
                captured.append(json.loads(json.dumps(item['annotation_corrections'])))
            env = dict(globals(), RESULTS_DIR=root / 'outputs/api_results',
                       write_annotation_corrections_file=capture,
                       write_source_media_metadata_files=lambda _: None,
                       persist_analysis_record_for_status=lambda _: None)
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<actual-export-lock>', 'exec'), env)
            env['refresh_mutable_saved_outputs'](status)
            self.assertEqual(captured, [json.loads(sidecar.read_text())])
            self.assertEqual(list((root / '.cache/correction-write-locks').iterdir()), [])

    def test_export_writer_preserves_canonical_word_undo_history(self):
        tree = ast.parse((ROOT / 'api_server.py').read_text())
        names = {'refresh_mutable_saved_outputs', 'write_annotation_corrections_file',
                 'build_annotation_corrections_payload'}
        nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            results = root / 'outputs/api_results'
            sidecar = results / 'undo-export/annotation_corrections.json'
            sidecar.parent.mkdir(parents=True)
            event = {'operation_id': 'undo-one', 'action': 'remove_word_correction',
                     'operation': {'id': 'text:word', 'before': None,
                                   'after': {'id': 'text:word', 'modality': 'text'}},
                     'based_on_generation': 'g1', 'resulting_generation': 'g2',
                     'recorded_at': '2026-09-25T12:00:00Z'}
            canonical = {'text_substitutions': [], 'correction_generation': 'g2',
                         'correction_undo_history': [event],
                         'manual_visual_annotations': [{'id': 'preserve'}]}
            sidecar.write_text(json.dumps(canonical))
            status = {'analysis_id': 'undo-export',
                      'annotation_corrections': {'text_substitutions': [event['operation']['after']]},
                      'output_files': {'annotation_corrections': str(sidecar)}}
            projections = []
            def project(item):
                self.assertTrue(list((root / '.cache/correction-write-locks').glob('*.lock')))
                projections.append(env['build_annotation_corrections_payload'](item))
            env = dict(globals(), RESULTS_DIR=results,
                       write_source_media_metadata_files=lambda _: None,
                       refresh_master_schema_metadata_surfaces=project,
                       persist_analysis_record_for_status=lambda _: None)
            exec(compile(ast.Module(body=nodes, type_ignores=[]), '<actual-undo-export>', 'exec'), env)
            env['refresh_mutable_saved_outputs'](status)
            saved = json.loads(sidecar.read_text())
            for key, value in canonical.items():
                self.assertEqual(saved[key], value)
            self.assertEqual(projections, [saved])
            self.assertNotIn('_word_undo', saved)
            self.assertEqual(list((root / '.cache/correction-write-locks').iterdir()), [])
