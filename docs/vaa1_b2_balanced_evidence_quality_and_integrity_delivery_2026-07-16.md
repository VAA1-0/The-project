# Datascene/VAA1 B2 Balanced Evidence Quality and Integrity Delivery

Date: 2026-07-16
Status: integrity slice delivered; local recomputation executor remains for B3

## Governing balance

Datascene must not choose between usefulness and scientific rigor. Evidence quality therefore governs **permitted use**, not basic visibility.

Every result remains calmly inspectable. Lower-quality material may still support navigation, descriptive measurement, exploratory comparison, and candidate formation when accompanied by its limitations. Stronger uses require progressively stronger evidence. Quality never substitutes for confidence, maturity, authority, or validity, and none of those dimensions substitutes for quality.

The regime has four practical levels:

1. **Inspect.** Always visible, including unassessed and limited evidence.
2. **Explore.** Descriptive and exploratory results remain available with qualifications.
3. **Infer.** Comparative inference requires sufficient score, coverage, and representativeness.
4. **Promote.** Mature projections and verified report claims require high score and coverage plus corroboration and temporal precision.

This is deliberately not a “pass/fail before showing anything” model. A result can be useful without being promotion-eligible.

## Evidence-quality dimensions

- clarity
- audibility
- occlusion control
- temporal precision
- completeness
- representativeness
- source independence
- corroboration
- transcription quality
- assignment stability

The weighted overall score is accompanied by assessment coverage, a fitness band, missing dimensions, and operational limitations. The contract is `docs/schemas/vaa1.evidence_quality.v1.schema.json`.

## Delivered integrity functions

### Persistence probes

An isolated temporary bundle proved taxonomy application and source-policy save/reopen without modifying a user analysis. Taxonomy application remained idempotent after reopen; source restrictions survived reopen and continued to block disallowed export.

### Clock-to-ledger invalidation

Source-clock resolution can now optionally select active canonical decisions whose own temporal scope overlaps the change and append a `stale` dependency invalidation through the existing ledger. Superseded, invalidated, untimed, and non-overlapping decisions are excluded.

### Affected-branch planning

The scientific graph planner validates node references and acyclicity, then returns deterministic downstream stages, change reasons, distance, invalidation scope, implementation status, and unaffected stages. Observability and maturation-economics edges are excluded from scientific recomputation unless explicitly requested.

## Live balanced-result example

The live route probe produced an exploratory evidence profile with score `0.482727` and coverage `0.5`:

- inspect: visible and eligible
- exploratory analysis: eligible
- descriptive measurement: eligible in exploratory mode
- proposition candidate: eligible as a candidate
- comparative inference: exploratory only
- mature projection: candidate only
- verified report claim: candidate only

This is the intended balance: the analyst receives a result, but Datascene does not silently overstate what that result can support.

## Verification

- Focused canonical/B2 suite: 47 tests passed.
- Isolated `vaa1_core` integrity probe: all 12 persistence, invalidation, quality, and planning checks passed.
- Live two-environment launcher verification: `vaa1_core` and `vaa1_face` passed.
- Live evidence-quality route: passed.
- Live affected-branch planning route: passed.
- JSON parsing, evidence-quality contract-shape tests, Python compilation, shell syntax, and diff formatting checks: passed. The Conda runtime does not include the optional `jsonschema` meta-validator, so no dependency was added merely for this gate.

## Remaining boundary

The planner describes affected work but does not yet execute every downstream recomputation. B3 must bind real measurement artifacts to this plan and prove local recomputation of the transcript/speaker/VAD/scene vertical slice. Taxonomy and source-policy persistence are safely validated in isolation; a user-approved saved-analysis probe remains the final operational readback step for those two services.
