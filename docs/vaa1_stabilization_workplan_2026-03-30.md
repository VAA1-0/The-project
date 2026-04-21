# VAA1 stabilization workplan

## Date
- 2026-03-30

## Purpose
- move VAA1 from feature accumulation into a stabilization phase
- improve trust, persistence, correction capability, and production readiness in a disciplined order
- avoid further UI-only patching where backend structure is the real constraint
- keep early priority on the features that benefit most from automation and reduce repetitive analyst labor

## Working principle
Every new change in this phase should answer all four questions:
- does it improve trust?
- does it persist?
- does it preserve provenance?
- does it fit the timestamp backbone / Time Bank?

## Analyst-support doctrine
- VAA1 should automate as much groundwork as possible without pretending to be the analyst
- the system should be strongest at:
  - evidence harvesting
  - timestamp anchoring
  - multimodal linking
  - draft cue generation
  - correction-ready structuring
- the analyst should remain strongest at:
  - correction
  - interpretation
  - theory-driven annotation
  - comparative judgment
  - final analytical claims

## Recommended order

## Planned sweep tiers

### 1. Exploratory sweep
Working character:
- super fast
- broad radar for corpus scouting
- sparse enough to support early-stage multimodal research without forcing a full image sweep

Trekkie nuance:
- `Long-range sensor sweep`

Likely profile direction:
- transcript and coarse anchor generation remain mandatory
- current locked-in interim definition:
  - transcript-led
  - POS / Quant remain navigable
  - no OBJ / OCR / EXPR by default
  - no demographic hints by default
- designed for orientation, not exhaustive evidentiary claims
- future direction:
  - restore only lightweight scene-level or thematic visual cues when runtime economics and model quality support it
  - examples include indicative readings such as group interview, city scene, classroom context, shoreline, studio, or parliament-like setting

### 2. Science grade
Working character:
- dynamic and feasible
- the main research-grade multimodal working mode
- intended to cover most serious analytical needs without forensic cost

Trekkie nuance:
- `Science scan`

Likely profile direction:
- approximately 1-second sampling for major visual modalities
- strong enough for comparison, triangulation, and sustained interpretive work
- calmer and faster than full-frame sweeps
- future escalation principle:
  - allow a short-range forensic pass inside `Science scan` for a selected passage only
  - examples:
    - current cue
    - selected transcript span
    - `Mark A` to `Mark B`
  - this should avoid forcing whole-video forensic reruns when only one local passage needs high-resolution review

### 3. Forensic mode
Working character:
- as good as it gets
- dense temporal resolution
- suited for micro gestures, frame-near review, and high-resolution evidentiary work

Trekkie nuance:
- `Forensic sensor lock`

Likely profile direction:
- sub-second or full-FPS sampling where justified
- preserves nuanced records for micro-expressions and other fine-grained visual changes
- should be explicitly heavier and slower, not silently used as the default
- should later support localized derived outputs that remain:
  - timestamp-linked
  - passage-scoped
  - provenance-marked as higher-resolution reanalysis
### 1. Backend-driven detection quality
Goal:
- move object quality improvements out of frontend grouping heuristics and into backend output generation

Why first:
- visual detections are the most visible trust signal in the product
- correction tools are much more useful once detections are calmer and more stable

Current reality:
- `src/backend/analysis/pipeline_video_frames.py` emits raw frame-by-frame YOLO detections only
- `src/frontend/lib/video-service.ts` currently groups detections for display with `groupDetectedObjectsForDisplay(...)`
- this means object stability is still presentational, not architectural

Required outcomes:
- keep raw detections for auditability
- add tracked / grouped backend object entities
- improve bbox selection so current playback uses the nearest relevant sample
- reduce duplicate detections in crowded scenes
- make Time Bank and overlays draw from backend-improved entities by default

Sprint targets:
1. add backend grouped/tracked object export beside raw YOLO CSV
2. expose those tracked entities through status/results
3. switch overlays, object lists, and Time Bank objects to prefer backend-tracked entities

### 2. Manual correction layer
Goal:
- allow analyst correction of wrong detections and transcript issues without destroying provenance

Why second:
- after detection quality is calmer, correction becomes high-value rather than cleanup of noise floods

Scope:
- objects first
- transcript second
- OCR after that

Required behavior:
- raw output remains visible and stored
- corrected output is stored as an explicit analyst override
- correction is tied to:
  - source media
  - time anchor
  - object/segment id
  - raw value
  - corrected value
  - optional note

Recommended UI shape:
- dropdown of likely values
- manual input field when needed
- optional comment

### 2c. Audio package priority
Goal:
- add a strong, timestamp-linked audio package early because it is a clear low-hanging fruit for multimodal strengthening

First deliverables:
- speaker-change or turn-structure cues
- speech overlap
- pace / pause / emphasis indicators
- sound-environment detection
- cautious role hints such as anchor, reporter, interviewee, or narrator

