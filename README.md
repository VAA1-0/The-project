# VAA1 — Video Analysis Automation 1.0

VAA1 is an open-source pipeline designed to automate the first stages of video analysis, transforming raw footage into structured, research-ready data. Its goal is simple: make video a practical, accessible, and analyzable resource for everyone.

---

## Current Development Focus

The current development period is **Operational Evidence and Analysis Core**.

The primary objective is to harden VAA1 into a controlled evidence system where all analytical claims are traceable, correctable, and governed by a mature data proliferation regime.

This work begins with a mandatory discovery sprint to create a comprehensive inventory of the system's data attributes and their operational semantics.

-   **Governing Sprint Plan:** [`docs/sprint_program_empirical_taxonomy_discovery_2026-07-12.md`](./docs/sprint_program_empirical_taxonomy_discovery_2026-07-12.md)
-   **Architectural Context:** `docs/architecture/vaa1_data_attribute_inventory_report_2026-07-12.md`

All subsequent work on the Data Maturation Proliferation Regime v2 depends on the successful completion of this empirical audit.

---

## Quick Start On Mac For Local Development

> **Important runtime note:** the repository `.venv` is not used to run Datascene/VAA1. Do not start the backend with `.venv/bin/python`. Read `docs/vaa1_macos_startup_runbook_2026-05-03.md` and use the two documented Conda environments: `vaa1_core` and `vaa1_face`.

The current Mac development startup path is:

```bash
bash scripts/start_vaa1_macos.sh
```

Then open:

```text
http://127.0.0.1:3001/dashboard
```

For first setup, dependency repair, or after Mac environment files change:

```bash
bash scripts/start_vaa1_macos.sh --setup-envs --replace
```

The Mac launcher uses and verifies both repository Conda environments:

* `vaa1_core` from `environment-MacOS-core.yml`
* `vaa1_face` from `environment-MacOS-face.yml`

`vaa1_core` runs the main API and analytical pipeline. `vaa1_face` supplies the separate face/DeepFace capability. Both environments must be present and verified for the full program array; neither is replaced by `.venv`.

It binds services to `127.0.0.1`, keeps runtime caches inside `.cache/vaa1-runtime`, checks the
backend health route, and verifies that the evidence proliferation matching route is present.
See `docs/vaa1_macos_startup_runbook_2026-05-03.md` for recovery options and manual fallback
commands.

---

## Quick Start (Recommended — One‑Click on Windows)

VAA1 is currently being tested on **Windows** and can be run using a **single installer or launcher**. No terminal usage is required.

### Option A — Windows Installer (Best for most users)

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

* No installation required
* Runs directly from the project folder
* Ideal for testing and development

Double‑click the file and follow on‑screen messages.

---

## 🔍 What Happens Automatically

When you start VAA1 (installer or launcher), it will:

* Verify **Docker Desktop** is installed and running
* Verify **Python** and **Node.js** availability
* Start CVAT engine, bridge backend, and frontend
* Build Docker images if they do not exist
* **Detect and safely free required ports**
* Perform health checks on all services
* Launch the Electron desktop application

No manual configuration or command‑line input is required.

---

## 🌐 Ports Used

The following ports are managed automatically:

* **8000** — Backend API
* **3000** — Frontend / Electron
* **3001** — Local CVAT bridge backend
* **8080** — CVAT UI + API for local development
* **8090** — Internal Traefik web entrypoint
* **8091** — Internal Traefik dashboard / spare proxy port
* Internal Docker ports used by CVAT

If a port is already in use, the launcher will resolve it automatically when safe to do so.

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
* Release occupied ports
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

