import json
import tempfile
import unittest
from pathlib import Path

from src.backend.analysis.governed_reporting import GovernedReportService


class GovernedReportingTest(unittest.TestCase):
    def source(self, *, maturity="analyst_confirmed", validity="current", counter=None):
        return {"kind": "proposition", "maturity": maturity, "validity": validity,
                "counter_evidence_refs": counter or [], "conflict_status": "none_detected",
                "evidence_refs": ["transcript:7", "scene:2"]}

    def claim_payload(self, source_ref="proposition-1"):
        return {"claim_text": "The scene constructs a contested relation.", "source_object_refs": [source_ref],
                "citations": [{"source_object_ref": source_ref, "evidence_refs": ["transcript:7", "scene:2"],
                               "source_locations": [{"source_ref": "video:source", "start_seconds": 24.0, "end_seconds": 48.0}]}]}

    def test_verified_claim_requires_complete_source_traceback(self):
        with tempfile.TemporaryDirectory() as root:
            service = GovernedReportService("a1", Path(root) / "reports.json")
            result = service.create_claim(self.claim_payload(), {"proposition-1": self.source()})
            self.assertEqual(result["record"]["status"], "verified")
            self.assertFalse(result["record"]["canonical"])
            self.assertEqual(service.traceback(result["record"]["record_id"])["citations"][0]["evidence_refs"], ["transcript:7", "scene:2"])
            self.assertEqual(service.traceback(result["record"]["record_id"])["source_traceback"]["proposition-1"]["source_locations"][0]["start_seconds"], 24.0)

    def test_unlinked_citation_is_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            service = GovernedReportService("a1", Path(root) / "reports.json")
            payload = self.claim_payload()
            payload["citations"][0]["evidence_refs"] = ["unlinked:evidence"]
            with self.assertRaises(ValueError):
                service.create_claim(payload, {"proposition-1": self.source()})

    def test_conflict_and_limited_states_are_not_silenced(self):
        with tempfile.TemporaryDirectory() as root:
            service = GovernedReportService("a1", Path(root) / "reports.json")
            conflict = service.create_claim(self.claim_payload(), {"proposition-1": self.source(counter=["claim:alternative"])})
            self.assertEqual(conflict["record"]["status"], "conflicting")
            limited_payload = self.claim_payload("proposition-2")
            limited = service.create_claim(limited_payload, {"proposition-2": self.source(validity="invalid")})
            self.assertEqual(limited["record"]["status"], "limited")

    def test_complete_save_reopen_correction_invalidation_plan_export_traceback_cycle(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "reports.json"
            service = GovernedReportService("a1", path)
            original = service.create_claim(self.claim_payload(), {"proposition-1": self.source()})["record"]
            reopened = GovernedReportService("a1", path)
            self.assertEqual(reopened.view()["records"][0]["record_id"], original["record_id"])
            invalidation = reopened.invalidate_sources(["proposition-1"], reason="Analyst corrected the proposition")
            self.assertIn(original["record_id"], invalidation["record"]["target_refs"])
            self.assertEqual(reopened.view()["records"][0]["effective_validity"], "invalid")
            self.assertIn("report_claim_service", invalidation["affected_branch_plan"]["changed_nodes"])
            corrected = reopened.create_claim(self.claim_payload("proposition-2"), {"proposition-2": self.source()})["record"]
            exported = reopened.export([corrected["record_id"]], Path(root) / "report.json")
            package = json.loads(Path(exported["export_path"]).read_text())
            self.assertEqual(package["claims"][0]["record_id"], corrected["record_id"])
            self.assertEqual(package["traceback_index"][corrected["record_id"]]["source_object_refs"], ["proposition-2"])
            self.assertEqual(package["traceback_index"][corrected["record_id"]]["source_traceback"]["proposition-2"]["evidence_refs"], ["scene:2", "transcript:7"])
            final_reopen = GovernedReportService("a1", path).view()
            self.assertTrue(any(item.get("kind") == "report_run" for item in final_reopen["records"]))

    def test_analyst_authored_status_requires_explicit_authority(self):
        with tempfile.TemporaryDirectory() as root:
            service = GovernedReportService("a1", Path(root) / "reports.json")
            payload = {**self.claim_payload(), "analyst_authored": True, "authority": "candidate_service"}
            with self.assertRaises(ValueError):
                service.create_claim(payload, {"proposition-1": self.source()})

    def test_verified_measurement_can_be_cited_without_promoting_semantic_authority(self):
        with tempfile.TemporaryDirectory() as root:
            service = GovernedReportService("a1", Path(root) / "reports.json")
            measurement = {
                "kind": "measurement",
                "maturity": "verified",
                "validity": "current",
                "evidence_refs": ["artifact:spatial_tone_scan#sample-1"],
                "authority": "measured_automatic_detection",
            }
            payload = {
                "claim_text": "The measured frame window has low brightness.",
                "source_object_refs": ["measurement-1"],
                "citations": [{
                    "source_object_ref": "measurement-1",
                    "evidence_refs": ["artifact:spatial_tone_scan#sample-1"],
                    "source_locations": [{"start_seconds": 3.0, "end_seconds": 4.0}],
                }],
            }
            result = service.create_claim(payload, {"measurement-1": measurement})
            self.assertEqual(result["record"]["status"], "verified")
            self.assertEqual(result["record"]["authority"], "derived_report_projection")
            self.assertFalse(result["record"]["canonical"])


if __name__ == "__main__":
    unittest.main()
