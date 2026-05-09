# VAA1 Mac Startup Runbook

Date: 2026-05-03

This is the current stable Mac startup path for local VAA1 development and manual testing.

## Canonical Command

From the repository root:

```bash
bash scripts/start_vaa1_macos.sh
```

Then open:

```text
http://127.0.0.1:3001/dashboard
```

The launcher starts or verifies:

- backend API on `127.0.0.1:8000`
- frontend on `127.0.0.1:3001`
- local runtime caches under `.cache/vaa1-runtime`
- the evidence proliferation matching route in the backend OpenAPI map

## First Setup Or Dependency Refresh

Use this when a Mac environment is missing packages or after environment files change:

```bash
bash scripts/start_vaa1_macos.sh --setup-envs --replace
```

This updates both Mac Conda environments:

- `environment-MacOS-core.yml` -> `vaa1_core`
- `environment-MacOS-face.yml` -> `vaa1_face`

It also verifies important imports in both environments before startup.

## Normal Recovery

If old terminals or stale local processes are occupying ports:

```bash
bash scripts/start_vaa1_macos.sh --replace
```

`--replace` is deliberately explicit. The launcher does not silently kill unknown port owners
unless the user asks for replacement.

## Backend-Only Check

```bash
bash scripts/start_vaa1_macos.sh --backend-only --replace
```

Useful checks:

```bash
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS http://127.0.0.1:8000/openapi.json | grep '/api/analysis/{analysis_id}/proliferation/match'
```

## Frontend-Only Check

```bash
bash scripts/start_vaa1_macos.sh --frontend-only --replace
```

The frontend is started with:

```text
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## Security And Stability Rules

- Bind development services to `127.0.0.1`, not public network interfaces.
- Use the Conda environments as the source of truth; do not start the backend from `.venv`.
- Keep runtime caches inside `.cache/vaa1-runtime` so Matplotlib, Ultralytics, and XDG cache
  writes do not scatter across the user home directory.
- Do not update Conda environments during every startup; use `--setup-envs` only when needed.
- Do not kill occupied ports automatically; use `--replace` when old VAA1 processes should be
  replaced.

## Manual Fallback

Backend:

```bash
cd "/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project"
mkdir -p .cache/vaa1-runtime/matplotlib .cache/vaa1-runtime/ultralytics .cache/vaa1-runtime/xdg
MPLCONFIGDIR="$PWD/.cache/vaa1-runtime/matplotlib" \
YOLO_CONFIG_DIR="$PWD/.cache/vaa1-runtime/ultralytics" \
XDG_CACHE_HOME="$PWD/.cache/vaa1-runtime/xdg" \
conda run -n vaa1_core python -m uvicorn api_server:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd "/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project/src/frontend"
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3001
```

## Analyst-Facing Error Language

When the evidence proliferation matcher is unavailable, UI language should avoid backend/frontend
production terminology. Preferred message:

```text
Candidate search is not available in the running analysis service yet. Refresh the analysis
service, then prepare candidates again.
```
