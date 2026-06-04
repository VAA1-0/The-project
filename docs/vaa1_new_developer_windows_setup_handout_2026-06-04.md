# VAA1 New Developer Windows Setup Handout

Date: 2026-06-04

Audience: a colleague who has a new Windows development computer and has not coded before.

Goal: install the supporting software, place the VAA1/Datascene project on the machine, run the simplest VAA1 startup path, and know what information to send if something fails.

## Plain-English Picture

VAA1/Datascene is not one small app. It is a local research workstation made of several parts:

- Python backend: runs the analysis server and video/audio/NLP pipelines.
- Frontend: the browser/Electron interface where the analyst works.
- Docker: runs containerized services such as CVAT when annotation exchange is needed.
- FFmpeg: supports video/audio reading, conversion, and extraction.
- YOLOv8/Ultralytics: supports object detection when enabled.
- VS Code: lets us open and inspect the project.
- Git: lets us receive updates from the project repository.

Do not worry if these words are new. The installation order below is the important part.

## Recommended Operating System

Use Windows 11, 64-bit.

Before installing tools:

- Run Windows Update.
- Restart the computer.
- Make sure the Windows user account has permission to install software.
- Keep at least 40-80 GB free disk space. Docker, Python packages, video outputs, and model files can grow quickly.

## Install Order

Install in this order:

1. VS Code.
2. Git for Windows.
3. Miniconda.
4. Node.js LTS.
5. Docker Desktop.
6. FFmpeg.
7. VAA1 project folder.
8. VAA1 Python and frontend dependencies.
9. First run.

## 1. Install VS Code

Download:

```text
https://code.visualstudio.com/Download
```

Choose:

- Windows,
- User Installer,
- x64.

During install, select these options if shown:

- Add "Open with Code" action to Windows Explorer file context menu.
- Add "Open with Code" action to Windows Explorer directory context menu.
- Add to PATH.

After install, open VS Code once.

Recommended VS Code extensions:

- Python,
- Pylance,
- Jupyter,
- Docker,
- ESLint,
- Prettier,
- GitLens, optional.

## 2. Install Git For Windows

Download:

```text
https://git-scm.com/install/windows
```

Use the default installer choices unless someone on the VAA1 team says otherwise.

After install, open PowerShell and run:

```powershell
git --version
```

Expected: it prints a Git version.

## 3. Install Miniconda

Download:

```text
https://www.anaconda.com/docs/getting-started/miniconda/install/windows-gui-install
```

Choose the Windows graphical installer.

Recommended installer choices:

- Install for: Just Me.
- Do not add Miniconda to PATH unless the installer/team specifically recommends it.
- Register Miniconda as the default Python: acceptable for this VAA1 development machine.

After install, open "Anaconda Prompt" from the Start menu and run:

```bat
conda --version
python --version
```

Expected:

- Conda prints a version.
- Python prints a version.

VAA1 currently targets a Python 3.10-style environment in its local environment files. If a different Python version appears in the base prompt, that is usually fine because the VAA1 environment will have its own Python.

## 4. Install Node.js LTS

Download:

```text
https://nodejs.org/en/download
```

Choose:

- Windows Installer,
- LTS version,
- x64.

After install, open a new PowerShell and run:

```powershell
node --version
npm --version
```

Expected: both commands print versions.

## 5. Install Docker Desktop

Download:

```text
https://docs.docker.com/desktop/setup/install/windows-install/
```

Docker Desktop on Windows normally uses WSL 2. During install, allow Docker to enable WSL 2 if it asks.

After install:

1. Restart the computer.
2. Open Docker Desktop.
3. Wait until Docker says it is running.
4. Open PowerShell and run:

```powershell
docker --version
docker compose version
docker ps
```

Expected:

- Docker prints a version.
- Docker Compose prints a version.
- `docker ps` prints a table, possibly empty.

If Docker asks for a license or sign-in, read the screen carefully. VAA1 release work should treat licensed/paid/remote services as user-chosen, not hidden defaults.

## 6. Install FFmpeg

FFmpeg is needed by many video/audio workflows.

Official FFmpeg page:

```text
https://www.ffmpeg.org/download.html
```

On Windows, FFmpeg points users to Windows builds. If the team has a preferred FFmpeg build or packaged binary, use the team-provided one.

After install, open a new PowerShell and run:

```powershell
ffmpeg -version
ffprobe -version
```

Expected: both commands print version information.

Important VAA1 governance note:

- FFmpeg use should be visible and configurable before release.
- If FFmpeg is missing, VAA1 should report that clearly instead of failing silently.

## 7. Put The VAA1 Project On The Computer

Recommended folder:

```text
C:\VAA1\The-project
```

There are two possible ways to get the project.

### Option A. Receive A Project Folder

If Petteri or the team gives you a project folder or zip:

1. Create `C:\VAA1`.
2. Extract/copy the project into `C:\VAA1\The-project`.
3. In VS Code, choose:

```text
File -> Open Folder -> C:\VAA1\The-project
```

### Option B. Clone With Git

