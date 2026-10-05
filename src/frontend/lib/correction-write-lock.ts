import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

export class CorrectionWriteBusy extends Error {}

const ABANDONED_LOCK_GRACE_SECONDS = 60;

async function recoverAbandonedLock(folder: string, analysisId: string): Promise<boolean> {
  let recorded: any;
  try {
    recorded = JSON.parse(await fs.readFile(path.join(folder, "owner.json"), "utf8"));
  } catch {
    return false;
  }
  const pid = Number(recorded?.pid);
  const age = Date.now() / 1000 - Number(recorded?.created_at);
  if (recorded?.analysis_id !== analysisId || !Number.isInteger(pid) || pid <= 0 ||
      !Number.isFinite(age) || age < ABANDONED_LOCK_GRACE_SECONDS) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") return false;
  }
  const quarantine = `${folder}.abandoned-${randomUUID()}`;
  try {
    await fs.rename(folder, quarantine);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    return false;
  }
  await fs.rm(quarantine, { recursive: true, force: true });
  return true;
}

/** Cross-process mkdir protocol shared with correction_write_lock.py. */
export async function withSharedCorrectionLock<T>(root: string, analysisId: string, work: () => Promise<T>, timeoutMs = 5000): Promise<T> {
  if (!analysisId) throw new Error("analysis_id is required");
  const key = createHash("sha256").update(analysisId).digest("hex");
  const folder = path.join(root, ".cache", "correction-write-locks", `${key}.lock`);
  await fs.mkdir(path.dirname(folder), { recursive: true });
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    try {
      await fs.mkdir(folder);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await recoverAbandonedLock(folder, analysisId)) continue;
      if (performance.now() >= deadline) throw new CorrectionWriteBusy("Corrections are locked by another writer; retry after it finishes. An abandoned lock requires recovery.");
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  const token = randomUUID();
  const owner = path.join(folder, "owner.json");
  try {
    await fs.writeFile(owner, JSON.stringify({ token, pid: process.pid, analysis_id: analysisId, created_at: Date.now() / 1000 }), "utf8");
  } catch (error) {
    await fs.rm(owner, { force: true });
    await fs.rmdir(folder);
    throw error;
  }
  try {
    return await work();
  } finally {
    const recorded = JSON.parse(await fs.readFile(owner, "utf8"));
    if (recorded.token !== token) throw new CorrectionWriteBusy("Correction lock ownership changed; refusing to remove another writer's lock");
    await fs.unlink(owner);
    await fs.rmdir(folder);
  }
}
