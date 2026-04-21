# VAA1 working handover handout

## Date
- 2026-04-03
- updated 2026-04-03 EEST

## Checkpoint label
- `O`

## Reference base
- latest stable working checkpoints now relevant to this stage:
  - `docs/working_handover_handout_2026-04-02_N.md`
  - commit `b08ff78`
  - commit `6905c1f`
  - commit `15331bb`

## Working goal reached in this checkpoint
- the current sprint advanced from matrix and morphology work into a first real `Visual cues` workflow
- a broader under-the-bonnet visual cue kit was built for checking and confirmation work
- `Tools` and `Video` were reorganized so `Visual cues` can be opened from `Tools`, inspected in `Video`, and cleared again cleanly
- a methodological working note was added to document `constellational support` as a candidate program-wide design principle

## Major results from this sprint

### 1. Quant and POS matrix work was protected
Earlier local matrix work was safely committed and pushed.

Protected commit:
- `6905c1f` `Add analyst-focused quant and POS matrix workflows`

This means:
- `Quant Matrix` improvements are no longer only local
- `POS Matrix` improvements are no longer only local

### 2. Morphology exchange and project-side analysis launch were protected
The morphology exchange flow and the move from `Engage` toward `Analyze` in the project-side workflow were safely committed and pushed.

Protected commit:
- `b08ff78` `Add morphology exchange flow and move analysis launch to project panel`

### 3. First visual cue kit delivered
The following under-the-bonnet cue set now exists in the current workspace:

- `Shot size`
- `Frame class`
- `Spatial scan`
- `Text/graphic`
- `Human presence`
- `Margin scan`
- `Corner scan`
- `Depth scan`
- `Lighting`
- `Color regime`
- `Visual clutter`
- `Motion scan`
- `Transition scan`
- `Tone scan`

Important status:
- these cues are operational enough for checking
- they are not yet mature enough to be treated as strong final interpretive claims
- several of them clearly need calibration and review

### 4. Visual cues workflow reorganized
The workflow now behaves more coherently:

- `Tools -> Visual cues` opens a dedicated `Visual cues` workspace
- the `ToolsPanel` acts more like a utility workspace and less like a permanent stacked leaf
- cue selection in `ToolsPanel` opens the relevant cue in `Video`
- the `Video` panel no longer carries the full cue strip permanently in its mainframe
- leaving the `Visual cues` workspace clears the active cue from `Video`

Protected commit:
- `15331bb` `Add visual cues workflow and constellational support note`

### 5. Method note added
A project note was added:

- `docs/Academic foundations for the method article, by Petteri Laine.md`

This note records the current methodological direction:
- `constellational support`
- Whiteheadian process philosophy alignment
- Bhaskarian critical realism alignment
- caution against treating single cues as self-sufficient truth

## Key diagnosis reached in this checkpoint

### Visual cues diagnosis
The cue kit is useful, but it is not yet trustworthy enough to stand as finished detection logic.

Important result:
- the cue layer should remain provisional
- cue outputs should be checked through feedback and calibration
- stronger claims should not be made from isolated cues alone

### Method diagnosis
The working concept of simple `triangulation` now seems too narrow.

Current stronger working concept:
- `constellational support`

Reason:
- support is not limited to three constituents
- relation among supports matters, not only count
- even relatively simple detections appear to need multi-functionary support to become truly meaningful

## What now works well enough to keep
- matrix improvements already pushed
- morphology exchange flow already pushed
- `Analyze` moved toward the project-side flow
- `Visual cues` workspace in `Tools`
- cue opening from `Tools` into `Video`
- cue clearing when leaving `Visual cues`
- academic method note recorded in docs

## What should not be overclaimed yet
- `Shot size` as reliable cinematic truth
- `Frame class` as a settled classification layer
- motion/transition/light/color cues as calibrated final indicators
- any strong multimodal claim based on a single cue or single functionary

## Remaining open issues to carry forward
- `Visual cues` need a dedicated check-up and calibration session
- cue thresholds and category boundaries still need refinement
- `Cinematic visual clues v1` has not yet been formally built as a higher layer above the cues
- manual annotation data model remains pending
- CVAT round-trip design and implementation remain pending
- `constellational support` still needs operational rules for:
  - support thresholds
  - UI wording
  - confidence logic
  - fallback behavior
- frontend type-checking still contains unrelated pre-existing warnings outside this slice

## Recommended next order of work
1. define `Cinematic visual clues v1` as a layer above the cue kit
2. use the existing cue kit as substrate rather than forcing stronger labels too early
3. run a dedicated calibration session for the current cues
4. translate `constellational support` into practical implementation rules
5. then proceed to manual annotation and CVAT work

## Resume steps
1. start backend from the main project folder:
   - `conda run -n vaa1_core python -u api_server.py`
2. start frontend from `src/frontend`:
   - `npm run dev -- --webpack`
3. hard refresh the browser with `Cmd + Shift + R`
4. verify:
   - `Tools -> Visual cues` opens correctly
   - selecting a cue opens it in `Video`
   - leaving `Visual cues` clears the active cue in `Video`
5. open the current method note:
   - `docs/Academic foundations for the method article, by Petteri Laine.md`

## Main files changed in this stage
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/app/V2components/components/panels/ToolsPanel.tsx`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `docs/Academic foundations for the method article, by Petteri Laine.md`

## Commits relevant to this stage
- `15331bb` `Add visual cues workflow and constellational support note`
- `6905c1f` `Add analyst-focused quant and POS matrix workflows`
- `b08ff78` `Add morphology exchange flow and move analysis launch to project panel`

## Bundle intent
- this checkpoint preserves the current post-matrix, post-morphology, first-visual-cues workflow state
- it is intended as a safe restart base before cinematic clue construction, cue calibration, and the remaining sprint blocks
