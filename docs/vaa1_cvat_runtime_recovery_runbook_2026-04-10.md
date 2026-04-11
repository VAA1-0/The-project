# VAA1 CVAT Connection And Runtime Recovery Runbook

Date: 2026-04-10
Updated: 2026-04-11
Purpose: recover and verify the real VAA1-to-CVAT annotation path on this Mac workspace

## What This Runbook Covers

This runbook now reflects the current local reality:

- CVAT runtime can be brought up locally
- VAA1 can create CVAT tasks from the annotation page
- large-video upload needed a bridge-side fix
- CVAT iframe access depends on the browser being logged into the correct CVAT user
- annotation is no longer just a container-start problem, it is also a session and workflow problem

This document is for:

1. recovering the runtime
2. verifying the live connection
3. avoiding the most common false diagnoses

## Current Runtime Chain

For VAA1 annotation to work locally, this chain must be alive:

1. Docker Desktop
2. CVAT engine in `src/cvat/cvat-engine`
3. CVAT bridge backend in `src/cvat/backend`
4. VAA1 backend in project root
5. VAA1 frontend in `src/frontend`
6. browser logged into the correct CVAT user on `http://localhost:8080`

If the last step is wrong, task creation may work but the iframe still fails with `403`.

## Recommended Terminal Layout

Use a fixed terminal structure. This reduces confusion during recovery.

1. `General`
2. `Backend`
3. `Frontend`
4. `CVAT Bridge`
5. `Git`

Definitions:

- `General`
  one-off commands, `curl`, `open`, Docker checks
- `Backend`
  VAA1 backend only
- `Frontend`
  VAA1 frontend only
- `CVAT Bridge`
  local CVAT bridge only
- `Git`
  git-only work

## Ports

- `3000`: VAA1 frontend
- `3001`: local CVAT bridge backend
- `8000`: VAA1 backend
- `8080`: CVAT UI and API
- `8090` and `8091`: optional Traefik-related ports, not the main annotation path

## Canonical Startup Order

### Step 1. Start Docker Desktop

Verify in `General`:

```bash
docker ps
```

If this fails, stop here and start Docker Desktop first.

### Step 2. Start CVAT engine

Run in `General`:

```bash
cd "/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project/src/cvat/cvat-engine"
docker compose up -d
```

Verify in `General`:

```bash
curl -I "http://localhost:8080/api/server/about"
```

Expected:

- `HTTP/1.1 200 OK`
- `Server: nginx/1.23.3`

### Step 3. Start CVAT Bridge

Run in `CVAT Bridge`:

```bash
cd "/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project/src/cvat/backend"
npm run dev
```

Verify in `General`:

```bash
curl -sS "http://localhost:3001/health/cvat"
```

Expected:

- `{"ok":true,"tokenValid":true}`

### Step 4. Start VAA1 backend

Run in `Backend`:

```bash
cd "/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project"
conda run -n vaa1_core python -u api_server.py
```

### Step 5. Start VAA1 frontend

Run in `Frontend`:

```bash
cd "/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project/src/frontend"
npm run dev -- --webpack
```

Verify:

- frontend available on `http://localhost:3000`

## Connection Test Procedure

### Step 1. Reset the analysis CVAT link

Run in `General`:

```bash
curl -sS -X POST "http://localhost:8000/api/status/f287a423-810a-4734-9109-7993e06cf054/cvat-link" -H "Content-Type: application/json" -d '{"cvatID":0,"origin":"manual_reset_before_connection_test"}'
```

### Step 2. Open annotation from VAA1

Run in `General`:

```bash
open "http://localhost:3000/annotate/f287a423-810a-4734-9109-7993e06cf054"
```

### Step 3. Watch for task creation

Run in `General`:

```bash
curl -sS "http://localhost:3001/api/tasks"
```

Expected:

- a new task appears

### Step 4. Check jobs for the newest task

Run in `General` with the newest task id:

```bash
curl -sS "http://localhost:3001/api/tasks/6/jobs"
```

Replace `6` with the actual newest task id.

### Step 5. Confirm CVAT link storage

Run in `General`:

```bash
python3 -c 'import json,urllib.request; data=json.load(urllib.request.urlopen("http://localhost:8000/api/status/f287a423-810a-4734-9109-7993e06cf054")); print(data.get("cvatID"))'
```

Expected:

- a nonzero task id

