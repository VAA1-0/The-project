// src/frontend/lib/video-service.ts

/**
 * Video Service (Business Logic Layer)
 *
 * This service acts as the primary business logic layer for the frontend application.
 * It is responsible for orchestrating data flow and managing the application state
 * related to video analysis.
 *
 * Its responsibilities include:
 * - Using `apiService` to fetch raw data from the backend.
 * - Transforming, normalizing, and enriching the raw API data into a format
 *   that is easy for UI components to consume.
 * - Applying annotation corrections and other business rules to the data.
 * - Providing a clean, high-level interface for UI components to interact with.
 *
 * All application-specific data manipulation and business logic should reside here,
 * not in the UI components or the low-level `apiService`.
 */

import { apiService } from "./api-service";
import type {
  AnalysisEvent,
  AnalysisStartOptions,
  AnnotationCorrections,
  AnnotationCorrectionRule,
  AudioDiarizationScaffold,
  ForensicRenderJob,
  EvidenceProliferationMatchSummary,
  IdentityRefinementStatus,
  AgentPersistenceLabel,
  SecondOrderLabelProliferationPlan,
  ManualVisualAnnotation,
  ManualTranscriptEntry,
  SourceMediaMetadata,
  SourceSample,
} from "./api-service";
import { DROP_CORRECTION_VALUE } from "./annotation-corrections";
import { hasExpressionSourceEvidence } from "./expression-weighting";
import {
  applyTranscriptClockOffset,
  normalizeTranscriptSegmentTiming,
} from "./transcript-time";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

// Type Definitions
export interface VideoMetadata {
  id: string;
  name: string;
  tag?: string | null;
  length?: number;
  size?: number;
  status:
    | "uploaded"
    | "processing"
    | "completed"
    | "error"
    | "pending"
    | "synced"
    | "failed";
  progress: number;
  error?: string;
  missionStage?: string;
  missionMessage?: string;
  uploadedAt?: string;
  analysisStartedAt?: string;
  analysisCompletedAt?: string;
  processingTime?: number;
  pipelineType?: "full" | "visual_only" | "audio_only";
  analysisTier?: string;
  modalityFocus?: string;
  languagePackPolicy?: {
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
  applyFaceAnonymization?: boolean;
  faceMessageStyle?: "plain" | "starfleet";
  faceRequiresPersonDetection?: boolean;
  cvatID?: number;
  eventLog?: AnalysisEvent[];
  sourceVideoPath?: string;
  sourceVideoExists?: boolean;
  sourceVideoMessage?: string;
}

export type SourceAnnotationContext = {
  genre?: string;
  genre_subtype?: string;
  situational_genre?: string;
  situational_subtype?: string;
};

export interface TranscriptSegment {
  t: string; // Formatted timestamp like "12.5s"
  text: string;
  rawText?: string;
  speaker: string;
  speakerConfirmation?: string;
  start: number; // Raw start time in seconds
  end: number; // Raw end time in seconds
  sourceStart?: number;
  sourceEnd?: number;
  segmentType?: string;
  synthetic?: boolean;
  timingStatus?: string;
  timingAuthority?: string;
  timingSource?: string;
  sourceTimingStatus?: string;
  sourceTimeValid?: boolean;
  status?: "confirmed" | "unconfirmed";
  correctionSource?: "transcript" | "manual";
  targetId?: string;
}

export interface TranscriptDataBundle {
  segments: TranscriptSegment[];
  timelineSegments?: TranscriptSegment[];
  quality?: {
    status?: string;
    segment_count?: number;
    last_segment_end_seconds?: number;
    media_duration_seconds?: number | null;
    audio_duration_seconds?: number | null;
    coverage_target_seconds?: number | null;
    coverage_ratio?: number;
    trailing_uncovered_seconds?: number;
    thresholds?: {
      warn_gap_seconds?: number;
      warn_gap_ratio?: number;
    };
    reasons?: string[];
  };
  languageProfile?: {
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
}

export interface DetectedObject {
  timestamp: number;
  class_id: number;
  class_name: string;
  raw_class_name?: string;
  confidence: number;
  bbox?: {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  };
  startTimestamp?: number;
  endTimestamp?: number;
  occurrenceCount?: number;
  trackId?: number;
  displayLabel?: string;
  demographicSummary?: {
    ageBand?: string;
    genderPresentation?: string;
    confidenceScore?: number;
    confidenceLabel?: string;
    evidenceSamples?: number;
    note?: string;
    audioSupport?: {
      overlappingSegments: number;
      label: string;
    };
  };
  screenPresenceProfile?: {
    tier: "primary" | "secondary" | "background";
    profileId: string;
    dominanceScore: number;
    rank: number;
    cues: string[];
  };
  sourceType?: "automated" | "manual_visual";
  sourceAnnotationId?: string;
  identityAffirmation?: string;
  roleAffirmation?: string;
  audioFoleyNote?: string;
  openNote?: string;
  teachesRegime?: boolean;
  annotationCategory?: ManualVisualAnnotation["category"];
  annotationSubcategory?: string;
  customLabel?: string;
  metadataCorrelation?: ManualVisualAnnotation["metadata_correlation"];
}

export interface OCR {
  timestamp: number;
  text: string;
  rawText?: string;
  confidence: number;
  bbox?: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  };
}

export interface ExpressionSample {
  timestamp: number;
  frame_index?: number;
  face_id?: number;
  dominant_emotion?: string | null;
  rawDominantEmotion?: string | null;
  emotion?: Record<string, number> | null;
  top_emotion_score?: number | null;
  score_margin?: number | null;
  quality?: string | null;
  face_signal?: {
    level?: string | null;
    face_count_in_frame?: number | null;
    face_area_share?: number | null;
  };
  expression_evidence?: {
    level?: string | null;
    dominant_emotion_ready?: boolean;
    top_score?: number | null;
    score_margin?: number | null;
  };
  affect_hints?: {
    valence?: string | null;
    activation?: string | null;
    confidence?: string | null;
  };
  social_function_profile?: {
    authority_signal?: number | null;
    affiliation_signal?: number | null;
    persuasion_signal?: number | null;
    distance_signal?: number | null;
    reassurance_signal?: number | null;
  };
  interpreted_expression?: {
    label?: string | null;
    confidence?: string | null;
    near_neighbors?: string[];
    social_function?: string[];
    basis?: string[];
  };
  error?: string | null;
  bbox?: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  };
}

export interface AudioProsodyCue {
  cue_id: string;
  start: number;
  end: number;
  text: string;
  word_count?: number;
  pace?: {
    words_per_second?: number;
    label?: string;
  };
  pauses?: {
    before_seconds?: number;
    after_seconds?: number;
    before_label?: string;
    after_label?: string;
  };
  turn_structure?: {
    gap_before_seconds?: number;
    transition?: string;
    likely_turn_boundary?: boolean;
    overlap_seconds?: number;
    overlap_cue?: boolean;
  };
  interaction_cues?: {
    run_length?: number;
    run_position?: number;
    role_support?: string;
  };
  rhythm_profile?: {
    label?: string;
  };
  tonality_profile?: {
    label?: string;
  };
  emphasis?: {
    score?: number;
    label?: string;
  };
  pitch_energy_contour?: {
    pitch_hz?: number | null;
    energy_rms?: number;
    energy_dbfs?: number | null;
    label?: string;
  };
  sound_environment?: {
    label?: string;
    zero_crossing_rate?: number;
    spectral_variation?: number;
  };
  confirmedSpeaker?: string;
  confirmedAudioSourceClass?: string;
  speakerAssignmentRefs?: string[];
  speakerAssignmentAuthority?: "explicit_user_confirmation";
  narrativeAgentProsody?: boolean;
  assignmentConflict?: boolean;
  multimodalMotorTargets?: string[];
}

export type MatureEvidenceAuthority =
  | "manual_correction"
  | "manual_annotation"
  | "mature_triangulated"
  | "interpreted_detection"
  | "raw_detection";

export interface MasterSchemaResolvedEvidenceRecord {
  id: string;
  category:
    | "transcript"
    | "object"
    | "ocr"
    | "expression"
    | "manual_annotation"
    | "identity"
    | "narrative_agent_profile"
    | "character_role"
    | "proliferation_match"
    | "second_order"
    | "audio_event"
    | "shot_boundary"
    | "music_analysis"
    | "lyric_match"
    | "speaker_diarization"
    | "speaker_assignment"
    | "speaker_audio_profile_candidate"
    | "narrative_agent_prosody"
    | "audio_source_prosody"
    | "organization"
    | "place"
    | "scene_card";
  label: string;
  authority: MatureEvidenceAuthority;
  sourcePanel: string;
  start?: number;
  end?: number;
  rawLabel?: string;
  targetId?: string;
  maturityRoute?: string;
  mappingStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface MasterSchemaResolvedEvidenceView {
  authorityOrder: MatureEvidenceAuthority[];
  records: MasterSchemaResolvedEvidenceRecord[];
  counts: Record<MatureEvidenceAuthority, number>;
  updatedAt?: string;
  rawArtifactsPreserved: boolean;
}

export type DatasceneEntityType =
  | "PERSON_NAME"
  | "NARRATIVE_AGENT"
  | "ORG"
  | "PLACE"
  | "EVENT"
  | "DATE"
  | "LAW_POLICY"
  | "CONCEPT"
  | "OBJECT"
  | "VISUAL_SYMBOL"
  | "AUDIO_ENTITY"
  | "AUDIOVISUAL_NARRATIVE_AGENT"
  | "COLLECTION_ENTITY"
  | "SOURCE_MEDIA_ENTITY";

export type DatasceneEntityMaturity =
  | "raw"
  | "candidate"
  | "corroborated"
  | "mature"
  | "rejected"
  | "superseded";

export type DatasceneEntityAuthorityStatus =
  | "single_model_detected"
  | "multi_source_corroborated"
  | "metadata_authoritative"
  | "manual_confirmed"
  | "manual_corrected"
  | "manual_rejected"
  | "superseded";

export type DatasceneEntitySourceType =
  | "transcript"
  | "ocr"
  | "annotation"
  | "metadata"
  | "object_detection"
  | "visual_sample_cloud"
  | "audio_sample_cloud"
  | "audiovisual_narrative_agent_sample"
  | "mature_data_bus";

export interface DatasceneEntityMention {
  mention_id: string;
  source_type: DatasceneEntitySourceType;
  start_time: number;
  end_time: number;
  confidence: number;
  evidence_ref: string;
  text?: string;
  label?: string;
  detected_class?: string;
  track_id?: string;
  sample_id?: string;
  annotation_id?: string;
  metadata_field?: string;
  bbox?: [number, number, number, number];
  authority_status?: DatasceneEntityAuthorityStatus;
  traceback_ref?: string;
}

export interface DatasceneEntityRegistryRecord {
  entity_id: string;
  analysis_id: string;
  canonical_name: string;
  entity_type: DatasceneEntityType;
  aliases: string[];
  maturity: DatasceneEntityMaturity;
  authority_status: DatasceneEntityAuthorityStatus;
  confidence: number;
  source_mentions: DatasceneEntityMention[];
  linked_object_tracks: string[];
  linked_ocr_mentions: string[];
  linked_metadata_fields: string[];
  sample_cloud_refs: string[];
  traceback_refs: string[];
  proliferation_policy: {
    can_proliferate: boolean;
    requires_manual_review: boolean;
    allowed_targets: string[];
    blocked_actions: string[];
  };
}

export interface DatasceneEntityRegistryView {
  schema: "vaa1.datascene_entity_registry.v1";
  analysis_id: string;
  entities: DatasceneEntityRegistryRecord[];
  source_counts: Record<DatasceneEntitySourceType, number>;
  governance_rules: {
    manual_correction_wins: true;
    manual_confirmation_wins: true;
    raw_detection_never_overrides_mature_entity: true;
    track_identity_must_not_equal_narrative_agent_without_confirmation: true;
    analysis_scoped_records_must_not_bleed_to_other_videos: true;
  };
}

export interface DatasceneContentSearchIndexRecord {
  index_id: string;
  analysis_id: string;
  canonical_entity_id: string;
  canonical_name: string;
  entity_type: DatasceneEntityType;
  start_time: number;
  end_time: number;
  searchable_text: string;
  searchable_keywords: string[];
  sources: Array<{
    source_type: DatasceneEntitySourceType;
    source_id: string;
    match_text?: string;
    detected_class?: string;
    track_id?: string;
    start_time: number;
    end_time: number;
    confidence: number;
    maturity: DatasceneEntityMaturity;
    authority_status: DatasceneEntityAuthorityStatus;
    evidence_ref: string;
    traceback_ref?: string;
  }>;
  maturity_summary: {
    highest_maturity: DatasceneEntityMaturity;
    has_manual_confirmation: boolean;
    has_multi_source_support: boolean;
    requires_review: boolean;
  };
  forensic_render_available: boolean;
  entity_card_available: boolean;
  search_surface?: "entity" | "mature_data" | "confirmable_cluster";
  confidence_percent?: number;
  cluster_summary?: {
    cluster_key: string;
    candidate_count: number;
    propagation_state: string;
    promotion_requires_decision: boolean;
  };
}

export interface DatasceneContentSearchView {
  schema: "vaa1.datascene_content_search.v1";
  analysis_id: string;
  source_switchboard: Record<string, boolean>;
  search_index_records: DatasceneContentSearchIndexRecord[];
  governance_rules: {
    manual_correction_wins: true;
    search_does_not_overwrite_data: true;
    candidate_results_must_be_marked_as_candidate: true;
    object_track_identity_must_not_equal_narrative_agent_without_confirmation: true;
    analysis_scoped_records_must_not_bleed_to_other_videos: true;
  };
  som_open_topology_boundary: {
    status: "diagnostic_scanner_matcher_only";
    can_suggest: true;
    can_cluster: true;
    can_surface_near_matches: true;
    can_create_review_candidates: true;
    can_override_master_schema: false;
    can_mark_mature_without_decision: false;
    required_outputs: string[];
  };
}

export interface MasterSchemaMaturityAudit {
  audit_schema?: string;
  updated_at?: string;
  principle?: string;
  user_confirmed_anchor?: {
    principle?: string;
    authority_priority?: string[];
    anchor_surfaces?: Array<{
      surface?: string;
      status?: string;
      route?: string;
    }>;
  };
  confirmation_program?: {
    purpose?: string;
    confirmation_mode?: string;
    confirmation_families?: string[];
    consults_user_confirmed_anchor?: boolean;
    proliferation_rule?: string;
  };
  next_required_hardening?: string[];
}

type LooseRecord = Record<string, unknown>;

type NativeAnnotationRecord = {
  id?: string;
  category?: string;
  custom_label?: string;
  label?: string;
  identity_affirmation?: string;
  role_affirmation?: string;
  open_note?: string;
  start_seconds?: number;
  end_seconds?: number;
  timestamp_seconds?: number;
  metadata_correlation?: {
    target_id?: string | number;
    target_type?: string;
    target_label?: string;
  } | null;
};

type IdentityResolvedCandidate = {
  candidate_id?: string;
  candidate_label?: string;
  promoted_identity?: string;
  review_state?: string;
  evidence?: {
    time_start?: number;
    time_end?: number;
  };
};

function normalizeAudioProsodyCue(cue: any): AudioProsodyCue {
  const turnStructure = cue?.turn_structure || {};
  const interactionCues = cue?.interaction_cues || {};
  const soundEnvironment = cue?.sound_environment || {};

  const fallbackRoleSupport =
    interactionCues.role_support ||
    (turnStructure.overlap_cue
      ? "possible interruption"
      : turnStructure.likely_turn_boundary
        ? "turn reset"
        : "continuing delivery");

  const fallbackEnvironment =
    soundEnvironment.label ||
    (cue?.pitch_energy_contour?.label?.includes("high energy")
      ? "foreground speech"
      : "ambient sound");

  return {
    ...cue,
    turn_structure: {
      ...turnStructure,
      overlap_seconds: turnStructure.overlap_seconds ?? 0,
      overlap_cue: Boolean(turnStructure.overlap_cue),
    },
    interaction_cues: {
      ...interactionCues,
      role_support: fallbackRoleSupport,
    },
    rhythm_profile: {
      ...(cue?.rhythm_profile || {}),
      label:
        cue?.rhythm_profile?.label ||
        (cue?.pace?.label === "rapid" ? "quick flow" : "even flow"),
    },
    tonality_profile: {
      ...(cue?.tonality_profile || {}),
      label:
        cue?.tonality_profile?.label ||
        (cue?.pitch_energy_contour?.label?.includes("higher")
          ? "animated delivery"
          : "steady delivery"),
    },
    sound_environment: {
      ...soundEnvironment,
      label: fallbackEnvironment,
    },
  };
}

function normalizeCorrectionValue(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function applyTextSubstitutions(
  value: string,
  rules: AnnotationCorrectionRule[] = [],
): string {
  let nextValue = String(value || "");
  const orderedRules = [...rules].sort((left, right) => {
    const leftRaw = String(left?.raw_value || "").trim();
    const rightRaw = String(right?.raw_value || "").trim();
    return rightRaw.length - leftRaw.length;
  });
  for (const rule of orderedRules) {
    const raw = String(rule?.raw_value || "").trim();
    const corrected = String(rule?.corrected_value || "").trim();
    if (!raw || !corrected) {
      continue;
    }
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isPhraseRule = /\s/.test(raw);
    const pattern = isPhraseRule
      ? new RegExp(escaped, "giu")
      : new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "giu");
    if (corrected === DROP_CORRECTION_VALUE) {
      nextValue = nextValue.replace(pattern, "");
      continue;
    }
    nextValue = nextValue.replace(pattern, corrected);
  }
  return nextValue.replace(/\s{2,}/g, " ").trim();
}

function applyLabelOverride(
  value: string,
  modality: AnnotationCorrectionRule["modality"],
  rules: AnnotationCorrectionRule[] = [],
  context?: {
    timestamp?: number | null;
    startTimestamp?: number | null;
    endTimestamp?: number | null;
    trackId?: number | null;
  },
): string {
  const isDropValue = (value?: string | null) =>
    String(value || "").trim() === DROP_CORRECTION_VALUE;
  const normalized = normalizeCorrectionValue(value);
  const matched = [...rules]
    .filter(
      (rule) =>
        rule.modality === modality &&
        normalizeCorrectionValue(rule.raw_value) === normalized &&
        String(rule.corrected_value || "").trim(),
    )
    .sort((left, right) => {
      const leftScoped = left.target_timestamp !== undefined ? 1 : 0;
      const rightScoped = right.target_timestamp !== undefined ? 1 : 0;
      return rightScoped - leftScoped;
    })
    .find((rule) => {
      if (
        rule.target_track_id !== undefined &&
        (context?.trackId === undefined ||
          context?.trackId === null ||
          Number(rule.target_track_id) !== Number(context.trackId))
      ) {
        return false;
      }
      if (
        rule.target_start_timestamp !== undefined ||
        rule.target_end_timestamp !== undefined
      ) {
        const start = context?.startTimestamp ?? context?.timestamp;
        const end = context?.endTimestamp ?? context?.timestamp;
        if (start === undefined || start === null || end === undefined || end === null) {
          return false;
        }
        const lower =
          rule.target_start_timestamp !== undefined
            ? Number(rule.target_start_timestamp)
            : Number.NEGATIVE_INFINITY;
        const upper =
          rule.target_end_timestamp !== undefined
            ? Number(rule.target_end_timestamp)
            : Number.POSITIVE_INFINITY;
        return Number(end) >= lower && Number(start) <= upper;
      }
      if (rule.target_timestamp === undefined) {
        return true;
      }
      if (context?.timestamp === undefined || context?.timestamp === null) {
        return false;
      }
      return Math.abs(Number(rule.target_timestamp) - Number(context.timestamp)) <= 0.001;
    });
  return matched && !isDropValue(matched.corrected_value)
    ? String(matched.corrected_value).trim()
    : value;
}

function isDetectionDropped(
  value: string,
  modality: AnnotationCorrectionRule["modality"],
  rules: AnnotationCorrectionRule[] = [],
  context?: {
    timestamp?: number | null;
    startTimestamp?: number | null;
    endTimestamp?: number | null;
    trackId?: number | null;
  },
): boolean {
  const normalized = normalizeCorrectionValue(value);
  const matched = [...rules]
    .filter(
      (rule) =>
        rule.modality === modality &&
        normalizeCorrectionValue(rule.raw_value) === normalized &&
        String(rule.corrected_value || "").trim() === DROP_CORRECTION_VALUE,
    )
    .sort((left, right) => {
      const leftScoped = left.target_timestamp !== undefined ? 1 : 0;
      const rightScoped = right.target_timestamp !== undefined ? 1 : 0;
      return rightScoped - leftScoped;
    })
    .find((rule) => {
      if (
        rule.target_track_id !== undefined &&
        (context?.trackId === undefined ||
          context?.trackId === null ||
          Number(rule.target_track_id) !== Number(context.trackId))
      ) {
        return false;
      }
      if (
        rule.target_start_timestamp !== undefined ||
        rule.target_end_timestamp !== undefined
      ) {
        const start = context?.startTimestamp ?? context?.timestamp;
        const end = context?.endTimestamp ?? context?.timestamp;
        if (start === undefined || start === null || end === undefined || end === null) {
          return false;
        }
        const lower =
          rule.target_start_timestamp !== undefined
            ? Number(rule.target_start_timestamp)
            : Number.NEGATIVE_INFINITY;
        const upper =
          rule.target_end_timestamp !== undefined
            ? Number(rule.target_end_timestamp)
            : Number.POSITIVE_INFINITY;
        return Number(end) >= lower && Number(start) <= upper;
      }
      if (rule.target_timestamp === undefined) {
        return true;
      }
      if (context?.timestamp === undefined || context?.timestamp === null) {
        return false;
      }
      return Math.abs(Number(rule.target_timestamp) - Number(context.timestamp)) <= 0.001;
    });
  return Boolean(matched);
}

function applyAnnotationCorrectionsToTranscript(
  transcript: TranscriptSegment[],
  corrections?: AnnotationCorrections | null,
): TranscriptSegment[] {
  const textRules = corrections?.text_substitutions || [];
  const transcriptClockOffset = shouldApplyTranscriptClockOffset(transcript)
    ? Number(corrections?.transcript_clock_offset_seconds || 0)
    : 0;
  const correctedBase = transcript.map((segment) => {
    const baseText = String(segment.text || "").trim();
    const normalizedEmpty =
      baseText.length > 0 ? baseText : segment.status === "unconfirmed" ? "Unconfirmed" : "";
    const shiftedSegment = applyTranscriptClockOffset(segment, transcriptClockOffset);
    const sourceStart = Number(segment.start ?? 0);
    const sourceEnd = Number(segment.end ?? segment.start ?? 0);
    const spanRule = [...textRules].reverse().find((rule) => {
      if (
        rule.modality !== "text" ||
        normalizeCorrectionValue(rule.raw_value) !== normalizeCorrectionValue(baseText) ||
        (
          rule.corrected_start_timestamp === undefined &&
          rule.corrected_end_timestamp === undefined &&
          !rule.speaker_confirmation
        )
      ) {
        return false;
      }
      const targetStart = Number(rule.target_start_timestamp ?? sourceStart);
      const targetEnd = Number(rule.target_end_timestamp ?? sourceEnd);
      return Math.abs(targetStart - sourceStart) <= 0.01 && Math.abs(targetEnd - sourceEnd) <= 0.01;
    });
    const correctedStart = spanRule?.corrected_start_timestamp;
    const correctedEnd = spanRule?.corrected_end_timestamp;
    const hasCorrectedSpan = correctedStart !== undefined || correctedEnd !== undefined;
    const nextStart = hasCorrectedSpan
      ? Math.max(0, Number(correctedStart ?? shiftedSegment.start ?? sourceStart))
      : shiftedSegment.start;
    const nextEnd = hasCorrectedSpan
      ? Math.max(nextStart, Number(correctedEnd ?? shiftedSegment.end ?? sourceEnd))
      : shiftedSegment.end;
    return {
      ...segment,
      ...shiftedSegment,
      start: nextStart,
      end: nextEnd,
      t: hasCorrectedSpan ? `${Number(nextStart).toFixed(1)}s` : shiftedSegment.t,
      rawText: segment.rawText || segment.text,
      text: spanRule
        ? String(spanRule.corrected_value || normalizedEmpty).trim()
        : applyTextSubstitutions(normalizedEmpty, textRules),
      speaker: spanRule?.speaker_confirmation || segment.speaker,
      speakerConfirmation: spanRule?.speaker_confirmation,
      status: segment.status || (normalizedEmpty ? "confirmed" : "unconfirmed"),
      correctionSource: spanRule ? "manual" : segment.correctionSource || "transcript",
      timingStatus: spanRule ? "manual_correction" : segment.timingStatus,
      timingAuthority: spanRule ? "manual_correction" : segment.timingAuthority,
      sourceTimeValid: spanRule ? true : segment.sourceTimeValid,
    };
  });

  const manualEntries = (corrections?.manual_transcript_entries || []).map(
    (entry: ManualTranscriptEntry): TranscriptSegment => {
      const manualText = String(entry.text || "").trim();
      const status = entry.status || (manualText ? "confirmed" : "unconfirmed");
      const normalizedText = manualText || "Unconfirmed";
      return {
        t: `${Number(entry.start || 0).toFixed(1)}s`,
        text: applyTextSubstitutions(normalizedText, textRules),
        rawText: normalizedText,
        speaker: entry.speaker_confirmation || "Analyst note",
        speakerConfirmation: entry.speaker_confirmation,
        start: Number(entry.start || 0),
        end: Number(entry.end ?? entry.start ?? 0),
        segmentType: "manual_entry",
        synthetic: false,
        status,
        correctionSource: "manual",
        targetId: entry.id,
      };
    },
  );

  return [...correctedBase, ...manualEntries].sort((left, right) => {
    const startDelta = Number(left.start || 0) - Number(right.start || 0);
    if (startDelta !== 0) {
      return startDelta;
    }
    return Number(left.end || 0) - Number(right.end || 0);
  });
}

function segmentHasRepairedTimingAuthority(segment: TranscriptSegment): boolean {
  const status = String(segment.timingStatus || segment.sourceTimingStatus || "").trim();
  const authority = String(segment.timingAuthority || "").trim();
  const sourceTimeValid = (segment as any).sourceTimeValid;
  if (
    [
      "automatic_transcript_timestamp",
      "inherited_after_vad_anchor",
      "needs_per_line_sync",
    ].includes(status) ||
    [
      "quick_sweep_transcript",
      "quick_sweep_transcript_priority",
      "chunked_fallback",
      "tail_recovery_fallback",
      "fallback_candidate",
      "scaffold",
      "text_only_no_source_timing",
    ].includes(authority)
  ) {
    return false;
  }
  if (authority === "manual_correction") {
    return sourceTimeValid !== false || status === "manual_correction";
  }
  if (
    authority === "original_whisper_timecode" ||
    authority === "full_pass" ||
    status === "original_whisper_timecode"
  ) {
    return true;
  }
  return [
    "manual_correction",
    "original_whisper_timecode",
  ].includes(status);
}

function shouldApplyTranscriptClockOffset(transcript: TranscriptSegment[]): boolean {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return true;
  }
  return !transcript.some(segmentHasRepairedTimingAuthority);
}

