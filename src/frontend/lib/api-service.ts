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
import type { CanonicalSourceClockScope } from "./source-clock";

export type SourceClockResolution = {
  analysis_id: string;
  selected_time_scope: CanonicalSourceClockScope & {
    authority_rank: number;
    candidate_count: number;
    superseded_time_refs: string[];
  };
  affected_dependent_refs: string[];
  invalidation?: Record<string, unknown> | null;
};

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
  transcript_timing_repair?: {
    status?: string;
    reason?: string;
    quality?: Record<string, unknown>;
    quality_before?: Record<string, unknown>;
    quality_after?: Record<string, unknown>;
    backup_path?: string;
  };
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
    audio_sample_clouds?: number;
    audio_sample_count?: number;
    audio_language?: string;
    audio_language_name?: string;
    audio_language_source?: string;
    audio_language_confidence?: number;
    audio_error?: string;
    audio_prosody_error?: string;
    audio_diarization_error?: string;
    audio_sample_cloud_error?: string;
    identity_triangulation_error?: string;
    second_order_label_proliferation_error?: string;
    mise_en_scene_scene_cards_error?: string;
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
  canonical_decision_ledger?: {
    schema: "vaa1.canonical_decision_ledger.v0";
    analysis_id: string;
    version: 1;
    decisions: Array<Record<string, unknown>>;
  };
  native_statistical_interpretation?: NativeStatisticalInterpretationRun | null;
  projected_canonical_claims?: ProjectedCanonicalClaimCollection;
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
  identity_triangulation?: IdentityTriangulationStatus | null;
  agent_persistence_scene_cut?: {
    schema?: string;
    status?: string;
    scene_cut_count?: number;
    track_count?: number;
    tracks_with_comparable_features?: number;
    summary?: {
      candidate_count?: number;
      accepted_count?: number;
      review_candidate_count?: number;
    };
    output_json_path?: string;
    updated_at?: string;
  } | null;
  second_order_label_proliferation?: SecondOrderLabelProliferationPlan | null;
  narrative_lens_reading?: Record<string, unknown> | null;
  character_path_reading?: Record<string, unknown> | null;
  datascene_meaning_network?: Record<string, unknown> | null;
  multimodal_meaning_stage1?: Record<string, unknown> | null;
  mise_en_scene_scene_cards?: {
    schema?: string;
    scene_card_count?: number;
    output_json_path?: string;
    source_extraction_metadata_summary_path?: string;
    updated_at?: string;
  } | null;
  source_extraction_metadata_summary?: {
    schema?: string;
    status?: string;
    summary?: string;
    supporting_scenes?: string[];
    output_json_path?: string;
    updated_at?: string;
  } | null;
  evidence_proliferation_matches?: EvidenceProliferationMatchSummary[];
  live_mature_data_proliferation_audit?: Record<string, unknown> | null;
  audio_diarization?: AudioDiarizationScaffold | null;
  audio_sample_clouds?: AudioSampleClouds | null;
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

export type NativeStatisticalObservation = {
  observation_id?: string;
  metric_id?: string;
  metric_label?: string;
  signal_family?: string;
  analytical_unit?: string;
  observed_value?: number;
  unit?: string;
  baseline?: {
    definition?: string;
    sample_size?: number;
    median?: number;
    median_absolute_deviation?: number;
  };
  standardized_deviation?: {
    method?: string;
    value?: number | null;
    available?: boolean;
    direction?: string;
    reason_unavailable?: string | null;
  };
  evidence_refs?: string[];
};

export type NativeStatisticalInterpretationRun = {
  schema?: "vaa1.native_statistical_interpretation.v1";
  analysis_id?: string;
  run_id?: string;
  status?: string;
  reason?: string;
  finding?: {
    finding_id?: string;
    salience_index?: number;
    independent_signal_family_count?: number;
    signal_families?: string[];
    observations?: NativeStatisticalObservation[];
    source_interval?: {
      source_media_id?: string;
      clock_id?: string;
      start_seconds?: number;
      end_seconds?: number;
    };
    statistical_terms?: Record<string, string>;
    limitations?: string[];
    status?: string;
  };
  claim?: Record<string, unknown>;
  proposition?: Record<string, unknown>;
  panel_routes?: Record<string, { role?: string; status?: string; record_refs?: string[] }>;
  governance?: {
    canonical_write?: boolean;
    analyst_confirmation_required?: boolean;
    causal_claim_created?: boolean;
    statistical_significance_claimed?: boolean;
  };
  selection?: {
    method?: string;
    eligible_scene_count?: number;
    selected_scene_index?: number;
    selected_scene_ref?: Record<string, unknown>;
  };
  relationships?: Array<{
    relationship_id?: string;
    coupling?: string;
    left_metric?: string;
    right_metric?: string;
    method?: string;
    coefficient?: number;
    scene_count?: number;
    direction?: string;
    strength_label?: string;
    interpretation?: string;
    substantive_reading?: string;
    status?: string;
    scene_refs?: string[];
    source_intervals?: Array<{ start_seconds?: number; end_seconds?: number }>;
    paired_observations?: Array<{
      scene_ref?: string;
      start_seconds?: number;
      end_seconds?: number;
      left_value?: number;
      right_value?: number;
    }>;
    analytical_frames?: {
      scale?: { micro?: string; meso?: string; macro?: string; computed_level?: string };
      orientation?: string[];
      evidence_expression?: string[];
      relationship_expression?: string;
    };
  }>;
  relationship_diagnostics?: Array<{
    coupling?: string;
    left_metric?: string;
    right_metric?: string;
    status?: string;
    paired_scene_count?: number;
    left_unique_value_count?: number;
    right_unique_value_count?: number;
    left_constant_value?: number | null;
    right_constant_value?: number | null;
    reason?: string;
  }>;
};

export type StatsResearchQuestionRun = {
  plan?: {
    plan_id?: string;
    research_question?: string;
    motor?: string;
    analytical_unit?: string;
    method?: string;
    variables?: string[];
    required_source_layers?: string[];
    status?: string;
  };
  run?: {
    run_id?: string;
    status?: string;
    results?: Array<{
      result_id?: string;
      left_variable?: string;
      right_variable?: string;
      coefficient?: number;
      sample_size?: number;
      proposition?: { text?: string; status?: string };
      visualization?: Record<string, unknown>;
      report_sentence?: { text?: string; status?: string; source_scene_refs?: string[] };
      evidence?: Array<Record<string, unknown>>;
      status?: string;
    }>;
  };
  native_interpretation?: NativeStatisticalInterpretationRun;
};

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

