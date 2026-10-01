"""Validation boundary for Golden Retriever acquisition packages.

The JSON Schema owns record shape.  This module owns the cross-record and
governance invariants that JSON Schema cannot express.  It deliberately does
not fetch content, resolve credentials, or promote analytical maturity.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping


SCHEMA_VERSION = "1.0.0"
SCHEMA_PATH = (
    Path(__file__).resolve().parents[3]
    / "docs"
    / "schemas"
    / "golden_retriever"
    / SCHEMA_VERSION
    / "schema.json"
)


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    path: str
    message: str


_COLLECTION_IDS = {
    "connectors": "connector_id",
    "source_policies": "policy_id",
    "query_families": "query_family_id",
    "route_profiles": "route_profile_id",
    "experiments": "experiment_id",
    "fetch_attempts": "fetch_attempt_id",
    "sources": "source_id",
    "captures": "capture_id",
    "metadata_observations": "metadata_observation_id",
    "media_references": "media_reference_id",
    "assets": "asset_id",
    "segments": "segment_id",
    "entities": "entity_id",
    "entity_claims": "entity_claim_id",
    "transformations": "transformation_run_id",
    "analytical_objects": "analytical_object_id",
    "evidence_links": "evidence_link_id",
    "corpus_admissions": "corpus_admission_id",
}

_RECORD_TYPE_COLLECTION = {
    "source": "sources",
    "capture": "captures",
    "asset": "assets",
    "segment": "segments",
    "entity": "entities",
    "entity_claim": "entity_claims",
    "analytical_object": "analytical_objects",
    "transformation": "transformations",
}


def load_schema() -> dict[str, Any]:
    """Load the vendored, immutable version 1.0.0 schema."""
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _issue(code: str, path: str, message: str) -> ValidationIssue:
    return ValidationIssue(code=code, path=path, message=message)


def _records(package: Mapping[str, Any], collection: str) -> list[Mapping[str, Any]]:
    value = package.get(collection, [])
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, Mapping)]


def _indexes(package: Mapping[str, Any]) -> dict[str, dict[str, Mapping[str, Any]]]:
    result: dict[str, dict[str, Mapping[str, Any]]] = {}
    for collection, id_field in _COLLECTION_IDS.items():
        result[collection] = {
            str(item[id_field]): item
            for item in _records(package, collection)
            if isinstance(item.get(id_field), str)
        }
    return result


def _check_unique_ids(package: Mapping[str, Any]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for collection, id_field in _COLLECTION_IDS.items():
        seen: set[str] = set()
        for offset, record in enumerate(_records(package, collection)):
            record_id = record.get(id_field)
            if not isinstance(record_id, str):
                continue
            if record_id in seen:
                issues.append(_issue(
                    "duplicate_identifier",
                    f"/{collection}/{offset}/{id_field}",
                    f"{record_id!r} is duplicated within {collection}.",
                ))
            seen.add(record_id)
    return issues


def _check_ref(
    issues: list[ValidationIssue],
    indexes: Mapping[str, Mapping[str, Any]],
    collection: str,
    record_id: Any,
    path: str,
) -> None:
    if isinstance(record_id, str) and record_id not in indexes.get(collection, {}):
        issues.append(_issue(
            "unresolved_reference",
            path,
            f"{record_id!r} does not resolve in {collection}.",
        ))


def _check_record_reference(
    issues: list[ValidationIssue],
    indexes: Mapping[str, Mapping[str, Any]],
    reference: Any,
    path: str,
) -> None:
    if not isinstance(reference, Mapping):
        return
    record_type = reference.get("record_type")
    collection = _RECORD_TYPE_COLLECTION.get(str(record_type))
    if collection:
        _check_ref(issues, indexes, collection, reference.get("record_id"), f"{path}/record_id")


def _check_references(
    package: Mapping[str, Any], indexes: Mapping[str, Mapping[str, Any]]
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    study_id = package.get("study", {}).get("study_id") if isinstance(package.get("study"), Mapping) else None

    for i, connector in enumerate(_records(package, "connectors")):
        if connector.get("policy_id") is not None:
            _check_ref(issues, indexes, "source_policies", connector.get("policy_id"), f"/connectors/{i}/policy_id")

    variant_ids: set[str] = set()
    for family in _records(package, "query_families"):
        for variant in family.get("variants", []):
            if isinstance(variant, Mapping) and isinstance(variant.get("query_variant_id"), str):
                variant_ids.add(variant["query_variant_id"])

    for i, experiment in enumerate(_records(package, "experiments")):
        if experiment.get("study_id") != study_id:
            issues.append(_issue("unresolved_reference", f"/experiments/{i}/study_id", "Experiment does not reference this package study."))
        if experiment.get("query_family_id") is not None:
            _check_ref(issues, indexes, "query_families", experiment.get("query_family_id"), f"/experiments/{i}/query_family_id")
        for j, cell in enumerate(experiment.get("cells", [])):
            if not isinstance(cell, Mapping):
                continue
            base = f"/experiments/{i}/cells/{j}"
            _check_ref(issues, indexes, "connectors", cell.get("connector_id"), f"{base}/connector_id")
            if cell.get("query_variant_id") not in variant_ids:
                issues.append(_issue("unresolved_reference", f"{base}/query_variant_id", "Experiment cell query variant does not resolve."))
            if cell.get("route_profile_id") is not None:
                _check_ref(issues, indexes, "route_profiles", cell.get("route_profile_id"), f"{base}/route_profile_id")

    for i, attempt in enumerate(_records(package, "fetch_attempts")):
        base = f"/fetch_attempts/{i}"
        if attempt.get("study_id") != study_id:
            issues.append(_issue("unresolved_reference", f"{base}/study_id", "Fetch attempt does not reference this package study."))
        _check_ref(issues, indexes, "connectors", attempt.get("connector_id"), f"{base}/connector_id")
        for field, collection in (("experiment_id", "experiments"), ("route_profile_id", "route_profiles")):
            if attempt.get(field) is not None:
                _check_ref(issues, indexes, collection, attempt.get(field), f"{base}/{field}")
        if attempt.get("query_variant_id") is not None and attempt.get("query_variant_id") not in variant_ids:
            issues.append(_issue("unresolved_reference", f"{base}/query_variant_id", "Fetch-attempt query variant does not resolve."))

    simple_refs = {
        "sources": (("connector_id", "connectors"), ("parent_source_id", "sources"), ("supersedes_source_id", "sources")),
        "captures": (("source_id", "sources"), ("fetch_attempt_id", "fetch_attempts"), ("duplicate_of_capture_id", "captures")),
        "media_references": (("source_id", "sources"), ("parent_media_reference_id", "media_references")),
        "assets": (("capture_id", "captures"), ("media_reference_id", "media_references"), ("transformation_run_id", "transformations"), ("duplicate_of_asset_id", "assets")),
        "segments": (("asset_id", "assets"), ("parent_segment_id", "segments"), ("created_by_transformation_id", "transformations")),
        "entity_claims": (("subject_entity_id", "entities"), ("supersedes_claim_id", "entity_claims")),
        "analytical_objects": (("transformation_run_id", "transformations"), ("supersedes_analytical_object_id", "analytical_objects")),
    }
    for collection, fields in simple_refs.items():
        for i, record in enumerate(_records(package, collection)):
            for field, target in fields:
                if record.get(field) is not None:
                    _check_ref(issues, indexes, target, record.get(field), f"/{collection}/{i}/{field}")

    subject_collections = {"source": "sources", "entity": "entities", "asset": "assets", "segment": "segments"}
    for i, observation in enumerate(_records(package, "metadata_observations")):
        _check_ref(issues, indexes, "sources", observation.get("source_id"), f"/metadata_observations/{i}/source_id")
        target = subject_collections.get(str(observation.get("subject_type")))
        if target:
            _check_ref(issues, indexes, target, observation.get("subject_id"), f"/metadata_observations/{i}/subject_id")
        if observation.get("capture_id") is not None:
            _check_ref(issues, indexes, "captures", observation.get("capture_id"), f"/metadata_observations/{i}/capture_id")

    for i, claim in enumerate(_records(package, "entity_claims")):
        obj = claim.get("object")
        if isinstance(obj, Mapping) and obj.get("entity_id") is not None:
            _check_ref(issues, indexes, "entities", obj.get("entity_id"), f"/entity_claims/{i}/object/entity_id")
        for j, link_id in enumerate(claim.get("evidence_link_ids", [])):
            _check_ref(issues, indexes, "evidence_links", link_id, f"/entity_claims/{i}/evidence_link_ids/{j}")

    for i, transformation in enumerate(_records(package, "transformations")):
        for field in ("input_references", "output_references"):
            for j, reference in enumerate(transformation.get(field, [])):
                _check_record_reference(issues, indexes, reference, f"/transformations/{i}/{field}/{j}")

    for i, obj in enumerate(_records(package, "analytical_objects")):
        for j, link_id in enumerate(obj.get("evidence_link_ids", [])):
            _check_ref(issues, indexes, "evidence_links", link_id, f"/analytical_objects/{i}/evidence_link_ids/{j}")

    for i, link in enumerate(_records(package, "evidence_links")):
        _check_record_reference(issues, indexes, link.get("claimant"), f"/evidence_links/{i}/claimant")
        _check_record_reference(issues, indexes, link.get("evidence_target"), f"/evidence_links/{i}/evidence_target")
        for field, collection in (("source_id", "sources"), ("capture_id", "captures")):
            if link.get(field) is not None:
                _check_ref(issues, indexes, collection, link.get(field), f"/evidence_links/{i}/{field}")

    for i, admission in enumerate(_records(package, "corpus_admissions")):
        _check_record_reference(issues, indexes, admission.get("candidate_reference"), f"/corpus_admissions/{i}/candidate_reference")
    return issues


def _cycle_nodes(edges: Mapping[str, str]) -> set[str]:
    cyclic: set[str] = set()
    for start in edges:
        order: dict[str, int] = {}
        node: str | None = start
        while node is not None and node not in order:
            order[node] = len(order)
            node = edges.get(node)
        if node in order:
            cyclic.update(key for key, position in order.items() if position >= order[node])
    return cyclic


def _check_acyclic(package: Mapping[str, Any]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    graphs = (
        ("sources", "source_id", "supersedes_source_id"),
        ("metadata_observations", "metadata_observation_id", "supersedes_observation_id"),
        ("entity_claims", "entity_claim_id", "supersedes_claim_id"),
        ("analytical_objects", "analytical_object_id", "supersedes_analytical_object_id"),
    )
    for collection, id_field, edge_field in graphs:
        edges = {
            str(record[id_field]): str(record[edge_field])
            for record in _records(package, collection)
            if isinstance(record.get(id_field), str) and isinstance(record.get(edge_field), str)
        }
        for record_id in sorted(_cycle_nodes(edges)):
            issues.append(_issue("lineage_cycle", f"/{collection}", f"Supersession cycle includes {record_id!r}."))

    transformation_edges: dict[str, set[str]] = {}
    for transformation in _records(package, "transformations"):
        current = transformation.get("transformation_run_id")
        if not isinstance(current, str):
            continue
        for reference in transformation.get("input_references", []):
            if isinstance(reference, Mapping) and reference.get("record_type") == "transformation":
                upstream = reference.get("record_id")
                if isinstance(upstream, str):
                    transformation_edges.setdefault(current, set()).add(upstream)

    cyclic_transformations: set[str] = set()

    def visit(node: str, path: list[str], active: set[str]) -> None:
        if node in active:
            cyclic_transformations.update(path[path.index(node):])
            return
        if node in path:
            return
        next_path = [*path, node]
        next_active = {*active, node}
        for upstream in transformation_edges.get(node, set()):
            visit(upstream, next_path, next_active)

    for transformation_id in transformation_edges:
        visit(transformation_id, [], set())
    for record_id in sorted(cyclic_transformations):
        issues.append(_issue("lineage_cycle", "/transformations", f"Transformation cycle includes {record_id!r}."))
    return issues


def _check_governance(
    package: Mapping[str, Any], indexes: Mapping[str, Mapping[str, Any]]
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    governance = package.get("governance", {})
    study = package.get("study", {})
    if not isinstance(governance, Mapping) or not isinstance(study, Mapping):
        return issues
    default_lane = governance.get("default_acquisition_lane")
    study_lanes = set(study.get("acquisition_lanes", []))
    permitted_lanes = set(governance.get("permitted_acquisition_lanes", study_lanes))
    if default_lane not in study_lanes or default_lane not in permitted_lanes:
        issues.append(_issue("lane_incompatible", "/governance/default_acquisition_lane", "Default lane must be permitted by both study and governance."))

    for i, connector in enumerate(_records(package, "connectors")):
        policy_id = connector.get("policy_id")
        policy = indexes.get("source_policies", {}).get(str(policy_id))
        if policy and (not policy.get("active") or default_lane not in set(policy.get("permitted_lanes", []))):
            issues.append(_issue("lane_incompatible", f"/connectors/{i}/policy_id", "Connector policy is inactive or does not permit the default lane."))

    for i, admission in enumerate(_records(package, "corpus_admissions")):
        if admission.get("decision") != "accepted":
            continue
        rights = admission.get("rights_status")
        outputs = set(admission.get("permitted_outputs", []))
        if rights in {"unknown", "prohibited"}:
            issues.append(_issue("admission_rights_incompatible", f"/corpus_admissions/{i}/rights_status", "Accepted corpus items cannot have unknown or prohibited rights."))
        if "redistributable_asset" in outputs and rights not in {"public_domain", "open_license", "licensed_for_distribution"}:
            issues.append(_issue("admission_rights_incompatible", f"/corpus_admissions/{i}/permitted_outputs", "Redistribution requires distributable rights."))
        if "training_example" in outputs and default_lane != "product_training":
            issues.append(_issue("admission_lane_incompatible", f"/corpus_admissions/{i}/permitted_outputs", "Training examples require the product_training lane."))

        candidate = admission.get("candidate_reference")
        if isinstance(candidate, Mapping) and candidate.get("record_type") == "analytical_object":
            obj = indexes.get("analytical_objects", {}).get(str(candidate.get("record_id")))
            if obj and obj.get("grounding_state") != "evidence_linked":
                issues.append(_issue("admission_not_grounded", f"/corpus_admissions/{i}/candidate_reference", "Accepted analytical objects must be evidence-linked."))
    return issues


def _check_costs(package: Mapping[str, Any]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    economics = package.get("economics", {})
    if not isinstance(economics, Mapping):
        return issues
    budget = economics.get("budget", {})
    if not isinstance(budget, Mapping):
        return issues
    realized = [record for record in economics.get("cost_records", []) if isinstance(record, Mapping) and record.get("cost_state") == "realized"]
    fields = {
        "max_requests": "request_count",
        "max_network_bytes": "network_bytes",
        "max_retained_bytes": ("original_storage_bytes", "derivative_storage_bytes"),
        "max_cpu_seconds": "cpu_seconds",
        "max_gpu_seconds": "gpu_seconds",
        "max_model_tokens": "model_tokens",
        "max_analyst_minutes": "analyst_minutes",
    }
    for budget_field, cost_fields in fields.items():
        limit = budget.get(budget_field)
        if not isinstance(limit, (int, float)):
            continue
        names: Iterable[str] = cost_fields if isinstance(cost_fields, tuple) else (cost_fields,)
        actual = sum(float(record.get(name, 0) or 0) for record in realized for name in names)
        if actual > float(limit):
            issues.append(_issue("budget_exceeded", f"/economics/budget/{budget_field}", f"Realized total {actual:g} exceeds budget {limit:g}."))
    return issues


def validate_semantics(package: Mapping[str, Any]) -> list[ValidationIssue]:
    """Return deterministic cross-record errors for a structurally valid package."""
    indexes = _indexes(package)
    return sorted(
        _check_unique_ids(package)
        + _check_references(package, indexes)
        + _check_acyclic(package)
        + _check_governance(package, indexes)
        + _check_costs(package),
        key=lambda item: (item.path, item.code, item.message),
    )


def validate_package(package: Any) -> dict[str, Any]:
    """Run Draft 2020-12 shape validation and Datascene semantic checks."""
    structural: list[ValidationIssue] = []
    if not isinstance(package, Mapping):
        structural.append(_issue("schema_validation", "/", "Package must be a JSON object."))
    else:
        try:
            from jsonschema import Draft202012Validator, FormatChecker
        except ImportError as exc:  # fail closed; validation must never silently weaken
            raise RuntimeError("Golden Retriever validation requires jsonschema>=4.23") from exc
        validator = Draft202012Validator(load_schema(), format_checker=FormatChecker())
        for error in sorted(validator.iter_errors(package), key=lambda item: list(item.absolute_path)):
            pointer = "/" + "/".join(str(part) for part in error.absolute_path)
            structural.append(_issue("schema_validation", pointer, error.message))

    semantic = validate_semantics(package) if isinstance(package, Mapping) else []
    issues = structural + semantic
    return {
        "schema": "datascene.golden_retriever.validation.v1",
        "schema_version": SCHEMA_VERSION,
        "valid": not issues,
        "structural_valid": not structural,
        "semantic_valid": not semantic,
        "issues": [asdict(item) for item in issues],
    }
