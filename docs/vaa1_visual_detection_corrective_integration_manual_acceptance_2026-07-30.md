# Datascene/VAA1 visual detection corrective integration — manual acceptance

Date: 2026-07-30
Scope: measured shot boundaries and spatial-tone detection
Recommended source: the existing No Time To Die acceptance analysis

## Purpose

This test proves that the visual-detection amendments are operating as analyst-facing
features, not merely persisted artifacts. It covers extraction, canonical persistence,
source navigation, UI projection, StatsKit calculations, matcher/meaning participation,
governed reporting, save/reopen behavior, and scientific-state boundaries.

Do not substitute scene intervals for shots. Do not treat measured color properties as
semantic interpretation. Keep the browser console open and stop for continuous rerendering,
lost analysis selection, frozen panels, repeated failed requests, or false zero values.

## Automated preflight

From the repository root:

```bash
conda run -n vaa1_core python -m pytest -q \
  tests/test_visual_detection_integration_contract.py \
  tests/test_spatial_tone_measurement.py \
  tests/test_shot_boundary_measurement.py \
  tests/test_evidence_proliferation_matcher_contract.py \
  tests/test_governed_reporting.py

cd src/frontend
npx tsc --noEmit
node --test tests/manual-annotation-governance.test.mjs
```

Pass when all commands complete without test, type, or contract failures.

## Test 13 — measured visual detection operationality

### A. Runtime and route readiness

1. Start Datascene/VAA1 from the repository root:

   ```bash
   bash scripts/start_vaa1_macos.sh
   ```

2. Open `http://127.0.0.1:3001/dashboard`.
3. Confirm the backend health route succeeds.
4. Confirm OpenAPI exposes:
   - `POST /api/analysis/{analysis_id}/shot-boundaries/measure`;
   - `POST /api/analysis/{analysis_id}/spatial-tone/measure`;
   - `POST /api/analysis/{analysis_id}/proliferation/match`; and
   - governed report claim, export, and traceback routes.

Pass when the dashboard opens, the selected analysis remains stable, and all routes exist.

### B. Governed extraction and persistence

1. Select the No Time To Die acceptance analysis and record its analysis ID.
2. Run shot measurement once with persistence enabled:

   ```bash
   curl -fsS -X POST \
     -H 'Content-Type: application/json' \
     -d '{"persist":true,"threshold":27,"min_scene_len_frames":10}' \
     http://127.0.0.1:8000/api/analysis/ANALYSIS_ID/shot-boundaries/measure
   ```

3. Run spatial-tone measurement once with persistence enabled:

   ```bash
   curl -fsS -X POST \
     -H 'Content-Type: application/json' \
     -d '{"persist":true,"sample_interval_seconds":1}' \
     http://127.0.0.1:8000/api/analysis/ANALYSIS_ID/spatial-tone/measure
   ```

4. Confirm both responses report `persisted: true`, contain non-empty samples or
   intervals, identify their method/provider, and retain `source_media.clock`.
5. Refresh the analysis once. Do not rerun either detector.

Pass when the measurements survive refresh and no scene-card interval is presented as a
measured shot.

### C. Visual cues

1. Seek to a source moment covered by a spatial-tone sample.
2. Open the Video `Visual cues` inspector and select the tone/lighting view.
3. Confirm the nearest sample time is shown.
4. Confirm the view visibly presents:
   - dominant tone;
   - brightness band and numeric brightness;
   - saturation band;
   - numeric contrast; and
   - luminance entropy.
5. Seek at least five seconds away and confirm the nearest sample changes.

Pass when the values change with source time, remain numerical where measured, and no
missing value is rendered as zero.

### D. Cinematic cues

1. Open `Tools` → `Visual cues` → `Cinematic clues`.
2. Open `Measured shot boundaries`.
3. Confirm multiple rows show shot number, start/end extent, and duration.
4. Click a shot row and confirm Video seeks to the shot start.
5. Open `Measured visual tone`.
6. Confirm rows show tone, brightness, contrast, and entropy where available.
7. Click a tone row and confirm Video seeks to its sample time.

