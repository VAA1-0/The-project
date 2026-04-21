# VAA1 timestamp and traceability profile

## Date
- 2026-03-27

## Purpose
- define a W3C-aligned profile for VAA1 timestamping, traceability, and API exchange
- turn existing VAA1 outputs into time-anchored, identifiable, provenance-aware evidence
- provide the immediate design basis for `timestamp_schema.py` and the later trace adapter / evidence linker

## User-facing name
- VAA1 should use `Time Bank` as the user-facing name for the timestamp and traceability layer
- internal engineering terms may still use:
  - `timestamp backbone`
  - `traceability layer`
  - `anchor / evidence / provenance schema`
- user-facing artifacts may therefore read like:
  - `Time Bank Transcript`
  - later:
    - `Time Bank OCR`
    - `Time Bank Objects`
    - `Time Bank Expressions`

## Primary standards alignment

### W3C Web Annotation Data Model
- VAA1 should treat each analytic item as an annotation-like object that can target:
  - a full media resource
  - a timed segment of a media resource
  - a frame or region within a media resource
- this is the right conceptual model for:
  - transcript segments
  - OCR events
  - object detections and tracks
  - expression events
  - analyst corrections
  - later semantic or theory-derived objects
- source:
  - https://www.w3.org/TR/annotation-model/

### W3C Media Fragments URI
- VAA1 should support media references that can be rendered as simple time-based deep links
- practical UI and API form:
  - `vaa1://media/<media_id>#t=<start>,<end>`
  - local web equivalent:
    - `http://localhost:3000/media/<media_id>#t=<start>,<end>`
- internal storage should not depend only on fragment strings, but should be able to generate them consistently
- source:
  - https://www.w3.org/TR/media-frags/

### W3C PROV-O
- VAA1 provenance should align with the entity / activity / agent pattern:
  - evidence object = entity
  - pipeline step = activity
  - model, module, analyst, or external tool = agent
- required semantics:
  - `used`
  - `generated`
  - `wasDerivedFrom`
  - `wasAssociatedWith`
- source:
  - https://www.w3.org/TR/prov-o/

### JSON-LD 1.1
- VAA1 should serialize its linked evidence in JSON that can be upgraded into JSON-LD cleanly
- internal Python and UI code can still use plain JSON-compatible objects
- API and export design should avoid field naming that blocks later JSON-LD context mapping
- source:
  - https://www.w3.org/TR/json-ld11/

## Core VAA1 profile principles

### 1. No object without an anchor
Every evidence object must reference:
- a stable media identity
- a canonical time anchor
- a stable object identifier

### 2. No object without lineage
Every derived item must be able to say:
- what it used
- what generated it
- when it was generated
- which version/profile was used

### 3. No fake precision
VAA1 must allow:
- uncertain spans
- partial anchors
- multiple anchors where appropriate
- separate UI precision and provenance precision

### 4. UI time and provenance time should both exist
- canonical UI/API time:
  - `t_start_ms`
  - `t_end_ms`
- optional provenance precision:
  - `frame_index`
  - `pts_ns`
  - `duration_ms`

### 5. Raw and corrected evidence must coexist
- raw model output must not be overwritten
- analyst correction is an additional layer, not a replacement of provenance

## Canonical VAA1 timing conventions

### Time unit
- canonical:
  - milliseconds
- fields:
  - `t_start_ms`
  - `t_end_ms`

### Optional high-precision fields
- `pts_ns`
- `frame_index`
- `duration_ms`

### Reason
- `t_ms` is stable and easy for:
  - UI seeking
  - API clients
  - CSV and JSON exchange
- `pts_ns` is useful for:
  - provenance
  - VFR media
  - exact reconstruction when needed

## Stable identity conventions

### Media identity
Each source media must have:
- `media_id`
- `source_uri`
- `source_filename`
- `source_hash`
- `processing_profile_id`
- `media_profile`
  - e.g. VFR/CFR marker, dimensions, duration, codec notes

### Anchor identity
Each anchor must have:
- `anchor_id`
- `media_id`
- `t_start_ms`
- `t_end_ms`
- optional `frame_index`
- optional `pts_ns`

### Evidence identity
Each evidence object must have:
- `id`
- `object_type`
- `anchor_id`
- `version`

## Minimum object model for VAA1

### MediaRef
Represents the source media identity and processing context.

Recommended fields:
- `media_id`
- `source_uri`
- `source_filename`
- `source_hash`
- `processing_profile_id`
- `media_profile`

### Anchor
Represents where in the media an object comes from.

