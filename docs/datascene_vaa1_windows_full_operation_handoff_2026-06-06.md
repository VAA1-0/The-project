# Datascene/VAA1 Windows Full Operation Handoff

Date: 2026-06-06

Audience: a colleague operating Datascene/VAA1 on a Windows laptop.

Purpose: make the Windows machine capable of running the same Datascene/VAA1 development and testing environment that is operational on the Mac laptop, including full-feature materials, optional runtimes, models, diagnostics, and parity checks.

This is not a `.exe` delivery. This is a coding, testing, and operating environment handout.

## Core Warning

A GitHub clone by itself may not reproduce the full working Datascene/VAA1 environment.

The Mac development machine can contain important local materials that are not present in the GitHub branch:

- uncommitted code changes,
- generated analysis bundles,
- sample media,
- local outputs,
- model files,
- Conda environments,
- runtime caches,
- FFmpeg or detector binaries,
- local configuration,
- private or large files excluded by `.gitignore`,
- experimental handoff documents,
- frontend build/runtime artifacts.

If the Windows clone from the `petteri` branch looks underdeveloped or has missing features, first assume **environment/material parity is incomplete**, not that the colleague did something wrong.

## Success Definition

The Windows machine is successful when it can:

- open the VAA1 dashboard,
- start backend and frontend,
- run frontend checks,
- run backend diagnostics,
- load representative media,
- perform analysis with available local tools,
- show the major panels and features present on the Mac development machine,
- preserve saved analysis state,
- run without hidden API keys or mandatory external services,
- clearly report missing optional tools such as FFmpeg, YOLOv8/Ultralytics, CVAT, Whisper, or Playwright.

## Required Software

Install these first.

### 1. Windows

Recommended:

- Windows 11, 64-bit.
- At least 40-80 GB free disk space.
- Administrator rights or permission to install developer tools.
- Windows Update completed.

### 2. VS Code

Install:

```text
https://code.visualstudio.com/Download
```

Recommended extensions:

- Python,
- Pylance,
- Jupyter,
- Docker,
- ESLint,
- Prettier,
- Playwright Test for VS Code,
- GitLens, optional.

### 3. Git For Windows

Install:

```text
https://git-scm.com/install/windows
```

Check:

```powershell
git --version
```

### 4. Miniconda

Install:

```text
https://www.anaconda.com/docs/getting-started/miniconda/install/windows-gui-install
```

Check in Anaconda Prompt:

```bat
conda --version
python --version
```

### 5. Node.js LTS

Install:

```text
https://nodejs.org/en/download
```

Check:

```powershell
node --version
npm --version
```

### 6. Docker Desktop

Install:

```text
https://docs.docker.com/desktop/setup/install/windows-install/
```

Use WSL 2 if Docker asks. Restart after installation.

Check:

```powershell
docker --version
docker compose version
docker ps
```

Docker is mainly needed for CVAT/container workflows. VAA1 core should still have a non-CVAT path.

### 7. FFmpeg

FFmpeg supports video/audio extraction and conversion.

Install from the team-approved build if one is provided. Otherwise start from:

```text
https://www.ffmpeg.org/download.html
```

Check:

```powershell
ffmpeg -version
ffprobe -version
```

Governance note: FFmpeg is a release-sensitive optional/runtime component. The user should know which binary is used, where it is installed, and what workflows depend on it.

### 8. Optional Detection And AI Tools

These should be activated by user choice, not hidden assumptions:

- YOLOv8 / Ultralytics for object detection.
- Whisper or equivalent transcription runtime.
- OCR dependencies.
- CVAT bridge.
- LLM/API providers if used.
- Playwright browsers for rendered testing.

If a tool is missing, VAA1 should report the missing capability clearly and keep the rest of the local workflow usable where possible.

## Materials That Must Be Delivered

Do not rely only on a repository clone if the goal is Mac-to-Windows parity.

Prepare a handoff folder with the following categories.

