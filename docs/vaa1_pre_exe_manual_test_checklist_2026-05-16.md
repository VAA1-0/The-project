# VAA1 Pre-EXE Manual Test Checklist

Date: 2026-05-16
Branch: `petteri`

This is the living manual test list to complete before writing or publishing a Windows `.exe`.

## Startup And Packaging Readiness

- Start backend from a clean shell and confirm `/api/health` responds.
- Start frontend and confirm Dashboard loads without a blank panel.
- Start Electron wrapper and confirm the same project state is visible.
- Restart backend and frontend after one completed analysis and confirm saved work still opens.
- Confirm no required runtime writes target user-protected folders without fallback.

## Upload And Analysis Flow

- Upload a short known video and run full analysis.
- Confirm Project queue progresses through upload, analysis, completion, and reopen.
- Confirm video playback loads from stored source media after a browser refresh.
- Confirm failed or cancelled analysis states remain visible and recoverable.

## User-Confirmed Anchor Evidence

- Edit Source Media metadata fields and confirm changes persist after refresh.
- Correct a BBox/ROI label and confirm the video overlay shows the corrected/mature label first.
- Add a manual annotation in the video panel and confirm it appears in Master Schema.
- Correct transcript text and confirm downstream panels prefer the corrected text.
- Confirm user corrections remain higher priority than raw detections and inferred candidates.

## Maturity Proliferation

- Run Refresh maturity in Source Media and confirm filled/protected/review counts update.
- Confirm Master Schema shows the User Confirmed Anchor card.
- Confirm Master Schema contains the most mature data for every subject, including user-confirmed metadata, panel corrections, BBox/ROI annotations, transcript corrections, scene annotations, and Narrative Agent Profiles.
- Confirm later Master Schema layout work provides a data-governance matrix view, similar to POS/Quant matrices, with dropdown navigation for all governed data surfaces and no task-specific widget clutter.
- Confirm analysts can manually inspect and correct all governed data in Master Schema even when ordinary analysis work happens in other panels.
- Confirm concise confirmation families appear in Master Schema and Meaning / Plot.
- Confirm second-order suggestions surface without requiring confirmation for every candidate.
- Confirm accepted/corrected evidence remains traceable to raw source evidence.
- Confirm BBox/ROI overlays prefer user-confirmed and Master Schema mature agent/sample-profile labels before raw tracker labels.

## Agent Persistence Across Scene Cuts

- Run a clip where a confirmed narrative agent disappears before a cut and reappears after the cut.
- Refresh status or reopen the completed analysis and confirm `agent_persistence_scene_cut.json` is written to the analysis output bundle.
- Confirm the backend creates an `agent_persistence_scene_cut` candidate only near a confirmed scene boundary.
- Confirm the persistence candidate shows departed track, arrived track, sample-profile similarity score, threshold, and traceback evidence.
- Confirm below-threshold or ambiguous cross-cut matches remain review candidates instead of silently mutating the agent/sample-profile label.
- Confirm an accepted/review candidate appears in `second_order_label_proliferation.json` with `source_feature_type: agent_persistence_scene_cut`.
- Confirm the Video Panel distinguishes continuous tracking from constellational scene-cut triangulation.
- Confirm Master Schema preserves the re-link route back to feature clouds, frames, bboxes, and scene boundary.

## Narrative Agent Profile

- Retrieve web metadata for a known fiction film.
- Confirm Narrative Agent Profiles represent narrative agents, not natural-person identity profiles.
- Edit/drop a character role and confirm the correction persists.
- Confirm actor/performer data stays attached metadata, not the identity profile itself.
- Confirm dramatic/archetype readings remain electable rather than imposed.
- Confirm Meaning / Plot shows Scene Agent Browser and Characters By Scene after retrieval.
- Confirm Characters By Scene can expand one character at a time and lists only that agent's surfaced or staged scenes.
- Confirm scene browsing still appears as derived evidence windows when formal scene segments are unavailable.
- Confirm Character Paths, Scene Agent Browser, and Characters By Scene can scroll through the full available arrays.
- Confirm character scene rows expose source jumps, transcript lines, expression samples, and agent sample-profile persistence signals where available.
- Confirm analysts can add a Narrative Agent Profile to a scene where detection did not surface it.

## Traceback And Navigation

- Click BBox/ROI evidence and confirm the evidence panel opens at the correct source moment.
- Navigate from Meaning / Plot candidates to the video timestamp.
- Navigate from Scene Cards to source evidence and back to Meaning / Plot.
- Confirm forensic traceback tree records open and preserve source references.
- Confirm raw artifacts remain downloadable after mature data supersedes them in the UI.

## Mise-En-Scene And Reports

- Confirm Scene Cards surface mature transcript/object/person/metadata where available.
- Confirm meaning/plot candidates are visible from scene-level context.
- Confirm source metadata and scene understanding can feed report/export surfaces.
- Export a single analysis package and verify corrected data, raw data, and governance artifacts are included.
- Export a project package and verify multiple analyses retain distinct source identities.

## Regression Smoke Test

- Run `npm test` in `src/frontend`.
- Run `npx tsc --noEmit` in `src/frontend`.
- Run `conda run -n vaa1_core python -m unittest tests.test_source_media_metadata_contract`.
- Re-run one previously completed analysis and compare key panel counts against the saved state.
