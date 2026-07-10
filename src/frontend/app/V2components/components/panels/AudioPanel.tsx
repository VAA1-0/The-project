"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiService } from "@/lib/api-service";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import {
  upsertManualVisualAnnotation,
  upsertMasterSchemaPresenceIntervalForManualAnnotation,
} from "@/lib/annotation-corrections";
import type {
  AnnotationCorrections,
  ManualVisualAnnotation,
  ProliferationDecision,
} from "@/lib/api-service";
import { VideoService, type AnalysisData } from "@/lib/video-service";

type AudioPanelProps = {
  analysis?: {
    analysis_id?: string;
    id?: string;
  };
  analysisId?: string;
  videoId?: string;
};

type AudioEvent = {
  segment_id?: string;
  interval_id?: string;
  event_id?: string;
  event_label?: string;
  event_type?: string;
  start?: number;
  end?: number;
  duration?: number;
  confidence?: number;
  measurements?: Record<string, unknown>;
  speaker_label?: string;
  text?: string;
  source_layer?: string;
  classifier_labels?: string[];
  is_stale?: boolean;
  stale_reason?: string;
  valid_for_confirmation?: boolean;
};

type ProsodyCue = {
  cue_id?: string;
  start?: number;
  end?: number;
  text?: string;
  word_count?: number;
  pace?: { words_per_second?: number; label?: string };
  pauses?: { before_seconds?: number; after_seconds?: number; before_label?: string; after_label?: string };
  turn_structure?: { transition?: string; overlap_seconds?: number; likely_turn_boundary?: boolean };
  interaction_cues?: { role_support?: string; run_length?: number; run_position?: number };
  rhythm_profile?: { label?: string };
  tonality_profile?: { label?: string };
  emphasis?: { score?: number; label?: string };
  pitch_energy_contour?: { pitch_hz?: number; energy_dbfs?: number; label?: string };
  sound_environment?: { label?: string; zero_crossing_rate?: number; spectral_variation?: number };
};

type RecognitionRow = {
  layer: string;
  status: string;
  rows: number;
  source: string;
  nextAction: string;
};

type AudioWorkbenchDecision = "confirmed" | "agent" | "dropped" | "sample";

type AudioDecisionTarget = {
  id: string;
  label: string;
  text?: string;
  start?: number;
  end?: number;
  source?: string;
  rowType: string;
  speakerLabel?: string;
  isStale?: boolean;
  staleReason?: string;
  validForConfirmation?: boolean;
};

type VisualAnchor = {
  id: string;
  label: string;
  category: string;
  relation: string;
};

type NarrativeAgentOption = {
  id: string;
  label: string;
  source: string;
};

type FoleyCandidateRow = {
  label: string;
  start?: number;
  end?: number;
  source: string;
  confidence?: number;
  reviewState: string;
  proliferationTarget: string;
  nextAction: string;
};

type AudioSampleRow = {
  sampleId: string;
  cloudLabel?: string;
  entityType?: string;
  start?: number;
  end?: number;
  text?: string;
  label?: string;
  source: string;
  confidence?: number;
  reviewState?: string;
  sampleRole?: string;
  features?: Record<string, any>;
  isStale?: boolean;
  staleReason?: string;
  validForConfirmation?: boolean;
};

type WaveformRow = {
  id: string;
  start?: number;
  end?: number;
  label: string;
  energy?: number;
  pitch?: number;
  source: string;
};

type TranscriptAudioRow = {
  id?: string;
  start?: number;
  end?: number;
  text?: string;
  speaker?: string;
  source?: string;
  status?: string;
  correctionSource?: string;
  synthetic?: boolean;
};

type TranscriptTimingAudit = {
  status: "source_locked" | "global_anchor_only" | "missing";
  label: string;
  detail: string;
  offset?: number | null;
  uniformRows: number;
  totalRows: number;
  coverageRatio?: number;
};

function formatTime(seconds: unknown): string {
  const safeSeconds = typeof seconds === "number" && Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const millis = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function formatValue(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "n/a";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function firstObject(...values: unknown[]): Record<string, any> {
  for (const value of values) {
    const object = asObject(value);
    if (Object.keys(object).length) return object;
  }
  return {};
}

function eventStart(event: AudioEvent): number {
  return typeof event.start === "number" ? event.start : 0;
}

function eventEnd(event: AudioEvent): number {
  return typeof event.end === "number" ? event.end : eventStart(event);
}

function eventDuration(event: AudioEvent): number {
  if (typeof event.duration === "number") return event.duration;
  return Math.max(0, eventEnd(event) - eventStart(event));
}

function eventLabel(event: AudioEvent): string {
  if (event.speaker_label) return `${event.speaker_label} speech`;
  return event.event_label || event.event_type || "audio event";
}

function normalizeSpeechText(value: unknown): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function overlapSeconds(leftStart?: number, leftEnd?: number, rightStart?: number, rightEnd?: number): number {
  if (
    typeof leftStart !== "number" ||
    typeof leftEnd !== "number" ||
    typeof rightStart !== "number" ||
    typeof rightEnd !== "number"
  ) {
    return 0;
  }
  return Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart));
}

function categoryFor(event: AudioEvent): "speech" | "music" | "noise" | "silence" | "other" {
  const label = eventLabel(event).toLowerCase();
  if (/speech|voice|dialogue|speaker/.test(label)) return "speech";
  if (/music|song|score/.test(label)) return "music";
  if (/noise|sound|ambience|ambient|traffic|crowd/.test(label)) return "noise";
  if (/silence|quiet/.test(label)) return "silence";
  return "other";
}

function sourceLayers(...values: Array<string | null | undefined>): string {
  const layers = new Set<string>();
  values.forEach((value) => {
    String(value || "")
      .split(" + ")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => layers.add(item));
  });
  return [...layers].join(" + ");
}

function safeIdPart(value: unknown): string {
  return String(value || "row")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "row";
}

function numericTime(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function decisionTimeRange(target: AudioDecisionTarget): { start: number; end: number } {
  const start = numericTime(target.start, 0);
  const end = Math.max(start + 0.001, numericTime(target.end, start + 0.001));
  return {
    start: Number(start.toFixed(3)),
    end: Number(end.toFixed(3)),
  };
}

function targetHasValidSourceTiming(target: AudioDecisionTarget): boolean {
  if (target.isStale) return false;
  if (target.validForConfirmation === false) return false;
  return typeof target.start === "number" && typeof target.end === "number" && target.end > target.start;
}

function addNarrativeAgentOption(
  options: NarrativeAgentOption[],
  label: unknown,
  source: string,
  id?: unknown,
) {
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel || /^unknown$/i.test(normalizedLabel)) return;
  const optionId = String(id || `${source}:${safeIdPart(normalizedLabel)}`);
  if (options.some((option) => option.label.toLowerCase() === normalizedLabel.toLowerCase())) return;
  options.push({ id: optionId, label: normalizedLabel, source });
}

