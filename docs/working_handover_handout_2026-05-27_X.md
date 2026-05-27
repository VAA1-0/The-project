# VAA1 Working Handover Handout - 2026-05-27

## Purpose

This handout preserves the current thread state so the next session can begin cleanly without losing the sprint logic.

The thread moved from feature-design discussion into emergency presentation-readiness hardening. The central concern became practical governance: VAA1 must not tell stories from empty detections, stale tracks, or detector leftovers. Mature, source-linked, analyst-controlled evidence must govern the interface.

The immediate presentation risk was BBox/ROI behavior. A later Narrative Agent correction could bleed into an earlier scene and overwrite a previously corrected agent. That violated the core VAA1 rule:

```text
Manual annotation / confirmation wins, but only inside its governed source, time, geometry, and apply-scope boundaries.
```

This handout should be read alongside:

- `docs/vaa_1_narrative_agent_maturity_corrections.md`
- `docs/vaa1_general_sprint_regime_remaining_tasks.md`
- `docs/vaa1_operating_principles_constellational_meaning_network_2026-05-26.md`
- `docs/vaa1_proceedings_meaning_network_maturity_tests_2026-05-26.md`
- `docs/vaa1_mature_data_proliferation_governance_schema_v1.json`
- `docs/vaa1_datascene_meaning_network_schema.json`
- `docs/vaa1_interpretive_lens_schema_and_sprint_v1.json`
- `docs/VAA1_Bojean_Antenarrative_5B_Genre_Traceability_Schema.json`

## Current Branch And Working State

Repository root:

```text
/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project
```

Known modified files at handout time:

```text
src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx
src/frontend/app/V2components/components/panels/VideoPanel.tsx
src/frontend/lib/video-service.ts
src/frontend/tests/manual-annotation-governance.test.mjs
docs/working_handover_handout_2026-05-27_X.md
```

Do not reset the worktree. These changes are part of the current sprint.

## User-Facing Problem That Triggered The Latest Fix

The analyst confirmed a BBox/Narrative Agent in one scene as James Bond.

Later, in another scene, the analyst opened a BBox over Felix Leiter and confirmed Felix Leiter as a new character.

The later Felix correction then appeared to overwrite or dominate the earlier James Bond scene. This showed that raw detector track identity or fallback overlay keys were still being used as if they were safe semantic authority across scene/time boundaries.

That behavior is unacceptable because:

- a raw track is not a Narrative Agent,
- a BBox is not allowed to become global truth unless the analyst explicitly chooses a wide apply scope,
- corrected data must not bleed outside its allotted time interval,
- previous analyst confirmations must remain intact unless explicitly edited, merged, split, or superseded,
- stale detector state may remain in traceback but must not dominate active views.

## Latest BBox/ROI Governance Fix

The latest fix tightened BBox/ROI governance in `VideoPanel.tsx` and `video-service.ts`.

### Main Behavior Changes

- Manual object authority is now apply-scope aware.
- Ordinary interval saves no longer become whole-track authority.
- Track-wide authority is only allowed for explicit broad scopes such as:
  - `track_family`
  - `narrative_agent_family`
  - `current_continuity_segment`
  - `current_scene`
- Saved object-backed BBox annotations now include the confirmed time interval and BBox fingerprint in their annotation id.
- This prevents a later scene confirmation from replacing an earlier scene confirmation that happens to share a detector track or fallback key.
- Manual annotation visibility now obeys exact saved intervals.
- Master Schema mature labels require finite source time before painting onto video.
- Saved manual BBoxes suppress the raw/machine BBox only during the manual BBox's active interval.
- Saving a BBox clears the selected workspace state and closes the editor.
- Old detector states should remain available as traceback provenance, not active truth.

### Latest Validation

The following checks passed after the latest BBox governance hardening:

```bash
node --test src/frontend/tests/manual-annotation-governance.test.mjs
cd src/frontend
npm test
npx tsc --noEmit
cd ../..
git diff --check
```

Result:

