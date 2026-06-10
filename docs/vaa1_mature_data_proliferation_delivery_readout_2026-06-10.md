# VAA1 Mature Data Proliferation Delivery Readout

Date: 2026-06-10

Purpose: surface the current delivery state of the Mature Data Proliferation Regime so the multimodality capability promise is inspectable, not merely aspirational.

## Core Promise

Corrected data should stand corrected everywhere except traceback.

That means mature evidence can spread across panels only when it carries enough governance to answer:

- What source evidence supports this claim?
- What time, coordinate, subject, scene, or modality does it belong to?
- Who or what has authority for the claim?
- Is it mature, candidate, weak, canceled, deferred, or raw?
- Which panels may project it?
- Can the user trace back to the evidence chain?

## Delivered And Guarded

### Canonical mature-evidence view

- `VideoService` builds a single resolved mature evidence view from Master Schema records, manual visual annotations, corrected objects, agent persistence labels, and proliferation match records.
- Master Schema and manual mature subject records enter the resolved view before raw panel records.
- Proliferation match summaries are carried into frontend analysis data before raw transcript or panel fallbacks.

Proof:

- `src/frontend/tests/mature-data-proliferation-feedback-loop.test.mjs`
- `src/frontend/tests/mature-data-proliferation.test.mjs`
- `cd src/frontend && npm test`

### BBox/ROI mature-label priority

- Video BBox/ROI overlays consult Master Schema resolved evidence, manual visual annotations, and agent-persistence labels before raw detector labels.
- Manual BBox identity corrections persist as mature track authority separately from timestamp-scoped geometry.
- Grouped object overlays retain represented track ids for mature lookup.
- Raw detections are still available as substrate/traceback, but they do not silently override governed labels.

Proof:

- `src/frontend/tests/mature-data-proliferation-feedback-loop.test.mjs`
- `src/frontend/tests/manual-annotation-governance.test.mjs`
- `src/frontend/e2e/bbox-roi-rendered-authority.spec.ts`
- `cd src/frontend && npx playwright test`

### Candidate-only proliferation gate

- Proliferation decisions have a canonical-save guard through `requireSavedProliferationDecision`.
- Candidate decisions retain source traceback refs, source anchors/evidence refs, projection targets, source panel, source verification status, and source-range provenance.
- Only `confirmed` decisions receive `proliferates_to` targets or create mature label correction rules.
- Canceled, deferred, inspected, weak, or unresolved candidates remain ledgered review decisions without mature propagation targets.
- The UI verifies the backend returned the saved proliferation decision before installing local projections.

Proof:

- `src/frontend/tests/mature-data-proliferation-feedback-loop.test.mjs`
- `src/frontend/lib/annotation-corrections.ts`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`

### Master Schema maturity and backend contract

- Backend contract proves Master Schema routes source metadata, manual/CVAT BBox evidence, narrative agent profiles, maturity audit, and panel consumer expectations.
- Agent persistence runs only when scene cuts, tracks, and comparable features are available.
- Empty agent-persistence artifacts are still persisted traceably when comparable feature clouds are missing.

Proof:

- `tests/test_mature_data_proliferation_feedback_loop_contract.py`
- Verified with `conda run -n vaa1_core python -m unittest tests.test_mature_data_proliferation_feedback_loop_contract`

### Multimodal surfaces currently represented

The current proof covers mature-data movement across:

- Master Schema resolved evidence.
- Video BBox/ROI overlays and editor.
- Manual visual annotations and object tracks.
- Narrative Agent profiles and agent persistence labels.
- Meaning / Plot character-by-scene consumption.
- Master Schema panel proliferation-match navigation.
- Scene governance helpers.
- Second-order affirmation chips.
- Traceback/evidence refs in governed overlay routes.

## What This Means

The Mature Data Proliferation Regime is operational for the main governed loop:

```text
manual/source evidence
-> canonical correction or Master Schema record
-> mature resolved evidence view
-> panel projections
-> candidate decision ledger
-> confirmed-only mature propagation
-> traceback retained
```

This is enough to say the promise is working in the protected frontend/backend contract layer, especially for the BBox/ROI + Master Schema + Narrative Agent corridor.

## Remaining Peace-Of-Mind Gaps

These are not proof that the regime is broken. They are the remaining places where release confidence still depends too much on source-contract tests rather than rendered or saved-state proof.

1. Rendered candidate controls:
   - Need Playwright proof that near-match candidates surface in the live BBox/ROI UI with confirm/cancel/defer/inspect controls.

2. Rendered mature-label priority:
   - Need Playwright proof in the live dashboard that mature Master Schema/manual labels visibly outrank raw detector labels after project reopen or refresh.

3. Traceback navigation:
   - Need Playwright proof that a governed BBox/ROI or Master Schema claim opens the traceback drawer and carries source jump actions.

4. Save/reopen authority:
   - Need a deterministic saved-analysis fixture proving persisted annotations reload with exact manual `geometry_keyframes`, mature labels, and candidate ledgers intact.

5. Cross-modal expansion:
   - Transcript, POS/Quant, audio prosody, scene cards, and Meaning Network have source-link/governance pieces, but they need a larger integrated rendered test proving a mature claim is synchronized across multiple modalities at once.

6. Export/report proof:
   - Reports and exports still need proof that mature projections, raw substrate, inactive traceback history, and candidate ledgers survive export.

7. Audiovisual source sampling operationalization:
   - The source sampler and sample-cloud contracts exist, and the matcher can read `source_samples`, visual sample clouds, and audio sample clouds.
   - They are not yet operationalized as a normal mature-data proliferation substrate: source samples are not automatically created from high-value confirmations, not routinely attached to candidate promotion decisions, and not yet surfaced as a visible cross-modal readiness lane.
   - This leaves the system too dependent on text/track/local manual anchors when the intended Datascene promise is audiovisual: source image crops, source audio windows, sample clouds, and traceback should become first-class evidence for dynamic proliferation.

## Accepted V2 Pipeline Addition

The pasted "VAA1 / Datascene Mature Data Proliferation Regime Overhaul v2" schema should be accepted as the architecture direction for the next pipeline increment. It matches the artifact audit: the current regime is partially operational, but not yet true live proliferation.

Canonical schema file:

- `docs/schemas/vaa1_mature_data_proliferation_regime_overhaul_v2.schema.json`

### Core diagnosis to carry forward

1. On-demand matcher:
   - `/api/analysis/{id}/proliferation/match` is currently request-driven, not a live bus.
   - Required move: introduce signal-triggered and sweep-triggered proliferation workers.

2. Match output is not promotion:
   - Candidate files can exist while `proliferation_decisions` remains empty.
   - Required move: introduce explicit promotion records, eligibility checks, decision persistence, and projection events.

3. Conservative policy blocks dynamic leverage:
   - The current policy protects authority well, but it treats most non-user-confirmed evidence as review-only.
   - Required move: separate `confirmed_mature` authority from `governed_mature_hypothesis` so supported hypotheses can be visible with review state.

4. Scene-local evidence does not become continuity:
   - Scene Cards consume manual annotations by direct overlap only.
   - Required move: add scene-to-scene continuity sweeps for Narrative Agents, objects, speakers, relations, roles, and presence intervals.

5. Saved-work hydration gap:
   - Artifacts can exist on disk without being fully hydrated into matcher/status state.
   - Required move: fail matching when an artifact exists but is absent from canonical hydrated status.

6. Meaning Network continuity is missing:
   - Current inspected analyses show no meaningful continuity anchors or relation edges.
   - Required move: build Meaning Network continuity anchors and edges from mature objects and governed hypotheses.

7. Audiovisual source sampling is not operationalized:
   - Source samples and sample clouds must become normal promotion substrate, not optional forensic side artifacts.

### Target architecture

The next pipeline should be the `Live Mature Data Proliferation Bus`:

```text
source artifact hydration
-> evidence normalization
-> Master Schema registration
-> maturity scoring
-> candidate generation
-> promotion eligibility check
-> promotion decision ledger
-> live proliferation bus event
-> panel projection
-> Meaning Network continuity update
-> traceback update
-> quality-agent audit
-> export/report sync
```

Non-negotiables:

- Manual correction and manual confirmation win.
- Candidate is not promotion.
- Promotion requires a ledger entry.
- Raw detection never overrides mature data.
- Visible mature claims require traceback.
- Saved analyses hydrate before matching.
- Scene-local evidence can generate cross-scene hypotheses.
- Meaning Network carries continuity anchors and relation edges.
- SOM/open topology is diagnostic, not authority.

### Required backend modules

The v2 delivery should be decomposed into these implementation modules:

- `src/backend/analysis/saved_analysis_hydration_loader.py`
  - Hydrates Master Schema, corrections, tracked objects, source samples, sample clouds, transcript, diarization, scene segments, scene cards, Meaning Network, and existing decisions before matching.

- `src/backend/analysis/live_mature_data_proliferation_bus.py`
  - Runs on `analysis_completed`, `manual_annotation_saved`, `manual_correction_saved`, `candidate_confirmed`, `metadata_saved`, `source_samples_created`, `tracked_objects_hydrated`, `meaning_network_rebuilt`, and `project_reopened`.

- `src/backend/analysis/mature_data_promotion_engine.py`
  - Converts candidates into `confirmed_mature`, `governed_mature_hypothesis`, `review_candidate`, or `blocked_or_rejected` only through explicit decision records.

- `src/backend/analysis/scene_continuity_sweeper.py`
  - Generates continuity hypotheses for same agent/object/speaker, visual/audio sample cloud reappearance, object reappearance, relation continuity, role continuity, and presence interval expansion.

- `src/backend/analysis/meaning_network_continuity_builder.py`
  - Writes Meaning Network continuity anchors and relation edges from mature and governed-hypothesis records.

### First acceptance tests for v2

1. Reopen a saved analysis and assert every disk artifact needed for proliferation is hydrated into canonical status.
2. Save one manual BBox/ROI confirmation and assert the live bus creates a promotion-candidate sweep without a user pressing Proliferate.
3. Confirm a candidate and assert a promotion decision appears before any mature projection.
4. Assert a governed mature hypothesis can project visibly with review badge, without claiming manual authority.
5. Assert scene 1 confirmation can create scene 2/3 continuity hypotheses when tracks, source samples, or sample clouds support it.
6. Assert Meaning Network gains continuity anchors and edges after the sweep.
7. Assert source image/audio samples and sample clouds are attached to candidate evidence refs and traceback.

## Recommended Next Delivery Slice

Build a deterministic saved-analysis fixture for the Bond/Felix, police-car, or Brazil presenter/reporter continuity case, then add Playwright and backend tests for:

1. Open saved analysis and run hydration audit.
2. Verify BBox/ROI mature label priority over raw object label.
3. Trigger the live bus from a manual confirmation.
4. Open candidate controls and confirm one candidate.
5. Verify canonical promotion decision before UI projection.
6. Verify governed mature hypothesis projection carries a review badge.
7. Reload dashboard or reopen project.
8. Verify mature projection, candidate ledger, source anchors, source samples, Meaning Network continuity, and traceback are still present.

That slice would turn the current contract confidence into stronger release confidence.
