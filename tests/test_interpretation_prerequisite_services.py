import json
import sys
import unittest
from pathlib import Path

ANALYSIS_MODULES = Path(__file__).resolve().parents[1] / "src" / "backend" / "analysis"
sys.path.insert(0, str(ANALYSIS_MODULES))

from decision_ledger import empty_decision_ledger
from decision_ledger import append_decision, append_dependency_invalidation
from evidence_quality import assess_evidence_quality, evaluate_quality_use
from execution_graph_planner import load_execution_graph, plan_affected_branches
from source_clock_authority import (
    clock_affected_decision_refs,
    normalize_time_scope,
    overlapping_dependents,
    select_authoritative_time_scope,
)
from source_policy_service import evaluate_source_use
from taxonomy_application_service import apply_taxonomy_term
from vocabulary_service import (
    VocabularyError,
    canonical_term_value,
    load_vocabulary_registry,
    resolve_term,
    validate_vocabulary_registry,
)


class VocabularyServiceTests(unittest.TestCase):
    def test_repository_registry_loads_and_resolves_versioned_term(self):
        registry = load_vocabulary_registry()
        term = resolve_term(registry, "vaa1.validity", "current")
        self.assertEqual(term["vocabulary_version"], "0.1.0")
        self.assertEqual(canonical_term_value(term), "vaa1.validity@0.1.0:current")

    def test_deprecated_term_resolves_without_rewriting_requested_identity(self):
        registry = {
            "vocabularies": [
                {
                    "vocabulary_id": "test.roles",
                    "version": "1.0.0",
                    "terms": [
                        {"term_id": "old", "preferred_label": "Old", "deprecated": True, "replaced_by": "current"},
                        {"term_id": "current", "preferred_label": "Current", "labels": {"fi": "Nykyinen"}},
                    ],
                }
            ]
        }
        validate_vocabulary_registry(registry)
        term = resolve_term(registry, "test.roles", "old", language="fi")
        self.assertEqual(term["requested_term_id"], "old")
        self.assertEqual(term["term_id"], "current")
        self.assertEqual(term["replacement_path"], ["old"])
        self.assertEqual(term["preferred_label"], "Nykyinen")

    def test_registry_rejects_duplicate_term_ids(self):
        with self.assertRaises(VocabularyError):
            validate_vocabulary_registry({"vocabularies": [{"vocabulary_id": "x", "version": "1", "terms": [{"term_id": "a"}, {"term_id": "a"}]}]})


class TaxonomyApplicationServiceTests(unittest.TestCase):
    def test_application_is_an_idempotent_canonical_decision(self):
        registry = load_vocabulary_registry()
        payload = {
            "vocabulary_id": "vaa1.validity",
            "term_id": "current",
            "subject_ref": {"type": "utterance", "id": "utterance:1"},
            "scope": {"start_seconds": 1.0, "end_seconds": 2.0},
            "evidence_refs": ["transcript:row:1"],
            "created_by": "analyst:1",
        }
        ledger, decision, appended = apply_taxonomy_term(
            empty_decision_ledger("analysis:1"), registry, payload, analysis_id="analysis:1"
        )
        self.assertTrue(appended)
        self.assertEqual(decision["property"], "taxonomy.application")
        self.assertEqual(decision["value"], "vaa1.validity@0.1.0:current")
        self.assertEqual(decision["provenance"]["term_ref"]["requested_term_id"], "current")
        ledger, repeated, appended = apply_taxonomy_term(
            ledger, registry, payload, analysis_id="analysis:1"
        )
        self.assertFalse(appended)
        self.assertEqual(repeated["decision_id"], decision["decision_id"])