```text
manual-annotation-governance: 41/41 passing
frontend npm test: 51/51 passing
TypeScript: passing
diff whitespace check: clean
```

## BBox/ROI Governance Rules To Preserve

These rules should guide the next session.

### 1. Raw Detection Is Never Semantic Authority

Raw `person`, `object`, `track`, `face`, `expression`, or `speaker` detections are sensory substrates only.

They may support a Narrative Agent, object, situation, or relation claim, but they cannot become mature truth without governed intake, source anchors, maturity state, and traceback.

### 2. Manual Correction Wins Within Scope

Manual analyst action has highest authority, but the authority must remain scoped.

A manual correction may be:

- current BBox only,
- current interval only,
- current scene,
- current continuity segment,
- track family,
- Narrative Agent family.

The default should remain conservative. Wide scope must be explicit and visible.

### 3. Time Boundaries Are Hard

No annotation, graph node, BBox, transcript claim, Narrative Agent presence interval, or object claim should appear before or after its allotted time unless it has a separate governed interval that justifies the display.

Valid places to set or correct time:

- BBox/ROI editor,
- relevant evidence panels,
- Meaning Network Graph presence handles,
- Master Schema governed corrections.

### 4. Geometry Boundaries Matter

A BBox correction should not rewrite every future detection just because a detector recycled a track id.

The active correction should include:

- time interval,
- BBox geometry or keyframes,
- source overlay/detection reference,
- apply scope,
- authority level,
- traceback.

### 5. Saving Should Stabilize The UI

Saving a BBox should close the active BBox editor. It should not leave a stale selected overlay alive that can keep old anchors active or visually confuse the analyst.

### 6. Traceback Retains Old States

Incorrect detector labels, old raw tracks, replaced labels, dropped matches, and rejected candidates should remain inspectable in traceback. They should not remain active truth.

## Meaning Network Graph Status

The Meaning Network Graph moved from a mute button surface toward an operational graph and timeline workspace.

Delivered or partially delivered:

- Graph view appears in Meaning / Plot.
- Meaning Network can surface Master Schema-derived nodes.
- Manual node creation controls exist for:
  - character,
  - Narrative Agent,
  - object,
  - situation,
  - continuity anchor,
  - off-camera presence,
  - spoken word,
  - prosody,
  - music,
  - location.
- Node marker lists and edge marker lists exist.
- Nodes can be confirmed, copied, and renamed.
- Graph has zoom controls.
- Mouse-wheel zoom and non-wheel zoom controls were introduced.
- Whole timeline, scene timeline, and character timeline modes exist conceptually and partially in UI.
- Scene spans can be shown as timeline bands.
- Presence bars and handles exist for some node types.
- Meaning Network handle edits can persist into `master_schema_presence_intervals`.
- Meaning Network edits notify Narrative Agent and Master Schema surfaces.
- Meaning Network has a dedicated panel registration / workspace affordance.
- A timeline cursor has been started for graph-video synchronization.

## Meaning Network Known Problems

The graph is promising but not yet stable enough to be considered finished.

Known issues:

- Dense node labels still overlap.
- On-camera agents sometimes appear in the wrong lane or fail to appear in the on-camera lane.
- Some source-linked graph nodes have lost video-source navigation in specific states.
- Some nodes still show `source pending` when they should have source anchors.
- Cursor navigation has been sticky or incomplete.
- The graph is still cramped as a subfield; it needs a full, resizable panel workspace.
- Scene focus can unintentionally restrict the graph to a partial timeline.
- Relations and edge management are not yet operationally clear.
- Scene add/delete/paint/resize operations exist only as early affordances or design targets.
- Presence handles are not yet universally available for all relevant agent nodes.
- Graph lanes need clearer ordering and source-governed routing:
  - scenes,
  - on-camera agents,
  - off-camera / presumed presence,
  - spoken word,
  - prosody,
  - music,
  - location,
  - objects,
  - situations,
  - custom analyst lanes.

## Meaning Network Design Direction

The Meaning Network should become its own serious workspace, not a cramped card inside Meaning / Plot.

