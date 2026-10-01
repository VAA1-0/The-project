# Source-clock sprint opening — 2026-09-22

Status: baseline captured for the first bounded increment; Stage 1 remains in progress. No downstream stage is unlocked by this increment alone.

## Baseline and preservation

HEAD was `5c6c989`; the pre-existing dirty worktree is recorded in `worktree_before.txt` and was preserved. The startup verification immediately preceding this increment passed for both Conda environments, backend health/proliferation route, and frontend HTTP. No service restart or environment change was needed for these frontend helper changes.

A 37-file, approximately 2.7 MB recovery snapshot is retained at `backups/source_clock_2026-09-22/`. It includes the catalogue, saved annotation corrections, decision ledgers, source metadata and pre-edit clock implementation files. `baseline_manifest.json` records their hashes. This is a targeted recovery snapshot, not a full media/project backup.

After browser validation, all captured annotation corrections, decision ledgers and source metadata remained byte-identical. The catalogue changed only in the selected Bond analysis's `updated_at` field through normal runtime activity. No saved timing or annotation was deliberately rewritten.

## First delivered clock correction

The shared transcript normalizer previously divided every timestamp greater than 1,000 by 1,000, including explicit `start_seconds` and clock strings. A value of 1,200 seconds therefore became 1.2 seconds. The existing test expected this unit-guessing behavior. It was replaced with an explicit-millisecond-field assertion and long-source regressions; no unrelated failing assertion was relaxed.

All second-based fields now retain seconds regardless of magnitude. Explicit `*_ms` fields still convert to seconds. This changes the ambiguous legacy assumption intentionally: an old producer storing milliseconds in a field named `start` must supply an explicit unit adapter rather than relying on the size of the number. No legacy data migration was attempted.

The shared precise formatter now rounds once in integer milliseconds, preventing decimal underflow and incorrect minute rollover. The parser rejects empty clock components, surplus components, nondecimal forms and out-of-range minute/second components instead of silently accepting a different correction. Canonical timing statuses retain their exact value, including `vad_anchor_verified` and `inherited`, before compatibility aliases are considered.

## Verification

- Original focused baseline: 8 transcript tests and 17 backend interpretation-prerequisite tests passed.
- New regression cases failed before implementation; see `frontend_before.log`.
- After changes: 15 focused clock/transcript tests passed (`frontend_focused_after.log`).
- Frontend TypeScript check passed.
- Two live Playwright regressions passed: POS/Quant hydration with unavailable media and expression hydration/reopening with a simulated response-body timeout.
- Wider frontend suite: 129 passed, 10 failed, out of 139. This is not a green release suite.

The wider failures concern native-statistics wording/action wiring, BBox canonical-save wiring, Narrative Agent path visualization, proliferation targets, Meaning Network presence, media swaps, mature-subject consumption, POS initial-selection source assertion, bounded catalogue source assertion and disclosure defaults. The POS assertion expects an empty-string fallback; the already-delivered panel uses `initialVideoId`. Its rendered hydration test passes, but the stale source assertion has not been changed within this clock increment. The September 16 nine-failure count predates that additional source-contract mismatch. No claim is made that the full runtime is verified by these focused tests.

The clock tests transpile the actual shared TypeScript module with the installed TypeScript compiler, avoiding a dependency on Node's newer native TypeScript loader.

## Outstanding source-clock gate

`consumer_inventory.json` maps 16 active frontend surfaces to existing implementation files and direct shared-helper usage. It is a static starting inventory, not proof of per-consumer compliance or absence of indirect reuse.

Next bounded work should address:

1. Backend scope validation and source isolation. Inspection found overlap planners compare intervals without comparing source references; non-finite numeric input is not explicitly rejected. Reproduce these with adversarial tests before changing compatibility boundaries.
2. Bind each clock resolution request to its analysis's authoritative source and revision. Preserve a migration path for legacy source-less scopes without permitting cross-source invalidation.
3. Reconcile explicit units at the remaining import/producer adapters; distinguish frame/sample conversion and raw Whisper/source timing from legacy heuristics.
4. Migrate remaining local formatters and navigation payloads, preserving source identity, precision and revision.
5. Exercise a correction on an isolated saved-work copy through persistence, targeted invalidation, reopen and export/import; distinguish local interval changes from global source/timebase changes.
6. Complete the rendered consumer matrix, including long-source seek and multi-source isolation. The existing two browser regressions establish short-source nonregression, not long-source end-to-end proof.

Do not promote Stage 1 to complete until this coverage and the agreed acceptance gates are evidenced. The generic legacy authority-alias matching, scope clamping, and old transcript bound-reversal compatibility behavior remain outside this increment and need explicit review. Qualitative/theoretical lenses remain deferred.

## Backend isolation increment

The backend clock module now rejects non-finite or malformed numeric fields, booleans, negative precision/duration and unsupported clock IDs. Invalid explicit seconds cannot silently fall through to milliseconds or become zero. Existing finite interval/duration clamping and millisecond-field conversion remain compatibility behavior.

Standalone candidate selection and overlap planning compare source references before combining intervals. The API binds all candidates and dependents to the URL's analysis ID and rejects conflicting declared analysis IDs before reaching persistence. Decision invalidation planning checks ledger ownership, decision ownership and scoped ownership, preserves unrelated intervals, and excludes previously superseded/invalidated decisions. Legacy scopes without analysis IDs are interpreted only inside the owning ledger/route context.

