# Datascene/VAA1 Remaining 17 Domain Atomic Profiles

Date: 2026-07-15
Status: B0 contracts confirmed; runtime delivery pending

## Purpose

The 47-category empirical inventory is the coverage authority. The original twelve attributes proved the canonical architecture, and the minimum statistics-to-interpretation profile added seventeen cross-domain analytical attributes. Seventeen inventory categories still lacked direct atomic bindings. They are now specified in `docs/inventory/domain_atomic_profiles_remaining_17.json` as 97 atomic attribute contracts.

“Confirmed” here means accepted into the program map with a definition, implementation boundary, owner, known paths, and acceptance rule. It does not mean runtime-operational. Promotion to operational still requires a concrete implementation binding, representative persisted evidence, invalidation behavior, and passing tests.

## 1. Taxonomy governance

### Canonical taxonomy

Atomic scope: vocabulary identity and version; stable term identity; hierarchy; multilingual label; deprecation/replacement; extension decision.

Why it matters: statistics and interpretations cannot remain reproducible if a label silently changes meaning. Historical applications must retain the vocabulary and term version used when they were made.

### Taxonomy application

Atomic scope: typed application object; apply/remove/replace action; independent validity; decision and supersession lineage.

Why it matters: a term definition and a term applied to evidence are different objects. Corrections must affect only the selected subject and scope.

## 2. Source policy

### Rights, consent, and permitted use

Atomic scope: lawful basis, sensitivity, consent state, retention, permitted purpose, export restriction.

Why it matters: source-linked science also needs source-linked use restrictions. Derived artifacts, external providers, reports, and exports must inherit enforceable policy without treating policy as analytical evidence.

## 3. Detailed visual evidence

### OCR and graphics

Atomic scope: region, raw text, normalized text, language assessment, graphic role, normalization lineage.

The raw observation must survive correction; language and graphic function remain separately reviewable.

### Camera, composition, and mediation

Atomic scope: calibrated camera measurement, calibration manifest, composition measurement, communicative-function candidate.

Measured framing or motion is evidence. A claim about its communicative function is an interpretation and must not be stored as the measurement itself.

### Shots, transitions, and scenes

Atomic scope: shot boundary, shot interval, transition event, scene interval, shot-to-scene membership, analyst scene revision.

True cuts, shots, transitions, and analytical scenes require separate identities and local invalidation when a boundary changes.

## 4. Detailed audio evidence

### Source waveform and audio events

Atomic scope: fingerprinted source, waveform reference, event interval, governed event term, provider manifest.

### Voice activity, speech, and silence

Atomic scope: VAD interval, speech interval, silence interval, provider rank, alignment quality.

All intervals must share the source clock and respect the established timing-authority hierarchy.

### Music, noise, and lyrics

Atomic scope: music/noise interval, lyric segment, lyric rights state, classifier manifest.

This category remains experimental until optional dependencies, representative persisted outputs, tests, and rights-aware lyric handling are proven.

### Sample clouds and similarity

Atomic scope: stable sample identity, embedding, similarity candidate, negative evidence, model manifest.

Similarity is never identity. Rejections must form governed negative memory so idle matching does not repeatedly raise the same weak candidate.

## 5. Institutional and audience analysis

### Institutional process

Atomic scope: institution identity, process event, stage, participant role, decision state.

Institutional stages must be evidenced events with participants and time—not free-floating keywords or scene tags.

### Audience, reception, and circulation

Atomic scope: audience relation/type, positioning, expected response, observed response, reception context, circulation context.

Implied, addressed, and actual audiences remain distinct. Platform context cannot by itself prove reception or response.

## 6. Candidate, performance, and economic governance

### Matcher boundary

Atomic scope: producer manifest, source scope, score, decision state, negative memory, cross-source policy.

Every matcher remains proposal-only, versioned, source-isolated, and unable to promote mature state directly.

### Performance observability

Atomic scope: run, stage, resource sample, latency, cache event, budget result.

This is developer-facing operational evidence. It must never enter the analyst’s empirical truth regime merely because it describes Datascene’s execution.

### Maturation economics

Atomic scope: compute/storage cost, analyst attention, mature/candidate yield, reuse, waste, marginal yield.

This enables Pareto-aware idle compute and iteration decisions based on actual reusable mature value rather than raw activity volume.

## 7. External integrations

### CVAT round trip

Atomic scope: task identity, export/import manifests, mapping, correction lineage.

The round trip must be duplicate-safe and bring corrections back through the canonical authority boundary.

### Providers, licences, and plugins

Atomic scope: provider/version, licence, activation, fallback, execution manifest, export provenance.

Optional capabilities must be explicitly activated, test their fallback, and disclose the provider and licence lineage of exported results.

## Delivery sequence

1. Vocabulary and taxonomy applications.
2. Source policy and capability governance.
3. Source-clock-bound visual and audio observation objects.
4. Institutional and audience propositions.
5. Matcher, observability, and economics instrumentation.
6. CVAT and optional-provider round trips.

This sequence prevents later measurements and interpretations from being built on unstable terms, ungoverned source use, or ambiguous temporal objects.
