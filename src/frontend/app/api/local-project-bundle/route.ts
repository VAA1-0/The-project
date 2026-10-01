import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import {
  FILE_MAPPING,
  projectRoot,
  readAnalysisRecord,
  readCanonicalJsonArtifact,
  safeProjectPath,
  slugifyName,
} from "../local-bundle-utils";

const execFileAsync = promisify(execFile);

async function linkFile(source: string, target: string) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await fs.link(source, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const analysisIds = Array.isArray(payload.analysis_ids) ? payload.analysis_ids : [];
    if (analysisIds.length === 0) {
      return NextResponse.json({ detail: "No analyses were provided for the project bundle" }, { status: 400 });
    }

    const projectName = String(payload.project_name || "vaa1_project");
    const included_analyses = [];
    const skipped_analyses = [];
    const runtimeRoot = path.join(projectRoot(), "outputs", "runtime", "project-bundles");
    await fs.mkdir(runtimeRoot, { recursive: true });
    const requestId = randomUUID();
    const staging = path.join(runtimeRoot, `.staging-${requestId}`);
    const bundlePath = path.join(runtimeRoot, `${slugifyName(projectName)}-${requestId}.zip`);
    await fs.mkdir(staging, { recursive: true });

    try {
      for (const analysisId of analysisIds) {
        const record = await readAnalysisRecord(String(analysisId));
        if (record.status !== "completed") {
          skipped_analyses.push({ analysis_id: analysisId, reason: "missing_or_not_completed" });
          continue;
        }
        const folder = `analyses/${slugifyName(record.original_filename || String(analysisId))}_${String(analysisId).slice(0, 8)}/`;
        await fs.mkdir(path.join(staging, folder), { recursive: true });
        const skippedOutputFiles: Array<{ file_type: string; reason: string }> = [];
        for (const [fileType, rawPath] of Object.entries(record.output_files || {})) {
          if (!rawPath || typeof rawPath !== "string") {
            skippedOutputFiles.push({ file_type: fileType, reason: "empty_path" });
            continue;
          }
          try {
            const source = safeProjectPath(rawPath);
            const targetName = FILE_MAPPING[fileType] || path.basename(source);
            await linkFile(source, path.join(staging, folder, targetName));
          } catch {
            skippedOutputFiles.push({ file_type: fileType, reason: "missing_or_not_file" });
          }
        }
        await fs.writeFile(
          path.join(staging, folder, "saved_work_manifest.json"),
          JSON.stringify(
            {
              analysis_id: record.analysis_id || analysisId,
              original_filename: record.original_filename,
              source_video_path: record.source_video_path || record.file_path,
              source_media_metadata: record.source_media_metadata || {},
              annotation_corrections: await readCanonicalJsonArtifact(
                String(record.analysis_id || analysisId),
                "annotation_corrections.json",
                record.annotation_corrections || {},
              ),
              analysis_completed_at: record.analysis_completed_at,
              pipeline_type: record.pipeline_type || "full",
              analysis_tier: record.analysis_tier || "science_scan",
              modality_focus: record.modality_focus || "multimodal",
              skipped_output_files: skippedOutputFiles,
            },
            null,
            2,
          ),
          "utf8",
        );
        included_analyses.push({
          analysis_id: analysisId,
          filename: record.original_filename,
          folder: folder.replace(/\/$/, ""),
        });
      }

      await fs.writeFile(
        path.join(staging, "project_manifest.json"),
        JSON.stringify(
          {
            project_type: "vaa1_project_bundle",
            project_name: projectName,
            saved_at: new Date().toISOString(),
            analysis_count: included_analyses.length,
            included_analyses,
            skipped_analyses,
            media_policy: {
              included: true,
              method: "disk_streamed_zip64",
            },
            matrices: payload.matrices || {},
          },
          null,
          2,
        ),
        "utf8",
      );

      // Store already-compressed media without recompression. `zip` streams
      // from hard-linked staging files to disk and supports Zip64 archives.
      await execFileAsync("/usr/bin/zip", ["-0", "-q", "-r", bundlePath, "."], {
        cwd: staging,
        maxBuffer: 1024 * 1024,
      });
      await fs.rm(staging, { recursive: true, force: true });
      const stat = await fs.stat(bundlePath);
      const stream = createReadStream(bundlePath);
      return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${slugifyName(projectName)}_project_bundle.zip"`,
        "content-length": String(stat.size),
        "cache-control": "no-store",
      },
    });
    } catch (error) {
      await fs.rm(staging, { recursive: true, force: true });
      await fs.rm(bundlePath, { force: true });
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Local project bundle unavailable" },
      { status: 500 },
    );
  }
}
