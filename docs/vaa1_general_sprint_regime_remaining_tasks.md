# VAA1 General Sprint Regime: Operational Evidence and Analysis Core

Date: 2026-05-25
Current delivery sequence updated: 2026-09-22
Embedded-contract activation register updated: 2026-09-29

This is the consolidated remaining sprint map. It keeps the interpretive features, maturity regime, governance, packaging, and release-readiness work in one place so no major track quietly falls off the board.

## Current Development Period: Operational Evidence and Analysis Core

The next development period is **Operational Evidence and Analysis Core**.

The empirical taxonomy audit and canonical architecture are existing foundations. Begin with a bounded inventory delta and verification of the dependencies needed by the next delivery; do not restart completed foundational sprints. The stepwise sequence below governs remaining delivery.

**Governing Document:**
-   `docs/sprint_program_empirical_taxonomy_discovery_2026-07-12.md`

Historical gate status (2026-07-15; not a blanket certification of the current worktree): **Canonical architecture `GO — OPERATIONAL`**. The registry is schema-validated; governed compatibility writes synchronize atomically into an append-only decision ledger; candidate writers are proposal-only; dependency invalidation and shared projection are operational; Video, Meaning Network, and Master Schema consume canonical projections; and a validation copy of real saved work proves persistence and traceback. See `docs/vaa1_canonical_architectural_revamp_delivery_2026-07-15.md` and `docs/inventory/pass_1_gate.json`.

## Governing delivery sequence — 2026-09-22

Deliver foundations before the capabilities that consume them. Each stage must produce a reusable operational benefit and evidence that its downstream contract works. A schema, an endpoint, or a successful isolated unit test alone does not close a stage. Existing delivered work is reused and verified; only its missing contracts and regressions are scheduled.

The stages below are the delivery order. The numbered domain sections later in this document remain the detailed requirements catalogue and retain their stable numbers for existing references. Their numerical order is no longer the sprint order. The prerequisite bonus program is subordinate to this schedule for remaining work. No stage is declared complete by this planning revision.

| Stage | Delivery and immediate benefit | Depends on | Unlocks |
|---|---|---|---|
| 0 | Establish the current baseline, stable source identity, and minimum safeguards; preserve saved work and know what actually needs repair. | Existing startup, inventory and saved evidence | A bounded and testable foundation pass |
| 1 | Make the global source-clock contract work across all active temporal features; one source selection means the same instant everywhere. | 0 | Reliable alignment, scoped corrections and temporal dependencies |
| 2 | Close canonical decisions, invalidation, persistence and shared retrieval; a correction survives and has one accepted meaning everywhere. | 1 | Safe evidence refresh and synchronized consumer projections |
| 3 | Stabilize versioned evidence layers, vocabulary and quality contracts; consumers receive real, traceable inputs. | 2 | Dependable navigation, measurements and candidate generation |
| 4 | Complete hydration and bidirectional evidence navigation; the analyst can inspect and correct what has been computed. | 3 | Trustworthy workbenches and end-to-end analytical review |
| 5 | Deliver reproducible StatsKit measurements and comparisons; analytical results have defined populations and methods. | 4 | Findings, diagnostic coverage and supported propositions |
| 6 | Calibrate Narrative Agent continuity and governed graph assembly; already-recognized agents gain defensible trajectories. | 4, relevant measurements from 5 | Source-supported paths and cross-agent narrative interpretation |
| 7 | Complete interpretation and candidate-consumer workflows; automated deductions are visible and reviewable before maturity. | Relevant evidence, measurement and agent/graph gates from 3–6 | Governed analytical assertions and report-ready selections |
| 8 | Complete publication and portable project round trips; accepted work travels with its evidence and history. | 2–7 for each included feature | Reproducible per-video and project editions |
| 9 | Complete release qualification and packaging; the tested product works outside the development workspace. | All included stages, or explicit optional-feature deferrals | Release candidate and #0.1 packaging |

### Current execution checkpoint — 2026-09-22

Baseline captured for the first source-clock increment, with saved correction/decision/metadata snapshots and current test results. Stage 1 is in progress: shared transcript normalization no longer guesses milliseconds from values above 1,000 seconds; precise formatting/parsing and timing-status preservation now have behavioral regression tests. Fifteen focused tests, TypeScript and two rendered hydration checks pass. The broader frontend suite still has ten unresolved failures. Full source isolation, revision/invalidation, long-source navigation and consumer coverage gates remain open; no dependent stage is declared unlocked. Evidence: [source-clock sprint audit](audits/source_clock_2026-09-22/README.md).

Backend follow-up: numeric validation and analysis/source isolation are now implemented and live-probed after a documented restart. Forty-four focused behavioral/ledger/timing tests pass; two additional legacy API source-inspection checks remain unresolved. Clock revision/fingerprint binding and the full restoration/consumer matrix remain open. See the same sprint audit for scope and compatibility limits.

The remaining frontend/backend clock delivery and sequential manual acceptance gates are maintained in [Source-clock delivery and manual gates](source_clock_delivery_and_manual_gates_2026-09-22.md). Expressions now shares precise clock formatting. The legacy API contract checks have been repaired to inspect the actual handler and its durable Master Schema refresh; their previous discovery errors are resolved. Stage 1 remains open.

Further clock delivery: explicit units now replace magnitude guessing in scene/interpretive consumers, precise display consumers share formatting, and production timeline publishers enforce active-analysis ownership through a scoped envelope and numeric compatibility bridge. Backend explicit corrections reject invalid bounds and invalidation flags require booleans. Source revision/fingerprint binding and manual acceptance remain open; see the linked clock checklist for the exact boundary.

Revision-binding checkpoint (2026-09-23): source-clock resolution now uses actual content fingerprints and deterministic timebase revisions; stale bindings are rejected, legacy scopes stay explicitly unversioned, and invalidation events preserve the bound scope. Isolated handler/writer/loader tests prove append-only invalidation and ledger reopening. General correction-save concurrency, consumer revision adoption and project restoration remain open. See the [revision-binding audit](audits/source_clock_2026-09-23/README.md).

Correction-save robustness (2026-09-23): canonical sidecar clock reads and read-time offset guards now protect both correction-save routes, with queued dashboard conflict tests and corrupt-file refusal. This advances C3 without claiming cross-process atomicity or full source-revision adoption by editors. [Evidence and remaining limits](audits/source_clock_2026-09-23/correction-save-robustness.md).

Shared writer checkpoint (2026-09-23): dashboard/backend correction saves and export refreshes use one per-analysis lock before checking and committing. Read isolation prevents correction GET from replacing in-flight writer memory. Node/Python contention, exception release and crash-abandonment tests pass; all other write domains and full editor revision binding remain open. [Coordination and recovery](audits/source_clock_2026-09-23/shared-write-coordination.md).

### Stage 0 — Verify the baseline without restarting completed work

Record the current branch/worktree, dependency environment, representative saved analyses and known failing checks. Distinguish delivered, operational-but-unverified, partial, dormant and deferred features. Use the August completeness/parity delivery and September hydration fixes as historical evidence, then verify the relevant current behavior. Preserve unrelated local work and analyst corrections.

Resolve stable project, source, analysis-run and artifact-version identities before changing clock references. Reuse the existing ledger's minimum write, revision and rollback mechanisms for clock corrections; do not defer safe clock persistence until stage 2. Identify missing foundational protections and fix those within this bounded prerequisite. Establish a regression fixture set and recovery snapshot, not another exhaustive ontology exercise.

Gate: the selected baseline is reproducible, source identity is unambiguous, existing corrections are recoverable, and the next stage's exact failing cases and acceptance checks are recorded.

### Stage 1 — Global clock first

“Global clock” means one program-wide source-time contract and authority resolver, not one wall-clock timestamp shared by unrelated videos. Each source retains its own `source_media.clock`, origin, duration, precision and revision. Cross-source alignment is an explicit mapping. Seconds are the interchange unit; `m:ss.mmm` is the precise analyst display. Frames, sample offsets and milliseconds convert through explicit adapters using the actual source metadata.

Apply this contract to every active temporal producer, stored anchor, consumer and navigation event: Video, Transcript, Audio, Objects, OCR, Expressions, POS, Quant, Scene Cards, Narrative Agent, Meaning Network/Plot, Master Schema, Data Maturation, Search, StatsKit, Traceback and report/export adapters. Non-temporal records are explicitly not applicable. Dormant/future features cannot activate until their clock adapter passes the same contract. Do not replace source-relative time with playback position or a panel-local offset.

