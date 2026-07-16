# Datascene/VAA1 Native Statistics-to-Interpretation Prerequisites — Intermediary Bonus Sprint

Date: 2026-07-15
Status: proposed intermediary delivery program
Position: after the canonical architectural revamp and before the native multimodal statistics-to-interpretation implementation
Source assessment: `Stats for Delivering Implementation Plan Prerequisites.pdf`

## Outcome

Prepare the delivered canonical Datascene architecture to support a native, reproducible statistics engine whose findings can become governed propositions, interpretation candidates, stakeholder projections, and verified report claims.

This is not another architectural revamp or general inventory pass. It extends the canonical decision, invalidation, projection, authority, and traceback system committed in `04b8a52`.

## Evidence-backed current state

### Delivered and reusable

- Canonical decisions, append-only supersession, invalidation, projected claims, authority ordering, traceback, compatibility projection, and canonical write rejection.
- Consolidated 47-category empirical coverage baseline and design coverage matrix.
- Twelve operational-core Attribute Registry entries and seven operational dependency edges.
- Source-clock repair and transcript timing guards, including audio/prosody alignment protection.
- StatsKit schema, backend run persistence, frontend workbench, POS/Quant methods, source navigation, and significance/relevance surfaces.
- Meaning Network, Narrative Agent, interpretive-lens, Scene Card, second-order-label, and Boje 5B candidate surfaces.
- Mature-data proliferation, runtime-load governance, idle compute, and calm analyst-facing disclosure regime.

### Partial and unsafe to treat as complete

- StatsKit runs persist, but input acquisition remains mainly transcript/diarization/metadata based; object, scene, action, visual, and broader multimodal scope loading remains unfinished.
- Some StatsKit methods still return mock correlation or network products, and several results retain empty evidence-link collections.
- The StatsKit schema does not yet enforce input artifact versions, exclusions, uncertainty, effect sizes, proxy/readiness distinctions, or complete process manifests.
- Timing authority exists but is not proven uniformly across speaker turns, silence/VAD, actions, shots, scenes, Narrative Agent events, future findings, propositions, interpretations, and report claims.
- Vocabulary and later-operationalization registries exist, but canonical term IDs, versions, hierarchy, replacement, multilingual labels, and application bindings are incomplete.
- Interpretive lens and Boje 5B schemas exist, but there is no complete governed native-finding → proposition → interpretation → confirmation → projection round trip.
- Reporting contracts and roadmap language exist, but verified report-claim persistence and sentence-to-source proof are not yet operational.

### Not yet delivered

- Post-revamp inventory status delta and minimum interpretation-ready taxonomy profile.
- Interpretation execution graph and runtime executor.
- Formal measurement run, native finding, evidence quality, claim, proposition, relation, state-transition, interpretation, feature-projection, 5B event, report-claim, and report-run contracts.
- Governed proposition registry and comparison/state-transition services.
- Verified report-claim builder, verifier, and native prose renderer.
- Full persistence/reopen/invalidate/local-recompute/export acceptance proof for the new layers.

## Sprint rules

1. No new truth store or independent authority framework.
2. Every new object uses canonical IDs, source references, validity, maturity, revision lineage, and dependency declarations.
3. Statistical measurements remain distinct from proxies, readiness diagnostics, findings, propositions, interpretations, and report prose.
4. User confirmation is a cross-cutting authority lane, not a final-stage patch.
5. Corrections recompute affected branches and intervals only.
6. Runtime idle warming must not define scientific execution order.
7. Fluent prose cannot create evidence, promote maturity, resolve contradiction, or mutate stakeholder truth.

## Work program

### Bonus 0 — Current-state delta and bounded profile

- Produce `vaa1_post_revamp_inventory_delta_2026-07-15.md`: closed gaps, remaining partial categories, compatibility migrations, and interpretation-ready categories.
- Add `stats_interpretation_profile.json`, extending the twelve operational attributes with source/time reference, process provenance, measurement run, evidence quality, native finding, epistemic claim, proposition/relation, state transition, Narrative Agent path event, Meaning Network candidate, interpretation object, 5B event, feature projection, report claim, and report run.
- Bind every profile item to the 47-category matrix and later-operationalization registry.

Gate B0: every profile attribute has a stable ID, definition, maturity expectation, authority rule, source contract, implementation owner, and test target. Historical audits remain preserved.

### Bonus 1 — Vocabulary service and scientific execution graph

