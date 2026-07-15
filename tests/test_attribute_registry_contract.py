import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class AttributeRegistryContractTests(unittest.TestCase):
    def setUp(self):
        self.registry = json.loads((ROOT / "docs" / "inventory" / "attribute_registry.json").read_text())
        self.schema = json.loads((ROOT / "docs" / "schemas" / "vaa1.attribute_registry.v1.schema.json").read_text())

    def test_registry_has_unique_well_formed_attribute_ids(self):
        ids = [item["attribute_id"] for item in self.registry["attributes"]]
        self.assertEqual(len(ids), len(set(ids)))
        for attribute_id in ids:
            self.assertRegex(attribute_id, r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$")

    def test_every_attribute_has_formal_governance_dimensions(self):
        required = set(self.schema["properties"]["attributes"]["items"]["required"])
        for item in self.registry["attributes"]:
            with self.subTest(attribute=item["attribute_id"]):
                self.assertFalse(required - set(item))
                self.assertIsInstance(item["scope"]["temporal"], bool)
                self.assertIsInstance(item["scope"]["spatial"], bool)
                self.assertIsInstance(item["projection_eligible"], bool)

    def test_dependencies_reference_registered_or_external_substrate_attributes(self):
        ids = {item["attribute_id"] for item in self.registry["attributes"]}
        allowed_external = {"source_media.clock"}
        for item in self.registry["attributes"]:
            for dependency in item["dependencies"]:
                self.assertIn(dependency, ids | allowed_external)


if __name__ == "__main__":
    unittest.main()
