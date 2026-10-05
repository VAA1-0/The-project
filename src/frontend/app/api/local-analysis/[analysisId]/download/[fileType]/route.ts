import { applyWordUndo, applyCorrectionUndo } from "@/lib/correction-word-undo";
import { readCorrectionSourceBinding, CorrectionBindingUnavailable } from "@/lib/correction-source-binding";
import { withSharedCorrectionLock, CorrectionWriteBusy } from "@/lib/correction-write-lock";
import { correctionClockGuard, validateCorrectionClockGuard, validateCorrectionSourceBinding, CorrectionClockConflict } from "@/lib/correction-clock-guard";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { mergeAnnotationCorrections } from "@/lib/annotation-correction-merge";
import { assertLocalAnalysisBoundary, projectBoundaryErrorResponse } from "../../../project-boundary";

const correctionWriteQueues = new Map<string, Promise<void>>();

async function withCorrectionWriteLock<T>(analysisId: string, work: () => Promise<T>) {
  const previous = correctionWriteQueues.get(analysisId) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  correctionWriteQueues.set(analysisId, queued);
  await previous;
  try {
    return await withSharedCorrectionLock(projectRoot(), analysisId, work);
  } finally {
    release();
    if (correctionWriteQueues.get(analysisId) === queued) {
      correctionWriteQueues.delete(analysisId);
    }
  }
}

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