Pass when both measurement families are visible, source-navigable, and kept distinct from
manual cinematic annotations, shot-size estimates, transitions, and scene bands.

### E. StatsKit actuals

1. Open StatsKit and run it once.
2. In `Taxonomy / Attribute readiness`, confirm:
   - true shot-boundary intervals are `available`;
   - color/brightness/contrast frame-window extraction is `available`; and
   - the visual-tone next action says to use the governed measurements, not extract them.
3. In the Visual family, locate `mean brightness / contrast / saturation / color entropy`.
4. Confirm all four values are computed from `spatial_tone_scan.json`.
5. In Level V / Distribution, locate:
   - `shot length distribution`; and
   - `brightness / contrast distribution`.
6. Confirm both contain non-zero sample counts and medians derived from their respective
   persisted intervals/windows.

Pass when StatsKit exposes actual values and distributions, keeps scenes separate from
shots, and identifies the measured source layer.

### F. Matcher and meaning motors

1. In `Tools` → `Visual cues` → `Cinematic cues`, right-click a measured shot
   row and select `Open sheet`. Confirm the local Matcher review sheet opens
   above the cinematic evidence list without replacing Tools or Video.
2. Confirm `Governed evidence inventory` includes:
   - a governed `shot_boundary_interval` temporal segment; and
   - the `spatial_tone_measurements` foundational source layer.
3. Select `Run bounded matcher`. Confirm candidates are displayed in the sheet
   as review candidates and the candidate-only governance notice remains visible.
4. Select `Rebuild meaning artifacts` and wait for the completion message.
5. In `Meaning projection after rebuild`, confirm the resulting multimodal
   meaning artifact reports non-zero events for:
   - `measured_visual_tone`; and
   - `shot_boundary_interval`.

Pass when both families are reviewable evidence inputs and neither automatically becomes a
semantic identity, narrative claim, or mature interpretation.

### G. Governed report and traceback

1. Create one bounded report claim citing a measured shot or visual-tone source object.
2. Include the exact artifact evidence reference and source interval.
3. Confirm the claim is accepted as a governed report projection.
4. Open its traceback and confirm the chain reaches:
   - the measurement source object;
   - `artifact:shot_boundaries#…` or `artifact:spatial_tone_scan#…`; and
   - the cited source-time location.
5. Confirm the report claim remains non-canonical and does not convert a measured color
   property into semantic meaning.

Pass when the report is traceable, hash-bound, source-located, and authority-preserving.

### H. Reopen and global stability

1. Close the analysis and reopen it.
2. Recheck one Visual cues tone sample.
3. Recheck one Cinematic cues shot row.
4. Recheck the two StatsKit distribution rows.
5. Confirm the measurements were not duplicated.
6. Confirm manual annotations, transcript timing, BBoxes, and selected Narrative Agent
   remain unchanged.

Pass when both measurement families survive reopen, retain their source relationships, and
do not alter unrelated governed records.

## Acceptance record

- Analysis ID: `0b16df1c-bc47-4b24-b90f-4d34e53c68e4`
- Source filename: `NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264 (7).mp4`
- Automated preflight: passed — 23 focused backend tests, 61 frontend governance
  tests, and frontend TypeScript validation.
- Runtime readiness: passed — backend health, dashboard, measurement, matcher, and
  governed-report routes verified in the canonical runtime.
- Governed extraction: passed — both measurement calls persisted successfully.
- Shot count: `118` measured shots / `117` boundaries; mean shot duration
  `1.313559 s`.
- Spatial-tone sample count: `155` source-timed windows.
- Spatial-tone summary: mean brightness `41.708155`, mean contrast `42.740406`,
  mean saturation `73.841348`, mean luminance entropy `5.008514`.
