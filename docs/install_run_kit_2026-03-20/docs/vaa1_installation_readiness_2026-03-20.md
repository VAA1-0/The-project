# VAA1 Installation Readiness Audit

Date: 2026-03-20
Scope: local Mac workspace readiness for first runnable VAA1 launch

## Summary

Current status:
- frontend is close to ready
- Docker is available
- Python backend environment is not ready in the active shell

Most important finding:
- the main blocker to seeing VAA1 run end-to-end is missing Python runtime dependencies, not the frontend

## What Was Checked

### Frontend

Result:
- `src/frontend/node_modules` is present
- frontend TypeScript had already been repaired and passes

Implication:
- frontend can likely be started quickly once we want a visible UI

### Docker

Result:
- Docker is installed and available

Observed:
- `docker --version` returned `Docker version 29.2.0, build 0b9d198`

Implication:
- Docker-backed paths remain available if needed for CVAT or backend container launch

### Python Runtime In Active Environment

Result:
- core backend imports are missing in the active Python environment

Checked imports:
- `fastapi`
- `uvicorn`
- `cv2`
- `pandas`
- `numpy`

Observed:
- all were missing in the current active shell environment

Implication:
- backend will not start locally from the current Python interpreter without environment setup

## Environment File Assessment

### `environment-MacOS-core.yml`

Assessment:
- best candidate for a first local Mac setup
- focused on the main pipeline stack
- includes FastAPI, Uvicorn, OpenCV, EasyOCR, Whisper, SpaCy, Ultralytics, Torch, and supporting packages

Strength:
- good fit for “make VAA1 run locally”

Risk:
- still a fairly heavy environment
- package resolution/install time may be significant

### `environment-MacOS-face.yml`

Assessment:
- narrower face-analysis environment
- useful for face-specific work, but not ideal as the main launch environment for the full app

Strength:
- targeted for deepface / tensorflow / retina-face flows

Risk:
- not broad enough to be the canonical first-run environment for the whole application

### `environment.yml`

Assessment:
- not ideal as the working source of truth for local setup in its current form

Observed:
- file content appears to be UTF-16 or otherwise encoded in a way that renders poorly in the current shell
- looks Windows-oriented and includes Windows runtime entries

Implication:
- not a good primary install document for current Mac local-first work

### `requirements.txt`

Assessment:
- broad and comprehensive
- useful as a dependency reference and Docker support artifact
- less ideal than the Mac conda file for quick local onboarding on this machine

Risk:
- very heavy pip-only install path
- more exposed to resolver friction on a local machine than the conda Mac route

## Backend Entrypoint Assessment

### Recommended Canonical Entrypoint: `api_server.py`

Why this is the better first-launch backend:
- richer endpoint surface than `app/main.py`
- better aligned with the recent backend hardening work
- supports more pipeline modes
- handles upload, analysis, status, download, and static/frontend serving more completely
- this is also the path used by the Dockerfile `CMD`
- our newer backend tests are centered around this contract

### Secondary Entrypoint: `app/main.py`

Assessment:
- useful and now closer in behavior
- still best treated as secondary rather than canonical

Reason:
- simpler surface
- fewer integrated routes/features
- `api_server.py` is the more complete operational backend

## Fastest Practical Launch Path

Recommended first visible run path:
1. prepare Python environment from `environment-MacOS-core.yml`
2. start backend with `python api_server.py`
3. start frontend with `npm run dev` in `src/frontend`
4. verify backend health and one upload/analyze cycle

Why this route:
- shortest path to “see VAA1 alive”
- avoids mixing in CVAT complexity too early
- gets us real outputs to inspect before larger architecture work

## Time Estimate

Given current readiness:
- frontend-only visible: about 2 to 5 minutes
- backend + frontend after environment creation: about 20 to 45 minutes
- full stack including CVAT/proxy/docker extras: about 45 to 90+ minutes

Main time drivers:
- conda environment creation speed
- large ML package resolution/download
- any model downloads at first execution
- whether spaCy model or OCR/Whisper assets must initialize/download

## Recommended Next Action

When work resumes:
- do not begin the backbone regime first
- first make the local app runnable

Recommended order:
1. create/activate the core Mac environment
2. smoke-test critical imports
3. start `api_server.py`
4. start frontend
5. verify one short sample analysis run
6. then begin the backbone timestamp/traceability regime against a live system
