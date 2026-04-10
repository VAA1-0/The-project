# VAA1 CVAT Runtime Recovery Runbook

Date: 2026-04-10
Purpose: recover CVAT when VAA1 cannot open annotation jobs or CVAT appears absent

## What This Problem Usually Is

In this project, CVAT failure has often meant:

- Docker Desktop is installed but not actually running
- the CVAT engine on `localhost:8080` is not up
- the local CVAT bridge backend on `localhost:3001` is not up
- VAA1 core still works, which can hide the fact that annotation runtime is missing

This is not the same as a completed VAA1-CVAT integration failure. Often the runtime stack itself is simply absent.

## Expected Runtime Chain

For CVAT annotation to work with VAA1, the following chain must be alive:

1. Docker Desktop
2. CVAT engine in `src/cvat/cvat-engine`
3. CVAT bridge backend in `src/cvat/backend`
4. optionally the proxy on `8091`
5. VAA1 frontend/backend

## Ports

- `8000`: VAA1 backend
- `3000`: VAA1 frontend
- `3001`: local CVAT bridge backend
- `8080`: CVAT engine / UI
- `8091`: optional CVAT proxy

## Recovery Procedure

### Step 1. Start Docker Desktop

If Docker is installed but not running, start it first.

Verify:

```bash
docker ps
```

If this fails, CVAT cannot start.

### Step 2. Start the CVAT engine

```bash
cd src/cvat/cvat-engine
docker compose up -d
```

Verify:

```bash
curl -I http://localhost:8080
```

Expected:
- CVAT responds on `8080`

### Step 3. Start the CVAT bridge backend

```bash
cd src/cvat/backend
npm run dev
```

Verify:

```bash
curl http://localhost:3001/health/cvat
```

Expected:
- the bridge backend responds
- if authentication is valid, health should report success

### Step 4. Optional proxy

If you are using embedded CVAT routing through the frontend, configure:

`src/frontend/.env.local`

```bash
NEXT_PUBLIC_CVAT_BASE_URL=http://localhost:8091
```

Then run the nginx proxy if needed.

For side-by-side coordination, this proxy is not the first requirement. The engine and bridge are the primary runtime needs.

## What To Check If It Still Fails

### Docker is installed but `docker ps` fails

Likely cause:
- Docker Desktop daemon is not running

### `8080` does not respond

Likely cause:
- CVAT engine stack is not started
- image pull or container startup is still in progress

### `3001` does not respond

Likely cause:
- CVAT backend bridge is not started

### CVAT login fails

Likely cause:
- CVAT engine is up but auth is invalid or expired
- saved token/cookie state is stale

### VAA1 runs but annotation does not

Likely cause:
- VAA1 core backend/frontend are fine
- CVAT runtime chain is missing

## Important Project Reality

- the root `docker-compose.yml` does not launch CVAT
- CVAT must be started separately from `src/cvat/cvat-engine`
- the VAA1 frontend may still load and operate without CVAT
- this can create the false impression that “CVAT integration is broken” when the runtime stack is simply absent

## Recommended Verification Order

Always verify in this order:

1. `docker ps`
2. `curl -I http://localhost:8080`
3. `curl http://localhost:3001/health/cvat`
4. CVAT login
5. task creation
6. job listing
7. annotation page load

## VAA1-Side Correction Applied

The project now ensures the CVAT auth cache directory is created before writing the saved token file:

- `src/cvat/backend/data/GlobalVariables.ts`

This removes one avoidable local auth-persistence failure mode.
