// src/frontend/lib/video-service.ts
import { apiService } from './api-service';

// Type Definitions
export interface VideoMetadata {
  id: string;
  name: string;
  length?: number;
  size?: number;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  uploadedAt?: string;
  processingTime?: number;
  pipelineType?: 'full' | 'visual_only' | 'audio_only';
}

export interface TranscriptSegment {
  t: string; // Formatted timestamp like "12.5s"
  text: string;
  speaker: string;
  start: number; // Raw start time in seconds
  end: number; // Raw end time in seconds
}

export interface DetectedObject {
  name: string;
  count: number;
  confidence?: number;
  firstSeen?: string;
  lastSeen?: string;
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
}

// Updated AnalysisStatus with pipeline_type
export interface AnalysisStatus {
  analysis_id: string;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
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
}

export class VideoService {
  private static readonly MAX_CSV_PREVIEW_LINES = 50;

  /**
   * Upload a video file to the Docker API
   */
  static async upload(file: File, duration?: number): Promise<UploadResponse> {
    try {
      const response = await apiService.uploadVideo(file);
      
      return {
        ...response,
        duration: duration || 0,
        size: file.size
      };
    } catch (error) {
      console.error('VideoService.upload failed:', error);
      throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get video metadata from Docker API
   */
  static async get(id: string): Promise<VideoMetadata> {
    try {
      // Cast to our extended AnalysisStatus type
      const status = await apiService.getStatus(id) as AnalysisStatus;
      
      return {
        id: status.analysis_id,
        name: status.filename,
        status: status.status,
        progress: status.progress || 0,
        error: status.error,
        processingTime: status.processing_time,
        pipelineType: status.pipeline_type as 'full' | 'visual_only' | 'audio_only'
      };
    } catch (error) {
      console.error('VideoService.get failed:', error);
      return {
        id,
        name: 'Unknown',
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to load video metadata'
      };
    }
  }

  /**
   * Get video blob (annotated video) from Docker API
   */
  static async getBlob(id: string): Promise<Blob | null> {
    try {
      const status = await apiService.getStatus(id) as AnalysisStatus;
      
      if (status.status === 'completed' && status.download_links?.video) {
        return await apiService.downloadFile(id, 'video');
      }
      
      return null;
    } catch (error) {
      console.warn('VideoService.getBlob failed:', error);
      return null;
    }
  }

  /**
   * Get comprehensive analysis results
   */
  static async getAnalysis(id: string): Promise<AnalysisData> {
    try {
      const status = await apiService.getStatus(id) as AnalysisStatus;
      
      // If analysis is not complete, return minimal data
      if (status.status !== 'completed') {
        return {
          transcript: [],
          detectedObjects: [],
          quantityDetection: [],
          annotations: [],
          summary: `Analysis ${status.status} (${status.progress}%)`,
          rawCsv: '',
          status: status.status,
          metadata: {
            yoloDetections: 0,
            ocrDetections: 0
          }
        };
      }

      // Load all data in parallel
      const [csvData, transcriptData, objects] = await Promise.allSettled([
        this.loadCsvData(id),
        this.loadTranscriptData(id),
        this.loadDetectedObjects(id)
      ]);

      return {
        transcript: transcriptData.status === 'fulfilled' ? transcriptData.value : [],
        detectedObjects: objects.status === 'fulfilled' ? objects.value : [],
        quantityDetection: objects.status === 'fulfilled' ? objects.value : [],
        annotations: [], // Placeholder for future annotations
        summary: this.generateSummary(status),
        rawCsv: csvData.status === 'fulfilled' ? csvData.value : '',
        status: 'completed',
        downloadLinks: status.download_links,
        metadata: {
          yoloDetections: status.summary?.yolo_detections || 0,
          ocrDetections: status.summary?.ocr_detections || 0,
          audioSegments: status.summary?.audio_segments,
          audioLanguage: status.summary?.audio_language
        }
      };
    } catch (error) {
      console.error('VideoService.getAnalysis failed:', error);
      throw error;
    }
  }

  /**
   * Start analysis for a video
   */
  static async startAnalysis(
    id: string, 
    pipelineType: 'full' | 'visual_only' | 'audio_only' = 'full'
  ): Promise<any> {
    try {
      return await apiService.startAnalysis(id, pipelineType);
    } catch (error) {
      console.error('VideoService.startAnalysis failed:', error);
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
      console.error('VideoService.exportFile failed:', error);
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
        name: info.filename || 'Unknown',
        status: info.status || 'unknown',
        progress: info.progress || 0,
        uploadedAt: info.start_time ? new Date(info.start_time * 1000).toISOString() : new Date().toISOString(),
        pipelineType: info.pipeline_type
      }));
    } catch (error) {
      console.error('VideoService.listVideos failed:', error);
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
    timeout: number = 300000 // 5 minutes
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
      console.error('VideoService.deleteAnalysis failed:', error);
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
        name: newName
      };
    } catch (error) {
      console.error('VideoService.rename failed:', error);
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
      console.error('VideoService.updateTag failed:', error);
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
      const csvBlob = await apiService.downloadFile(id, 'yolo_csv');
      const csvText = await csvBlob.text();
      
      // Limit preview size for performance
      const lines = csvText.split('\n');
      if (lines.length > this.MAX_CSV_PREVIEW_LINES + 1) {
        const header = lines[0];
        const preview = lines.slice(1, this.MAX_CSV_PREVIEW_LINES + 1);
        return [header, ...preview, `\n... ${lines.length - this.MAX_CSV_PREVIEW_LINES - 1} more rows`].join('\n');
      }
      
      return csvText;
    } catch (error) {
      console.warn('Failed to load CSV data:', error);
      return 'CSV data not available';
    }
  }

  private static async loadTranscriptData(id: string): Promise<TranscriptSegment[]> {
    try {
      const transcriptBlob = await apiService.downloadFile(id, 'transcript');
      const transcriptText = await transcriptBlob.text();
      const transcriptData = JSON.parse(transcriptText);
      
      return (transcriptData.segments || []).map((seg: any) => ({
        t: `${Number(seg.start).toFixed(1)}s`,
        text: seg.text || '',
        speaker: 'Speaker 1',
        start: seg.start || 0,
        end: seg.end || 0
      }));
    } catch (error) {
      console.warn('Failed to load transcript:', error);
      return [];
    }
  }

  private static async loadDetectedObjects(id: string): Promise<DetectedObject[]> {
    try {
      const csvBlob = await apiService.downloadFile(id, 'yolo_csv');
      const csvText = await csvBlob.text();
      
      const lines = csvText.split('\n').slice(1); // Skip header
      const objectStats = new Map<string, { count: number, confidences: number[] }>();
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.split(',');
        if (parts.length >= 4) {
          const className = parts[3]?.replace(/"/g, '').trim();
          const confidence = parseFloat(parts[2]?.replace(/"/g, '').trim() || '0');
          
          if (className) {
            const existing = objectStats.get(className) || { count: 0, confidences: [] };
            existing.count += 1;
            existing.confidences.push(confidence);
            objectStats.set(className, existing);
          }
        }
      }
      
      return Array.from(objectStats.entries()).map(([name, stats]) => ({
        name,
        count: stats.count,
        confidence: stats.confidences.length > 0 
          ? stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length 
          : undefined
      }));
    } catch (error) {
      console.warn('Failed to parse detected objects:', error);
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
      ? `Analysis complete. ${summary.join(', ')}.`
      : 'Analysis complete.';
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
      return health.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}