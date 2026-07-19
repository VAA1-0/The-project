import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StatsInterpretationProfileContractTests(unittest.TestCase):
    def setUp(self):
        inventory = ROOT / "docs" / "inventory"
        self.profile = json.loads((inventory / "stats_interpretation_profile.json").read_text())
        self.domain_profiles = json.loads((inventory / "domain_atomic_profiles_remaining_17.json").read_text())
        self.execution_graph = json.loads((inventory / "interpretation_execution_graph.json").read_text())
        self.registry = json.loads((inventory / "attribute_registry.json").read_text())
        self.coverage = json.loads((inventory / "design_attribute_coverage_matrix.json").read_text())

    def test_profile_ids_are_unique_and_do_not_shadow_core_registry(self):
        profile_ids = [item["attribute_id"] for item in self.profile["attributes"]]
        core_ids = {item["attribute_id"] for item in self.registry["attributes"]}
        self.assertEqual(len(profile_ids), len(set(profile_ids)))
        self.assertFalse(core_ids.intersection(profile_ids))
        for attribute_id in profile_ids:
            self.assertRegex(attribute_id, r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$")

    def test_every_attribute_has_b0_delivery_fields(self):
        required = {
            "attribute_id",
            "definition",
            "value_type",
            "inventory_categories",
            "maturity_expectation",
            "authority_rule",
            "source_contract",
            "implementation_owner",
            "test_targets",
            "implementation_status",
        }
        for item in self.profile["attributes"]:
            with self.subTest(attribute=item["attribute_id"]):
                self.assertFalse(required - set(item))
                self.assertTrue(item["inventory_categories"])
                self.assertTrue(item["test_targets"])
                if item["implementation_status"] == "operational":
                    self.assertTrue(item.get("runtime_evidence_refs"))

    def test_category_bindings_resolve_to_full_inventory(self):
        known = {item["category_id"] for item in self.coverage["categories"]}
        bound = {
            category
            for item in self.profile["attributes"]
            for category in item["inventory_categories"]
        }
        self.assertFalse(bound - known)
        self.assertEqual(self.profile["coverage_summary"]["inventory_categories_directly_bound"], len(bound))
        self.assertEqual(
            self.profile["coverage_summary"]["remaining_categories"],
            len(known - bound),
        )

    def test_remaining_domain_profiles_close_category_contract_coverage(self):
        known = {item["category_id"] for item in self.coverage["categories"]}
        minimum_bound = {
            category
            for item in self.profile["attributes"]
            for category in item["inventory_categories"]
        }
        domain_categories = [item["category_id"] for item in self.domain_profiles["profiles"]]
        atomic_attributes = [
            attribute
            for item in self.domain_profiles["profiles"]
            for attribute in item["atomic_attributes"]
        ]
        self.assertEqual(len(domain_categories), 17)
        self.assertEqual(len(domain_categories), len(set(domain_categories)))
        self.assertEqual(set(domain_categories), known - minimum_bound)
        self.assertEqual(len(atomic_attributes), len(set(atomic_attributes)))
        self.assertEqual(
            self.domain_profiles["summary"]["atomic_attributes"],
            len(atomic_attributes),
        )
        for item in self.domain_profiles["profiles"]:
            with self.subTest(category=item["category_id"]):
                self.assertTrue(item["atomic_attributes"])
                self.assertTrue(item["known_paths"])
                self.assertTrue(item["delivery_boundary"])
                self.assertTrue(item["acceptance"])
                self.assertTrue(item["implementation_owner"])

    def test_execution_graph_references_confirmed_features_and_valid_nodes(self):
        confirmed_features = {
            item["category_id"] for item in self.domain_profiles["profiles"]
        } | {item["attribute_id"] for item in self.profile["attributes"]}
        nodes = self.execution_graph["nodes"]
        node_ids = [item["node_id"] for item in nodes]
        self.assertEqual(len(node_ids), len(set(node_ids)))
        self.assertFalse({item["feature_ref"] for item in nodes} - confirmed_features)
        for item in nodes:
            with self.subTest(node=item["node_id"]):
                self.assertTrue(item["outputs"])
                self.assertTrue(item["quality_gate"])
                self.assertTrue(item["trigger"])
                self.assertTrue(item["cache_policy"])
                self.assertTrue(item["invalidation_scope"])
                if item["implementation_status"] == "operational":
                    self.assertTrue(item.get("runtime_evidence_refs"))
        known_nodes = set(node_ids)
        for edge in self.execution_graph["edges"]:
            self.assertIn(edge["upstream"], known_nodes)
            self.assertIn(edge["downstream"], known_nodes)
            self.assertNotEqual(edge["upstream"], edge["downstream"])

    def test_execution_graph_is_acyclic(self):
        node_ids = {item["node_id"] for item in self.execution_graph["nodes"]}
        outgoing = {node_id: [] for node_id in node_ids}
        indegree = {node_id: 0 for node_id in node_ids}
        for edge in self.execution_graph["edges"]:
            outgoing[edge["upstream"]].append(edge["downstream"])
            indegree[edge["downstream"]] += 1

        ready = [node_id for node_id, count in indegree.items() if count == 0]
        visited = 0
        while ready:
            node_id = ready.pop()
            visited += 1
            for downstream in outgoing[node_id]:
                indegree[downstream] -= 1
                if indegree[downstream] == 0:
                    ready.append(downstream)

        self.assertEqual(visited, len(node_ids), "scientific execution graph contains a cycle")


if __name__ == "__main__":
    unittest.main()
