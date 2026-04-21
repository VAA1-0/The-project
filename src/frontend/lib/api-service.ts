// src/frontend/lib/api-service.ts

/**
 * API Service
 *
 * This service is the low-level communication layer responsible for all direct
 * HTTP requests to the backend FastAPI server.
 *
 * Its responsibilities include:
 * - Defining the shapes of API requests and responses.
 * - Handling fetch calls, headers, and the base URL.
 * - Managing mock responses for development when the backend is unavailable.
 *
 * This service should NOT contain any application-specific business logic or data
 * transformation. It simply delivers raw data to and from the backend. For
 * application logic, see `video-service.ts`.
 */

import { buildAnalysisSearchParams } from "./analysis-request";

export interface UploadResponse {
  analysis_id: string;
  filename: string;
  message: string;
  status: string;
  cvatID: number;
  bundle_type?: "analysis" | "project";
  imported_analysis_ids?: string[];
  imported_count?: number;
  project_name?: string;
}

export interface AnalysisStatus {
  analysis_id: string;
  status: "uploaded" | "processing" | "completed" | "error";
  progress: number;
  event_log?: AnalysisEvent[];
  mission_stage?: string;
  mission_message?: string;
  filename: string;
  error?: string;
  processing_time?: number;
  apply_face_anonymization?: boolean;
  face_message_style?: "plain" | "starfleet";
  face_requires_person_detection?: boolean;
  uploaded_at?: string;
  analysis_started_at?: string;
  analysis_completed_at?: string;
  source_video_path?: string;
  source_video_exists?: boolean;
  source_video_message?: string;
  source_media_metadata?: SourceMediaMetadata;
  summary?: {
    yolo_detections: number;
    ocr_detections: number;
    expression_samples?: number;
    expression_status?: "completed" | "failed" | "not_run";
    expression_error?: string;
    motion_evidence?: {
      method?: string;
      samples?: Array<{
        timestamp: number;
        motion_label?: string;
        activity_label?: string;
        occupancy_shift?: number;
        foreground_delta?: number;
        background_delta?: number;
        zone_tone_shift?: number;
        frame_class?: string;
      }>;
      summary?: {
        sample_count?: number;
        dominant_motion?: string | null;
        distribution?: Record<string, number>;
        activity_distribution?: Record<string, number>;
        high_motion_samples?: number;
        mean_occupancy_shift?: number;
      };
    };
    scene_segments?: {
      method?: string;
      source?: string;
      segments?: Array<{
        scene_index: number;
        start: number;
        end: number;
        duration?: number;
      }>;
      summary?: {
        scene_count?: number;
        mean_scene_duration?: number;
      };
    };
    audio_segments?: number;
    audio_prosody_cues?: number;
    audio_language?: string;
    audio_language_name?: string;
    audio_language_source?: string;
    audio_language_confidence?: number;
    audio_error?: string;
    audio_prosody_error?: string;
    audio_diarization_error?: string;
    pos_error?: string;
    quan_error?: string;
    language_support?: {
      quant?: string;
      pos?: string;
      future_discourse?: string;
      nltk_stopwords?: boolean;
      spacy_model?: string | null;
      spacy_model_available?: boolean;
      registry_language_name?: string;
      registry_target_support?: {
        quant?: string;
        pos?: string;
        future_discourse?: string;
      };
      regional_varieties?: string[];
      notes?: string[];
    };
    language_profile?: {
      code?: string;
      name?: string;
      iso6393?: string | null;
      source?: string;
      confidence?: number;
      hint?: string | null;
      text_guess?: {
        code?: string | null;
        name?: string;
        confidence?: number;
        method?: string;
        token_count?: number;
      };
      support?: {
        quant?: string;
        pos?: string;
        future_discourse?: string;
        nltk_stopwords?: boolean;
        spacy_model?: string | null;
        spacy_model_available?: boolean;
        registry_language_name?: string;
        registry_target_support?: {
          quant?: string;
          pos?: string;
          future_discourse?: string;
        };
        regional_varieties?: string[];
        notes?: string[];
      };
    };
    language_pack_policy?: {
      primary_language?: {
        code?: string;
        name?: string;
        fixed?: boolean;
      };
      policy?: string;
      policy_label?: string;
      slot_limit?: number;
      selected_languages?: Array<{ code?: string; name?: string }>;
      special_use_language?: { code?: string; name?: string } | null;
      allow_rough_interpretation?: boolean;
      rough_interpretation_label?: string;
      commercial_extension_required?: boolean;
      notes?: string[];
    };
    face_frames_considered?: number;
    face_frames_selected?: number;
    face_frames_skipped_no_person?: number;
  };
  face_results?: {
    frames?: Array<{
      frame_index?: number;
      source_timestamp?: number;
      faces?: Array<{
        age?: number | null;
        dominant_gender?: string | null;
        face_confidence?: number | null;
        warnings?: Array<{ code?: string; technical_note?: string; user_message?: string }>;
      }>;
      warnings?: Array<{ code?: string; technical_note?: string; user_message?: string }>;
    }>;
  } | null;
  annotation_corrections?: AnnotationCorrections | null;
  cvat_ingest?: {
    status?: string;
    job_id?: number;
    mapped_at?: string;
    object_annotation_count?: number;
    track_annotation_count?: number;
  } | null;
  internal_artifacts?: Record<string, string> | null;
  forensic_render_jobs?: ForensicRenderJob[];
  source_samples?: SourceSample[];
  identity_refinement?: IdentityRefinementStatus | null;
  audio_diarization?: AudioDiarizationScaffold | null;
  download_links?: Record<string, string>;
  pipeline_type?: string;
  analysis_tier?: string;
  modality_focus?: string;
  language_pack_policy?: {
    primary_language?: {
      code?: string;
      name?: string;
      fixed?: boolean;
    };
    policy?: string;
    policy_label?: string;
    slot_limit?: number;
    selected_languages?: Array<{ code?: string; name?: string }>;
    special_use_language?: { code?: string; name?: string } | null;
    allow_rough_interpretation?: boolean;
    rough_interpretation_label?: string;
    commercial_extension_required?: boolean;
    notes?: string[];
  };
  cvatID?: number;
}

