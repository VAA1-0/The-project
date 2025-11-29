# Frontend — Backend Integration Notes

This document explains recent frontend changes, why they were made, and what backend developers need to implement to connect the frontend to a working backend. It also describes how to integrate the existing `VideoAnalysisAPI` class and important caveats for deployment and future improvements.

---

## Summary of recent frontend changes

- Added a small axios API client to centralize external backend calls:
  - `src/frontend/lib/api-client.ts` — creates an `axios` instance (`api`) with a configurable `baseURL`, timeout, credentials option and a response interceptor that unwraps `res.data` and logs errors.

- Added a client-side service that centralizes all video-related operations and fallback logic:
  - `src/frontend/lib/video-service.ts` — exposes `get`, `getBlob`, `getAnalysis`, `upload`, `rename`, `updateTag`, `delete`, and `list` methods. It tries (in order): external backend (via `api`/axios when `NEXT_PUBLIC_API_URL` is set), internal Next.js API routes (`/api/videos`) when available, and finally the local browser fallback (`local-library` + `blob-store`). It also provides a richer placeholder `getAnalysis` fallback used by the UI when no backend analysis is available.

- Added a minimal server-side metadata store for local development and quick prototyping:
  - `src/frontend/server/video-store.ts` — file-backed CRUD helpers that read/write `src/frontend/server/videos.json`.
  - `src/frontend/server/videos.json` — initial empty array file.
  - The Next.js API routes `src/frontend/app/api/videos/route.ts` and `src/frontend/app/api/videos/[id]/route.ts` were updated to use the server store instead of the client-only `local-library`.

- Implemented optimistic UI in the dashboard for upload/delete/rename/tag operations. Key behaviors:
  - Upload: blob saved immediately in browser IndexedDB (via `blob-store`) under a temporary id; optimistic metadata is inserted in the UI with `status: "pending"`. `VideoService.upload` runs in background; on resolution the UI reconciles the id/status and attempts to persist the final metadata.
  - Delete: item removed from UI immediately; the delete call is sent in background and the UI rolls back on failure.
  - Rename / Tag: UI updated immediately, background call to `VideoService` attempts to persist changes and the UI rolls back on failure.


___
___


## Why these changes were made

- Developer ergonomics: A lightweight in-repo API gives backend developers a concrete contract to implement or replace later. It also enables local testing and easier debugging.

- UX: Optimistic UI reduces perceived latency by showing immediate feedback while background operations complete.

- Migration path: Centralizing metadata operations through `/api/videos` (internal) or an external backend (`NEXT_PUBLIC_API_URL`) provides a single API surface for future backend integration.

___
___


## Where to look in the repo

- Frontend service and components:
  - `src/frontend/lib/video-service.ts` — the client-side service used by UI components.
  - `src/frontend/components/Dashboard.tsx` — contains optimistic UI flows for upload / delete / rename / tag.
  - `src/frontend/lib/local-library.ts` — client-side local metadata layer (localStorage fallback).
  - `src/frontend/lib/blob-store.ts` — client-side video blob storage (IndexedDB).

- In-repo server store and API routes:
  - `src/frontend/server/video-store.ts` — file-backed metadata store (dev-only, simple).
  - `src/frontend/app/api/videos/route.ts` and `src/frontend/app/api/videos/[id]/route.ts` — metadata API routes.

___
___


## Axios usage and why

- The project uses an `axios` instance (imported as `api` in `video-service.ts`) for external backend requests. Reasons:
  - Automatic JSON (de)serialization and response `data` extraction.
  - Easy configuration of base URL, headers, timeouts, and interceptors (auth, logging).
  - Unified error handling via response interceptors.

- Where to configure axios:
  - Update the `api` client (likely in `src/frontend/lib/api-client.ts`) to point its `baseURL` at the external backend (if you use `NEXT_PUBLIC_API_URL`). Backend devs should document auth headers and required CORS settings.

___
___


## API contract (what frontend expects)

The frontend currently interacts with these endpoints (internal `/api` or external backend). The minimal shapes expected are below.

- GET /api/videos
  - Response: `200` JSON array of video metadata
  - Example:
```json
[
  {"id":"123","name":"video.mp4","length":42,"tag":null,"analysis":null}
]
```

- POST /api/videos
  - Body: JSON metadata object (id optional when server generates id)
  - Response: `200` or `201` with `{ success: true, id?: "server-id" }` or the created object

- GET /api/videos/:id
  - Response: `200` JSON object or `404` / empty object if missing

- PATCH /api/videos/:id
  - Body: partial updates (e.g., `{ name: "new name" }`)
  - Response: `200` JSON `{ success: true }` or the updated object

- PUT /api/videos/:id
  - Body: partial updates (used for tag updates in current routes)
  - Response: `200` JSON `{ success: true }`

