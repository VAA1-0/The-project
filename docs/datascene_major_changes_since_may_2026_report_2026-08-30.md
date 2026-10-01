# Datascene: major program changes since May 2026

Date: 2026-08-30
Scope: repository history and operating evidence from 2026-05-01 through 2026-08-30

## Executive conclusion

Since May, Datascene has changed from a collection of multimodal analysis panels into a governed research system. The central architectural move is that detections, measurements, interpretations, and analyst decisions no longer share one undifferentiated truth status. Source-linked measurements remain immutable evidence; computational outputs remain candidates; analyst decisions are appended to a canonical ledger; and confirmed claims are projected, reversibly, to Scene Cards, Narrative Agents, the Meaning Network, Master Schema, Traceback, StatsKit, and publication products.

Three developments dominate the period:

1. **Evidence governance became operational.** BBox/ROI correction, source-time navigation, Traceback, Data Maturation, canonical decision records, and reversible proliferation now form one review path. Manual authority wins, while automated matching proposes rather than silently rewrites.
2. **StatsKit became a statistical workbench rather than a dashboard of counts.** It now separates measured results from readiness targets and supports reproducible descriptive, robust-standardization, and cross-signal association workflows with explicit populations, analytical units, missingness, provenance, and limitations.
3. **Long-running analysis became auditable and resumable.** Checkpoints, heartbeats, recovery states, bounded status loading, resource admission, watchdog snapshots, artifact parity, and a versioned full-analysis manifest replaced the optimistic equation “pipeline returned = full analysis.”

## 1. Governance and analyst workflow

The May–June work established Datascene's present operating principle: **meaning is constellational and governed, not emitted directly by a detector**. A visual box, transcript span, acoustic cluster, OCR phrase, or statistical association is evidence of a declared kind, not automatically a Narrative Agent or an interpretation.

The practical consequences are:

- every material claim should retain its source-media identifier, canonical source time, BBox/ROI or interval where applicable, producer and method, maturity, and lineage;
- analyst correction and confirmation outrank inferred labels;
- decisions are appended rather than overwriting the evidence that motivated them;
- the same canonical decision is projected to all consumers, avoiding panel-specific truths;
- Scene Cards participate in the evidence-and-feedback loop rather than serving as presentation-only summaries;
- Datascene's analyst-facing term is **Narrative Agent**, not “identity.” Legacy field names survive only at compatibility boundaries.

This work produced live Narrative Agent review, evidence navigation, Master Schema maturity auditing, Meaning Network confirmation, Search/Data Maturation queues, and governed propagation across panels. The later Digital Twin work extends this model: a Narrative Agent Digital Twin is a confirmed multimodal reference assembled from visual, audio, transcript, OCR, music-theme, Source Media, Scene Card, and manual evidence. It is not a face match based on one frame. Cross-dissolves, filters, occlusion, and boundary frames must be treated as adverse evidence; a corrected temporal/BBox anchor supersedes a stale visual sample.

## 2. StatsKit development

### What changed

StatsKit 1.0, delivered in July and operationalized through August, created a bounded statistical workspace with an explicit scientific boundary. Its 47-category empirical taxonomy is a capability and gap registry; a listed category is not thereby measured. Operating results appear only when a producer, persisted artifact, variable mapping, eligible method, evidence route, and consumer are present. “Not computed,” “missing,” and “unsupported” are epistemic states, never zeros.

The workbench now joins four things without conflating them:

- **measurement**: counts, durations, rates, distributions, and scene-level variables from governed source layers;
- **method**: declared analytical unit, population, baseline, estimator, diagnostics, and limitations;
- **interpretation**: a separately governed proposition, initially candidate-only;
- **use**: source inspection, visualization, significance/relevance review, decision, and eventual report eligibility.

For a statistics professor, the important design choice is that StatsKit is an auditable measurement-and-estimation layer, not an automated significance oracle. Current native methods are deliberately modest:

#### Robust scene salience

For an observed scene value \(x\), Datascene compares it with at least three governed comparison observations. With baseline median \(m\) and median absolute deviation

\[
\mathrm{MAD}=\operatorname{median}_i|x_i-m|,
\]

the standardized descriptive deviation is

\[
z_r=0.67448975\frac{x-m}{\mathrm{MAD}}.
\]

The computation is refused when the baseline is too small or \(\mathrm{MAD}=0\). Component deviations from at least two temporally overlapping signal families are combined as the mean of \(|z_r|\), capped at five and rescaled to \([0,1]\). This **salience index is a review-priority composite**. It is not a p-value, sampling probability, effect size, or causal estimate.

