# VAA1 Forensic Tool Sprint

Date: 2026-04-20  
Sprint status: preparation and first backend contract slice.

## Purpose

The Forensic tool allows an analyst to select a time window, and eventually a spatial region, then create a governed derivative render at either:

- `science_grade`
- `forensic_accuracy`

The tool is designed as part of the larger Quick Sweep to Forensic Deepening workflow.

## First Slice Delivered

This sprint slice adds the foundation, not the final UI.

Backend foundation:

- `src/backend/analysis/forensic_render.py`
- governed render job creation
- full-frame or static-box region rendering
- science-grade FPS preset
- forensic-accuracy FPS preset
- adopted-context enrichment for the render window
- output snippet video
- output sampled frames
- per-job JSON ledger
- analysis-level `jobs.json` ledger

FastAPI endpoints:

- `GET /api/forensic-render/{analysis_id}/jobs`
- `GET /api/forensic-render/{analysis_id}/jobs/{render_job_id}`
- `POST /api/forensic-render/{analysis_id}/jobs`
- `GET /api/forensic-render/{analysis_id}/jobs/{render_job_id}/download`

Frontend API client preparation:

- forensic render request/job types
- list forensic render jobs
- create forensic render job
- get forensic render download URL

## Governance Rule

Every forensic render must produce a ledger entry. A forensic render is not just an enhanced clip; it is a documented derivative artifact.

The ledger records:

- source video path
- analysis id
- render job id
- requested mode
- source FPS
- target FPS
- frame stride
- time window
- frame range
- region type
- static region, when used
- output video path
- output frame directory
- output JSON path
- rendered frame count
- analyst reason

## Existing Evidence Adoption Requirement

The Forensic tool must adopt existing VAA1 analysis knowledge instead of treating the rendered snippet as a blank new video.

This means forensic render jobs should be prepared to inherit and preserve:

- source media metadata
- manual annotations
- Master Schema entries
- identification annotations
- interaction annotations
- role annotations
- expression detections
- face detections
- object/person tracks
- OCR cues
- transcript segments
- prosody cues
- timestamp references

### Metadata Respect

Forensic render outputs should carry source context forward.

If the original analysis has metadata such as title, source context, known persons, situational genre, source references, or analyst notes, the forensic job ledger should be able to reference that metadata. A rendered snippet should not become detached from the source-media record that gives it meaning.

### Identity and Interaction Respect

If the analyst has already marked an identity, or if an interaction exists between known or suspected persons, the Forensic tool should not fall back to only `person` or `person track` language.

Preferred future behavior:

- raw detector label: `person`
- enriched forensic label: `Lyutsifer Safin candidate`
- likelihood or epistemic state: `uncertain`, `likely`, `confirmed`, `contested`
- provenance: linked manual identification, interaction annotation, source metadata, face/expression/person-track evidence

This is especially important for narrative cultures where identity can be partial, insinuated, delayed, or contested.

### Expression Respect

If expression evidence already exists for the selected time window, it should be linked into the forensic render job.

The Forensic tool should be able to say:

- which expressions were already detected
- which faces or regions they refer to
- whether the evidence is automatic, manual, or reviewed
- whether expression evidence supports or complicates the forensic interpretation

The tool should avoid overwriting prior expression evidence unless a later forensic pass explicitly creates a new reviewed evidence layer.

### Evidence Adoption Envelope

Future forensic render jobs should include an evidence context block such as:

```json
{
  "adopted_context": {
    "metadata_refs": [],
    "manual_annotation_ids": [],
    "identity_refs": [],
    "interaction_refs": [],
    "role_refs": [],
    "expression_refs": [],
    "object_track_refs": [],
    "transcript_refs": [],
    "prosody_refs": [],
    "ocr_refs": []
  }
}
```

This block should be populated from already-existing VAA1 data for the selected time window and region.

Current first implementation:

- source metadata is carried into `metadata_refs`
- manual annotations overlapping the time window are carried into `manual_annotation_refs`
- identification annotations are separated into `identity_refs`
- interaction annotations are separated into `interaction_refs`
- role annotations are separated into `role_refs`
- expression samples overlapping the time window are carried into `expression_refs`
- object/person tracks overlapping the time window are carried into `object_track_refs`
- transcript segments overlapping the time window are carried into `transcript_refs`
- prosody cues overlapping the time window are carried into `prosody_refs`
- OCR cues overlapping the time window are carried into `ocr_refs`
- summary counts and active identity/role labels are included

This is a context adoption layer, not an automatic character-recognition layer. The raw detector label and enriched contextual label must remain separate.

## Current Preset Logic

`science_grade`:

- uses a lighter review FPS
- currently resolves to up to `6 FPS`, capped by source FPS

`forensic_accuracy`:

- preserves the source FPS unless an explicit lower `requested_fps` is provided

## Safety Limits

The initial backend render utility rejects windows longer than the request safety limit.

Default:

- `max_duration_seconds = 60`

This is intentional. The first tool should encourage snippet deepening rather than accidental full-video forensic re-rendering.

## Next UI Slice

The next UI slice should add a calm Forensic Render panel or Tools subsection with:

- current analysis id
- current video time as default start
- start/end inputs
- mode selector
- optional static region selector
- reason/note field
- render button
- job list
- download link
- "open at source time" action

## Later Slices

Later development should add:

- evidence adoption from metadata, identities, interactions, expressions, transcript, prosody, OCR, and object/person tracks
- moving ROI from object/face/manual annotation references
- automatic evidence id linkage
- traceback panel integration
- Quick Sweep hotspot picker
- report claim linkage to forensic render outputs
- export bundle inclusion policy

## Tests

Focused backend contract:

```bash
python3 tests/test_forensic_render_contract.py
```

The pure contract tests run without OpenCV. The render integration case skips automatically when local OpenCV/numpy are unavailable.

Frontend contract/type checks:

```bash
cd src/frontend
npm test
npx tsc --noEmit
```
