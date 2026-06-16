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

function recordPath(analysisId: string) {
  return path.join(projectRoot(), "outputs", "api_results", analysisId, "analysis_record.json");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const { analysisId } = await params;
  try {
    const record = JSON.parse(await fs.readFile(recordPath(analysisId), "utf8"));
    return NextResponse.json({
      ...record,
      analysis_id: record.analysis_id || analysisId,
      filename: record.original_filename || record.filename || "Unknown",
      download_links: Object.fromEntries(
        Object.keys(record.output_files || {}).map((fileType) => [
          fileType,
          `/api/local-analysis/${analysisId}/download/${fileType}`,
        ]),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Analysis record not found" },
      { status: 404 },
    );
  }
}
