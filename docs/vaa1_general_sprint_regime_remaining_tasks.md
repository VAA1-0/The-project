# VAA1 General Sprint Regime: Remaining Tasks

Date: 2026-05-25

This is the consolidated remaining sprint map. It keeps the interpretive features, maturity regime, governance, packaging, and release-readiness work in one place so no major track quietly falls off the board.

## Non-Droppable Release Tracks

Four tracks must remain visible in every sprint review and release-readiness discussion:

1. **Mature Data Proliferation Regime.** Confirmed analyst work may proliferate as mature data only through governed source anchors, authority state, maturity state, projection targets, traceback, and canonical saved decisions. Candidates, near matches, raw detections, model suggestions, and inferred graph matches must remain reviewable until confirmed.
2. **Licensed software optionality and user activation.** FFmpeg, YOLOv8/Ultralytics, licensed scripts, optional APIs, remote providers, premium tools, and external services must be detected, explained, activated by explicit user choice, and recorded in traceback. Release must include alternatives, disabled-state workflows, or explicit deferrals for license-sensitive dependencies.
3. **Performance observability.** Uploading, quick sweeps, science scan, forensic scan, data maturation/iteration, manual program use, export, and UI rendering must write developer-facing observability records under the hood. This is not an analyst panel. It is a full internal view for developers, with later product work deciding what subset, if any, should be shared externally.
4. **Data maturation economics.** Datascene must understand the cost, yield, reuse, waste, and diminishing returns of each maturation and iteration pass. Runtime success is not enough; the program must know whether a pass created mature, source-linked value worth the compute, storage, and analyst attention it consumed.

These tracks are not polish. They are release gates.

Relevant contracts:

- `docs/schemas/vaa1.performance_observability_layer.schema.json`
- `docs/schemas/vaa1.data_maturation_economics.schema.json`

## 1. Data maturity proliferation regime

- Implement the Master Schema-first mature-data proliferation spine.
- Keep the Master Schema as the canonical maturity anchor. BBox/ROI hubs, Meaning Network node/edge sheets, Narrative Agent leaves, scene cards, reports, and related panels should render synchronized projections from that anchor rather than competing local truth.
- Treat explicit user corrections as the highest authority across the loop. A user-corrected time, label, coordinate, dimension, storyline, node meaning, edge meaning, or presence interval can only be superseded by another explicit user correction.
- Every mature-data feedback event should carry source anchors, maturity state, authority level, correction provenance, affected panels, and traceback so panels can refresh coherently.
- Persist every proliferation decision in a canonical ledger before any local panel installs a projection or label override.
- Require confirmed decisions to carry source traceback refs, source anchors/evidence refs, projection targets, source panel, source verification status, and source-range provenance.
- Allow only confirmed decisions to create mature propagation targets such as `proliferates_to` or mature label correction rules.
- Ledger canceled, deferred, inspected, weak, or unresolved candidates without mature propagation targets.
- Surface near matches in BBox/ROI and relevant panels as `to_be_confirmed_or_canceled` candidates.
- Keep probability thresholds openly weighted and configurable.
- Allow proliferation only from manual confirmation/correction or very high probability with source anchors and traceback.
- Add situational mirror candidates for similar situations, but keep them review-only until confirmed.
- Prevent raw or unknown detections from overriding mature Narrative Agent, object, scene, or report claims.
- Add governance objects with source anchors, evidence refs, maturity state, authority level, projection targets, and audit status.
- Add regression coverage proving confirmation-only propagation, source-linked traceback, projection targets, and canonical-save persistence.

Acceptance:

- Corrected data appears corrected everywhere except traceback.
- Candidates remain candidates until confirmed.
- Raw substrate remains inspectable but cannot become active semantic truth.
- Every mature claim can explain source, time, maturity, authority, projection target, and traceback.
- The UI does not install local mature projections until the backend has returned a saved proliferation decision.

## 2. Narrative Agent and character-path operationalization

- Keep Character Paths primarily in the Narrative Agent surface.
- Make scene presence, character-by-scene, dramatic archetype, participant ranking, and Narrative Agent path views navigable.
- Ensure every character-path claim points to source evidence, scene anchors, and maturity state.
- Surface recognized character paths as their own Narrative Agent leaves with timelines, summaries, source anchors, maturity state, and traceback.
- Feed Character/Path Meaning schemas from proliferated mature data, including analyst-confirmed BBox/ROI, Meaning Network presence intervals, transcript/speaker links, scene anchors, object relations, prosody, and manual annotations.
- Treat the Narrative Agent panel as the home for character/path meaning once narrative-structure support is working, not merely as a list of recognized names.
- Open specific Narrative Agent storylines as focused panels or leaves from node/edge sheets; do not use double-click on a graph node/edge to send the analyst to the general Narrative Agent(s) overview.
- Propagate analyst renames, confirmations, merges, splits, rejections, and drops across video, audio, transcript, scene cards, reports, search, and evidence graph.

## 3. Meaning / Plot and interpretive lenses