Preserve the timing-authority hierarchy and distinguish measured, verified, corrected, candidate, inherited and degraded timing. Verify the canonical decision and targeted invalidation path for a clock correction now. Local interval corrections affect overlapping/dependent evidence; source replacement, a changed timebase or a global mapping change must invalidate every affected dependency, even outside the originally selected interval. Preserve unaffected records and historical evidence.

Gate: a coverage matrix has no unclassified active temporal consumer; round-trip seek and display agree within declared source precision; frame/sample conversions and edited intervals pass; clock revision survives restart and export/reimport; stale dependents are identified; unrelated source clocks remain isolated. Existing consumers are fixed to meet this contract before new clock-dependent capabilities are delivered.

### Stage 2 — One accepted state, durable decisions and shared retrieval

Extend the verified clock-decision path into consistent authority, identity, evidence-version and dependency handling for other corrections. Close append-only confirmation/correction/rejection, explicit supersession, alternatives, idempotent retries and concurrent-edit behavior. A trusted analyst command establishes authority; candidate payloads cannot declare themselves mature.

Expose one versioned accepted-state projection coordinated through Master Schema, alongside clearly identified candidate and historical views. Consumers may cache these views but cannot create independent authority stores. Persist before broadcasting changes. Rebuild projections after interruption or restart and prevent stale responses from replacing newer selections. Register dependency edges and versioned vocabulary contracts before downstream consumers rely on them.

Gate: a real correction propagates to all applicable existing consumers, survives reopen, invalidates affected derived records and preserves alternatives and unrelated annotations. Verify a minimal export/import fixture here rather than postponing data-loss detection to stage 8. No feature may require a second local confirmation of an already-valid canonical decision.

### Stage 3 — Reliable evidence and explicit capability boundaries

Consolidate persisted transcript, shot, VAD, diarization, audio-event/prosody/sample-cloud, object/OCR/expression, scene, visual-measurement and SFL/dependency layers under the shared contracts. Reuse valid artifacts before computing replacements. Register method/provider versions, effective settings, quality, missingness and artifact dependencies. Keep scene and shot boundaries distinct, VAD separate from transcript timing authority, and speaker-turn candidates separate from confirmed agent attribution.

Finish provider selection and disabled/fallback behavior before adding any new detector, licensed tool or remote dependency. Optional music, lyrics and acquisition features remain explicitly deferred unless necessary for the agreed evidence-core use case. Existing observations must remain usable when an optional provider is unavailable.

Gate: included layers have canonical artifacts, versioned lineage, matching hydrated counts, known consumer routes and correct invalidation behavior. Missing or degraded inputs are typed states, never fabricated measurements. The existing completeness manifest is reused and strengthened where needed, not rebuilt as a new parallel registry.

### Stage 4 — Inspectable evidence and reciprocal navigation

Finish the shared loading and selection behavior across existing panels before adding more analytical surfaces. Opening a panel late must recover the current analysis. Saved evidence loads independently of video-blob availability, stale requests cannot overwrite current work, and errors differ from legitimate empty results.

Prove “raised here, navigable here”: a leaf keeps its active record, expansion, filter and scroll context while Video seeks or highlights the same source anchor in support. Reverse selection recovers that record without loops, duplicate leaves or unsolicited focus transfer. Correction and review remain local through Datascene controls. Traceback and quality review expose actionable evidence rather than empty destinations.

Gate: rendered tests exercise the named consumer matrix, including load/reopen, seek/highlight, correction, missing media and failed retrieval. Extend the September regression fixtures. Use focused manual testing only for gestures or research interpretation that automation does not establish, and record it as a gate rather than assuming it passed.

### Stage 5 — Reproducible measurements before stronger interpretation

Complete StatsKit and comparison workflows using versioned real layers. Every run records input snapshots, unit of analysis, population, inclusion/exclusion, missingness, nesting, method, parameters, uncertainty and output lineage. Vocabulary and execution-graph dependencies must already be operational for the variables being delivered.

Separate exploratory candidate measures from accepted-evidence measures and label their denominators. Feed findings, significance/relevance diagnostics and subsequent propositions with explicit scope and quality. A missing layer remains not computed; a proxy is identified as a proxy.

Gate: the same input versions reproduce results, a correction triggers only the necessary recomputation, and results navigate to their source population. Save/reopen and a minimal export fixture preserve method and input versions.

### Stage 6 — Agent continuity and graph assembly

Build on already-governed agent references; tracking does not decide who a person is. Record effective tracker settings, calibrate false joins, fragmentation and boundary leakage, and present proposed collection membership and gaps. Membership edits preserve each source occurrence. Confirmed collections project through the same canonical path.

Complete graph editing, presence timelines, focused agent-storyline navigation and source-linked forensic renders. Coverage diagnostics depend on the valid denominators and quality rules from stage 5; where no defensible external benchmark exists, use explicitly scoped within-source diagnostics.

Gate: accepted continuity survives scene boundaries, correction, reopen and export; unsupported joins remain candidates; graph and agent projections agree with their member evidence. Navigation widgets can be repaired earlier in stage 4, but semantic continuity cannot be claimed before this gate.

### Stage 7 — Reviewable deductions, then accepted interpretation

Connect eligible findings, propositions, relations, scene/agent paths, SFL and existing plot/Boje 5B readings. Automated deductions must be available for analyst inspection before confirmation, with evidence, theoretical warrant, alternatives, uncertainty and producer provenance. Candidate graph edges, profile suggestions and exploratory consumers retain their status through reuse. Confirmation does not automatically confirm a downstream deduction.

Enable only the consumers whose prerequisites are satisfied. Qualitative analyst-led readings need valid evidence and navigation; they do not need an unrelated statistical metric or an irrelevant agent track. If a reading depends on a measurement or continuity claim, its specific stage 5 or 6 gate is mandatory. Preserve that distinction in the execution graph rather than imposing artificial dependencies.

The Goffmanian, Morenoan and Latourian package remains an offline draft-contract delivery, not a runtime feature. Its integration is a separately selected future scope at this stage and must pass the reader's outstanding authorization, assertion-identity, invalidation and UI gates before activation.

Gate: candidate surfacing, independent alternatives, explicit analyst decision, corrected projection and dependency invalidation work across the selected consumers. No theoretical assertion matures through confidence, repetition or visualization alone.

### Stage 8 — Publication and portability as a complete workflow

Complete per-video and whole-project Data Books, report claims, useful download groupings and source-chain manifests. Recheck eligibility and freshness at export time. Preserve clock/source identity, analysis versions, accepted decisions, candidate/history distinctions, restrictions and checksums. A project edition declares aggregation rules and never flattens incompatible clocks or versions.

Gate: export a representative project, restore it into an isolated workspace, recover evidence and decisions, and reproduce the included analytical outputs. Current mature claims exclude stale or unaccepted assertions; clearly provisional audit material remains distinguishable. Earlier stages already exercise basic round trips; this stage closes the integrated publication experience.

### Stage 9 — Release qualification and scoped Git delivery

Complete capability activation, data-location/consent disclosure, dependency parity, resource/performance budgets, recovery and installation behavior in the packaged environment. Test core local operation with optional APIs disabled. Review local changes by coherent scope and deliver verified software with truthful limitations; do not bulk-stage unrelated presentation material or experiments.

Gate: required automated suites and representative packaged workflows pass, outstanding manual acceptance is recorded, and optional deferrals are explicit. A missing foundational clock, decision or persistence gate cannot be waived while dependent features are presented as operational.

### Continuous obligations and bounded side work

Observability and maturation economics begin at stage 0 and accompany every stage: execution time, responsiveness, storage, cache/reuse, candidate/review/confirmed yield and analyst effort. They are not postponed to release. Stage 9 verifies accumulated coverage and budgets rather than installing instrumentation for the first time.

Source ownership, consent/data location and optional-provider activation are enforced before the relevant import, provider execution, transfer or export. Packaging can refine their UX later; it cannot retroactively supply a missing permission boundary. The Quality Agent audits throughout without overwriting accepted data.

CVAT round-trip work may proceed as an optional branch after stages 1–3 and the transfer-policy gate, using stage 4 navigation and canonical import decisions. It must pass isolated source/time/geometry/task-identity and duplicate-import tests before activation. It need not block unrelated core analysis if explicitly deferred. New web/disc/stream acquisition and dormant music/lyrics capabilities follow the same rule: contract work may occur independently, but operational delivery waits for the dependencies it actually consumes.

### Embedded-contract activation register — 2026-09-29

