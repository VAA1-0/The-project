import copy
import unittest

from src.backend.analysis.narrative_agent_continuity import build_continuity_inventory
from src.backend.analysis.narrative_agent_continuity_decisions import (
    append_continuity_decision,
    project_continuity_decisions,
)


def inventory():
    status = {
        "analysis_id": "bond-a",
        "project_id": "bond-cop30-helsinki",
        "annotation_corrections": {
            "manual_visual_annotations": [
                {
                    "id": "bond-1",
                    "category": "Identification",
                    "identity_affirmation": "James Bond",
                    "start_seconds": 8,
                    "end_seconds": 12,
                    "coordinates": {"x": 0.1, "y": 0.2, "w": 0.2, "h": 0.4},
                    "metadata_correlation": {
                        "target_id": "track-7",
                        "manual_confirmation_event": {
                            "authority_level": "manual_confirmation",
                            "confirmed_fields": {"narrative_agent": True},
                        },
                    },
                }
            ]
        },
        "narrative_agent_recognition_candidates": [
            {
                "candidate_id": "bond-candidate-2",
                "narrative_agent_label": "James Bond",
                "start_seconds": 40,
                "end_seconds": 44,
                "bbox": {"x": 0.2, "y": 0.1, "w": 0.2, "h": 0.5},
            }
        ],
    }
    return build_continuity_inventory([status], project_id="bond-cop30-helsinki")


class NarrativeAgentContinuityDecisionTests(unittest.TestCase):
    def append(self, ledger, payload):
        return append_continuity_decision(
            ledger,
            payload,
            analysis_id="bond-a",
            project_id="bond-cop30-helsinki",
            inventory=inventory(),
        )

    def test_include_then_exclude_is_append_only_and_does_not_mutate_occurrence(self):
        source_inventory = inventory()
        source_before = copy.deepcopy(source_inventory)
        ledger, included, _ = append_continuity_decision(
            None,
            {"decision_id": "d1", "operation": "include", "collection_id": "bond-corridor", "occurrence_id": "bond-candidate-2"},
            analysis_id="bond-a",
            project_id="bond-cop30-helsinki",
            inventory=source_inventory,
        )
        ledger, excluded, _ = self.append(
            ledger,
            {"decision_id": "d2", "operation": "exclude", "collection_id": "bond-corridor", "occurrence_id": "bond-candidate-2"},
        )
        projection = project_continuity_decisions(ledger, project_id="bond-cop30-helsinki", collection_id="bond-corridor")

        self.assertEqual(source_inventory, source_before)
        self.assertEqual(len(ledger["decisions"]), 2)
        self.assertIn(included["decision_id"], excluded["supersedes"])
        self.assertEqual(projection["included_occurrence_ids"], [])
        self.assertEqual(projection["excluded_occurrence_ids"], ["bond-candidate-2"])
        self.assertEqual(excluded["occurrence_snapshot"]["source_interval"], {"start": 40.0, "end": 44.0})

    def test_undo_reactivates_prior_effective_membership_without_deleting_history(self):
        ledger, _, _ = self.append(None, {"decision_id": "d1", "operation": "include", "collection_id": "bond-corridor", "occurrence_id": "bond-1"})
        ledger, _, _ = self.append(ledger, {"decision_id": "d2", "operation": "exclude", "collection_id": "bond-corridor", "occurrence_id": "bond-1"})
        ledger, undo, _ = self.append(ledger, {"decision_id": "d3", "operation": "undo", "collection_id": "bond-corridor", "target_decision_id": "d2"})
        projection = project_continuity_decisions(ledger, project_id="bond-cop30-helsinki", collection_id="bond-corridor")

        self.assertEqual(len(ledger["decisions"]), 3)
        self.assertEqual(undo["undo_target_decision_id"], "d2")
        self.assertEqual(projection["included_occurrence_ids"], ["bond-1"])
        self.assertEqual(projection["undone_decision_ids"], ["d2"])

    def test_split_and_merge_are_governed_structure_decisions(self):
        ledger, _, _ = self.append(None, {"decision_id": "split-1", "operation": "split", "collection_id": "bond-corridor", "related_collection_ids": ["bond-early", "bond-late"]})
        ledger, _, _ = self.append(ledger, {"decision_id": "merge-1", "operation": "merge", "collection_id": "bond-corridor", "related_collection_ids": ["bond-early", "bond-late"]})
        projection = project_continuity_decisions(ledger, project_id="bond-cop30-helsinki", collection_id="bond-corridor")

        self.assertEqual([row["continuity_operation"] for row in projection["structure_decisions"]], ["split", "merge"])

    def test_confirm_reject_and_defer_project_as_explicit_membership_states(self):
        cases = {
            "confirm": ("included_occurrence_ids", "confirm_candidate"),
            "reject": ("excluded_occurrence_ids", "reject_candidate"),
            "defer": ("deferred_occurrence_ids", "defer_candidate"),
        }
        for operation, (projection_key, canonical_action) in cases.items():
            with self.subTest(operation=operation):
                ledger, decision, _ = self.append(
                    None,
                    {
                        "decision_id": f"{operation}-1",
                        "operation": operation,
                        "collection_id": "bond-corridor",
                        "occurrence_id": "bond-candidate-2",
                    },
                )
                projection = project_continuity_decisions(
                    ledger,
                    project_id="bond-cop30-helsinki",
                    collection_id="bond-corridor",
                )
                self.assertEqual(decision["decision_action"], canonical_action)
                self.assertEqual(projection[projection_key], ["bond-candidate-2"])

    def test_decisions_fail_closed_for_foreign_project_and_unknown_occurrence(self):
        with self.assertRaisesRegex(ValueError, "project boundary mismatch"):
            append_continuity_decision(None, {"operation": "include", "collection_id": "bond", "occurrence_id": "bond-1"}, analysis_id="bond-a", project_id="foreign", inventory=inventory())
        with self.assertRaisesRegex(ValueError, "requires an occurrence"):
            self.append(None, {"operation": "include", "collection_id": "bond", "occurrence_id": "missing"})


if __name__ == "__main__":
    unittest.main()
