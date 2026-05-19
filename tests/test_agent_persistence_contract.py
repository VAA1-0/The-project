import importlib.util
import unittest
from pathlib import Path


def load_agent_persistence_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/agent_persistence.py"
    )
    spec = importlib.util.spec_from_file_location("agent_persistence", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


agent_persistence = load_agent_persistence_module()


def load_agent_persistence_manager_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/agent_persistence_manager.py"
    )
    spec = importlib.util.spec_from_file_location("agent_persistence_manager", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


agent_persistence_manager = load_agent_persistence_manager_module()


class AgentPersistenceContractTest(unittest.TestCase):
    def departed_track(self, **overrides):
        payload = {
            "track_id": "track-7",
            "agent_label": "James Bond",
            "end": 10.0,
            "feature_cloud_ref": "visual-cloud:bond:pre",
            "frame_ref": "frame:0099",
            "bbox_ref": "bbox:track-7:last",
            "features": {
                "face_embedding": [0.9, 0.1, 0.0],
                "torso_histogram": [0.8, 0.2, 0.0],
            },
        }
        payload.update(overrides)
        return payload

    def arrived_track(self, **overrides):
        payload = {
            "track_id": "track-12",
            "start": 10.8,
            "feature_cloud_ref": "visual-cloud:bond:post",
            "frame_ref": "frame:0110",
            "bbox_ref": "bbox:track-12:first",
            "features": {
                "face_embedding": [0.88, 0.12, 0.0],
                "torso_histogram": [0.78, 0.22, 0.0],
            },
        }
        payload.update(overrides)
        return payload

    def scene_cut(self):
        return {
            "cut_id": "cut-10",
            "time": 10.2,
            "pre_segment_id": "scene-a",
            "post_segment_id": "scene-b",
        }

    def test_agent_persistence_accepts_strong_scene_cut_match(self):
        result = agent_persistence.cross_scene_persistence_check(
            [self.departed_track()],
            [self.arrived_track()],
            scene_cut=self.scene_cut(),
        )

        self.assertEqual(result["schema"], "vaa1.agent_persistence_scene_cut.v1")
        self.assertEqual(result["summary"]["accepted_count"], 1)
        match = result["matches"][0]
        self.assertEqual(match["feature_type"], "agent_persistence_scene_cut")
        self.assertEqual(match["agent_label"], "James Bond")
        self.assertEqual(match["resolution"], "Agent Persistence Established")
        self.assertTrue(
            result["governance"]["does_not_assert_natural_person_identity"]
        )
        self.assertIn("departed_feature_cloud_ref", match["traceback"])

    def test_below_threshold_match_stays_review_candidate(self):
        result = agent_persistence.cross_scene_persistence_check(
            [self.departed_track()],
            [
                self.arrived_track(
                    track_id="track-31",
                    features={
                        "face_embedding": [0.0, 1.0, 0.0],
                        "torso_histogram": [0.0, 0.1, 0.9],
                    },
                )
            ],
            scene_cut=self.scene_cut(),
        )

        self.assertEqual(result["summary"]["accepted_count"], 0)
        self.assertEqual(result["summary"]["review_candidate_count"], 1)
        self.assertEqual(result["candidates"][0]["status"], "review_candidate")

    def test_ambiguous_scene_cut_match_requires_review(self):
        result = agent_persistence.cross_scene_persistence_check(
            [self.departed_track()],
            [
                self.arrived_track(track_id="track-12"),
                self.arrived_track(
                    track_id="track-13",
                    features={
                        "face_embedding": [0.87, 0.13, 0.0],
                        "torso_histogram": [0.77, 0.23, 0.0],
                    },
                ),
            ],
            scene_cut=self.scene_cut(),
            ambiguity_margin=0.05,
        )

        self.assertEqual(result["summary"]["accepted_count"], 0)
        self.assertGreaterEqual(result["summary"]["review_candidate_count"], 2)
        self.assertTrue(
            result["governance"]["ambiguous_matches_require_review"]
        )

    def test_manager_selects_only_tracks_near_confirmed_cut(self):
        manager = agent_persistence_manager.AgentPersistenceManager(window_seconds=1.5)
        tracks = [
            self.departed_track(track_id="departed-near", end=9.2),
            self.departed_track(track_id="departed-far", end=7.0),
            self.arrived_track(track_id="arrived-near", start=10.4),
            self.arrived_track(track_id="arrived-far", start=12.5),
        ]

        grouped = manager.tracks_near_scene_cut(tracks, self.scene_cut())

        self.assertEqual([track["track_id"] for track in grouped["departed"]], ["departed-near"])
        self.assertEqual([track["track_id"] for track in grouped["arrived"]], ["arrived-near"])

    def test_agent_persistence_exports_second_order_feature_event(self):
        result = agent_persistence.cross_scene_persistence_check(
            [self.departed_track()],
            [self.arrived_track()],
            scene_cut=self.scene_cut(),
        )

        event = agent_persistence.build_agent_persistence_feature_event(
            "analysis-1",
            result["matches"][0],
        )

        self.assertEqual(event["feature_type"], "agent_persistence_scene_cut")
        self.assertEqual(
            event["proliferation_support"]["candidate_target_labels"],
            ["Identification"],
        )
        self.assertEqual(
            event["proliferation_support"]["may_surface_as"],
            "candidate_agent_profile",
        )
        self.assertEqual(
            event["evidence_refs"][0]["evidence_kind"],
            "agent_persistence_scene_cut",
        )


if __name__ == "__main__":
    unittest.main()