This register is an activation notice, not an activation claim. A design document,
JSON Schema, validator, API preflight, isolated backend service or contract test is
an embedded foundation. A capability becomes operational only after its producer,
durable storage, canonical authority/invalidation path, consumer UI, source
navigation, save/reopen behavior, export behavior and applicable manual acceptance
have passed the stage gates above. Activation must be explicit, bounded by source
policy and optional-provider controls, and recorded in this register with evidence.

| Embedded contract or documentation family | Embedded state on 2026-09-29 | Operationalization still required | Governing stage / activation evidence |
|---|---|---|---|
| **Golden Retriever acquisition service 1.0** — [schema and boundary](schemas/golden_retriever/README.md), [assessment](audits/golden_retriever_2026-09-29/assessment.md) | The supplied design and schema are preserved; Draft 2020-12 plus cross-record semantic validation and a non-persisting validation endpoint are embedded. **Validation boundary active; acquisition service not activated.** | Implement only selected connectors; bind source policy, consent, secrets, quarantine, budgets and checkpoints; persist envelopes; expose review/navigation; prove canonical admission and reproducible export. Authenticated access, crawling, databases and remote transfer remain off until separately authorized and tested. | Optional 10A branch after stages 1–3 and the transfer-policy gate; stages 4 and 8 for workbench and publication. Activation evidence must include a local/upload vertical slice before any network connector. |
| **Goffmanian, Morenoan and Latourian relational lenses 1.1** — [package](schemas/relational_lenses/README.md), [design reader](datascene_relational_lenses_design_reader_2026-09-16.md) | Corrected schemas, shared definitions, examples, offline semantic checks and contract tests are embedded. **Offline draft; no application runtime producer or authority.** | Bind assertion identity and producer provenance to the canonical decision ledger; implement invalidation, source navigation, review UI, persistence and export; complete the reader's authorization and ethics gates. | Stage 7 after the evidence dependencies each reading actually uses; stage 8 for publication. |
| **Narrative, Meaning/Plot, Boje 5B, character-path and SFL interpretation designs** — `docs/vaa1_interpretive_lens_schema_and_sprint_v1.json`, `docs/VAA1_Bojean_Antenarrative_5B_Genre_Traceability_Schema.json`, [Narrative Agent contract](vaa1_narrative_agent_characteristics_schema_and_proliferation_contract_2026-06-11.md), and domain sections 2–6 | Schemas, lexicons, candidate builders and selected projections are embedded. **Mixed partial/nominal state; schema coverage is broader than validated interpretation workflows.** | Establish eligible evidence inputs and theoretical warrants per construct; calibrate candidate generation; preserve alternatives; bind analyst decisions and invalidation; prove source navigation, correction, reopen and report eligibility without promoting computational labels as validated measurements. | Stages 3, 4, 6 and 7 according to each interpretation's actual dependencies; stage 8 for publication. Activate construct by construct, not as one lens bundle. |
| **StatsKit, research-question and statistical-interpretation contracts** — [StatsKit status](vaa1_statskit_1_0_delivery_2026-07-16.md), [operationalization plan](vaa1_statskit_governed_interpretation_operationalization_plan_2026-08-01.md) | Schemas and bounded native measurement/interpretation services exist, but taxonomy visibility exceeds demonstrated runtime coverage. **Partial; only individually evidenced motors and artifacts are operational.** | Complete real-layer loading, missingness and population contracts, source-linked persisted results, correction-triggered recomputation, workbench review, visualization, save/reopen and governed report selection. Keep unsupported rows `not computed`. | Stage 5, then stage 7 for propositions and stage 8 for publication. Evidence is motor-specific, not a blanket StatsKit activation. |
| **Data Book, governed-report and portable-publication contracts** — [publication operation](data_book_publication_operation_2026-08-02.md) and `docs/schemas/Datascene Data Book Publication Schema v1.0.0.json` | Backend publication builders, schemas and focused tests are embedded. **Partial workflow; not a complete analyst-facing publication activation.** | Prove selection through report review, source return, privacy/rights revalidation, edition integrity, project export, isolated restore and reproducibility across representative analyses. | Stage 8; release claims require the complete export/restore gate rather than builder tests alone. |
| **Mature-data proliferation and economics/observability contracts** — [delivery readout](vaa1_mature_data_proliferation_delivery_readout_2026-06-10.md), schemas under `docs/schemas/vaa1_mature_data_proliferation_*`, `vaa1.data_maturation_economics.schema.json` and `vaa1.performance_observability_layer.schema.json` | Decision-ledger, matcher, live-bus and selected observability/economics slices exist. **Partial; the full cross-modal cultivation and cost/yield regime is not operational.** | Complete source-sample creation, calibrated review queues, rejected/deferred/orphan accounting, cross-consumer invalidation, analyst-time and resource capture, diminishing-return rules, UI visibility and export. | Continuous stages 0–9 and domain sections 1/8A; activation is surface- and metric-specific. |
| **Datascene Search and entity-registry contracts** — `docs/schemas/vaa1.datascene_content_search.schema.json` and `vaa1.datascene_entity_registry.schema.json` | Schemas and partial frontend/backend search surfaces are embedded. **Partial; active route, index/version and complete result-to-source behavior are not certified.** | Establish canonical index identity and freshness, entity/source authority, active backend routing, stable hydration, reciprocal navigation, access filtering and export behavior. | Stages 3–4; stage 8 for portable indexes/results where included. |
| **Annotation Master Schema and CVAT/native annotation protocols** — [exchange protocol](vaa1_cvat_annotation_exchange_protocol_2026-04-11.md), `docs/schemas/vaa1_annotation_master_schema_v1.schema.json` | Schema, examples, native correction paths and portions of CVAT integration are embedded. **Native governed slices are operational; full external round trip remains partial.** | Prove task identity, geometry/time/source isolation, duplicate-safe import, analyst authority, correction history, policy-controlled transfer, navigation, reopen and export. | Optional domain 11 after stages 1–3; stage 4 interaction gate and stage 8 round trip. |
| **Audio/visual sample-cloud and dormant media-analysis contracts** — `docs/schemas/vaa1.audio_sample_data_cloud.schema.json`, `vaa1.visual_sample_data_cloud.schema.json`, and domain 7C | Audio sample-cloud and selected audio-analysis slices have implementations/tests; visual sample and music/lyrics breadth remains uneven. **Mixed partial/dormant state.** | Register providers and clocks, persist source-linked samples, demonstrate consumer use, corrections/invalidation, missing-provider behavior and reporting. Activate each modality independently. | Stages 3–5 and sections 7A–7C; no family-wide activation from one passing provider. |

The register covers the known embedded-but-incomplete contract families that can
otherwise be mistaken for product capabilities. Lower-level schemas supporting an
already active service remain governed by that service's own tests and gate record;
their mere presence is not listed again. Any newly embedded schema or design must be
added here, linked to an owner and stage, and default to `draft`, `validation-only`,
`partial` or `dormant` until operational evidence changes its state.

### Repeatable delivery rhythm

For each stage or bounded increment: state the reusable benefit and prerequisites; inspect the existing implementation; close the smallest complete cross-consumer gap; run focused contracts and rendered tests; exercise correction/reopen/invalidation and relevant export fixtures; record evidence, costs and limitations; then update the gate and make the scoped change ready for delivery. Manual acceptance remains explicit where required. Do not substitute a list of new interfaces for a demonstrated workflow.

Maintain a gate record with scope, prerequisite versions, test evidence, unresolved failures, optional deferrals and newly unlocked consumers. Regression of a prerequisite blocks further delivery of its dependents until repaired. Independent documentation, contract tests and diagnostics may proceed without claiming those dependents operational.

Requirement mapping: stage 1 covers the linked-time invariant; stage 2 covers domain 1 and canonical parts of 8; stage 3 covers domain 7/7A/7B, prerequisites of 6, and provider gates of 9/10/10A; stage 4 covers navigation/hydration in 1–8 and 12; stage 5 covers native-statistics prerequisites and evidence-backed diagnostics; stage 6 covers domains 2/2.1 and graph continuity/rendering in 4; stage 7 covers interpretation in 3/5/6; stage 8 covers 10B and governed publication; stage 9 covers 13/14/14A. Domain 8A and testing in 12 apply throughout. CVAT (11), music/lyrics (7C) and acquisition expansion (10A) remain bounded optional branches unless explicitly selected as release requirements.

## Intermediary Bonus Sprint: Native Statistics-to-Interpretation Prerequisites

Before implementing the full native multimodal statistics-to-interpretation engine, complete the gated intermediary program in `docs/sprint_program_native_stats_interpretation_prerequisites_bonus_2026-07-15.md`.

