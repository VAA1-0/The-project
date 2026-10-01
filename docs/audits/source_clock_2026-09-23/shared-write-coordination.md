# Shared correction-write coordination — 2026-09-23

## Implemented

Dashboard correction POST and backend correction POST now acquire the same per-analysis filesystem lock before reading the canonical correction snapshot, checking its clock guard, and writing. The existing dashboard queue remains useful within one process; the shared lock coordinates separate processes. Backend export refresh participates too, and reloads canonical corrections under the lock instead of exporting an older in-memory copy. Correction GET uses a separate snapshot so it cannot replace a writer's in-flight status.

The lock protocol uses atomic directory creation under `.cache/correction-write-locks/<sha256-of-analysis-id>.lock`. Both implementations write `owner.json` with an ownership token, PID, analysis ID and creation time. They check the token before release. Acquisition waits at most five seconds and fails without entering the save operation when busy. Backend and dashboard report HTTP 503 for lock contention. Ordinary completion and exceptions release ownership. Separate analyses do not block one another.

## Failure and recovery policy

A crashed writer may leave an abandoned directory. Neither implementation steals locks based on age or PID guesses: an old timestamp does not prove that a save has stopped. Subsequent saves fail explicitly, preserving the artifacts. This favors data integrity over automatic availability after a crash.

Recovery is an operator procedure, not an automatic deletion:

1. Stop the backend, frontend and any batch/import writers using the documented operating procedures.
2. Inspect the specific lock's `owner.json`; confirm its analysis identity and that the owning process has stopped. Preserve the owner record with the incident notes.
3. With all writers stopped, remove only that verified abandoned lock directory. Do not remove the entire lock directory tree or any analysis artifacts.
4. Restart through the documented launcher, reopen canonical corrections, and retry the pending save. Inspect the existing saved state first: a previous save may have committed before its process failed.

No live lock was abandoned or removed during this delivery. Crash tests operate exclusively in temporary directories.

## Verification

- 63 backend tests and 25 subtests pass, including actual handler checks for 503 before status access, read isolation, and export reload under ownership.
- 47 focused frontend tests pass. These include real Node/Python process contention in both directions, normal release, exception release, different-analysis concurrency, and SIGKILL abandonment without lock stealing.
- TypeScript and targeted diff checks pass.
- Guard tests use the real save handler/queue with controlled artifact I/O. Cross-language tests use real temporary lock directories and the documented `vaa1_core` Python interpreter.

## Scope limits

This serializes participating correction saves and export refreshes. It is not a multi-artifact rollback transaction and does not automatically enlist independent ledger endpoints, background Master Schema projection writers, arbitrary import scripts or external file editors. Source/clock revision adoption by every editing consumer, independent annotation conflict semantics, broader ledger coordination, and the full manual/restoration matrix remain open. Locks do not repair a stale payload merely by serializing it; the clock-offset precondition remains necessary. A general source-fingerprint/revision precondition is still needed on editing consumers.

## Live verification after reload

The backend was reloaded using `bash scripts/start_vaa1_macos.sh --backend-only --replace`. Both saved-expression and saved-language browser hydration checks passed. Read-only probes returned HTTP 200 for backend health, backend corrections, frontend corrections, and source-clock context. Frontend and backend correction guards agreed with the source-clock transcript offset. All 32 protected correction, ledger and source-metadata artifacts matched the original baseline hashes; no lock directories remained. No live correction POST was used for verification. Probe details are recorded in [shared_lock_readonly_probes.json](shared_lock_readonly_probes.json).
