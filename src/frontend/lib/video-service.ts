// src/frontend/lib/video-service.ts
import { apiService } from "./api-service";
import type {
  AnalysisEvent,
  AnalysisStartOptions,
  AnnotationCorrections,
  AnnotationCorrectionRule,
  ManualTranscriptEntry,
} from "./api-service";
import { DROP_CORRECTION_VALUE } from "./annotation-corrections";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

// Type Definitions
export interface VideoMetadata {
  id: string;
  name: string;
  length?: number;
  size?: number;
  status: "uploaded" | "processing" | "completed" | "error";
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

export interface TranscriptSegment {
  t: string; // Formatted timestamp like "12.5s"
  text: string;
  rawText?: string;
  speaker: string;
  start: number; // Raw start time in seconds
  end: number; // Raw end time in seconds
  segmentType?: string;
  synthetic?: boolean;
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
}

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
        context?.trackId !== undefined &&
        context?.trackId !== null
      ) {
        return Number(rule.target_track_id) === Number(context.trackId);
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
            ? Number(rule.target_start_timestamp) - 0.15
            : Number.NEGATIVE_INFINITY;
        const upper =
          rule.target_end_timestamp !== undefined
            ? Number(rule.target_end_timestamp) + 0.15
            : Number.POSITIVE_INFINITY;
        return Number(end) >= lower && Number(start) <= upper;
      }
      if (rule.target_timestamp === undefined) {
        return true;
      }
      if (context?.timestamp === undefined || context?.timestamp === null) {
        return false;
      }
      return Math.abs(Number(rule.target_timestamp) - Number(context.timestamp)) <= 0.15;
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
        context?.trackId !== undefined &&
        context?.trackId !== null
      ) {
        return Number(rule.target_track_id) === Number(context.trackId);
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
            ? Number(rule.target_start_timestamp) - 0.15
            : Number.NEGATIVE_INFINITY;
        const upper =
          rule.target_end_timestamp !== undefined
            ? Number(rule.target_end_timestamp) + 0.15
            : Number.POSITIVE_INFINITY;
        return Number(end) >= lower && Number(start) <= upper;
      }
      if (rule.target_timestamp === undefined) {
        return true;
      }
      if (context?.timestamp === undefined || context?.timestamp === null) {
        return false;
      }
      return Math.abs(Number(rule.target_timestamp) - Number(context.timestamp)) <= 0.15;
    });
  return Boolean(matched);
}

function applyAnnotationCorrectionsToTranscript(
  transcript: TranscriptSegment[],
  corrections?: AnnotationCorrections | null,
): TranscriptSegment[] {
  const textRules = corrections?.text_substitutions || [];
  const correctedBase = transcript.map((segment) => {
    const baseText = String(segment.text || "").trim();
    const normalizedEmpty =
      baseText.length > 0 ? baseText : segment.status === "unconfirmed" ? "Unconfirmed" : "";
    return {
      ...segment,
      rawText: segment.rawText || segment.text,
      text: applyTextSubstitutions(normalizedEmpty, textRules),
      status: segment.status || (normalizedEmpty ? "confirmed" : "unconfirmed"),
      correctionSource: segment.correctionSource || "transcript",
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
        speaker: "Analyst note",
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
      item.displayLabel ||
      (item.trackId !== undefined
        ? `${rawClassName} track ${item.trackId}`
        : rawClassName);
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
      displayLabel: textAdjustedLabel,
    };
    });
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
      displayLabel: applyTextSubstitutions(correctedLabel, textRules),
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
  quantAnalysis: QuantAnalysis[];
  posAnalysis: POSAnalysis[];
  transcript: TranscriptSegment[];
  transcriptTimeline?: TranscriptSegment[];
  detectedObjects: DetectedObject[];
  rawDetectedObjects: DetectedObject[];
  faceResults?: AnalysisStatus["face_results"] | null;
  ocr: OCR[];
  expressionResults: ExpressionSample[];
  audioProsody: AudioProsodyCue[];
  quantityDetection: DetectedObject[];
  annotations: any[];
  annotationCorrections?: AnnotationCorrections | null;
  summary: string;
  rawCsv: string;
  rawJson?: any;
  status: string;
  downloadLinks?: Record<string, string>;
  metadata?: {
    sourceName?: string;
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
            brightness_band?: string;
            saturation_band?: string;
          }
        >;
        foreground_activity?: number;
        background_activity?: number;
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
    };
    audioSegments?: number;
    audioProsodyCues?: number;
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
      displayLabel: `${item.class_name} track ${nextTrackId}`,
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
  annotation_corrections?: AnnotationCorrections | null;
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
    { completedAt?: string; correctionUpdatedAt?: string; data: AnalysisData }
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
    this.metadataCache.delete(id);
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
      const status = (await apiService.getStatus(id)) as AnalysisStatus;

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
      const status = (await apiService.getStatus(id)) as AnalysisStatus;

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
      const correctedExpressions =
        expressionData.status === "fulfilled"
          ? applyAnnotationCorrectionsToExpressions(expressionData.value, corrections)
          : [];
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

      const analysisData = {
        quantAnalysis: correctedQuantAnalysis,
        posAnalysis: correctedPosAnalysis,
        transcript: correctedTranscript,
        transcriptTimeline: correctedTranscriptTimeline,
        detectedObjects: profiledObjects,
        rawDetectedObjects: correctedRawObjects,
        faceResults: status.face_results,
        ocr: correctedOCR,
        expressionResults: correctedExpressions,
        audioProsody:
          audioProsodyData.status === "fulfilled" ? audioProsodyData.value : [],
        quantityDetection: profiledObjects,
        annotations: [], // Placeholder for future annotations
        annotationCorrections: corrections,
        summary: this.generateSummary(status),
        rawCsv: csvData.status === "fulfilled" ? csvData.value : "",
        status: "completed",
        downloadLinks: status.download_links,
        metadata: {
          sourceName: status.filename,
          yoloDetections: status.summary?.yolo_detections || 0,
          ocrDetections: status.summary?.ocr_detections || 0,
          transcriptQuality:
            transcriptData.status === "fulfilled"
              ? transcriptData.value.quality
              : undefined,
          cinematicClues: correctedCinematicClues,
          spatialToneScan: status.summary?.spatial_tone_scan
            ? {
                summary: status.summary.spatial_tone_scan.summary,
                samples: status.summary.spatial_tone_scan.samples,
              }
            : undefined,
          motionSceneBasis:
            status.summary?.motion_evidence || status.summary?.scene_segments
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
                }
              : undefined,
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
        completedAt: status.analysis_completed_at,
        correctionUpdatedAt: correctionUpdatedAt || undefined,
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
      const transcriptData = JSON.parse(transcriptText);
      const normalizeSegment = (seg: any): TranscriptSegment => ({
        t: `${Number(seg.start).toFixed(1)}s`,
        text: seg.text || "",
        rawText: seg.raw_text || seg.rawText || seg.text || "",
        speaker: "Speaker 1",
        start: seg.start || 0,
        end: seg.end || 0,
        segmentType: seg.segment_type || "utterance",
        synthetic: Boolean(seg.synthetic),
      });

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
