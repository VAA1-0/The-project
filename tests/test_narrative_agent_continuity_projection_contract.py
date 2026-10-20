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
    def test_interval_recurrence_surfaces_reviewable_roles_and_withholds_antagonist(self):
        inventory = fixture()

        result = build_continuity_projection_envelope(inventory, {}, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        recurrence = result["canonical_collection"]["interval_recurrence"]
        roles = {row["role"]: row for row in recurrence["role_hypotheses"]}

        self.assertEqual(recurrence["metrics"]["occurrence_count"], 3)
        self.assertEqual(recurrence["metrics"]["scene_count"], 2)
        self.assertGreater(roles["leading character"]["probability"], 0.7)
        self.assertEqual(roles["protagonist"]["state"], "candidate")
        self.assertEqual(recurrence["withheld_hypotheses"][0]["role"], "antagonist")
        self.assertIn("opposition", recurrence["withheld_hypotheses"][0]["reason"])
        self.assertIn("may_have_narrative_role", {row["edge_type"] for row in result["graph_projection"]["edges"]})

    def test_confirmed_metadata_role_overrides_matching_occurrence_hypothesis(self):
        inventory = fixture()
        inventory["selected_agent"].update({
            "confirmed_roles": ["protagonist"],
            "role_authority": "explicit_source_media_metadata_confirmation",
            "role_probability": 1.0,
        })

        result = build_continuity_projection_envelope(inventory, {}, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        hypothesis = next(row for row in result["canonical_collection"]["interval_recurrence"]["role_hypotheses"] if row["role"] == "protagonist")

        self.assertEqual(hypothesis["probability"], 1.0)
        self.assertEqual(hypothesis["state"], "confirmed")
        self.assertEqual(hypothesis["authority"], "explicit_source_media_metadata_confirmation")

    def test_confirmed_metadata_role_projects_as_mature_graph_relation(self):
        inventory = fixture()
        inventory["selected_agent"].update({
            "confirmed_roles": ["protagonist"],
            "role_authority": "explicit_source_media_metadata_confirmation",
            "role_probability": 1.0,
        })

        result = build_continuity_projection_envelope(inventory, {}, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        canonical = result["canonical_collection"]
        role_layer = result["constellational_snapshot"]["layers"]["narrative_roles"]
        role_edge = next(row for row in result["graph_projection"]["edges"] if row["edge_type"] == "has_narrative_role")

        self.assertEqual(canonical["role_probability"], 1.0)
        self.assertEqual(role_layer["claims"], ["protagonist"])
        self.assertEqual(role_layer["state"], "confirmed")
        self.assertEqual(role_edge["maturity"]["level"], "mature")
        self.assertEqual(role_edge["maturity"]["authority"], "explicit_source_media_metadata_confirmation")

    def test_scene_presence_estimate_is_confirmed_and_exposes_leave_one_out_guard(self):
        inventory = fixture()
        ledger = decide(None, inventory, {"decision_id": "d1", "operation": "include", "collection_id": "bond-corridor", "occurrence_id": "bond-1"})

        result = build_continuity_projection_envelope(inventory, ledger, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        estimates = result["canonical_collection"]["scene_presence_estimates"]
        scene_one = next(row for row in estimates if row["scene_id"] == "scene-1")

        self.assertEqual(scene_one["presence_probability"], 0.36)
        self.assertEqual(scene_one["state"], "candidate")
        self.assertEqual(scene_one["leave_one_out_probability_by_occurrence"]["bond-1"], 0.0)
        self.assertTrue(scene_one["probability_basis"]["candidate_self_support_excluded_when_used_for_triangulation"])

    def test_confirmed_scene_occurrence_makes_presence_certain_without_confirming_other_occurrences(self):
        inventory = fixture()
        inventory["confirmed_occurrences"][0]["scene_id"] = "scene-1"
        inventory["selected_continuity_corridor"]["confirmed_members"][0]["scene_id"] = "scene-1"

        result = build_continuity_projection_envelope(inventory, {}, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        scene_one = next(row for row in result["canonical_collection"]["scene_presence_estimates"] if row["scene_id"] == "scene-1")

        self.assertEqual(scene_one["presence_probability"], 1.0)
        self.assertEqual(scene_one["state"], "confirmed")
        self.assertEqual(scene_one["authority"], "explicit_analyst_confirmation")

    def test_confirmed_speaker_transcript_raises_separate_editable_topic_ticket(self):
        inventory = fixture()
        transcript_member = {
            "occurrence_id": "bond-line", "analysis_id": "bond-a",
            "narrative_agent_key": "james bond", "narrative_agent_label": "James Bond",
            "source_interval": {"start": 20.0, "end": 22.0},
            "evidence_modality": "transcript_audio", "authority": "explicit_analyst_confirmation",
            "transcript_text": "We need to get out of here.", "traceback_refs": ["bond-line"],
        }
        inventory["confirmed_occurrences"].append(transcript_member)
        inventory["selected_continuity_corridor"]["confirmed_members"].append(transcript_member)

        result = build_continuity_projection_envelope(inventory, {}, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        ticket = next(row for row in result["graph_projection"]["relation_tickets"] if row["predicate"] == "speaks_about")
        topic = result["constellational_snapshot"]["layers"]["what_they_are_talking_about"]

        self.assertEqual(ticket["state"], "candidate")
        self.assertTrue(ticket["editable"])
        self.assertIn("topic account remains interpretive", ticket["warrant"])
        self.assertEqual(topic["state"], "candidate")
        self.assertEqual(topic["claims"], ["We need to get out of here."])

    def test_audio_adjacent_confirmed_agent_raises_editable_dialogue_candidate(self):
        inventory = fixture()
        inventory["confirmed_occurrences"].append({
            "occurrence_id": "nomi-audio", "analysis_id": "bond-a",
            "narrative_agent_key": "nomi", "narrative_agent_label": "Nomi",
            "source_interval": {"start": 12.5, "end": 14.0},
            "evidence_modality": "transcript_audio", "authority": "explicit_analyst_confirmation",
            "traceback_refs": ["nomi-audio"],
        })
        ledger = decide(None, inventory, {"decision_id": "d1", "operation": "include", "collection_id": "bond-corridor", "occurrence_id": "bond-1"})

        result = build_continuity_projection_envelope(inventory, ledger, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        ticket = next(row for row in result["graph_projection"]["relation_tickets"] if row["predicate"] == "dialogue_with")

        self.assertEqual(ticket["state"], "candidate")
        self.assertTrue(ticket["editable"])
        self.assertEqual(ticket["allowed_decisions"], ["confirm", "revise", "reject", "defer"])
        self.assertEqual(result["constellational_snapshot"]["layers"]["who_is_in_dialogue"]["claims"], ["Nomi"])
        self.assertEqual(result["constellational_snapshot"]["layers"]["who_is_in_dialogue"]["state"], "candidate")
        candidate = result["constellational_snapshot"]["layers"]["who_is_in_dialogue"]["candidates"][0]
        self.assertEqual(candidate["label"], "Nomi")
        self.assertGreaterEqual(candidate["probability"], 0.55)
        self.assertEqual(candidate["probability_basis"]["method"], "source_timed_multimodal_dialogue_support_v1")

    def test_visual_copresence_alone_never_raises_dialogue_candidate(self):
        inventory = fixture()
        inventory["confirmed_occurrences"].append({
            "occurrence_id": "nomi-visual", "analysis_id": "bond-a",
            "narrative_agent_key": "nomi", "narrative_agent_label": "Nomi",
            "source_interval": {"start": 10.0, "end": 12.0},
            "evidence_modality": "visual", "authority": "explicit_analyst_confirmation",
        })
        ledger = decide(None, inventory, {"decision_id": "d1", "operation": "include", "collection_id": "bond-corridor", "occurrence_id": "bond-1"})
        result = build_continuity_projection_envelope(inventory, ledger, project_id="bond-cop30-helsinki", collection_id="bond-corridor")
        self.assertNotIn("dialogue_with", {row["predicate"] for row in result["graph_projection"]["relation_tickets"]})

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
        self.assertEqual(canonical["member_occurrence_ids"], ["bond-1", "bond-anchor"])
        self.assertEqual(canonical["automatic_mature_occurrence_ids"], ["bond-anchor"])
        self.assertEqual(canonical["excluded_occurrence_ids"], ["bond-2"])
        for consumer in CONSUMERS:
            view = result["consumer_views"][consumer]
            self.assertEqual(view["revision"], result["revision"])
            self.assertEqual(view["member_occurrence_ids"], ["bond-1", "bond-anchor"])
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
        for row in second["selected_continuity_corridor"]["confirmed_members"]:
            row["narrative_agent_key"] = "nomi"
            row["narrative_agent_label"] = "Nomi"
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
