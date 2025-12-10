import { apiService } from "./api-service";
import type { 
  ExtendedAnalysisStatus, 
  ExtendedUploadResponse 
} from "./api-service";

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
  t: string;
  text: string;
  speaker: string;
  start: number;
  end: number;
}

export interface DetectedObject {
  timestamp: number;
  class_id: number;
  class_name: string;
  confidence: number;
}

export interface AnalysisData {
  transcript: TranscriptSegment[];
  detectedObjects: DetectedObject[];
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

// Re-export extended types for compatibility
export type AnalysisStatus = ExtendedAnalysisStatus;

export class VideoService {
  private static readonly MAX_CSV_PREVIEW_LINES = 50;

  /**
   * Upload a video file
   */
  static async upload(
    file: File,
    cvatID: number,
    duration?: number
  ): Promise<UploadResponse> {
    try {
      console.log(`Uploading video: ${file.name}, cvatID: ${cvatID}`);
      const response: ExtendedUploadResponse = await apiService.uploadVideo(file, cvatID);
      return {
        analysis_id: response.analysis_id,
        filename: response.filename,
        message: response.message,
        status: response.status,
        cvatID: response.cvatID || 0,
        duration: duration || 0,
        size: file.size,
      };
    } catch (error) {
      console.error("VideoService.upload failed:", error);
      throw new Error(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get video metadata
   */
  static async get(id: string): Promise<VideoMetadata> {
    try {
      const status: ExtendedAnalysisStatus = await apiService.getStatus(id);
      
      return {
        id: status.analysis_id,
        name: status.filename,
        status: status.status,
        progress: status.progress || 0,
        error: status.error,
        processingTime: status.processing_time,
        pipelineType: status.pipeline_type as "full" | "visual_only" | "audio_only",
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
   * Get video blob (annotated video)
   */
  static async getBlob(id: string): Promise<Blob | null> {
    try {
      const status: ExtendedAnalysisStatus = await apiService.getStatus(id);

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
      const status: ExtendedAnalysisStatus = await apiService.getStatus(id);

      // If analysis is not complete, return minimal data
      if (status.status !== "completed") {
        return {
          transcript: [],
          detectedObjects: [],
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
      const [csvData, transcriptData, objects] = await Promise.allSettled([
        this.loadCsvData(id),
        this.loadTranscriptData(id),
        this.loadDetectedObjects(id),
      ]);

      return {
        transcript:
          transcriptData.status === "fulfilled" ? transcriptData.value : [],
        detectedObjects: objects.status === "fulfilled" ? objects.value : [],
        quantityDetection: objects.status === "fulfilled" ? objects.value : [],
        annotations: [],
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
      // Return empty analysis instead of throwing
      return {
        transcript: [],
        detectedObjects: [],
        quantityDetection: [],
        annotations: [],
        summary: "Analysis failed to load",
        rawCsv: "",
        status: "error",
        metadata: {
          yoloDetections: 0,
          ocrDetections: 0,
        },
      };
    }
  }

  /**
   * Start analysis for a video
   */
  static async startAnalysis(
    id: string,
    pipelineType: "full" | "visual_only" | "audio_only" = "full"
  ): Promise<any> {
    try {
      console.log(`Starting analysis for ${id}, pipeline: ${pipelineType}`);
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
      console.log(`Exporting ${fileType} for ${id}`);
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
      console.log("Fetching video list...");
      const response = await apiService.listAnalyses(limit);
      const analyses = response.analyses || {};

      const videos = Object.entries(analyses).map(([id, info]: [string, any]) => ({
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

      console.log(`Found ${videos.length} videos`);
      return videos;
    } catch (error) {
      console.error("VideoService.listVideos failed:", error);
      return [];
    }
  }

  /**
   * Poll for analysis status updates
   */
  static async pollStatus(
    id: string,
    onProgress: (status: ExtendedAnalysisStatus) => void,
    interval: number = 2000,
    timeout: number = 300000
  ): Promise<ExtendedAnalysisStatus> {
    return apiService.pollStatus(id, onProgress, interval, timeout);
  }

  /**
   * Delete a video analysis
   */
  static async delete(id: string): Promise<void> {
    try {
      console.log(`Deleting video ${id}`);
      await apiService.deleteAnalysis(id);
    } catch (error) {
      console.error("VideoService.delete failed:", error);
      throw error;
    }
  }

  /**
   * Rename a video (client-side only)
   */
  static async rename(id: string, newName: string): Promise<VideoMetadata> {
    try {
      const current = await this.get(id);
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
   * Update tags for a video (client-side only)
   */
  static async updateTag(id: string, tag: string): Promise<VideoMetadata> {
    try {
      const current = await this.get(id);
      return current;
    } catch (error) {
      console.error("VideoService.updateTag failed:", error);
      throw error;
    }
  }

  /**
   * Get video by ID
   */
  static async getVideo(id: string): Promise<VideoMetadata> {
    return this.get(id);
  }

  /**
   * List all videos
   */
  static async list(): Promise<VideoMetadata[]> {
    return this.listVideos();
  }

  /**
   * Check if backend is healthy
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const health = await apiService.healthCheck();
      return health.status === "healthy";
    } catch (error) {
      console.warn("Backend health check failed:", error);
      return false;
    }
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
    id: string
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
    id: string
  ): Promise<DetectedObject[]> {
    try {
      const csvBlob = await apiService.downloadFile(id, "yolo_csv");
      const csvText = await csvBlob.text();

      // Simple CSV parsing without external library
      const lines = csvText.split("\n").filter(line => line.trim());
      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map(h => h.trim());
      const records = lines.slice(1).map(line => {
        const values = line.split(',');
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index]?.trim() || '';
        });
        return record;
      });

      return records.map((row: any) => ({
        timestamp: row.timestamp ? Number(row.timestamp) : 0,
        class_id: row.class_id ? Number(row.class_id) : 0,
        class_name: row.label || row.class_name || row.class || "Unknown",
        confidence: row.confidence ? Number(row.confidence) : 0,
      }));
    } catch (error) {
      console.warn("Failed to parse detected objects:", error);
      return [];
    }
  }

  private static generateSummary(status: ExtendedAnalysisStatus): string {
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
}