function rawTranscriptPayloadHasTimingAuthority(payload: any): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (rawTranscriptPayloadLooksLikeScaffold(payload)) {
    return false;
  }
  const authorityPayload = payload.timing_authority;
  if (
    authorityPayload &&
    typeof authorityPayload === "object" &&
    ["original_whisper_timecode", "manual_correction"].includes(
      String(authorityPayload.operational_authority || ""),
    )
  ) {
    return true;
  }
  const timingRepair = payload.timing_repair;
  if (
    timingRepair &&
    typeof timingRepair === "object" &&
    timingRepair.strategy === "original_whisper_timecode"
  ) {
    return true;
  }
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  return segments.some((segment: any) => {
    if (!segment || typeof segment !== "object") {
      return false;
    }
    const authority = String(segment.timing_authority || segment.timingAuthority || "");
    const status = String(segment.timing_status || segment.timingStatus || "");
    const sourceTimeValid = segment.source_time_valid ?? segment.sourceTimeValid;
    if (
      [
        "automatic_transcript_timestamp",
        "inherited_after_vad_anchor",
        "needs_per_line_sync",
      ].includes(status) ||
      [
        "quick_sweep_transcript",
        "quick_sweep_transcript_priority",
        "chunked_fallback",
        "tail_recovery_fallback",
        "fallback_candidate",
        "scaffold",
        "text_only_no_source_timing",
      ].includes(authority)
    ) {
      return false;
    }
    if (authority === "manual_correction") {
      return sourceTimeValid !== false || status === "manual_correction";
    }
    return (
      authority === "original_whisper_timecode" ||
      authority === "full_pass" ||
      [
        "manual_correction",
        "original_whisper_timecode",
      ].includes(status)
    );
  });
}

function normalizeTextForClockMatch(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isManualTranscriptClockRow(segment: any): boolean {
  const authority = String(segment?.timing_authority || segment?.timingAuthority || "");
  const source = String(segment?.timing_source || segment?.timingSource || "");
  const status = String(segment?.timing_status || segment?.timingStatus || "");
  return (
    authority === "manual_correction" ||
    status === "manual_correction" ||
    source.startsWith("annotation_corrections.")
  );
}

function transcriptRowHasCandidateOnlyTiming(segment: any): boolean {
  const status = String(segment?.timing_status || segment?.timingStatus || "");
  const authority = String(segment?.timing_authority || segment?.timingAuthority || "");
  const source = String(segment?.timing_source || segment?.timingSource || "");
  const sourceTimeValid = segment?.source_time_valid ?? segment?.sourceTimeValid;
  return (
    sourceTimeValid === false ||
    [
      "automatic_transcript_timestamp",
      "inherited_after_vad_anchor",
      "needs_per_line_sync",
    ].includes(status) ||
    [
      "quick_sweep_transcript",
      "quick_sweep_transcript_priority",
      "chunked_fallback",
      "tail_recovery_fallback",
      "fallback_candidate",
      "scaffold",
      "text_only_no_source_timing",
    ].includes(authority) ||
    /chunked|fallback|scaffold|quick_sweep/i.test(source)
  );
}

function buildWhisperClockPayloadWithMatureAnnotations(payload: any): any {
  const rawWhisperSegments = Array.isArray(payload?.raw_whisper_segments)
    ? payload.raw_whisper_segments
    : Array.isArray(payload?.original_whisper_segments)
      ? payload.original_whisper_segments
      : Array.isArray(payload?.whisper_timecode_segments)
        ? payload.whisper_timecode_segments
        : [];
  const candidateSegments = rawWhisperSegments.filter((segment: any) => {
    const authority = String(segment?.timing_authority || segment?.timingAuthority || "");
    const status = String(segment?.timing_status || segment?.timingStatus || "");
    return (
      authority === "original_whisper_timecode" ||
      authority === "full_pass" ||
      status === "original_whisper_timecode" ||
      Array.isArray(segment?.words)
    );
  });
  const matureSegments = Array.isArray(payload?.segments) ? payload.segments : [];
  if (!candidateSegments.length || !matureSegments.length) {
    return payload;
  }

  const candidatePool = candidateSegments
    .map((segment: any, index: number) => ({
      ...segment,
      __clockIndex: index,
      __clockText: normalizeTextForClockMatch(segment?.text),
      __clockStart: Number(segment?.start ?? 0),
    }))
    .filter((segment: any) => segment.__clockText);
  const usedCandidateIndexes = new Set<number>();

  const mergedSegments = matureSegments.map((segment: any) => {
    if (isManualTranscriptClockRow(segment)) {
      return {
        ...segment,
        timing_authority: "manual_correction",
        source_time_valid: true,
      };
    }
    const text = normalizeTextForClockMatch(segment?.text);
    const currentStart = Number(segment?.start ?? 0);
    const candidates = candidatePool.filter(
      (candidate: any) =>
        candidate.__clockText === text && !usedCandidateIndexes.has(candidate.__clockIndex),
    );
    const best = candidates.sort(
      (left: any, right: any) =>
        Math.abs(left.__clockStart - currentStart) -
        Math.abs(right.__clockStart - currentStart),
    )[0];
    if (!best) {
      return segment;
    }
    usedCandidateIndexes.add(best.__clockIndex);
    const { __clockIndex, __clockText, __clockStart, ...clockSegment } = best;
    return {
      ...segment,
      start: clockSegment.start,
      end: clockSegment.end,
      source_start: clockSegment.start,
      source_end: clockSegment.end,
      timing_status: "original_whisper_timecode",
      timing_authority: "original_whisper_timecode",
      timing_source: "whisper_timecode",
      source_time_valid: true,
    };
  });

  return {
    ...payload,
    segments: mergedSegments,
    timeline_segments: undefined,
    transcription_strategy: "quick_sweep_transcript_priority",
    timing_authority: {
      ...(payload.timing_authority || {}),
      operational_authority: "original_whisper_timecode",
      matured_annotation_policy: "matured_annotations_layered_over_whisper_clock",
      manual_correction_policy: "manual_corrections_override_whisper_clock",
      vad_policy: "auxiliary_only_not_transcript_clock",
      source_time_operational: true,
    },
  };
}

function rawTranscriptPayloadLooksLikeScaffold(payload: any): boolean {
  const segments = Array.isArray(payload?.segments) ? payload.segments : [];
  if (segments.length < 4) {
    return false;
  }
  const firstStarts = segments.slice(0, 4).map((segment: any) => Number(segment?.start));
  return firstStarts.every(
    (value: number, index: number) =>
      Number.isFinite(value) && Math.abs(value - index * 2) <= 0.01,
  );
}

function transcriptQualityForDisplay(
  transcriptData: PromiseSettledResult<TranscriptDataBundle>,
  status: AnalysisStatus,
): TranscriptDataBundle["quality"] | undefined {
  if (transcriptData.status === "fulfilled" && transcriptData.value.quality) {
    return transcriptData.value.quality;
  }
  const repairState = status.transcript_timing_repair;
  const repairQuality =
    repairState?.quality_after || repairState?.quality_before || repairState?.quality;
  return repairQuality as TranscriptDataBundle["quality"] | undefined;
}

function transcriptTimingRepairCacheKey(status: AnalysisStatus): string {
  const repairState = status.transcript_timing_repair || {};
  return JSON.stringify({
    status: repairState.status || null,
    reason: repairState.reason || null,
    backupPath: repairState.backup_path || null,
    qualityAfter: repairState.quality_after || null,
    quality: repairState.quality || null,
  });
}

function applyTranscriptClockOffsetToAudioProsody(
  cues: AudioProsodyCue[],
  corrections?: AnnotationCorrections | null,
  transcript: TranscriptSegment[] = [],
): AudioProsodyCue[] {
  if (!shouldApplyTranscriptClockOffset(transcript)) {
    return cues;
  }
  const offset = Number(corrections?.transcript_clock_offset_seconds || 0);
  if (!Number.isFinite(offset) || offset === 0) {
    return cues;
  }
  return cues.map((cue) => {
    const sourceStart = Number(cue.start || 0);
    const sourceEnd = Number(cue.end ?? sourceStart);
    const start = Math.max(0, sourceStart + offset);
    const end = Math.max(start, sourceEnd + offset);
    return {
      ...cue,
      start,
      end,
    };
  });
}

const PROSODY_MULTIMODAL_MOTOR_TARGETS = [
  "master_schema",
  "meaning_network",
  "narrative_agent_graph",
  "audio_sample_cloud",
  "evidence_proliferation_matcher",
  "stats_interpretation",
  "scene_cards",
  "time_bank",
] as const;

function projectConfirmedSpeakersOntoProsody(
  cues: AudioProsodyCue[],
  transcript: TranscriptSegment[],
): AudioProsodyCue[] {
  return cues.map((cue) => {
    const cueStart = Number(cue.start || 0);
    const cueEnd = Number(cue.end ?? cueStart);
    const assignments = transcript.filter((segment) => {
      if (!segment.speakerConfirmation) return false;
      const segmentStart = Number(segment.start || 0);
      const segmentEnd = Number(segment.end ?? segmentStart);
      return Math.min(cueEnd, segmentEnd) >= Math.max(cueStart, segmentStart) - 0.03;
    });
    const labels = [
      ...new Set(
        assignments
          .map((segment) => segment.speakerConfirmation)
          .filter((label): label is string => Boolean(label)),
      ),
    ];
    if (labels.length === 0) return cue;
    const sourceClasses = labels.filter((label) =>
      ["background noise", "crowd"].includes(label.toLowerCase()),
    );
    const speakerLabels = labels.filter((label) => !sourceClasses.includes(label));
    const conflict = speakerLabels.length > 1;
    return {
      ...cue,
      confirmedSpeaker: conflict ? undefined : speakerLabels[0],
      confirmedAudioSourceClass: sourceClasses[0],
      speakerAssignmentRefs: assignments
        .map((segment) => segment.targetId)
        .filter((ref): ref is string => Boolean(ref)),
      speakerAssignmentAuthority: "explicit_user_confirmation",
      narrativeAgentProsody: !conflict && speakerLabels.length === 1,
      assignmentConflict: conflict,
      multimodalMotorTargets: [...PROSODY_MULTIMODAL_MOTOR_TARGETS],
    };
  });
}

function applyAnnotationCorrectionsToObjects(
  objects: DetectedObject[],
  corrections?: AnnotationCorrections | null,
): DetectedObject[] {
  const labelRules = corrections?.label_overrides || [];
  const textRules = corrections?.text_substitutions || [];
  return objects
    .filter((item) => {
      const rawClassName = item.raw_class_name || item.class_name;
      return !isDetectionDropped(rawClassName, "object", labelRules, {
        timestamp: item.timestamp,
        startTimestamp: item.startTimestamp ?? item.timestamp,
        endTimestamp: item.endTimestamp ?? item.timestamp,
        trackId: item.trackId,
      });
    })
    .map((item) => {
    const rawClassName = item.raw_class_name || item.class_name;
    const correctedLabel = applyLabelOverride(rawClassName, "object", labelRules, {
      timestamp: item.timestamp,
      startTimestamp: item.startTimestamp ?? item.timestamp,
      endTimestamp: item.endTimestamp ?? item.timestamp,
      trackId: item.trackId,
    });
    const originalDisplayLabel =
      governedObjectDisplayLabel(item.displayLabel) ||
      (rawClassName !== "person" ? rawClassName : "");
    const baseDisplayLabel = originalDisplayLabel
      ? originalDisplayLabel.replace(
          new RegExp(
            `^${String(rawClassName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\b)`,
            "i",
          ),
          correctedLabel,
        )
      : correctedLabel;
    const textAdjustedLabel = applyTextSubstitutions(baseDisplayLabel, textRules);
    return {
      ...item,
      raw_class_name: rawClassName,
      class_name: rawClassName,
      displayLabel: governedObjectDisplayLabel(textAdjustedLabel),
    };
    });
}

function isRawObjectDisplayLabel(value: unknown): boolean {
  const normalized = looseString(value).toLowerCase();
  return (
    !normalized ||
    normalized === "object" ||
    normalized === "person" ||
    normalized === "track" ||
    normalized === "unknown" ||
    normalized === "unknown_speaker" ||
    normalized.startsWith("person track") ||
    normalized.startsWith("track ") ||
    /^person\s*\d+$/i.test(normalized) ||
    /^person[_-]\d+$/i.test(normalized)
  );
}

function governedObjectDisplayLabel(value: unknown): string | undefined {
  const label = looseString(value);
  return label && !isRawObjectDisplayLabel(label) ? label : undefined;
}

function isExpressionOwnerPersonRequest(entry: ManualVisualAnnotation): boolean {
  const correlation = entry.metadata_correlation || {};
  return (
    entry.category === "Identification" &&
    correlation.target_type === "object" &&
    correlation.target_label === "person" &&
    Boolean(correlation.source_expression_owner_request)
  );
}

function buildManualVisualObjects(
  corrections?: AnnotationCorrections | null,
): DetectedObject[] {
  return (corrections?.manual_visual_annotations || [])
    .filter(
      (entry: ManualVisualAnnotation) =>
        entry.category === "OBJ" || isExpressionOwnerPersonRequest(entry),
    )
    .map(
    (entry: ManualVisualAnnotation, index: number): DetectedObject => {
      const expressionOwnerPerson = isExpressionOwnerPersonRequest(entry);
      const x = Number(entry.coordinates?.x || 0);
      const y = Number(entry.coordinates?.y || 0);
      const w = Number(entry.coordinates?.w || 0);
      const h = Number(entry.coordinates?.h || 0);
      const timestamp = Number(entry.timestamp_seconds || 0);
      const startTimestamp = Number(entry.start_seconds ?? entry.timestamp_seconds ?? 0);
      const endTimestamp = Number(entry.end_seconds ?? entry.timestamp_seconds ?? 0);
      const label = String(entry.label || "manual annotation").trim() || "manual annotation";
      const objectClassName = expressionOwnerPerson ? "person" : label;
      const analystDetail = (
        entry.identity_affirmation ||
        entry.role_affirmation ||
        entry.custom_label ||
        ""
      )
        .trim();
      const displayLabel = expressionOwnerPerson
        ? analystDetail || label
        : analystDetail
          ? `${label} [manual] • ${analystDetail}`
          : `${label} [manual]`;

      return {
        timestamp,
        class_id: -1,
        class_name: objectClassName,
        raw_class_name: objectClassName,
        confidence: 1,
        bbox: {
          x1: x,
          y1: y,
          x2: x + w,
          y2: y + h,
        },
        startTimestamp,
        endTimestamp,
        occurrenceCount: 1,
        trackId: 100000 + index,
        displayLabel,
        sourceType: "manual_visual",
        sourceAnnotationId: entry.id,
        identityAffirmation: entry.identity_affirmation,
        roleAffirmation: entry.role_affirmation,
        audioFoleyNote: entry.audio_foley_note,
        openNote: entry.open_note,
        teachesRegime: Boolean(entry.teaches_regime),
        annotationCategory: entry.category,
        annotationSubcategory: entry.subcategory,
        customLabel: entry.custom_label,
        metadataCorrelation: entry.metadata_correlation,
      };
    },
  );
}

function groupManualVisualAnnotationsByCategory(
  corrections?: AnnotationCorrections | null,
): Partial<
  Record<ManualVisualAnnotation["category"], ManualVisualAnnotation[]>
> {
  return (corrections?.manual_visual_annotations || []).reduce(
    (groups, entry) => {
      const category = entry.category || "Notes";
      groups[category] = [...(groups[category] || []), entry];
      return groups;
    },
    {} as Partial<
      Record<ManualVisualAnnotation["category"], ManualVisualAnnotation[]>
    >,
  );
}

const MASTER_SCHEMA_AUTHORITY_ORDER: MatureEvidenceAuthority[] = [
  "manual_correction",
  "manual_annotation",
  "mature_triangulated",
  "interpreted_detection",
  "raw_detection",
];

function makeResolvedEvidenceCounts(
  records: MasterSchemaResolvedEvidenceRecord[],
): Record<MatureEvidenceAuthority, number> {
  return MASTER_SCHEMA_AUTHORITY_ORDER.reduce(
    (counts, authority) => ({
      ...counts,
      [authority]: records.filter((record) => record.authority === authority).length,
    }),
    {} as Record<MatureEvidenceAuthority, number>,
  );
}

function asLooseRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" ? (value as LooseRecord) : null;
}

function looseRecordArray(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is LooseRecord => Boolean(asLooseRecord(item)))
    : [];
}

function looseString(value: unknown): string {
  return String(value ?? "").trim();
}

function masterSchemaIntervalSeconds(interval: unknown): { start?: number; end?: number } {
  const record = asLooseRecord(interval);
  if (!record) {
    return {};
  }
  const startCandidates = [
    record.start_seconds,
    record.start,
    record.start_time,
    record.startTimestamp,
  ];
  const endCandidates = [
    record.end_seconds,
    record.end,
    record.end_time,
    record.endTimestamp,
  ];
  const start = startCandidates.map(Number).find((value) => Number.isFinite(value));
  const end = endCandidates.map(Number).find((value) => Number.isFinite(value));
  return {
    start,
    end: end ?? start,
  };
}

function normalizeMasterSchemaTargetId(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const trackMatch = raw.match(/^track-(.+)$/i);
  return trackMatch?.[1] || raw;
}

function resolveMasterSchemaObjectAuthority(item: LooseRecord): MatureEvidenceAuthority {
  const mapping = asLooseRecord(item.label_mapping);
  const provenance = asLooseRecord(item.provenance);
  const mappingStatus = looseString(mapping?.mapping_status).toLowerCase();
  const sourceType = looseString(provenance?.source_type).toLowerCase();
  if (sourceType.includes("manual") || mappingStatus.includes("manual")) {
    return "manual_correction";
  }
  if (
    sourceType.includes("mature") ||
    mappingStatus.includes("accepted") ||
    mappingStatus.includes("confirmed") ||
    mappingStatus.includes("promoted")
  ) {
    return "mature_triangulated";
  }
  return "interpreted_detection";
}

function masterSchemaObjectRecord(
  item: LooseRecord,
  index: number,
  kind: "object" | "track",
): MasterSchemaResolvedEvidenceRecord | null {
  const mapping = asLooseRecord(item.label_mapping) || {};
  const label = looseString(mapping.mapped_label || mapping.raw_label || item.label);
  if (!label) return null;
  const { start, end } = masterSchemaIntervalSeconds(item.interval);
  const rawTargetId = kind === "track" ? item.track_id : item.track_id || item.annotation_id;
  const targetId = normalizeMasterSchemaTargetId(rawTargetId);
  const annotationId = looseString(item.annotation_id);
  return {
    id:
      kind === "track"
        ? `master-schema:track:${targetId || index}`
        : `master-schema:object:${annotationId || index}`,
    category: "object",
    label,
    authority: resolveMasterSchemaObjectAuthority(item),
    sourcePanel: "MasterSchema",
    start,
    end,
    rawLabel: looseString(mapping.raw_label) || undefined,
    targetId,
    maturityRoute: looseString(item.maturity_route) || "master_schema.cvat_annotation_ingest",
    mappingStatus: looseString(mapping.mapping_status) || undefined,
  };
}

function masterSchemaObjectRecords(masterSchema: unknown): MasterSchemaResolvedEvidenceRecord[] {
  const schema = asLooseRecord(masterSchema);
  if (!schema) {
    return [];
  }
  const records: MasterSchemaResolvedEvidenceRecord[] = [];
  looseRecordArray(schema.track_annotations).forEach((item, index) => {
    const record = masterSchemaObjectRecord(item, index, "track");
    if (record) records.push(record);
  });
  looseRecordArray(schema.object_annotations).forEach((item, index) => {
    const record = masterSchemaObjectRecord(item, index, "object");
    if (record) records.push(record);
  });
  return records;
}

function masterSchemaNarrativeAgentRecords(masterSchema: unknown): MasterSchemaResolvedEvidenceRecord[] {
  const schema = asLooseRecord(masterSchema);
  if (!schema) {
    return [];
  }
  const records: MasterSchemaResolvedEvidenceRecord[] = [];
  looseRecordArray(schema.narrative_agent_profile_annotations).forEach((item, index) => {
    const label = looseString(item.narrative_agent_name || item.profile_id);
    if (!label) return;
    records.push({
      id: looseString(item.annotation_id) || `master-schema:narrative-agent-profile:${index}`,
      category: "narrative_agent_profile",
      label,
      authority: "mature_triangulated",
      sourcePanel: "MasterSchema",
      targetId: looseString(item.profile_id) || undefined,
      maturityRoute:
        looseString(item.maturity_route) ||
        "master_schema.source_media_narrative_agent_profile_maturity",
      metadata: item as Record<string, unknown>,
    });
  });
  looseRecordArray(schema.character_definition_annotations).forEach((item, index) => {
    const label = looseString(item.character_name || item.actor_name);
    if (!label) return;
    records.push({
      id: looseString(item.annotation_id) || `master-schema:character-definition:${index}`,
      category: "narrative_agent_profile",
      label,
      authority: "mature_triangulated",
      sourcePanel: "MasterSchema",
      maturityRoute:
        looseString(item.maturity_route) ||
        "master_schema.source_media_character_definition_maturity",
      metadata: item as Record<string, unknown>,
    });
  });
  looseRecordArray(schema.character_role_annotations).forEach((item, index) => {
    const label = looseString(item.label);
    if (!label) return;
    records.push({
      id: looseString(item.annotation_id) || `master-schema:character-role:${index}`,
      category: "character_role",
      label,
      authority: "mature_triangulated",
      sourcePanel: "MasterSchema",
      maturityRoute:
        looseString(item.maturity_route) ||
        "master_schema.source_media_character_role_maturity",
      metadata: item as Record<string, unknown>,
    });
  });
  return records;
}

function masterSchemaAnalysisId(masterSchema: unknown): string {
  const schema = asLooseRecord(masterSchema);
  return looseString(schema?.analysis_id);
}

function masterSchemaScopedRecords(
  records: MasterSchemaResolvedEvidenceRecord[],
  masterSchema: unknown,
  analysisId?: string,
): MasterSchemaResolvedEvidenceRecord[] {
  const schemaAnalysisId = masterSchemaAnalysisId(masterSchema);
  if (!analysisId || !schemaAnalysisId || schemaAnalysisId === analysisId) {
    return records;
  }
  return records.filter((record) => {
    const metadata = asLooseRecord(record.metadata) || {};
    const recordAnalysisId = looseString(
      metadata.analysis_id ||
        metadata.source_analysis_id ||
        metadata.owner_analysis_id ||
        metadata.media_id ||
        metadata.video_id,
    );
    return recordAnalysisId === analysisId;
  });
}

