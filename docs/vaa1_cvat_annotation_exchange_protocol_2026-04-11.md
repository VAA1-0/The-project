# VAA1-CVAT Annotation Exchange Protocol

Date: 2026-04-11
Status: draft implementation protocol based on current local runtime and code reality
Purpose: define how annotation should move between CVAT and VAA1, what is already true now, and what must be implemented next

## Why This Protocol Exists

The VAA1↔CVAT connection now works locally:

- VAA1 can create CVAT tasks
- CVAT can create jobs and segments
- VAA1 can persist `cvatID`
- embedded CVAT can open inside VAA1

But a working connection is not yet the same thing as a working annotation exchange.

Right now:

- CVAT annotations can be exported from the VAA1 annotation screen
- VAA1 stores source-media metadata and analyst corrections
- VAA1 does not yet automatically ingest CVAT output into the VAA1 master schema

This document defines the exchange contract that should govern that next phase.

## Current Operational Truth

### What Exists Now

- `cvatID` links a VAA1 analysis item to a CVAT task
- VAA1 stores source-media context under `user_annotations`
- VAA1 stores analyst-side correction payloads under `annotation_corrections`
- the annotation page can export job annotations from CVAT in a chosen CVAT export format

### What Does Not Yet Exist

- automatic import of CVAT export into a stable VAA1 annotation master schema
- a production mapping layer from CVAT label structures into VAA1 schema fields
- automatic synchronization status such as `exported`, `imported`, `mapped`, `reviewed`

So the current exchange is:

- technically possible
- not yet product-mature

## Governing Principle

CVAT is the annotation engine.

VAA1 is the schema owner.

That means:

- CVAT may hold working annotation geometry and task state
- VAA1 must own interpretive context, annotation mapping, correction logic, and durable package structure

In other words:

- CVAT is not the final authority on VAA1 meaning
- VAA1 must absorb and contextualize whatever comes back from CVAT

## Exchange Layers

The exchange should be understood as four separate layers.

### Layer 1. Linkage

Purpose:

- identify which CVAT task belongs to which VAA1 analysis

Current field:

- `cvatID`

Current source:

- stored in VAA1 analysis status

Current behavior:

- if `cvatID` exists and is valid, VAA1 should reopen that task
- if `cvatID` is absent or `0`, VAA1 may create a new task

### Layer 2. Context

Purpose:

- preserve the interpretive context that should frame annotation work

Current VAA1 context payload:

- `editor_notes`
- `source_context`
- `provenance_notes`
- `title`
- `scope`
- `description`
- `persons`
- `relations`
- `location_country`
- `location_city`
- `location_place`
- `location_room`
- `time_era`
- `time_year`
- `time_moment`
- `situation_event`
- `keywords`
- `interaction_dynamics`
- `narrative_development`
- `performance_expression`
- `genre`
- `genre_subtype`
- `situational_genre`
- `situational_subtype`
- `privacy_axis`
- `expertise_axis`
- `references`
- `reference_relation`
- `reference_source`
- `confidence`
- `notes`

Protocol rule:

- this context belongs to VAA1
- CVAT annotation output should be interpreted through this context, not isolated from it

### Layer 3. CVAT Working Annotation

Purpose:

- hold the actual frame-, track-, and geometry-level annotation work

Current reality:

- CVAT job annotations are edited inside CVAT
- VAA1 annotation screen can export them by selected CVAT format

Important current limitation:

- CVAT export is still CVAT-native output
- it is not yet automatically normalized into a VAA1 schema document

### Layer 4. VAA1 Review And Override

Purpose:

- preserve analyst corrections and VAA1-side review decisions

Current structured VAA1 correction payload:

- `version`
- `updated_at`
- `updated_by`
- `text_substitutions`
- `label_overrides`
- `manual_transcript_entries`

Protocol rule:

- VAA1 overrides must remain distinct from raw CVAT output
- the system must preserve both:
  - original annotation evidence
  - reviewed VAA1 interpretation

## Current Exchange Flow

What happens now:

1. VAA1 opens or creates a linked CVAT task.
2. Analyst annotates in CVAT.
3. Analyst can click `Save Annotations` in VAA1.
4. VAA1 requests `GET /api/jobs/{jobId}/annotations?format=...` from the CVAT bridge.
5. The browser downloads a CVAT export archive.

This means the current save action is really:

- export-to-user

not yet:

- export-to-VAA1-master-schema

That distinction should be made explicit in product wording until the full import path exists.

## Required Target Flow

The intended full exchange flow should be:

1. VAA1 opens the linked CVAT job.
2. Analyst annotates in CVAT.
3. VAA1 requests or receives the CVAT annotation payload.
4. VAA1 stores the raw imported CVAT artifact.
5. VAA1 maps CVAT entities into the VAA1 annotation master schema.
6. VAA1 stores mapping status and validation status.
7. Analyst sees the mapped result inside VAA1.
8. Any analyst corrections are stored as VAA1 overrides, not destructive rewrites of the raw import.

## File And Package Ownership

