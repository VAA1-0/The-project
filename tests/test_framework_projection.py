import tempfile
import unittest
from pathlib import Path

from src.backend.analysis.decision_ledger import empty_decision_ledger
from src.backend.analysis.evidence_quality import assess_evidence_quality
from src.backend.analysis.framework_projection import build_framework_projections, confirm_proposition_to_ledger
from src.backend.analysis.interpretation_registry import InterpretationRegistry


def evidence_quality(score):
    return assess_evidence_quality({"evidence_ref": "artifact:e1", "dimensions": {
        "clarity": score, "temporal_precision": score, "completeness": score,
        "representativeness": score, "corroboration": score,
    }})


class FrameworkProjectionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="vaa1-framework-test-")
        self.registry = InterpretationRegistry("a1", Path(self.temporary.name) / "registry.json")

    def tearDown(self):
        self.temporary.cleanup()

    def claim(self, score=.8, label="supported"):
        return self.registry.append_claim({
            "claim_text": label, "finding_refs": [f"finding:{label}"], "evidence_refs": [f"artifact:{label}"],
            "quality_assessment": evidence_quality(score), "subject_ref": {"type": "narrative_agent", "id": "agent-1"},
            "scope": {"start_seconds": 0, "end_seconds": 2},
        })["record"]

    def proposition(self, support, framework_ref="boje_5b.becoming"):
        return self.registry.append_proposition({
            "statement": "The agent state may be changing.", "support_refs": [support["record_id"]],
            "counter_evidence_refs": [], "alternatives": ["The difference may be sampling variation."],
            "framework_ref": framework_ref, "subject_ref": {"type": "narrative_agent", "id": "agent-1"},
            "scope": {"start_seconds": 0, "end_seconds": 2},
        })["record"]

    def test_projects_eligible_records_into_all_explicit_frameworks(self):
        claim = self.claim()
        proposition = self.proposition(claim)
        projections = build_framework_projections("a1", self.registry.view())
        self.assertEqual(len(projections["meaning_network"]["nodes"]), 1)
        self.assertEqual(len(projections["narrative_agent"]["readings"]), 1)
        self.assertEqual(projections["boje_5b"]["events"][0]["orientation"], "becoming")
        self.assertEqual(projections["boje_5b"]["events"][0]["record_ref"], proposition["record_id"])
        self.assertFalse(projections["governance"]["canonical_write"])

    def test_observation_only_support_is_excluded(self):
        proposition = self.proposition(self.claim(score=.2, label="limited"))
        projections = build_framework_projections("a1", self.registry.view())
        self.assertFalse(projections["meaning_network"]["nodes"])
        self.assertEqual(projections["excluded_records"][0]["record_ref"], proposition["record_id"])

    def test_boje_orientation_is_never_inferred_without_explicit_assignment(self):
        self.proposition(self.claim(), framework_ref=None)
        projections = build_framework_projections("a1", self.registry.view())
        self.assertFalse(projections["boje_5b"]["events"])

    def test_legacy_boje_aliases_normalize_with_lineage(self):
        self.proposition(self.claim(), framework_ref="boje_5b.beyond")
        projections = build_framework_projections("a1", self.registry.view())
        event = projections["boje_5b"]["events"][0]
        self.assertEqual(event["orientation"], "before")
        self.assertTrue(event["vocabulary_lineage"]["legacy_alias_normalized"])
        self.assertEqual(event["vocabulary_lineage"]["source_framework_ref"], "boje_5b.beyond")

    def test_explicit_analyst_confirmation_enters_canonical_ledger(self):
        proposition = self.proposition(self.claim())
        ledger, decision, appended = confirm_proposition_to_ledger(
            analysis_id="a1", ledger=empty_decision_ledger("a1"), proposition=proposition,
            payload={"confirmation_action": "confirm_proposition", "authority": "explicit_user_confirmation", "created_by": "analyst"},
        )
        self.assertTrue(appended)
        self.assertEqual(decision["maturity"], "analyst_confirmed")
        self.assertEqual(decision["provenance"]["writer_class"], "analyst_interaction")
        self.assertIn(proposition["record_id"], decision["correction_refs"])
        self.assertEqual(len(ledger["decisions"]), 1)

    def test_candidate_service_cannot_use_confirmation_adapter(self):
        proposition = self.proposition(self.claim())
        with self.assertRaises(ValueError):
            confirm_proposition_to_ledger(
                analysis_id="a1", ledger=empty_decision_ledger("a1"), proposition=proposition,
                payload={"confirmation_action": "confirm_proposition", "authority": "candidate_service"},
            )


if __name__ == "__main__":
    unittest.main()
