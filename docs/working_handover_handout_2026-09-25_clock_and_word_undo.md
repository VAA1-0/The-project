# Datascene handoff: clock continuity and guarded word undo

Written 25 September 2026 for a fresh thread. Read this first; consult linked documents only as needed. This handoff records implementation status, not permission to publish or a claim of completed analyst acceptance.

**M1–M6 update, 25 September:** The isolated rendered word save/reopen/undo path and the M6 core export/import round trip now pass. Consolidated automated and rendered evidence, protected-artifact verification, and the precise remaining manual gates are in [the M1–M6 acceptance record](audits/source_clock_2026-09-25/m1-m6-acceptance.md). Stage 1 is not yet closed; do not infer completion of the long-source, two-source rendered, interval/trace, invalidation, or full consumer-matrix observations.

**Closure update, 25 September:** The bounded word-undo runtime verification below is now complete. Backend reloaded; both hydration browser checks, seven targeted frontend tests and five backend lock/export tests passed. All 32 protected artifacts match; no original correction POST was used. See [closure audit](audits/source_clock_2026-09-25/guarded-word-undo.md). The original pending-work descriptions below are retained as handoff history and superseded where the consolidated record says so.

**Navigation update, 25 September:** Revision-aware frontend timeline delivery is now automatically verified: scoped events carry analysis/source/revision/selection identity; stale callbacks fail closed; unavailable source media cannot authorize navigation. Thirty-nine focused tests and TypeScript pass, and all 32 protected artifacts still match. The attempted rendered run stalled during local frontend startup/navigation before assertions, so M2 and all manual gates remain pending. See [navigation audit](audits/source_clock_2026-09-25/revision-aware-navigation.md).

**Rendered undo update, 25 September:** The isolated transcript word Correct → verified readback → reopen → undo test now passes. The acceptance fixture is self-contained and selected by stable analysis identity; the browser waits for the guarded inverse snapshot before navigation. Eight focused undo tests and TypeScript pass, and all 32 protected artifacts match. This closes the rendered word-undo acceptance only; M3's interval/restart/decision-trace portion and M1, M2, M4–M6 remain pending.

## User objective and working agreement

Finish the source-clock system systematically, then dependent sprint work. “Global clock” means one shared source-relative contract across features, with separate identities/revisions for separate videos. Preserve mature evidence and researcher decisions. The working project is `bond-cop30-helsinki`; avoid reanalysis or writes to original annotations as tests.

The user is concerned about usage cost. Consolidate work into complete, reviewable outcomes rather than many small prerequisite-only rounds. Use short updates, narrow file reads and targeted tests. Do not rerun broad suites without a changed dependency or unresolved failure. Do not reread the whole historical thread. Do not spawn agents unless explicitly authorized. No model/settings changes or paid upgrades are authorized by this handoff.

**Next deliverable:** finish runtime verification and document the already-implemented guarded transcript word undo. Do not start a new architecture round before closing this bounded delivery. Explain precisely what remains unsupported. Then continue the remaining editor/navigation gates in dependency order.

## Workspace and runtime

- Root: `/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project`.
- Branch at handoff: `petteri`; HEAD `5c6c989`.
- Worktree contains extensive modified and untracked files from several prior tasks. Preserve unrelated work. No commit or push was performed for these clock increments. Do not stage everything.
- Runtime Python: `/Users/admin/opt/anaconda3/envs/vaa1_core/bin/python`. **Do not use `.venv`.**
- Startup authority: [Mac runbook](vaa1_macos_startup_runbook_2026-05-03.md). Full system also uses the documented `vaa1_face` environment.
- Backend `127.0.0.1:8000`; frontend `127.0.0.1:3001`.
- Dashboard: `http://127.0.0.1:3001/dashboard?activeProject=bond-cop30-helsinki`.
- Before a restart, GET `/api/analyses?limit=100`; response `analyses` is a map. All 12 were completed at the last check on 25 September. Recheck rather than assuming still idle.
- Backend reload: `bash scripts/start_vaa1_macos.sh --backend-only --replace`. Keep its service process alive. Do not recreate Conda environments for a routine restart.
- Latest backend was reloaded for correction generations. **The subsequent word-undo backend changes have not had their final documented reload/runtime verification.** Frontend is a development server and may hot-load edits; do not equate that with acceptance.

