import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load_module():
    repo_root = Path(__file__).resolve().parents[1]
    module_path = repo_root / "src/backend/analysis/datascene_meaning_network.py"
    spec = importlib.util.spec_from_file_location("datascene_meaning_network", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


meaning_network = load_module()


class DatasceneMeaningNetworkContractTest(unittest.TestCase):
    def test_scene_bounded_person_transcript_candidates_are_navigable(self):
        artifact = meaning_network.build_datascene_meaning_network(
            "analysis-meaning-network",
            {},
            transcript={
                "segments": [
                    {
                        "id": "utt-1",
                        "speaker": "Speaker 1",
                        "text": "We need to decide who is actually present here.",
                        "start": 1.0,
                        "end": 3.0,
                    }
                ]
            },
            visual_analysis={
                "scene_segments": [
                    {"scene_id": "s1", "label": "Opening exchange", "start": 0.0, "end": 5.0}
                ],
                "tracked_objects": [
                    {
                        "track_id": "t1",
                        "label": "person",
                        "start": 0.5,
                        "end": 4.0,
                        "confidence": 0.72,
                    }
                ],
            },
        )

        network = artifact["meaning_network"]
        self.assertEqual(artifact["schema"], "vaa1.datascene_meaning_network.v1")
        self.assertTrue(network["ui_contract"]["scene_timeline_enabled"])
        self.assertTrue(network["ui_contract"]["characters_in_scene_enabled"])
        self.assertIn("quick_confirm_scene_presence", network["ui_contract"])
        self.assertIn("required_affordances", network["ui_contract"])
        self.assertIn("add_node", network["ui_contract"]["required_affordances"])
        self.assertIn("copy_anchor", network["ui_contract"]["required_affordances"])
        self.assertIn("paste_anchor", network["ui_contract"]["required_affordances"])
        self.assertTrue(network["ui_contract"]["source_navigation_required"])
        self.assertTrue(network["ui_contract"]["node_marker_update_required"])
        self.assertTrue(network["ui_contract"]["edge_marker_update_required"])
        self.assertTrue(
            any(node["node_type"] == "scene" and node["ui"]["display_group"] == "scene_timeline" for node in network["nodes"])
        )
        self.assertTrue(
            any(node["ui"]["source_navigation_enabled"] and node["ui"]["node_marker"]["source_jumps"] for node in network["nodes"])
        )
        self.assertTrue(
            any(node["node_type"] == "evidence_fragment" and node["ui"]["display_group"] == "characters_in_scene" for node in network["nodes"])
        )
        self.assertTrue(any(edge["edge_type"] == "co_occurs_with" for edge in network["edges"]))
        self.assertTrue(
            any(edge["ui"]["source_navigation_enabled"] and edge["ui"]["edge_marker"]["source_jumps"] for edge in network["edges"])
        )
        self.assertTrue(
            any(anchor["anchor_type"] == "character_continuity" for anchor in network["continuity_anchors"])
        )
        self.assertTrue(
            any(anchor["copy_paste_contract"]["paste_to_scene_coordinate"] for anchor in network["continuity_anchors"])
        )
        confirmation = network["confirmations"][0]
        self.assertEqual(confirmation["confirmation_type"], "character_presence")
        self.assertIn("narrative_agent_panel", confirmation["proliferation_scope"])

    def test_raw_person_overload_surfaces_secondary_protocol_question(self):
        tracked_objects = [
            {
                "track_id": f"p{i}",
                "label": "person",
                "start": float(i),
                "end": float(i) + 0.5,
                "confidence": 0.4,
            }
            for i in range(25)
        ]
        artifact = meaning_network.build_datascene_meaning_network(
            "analysis-overload",
            {},
            transcript={"segments": []},
            visual_analysis={
                "scene_segments": [{"scene_id": "s1", "start": 0.0, "end": 30.0}],
                "tracked_objects": tracked_objects,
            },
        )

        self.assertTrue(artifact["summary"]["raw_detection_overload"])
        diagnostic = next(
            node for node in artifact["meaning_network"]["nodes"]
            if node["node_id"] == "diagnostic:raw-person-overload"
        )
        attributes = diagnostic["attributes"]
        self.assertIn("secondary_protocol_question", attributes)
        self.assertIn("probable_alternatives", attributes)
        self.assertIn("speaker_agent_link_missing", attributes["probable_alternatives"])
        self.assertIn("visual_profile_comparison_needed", attributes["probable_alternatives"])
        self.assertIn("transcript", attributes["minimum_next_step"].lower())

    def test_artifact_writer_persists_datascene_meaning_network(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "datascene_meaning_network.json"
            payload = meaning_network.write_datascene_meaning_network_artifact(
                "analysis-write",
                {},
                output_path,
                transcript={"segments": [{"id": "utt-1", "speaker": "A", "start": 0.0, "end": 1.0}]},
                visual_analysis={
                    "tracked_objects": [{"track_id": "t1", "label": "person", "start": 0.0, "end": 1.0}]
                },
            )
            self.assertTrue(output_path.exists())
            saved = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(saved["schema"], payload["schema"])
            self.assertEqual(saved["meaning_network"]["network_id"], "meaning-network:analysis-write")


if __name__ == "__main__":
    unittest.main()
