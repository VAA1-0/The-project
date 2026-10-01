# Backend correction revision precondition — 2026-09-23

## Delivered step

The backend correction POST accepts source identity and timebase revision in its existing `_clock_write_guard`. If either `source_fingerprint` or `clock_revision` is present, both must form a current binding. The handler validates the binding inside the shared correction-write lock, after checking the existing offset guard and before installing or mutating the canonical correction snapshot. Replaced/unavailable media and changed timebases return 409; incomplete string bindings return 400. Explicit null bindings fail closed.

A version-aware caller must retain the binding from evidence load, alongside `analysis_id` and `transcript_clock_offset_seconds`. Fetching a fresh binding only at save time would conceal stale editing evidence and is not an acceptable client implementation. The source-clock GET already exposes the binding. This increment does not make a separate corrections GET and clock GET an atomic read.

## Verification

72 backend tests and 25 subtests pass. Nine new parameterized cases execute the actual handler's precondition section with the real filesystem lock, real temporary source bytes, and a temporary canonical correction file. They cover source replacement, missing media, FPS/duration/audio-sample-rate changes, partial/null bindings, current bindings and legacy offset-only compatibility. Rejections leave shared status and sidecar bytes unchanged and release the lock. Accepted fixtures deliberately stop before persistence; these are precondition tests, not full-save tests.

## Next dependency steps

1. Produce a coherent correction-and-binding read snapshot for editing clients and carry its binding through edit state. Preserve source-unavailable and legacy distinctions.
2. Enforce the same full revision precondition on the dashboard local correction writer under its shared lock. The dashboard route currently checks offset only; this backend increment does not protect that route against media replacement.
3. Migrate editor consumers without silently refreshing stale bindings on save. Provide explicit reload/conflict feedback, then verify with isolated delayed-response and media-replacement fixtures.
4. Continue revision-aware navigation and the manual M1–M6 gates documented in the delivery checklist.

Unversioned clients retain the existing offset-only compatibility path. This is an incremental backend contract, not universal revision enforcement or completion of C2/C3. External source replacement does not participate in the correction lock; protection against arbitrary media edits during a save remains outside this cooperative protocol.

## Runtime check

All 12 listed analyses were completed before the documented backend-only reload. After reload, backend health, frontend dashboard and Bond source-clock GET returned HTTP 200. All 32 protected correction/ledger/source-metadata artifacts still match the baseline. Verification made no live correction POST. [Read-only probes](backend_revision_readonly_probes.json).
