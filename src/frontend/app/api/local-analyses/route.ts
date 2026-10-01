import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

function projectRoot() {
  let current = process.cwd();
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "api_server.py"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), "../..");
}

function apiResultsRoot() {
  return path.join(projectRoot(), "outputs", "api_results");
}

// Project ownership can follow persisted analysis payloads in older records.
// Two MiB covers the largest known pre-catalogue records while still avoiding
// parsing (or even reading) multi-hundred-megabyte analysis JSON documents.
const BOUNDED_RECORD_PREFIX_BYTES = 2 * 1024 * 1024;

function prefixString(prefix: string, key: string): string | undefined {
  const match = prefix.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return undefined;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

function prefixNumber(prefix: string, key: string): number | undefined {
  const match = prefix.match(new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

async function readBoundedRecord(filePath: string) {
  const file = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(BOUNDED_RECORD_PREFIX_BYTES);
    const [{ bytesRead }, stat] = await Promise.all([
      file.read(buffer, 0, buffer.length, 0),
      file.stat(),
    ]);
    const prefix = buffer.subarray(0, bytesRead).toString("utf8");
    return {
      analysis_id: prefixString(prefix, "analysis_id"),
      status: prefixString(prefix, "status"),
      original_filename: prefixString(prefix, "original_filename"),
      filename: prefixString(prefix, "filename"),
      progress: prefixNumber(prefix, "progress"),
      mission_stage: prefixString(prefix, "mission_stage"),
      mission_message: prefixString(prefix, "mission_message"),
      project_id: prefixString(prefix, "project_id"),
      uploaded_at: prefixString(prefix, "uploaded_at"),
      analysis_completed_at: prefixString(prefix, "analysis_completed_at"),
      pipeline_type: prefixString(prefix, "pipeline_type"),
      visual_error: prefixString(prefix, "visual_error"),
      audio_error: prefixString(prefix, "audio_error"),
      start_time: prefixNumber(prefix, "start_time") || stat.mtimeMs / 1000,
      record_mtime_ms: stat.mtimeMs,
    };
  } finally {
    await file.close();
  }
}

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") || "50");
  const activeProject = request.nextUrl.searchParams.get("project_id")?.trim() || "";
  const root = apiResultsRoot();

  try {
    let catalogueIndex: Record<string, { project_id?: string }> = {};
    try {
      const rawIndex = await fs.readFile(path.join(root, "catalogue_index.json"), "utf8");
      catalogueIndex = JSON.parse(rawIndex)?.analyses || {};
    } catch {}
    const entries = await fs.readdir(root, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const recordPath = path.join(root, entry.name, "analysis_record.json");
          try {
            const info = await readBoundedRecord(recordPath);
            const analysisId = info.analysis_id || entry.name;
            const requiredBranchError = info.visual_error
              ? `Visual analysis incomplete: ${info.visual_error}`
              : info.audio_error
                ? `Audio analysis incomplete: ${info.audio_error}`
                : undefined;
            const operationalStatus =
              info.status === "completed" && requiredBranchError ? "error" : info.status || "unknown";
            return [
              analysisId,
              {
                status: operationalStatus,
                filename: info.original_filename || info.filename || "Unknown",
                progress: requiredBranchError ? undefined : info.progress || 0,
                pipeline_type: info.pipeline_type || "full",
                project_id:
                  catalogueIndex[analysisId]?.project_id ||
                  info.project_id ||
                  "local-research-project",
                uploaded_at: info.uploaded_at,
                analysis_completed_at: info.analysis_completed_at,
                error: requiredBranchError,
                branch_completion: {
                  visual: info.visual_error ? "incomplete" : "not_reported_failed",
                  audio: info.audio_error ? "incomplete" : "not_reported_failed",
                },
                start_time: info.start_time,
                record_mtime_ms: info.record_mtime_ms,
              },
            ] as const;
          } catch {
            return null;
          }
        }),
    );

    const analyses = Object.fromEntries(
      records
        .filter((record): record is NonNullable<typeof record> => record !== null)
        .filter(([, info]) => !activeProject || info.project_id === activeProject)
        .sort((left, right) => {
          const leftTime = Number(left[1].start_time || 0);
          const rightTime = Number(right[1].start_time || 0);
          return rightTime - leftTime;
        })
        .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 50),
    );

    return NextResponse.json({ analyses, source: "local-api-results" });
  } catch (error) {
    return NextResponse.json(
      {
        analyses: {},
        error: error instanceof Error ? error.message : "Local analyses unavailable",
      },
      { status: 200 },
    );
  }
}
