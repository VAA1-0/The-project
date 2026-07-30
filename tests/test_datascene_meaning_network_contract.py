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
    def test_master_schema_candidate_scene_timing_provides_provisional_membership(self):
        artifact = meaning_network.build_datascene_meaning_network(
            "analysis-scene-timing",
            {
                "vaa1_annotation_master_schema": {
                    "temporal_segments": [
                        {
                            "segment_id": "scene-1",
                            "scene_id": "s1",
                            "segment_type": "scene",
                            "event_family": "scene_understanding",
                            "start": 0.0,
                            "end": 10.0,
                            "review_state": "candidate_review_required",
                        },
                        {
                            "segment_id": "scene-2",
                            "scene_id": "s2",
                            "segment_type": "scene",
                            "event_family": "scene_understanding",
                            "start": 10.0,
                            "end": 20.0,
                            "review_state": "candidate_review_required",
                        },
                    ]
                },
                "audio_event_intervals": {
                    "intervals": [
                        {"event_id": "in-scene-1", "event_type": "music", "start": 2.0, "end": 4.0},
                        {"event_id": "at-cut", "event_type": "noise", "start": 10.0, "end": 11.0},
                        {"event_id": "outside", "event_type": "music", "start": 21.0, "end": 22.0},
                    ]
                },
            },
            scene_cards={"scene_cards": [{"scene_id": "s1"}, {"scene_id": "s2"}]},
        )
        nodes = artifact["meaning_network"]["nodes"]
        inside = next(node for node in nodes if node["node_id"] == "audio-event:in-scene-1")
        at_cut = next(node for node in nodes if node["node_id"] == "audio-event:at-cut")
        outside = next(node for node in nodes if node["node_id"] == "audio-event:outside")
        self.assertEqual(inside["attributes"]["scene_id"], "s1")
        self.assertEqual(at_cut["attributes"]["scene_id"], "s2")
        self.assertEqual(
            inside["attributes"]["scene_membership_status"],
            "provisional_resolved",
        )
        self.assertEqual(outside["attributes"]["scene_membership_status"], "unresolved")
        self.assertEqual(
            artifact["summary"]["scene_timing"]["authority"],
            "master_schema_candidate_scene_interval",
        )
        self.assertEqual(
            artifact["summary"]["scene_membership"]["provisional_resolved_node_count"],
            2,
        )
        self.assertEqual(
            artifact["summary"]["scene_membership"]["unresolved_node_count"],
            1,
        )

    def test_unresolved_scene_membership_does_not_hide_delivered_evidence(self):
        artifact = meaning_network.build_datascene_meaning_network(
            "analysis-unscoped-evidence",
            {
                "audio_event_intervals": {
                    "intervals": [
                        {"event_id": "music-1", "event_type": "music", "start": 1.0, "end": 3.0}
                    ]
                },
                "audio_diarization": {
                    "speaker_turns": [
                        {
                            "turn_id": "turn-1",
                            "speaker_label": "SPEAKER_00",
                            "start": 2.0,
                            "end": 4.0,
                            "text": "Hello",
                        }
                    ]
                },
            },
            transcript={
                "segments": [
                    {"id": "line-1", "start": 2.0, "end": 4.0, "text": "Hello"}
                ]
            },
            visual_analysis={
                "scene_segments": [{"scene_id": "s1", "start": None, "end": None}],
                "tracked_objects": [
                    {"track_id": "person-1", "label": "person", "start": 2.0, "end": 4.0}
                ],
            },
        )
        nodes = artifact["meaning_network"]["nodes"]
        self.assertTrue(any(node["node_id"] == "audio-event:music-1" for node in nodes))
        self.assertTrue(any(node["node_id"] == "speaker-turn:turn-1" for node in nodes))
        self.assertTrue(any(node["node_id"] == "person:unscoped:person-1" for node in nodes))
        self.assertTrue(any(node["node_id"] == "transcript:line-1" for node in nodes))
        evidence_nodes = [
            node
            for node in nodes
            if node["node_id"]
            in {
                "audio-event:music-1",
                "speaker-turn:turn-1",
                "person:unscoped:person-1",
                "transcript:line-1",
            }
        ]
        self.assertTrue(all(node["ui"]["source_navigation_enabled"] for node in evidence_nodes))
        self.assertTrue(
            all(node["attributes"]["scene_membership_status"] == "unresolved" for node in evidence_nodes)
        )

    def test_audio_events_turns_and_confirmed_agent_audio_enter_meaning_graph(self):
        artifact = meaning_network.build_datascene_meaning_network(
            "analysis-audio-graph",
            {
                "audio_event_intervals": {
                    "intervals": [
                        {"event_id": "music-1", "event_type": "music", "start": 1.0, "end": 3.0}
                    ]
                },
                "audio_diarization": {
                    "speaker_turns": [
                        {"turn_id": "turn-1", "speaker_label": "SPEAKER_00", "start": 2.0, "end": 4.0, "text": "Hello"}
                    ]
                },
                "annotation_corrections": {
                    "manual_visual_annotations": [
                        {
                            "id": "audio-agent-1",
                            "category": "Audio",
                            "identity_affirmation": "James Bond",
                            "start_seconds": 2.0,
                            "end_seconds": 4.0,
                        }
                    ]
                },
            },
            transcript={"segments": []},
            visual_analysis={
                "scene_segments": [{"scene_id": "s1", "start": 0.0, "end": 5.0}],
                "tracked_objects": [],
            },
        )
        nodes = artifact["meaning_network"]["nodes"]
        self.assertTrue(any(node["node_type"] == "audio_event" for node in nodes))
        self.assertTrue(
            any(
                node["node_type"] == "speaker"
                and node["evidence_refs"][0]["source_type"] == "speaker_diarization_turn"
                for node in nodes
            )
        )
        self.assertTrue(
            any(
                node["node_type"] == "narrative_agent"
                and node["label"] == "James Bond"
                and node["maturity"]["level"] == "analyst_confirmed"
                for node in nodes
            )
        )
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

    def test_open_topology_matcher_projects_traceable_nodes_and_edges(self):
        artifact = meaning_network.build_datascene_meaning_network(
            "analysis-open-topology-matcher",
            {
                "evidence_proliferation_matches": [
                    {
                        "request_id": "matcher-refresh:bond",
                        "open_topology_som": {
                            "schema": "vaa1.open_topology_som_traceable.v1",
                            "topology_mode": "open_topology_som",
                            "fixed_grid": False,
                            "diagnostic_only": True,
                            "nodes": [
                                {
                                    "node_id": "seed:manual-bond",
                                    "node_type": "mature_anchor",
                                    "label": "James Bond",
                                    "source_refs": ["manual-bond"],
                                },
                                {
                                    "node_id": "candidate:late-person",
                                    "node_type": "candidate",
                                    "label": "Confirm Narrative Agent 93%",
                                    "cluster_id": "open-topology:character_continuity",
                                    "source_panel": "objects_panel",
                                    "source_kind": "bbox_detection",
                                    "source_time": {"start": 96.0, "end": 96.2},
                                    "source_anchors": [
                                        {
                                            "anchor_type": "media_time_interval",
                                            "interval": {"start": 96.0, "end": 96.2},
                                        },
                                        {
                                            "anchor_type": "bbox",
                                            "bbox": {"x": 0.52, "y": 0.12, "w": 0.26, "h": 0.71},
                                        },
                                    ],
                                    "similarity_score": 0.93,
                                    "review_required": True,
                                },
                            ],
                            "edges": [
                                {
                                    "edge_id": "edge:manual-bond:late-person",
                                    "from_node": "seed:manual-bond",
                                    "to_node": "candidate:late-person",
                                    "edge_type": "traceable_similarity",
                                    "weight": 0.93,
                                    "match_basis": "cross_scene_continuity, visual candidate",
                                    "review_required": True,
                                }
                            ],
                            "clusters": [
                                {
                                    "cluster_id": "open-topology:character_continuity",
                                    "candidate_ids": ["candidate:late-person"],
                                }
                            ],
                        },
                    }
                ]
            },
            transcript={"segments": []},
            visual_analysis={"tracked_objects": []},
        )

        network = artifact["meaning_network"]
        matcher_nodes = [
            node for node in network["nodes"]
            if node["ui"]["display_group"] == "open_topology_som_matcher"
        ]
        matcher_edges = [
            edge for edge in network["edges"]
            if edge["edge_type"] == "traceable_similarity"
        ]
        self.assertGreaterEqual(len(matcher_nodes), 2)
        self.assertEqual(matcher_edges[0]["maturity"]["authority"], "matcher_agent")
        self.assertFalse(matcher_nodes[0]["attributes"]["fixed_grid"])
        candidate_node = next(node for node in matcher_nodes if "late-person" in node["node_id"])
        self.assertTrue(candidate_node["ui"]["source_navigation_enabled"])
        self.assertEqual(candidate_node["evidence_refs"][0]["time_range"]["start"], 96.0)
        self.assertIn("bbox", candidate_node["evidence_refs"][0])
        self.assertTrue(candidate_node["attributes"]["linked_data_principle"]["node_is_traceable"])
        self.assertTrue(candidate_node["attributes"]["linked_data_principle"]["source_time_resolved"])
        self.assertTrue(candidate_node["attributes"]["linked_data_principle"]["bbox_resolved"])
        self.assertEqual(matcher_edges[0]["evidence_refs"][0]["time_range"]["start"], 96.0)
        self.assertTrue(
            any(
                anchor["anchor_type"] == "open_topology_som_cluster"
                for anchor in network["continuity_anchors"]
            )
        )
        self.assertTrue(
            any(
                confirmation["confirmation_type"] == "matcher_topology_review"
                for confirmation in network["confirmations"]
            )
        )

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