export interface ForensicRenderRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ForensicRenderRegionKeyframe {
  time: number;
  region: ForensicRenderRegion;
  intent?: string;
  note?: string;
}

export interface IdentityCandidate {
  candidate_id: string;
  candidate_label?: string;
  review_state?: "unreviewed" | "promoted" | string;
  identity_status?: "candidate" | "confirmed" | string;
  confidence?: number | null;
  source?: string;
  promoted_identity?: string;
  evidence?: {
    annotation_type?: "track" | "object" | string;
    annotation_id?: string | number | null;
    track_id?: string | number | null;
    label?: string;
    time_start?: number;
    time_end?: number;
    frame?: number;
    bbox?: Record<string, unknown> | null;
  };
  future_modalities?: Record<string, string>;
}

export interface IdentityCandidateLedger {
  analysis_id?: string;
  status?: string;
  source_master_schema?: string;
  candidate_count?: number;
  promoted_count?: number;
  output_json_path?: string;
  candidates?: IdentityCandidate[];
  audio_stack_plan?: Record<string, string>;
}

export interface IdentityRefinementStatus {
  status?: string;
  candidate_count?: number;
  output_json_path?: string;
  master_json_path?: string;
  updated_at?: string;
  last_promoted_candidate_id?: string;
  last_promoted_at?: string;
}

