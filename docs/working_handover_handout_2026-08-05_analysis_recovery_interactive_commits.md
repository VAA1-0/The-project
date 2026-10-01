# Working handover: analysis recovery, live checkpoint data, and interactive commits

Date: 2026-08-05  
Workspace: Datascene/VAA1  
Thread boundary: close the current recovery thread and continue in a fresh one

## Current outcome

The seven analyses were not deleted. Their temporary disappearance from the
Project panel was a catalogue/bootstrap failure while the Python backend was
CPU-bound and loading large persisted records. The records subsequently
reappeared.

Marcella 3 is the active governed run. The screenshot at 10:39 showed:

- pipeline progress: 28.9%;
- visual sweep: approximately 37.1%;
- source progress: approximately 271.9/476.2 seconds;
- frame progress: 8,158/14,286 frames; and
- macOS sleep prevention active.

Marcella 2 remains the incomplete analysis after Marcella 3. Marcella 1 and
Marcella 4–7 have completed visual and audio/language stages according to their
stage checkpoints.

## Recovered data and continuation boundaries

The visual pipeline already supports exact checkpoint continuation. It verifies
the source signature, hydrates accumulated arrays, seeks to `next_index`, and
continues with the following frame. A resumed sweep does not reopen the old MP4
writer and therefore does not repeat the earlier `NoneType.write` failure.

Current relevant boundaries captured in this thread:

- Marcella 3: continue from its latest changing `next_index` (8,158 in the
  10:39 screenshot). Its checkpoint already contains object, OCR, face-frame,
  and spatial-tone measurements.
- Marcella 2: skip the completed `audio_language` branch and resume the visual
  sweep at frame 263. Its checkpoint currently contains 2 object detections, 9
  OCR detections, 9 selected face frames, and 263 spatial-tone samples.
- Marcella 1: skip both `audio_language` and `visual`; use its canonical output
  files. Its surfaced record contains 1,425 object detections, 4,412 OCR
  detections, and 670 expression samples.
- Marcella 4–7: skip both completed branches and use their canonical outputs.

The queue must derive work from completed stage membership and the visual
checkpoint, not from the displayed `full profile` label alone.

## Why Marcella 1 takes more than five minutes to open

The source video is not the primary bottleneck. Marcella 1's
`analysis_record.json` is 134,001,065 bytes. Opening a completed analysis calls
the full status route, serializes this record, may run iterative refresh work,
and then requests several derived artifacts in parallel. The active Marcella 3
visual scan is simultaneously consuming the Python process. A direct bounded
status request for the active service timed out after 30 seconds during this
handover capture.

This violates the Datascene shell-first panel principle. Selecting a video must
open the source and panel shell from bounded metadata; detector arrays and
derived panels must hydrate independently and only when opened. The next thread
should fix this route before interpreting Marcella 1's panel state as missing.

Required correction:

1. Use the bounded status summary for selection and source-video opening.
2. Do not call the full `/api/status/{analysis_id}` route on initial selection.
3. Load Objects, OCR, Expressions, Transcript, and other large layers through
   separate artifact routes when their panels open.
4. Remove detector arrays from the shell/bootstrap response.
5. Keep derived-artifact generation out of read/status requests.
6. Measure selection-to-video-shell and individual panel hydration separately.

## Interactive annotation delivery completed

Panel and BBox/ROI confirmations now have an isolated lightweight commit path:

- the canonical `annotation_corrections.json` sidecar is written atomically;
- the fallback writer does not read or rewrite `analysis_record.json`;
- the frontend waits at most two seconds for the Python writer and then uses the
  independent Next.js writer;
- save and reopen were exercised during active analysis at approximately 0.10
  seconds and 0.012 seconds respectively;
- the large analysis record remained untouched;
- backend save handlers have been changed to worker-thread handlers for the next
  backend restart;
- new heavyweight analysis admission reserves 2 GiB of available memory for
  the interactive workspace by default; and
- proliferation is queued/deferred after the durable analyst commit.

Operating documents:

- `docs/vaa1_interactive_annotation_operating_practice_2026-08-05.md`
- `docs/vaa1_operating_principles_constellational_meaning_network_2026-05-26.md`

## Live checkpoint surfacing added

The previous frontend deliberately returned empty Objects, OCR, and Expressions
arrays whenever an analysis was not `completed`. A dashboard-local checkpoint
read and an in-progress mapping have now been added so measured object and OCR
records can surface while clearly labelled as checkpoint data.

Relevant operating document:

- `docs/vaa1_checkpoint_surface_and_resume_practice_2026-08-05.md`

This frontend change should be verified manually in the fresh thread while
Marcella 3 remains active. Expression results remain unavailable until their
later branch has actually produced its checkpoint/artifact.

## Stale visual-error incident fixed

A successful Marcella 1 recovery previously retained an obsolete
`visual_error`, causing repeated reruns. The visual success path now removes the
superseded error before completion persistence. Marcella 1 was reconciled only
after its governed visual and audio/language artifacts were verified.

Incident report:

- `docs/bug_report_2026-08-05_stale_visual_error_retry_loop.md`

## Verification performed

- Interactive annotation contract and queue tests: 6 passed.
- `api_server.py` syntax compilation passed.
- Focused diff checks passed.
- Live sidecar save/reopen passed without touching the full analysis record.
- Repository-wide TypeScript checking still reports unrelated existing errors
  in `SpeechToTextPanel.tsx` and `StatsKitPanel.tsx`; these were not introduced
  by the checkpoint or interactive-commit changes.

## First task for the fresh thread

Deliver bounded analysis opening:

```text
click Marcella 1
-> bounded metadata and source video immediately
-> panel shell usable
-> each large feature hydrates only when requested
-> no full-record serialization or derived regeneration on read
```

Do not restart the backend until the active Marcella 3 visual sweep reaches a
safe completion/checkpoint boundary. The current backend does not yet include
the newest worker-thread and memory-admission code; the independent frontend
annotation writer and checkpoint reader are available through development-mode
hot reload.
