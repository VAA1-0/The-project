// Extended interfaces to include missing properties
export interface ExtendedUploadResponse {
  analysis_id: string;
  filename: string;
  message: string;
  status: string;
  cvatID: number;
}

export interface ExtendedAnalysisStartResponse {
  analysis_id: string;
  status: string;
  message: string;
  progress: number;
  pipeline_type: string;
}

export interface ExtendedAnalysisStatus {
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
  pipeline_type?: string;
  cvatID?: number;
}

class ApiService {
  private baseURL: string;
  private useProxy: boolean;
  private useMock: boolean;

  constructor() {
    this.useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
    this.useProxy = process.env.NEXT_PUBLIC_USE_PROXY === 'true';
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    console.log('API Service initialized:', {
      baseURL: this.baseURL,
      useProxy: this.useProxy,
      useMock: this.useMock
    });
  }

  /**
   * Upload a video file for analysis
   */
  async uploadVideo(file: File, cvatID: number): Promise<ExtendedUploadResponse> {
    if (this.useMock) {
      console.log('Using mock upload');
      return this.getMockUploadResponse(file, cvatID);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append("cvatID", String(cvatID));

    const url = this.useProxy 
      ? `/api/proxy/upload` 
      : `${this.baseURL}/api/upload`;

    console.log('Uploading to:', url, 'cvatID:', cvatID);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        // Fall back to mock on error only if we're NOT in mock mode
        if (!this.useMock) {
          return this.getMockUploadResponse(file, cvatID);
        }
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      // Fall back to mock
      return this.getMockUploadResponse(file, cvatID);
    }
  }

  /**
   * Start analysis on an uploaded video
   */
  async startAnalysis(
    analysisId: string,
    pipelineType: 'full' | 'visual_only' | 'audio_only' = 'full'
  ): Promise<ExtendedAnalysisStartResponse> {
    if (this.useMock) {
      console.log('Using mock analysis start');
      return {
        analysis_id: analysisId,
        status: 'processing',
        message: 'Analysis started (mock)',
        progress: 10,
        pipeline_type: pipelineType
      };
    }

    const url = this.useProxy
      ? `/api/proxy/analyze/${analysisId}?pipeline_type=${pipelineType}`
      : `${this.baseURL}/api/analyze/${analysisId}?pipeline_type=${pipelineType}`;

    console.log('Starting analysis:', url);

    try {
      const response = await fetch(url, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis start failed: ${response.status} - ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Analysis start error:', error);
      throw error;
    }
  }

  /**
   * Get the current status of an analysis
   */
  async getStatus(analysisId: string): Promise<ExtendedAnalysisStatus> {
    if (this.useMock) {
      console.log('Using mock status for:', analysisId);
      return this.getMockStatus(analysisId);
    }

    const url = this.useProxy
      ? `/api/proxy/status/${analysisId}`
      : `${this.baseURL}/api/status/${analysisId}`;

    console.log('Getting status:', url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Status check failed:', response.status, errorText);
        // Fall back to mock
        return this.getMockStatus(analysisId);
      }

      return response.json();
    } catch (error) {
      console.warn('Status check error, using mock:', error);
      return this.getMockStatus(analysisId);
    }
  }

