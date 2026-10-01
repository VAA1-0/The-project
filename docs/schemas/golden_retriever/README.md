# Golden Retriever acquisition contract

This directory vendors the supplied Golden Retriever Acquisition Package JSON
Schema as an immutable `1.0.0` contract. Runtime code must load it through
`src.backend.analysis.golden_retriever_validation`; callers must not treat the
schema's `x-datascene-invariants` text as executable validation.

The validator runs two gates:

1. JSON Schema Draft 2020-12 shape and format validation.
2. Datascene semantic validation for local reference resolution, identifier
   uniqueness, supersession/transformation cycles, acquisition-lane policy,
   accepted-item grounding, redistribution/training constraints, and realized
   resource budgets.

No connector execution is enabled by this package. Credentials remain external,
and ingestion, analyst confirmation, and corpus publication continue to use
their existing governed service boundaries.

`POST /api/acquisition/packages/validate` exposes validation as a read-only
preflight. It does not persist the submitted package or execute a connector.
