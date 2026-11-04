import importlib.util
import unittest
from pathlib import Path


module_path = Path(__file__).resolve().parents[1] / "src/backend/analysis/constellational_cluster_exploration.py"
spec = importlib.util.spec_from_file_location("constellational_cluster_exploration", module_path)
cluster_exploration = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(cluster_exploration)
explore_constellational_clusters = cluster_exploration.explore_constellational_clusters


class ConstellationalClusterExplorationTest(unittest.TestCase):
    def test_backend_exposes_bounded_non_writing_preview_route(self):
        api_source = (Path(__file__).resolve().parents[1] / "api_server.py").read_text(encoding="utf-8")
        self.assertIn('/api/analysis/{analysis_id}/clusters/explore', api_source)
        self.assertIn('"write_effect"] = "none_preview_only"', api_source)
        self.assertIn('"CLUSTER_PREVIEW_TOO_LARGE"', api_source)

    def test_quality_cosine_ranking_and_representatives_are_governed(self):
        result = explore_constellational_clusters(
            [
                {"id": "a", "vector": [1, 0], "quality": 1, "size": 4, "source_ref": "frame:a", "modality": "visual", "cluster_family": "face", "thumbnail_ref": "crop:a.jpg"},
                {"id": "b", "vector": [0.98, 0.1], "quality": 0.8, "size": 3, "source_ref": "turn:b"},
                {"id": "c", "vector": [0, 1], "quality": 0.9, "size": 2, "source_ref": "turn:c"},
                {"id": "bad", "vector": [1, 0], "quality": 0.1, "size": 4},
            ],
            cosine_distance_threshold=0.15,
            minimum_quality=0.5,
            minimum_size=1,
        )
        self.assertEqual(result["schema"], "vaa1.constellational_cluster_exploration.v1")
        self.assertEqual(result["datascene_regime"], "Mature Data Proliferation")
        self.assertEqual(result["canonical_decision_sink"], "proliferation_decisions")
        self.assertIn("audio_sample_clouds", result["canonical_inputs"])
        self.assertEqual(result["authority"], "candidate_only_until_human_confirmation")
        self.assertEqual(result["counts"], {"input": 4, "accepted": 3, "rejected": 1, "clusters": 2})
        paired = next(cluster for cluster in result["clusters"] if cluster["member_count"] == 2)
        self.assertEqual(paired["representative_sample_id"], "a")
        self.assertEqual(paired["boundary_sample_id"], "b")
        self.assertGreater(paired["cohesion"], 0.9)
        self.assertEqual(paired["semantic_purity"], 0.5)
        self.assertEqual(paired["source_time_coverage"]["source_linked"], 2)
        self.assertIsNotNone(paired["nearest_competing_cluster_id"])
        self.assertIsNotNone(paired["nearest_competing_distance"])
        self.assertEqual([row["sample_id"] for row in paired["members"]], ["a", "b"])
        representative = paired["members"][0]
        self.assertEqual(representative["cluster_family"], "face")
        self.assertEqual(representative["preview_ref"], "crop:a.jpg")
        self.assertEqual(representative["preview_kind"], "thumbnail")
        self.assertTrue(result["preview_contract"]["source_linked_only"])
        self.assertIn("visual_concept", result["cluster_families"])
        self.assertIn("set_location_environment_recognition", result["cluster_families"])
        self.assertEqual(
            result["visual_concept_authority_ladder"][0],
            "measured_visual_features",
        )
        self.assertEqual(
            result["visual_concept_authority_ladder"][-1],
            "interpretive_relation",
        )
        taxonomy = result["detection_cluster_taxonomy"]
        self.assertEqual(set(taxonomy), {"visual", "audio", "textual"})
        self.assertIn("object_and_object_track", taxonomy["visual"]["families"])
        self.assertIn("audio_sample_and_sample_cloud", taxonomy["audio"]["families"])
        self.assertIn("transcript_segment_and_word", taxonomy["textual"]["families"])
        self.assertIn("ocr_region", taxonomy["visual"]["families"])
        self.assertIn("ocr_text", taxonomy["textual"]["families"])
        self.assertIn("symbolic_meaning", result["interpretive_cluster_families_deferred"])
        self.assertEqual(result["rejected_samples"][0]["reasons"], ["below_minimum_quality", "missing_source_ref"])

    def test_human_adjustment_is_append_only_and_does_not_auto_promote(self):
        initial = explore_constellational_clusters([
            {"id": "a", "embedding": [1, 0], "quality": 1, "size": 1, "source_ref": "frame:a"},
            {"id": "b", "embedding": [1, 0.05], "quality": 0.8, "size": 1, "source_ref": "frame:b"},
        ])
        cluster_id = initial["clusters"][0]["cluster_id"]
        adjusted = explore_constellational_clusters(
            [
                {"id": "a", "embedding": [1, 0], "quality": 1, "size": 1, "source_ref": "frame:a"},
                {"id": "b", "embedding": [1, 0.05], "quality": 0.8, "size": 1, "source_ref": "frame:b"},
            ],
            adjustments=[
                {"action": "set_representative", "cluster_id": cluster_id, "sample_id": "b", "analyst": "test"},
                {"action": "confirm", "cluster_id": cluster_id, "analyst": "test"},
            ],
        )
        self.assertEqual(adjusted["clusters"][0]["representative_sample_id"], "b")
        self.assertEqual(adjusted["clusters"][0]["review_state"], "confirm")
        self.assertTrue(all(row["applied"] for row in adjusted["human_adjustments"]))
        self.assertEqual(adjusted["authority"], "candidate_only_until_human_confirmation")


if __name__ == "__main__":
    unittest.main()
