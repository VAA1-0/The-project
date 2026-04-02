# VAA1 clean delivery bundle

## Date
- 2026-04-02

## Purpose
- define the GitHub-ready delivery shape for the current workspace
- separate source-and-doc delivery from local runtime clutter and backup archives

## Delivery basis
- current live workspace verified in browser
- reference checkpoint:
  - `docs/working_handover_handout_2026-03-31_M.md`
- current workspace handout:
  - `docs/working_handover_handout_2026-04-02_N.md`

## Include in clean delivery
- source code under:
  - `app/`
  - `src/`
  - `tests/`
- key docs:
  - `docs/working_handover_handout_2026-04-02_N.md`
  - `docs/working_handover_handout_2026-03-31_M.md`
  - `docs/clean_delivery_bundle_2026-04-02_N.md`
  - any project blueprints or runbooks still needed for continuation
- environment and dependency files:
  - `environment.yml`
  - `environment-MacOS-face.yml`
  - `requirements.txt`
  - `vaa1_core.lock.yml`
  - `vaa1_face.lock.yml`
- root project files needed for startup:
  - `api_server.py`
  - `SESSION_HANDOFF.md`
  - `README_face_pipeline_stage.md`
  - `README_vaa1_face_pipeline_colleague_bundle.md`

## Keep out of clean delivery
- local archives:
  - `*.zip`
  - `*.tar.gz`
- runtime folders:
  - `tmp/`
  - `outputs/`
  - `uploads/`
  - `.next/`
  - `node_modules/`
- local OS noise:
  - `.DS_Store`
- local generated manifests:
  - `docs/current_progress_diffstat_2026-04-02_N.txt`
  - `docs/current_progress_status_2026-04-02_N.txt`
  - `docs/current_progress_file_list_2026-04-02_N.txt`

## Current POS delivery status
- explicit POS category delivery expanded
- grammar categories are expandable
- clickable word navigation retained
- `Case profile` section added
- `Tense profile` separated from verb forms
- structured case/tense output still depends on active language-model morphology support

## GitHub preparation notes
- `.gitignore` was expanded to ignore local archives, temp folders, macOS noise, and frontend build/runtime folders
- review `git status --short` before staging
- stage intentionally rather than using a blind `git add .`

## Suggested staging shape
Stage:
- source files actually changed
- current handover docs
- `.gitignore`

Do not stage:
- backup archives
- temp media
- generated runtime folders

## Suggested push sequence
```bash
git status --short
git add .gitignore
git add api_server.py app src tests docs/working_handover_handout_2026-04-02_N.md docs/clean_delivery_bundle_2026-04-02_N.md
git status --short
git commit -m "Prepare clean delivery bundle and POS morphology UI updates"
git push
```

## Intent
- provide a cleaner GitHub-ready continuation point
- preserve larger backup bundles locally as recovery assets rather than mixing them into source control
