# VAA1 Pre-EXE Manual Test Checklist

Date: 2026-05-16
Branch: `petteri`

This is the living manual test list to complete before writing or publishing a Windows `.exe`.

## Total Work Remaining Before `#0.1 .exe`

This checklist is now gated by the broader sprint ladder. The `.exe` should not be treated as ready until the following work is either implemented or explicitly deferred as out of scope for `#0.1`.

### Phase 0. Checkpoint Current Branch State

- Decide whether the local Mature Data Proliferation UI slice belongs in the next push.
- Decide whether the governance docs and `docs/schemas/vaa1_mature_data_proliferation_governance_v1.draft.json` belong in the next push.
- Keep unconfirmed schema artifacts, including the Bojean schema JSON, separate until explicitly accepted.
- Confirm `git status -sb` shows only intentional source/docs/test changes before every push.

### Phase 1. Master Schema-Governed Proliferation Spine

- Add contract tests for the Mature Data Proliferation Bus.
- Add `src/backend/analysis/mature_data_proliferation_bus.py`.
- Add `src/backend/analysis/master_schema_governance_matrix.py`.
- Add `src/backend/analysis/master_schema_quality_agent.py` in audit-only mode.
- Ensure manual corrections, governed metadata, triangulated Narrative Agent evidence, sample-cloud matches, scene-card evidence, SFL/dependency findings, and second-order labels enter Master Schema before active projection.
- Ensure unknown/raw labels cannot override known mature labels.

### Phase 2. Governance Matrix And Projection UI

- Add the Master Schema Data Governance Matrix beside the POS/Quant matrix style.
- Include object id, family, mature label, authority, maturity, source anchors, traceback, used panels, propagation status, conflicts, last analyst action, and review need.
- Add a Quality Agent review tray for audit findings and suggested patches.
- Keep the UI linear, sortable, inspectable, correctable, and traceback-linked.

### Phase 3. Panel Projection Migration

- Migrate manual corrections everywhere first.
- Migrate Narrative Agent labels to video, BBox/ROI, transcript, diarization, audio, scene, mise-en-scene, report writer, search, and export surfaces.
- Migrate audio/visual sample-cloud matches through Master Schema projections.
- Migrate scene, situation, role, SFL, dependency, and dramatic-genre evidence through the same bus.
- Require traceback for every visible mature claim.

### Phase 4. Actionable Evidence Families

- Make audio sample clouds navigable, editable, droppable, replaceable, mergeable, splittable, assignable, unassignable, referenceable, and false-match aware.
- Make visual pattern evidence follow the same source-linked maturity flow.
- Preserve dropped, rejected, replaced, and false-match evidence as inactive traceback history.
- Block orphan semantic candidates or mark them explicitly unattached with a reason.

### Phase 5. CVAT And Annotation Round Trip

- Finish one-click VAA1 handoff to CVAT.
- Reuse stored `cvatID` and prevent duplicate tasks.
- Ingest CVAT outputs into governed Master Schema objects.
- Show import validation, linkage state, and correction history.

### Phase 6. Traceback, Forensics, Reports, And Exports

- Confirm forensic render jobs carry traceback records and tree payloads.
- Confirm report claims carry source anchors, authority, maturity, and traceback.
- Confirm exports preserve corrected data, mature projections, raw substrate, and governance artifacts.
- Confirm raw artifacts remain available even when mature data supersedes them in panels.

### Phase 7. User Agreement, Consent, And Data-Location Governance

- Add a first-run user agreement / operating consent layer.
- Distinguish local processing from external/API/remote/paid processing.
- Require per-feature consent for any feature that sends data outside the local environment.
- Store agreement state locally and make it inspectable.
- Include data-retention, source-media handling, generated derivative artifact, and export/report disclosure language.
- Confirm VAA1 does not silently use external services, upload source media, or run paid/remote analysis without a user-visible agreement path.

### Phase 8. Licensed Add-Ons, Optional APIs, And Runtime Configuration

- Audit licensed add-ons and optional dependencies before packaging.
- Prefer MIT, Apache-2.0, BSD, and CC0 components in core.
- Isolate or avoid GPL, AGPL, MPL, premium, remote, or otherwise restricted components unless the user explicitly chooses a separate service/add-on boundary.
- Add configuration UI or documented settings for YOLO/model choice, FFmpeg path, detector/runtime alternatives, API keys, LLM model choices, and optional browser automation.
- Keep the core VAA1 pipeline usable without LLM/API keys, premium add-ons, or external services.
- Record model/runtime choice, version, path, parameters, API/provider boundary, and fallback reason in traceback where relevant.
- Ensure a failed optional runtime/add-on reports an actionable error or falls back cleanly without corrupting the analysis ledger.

### Phase 9. Calibration, Transcript Integrity, And Runtime Hardening

- Finish detector calibration for motion, scene, person, object, genre-sensitive sampling, and dense/adaptive sampling.
- Verify full-duration transcript coverage and degraded-audio fallback.
- Separate real backend test failures from environment/runtime failures.
- Confirm startup, restart, saved-state recovery, and packaging write locations.

### Phase 10. Optional Diagnostics After Governance

- Add SOM/open-topology only after nodes can reference Master Schema object ids, source anchors, maturity scores, and traceback refs.
- Use SOM for evidence ecology diagnostics: clusters, duplicates, fragmentation, outliers, and weak propagation zones.
- Do not let SOM decide mature truth.

### Phase 11. Release Freeze For `#0.1 .exe`

- Run the full manual checklist below.
- Run frontend tests and typecheck.
- Run backend contract tests relevant to Master Schema, traceback, source metadata, forensic render, CVAT boundary, audio scaffolding, and mature proliferation.
- Run Playwright UI checks for dashboard load, project reopen, video rendering, overlay rendering, Master Schema governance surfaces, Traceback navigation, and GoldenLayout reload stability.
- Run at least one representative full analysis smoke test.
- Verify package startup, restart, source-media reopen, export, rollback/restore behavior, consent display, licensed add-on configuration, optional API-key handling, and data-location disclosure.
- Only then build and label the first `#0.1 .exe`.

## Startup And Packaging Readiness

- Start backend from a clean shell and confirm `/api/health` responds.
- Start frontend and confirm Dashboard loads without a blank panel.
- Start Electron wrapper and confirm the same project state is visible.
- Restart backend and frontend after one completed analysis and confirm saved work still opens.
- Confirm no required runtime writes target user-protected folders without fallback.
- Confirm first-run user agreement / operating consent appears before release-use analysis.
- Confirm agreement state is stored locally, inspectable, and resettable for support/testing.
- Confirm local-vs-external processing is visible before any feature can send source media, metadata, prompts, screenshots, or derived artifacts outside the local environment.
- Confirm licensed add-ons, optional APIs, model/runtime paths, FFmpeg path, and premium/remote features have explicit configuration states.
- Confirm the packaged app can run the core local pipeline with optional APIs/add-ons disabled.

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
- Run Playwright UI checks in `src/frontend` for:
  - dashboard load
  - upload/project reopen path
  - video media rendering
  - overlay rendering
  - Master Schema governance/maturity surfaces
  - Traceback drawer opening from visible evidence
  - GoldenLayout reload without blank panels
- Run `conda run -n vaa1_core python -m unittest tests.test_source_media_metadata_contract`.
- Re-run one previously completed analysis and compare key panel counts against the saved state.
