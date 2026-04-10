# VAA1 First-Boot Runbook

Date: 2026-03-20
Goal: shortest reliable path to seeing VAA1 actually running on this Mac workspace

## Recommended Canonical Path

Backend:
- `api_server.py`

Frontend:
- `src/frontend`

Environment source:
- `environment-MacOS-core.yml`

## Why This Path

- `api_server.py` is the most complete backend entrypoint
- it aligns with recent backend hardening and tests
- the Dockerfile also launches `api_server.py`
- it lets us validate the app without taking on CVAT complexity first

## Step 1. Prepare Python Environment

Preferred route:

```bash
conda env create -f environment-MacOS-core.yml
conda activate vaa1_core
```

If the environment already exists:

```bash
conda activate vaa1_core
```

## Step 2. Smoke-Test Critical Imports

Run:

```bash
python3 tests/test_critical_deps.py
```

Minimum success goal:
- `cv2`
- `ultralytics`
- `easyocr`
- `whisper`
- `ffmpeg`

Also verify API packages if needed:

```bash
python3 - <<'PY'
import fastapi, uvicorn, pandas, numpy
print("core backend imports ok")
PY
```

## Step 3. Start Backend

From project root:

```bash
python3 api_server.py
```

Expected:
- backend on `http://localhost:8000`
- docs on `http://localhost:8000/docs`

Quick health target:
- health/status endpoints should respond once the app is up

## Step 4. Start Frontend

In a second terminal:

```bash
cd src/frontend
npm run dev
```

Expected:
- frontend on `http://localhost:3000`

## Step 5. First Functional Check

Recommended first check:
- open the frontend
- upload a short sample video
- launch a standard analysis with default settings

Good local sample candidates:
- `samples/Helsinki_short.mp4`
- `samples/english_brazil_short.mp4`

For the very first run, prefer the shortest sample available.

## Step 6. If Backend Fails

Check first:
- missing Python packages
- failed model initialization
- ffmpeg availability
- file permission/path issues in `uploads/` or `outputs/`

Most likely current failure mode:
- environment not active or incomplete

## Step 7. Defer These Until After First Boot

Do not make these part of the first successful run:
- full CVAT engine startup
- proxy container setup
- Electron mode
- deeper architecture/backbone work

Reason:
- these add setup complexity before we even confirm the core app path

## CVAT Recovery After Core Boot

If CVAT is needed later and does not respond:

1. make sure Docker Desktop is actually running
2. verify Docker responds with `docker ps`
3. start the CVAT engine from `src/cvat/cvat-engine`
4. start the CVAT backend from `src/cvat/backend`
5. verify:
   - `http://localhost:8080`
   - `http://localhost:3001/health/cvat`

Important:
- the project root `docker-compose.yml` does not start CVAT
- CVAT must be started separately
- VAA1 may still run while CVAT is offline

## Canonical Recommendation

For the next session, the best first move is:

```bash
conda activate vaa1_core
python3 tests/test_critical_deps.py
python3 api_server.py
```

Then, in another terminal:

```bash
cd src/frontend
npm run dev
```

That is the shortest route to a real, inspectable VAA1 run on this machine.
