# Working Handover: Global Clock, Project Boundaries, and Hermeneutic Context

Date: 2026-10-01

Branch: `petteri`

Delivery method: direct plain-Git commit and push to `origin/petteri`, following the established Datascene handover method

## Executive status

The Global Clock has been delivered through the analyst-confirmed M1–M5 sequence. It now acts as the shared source-time anchor for Video and the multimodal analytical panels, with on-beat evidence primary, lateral before/after navigation, and a concordance view for comparison.

A cross-project incident was discovered during delivery: a Marcella analysis could become the operational source while the visible project remained Bond/COP30/Helsinki. The immediate UI leak and the Datascene local-route entity boundary are now contained and tested. Project and analysis context is enforced before local record, artifact, Source Media, correction, or bundle access. Layout state and analysis caches are partitioned by project.

The next architectural layer is full hermeneutic-context ticket propagation through direct FastAPI calls, background jobs, search, meaning/plot, Narrative Agents, statistics, traceback, and publication.

## Global Clock delivered behavior

- one revision-bound source cursor shared across panels;
- source switching and delayed hydration protection;
- Video seeks with clock navigation;
- transcript rows surface and scroll to the active interval;
- all on-beat detections render rather than only one representative hit;
- before and after evidence remains available through soft lateral navigation;
- concordance view compares neighboring evidence without displacing the active beat;
- Audio, Objects, OCR, Expressions, POS, Quant, Search, Meaning/Plot, Scene Cards, StatsKit, Traceback, Narrative Agent, Master Schema, and Data Maturation participate in the shared operating principle;
- Meaning/Plot centers the cursor and exposes associated nodes;
- Scene Cards select the containing half-open interval and scroll it into view;
- sparse beats report absence without falsely assigning neighboring evidence to the beat;
- analyst correction and undo work remains source/revision bound.

## M5 acceptance

The analyst manually confirmed M5 after checking the Global Clock and concordance behavior across panels.

One automated precision observation remains: a test entering `1:11.001` observed the media-driven cursor normalize to `1:11.000`. This is recorded as a one-millisecond normalization issue, not a project-boundary failure and not a reversal of manual M5 acceptance.

## Project-boundary incident

At approximately 17:37 Europe/Helsinki, Marcella source media and Scene Cards appeared inside the Bond/COP30/Helsinki workspace. Confirmed foreign analysis:

- analysis: `c034341f-3fba-495e-a7d1-0af03a46cb6c`;
- project: `research-test-2026`;
- source: `2MarcellaPhd_VBusiness BLS S20.mp4`.

The catalogue itself was correctly filtered. The leak occurred because the shared active-analysis event and restored panel props were not subordinate to the active project. A stale foreign analysis ID could therefore drive Video and panel hydration without changing the visible project heading.

Detailed incident report:

- `docs/bug_report_2026-10-01_systemic_meta_bleeding_project_boundary.md`

## Boundary corrections delivered

- active-project membership allowlist;
- fail-closed `videoIdChanged` event boundary;
- restored Golden Layout prop sanitization;
- automatic eviction of a foreign analysis already resident during membership loading;
- visible project-boundary alarm;
- project-filtered ordinary dashboard catalogue;
- server validation on all Datascene local analysis routes;
- explicit rejection codes:
  - `PROJECT_CONTEXT_REQUIRED` → 428;
  - `PROJECT_MEMBERSHIP_MISMATCH` → 403;
  - `ANALYSIS_CONTEXT_MISMATCH` → 409;
  - `ANALYSIS_NOT_CATALOGUED` → 404;
- analysis and promise caches partitioned as `project::analysis`;
- project-specific saved-layout keys;
- legacy unscoped layouts no longer restored;
- explicit catalogue mode remains the only UI allowed to aggregate projects.

Boundary design and acceptance evidence:

- `docs/datascene_project_analysis_hermeneutic_context_boundary_2026-10-01.md`
- `docs/audits/source_clock_2026-10-01/project_isolation_gate.md`

