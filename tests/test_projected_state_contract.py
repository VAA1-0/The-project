import json
import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "src" / "backend" / "analysis" / "projected_state.py"
SPEC = importlib.util.spec_from_file_location("vaa1_projected_state", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
project_subject_state = MODULE.project_subject_state
project_subject_states = MODULE.project_subject_states


class ProjectedStateContractTests(unittest.TestCase):
    def setUp(self):
        self.raw = [{
            "track_id": "track-1", "timestamp": "2.0", "start_timestamp": "2.0",
            "end_timestamp": "2.0", "class_name": "person",
            "bbox_x1": "10", "bbox_y1": "20", "bbox_x2": "30", "bbox_y2": "50",
        }]
        self.manual = {
            "manual_visual_annotations": [{
                "id": "manual-1", "label": "James Bond", "identity_affirmation": "James Bond",
                "timestamp_seconds": 1.5, "start_seconds": 1.5, "end_seconds": 3.0,
                "coordinates": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4},
                "updated_at": "2026-07-14T10:00:00Z",
                "metadata_correlation": {
                    "target_type": "object", "target_id": "track-1",
                    "authority_state": "manual_correction", "maturity_state": "manual_correction"
                },
            }]
        }

    def test_manual_correction_projects_over_raw_without_mutation(self):
        raw_before = json.loads(json.dumps(self.raw))
        result = project_subject_state(
            analysis_id="analysis-1", subject_ref="track-1", timestamp=2.0,
            tracked_objects=self.raw, corrections=self.manual,
        )
        self.assertEqual(result["raw_value"], "person")
        self.assertEqual(result["projected_value"], "James Bond")
        self.assertEqual(result["authority"], "manual_correction")
        self.assertEqual(result["validity"], "current")
        self.assertEqual(result["correction_refs"], ["manual-1"])
        self.assertEqual(self.raw, raw_before)

    def test_out_of_scope_correction_does_not_override_raw(self):
        result = project_subject_state(
            analysis_id="analysis-1", subject_ref="track-1", timestamp=8.0,
            tracked_objects=self.raw, corrections=self.manual,
        )
        self.assertEqual(result["projected_value"], "person")
        self.assertEqual(result["authority"], "raw_detection")

    def test_current_canonical_decision_projects_over_legacy_correction(self):
        decisions = [{
            "decision_id": "decision-1",
            "subject_ref": {"type": "visual_track_or_observation", "id": "track-1"},
            "property": "label", "value": "M", "authority": "explicit_user_correction",
            "maturity": "analyst_confirmed", "validity": "current",
            "projection_status": "active", "created_at": "2026-07-14T11:00:00Z",
            "scope": {"start_seconds": 1.0, "end_seconds": 3.0},
            "evidence_refs": ["track-1"], "correction_refs": ["manual-2"],
            "supersedes": [],
        }]
        result = project_subject_state(
            analysis_id="analysis-1", subject_ref="track-1", timestamp=2.0,
            tracked_objects=self.raw, corrections=self.manual, decisions=decisions,
        )
        self.assertEqual(result["projected_value"], "M")
        self.assertEqual(result["source_kind"], "canonical_decision")
        self.assertEqual(result["decision_refs"], ["decision-1"])

    def test_invalidation_suppresses_canonical_and_linked_legacy_assignment(self):
        decisions = [{
            "decision_id": "decision-1",
            "subject_ref": {"type": "visual_track_or_observation", "id": "track-1"},
            "property": "label", "value": "James Bond", "validity": "current",
            "projection_status": "active", "created_at": "2026-07-14T11:00:00Z",
            "scope": {"start_seconds": 1.0, "end_seconds": 3.0},
            "correction_refs": ["manual-1"], "supersedes": [],
        }, {
            "decision_id": "invalidate-1", "decision_action": "invalidate",
            "target_decision_refs": ["decision-1"], "created_at": "2026-07-14T12:00:00Z",
        }]
        result = project_subject_state(
            analysis_id="analysis-1", subject_ref="track-1", timestamp=2.0,
            tracked_objects=self.raw, corrections=self.manual, decisions=decisions,
        )
        self.assertEqual(result["projected_value"], "person")
        self.assertEqual(result["source_kind"], "tracked_object")
        self.assertEqual(result["invalidated_decision_refs"], ["decision-1"])
        self.assertEqual(result["indication"]["tone"], "quiet")
        self.assertEqual(result["indication"]["code"], "reviewed_assignment_no_longer_current")

    def test_missing_state_uses_quiet_operational_indication(self):
        result = project_subject_state(
            analysis_id="analysis-1", subject_ref="missing", timestamp=1.0,
            tracked_objects=self.raw, corrections=self.manual,
        )
        self.assertIsNone(result["projected_value"])
        self.assertEqual(result["projection_status"], "unavailable")
        self.assertEqual(result["indication"]["tone"], "quiet")
        self.assertNotIn("!", result["indication"]["message"])

    def test_schema_contract_is_present(self):
        path = Path(__file__).resolve().parents[1] / "docs" / "schemas" / "vaa1.projected_subject_state.compatibility.schema.json"
        schema = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(schema["properties"]["schema"]["const"], "vaa1.projected_subject_state.v0.compatibility")
        self.assertEqual(schema["properties"]["indication"]["properties"]["tone"]["const"], "quiet")

    def test_batch_projection_matches_single_projection(self):
        single = project_subject_state(
            analysis_id="analysis-1", subject_ref="track-1", timestamp=2.0,
            tracked_objects=self.raw, corrections=self.manual,
        )
        batch = project_subject_states(
            analysis_id="analysis-1",
            requests=[{"subject_ref": "track-1", "timestamp": 2.0}],
            tracked_objects=self.raw,
            corrections=self.manual,
        )
        self.assertEqual(batch["projection_count"], 1)
        self.assertEqual(batch["projections"], [single])

    def test_frontend_authority_parity_fixtures(self):
        fixture_path = Path(__file__).resolve().parent / "fixtures" / "projected_state_parity.json"
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
        for case in fixture["cases"]:
            with self.subTest(case=case["name"]):
                result = project_subject_state(
                    analysis_id="parity-fixture",
                    subject_ref=case["subject_ref"],
                    timestamp=case["timestamp"],
                    tracked_objects=case["tracked_objects"],
                    corrections={"manual_visual_annotations": case["manual_visual_annotations"]},
                )
                for key, expected in case["expected"].items():
                    self.assertEqual(result[key], expected)


if __name__ == "__main__":
    unittest.main()