#### Cross-signal association

The first research-question motor pairs scene-level expression activation with prosodic measures and computes Spearman's rank correlation. Spearman's \(\rho\) is appropriate here as a monotone, rank-based association measure that does not require bivariate normality. Datascene records the coefficient, effective paired-scene sample size, variables, intervals, missingness/estimability state, visualization specification, substantive proposition, and limitations. Association magnitude is labelled as magnitude; statistical significance is not asserted because the present motor does not provide an inferential p-value or a defensible independent-sampling model.

#### Scientific safeguards

The engine rejects mixed source-media identifiers, noncanonical clocks, missing populations or evidence, single-family “cross-signal” inputs, non-overlapping intervals, insufficient baselines, and unestimable relationships. Temporal concurrence is not interpreted as independence or causation. Multiple-comparison policy, uncertainty, weighting, and missing-data policy are part of the planned analysis contract; they are not fabricated when unavailable.

This is a substantial improvement over a UI that merely displays detector totals. It makes denominator, eligibility, provenance, and non-result states visible, and it keeps statistical findings distinct from narrative readings and publication prose.

### Full Datascene empirical taxonomy

The table below reproduces all 47 categories in the canonical coverage authority, `docs/inventory/design_attribute_coverage_matrix.json`. The status column is the matrix's **14 July 2026 audit state**, not a retrospective claim that nothing changed afterward. In particular, August strengthened StatsKit execution, reporting/publication, full-analysis delivery, provenance parity, and runtime observability. Those improvements require a governed matrix re-audit before their category labels should be promoted. `Partial` means that real surfaces or artifacts exist but the complete scientific contract is not closed; `nominal` means vocabulary/design presence without a proven measurement family; `missing` means no governed operating family; and `experimental` means an implementation direction exists but is not production evidence.

