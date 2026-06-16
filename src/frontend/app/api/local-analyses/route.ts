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

async function readJson(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") || "50");
  const root = apiResultsRoot();

  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const recordPath = path.join(root, entry.name, "analysis_record.json");
          try {
            const info = await readJson(recordPath);
            const analysisId = info.analysis_id || entry.name;
            return [
              analysisId,
              {
                status: info.status || "unknown",
                filename: info.original_filename || info.filename || "Unknown",
                progress: info.progress || 0,
                pipeline_type: info.pipeline_type || "full",
                start_time: info.start_time,
                uploaded_at: info.uploaded_at,
                analysis_completed_at: info.analysis_completed_at,
                cvatID: info.cvatID,
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