The exchange should distinguish three artifacts.

### A. Raw CVAT Export Artifact

Purpose:

- preserve exactly what CVAT produced

Requirements:

- store the original export file
- record export format
- record export time
- record job id and task id

Recommended fields:

- `analysis_id`
- `cvat_task_id`
- `cvat_job_id`
- `export_format`
- `exported_at`
- `export_source`
- `artifact_path`

### B. VAA1 Mapped Annotation Artifact

Purpose:

- represent the CVAT result in a VAA1-owned schema

Requirements:

- normalized field names
- stable versioning
- mapping provenance
- validation results

Recommended top-level structure:

- `analysis_id`
- `schema_version`
- `cvat_link`
- `source_context_snapshot`
- `raw_import_reference`
- `object_annotations`
- `track_annotations`
- `temporal_segments`
- `review_status`
- `mapping_notes`
- `validation`

### C. VAA1 Analyst Override Artifact

Purpose:

- preserve what the analyst corrected after import or during later review

Current nearest structure:

- `annotation_corrections.json`

Protocol rule:

- do not flatten reviewed overrides into the raw CVAT artifact
- keep override provenance visible

## Mapping Rules

These are the minimum mapping rules the system should adopt.

### Rule 1. Keep Raw Geometry And Raw Labels

If CVAT provides:

- boxes
- polygons
- tracks
- raw label names

then VAA1 should preserve them in a raw layer before transforming anything.

### Rule 2. Map Into Approved VAA1 Label Families

CVAT labels should not become the final VAA1 master schema automatically unless they already match the approved VAA1 vocabulary.

That means:

- CVAT `Person` may map directly if approved
- genre-specific or ambiguous labels may need a VAA1 mapping layer

### Rule 3. Use VAA1 Context During Mapping

Mapping should consider:

- `genre`
- `genre_subtype`
- `situational_genre`
- `situational_subtype`
- `privacy_axis`
- `expertise_axis`

These fields should influence how CVAT output is interpreted, displayed, and reviewed.

### Rule 4. Separate Detection From Interpretation

Examples:

- CVAT object geometry is evidence
- VAA1 object schema is interpretation
- CVAT track labels are working labels
- VAA1 genre-weighted expression or object categories are analytic labels

So the master schema should preserve:

- evidence layer
- mapped interpretive layer

### Rule 5. Preserve Ambiguity

If mapping confidence is weak or contested:

- keep the ambiguity visible
- do not force one overconfident final category

## Annotation Master Schema: Minimum Required Sections

The VAA1 annotation master schema should at minimum be able to hold:

- `analysis linkage`
  - analysis id
  - task id
  - job id
  - export/import timestamps
- `context`
  - source-media annotations snapshot
- `visual object layer`
  - object label
  - mapped label
  - track id
  - frame or time interval
  - geometry
  - provenance
- `temporal event layer`
  - interval
  - event or action label
  - confidence
  - note
- `expression / performance layer`
  - raw signal if available
  - interpreted family label
  - context weighting note
- `review layer`
  - overrides
  - reviewer identity
  - review timestamp
  - rationale
- `validation layer`
  - schema validity
  - missing mappings
  - unresolved labels

## Recommended Interim Operating Protocol

Until automatic import is implemented, use this temporary sequence:

1. Analyst annotates in CVAT through VAA1.
2. Analyst exports annotations from the VAA1 annotation screen.
3. Export file is treated as the raw CVAT artifact, not the finished VAA1 annotation package.
4. Any second-step normalization or interpretation is documented explicitly.
5. If analyst edits meaning in VAA1, store it under reviewed override logic, not as silent replacement.

## UI Language Rule

Current button label:

- `Save Annotations`

Current behavior:

- downloads a CVAT export archive

Protocol implication:

- this label is potentially misleading

Recommended later product wording if behavior remains export-only:

- `Export CVAT Annotations`

Recommended wording once the full protocol exists:

- `Sync To VAA1`

## Versioning Rule

Every exchange artifact should carry version identity.

Minimum version fields:

- `exchange_protocol_version`
- `vaa1_schema_version`
- `cvat_export_format`
- `cvat_export_version` if available

## Validation Rule

Before imported CVAT output is treated as a valid VAA1 master-schema record, VAA1 should validate:

- linkage exists
- export file is readable
- task id and job id are recorded
- labels are mappable
- geometry is structurally valid
- timestamps or frame intervals are coherent
- unresolved labels are reported

## Immediate Build Implications

This protocol suggests the next implementation steps are:

1. store the raw CVAT export artifact inside the analysis bundle
2. define a first normalized VAA1 annotation master-schema JSON
3. implement a CVAT-label-to-VAA1-label mapping layer
4. expose sync status in VAA1
5. keep analyst overrides as a separate review artifact

## Current Conclusion

The current system has crossed the connection threshold but not the annotation-exchange threshold.

Right now:

- CVAT can be reached
- annotation can be created
- export can be downloaded

But the true VAA1-owned exchange path still needs to be built.

This document should be treated as the contract for that build-out.