| # | Canonical category | Audit status | Scientific scope or unresolved boundary |
|---:|---|---|---|
| 1 | `method.canonical_taxonomy` | Partial | Versioned terms, hierarchy, multilingual labels, deprecation and governed extension. |
| 2 | `method.taxonomy_application` | Partial | Typed, source-scoped applications and supersession rather than bundled labels. |
| 3 | `method.provenance` | Partial | Uniform producer, method, source and transformation lineage. |
| 4 | `method.temporal_grounding` | Partial | Canonical clock authority and interval alignment across every modality. |
| 5 | `method.reference_evidence` | Partial | Scientific quality and permissible use of source/reference evidence. |
| 6 | `method.traceback` | Partial | Complete claim-to-measurement-to-source reconstruction. |
| 7 | `source.media_identity` | Operational | Stable technical source record; fingerprint completeness remained variable. |
| 8 | `source.rights_consent_policy` | Partial | Lawful basis, consent, sensitivity, retention, purpose and export restrictions. |
| 9 | `source.acquisition_import` | Partial | Import provenance, normalization and duplicate-safe reopening. |
| 10 | `visual.objects_bbox_tracks` | Partial | Detections, geometry, tracks, correction and semantic governance. |
| 11 | `visual.faces_expressions` | Partial | Face/expression observations, validity and Narrative Agent linkage. |
| 12 | `visual.ocr_graphics` | Partial | OCR region, raw/normalized text, language, graphic role and correction lineage. |
| 13 | `visual.camera_composition_mediation` | Partial | Calibrated camera/composition measurement separated from interpretation. |
| 14 | `visual.shots_transitions_scenes` | Partial | Cuts, transitions, shots, scenes, memberships and analyst revisions as distinct objects. |
| 15 | `visual.color_brightness_contrast_motion` | Partial | Reproducible calibrated visual series rather than UI sample counts alone. |
| 16 | `audio.source_waveform_events` | Partial | Fingerprinted waveform, governed event intervals and provider manifests. |
| 17 | `audio.vad_speech_silence` | Partial | Provider-ranked VAD and aligned speech/silence intervals. |
| 18 | `audio.diarization_speaker_turns` | Partial | Anonymous clusters/turns kept distinct from confirmed speakers. |
| 19 | `audio.prosody_delivery` | Partial | Comparable, source-timed prosodic measures with stale-state control. |
| 20 | `audio.music_noise_lyrics` | Experimental | Measured music/noise/lyric intervals, classifier provenance and lyric rights. |
| 21 | `audio.sample_clouds_similarity` | Partial | Versioned samples/embeddings, similarity candidates and retained negative evidence. |
| 22 | `language.transcript_text` | Partial | Governed transcript text, timing, correction and provenance quality. |
| 23 | `language.pos_dependency_sfl` | Partial | POS, dependency and SFL measurements with language-dependent validity. |
| 24 | `language.claim_epistemic_status` | Missing | Dedicated claim status, modality, certainty and evidential warrant. |
| 25 | `language.rhetorical_strategy` | Nominal | Reproducible rhetorical-strategy analysis beyond interpretive notes. |
| 26 | `scene.situation_event_action_causality` | Partial | Governed events, participants, actions and cautious causal propositions. |
| 27 | `scene.absence_omission_silence` | Missing | Analytical absence distinguished from failed detection or missing measurement. |
| 28 | `institution.process` | Nominal | Evidenced institutional processes, stages, roles and decisions. |
| 29 | `audience.reception_circulation` | Missing | Implied/addressed/actual audiences, response, reception and circulation. |
| 30 | `narrative.agents_roles_relations_presence` | Partial | Narrative Agents, roles, relations, visual presence, speaking and listening. |
| 31 | `narrative.meaning_network` | Partial | Governed nodes, relations, candidates, decisions and source-linked projection. |
| 32 | `narrative.lenses_structures` | Partial | Framework-explicit readings and comparative interpretive structures. |
| 33 | `narrative.boje_5b` | Partial | Source-linked Before, Bets, Becoming, Beneath and Between assignments. |
| 34 | `narrative.values_virtues_vices_motives_themes` | Nominal | Governed interpretive objects rather than visible vocabulary fields. |
| 35 | `research.disagreement_adjudication` | Missing | Multiple analysts, reliability, disagreement and adjudication history. |
| 36 | `research.evidence_quality` | Partial | Evidence quality independent of detector confidence and maturity. |
| 37 | `analytics.statskit` | Partial | Plans, eligible methods, measured results, diagnostics and evidence routes. |
| 38 | `analytics.significance_relevance` | Partial | Substantive significance/relevance distinct from statistical significance. |
| 39 | `analytics.search` | Partial | Governed, source-linked discovery without local truth promotion. |
| 40 | `analytics.reporting` | Partial | Reviewed propositions and reproducible, provenance-complete report claims. |
| 41 | `governance.decision_projection` | Operational | Append-only canonical decisions, invalidation and deterministic projections. |
| 42 | `governance.matcher_candidate_boundary` | Partial | Proposal-only writers, candidate scope, conflict evidence and rejection memory. |
| 43 | `governance.performance_observability` | Partial | Persisted stage, latency, resource, cache and budget observations. |
| 44 | `governance.maturation_economics` | Nominal | Compute/storage/attention cost, mature yield, reuse, waste and marginal yield. |
| 45 | `external.cvat_roundtrip` | Partial | Task identity, mappings, manifests and correction lineage through round-trip. |
| 46 | `external.providers_licenses_plugins` | Partial | Capability activation, version, licence, fallback and exported provenance. |
| 47 | `delivery.save_reopen_export_package` | Partial | Reproducible scientific state across save, reopen, export and package. |

This table is the **empirical attribute-category taxonomy**, not the complete list of every permitted annotation value. Datascene also maintains subordinate vocabularies—most notably the extensive situation/person-situation taxonomy, manual BBox taxonomy, POS/SFL terms, interpretive-framework vocabularies and shared analyst-added labels. Those vocabularies supply values under the categories above; they do not add extra empirical categories or prove that a category is operational.

## 3. From “SOM matcher” to statistical matching

The historical terminology needs precision. The June “open-topology SOM” was **not a trained Kohonen self-organizing map**: it had no neuron lattice, neighborhood kernel, learning-rate schedule, epochs, or competitive weight updates. It was a source-linked multimodal similarity graph. A separate audio subsystem did perform genuine numeric clustering: 34-dimensional acoustic segment vectors (means and standard deviations of 17 frame features) were standardized and assigned with K-means, with cluster count selected by silhouette score. Those clusters remained anonymous speaker groups.

The earlier proliferation matcher compared seven components—token Jaccard similarity, temporal proximity, spatial compatibility, track continuity, modality compatibility, sample-cloud support, and cross-scene continuity—using a renormalized weighted mean over available positive components. That score was a heuristic match probability, not a calibrated posterior probability. Missing components were dropped rather than imputed, and policy caps prevented generic persons and contextual evidence from masquerading as named Narrative Agent confirmations.

The present direction is therefore best described as **a change in authority and method, not a simple algorithm swap**:

- the SOM graph remains useful for diagnostic topology and candidate discovery;
- the operational matcher uses explicit measured features, declared comparisons, thresholds, source intervals, conflict/negative evidence, and reproducible statistical summaries;
- cross-signal pattern finding uses robust median/MAD deviations and rank association rather than graph proximity as evidence of meaning;
- matcher outputs remain candidates below the governance threshold, and even high scores cannot defeat a manual correction;
- only a canonical analyst decision may promote and proliferate a Narrative Agent claim to governed consumers.

This reduces two earlier risks: treating graph adjacency as substantive similarity, and presenting an uncalibrated similarity score as certainty. The remaining methodological task is calibration on labelled hold-out data: estimate false-match and miss rates by modality and transition type, test threshold stability, and report calibration/precision–recall rather than calling a weighted score a probability.

## 4. Runtime monitoring and the seven-video research run

The performance-observability schema records the run/session identifier, hardware/software environment, source properties, stage timing and status, input/output volumes, resource observations, cache/database behavior, provenance integrity, bottleneck findings, and an operational verdict. The runtime control plane adds atomic progress journals, stage cursors, checkpoint signatures, queue heartbeats, cooling deadlines, bounded retries, and recovery snapshots.

During the seven-video run, this instrumentation changed the diagnosis of apparent stalls. A static UI percentage and a low parent-process CPU sample were shown to be insufficient: face work occurred in child processes, and macOS sleep suspended useful work without invalidating checkpoints. The governing test became repeated observations of checkpoint `next_index`, modification time, event-log movement, worker state, heartbeat, and sleep/wake history. Runtime states were consequently separated into `running`, `sleep-suspended`, `cooling`, `worker-timeout`, `stalled`, `interrupted`, and `completed`.

The research run exposed concrete failure modes:

- an active Video 4 job was manually interrupted after a false stall diagnosis;
- Video 3's UI percentage remained static while its durable frame cursor advanced;
- a shared launcher allowed one child-service exit to take down both frontend and backend;
- a recovered visual branch retained a stale error and entered a retry loop;
- “completed/full profile” could coexist with a missing or incomplete required branch;
- historical artifacts could exist on disk but remain unregistered or unhydrated in StatsKit.

The resulting hardening included finer-grained resumable checkpoints, source/configuration signatures, normalization of in-flight work after process loss, memory headroom for interactive work, independent backend recovery, bounded status payloads, atomic annotation writes, snapshot-before-restart, cooling instead of restart loops, and reuse of valid completed branches.

Most importantly, a versioned full-analysis manifest now verifies the path

`producer → artifact → registration → Master Schema projection → frontend hydration → StatsKit consumption`.

All seven current analyses subsequently passed all 15 required branches at 100% with no manifest blockers. Language token agreement was 99.2–100.0%; a stale audio-artifact mismatch in Video 1 was reconciled; and Video 2's missing relational layer was computed, yielding 11 source-linked relationships.

### Monitoring limitation

The schema is stronger than the present benchmark capture. The seven `performance_observability_latest.json` files preserve event and artifact lineage, but their source duration is recorded as zero and cumulative event timestamps inflate apparent runtime. They must not be used to estimate throughput or runtime ratios. The seven-video robustness claims above are instead supported by checkpoint/event evidence and strict parity manifests. A clean benchmark rerun should populate source duration, sample resources longitudinally (including child workers), use monotonic per-stage clocks, and validate the observability record against its schema before performance inference.

## 5. Current position and next rigorous steps

Datascene is now substantially more defensible as a local research workstation: it distinguishes evidence from claims, makes statistical assumptions visible, preserves analyst authority, resumes expensive work, and verifies delivery to consumers. It is not yet a calibrated autonomous recognition system or a hardened multi-user production service.

The highest-value next steps are concise:

1. benchmark statistical matching against an analyst-labelled corpus, stratified by cross-dissolve, occlusion, filter, shot boundary, and modality availability;
2. replace “probability” labels on uncalibrated weighted similarity scores with “similarity/support score,” or calibrate them out of sample;
3. operationalize saved analysis plans, uncertainty and multiplicity handling, while keeping descriptive salience separate from inference;
4. generalize and commit the incident-specific watchdog configuration;
5. rerun the observability benchmark with valid duration and child-process resource sampling;
6. retain the 15-branch manifest and artifact-to-consumer parity check as a publication gate.

## Evidence base

This report is grounded in dated handouts and delivery records, the implementation and schemas, Git history, seven current full-analysis manifests, and the seven-video publication-readiness audit. The companion current program map is `docs/vaa1_program_map_current_2026-08-30.md`.