- DELETE /api/videos/:id
  - Response: `200` JSON `{ success: true }`

- Optional/Recommended additional endpoints
  - POST /api/videos/:id/blob — accept file uploads (server-side blob storage)
  - GET /api/videos/:id/blob — return video blob (stream)
  - GET /api/videos/:id/analysis — return analysis object (summary, transcript, detectedObjects, quantityDetection, annotations, rawCsv)

Notes about shapes
- `VideoItem` metadata the frontend uses (client-side):
  - `id: string`
  - `name: string`
  - `length: number` (seconds)
  - `tag: string | null`
  - `analysis: any | null` (may be null or an object with analysis results)

When implementing the backend, return consistent JSON shapes so the frontend's `VideoService` can parse `res.data` or the `fetch` JSON.

___
___


## How to make the backend work with the frontend (step-by-step)

1. Choose backend host URL (external) or use internal API routes:
   - External: set `NEXT_PUBLIC_API_URL` in frontend environment to `https://your-backend.example.com` (and configure `src/frontend/lib/api-client.ts` baseURL). The `VideoService` will use axios to call the external backend.
   - Internal: implement the REST endpoints under `/api/videos` in the Next.js app (we added a file-based prototype at `src/frontend/server/video-store.ts`). Backend devs can replace that file-based store with a database-backed implementation.

2. Ensure CORS and auth (if external):
   - If the backend is separate domain, allow CORS for the frontend origin and document any auth headers (e.g., Authorization: Bearer <token>). Update the axios `api` client to include credentials or tokens.

3. Implement metadata endpoints and (optionally) blob endpoints:
   - Metadata-only approach: backend stores only metadata and returns the same shape as the file-backed store. Blobs remain in browser IndexedDB.
   - Full approach (recommended long-term): support blob upload endpoints and store blobs on disk or object storage (S3). This enables serving video blobs from server and avoids relying on browser-only storage.

4. Implement analysis endpoints (if you want server-side analysis):
   - `GET /api/videos/:id/analysis` should return an analysis object with these possible fields:
```json
{
  "summary": "...",
  "transcript": [{"t":"00:00","speaker":"A","text":"..."}],
  "detectedObjects": [{"name":"Person","count":5,"firstSeen":"00:02","confidence":0.98}],
  "quantityDetection": [...],
  "annotations": [...],
  "rawCsv": "timestamp,object,confidence\n..."
}
```

5. Test endpoints with Postman and verify frontend behavior. Example Postman workflow:

  - Create a new Collection (e.g. `Video API`) and add a `{{baseUrl}}` collection variable set to `http://localhost:3000`.

  - POST /api/videos
    - Method: `POST`
    - URL: `{{baseUrl}}/api/videos`
    - Headers: `Content-Type: application/json`
    - Body (raw → JSON):
      ```json
      { "id": "abc", "name": "clip.mp4", "length": 10 }
      ```
    - Send the request and verify the response contains `{ "success": true }` or the created object.

  - GET /api/videos
    - Method: `GET`
    - URL: `{{baseUrl}}/api/videos`
    - Send and verify the response is an array that includes the object you created.

  - GET /api/videos/:id
    - Method: `GET`
    - URL: `{{baseUrl}}/api/videos/abc`
    - Verify the single object response matches the stored metadata.

  - PATCH /api/videos/:id
    - Method: `PATCH`
    - URL: `{{baseUrl}}/api/videos/abc`
    - Headers: `Content-Type: application/json`
    - Body (raw → JSON): `{ "name": "new.mp4" }`
    - Verify response and then re-GET the item to confirm the change.

  - DELETE /api/videos/:id
    - Method: `DELETE`
    - URL: `{{baseUrl}}/api/videos/abc`
    - Verify response and then GET the list to ensure the item was removed.

  - (Optional) Test blob upload endpoint in Postman
    - Method: `POST`
    - URL: `{{baseUrl}}/api/videos/:id/blob`
    - Body → form-data: add a `file` key and attach a local video file
    - Verify the upload response and that the server exposes the blob via `GET /api/videos/:id/blob`.

Tip: save each request in the collection so backend developers can re-run tests quickly and export/import the Postman collection for CI or sharing.

___
___


## Integrating `VideoAnalysisAPI` (existing class) in `frontend_types.ts`

You already have `src/frontend/frontend_types.ts` that defines a `VideoAnalysisAPI` class. That class targets a separate analysis backend (`baseURL` default `http://localhost:8000`). Here's how it can be integrated with the new changes:

1. Two-tier architecture option (recommended):
   - The frontend calls your primary metadata backend (`/api/videos`) for CRUD on video metadata.
   - The primary backend is responsible for coordinating analysis jobs with the `VideoAnalysisAPI` service (or directly invoking the analysis service). This keeps analysis details and heavy workloads server-side.