## Known Current Behavior

### 1. VAA1 can create CVAT tasks

This is currently working locally.

Observed:

- annotation page can create a CVAT task when `cvatID` is missing
- bridge-side upload now uses chunked TUS-style upload instead of one giant request

### 2. Large-video upload no longer belongs to the old one-shot path

The earlier `413 Request Entity Too Large` failure was part of the old bridge behavior.

Applied local corrections:

- `src/cvat/backend/cvatRoutes/cvat-uploadData.ts`
  - moved upload flow to chunked/TUS-style logic
  - waits for CVAT task processing status before returning
- `src/cvat/cvat-engine/cvat-ui/local-default.conf`
  - sets `client_max_body_size 0;`

### 3. Annotation iframe still depends on browser-side CVAT login

This is the most important current workflow caveat.

Even if:

- VAA1 creates the task
- the bridge is healthy
- the VAA1 backend stores the `cvatID`

the CVAT iframe can still fail if the browser is logged into the wrong CVAT user.

Observed real failure:

- task created by `admin`
- browser session still logged into `MPL10`
- iframe fails with `403`
- CVAT UI shows:
  - `Error during fetching a job`
  - `You do not have permission to perform this action.`

### 4. Immediate local workaround for iframe auth mismatch

Open in browser:

```bash
http://localhost:8080
```

Then:

1. log out wrong user if necessary
2. log into the correct CVAT user
3. reopen the VAA1 annotation page

For current local testing, this has meant logging into:

- user: `admin`
- password: `admin123`

This is acceptable only as a temporary local recovery measure.

## Important Diagnosis Rules

### If `3001/health/cvat` fails

Likely cause:

- CVAT Bridge is not running
- token or cookie state is stale

### If VAA1 annotation creates a task but shows no jobs

Check:

```bash
curl -sS "http://localhost:3001/api/tasks"
curl -sS "http://localhost:3001/api/tasks/<taskId>/jobs"
```

Possible causes:

- upload still processing
- upload failed
- task exists but job creation has not finished

### If VAA1 annotation reaches CVAT but CVAT says permission denied

Likely cause:

- browser logged into wrong CVAT user
- not a Docker problem
- not a VAA1 backend health problem

This is a session/user mismatch problem.

### If `localhost:3000` refuses connection

Likely cause:

- VAA1 frontend not running in `Frontend`

### If `localhost:8000` status output floods the terminal

Use a filtered or Python one-liner check instead of dumping full JSON.

Preferred:

```bash
python3 -c 'import json,urllib.request; data=json.load(urllib.request.urlopen("http://localhost:8000/api/status/f287a423-810a-4734-9109-7993e06cf054")); print(data.get("cvatID"))'
```

## Current Local Code Corrections Applied

The following local changes are now part of the practical CVAT↔VAA1 connection path:

- `src/frontend/components/AnnotatePage.tsx`
  - creates missing CVAT tasks
  - waits longer for jobs
  - avoids hard failure when CVAT link persistence temporarily fails
- `src/frontend/lib/api-service.ts`
  - added CVAT link update endpoint usage
- `src/frontend/lib/video-service.ts`
  - clears caches after CVAT link update
- `api_server.py`
  - added `POST /api/status/{analysis_id}/cvat-link`
- `src/cvat/backend/cvatRoutes/cvat-uploadData.ts`
  - added chunked upload and task-status waiting
- `src/cvat/backend/server.ts`
  - adjusted CORS for credentialed local requests
- `src/frontend/cvat-api/client.ts`
  - CVAT login request now includes browser credentials
- `src/cvat/cvat-engine/cvat-ui/local-default.conf`
  - unlimited local nginx body size

## What Is Still Not Finished

The connection is better, but the product-level workflow is not mature yet.

Still missing:

1. per-user VAA1↔CVAT login handoff
2. automatic browser-side CVAT session establishment on the actual `8080` origin
3. removal of shared `admin/admin123` from normal workflow
4. first-time annotation onboarding flow
5. reconnect flow after session expiry
6. role and permission protocol for many users

## Current Recommendation

Use this runbook only as the runtime-recovery and live-connection guide.

Do not treat it as the final user protocol.

The next document should be a separate:

- VAA1↔CVAT access protocol

covering:

- first-time login
- recurring use
- role model
- session expiry behavior
- admin vs analyst responsibilities
