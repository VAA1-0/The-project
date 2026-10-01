# Source-clock revision binding — 2026-09-23

## Delivered boundary

The backend now exposes `GET /api/analysis/{analysis_id}/source-clock`. It computes a SHA-256 fingerprint of the actual source bytes, separate from evidence-row `source_ref` values. A bounded process-local cache is keyed by filesystem identity, size, nanosecond modification and change times; changes during hashing or lookup are rejected. Hashing runs off the asynchronous API event loop. Missing/unreadable media is reported as unavailable, never given a fabricated fingerprint.

The clock revision identifies the mapping state: content fingerprint, duration, reported FPS, audio sample rate and transcript clock offset. It is deterministic across reopening and moving identical source bytes. Editorial notes do not change it. Returning to identical mapping values returns the same state identifier: this is not a monotonic decision-history revision. Reported FPS participates in identity but does not establish constant-frame-rate precision or replace presentation timestamps.

Resolution preserves supplied fingerprints/revisions, rejects stale bindings with HTTP 409, and rejects mixed revisions. Legacy scopes remain readable and explicitly `legacy_unversioned`; the service does not stamp their evidence with today's revision. Invalidation through this endpoint requires current versioned scopes. Frontend transport types and a retrieval method expose the contract without silently upgrading legacy records.

A clock invalidation event now retains its validated `source_clock_scope` in the canonical ledger, including analysis ownership, source fingerprint, clock revision and interval. Existing events remain untouched. The optional field is declared in the ledger schema.

## Automated verification

- 56 backend tests and 25 subtests pass across clock contexts/isolation, interpretation prerequisites, ledger contracts, API contracts and transcript timing guards.
- 33 focused frontend clock/transcript/navigation tests pass; TypeScript passes.
- Temporary-file tests cover rename/reopen stability; source replacement with the same size and restored modification time; timebase changes; missing media; mixed or incomplete bindings; and rejection before persistence in the actual API handler.
- A temporary-file persistence test exercises the actual API handler, ledger writer and loader with the real decision/projection helpers. It verifies append-only invalidation, unchanged original decisions, preserved clock traceback, reopening, unaffected outside claims, and no duplicate event on retry. Unrelated status/event services are test doubles. This is not a full application restart or project export/import test.

## Remaining gates

This closes the backend resolution binding increment, not the entire clock system. General annotation/correction save routes do not yet enforce this revision precondition. A shared atomic compare-and-save boundary across writers, consumer retention of evidence revisions, revision-aware frontend navigation, complete frame/sample handling, full consumer acceptance and isolated project restoration remain open. Existing numeric navigation consumers are still a compatibility projection. No existing saved evidence is automatically migrated or declared mature.

The wider frontend suite's ten previously recorded failures are not resolved by this increment. No full frontend-suite rerun is claimed here; current frontend changes are transport types and a retrieval method.

## Live verification

After confirming all twelve analyses were completed, the backend was reloaded with `bash scripts/start_vaa1_macos.sh --backend-only --replace`. Read-only Bond probes returned 200 for context retrieval/current resolution, 409 for stale revision and foreign content, and 200 with `legacy_unversioned` for an older scope. Repeated retrieval returned the same context. The scoped frontend dashboard returned 200. All 32 protected correction, ledger and source-metadata files still match the September 22 baseline. See `live_readonly_probes.json`. No live invalidation or correction write was requested.