Important compatibility distinction: existing frontend callers use `source_ref` for evidence-row identifiers. The new `analysis_id` context therefore isolates the current single-source analysis boundary without relabelling evidence references as media identities. It is not yet an immutable source fingerprint or revision-mapping implementation. Within an analysis, source replacement, revision conflict handling and global timebase invalidation remain follow-up work. This increment does not change writer authorization or make raw authority declarations trustworthy.

Before-fix reproduction (`backend_before.json`) demonstrated that an overlapping foreign source was selected and a NaN start became zero. After-fix validation passed 11 new behavioral tests, including the actual API handler compiled in isolation; 17 existing prerequisite tests; 7 ledger tests; and 9 transcript timing guard tests. Python compilation passed. An additional older API source-contract file had one pass and two errors because it searches for `async def update_annotation_corrections`, while the current unrelated correction handler is synchronous. Those tests were not weakened or counted as passing.

All 12 analyses were completed before the documented `--backend-only --replace` restart. Non-mutating live probes then returned: health 200, valid Bond 71–72 second resolution 200 with the owning analysis, foreign-analysis scope 400, NaN scope 400, frontend 200. `apply_invalidation` was false for live requests. Saved correction, decision-ledger and source-metadata hashes still match the protected baseline.

Stage 1 remains open for clock revision/source-fingerprint binding, complete consumer migration and isolated-copy correction/reopen/export proof. No later stage is unlocked yet.

## Follow-up cleanup and acceptance plan

Expressions now delegates precise time display to the shared clock formatter, including correct minute rollover. The frontend scope type includes optional analysis ownership without changing evidence-row source references. API correction contract tests use AST handler boundaries instead of a stale asynchronous signature and fixed character windows; they explicitly assert the durable correction write refreshes Master Schema.

Validation after this cleanup: 15 frontend clock/transcript tests passed; TypeScript passed; 38 backend tests plus 18 subtests passed across isolation, prerequisites, ledger and API contracts, followed by all 9 transcript timing guard tests (47 backend tests total). The first attempted backend command named a nonexistent timing test file and collected no tests; the corrected commands above passed. No new rendered/manual acceptance run or full frontend-suite run is claimed for this cleanup. The prior ten broader frontend failures remain unresolved.

The [delivery and manual gate checklist](../../source_clock_delivery_and_manual_gates_2026-09-22.md) separates remaining frontend/backend work and orders six pending acceptance steps. No saved analyst records were edited by this cleanup. Stage 1 remains open.

## Representation and active-source navigation increment

Explicit-unit adapters now replace numeric-magnitude guesses in Scene Cards, Meaning/Plot, Master Schema, second-order labels, scene governance and Data Maturation. Missing/null values no longer become zero in these shared conversion paths; short explicit milliseconds convert correctly; end-boundary fallback retains the start field's actual unit. OCR, Audio, Objects, Transcript, Meaning/Plot, Traceback and TimeBank join Expressions in using shared precise formatting. Objects uses the shared strict correction parser. Compact whole-second/duration displays remain intentional presentation choices, not precision assertions.

Generic semantic confirmation/manual authority does not imply verified timing. Canonical timing statuses remain intact; uncertain candidate/degraded provenance retains that status. Explicit user clock corrections now fail validation rather than silently clamping negative, reversed or out-of-duration bounds. Automatic legacy clamping is retained. The API rejects non-boolean invalidation flags, including the string `"false"`.

Panel timeline publishers and shared navigation use `publishSourceTime`, carrying clock ID, analysis ID and source seconds. It checks current selection before publishing a scoped event and again before projecting to existing numeric listeners. Late old-analysis publications and synchronous source switches are covered by behavioral tests using the actual event bus. Tools' delayed navigation retries no longer reselect an abandoned source. Session clearing intentionally retains its unscoped zero reset. Invalid navigation values are rejected; a genuine zero is retained; `seekVideo: false` works even when focusing Video.

This does not implement immutable media fingerprints or revision conflict resolution. The event envelope currently identifies the analysis, and numeric consumers remain a compatibility projection. Source replacement within an analysis, frame/sample precision, full rendered coverage and isolated-copy correction/restoration are still open gates.

Verification: 33 focused frontend tests pass, including actual extracted consumer functions and actual event-bus behavior. The broader suite has 147 passes and the same ten pre-existing failures (157 tests). Source-inspection assertions were migrated to the scoped publisher while retaining their navigation/focus requirements. Backend tests: 48 pass plus 21 subtests. Twelve completed analyses were confirmed before the documented backend-only replacement; live health and valid resolution returned 200, string invalidation flags and reversed explicit corrections returned 400 without writes.

A browser run caught an import inserted above VideoPanel's `"use client"` directive, which TypeScript did not reject. The directive was restored to the top; the subsequent sequential Expressions and POS/Quant hydration run passed both tests. These browser checks do not prove the complete clock consumer matrix.

Protected-file comparison: all 32 saved correction, ledger and source-metadata files match the baseline. The catalogue alone refreshed Bond's `updated_at` timestamp; project identity and filename did not change. No saved analyst correction was edited by this delivery. Manual gates M1–M6 remain pending; the governing checklist records the remaining contracts.

A separate rendered navigation test now passes: the visible Expressions cue at 7 seconds opens Video and the actual media element reaches its source time within 0.1 seconds. The new test initially selected hidden/containing panels and then failed to parse CSS-uppercase `S`; its locator and case-insensitive timestamp reader were corrected without changing product behavior. Final browser evidence is three passing checks: Expressions hydration, POS/Quant hydration, and actual expression-to-video seeking. TypeScript also passes after the navigation migration. This is a short-source navigation check, not the long-source/multi-revision acceptance matrix.