export interface IdentityTriangulationStatus {
  status?: string;
  identity_count?: number;
  proliferation_ready_count?: number;
  output_json_path?: string;
  updated_at?: string;
}

export interface SecondOrderLabelInstruction {
  instruction_id: string;
  source_event_id?: string;
  target_label_family: string;
  candidate_label: string;
  status: "candidate" | "probable" | "strongly_supported" | "analyst_confirmed" | string;
  may_surface_in_ui?: boolean;
  may_proliferate?: boolean;
  may_auto_confirm?: boolean;
  requires_immediate_confirmation?: boolean;
  manual_override_available?: boolean;
  confirmation_policy?: {
    analyst_confirmation_is_welcome?: boolean;
    analyst_confirmation_is_not_required_for_every_candidate?: boolean;
    interrupt_analyst?: boolean;
    surface_as?: "badge" | "review_prompt" | string;
  };
  ui_surfaces?: string[];
  time_span?: {
    start_ms?: number;
    end_ms?: number;
    start?: number;
    end?: number;
  };
  participants_involved?: string[];
  objects_involved?: string[];
  source_feature_type?: string;
  source_feature_payload?: Record<string, unknown>;
  source_evidence_refs?: Array<{
    evidence_id?: string;
    evidence_kind?: string;
    authority_level?: number;
  }>;
  traceback?: Record<string, unknown>;
  open_scores?: Record<string, number>;
  open_score_weights?: Record<string, number>;
  must_preserve?: string[];
  forbidden_updates?: string[];
}

export interface AgentPersistenceLabel {
  candidate_label: string;
  source_feature_type: string;
  provenance: string;
  status: "review_candidate" | "strong_candidate" | string;
  temporal_grounding?: {
    scene_boundary_time?: number;
    departed_track_interval?: [number, number];
    arrived_track_interval?: [number, number];
  };
  evidence?: {
    similarity_score?: number;
    departed_track_id?: string;
    arrived_track_id?: string;
  };
  traceback_relink?: any;
}

export interface SecondOrderLabelProliferationPlan {
  schema: "vaa1.second_order_label_proliferation_plan.v1" | string;
  analysis_id?: string;
  source_media_id?: string;
  authority_policy?: Record<string, unknown>;
  open_score_weights?: Record<string, number>;
  priority_weights?: Record<string, unknown>;
  graduated_status_thresholds?: Record<string, number>;
  instructions?: SecondOrderLabelInstruction[];
  agent_persistence_labels?: AgentPersistenceLabel[];
  summary?: {
    instruction_count?: number;
    agent_persistence_label_count?: number;
    status_counts?: Record<string, number>;
    immediate_confirmation_count?: number;
    ui_surface_count?: number;
  };
  governance?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
}

export interface EvidenceProliferationRequest {
  request_id: string;
  created_at?: string;
  video_id?: string;
  evidence?: Record<string, unknown>;
  scope?: string;
  target?: string;
  governance?: Record<string, unknown>;
}

export interface EvidenceProliferationCandidate {
  candidate_id: string;
  candidate_role?:
    | "anchor_sample"
    | "identity_candidate"
    | "context_support"
    | "conflict"
    | string;
  evidence_id?: string;
  analysis_id?: string;
  label?: string;
  category?: string;
  source_kind?: string;
  source_panel?: string;
  match_score?: number;
  match_probability?: number;
  probability_band?: string;
  legacy_match_score?: number;
  review_state?: "candidate" | string;
  decision_required?: boolean;
  allowed_actions?: string[];
  proliferation_allowed?: boolean;
  proliferation_reason?: string;
  source_verification_class?: "known_verified_sample" | "unknown_similar_candidate" | string;
  source_navigation?: {
    has_time?: boolean;
    has_bbox?: boolean;
    open_actions?: string[];
  };
  source_anchors?: Array<Record<string, unknown>>;
  evidence_refs?: Array<Record<string, unknown>>;
  projection_targets?: string[];
  situational_options?: Array<Record<string, unknown>>;
  presence_claims?: {
    visual_presence?: Record<string, unknown>;
    scene_presence?: Record<string, unknown>;
    speaking?: Record<string, unknown>;
    listening?: Record<string, unknown>;
  };
  master_object_projection?: {
    schema?: string;
    master_object_id?: string;
    object_family?: string;
    current_label?: string;
    maturity_state?: string;
    authority_level?: string;
    confidence?: number;
    maturity_score?: Record<string, unknown>;
    source_anchors?: Array<Record<string, unknown>>;
    evidence_refs?: Array<Record<string, unknown>>;
    traceback_ref?: string;
    projection_targets?: string[];
    governance_status?: {
      active?: boolean;
      proliferation_allowed?: boolean;
      review_required?: boolean;
      review_reason?: string | null;
      conflict_state?: string;
      unknown_override_blocked?: boolean;
    };
  };
  time?: {
    start?: number | null;
    end?: number | null;
  };
  geometry?: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
  source_timesphere?: Record<string, unknown>;
  constellation_memory?: {
    schema?: string;
    constellation_key?: string;
    constellation_label?: string;
    positive_anchor_count?: number;
    negative_anchor_count?: number;
    positive_support?: number;
    negative_support?: number;
    net_support?: number;
    best_positive_fit?: Record<string, unknown> | null;
    best_negative_fit?: Record<string, unknown> | null;
  };
  closest_match?: {
    principle?: "closest_match" | string;
    match_probability?: number;
    identity_compatibility?:
      | "direct_identity"
      | "unknown_person"
      | "known_identity_option"
      | "contextual_support"
      | "incompatible"
      | "not_applicable"
      | string;
    components?: Record<string, number | null | undefined>;
    weights?: Record<string, number>;
    source_timesphere?: Record<string, unknown>;
    seed_timesphere?: Record<string, unknown>;
    constellation_memory?: {
      schema?: string;
      constellation_key?: string;
      constellation_label?: string;
      positive_anchor_count?: number;
      negative_anchor_count?: number;
      positive_support?: number;
      negative_support?: number;
      net_support?: number;
      best_positive_fit?: Record<string, unknown> | null;
      best_negative_fit?: Record<string, unknown> | null;
    };
  };
  provenance?: Record<string, unknown>;
}

export interface EvidenceProliferationMatch {
  schema: "vaa1.evidence_proliferation_match.v1" | string;
  governance_schema?: string;
  analysis_id?: string;
  request_id?: string;
  status?: "completed" | string;
  progress?: {
    request_preparation?: number;
    candidate_matching?: number;
  };
  candidate_count?: number;
  governance?: Record<string, unknown>;
  probability_policy?: Record<string, unknown>;
  mature_constellation_index?: Record<string, unknown>;
  request?: EvidenceProliferationRequest;
  candidates?: EvidenceProliferationCandidate[];
}

