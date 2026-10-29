"use client";

import { publishSourceTime, subscribeSourceTime } from "@/lib/source-clock-events";

import { formatPreciseSourceTime } from "@/lib/source-clock";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

const GOVERNED_AUDIO_PAGE_SIZE = 25;
const NARRATIVE_AGENT_SEMANTIC_THRESHOLD = 0.65;
import { VideoService, type AnalysisData } from "@/lib/video-service";
import { governedNarrativeAgentLabels, individualNarrativeAgentLabel } from "@/lib/narrative-agent-registry";
import { DynamicPanelSection, DynamicPanelSectionGroup } from "../DynamicPanelSection";
import NarrativeAgentThumbnailProjectionStrip from "../NarrativeAgentThumbnailProjectionStrip";

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
  /** Stable acoustic row identity; unlike id, this does not change family when reassigned. */
  lineupSampleId?: string;
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
  clusterMemberIds?: string[];
  clusterMemberEvidence?: Array<{ id: string; start: number; end: number; speaker: string }>;
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
  boundarySafe: boolean;
  boundaryReason?: string;
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

type AudioClusterSample = {
  id: string;
  speaker: string;
  start: number;
  end: number;
  quality: number;
  vector: number[];
  boundarySafe: boolean;
  boundaryReason?: string;
};

type AudioCluster = {
  id: string;
  label: string;
  members: AudioClusterSample[];
  representative: AudioClusterSample;
  problematic: AudioClusterSample;
  purity: number;
  start: number;
  end: number;
};

type NarrativeAgentAudioMember = AudioClusterSample & {
  matchScore: number;
  voiceSimilarity?: number;
  presenceSupport: number;
  directSeed: boolean;
  support: string[];
};

type NarrativeAgentAudioFamily = {
  id: string;
  label: string;
  registrySources: string[];
  seedMembers: AudioClusterSample[];
  candidates: NarrativeAgentAudioMember[];
  state: "confirmed_voice_seed" | "constellational_candidates" | "awaiting_audio_evidence";
};

type NarrativeAgentAudioExclusion = {
  sample: AudioClusterSample;
  score?: number;
  reason: "below semantic threshold" | "no voice or source-time support";
};

type NarrativeAgentAudioFamilyReview = {
  includedCandidates: NarrativeAgentAudioMember[];
  excludedSamples: NarrativeAgentAudioExclusion[];
  representative?: NarrativeAgentAudioMember;
  uncertain?: NarrativeAgentAudioMember;
  cohesion?: number;
  nearestCompetitor?: { label: string; score: number };
  temporalStart?: number;
  temporalEnd?: number;
  coveredSeconds: number;
  sampleCoverage: number;
};

function cosineDistance(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 1;
  const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0));
  const rightNorm = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
  if (!leftNorm || !rightNorm) return 1;
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  return Math.max(0, Math.min(2, 1 - dot / (leftNorm * rightNorm)));
}

function singleSpeakerBoundary(turn: Record<string, any>, allTurns: Record<string, any>[]) {
  const start = Number(turn.start || 0);
  const end = Number(turn.end ?? start);
  const duration = end - start;
  if (turn.is_stale || turn.valid_for_confirmation === false) {
    return { safe: false, reason: String(turn.stale_reason || "Source timing is not valid for confirmation") };
  }
  if (duration < 0.25) return { safe: false, reason: "Speaker sample is shorter than 250 ms" };
  if (duration > 8) return { safe: false, reason: "Speaker sample exceeds one safe line-sized window (8 s)" };
  const competing = allTurns.find((other) => (
    other !== turn &&
    String(other.speaker_label || "") !== String(turn.speaker_label || "") &&
    overlapSeconds(start, end, Number(other.start || 0), Number(other.end ?? other.start ?? 0)) > 0.12
  ));
  if (competing) return { safe: false, reason: "Another diarized speaker overlaps this sample" };
  return { safe: true };
}

function BoundedAudioSample({ analysisId, start, end, label, onNavigate }: { analysisId: string; start: number; end: number; label: string; onNavigate?: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enforceStart = () => {
    const audio = audioRef.current;
    if (audio && (audio.currentTime < start - 0.05 || audio.currentTime >= end)) audio.currentTime = start;
  };
  return (
    <audio
      ref={audioRef}
      controls
      preload="none"
      className="h-7 w-full min-w-[110px]"
      src={apiService.getDownloadUrl(analysisId, "source_video")}
      aria-label={label}
      title={`Play or pause ${label}`}
      onLoadedMetadata={enforceStart}
      onPlay={() => { enforceStart(); onNavigate?.(); }}
      onTimeUpdate={() => {
        const audio = audioRef.current;
        if (audio && audio.currentTime >= end) {
          audio.pause();
          audio.currentTime = start;
        }
      }}
      data-vaa1-bounded-audio-sample="true"
      data-sample-start={start.toFixed(3)}
      data-sample-end={end.toFixed(3)}
    />
  );
}

function audioClusterExploration(diarization: Record<string, any>, threshold: number) {
  const allTurns = asArray<any>(diarization.speaker_turns);
  const turns = new Map(allTurns.map((turn) => [String(turn.turn_id || ""), turn]));
  const exclusions: Array<{ id: string; reason: string }> = [];
  const samples: AudioClusterSample[] = [];
  asArray<any>(asObject(diarization.embedding_index).items).forEach((item, index) => {
    const id = String(item.embedding_id || item.turn_id || `embedding:${index}`);
    const vector = asArray<number>(item.vector).map(Number).filter(Number.isFinite);
    const turn = turns.get(String(item.turn_id || "")) || {};
    if (!vector.length) {
      exclusions.push({ id, reason: "Missing or invalid acoustic embedding" });
      return;
    }
    if (turn.is_stale) {
      exclusions.push({ id, reason: String(turn.stale_reason || "Stale source timing") });
      return;
    }
    const boundary = singleSpeakerBoundary(turn, allTurns);
    samples.push({
      id,
      speaker: String(turn.speaker_label || item.speaker_label || "Unassigned speaker"),
      start: Number(turn.start || 0),
      end: Number(turn.end ?? turn.start ?? 0),
      quality: Math.max(0, Math.min(1, Number(turn.diarization_confidence ?? 0))),
      vector,
      boundarySafe: boundary.safe,
      boundaryReason: boundary.reason,
    });
  });
  const clusters: AudioCluster[] = [];
  const speakerGroups = new Map<string, AudioClusterSample[]>();
  samples.forEach((sample) => speakerGroups.set(sample.speaker, [...(speakerGroups.get(sample.speaker) || []), sample]));
  [...speakerGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([speaker, speakerSamples]) => {
    const unseen = new Set(speakerSamples.map((_, index) => index));
    let component = 0;
    while (unseen.size) {
      const seed = Math.min(...unseen);
      unseen.delete(seed);
      const queue = [seed];
      const indexes = [seed];
      while (queue.length) {
        const current = queue.pop() as number;
        [...unseen].forEach((candidate) => {
          if (cosineDistance(speakerSamples[current].vector, speakerSamples[candidate].vector) <= threshold) {
            unseen.delete(candidate);
            queue.push(candidate);
            indexes.push(candidate);
          }
        });
      }
      const members = indexes.map((index) => speakerSamples[index]);
    const scored = members.map((member) => {
      const meanDistance = members.length > 1
        ? members.reduce((sum, other) => sum + cosineDistance(member.vector, other.vector), 0) / (members.length - 1)
        : 0;
      return { member, score: (1 - Math.min(1, meanDistance)) * (0.5 + 0.5 * member.quality) };
    }).sort((left, right) => right.score - left.score || left.member.id.localeCompare(right.member.id));
    const meanPairDistance = members.length > 1
      ? members.reduce((sum, member, index) => sum + members.slice(index + 1).reduce((inner, other) => inner + cosineDistance(member.vector, other.vector), 0), 0) / ((members.length * (members.length - 1)) / 2)
      : 0;
      component += 1;
      clusters.push({
        id: `audio-cluster:${safeIdPart(speaker)}:${component}`,
        label: speaker,
        members: members.sort((left, right) => left.start - right.start),
        representative: scored[0].member,
        problematic: scored[scored.length - 1].member,
        purity: Math.max(0, Math.min(1, 1 - meanPairDistance)),
        start: Math.min(...members.map((member) => member.start)),
        end: Math.max(...members.map((member) => member.end)),
      });
    }
  });
  return { samples, clusters, exclusions };
}

type WaveformRow = {
  id: string;
  start?: number;
  end?: number;
  label: string;
  energy?: number;
  pitch?: number;
  source: string;
};

type FocusedAudioEvidence = {
  videoId?: string;
  evidenceId?: string;
  start: number;
  end: number;
  label: string;
  detail?: string;
  source?: string;
  reviewState?: string;
};

function audioEvidenceKey(evidence: Pick<FocusedAudioEvidence, "evidenceId" | "start" | "end" | "label" | "source">): string {
  const evidenceId = String(evidence.evidenceId || "").trim();
  if (evidenceId) return evidenceId;
  return `audio:${Number(evidence.start || 0).toFixed(3)}:${Number(evidence.end || evidence.start || 0).toFixed(3)}:${evidence.source || evidence.label}`;
}

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
  return formatPreciseSourceTime(typeof seconds === "number" ? seconds : 0);
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
  return event.event_label || event.event_type || "speech activity";
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
  const normalizedLabel = individualNarrativeAgentLabel(label);
  if (!normalizedLabel || /^unknown$/i.test(normalizedLabel) || /^\d+$/.test(normalizedLabel)) return;
  const optionId = String(id || `${source}:${safeIdPart(normalizedLabel)}`);
  if (options.some((option) => option.label.toLowerCase() === normalizedLabel.toLowerCase())) return;
  options.push({ id: optionId, label: normalizedLabel, source });
}

function knownNarrativeAgentOptions(analysisData: AnalysisData | null): NarrativeAgentOption[] {
  const options: NarrativeAgentOption[] = [];
  const annotations = analysisData?.metadata?.sourceMediaMetadata?.user_annotations;

  governedNarrativeAgentLabels(analysisData).forEach((label, index) => {
    addNarrativeAgentOption(options, label, "governed_narrative_agent_registry", `governed-agent:${index}`);
  });

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

  asArray<string>(annotations?.persons).forEach((person, index) => {
    addNarrativeAgentOption(options, person, "source_media_metadata.persons", `source-person:${index}`);
  });

  if (asArray<string>(annotations?.persons).length === 0) {
    asArray<string>(annotations?.character_roles).forEach((roleLine, index) => {
      String(roleLine || "").split(/[,;\n]+/).forEach((role, roleIndex) => {
        const character = role.split(/\s+[-–—]\s+|\s+\(/)[0]?.trim();
        addNarrativeAgentOption(options, character || role, "source_media_metadata.character_roles", `character-role:${index}:${roleIndex}`);
      });
    });
  }

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
    if (!confirmedNarrativeAgentAnnotation(annotation)) return;
    if (/^(character present|person|unknown|speaker_\d+)$/i.test(manualAnnotationLabel(annotation))) return;
    addNarrativeAgentOption(
      options,
      manualAnnotationLabel(annotation),
      "manual_confirmed_narrative_agent_anchor",
      annotation.id,
    );
  });

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