async function updateMasterSchemaCorrectionReviewLayer(
  analysisId: string,
  corrections: Record<string, any>,
) {
  const masterPath = path.join(
    projectRoot(),
    "outputs",
    "api_results",
    analysisId,
    "vaa1_annotation_master_schema.json",
  );
  let master: Record<string, any> = {};
  try {
    master = JSON.parse(await fs.readFile(masterPath, "utf8"));
  } catch {
    master = {
      schema: "vaa1.annotation_master_schema.v1",
      analysis_id: analysisId,
    };
  }
  const reviewLayer =
    master.review_layer && typeof master.review_layer === "object"
      ? master.review_layer
      : {};
  master = {
    ...master,
    analysis_id: master.analysis_id || analysisId,
    updated_at: new Date().toISOString(),
    review_layer: {
      ...reviewLayer,
      status: reviewLayer.status || "unreviewed",
      annotation_corrections: corrections,
    },
  };
  const temporaryPath = `${masterPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(masterPath), { recursive: true });
  await fs.writeFile(temporaryPath, JSON.stringify(master, null, 2), "utf8");
  await fs.rename(temporaryPath, masterPath);
}

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

function createCancelableFileStream(filePath: string, start: number, end: number) {
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  let position = start;
  let cancelled = false;
  let closed = false;

  const close = async () => {
    if (closed) return;
    closed = true;
    const openHandle = handle;
    handle = null;
    if (openHandle) {
      await openHandle.close().catch(() => undefined);
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (cancelled || closed) return;
        if (!handle) handle = await fs.open(filePath, "r");
        if (cancelled || closed) {
          await close();
          return;
        }
        if (position > end) {
          await close();
          controller.close();
          return;
        }

        const length = Math.min(256 * 1024, end - position + 1);
        const buffer = Buffer.allocUnsafe(length);
        const { bytesRead } = await handle.read(buffer, 0, length, position);
        if (cancelled || closed) {
          await close();
          return;
        }
        if (bytesRead <= 0) {
          await close();
          controller.close();
          return;
        }
        position += bytesRead;
        controller.enqueue(buffer.subarray(0, bytesRead));
      } catch (error) {
        await close();
        if (!cancelled) controller.error(error);
      }
    },
    async cancel() {
      cancelled = true;
      await close();
    },
  });
}

async function readRecord(analysisId: string) {
  const filePath = analysisRecordPath(analysisId);
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

const CORRECTION_COLLECTIONS = [
  "text_substitutions",
  "label_overrides",
  "manual_transcript_entries",
  "manual_visual_annotations",
  "proliferation_decisions",
  "master_schema_presence_intervals",
  "meaning_network_custom_lanes",
];

function correctionMaturity(value: any) {
  if (!value || typeof value !== "object") return -1;
  return CORRECTION_COLLECTIONS.reduce(
    (total, key) => total + (Array.isArray(value[key]) ? value[key].length : 0),
    0,
  );
}

function correctionDocumentTime(value: any) {
  const parsed = Date.parse(String(value?.updated_at || value?.created_at || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readRichestAnnotationCorrections(analysisId: string) {
  const record = await readRecord(analysisId);
  const candidates: Array<{ value: any; priority: number }> = [
    { value: record.annotation_corrections, priority: 0 },
  ];
  const canonicalPath = path.join(
    projectRoot(),
    "outputs",
    "api_results",
    analysisId,
    "annotation_corrections.json",
  );
  const recordedPath = record?.output_files?.annotation_corrections;
  for (const [priority, candidatePath] of [canonicalPath, recordedPath].entries()) {
    if (!candidatePath || typeof candidatePath !== "string") continue;
    try {
      const resolvedPath = path.isAbsolute(candidatePath)
        ? candidatePath
        : safeProjectPath(candidatePath);
      const value = JSON.parse(await fs.readFile(resolvedPath, "utf8"));
      if (priority === 0 && (!value || typeof value !== "object" || Array.isArray(value))) {
        throw new Error("Canonical corrections must be an object");
      }
      candidates.push({
        value,
        // The canonical sidecar must win an equal-time tie over an imported
        // compatibility artifact. Arrays are still merged without deletion.
        priority: priority === 0 ? 2 : 1,
      });
    } catch (error) {
      if (priority === 0 && (error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        throw new Error("Canonical corrections cannot be read; the saved file has not been replaced");
      }
    }
  }
  const merged: Record<string, any> = candidates
    .filter((candidate) => candidate.value && typeof candidate.value === "object")
    .sort(
      (left, right) =>
        correctionDocumentTime(left.value) - correctionDocumentTime(right.value) ||
        correctionMaturity(left.value) - correctionMaturity(right.value) ||
        left.priority - right.priority,
    )
    .reduce(
      (merged, candidate) => mergeAnnotationCorrections(merged, candidate.value),
      {},
    );
  const canonical = candidates.find((candidate) => candidate.priority === 2);
  if (canonical) {
    // A stale compatibility bundle must not restore an older global clock offset.
    merged.transcript_clock_offset_seconds = canonical.value.transcript_clock_offset_seconds ?? null;
    merged.correction_generation = canonical.value.correction_generation ?? null;
    // Once inverse edits exist, compatibility caches cannot resurrect removed members.
    if (Array.isArray(canonical.value.correction_undo_history) && canonical.value.correction_undo_history.length) {
      for (const collection of ["text_substitutions", "label_overrides", "manual_transcript_entries",
        "manual_visual_annotations", "master_schema_presence_intervals", "meaning_network_custom_lanes", "proliferation_decisions"]) {
        merged[collection] = canonical.value[collection] || [];
      }
    }
    merged.correction_undo_history = canonical.value.correction_undo_history || [];
  }
  return merged;
}

function transcriptPayloadHasTimingAuthority(payload: any): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (rawTranscriptPayloadLooksLikeScaffold(payload)) {
    return false;
  }
  const authority = payload.timing_authority;
  if (
    authority &&
    typeof authority === "object" &&
    ["original_whisper_timecode", "manual_correction"].includes(
      String(authority.operational_authority || ""),
    )
  ) {
    return true;
  }
  const timingRepair = payload.timing_repair;
  if (
    timingRepair &&
    typeof timingRepair === "object" &&
    timingRepair.strategy === "original_whisper_timecode"
  ) {
    return true;
  }
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  return segments.some((segment: any) => {
    if (!segment || typeof segment !== "object") {
      return false;
    }
    const status = String(segment.timing_status || segment.timingStatus || "");
    const authority = String(segment.timing_authority || segment.timingAuthority || "");
    const sourceTimeValid = segment.source_time_valid ?? segment.sourceTimeValid;
    if (
      [
        "automatic_transcript_timestamp",
        "inherited_after_vad_anchor",
        "needs_per_line_sync",
      ].includes(status) ||
      [
        "quick_sweep_transcript",
        "quick_sweep_transcript_priority",
        "chunked_fallback",
        "tail_recovery_fallback",
        "fallback_candidate",
        "scaffold",
        "text_only_no_source_timing",
      ].includes(authority)
    ) {
      return false;
    }
    if (authority === "manual_correction") {
      return sourceTimeValid !== false || status === "manual_correction";
    }
    return (
      authority === "original_whisper_timecode" ||
      authority === "full_pass" ||
      [
        "manual_correction",
        "original_whisper_timecode",
      ].includes(segment.timing_status)
    );
  });
}

function rawTranscriptPayloadLooksLikeScaffold(payload: any): boolean {
  const segments = Array.isArray(payload?.segments) ? payload.segments : [];
  if (segments.length < 4) {
    return false;
  }
  return segments.slice(0, 4).every((segment: any, index: number) => {
    const start = Number(segment?.start);
    const end = Number(segment?.end);
    return (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      Math.abs(start - index * 2) <= 0.02 &&
      Math.abs(end - (index + 1) * 2) <= 0.02
    );
  });
}

async function readJsonIfAvailable(rawPath?: string | null) {
  if (!rawPath) {
    return null;
  }
  try {
    const filePath = safeProjectPath(rawPath);
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function authoritativeTranscriptPath(record: any, currentOutputPath?: string) {
  const candidates: string[] = [];
  const rawWhisperTranscript = record?.output_files?.raw_whisper_transcript;
  if (typeof rawWhisperTranscript === "string") {
    candidates.push(rawWhisperTranscript);
  }
  const operationalTranscript = record?.output_files?.operational_transcript;
  if (typeof operationalTranscript === "string") {
    candidates.push(operationalTranscript);
  }
  const outputTranscript = record?.output_files?.transcript;
  if (typeof outputTranscript === "string") {
    candidates.push(outputTranscript);
  }

  const sourceVideoPath = record?.source_video_path;
  if (typeof sourceVideoPath === "string") {
    const sourceDir = path.dirname(sourceVideoPath);
    const sourceStem = path.basename(sourceVideoPath).replace(/_source_video\.[^.]+$/, "");
    candidates.push(path.join(sourceDir, `${sourceStem}_transcript.json`));
  }

  if (typeof currentOutputPath === "string") {
    candidates.push(currentOutputPath.replace(/_transcript\.json$/, "_transcript_raw_whisper.json"));
    candidates.push(
      currentOutputPath.replace(
        /_extracted_audio_transcript\.json$/,
        "_extracted_audio_transcript_raw_whisper.json",
      ),
    );
    candidates.push(
      currentOutputPath.replace(
        /transcripts\/(.+)_extracted_audio_transcript\.json$/,
        "$1_transcript.json",
      ),
    );
    candidates.push(
      currentOutputPath.replace(
        /_extracted_audio_transcript\.json$/,
        "_transcript.json",
      ),
    );
    const currentDirectory = path.dirname(currentOutputPath);
    const currentStem = path.basename(currentOutputPath).replace(/_transcript\.json$/, "");
    candidates.unshift(
      path.join(
        currentDirectory,
        "transcripts",
        `${currentStem}_extracted_audio_transcript_raw_whisper.json`,
      ),
      path.join(
        currentDirectory,
        "transcripts",
        `${currentStem}_extracted_audio_transcript.json`,
      ),
    );
  }

  for (const candidate of candidates) {
    const payload = await readJsonIfAvailable(candidate);
    if (transcriptPayloadHasTimingAuthority(payload)) {
      return candidate;
    }
  }
  return currentOutputPath;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string; fileType: string }> },
) {
  const { analysisId, fileType } = await params;
  try {
    await assertLocalAnalysisBoundary(request, analysisId);
    if (fileType === "annotation_corrections") {
      return await withCorrectionWriteLock(analysisId, async () => {
        const corrections = await readRichestAnnotationCorrections(analysisId);
        let context;
        let bindingDetail: string | undefined;
        try {
          context = await readCorrectionSourceBinding(analysisId);
        } catch (error) {
          if (!(error instanceof CorrectionBindingUnavailable)) throw error;
          // Clock binding governs writes, not evidence visibility. Restored or
          // temporarily offline sources must still hydrate their mature ledger.
          context = {
            analysis_id: analysisId,
            binding_status: "source_unavailable",
            source_fingerprint: null,
            clock_revision: null,
          };
          bindingDetail = error.message;
        }
        return NextResponse.json({
          ...corrections,
          _clock_write_guard: correctionClockGuard(analysisId, corrections, context),
          ...(bindingDetail ? {
            _hydration_state: {
              evidence: "available",
              editing: "read_only",
              reason: "source_clock_unavailable",
              detail: bindingDetail,
            },
          } : {}),
        }, {
          headers: { "cache-control": "no-store" },
        });
      });
    }
    if (fileType === "visual_frame_scan_checkpoint") {
      const filePath = path.join(
        projectRoot(),
        "outputs",
        "api_results",
        analysisId,
        "visual_frame_scan_checkpoint.json",
      );
      const data = await fs.readFile(filePath);
      return new NextResponse(data, {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }
    const root = projectRoot();
    const resultDirectory = path.join(root, "outputs", "api_results", analysisId);
    const directPaths: Record<string, string> = {
      source_video: path.join(root, "uploads", `${analysisId}.mp4`),
      audio: path.join(root, "outputs", "audio", `${analysisId}_audio.wav`),
      transcript: path.join(root, "outputs", "transcripts", `${analysisId}_transcript_raw_whisper.json`),
      raw_whisper_transcript: path.join(root, "outputs", "transcripts", `${analysisId}_transcript_raw_whisper.json`),
      linked_transcript: path.join(root, "outputs", "transcripts", `${analysisId}_linked_transcript.json`),
      audio_prosody: path.join(root, "outputs", "transcripts", `${analysisId}_audio_prosody.json`),
      audio_event_intervals: path.join(root, "outputs", "transcripts", `${analysisId}_audio_event_intervals.json`),
      audio_diarization: path.join(root, "outputs", "transcripts", `${analysisId}_audio_diarization.json`),
      audio_sample_clouds: path.join(root, "outputs", "transcripts", `${analysisId}_audio_sample_clouds.json`),
      pos_analysis: path.join(root, "outputs", "transcripts", `${analysisId}_pos.json`),
      quan_analysis: path.join(root, "outputs", "transcripts", `${analysisId}_quan.json`),
      expression_json: path.join(root, "outputs", "api_results", `${analysisId}_expressions.json`),
      source_media_metadata_json: path.join(resultDirectory, "source_media_metadata.json"),
      source_media_metadata_csv: path.join(resultDirectory, "source_media_metadata.csv"),
      vaa1_annotation_master_schema: path.join(resultDirectory, "vaa1_annotation_master_schema.json"),
      second_order_label_proliferation: path.join(resultDirectory, "second_order_label_proliferation.json"),
      narrative_lens_reading: path.join(resultDirectory, "narrative_lens_reading.json"),
      character_path_reading: path.join(resultDirectory, "character_path_reading.json"),
      datascene_meaning_network: path.join(resultDirectory, "datascene_meaning_network.json"),
      multimodal_meaning_stage1: path.join(resultDirectory, "multimodal_meaning_stage1.json"),
      mise_en_scene_scene_cards: path.join(resultDirectory, "mise_en_scene_scene_cards.json"),
      live_mature_data_proliferation_audit: path.join(resultDirectory, "live_mature_data_proliferation_audit.json"),
      identity_triangulation: path.join(resultDirectory, "identity_triangulation_bundle.json"),
      spatial_tone_scan: path.join(resultDirectory, "spatial_tone_scan.json"),
      adaptive_visual_scan: path.join(resultDirectory, "adaptive_visual_scan.json"),
      native_statistical_interpretation: path.join(resultDirectory, "native_statistical_interpretation.json"),
    };
    const record = await readRecord(analysisId);
    const recordedOutputPath = record?.output_files?.[fileType];
    const recordedCandidate =
      typeof recordedOutputPath === "string"
        ? path.isAbsolute(recordedOutputPath)
          ? recordedOutputPath
          : safeProjectPath(recordedOutputPath)
        : undefined;
    let outputPath: string | undefined =
      recordedCandidate && existsSync(recordedCandidate)
        ? recordedCandidate
        : directPaths[fileType];
    if (!outputPath && ["yolo_csv", "tracked_objects_csv", "ocr_csv"].includes(fileType)) {
      const suffix = fileType === "yolo_csv" ? "_yolo_" : fileType === "ocr_csv" ? "_ocr_" : "_tracked_objects_";
      const csvDirectory = path.join(root, "outputs", "frames", "csv");
      const candidates = (await fs.readdir(csvDirectory))
        .filter((name) => name.startsWith(`${analysisId}${suffix}`) && name.endsWith(".csv"))
        .sort()
        .reverse();
      if (candidates[0]) outputPath = path.join(csvDirectory, candidates[0]);
    }
    if (outputPath && !existsSync(outputPath) && fileType === "transcript") {
      const candidates = [
        path.join(root, "outputs", "transcripts", `${analysisId}_linked_transcript.json`),
        path.join(root, "outputs", "transcripts", `${analysisId}_transcript.json`),
      ];
      outputPath = candidates.find((candidate) => existsSync(candidate));
    }
    // Imported/restored analyses keep their durable artifacts under the path
    // recorded in analysis_record.json rather than the current-run canonical
    // directories above. A canonical guess is only authoritative when it
    // actually exists.
    if (!outputPath || !existsSync(outputPath)) {
      outputPath = record.output_files?.[fileType] || outputPath;
    }
    if (!outputPath) {
      return NextResponse.json({ detail: "File not found" }, { status: 404 });
    }
    if (fileType === "transcript") {
      outputPath = (await authoritativeTranscriptPath({}, outputPath)) || outputPath;
    }

    const filePath = path.isAbsolute(outputPath) ? outputPath : safeProjectPath(outputPath);
    if (["source_video", "video", "annotated_video"].includes(fileType)) {
      const stat = await fs.stat(filePath);
      const range = request.headers.get("range");
      const commonHeaders = {
        "content-type": MIME_TYPES[fileType] || "video/mp4",
        "accept-ranges": "bytes",
        "cache-control": "private, max-age=0, must-revalidate",
      };
      if (range) {
        const match = range.match(/^bytes=(\d*)-(\d*)$/);
        if (!match) {
          return new NextResponse(null, {
            status: 416,
            headers: { ...commonHeaders, "content-range": `bytes */${stat.size}` },
          });
        }
        const start = match[1] ? Number(match[1]) : 0;
        const requestedEnd = match[2] ? Number(match[2]) : stat.size - 1;
        const end = Math.min(requestedEnd, stat.size - 1);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= stat.size) {
          return new NextResponse(null, {
            status: 416,
            headers: { ...commonHeaders, "content-range": `bytes */${stat.size}` },
          });
        }
        const stream = createCancelableFileStream(filePath, start, end);
        return new NextResponse(stream, {
          status: 206,
          headers: {
            ...commonHeaders,
            "content-range": `bytes ${start}-${end}/${stat.size}`,
            "content-length": String(end - start + 1),
          },
        });
      }
      const stream = createCancelableFileStream(filePath, 0, stat.size - 1);
      return new NextResponse(stream, {
        headers: { ...commonHeaders, "content-length": String(stat.size) },
      });
    }
    const data = await fs.readFile(filePath);
    if (fileType === "vaa1_annotation_master_schema") {
      try {
        const payload = JSON.parse(data.toString("utf8"));
        const corrections = await readRichestAnnotationCorrections(analysisId);
        const sourceAnalysisId = payload.analysis_id;
        payload.analysis_id = analysisId;
        if (sourceAnalysisId && sourceAnalysisId !== analysisId) {
          payload.imported_source_analysis_id = sourceAnalysisId;
        }
        payload.review_layer = {
          ...(payload.review_layer || {}),
          annotation_corrections: corrections,
        };
        return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
      } catch {}
    }
    return new NextResponse(data, {
      headers: {
        "content-type": MIME_TYPES[fileType] || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const boundaryResponse = projectBoundaryErrorResponse(error);
    if (boundaryResponse) return boundaryResponse;
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Local artifact unavailable" },
      { status: (error instanceof CorrectionClockConflict || (error instanceof Error && error.name === "CorrectionClockConflict")) ? 409 : error instanceof CorrectionWriteBusy || error instanceof CorrectionBindingUnavailable ? 503 : 404 },
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

  let canonicalCommitted = false;
  try {
    await assertLocalAnalysisBoundary(request, analysisId);
    const incoming = await request.json();
    // Whole-source clock changes must also append canonical dependency invalidation.
    // The backend owns that transaction and acquires the shared lock itself.
    if (!incoming?._word_undo && !incoming?._correction_undo && "transcript_clock_offset_seconds" in incoming &&
        Number(incoming.transcript_clock_offset_seconds ?? 0) !==
          Number(incoming._clock_write_guard?.transcript_clock_offset_seconds ?? 0)) {
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      const response = await fetch(`${base}/api/annotation-corrections/${encodeURIComponent(analysisId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(incoming),
      });
      return NextResponse.json(await response.json(), { status: response.status });
    }
    return await withCorrectionWriteLock(analysisId, async () => {
      const root = projectRoot();
      const outputPath = path.join(
        root,
        "outputs",
        "api_results",
        analysisId,
        "annotation_corrections.json",
      );
      const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
      const existing = await readRichestAnnotationCorrections(analysisId);

      validateCorrectionClockGuard(analysisId, existing, incoming);
      const context = await readCorrectionSourceBinding(analysisId);
      validateCorrectionSourceBinding(analysisId, incoming, context);
      const generation = globalThis.crypto.randomUUID();
      const corrections = incoming._word_undo
        ? applyWordUndo(existing, incoming, generation, new Date().toISOString())
        : incoming._correction_undo
          ? applyCorrectionUndo(existing, incoming, generation, new Date().toISOString())
        : { ...mergeAnnotationCorrections(existing, incoming), correction_generation: generation,
            correction_undo_history: existing.correction_undo_history || [] };
      delete corrections._clock_write_guard;
      delete corrections._word_undo;
      delete corrections._correction_undo;
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(temporaryPath, JSON.stringify(corrections, null, 2), "utf8");
      await fs.rename(temporaryPath, outputPath);
      canonicalCommitted = true;
      await updateMasterSchemaCorrectionReviewLayer(analysisId, corrections);

      return NextResponse.json({
        analysis_id: analysisId,
        annotation_corrections: { ...corrections, _clock_write_guard: correctionClockGuard(analysisId, corrections, await readCorrectionSourceBinding(analysisId)) },
        local_fallback: true,
        concurrent_merge: Boolean(existing),
        dependent_projection: "master_schema_refreshed",
      });
    });
  } catch (error) {
    const boundaryResponse = projectBoundaryErrorResponse(error);
    if (boundaryResponse) return boundaryResponse;
    return NextResponse.json(
      {
        detail: canonicalCommitted
          ? "Corrections were written, but post-save verification or projection failed. Reopen the analysis and inspect the saved state before retrying."
          : error instanceof Error ? error.message : "Could not save local annotation corrections",
        canonical_committed: canonicalCommitted,
      },
      { status: (error instanceof CorrectionClockConflict || (error instanceof Error && error.name === "CorrectionClockConflict")) ? 409 : error instanceof CorrectionWriteBusy || error instanceof CorrectionBindingUnavailable ? 503 : 500 },
    );
  }
}
