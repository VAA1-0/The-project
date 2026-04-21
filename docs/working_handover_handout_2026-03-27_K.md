# VAA1 working handover handout

## Date
- 2026-03-27

## Checkpoint label
- `K`

## Working goal reached in this checkpoint
- the W3C-aligned timestamp and traceability profile was translated into the first live backend schema layer
- VAA1 now has a real `Time Bank` backbone with shared anchors, evidence objects, provenance activities, and media references
- transcript linking was moved into the actual backend flow instead of remaining only a design intention
- OCR, objects, and expressions were linked into the same `Time Bank` regime and exposed as downloadable artifacts
- the first `Time Bank` panel was added to the UI as a navigable, side-by-side multimodal evidence workspace
- `Time Bank` was reshaped into a more governable row-based comparison layout with:
  - one video per row
  - aligned feature columns
  - alphabetical defaults
  - draggable feature-column arrangement

## Verified working behavior
- `Time Bank Transcript` can be backfilled for older completed analyses and no longer remains ghostly `pending`
- `Download Results` now exposes:
  - `Time Bank Transcript`
  - `Time Bank OCR`
  - `Time Bank Objects`
  - `Time Bank Expressions`
- `Window -> Time Bank` opens a real comparison panel
- `Time Bank` can:
  - add the current analysis
  - compare multiple analyses side by side
  - navigate back to the correct source/time by clicking an event row
- `Time Bank` now reads with:
  - source rows
  - feature columns
  - aligned `Time / Evidence / Conf.` structure
- feature columns in `Time Bank` can be reordered by dragging
- source rows and feature columns now default to alphabetical order

## Important implementation notes
- user-facing naming now distinguishes:
  - `Time Bank` as the visible product name
  - `timestamp backbone / traceability layer` as internal engineering language
- the backend schema layer now includes:
  - `MediaProfile`
  - `MediaRef`
  - `MediaLocator`
  - `Anchor`
  - `EvidenceObject`
  - `ActivityRecord`
  - `TraceEnvelope`
  - `RegionBox`
- geometry for OCR / Objects / Expressions is now normalized to one shared payload shape:
  - `{ "x": ..., "y": ..., "w": ..., "h": ... }`
- transcript linking is now part of the real backend process, not just an optional conceptual sidecar
- OCR / Objects / Expressions can fall back to live analysis data in the `Time Bank` panel if the stored Time Bank artifacts are not yet present for an older analysis

## Current known issues for next session
- `Time Bank OCR`, `Time Bank Objects`, and `Time Bank Expressions` still need stronger persistence/backfill reliability for all older saved analyses
- some imported or legacy object CSV paths may still produce empty or weak raw data, which limits what the `Time Bank` can show
- object tracking stability is still heuristic and frontend-presentational rather than true backend tracker logic
- object labels still need an analyst correction layer with:
  - dropdown of likely labels
  - manual override field
  - provenance-preserving raw vs corrected storage
- the full timestamp regime still needs to be carried further into:
  - POS
  - Quant
  - annotation correction
  - later multimodal packaging
- backend runtime verification in the Conda environment is still partly blocked by the OpenMP shared-memory issue seen earlier in testing

## Recommended next order of work
1. harden the `Time Bank` artifact persistence and backfill path for OCR / Objects / Expressions
2. extend the timestamp / evidence contract into more lenses, starting from the strongest candidates
3. add the analyst correction layer for object labels on top of the new timestamp backbone
4. keep moving toward detector + tracker architecture for stable object identity
5. continue toward the multimodal analysis package and shared linked-data export path

## Resume steps
1. start backend in `vaa1_core`
2. open VAA1 in the browser
3. hard refresh with `Cmd + Shift + R`
4. open completed analyses
5. inspect:
  - `Downloads`
  - `Time Bank`
  - `Transcript`
  - `OCR`
  - `Objects`
  - `Expressions`
6. in `Time Bank`:
  - open one analysis
  - press `Add Current`
  - open another analysis
  - press `Add Current`
  - compare the aligned feature columns
  - drag feature headings if a different comparison order is needed

## Backend start command
```bash
source ~/opt/anaconda3/etc/profile.d/conda.sh
conda activate vaa1_core
python3 -u api_server.py
```

## Main files changed in this stage
- `api_server.py`
- `docs/vaa1_multimodal_analysis_package_blueprint_2026-03-26.md`
- `docs/vaa1_timestamp_traceability_profile_2026-03-27.md`
- `docs/working_handover_handout_2026-03-27_K.md`
- `src/backend/analysis/__init__.py`
- `src/backend/analysis/evidence_linker.py`
- `src/backend/analysis/timestamp_schema.py`
- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/app/V2components/components/panels/DownloadPanel.tsx`
- `src/frontend/app/V2components/components/panels/TimeBankPanel.tsx`
- `src/frontend/lib/config.ts`
- `tests/test_timestamp_schema.py`

## Bundle intent
- this handout zip preserves the current timestamp-backbone / `Time Bank` milestone
- it is meant as a restartable working checkpoint before the next round of timestamp propagation, correction-layer work, and stronger multimodal linking
