import { promises as fs } from "fs"; 
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Resolve module filename/dir
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Candidate locations (check for existing files first):
// 1) legacy nested path that could have been created when cwd was `src/frontend`
// 2) legacy cwd-joined path
// 3) canonical module-relative path (create here if none exist)
const nestedLegacy = path.join(process.cwd(), "src", "frontend", "src", "frontend", "server", "videos.json");
const cwdLegacy = path.join(process.cwd(), "src", "frontend", "server", "videos.json");
const canonical = path.join(__dirname, "videos.json");

// Choose the store path: prefer any existing legacy file, otherwise use canonical
let STORE_PATH: string;
if (fsSync.existsSync(nestedLegacy)) {
  STORE_PATH = nestedLegacy;
} else if (fsSync.existsSync(cwdLegacy)) {
  STORE_PATH = cwdLegacy;
} else {
  STORE_PATH = canonical;
}

// Helpful runtime log so developers can see which file is used
try {
  // eslint-disable-next-line no-console
  console.log("video-store: using videos.json at:", STORE_PATH);
} catch (_e) {}

async function readStore(): Promise<any[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // ensure file exists
      await writeStore([]);
      return [];
    }
    throw err;
  }
}

async function writeStore(data: any[]) {
  const dir = path.dirname(STORE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (_) {}
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function getAll() {
  return await readStore();
}

export async function getById(id: string) {
  const all = await readStore();
  return all.find((v) => v.id === id) ?? null;
}

export async function addVideo(video: any) {
  const all = await readStore();
  all.push(video);
  await writeStore(all);
  return video;
}

export async function updateVideoName(id: string, updates: Partial<any>) {
  const all = await readStore();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...updates };
  await writeStore(all);
  return all[idx];
}

export async function updateVideoTag(id: string, updates: Partial<any>) {
  // alias to updateVideoName (merging fields)
  return await updateVideoName(id, updates);
}

export async function deleteVideo(id: string) {
  const all = await readStore();
  const filtered = all.filter((v) => v.id !== id);
  await writeStore(filtered);
  return { success: true };
}

export default {
  getAll,
  getById,
  addVideo,
  updateVideoName,
  updateVideoTag,
  deleteVideo,
};
