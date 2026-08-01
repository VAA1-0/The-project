# Working Handover — Test 13, Datascene Interaction, and Governed Publication

Date: 2026-07-31
Workspace: `The-project`
Branch: `petteri`
Acceptance analysis: `0b16df1c-bc47-4b24-b90f-4d34e53c68e4`
Source: `NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264 (7).mp4`

## Purpose

This handout records the Test 13 manual-acceptance thread, its corrective work,
the resulting Datascene interaction principles, and the expanded publication
requirement. It is the continuation point for the next sprint session.

## Sprint scope retained from the previous sprint

- Complete audio–visual–transcript interpretation and shot/music/speech/action
  relationships.
- Surface transcript-related Meaning Network and Narrative Agent graph
  projections.
- Analyse the forthcoming Stats Interpretation Schema when that work begins.
- Enforce maturity gates before interpretive prose.
- Complete shot-boundary merge, split, confirm, reject, density, long-take,
  persistence, export, and traceback proof.
- Audit dormant audio features, especially music classification and lyrics
  matching, as operational, deferred, or unavailable, including whether web
  confirmation is available.
- Continue release gates for performance observability, licensed dependencies,
  Quality Agent tickets, dormant features/dependencies, and full
  correction/recompute/export proof.

## Test 13 results to date

### Passed

1. Initial source/runtime readiness.
2. Visual cue presentation and source navigation.
3. StatsKit measured evidence:
   - Category and dependent Subcategory navigation;
   - entry search;
   - governed measured-source selection;
   - 118 true shot intervals;
   - 155 spatial-tone windows;
   - shot and scene records kept distinct;
   - source-linked navigation.
4. Matcher/meaning measurement projection:
   - 118 `shot_boundary_interval` events;
   - 155 `measured_visual_tone` events;
   - authority remains `measured_source_evidence`;
   - semantic promotion remains false;
   - deterministic projection is automatic when governed measurement artifacts
     change.
5. Measured-shot traceback:
   - exact source interval;
   - artifact evidence reference;
   - authority;
   - working source navigation;
   - Tools and Video ownership preserved.
6. Save/reopen persistence:
   - shot and tone measurements survive reopen;
   - meaning projections survive reopen;
   - source-time correlations and Video navigation remain available.

### Blocked by corrected scope

7. Export cannot be accepted against the existing flat ZIP bundle. The current
   bundle is an output-file whitelist plus a saved-work manifest. It does not
   prove that every panel and feature contributes complete data, and the current
   Markdown report is only a scene-card draft.

## Delivered corrective work

### Saved-analysis hydration

Persisted `shot_boundaries.json`, `spatial_tone_scan.json`, and
`adaptive_visual_scan.json` are restored into the runtime visual-analysis model.
This prevents saved analyses from showing artifacts on disk while downstream
panels report missing evidence.

### StatsKit navigation and evidence

StatsKit now supports category/subcategory navigation, entry search, governed
measured-source selection, and timed evidence inspection. Visual-shot taxonomy
rows resolve shot records without treating scenes as shots.

### Datascene interaction regime

The Meaning Network context menu is the visual and behavioral base for the
Datascene right-click regime. Governed records use the recognizable action
grammar: copy, local sheet, matcher/correlation, eligible confirmation, source
jump, and traceback. Browser-native context menus and blocking
`prompt`/`alert`/`confirm` dialogs are not valid analytical work surfaces.

Corrections remain attached to their originating row or field. Navigation to a
different panel is explicit and cannot act as filler for a missing local
interaction. A panel-shell fallback prevents the browser menu from masquerading
as application functionality, but it must not fabricate record-specific actions.

### Matcher/meaning sheet correction

The first shot-row popup was rejected because it was a second generic menu. The
replacement follows the Meaning Network base and opens a local evidence sheet.
The sheet shows the governed inventory, source-time transcript/audio/tone
correlations, meaning projection counts, and the non-semantic authority policy.

Early versions exposed ceremonial `Run bounded matcher` and `Rebuild meaning
artifacts` controls. Manual review correctly identified these as “Bonk”: the
generic matcher returned noisy global catalogue candidates, and rebuild could
claim completion while producing zero events. The final design removes those
plumbing controls and the unrelated candidate list from the bounded shot view.

Measured projections now rebuild automatically when shot, spatial-tone, or
adaptive-visual measurements are persisted. Analyst action is reserved for
ambiguous correction, interpretation, confirmation, rejection, and promotion.

### Rebuild boundary repair

The meaning builder now accepts `measured_visual_tone` and
`shot_boundary_interval` as explicit non-semantic feature events. The rebuild
resolves required shot/tone/adaptive artifacts itself rather than depending on a
prior dashboard hydration side effect. The refresh endpoint returns a verified
projection receipt and cannot claim successful completeness when required event
counts are zero.

## Publication requirement replacing the old export test

Export is one governed publication system producing two synchronized works from
the same canonical evidence snapshot.

