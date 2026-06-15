# VAA1 Remaining Sprint Program - Stepwise

Date: 2026-06-03

Purpose: consolidate the remaining VAA1 sprint into an ordered development program. This document combines the general sprint regime, pre-EXE checklist, delivery audit, BBox/ROI handoffs, Meaning Network handoffs, and current governance priorities into one stepwise path.

## Governing Rule

Manual analyst correction stands.

Every active visible claim in VAA1 should ultimately be governed by source anchors, time, coordinate basis where relevant, maturity state, authority level, propagation state, and traceback. Raw detections, inferred candidates, model outputs, graph suggestions, and near matches may support the analyst. They must not silently replace confirmed analyst work.

## Current Development Status

VAA1 is already an operational local multimodal video-analysis workstation.

Operational or first-working areas include:

- upload and analysis,
- video playback and cue navigation,
- object detection,
- OCR,
- transcript,
- audio/prosody,
- expressions,
- source media metadata,
- native manual annotation,
- Master Schema baseline,
- BBox/ROI correction baseline,
- Time Bank,
- SFL/dependency Stage 1 artifacts,
- multimodal meaning Stage 1 artifacts,
- second-order label proliferation artifacts,
- Meaning / Plot first UI,
- forensic render foundation,
- traceback backend support,
- POS/Quant analysis,
- shared taxonomy,
- downloads and bundles,
- optional CVAT bridge.

The program is not yet release-hardened. The main remaining work is governance, projection consistency, rendered validation, data-location consent, runtime configuration, and package-readiness.

## DRY Sprint Operating Pattern

Use the same implementation loop for every step:

```text
map current data flow
-> identify duplicate authority paths
-> consolidate into one shared contract/helper/service
-> migrate the smallest useful consumer set
-> add regression proof
-> self-review against the shared gates
-> document residual risk
```

The DRY principle applies to authority, not only code shape. VAA1 should avoid duplicate sources of truth for labels, times, coordinates, maturity state, runtime choices, consent state, and traceback. If two panels or services need the same decision, they should consume the same resolver, schema, bus, or persisted governance record.

Shared self-review gates for every step:

- Authority: does manual analyst correction remain highest authority inside its declared scope?
- Single source: did this step remove or clearly isolate duplicate sources of truth?
- Persistence: does the canonical saved record survive refresh, reopen, export, and relevant panel navigation?
- Projection: do panels render from governed state rather than local semantic assumptions?
- Traceback: can the analyst inspect the source chain, old states, and correction history?
- Candidate safety: are weak, inferred, or near-match outputs shown as candidates until confirmed?
- Runtime safety: are optional, licensed, remote, or unavailable tools handled by explicit user choice and fallback?
- Validation: is there a source-level, contract-level, rendered, or manual smoke test appropriate to the risk?
- Residual risk: what still has to be watched before the next step proceeds?

## Step 0. Checkpoint And Worktree Hygiene

Goal: start each sprint slice from a known state.

Tasks:

- Review `git status -sb` before new implementation.
- Separate intentional sprint files from unconfirmed docs or schema drafts.
- Keep Bojean/5B and other experimental schema artifacts separate until accepted.
- Avoid committing unrelated local handoff files unless they belong to the current sprint.
- Record which checks passed before each push.

Acceptance:

- The branch contains only intentional changes for the current slice.
- The next developer can tell what changed, why, and what was verified.

Self-review focus:

- Are untracked files, generated files, handoffs, schema drafts, and implementation changes intentionally separated?

## Step 1. Master Schema Mature-Data Spine

Goal: make the Master Schema the canonical maturity anchor.

Tasks:

- Implement or harden the mature-data proliferation bus.
- Ensure every mature event carries source anchors, maturity state, authority level, correction provenance, affected panels, and traceback.
- Add governance objects for source anchors, evidence refs, maturity, authority, projection targets, conflicts, and audit state.
- Prevent raw or unknown detections from overriding mature Narrative Agent, object, scene, or report claims.
- Surface near matches as `to_be_confirmed_or_canceled` candidates.
- Keep probability thresholds visible and configurable.
- Allow mature proliferation only from manual confirmation/correction or very high probability with source anchors and traceback.

Acceptance:

- Corrected data appears corrected everywhere except traceback.
- Raw substrate remains inspectable but cannot become active semantic truth.
- Every visible mature claim has source, time, maturity, authority, and traceback.

Self-review focus:

- Did this step reduce panel-local maturity logic, or did it add another competing maturity path?

## Step 2. Governance Matrix And Quality Agent

Goal: make maturity and propagation inspectable.

Tasks:

- Add or harden the Master Schema Governance Matrix.
- Include object id, family, mature label, authority, maturity, source anchors, traceback, used panels, propagation status, conflicts, last analyst action, and review need.
- Add a Quality Agent review tray in audit-only mode.
- Create review tickets for missing anchors, stale projections, conflicting labels, panel divergence, and orphan evidence.

Acceptance:

- The analyst can inspect why a claim exists and whether it is safe to use.
- The Quality Agent can warn and suggest, but cannot silently overwrite mature data.

Self-review focus:

- Can the matrix explain the same claim across panels without each panel inventing its own audit language?

## Step 3. BBox/ROI Coordinate Authority

Goal: make saved analyst geometry authoritative everywhere.

Design gate:

- Before another deep BBox implementation pass, run the UI/user-path sprint in `docs/vaa1_bbox_meaning_network_narrative_agent_ui_sprint_2026-06-10.md`.
- BBox/ROI must be scoped as source-local evidence capture and inspection.
- Continuity questions must move to Meaning Network and Narrative Agent review surfaces.
- Raw track ids may support traceback and candidates, but they must not act as record authority or Narrative Agent continuity authority.

Tasks:

- Enforce one geometry path:

```text
Canonical Saved Geometry Bundle
-> Authoritative BBox/ROI Resolver
-> Projection Engine
-> Visible Overlay
```

- Consolidate coordinate projection, pointer normalization, spatial matching, suppression, keyframe merging, and manual bundle construction into `bbox-authority.ts`.
- Make `VideoPanel.tsx` and `OBJDetectionPanel.tsx` consume shared authority results rather than rebuild geometry locally.
- Ensure Save and Save here install the returned canonical backend payload before rendering from local assumptions.
- Collapse dual geometry representations where possible, especially mixed normalized and pixel fallback boxes.
- Preserve raw track keyframes only as traceback/provenance unless explicitly used as candidate support.
- Add rendered DOM or Playwright tests for manual keyframes, resize, fullscreen, save/reopen, mature-label priority, and candidate-only proliferation.

Acceptance:

- A saved manual BBox/ROI correction survives playback, scrub, Save, Save here, panel navigation, resize, fullscreen, project save, project reopen, mature label refresh, raw object track refresh, Meaning Network sync, and proliferation candidate generation.
- The visible box comes from the canonical saved geometry, not stale local state, raw detector fallback, panel CSS pixels, or ungoverned interpolation.
- Sequential manual confirmations on the same raw track, such as `James Bond 43-46s` and `Nomi 47-49s`, remain separate source-local events and are reviewed as continuity/conflict questions in Meaning Network or Narrative Agent, not merged inside BBox/ROI.

Self-review focus:

- Are all BBox/ROI geometry consumers using the same normalization, resolver, projection, and saved-bundle builder?
- Has BBox/ROI avoided owning cross-scene Narrative Agent, object, role, or relation continuity?

## Step 4. Panel Projection Migration

Goal: stop panels from carrying private semantic truth.

Tasks:

- Migrate manual corrections through the mature-data spine first.
- Migrate Narrative Agent labels to video, BBox/ROI, transcript, diarization, audio, scene, report, search, and export surfaces.
- Migrate audio and visual sample-cloud matches through Master Schema projections.
- Migrate scene, situation, role, SFL, dependency, and dramatic-genre evidence through the same bus.
- Require traceback for every visible mature claim.

Acceptance:

- Panels render synchronized projections from governed evidence.
- No panel can silently reintroduce an older raw or inferred label over a mature correction.

Self-review focus:

- Did this migration remove panel-private semantic decisions rather than copying the same rule into another panel?

## Step 5. Meaning Network Workbench

Goal: make the Meaning Network a serious multimodal timeline/network workspace.

Tasks:

- Move the graph toward a dedicated or expandable GoldenLayout panel.
- Harden readable layout, lane routing, edge management, node/edge sheets, custom lanes, and timeline modes.
- Keep node/edge sheets source-linked and maturity-aware.
- Make selections cross-highlight transcript, POS/SFL, scene, BBox/ROI, Narrative Agent, Time Bank, report, and traceback surfaces.
- Improve cursor/video synchronization and draggable presence handles.
- Ensure graph objects remain projections from governed evidence, not a private truth island.
- Add forensic render actions for source-linked BBox/ROI crops, zoom renders, evidence plates, montages, and traceback renders.

Acceptance:

- The graph can act as a governed Datascene workbench.
- Every graph claim can answer where it came from and what maturity/authority it carries.

Self-review focus:

- Is the graph projecting governed evidence, or has it become a separate meaning database with its own truth?

## Step 6. Narrative Agent And Character Paths

Goal: turn Narrative Agents into mature, source-linked agents with paths, roles, relations, and evidence.

Protected milestone:

- Every Narrative Agent addition must mature a governed characteristic, not just add another profile field.
- Working contract: `docs/vaa1_narrative_agent_characteristics_schema_and_proliferation_contract_2026-06-11.md`.
- Usability contract: `docs/vaa1_narrative_agent_panel_usability_design_contract_2026-06-12.md`.

Tasks:

- Keep Character Paths primarily in Narrative Agent surfaces.
- Make the Narrative Agent panel usable through an Overview, Evidence, Semantics, Continuity, and Scenes review compass.
- Add a dropdown-led single-profile Narrative Agent view so the panel shows one canonical agent at a time.
- Combine same-character labels into one canonical profile only when profile-id, alias, or clear label-containment evidence supports it; keep source labels visible as aliases and traceback.
- Add a simple one-agent timeline handle strip with source, scene, and cue handles that jump to source-video time, commit governed `master_schema_presence_intervals`, sync with Meaning Network handles, and hand fuller continuity review to Meaning Network.
- Add scene presence, character-by-scene, participant ranking, dramatic archetype readings, and role/relation/action paths.
- Feed paths from mature BBox/ROI, Meaning Network intervals, transcript/speaker links, scene anchors, object relations, prosody, and manual annotations.
- Add agent semantic families for persona/alias, appearance, voice/speech, expression/affect, gesture/action, role/function, relation, scene trajectory, object association, linguistic register, continuity, and negative evidence.
- Add visual pattern sample status, audio pattern sample status, and simple scene-presence prose from the first Narrative Agent semantic readiness slice.
- Keep vocal-affect registries balanced across positive, negative, regulating, and ambivalent cues so audio evidence does not overproduce stress/emphasis readings.
- Require visual expression, vocal expression, transcript interpretation, and scene presence to share Master time/source-video clock anchors before they can mature or proliferate.
- Make characteristic observations produce better proliferation candidates, stricter rejection, source-sample readiness, and late-video coverage audits.
- Propagate analyst renames, confirmations, merges, splits, rejections, and drops across panels.
- Make node/edge sheet actions open the specific relevant Narrative Agent storyline, not a generic overview.

Acceptance:

- Narrative Agents are not just names. They are governed subjects with timelines, evidence, roles, relations, and traceback.
- Every mature agent characteristic can answer what source evidence supports it, what panels may project it, what it can safely proliferate to, and what it should prevent from proliferating.

Self-review focus:

- Do Narrative Agent changes flow through one governed subject/path model instead of separate rename, profile, BBox, graph, and report paths?
- Does each characteristic improve Mature Data Proliferation, or is it only descriptive UI?

## Step 7. Meaning / Plot And Interpretive Lenses

Goal: deliver evidence-bound interpretive readings.

Tasks:

- Keep Meaning / Plot as the cross-agent plot map.
- Treat Aristotelian, Freytagian, Campbellian, Fryean, Bookerian, Burkean, Bojean, and related frames as lenses, not hard labels.
- Surface lens readings with scene roles, node roles, edge meanings, evidence anchors, maturity state, compare/delta affordances, and analyst accept/edit/reject actions.
- Require maturity gates before interpretive prose appears.
- Connect prose to scene cards, SFL/dependency evidence, transcript anchors, visual/audio evidence, Narrative Agent paths, and traceback.

