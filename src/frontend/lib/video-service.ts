// lib/video-service.ts

import { apiService } from './api-service';
import { Library } from "./local-library";
import { saveVideoBlob, getVideoBlob, deleteVideoBlob } from "./blob-store";

// Use the VideoItem type from local-library to ensure compatibility
type LibraryVideoItem = import('./local-library').VideoItem;

// Extend the local library type with our additional properties
interface VideoItem extends LibraryVideoItem {
  status: string;
  progress: number;
  analysis: {
    yolo_detections?: number;
    ocr_detections?: number;
    audio_segments?: number;
    audio_language?: string;
  } | null;
}

interface AnalysisResult {
  summary: string;
  transcript: Array<{
    t: string;
    speaker: string;
    text: string;
  }>;
  detectedObjects: Array<{
    name: string;
    count: number;
    firstSeen: string;
    confidence: number;
  }>;
  quantityDetection: Array<{
    label: string;
    data: number[];
  }>;
  annotations: Array<{
    note: string;
    time: string;
  }>;
  rawCsv: string;
}

interface UploadResponse {
  success: boolean;
  id: string;
  name?: string;
  status?: string;
}

const USE_BACKEND = Boolean(process.env.NEXT_PUBLIC_API_URL); 

export const VideoService = {
  // -----------------------------
  // GET VIDEO METADATA
  // -----------------------------
  async get(id: string): Promise<VideoItem | null> {
    if (USE_BACKEND) {
      try {
        const status = await apiService.getStatus(id);
        return {
          id: id,
          name: status.filename,
          status: status.status,
          progress: status.progress,
          length: 0,
          tag: null,
          analysis: status.summary ? {
            yolo_detections: status.summary.yolo_detections,
            ocr_detections: status.summary.ocr_detections,
            audio_segments: (status.summary as any).audio_segments,
            audio_language: (status.summary as any).audio_language
          } : null
        };
      } catch (err) {
        console.warn("Backend unavailable, using fallback local DB");
      }
    }
    
    // Convert local library item to our extended type
    const localVideo = Library.getById(id);
    if (localVideo) {
      return {
        ...localVideo,
        status: 'completed', // Default status for local videos
        progress: 100, // Default progress for local videos
        analysis: null // Default analysis for local videos
      };
    }
    return null;
  },

  // -----------------------------
  // GET VIDEO BLOB (actual file)
  // -----------------------------
  async getBlob(id: string): Promise<Blob | null> {
    if (USE_BACKEND) {
      try {
        return await apiService.downloadFile(id, 'video');
      } catch (err) {
        console.warn("Backend blob unavailable, using fallback blob");
      }
    }
    
    const blob = await getVideoBlob(id);
    return blob || null;
  },

  // -----------------------------
  // GET ANALYSIS
  // -----------------------------
  async getAnalysis(id: string): Promise<AnalysisResult> {
    if (USE_BACKEND) {
      try {
        const status = await apiService.getStatus(id);
        
        if (status.status !== 'completed') {
          return this.getInProgressAnalysis(status);
        }

        // Try to download and parse actual analysis data
        try {
          return await this.getRealAnalysisData(id, status);
        } catch (downloadError) {
          console.warn("Could not download analysis files, using status summary");
          return this.getFallbackAnalysis(status);
        }

      } catch (err) {
        console.warn("Backend unavailable — using placeholder analysis");
      }
    }
    
    // Fallback local analysis
    return this.getLocalAnalysis();
  },

  // -----------------------------
  // UPLOAD - local or backend
  // -----------------------------
  async upload(file: File, length: number | null = null): Promise<UploadResponse> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (USE_BACKEND) {
      try {
        const uploadResponse = await apiService.uploadVideo(file);
        
        return {
          success: true,
          id: uploadResponse.analysis_id,
          name: uploadResponse.filename,
          status: 'uploaded'
        };
      } catch (err) {
        console.warn("Backend upload failed. Using local fallback.");
      }
    }

    // Fallback local upload - use the local library's expected format
    await saveVideoBlob(id, file);
    Library.addVideo({
      id,
      name: file.name,
      length: length ?? 0,
      tag: null,
      // Note: local library might not have 'analysis' field
    } as any); // Use type assertion for compatibility

    return { success: true, id };
  },

  // -----------------------------
  // RENAME
  // -----------------------------
  async rename(id: string, newName: string): Promise<{ success: boolean }> {
    if (USE_BACKEND) {
      try {
        console.warn("Backend rename not implemented, using local fallback.");
      } catch (err) {
        console.warn("Backend rename unavailable, local fallback.");
      }
    }

    Library.updateVideoName(id, { name: newName });
    return { success: true };
  },

  // Update video tag in local fallback or backend
  async updateTag(id: string, newTag: string | null): Promise<{ success: boolean }> {
    if (USE_BACKEND) {
      try {
        console.warn("Backend tag update not implemented, using local fallback.");
      } catch (err) {
        console.warn("Backend tag update unavailable, local fallback.");
      }
    }

    Library.updateVideoTag(id, { tag: newTag });
    return { success: true };
  },

  // -----------------------------
  // DELETE VIDEO
  // -----------------------------
  async delete(id: string): Promise<{ success: boolean }> {
    if (USE_BACKEND) {
      try {
        await apiService.deleteAnalysis(id);
        return { success: true };
      } catch (err) {
        console.warn("Backend delete unavailable, local fallback.");
      }
    }

    // local delete:
    await deleteVideoBlob(id);
    Library.deleteVideo(id);
    return { success: true };
  },

  // -----------------------------
  // LIST ALL VIDEOS
  // -----------------------------
  async list(): Promise<VideoItem[]> {
    if (USE_BACKEND) {
      try {
        const analyses = await apiService.listAnalyses(50);
        
        // Convert to your frontend's expected format
        return Object.entries(analyses.analyses || {}).map(([id, data]: [string, any]) => ({
          id: id,
          name: data.filename,
          status: data.status,
          progress: data.progress,
          length: 0,
          tag: null,
          analysis: data.status === 'completed' ? {
            yolo_detections: data.summary?.yolo_detections,
            ocr_detections: data.summary?.ocr_detections,
            audio_segments: (data.summary as any)?.audio_segments,
            audio_language: (data.summary as any)?.audio_language
          } : null
        }));
      } catch (err) {
        console.warn("Backend unavailable. Using local fallback.");
      }
    }

    // Convert local library items to our extended type
    const localVideos = Library.getAll().videos || [];
    return localVideos.map(video => ({
      ...video,
      status: 'completed', // Default status for local videos
      progress: 100, // Default progress for local videos
      analysis: null // Default analysis for local videos
    }));
  },

  // -----------------------------
  // START ANALYSIS
  // -----------------------------
  async startAnalysis(id: string, pipelineType: string = 'full'): Promise<{ success: boolean; status: string }> {
    if (USE_BACKEND) {
      try {
        await apiService.startAnalysis(id, pipelineType as any);
        return { success: true, status: 'processing' };
      } catch (err) {
        console.warn("Backend analysis start failed.");
        throw err;
      }
    }
    
    // Local mock analysis
    return { success: true, status: 'processing' };
  },

  // -----------------------------
  // HELPER METHODS
  // -----------------------------
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  parseYoloCsv(csvText: string): Array<{ name: string; count: number; firstSeen: string; confidence: number }> {
    try {
      const lines = csvText.split('\n').slice(1); // Skip header
      const objects: { [key: string]: any } = {};
      
      lines.forEach(line => {
        if (line.trim()) {
          const parts = line.split(',');
          if (parts.length >= 4) {
            const [timestamp, class_id, class_name, confidence] = parts;
            if (class_name && confidence) {
              if (!objects[class_name]) {
                objects[class_name] = {
                  name: class_name,
                  count: 0,
                  firstSeen: this.formatTime(parseFloat(timestamp)),
                  confidence: parseFloat(confidence)
                };
              }
              objects[class_name].count++;
              objects[class_name].confidence = Math.max(
                objects[class_name].confidence, 
                parseFloat(confidence)
              );
            }
          }
        }
      });
      
      return Object.values(objects);
    } catch (error) {
      console.warn('Failed to parse YOLO CSV:', error);
      return [];
    }
  },

  generateQuantityData(detectedObjects: any[]): number[] {
    const totalObjects = detectedObjects.reduce((sum: number, obj: any) => sum + obj.count, 0);
    return [0, Math.floor(totalObjects * 0.3), Math.floor(totalObjects * 0.7), totalObjects];
  },

  generateAnnotations(detectedObjects: any[]): Array<{ note: string; time: string }> {
    return detectedObjects.slice(0, 3).map(obj => ({
      note: `Detected ${obj.count} ${obj.name}(s)`,
      time: obj.firstSeen
    }));
  },

  getInProgressAnalysis(status: any): AnalysisResult {
    return {
      summary: `Analysis ${status.status} with ${status.progress}% progress`,
      transcript: [],
      detectedObjects: [],
      quantityDetection: [{ label: "Progress", data: [0, status.progress] }],
      annotations: [{ note: `Status: ${status.status}`, time: "00:00" }],
      rawCsv: `timestamp,status,progress\n${new Date().toISOString()},${status.status},${status.progress}\n`,
    };
  },

  getFallbackAnalysis(status: any): AnalysisResult {
    return {
      summary: `Analysis completed with ${status.summary?.yolo_detections || 0} objects and ${status.summary?.ocr_detections || 0} text detections`,
      transcript: (status.summary as any)?.audio_segments ? [
        { t: "00:00", speaker: "Speaker 1", text: "Audio transcription available" }
      ] : [],
      detectedObjects: [],
      quantityDetection: [{ label: "Objects Detected", data: [0, status.summary?.yolo_detections || 0] }],
      annotations: [{ note: "Analysis completed", time: "00:00" }],
      rawCsv: "timestamp,status\n00:00,completed\n",
    };
  },

  getLocalAnalysis(): AnalysisResult {
    return {
      summary: "This is a placeholder summary generated locally.",
      transcript: [
        { t: "00:00", speaker: "Speaker 1", text: "Placeholder intro text." },
        { t: "00:30", speaker: "Speaker 2", text: "More placeholder transcript." },
      ],
      detectedObjects: [
        { name: "Person", count: 5, firstSeen: "00:02", confidence: 0.98 },
        { name: "Laptop", count: 1, firstSeen: "00:20", confidence: 0.95 },
      ],
      quantityDetection: [
        { label: "People Count Over Time", data: [0,2,3,5] }
      ],
      annotations: [
        { note: "Interesting moment at 00:45", time: "00:45" }
      ],
      rawCsv: "timestamp,object,confidence\n00:00,Person,0.98\n00:05,Laptop,0.95\n00:10,Person,0.97\n",
    };
  },

  async getRealAnalysisData(id: string, status: any): Promise<AnalysisResult> {
    let yoloText = "";
    let transcript: any[] = [];

    try {
      const yoloCsvBlob = await apiService.downloadFile(id, 'yolo_csv');
      yoloText = await yoloCsvBlob.text();
    } catch (error) {
      console.warn("Could not download YOLO CSV:", error);
      yoloText = "timestamp,object,confidence\n00:00,No data,0\n";
    }

    try {
      const transcriptBlob = await apiService.downloadFile(id, 'transcript');
      const transcriptData = JSON.parse(await transcriptBlob.text());
      
      // Convert transcript to your expected format
      transcript = transcriptData.segments?.map((seg: any) => ({
        t: this.formatTime(seg.start),
        speaker: "Speaker 1",
        text: seg.text
      })) || [];
    } catch (error) {
      console.warn("Could not download transcript:", error);
      transcript = [];
    }

    // Parse YOLO CSV for detected objects
    const detectedObjects = this.parseYoloCsv(yoloText);

    return {
      summary: `Analysis completed with ${status.summary?.yolo_detections || 0} object detections and ${status.summary?.ocr_detections || 0} text detections`,
      transcript: transcript,
      detectedObjects: detectedObjects,
      quantityDetection: [
        { label: "Objects Detected Over Time", data: this.generateQuantityData(detectedObjects) }
      ],
      annotations: this.generateAnnotations(detectedObjects),
      rawCsv: yoloText,
    };
  }
};