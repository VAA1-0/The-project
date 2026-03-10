// src/frontend/lib/video-service.ts
import { apiService } from "./api-service";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

// Type Definitions
export interface VideoMetadata {
  id: string;
  name: string;
  length?: number;
  size?: number;
  status: "uploaded" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
  uploadedAt?: string;
  processingTime?: number;
  pipelineType?: "full" | "visual_only" | "audio_only";
  cvatID?: number;
}

export interface TranscriptSegment {
  t: string; // Formatted timestamp like "12.5s"
  text: string;
  speaker: string;
  start: number; // Raw start time in seconds
  end: number; // Raw end time in seconds
}

export interface DetectedObject {
  timestamp: number;
  class_id: number;
  class_name: string;
  confidence: number;
}

export interface OCR {
  timestamp: number;
  text: string;
  confidence: number;
}

export interface POSAnalysis {
  text: string;
  pos_counts: {
    NOUN: number;
    VERB: number;
    ADP: number;
    ADV: number;
  };
  pos_ratios: {
    verb_noun_ratio: number;
    modal_density: number;
    pronoun_share: number;
    adj_adv_ratio: number;
    nominalization_density: number;
  };
  interrogative_lens: {
    who: [];
    what: [];
    when: [];
    where: [];
    why: [];
    how: [];
    by_what_means: [];
    towards_what_end: [];
    whence: [];
    by_what_consequence: [];
  };
  pos_words: {
    NOUN: [];
    VERB: [];
    ADV: [];
    ADP: [];
  };
}

export interface QuantAnalysis {
  stats_df: Array<{
    Document: string;
    Sentences: number;
    Words: number;
  }>;
  token_info: {
    tokens: string[];
    tokens_filtered: string[];
    ttr: number;
    freq_dist: Record<string, number>;
  };
  tfidf_df: Array<{
    Document: string;
    TopTerms: string[];
  }>;
  bigrams: any[];
  sentence_tags: Array<{
    sentence: string;
    WHO: boolean;
    WHY: boolean;
  }>;
}

export interface AnalysisData {
  quantAnalysis: QuantAnalysis[];
  posAnalysis: POSAnalysis[];
  transcript: TranscriptSegment[];
  detectedObjects: DetectedObject[];
  ocr: OCR[];
  quantityDetection: DetectedObject[];
  annotations: any[];
  summary: string;
  rawCsv: string;
  rawJson?: any;
  status: string;
  downloadLinks?: Record<string, string>;
  metadata?: {
    yoloDetections: number;
    ocrDetections: number;
    audioSegments?: number;
    audioLanguage?: string;
  };
}

export interface UploadResponse {
  analysis_id: string;
  filename: string;
  message: string;
  status: string;
  duration?: number;
  size?: number;
  cvatID: number;
}

// Updated AnalysisStatus with pipeline_type
export interface AnalysisStatus {
  analysis_id: string;
  status: "uploaded" | "processing" | "completed" | "error";
  progress: number;
  filename: string;
  error?: string;
  processing_time?: number;
  summary?: {
    yolo_detections: number;
    ocr_detections: number;
    audio_segments?: number;
    audio_language?: string;
  };
  download_links?: Record<string, string>;
  pipeline_type?: string; // This was missing
  cvatID?: number;
}

export class VideoService {
  private static readonly MAX_CSV_PREVIEW_LINES = 50;

