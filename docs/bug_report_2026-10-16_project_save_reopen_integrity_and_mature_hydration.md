# Critical Bug Report: Project Save/Reopen Integrity, Hermetic Boundaries, and Mature-Data Hydration

Date: 2026-10-16

Severity: Critical / release-blocking project-integrity, persistence, provenance, and analyst-trust failure

Status: Incident recovered; durable product contract and complete acceptance matrix remain open

Affected project: `bond-cop30-helsinki`

## Executive summary

Datascene did not maintain a steady, professionally reliable record of the human research project across save, restart, and reopen. The analyst's project is one hermeneutic whole containing six sources:

1. *No Time to Die* trailer;
2. *Diamonds Are Forever* trailer;
3. Brazil long;
4. Brazil short;
5. the approximately 30-second YLE clip with Minister Sari Multala; and
6. the October 2023 Helsinki interview scene with Monty Python's *Galaxy Song* in the background.

The first reopened archive surfaced only the *No Time to Die* analysis. A historical five-analysis archive contained both Bond trailers, both Brazil sources, and the Sari Multala YLE clip, while the richly annotated Helsinki/Galaxy Song analysis survived in a separate saved-analysis bundle. The Helsinki bundle also used a legacy prefixed saved-work manifest; on its first combined import, Datascene failed to recover the customer-facing filename and displayed an internal UUID filename instead.

The incident demonstrates that a technically readable ZIP is not necessarily a faithful saved project. Project save/reopen must preserve the human project definition, every source, every analyst correction, every BBox/ROI geometry and interval, every governed maturity state, and the provenance needed to hydrate all associated panels. Opening a project must never admit external analysis data through catalogue fallback, shared event state, restored panel props, caches, generic project IDs, or artifact discovery. Cross-project material may enter only through an explicit analyst-controlled reference-data operation that records its origin and relation without silently changing project membership.

The governing requirement is simple:

> Save must mean lossless, atomic, verifiable preservation. Open must mean hermetic, provenance-checked restoration of the same project revision and its most mature valid data arrays.

Anything less produces a fragmented and contradictory analytical environment rather than a respectful hermeneutic whole.

## User-visible incident

The 16 October recovery exposed several distinct failures:

- Datascene initially reopened `bond-cop30-helsinki` with only one analysis.
- The visible project name suggested the complete project even though five expected sources were absent.
- The legacy project archive used the generic identity `vaa1_project`, not the stable human project ID.
- The complete human project was split across a five-analysis project archive and a separate Helsinki saved-analysis archive.
- The first Helsinki import surfaced an internal UUID filename because the importer did not recognize its prefixed legacy manifest as the canonical saved-work manifest.
- A deep-linked valid Bond analysis was briefly rejected as foreign because the analysis selection raced authoritative project-membership hydration.
- Earlier incidents show that restored annotations and BBoxes can remain on disk while panels surface sparse or empty projections.

The final recovered project contains exactly six records under `bond-cop30-helsinki`. The Helsinki/Galaxy Song record retains at least:

- 3 manual visual annotations;
- 46 label overrides; and
- 4 text corrections.

The recovered *No Time to Die* record previously demonstrated 99 manual visual annotations, 12 label overrides, and governed presence intervals. These records prove why a sparse active projection must never outrank a richer valid saved ledger.

## Relationship to earlier incidents

This report consolidates and raises the acceptance bar established by:

- [Project Data Mixup and Restored Annotations Hidden by Incomplete Hydration](./bug_report_2026-08-31_project_mixup_and_restored_annotation_hydration.md), which documented incomplete membership propagation, hidden imported correction ledgers, divergent saved editions, and the requirement to select and reconcile the most mature valid profile;
- [Systemic Meta Bleeding Across Project Boundaries](./bug_report_2026-10-01_systemic_meta_bleeding_project_boundary.md), which documented a foreign active analysis populating Video and downstream panels while the visible project heading remained unchanged;
- [BBox Save Starvation and Missing Associated-Panel Refresh](./bug_report_2026-10-13_bbox_correction_save_lock_starvation.md), which required a saved BBox confirmation to surface in all associated consumers;
- [BBox/ROI Coordinate Authority handover](./working_handover_handout_2026-06-01_Y_bbox_roi_thread.md), which establishes that analyst-confirmed time, geometry, dimensions, and labels cannot be overruled by automated detections or proliferation; and
- [Annotation Ledgers Hidden by Stale Status Records](./bug_report_2026-08-06_annotation_ledgers_hidden_by_stale_status_records.md), which documented stale in-memory records outranking more mature correction ledgers on disk.