Why early:
- audio adds analytical value quickly
- audio is often cheaper than dense visual processing
- audio strengthens transcript, demographics triangulation, and later narrative analysis

### 2b. Audio-supported demographic triangulation
Goal:
- let timestamp-aligned audio act as a supporting signal for person-track interpretation without overstating certainty

Working rule:
- audio does not prove demographics on its own
- audio can confirm that a person track overlaps with speech and later support a fused demographic hint when paired with face, transcript, and time anchor evidence

First deliverable:
- mark person tracks with speech-overlap support based on transcript timestamps
- keep this visible as a triangulation aid, not a demographic verdict

Later deliverable:
- add speaker-aware fusion once diarization or speaker-structure tooling exists
- expose low / moderate / strong confidence for fused demographic hints

### 3. Autosave and recovery
Goal:
- make active work resilient before more analyst labor accumulates

Why here:
- once corrections exist, losing unsaved state becomes much more expensive

Scope:
- autosave current analysis working state
- autosave project state
- autosave matrix state
- autosave Time Bank state
- crash/reopen recovery

Implementation principle:
- local quick autosave is acceptable first
- backend-backed autosave should follow for real production robustness

### 4. Configuration audit
Goal:
- find which lenses are under-configured, under-tuned, or not yet using the strongest available settings

Audit targets:
- Objects
- OCR
- Expressions
- POS
- Quant
- language support / fallbacks
- confidence thresholds
- sampling rates
- model selection

Deliverable:
- one explicit configuration readiness report
- one change list separating:
  - misconfiguration
  - feature gaps
  - acceptable fallback behavior

Immediate OCR note from current stabilization:
- OCR quality is asymmetric across sources:
  - one news source currently yields strong OCR
  - two other tested sources yield many false or fragmented OCR readings despite occasional true positives
- this suggests OCR is condition-sensitive rather than uniformly broken
- next OCR audit should explicitly compare:
  - broadcast graphics / logos / lower-thirds
  - scene text / clothing brands / signage
  - source-specific preprocessing sensitivity
  - metadata-assisted OCR confirmation and canonicalization
- metadata should later be allowed to support OCR confirmation for repeated near-duplicate readings such as broadcaster or programme branding, but raw OCR and confirmed OCR must remain distinguishable

### 5. Production robustness pass
Goal:
- move from “works in a promising way” to “survives real work reliably”

Required areas:
- save/open reliability
- project import/export reliability
- batch-analysis reliability
- health checks
- clearer failure reporting
- environmental verification
- large-corpus smoke testing

### 6. Packaging readiness
Goal:
- package a stabilized analytical system, not a moving prototype

Targets:
- Windows `.exe`
- Mac `.dmg`

Prerequisites:
- detection quality improved
- correction layer exists
- autosave/recovery exists
- configuration audit complete
- production pass complete

## Immediate next sprint

### Sprint A: detection quality backbone
Focus:
- backend grouped/tracked entities
- calmer overlays
- more stable object lists
- Time Bank object quality improvement

Concrete tasks:
1. inspect `FrameAnalysisPipeline` output contract
2. add backend grouped object entity generation
3. keep raw YOLO CSV and add tracked object JSON/CSV
4. wire tracked output through `api_server.py`
5. make frontend prefer backend tracked entities over `groupDetectedObjectsForDisplay(...)`

### Sprint B: correction layer first pass
Focus:
- object correction first

Concrete tasks:
1. define corrected object schema on top of timestamp backbone
2. add storage path for raw vs corrected labels
3. add basic correction UI
4. persist through analysis/project save bundles

### Sprint C: audio package first pass
Focus:
- high-value timestamped audio analytics that strengthen the multimodal whole quickly

Concrete tasks:
1. define audio evidence objects on top of the Time Bank contract
2. add speaker-structure and speech-overlap cues
3. add pace / pause / emphasis indicators
4. add sound-environment labels
5. expose audio outputs in the multimodal package and UI

## Important architecture constraints
- do not erase raw model output
- do not hide provenance
- do not duplicate logic between frontend and backend if one canonical layer can exist
- prefer backend truth and frontend presentation
- keep all new correction and tracking data compatible with Time Bank objects
- runtime economics must now be treated as a first-order architecture concern, especially for visual analysis tiers

## Resume note
If resuming this stabilization phase later, start with:
1. `src/backend/analysis/pipeline_video_frames.py`
2. `api_server.py`
3. `src/frontend/lib/video-service.ts`
4. `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
5. `src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx`
6. `src/frontend/app/V2components/components/panels/TimeBankPanel.tsx`

## Short judgment
- the next correct move is not a new lens
- it is backend detection quality plus correction readiness
- that is the shortest path to a more trustworthy VAA1