- Promote the vocabulary registry into a canonical-term service: term and vocabulary IDs/versions, hierarchy, definitions, multilingual labels, deprecation/replacement lineage, decision provenance, and lookup API.
- Bind SFL, speech acts/modality, actions/reactions, situations/events, rhetoric, values/virtues/vices, Boje 5Bs, plot lenses, and Narrative Agent concepts.
- Create `interpretation_execution_graph.json` and schema.
- Declare inputs, outputs, minimum maturity, quality gates, triggers, cache policy, invalidation dependencies, and recomputation scope.
- Separate evidential, computational, temporal, semantic, interpretive, and projection dependencies.
- Implement graph validation, cycle detection, missing-input reporting, and affected-branch planning.

Contract progress (2026-07-15): the remaining 17 categories are atomized in `docs/inventory/domain_atomic_profiles_remaining_17.json`, and their confirmed feature stages and dependencies are registered in `docs/inventory/interpretation_execution_graph.json`. Runtime execution, cycle reporting in the application, and affected-branch planning remain delivery work.

Implementation progress (2026-07-15): vocabulary resolution, governed taxonomy application, source-policy evaluation, and source-clock authority services are implemented, API-bound, and contract-tested. They remain `implemented_awaiting_runtime_probe`; see `docs/vaa1_b1_foundation_services_delivery_2026-07-15.md`.

Gate B1: term replacement reprojects labels without erasing lineage; clock/speaker corrections yield deterministic affected-stage plans without unrelated work.

### Bonus 2 — Canonical time closure and evidence quality

- Implement `evidence_quality.schema.json` separately from confidence and maturity.
- Cover audibility, visual clarity, occlusion, temporal precision, completeness, representativeness, source independence, corroboration, transcription quality, and assignment stability.
- Audit transcript rows, speaker turns, prosody, VAD/silence, audio events, visual tracks, actions, shots/scenes, and Narrative Agent events against one canonical source clock.
- Add common temporal/stale fields to measurement, finding, proposition, interpretation, projection, and report objects.
- Extend clock and scene-boundary invalidation to all new layers.

Gate B2: cross-modal fixtures prove one source clock; timing corrections invalidate only overlapping dependents; low-quality evidence stays inspectable but cannot silently become a proposition, lens, or report claim.

Delivery progress (2026-07-16): the balanced evidence-quality service, local clock-to-ledger invalidation, and affected-branch planner are implemented and live-probed. An isolated save/reopen cycle proves taxonomy and source-policy persistence without modifying user work. See `docs/vaa1_b2_balanced_evidence_quality_and_integrity_delivery_2026-07-16.md`. Full cross-modal artifact closure continues in the B3 vertical slice.

B3 progress (2026-07-16): the first reproducible native measurement vertical slice is implemented for transcript segments, acoustic speaker clusters, waveform VAD/silence, and governed scene intervals. Runs hash their inputs, identify analytical units and exclusions, preserve evidence-quality/use distinctions, persist source-traceable native findings, and attach the affected-branch plan. Legacy fabricated correlation and network outputs no longer emit results. See `docs/vaa1_b3_reproducible_native_measurement_delivery_2026-07-16.md`.

B4 progress (2026-07-16): real object, OCR, expression-sampling, prosody, and source-video shot-boundary measurements now extend the same reproducible run. The saved source has a versioned 118-shot artifact routed into Master Schema. Camera composition remains explicitly unavailable until a measured composition artifact is generated. See `docs/vaa1_b4_visual_prosody_and_shot_measurement_delivery_2026-07-16.md`.

B5 progress (2026-07-16): an append-only candidate registry now operationalizes qualified epistemic claims, analytical propositions, typed relations, supported state transitions, and immutable invalidation. Candidate services cannot write canonical truth; analyst authority remains in the decision ledger. See `docs/vaa1_b5_governed_claim_proposition_relation_transition_delivery_2026-07-16.md`.

B6 progress (2026-07-16): eligible registry records now project into Meaning Network, explicitly scoped Narrative Agent readings, and explicitly assigned Boje 5B events while retaining candidate authority, alternatives, counter-evidence, and traceback. A separate explicit analyst action adapts a selected proposition into the canonical decision ledger. The projection route has passed a non-persisting canonical-runtime probe and correctly fabricates no framework content when the saved analysis has no persisted registry. See `docs/vaa1_b6_framework_projection_and_analyst_confirmation_delivery_2026-07-16.md`.

B7 closure progress (2026-07-16): governed report claims and reproducible JSON report runs now preserve an enforced source chain from report sentence through governed analytical object and evidence reference to source location. Unlinked citations are rejected; conflicts and limitations remain visible; correction and invalidation preserve history; affected-branch planning is returned; exports embed claim hashes and traceback. The isolated full lifecycle passes. See `docs/vaa1_b7_governed_reporting_and_traceback_delivery_2026-07-16.md`.

### Bonus 3 — Reproducible native statistical runs