class SourcePolicyServiceTests(unittest.TestCase):
    def test_local_analysis_remains_available_with_gentle_incomplete_policy_state(self):
        result = evaluate_source_use({}, "local_analysis")
        self.assertTrue(result["allowed"])
        self.assertEqual(result["review_state"], "policy_incomplete")
        self.assertEqual(result["reason_codes"], [])

    def test_external_transfer_requires_explicit_permission(self):
        result = evaluate_source_use({}, "external_provider", provider_id="remote-a")
        self.assertFalse(result["allowed"])
        self.assertIn("purpose_not_explicitly_permitted", result["reason_codes"])

    def test_explicit_restriction_overrides_permitted_purpose(self):
        metadata = {
            "source_policy": {
                "permitted_purposes": ["report_export"],
                "export_restrictions": ["report_export"],
            }
        }
        result = evaluate_source_use(metadata, "report_export")
        self.assertFalse(result["allowed"])
        self.assertIn("purpose_restricted", result["reason_codes"])


class SourceClockAuthorityTests(unittest.TestCase):
    def test_milliseconds_normalize_and_clamp_to_source_duration(self):
        scope = normalize_time_scope(
            {"t_start_ms": 1200, "t_end_ms": 5000, "timing_status": "source_measured"},
            duration_seconds=3.0,
        )
        self.assertEqual(scope["start_seconds"], 1.2)
        self.assertEqual(scope["end_seconds"], 3.0)

    def test_user_correction_outranks_verified_and_degraded_candidates(self):
        selected = select_authoritative_time_scope(
            [
                {"start_seconds": 1, "end_seconds": 2, "timing_status": "degraded", "revision_ref": "d"},
                {"start_seconds": 1.1, "end_seconds": 2.1, "timing_status": "anchor_verified", "revision_ref": "v"},
                {"start_seconds": 1.2, "end_seconds": 2.2, "timing_status": "explicit_user_correction", "revision_ref": "u"},
            ]
        )
        self.assertEqual(selected["revision_ref"], "u")
        self.assertEqual(selected["superseded_time_refs"], ["v", "d"])

    def test_overlap_planner_returns_local_dependents_only(self):
        affected = overlapping_dependents(
            {"start_seconds": 5, "end_seconds": 8, "timing_status": "explicit_user_correction"},
            [
                {"id": "before", "start_seconds": 0, "end_seconds": 4, "timing_status": "inherited"},
                {"id": "inside", "start_seconds": 6, "end_seconds": 7, "timing_status": "inherited"},
                {"id": "after", "start_seconds": 9, "end_seconds": 10, "timing_status": "inherited"},
            ],
        )
        self.assertEqual(affected, ["inside"])

    def test_clock_change_selects_only_active_overlapping_decisions_for_invalidation(self):
        ledger = empty_decision_ledger("analysis:clock")
        for decision_id, start, end in (("inside", 6, 7), ("outside", 12, 14)):
            ledger, _, _ = append_decision(
                ledger,
                {
                    "decision_id": decision_id,
                    "decision_action": "correct_assignment",
                    "subject_ref": {"type": "utterance", "id": decision_id},
                    "property": "taxonomy.application",
                    "scope": {"start_seconds": start, "end_seconds": end},
                    "value": "vaa1.validity@0.1.0:current",
                    "authority": "explicit_user_correction",
                },
                analysis_id="analysis:clock",
            )
        targets = clock_affected_decision_refs(
            ledger,
            {"start_seconds": 5, "end_seconds": 8, "timing_status": "explicit_user_correction"},
        )
        self.assertEqual(targets, ["inside"])
        ledger, event, appended = append_dependency_invalidation(
            ledger,
            {
                "dependency_ref": "source_media.clock",
                "target_decision_refs": targets,
                "validity_effect": "stale",
            },
            analysis_id="analysis:clock",
        )
        self.assertTrue(appended)
        self.assertEqual(event["target_decision_refs"], ["inside"])