Required next shape:

- full GoldenLayout panel,
- expandable workspace mode,
- suitable for secondary display use,
- scrollable and zoomable,
- readable text layout,
- non-overlapping labels,
- whole-timeline mode,
- scene-timeline mode,
- Narrative Agent / character-timeline mode,
- custom lane creation,
- scene band painting and resizing,
- draggable node presence bars,
- draggable handles that scrub the video during drag,
- source-verifiable node and edge clicks,
- double-click Narrative Agent node opens Narrative Agent profile/card,
- single-click selects node and activates handles,
- right-click or traceback action opens source chain.

The graph must remain subordinate to the Master Schema. It organizes and corrects meaning; it does not become a private truth island.

## Mature Data Proliferation Regime

This remains the most important sprint domain.

The aim is:

```text
Fully transparent, traceable, navigable, automated multimodal analysis with full analyst control.
```

Mature data proliferation means that once evidence becomes mature, the mature state propagates to all associated surfaces:

- video overlays,
- BBox/ROI editor,
- Meaning Network,
- Narrative Agent cards,
- Master Schema,
- scene cards,
- Meaning / Plot,
- transcript,
- diarization,
- audio/prosody,
- POS/SFL/dependency,
- quantitative text,
- evidence graph,
- traceback,
- report writer,
- search/export.

The key rule:

```text
Corrected should stand corrected everywhere except traceback.
```

## Mature Data Proliferation Priority Questions

The user asked four strategic questions that should remain active:

1. Which features can be most reliably operationalized for actual mature proliferation results?
2. Which nodes are most needed for human analysts to recognize in order to proliferate a meaningful mature data array?
3. What additional features should VAA1 develop or incorporate to deliver better mature proliferation results, such as SOM comparison of audio and visual profiles?
4. How do we guarantee human-annotated or confirmed data proliferates as the most mature state in all associated panels and features?

Current answer direction:

- Most reliable immediate proliferation sources:
  - manual BBox/ROI corrections,
  - transcript corrections,
  - speaker-agent links,
  - Narrative Agent profile confirmations,
  - scene boundary corrections,
  - Meaning Network presence intervals,
  - audio sample confirmations,
  - visual pattern confirmations.
- Most important human-recognized nodes:
  - Narrative Agent,
  - object,
  - scene,
  - spoken word,
  - speaker / voice,
  - relation,
  - location,
  - off-camera presence,
  - prosody/sound,
  - continuity anchor,
  - situation/action.
- Additional features likely needed:
  - SOM or similar near-match comparison for audio and visual profiles,
  - cross-modal continuity scorer,
  - situational option mirroring,
  - candidate-family manager,
  - stale-output detector,
  - contradiction surfacing,
  - mature evidence quality agent,
  - rendered Playwright verification.
- Propagation guarantee:
  - Master Schema is the authority hub,
  - every mature event writes a propagation event,
  - panels read mature state rather than local semantic truth,
  - older views must be forced to refresh from mature records,
  - stale raw output may only survive in traceback.

## Near-Match And Situational Option Policy

The user added important governance detail:

- Confirmed patterns should be compared/mirrored to similar situational options.
- Near matches with reasonable probability should surface in BBox/ROI and relevant panels as `to_be_confirmed_or_canceled` candidates.
- Candidates should not hide under the hood.
- Confirmation is required for ordinary probability cases.
- Probability boundaries must be openly discussed and weighted.
- Only very high probability or manual/actual confirmation may proliferate as mature.

This should be implemented as a configurable schema, not hard-coded magic.

## Narrative Agent And Character Paths

The user settled an important design distinction:

- Meaning / Plot is the cross-agent plot and scene-meaning map.
- Character Paths belong primarily in Narrative Agent surfaces.

Character-path views should include:

- scene agents,
- characters by scene,
- dramatic archetypes,
- participant ranking,
- Narrative Agent paths.

These are not decorative cards. They should be operational:

- navigable,
- source-linked,
- maturity-aware,
- editable where relevant,
- connected to scene presence,
- connected to Meaning Network intervals,
- connected to Master Schema subjects.