Unresolved interval
0:00.000 ~ 0:06.400
duration 0:06.400
Coverage marker
[Unresolvedaudiointerval]
Transcript span
0:06.400 ~ 0:08.400
duration 0:02.000
Confirmed
Sync clock
Edit span
WhywouldIbetrayyou?
Transcript span
0:08.400 ~ 0:10.400
duration 0:02.000
Confirmed
Sync clock
Edit span
Weallhaveoursecrets.
Transcript span
0:10.400 ~ 0:12.400
duration 0:02.000
Confirmed
Sync clock
Edit span
Wejustdidn'tgettoyoursyet.
Unresolved interval
0:12.400 ~ 0:20.960
duration 0:08.560
Coverage marker
[Unresolvedaudiointerval]
Transcript span
0:20.960 ~ 0:22.215
duration 0:01.255
Confirmed
Sync clock
Edit span
Theworldisarmingfasterthanwecanrespond.
Unresolved interval
0:22.215 ~ 0:26.000
duration 0:03.785
Coverage marker
[Unresolvedaudiointerval]
Transcript span
0:26.000 ~ 0:28.000
duration 0:02.000
Confirmed
Sync clock
Edit span
Where's007?
Transcript span
0:28.000 ~ 0:30.000
duration 0:02.000
Confirmed
Sync clock
Edit span
Ineedafavor,brother.
Transcript span
0:30.000 ~ 0:32.000
duration 0:02.000
Confirmed
Sync clock
Edit span
You'retheonlyoneItrustforthis.
Unresolved interval
0:32.000 ~ 0:34.000
duration 0:02.000
Coverage marker
[Unresolvedaudiointerval]
Transcript span
0:34.000 ~ 0:36.000
duration 0:02.000
Confirmed
Sync clock
Edit span
Theworld'snewdawncommandareborn.
Transcript span
0:36.000 ~ 0:37.000
duration 0:01.000
Confirmed
Sync clock
Edit span
Youweredouble-o.
Transcript span
0:37.000 ~ 0:38.000
duration 0:01.000
Confirmed
Sync clock
Edit span
Twoyears.
Transcript span
0:38.000 ~ 0:40.000
duration 0:02.000
Confirmed
Sync clock
Edit span
Sostayinyourlane.
Transcript span
0:40.000 ~ 0:42.000
duration 0:02.000
Confirmed
Sync clock
Edit span
You'regettingmyway.
Transcript span
0:42.000 ~ 0:44.000
duration 0:02.000
Confirmed
Sync clock
Edit span
Iwillputabrothertoyourknee.
Unresolved interval
0:44.000 ~ 0:46.000
duration 0:02.000
Coverage marker
[Unresolvedaudiointerval]
Transcript span
0:46.000 ~ 0:48.000
duration 0:02.000
Confirmed
Sync clock
Edit span
Theonethatworks.
Transcript span
0:48.000 ~ 0:50.000
duration 0:02.000
Confirmed
Sync clock
Edit span
Ithoughtyou'ddoitgetalong.
Unresolved interval
0:50.000 ~ 0:52.000
duration 0:02.000
Coverage marker
[Unresolvedaudiointerval]
Transcript span
0:52.000 ~ 0:53.000
duration 0:01.000
Confirmed
Sync clock
Edit span
Name?
Transcript span
0:53.000 ~ 0:54.000
duration 0:01.000
Confirmed
Sync clock
Edit span
Bonda.
Unresolved interval
0:54.000 ~ 0:55.000
duration 0:01.000
Coverage marker
[Unresolvedaudiointerval]
Transcript span
0:55.000 ~ 0:56.000
duration 0:01.000
Confirmed
Sync clock
Edit span
Name?
Transcript span
0:56.000 ~ 0:57.000
duration 0:01.000
Confirmed
Sync clock
Edit span
Bonda.
Transcript span
0:57.000 ~ 0:58.000
duration 0:01.000
Confirmed
Sync clock
Edit span
I'mnotgoingtolosecontrol.
Transcript span
0:58.000 ~ 1:00.000
duration 0:02.000
Confirmed
Sync clock
Edit span
I'mnotgoingtolose.
Transcript span
1:00.000 ~ 1:02.000
duration 0:02.000
Confirmed
Sync clock
Edit span
Control.
Unresolved interval
1:02.000 ~ 1:04.000
duration 0:02.000
Coverage marker
[Unresolvedaudiointerval]
Transcript span
1:04.000 ~ 1:08.000
duration 0:04.000
Confirmed
Sync clock
Edit span
James,yougaveupeverythingforher.
Unresolved interval
1:08.000 ~ 1:12.000
duration 0:04.000
Coverage marker
[Unresolvedaudiointerval]
Transcript span
1:12.000 ~ 1:14.000
duration 0:02.000
Confirmed
Sync clock
Edit span
I'mnotgoingtolosecontrol.
Transcript span
1:14.000 ~ 1:16.000
duration 0:02.000
Confirmed
Sync clock
Edit span
I'mnotgoingtolosecontrol.
Transcript span
1:16.000 ~ 1:20.000
duration 0:04.000
Confirmed
Sync clock
Edit span
James,yougaveupeverythingforher.
Unresolved interval
1:20.000 ~ 1:24.000
duration 0:04.000
Coverage marker
[Unresolvedaudiointerval]
Transcript span
1:24.000 ~ 1:31.000
duration 0:07.000
Confirmed
Sync clock
Edit span
Whenhersecretfindsitswayout,there'llbethedeathofhim.
Transcript span
1:31.000 ~ 1:32.000
duration 0:01.000
Confirmed
Sync clock
Edit span
Whatisit?
Transcript span
1:32.000 ~ 1:37.000
duration 0:05.000
Confirmed
Sync clock
Edit span
Youdon'tknowwhatthisis.
Transcript span
1:37.000 ~ 1:40.000
duration 0:03.000
Confirmed
Sync clock
Edit span
JamesBond.
Transcript span
1:40.000 ~ 1:43.000
duration 0:03.000
Confirmed
Sync clock
Edit span
Licensetokill.
Transcript span
1:43.000 ~ 1:47.000
duration 0:04.000
Confirmed
Sync clock
Edit span
Historyofviolence.
Transcript span
1:47.000 ~ 1:52.000
duration 0:05.000
Confirmed
Sync clock
Edit span
Icouldbespeakingtomyownreflection.
Transcript span
1:52.000 ~ 1:55.000
duration 0:03.000
Confirmed
Sync clock
Edit span
Condidors.
Transcript span
1:55.000 ~ 2:00.000
duration 0:05.000
Confirmed
Sync clock
Edit span
MinewillsurvivelongafterI'mgone.
Transcript span
2:00.000 ~ 2:04.000
duration 0:04.000
Confirmed
Sync clock
Edit span
Historyisn'tkindtomenwhoplayGod.
Unresolved interval
2:04.000 ~ 2:20.000
duration 0:16.000
Coverage marker
[Unresolvedaudiointerval]
Transcript span
2:20.000 ~ 2:22.000
duration 0:02.000
Confirmed
Sync clock
Edit span
I'mnotarealman.
Transcript span
2:22.000 ~ 2:24.000
duration 0:02.000
Confirmed
Sync clock
Edit span
I'marealman.
Transcript span
2:24.000 ~ 2:26.000
duration 0:02.000
Confirmed
Sync clock
Edit span
I'marealman.
Transcript span
2:26.000 ~ 2:28.000
duration 0:02.000
Confirmed
Sync clock
Edit span
I'marealman.
Unresolved tail
2:28.000 ~ 2:35.105
duration 0:07.105
Coverage marker
[Unresolvedaudiotail]## What VAA1 Provides: From Raw Video to Governed Insight