export interface EvidenceProliferationMatchSummary {
  request_id?: string;
  status?: string;
  candidate_count?: number;
  output_json_path?: string;
  updated_at?: string;
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

export interface AudioSampleClouds {
  analysis_id?: string;
  status?: string;
  cloud_count?: number;
  sample_count?: number;
  authority_order?: string[];
  maturation_economics?: {
    schema?: string;
    cost_observations?: {
      build_compute_seconds?: number;
      artifact_storage_bytes?: number;
      artifact_storage_mb?: number;
      analyst_minutes?: number | null;
      analyst_cost_status?: string;
    };
    yield_observations?: {
      cloud_count?: number;
      sample_count?: number;
      unique_sample_count?: number;
      reusable_sample_count?: number;
      confirmed_sample_count?: number;
      valid_for_confirmation_count?: number;
      source_linked_sample_count?: number;
      duplicate_sample_count?: number;
      sampled_seconds?: number;
      source_coverage_ratio?: number | null;
      reuse_ratio?: number;
      waste_ratio?: number;
    };
    dense_analysis_policy?: {
      recommendation?: string;
      full_dense_pass_recommended?: boolean;
      targeted_dense_pass_recommended?: boolean;
      target_windows?: Array<Record<string, unknown>>;
      reason?: string;
    };
    economic_verdict?: {
      maturation_economically_sound?: boolean;
      iteration_should_continue?: boolean;
      developer_attention_required?: boolean;
    };
  };
  clouds?: Array<{
    cloud_id?: string;
    entity_type?: string;
    entity_label?: string;
    entity_status?: string;
    samples?: Array<{
      sample_id?: string;
      sample_fingerprint?: string;
      reuse_key?: string;
      stable_subject_ref?: Record<string, unknown>;
      time_start?: number;
      time_end?: number;
      duration_seconds?: number;
      transcript_text?: string;
      speaker_label?: string;
      source_turn_id?: string;
      sample_role?: string;
      source_type?: string;
      confidence?: number;
      epistemic_status?: string;
      review_state?: string;
      audio_features?: Record<string, any>;
      supporting_evidence_ids?: string[];
      source_navigation?: Record<string, unknown>;
    }>;
    cloud_summary?: Record<string, any>;
  }>;
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
  traceback_record_path?: string;
  traceback_tree_path?: string;
  traceback_tree_node_count?: number;
  traceback_tree_edge_count?: number;
  artifact_sha256?: string | null;
  saved_frame_paths?: string[];
  rendered_frames?: number;
  status?: "completed" | "error";
  created_at?: string;
}

export interface ForensicTracebackRecord {
  traceback_schema: string;
  artifact_id: string;
  artifact_type: string;
  analysis_id: string;
  created_at?: string;
  source?: Record<string, unknown>;
  region?: Record<string, unknown>;
  render_parameters?: Record<string, unknown>;
  evidence_chain?: Record<string, unknown>;
  adopted_context_counts?: Record<string, number>;
  reproducibility?: Record<string, unknown>;
  warnings?: Array<{ code?: string; message?: string }>;
  known_limitations?: string[];
}

export interface ForensicTracebackTree {
  traceback_tree_schema: string;
  analysis_id?: string;
  artifact_id?: string;
  root_node_id?: string;
  node_count?: number;
  edge_count?: number;
  nodes?: Array<{
    id: string;
    type: string;
    label?: string;
    payload?: Record<string, unknown>;
  }>;
  edges?: Array<{
    source: string;
    target: string;
    relation: string;
  }>;
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

export interface AiAgentFeatureCandidate {
  name: string;
  license: string;
  role: string;
  integration_policy: string;
  license_policy: string;
  core_compatible: boolean;
}

export interface AiAgentFeatureStarter {
  feature_id: string;
  title: string;
  purpose: string;
  starter_boundary: string;
  immediate_action: string;
  status: string;
  candidates: AiAgentFeatureCandidate[];
}

export interface AiAgentFeatureStarterManifest {
  schema: string;
  generated_at: string;
  governance: {
    no_hidden_network_calls: boolean;
    manual_correction_wins: boolean;
    raw_outputs_preserved: boolean;
    strong_copyleft_is_isolated_or_avoided: boolean;
  };
  features: AiAgentFeatureStarter[];
}

export interface AiAgentFeatureStarterWriteResponse {
  status: string;
  path: string;
  feature_count: number;
  manifest: AiAgentFeatureStarterManifest;
}

export interface AiAgentSceneCardReportDraftResponse {
  status: string;
  analysis_id: string;
  path: string;
  scene_count: number;
  markdown: string;
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
  recorded_at?: string | null;
  gps_coordinates?: string | null;
  camera_make?: string | null;
  camera_model?: string | null;
  recording_device?: string | null;
  recording_software?: string | null;
  filmed_by?: string | null;
  embedded_metadata?: Record<string, unknown>;
  uploaded_at?: string;
  analysis_started_at?: string;
  analysis_completed_at?: string;
  pipeline_type?: string;
  cvatID?: number;
  filesystem_modified_at?: string;
  annotation_maturity?: Record<
    string,
    {
      maturity?: string;
      authority?: string;
      evidence_sources?: string[];
      traceback?: {
        route?: string;
        raw_preserved?: boolean;
        consulted?: string[];
      };
    }
  >;
  video_internal_harvest?: {
    annotations?: Record<string, unknown>;
    field_sources?: Record<
      string,
      {
        maturity?: string;
        authority?: string;
        evidence_sources?: string[];
        traceback?: {
          route?: string;
          raw_preserved?: boolean;
          consulted?: string[];
        };
      }
    >;
    evidence_counts?: Record<string, number>;
  };
  maturity_iteration?: {
    iteration_id?: string;
    updated_at?: string;
    process?: string[];
    filled_from_maturity?: Array<{
      field?: string;
      maturity?: string;
      route?: string;
      evidence_sources?: string[];
    }>;
    manual_protected_fields?: string[];
    review_candidates?: Array<{
      field?: string;
      status?: string;
      maturity?: string;
      route?: string;
      evidence_sources?: string[];
    }>;
    evidence_counts?: Record<string, number>;
    field_count?: number;
    filled_count?: number;
    manual_protected_count?: number;
    review_candidate_count?: number;
  };
  user_annotations?: {
    editor_notes?: string;
    source_context?: string;
    provenance_notes?: string;
    title?: string;
    scope?: string;
    description?: string;
    persons?: string[];
    organizations?: string[];
    character_roles?: string[];
    character_definitions?: Array<{
      character_name?: string;
      actor_name?: string;
      aliases?: string[];
      role_labels?: string[];
      role_description?: string;
      relations?: string[];
      profile_governance?: {
        profile_type?: string;
        identity_boundary?: string;
        actor_boundary?: string;
        dramatic_archetype_note?: string;
        shakespearean_modality_note?: string;
        shakespearean_layers?: string[];
      };
      constituent_evidence?: Record<
        string,
        {
          value?: string | string[];
          source_field?: string;
          source_url?: string;
        }
      >;
      source_url?: string;
      source_preference?: string;
      maturity?: string;
      maturity_route?: string;
    }>;
    narrative_agent_profiles?: Array<{
      profile_id?: string;
      profile_type?: string;
      narrative_agent_name?: string;
      aliases?: string[];
      attached_performer_metadata?: {
        actor_name?: string;
        boundary?: string;
      };
      source_metadata?: {
        role_labels?: string[];
        role_description?: string;
        relations?: string[];
        source_url?: string;
        source_preference?: string;
      };
      evidence_slots?: {
        lines?: unknown[];
        audio_samples?: unknown[];
        visual_patterns?: unknown[];
        identification_refs?: unknown[];
        scene_links?: unknown[];
        meaning_plot_refs?: unknown[];
      };
      dramaturgical_tendencies?: Array<{
        label?: string;
        status?: string;
        confidence?: string;
        basis?: string;
      }>;
      interpretive_readings?: Array<{
        reading_id?: string;
        label?: string;
        branch?: string;
        status?: string;
        confidence?: string;
        summary?: string;
        evidence_basis?: string[];
      }>;
      profile_extensions?: Array<{
        extension_id?: string;
        label?: string;
        status?: string;
        activation?: string;
        applies_when?: string[];
        compartments?: string[];
      }>;
      profile_governance?: {
        profile_type?: string;
        identity_boundary?: string;
        actor_boundary?: string;
        dramatic_archetype_note?: string;
        shakespearean_modality_note?: string;
        shakespearean_layers?: string[];
      };
      constituent_evidence?: Record<string, unknown>;
      maturity?: string;
      maturity_route?: string;
      traceback?: Record<string, unknown>;
    }>;
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
    web_metadata_sources?: Array<{
      id?: string;
      url?: string;
      preference?: "main" | "supporting" | "background";
      retrieved_at?: string;
      status?: string;
      http_status?: number;
      content_type?: string;
      fields?: {
        title?: string;
        description?: string;
        persons?: string[];
        character_roles?: Array<{
          actor?: string;
          character?: string;
          role?: string;
          description?: string;
        }>;
        production_crew?: Array<{
          person?: string;
          department?: string;
        }>;
        places?: string[];
        dates?: string[];
        keywords?: string[];
        genre?: string;
        genre_subtype?: string;
        situational_genre?: string;
        situational_subtype?: string;
        source_url?: string;
        retrieved_at?: string;
        source_types?: string[];
      };
      candidates?: Array<{
        field?: string;
        value?: string;
        source_url?: string;
        retrieved_at?: string;
        selector?: string;
        raw_excerpt?: string;
        confidence?: string;
        review_state?: string;
      }>;
      visible_text_excerpt?: string;
      json_ld_count?: number;
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
  corrected_start_timestamp?: number;
  corrected_end_timestamp?: number;
  speaker_confirmation?: string;
  target_track_id?: number;
  note?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface ProliferationDecision {
  decision_id: string;
  candidate_id: string;
  request_id?: string;
  decision_scope?: "candidate" | "cluster" | "hypothesis" | string;
  cluster_key?: string;
  hypothesis_id?: string;
  target_hypothesis_id?: string;
  opportunity_id?: string;
  source_opportunity_id?: string;
  decision: "confirmed" | "canceled" | "deferred" | "inspected" | string;
  authority_level?: string;
  source_panel?: string;
  source_verification_status?: "source_time_resolved" | "source_anchor_missing" | string;
  source_range_source?: "evidence_ref" | "presence_override" | "manual_interval" | string;
  candidate_label?: string;
  applied_label?: string;
  target_evidence_id?: string;
  target_track_id?: number | string;
  source_anchors?: Array<Record<string, unknown>>;
  evidence_refs?: Array<Record<string, unknown>>;
  source_traceback_refs?: string[];
  projection_targets?: string[];
  proliferates_to?: string[];
  governance_status?: Record<string, unknown>;
  proliferation_allowed?: boolean;
  decision_reason?: string;
  created_at?: string;
  created_by?: string;
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
  geometry_keyframes?: Array<{
    time: number;
    coordinates: {
      x: number;
      y: number;
      w: number;
      h: number;
    };
    source?: "manual" | "track" | "interpolated";
    updated_at?: string;
  }>;
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
    source_expression_key?: string;
    source_expression_label?: string;
    source_expression_timestamp?: number;
    source_expression_owner_request?: boolean;
    synthesized_person_detection?: boolean;
    apply_scope?:
      | "this_interval_only"
      | "this_bbox_roi_only"
      | "current_scene"
      | "current_continuity_segment"
      | "linked_candidates"
      | "track_family"
      | "narrative_agent_family";
    bbox_roi_governance_schema?: "vaa1.bbox_roi_governance.v1" | string;
    authority_state?: string;
    maturity_state?: string;
    geometry_track_id?: string;
    coordinate_system?: "normalized_video" | "pixel_video" | "frame_region" | string;
    interpolation_policy?: {
      allowed?: boolean;
      max_gap_ms?: number;
      break_on_scene_boundary?: boolean;
      break_on_shot_cut?: boolean;
      manual_confirmation_required_for_cross_boundary?: boolean;
    };
    manual_confirmation_event?: {
      event_type?: "manual_bbox_roi_confirmation" | string;
      event_id?: string;
      analysis_id?: string;
      bbox_roi_id?: string;
      authority_level?: string;
      confirmed_fields?: Record<string, boolean>;
      active_state_after_save?: Record<string, unknown>;
      supersedes?: string[];
      old_states_retained_as?: string;
      propagation_required?: boolean;
      partial_propagation_allowed?: boolean;
    };
    source_track_keyframes_retained_for_traceback?: Array<{
      time: number;
      source?: "manual" | "track" | "interpolated";
    }>;
    master_schema_presence_interval_id?: string;
    source_range_source?: string;
    bbox_classification_entries?: Array<{
      id: string;
      category: ManualVisualAnnotation["category"];
      subcategory?: string;
      label: string;
      narrativeAgentName?: string;
    }>;
    source_time_corrections?: Array<{
      corrected_at: string;
      corrected_by: string;
      clock_id: "source_media.clock" | string;
      previous_start_seconds: number;
      previous_end_seconds: number;
      corrected_start_seconds: number;
      corrected_end_seconds: number;
      authority: "explicit_user_correction" | string;
    }>;
    quick_annotations?: string[];
    maturity_policy?: string;
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
  speaker_confirmation?: string;
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
  transcript_clock_offset_seconds?: number;
  manual_transcript_entries?: ManualTranscriptEntry[];
  manual_visual_annotations?: ManualVisualAnnotation[];
  proliferation_decisions?: ProliferationDecision[];
  master_schema_presence_intervals?: Array<{
    id: string;
    node_id: string;
    node_type?: string;
    label?: string;
    narrative_agent_profile_id?: string;
    master_schema_surface?: string;
    lane_id?: string;
    presence_mode?: "on_camera" | "off_camera" | "ambient" | "location" | "music" | string;
    start_seconds: number;
    end_seconds: number;
    authority_level: "manual_correction" | "manual_confirmation" | "system_candidate" | string;
    source_panel?: string;
    source_profile_surface?: string;
    source_verification_status?: "source_time_resolved" | "source_anchor_missing" | string;
    source_range_source?: "evidence_ref" | "presence_override" | "manual_interval" | string;
    source_evidence_refs?: Array<{
      evidence_id?: string;
      source_type?: string;
      time_range?: { start?: number; end?: number };
      traceback_record_id?: string;
      confidence?: number;
    }>;
    source_traceback_refs?: string[];
    propagation_required?: boolean;
    partial_propagation_allowed?: boolean;
    proliferates_to?: string[];
    updated_at?: string;
    updated_by?: string;
  }>;
  meaning_network_custom_lanes?: Array<{
    lane_id: string;
    label: string;
    description?: string;
    created_by?: string;
    updated_at?: string;
  }>;
}

export interface ProjectedSubjectState {
  schema: "vaa1.projected_subject_state.v0.compatibility";
  analysis_id: string;
  subject_ref: { type: string; id: string };
  timestamp_seconds: number;
  raw_value: string | null;
  projected_value: string | null;
  authority: string;
  authority_rank: number;
  maturity: string;
  validity: "current" | "stale" | "invalid" | "unknown";
  review_status: string;
  conflict_status: string;
  projection_status: "projected" | "unavailable" | "suppressed" | "stale";
  scope: Record<string, unknown>;
  evidence_refs: string[];
  correction_refs: string[];
  decision_refs: string[];
  invalidated_decision_refs?: string[];
  traceback_refs: string[];
  compatibility_mode: true;
  indication: null | {
    tone: "quiet";
    code: string;
    message: string;
    suggested_action?: string;
  };
}

export interface CanonicalDecisionInput {
  decision_id?: string;
  decision_action?: "correct_assignment";
  subject_ref: { type: "visual_track_or_observation"; id: string };
  property: "label";
  scope: {
    start_seconds: number;
    end_seconds: number;
    geometry?: Record<string, unknown> | null;
  };
  value: string;
  authority?: "explicit_user_correction";
  maturity?: "analyst_confirmed";
  evidence_refs?: string[];
  correction_refs?: string[];
  provenance?: Record<string, unknown>;
  created_at?: string;
  created_by?: string;
}

export interface ProjectedCanonicalClaim {
  schema: "vaa1.projected_claim.v0";
  analysis_id: string;
  subject_ref: { type: string; id: string };
  property: string;
  projected_value: unknown;
  authority: string;
  maturity: string;
  validity: "current" | "stale" | "invalid" | "unknown";
  projection_status: "projected" | "suppressed" | "stale" | "unavailable";
  scope: Record<string, unknown>;
  decision_refs: string[];
  evidence_refs: string[];
  correction_refs: string[];
  traceback_refs: string[];
}

export interface ProjectedCanonicalClaimCollection {
  schema: "vaa1.projected_claim_collection.v0";
  analysis_id: string;
  claim_count: number;
  claims: ProjectedCanonicalClaim[];
}

export interface ProjectedSubjectStateBatch {
  schema: "vaa1.projected_subject_state_batch.v0.compatibility";
  analysis_id: string;
  projection_count: number;
  projections: ProjectedSubjectState[];
  compatibility_mode: true;
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
  private readonly statusCache = new Map<string, { expiresAt: number; value: any }>();
  private readonly statusPromises = new Map<string, Promise<any>>();
  private readonly artifactCache = new Map<string, { expiresAt: number; value: Blob }>();
  private readonly artifactPromises = new Map<string, Promise<Blob>>();

  constructor() {
    this.useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true" || false;
    // Direct connection to FastAPI backend
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  }

  invalidateReadCaches(analysisId?: string) {
    if (!analysisId) {
      this.statusCache.clear();
      this.statusPromises.clear();
      this.artifactCache.clear();
      this.artifactPromises.clear();
      return;
    }
    this.statusCache.delete(analysisId);
    this.statusCache.delete(`summary:${analysisId}`);
    this.statusPromises.delete(analysisId);
    this.statusPromises.delete(`summary:${analysisId}`);
    for (const key of [...this.artifactCache.keys()]) {
      if (key.startsWith(`${analysisId}:`)) this.artifactCache.delete(key);
    }
    for (const key of [...this.artifactPromises.keys()]) {
      if (key.startsWith(`${analysisId}:`)) this.artifactPromises.delete(key);
    }
  }

  async runNativeStatisticalInterpretation(
    analysisId: string,
  ): Promise<NativeStatisticalInterpretationRun> {
    const response = await fetch(
      `${this.baseURL}/api/analysis/${encodeURIComponent(analysisId)}/native-statistical-interpretation/run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persist: true }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Statistical interpretation failed (${response.status})`);
    }
    this.invalidateReadCaches(analysisId);
    return response.json();
  }

  async runStatsResearchQuestion(
    analysisId: string,
    payload: { research_question: string; motor: string; scope: string; persist?: boolean },
  ): Promise<StatsResearchQuestionRun> {
    const response = await fetch(
      `${this.baseURL}/api/analysis/${encodeURIComponent(analysisId)}/stats-research-question/run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, persist: payload.persist ?? true }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Research-question run failed (${response.status})`);
    }
    this.invalidateReadCaches(analysisId);
    return response.json();
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
  async getStatus(analysisId: string, options: { fresh?: boolean } = {}): Promise<any> {
    // If mock ID, return mock status
    if (analysisId.startsWith("mock-")) {
      return this.getMockStatus(analysisId);
    }

    if (options.fresh) this.statusCache.delete(analysisId);
    const cached = this.statusCache.get(analysisId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const existingPromise = this.statusPromises.get(analysisId);
    if (existingPromise) return existingPromise;

    const request = (async () => {
    try {
      const response = await fetch(`${this.baseURL}/api/status/${analysisId}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("Status check failed:", response.status, errorText);
        throw new Error(
          `Status check failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const value = await response.json();
      this.statusCache.set(analysisId, { expiresAt: Date.now() + 5_000, value });
      return value;
    } catch (error) {
      console.warn("Status check failed:", error);
      if (this.useMock) {
        return this.getMockStatus(analysisId);
      }
      const localResponse = await fetch(`/api/local-analysis/${analysisId}`);
      if (localResponse.ok) {
        const value = await localResponse.json();
        this.statusCache.set(analysisId, { expiresAt: Date.now() + 5_000, value });
        return value;
      }
      throw error;
    }
    })();
    this.statusPromises.set(analysisId, request);
    try {
      return await request;
    } finally {
      this.statusPromises.delete(analysisId);
    }
  }

  async getStatusSummary(analysisId: string): Promise<any> {
    const cacheKey = `summary:${analysisId}`;
    const cached = this.statusCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const existingPromise = this.statusPromises.get(cacheKey);
    if (existingPromise) return existingPromise;
    const request = fetch(`${this.baseURL}/api/status/${analysisId}/summary`)
      .then(async (response) => {
        if (!response.ok) return this.getStatus(analysisId);
        const value = await response.json();
        this.statusCache.set(cacheKey, { expiresAt: Date.now() + 15_000, value });
        return value;
      })
      .catch(() => this.getStatus(analysisId));
    this.statusPromises.set(cacheKey, request);
    try {
      return await request;
    } finally {
      this.statusPromises.delete(cacheKey);
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

  getForensicRenderTracebackUrl(analysisId: string, renderJobId: string): string {
    return `${this.baseURL}/api/forensic-render/${analysisId}/jobs/${renderJobId}/traceback`;
  }

  async getForensicRenderTraceback(
    analysisId: string,
    renderJobId: string,
  ): Promise<{ traceback: ForensicTracebackRecord; tree?: ForensicTracebackTree | null }> {
    const response = await fetch(
      this.getForensicRenderTracebackUrl(analysisId, renderJobId),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Forensic traceback failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const payload = await response.json();
    return { traceback: payload.traceback, tree: payload.tree || null };
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
        `Narrative Agent refinement failed: ${response.status} ${response.statusText} - ${errorText}`,
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
        `Narrative Agent candidates failed: ${response.status} ${response.statusText} - ${errorText}`,
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
        `Narrative Agent promotion failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async matchEvidenceProliferation(
    analysisId: string,
    request: EvidenceProliferationRequest,
  ): Promise<EvidenceProliferationMatch> {
    const response = await fetch(
      `${this.baseURL}/api/analysis/${analysisId}/proliferation/match`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Evidence proliferation matching failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async refreshEvidenceProliferationMatcher(
    analysisId: string,
    options: { request_limit?: number; candidate_limit?: number } = {},
  ): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${this.baseURL}/api/analysis/${analysisId}/proliferation/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Evidence proliferation matcher refresh failed: ${response.status} ${response.statusText} - ${errorText}`,
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

    const cacheable = !["source_video", "video", "annotated_video"].includes(fileType);
    const cacheKey = `${analysisId}:${fileType}`;
    const cached = cacheable ? this.artifactCache.get(cacheKey) : undefined;
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const existingPromise = cacheable ? this.artifactPromises.get(cacheKey) : undefined;
    if (existingPromise) return existingPromise;

    const request = (async () => {
    const noCacheToken = Date.now().toString(36);
    let response: Response;
    try {
      response = await fetch(
        `${this.baseURL}/api/download/${analysisId}/${fileType}?_=${noCacheToken}`,
        { cache: "no-store" },
      );
    } catch (error) {
      console.warn("Backend download failed, trying local analysis artifact:", error);
      response = await fetch(
        `/api/local-analysis/${analysisId}/download/${fileType}?_=${noCacheToken}`,
        { cache: "no-store" },
      );
    }

    if (!response.ok) {
      const localResponse = response.url.includes("/api/local-analysis/")
        ? response
        : await fetch(
            `/api/local-analysis/${analysisId}/download/${fileType}?_=${noCacheToken}`,
            { cache: "no-store" },
          );
      if (localResponse.ok) {
        const value = await localResponse.blob();
        if (cacheable) this.artifactCache.set(cacheKey, { expiresAt: Date.now() + 30_000, value });
        return value;
      }
      const errorText = await localResponse.text();
      throw new Error(
        `Download failed: ${localResponse.status} ${localResponse.statusText} - ${errorText}`,
      );
    }

    const value = await response.blob();
    if (cacheable) this.artifactCache.set(cacheKey, { expiresAt: Date.now() + 30_000, value });
    return value;
    })();
    if (cacheable) this.artifactPromises.set(cacheKey, request);
    try {
      return await request;
    } finally {
      if (cacheable) this.artifactPromises.delete(cacheKey);
    }
  }

  getDownloadUrl(analysisId: string, fileType: string): string {
    if (fileType === "source_video") {
      return `${this.baseURL}/api/download/${analysisId}/${fileType}`;
    }
    const noCacheToken = Date.now().toString(36);
    return `${this.baseURL}/api/download/${analysisId}/${fileType}?_=${noCacheToken}`;
  }

  async downloadBundle(analysisId: string): Promise<Blob> {
    if (analysisId.startsWith("mock-")) {
      return new Blob([`Mock analysis bundle for ${analysisId}`], {
        type: "application/zip",
      });
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/api/download-bundle/${analysisId}`);
    } catch (error) {
      console.warn("Backend bundle download failed, trying local analysis bundle:", error);
      response = await fetch(`/api/local-analysis/${analysisId}/bundle`);
    }

    if (!response.ok) {
      const localResponse = response.url.includes("/api/local-analysis/")
        ? response
        : await fetch(`/api/local-analysis/${analysisId}/bundle`);
      if (localResponse.ok) {
        return localResponse.blob();
      }
      const errorText = await localResponse.text();
      throw new Error(
        `Bundle download failed: ${localResponse.status} ${localResponse.statusText} - ${errorText}`,
      );
    }

    return response.blob();
  }

  getBundleDownloadUrl(analysisId: string): string {
    return `${this.baseURL}/api/download-bundle/${analysisId}`;
  }

  async getProjectedSubjectState(
    analysisId: string,
    subjectRef: string,
    timestampSeconds: number,
  ): Promise<ProjectedSubjectState> {
    const params = new URLSearchParams({
      subject_ref: subjectRef,
      timestamp: String(timestampSeconds),
    });
    const response = await fetch(
      `${this.baseURL}/api/analysis/${analysisId}/projected-state?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(`Projected state unavailable (${response.status})`);
    }
    return response.json();
  }

  async getProjectedSubjectStates(
    analysisId: string,
    requests: Array<{ subject_ref: string; timestamp: number }>,
  ): Promise<ProjectedSubjectStateBatch> {
    const response = await fetch(
      `${this.baseURL}/api/analysis/${analysisId}/projected-state/batch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new Error(`Projected states unavailable (${response.status})`);
    }
    return response.json();
  }

  async createCanonicalDecision(
    analysisId: string,
    decision: CanonicalDecisionInput,
  ): Promise<{ status: "appended" | "unchanged"; decision: Record<string, unknown> }> {
    const response = await fetch(`${this.baseURL}/api/analysis/${analysisId}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(decision),
    });
    if (!response.ok) {
      throw new Error(`Canonical decision unavailable (${response.status})`);
    }
    return response.json();
  }

  async getProjectedCanonicalClaims(
    analysisId: string,
    request: { subject_refs?: string[]; properties?: string[]; timestamp?: number },
  ): Promise<ProjectedCanonicalClaimCollection> {
    const response = await fetch(`${this.baseURL}/api/analysis/${analysisId}/claims/projected`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Canonical claim projection unavailable (${response.status})`);
    }
    return response.json();
  }

  async invalidateCanonicalDecision(
    analysisId: string,
    invalidation: {
      decision_id?: string;
      target_decision_refs?: string[];
      correction_ref?: string;
      reason_code: string;
      reason?: string;
      dependency_ref?: string;
      created_at?: string;
      created_by?: string;
    },
  ): Promise<{ status: "appended" | "unchanged"; invalidation: Record<string, unknown> }> {
    const response = await fetch(
      `${this.baseURL}/api/analysis/${analysisId}/decisions/invalidate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidation),
      },
    );
    if (!response.ok) {
      throw new Error(`Canonical invalidation unavailable (${response.status})`);
    }
    return response.json();
  }

  async getAnnotationCorrections(analysisId: string): Promise<AnnotationCorrections> {
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/api/annotation-corrections/${analysisId}`);
    } catch {
      response = await fetch(`/api/local-analysis/${analysisId}/download/annotation_corrections`);
    }
    if (!response.ok) {
      const localResponse = response.url.includes("/api/local-analysis/")
        ? response
        : await fetch(`/api/local-analysis/${analysisId}/download/annotation_corrections`);
      if (!localResponse.ok) {
        const errorText = await localResponse.text();
        throw new Error(
          `Annotation corrections fetch failed: ${localResponse.status} ${localResponse.statusText} - ${errorText}`,
        );
      }
      response = localResponse;
    }
    const result = await response.json();
    return result.annotation_corrections || result || {};
  }

  async saveAnnotationCorrections(
    analysisId: string,
    corrections: AnnotationCorrections,
  ): Promise<AnnotationCorrections> {
    const localSave = async () =>
      fetch(`/api/local-analysis/${analysisId}/download/annotation_corrections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corrections),
      });

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/api/annotation-corrections/${analysisId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corrections),
      });
    } catch (error) {
      console.warn("Backend annotation corrections save failed, trying local analysis save:", error);
      response = await localSave();
    }
    if (!response.ok) {
      const localResponse = response.url.includes("/api/local-analysis/")
        ? response
        : await localSave();
      if (localResponse.ok) {
        const result = await localResponse.json();
        this.invalidateReadCaches(analysisId);
        return result.annotation_corrections || {};
      }
      const errorText = await localResponse.text();
      throw new Error(
        `Annotation corrections save failed: ${localResponse.status} ${localResponse.statusText} - ${errorText}`,
      );
    } else if (response.url.includes("/api/local-analysis/")) {
      const result = await response.json();
      this.invalidateReadCaches(analysisId);
      return result.annotation_corrections || {};
    }
    const result = await response.json();
    this.invalidateReadCaches(analysisId);
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
          const status = await this.getStatus(analysisId, { fresh: true });
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

