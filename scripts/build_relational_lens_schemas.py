"""Build standalone, draft lens contracts. Does not register runtime features."""
import argparse
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "docs/schemas/relational_lenses"
NAMES = (
    "goffmanian_situated_conduct",
    "morenoan_relational_configuration",
    "latourian_association_dynamics",
)


def build(name):
    schema = json.loads((DIRECTORY / "1.0.0" / f"{name}.schema.json").read_text())
    common = json.loads((DIRECTORY / "common-definitions.v1.1.0.json").read_text())
    schema["$defs"].update(copy.deepcopy(common["$defs"]))
    schema["$id"] = f"urn:datascene:relational-lenses:{name}:1.1.0"
    schema["$comment"] = "Draft contract only. Not registered or enabled in the application."
    schema["properties"]["schema_version"] = {"const": "1.1.0"}
    for field in ("project_id", "analysis_id"):
        schema["required"].append(field)
        schema["properties"][field] = {"$ref": "#/$defs/nonEmptyId"}
    framework = schema["properties"]["framework"]
    if "concept_provenance" not in framework["required"]:
        framework["required"].append("concept_provenance")
    framework["properties"]["concept_provenance"]["minItems"] = 1
    for definition in ("interactionEvent", "roleRelation", "association"):
        if definition in schema["$defs"]:
            schema["$defs"][definition]["required"].append("rationale")
    schema["allOf"] = [{
        "if": {"properties": {"interpretive_summary": {"properties": {
            "epistemic_level": {"const": "confirmed_interpretation"}
        }}}},
        "then": {"properties": {"governance": {"properties": {
            "record_status": {"enum": ["confirmed", "corrected", "stale", "invalidated", "superseded", "conflicted"]},
            "authority": {"enum": ["analyst_confirmed", "analyst_corrected"]},
        }, "required": ["ledger_event_id"]}}},
    }]
    if name.startswith("latourian"):
        schema["required"].append("participants")
        schema["properties"]["participants"]["minItems"] = 1
        schema["$defs"]["stabilization"]["allOf"] = [{
            "if": {"properties": {"state": {"not": {"const": "not_assessed"}}}},
            "then": {"required": ["supporting_association_ids"], "properties": {
                "supporting_association_ids": {"minItems": 1}
            }},
        }]
    if name.startswith("morenoan"):
        schema["required"].append("ethics")
        schema["required"].remove("role_relations")
        schema["properties"]["role_relations"]["minItems"] = 0
        schema["allOf"].append({
            "if": {"properties": {"framework": {"properties": {"scope": {"const": "sociometric"}}}}},
            "then": {"required": ["sociometric_relations"], "properties": {"sociometric_relations": {"minItems": 1}}},
            "else": {"required": ["role_relations"], "properties": {"role_relations": {"minItems": 1}}},
        })
        controls = schema["$defs"]["ethics"]["properties"]["sensitive_relation_controls"]
        controls["allOf"] = [{"if": {"contains": {"const": "not_applicable"}}, "then": {"maxItems": 1}}]
        relation = schema["$defs"]["sociometricRelation"]
        relation["required"] += ["epistemic_status", "rationale", "round_id", "population_ref"]
        relation["properties"].update({
            "epistemic_status": copy.deepcopy(schema["$defs"]["roleRelation"]["properties"]["epistemic_status"]),
            "rationale": {"type": "string", "minLength": 1},
            "round_id": {"$ref": "#/$defs/nonEmptyId"},
            "population_ref": {"$ref": "#/$defs/nonEmptyId"},
            "strength_scale_ref": {"$ref": "#/$defs/nonEmptyId"},
        })
        relation["allOf"] = [{"if": {"required": ["strength"]}, "then": {"required": ["strength_scale_ref"]}}]
        schema["$defs"]["roleRelation"]["properties"]["counterrole_ids"]["description"] = (
            "References role_relation_id values in this reading, not participant IDs."
        )
    return schema


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if generated files differ; write nothing.")
    args = parser.parse_args()
    for name in NAMES:
        content = json.dumps(build(name), indent=2, ensure_ascii=False) + "\n"
        target = DIRECTORY / "1.1.0" / f"{name}.schema.json"
        if args.check:
            if not target.exists() or target.read_text() != content:
                raise SystemExit(f"Generated schema drift: {target}")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content)
    print("Three standalone lens schemas " + ("match their sources." if args.check else "generated."))


if __name__ == "__main__":
    main()
