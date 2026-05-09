# VAA1 Working Handover Handout

Date: 2026-04-30  
Branch: `petteri`  
Latest pushed commit: `ee69cbc1999408d53d075c6295a374b9cf7430df`  
Commit title: `feat: surface second-order meaning and plot evidence`

## 1. Current Working Status

The repository is clean and synced with GitHub on `origin/petteri`.

The latest delivery pushed a first working version of the second-order meaning and plot
surfacing layer. This builds on the SFL + Dependency Parsing indicative layer and connects
its outputs into VAA1's evidence/navigation/annotation environment.

The key practical result is:

- second-order meaning candidates can be generated as governed artifacts
- label proliferation plans can be exposed to the frontend
- Meaning / Plot has a dedicated navigable panel
- Time Bank can surface meaning events
- BBox/ROI and panel surfaces can show second-order affirmation chips
- manual correction remains authoritative over automated and derived detections
- derived interpretation remains traceable back to source evidence

## 2. Latest Pushed Delivery

The pushed commit changed 19 files, with 2831 insertions and 31 deletions.

Main files changed:

- `api_server.py`
- `src/backend/analysis/multimodal_meaning_stage1.py`
- `src/backend/analysis/second_order_label_proliferation.py`
- `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`
- `src/frontend/app/V2components/components/panels/TimeBankPanel.tsx`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/lib/api-service.ts`
- `src/frontend/lib/config.ts`
- `src/frontend/styles/globals.css`
- `src/frontend/tests/manual-annotation-governance.test.mjs`
- `tests/test_multimodal_meaning_stage1_contract.py`
- `tests/test_second_order_label_proliferation_contract.py`
- `tests/test_second_order_pipeline_wiring_contract.py`
- `docs/vaa1_functionality_delivery_audit_2026-04-30.md`
- `docs/vaa1_sfl_dependency_indicative_layer_development_note_2026-04-29.md`
- `BBOX_ROIbox_BUG_FIX_REPORT.doc`

## 3. Verification Completed Before Push

The following checks passed before the commit was pushed:

- `python3 -m py_compile api_server.py src/backend/analysis/multimodal_meaning_stage1.py src/backend/analysis/second_order_label_proliferation.py`
- `python3 tests/test_multimodal_meaning_stage1_contract.py`
- `python3 tests/test_second_order_label_proliferation_contract.py`
- `python3 tests/test_second_order_pipeline_wiring_contract.py`
- `node --test tests/manual-annotation-governance.test.mjs` from `src/frontend`
- `npx tsc --noEmit` from `src/frontend`

The frontend governance test passed 19/19.

## 4. Actual Code Map

This is the practical map of where the latest delivered behavior lives.

### 4.1 Backend Orchestration

Primary file:

- `api_server.py`

What was added or extended:

- status completion/backfill now writes second-order meaning artifacts
- status/download paths expose the new artifacts
- analysis status can carry:
  - `dependency_sfl_stage1`
  - `multimodal_meaning_stage1`
  - `second_order_label_proliferation`
- backend helpers now assemble visual, cinematic, transcript, audio, genre, culture, and
  metadata context for the meaning layer

Important helper/function family:

- `write_second_order_meaning_artifacts_for_status(...)`
- `resolve_transcript_for_meaning(...)`
- `resolve_audio_prosody_for_meaning(...)`
- `build_visual_cues_for_meaning(...)`
- `build_cinematic_clues_for_meaning(...)`
- `build_meaning_genre_profile(...)`
- `build_meaning_culture_context(...)`
- `iter_detection_items(...)`

### 4.2 SFL / Dependency / Meaning Backend

Primary files:

- `src/backend/analysis/multimodal_meaning_stage1.py`
- `src/backend/analysis/second_order_label_proliferation.py`

`multimodal_meaning_stage1.py` now contains the first substantial indicative pattern packs:

- speech act / power
- affiliation / care
- intimacy / commitment
- judgment / denigration
- narration / commentary
- plot function

It can produce candidate feature events such as:

- `affiliation_care`
- `intimacy_commitment`
- `judgment_denigration`
- `plot_function`

`plot_function` includes alternate plot lenses:

- Aristotle
- Freytag
- Campbell
- Frye
- Booker

`second_order_label_proliferation.py` turns meaning events into governed label instructions.

Current target families include:

- Identification
- Interaction
- Action
- Role
- Scene
- Episode
- Relationship
- Intensity
- ReportClaim

The important contract is:

- generated labels are candidates or affirmations
- open weights are exposed
- source evidence is preserved
- manual correction and manual annotation remain authoritative
- analyst confirmation is not required for every candidate

### 4.3 Frontend API and Data Normalization

Primary files:

- `src/frontend/lib/api-service.ts`
- `src/frontend/lib/config.ts`
- `src/frontend/lib/video-service.ts`

Current delivered role:

- frontend types include second-order proliferation structures
- frontend download/config paths include new meaning artifacts
- `video-service.ts` carries backend `second_order_label_proliferation` into `AnalysisData`

Key frontend field:

- `analysisData.secondOrderLabelProliferation`

### 4.4 Meaning / Plot UI

Primary file:

- `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`

Registered through:

- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/MenuBar.tsx`

