import { NextRequest, NextResponse } from "next/server";
import {
  entriesForAnalysis,
  makeZip,
  readAnalysisRecord,
  slugifyName,
} from "../local-bundle-utils";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const analysisIds = Array.isArray(payload.analysis_ids) ? payload.analysis_ids : [];
    if (analysisIds.length === 0) {
      return NextResponse.json({ detail: "No analyses were provided for the project bundle" }, { status: 400 });
    }

    const projectName = String(payload.project_name || "vaa1_project");
    const entries = [];
    const included_analyses = [];
    const skipped_analyses = [];

    for (const analysisId of analysisIds) {
      try {
        const record = await readAnalysisRecord(String(analysisId));
        if (record.status !== "completed") {
          skipped_analyses.push({ analysis_id: analysisId, reason: "missing_or_not_completed" });
          continue;
        }
        const folder = `analyses/${slugifyName(record.original_filename || String(analysisId))}_${String(analysisId).slice(0, 8)}/`;
        const analysisEntries = await entriesForAnalysis(record, folder);
        entries.push(...analysisEntries.entries);
        included_analyses.push({
          analysis_id: analysisId,
          filename: record.original_filename,
          folder: folder.replace(/\/$/, ""),
        });
      } catch {
        skipped_analyses.push({ analysis_id: analysisId, reason: "missing_or_not_completed" });
      }
    }

    entries.push({
      name: "project_manifest.json",
      data: Buffer.from(
        JSON.stringify(
          {
            project_type: "vaa1_project_bundle",
            project_name: projectName,
            saved_at: new Date().toISOString(),
            analysis_count: included_analyses.length,
            included_analyses,
            skipped_analyses,
            matrices: payload.matrices || {},
          },
          null,
          2,
        ),
        "utf8",
      ),
    });

    const zip = makeZip(entries);
    return new NextResponse(zip, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${slugifyName(projectName)}_project_bundle.zip"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Local project bundle unavailable" },
      { status: 500 },
    );
  }
}
