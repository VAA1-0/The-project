import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "vaa1_claim_projection", ROOT / "src" / "backend" / "analysis" / "claim_projection.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ClaimProjectionContractTests(unittest.TestCase):
    def decision(self, decision_id, subject, prop, value, authority="manual_confirmation", action="confirm_candidate"):
        return {
            "decision_id": decision_id,
            "decision_action": action,
            "subject_ref": {"type": "candidate_claim", "id": subject},
            "property": prop,
            "value": value,
            "authority": authority,
            "maturity": "analyst_confirmed",
            "scope": {"start_seconds": 1, "end_seconds": 3},
            "created_at": "2026-07-15T10:00:00Z",
            "evidence_refs": ["evidence-1"],
            "correction_refs": ["review-1"],
            "supersedes": [],
        }

    def test_projects_multiple_property_families(self):
        result = MODULE.project_canonical_claims(
            analysis_id="a1",
            decisions=[
                self.decision("d1", "candidate-1", "narrative_agent.assignment", "Bond"),
                self.decision("d2", "edge-1", "meaning_network.relationship", "opposes"),
            ],
            timestamp=2,
        )
        self.assertEqual(result["claim_count"], 2)
        self.assertEqual(
            {item["property"] for item in result["claims"]},
            {"narrative_agent.assignment", "meaning_network.relationship"},
        )

    def test_rejection_projects_as_suppressed(self):
        result = MODULE.project_canonical_claims(
            analysis_id="a1",
            decisions=[self.decision("d1", "candidate-1", "semantic.assignment.label", "person", action="reject_candidate")],
        )
        self.assertEqual(result["claims"][0]["projection_status"], "suppressed")
        self.assertIsNone(result["claims"][0]["projected_value"])

    def test_invalidated_and_superseded_claims_are_excluded(self):
        first = self.decision("d1", "candidate-1", "semantic.assignment.label", "person")
        second = self.decision("d2", "candidate-1", "semantic.assignment.label", "Bond")
        second["supersedes"] = ["d1"]
        invalidation = {"decision_id": "i1", "decision_action": "invalidate", "target_decision_refs": ["d2"]}
        result = MODULE.project_canonical_claims(analysis_id="a1", decisions=[first, second, invalidation])
        self.assertEqual(result["claims"], [])


if __name__ == "__main__":
    unittest.main()
