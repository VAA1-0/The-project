import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { assertLocalAnalysisBoundary, bindContextToLocalUrl, projectBoundaryErrorResponse } from "../project-boundary";

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

async function readCanonicalJsonArtifact(
  analysisId: string,
  filename: string,
  fallback: unknown,
) {
  try {
    const artifactPath = path.join(projectRoot(), "outputs", "api_results", analysisId, filename);
    return JSON.parse(await fs.readFile(artifactPath, "utf8"));
  } catch {
    return fallback;
  }
}

const BOUNDED_RECORD_PREFIX_BYTES = 64 * 1024;

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

async function boundedSummary(analysisId: string) {
  const file = await fs.open(recordPath(analysisId), "r");
  try {
    const buffer = Buffer.alloc(BOUNDED_RECORD_PREFIX_BYTES);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const prefix = buffer.subarray(0, bytesRead).toString("utf8");
    const root = projectRoot();
    let projectId = prefixString(prefix, "project_id");
    try {
      const catalogue = JSON.parse(await fs.readFile(path.join(root, "outputs/api_results/catalogue_index.json"), "utf8"));
      projectId = catalogue.analyses?.[analysisId]?.project_id ?? projectId;
    } catch {
      // Older workspaces may not yet have a catalogue index.
    }
    const sourceVideoPath = prefixString(prefix, "source_video_path");
    const persistedStatus = prefixString(prefix, "status") || "uploaded";
    const visualError = prefixString(prefix, "visual_error");
    const audioError = prefixString(prefix, "audio_error");
    const requiredBranchError = visualError
      ? `Visual analysis incomplete: ${visualError}`
      : audioError
        ? `Audio analysis incomplete: ${audioError}`
        : undefined;
    const resolvedSourcePath = sourceVideoPath
      ? path.resolve(root, sourceVideoPath)
      : path.join(root, "uploads", `${analysisId}.mp4`);
    return {
      schema: "vaa1.analysis_status_summary.v1",
      project_id: projectId,
      analysis_id: prefixString(prefix, "analysis_id") || analysisId,
      status: persistedStatus === "completed" && requiredBranchError ? "error" : persistedStatus,
      progress: requiredBranchError ? undefined : prefixNumber(prefix, "progress") || 0,
      mission_stage: prefixString(prefix, "mission_stage"),
      mission_message: prefixString(prefix, "mission_message"),
      filename:
        prefixString(prefix, "original_filename") ||
        prefixString(prefix, "filename") ||
        "Unknown",
      error: requiredBranchError,
      branch_completion: {
        visual: visualError ? "incomplete" : "not_reported_failed",
        audio: audioError ? "incomplete" : "not_reported_failed",
      },
      source_video_path: sourceVideoPath,
      source_video_exists: existsSync(resolvedSourcePath),
      summary: {},
      canonical_summary: {},
      download_links: {
        source_video: `/api/local-analysis/${analysisId}/download/source_video`,
      },
    };
  } finally {
    await file.close();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const { analysisId } = await params;
  try {
    const context = await assertLocalAnalysisBoundary(request, analysisId);
    if (request.nextUrl.searchParams.get("summary") === "1") {
      const summary = await boundedSummary(analysisId);
      return NextResponse.json({
        ...summary,
        governed_context: context,
        download_links: {
          ...summary.download_links,
          source_video: bindContextToLocalUrl(
            `/api/local-analysis/${analysisId}/download/source_video`,
            context,
          ),
        },
      });
    }
    const record = JSON.parse(await fs.readFile(recordPath(analysisId), "utf8"));
    const resolvedAnalysisId = record.analysis_id || analysisId;
    return NextResponse.json({
      ...record,
      analysis_id: resolvedAnalysisId,
      annotation_corrections: await readCanonicalJsonArtifact(
        resolvedAnalysisId,
        "annotation_corrections.json",
        record.annotation_corrections || {},
      ),
      vaa1_annotation_master_schema: await readCanonicalJsonArtifact(
        resolvedAnalysisId,
        "vaa1_annotation_master_schema.json",
        record.vaa1_annotation_master_schema || null,
      ),
      filename: record.original_filename || record.filename || "Unknown",
      download_links: Object.fromEntries(
        Object.keys(record.output_files || {}).map((fileType) => [
          fileType,
          bindContextToLocalUrl(`/api/local-analysis/${analysisId}/download/${fileType}`, context),
        ]),
      ),
    });
  } catch (error) {
    const boundaryResponse = projectBoundaryErrorResponse(error);
    if (boundaryResponse) return boundaryResponse;
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Analysis record not found" },
      { status: 404 },
    );
  }
}