  /**
   * Download a file from the analysis results
   */
  async downloadFile(analysisId: string, fileType: string): Promise<Blob> {
    if (this.useMock) {
      console.log('Using mock download');
      return new Blob(['Mock file content'], { type: 'text/plain' });
    }

    const url = this.useProxy
      ? `/api/proxy/download/${analysisId}/${fileType}`
      : `${this.baseURL}/api/download/${analysisId}/${fileType}`;

    console.log('Downloading file:', url);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Download failed: ${response.status} - ${errorText}`);
    }

    return response.blob();
  }

  /**
   * Get list of recent analyses
   */
  async listAnalyses(limit: number = 10): Promise<any> {
    if (this.useMock) {
      console.log('Using mock analyses');
      return this.getMockAnalyses(limit);
    }

    const url = this.useProxy
      ? `/api/proxy/analyses?limit=${limit}`
      : `${this.baseURL}/api/analyses?limit=${limit}`;

    console.log('Fetching analyses:', url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Failed to fetch analyses:', response.status, errorText);
        // Fall back to mock
        return this.getMockAnalyses(limit);
      }

      return response.json();
    } catch (error) {
      console.warn('List analyses error, using mock:', error);
      return this.getMockAnalyses(limit);
    }
  }

  /**
   * Delete an analysis and its files
   */
  async deleteAnalysis(analysisId: string): Promise<void> {
    if (this.useMock) {
      console.log('Using mock delete');
      return;
    }

    const url = this.useProxy
      ? `/api/proxy/analysis/${analysisId}`
      : `${this.baseURL}/api/analysis/${analysisId}`;

    console.log('Deleting analysis:', url);

    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Delete failed: ${response.status} - ${errorText}`);
    }
  }

  /**
   * Health check for API server
   */
  async healthCheck(): Promise<any> {
    if (this.useMock) {
      console.log('Using mock health check');
      return { status: 'healthy', service: 'Mock API' };
    }

    const url = this.useProxy
      ? `/api/proxy/health`
      : `${this.baseURL}/api/health`;

    console.log('Health check:', url);

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      console.warn('Health check failed:', error);
      return { status: 'unhealthy', error: String(error) };
    }
  }

  /**
   * Check if backend is connected
   */
  async isBackendConnected(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      return health.status === 'healthy';
    } catch (error) {
      console.warn('Backend not connected:', error);
      return false;
    }
  }

  // Mock data helpers
  private getMockUploadResponse(file: File, cvatID: number): ExtendedUploadResponse {
    const analysisId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      analysis_id: analysisId,
      filename: file.name,
      message: 'Video uploaded successfully (mock)',
      status: 'uploaded',
      cvatID: cvatID || 1,
    };
  }

  private getMockStatus(analysisId: string): ExtendedAnalysisStatus {
    const isCompleted = analysisId.includes('completed') || Math.random() > 0.5;
    const isProcessing = !isCompleted && Math.random() > 0.3;
    
    let status: "uploaded" | "processing" | "completed" | "error" = 'uploaded';
    let progress = 0;
    
    if (isCompleted) {
      status = 'completed';
      progress = 100;
    } else if (isProcessing) {
      status = 'processing';
      progress = Math.floor(Math.random() * 50) + 50;
    }
    
    return {
      analysis_id: analysisId,
      status,
      progress,
      filename: `${analysisId}.mp4`,
      processing_time: isCompleted ? Math.random() * 60 + 30 : undefined,
      summary: isCompleted ? {
        yolo_detections: Math.floor(Math.random() * 200) + 50,
        ocr_detections: Math.floor(Math.random() * 50) + 10,
        audio_segments: Math.floor(Math.random() * 20) + 5,
        audio_language: 'en'
      } : undefined,
      download_links: isCompleted ? {
        video: `/api/download/${analysisId}/video`,
        yolo_csv: `/api/download/${analysisId}/yolo_csv`,
        ocr_csv: `/api/download/${analysisId}/ocr_csv`,
        summary_json: `/api/download/${analysisId}/summary_json`,
        audio: `/api/download/${analysisId}/audio`,
        transcript: `/api/download/${analysisId}/transcript`
      } : undefined,
      pipeline_type: 'full',
      cvatID: 1
    };
  }

  private getMockAnalyses(limit: number): any {
    const analyses: any = {};
    
    for (let i = 1; i <= limit; i++) {
      const analysisId = `mock-${i}`;
      const isCompleted = i % 2 === 0;
      const isProcessing = i % 3 === 0;
      
      analyses[analysisId] = {
        filename: `sample-video-${i}.mp4`,
        status: isCompleted ? 'completed' : isProcessing ? 'processing' : 'uploaded',
        progress: isCompleted ? 100 : isProcessing ? Math.floor(Math.random() * 50) + 50 : 0,
        start_time: Date.now() / 1000 - (i * 3600),
        pipeline_type: i % 3 === 0 ? 'full' : i % 3 === 1 ? 'visual_only' : 'audio_only',
        cvatID: i
      };
    }
    
    return { analyses };
  }

  /**
   * Poll for status updates with progress tracking
   */
  async pollStatus(
    analysisId: string,
    onProgress: (status: ExtendedAnalysisStatus) => void,
    interval: number = 2000,
    timeout: number = 300000
  ): Promise<ExtendedAnalysisStatus> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const poll = async () => {
        try {
          const status = await this.getStatus(analysisId);
          onProgress(status);

          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'error') {
            reject(new Error(status.error || 'Analysis failed'));
          } else if (Date.now() - startTime > timeout) {
            reject(new Error('Analysis timeout'));
          } else {
            setTimeout(poll, interval);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Helper to trigger file download in browser
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Download and save a file from analysis results
   */
  async downloadAndSaveFile(
    analysisId: string,
    fileType: string,
    filename?: string
  ): Promise<void> {
    try {
      const blob = await this.downloadFile(analysisId, fileType);
      const downloadFilename = filename || `${analysisId}_${fileType}`;
      this.downloadBlob(blob, downloadFilename);
    } catch (error) {
      console.error(`Failed to download ${fileType}:`, error);
      throw error;
    }
  }

  /**
   * Batch download all available files from analysis
   */
  async downloadAllFiles(analysisId: string, status: ExtendedAnalysisStatus): Promise<void> {
    const downloadLinks = status.download_links || {};
    const downloadPromises = Object.entries(downloadLinks).map(async ([fileType, url]) => {
      try {
        const filename = `${analysisId}_${fileType}`;
        await this.downloadAndSaveFile(analysisId, fileType, filename);
        console.log(`Downloaded: ${filename}`);
      } catch (error) {
        console.error(`Failed to download ${fileType}:`, error);
      }
    });

    await Promise.allSettled(downloadPromises);
  }

  /**
   * Enhanced upload with progress tracking
   */
  async uploadVideoWithProgress(
    file: File,
    cvatID: number,
    onProgress?: (progress: number) => void
  ): Promise<ExtendedUploadResponse> {
    return new Promise((resolve, reject) => {
      if (this.useMock || this.useProxy) {
        // Use regular upload for mock or proxy mode
        this.uploadVideo(file, cvatID)
          .then(resolve)
          .catch(reject);
        return;
      }

      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cvatID', String(cvatID));

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });

      xhr.open('POST', `${this.baseURL}/api/upload`);
      xhr.send(formData);
    });
  }

  /**
   * Get supported file types for download
   */
  getSupportedFileTypes(): string[] {
    return [
      'video',
      'yolo_csv',
      'ocr_csv',
      'summary_json',
      'audio',
      'transcript'
    ];
  }

  /**
   * Get display name for file type
   */
  getFileTypeDisplayName(fileType: string): string {
    const displayNames: Record<string, string> = {
      'video': 'Annotated Video',
      'yolo_csv': 'Object Detection Results (CSV)',
      'ocr_csv': 'Text Detection Results (CSV)',
      'summary_json': 'Analysis Summary (JSON)',
      'audio': 'Extracted Audio',
      'transcript': 'Transcript (JSON)'
    };

    return displayNames[fileType] || fileType;
  }

  /**
   * Get file extension for file type
   */
  getFileExtension(fileType: string): string {
    const extensions: Record<string, string> = {
      'video': '.mp4',
      'yolo_csv': '.csv',
      'ocr_csv': '.csv',
      'summary_json': '.json',
      'audio': '.wav',
      'transcript': '.json'
    };

    return extensions[fileType] || '';
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();

// Also export the class for custom instances
export default ApiService;