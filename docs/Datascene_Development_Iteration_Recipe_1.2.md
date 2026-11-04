# Datascene Development Iteration Recipe 1.2

## Operational design and delivery contract

**Status:** Active design document  
**Date:** 24 October 2026  
**Supersedes for implementation:** Datascene Development Iteration Recipe 1.1  
**Preserved source:** `Datascene_Development_Iteration_Recipe_1.1.docx`  
**Scope:** Cluster Detections, Cinematic Analysis View, Narrative Agent Graph 1.1, Meaning Knowledge Graph 1.1, and their cross-panel operation.

## 1. Purpose

This document turns the sound conceptual direction of Recipe 1.1 into an operational delivery contract. It does not authorize a rebrand, wholesale rebuild, or replacement of existing Datascene capabilities. It defines how existing capabilities are inspected, corrected, connected, tested, and accepted.

The central objective remains:

> Make Datascene's existing evidence, cluster, graph, and cinematic-analysis capabilities more accurate, legible, efficient, source-linked, and governable without weakening human interpretive authority.

The operative unit is a small end-to-end slice that produces real analyst value. A visible widget, placeholder action, or isolated data structure is not a delivered slice.

## 2. Operationalization assessment of Recipe 1.1

Recipe 1.1 is substantially operationalizable. Its analytical goals, refinement method, and acceptance intent are coherent. The following alterations are required so that implementation teams can distinguish a design aspiration from a delivered capability.

| Area | Current assessment | Operational consequence |
| --- | --- | --- |
| Core premise and non-negotiables | Operational now | Retain without conceptual change and make them release gates. |
| Eight-step iteration recipe | Mostly operational | Require evidence artefacts, a named acceptance owner, regression checks, and an explicit status for every step. |
| Iteration 0: baseline and equivalence audit | Partial | Consolidate the inventory, do-not-rebuild register, terminology map, and fixed-corpus baseline. |
| Cluster Detections 1.1 | Partial; active construction | The semantic-family inspection slice is delivered. Governed threshold commits, direct merge/split/reassignment, batch decisions, and mixed-corpus measurement remain. |
| Cinematic Analysis View 1.1 | Partial | Timeline and source navigation exist in several panels; semantic zoom, twelve-track acceptance, and consolidated cinematic navigation still require proof. |
| Narrative Agent Graph 1.1 | Partial; strong operational base | Continuity, graph tickets, constellational evidence, and source return exist. Direct alias/merge/split, contested states, temporal relations, and full consumer parity remain. |
| Meaning Knowledge Graph 1.1 | Partial | Shared projections, relation tickets, and source navigation exist. Complete filtering, contradiction handling, dependency impact, and in-place semantic preview remain. |
| Cross-view integration | Partial | Reciprocal hydration works in bounded paths. A complete producer-consumer verification matrix is still required. |
| Measurement plan | Not yet sufficient as a release claim | Establish frozen media, baseline values, formulas, action counts, timings, and repeatable receipts before claiming improvement. |

The document is therefore accepted as an implementation guide after the contracts in Sections 3–15 are applied.

## 3. Authoritative Datascene design principles

### 3.1 Human authority and mature data

1. An explicit analyst confirmation is 100 percent authoritative for the confirmed claim at that revision.
2. It is saved canonically in the Master Schema as mature data with source, provenance, revision, and traceback.
3. A later correction may supersede it; the earlier decision remains traceable.
4. The same claim must not be presented as unreviewed or request a second confirmation in an associated consumer.
5. Repeated confirmation of an already mature claim adds a traceback event only when analytically useful; it does not create a duplicate semantic attribute.
6. Automatic confidence and analyst authority are distinct. An analyst confirmation must not be diluted by an automatic score.
7. Mature does not mean immutable. An analyst may revise a previously mature occurrence; the later decision becomes canonical while the earlier receipt remains traceable.
8. A confirmed Narrative Agent occurrence is authority for its linked occurrence and detector track. Re-harvested detections from that confirmed track must hydrate on that agent's row before similarity-based placement is considered.

### 3.2 Mature Data Proliferation — “saloon doors swing both ways”

Canonical decisions hydrate every associated consumer automatically. Corrections made in a consumer return through the Master Schema and refresh the producing and other consuming panels. The required flow is:

`select evidence -> act in context -> save canonically -> refresh the same field -> project everywhere -> preserve raw evidence and traceback`

Propagation is a projection of one governed claim, not duplication of the claim. Every projection exposes its canonical revision or a traceable reference to it.

