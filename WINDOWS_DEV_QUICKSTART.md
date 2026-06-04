# VAA1 Windows Development Quickstart

Purpose: get a Windows development/testing machine from a fresh clone to a visible VAA1 dashboard.

This is not the `.exe` release path. It is the developer/tester setup path for the `petteri` branch.

## 1. Install Required Tools

Install these first:

- Git for Windows
- VS Code
- Miniconda
- Python 3.10+ if using the plain venv fallback
- Node.js LTS
- FFmpeg

Optional but recommended:

- Docker Desktop with WSL2, for CVAT/container workflows
- YOLOv8/Ultralytics inside the VAA1 Python environment, for object detection

See the full beginner handout:

```text
docs/vaa1_new_developer_windows_setup_handout_2026-06-04.md
```

## 2. Clone The Petteri Branch

Open PowerShell:

```powershell
mkdir C:\VAA1
cd C:\VAA1
git clone https://github.com/<OWNER_OR_ORG>/<REPOSITORY>.git
cd <REPOSITORY>
git checkout petteri
```

The commands below assume the checkout folder is `C:\VAA1\The-project`. If your folder has a different name, use that path instead.

Open the project in VS Code:

```powershell
code .
```

## 3. Create Or Activate Python Environment

Preferred starting point, because the repository includes `environment.yml`:

```powershell
conda env create -f environment.yml
conda activate vaa1_compatible
```

If the environment already exists:

```powershell
conda activate vaa1_compatible
```

If the team asks for the plain Python fallback instead:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If either dependency path fails, stop and send the error to the VAA1 team. Do not repeatedly install random packages globally.

## 4. Run Environment Diagnostics

From the project root:

```powershell
.\scripts\windows_env_check.ps1
```

For a machine-readable report:

```powershell
.\scripts\windows_env_check.ps1 -Json > windows-env-report.json
```

Send the report when asking for setup help.

If PowerShell blocks the helper scripts because of execution policy, run the same script this way:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows_env_check.ps1
```

## 5. Install Dependencies

Either let the first-run helper prepare the plain Python venv and frontend dependencies:

```powershell
.\scripts\windows_first_run.ps1
```

Or install the frontend manually:

```powershell
cd C:\VAA1\The-project\src\frontend
npm install
cd C:\VAA1\The-project
```

## 6. Start VAA1 In Development Mode

Backend terminal:

```powershell
cd C:\VAA1\The-project
conda activate vaa1_compatible
python api_server.py
```

Plain venv backend fallback:

```powershell
cd C:\VAA1\The-project
.\.venv\Scripts\Activate.ps1
python api_server.py
```

Frontend terminal:

```powershell
cd C:\VAA1\The-project\src\frontend
$env:NEXT_PUBLIC_API_URL="http://127.0.0.1:8000"
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open:

```text
http://127.0.0.1:3001/dashboard
```

## 7. Run Frontend Tests

```powershell
cd C:\VAA1\The-project\src\frontend
npm test
npx tsc --noEmit
```

## 8. Optional Checks

Docker/CVAT:

```powershell
docker ps
docker compose version
```

FFmpeg:

```powershell
ffmpeg -version
ffprobe -version
```

YOLOv8/Ultralytics:

```powershell
python -c "import ultralytics; print(ultralytics.__version__)"
```

## First Success Target

The first success is:

```text
The VAA1 dashboard opens at http://127.0.0.1:3001/dashboard
The backend health route responds at http://127.0.0.1:8000/api/health
Frontend tests can run.
```

Everything else, including CVAT, YOLO acceleration, Whisper performance, and packaging, comes after this baseline.
