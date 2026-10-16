import unittest

from src.backend.analysis.narrative_agent_continuity import build_continuity_inventory
from src.backend.analysis.narrative_agent_continuity_decisions import append_continuity_decision
from src.backend.analysis.narrative_agent_continuity_projection import (
    CONSUMERS,
    build_multi_agent_projection_matrix,
    build_continuity_projection_envelope,
)


def fixture():
    status = {
        "analysis_id": "bond-a",
        "project_id": "bond-cop30-helsinki",
        "annotation_corrections": {"manual_visual_annotations": []},
        "narrative_agent_recognition_candidates": [
            {
                "candidate_id": "bond-1",
                "narrative_agent_label": "James Bond",
                "start_seconds": 8,
                "end_seconds": 12,
                "scene_id": "scene-1",
                "bbox": {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.5},
            },
            {
                "candidate_id": "bond-2",
                "narrative_agent_label": "James Bond",
                "start_seconds": 40,
                "end_seconds": 44,
                "scene_id": "scene-2",
                "bbox": {"x": 0.2, "y": 0.1, "w": 0.2, "h": 0.5},
            },
        ],
    }
    # A governed reference is required even though proposed memberships remain review-only.
    status["annotation_corrections"]["manual_visual_annotations"].append(
        {
            "id": "bond-anchor",
            "category": "Identification",
            "identity_affirmation": "James Bond",
            "start_seconds": 1,
            "end_seconds": 2,
            "coordinates": {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.5},
            "metadata_correlation": {
                "manual_confirmation_event": {
                    "authority_level": "manual_confirmation",
                    "confirmed_fields": {"narrative_agent": True},
                }
            },
        }
    )
    return build_continuity_inventory([status], project_id="bond-cop30-helsinki")


def decide(ledger, inventory, payload):
    return append_continuity_decision(
        ledger,
        payload,
        analysis_id="bond-a",
        project_id="bond-cop30-helsinki",
        inventory=inventory,
    )[0]