### 3.3 Navigation belongs to the operating panel

Every navigation and governance action is delivered within the panel in which it is operationalized. Analysts must not be thrown from Audio to Narrative Agent, from a graph to an unrelated workbench, or from a detection list to an untraceable view merely to complete a decision.

Associated panels may hydrate in the background. They must not steal focus. Source navigation must return to the source time, frame, interval, geometry, transcript span, or evidence object while preserving the analyst's working context.

### 3.4 The schema does not equal a consumer

The Master Schema may hold many evidence and interpretation categories. Each consumer projects only the categories relevant to its analytical purpose. A consumer taxonomy must not redefine or suppress the canonical schema: the tail must not wag the dog.

In particular:

- `SPEAKER_00`, `SPEAKER_01`, and similar values are technical diarization labels, not Narrative Agents.
- A technical label may be retained in provenance but must not be exposed as the primary semantic family after a Narrative Agent is known.
- Narrative Agent confirmation is the analyst-facing operation; “identity confirmation” is legacy or implementation vocabulary only.
- Expressions remain expressions. They must not be collapsed into Narrative Agent, object, or scene categories.
- Music, silence, speech activity, Foley, objects, faces, visual concepts, sets, text, and interpretive relations keep their appropriate domain semantics.

### 3.5 No false operability

A visible control is a promise. It is not operational unless it produces a durable, inspectable result and visible feedback. Disabled, preview-only, or future controls must say so plainly.

Every mutation must provide:

- immediate calm local feedback;
- a canonical receipt or revision;
- refreshed state in the same panel;
- targeted downstream invalidation or hydration;
- an undo, supersession, or correction path where the action changes governed meaning.

### 3.6 Calm analytical surfaces

The primary analytical canvas stays visible. Provenance and supporting detail may be progressively disclosed, but missing, uncertain, stale, excluded, mature, and contested states must remain legible. Colour supports recognition without becoming the only carrier of meaning.

### 3.7 Cluster exploration and governed aggregation

Datascene uses cluster exploration to review repeated or similar source evidence at scale and governed aggregation to connect that evidence canonically. Clustering does not grant maturity, and aggregation does not erase individual samples, modality-specific uncertainty, exclusions, or provenance.

Semantic family governance is analyst-editable. The analyst may create a missing family, rename a family, merge aliases such as `James Bond`, `007`, and `JamesBond`, or move a previously mature sample to another family. These operations append lineage receipts and proliferate the resulting canonical label to associated graphs, BBoxes, panels, and reports; they never destroy the source observations or earlier decisions.

The analyst-facing family is semantic and domain-appropriate: a Narrative Agent, object, face, visual concept, set, Foley event, acoustic environment, textual pattern, or another meaningful family. Technical detector labels and embedding partitions remain provenance, not substitute analytical categories.

Every cluster surface must answer five questions before it asks for a decision:

1. What evidence holds this family together?
2. Which samples make its boundary uncertain or contradict it?
3. What was excluded or is missing, and why?
4. Where does the family occur across source time, scenes, space, and artefacts?
5. What samples, claims, graph relations, panels, and freshness states will a correction change?

The governed path is:

`sample -> detect/measure -> quality gate -> represent -> compare -> group -> rank -> review -> govern -> aggregate -> proliferate`

The best samples—not merely available samples—lead review. Selection considers quality, representativeness, ambiguity, temporal coverage, and diversity. One governed decision may update probabilities and queues for associated candidates, but it must not silently mature unconfirmed samples. Thresholds are previewed before commit, and merge, split, reassignment, exclusion, confirmation, and correction remain panel-local, source-linked, receipt-bearing actions.

### 3.8 Model changes append evidence; they do not erase it

Changing a detector, embedding motor, transcription provider, lens, or other
analytical model creates a new provenance-bearing evidence run. It does not
replace, hide, demote, or delete evidence produced by an earlier model.

All still-active runs remain available to associated analysis panels through a
governed union projection. Every observation retains its provider, model,
version, settings, run id, source coordinates, quality and artifact lineage so
the analyst can compare, filter, accept, reject, or retire a run deliberately.
Coincident observations may be clustered or deduplicated for display, but their
individual provenance remains traceable.

Most importantly, a model change never reopens an analyst-confirmed claim.
Mature Master Schema data remains mature and continues to proliferate to every
associated consumer. A later model may add supporting or contradictory
candidate evidence; only an explicit analyst correction may supersede the
confirmed claim. Datascene must never ask for a second confirmation merely
because the producing or current model changed.

