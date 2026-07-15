import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "src" / "backend" / "analysis" / "decision_ledger.py"
SPEC = importlib.util.spec_from_file_location("vaa1_decision_ledger", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DecisionLedgerContractTests(unittest.TestCase):
    def payload(self, decision_id="decision-1", value="James Bond", start=1.0, end=3.0):
        return {
            "decision_id": decision_id,
            "subject_ref": {"type": "visual_track_or_observation", "id": "track-1"},
            "property": "label",
            "scope": {"start_seconds": start, "end_seconds": end},
            "value": value,
            "created_at": "2026-07-14T10:00:00Z",
            "correction_refs": ["manual-1"],
        }

    def test_append_is_immutable_and_idempotent(self):
        original = MODULE.empty_decision_ledger("analysis-1")
        ledger, decision, appended = MODULE.append_decision(
            original, self.payload(), analysis_id="analysis-1"
        )
        self.assertTrue(appended)
        self.assertEqual(original["decisions"], [])
        repeated, _, appended_again = MODULE.append_decision(
            ledger, self.payload(), analysis_id="analysis-1"
        )
        self.assertFalse(appended_again)
        self.assertEqual(len(repeated["decisions"]), 1)
        self.assertEqual(decision["authority"], "explicit_user_correction")

    def test_new_overlapping_assertion_supersedes_without_deleting(self):
        ledger, _, _ = MODULE.append_decision(
            MODULE.empty_decision_ledger("analysis-1"), self.payload(), analysis_id="analysis-1"
        )
        ledger, latest, _ = MODULE.append_decision(
            ledger, self.payload("decision-2", "M", 2.0, 4.0), analysis_id="analysis-1"
        )
        self.assertEqual(len(ledger["decisions"]), 2)
        self.assertEqual(latest["supersedes"], ["decision-1"])

    def test_schema_artifact_names_ledger_contract(self):
        schema = json.loads((ROOT / "docs" / "schemas" / "vaa1.canonical_decision_ledger.v0.schema.json").read_text())
        self.assertEqual(schema["properties"]["schema"]["const"], MODULE.LEDGER_SCHEMA)

    def test_invalidation_is_an_append_only_event(self):
        ledger, original, _ = MODULE.append_decision(
            MODULE.empty_decision_ledger("analysis-1"), self.payload(), analysis_id="analysis-1"
        )
        ledger, event, appended = MODULE.append_invalidation(
            ledger,
            {
                "decision_id": "invalidate-1",
                "correction_ref": "manual-1",
                "reason_code": "source_annotation_removed",
                "created_at": "2026-07-14T12:00:00Z",
            },
            analysis_id="analysis-1",
        )
        self.assertTrue(appended)
        self.assertEqual(len(ledger["decisions"]), 2)
        self.assertEqual(event["target_decision_refs"], [original["decision_id"]])
        self.assertEqual(MODULE.invalidated_decision_ids(ledger["decisions"]), {"decision-1"})
        self.assertEqual(ledger["decisions"][0]["validity"], "current")

    def test_dependency_change_selects_only_affected_active_decisions(self):
        ledger, _, _ = MODULE.append_decision(
            MODULE.empty_decision_ledger("analysis-1"), self.payload(), analysis_id="analysis-1"
        )
        ledger, event, appended = MODULE.append_dependency_invalidation(
            ledger,
            {
                "decision_id": "clock-change-1",
                "dependency_ref": "source_media.clock",
                "validity_effect": "stale",
                "require_temporal_scope": True,
                "created_at": "2026-07-15T10:00:00Z",
            },
            analysis_id="analysis-1",
        )
        self.assertTrue(appended)
        self.assertEqual(event["target_decision_refs"], ["decision-1"])
        self.assertEqual(event["validity_effect"], "stale")

    def test_candidate_service_cannot_write_canonical_truth(self):
        payload = self.payload()
        payload["authority"] = "system_candidate"
        payload["provenance"] = {"writer_class": "candidate_service"}
        with self.assertRaisesRegex(ValueError, "may produce proposals"):
            MODULE.append_decision(
                MODULE.empty_decision_ledger("analysis-1"), payload, analysis_id="analysis-1"
            )

    def test_analyst_can_confirm_candidate(self):
        payload = self.payload()
        payload["decision_action"] = "confirm_candidate"
        payload["authority"] = "manual_confirmation"
        payload["provenance"] = {"writer_class": "analyst_interaction"}
        _, event, appended = MODULE.append_decision(
            MODULE.empty_decision_ledger("analysis-1"), payload, analysis_id="analysis-1"
        )
        self.assertTrue(appended)
        self.assertEqual(event["decision_action"], "confirm_candidate")


if __name__ == "__main__":
    unittest.main()