- Introduce `measurement_run.schema.json` and normalize existing StatsKit runs around it.
- Record method/version, analytical unit, input artifact versions, included/excluded rows, parameters, baseline/comparison scope, measurements, uncertainty, effect size, source-row lineage, limitations, proxy/readiness status, and process manifest.
- Replace mock correlation/network outputs with real implementations or mark them unavailable.
- Complete adapters for transcript, speakers, audio/prosody/silence, tracks, objects/actions, shots/scenes, metadata, Narrative Agents, and Meaning Network projections.
- Require populated evidence links for report-eligible results.
- Implement statistics normalization, salience/change detection, proposition comparison, and state-transition calculation.

Gate B3: a saved run closes, reopens, reproduces population/parameters, and traces eligible results to source. Measurements, proxies, readiness checks, and unavailable methods are structurally distinct; mocks cannot pass eligibility.

### Bonus 4 — Findings, claims, and governed propositions

- Add schemas for `native_finding`, `claim`, `analytical_proposition`, `proposition_relation`, and `state_transition`.
- Implement a proposition registry using canonical decision and revision semantics.
- Support asserted, denied, disputed, reported, alleged, hypothetical, corroborated, contradicted, verified, and unverified states.
- Retain speaker/actor, content, scope, support, counter-evidence, authority, maturity, validity, and revision lineage.
- Implement contradiction, alternative, support, temporal, causal, attribution, and comparison relations without silently resolving disagreement.
- Route analyst confirmation, revision, rejection, and alternatives through the canonical boundary.

Gate B4: competing propositions coexist with explicit relations; speaker reassignment updates attribution and dependent statistics without erasing history; evidence, finding, proposition, and interpretation remain separate objects.

### Bonus 5 — Stakeholder projections and governed 5Bs

- Add schemas for `interpretation_object`, `feature_projection`, and `boje_5b_event`.
- Complete Meaning Network bindings for candidates/mature propositions, alternatives, contradictions, stale propagation, source navigation, and write-boundary enforcement.
- Complete Narrative Agent bindings for stable subjects, assignments, merge/split, temporal presence, state/relationship transitions, multimodal routing, validity, and stale handling.
- Implement native finding → proposition → 5B candidate → analyst decision → stakeholder projection → report claim.
- Source Between from proposition comparison; Bets from future speech acts/outcomes; Becoming from state transitions; Beyond from supported alternatives, counterfactuals, or implications; Beneath from cross-modal, relational, material, or institutional discrepancy.
- Keep Beneath behind the strictest confirmation gate; absence alone is insufficient.

Gate B5: every projection traces to propositions and source evidence; reporting cannot mutate stakeholder state; disagreement survives projection.

### Bonus 6 — Verified report claims and persistence proof

- Add `report_claim.schema.json` and `report_run.schema.json`.
- Implement report-claim builder, verifier, native prose renderer, and citation assembler.
- Enforce claim-level citations, mature/candidate/conflicting separation, counter-evidence visibility, revision lineage, and source verification.
- Permit selection, ordering, joining, and explanation of verified claims only.
- Prevent reporting from inventing propositions, resolving contradictions, promoting maturity, suppressing counter-evidence, or writing stakeholder state.
- Extend invalidation/persistence through findings, propositions, interpretations, projections, claims, paragraphs, and sections.
- Prove: compute → save → close → reopen → inspect → correct → invalidate → recompute affected branch → export → trace report sentence to source.

Gate B6 / exit: report sentences trace through claims, propositions, findings/runs, evidence quality, and source rows; corrections preserve history and recompute locally; exports distinguish verified, candidate, conflicting, limited, and analyst-authored material; all schemas and restart tests pass.

## Required artifacts

1. `stats_interpretation_profile.json`
2. `interpretation_execution_graph.json` and schema
3. `measurement_run.schema.json`
4. `native_finding.schema.json`
5. `evidence_quality.schema.json`
6. `claim.schema.json`
7. `analytical_proposition.schema.json`
8. `proposition_relation.schema.json`
9. `state_transition.schema.json`
10. `interpretation_object.schema.json`
11. `boje_5b_event.schema.json`
12. `feature_projection.schema.json`
13. `report_claim.schema.json`
14. `report_run.schema.json`
15. Post-revamp delta, fixtures, validators, and end-to-end persistence report

## Delivery order and non-goals

Order: `B0 → B1 → B2 → B3 → B4 → B5 → B6`.

B0–B2 are hard prerequisites for cross-signal statistics. B3 is the first native statistics-engine delivery. B4 is the missing evidence-to-interpretation bridge. B5 and B6 must not precede governed propositions.

Non-goals: no new general inventory, authority architecture, agent framework, separate Boje truth engine, raw-detection-to-report shortcut, exhaustive 47-category operationalization before the vertical slice, or dashboard expansion beyond quiet operational review and source inspection.
