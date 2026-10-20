import unittest

from src.backend.analysis.narrative_agent_stage7_closeout import (
    MANUAL_GATES,
    build_stage7_closeout_record,
)


def fixture():
    projection = {
        "revision": "revision-1",
        "canonical_collection": {
            "project_id": "bond-cop30-helsinki",
            "collection_id": "bond-agent",
        },
    }
    export_package = {
        "schema": "vaa1.narrative_agent_interpretation_export.v1",
        "canonical_revision": "revision-1",
        "content_checksum": "export-checksum",
        "eligibility": {"eligible": True},
        "state_distinctions": {"counts": {"candidate": 1}, "flattened": False},
    }
    automated = {
        "backend_contracts_passed": True,
        "frontend_contracts_passed": True,
        "typecheck_passed": True,
        "compile_passed": True,
        "diff_check_passed": True,
        "evidence": {"backend_tests": 62, "frontend_tests": 17},
    }
    return projection, export_package, automated


class NarrativeAgentStage7CloseoutTests(unittest.TestCase):
    def test_automated_delivery_never_impersonates_manual_acceptance(self):
        projection, package, automated = fixture()
        record = build_stage7_closeout_record(
            projection, package, automated_verification=automated
        )

        self.assertTrue(record["automated_verification"]["complete"])
        self.assertFalse(record["manual_acceptance"]["complete"])
        self.assertEqual(record["construct_status"], "manual_acceptance_required")
        self.assertFalse(record["next_construct_selection"]["authorized"])
        self.assertEqual(record["stage7_status"], "partial")

    def test_complete_analyst_receipt_closes_only_the_bounded_construct(self):
        projection, package, automated = fixture()
        manual = {
            "gates": {gate: True for gate in MANUAL_GATES},
            "accepted_by": "analyst",
            "accepted_at": "2026-10-20T12:00:00+03:00",
            "evidence_refs": ["screenshot:spoken-by", "receipt:export-restore"],
            "analyst_effort_minutes": 12,
            "limitations": ["No voice embedding was available."],
            "optional_deferrals": ["Broader topic interpretation."],
        }
        record = build_stage7_closeout_record(
            projection, package, automated_verification=automated, manual_acceptance=manual
        )

        self.assertEqual(record["construct_status"], "operational")
        self.assertTrue(record["manual_acceptance"]["complete"])
        self.assertTrue(record["next_construct_selection"]["authorized"])
        self.assertEqual(record["stage7_status"], "partial")
        self.assertIn("does not mark all Stage 7", record["non_claims"][0])

    def test_stale_or_revision_mismatched_inputs_fail_closed(self):
        projection, package, automated = fixture()
        projection["invalidation"] = {"state": "recompute_required"}
        with self.assertRaisesRegex(ValueError, "stale projection"):
            build_stage7_closeout_record(projection, package, automated_verification=automated)

        projection.pop("invalidation")
        package["canonical_revision"] = "other"
        with self.assertRaisesRegex(ValueError, "one current canonical revision"):
            build_stage7_closeout_record(projection, package, automated_verification=automated)


if __name__ == "__main__":
    unittest.main()
