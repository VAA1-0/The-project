# VAA1 multimodal analysis package blueprint

## Date
- 2026-03-26

## Purpose
- define the next structural layer before desktop packaging
- unify VAA1 outputs into one linked multimodal evidence package
- provide a script-ready roadmap for additional analysis modules

## Why this is needed now
- VAA1 already produces multiple useful lenses:
  - transcript
  - OCR
  - objects
  - expressions
  - POS
  - Quant
  - source media metadata
  - matrices
- these outputs are increasingly strong, but they still risk reading as adjacent artifacts instead of one analytical system
- before `.exe` and `.dmg` packaging, VAA1 should be able to export and reopen one coherent multimodal package with linked provenance and timestamps

## Core principle
- every analytic result should be able to answer:
  - what source did this come from
  - when in the source did this happen
  - which modality produced it
  - whether it is raw, inferred, or analyst-corrected
  - what other evidence can triangulate it

## Automation doctrine
- VAA1 should automate the maximum amount of repetitive groundwork it can without pretending to replace the analyst
- the system should prioritize:
  - harvesting evidence
  - anchoring time
  - linking modalities
  - surfacing draft cues
  - preserving provenance
- the analyst should remain strongest in:
  - correction
  - interpretation
  - theory-driven tagging
  - comparative judgment
  - final analytical claims

## User-facing naming
- the timestamped and traceable evidence layer should be presented to users as `Time Bank`
- this allows VAA1 to describe outputs in plain language without losing the stricter backend schema underneath
- likely package-facing labels:
  - `Time Bank Transcript`
  - `Time Bank OCR`
  - `Time Bank Objects`
  - `Time Bank Expressions`

## The multimodal analysis package

### Package intent
- one project-aware, evidence-linked export
- suitable for:
  - single video review
  - multi-video comparison
  - annotation correction
  - later publication, archival, or research reuse

### Package levels
- `analysis bundle`
  - one analysed video and its outputs
- `project bundle`
  - multiple analyses, matrices, project manifest
- `multimodal analysis package`
  - a linked evidence package that can sit inside the project bundle and also be exported independently
- `localized forensic passage package` later
  - a derived high-resolution package for a selected short span inside a longer `Science scan`
  - intended for economical escalation rather than whole-video forensic rerun

### Recommended top-level structure
```text
multimodal_analysis_package/
  package_manifest.json
  project_manifest.json
  analyses/
    <analysis_id>/
      source/
      transcript/
      audio/
      ocr/
      objects/
      expressions/
      language/
      pos/
      quant/
      annotations/
      media_metadata/
      derived/
  matrices/
    quant_matrix.json
    pos_matrix.json
    general_matrix.json
  linked_data/
    evidence_index.json
    evidence_timeline.csv
    provenance_map.json
  notes/
    analyst_notes.json
```

## Shared timestamp and linked-data regime

### Minimum timestamp contract
Every evidence item should support:
- `analysis_id`
- `source_video_id`
- `source_filename`
- `modality`
- `lens`
- `event_id`
- `start_time`
- `end_time`
- `frame_time`
- `frame_index`
- `confidence`
- `support_level`
- `provenance`
- `raw_or_corrected`
- `linked_event_ids`

### Provenance contract
Every item should clearly label whether it is:
- `raw_model_output`
- `derived_inference`
- `analyst_correction`
- `imported_annotation`

### Linked-data contract
Each item should optionally link to:
- transcript segments
- OCR regions
- object tracks
- expression events
- POS cues
- Quant cues
- annotation events
- matrix row references
- later selected-passage forensic reanalysis objects

### Export forms
- `JSON`
  - canonical, full-fidelity
- `CSV`
  - flattened comparison-ready evidence tables
- later `XLSX`
  - presentation/export convenience, not canonical truth

## Required current lenses in the package

### Transcript
- segment text
- timestamps
- language metadata
- confidence where available

### Audio package
- speech segments
- speaker-change or turn-structure cues
- speech overlap cues
- pace / pause / emphasis indicators
- sound-environment indicators:
  - music
  - applause
  - laughter
  - crowd noise
  - traffic
  - silence / room tone
- cautious voice-role hints where possible:
  - anchor
  - reporter
  - interviewee
  - narrator / voice-over
- all audio outputs should stay timestamp-linked and triangulable with transcript, objects, expressions, and later narrative indicators

### OCR
- text
- region bbox
- timestamps
- confidence
- link to frame and source

### Objects
- raw detections
- grouped tracks
- corrected labels later
- bbox data
- timestamps
- confidence

### Expressions
- expression label
- face bbox
- timestamps
- confidence

### POS
- counts
- ratios
- interrogatives
- confidence
- analysis mode
- triangulation readiness

### Quant
- token info
- corpus stats
- TF-IDF
- bigrams
- concordance
- sentence tagging
- later multilingual support metadata matching POS

