# Codex Session Continuity 2026-04-13

## Session Scope

This session moved from operational CVAT connection work into a larger architectural clarification about annotation inside VAA1.

The work covered:

- CVAT runtime verification
- duplicate-task and reopen checking
- annotation exchange protocol documentation
- master annotation schema drafting
- taxonomy governance design
- method-facing design documentation
- shared taxonomy backend foundation
- first working CVAT-to-VAA1 ingest slice
- annotation workspace layout work
- CVAT decoupling from VAA1 startup
- embedded CVAT-in-Tools experimentation
- clarification that VAA1 should move toward a native annotation backbone

## Key Remote Checkpoints

Important pushed commits during or before this session thread:

- `bbafe8b`
  - `Advance CVAT annotation workflow and VAA1 taxonomy UX`
- `558b088`
  - end-of-day documentary checkpoint
- `1daa250`
  - `Implement shared taxonomy foundation`
- `bfa793c`
  - `Decouple CVAT and expand annotation workspace`
- `4cacf79`
  - `Refine annotation workspace and document native annotation direction`

Current safe remote base for the next thread:

- `origin/petteri` at `4cacf79`

## What Is Now Established

### 1. CVAT linkage and reopen behavior were meaningfully stabilized

Observed during the session:

- linked `cvatID` reuse was confirmed in reopen tests
- simple reopen did not create new duplicate tasks in the tested case

### 2. Shared taxonomy persistence exists

Confirmed:

- browser-local learned labels
- backend shared taxonomy storage
- persisted shared taxonomy file writing

### 3. First real CVAT-to-VAA1 ingest exists

Confirmed:

- raw CVAT job annotations can be fetched
- a mapped VAA1 master-schema artifact can be generated
- manual CVAT annotation produced:
  - `object_annotation_count: 1`
  - `track_annotation_count: 1`

### 4. CVAT is no longer treated as mandatory at VAA1 startup

Direction implemented:

- VAA1 starts without CVAT dependency
- CVAT is treated as an optional annotation plugin path

### 5. Annotation workspace work has been pushed forward

Implemented and tested in varying forms:

- top-menu `Annotation workspace`
- annotation-oriented workspace preset work
- `CVAT plugin` surfaced through `Tools`
- embedded `CVAT annotator` path inside `Tools`
- return-to-analysis restoration improvements

## What The Session Clarified Architecturally

This is the most important session-level conclusion:

- a polished long-term VAA1 annotation experience should not be built around CVAT as the primary UX surface
- VAA1 should own the annotation experience
- external systems should act as adapters, not as the defining annotation environment

Working conclusion reached in the session:

- the current CVAT path is a bridge and compatibility layer
- the next serious target is a native VAA1 annotation protocol and native VAA1 annotation UI

## Documents Produced Or Extended In This Session Arc

Important handoff/design materials now present:

- `docs/vaa1_cvat_access_and_annotation_protocol_2026-04-11.md`
- `docs/vaa1_cvat_annotation_exchange_protocol_2026-04-11.md`
- `docs/schemas/vaa1_annotation_master_schema_v1.schema.json`
- `docs/schemas/vaa1_annotation_master_schema_v1.example.json`
- `docs/vaa1_shared_taxonomy_governance_design_2026-04-11.md`
- `docs/vaa1_methodological_design_brief_taxonomy_provenance_timebank_2026-04-11.md`
- `docs/vaa1_parallel_annotation_workspace_design_2026-04-13.md`
- `docs/vaa1_cvat_tagging_schema_v1_2026-04-13.md`
- `docs/working_handover_handout_2026-04-13_R.md`

The latest handout also includes the added external source summary concerning candidate native/open visual annotation systems for VAA1.

## Current Known Limits

At the end of this session, these remain true:

- embedded CVAT inside `Tools` is improved but still not equivalent to a native annotation surface
- VAA1 and CVAT video playback are not synchronized
- `Visual cues` / `Cinematic clues` still need a better final location in the UI
- the current annotation workspace is still partly shaped by bridge logic rather than a native VAA1 annotation protocol

## Recommended First Move In The Next Fresh Thread

Start from the native direction, not from more iframe patching.

Recommended next order:

1. define `VAA1 native annotation protocol v1`
2. define the first native visual annotation MVP inside VAA1
3. specify CVAT as an adapter against that protocol
4. decide which current CVAT-expressed annotations become first-class native VAA1 annotation objects

## Practical Restart Instruction

If a new Codex thread is started, use these as the initial context anchors:

- latest pushed commit:
  - `4cacf79`
- latest handout:
  - `docs/working_handover_handout_2026-04-13_R.md`
- this continuity note:
  - `docs/codex_session_continuity_2026-04-13.md`

## Summary

This session did not merely refine a plugin. It changed the project’s annotation direction.

The major outcome is:

- VAA1 now has enough technical and conceptual groundwork to stop treating annotation as “CVAT inside VAA1” and start defining annotation as a native VAA1 capability with external adapters where useful.
