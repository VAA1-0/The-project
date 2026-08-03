# Incident report: active Video 4 analysis was terminated during diagnosis

Date: 2026-08-03
Affected analysis: `e9cffc4c-275b-4dcb-b475-600b3c9ac2d7`
Source: `4MarcellaPhd_VHealth BLS F20.mp4`
Severity: analysis interruption with repeated computation; source media preserved

## Executive finding

The analysis did not stop because VAA1 raised an exception or because the face-analysis process crashed. The workstation entered repeated macOS maintenance-sleep periods, which suspended useful CPU work and made progress intermittent. After the machine fully woke at 10:17 local time, the analysis resumed normally and continued producing face-sample progress events.

During diagnosis, the backend was incorrectly classified as stalled from a single low-CPU process snapshot and an initially unchanged UI value. At approximately 10:24 local time, the backend was manually stopped with `Ctrl-C`. That operator action interrupted a still-active Video 4 analysis. The server explicitly reported that it was waiting for background tasks to complete when it was terminated.

## Evidence timeline

- macOS power logs record repeated `Maintenance Sleep` and `DarkWake` cycles while the machine was connected to AC power.
- A full wake from deep idle occurred at `2026-08-03 10:17:54 +0300`.
- After wake, VAA1 emitted regular persisted progress updates approximately every 12–14 seconds.
- Confirmed final events before termination:
  - `10:21:43 +0300`: face sample 217/333.
  - `10:21:55 +0300`: face sample 218/333.
  - `10:22:09 +0300`: face sample 219/333.
  - `10:23:27 +0300`: face sample 225/333; visual stage 81.9%; pipeline 39.7%.
- At about `10:24 +0300`, `Ctrl-C` was sent to the Uvicorn session during diagnosis.
- On the next backend start, the persisted in-flight record was correctly normalized to an interrupted/resumable state.

## Root cause

Direct cause: manual termination of the Uvicorn backend while its background face-analysis task was active.

The diagnostic decision was wrong because it relied on insufficient evidence:

1. A single process sample showed low parent-process CPU use. Face work runs through short-lived subprocesses, so that snapshot was not a valid liveness test.
2. No two-point progress comparison over a suitable observation window was performed before restart.
3. The existing event log was not inspected first; it proves that samples 217–225 completed immediately before termination.
4. Sleep/wake history was not checked until after the restart decision.
5. The system exposed `processing` but did not classify `running`, `sleep-suspended`, `subprocess active`, or `stalled` using a governed heartbeat.

## Contributing condition

The Mac was configured to permit system sleep on AC power (`sleep 1`). Overnight maintenance-sleep cycles suspended the CPU-intensive job for long intervals. Sleep explains the apparent lack of overnight progress, but it did not itself terminate the analysis: progress resumed after wake.

The face worker also had no explicit subprocess timeout or heartbeat. That is a robustness risk because a genuinely hung worker would be difficult to distinguish from sleep or a slow inference, although there is no evidence that such a hang caused this incident.

## Impact

- Source video and already completed analyses were not lost.
- Video 4's active visual computation was interrupted at face sample 225/333.
- The top-level checkpoint did not preserve the unfinished face substage, so work was repeated after restart.
- The queue did not advance to subsequent videos during workstation sleep or after manual termination.

## Required operational corrections

1. Never restart a processing backend from one CPU snapshot or one unchanged percentage.
2. Before declaring a stall, compare at least two persisted heartbeats/progress cursors across a defined threshold appropriate to the active motor.
3. Inspect the event log, child-process state, checkpoint timestamp, and macOS sleep/wake state.
4. Classify the runtime as one of: `running`, `sleep-suspended`, `cooling`, `worker-timeout`, `stalled`, `interrupted`, or `completed`.
5. Require a graceful pause/checkpoint request before backend shutdown when analysis is active.
6. Prevent unattended-analysis sleep or use an application-scoped power assertion while governed work is active.
7. Apply a bounded timeout and heartbeat to each face-worker subprocess; retry or quarantine a single failed sample without blocking the entire video.

## Recovery hardening delivered after the incident

The following changes reduce damage from any future interruption but are not presented as the cause of this incident:

- Atomic frame-sweep journal every 30 seconds or ten sampled frames.
- Atomic normalized checkpoint for every completed face frame.
- Atomic expression journal every ten sample timestamps.
- Source/configuration signature validation before reusing checkpoints.
- Structured progress details and non-duplicated progress presentation.

## Acceptance test

1. Start a representative Science scan and confirm heartbeat, worker PID/state and progress cursor are persisted.
2. Allow display sleep while preventing system sleep; confirm analysis continues.
3. Permit a controlled system sleep; confirm status becomes `sleep-suspended` and returns to `running` after wake.
4. Simulate a hung face worker; confirm timeout, sample-level failure isolation and continued batch progress.
5. Request graceful shutdown; confirm checkpoint completion before process exit.
6. Force-kill the backend; restart and confirm the next frame, face or expression cursor resumes without repeating accepted work.

## Accountability

The immediate interruption was caused by the diagnostic restart performed during this support session. The application made that mistake easier by lacking reliable liveness classification and a guarded shutdown path. Both the operator procedure and the software contract require correction.
