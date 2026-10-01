import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { assertLocalAnalysisBoundary, projectBoundaryErrorResponse } from "../../project-boundary";

function projectRoot() {
  let current = process.cwd();
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "api_server.py"))) return current;
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), "../..");
}

function pathsFor(analysisId: string) {
  const directory = path.join(projectRoot(), "outputs", "api_results", analysisId);
  return {
    directory,
    metadata: path.join(directory, "source_media_metadata.json"),
    annotations: path.join(directory, "source_media_annotations.json"),
  };
}

async function readJson(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function currentState(analysisId: string) {
  const paths = pathsFor(analysisId);
  const metadata = await readJson(paths.metadata);
  let annotations = metadata.user_annotations || {};
  try { annotations = await readJson(paths.annotations); } catch {}
  return {
    paths,
    metadata: {
      ...metadata,
      annotations_revision: Number(annotations._revision || metadata.annotations_revision || 0),
      annotations_updated_at: annotations._updated_at || metadata.annotations_updated_at,
      user_annotations: Object.fromEntries(
        Object.entries(annotations).filter(([key]) => !key.startsWith("_")),
      ),
    },
    annotations,
  };
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return String(value ?? "").trim().length > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  try {
    const { analysisId } = await params;
    await assertLocalAnalysisBoundary(request, analysisId);
    const state = await currentState(analysisId);
    return NextResponse.json({ analysis_id: analysisId, source_media_metadata: state.metadata });
  } catch (error) {
    const boundaryResponse = projectBoundaryErrorResponse(error);
    if (boundaryResponse) return boundaryResponse;
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Source Media unavailable" }, { status: 404 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  try {
    const { analysisId } = await params;
    await assertLocalAnalysisBoundary(request, analysisId);
    const incoming = await request.json();
    const state = await currentState(analysisId);
    const merged = { ...state.annotations } as Record<string, unknown>;
    for (const [key, value] of Object.entries(incoming)) {
      if (key.startsWith("_")) continue;
      // An empty stale form may not erase a previously saved user value.
      if (!hasValue(value) && hasValue(merged[key])) continue;
      merged[key] = value;
    }
    const revision = Number(state.annotations._revision || state.metadata.annotations_revision || 0) + 1;
    const updatedAt = new Date().toISOString();
    merged._revision = revision;
    merged._updated_at = updatedAt;
    const temporary = `${state.paths.annotations}.${process.pid}.${Date.now()}.tmp`;
    await fs.mkdir(state.paths.directory, { recursive: true });
    await fs.writeFile(temporary, JSON.stringify(merged, null, 2), "utf8");
    await fs.rename(temporary, state.paths.annotations);
    const reopened = await currentState(analysisId);
    return NextResponse.json({
      analysis_id: analysisId,
      status: "saved",
      dependent_projection: "queued",
      source_media_metadata: reopened.metadata,
    });
  } catch (error) {
    const boundaryResponse = projectBoundaryErrorResponse(error);
    if (boundaryResponse) return boundaryResponse;
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Source Media save failed" }, { status: 500 });
  }
}
