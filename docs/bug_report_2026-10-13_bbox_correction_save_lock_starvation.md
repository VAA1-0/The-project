# Bug Report: BBox Save Starvation and Missing Associated-Panel Refresh

Date: 2026-10-13
Branch: `petteri`
Severity: High — foreground analyst correction unavailable
Status: Corrected in worktree; focused automated acceptance and live non-mutating runtime probes passed; final analyst visual confirmation pending

## Analyst-visible failure

At Global Clock `0:04.300`, the analyst selected a detected person in the Video
panel and entered the user confirmation `Governor of California; Gavin Newsom`.
Neither **Save** nor **Save here** closed the BBox editor. The confirmation did
not surface in the associated analytical panels.

The screenshot's error banner reports a stale correction generation. Inspection
of the canonical sidecar shows that one of the near-simultaneous requests did
commit the identity, while the competing request correctly failed closed. The
saved confirmation then appeared over the Video panel but the Objects/OBJ panel
continued to show the raw `PERSON` label.

## Confirmed runtime evidence

The affected analysis was `b9e2e585-f00b-4c69-b39e-142b952ecdba` in governed
project `research-test-2-20226-cop30-vids`.

The running dashboard trace showed:

- repeated correction GET requests taking approximately 15–93 seconds;
- BBox correction POST requests returning HTTP 503 after approximately 84–93 seconds;
- a live shared correction lock owned by the dashboard process for the affected analysis;
- source-media and ordinary evidence routes continuing to return HTTP 200;
- no canonical success response, explaining both the open editor and absent panel propagation.

The canonical sidecar subsequently contained one manual visual annotation for
object track `9`, with label and identity affirmation
`Governor of California; Gavin Newsom`, interval `3–28` seconds, and a geometry
keyframe at source time `4.3`. The evidence was therefore not lost.

## Root cause

The local correction GET route acquired the exclusive cross-process correction
write lock before requesting the backend source-clock binding. On a cold source
fingerprint cache, that request can hash a large source video. Multiple mounted
panels request the correction ledger during hydration, so concurrent reads
queued behind one another while each held or waited for the same writer lock.
Foreground BBox POSTs then timed out with `CorrectionWriteBusy` and HTTP 503.

The backend fingerprint cache had a second concurrency weakness:
`functools.lru_cache` does not coalesce concurrent misses. A hydration fan-out
could therefore hash the same 272 MB source more than once, extending the stall.

This was lock starvation caused by expensive identity verification inside a
foreground correction critical section. It was not caused by the analyst's
label, BBox geometry, Global Clock value, project membership, or panel mapping.

Two UI defects compounded the original stall:

- Video emitted `analysisCorrectionsChanged` with the canonical envelope
  `{ analysisId, corrections }`, while Objects and other associated panels
  still compared the entire payload as though it were a legacy string ID.
  Those listeners silently skipped their refresh.
- geometry auto-save and an explicit **Save**/**Save here** action could submit
  the same overlay concurrently with one correction generation. The first
  request committed; the second then produced the screenshot's expected stale-
  generation error and left confusing editor state.
- the OBJ queue sorted raw detections chronologically and did not synchronize a
  Video overlay selection by track ID. At `0:04.000`, this made confirmed track
  `9` (detector confidence `86.3%`) appear associated with the open editor for
  track `11` (`60.9%`). Those values belonged to different people on the same
  beat, but the panel provided no visible distinction.

## Correction

1. The correction GET route now resolves source identity before entering the
   short correction snapshot lock.
2. The correction document is still read under the shared lock.
3. The POST path still resolves and validates source binding while holding its
   transaction lock. A source replacement between GET and POST therefore fails
   closed rather than committing against stale media.
4. Backend source fingerprint misses are now single-flight, preventing a
   concurrent dashboard hydration fan-out from hashing the same large source
   repeatedly.
5. A focused contract asserts that source fingerprinting precedes the GET
   correction lock, while existing source-replacement and correction-generation
   guards remain active.
6. Objects now installs canonical corrections directly from the event envelope;
   Master Schema, Meaning Plot, Data Maturation, Scene Cards, Time Bank, and OCR
   accept both canonical envelopes and legacy string IDs.
7. Video suppresses a second in-flight save for the same BBox/ROI overlay, so
   auto-save and explicit save cannot race one another.
8. OBJ now promotes analyst-confirmed tracks above the raw same-beat queue,
   labels the row as analyst-confirmed while retaining its source detector
   confidence, and follows Video evidence selection by exact track ID.
9. A subsequent interval correction exposed a projection regression. The
   canonical annotation and Master Schema presence record were correctly
   narrowed from `3–28` seconds to `3–4` seconds, but stale Narrative Agent,
   Master Schema, proliferation, or compatibility projections could repaint the
   confirmed identity on the same detector track at `6.513`. Video now treats
   an out-of-interval manual correction as a hard veto for those same-track
   semantic projections. Objects likewise no longer falls back to an interval-
   scoped identity when a row does not overlap the confirmed interval. Raw
   detector evidence remains available without inheriting the corrected
   identity.

Principal implementation locations:

- `src/frontend/app/api/local-analysis/[analysisId]/download/[fileType]/route.ts`
- `src/frontend/lib/correction-source-binding.ts`
- `src/backend/analysis/source_clock_context.py`
- `src/frontend/tests/correction-clock-guard.test.mjs`
- `src/frontend/tests/manual-annotation-governance.test.mjs`

## Automated acceptance

- correction clock/write-lock contracts: **9 passed**;
- focused visual-identity proliferation, BBox canonical-save, nonblocking
  hydration, associated-panel event propagation, duplicate-save suppression,
  and editor-close contracts: **7 passed**;
- backend source-clock, correction-revision, cross-process lock, and interactive-commit contracts: **33 passed plus 4 subtests**;
- frontend TypeScript: passed.

The broader frontend source-shape suite retains unrelated historical failures
and is not represented as wholly green.

## Live runtime verification after correction

The original launcher session was stopped so its backend and dashboard children
could not retain the old route implementation. Datascene was then restarted
cleanly through `scripts/start_vaa1_macos.sh --replace`.

- backend health: HTTP 200 / healthy;
- dashboard: HTTP 200;
- five concurrent correction-ledger hydration requests: HTTP 200;
- observed completion times: 3.08–4.63 seconds;
- no 503 response and no 84–93 second serialized queue recurred.

No synthetic BBox correction was written into the analyst's real CNN record for
this probe. The existing analyst-created correction was inspected read-only.
After hot compilation, live correction-ledger reads completed in approximately
0.5–0.9 seconds and the associated analytical routes returned HTTP 200.

## Required live acceptance

After restarting both services with the canonical launcher:

1. reopen the affected CNN analysis at `0:04.300`;
2. select the detected person BBox;
3. verify the already-saved `Governor of California; Gavin Newsom` Identification
   confirmation appears on the matching object track;
4. make a new bounded test correction and press **Save here** once;
5. verify the action returns promptly, closes the editor, and survives readback;
6. verify the manual visual annotation and matching Master Schema presence interval exist;
7. verify the identity surfaces in Video, Objects/BBox, Narrative Agent, Meaning Network, Master Schema, and Traceback consumers without becoming cross-project evidence;
8. restart once more and confirm the correction remains bound to the same analysis, source fingerprint, clock revision, and project.

Do not mark the live acceptance complete merely from the source-contract tests.

## Data and recovery note

The stale request did not receive canonical commit acknowledgment, but its
competing request had already committed. Reopen and use that canonical record;
do not submit a duplicate occurrence merely to compensate for the stale-
generation banner.
