// Types for the Video Analysis API
export interface UploadResponse {
  analysis_id: string;
  filename: string;
  message: string;
  status: string;
}

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
  download_links?: {
    video?: string;
    yolo_csv?: string;
    ocr_csv?: string;
    summary_json?: string;
    audio?: string;
    transcript?: string;
  };
}

export interface AnalysisStartResponse {
  analysis_id: string;
  status: string;
  message: string;
  progress: number;
}

// API client class
export class VideoAnalysisAPI {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:8000') {
    this.baseURL = baseURL;
  }

  async uploadVideo(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseURL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async startAnalysis(analysisId: string): Promise<AnalysisStartResponse> {
    const response = await fetch(`${this.baseURL}/api/analyze/${analysisId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Analysis start failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getStatus(analysisId: string): Promise<AnalysisStatus> {
    const response = await fetch(`${this.baseURL}/api/status/${analysisId}`);

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    return response.json();
  }

  async downloadFile(analysisId: string, fileType: string): Promise<Blob> {
    const response = await fetch(`${this.baseURL}/api/download/${analysisId}/${fileType}`);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // Helper to trigger file download in browser
  downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
