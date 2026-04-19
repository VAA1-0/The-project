# VAA1 Annotation Operational Handoff 2026-04-19

## Status

This handoff captures the first working order of the VAA1 native manual annotation workflow.

The workflow is operational enough to preserve before further taxonomy and propagation design work.

## What Works

- Native manual annotations can be created from the Video panel.
- Manual annotations persist in `annotation_corrections.json`.
- Manual annotations surface in the Master Schema.
- Manual annotations route to category leaves.
- Mature categories route to mixed automatic-plus-manual panels:
  - `Audio`
  - `Expressions`
  - `OBJ`
  - `OCR`
  - `Transcription`
- Non-mature categories use universal manual governance leaves:
  - `Action`
  - `Cinematic Cues`
  - `Genre`
  - `Identification`
  - `Interaction`
  - `Metadata`
  - `Movement`
  - `Notes`
  - `Role`
  - `Scene`
- Identification rows prioritize analyst identity evidence over generic labels.
- Audio prosody now renders the full available list rather than a short capped preview.
- New panels open in the right-hand analysis stack.
- Native annotation navigation is framed as data governance, while CVAT remains an external annotation bridge.

## Taxonomy Work Preserved

- Full manual annotation category set is documented.
- Full situation taxonomy is documented.
- `transition` and `season_change` are first-class situation types.
- Everyday person-situation taxonomy is in the shared metadata taxonomy source.
- The native annotation UI now consumes shared situational taxonomy options instead of a local duplicate list.

## Key Files

- `src/frontend/lib/api-service.ts`
- `src/frontend/lib/video-service.ts`
- `src/frontend/lib/metadata-taxonomy.ts`
- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/app/V2components/components/panels/ToolsPanel.tsx`
- `src/frontend/app/V2components/components/panels/MasterSchemaPanel.tsx`
- `src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx`
- `src/frontend/app/V2components/components/panels/OCRPanel.tsx`
- `src/frontend/app/V2components/components/panels/ExpressionPanel.tsx`
- `src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx`
- `src/frontend/app/V2components/components/panels/TimeBankPanel.tsx`
- `docs/vaa1_native_annotation_protocol_v1_2026-04-14.md`
- `docs/vaa1_annotation_taxonomy_workflow_plan_2026-04-19.md`
- `docs/vaa1_situation_taxonomy_full_2026-04-19.md`

## Validation

Frontend validation passed:

```bash
cd src/frontend
npx tsc --noEmit
```

## Known Remaining Design Work

- Cross-annotation propagation is not implemented.
- Interaction-to-identification candidate creation needs careful workflow design.
- Identity uncertainty needs a formal schema:
  - `confirmed`
  - `suspected`
  - `insinuated`
  - `withheld`
  - `ambiguous`
  - `contested`
- Some category leaves remain manual-governance only until automatic detectors mature.
- Full export packaging for manual annotations still needs a dedicated design pass.

## Handout Bundle

The intended handout archive name is:

```text
vaa1_annotation_operational_handoff_2026-04-19.tar.gz
```

It should contain the files listed above plus this handoff note.
