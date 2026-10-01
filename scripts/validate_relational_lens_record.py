"""Offline draft-contract validation; never verifies authority or writes live data.

Requires jsonschema 4.23.0 (see the schema package's requirements-validation.txt).
External source ownership, ledger decisions and snapshot hashes need runtime adapters.
"""
import argparse
import json
import math
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

DIRECTORY = Path(__file__).resolve().parents[1] / "docs/schemas/relational_lenses/1.1.0"
NAMES = {path.name.removesuffix(".schema.json") for path in DIRECTORY.glob("*.schema.json")}


def validate_record(record):
    """Return structural and in-record semantic errors, not an authority decision."""
    if not isinstance(record, dict):
        return ["Record must be an object"]
    framework = record.get("framework")
    name = framework.get("framework_id") if isinstance(framework, dict) else None
    if not isinstance(name, str) or name not in NAMES:
        return ["Unknown framework_id"]
    schema = json.loads((DIRECTORY / f"{name}.schema.json").read_text())
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = [f"{'/'.join(map(str, error.absolute_path)) or '/'}: {error.message}"
              for error in validator.iter_errors(record)]
    if errors:
        return errors

    def identities(collection, field):
        values = [row[field] for row in record.get(collection, [])]
        if len(values) != len(set(values)):
            errors.append(f"{collection}: duplicate {field}")
        return set(values)

    anchors = identities("source_anchors", "anchor_id")
    participants = identities("persons_or_collectives" if name.startswith("morenoan") else "participants", "participant_id")
    roles = identities("role_relations", "role_relation_id")
    associations = identities("associations", "association_id")
    relations = identities("sociometric_relations", "relation_id")
    for collection, field in {
        "interaction_events": "event_id", "performances": "performance_id",
        "participation_frameworks": "framework_event_id", "regions_and_territories": "region_id",
        "frames_and_transformations": "frame_event_id", "identity_information": "identity_event_id",
        "translations": "translation_id", "controversies": "controversy_id",
        "social_atoms": "social_atom_id", "enacted_scenes": "scene_id", "alternatives": "alternative_id",
    }.items():
        identities(collection, field)

    reference_sets = {
        "evidence_anchor_ids": anchors,
        "participant_ids": participants, "performer_ids": participants, "audience_ids": participants,
        "participant_id": participants, "from_participant_id": participants,
        "to_participant_id": participants, "focal_participant_id": participants,
        "role_relation_ids": roles, "counterrole_ids": roles,
        "supporting_association_ids": associations, "relation_ids": relations,
    }
    governance = record["governance"]
    # Retain prior confirmation when evidence becomes stale. This is history,
    # not an eligibility decision for a current mature consumer.
    reviewed = (
        governance["record_status"] in {"confirmed", "corrected", "stale", "invalidated", "superseded", "conflicted"}
        and governance["authority"] in {"analyst_confirmed", "analyst_corrected"}
        and bool(governance.get("ledger_event_id"))
    )

    def walk(value, path=""):
        if isinstance(value, dict):
            for key, child in value.items():
                location = f"{path}/{key}"
                if key == "parameters":
                    # Producer configuration is opaque, not a lens reference namespace.
                    continue
                if key in reference_sets:
                    refs = child if isinstance(child, list) else [child]
                    missing = set(refs) - reference_sets[key]
                    if missing:
                        errors.append(f"{location}: unresolved references {sorted(missing)}")
                if key in {"epistemic_status", "epistemic_level"} and child == "confirmed_interpretation" and not reviewed:
                    errors.append(f"{location}: confirmed assertion requires a declared analyst decision, including historical decisions")
                walk(child, location)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{path}/{index}")
        elif isinstance(value, float) and not math.isfinite(value):
            errors.append(f"{path}: non-finite numbers are not permitted")

    walk(record)
    for anchor in record["source_anchors"]:
        label = anchor["anchor_id"]
        if anchor["time_end"] < anchor["time_start"]:
            errors.append(f"{label}: time_end precedes time_start")
        if anchor["anchor_type"] in {"document_span", "image_region", "web_region", "metadata_record"}:
            if anchor["time_start"] != 0 or anchor["time_end"] != 0:
                errors.append(f"{label}: non-temporal compatibility anchors require zero times")
        box = anchor.get("spatial_region")
        if box and box["coordinate_system"] == "normalized_0_1":
            if box["x"] + box["width"] > 1 + 1e-12 or box["y"] + box["height"] > 1 + 1e-12:
                errors.append(f"{label}: normalized region extends outside the source")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("record", type=Path)
    args = parser.parse_args()
    errors = validate_record(json.loads(args.record.read_text()))
    if errors:
        print("\n".join(errors))
        raise SystemExit(1)
    print("Offline contract checks passed. External evidence, authority and publication eligibility are NOT verified.")


if __name__ == "__main__":
    main()