- Visual cues: pending interactive observation.
- Live corrective retest at 2026-07-30 16:55:
  - the acceptance analysis opened in a fresh Chromium session;
  - Tools → Visual cues exposed `Measured shot boundaries`, `Measured visual tone`,
    and `Motion and scene basis`;
  - the existing Video surface remained selected and was not replaced or blanked;
  - no fatal browser-console error was observed; and
  - the reopened status payload exposed 118 shot intervals and 155 spatial-tone samples.
  This closes the cue-ownership and persisted-measurement visibility observations.
- Cinematic cues: partial failure observed at 2026-07-30 12:00.
  - `Motion and scene basis` renders `No dominant motion yet`, three zero-valued
    metric rows, and `Motion evidence is not available yet.` This reads as a
    contradictory measured result rather than one calm unavailable state.
  - Six governed scene intervals are visible and source-linked through Master
    Schema, but `Mean scene duration` renders `0:00.000`.
  - The six displayed scene bands are `0:00–0:24`, `0:24–0:48`,
    `0:48–1:12`, `1:12–1:36`, `1:36–2:00`, with the hydrated final interval
    ending at approximately `2:04`; the corrected panel derives `20.667 s`
    from the currently governed intervals. Absence of a panel-local summary
    must not become a measured zero.
  - Measured shot-boundary disclosure is visible below the scene basis; its
    row navigation remains pending inspection.
- Cue inspectors: failed at 2026-07-30 12:04, corrective patch pending manual
  retest.
  - The cue choices appeared as a long button row at the bottom of the Tools
    workspace, below large annotation lists.
  - Selecting a cue invoked a generic `openPanel("VideoPanel")` route; the
    existing Video panel subsequently rendered blank while annotation data
    surfaced in Tools.
  - Corrective implementation moves one alphabetized cue dropdown to the top of
    Cue inspectors and sends `visualCueOpen` to the existing Video panel without
    opening or replacing a Video leaf.
  - Retest at 12:08 showed that the dropdown still emitted `videoIdChanged`
    before `visualCueOpen`; selecting `Color regime` reset the existing Video
    media and produced a blank panel without visible color data.
  - The second correction removes `videoIdChanged` entirely. Cue selection now
    emits only `visualCueOpen` to the already-mounted Video panel.
  - Retest at 12:18 confirmed that Video-owned inspector state itself still
    blanked the source viewer even without the media-change event.
  - The corrective ownership boundary is now explicit: cue selection remains
    inside Tools, and the Video panel remains a stable source viewer. Color
    regime renders its persisted whole-frame summary and source-time samples
    directly below the Tools dropdown; only an explicit sample click seeks the
    source video.
  - Manual action and Manual Narrative Agent annotation lists now use closed
    disclosures by default.
  - `Motion and scene basis` now uses a closed disclosure by default.
- StatsKit: pending interactive observation.
- Stepwise manual acceptance checkpoint at 2026-07-30 17:41:
  - Step 1 passed: persisted shot and visual-tone disclosures surfaced and
    navigated source without replacing Video.
  - Step 2 passed: cue inspectors retained stable Video ownership, color rows
    were source-navigable, unavailable motion remained calm, and governed scene
    duration rendered correctly.
  - Step 3 passed after corrective StatsKit work:
    - readiness now has Category, dependent Subcategory, Find entry, and a
      Governed measured source layer navigator;
    - true shot boundaries report `available` with 118 rows;
    - color/brightness/contrast frame-window measurements report from the
      governed spatial-tone layer;
    - visual-shot taxonomy rows resolve 118 timed governed evidence records
      without conflating visual-scene rows; and
    - selecting a shot record seeks Video while StatsKit remains open.
  - Resume at Step 4: matcher and multimodal meaning inputs. No Step 4 action
    has yet been performed in this manual sequence.
