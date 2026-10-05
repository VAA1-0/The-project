# Working Handover: Chapter 5 Reporting and Governed Correction Boundary

Date: 2026-10-05

Branch: `petteri`

Delivery method: direct plain-Git commit and push to `origin/petteri`, following the established Datascene handover method

## Executive status

This thread stabilized the Datascene startup workspace and mature-data hydration, then closed the immediate Chapter 5 preparation slice. The default dashboard now starts with Project and Downloads on the left, Video as the sole central panel, and the remaining analytical panels in the right-hand sphere. The Global Clock starts at canonical zero for a newly opened analysis unless an explicit governed navigation transaction supplies another source time.

The latest delivery adds a printable Chapter 5 corpus report and closes a missing project-context boundary in analyst correction hydration. The report does not pretend that generated counts are research findings: it surfaces governed case evidence, analyst decisions, cross-case comparison material, explicit completion fields, scope limitations, and verification records so that the analyst can answer the workshop research question and print the result.

## Panel and startup work completed in this thread

- dynamic panel sections default closed;
- alphabetical ordering remains the default unless an explicit analytical rationale overrides it;
- panel sections can be reordered within their host panel;
- Fill and Detach controls use compact right-aligned symbols with hover text;
- Fill uses the available panel body and preserves access to overflowing data;
- detached elements return to their host panel when closed;
- Project and Downloads start on the left;
- Video is the only central startup panel;
- analytical panels start in the right-hand panel sphere;
- a newly opened analysis begins at `0:00.000`, subject only to a source-bound navigation request;
- frontend and backend are started by `scripts/start_vaa1_macos.sh --replace` and were healthy at handover.

Detach-to-a-second-screen was implemented but remains a manual multi-monitor acceptance item.

## Mature hydration and analyst-data safeguards

The thread repaired incomplete restoration of saved analyses, including filename identity, POS/Quant state, and mature bounding-box arrays. The operating rule remains: the richest valid canonical array must outrank a thinner compatibility projection, and hydration must never silently discard analyst-confirmed records.

The correction route now carries the governed `project_id` and `context_analysis_id` when resolving source-clock binding. This prevents a correctly catalogued correction artifact from being misclassified as `source_unavailable` merely because its project context was omitted. Reads, writes, readback verification, restart persistence, and guarded undo remain bound to analysis identity, source fingerprint, clock revision, correction generation, and project membership.

## Chapter 5 reporting delivered

The corpus publication flow now creates a `datascene.chapter_five_research_report.v1` report in three representations:

- printable HTML;
- Markdown;
- structured JSON.

The report includes:

- the Chapter 5 research question;
- a methodological answer frame;
- case identities, source checksums, durations, and clock binding;
- feature-record counts;
- current analyst decisions and confirmed decision details;
- interpretation and candidate states;
- a cross-case evidence matrix;
- analyst completion fields for corpus matching, anticipatory configuration, cross-case synthesis, and limitations;
- a verification record and explicit small-corpus boundary.

The report is the first browse node in the corpus publication. Downloads exposes **Generate corpus + Chapter 5 report** and, after generation, **Open printable report**. The backend serves the standalone report through the project-scoped publication report route.

This is a reporting and evidence-surfacing layer. It does not replace the analyst's interpretive responsibility, assert significance from counts alone, or claim that Boje's 5Bs must be operationalized for the rudimentary validation workshop.

## Acceptance completed

- backend reporting, governed reporting, traceback, and interactive-commit contracts: **22 passed**;
- correction source-binding and guarded inverse contracts: **6 passed**;
- frontend TypeScript: passed;
- saved POS/Quant hydration browser protocol: passed;
- project restoration and isolation browser protocol: **4 passed**;
- Global Clock M5 consumer matrix and representative panel concordance: passed;
- delayed A → B → A source switching: passed;
- interval correction save, close, and reopen: passed;
- actual service restart and correction persistence: passed;
- guarded undo after restart: passed from a clean, repeatable fixture baseline;
- backend `/api/health`: healthy;
- dashboard: HTTP 200;
- printable report route: present in the running OpenAPI contract.

The acceptance fixture cleanup now uses the same governed inverse protocol as the UI. Ordinary merge semantics intentionally do not treat an omitted collection member as a deletion.

## Full-suite qualification

The broad `manual-annotation-governance.test.mjs` source-contract sweep was also sampled. It reported **68/74 passing**. Six assertions are coupled to older source-code shapes and currently fail:

1. native statistical interpretation invocation shape;
2. Narrative Agent Character Paths home ownership;
3. Data Maturation dynamic proliferation control;
4. Datascene Meaning Network scene-presence proliferation;
5. Video atomic media-swap implementation shape;
6. Maturation-to-BBox zero-clock source-text sequence.

These are not failures in the focused rendered protocols listed above, but they have not yet been individually reclassified as stale assertions or runtime regressions. Do not describe the entire frontend contract suite as green. Maintain or replace these assertions when the corresponding feature slice is next changed; do not reopen the completed Chapter 5/correction delivery merely to chase implementation-string matching.

## Principal implementation locations

- `src/backend/analysis/data_book_publication.py`
- `api_server.py`
- `src/frontend/app/V2components/components/panels/DownloadPanel.tsx`
- `src/frontend/lib/api-service.ts`
- `src/frontend/lib/correction-source-binding.ts`
- `src/frontend/app/api/local-analysis/[analysisId]/download/[fileType]/route.ts`
- `src/frontend/e2e/source-clock-m3-save-reopen.spec.ts`
- `src/frontend/e2e/source-clock-m3-post-restart-undo.spec.ts`
- `tests/test_data_book_publication.py`

## Deliberately excluded local material

Do not sweep unrelated workspace material into this delivery. In particular, keep these local unless separately requested:

- investor-deck binary and generator changes;
- `docs/board_meeting/` and `docs/figures/`;
- board/archive slide generators;
- `node_modules/.package-lock.json`;
- `backups/`;
- `docs/.Rhistory`;
- root-level scratch `AudioPanel.tsx`;
- malformed deleted `run_vaa1_lite.sh"` entry.

## Recommended next production sequence

1. Use the Download panel to generate one workshop corpus publication and manually inspect/print the Chapter 5 HTML report.
2. Complete the analyst-owned corpus matching, anticipatory configuration, synthesis, and limitations fields with the workshop cases.
3. Test Detach on a real second-monitor arrangement.
4. Classify the six broad source-contract failures when their corresponding feature areas are opened; replace brittle source-shape assertions with behavioral checks where practical.
5. Continue the General Sprint Regime from the highest-impact rudimentary validation requirement, keeping the Global Clock, project boundary, mature-data precedence, and correction-generation rules intact.

## Suggested opening prompt for the next thread

```text
Continue from docs/working_handover_handout_2026-10-05_chapter_five_reporting_and_correction_boundary.md on branch petteri. Treat the startup workspace, mature hydration, project-bound correction binding, restart-safe undo, and printable Chapter 5 report as delivered. First generate and manually inspect one workshop corpus report. Then continue the highest-impact remaining General Sprint item needed for rudimentary Chapter 5 validation. Preserve analyst data, canonical-zero startup, Global Clock authority, project isolation, and the rule that generated counts are evidence rather than findings.
```
