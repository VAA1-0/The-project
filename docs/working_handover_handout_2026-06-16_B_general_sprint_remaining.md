# Fresh Thread Handout: VAA1 General Sprint Remaining

Date: 2026-06-16

Last updated: 2026-06-17

Purpose: give a fresh Codex thread a clean, practical entry point into the remaining VAA1 general sprint.

## Current Branch And Push State

Branch:

```text
petteri
```

Latest pushed commit:

```text
03d33f0 Operationalize entity search maturation layer
```

This commit is pushed to:

```text
origin/petteri
```

Important current state:

- The mature-data/search proliferation slice described below is local working-tree work after the latest pushed commit.
- Do not describe it as pushed until it is committed and pushed on `petteri`.
- The implementation has passed focused backend/frontend checks, but still needs rendered UI proof and a handout/commit before collaboration handoff.

## Local Worktree Caution

After the push, the intentional sprint work is cleanly committed. The remaining dirty/untracked files are local leftovers and should not be assumed to belong to the next sprint slice:

```text
M  docs/investor_deck/datascene_investor_deck_editable_2026-06-06.pptx
M  node_modules/.package-lock.json
M  scripts/generate_datascene_investor_deck.js
?? docs/board_meeting/
?? docs/working_handover_handout_2026-06-03_Z_meaning_network_sfl_thread.md
?? docs/working_handover_handout_2026-06-08_A_windows_parity_deck_timing_thread.md
?? scripts/generate_kansalliskirjasto_board_slides.js
```

Do not stage these unless the user explicitly asks to commit presentation/deck or old handover material.

## Recently Delivered

The latest pushed sprint slice operationalized the named entity and content search regime as governed runtime surfaces.

Delivered:

- Datascene Entity Registry runtime view.
- Datascene Content Search runtime view.
- Entity Registry projection into Meaning Network nodes.
- Entity harvesting into Scene Cards using existing fields only.
- Entity harvesting into Source Media / Metadata using existing candidate fields only.
- Data Maturation panel metrics for Entity Registry, Content Search, and SOM/scanner support.
- Contract tests proving source scope, authority, read-only search behavior, panel projection, and no cross-video bleed.

Key files:

- `src/frontend/lib/video-service.ts`
- `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`
- `src/frontend/app/V2components/components/panels/SceneCardPanel.tsx`
- `src/frontend/app/V2components/components/panels/SourceMediaMetadataPanel.tsx`
- `src/frontend/app/V2components/components/panels/DataMaturationPanel.tsx`
- `src/frontend/tests/datascene-entity-search-contract.test.mjs`
- `docs/schemas/vaa1.datascene_entity_registry.schema.json`
- `docs/schemas/vaa1.datascene_content_search.schema.json`
- `docs/vaa1_datascene_named_entity_regime_operationalization_2026-06-15.md`
- `docs/vaa1_latest_delivery_note_named_entity_search_maturation_2026-06-16.md`

Verified before push:

```bash
cd src/frontend && npm test -- --runTestsByPath tests/datascene-entity-search-contract.test.mjs tests/manual-annotation-governance.test.mjs tests/mature-data-proliferation-feedback-loop.test.mjs
cd src/frontend && npx tsc --noEmit
git diff --check
```

Result:

- 73 frontend contract tests passed.
- TypeScript passed.
- Diff whitespace check passed.

## Local Sprint Update: Mature Data Proliferation Becomes Actual

After the latest pushed commit, the working tree now contains a local implementation slice that turns the Mature Data Proliferation regime from audit-only into an active governed projection layer.

Delivered locally:

- `Live Mature Data Proliferation Bus` now creates `governed_mature_hypothesis` records from mature seeds and later candidates.
- Candidates remain non-promotions: they project as review-visible hypotheses, not confirmed mature truth.
- Content-derived source metadata and Scene Card observations can surface as confidence-rated mature observations.
- Entity/evidence matches now enter the live bus as candidate input, so entity matches can surface Mature Data Proliferation instead of remaining isolated search/matcher output.
- Genre-specific knowns are now represented in code, starting with news media lower-third OCR:
  - lower-third OCR entities are treated as on-screen evidence with a confidence rating;
  - the bus proposes audiovisual sample anchors for later source-sample/cloud matching;
  - these remain auditable proposed samples until the media crop/window writer exists.