Acceptance:

- Interpretive prose is useful to the analyst and never detached from evidence.

Self-review focus:

- Does each lens reuse governed evidence records, or does it recalculate unsupported interpretive truth locally?

## Step 8. SFL, Dependency, Transcript, Audio, And Prosody

Goal: make linguistic and audio evidence operational across the system.

Tasks:

- Mark SFL/dependency outputs stale when transcript text, speaker-agent links, or scene intervals change.
- Link SFL/dependency evidence to Meaning Network nodes/edges, Narrative Agent paths, 5B, scene cards, and interpretive lenses.
- Verify Whisper and diarization runtime reliability.
- Support speaker-agent linking, audio sample cloud governance, prosody timeline tracks, source jumps, editable samples, and mature audio evidence propagation.
- Preserve transcript corrections as user authority.

Acceptance:

- Voice, sound, prosody, and transcript can support mature narrative and scene meaning without becoming detached text gadgets.

Self-review focus:

- Are transcript, speaker, SFL, dependency, and audio corrections invalidating or refreshing shared evidence instead of leaving stale duplicate outputs?

## Step 9. Actionable Evidence Families And Near Match

Goal: make audio/visual evidence useful for scaling without pretending weak matches are truth.

Tasks:

- Make audio samples and visual patterns navigable, editable, droppable, replaceable, mergeable, splittable, assignable, unassignable, referenceable, and false-match aware.
- Preserve dropped, rejected, replaced, and false-match evidence as inactive traceback history.
- Add visual pattern candidates, object-agent relation candidates, SOM or equivalent near-match comparison, and situational option mirroring.
- Keep ordinary probability cases review-only until confirmed.
- Add configurable thresholds for mature, candidate, weak, and rejected states.

Acceptance:

- VAA1 can propose continuity and pattern families, but only confirmed or very high-confidence source-linked evidence can proliferate as mature.

Self-review focus:

- Are near-match, SOM, sample-cloud, and visual-pattern results reviewable candidates until governed confirmation?

## Step 10. Bojean 5B And Antenarrative Layer

Goal: make 5B an inspectable evidence layer rather than a theory label.

Tasks:

- Integrate 5B as maturity-aware evidence.
- Link every 5B claim to transcript tokens, scene intervals, Narrative Agents, visual/audio evidence, and traceback.
- Surface 5B candidates in POS/SFL, Quant matrix, scene cards, Narrative Agent, Meaning / Plot, Meaning Network, and report writer where supported.
- Begin manual/source-linked first, then mature confirmed support.

Acceptance:

- 5B readings are graph/lane/source aware and can be accepted, edited, rejected, or traced.

Self-review focus:

- Are 5B records complete governed readings, not scattered labels repeated across Meaning / Plot, SFL, graph, and report surfaces?

## Step 11. CVAT Round Trip

Goal: make external annotation return as governed VAA1 evidence.

Tasks:

- Finish one-click VAA1 handoff to CVAT.
- Reuse stored `cvatID` and prevent duplicate tasks.
- Ingest CVAT outputs into governed Master Schema objects.
- Show import validation, linkage state, correction history, and traceback.
- Keep CVAT as a bridge, not the source of truth.

Acceptance:

- External annotations can return as mature or reviewable Master Schema evidence without duplicating tasks or confusing ownership.

Self-review focus:

- Does CVAT remain a bridge into governed VAA1 records rather than a parallel annotation authority?

## Step 12. Traceback, Forensics, Reports, And Exports

Goal: make provenance visible and export-safe.

Tasks:

- Complete traceback drawer coverage for visible claims.
- Ensure forensic render jobs preserve source media id, time range, coordinate basis, selected graph/BBox ids, maturity state, analyst authority, output type, persistence state, and traceback link.
- Ensure report claims carry source anchors, authority, maturity, weighting, and traceback.
- Ensure exports preserve corrected data, mature projections, raw substrate, governance artifacts, and inactive traceback history.

Acceptance:

- VAA1 can show why a claim exists, what evidence supports it, and what changed along the way.

Self-review focus:

- Do reports, renders, and exports reference the same traceback/governance records that panels use?