function narrativeAgentFamilyKey(label: unknown): string {
  const individualLabel = individualNarrativeAgentLabel(label);
  const aliasLabel = individualLabel.includes("/")
    ? individualLabel.split("/").map((value) => value.trim()).filter(Boolean).at(-1) || individualLabel
    : individualLabel;
  return aliasLabel
    .split(":")[0]
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/^dr\.?\s+/, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function sameNarrativeAgentFamily(left: unknown, right: unknown): boolean {
  const leftKey = narrativeAgentFamilyKey(left);
  const rightKey = narrativeAgentFamilyKey(right);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  if (leftKey.length >= 4 && rightKey.length >= 4) {
    return leftKey.startsWith(rightKey) || rightKey.startsWith(leftKey);
  }
  return false;
}

function confirmedNarrativeAgentAnnotation(annotation: ManualVisualAnnotation): boolean {
  const confirmedFields = asObject(annotation.metadata_correlation?.manual_confirmation_event?.confirmed_fields);
  const label = individualNarrativeAgentLabel(manualAnnotationLabel(annotation));
  if (!label) return false;
  if (confirmedFields.narrative_agent === true && !/^(character present|identity affirmed)$/i.test(label)) return true;
  if (annotation.category === "Audio") return annotation.subcategory === "Narrative Agent" && Boolean(annotation.identity_affirmation);
  return annotation.category === "Identification" && annotation.subcategory === "Character" && Boolean(annotation.identity_affirmation);
}

function narrativeAgentAudioFamilies(
  samples: AudioClusterSample[],
  options: NarrativeAgentOption[],
  analysisData: AnalysisData | null,
): NarrativeAgentAudioFamily[] {
  const annotations = asArray<ManualVisualAnnotation>(analysisData?.annotationCorrections?.manual_visual_annotations)
    .filter(confirmedNarrativeAgentAnnotation);
  const optionGroups = new Map<string, NarrativeAgentOption[]>();
  options.forEach((option) => {
    const key = narrativeAgentFamilyKey(option.label);
    if (!key) return;
    optionGroups.set(key, [...(optionGroups.get(key) || []), option]);
  });

  return [...optionGroups.entries()].map(([key, familyOptions]): NarrativeAgentAudioFamily => {
    const label = [...familyOptions].sort((left, right) => {
      const leftPenalty = /[a-z][A-Z]/.test(left.label) ? 20 : 0;
      const rightPenalty = /[a-z][A-Z]/.test(right.label) ? 20 : 0;
      return (left.label.length + leftPenalty) - (right.label.length + rightPenalty);
    })[0].label;
    const familyAnnotations = annotations.filter((annotation) => sameNarrativeAgentFamily(manualAnnotationLabel(annotation), label));
    const audioSeeds = familyAnnotations.filter((annotation) => annotation.category === "Audio");
    const presenceAnchors = familyAnnotations.filter((annotation) => annotation.category !== "Audio");
    const seedMembers = samples.filter((sample) => audioSeeds.some((annotation) => {
      const start = numericTime(annotation.start_seconds ?? annotation.timestamp_seconds, 0);
      const end = numericTime(annotation.end_seconds ?? annotation.timestamp_seconds, start + 0.001);
      return overlapSeconds(sample.start, sample.end, start, end) > 0;
    }));

    const candidates = samples.map((sample): NarrativeAgentAudioMember | null => {
      const directSeed = seedMembers.some((seed) => seed.id === sample.id);
      const voiceSimilarity = seedMembers.length
        ? Math.max(...seedMembers.map((seed) => Math.max(0, Math.min(1, 1 - cosineDistance(sample.vector, seed.vector)))))
        : undefined;
      const duration = Math.max(0.001, sample.end - sample.start);
      const presenceSupport = Math.max(0, ...presenceAnchors.map((annotation) => {
        const start = numericTime(annotation.start_seconds ?? annotation.timestamp_seconds, 0);
        const end = numericTime(annotation.end_seconds ?? annotation.timestamp_seconds, start + 0.001);
        return Math.min(1, overlapSeconds(sample.start, sample.end, start, end) / duration);
      }));
      if (!directSeed && voiceSimilarity === undefined && presenceSupport <= 0) return null;
      const matchScore = directSeed
        ? 1
        : voiceSimilarity !== undefined
          ? Math.min(0.99, (voiceSimilarity * 0.65) + (presenceSupport * 0.2) + (sample.quality * 0.15))
          : Math.min(0.79, 0.5 + (presenceSupport * 0.29));
      const support = [
        directSeed ? "user-confirmed audio seed" : null,
        voiceSimilarity !== undefined ? `voice similarity ${(voiceSimilarity * 100).toFixed(1)}%` : null,
        presenceSupport > 0 ? `Master Schema presence overlap ${(presenceSupport * 100).toFixed(0)}%` : null,
      ].filter((value): value is string => Boolean(value));
      return { ...sample, matchScore, voiceSimilarity, presenceSupport, directSeed, support };
    }).filter((member): member is NarrativeAgentAudioMember => Boolean(member))
      .sort((left, right) => right.matchScore - left.matchScore || left.start - right.start);

    return {
      id: `narrative-agent-audio-family:${key}`,
      label,
      registrySources: [...new Set(familyOptions.map((option) => option.source))],
      seedMembers,
      candidates,
      state: seedMembers.length
        ? "confirmed_voice_seed"
        : candidates.length
          ? "constellational_candidates"
          : "awaiting_audio_evidence",
    };
  }).sort((left, right) => {
    const stateOrder = { confirmed_voice_seed: 0, constellational_candidates: 1, awaiting_audio_evidence: 2 };
    return stateOrder[left.state] - stateOrder[right.state] || left.label.localeCompare(right.label);
  });
}

function intervalUnionSeconds(members: Array<{ start: number; end: number }>): number {
  const intervals = members
    .map((member) => [member.start, Math.max(member.start, member.end)] as const)
    .sort((left, right) => left[0] - right[0]);
  if (!intervals.length) return 0;
  let total = 0;
  let [activeStart, activeEnd] = intervals[0];
  intervals.slice(1).forEach(([start, end]) => {
    if (start <= activeEnd) {
      activeEnd = Math.max(activeEnd, end);
      return;
    }
    total += activeEnd - activeStart;
    activeStart = start;
    activeEnd = end;
  });
  return total + activeEnd - activeStart;
}

function narrativeAgentAudioFamilyReview(
  family: NarrativeAgentAudioFamily,
  families: NarrativeAgentAudioFamily[],
  allSamples: AudioClusterSample[],
  threshold: number,
): NarrativeAgentAudioFamilyReview {
  const includedCandidates = family.candidates.filter((member) => member.directSeed || member.matchScore >= threshold);
  const candidateIds = new Set(family.candidates.map((member) => member.id));
  const excludedSamples: NarrativeAgentAudioExclusion[] = [
    ...family.candidates
      .filter((member) => !member.directSeed && member.matchScore < threshold)
      .map((member) => ({ sample: member, score: member.matchScore, reason: "below semantic threshold" as const })),
    ...allSamples
      .filter((sample) => !candidateIds.has(sample.id))
      .map((sample) => ({ sample, reason: "no voice or source-time support" as const })),
  ].sort((left, right) => left.sample.start - right.sample.start);
  const representative = includedCandidates[0];
  const uncertain = includedCandidates
    .filter((member) => !member.directSeed)
    .sort((left, right) => Math.abs(left.matchScore - threshold) - Math.abs(right.matchScore - threshold))[0];
  const cohesion = includedCandidates.length
    ? includedCandidates.reduce((sum, member) => {
        const peers = includedCandidates.filter((peer) => peer.id !== member.id);
        const similarity = peers.length
          ? peers.reduce((peerSum, peer) => peerSum + Math.max(0, 1 - cosineDistance(member.vector, peer.vector)), 0) / peers.length
          : member.quality;
        return sum + similarity;
      }, 0) / includedCandidates.length
    : undefined;
  const nearestCompetitor = representative
    ? families
        .filter((candidateFamily) => candidateFamily.id !== family.id)
        .flatMap((candidateFamily) => candidateFamily.candidates
          .filter((member) => member.id === representative.id)
          .map((member) => ({ label: candidateFamily.label, score: member.matchScore })))
        .sort((left, right) => right.score - left.score)[0]
    : undefined;
  return {
    includedCandidates,
    excludedSamples,
    representative,
    uncertain,
    cohesion,
    nearestCompetitor,
    temporalStart: includedCandidates.length ? Math.min(...includedCandidates.map((member) => member.start)) : undefined,
    temporalEnd: includedCandidates.length ? Math.max(...includedCandidates.map((member) => member.end)) : undefined,
    coveredSeconds: intervalUnionSeconds(includedCandidates),
    sampleCoverage: allSamples.length ? includedCandidates.length / allSamples.length : 0,
  };
}

const FOLEY_PATTERNS: Array<{ label: string; pattern: RegExp; target: string }> = [
  { label: "gun shot / impact", pattern: /gun|shot|gunshot|bang|blast|explosion|impact|weapon/i, target: "Audio sample cloud -> repeated point foley candidates" },
  { label: "car / engine", pattern: /car|engine|motor|vehicle|rev(?:ving)?|accelerat/i, target: "Audio sample cloud -> vehicle and engine sound candidates" },
  { label: "door", pattern: /door|slam|creak|latch/i, target: "Audio sample cloud -> door and closure sound candidates" },
  { label: "footsteps", pattern: /footstep|footsteps|steps|walking|running/i, target: "Audio sample cloud -> movement sound candidates" },
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

function transcriptTextForInterval(
  rows: TranscriptAudioRow[],
  start: number,
  end: number,
): string {
  return rows
    .filter((row) => overlapSeconds(start, end, Number(row.start || 0), Number(row.end ?? row.start ?? 0)) > 0)
    .sort((left, right) => Number(left.start || 0) - Number(right.start || 0))
    .map((row) => normalizeSpeechText(row.text))
    .filter(Boolean)
    .join(" ");
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
  const governedNonSpeechEvents = rawEvents.filter(
    (event) => categoryFor(event) !== "speech",
  );
  let searchStart = 0;

  const alignedSpeechEvents = matureRows.map((row, index) => {
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
        matchedEvent?.speaker_label ? "technical speech segmentation only" : null,
      ),
    };
  });
  return [...governedNonSpeechEvents, ...alignedSpeechEvents].sort(
    (left, right) => eventStart(left) - eventStart(right),
  );
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
  const speechTurns = asArray<any>(diarizationFromStatus(status).speaker_turns);
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
    const boundedStart = typeof start === "number" ? start : undefined;
    const boundedEnd = typeof end === "number" ? end : undefined;
    const duration = boundedStart !== undefined && boundedEnd !== undefined ? boundedEnd - boundedStart : 0;
    const overlapsSpeech = boundedStart !== undefined && boundedEnd !== undefined && speechTurns.some((turn) => (
      overlapSeconds(boundedStart, boundedEnd, Number(turn.start || 0), Number(turn.end ?? turn.start ?? 0)) > 0.12
    ));
    const boundarySafe = duration >= 0.08 && duration <= 3 && !overlapsSpeech;
    const boundaryReason = duration <= 0
      ? "Foley sample has no valid source interval"
      : duration < 0.08
        ? "Foley sample is shorter than 80 ms"
        : duration > 3
          ? "Foley sample exceeds one isolated sound-bite window (3 s)"
          : overlapsSpeech
            ? "Speech overlaps this Foley interval"
            : undefined;
    candidates.push({
      label: match.label,
      start: typeof start === "number" ? start : undefined,
      end: typeof end === "number" ? end : undefined,
      source,
      confidence: typeof confidence === "number" ? confidence : undefined,
      reviewState: "candidate_review_required",
      proliferationTarget: match.target,
      nextAction: "Audition sample, confirm label, then proliferate only as reviewed local evidence.",
      boundarySafe,
      boundaryReason,
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
    boundarySafe: false,
    boundaryReason: "Generic sample-cloud windows require an isolated Foley boundary before confirmation",
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

function jumpTo(
  time: unknown,
  context?: {
    analysisId?: string;
    evidenceId?: string;
    label?: string;
    source?: string;
    end?: number;
    detail?: string;
    reviewState?: string;
  },
) {
  if (typeof time === "number" && Number.isFinite(time)) {
    const safeTime = Math.max(0, time);
    if (context?.analysisId) {
      eventBus.emit("openPanelRequest", {
        panelType: "VideoPanel",
        panelProps: { videoId: context.analysisId },
      });
      eventBus.emit("videoIdChanged", context.analysisId);
    }
    publishSourceTime(context?.analysisId, safeTime);
    eventBus.emit("audioEvidenceFocus", {
      videoId: context?.analysisId,
      evidenceId: context?.evidenceId,
      start: safeTime,
      end:
        typeof context?.end === "number" && Number.isFinite(context.end)
          ? Math.max(safeTime, context.end)
          : safeTime,
      label: context?.label || "Audio evidence",
      detail: context?.detail,
      source: context?.source,
      reviewState: context?.reviewState || "candidate_review_required",
    });
    eventBus.emit("videoEvidenceSelected", {
      videoId: context?.analysisId,
      panelType: "AudioPanel",
      modality: "audio",
      timestamp: safeTime,
      label: context?.label || "Audio evidence",
      sourceItem: {
        evidenceId: context?.evidenceId,
        source: context?.source,
        start: safeTime,
        end: context?.end,
        detail: context?.detail,
        reviewState: context?.reviewState,
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
  const clusterMembershipDecision = target.rowType === "audio-cluster" || target.rowType === "audio-cluster-member";
  const clusterIdentityDecision = target.rowType.startsWith("audio-cluster-identity");
  const annotationId = `audio-workbench:${analysisId}:${target.rowType}:${safeIdPart(target.id)}`;
  const confirmed = decision === "confirmed" || decision === "agent" || decision === "sample";
  return {
    id: annotationId,
    category: "Audio",
    subcategory:
      clusterMembershipDecision
        ? decision === "dropped" ? "Dropped audio cluster membership" : "Audio cluster membership confirmation"
      : decision === "sample"
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
    identity_affirmation: decision === "dropped" || clusterMembershipDecision ? undefined : appliedLabel,
    audio_foley_note: target.rowType.includes("foley") || decision === "sample" ? target.label : undefined,
    open_note: [
      target.text ? `Transcript: ${target.text}` : null,
      target.speakerLabel ? `Speaker label: ${target.speakerLabel}` : null,
      visualAnchor ? `Visual anchor: ${visualAnchor.label}` : null,
      decision === "dropped" ? "Analyst dropped this audio candidate." : null,
    ].filter(Boolean).join(" / "),
    metadata_correlation: {
      target_type: clusterMembershipDecision || clusterIdentityDecision ? "audio_evidence_cluster" : "audio_evidence_row",
      target_id: target.id,
      target_label: appliedLabel,
      apply_scope: clusterMembershipDecision || clusterIdentityDecision || decision === "sample" ? "linked_candidates" : "this_interval_only",
      authority_state:
        decision === "dropped"
          ? "analyst_rejected"
          : clusterMembershipDecision
            ? "analyst_confirmed_audio_cluster_membership"
          : clusterIdentityDecision
            ? "analyst_confirmed_narrative_agent_audio_cluster_identity"
          : visualAnchor
            ? "analyst_confirmed_narrative_agent_via_audio_visual_anchor"
            : "analyst_confirmed_narrative_agent_audio_anchor",
      maturity_state: confirmed ? "mature_manual_anchor" : "dropped",
      relation: visualAnchor ? "supports" : "unknown",
      source_range_source: "mature_transcript_timeline",
      maturity_policy: clusterMembershipDecision
        ? "Analyst confirmation makes cluster membership mature; a diarization cluster label is not a Narrative Agent identity."
        : "Most mature data wins: analyst-confirmed audio-visual narrative-agent anchors outrank raw diarization labels.",
      note: target.source,
      cluster_member_ids: target.clusterMemberIds,
      manual_confirmation_event: {
        event_type: "audio_workbench_confirmation",
        event_id: annotationId,
        analysis_id: analysisId,
        authority_level: "manual_confirmation",
        confirmed_fields: {
          source_time: true,
          transcript_text: Boolean(target.text),
          narrative_agent: decision !== "dropped" && !clusterMembershipDecision,
          audio_cluster_membership: decision !== "dropped" && clusterMembershipDecision,
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
          narrative_agent_label: clusterMembershipDecision ? undefined : appliedLabel,
          speaker_cluster_label: clusterMembershipDecision ? appliedLabel : undefined,
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
  const clusterDecision = target.rowType === "audio-cluster";
  const clusterIdentityDecision = target.rowType === "audio-cluster-identity";
  const clusterMembershipDecision = clusterDecision || target.rowType === "audio-cluster-member";
  return {
    decision_id: `audio:${decision}:${analysisId}:${target.rowType}:${safeIdPart(target.id)}`,
    candidate_id: target.id,
    decision_scope: clusterDecision || clusterIdentityDecision || sample ? "cluster" : "candidate",
    cluster_key: clusterMembershipDecision || clusterIdentityDecision ? (target.speakerLabel || target.id) : undefined,
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
    evidence_refs: target.clusterMemberEvidence?.length
      ? target.clusterMemberEvidence.map((member) => ({ id: member.id, panel: "AudioPanel", time: { start: member.start, end: member.end }, speaker_label: member.speaker }))
      : [{ id: target.id, panel: "AudioPanel", time: range, narrative_agent_label: appliedLabel, text: target.text }],
    source_traceback_refs: target.clusterMemberIds?.length
      ? target.clusterMemberIds.map((id) => `traceback:audio:${id}`)
      : [`traceback:audio:${target.id}`],
    projection_targets: confirmed || sample
      ? ["MasterSchema", "MeaningNetwork", "TracebackDrawer", "VideoPanel", "StatsKit"]
      : [],
    proliferates_to: confirmed || sample
      ? ["master_schema", "meaning_network", "traceback", "source_timed_panels", "statskit"]
      : [],
    proliferation_allowed: confirmed || sample,
    decision_reason:
      clusterIdentityDecision && confirmed
        ? `Analyst confirmed ${appliedLabel} as the Narrative Agent for every listed source-timed member of this audio cluster.`
      : clusterMembershipDecision && confirmed
        ? "Analyst confirmed that the listed source-timed samples form one governed audio cluster. Narrative Agent confirmation remains a separate decision."
      : confirmed
        ? "Analyst confirmed narrative-agent audio evidence with mature transcript timing and optional audio-visual anchor."
        : sample
          ? "Analyst staged this source-timed audio row as a governed sample for local proliferation."
          : "Analyst dropped this audio evidence row from mature-data promotion.",
    created_at: now,
    created_by: "analyst",
  };
}

function AudioPanel({ analysis, analysisId: explicitAnalysisId, videoId }: AudioPanelProps) {
  const propAnalysisId = analysis?.analysis_id || analysis?.id || explicitAnalysisId || videoId || "";
  const [analysisId, setAnalysisId] = useState(
    () => propAnalysisId || eventBus.getLast<string>("videoIdChanged") || "",
  );
  const [status, setStatus] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(analysisId));
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingDecisionId, setSavingDecisionId] = useState<string | null>(null);
  const [newNarrativeAgentByTarget, setNewNarrativeAgentByTarget] = useState<Record<string, string>>({});
  const [governedEventPage, setGovernedEventPage] = useState(0);
  const [narrativeAgentThreshold, setNarrativeAgentThreshold] = useState(NARRATIVE_AGENT_SEMANTIC_THRESHOLD);
  const [audioFamilyAssignments, setAudioFamilyAssignments] = useState<Record<string, string>>({});
  const [optimisticAudioDecisions, setOptimisticAudioDecisions] = useState<Record<string, "confirmed" | "dropped">>({});
  const [optimisticAudioLabels, setOptimisticAudioLabels] = useState<Record<string, string>>({});
  const [audioBoundaryEdits, setAudioBoundaryEdits] = useState<Record<string, { start: number; end: number }>>({});
  const [selectedAudioFamilyId, setSelectedAudioFamilyId] = useState("");
  const [selectedAudioEvidence, setSelectedAudioEvidence] = useState<FocusedAudioEvidence | null>(null);
  const [sourceClockTime, setSourceClockTime] = useState(0);
  const audioDecisionQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (propAnalysisId) setAnalysisId(propAnalysisId);
  }, [propAnalysisId]);

  useEffect(() => {
    const handler = (nextAnalysisId: string) => setAnalysisId(nextAnalysisId || "");
    eventBus.on("videoIdChanged", handler);
    return () => eventBus.off("videoIdChanged", handler);
  }, []);

  useEffect(() => {
    if (!analysisId) return;
    return subscribeSourceTime(analysisId, (time) => setSourceClockTime(time));
  }, [analysisId]);

  useEffect(() => {
    const handler = (payload?: FocusedAudioEvidence) => {
      if (!payload || !Number.isFinite(payload.start)) return;
      if (payload.videoId && payload.videoId !== analysisId) return;
      setSelectedAudioEvidence({
        ...payload,
        end: Number.isFinite(payload.end) ? Math.max(payload.start, payload.end) : payload.start,
      });
    };
    setSelectedAudioEvidence(null);
    eventBus.on("audioEvidenceFocus", handler);
    const retainedFocus = eventBus.getLast<FocusedAudioEvidence>("audioEvidenceFocus");
    if (retainedFocus?.videoId === analysisId) handler(retainedFocus);
    return () => eventBus.off("audioEvidenceFocus", handler);
  }, [analysisId]);

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
  const governedSoundIntervals = useMemo(
    () =>
      [
        ...categorizedEvents.music,
        ...categorizedEvents.noise,
        ...categorizedEvents.silence,
        ...categorizedEvents.other,
      ].sort((left, right) => Number(left.start || 0) - Number(right.start || 0)),
    [categorizedEvents],
  );
  const diarization = useMemo(() => diarizationFromStatus(status), [status]);
  // Diarization labels are an internal segmentation input. They are deliberately
  // not exposed as analyst-facing categories or confirmation targets.
  const clusterExploration = useMemo(() => audioClusterExploration(diarization, 0.25), [diarization]);
  const narrativeAgentFamilies = useMemo(
    () => narrativeAgentAudioFamilies(clusterExploration.samples, narrativeAgentOptions, analysisData),
    [clusterExploration.samples, narrativeAgentOptions, analysisData],
  );
  const narrativeAgentFamilyReviews = useMemo(
    () => new Map(narrativeAgentFamilies.map((family) => [
      family.id,
      narrativeAgentAudioFamilyReview(family, narrativeAgentFamilies, clusterExploration.samples, narrativeAgentThreshold),
    ])),
    [narrativeAgentFamilies, clusterExploration.samples, narrativeAgentThreshold],
  );
  const audioLineupMembers = useMemo(() => {
    const best = new Map<string, { familyId: string; member: NarrativeAgentAudioMember }>();
    narrativeAgentFamilies.forEach((family) => {
      const review = narrativeAgentFamilyReviews.get(family.id);
      (review?.includedCandidates || []).forEach((member) => {
        const existing = best.get(member.id);
        const wins = !existing || member.directSeed || (!existing.member.directSeed && member.matchScore > existing.member.matchScore);
        if (wins) best.set(member.id, { familyId: family.id, member });
      });
    });
    const grouped = new Map<string, NarrativeAgentAudioMember[]>();
    narrativeAgentFamilies.forEach((family) => grouped.set(family.id, []));
    best.forEach(({ familyId, member }, sampleId) => {
      // A mature user seed is authoritative and cannot be dragged into a
      // competing family. Candidate reassignment remains provisional until
      // the analyst confirms it.
      const targetFamilyId = member.directSeed ? familyId : (audioFamilyAssignments[sampleId] || familyId);
      grouped.set(targetFamilyId, [...(grouped.get(targetFamilyId) || []), member]);
    });
    grouped.forEach((members) => members.sort((left, right) => left.start - right.start));
    return grouped;
  }, [audioFamilyAssignments, narrativeAgentFamilies, narrativeAgentFamilyReviews]);
  const baselineNarrativeAgentCandidateCount = useMemo(
    () => narrativeAgentFamilies.reduce(
      (total, family) => total + narrativeAgentAudioFamilyReview(
        family,
        narrativeAgentFamilies,
        clusterExploration.samples,
        NARRATIVE_AGENT_SEMANTIC_THRESHOLD,
      ).includedCandidates.length,
      0,
    ),
    [narrativeAgentFamilies, clusterExploration.samples],
  );
  const previewNarrativeAgentCandidateCount = [...narrativeAgentFamilyReviews.values()]
    .reduce((total, review) => total + review.includedCandidates.length, 0);
  const governedEventPageCount = Math.max(
    1,
    Math.ceil(governedSoundIntervals.length / GOVERNED_AUDIO_PAGE_SIZE),
  );
  const pagedGovernedSoundIntervals = governedSoundIntervals.slice(
    governedEventPage * GOVERNED_AUDIO_PAGE_SIZE,
    (governedEventPage + 1) * GOVERNED_AUDIO_PAGE_SIZE,
  );

  useEffect(() => {
    setGovernedEventPage(0);
    setNarrativeAgentThreshold(NARRATIVE_AGENT_SEMANTIC_THRESHOLD);
    setOptimisticAudioDecisions({});
    setOptimisticAudioLabels({});
    setAudioBoundaryEdits({});
    setSelectedAudioFamilyId("");
  }, [analysisId]);

  useEffect(() => {
    if (!narrativeAgentFamilies.length) return;
    if (!narrativeAgentFamilies.some((family) => family.id === selectedAudioFamilyId)) {
      setSelectedAudioFamilyId(narrativeAgentFamilies[0].id);
    }
  }, [narrativeAgentFamilies, selectedAudioFamilyId]);

  useEffect(() => {
    const persisted: Record<string, { start: number; end: number }> = {};
    const samples = clusterExploration.samples;
    asArray<ManualVisualAnnotation>(analysisData?.annotationCorrections?.manual_visual_annotations)
      .filter((annotation) => annotation.category === "Audio" && confirmedNarrativeAgentAnnotation(annotation))
      .forEach((annotation) => {
        const targetId = String(annotation.metadata_correlation?.target_id || "");
        const sample = samples.find((candidate) => targetId.endsWith(`:${candidate.id}`));
        const start = Number(annotation.start_seconds ?? annotation.timestamp_seconds);
        const end = Number(annotation.end_seconds ?? annotation.timestamp_seconds);
        if (sample && Number.isFinite(start) && Number.isFinite(end) && end > start) {
          persisted[sample.id] = { start, end };
        }
      });
    if (Object.keys(persisted).length) {
      setAudioBoundaryEdits((current) => ({ ...current, ...persisted }));
    }
  }, [analysisData?.annotationCorrections?.manual_visual_annotations, clusterExploration.samples]);

  if (!analysisId) return <div data-vaa1-panel-state="analysis-binding-unavailable" className="h-full bg-[#080808] p-4 text-sm text-amber-200">Analysis binding unavailable</div>;
  if (isLoading) return <div data-vaa1-panel-state="loading" className="h-full bg-[#080808] p-4 text-sm text-slate-400">Loading audio workbench...</div>;
  if (error) return <div data-vaa1-panel-state="failed" className="h-full bg-[#080808] p-4 text-sm text-amber-200">Audio retrieval failed: {error}</div>;

  const correctionDecisions = analysisData?.annotationCorrections?.proliferation_decisions || [];
  const latestDecisionFor = (target: AudioDecisionTarget) => (
    [...correctionDecisions].reverse().find((decision) => {
      if (decision.candidate_id === target.id) return true;
      const anchor = decision.source_anchors?.[0] as Record<string, any> | undefined;
      const range = anchor?.source_time as { start?: number; end?: number } | undefined;
      return decision.source_panel === "AudioPanel" &&
        String(decision.applied_label || "").toLowerCase() === String(target.label || "").toLowerCase() &&
        typeof range?.start === "number" && typeof range?.end === "number" &&
        Math.abs(range.start - Number(target.start)) < 0.01 && Math.abs(range.end - Number(target.end)) < 0.01;
    })
  );
  const decisionStatusFor = (target: AudioDecisionTarget): string => {
    if (optimisticAudioDecisions[target.id]) return optimisticAudioDecisions[target.id];
    const matched = latestDecisionFor(target);
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
    const visualAnchor = target.rowType.startsWith("audio-narrative-agent-family")
      ? null
      : visualAnchorForTarget(target, analysisData);
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
    const range = decisionTimeRange(target);
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
      if (decision === "agent" && target.rowType === "audio-narrative-agent-family-candidate") {
        const annotation = buildAudioManualAnnotation(analysisId, target, decision, appliedLabel, visualAnchor, now);
        const proliferationDecision = buildAudioProliferationDecision(analysisId, target, decision, appliedLabel, visualAnchor, now);
        const projectId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("activeProject") : null;
        const query = new URLSearchParams({ context_analysis_id: analysisId });
        if (projectId) query.set("project_id", projectId);
        const response = await fetch(`/api/local-analysis/${encodeURIComponent(analysisId)}/download/annotation_corrections?${query}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "upsert_audio_narrative_agent", annotation, decision: proliferationDecision }),
        });
        const receipt = await response.json();
        if (!response.ok) throw new Error(receipt?.detail || `audio save failed (${response.status})`);
        const committed = receipt?.annotation;
        const committedDecision = receipt?.decision;
        if (
          committed?.id !== annotation.id ||
          String(committed?.identity_affirmation || "").trim() !== appliedLabel ||
          Math.abs(Number(committed?.start_seconds) - range.start) >= 0.001 ||
          Math.abs(Number(committed?.end_seconds) - range.end) >= 0.001 ||
          committedDecision?.candidate_id !== proliferationDecision.candidate_id
        ) throw new Error("canonical save receipt did not contain the exact label and edited interval");
        setAnalysisData((current) => {
          if (!current) return current;
          let corrections = upsertManualVisualAnnotation(current.annotationCorrections || {}, committed);
          corrections = upsertMasterSchemaPresenceIntervalForManualAnnotation(corrections, committed, { now, sourcePanel: "AudioPanel" });
          corrections.proliferation_decisions = [
            ...(corrections.proliferation_decisions || []).filter((item) => item.candidate_id !== committedDecision.candidate_id),
            committedDecision,
          ];
          corrections.correction_generation = receipt.correction_generation;
          return { ...current, annotationCorrections: corrections };
        });
        const destinationFamily = narrativeAgentFamilies.find((family) => sameNarrativeAgentFamily(family.label, appliedLabel));
        if (destinationFamily && target.lineupSampleId) {
          setAudioFamilyAssignments((current) => ({ ...current, [target.lineupSampleId as string]: destinationFamily.id }));
          setSelectedAudioFamilyId(destinationFamily.id);
        }
        setOptimisticAudioDecisions((current) => ({ ...current, [target.id]: "confirmed" }));
        setSaveMessage(`Saved · ${appliedLabel}`);
        setNewNarrativeAgentByTarget((current) => ({ ...current, [target.id]: "" }));
        void apiService.refreshAnnotationDependentSurfaces(analysisId).catch(() => undefined);
        return;
      }
      // Each queued table edit rebases on the latest canonical generation.
      // Rapid clicks therefore serialize without erasing or conflicting with
      // the preceding row's write.
      const existing: AnnotationCorrections = await apiService.getAnnotationCorrections(analysisId);
      const clusterIdentityMembers = target.rowType === "audio-cluster-identity" ? target.clusterMemberEvidence || [] : [];
      const annotationTargets: AudioDecisionTarget[] = clusterIdentityMembers.length
        ? clusterIdentityMembers.map((member) => ({
            id: `${target.id}:member:${member.id}`,
            label: appliedLabel,
            start: member.start,
            end: member.end,
            source: target.source,
            rowType: "audio-cluster-identity-member",
            speakerLabel: member.speaker,
            validForConfirmation: true,
          }))
        : [target];
      const manualAnnotations = annotationTargets.map((annotationTarget) => buildAudioManualAnnotation(
        analysisId,
        annotationTarget,
        decision,
        appliedLabel,
        visualAnchor,
        now,
      ));
      const proliferationDecision = buildAudioProliferationDecision(
        analysisId,
        target,
        decision,
        appliedLabel,
        visualAnchor,
        now,
      );
      const withAnnotation = manualAnnotations.reduce(
        (corrections, manualAnnotation) => upsertManualVisualAnnotation(corrections, manualAnnotation),
        existing,
      );
      const isClusterMembershipDecision = target.rowType === "audio-cluster" || target.rowType === "audio-cluster-member";
      const withPresence = decision === "dropped" || isClusterMembershipDecision
        ? withAnnotation
        : manualAnnotations.reduce(
            (corrections, manualAnnotation) => upsertMasterSchemaPresenceIntervalForManualAnnotation(corrections, manualAnnotation, {
              now,
              sourcePanel: "AudioPanel",
            }),
            withAnnotation,
          );
      const nextCorrections: AnnotationCorrections = {
        ...withPresence,
        analysis_id: analysisId,
        version: 1,
        updated_at: now,
        updated_by: "analyst",
        proliferation_decisions: [
          ...(withPresence.proliferation_decisions || []).filter((item) => item.candidate_id !== proliferationDecision.candidate_id),
          proliferationDecision,
        ],
      };
      await VideoService.saveAnnotationCorrections(analysisId, nextCorrections);
      const savedCorrections = await apiService.getAnnotationCorrections(analysisId);
      const savedAnnotations = asArray<ManualVisualAnnotation>(savedCorrections.manual_visual_annotations);
      const missingAnnotation = manualAnnotations.find((expected) => !savedAnnotations.some((saved) => (
        saved.id === expected.id &&
        String(saved.identity_affirmation || saved.custom_label || saved.label || "").trim() === appliedLabel &&
        Math.abs(Number(saved.start_seconds ?? saved.timestamp_seconds) - Number(expected.start_seconds ?? expected.timestamp_seconds)) < 0.001 &&
        Math.abs(Number(saved.end_seconds ?? saved.timestamp_seconds) - Number(expected.end_seconds ?? expected.timestamp_seconds)) < 0.001
      )));
      const savedDecision = asArray<any>(savedCorrections.proliferation_decisions)
        .find((item) => item.candidate_id === proliferationDecision.candidate_id && item.decision === proliferationDecision.decision);
      if (missingAnnotation || !savedDecision) {
        throw new Error("canonical read-back did not contain the exact label and edited interval");
      }
      setAnalysisData((current) => current ? { ...current, annotationCorrections: savedCorrections } : current);
      const destinationFamily = decision === "agent"
        ? narrativeAgentFamilies.find((family) => sameNarrativeAgentFamily(family.label, appliedLabel))
        : undefined;
      if (destinationFamily && target.lineupSampleId) {
        setAudioFamilyAssignments((current) => ({
          ...current,
          [target.lineupSampleId as string]: destinationFamily.id,
        }));
        setSelectedAudioFamilyId(destinationFamily.id);
      }
      setOptimisticAudioDecisions((current) => ({
        ...current,
        [target.id]: decision === "dropped" ? "dropped" : "confirmed",
        ...(destinationFamily && target.lineupSampleId
          ? { [`${destinationFamily.id}:${target.lineupSampleId}`]: "confirmed" as const }
          : {}),
      }));
      // The verified correction bundle above is sufficient to rebuild this
      // workbench. A full analysis refresh is intentionally not awaited here:
      // projection consumers refresh independently after the save receipt.
      setSaveMessage(
        decision === "dropped"
          ? "Audio evidence dropped."
          : isClusterMembershipDecision
            ? "Audio cluster membership confirmed."
          : decision === "sample"
            ? "Audio sample staged for governed proliferation."
            : visualAnchor
              ? `Narrative agent confirmed via audio-visual anchor: ${visualAnchor.label}.`
              : "Narrative-agent audio evidence confirmed.",
      );
      if (decision === "agent") {
        setNewNarrativeAgentByTarget((current) => ({ ...current, [target.id]: "" }));
      }
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : "audio decision save failed.";
      setSaveMessage(`Not saved — ${detail}`);
    } finally {
      setSavingDecisionId(null);
    }
  };

  const queueAudioDecision = (
    target: AudioDecisionTarget,
    decision: AudioWorkbenchDecision,
    explicitLabel?: string,
  ) => {
    const appliedLabel = String(explicitLabel || target.label || "Narrative agent").trim();
    setSaveMessage(`Saving · ${appliedLabel}`);
    audioDecisionQueue.current = audioDecisionQueue.current
      .catch(() => undefined)
      .then(() => persistAudioDecision(target, decision, explicitLabel));
  };

  const narrativeAgentFamilyMemberTarget = (
    family: NarrativeAgentAudioFamily,
    member: NarrativeAgentAudioMember,
  ): AudioDecisionTarget => ({
    id: `${family.id}:${member.id}`,
    lineupSampleId: member.id,
    label: family.label,
    start: member.start,
    end: member.end,
    text: transcriptTextForInterval(transcriptRows, member.start, member.end) || member.support.join(" · "),
    source: "MasterSchema Narrative Agent family + audio_diarization.embedding_index",
    rowType: "audio-narrative-agent-family-candidate",
    speakerLabel: member.speaker,
    validForConfirmation: member.boundarySafe,
    staleReason: member.boundaryReason,
  });

  const renderDecisionControls = (target: AudioDecisionTarget) => {
    const visualAnchor = visualAnchorForTarget(target, analysisData);
    const status = decisionStatusFor(target);
    const rowSaveKey = `:${analysisId}:${target.rowType}:${safeIdPart(target.id)}`;
    const rowIsSaving = Boolean(savingDecisionId?.includes(rowSaveKey));
    const invalidTiming = !targetHasValidSourceTiming(target);
    const isSpeechOrVad = target.rowType.startsWith("speech");
    const newNarrativeAgent = newNarrativeAgentByTarget[target.id] || "";
    const buttonClass = "rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-cyan-400 hover:text-cyan-100";
    return (
      <div
        className="flex min-w-[220px] flex-wrap items-center gap-1"
        data-vaa1-audio-row-actions="true"
        data-vaa1-audio-narrative-agent-confirmation="true"
      >
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
        {isSpeechOrVad ? (
          <div className="flex items-center gap-1" data-vaa1-vad-new-narrative-agent="true">
            <input
              value={newNarrativeAgent}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const value = event.target.value;
                setNewNarrativeAgentByTarget((current) => ({ ...current, [target.id]: value }));
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter" && newNarrativeAgent.trim()) {
                  event.preventDefault();
                  void persistAudioDecision(target, "agent", newNarrativeAgent.trim());
                }
              }}
              placeholder="New Narrative Agent"
              aria-label="First-time Narrative Agent for VAD detection"
              disabled={rowIsSaving || invalidTiming}
              className="w-[150px] rounded border border-cyan-700/50 bg-slate-950 px-2 py-1 text-[10px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400"
            />
            <button
              type="button"
              className={buttonClass}
              disabled={rowIsSaving || invalidTiming || !newNarrativeAgent.trim()}
              title="Confirm first-time Narrative Agent for this source-timed VAD or speech interval"
              onClick={(event) => {
                event.stopPropagation();
                void persistAudioDecision(target, "agent", newNarrativeAgent.trim());
              }}
            >
              Add agent
            </button>
          </div>
        ) : null}
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

  const audioEvidenceRowProps = (evidence: FocusedAudioEvidence) => {
    const selected = Boolean(
      selectedAudioEvidence && audioEvidenceKey(selectedAudioEvidence) === audioEvidenceKey(evidence),
    );
    const onBeat = sourceClockTime >= evidence.start && sourceClockTime <= evidence.end;
    return {
      "data-vaa1-audio-evidence-row": "true",
      "data-vaa1-audio-selected-row": selected ? "true" : undefined,
      "data-source-clock-nearest": onBeat ? "true" : undefined,
      className: `cursor-pointer border-b border-slate-900 hover:bg-slate-900 ${selected ? "bg-fuchsia-950/20 ring-1 ring-inset ring-fuchsia-300/60" : onBeat ? "bg-cyan-950/20" : ""}`,
    };
  };

  const renderAudioEventRows = (events: AudioEvent[]) => events.length ? events.map((event, index) => {
    const evidence: FocusedAudioEvidence = {
      videoId: analysisId,
      evidenceId: event.segment_id || event.interval_id || event.event_id || `audio:${index}`,
      start: Number(event.start || 0),
      end: Number(event.end || event.start || 0),
      label: eventLabel(event),
      source: event.source_layer,
      detail: event.text,
      reviewState: event.is_stale ? "stale_rebuild_required" : "candidate_review_required",
    };
    return (
    <tr key={evidence.evidenceId} {...audioEvidenceRowProps(evidence)} onClick={() => jumpTo(event.start, { analysisId, evidenceId: evidence.evidenceId, label: evidence.label, source: evidence.source, end: evidence.end, detail: evidence.detail, reviewState: evidence.reviewState })}>
      <td className="px-3 py-2 font-semibold text-slate-100">{eventLabel(event)}</td>
      <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(event.start)}</td>
      <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(event.end)}</td>
      <td className="px-3 py-2 font-mono text-slate-300">{formatValue(eventDuration(event))}s</td>
      <td className="px-3 py-2 font-mono text-slate-300">{formatValue(event.confidence)}</td>
      <td className="px-3 py-2 font-mono text-slate-300">{formatValue(event.measurements?.energy_dbfs)}</td>
      <td className="px-3 py-2 font-mono text-slate-300">{formatValue(event.measurements?.pitch_hz)}</td>
      <td className="max-w-[360px] truncate px-3 py-2 text-slate-400" title={event.text || ""}>{event.text || ""}</td>
      <td className="max-w-[300px] truncate px-3 py-2 text-slate-500" title={event.source_layer || ""}>{event.source_layer || event.classifier_labels?.join(", ") || ""}</td>
      <td className="px-3 py-2 text-slate-500">Measured speech activity · no confirmation required</td>
    </tr>
    );
  }) : (
    <tr><td className="px-3 py-3 text-slate-500" colSpan={10}>No rows available for this layer.</td></tr>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080808] p-4 text-white" data-vaa1-panel="audio-workbench" data-vaa1-panel-state="ready">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-100">Audio Workbench</h2>
        <span className="text-[10px] text-slate-500">{narrativeAgentFamilies.length} character families · {clusterExploration.samples.length} samples</span>
      </div>
      {saveMessage ? (
        <div className="mb-2 shrink-0 truncate border border-cyan-900/70 bg-cyan-950/20 px-2 py-1 text-[10px] text-cyan-100" data-vaa1-audio-save-message="true" title={saveMessage}>
          {saveMessage}
        </div>
      ) : null}
      <div className="mb-2 shrink-0" data-vaa1-audio-context-diagnostics="collapsed">
      <DynamicPanelSection
        sectionId="audio-context-diagnostics"
        title="Context & diagnostics"
        summary="source · selected evidence · visual anchors · timing · waveform"
        defaultOpen={false}
      >
        <div className="p-2">
      {sourceMediaPath ? (
        <div className="mb-3 shrink-0 truncate border border-slate-800 px-3 py-2 text-xs text-slate-400" data-vaa1-audio-source-media-link="true" title={sourceMediaPath}>
          Source media: <span className="font-mono text-cyan-200">{sourceMediaPath}</span>
        </div>
      ) : null}
      {selectedAudioEvidence ? (
        <div
          className="mb-3 shrink-0 border border-fuchsia-400/30 bg-fuchsia-950/20 px-3 py-2 text-xs text-slate-300"
          data-vaa1-audio-active-evidence="true"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-fuchsia-100">Selected audio evidence · {selectedAudioEvidence.label}</div>
              <div className="mt-1 font-mono text-fuchsia-200/80">
                {formatTime(selectedAudioEvidence.start)}–{formatTime(selectedAudioEvidence.end)} · current beat {formatTime(sourceClockTime)}
              </div>
              <div className="mt-1 text-slate-500">
                {selectedAudioEvidence.source || "governed audio evidence"} · {selectedAudioEvidence.reviewState || "candidate_review_required"}
              </div>
            </div>
            <button type="button" className="border border-fuchsia-400/20 px-2 py-1 text-fuchsia-100 hover:bg-fuchsia-900/30" onClick={() => setSelectedAudioEvidence(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
      <NarrativeAgentThumbnailProjectionStrip
        analysisId={analysisId}
        decisions={analysisData?.annotationCorrections?.proliferation_decisions}
        annotations={analysisData?.annotationCorrections?.manual_visual_annotations}
        atTime={selectedAudioEvidence?.start ?? sourceClockTime}
        title="Visual agent at audio time"
        max={6}
      />
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
        </div>
      </DynamicPanelSection>
      </div>
      <DynamicPanelSectionGroup panelId="audio" className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <DynamicPanelSection sectionId="cluster-exploration" title="Audio recognition governance · Narrative Agent family exploration" summary={`${narrativeAgentFamilies.length} Narrative Agent families · ${clusterExploration.samples.length} measured samples`}>
          <section className="border border-slate-800 bg-[#0c0c0c]" data-vaa1-audio-cluster-exploration="true">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Mature Data Proliferation · audio sample-cloud review</div>
              </div>
              <div className="text-right text-[10px] text-slate-400" data-vaa1-cluster-labour-account="true">
                {narrativeAgentFamilies.length} families · {clusterExploration.samples.length} samples
              </div>
            </div>
            <datalist id="audio-cluster-known-narrative-agents">
              {narrativeAgentOptions.map((option) => <option key={option.id} value={option.label}>{option.source}</option>)}
            </datalist>
            <div className="border-b border-slate-800 p-3" data-vaa1-narrative-agent-audio-families="true">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-200">Narrative Agent audio families</div>
                </div>
                <div className="text-right text-[10px] text-slate-400">{narrativeAgentFamilies.length} governed families · {narrativeAgentFamilies.reduce((sum, family) => sum + family.candidates.length, 0)} candidate relations</div>
              </div>
              <details className="mb-2 rounded border border-slate-800 bg-slate-950/50" data-vaa1-semantic-threshold-preview="true">
                <summary className="cursor-pointer px-2 py-1 text-[10px] text-slate-400">Matcher threshold &amp; methodological notes · {(narrativeAgentThreshold * 100).toFixed(0)}%</summary>
                <div className="grid gap-3 border-t border-slate-800 p-2 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)]">
                <label className="grid gap-1 text-[11px] text-slate-300">
                  Semantic candidate threshold preview · {(narrativeAgentThreshold * 100).toFixed(0)}%
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.01"
                    value={narrativeAgentThreshold}
                    onChange={(event) => setNarrativeAgentThreshold(Number(event.target.value))}
                    aria-label="Narrative Agent semantic candidate threshold"
                  />
                </label>
                <div className="text-[10px] text-slate-400">
                  Baseline {(NARRATIVE_AGENT_SEMANTIC_THRESHOLD * 100).toFixed(0)}%: {baselineNarrativeAgentCandidateCount} candidates. Preview: {previewNarrativeAgentCandidateCount} candidates ({previewNarrativeAgentCandidateCount - baselineNarrativeAgentCandidateCount >= 0 ? "+" : ""}{previewNarrativeAgentCandidateCount - baselineNarrativeAgentCandidateCount}). Preview changes review membership only and never writes governed data.
                  <span className="mt-1 block text-slate-500">Families come from confirmed Master Schema Narrative Agents. Audio embeddings and source-time presence rank candidates; technical segmentation labels are not analytical categories.</span>
                </div>
                </div>
              </details>
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]" data-vaa1-audio-family-focus-layout="true">
                <div className="min-w-0">
                {narrativeAgentFamilies.map((family) => {
                  const review = narrativeAgentFamilyReviews.get(family.id) || narrativeAgentAudioFamilyReview(family, narrativeAgentFamilies, clusterExploration.samples, narrativeAgentThreshold);
                  const lineupMembers = audioLineupMembers.get(family.id) || [];
                  const governedCount = lineupMembers.filter((member) => {
                    const status = decisionStatusFor(narrativeAgentFamilyMemberTarget(family, member));
                    return member.directSeed || status === "confirmed" || status === "dropped";
                  }).length;
                  return (
                  <article
                    key={family.id}
                    className={`${family.id === selectedAudioFamilyId ? "block" : "hidden"} rounded border border-fuchsia-950/80 bg-fuchsia-950/10 p-2`}
                    data-vaa1-narrative-agent-audio-family={family.label}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sampleId = event.dataTransfer.getData("application/x-datascene-narrative-agent-audio-candidate");
                      if (!sampleId) return;
                      setAudioFamilyAssignments((current) => ({ ...current, [sampleId]: family.id }));
                      setSaveMessage(`Audio candidate moved to ${family.label}. Confirm it once to write the governed Narrative Agent relation.`);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-fuchsia-100">{family.label}</div>
                        <div className="mt-0.5 text-[9px] text-slate-600">Master Schema · {family.registrySources.join(" + ")}</div>
                      </div>
                      <span className={`rounded px-2 py-1 text-[9px] ${family.state === "confirmed_voice_seed" ? "bg-cyan-950 text-cyan-200" : family.state === "constellational_candidates" ? "bg-amber-950 text-amber-200" : "bg-slate-900 text-slate-500"}`}>
                        {family.state === "confirmed_voice_seed" ? `${family.seedMembers.length} confirmed audio seed${family.seedMembers.length === 1 ? "" : "s"}` : family.state === "constellational_candidates" ? "constellational candidates" : "awaiting audio evidence"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] text-slate-400 sm:grid-cols-4" data-vaa1-semantic-family-metrics="true">
                      <div className="rounded bg-slate-950 px-1.5 py-1">Cohesion <span className="text-slate-200">{typeof review.cohesion === "number" ? `${(review.cohesion * 100).toFixed(1)}%` : "not available"}</span></div>
                      <div className="rounded bg-slate-950 px-1.5 py-1">Sample coverage <span className="text-slate-200">{review.includedCandidates.length}/{clusterExploration.samples.length} · {(review.sampleCoverage * 100).toFixed(0)}%</span></div>
                      <div className="rounded bg-slate-950 px-1.5 py-1">Time coverage <span className="text-slate-200">{review.coveredSeconds.toFixed(2)}s{typeof review.temporalStart === "number" && typeof review.temporalEnd === "number" ? ` · ${formatTime(review.temporalStart)}–${formatTime(review.temporalEnd)}` : ""}</span></div>
                      <div className="rounded bg-slate-950 px-1.5 py-1">Reviewed <span className="text-slate-200">{governedCount}/{lineupMembers.length}</span></div>
                    </div>
                    <div className="mt-1 text-[9px] text-slate-500" data-vaa1-nearest-competing-family="true">
                      Nearest competing family: {review.nearestCompetitor ? `${review.nearestCompetitor.label} · ${(review.nearestCompetitor.score * 100).toFixed(1)}%` : "none supported for the representative sample"}
                    </div>
                    {review.representative || review.uncertain ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {review.representative ? (
                          <button type="button" className="rounded border border-emerald-900/60 bg-emerald-950/10 p-2 text-left" data-vaa1-semantic-representative="true" onClick={() => jumpTo(review.representative!.start, { analysisId, evidenceId: review.representative!.id, label: `${family.label} representative`, source: "narrative_agent_audio_family_review", end: review.representative!.end, detail: review.representative!.support.join(" · "), reviewState: review.representative!.directSeed ? "mature_manual_anchor" : "candidate_review_required" })}>
                            <span className="block text-[9px] uppercase tracking-[0.12em] text-emerald-300">Strongest representative</span>
                            <span className="mt-1 block font-mono text-[10px] text-slate-200">{formatTime(review.representative.start)}–{formatTime(review.representative.end)} · {(review.representative.matchScore * 100).toFixed(1)}%</span>
                          </button>
                        ) : <div />}
                        {review.uncertain ? (
                          <button type="button" className="rounded border border-amber-900/60 bg-amber-950/10 p-2 text-left" data-vaa1-semantic-uncertain="true" onClick={() => jumpTo(review.uncertain!.start, { analysisId, evidenceId: review.uncertain!.id, label: `${family.label} uncertain membership`, source: "narrative_agent_audio_family_review", end: review.uncertain!.end, detail: review.uncertain!.support.join(" · "), reviewState: "candidate_review_required" })}>
                            <span className="block text-[9px] uppercase tracking-[0.12em] text-amber-300">Uncertain / threshold boundary</span>
                            <span className="mt-1 block font-mono text-[10px] text-slate-200">{formatTime(review.uncertain.start)}–{formatTime(review.uncertain.end)} · {(review.uncertain.matchScore * 100).toFixed(1)}%</span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {lineupMembers.length ? (
                      <div className="mt-2 max-h-[calc(100vh-330px)] min-h-48 overflow-y-auto border-t border-slate-800" data-vaa1-narrative-agent-audio-family-members="true">
                        {lineupMembers.map((member) => {
                          const boundaryEdit = audioBoundaryEdits[member.id];
                          const editedStart = boundaryEdit?.start ?? member.start;
                          const editedEnd = boundaryEdit?.end ?? member.end;
                          const editedDuration = editedEnd - editedStart;
                          const editedCompetingSpeaker = clusterExploration.samples.some((sample) => (
                            sample.id !== member.id && sample.speaker !== member.speaker &&
                            overlapSeconds(editedStart, editedEnd, sample.start, sample.end) > 0.12
                          ));
                          const editedBoundarySafe = editedDuration >= 0.25 && editedDuration <= 8 && !editedCompetingSpeaker;
                          const editedMember = {
                            ...member,
                            start: editedStart,
                            end: editedEnd,
                            boundarySafe: editedBoundarySafe,
                            boundaryReason: editedBoundarySafe ? undefined : editedCompetingSpeaker ? "Adjusted sample still overlaps another diarized speaker" : "Adjusted sample must remain between 250 ms and 8 s",
                          };
                          const target = narrativeAgentFamilyMemberTarget(family, editedMember);
                          const status = decisionStatusFor(target);
                          const confirmedNarrativeAgent = status === "confirmed"
                            ? String(optimisticAudioLabels[target.id] || latestDecisionFor(target)?.applied_label || target.label).trim()
                            : "";
                          const persistConfirmedBoundary = () => {
                            if (!confirmedNarrativeAgent || savingDecisionId !== null) return;
                            const savedCandidateId = latestDecisionFor(target)?.candidate_id;
                            queueAudioDecision(
                              savedCandidateId ? { ...target, id: savedCandidateId } : target,
                              "agent",
                              confirmedNarrativeAgent,
                            );
                          };
                          const finishBoundaryPointer = (event: React.PointerEvent<HTMLInputElement>) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                              event.currentTarget.releasePointerCapture(event.pointerId);
                            }
                            event.currentTarget.blur();
                            persistConfirmedBoundary();
                          };
                          const transcriptText = transcriptTextForInterval(transcriptRows, editedStart, editedEnd);
                          return (
                            <div
                              key={target.id}
                              draggable={!member.directSeed}
                              onDragStart={(event) => {
                                if (member.directSeed) return;
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("application/x-datascene-narrative-agent-audio-candidate", member.id);
                              }}
                              className="grid grid-cols-[minmax(0,1fr)_minmax(90px,130px)_auto_auto_auto] items-center gap-2 border-b border-slate-900 py-1 text-[10px]"
                              data-vaa1-narrative-agent-audio-candidate="true"
                              data-vaa1-narrative-agent-audio-draggable={!member.directSeed ? "true" : "false"}
                              data-candidate-status={status}
                            >
                              <button type="button" className="min-w-0 text-left" data-vaa1-audio-constellation-support="true" onClick={() => jumpTo(member.start, { analysisId, evidenceId: member.id, label: `${family.label} candidate`, source: target.source, end: member.end, detail: member.support.join(" · "), reviewState: member.directSeed ? "mature_manual_anchor" : "candidate_review_required" })}>
                                <span className="block truncate text-cyan-200">{formatTime(member.start)}–{formatTime(member.end)} · {(member.matchScore * 100).toFixed(1)}%</span>
                                <span className="block truncate text-slate-500">{member.support.join(" · ") || "source-linked candidate"}</span>
                                <span className={`block ${transcriptText ? "text-slate-200" : "text-slate-600"}`} data-vaa1-audio-candidate-transcript="true">{transcriptText ? `“${transcriptText}”` : "No overlapping transcript line"}</span>
                                <span className={`block truncate ${member.boundarySafe ? "text-emerald-500" : "text-amber-400"}`}>{member.boundarySafe ? "single-speaker boundary eligible" : member.boundaryReason}</span>
                              </button>
                              <div className="grid gap-1">
                                <BoundedAudioSample analysisId={analysisId} start={editedStart} end={Math.max(editedStart + 0.05, editedEnd)} label={`Play bounded ${family.label} audio candidate at ${formatTime(editedStart)}`} onNavigate={() => jumpTo(editedStart, { analysisId, evidenceId: member.id, label: `${family.label} audio candidate`, source: target.source, end: editedEnd })} />
                                <div className="grid min-w-0 gap-0.5" data-vaa1-audio-boundary-editor="true">
                                  <label className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-1 text-[8px] text-slate-500"><span>Start</span><input className="block w-full min-w-0" type="range" min={Math.max(0, member.start - 2)} max={Math.max(member.start + 0.05, member.end)} step="0.05" value={editedStart} onChange={(event) => setAudioBoundaryEdits((current) => ({ ...current, [member.id]: { start: Math.min(Number(event.target.value), (current[member.id]?.end ?? member.end) - 0.05), end: current[member.id]?.end ?? member.end } }))} onPointerUp={finishBoundaryPointer} onPointerCancel={finishBoundaryPointer} onKeyUp={persistConfirmedBoundary} aria-label={`Start boundary ${formatTime(editedStart)}`} /></label>
                                  <label className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-1 text-[8px] text-slate-500"><span>End</span><input className="block w-full min-w-0" type="range" min={Math.min(member.end - 0.05, member.start)} max={member.end + 2} step="0.05" value={editedEnd} onChange={(event) => setAudioBoundaryEdits((current) => ({ ...current, [member.id]: { start: current[member.id]?.start ?? member.start, end: Math.max(Number(event.target.value), (current[member.id]?.start ?? member.start) + 0.05) } }))} onPointerUp={finishBoundaryPointer} onPointerCancel={finishBoundaryPointer} onKeyUp={persistConfirmedBoundary} aria-label={`End boundary ${formatTime(editedEnd)}`} /></label>
                                </div>
                              </div>
                              <span className={status === "confirmed" ? "rounded bg-emerald-950 px-1.5 py-1 font-semibold text-emerald-200" : status === "dropped" ? "text-slate-300" : "text-slate-600"} data-vaa1-audio-decision-receipt={status}>{member.directSeed ? "mature seed" : status === "confirmed" ? `Mature · ${target.label}` : status}</span>
                              <select aria-label={`Confirm audio sample at ${formatTime(editedStart)} as Narrative Agent`} className="max-w-[170px] rounded border border-cyan-900 bg-slate-950 px-1 py-0.5 text-[9px] text-cyan-100 disabled:opacity-70" value={confirmedNarrativeAgent} disabled={!editedBoundarySafe} onChange={(event) => { const label = event.target.value; const savedCandidateId = latestDecisionFor(target)?.candidate_id; if (label) queueAudioDecision(savedCandidateId ? { ...target, id: savedCandidateId } : target, "agent", label); }}>{confirmedNarrativeAgent ? <option value={confirmedNarrativeAgent}>Confirmed · {confirmedNarrativeAgent}</option> : <option value="">Confirm as…</option>}{newNarrativeAgentByTarget.__audio_family_new__?.trim() && !sameNarrativeAgentFamily(newNarrativeAgentByTarget.__audio_family_new__, confirmedNarrativeAgent) ? <option value={newNarrativeAgentByTarget.__audio_family_new__.trim()}>New: {newNarrativeAgentByTarget.__audio_family_new__.trim()}</option> : null}{narrativeAgentOptions.filter((option) => !sameNarrativeAgentFamily(option.label, confirmedNarrativeAgent)).map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}</select>
                              <button type="button" className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 disabled:opacity-40" disabled={savingDecisionId !== null || status === "dropped" || member.directSeed} onClick={() => void persistAudioDecision(target, "dropped")}>{status === "dropped" ? "Dropped" : "Drop"}</button>
                            </div>
                          );
                        })}
                      </div>
                    ) : <div className="mt-2 border-t border-slate-800 pt-2 text-[10px] text-slate-500">No source-timed audio candidate currently meets the preview threshold for this confirmed Narrative Agent. Drop a plausible candidate on this row or adjust the preview threshold; Datascene does not invent a voice match.</div>}
                    <details className="mt-2 border-t border-slate-800 pt-1" data-vaa1-semantic-exclusions="true">
                      <summary className="cursor-pointer text-[9px] uppercase tracking-[0.12em] text-slate-500">Excluded from preview · {review.excludedSamples.length}</summary>
                      <div className="mt-1 max-h-40 overflow-y-auto">
                        {review.excludedSamples.length ? review.excludedSamples.map((exclusion) => (
                          <button key={`${family.id}:excluded:${exclusion.sample.id}`} type="button" className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-slate-900 py-1 text-left text-[9px]" data-vaa1-semantic-excluded-sample="true" onClick={() => jumpTo(exclusion.sample.start, { analysisId, evidenceId: exclusion.sample.id, label: `${family.label} excluded candidate`, source: "narrative_agent_audio_family_review", end: exclusion.sample.end, detail: exclusion.reason, reviewState: "excluded_from_threshold_preview" })}>
                            <span className="font-mono text-cyan-300">{formatTime(exclusion.sample.start)}–{formatTime(exclusion.sample.end)}</span>
                            <span className="truncate text-slate-500">{exclusion.reason}{typeof exclusion.score === "number" ? ` · ${(exclusion.score * 100).toFixed(1)}%` : ""}</span>
                          </button>
                        )) : <div className="py-1 text-[9px] text-slate-600">No samples are excluded at this preview threshold.</div>}
                      </div>
                    </details>
                  </article>
                  );
                })}
                </div>
                <aside className="self-start rounded border border-slate-800 bg-slate-950/70 p-2 xl:sticky xl:top-0" data-vaa1-audio-family-destination-list="true">
                  <div className="mb-2 text-[9px] uppercase tracking-[0.12em] text-slate-400">Known characters · select or drop</div>
                  <div className="grid max-h-[55vh] gap-1 overflow-y-auto">
                    {narrativeAgentFamilies.map((family) => (
                      <button key={`destination:${family.id}`} type="button" className={`rounded border px-2 py-1 text-left text-[10px] ${family.id === selectedAudioFamilyId ? "border-fuchsia-600 bg-fuchsia-950/30 text-fuchsia-100" : "border-slate-800 text-slate-300"}`} onClick={() => setSelectedAudioFamilyId(family.id)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); const sampleId = event.dataTransfer.getData("application/x-datascene-narrative-agent-audio-candidate"); if (sampleId) { setAudioFamilyAssignments((current) => ({ ...current, [sampleId]: family.id })); setSelectedAudioFamilyId(family.id); setSaveMessage(`Audio candidate moved to ${family.label}; choose it from Confirm as… to save.`); } }}>
                        <span className="block truncate font-medium">{family.label}</span><span className="text-[8px] text-slate-600">{(audioLineupMembers.get(family.id) || []).length} samples</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 border-t border-slate-800 pt-2">
                    <input list="audio-cluster-known-narrative-agents" value={newNarrativeAgentByTarget.__audio_family_new__ || ""} onChange={(event) => setNewNarrativeAgentByTarget((current) => ({ ...current, __audio_family_new__: event.target.value }))} placeholder="New character, e.g. Police officer" className="w-full rounded border border-slate-700 bg-black px-2 py-1 text-[9px] text-slate-100" data-vaa1-audio-new-character="true" />
                    <div className="mt-1 text-[8px] text-slate-600">Enter a new character, then choose “New:” from the selected sample’s Confirm as… menu.</div>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </DynamicPanelSection>
        <DynamicPanelSection sectionId="governed-sound-intervals" title="Governed music, noise, and silence intervals" summary={`${governedSoundIntervals.length} measured intervals`}>
        <details open className="mb-3 border border-slate-800" data-vaa1-audio-section="governed-sound-intervals">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Governed music, noise, and silence intervals
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-400">
              <thead className="sticky top-0 bg-slate-950 uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Interval</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Energy</th>
                  <th className="px-3 py-2">Evidence</th>
                  <th className="px-3 py-2">Authority</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedGovernedSoundIntervals.length ? pagedGovernedSoundIntervals.map((event, index) => {
                  const soundCategory = categoryFor(event);
                  const automaticallyMature = soundCategory === "music" || soundCategory === "silence";
                  return (
                  <tr
                    key={event.interval_id || event.segment_id || `sound:${governedEventPage}:${index}`}
                    data-vaa1-audio-evidence-row="true"
                    data-vaa1-audio-selected-row={selectedAudioEvidence && audioEvidenceKey(selectedAudioEvidence) === audioEvidenceKey({ evidenceId: event.interval_id || event.segment_id || event.event_id, start: Number(event.start || 0), end: Number(event.end || event.start || 0), label: `${categoryFor(event)} · ${eventLabel(event)}`, source: event.source_layer }) ? "true" : undefined}
                    data-source-clock-nearest={typeof event.start === "number" && typeof event.end === "number" && sourceClockTime >= event.start && sourceClockTime <= event.end ? "true" : undefined}
                    className={`cursor-pointer border-b border-slate-900 hover:bg-slate-900 ${selectedAudioEvidence && audioEvidenceKey(selectedAudioEvidence) === audioEvidenceKey({ evidenceId: event.interval_id || event.segment_id || event.event_id, start: Number(event.start || 0), end: Number(event.end || event.start || 0), label: `${categoryFor(event)} · ${eventLabel(event)}`, source: event.source_layer }) ? "bg-fuchsia-950/20 ring-1 ring-inset ring-fuchsia-300/60" : typeof event.start === "number" && typeof event.end === "number" && sourceClockTime >= event.start && sourceClockTime <= event.end ? "bg-cyan-950/20" : ""}`}
                    onClick={() => jumpTo(event.start, {
                      analysisId,
                      evidenceId: event.interval_id || event.segment_id || event.event_id,
                      label: `${categoryFor(event)} · ${eventLabel(event)}`,
                      source: event.source_layer || "audio_event_intervals",
                      end: event.end,
                      detail: event.classifier_labels?.join(", "),
                      reviewState: automaticallyMature ? "mature_measured_detection" : "candidate_review_required",
                    })}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-cyan-300">
                      {formatTime(event.start)}–{formatTime(event.end)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-100">
                      {soundCategory} · {eventLabel(event)}
                    </td>
                    <td className="px-3 py-2 font-mono">{formatValue(event.confidence)}</td>
                    <td className="px-3 py-2 font-mono">
                      {formatValue(event.measurements?.energy_dbfs)} dBFS
                    </td>
                    <td className="max-w-[360px] px-3 py-2 text-slate-500">
                      {event.classifier_labels?.join(", ") || event.source_layer || "measured waveform interval"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                      {automaticallyMature ? "mature · automatic measurement" : "measured · review in semantic sound family"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        className="mr-3 text-cyan-300 hover:text-cyan-100"
                        onClick={() => jumpTo(event.start, {
                          analysisId,
                          evidenceId: event.interval_id || event.segment_id || event.event_id,
                          label: `${soundCategory} · ${eventLabel(event)}`,
                          source: event.source_layer || "audio_event_intervals",
                          end: event.end,
                          detail: event.classifier_labels?.join(", "),
                          reviewState: automaticallyMature ? "mature_measured_detection" : "candidate_review_required",
                        })}
                      >
                        Open source
                      </button>
                      <span className={automaticallyMature ? "text-emerald-200" : "text-slate-500"}>{automaticallyMature ? "No confirmation required" : "Use Foley/sound family review"}</span>
                    </td>
                  </tr>
                  );
                }) : (
                  <tr><td className="px-3 py-3 text-slate-500" colSpan={7}>No governed music, noise, or silence intervals are available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {governedSoundIntervals.length ? (
            <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
              <span>
                Rows {governedEventPage * GOVERNED_AUDIO_PAGE_SIZE + 1}–
                {Math.min((governedEventPage + 1) * GOVERNED_AUDIO_PAGE_SIZE, governedSoundIntervals.length)} of {governedSoundIntervals.length}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={governedEventPage === 0} onClick={() => setGovernedEventPage((page) => Math.max(0, page - 1))} className="border border-slate-800 px-2 py-1 disabled:opacity-30">Previous</button>
                <span>Page {governedEventPage + 1} of {governedEventPageCount}</span>
                <button type="button" disabled={governedEventPage + 1 >= governedEventPageCount} onClick={() => setGovernedEventPage((page) => Math.min(governedEventPageCount - 1, page + 1))} className="border border-slate-800 px-2 py-1 disabled:opacity-30">Next</button>
              </div>
            </div>
          ) : null}
        </details>
        </DynamicPanelSection>

        <DynamicPanelSection sectionId="speech-activity" title="Speech and voice-activity intervals" summary={`${categorizedEvents.speech.length} events`}>
        <details open className="mb-3 border border-slate-800" data-vaa1-audio-section="speech-activity">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Speech and voice-activity intervals</summary>
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
        </DynamicPanelSection>

        <DynamicPanelSection sectionId="prosody" title="Prosody, delivery, and turn structure" summary={`${prosodyCues.length} cues`}>
        <details open className="mb-3 border border-slate-800" data-vaa1-audio-section="prosody">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Prosody, delivery, and turn structure</summary>
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
                {prosodyCues.length ? prosodyCues.map((cue, index) => {
                  const evidence: FocusedAudioEvidence = { videoId: analysisId, evidenceId: cue.cue_id || `prosody:${index}`, start: Number(cue.start || 0), end: Number(cue.end || cue.start || 0), label: cue.sound_environment?.label || cue.text || "Prosody cue", source: "audio_prosody.cues", detail: cue.text, reviewState: "candidate_review_required" };
                  return (
                  <tr key={evidence.evidenceId} {...audioEvidenceRowProps(evidence)} onClick={() => jumpTo(cue.start, { analysisId, evidenceId: evidence.evidenceId, label: evidence.label, source: evidence.source, end: evidence.end, detail: evidence.detail, reviewState: evidence.reviewState })}>
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
                  );
                }) : (
                  <tr><td className="px-3 py-3 text-slate-500" colSpan={10}>No prosody cues are available for this analysis.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
        </DynamicPanelSection>

        <DynamicPanelSection sectionId="music-sound" title="Music and sound classifier" summary={`${musicRows.length} rows`}>
        <details open className="mb-3 border border-slate-800" data-vaa1-audio-section="music-sound">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Music and sound classifier</summary>
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
                {musicRows.length ? musicRows.map((row, index) => {
                  const evidence: FocusedAudioEvidence = { videoId: analysisId, evidenceId: `music:${index}:${safeIdPart(row.label || row.source)}`, start: Number(row.start || 0), end: Number(row.end || row.start || 0), label: String(row.label || row.source || "Music/sound row"), source: String(row.evidence || row.source || "music_sound"), detail: String(row.value || ""), reviewState: "candidate_review_required" };
                  return (
                  <tr key={evidence.evidenceId} {...audioEvidenceRowProps(evidence)} onClick={() => jumpTo(row.start, { analysisId, evidenceId: evidence.evidenceId, label: evidence.label, source: evidence.source, end: evidence.end, detail: evidence.detail, reviewState: evidence.reviewState })}>
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
                  );
                }) : (
                  <tr><td className="px-3 py-3 text-slate-500" colSpan={7}>No music or sound classifier rows are available yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
        </DynamicPanelSection>

        <DynamicPanelSection sectionId="lyrics" title="Lyrics and transcript matches" summary={`${lyricRows.length} matches`}>
        <details open className="mb-3 border border-slate-800" data-vaa1-audio-section="lyrics">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Lyrics and transcript matches</summary>
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
                {lyricRows.length ? lyricRows.map((row, index) => {
                  const evidence: FocusedAudioEvidence = { videoId: analysisId, evidenceId: `lyric:${index}:${safeIdPart(row.transcript || row.lyric)}`, start: Number(row.start || 0), end: Number(row.end || row.start || 0), label: row.transcript || row.lyric || "Transcript row", source: row.source || "lyrics_in_transcript", detail: row.lyric, reviewState: "candidate_review_required" };
                  return (
                  <tr key={evidence.evidenceId} {...audioEvidenceRowProps(evidence)} onClick={() => jumpTo(row.start, { analysisId, evidenceId: evidence.evidenceId, label: evidence.label, source: evidence.source, end: evidence.end, detail: evidence.detail, reviewState: evidence.reviewState })}>
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
                  );
                }) : (
                  <tr><td className="px-3 py-3 text-slate-500" colSpan={7}>No lyric/transcript matches are available. Online lyric lookup remains disabled unless explicitly activated.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
        </DynamicPanelSection>

        <DynamicPanelSection sectionId="foley-sampling" title="Foley sampling and proliferation candidates" summary={`${foleyRows.length} review candidates`}>
        <details open className="mb-3 border border-slate-800" data-vaa1-audio-section="foley-sampling" data-vaa1-audio-foley-sampling="true">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Foley sampling and proliferation candidates</summary>
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
                {foleyRows.length ? foleyRows.map((row, index) => {
                  const evidence: FocusedAudioEvidence = { videoId: analysisId, evidenceId: `foley:${index}:${safeIdPart(row.label)}`, start: Number(row.start || 0), end: Number(row.end || row.start || 0), label: row.label, source: row.source, detail: row.nextAction, reviewState: row.reviewState };
                  return (
                  <tr key={evidence.evidenceId} {...audioEvidenceRowProps(evidence)} onClick={() => jumpTo(row.start, { analysisId, evidenceId: evidence.evidenceId, label: evidence.label, source: evidence.source, end: evidence.end, detail: evidence.detail, reviewState: evidence.reviewState })}>
                    <td className="px-3 py-2 font-semibold text-slate-100">{row.label}</td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(row.start)}</td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{formatTime(row.end)}</td>
                    <td className="px-3 py-2 font-mono">{formatValue(row.confidence)}</td>
                    <td className="px-3 py-2 text-slate-300">{row.source}</td>
                    <td className="px-3 py-2 text-amber-200">{row.boundarySafe ? row.reviewState : `boundary blocked · ${row.boundaryReason}`}</td>
                    <td className="px-3 py-2 text-slate-300">{row.proliferationTarget}</td>
                    <td className="px-3 py-2 text-slate-500">{row.nextAction}</td>
                    <td className="min-w-[250px] px-3 py-2"><div className="grid gap-1">{typeof row.start === "number" && typeof row.end === "number" && row.end > row.start ? <BoundedAudioSample analysisId={analysisId} start={row.start} end={row.end} label={`Play bounded ${row.label} Foley sample at ${formatTime(row.start)}`} /> : null}{renderDecisionControls({
                      id: `foley:${index}:${safeIdPart(row.label)}`,
                      label: row.label,
                      start: row.start,
                      end: row.end,
                      source: row.source,
                      rowType: "foley-sampling",
                      validForConfirmation: row.boundarySafe,
                      staleReason: row.boundaryReason,
                    })}</div></td>
                  </tr>
                  );
                }) : (
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
        </DynamicPanelSection>

        <DynamicPanelSection sectionId="recognition-governance" title="Audio recognition governance" summary={`${governanceRows.filter((row) => row.status === "missing").length} missing · ${governanceRows.length} layers`}>
        <details open className="mb-3 border border-slate-800" data-vaa1-audio-section="recognition-governance">
          <summary className="cursor-pointer border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Audio recognition governance</summary>
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
                  const evidence: FocusedAudioEvidence = { videoId: analysisId, evidenceId: target.id, start: Number(target.start || 0), end: Number(target.end || target.start || 0), label: target.label, source: target.source, detail: row.nextAction, reviewState: row.status };
                  return (
                    <tr key={row.layer} {...audioEvidenceRowProps(evidence)} onClick={() => jumpTo(target.start, { analysisId, evidenceId: evidence.evidenceId, label: evidence.label, source: evidence.source, end: evidence.end, detail: evidence.detail, reviewState: evidence.reviewState })}>
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
        </DynamicPanelSection>
      </DynamicPanelSectionGroup>
    </div>
  );
}

export default AudioPanel;
