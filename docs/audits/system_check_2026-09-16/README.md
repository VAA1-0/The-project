# Datascene presentation-day operational check

Date: 2026-09-16

## Operational verdict

The existing native Datascene saved-analysis presentation workflow is operational. This is not an all-features or release-readiness certification: automated contract failures and optional integration limitations remain.

The canonical macOS launcher was run with `--verify-envs`. Both `vaa1_core` and `vaa1_face` passed documented import verification. The existing backend and frontend passed readiness checks, including the proliferation matching route, so neither required replacement. Backend health returned HTTP 200. The scoped dashboard was opened at `http://127.0.0.1:3001/dashboard?activeProject=bond-cop30-helsinki`.

Docker Desktop was started. Docker engine 29.2.0 and the existing CVAT containers came online. CVAT's `/api/server/about` endpoint returned HTTP 200, version 2.3.

## Data and browser verification

- The backend catalogue returns 12 saved analyses in their two projects; the active Bond/COP30/Helsinki catalogue contains exactly five.
- All 12 source-video paths exist. All 536 registered artifact paths checked exist; registered JSON files parse. This does not certify missing/unregistered branches or all artifact semantics.
- No Time to Die retains 161 manual annotations. The exact September 7 `James Bond` correction at 71–72 seconds, including geometry and metadata, matches its saved reference in the local correction route, backend correction route, and Master Schema review layer.
- A fresh browser played the source video, sought to 71 seconds, and displayed the confirmed James Bond label without uncaught browser exceptions. Evidence: `bond-playback-71s.png`.
- Ten browser tests passed: BBox geometry/drag/resize fixtures, dashboard startup/reload, restored OCR, project separation, source routes, required Bond artifacts and authoritative transcript timing.
- One additional live Search test passed, including retrieval of saved source-linked records.

## Automated checks

| Check | Result |
| --- | --- |
| Frontend TypeScript | Passed |
| Complete frontend Node test suite | 123 passed, 9 failed |
| Scoped Python contracts | 58 passed, 1 failed, 3 skipped; 5 subtests passed |
| Browser suite selected for saved-work readiness | 10 passed |
| Live Search test | 1 passed |

Logs are retained beside this report. The Python run covered timestamps, face contracts/anonymization, hydration, canonical decisions, interactive commits, reporting, and language/visual/audio parity. It was not the entire backend test suite.

The Python failure expects the literal `detectedObjects: checkpointObjects`; current code returns `mergedCheckpointObjects`, combining checkpoint detections and manual annotations. This is a source-contract mismatch, not evidence from this test of runtime checkpoint loss.

Frontend failures concern statistical action wiring/wording, BBox canonical-save wiring, StatsKit visualization registration, proliferation targets, Narrative Agent presence, media-swap orchestration, mature subject consumption, catalogue prefix size, and expanded disclosures. These are source-inspection contracts. Some assertions target older implementation forms; passing live checks does not resolve every underlying requirement. No assertions were weakened and no broad code changes were made for presentation day.

## Limits and follow-up

- `pyannote` is absent from `vaa1_core`; fresh learned diarization is unavailable. Existing saved audio artifacts remain available. No dependency installation was attempted.
- The optional CVAT bridge still defaults to port 3001, also used by the current dashboard. Its client URLs and allowed origins follow the older 3000/3001 topology. CVAT itself is reachable, but an end-to-end authenticated Datascene-to-CVAT exchange was not certified. Resolve the bridge topology before using that workflow.
- Available disk space is approximately 20 GiB (96% used). Avoid unnecessary large exports or recomputation during the presentation.
- No new full detector run, model download, production build, portable-project export, or live customer-annotation write was performed. Persistence contracts and readback of the existing correction were checked instead.
- Saved sources, annotations, and unrelated worktree changes were preserved. Data integrity results are documented in `artifact_inventory.json`.

Recommended presentation path: native Video/BBox workspace, Transcript, Objects/OCR, Master Schema and saved evidence search. Broader governance failures should be addressed in a separate validated hardening pass.

## Presentation follow-up: POS and Quant hydration

The user subsequently identified empty rendered POS and Quant panels. The initial check validated their artifacts but did not validate the expanded panel contents. Both panels gated analysis loading on unnecessary media retrieval. The fix loads saved analysis directly, reports loading failures with a retry action, and ignores stale responses after selection changes. Quant now also initializes from the current selection and accepts correction event payloads in both supported formats. Layout factories preserve panel state.

The bounded local status response now includes project membership from the canonical catalogue index; selecting No Time to Die no longer moves it into Unassigned saved work. No saved artifact or analyst correction was rewritten.

Validation: frontend TypeScript check passed. The new saved-language-hydration Playwright regression passed with source and annotated-video downloads deliberately blocked: POS populated, Quant rendered 34 sentences and 235 words, and project membership persisted. Screenshots: `pos-hydrated.png` and `quant-hydrated.png`. The previously reported broader suite failures remain outside this focused fix.

## Presentation follow-up: intermittent empty Expressions

The user reported zero expressions in the video controls and an empty Expressions panel. Both artifact routes returned the intact 161-row saved expression file; a fresh browser session displayed 49 evidence-bearing detections and excluded 112 no-face/invalid sampling rows. The exact transient failure in the user's browser was not captured.

Two verified loading defects were addressed: Expressions did not replay the selected analysis on mount, and the shared artifact downloader only caught failures before response headers. A two-second backend timeout during response-body consumption previously escaped local fallback and could be converted by the expression loader into an empty result. Body consumption now occurs inside the fallback guard. Expressions also guards stale responses and reports top-level loading errors with a retry action. No saved data was modified.

Validation: TypeScript passed. Browser tests passed for a forced expression response-body timeout (49 detections in both the video controls and panel) and for POS/Quant hydration. `saved-expression-hydration.spec.ts` also checks reopening the panel after video selection. Evidence screenshot: `expressions-hydrated.png`.
