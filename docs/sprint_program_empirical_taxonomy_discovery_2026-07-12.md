# Datascene/VAA1 Empirical Taxonomy Discovery and Delivery Sprint

Date: 2026-07-12
Application revision: 2026-07-14
Status: Active governing process

## Purpose

This sprint turns the empirical-system-inventory specification into evidence collected from the actual repository and representative runtime artifacts. The specification and the July 12 architectural findings are inputs; neither is evidence that the inventory is complete.

Generalized Canonical Decision Ledger and Projection Engine implementation is gated by the operational-core evidence below.

## Separate audit artifacts

The audit keeps four concerns separate:

1. `DataAttributeDefinition`: stable semantic meaning and governance behaviour.
2. `AttributeImplementationBinding`: current producers, storage, routes, consumers, tests, and runtime evidence.
3. `AttributeVocabularyDefinition`: versioned controlled terms and ontology mappings.
4. `AttributeDependencyDefinition`: typed upstream/downstream effects and invalidation behaviour.

Repository paths belong in implementation bindings, not permanent semantic definitions.

## Mandatory semantic core

Every canonical attribute records its ID, subject type, value type, family, temporal/spatial scope, provenance class, owning architectural layer, iteration model, maturity and authority behaviour, dependencies, invalidation behaviour, projection eligibility, and implementation status. Category-specific and generated audit metadata remain separate.

## Subject type system

Observations, aggregates, and semantic subjects are distinct. Generic `object_id`, `entity_id`, and `track_id` values are not interchangeable.

```text
source_interval
|- transcript_segment
|- speaker_turn
|- vad_interval
|- audio_event
|- shot
|- scene
`- presence_interval

evidence_observation
|- visual_observation
|  |- bbox_observation
|  |- face_sample
|  `- object_detection
|- audio_observation
`- linguistic_observation

visual_track != semantic_entity != narrative_agent
speaker_turn != speaker != narrative_agent
```

Bindings identify the namespace and stability rules of every subject reference.

## Independent governance dimensions

Provenance, authority, maturity, validity, review status, conflict status, and projection status are independent. An analyst-confirmed decision may become stale after an upstream change without losing historical analyst authority; invalidation changes validity/projection state and preserves traceback.

## Typed decision actions

The audit and ledger distinguish `confirm_observation`, `confirm_classification`, `confirm_assignment`, `correct_assignment`, `confirm_relation`, `confirm_interpretation`, `accept_imported_metadata`, `map_imported_metadata`, `reject_candidate`, `defer_candidate`, `merge_entities`, `split_entity`, `correct_interval`, `correct_geometry`, `supersede_interpretation`, and `adopt_preferred_term`.

Each action declares permitted subject types, scope, authority/maturity effects, invalidation, and projection behaviour. Generic `confirm` is insufficient.

## Provenance activity model

Implementation records reference reusable `ProvenanceEntity`, `ProvenanceActivity`, `ProvenanceAgent`, `TransformationEvent`, `DecisionEvent`, and `ProjectionEvent` entities.

```text
source -> extraction -> observation -> normalization -> candidate
-> analyst decision -> canonical assignment -> projection -> report/export claim
```

Human-review provenance records whether source media, metadata only, or candidate comparisons were viewed, and whether the action was individual, batch, imported, or adjudicated.

## Typed dependencies

Every edge names upstream/downstream attributes; a structural, evidential, computational, temporal, semantic, projection, or optional-enrichment type; and a change effect such as refresh, stale, recompute, review, lower maturity, traceback-only preservation, or no automatic effect.

## Vocabularies and interpretations

Controlled vocabularies require stable IDs, versioned term IDs, definitions, hierarchy, equivalents, deprecations, origin, applicable subjects/scopes, multilingual labels where needed, and an extension policy.

The inventory includes epistemic/claim status, rhetorical strategy, institutional process, evidence quality, absence/omission/silence, audience/reception, production/mediation, and analyst disagreement/adjudication.

Interpretive plurality uses versioned interpretation objects with framework, interpreter, scope, claims, supporting/counter-evidence, alternatives, commitment state, and revision lineage.

## Four empirical passes

### Pass 1: Operational core

Audit source media, time authority, transcript, BBox/ROI observations, tracks, speaker turns, shots/scenes, manual correction, Master Schema projections, and traceback.

```text
raw BBox -> visual track -> assignment candidate -> analyst correction
-> canonical decision -> backend projection -> synchronized panels
-> save/restart/reopen -> export -> traceback
```

### Pass 2: Derived analytical layers

Audit StatsKit, shot/speaker statistics, audio ratios, visual measurements, search, and reports.

### Pass 3: Interpretive systems

Audit Meaning Network, Narrative Agent, narrative lenses, SFL/dependency, themes, motives, values, significance, and relevance.

### Pass 4: Experimental and external systems

Audit SOM/similarity, music/lyrics, external metadata/providers, imports, plugins, dormant models, and planned categories.

Later passes do not block the production-critical Pass 1 gate.

## Evidence-backed status rules

- `operational`: real producer, persisted artifact, active consumer, populated runtime example, save/reopen proof, and main-path tests.
- `partial`: a real path exists but a required production, persistence, consumption, or verification stage is missing.
- `nominal`: only a type, schema, panel, label, or documentation claim exists.
- `dormant`: executable code exists but is not connected to the active flow.
- `experimental`: active research path without production governance guarantees.
- `planned`: no executable path.
- `deprecated`: compatibility/traceback only, with a replacement or removal plan.

No status is assigned from documentation alone.

## Pass 1 go/no-go gate

Ledger/projection implementation may begin only when:

1. Every BBox/ROI correction field has a definition and binding.
2. Observation, track, entity, Narrative Agent assignment, detector class, and display label are distinct.
3. Time and geometry scopes are explicit.
4. Existing correction/local-override paths are mapped.
5. Producers, persistence, consumers, runtime examples, and tests are recorded.
6. Track split/merge, timing/geometry correction, and source-replacement effects are defined.
7. Initial subjects and attributes validate against the registry schema.
8. The first projection contract is backend-resolved.
9. Candidate services cannot write mature state.
10. Correction survives save, restart, reopen, export, and traceback.

Any missing item produces `NO-GO`; missing evidence is recorded, not inferred.

## Deliverables

- Attribute Registry;
- Implementation Bindings;
- Vocabulary Registry;
- typed Dependency Graph;
- legacy-to-canonical Migration Matrix;
- runtime evidence index;
- duplicate-field and panel-local-override findings;
- status/evidence report;
- Pass 1 go/no-go decision.

## Process rules

- Discovery is read-only until a migration slice is approved.
- Raw artifacts are never rewritten by the audit.
- Secrets, personal data, and licensed material are not copied into fixtures without authorization.
- Every finding cites code, artifact/schema, runtime output, or tests.
- Unknowns remain `unknown`.
- Documentation and process maps change in the same slice as canonical contracts.