- Datascene Search now surfaces Mature Data and Confirmable Cluster records through the shared Content Search builder.
- Search remains read-only and routes Mature Data / cluster review to Data Maturation.
- Data Maturation now shows governed hypotheses, content-derived mature observations, genre-rule observations, proposed audiovisual sample counts, and candidate/cluster drop actions.
- The manual annotation principle now applies to automatic proliferation:
  - individual automatically proliferated candidates can be canceled;
  - whole confirmable clusters can be canceled by `cluster_key`;
  - the live bus suppresses canceled candidates/clusters from active governed hypotheses;
  - suppressed opportunities remain visible in audit payloads.

Key files touched locally:

- `src/backend/analysis/live_mature_data_proliferation_bus.py`
- `api_server.py`
- `src/frontend/lib/video-service.ts`
- `src/frontend/lib/api-service.ts`
- `src/frontend/app/V2components/components/panels/DataMaturationPanel.tsx`
- `src/frontend/app/V2components/components/panels/SearchPanel.tsx`
- `tests/test_live_mature_data_proliferation_bus.py`
- `src/frontend/tests/datascene-entity-search-contract.test.mjs`
- `src/frontend/tests/mature-data-live-proliferation-contract.test.mjs`

Verified locally:

```bash
python3 -m unittest tests.test_live_mature_data_proliferation_bus tests.test_mature_data_proliferation_regime_overhaul_schema tests.test_saved_analysis_hydration_loader
cd src/frontend && npx tsc --noEmit
cd src/frontend && npx eslint app/V2components/components/panels/DataMaturationPanel.tsx app/V2components/components/panels/SearchPanel.tsx tests/mature-data-live-proliferation-contract.test.mjs tests/datascene-entity-search-contract.test.mjs
node --test src/frontend/tests/mature-data-live-proliferation-contract.test.mjs src/frontend/tests/datascene-entity-search-contract.test.mjs
```

One caveat:

- A broader API-server contract test that imports `api_server.py` directly can fail in this shell when `fastapi` is not installed. The changed backend modules compile and the import-light mature-data tests pass.

## Governing Sprint Principle

Keep repeating this rule:

```text
Manual analyst authority wins.
Candidate evidence supports.
Raw detections remain traceback substrate.
Search finds and explains; it does not mutate truth.
Search surfaces Mature Data and clusters only through shared Content Search.
Automatic candidates and clusters can be canceled by analyst decision.
Continuity is reviewed in Meaning Network and Narrative Agent surfaces, not silently enforced by BBox tracks.
```

The sprint is about making VAA1 dynamic and actually useful without letting inferred or raw substrate become uncontrolled truth.

## Most Important Remaining Problem

Mature Data Proliferation is no longer merely conceptual, but it is not fully proven at scale.

The user is specifically worried that:

- annotations and detections diminish toward the end of videos;
- early-video confirmations do not proliferate well enough to later scenes;
- raw track ids have previously overridden or dropped manual analyst annotations;
- cross-video bleed has occurred before, especially between Bond films;
- scanner/matcher/SOM/open-topology support must become useful without becoming reckless;
- automatic Mature Data and confirmable clusters must be easy to correct or drop.

The next sprint slices should therefore prioritize rendered proof, saved-state proof, source-sample realization, and governance visibility over adding more abstract schema.

## Recommended Next Order

### 1. Manual Smoke Test Of Mature Data / Search / Cluster Review

Goal: verify that the local mature-data bus slice is visible and useful in the live app.

Manual checks:

- Open a saved analysis.
- Open Data Maturation and confirm governed hypotheses render.
- Confirm content-derived mature observations render with confidence ratings.
- Confirm genre-rule observations and proposed audiovisual samples are visible when the fixture supports them.
- Confirm Search shows `Mature Data` and `Clusters` modes.
- Confirm Search Mature Data / Cluster rows route to Data Maturation via `Review`.
- Drop one individual candidate and confirm it is suppressed after refresh.
- Drop one whole confirmable cluster and confirm all matching cluster opportunities are suppressed after refresh.
- Confirm suppressed candidates remain auditable, not silently deleted.
- Confirm No Time To Die does not surface Diamonds Are Forever entities or clusters.
- Confirm search/scanner support remains candidate/review support unless mature authority exists.

Acceptance:

- The new Mature Data layer is visible, analysis-scoped, review-oriented, and manually correctable.

### 2. Rendered Playwright Proof For Mature Data/Search Projection

Goal: move from contract confidence to rendered confidence.

Suggested test:

- Load a deterministic saved analysis fixture.
- Open Data Maturation.
- Assert governed hypotheses, content-derived mature observations, genre-rule observations, and proposed audiovisual sample counts render.
- Assert candidate/cluster drop buttons render for governed hypotheses.
- Trigger a candidate drop and assert the candidate no longer appears as an active governed hypothesis after refresh.
- Trigger a cluster drop and assert all opportunities with the cluster key are suppressed.
- Open Search.
- Assert Mature Data and Clusters modes render records from the shared Content Search surface.
- Assert Search does not write corrections directly.
- Assert Search Review opens Data Maturation for the same analysis.
- Switch/open a second video fixture.
- Assert no cross-video bleed for mature data, clusters, entities, or Narrative Agent profiles.

Acceptance:

- The Mature Data regime is proven in the actual UI, not only contracts.

### 3. Audiovisual Source Sample Writer For Proposed Anchors

Goal: turn proposed audiovisual sample anchors into real media-derived source samples.

The bus now proposes audiovisual sample anchors, especially for news lower-third OCR evidence. The missing step is the actual writer that clips/crops source video/audio windows and stores source samples.

Needed work:

- consume `proposed_audiovisual_samples` from the live bus;
- create visual crops and audio windows where source media exists;
- write records under the existing `source_samples` structure;
- attach sample ids back to candidate/hypothesis evidence refs;
- keep failures explicit when source media is missing;
- preserve traceback to OCR, video time, source media, genre rule, and candidate cluster.

Acceptance:

- A lower-third OCR event can create a real source sample anchor that later searches/matches as audiovisual evidence.

### 3A. Scanner / Matcher Agents For Repeated Mature Patterns

Goal: turn scanner/matcher support into a practical Mature Data substrate across the analysis, not a Narrative-Agent-only feature.

The next scanner/matcher agent should consume mature anchors and sweep the full timeline for repeated source patterns. Narrative Agent identity continuity remains the urgent use case, but the architecture should also support:

- `Narrative Agents`: repeated confirmed characters, speakers, reporters, presenters, field agents, protagonists, antagonists, and off-camera/on-camera continuity;
- `Objects`: recurring vehicles, weapons, documents, logos, props, devices, signs, furniture, clothing items, institutional symbols, and manually confirmed object identities;
- `Named entities`: OCR names, lower thirds, place names, organization names, transcript entities, source metadata entities, and Entity Registry aliases;
- `Scene settings and environments`: sky, sea, forest, cityscape, street, studio, office, conference hall, courtroom, beach, vehicle interior, domestic interior, battlefield, crowd, and other repeated setting substrates;
- `Other repeated patterns`: audio/prosody motifs, music cues, action patterns, camera/shot patterns, interaction patterns, meaningful co-occurrence constellations, and repeated visual compositions.

The scanner/matcher should not become an uncontrolled promotion engine. It should produce source-linked candidate clusters with:

- candidate id, cluster id, analysis id, source time, and BBox/ROI or audio-window coordinates where available;
- match basis, such as appearance similarity, object similarity, OCR/entity similarity, voice/audio similarity, transcript speaker link, scene co-occurrence, object-agent relation, setting similarity, or negative evidence;
- confidence rating and conflict notes;
- source sample refs, traceback refs, and provenance back to the mature anchor;
- review state: confirm, stage annotation, defer, drop candidate, or drop cluster.

Acceptance:

- The bus can launch or consume scanner/matcher output for Narrative Agents, Objects, Named Entities, and repeated setting/pattern candidates.
- Candidate clusters appear in Data Maturation and Search as reviewable Mature Data support, not silent truth.
- Confirmed anchors improve later candidate quality across the full video, including late-video detections.
- Dropping a candidate or cluster suppresses it durably through the `proliferation_decisions` ledger.

### 4. Mature Data Proliferation Coverage Audit

Goal: understand why late-video detections and confirmations diminish.

Audit questions:

- Are detections actually absent, or only not projected into panels?
- Are scene boundaries, sampling windows, or source samples thinning later in videos?
- Are mature candidates being generated but hidden by panel filters?
- Are candidate decisions saved and reloaded?
- Are track ids or source ids collapsing, dropping, or shadowing later evidence?
- Are transcript/audio/visual clocks still aligned under Master time?

Expected output:

- A small report listing actual bottlenecks by layer:
  - detector output,
  - source samples,
  - mature resolver,
  - panel projection,
  - saved-state reload,
  - cross-video scope,
  - UI filtering.

Acceptance:

- The team knows whether the problem is detection, maturation, projection, persistence, or UI.

### 5. BBox/ROI Coordinate Authority And Manual Annotation Safety

Goal: prevent BBox tracks from overriding manual analyst assertions.

Relevant documents:

- `docs/vaa1_bbox_meaning_network_narrative_agent_ui_sprint_2026-06-10.md`
- `docs/vaa1_bbox_continuity_ux_map_wire_contract_2026-06-11.md`
- `docs/vaa1_remaining_sprint_program_stepwise_2026-06-03.md`

Key rule:

```text
BBox records source-local evidence.
Meaning Network compares evidence.
Narrative Agent owns agent continuity.
Master Schema publishes mature projections.
Traceback preserves the chain.
```

Next implementation should prove:

- `James Bond 43-46s` and `Nomi 47-49s` can exist on the same raw track.
- A later save cannot delete, retime, relabel, or hide the earlier manual event.
- Same-track conflict opens continuity review, not destructive BBox relabeling.
- Manual time correction to BBox survives save, refresh, and reopen.

Acceptance:

- Manual source-local BBox events remain authoritative inside their declared time/geometry scope.

### 6. Narrative Agent Panel Practical Usability

Goal: make Narrative Agent a fast working panel, not a dense information wall.

Already delivered earlier:

- single-profile dropdown;
- combined same-character profiles where governed alias/profile evidence supports it;
- timeline handles;
- agent graph handles;
- annotation card support;
- reduced accidental navigation to Meaning Network.

Remaining usability emphasis:

- The analyst should be able to confirm agent presence quickly:
  - here,
  - for this long,
  - one after another,
  - without grey loading detours.
- The panel should keep the analyst in context.
- Timeline and graph handles should feel like working controls, not decorative markers.
- Narrative Agent semantics should mature governed characteristics:
  - scene presence,
  - visual pattern sample status,
  - audio pattern sample status,
  - expression/affect,
  - gesture/action,
  - role/function,
  - relation,
  - object association,
  - continuity,
  - negative evidence.

Acceptance:

- Narrative Agent panel supports fast, source-linked analyst work and improves Mature Data Proliferation.

### 7. Meaning Network Workbench Hardening

Goal: make Meaning Network a true workbench for continuity and co-occurrence.

Remaining work:

- stable open/close behavior for large graph view;
- drag/drop or workspace positioning if opened as a large overlay;
- readable graph/timeline layout;
- source-linked node and edge sheets;
- cursor/video synchronization;
- continuity lanes;
- candidate/confirmed/rejected conflict states;
- no accidental panel detours when selecting nodes.