## Step 13. User Agreement And Data-Location Governance

Goal: make data boundaries explicit before release use.

Tasks:

- Add first-run operating consent.
- Distinguish local processing from external/API/remote/paid processing.
- Require consent before source media, metadata, prompts, screenshots, or derived artifacts leave the local environment.
- Store agreement state locally and make it inspectable/resettable.
- Disclose data retention, generated artifacts, exports, reports, optional services, and paid/remote boundaries.

Acceptance:

- The user knows where data is processed, what leaves the machine, and what generated artifacts exist.

Self-review focus:

- Is consent stored and checked through one agreement state instead of scattered prompts or implicit assumptions?

## Step 14. Runtime Configuration, Licensed Scripts, And Optional Capabilities

Goal: keep the core local workflow explainable and usable without hidden dependencies.

Tasks:

- Add or document settings for YOLO/model choice, FFmpeg path, detector alternatives, API keys, LLM providers, optional browser automation, Whisper, and Ultralytics.
- Keep the core pipeline usable without LLM/API keys, premium add-ons, or external services.
- Record model/runtime choice, version, path, parameters, provider boundary, opt-in state, and fallback reason in traceback.
- Isolate licensed scripts, paid tools, remote services, GPL/AGPL, premium, or otherwise restricted capabilities behind explicit user choice.
- Add user-activation controls for optional or license-sensitive capabilities. The user should be able to see what is disabled, what is available locally, what requires external installation, and what requires a license or API/provider boundary.
- Add release-ready workarounds and alternatives for FFmpeg-dependent workflows. VAA1 should detect the installed FFmpeg path/version/license boundary, allow the user to choose or replace the binary, explain unavailable codec/workflow consequences, and provide a local/basic fallback where feasible.
- Add release-ready workarounds and alternatives for YOLOv8/Ultralytics-dependent workflows. VAA1 should detect whether Ultralytics/YOLOv8 is available, expose user choice of detector/runtime, support a basic local detector fallback or disabled-state workflow, and prevent release-critical analysis from silently depending on YOLOv8 if the user has not activated it.
- Record every FFmpeg, YOLOv8, Ultralytics, detector, transcription, LLM, or optional-provider use in traceback with provider/tool name, version, executable or model path, license/activation state, parameters, fallback decision, and produced evidence ids.
- Label report/export evidence that depends on optional licensed or remote features.

Acceptance:

- Optional capabilities are user-requested and traceable, not hidden defaults.
- FFmpeg and YOLOv8 alternatives or disabled-state workflows are in place before release.
- The packaged app can explain and survive missing, unactivated, incompatible, or license-restricted FFmpeg/YOLOv8 components without corrupting the analysis ledger.

Self-review focus:

- Do FFmpeg, YOLOv8/Ultralytics, model paths, API providers, and licensed scripts all flow through one runtime/activation registry?

## Step 15. Calibration, Transcript Integrity, And Backend Hardening

Goal: make analysis outputs reliable enough for representative release testing.

Tasks:

- Finish detector calibration for motion, scene, person, object, genre-sensitive sampling, and dense/adaptive sampling.
- Verify full-duration transcript coverage.
- Add fallback retranscription strategy for degraded audio.
- Separate real backend test failures from environment/runtime failures.
- Confirm startup, restart, saved-state recovery, and packaging write locations.

Acceptance:

- Representative media runs produce complete, inspectable outputs or clear fallback/error states.

Self-review focus:

- Are calibration and fallback decisions recorded once in analysis/runtime metadata instead of hidden in module-specific behavior?

## Step 16. Playwright, DOM, And Release Testing

Goal: prove rendered behavior, not only source contracts.

Tasks:

- Add Playwright checks for dashboard load, project reopen, video rendering, overlay rendering, Master Schema governance surfaces, traceback navigation, GoldenLayout reload, and source jumps.
- Add focused BBox/ROI rendered fixtures for mature-label priority, manual keyframes, candidate surfacing, confirm/cancel controls, resize/fullscreen alignment, and save/reopen authority.
- Add Meaning Network rendered fixtures for graph rendering, node/edge source navigation, cursor/video sync, and presence handles.
- Run frontend tests, typecheck, backend contract tests, representative full-analysis smoke tests, and package startup checks.