### Machine-readable Data Book

The Data Book has a manifest and feature-oriented chapters. Every registered
panel/feature receives a chapter containing, where applicable:

- operational state: `operational`, `partial`, `deferred`, `unavailable`, or
  `not run`;
- schemas and records;
- source/video/time/geometry anchors;
- methods, parameters, versions, dependencies, and provider disclosures;
- authority, maturity, evidence quality, and review state;
- corrections, decisions, invalidations, and recomputation history;
- provenance, traceback references, and checksums;
- licensing, paid/remote, web-confirmation, and copyright-sensitive boundaries;
- an explicit governed explanation when no records exist.

The completeness gate fails when an operational panel has neither a populated
chapter nor an explicit governed empty-state explanation.

### Human-readable Scientific Report

The Scientific Report is rendered from report-eligible governed claims and Data
Book citations. It uses clear scientific prose while distinguishing:

- measurements;
- findings;
- candidate interpretations;
- analyst-confirmed interpretations;
- conflicts and counter-evidence;
- limitations and unavailable evidence.

Every evidential sentence must resolve to a Data Book chapter, record, and source
location. Reporting cannot invent propositions, hide uncertainty, resolve
conflicts, or promote maturity merely to produce smoother prose.

## Publication scopes

### Per-video edition

One independently complete, portable, reopenable Data Book and Scientific Report
for one video-associated analysis. Every record and citation carries video and
analysis identity. Reanalysis versions remain distinct editions.

### Whole-project edition

One Project Data Book and Project Scientific Report for a selected governed set
of video analyses. It retains immutable per-video manifests and adds:

- project inventory;
- cross-video entity/theme mappings;
- comparison tables and aggregate statistics;
- conflicts, coverage gaps, and project provenance;
- population, inclusion/exclusion, weighting, method, and missing-data policy;
- contributing per-video checksums.

Project publication is not concatenation. It must not flatten video identities,
source clocks, authorities, correction histories, or incompatible analysis
versions. Every cross-video statement cites its contributing video edition,
chapter, record, and source location.

## Current runtime at handover

- Frontend: `http://127.0.0.1:3001/dashboard`
- Backend: `http://127.0.0.1:8000`
- Both services returned HTTP 200 after the final restart.
- The live projection endpoint returned 118 shot events and 155 tone events and
  the persisted multimodal artifact contained the same counts.

Canonical startup commands:

```bash
conda run -n vaa1_core python -m uvicorn api_server:app --host 127.0.0.1 --port 8000

cd src/frontend
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3001
```

## Validation at handover

- Frontend TypeScript: passed.
- Frontend governance suite: 67/67 passed.
- Focused backend visual/matcher contracts: 14/14 passed.
- Earlier Test 13 focused backend preflight: 23 tests passed.
- Diff integrity: passed.

## Important remaining debt

- The existing Download panel still uses browser-native confirmation and alert
  dialogs and therefore violates the new Datascene interaction principle.
- Other legacy panels also retain `prompt`, `alert`, or `confirm`; they require a
  systematic migration, not a claim of program-wide completion.
- Shot-boundary merge, split, confirm, reject, density, and long-take reporting
  remain sprint work.
- Full audio–visual–transcript and shot/music/speech/action correlations remain
  incomplete.
- Meaning Network and Narrative Agent transcript projections require explicit
  acceptance.
- The Stats Interpretation Schema has not yet been supplied/analyzed.
- Dormant music classification, lyrics matching, web-confirmation availability,
  dependencies, licensing, performance observability, and Quality Agent gates
  remain to be audited.
- The Data Book registry, completeness validator, publication bundle, scientific
  report renderer, and per-video/project UI have not yet been implemented.

## Recommended next implementation sequence

1. Define a canonical feature-publication registry covering every panel and
   backend-only operational feature.
2. Define versioned Data Book manifest, chapter, record-reference, and
   completeness schemas.
3. Build per-video chapter projections from canonical governed data, including
   explicit empty/unavailable states.
4. Build and test the per-video completeness validator and deterministic archive.
5. Connect verified report claims to a scientific prose renderer with
   sentence-level Data Book citations.
6. Add project-edition composition without flattening video identities or clocks.
7. Replace Download panel browser dialogs with the Datascene in-panel publication
   workflow and progress/result states.
8. Prove generate → save → close → reopen → export → checksum → report sentence →
   Data Book record → source evidence for both publication scopes.

## Governing documents

- `docs/vaa1_visual_detection_corrective_integration_manual_acceptance_2026-07-30.md`
- `docs/vaa1_mature_data_surface_governance_principle_2026-05-08.md`
- `docs/vaa1_governed_audio_visual_detection_integration_sprint_2026-07-30.md`
- `docs/vaa1_general_sprint_regime_remaining_tasks.md`
- `docs/sprint_program_native_stats_interpretation_prerequisites_bonus_2026-07-15.md`