The recurrence shows that local fixes are insufficient unless save, import, membership, canonical revision selection, and every panel consumer share one enforced project-and-analysis identity contract.

## Confirmed failure mechanisms

### 1. Project identity was descriptive rather than constitutive

Older project bundles used `vaa1_project` as a generic manifest name. A bundle could therefore be presented as Bond/COP30/Helsinki without carrying a stable `project_id` proving that identity. Project identity must be a required signed/hashed manifest field, not a UI label inferred after import.

### 2. Project completeness was not verified

Datascene accepted and surfaced a one-analysis archive as the complete human project. There was no pre-open comparison between declared project membership, historical project inventory, source hashes, and the analyst's expected corpus.

### 3. A human project was split across save artifacts

Five sources survived in one project archive and the Helsinki scene survived in a separate analysis archive. Save Project did not prove that every active project member had been included, nor did Open Project report that the restored corpus was incomplete relative to the saved project definition.

### 4. Legacy manifest naming degraded identity

The Helsinki archive contained a prefixed saved-work manifest. The importer recovered the data but initially substituted an internal source UUID as the visible filename. Import must recognize supported legacy manifests deterministically, validate their internal analysis identity, and normalize them without losing provenance.

### 5. Selection raced project membership hydration

A valid deep-linked Bond analysis ID was emitted before the authoritative project catalogue had completed. The fail-closed event guard correctly rejected IDs not yet in its allowlist, but incorrectly treated “membership not loaded” as “membership disproven.” Valid selection must wait for authoritative membership; it must never weaken the boundary or manufacture a violation from a loading race.

### 6. Rich persisted data can lose to sparse projections

Past incidents show multiple representations of corrections and mature data:

- canonical correction sidecar;
- embedded analysis record;
- imported saved-work artifact;
- Master Schema review layer;
- canonical decision ledger;
- mature-data proliferation projection;
- panel-local cache or restored state.

Filesystem location, newest file timestamp, current-run status, or first successful response cannot decide authority. A sparse newly generated projection must never displace a richer valid analyst-confirmed ledger.

### 7. Panel hydration is not yet one transactional projection

Video overlays, BBox/Objects, Master Schema, Narrative Agent, Meaning/Plot, Transcript, Audio, Scene Cards, Search, StatsKit, and Traceback can hydrate through different routes and timing. This permits one consumer to show mature data while another shows raw detection, stale data, or no data.

## Professional save contract

`Save Project` must perform a transactional checkpoint with these properties:

1. **Stable identity:** require `project_id`, project revision, project name, created-at, saved-at, and parent revision.
2. **Complete inventory:** enumerate every project analysis, source hash, source filename, media availability, artifact inventory, correction ledger, decision ledger, and panel projection revision.
3. **Lossless analyst work:** include or securely reference every user-authored metadata field, transcript correction, Narrative Agent confirmation, audio confirmation, BBox/ROI record, manual keyframe, time interval, geometry, note, relation, and rejection.
4. **Canonical maturity:** identify the canonical correction/profile revision and record why it outranks alternatives.
5. **Immutable evidence:** preserve raw detections and superseded history for traceback without allowing them to override current analyst-confirmed truth.
6. **Atomicity:** write to a staging archive, validate it, compute hashes, then publish it as one committed revision. A failed save must leave the prior committed save untouched.
7. **Read-after-write verification:** reopen the staged bundle in isolation and compare semantic values and counts before reporting `Saved`.
8. **No silent omissions:** skipped analyses or artifacts make the result `Save incomplete`, not `Saved`.
9. **Usable receipt:** show the committed revision, analysis count, source count, annotation counts, BBox count, byte size, checksum, and any declared gaps in the UI.
10. **Portable boundary:** include sufficient project membership and provenance information for another machine to reopen the same hermeneutic whole.

