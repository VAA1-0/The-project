# Bug report: coupled service exit caused complete Datascene outage

Date: 2026-08-05

## Incident

At approximately 12:27 EEST, Datascene became unreachable at
`http://127.0.0.1:3001/dashboard`. Chrome reported
`ERR_CONNECTION_REFUSED`. Read-only inspection confirmed that neither the
frontend port 3001 nor backend port 8000 had a listening process.

## Verified timeline

- Marcella 3 wrote its last durable visual checkpoint at 12:25:31 EEST.
- The checkpoint remained incomplete at `next_index: 8606`.
- The Health analysis correction sidecar was written at 12:26:22 EEST,
  showing that foreground correction persistence remained available after the
  last recorded visual checkpoint.
- By 12:27, the frontend refused connections.
- At 12:28, both ports 3001 and 8000 had no listener.

The seven analysis records and canonical correction sidecars remained on disk.

## Immediate cause

The supported macOS launcher treats either child-process exit as a terminal
condition. Its monitoring loop exits when the backend or frontend PID dies,
and the `EXIT` cleanup trap then terminates the other child. A single service
failure therefore becomes a complete Datascene outage.

## Initiating fault

The initiating child failure could not be established from persisted evidence.
The launcher does not currently retain frontend/backend stdout and stderr in a
dated runtime log, and macOS produced no recent Node, Python, or Electron
DiagnosticReport. Memory was healthy after the outage, although cumulative VM
statistics showed substantial historical compression and swap activity. An
out-of-memory conclusion would therefore be speculative.

## Operational impact

- Datascene UI became entirely unavailable.
- Active Marcella 3 processing stopped before visual completion.
- Foreground analysis selection, source navigation, and corrections were
  unavailable until service restart.
- No verified persisted analysis or correction data was deleted.

## Recovery boundary

Marcella 3 must resume from the authoritative
`visual_frame_scan_checkpoint.json` after verifying the source signature. It
must continue after frame 8,606 and retain the accumulated object, OCR,
selected-face, and spatial-tone arrays. Completed stages recorded in
`analysis_checkpoint.json` must not rerun.

## Required correction

1. Persist separate dated stdout/stderr logs for frontend, backend, and launcher.
2. Record child exit code, signal, PID, and timestamp before cleanup.
3. Do not automatically terminate the healthy interactive frontend when the
   backend exits; keep local source playback and sidecar correction operations
   available in a visibly degraded state.
4. If the frontend exits, keep the backend and active governed analysis alive.
5. Add bounded restart supervision with backoff rather than coupled teardown.
6. Surface service health and last durable checkpoint in the UI.
7. Add a contract test proving that one child exit does not kill the other.

## Governance

Recovery must preserve the canonical operating practices:

- foreground panel and BBox/ROI commits remain small, atomic, and independent
  of heavyweight analysis;
- saved analyst corrections remain the highest authority;
- interrupted visual analysis resumes from its durable checkpoint; and
- no completed branch is rerun merely because the service process restarted.