The bonus sprint defines the following prerequisite families. Their remaining work is scheduled by the 2026-09-22 dependency sequence below; this older enumeration is not a competing delivery order:

1. Post-revamp inventory delta and a bounded interpretation-ready attribute profile.
2. Versioned vocabulary service and a scientific execution graph distinct from runtime/idle scheduling.
3. Canonical source-clock closure and evidence-quality contracts.
4. Reproducible multimodal measurement runs with no report-eligible mock outputs.
5. Governed findings, epistemic claims, propositions, relations, and state transitions.
6. Traceable Meaning Network, Narrative Agent, and Boje 5B projections.
7. Verified report claims and full save/reopen/correct/invalidate/recompute/export proof.

Program-wide source-clock invariant (2026-07-18): all source-timed UI surfaces, navigation events, evidence records, and projections must identify `source_media.clock`; seconds are the canonical interchange unit and `m:ss.mmm` is the shared precise analyst display. A timestamp is not authoritative merely because it is numeric. Its interval must carry a recognized timing status and resolve through the operational source-clock authority hierarchy. Explicit user correction outranks verified anchors, measured timing, candidates, inherited timing, and degraded estimates. Timing changes may invalidate only overlapping dependents. Video and Maturation now share the same frontend formatter, canonical clock identity, and non-mutating authority-resolution boundary; remaining panel-local time formatters are migration debt under this invariant and may not define independent clock authority.

This is a prerequisite sprint, not a replacement architecture or an exhaustive new inventory. The existing canonical decision, authority, projection, invalidation, and traceback regime remains binding throughout.

Its scope is restricted to the work required to prove Datascene as a controlled evidence system:

1. Complete the linked-time regime.
2. Stop correction and annotation bleed.
3. Implement the minimum canonical proliferation ledger.
4. Stabilize persisted shot, VAD, and speaker-turn layers.
5. Make Stats Comparison Studio consume those real layers.
6. Prove correction, traceback, save/reopen, and export.
7. Instrument performance and maturation costs under the hood.
8. Classify every remaining feature as operational, partial, dormant, or deferred.

The greatest strategic gain in this period comes from demonstrating that Datascene is no longer merely a collection of promising analytical features. It is a controlled evidence system in which professional interpretations remain inspectable, correctable, reproducible, and linked to their audiovisual source.

Scope discipline:

- Work outside this evidence-core list is deferred unless it directly removes risk from one of the eight period objectives.
- UI promises must map to persisted, source-linked records or be labeled partial, dormant, or deferred.
- New analytical surfaces must consume governed evidence layers rather than private panel-local approximations.
- The sprint is complete only when correction, traceback, save/reopen, export, and performance/maturation instrumentation can be demonstrated on real persisted layers.

## Non-Droppable Release Tracks

Four tracks must remain visible in every sprint review and release-readiness discussion:

1. **Mature Data Proliferation Regime.** Confirmed analyst work may proliferate as mature data only through governed source anchors, authority state, maturity state, projection targets, traceback, and canonical saved decisions. Candidates, near matches, raw detections, model suggestions, and inferred graph matches must remain reviewable until confirmed.
2. **Licensed software optionality and user activation.** FFmpeg, YOLOv8/Ultralytics, licensed scripts, optional APIs, remote providers, premium tools, and external services must be detected, explained, activated by explicit user choice, and recorded in traceback. Release must include alternatives, disabled-state workflows, or explicit deferrals for license-sensitive dependencies.
3. **Performance observability.** Uploading, quick sweeps, science scan, forensic scan, data maturation/iteration, manual program use, export, and UI rendering must write developer-facing observability records under the hood. This is not an analyst panel. It is a full internal view for developers, with later product work deciding what subset, if any, should be shared externally.
4. **Data maturation economics.** Datascene must understand the cost, yield, reuse, waste, and diminishing returns of each maturation and iteration pass. Runtime success is not enough; the program must know whether a pass created mature, source-linked value worth the compute, storage, and analyst attention it consumed.

These tracks are not polish. They are release gates.

Cross-cutting timing authority rule added 2026-07-08:

- Transcript, audio, POS, Quant, StatsKit, Meaning Network, Narrative Agent, Search, reports, and Traceback may not silently promote scaffold or degraded timing as mature source truth.
- The most mature timing source wins: explicit analyst timing correction and source-verified anchors outrank raw transcript clocks; measured VAD can support speech timing; diarization speaker labels remain candidate until source-linked and confirmed.
- Partial repair must remain visible as partial. For example, the Bond trailer scaffold-clock repair anchors `Why would I betray you?` at about `6.400s` and `The world is arming faster than we can respond.` at the measured VAD window `20.960-22.215s`, but the artifact remains `partially_repaired` until remaining coverage gaps are verified.
- Any derived artifact rebuilt from repaired timing must carry timing repair status so professional workbenches can distinguish `anchor_verified`, `vad_anchor_verified`, candidate, inherited, degraded, and mature evidence.

RCA:

- `docs/vaa1_transcript_audio_master_clock_rca_2026-07-08.md`

Relevant contracts:

- `docs/schemas/vaa1.performance_observability_layer.schema.json`
- `docs/schemas/vaa1.data_maturation_economics.schema.json`

## 1. Data maturity proliferation regime

- Implement the Master Schema-first mature-data proliferation spine.
- Enforce confirm-once, project-everywhere authority: one valid user confirmation in any panel writes one canonical governed decision that every applicable panel, graph, timeline, scene, search surface, report, export, and traceback view must consume without asking the analyst to reconfirm it locally.
- A downstream surface must not omit, downgrade, or replace a canonical user confirmation with detector output merely because its local cache or panel-specific model has not produced the same result. Only explicit user correction, rejection, merge, split, or governed invalidation may supersede it.
- Keep the Master Schema as the canonical maturity anchor. BBox/ROI hubs, Meaning Network node/edge sheets, Narrative Agent leaves, scene cards, reports, and related panels should render synchronized projections from that anchor rather than competing local truth.
- Treat explicit user corrections as the highest authority across the loop. A user-corrected time, label, coordinate, dimension, storyline, node meaning, edge meaning, or presence interval can only be superseded by another explicit user correction.
- Every mature-data feedback event should carry source anchors, maturity state, authority level, correction provenance, affected panels, and traceback so panels can refresh coherently.
- Persist every proliferation decision in a canonical ledger before any local panel installs a projection or label override.
- Require confirmed decisions to carry source traceback refs, source anchors/evidence refs, projection targets, source panel, source verification status, and source-range provenance.
- Allow only confirmed decisions to create mature propagation targets such as `proliferates_to` or mature label correction rules.
- Ledger canceled, deferred, inspected, weak, or unresolved candidates without mature propagation targets.
- Surface near matches in BBox/ROI and relevant panels as `to_be_confirmed_or_canceled` candidates.
- Keep probability thresholds openly weighted and configurable.
- Allow proliferation only from manual confirmation/correction or very high probability with source anchors and traceback.
- Add situational mirror candidates for similar situations, but keep them review-only until confirmed.
- Prevent raw or unknown detections from overriding mature Narrative Agent, object, scene, or report claims.
- Add governance objects with source anchors, evidence refs, maturity state, authority level, projection targets, and audit status.
- Add regression coverage proving confirmation-only propagation, source-linked traceback, projection targets, and canonical-save persistence.
- Operationalize the **saloon doors swing both ways principle** between Video correction/evidence entries and every source-linked leaf panel. Either entrance must promptly focus, select, seek and highlight the same canonical record in the other surface. Use canonical evidence/decision ids, source-tagged correlation ids and retained current-analysis state; prevent event loops, duplicate Video leaves, duplicate saves and panel-local navigation truth.
- Enforce **raised here, navigable here** for every leaf indication. Reciprocal synchronization may prepare or update Video and other consumers, but the originating leaf retains focus, selection, scroll, filters, queue position, disclosures and drafts until the analyst explicitly chooses a named cross-panel transfer. Every indication must remain locally understandable and actionable; automatic panel jumping is not an acceptable substitute for leaf functionality.

Acceptance:

- Corrected data appears corrected everywhere except traceback.
- Candidates remain candidates until confirmed.
- Raw substrate remains inspectable but cannot become active semantic truth.
- Every mature claim can explain source, time, maturity, authority, projection target, and traceback.
- The UI does not install local mature projections until the backend has returned a saved proliferation decision.
- Video-to-leaf and leaf-to-Video navigation both surface the same saved correction and source context after reload and project reopen.
- Leaf-raised indications remain navigable in their originating panel while reciprocal surfaces synchronize without stealing focus or resetting local work.

