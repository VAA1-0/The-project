# Why add a simple SQLite database (and how to wire it to the frontend)

This document explains why introducing a small SQLite database for server-side metadata is helpful for this project, and gives step-by-step instructions and code examples for creating the DB and connecting it to the existing in-repo server/API layers.

___
___


## Quick summary

- **Why**: A small DB makes metadata operations (listing, search, tags, analysis records) transactional, concurrent-safe, and easier to query than a flat JSON file. It also prepares the app for a production-ready migration to Postgres or another RDBMS.

- **Who benefits**: backend developers, QA, and frontend components (`VideoService`, API routes, `video-store.ts`).

- **Scope**: metadata only — blobs can remain in IndexedDB or object storage. This doc describes a dev-friendly SQLite setup intended for local / small-team use.

___
___


## Recommended approach (overview)

1. Add a small DB file in the server area (e.g. `src/frontend/server/data.sqlite`).

2. Use a simple, reliable Node SQLite driver (examples below use `better-sqlite3` for its sync API and ease of use in development; `sqlite3` or an ORM/knex/drizzle are also options).

3. Add a `src/frontend/server/db.ts` module that exports a singleton connection and helper functions.

4. Replace the file-backed `video-store.ts` read/write logic with SQL queries (CRUD) that use the `db` helper.

5. Keep the existing API surface the same — the frontend's `VideoService` and the frontend components don't need to change except to import the new store implementation.

___
___


## Why SQLite (concrete reasons)

- Single-file, zero-ops: no server process, easy to add to repo for local development.

- ACID transactions: safe concurrent updates (important when multiple API routes update metadata).

- Better queries: create indexes (e.g. on `created_at`, `tags`) for fast searches and filtering.

- Easier migration path: the schema and SQL translate to Postgres with minimal changes.

___
___


## Caveats and deployment notes

- SQLite is good for local dev and small single-process deployments. Avoid using it in multi-instance serverless deployments unless you centralize the DB file or switch to Postgres/managed DB.

- If you store the file in the project directory, ensure the directory is writable by the server process and persists between restarts.

- Blobs should remain in browser IndexedDB or be moved to an object store (S3, Azure Blob, etc.) for production.

___
___


## Packages to install (examples)

For a lightweight setup using `better-sqlite3` and a tiny migration script:

```powershell
cd src/frontend
npm install better-sqlite3
```

If you prefer migrations and query building, consider `knex` or `drizzle-orm`:

```powershell
npm install knex sqlite3
# or for drizzle: npm install drizzle-orm sqlite3
```

___
___


## Example schema (videos metadata)

This schema stores metadata only. Blobs remain in the browser.

SQL (migrations/initialization):

```sql
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  duration INTEGER NULL,
  tags TEXT NULL, -- JSON string array
  analysis TEXT NULL, -- JSON object
  status TEXT DEFAULT 'synced' -- 'synced' | 'pending' | 'failed'
);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
```

Notes:
- `id` should match the canonical ID used by the frontend/service (UUID or server-generated string).
- `tags` and `analysis` are stored as JSON strings for flexibility; you can normalize into extra tables later.

___
___


## Sample `db.ts` (Node/TypeScript, `better-sqlite3`)

Create `src/frontend/server/db.ts` (server-only code):

```ts
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'src', 'frontend', 'server', 'data.sqlite');

// Single shared connection for the running Node process (good for local dev)
const db = new Database(DB_PATH);

// Run migrations (idempotent)
db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    duration INTEGER,
    tags TEXT,
    analysis TEXT,
    status TEXT DEFAULT 'synced'
  );
  CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
`);

export default db;

export type VideoRow = {
  id: string;
  name: string;
  created_at: number;
  duration?: number | null;
  tags?: string | null;
  analysis?: string | null;
  status?: string | null;
};
```

___
___


## Sample CRUD wrappers (replace `video-store.ts` internals)

Add `src/frontend/server/video-store-sql.ts` or adapt `video-store.ts` to call SQL instead of `fs`:

```ts
import db, { VideoRow } from './db';

export function getAllVideos(): VideoRow[] {
  const stmt = db.prepare('SELECT * FROM videos ORDER BY created_at DESC');
  return stmt.all();
}

export function getVideoById(id: string): VideoRow | undefined {
  const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
  return stmt.get(id);
}

export function addVideo(v: VideoRow) {
  const stmt = db.prepare(`
    INSERT INTO videos (id, name, created_at, duration, tags, analysis, status)
    VALUES (@id, @name, @created_at, @duration, @tags, @analysis, @status)
  `);
  return stmt.run(v);
}

export function updateVideoName(id: string, name: string) {
  const stmt = db.prepare('UPDATE videos SET name = ? WHERE id = ?');
  return stmt.run(name, id);
}

export function updateVideoTag(id: string, tagsJson: string) {
  const stmt = db.prepare('UPDATE videos SET tags = ? WHERE id = ?');
  return stmt.run(tagsJson, id);
}

export function deleteVideo(id: string) {
  const stmt = db.prepare('DELETE FROM videos WHERE id = ?');
  return stmt.run(id);
}
```

___
___


## Wiring into Next API routes

- Replace `import { getAll, addVideo } from './video-store'` with imports to the SQL-backed store (or update `video-store.ts` to call the SQL wrappers).
- API signatures don't need to change — they continue to return JSON metadata to the client. This keeps `VideoService` and frontend components untouched.

Example: `app/api/videos/route.ts` (pseudocode)

```ts
import { getAllVideos, addVideo } from 'src/frontend/server/video-store-sql';

export async function GET() {
  const videos = getAllVideos();
  return new Response(JSON.stringify(videos), { status: 200 });
}

export async function POST(req: Request) {
  const body = await req.json();
  addVideo({ ...body });
  return new Response(null, { status: 201 });
}
```

___
___


## Migration script (quick example)

Create `scripts/migrate-sqlite.js` at project root to run migrations when needed:

```js
// scripts/migrate-sqlite.js
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'src', 'frontend', 'server', 'data.sqlite');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    duration INTEGER,
    tags TEXT,
    analysis TEXT,
    status TEXT DEFAULT 'synced'
  );
  CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
`);

console.log('migrations applied');
db.close();
```

Run:

```powershell
node scripts/migrate-sqlite.js
```

___
___


## Type considerations and frontend compatibility

- Keep the API JSON contract identical to the current file-backed store. That means `VideoService` and frontend components should not require changes when the store is swapped to SQL.

- In TypeScript, define a `VideoItem` type that maps to the DB fields and reuse it across the store, API, and client types to avoid mismatches.

___
___


## Next steps and recommendations

- Add the DB module and migration script; run the migration locally and verify the API routes behave the same.
- Add a small test that creates, renames, tags, and deletes a video via the API.

- For production, plan to migrate to Postgres or another managed RDBMS. Keep the SQL schema compatible (avoid SQLite-specific features if you aim to port easily).

- Consider adding a small backup script that periodically copies the SQLite file to a safe location.

___
___


## Troubleshooting

- If the API errors with file permission issues, ensure the server process has write permissions to the `src/frontend/server` directory.

- If running in serverless (Vercel/Fn), SQLite may not persist — switch to an external DB.