## Interpretive Lenses

Interpretive traditions should act as lenses, not labels imposed on evidence.

Meaning / Plot lens examples:

- Aristotelian,
- Freytagian,
- Campbellian,
- Fryean,
- Bookerian.

Character / Narrative Agent lens examples:

- scene agents,
- characters by scene,
- dramatic archetypes,
- participant ranking,
- Narrative Agent paths.

Other lenses discussed or present in schema:

- Shakespearean / performed agency,
- Proppian / narrative function,
- Jungian / symbolic shadow,
- Greimasian / actant relation,
- Burkean / motive scene,
- Bojean antenarrative 5B.

These lenses should generate analyst-facing prose only when they can cite mature, source-linked evidence.

## SFL And Dependency Parsing Integration

SFL and dependency parsing should not sit beside the interpretive system as a disconnected text analysis feature.

They should provide linguistic evidence for:

- Meaning / Plot lenses,
- Narrative Agent paths,
- Character Paths,
- scene cards,
- Meaning Network nodes and relations,
- 5B interpretations,
- report prose.

Important rules:

- If transcript text changes, SFL/dependency outputs must be marked stale or recomputed.
- If speaker-agent links change, SFL/dependency claims involving agency, role, modality, address, or process type must be reconsidered.
- If scene boundaries change, scene-level linguistic aggregation must update.
- Generated prose should remain source-linked and maturity-aware.

## Bojean Antenarrative 5B Layer

The 5B schema remains a general sprint item and should not be forgotten.

Needed work:

- integrate 5B as a maturity-aware interpretive evidence layer,
- connect 5B candidates to POS/SFL/dependency outputs,
- surface 5B evidence in Quant, POS/SFL, scene cards, Meaning / Plot, Narrative Agent, and reports,
- keep all 5B claims linked to transcript tokens, scenes, agents, visual/audio evidence, and traceback,
- begin with manual/source-linked support before automated mature claims.

## Meaning Network And 5B Relationship

The Meaning Network is a strong home for making 5B evidence inspectable:

- `Before`: prior situation, expectation, source setup,
- `Beneath`: suppressed motive, hidden structure, subtext,
- `Bet`: risk, wager, narrative opening,
- `Between`: relation, tension, negotiation, co-presence,
- `Becoming`: transition, change, role movement.

These should be graph/lane aware, not only prose labels.

## User Agreement And Data-Location Governance

Still pending and important before public distribution or `.exe` packaging.

Needed:

- first-run user agreement,
- local vs remote processing disclosure,
- optional API/LLM/provider disclosure,
- consent before source media, screenshots, prompts, metadata, or derived artifacts leave the machine,
- local storage of agreement state,
- ability to inspect/reset agreement,
- data retention and export disclosure,
- paid/remote service boundary disclosure.

Core promise:

```text
The user should know where their data is processed, what leaves the machine, and what generated artifacts exist.
```

## Runtime, Model, And Environment Governance

The user specifically flagged missing Whisper and Ultralytics environment issues.

Known direction:

- Verify Whisper and Ultralytics availability in the Mac environments, especially `face` and `basic`.
- Keep runtime caches inside `.cache/vaa1-runtime` where possible.
- Record model/runtime choice in traceback:
  - model name,
  - version,
  - path,
  - provider,
  - parameters,
  - fallback reason.
- Keep VAA1 usable without premium APIs or remote LLM services.
- Make model paths and optional features configurable.

This track belongs under optional APIs, model governance, and runtime configuration.

## Licensed And Optional Feature Governance

VAA1 should support optional licensed, paid, or externally provided capabilities, but they must never be silently required for the core local workflow.

Examples may include:

- commercial LLM/API providers,
- paid transcription, diarization, translation, OCR, or vision APIs,
- licensed detector/model packs,
- licensed media codecs or enhanced FFmpeg builds,
- external storage, collaboration, or export services,
- paid browser automation or hosted compute services,
- commercial annotation integrations,
- premium model weights or datasets.