VAA1 is an end-to-end analysis environment that turns raw video into a structured, navigable, and research-ready dataset. Its core features include:

*   **Multimodal AI Pipeline**: Automatically processes video to extract:
    *   **Visuals**: Object and person detection (YOLOv8), expression analysis (DeepFace), and OCR.
    *   **Audio**: High-quality transcription (Whisper) and state-of-the-art speaker diarization (`pyannote.audio`) to distinguish who is speaking.

*   **Mature Data Proliferation**: VAA1 learns from you. When an analyst confirms a speaker or character, the system uses that "mature evidence" to find that person in other parts of the video, proposing candidates for review instead of forcing repetitive manual work.

*   **Integrated Meaning Network**: A powerful visualization tool that maps the relationships between characters, scenes, and events over time. It now includes speaker timelines, providing an intuitive overview of the dialogue flow.

*   **StatsKit Workbench**: A dedicated panel for source-linked statistical analysis. It can perform speech-to-silence ratio analysis and provides the foundation for deeper dialogue metrics like speaker dominance and turn-taking frequency.

*   **Analyst-in-the-Loop Governance**: The core design principle of VAA1 is that the analyst is the final authority. Automated systems propose candidates, but manual corrections are treated as the source of truth, ensuring that all insights are traceable and governed.

*   **Research-Ready Outputs**: All generated data, from raw detections to mature, analyst-confirmed insights, is organized into structured artifacts ready for further research, reporting, or export.

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

Verify:

```bash
curl -I http://localhost:8080
```

### CVAT — Backend

```bash
cd src/cvat/backend
npm run dev
```

Verify:

```bash
curl http://localhost:3001/health/cvat
```

---

### CVAT Frontend Wiring

Create `.env.local` in `src/frontend`

```bash
NEXT_PUBLIC_CVAT_BASE_URL=http://localhost:8080
```

Notes:

* Local development now serves CVAT directly on `8080` through the CVAT UI container.
* The CVAT UI container also reverse-proxies the CVAT API for local use.
* The core CVAT runtime chain is:
  * Docker Desktop running
  * CVAT UI + API on `8080`
  * CVAT bridge backend on `3001`
* If Docker Desktop is installed but not running, CVAT will not start even though VAA1 core may still work.
* The legacy Traefik layer remains in the compose stack on backup ports, but local VAA1 no longer depends on it for the main CVAT URL.

### CVAT Runtime Recovery

If CVAT is unavailable:

1. start Docker Desktop
2. verify Docker responds:

```bash
docker ps
```

3. start the CVAT engine and local UI/API path:

```bash
cd src/cvat/cvat-engine
docker compose up -d
```

4. start the CVAT backend:

```bash
cd src/cvat/backend
npm run dev
```

5. verify both services:

```bash
curl -I http://localhost:8080
curl http://localhost:8080/api/server/about
curl http://localhost:3001/health/cvat
```

If these fail, VAA1 can still run without CVAT, but CVAT annotation will not function.

For a fuller recurrence checklist, see:

* `docs/vaa1_cvat_runtime_recovery_runbook_2026-04-10.md`

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
