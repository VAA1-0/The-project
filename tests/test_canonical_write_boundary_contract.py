import unittest
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ANALYSIS = ROOT / "src" / "backend" / "analysis"


class CanonicalWriteBoundaryContractTests(unittest.TestCase):
    def test_candidate_producers_do_not_import_canonical_writer(self):
        candidate_modules = [
            "evidence_proliferation_matcher.py",
            "live_mature_data_proliferation_bus.py",
            "second_order_label_proliferation.py",
            "identification_refinery.py",
            "identity_triangulation.py",
        ]
        for filename in candidate_modules:
            with self.subTest(module=filename):
                source = (ANALYSIS / filename).read_text(encoding="utf-8")
                self.assertIsNone(
                    re.search(r"^\s*(?:from|import)\s+.*decision_ledger", source, re.MULTILINE)
                )
                self.assertIsNone(
                    re.search(r"^\s*(?:from|import)\s+.*append_decision", source, re.MULTILINE)
                )

    def test_canonical_writer_is_reached_through_governed_boundaries(self):
        api_source = (ROOT / "api_server.py").read_text(encoding="utf-8")
        self.assertIn("sync_corrections_to_ledger", api_source)
        self.assertIn("validate_canonical_write_policy", (ANALYSIS / "decision_ledger.py").read_text())
        self.assertIn('"canonical_correction_sync"', api_source)


if __name__ == "__main__":
    unittest.main()