### Source media metadata
- source filename
- technical media metadata
- editor notes
- provenance notes
- source context

### Matrices
- Quant matrix state
- POS matrix state
- later General Matrix state

## Annotation correction layer

### Principle
- never overwrite the raw output
- corrections must sit as an explicit analyst layer

### Minimum correction schema
- `raw_label`
- `corrected_label`
- `correction_note`
- `corrected_by`
- `corrected_at`
- `source_event_id`
- `timestamp_span`
- `confidence_before`
- `confidence_after` if used later

### Example
- raw object label: `refrigerator`
- corrected label: `doorway`
- note: `door frame at corridor entrance`

## Additional analysis scripts worth building before packaging

These should be treated as script-ready modules that plug into the same timestamp and provenance regime.

### 1. Scene detection
- detect scene boundaries or shot changes
- produce:
  - `scene_id`
  - `start_time`
  - `end_time`
  - representative frame
- why it matters:
  - enables tighter comparison
  - helps track object/role continuity
  - supports timeline navigation

### 2. Modalities detection
- identify which modalities are active at a given span:
  - spoken speech
  - on-screen text
  - music
  - ambient sound
  - face visibility
  - object activity
- why it matters:
  - helps analysis know whether language, visuals, or sound dominate a segment

### 2b. Audio analytics package
- first-instance audio tools should prioritize the clearest low-hanging fruit:
  - speaker structure
  - speech overlap
  - pace / pause / emphasis
  - sound-environment detection
  - cautious role hints
- why it matters:
  - strengthens the whole multimodal package quickly
  - supports correction and triangulation
  - adds a high-value layer without requiring the heaviest visual compute
  - strengthens later multimodal triangulation

### 3. Role detection
- infer role candidates such as:
  - anchor
  - reporter
  - interviewee
  - crowd
  - official
  - politician
  - narrator / voiceover
- should remain cautious:
  - role candidate
  - evidence source
  - confidence
- why it matters:
  - useful for broadcaster analysis, news comparison, and speaker framing

### 4. Genre detection
- estimate format or segment type such as:
  - news report
  - studio anchor segment
  - interview
  - advertisement
  - trailer
  - action sequence
  - documentary mode
- why it matters:
  - useful for comparing heterogeneous corpora
  - supports higher-level media studies use cases

### 5. Audio modality enrichment
- music / speech / silence / noise segmentation
- possible emotion or intensity cues later
- useful for cuts, pacing, propaganda style, and trailer analysis

### 6. Speaker structure detection
- speaker turn boundaries
- possible diarization hooks later
- useful for role analysis and transcript grounding

## Suggested script delivery order

### First wave
- `scene_detection.py`
- `modalities_detection.py`
- `role_detection.py`

### Second wave
- `genre_detection.py`
- `speaker_structure.py`
- deeper audio segmentation

### Why this order
- scene and modality structure help almost everything else
- role detection is valuable early for broadcaster analysis
- genre detection becomes more reliable after those foundations exist

## Suggested backend module pattern
```text
src/backend/analysis/
  scene_detection.py
  modalities_detection.py
  role_detection.py
  genre_detection.py
  evidence_linker.py
  timestamp_schema.py
```

## Suggested output artifact pattern
```text
<source_name>_scene_detection.json
<source_name>_modalities.json
<source_name>_role_detection.json
<source_name>_genre_detection.json
<source_name>_evidence_index.json
<source_name>_evidence_timeline.csv
```

## General Matrix relation

### Quant matrix
- Quant-only comparison

### POS matrix
- POS-only comparison

### General Matrix
- future multimodal comparison layer
- should compare selected evidence from multiple lenses at once

### General Matrix should eventually allow
- scene-level comparison
- modality distribution comparison
- role distribution comparison
- language and rhetorical comparison
- linked navigation back to exact video spans

## What should be complete before desktop packaging

### Essential
- stable annotation round-trip
- shared timestamp schema
- raw + corrected evidence model
- multimodal analysis package export
- stable project save/open
- one serious multi-video validation batch

### Strongly recommended
- backend object tracking upgrade
- clearer file naming governance
- source/media/annotation linked export

### Can wait until after packaging if needed
- richer visual polish
- advanced matrix analytics
- luxury annotation workflows

## Validation target before packaging
- run a serious batch with multiple videos
- test:
  - save/open project
  - save/open analysis
  - matrix persistence
  - linked timestamp navigation
  - annotation correction persistence
  - multimodal package export/import

## Immediate next implementation recommendation
1. define the shared timestamp schema in code
2. define the evidence linker and package manifest
3. stabilize annotation correction data model
4. script `scene_detection.py`
5. script `modalities_detection.py`
6. script `role_detection.py`
7. wire these into project/package export

## Strategic outcome
- with this layer in place, VAA1 becomes:
  - not just a set of outputs
  - but a linked multimodal analytical environment
- that is the right phase to package into:
  - Windows `.exe`
  - Mac `.dmg`