export interface AudioDiarizationScaffold {
  analysis_id?: string;
  status?: string;
  audio_path?: string;
  stack_plan?: Record<string, any>;
  turn_count?: number;
  speaker_turns?: Array<{
    turn_id?: string;
    speaker_label?: string;
    start?: number;
    end?: number;
    text?: string;
    diarization_status?: string;
    embedding_ref?: string | null;
    reference_match?: string | null;
  }>;
  reference_speakers?: unknown[];
  embedding_index?: Record<string, any>;
  vad_segments?: unknown[];
  prosody_cue_count?: number;
  notes?: string[];
}

export interface ForensicRenderRequest {
  mode: "science_grade" | "forensic_accuracy";
  time_start: number;
  time_end: number;
  region?: ForensicRenderRegion | null;
  region_intent?: string;
  region_track?: ForensicRenderRegionKeyframe[];
  requested_fps?: number;
  max_duration_seconds?: number;
  reason?: string;
  requested_by?: string;
  input_evidence_ids?: string[];
}

export interface ForensicRenderJob {
  render_job_id: string;
  analysis_id: string;
  source_video_path?: string;
  requested_by?: string;
  requested_at?: string;
  reason?: string;
  mode: "science_grade" | "forensic_accuracy";
  source_fps?: number;
  target_fps?: number;
  frame_stride?: number;
  time_start: number;
  time_end: number;
  frame_start?: number;
  frame_end?: number;
  region_type?: "full_frame" | "static_box" | "tracked_box";
  region?: ForensicRenderRegion | null;
  region_intent?: string;
  region_track?: ForensicRenderRegionKeyframe[];
  adopted_context?: Record<string, unknown>;
  input_evidence_ids?: string[];
  output_video_path?: string;
  output_frame_dir?: string;
  output_json_path?: string;
  saved_frame_paths?: string[];
  rendered_frames?: number;
  status?: "completed" | "error";
  created_at?: string;
}

export interface SourceSampleRequest {
  sample_type: "visual" | "audio" | "visual_audio";
  time_start: number;
  time_end: number;
  region?: ForensicRenderRegion | null;
  label?: string;
  purpose?: string;
  requested_by?: string;
}

export interface SourceSample {
  sample_id: string;
  analysis_id: string;
  sample_type: "visual" | "audio" | "visual_audio";
  requested_by?: string;
  requested_at?: string;
  label?: string;
  purpose?: string;
  time_start: number;
  time_end: number;
  visual?: {
    output_image_path?: string;
    frame_index?: number;
    source_fps?: number;
    region?: ForensicRenderRegion | null;
  } | null;
  audio?: {
    output_audio_path?: string;
    audio_start_frame?: number;
    audio_end_frame?: number;
    sample_rate?: number;
  } | null;
  status?: "completed" | "error";
  created_at?: string;
}

export interface AnalysisEvent {
  timestamp: string;
  event_type: string;
  progress?: number;
  mission_stage?: string;
  mission_message?: string;
  details?: Record<string, unknown>;
}

export interface AnalysisStartResponse {
  analysis_id: string;
  status: string;
  message: string;
  progress: number;
  pipeline_type: string;
}

export interface AnalysisStartOptions {
  analysisTier?: "quick_sweep" | "science_scan" | "forensic_sensor";
  modalityFocus?: "multimodal" | "graphics" | "audio" | "images" | "text";
  morphologyPackPolicy?: "core_only" | "plus_1" | "plus_2";
  morphologyLanguages?: string[];
  specialUseMorphologyLanguage?: string;
  allowRoughInterpretation?: boolean;
  applyFaceAnonymization?: boolean;
  faceMessageStyle?: "plain" | "starfleet";
  faceRequiresPersonDetection?: boolean;
}

export interface WorkspaceInfo {
  results_dir: string;
  imported_work_dir: string;
  downloads_note: string;
}

