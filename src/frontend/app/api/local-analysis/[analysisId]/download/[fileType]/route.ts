import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const MIME_TYPES: Record<string, string> = {
  video: "video/mp4",
  source_video: "video/mp4",
  audio: "audio/wav",
  yolo_csv: "text/csv",
  tracked_objects_csv: "text/csv",
  ocr_csv: "text/csv",
  source_media_metadata_csv: "text/csv",
  mise_en_scene_scene_card_report_draft_md: "text/markdown",
};

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

function safeProjectPath(rawPath: string) {
  const root = projectRoot();
  const resolved = path.resolve(root, rawPath);
  if (!resolved.startsWith(root)) {
    throw new Error("Refusing to read outside project root");
  }
  return resolved;
}

function analysisRecordPath(analysisId: string) {
  return path.join(projectRoot(), "outputs", "api_results", analysisId, "analysis_record.json");
}

async function readRecord(analysisId: string) {
  const filePath = analysisRecordPath(analysisId);
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ analysisId: string; fileType: string }> },
) {
  const { analysisId, fileType } = await params;
  try {
    const record = await readRecord(analysisId);
    const outputPath = record.output_files?.[fileType];
    if (!outputPath) {
      return NextResponse.json({ detail: "File not found" }, { status: 404 });
    }

    const filePath = safeProjectPath(outputPath);
    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "content-type": MIME_TYPES[fileType] || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Local artifact unavailable" },
      { status: 404 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string; fileType: string }> },
) {
  const { analysisId, fileType } = await params;
  if (fileType !== "annotation_corrections") {
    return NextResponse.json({ detail: "Local writes are only supported for annotation corrections" }, { status: 405 });
  }

  try {
    const corrections = await request.json();
    const record = await readRecord(analysisId);
    const root = projectRoot();
    const existingOutputPath =
      typeof record.output_files?.annotation_corrections === "string"
        ? record.output_files.annotation_corrections
        : "";
    const outputPath = existingOutputPath
      ? safeProjectPath(existingOutputPath)
      : path.join(root, "outputs", "api_results", analysisId, "annotation_corrections.json");
    const relativeOutputPath = path.relative(root, outputPath);
    const updatedRecord = {
      ...record,
      annotation_corrections: corrections,
      output_files: {
        ...(record.output_files || {}),
        annotation_corrections: relativeOutputPath,
      },
    };

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(corrections, null, 2), "utf8");
    await fs.writeFile(analysisRecordPath(analysisId), JSON.stringify(updatedRecord, null, 2), "utf8");

    return NextResponse.json({
      analysis_id: analysisId,
      annotation_corrections: corrections,
      local_fallback: true,
    });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not save local annotation corrections" },
      { status: 500 },
    );
  }
}
