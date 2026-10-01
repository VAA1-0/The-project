# Revision-aware source navigation — 25 September 2026

This increment advances C2 without closing the global source-clock stage or any manual gate.

## Delivered boundary

- The workspace loads the canonical source-clock context for the active analysis. Timeline events carry `source_media.clock`, analysis identity, source fingerprint, clock revision and a selection epoch.
- Publishers and subscribers reject foreign, malformed, over-duration and stale events. A switch A → B → A invalidates callbacks captured in the first A selection. A correction or source-metadata refresh invalidates the old revision before its asynchronous replacement is known.
- Video playback/frame callbacks retain the revision ticket from the render that created them. Production panel publishers use the scoped publisher; the numeric session-clear reset remains intentional compatibility behavior.
- Missing source media is inspectable as `source_unavailable` but cannot authorize navigation. A blank video selection now falls back to the active analysis rather than masking it.
- Failed clock lookup pauses navigation and presents a retry control.

This does not prove the 16-consumer matrix, cross-source mapping, imported-project restoration, editor history outside the guarded transcript word operation, or analyst acceptance. Numeric compatibility listeners remain technical debt.

## Verification

- `node --test tests/source-clock-events.test.mjs tests/source-clock-values.test.mjs tests/transcript-time.test.mjs`: **39 passed**.
- `npx tsc --noEmit`: passed.
- All **32 protected output artifacts** matched `docs/audits/source_clock_2026-09-22/baseline_manifest.json`; no correction POST or reanalysis was performed.

The rendered checks were attempted but are not claimed as passing in this increment. The combined browser run timed out in `page.goto` before the first assertion; the isolated rerun did not reach test startup before it was stopped. This is recorded as a local frontend development-server/startup blocker, not as clock acceptance evidence. The earlier rendered expression-seek evidence remains historical evidence only.

## Next acceptance dependency

Use an explicitly created isolated two-analysis fixture to run M2 source switching, including delayed load and A → B → A. Then continue editor binding/history coverage and the full M3–M6 sequence. Stage 1 remains open until the complete consumer matrix and portable restoration gates pass.