### A. Repository Code

Include one of:

- a fresh GitHub clone of the `petteri` branch after all current Mac changes have been committed and pushed, or
- a zip/tar archive made directly from the working Mac project folder.

Preferred folder on Windows:

```text
C:\VAA1\The-project
```

### B. Git Parity Information

From the Mac machine, record:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Save the output in the handoff folder as:

```text
MAC_GIT_PARITY.txt
```

On Windows, after clone:

```powershell
git branch --show-current
git rev-parse HEAD
git status --short
```

The branch and commit should match the Mac parity note if the handoff is Git-based.

If the Mac worktree has important uncommitted files, either commit/push them or include them in a separate `mac-local-changes` bundle with an explanation.

### C. Environment Files

Include:

- `environment.yml`,
- `environment-linux.yml`,
- `environment-MacOS-core.yml`, as reference only,
- `environment-MacOS-face.yml`, as reference only,
- `vaa1_core.lock.yml`, if present,
- `vaa1_face.lock.yml`, if present,
- `requirements.txt`,
- `package.json`,
- `package-lock.json`,
- `src/frontend/package.json`,
- `src/frontend/package-lock.json`.

Windows should normally start from `environment.yml`, but the Mac files and lock files are valuable references when diagnosing missing capability.

### D. Scripts

Include:

- `WINDOWS_DEV_QUICKSTART.md`,
- `scripts/windows_env_check.ps1`,
- `scripts/windows_first_run.ps1`,
- `run_vaa1.bat`,
- `run_vaa1_lite.bat`,
- `scripts/start_services.bat`,
- `scripts/start_services_lite.bat`.

### E. Model Files

Include or document how to obtain:

- YOLO model files such as `yolov8n.pt`,
- OCR model/cache requirements if used,
- Whisper model cache requirements if used,
- face-analysis model/cache requirements if used,
- any local project-specific models under `models/`.

Do not assume model files are committed to GitHub. Many model files are intentionally excluded or downloaded locally.

### F. Representative Test Media

Include a small, lawful test media set that is allowed to be transferred.

Recommended:

```text
sample_media/
  small_test_video.mp4
  known_transcript_case.mp4
  bbox_roi_test_case.mp4
```

If Bond trailer or other copyrighted/non-transferable media was used on the Mac, do not casually copy it. Use lawful test material or confirm rights first.

### G. Representative Analysis Bundles

If the Mac has a richer local VAA1 state than GitHub, include representative outputs that demonstrate mature features.

Possible locations:

- `outputs/`,
- saved analysis JSON files,
- source-linked analysis bundles,
- local project/session files,
- traceback artifacts,
- report/export examples.

Create a small curated folder rather than copying everything blindly:

```text
vaa1_reference_analysis_bundle/
  README.txt
  source_media_or_placeholder.txt
  analysis.json
  outputs/
  expected_features_checklist.txt
```

Do not include private, licensed, sensitive, or rights-restricted media without permission.

### H. Local Configuration

Include configuration examples, but do not include secrets:

- `.env.example`,
- API key placeholder instructions,
- FFmpeg path example,
- model path example,
- disabled-state examples for optional tools.

Never send real API keys, private credentials, tokens, or passwords.

### I. Documentation

Include:

- `README.md`,
- `WINDOWS_DEV_QUICKSTART.md`,
- `USER_GUIDE.md`,
- `THIRD_PARTY_LICENSES.md`,
- `NOTICE.md`,
- `LICENSE.md`,
- `docs/vaa1_general_sprint_regime_remaining_tasks.md`,
- `docs/vaa1_remaining_sprint_program_stepwise_2026-06-03.md`,
- this handout.

## Recommended Transfer Package

Create a folder named:

```text
Datascene_VAA1_Windows_Handoff_YYYY-MM-DD/
```

Suggested structure:

```text
Datascene_VAA1_Windows_Handoff_YYYY-MM-DD/
  00_READ_ME_FIRST.txt
  MAC_GIT_PARITY.txt
  The-project/
  sample_media/
  vaa1_reference_analysis_bundle/
  models/
  environment_notes/
  docs/
```

If the handoff is too large for email, use a secure transfer method agreed by the team.

## Why The GitHub Petteri Clone May Look Underdeveloped

If the colleague cloned `petteri` and saw a severely limited VAA1 compared to the Mac machine, likely causes include:

- current Mac changes were not committed or pushed,
- the Windows clone was on the wrong branch or older commit,
- local Mac-only generated artifacts were missing,
- model files were not present,
- frontend dependencies were not installed,
- backend Python environment was incomplete,
- optional tools such as FFmpeg, YOLOv8/Ultralytics, CVAT, OCR, or Whisper were missing,
- the frontend was running against a dead or wrong backend,
- the wrong port or stale dev server was opened,
- `.gitignore` excluded large runtime materials,
- the Mac was using local outputs or saved analysis bundles that GitHub does not contain.

Diagnosis should begin with parity checks, not random package installation.

## Setup Path On Windows

### 1. Place The Project

Recommended:

```powershell
mkdir C:\VAA1
```

Then either clone:

```powershell
cd C:\VAA1
git clone <repository-url> The-project
cd The-project
git checkout petteri
```

Or copy/extract the delivered `The-project` folder into:

```text
C:\VAA1\The-project
```

Open in VS Code:

```powershell
cd C:\VAA1\The-project
code .
```

### 2. Check Parity

Run:

```powershell
git branch --show-current
git rev-parse HEAD
git status --short
```

Compare with `MAC_GIT_PARITY.txt`.

If the commit differs, stop and ask for the correct branch/commit or handoff bundle.

### 3. Create Python Environment

Preferred:

```powershell
cd C:\VAA1\The-project
conda env create -f environment.yml
conda activate vaa1_compatible
```

If the environment already exists:

```powershell
conda activate vaa1_compatible
```

If the environment file fails, save the full error and send it to the team.

### 4. Install Frontend Dependencies

```powershell
cd C:\VAA1\The-project\src\frontend
npm install
```

If Playwright tests are needed:

```powershell
npm install -D @playwright/test
npx playwright install
```

### 5. Run Diagnostics

From project root:

```powershell
cd C:\VAA1\The-project
.\scripts\windows_env_check.ps1
```

If PowerShell blocks scripts:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows_env_check.ps1
```

For a report:

```powershell
.\scripts\windows_env_check.ps1 -Json > windows-env-report.json
```

Send `windows-env-report.json` to the team if setup fails.

### 6. Start VAA1

Recommended helper:

```powershell
cd C:\VAA1\The-project
.\scripts\windows_first_run.ps1
```

Manual backend terminal:

```powershell
cd C:\VAA1\The-project
conda activate vaa1_compatible
python -m uvicorn api_server:app --host 127.0.0.1 --port 8000
```

Manual frontend terminal:

```powershell
cd C:\VAA1\The-project\src\frontend
$env:NEXT_PUBLIC_API_URL="http://127.0.0.1:8000"
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open:

```text
http://127.0.0.1:3001/dashboard
```

Backend health:

```text
http://127.0.0.1:8000/api/health
```

## First Feature Parity Checklist

After VAA1 opens, check that the following are visible or available:

- project/downloads sidebar,
- upload or media open flow,
- video panel,
- transcript panel,
- POS panel,
- Quant panel,
- Objects panel,
- OCR panel,
- Meaning / Plot panel,
- Scene Cards panel,
- Expressions panel,
- Master Schema panel,
- OBJ Leaf panel,
- Narrative Agent panel,
- native annotation controls,
- BBox/ROI correction surface,
- saved analysis load/reopen,
- traceback or source-linked evidence controls where available.

If many panels are missing, the frontend code or branch is probably not the same as the Mac environment.

## Computational Checks

Frontend:

```powershell
cd C:\VAA1\The-project\src\frontend
npm test
npx tsc --noEmit
npx playwright test
```

Backend:

```powershell
cd C:\VAA1\The-project
conda activate vaa1_compatible
python -m unittest discover tests
```

Optional targeted checks:

```powershell
python -c "import cv2, fastapi, uvicorn, pandas; print('core imports ok')"
python -c "import ultralytics; print('ultralytics ok')"
ffmpeg -version
ffprobe -version
docker ps
```

If an optional check fails, note which feature is affected. Do not treat every optional failure as total VAA1 failure.

## Manual Smoke Test

Use lawful representative media.

1. Open VAA1 dashboard.
2. Load sample media.
3. Run a short analysis.
4. Confirm video playback works.
5. Open transcript and test source jumps.
6. Open Objects and BBox/ROI surfaces.
7. Draw or correct a BBox if available.
8. Save analysis.
9. Refresh browser.
10. Reopen saved analysis.
11. Confirm correction/state survives.
12. Check POS and Quant panels for timing/synchronization.
13. Check Master Schema / Narrative Agent / Meaning panels if generated evidence exists.

## Optional Capability Governance

The colleague should know which capabilities are active.

Use this table during setup:

| Capability | Required for core dashboard? | How to verify | If missing |
|---|---:|---|---|
| Python backend | Yes | `api/health` responds | Fix Conda/env/server |
| Frontend | Yes | dashboard opens on port 3001 | Run `npm install`, start dev server |
| FFmpeg | Important for media workflows | `ffmpeg -version` | Configure path or use limited workflow |
| YOLOv8/Ultralytics | Object detection | `import ultralytics` | Disable detector or install explicitly |
| Docker/CVAT | External annotation bridge | `docker ps` | Use VAA1 without CVAT |
| Whisper/transcription | Transcript generation | import/check model availability | Use existing transcript or install runtime |
| Playwright | Rendered tests | `npx playwright test` | Install browsers |
| LLM/API providers | Optional | configured key/provider | Keep disabled unless user chooses |

## What Not To Do

Do not:

- install random packages globally to make one error disappear,
- paste private API keys into documentation,
- copy copyrighted media without permission,
- assume GitHub contains generated outputs or local model caches,
- ignore branch/commit mismatch,
- run old backend and new frontend together,
- treat YOLOv8, FFmpeg, CVAT, APIs, or licensed scripts as hidden mandatory defaults,
- package or present a limited Windows clone as the full Datascene/VAA1 environment.

## What To Send Back If It Fails

Send:

- screenshot of the error,
- `windows-env-report.json`,
- `git branch --show-current`,
- `git rev-parse HEAD`,
- `git status --short`,
- backend terminal output,
- frontend terminal output,
- `logs/windows-backend.log` if present,
- `logs/windows-frontend.log` if present,
- whether Docker Desktop was running,
- whether FFmpeg worked,
- whether dashboard opened,
- whether `api/health` opened.

## Minimum Handoff Acceptance

Before calling the Windows handoff successful:

- Git branch/commit parity is known.
- The code/material source is known: GitHub clone, Mac folder copy, or hybrid bundle.
- Backend starts.
- Frontend starts.
- Dashboard opens.
- Diagnostics run.
- Frontend tests or at least TypeScript check can run.
- FFmpeg status is known.
- YOLOv8/Ultralytics status is known.
- Docker/CVAT status is known.
- Representative media can be opened or the missing-media reason is documented.
- Missing optional features are labeled as optional, unavailable, or intentionally disabled.

## Bottom Line

The Windows laptop should not receive only a thin GitHub clone if the goal is full Datascene/VAA1 operation.

Deliver:

```text
code + environment + models + sample media + representative analysis bundles + diagnostics + documentation + parity notes
```

Only then can the colleague fairly test whether the Windows machine matches the real Datascene/VAA1 capability currently present on the Mac development laptop.