## 4. Required evidence object and state contract

Every reviewable evidence object must carry, directly or by resolvable reference:

- project identifier;
- analysis identifier;
- source artefact identifier;
- source interval and, where relevant, frame, geometry, sample range, or transcript span;
- semantic category and technical source category;
- method, provider, and version;
- normalized effective settings;
- automatic confidence or measurement, when applicable;
- authority and maturity state;
- provenance and traceback;
- dependency identifiers;
- canonical revision and freshness state.

The minimum governed states are:

1. **raw** — measured or detected but not normalized for review;
2. **candidate** — eligible for analyst review or constellational inference;
3. **confirmed / mature** — explicitly confirmed or accepted under an approved automatic-maturity rule;
4. **contested** — contradictory evidence or a deliberately unresolved interpretation;
5. **invalidated / stale** — a dependency changed and the claim awaits targeted recomputation or review;
6. **excluded** — intentionally removed from a family or finding, with a reason;
7. **superseded** — replaced by a later governed decision while retained in history.

Missingness is explicit. Absence of a field must not silently mean zero, false, rejected, or unknown.

## 5. Operational iteration recipe

Every iteration uses the following eight steps and leaves an auditable artefact for each.

### Step 1 — Establish the real baseline

Record the current route, component, endpoint, schema object, persistence path, tests, known failure, and screenshots or fixtures. Establish whether the capability is absent, hidden, degraded, duplicated, stale, or merely hard to operate.

### Step 2 — State the weakness precisely

Describe one observable analyst failure. Examples include cross-artefact bleed, false operability, duplicate confirmation, technical labels replacing semantic families, missing source return, or a graph projection that fails to hydrate.

### Step 3 — Identify the reference merit

Name only the transferable merit from a mature external or internal reference: temporal legibility, purity communication, threshold preview, direct correction, provenance, graph readability, or reduced review labour. Do not copy product identity or incompatible architecture.

### Step 4 — Translate it into Datascene

Map the merit into Datascene vocabulary, Master Schema authority, panel-local navigation, source linking, maturity states, and existing components.

### Step 5 — Deliver the smallest complete slice

The slice must include data retrieval, rendering, action, persistence where applicable, same-panel feedback, propagation or invalidation, and verification. A read-only preview is valid only when explicitly labelled as preview and useful on its own.

### Step 6 — Test on controlled media

Use a fixed corpus and record expected evidence. Include at least one easy case, one ambiguous case, one exclusion, one correction, and one save/reopen path.

### Step 7 — Run the authority regression

Confirm that raw data remains preserved, analyst decisions dominate, mature claims are not re-asked, canonical revisions hydrate associated panels, and project/analysis/artifact boundaries prevent data bleed.

### Step 8 — Accept, revise, or reject

Record the decision, evidence, remaining gaps, and next bounded slice. “Visible in the UI” is not an acceptance criterion.

## 6. Required iteration artefacts

Each iteration ticket must contain:

- objective and analyst outcome;
- baseline evidence and file locations;
- explicit failure statement;
- affected schema and API contracts;
- panel and navigation contract;
- smallest implementation slice;
- automatic tests;
- rendered interaction test;
- manual acceptance script;
- measurement before and after;
- migration or compatibility note;
- rollback, correction, or supersession path;
- decision: accepted, accepted with qualification, revise, rejected, or deferred;
- remaining dependency and owner.

## 7. Cluster Detections 1.1 operational contract

### 7.1 Analytical goal

Cluster exploration converts large volumes of detections into reviewable semantic families while retaining the technical evidence that produced them. It must help the analyst understand family purity, coverage, ambiguity, exclusions, temporal distribution, and the effect of a correction.

### 7.2 Semantic family first

The primary cluster label is a reviewable semantic family appropriate to the domain:

- Narrative Agents for speech, voice, face, and multimodal agent evidence;
- named Foley families such as gunshots, car engines, footsteps, or doors;
- visual object, face, visual-concept, set, location, graphic, and scene families;
- textual entity, topic, phrase, discourse, or named-agent families;
- music and silence as source-linked acoustic categories when useful to analysis.

Technical families remain available in provenance. They are not maintained as analyst-facing categories when they add no analytical function.

### 7.3 Category-specific maturity policy