## 2. Narrative Agent and character-path operationalization

- Keep Character Paths primarily in the Narrative Agent surface.
- Make scene presence, character-by-scene, dramatic archetype, participant ranking, and Narrative Agent path views navigable.
- Ensure every character-path claim points to source evidence, scene anchors, and maturity state.
- Surface recognized character paths as their own Narrative Agent leaves with timelines, summaries, source anchors, maturity state, and traceback.
- Feed Character/Path Meaning schemas from proliferated mature data, including analyst-confirmed BBox/ROI, Meaning Network presence intervals, transcript/speaker links, scene anchors, object relations, prosody, and manual annotations.
- Treat the Narrative Agent panel as the home for character/path meaning once narrative-structure support is working, not merely as a list of recognized names.
- Open specific Narrative Agent storylines as focused panels or leaves from node/edge sheets; do not use double-click on a graph node/edge to send the analyst to the general Narrative Agent(s) overview.
- Propagate analyst renames, confirmations, merges, splits, rejections, and drops across video, audio, transcript, scene cards, reports, search, and evidence graph.
- Add a governed Narrative Agent coverage anomaly probe/radar. Compare observed character coverage across scenes, source time, speech, visual presence, relations, and evidence nodes with genre-, format-, duration-, and narrative-role-aware benchmark distributions.
- Treat benchmark results as diagnostic questions, not semantic truth. For example: `If this is the main protagonist, why does confirmed evidence surface in only 3 of 6 scenes?`
- Expose the benchmark cohort, sample size, expected range, deviation, denominator, evidence quality/maturity, and known source-layer gaps behind every alert.
- Let alerts initiate bounded check-ups for missing detections, identity matching, scene exclusions, or role verification. Check-ups must remain source-linked, observable, cost/yield recorded, and candidate-only until analyst review.
- Never infer protagonist status from frequency alone, manufacture missing presence nodes, or automatically promote anomalous candidates. Fall back to within-video proportional checks when no defensible benchmark cohort exists.

### 2.1 Narrative Agent tracking calibration and governed agent-track assembly

- Keep raw tracking output out of mature Narrative Agent continuity until the tracking mechanism is explicitly configured, calibrated, and acceptance-tested. Person detection and identity resolution are upstream concerns and are not part of this workstream.
- Surface the existing Narrative Agent tracking implementation and all effective settings in a dedicated governance disclosure: tracker name/version, input evidence surfaces, temporal association thresholds, continuity window, maximum gap, minimum supporting observations, scene/shot-boundary rules, interpolation policy, relation continuity, action/event continuity, and any fallback behavior.
- Distinguish repository defaults, analysis-time effective settings, analyst overrides, and unavailable or implicit defaults. Export the effective configuration with every Narrative Agent tracking run and preserve it in traceback.
- Build a reproducible calibration workbench around already-governed Narrative Agent references and their source-timed evidence. Measure false joins, fragmentation, missed associations, duplicate agent tracks, scene-boundary leakage, unsupported continuity, relation/action discontinuity, and coverage against governed scene participation.
- Provide conservative presets and bounded parameter trials. Every trial creates a new versioned Narrative Agent tracking run and comparison; it cannot rewrite earlier runs, source evidence, manual annotations, or mature records.
- Keep each source-timed evidence occurrence independently governed. A Narrative Agent track organizes occurrences; it does not overwrite their time, coordinates, label, authority, maturity, or traceback.
- After the user confirms a Narrative Agent reference such as `James Bond`, allow the system to propose `Assemble one James Bond Narrative Agent track` from already-linked occurrences, scene participation, actions, relations, speaking turns, cues, and narrative evidence.
- Present proposed track membership on the source timeline and by scene. Show each member's source anchor, evidence family, maturity, inclusion basis, coverage gap, competing agent-track membership, and traceback.
- Let the analyst include or exclude occurrences, split at any point, merge proposals, rename the agent track, correct its temporal extent, reject, defer, and undo. One user decision must project everywhere without destroying the member records.
- Treat the assembled Narrative Agent track as a governed collection and continuity claim. It is not a new identity decision and must not attempt to decide who a detected person is.
- Require explicit maturation criteria before the track supports narrative continuity: governed agent reference already exists, claimed members are source-linked, scene participation is coherent, action/relation continuity is defensible, conflicts are resolved, coverage gaps are visible, and the analyst accepts the assembled collection.
- Later occurrences may be proposed for an existing Narrative Agent track but remain candidates until the configured admission criteria or an analyst decision accepts them.
- Surface calm operational states such as `raw agent-track proposal`, `calibration required`, `membership review`, `continuity conflict`, `reviewed agent track`, and `mature governed agent track`.

Acceptance:

- The analyst can see exactly which Narrative Agent tracking mechanism and settings produced a run.
- Parameter changes create comparable, versioned runs without altering governed evidence.
- A confirmed James Bond Narrative Agent reference can launch a reviewable agent-track assembly proposal without performing person detection or identity resolution.
- Every proposed occurrence remains individually source-linked, inspectable, and reversible.
- Unsupported joins and scene-boundary leakage visibly block maturation.
- Only a governed Narrative Agent track—not raw tracking output—may support Narrative Agent continuity claims.

## 3. Meaning / Plot and interpretive lenses

- Keep Meaning / Plot as the cross-agent plot map.
- Treat Aristotelian, Freytagian, Campbellian, Fryean, Bookerian, Burkean, and related readings as interpretive lenses, not hard labels.
- Deliver interpretive lenses as actual Datascene readings of narrative structure, not cosmetic buttons. Each lens reading should surface projected scene roles, node roles, edge meanings, evidence anchors, maturity state, compare/delta affordances, and analyst accept/edit/reject actions.
- Prioritize narrative structure support first; surface character meaning dimensions after the narrative-structure readings are functioning and source-linked.
- Require maturity gates before prose is surfaced.
- Connect interpretive lens prose to scene cards, SFL/dependency evidence, transcript anchors, visual/audio evidence, and traceback.

## 4. Meaning network

- Implement the Datascene Meaning Network as governed graph data.
- Add nodes, edges, confirmations, continuity anchors, taxonomy backbone, traceback index, and proliferation rules.
- Make selections cross-highlight transcript, POS/SFL, scene, BBox/ROI, Narrative Agent, timeline, report, and traceback surfaces.
- Ensure meaning-network objects remain projections from governed evidence, not independent semantic truth.
- Continue from the operating-principles note: `docs/vaa1_operating_principles_constellational_meaning_network_2026-05-26.md`.
- Treat Narrative Agent presence handles as one feature inside the larger Meaning Network Graph regime.
- Keep BBox/ROI evidence hubs and Meaning Network node/edge sheets behaviorally aligned: source verification first, double-click for the detailed sheet/hub, right-click for traceback/render/confirm/drop actions, and explicit analyst confirmation before mature proliferation.
- Make node/edge sheet navigation specific: graph double-click opens the selected node/edge sheet, while any Narrative Agent action inside that sheet opens the relevant storyline leaf.
- Harden graph layout, source navigation, edge management, expandable/dedicated panel behavior, timeline cursor sync, draggable presence handles, custom lanes, and whole/scene/character timeline views.
- Add constellational triangulation for mature graph nodes and handles across visual, transcript, diarization, prosody, scene, object, relation, off-camera, music, location, and manual-confirmation evidence.
- Deliver forensic render as a real graph action. Start with source-linked BBox/ROI crop or zoom renders and node/edge evidence plates, then expand to montages, before/after comparisons, traceback renders, and report assets.
- Require forensic render outputs or render requests to preserve source media id, time range, coordinate basis, selected graph/BBox ids, maturity state, analyst authority, output type, persistence state, and traceback link.

## 5. Bojean antenarrative 5B layer

- Integrate the 5B schema as a maturity-aware interpretive evidence layer.
- Surface 5B candidates in POS/SFL, Quant matrix, scene cards, Narrative Agent, Meaning / Plot, and report writer where supported.
- Link every 5B claim to transcript tokens, scene intervals, Narrative Agents, visual/audio evidence, and traceback.
- Keep visual 5B evidence gradual: manual first, then source-linked support, then analyst-confirmed maturity.

## 6. SFL and dependency parsing integration

- Use SFL/dependency outputs as linguistic evidence for Narrative Agent paths, scene cards, 5B, meaning network, and interpretive lenses.
- Mark SFL/dependency outputs stale when transcript text, speaker-agent links, or source intervals are corrected.
- Generate analyst-facing prose only when source evidence, maturity state, and traceback are present.