Required design rule:

```text
Optional licensed features are user-requested capabilities, not hidden defaults.
```

Operational requirements:

- The core VAA1 path must remain usable without licensed features.
- Licensed features must be discoverable as optional choices in settings or feature prompts.
- The user must explicitly opt in before a licensed or paid provider is used.
- VAA1 must disclose whether the feature is local, remote, paid, metered, credentialed, or license-restricted.
- API keys, tokens, model licenses, and provider credentials must be stored outside source control.
- Every use of a licensed/optional feature must write traceback metadata:
  - provider,
  - model or service name,
  - version where available,
  - local/remote boundary,
  - user opt-in state,
  - runtime parameters,
  - fallback path if unavailable,
  - produced evidence ids.
- If a licensed feature is unavailable, VAA1 should offer a local/basic fallback or mark the feature unavailable without blocking unrelated analysis.
- Reports and exports should distinguish evidence produced by local open tooling from evidence produced by optional licensed tooling.

This is closely related to user agreement and data-location governance. The user should always know when an analysis step depends on a licensed, remote, paid, or credentialed capability.

## CVAT And Annotation Round Trip

Still pending in the general sprint ladder:

- one-click handoff to CVAT,
- reuse stored CVAT task ids,
- prevent duplicate tasks,
- ingest CVAT outputs into governed Master Schema objects,
- display import validation and correction history,
- keep CVAT credentials/session material out of Git.

## Playwright And DOM Testing

This is becoming urgent because many current tests are contract/source tests rather than rendered behavior tests.

Needed Playwright coverage:

- dashboard load,
- project reopen,
- video rendering,
- overlay rendering,
- BBox/ROI save and close behavior,
- BBox/ROI mature-label priority,
- BBox time-scope enforcement,
- Meaning Network graph rendering,
- graph node source navigation,
- graph cursor/video synchronization,
- presence handle drag,
- presence interval persistence,
- Narrative Agent card refresh after Meaning Network edits,
- Master Schema panel refresh after mature corrections,
- GoldenLayout reload stability,
- traceback navigation,
- browser refresh shortcut behavior.

Existing source-level tests are useful but not enough. A presentation-safe UI needs rendered checks.

## Packaging And `.exe` Readiness

The `.exe` / desktop-distributable track must remain gated.

Do not treat packaging as ready until:

- BBox/ROI governance is stable,
- Master Schema mature state wins in all relevant surfaces,
- Meaning Network source navigation is reliable,
- basic Playwright UI tests pass,
- pre-`.exe` manual checklist is completed,
- user agreement exists,
- runtime/model configuration is documented,
- export/reopen/restart flows are tested,
- live API/download paths are verified outside the sandbox.

Packaging before governance is stable would package confusion.

## Presentation-Readiness Status

Strong points now visible:

- Meaning Network Graph has become a compelling visual and conceptual presentation feature.
- Mature data proliferation is now a concrete governance regime, not only language.
- BBox/ROI manual correction now has stricter scoping.
- Narrative Agent maturity and Master Schema authority principles are clearly articulated.
- Interpretive lenses have a coherent design home.
- Tests are currently passing for the frontend and the latest BBox governance checks.

Risks for presentation:

- Live BBox behavior should be manually smoke-tested on the exact Bond trailer sequence.
- Meaning Network graph may still show layout crowding.
- Some graph source links may still be source-pending.
- On-camera/off-camera lane routing may still be inconsistent.
- The graph is still not fully mature as a large standalone workspace.
- Browser/app refresh behavior has previously been awkward.
- The app should be run from a clean frontend restart before presentation.

## Immediate Manual Smoke Test For Presentation

Before presenting, run this practical sequence:

1. Restart frontend cleanly.
2. Open the Bond trailer analysis.
3. Navigate to the earlier James Bond scene.
4. Confirm James Bond BBox label remains James Bond.
5. Navigate to the Felix Leiter scene around `0:30`.
6. Confirm Felix Leiter BBox label remains Felix Leiter only in its own interval.
7. Scrub before and after the Felix interval.
8. Confirm Felix does not bleed into unrelated frames.
9. Save a BBox correction and confirm the BBox editor closes.
10. Open Meaning / Plot.
11. Confirm Meaning Network renders.
12. Click at least one source-linked node and confirm video seeking.
13. Open Narrative Agent panel and confirm profile/card surfaces are not contradicted by the graph.
14. Avoid relying on graph lanes that are still known to be unstable.

## Automated Checks To Run Before Push Or Presentation

Frontend:

```bash
cd src/frontend
npm test
npx tsc --noEmit
```

Targeted governance:

```bash
node --test src/frontend/tests/manual-annotation-governance.test.mjs
```

Diff hygiene:

```bash
git diff --check
git status --short
```

Backend if time permits:

```bash
python -m pytest tests
```

If the live download test requires a running API server or local network access, document whether it was skipped or verified manually.

## Remaining General Sprint Regime

The current general sprint regime should remain ordered as follows.

### 1. Data Maturity Proliferation Regime

This remains the highest-priority track.

Deliver:

- Master Schema-first mature-data spine,
- scoped manual correction events,
- propagation events,
- stale-output marking,
- near-match candidate surfacing,
- confirmation/cancellation flows,
- contradiction display,
- source-anchor enforcement,
- mature state refresh across all panels,
- Quality Agent audit tray.

Acceptance:

- user-corrected data appears corrected everywhere except traceback,
- raw detections cannot override mature corrections,
- every active visible claim has source, time, maturity, authority, and traceback.

### 2. BBox/ROI Governance Hardening

This is now part of the maturity spine, not a side feature.

Deliver:

- exact time-scope behavior,
- geometry/keyframe persistence,
- save-closes-editor behavior,
- object-vs-agent separation,
- explicit apply-scope warnings,
- source jump reliability,
- traceback of old states,
- rendered Playwright fixture.

Acceptance:

- a later BBox correction cannot overwrite an earlier scene correction unless explicitly scoped to do so.

### 3. Meaning Network Graph

Deliver:

- dedicated panel,
- dynamic workspace,
- lane routing,
- readable layout,
- source navigation,
- cursor/video sync,
- draggable/stretched presence bars,
- scene add/delete/paint/resize,
- custom lanes,
- edge management,
- Master Schema feedback loop.

Acceptance:

- the graph can act as a serious multimodal timeline/network workbench.

### 4. Narrative Agent And Character Paths

Deliver:

- profile/card feedback from Meaning Network intervals,
- scene presence indicators,
- character by scene,
- participant ranking,
- dramatic archetype readings,
- role/relation/action paths,
- merge/split/drop/rename propagation.

Acceptance:

- Narrative Agents are no longer just names; they are mature, source-linked agents with paths, evidence, roles, and relations.

### 5. Meaning / Plot And Interpretive Lenses

Deliver:

- lens views for plot and scene cards,
- source-linked prose,
- maturity-gated interpretation,
- connection to SFL/dependency, transcript, prosody, visual evidence, and Narrative Agent paths.

Acceptance:

- interpretive prose is useful to an analyst and never detached from evidence.

### 6. SFL / Dependency / Transcript Integration

Deliver:

- stale marking on transcript correction,
- speaker-agent link integration,
- scene-level linguistic aggregation,
- relation to Meaning Network and interpretive lenses,
- source-linked prose support.

Acceptance:

- linguistic analysis becomes operational evidence, not a separate text gadget.

### 7. Audio, Prosody, Whisper, Diarization

Deliver:

- verify Whisper environment,
- diarization reliability,
- speaker-agent linking,
- audio sample cloud governance,
- prosody timeline tracks,
- source jumps,
- editable samples,
- mature audio evidence propagation.

Acceptance:

- voice, sound, prosody, and transcript can support Narrative Agent and scene meaning.

### 8. Visual Pattern, Object Continuity, SOM / Near Match

Deliver:

- visual pattern candidates,
- object-agent relation candidates,
- SOM or equivalent near-match comparison,
- situational option mirroring,
- reviewable near-match surfacing,
- configurable probability thresholds.