## Professional open/restart contract

`Open Saved Project` must be a two-phase, fail-closed operation:

### Phase A: validate without changing the workspace

- parse and validate the project manifest;
- require a stable project ID and revision;
- inventory all analyses and artifacts;
- verify file hashes and source/analysis relationships;
- detect duplicate, missing, divergent, foreign, and legacy records;
- reconcile supported legacy manifest names explicitly;
- compare available ledgers and select the most mature valid canonical profile;
- show the analyst an import report before commitment.

### Phase B: commit atomically

- register all members under exactly the manifest project ID;
- isolate caches, layouts, event state, Global Clock state, and panel state by project and revision;
- hydrate the complete project or retain the prior workspace unchanged;
- report `Opened`, `Opened with declared gaps`, or `Rejected`; never silently show a partial project as complete.

No analysis from another project may surface in the catalogue, Video, panels, knowledge graphs, search index, cache, layout, statistics, or exported report. The only permitted cross-project path is an explicit **Add reference data** operation initiated by the analyst. Reference data must retain its source project ID, relation, access scope, and read-only/reference authority. It must not silently become a project member or canonical evidence.

## Most mature valid data-array rule

Datascene must select the canonical array by governed authority and lineage, not merely by size or recency.

The resolver must:

1. group candidate records by source identity, analysis lineage, project ID, and semantic field;
2. reject corrupt, foreign-project, invalidated, or incompatible-revision candidates;
3. privilege explicit analyst confirmation over automated inference;
4. retain the full latest valid analyst-confirmed record, including label, interval, geometry, dimensions, keyframes, notes, and provenance;
5. merge only non-conflicting additions under an auditable rule;
6. preserve superseded records as traceback history;
7. expose conflicts for analyst resolution rather than silently choosing;
8. prevent an empty or sparse current-run projection from overwriting richer persisted data; and
9. issue one canonical revision consumed by every panel.

“Most mature” must not mean “largest array wins.” It means the highest-authority, valid, project-compatible, lineage-reconciled revision, with explicit conflict handling.

## Required UI hydration matrix

After save, restart, or reopen, the same canonical revision must surface in:

| Consumer | Required restored state |
|---|---|
| Project | Correct project identity, six-source inventory, revision, integrity status |
| Video | Correct source, duration, Global Clock, mature overlays |
| BBox/Objects | Analyst label, exact interval, canonical geometry, dimensions, manual keyframes, authority |
| Master Schema | Same confirmed records and revision as Video/BBox |
| Narrative Agent graph | Confirmed agents, aliases, tracks, paths, relations, provenance |
| Meaning/Plot graph | Mature nodes and edges with evidence links and validity |
| Transcript | Text corrections, speaker/Narrative Agent confirmations, time bounds |
| Audio/VAD | Confirmed speaker/source assignments, intervals, linked transcript evidence |
| OCR and Expressions | Corrected labels and associated source-time evidence |
| Scene Cards and Search | Project-bounded mature evidence, never stale foreign indexes |
| StatsKit | Measurements computed from the same project revision and maturity state |
| Traceback | Raw detection, confirmation, supersession, proliferation, and current canonical revision |

Hydration must be revision-aware. A panel may show `updating` or `stale`, but it must not silently fall back to a contradictory raw detection. Failure in one consumer must not erase the canonical correction.

## BBox/ROI acceptance requirements

For every analyst-confirmed BBox/ROI:

1. Save persists label, category, role/identity, start and end time, x/y/width/height, coordinate system, source dimensions, keyframes, notes, and authority.
2. Immediate readback returns the same semantic record.
3. Video and Objects render from the same canonical geometry transform.
4. Resize, fullscreen, playback, seeking, and detached panels do not mutate geometry.
5. Restart and saved-project reopen return bitwise-equivalent canonical values or a documented normalization with semantic equivalence.
6. Automated tracking and proliferation may propose candidates but cannot overwrite manual anchors.
7. The confirmation surfaces in Master Schema, Narrative Agent, Meaning/Plot, Search, Scene Cards where relevant, and Traceback.
8. A downstream hydration failure names the stale consumer and offers scoped retry; it never reports the correction as absent.

## Release-blocking acceptance tests

### Save/reopen parity

1. Save a six-analysis project through the visible Datascene File menu.
2. Verify the bundle declares exactly six analyses and zero silent skips.
3. Restart frontend and backend.
4. Open the saved project through the visible Datascene File menu.
5. Verify the same six sources, hashes, names, project ID, and project revision.
6. Compare correction and decision ledgers semantically before and after; all counts and values must match.

### Hermetic boundary

7. Seed the machine with unrelated projects and cached layouts.
8. Open only `bond-cop30-helsinki`.
9. Verify zero foreign catalogue rows and zero foreign artifact requests.
10. Pass foreign IDs through URL parameters, event state, restored props, caches, Search, graphs, and detached panels; every path must fail closed before hydration.
11. Add one external item through **Add reference data** and verify it is visibly reference-scoped, provenance-bearing, and not a project member.

### Mature-data and BBox parity

12. Confirm known mature ledgers, including the recovered Helsinki annotations and richer Bond BBox arrays.
13. Verify the canonical resolver chooses the highest-authority valid revision rather than a sparse current-run copy.
14. At representative Global Clock beats, compare Video overlay, Objects/BBox, Master Schema, Narrative Agent, Meaning/Plot, Transcript/Audio, and Traceback values.
15. Restart and reopen; repeat the same comparisons.
16. Save a BBox correction, then verify exact label, interval, geometry, dimensions, and keyframes before and after restart.

### Failure behavior

17. Remove one nonessential projection from a test bundle; Open must disclose a precise gap and retain canonical corrections.
18. Corrupt a hash; Open must reject the commit and leave the existing workspace unchanged.
19. Interrupt Save; the prior committed revision must remain reopenable.
20. Simulate panel hydration failure; the panel must show `stale/retry`, not `not available`, until governed rehydration attempts are exhausted.

## Required product surfaces

- **Project Integrity** badge and inspectable report in the Project panel.
- **Save receipt** with revision, counts, hashes, gaps, and verification result.
- **Open preview** listing project membership before workspace mutation.
- **Compare saved revisions** and **Recover mature data** actions.
- **Add reference data** as the only explicit cross-project ingress.
- Per-panel revision and hydration state.
- Annotation integrity badge showing the active ledger origin and counts.
- Visible conflict resolution when mature editions diverge.

## Current recovery evidence

The recovered runtime project now contains exactly six analyses, each registered under `bond-cop30-helsinki`. Browser acceptance verified that all six source cards surface together and that no unrelated project row appears. The valid deep-link selection now waits for authoritative membership hydration. The Helsinki legacy identity was normalized through a canonical saved-work manifest, and its correction ledger hydrated after import.

This recovery is evidence that the data could be reconstructed. It is not proof that the general Save/Open feature is professionally complete. The release gate remains open until the contracts and acceptance tests above are automated across backend, frontend, restart, detached-panel, and portable-bundle workflows.

## Definition of done

This bug is closed only when an analyst can save a project once, restart or move it, reopen it through Datascene, and receive the same hermetic research environment:

- same project and source membership;
- same canonical analyst confirmations;
- same BBox/ROI time and geometry;
- same mature data in every associated panel and knowledge graph;
- complete provenance and traceback;
- no foreign data unless explicitly admitted as reference data; and
- clear, actionable disclosure of any genuine gap.

The project boundary is not a convenience filter. It is the condition that makes coherent interpretation, trustworthy correction, and sane analytical work possible.
