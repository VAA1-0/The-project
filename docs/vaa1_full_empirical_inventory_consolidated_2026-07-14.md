# Datascene/VAA1 Full Empirical Inventory - Consolidated Baseline

Date: 2026-07-14
Scope: Empirical Passes 1-4
Status: Complete baseline inventory; canonical architecture implemented 2026-07-15

> Implementation update, 2026-07-15: the decision, validity, dependency, and projection architecture identified as missing in this baseline is now operational. Governed legacy writes are atomically adapted into an append-only canonical ledger; dependency invalidation, candidate-write enforcement, saved-analysis backfill, shared projection, and primary cross-panel consumers are implemented and runtime-validated. See `docs/vaa1_canonical_architectural_revamp_delivery_2026-07-15.md`. The category counts below remain the historical 2026-07-14 inventory snapshot rather than a rewritten audit result.

## Executive conclusion

Datascene/VAA1 already contains a substantial multimodal research environment, but it is not yet a uniformly operating scientific tool. Its strongest qualities are the breadth of source-linked analytical artifacts, explicit candidate/maturity language, manual BBox governance, interpretive artifact structures, and preservation of raw evidence. Its central weakness is that these capabilities do not yet share one validated decision, validity, dependency, and projection architecture.

The design-to-attribute coverage matrix contains 47 scientific and operational categories. After the first compatibility-projection implementation slice:

- 1 operational under the strict inventory evidence rule;
- 37 partial;
- 4 nominal;
- 4 missing;
- 1 experimental;
- 0 planned.

At the time of this baseline the Canonical Decision Ledger remained planned. It was implemented and validated on 2026-07-15.

This strict result does not mean that only one feature works. It means only one audited category currently demonstrated the complete producer, persistence, active consumer, representative runtime, reopen, and test standard without a material scientific-governance gap. Many partial categories contain real and useful software.

## Design brief alignment

The repository supports the design brief's intended layers, but does not yet enforce their separation consistently:

```text
canonical taxonomy
-> taxonomy application
-> evidence and reference support
-> analyst or governed decision
-> interpretation
-> projection
-> report/export
-> traceback
```

Current records often bundle two or more of these layers. The feature program must separate them without destructively rewriting legacy evidence.

## Pass 2 - Derived analytics

Real implementations exist for StatsKit, VAD/speech ratios, diarization candidates, prosody, POS/Quant, scene cards, visual tone/motion samples, search direction, and report artifacts.

The main scientific gaps are:

- several StatsKit measures use readiness counts or scene/shot proxies rather than persisted measurement series;
- method parameters, uncertainty, source-row lineage, and reproducible run artifacts are incomplete;
- evidence-quality dimensions are scattered across confidence, maturity, timing status, and quality-control fields;
- search and reporting lack fully proven active routes and claim-level governed citations;
- significance and relevance governance is more mature than its statistical computation layer.

## Pass 3 - Interpretive systems

Meaning Network, Narrative Agent/path readings, narrative lenses, Boje support, SFL/dependency, multimodal meaning, scene/situation taxonomy, and candidate maturity gates all have concrete code or persisted artifacts.

The main scientific gaps are:

- interpretations are not uniformly versioned objects with framework, interpreter, support, counter-evidence, alternatives, and revision lineage;
- values, virtues/vices, motives, themes, rhetorical strategies, and institutional processes remain nominal or partially embedded;
- claim/epistemic status, audience/reception, and explicit absence/omission analysis are missing as governed families;
- multi-analyst disagreement, inter-rater agreement, consensus, and adjudication are missing;
- Narrative Agent assignments still lack fully canonical entity, merge/split, validity, and cross-panel projection governance.

## Pass 4 - Experimental and external systems

Matcher/proliferation, sample clouds, music/lyrics direction, CVAT, imports, optional providers, observability, maturation economics, bundle export, hydration, and packaging all have some implementation surface.

The main operational gaps are:

- candidate services do not yet have a provable hard boundary at a Canonical Decision Ledger;
- music/lyrics remain experimental and need dependency, rights, runtime, and test evidence;
- CVAT lacks a proven duplicate-safe governed round trip;
- performance observability and maturation economics lack uniform representative runtime records;
- optional-provider activation, licensing, fallback, and exported provenance are not one consistent data model;
- packaged save/reopen/export reproducibility has not been demonstrated for the future decision/projection state.

## Categories that must not be omitted

The consolidated matrix explicitly adds categories easily missed by a detector-centered inventory:

- claim and epistemic status;
- rhetorical strategy;
- institutional and organizational process;
- evidence quality distinct from model confidence;
- absence, omission, silence, and non-response;
- audience, reception, platform, and circulation context;
- production and mediation devices;
- analyst disagreement, reliability, consensus, and adjudication;
- rights, sensitivity, retention, processing purpose, and export policy;
- interpretation plurality and revision lineage;
- performance and maturation economics.

## Test evidence and limitation

The focused frontend governance suite passed 49 tests during Pass 1. The wider Python contract selection could not be collected in the active shell because `pydantic` is missing from that interpreter. This is an environment-readiness finding, not evidence that the contracts pass or fail. The project environment must run the full suite before implementation readiness is declared.

## Architecture required for the operating science tool

The inventory supports six durable layers:

1. Immutable/versioned evidence substrate.
2. Stable subject and entity registry.
3. Canonical taxonomy and vocabulary service.
4. Append-only typed Decision Ledger with independent authority, maturity, validity, review, and conflict state.
5. Dependency/invalidation engine and deterministic Projection Engine.
6. Scientific analytical and interpretive objects consumed consistently by panels, search, reports, export, and traceback.

Candidate services, models, matchers, lenses, and agents operate around these layers but do not bypass them.

## Recommended implementation sequence

1. **Foundational contracts:** JSON Schemas for attributes, subjects, vocabularies, provenance activities, dependency edges, decisions, interpretations, measurements, and projections.
2. **Compatibility projection:** backend read-only projection over existing evidence and corrections; parity tests against current frontend authority logic.
3. **BBox Decision Ledger pilot:** typed append-only decisions, supersession, invalidation, save/reopen/export/traceback.
4. **Timing and transcript migration:** original Whisper/manual authority, validity propagation, stale dependent artifacts.
5. **Audio/shot/StatsKit measurements:** persisted method-provenanced source layers and reproducible statistical runs.
6. **Entity/Narrative Agent governance:** stable subjects, assignment decisions, merge/split, disagreement, and projections.
7. **Interpretation objects:** lenses, Meaning Network, SFL, themes, values, motives, significance, and relevance with plurality and counter-evidence.
8. **External/experimental hardening:** matcher boundary, CVAT, providers/licenses, music/lyrics, observability, economics, and packaging.

Each slice must update inventory bindings and tests as part of the same delivery.

## Governing artifacts

- `docs/inventory/design_attribute_coverage_matrix.json`
- `docs/inventory/attribute_registry.json`
- `docs/inventory/implementation_bindings.json`
- `docs/inventory/dependency_graph.json`
- `docs/inventory/migration_matrix.json`
- `docs/inventory/vocabulary_registry.json`
- `docs/inventory/runtime_evidence_index.json`
- `docs/inventory/pass_1_gate.json`

The coverage matrix is now the primary checklist preventing scientific categories from disappearing during implementation.