function knownNarrativeAgentOptions(analysisData: AnalysisData | null): NarrativeAgentOption[] {
  const options: NarrativeAgentOption[] = [];
  const annotations = analysisData?.metadata?.sourceMediaMetadata?.user_annotations;

  asArray<Record<string, any>>(annotations?.narrative_agent_profiles).forEach((profile, index) => {
    addNarrativeAgentOption(
      options,
      profile.narrative_agent_name || profile.attached_performer_metadata?.actor_name,
      "source_media_metadata.narrative_agent_profiles",
      profile.profile_id || `narrative-agent-profile:${index}`,
    );
    asArray(profile.aliases).forEach((alias) => addNarrativeAgentOption(options, alias, "source_media_metadata.narrative_agent_alias"));
  });

  asArray<Record<string, any>>(annotations?.character_definitions).forEach((definition, index) => {
    addNarrativeAgentOption(
      options,
      definition.character_name,
      "source_media_metadata.character_definitions",
      `character-definition:${index}`,
    );
    asArray(definition.aliases).forEach((alias) => addNarrativeAgentOption(options, alias, "source_media_metadata.character_alias"));
  });

  asArray<string>(annotations?.character_roles).forEach((roleLine, index) => {
    const character = String(roleLine || "").split(/\s+[-–—]\s+|\s+\(|,/)[0]?.trim();
    addNarrativeAgentOption(options, character || roleLine, "source_media_metadata.character_roles", `character-role:${index}`);
  });

  asArray<Record<string, any>>(annotations?.web_metadata_sources).forEach((source, sourceIndex) => {
    asArray<Record<string, any>>(source.fields?.character_roles).forEach((role, roleIndex) => {
      addNarrativeAgentOption(
        options,
        role.character || role.role || role.actor,
        "source_media_metadata.web_character_roles",
        `web-character-role:${sourceIndex}:${roleIndex}`,
      );
    });
  });

  asArray<Record<string, any>>(annotations?.reference_speakers).forEach((speaker, index) => {
    addNarrativeAgentOption(
      options,
      speaker.narrative_agent_label || speaker.character_label || speaker.identity_label || speaker.speaker_label,
      "source_media_metadata.reference_speakers",
      `reference-speaker:${index}`,
    );
  });

  asArray<ManualVisualAnnotation>(analysisData?.annotationCorrections?.manual_visual_annotations).forEach((annotation) => {
    if (!["Identification", "Role", "OBJ", "Audio"].includes(annotation.category)) return;
    addNarrativeAgentOption(
      options,
      manualAnnotationLabel(annotation),
      "manual_confirmed_narrative_agent_anchor",
      annotation.id,
    );
  });

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

const FOLEY_PATTERNS: Array<{ label: string; pattern: RegExp; target: string }> = [
  { label: "gun shot / impact", pattern: /gun|shot|gunshot|bang|blast|explosion|impact|weapon/i, target: "Audio sample cloud -> repeated point foley candidates" },
  { label: "laughter", pattern: /laugh|laughter|chuckle|giggle/i, target: "Audio sample cloud -> expressive social sound candidates" },
  { label: "roar", pattern: /roar|growl|scream|shout|yell/i, target: "Audio sample cloud -> high-energy vocal or environmental sound candidates" },
  { label: "applause / applauds", pattern: /applause|applaud|clap|cheer/i, target: "Audio sample cloud -> audience reaction candidates" },
];

function statusAudioAnalysis(status: any): Record<string, any> {
  return asObject(status?.results?.audio_analysis);
}

function sourceMediaPathFromStatus(status: any): string {
  const audioSampleClouds = firstObject(status?.audio_sample_clouds, statusAudioAnalysis(status).audio_sample_clouds);
  const cloudContext = asObject(asArray<any>(audioSampleClouds.clouds)[0]?.source_media_context);
  return String(
    status?.source_video_path ||
    status?.source_media_metadata?.source_video_path ||
    cloudContext.source_video_path ||
    "",
  );
}

function sampleCloudRowsFromStatus(status: any): AudioSampleRow[] {
  const audioSampleClouds = firstObject(status?.audio_sample_clouds, statusAudioAnalysis(status).audio_sample_clouds);
  const clouds = asArray<any>(audioSampleClouds.clouds);
  const flattened = clouds.flatMap((cloud): AudioSampleRow[] =>
    asArray<any>(cloud.samples).map((sample) => ({
      sampleId: sample.sample_id || sample.source_turn_id || `${cloud.cloud_id}:${sample.time_start || 0}`,
      cloudLabel: cloud.entity_label,
      entityType: cloud.entity_type,
      start: typeof sample.time_start === "number" ? sample.time_start : sample.start,
      end: typeof sample.time_end === "number" ? sample.time_end : sample.end,
      text: sample.transcript_text || sample.text || "",
      label: sample.label || sample.event_label || sample.sound_label || cloud.entity_label,
      source: sample.source_type || "audio_sample_clouds",
      confidence: typeof sample.confidence === "number" ? sample.confidence : undefined,
      reviewState: sample.review_state || sample.epistemic_status,
      sampleRole: sample.sample_role,
      features: asObject(sample.audio_features),
      isStale: Boolean(sample.is_stale || cloud.is_stale),
      staleReason: sample.stale_reason || cloud.stale_reason,
      validForConfirmation: sample.valid_for_confirmation !== false && !sample.is_stale && !cloud.is_stale,
    })),
  );
  const directSamples = asArray<any>(audioSampleClouds.samples || audioSampleClouds.sample_clouds).map((sample): AudioSampleRow => ({
    sampleId: sample.sample_id || sample.id || `${sample.start || sample.start_seconds || 0}`,
    start: sample.time_start ?? sample.start ?? sample.start_seconds,
    end: sample.time_end ?? sample.end ?? sample.end_seconds,
    text: sample.transcript_text || sample.text || "",
    label: sample.label || sample.event_label || sample.sound_label || sample.classifier_label,
    source: sample.source || sample.source_type || "audio_sample_clouds",
    confidence: typeof sample.confidence === "number" ? sample.confidence : undefined,
    reviewState: sample.review_state || sample.epistemic_status,
    sampleRole: sample.sample_role,
    features: asObject(sample.audio_features),
    isStale: Boolean(sample.is_stale),
    staleReason: sample.stale_reason,
    validForConfirmation: sample.valid_for_confirmation !== false && !sample.is_stale,
  }));
  return [...flattened, ...directSamples];
}

function transcriptRowsFromAnalysisData(analysisData: AnalysisData | null): TranscriptAudioRow[] {
  const transcript = analysisData?.transcriptTimeline?.length
    ? analysisData.transcriptTimeline
    : analysisData?.transcript || [];
  return transcript
    .map((segment, index) => ({
      id: segment.targetId || `transcript:${index}`,
      start: segment.start,
      end: segment.end,
      text: segment.text,
      speaker: segment.speaker,
      source:
        segment.correctionSource === "manual"
          ? "manual confirmed transcript timeline"
          : segment.synthetic
            ? "corrected transcript timeline"
            : "transcript timeline",
      status: segment.status,
      correctionSource: segment.correctionSource,
      synthetic: segment.synthetic,
    }))
    .filter((row) => normalizeSpeechText(row.text).length > 0);
}

function transcriptTimingAudit(
  analysisData: AnalysisData | null,
  status: any,
  transcriptRows: TranscriptAudioRow[],
): TranscriptTimingAudit {
  if (!transcriptRows.length) {
    return {
      status: "missing",
      label: "No transcript timing layer",
      detail: "Speech rows are waiting for transcript or measured audio intervals.",
      offset: null,
      uniformRows: 0,
      totalRows: 0,
    };
  }
  const durations = transcriptRows
    .map((row) => Math.max(0, Number(row.end ?? row.start ?? 0) - Number(row.start ?? 0)))
    .filter((duration) => Number.isFinite(duration) && duration > 0);
  const durationCounts = durations.reduce<Record<string, number>>((counts, duration) => {
    const key = duration.toFixed(3);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const uniformRows = Math.max(0, ...Object.values(durationCounts));
  const totalRows = durations.length;
  const offset = Number(analysisData?.annotationCorrections?.transcript_clock_offset_seconds ?? status?.annotation_corrections?.transcript_clock_offset_seconds);
  const repair = asObject(status?.transcript_timing_repair);
  const repairStatus = String(repair.status || "");
  const repairQuality = asObject(repair.quality_after || repair.quality_before || repair.quality);
  const coverageRatio = typeof repairQuality.coverage_ratio === "number" ? repairQuality.coverage_ratio : undefined;
  const degraded =
    repairStatus === "failed" ||
    String(repairQuality.status || "").toLowerCase() === "degraded" ||
    (typeof coverageRatio === "number" && coverageRatio < 0.95);
  const scaffolded = totalRows >= 8 && uniformRows / totalRows >= 0.7;
  const hasOffset = Number.isFinite(offset) && offset !== 0;

  if (degraded || scaffolded) {
    return {
      status: "global_anchor_only",
      label: "Global speech anchor only",
      detail: hasOffset
        ? `First spoken-word clock is shifted by ${offset.toFixed(3)}s, but row timing is scaffolded/degraded and needs per-line sync.`
        : "Transcript rows look scaffolded/degraded and need per-line sync before source-locked use.",
      offset: Number.isFinite(offset) ? offset : null,
      uniformRows,
      totalRows,
      coverageRatio,
    };
  }

  return {
    status: "source_locked",
    label: "Source-locked transcript timing",
    detail: "Transcript rows have varied source timings and no degraded timing repair flag.",
    offset: Number.isFinite(offset) ? offset : null,
    uniformRows,
    totalRows,
    coverageRatio,
  };
}

function manualAnnotationLabel(annotation: ManualVisualAnnotation): string {
  return String(
    annotation.custom_label ||
    annotation.label ||
    annotation.identity_affirmation ||
    annotation.role_affirmation ||
    "",
  ).trim();
}

function visualAnchorForTarget(
  target: AudioDecisionTarget,
  analysisData: AnalysisData | null,
): VisualAnchor | null {
  const range = decisionTimeRange(target);
  const annotations = analysisData?.annotationCorrections?.manual_visual_annotations || [];
  const candidates = annotations
    .filter((annotation) => ["Identification", "Role", "OBJ"].includes(annotation.category))
    .map((annotation) => {
      const start = numericTime(annotation.start_seconds ?? annotation.timestamp_seconds, annotation.timestamp_seconds);
      const end = numericTime(annotation.end_seconds ?? annotation.timestamp_seconds, start + 0.001);
      return {
        annotation,
        overlap: overlapSeconds(range.start, range.end, start, end),
        label: manualAnnotationLabel(annotation),
      };
    })
    .filter((candidate) => candidate.overlap > 0 && candidate.label);
  const best = candidates.sort((left, right) => right.overlap - left.overlap)[0];
  if (!best) return null;
  return {
    id: best.annotation.id,
    label: best.label,
    category: best.annotation.category,
    relation: "audio_visual_narrative_agent_same_interval",
  };
}

function bestTextMatch<T extends { text?: string; start?: number; end?: number }>(
  row: TranscriptAudioRow,
  candidates: T[],
): T | undefined {
  const rowText = normalizeSpeechText(row.text);
  if (!rowText) return undefined;
  const exact = candidates.find((candidate) => normalizeSpeechText(candidate.text) === rowText);
  if (exact) return exact;
  return candidates.find((candidate) => {
    const candidateText = normalizeSpeechText(candidate.text);
    return candidateText.length > 3 && (candidateText.includes(rowText) || rowText.includes(candidateText));
  });
}

function alignSampleRowsToTranscript(samples: AudioSampleRow[], transcriptRows: TranscriptAudioRow[]): AudioSampleRow[] {
  if (!transcriptRows.length) return samples;
  let searchStart = 0;
  return samples.map((sample) => {
    const sampleText = normalizeSpeechText(sample.text);
    const matchedIndex = transcriptRows.findIndex((row, rowIndex) => (
      rowIndex >= searchStart && normalizeSpeechText(row.text) === sampleText
    ));
    const matchedTranscript = matchedIndex >= 0
      ? transcriptRows[matchedIndex]
      : bestTextMatch(sample, transcriptRows);
    if (!matchedTranscript) return sample;
    if (matchedIndex >= 0) {
      searchStart = matchedIndex + 1;
    }
    return {
      ...sample,
      start: matchedTranscript.start,
      end: matchedTranscript.end,
      text: matchedTranscript.text || sample.text,
      source: `${sample.source} + ${matchedTranscript.source || "mature transcript timeline"}`,
      validForConfirmation: sample.validForConfirmation !== false,
    };
  });
}

function waveformRowsFromAudio(samples: AudioSampleRow[], prosodyCues: ProsodyCue[], events: AudioEvent[]): WaveformRow[] {
  const sampleRows = samples
    .filter((sample) => sample.features?.energy_dbfs_mean !== undefined || sample.features?.pitch_hz_mean !== undefined)
    .map((sample): WaveformRow => ({
      id: sample.sampleId,
      start: sample.start,
      end: sample.end,
      label: sample.label || sample.cloudLabel || "Audio sample",
      energy: typeof sample.features?.energy_dbfs_mean === "number" ? sample.features.energy_dbfs_mean : undefined,
      pitch: typeof sample.features?.pitch_hz_mean === "number" ? sample.features.pitch_hz_mean : undefined,
      source: sample.source,
    }));
  const cueRows = prosodyCues
    .filter((cue) => cue.pitch_energy_contour?.energy_dbfs !== undefined || cue.pitch_energy_contour?.pitch_hz !== undefined)
    .map((cue): WaveformRow => ({
      id: cue.cue_id || `${cue.start || 0}`,
      start: cue.start,
      end: cue.end,
      label: cue.text || cue.pitch_energy_contour?.label || "Prosody cue",
      energy: cue.pitch_energy_contour?.energy_dbfs,
      pitch: cue.pitch_energy_contour?.pitch_hz,
      source: cue.cue_id || "audio_prosody.cues",
    }));
  const eventRows = events
    .filter((event) => event.measurements?.energy_dbfs !== undefined || event.measurements?.pitch_hz !== undefined)
    .map((event): WaveformRow => ({
      id: event.segment_id || event.event_id || `${event.start || 0}`,
      start: event.start,
      end: event.end,
      label: eventLabel(event),
      energy: typeof event.measurements?.energy_dbfs === "number" ? event.measurements.energy_dbfs : undefined,
      pitch: typeof event.measurements?.pitch_hz === "number" ? event.measurements.pitch_hz : undefined,
      source: event.source_layer || "audio_event",
    }));
  const byId = new Map<string, WaveformRow>();
  [...sampleRows, ...cueRows, ...eventRows].forEach((row) => byId.set(row.id, row));
  return [...byId.values()].sort((left, right) => Number(left.start || 0) - Number(right.start || 0)).slice(0, 120);
}

function energyBarHeight(energy?: number): number {
  if (typeof energy !== "number" || !Number.isFinite(energy)) return 18;
  return Math.max(18, Math.min(90, Math.round(((energy + 50) / 40) * 90)));
}

function pitchLabel(pitch?: number): string {
  return typeof pitch === "number" && Number.isFinite(pitch) ? `${Math.round(pitch)} Hz` : "pitch pending";
}


function audioProsodyFromStatus(status: any): Record<string, any> {
  const audioAnalysis = statusAudioAnalysis(status);
  return firstObject(status?.audio_prosody, audioAnalysis.audio_prosody);
}

function audioEventsFromStatus(status: any): AudioEvent[] {
  const audioAnalysis = statusAudioAnalysis(status);
  const directIntervals = status?.audio_event_intervals?.intervals;
  const nestedIntervals = audioAnalysis.audio_event_intervals?.intervals;
  const prosodyIntervals = audioAnalysis.audio_prosody?.audio_event_intervals?.intervals;
  const metadataIntervals = status?.source_media_metadata?.audio_event_intervals?.intervals;
  const intervals = asArray<AudioEvent>(directIntervals).length
    ? asArray<AudioEvent>(directIntervals)
    : asArray<AudioEvent>(nestedIntervals).length
      ? asArray<AudioEvent>(nestedIntervals)
      : asArray<AudioEvent>(prosodyIntervals).length
        ? asArray<AudioEvent>(prosodyIntervals)
        : asArray<AudioEvent>(metadataIntervals);
  if (intervals.length) return intervals;

  const diarization = firstObject(status?.audio_diarization, audioAnalysis.audio_diarization);
  const speakerTurns = asArray<any>(diarization.speaker_turns);
  if (speakerTurns.length) {
    return speakerTurns.map((turn): AudioEvent => ({
      segment_id: turn.turn_id,
      event_label: "speech",
      event_type: "speech",
      speaker_label: turn.speaker_label,
      start: turn.start,
      end: turn.end,
      duration: typeof turn.end === "number" && typeof turn.start === "number" ? Math.max(0, turn.end - turn.start) : undefined,
      confidence: turn.diarization_confidence,
      text: turn.text,
      source_layer: "audio_diarization.speaker_turns",
      is_stale: Boolean(turn.is_stale),
      stale_reason: turn.stale_reason,
      valid_for_confirmation: turn.valid_for_confirmation !== false && !turn.is_stale,
    }));
  }

  return asArray<any>(diarization.vad_segments).map((segment): AudioEvent => ({
    segment_id: segment.segment_id,
    event_label: "speech activity",
    event_type: "speech",
    start: segment.start,
    end: segment.end,
    duration: segment.duration,
    confidence: segment.confidence,
    source_layer: "audio_diarization.vad_segments",
  }));
}

function audioEventsFromMatureTranscript(
  transcriptRows: TranscriptAudioRow[],
  rawEvents: AudioEvent[],
  timingAudit?: TranscriptTimingAudit,
): AudioEvent[] {
  const matureRows = transcriptRows.filter((row) => !row.synthetic && typeof row.start === "number" && typeof row.end === "number");
  if (!matureRows.length) return rawEvents;

  const rawSpeechEvents = rawEvents.filter((event) => categoryFor(event) === "speech");
  let searchStart = 0;

  return matureRows.map((row, index) => {
    const rowText = normalizeSpeechText(row.text);
    const matchedIndex = rawSpeechEvents.findIndex((event, eventIndex) => (
      eventIndex >= searchStart && normalizeSpeechText(event.text) === rowText
    ));
    const matchedEvent = matchedIndex >= 0
      ? rawSpeechEvents[matchedIndex]
      : bestTextMatch(row, rawSpeechEvents);
    if (matchedIndex >= 0) {
      searchStart = matchedIndex + 1;
    }

    return {
      segment_id: row.id || `mature-transcript:${index}`,
      event_label: "speech",
      event_type: "speech",
      speaker_label: matchedEvent?.speaker_label || row.speaker,
      start: row.start,
      end: row.end,
      duration: Math.max(0, Number(row.end || 0) - Number(row.start || 0)),
      confidence: row.status === "confirmed" || row.correctionSource === "manual"
        ? 1
        : matchedEvent?.confidence,
      text: row.text,
      is_stale: Boolean(matchedEvent?.is_stale || timingAudit?.status === "global_anchor_only"),
      stale_reason: matchedEvent?.stale_reason || (timingAudit?.status === "global_anchor_only" ? timingAudit.detail : undefined),
      valid_for_confirmation: timingAudit?.status !== "global_anchor_only" && matchedEvent?.valid_for_confirmation !== false && !matchedEvent?.is_stale,
      source_layer: sourceLayers(
        timingAudit?.status === "global_anchor_only"
          ? "transcript timeline: global anchor only / per-line sync needed"
          : row.source || "transcript timeline",
        matchedEvent?.speaker_label ? "speaker diarization label only" : null,
      ),
    };
  });
}

function enrichAudioEventsWithMeasurements(
  events: AudioEvent[],
  samples: AudioSampleRow[],
  prosodyCues: ProsodyCue[],
  transcriptRows: TranscriptAudioRow[],
): AudioEvent[] {
  return events.map((event) => {
    const bestSample = samples
      .map((sample) => ({ sample, overlap: overlapSeconds(event.start, event.end, sample.start, sample.end) }))
      .sort((left, right) => right.overlap - left.overlap)[0];
    const bestCue = prosodyCues
      .map((cue) => ({ cue, overlap: overlapSeconds(event.start, event.end, cue.start, cue.end) }))
      .sort((left, right) => right.overlap - left.overlap)[0];
    const bestTranscript = transcriptRows
      .map((row) => ({ row, overlap: overlapSeconds(event.start, event.end, row.start, row.end) }))
      .sort((left, right) => right.overlap - left.overlap)[0];
    const sampleFeatures = bestSample?.overlap ? bestSample.sample.features || {} : {};
    const cue = bestCue?.overlap ? bestCue.cue : undefined;
    return {
      ...event,
      text: bestTranscript?.overlap ? bestTranscript.row.text || event.text : event.text,
      measurements: {
        ...(event.measurements || {}),
        energy_dbfs:
          event.measurements?.energy_dbfs ??
          sampleFeatures.energy_dbfs_mean ??
          cue?.pitch_energy_contour?.energy_dbfs,
        pitch_hz:
          event.measurements?.pitch_hz ??
          sampleFeatures.pitch_hz_mean ??
          cue?.pitch_energy_contour?.pitch_hz,
        pace_wps: sampleFeatures.pace_wps ?? cue?.pace?.words_per_second,
      },
      source_layer: sourceLayers(
        event.source_layer,
        bestTranscript?.overlap && !String(event.source_layer || "").includes("transcript")
          ? bestTranscript.row.source
          : null,
        bestSample?.overlap ? `audio_sample_clouds:${bestSample.sample.sampleId}` : null,
      ),
    };
  });
}

function prosodyCuesFromStatus(status: any): ProsodyCue[] {
  const directCues = asArray<ProsodyCue>(audioProsodyFromStatus(status).cues);
  if (directCues.length) return directCues;
  return prosodyCuesFromSampleRows(sampleCloudRowsFromStatus(status));
}

function prosodyCuesFromAnalysisData(analysisData: AnalysisData | null): ProsodyCue[] {
  return asArray<any>(analysisData?.audioProsody).map((cue, index): ProsodyCue => ({
    cue_id: cue.cue_id || `audio-prosody:${index}`,
    start: cue.start,
    end: cue.end,
    text: cue.text,
    word_count: cue.word_count,
    pace: cue.pace,
    pauses: cue.pauses,
    turn_structure: cue.turn_structure,
    interaction_cues: cue.interaction_cues,
    rhythm_profile: cue.rhythm_profile,
    tonality_profile: cue.tonality_profile,
    emphasis: cue.emphasis,
    pitch_energy_contour: cue.pitch_energy_contour,
    sound_environment: cue.sound_environment,
  }));
}

function prosodyCuesFromSampleRows(samples: AudioSampleRow[]): ProsodyCue[] {
  return samples.map((sample): ProsodyCue => {
    const duration = typeof sample.start === "number" && typeof sample.end === "number"
      ? Math.max(0.001, sample.end - sample.start)
      : 0;
    const wordCount = sample.text ? sample.text.trim().split(/\s+/).filter(Boolean).length : 0;
    const pace = duration ? wordCount / duration : undefined;
    return {
      cue_id: sample.sampleId,
      start: sample.start,
      end: sample.end,
      text: sample.text,
      word_count: wordCount,
      pace: {
        words_per_second: pace,
        label: pace === undefined ? "sample cloud" : pace > 3 ? "fast" : pace > 1.2 ? "measured" : "slow",
      },
      pauses: { before_label: "source linked", after_label: sample.reviewState || "candidate" },
      turn_structure: { transition: sample.sampleRole || "candidate reference" },
      interaction_cues: { role_support: sample.cloudLabel || sample.entityType || "audio sample" },
      rhythm_profile: { label: sample.features?.rhythm_profile_label || "not measured" },
      tonality_profile: { label: sample.features?.tonality_profile_label || "not measured" },
      emphasis: { score: sample.confidence, label: sample.confidence !== undefined ? "confidence proxy" : "not measured" },
      pitch_energy_contour: {
        pitch_hz: sample.features?.pitch_hz_mean,
        energy_dbfs: sample.features?.energy_dbfs_mean,
        label: sample.features?.voice_embedding_ref || "voice sample",
      },
      sound_environment: {
        label: sample.features?.sound_environment_label || "speech sample cloud",
      },
    };
  });
}

function diarizationFromStatus(status: any): Record<string, any> {
  const audioAnalysis = statusAudioAnalysis(status);
  return firstObject(status?.audio_diarization, audioAnalysis.audio_diarization);
}

function musicLyricsFromStatus(status: any): Record<string, any> {
  const audioAnalysis = statusAudioAnalysis(status);
  return firstObject(
    status?.music_lyrics_analysis,
    status?.tune_lyrics,
    audioAnalysis.music_lyrics_analysis,
    audioAnalysis.tune_lyrics,
  );
}

function musicRowsFromStatus(status: any, audioEvents: AudioEvent[], prosodyCues: ProsodyCue[], sampleRows: AudioSampleRow[]) {
  const payload = musicLyricsFromStatus(status);
  const musicalAnalysis = asObject(payload.musical_analysis);
  const musicEvents = audioEvents.filter((event) => categoryFor(event) === "music" || /music|song|score/i.test(String(event.source_layer || "")));
  const musicProsody = prosodyCues.filter((cue) => /music|song|score/i.test(cue.sound_environment?.label || ""));
  const rows: Array<Record<string, unknown>> = [];
  if (Object.keys(musicalAnalysis).length) {
    rows.push({
      source: "music analysis",
      start: 0,
      end: musicalAnalysis.duration_seconds,
      label: musicalAnalysis.status || "computed",
      value: [
        musicalAnalysis.tempo_bpm ? `${formatValue(musicalAnalysis.tempo_bpm)} bpm` : null,
        musicalAnalysis.beats_per_second ? `${formatValue(musicalAnalysis.beats_per_second)} beats/s` : null,
        musicalAnalysis.average_key_indication ? `key ${formatValue(musicalAnalysis.average_key_indication)}` : null,
      ].filter(Boolean).join(" / ") || "available",
      evidence: "music_lyrics_analysis.musical_analysis",
    });
  }
  musicEvents.forEach((event) => rows.push({
    source: "music/sound interval",
    start: event.start,
    end: event.end,
    label: eventLabel(event),
    value: event.classifier_labels?.join(", ") || formatValue(event.confidence),
    evidence: event.source_layer || "audio_event_intervals",
  }));
  musicProsody.forEach((cue) => rows.push({
    source: "prosody sound environment",
    start: cue.start,
    end: cue.end,
    label: cue.sound_environment?.label || "music-like cue",
    value: cue.pitch_energy_contour?.label || cue.tonality_profile?.label || "",
    evidence: cue.cue_id || "audio_prosody.cues",
  }));
  sampleRows.forEach((sample) => rows.push({
    source: "audio sample cloud",
    start: sample.start,
    end: sample.end,
    label: sample.label || sample.cloudLabel || "reviewable audio sample",
    value: [
      sample.sampleRole,
      sample.reviewState,
      sample.confidence !== undefined ? `confidence ${formatValue(sample.confidence)}` : null,
    ].filter(Boolean).join(" / ") || "candidate",
    evidence: `${sample.source} -> ${sample.sampleId}`,
  }));
  return rows;
}

function lyricRowsFromStatus(status: any, transcriptRows: TranscriptAudioRow[]) {
  const payload = musicLyricsFromStatus(status);
  const matches = asArray<any>(payload.lyrics_in_transcript).map((item) => ({
    start: item.start,
    end: item.end,
    lyric: item.matched_lyric_line || item.lyrics_excerpt || item.text || "",
    transcript: item.transcript_text || item.text || "",
    confidence: item.confidence,
    source: item.schema || "vaa1.lyric_transcript_match.v1",
  }));
  if (matches.length) return matches;
  if (transcriptRows.length) {
    return transcriptRows.map((row) => ({
      start: row.start,
      end: row.end,
      lyric: "license-free transcript only",
      transcript: row.text || "",
      confidence: undefined,
      source: `${row.source || "mature transcript timeline"} -> ${row.id || ""}`,
    }));
  }
  return sampleCloudRowsFromStatus(status).map((sample) => ({
    start: sample.start,
    end: sample.end,
    lyric: "license-free transcript only",
    transcript: sample.text || "",
    confidence: sample.confidence,
    source: `${sample.source} -> ${sample.sampleId}`,
  }));
}

function foleyRowsFromAudio(status: any, audioEvents: AudioEvent[], prosodyCues: ProsodyCue[]): FoleyCandidateRow[] {
  const sampleRows = sampleCloudRowsFromStatus(status);
  const candidates: FoleyCandidateRow[] = [];

  const inspect = (
    text: string,
    start: unknown,
    end: unknown,
    source: string,
    confidence?: unknown,
  ) => {
    const match = FOLEY_PATTERNS.find((pattern) => pattern.pattern.test(text));
    if (!match) return;
    candidates.push({
      label: match.label,
      start: typeof start === "number" ? start : undefined,
      end: typeof end === "number" ? end : undefined,
      source,
      confidence: typeof confidence === "number" ? confidence : undefined,
      reviewState: "candidate_review_required",
      proliferationTarget: match.target,
      nextAction: "Audition sample, confirm label, then proliferate only as reviewed local evidence.",
    });
  };

  audioEvents.forEach((event) => {
    inspect(
      [
        eventLabel(event),
        event.classifier_labels?.join(" "),
        event.source_layer,
        event.text,
      ].filter(Boolean).join(" "),
      event.start,
      event.end,
      event.source_layer || "audio_event_intervals",
      event.confidence,
    );
  });
  prosodyCues.forEach((cue) => {
    inspect(
      [cue.sound_environment?.label, cue.pitch_energy_contour?.label, cue.text].filter(Boolean).join(" "),
      cue.start,
      cue.end,
      "audio_prosody.cues",
      cue.emphasis?.score,
    );
  });
  sampleRows.forEach((sample) => {
    inspect(
      [sample.label, sample.cloudLabel, sample.text].filter(Boolean).join(" "),
      sample.start,
      sample.end,
      `${sample.source} -> ${sample.sampleId}`,
      sample.confidence,
    );
  });

  if (candidates.length) return candidates.slice(0, 200);
  return sampleRows.slice(0, 200).map((sample) => ({
    label: sample.label || sample.cloudLabel || "reviewable audio sample",
    start: sample.start,
    end: sample.end,
    source: `${sample.source} -> ${sample.sampleId}`,
    confidence: sample.confidence,
    reviewState: sample.reviewState || "candidate_review_required",
    proliferationTarget: "Audio sample cloud -> reviewed foley/sound candidate if analyst confirms a repeatable point sound",
    nextAction: "Audition sample at source time; only promote as gun shot, laughter, roar, applause, or other foley after review.",
  }));
}

function recognitionRows(status: any, audioEvents: AudioEvent[], prosodyCues: ProsodyCue[], transcriptRows: TranscriptAudioRow[]): RecognitionRow[] {
  const diarization = diarizationFromStatus(status);
  const musicLyrics = musicLyricsFromStatus(status);
  const audioSampleClouds = firstObject(status?.audio_sample_clouds, statusAudioAnalysis(status).audio_sample_clouds);
  const lyricMatches = asArray(musicLyrics.lyrics_in_transcript);
  const narrativeAgentSamples = sampleCloudRowsFromStatus(status).filter((sample) => (
    /narrative|agent|character/i.test(String(sample.entityType || sample.cloudLabel || sample.source || ""))
  ));
  const speechSource = transcriptRows.length
    ? "mature transcript timeline + speaker labels"
    : "audio_event_intervals + diarization fallback";
  return [
    {
      layer: "Speaker diarization",
      status: diarization.status || "missing",
      rows: Number(diarization.turn_count || asArray(diarization.speaker_turns).length || 0),
      source: diarization.provider || "audio_diarization",
      nextAction: "Review speaker clusters; promote only as narrative-agent audio evidence after source confirmation.",
    },
    {
      layer: "Speech / silence / noise / music intervals",
      status: audioEvents.length ? "available" : "missing",
      rows: audioEvents.length,
      source: speechSource,
      nextAction: transcriptRows.length
        ? "Transcript timing is authoritative; use diarization only as supporting speaker metadata."
        : "Use interval rows for navigation and route mature events through Master Schema.",
    },
    {
      layer: "Prosody cues",
      status: prosodyCues.length ? "available" : "missing",
      rows: prosodyCues.length,
      source: "audio_prosody.cues",
      nextAction: "Inspect pace, pause, emphasis, pitch-energy, rhythm, tonality, and turn structure.",
    },
    {
      layer: "Music analysis",
      status: asObject(musicLyrics.musical_analysis).status || (Object.keys(asObject(musicLyrics.musical_analysis)).length ? "available" : "missing"),
      rows: Object.keys(asObject(musicLyrics.musical_analysis)).length ? 1 : 0,
      source: "music_lyrics_analysis.musical_analysis",
      nextAction: "Keep license-free/local analysis as default; online or licensed lyric providers require explicit activation.",
    },
    {
      layer: "Lyrics in transcript",
      status: lyricMatches.length ? "candidate" : "missing",
      rows: lyricMatches.length,
      source: "music_lyrics_analysis.lyrics_in_transcript",
      nextAction: "Review lyric matches against transcript timing before promoting to mature evidence.",
    },
    {
      layer: "Audio recognition sample clouds",
      status: audioSampleClouds.status || "missing",
      rows: Number(audioSampleClouds.sample_count || 0),
      source: "audio_sample_clouds",
      nextAction: "Use sample clouds for candidate voice-pattern matching, not narrative-agent truth.",
    },
    {
      layer: "Narrative agent audio confirmations",
      status: narrativeAgentSamples.length ? "candidate" : "missing",
      rows: narrativeAgentSamples.length,
      source: "audio_sample_clouds + narrative agent sample routes",
      nextAction: "Surface confirmed narrative-agent anchors here before any mature detection proliferation.",
    },
  ];
}

function jumpTo(time: unknown, context?: { analysisId?: string; label?: string; source?: string }) {
  if (typeof time === "number" && Number.isFinite(time)) {
    const safeTime = Math.max(0, time);
    if (context?.analysisId) {
      eventBus.emit("videoIdChanged", context.analysisId);
    }
    eventBus.emit("videoTimeLineChanged", safeTime);
    eventBus.emit("videoEvidenceSelected", {
      videoId: context?.analysisId,
      panelType: "AudioPanel",
      modality: "audio",
      timestamp: safeTime,
      label: context?.label || "Audio evidence",
      sourceItem: {
        source: context?.source,
        start: safeTime,
      },
    });
  }
}

function buildAudioManualAnnotation(
  analysisId: string,
  target: AudioDecisionTarget,
  decision: AudioWorkbenchDecision,
  appliedLabel: string,
  visualAnchor: VisualAnchor | null,
  now: string,
): ManualVisualAnnotation {
  const range = decisionTimeRange(target);
  const annotationId = `audio-workbench:${analysisId}:${target.rowType}:${safeIdPart(target.id)}:${decision}`;
  const confirmed = decision === "confirmed" || decision === "agent" || decision === "sample";
  return {
    id: annotationId,
    category: "Audio",
    subcategory:
      decision === "sample"
        ? "Audio sample candidate"
      : decision === "dropped"
        ? "Dropped audio candidate"
          : "Narrative agent audio confirmation",
    label: appliedLabel,
    custom_label: appliedLabel,
    geometry_type: "box",
    coordinates: { x: 0, y: 0, w: 1, h: 1 },
    timestamp_seconds: range.start,
    start_seconds: range.start,
    end_seconds: range.end,
    identity_affirmation: decision === "dropped" ? undefined : appliedLabel,
    audio_foley_note: target.rowType.includes("foley") || decision === "sample" ? target.label : undefined,
    open_note: [
      target.text ? `Transcript: ${target.text}` : null,
      target.speakerLabel ? `Speaker label: ${target.speakerLabel}` : null,
      visualAnchor ? `Visual anchor: ${visualAnchor.label}` : null,
      decision === "dropped" ? "Analyst dropped this audio candidate." : null,
    ].filter(Boolean).join(" / "),
    metadata_correlation: {
      target_type: "audio_evidence_row",
      target_id: target.id,
      target_label: appliedLabel,
      apply_scope: decision === "sample" ? "linked_candidates" : "this_interval_only",
      authority_state:
        decision === "dropped"
          ? "analyst_rejected"
          : visualAnchor
            ? "analyst_confirmed_narrative_agent_via_audio_visual_anchor"
            : "analyst_confirmed_narrative_agent_audio_anchor",
      maturity_state: confirmed ? "mature_manual_anchor" : "dropped",
      relation: visualAnchor ? "supports" : "unknown",
      source_range_source: "mature_transcript_timeline",
      maturity_policy: "Most mature data wins: analyst-confirmed audio-visual narrative-agent anchors outrank raw diarization labels.",
      note: target.source,
      manual_confirmation_event: {
        event_type: "audio_workbench_confirmation",
        event_id: annotationId,
        analysis_id: analysisId,
        authority_level: "manual_confirmation",
        confirmed_fields: {
          source_time: true,
          transcript_text: Boolean(target.text),
          narrative_agent: decision !== "dropped",
          audio_visual_narrative_agent_triangulation: Boolean(visualAnchor),
          sample_candidate: decision === "sample",
          dropped: decision === "dropped",
        },
        active_state_after_save: {
          source_panel: "AudioPanel",
          row_type: target.rowType,
          source_layer: target.source,
          start_seconds: range.start,
          end_seconds: range.end,
          narrative_agent_label: appliedLabel,
          visual_anchor_id: visualAnchor?.id,
          visual_anchor_label: visualAnchor?.label,
        },
        propagation_required: decision !== "dropped",
        partial_propagation_allowed: decision === "sample",
      },
    },
    teaches_regime: decision !== "dropped",
    created_at: now,
    updated_at: now,
    updated_by: "analyst",
  };
}

function buildAudioProliferationDecision(
  analysisId: string,
  target: AudioDecisionTarget,
  decision: AudioWorkbenchDecision,
  appliedLabel: string,
  visualAnchor: VisualAnchor | null,
  now: string,
): ProliferationDecision {
  const range = decisionTimeRange(target);
  const hasSourceTime = typeof target.start === "number" && Number.isFinite(target.start);
  const confirmed = decision === "confirmed" || decision === "agent";
  const sample = decision === "sample";
  const canceled = decision === "dropped";
  return {
    decision_id: `audio:${decision}:${analysisId}:${target.rowType}:${safeIdPart(target.id)}`,
    candidate_id: target.id,
    decision_scope: sample ? "cluster" : "candidate",
    decision: confirmed || sample ? "confirmed" : canceled ? "canceled" : "inspected",
    authority_level: visualAnchor
      ? "manual_audio_visual_narrative_agent_triangulation"
      : "manual_audio_workbench_review",
    source_panel: "AudioPanel",
    source_verification_status: hasSourceTime ? "source_time_resolved" : "source_anchor_missing",
    source_range_source: hasSourceTime ? "mature_transcript_timeline" : undefined,
    candidate_label: target.label,
    applied_label: appliedLabel,
    target_evidence_id: target.id,
    source_anchors: [
      {
        source_panel: "AudioPanel",
        source_ref: target.source,
        source_time: range,
        transcript_text: target.text,
        speaker_label: target.speakerLabel,
      },
      visualAnchor
        ? {
            source_panel: "VideoPanel",
            source_ref: visualAnchor.id,
            source_time: range,
            narrative_agent_visual_anchor_label: visualAnchor.label,
            relation: visualAnchor.relation,
          }
        : {},
    ].filter((item) => Object.keys(item).length),
    evidence_refs: [
      {
        id: target.id,
        panel: "AudioPanel",
        time: range,
        narrative_agent_label: appliedLabel,
        text: target.text,
      },
    ],
    source_traceback_refs: [`traceback:audio:${target.id}`],
    projection_targets: confirmed || sample
      ? ["MasterSchema", "MeaningNetwork", "TracebackDrawer", "VideoPanel", "StatsKit"]
      : [],
    proliferates_to: confirmed || sample
      ? ["master_schema", "meaning_network", "traceback", "source_timed_panels", "statskit"]
      : [],
    proliferation_allowed: confirmed || sample,
    decision_reason:
      confirmed
        ? "Analyst confirmed narrative-agent audio evidence with mature transcript timing and optional audio-visual anchor."
        : sample
          ? "Analyst staged this source-timed audio row as a governed sample for local proliferation."
          : "Analyst dropped this audio evidence row from mature-data promotion.",
    created_at: now,
    created_by: "analyst",
  };
}

function AudioPanel({ analysis, analysisId: explicitAnalysisId, videoId }: AudioPanelProps) {
  const analysisId = analysis?.analysis_id || analysis?.id || explicitAnalysisId || videoId || "";
  const [status, setStatus] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(analysisId));
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingDecisionId, setSavingDecisionId] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) {
      setStatus(null);
      setAnalysisData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchAudioStatus() {
      setIsLoading(true);
      setError(null);
      try {
        const [nextStatus, nextAnalysisData] = await Promise.all([
          apiService.getStatus(analysisId),
          VideoService.getAnalysis(analysisId).catch(() => null),
        ]);
        if (!cancelled) {
          setStatus(nextStatus);
          setAnalysisData(nextAnalysisData);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load audio data.");
          setStatus(null);
          setAnalysisData(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchAudioStatus();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  const transcriptRows = useMemo(() => transcriptRowsFromAnalysisData(analysisData), [analysisData]);
  const timingAudit = useMemo(
    () => transcriptTimingAudit(analysisData, status, transcriptRows),
    [analysisData, status, transcriptRows],
  );
  const rawSampleRows = useMemo(() => sampleCloudRowsFromStatus(status), [status]);
  const sampleRows = useMemo(() => alignSampleRowsToTranscript(rawSampleRows, transcriptRows), [rawSampleRows, transcriptRows]);
  const rawAudioEvents = useMemo(() => audioEventsFromStatus(status), [status]);
  const transcriptAlignedAudioEvents = useMemo(
    () => audioEventsFromMatureTranscript(transcriptRows, rawAudioEvents, timingAudit),
    [transcriptRows, rawAudioEvents, timingAudit],
  );
  const prosodyCues = useMemo(() => {
    const analysisProsody = prosodyCuesFromAnalysisData(analysisData);
    if (analysisProsody.length) return analysisProsody;
    const statusProsody = prosodyCuesFromStatus(status);
    if (statusProsody.length && !transcriptRows.length) return statusProsody;
    return prosodyCuesFromSampleRows(sampleRows);
  }, [analysisData, status, sampleRows, transcriptRows]);
  const audioEvents = useMemo(
    () => enrichAudioEventsWithMeasurements(transcriptAlignedAudioEvents, sampleRows, prosodyCues, transcriptRows),
    [transcriptAlignedAudioEvents, sampleRows, prosodyCues, transcriptRows],
  );
  const musicRows = useMemo(() => musicRowsFromStatus(status, audioEvents, prosodyCues, sampleRows), [status, audioEvents, prosodyCues, sampleRows]);
  const lyricRows = useMemo(() => lyricRowsFromStatus(status, transcriptRows), [status, transcriptRows]);
  const foleyRows = useMemo(() => foleyRowsFromAudio(status, audioEvents, prosodyCues), [status, audioEvents, prosodyCues]);
  const governanceRows = useMemo(() => recognitionRows(status, audioEvents, prosodyCues, transcriptRows), [status, audioEvents, prosodyCues, transcriptRows]);
  const narrativeAgentOptions = useMemo(() => knownNarrativeAgentOptions(analysisData), [analysisData]);
  const sourceMediaPath = sourceMediaPathFromStatus(status);
  const waveformRows = useMemo(() => waveformRowsFromAudio(sampleRows, prosodyCues, audioEvents), [sampleRows, prosodyCues, audioEvents]);
  const categorizedEvents = useMemo(() => {
    const categories: Record<"speech" | "music" | "noise" | "silence" | "other", AudioEvent[]> = {
      speech: [],
      music: [],
      noise: [],
      silence: [],
      other: [],
    };
    audioEvents.forEach((event) => categories[categoryFor(event)].push(event));
    return categories;
  }, [audioEvents]);

  if (!analysisId) return <div className="h-full bg-[#080808] p-4 text-sm text-slate-500">Select an analysis to inspect audio evidence.</div>;
  if (isLoading) return <div className="h-full bg-[#080808] p-4 text-sm text-slate-400">Loading audio workbench...</div>;
  if (error) return <div className="h-full bg-[#080808] p-4 text-sm text-amber-200">{error}</div>;

  const correctionDecisions = analysisData?.annotationCorrections?.proliferation_decisions || [];
  const decisionStatusFor = (target: AudioDecisionTarget): string => {
    const matched = correctionDecisions.find((decision) => decision.candidate_id === target.id);
    if (matched?.decision === "canceled") return "dropped";
    if (matched?.decision === "confirmed") return "confirmed";
    return "candidate";
  };

  const persistAudioDecision = async (
    target: AudioDecisionTarget,
    decision: AudioWorkbenchDecision,
    explicitLabel?: string,
  ) => {
    if (!analysisId) return;
    if (decision !== "dropped" && !targetHasValidSourceTiming(target)) {
      setSaveMessage(
        target.staleReason
          ? `Audio row is quarantined until its source clock is rebuilt: ${target.staleReason}.`
          : "Audio row is not source-time valid yet. Rebuild or verify timing before confirmation or sampling.",
      );
      return;
    }
    const visualAnchor = visualAnchorForTarget(target, analysisData);
    if (decision === "confirmed" && target.rowType.startsWith("speech") && !visualAnchor && !explicitLabel) {
      setSaveMessage("Choose a known narrative agent for this speech row, or confirm an overlapping visual anchor first.");
      return;
    }
    if (decision === "agent" && !explicitLabel) {
      setSaveMessage("Choose a known narrative agent before confirming this audio row.");
      return;
    }
    const appliedLabel = String(
      explicitLabel ||
      visualAnchor?.label ||
      target.speakerLabel ||
      target.label ||
      "Narrative agent audio evidence",
    ).trim();
    const now = new Date().toISOString();
    const decisionId = `audio:${decision}:${analysisId}:${target.rowType}:${safeIdPart(target.id)}`;
    setSavingDecisionId(decisionId);
    setSaveMessage(
      decision === "dropped"
        ? "Dropping audio evidence..."
        : decision === "sample"
          ? "Staging audio sample..."
          : "Saving narrative-agent audio confirmation...",
    );
    try {
      const existing: AnnotationCorrections = analysisData?.annotationCorrections || {};
      const manualAnnotation = buildAudioManualAnnotation(
        analysisId,
        target,
        decision,
        appliedLabel,
        visualAnchor,
        now,
      );
      const proliferationDecision = buildAudioProliferationDecision(
        analysisId,
        target,
        decision,
        appliedLabel,
        visualAnchor,
        now,
      );
      const withAnnotation = upsertManualVisualAnnotation(existing, manualAnnotation);
      const withPresence = decision === "dropped"
        ? withAnnotation
        : upsertMasterSchemaPresenceIntervalForManualAnnotation(withAnnotation, manualAnnotation, {
            now,
            sourcePanel: "AudioPanel",
          });
      const nextCorrections: AnnotationCorrections = {
        ...withPresence,
        analysis_id: analysisId,
        version: 1,
        updated_at: now,
        updated_by: "analyst",
        proliferation_decisions: [
          ...(withPresence.proliferation_decisions || []).filter((item) => item.decision_id !== proliferationDecision.decision_id),
          proliferationDecision,
        ],
      };
      const savedCorrections = await VideoService.saveAnnotationCorrections(analysisId, nextCorrections);
      setAnalysisData((current) => current ? { ...current, annotationCorrections: savedCorrections } : current);
      const refreshed = await VideoService.refreshAnalysis(analysisId);
      setAnalysisData(refreshed);
      eventBus.emit("analysisCorrectionsChanged", analysisId);
      setSaveMessage(
        decision === "dropped"
          ? "Audio evidence dropped."
          : decision === "sample"
            ? "Audio sample staged for governed proliferation."
            : visualAnchor
              ? `Narrative agent confirmed via audio-visual anchor: ${visualAnchor.label}.`
              : "Narrative-agent audio evidence confirmed.",
      );
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "Audio decision save failed.");
    } finally {
      setSavingDecisionId(null);
    }
  };

  const renderDecisionControls = (target: AudioDecisionTarget) => {
    const visualAnchor = visualAnchorForTarget(target, analysisData);
    const status = decisionStatusFor(target);
    const rowSaveKey = `:${analysisId}:${target.rowType}:${safeIdPart(target.id)}`;
    const rowIsSaving = Boolean(savingDecisionId?.includes(rowSaveKey));
    const invalidTiming = !targetHasValidSourceTiming(target);
    const buttonClass = "rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-cyan-400 hover:text-cyan-100";
    return (
      <div className="flex min-w-[220px] items-center gap-1" data-vaa1-audio-row-actions="true">
        <span className={status === "confirmed" ? "mr-1 text-[10px] text-cyan-200" : status === "dropped" ? "mr-1 text-[10px] text-amber-200" : "mr-1 text-[10px] text-slate-500"}>
          {invalidTiming ? "timing rebuild needed" : visualAnchor ? `anchor: ${visualAnchor.label}` : status}
        </span>
        <button type="button" className={buttonClass} disabled={rowIsSaving || invalidTiming} onClick={(event) => { event.stopPropagation(); void persistAudioDecision(target, "confirmed"); }}>Confirm</button>
        <select
          className="max-w-[150px] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200"
          defaultValue=""
          disabled={rowIsSaving || invalidTiming || narrativeAgentOptions.length === 0}
          title="Confirm as known narrative agent"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            const label = event.target.value;
            event.currentTarget.value = "";
            if (label) void persistAudioDecision(target, "agent", label);
          }}
        >
          <option value="">Agent</option>
          {narrativeAgentOptions.map((option) => (
            <option key={option.id} value={option.label}>{option.label}</option>
          ))}
        </select>
        <button type="button" className={buttonClass} disabled={rowIsSaving || invalidTiming} onClick={(event) => { event.stopPropagation(); void persistAudioDecision(target, "sample"); }}>Sample</button>
        <button type="button" className="rounded border border-amber-700/70 px-2 py-1 text-[10px] text-amber-200 hover:border-amber-400" disabled={rowIsSaving} onClick={(event) => { event.stopPropagation(); void persistAudioDecision(target, "dropped"); }}>Drop</button>
      </div>
    );
  };

  const governanceNavigationTarget = (row: RecognitionRow): AudioDecisionTarget => {
    const layer = row.layer.toLowerCase();
    if (layer.includes("speaker") || layer.includes("speech")) {
      const event = categorizedEvents.speech[0];
      return {
        id: `governance:${safeIdPart(row.layer)}`,
        label: row.layer,
        text: event?.text,
        start: event?.start,
        end: event?.end,
        source: row.source,
        rowType: "audio-recognition-governance",
        speakerLabel: event?.speaker_label,
      };
    }
    if (layer.includes("prosody")) {
      const cue = prosodyCues[0];
      return {
        id: `governance:${safeIdPart(row.layer)}`,
        label: row.layer,
        text: cue?.text,
        start: cue?.start,
        end: cue?.end,
        source: row.source,
        rowType: "audio-recognition-governance",
      };
    }
    if (layer.includes("music")) {
      const music = musicRows[0];
      return {
        id: `governance:${safeIdPart(row.layer)}`,
        label: row.layer,
        start: typeof music?.start === "number" ? music.start : undefined,
        end: typeof music?.end === "number" ? music.end : undefined,
        source: row.source,
        rowType: "audio-recognition-governance",
      };
    }
    if (layer.includes("lyrics")) {
      const lyric = lyricRows[0];
      return {
        id: `governance:${safeIdPart(row.layer)}`,
        label: row.layer,
        text: lyric?.transcript,
        start: lyric?.start,
        end: lyric?.end,
        source: row.source,
        rowType: "audio-recognition-governance",
      };
    }
    const sample = sampleRows[0];
    return {
      id: `governance:${safeIdPart(row.layer)}`,
      label: row.layer,
      text: sample?.text,
      start: sample?.start,
      end: sample?.end,
      source: row.source,
      rowType: "audio-recognition-governance",
    };
  };

  const renderAudioEventRows = (events: AudioEvent[]) => events.length ? events.map((event, index) => (
    <tr key={event.segment_id || event.interval_id || event.event_id || `audio:${index}`} className="cursor-pointer border-b border-slate-900 hover:bg-slate-900" onClick={() => jumpTo(event.start, { analysisId, label: eventLabel(event), source: event.source_layer })}>
      <td className="px-3 py-2 font-semibold text-slate-100">{eventLabel(event)}</td>
      <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(event.start)}</td>
      <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(event.end)}</td>
      <td className="px-3 py-2 font-mono text-slate-300">{formatValue(eventDuration(event))}s</td>
      <td className="px-3 py-2 font-mono text-slate-300">{formatValue(event.confidence)}</td>
      <td className="px-3 py-2 font-mono text-slate-300">{formatValue(event.measurements?.energy_dbfs)}</td>
      <td className="px-3 py-2 font-mono text-slate-300">{formatValue(event.measurements?.pitch_hz)}</td>
      <td className="max-w-[360px] truncate px-3 py-2 text-slate-400" title={event.text || ""}>{event.text || ""}</td>
      <td className="max-w-[300px] truncate px-3 py-2 text-slate-500" title={event.source_layer || ""}>{event.source_layer || event.classifier_labels?.join(", ") || ""}</td>
      <td className="px-3 py-2">{renderDecisionControls({
        id: event.segment_id || event.interval_id || event.event_id || `audio:${index}`,
        label: eventLabel(event),
        text: event.text,
        start: event.start,
        end: event.end,
        source: event.source_layer,
        rowType: `speech-${categoryFor(event)}`,
        speakerLabel: event.speaker_label,
        isStale: event.is_stale,
        staleReason: event.stale_reason,
        validForConfirmation: event.valid_for_confirmation,
      })}</td>
    </tr>
  )) : (
    <tr><td className="px-3 py-3 text-slate-500" colSpan={10}>No rows available for this layer.</td></tr>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080808] p-4 text-white" data-vaa1-panel="audio-workbench">
      <h2 className="mb-3 shrink-0 text-lg font-bold text-slate-100">Audio Workbench</h2>
      {sourceMediaPath ? (
        <div className="mb-3 shrink-0 truncate border border-slate-800 px-3 py-2 text-xs text-slate-400" data-vaa1-audio-source-media-link="true" title={sourceMediaPath}>
          Source media: <span className="font-mono text-cyan-200">{sourceMediaPath}</span>
        </div>
      ) : null}
      {saveMessage ? (
        <div className="mb-3 shrink-0 border border-cyan-900/70 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100" data-vaa1-audio-save-message="true">
          {saveMessage}
        </div>
      ) : null}
      {timingAudit.status === "global_anchor_only" ? (
        <div className="mb-3 shrink-0 border border-amber-800/70 bg-amber-950/20 px-3 py-2 text-xs text-amber-100" data-vaa1-audio-timing-audit="global-anchor-only">
          <span className="font-semibold">{timingAudit.label}:</span>{" "}
          {timingAudit.detail}{" "}
          <span className="text-amber-300/80">
            {timingAudit.uniformRows}/{timingAudit.totalRows} rows share one duration pattern
            {typeof timingAudit.coverageRatio === "number" ? `; coverage ${(timingAudit.coverageRatio * 100).toFixed(1)}%` : ""}.
          </span>
        </div>
      ) : timingAudit.status === "source_locked" ? (
        <div className="mb-3 shrink-0 border border-cyan-900/60 bg-cyan-950/10 px-3 py-2 text-xs text-cyan-100" data-vaa1-audio-timing-audit="source-locked">
          <span className="font-semibold">{timingAudit.label}:</span> {timingAudit.detail}
        </div>
      ) : null}
      <div className="mb-3 shrink-0 border border-slate-800 px-3 py-2" data-vaa1-audio-waveform-strip="true">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-cyan-200">
          <span>Waveform / Energy Strip</span>
          <span className="normal-case tracking-normal text-slate-500">{waveformRows.length ? `${waveformRows.length} measured window(s)` : "waiting for measured energy windows"}</span>
        </div>
        <div className="flex h-24 items-end gap-[2px] overflow-x-auto">
          {waveformRows.length ? waveformRows.map((row) => (
            <button
              key={row.id}
              className="min-w-[8px] bg-cyan-500/70 hover:bg-cyan-300"
              style={{ height: `${energyBarHeight(row.energy)}%` }}
              title={`${formatTime(row.start)}-${formatTime(row.end)} ${row.label} / energy ${formatValue(row.energy)} dBFS / ${pitchLabel(row.pitch)} / ${row.source}`}
              onClick={() => jumpTo(row.start, { analysisId, label: row.label, source: row.source })}
            />
          )) : (
            <div className="pb-3 text-xs text-slate-500">Energy and pitch will surface here after audio_prosody or measured sample-cloud windows provide dBFS / Hz values.</div>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <details className="mb-3 border border-slate-800" open data-vaa1-audio-section="speech-diarization">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Speech, VAD, And Speaker Diarization</summary>
          <div className="max-h-[58vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className="sticky top-0 bg-slate-950 uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Energy</th>
                  <th className="px-3 py-2">Pitch</th>
                  <th className="px-3 py-2">Text</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>{renderAudioEventRows(categorizedEvents.speech)}</tbody>
            </table>
          </div>
        </details>

        <details className="mb-3 border border-slate-800" open data-vaa1-audio-section="prosody">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Prosody, Delivery, And Turn Structure</summary>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className="sticky top-0 bg-slate-950 uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Pace</th>
                  <th className="px-3 py-2">Pause</th>
                  <th className="px-3 py-2">Turn</th>
                  <th className="px-3 py-2">Rhythm</th>
                  <th className="px-3 py-2">Tonality</th>
                  <th className="px-3 py-2">Emphasis</th>
                  <th className="px-3 py-2">Sound Environment</th>
                  <th className="px-3 py-2">Text</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prosodyCues.length ? prosodyCues.map((cue, index) => (
                  <tr key={cue.cue_id || `prosody:${index}`} className="cursor-pointer border-b border-slate-900 hover:bg-slate-900" onClick={() => jumpTo(cue.start, { analysisId, label: cue.sound_environment?.label || cue.text || "Prosody cue", source: cue.cue_id || "audio_prosody.cues" })}>
                    <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(cue.start)}-{formatTime(cue.end)}</td>
                    <td className="px-3 py-2">{cue.pace?.label || "n/a"} <span className="font-mono text-slate-500">{formatValue(cue.pace?.words_per_second)}</span></td>
                    <td className="px-3 py-2">{cue.pauses?.before_label || "n/a"} / {cue.pauses?.after_label || "n/a"}</td>
                    <td className="px-3 py-2">{cue.turn_structure?.transition || cue.interaction_cues?.role_support || "n/a"}</td>
                    <td className="px-3 py-2">{cue.rhythm_profile?.label || "n/a"}</td>
                    <td className="px-3 py-2">{cue.tonality_profile?.label || cue.pitch_energy_contour?.label || "n/a"}</td>
                    <td className="px-3 py-2">{cue.emphasis?.label || "n/a"} <span className="font-mono text-slate-500">{formatValue(cue.emphasis?.score)}</span></td>
                    <td className="px-3 py-2">{cue.sound_environment?.label || "n/a"}</td>
                    <td className="max-w-[360px] truncate px-3 py-2 text-slate-500" title={cue.text || ""}>{cue.text || ""}</td>
                    <td className="px-3 py-2">{renderDecisionControls({
                      id: cue.cue_id || `prosody:${index}`,
                      label: cue.sound_environment?.label || cue.text || "Prosody cue",
                      text: cue.text,
                      start: cue.start,
                      end: cue.end,
                      source: cue.cue_id || "audio_prosody.cues",
                      rowType: "prosody",
                    })}</td>
                  </tr>
                )) : (
                  <tr><td className="px-3 py-3 text-slate-500" colSpan={10}>No prosody cues are available for this analysis.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </details>

        <details className="mb-3 border border-slate-800" data-vaa1-audio-section="music-sound">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Music And Sound Classifier</summary>
          <div className="max-h-[44vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className="sticky top-0 bg-slate-950 uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Evidence</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {musicRows.length ? musicRows.map((row, index) => (
                  <tr key={`music:${index}`} className="cursor-pointer border-b border-slate-900 hover:bg-slate-900" onClick={() => jumpTo(row.start, { analysisId, label: String(row.label || row.source || "Music/sound row"), source: String(row.evidence || row.source || "") })}>
                    <td className="px-3 py-2 font-semibold text-slate-100">{String(row.source || "")}</td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(row.start)}</td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(row.end)}</td>
                    <td className="px-3 py-2">{String(row.label || "")}</td>
                    <td className="px-3 py-2">{String(row.value || "")}</td>
                    <td className="max-w-[360px] truncate px-3 py-2 text-slate-500" title={String(row.evidence || "")}>{String(row.evidence || "")}</td>
                    <td className="px-3 py-2">{renderDecisionControls({
                      id: `music:${index}:${safeIdPart(row.label || row.source)}`,
                      label: String(row.label || row.source || "Music/sound row"),
                      start: typeof row.start === "number" ? row.start : undefined,
                      end: typeof row.end === "number" ? row.end : undefined,
                      source: String(row.evidence || row.source || ""),
                      rowType: "music-sound",
                    })}</td>
                  </tr>
                )) : (
                  <tr><td className="px-3 py-3 text-slate-500" colSpan={7}>No music or sound classifier rows are available yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </details>

        <details className="mb-3 border border-slate-800" data-vaa1-audio-section="lyrics">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Lyrics And Transcript Matches</summary>
          <div className="max-h-[38vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className="sticky top-0 bg-slate-950 uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Lyric</th>
                  <th className="px-3 py-2">Transcript</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lyricRows.length ? lyricRows.map((row, index) => (
                  <tr key={`lyric:${index}`} className="cursor-pointer border-b border-slate-900 hover:bg-slate-900" onClick={() => jumpTo(row.start, { analysisId, label: row.transcript || row.lyric || "Transcript row", source: row.source })}>
                    <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(row.start)}</td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(row.end)}</td>
                    <td className="max-w-[360px] truncate px-3 py-2 text-slate-100" title={row.lyric}>{row.lyric}</td>
                    <td className="max-w-[360px] truncate px-3 py-2" title={row.transcript}>{row.transcript}</td>
                    <td className="px-3 py-2 font-mono">{formatValue(row.confidence)}</td>
                    <td className="px-3 py-2 text-slate-500">{row.source}</td>
                    <td className="px-3 py-2">{renderDecisionControls({
                      id: `lyric:${index}:${safeIdPart(row.transcript || row.lyric)}`,
                      label: row.transcript || row.lyric || "Transcript row",
                      text: row.transcript || row.lyric,
                      start: row.start,
                      end: row.end,
                      source: row.source,
                      rowType: "lyrics-transcript",
                    })}</td>
                  </tr>
                )) : (
                  <tr><td className="px-3 py-3 text-slate-500" colSpan={7}>No lyric/transcript matches are available. Online lyric lookup remains disabled unless explicitly activated.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </details>

        <details className="mb-3 border border-slate-800" data-vaa1-audio-section="foley-sampling" data-vaa1-audio-foley-sampling="true">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Foley Sampling And Proliferation Candidates</summary>
          <div className="max-h-[38vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className="sticky top-0 bg-slate-950 uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Candidate</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Review</th>
                  <th className="px-3 py-2">Proliferation Target</th>
                  <th className="px-3 py-2">Next Action</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {foleyRows.length ? foleyRows.map((row, index) => (
                  <tr key={`foley:${index}`} className="cursor-pointer border-b border-slate-900 hover:bg-slate-900" onClick={() => jumpTo(row.start, { analysisId, label: row.label, source: row.source })}>
                    <td className="px-3 py-2 font-semibold text-slate-100">{row.label}</td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(row.start)}</td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(row.end)}</td>
                    <td className="px-3 py-2 font-mono">{formatValue(row.confidence)}</td>
                    <td className="px-3 py-2 text-slate-300">{row.source}</td>
                    <td className="px-3 py-2 text-amber-200">{row.reviewState}</td>
                    <td className="px-3 py-2 text-slate-300">{row.proliferationTarget}</td>
                    <td className="px-3 py-2 text-slate-500">{row.nextAction}</td>
                    <td className="px-3 py-2">{renderDecisionControls({
                      id: `foley:${index}:${safeIdPart(row.label)}`,
                      label: row.label,
                      start: row.start,
                      end: row.end,
                      source: row.source,
                      rowType: "foley-sampling",
                    })}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={9}>
                      No gun shot, laughter, roar, or applause/applauds foley candidates are surfaced yet. Use local sample clouds or reviewed audio intervals before proliferating labels across the data array.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>

        <details className="mb-3 border border-slate-800" data-vaa1-audio-section="recognition-governance">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Audio Recognition Governance</summary>
          <div className="max-h-[38vh] overflow-auto">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className="sticky top-0 bg-slate-950 uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Layer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Rows</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Next Action</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {governanceRows.map((row) => {
                  const target = governanceNavigationTarget(row);
                  return (
                    <tr key={row.layer} className="cursor-pointer border-b border-slate-900 hover:bg-slate-900" onClick={() => jumpTo(target.start, { analysisId, label: target.label, source: target.source })}>
                      <td className="px-3 py-2 font-semibold text-slate-100">{row.layer}</td>
                      <td className={row.status === "missing" ? "px-3 py-2 text-amber-200" : "px-3 py-2 text-cyan-200"}>{row.status}</td>
                      <td className="px-3 py-2 font-mono">{row.rows}</td>
                      <td className="px-3 py-2 text-slate-300">{row.source}</td>
                      <td className="px-3 py-2 text-slate-500">{row.nextAction}</td>
                      <td className="px-3 py-2">{renderDecisionControls(target)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}

export default AudioPanel;