  downloadUrl(url: string, filename?: string): void {
    const a = document.createElement("a");
    a.href = url;
    if (filename) {
      a.download = filename;
    }
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/api/download-project-bundle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn("Backend project bundle failed, trying local project bundle:", error);
      response = await fetch("/api/local-project-bundle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      const localResponse = response.url.includes("/api/local-project-bundle")
        ? response
        : await fetch("/api/local-project-bundle", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
      if (localResponse.ok) {
        return localResponse.blob();
      }
      const errorText = await localResponse.text();
      throw new Error(
        `Project bundle download failed: ${localResponse.status} ${localResponse.statusText} - ${errorText}`,
      );
    }

    return response.blob();
  }

  async prepareProjectBundle(
    payload: Record<string, unknown>,
  ): Promise<{ filename: string; download_url: string }> {
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/api/prepare-project-bundle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return {
        filename: `${String(payload.project_name || "vaa1_project")}_project_bundle.zip`,
        download_url: "/api/local-project-bundle",
      };
    }

    if (!response.ok) {
      return {
        filename: `${String(payload.project_name || "vaa1_project")}_project_bundle.zip`,
        download_url: "/api/local-project-bundle",
      };
    }

    const result = await response.json();
    if (!result?.download_url) {
      throw new Error("Project bundle preparation did not return a download URL");
    }
    return {
      filename: String(result.filename || "vaa1_project_bundle.zip"),
      download_url: String(result.download_url),
    };
  }