Acceptance:

- The analyst can use the graph to compare evidence, not merely view a visualization.

### 8. Search UI And Forensic Search

Goal: expose the newly operational Content Search layer as an analyst-facing tool.

Needed functions:

- keyword search;
- entity search;
- object search;
- character/Narrative Agent search;
- semantic search;
- multimodal search;
- forensic search.

Return levels:

- video;
- scene;
- segment;
- frame;
- entity;
- forensic evidence chain.

Important:

- Search must support explicit analyst confirmations.
- Search may infer confidence from governed mature evidence, but must not treat weak machine matches as truth.
- Search must jump to source video, scene card, entity card, and traceback where available.

Acceptance:

- Search becomes a navigation and evidence-discovery layer, not a mutation engine.

Current local update:

- Search now surfaces Mature Data and Confirmable Clusters from the shared Content Search builder.
- Search remains read-only and routes correction/review to Data Maturation.
- Do not add Search-local correction logic unless the governance model is deliberately changed.

### 9. Audiovisual Source Sampling Operationalization

Goal: make source image crops, audio windows, sample clouds, and scanner/matcher outputs first-class candidate evidence.

Remaining work:

- automatically create source samples from high-value confirmations;
- attach samples to candidate promotion decisions;
- expose cross-modal readiness lanes;
- support visual/audio sample matching without silent proliferation;
- preserve false matches and rejections as inactive traceback;
- use source samples to improve late-video coverage.

Acceptance:

- Mature Data Proliferation can use audiovisual evidence in practice, not only text and tracks.

### 10. Traceback, Exports, And Reports

Goal: prove that governed evidence survives outside the panel.

Remaining work:

- traceback drawer coverage for visible claims;
- forensic render jobs with source/time/coordinate/maturity metadata;
- reports carrying source anchors, maturity, authority, and traceback;
- exports preserving mature projections, raw substrate, inactive history, and candidate ledgers.

Acceptance:

- A claim can always answer why it exists and what evidence supports it.

### 11. Dormant Feature And Nominal Navigation Audit

Goal: identify which VAA1 features are actually operational, partially wired, nominal only, dormant, or broken.

The user has specifically asked for a systematic account of features and navigation states. Do not rely on memory or optimistic labels in the UI.

Audit surfaces:

- top tabs and GoldenLayout panels;
- project sidebar actions;
- saved analysis open/reopen;
- video transport and source jumps;
- Transcript, POS, Quant, OCR, Objects, Expressions, Source Media, Master Schema, Scene Cards, Meaning / Plot, Narrative Agent, OBJ Leaf, and Data Maturation panels;
- traceback drawers and source navigation;
- node/edge/card click paths;
- save, confirm, cancel, defer, inspect, rename, drop, merge, split, and promote actions;
- export/download/report actions;
- optional or disabled features that appear clickable.

Classify each route:

- `operational`: works and changes or navigates to the intended governed state.
- `partial`: visible and partly useful, but missing save, traceback, reload, or authority proof.
- `nominal`: visible label/control exists but does not perform the promised feature.
- `dormant`: code or schema exists but no usable UI path.
- `broken`: route errors, opens grey/blank/loading states, navigates to wrong panel, or loses context.

Expected output:

- A markdown audit table with panel, feature, current state, evidence, risk, and next fix.
- A short “do not present as delivered yet” list.
- A short “safe to demo” list.

Acceptance:

- The team can distinguish actual delivery from UI promise, and sprint priorities are based on observed behavior.

### 12. Systematic Playwright / DOM Release Account

Goal: prove the main VAA1 navigation and authority behaviors in a browser, not only through unit/contract tests.

Required Playwright account:

- dashboard loads;
- saved analysis opens;
- video renders nonblank;
- transport and source jumps work;
- GoldenLayout panel tabs open without grey detours;
- key panels render expected data;
- Meaning Network opens, closes, and returns focus safely;
- Narrative Agent graph and handles remain usable without forced panel navigation;
- BBox/ROI overlays align and survive resize/fullscreen-style changes;
- manual annotation save/reopen authority is visible;
- Master Schema governance surfaces render;
- traceback navigation opens evidence;
- Entity Registry / Content Search projections render in Meaning Network, Scene Cards, Source Media / Metadata, and Data Maturation;
- switching/opening another video does not bleed entities, candidates, or Narrative Agent profiles.

Important:

- Playwright should not merely assert that components mount.
- It should state which user paths are inactive, nominal, partial, or operational.
- It should produce a written summary for the handout/audit, not just pass/fail output.

Acceptance:

- The project has a browser-tested map of working and non-working navigation.

### 13. User Agreement And Data-Location Governance

Goal: make data boundaries explicit before wider release or `.exe` packaging.

Required work:

- first-run operating agreement;
- explicit distinction between local processing and external/API/remote/paid processing;
- consent before source media, metadata, prompts, screenshots, or derived artifacts leave the local machine;
- local storage of agreement state;
- visible reset/review of agreement state;
- disclosure of generated artifacts, exports, reports, optional services, and paid/remote boundaries.

Acceptance:

- The user knows what is local, what can leave the machine, and what has been generated.
- Consent is checked through one governed agreement state, not scattered prompts.

### 14. Runtime Configuration And Optional Capability Registry

Goal: prevent hidden dependency and licensing surprises.

Required work:

- add or document settings for YOLO/model choice, FFmpeg path, detector alternatives, API keys, LLM providers, Whisper, optional browser automation, and Ultralytics;
- keep the core workflow usable with optional APIs disabled;
- record model/runtime choice, version, path, parameters, provider boundary, opt-in state, and fallback reason in traceback;
- isolate licensed scripts, paid tools, remote services, GPL/AGPL-sensitive tools, premium services, and restricted capabilities behind explicit user activation.

Acceptance:

- Optional capabilities are requested and traceable, not silent defaults.
- Runtime/tool decisions flow through one activation registry rather than scattered checks.

### 15. FFmpeg Replacement / Optional Use Path

Goal: make FFmpeg-dependent workflows release-safe.

Required work:

- detect installed `ffmpeg` and `ffprobe` path, version, and license boundary;
- allow the user to choose or replace the binary;
- explain unavailable codec/workflow consequences;
- provide a local/basic fallback or disabled-state workflow where feasible;
- record every FFmpeg/ffprobe use in traceback with path, version, activation state, parameters, fallback decision, and produced evidence ids.

Acceptance:

- VAA1 can explain and survive missing, incompatible, unactivated, or license-sensitive FFmpeg components without corrupting the analysis ledger.

### 16. YOLOv8 / Ultralytics Replacement / Optional Use Path

Goal: make detector-dependent workflows release-safe.

Required work:

- detect whether YOLOv8/Ultralytics is installed and activated;
- expose user choice of detector/runtime;
- support a basic local detector fallback or disabled-state workflow;
- prevent release-critical analysis from silently depending on YOLOv8 if the user has not activated it;
- record detector/model provider, version, model path, activation state, parameters, fallback decision, and produced evidence ids in traceback.

Acceptance:

- YOLOv8/Ultralytics is optional, visible, and traceable rather than an invisible release assumption.

### 17. Calibration, Transcript Integrity, And Backend Hardening

Goal: make representative analysis outputs reliable enough for release testing.

Remaining work:

- detector calibration for motion, scene, person, object, genre-sensitive sampling, and dense/adaptive sampling;
- full-duration transcript coverage verification;
- fallback retranscription strategy for degraded audio;
- distinction between real backend failures and environment/runtime failures;
- startup, restart, saved-state recovery, and packaging write-location checks;
- backend health checks for both development and packaged contexts.

Acceptance:

- Representative media runs either produce complete inspectable outputs or clear fallback/error states.

### 18. Packaging And `#0.1 .exe` Readiness

