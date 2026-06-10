import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load_bus_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/live_mature_data_proliferation_bus.py"
    )
    spec = importlib.util.spec_from_file_location(
        "live_mature_data_proliferation_bus",
        module_path,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


bus = load_bus_module()


class LiveMatureDataProliferationBusTests(unittest.TestCase):
    def test_bus_surfaces_later_opportunities_without_promoting_them(self):
        status = {
            "analysis_id": "analysis-live-bus",
            "saved_analysis_hydration_audit": {
                "hydrated": ["annotation_corrections", "results.visual_analysis.tracked_objects"]
            },
            "annotation_corrections": {
                "manual_visual_annotations": [
                    {
                        "id": "manual-presenter-1",
                        "category": "Identification",
                        "subcategory": "Character",
                        "label": "Presenter",
                        "identity_affirmation": "Presenter",
                        "start_seconds": 0.0,
                        "end_seconds": 2.0,
                        "teaches_regime": True,
                    }
                ],
                "proliferation_decisions": [],
            },
            "source_samples": [
                {
                    "sample_id": "presenter-av-sample-1",
                    "sample_type": "visual_audio",
                    "label": "Presenter source sample",
                    "time_start": 0.0,
                    "time_end": 2.0,
                    "visual": {"path": "presenter_crop.jpg"},
                    "audio": {"path": "presenter_voice.wav"},
                }
            ],
            "results": {
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": "early-person",
                            "class_name": "person",
                            "label": "person",
                            "start": 0.25,
                            "end": 0.75,
                            "confidence": 0.91,
                        },
                        {
                            "track_id": "later-person",
                            "class_name": "person",
                            "label": "person",
                            "start": 22.0,
                            "end": 25.0,
                            "confidence": 0.88,
                        },
                    ]
                }
            },
        }

        audit = bus.build_live_mature_data_proliferation_audit(status)

        self.assertEqual(
            audit["schema"],
            "vaa1.live_mature_data_proliferation_audit.v1",
        )
        self.assertEqual(audit["status"], "audit_ready")
        self.assertTrue(audit["authority_policy"]["candidate_is_not_promotion"])
        self.assertTrue(
            audit["authority_policy"]["promotion_requires_decision_ledger_entry"]
        )
        self.assertEqual(audit["summary"]["manual_seed_count"], 1)
        self.assertEqual(audit["summary"]["source_sample_seed_count"], 1)
        self.assertGreaterEqual(audit["summary"]["candidate_opportunity_count"], 1)
        self.assertEqual(
            audit["summary"]["candidate_opportunity_count"],
            audit["summary"]["blocked_promotion_count"],
        )
        self.assertTrue(
            all(
                opportunity["candidate_is_not_promotion"]
                for opportunity in audit["candidate_opportunities"]
            )
        )
        self.assertTrue(
            all(
                blocked["reason"] == "promotion_decision_required"
                for blocked in audit["blocked_promotions"]
            )
        )
        self.assertEqual(audit["next_required_stage"], "P2_PROMOTION_LEDGER")
        self.assertEqual(status["annotation_corrections"]["proliferation_decisions"], [])

    def test_bus_writes_audit_json_without_mutating_existing_decisions(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "live_bus.json"
            status = {
                "analysis_id": "analysis-write-live-bus",
                "annotation_corrections": {
                    "manual_visual_annotations": [
                        {
                            "id": "manual-bond-1",
                            "category": "Identification",
                            "label": "James Bond",
                            "start_seconds": 1.0,
                            "end_seconds": 2.0,
                        }
                    ],
                    "proliferation_decisions": [
                        {
                            "id": "decision-existing-1",
                            "decision": "deferred",
                            "label": "James Bond",
                        }
                    ],
                },
                "results": {
                    "visual_analysis": {
                        "tracked_objects": [
                            {
                                "track_id": "late-person",
                                "class_name": "person",
                                "label": "person",
                                "start": 10.0,
                                "end": 12.0,
                            }
                        ]
                    }
                },
            }

            before_decisions = list(status["annotation_corrections"]["proliferation_decisions"])
            audit = bus.write_live_mature_data_proliferation_audit(status, output_path)
            disk_payload = json.loads(output_path.read_text(encoding="utf-8"))

            self.assertTrue(output_path.exists())
            self.assertEqual(disk_payload["schema"], audit["schema"])
            self.assertEqual(
                status["annotation_corrections"]["proliferation_decisions"],
                before_decisions,
            )
            self.assertEqual(audit["summary"]["promotion_decision_count"], 1)
            self.assertGreaterEqual(audit["summary"]["candidate_opportunity_count"], 1)


if __name__ == "__main__":
    unittest.main()