- **Narrative Agent:** analyst confirmation creates a mature Master Schema claim and a governed multimodal sample. Associated audio, visual, transcript, continuity, and graph consumers hydrate from it.
- **Speech activity:** automatic source-linked evidence; it is not itself a request to confirm a Narrative Agent.
- **Music and silence:** may mature automatically when method and quality requirements are satisfied; no confirmation tax is imposed merely to acknowledge their presence.
- **Foley:** semantically useful families are reviewable and may be confirmed, split, merged, reassigned, or excluded.
- **Visual objects, faces, concepts, and sets:** reviewable families include thumbnails, source navigation, representative/problematic examples, and governed actions.
- **Text:** reviewable families retain transcript or document spans and source return.

### 7.4 Required cluster surface

For every family, the cluster view shows:

- semantic family name and maturity;
- best representative sample;
- problematic or threshold-boundary sample;
- nearest competing family and ambiguity margin where measurable;
- included, eligible, reviewed, and excluded sample counts;
- sample coverage and review coverage;
- cohesion and the method used to calculate it;
- temporal distribution across the artefact;
- explicit exclusions and reasons;
- source navigation for every sample;
- affected consumers and expected propagation;
- available governed actions.

Visual families use thumbnails. Audio families use playable or source-navigable intervals and waveform context. Text families show readable spans. Every form remains source-linked.

### 7.5 Delivered boundary as of 24 October 2026

The audio semantic-family slice currently provides:

- Narrative Agent family naming rather than `SPEAKER_00` / `SPEAKER_01` as the primary concept;
- family cohesion, sample/time/review coverage;
- strongest representative;
- uncertain boundary sample;
- nearest competing family;
- explicit excluded samples and reasons;
- source navigation;
- a non-writing semantic threshold preview with a 65 percent baseline.

This is an accepted bounded slice. It is not complete Cluster Detections 1.1.

The visual Narrative Agent slice additionally provides compact multi-family
source crops inside the existing Narrative Agent panel, stable-evidence
de-duplication, an explicit unresolved/competing row, drag reassignment,
slightly enlarged unresolved review crops, checkbox multi-selection, batch
drag reassignment, batch confirmation, a canonical mature receipt, and
confirmed-only thumbnail projection into Narrative Agent graph, Meaning
Knowledge Graph, Audio and Transcript contexts. Ambiguous candidates cannot be
confirmed until assigned to a real Narrative Agent family.

This slice now measures candidate faces with the locally selected OpenCV YuNet
+ SFace motor. It records five landmarks, a 128-dimensional embedding hash,
face confidence, cosine similarity, the nearest competing family, and the
ambiguity margin. Scores remain measurements rather than calibrated identity
probabilities, and no candidate becomes mature without analyst confirmation.
Model files are explicitly installed and checksum verified; embedding vectors
remain local and are withheld from publication by default.

The bounded No Time To Die acceptance discriminated James Bond and Nomi using
7 and 3 measurable mature seeds respectively. Mixed-corpus calibration,
demographic performance assessment and general release accuracy claims remain
residual work.

The object-family slice now provides compact source-crop lineups in the existing
Objects panel, representative and boundary tracks, threshold and temporal
previews, multi-selection, drag staging, semantic reassignment, confirmation,
split and merge. Each committed operation produces mature source-linked `OBJ`
annotations plus a cluster lineage receipt; source tracks, BBoxes, detector
classes and previous families remain traceback evidence. Person tracks are
excluded because their semantic authority belongs to Narrative Agent. Object
appearance embeddings and calibrated competing-family scores remain the next
category-specific measurement dependency.

### 7.6 Remaining cluster operations

The following remain before Cluster Detections 1.1 can be called operationally complete:

The reusable structural workbench is now generalized across all 29 empirical
families. It provides actual source records, multi-selection, semantic
reassignment, batch confirm/defer/exclude receipts, threshold preview,
representative/boundary inspection, temporal distribution and domain-aware
consumer routing. Remaining work is therefore category mitigation rather than
creation of separate workbenches:

1. generalize the object slice's governed merge/split lineage pattern to Foley,
   set, visual-concept and textual families;
2. threshold commit separated from preview, with impact summary and rollback;
3. automatic targeted recomputation after a cluster decision and rendered
   verification of every associated consumer;
4. category-specific embedding, distance, purity and competing-family models
   for Foley, objects, sets, visual concepts and textual families;
5. register real set-recognition and visual-concept recurrence artifacts;
6. calibrate automatic maturity policies for music, silence and other measured
   categories that should not impose confirmation labour;
7. mixed-corpus acceptance and analyst-labour measurement.

### 7.7 Threshold contract

A threshold preview never writes. Before commit it shows:

- samples entering and leaving each family;
- changed exclusions;
- changed representative and boundary samples;
- cluster-count change;
- purity/cohesion and coverage deltas;
- affected mature claims and consumers;
- whether a human decision would become stale.

A threshold commit creates a new governed revision. It must not silently override mature analyst decisions.

### 7.8 Metric definitions

- **Cohesion:** mean pairwise similarity, or a documented robust equivalent, among included embedded samples.
- **Sample coverage:** included samples divided by eligible samples.
- **Temporal coverage:** union of included source intervals divided by the applicable source duration.
- **Review coverage:** samples with a governed decision divided by review-eligible samples.
- **Ambiguity margin:** strongest family score minus the nearest competing family score.
- **Fragmentation:** number of families representing one governed semantic entity.
- **Purity:** proportion of reviewed included samples belonging to the governed family.

These are descriptive analytical measures. They do not, by themselves, prove interpretive meaning or scientific significance.

## 8. Cinematic Analysis View 1.1 operational contract

The view must provide one coherent source-time workspace across video, audio, transcript, scenes, objects, expressions, Narrative Agents, and governed interpretation.

Required capabilities are:

- source-locked cursor and interval navigation;
- semantic zoom from overview to frame/sample/span;
- visible missingness, maturity, and freshness;
- panel-local confirmation and correction;
- compare anchors without losing the working context;
- selective track visibility and density control;
- source return from every summary, graph, report, and cluster;
- save/reopen and detached-panel parity.

Acceptance requires proof on the fixed corpus that at least twelve representative track types remain usable together without false synchronization, hidden missingness, or loss of source lineage.

## 9. Narrative Agent Graph 1.1 operational contract

Narrative Agents are multimodal governed entities, not face embeddings or diarization labels. Their evidence may include source metadata, visual occurrence, voice samples, transcript attribution, co-presence, lip synchrony, behaviour, expression, scene context, roles, and analyst interpretation.

The graph must:

- show evidence, relations, maturity, uncertainty, and provenance;
- distinguish presence, speaking, dialogue, participation, role, and interpretation;
- calculate constellational likelihood without converting it into false certainty;
- use mature confirmations to update related candidate probabilities;
- prevent duplicate confirmation of the same canonical claim;
- support direct alias, merge, split, correction, reject, defer, and contested states;
- show temporal distribution and narrative path;
- open evidence at source within the originating analytical context;
- hydrate Meaning Knowledge and other associated panels from the same canonical revision.

Source-media metadata that explicitly establishes a Narrative Agent or role is treated as 100 percent authoritative for that metadata claim, saved in the Master Schema, and projected to associated consumers. Its scope and provenance remain visible.

## 10. Meaning Knowledge Graph 1.1 operational contract

The Meaning Knowledge Graph supports reviewable interpretation rather than presenting machine output as settled meaning. Every interpretive relation must expose:

- eligible evidence;
- a warrant;
- alternatives;
- uncertainty;
- provenance;
- dependencies and freshness;
- analyst account or correction;
- canonical decision and history;
- source navigation.

Required direct operations are confirm, revise and confirm, reject, defer, mark contested, and inspect dependency impact. Graph and ticket views are projections of the same canonical relation and must update together.

## 11. Cross-view integration contract

Every producer-consumer relationship is recorded in a verification matrix containing:

- producing surface;
- canonical schema object;
- consuming surfaces;
- projection rule;
- maturity rule;
- invalidation trigger;
- source-return target;
- automatic test;
- rendered test;
- manual acceptance receipt.

At minimum, the matrix covers Audio, Video, Transcript, Objects, OCR, Expressions, Scene Cards, Source Media, Master Schema, Narrative Agent, Meaning Knowledge, POS, Quant, lenses, Analysis Report, and Data Book export/restore.

Project, analysis, and source-artefact membership are hard boundaries. Cross-project or cross-artefact evidence may appear only in an explicitly labelled comparison view. It must never bleed into a private artefact's candidate list.

## 12. Fixed-corpus measurement plan

The controlled corpus must include:

- dialogue with visible and off-screen speakers;
- overlapping speech and weak audio;
- recurring Narrative Agents;
- music, silence, speech, and multiple Foley families;
- repeated visual objects, faces, concepts, and sets;
- transcript and OCR evidence;
- ambiguous, excluded, and corrected detections;
- video, audio-only, text-only, image/graphic, web-page, and reference-data imports where supported.

For every slice record:

