# Working handover: delivery lockdown, durable annotation, Source Media, and recovery watchdog

Date: 2026-08-05  
Workspace: Datascene/VAA1  
Priority: secure the remaining Marcella analyses for morning delivery without sacrificing user-authored records

## Executive status

Datascene is in delivery lockdown. Feature work and heavyweight maturity refreshes must remain secondary to:

1. keeping interactive annotation commits available;
2. finishing Marcella 3 from its durable visual checkpoint;
3. repairing Marcella 2's missing visual branch after Marcella 3 completes; and
4. preserving verified outputs progressively rather than waiting for the whole corpus.

Frontend and backend were listening on ports 3001 and 8000 at the last operational check. The bounded backend analyses endpoint nevertheless timed out under visual-scan load, so dashboard status must not be treated as the only source of truth. Durable analysis records and checkpoints are the governing delivery evidence.

## Delivery snapshot

A clone snapshot was created at:

`backups/delivery-lockdown-2026-08-05-1948/`

It contains:

- a clone of `outputs/api_results`;
- 167 JSON records;
- a dedicated Marcella 3 visual-frame checkpoint;
- a dedicated Marcella 3 expensive-branch checkpoint; and
- a snapshot README recording the verification boundary.

The clone completed without pausing the active analysis. Restore must be selective; never replace the complete live output tree wholesale.

An earlier recovery snapshot also remains available at:

`backups/datascene-json-2026-08-05-recovery/`

## Current analysis truth

### Marcella 3 — Technology

- Analysis ID: `ca6d0ebf-cbb5-4f7e-8502-f8b0693daf33`
- Governing state: processing
- Stage: continuous visual scan
- Pipeline progress at watchdog installation: 31%
- Visual progress: approximately 45.8%
- Checkpoint advanced during verification from frame 10,051 to at least 10,080 of 14,286.
- No current visual error was present.

Because the frame checkpoint advanced, the worker was not restarted. A static percentage is not evidence of a wall when `next_index` continues to move.

### Marcella 2 — Business

- Analysis ID: `c034341f-3fba-495e-a7d1-0af03a46cb6c`
- The record contains `status: completed`, but this is not a valid full-delivery claim.
- The visual-frame checkpoint is incomplete at frame 263.
- The visual payload is absent.
- The retained visual failure is `'NoneType' object has no attribute 'write'` in the earlier record representation.
- Referenced audio, transcript, prosody, diarization, POS, Quant, metadata, schema, and derived JSON files exist and parse, but they do not substitute for the missing visual branch.

The Project panel's error state is therefore materially correct. Marcella 2 must resume its missing visual branch after Marcella 3 reaches verified completion. It must not run in parallel with Marcella 3.

### Other Marcella analyses

Marcella 1 and Marcella 4–7 have completed records and are preserved in the delivery snapshot. They should be exported and verified progressively. Their delivery status must still be based on required-artifact validation, not the phrase `full profile` alone.

## Overnight recovery watchdog

Script:

`scripts/vaa1_delivery_checkpoint_watchdog.py`

The watchdog is started in a dedicated macOS Terminal session because a LaunchAgent is denied access to a project stored under Desktop privacy controls.

Queue order:

1. Marcella 3 — Technology
2. Marcella 2 — Business visual-branch repair

Operational policy:

- poll every 30 seconds;
- declare a wall only after five minutes without a change in the governed progress signature;
- snapshot the affected analysis before recovery;
- restart the backend only, leaving the frontend untouched;
- resume through `/api/analyze/{analysis_id}` so checkpoint admission remains authoritative;
- allow three recovery attempts in one cycle;
- cool for ten minutes after the third failed recovery;
- re-evaluate the checkpoint and begin a renewed three-attempt cycle;
- continue renewable cycles instead of entering a ten-second crash loop or stopping permanently.

Runtime evidence:

- `outputs/runtime/delivery_watchdog_state.json`
- `outputs/runtime/delivery_watchdog.log`
- `outputs/runtime/delivery_watchdog_backend.log`
- recovery snapshots under `backups/delivery-watchdog/`

The dedicated Terminal window must remain open. Closing that window terminates the watchdog.

Operational event after initial installation:

- the first monitor observed five minutes without a checkpoint change;
- it created `backups/delivery-watchdog/20260805-201151-ca6d0ebf-cbb5-4f7e-8502-f8b0693daf33-stall-visual_scan` before attempting recovery;
- the visual scan then advanced to frame 10,082 and emitted a fresh progress event at 20:13:48 EEST;
- frontend and backend listeners remained present; and
- the renewable-cycle watchdog replaced the initial hard-limit monitor as PID 40502.

The backend health request still timed out under load even while the durable frame checkpoint advanced. This reinforces the rule that a slow health/status response alone is not sufficient evidence for another restart.

## Interactive annotation and correction delivery

The canonical operating rule remains: user input is lightweight and must commit immediately even when data maturation takes longer.

Implemented boundaries:

- panel and BBox/ROI corrections use the atomic `annotation_corrections.json` sidecar;
- save acknowledgement follows canonical sidecar readback;
- saved correction payloads update open panels without full-analysis refresh;
- transcript corrections surface locally from the returned canonical correction record;
- source video navigation remains independent from the heavy analysis response; and
- maturity/proliferation work is deferred from the foreground commit.

Relevant practice:

- `docs/vaa1_interactive_annotation_operating_practice_2026-08-05.md`
- `docs/vaa1_checkpoint_surface_and_resume_practice_2026-08-05.md`

## Source Media durability and role proliferation

Source Media now has a canonical annotation sidecar:

`source_media_annotations.json`

The local Source Media route overlays this user-authored record over generated `source_media_metadata.json`. It:

