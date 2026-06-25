import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";

type ZipEntry = {
  name: string;
  data: Buffer;
};

type LocalAnalysisRecord = {
  analysis_id?: string;
  original_filename?: string;
  source_video_path?: string;
  file_path?: string;
  output_files?: Record<string, unknown>;
  source_media_metadata?: unknown;
  annotation_corrections?: unknown;
  analysis_completed_at?: string;
  pipeline_type?: string;
  analysis_tier?: string;
  modality_focus?: string;
};

const FILE_MAPPING: Record<string, string> = {
  video: "annotated_video.mp4",
  source_video: "source_video.mp4",
  yolo_csv: "yolo_detections.csv",
  tracked_objects_csv: "tracked_objects.csv",
  tracked_objects_json: "tracked_objects.json",
  ocr_csv: "ocr_text.csv",
  summary_json: "analysis_summary.json",
  audio: "extracted_audio.wav",
  transcript: "transcript.json",
  linked_transcript: "linked_transcript.json",
  audio_prosody: "audio_prosody.json",
  audio_diarization: "audio_diarization.json",
  audio_sample_clouds: "audio_sample_clouds.json",
  identity_triangulation: "identity_triangulation_bundle.json",
  dependency_sfl_stage1: "dependency_sfl_stage1.json",
  multimodal_meaning_stage1: "multimodal_meaning_stage1.json",
  agent_persistence_scene_cut: "agent_persistence_scene_cut.json",
  second_order_label_proliferation: "second_order_label_proliferation.json",
  narrative_lens_reading: "narrative_lens_reading.json",
  character_path_reading: "character_path_reading.json",
  datascene_meaning_network: "datascene_meaning_network.json",
  mise_en_scene_scene_cards: "mise_en_scene_scene_card_report.json",
  mise_en_scene_scene_card_report_draft_md: "mise_en_scene_scene_card_report_draft.md",
  source_extraction_metadata_summary: "scene_card_source_extraction_metadata_summary.json",
  time_bank_audio: "time_bank_audio.json",
  time_bank_ocr: "time_bank_ocr.json",
  time_bank_objects: "time_bank_objects.json",
  time_bank_expressions: "time_bank_expressions.json",
  lm_transcript: "lm_transcript.json",
  pos_analysis: "pos_analysis.json",
  expression_json: "expressions.json",
  quan_analysis: "quan_analysis.json",
  source_media_metadata_json: "source_media_metadata.json",
  source_media_metadata_csv: "source_media_metadata.csv",
  annotation_corrections: "annotation_corrections.json",
  pos_matrix: "pos_matrix.json",
  quant_matrix: "quant_matrix.json",
  face_anonymization_manifest: "face_anonymization_manifest.json",
};

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

export function projectRoot() {
  let current = process.cwd();
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "api_server.py"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), "../..");
}

export function slugifyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "vaa1_project";
}

export async function readAnalysisRecord(analysisId: string) {
  const recordPath = path.join(projectRoot(), "outputs", "api_results", analysisId, "analysis_record.json");
  const record = JSON.parse(await fs.readFile(recordPath, "utf8"));
  return { ...record, analysis_id: record.analysis_id || analysisId };
}

export function safeProjectPath(rawPath: string) {
  const root = projectRoot();
  const resolved = path.resolve(root, rawPath);
  if (!resolved.startsWith(root)) {
    throw new Error("Refusing to read outside project root");
  }
  return resolved;
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, day };
}

export function makeZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const stamp = dosTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/^\/+/, ""), "utf8");
    const checksum = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(stamp.time, 10);
    localHeader.writeUInt16LE(stamp.day, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(stamp.time, 12);
    centralHeader.writeUInt16LE(stamp.day, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

export async function entriesForAnalysis(record: LocalAnalysisRecord, archivePrefix = "") {
  const entries: ZipEntry[] = [];
  const skipped: Array<{ file_type: string; reason: string }> = [];
  const outputFiles = record.output_files || {};

  for (const [fileType, rawPath] of Object.entries(outputFiles)) {
    if (!rawPath || typeof rawPath !== "string") {
      skipped.push({ file_type: fileType, reason: "empty_path" });
      continue;
    }
    try {
      const filePath = safeProjectPath(rawPath);
      const data = await fs.readFile(filePath);
      entries.push({
        name: `${archivePrefix}${FILE_MAPPING[fileType] || path.basename(filePath)}`,
        data,
      });
    } catch {
      skipped.push({ file_type: fileType, reason: "missing_or_not_file" });
    }
  }

  entries.push({
    name: `${archivePrefix}saved_work_manifest.json`,
    data: Buffer.from(
      JSON.stringify(
        {
          analysis_id: record.analysis_id,
          original_filename: record.original_filename,
          source_video_path: record.source_video_path || record.file_path,
          source_media_metadata: record.source_media_metadata || {},
          annotation_corrections: record.annotation_corrections || {},
          analysis_completed_at: record.analysis_completed_at,
          pipeline_type: record.pipeline_type || "full",
          analysis_tier: record.analysis_tier || "science_scan",
          modality_focus: record.modality_focus || "multimodal",
          skipped_output_files: skipped,
        },
        null,
        2,
      ),
      "utf8",
    ),
  });

  return { entries, skipped };
}