- analyst actions and elapsed time;
- number of samples reviewed per decision;
- duplicate prompts avoided;
- purity, cohesion, coverage, ambiguity, and fragmentation where applicable;
- source-navigation success;
- persistence and save/reopen success;
- cross-consumer parity;
- targeted rather than global invalidation;
- export and isolated restoration success.

Claims of reduced labour or improved accuracy require a baseline and a repeatable result, not an impression.

## 13. Acceptance layers

Every complete slice passes all three layers.

### 13.1 Contract and automated verification

Tests cover schema/API shape, scope boundaries, state transitions, persistence, propagation, invalidation, and regression behaviour.

### 13.2 Rendered interaction verification

A real rendered UI test proves that the analyst can see the evidence, navigate to source, act, receive feedback, and observe the resulting state without leaving the operating panel unexpectedly.

### 13.3 Manual analytical acceptance

An analyst runs the documented scenario on controlled media, records the canonical revision, saves and reopens, checks associated panels, tests correction, and verifies export/restore when the slice is publication-relevant.

Passing unit tests alone is not operational acceptance.

## 14. Ordered delivery slices

Keep each slice narrow and complete.

1. **Baseline and fixed corpus:** freeze fixtures, measures, terminology map, consumer matrix, and current screenshots.
2. **Cluster batch governance:** multi-select, confirm, exclude, and reassign within the cluster panel with receipts.
3. **Governed threshold commit:** impact preview, commit, selective recomputation, and rollback.
4. **Family merge and split:** direct operations, preserved lineage, canonical projection, and correction.
5. **Cross-consumer proliferation:** verify each relevant consumer, no duplicate prompts, and targeted invalidation.
6. **Mixed-category cluster parity:** visual, object, visual-concept, set, Foley, and text families with native evidence representations.
7. **Mixed-corpus measurement:** repeatable usability and accuracy evidence across import types and deployment contexts.
8. **Cinematic View completion:** semantic zoom, track parity, detached panels, and source return.
9. **Narrative Agent Graph completion:** temporal, contested, alias, merge/split, constellational, and lens paths.
10. **Meaning Knowledge Graph completion:** warrants, alternatives, contradictions, dependency impact, and report parity.

The order may change only when a documented dependency makes another small slice the shortest path to operational value.

## 15. Definition of done

A capability is done only when:

- it operates on real project data within project, analysis, and artefact boundaries;
- the evidence remains linked to source;
- the relevant panel contains the navigation and action;
- the action persists canonically and gives immediate calm feedback;
- mature analyst decisions proliferate to all associated consumers;
- the same claim is not requested twice;
- corrections preserve history and trigger targeted invalidation;
- raw evidence remains available;
- missingness, uncertainty, exclusions, freshness, and maturity are explicit;
- save/reopen and detached-panel behaviour are verified;
- relevant export and isolated restoration are verified;
- automated, rendered, and manual acceptance pass;
- before/after measures support the claimed improvement;
- documentation names any remaining qualification.

## 16. Do-not-rebuild register

Unless a failing contract proves otherwise, reuse:

- the global source clock and source-linked navigation;
- Master Schema authority and revision history;
- existing panel shell and detachable-panel patterns;
- mature-data projection paths;
- relation tickets and graph projections;
- analysis report and Data Book publication paths;
- existing detection, embedding, and clustering outputs;
- established Datascene vocabulary and visual language.

Replace or migrate only the smallest component that prevents the required outcome. Keep compatibility adapters where technical legacy labels remain necessary for stored analyses.

## 17. Change record from Recipe 1.1

Version 1.2 preserves Recipe 1.1's method and adds:

- an explicit operationalization assessment;
- canonical evidence fields and governed states;
- user-confirmation and no-duplicate-confirmation rules;
- reciprocal mature-data proliferation;
- panel-local navigation and focus protection;
- schema-versus-consumer separation;
- semantic-family rules for Narrative Agent, acoustic, visual, textual, object, concept, and set clusters;
- a no-false-operability rule;
- cluster exploration and governed aggregation as a first-class Datascene design principle;
- threshold preview and commit contracts;
- measurable cluster definitions;
- producer-consumer boundary and verification matrices;
- three-layer acceptance;
- a bounded delivery order and current delivered boundary.

## 18. Final control question

Before accepting any iteration, ask:

> Can an analyst understand the evidence, act on it in the current analytical context, trace the decision to source, observe the canonical result everywhere it belongs, correct it later without losing history, and complete the task with less labour and no loss of interpretive authority?

If any part of the answer is no, the capability remains partial.
