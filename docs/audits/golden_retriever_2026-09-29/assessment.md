# Golden Retriever 1.0 integration assessment

## Decision

Suitable as a draft, additive acquisition-envelope contract and validation
boundary. It is not suitable as authority to activate web crawling, database
access, authenticated connectors, analyst confirmation, or corpus publication.

The design fits Datascene's current principles: acquisition remains separate
from analysis; source observations remain distinct from interpretation;
manual decisions retain authority; evidence is navigable; source-use policy is
checked before transfer; and publication remains a governed downstream action.

## Embedded scope

- The supplied design is retained unchanged as assessment evidence.
- The supplied Draft 2020-12 schema is vendored unchanged at version `1.0.0`.
- A backend validation boundary performs structural and semantic validation.
- A read-only API preflight exposes that boundary without persistence or fetch.
- Contract tests cover the schema, a minimal valid envelope, unresolved and
  cyclic lineage, accepted-item grounding, rights/lane gates, and budgets.

## Corrections made at the integration boundary

The schema's `x-datascene-invariants` are annotations, not executable JSON
Schema constraints. The backend therefore enforces local references, uniqueness,
acyclic supersession and transformation lineage, lane compatibility, admission
grounding, redistribution rights, training-lane isolation, and numeric budgets.

Validation fails closed if the declared `jsonschema` dependency is absent.

## Deferred by design

- Connector implementations and network access.
- Secret resolution and authenticated sessions.
- Archive extraction/quarantine and SQL statement enforcement.
- UI surfaces and automatic writes into existing canonical stores.
- Cross-package references: the supplied schema mentions them but contains no
  typed external-package declaration or integrity mechanism.
- Monetary budget reconciliation across currencies.
- Model-training eligibility as an independent rights field; version 1.0 only
  exposes lane, policy operations, output type, and general rights status.
- Canonical analyst authority: acceptance fields in this envelope are not a
  substitute for Datascene's append-only decision ledger.

These deferrals prevent a broad design document from silently expanding the
runtime's access, storage, or decision authority.
