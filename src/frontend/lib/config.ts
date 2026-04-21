// src/frontend/lib/config.ts

export const API_CONFIG = {
  // Direct connection to FastAPI
  BASE_URL:
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "",

  ENDPOINTS: {
    UPLOAD: "/api/upload",
    ANALYZE: (id: string, type: string = "full") =>
      `/api/analyze/${id}?pipeline_type=${type}`,
    STATUS: (id: string) => `/api/status/${id}`,
    DOWNLOAD: (id: string, fileType: string) =>
      `/api/download/${id}/${fileType}`,
    ANALYSES: (limit: number = 10) => `/api/analyses?limit=${limit}`,
    HEALTH: "/api/health",
  },

  FILE_TYPES: {
    video: {
      name: "Annotated Video",
      extension: ".mp4",
      icon: "video",
      description: "Video with visual annotations (YOLO + OCR)",
      mimeType: "video/mp4",
      color: "text-blue-400",
    },
    yolo_csv: {
      name: "Object Detections",
      extension: ".csv",
      icon: "spreadsheet",
      description: "CSV of all detected objects",
      mimeType: "text/csv",
      color: "text-green-400",
    },
    tracked_objects_csv: {
      name: "Tracked Objects CSV",
      extension: ".csv",
      icon: "spreadsheet",
      description: "CSV of backend-grouped object tracks for calmer review and comparison",
      mimeType: "text/csv",
      color: "text-emerald-400",
    },
    tracked_objects_json: {
      name: "Tracked Objects",
      extension: ".json",
      icon: "json",
      description: "JSON of backend-grouped object tracks for review, correction, and Time Bank linking",
      mimeType: "application/json",
      color: "text-emerald-400",
    },
    ocr_csv: {
      name: "OCR Text",
      extension: ".csv",
      icon: "spreadsheet",
      description: "CSV of all text detected in video",
      mimeType: "text/csv",
      color: "text-purple-400",
    },
    summary_json: {
      name: "Analysis Summary",
      extension: ".json",
      icon: "json",
      description: "JSON summary of analysis results",
      mimeType: "application/json",
      color: "text-yellow-400",
    },
    audio: {
      name: "Extracted Audio",
      extension: ".wav",
      icon: "audio",
      description: "WAV audio file extracted from video",
      mimeType: "audio/wav",
      color: "text-pink-400",
    },
    transcript: {
      name: "Speech Transcript",
      extension: ".json",
      icon: "text",
      description: "JSON transcript with timestamps from the audio branch",
      mimeType: "application/json",
      color: "text-cyan-400",
    },
    linked_transcript: {
      name: "Time Bank Transcript",
      extension: ".json",
      icon: "json",
      description: "Time Bank transcript evidence with anchors, media references, and provenance",
      mimeType: "application/json",
      color: "text-cyan-400",
    },
    audio_prosody: {
      name: "Audio Prosody",
      extension: ".json",
      icon: "json",
      description: "JSON of pace, pauses, emphasis, and pitch-energy contour cues derived from the audio branch",
      mimeType: "application/json",
      color: "text-amber-400",
    },
    audio_diarization: {
      name: "Audio Diarization Scaffold",
      extension: ".json",
      icon: "json",
      description: "Speaker-turn and embedding contract for pyannote.audio, diart, and SpeechBrain readiness",
      mimeType: "application/json",
      color: "text-emerald-400",
    },
    time_bank_audio: {
      name: "Time Bank Audio",
      extension: ".json",
      icon: "json",
      description: "Time Bank audio evidence with anchors, prosody, turn structure, and sound-environment cues",
      mimeType: "application/json",
      color: "text-amber-400",
    },
    time_bank_ocr: {
      name: "Time Bank OCR",
      extension: ".json",
      icon: "json",
      description: "Time Bank OCR evidence with anchors, regions, and provenance",
      mimeType: "application/json",
      color: "text-purple-400",
    },
    time_bank_objects: {
      name: "Time Bank Objects",
      extension: ".json",
      icon: "json",
      description: "Time Bank object evidence with anchors, regions, and provenance",
      mimeType: "application/json",
      color: "text-green-400",
    },
    time_bank_expressions: {
      name: "Time Bank Expressions",
      extension: ".json",
      icon: "json",
      description: "Time Bank expression evidence with anchors, regions, and provenance",
      mimeType: "application/json",
      color: "text-rose-400",
    },
    pos_analysis: {
      name: "POS Analysis",
      extension: ".json",
      icon: "text",
      description: "JSON part-of-speech analysis of the transcript",
      mimeType: "application/json",
      color: "text-indigo-400",
    },
    quan_analysis: {
      name: "Quantitative Analysis",
      extension: ".json",
      icon: "text",
      description: "JSON quantitative analysis derived from the transcript",
      mimeType: "application/json",
      color: "text-indigo-400",
    },
    source_media_metadata_json: {
      name: "Source Media Metadata",
      extension: ".json",
      icon: "json",
      description: "JSON metadata record for the original source media file",
      mimeType: "application/json",
      color: "text-emerald-400",
    },
    source_media_metadata_csv: {
      name: "Source Media Metadata CSV",
      extension: ".csv",
      icon: "spreadsheet",
      description: "CSV metadata record for the original source media file",
      mimeType: "text/csv",
      color: "text-emerald-400",
    },
    annotation_corrections: {
      name: "Annotation Corrections",
      extension: ".json",
      icon: "json",
      description: "JSON ledger of analyst corrections, preserving raw and corrected values",
      mimeType: "application/json",
      color: "text-amber-400",
    },
    pos_matrix: {
      name: "POS Matrix",
      extension: ".json",
      icon: "json",
      description: "JSON snapshot of the current POS matrix comparison workspace",
      mimeType: "application/json",
      color: "text-sky-400",
    },
    quant_matrix: {
      name: "Quant Matrix",
      extension: ".json",
      icon: "json",
      description: "JSON snapshot of the current Quant matrix comparison workspace",
      mimeType: "application/json",
      color: "text-sky-400",
    },
    expression_json: {
      name: "Expression Analysis",
      extension: ".json",
      icon: "json",
      description: "JSON emotion and expression samples detected from faces",
      mimeType: "application/json",
      color: "text-rose-400",
    },
    face_anonymization_manifest: {
      name: "Face Anonymization Manifest",
      extension: ".json",
      icon: "json",
      description: "JSON manifest for anonymized sampled face frames when anonymization is engaged",
      mimeType: "application/json",
      color: "text-orange-400",
    },
  } as const,

  // Expected downloadable file types, including optional outputs
  EXPECTED_FILE_TYPES: [
    "video",
    "yolo_csv",
    "tracked_objects_csv",
    "tracked_objects_json",
    "ocr_csv",
    "summary_json",
    "audio",
    "transcript",
    "linked_transcript",
    "audio_prosody",
    "audio_diarization",
    "time_bank_audio",
    "time_bank_ocr",
    "time_bank_objects",
    "time_bank_expressions",
    "pos_analysis",
    "quan_analysis",
    "source_media_metadata_json",
    "source_media_metadata_csv",
    "annotation_corrections",
    "pos_matrix",
    "quant_matrix",
    "expression_json",
    "face_anonymization_manifest",
  ] as const,

  // Status configuration
  STATUS_COLORS: {
    completed: {
      bg: "bg-green-500/20",
      text: "text-green-300",
      border: "border-green-500/30",
    },
    processing: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-300",
      border: "border-yellow-500/30",
    },
    uploaded: {
      bg: "bg-blue-500/20",
      text: "text-blue-300",
      border: "border-blue-500/30",
    },
    error: {
      bg: "bg-red-500/20",
      text: "text-red-300",
      border: "border-red-500/30",
    },
  },

  // Polling intervals
  POLLING: {
    STATUS: 2000, // 2 seconds
    PROGRESS: 5000, // 5 seconds
    TIMEOUT: 300000, // 5 minutes
  },
} as const;

// Helper functions
export function getFileTypeConfig(fileType: string) {
  return (
    API_CONFIG.FILE_TYPES[fileType as keyof typeof API_CONFIG.FILE_TYPES] || {
      name: fileType,
      extension: "",
      icon: "text",
      description: "Unknown file type",
      mimeType: "application/octet-stream",
      color: "text-gray-400",
    }
  );
}

export function getDownloadUrl(analysisId: string, fileType: string): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOWNLOAD(
    analysisId,
    fileType
  )}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
