import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ApiDecisionInvalidationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = (ROOT / "api_server.py").read_text(encoding="utf-8")

    def test_explicit_invalidation_route_is_append_only(self):
        self.assertIn('@app.post("/api/analysis/{analysis_id}/decisions/invalidate"', self.source)
        self.assertIn("append_invalidation(", self.source)
        self.assertNotIn('decision["validity"] = "invalid"', self.source)

    def test_correction_sync_and_invalidation_share_same_backend_save(self):
        start = self.source.index("async def update_annotation_corrections")
        section = self.source[start:start + 7000]
        self.assertIn("sync_corrections_to_ledger(", section)
        self.assertIn('"canonical_correction_sync"', section)
        self.assertIn("write_decision_ledger_file(status)", section)
        self.assertIn("write_annotation_corrections_file(status)", section)

    def test_dependency_change_route_and_clock_trigger_are_operational(self):
        self.assertIn('@app.post("/api/analysis/{analysis_id}/decisions/dependency-change"', self.source)
        start = self.source.index("async def update_annotation_corrections")
        section = self.source[start:start + 9000]
        self.assertIn('"source_media.clock"', section)
        self.assertIn('"validity_effect": "stale"', section)


if __name__ == "__main__":
    unittest.main()
