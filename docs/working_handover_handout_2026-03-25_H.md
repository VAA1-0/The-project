# VAA1 working handover handout

## Date
- 2026-03-25

## Checkpoint label
- `H`

## Working goal reached in this checkpoint
- saved analysis bundles can be reopened later
- cleared program state can reopen saved work
- reopened saved work now restores video playback correctly
- Project panel navigation was simplified and quieted
- workspace storage helpers now stay under a collapsed Project subcategory

## Verified working behavior
- `File -> Save As...` creates a reusable saved-work bundle
- `Session -> Clear Program` returns VAA1 to an empty state
- `File -> Open Saved Work...` can reopen a saved bundle
- reopened bundle now restores the video without needing `Locate Media...`
- Project operations stay in the left `Project` panel and no longer spawn an extra `ProjectPanel` leaf

## Important implementation notes
- saved-work import now prefers `source_video` over annotated video for playback
- analysis persistence is stored under `outputs/api_results`
- imported saved bundles are extracted under `outputs/imported_work`
- workspace helpers are intentionally hidden behind the Project `Workspace` dropdown

## Current known issues for next session
- POS analysis frame is not currently delivering results and needs debugging
- OCR / Expressions / Objects overlays or bounding indicators are not currently surfaced in the UI
- CVAT integration still needs a dedicated troubleshooting pass
- timeline indicators and a tracing / timestamping regime are still future work

## Recommended next order of work
1. debug POS analysis end-to-end
2. restore or add OCR / Expressions / Objects visual indicators with toggles
3. add a timeline indicator to the video player
4. troubleshoot CVAT annotation flow
5. design and implement tracing / time-stamping after the current pipeline is stable

## Resume steps
1. start backend in `vaa1_core`
2. open VAA1 in the browser
3. if needed, use `Session -> Clear Program`
4. use `File -> Open Saved Work...`
5. reopen the latest saved bundle
6. continue from POS debugging first

## Backend start command
```bash
source ~/opt/anaconda3/etc/profile.d/conda.sh
conda activate vaa1_core
python3 -u api_server.py
```

## Main files changed in this stage
- `api_server.py`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/app/V2components/components/panels/ProjectPanel.tsx`
- `src/frontend/app/V2components/components/panels/ToolsPanel.tsx`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/lib/api-service.ts`
- `src/frontend/lib/blob-store.ts`
- `src/frontend/lib/local-library.ts`
- `src/frontend/lib/video-service.ts`
- `tests/test_face_backend_contract.py`

## Bundle intent
- this handout zip is meant to preserve a working resume point
- it is not a final release bundle
