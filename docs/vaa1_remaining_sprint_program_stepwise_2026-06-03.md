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

Self-review focus:

- Are all BBox/ROI geometry consumers using the same normalization, resolver, projection, and saved-bundle builder?

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

Tasks:

- Keep Character Paths primarily in Narrative Agent surfaces.
- Add scene presence, character-by-scene, participant ranking, dramatic archetype readings, and role/relation/action paths.
- Feed paths from mature BBox/ROI, Meaning Network intervals, transcript/speaker links, scene anchors, object relations, prosody, and manual annotations.
- Propagate analyst renames, confirmations, merges, splits, rejections, and drops across panels.
- Make node/edge sheet actions open the specific relevant Narrative Agent storyline, not a generic overview.

Acceptance:

- Narrative Agents are not just names. They are governed subjects with timelines, evidence, roles, relations, and traceback.

Self-review focus:

- Do Narrative Agent changes flow through one governed subject/path model instead of separate rename, profile, BBox, graph, and report paths?

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
- Still needed: a true browser/Playwright BBox/ROI fixture for live Video Panel interaction, fullscreen enter/exit, refresh/reopen if available, and DOM overlay measurement.
- Add a saved-bundle inspection check that proves the persisted annotation contains the exact normalized analyst boxes as manual `geometry_keyframes`.
- Keep raw detector keyframes retained only as traceback/provenance unless explicitly surfaced as candidate support.

## Bottom Line

VAA1 already has a large amount of functioning analysis and annotation machinery. The remaining sprint is mainly about making that machinery governed, synchronized, traceable, and release-safe.

The central promise is:

```text
Corrected should stand corrected everywhere except traceback.
```
