import json
from pathlib import Path
import tempfile
import unittest

from src.backend.analysis.narrative_agent_continuity_export import (
    build_continuity_interpretation_export,
    restore_continuity_interpretation_export,
    write_continuity_interpretation_export,
)


def fixture():
    ticket = {
        "ticket_id": "spoken-ticket",
        "edge_id": "spoken-edge",
        "assertion_id": "spoken-assertion",
        "subject_node_id": "utterance-1",
        "predicate": "spoken_by",
        "object_node_id": "agent-bond",
        "state": "confirmed",
        "authority": "explicit_user_confirmation",
        "analyst_meaning": "James Bond speaks this line.",
        "evidence_refs": [{
            "evidence_id": "bond-audio-1",
            "analysis_id": "bond-a",
            "source_type": "transcript_audio",
            "time_range": {"start": 55.28, "end": 56.077},
        }],
        "source_navigation": {
            "analysis_id": "bond-a",
            "source_interval": {"start": 55.28, "end": 56.077},
            "return_panel": "narrative_agent",
            "return_ticket_id": "spoken-ticket",
            "preserve_review_position": True,
        },
        "traceback_refs": ["bond-audio-1"],
    }
    projection = {
        "schema": "vaa1.narrative_agent_continuity_projection_envelope.v1",
        "revision": "revision-1",
        "canonical_collection": {
            "project_id": "bond-cop30-helsinki",
            "collection_id": "bond-agent",
            "narrative_agent_key": "james bond",
            "narrative_agent_label": "James Bond",
        },
        "graph_projection": {
            "relation_tickets": [ticket, {**ticket, "ticket_id": "other", "edge_id": "other-edge", "predicate": "participates_in"}],
            "edges": [{"edge_id": "spoken-edge", "edge_type": "spoken_by", "maturity": {"level": "confirmed"}}],
            "nodes": [
                {"node_id": "utterance-1", "node_type": "utterance_candidate"},
                {"node_id": "agent-bond", "node_type": "narrative_agent"},
            ],
        },
        "constellational_snapshot": {"layers": {"who_is_speaking": {
            "state": "confirmed", "claims": ["James Bond"], "candidates": []
        }}},
    }
    ledger = {"decisions": [{
        "decision_id": "decision-1",
        "subject_ref": {"type": "interpretive_relation", "id": "spoken-edge"},
        "value": "confirmed",
        "authority": "explicit_user_confirmation",
        "evidence_refs": ["bond-audio-1"],
    }]}
    return projection, ledger


class NarrativeAgentContinuityExportTests(unittest.TestCase):
    def test_export_preserves_state_history_source_chain_and_exact_navigation(self):
        projection, ledger = fixture()
        package = build_continuity_interpretation_export(projection, ledger)

        self.assertTrue(package["eligibility"]["checked_at_export"])
        self.assertEqual(package["state_distinctions"]["counts"], {"confirmed": 1})
        self.assertFalse(package["state_distinctions"]["flattened"])
        self.assertEqual(package["decision_history"][0]["decision_id"], "decision-1")
        self.assertEqual(package["source_chain"][0]["source_navigation"]["source_interval"], {"start": 55.28, "end": 56.077})
        self.assertEqual(len(package["construct"]["relation_tickets"]), 1)

    def test_atomic_export_restores_in_isolation_and_tampering_fails(self):
        projection, ledger = fixture()
        with tempfile.TemporaryDirectory() as tempdir:
            path = Path(tempdir) / "speaker-attribution.json"
            written = write_continuity_interpretation_export(path, projection, ledger)
            restored = restore_continuity_interpretation_export(
                json.loads(path.read_text()), expected_project_id="bond-cop30-helsinki"
            )
            self.assertEqual(restored["content_checksum"], written["content_checksum"])
            self.assertEqual(restored["construct"]["narrative_agent_label"], "James Bond")
            tampered = json.loads(path.read_text())
            tampered["construct"]["relation_tickets"][0]["state"] = "candidate"
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                restore_continuity_interpretation_export(tampered, expected_project_id="bond-cop30-helsinki")

    def test_stale_projection_and_foreign_restoration_fail_closed(self):
        projection, ledger = fixture()
        projection["invalidation"] = {"state": "recompute_required"}
        with self.assertRaisesRegex(ValueError, "not export eligible"):
            build_continuity_interpretation_export(projection, ledger)

        projection.pop("invalidation")
        package = build_continuity_interpretation_export(projection, ledger)
        with self.assertRaisesRegex(ValueError, "another project"):
            restore_continuity_interpretation_export(package, expected_project_id="foreign")


if __name__ == "__main__":
    unittest.main()