Acceptance:

- Presentation and release readiness no longer depend only on manual observation.

Self-review focus:

- Do rendered tests assert user-visible authority behavior rather than only checking that components mount?

## Step 17. Packaging And `#0.1 .exe`

Goal: package only after governance and release gates are satisfied or explicitly deferred.

Tasks:

- Complete the pre-EXE manual checklist.
- Verify startup, restart, source-media reopen, saved-state recovery, export, rollback/restore, consent display, optional API handling, licensed add-on configuration, and data-location disclosure.
- Verify licensed-script workarounds and user activation by choice, including FFmpeg binary/path selection and YOLOv8/Ultralytics detector alternatives or disabled-state fallback.
- Confirm the packaged app can run the core local pipeline with optional APIs disabled.
- Confirm the packaged app does not silently require FFmpeg or YOLOv8 in a license-sensitive way without user-visible activation, configuration, fallback, or explicit release deferral.
- Build and label `#0.1 .exe` only after the release freeze checks pass.

Acceptance:

- The packaged app demonstrates VAA1's actual governed workflow rather than packaging current instability.

Self-review focus:

- Are any release gates being bypassed by packaging assumptions, bundled binaries, hidden dependencies, or untested saved-state paths?

## Recommended Immediate Order

The next implementation sequence should be:

1. BBox/ROI coordinate-authority pass, because it currently threatens mature proliferation trust.
2. Rendered BBox/ROI fixture for the Bond/Felix and police-car style failures.
3. Master Schema mature-data spine and governance matrix.
4. Panel projection migration for manual corrections and Narrative Agent labels.
5. Meaning Network dedicated workbench and source navigation hardening.
6. Narrative Agent/Character Path operationalization.
7. Playwright release-readiness coverage.

## Current Checkpoint

Status as of this document pass:

- Branch: `petteri`.
- Known untracked file: `docs/working_handover_handout_2026-06-03_Z_meaning_network_sfl_thread.md`.
- Current intentional sprint-program edit: `docs/vaa1_remaining_sprint_program_stepwise_2026-06-03.md`.
- Step 0 is partially satisfied for this pass: worktree state was checked, and unrelated untracked handoff material was left untouched.
- Next concrete implementation slice should begin at Step 3, BBox/ROI Coordinate Authority, after a fresh `git status -sb` and source read of `bbox-authority.ts`, `VideoPanel.tsx`, `OBJDetectionPanel.tsx`, `api-service.ts`, and `manual-annotation-governance.test.mjs`.

Step 3 first implementation slice:

- `VideoPanel.tsx` BBox/ROI indication saves now delegate manual correction bundle construction to `buildManualBBoxRoiAnnotation`.
- `VideoPanel.tsx` restore-to-analysis saves now also delegate manual correction bundle construction to `buildManualBBoxRoiAnnotation`, while preserving restore provenance through `authorityState: "manual_restored"`, `source_range_source: "restore_to_analysis"`, and `provenance_restore` confirmation metadata.
- `VideoPanel.tsx` native BBox/ROI annotation saves now also delegate manual correction bundle construction to `buildManualBBoxRoiAnnotation`, using `targetType: "native_annotation"` and `source_range_source: "native_video_annotation"` instead of saving null governance metadata.
- `bbox-authority.ts` now allows the shared builder to carry an explicit `authorityState`, so restore paths do not need a private metadata schema fork.
- The shared builder now remains the protected owner of manual keyframes, governed coordinates, apply scope, confirmation metadata, interpolation policy, traceback-retained source track keyframes, and quick annotations for Video Panel indication saves, Video Panel restore saves, native Video Panel BBox saves, and Objects Panel saves.
- `manual-annotation-governance.test.mjs` now reviews the shared-builder boundary rather than expecting Video Panel to rebuild the schema locally.
- Verified: `node --test src/frontend/tests/manual-annotation-governance.test.mjs`, `cd src/frontend && npx tsc --noEmit`, `cd src/frontend && npm test`, and `git diff --check`.
- Residual Step 3 risk: overlay authority selection and the mixed `OverlayBox.normalizedBox` plus pixel `x/y/w/h` representation still need consolidation before the BBox/ROI coordinate regime can be called complete.

