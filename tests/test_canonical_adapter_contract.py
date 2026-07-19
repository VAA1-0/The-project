import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ANALYSIS = ROOT / "src" / "backend" / "analysis"
sys.path.insert(0, str(ANALYSIS))
SPEC = importlib.util.spec_from_file_location("vaa1_canonical_adapter", ANALYSIS / "canonical_adapter.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CanonicalAdapterContractTests(unittest.TestCase):
    def sync(self, previous, current, ledger=None):
        return MODULE.sync_corrections_to_ledger(
            ledger or {"schema": "vaa1.canonical_decision_ledger.v0", "analysis_id": "a1", "version": 1, "decisions": []},
            previous,
            current,
            analysis_id="a1",
            created_at="2026-07-15T12:00:00Z",
            created_by="analyst",
        )

    def test_adapts_all_governed_legacy_collections(self):
        current = {
            "manual_visual_annotations": [{
                "id": "manual-1", "identity_affirmation": "M", "start_seconds": 1, "end_seconds": 2,
                "metadata_correlation": {"target_id": "track-1"},
            }],
            "label_overrides": [{
                "id": "object:door", "modality": "object", "raw_value": "door",
                "corrected_value": "vault door", "target_track_id": 7,
            }],
            "proliferation_decisions": [{
                "decision_id": "review-1", "candidate_id": "candidate-1", "decision": "confirmed",
                "applied_label": "Bond", "authority_level": "manual_confirmation",
            }],
        }
        ledger, events = self.sync({}, current)
        self.assertEqual(len(events), 3)
        self.assertEqual(
            {item["decision_action"] for item in events},
            {"correct_assignment", "confirm_candidate"},
        )
        self.assertEqual(len(ledger["decisions"]), 3)

    def test_removal_appends_invalidation_without_mutating_original(self):
        previous = {"label_overrides": [{
            "id": "object:door", "modality": "object", "raw_value": "door", "corrected_value": "vault door"
        }]}
        ledger, _ = self.sync({}, previous)
        original = dict(ledger["decisions"][0])
        ledger, events = self.sync(previous, {"label_overrides": []}, ledger)
        self.assertEqual(events[-1]["decision_action"], "invalidate")
        self.assertEqual(ledger["decisions"][0], original)

    def test_same_compatibility_snapshot_is_idempotent(self):
        current = {"proliferation_decisions": [{
            "decision_id": "review-1", "candidate_id": "candidate-1", "decision": "deferred"
        }]}
        ledger, first = self.sync({}, current)
        ledger, second = self.sync(current, current, ledger)
        self.assertEqual(len(first), 1)
        self.assertEqual(second, [])
        self.assertEqual(len(ledger["decisions"]), 1)

    def test_descriptive_legacy_manual_authority_is_normalized(self):
        current = {"proliferation_decisions": [{
            "decision_id": "review-legacy", "candidate_id": "candidate-legacy",
            "decision": "confirmed",
            "authority_level": "manual_audio_visual_narrative_agent_triangulation",
        }]}
        ledger, events = self.sync({}, current)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["authority"], "explicit_user_confirmation")
        self.assertEqual(ledger["decisions"][0]["authority"], "explicit_user_confirmation")


if __name__ == "__main__":
    unittest.main()