  async downloadAndSaveProjectBundle(
    payload: Record<string, unknown>,
    filename?: string,
  ): Promise<void> {
    try {
      const prepared = await this.prepareProjectBundle(payload);
      if (prepared.download_url === "/api/local-project-bundle") {
        const blob = await this.downloadProjectBundle(payload);
        this.downloadBlob(blob, filename || prepared.filename);
        return;
      }
      const downloadUrl = prepared.download_url.startsWith("http")
        ? prepared.download_url
        : `${this.baseURL}${prepared.download_url}`;
      this.downloadUrl(downloadUrl, filename || prepared.filename);
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
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/api/source-media/${analysisId}`);
    } catch {
      response = await fetch(`/api/local-analysis/${analysisId}/download/source_media_metadata_json`);
    }
    if (!response.ok) {
      const localResponse = response.url.includes("/api/local-analysis/")
        ? response
        : await fetch(`/api/local-analysis/${analysisId}/download/source_media_metadata_json`);
      if (!localResponse.ok) {
        const errorText = await localResponse.text();
        throw new Error(
          `Source media metadata fetch failed: ${localResponse.status} ${localResponse.statusText} - ${errorText}`,
        );
      }
      response = localResponse;
    }
    const data = await response.json();
    return data.source_media_metadata || data || {};
  }

  async runStatsKit(
    analysisId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseURL}/api/analysis/${analysisId}/statskit/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `StatsKit run failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
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
      organizations?: string[];
      character_roles?: string[];
      character_definitions?: Array<Record<string, unknown>>;
      narrative_agent_profiles?: Array<Record<string, unknown>>;
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

  async refreshSourceMediaMaturity(
    analysisId: string,
  ): Promise<SourceMediaMetadata> {
    const response = await fetch(
      `${this.baseURL}/api/source-media/${analysisId}/refresh-maturity`,
      { method: "POST" },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Source media maturity refresh failed: ${response.status} ${response.statusText} - ${errorText}`,
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

  async harvestSourceMediaWebMetadata(
    analysisId: string,
    url: string,
  ): Promise<SourceMediaMetadata> {
    const response = await fetch(
      `${this.baseURL}/api/source-media/${analysisId}/web-metadata`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Web metadata harvest failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    return data.source_media_metadata || {};
  }

  async dedupeSourceMediaWebMetadata(
    analysisId: string,
  ): Promise<SourceMediaMetadata> {
    const response = await fetch(
      `${this.baseURL}/api/source-media/${analysisId}/web-metadata/dedupe`,
      { method: "POST" },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Web metadata dedupe failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    return data.source_media_metadata || {};
  }

  async updateSourceMediaWebMetadataPreference(
    analysisId: string,
    sourceId: string,
    preference: "main" | "supporting" | "background",
  ): Promise<SourceMediaMetadata> {
    return this.updateSourceMediaWebMetadataSource(analysisId, sourceId, {
      preference,
    });
  }

  async updateSourceMediaWebMetadataSource(
    analysisId: string,
    sourceId: string,
    payload: {
      preference?: "main" | "supporting" | "background";
      fields?: Record<string, unknown>;
      candidates?: Array<Record<string, unknown>>;
    },
  ): Promise<SourceMediaMetadata> {
    const response = await fetch(
      `${this.baseURL}/api/source-media/${analysisId}/web-metadata/${sourceId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Web metadata source update failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    return data.source_media_metadata || {};
  }

  async deleteSourceMediaWebMetadata(
    analysisId: string,
    sourceId: string,
  ): Promise<SourceMediaMetadata> {
    const response = await fetch(
      `${this.baseURL}/api/source-media/${analysisId}/web-metadata/${sourceId}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Web metadata source delete failed: ${response.status} ${response.statusText} - ${errorText}`,
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

  async resolveSourceClock(
    analysisId: string,
    payload: {
      candidates: CanonicalSourceClockScope[];
      dependents?: Array<Record<string, unknown>>;
      apply_invalidation?: boolean;
      authority?: string;
    },
  ): Promise<SourceClockResolution> {
    const response = await fetch(`${this.baseURL}/api/analysis/${analysisId}/source-clock/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Source-clock resolution failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    return response.json();
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
        const localResponse = await fetch(`/api/local-analyses?limit=${limit}`);
        if (localResponse.ok) {
          return localResponse.json();
        }
        // For development, fall back to mock
        if (!this.useMock) return this.getMockAnalyses(limit);
        throw new Error(
          `Failed to list analyses: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.json();
      console.log("Got analyses:", Object.keys(result.analyses || {}).length);
      return result;
    } catch (error) {
      console.warn("List analyses failed, using local fallback:", error);
      const localResponse = await fetch(`/api/local-analyses?limit=${limit}`);
      if (localResponse.ok) {
        return localResponse.json();
      }
      if (this.useMock) return this.getMockAnalyses(limit);
      return { analyses: {} };
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

  async getAiAgentFeatureStarters(): Promise<AiAgentFeatureStarterManifest> {
    const response = await fetch(`${this.baseURL}/api/ai-agent/feature-starters`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `AI Agent feature starters fetch failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async writeAiAgentFeatureStarters(): Promise<AiAgentFeatureStarterWriteResponse> {
    const response = await fetch(`${this.baseURL}/api/ai-agent/feature-starters/write`, {
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `AI Agent feature starters write failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async writeAiAgentSceneCardReportDraft(
    analysisId: string,
  ): Promise<AiAgentSceneCardReportDraftResponse> {
    const response = await fetch(
      `${this.baseURL}/api/ai-agent/${analysisId}/scene-card-report-draft`,
      { method: "POST" },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Scene card report draft failed: ${response.status} ${response.statusText} - ${errorText}`,
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
      "audio_sample_clouds",
      "identity_triangulation",
      "dependency_sfl_stage1",
      "multimodal_meaning_stage1",
      "second_order_label_proliferation",
      "narrative_lens_reading",
      "character_path_reading",
      "datascene_meaning_network",
      "mise_en_scene_scene_cards",
      "mise_en_scene_scene_card_report_draft_md",
      "source_extraction_metadata_summary",
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
      audio_sample_clouds: "Audio Sample Clouds (JSON)",
      identity_triangulation: "Narrative Agent Triangulation Bundle (JSON)",
      dependency_sfl_stage1: "Dependency + SFL Stage 1 (JSON)",
      multimodal_meaning_stage1: "Multimodal Meaning Stage 1 (JSON)",
      second_order_label_proliferation: "Second-Order Label Proliferation (JSON)",
      narrative_lens_reading: "Narrative Lens Readings (JSON)",
      character_path_reading: "Character Path Readings (JSON)",
      datascene_meaning_network: "Datascene Meaning Network (JSON)",
      mise_en_scene_scene_cards: "Mise-en-Scene Scene Card Report (JSON)",
      mise_en_scene_scene_card_report_draft_md: "Scene Card Report Draft (Markdown)",
      source_extraction_metadata_summary:
        "Scene Card Source Extraction Metadata Summary (JSON)",
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
      audio_sample_clouds: ".json",
      identity_triangulation: ".json",
      dependency_sfl_stage1: ".json",
      multimodal_meaning_stage1: ".json",
      second_order_label_proliferation: ".json",
      narrative_lens_reading: ".json",
      character_path_reading: ".json",
      datascene_meaning_network: ".json",
      mise_en_scene_scene_cards: ".json",
      mise_en_scene_scene_card_report_draft_md: ".md",
      source_extraction_metadata_summary: ".json",
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
