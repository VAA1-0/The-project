# Working Handover Handout 2026-04-13 R

## Checkpoint

- Branch: `petteri`
- Latest secured remote checkpoint before today’s local UI iteration: `bfa793c`
- Current local work after that checkpoint includes annotation-workspace layout and embedded CVAT-in-Tools refinements that are not yet described in an end-of-day handout

## What Was Proven Today

### 1. Runtime and integration baseline

Confirmed during the session:

- VAA1 backend on `8000` was brought up and answered status requests
- CVAT bridge on `3001` was brought up and returned healthy authenticated state
- a linked analysis already existed:
  - analysis id: `f287a423-810a-4734-9109-7993e06cf054`
  - CVAT task id: `8`
  - CVAT job id: `5`

### 2. Shared taxonomy persistence

The shared taxonomy backend store was confirmed working.

Verified:

- `outputs/taxonomy/shared_taxonomy.json`

Observed persisted example:

- scope: `privacy_axis`
- label: `Test`
- status: `approved_shared`

### 3. First working CVAT-to-VAA1 ingest slice

The first annotation ingest slice is operational.

Endpoint used:

- `POST /api/annotations/{analysis_id}/sync-cvat`

Confirmed outcomes:

- raw CVAT job annotations were fetched and stored
- a mapped VAA1 master-schema artifact was written
- after one manual CVAT annotation was saved, the ingest returned:
  - `object_annotation_count: 1`
  - `track_annotation_count: 1`

Artifacts verified:

- `outputs/api_results/f287a423-810a-4734-9109-7993e06cf054/cvat_raw_annotations_job_5.json`
- `outputs/api_results/f287a423-810a-4734-9109-7993e06cf054/vaa1_annotation_master_schema.json`

### 4. CVAT became optional instead of startup-critical

The VAA1 startup path was decoupled from mandatory CVAT behavior.

Implemented direction:

- VAA1 no longer needs CVAT to start
- VAA1 upload flow no longer auto-creates CVAT tasks
- CVAT is treated as an optional annotation plugin path

## What Was Learned About the Current CVAT Path

### 1. The current CVAT embed is still a bridge, not a native annotation solution

Facts observed through manual testing:

- CVAT works best on its own dedicated route
- CVAT can also be surfaced inside VAA1 `Tools`, but the embedded experience remains constrained
- the embedded view required repeated layout correction for height, clipping, and control visibility
- VAA1 and CVAT video playback are not yet synchronized

### 2. CVAT is not the right long-term UX backbone for VAA1

Working conclusion from the session:

- VAA1 user experience must remain primary
- external annotators must behave like plugins inside VAA1, not as systems VAA1 reorganizes itself around
- the present CVAT path is useful as a bridge and compatibility adapter, but not as the native annotation endpoint

## Basis Now Established For A Native VAA1 Annotation System

This is the most important forward-looking result from today.

The project now has a basis for delivering a native VAA1 annotation system:

1. VAA1 already has the core native context surfaces:
   - video
   - transcript
   - audio
   - objects
   - OCR
   - expressions
   - source metadata
   - Time Bank

2. VAA1 already has a shared taxonomy direction:
   - browser-local draft labels
   - backend shared taxonomy store
   - governance design drafted

3. VAA1 already has a canonical annotation target:
   - `docs/schemas/vaa1_annotation_master_schema_v1.schema.json`

4. VAA1 already has a working import bridge:
   - CVAT annotations can be normalized into the VAA1 master annotation structure

5. Therefore the next native step does not require inventing the whole system from nothing.
   It requires replacing the external-first annotation surface with a VAA1-owned annotation protocol and VAA1-owned annotation UI.

## Native Annotation Direction For Tomorrow

### Target rule

- VAA1 owns the annotation experience
- external systems are adapters only

### Minimal native annotation backbone already implied by the current work

The native VAA1 annotation protocol should own:

- annotation objects
- frame and interval spans
- identity affirmation
- role affirmation
- scene tags
- action tags
- movement tags
- interaction tags
- expression tags
- genre tags
- audio foley note
- provenance and review state

### Role of CVAT after that shift

CVAT can remain:

- an optional manual visual annotation adapter
- a compatibility path for box/track-style work
- an import/export bridge

CVAT should not remain:

- the canonical annotation model
- the defining annotation UX
- the required annotation runtime for VAA1

## External Source Material Added For Tomorrow

The attached source material on native annotation options should be treated as part of tomorrow's design basis.

Summary added from the provided material:

- VAA1 has multiple open-source candidates for manual visual annotation capability
- general-purpose candidates include:
  - `VGG Image Annotator`
  - `Annotorious`
- these were described as lightweight client-side tools with permissive BSD-family licenses and support for region-based annotation patterns relevant to VAA1
- highlighted capabilities include:
  - bounding boxes
  - polygons
  - support patterns extending toward video and audio annotation
  - web-app integration via usable APIs

The provided material also highlighted TEI-oriented options:

- `IMA`
- `ZoneRW`
- `TEI Zoner`

License and adaptation implications recorded from the source:

- `IMA`:
  - EUPL
  - copyleft obligations for derivative works
- `ZoneRW`:
  - MIT
- `TEI Zoner`:
  - MIT

These TEI-oriented tools were described as especially relevant when annotated regions need to become TEI P5 snippets or manuscript-style scholarly markup.

The source also listed larger or more operational annotation platforms:

- `CVAT`
- `MakeSense`
- possible integration paths involving:
  - `eScriptorium`
  - `Kraken`

Working interpretation for VAA1:

- permissive client-side annotators are strong candidates for a more native-feeling VAA1 annotation backbone
- TEI-oriented tools matter if VAA1 needs structured scholarly region markup in later phases
- CVAT remains useful as a bridge and benchmark, but not necessarily as the native VAA1 annotation endpoint

Tomorrow's native annotation discussion should therefore consider at least these three classes:

1. lightweight client-side annotation libraries
2. TEI-oriented scholarly annotation tools
3. larger operational annotation platforms used mainly as adapters or references

## Concrete UI State Reached Today

The following annotation workspace refinements were implemented locally during the session:

- `Annotation workspace` is available from the top `Tools` menu
- `Tools` can surface an embedded `CVAT annotator`
- the `Tools` panel summary/workspace selector was moved to the lower margin
- the embedded CVAT area was made more flexible in height than before

These changes improved the local working state, but they did not remove the core architectural limitation:

- embedded CVAT remains less coherent than a native VAA1 annotation surface

## Open Issues Left For Tomorrow

1. Embedded CVAT is still not a professional-feeling final UX
2. VAA1 and CVAT playback are not synchronized
3. `Visual cues` / `Cinematic clues` are still housed in `Tools`, though they likely belong under the VAA1 video review area
4. The annotation workspace still reflects bridge logic rather than a native VAA1 annotation protocol

## Recommended Resume Point

Tomorrow should begin from this order:

1. write the first explicit `VAA1 native annotation protocol v1` note
2. define the first native visual annotation MVP scope inside VAA1
3. demote CVAT conceptually to adapter status
4. decide which current CVAT-driven annotation fields become first-class native VAA1 annotation fields

## Summary

Today did not finish a professional CVAT integration. It did something more important:

- it proved the ingest bridge
- it proved shared taxonomy persistence
- it clarified the UX limits of CVAT-inside-VAA1
- and it established a concrete basis for a native VAA1 annotation system to be designed and built next