## Hermeneutic-context principle

Project isolation must protect not only files but the meaning formed from them. The governed ticket is intended to bind:

- project and research question;
- analysis and canonical source edition;
- Global Clock position, interval, and revision;
- evidence and correction generation;
- active analytical lens;
- scene and narrative context;
- interpretation authority and provenance;
- analyst/session identity for mutations.

Semantic similarity, a shared participant, a matching filename, an imported alias, or prior assistance never grants another project authority over the active workspace.

## Validation completed in this thread

- frontend TypeScript: passed with `npx tsc --noEmit`;
- focused Global Clock/frontend contracts: 43 passed;
- focused backend operational contracts in `vaa1_core`: 62 passed plus 25 subtests;
- ordinary dashboard exposes only five Bond/COP30/Helsinki analyses: passed;
- forced Marcella query is rejected before hydration: passed;
- foreign Marcella artifact requests during rejection: zero;
- valid Bond project/analysis entity request: passed;
- Bond project paired with Marcella analysis: rejected with 403;
- route analysis paired with a different context analysis: rejected with 409;
- context-free local analysis request: rejected with 428;
- rendered boundary suite: 3 tests passed;
- Datascene restarted through `scripts/start_vaa1_macos.sh` and reported ready on ports 8000/3001.

The Golden Retriever and relational-lens Python schema tests could not be rerun in the installed `vaa1_core` environment because its current package set lacks `jsonschema`. The dependency is pinned in `requirements.txt`, and prior schema probe artifacts are included. This is recorded as environment drift; no runtime package installation was performed during the push workflow.

The historical full frontend source-contract sweep reported 182/208 passing and 26 failing. Several failures are source-text assertions coupled to implementation shapes that changed during the accumulated operational work; the focused Global Clock tests and rendered boundary tests are green. The remaining 26 have not all been individually classified and must not be represented as a clean full-suite result. They are a follow-up contract-maintenance and regression-audit item.

## Related operational work included in the software stream

The working development set also contains the source-clock authority/context work, correction locking and revision guards, source-bound undo, restored-project hydration, Golden Retriever schema/validation integration, Narrative Agent recognition/digital-twin support, relational-lens schemas, queue/recovery tooling, and the tests and documentation that explain those operational components.

## Deliberately excluded local material

Following the established repository method, the push must not sweep in unrelated non-software or generated clutter. Keep these local unless separately requested:

- investor-deck binary and presentation generator changes;
- `docs/board_meeting/` and presentation figures;
- board/archive slide generators;
- `node_modules/.package-lock.json`;
- `backups/`;
- `docs/.Rhistory`;
- root-level scratch `AudioPanel.tsx`;
- malformed deleted `run_vaa1_lite.sh"` entry.

## Remaining work

1. Propagate the governed context ticket to direct FastAPI calls and background jobs.
2. Bind Search, Meaning/Plot, Narrative Agents, StatsKit, Traceback, and publication outputs to that same ticket rather than reconstructing context independently.
3. Add an immutable boundary-violation audit stream.
4. Resolve or formally tolerate the observed one-millisecond media normalization.
5. Run the post-restart representative-beat acceptance sequence when the next delivery slice begins.

## Suggested opening prompt for the next thread

```text
Continue from docs/working_handover_handout_2026-10-01_global_clock_project_boundaries.md on branch petteri. Treat the Global Clock as delivered through analyst-confirmed M5. Preserve the project and analysis fail-closed boundary. The next task is to propagate the governed hermeneutic-context ticket through direct FastAPI calls, background jobs, Search, Meaning/Plot, Narrative Agents, StatsKit, Traceback, and publication/export. Do not allow Marcella or any other foreign project to enter Bond/COP30/Helsinki through media, metadata, caches, restored layouts, concepts, statistics, narrative assumptions, or derived interpretations.
```
