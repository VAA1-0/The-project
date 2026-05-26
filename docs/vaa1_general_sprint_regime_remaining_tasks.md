# VAA1 General Sprint Regime: Remaining Tasks

Date: 2026-05-25

This is the consolidated remaining sprint map. It keeps the interpretive features, maturity regime, governance, packaging, and release-readiness work in one place so no major track quietly falls off the board.

## 1. Data maturity proliferation regime

- Implement the Master Schema-first mature-data proliferation spine.
- Surface near matches in BBox/ROI and relevant panels as `to_be_confirmed_or_canceled` candidates.
- Keep probability thresholds openly weighted and configurable.
- Allow proliferation only from manual confirmation/correction or very high probability with source anchors and traceback.
- Add situational mirror candidates for similar situations, but keep them review-only until confirmed.
- Prevent raw or unknown detections from overriding mature Narrative Agent, object, scene, or report claims.
- Add governance objects with source anchors, evidence refs, maturity state, authority level, projection targets, and audit status.

## 2. Narrative Agent and character-path operationalization

- Keep Character Paths primarily in the Narrative Agent surface.
- Make scene presence, character-by-scene, dramatic archetype, participant ranking, and Narrative Agent path views navigable.
- Ensure every character-path claim points to source evidence, scene anchors, and maturity state.
- Propagate analyst renames, confirmations, merges, splits, rejections, and drops across video, audio, transcript, scene cards, reports, search, and evidence graph.

## 3. Meaning / Plot and interpretive lenses

- Keep Meaning / Plot as the cross-agent plot map.
- Treat Aristotelian, Freytagian, Campbellian, Fryean, Bookerian, Burkean, and related readings as interpretive lenses, not hard labels.
- Require maturity gates before prose is surfaced.
- Connect interpretive lens prose to scene cards, SFL/dependency evidence, transcript anchors, visual/audio evidence, and traceback.

## 4. Meaning network

- Implement the Datascene Meaning Network as governed graph data.
- Add nodes, edges, confirmations, continuity anchors, taxonomy backbone, traceback index, and proliferation rules.
- Make selections cross-highlight transcript, POS/SFL, scene, BBox/ROI, Narrative Agent, timeline, report, and traceback surfaces.
- Ensure meaning-network objects remain projections from governed evidence, not independent semantic truth.
- Continue from the operating-principles note: `docs/vaa1_operating_principles_constellational_meaning_network_2026-05-26.md`.
- Treat Narrative Agent presence handles as one feature inside the larger Meaning Network Graph regime.
- Harden graph layout, source navigation, edge management, expandable/dedicated panel behavior, timeline cursor sync, draggable presence handles, custom lanes, and whole/scene/character timeline views.
- Add constellational triangulation for mature graph nodes and handles across visual, transcript, diarization, prosody, scene, object, relation, off-camera, music, location, and manual-confirmation evidence.

## 5. Bojean antenarrative 5B layer

- Integrate the 5B schema as a maturity-aware interpretive evidence layer.
- Surface 5B candidates in POS/SFL, Quant matrix, scene cards, Narrative Agent, Meaning / Plot, and report writer where supported.
- Link every 5B claim to transcript tokens, scene intervals, Narrative Agents, visual/audio evidence, and traceback.
- Keep visual 5B evidence gradual: manual first, then source-linked support, then analyst-confirmed maturity.

## 6. SFL and dependency parsing integration

- Use SFL/dependency outputs as linguistic evidence for Narrative Agent paths, scene cards, 5B, meaning network, and interpretive lenses.
- Mark SFL/dependency outputs stale when transcript text, speaker-agent links, or source intervals are corrected.
- Generate analyst-facing prose only when source evidence, maturity state, and traceback are present.

## 7. Actionable evidence families

- Make audio samples and visual patterns navigable, editable, droppable, replaceable, mergeable, splittable, assignable, unassignable, referenceable, and false-match aware.
- Preserve dropped, rejected, replaced, and false-match evidence as inactive traceback history.
- Block orphan semantic candidates or mark them explicitly unattached with a reason.

## 8. Governance matrix, traceback, and quality agent

- Add or harden the Master Schema Governance Matrix.
- Add a Quality Agent review tray in audit-only mode.
- Add traceback drawer coverage for visible claims.
- Create review tickets for missing source anchors, stale projections, panel divergence, conflicting labels, and orphan evidence.

## 9. User agreement and data-location governance

- Add first-run user agreement / operating consent.
- Distinguish local processing from remote/API/paid processing.
- Require user-visible consent before source media, metadata, prompts, screenshots, or derived artifacts leave the local environment.
- Store agreement state locally and make it inspectable/resettable.
- Disclose data retention, generated derivative artifacts, exports, reports, and optional services.

## 10. Optional APIs, model governance, and runtime configuration

- Add or document settings for YOLO/model choice, FFmpeg path, detector/runtime alternatives, API keys, LLM providers/models, and optional browser automation.
- Keep core VAA1 usable without LLM/API keys, premium add-ons, or external services.
- Record runtime/model choice, version, path, parameters, provider boundary, and fallback reason in traceback.

## 11. CVAT and annotation round trip

- Finish one-click handoff to CVAT.
- Reuse stored CVAT task ids and prevent duplicate tasks.
- Ingest CVAT outputs into governed Master Schema objects.
- Show import validation, linkage state, and correction history.

## 12. Playwright / DOM testing

- Add Playwright checks for dashboard load, project reopen, video rendering, overlay rendering, Master Schema governance surfaces, traceback navigation, GoldenLayout reload, and source-jump navigation.
- Add focused BBox/ROI DOM fixtures proving candidate surfacing, confirm/cancel controls, mature-label priority, and traceback visibility.
- Keep manual tests until the full app shell is stable enough for reliable automation.

## 13. Packaging and `.exe` readiness

- Complete pre-`.exe` manual test checklist.
- Verify startup, restart, saved-state recovery, source-media reopen, export, rollback/restore, consent display, optional API-key handling, and data-location disclosure.
- Run backend contracts, frontend tests, typecheck, Playwright checks, and at least one representative full-analysis smoke test.
- Build the first `#0.1 .exe` only after core governance and release-readiness gates pass or are explicitly deferred.