## 7. Actionable evidence families

- Make audio samples and visual patterns navigable, editable, droppable, replaceable, mergeable, splittable, assignable, unassignable, referenceable, and false-match aware.
- Preserve dropped, rejected, replaced, and false-match evidence as inactive traceback history.
- Block orphan semantic candidates or mark them explicitly unattached with a reason.
- Make transcript and audio timing anchors editable, reviewable, and persistent. Analyst-corrected source times should rebuild linked transcript, prosody, POS, Quant, StatsKit, Meaning Network, Narrative Agent, Search, and report surfaces from the Master Schema/governed evidence route rather than leaving panel-local offsets behind.
- Deliver the source layers required for StatsKit, SignificanceKit, and RelevanceRadar to become actual analytical tooling rather than missing-data placeholders:
  - true shot-boundary intervals, not only scene segments or shot-size samples;
  - audio event intervals for speech, silence, noise, and music;
  - music and sound classifier output over time;
  - color, brightness, and contrast extraction from sampled frames or frame windows;
  - speaker-linked diarization turns so speaker dominance can be computed beyond transcript speaker labels.
- Persist each of these layers through the Master Schema / governed evidence path with source time, method, runtime/tool provenance, confidence or maturity state, and traceback.
- Make StatsKit consume these layers through Master Schema or governed analysis projections, not panel-local guesses.

Acceptance:

- StatsKit can compute shot duration distributions, speech/silence/music/noise ratios, music/sound timelines, color/brightness/contrast statistics, and speaker-dominance statistics from persisted source-linked records.
- Missing-data diagnostics can name the exact absent layer and route the analyst to the relevant extraction or review action.
- SignificanceKit and RelevanceRadar claims that depend on these measurements remain candidate until linked evidence and method provenance are present.

## 7A. VAD installation, provider routing, and actual analysis support

- Audit the current "double VAD" situation: local waveform VAD/acoustic clustering, pyannote or other diarization-capable installs, Whisper-derived speech spans, and any frontend/audio-panel assumptions that treat one as the other.
- Detect which VAD/speaker-segmentation providers are installed, activated, unavailable, stale, or license/API constrained.
- Record provider name, version, runtime path, model path, activation state, parameters, source audio fingerprint, transcript-clock fingerprint, and fallback reason in every VAD/diarization artifact.
- Define the provider hierarchy clearly:
  - raw Whisper timecode controls transcript rows unless manually corrected;
  - VAD controls speech/non-speech support intervals;
  - diarization/acoustic clustering can propose speaker turns;
  - Narrative Agent attribution remains candidate until source-linked and confirmed.
- Make Audio Workbench and StatsKit name the active VAD provider and explain missing or degraded VAD layers without pretending the layer is mature.
- Add stale-state checks so VAD-derived speaker turns, prosody windows, sample clouds, and StatsKit speech ratios are invalidated when transcript time, source audio, or selected VAD provider changes.
- Verify that VAD support helps actual analysis work: speech/silence/noise ratios, audio event intervals, prosody windows, source jumps, sample windows, Narrative Agent confirmation candidates, and StatsKit measurements.

Acceptance:

- The program can explain which VAD route is active and why.
- VAD output supports analysis without becoming transcript clock authority.
- Installing or activating a second VAD/diarization provider cannot silently overwrite existing timing or speaker evidence.
- Audio Panel, StatsKit, Master Schema, and Traceback all carry VAD provider and timing-authority metadata.

## 7B. Shot-boundary detection and reporting operationalization

- Turn shot-boundary detection into a persisted source layer, not only a visual/scene proxy.
- Store shot intervals with source time, frame indexes, method, confidence, threshold/profile, runtime provider, source media fingerprint, and traceback refs.
- Distinguish shot boundaries from scene segments, shot-size samples, transitions, camera motion, and editing rhythm interpretations.
- Surface shot-boundary reporting in StatsKit, Meaning / Plot, reports, and Traceback:
  - shot duration distributions;
  - cut density;
  - rapid-cut sections;
  - long-take sections;
  - boundary-to-speech/music/action correlations;
  - missing or low-confidence boundary intervals.
- Add a visual/manual review path for correcting, merging, splitting, confirming, or rejecting shot boundaries.
- Ensure shot-boundary data can support later forensic renders and source-sample windows without becoming a private panel artifact.

Acceptance:

- StatsKit can compute shot-duration and cut-density metrics from persisted shot-boundary records.
- Reports can cite shot intervals with source links and method provenance.
- Shot-boundary corrections survive save, refresh, reopen, export, and traceback.

## 7C. Dormant media-analysis features: music, lyrics, and audio classifiers

- Audit dormant or partial media-analysis features and decide whether each should be activated, hidden, deferred, or removed from visible UI promises.
- Prioritize music and lyrics detection because current code already points in that direction through `src/backend/analysis/lyric_detector.py`.
- For music detection, persist source-timed intervals for music, non-music, score, song, noise, silence, and uncertain audio where supported.
- For lyric/transcript matching, preserve separate evidence routes:
  - detected lyric text;
  - spoken transcript text;
  - music/lyric match confidence;
  - source time;
  - copyright-sensitive handling in display/export.
- Surface music and lyric evidence in Audio Workbench, StatsKit, Meaning / Plot, Narrative Agent, Search, reports, and Traceback only when source-linked and method-provenanced.
- Keep lyric and music outputs candidate/review evidence until source-linked and confirmed where interpretation depends on them.
- Add dependency/runtime checks for `librosa`, model files, ffmpeg requirements, and any license-sensitive music/lyrics libraries.

Acceptance:

- Music and lyrics are either operational with source-linked records, or visibly classified as dormant/deferred.
- No UI route implies music/lyric analysis is delivered when it is only code-level potential.
- Copyright-sensitive lyrics handling is explicit in reports/exports.

## 8. Governance matrix, traceback, and quality agent

- Add or harden the Master Schema Governance Matrix.
- Add a Quality Agent review tray in audit-only mode.
- Add traceback drawer coverage for visible claims.
- Create review tickets for missing source anchors, stale projections, panel divergence, conflicting labels, and orphan evidence.

## 8A. Performance observability and maturation economics

- Deliver the complete performance observability layer as a program-level developer substrate, not as a normal analysis panel.
- Capture upload, video probe, frame extraction, audio extraction, quick sweep, science scan, forensic scan, speech-to-text, speaker diarization, object detection, face detection, OCR, feature extraction, embedding generation, similarity search, scene segmentation, scene card generation, knowledge graph build, provenance linking, BBox tracking, manual annotation sync, data maturation, iteration, proliferation matching, export, UI render, and manual program use.
- Persist observability artifacts under the active analysis or run output, with session id, analysis id, runtime environment, source target, stage observations, resource observations, bottleneck findings, provenance integrity, benchmark result, and operational verdict.
- Keep the developer view full-fidelity: timings, resource peaks, stage-level input/output volumes, cache behavior, database behavior, UI responsiveness, errors, bottlenecks, and recommended engineering actions should be visible internally.
- Do not expose this as a distracting analyst panel. The first UI surface should be an under-the-hood developer/diagnostic view. Later product decisions may choose a smaller user-facing subset for trust, export, or enterprise governance.
- Pair performance observability with data maturation economics for each relevant pass.
- Track compute seconds, GPU seconds, storage written/retained, database writes, cache misses, remote/API cost estimates, analyst minutes, review actions, correction actions, and blocked minutes.
- Track candidate yield, reviewed yield, confirmed yield, mature yield, rejected/deferred/orphan counts, false positives, false negatives discovered, maturation rate, noise ratio, analyst cost per mature item, and compute cost per mature item.
- Track iteration economics: new mature items, new source links, projection targets updated, ambiguities reduced, regressions introduced, manual corrections reused, marginal mature-item change, marginal cost change, diminishing-return flag, and iteration ROI.
- Track reuse value across Master Schema, BBox/ROI, transcript, audio, objects, scene cards, Meaning Network, Narrative Agent, Search, StatsKit, SignificanceKit, RelevanceKit, Traceback, and report/export.

Acceptance:

- Developers can answer "what broke, where, and why?" across every major Datascene program path.
- Developers can answer "was this maturation or iteration pass worth it?" using cost, yield, noise, reuse, and diminishing-return evidence.
- Observability and economics records remain under the hood by default and do not become a metadata parade in analyst-facing workbenches.
- Operational verdicts can distinguish laptop readiness, feature-length readiness, multi-film readiness, HPC/cloud readiness, commercial cost readiness, and maturation economic soundness.

