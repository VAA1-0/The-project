# VAA1 deprecated scripts and retired surfaces log

## Date
- 2026-03-30

## Purpose
- keep a visible record of scripts, panels, and support surfaces that should not quietly drift back into active use
- reduce future confusion during packaging, cleanup, and stabilization work

## Working rule
- do not delete older or retired surfaces casually during stabilization
- first mark them here with:
  - current status
  - why they are deprecated or retired
  - whether they are still used as reference material

## Current retired or deprecated surfaces

### Frontend retired components
- `src/frontend/retired-components/Dashboard.tsx`
- `src/frontend/retired-components/LandingPage.tsx`
- `src/frontend/retired-components/AnalyzePage.tsx`
- `src/frontend/retired-components/Header.tsx`
- `src/frontend/retired-components/AnalyzeResultsPanel.tsx`

Status:
- retired frontend surfaces
- keep for reference only until the active V2 panel architecture is fully stable

Risk if forgotten:
- accidental imports
- duplicated UI logic
- inconsistent old behavior reappearing

### Legacy or secondary app entry path
- `app/main.py`

Status:
- older face/video pipeline path still present in the repo
- not the main VAA1 dashboard/backend entry path during current stabilization

Risk if forgotten:
- developers may patch both `api_server.py` and `app/main.py` inconsistently
- output contracts can drift

Recommendation:
- if the older path must remain, keep its status documented
- if it no longer has a real operational role later, formally retire it

### Model/demo script
- `models/yolov8_video.py`
- `demo/debug_analysis.py`
- `demo/demo_video_analysis.py`

Status:
- useful as references and experiments
- not the canonical production pipeline

Risk if forgotten:
- improvements made only in demo scripts instead of the real backend pipeline

### Environment / runner surface duplication
- `run_vaa1.bat`
- `run_vaa1_lite.bat`
- `scripts/run_vaa1.bat`
- `scripts/start_services.bat`
- `scripts/start_services_lite.bat`
- `run_all.sh`

Status:
- active but overlapping launcher surface

Risk if forgotten:
- packaging and onboarding confusion
- unclear “official” start path

Recommendation:
- during packaging readiness, decide:
  - primary launcher
  - secondary maintenance scripts
  - deprecated launcher paths

## Near-term maintenance tasks
1. keep updating this log when a script or UI surface becomes clearly secondary or retired
2. separate:
   - retired
   - still referenced
   - active but overlapping
3. avoid removing items from this log until packaging decisions are final

## Related current milestone
- stabilization workplan:
  - `docs/vaa1_stabilization_workplan_2026-03-30.md`