  /**
   * Upload a video file to the Docker API
   */
  static async upload(
    file: File,
    cvatID: number,
    duration?: number,
  ): Promise<UploadResponse> {
    try {
      const response = await apiService.uploadVideo(file, cvatID);
      return {
        ...response,
        cvatID: cvatID || 0,
        duration: duration || 0,
        size: file.size,
      };
    } catch (error) {
      console.error("VideoService.upload failed:", error);
      throw new Error(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * Get video metadata from Docker API
   */
  static async get(id: string): Promise<VideoMetadata> {
    try {
      // Cast to our extended AnalysisStatus type
      const status = (await apiService.getStatus(id)) as AnalysisStatus;

      return {
        id: status.analysis_id,
        name: status.filename,
        status: status.status,
        progress: status.progress || 0,
        error: status.error,
        processingTime: status.processing_time,
        pipelineType: status.pipeline_type as
          | "full"
          | "visual_only"
          | "audio_only",
        cvatID: status.cvatID,
      };
    } catch (error) {
      console.error("VideoService.get failed:", error);
      return {
        id,
        name: "Unknown",
        status: "error",
        progress: 0,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load video metadata",
      };
    }
  }

  /**
   * Get video blob (annotated video) from Docker API
   */
  static async getBlob(id: string): Promise<Blob | null> {
    try {
      const status = (await apiService.getStatus(id)) as AnalysisStatus;

      if (status.status === "completed" && status.download_links?.video) {
        return await apiService.downloadFile(id, "video");
      }

      return null;
    } catch (error) {
      console.warn("VideoService.getBlob failed:", error);
      return null;
    }
  }

  /**
   * Get comprehensive analysis results
   */
  static async getAnalysis(id: string): Promise<AnalysisData> {
    try {
      const status = (await apiService.getStatus(id)) as AnalysisStatus;

      // If analysis is not complete, return minimal data
      if (status.status !== "completed") {
        return {
          quantAnalysis: [],
          posAnalysis: [],
          transcript: [],
          detectedObjects: [],
          ocr: [],
          quantityDetection: [],
          annotations: [],
          summary: `Analysis ${status.status} (${status.progress}%)`,
          rawCsv: "",
          status: status.status,
          metadata: {
            yoloDetections: 0,
            ocrDetections: 0,
          },
        };
      }

      // Load all data in parallel
      const [
        csvData,
        transcriptData,
        objects,
        ocr,
        posAnalysisData,
        quantAnalysisData,
      ] = await Promise.allSettled([
        this.loadCsvData(id),
        this.loadTranscriptData(id),
        this.loadDetectedObjects(id),
        this.loadOCR(id),
        this.loadPosAnalysis(id),
        this.loadQuantAnalysis(id),
      ]);

      return {
        quantAnalysis:
          quantAnalysisData.status === "fulfilled"
            ? quantAnalysisData.value
            : [],
        posAnalysis:
          posAnalysisData.status === "fulfilled" ? posAnalysisData.value : [],
        transcript:
          transcriptData.status === "fulfilled" ? transcriptData.value : [],
        detectedObjects: objects.status === "fulfilled" ? objects.value : [],
        ocr: ocr.status === "fulfilled" ? ocr.value : [],
        quantityDetection: objects.status === "fulfilled" ? objects.value : [],
        annotations: [], // Placeholder for future annotations
        summary: this.generateSummary(status),
        rawCsv: csvData.status === "fulfilled" ? csvData.value : "",
        status: "completed",
        downloadLinks: status.download_links,
        metadata: {
          yoloDetections: status.summary?.yolo_detections || 0,
          ocrDetections: status.summary?.ocr_detections || 0,
          audioSegments: status.summary?.audio_segments,
          audioLanguage: status.summary?.audio_language,
        },
      };
    } catch (error) {
      console.error("VideoService.getAnalysis failed:", error);
      throw error;
    }
  }

  /**
   * Start analysis for a video
   */
  static async startAnalysis(
    id: string,
    pipelineType: "full" | "visual_only" | "audio_only" = "full",
  ): Promise<any> {
    try {
      return await apiService.startAnalysis(id, pipelineType);
    } catch (error) {
      console.error("VideoService.startAnalysis failed:", error);
      throw error;
    }
  }

  /**
   * Export/download a specific file type
   */
  static async exportFile(id: string, fileType: string): Promise<void> {
    try {
      await apiService.downloadAndSaveFile(id, fileType);
    } catch (error) {
      console.error("VideoService.exportFile failed:", error);
      throw error;
    }
  }

  /**
   * Get list of recent analyses
   */
  static async listVideos(limit: number = 20): Promise<VideoMetadata[]> {
    try {
      const response = await apiService.listAnalyses(limit);
      const analyses = response.analyses || {};

      return Object.entries(analyses).map(([id, info]: [string, any]) => ({
        id,
        name: info.filename || "Unknown",
        status: info.status || "unknown",
        progress: info.progress || 0,
        uploadedAt: info.start_time
          ? new Date(info.start_time * 1000).toISOString()
          : new Date().toISOString(),
        pipelineType: info.pipeline_type,
        cvatID: info.cvatID,
      }));
    } catch (error) {
      console.warn(
        "VideoService.listVideos failed, returning empty array:",
        error,
      );
      return [];
    }
  }

  /**
   * Poll for analysis status updates
   */
  static async pollStatus(
    id: string,
    onProgress: (status: AnalysisStatus) => void,
    interval: number = 2000,
    timeout: number = 300000, // 5 minutes
  ): Promise<AnalysisStatus> {
    return apiService.pollStatus(id, onProgress, interval, timeout);
  }

  /**
   * Delete a video analysis (alias for deleteAnalysis)
   */
  static async delete(id: string): Promise<void> {
    return this.deleteAnalysis(id);
  }

  /**
   * Delete an analysis and its files
   */
  static async deleteAnalysis(id: string): Promise<void> {
    try {
      await apiService.deleteAnalysis(id);
    } catch (error) {
      console.error("VideoService.deleteAnalysis failed:", error);
      throw error;
    }
  }

  /**
   * Rename a video
   * Note: This is a client-side operation since the API doesn't support rename
   * The actual filename in the backend remains the same
   */
  static async rename(id: string, newName: string): Promise<VideoMetadata> {
    try {
      // Get current metadata
      const current = await this.get(id);

      // Return updated metadata (client-side only)
      return {
        ...current,
        name: newName,
      };
    } catch (error) {
      console.error("VideoService.rename failed:", error);
      throw error;
    }
  }

  /**
   * Update tags for a video
   * Note: This is a client-side operation
   */
  static async updateTag(id: string, tag: string): Promise<VideoMetadata> {
    try {
      // Get current metadata
      const current = await this.get(id);

      // Return metadata (tags would be stored separately in a real app)
      return current;
    } catch (error) {
      console.error("VideoService.updateTag failed:", error);
      throw error;
    }
  }

  /**
   * Get video by ID (alias for get)
   */
  static async getVideo(id: string): Promise<VideoMetadata> {
    return this.get(id);
  }

  /**
   * List all videos (alias for listVideos)
   */
  static async list(): Promise<VideoMetadata[]> {
    return this.listVideos();
  }

  // Private helper methods

  private static async loadCsvData(id: string): Promise<string> {
    try {
      const csvBlob = await apiService.downloadFile(id, "yolo_csv");
      const csvText = await csvBlob.text();

      // Limit preview size for performance
      const lines = csvText.split("\n");
      if (lines.length > this.MAX_CSV_PREVIEW_LINES + 1) {
        const header = lines[0];
        const preview = lines.slice(1, this.MAX_CSV_PREVIEW_LINES + 1);
        return [
          header,
          ...preview,
          `\n... ${lines.length - this.MAX_CSV_PREVIEW_LINES - 1} more rows`,
        ].join("\n");
      }

      return csvText;
    } catch (error) {
      console.warn("Failed to load CSV data:", error);
      return "CSV data not available";
    }
  }

  private static async loadTranscriptData(
    id: string,
  ): Promise<TranscriptSegment[]> {
    try {
      const transcriptBlob = await apiService.downloadFile(id, "transcript");
      const transcriptText = await transcriptBlob.text();
      const transcriptData = JSON.parse(transcriptText);

      return (transcriptData.segments || []).map((seg: any) => ({
        t: `${Number(seg.start).toFixed(1)}s`,
        text: seg.text || "",
        speaker: "Speaker 1",
        start: seg.start || 0,
        end: seg.end || 0,
      }));
    } catch (error) {
      console.warn("Failed to load transcript:", error);
      return [];
    }
  }

  private static async loadDetectedObjects(
    id: string,
  ): Promise<DetectedObject[]> {
    try {
      const csvBlob = await apiService.downloadFile(id, "yolo_csv");
      const csvText = await csvBlob.text();

      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as any[];

      return records.map((row) => ({
        timestamp: row.timestamp ? Number(row.timestamp) : 0,
        class_id: row.class_id ? Number(row.class_id) : 0,
        class_name: row.label || row.class_name || "",
        confidence: Number(row.confidence) ? Number(row.confidence) : 0,
      }));
    } catch (error) {
      console.warn("Failed to parse detected objects:", error);
      return [];
    }
  }


  /**
   * Load OCR data
   */
  private static async loadOCR(
    id: string,
  ): Promise<OCR[]> {
        try {
      const csvBlob = await apiService.downloadFile(id, "ocr_csv");
      const csvText = await csvBlob.text();

      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as any[];

      return records.map((row) => ({
        timestamp: row.timestamp ? Number(row.timestamp) : 0,
        text: row.label || row.text || "",
        confidence: Number(row.confidence) ? Number(row.confidence) : 0,
      }));
    } catch (error) {
      console.warn("Failed to parse detected objects:", error);
      return [];
    }
  }


  /**
   * Load POS Analysis data
   */
  private static async loadPosAnalysis(id: string): Promise<POSAnalysis[]> {
    try {
      const posBlob = await apiService.downloadFile(id, "pos_analysis");
      const posText = await posBlob.text();
      const posData = JSON.parse(posText);

      // Helper to normalize a single POSAnalysis object
      const normalize = (data: any): POSAnalysis => ({
        text: data.text || "",
        pos_counts: {
          NOUN: Number(data.pos_counts?.NOUN) || 0,
          VERB: Number(data.pos_counts?.VERB) || 0,
          ADP: Number(data.pos_counts?.ADP) || 0,
          ADV: Number(data.pos_counts?.ADV) || 0,
        },
        pos_ratios: {
          verb_noun_ratio: Number(data.pos_ratios?.verb_noun_ratio) || 0,
          modal_density: Number(data.pos_ratios?.modal_density) || 0,
          pronoun_share: Number(data.pos_ratios?.pronoun_share) || 0,
          adj_adv_ratio: Number(data.pos_ratios?.adj_adv_ratio) || 0,
          nominalization_density:
            Number(data.pos_ratios?.nominalization_density) || 0,
        },
        interrogative_lens: {
          who: Array.isArray(data.interrogative_lens?.who)
            ? data.interrogative_lens.who
            : [],
          what: Array.isArray(data.interrogative_lens?.what)
            ? data.interrogative_lens.what
            : [],
          when: Array.isArray(data.interrogative_lens?.when)
            ? data.interrogative_lens.when
            : [],
          where: Array.isArray(data.interrogative_lens?.where)
            ? data.interrogative_lens.where
            : [],
          why: Array.isArray(data.interrogative_lens?.why)
            ? data.interrogative_lens.why
            : [],
          how: Array.isArray(data.interrogative_lens?.how)
            ? data.interrogative_lens.how
            : [],
          by_what_means: Array.isArray(data.interrogative_lens?.by_what_means)
            ? data.interrogative_lens.by_what_means
            : [],
          towards_what_end: Array.isArray(
            data.interrogative_lens?.towards_what_end,
          )
            ? data.interrogative_lens.towards_what_end
            : [],
          whence: Array.isArray(data.interrogative_lens?.whence)
            ? data.interrogative_lens.whence
            : [],
          by_what_consequence: Array.isArray(
            data.interrogative_lens?.by_what_consequence,
          )
            ? data.interrogative_lens.by_what_consequence
            : [],
        },
        pos_words: {
          NOUN: Array.isArray(data.pos_words?.NOUN) ? data.pos_words.NOUN : [],
          VERB: Array.isArray(data.pos_words?.VERB) ? data.pos_words.VERB : [],
          ADV: Array.isArray(data.pos_words?.ADV) ? data.pos_words.ADV : [],
          ADP: Array.isArray(data.pos_words?.ADP) ? data.pos_words.ADP : [],
        },
      });

      if (Array.isArray(posData)) {
        return posData.map(normalize);
      } else {
        return [normalize(posData)];
      }
    } catch (error) {
      console.warn("Failed to load POS analysis:", error);
      return [];
    }
  }

  private static async loadQuantAnalysis(id: string): Promise<QuantAnalysis[]> {
    // Placeholder for future quantitative analysis loading
    try {
      const quantBlob = await apiService.downloadFile(id, "quan_analysis");
      const quantText = await quantBlob.text();
      const quantData = JSON.parse(quantText);

      // Helper to normalize a single QuantAnalysis object
      const normalize = (data: any): QuantAnalysis => ({
        stats_df: Array.isArray(data.stats_df)
          ? data.stats_df.map((stat: any) => ({
              Document: stat.Document || "",
              Sentences: Number(stat.Sentences) || 0,
              Words: Number(stat.Words) || 0,
            }))
          : [],
        token_info: {
          tokens: Array.isArray(data.token_info?.tokens)
            ? data.token_info.tokens
            : [],
          tokens_filtered: Array.isArray(data.token_info?.tokens_filtered)
            ? data.token_info.tokens_filtered
            : [],
          ttr: Number(data.token_info?.ttr) || 0,
          freq_dist:
            typeof data.token_info?.freq_dist === "object" &&
            data.token_info?.freq_dist !== null
              ? data.token_info.freq_dist
              : {},
        },
        tfidf_df: Array.isArray(data.tfidf_df)
          ? data.tfidf_df.map((tfidf: any) => ({
              Document: tfidf.Document || "",
              TopTerms: Array.isArray(tfidf.TopTerms) ? tfidf.TopTerms : [],
            }))
          : [],
        bigrams: Array.isArray(data.bigrams) ? data.bigrams : [],
        sentence_tags: Array.isArray(data.sentence_tags)
          ? data.sentence_tags.map((tag: any) => ({
              sentence: tag.sentence || "",
              WHO: Boolean(tag.WHO),
              WHY: Boolean(tag.WHY),
            }))
          : [],
      });

      if (Array.isArray(quantData)) {
        return quantData.map(normalize);
      } else {
        return [normalize(quantData)];
      }
    } catch (error) {
      console.warn("Failed to load Quantitative analysis:", error);
      return [];
    }
  }

  private static generateSummary(status: AnalysisStatus): string {
    const summary = [];

    if (status.summary?.yolo_detections) {
      summary.push(`${status.summary.yolo_detections} objects detected`);
    }

    if (status.summary?.ocr_detections) {
      summary.push(`${status.summary.ocr_detections} text regions found`);
    }

    if (status.summary?.audio_segments) {
      summary.push(`${status.summary.audio_segments} speech segments`);
    }

    if (status.processing_time) {
      summary.push(`Processed in ${status.processing_time.toFixed(1)}s`);
    }

    return summary.length > 0
      ? `Analysis complete. ${summary.join(", ")}.`
      : "Analysis complete.";
  }

  /**
   * Get supported file types for download
   */
  static getSupportedFileTypes(): string[] {
    return apiService.getSupportedFileTypes();
  }

  /**
   * Get display name for a file type
   */
  static getFileTypeDisplayName(fileType: string): string {
    return apiService.getFileTypeDisplayName(fileType);
  }

  /**
   * Get file extension for a file type
   */
  static getFileExtension(fileType: string): string {
    return apiService.getFileExtension(fileType);
  }

  /**
   * Check if API is healthy
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const health = await apiService.healthCheck();
      return health.status === "healthy";
    } catch (error) {
      return false;
    }
  }
}