export interface SourceMediaMetadata {
  analysis_id?: string;
  original_filename?: string;
  stored_filename?: string;
  source_video_path?: string;
  source_video_exists?: boolean;
  mime_type?: string | null;
  format_name?: string | null;
  container_extension?: string | null;
  duration_seconds?: number | null;
  size_bytes?: number | null;
  video_codec?: string | null;
  audio_codec?: string | null;
  has_audio?: boolean;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  video_bitrate?: number | null;
  audio_bitrate?: number | null;
  audio_channels?: number | null;
  audio_sample_rate?: number | string | null;
  uploaded_at?: string;
  analysis_started_at?: string;
  analysis_completed_at?: string;
  pipeline_type?: string;
  cvatID?: number;
  filesystem_modified_at?: string;
  user_annotations?: {
    editor_notes?: string;
    source_context?: string;
    provenance_notes?: string;
    title?: string;
    scope?: string;
    description?: string;
    persons?: string[];
    relations?: string;
    location_country?: string;
    location_city?: string;
    location_place?: string;
    location_room?: string;
    time_era?: string;
    time_year?: string;
    time_moment?: string;
    situation_event?: string;
    keywords?: string[];
    interaction_dynamics?: string;
    narrative_development?: string;
    performance_expression?: string;
    genre?: string;
    genre_subtype?: string;
    situational_genre?: string;
    situational_subtype?: string;
    privacy_axis?: string;
    expertise_axis?: string;
    references?: string[];
    reference_files?: Array<{
      filename?: string;
      stored_filename?: string;
      media_type?: string;
      size_bytes?: number;
      download_url?: string;
    }>;
    reference_speakers?: Array<{
      speaker_label?: string;
      identity_label?: string;
      relation?: string;
      reference_file?: string;
      notes?: string;
    }>;
    reference_relation?: string;
    reference_source?: string;
    confidence?: string;
    notes?: string;
  };
}

