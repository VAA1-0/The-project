# B5 governed claim, proposition, relation, and transition delivery

Date: 2026-07-16

## Outcome

Datascene/VAA1 now has an append-only interpretation candidate substrate over native findings. It supports epistemic claim candidates, analytical propositions, typed proposition relations, and before/after state transitions without creating a second canonical truth store.

Every record states that its writer is a candidate service and that it has no canonical-write authority. Analyst-confirmed truth continues to enter through the canonical decision ledger and existing claim projection. This keeps the program productive—qualified observations and propositions remain visible—while preventing automatic interpretation from acquiring analyst authority.

## Operational rules

- Claims require native-finding references, source-evidence references, a quality assessment, subject, and scope.
- Evidence fitness determines whether a claim is a proposition candidate or observation-only; both remain visible.
- Propositions require existing supporting claim/proposition records and an explicit counter-evidence list, even when empty.
- Relations require two distinct existing claim/proposition endpoints.
- State transitions require existing before/after records, a subject, state property, method, evidence, and a temporally ordered boundary.
- Invalidations append immutable events and compute effective validity without rewriting prior reasoning.
- Stable content-derived identifiers make repeated writes idempotent.
- The registry returns the downstream affected-branch plan for interpretation and projection work.

## API and storage

Storage: `outputs/api_results/{analysis_id}/interpretation_registry.json`.

Routes are provided for registry readback and for claims, propositions, relations, state transitions, and invalidations under `/api/analysis/{analysis_id}/interpretation-registry`.

## Verification

Eight combined B3–B5 contract tests pass in `vaa1_core`. B5 coverage proves the complete candidate chain, source traceback, low-quality visibility, explicit counter-evidence requirement, stable idempotence, immutable invalidation, boundary ordering, and the prohibition on canonical writes.

A live non-persisting claim probe passed through the canonical Conda launcher. Limited-quality evidence returned a visible `observation_only` record with `eligible: false`, `authority: candidate_service`, and `canonical_write: false`; no registry file was created in the saved analysis.

## Remaining boundary

- Bind analyst confirmation of a selected proposition through an explicit canonical decision adapter.
- Execute affected-branch recomputation instead of only returning the plan.
- Build framework-specific interpretations, including Meaning Network, Narrative Agent, and Boje 5B projections, only from eligible registry records.
- Implement verified report claims with citation-level source traceback.
