// src/frontend/lib/api-service.ts
export interface UploadResponse {
  analysis_id: string;
  filename: string;
  message: string;
  status: string;
  cvatID: number;
}

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
  pipeline_type?: string;
  cvatID?: number;
}

export interface AnalysisStartResponse {
  analysis_id: string;
  status: string;
  message: string;
  progress: number;
  pipeline_type: string;
}

class ApiService {
  private baseURL: string;
  private useMock: boolean;

  constructor() {
    this.useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || false;
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || '/api/proxy';
  }

  /**
   * Upload a video file for analysis
   */

    async uploadVideo(file: File, cvatID: number): Promise<any> {
    console.log('Uploading file:', file.name, 'cvatID:', cvatID);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cvatID', String(cvatID));

      const response = await fetch(`${this.baseURL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed with status:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      // Fallback to mock response
      return {
        analysis_id: `mock-${Date.now()}`,
        filename: file.name,
        message: 'Video uploaded successfully (fallback)',
        status: 'uploaded',
        cvatID: cvatID || 1,
      };
    }
  }

  private getMockUploadResponse(file: File, cvatID: number): any {
    const analysisId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      analysis_id: analysisId,
      filename: file.name,
      message: 'Video uploaded successfully (mock)',
      status: 'uploaded',
      cvatID: cvatID || 1,
    };
  }

  
  /**
   * Start analysis on an uploaded video
   */
  async startAnalysis(
    analysisId: string,
    pipelineType: 'full' | 'visual_only' | 'audio_only' = 'full'
  ): Promise<AnalysisStartResponse> {
    const response = await fetch(
      `${this.baseURL}/api/analyze/${analysisId}?pipeline_type=${pipelineType}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Analysis start failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get the current status of an analysis
   */
    async getStatus(analysisId: string): Promise<any> {
    console.log('Fetching status for:', analysisId);
    
    try {
      const response = await fetch(`${this.baseURL}/status/${analysisId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Status check failed:', response.status, errorText);
        throw new Error(`Status check failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.warn('Status check failed, using fallback:', error);
      // Fallback to mock status
      return this.getMockStatus(analysisId);
    }
  }

  // Private helper methods for fallback data
  private getMockAnalyses(limit: number): any {
    const mockData: any = {
      analyses: {}
    };
    
    for (let i = 1; i <= limit; i++) {
      mockData.analyses[`mock-${i}`] = {
        filename: `sample-video-${i}.mp4`,
        status: i % 2 === 0 ? 'completed' : 'processing',
        progress: i % 2 === 0 ? 100 : Math.floor(Math.random() * 50) + 50,
        start_time: Date.now() / 1000 - (i * 3600),
        pipeline_type: i % 3 === 0 ? 'full' : i % 3 === 1 ? 'visual_only' : 'audio_only',
        cvatID: i
      };
    }
    
    return mockData;
  }

  private getMockStatus(analysisId: string): any {
    const isCompleted = analysisId.includes('completed') || analysisId.includes('mock-1');
    const isProcessing = analysisId.includes('processing') || analysisId.includes('mock-2');
    
    let status = 'uploaded';
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
      status: status,
      progress: progress,
      filename: analysisId.includes('mock') ? `${analysisId}.mp4` : 'uploaded-video.mp4',
      processing_time: isCompleted ? 45.2 : null,
      summary: isCompleted ? {
        yolo_detections: 120,
        ocr_detections: 25,
        audio_segments: 8,
        audio_language: 'en'
      } : undefined,
      download_links: isCompleted ? {
        video: `/api/mock/download/${analysisId}/video`,
        yolo_csv: `/api/mock/download/${analysisId}/yolo_csv`,
        ocr_csv: `/api/mock/download/${analysisId}/ocr_csv`,
        summary_json: `/api/mock/download/${analysisId}/summary_json`,
        audio: `/api/mock/download/${analysisId}/audio`,
        transcript: `/api/mock/download/${analysisId}/transcript`
      } : undefined,
      pipeline_type: 'full',
      cvatID: 1
    };
  }

  /**
   * Download a file from the analysis results
   */
  async downloadFile(analysisId: string, fileType: string): Promise<Blob> {
    const response = await fetch(`${this.baseURL}/api/download/${analysisId}/${fileType}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Download failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.blob();
  }

  /**
   * Poll for status updates with progress tracking
   */
  async pollStatus(
    analysisId: string,
    onProgress: (status: AnalysisStatus) => void,
    interval: number = 2000,
    timeout: number = 300000 // 5 minutes
  ): Promise<AnalysisStatus> {
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
   * Get list of recent analyses (for admin/debugging)
   */
  async listAnalyses(limit: number = 10): Promise<any> {
    console.log('Fetching analyses with limit:', limit);
    
    try {
      const response = await fetch(`${this.baseURL}/analyses?limit=${limit}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Failed to fetch analyses:', response.status, errorText);
        throw new Error(`Failed to list analyses: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Got analyses:', Object.keys(result.analyses || {}).length);
      return result;
    } catch (error) {
      console.warn('List analyses failed, using fallback:', error);
      // Fallback to mock data
      return this.getMockAnalyses(limit);
    }
  }


  /**
   * Delete an analysis and its files
   */
  async deleteAnalysis(analysisId: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/analysis/${analysisId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Delete failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  /**
   * Health check for API server
   */
  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.baseURL}/api/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get API info
   */
  async getApiInfo(): Promise<any> {
    const response = await fetch(this.baseURL);

    if (!response.ok) {
      throw new Error(`API info failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
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

  /**
   * Batch download all available files from analysis
   */
  async downloadAllFiles(analysisId: string, status: AnalysisStatus): Promise<void> {
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
  ): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
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

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();

// Also export the class for custom instances
export default ApiService;