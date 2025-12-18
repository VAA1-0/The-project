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
    this.useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true" || false;
    // Direct connection to FastAPI backend
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  }

  /**
   * Upload a video file for analysis
   */
  async uploadVideo(file: File, cvatID: number): Promise<any> {
    console.log("Uploading file:", file.name, "cvatID:", cvatID);

    // For development, check if backend is reachable
    const backendAvailable = await this.checkBackendAvailability();
    if (!backendAvailable && !this.useMock) {
      console.warn("Backend not available, using mock response");
      return this.getMockUploadResponse(file, cvatID);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cvatID", String(cvatID));

      // Direct call to FastAPI endpoint
      const response = await fetch(`${this.baseURL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed with status:", response.status, errorText);
        // Fall back to mock if API fails
        if (!this.useMock) {
          return this.getMockUploadResponse(file, cvatID);
        }
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Upload successful:", result);
      return result;
    } catch (error) {
      console.error("Upload error:", error);
      // Fallback to mock response
      return this.getMockUploadResponse(file, cvatID);
    }
  }

  private getMockUploadResponse(file: File, cvatID: number): any {
    const analysisId = `mock-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return {
      analysis_id: analysisId,
      filename: file.name,
      message: "Video uploaded successfully (mock)",
      status: "uploaded",
      cvatID: cvatID || 1,
    };
  }

  /**
   * Check if backend is available
   */
  private async checkBackendAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`, {
        method: "GET",
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Start analysis on an uploaded video
   */
  async startAnalysis(
    analysisId: string,
    pipelineType: "full" | "visual_only" | "audio_only" = "full"
  ): Promise<AnalysisStartResponse> {
    // Check if this is a mock ID
    if (analysisId.startsWith("mock-")) {
      return {
        analysis_id: analysisId,
        status: "processing",
        message: "Analysis started (mock)",
        progress: 10,
        pipeline_type: pipelineType,
      };
    }

    try {
      const response = await fetch(
        `${this.baseURL}/api/analyze/${analysisId}?pipeline_type=${pipelineType}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Analysis start failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return response.json();
    } catch (error) {
      console.error("Start analysis error:", error);
      throw error;
    }
  }

  /**
   * Get the current status of an analysis
   */
  async getStatus(analysisId: string): Promise<any> {
    console.log("Fetching status for:", analysisId);

    // If mock ID, return mock status
    if (analysisId.startsWith("mock-")) {
      return this.getMockStatus(analysisId);
    }

    try {
      const response = await fetch(`${this.baseURL}/api/status/${analysisId}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("Status check failed:", response.status, errorText);
        // For development, fall back to mock
        if (!this.useMock) {
          return this.getMockStatus(analysisId);
        }
        throw new Error(
          `Status check failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return response.json();
    } catch (error) {
      console.warn("Status check failed, using fallback:", error);
      // Fallback to mock status
      return this.getMockStatus(analysisId);
    }
  }

  // Private helper methods for fallback data
  private getMockAnalyses(limit: number): any {
    const mockData: any = {
      analyses: {},
    };

    for (let i = 1; i <= limit; i++) {
      mockData.analyses[`mock-${i}`] = {
        filename: `sample-video-${i}.mp4`,
        status: i % 2 === 0 ? "completed" : "processing",
        progress: i % 2 === 0 ? 100 : Math.floor(Math.random() * 50) + 50,
        start_time: Date.now() / 1000 - i * 3600,
        pipeline_type:
          i % 3 === 0 ? "full" : i % 3 === 1 ? "visual_only" : "audio_only",
        cvatID: i,
      };
    }

    return mockData;
  }

  private getMockStatus(analysisId: string): any {
    // Generate deterministic status based on ID
    const hash = analysisId
      .split("-")
      .reduce((acc, part) => acc + part.charCodeAt(0), 0);
    const isCompleted = hash % 3 === 0;
    const isProcessing = hash % 3 === 1;
    const hasError = hash % 10 === 0; // 10% chance of error

    let status = "uploaded";
    let progress = 0;

    if (hasError) {
      status = "error";
      progress = 0;
    } else if (isCompleted) {
      status = "completed";
      progress = 100;
    } else if (isProcessing) {
      status = "processing";
      progress = Math.floor(Math.random() * 50) + 50;
    }

    // Mock all 6 download links for completed analyses
    const downloadLinks =
      status === "completed"
        ? {
            video: `${this.baseURL}/api/download/${analysisId}/video`,
            yolo_csv: `${this.baseURL}/api/download/${analysisId}/yolo_csv`,
            ocr_csv: `${this.baseURL}/api/download/${analysisId}/ocr_csv`,
            summary_json: `${this.baseURL}/api/download/${analysisId}/summary_json`,
            audio: `${this.baseURL}/api/download/${analysisId}/audio`,
            transcript: `${this.baseURL}/api/download/${analysisId}/transcript`,
            // Edit By Runzhou: add pos_analysis link
            pos_analysis: `${this.baseURL}/api/download/${analysisId}/pos_analysis`,
          }
        : undefined;

    return {
      analysis_id: analysisId,
      status: status,
      progress: progress,
      filename: analysisId.includes("mock")
        ? `video-${Date.now()}.mp4`
        : "uploaded-video.mp4",
      processing_time:
        status === "completed" ? Math.floor(Math.random() * 30) + 15 : null,
      summary:
        status === "completed"
          ? {
              yolo_detections: Math.floor(Math.random() * 200) + 50,
              ocr_detections: Math.floor(Math.random() * 50) + 10,
              audio_segments: Math.floor(Math.random() * 20) + 5,
              audio_language: "en",
            }
          : undefined,
      download_links: downloadLinks,
      pipeline_type: "full",
      cvatID: 1,
    };
  }

  /**
   * Download a file from the analysis results
   */
  async downloadFile(analysisId: string, fileType: string): Promise<Blob> {
    // For mock IDs, create a mock blob
    if (analysisId.startsWith("mock-")) {
      const mockContent = `Mock ${fileType} content for ${analysisId}`;
      return new Blob([mockContent], { type: this.getMimeType(fileType) });
    }

    const response = await fetch(
      `${this.baseURL}/api/download/${analysisId}/${fileType}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Download failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.blob();
  }

  private getMimeType(fileType: string): string {
    const mimeTypes: Record<string, string> = {
      video: "video/mp4",
      yolo_csv: "text/csv",
      ocr_csv: "text/csv",
      summary_json: "application/json",
      audio: "audio/wav",
      transcript: "application/json",
      // Edit By Runzhou: add pos_analysis mime type
      pos_analysis: "application/json",
    };
    return mimeTypes[fileType] || "application/octet-stream";
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

          if (status.status === "completed") {
            resolve(status);
          } else if (status.status === "error") {
            reject(new Error(status.error || "Analysis failed"));
          } else if (Date.now() - startTime > timeout) {
            reject(new Error("Analysis timeout"));
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
    const a = document.createElement("a");
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
      const downloadFilename =
        filename ||
        `${analysisId}_${fileType}${this.getFileExtension(fileType)}`;
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
    console.log("Fetching analyses with limit:", limit);

    try {
      const response = await fetch(
        `${this.baseURL}/api/analyses?limit=${limit}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("Failed to fetch analyses:", response.status, errorText);
        // For development, fall back to mock
        if (!this.useMock) {
          return this.getMockAnalyses(limit);
        }
        throw new Error(
          `Failed to list analyses: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Got analyses:", Object.keys(result.analyses || {}).length);
      return result;
    } catch (error) {
      console.warn("List analyses failed, using fallback:", error);
      // Fallback to mock data
      return this.getMockAnalyses(limit);
    }
  }

  /**
   * Delete an analysis and its files
   */
  async deleteAnalysis(analysisId: string): Promise<void> {
    // Skip for mock IDs
    if (analysisId.startsWith("mock-")) {
      console.log("Mock delete for:", analysisId);
      return;
    }

    const response = await fetch(`${this.baseURL}/api/analysis/${analysisId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Delete failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
  }

  /**
   * Health check for API server
   */
  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);

      if (!response.ok) {
        throw new Error(
          `Health check failed: ${response.status} ${response.statusText}`
        );
      }

      return response.json();
    } catch (error) {
      console.warn("Health check failed:", error);
      return { status: "unhealthy", error: String(error) };
    }
  }

  /**
   * Get API info
   */
  async getApiInfo(): Promise<any> {
    const response = await fetch(this.baseURL);

    if (!response.ok) {
      throw new Error(
        `API info failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Get supported file types for download
   */
  getSupportedFileTypes(): string[] {
    return [
      "video",
      "yolo_csv",
      "ocr_csv",
      "summary_json",
      "audio",
      "transcript",
      // Edit By Runzhou: add pos_analysis file type
      "pos_analysis",
    ];
  }

  /**
   * Get display name for file type
   */
  getFileTypeDisplayName(fileType: string): string {
    const displayNames: Record<string, string> = {
      video: "Annotated Video",
      yolo_csv: "Object Detection Results (CSV)",
      ocr_csv: "Text Detection Results (CSV)",
      summary_json: "Analysis Summary (JSON)",
      audio: "Extracted Audio",
      transcript: "Transcript (JSON)",
      // Edit By Runzhou: add pos_analysis display name
      pos_analysis: "Position Analysis (JSON)",
    };

    return displayNames[fileType] || fileType;
  }

  /**
   * Get file extension for file type
   */
  getFileExtension(fileType: string): string {
    const extensions: Record<string, string> = {
      video: ".mp4",
      yolo_csv: ".csv",
      ocr_csv: ".csv",
      summary_json: ".json",
      audio: ".wav",
      transcript: ".json",
      // Edit By Runzhou: add pos_analysis file extension
      pos_analysis: ".json",
    };

    return extensions[fileType] || "";
  }

  /**
   * Batch download all available files from analysis
   */
  async downloadAllFiles(
    analysisId: string,
    status: AnalysisStatus
  ): Promise<void> {
    const downloadLinks = status.download_links || {};
    const downloadPromises = Object.entries(downloadLinks).map(
      async ([fileType, url]) => {
        try {
          const filename = `${analysisId}_${fileType}${this.getFileExtension(
            fileType
          )}`;
          await this.downloadAndSaveFile(analysisId, fileType, filename);
          console.log(`Downloaded: ${filename}`);
        } catch (error) {
          console.error(`Failed to download ${fileType}:`, error);
        }
      }
    );

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
      formData.append("file", file);
      formData.append("cvatID", String(cvatID));

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed due to network error"));
      });

      xhr.open("POST", `${this.baseURL}/api/upload`);
      xhr.send(formData);
    });
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();

// Also export the class for custom instances
export default ApiService;
