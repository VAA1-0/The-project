# Dashboard correction snapshot binding — 2026-09-23

## Delivered

The canonical dashboard corrections GET now holds the shared per-analysis filesystem lock while reading corrections and requesting the backend source-clock context. It returns their source fingerprint, clock revision and explicit binding status in the transient `_clock_write_guard`. An offset mismatch rejects the snapshot. Cooperating correction writers cannot intervene between these reads. The backend context GET must remain non-locking to avoid recursive acquisition while the dashboard owns the lock.

The dashboard POST validates the submitted read-time binding under the same lock before any artifact write. Changed media/revisions, incomplete bindings and unavailable media reject a versioned save. The API service transports the caller's loaded guard without fetching a newer one to authorize the save. After commit, the route returns a refreshed binding; the API service checks that its subsequent readback still has that binding as well as the committed timestamp.

Clock-service errors return 503 without silently issuing an offset-only guard. The clock lookup has a 15-second timeout; other writers can hit their five-second lock acquisition timeout during a slow lookup and should retry. Source-unavailable snapshots remain inspectable with an explicit unavailable binding; versioned saves cannot verify that binding. Legacy guardless/offset-only payloads retain compatibility, so this is not yet universal mandatory version enforcement.

A failure after canonical rename reports `canonical_committed: true` and asks the analyst to inspect the saved state before retrying. The save remains a multi-artifact operation without rollback; this response does not claim that the projection also succeeded.

## Verification

51 focused frontend tests pass, including the real route functions with controlled artifact/context I/O, binding transport validation, API-service guard preservation and changed readback rejection. The route fixtures check locked reads, replaced-source rejection before writes, backend-unavailable reads/saves, serialized offset changes, transient-guard removal and explicit post-commit verification failure. Existing real Node/Python lock tests remain included. TypeScript passes.

Both browser hydration checks (Expressions and POS/Quant) passed against the updated read route. A live read of Bond corrections returned a fingerprint, revision and offset matching the backend context. All 32 protected saved artifacts match the baseline and no lock directories remained. No live correction POST was used. [Read-only probe](dashboard_binding_readonly_probes.json).

## Remaining boundaries and next step

This snapshot coordinates correction writers, not arbitrary external media/metadata replacement or independent import/projection writers. Legacy backend correction GET still issues an offset-only guard. Browser hydration checks prove continued loading, not end-to-end analyst save acceptance.

Next audit every editor's draft lifetime, correction construction, refresh and undo path: a draft must keep the binding associated with its evidence rather than inherit a newer binding during a refresh. Verify delayed responses and source swaps using isolated fixtures, then add consistent conflict feedback. Revision-aware navigation and manual M1–M6 remain open; the clock stage is not complete.