export interface SharedTaxonomyLabel {
  id: string;
  scope:
    | "media_genre"
    | "media_subgenre"
    | "situational_genre"
    | "situational_subgenre"
    | "privacy_axis"
    | "expertise_axis";
  label: string;
  normalized_label?: string;
  parent_value?: string;
  status?: string;
  source?: string;
  created_by?: string;
  created_at?: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export interface AnnotationCorrectionRule {
  id: string;
  modality: "text" | "object" | "ocr" | "expression" | "cinematic";
  raw_value: string;
  corrected_value: string;
  target_timestamp?: number;
  target_start_timestamp?: number;
  target_end_timestamp?: number;
  target_track_id?: number;
  note?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface ManualVisualAnnotation {
  id: string;
  category:
    | "Action"
    | "Audio"
    | "Cinematic Cues"
    | "Expressions"
    | "Genre"
    | "Identification"
    | "Interaction"
    | "Metadata"
    | "Movement"
    | "Notes"
    | "OBJ"
    | "OCR"
    | "Role"
    | "Scene"
    | "Transcription";
  subcategory?: string;
  label: string;
  custom_label?: string;
  geometry_type: "box";
  coordinates: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  timestamp_seconds: number;
  start_seconds?: number;
  end_seconds?: number;
  identity_affirmation?: string;
  role_affirmation?: string;
  audio_foley_note?: string;
  open_note?: string;
  metadata_correlation?: {
    target_type?: string;
    target_id?: string;
    target_label?: string;
    relation?: "contradicts" | "extends" | "matches" | "supports" | "unknown";
    note?: string;
  } | null;
  teaches_regime?: boolean;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface ManualTranscriptEntry {
  id: string;
  start: number;
  end: number;
  text?: string;
  status?: "confirmed" | "unconfirmed";
  note?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface AnnotationCorrections {
  analysis_id?: string;
  version?: number;
  updated_at?: string;
  updated_by?: string;
  text_substitutions?: AnnotationCorrectionRule[];
  label_overrides?: AnnotationCorrectionRule[];
  manual_transcript_entries?: ManualTranscriptEntry[];
  manual_visual_annotations?: ManualVisualAnnotation[];
}

export type WorkspacePathType = "results" | "imports";

export interface MorphologyCatalogItem {
  code: string;
  name: string;
  spacy_model?: string | null;
  has_named_pipeline?: boolean;
  installed?: boolean;
  local_status?: string;
  current_support?: {
    quant?: string;
    pos?: string;
    future_discourse?: string;
  };
  target_support?: {
    quant?: string;
    pos?: string;
    future_discourse?: string;
  };
  is_eu_official?: boolean;
  is_un_official?: boolean;
  is_recommended_extra?: boolean;
  notes?: string[];
  future_feed_repair_ready?: boolean;
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
          `Upload failed: ${response.status} ${response.statusText} - ${errorText}`,
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
    pipelineType: "full" | "visual_only" | "audio_only" = "full",
    options: AnalysisStartOptions = {},
  ): Promise<AnalysisStartResponse> {
    const {
      analysisTier = "science_scan",
      modalityFocus = "multimodal",
      morphologyPackPolicy = "core_only",
      morphologyLanguages = [],
      specialUseMorphologyLanguage = "",
      allowRoughInterpretation = true,
      applyFaceAnonymization = false,
      faceMessageStyle = "plain",
      faceRequiresPersonDetection = false,
    } = options;

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
      const searchParams = buildAnalysisSearchParams(pipelineType, {
        analysisTier,
        modalityFocus,
        morphologyPackPolicy,
        morphologyLanguages,
        specialUseMorphologyLanguage,
        allowRoughInterpretation,
        applyFaceAnonymization,
        faceMessageStyle,
        faceRequiresPersonDetection,
      });

      const response = await fetch(
        `${this.baseURL}/api/analyze/${analysisId}?${searchParams.toString()}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Analysis start failed: ${response.status} ${response.statusText} - ${errorText}`,
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
        throw new Error(
          `Status check failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      return response.json();
    } catch (error) {
      console.warn("Status check failed:", error);
      if (this.useMock) {
        return this.getMockStatus(analysisId);
      }
      throw error;
    }
  }

  async listForensicRenderJobs(analysisId: string): Promise<ForensicRenderJob[]> {
    const response = await fetch(
      `${this.baseURL}/api/forensic-render/${analysisId}/jobs`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Forensic render jobs failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const payload = await response.json();
    return payload.jobs || [];
  }

  async createForensicRenderJob(
    analysisId: string,
    request: ForensicRenderRequest,
  ): Promise<ForensicRenderJob> {
    const response = await fetch(
      `${this.baseURL}/api/forensic-render/${analysisId}/jobs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Forensic render failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const payload = await response.json();
    return payload.job;
  }

  getForensicRenderDownloadUrl(analysisId: string, renderJobId: string): string {
    return `${this.baseURL}/api/forensic-render/${analysisId}/jobs/${renderJobId}/download`;
  }

  async listSourceSamples(analysisId: string): Promise<SourceSample[]> {
    const response = await fetch(`${this.baseURL}/api/source-samples/${analysisId}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Source samples failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const payload = await response.json();
    return payload.samples || [];
  }

  async createSourceSample(
    analysisId: string,
    request: SourceSampleRequest,
  ): Promise<SourceSample> {
    const response = await fetch(`${this.baseURL}/api/source-samples/${analysisId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Source sample failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const payload = await response.json();
    return payload.sample;
  }

  getSourceSampleAssetUrl(
    analysisId: string,
    sampleId: string,
    assetType: "visual" | "audio",
  ): string {
    return `${this.baseURL}/api/source-samples/${analysisId}/${sampleId}/${assetType}`;
  }

  async runIdentityRefinement(analysisId: string): Promise<IdentityCandidateLedger> {
    const response = await fetch(
      `${this.baseURL}/api/analysis/${analysisId}/refine-identities`,
      { method: "POST" },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Identity refinement failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async getIdentityCandidates(analysisId: string): Promise<IdentityCandidateLedger> {
    const response = await fetch(
      `${this.baseURL}/api/analysis/${analysisId}/identity-candidates`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Identity candidates failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async promoteIdentityCandidate(
    analysisId: string,
    candidateId: string,
    identityLabel: string,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${this.baseURL}/api/analysis/${analysisId}/identity-candidates/${candidateId}/promote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_label: identityLabel,
          reviewer: "analyst",
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Identity promotion failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async updateCvatLink(analysisId: string, cvatID: number): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/status/${analysisId}/cvat-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvatID,
          origin: "annotate_page_recovery",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `CVAT link update failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      return response.json();
    } catch (error) {
      console.error("CVAT link update error:", error);
      throw error;
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

    // Mock all 7 download links for completed analyses
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
            // Edit By Runzhou: add quan_analysis link
            quan_analysis: `${this.baseURL}/api/download/${analysisId}/quan_analysis`,
            expression_json: `${this.baseURL}/api/download/${analysisId}/expression_json`,
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
              expression_samples: Math.floor(Math.random() * 10) + 1,
              expression_status: "completed",
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
      `${this.baseURL}/api/download/${analysisId}/${fileType}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Download failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.blob();
  }

  async downloadBundle(analysisId: string): Promise<Blob> {
    if (analysisId.startsWith("mock-")) {
      return new Blob([`Mock analysis bundle for ${analysisId}`], {
        type: "application/zip",
      });
    }

    const response = await fetch(`${this.baseURL}/api/download-bundle/${analysisId}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Bundle download failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.blob();
  }

  async getAnnotationCorrections(analysisId: string): Promise<AnnotationCorrections> {
    const response = await fetch(`${this.baseURL}/api/annotation-corrections/${analysisId}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Annotation corrections fetch failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    const result = await response.json();
    return result.annotation_corrections || {};
  }

  async saveAnnotationCorrections(
    analysisId: string,
    corrections: AnnotationCorrections,
  ): Promise<AnnotationCorrections> {
    const response = await fetch(`${this.baseURL}/api/annotation-corrections/${analysisId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(corrections),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Annotation corrections save failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    const result = await response.json();
    return result.annotation_corrections || {};
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
      // Edit By Runzhou: add quan_analysis mime type
      quan_analysis: "application/json",
      source_media_metadata_json: "application/json",
      source_media_metadata_csv: "text/csv",
      annotation_corrections: "application/json",
      expression_json: "application/json",
      face_anonymization_manifest: "application/json",
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
    timeout: number = 300000, // 5 minutes
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
    filename?: string,
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

  async downloadAndSaveBundle(
    analysisId: string,
    filename?: string,
  ): Promise<void> {
    try {
      const blob = await this.downloadBundle(analysisId);
      this.downloadBlob(blob, filename || `${analysisId}_analysis_bundle.zip`);
    } catch (error) {
      console.error("Failed to download analysis bundle:", error);
      throw error;
    }
  }

  async downloadProjectBundle(payload: Record<string, unknown>): Promise<Blob> {
    const response = await fetch(`${this.baseURL}/api/download-project-bundle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Project bundle download failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.blob();
  }

  async downloadAndSaveProjectBundle(
    payload: Record<string, unknown>,
    filename?: string,
  ): Promise<void> {
    try {
      const blob = await this.downloadProjectBundle(payload);
      this.downloadBlob(blob, filename || "vaa1_project_bundle.zip");
    } catch (error) {
      console.error("Failed to download project bundle:", error);
      throw error;
    }
  }

  async saveQuantMatrixSnapshot(
    analysisId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseURL}/api/matrices/quant/${analysisId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Quant matrix save failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  }

  async savePOSMatrixSnapshot(
    analysisId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseURL}/api/matrices/pos/${analysisId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `POS matrix save failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  }

  async getSourceMediaMetadata(analysisId: string): Promise<SourceMediaMetadata> {
    const response = await fetch(`${this.baseURL}/api/source-media/${analysisId}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Source media metadata fetch failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    const data = await response.json();
    return data.source_media_metadata || {};
  }

  async updateSourceMediaMetadata(
    analysisId: string,
    payload: {
      editor_notes?: string;
      source_context?: string;
      provenance_notes?: string;
      title?: string;
      scope?: string;
      description?: string;
      persons?: string[];
      relations?: string;
      location_country?: string;
      location_city?: string;
      location_place?: string;
      location_room?: string;
      time_era?: string;
      time_year?: string;
      time_moment?: string;
      situation_event?: string;
      keywords?: string[];
      interaction_dynamics?: string;
      narrative_development?: string;
      performance_expression?: string;
      genre?: string;
      genre_subtype?: string;
      situational_genre?: string;
      situational_subtype?: string;
      privacy_axis?: string;
      expertise_axis?: string;
      references?: string[];
      reference_speakers?: Array<{
        speaker_label?: string;
        identity_label?: string;
        relation?: string;
        reference_file?: string;
        notes?: string;
      }>;
      reference_relation?: string;
      reference_source?: string;
      confidence?: string;
      notes?: string;
    },
  ): Promise<SourceMediaMetadata> {
    const response = await fetch(`${this.baseURL}/api/source-media/${analysisId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Source media metadata save failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    return data.source_media_metadata || {};
  }

  async uploadSourceMediaReferences(
    analysisId: string,
    files: File[],
  ): Promise<SourceMediaMetadata> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch(
      `${this.baseURL}/api/source-media/${analysisId}/references`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Reference upload failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    return data.source_media_metadata || {};
  }

  async listSharedTaxonomyLabels(
    scope?: SharedTaxonomyLabel["scope"],
    parentValue?: string,
  ): Promise<SharedTaxonomyLabel[]> {
    const params = new URLSearchParams();
    if (scope) {
      params.set("scope", scope);
    }
    if (parentValue) {
      params.set("parent_value", parentValue);
    }
    const query = params.toString();
    const response = await fetch(
      `${this.baseURL}/api/taxonomy/shared${query ? `?${query}` : ""}`,
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Shared taxonomy fetch failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    const data = await response.json();
    return Array.isArray(data.labels) ? data.labels : [];
  }

  async saveSharedTaxonomyLabel(payload: {
    scope: SharedTaxonomyLabel["scope"];
    label: string;
    parent_value?: string;
    created_by?: string;
    source?: string;
    notes?: string;
  }): Promise<SharedTaxonomyLabel> {
    const response = await fetch(`${this.baseURL}/api/taxonomy/shared/labels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Shared taxonomy save failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    const data = await response.json();
    return data.label;
  }

  async syncCvatAnnotations(
    analysisId: string,
    payload?: {
      task_id?: number;
      job_id?: number;
    },
  ): Promise<{
    status: string;
    analysis_id: string;
    task_id: number;
    job_id: number;
    object_annotation_count: number;
    track_annotation_count: number;
    paths: {
      raw_path: string;
      master_path: string;
    };
  }> {
    const response = await fetch(
      `${this.baseURL}/api/annotations/${analysisId}/sync-cvat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload || {}),
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `CVAT sync failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    return response.json();
  }

  getSourceMediaReferenceUrl(downloadUrl?: string): string | null {
    if (!downloadUrl) {
      return null;
    }
    return `${this.baseURL}${downloadUrl}`;
  }

  async refreshPOSAnalysis(
    analysisId: string,
    payload: {
      segments?: Array<{
        text?: string;
        start?: number;
        end?: number;
      }>;
      language_code?: string;
    },
  ): Promise<{ status: string; analysis_id: string; output_path?: string }> {
    const response = await fetch(`${this.baseURL}/api/pos-analysis/${analysisId}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `POS refresh failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  /**
   * Get list of recent analyses (for admin/debugging)
   */
  async listAnalyses(limit: number = 10): Promise<any> {
    console.log("Fetching analyses with limit:", limit);

    try {
      const response = await fetch(
        `${this.baseURL}/api/analyses?limit=${limit}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("Failed to fetch analyses:", response.status, errorText);
        // For development, fall back to mock
        if (!this.useMock) {
          return this.getMockAnalyses(limit);
        }
        throw new Error(
          `Failed to list analyses: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.json();
      console.log("Got analyses:", Object.keys(result.analyses || {}).length);
      return result;
    } catch (error) {
      console.warn("List analyses failed, using fallback:", error);
      // Fallback to mock data
      // return this.getMockAnalyses(limit);
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
        `Delete failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  }

  async clearSession(): Promise<{
    message: string;
    cleared_analysis_ids: string[];
    skipped_processing_ids: string[];
  }> {
    const response = await fetch(`${this.baseURL}/api/session/clear`, {
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Session clear failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async importSavedWork(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseURL}/api/import-bundle`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Saved work import failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    const response = await fetch(`${this.baseURL}/api/workspace-info`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Workspace info failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async revealWorkspacePath(pathType: WorkspacePathType): Promise<void> {
    const response = await fetch(
      `${this.baseURL}/api/reveal-workspace-path/${pathType}`,
      { method: "POST" },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Reveal workspace path failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  }

  async getMorphologyCatalog(query = ""): Promise<{
    items: MorphologyCatalogItem[];
    query?: string;
    feed_repair_api_ready?: boolean;
    notes?: string[];
  }> {
    const search = new URLSearchParams();
    if (query.trim()) {
      search.set("query", query.trim());
    }
    const suffix = search.toString() ? `?${search.toString()}` : "";
    const response = await fetch(`${this.baseURL}/api/morphology/catalog${suffix}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Morphology catalog failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  /**
   * Health check for API server
   */
  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);

      if (!response.ok) {
        throw new Error(
          `Health check failed: ${response.status} ${response.statusText}`,
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
        `API info failed: ${response.status} ${response.statusText}`,
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
      "audio_diarization",
      "annotation_corrections",
      // Edit By Runzhou: add pos_analysis file type
      "pos_analysis",
      // Edit By Runzhou: add quan_analysis file type
      "quan_analysis",
      "expression_json",
      "face_anonymization_manifest",
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
      audio_diarization: "Audio Diarization Scaffold (JSON)",
      annotation_corrections: "Annotation Corrections (JSON)",
      // Edit By Runzhou: add pos_analysis display name
      pos_analysis: "Position Analysis (JSON)",
      // Edit By Runzhou: add quan_analysis display name
      quan_analysis: "Quantity Analysis (JSON)",
      expression_json: "Expression Analysis (JSON)",
      face_anonymization_manifest: "Face Anonymization Manifest (JSON)",
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
      audio_diarization: ".json",
      annotation_corrections: ".json",
      // Edit By Runzhou: add pos_analysis file extension
      pos_analysis: ".json",
      // Edit By Runzhou: add quan_analysis file extension
      quan_analysis: ".json",
      expression_json: ".json",
      face_anonymization_manifest: ".json",
    };

    return extensions[fileType] || "";
  }

  /**
   * Batch download all available files from analysis
   */
  async downloadAllFiles(
    analysisId: string,
    status: AnalysisStatus,
  ): Promise<void> {
    const downloadLinks = status.download_links || {};
    const downloadPromises = Object.entries(downloadLinks).map(
      async ([fileType, url]) => {
        try {
          const filename = `${analysisId}_${fileType}${this.getFileExtension(
            fileType,
          )}`;
          await this.downloadAndSaveFile(analysisId, fileType, filename);
          console.log(`Downloaded: ${filename}`);
        } catch (error) {
          console.error(`Failed to download ${fileType}:`, error);
        }
      },
    );

    await Promise.allSettled(downloadPromises);
  }

  /**
   * Enhanced upload with progress tracking
   */
  async uploadVideoWithProgress(
    file: File,
    cvatID: number,
    onProgress?: (progress: number) => void,
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
