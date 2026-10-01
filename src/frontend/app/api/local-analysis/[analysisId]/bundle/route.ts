import { NextRequest, NextResponse } from "next/server";
import {
  entriesForAnalysis,
  makeZip,
  readAnalysisRecord,
  slugifyName,
} from "../../../local-bundle-utils";
import { assertLocalAnalysisBoundary, projectBoundaryErrorResponse } from "../../project-boundary";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const { analysisId } = await params;
  try {
    await assertLocalAnalysisBoundary(request, analysisId);
    const record = await readAnalysisRecord(analysisId);
    if (record.status !== "completed") {
      return NextResponse.json({ detail: "Analysis not completed" }, { status: 400 });
    }

    const { entries } = await entriesForAnalysis(record);
    const zip = makeZip(entries);
    const baseName = slugifyName(record.original_filename || analysisId);
    return new NextResponse(zip, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${baseName}_analysis_bundle.zip"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const boundaryResponse = projectBoundaryErrorResponse(error);
    if (boundaryResponse) return boundaryResponse;
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Local analysis bundle unavailable" },
      { status: 404 },
    );
  }
}
