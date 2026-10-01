import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ApiDecisionInvalidationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (ROOT / "api_server.py").read_text(encoding="utf-8")
        tree = ast.parse(cls.source)
        handler = next(node for node in tree.body
                       if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
                       and node.name == "update_annotation_corrections")
        cls.correction_handler = ast.get_source_segment(cls.source, handler)
        cls.correction_calls = [node for node in ast.walk(handler)
                                if isinstance(node, ast.Call)]

    def test_explicit_invalidation_route_is_append_only(self):
        self.assertIn('@app.post("/api/analysis/{analysis_id}/decisions/invalidate"', self.source)
        self.assertIn("append_invalidation(", self.source)
        self.assertNotIn('decision["validity"] = "invalid"', self.source)

    def test_correction_sync_and_invalidation_share_same_backend_save(self):
        section = self.correction_handler
        self.assertIn("sync_corrections_to_ledger(", section)
        self.assertIn('"canonical_correction_sync"', section)
        self.assertIn("write_decision_ledger_file(status)", section)
        writes = [call for call in self.correction_calls
                  if isinstance(call.func, ast.Name)
                  and call.func.id == "write_annotation_corrections_file"]
        self.assertEqual(len(writes), 1)
        self.assertEqual(ast.unparse(writes[0].args[0]), "status")
        self.assertTrue(any(keyword.arg == "refresh_master_schema"
                            and isinstance(keyword.value, ast.Constant)
                            and keyword.value.value is True
                            for keyword in writes[0].keywords))

    def test_dependency_change_route_and_clock_trigger_are_operational(self):
        self.assertIn('@app.post("/api/analysis/{analysis_id}/decisions/dependency-change"', self.source)
        section = self.correction_handler
        self.assertIn('"source_media.clock"', section)
        self.assertIn('"validity_effect": "stale"', section)


if __name__ == "__main__":
    unittest.main()
