// src/frontend/lib/config.ts

export const API_CONFIG = {
  // Direct connection to FastAPI
  BASE_URL: typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
    : '',
  
  ENDPOINTS: {
    UPLOAD: '/api/upload',
    ANALYZE: (id: string, type: string = 'full') => `/api/analyze/${id}?pipeline_type=${type}`,
    STATUS: (id: string) => `/api/status/${id}`,
    DOWNLOAD: (id: string, fileType: string) => `/api/download/${id}/${fileType}`,
    ANALYSES: (limit: number = 10) => `/api/analyses?limit=${limit}`,
    HEALTH: '/api/health',
  },
  
  FILE_TYPES: {
    video: { 
      name: 'Annotated Video', 
      extension: '.mp4', 
      icon: 'video',
      description: 'Video with visual annotations (YOLO + OCR)',
      mimeType: 'video/mp4',
      color: 'text-blue-400'
    },
    yolo_csv: { 
      name: 'Object Detections', 
      extension: '.csv', 
      icon: 'spreadsheet',
      description: 'CSV of all detected objects',
      mimeType: 'text/csv',
      color: 'text-green-400'
    },
    ocr_csv: { 
      name: 'OCR Text', 
      extension: '.csv', 
      icon: 'spreadsheet',
      description: 'CSV of all text detected in video',
      mimeType: 'text/csv',
      color: 'text-purple-400'
    },
    summary_json: { 
      name: 'Analysis Summary', 
      extension: '.json', 
      icon: 'json',
      description: 'JSON summary of analysis results',
      mimeType: 'application/json',
      color: 'text-yellow-400'
    },
    audio: { 
      name: 'Extracted Audio', 
      extension: '.wav', 
      icon: 'audio',
      description: 'WAV audio file extracted from video',
      mimeType: 'audio/wav',
      color: 'text-pink-400'
    },
    transcript: { 
      name: 'Speech Transcript', 
      extension: '.json', 
      icon: 'text',
      description: 'JSON transcript with timestamps and POS analysis',
      mimeType: 'application/json',
      color: 'text-cyan-400'
    }
  } as const,
  
  // All 6 expected file types
  EXPECTED_FILE_TYPES: ['video', 'yolo_csv', 'ocr_csv', 'summary_json', 'audio', 'transcript'] as const,
  
  // Status configuration
  STATUS_COLORS: {
    completed: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
    processing: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
    uploaded: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
    error: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  },
  
  // Polling intervals
  POLLING: {
    STATUS: 2000, // 2 seconds
    PROGRESS: 5000, // 5 seconds
    TIMEOUT: 300000, // 5 minutes
  }
} as const;

// Helper functions
export function getFileTypeConfig(fileType: string) {
  return API_CONFIG.FILE_TYPES[fileType as keyof typeof API_CONFIG.FILE_TYPES] || {
    name: fileType,
    extension: '',
    icon: 'text',
    description: 'Unknown file type',
    mimeType: 'application/octet-stream',
    color: 'text-gray-400'
  };
}

export function getDownloadUrl(analysisId: string, fileType: string): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOWNLOAD(analysisId, fileType)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Type for file icon config (no JSX here - just data)
export interface FileIconConfig {
  name: string;
  extension: string;
  icon: string;
  description: string;
  mimeType: string;
  color: string;
}

export type FileType = keyof typeof API_CONFIG.FILE_TYPES;