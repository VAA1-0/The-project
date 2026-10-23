# Full restart and Playwright operationality — 23 October 2026

## Final runtime state

- Full replacement restart completed.
- Backend `/api/health`: HTTP 200.
- Frontend governed dashboard: HTTP 200.
- TypeScript validation: passed (`npx tsc --noEmit`).
- Bond catalogue after every rerun: six governed analyses.

## Mitigation delivered

1. The Stage 6 browser acceptance no longer imports the six-source Bond bundle
   into the live saved-work catalogue. It verifies the existing restored scope
   read-only; archive import remains covered by isolated backend contracts.
2. Playwright now defaults to one worker because the configured suite shares a
   saved-work runtime. Bounded parallelism must be requested explicitly with
   `VAA1_PLAYWRIGHT_WORKERS` after the serial release gate is green.
3. Current rendered tests use canonical analysis identity
   `81920e95-a0b2-4173-bc23-86db7909a0a9` instead of ambiguous filenames or
   retired IDs.
4. Project-bound routes assert the current governed error envelopes and reject
   foreign analysis hydration.
5. Analysis Setup, Search, expression timestamps, disclosure controls, and the
   Stage 4 Transcript/Audio/Video corridor were brought in line with the
   current rendered UI.
6. Historical Source Clock mutation cases no longer silently target live saved
   analyses. They require explicitly created disposable fixtures; retired fixed
   M3 cases are recorded as archived skips.

## Catalogue reconciliation

Two earlier suite runs imported the six-source Bond archive twice. The twelve
test-created analysis directories were moved, not deleted, to:

`backups/playwright_duplicate_quarantine_2026-10-23/api_results/`

The pre-reconciliation catalogue is retained as
`backups/playwright_duplicate_quarantine_2026-10-23/catalogue_index.before.json`.
Seven catalogue-only tombstones with no corresponding analysis directory were
removed from the active index. The active Bond project now contains the six
intended governed analyses.

## Serial release gate

Command: `npx playwright test --workers=1`

- 37 passed;
- 4 intentionally skipped because their mutation fixtures were not supplied;
- 0 failed;
- duration: 7.6 minutes.

The passing set includes Analysis Report, project isolation, save bundle,
Search, OCR, POS/Quant, expressions, the sixteen-surface M5 clock matrix,
panel concordance, Stage 4 Transcript/Audio/Video continuity, Stage 6 identity
and multi-agent continuity, disclosure detach/return, and StatsKit.

## Bounded-parallel qualification

The two-worker run reached 36 passed, 4 intentional skips, and one failure.
The remaining failure was a hydration/readiness race in Source Clock panel
concordance under simultaneous heavy evidence loading; the same corridor passed
in the complete serial gate and in targeted runs. A second two-worker stress
run moved the race to another test in that same file.

Disposition: bounded parallelism is not yet a release authority for this
shared-runtime suite. Keep the safe default at one worker. This is test-runner
capacity/readiness debt, not evidence of a serial product failure.