function isKnownSubjectLabel(value: unknown): boolean {
  const key = looseString(value)
    .toLowerCase()
    .replace(/[()[\]{}:;,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Boolean(
    key &&
      key !== "unknown" &&
      key !== "unknown speaker" &&
      key !== "unknown participant" &&
      !/^unknown\b/.test(key) &&
      !/^speaker\s*\d+$/.test(key),
  );
}

function isGovernedNarrativeAgentIdentity(value: unknown): boolean {
  const label = looseString(value);
  if (!isKnownSubjectLabel(label)) {
    return false;
  }
  return !isRawObjectDisplayLabel(label);
}

function canonicalNarrativeAgentIdentity(value: unknown): string {
  return looseString(value)
    .split(",")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function preferredNarrativeAgentLabel(labels: string[]): string {
  return [...labels]
    .filter(isGovernedNarrativeAgentIdentity)
    .sort((left, right) => {
      const leftBbc = /\bbbc\b/i.test(left) ? 1 : 0;
      const rightBbc = /\bbbc\b/i.test(right) ? 1 : 0;
      if (leftBbc !== rightBbc) return rightBbc - leftBbc;
      return right.length - left.length;
    })[0] || "";
}

function manualAnnotationNarrativeAgentRecords(
  nativeAnnotations: NativeAnnotationRecord[],
): MasterSchemaResolvedEvidenceRecord[] {
  const records: MasterSchemaResolvedEvidenceRecord[] = [];
  const seen = new Set<string>();
  nativeAnnotations.forEach((item, index) => {
    const identityLabel = looseString(item.identity_affirmation);
    const roleLabel = looseString(item.role_affirmation);
    const fallbackLabel = looseString(item.custom_label || item.label);
    const label = identityLabel || roleLabel || fallbackLabel;
    const category = looseString(item.category);
    const hasManualSubjectAffirmation = isKnownSubjectLabel(identityLabel) || isKnownSubjectLabel(roleLabel);
    if (
      !hasManualSubjectAffirmation &&
      !["Identification", "Role"].includes(category)
    ) {
      return;
    }
    if (!isKnownSubjectLabel(label)) {
      return;
    }
    const manualTargetId = looseString(item.metadata_correlation?.target_id);
    const key = [
      label.toLowerCase(),
      looseString(item.id),
      manualTargetId,
      looseString(item.timestamp_seconds),
      looseString(item.start_seconds),
    ].filter(Boolean).join("|");
    if (seen.has(key)) return;
    seen.add(key);
    records.push({
      id: `manual-subject:${item.id || index}`,
      category: "narrative_agent_profile",
      label,
      authority: "manual_annotation",
      sourcePanel: "MasterSchema",
      start: item.start_seconds ?? item.timestamp_seconds,
      end: item.end_seconds ?? item.timestamp_seconds,
      targetId: manualTargetId || item.id,
      maturityRoute: "master_schema.review_layer.manual_subject_annotation",
      metadata: {
        profile_id: `manual-subject:${item.id || index}`,
        profile_type: "narrative_agent_profile",
        narrative_agent_name: label,
        aliases: [fallbackLabel, identityLabel, roleLabel].filter(isKnownSubjectLabel),
        source_metadata: {
          role_labels: roleLabel && roleLabel !== label ? [roleLabel] : [],
          role_description: looseString(item.open_note),
          source_preference: "manual_visual_annotation",
        },
        evidence_slots: {
          scene_links: [],
          visual_patterns: [item.id].filter(Boolean),
        },
        manual_annotation: item as unknown as Record<string, unknown>,
      },
    });
  });
  return records;
}

function manualAnnotationNarrativeAgentContinuityRecords(
  nativeAnnotations: NativeAnnotationRecord[],
  objects: DetectedObject[],
): MasterSchemaResolvedEvidenceRecord[] {
  const identityGroups = new Map<
    string,
    {
      labels: string[];
      sourceIds: string[];
      sourceTrackIds: Set<string>;
      firstSeen: number;
      lastSeen: number;
    }
  >();

  nativeAnnotations.forEach((item) => {
    const identityLabel = looseString(item.identity_affirmation);
    const fallbackLabel = looseString(item.custom_label || item.label);
    const label = preferredNarrativeAgentLabel([identityLabel, fallbackLabel]);
    if (!label) return;

    const key = canonicalNarrativeAgentIdentity(label);
    if (!key) return;

    const timestamp = finiteNumber(item.timestamp_seconds) ?? 0;
    const start = finiteNumber(item.start_seconds) ?? timestamp;
    const end = finiteNumber(item.end_seconds) ?? timestamp;
    const targetTrackId = looseString(item.metadata_correlation?.target_id);
    const existing = identityGroups.get(key) || {
      labels: [],
      sourceIds: [],
      sourceTrackIds: new Set<string>(),
      firstSeen: Number.POSITIVE_INFINITY,
      lastSeen: Number.NEGATIVE_INFINITY,
    };
    existing.labels.push(label);
    if (item.id) existing.sourceIds.push(item.id);
    if (targetTrackId) existing.sourceTrackIds.add(targetTrackId);
    existing.firstSeen = Math.min(existing.firstSeen, start, end);
    existing.lastSeen = Math.max(existing.lastSeen, start, end);
    identityGroups.set(key, existing);
  });

  const eligibleGroups = [...identityGroups.entries()].filter(([, group]) => {
    const supportCount = group.sourceIds.length + group.sourceTrackIds.size;
    return supportCount >= 2 && Number.isFinite(group.firstSeen);
  });
  if (eligibleGroups.length !== 1) {
    return [];
  }

  const [identityKey, group] = eligibleGroups[0];
  const label = preferredNarrativeAgentLabel(group.labels);
  if (!label) {
    return [];
  }

  const records: MasterSchemaResolvedEvidenceRecord[] = [];
  const seenTracks = new Set<string>();
  objects.forEach((object) => {
    const className = looseString(object.class_name || object.raw_class_name).toLowerCase();
    if (className !== "person") {
      return;
    }
    const trackId = object.trackId !== undefined ? String(object.trackId) : "";
    if (!trackId || seenTracks.has(trackId) || group.sourceTrackIds.has(trackId)) {
      return;
    }
    const start = finiteNumber(object.startTimestamp) ?? finiteNumber(object.timestamp);
    const end = finiteNumber(object.endTimestamp) ?? finiteNumber(object.timestamp);
    if (start === undefined || end === undefined || Math.max(start, end) < group.firstSeen) {
      return;
    }
    const confidence = Number(object.confidence || 0);
    const width = Math.abs(Number(object.bbox?.x2 ?? 0) - Number(object.bbox?.x1 ?? 0));
    const height = Math.abs(Number(object.bbox?.y2 ?? 0) - Number(object.bbox?.y1 ?? 0));
    const area =
      width > 1 || height > 1
        ? (width * height) / (1920 * 1080)
        : width * height;
    const occurrenceCount = Number(object.occurrenceCount || 0);
    if (confidence < 0.75 && occurrenceCount < 20) {
      return;
    }
    if (area < 0.04 && occurrenceCount < 60) {
      return;
    }

    seenTracks.add(trackId);
    records.push({
      id: `manual-identity-continuity:${identityKey}:track:${trackId}`,
      category: "narrative_agent_profile",
      label,
      authority: "mature_triangulated",
      sourcePanel: "MasterSchema",
      start,
      end,
      rawLabel: `person track ${trackId}`,
      targetId: trackId,
      maturityRoute: "master_schema.manual_identity_continuity_bridge",
      mappingStatus: "triangulated_from_repeated_manual_identity",
      metadata: {
        profile_type: "manual_identity_continuity_bridge",
        narrative_agent_name: label,
        aliases: [...new Set(group.labels)].filter(isGovernedNarrativeAgentIdentity),
        source_manual_annotation_ids: [...new Set(group.sourceIds)],
        source_track_ids: [...group.sourceTrackIds],
        target_track_id: trackId,
        confidence_basis: {
          repeated_manual_identity: true,
          no_competing_confirmed_identity: true,
          object_confidence: confidence,
          object_occurrence_count: occurrenceCount,
          object_screen_area: Number(area.toFixed(4)),
        },
        evidence_refs: [
          ...[...new Set(group.sourceIds)],
          `track:${trackId}`,
        ],
        source_bbox_refs: object.bbox ? [{ track_id: trackId, bbox: object.bbox }] : [],
        source_frame_refs: [
          { time: start, source: "manual_identity_continuity_bridge" },
          { time: end, source: "manual_identity_continuity_bridge" },
        ],
      },
    });
  });

  return records;
}

function finiteNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function agentPersistenceTrackRecords(
  secondOrderLabelProliferation?: SecondOrderLabelProliferationPlan | null,
): MasterSchemaResolvedEvidenceRecord[] {
  const records: MasterSchemaResolvedEvidenceRecord[] = [];
  const labels = secondOrderLabelProliferation?.agent_persistence_labels || [];

  labels.forEach((label: AgentPersistenceLabel, index: number) => {
    const candidateLabel = looseString(label.candidate_label);
    if (!isKnownSubjectLabel(candidateLabel)) {
      return;
    }

    const departedTrackId = looseString(label.evidence?.departed_track_id);
    const arrivedTrackId = looseString(label.evidence?.arrived_track_id);
    const departedInterval = label.temporal_grounding?.departed_track_interval || [];
    const arrivedInterval = label.temporal_grounding?.arrived_track_interval || [];
    const status = looseString(label.status);
    const authority: MatureEvidenceAuthority =
      status === "strong_candidate" ? "mature_triangulated" : "interpreted_detection";
    const baseMetadata = {
      profile_type: "agent_persistence_scene_cut",
      narrative_agent_name: candidateLabel,
      status,
      source_feature_type: label.source_feature_type,
      provenance: label.provenance,
      similarity_score: label.evidence?.similarity_score,
      scene_boundary_time: label.temporal_grounding?.scene_boundary_time,
      traceback: label.traceback_relink,
      evidence_refs: [
        departedTrackId ? `track:${departedTrackId}` : "",
        arrivedTrackId ? `track:${arrivedTrackId}` : "",
      ].filter(Boolean),
      source_frame_refs: [
        finiteNumber(departedInterval[0]),
        finiteNumber(departedInterval[1]),
        finiteNumber(arrivedInterval[0]),
        finiteNumber(arrivedInterval[1]),
      ]
        .filter((value): value is number => value !== undefined)
        .map((time) => ({ time, source: "agent_persistence_scene_cut" })),
    };

    [
      {
        role: "departed",
        trackId: departedTrackId,
        interval: departedInterval,
      },
      {
        role: "arrived",
        trackId: arrivedTrackId,
        interval: arrivedInterval,
      },
    ].forEach(({ role, trackId, interval }) => {
      if (!trackId) {
        return;
      }
      records.push({
        id: `agent-persistence:${index}:${role}:${trackId}`,
        category: "narrative_agent_profile",
        label: candidateLabel,
        authority,
        sourcePanel: "MasterSchema",
        start: finiteNumber(interval[0]),
        end: finiteNumber(interval[1]),
        rawLabel: `person track ${trackId}`,
        targetId: trackId,
        maturityRoute: "second_order.agent_persistence_scene_cut",
        mappingStatus: status,
        metadata: {
          ...baseMetadata,
          continuity_role: role,
          linked_track_id: role === "departed" ? arrivedTrackId : departedTrackId,
        },
      });
    });
  });

  return records;
}

function evidenceProliferationMatchRecords(
  matches?: EvidenceProliferationMatchSummary[] | null,
): MasterSchemaResolvedEvidenceRecord[] {
  return (matches || []).map((match, index) => {
    const requestId = looseString(match.request_id) || `proliferation_match:${index}`;
    const candidateCount = Number(match.candidate_count || 0);
    return {
      id: requestId,
      category: "proliferation_match",
      label: `${candidateCount} proliferation candidate${
        candidateCount === 1 ? "" : "s"
      }`,
      authority: "interpreted_detection",
      sourcePanel: "MasterSchema",
      maturityRoute: "evidence_proliferation.match_candidate_review",
      targetId: requestId,
      metadata: {
        request_id: requestId,
        status: match.status || "completed",
        candidate_count: candidateCount,
        output_json_path: match.output_json_path,
        updated_at: match.updated_at,
        governance: {
          outputs_are_candidates_until_supported_by_evidence: true,
          manual_correction_wins: true,
          traceback_required: true,
        },
      },
    };
  });
}

function masterSchemaMaturityAudit(masterSchema: unknown): MasterSchemaMaturityAudit | undefined {
  const schema = asLooseRecord(masterSchema);
  const audit = asLooseRecord(schema?.master_schema_maturity_audit);
  return audit ? (audit as unknown as MasterSchemaMaturityAudit) : undefined;
}

function masterSchemaTemporalSegments(masterSchema: unknown): LooseRecord[] {
  const schema = asLooseRecord(masterSchema);
  return Array.isArray(schema?.temporal_segments)
    ? schema.temporal_segments.filter((segment): segment is LooseRecord => Boolean(asLooseRecord(segment)))
    : [];
}

function temporalSegmentStartEnd(segment: LooseRecord): { start?: number; end?: number } {
  const interval = asLooseRecord(segment.interval);
  const startRaw = segment.start ?? segment.start_seconds ?? interval?.start_seconds;
  const endRaw = segment.end ?? segment.end_seconds ?? interval?.end_seconds;
  const start = Number(startRaw);
  const end = Number(endRaw);
  return {
    start: Number.isFinite(start) ? start : undefined,
    end: Number.isFinite(end) ? end : undefined,
  };
}

function masterSchemaAudioEventIntervals(masterSchema: unknown): NonNullable<AnalysisData["metadata"]>["audioEventIntervals"] | undefined {
  const intervals: Array<{
    event_id?: string;
    event_type?: string;
    start: number;
    end: number;
    duration?: number;
    confidence?: number;
    review_state?: string;
  }> = [];
  masterSchemaTemporalSegments(masterSchema)
    .filter((segment) => segment.event_family === "audio_event_interval")
    .forEach((segment, index) => {
      const { start, end } = temporalSegmentStartEnd(segment);
      if (start === undefined || end === undefined) return;
      intervals.push({
        event_id: String(segment.segment_id || `audio-event:${index}`),
        event_type: String(segment.audio_event_type || segment.event_label || "audio_event"),
        start,
        end,
        duration: Math.max(0, end - start),
        confidence: Number.isFinite(Number(segment.confidence)) ? Number(segment.confidence) : undefined,
        review_state: typeof segment.review_state === "string" ? segment.review_state : undefined,
      });
    });
  if (!intervals.length) return undefined;
  const durations = intervals.reduce<Record<string, number>>((acc, interval) => {
    const key = interval.event_type || "audio_event";
    acc[key] = (acc[key] || 0) + Number(interval.duration || 0);
    return acc;
  }, {});
  const total = Object.values(durations).reduce((sum, value) => sum + value, 0);
  return {
    schema: "vaa1.audio_event_intervals.v1",
    status: "available",
    method: "Master Schema temporal_segments[event_family=audio_event_interval]",
    duration_seconds: total || undefined,
    intervals,
    summary: {
      counts: intervals.reduce<Record<string, number>>((acc, interval) => {
        const key = interval.event_type || "audio_event";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      durations,
      ratios: Object.fromEntries(
        Object.entries(durations).map(([key, value]) => [key, total ? value / total : 0]),
      ),
    },
  };
}

function canonicalAudioEventIntervals(status: AnalysisStatus): NonNullable<AnalysisData["metadata"]>["audioEventIntervals"] | undefined {
  const direct = asLooseRecord((status as unknown as LooseRecord).audio_event_intervals);
  const audioAnalysis = asLooseRecord(
    asLooseRecord((status as unknown as LooseRecord).results)?.audio_analysis,
  );
  const nested = asLooseRecord(audioAnalysis?.audio_event_intervals);
  const prosody = asLooseRecord(audioAnalysis?.audio_prosody);
  const prosodyIntervals = asLooseRecord(prosody?.audio_event_intervals);
  const payload = [direct, nested, prosodyIntervals].find(
    (candidate) => Array.isArray(candidate?.intervals) && candidate.intervals.length,
  );
  if (!payload) return undefined;
  return payload as NonNullable<AnalysisData["metadata"]>["audioEventIntervals"];
}

function masterSchemaShotBoundaries(masterSchema: unknown): NonNullable<NonNullable<AnalysisData["metadata"]>["motionSceneBasis"]>["shotBoundaries"] | undefined {
  const segments = masterSchemaTemporalSegments(masterSchema).filter(
    (segment) => segment.event_family === "shot_boundary_interval",
  );
  const intervals: Array<{
    shot_id?: string;
    start: number;
    end: number;
    duration?: number;
    confidence?: number;
    review_state?: string;
  }> = [];
  segments.forEach((segment, index) => {
    const { start, end } = temporalSegmentStartEnd(segment);
    if (start === undefined || end === undefined) return;
    intervals.push({
      shot_id: String(segment.shot_id || segment.segment_id || `shot:${index}`),
      start,
      end,
      duration: Math.max(0, end - start),
      confidence: Number.isFinite(Number(segment.confidence)) ? Number(segment.confidence) : undefined,
      review_state: typeof segment.review_state === "string" ? segment.review_state : undefined,
    });
  });
  if (!intervals.length) return undefined;
  return {
    method: "Master Schema temporal_segments[event_family=shot_boundary_interval]",
    source: "vaa1_annotation_master_schema",
    true_boundary_intervals: segments.some((segment) => Boolean(segment.true_boundary_interval)),
    intervals,
    summary: {
      shot_count: intervals.length,
      true_boundary_rows: segments.filter((segment) => Boolean(segment.true_boundary_interval)).length,
      mean_shot_duration:
        intervals.reduce((sum, interval) => sum + Number(interval.duration || 0), 0) / intervals.length,
    },
  };
}

function sourceMetadataMasterSchemaRecords(
  metadata?: SourceMediaMetadata,
  sceneCardSummary?: Record<string, unknown> | null,
): MasterSchemaResolvedEvidenceRecord[] {
  const records: MasterSchemaResolvedEvidenceRecord[] = [];
  const annotations = metadata?.user_annotations;
  const addConfirmed = (category: MasterSchemaResolvedEvidenceRecord["category"], field: string, values: unknown[]) => {
    values.map((value) => looseString(value)).filter(Boolean).forEach((label, index) => records.push({
      id: `source-metadata:${field}:${index}`,
      category,
      label,
      authority: "manual_annotation",
      sourcePanel: "SourceMedia",
      targetId: `source_media_metadata:${field}:${index}`,
      maturityRoute: "source_media.user_confirmed_metadata",
      mappingStatus: "user_confirmed",
      metadata: { source_field: field, source_ref: `source_media_metadata:${field}` },
    }));
  };
  addConfirmed("organization", "organizations", annotations?.organizations || []);
  addConfirmed("place", "location", [
    annotations?.location_place,
    annotations?.location_city,
    annotations?.location_country,
    annotations?.location_room,
  ]);

  const organizationPattern = /^(?:[A-Z0-9]{2,12}|.*\b(?:agency|authority|company|corporation|department|institution|ministry|organization|service|syndicate)\b.*)$/i;
  (annotations?.web_metadata_sources || []).forEach((source, sourceIndex) => {
    (source.fields?.places || []).forEach((value, index) => {
      const label = looseString(value);
      if (!label) return;
      const category = organizationPattern.test(label) && !/\b(?:prison|room|street|city|country|lake|grave|tomb)\b/i.test(label)
        ? "organization"
        : "place";
      records.push({
        id: `source-metadata:web:${sourceIndex}:${category}:${index}`,
        category,
        label,
        authority: "interpreted_detection",
        sourcePanel: "SourceMedia",
        targetId: source.id || `web_metadata:${sourceIndex}`,
        maturityRoute: "source_media.web_metadata_candidate",
        mappingStatus: "candidate",
        metadata: { source_url: source.url, review_state: "candidate", source_field: "web_metadata_sources.fields.places" },
      });
    });
  });

  const sceneCardCount = Number(sceneCardSummary?.scene_card_count || 0);
  for (let index = 0; index < sceneCardCount; index += 1) {
    records.push({
      id: `scene-card:${index + 1}`,
      category: "scene_card",
      label: `Scene Card ${String(index + 1).padStart(3, "0")}`,
      authority: "mature_triangulated",
      sourcePanel: "SceneCards",
      targetId: `scene-card:${index + 1}`,
      maturityRoute: "mise_en_scene_scene_cards.scene_card_count",
      mappingStatus: "governed",
      metadata: { output_json_path: sceneCardSummary?.output_json_path },
    });
  }
  return records;
}

function buildMasterSchemaResolvedEvidenceView({
  transcript,
  objects,
  ocr,
  expressions,
  nativeAnnotations,
  corrections,
  identityRefinement,
  secondOrderLabelProliferation,
  evidenceProliferationMatches,
  masterSchema,
  analysisId,
  sourceMediaMetadata,
  sceneCardSummary,
  audioDiarization,
  audioProsody,
}: {
  transcript: TranscriptSegment[];
  objects: DetectedObject[];
  ocr: OCR[];
  expressions: ExpressionSample[];
  nativeAnnotations: NativeAnnotationRecord[];
  corrections?: AnnotationCorrections | null;
  identityRefinement?: IdentityRefinementStatus | null;
  secondOrderLabelProliferation?: SecondOrderLabelProliferationPlan | null;
  evidenceProliferationMatches?: EvidenceProliferationMatchSummary[] | null;
  masterSchema?: unknown;
  analysisId?: string;
  sourceMediaMetadata?: SourceMediaMetadata;
  sceneCardSummary?: Record<string, unknown> | null;
  audioDiarization?: AudioDiarizationScaffold | null;
  audioProsody?: AudioProsodyCue[];
}): MasterSchemaResolvedEvidenceView {
  const records: MasterSchemaResolvedEvidenceRecord[] = [];

  records.push(...sourceMetadataMasterSchemaRecords(sourceMediaMetadata, sceneCardSummary));

  records.push(
    ...masterSchemaScopedRecords(
      masterSchemaObjectRecords(masterSchema),
      masterSchema,
      analysisId,
    ),
  );
  records.push(
    ...masterSchemaScopedRecords(
      masterSchemaNarrativeAgentRecords(masterSchema),
      masterSchema,
      analysisId,
    ),
  );
  records.push(...manualAnnotationNarrativeAgentRecords(nativeAnnotations));
  records.push(...manualAnnotationNarrativeAgentContinuityRecords(nativeAnnotations, objects));
  records.push(...agentPersistenceTrackRecords(secondOrderLabelProliferation));
  records.push(...evidenceProliferationMatchRecords(evidenceProliferationMatches));

  transcript.forEach((segment, index) => {
    records.push({
      id: segment.targetId || `transcript:${index}`,
      category: "transcript",
      label: segment.text || "Unconfirmed",
      authority:
        segment.correctionSource === "manual"
          ? "manual_annotation"
          : segment.rawText && segment.rawText !== segment.text
            ? "manual_correction"
            : "raw_detection",
      sourcePanel: "Transcript",
      start: segment.start,
      end: segment.end,
      rawLabel: segment.rawText,
      targetId: segment.targetId,
    });
    if (segment.speakerConfirmation) {
      const duration = Math.max(0, Number(segment.end || 0) - Number(segment.start || 0));
      const normalizedSpeaker = segment.speakerConfirmation.toLowerCase().replace(/_/g, " ");
      const isUnknownSpeaker =
        ["unknown", "unknown speaker", "speaker", "speaker 1"].includes(normalizedSpeaker) ||
        normalizedSpeaker.startsWith("speaker ");
      const isSourceClass = ["background noise", "crowd"].includes(
        normalizedSpeaker,
      );
      if (isUnknownSpeaker) return;
      records.push({
        id: `speaker-assignment:${segment.targetId || index}:${Number(segment.start || 0).toFixed(3)}`,
        category: "speaker_assignment",
        label: segment.speakerConfirmation,
        authority: "manual_annotation",
        sourcePanel: "Transcript",
        start: segment.start,
        end: segment.end,
        rawLabel: segment.speaker,
        targetId: segment.targetId || `transcript:${index}`,
        maturityRoute: isSourceClass
          ? "canonical.audio.source_class"
          : "canonical.speaker.assignment",
        mappingStatus: "user_confirmed",
        metadata: {
          relation: isSourceClass ? "classified_as_audio_source" : "spoken_by",
          transcript_text: segment.text,
          duration_seconds: duration,
          eligible_for_voice_profile: !isSourceClass && duration >= 0.5,
          identity_auto_promotion_allowed: false,
        },
      });
      if (!isSourceClass && !isUnknownSpeaker && duration >= 0.5) {
        const overlappingTurns = (audioDiarization?.speaker_turns || []).filter((turn) => {
          const turnStart = Number(turn.start ?? 0);
          const turnEnd = Number(turn.end ?? turn.start ?? 0);
          return (
            Number.isFinite(turnStart) &&
            Number.isFinite(turnEnd) &&
            Math.min(Number(segment.end || 0), turnEnd) >=
              Math.max(Number(segment.start || 0), turnStart) - 0.03
          );
        });
        records.push({
          id: `speaker-audio-profile:${segment.targetId || index}:${Number(segment.start || 0).toFixed(3)}`,
          category: "speaker_audio_profile_candidate",
          label: segment.speakerConfirmation,
          authority: "manual_annotation",
          sourcePanel: "MasterSchema",
          start: segment.start,
          end: segment.end,
          targetId: segment.targetId || `transcript:${index}`,
          maturityRoute: "audio_sample_cloud.confirmed_span_candidate",
          mappingStatus: "candidate",
          metadata: {
            source_assignment_ref: `speaker-assignment:${segment.targetId || index}:${Number(segment.start || 0).toFixed(3)}`,
            sample_kind: "confirmed_speaker_span",
            requires_audio_quality_gate: true,
            requires_diarization_overlap: true,
            audio_quality_gate:
              overlappingTurns.length > 0
                ? "source_timed_overlap_available"
                : "awaiting_diarization_overlap",
            overlapping_diarization_turn_ids: overlappingTurns
              .map((turn) => turn.turn_id)
              .filter(Boolean),
            overlapping_speaker_clusters: [
              ...new Set(
                overlappingTurns
                  .map((turn) => turn.speaker_label)
                  .filter(Boolean),
              ),
            ],
            proliferation_mode: "reviewable_candidates_only",
            identity_auto_promotion_allowed: false,
          },
        });
      }
    }
  });

  (audioProsody || []).forEach((cue, index) => {
    const label = cue.confirmedSpeaker || cue.confirmedAudioSourceClass;
    if (!label || cue.assignmentConflict) return;
    const isSourceClass = Boolean(cue.confirmedAudioSourceClass && !cue.confirmedSpeaker);
    records.push({
      id: `speaker-prosody:${cue.cue_id || index}:${Number(cue.start || 0).toFixed(3)}`,
      category: isSourceClass ? "audio_source_prosody" : "narrative_agent_prosody",
      label,
      authority: "manual_annotation",
      sourcePanel: "Audio",
      start: cue.start,
      end: cue.end,
      targetId: cue.cue_id || `prosody:${index}`,
      maturityRoute: isSourceClass
        ? "canonical.audio.source_class+audio_prosody.cues"
        : "canonical.speaker.assignment+audio_prosody.cues",
      mappingStatus: "governed_source_time_join",
      metadata: {
        relation: isSourceClass ? "has_audio_source_prosody" : "has_prosody",
        speaker_assignment_refs: cue.speakerAssignmentRefs || [],
        pace: cue.pace,
        pauses: cue.pauses,
        turn_structure: cue.turn_structure,
        interaction_cues: cue.interaction_cues,
        rhythm_profile: cue.rhythm_profile,
        tonality_profile: cue.tonality_profile,
        emphasis: cue.emphasis,
        pitch_energy_contour: cue.pitch_energy_contour,
        sound_environment: cue.sound_environment,
        multimodal_motor_targets: cue.multimodalMotorTargets || [],
        identity_auto_promotion_allowed: false,
      },
    });
  });

  objects.forEach((item, index) => {
    const label = governedObjectDisplayLabel(item.displayLabel);
    const sourceTargetId =
      item.sourceAnnotationId ||
      (item.trackId !== undefined ? String(item.trackId) : `object:${index}`);
    records.push({
      id: `object:${sourceTargetId}`,
      category: "object",
      label: label || item.class_name || "object",
      authority:
        item.sourceType === "manual_visual"
          ? "manual_annotation"
          : label && item.raw_class_name && item.raw_class_name !== label
            ? "manual_correction"
            : label && item.screenPresenceProfile
              ? "interpreted_detection"
              : "raw_detection",
      sourcePanel: item.sourceType === "manual_visual" ? "MasterSchema" : "OBJDetection",
      start: item.startTimestamp ?? item.timestamp,
      end: item.endTimestamp ?? item.timestamp,
      rawLabel: item.raw_class_name,
      targetId: sourceTargetId,
    });
  });

  ocr.forEach((item, index) => {
    records.push({
      id: `ocr:${index}:${item.timestamp}`,
      category: "ocr",
      label: item.text || "OCR text",
      authority: item.rawText && item.rawText !== item.text ? "manual_correction" : "raw_detection",
      sourcePanel: "OCR",
      start: item.timestamp,
      end: item.timestamp,
      rawLabel: item.rawText,
    });
  });

  expressions.forEach((item, index) => {
    const label = item.interpreted_expression?.label || item.dominant_emotion || "expression";
    records.push({
      id: `expression:${index}:${item.timestamp}`,
      category: "expression",
      label,
      authority:
        item.rawDominantEmotion && item.rawDominantEmotion !== item.dominant_emotion
          ? "manual_correction"
          : item.interpreted_expression?.label
            ? "interpreted_detection"
            : "raw_detection",
      sourcePanel: "Expressions",
      start: item.timestamp,
      end: item.timestamp,
      rawLabel: item.rawDominantEmotion || undefined,
    });
  });

  nativeAnnotations.forEach((item, index) => {
    const annotationId = item.id || `manual:${index}`;
    const start = item.start_seconds ?? item.timestamp_seconds;
    const end = item.end_seconds ?? item.timestamp_seconds;
    records.push({
      id: annotationId,
      category: "manual_annotation",
      label: item.custom_label || item.label || item.open_note || item.category || "manual annotation",
      authority: "manual_annotation",
      sourcePanel: "MasterSchema",
      start,
      end,
      targetId: annotationId,
    });
    const confirmedIdentity = looseString(item.identity_affirmation);
    if (confirmedIdentity && !isRawObjectDisplayLabel(confirmedIdentity)) {
      const sourceObjectTarget = looseString(item.metadata_correlation?.target_id);
      records.push({
        id: `identity:${annotationId}:${Number(start ?? 0).toFixed(3)}`,
        category: "identity",
        label: confirmedIdentity,
        authority: "manual_annotation",
        sourcePanel: "MasterSchema",
        start,
        end,
        rawLabel: looseString(item.metadata_correlation?.target_label) || item.label,
        targetId: annotationId,
        maturityRoute: "manual_visual.identity_affirmation",
        mappingStatus: "user_confirmed",
        metadata: {
          relation: "identifies_visual_occurrence",
          source_annotation_ref: annotationId,
          source_object_ref: sourceObjectTarget
            ? `object:${sourceObjectTarget}`
            : `manual_annotation:${annotationId}`,
          geometry_preserved_on_manual_annotation: true,
          data_maturation_proliferation: "confirmed_identity_occurrence",
        },
      });
    }
  });

  const identityCandidates =
    ((identityRefinement as IdentityRefinementStatus & {
      candidates?: IdentityResolvedCandidate[];
    })?.candidates || []);
  if (identityCandidates.length) {
    identityCandidates.forEach((candidate, index) => {
      const label = candidate.promoted_identity || candidate.candidate_label || candidate.candidate_id;
      if (!label) return;
      records.push({
        id: candidate.candidate_id || `identity:${index}`,
        category: "identity",
        label,
        authority: candidate.review_state === "promoted" ? "mature_triangulated" : "interpreted_detection",
        sourcePanel: "MasterSchema",
        start: candidate.evidence?.time_start,
        end: candidate.evidence?.time_end,
        targetId: candidate.candidate_id,
      });
    });
  }

  const secondOrderItems = secondOrderLabelProliferation?.instructions || [];
  secondOrderItems.slice(0, 100).forEach((candidate, index) => {
    const label = candidate.candidate_label || candidate.target_label_family;
    if (!label) return;
    records.push({
      id: candidate.instruction_id || `second_order:${index}`,
      category: "second_order",
      label,
      authority: "mature_triangulated",
      sourcePanel: "MasterSchema",
      start:
        candidate.time_span?.start ??
        (candidate.time_span?.start_ms !== undefined
          ? Number(candidate.time_span.start_ms) / 1000
          : undefined),
      end:
        candidate.time_span?.end ??
        (candidate.time_span?.end_ms !== undefined
          ? Number(candidate.time_span.end_ms) / 1000
          : undefined),
      targetId: candidate.instruction_id,
    });
  });

  masterSchemaTemporalSegments(masterSchema).forEach((segment, index) => {
    const family = String(segment.event_family || "");
    const temporalCategory =
      family === "audio_event_interval"
        ? "audio_event"
        : family === "shot_boundary_interval"
          ? "shot_boundary"
          : family === "music_analysis"
            ? "music_analysis"
            : family === "lyric_transcript_match"
              ? "lyric_match"
              : family === "speaker_diarization_turn"
                ? "speaker_diarization"
                : null;
    if (!temporalCategory) return;
    const { start, end } = temporalSegmentStartEnd(segment);
    records.push({
      id: String(segment.segment_id || `${family}:${index}`),
      category: temporalCategory,
      label: String(segment.event_label || segment.speaker_label || segment.audio_event_type || segment.shot_id || family),
      authority:
        segment.authority === "interpreted_automatic_detection"
          ? "interpreted_detection"
          : segment.authority === "manual_annotation"
            ? "manual_annotation"
            : "raw_detection",
      sourcePanel: "MasterSchema",
      start,
      end,
      targetId: String(segment.shot_id || segment.segment_id || `${family}:${index}`),
      maturityRoute: typeof segment.maturity_route === "string" ? segment.maturity_route : undefined,
      metadata: {
        event_family: family,
        source_schema: segment.source_schema,
        review_state: segment.review_state,
        true_boundary_interval: segment.true_boundary_interval,
      },
    });
  });

  return {
    authorityOrder: MASTER_SCHEMA_AUTHORITY_ORDER,
    records,
    counts: makeResolvedEvidenceCounts(records),
    updatedAt: corrections?.updated_at,
    rawArtifactsPreserved: true,
  };
}

function datasceneEntityKey(type: DatasceneEntityType, label: string): string {
  return `${type}:${label.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function datasceneMaturityForAuthority(
  authority: MatureEvidenceAuthority,
): DatasceneEntityMaturity {
  if (authority === "manual_correction" || authority === "manual_annotation") {
    return "mature";
  }
  if (authority === "mature_triangulated") {
    return "corroborated";
  }
  if (authority === "interpreted_detection") {
    return "candidate";
  }
  return "raw";
}

function datasceneAuthorityStatusForAuthority(
  authority: MatureEvidenceAuthority,
): DatasceneEntityAuthorityStatus {
  if (authority === "manual_correction") return "manual_corrected";
  if (authority === "manual_annotation") return "manual_confirmed";
  if (authority === "mature_triangulated") return "multi_source_corroborated";
  return "single_model_detected";
}

function datasceneEntityTypeForMasterRecord(
  record: MasterSchemaResolvedEvidenceRecord,
): DatasceneEntityType {
  if (
    record.category === "narrative_agent_profile" ||
    record.category === "character_role" ||
    record.category === "identity"
  ) {
    return "NARRATIVE_AGENT";
  }
  if (record.category === "object") return "OBJECT";
  if (record.category === "organization") return "ORG";
  if (record.category === "place") return "PLACE";
  if (record.category === "ocr" || record.category === "transcript") {
    return "SOURCE_MEDIA_ENTITY";
  }
  if (record.category === "expression") return "AUDIOVISUAL_NARRATIVE_AGENT";
  return "CONCEPT";
}

function sourceCountSeed(): Record<DatasceneEntitySourceType, number> {
  return {
    transcript: 0,
    ocr: 0,
    annotation: 0,
    metadata: 0,
    object_detection: 0,
    visual_sample_cloud: 0,
    audio_sample_cloud: 0,
    audiovisual_narrative_agent_sample: 0,
    mature_data_bus: 0,
  };
}

function entityProliferationPolicy(maturity: DatasceneEntityMaturity) {
  const canProliferate = maturity === "mature" || maturity === "corroborated";
  return {
    can_proliferate: canProliferate,
    requires_manual_review: maturity !== "mature",
    allowed_targets: canProliferate
      ? [
          "master_schema",
          "scene_cards",
          "search_index",
          "entity_registry",
          "meaning_network",
          "narrative_agent_panel",
          "bbox_roi",
          "transcript",
          "ocr",
          "forensic_render",
          "export_report",
        ]
      : ["search_index", "entity_registry", "forensic_render"],
    blocked_actions: [
      "overwrite_prior_manual_label",
      "overwrite_different_track_identity",
      "cross_scene_relabel_without_evidence",
      "promote_raw_detection_without_traceback",
      "project_rejected_entity",
    ],
  };
}

function buildDatasceneEntityRegistryView({
  analysisId,
  transcript,
  objects,
  ocr,
  nativeAnnotations,
  sourceSamples,
  sourceMediaMetadata,
  masterSchemaResolvedEvidence,
}: {
  analysisId?: string;
  transcript: TranscriptSegment[];
  objects: DetectedObject[];
  ocr: OCR[];
  nativeAnnotations: NativeAnnotationRecord[];
  sourceSamples: SourceSample[];
  sourceMediaMetadata?: SourceMediaMetadata;
  masterSchemaResolvedEvidence: MasterSchemaResolvedEvidenceView;
}): DatasceneEntityRegistryView {
  const resolvedAnalysisId = analysisId || sourceMediaMetadata?.analysis_id || "analysis";
  const source_counts = sourceCountSeed();
  const entities = new Map<string, DatasceneEntityRegistryRecord>();

  const addEntity = ({
    label,
    type,
    maturity,
    authority_status,
    confidence,
    mention,
    aliases = [],
    linkedObjectTrack,
    linkedOcrMention,
    linkedMetadataField,
    sampleCloudRef,
  }: {
    label: string;
    type: DatasceneEntityType;
    maturity: DatasceneEntityMaturity;
    authority_status: DatasceneEntityAuthorityStatus;
    confidence: number;
    mention: DatasceneEntityMention;
    aliases?: string[];
    linkedObjectTrack?: string;
    linkedOcrMention?: string;
    linkedMetadataField?: string;
    sampleCloudRef?: string;
  }) => {
    const canonical = looseString(label);
    if (!canonical) return;
    const key = datasceneEntityKey(type, canonical);
    const existing = entities.get(key);
    source_counts[mention.source_type] += 1;
    const traceback = mention.traceback_ref || mention.evidence_ref;
    if (existing) {
      existing.source_mentions.push(mention);
      existing.traceback_refs = uniqueStringValues([...existing.traceback_refs, traceback]);
      existing.aliases = uniqueStringValues([...existing.aliases, ...aliases, canonical]);
      if (linkedObjectTrack) {
        existing.linked_object_tracks = uniqueStringValues([
          ...existing.linked_object_tracks,
          linkedObjectTrack,
        ]);
      }
      if (linkedOcrMention) {
        existing.linked_ocr_mentions = uniqueStringValues([
          ...existing.linked_ocr_mentions,
          linkedOcrMention,
        ]);
      }
      if (linkedMetadataField) {
        existing.linked_metadata_fields = uniqueStringValues([
          ...existing.linked_metadata_fields,
          linkedMetadataField,
        ]);
      }
      if (sampleCloudRef) {
        existing.sample_cloud_refs = uniqueStringValues([
          ...existing.sample_cloud_refs,
          sampleCloudRef,
        ]);
      }
      return;
    }
    entities.set(key, {
      entity_id: `entity:${resolvedAnalysisId}:${entities.size + 1}`,
      analysis_id: resolvedAnalysisId,
      canonical_name: canonical,
      entity_type: type,
      aliases: uniqueStringValues([...aliases, canonical]),
      maturity,
      authority_status,
      confidence,
      source_mentions: [mention],
      linked_object_tracks: linkedObjectTrack ? [linkedObjectTrack] : [],
      linked_ocr_mentions: linkedOcrMention ? [linkedOcrMention] : [],
      linked_metadata_fields: linkedMetadataField ? [linkedMetadataField] : [],
      sample_cloud_refs: sampleCloudRef ? [sampleCloudRef] : [],
      traceback_refs: [traceback],
      proliferation_policy: entityProliferationPolicy(maturity),
    });
  };

  masterSchemaResolvedEvidence.records.forEach((record, index) => {
    const label = looseString(record.label);
    if (!label) return;
    const maturity = datasceneMaturityForAuthority(record.authority);
    addEntity({
      label,
      type: datasceneEntityTypeForMasterRecord(record),
      maturity,
      authority_status: datasceneAuthorityStatusForAuthority(record.authority),
      confidence: record.authority === "raw_detection" ? 0.5 : 1,
      mention: {
        mention_id: `master-schema:${index}:${record.id}`,
        source_type:
          record.category === "object"
            ? "object_detection"
            : record.category === "ocr"
              ? "ocr"
              : record.category === "transcript"
                ? "transcript"
                : "annotation",
        start_time: finiteNumber(record.start) ?? 0,
        end_time: finiteNumber(record.end) ?? finiteNumber(record.start) ?? 0,
        confidence: record.authority === "raw_detection" ? 0.5 : 1,
        evidence_ref: record.id,
        label,
        detected_class: record.rawLabel,
        track_id: record.targetId,
        authority_status: datasceneAuthorityStatusForAuthority(record.authority),
        traceback_ref: record.maturityRoute || record.id,
      },
      aliases: [record.rawLabel || ""],
      linkedObjectTrack: record.category === "object" ? record.targetId : undefined,
      linkedOcrMention: record.category === "ocr" ? record.id : undefined,
    });
  });

  nativeAnnotations.forEach((item, index) => {
    const label = looseString(
      item.identity_affirmation || item.role_affirmation || item.custom_label || item.label,
    );
    if (!label) return;
    const category = looseString(item.category);
    addEntity({
      label,
      type: ["Identification", "Role"].includes(category)
        ? "NARRATIVE_AGENT"
        : category === "OBJ"
          ? "OBJECT"
          : "CONCEPT",
      maturity: "mature",
      authority_status: "manual_confirmed",
      confidence: 1,
      mention: {
        mention_id: item.id || `manual:${index}`,
        source_type: "annotation",
        start_time: finiteNumber(item.start_seconds) ?? finiteNumber(item.timestamp_seconds) ?? 0,
        end_time:
          finiteNumber(item.end_seconds) ??
          finiteNumber(item.start_seconds) ??
          finiteNumber(item.timestamp_seconds) ??
          0,
        confidence: 1,
        evidence_ref: item.id || `manual:${index}`,
        label,
        annotation_id: item.id,
        authority_status: "manual_confirmed",
        traceback_ref: "master_schema.review_layer.manual_subject_annotation",
      },
      aliases: [item.custom_label || "", item.label || ""],
    });
  });

  objects.slice(0, 2000).forEach((item, index) => {
    const label = looseString(item.displayLabel || item.class_name);
    if (!label) return;
    const sourceIsManual = item.sourceType === "manual_visual";
    addEntity({
      label,
      type: "OBJECT",
      maturity: sourceIsManual ? "mature" : item.displayLabel ? "candidate" : "raw",
      authority_status: sourceIsManual ? "manual_confirmed" : "single_model_detected",
      confidence: Number(item.confidence || 0),
      mention: {
        mention_id:
          item.trackId !== undefined ? `object:${item.trackId}:${index}` : `object:${index}`,
        source_type: sourceIsManual ? "annotation" : "object_detection",
        start_time: finiteNumber(item.startTimestamp) ?? finiteNumber(item.timestamp) ?? 0,
        end_time:
          finiteNumber(item.endTimestamp) ??
          finiteNumber(item.startTimestamp) ??
          finiteNumber(item.timestamp) ??
          0,
        confidence: Number(item.confidence || 0),
        evidence_ref:
          item.trackId !== undefined ? `object_track_${item.trackId}` : `object:${index}`,
        detected_class: item.raw_class_name || item.class_name,
        track_id: item.trackId !== undefined ? String(item.trackId) : undefined,
        authority_status: sourceIsManual ? "manual_confirmed" : "single_model_detected",
        traceback_ref: sourceIsManual ? "manual_visual_annotation" : "object_detection",
      },
      aliases: [item.raw_class_name || "", item.class_name || ""],
      linkedObjectTrack: item.trackId !== undefined ? String(item.trackId) : undefined,
    });
  });

  transcript.slice(0, 1200).forEach((segment, index) => {
    const text = looseString(segment.text);
    if (!text) return;
    addEntity({
      label: text,
      type: "SOURCE_MEDIA_ENTITY",
      maturity: segment.correctionSource === "manual" ? "mature" : "raw",
      authority_status:
        segment.correctionSource === "manual" ? "manual_confirmed" : "single_model_detected",
      confidence: segment.status === "confirmed" ? 0.85 : 0.5,
      mention: {
        mention_id: segment.targetId || `transcript:${index}`,
        source_type: "transcript",
        start_time: finiteNumber(segment.start) ?? 0,
        end_time: finiteNumber(segment.end) ?? finiteNumber(segment.start) ?? 0,
        confidence: segment.status === "confirmed" ? 0.85 : 0.5,
        evidence_ref: segment.targetId || `transcript:${index}`,
        text,
        authority_status:
          segment.correctionSource === "manual"
            ? "manual_confirmed"
            : "single_model_detected",
        traceback_ref: "transcript",
      },
    });
  });

  ocr.slice(0, 1200).forEach((item, index) => {
    const text = looseString(item.text);
    if (!text) return;
    addEntity({
      label: text,
      type: "SOURCE_MEDIA_ENTITY",
      maturity: item.rawText && item.rawText !== item.text ? "mature" : "candidate",
      authority_status:
        item.rawText && item.rawText !== item.text
          ? "manual_corrected"
          : "single_model_detected",
      confidence: Number(item.confidence || 0),
      mention: {
        mention_id: `ocr:${index}:${item.timestamp}`,
        source_type: "ocr",
        start_time: finiteNumber(item.timestamp) ?? 0,
        end_time: finiteNumber(item.timestamp) ?? 0,
        confidence: Number(item.confidence || 0),
        evidence_ref: `ocr:${index}:${item.timestamp}`,
        text,
        authority_status:
          item.rawText && item.rawText !== item.text
            ? "manual_corrected"
            : "single_model_detected",
        traceback_ref: "ocr",
      },
      linkedOcrMention: `ocr:${index}:${item.timestamp}`,
    });
  });

  sourceSamples.forEach((sample) => {
    const label = looseString(sample.label || sample.purpose || sample.sample_id);
    if (!label) return;
    const source_type: DatasceneEntitySourceType =
      sample.sample_type === "audio"
        ? "audio_sample_cloud"
        : sample.sample_type === "visual"
          ? "visual_sample_cloud"
          : "audiovisual_narrative_agent_sample";
    addEntity({
      label,
      type:
        sample.sample_type === "audio"
          ? "AUDIO_ENTITY"
          : sample.sample_type === "visual"
            ? "VISUAL_SYMBOL"
            : "AUDIOVISUAL_NARRATIVE_AGENT",
      maturity: sample.status === "completed" ? "candidate" : "raw",
      authority_status: "single_model_detected",
      confidence: sample.status === "completed" ? 0.75 : 0.4,
      mention: {
        mention_id: sample.sample_id,
        source_type,
        start_time: finiteNumber(sample.time_start) ?? 0,
        end_time: finiteNumber(sample.time_end) ?? finiteNumber(sample.time_start) ?? 0,
        confidence: sample.status === "completed" ? 0.75 : 0.4,
        evidence_ref: sample.sample_id,
        sample_id: sample.sample_id,
        label,
        authority_status: "single_model_detected",
        traceback_ref: `source_sample:${sample.sample_id}`,
      },
      sampleCloudRef: sample.sample_id,
    });
  });

  const metadataEntries: Array<[string, unknown]> = [
    ["original_filename", sourceMediaMetadata?.original_filename],
    ["stored_filename", sourceMediaMetadata?.stored_filename],
    ["format_name", sourceMediaMetadata?.format_name],
    ["recorded_at", sourceMediaMetadata?.recorded_at],
    ["gps_coordinates", sourceMediaMetadata?.gps_coordinates],
    ["filmed_by", sourceMediaMetadata?.filmed_by],
  ];
  metadataEntries.forEach(([field, value]) => {
    const label = looseString(value);
    if (!label) return;
    addEntity({
      label,
      type: "SOURCE_MEDIA_ENTITY",
      maturity: "corroborated",
      authority_status: "metadata_authoritative",
      confidence: 1,
      mention: {
        mention_id: `metadata:${field}`,
        source_type: "metadata",
        start_time: 0,
        end_time: 0,
        confidence: 1,
        evidence_ref: `metadata:${field}`,
        metadata_field: field,
        label,
        authority_status: "metadata_authoritative",
        traceback_ref: `source_media_metadata:${field}`,
      },
      linkedMetadataField: field,
    });
  });

  return {
    schema: "vaa1.datascene_entity_registry.v1",
    analysis_id: resolvedAnalysisId,
    entities: [...entities.values()],
    source_counts,
    governance_rules: {
      manual_correction_wins: true,
      manual_confirmation_wins: true,
      raw_detection_never_overrides_mature_entity: true,
      track_identity_must_not_equal_narrative_agent_without_confirmation: true,
      analysis_scoped_records_must_not_bleed_to_other_videos: true,
    },
  };
}

function uniqueStringValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => looseString(value)).filter(Boolean))];
}

function buildDatasceneContentSearchView({
  analysisId,
  entityRegistry,
  liveMatureDataProliferationAudit,
  transcript = [],
  objects = [],
  ocr = [],
  sourceMediaAnnotations,
}: {
  analysisId?: string;
  entityRegistry: DatasceneEntityRegistryView;
  liveMatureDataProliferationAudit?: Record<string, unknown> | null;
  transcript?: TranscriptSegment[];
  objects?: DetectedObject[];
  ocr?: OCR[];
  sourceMediaAnnotations?: Record<string, unknown> | null;
}): DatasceneContentSearchView {
  const resolvedAnalysisId = analysisId || entityRegistry.analysis_id || "analysis";
  const entitySearchRecords = entityRegistry.entities.flatMap((entity) =>
    entity.source_mentions.map((mention, index): DatasceneContentSearchIndexRecord => {
      const searchableParts = [
        entity.canonical_name,
        ...entity.aliases,
        mention.text,
        mention.label,
        mention.detected_class,
      ];
      const searchable_text = uniqueStringValues(searchableParts).join(" ");
      const searchable_keywords = uniqueStringValues(
        searchable_text
          .toLowerCase()
          .split(/[^a-z0-9_]+/i)
          .filter((part) => part.length > 1),
      );
      return {
        index_id: `search:${entity.entity_id}:${index}`,
        analysis_id: resolvedAnalysisId,
        canonical_entity_id: entity.entity_id,
        canonical_name: entity.canonical_name,
        entity_type: entity.entity_type,
        start_time: mention.start_time,
        end_time: mention.end_time,
        searchable_text,
        searchable_keywords,
        sources: [
          {
            source_type: mention.source_type,
            source_id: mention.mention_id,
            match_text: mention.text || mention.label,
            detected_class: mention.detected_class,
            track_id: mention.track_id,
            start_time: mention.start_time,
            end_time: mention.end_time,
            confidence: mention.confidence,
            maturity: entity.maturity,
            authority_status: entity.authority_status,
            evidence_ref: mention.evidence_ref,
            traceback_ref: mention.traceback_ref,
          },
        ],
        maturity_summary: {
          highest_maturity: entity.maturity,
          has_manual_confirmation:
            entity.authority_status === "manual_confirmed" ||
            entity.authority_status === "manual_corrected",
          has_multi_source_support: entity.source_mentions.length > 1,
          requires_review: entity.maturity !== "mature",
        },
        forensic_render_available: entity.traceback_refs.length > 0,
        entity_card_available: true,
        search_surface: "entity",
      };
    }),
  );
  const fallbackRecords = fallbackSourceSearchRecords({
    analysisId: resolvedAnalysisId,
    transcript,
    objects,
    ocr,
    sourceMediaAnnotations,
    existingKeys: new Set(
      entitySearchRecords.map((record) =>
        `${record.canonical_name.toLowerCase()}:${record.start_time}:${record.end_time}`,
      ),
    ),
  });
  const search_index_records = [
    ...entitySearchRecords,
    ...fallbackRecords,
    ...liveMatureDataSearchRecords(resolvedAnalysisId, liveMatureDataProliferationAudit),
  ];

  return {
    schema: "vaa1.datascene_content_search.v1",
    analysis_id: resolvedAnalysisId,
    source_switchboard: {
      transcript: true,
      ocr: true,
      manual_annotations: true,
      metadata: true,
      object_detection: true,
      audiovisual_narrative_agent_samples: true,
      visual_sample_clouds: true,
      audio_sample_clouds: true,
      detected_pattern_entities: true,
      motion_patterns: true,
      scene_cards: true,
      meaning_network: true,
      master_schema: true,
    },
    search_index_records,
    governance_rules: {
      manual_correction_wins: true,
      search_does_not_overwrite_data: true,
      candidate_results_must_be_marked_as_candidate: true,
      object_track_identity_must_not_equal_narrative_agent_without_confirmation: true,
      analysis_scoped_records_must_not_bleed_to_other_videos: true,
    },
    som_open_topology_boundary: {
      status: "diagnostic_scanner_matcher_only",
      can_suggest: true,
      can_cluster: true,
      can_surface_near_matches: true,
      can_create_review_candidates: true,
      can_override_master_schema: false,
      can_mark_mature_without_decision: false,
      required_outputs: [
        "candidate_id",
        "source_refs",
        "similarity_score",
        "cluster_context",
        "reason_for_match",
        "review_required",
        "blocked_actions",
      ],
    },
  };
}

function contentSearchKeywords(text: string): string[] {
  return uniqueStringValues(
    text
      .toLowerCase()
      .split(/[^a-z0-9_]+/i)
      .filter((part) => part.length > 1),
  );
}

function fallbackContentSearchRecord({
  analysisId,
  indexId,
  canonicalName,
  entityType,
  sourceType,
  sourceId,
  startTime,
  endTime,
  confidence,
  textParts,
  detectedClass,
  trackId,
}: {
  analysisId: string;
  indexId: string;
  canonicalName: string;
  entityType: DatasceneEntityType;
  sourceType: DatasceneEntitySourceType;
  sourceId: string;
  startTime: number;
  endTime: number;
  confidence: number;
  textParts: unknown[];
  detectedClass?: string;
  trackId?: string;
}): DatasceneContentSearchIndexRecord {
  const searchable_text = uniqueStringValues(
    [canonicalName, ...textParts.map((item) => looseString(item))],
  ).join(" ");
  return {
    index_id: indexId,
    analysis_id: analysisId,
    canonical_entity_id: `${sourceType}:${sourceId}`,
    canonical_name: canonicalName,
    entity_type: entityType,
    start_time: startTime,
    end_time: endTime,
    searchable_text,
    searchable_keywords: contentSearchKeywords(searchable_text),
    sources: [
      {
        source_type: sourceType,
        source_id: sourceId,
        match_text: searchable_text,
        detected_class: detectedClass,
        track_id: trackId,
        start_time: startTime,
        end_time: endTime,
        confidence,
        maturity: "raw",
        authority_status: "single_model_detected",
        evidence_ref: sourceId,
        traceback_ref: sourceId,
      },
    ],
    maturity_summary: {
      highest_maturity: "raw",
      has_manual_confirmation: false,
      has_multi_source_support: false,
      requires_review: true,
    },
    forensic_render_available: true,
    entity_card_available: true,
    search_surface: "entity",
  };
}

function fallbackSourceSearchRecords({
  analysisId,
  transcript,
  objects,
  ocr,
  sourceMediaAnnotations,
  existingKeys,
}: {
  analysisId: string;
  transcript: TranscriptSegment[];
  objects: DetectedObject[];
  ocr: OCR[];
  sourceMediaAnnotations?: Record<string, unknown> | null;
  existingKeys: Set<string>;
}): DatasceneContentSearchIndexRecord[] {
  const records: DatasceneContentSearchIndexRecord[] = [];
  const pushRecord = (record: DatasceneContentSearchIndexRecord) => {
    const key = `${record.canonical_name.toLowerCase()}:${record.start_time}:${record.end_time}`;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    records.push(record);
  };

  objects.slice(0, 300).forEach((object, index) => {
    const rawObject = object as DetectedObject & Record<string, unknown>;
    const label = looseString(
      object.displayLabel || object.class_name || object.raw_class_name || rawObject.label,
    );
    if (!label) return;
    const start =
      finiteNumber(object.startTimestamp) ??
      finiteNumber(object.timestamp) ??
      finiteNumber(rawObject.start) ??
      0;
    const end =
      finiteNumber(object.endTimestamp) ??
      finiteNumber(rawObject.end) ??
      start;
    const confidence = finiteNumber(object.confidence) ?? 0.5;
    pushRecord(
      fallbackContentSearchRecord({
        analysisId,
        indexId: `fallback-object:${analysisId}:${index}`,
        canonicalName: label,
        entityType: /person|agent|speaker/i.test(label) ? "NARRATIVE_AGENT" : "OBJECT",
        sourceType: "object_detection",
        sourceId: looseString(rawObject.id || object.trackId) || `object:${index}`,
        startTime: start,
        endTime: end,
        confidence,
        textParts: [object.class_name, object.raw_class_name, object.trackId],
        detectedClass: looseString(object.class_name || object.raw_class_name),
        trackId: looseString(object.trackId),
      }),
    );
  });

  ocr.slice(0, 220).forEach((item, index) => {
    const rawOcr = item as OCR & Record<string, unknown>;
    const text = looseString(item.text || item.rawText);
    if (!text) return;
    const start = finiteNumber(item.timestamp) ?? 0;
    const end = finiteNumber(rawOcr.end) ?? start;
    pushRecord(
      fallbackContentSearchRecord({
        analysisId,
        indexId: `fallback-ocr:${analysisId}:${index}`,
        canonicalName: text,
        entityType: "SOURCE_MEDIA_ENTITY",
        sourceType: "ocr",
        sourceId: looseString(rawOcr.id) || `ocr:${index}`,
        startTime: start,
        endTime: end,
        confidence: finiteNumber(item.confidence) ?? 0.65,
        textParts: [item.rawText],
      }),
    );
  });

  transcript.slice(0, 220).forEach((segment, index) => {
    const rawSegment = segment as TranscriptSegment & Record<string, unknown>;
    const text = looseString(segment.text);
    if (!text) return;
    const start = finiteNumber(segment.start) ?? 0;
    const end = finiteNumber(segment.end) ?? start;
    pushRecord(
      fallbackContentSearchRecord({
        analysisId,
        indexId: `fallback-transcript:${analysisId}:${index}`,
        canonicalName: text.slice(0, 96),
        entityType: "SOURCE_MEDIA_ENTITY",
        sourceType: "transcript",
        sourceId: looseString(rawSegment.id) || `transcript:${index}`,
        startTime: start,
        endTime: end,
        confidence: 0.7,
        textParts: [segment.speaker, text],
      }),
    );
  });

  const keywords = unknownArray<Record<string, unknown>>(
    unknownRecord(sourceMediaAnnotations).keywords,
  );
  keywords.slice(0, 80).forEach((keyword, index) => {
    const label = looseString(keyword.label || keyword.name || keyword.value || keyword);
    if (!label) return;
    pushRecord(
      fallbackContentSearchRecord({
        analysisId,
        indexId: `fallback-metadata:${analysisId}:${index}`,
        canonicalName: label,
        entityType: "SOURCE_MEDIA_ENTITY",
        sourceType: "metadata",
        sourceId: `metadata:keyword:${index}`,
        startTime: 0,
        endTime: 0,
        confidence: finiteNumber(keyword.confidence) ?? 0.8,
        textParts: [keyword.category, keyword.source],
      }),
    );
  });

  return records;
}

function unknownRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function unknownArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function liveMatureDataSearchRecords(
  analysisId: string,
  liveMatureDataProliferationAudit?: Record<string, unknown> | null,
): DatasceneContentSearchIndexRecord[] {
  const audit = unknownRecord(liveMatureDataProliferationAudit);
  const observations = [
    ...unknownArray<Record<string, unknown>>(
      audit.content_derived_mature_observations_preview,
    ),
    ...unknownArray<Record<string, unknown>>(audit.genre_rule_observations_preview),
  ];
  const hypotheses = unknownArray<Record<string, unknown>>(
    audit.governed_mature_hypotheses_preview,
  );

  const matureRecords = observations.map((item, index) => {
    const label = looseString(item.label) || "Mature observation";
    const time = unknownRecord(item.time);
    const start = finiteNumber(time.start) ?? 0;
    const end = finiteNumber(time.end) ?? start;
    const confidencePercent = finiteNumber(item.confidence_percent) ?? 86;
    const sourceRef = looseString(item.source_ref || item.observation_id) || `mature:${index}`;
    return matureDataSearchRecord({
      analysisId,
      indexId: `mature-data:${sourceRef}:${index}`,
      canonicalEntityId: `mature-data:${sourceRef}`,
      canonicalName: label,
      entityType: entityTypeFromMatureCategory(item.category),
      startTime: start,
      endTime: end,
      text: [
        label,
        item.category,
        item.authority,
        item.authority_class,
        item.genre_rule_id,
        `${confidencePercent}% confidence`,
      ],
      sourceId: sourceRef,
      sourceType: "mature_data_bus",
      confidence: confidencePercent / 100,
      maturity: "mature",
      authorityStatus: "metadata_authoritative",
      evidenceRef: sourceRef,
      searchSurface: "mature_data",
      confidencePercent,
      requiresReview: false,
    });
  });

  const clusterRecords = hypotheses.map((item, index) => {
    const label = looseString(item.candidate_label || item.seed_label) || "Confirmable cluster";
    const time = unknownRecord(item.candidate_time);
    const start = finiteNumber(time.start) ?? 0;
    const end = finiteNumber(time.end) ?? start;
    const confidence = finiteNumber(item.confidence) ?? 0.74;
    const sourceRef =
      looseString(item.hypothesis_id || item.source_opportunity_id || item.candidate_id) ||
      `cluster:${index}`;
    return matureDataSearchRecord({
      analysisId,
      indexId: `confirmable-cluster:${sourceRef}:${index}`,
      canonicalEntityId: `confirmable-cluster:${sourceRef}`,
      canonicalName: `Confirmable cluster: ${label}`,
      entityType: entityTypeFromMatureCategory(item.candidate_category),
      startTime: start,
      endTime: end,
      text: [
        label,
        item.seed_label,
        item.candidate_category,
        item.match_reason,
        item.review_badge,
        item.maturity_projection_state,
      ],
      sourceId: sourceRef,
      sourceType: "mature_data_bus",
      confidence,
      maturity: "candidate",
      authorityStatus: "multi_source_corroborated",
      evidenceRef: sourceRef,
      searchSurface: "confirmable_cluster",
      confidencePercent: Math.round(confidence * 100),
      requiresReview: true,
      clusterSummary: {
        cluster_key: looseString(item.candidate_id || sourceRef) || sourceRef,
        candidate_count: 1,
        propagation_state:
          looseString(item.maturity_projection_state) || "review_visible_not_mature",
        promotion_requires_decision: item.promotion_requires_decision !== false,
      },
    });
  });

  return [...matureRecords, ...clusterRecords];
}

function matureDataSearchRecord({
  analysisId,
  indexId,
  canonicalEntityId,
  canonicalName,
  entityType,
  startTime,
  endTime,
  text,
  sourceId,
  sourceType,
  confidence,
  maturity,
  authorityStatus,
  evidenceRef,
  searchSurface,
  confidencePercent,
  requiresReview,
  clusterSummary,
}: {
  analysisId: string;
  indexId: string;
  canonicalEntityId: string;
  canonicalName: string;
  entityType: DatasceneEntityType;
  startTime: number;
  endTime: number;
  text: unknown[];
  sourceId: string;
  sourceType: DatasceneEntitySourceType;
  confidence: number;
  maturity: DatasceneEntityMaturity;
  authorityStatus: DatasceneEntityAuthorityStatus;
  evidenceRef: string;
  searchSurface: "mature_data" | "confirmable_cluster";
  confidencePercent: number;
  requiresReview: boolean;
  clusterSummary?: DatasceneContentSearchIndexRecord["cluster_summary"];
}): DatasceneContentSearchIndexRecord {
  const searchable_text = uniqueStringValues(
    [canonicalName, ...text.map((item) => looseString(item))].filter(Boolean),
  ).join(" ");
  const searchable_keywords = uniqueStringValues(
    searchable_text
      .toLowerCase()
      .split(/[^a-z0-9_]+/i)
      .filter((part) => part.length > 1),
  );
  return {
    index_id: indexId,
    analysis_id: analysisId,
    canonical_entity_id: canonicalEntityId,
    canonical_name: canonicalName,
    entity_type: entityType,
    start_time: startTime,
    end_time: endTime,
    searchable_text,
    searchable_keywords,
    sources: [
      {
        source_type: sourceType,
        source_id: sourceId,
        match_text: searchable_text,
        start_time: startTime,
        end_time: endTime,
        confidence,
        maturity,
        authority_status: authorityStatus,
        evidence_ref: evidenceRef,
        traceback_ref: evidenceRef,
      },
    ],
    maturity_summary: {
      highest_maturity: maturity,
      has_manual_confirmation: false,
      has_multi_source_support: true,
      requires_review: requiresReview,
    },
    forensic_render_available: true,
    entity_card_available: true,
    search_surface: searchSurface,
    confidence_percent: confidencePercent,
    cluster_summary: clusterSummary,
  };
}

function entityTypeFromMatureCategory(category: unknown): DatasceneEntityType {
  const text = looseString(category).toLowerCase();
  if (/person|speaker|identity|lower_third/.test(text)) return "PERSON_NAME";
  if (/place|location|city|country/.test(text)) return "PLACE";
  if (/event|summit|situation/.test(text)) return "EVENT";
  if (/object|prop/.test(text)) return "OBJECT";
  if (/genre|concept|subject/.test(text)) return "CONCEPT";
  return "SOURCE_MEDIA_ENTITY";
}

function applyAnnotationCorrectionsToRawObjects(
  objects: DetectedObject[],
  corrections?: AnnotationCorrections | null,
): DetectedObject[] {
  const labelRules = (corrections?.label_overrides || []).filter(
    (rule) => rule.modality === "object",
  );
  const textRules = corrections?.text_substitutions || [];

  return objects
    .filter((item) => {
      const rawClassName = item.raw_class_name || item.class_name;
      return !isDetectionDropped(rawClassName, "object", labelRules, {
        timestamp: item.timestamp,
      });
    })
    .map((item) => {
    const rawClassName = item.raw_class_name || item.class_name;
    const matchedRule = labelRules.find((rule) => {
      if (
        normalizeCorrectionValue(rule.raw_value) !==
        normalizeCorrectionValue(rawClassName)
      ) {
        return false;
      }
      if (rule.target_timestamp === undefined) {
        return false;
      }
      return Math.abs(Number(rule.target_timestamp) - Number(item.timestamp)) <= 0.15;
    });
    const correctedLabel =
      matchedRule && String(matchedRule.corrected_value || "").trim()
        ? String(matchedRule.corrected_value).trim()
        : rawClassName;

    return {
      ...item,
      raw_class_name: rawClassName,
      class_name: rawClassName,
      displayLabel: governedObjectDisplayLabel(
        applyTextSubstitutions(correctedLabel, textRules),
      ),
    };
    });
}

function applyAnnotationCorrectionsToOCR(
  items: OCR[],
  corrections?: AnnotationCorrections | null,
): OCR[] {
  const textRules = corrections?.text_substitutions || [];
  const labelRules = corrections?.label_overrides || [];
  return items
    .filter((item) => {
      const rawText = item.rawText || item.text;
      return !isDetectionDropped(rawText, "ocr", labelRules, {
        timestamp: item.timestamp,
      });
    })
    .map((item) => {
    const rawText = item.rawText || item.text;
    const labelCorrected = applyLabelOverride(rawText, "ocr", labelRules, {
      timestamp: item.timestamp,
    });
    return {
      ...item,
      rawText,
      text: applyTextSubstitutions(labelCorrected, textRules),
    };
    });
}

function applyAnnotationCorrectionsToExpressions(
  items: ExpressionSample[],
  corrections?: AnnotationCorrections | null,
): ExpressionSample[] {
  const labelRules = corrections?.label_overrides || [];
  return items
    .filter((item) => {
      const rawDominantEmotion = item.rawDominantEmotion || item.dominant_emotion || "";
      return !isDetectionDropped(rawDominantEmotion, "expression", labelRules, {
        timestamp: item.timestamp,
      });
    })
    .map((item) => {
    const rawDominantEmotion = item.rawDominantEmotion || item.dominant_emotion || null;
    const correctedEmotion = rawDominantEmotion
      ? applyLabelOverride(rawDominantEmotion, "expression", labelRules, {
          timestamp: item.timestamp,
        })
      : rawDominantEmotion;
    const correctedEmotionMap =
      item.emotion && correctedEmotion && item.dominant_emotion && item.emotion[item.dominant_emotion] !== undefined
        ? {
            ...item.emotion,
            [correctedEmotion]: item.emotion[item.dominant_emotion],
          }
        : item.emotion;
    return {
      ...item,
      rawDominantEmotion,
      dominant_emotion: correctedEmotion,
      emotion: correctedEmotionMap,
    };
    });
}

function applyAnnotationCorrectionsToPosAnalysis(
  items: POSAnalysis[],
  corrections?: AnnotationCorrections | null,
): POSAnalysis[] {
  const textRules = corrections?.text_substitutions || [];
  return items.map((item) => ({
    ...item,
    text: applyTextSubstitutions(item.text, textRules),
    notes: (item.notes || []).map((note) => applyTextSubstitutions(note, textRules)),
    interrogative_lens: Object.fromEntries(
      Object.entries(item.interrogative_lens || {}).map(([key, value]) => [
        key,
        Array.isArray(value)
          ? value.map((entry) => applyTextSubstitutions(String(entry), textRules))
          : value,
      ]),
    ) as POSAnalysis["interrogative_lens"],
    pos_words: Object.fromEntries(
      Object.entries(item.pos_words || {}).map(([key, value]) => [
        key,
        Array.isArray(value)
          ? value.map((entry) => applyTextSubstitutions(String(entry), textRules))
          : value,
      ]),
    ) as POSAnalysis["pos_words"],
    tense_profile: item.tense_profile
      ? {
          ...item.tense_profile,
          examples: Object.fromEntries(
            Object.entries(item.tense_profile.examples || {}).map(([key, value]) => [
              key,
              Array.isArray(value)
                ? value.map((entry) => applyTextSubstitutions(String(entry), textRules))
                : value,
            ]),
          ),
        }
      : item.tense_profile,
  }));
}

function applyAnnotationCorrectionsToQuantAnalysis(
  items: QuantAnalysis[],
  corrections?: AnnotationCorrections | null,
): QuantAnalysis[] {
  const textRules = corrections?.text_substitutions || [];
  return items.map((item) => ({
    ...item,
    stats_df: (item.stats_df || []).map((row) => ({
      ...row,
      Document: applyTextSubstitutions(row.Document, textRules),
    })),
    token_info: {
      ...item.token_info,
      tokens: (item.token_info?.tokens || []).map((entry) =>
        applyTextSubstitutions(String(entry), textRules),
      ),
      tokens_filtered: (item.token_info?.tokens_filtered || []).map((entry) =>
        applyTextSubstitutions(String(entry), textRules),
      ),
      freq_dist: Object.fromEntries(
        Object.entries(item.token_info?.freq_dist || {}).map(([key, value]) => [
          applyTextSubstitutions(key, textRules),
          value,
        ]),
      ),
    },
    tfidf_df: (item.tfidf_df || []).map((row) => ({
      ...row,
      Document: applyTextSubstitutions(row.Document, textRules),
      TopTerms: (row.TopTerms || []).map((term) => applyTextSubstitutions(term, textRules)),
    })),
    bigrams: (item.bigrams || []).map((entry) =>
      Array.isArray(entry)
        ? entry.map((term) => applyTextSubstitutions(String(term), textRules))
        : applyTextSubstitutions(String(entry), textRules),
    ),
    sentence_tags: (item.sentence_tags || []).map((entry) => ({
      ...entry,
      sentence: applyTextSubstitutions(entry.sentence, textRules),
    })),
    concordance: item.concordance
      ? {
          ...item.concordance,
          keyword: item.concordance.keyword
            ? applyTextSubstitutions(item.concordance.keyword, textRules)
            : item.concordance.keyword,
          lines: (item.concordance.lines || []).map((line) =>
            applyTextSubstitutions(line, textRules),
          ),
        }
      : item.concordance,
  }));
}

type CinematicShotSizeSummary = {
  dominant_label?: string | null;
  sample_count?: number;
  distribution?: Record<string, number>;
  interval_summaries?: Array<{
    start: number;
    end: number;
    dominant_label: string;
    distribution?: Record<string, number>;
  }>;
};

type CinematicCluesMetadata = {
  shotSize?: {
    method?: string;
    samples?: Array<{
      timestamp: number;
      label: string;
      person_count?: number;
      dominant_area_share?: number;
      confidence?: number;
    }>;
    summary?: CinematicShotSizeSummary;
  };
  transitionClues?: {
    method?: string;
    samples?: Array<{
      timestamp: number;
      label: string;
      zone_tone_shift?: number;
      occupancy_shift?: number;
      frame_class?: string;
    }>;
    summary?: {
      dominant_label?: string | null;
      sample_count?: number;
      distribution?: Record<string, number>;
      interval_summaries?: Array<{
        start: number;
        end: number;
        dominant_label: string;
        distribution?: Record<string, number>;
      }>;
    };
  };
  movementHint?: {
    method?: string;
    samples?: Array<{
      timestamp: number;
      label: string;
      zone_tone_shift?: number;
      occupancy_shift?: number;
      frame_class?: string;
    }>;
    summary?: {
      dominant_label?: string | null;
      sample_count?: number;
      distribution?: Record<string, number>;
    };
  };
  compositionHint?: {
    method?: string;
    samples?: Array<{
      timestamp: number;
      label: string;
      left_occupancy?: number;
      center_occupancy?: number;
      right_occupancy?: number;
      frame_class?: string;
    }>;
    summary?: {
      dominant_label?: string | null;
      sample_count?: number;
      distribution?: Record<string, number>;
    };
  };
  subjectArrangementHint?: {
    method?: string;
    samples?: Array<{
      timestamp: number;
      label: string;
      person_count?: number;
      text_count?: number;
      frame_class?: string;
    }>;
    summary?: {
      dominant_label?: string | null;
      sample_count?: number;
      distribution?: Record<string, number>;
    };
  };
};

function buildDistributionFromLabels(labels: string[]): Record<string, number> {
  return labels.reduce<Record<string, number>>((acc, label) => {
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function dominantLabelFromDistribution(
  distribution?: Record<string, number>,
): string | null {
  const entries = Object.entries(distribution || {}).filter(([, count]) => Number(count) > 0);
  if (!entries.length) return null;
  return entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] < b[0] ? -1 : 1;
  })[0]?.[0] || null;
}

function stripCinematicPrefix(value: string, clueKey: string): string {
  const prefix = `${clueKey}:`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function applyAnnotationCorrectionsToCinematicClues(
  cinematicClues: CinematicCluesMetadata | undefined,
  corrections?: AnnotationCorrections | null,
) {
  const labelRules = corrections?.label_overrides || [];
  const addedShotSamples = labelRules
    .filter(
      (rule) =>
        rule?.modality === "cinematic" &&
        String(rule?.raw_value || "").trim().toLowerCase() ===
          "cinematic-add:shot-size" &&
        String(rule?.corrected_value || "").trim(),
    )
    .map((rule) => {
      const timestamp =
        Number(rule?.target_timestamp) ||
        Number(rule?.target_start_timestamp) ||
        0;
      return {
        timestamp,
        label: String(rule?.corrected_value || "").trim(),
      };
    })
    .sort((left, right) => left.timestamp - right.timestamp);
  if (!cinematicClues && !addedShotSamples.length) {
    return cinematicClues;
  }

  const applyCinematicLabel = (
    clueKey: string,
    label: string,
    context: {
      timestamp?: number | null;
      startTimestamp?: number | null;
      endTimestamp?: number | null;
    },
  ) =>
    stripCinematicPrefix(
      applyLabelOverride(`${clueKey}:${label}`, "cinematic", labelRules, context),
      clueKey,
    );

  const mapSampleLabels = <
    T extends { timestamp: number; label: string; [key: string]: unknown },
  >(
    clueKey: string,
    samples?: T[],
  ): T[] | undefined =>
    samples
      ?.filter(
        (sample) =>
          !isDetectionDropped(`${clueKey}:${sample.label}`, "cinematic", labelRules, {
            timestamp: sample.timestamp,
          }),
      )
      .map((sample) => ({
        ...sample,
        label: applyCinematicLabel(clueKey, sample.label, {
          timestamp: sample.timestamp,
        }),
      }));

  const mapIntervalSummaries = (
    summaries?: Array<{
      start: number;
      end: number;
      dominant_label: string;
      distribution?: Record<string, number>;
    }>,
  ) =>
    summaries
      ?.filter(
        (interval) =>
          !isDetectionDropped(
            `shot-size:${interval.dominant_label}`,
            "cinematic",
            labelRules,
            {
              startTimestamp: interval.start,
              endTimestamp: interval.end,
              timestamp: interval.start,
            },
          ),
      )
      .map((interval) => {
        const correctedLabel = applyCinematicLabel("shot-size", interval.dominant_label, {
          startTimestamp: interval.start,
          endTimestamp: interval.end,
          timestamp: interval.start,
        });
        return {
          ...interval,
          dominant_label: correctedLabel,
          distribution:
            correctedLabel !== interval.dominant_label
              ? { [correctedLabel]: Math.max(1, Object.values(interval.distribution || {}).reduce((a, b) => a + Number(b || 0), 0)) }
              : interval.distribution,
        };
      });

  const correctedShotSamples = [
    ...(mapSampleLabels("shot-size", cinematicClues?.shotSize?.samples) || []),
    ...addedShotSamples.map((sample) => ({
      ...sample,
      label: applyCinematicLabel("shot-size", sample.label, {
        timestamp: sample.timestamp,
        startTimestamp: sample.timestamp,
        endTimestamp: sample.timestamp,
      }),
    })),
  ].sort((left, right) => Number(left.timestamp || 0) - Number(right.timestamp || 0));
  const correctedShotIntervals = mapIntervalSummaries(
    cinematicClues?.shotSize?.summary?.interval_summaries,
  );
  const correctedShotDistribution = buildDistributionFromLabels(
    (correctedShotSamples || []).map((sample) => sample.label),
  );

  const correctedTransitionSamples = mapSampleLabels(
    "transition",
    cinematicClues?.transitionClues?.samples,
  );
  const correctedTransitionDistribution = buildDistributionFromLabels(
    (correctedTransitionSamples || []).map((sample) => sample.label),
  );

  const correctedMovementSamples = mapSampleLabels(
    "movement",
    cinematicClues?.movementHint?.samples,
  );
  const correctedMovementDistribution = buildDistributionFromLabels(
    (correctedMovementSamples || []).map((sample) => sample.label),
  );

  const correctedCompositionSamples = mapSampleLabels(
    "composition",
    cinematicClues?.compositionHint?.samples,
  );
  const correctedCompositionDistribution = buildDistributionFromLabels(
    (correctedCompositionSamples || []).map((sample) => sample.label),
  );

  const correctedSubjectArrangementSamples = mapSampleLabels(
    "subject-arrangement",
    cinematicClues?.subjectArrangementHint?.samples,
  );
  const correctedSubjectArrangementDistribution = buildDistributionFromLabels(
    (correctedSubjectArrangementSamples || []).map((sample) => sample.label),
  );

  return {
    ...cinematicClues,
    shotSize: cinematicClues?.shotSize || correctedShotSamples.length
      ? {
          ...(cinematicClues?.shotSize || {}),
          samples: correctedShotSamples,
          summary: {
            ...(cinematicClues?.shotSize?.summary || {}),
            dominant_label:
              dominantLabelFromDistribution(correctedShotDistribution) ||
              cinematicClues?.shotSize?.summary?.dominant_label ||
              correctedShotSamples[0]?.label ||
              null,
            sample_count: correctedShotSamples?.length ?? 0,
            distribution: correctedShotDistribution,
            interval_summaries: correctedShotIntervals,
          },
        }
      : undefined,
    transitionClues: cinematicClues?.transitionClues
      ? {
          ...cinematicClues.transitionClues,
          samples: correctedTransitionSamples,
          summary: {
            ...cinematicClues.transitionClues.summary,
            dominant_label:
              dominantLabelFromDistribution(correctedTransitionDistribution) ||
              cinematicClues.transitionClues.summary?.dominant_label,
            sample_count: correctedTransitionSamples?.length ?? 0,
            distribution: correctedTransitionDistribution,
          },
        }
      : undefined,
    movementHint: cinematicClues?.movementHint
      ? {
          ...cinematicClues.movementHint,
          samples: correctedMovementSamples,
          summary: {
            ...cinematicClues.movementHint.summary,
            dominant_label:
              dominantLabelFromDistribution(correctedMovementDistribution) ||
              cinematicClues.movementHint.summary?.dominant_label,
            sample_count: correctedMovementSamples?.length ?? 0,
            distribution: correctedMovementDistribution,
          },
        }
      : undefined,
    compositionHint: cinematicClues?.compositionHint
      ? {
          ...cinematicClues.compositionHint,
          samples: correctedCompositionSamples,
          summary: {
            ...cinematicClues.compositionHint.summary,
            dominant_label:
              dominantLabelFromDistribution(correctedCompositionDistribution) ||
              cinematicClues.compositionHint.summary?.dominant_label,
            sample_count: correctedCompositionSamples?.length ?? 0,
            distribution: correctedCompositionDistribution,
          },
        }
      : undefined,
    subjectArrangementHint: cinematicClues?.subjectArrangementHint
      ? {
          ...cinematicClues.subjectArrangementHint,
          samples: correctedSubjectArrangementSamples,
          summary: {
            ...cinematicClues.subjectArrangementHint.summary,
            dominant_label:
              dominantLabelFromDistribution(correctedSubjectArrangementDistribution) ||
              cinematicClues.subjectArrangementHint.summary?.dominant_label,
            sample_count: correctedSubjectArrangementSamples?.length ?? 0,
            distribution: correctedSubjectArrangementDistribution,
          },
        }
      : undefined,
  };
}

export interface POSAnalysis {
  text: string;
  analysis_mode?: string;
  token_count?: number;
  notes?: string[];
  confidence_profile?: {
    overall?: {
      level?: string;
      score?: number;
      source?: string;
      triangulation_ready?: boolean;
      timestamp_ready?: boolean;
    };
    pos_words?: {
      level?: string;
      score?: number;
      source?: string;
      triangulation_ready?: boolean;
      timestamp_ready?: boolean;
    };
    interrogatives?: Record<
      string,
      {
        level?: string;
        score?: number;
        source?: string;
        triangulation_ready?: boolean;
        timestamp_ready?: boolean;
      }
    >;
  };
  pos_counts: {
    NOUN: number;
    VERB: number;
    ADJ: number;
    ADP: number;
    ADV: number;
    PRON: number;
    DET: number;
    CONJ: number;
    AUX_MODAL: number;
  };
  pos_ratios: {
    verb_noun_ratio: number;
    modal_density: number;
    pronoun_share: number;
    adj_adv_ratio: number;
    nominalization_density: number;
  };
  interrogative_lens: {
    who: [];
    what: [];
    when: [];
    where: [];
    why: [];
    how: [];
    by_what_means: [];
    towards_what_end: [];
    whence: [];
    by_what_consequence: [];
  };
  pos_words: {
    NOUN: string[];
    VERB: string[];
    ADJ: string[];
    ADV: string[];
    ADP: string[];
    PRON: string[];
    DET: string[];
    CONJ: string[];
    INTJ: string[];
    AUX_MODAL: string[];
  };
  grammar_profile?: {
    content_words?: {
      count?: number;
      categories?: Record<string, number>;
    };
    function_words?: {
      count?: number;
      categories?: Record<string, number>;
    };
  };
  tense_profile?: {
    available?: boolean;
    counts?: Record<string, number>;
    examples?: Record<string, string[]>;
    tense_counts?: Record<string, number>;
    tense_examples?: Record<string, string[]>;
    tense_labels?: Record<string, string>;
    verb_form_counts?: Record<string, number>;
    verb_form_examples?: Record<string, string[]>;
    verb_form_labels?: Record<string, string>;
    note?: string;
  };
  case_profile?: {
    available?: boolean;
    counts?: Record<string, number>;
    examples?: Record<string, string[]>;
    occurrences?: Record<string, string[]>;
    labels?: Record<string, string>;
    note?: string;
  };
}

export interface QuantAnalysis {
  evidence_map?: {
    frequent_terms?: Array<{
      type?: string;
      term?: string;
      matched_terms?: string[];
      count?: number;
      snippets?: string[];
      segment_refs?: Array<{
        text?: string;
        context_text?: string;
        start?: number;
        end?: number;
        t?: string;
      }>;
    }>;
    tfidf_terms?: Array<{
      type?: string;
      term?: string;
      matched_terms?: string[];
      count?: number;
      snippets?: string[];
      segment_refs?: Array<{
        text?: string;
        context_text?: string;
        start?: number;
        end?: number;
        t?: string;
      }>;
    }>;
    bigrams?: Array<{
      type?: string;
      phrase?: string;
      matched_terms?: string[];
      snippets?: string[];
      segment_refs?: Array<{
        text?: string;
        start?: number;
        end?: number;
        t?: string;
      }>;
    }>;
    sentence_tags?: Array<{
      type?: string;
      sentence?: string;
      WHO?: boolean;
      WHY?: boolean;
      matched_terms?: string[];
      segment_refs?: Array<{
        text?: string;
        start?: number;
        end?: number;
        t?: string;
      }>;
    }>;
    concordance?: Array<{
      type?: string;
      line?: string;
      keyword?: string | null;
      matched_terms?: string[];
      segment_refs?: Array<{
        text?: string;
        start?: number;
        end?: number;
        t?: string;
      }>;
    }>;
  };
  stats_df: Array<{
    Document: string;
    Sentences: number;
    Words: number;
  }>;
  token_info: {
    tokens: string[];
    tokens_filtered: string[];
    ttr: number;
    freq_dist: Record<string, number>;
  };
  tfidf_df: Array<{
    Document: string;
    TopTerms: string[];
  }>;
  bigrams: any[];
  sentence_tags: Array<{
    sentence: string;
    WHO: boolean;
    WHY: boolean;
  }>;
  concordance?: {
    keyword?: string | null;
    lines: string[];
    width?: number;
    requested_lines?: number;
    entries?: Array<{
      left_context?: string;
      keyword?: string;
      right_context?: string;
      text?: string;
      start?: number;
      end?: number;
      t?: string;
    }>;
  };
}

export interface AnalysisData {
  analysisId?: string;
  quantAnalysis: QuantAnalysis[];
  posAnalysis: POSAnalysis[];
  transcript: TranscriptSegment[];
  transcriptTimeline?: TranscriptSegment[];
  detectedObjects: DetectedObject[];
  rawDetectedObjects: DetectedObject[];
  faceResults?: AnalysisStatus["face_results"] | null;
  ocr: OCR[];
  expressionResults: ExpressionSample[];
  expressionSamplingCoverage?: {
    sampledFrames: number;
    sourceDetections: number;
    noFaceOrInvalidSamples: number;
  };
  audioProsody: AudioProsodyCue[];
  speakerProsodyProjection?: Record<string, unknown> | null;
  quantityDetection: DetectedObject[];
  annotations: any[];
  manualAnnotationsByCategory?: Partial<
    Record<ManualVisualAnnotation["category"], ManualVisualAnnotation[]>
  >;
  masterSchemaResolvedEvidence?: MasterSchemaResolvedEvidenceView;
  entityRegistry?: DatasceneEntityRegistryView;
  contentSearch?: DatasceneContentSearchView;
  annotationCorrections?: AnnotationCorrections | null;
  canonicalDecisionLedger?: AnalysisStatus["canonical_decision_ledger"];
  projectedCanonicalClaims?: import("./api-service").ProjectedCanonicalClaimCollection;
  forensicRenderJobs?: ForensicRenderJob[];
  sourceSamples?: SourceSample[];
  identityRefinement?: IdentityRefinementStatus | null;
  secondOrderLabelProliferation?: SecondOrderLabelProliferationPlan | null;
  narrativeLensReading?: Record<string, unknown> | null;
  characterPathReading?: Record<string, unknown> | null;
  datasceneMeaningNetwork?: Record<string, unknown> | null;
  miseEnSceneSceneCards?: Record<string, unknown> | null;
  evidenceProliferationMatches?: EvidenceProliferationMatchSummary[];
  liveMatureDataProliferationAudit?: Record<string, unknown> | null;
  audioDiarization?: AudioDiarizationScaffold | null;
  audioSampleClouds?: Record<string, unknown> | null;
  summary: string;
  rawCsv: string;
  rawJson?: any;
  status: string;
  downloadLinks?: Record<string, string>;
  metadata?: {
    sourceName?: string;
    sourceMediaMetadata?: SourceMediaMetadata;
    sourceAnnotations?: SourceAnnotationContext;
    masterSchemaMaturityAudit?: MasterSchemaMaturityAudit;
    yoloDetections: number;
    ocrDetections: number;
    transcriptQuality?: TranscriptDataBundle["quality"];
    cinematicClues?: {
      shotSize?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          person_count?: number;
          dominant_area_share?: number;
          confidence?: number;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
          interval_summaries?: Array<{
            start: number;
            end: number;
            dominant_label: string;
            distribution?: Record<string, number>;
          }>;
        };
      };
      transitionClues?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          zone_tone_shift?: number;
          occupancy_shift?: number;
          frame_class?: string;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
          interval_summaries?: Array<{
            start: number;
            end: number;
            dominant_label: string;
            distribution?: Record<string, number>;
          }>;
        };
      };
      movementHint?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          zone_tone_shift?: number;
          occupancy_shift?: number;
          frame_class?: string;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
        };
      };
      compositionHint?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          left_occupancy?: number;
          center_occupancy?: number;
          right_occupancy?: number;
          frame_class?: string;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
        };
      };
      subjectArrangementHint?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          person_count?: number;
          text_count?: number;
          frame_class?: string;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
        };
      };
    };
    spatialToneScan?: {
      summary?: {
        sample_count?: number;
        dominant_frame_class?: string;
        frame_class_distribution?: Record<string, number>;
        dominant_tone_by_zone?: Record<string, string>;
      };
      samples?: Array<{
        timestamp: number;
        frame_class?: string;
        zones?: Record<
          string,
          {
            occupancy_mass?: number;
            person_count?: number;
            text_count?: number;
            object_count?: number;
            dominant_tone?: string;
            brightness?: number;
            brightness_band?: string;
            brightness_value?: number;
            contrast?: number;
            contrast_band?: string;
            saturation?: number;
            saturation_band?: string;
            luminance_entropy?: number;
          }
        >;
        foreground_activity?: number;
        background_activity?: number;
      }>;
    };
    adaptiveVisualScan?: {
      parameters?: {
        source_fps?: number;
        baseline_fps?: number;
        dense_fps?: number;
        candidate_window_seconds?: number;
      };
      summary?: {
        sample_count?: number;
        baseline_sample_count?: number;
        dense_sample_count?: number;
        candidate_window_count?: number;
        motion_sample_count?: number;
        transition_candidate_count?: number;
        lighting_event_count?: number;
      };
      samples?: Array<{
        sample_id?: string;
        timestamp: number;
        frame_index?: number;
        cadence?: "baseline" | "dense_candidate_window";
        frame_class?: string;
        frame_class_basis?: {
          edge_density?: number;
          luminance_entropy?: number;
        };
        lighting?: {
          brightness?: number;
          brightness_delta?: number;
          event?: string;
        };
        motion?: {
          frame_delta?: number;
          changed_fraction?: number;
          label?: string;
        };
        spatial_occupancy?: Record<
          string,
          { activity_occupancy?: number; edge_occupancy?: number }
        >;
        transition?: { label?: string; candidate?: boolean };
        authority?: string;
        review_state?: string;
      }>;
    };
    motionSceneBasis?: {
      motionEvidence?: {
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
      sceneSegments?: {
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
      shotBoundaries?: {
        method?: string;
        source?: string;
        true_boundary_intervals?: boolean;
        intervals?: Array<{
          shot_id?: string;
          start: number;
          end: number;
          duration?: number;
          confidence?: number;
          review_state?: string;
        }>;
        summary?: Record<string, unknown>;
      };
    };
    foundationalSourceLayers?: Record<string, unknown>;
    audioEventIntervals?: {
      schema?: string;
      method?: string;
      status?: string;
      duration_seconds?: number;
      intervals?: Array<{
        event_id?: string;
        event_type?: string;
        start: number;
        end: number;
        duration?: number;
        confidence?: number;
        review_state?: string;
      }>;
      summary?: {
        counts?: Record<string, number>;
        durations?: Record<string, number>;
        ratios?: Record<string, number>;
      };
    };
    audioSegments?: number;
    audioProsodyCues?: number;
    audioDiarizationError?: string;
    audioDiarizationTurns?: number;
    audioLanguage?: string;
    audioLanguageName?: string;
    audioLanguageSource?: string;
    audioLanguageConfidence?: number;
    audioError?: string;
    audioProsodyError?: string;
    posError?: string;
    quantError?: string;
    languageSupport?: {
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
    languageProfile?: {
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
    };
    expressionSamples?: number;
    expressionStatus?: "completed" | "failed" | "not_run";
    expressionError?: string;
    faceFramesConsidered?: number;
    faceFramesSelected?: number;
    faceFramesSkippedNoPerson?: number;
  };
}

type FaceFrameResult = NonNullable<
  NonNullable<AnalysisStatus["face_results"]>["frames"]
>[number];

type FaceCandidate = NonNullable<FaceFrameResult["faces"]>[number];

function toAgeBand(age?: number | null): string | undefined {
  if (typeof age !== "number" || Number.isNaN(age)) return undefined;
  if (age < 13) return "child";
  if (age < 18) return "youth";
  if (age < 40) return "adult";
  if (age < 65) return "older adult";
  return "senior adult";
}

function normalizeGenderPresentation(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("woman") || normalized.includes("female")) {
    return "female-presenting";
  }
  if (normalized.includes("man") || normalized.includes("male")) {
    return "male-presenting";
  }
  return undefined;
}

function buildConfidenceLabel(score: number): string {
  if (score >= 0.75) return "strong";
  if (score >= 0.5) return "moderate";
  return "weak";
}

function faceLikelyMatchesObject(
  item: DetectedObject,
  face: FaceCandidate,
): boolean {
  const bbox = item.bbox;
  const region = face?.region as
    | { x?: number; y?: number; w?: number; h?: number }
    | undefined;

  if (
    !bbox ||
    bbox.x1 === undefined ||
    bbox.y1 === undefined ||
    bbox.x2 === undefined ||
    bbox.y2 === undefined ||
    !region ||
    region.x === undefined ||
    region.y === undefined ||
    region.w === undefined ||
    region.h === undefined
  ) {
    return true;
  }

  const faceCenterX = region.x + region.w / 2;
  const faceCenterY = region.y + region.h / 2;
  const paddingX = (bbox.x2 - bbox.x1) * 0.15;
  const paddingY = (bbox.y2 - bbox.y1) * 0.15;

  return (
    faceCenterX >= bbox.x1 - paddingX &&
    faceCenterX <= bbox.x2 + paddingX &&
    faceCenterY >= bbox.y1 - paddingY &&
    faceCenterY <= bbox.y2 + paddingY
  );
}

function enrichObjectsWithFaceSummaries(
  objects: DetectedObject[],
  faceResults?: AnalysisStatus["face_results"] | null,
  transcriptSegments: TranscriptSegment[] = [],
): DetectedObject[] {
  const faceFrames = faceResults?.frames ?? [];
  if (!Array.isArray(objects) || objects.length === 0 || faceFrames.length === 0) {
    return objects;
  }

  return objects.map((item) => {
    if (item.class_name !== "person") {
      return item;
    }

    const spanStart = item.startTimestamp ?? item.timestamp;
    const spanEnd = item.endTimestamp ?? item.timestamp;
    const candidateFrames = faceFrames.filter((frame) => {
      const t = typeof frame.source_timestamp === "number" ? frame.source_timestamp : undefined;
      if (t === undefined) return false;
      return t >= spanStart - 1.5 && t <= spanEnd + 1.5;
    });

    const candidateFaces = candidateFrames
      .flatMap((frame) => frame.faces ?? [])
      .filter((face) => {
        const warningCodes = new Set((face.warnings ?? []).map((warning) => warning.code));
        return !warningCodes.has("LOW_FACE_CONFIDENCE") && faceLikelyMatchesObject(item, face);
      });

    if (candidateFaces.length === 0) {
      return item;
    }

    const ageBandCounts = new Map<string, number>();
    const genderCounts = new Map<string, number>();
    const confidenceValues: number[] = [];

    for (const face of candidateFaces) {
      const ageBand = toAgeBand(face.age);
      if (ageBand) {
        ageBandCounts.set(ageBand, (ageBandCounts.get(ageBand) ?? 0) + 1);
      }
      const gender = normalizeGenderPresentation(face.dominant_gender);
      if (gender) {
        genderCounts.set(gender, (genderCounts.get(gender) ?? 0) + 1);
      }
      if (typeof face.face_confidence === "number" && !Number.isNaN(face.face_confidence)) {
        confidenceValues.push(Math.max(0, Math.min(1, face.face_confidence)));
      }
    }

    const topAgeBand = [...ageBandCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topGender = [...genderCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const averageConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : 0.5;
    const consistencyScore =
      Math.max(
        topAgeBand ? (ageBandCounts.get(topAgeBand) ?? 0) / candidateFaces.length : 0,
        topGender ? (genderCounts.get(topGender) ?? 0) / candidateFaces.length : 0,
      ) || 0.5;
    const confidenceScore = Number(
      Math.max(0, Math.min(1, averageConfidence * 0.6 + consistencyScore * 0.4)).toFixed(2),
    );

    if (!topAgeBand && !topGender) {
      return item;
    }

    const overlappingSegments = transcriptSegments.filter((segment) => {
      const start = typeof segment.start === "number" ? segment.start : undefined;
      const end = typeof segment.end === "number" ? segment.end : undefined;
      if (start === undefined || end === undefined) return false;
      return end >= spanStart && start <= spanEnd;
    }).length;

    return {
      ...item,
      demographicSummary: {
        ageBand: topAgeBand,
        genderPresentation: confidenceScore >= 0.5 ? topGender : undefined,
        confidenceScore,
        confidenceLabel: buildConfidenceLabel(confidenceScore),
        evidenceSamples: candidateFaces.length,
        note: "Possible demographic signal from nearby face samples",
        audioSupport:
          overlappingSegments > 0
            ? {
                overlappingSegments,
                label: "speech overlap",
              }
            : undefined,
      },
    };
  });
}

function annotateScreenPresenceProfiles(
  objects: DetectedObject[],
): DetectedObject[] {
  const people = objects.filter((item) => item.class_name === "person");
  if (people.length === 0) {
    return objects;
  }

  const maxOccurrence = Math.max(
    1,
    ...people.map((item) => item.occurrenceCount ?? 1),
  );
  const maxDuration = Math.max(
    0.1,
    ...people.map((item) =>
      Math.max(
        0,
        (item.endTimestamp ?? item.timestamp) - (item.startTimestamp ?? item.timestamp),
      ),
    ),
  );
  const maxArea = Math.max(
    1,
    ...people.map((item) => {
      const bbox = item.bbox;
      if (
        !bbox ||
        bbox.x1 === undefined ||
        bbox.y1 === undefined ||
        bbox.x2 === undefined ||
        bbox.y2 === undefined
      ) {
        return 0;
      }
      return Math.max(0, bbox.x2 - bbox.x1) * Math.max(0, bbox.y2 - bbox.y1);
    }),
  );
  const maxAudioSupport = Math.max(
    1,
    ...people.map(
      (item) => item.demographicSummary?.audioSupport?.overlappingSegments ?? 0,
    ),
  );
  const maxFaceEvidence = Math.max(
    1,
    ...people.map((item) => item.demographicSummary?.evidenceSamples ?? 0),
  );

  const ranked = [...people]
    .map((item) => {
      const occurrenceScore = (item.occurrenceCount ?? 1) / maxOccurrence;
      const durationScore =
        Math.max(
          0,
          (item.endTimestamp ?? item.timestamp) - (item.startTimestamp ?? item.timestamp),
        ) / maxDuration;
      const bbox = item.bbox;
      const areaScore =
        bbox &&
        bbox.x1 !== undefined &&
        bbox.y1 !== undefined &&
        bbox.x2 !== undefined &&
        bbox.y2 !== undefined
          ? (Math.max(0, bbox.x2 - bbox.x1) * Math.max(0, bbox.y2 - bbox.y1)) /
            maxArea
          : 0;
      const audioScore =
        (item.demographicSummary?.audioSupport?.overlappingSegments ?? 0) /
        maxAudioSupport;
      const faceScore =
        (item.demographicSummary?.evidenceSamples ?? 0) / maxFaceEvidence;
      const dominanceScore = Number(
        (
          occurrenceScore * 0.35 +
          durationScore * 0.25 +
          areaScore * 0.2 +
          audioScore * 0.1 +
          faceScore * 0.1
        ).toFixed(2),
      );

      const cues: string[] = [];
      if (occurrenceScore >= 0.6 || durationScore >= 0.6) {
        cues.push("persistent on-screen presence");
      }
      if (areaScore >= 0.45) {
        cues.push("larger frame share");
      }
      if (audioScore > 0) {
        cues.push("speech overlap");
      }
      if (faceScore > 0) {
        cues.push("face-supported");
      }

      return {
        item,
        dominanceScore,
        cues,
      };
    })
    .sort((left, right) => right.dominanceScore - left.dominanceScore)
    .map((entry, index) => {
      let tier: "primary" | "secondary" | "background" = "background";
      if (index === 0 && entry.dominanceScore >= 0.35) {
        tier = "primary";
      } else if (index <= 2 && entry.dominanceScore >= 0.2) {
        tier = "secondary";
      }

      const profileBase =
        tier === "primary" ? "primary_screen_agent" : "screen_agent";

      return {
        ...entry,
        profile: {
          tier,
          profileId: `${profileBase}_${index + 1}`,
          dominanceScore: entry.dominanceScore,
          rank: index + 1,
          cues:
            entry.cues.length > 0
              ? entry.cues
              : ["visible on-screen person"],
        },
      };
    });

  const profileByTrack = new Map<string, (typeof ranked)[number]["profile"]>();
  for (const rankedEntry of ranked) {
    const key = rankedEntry.item.trackId !== undefined
      ? `track:${rankedEntry.item.trackId}`
      : `ts:${rankedEntry.item.timestamp}`;
    profileByTrack.set(key, rankedEntry.profile);
  }

  return objects.map((item) => {
    if (item.class_name !== "person") {
      return item;
    }
    const key = item.trackId !== undefined ? `track:${item.trackId}` : `ts:${item.timestamp}`;
    const profile = profileByTrack.get(key);
    return profile
      ? {
          ...item,
          screenPresenceProfile: profile,
        }
      : item;
  });
}

function calculateIoU(
  left?: DetectedObject["bbox"],
  right?: DetectedObject["bbox"],
): number {
  if (
    !left ||
    !right ||
    left.x1 === undefined ||
    left.y1 === undefined ||
    left.x2 === undefined ||
    left.y2 === undefined ||
    right.x1 === undefined ||
    right.y1 === undefined ||
    right.x2 === undefined ||
    right.y2 === undefined
  ) {
    return 0;
  }

  const intersectX1 = Math.max(left.x1, right.x1);
  const intersectY1 = Math.max(left.y1, right.y1);
  const intersectX2 = Math.min(left.x2, right.x2);
  const intersectY2 = Math.min(left.y2, right.y2);

  const intersectWidth = Math.max(0, intersectX2 - intersectX1);
  const intersectHeight = Math.max(0, intersectY2 - intersectY1);
  const intersection = intersectWidth * intersectHeight;
  if (intersection <= 0) {
    return 0;
  }

  const leftArea = Math.max(0, (left.x2 - left.x1) * (left.y2 - left.y1));
  const rightArea = Math.max(0, (right.x2 - right.x1) * (right.y2 - right.y1));
  const union = leftArea + rightArea - intersection;

  return union > 0 ? intersection / union : 0;
}

function calculateCenterDistance(
  left?: DetectedObject["bbox"],
  right?: DetectedObject["bbox"],
): number {
  if (
    !left ||
    !right ||
    left.x1 === undefined ||
    left.y1 === undefined ||
    left.x2 === undefined ||
    left.y2 === undefined ||
    right.x1 === undefined ||
    right.y1 === undefined ||
    right.x2 === undefined ||
    right.y2 === undefined
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const leftCx = (left.x1 + left.x2) / 2;
  const leftCy = (left.y1 + left.y2) / 2;
  const rightCx = (right.x1 + right.x2) / 2;
  const rightCy = (right.y1 + right.y2) / 2;

  return Math.hypot(leftCx - rightCx, leftCy - rightCy);
}

export function groupDetectedObjectsForDisplay(
  items: DetectedObject[],
  options?: {
    timeWindow?: number;
    iouThreshold?: number;
    centerDistanceThreshold?: number;
  },
): DetectedObject[] {
  const timeWindow = options?.timeWindow ?? 1.2;
  const iouThreshold = options?.iouThreshold ?? 0.2;
  const centerDistanceThreshold = options?.centerDistanceThreshold ?? 80;

  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const alreadyTracked = items.some(
    (item) =>
      item.trackId !== undefined ||
      item.startTimestamp !== undefined ||
      item.endTimestamp !== undefined ||
      item.occurrenceCount !== undefined,
  );

  if (alreadyTracked) {
    return [...items].sort(
      (left, right) =>
        (left.startTimestamp ?? left.timestamp) - (right.startTimestamp ?? right.timestamp),
    );
  }

  const sorted = [...items].sort((left, right) => left.timestamp - right.timestamp);
  const grouped: DetectedObject[] = [];
  const trackCounters = new Map<string, number>();

  for (const item of sorted) {
    const candidateTracks = grouped
      .map((groupedItem, index) => ({ groupedItem, index }))
      .filter(
        ({ groupedItem }) =>
          groupedItem.class_name === item.class_name &&
          Math.abs(item.timestamp - (groupedItem.endTimestamp ?? groupedItem.timestamp)) <=
            timeWindow,
      )
      .map(({ groupedItem, index }) => ({
        groupedItem,
        index,
        iou: calculateIoU(groupedItem.bbox, item.bbox),
        centerDistance: calculateCenterDistance(groupedItem.bbox, item.bbox),
      }))
      .filter(
        ({ iou, centerDistance, groupedItem }) =>
          (!groupedItem.bbox || !item.bbox) ||
          iou >= iouThreshold ||
          centerDistance <= centerDistanceThreshold,
      )
      .sort((left, right) => {
        if (right.iou !== left.iou) {
          return right.iou - left.iou;
        }
        return left.centerDistance - right.centerDistance;
      });

    const bestMatch = candidateTracks[0]?.groupedItem;

    if (bestMatch) {
      bestMatch.endTimestamp = item.timestamp;
      bestMatch.occurrenceCount = (bestMatch.occurrenceCount ?? 1) + 1;
      if (item.confidence >= bestMatch.confidence) {
        bestMatch.confidence = item.confidence;
        bestMatch.bbox = item.bbox;
        bestMatch.timestamp = item.timestamp;
      }
      continue;
    }

    const nextTrackId = (trackCounters.get(item.class_name) ?? 0) + 1;
    trackCounters.set(item.class_name, nextTrackId);
    grouped.push({
      ...item,
      startTimestamp: item.timestamp,
      endTimestamp: item.timestamp,
      occurrenceCount: 1,
      trackId: nextTrackId,
      displayLabel: governedObjectDisplayLabel(item.displayLabel),
    });
  }

  return grouped;
}

export interface UploadResponse {
  analysis_id: string;
  filename: string;
  message: string;
  status: string;
  duration?: number;
  size?: number;
  cvatID: number;
  bundle_type?: "analysis" | "project";
  imported_analysis_ids?: string[];
  imported_count?: number;
  project_name?: string;
}

// Updated AnalysisStatus with pipeline_type
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
  source_media_annotations?: Record<string, unknown>;
  annotation_corrections?: AnnotationCorrections | null;
  canonical_decision_ledger?: {
    schema: "vaa1.canonical_decision_ledger.v0";
    analysis_id: string;
    version: 1;
    decisions: Array<Record<string, unknown>>;
  };
  projected_canonical_claims?: import("./api-service").ProjectedCanonicalClaimCollection;
  speaker_prosody_projection?: Record<string, unknown> | null;
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
    cinematic_clues?: {
      shot_size?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          person_count?: number;
          dominant_area_share?: number;
          confidence?: number;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
          interval_summaries?: Array<{
            start: number;
            end: number;
            dominant_label: string;
            distribution?: Record<string, number>;
          }>;
        };
      };
      transition_clues?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          zone_tone_shift?: number;
          occupancy_shift?: number;
          frame_class?: string;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
        };
      };
      movement_hint?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          zone_tone_shift?: number;
          occupancy_shift?: number;
          frame_class?: string;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
        };
      };
      composition_hint?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          left_occupancy?: number;
          center_occupancy?: number;
          right_occupancy?: number;
          frame_class?: string;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
        };
      };
      subject_arrangement_hint?: {
        method?: string;
        samples?: Array<{
          timestamp: number;
          label: string;
          person_count?: number;
          text_count?: number;
          frame_class?: string;
        }>;
        summary?: {
          dominant_label?: string | null;
          sample_count?: number;
          distribution?: Record<string, number>;
        };
      };
    };
    spatial_tone_scan?: {
      summary?: {
        sample_count?: number;
        dominant_frame_class?: string;
        frame_class_distribution?: Record<string, number>;
        dominant_tone_by_zone?: Record<string, string>;
      };
      samples?: Array<{
        timestamp: number;
        frame_class?: string;
        zones?: Record<
          string,
          {
            occupancy_mass?: number;
            person_count?: number;
            text_count?: number;
            object_count?: number;
            dominant_tone?: string;
            brightness_band?: string;
            saturation_band?: string;
          }
        >;
        foreground_activity?: number;
        background_activity?: number;
      }>;
    };
    adaptive_visual_scan?: NonNullable<
      AnalysisData["metadata"]
    >["adaptiveVisualScan"];
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
    shot_boundaries?: {
      method?: string;
      source?: string;
      true_boundary_intervals?: boolean;
      intervals?: Array<{
        shot_id?: string;
        start: number;
        end: number;
        duration?: number;
        confidence?: number;
        review_state?: string;
      }>;
      summary?: Record<string, unknown>;
    };
    expression_samples?: number;
    expression_status?: "completed" | "failed" | "not_run";
    expression_error?: string;
    audio_segments?: number;
    audio_language?: string;
    audio_language_name?: string;
    audio_language_source?: string;
    audio_language_confidence?: number;
    audio_error?: string;
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
    audio_prosody_cues?: number;
    audio_prosody_error?: string;
    audio_diarization_error?: string;
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
        region?: {
          x?: number;
          y?: number;
          w?: number;
          h?: number;
        } | null;
        warnings?: Array<{
          code?: string;
          technical_note?: string;
          user_message?: string;
        }>;
      }>;
      warnings?: Array<{
        code?: string;
        technical_note?: string;
        user_message?: string;
      }>;
    }>;
  } | null;
  download_links?: Record<string, string>;
  forensic_render_jobs?: ForensicRenderJob[];
  source_samples?: SourceSample[];
  identity_refinement?: IdentityRefinementStatus | null;
  second_order_label_proliferation?: SecondOrderLabelProliferationPlan | null;
  narrative_lens_reading?: Record<string, unknown> | null;
  character_path_reading?: Record<string, unknown> | null;
  datascene_meaning_network?: Record<string, unknown> | null;
  mise_en_scene_scene_cards?: Record<string, unknown> | null;
  evidence_proliferation_matches?: EvidenceProliferationMatchSummary[];
  live_mature_data_proliferation_audit?: Record<string, unknown> | null;
  audio_diarization?: AudioDiarizationScaffold | null;
  vaa1_annotation_master_schema?: unknown;
  pipeline_type?: string; // This was missing
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

export class VideoService {
  private static readonly MAX_CSV_PREVIEW_LINES = 50;
  private static readonly analysisCache = new Map<
    string,
    {
      cachedAt: number;
      completedAt?: string;
      correctionUpdatedAt?: string;
      transcriptTimingRepairKey?: string;
      data: AnalysisData;
    }
  >();
  private static readonly analysisPromiseCache = new Map<
    string,
    Promise<AnalysisData>
  >();

  private static invalidateAnalysisCache(id?: string) {
    if (!id) {
      this.analysisCache.clear();
      this.analysisPromiseCache.clear();
      return;
    }
    this.analysisCache.delete(id);
    this.analysisPromiseCache.delete(id);
  }

  /**
   * Upload a video file to the Docker API
   */
  static async upload(
    file: File,
    cvatID: number,
    duration?: number,
  ): Promise<UploadResponse> {
    try {
      const response = await apiService.uploadVideo(file, cvatID);
      return {
        ...response,
        cvatID: cvatID || 0,
        duration: duration || 0,
        size: file.size,
      };
    } catch (error) {
      console.error("VideoService.upload failed:", error);
      throw new Error(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  static async updateCvatLink(id: string, cvatID: number): Promise<void> {
    await apiService.updateCvatLink(id, cvatID);
    this.analysisCache.delete(id);
    this.analysisPromiseCache.delete(id);
  }

  static async importSavedWork(file: File): Promise<UploadResponse> {
    try {
      return await apiService.importSavedWork(file);
    } catch (error) {
      console.error("VideoService.importSavedWork failed:", error);
      throw error;
    }
  }

  /**
   * Get video metadata from Docker API
   */
  static async get(id: string): Promise<VideoMetadata> {
    try {
      // Cast to our extended AnalysisStatus type
      const status = (await apiService.getStatusSummary(id)) as AnalysisStatus;

      return {
        id: status.analysis_id,
        name: status.filename,
        status: status.status,
        progress: status.progress || 0,
        error: status.error,
        missionStage: status.mission_stage,
        missionMessage: status.mission_message,
        uploadedAt: status.uploaded_at,
        analysisStartedAt: status.analysis_started_at,
        analysisCompletedAt: status.analysis_completed_at,
        processingTime: status.processing_time,
        pipelineType: status.pipeline_type as
          | "full"
          | "visual_only"
          | "audio_only",
        analysisTier: status.analysis_tier,
        modalityFocus: status.modality_focus,
        languagePackPolicy: status.language_pack_policy,
        applyFaceAnonymization: status.apply_face_anonymization,
        faceMessageStyle: status.face_message_style,
        faceRequiresPersonDetection: status.face_requires_person_detection,
        cvatID: status.cvatID,
        eventLog: status.event_log || [],
        sourceVideoPath: status.source_video_path,
        sourceVideoExists: status.source_video_exists,
        sourceVideoMessage: status.source_video_message,
      };
    } catch (error) {
      console.error("VideoService.get failed:", error);
      return {
        id,
        name: "Unknown",
        status: "error",
        progress: 0,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load video metadata",
      };
    }
  }

  /**
   * Get video blob (annotated video) from Docker API
   */
  static async getBlob(id: string): Promise<Blob | null> {
    try {
      const status = (await apiService.getStatusSummary(id)) as AnalysisStatus;

      if (status.status === "completed") {
        try {
          return await apiService.downloadFile(id, "source_video");
        } catch {}
        try {
          return await apiService.downloadFile(id, "video");
        } catch {}
      }

      return null;
    } catch (error) {
      console.warn("VideoService.getBlob failed:", error);
      return null;
    }
  }

  /**
   * Get comprehensive analysis results
   */
  static async getAnalysis(id: string): Promise<AnalysisData> {
    const existingPromise = this.analysisPromiseCache.get(id);
    if (existingPromise) {
      return existingPromise;
    }
    const recentlyResolved = this.analysisCache.get(id);
    if (recentlyResolved && Date.now() - recentlyResolved.cachedAt < 5_000) {
      return recentlyResolved.data;
    }

    const loadPromise = (async () => {
    try {
      const status = (await apiService.getStatus(id)) as AnalysisStatus;
      let correctionsPayload: AnnotationCorrections | null =
        status.annotation_corrections || null;
      let correctionUpdatedAt: string | undefined =
        status.annotation_corrections?.updated_at;
      try {
        const fetchedCorrections = await apiService.getAnnotationCorrections(id);
        correctionsPayload = fetchedCorrections || correctionsPayload;
        correctionUpdatedAt =
          fetchedCorrections?.updated_at || correctionUpdatedAt;
      } catch {}
      const timingRepairCacheKey = transcriptTimingRepairCacheKey(status);

      // If analysis is not complete, return minimal data
      if (status.status !== "completed") {
        this.invalidateAnalysisCache(id);
        return {
          quantAnalysis: [],
          posAnalysis: [],
          transcript: [],
          detectedObjects: [],
          rawDetectedObjects: [],
          ocr: [],
          expressionResults: [],
          audioProsody: [],
          quantityDetection: [],
          annotations: [],
          summary: `Analysis ${status.status} (${status.progress}%)`,
          rawCsv: "",
          status: status.status,
          metadata: {
            yoloDetections: 0,
            ocrDetections: 0,
          },
        };
      }

      const cached = this.analysisCache.get(id);
      if (
        cached &&
        cached.completedAt &&
        status.analysis_completed_at &&
        cached.completedAt === status.analysis_completed_at &&
        (cached.correctionUpdatedAt || null) === (correctionUpdatedAt || null) &&
        (cached.transcriptTimingRepairKey || null) === timingRepairCacheKey &&
        (
          !cached.data.audioProsody?.length ||
          Boolean(
            cached.data.audioProsody[0]?.interaction_cues?.role_support &&
              cached.data.audioProsody[0]?.sound_environment?.label,
          )
        )
      ) {
        return cached.data;
      }

      // Load all data in parallel
      const [
        csvData,
        transcriptData,
        trackedObjects,
        rawObjects,
        ocr,
        expressionData,
        audioProsodyData,
        posAnalysisData,
        quantAnalysisData,
      ] = await Promise.allSettled([
        this.loadCsvData(id),
        this.loadTranscriptData(id),
        this.loadTrackedObjects(id),
        this.loadRawDetectedObjects(id),
        this.loadOCR(id),
        this.loadExpressionData(id),
        this.loadAudioProsodyData(id),
        this.loadPosAnalysis(id),
        this.loadQuantAnalysis(id),
      ]);

      const transcriptSegments =
        transcriptData.status === "fulfilled" ? transcriptData.value.segments : [];
      const transcriptTimelineSegments =
        transcriptData.status === "fulfilled"
          ? transcriptData.value.timelineSegments || transcriptData.value.segments
          : [];
      const corrections = correctionsPayload || null;
      const correctedTranscript = applyAnnotationCorrectionsToTranscript(
        transcriptSegments,
        corrections,
      );
      const correctedTranscriptTimeline = applyAnnotationCorrectionsToTranscript(
        transcriptTimelineSegments,
        corrections,
      );
      const correctedPosAnalysis = applyAnnotationCorrectionsToPosAnalysis(
        posAnalysisData.status === "fulfilled" ? posAnalysisData.value : [],
        corrections,
      );
      const correctedQuantAnalysis = applyAnnotationCorrectionsToQuantAnalysis(
        quantAnalysisData.status === "fulfilled" ? quantAnalysisData.value : [],
        corrections,
      );
      const enrichedObjects =
        trackedObjects.status === "fulfilled"
          ? enrichObjectsWithFaceSummaries(
              applyAnnotationCorrectionsToObjects(trackedObjects.value, corrections),
              status.face_results,
              correctedTranscript,
            )
          : [];
      const profiledObjects = annotateScreenPresenceProfiles(enrichedObjects);
      const correctedRawObjects =
        rawObjects.status === "fulfilled"
          ? applyAnnotationCorrectionsToRawObjects(rawObjects.value, corrections)
          : profiledObjects;
      const correctedOCR =
        ocr.status === "fulfilled"
          ? applyAnnotationCorrectionsToOCR(ocr.value, corrections)
          : [];
      const correctedExpressionSamples =
        expressionData.status === "fulfilled"
          ? applyAnnotationCorrectionsToExpressions(expressionData.value, corrections)
          : [];
      const correctedExpressions = correctedExpressionSamples.filter(
        hasExpressionSourceEvidence,
      );
      const expressionSamplingCoverage = {
        sampledFrames: correctedExpressionSamples.length,
        sourceDetections: correctedExpressions.length,
        noFaceOrInvalidSamples:
          correctedExpressionSamples.length - correctedExpressions.length,
      };
      const correctedAudioProsody =
        audioProsodyData.status === "fulfilled"
          ? projectConfirmedSpeakersOntoProsody(
              applyTranscriptClockOffsetToAudioProsody(
                audioProsodyData.value,
                corrections,
                correctedTranscript,
              ),
              correctedTranscript,
            )
          : [];
      const manualVisualObjects = buildManualVisualObjects(corrections);
      const manualAnnotationsByCategory =
        groupManualVisualAnnotationsByCategory(corrections);
      const mergedProfiledObjects = [...profiledObjects, ...manualVisualObjects].sort(
        (left, right) =>
          Number(left.startTimestamp ?? left.timestamp ?? 0) -
          Number(right.startTimestamp ?? right.timestamp ?? 0),
      );
      const mergedRawObjects = [...correctedRawObjects, ...manualVisualObjects].sort(
        (left, right) => Number(left.timestamp ?? 0) - Number(right.timestamp ?? 0),
      );
      const nativeAnnotations = (corrections?.manual_visual_annotations || []).map(
        (entry: ManualVisualAnnotation) => ({
          id: entry.id,
          category: entry.category,
          subcategory: entry.subcategory,
          type: "manual_visual_annotation",
          label: entry.label,
          custom_label: entry.custom_label,
          timestamp_seconds: entry.timestamp_seconds,
          start_seconds: entry.start_seconds,
          end_seconds: entry.end_seconds,
          coordinates: entry.coordinates,
          identity_affirmation: entry.identity_affirmation,
          role_affirmation: entry.role_affirmation,
          audio_foley_note: entry.audio_foley_note,
          open_note: entry.open_note,
          metadata_correlation: entry.metadata_correlation,
          teaches_regime: entry.teaches_regime,
        }),
      );
      const correctedCinematicClues = applyAnnotationCorrectionsToCinematicClues(
        status.summary?.cinematic_clues
          ? {
              shotSize: status.summary.cinematic_clues?.shot_size
                ? {
                    method: status.summary.cinematic_clues.shot_size.method,
                    samples: status.summary.cinematic_clues.shot_size.samples,
                    summary: status.summary.cinematic_clues.shot_size.summary,
                  }
                : undefined,
              transitionClues: status.summary.cinematic_clues?.transition_clues
                ? {
                    method: status.summary.cinematic_clues.transition_clues.method,
                    samples: status.summary.cinematic_clues.transition_clues.samples,
                    summary: status.summary.cinematic_clues.transition_clues.summary,
                  }
                : undefined,
              movementHint: status.summary.cinematic_clues?.movement_hint
                ? {
                    method: status.summary.cinematic_clues.movement_hint.method,
                    samples: status.summary.cinematic_clues.movement_hint.samples,
                    summary: status.summary.cinematic_clues.movement_hint.summary,
                  }
                : undefined,
              compositionHint: status.summary.cinematic_clues?.composition_hint
                ? {
                    method: status.summary.cinematic_clues.composition_hint.method,
                    samples: status.summary.cinematic_clues.composition_hint.samples,
                    summary: status.summary.cinematic_clues.composition_hint.summary,
                  }
                : undefined,
              subjectArrangementHint: status.summary.cinematic_clues?.subject_arrangement_hint
                ? {
                    method: status.summary.cinematic_clues.subject_arrangement_hint.method,
                    samples: status.summary.cinematic_clues.subject_arrangement_hint.samples,
                    summary: status.summary.cinematic_clues.subject_arrangement_hint.summary,
                  }
                : undefined,
            }
          : undefined,
        corrections,
      );
      const audioAnalysisStatus = asLooseRecord(
        asLooseRecord((status as unknown as LooseRecord).results)?.audio_analysis,
      );
      const audioDiarizationStatus = asLooseRecord(
        status.audio_diarization ||
        audioAnalysisStatus?.audio_diarization ||
        null,
      ) as AudioDiarizationScaffold;
      const masterSchemaResolvedEvidence = buildMasterSchemaResolvedEvidenceView({
        transcript: correctedTranscript,
        objects: mergedProfiledObjects,
        ocr: correctedOCR,
        expressions: correctedExpressions,
        nativeAnnotations,
        corrections,
        identityRefinement: status.identity_refinement || null,
        secondOrderLabelProliferation: status.second_order_label_proliferation || null,
        evidenceProliferationMatches: status.evidence_proliferation_matches || [],
        masterSchema: status.vaa1_annotation_master_schema,
        analysisId: id,
        sourceMediaMetadata: status.source_media_metadata,
        sceneCardSummary: status.mise_en_scene_scene_cards || null,
        audioDiarization: audioDiarizationStatus,
        audioProsody: correctedAudioProsody,
      });
      const masterSchemaAudioEvents = masterSchemaAudioEventIntervals(status.vaa1_annotation_master_schema);
      const governedAudioEvents =
        canonicalAudioEventIntervals(status) || masterSchemaAudioEvents;
      const masterSchemaShotIntervals = masterSchemaShotBoundaries(status.vaa1_annotation_master_schema);
      const masterSchemaFoundationalLayers = asLooseRecord(
        asLooseRecord(status.vaa1_annotation_master_schema)?.foundational_source_layers,
      );
      const audioSampleCloudsStatus = asLooseRecord(
        (status as unknown as LooseRecord).audio_sample_clouds ||
        audioAnalysisStatus?.audio_sample_clouds ||
        null,
      );
      const audioDiarizationTurnCountRaw =
        audioDiarizationStatus?.turn_count ??
        (Array.isArray(audioDiarizationStatus?.speaker_turns)
          ? audioDiarizationStatus.speaker_turns.length
          : undefined);
      const audioDiarizationTurnCount = Number(audioDiarizationTurnCountRaw);
      const entityRegistry = buildDatasceneEntityRegistryView({
        analysisId: id,
        transcript: correctedTranscript,
        objects: mergedProfiledObjects,
        ocr: correctedOCR,
        nativeAnnotations,
        sourceSamples: status.source_samples || [],
        sourceMediaMetadata: status.source_media_metadata || undefined,
        masterSchemaResolvedEvidence,
      });
      const contentSearch = buildDatasceneContentSearchView({
        analysisId: id,
        entityRegistry,
        liveMatureDataProliferationAudit:
          status.live_mature_data_proliferation_audit || null,
        transcript: correctedTranscript,
        objects: mergedProfiledObjects,
        ocr: correctedOCR,
        sourceMediaAnnotations: status.source_media_annotations || null,
      });

      const analysisData = {
        analysisId: id,
        quantAnalysis: correctedQuantAnalysis,
        posAnalysis: correctedPosAnalysis,
        transcript: correctedTranscript,
        transcriptTimeline: correctedTranscriptTimeline,
        detectedObjects: mergedProfiledObjects,
        rawDetectedObjects: mergedRawObjects,
        faceResults: status.face_results,
        ocr: correctedOCR,
        expressionResults: correctedExpressions,
        expressionSamplingCoverage,
        audioProsody: correctedAudioProsody,
        speakerProsodyProjection: status.speaker_prosody_projection || null,
        quantityDetection: mergedProfiledObjects,
        annotations: nativeAnnotations,
        manualAnnotationsByCategory,
        masterSchemaResolvedEvidence,
        entityRegistry,
        contentSearch,
        annotationCorrections: corrections,
        canonicalDecisionLedger: status.canonical_decision_ledger,
        projectedCanonicalClaims: status.projected_canonical_claims,
        forensicRenderJobs: status.forensic_render_jobs || [],
        sourceSamples: status.source_samples || [],
        identityRefinement: status.identity_refinement || null,
        secondOrderLabelProliferation: status.second_order_label_proliferation || null,
        narrativeLensReading: status.narrative_lens_reading || null,
        characterPathReading: status.character_path_reading || null,
        datasceneMeaningNetwork: status.datascene_meaning_network || null,
        miseEnSceneSceneCards: status.mise_en_scene_scene_cards || null,
        evidenceProliferationMatches: status.evidence_proliferation_matches || [],
        liveMatureDataProliferationAudit:
          status.live_mature_data_proliferation_audit || null,
        audioDiarization: audioDiarizationStatus,
        audioSampleClouds: audioSampleCloudsStatus,
        summary: this.generateSummary(status),
        rawCsv: csvData.status === "fulfilled" ? csvData.value : "",
        rawJson: {
          vaa1_annotation_master_schema: status.vaa1_annotation_master_schema,
          narrative_lens_reading: status.narrative_lens_reading || null,
          character_path_reading: status.character_path_reading || null,
          datascene_meaning_network: status.datascene_meaning_network || null,
          mise_en_scene_scene_cards: status.mise_en_scene_scene_cards || null,
          audio_event_intervals:
            (status as unknown as LooseRecord).audio_event_intervals || null,
          audio_diarization: status.audio_diarization || null,
        },
        status: "completed",
        downloadLinks: status.download_links,
        metadata: {
          sourceName: status.filename,
          sourceMediaMetadata: status.source_media_metadata || undefined,
          masterSchemaMaturityAudit: masterSchemaMaturityAudit(
            status.vaa1_annotation_master_schema,
          ),
          sourceAnnotations: {
            genre: status.source_media_metadata?.user_annotations?.genre,
            genre_subtype: status.source_media_metadata?.user_annotations?.genre_subtype,
            situational_genre:
              status.source_media_metadata?.user_annotations?.situational_genre,
            situational_subtype:
              status.source_media_metadata?.user_annotations?.situational_subtype,
          },
          yoloDetections: status.summary?.yolo_detections || 0,
          ocrDetections: status.summary?.ocr_detections || 0,
          transcriptQuality: transcriptQualityForDisplay(transcriptData, status),
          cinematicClues: correctedCinematicClues,
          spatialToneScan: status.summary?.spatial_tone_scan
            ? {
                summary: status.summary.spatial_tone_scan.summary,
                samples: status.summary.spatial_tone_scan.samples,
              }
            : undefined,
          adaptiveVisualScan: status.summary?.adaptive_visual_scan
            ? {
                parameters: status.summary.adaptive_visual_scan.parameters,
                summary: status.summary.adaptive_visual_scan.summary,
                samples: status.summary.adaptive_visual_scan.samples,
              }
            : undefined,
          motionSceneBasis:
            status.summary?.motion_evidence || status.summary?.scene_segments || masterSchemaShotIntervals
              ? {
                  motionEvidence: status.summary?.motion_evidence
                    ? {
                        method: status.summary.motion_evidence.method,
                        samples: status.summary.motion_evidence.samples,
                        summary: status.summary.motion_evidence.summary,
                      }
                    : undefined,
                  sceneSegments: status.summary?.scene_segments
                    ? {
                        method: status.summary.scene_segments.method,
                        source: status.summary.scene_segments.source,
                        segments: status.summary.scene_segments.segments,
                        summary: status.summary.scene_segments.summary,
                      }
                    : undefined,
                  shotBoundaries: masterSchemaShotIntervals ||
                    (status.summary?.shot_boundaries
                      ? {
                          method: status.summary.shot_boundaries.method,
                          source: status.summary.shot_boundaries.source,
                          true_boundary_intervals: status.summary.shot_boundaries.true_boundary_intervals,
                          intervals: status.summary.shot_boundaries.intervals,
                          summary: status.summary.shot_boundaries.summary,
                        }
                      : undefined),
                }
              : undefined,
          foundationalSourceLayers: masterSchemaFoundationalLayers || undefined,
          audioEventIntervals: governedAudioEvents,
          audioSegments: status.summary?.audio_segments,
          audioProsodyCues: status.summary?.audio_prosody_cues,
          audioLanguage:
            status.summary?.audio_language ||
            (transcriptData.status === "fulfilled"
              ? transcriptData.value.languageProfile?.code
              : undefined),
          audioLanguageName:
            status.summary?.audio_language_name ||
            (transcriptData.status === "fulfilled"
              ? transcriptData.value.languageProfile?.name
              : undefined),
          audioLanguageSource:
            status.summary?.audio_language_source ||
            (transcriptData.status === "fulfilled"
              ? transcriptData.value.languageProfile?.source
              : undefined),
          audioLanguageConfidence:
            status.summary?.audio_language_confidence ??
            (transcriptData.status === "fulfilled"
              ? transcriptData.value.languageProfile?.confidence
              : undefined),
          audioError: status.summary?.audio_error,
          audioProsodyError: status.summary?.audio_prosody_error,
          audioDiarizationError: status.summary?.audio_diarization_error,
          audioDiarizationTurns: Number.isFinite(audioDiarizationTurnCount)
            ? audioDiarizationTurnCount
            : undefined,
          posError: status.summary?.pos_error,
          quantError: status.summary?.quan_error,
          languageSupport:
            status.summary?.language_profile?.support ||
            status.summary?.language_support ||
            (transcriptData.status === "fulfilled"
              ? transcriptData.value.languageProfile?.support
              : undefined),
          languageProfile:
            status.summary?.language_profile ||
            (transcriptData.status === "fulfilled"
              ? transcriptData.value.languageProfile
              : undefined),
          expressionSamples: status.summary?.expression_samples,
          expressionStatus: status.summary?.expression_status,
          expressionError: status.summary?.expression_error,
          faceFramesConsidered: status.summary?.face_frames_considered,
          faceFramesSelected: status.summary?.face_frames_selected,
          faceFramesSkippedNoPerson:
            status.summary?.face_frames_skipped_no_person,
        },
      };
      this.analysisCache.set(id, {
        cachedAt: Date.now(),
        completedAt: status.analysis_completed_at,
        correctionUpdatedAt: correctionUpdatedAt || undefined,
        transcriptTimingRepairKey: timingRepairCacheKey,
        data: analysisData,
      });
      return analysisData;
    } catch (error) {
      console.error("VideoService.getAnalysis failed:", error);
      throw error;
    }
    })();

    this.analysisPromiseCache.set(id, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.analysisPromiseCache.delete(id);
    }
  }

  /**
   * Start analysis for a video
   */
  static async startAnalysis(
    id: string,
    pipelineType: "full" | "visual_only" | "audio_only" = "full",
    options: AnalysisStartOptions = {},
  ): Promise<any> {
    try {
      this.invalidateAnalysisCache(id);
      return await apiService.startAnalysis(id, pipelineType, options);
    } catch (error) {
      console.error("VideoService.startAnalysis failed:", error);
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
      console.error("VideoService.exportFile failed:", error);
      throw error;
    }
  }

  static async saveAnnotationCorrections(
    id: string,
    corrections: AnnotationCorrections,
  ): Promise<AnnotationCorrections> {
    const saved = await apiService.saveAnnotationCorrections(id, corrections);
    this.invalidateAnalysisCache(id);
    return saved;
  }

  static async getProjectedSubjectState(
    id: string,
    subjectRef: string,
    timestampSeconds: number,
  ) {
    return apiService.getProjectedSubjectState(id, subjectRef, timestampSeconds);
  }

  static async resolveSourceClock(
    id: string,
    payload: Parameters<typeof apiService.resolveSourceClock>[1],
  ) {
    return apiService.resolveSourceClock(id, payload);
  }

  static async getProjectedSubjectStates(
    id: string,
    requests: Array<{ subject_ref: string; timestamp: number }>,
  ) {
    return apiService.getProjectedSubjectStates(id, requests);
  }

  static async createCanonicalDecision(
    id: string,
    decision: import("./api-service").CanonicalDecisionInput,
  ) {
    return apiService.createCanonicalDecision(id, decision);
  }

  static async getProjectedCanonicalClaims(
    id: string,
    request: Parameters<typeof apiService.getProjectedCanonicalClaims>[1],
  ) {
    return apiService.getProjectedCanonicalClaims(id, request);
  }

  static async invalidateCanonicalDecision(
    id: string,
    invalidation: Parameters<typeof apiService.invalidateCanonicalDecision>[1],
  ) {
    return apiService.invalidateCanonicalDecision(id, invalidation);
  }

  static async refreshAnalysis(id: string): Promise<AnalysisData> {
    this.invalidateAnalysisCache(id);
    return this.getAnalysis(id);
  }

  static async exportBundle(id: string, filename?: string): Promise<void> {
    try {
      await apiService.downloadAndSaveBundle(id, filename);
    } catch (error) {
      console.error("VideoService.exportBundle failed:", error);
      throw error;
    }
  }

  static async exportProjectBundle(
    payload: Record<string, unknown>,
    filename?: string,
  ): Promise<void> {
    try {
      await apiService.downloadAndSaveProjectBundle(payload, filename);
    } catch (error) {
      console.error("VideoService.exportProjectBundle failed:", error);
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
        name: info.filename || "Unknown",
        status: info.status || "unknown",
        progress: info.progress || 0,
        uploadedAt:
          info.uploaded_at ||
          (info.start_time
            ? new Date(info.start_time * 1000).toISOString()
            : undefined),
        analysisCompletedAt: info.analysis_completed_at,
        pipelineType: info.pipeline_type,
        analysisTier: info.analysis_tier,
        modalityFocus: info.modality_focus,
        cvatID: info.cvatID,
      }));
    } catch (error) {
      console.warn(
        "VideoService.listVideos failed, returning empty array:",
        error,
      );
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
    timeout: number = 300000, // 5 minutes
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
      this.invalidateAnalysisCache(id);
      await apiService.deleteAnalysis(id);
    } catch (error) {
      console.error("VideoService.deleteAnalysis failed:", error);
      throw error;
    }
  }

  static async clearSession(): Promise<{
    message: string;
    cleared_analysis_ids: string[];
    skipped_processing_ids: string[];
  }> {
    try {
      this.invalidateAnalysisCache();
      return await apiService.clearSession();
    } catch (error) {
      console.error("VideoService.clearSession failed:", error);
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
        name: newName,
      };
    } catch (error) {
      console.error("VideoService.rename failed:", error);
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
      console.error("VideoService.updateTag failed:", error);
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
  static async list(limit: number = 20): Promise<VideoMetadata[]> {
    return this.listVideos(limit);
  }

  // Private helper methods

  private static async loadCsvData(id: string): Promise<string> {
    try {
      const csvBlob = await apiService.downloadFile(id, "yolo_csv");
      const csvText = await csvBlob.text();

      // Limit preview size for performance
      const lines = csvText.split("\n");
      if (lines.length > this.MAX_CSV_PREVIEW_LINES + 1) {
        const header = lines[0];
        const preview = lines.slice(1, this.MAX_CSV_PREVIEW_LINES + 1);
        return [
          header,
          ...preview,
          `\n... ${lines.length - this.MAX_CSV_PREVIEW_LINES - 1} more rows`,
        ].join("\n");
      }

      return csvText;
    } catch (error) {
      console.warn("Failed to load CSV data:", error);
      return "CSV data not available";
    }
  }

  private static async loadTranscriptData(
    id: string,
  ): Promise<TranscriptDataBundle> {
    try {
      const transcriptBlob = await apiService.downloadFile(id, "transcript");
      const transcriptText = await transcriptBlob.text();
      let transcriptData = JSON.parse(transcriptText);
      if (
        !rawTranscriptPayloadHasTimingAuthority(transcriptData) &&
        rawTranscriptPayloadLooksLikeScaffold(transcriptData)
      ) {
        try {
          const noCacheToken = Date.now().toString(36);
          const localResponse = await fetch(
            `/api/local-analysis/${id}/download/transcript?_=${noCacheToken}`,
            { cache: "no-store" },
          );
          if (localResponse.ok) {
            const localTranscriptData = await localResponse.json();
            if (rawTranscriptPayloadHasTimingAuthority(localTranscriptData)) {
              transcriptData = localTranscriptData;
            }
          }
        } catch (fallbackError) {
          console.warn("Authoritative local transcript fallback failed:", fallbackError);
        }
      }
      transcriptData = buildWhisperClockPayloadWithMatureAnnotations(transcriptData);
      const payloadCandidateOnlyTiming = [
        "chunked_fallback",
        "tail_recovery_fallback",
        "quick_sweep_transcript",
        "quick_sweep_transcript_priority",
        "fallback_candidate",
        "scaffold",
      ].includes(String(transcriptData?.transcription_strategy || ""));
      const normalizeSegment = (seg: any): TranscriptSegment => {
        const timing = normalizeTranscriptSegmentTiming(seg || {});
        const candidateOnlyTiming =
          (payloadCandidateOnlyTiming || transcriptRowHasCandidateOnlyTiming(seg)) && !segmentHasRepairedTimingAuthority({
            ...timing,
            timingStatus: seg.timing_status || seg.timingStatus,
            timingAuthority: seg.timing_authority || seg.timingAuthority,
            timingSource: seg.timing_source || seg.timingSource,
            sourceTimeValid: seg.source_time_valid ?? seg.sourceTimeValid,
          } as TranscriptSegment);
        return {
          ...timing,
          start: candidateOnlyTiming ? Number.NaN : timing.start,
          end: candidateOnlyTiming ? Number.NaN : timing.end,
          text: seg.text || "",
          rawText: seg.raw_text || seg.rawText || seg.text || "",
          speaker: seg.speaker || seg.speaker_label || "Speaker 1",
          sourceStart: Number(seg.source_start ?? seg.sourceStart ?? timing.start),
          sourceEnd: Number(seg.source_end ?? seg.sourceEnd ?? timing.end),
          segmentType: seg.segment_type || "utterance",
          synthetic: Boolean(seg.synthetic),
          timingStatus: seg.timing_status || seg.timingStatus,
          timingAuthority: seg.timing_authority || seg.timingAuthority,
          timingSource: seg.timing_source || seg.timingSource,
          sourceTimingStatus: seg.source_timing_status || seg.sourceTimingStatus,
          sourceTimeValid: seg.source_time_valid ?? seg.sourceTimeValid,
        };
      };

      return {
        segments: (transcriptData.segments || []).map(normalizeSegment),
        timelineSegments: (
          transcriptData.timeline_segments || transcriptData.segments || []
        ).map(normalizeSegment),
        quality: transcriptData.quality,
        languageProfile: transcriptData.language_info
          ? {
              code: transcriptData.language_info.code ?? transcriptData.language,
              name:
                transcriptData.language_info.name ?? transcriptData.language_name,
              iso6393: transcriptData.language_info.iso6393 ?? null,
              source: transcriptData.language_info.source,
              confidence: transcriptData.language_info.confidence,
              hint: transcriptData.language_info.hint ?? null,
              text_guess: transcriptData.language_info.text_guess,
              support: transcriptData.language_info.support,
            }
          : undefined,
      };
    } catch (error) {
      console.warn("Failed to load transcript:", error);
      return { segments: [] };
    }
  }

  private static async loadTrackedObjects(
    id: string,
  ): Promise<DetectedObject[]> {
    try {
      let csvBlob: Blob;
      try {
        csvBlob = await apiService.downloadFile(id, "tracked_objects_csv");
      } catch {
        csvBlob = await apiService.downloadFile(id, "yolo_csv");
      }
      const csvText = await csvBlob.text();

      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as any[];

      return records.map((row) => ({
        timestamp: row.timestamp ? Number(row.timestamp) : 0,
        class_id: row.class_id ? Number(row.class_id) : 0,
        class_name: row.label || row.class_name || "",
        confidence: Number(row.confidence) ? Number(row.confidence) : 0,
        startTimestamp:
          row.start_timestamp !== undefined ? Number(row.start_timestamp) : undefined,
        endTimestamp:
          row.end_timestamp !== undefined ? Number(row.end_timestamp) : undefined,
        occurrenceCount:
          row.occurrence_count !== undefined ? Number(row.occurrence_count) : undefined,
        trackId: row.track_id !== undefined ? Number(row.track_id) : undefined,
        displayLabel: row.display_label || undefined,
        bbox:
          row.bbox_x1 !== undefined ||
          row.bbox_y1 !== undefined ||
          row.bbox_x2 !== undefined ||
          row.bbox_y2 !== undefined
            ? {
                x1: row.bbox_x1 !== undefined ? Number(row.bbox_x1) : undefined,
                y1: row.bbox_y1 !== undefined ? Number(row.bbox_y1) : undefined,
                x2: row.bbox_x2 !== undefined ? Number(row.bbox_x2) : undefined,
                y2: row.bbox_y2 !== undefined ? Number(row.bbox_y2) : undefined,
              }
            : undefined,
      }));
    } catch (error) {
      console.warn("Failed to parse tracked objects:", error);
      return [];
    }
  }

  private static async loadRawDetectedObjects(
    id: string,
  ): Promise<DetectedObject[]> {
    try {
      const csvBlob = await apiService.downloadFile(id, "yolo_csv");
      const csvText = await csvBlob.text();

      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as any[];

      return records.map((row) => ({
        timestamp: row.timestamp ? Number(row.timestamp) : 0,
        class_id: row.class_id ? Number(row.class_id) : 0,
        class_name: row.label || row.class_name || "",
        confidence: Number(row.confidence) ? Number(row.confidence) : 0,
        bbox:
          row.bbox_x1 !== undefined ||
          row.bbox_y1 !== undefined ||
          row.bbox_x2 !== undefined ||
          row.bbox_y2 !== undefined
            ? {
                x1: row.bbox_x1 !== undefined ? Number(row.bbox_x1) : undefined,
                y1: row.bbox_y1 !== undefined ? Number(row.bbox_y1) : undefined,
                x2: row.bbox_x2 !== undefined ? Number(row.bbox_x2) : undefined,
                y2: row.bbox_y2 !== undefined ? Number(row.bbox_y2) : undefined,
              }
            : undefined,
      }));
    } catch (error) {
      console.warn("Failed to parse raw detected objects:", error);
      return [];
    }
  }

  private static async loadAudioProsodyData(
    id: string,
  ): Promise<AudioProsodyCue[]> {
    try {
      const prosodyBlob = await apiService.downloadFile(id, "audio_prosody");
      const prosodyText = await prosodyBlob.text();
      const prosodyData = JSON.parse(prosodyText);
      return Array.isArray(prosodyData?.cues)
        ? prosodyData.cues.map((cue: any) => normalizeAudioProsodyCue(cue))
        : [];
    } catch (error) {
      console.warn("Failed to load audio prosody:", error);
      return [];
    }
  }


  /**
   * Load OCR data
   */
  private static parseOCRBoundingBox(rawBbox: unknown): OCR["bbox"] | undefined {
    if (!rawBbox) {
      return undefined;
    }

    const toBounds = (points: Array<[number, number]>) => {
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
      };
    };

    if (Array.isArray(rawBbox)) {
      const points = rawBbox
        .map((point) =>
          Array.isArray(point) && point.length >= 2
            ? [Number(point[0]), Number(point[1])] as [number, number]
            : null,
        )
        .filter(Boolean) as Array<[number, number]>;
      return points.length > 0 ? toBounds(points) : undefined;
    }

    if (typeof rawBbox === "string") {
      const matches = rawBbox.match(/-?\d+(?:\.\d+)?/g);
      if (!matches || matches.length < 4) {
        return undefined;
      }

      const numbers = matches.map(Number);
      const points: Array<[number, number]> = [];
      for (let index = 0; index < numbers.length - 1; index += 2) {
        points.push([numbers[index], numbers[index + 1]]);
      }
      return points.length > 0 ? toBounds(points) : undefined;
    }

    return undefined;
  }

  private static async loadOCR(
    id: string,
  ): Promise<OCR[]> {
        try {
      const csvBlob = await apiService.downloadFile(id, "ocr_csv");
      const csvText = await csvBlob.text();

      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as any[];

      return records.map((row) => ({
        timestamp: row.timestamp ? Number(row.timestamp) : 0,
        text: row.label || row.text || "",
        confidence: Number(row.confidence) ? Number(row.confidence) : 0,
        bbox: this.parseOCRBoundingBox(row.bbox),
      }));
    } catch (error) {
      console.warn("Failed to parse detected objects:", error);
      return [];
    }
  }

  /**
   * Load expression analysis data
   */
  private static async loadExpressionData(
    id: string,
  ): Promise<ExpressionSample[]> {
    try {
      const expressionBlob = await apiService.downloadFile(id, "expression_json");
      const expressionText = await expressionBlob.text();
      const expressionData = JSON.parse(expressionText);

      if (!Array.isArray(expressionData)) {
        return [];
      }

      const normalizeExpressionBox = (
        rawBbox: unknown,
      ): ExpressionSample["bbox"] | undefined => {
        if (!rawBbox) {
          return undefined;
        }

        if (Array.isArray(rawBbox) && rawBbox.length >= 4) {
          return {
            x: rawBbox[0] !== undefined ? Number(rawBbox[0]) : undefined,
            y: rawBbox[1] !== undefined ? Number(rawBbox[1]) : undefined,
            w: rawBbox[2] !== undefined ? Number(rawBbox[2]) : undefined,
            h: rawBbox[3] !== undefined ? Number(rawBbox[3]) : undefined,
          };
        }

        if (typeof rawBbox === "object" && rawBbox !== null) {
          const box = rawBbox as Record<string, unknown>;
          return {
            x: box.x !== undefined ? Number(box.x) : undefined,
            y: box.y !== undefined ? Number(box.y) : undefined,
            w: box.w !== undefined ? Number(box.w) : undefined,
            h: box.h !== undefined ? Number(box.h) : undefined,
          };
        }

        return undefined;
      };

      return expressionData.map((sample: any) => ({
        timestamp: Number(sample.timestamp) || 0,
        frame_index:
          sample.frame_index !== undefined ? Number(sample.frame_index) : undefined,
        face_id: sample.face_id !== undefined ? Number(sample.face_id) : undefined,
        dominant_emotion: sample.dominant_emotion ?? null,
        emotion:
          typeof sample.emotion === "object" && sample.emotion !== null
            ? sample.emotion
            : null,
        top_emotion_score:
          sample.top_emotion_score !== undefined
            ? Number(sample.top_emotion_score)
            : null,
        score_margin:
          sample.score_margin !== undefined ? Number(sample.score_margin) : null,
        quality: sample.quality ?? null,
        face_signal:
          sample.face_signal && typeof sample.face_signal === "object"
            ? {
                level: sample.face_signal.level ?? null,
                face_count_in_frame:
                  sample.face_signal.face_count_in_frame !== undefined
                    ? Number(sample.face_signal.face_count_in_frame)
                    : null,
                face_area_share:
                  sample.face_signal.face_area_share !== undefined
                    ? Number(sample.face_signal.face_area_share)
                    : null,
              }
            : undefined,
        expression_evidence:
          sample.expression_evidence && typeof sample.expression_evidence === "object"
            ? {
                level: sample.expression_evidence.level ?? null,
                dominant_emotion_ready:
                  sample.expression_evidence.dominant_emotion_ready !== undefined
                    ? Boolean(sample.expression_evidence.dominant_emotion_ready)
                    : undefined,
                top_score:
                  sample.expression_evidence.top_score !== undefined
                    ? Number(sample.expression_evidence.top_score)
                    : null,
                score_margin:
                  sample.expression_evidence.score_margin !== undefined
                    ? Number(sample.expression_evidence.score_margin)
                    : null,
              }
            : undefined,
        affect_hints:
          sample.affect_hints && typeof sample.affect_hints === "object"
            ? {
                valence: sample.affect_hints.valence ?? null,
                activation: sample.affect_hints.activation ?? null,
                confidence: sample.affect_hints.confidence ?? null,
              }
            : undefined,
        social_function_profile:
          sample.social_function_profile &&
          typeof sample.social_function_profile === "object"
            ? {
                authority_signal:
                  sample.social_function_profile.authority_signal !== undefined
                    ? Number(sample.social_function_profile.authority_signal)
                    : null,
                affiliation_signal:
                  sample.social_function_profile.affiliation_signal !== undefined
                    ? Number(sample.social_function_profile.affiliation_signal)
                    : null,
                persuasion_signal:
                  sample.social_function_profile.persuasion_signal !== undefined
                    ? Number(sample.social_function_profile.persuasion_signal)
                    : null,
                distance_signal:
                  sample.social_function_profile.distance_signal !== undefined
                    ? Number(sample.social_function_profile.distance_signal)
                    : null,
                reassurance_signal:
                  sample.social_function_profile.reassurance_signal !== undefined
                    ? Number(sample.social_function_profile.reassurance_signal)
                    : null,
              }
            : undefined,
        interpreted_expression:
          sample.interpreted_expression &&
          typeof sample.interpreted_expression === "object"
            ? {
                label: sample.interpreted_expression.label ?? null,
                confidence: sample.interpreted_expression.confidence ?? null,
                near_neighbors: Array.isArray(sample.interpreted_expression.near_neighbors)
                  ? sample.interpreted_expression.near_neighbors
                  : [],
                social_function: Array.isArray(sample.interpreted_expression.social_function)
                  ? sample.interpreted_expression.social_function
                  : [],
                basis: Array.isArray(sample.interpreted_expression.basis)
                  ? sample.interpreted_expression.basis
                  : [],
              }
            : undefined,
        error: sample.error ?? null,
        bbox: normalizeExpressionBox(sample.bbox),
      }));
    } catch (error) {
      console.warn("Failed to load expression analysis:", error);
      return [];
    }
  }


  /**
   * Load POS Analysis data
   */
  private static async loadPosAnalysis(id: string): Promise<POSAnalysis[]> {
    try {
      const posBlob = await apiService.downloadFile(id, "pos_analysis");
      const posText = await posBlob.text();
      const posData = JSON.parse(posText);

      // Helper to normalize a single POSAnalysis object
      const normalize = (data: any): POSAnalysis => ({
        text: data.text || "",
        analysis_mode: data.analysis_mode || undefined,
        token_count:
          data.token_count !== undefined ? Number(data.token_count) : undefined,
        notes: Array.isArray(data.notes) ? data.notes : [],
        confidence_profile: data.confidence_profile
          ? {
              overall: data.confidence_profile.overall
                ? {
                    level: data.confidence_profile.overall.level,
                    score:
                      data.confidence_profile.overall.score !== undefined
                        ? Number(data.confidence_profile.overall.score)
                        : undefined,
                    source: data.confidence_profile.overall.source,
                    triangulation_ready:
                      data.confidence_profile.overall.triangulation_ready,
                    timestamp_ready:
                      data.confidence_profile.overall.timestamp_ready,
                  }
                : undefined,
              pos_words: data.confidence_profile.pos_words
                ? {
                    level: data.confidence_profile.pos_words.level,
                    score:
                      data.confidence_profile.pos_words.score !== undefined
                        ? Number(data.confidence_profile.pos_words.score)
                        : undefined,
                    source: data.confidence_profile.pos_words.source,
                    triangulation_ready:
                      data.confidence_profile.pos_words.triangulation_ready,
                    timestamp_ready:
                      data.confidence_profile.pos_words.timestamp_ready,
                  }
                : undefined,
              interrogatives: data.confidence_profile.interrogatives
                ? Object.fromEntries(
                    Object.entries(data.confidence_profile.interrogatives).map(
                      ([key, value]: [string, any]) => [
                        key,
                        {
                          level: value?.level,
                          score:
                            value?.score !== undefined
                              ? Number(value.score)
                              : undefined,
                          source: value?.source,
                          triangulation_ready: value?.triangulation_ready,
                          timestamp_ready: value?.timestamp_ready,
                        },
                      ],
                    ),
                  )
                : undefined,
            }
          : undefined,
        pos_counts: {
          NOUN: Number(data.pos_counts?.NOUN) || 0,
          VERB: Number(data.pos_counts?.VERB) || 0,
          ADJ: Number(data.pos_counts?.ADJ) || 0,
          ADP: Number(data.pos_counts?.ADP) || 0,
          ADV: Number(data.pos_counts?.ADV) || 0,
          PRON: Number(data.pos_counts?.PRON) || 0,
          DET: Number(data.pos_counts?.DET) || 0,
          CONJ: Number(data.pos_counts?.CONJ) || 0,
          AUX_MODAL: Number(data.pos_counts?.AUX_MODAL) || 0,
        },
        pos_ratios: {
          verb_noun_ratio: Number(data.pos_ratios?.verb_noun_ratio) || 0,
          modal_density: Number(data.pos_ratios?.modal_density) || 0,
          pronoun_share: Number(data.pos_ratios?.pronoun_share) || 0,
          adj_adv_ratio: Number(data.pos_ratios?.adj_adv_ratio) || 0,
          nominalization_density:
            Number(data.pos_ratios?.nominalization_density) || 0,
        },
        interrogative_lens: {
          who: Array.isArray(data.interrogative_lens?.who)
            ? data.interrogative_lens.who
            : [],
          what: Array.isArray(data.interrogative_lens?.what)
            ? data.interrogative_lens.what
            : [],
          when: Array.isArray(data.interrogative_lens?.when)
            ? data.interrogative_lens.when
            : [],
          where: Array.isArray(data.interrogative_lens?.where)
            ? data.interrogative_lens.where
            : [],
          why: Array.isArray(data.interrogative_lens?.why)
            ? data.interrogative_lens.why
            : [],
          how: Array.isArray(data.interrogative_lens?.how)
            ? data.interrogative_lens.how
            : [],
          by_what_means: Array.isArray(data.interrogative_lens?.by_what_means)
            ? data.interrogative_lens.by_what_means
            : [],
          towards_what_end: Array.isArray(
            data.interrogative_lens?.towards_what_end,
          )
            ? data.interrogative_lens.towards_what_end
            : [],
          whence: Array.isArray(data.interrogative_lens?.whence)
            ? data.interrogative_lens.whence
            : [],
          by_what_consequence: Array.isArray(
            data.interrogative_lens?.by_what_consequence,
          )
            ? data.interrogative_lens.by_what_consequence
            : [],
        },
        pos_words: {
          NOUN: Array.isArray(data.pos_words?.NOUN) ? data.pos_words.NOUN : [],
          VERB: Array.isArray(data.pos_words?.VERB) ? data.pos_words.VERB : [],
          ADJ: Array.isArray(data.pos_words?.ADJ) ? data.pos_words.ADJ : [],
          ADV: Array.isArray(data.pos_words?.ADV) ? data.pos_words.ADV : [],
          ADP: Array.isArray(data.pos_words?.ADP) ? data.pos_words.ADP : [],
          PRON: Array.isArray(data.pos_words?.PRON) ? data.pos_words.PRON : [],
          DET: Array.isArray(data.pos_words?.DET) ? data.pos_words.DET : [],
          CONJ: Array.isArray(data.pos_words?.CONJ) ? data.pos_words.CONJ : [],
          INTJ: Array.isArray(data.pos_words?.INTJ) ? data.pos_words.INTJ : [],
          AUX_MODAL: Array.isArray(data.pos_words?.AUX_MODAL)
            ? data.pos_words.AUX_MODAL
            : [],
        },
        grammar_profile: data.grammar_profile
          ? {
              content_words: data.grammar_profile.content_words
                ? {
                    count:
                      Number(data.grammar_profile.content_words.count) || 0,
                    categories:
                      data.grammar_profile.content_words.categories || {},
                  }
                : undefined,
              function_words: data.grammar_profile.function_words
                ? {
                    count:
                      Number(data.grammar_profile.function_words.count) || 0,
                    categories:
                      data.grammar_profile.function_words.categories || {},
                  }
                : undefined,
            }
          : undefined,
        tense_profile: data.tense_profile
          ? {
              available: Boolean(data.tense_profile.available),
              counts: data.tense_profile.counts || {},
              examples: data.tense_profile.examples || {},
              tense_counts: data.tense_profile.tense_counts || {},
              tense_examples: data.tense_profile.tense_examples || {},
              tense_labels: data.tense_profile.tense_labels || {},
              verb_form_counts: data.tense_profile.verb_form_counts || {},
              verb_form_examples: data.tense_profile.verb_form_examples || {},
              verb_form_labels: data.tense_profile.verb_form_labels || {},
              note: data.tense_profile.note,
            }
          : undefined,
        case_profile: data.case_profile
          ? {
              available: Boolean(data.case_profile.available),
              counts: data.case_profile.counts || {},
              examples: data.case_profile.examples || {},
              occurrences: data.case_profile.occurrences || {},
              labels: data.case_profile.labels || {},
              note: data.case_profile.note,
            }
          : undefined,
      });

      if (Array.isArray(posData)) {
        return posData.map(normalize);
      } else {
        return [normalize(posData)];
      }
    } catch (error) {
      console.warn("Failed to load POS analysis:", error);
      return [];
    }
  }

  private static async loadQuantAnalysis(id: string): Promise<QuantAnalysis[]> {
    // Placeholder for future quantitative analysis loading
    try {
      const quantBlob = await apiService.downloadFile(id, "quan_analysis");
      const quantText = await quantBlob.text();
      const quantData = JSON.parse(quantText);

      // Helper to normalize a single QuantAnalysis object
      const normalize = (data: any): QuantAnalysis => ({
        evidence_map: data.evidence_map
          ? {
              frequent_terms: Array.isArray(data.evidence_map.frequent_terms)
                ? data.evidence_map.frequent_terms
                : [],
              tfidf_terms: Array.isArray(data.evidence_map.tfidf_terms)
                ? data.evidence_map.tfidf_terms
                : [],
              bigrams: Array.isArray(data.evidence_map.bigrams)
                ? data.evidence_map.bigrams
                : [],
              sentence_tags: Array.isArray(data.evidence_map.sentence_tags)
                ? data.evidence_map.sentence_tags
                : [],
              concordance: Array.isArray(data.evidence_map.concordance)
                ? data.evidence_map.concordance
                : [],
            }
          : undefined,
        stats_df: Array.isArray(data.stats_df)
          ? data.stats_df.map((stat: any) => ({
              Document: stat.Document || "",
              Sentences: Number(stat.Sentences) || 0,
              Words: Number(stat.Words) || 0,
            }))
          : [],
        token_info: {
          tokens: Array.isArray(data.token_info?.tokens)
            ? data.token_info.tokens
            : [],
          tokens_filtered: Array.isArray(data.token_info?.tokens_filtered)
            ? data.token_info.tokens_filtered
            : [],
          ttr: Number(data.token_info?.ttr) || 0,
          freq_dist:
            typeof data.token_info?.freq_dist === "object" &&
            data.token_info?.freq_dist !== null
              ? data.token_info.freq_dist
              : {},
        },
        tfidf_df: Array.isArray(data.tfidf_df)
          ? data.tfidf_df.map((tfidf: any) => ({
              Document: tfidf.Document || "",
              TopTerms: Array.isArray(tfidf.TopTerms) ? tfidf.TopTerms : [],
            }))
          : [],
        bigrams: Array.isArray(data.bigrams) ? data.bigrams : [],
        sentence_tags: Array.isArray(data.sentence_tags)
          ? data.sentence_tags.map((tag: any) => ({
              sentence: tag.sentence || "",
              WHO: Boolean(tag.WHO),
              WHY: Boolean(tag.WHY),
            }))
          : [],
        concordance: data.concordance
          ? {
              keyword: data.concordance.keyword ?? null,
              lines: Array.isArray(data.concordance.lines)
                ? data.concordance.lines
                : [],
              entries: Array.isArray(data.concordance.entries)
                ? data.concordance.entries.map((entry: any) => ({
                    left_context: entry.left_context || "",
                    keyword: entry.keyword || "",
                    right_context: entry.right_context || "",
                    text: entry.text || "",
                    start:
                      entry.start !== undefined ? Number(entry.start) : undefined,
                    end: entry.end !== undefined ? Number(entry.end) : undefined,
                    t: entry.t || undefined,
                  }))
                : [],
              width:
                data.concordance.width !== undefined
                  ? Number(data.concordance.width)
                  : undefined,
              requested_lines:
                data.concordance.requested_lines !== undefined
                  ? Number(data.concordance.requested_lines)
                  : undefined,
            }
          : undefined,
      });

      if (Array.isArray(quantData)) {
        return quantData.map(normalize);
      } else {
        return [normalize(quantData)];
      }
    } catch (error) {
      console.warn("Failed to load Quantitative analysis:", error);
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
      ? `Analysis complete. ${summary.join(", ")}.`
      : "Analysis complete.";
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
      return health.status === "healthy";
    } catch (error) {
      return false;
    }
  }
}