## 9. User agreement and data-location governance

- Add first-run user agreement / operating consent.
- Distinguish local processing from remote/API/paid processing.
- Require user-visible consent before source media, metadata, prompts, screenshots, or derived artifacts leave the local environment.
- Store agreement state locally and make it inspectable/resettable.
- Disclose data retention, generated derivative artifacts, exports, reports, and optional services.

## 10. Licensed software optionality, model governance, and runtime configuration

- Add or document settings for YOLO/model choice, FFmpeg path, detector/runtime alternatives, API keys, LLM providers/models, and optional browser automation.
- Keep core VAA1 usable without LLM/API keys, premium add-ons, or external services.
- Record runtime/model choice, version, path, parameters, provider boundary, and fallback reason in traceback.
- Isolate licensed scripts, paid tools, remote services, GPL/AGPL components, premium tools, and otherwise restricted capabilities behind explicit user choice.
- Add a formal licensed-plugin route for user-supplied capabilities. Users should be able to install/activate a plugin or local script they are licensed to use without VAA1 bundling or silently depending on it.
- For every licensed plugin, record plugin id, provider, version, user activation state, declared license boundary, local/remote boundary, accepted terms timestamp where applicable, produced evidence ids, and fallback behavior.
- Provide open/local alternatives or disabled-state workflows for license-sensitive scripts whenever feasible.
- Keep plugin outputs under the same evidence governance as native outputs: source anchors, method provenance, maturity state, traceback, and explicit candidate/confirmed status.
- Add user-activation controls for optional or license-sensitive capabilities. The user should be able to see what is disabled, what is available locally, what requires external installation, and what requires a license or API/provider boundary.
- Add FFmpeg workarounds and alternatives before release. VAA1 should detect installed FFmpeg/ffprobe path, version, and license boundary; allow the user to choose or replace the binary; explain unavailable codec/workflow consequences; and provide a local/basic fallback or disabled-state workflow where feasible.
- Add YOLOv8/Ultralytics workarounds and alternatives before release. VAA1 should detect whether Ultralytics/YOLOv8 is available; expose user choice of detector/runtime; support a basic local detector fallback or disabled-state workflow; and prevent release-critical analysis from silently depending on YOLOv8 if the user has not activated it.
- Record every FFmpeg, YOLOv8, Ultralytics, detector, transcription, LLM, remote API, licensed script, or optional-provider use in traceback with provider/tool name, version, executable or model path, license/activation state, parameters, fallback decision, and produced evidence ids.
- Label report/export evidence that depends on optional licensed, paid, or remote features.

Acceptance:

- Optional capabilities are user-requested and traceable, not hidden defaults.
- FFmpeg and YOLOv8 alternatives, fallback paths, or disabled-state workflows are in place before release.
- VAA1 can explain and survive missing, unactivated, incompatible, or license-restricted FFmpeg/YOLOv8 components without corrupting the analysis ledger.
- FFmpeg, YOLOv8/Ultralytics, model paths, API providers, and licensed scripts flow through one runtime/activation registry rather than scattered checks.
- Licensed plugins are opt-in, user-owned/activated, traceable, and replaceable by native/open alternatives or explicit disabled states.

## 10A. Media import expansion and source acquisition governance

Activation notice (2026-09-29): Golden Retriever 1.0 is now embedded as a
versioned acquisition-envelope schema, semantic validator and read-only package
validation endpoint. This activates contract validation only. It does **not**
activate connectors, crawling, authenticated retrieval, database access, secret
resolution, remote transfer, package persistence or corpus admission. The first
eligible operational increment is a local-file/analyst-upload vertical slice with
source-policy evaluation, bounded storage, evidence navigation, canonical admission
review and export/restore proof. Networked connector classes require a later,
connector-specific activation record and cannot inherit authority from the schema.

- Decide which media-acquisition paths belong in VAA1 before release and which are post-`#0.1` deferrals:
  - normal local upload/import;
  - saved analysis/project bundle import;
  - website page capture or scraping;
  - web video/audio download when legally available;
  - DVD/disc import for user-provided media;
  - streaming media metadata import;
  - streaming media capture/download only where the user has rights and the workflow is legally/technically permitted.
- Keep source acquisition separate from analysis. Importers must produce a source media record with provenance, acquisition method, consent/licensing notes, source URL/path/device, timestamp, and media fingerprint before analysis begins.
- For website scraping, respect robots/terms where applicable, record page URL, retrieval timestamp, selected media/assets, and user-provided permission/rights notes.
- For DVD/disc import, distinguish ordinary file import from protected-disc ripping. Do not make circumvention a hidden or assumed feature; provide user-owned/local import paths and explicit disabled/deferral language for restricted workflows.
- For streaming services, support metadata/time-map imports where useful, but do not silently download, scrape, or capture protected streams. Any streaming-media workflow must be user-activated, rights-aware, and traceable.
- Preserve source-media chain of custody so reports can distinguish uploaded file, website asset, scraped metadata, DVD-derived file, and streaming metadata.

Acceptance:

- VAA1 can explain how a source entered the project and what rights/activation boundary governed it.
- Media import UX does not imply that restricted web/DVD/stream acquisition is a built-in entitlement.
- Imported web/disc/stream-derived records remain traceable through source media metadata, reports, and exports.

## 10B. Downloadable data cleanup and user-friendly export governance

- Redesign downloadable data around user tasks rather than raw artifact sprawl.
- Group downloads into clear packages:
  - source media and source metadata;
  - analysis summary;
  - transcript and timing authority;
  - visual detections and BBox/ROI;
  - audio, VAD, diarization, prosody, music/lyrics;
  - Master Schema / governed evidence;
  - mature-data decisions and correction ledgers;
  - reports and forensic renders;
  - developer/debug artifacts.
- Label each download with plain-language purpose, source scope, maturity/authority level, created time, dependencies, and whether it is analyst-facing or developer-facing.
- Add a manifest for every export bundle with file descriptions, schema versions, source media id, analysis id, timing clock fingerprint, runtime/plugin providers, optional licensed dependencies, and privacy/consent boundary.
- Hide or collapse noisy debug artifacts by default while keeping them accessible through an advanced/developer export mode.
- Prevent duplicate, stale, backup, temporary, and superseded artifacts from appearing as equally valid user downloads.
- Ensure reports and user-facing exports use clean names, stable folder structure, and readable explanations of what each file is for.

Acceptance:

- A normal user can download the useful outputs without navigating raw internal clutter.
- A developer can still export full debugging/provenance artifacts intentionally.
- Export bundles preserve authority, timing, plugin/licensing, and source-chain metadata.

## 11. CVAT and annotation round trip

- Finish one-click handoff to CVAT.
- Reuse stored CVAT task ids and prevent duplicate tasks.
- Ingest CVAT outputs into governed Master Schema objects.
- Show import validation, linkage state, and correction history.

## 12. Playwright / DOM testing

- Add Playwright checks for dashboard load, project reopen, video rendering, overlay rendering, Master Schema governance surfaces, traceback navigation, GoldenLayout reload, and source-jump navigation.
- Add a rendered bidirectional navigation matrix for Transcript, Audio, Objects, OCR, Expressions, POS, Quant, Scene Cards, Narrative Agent, Meaning Network/Plot, Master Schema, Data Maturation, Search, StatsKit and Traceback. For each leaf, prove Video entry activation opens/selects the leaf record and leaf activation focuses/seeks/highlights the same record in the existing Video panel without loops or duplicate leaves.
- In the same matrix, prove **raised here, navigable here**: activating a leaf indication preserves the originating tab, active row, expansion, scroll/filter state and next/previous navigation while Video synchronizes in support. Foreground transfer occurs only after an explicit analyst action.
- Measure prompt surfacing: the destination must acknowledge selection immediately and complete navigation within the panel-hydration performance budget, or render a typed unavailability state in the correct context.
- Add focused BBox/ROI DOM fixtures proving candidate surfacing, confirm/cancel controls, mature-label priority, and traceback visibility.
- Keep manual tests until the full app shell is stable enough for reliable automation.

## 13. Packaging and `.exe` readiness