Step 2 protected milestone: Data Maturation governance matrix and audit-only Quality Agent tray.

- `DataMaturationPanel.tsx` now exposes a read-only governance matrix derived from manual visual annotations, durable proliferation decisions, mature resolved evidence records, and matcher candidates.
- Matrix rows show claim label, authority, maturity, source, propagation state, review need, and an inspect action routed to the relevant governed panel.
- The panel now includes an audit-only Quality Agent tray for candidate-rich/mature-write-light state, manual anchors without mature surface proof, candidate ledger gaps, and missing audiovisual source sampling substrate.
- The tray explicitly warns and routes review; it does not overwrite mature data or create a new authority path.
- Regression guards in `manual-annotation-governance.test.mjs` protect the matrix, durable-decision source set, audit-only language, candidate ledger warning, and source-sampling warning.
- Verified after this Step 2 slice: `cd src/frontend && npm test -- --runTestsByPath tests/manual-annotation-governance.test.mjs`, `cd src/frontend && npx tsc --noEmit`, and `git diff --check`.

Step 5 protected milestone: Meaning Network continuity review skeleton and Narrative Agent appearance table.

- `MeaningPlotPanel.tsx` now exposes a Meaning Network continuity lane for candidate, confirmed, rejected, and conflict edges.
- Continuity rows are derived from graph edges and remain review objects, not BBox relabel authority.
- The workbench now exposes a Narrative Agent appearance table with confirmed, candidate, and conflict appearance rows sourced from existing Meaning Network agent nodes.
- Appearance rows jump to source evidence and route users to the Narrative Agent / Character Paths home rather than asking BBox to solve continuity.
- `DataMaturationPanel.tsx` now audits temporal evidence coverage across manual annotations, raw/detected objects, transcript, OCR, expressions, audio prosody, and source samples.
- The audit-only Quality Agent now flags `late-video-evidence-dropoff` when evidence density drops dramatically in the final third of a video, so disappearing annotations/detections become a reviewable pipeline concern rather than an invisible absence.
- Regression guards in `manual-annotation-governance.test.mjs` protect the continuity lane, continuity state vocabulary, Narrative Agent appearance table, appearance state vocabulary, and late-video evidence drop-off ticket.
- Verified after this Step 5 slice: `cd src/frontend && npm test -- --runTestsByPath tests/manual-annotation-governance.test.mjs`, `cd src/frontend && npx tsc --noEmit`, and `git diff --check`.

Step 3 protected milestone: exact analyst BBox geometry now sticks and scales.

- Manual police-car BBox reframing in the Bond-trailer opening was manually retested after the keyframe-authority patch and behaved correctly without further manual correction.
- Dragging or resizing an object/manual BBox now queues an automatic save through the shared `saveSelectedIndication` path.
- The auto-save persists a small frame-window interval around the drag timestamp so scrub/playback quantization does not drop the correction immediately.
- The saved manual keyframe uses the exact normalized box produced by the analyst drag and the drag timestamp as the geometry keyframe.
- `resolveManualGeometryAtTime` now snaps to an exact nearby manual keyframe before interpolation, preventing subtle drift at corrected frames.
- Nearby corrections on the same object correction target merge into the same manual geometry keyframe sequence within `MANUAL_GEOMETRY_INTERPOLATION_MAX_GAP_SECONDS`, allowing motion/scale to come from analyst keyframes rather than raw detector geometry.
- The same-track merge is intentionally not whole-track authority: it is bounded by target id, interval proximity, and the existing interpolation gap.
- Regression guards now protect exact keyframe snapping, selected/dragged draft survival, release-triggered auto-save, bounded frame-window persistence, same-target keyframe-sequence merging, and no silent promotion to `track_family` authority.
- Verified after this milestone: `cd src/frontend && npx tsc --noEmit`, `node --test src/frontend/tests/manual-annotation-governance.test.mjs`, `cd src/frontend && npm test`, and `git diff --check`.

Protection follow-up:

