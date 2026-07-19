import tempfile
import unittest
from pathlib import Path

from src.backend.analysis.evidence_quality import assess_evidence_quality
from src.backend.analysis.interpretation_registry import InterpretationRegistry


def quality(score: float):
    return assess_evidence_quality({"evidence_ref": "finding:f1", "dimensions": {
        "clarity": score, "temporal_precision": score, "completeness": score,
        "representativeness": score, "corroboration": score,
    }})


class InterpretationRegistryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="vaa1-interpretation-test-")
        self.path = Path(self.temporary.name) / "interpretation_registry.json"
        self.registry = InterpretationRegistry("a1", self.path)

    def tearDown(self):
        self.temporary.cleanup()

    def claim(self, text="Objects were measured.", score=.8, scope=None):
        return self.registry.append_claim({
            "claim_text": text, "finding_refs": ["finding:f1"], "evidence_refs": ["artifact:objects"],
            "quality_assessment": quality(score), "subject_ref": {"type": "analysis", "id": "a1"},
            "scope": scope or {"start_seconds": 0, "end_seconds": 1},
        })["record"]

    def test_candidate_chain_persists_with_traceback_and_no_canonical_write(self):
        before = self.claim("Measured object presence occurs before the cut.", scope={"start_seconds": 0, "end_seconds": 1})
        after = self.claim("Measured object presence occurs after the cut.", scope={"start_seconds": 2, "end_seconds": 3})
        proposition = self.registry.append_proposition({
            "statement": "Object presence spans two measured shot states.",
            "support_refs": [before["record_id"], after["record_id"]], "counter_evidence_refs": [],
            "alternatives": ["The detections may represent different objects."],
        })["record"]
        relation = self.registry.append_relation({
            "source_ref": before["record_id"], "target_ref": after["record_id"],
            "relation_type": "temporally_precedes", "evidence_refs": ["artifact:shot_boundaries"],
        })["record"]
        transition = self.registry.append_transition({
            "before_ref": before["record_id"], "after_ref": after["record_id"],
            "subject_ref": {"type": "analysis", "id": "a1"}, "state_property": "object_presence",
            "boundary": {"before_end_seconds": 1, "after_start_seconds": 2},
            "evidence_refs": ["artifact:shot_boundaries"],
        })["record"]
        view = self.registry.view()
        self.assertEqual({before["kind"], proposition["kind"], relation["kind"], transition["kind"]},
                         {"claim", "proposition", "relation", "state_transition"})
        self.assertTrue(all(item["provenance"]["canonical_write"] is False for item in view["records"]))
        self.assertIn("interpretation_service", [x["node_id"] for x in view["affected_branch_plan"]["affected_nodes"]])

    def test_low_quality_claim_remains_visible_as_observation(self):
        record = self.claim(score=.2)
        self.assertEqual(record["status"], "observation_only")
        self.assertEqual(record["quality_use"]["visibility"], "visible")

    def test_idempotence_and_immutable_invalidation(self):
        first = self.claim()
        duplicate = self.claim()
        self.assertEqual(first["record_id"], duplicate["record_id"])
        self.assertEqual(len(self.registry.load()["records"]), 1)
        self.registry.invalidate({"target_refs": [first["record_id"]], "reason": "Source changed."})
        view = self.registry.view()
        active = next(item for item in view["records"] if item["record_id"] == first["record_id"])
        self.assertEqual(active["effective_validity"], "invalid")
        self.assertEqual(len(self.registry.load()["records"]), 2)

    def test_proposition_requires_explicit_counter_evidence_field(self):
        claim = self.claim()
        with self.assertRaises(ValueError):
            self.registry.append_proposition({"statement": "Unsupported shortcut", "support_refs": [claim["record_id"]]})


if __name__ == "__main__":
    unittest.main()
