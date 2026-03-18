# VAA1 — Video Analysis Automation 1.0

VAA1 is an open-source pipeline designed to automate the first stages of video analysis, transforming raw footage into structured, research-ready data. Its goal is simple: make video a practical, accessible, and analyzable resource for everyone.

---

## Quick Start

VAA1 is currently being tested on **Windows** and can be run using a **single installer or launcher**. No terminal usage is required.

### Option A — Windows Installer

```
VAA1_Setup.exe
```

**What the installer does**

* Guided setup wizard (Next → Next → Finish)
* Installs the Electron desktop app
* Installs and configures the backend services
* Creates Start Menu and Desktop shortcuts
* Sets up automatic health checks
* Supports clean uninstall

After installation, simply launch **VAA1** from the Start Menu.

---

### Option B — Portable One‑Click Launcher

```
run_vaa1.bat
```
Download the repo,
Double‑click the file and follow on‑screen messages.

---

## 🔍 What Happens Automatically

When you start VAA1 (installer or launcher), it will:

* Verify **Docker Desktop** is installed and running
* Verify **Python** and **Node.js** availability
* Start CVAT engine, backend API, proxy, and frontend
* Build Docker images if they do not exist
* **Detect and safely free required ports**
* Perform health checks on all services
* Launch the Electron desktop application

No manual configuration or command‑line input is required.

---

## 🌐 Ports Used

The following ports are used for this project,
make sure there are no services running on them:

* **8000** — Backend API
* **3000** — Frontend / Electron
* **8091** — CVAT proxy
* Internal Docker ports used by CVAT

If a port is already in use, the launcher will NOT resolve it automatically when safe to do so.

---

## 🧰 Health Checks & Automatic Recovery

During startup and runtime, VAA1 continuously checks:

* Docker daemon status
* CVAT engine availability
* Backend API health (`/api/health`)
* Frontend responsiveness

### If something goes wrong

VAA1 will automatically:

* Restart failed services
* Rebuild missing containers
* Retry startup steps

If user action is required, a **clear, human‑readable message** is shown (no logs or technical errors).

### Logs

A detailed log file is saved at:

```
logs/vaa1-launch.log
```

This file can be shared when reporting issues.

---

## Why VAA1?

1. **The explosion of video data**
   More video is produced today than any human could ever watch.

2. **Open science & FAIR principles**
   Transparency, accessibility, and reproducibility are now required.

3. **A missing piece**
   An open, affordable, end‑to‑end video analysis pipeline.

---

## What VAA1 Provides

A unified open‑source pipeline for:

* Metadata extraction
* Transcription
* Object and expression recognition
* Audio & visual intelligence
* Quantitative text features
* Research‑ready structured outputs

---

## 🛠 Manual Setup (Advanced / Fallback)

Use this section **only if the installer or launcher is unavailable or fails**.

### Prerequisites

* Python 3.8+ (added to PATH)
* Docker Desktop (running)
* Node.js and npm

---

### Install dependencies

From the project root:

```bash
pip install -e .
```

```bash
npm install
```

If dependencies are not recognized, also run `npm install` in:

* `src/frontend`
* `src/cvat/backend`

---

## Running the Project Manually

⚠️ All components must run simultaneously.

### CVAT — Engine

```bash
cd src/cvat/cvat-engine
docker compose up -d
```

### CVAT — Backend

```bash
cd src/cvat/backend
npm run dev
```

---

### Proxy

1. Create `.env.local` in `src/frontend`

```bash
NEXT_PUBLIC_CVAT_BASE_URL=http://localhost:8091
```

2. Run the proxy container (replace path):

```bash
docker run --rm -p 8091:80 -v D:/work/the-project/cvat-proxy.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine
```

---

### Backend

```bash
docker build --no-cache -t video-analysis-app .
docker run -p 8000:8000 video-analysis-app
```

---

### Frontend

```bash
cd src/frontend
npm run dev
```

or Electron:

```bash
npm run start:electron
```

---

## User Guide

See `USER_GUIDE.md` for UI instructions.

---

## Licensing

GNU Affero General Public License v3.0 (AGPL‑3.0)

Required due to AGPL‑licensed components (YOLOv8).
All source code is publicly available.

Third‑party licenses are listed in `THIRD_PARTY_LICENSES.md`.