Acceptance:

- VAA1 can propose continuity without pretending weak matches are truth.

### 9. Bojean 5B And Antenarrative Layer

Deliver:

- source-linked 5B evidence,
- connection to SFL/dependency and Meaning Network,
- scene-card and report surfacing,
- maturity gates.

Acceptance:

- 5B becomes inspectable evidence logic, not only a theory label.

### 10. Traceback, Governance Matrix, Quality Agent

Deliver:

- source-chain drawer coverage,
- governance matrix,
- audit tickets,
- missing-source warnings,
- stale-projection warnings,
- panel-divergence warnings,
- orphan-candidate warnings.

Acceptance:

- VAA1 can show why a claim exists and whether it is safe to use.

### 11. User Agreement And Data Governance

Deliver:

- first-run agreement,
- local/remote disclosure,
- optional API disclosure,
- export/retention disclosure,
- resettable agreement state.

Acceptance:

- users understand data location, processing boundaries, and optional service risks.

### 12. Runtime Configuration

Deliver:

- model/runtime configuration UI or documented config,
- Mac environment verification for Whisper and Ultralytics,
- FFmpeg path handling,
- optional API key handling,
- provider/version traceback.
- optional licensed feature registry and opt-in flow.

Acceptance:

- VAA1 can be run and explained without hidden runtime dependencies.
- licensed or paid capabilities are available only by explicit user request and remain traceable.

### 13. Optional Licensed / External Capability Layer

Deliver:

- settings registry for optional licensed features,
- user-requested activation flow,
- local/basic fallback declarations,
- credential and license boundary documentation,
- traceback metadata for every optional feature use,
- report/export labeling for licensed-feature-derived evidence.

Acceptance:

- VAA1 can incorporate stronger licensed capabilities when the user asks for them, while preserving transparent local operation and avoiding hidden dependency on paid or restricted tooling.

### 14. CVAT Round Trip

Deliver:

- CVAT handoff,
- duplicate task prevention,
- governed re-import,
- validation,
- correction history.

Acceptance:

- external annotation can return as mature or reviewable Master Schema evidence.

### 15. Playwright And Release Testing

Deliver:

- rendered app tests,
- dashboard/project/video tests,
- BBox/ROI fixture,
- Meaning Network fixture,
- source navigation fixture,
- GoldenLayout fixture.

Acceptance:

- presentation and release readiness no longer depend only on manual observation.

### 16. Packaging And `.exe`

Deliver only after governance stabilizes:

- pre-`.exe` checklist,
- local restart/reopen tests,
- export tests,
- data agreement,
- runtime config,
- package build.

Acceptance:

- the packaged app demonstrates VAA1's actual promise rather than packaging current instability.

## Immediate Next Session Recommendation

Start with a presentation-safe hardening pass:

1. Manually smoke-test the latest BBox governance in the Bond trailer.
2. If BBox bleed persists, inspect persisted correction ids and annotation correction payloads directly.
3. Add a targeted rendered fixture for the exact James Bond / Felix Leiter failure mode.
4. Confirm Meaning Network source navigation does not fake frame zero or source-less graph jumps.
5. Decide whether to push the current changes before further feature work.

Then resume the larger sprint in this order:

1. Data maturity proliferation.
2. BBox/ROI rendered governance proof.
3. Meaning Network full-panel workspace and source navigation.
4. Narrative Agent card / Master Schema feedback loop.
5. Playwright fixture coverage.

## Fresh Thread Opening Prompt

Suggested prompt for the next thread:

```text
Continue from docs/working_handover_handout_2026-05-27_X.md.

Priority: presentation-safe VAA1 governance. First verify the BBox/ROI regime after the scoped annotation-id and time-boundary fix. Then continue the Data Maturity Proliferation regime. Preserve the principle that manual confirmation wins within its governed time/geometry/apply-scope, raw detections never override mature data, and every active claim must remain source-linked, navigable, maturity-aware, and traceable.
```
