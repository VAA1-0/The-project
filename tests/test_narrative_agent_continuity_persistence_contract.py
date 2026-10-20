import json
from pathlib import Path
import tempfile
import unittest

from src.backend.analysis.narrative_agent_continuity_persistence import (
    changed_correction_occurrence_ids,
    load_saved_continuity_state,
    selectively_invalidate_projection,
    write_continuity_artifacts,
    write_saved_continuity_state,
)
from src.backend.analysis.saved_analysis_hydration_loader import hydrate_saved_analysis_status


def fixture():
    project_id = "bond-cop30-helsinki"
    inventory = {"project_id": project_id, "inventory_fingerprint": "inventory-1"}
    ledger = {"schema": "vaa1.canonical_decision_ledger.v0", "analysis_id": "bond-a", "decisions": [{"decision_id": "d1"}]}
    canonical = {
        "project_id": project_id,
        "collection_id": "bond-corridor",
        "member_occurrence_ids": ["bond-1"],
        "continuity_claim": "accepted",
        "maturity": "mature_governed_agent_track",
        "measurement_eligibility": {"eligible": True, "denominator": 1},
    }
    projection = {
        "revision": "projection-1",
        "canonical_collection": canonical,
        "graph_projection": {
            "edges": [{
                "edge_id": "spoken-edge",
                "edge_type": "spoken_by",
                "maturity": {"level": "confirmed", "authority": "explicit_user_confirmation"},
            }],
            "relation_tickets": [{
                "ticket_id": "spoken-ticket",
                "edge_id": "spoken-edge",
                "predicate": "spoken_by",
                "state": "confirmed",
                "allowed_decisions": ["revise", "reject"],
                "evidence_refs": [{"evidence_id": "bond-audio-1"}],
                "source_navigation": {
                    "analysis_id": "bond-a",
                    "source_interval": {"start": 55.28, "end": 56.077},
                    "return_panel": "narrative_agent",
                    "return_ticket_id": "spoken-ticket",
                    "preserve_review_position": True,
                },
            }],
        },
        "constellational_snapshot": {"layers": {"who_is_speaking": {
            "state": "candidate",
            "candidates": [{
                "candidate_id": "speaker-candidate",
                "audio_occurrence_id": "bond-audio-1",
                "state": "candidate",
            }],
        }}},
        "consumer_views": {
            name: {
                "revision": "projection-1",
                "member_occurrence_ids": ["bond-1"],
                "continuity_claim": "accepted",
                "maturity": "mature_governed_agent_track",
            }
            for name in ("video", "narrative_agent", "meaning_plot", "master_schema", "data_maturation", "search", "traceback", "measurements")
        },
    }
    return project_id, inventory, ledger, projection


