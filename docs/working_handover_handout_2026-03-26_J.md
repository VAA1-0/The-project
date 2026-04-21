# VAA1 working handover handout

## Date
- 2026-03-26

## Checkpoint label
- `J`

## Working goal reached in this checkpoint
- saved analysis and project workflows were extended into a calmer governance layer
- Quant matrix and POS matrix now support side-by-side comparison and export paths
- source media metadata became a first-class analysis artifact with editable notes and downloadable JSON / CSV
- the `Video Panel` now has:
  - leaner header treatment
  - quieter passive text hierarchy
  - timeline and cue-jump navigation
  - OCR / Objects / Expressions overlay toggles
  - in-panel compare mode for two different sources
- object overlays were calmed down from raw flood behavior into grouped track-style display

## Verified working behavior
- `Save Analysis` and `Save Project` are now separate concepts in the UI
- `Download Results` now exposes:
  - current video bundle
  - full project bundle
  - matrix artifacts
  - source media metadata artifacts
- `Quant matrix` supports:
  - side-by-side comparison
  - JSON export
  - CSV export
- `POS matrix` supports:
  - side-by-side comparison
  - JSON export
  - CSV export
- `Window -> Restore Windows` returns the layout to setup mode cleanly
- workspace proportions can persist locally in the browser
- `Video Panel` compare mode can now:
  - set a compare anchor on one source
  - open a second source
  - start synced compare in the main video workspace
  - show both source filenames above the frames
  - use explicit `Play sync` / `Pause sync`
- OCR overlays display clearly and seek navigation works
- expression overlays can now render without object overlays being on

## Important implementation notes
- source media metadata now writes:
  - `source_media_metadata.json`
  - `source_media_metadata.csv`
- project bundles now include matrix state and project manifest data
- `Quant matrix` snapshots persist as analysis/project artifacts
- `POS matrix` snapshots now also travel through downloads and save bundles
- the UI passive text tone was standardized around the quieter `Saved Work` grey
- video compare now lives in the `Video Panel` instead of a right-side comparison leaf

## Current known issues for next session
- synced compare has an initial start glitch that still needs smoothing
- object overlays are calmer, but object identity stability is still heuristic and frontend-side
- crowded scenes can still over-split targets into too many tracks
- object box accuracy can drift because grouped tracks still need nearest-sample bbox selection at current playback time
- object labels need a correction/override layer for wrong tags such as `refrigerator` -> `doorway`
- `Source Media` still opens as a right-side leaf instead of a true `Project` governance subview
- file naming and download artifact governance still need a dedicated cleanup pass
- frontend lint debt remains in:
  - `src/frontend/lib/api-service.ts`
  - `src/frontend/lib/video-service.ts`
  - `src/frontend/app/V2components/components/panels/DownloadPanel.tsx`
  - `src/frontend/app/V2components/components/panels/POSAnalyzePanel.tsx`
  - `src/frontend/app/V2components/components/panels/QuantitativeAnalysisPanel.tsx`

## Recommended next order of work
1. move object analysis from detector-only UI grouping toward backend detector + tracker architecture
2. add an analyst correction layer for wrong object labels
3. refine synced compare startup behavior and per-side time readouts
4. continue timestamp / tracing discipline across lenses
5. keep tightening file naming and download governance
6. return to CVAT and larger multimodal comparison architecture after the current review flow is stable

## Resume steps
1. start backend in `vaa1_core`
2. open VAA1 in the browser
3. if needed, use `Session -> Clear Program`
4. open saved analysis or project bundle
5. inspect:
  - `Video`
  - `Objects`
  - `OCR`
  - `Expressions`
  - `Quant matrix`
  - `POS matrix`
6. for compare workflow:
  - open source A
  - set compare anchor
  - open source B
  - start synced compare in `Video Panel`

## Backend start command
```bash
source ~/opt/anaconda3/etc/profile.d/conda.sh
conda activate vaa1_core
python3 -u api_server.py
```

## Main files changed in this stage
- `api_server.py`
- `docs/bugfixlist_2026-03-25.md`
- `docs/vaa1_quant_comparison_blueprint_2026-03-26.md`
- `docs/working_handover_handout_2026-03-26_J.md`
- `src/backend/analysis/pipeline_ingestion.py`
- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/app/V2components/components/panels/DownloadPanel.tsx`
- `src/frontend/app/V2components/components/panels/ExpressionPanel.tsx`
- `src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx`
- `src/frontend/app/V2components/components/panels/OCRPanel.tsx`
- `src/frontend/app/V2components/components/panels/POSAnalyzePanel.tsx`
- `src/frontend/app/V2components/components/panels/POSMatrixPanel.tsx`
- `src/frontend/app/V2components/components/panels/ProjectPanel.tsx`
- `src/frontend/app/V2components/components/panels/QuantMatrixPanel.tsx`
- `src/frontend/app/V2components/components/panels/QuantitativeAnalysisPanel.tsx`
- `src/frontend/app/V2components/components/panels/SourceMediaMetadataPanel.tsx`
- `src/frontend/app/V2components/components/panels/ToolsPanel.tsx`
- `src/frontend/app/V2components/components/panels/VideoComparePanel.tsx`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/components/VideoItem.tsx`
- `src/frontend/lib/api-service.ts`
- `src/frontend/lib/config.ts`
- `src/frontend/lib/video-service.ts`
- `src/frontend/styles/globals.css`

## Bundle intent
- this handout zip preserves the current working comparison / media-governance / video-review checkpoint
- it is meant as a restartable development stage, not a final release bundle
