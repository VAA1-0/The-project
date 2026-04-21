import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load_identity_refinery_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/identification_refinery.py"
    )
    spec = importlib.util.spec_from_file_location("identification_refinery", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


identity_refinery = load_identity_refinery_module()


class IdentityRefineryContractTest(unittest.TestCase):
    def test_refinery_writes_candidate_ledger_without_mutating_master(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            master_path = tmp_path / "vaa1_annotation_master_schema.json"
            output_path = tmp_path / "identity_refinement_candidates.json"
            master_payload = {
                "track_annotations": [
                    {
                        "track_id": "42",
                        "label": "Person",
                        "label_mapping": {"mapped_label": "person"},
                        "time_start": 1.0,
                        "time_end": 2.0,
                    }
                ],
                "object_annotations": [
                    {
                        "annotation_id": "obj-1",
                        "label": "Car",
                        "label_mapping": {"mapped_label": "vehicle"},
                    }
                ],
            }
            master_path.write_text(
                json.dumps(master_payload, indent=2),
                encoding="utf-8",
            )

            result = identity_refinery.refine_identities(
                "analysis-1",
                master_json_path=master_path,
                output_json_path=output_path,
            )

            self.assertEqual(result["status"], "success")
            self.assertEqual(result["candidate_count"], 1)
            self.assertTrue(output_path.exists())

            persisted_master = json.loads(master_path.read_text(encoding="utf-8"))
            self.assertNotIn(
                "identity_affirmation",
                persisted_master["track_annotations"][0],
            )

            ledger = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(ledger["status"], "candidate_review_required")
            self.assertEqual(ledger["candidate_count"], 1)
            self.assertEqual(ledger["candidates"][0]["identity_status"], "candidate")
            self.assertEqual(ledger["candidates"][0]["review_state"], "unreviewed")
            self.assertEqual(
                ledger["audio_stack_plan"]["diarization"],
                "pyannote.audio",
            )

    def test_default_paths_use_api_results_layout(self):
        expected = (
            identity_refinery.RESULTS_DIR
            / "analysis-1"
            / "vaa1_annotation_master_schema.json"
        )
        self.assertEqual(
            identity_refinery.get_master_schema_path("analysis-1"),
            expected,
        )

    def test_promote_candidate_updates_master_and_ledger(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            master_path = tmp_path / "vaa1_annotation_master_schema.json"
            ledger_path = tmp_path / "identity_refinement_candidates.json"
            master_path.write_text(
                json.dumps(
                    {
                        "track_annotations": [
                            {
                                "track_id": "42",
                                "label": "Person",
                                "label_mapping": {"mapped_label": "person"},
                            }
                        ],
                        "object_annotations": [],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )

            identity_refinery.refine_identities(
                "analysis-1",
                master_json_path=master_path,
                output_json_path=ledger_path,
            )
            result = identity_refinery.promote_identity_candidate(
                "analysis-1",
                candidate_id="track_42",
                identity_label="Ada Analyst",
                master_json_path=master_path,
                output_json_path=ledger_path,
                promoted_at="2026-04-20T12:00:00Z",
            )

            self.assertEqual(result["status"], "success")
            master = json.loads(master_path.read_text(encoding="utf-8"))
            self.assertEqual(
                master["track_annotations"][0]["identity_affirmation"],
                "Ada Analyst",
            )
            self.assertEqual(
                master["track_annotations"][0]["attributes"]["identity_status"],
                "confirmed",
            )
            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            self.assertEqual(ledger["candidates"][0]["review_state"], "promoted")
            self.assertEqual(
                ledger["candidates"][0]["promoted_identity"],
                "Ada Analyst",
            )


if __name__ == "__main__":
    unittest.main()