Recommended fields:
- `anchor_id`
- `media_id`
- `t_start_ms`
- `t_end_ms`
- `duration_ms`
- `frame_index`
- `pts_ns`
- `anchor_type`
  - examples:
    - `point`
    - `interval`
    - `frame_region`

### EvidenceObject
Represents any meaningful analytic object in VAA1.

Recommended fields:
- `id`
- `object_type`
- `anchor_id`
- `payload`
- `confidence`
- `support_level`
- `created_by`
- `version`
- `derived_from`
- `raw_or_corrected`

### ActivityRecord
Represents how evidence was produced.

Recommended fields:
- `activity_id`
- `activity_type`
- `used`
- `generated`
- `parameters`
- `timestamp`
- `associated_agent`

## Object types to support early

### First wave
- `utterance`
- `ocr_region`
- `object_detection`
- `object_track`
- `emotion_signal`
- `keyword_event`
- `source_media_metadata`

### Second wave
- `scene`
- `speaker_turn`
- `linguistic_signal`
- `quant_signal`
- `annotation_correction`
- `interaction_event`

### Third wave
- `pentad_candidate`
- `ante_narrative_candidate`
- `tinbergen_tag`
- `critical_realist_candidate`
- `model_variable`

## Region and segment handling

### For OCR and object detections
Timed evidence often also has a region.

Recommended payload pattern:
- `region`
  - `x`
  - `y`
  - `w`
  - `h`
  - coordinate system note if needed

### For frame-specific detections
- use:
  - point or narrow-interval anchor
  - plus region in payload

### For tracks
- use:
  - interval anchor
  - payload can include representative or sampled boxes
  - later per-sample geometry list if needed

## Correction model

### Why this matters
VAA1 needs analyst correction for:
- wrong object labels
- annotation clean-up
- later semantic enrichment

### Recommended correction object
- raw object remains unchanged
- corrected item becomes its own evidence object

Required fields:
- `raw_label`
- `corrected_label`
- `correction_note`
- `derived_from`
- `anchor_id`
- `created_by`
- `raw_or_corrected`
  - `corrected`

### Example
- raw label: `refrigerator`
- corrected label: `doorway`
- note: `corridor entrance frame`

## API client implications

### VAA1 should expose time-linked objects consistently
API responses should make it easy for clients to:
- seek to source media moments
- understand provenance
- compare evidence across modalities
- reuse data without reverse-engineering local UI assumptions

### Recommended API behavior
- return evidence objects with:
  - `media_ref`
  - `anchor`
  - `payload`
  - `provenance`
- keep field naming stable across:
  - internal storage
  - API payloads
  - saved bundles

### Suggested client-facing link pattern
- `media_locator`
  - `source_uri`
  - `t_start_ms`
  - `t_end_ms`
  - `frame_index`

This can later be rendered as:
- media fragments
- app deep links
- player jumps

## VAA1 profile decisions

### Decision 1
- canonical VAA1 time:
  - milliseconds

### Decision 2
- VAA1 should support optional provenance precision:
  - `pts_ns`
  - `frame_index`

### Decision 3
- every evidence object must have:
  - `id`
  - `anchor_id`
  - `object_type`
  - `created_by`
  - `version`

### Decision 4
- every derived object must record:
  - `derived_from`
  - generating activity

### Decision 5
- raw and corrected evidence remain separate but linked

### Decision 6
- JSON output should be plain-JSON-friendly but JSON-LD-ready

## Immediate retrofit strategy

### Phase 1
- implement `timestamp_schema.py`
- define:
  - `MediaRef`
  - `Anchor`
  - `EvidenceObject`
  - `ActivityRecord`

### Phase 2
- implement `trace_adapter.py` or `evidence_linker.py`
- wrap current outputs into these objects

### Phase 3
- start with:
  - transcript
  - OCR
  - objects
  - expressions

### Phase 4
- extend to:
  - POS
  - Quant
  - annotation corrections

### Phase 5
- expose JSON-LD-compatible export profile for API and package exchange

## What this profile should unlock
- clickable evidence everywhere in the UI
- stable project and package exports
- analyst corrections with provenance
- multimodal triangulation
- future theory pipelines
- future Models Package 1

## Recommended next implementation step
1. create `src/backend/analysis/timestamp_schema.py`
2. encode this profile as Pydantic models
3. then create `evidence_linker.py`
4. start by wrapping transcript segments into anchored utterance objects

## Sources
- W3C Web Annotation Data Model
  - https://www.w3.org/TR/annotation-model/
- W3C Media Fragments URI 1.0
  - https://www.w3.org/TR/media-frags/
- W3C PROV-O
  - https://www.w3.org/TR/prov-o/
- W3C JSON-LD 1.1
  - https://www.w3.org/TR/json-ld11/
