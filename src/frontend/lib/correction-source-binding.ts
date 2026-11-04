import type { CorrectionSourceBinding } from "./correction-clock-guard";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

export class CorrectionBindingUnavailable extends Error {}

const localFingerprintCache = new Map<string, string>();

function projectRoot() {
  let current = process.cwd();
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "api_server.py"))) return current;
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), "../..");
}

function stableJson(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Clock timebase contains a non-finite number");
    return Number.isInteger(value) ? `${value}.0` : String(value);
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

async function fingerprintFile(sourcePath: string): Promise<string> {
  const before = await fs.stat(sourcePath, { bigint: true });
  const signature = [before.dev, before.ino, before.size, before.mtimeNs, before.ctimeNs].join(":");
  const cacheKey = `${sourcePath}:${signature}`;
  const cached = localFingerprintCache.get(cacheKey);
  if (cached) return cached;
  const digest = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(sourcePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  const after = await fs.stat(sourcePath, { bigint: true });
  const afterSignature = [after.dev, after.ino, after.size, after.mtimeNs, after.ctimeNs].join(":");
  if (afterSignature !== signature) throw new Error("Source changed during local clock verification");
  const fingerprint = `sha256:${digest.digest("hex")}`;
  localFingerprintCache.set(cacheKey, fingerprint);
  return fingerprint;
}

export async function readLocalCorrectionSourceBinding(analysisId: string): Promise<CorrectionSourceBinding> {
  const root = projectRoot();
  const analysisRoot = path.join(root, "outputs", "api_results", analysisId);
  const metadata = JSON.parse(await fs.readFile(path.join(analysisRoot, "source_media_metadata.json"), "utf8"));
  const corrections = JSON.parse(await fs.readFile(path.join(analysisRoot, "annotation_corrections.json"), "utf8"));
  const configuredSource = String(metadata.source_video_path || "");
  if (!configuredSource) throw new Error("Source metadata has no source_video_path");
  const sourcePath = path.resolve(root, configuredSource);
  const relative = path.relative(root, sourcePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Source path leaves the project boundary");
  const sourceFingerprint = await fingerprintFile(sourcePath);
  const finite = (value: unknown) => value === null || value === undefined ? null : Number(value);
  const offset = Number(corrections.transcript_clock_offset_seconds ?? 0);
  const timebase: Record<string, unknown> = {
    contract: "source-clock-context.v1",
    source_fingerprint: sourceFingerprint,
    duration_seconds: finite(metadata.duration_seconds),
    fps: finite(metadata.fps),
    audio_sample_rate: finite(metadata.audio_sample_rate),
    transcript_clock_offset_seconds: Number.isFinite(offset) ? offset : 0,
  };
  if (["constant", "variable"].includes(String(metadata.frame_rate_mode))) {
    timebase.frame_rate_mode = metadata.frame_rate_mode;
  }
  const revision = createHash("sha256").update(stableJson(timebase)).digest("hex");
  return {
    analysis_id: analysisId,
    binding_status: "content_bound",
    source_fingerprint: sourceFingerprint,
    clock_revision: `clock-v1:${revision}`,
    timebase,
  } as CorrectionSourceBinding;
}

/** Resolve source identity before a short correction snapshot lock.
 * The write path resolves and validates it again inside its transaction.
 */
export async function readCorrectionSourceBinding(analysisId: string, projectId: string): Promise<CorrectionSourceBinding> {
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const contextQuery = new URLSearchParams({ project_id: projectId, context_analysis_id: analysisId });
  const controller = new AbortController();
  try {
    const backendBinding = (async () => {
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${base}/api/analysis/${encodeURIComponent(analysisId)}/source-clock?${contextQuery.toString()}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Clock service returned ${response.status}`);
        const context = await response.json();
        if (context?.analysis_id !== analysisId ||
            !["content_bound", "source_unavailable"].includes(context?.binding_status) ||
            (context.binding_status === "content_bound" &&
              (typeof context.source_fingerprint !== "string" || !context.source_fingerprint ||
               typeof context.clock_revision !== "string" || !context.clock_revision ||
               typeof context.timebase?.transcript_clock_offset_seconds !== "number" ||
               !Number.isFinite(context.timebase.transcript_clock_offset_seconds)))) {
          throw new Error("Invalid source-clock response");
        }
        return context as CorrectionSourceBinding;
      } finally {
        clearTimeout(timeout);
      }
    })();
    const result = await Promise.any([backendBinding, readLocalCorrectionSourceBinding(analysisId)]);
    controller.abort();
    return result;
  } catch (error) {
    throw new CorrectionBindingUnavailable(`Could not verify the source clock from either the backend or the local content-addressed source. ${error instanceof Error ? error.message : ""}`);
  }
}
