# Correction-save robustness round — 2026-09-23

## Delivered

Clock context now reads the authoritative correction sidecar before the backend cache. A dashboard-side clock-offset change therefore changes the backend's computed revision even when its in-memory analysis has not refreshed. Unreadable/malformed canonical corrections cause an error instead of silently reusing cached timing.

Canonical correction GET responses carry a transient `_clock_write_guard`: analysis identity and the transcript clock offset observed when the editor loaded. Dashboard POST validates it inside the existing per-analysis write queue, before merging or writing. Backend correction POST checks the same precondition against canonical corrections before mutating its status. A stale guard or foreign analysis returns 409. Legacy clients may save under an unchanged offset; changing the offset requires reopening corrections to obtain a guard. Malformed offset values are rejected. This guard protects the global offset; it is not a media fingerprint or a general annotation revision token.

The dashboard removes the guard before persistence and returns a refreshed guard with the saved result. It also reports the server's conflict message to the analyst. The canonical sidecar's clock offset wins over a newer compatibility bundle, and a malformed canonical file is never silently replaced by that bundle.

## Evidence

- 59 backend tests plus 25 subtests pass across correction guards, source context, isolation, ledger, API and transcript timing contracts.
- 42 focused frontend tests pass, including the actual dashboard POST/write queue with controlled artifact I/O. Two concurrent stale editors yield one successful clock change and one 409, with one write and preserved annotations. A separate actual backend handler test rejects before mutation or persistence. Reader tests cover canonical precedence and corrupt-file refusal.
- TypeScript passes.
- Both rendered hydration checks pass: saved Expressions, and POS/Quant without playable media.
- The wider frontend suite run reports 151 passes and the same ten known failures out of 161 tests; the final additional canonical-reader test passes separately. No green-release claim is made.
- An extra interactive annotation contract suite reports one unrelated checkpoint assertion failure (`detectedObjects: checkpointObjects` is not present in its expected source section). This round does not change that video-service branch; the failure was not relaxed.

All write tests use fixtures/test doubles or temporary files. No live correction save is used for verification.

## Still open

The dashboard queue serializes dashboard writes in one process. It is not a shared filesystem transaction lock across the dashboard, backend, background workers and imports. The backend guard currently checks before the existing save operation; it is not an atomic cross-process compare-and-swap. Source-file replacement/full clock-revision preconditions must still be carried by editing consumers. General local correction commits, dependent invalidation and canonical ledger projection still need their joint end-to-end acceptance test. These gaps remain Stage 1/C3 work; the manual acceptance matrix and portable restoration are not signed off.

## Live checkpoint

All twelve analyses were completed before the documented backend-only reload. GET-only probes confirm the dashboard and backend correction readers return matching guards and agree with the source-clock context. All 32 protected correction, ledger and source-metadata files match the original baseline. No live write was requested. Results: `correction_guard_readonly_probes.json`.
