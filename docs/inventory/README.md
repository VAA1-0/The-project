# Datascene/VAA1 Empirical Inventory Workspace

This directory contains evidence-backed audit deliverables governed by `docs/sprint_program_empirical_taxonomy_discovery_2026-07-12.md`.

## Deliverables

- `attribute_registry.json`: stable semantic definitions.
- `implementation_bindings.json`: changing code, artifact, consumer, runtime, and test bindings.
- `vocabulary_registry.json`: versioned controlled vocabularies and mappings.
- `dependency_graph.json`: typed change and invalidation edges.
- `migration_matrix.json`: legacy field to canonical attribute disposition.
- `runtime_evidence_index.json`: representative evidence without copying secrets or restricted material.
- `pass_1_gate.json`: evidence and decision for each operational-core gate.
- `design_attribute_coverage_matrix.json`: consolidated Passes 1-4 design-to-implementation coverage, including missing scientific categories.
- `later_operationalization_registry.json`: known code paths, candidate readings, suggested attributes, and acceptance rules for deferred categories.

The original starter files have now been populated. The 2026-07-15 architectural revamp updated the implementation bindings, dependency graph, runtime evidence, schemas, and Pass 1 gate to operational status. `design_attribute_coverage_matrix.json` remains the controlling checklist for scientific feature breadth; an operational architecture does not silently convert unimplemented analytical categories into completed features.

## Evidence rule

Every implementation binding and gate claim must cite at least one repository path, artifact/schema, representative runtime record, or test. Documentation-only claims cannot receive `operational` status.
