import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


def load_starters_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/ai_agent_feature_starters.py"
    )
    spec = importlib.util.spec_from_file_location("ai_agent_feature_starters", module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


starters = load_starters_module()


class AiAgentFeatureStartersContractTest(unittest.TestCase):
    def test_manifest_covers_report_feature_families_and_license_governance(self):
        manifest = starters.build_feature_starter_manifest()

        self.assertEqual(manifest["schema"], "vaa1.ai_agent_feature_starters.v1")
        self.assertTrue(manifest["governance"]["no_hidden_network_calls"])
        self.assertTrue(manifest["governance"]["strong_copyleft_is_isolated_or_avoided"])

        feature_ids = {feature["feature_id"] for feature in manifest["features"]}
        self.assertEqual(
            feature_ids,
            {
                "metadata_harvesting",
                "webpage_comparison",
                "llm_gateway_rag",
                "report_writer",
                "audio_command_interface",
                "native_learning_engine",
            },
        )

        isolated = [
            candidate
            for feature in manifest["features"]
            for candidate in feature["candidates"]
            if candidate["license_policy"] == "isolate_or_avoid"
        ]
        review_required = [
            candidate
            for feature in manifest["features"]
            for candidate in feature["candidates"]
            if candidate["license_policy"] == "review_required"
        ]
        self.assertTrue(isolated)
        self.assertTrue(all(not candidate["core_compatible"] for candidate in isolated))
        self.assertTrue(any(candidate["name"].startswith("IMDb") for candidate in review_required))

    def test_manifest_can_be_written_as_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feature_starters.json"
            manifest = starters.write_feature_starter_manifest(output_path)

            self.assertTrue(output_path.exists())
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["schema"], manifest["schema"])

    def test_metadata_seed_builds_oai_pmh_request_without_fetching(self):
        seed = starters.build_metadata_harvest_seed(
            source_type="oai_pmh",
            base_url="https://archive.example/oai",
            set_spec="moving_images",
        )

        self.assertEqual(seed["schema"], "vaa1.metadata_harvest_seed.v1")
        self.assertIn("verb=ListRecords", seed["request_url"])
        self.assertIn("set=moving_images", seed["request_url"])
        self.assertEqual(seed["network_status"], "not_fetched")

    def test_metadata_seed_builds_imdb_lookup_without_fetching(self):
        seed = starters.build_metadata_harvest_seed(
            source_type="imdb",
            base_url="https://www.imdb.com/find/",
            query="Galaxy Song",
        )

        self.assertEqual(seed["schema"], "vaa1.metadata_harvest_seed.v1")
        self.assertIn("q=Galaxy+Song", seed["request_url"])
        self.assertEqual(seed["source_type"], "imdb")
        self.assertEqual(seed["network_status"], "not_fetched")

    def test_webpage_snapshot_diff_reports_text_link_and_tag_changes(self):
        left = starters.build_webpage_snapshot_record(
            url="https://example.test/a",
            html="<main><h1>Old title</h1><a href='/old'>Old</a></main>",
            captured_at="2026-05-09T10:00:00+00:00",
        )
        right = starters.build_webpage_snapshot_record(
            url="https://example.test/a",
            html="<main><h1>New title</h1><p>Extra</p><a href='/new'>New</a></main>",
            captured_at="2026-05-09T11:00:00+00:00",
        )

        diff = starters.compare_webpage_snapshots(left, right)

        self.assertEqual(diff["schema"], "vaa1.webpage_snapshot_diff.v1")
        self.assertIn("/new", diff["link_changes"]["added"])
        self.assertIn("/old", diff["link_changes"]["removed"])
        self.assertEqual(diff["tag_delta"]["p"], 1)
        self.assertTrue(any("New title" in line for line in diff["text_diff"]))

    def test_llm_request_is_prepared_not_sent_and_keeps_annotation_governance(self):
        request = starters.build_llm_annotation_request(
            analysis_id="analysis-1",
            task="summarize_scene_card",
            evidence_refs=[{"evidence_id": "scene-card:1", "time": "0:00-0:45"}],
        )

        self.assertEqual(request["execution_status"], "prepared_not_sent")
        self.assertTrue(request["governance"]["requires_explicit_operator_enablement"])
        self.assertTrue(request["governance"]["llm_output_is_annotation_not_detection_truth"])
        self.assertEqual(request["evidence_refs"][0]["evidence_id"], "scene-card:1")

    def test_report_renderer_keeps_evidence_references_visible(self):
        report = starters.render_report_markdown(
            title="Mise-en-Scene Report",
            sections=[{"heading": "Scene 1", "body": "People speak near a title card."}],
            evidence_refs=[{"evidence_id": "transcript:1", "target": "t=0.0,1.0"}],
        )

        self.assertIn("# Mise-en-Scene Report", report)
        self.assertIn("## Evidence References", report)
        self.assertIn("transcript:1", report)

    def test_audio_command_router_returns_safe_intents(self):
        self.assertEqual(starters.route_audio_command("pause")["action"], "video.pause")
        self.assertEqual(starters.route_audio_command("open scene card")["payload"]["panel"], "SceneCards")
        self.assertEqual(starters.route_audio_command("nudge back")["payload"]["seconds"], -1.0)
        self.assertEqual(starters.route_audio_command("unknown phrase")["review_state"], "needs_review")

    def test_learning_feedback_event_is_append_only_and_pattern_eligible(self):
        event = starters.build_learning_feedback_event(
            analysis_id="analysis-1",
            evidence_id="object:22",
            analyst_action="correct",
            label="microphone",
        )

        self.assertEqual(event["schema"], "vaa1.learning_feedback_event.v1")
        self.assertTrue(event["governance"]["append_only"])
        self.assertTrue(event["governance"]["does_not_mutate_raw_detection"])
        self.assertTrue(event["governance"]["eligible_for_pattern_accumulation"])

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "feedback.jsonl"
            starters.write_learning_feedback_event(path, event)
            self.assertEqual(len(path.read_text(encoding="utf-8").splitlines()), 1)


if __name__ == "__main__":
    unittest.main()
