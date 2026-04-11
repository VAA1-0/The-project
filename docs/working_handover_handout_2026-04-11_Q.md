# Working Handover Handout 2026-04-11 Q

## Checkpoint

- Branch: `petteri`
- Commit: `bbafe8b`
- Title: `Advance CVAT annotation workflow and VAA1 taxonomy UX`

This checkpoint secures the evening phase in which the CVAT annotation workflow and the VAA1 taxonomy guidance layer were pushed forward together.

## What Landed

### 1. CVAT x VAA1 workflow documentation package

The following handoff and governance materials are now present:

- `docs/vaa1_cvat_access_and_annotation_protocol_2026-04-11.md`
- `docs/vaa1_cvat_access_and_annotation_protocol_2026-04-11.doc`
- `docs/vaa1_cvat_access_and_annotation_protocol_2026-04-11.docx`
- `docs/vaa1_cvat_annotation_exchange_protocol_2026-04-11.md`
- `docs/vaa1_cvat_annotation_exchange_protocol_2026-04-11.doc`
- `docs/vaa1_cvat_annotation_exchange_protocol_2026-04-11.docx`
- `docs/schemas/vaa1_annotation_master_schema_v1.schema.json`
- `docs/schemas/vaa1_annotation_master_schema_v1.example.json`

These documents establish:

- the current local CVAT runtime workflow
- the user access and onboarding model
- the annotation exchange contract between CVAT and VAA1
- the first normalized master-schema target for future implementation

### 2. VAA1 metadata taxonomy UX

The VAA1 metadata surfaces now support a more analyst-friendly taxonomy workflow.

Implemented in:

- `src/frontend/components/metadata/CustomizableSelectField.tsx`
- `src/frontend/lib/metadata-taxonomy.ts`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/app/V2components/components/panels/SourceMediaMetadataPanel.tsx`

Key outcomes:

- cleaned analyst-facing wording
  - `Privacy axis` -> `Privacy`
  - `Expertise axis` -> `Expertise`
  - `Situational genre` -> `Situation type`
  - `Situational subtype` -> `Situation detail`
  - `Performance / expression` -> `Expression / delivery`
- one-click native dropdown interaction retained
- open custom-label field added under core categorical dropdowns
- custom labels are now saved immediately on the local browser
- learned local labels can now be manually removed with `×`

### 3. Frontend stabilization required to keep the workflow buildable

To support the above and remove build blockers, the following files were updated:

- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/panels/ProjectPanel.tsx`
- `src/frontend/app/V2components/components/panels/TimeBankPanel.tsx`
- `src/frontend/app/V2components/components/panels/ToolsPanel.tsx`
- `src/frontend/lib/video-service.ts`

This stabilized:

- GoldenLayout typing drift
- upload/import response typing drift
- temporary metadata UI state typing
- several nullable/shape mismatches in panel code

### 4. CVAT runtime support

- `src/cvat/cvat-engine/entrypoint.sh`

The file is included in the checkpoint because it is part of the local CVAT support path used during the annotation recovery and runtime stabilization effort.

### 5. Contract test stub corrections

Updated:

- `tests/test_face_backend_contract.py`
- `tests/test_face_video_pipeline_contract.py`

These changes corrected stale test stubs so the contract tests better match the actual imported module surface.

## Verified During This Phase

- VAA1 frontend production build succeeded with:
  - `cd src/frontend && npx next build --webpack`
- targeted ESLint pass for the taxonomy/dropdown work succeeded
- VAA1 metadata panel visibly showed:
  - renamed labels
  - custom-label entry fields
  - browser-local saved labels
  - remove control for learned local labels
- local CVAT connection had already been proven working earlier in the day and was documented in the runtime runbook

## Important Current Behavior

### Local custom taxonomy behavior

Current state:

- custom labels persist on the current browser
- custom labels are not yet shared system-wide
- custom labels are removable locally
- removing a label removes it from the local learned pool
- re-adding a label saves it again locally

This is intentional as an interim step.

Future workflow still needs:

- shared/backend-governed taxonomy storage
- approval / retirement / rename rules for system-wide labels

### CVAT UI vs VAA1 UI

Important clarification:

- the taxonomy and guidance improvements are in **VAA1**
- they do **not** modify the native CVAT interface itself
- CVAT remains the annotation workspace
- VAA1 remains the analyst-facing metadata and orchestration layer

## Known Remaining Gaps

- Python contract tests still face an OpenMP shared-memory runtime abort when run as a combined `conda run` unittest process
- repo-wide ESLint is not fully green because of broader pre-existing `no-explicit-any` debt outside the narrow targeted scope
- custom taxonomy is still browser-local, not system-wide
- CVAT annotation output is documented and schematized, but not yet fully ingested automatically into the VAA1 master schema

## Recommended Resume Point

Resume from this order:

1. manual end-to-end verification of the updated VAA1 taxonomy workflow
2. decide whether to secure another checkpoint after any follow-up fixes
3. continue with shared taxonomy governance and annotation-ingest implementation

## Summary

This checkpoint matters because VAA1 is no longer only technically connected to CVAT. It now also has a more teachable, analyst-facing taxonomy workflow with local persistence and cleanup. The evening work moved the system from "functional but brittle" toward "usable and governable."
