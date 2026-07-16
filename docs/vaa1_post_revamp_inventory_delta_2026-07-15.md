# Datascene/VAA1 Post-Revamp Inventory Delta

Date: 2026-07-15
Gate: Bonus Sprint B0

## Decision

The canonical architectural revamp is operational, but the full empirical taxonomy is not yet operational as a complete scientific feature regime. The earlier twelve-attribute registry was intentionally a minimal architectural slice. It proved governance, correction, projection, invalidation, and traceback before expanding the scientific object model.

The correct next move is incremental operationalization through bounded atomic profiles. Category names are coverage authorities; they are not themselves attributes, runtime implementations, or evidence of scientific validity.

## Current delta

- Empirical coverage authority: 47 categories.
- Existing architectural Attribute Registry: 12 atomic attributes.
- Existing dependency graph: 7 operational-core edges.
- Coverage state at this gate: 2 operational, 36 partial, 4 nominal, 4 missing, and 1 experimental category.
- New minimum statistics-to-interpretation profile: 17 atomic attribute contracts directly binding 30 inventory categories.
- Remaining domain categories requiring atomic profile passes: 17. Their 97 atomic contracts are now confirmed in `docs/inventory/domain_atomic_profiles_remaining_17.json`; runtime delivery remains pending.

The new contracts are in `docs/inventory/stats_interpretation_profile.json`. A `contracted` status means the semantic, authority, source, ownership, and acceptance boundary is now fixed; it does not mean runtime implementation has been delivered.

## Closed by the architectural revamp

- Append-only canonical decisions and supersession.
- Explicit authority, maturity, and validity dimensions.
- Proposal-only candidate writers.
- Deterministic shared projections.
- Dependency invalidation contract and canonical write boundary.
- Persistence and traceback proof for the operational-core slice.

## Still partial after the revamp

- Uniform vocabulary IDs, versions, hierarchy, deprecation, and multilingual labels.
- Complete source-clock enforcement across every modality and future analytical object.
- Complete provenance normalization and claim-to-source traceback coverage.
- Evidence quality independent from confidence and maturity.
- Reproducible multimodal measurement runs and real implementations for mock StatsKit methods.
- Governed claims, propositions, relations, transitions, interpretations, and report claims.
- Full Narrative Agent, Meaning Network, Boje 5B, reporting, save/reopen, and export round trips.

## B0 acceptance

B0 is complete at the contract level when:

1. Every new profile attribute has a stable ID and definition.
2. Every attribute declares its inventory-category bindings.
3. Maturity and authority behavior are explicit.
4. The source contract and implementation owner are named.
5. At least one test target is declared.
6. Runtime status remains truthful.
7. Historical inventory artifacts remain unchanged and auditable.

These conditions are met by the minimum profile. Runtime implementation begins with B1 and B2; B3 is the first native statistical execution delivery.

## Confirmed domain profile passes

The remaining 17 categories have now been atomized in bounded profiles rather than represented by one vague category-level field. See `docs/vaa1_remaining_17_domain_atomic_profiles_2026-07-15.md` for the rationale and delivery boundaries:

1. Source policy, rights, acquisition, providers, and external round trips.
2. Visual measurement families: faces, OCR/graphics, camera/composition, shots/transitions/scenes, and calibrated visual series.
3. Audio measurement families: waveform/events, VAD, diarization, prosody, music/noise/lyrics, and sample similarity.
4. Language and social-scene families: transcript rows, POS/SFL, rhetoric, institutions, audiences, absence, and reception.
5. Research and operations: disagreement/adjudication, performance observability, maturation economics, search, packaging, and reproducibility.

The contracts and initial dependency nodes are confirmed. Each implementation pass must still add concrete bindings, fixtures, invalidation tests, and runtime evidence. Only that evidence may promote an entry to `operational`.