- Step 4 opening interaction defects observed on 2026-07-31:
  - right-clicking a measured shot row in Tools fell through to Chrome's native
    context menu rather than Datascene evidence actions;
  - `Correct` opened a blocking browser prompt detached from the selected row;
  - the first corrective popup was rejected in manual review because it was a
    second generic menu, not the established Datascene regime;
  - the revised cinematic-row menu now uses the Meaning Network menu as its
    visual and behavioral base: governed item header, copy, local sheet,
    matcher, quick-confirm eligibility, source jump, and traceback actions;
  - `Open sheet`/`Correct` opens an editor attached to the selected row, with
    its current governed value and source interval visible; and
  - the GoldenLayout panel shell now supplies an honest Datascene fallback menu
    when a panel target has no specialized governed action, preventing native
    browser interaction from masquerading as application functionality.
  - the 19:52 retest confirms the row-attached editor and Datascene menu now
    render, but also exposes that the menu is not a complete Step 4 route:
    matcher execution reports only a candidate count, no governed evidence
    inventory is reviewable, and no visible second-order rebuild/result surface
    is available.
  The interaction repair is verified, but Step 4 is blocked by missing
  analyst-facing matcher and meaning review surfaces. Do not record a pass from
  the current controls.
- Matcher and meaning motors: passed on 2026-07-31 — the live rebuild projected
  118 `shot_boundary_interval` and 155 `measured_visual_tone` events as
  non-semantic measured evidence. Deterministic projection now runs
  automatically when governed measurement artifacts change; the local sheet is
  an audit/correlation surface rather than a manual plumbing console.
- Governed report traceback: passed on 2026-07-31 — the measured-shot
  traceback retained its artifact reference, exact source interval, authority,
  and working source navigation without replacing the evidence workspace.
- Reopen: passed on 2026-07-31 — reopening the saved analysis retained 118
  measured shot intervals, 155 tone measurements, their corresponding meaning
  projections, source-time correlations, and working Video navigation.
- Export: blocked by scope correction on 2026-07-31. The existing flat output-file
  ZIP cannot prove full panel/feature delivery and its Markdown report covers only
  scene cards. Acceptance now requires one feature-chaptered, machine-readable Data
  Book plus one synchronized human-readable scientific report, including explicit
  operational/partial/deferred/unavailable/not-run coverage and sentence-to-source
  citations. Publication must support both independently complete per-video editions
  and whole-project editions that preserve their contributing video identities and add
  governed cross-video synthesis.
- Browser-console findings:
- Final result: `in progress / partial failure` — automated, runtime, route,
  extraction, and persistence gates passed; Cinematic cues motion/scene summary
  presentation failed; remaining interactive UI, report traceback, and reopen
  gates remain.
- Defect references:
  - `VD-13-01`: unavailable motion evidence is rendered as a zero-valued
    measurement block instead of one calm unavailable state.
  - `VD-13-02`: mean scene duration resolves to `0:00.000` when governed scene
    intervals exist but the panel-local summary value is absent.
  - `VD-13-03`: bottom button-row cue navigation can replace or blank the active
    Video panel. Removing the media-change event was insufficient because the
    Video-owned inspector state also displaced the viewer. Inspector ownership
    has now moved to Tools; pending manual retest with `Color regime`.
  - `VD-13-04`: Manual action annotations, Manual Narrative Agent annotations,
    and Motion and scene basis opened expanded despite being supporting
    evidence surfaces. Corrected to begin collapsed; pending manual retest.
  - `VD-13-05`: saved-analysis hydration restored tracked objects but omitted
    persisted `shot_boundaries.json`, `spatial_tone_scan.json`, and
    `adaptive_visual_scan.json` from `results.visual_analysis`. After a backend
    restart, Tools therefore reported no cinematic clue record even though the
    measurement files existed. The canonical hydration loader now restores
    these governed visual artifacts and registers their output paths. Focused
    hydration/visual tests pass 7/7, and the live Chromium retest exposes the
    measured shot and tone disclosures after reopen.

## Overall pass boundary

Test 13 passes only when all visible surfaces consume the persisted measurements, source
navigation works, actual StatsKit values are computed, matcher/meaning/report routes retain
traceback, reopen is stable, and no detector output is promoted beyond its measured authority.
