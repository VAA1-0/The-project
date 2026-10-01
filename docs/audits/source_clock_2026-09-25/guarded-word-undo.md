# Guarded transcript word undo — verification closure

25 September 2026. Bounded automated/runtime delivery closed; analyst acceptance and overall clock completion remain pending. Existing worktree implementation was retained. This closure adds one backend export regression test and records verification; no new editor/navigation scope was started.

## Delivered behavior

New transcript Correct/Drop actions record a local before/after operation. Undo checks the source/clock binding and current correction generation, then checks the target rule under the shared dashboard write lock. It removes a newly introduced rule or restores its predecessor while preserving unrelated current corrections. Canonical correction history records the inverse and generations; identical retries do not duplicate history or rotate the generation. Canonical reload prevents compatibility caches from resurrecting removed rules. History is acknowledged locally only after verified readback.

## Verification in this closure

- Before reload: `/api/analyses?limit=100` returned 12 completed analyses. All 32 protected output artifacts matched the 22 September SHA-256 manifest, excluding catalogue metadata as specified.
- Reloaded with `bash scripts/start_vaa1_macos.sh --backend-only --replace`, using `vaa1_core`; launcher reported ready and remains running.
- Chromium: **2 passed** via `npx playwright test e2e/saved-expression-hydration.spec.ts e2e/saved-language-hydration.spec.ts --project=chromium --workers=1`. Expression recovery showed 49 detections; saved language checks covered 235 words/34 sentences and project membership. Screenshots are in this directory. Historical screenshot files were restored from copies taken before the checks completed.
- Frontend: **7 passed** via `node --test tests/correction-word-undo.test.mjs tests/correction-undo-history.test.mjs`. These cover actual route functions with temporary files/shared locking and controlled panel handlers, including inverse persistence, unrelated correction preservation, conflicts, stale cache reload, Master Schema projection and retry deduplication.
- Backend: **5 passed** via `/Users/admin/opt/anaconda3/envs/vaa1_core/bin/python -m pytest -q tests/test_correction_write_lock.py`. The added test executes the real export refresh, payload builder and correction writer with a temporary canonical artifact and stale in-memory corrections. It verifies undo history, generation, removed-rule state and unrelated annotations survive the write and reach the projection callback while the shared lock is held. Source metadata, record persistence and full projection construction are stubbed in this focused test.
- After reload/checks: health, analyses, Bond correction GET and Bond source-clock GET returned HTTP 200. All 12 analyses remained completed; all 32 protected artifacts still matched. No correction POST or reanalysis was performed on originals.

Earlier handover evidence (not rerun here): 63 focused frontend tests, 73 backend tests plus 25 subtests, and TypeScript passed. These totals overlap this closure's checks and must not be added together. The broader frontend suite has ten previously recorded unrelated failures; no repository-wide green claim is made.

## Remaining limits and acceptance

Supported undo is limited to newly committed transcript word edits. Old history without before/after metadata is retained but cannot be undone through this operation. Span/manual-marker undo, other editor history migration, cross-clock restoration, separate canonical decision-ledger reversal provenance, multi-artifact rollback, cross-tab history acknowledgment and non-cooperative external/import writers remain unsupported or unfinished.

## Rendered isolated acceptance addendum — 25 September

Rendered Correct → verified readback → reopen → undo now passes on a newly created self-contained analysis whose media, transcript, expression, metadata and correction paths all resolve inside its unique fixture directory. The browser blocks non-read requests that do not contain that fixture identity. The test also waits for the guarded client inverse snapshot, proving the save response/readback completed before navigating away; this closed a race in the earlier acceptance procedure. It verifies the correction disappears after undo, the original substitutions and manual annotations are restored, and canonical `correction_undo_history` gains exactly one event.

The UI now derives undo availability through mounted state and reacts to same-tab history writes as well as cross-tab storage changes. Duplicate fixture names are selected by stable analysis identity rather than display text. Eight focused undo tests, TypeScript and the rendered isolated test pass. All 32 protected artifacts still match the baseline; no original correction POST was used.

This closes the previously pending **rendered transcript word save/reopen/undo acceptance**, but not all of M3. M3 still requires an interval correction, launcher restart and decision-trace inspection. M1, M2 and M4–M6 also remain pending; no overall global-clock completion claim is made here.