class EvidenceQualityBalanceTests(unittest.TestCase):
    def test_assessment_matches_repository_contract_shape(self):
        schema = json.loads(
            (Path(__file__).resolve().parents[1] / "docs" / "schemas" / "vaa1.evidence_quality.v1.schema.json").read_text()
        )
        assessment = assess_evidence_quality({"evidence_ref": "shape:1", "clarity": 0.5})
        self.assertFalse(set(schema["required"]) - set(assessment))
        dimension_contract = schema["properties"]["dimensions"]
        self.assertEqual(set(dimension_contract["required"]), set(assessment["dimensions"]))
        self.assertIn(assessment["fitness_band"], schema["properties"]["fitness_band"]["enum"])

    def test_limited_evidence_stays_visible_and_descriptively_useful(self):
        assessment = assess_evidence_quality(
            {
                "evidence_ref": "audio:weak",
                "dimensions": {
                    "audibility": 0.3,
                    "temporal_precision": 0.45,
                    "completeness": 0.25,
                },
                "confidence": 0.98,
                "maturity": "candidate",
                "authority": "model",
            }
        )
        inspect = evaluate_quality_use(assessment, "inspect")
        descriptive = evaluate_quality_use(assessment, "descriptive_measurement")
        promotion = evaluate_quality_use(assessment, "mature_projection")
        self.assertEqual(inspect["visibility"], "visible")
        self.assertTrue(descriptive["eligible"])
        self.assertIn(descriptive["mode"], {"exploratory", "descriptive_only"})
        self.assertFalse(promotion["eligible"])
        self.assertEqual(promotion["visibility"], "visible")
        self.assertEqual(assessment["confidence"], 0.98)
        self.assertNotEqual(assessment["overall_score"], assessment["confidence"])

    def test_robust_multidimensional_evidence_can_support_promotion(self):
        assessment = assess_evidence_quality(
            {
                "evidence_ref": "scene:strong",
                "dimensions": {name: 0.85 for name in (
                    "clarity",
                    "audibility",
                    "occlusion_control",
                    "temporal_precision",
                    "completeness",
                    "representativeness",
                    "source_independence",
                    "corroboration",
                    "transcription_quality",
                    "assignment_stability",
                )},
            }
        )
        self.assertEqual(assessment["fitness_band"], "robust")
        self.assertTrue(evaluate_quality_use(assessment, "comparative_inference")["eligible"])
        self.assertTrue(evaluate_quality_use(assessment, "verified_report_claim")["eligible"])

    def test_unassessed_quality_does_not_hide_exploratory_results(self):
        assessment = assess_evidence_quality({"evidence_ref": "legacy:1"})
        result = evaluate_quality_use(assessment, "exploratory_analysis")
        self.assertTrue(result["eligible"])
        self.assertEqual(result["visibility"], "visible")
        self.assertIn("quality_unassessed", result["reason_codes"])


class ExecutionGraphPlannerTests(unittest.TestCase):
    def test_source_clock_plan_reaches_evidence_and_reporting_without_unrelated_policy(self):
        plan = plan_affected_branches(load_execution_graph(), ["source_clock_authority"])
        affected = [item["node_id"] for item in plan["affected_nodes"]]
        self.assertIn("shot_scene_adapter", affected)
        self.assertIn("measurement_run_service", affected)
        self.assertIn("report_claim_service", affected)
        self.assertNotIn("source_policy_gate", affected)
        self.assertNotIn("observability_service", affected)
        self.assertIn("source_policy_gate", plan["unaffected_nodes"])

    def test_operational_edges_are_opt_in(self):
        default_plan = plan_affected_branches(load_execution_graph(), ["measurement_run_service"])
        full_plan = plan_affected_branches(
            load_execution_graph(), ["measurement_run_service"], include_operational_edges=True
        )
        default_affected = {item["node_id"] for item in default_plan["affected_nodes"]}
        full_affected = {item["node_id"] for item in full_plan["affected_nodes"]}
        self.assertNotIn("observability_service", default_affected)
        self.assertIn("observability_service", full_affected)
        self.assertIn("maturation_economics_service", full_affected)


if __name__ == "__main__":
    unittest.main()