- writes atomically;
- reads back the saved representation;
- merges concurrent fields;
- refuses a stale empty payload overwriting a non-empty saved value; and
- keeps form typing and saving independent from full analysis hydration.

For Marcella 1 — Spirituality, revision 17 was verified through the live frontend route. The saved individual candidates were:

- Peace-maker
- Facilitator
- Coordinator
- Healer
- Councelor
- Conscious

The BBox and Transcript role-confirmation menus now receive the saved Source Media payload immediately through `sourceMediaMetadataChanged`. Future analysis hydration reads `apiService.getSourceMediaMetadata(id)` rather than the stale generated metadata artifact. Maturity refresh is not required for these role candidates to surface.

## Associated incidents and bug reports

### Coupled frontend/backend outage

Report: `docs/bug_report_2026-08-05_coupled_service_outage.md`

One child-service exit caused the shared launcher to terminate the other child, producing complete `ERR_CONNECTION_REFUSED` downtime. Persisted analysis and correction files survived. Recovery automation must restart only the failed backend when checkpoint recovery is needed; the annotation frontend should remain available.

### Source Media overwrite without traceback

Report: `docs/bug_report_2026-08-05_source_media_user_data_overwrite_without_traceback.md`

Previously saved PEOPLE / ROLES and CHARACTER ROLES were replaced by empty generated values without a value-bearing immutable revision. This violated user-authority and traceback rules. The canonical Source Media sidecar and stale-empty merge guard are the immediate containment.

### Stale visual error retry loop

Report: `docs/bug_report_2026-08-05_stale_visual_error_retry_loop.md`

A successful recovered branch retained an obsolete visual error, causing repeated analysis launches and resource consumption. Success transitions must clear superseded branch errors atomically. Queue truth must reconcile the required branch, checkpoint completion, payload presence, and current error state.

### Analysis interruption from insufficient stall evidence

Report: `docs/bug_report_analysis_interruption_checkpoint_loss_2026-08-03.md`

An active analysis was manually stopped after a single misleading CPU observation. The governing correction is multi-point checkpoint observation. The current watchdog uses five minutes without signature advancement and snapshots before any backend restart.

### Empty dashboard and slow panel hydration

Associated handover: `docs/working_handover_handout_2026-08-05_analysis_recovery_interactive_commits.md`

Large `analysis_record.json` hydration and backend saturation caused empty or delayed panels. Selection must use bounded shell metadata; large artifacts must hydrate independently. The Source Media and correction paths have been isolated, but broader panel-by-panel bounded hydration remains an active architectural requirement.

### Deceptive completion language

Marcella 2 demonstrates that a top-level `completed` value can coexist with an incomplete visual checkpoint and missing visual payload. No user-facing `full`, `completed`, or `delivered` statement is valid until required branches and artifacts are verified. This incident is associated with the stale-visual-error report and should receive its own report if the contradictory record shape survives the next recovery run.

## Verification performed in this thread

- Source Media live GET: HTTP 200 in approximately 0.013 seconds.
- Saved Marcella 1 Source Media revision and six individual candidates verified.
- Focused role-proliferation contract tests: passed.
- Video 2 referenced-file existence check: passed for every recorded path.
- Video 2 JSON syntax validation: passed.
- Video 2 visual-delivery validation: failed, correctly retained as remaining work.
- Marcella 3 checkpoint advancement: verified at multiple points.
- Snapshot clone: completed with 167 JSON records.
- Watchdog syntax and live signature checks: passed.
- Watchdog dedicated Terminal process and state heartbeat: verified.
- Repository-wide TypeScript checking still contains unrelated existing `StatsKitPanel.tsx` errors; this is not evidence that the focused persistence and proliferation contracts failed.

## Disk-streamed portable project-bundle save

The interactive Save Project action previously waited indefinitely for the CPU-bound backend and attempted to assemble multi-gigabyte media in memory. A temporary data-only fallback proved fast but was rejected as insufficient because individual portable saves were not reliably available.

Save Project now uses an independent disk-streaming route. It stages hard links, writes a Zip64 archive directly to disk without recompressing already-compressed media, and streams the finished file to the browser. The project bundle includes source video, extracted audio, governed analysis artifacts, metadata, and annotation records for every included completed analysis. It does not hold the complete bundle in frontend memory or interrupt the active analysis worker.

A live portable probe included source video and extracted audio, produced a valid 137,316,052-byte ZIP in 1.94 seconds, passed archive integrity, and reported no skipped analyses. Probe copies were removed after verification.

## Morning acceptance sequence

1. Do not close the watchdog Terminal before reading its state and log.
2. Confirm both ports 3001 and 8000 are listening.
3. Read `delivery_watchdog_state.json` and the tail of `delivery_watchdog.log`.
4. Verify Marcella 3 checkpoint completion and required visual/audio artifacts.
5. Verify that Marcella 2 was launched only after Marcella 3 completed.
6. Confirm Marcella 2's visual checkpoint is complete and its current visual error is absent.
7. Open each video through bounded shell hydration and inspect actual panel data.
8. Save one harmless, explicitly identified test annotation only if a live persistence probe is necessary; do not alter customer annotations casually.
9. Export verified analyses progressively into immutable delivery copies.
10. Record any incomplete branch plainly. Do not surface a deceptive completion label.

## Non-negotiable operating rules

- User-authored values outrank generated values.
- User saves are foreground, atomic, read-back verified, and independent from maturation.
- No full analysis restart when a valid checkpoint exists.
- No parallel heavyweight analysis during delivery lockdown.
- No backend restart from a single CPU sample or static dashboard percentage.
- No recovery without a preceding snapshot.
- No `completed` delivery claim without required-artifact verification.