class NarrativeAgentContinuityPersistenceTests(unittest.TestCase):
    def test_changed_correction_ids_detect_add_update_and_removal_only(self):
        previous = {
            "manual_visual_annotations": [
                {"id": "unchanged", "label": "Bond"},
                {"id": "updated", "label": "Bond"},
                {"id": "removed", "label": "Nomi"},
            ],
            "text_substitutions": [],
        }
        current = {
            "manual_visual_annotations": [
                {"id": "unchanged", "label": "Bond"},
                {"id": "updated", "label": "James Bond"},
            ],
            "text_substitutions": [{"id": "added", "speaker_confirmation": "Bond"}],
        }

        self.assertEqual(
            changed_correction_occurrence_ids(previous, current),
            ["added", "removed", "updated"],
        )

    def test_atomic_save_reopen_preserves_revision_members_and_consumers(self):
        project_id, inventory, ledger, projection = fixture()
        with tempfile.TemporaryDirectory() as tempdir:
            path = Path(tempdir) / "narrative_agent_continuity_state.json"
            saved = write_saved_continuity_state(path, inventory=inventory, decision_ledger=ledger, projection=projection, project_id=project_id, analysis_ids=["bond-a"])
            reopened = load_saved_continuity_state(path, expected_project_id=project_id)
            self.assertEqual(reopened["content_checksum"], saved["content_checksum"])
            self.assertEqual(reopened["projection_revision"], "projection-1")
            for view in reopened["projection"]["consumer_views"].values():
                self.assertEqual(view["member_occurrence_ids"], ["bond-1"])
            reopened_ticket = reopened["projection"]["graph_projection"]["relation_tickets"][0]
            self.assertEqual(reopened_ticket["state"], "confirmed")
            self.assertEqual(reopened_ticket["source_navigation"]["source_interval"], {"start": 55.28, "end": 56.077})
            self.assertTrue(reopened_ticket["source_navigation"]["preserve_review_position"])
            self.assertFalse(path.with_suffix(".json.tmp").exists())

    def test_foreign_project_and_tampered_payload_fail_closed(self):
        project_id, inventory, ledger, projection = fixture()
        with tempfile.TemporaryDirectory() as tempdir:
            path = Path(tempdir) / "state.json"
            write_saved_continuity_state(path, inventory=inventory, decision_ledger=ledger, projection=projection, project_id=project_id, analysis_ids=["bond-a"])
            with self.assertRaisesRegex(ValueError, "another project"):
                load_saved_continuity_state(path, expected_project_id="foreign")
            payload = json.loads(path.read_text())
            payload["projection"]["canonical_collection"]["member_occurrence_ids"].append("foreign-1")
            path.write_text(json.dumps(payload))
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                load_saved_continuity_state(path, expected_project_id=project_id)

    def test_selective_invalidation_ignores_unrelated_change_and_stales_dependents(self):
        _, _, _, projection = fixture()
        unrelated = selectively_invalidate_projection(projection, changed_occurrence_ids=["nomi-1"])
        self.assertEqual(unrelated["invalidation"]["state"], "current")
        self.assertEqual(unrelated["canonical_collection"]["continuity_claim"], "accepted")

        affected = selectively_invalidate_projection(projection, changed_occurrence_ids=["bond-1", "nomi-1"])
        self.assertEqual(affected["invalidation"]["affected_occurrence_ids"], ["bond-1"])
        self.assertEqual(affected["canonical_collection"]["continuity_claim"], "stale")
        self.assertFalse(affected["canonical_collection"]["measurement_eligibility"]["eligible"])
        for view in affected["consumer_views"].values():
            self.assertEqual(view["hydration_state"], "stale_retry")

    def test_audio_correction_stales_only_dependent_spoken_by_relation_and_preserves_history(self):
        _, _, _, projection = fixture()

        affected = selectively_invalidate_projection(
            projection, changed_occurrence_ids=["bond-audio-1"]
        )

        self.assertEqual(affected["canonical_collection"]["continuity_claim"], "accepted")
        self.assertEqual(affected["invalidation"]["affected_occurrence_ids"], [])
        self.assertEqual(affected["invalidation"]["affected_relation_edge_ids"], ["spoken-edge"])
        ticket = affected["graph_projection"]["relation_tickets"][0]
        self.assertEqual(ticket["state"], "stale")
        self.assertEqual(ticket["invalidation"]["previous_state"], "confirmed")
        self.assertTrue(ticket["invalidation"]["history_preserved"])
        self.assertEqual(affected["graph_projection"]["edges"][0]["maturity"]["level"], "stale")
        speaker_layer = affected["constellational_snapshot"]["layers"]["who_is_speaking"]
        self.assertEqual(speaker_layer["state"], "stale")
        self.assertEqual(speaker_layer["candidates"][0]["previous_state"], "candidate")
        for view in affected["consumer_views"].values():
            self.assertEqual(view["hydration_state"], "targeted_relation_retry")

    def test_saved_analysis_hydration_requires_checksum_project_and_analysis_membership(self):
        project_id, inventory, ledger, projection = fixture()
        with tempfile.TemporaryDirectory() as tempdir:
            root = Path(tempdir)
            analysis_dir = root / "bond-a"
            state_path = analysis_dir / "narrative_agent_continuity_state.json"
            write_saved_continuity_state(state_path, inventory=inventory, decision_ledger=ledger, projection=projection, project_id=project_id, analysis_ids=["bond-a"])
            (analysis_dir / "narrative_agent_continuity_projection.json").write_text(json.dumps(projection))
            status = {"analysis_id": "bond-a", "project_id": project_id}
            hydrated = hydrate_saved_analysis_status(status, results_dir=root)
            self.assertEqual(hydrated["narrative_agent_continuity_projection"]["revision"], "projection-1")

            foreign = {"analysis_id": "bond-a", "project_id": "foreign"}
            rejected = hydrate_saved_analysis_status(foreign, results_dir=root)
            self.assertNotIn("narrative_agent_continuity_projection", rejected)
            self.assertEqual(rejected["saved_analysis_hydration_audit"]["rejected"][0]["surface"], "narrative_agent_continuity_state")

    def test_export_projection_and_canonical_state_share_one_revision(self):
        project_id, inventory, ledger, projection = fixture()
        with tempfile.TemporaryDirectory() as tempdir:
            result = write_continuity_artifacts(tempdir, inventory=inventory, decision_ledger=ledger, projection=projection, project_id=project_id, analysis_ids=["bond-a"])
            projected = json.loads(Path(result["projection_path"]).read_text())
            reopened = load_saved_continuity_state(result["state_path"], expected_project_id=project_id)
            self.assertTrue(result["save_committed"])
            self.assertEqual(projected["revision"], reopened["projection_revision"])


if __name__ == "__main__":
    unittest.main()