- Keep Meaning / Plot as the cross-agent plot map.
- Treat Aristotelian, Freytagian, Campbellian, Fryean, Bookerian, Burkean, and related readings as interpretive lenses, not hard labels.
- Deliver interpretive lenses as actual Datascene readings of narrative structure, not cosmetic buttons. Each lens reading should surface projected scene roles, node roles, edge meanings, evidence anchors, maturity state, compare/delta affordances, and analyst accept/edit/reject actions.
- Prioritize narrative structure support first; surface character meaning dimensions after the narrative-structure readings are functioning and source-linked.
- Require maturity gates before prose is surfaced.
- Connect interpretive lens prose to scene cards, SFL/dependency evidence, transcript anchors, visual/audio evidence, and traceback.

## 4. Meaning network

- Implement the Datascene Meaning Network as governed graph data.
- Add nodes, edges, confirmations, continuity anchors, taxonomy backbone, traceback index, and proliferation rules.
- Make selections cross-highlight transcript, POS/SFL, scene, BBox/ROI, Narrative Agent, timeline, report, and traceback surfaces.
- Ensure meaning-network objects remain projections from governed evidence, not independent semantic truth.
- Continue from the operating-principles note: `docs/vaa1_operating_principles_constellational_meaning_network_2026-05-26.md`.
- Treat Narrative Agent presence handles as one feature inside the larger Meaning Network Graph regime.
- Keep BBox/ROI evidence hubs and Meaning Network node/edge sheets behaviorally aligned: source verification first, double-click for the detailed sheet/hub, right-click for traceback/render/confirm/drop actions, and explicit analyst confirmation before mature proliferation.
- Make node/edge sheet navigation specific: graph double-click opens the selected node/edge sheet, while any Narrative Agent action inside that sheet opens the relevant storyline leaf.
- Harden graph layout, source navigation, edge management, expandable/dedicated panel behavior, timeline cursor sync, draggable presence handles, custom lanes, and whole/scene/character timeline views.
- Add constellational triangulation for mature graph nodes and handles across visual, transcript, diarization, prosody, scene, object, relation, off-camera, music, location, and manual-confirmation evidence.
- Deliver forensic render as a real graph action. Start with source-linked BBox/ROI crop or zoom renders and node/edge evidence plates, then expand to montages, before/after comparisons, traceback renders, and report assets.
- Require forensic render outputs or render requests to preserve source media id, time range, coordinate basis, selected graph/BBox ids, maturity state, analyst authority, output type, persistence state, and traceback link.

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
- Deliver the source layers required for StatsKit, SignificanceKit, and RelevanceRadar to become actual analytical tooling rather than missing-data placeholders:
  - true shot-boundary intervals, not only scene segments or shot-size samples;
  - audio event intervals for speech, silence, noise, and music;
  - music and sound classifier output over time;
  - color, brightness, and contrast extraction from sampled frames or frame windows;
  - speaker-linked diarization turns so speaker dominance can be computed beyond transcript speaker labels.
- Persist each of these layers through the Master Schema / governed evidence path with source time, method, runtime/tool provenance, confidence or maturity state, and traceback.
- Make StatsKit consume these layers through Master Schema or governed analysis projections, not panel-local guesses.

Acceptance:

- StatsKit can compute shot duration distributions, speech/silence/music/noise ratios, music/sound timelines, color/brightness/contrast statistics, and speaker-dominance statistics from persisted source-linked records.
- Missing-data diagnostics can name the exact absent layer and route the analyst to the relevant extraction or review action.
- SignificanceKit and RelevanceRadar claims that depend on these measurements remain candidate until linked evidence and method provenance are present.

## 8. Governance matrix, traceback, and quality agent

- Add or harden the Master Schema Governance Matrix.
- Add a Quality Agent review tray in audit-only mode.
- Add traceback drawer coverage for visible claims.
- Create review tickets for missing source anchors, stale projections, panel divergence, conflicting labels, and orphan evidence.

## 8A. Performance observability and maturation economics

- Deliver the complete performance observability layer as a program-level developer substrate, not as a normal analysis panel.
- Capture upload, video probe, frame extraction, audio extraction, quick sweep, science scan, forensic scan, speech-to-text, speaker diarization, object detection, face detection, OCR, feature extraction, embedding generation, similarity search, scene segmentation, scene card generation, knowledge graph build, provenance linking, BBox tracking, manual annotation sync, data maturation, iteration, proliferation matching, export, UI render, and manual program use.
- Persist observability artifacts under the active analysis or run output, with session id, analysis id, runtime environment, source target, stage observations, resource observations, bottleneck findings, provenance integrity, benchmark result, and operational verdict.
- Keep the developer view full-fidelity: timings, resource peaks, stage-level input/output volumes, cache behavior, database behavior, UI responsiveness, errors, bottlenecks, and recommended engineering actions should be visible internally.
- Do not expose this as a distracting analyst panel. The first UI surface should be an under-the-hood developer/diagnostic view. Later product decisions may choose a smaller user-facing subset for trust, export, or enterprise governance.
- Pair performance observability with data maturation economics for each relevant pass.
- Track compute seconds, GPU seconds, storage written/retained, database writes, cache misses, remote/API cost estimates, analyst minutes, review actions, correction actions, and blocked minutes.
- Track candidate yield, reviewed yield, confirmed yield, mature yield, rejected/deferred/orphan counts, false positives, false negatives discovered, maturation rate, noise ratio, analyst cost per mature item, and compute cost per mature item.
- Track iteration economics: new mature items, new source links, projection targets updated, ambiguities reduced, regressions introduced, manual corrections reused, marginal mature-item change, marginal cost change, diminishing-return flag, and iteration ROI.
- Track reuse value across Master Schema, BBox/ROI, transcript, audio, objects, scene cards, Meaning Network, Narrative Agent, Search, StatsKit, SignificanceKit, RelevanceKit, Traceback, and report/export.