Goal: package only after governance and release gates are satisfied or explicitly deferred.

Required work:

- complete pre-`.exe` manual test checklist;
- verify startup, restart, source-media reopen, saved-state recovery, export, rollback/restore, consent display, optional API handling, licensed add-on configuration, and data-location disclosure;
- verify FFmpeg path selection/replacement and YOLOv8/Ultralytics detector alternatives or disabled-state fallback;
- confirm the packaged app can run the core local pipeline with optional APIs disabled;
- confirm the packaged app does not silently require FFmpeg or YOLOv8 in a license-sensitive way;
- run backend contracts, frontend tests, typecheck, Playwright checks, and at least one representative full-analysis smoke test;
- build and label `#0.1 .exe` only after release freeze checks pass or are explicitly deferred.

Acceptance:

- The packaged app demonstrates VAA1's governed workflow rather than packaging current instability.

## Suggested First Prompt For Next Thread

Use this if starting fresh:

```text
We are on branch petteri. Latest pushed commit is 03d33f0, "Operationalize entity search maturation layer", but there is newer local working-tree work for the Mature Data Proliferation bus. Please read docs/working_handover_handout_2026-06-16_B_general_sprint_remaining.md, docs/vaa1_latest_delivery_note_named_entity_search_maturation_2026-06-16.md, docs/vaa1_remaining_sprint_program_stepwise_2026-06-03.md, and docs/vaa1_general_sprint_regime_remaining_tasks.md. Then begin with the recommended next step: manually or via Playwright verify that the Mature Data bus, Data Maturation panel, and Search panel actually surface governed hypotheses, content-derived mature observations, genre-rule observations, proposed audiovisual samples, Mature Data search records, and confirmable clusters without cross-video bleed. Confirm candidate and cluster drops are saved through the `proliferation_decisions` ledger and suppress active hypotheses after refresh. Also keep the release-tail sprint in scope: source-sample writer, dormant feature audit, systematic Playwright/navigation account, user agreement, optional FFmpeg/YOLOv8 runtime governance, backend hardening, and #0.1 .exe readiness.
```

## Fresh Thread Operating Rules

- Start with `git status -sb`.
- Do not stage unrelated deck, board-meeting, node_modules, or old handover files.
- Prefer rendered/manual proof before adding new abstraction.
- Do not add new Scene Card or Source Media / Metadata fields unless explicitly requested; harvest into existing fields first.
- Keep SOM/open topology scanner/matcher diagnostic and review-oriented until mature confirmation exists.
- Search may surface Mature Data and confirmable clusters only through the shared Content Search builder.
- Data Maturation owns candidate/cluster review controls for the current slice.
- Manual analyst cancellation can suppress one automatic candidate or a whole confirmable cluster.
- Keep Master time as the shared clock for transcript, BBox/ROI, audio, visual expression, scene presence, and search.
- Preserve manual analyst authority above raw detections and candidate matches.
- Do not call a UI feature operational until a manual or Playwright path proves navigation, state, and saved/reloaded authority.
- Treat FFmpeg, YOLOv8/Ultralytics, LLMs, APIs, and licensed scripts as optional activated capabilities with traceback, fallback, or disabled states.
- Do not package `#0.1 .exe` until consent, runtime configuration, Playwright/browser paths, backend health, and representative analysis smoke tests are either passed or explicitly deferred.

## Current Strategic Direction

The remaining sprint should make VAA1 less conservative in candidate discovery but more disciplined in authority.

The system should become:

- dynamic in finding related evidence;
- strict in mature promotion;
- fast for analyst confirmations;
- transparent in traceback;
- scoped by video/analysis;
- governed through Master Schema and mature-data projection;
- useful across panels without creating private panel truths.

That is the practical route to delivering the Datascene/VAA1 promise:

```text
Corrected data stands corrected everywhere except traceback.
Candidate evidence proliferates as review pressure.
Mature evidence proliferates only with authority, source anchors, and auditability.
```