Current delivered behavior:

- panel is available as `MeaningPlot`
- panel reads second-order label proliferation candidates
- candidates are intended to remain navigable to source evidence
- plot lens tabs are present for Aristotle, Freytag, Campbell, Frye, and Booker
- current state may still show empty candidates until artifacts exist or are backfilled for the
  selected analysis

### 4.5 Time Bank Meaning Surfacing

Primary file:

- `src/frontend/app/V2components/components/panels/TimeBankPanel.tsx`

Current delivered behavior:

- Time Bank has a meaning event path
- meaning events are derived from `analysisData.secondOrderLabelProliferation?.instructions`
- the meaning column participates in the side-by-side comparison layout

Manual validation still needed:

- confirm meaning column populates on analyses with generated second-order artifacts
- confirm source navigation behaves correctly from meaning items

### 4.6 BBox / ROI Integration

Primary file:

- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`

Current delivered behavior:

- BBox/ROI editor surfaces `SecondOrderLabelAffirmationChips`
- chips use `surface="bbox_roi_overlay"`
- locked forensic ROI overlays are scoped by:
  - `videoId`
  - `time`
  - `box`
- visible locked ROI is resolved through `visibleLockedForensicRoiBox`
- stale ROI overlays should not render globally across unrelated videos/timestamps

Important types/state:

- `type LockedForensicRoi`
- `lockedForensicRoiBox`
- `visibleLockedForensicRoiBox`

### 4.7 Shared Second-Order UI Component

Primary file:

- `src/frontend/app/V2components/components/panels/SecondOrderLabelAffirmations.tsx`

Current delivered behavior:

- renders governed second-order affirmation chips
- supports surfaces such as:
  - `bbox_roi_overlay`
  - `objects_panel`
  - `master_schema`
  - `meaning_panel`
  - `printout`
- preserves the no-confirmation-tax governance note
- reminds that manual override remains available

### 4.8 Layout and Visual Noise Cleanup

Primary file:

- `src/frontend/styles/globals.css`

Current delivered behavior:

- GoldenLayout leaf tabs are constrained to one compact row
- long panel labels should truncate rather than bleed into second-row layout clutter

### 4.9 Contract Tests

Primary files:

- `tests/test_multimodal_meaning_stage1_contract.py`
- `tests/test_second_order_label_proliferation_contract.py`
- `tests/test_second_order_pipeline_wiring_contract.py`
- `src/frontend/tests/manual-annotation-governance.test.mjs`

What they protect:

- meaning pattern event generation
- plot/narrative lens presence
- second-order label proliferation contract
- backend wiring for generated artifacts
- frontend API/data exposure
- BBox/ROI scoped overlay behavior
- second-order affirmation chips on expected UI surfaces
- Meaning / Plot panel registration
- compact GoldenLayout tabs

## 5. Evidence Governance State

The active architecture rule remains:

> Manual correction > manual annotation > grouped detection > raw detection.

The implementation direction is no longer "BBox timing bug." It is:

> Evidence navigation and authority model failure across linked timestamped annotations.

The governing evidence rule:

- VAA1 treats annotations, detections, corrections, BBoxes, ROI boxes, panel rows, and video
  overlays as linked timestamped evidence objects.
- Every evidence object must remain navigable from every associated view.
- Manual correction is authoritative over automated detection while preserving original
  detection as provenance and traceback.
- When one associated view activates an evidence object, all other associated views must
  synchronize to the same resolved evidence state.

## 6. BBox / ROI Status

Root readiness has been established for the BBox/ROI workflow, but the implementation is still
primal.

Operational:

- manual annotation save/close synchronization between Master Schema leaf panels and the
  Video panel is working
- timestamped geometry keyframes are protected by contract tests
- BBox/ROI editor can save timestamped analyst geometry
- locked forensic ROI overlays are now scoped by video id and timestamp before rendering
- stale ROI overlays should no longer dominate unrelated videos
- second-order label affirmation chips now surface in the BBox/ROI editor

Still needing manual evaluation:

- analyst ergonomics for fast temporal drawing
- whether the "single fast gesture" framing workflow is good enough
- whether the slider interaction feels direct enough for real analyst use
- whether cross-cut/cross-sequence geometry keyframes remain stable in a demanding manual case
- whether mouse wheel or right-click affordances should be added for faster BBox/ROI navigation

Known design target:

> Extend in/out should not be treated as the feature. The analyst need is fast temporal area
> framing: open detection, widen available time, draw the actual in/out area, label it, save it,
> and close it.

## 7. SFL + Dependency Parsing Status

The SFL + Dependency layer should be framed as:

> A low-compute but substantial indicative meaning layer.

It is not just a cheap first pass. It is intended to help VAA1 produce traceable candidates for:

- action
- role
- interaction
- scene
- episode
- plot function
- affect
- judgment
- affiliation
- care/compassion/empathy
- report-writing claims

Current first-iteration pattern packs include:

- speech act / power
- affiliation / care
- intimacy / commitment
- judgment / denigration
- narration / commentary
- plot function

Plot lenses included in the first iteration:

- Aristotle
- Freytag
- Campbell
- Frye
- Booker

The core principle:

- SFL/dependency output may seed candidates and proliferated labels
- it must never override manual corrections or manual annotation
- all derived interpretation must preserve source evidence and traceback
- open weights must remain visible
- analyst confirmation must be available, but VAA1 must not demand confirmation at every corner

## 8. Second-Order Meaning and Label Proliferation

The current second-order layer is designed to turn low-compute meaning signals into governed,
traceable label suggestions.

Current surfaces:

- Meaning / Plot panel
- Time Bank meaning column
- BBox/ROI affirmation chips
- Objects panel affirmation chips
- Master Schema batch review tray
- API/download artifact support

Current artifact:

- `second_order_label_proliferation`

Current design:

- candidates can surface as affirmations
- manual override remains authoritative
- immediate analyst confirmation is not required for every candidate
- high-value candidates can be strengthened iteratively
- label proliferation should eventually support Identification, Interaction, Action, Role,
  Scene, Episode, Relationship, Intensity, and report-writing pathways

Related 2026-05-03 proliferation intelligence notes:

- `docs/vaa1_closest_match_evidence_proliferation_note_2026-05-03.md`
- `docs/vaa1_detection_annotation_proliferation_intelligence_schema_note_2026-05-03.md`

## 9. Meaning / Plot Panel Status

The Meaning / Plot panel is delivered as a first navigable UI.

It is intended to surface second-order paths such as:

- plot path
- character path
- Aristotle view
- Freytag view
- Campbell view
- Frye view
- Booker view

Current limitation:

- meaningful manual/browser validation is still needed to confirm that real analysis records
  show satisfying content rather than empty state
- older analysis records may need artifact backfill before the panel becomes useful
- UI density and visual clarity should be improved after real data is confirmed

## 10. Time Bank Status

Time Bank is operational and now has a meaning-events path.

It currently supports side-by-side evidence comparison and can include:

- transcript evidence
- audio evidence
- meaning evidence

Current limitation:

- meaning events need manual/browser validation on analyses with generated
  `second_order_label_proliferation` artifacts
- current layout may need adjustment for long labels and compact analyst scanning

## 11. Forensic Render Status

Forensic render has a backend and Tools workflow foundation.

Current direction:

- selected spans can become forensic jobs
- forensic derivative evidence should preserve adopted context
- forensic outputs should remain traceable to source media and source evidence
- future UI should include navigable traceback tree/network visualization

Still needed:

- track vs occurrence selection in the BBox/ROI workflow
- ability to attach a track detection to a pre-existing track
- episodic/nonlinear story-world support
- visual traceback UI for source navigation
- stronger manual testing across real forensic render jobs

## 12. Traceback Tool Status

Traceback is architecturally important and partially supported.

Current direction:

- all interpretations should trace back to earliest available detections
- forensic render jobs should expose traceback records
- derived labels should preserve source evidence ids and timestamp spans

Still needed:

- dedicated navigable traceback panel
- evidence tree/network visualization
- source jump behavior from every node
- evidence relationship types, such as derived-from, supersedes, supports, contradicts,
  attached-to-track, and analyst-corrected-from

## 13. Audio Detection and Sample Cloud Status

Audio support has moved beyond transcript/prosody into first working identity support.

Current artifacts:

- `audio_prosody`
- `audio_sample_clouds`
- `identity_triangulation`

Current direction:

- establish sample arrays for character/speaker reference
- triangulate metadata, audio recognition, visual identification, and manual annotation
- allow confirmed identity to proliferate into related labels

Still needed:

- UI for audio sample cloud review
- speaker sample promotion workflow
- reference voice matching UX
- link speaker identity into Interaction, Action, Role, Scene, and report-writing labels
- dependency/SFL support before serious proliferation testing

## 14. Open Weight and Analyst Workload Policy

VAA1 should save analysts from endless repetitive confirmation tasks.

The working policy:

- pattern-level recognition can be sufficient evidence at candidate level
- open weights must remain visible
- analyst corrections scale across related candidate families
- external LLM labeling/check-up may assist, but cannot become hidden authority
- analyst confirmation should be reserved for high-value, uncertain, contested, or report-bound
  candidates

This means VAA1 should surface governed affirmations at scale, not constantly interrupt the
analyst.

## 15. Current Local Workspace Condition

After the push:

- repository is clean
- branch is synced to `origin/petteri`
- generated local caches were cleaned
- `src/frontend/.next` was removed
- old noisy terminals should be killed/reopened fresh in VS Code

Known repository oddity:

- `src/__pycache__` contains tracked `.pyc` files
- they were restored to keep Git clean
- later cleanup should remove them properly in a deliberate commit and add/confirm ignore rules

## 16. Suggested Next Session Startup

1. Open fresh VS Code terminals only.
2. Confirm Git state:

```bash
git status --short --branch
```

3. Start VAA1 with the current Mac launcher:

```bash
cd "/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project"
bash scripts/start_vaa1_macos.sh
```

4. If packages or ports are stale, use the repair path:

```bash
bash scripts/start_vaa1_macos.sh --setup-envs --replace
```

5. Validate health/status:

```bash
curl http://127.0.0.1:8000/api/health
curl -fsS http://127.0.0.1:8000/openapi.json | grep '/api/analysis/{analysis_id}/proliferation/match'
```

Note: the backend should start from `vaa1_core`, not `.venv`. The current canonical runbook is
`docs/vaa1_macos_startup_runbook_2026-05-03.md`.

## 17. Recommended Next Manual Tests

Run these in a controlled order.

### Test 1: Meaning / Plot artifact surfacing

- open an analysis with transcript/audio/objects
- confirm status contains `multimodal_meaning_stage1`
- confirm status contains `second_order_label_proliferation`
- open Meaning / Plot panel
- confirm candidates appear
- click a candidate and verify the video jumps to source evidence time

### Test 2: Time Bank meaning events

- open Time Bank
- confirm Meaning column populates
- click meaning event
- confirm navigation to source time
- compare with transcript/audio evidence side-by-side

### Test 3: BBox/ROI second-order chips

- open object/manual BBox editor
- confirm second-order affirmation chips appear only when matching candidates exist
- confirm chips do not demand confirmation
- confirm manual correction still overrides everything

### Test 4: ROI overlay isolation

- create or load an ROI on one video/timestamp
- switch video or scrub away
- confirm ROI does not remain globally visible
- return to source time/video and confirm correct visibility

### Test 5: BBox/ROI temporal framing

- open detection
- widen available time
- draw actual in/out span
- adjust geometry across timestamps
- save
- reopen
- confirm timestamp/coordinate regime holds

## 18. Priority Next Development Items

Highest value next:

- ensure Meaning / Plot and Time Bank meaning populate reliably from current and older analyses
- add explicit artifact backfill trigger if needed
- improve visual style for meaning/plot paths
- build traceback tree/network panel design
- add audio sample cloud review UI
- remove tracked `src/__pycache__` files properly

Important but later:

- richer plot visualization across Aristotle/Freytag/Campbell/Frye/Booker
- agentic/LLM review pass for second-order labels
- mass preview/approval tray for label proliferation
- closest-match proliferation mitigation for scene changes, costume/location shifts, action
  scenes, and split-screen duplicate appearances; see
  `docs/vaa1_closest_match_evidence_proliferation_note_2026-05-03.md`
- mouse wheel/right-click BBox/ROI speed affordances
- stronger forensic render manual validation
- automated metadata scraper for web sources such as IMSDb, Wikipedia, and comparable public
  reference sites
- web page comparison tool for comparing how different institutions cover similar issues
- reporting tool that turns VAA1 analysis, evidence, uncertainty, and analyst corrections into a
  coherent report
- LLM API integration for assisted labeling, check-up, report drafting, and governed
  interpretation support

## 19. Bottom Line

VAA1 is now beyond raw detection surfacing. The current pushed state begins to connect
detections, annotations, SFL/dependency signals, meaning candidates, plot structure, and label
proliferation into one governed evidence environment.

The next work should focus on actuality:

- make generated meaning artifacts reliably appear
- make every surfaced candidate navigable to source
- keep manual correction authoritative
- reduce analyst confirmation burden
- turn the documented meaning/plot architecture into visible, testable UI behavior
