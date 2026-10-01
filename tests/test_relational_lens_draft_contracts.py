"""Offline contracts only: no application startup or production data writes."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "docs/schemas/relational_lenses"
spec = importlib.util.spec_from_file_location("lens_validator", ROOT / "scripts/validate_relational_lens_record.py")
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class RelationalLensContracts(unittest.TestCase):
    def setUp(self):
        self.examples = {
            p.name.removesuffix(".candidate.json"): json.loads(p.read_text())
            for p in (BASE / "examples").glob("*.candidate.json")
        }
        self.assertEqual(len(self.examples), 3)

    def check_mutation(self, change, *, valid=False):
        for name, original in self.examples.items():
            with self.subTest(lens=name):
                record = copy.deepcopy(original)
                change(record)
                errors = validator.validate_record(record)
                self.assertEqual(not errors, valid, errors)

    def test_schema_meta_validation_and_local_refs(self):
        for path in (BASE / "1.1.0").glob("*.schema.json"):
            schema = json.loads(path.read_text())
            Draft202012Validator.check_schema(schema)
            def walk(value):
                if isinstance(value, dict):
                    if "$ref" in value:
                        self.assertTrue(value["$ref"].startswith("#/$defs/"))
                        self.assertIn(value["$ref"].split("/")[-1], schema["$defs"])
                    for child in value.values(): walk(child)
                elif isinstance(value, list):
                    for child in value: walk(child)
            walk(schema)

    def test_generated_files_have_no_drift(self):
        subprocess.run([sys.executable, str(ROOT / "scripts/build_relational_lens_schemas.py"), "--check"], check=True)

    def test_originals_match_assessed_hashes(self):
        results = json.loads((BASE / "1.0.0/input_hashes.json").read_text())
        for name, result in results.items():
            self.assertEqual(hashlib.sha256((BASE / "1.0.0" / f"{name}.schema.json").read_bytes()).hexdigest(), result["sha256"])

    def test_candidates_without_analyst_decisions_are_valid(self):
        self.check_mutation(lambda record: None, valid=True)
        for record in self.examples.values():
            self.assertNotIn("ledger_event_id", record["governance"])

    def test_unknown_fields_fail(self):
        self.check_mutation(lambda r: r.update(accidental_field=True))

    def test_malformed_envelopes_fail_without_crashing(self):
        for value in [None, [], {}, {"framework": None}, {"framework": {"framework_id": []}}]:
            self.assertTrue(validator.validate_record(value))

    def test_nonfinite_times_fail(self):
        self.check_mutation(lambda r: r["source_anchors"][0].update(time_start=float("nan")))

    def test_non_temporal_compatibility_times_cannot_be_invented(self):
        self.check_mutation(lambda r: r["source_anchors"][0].update(anchor_type="document_span"))

    def test_opaque_producer_configuration_is_not_a_reference(self):
        self.check_mutation(lambda r: r["governance"].update(parameters={"participant_id": "producer-specific-option"}), valid=True)

    def test_missing_anchor_identity_fails(self):
        self.check_mutation(lambda r: r["source_anchors"][0].pop("anchor_id"))

    def test_unresolved_evidence_fails(self):
        self.check_mutation(lambda r: r["interpretive_summary"].update(evidence_anchor_ids=["missing"]))

    def test_duplicate_anchor_identity_fails_even_if_content_differs(self):
        self.check_mutation(lambda r: r["source_anchors"].append({**r["source_anchors"][0], "time_start": 0}))

    def test_reversed_interval_fails(self):
        self.check_mutation(lambda r: r["source_anchors"][0].update(time_start=3, time_end=1))

    def test_normalized_coordinate_and_extent_fail(self):
        for box in [{"x": 2, "y": 0, "width": .2, "height": .2}, {"x": .8, "y": 0, "width": .3, "height": .2}]:
            self.check_mutation(lambda r: r["source_anchors"][0].update(spatial_region={"coordinate_system": "normalized_0_1", **box}))

    def test_invalid_date_fails(self):
        self.check_mutation(lambda r: r["governance"].update(created_at="yesterday"))

    def test_missing_automated_producer_fails(self):
        self.check_mutation(lambda r: r["governance"].pop("provider"))

    def test_automated_confirmation_fails(self):
        self.check_mutation(lambda r: r["governance"].update(record_status="confirmed", ledger_event_id="not-proof"))

    def test_claim_cannot_self_confirm_inside_candidate(self):
        self.check_mutation(lambda r: r["interpretive_summary"].update(epistemic_level="confirmed_interpretation"))

    def test_declared_confirmation_requires_decision_reference(self):
        self.check_mutation(lambda r: r["governance"].update(record_status="confirmed", authority="analyst_confirmed"))

    def test_declared_confirmation_shape_not_authority_verification(self):
        # Offline shape validity deliberately does not attest the external ledger.
        self.check_mutation(lambda r: r["governance"].update(record_status="confirmed", authority="analyst_confirmed", ledger_event_id="external-decision"), valid=True)

    def test_staleness_preserves_prior_confirmation_without_promoting_it(self):
        for state in ["stale", "invalidated", "superseded", "conflicted"]:
            def mutate(record):
                record["governance"].update(record_status=state, authority="analyst_confirmed", ledger_event_id="historical-decision")
                record["interpretive_summary"]["epistemic_level"] = "confirmed_interpretation"
            self.check_mutation(mutate, valid=True)

    def test_framework_specific_safeguards(self):
        mutations = {
            "latourian_association_dynamics": [
                lambda r: r.pop("participants"),
                lambda r: r["associations"][0].update(to_participant_id="unknown"),
                lambda r: r.update(stabilization={"state": "black_boxed", "assessment": "Unsupported"}),
                lambda r: r.update(stabilization={"state": "black_boxed", "assessment": "Unsupported", "supporting_association_ids": ["missing"]}),
            ],
            "morenoan_relational_configuration": [
                lambda r: r.pop("ethics"),
                lambda r: r["ethics"].update(clinical_inference_prohibited=False),
                lambda r: r["ethics"].update(sensitive_relation_controls=["not_applicable", "restricted_access"]),
                lambda r: r.update(sociometric_relations=[]),
                lambda r: r["sociometric_relations"][0].update(strength=.5),
                lambda r: r["sociometric_relations"][0].pop("round_id"),
                lambda r: r["framework"].update(scope="group_relational"),
            ],
            "goffmanian_situated_conduct": [
                lambda r: r["interaction_events"][0].pop("rationale"),
                lambda r: r["interaction_events"][0].update(epistemic_status="confirmed_interpretation"),
                lambda r: r["interaction_events"][0].update(participant_ids=["unknown"]),
            ],
        }
        for name, changes in mutations.items():
            for index, change in enumerate(changes):
                with self.subTest(lens=name, mutation=index):
                    record = copy.deepcopy(self.examples[name])
                    change(record)
                    self.assertTrue(validator.validate_record(record))

    def test_zero_duration_point_and_full_frame_are_valid(self):
        self.check_mutation(lambda r: r["source_anchors"][0].update(time_start=1, time_end=1, spatial_region={"coordinate_system": "normalized_0_1", "x": 0, "y": 0, "width": 1, "height": 1}), valid=True)

    def test_json_round_trip_preserves_candidate(self):
        for record in self.examples.values():
            self.assertEqual(record, json.loads(json.dumps(record)))


if __name__ == "__main__":
    unittest.main()