- First rendered-geometry fixture added in `src/frontend/tests/bbox-roi-rendered-fixture.test.mjs`. It recreates the police-car style flow with manual keyframes, raw detector alternatives, scrub-away/back checks, between-keyframe scaling, and panel-resize pixel projection. It asserts visible geometry comes from manual keyframes rather than raw detector geometry.
- The legacy `OverlayBox.normalizedBox` plus pixel `x/y/w/h` fallback is now resolved through `overlayBoxToNormalizedBox` in `bbox-authority.ts`, so `VideoPanel.tsx` no longer owns the render-path fallback conversion from pixel overlay geometry to normalized source-video geometry.
- Regression coverage in `manual-annotation-governance.test.mjs` now guards the shared overlay normalization helper and keeps rendered overlay pixel projection routed through `projectNormalizedBoxToVideoContent`.
- Verified after this authority consolidation slice: `node --test src/frontend/tests/manual-annotation-governance.test.mjs`, `cd src/frontend && npx tsc --noEmit`, `cd src/frontend && npm test`, and `git diff --check`.
- True browser/Playwright BBox/ROI fixture added in `src/frontend/e2e/bbox-roi-rendered-authority.spec.ts`. It measures DOM overlay pixels inside letterboxed source-video content, verifies normalized analyst geometry projection, simulates live drag normalization, checks a fullscreen-style resize, and verifies resize-handle geometry updates preserve source-video origin.
- Verified after the Playwright rendered authority slice: `cd src/frontend && npx playwright test e2e/bbox-roi-rendered-authority.spec.ts`, `cd src/frontend && npx playwright test`, `cd src/frontend && npx tsc --noEmit`, `cd src/frontend && npm test`, `conda run -n vaa1_core python -m unittest tests.test_mature_data_proliferation_feedback_loop_contract`, and `git diff --check`.
- Still needed: project save/reopen BBox/ROI authority proof if a deterministic saved-analysis fixture is available, plus rendered candidate confirm/cancel controls, mature-label priority, and traceback navigation in the live dashboard.
- Add a saved-bundle inspection check that proves the persisted annotation contains the exact normalized analyst boxes as manual `geometry_keyframes`.
- Keep raw detector keyframes retained only as traceback/provenance unless explicitly surfaced as candidate support.

Mature Data Proliferation next-stage slice:

- Proliferation candidate decisions now have a canonical-save guard through `requireSavedProliferationDecision`.
- Video Panel candidate decisions now retain source traceback refs, source anchors/evidence refs, projection targets, source panel, source verification status, and source-range provenance on the `proliferation_decisions` ledger.
- Only confirmed candidates receive `proliferates_to` targets and can create a mature label correction rule.
- Canceled, deferred, and inspected candidates remain ledgered review decisions with no mature propagation target.
- The UI now verifies the backend returned the saved proliferation decision before installing local projections and refreshing analysis data.
- Regression coverage was added in `mature-data-proliferation-feedback-loop.test.mjs` for canonical decision persistence, source-linked traceback, projection targets, confirmation-only propagation, and confirmation-only label override creation.
- Verified after this slice: `cd src/frontend && npx tsc --noEmit`, `node --test src/frontend/tests/mature-data-proliferation-feedback-loop.test.mjs`, `cd src/frontend && npm test`, and `git diff --check`.

Windows Development Environment Kit slice:

- Added `WINDOWS_DEV_QUICKSTART.md` as the short branch-clone and first-run path for a Windows development/testing machine.
- Added `scripts/windows_env_check.ps1` to report Git, Conda, Python, Node/npm, Docker, FFmpeg/ffprobe, selected Python modules, backend health, and frontend dashboard status.
- Added `scripts/windows_first_run.ps1` to start backend and frontend in visible PowerShell windows, optionally install frontend dependencies, open the dashboard, and write `logs/windows-backend.log` and `logs/windows-frontend.log`.
- Updated `docs/vaa1_new_developer_windows_setup_handout_2026-06-04.md` to point non-coders to the quickstart and diagnostics scripts.
- This remains a development/test environment kit, not a packaged `.exe` release.

## Bottom Line

VAA1 already has a large amount of functioning analysis and annotation machinery. The remaining sprint is mainly about making that machinery governed, synchronized, traceable, and release-safe.

The central promise is:

```text
Corrected should stand corrected everywhere except traceback.
```