## Protected original data

Bond/No Time to Die analysis: `8183c1fd-7cb9-49d0-b20c-378399e9c41f`. Established landmarks: 161 manual annotations, James Bond at 71–72 seconds, 49 expression detections; language hydration previously showed 235 words and 34 sentences. These are reference observations, not newly revalidated counts.

Baseline: `docs/audits/source_clock_2026-09-22/baseline_manifest.json`, with `files` entries containing `path` and `sha256`. Check entries beginning `outputs/`, excluding `catalogue_index.json`: **32 protected artifacts**. All matched at the last completed verification. Catalogue metadata can change during reads/hydration. Backup: `backups/source_clock_2026-09-22/`. Canonical corrections: `outputs/api_results/<analysis_id>/annotation_corrections.json`.

Use temporary fixtures or a verified isolated project copy for writes. No original correction POST was used in the clock verification rounds.

## Implemented foundations

- `src/backend/analysis/source_clock_context.py`: fingerprints actual source bytes; deterministic clock revision over fingerprint, duration, FPS, audio sampling rate and transcript offset. Canonical correction file outranks backend cache. Missing/corrupt/stale inputs are explicit; invalidation requires bound context.
- `api_server.py`: source-clock GET/resolve, guarded correction routes, read isolation, canonical export refresh and preservation of clock decision provenance.
- Shared Python/Node locks: `src/backend/analysis/correction_write_lock.py` and `src/frontend/lib/correction-write-lock.ts`. Cooperative per-analysis atomic-directory ownership covers both correction POSTs and export refresh. Crash-abandoned locks fail closed; recovery is documented in [shared coordination audit](audits/source_clock_2026-09-23/shared-write-coordination.md). Do not indiscriminately delete locks.
- Dashboard canonical route: `src/frontend/app/api/local-analysis/[analysisId]/download/[fileType]/route.ts`. Corrections and clock binding read under the shared lock; saves validate before writes; transient guards are stripped. Post-rename failure reports `canonical_committed: true`.
- `correction-clock-guard.ts`, `correction-source-binding.ts`, `api-service.ts`: bound reads, clock/source conflict checks, response validation and readback verification.
- Both save routes rotate `correction_generation` after adoption. Versioned analyses reject stale or absent generation guards even on the same clock. Old analyses adopt on their first save; no read-time migration. Generation is separate from clock revision.
- `correction-draft-binding.ts` and `SpeechToTextPanel.tsx`: span/manual-marker and word drafts preserve opening/selection binding. Conflicts retain drafts. Late replies check source/draft identity. This is not a full selection-generation/unmount protocol.
- `annotation-corrections.ts`: non-consuming history peek and guarded acknowledgment. Old destructive-pop callers in other panels remain to migrate.
- Existing navigation/format work uses explicit units, precise formatting and analysis-scoped events; numeric listener compatibility and full revision-aware navigation remain unfinished.

## Latest operation: implemented, final runtime verification pending

New `src/frontend/lib/correction-word-undo.ts` implements a one-word inverse operation:

1. A newly committed transcript Correct/Drop stores a local history snapshot containing `_word_undo`: unique operation ID, rule ID, exact before/after rule and committed source binding.
2. Undo uses the current correction generation while checking the original source/clock binding. It is an explicit inverse command, not an old document resubmitted with a refreshed guard.
3. Under the dashboard save lock, the current target must equal the recorded after-rule. Otherwise it rejects. It restores the prior rule or removes the newly introduced rule, preserving unrelated current corrections.
4. `correction_undo_history` persists the operation, action, generations and timestamp in the canonical correction artifact. An already-applied identical retry does not append another event or rotate its generation. Conflicting retries reject.
5. Once undo history exists, dashboard hydration treats canonical `text_substitutions` as authoritative so a newer-dated compatibility cache cannot resurrect a removed rule.
6. Ordinary dashboard saves preserve server-owned undo history; transient `_word_undo` is removed from persisted top-level data. Backend payload/export construction now preserves history; the backend POST explicitly rejects inverse commands and directs them to the dashboard route.
7. The transcript panel consumes history only after verifying the inverse result. Older history entries without before/after metadata remain unsupported and are retained with a message.