2. Direct-from-frontend approach (acceptable for prototyping):
   - The frontend can instantiate `VideoAnalysisAPI` and call `uploadVideo(file)` or `startAnalysis(analysisId)`. This is useful for quick prototyping but leaks analysis credentials and increases client complexity.

3. Recommended integration flow (server-mediated):
   - User uploads video (blob saved in browser or uploaded to server blob endpoint).
   - Frontend sends metadata to main backend (`POST /api/videos`) and receives a `video_id`.
   - Main backend (server) either:
     - uploads the file to the analysis service using `VideoAnalysisAPI.uploadVideo`, or
     - sends a request to the analysis service to pull the blob from a storage URL (S3), or
     - enqueues a job (e.g., via Redis/Queue) that invokes `VideoAnalysisAPI` to start processing.
   - Analysis service returns an `analysis_id`. The main backend stores mapping `video_id -> analysis_id` and exposes `/api/videos/:id/analysis` or `/api/analysis/:analysis_id` to return status and results.

Benefits of server-mediated integration
- Keeps credentials, API keys, and heavy file transfers off the client.
- Allows retry, queuing and resiliency (job queue, backoff).
- Easier to support large files and long-running processing.

___
___


## Important caveats & future changes

- File-based server store is for local dev and quick prototyping only. Replace with a database (Postgres, SQLite, etc.) or other persistent store for production.

- Serverless deployments (Vercel Serverless functions) have ephemeral filesystems — file-based persistence will be lost across invocations. Use an external DB or object store in those environments.

- Concurrency: simple read/modify/write file patterns can race. If you continue with file storage, add locking or migrate to DB.

- Blobs currently live in the browser (IndexedDB). Decide whether blobs should be uploaded to the server for persistence:
  - Pros: server can serve content, perform analysis, and persist files.
  - Cons: adds upload time and server storage costs.

- Types: add TypeScript interfaces for `VideoItem` and `Analysis` and update `VideoService` to return typed responses.

- Observability & monitoring: add logging & metrics to server endpoints and background job processing.

___
___


## Recommended next tasks for backend developers

1. Quick integration (high priority)
  - Implement the metadata endpoints (`GET /api/videos`, `POST /api/videos`, `GET /api/videos/:id`, `PATCH /api/videos/:id`, `PUT /api/videos/:id`, `DELETE /api/videos/:id`) to match the API contract in this doc. Keep response shapes consistent with `VideoItem`.

2. Blob storage strategy (short-term → long-term)
  - Short-term (fast): add server endpoints for blobs using local disk during dev:
    - `POST /api/videos/:id/blob` — accept multipart/form-data uploads
    - `GET /api/videos/:id/blob` — stream the stored file back
  - Long-term (recommended): migrate blobs to object storage (S3/GCS) and implement signed upload/download URLs. Update server and frontend to use those URLs.

3. Analysis orchestration (server-mediated)
  - Use the `VideoAnalysisAPI` (server-side) to submit files or trigger processing rather than calling the analysis service directly from the browser.
  - Store mapping `video_id -> analysis_id` and expose `GET /api/videos/:id/analysis` and/or `GET /api/analysis/:analysis_id` for status and results.
  - Run analysis jobs in background workers (queue + worker) for resiliency and scalability.

4. Reliability & sync
  - Add server-side reconciliation for temporary client IDs (support `temp-*` → canonical ID mapping) so clients can reconcile optimistic uploads.
  - Implement a persistent retry queue for failed client operations (IndexedDB) and an optional server-side endpoint to accept queued operations.

5. Data & concurrency
  - Replace the file-backed store with a production-ready DB (SQLite/Postgres) and add migrations.
  - Ensure transactional/atomic writes for concurrent requests or add optimistic locking to avoid races.

6. Security, auth & infra
  - Add authentication (JWT/OAuth) and document required headers so the frontend `api` client can be configured.
  - Configure CORS and CSRF protections for external deployments.
  - For serverless deployments (Vercel), avoid the file-backed store — use external DB/object storage.

7. Observability & testing
  - Add logging, metrics, and tracing to the backend and background workers.
  - Add automated integration tests (use the Postman collection or a test harness) and add a CI job to run them against a dev server.

8. Frontend hardening (coordination tasks)
  - Add TypeScript interfaces for `VideoItem` and `Analysis` and update `VideoService` to return typed responses.
  - Add UI retry controls for failed optimistic operations and a debug view for pending/failed ops.
  - For large lists, add virtualization/pagination. Offload heavy client-side tasks (e.g., duration extraction) to a Web Worker where needed.

9. Documentation & onboarding
  - Commit the Postman collection and add a short `README-backend.md` that documents env vars (`NEXT_PUBLIC_API_URL`), axios config, and how to run the API locally.
  - Document expected auth flows, rate limits, and deployment notes for the ops team.