Use this only if you have repository access.

Open PowerShell:

```powershell
cd C:\
mkdir VAA1
cd VAA1
git clone <repository-url> The-project
cd The-project
```

Then open the folder in VS Code:

```powershell
code .
```

## 8. First Setup Check Inside The Project

Open PowerShell or Anaconda Prompt inside:

```text
C:\VAA1\The-project
```

Run:

```powershell
dir
```

You should see files such as:

- `api_server.py`,
- `requirements.txt`,
- `src`,
- `scripts`,
- `run_vaa1.bat`,
- `run_vaa1_lite.bat`.

## 9. First Run: Use The Launcher If Available

For a non-coder, try the launcher first.

In Windows Explorer, open:

```text
C:\VAA1\The-project
```

Double-click:

```text
run_vaa1_lite.bat
```

This tries to start:

- backend on `http://localhost:8000`,
- frontend/dashboard in the browser.

If the full CVAT/Docker setup is ready, the main launcher may be used:

```text
run_vaa1.bat
```

First launch can take several minutes. Watch Docker Desktop and any terminal windows that appear.

## 10. Manual Development Startup

Use this if the launcher does not work or if the team wants a development run.

### Backend

Open Anaconda Prompt in the project root:

```bat
cd C:\VAA1\The-project
```

If an environment file is provided and works:

```bat
conda env create -f environment.yml
conda activate vaa1_compatible
```

If the environment already exists:

```bat
conda activate vaa1_compatible
```

If the environment file fails, ask the VAA1 team before trying random fixes. Python video/ML dependencies are large, and blind repairs can make the machine harder to support.

After activating the environment:

```bat
python tests\test_critical_deps.py
python api_server.py
```

Expected:

- backend starts on `http://localhost:8000`,
- health route should respond at `http://localhost:8000/api/health`.

### Frontend

Open a second PowerShell:

```powershell
cd C:\VAA1\The-project\src\frontend
npm install
$env:NEXT_PUBLIC_API_URL="http://127.0.0.1:8000"
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Then open:

```text
http://127.0.0.1:3001/dashboard
```

## 11. CVAT And Docker Path

VAA1 can run core analysis without making CVAT the first milestone.

After the core app opens, CVAT can be started later if needed.

Check Docker:

```powershell
docker ps
```

If CVAT is needed, follow the current VAA1 team instructions for:

- `src\cvat\cvat-engine`,
- `src\cvat\backend`,
- Docker Compose startup,
- CVAT UI on `http://localhost:8080`.

Do not spend the first day debugging CVAT before confirming the basic backend/frontend works.

## 12. YOLOv8 / Ultralytics Note

YOLOv8/Ultralytics supports object detection.

For development:

- It may be installed inside the VAA1 Python environment.
- It may download model files on first use.
- It may be CPU-only unless the machine has a configured NVIDIA GPU/CUDA environment.

For release governance:

- YOLOv8/Ultralytics activation should be user-visible.
- Alternatives or disabled-state workflows must exist for release.
- VAA1 should not silently depend on YOLOv8 if the user has not chosen/activated it.

## 13. Simple Verification Checklist

Run these in PowerShell or Anaconda Prompt and copy the output into a message if asking for help:

```powershell
git --version
node --version
npm --version
docker --version
docker compose version
docker ps
ffmpeg -version
ffprobe -version
```

In Anaconda Prompt:

```bat
conda --version
python --version
cd C:\VAA1\The-project
dir
```

If the VAA1 Python environment exists:

```bat
conda activate vaa1_compatible
python tests\test_critical_deps.py
```

## 14. What To Send When Something Fails

Send:

- A screenshot of the error.
- Which step number failed.
- The command that was run.
- The full terminal output.
- Whether Docker Desktop is open and says it is running.
- The contents of:

```text
C:\VAA1\The-project\logs\vaa1-launch.log
C:\VAA1\The-project\logs\vaa1-lite.log
```

if those files exist.

## 15. Rules Of Thumb

- Do not delete random files from the project.
- Do not install packages globally unless the team asks.
- Do not run commands as Administrator unless the installer requires it.
- Do not change Docker ports manually unless instructed.
- Restart the computer after installing Docker Desktop.
- Keep the project in a simple path such as `C:\VAA1\The-project`.
- If a command fails twice in the same way, stop and send the output.

## Official Download Links

- VS Code: `https://code.visualstudio.com/Download`
- Git for Windows: `https://git-scm.com/install/windows`
- Miniconda: `https://www.anaconda.com/docs/getting-started/miniconda/install/windows-gui-install`
- Node.js: `https://nodejs.org/en/download`
- Docker Desktop for Windows: `https://docs.docker.com/desktop/setup/install/windows-install/`
- FFmpeg: `https://www.ffmpeg.org/download.html`

## First Milestone

The first success is modest:

```text
VAA1 dashboard opens in the browser.
Backend health route responds.
A short sample video can be uploaded or reopened.
```

Do not try to solve every model, CVAT, detector, and packaging issue before this first milestone.