- Complete pre-`.exe` manual test checklist.
- Verify startup, restart, saved-state recovery, source-media reopen, export, rollback/restore, consent display, optional API-key handling, licensed add-on configuration, and data-location disclosure.
- Verify licensed-script workarounds and user activation by choice, including FFmpeg binary/path selection and YOLOv8/Ultralytics detector alternatives or disabled-state fallback.
- Confirm the packaged app can run the core local pipeline with optional APIs disabled.
- Confirm the packaged app does not silently require FFmpeg or YOLOv8 in a license-sensitive way without user-visible activation, configuration, fallback, or explicit release deferral.
- Confirm Mature Data Proliferation remains governed in the package: saved proliferation decisions, candidate-only states, mature label projection, traceback, and rollback/reopen behavior must survive packaged runtime tests.
- Run backend contracts, frontend tests, typecheck, Playwright checks, and at least one representative full-analysis smoke test.
- Build the first `#0.1 .exe` only after core governance and release-readiness gates pass or are explicitly deferred.

## 14. Repository cleanup and unpushed local work queue

Status after the 2026-07-06 push to `origin/petteri` at commit `10293ee`:

- The StatsKit, Significance/Relevance, Admin Observability, and latest Agent/Meaning graph increment are pushed.
- The remaining local files below are not yet part of the pushed sprint history.
- Do not silently include them in a future push. Each item needs either review, cleanup, separation into its own commit, or explicit discard/archive decision.

## 14A. Push-readiness rule: actual working software, not scaffolding

The next push should not be a documentation-only checkpoint if verified working software is present locally. The release branch should receive the actual Datascene/VAA1 development that has crossed a basic working-software threshold.

The push should include these software-development scopes once verified:

1. **Properly operational linked-time regime**
   - Whisper/manual time authority guards.
   - Transcript timing repair and authority metadata.
   - Transcript panel display rules.
   - POS/Quant/Audio/StatsKit/Master Schema timing propagation or invalidation logic touched by the repair.
   - Regression tests for scaffold/fallback/VAD not becoming source-time truth.
   - Timing-complication documentation and sprint-rule documentation.

2. **StatsKit development**
   - StatsKit backend agent and data contracts.
   - StatsKit panel/workbench UI.
   - Source-layer diagnostics and missing-data reporting.
   - Tests proving rows render from real source/governed layers where available and remain `not computed` or candidate where source layers are missing.

3. **Internal audio/audition features**
   - Audio Workbench / Audio Panel implementation.
   - VAD, diarization, prosody, audio sample cloud, music/lyrics, and audio event work that is actually wired into analysis artifacts or UI surfaces.
   - Provider/runtime metadata and timing-authority propagation.
   - Tests for audio diarization, sample clouds, timing regime, and any activated music/lyric functionality.

4. **Governance documentation**
   - Time-based linking known complications.
   - General Sprint regime updates.
   - Handover documentation that describes the actual pushed state, not merely aspirational work.

Do not include these in the same software push unless explicitly requested:

- investor or board-meeting slide decks;
- generated presentation scripts unrelated to runtime product behavior;
- Office lock files;
- `node_modules` artifacts;
- duplicate scratch files such as a root-level temporary `AudioPanel.tsx`;
- old handover notes that are not needed to explain the pushed software state;
- experimental files that have not been reviewed for integration, tests, and UI/runtime status.

Comfort threshold before pushing the broad software slice:

- Scope staged intentionally by file, not by `git add .`.
- Features classified as operational, partial, nominal, dormant, or deferred.
- Any partial UI route is visibly marked or hidden so it is not presented as delivered.
- TypeScript passes for the frontend.
- Focused frontend tests pass for touched panels/services.
- Python compile or focused backend tests pass for touched backend modules.
- Transcript timing guard and audio timing regime tests pass.
- Audio diarization/sample-cloud tests pass when those modules are included.
- A short manual or Playwright smoke path confirms that major pushed panels render and do not open blank/grey states.
- The commit message names the true state: operational, partial, or guarded candidate. No “delivered” language for unproven paths.

Acceptance:

- The pushed branch contains real Datascene/VAA1 software progress, not just scaffolding notes.
- Non-software artifacts are excluded or committed separately with explicit intent.
- The user can stop for the day knowing StatsKit, internal audio/audition features, linked-time regime, and relevant documentation are either pushed as working software or explicitly listed as not-yet-push-ready with reasons.

Unpushed tracked changes that need review:

- `src/backend/analysis/lyric_detector.py`
  - Adds music analysis / lyric-transcript matching direction.
  - Needs dependency and runtime review because it introduces `librosa` / `numpy` usage and changes output semantics.
  - Has a current trailing-whitespace warning at line 236 that must be cleaned before any commit.
- `scripts/generate_datascene_investor_deck.js`
  - Large investor-deck script rewrite.
  - Needs a separate presentation-materials commit if kept.
- `docs/investor_deck/datascene_investor_deck_editable_2026-06-06.pptx`
  - Generated binary deck changed substantially.
  - Needs explicit decision whether generated PPTX belongs in git for this sprint.
- `node_modules/.package-lock.json`
  - Likely dependency-install side effect.
  - Should normally not be committed unless there is a deliberate dependency-lock reason.

Unpushed untracked work that needs triage:

- `src/backend/analysis/search_agent.py`
  - Potential backend Search agent implementation.
  - Needs source review, tests, API integration check, and decision whether it belongs with the Datascene Search sprint or a later backend-search commit.
- `docs/board_meeting/datascene_kansalliskirjasto_board_slides_2026-06-16.pptx`
- `docs/board_meeting/datascene_yle_archive_search_slides_2026-06-22.pptx`
- `scripts/generate_kansalliskirjasto_board_slides.js`
- `scripts/generate_yle_archive_datascene_slides.js`
  - Board / customer-facing slide assets and generators.
  - Need a separate materials commit or archive decision.
- `docs/board_meeting/~$datascene_kansalliskirjasto_board_slides_2026-06-16.pptx`
  - Temporary Office lock file.
  - Should not be committed.
- `docs/working_handover_handout_2026-06-03_Z_meaning_network_sfl_thread.md`
- `docs/working_handover_handout_2026-06-08_A_windows_parity_deck_timing_thread.md`
  - Older handoff docs.
  - Need decision whether they are still useful sprint continuity records or should remain local/archive-only.

Acceptance:

- `git status -sb` is intentionally clean or contains only explicitly deferred local artifacts.
- No generated deck, temporary lock file, dependency artifact, or experimental backend file is pushed accidentally.
- Any kept item has its own coherent commit scope, tests or validation note, and documentation context.

Release gate:

- Do not package by assuming mature proliferation and licensed optionality are "later" tasks. If either is incomplete, the deferral must be explicit, visible, and risk-labeled.

Running environment refresh note (2026-07-19):

- Refresh every active backend and frontend environment from the current dependency manifests before the next governed test run.
- The clean functional-branch validation found stale Python environments missing `nltk` and `scenedetect`; these prevented full backend collection/execution even though the available backend set reached 88 passing tests.
- Frontend contract validation passed 74/74 and TypeScript validation passed after using the repository's installed frontend dependencies.
- Re-run the complete backend suite after the environment refresh and treat dependency parity across local startup, test, and deployed runtimes as a release gate.

### Backend correction revision checkpoint — 2026-09-23

The version-aware backend save precondition is delivered and automatically tested (72 tests, 25 subtests). Next: coherent read-time binding, dashboard writer enforcement, then editor adoption and staged manual acceptance. Legacy clients remain offset-only. [Scope and ordered dependencies](audits/source_clock_2026-09-23/backend-revision-precondition.md).

### Dashboard correction binding checkpoint — 2026-09-23

Coherent dashboard correction reads and full binding validation on dashboard saves are delivered (51 focused frontend tests, TypeScript, two browser hydration checks). Next audit draft/refresh/undo binding retention per editor, then staged navigation and manual acceptance. [Delivery boundaries](audits/source_clock_2026-09-23/dashboard-revision-binding.md).

### Transcript draft checkpoint — 2026-09-23

Span/manual-marker drafts now preserve their opening source-clock binding and retain drafts on save conflicts. 55 focused frontend tests, TypeScript and language hydration pass. Next: transcript word drafts/undo, then remaining editors and navigation. [Audit](audits/source_clock_2026-09-23/transcript-draft-binding.md).

### Transcript word and undo-safety checkpoint — 2026-09-23

Word drafts preserve their captured binding; transcript undo retains history on failed or unverified restoration. 59 frontend tests, TypeScript and language hydration pass. Full canonical undo restoration remains a dependency before claiming M3 readiness. [Audit](audits/source_clock_2026-09-23/transcript-word-undo.md).

### Correction-generation checkpoint — 2026-09-23

Canonical generation guards now reject same-clock stale saves in both save routes. Existing analyses adopt generations on their next save; older open editors then require reload. Safe inverse-operation undo remains next, with deletion/supersession and before/after provenance still required. [Audit](audits/source_clock_2026-09-23/correction-generation.md).
