import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


def load_dependency_sfl_stage1_module():
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    module_path = repo_root / "src/backend/analysis/dependency_sfl_stage1.py"
    spec = importlib.util.spec_from_file_location("dependency_sfl_stage1", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


dependency_sfl_stage1 = load_dependency_sfl_stage1_module()


class DependencySFLStage1ContractTest(unittest.TestCase):
    def test_build_artifact_preserves_traceability_and_authority_policy(self):
        artifact = dependency_sfl_stage1.build_dependency_sfl_stage1_artifact(
            "analysis-1",
            {
                "language": "en",
                "segments": [
                    {
                        "id": "utt-1",
                        "start": 10.0,
                        "end": 12.0,
                        "speaker": "SPEAKER_01",
                        "text": "You must listen to me.",
                        "source_evidence_ids": ["transcript:1"],
                    }
                ],
            },
            source_media_id="media-1",
            model_name="__missing_model__",
        )

        self.assertEqual(artifact["schema"], "vaa1.dependency_sfl_stage1.v1")
        self.assertEqual(artifact["source_media_id"], "media-1")
        self.assertIn(
            artifact["runtime_status"],
            {"model_unavailable", "fallback_completed", "dependency_missing"},
        )
        self.assertTrue(artifact["authority_policy"]["manual_annotation_wins"])
        self.assertTrue(artifact["authority_policy"]["parser_outputs_do_not_override_manual"])

        utterance = artifact["utterances"][0]
        self.assertEqual(utterance["utterance_id"], "utt-1")
        self.assertEqual(utterance["source_evidence_ids"], ["transcript:1"])
        self.assertEqual(utterance["time_interval"], {"start_ms": 10000, "end_ms": 12000})
        self.assertGreater(len(utterance["token_trace"]), 0)
        self.assertEqual(utterance["token_trace"][0]["utterance_id"], "utt-1")
        self.assertTrue(utterance["traceback"]["traceback_required"])
        self.assertEqual(
            utterance["interpretation_support"]["epistemic_status"],
            "parser_supported_candidate",
        )
        self.assertFalse(utterance["interpretation_support"]["may_auto_confirm"])

    def test_candidate_labels_support_proliferation_without_confirmation(self):
        artifact = dependency_sfl_stage1.build_dependency_sfl_stage1_artifact(
            "analysis-2",
            [
                {
                    "id": "utt-2",
                    "start_ms": 2000,
                    "end_ms": 3500,
                    "text": "Go now.",
                    "source_evidence_ids": ["transcript:2"],
                }
            ],
            source_media_id="media-1",
            model_name="__missing_model__",
        )

        candidates = artifact["utterances"][0]["interpretation_support"]["candidate_labels"]
        self.assertTrue(candidates)
        self.assertTrue(all(candidate["review_state"] == "candidate" for candidate in candidates))
        self.assertIn("Interaction", artifact["summary"]["candidate_label_families"])
        self.assertTrue(artifact["utterances"][0]["interpretation_support"]["may_proliferate"])
        self.assertFalse(artifact["utterances"][0]["interpretation_support"]["may_auto_confirm"])

    def test_token_trace_has_stable_ids_offsets_and_estimated_time(self):
        artifact = dependency_sfl_stage1.build_dependency_sfl_stage1_artifact(
            "analysis-3",
            {"text": "Bond says no.", "start_ms": 5000, "end_ms": 6000},
            source_media_id="media-1",
            model_name="__missing_model__",
        )

        trace = artifact["utterances"][0]["token_trace"]
        self.assertEqual(trace[0]["token_id"], "analysis-3:utt:0:tok:0")
        self.assertGreaterEqual(trace[0]["char_start"], 0)
        self.assertGreater(trace[0]["char_end"], trace[0]["char_start"])
        self.assertGreaterEqual(trace[0]["estimated_time_ms"], 5000)
        self.assertLessEqual(trace[-1]["estimated_time_ms"], 6000)

    def test_write_artifact_persists_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "dependency_sfl_stage1.json"
            artifact = dependency_sfl_stage1.write_dependency_sfl_stage1_artifact(
                "analysis-4",
                {"text": "Maybe he will return.", "start": 1.0, "end": 2.0},
                output_path,
                source_media_id="media-1",
                model_name="__missing_model__",
            )

            self.assertTrue(output_path.exists())
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["schema"], artifact["schema"])
            self.assertEqual(persisted["analysis_id"], "analysis-4")


if __name__ == "__main__":
    unittest.main()