Important limits: this is **new transcript word edits only**, not general span/manual-marker undo or cross-clock restoration. Its reversal provenance is in the correction artifact, not newly integrated into the separate canonical decision ledger. Multi-artifact rollback is absent. Local history token acknowledgment is not a cross-tab transaction. External/import writers are outside the cooperative protocol.

## Verification already completed for latest operation

- **63 focused frontend tests passed.**
- **73 backend tests and 25 subtests passed.**
- **TypeScript passed.**
- New `correction-word-undo.test.mjs` exercises pure conflict/inverse behavior and actual route functions with real temporary filesystem writes and the real shared lock. It verifies canonical reload despite a stale cache, Master Schema projection, stale-save rejection, retry deduplication and lock release.
- `correction-undo-history.test.mjs` executes panel handlers with controlled callbacks. These are not rendered click/save/undo acceptance tests.
- Last browser checks passed before the newest inverse-operation changes. Final runtime/browser verification for those changes is still due.
- Prior whole frontend suite had ten known unrelated failures. Do not describe the entire repository suite as green; regression totals are not newly delivered feature counts.

Focused frontend command, from `src/frontend`:

```sh
node --test tests/correction-word-undo.test.mjs tests/correction-undo-history.test.mjs tests/correction-draft-binding.test.mjs tests/correction-source-binding.test.mjs tests/correction-clock-guard.test.mjs tests/correction-write-lock.test.mjs tests/annotation-correction-concurrency.test.mjs tests/source-clock-values.test.mjs tests/source-clock-events.test.mjs tests/transcript-time.test.mjs
```

Backend suite already passed: `test_correction_revision_precondition`, `test_correction_write_lock`, `test_correction_clock_guard`, `test_source_clock_context`, `test_source_clock_isolation`, `test_interpretation_prerequisite_services`, `test_decision_ledger_contract`, `test_api_decision_invalidation_contract`, `test_transcript_timing_guard_contract` under `tests/`, using the documented Python with `-m pytest -q`.

## Close this delivery, then proceed

1. Inspect only the latest inverse-operation files if review is needed; preserve existing changes. Add a targeted backend history-preservation check if the payload/export path needs further evidence.
2. Recheck idle status and reload backend by the runbook. Run the two existing browser hydration checks from `src/frontend`:
   `npx playwright test e2e/saved-expression-hydration.spec.ts e2e/saved-language-hydration.spec.ts --project=chromium --workers=1`.
3. Verify health/read responses and the 32 protected hashes; do not test undo on originals. Record the latest operation's audit and update the delivery checklist with truthful scope.
4. Report the completed word-undo increment, test evidence and the remaining isolated manual acceptance. Do not claim the overall clock system is complete.
5. Continue other editor binding/history paths and revision-aware navigation using [clock delivery/manual gates](source_clock_delivery_and_manual_gates_2026-09-22.md) and [General Sprint Regime](vaa1_general_sprint_regime_remaining_tasks.md). Manual M1–M6 are pending: agreement, switching, save/reopen/undo, invalidation, 16-consumer matrix, export/import restoration.

## Usage concern and audit

The user requested measurable accountability before spending more. [Usage audit](audits/usage_2026-09-25/README.md) and its JSON record the implementation thread on 22/23 September: 46m21s/55m24s of summed task durations; 15,462,823/14,537,763 logged input+output tokens, mostly cached context; both days' last five-hour usage reading was 99%. Automatic approval-review usage was logged separately; its billing treatment is unverified. Main model was Astra, low effort. These are local logs, not an invoice or a historical model-performance comparison.

Avoid repeating the large context and repeated tiny “next prerequisite” deliveries. Prefer a short fresh-thread context and one complete, tested outcome per agreed step. No upgrade, model switch, or quota promise was made.
