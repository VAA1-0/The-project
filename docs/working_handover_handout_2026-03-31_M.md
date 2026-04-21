# VAA1 working handover handout

## Date
- 2026-03-31
- updated 2026-03-31 21:38:07 EEST

## Checkpoint label
- `M`

## Working goal reached in this checkpoint
- the first serious `Audio` package was delivered as a working multimodal layer instead of remaining transcript support only
- `Audio` was made visible in both:
  - `Speech to Text`
  - `Time Bank`
  - `Window -> Audio`
- video overlay behavior for `Objects / OCR / Expressions` was stabilized into a much calmer and more honest baseline
- the major first-pass / second-pass visual chaos problem was materially reduced by fixing timing, state, and overlay-trust issues rather than only tuning detection thresholds
- OCR behavior was tightened enough to become more readable, while also revealing that OCR quality is strongly source-dependent and still needs a dedicated follow-up calibration pass

## Major results from this sprint

### 1. Audio package delivered
The following audio indicators now exist and are timestamp-linked:
- pace
- pauses
- emphasis
- pitch-energy contour
- turn structure
- overlap cue
- role-support cue
- rhythm profile
- tonality profile
- sound-environment cue

Working surfaces:
- `Speech to Text`
- `Time Bank`
- `Window -> Audio`

Important result:
- audio now behaves as a proper modality, not just transcript scaffolding
- the audio package supports:
  - `full`
  - `audio only`
  - `Quick sweep`

### 2. Video overlays stabilized
The most important trust repair from this checkpoint was visual stabilization.

Observed pattern:
- first-play overlays were chaotic
- second-play overlays often became calm and accurate
- this indicated timing/state problems, not only model problems

Fix direction that helped:
- frame-readiness gating
- use of rendered-frame timing via `requestVideoFrameCallback`
- stricter source-switch load hygiene in `VideoPanel`
- reduction of proxy/blended overlay logic
- more skeptical object surfacing in `Science scan`

Outcome:
- `Objects` now behave calmly enough to function as a serious baseline
- `Expressions` also held together under combined use
- `OBJ + OCR + EXPR` together no longer produced drift/flicker chaos in the same way

Important caveat:
- some weak background detections are now suppressed
- this is acceptable for `Science scan`
- if a fleeting/background target matters, it belongs to:
  - later manual correction
  - or `Forensic sensor`

### 3. OCR is improved, but not solved
OCR showed a clear split:
- one tested Finnish news source produced very strong OCR
- two other tested sources produced many false fragments and near-duplicate spellings, despite occasional true positives

This tells us:
- OCR capability exists
- the problem is calibration, context sensitivity, and confirmation logic
- not total OCR incapacity

Current improvements made:
- OCR backend no longer relies on one brittle threshold pass only
- OCR `Video` overlay now favors likely graphics and suppresses scene-gibberish better
- OCR panel now:
  - filters obvious garbage
  - reduces raw flooding
  - groups repeated strings more usefully
  - begins fuzzy canonicalization of near-duplicate readings

Still unresolved:
- repeated brand/logo variants should later collapse into metadata-confirmed canonical forms
- broadcast graphics and scene text probably need different OCR handling policies

## Key diagnosis reached in this checkpoint

### Visual issue hierarchy
The most plausible ordering became:
1. frame queue / backlog and playback-state issues
2. wrong-frame overlay alignment
3. tracker/load-state not resetting cleanly on first pass or after source switch
4. thresholds and overlay permissiveness
5. only after those: model weakness

This hierarchy was productive.

### OCR issue hierarchy
OCR should now be treated as:
- condition-sensitive
- context-sensitive
- in need of confirmation and canonicalization

Not as:
- one uniformly broken detector

## Important product decisions reinforced here
- better silence than false visual precision
- `Science scan` should imitate a human-noticeable detection rhythm rather than instant but ghostly overreach
- fleeting passersby or micro-presence belong more to `Forensic sensor`
- scene/environment cues such as:
  - cityscape
  - jungle / canopy
  - aerial footage
  - skyline
  should not be forced through the current object layer
- a dedicated scene/environment modality is still the right later answer

## What now works well enough to keep
- `Audio` as a first-class modality
- `Time Bank Audio`
- `Window -> Audio`
- calm object overlays in `Science scan`
- expressions as a coordinated overlay layer
- combined `OBJ + OCR + EXPR` testing without the old drift/flicker collapse

## What should not be overclaimed yet
- OCR truth on visually noisy or stylistically difficult sources
- scene/environment recognition through the current object detector
- stable role/character detection from current signals alone
- demographic or identity certainty beyond cautious triangulation

## Remaining open issues to carry forward
- OCR still needs:
  - source-sensitive calibration
  - graphics-vs-scene-text policy separation
  - metadata-assisted confirmation / canonicalization
- scene/environment detection remains missing as its own layer
- role detection still needs cleaner triangulation across:
  - person continuity
  - face support
  - transcript
  - audio structure
  - later correction layer
- annotation correction regime is still the next major structured feature block

## Recommended next order of work
1. begin the annotation specs / correction regime
2. define raw vs corrected annotation structure
3. preserve timestamp anchoring and provenance throughout
4. only after that, return to:
  - CVAT integration
  - OCR confirmation logic
  - scene/environment layer

## Resume steps
1. start backend in `vaa1_core`
2. open VAA1 in the browser
3. hard refresh with `Cmd + Shift + R`
4. if rechecking current state:
  - test `Objects`
  - test `Expressions`
  - test `OCR`
  - test all three together
5. if continuing planned work:
  - start the annotation specs / correction regime first

## Backend start command
```bash
source ~/opt/anaconda3/etc/profile.d/conda.sh
conda activate vaa1_core
python3 -u api_server.py
```

## Main files changed in this stage
- `api_server.py`
- `docs/bugfixlist_2026-03-25.md`
- `docs/vaa1_stabilization_workplan_2026-03-30.md`
- `docs/working_handover_handout_2026-03-31_M.md`
- `src/backend/analysis/audio_prosody.py`
- `src/backend/analysis/evidence_linker.py`
- `src/backend/analysis/pipeline_video_frames.py`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/panels/OCRPanel.tsx`
- `src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx`
- `src/frontend/app/V2components/components/panels/SourceMediaMetadataPanel.tsx`
- `src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx`
- `src/frontend/app/V2components/components/panels/TimeBankPanel.tsx`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/lib/config.ts`
- `src/frontend/lib/video-service.ts`

## Bundle intent
- this checkpoint preserves the point where:
  - audio became a serious modality
  - visual overlays became calm enough to trust again
  - OCR moved from chaos toward controlled calibration
- it should be used as the restart base before the next major block:
  - annotation specs and correction regime
