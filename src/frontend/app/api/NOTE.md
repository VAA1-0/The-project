## API usage

Current frontend uses **local storage** + **IndexedDB** to simulate a video library. All data operations (add, rename, delete, load) happen entirely in the browser/desktop. However, the project is already architected so that a real backend can be added later **without changing the UI**.

---

### Possible way of using API

The existing `app/api/videos/[id]/route.ts` endpoints return data from the local-library mock:

```bash
GET     /api/videos/[id]
PATCH   /api/videos/[id]
DELETE  /api/videos/[id]

UI -> API -> DATA
```

Later, the internal logic inside these routes will be replaced with real backend calls (database + file storage) The **API contract stays the same**, but the data source changes.

Frontend already fetches data via endpoints like:

```bash
fetch("/api/videos/123");
```
All page components work **unchanged** once the API routes talk to the backend instead of IndexedDB.

When backend is added, routes will forward requests like this:

```bash
export async function GET(req, { params }) {
  const video = await db.video.findById(params.id);       // database
  const blobUrl = await storage.getSignedUrl(params.id);  // file store
  return NextResponse.json({ ...video, blobUrl });
}
```
Will communicate with whichever backend stack we choose. Backend could store metadata such as video name, upload timestamp, duration and analysis results. If folder structure is added to video library then maybe folder too. IndexedDB may remain as a **local cache** but no longer the main source.