Acceptance:

- Developers can answer "what broke, where, and why?" across every major Datascene program path.
- Developers can answer "was this maturation or iteration pass worth it?" using cost, yield, noise, reuse, and diminishing-return evidence.
- Observability and economics records remain under the hood by default and do not become a metadata parade in analyst-facing workbenches.
- Operational verdicts can distinguish laptop readiness, feature-length readiness, multi-film readiness, HPC/cloud readiness, commercial cost readiness, and maturation economic soundness.

## 9. User agreement and data-location governance

- Add first-run user agreement / operating consent.
- Distinguish local processing from remote/API/paid processing.
- Require user-visible consent before source media, metadata, prompts, screenshots, or derived artifacts leave the local environment.
- Store agreement state locally and make it inspectable/resettable.
- Disclose data retention, generated derivative artifacts, exports, reports, and optional services.

## 10. Licensed software optionality, model governance, and runtime configuration

- Add or document settings for YOLO/model choice, FFmpeg path, detector/runtime alternatives, API keys, LLM providers/models, and optional browser automation.
- Keep core VAA1 usable without LLM/API keys, premium add-ons, or external services.
- Record runtime/model choice, version, path, parameters, provider boundary, and fallback reason in traceback.
- Isolate licensed scripts, paid tools, remote services, GPL/AGPL components, premium tools, and otherwise restricted capabilities behind explicit user choice.
- Add user-activation controls for optional or license-sensitive capabilities. The user should be able to see what is disabled, what is available locally, what requires external installation, and what requires a license or API/provider boundary.
- Add FFmpeg workarounds and alternatives before release. VAA1 should detect installed FFmpeg/ffprobe path, version, and license boundary; allow the user to choose or replace the binary; explain unavailable codec/workflow consequences; and provide a local/basic fallback or disabled-state workflow where feasible.
- Add YOLOv8/Ultralytics workarounds and alternatives before release. VAA1 should detect whether Ultralytics/YOLOv8 is available; expose user choice of detector/runtime; support a basic local detector fallback or disabled-state workflow; and prevent release-critical analysis from silently depending on YOLOv8 if the user has not activated it.
- Record every FFmpeg, YOLOv8, Ultralytics, detector, transcription, LLM, remote API, licensed script, or optional-provider use in traceback with provider/tool name, version, executable or model path, license/activation state, parameters, fallback decision, and produced evidence ids.
- Label report/export evidence that depends on optional licensed, paid, or remote features.

Acceptance:

- Optional capabilities are user-requested and traceable, not hidden defaults.
- FFmpeg and YOLOv8 alternatives, fallback paths, or disabled-state workflows are in place before release.
- VAA1 can explain and survive missing, unactivated, incompatible, or license-restricted FFmpeg/YOLOv8 components without corrupting the analysis ledger.
- FFmpeg, YOLOv8/Ultralytics, model paths, API providers, and licensed scripts flow through one runtime/activation registry rather than scattered checks.

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
- Verify startup, restart, saved-state recovery, source-media reopen, export, rollback/restore, consent display, optional API-key handling, licensed add-on configuration, and data-location disclosure.
- Verify licensed-script workarounds and user activation by choice, including FFmpeg binary/path selection and YOLOv8/Ultralytics detector alternatives or disabled-state fallback.
- Confirm the packaged app can run the core local pipeline with optional APIs disabled.
- Confirm the packaged app does not silently require FFmpeg or YOLOv8 in a license-sensitive way without user-visible activation, configuration, fallback, or explicit release deferral.
- Confirm Mature Data Proliferation remains governed in the package: saved proliferation decisions, candidate-only states, mature label projection, traceback, and rollback/reopen behavior must survive packaged runtime tests.
- Run backend contracts, frontend tests, typecheck, Playwright checks, and at least one representative full-analysis smoke test.
- Build the first `#0.1 .exe` only after core governance and release-readiness gates pass or are explicitly deferred.

Release gate:

- Do not package by assuming mature proliferation and licensed optionality are "later" tasks. If either is incomplete, the deferral must be explicit, visible, and risk-labeled.