class NarrativeAgentContinuityProjectionTests(unittest.TestCase):
    def test_accepted_collection_projects_identical_revision_and_members_everywhere(self):
        inventory = fixture()
        ledger = decide(None, inventory, {"decision_id": "d1", "operation": "include", "collection_id": "bond-corridor", "occurrence_id": "bond-1"})
        ledger = decide(ledger, inventory, {"decision_id": "d2", "operation": "exclude", "collection_id": "bond-corridor", "occurrence_id": "bond-2"})
        ledger = decide(ledger, inventory, {"decision_id": "d3", "operation": "confirm", "target_kind": "collection", "collection_id": "bond-corridor", "evidence_refs": ["bond-1"]})

        result = build_continuity_projection_envelope(inventory, ledger, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        canonical = result["canonical_collection"]

        self.assertEqual(set(result["consumer_views"]), set(CONSUMERS))
        self.assertEqual(canonical["continuity_claim"], "accepted")
        self.assertTrue(canonical["measurement_eligibility"]["eligible"])
        self.assertEqual(canonical["member_occurrence_ids"], ["bond-1"])
        self.assertEqual(canonical["excluded_occurrence_ids"], ["bond-2"])
        for consumer in CONSUMERS:
            view = result["consumer_views"][consumer]
            self.assertEqual(view["revision"], result["revision"])
            self.assertEqual(view["member_occurrence_ids"], ["bond-1"])
            self.assertEqual(view["maturity"], "mature_governed_agent_track")
            self.assertEqual(view["source_navigation"][0]["source_interval"], {"start": 8.0, "end": 12.0})

    def test_unconfirmed_collection_cannot_surface_as_mature(self):
        inventory = fixture()
        ledger = decide(None, inventory, {"decision_id": "d1", "operation": "include", "collection_id": "bond-corridor", "occurrence_id": "bond-1"})
        result = build_continuity_projection_envelope(inventory, ledger, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        self.assertEqual(result["canonical_collection"]["continuity_claim"], "not_accepted")
        self.assertFalse(result["canonical_collection"]["measurement_eligibility"]["eligible"])

    def test_foreign_project_and_missing_occurrence_fail_closed(self):
        inventory = fixture()
        with self.assertRaisesRegex(ValueError, "project boundary mismatch"):
            build_continuity_projection_envelope(inventory, {}, project_id="foreign", collection_id="bond")

    def test_second_agent_corridor_remains_distinct_despite_shared_raw_track(self):
        project_id = "bond-cop30-helsinki"
        status = {
            "analysis_id": "bond-a",
            "project_id": project_id,
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "bond-occurrence",
                        "category": "Identification",
                        "identity_affirmation": "James Bond",
                        "start_seconds": 43,
                        "end_seconds": 46,
                        "coordinates": {"x": .1, "y": .1, "w": .2, "h": .4},
                        "metadata_correlation": {"target_id": "track-9", "manual_confirmation_event": {"authority_level": "manual_confirmation", "confirmed_fields": {"narrative_agent": True}}},
                    },
                    {
                        "id": "nomi-occurrence",
                        "category": "Identification",
                        "identity_affirmation": "Nomi",
                        "start_seconds": 47,
                        "end_seconds": 49,
                        "coordinates": {"x": .2, "y": .1, "w": .2, "h": .4},
                        "metadata_correlation": {"target_id": "track-9", "manual_confirmation_event": {"authority_level": "manual_confirmation", "confirmed_fields": {"narrative_agent": True}}},
                    },
                ]
            },
        }
        corridors = []
        for label, occurrence, collection in (
            ("James Bond", "bond-occurrence", "bond-corridor"),
            ("Nomi", "nomi-occurrence", "nomi-corridor"),
        ):
            agent_inventory = build_continuity_inventory([status], selected_agent=label, project_id=project_id)
            agent_ledger = decide(None, agent_inventory, {"decision_id": f"include-{occurrence}", "operation": "include", "collection_id": collection, "occurrence_id": occurrence})
            agent_ledger = decide(agent_ledger, agent_inventory, {"decision_id": f"confirm-{collection}", "operation": "confirm", "target_kind": "collection", "collection_id": collection})
            corridors.append({"inventory": agent_inventory, "decision_ledger": agent_ledger, "collection_id": collection})

        matrix = build_multi_agent_projection_matrix(corridors, project_id=project_id)

        self.assertEqual(matrix["summary"]["accepted_agent_count"], 2)
        self.assertEqual(matrix["agent_corridors"]["james bond"]["canonical_collection"]["member_occurrence_ids"], ["bond-occurrence"])
        self.assertEqual(matrix["agent_corridors"]["nomi"]["canonical_collection"]["member_occurrence_ids"], ["nomi-occurrence"])
        self.assertTrue(matrix["governance"]["shared_raw_track_does_not_merge_agents"])

    def test_same_occurrence_cannot_mature_in_two_agent_corridors(self):
        first = fixture()
        second = fixture()
        second["selected_agent"] = {"narrative_agent_key": "nomi", "narrative_agent_label": "Nomi"}
        for row in second["selected_continuity_corridor"]["proposed_members"]:
            if row["occurrence_id"] == "bond-1":
                row["narrative_agent_key"] = "nomi"
                row["narrative_agent_label"] = "Nomi"
        corridors = []
        for index, agent_inventory in enumerate((first, second), 1):
            ledger = decide(None, agent_inventory, {"decision_id": f"include-{index}", "operation": "include", "collection_id": f"corridor-{index}", "occurrence_id": "bond-1"})
            corridors.append({"inventory": agent_inventory, "decision_ledger": ledger, "collection_id": f"corridor-{index}"})
        with self.assertRaisesRegex(ValueError, "multiple Narrative Agent corridors"):
            build_multi_agent_projection_matrix(corridors, project_id="bond-cop30-helsinki")


if __name__ == "__main__":
    unittest.main()
