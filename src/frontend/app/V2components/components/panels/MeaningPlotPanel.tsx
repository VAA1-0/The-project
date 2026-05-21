import React, { useCallback, useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type AnalysisData, type MasterSchemaResolvedEvidenceRecord } from "@/lib/video-service";
import type { ExpressionSample, TranscriptSegment } from "@/lib/video-service";
import { openVideoAtTime } from "@/lib/video-navigation";
import { apiService, type SecondOrderLabelInstruction, type SourceMediaMetadata } from "@/lib/api-service";
import {
  matureSceneSegmentsFromAnalysis,
  matureSceneSegmentSourceLabel,
} from "@/lib/scene-governance";

type PlotLens = "aristotle" | "freytag" | "campbell" | "frye" | "booker";
type DramaticArchetypeLens =
  | "shakespearean_performativity"
  | "proppian_function"
  | "jungian_symbolic"
  | "campbellian_threshold"
  | "greimasian_actant"
  | "burkean_motive";

type NarrativeAgentProfile = NonNullable<
  NonNullable<SourceMediaMetadata["user_annotations"]>["narrative_agent_profiles"]
>[number];

type MeaningSceneSegment = {
  scene_index?: number;
  start: number;
  end: number;
  duration?: number;
};

type CharacterSceneGovernanceRow = {
  label: string;
  profile?: NarrativeAgentProfile;
  profileKey: string;
  scenes: Array<{
    scene: MeaningSceneSegment;
    sceneIndex: number;
    sceneKey: string;
    staged: boolean;
    surfaced: boolean;
    sceneInstructions: SecondOrderLabelInstruction[];
    lines: TranscriptSegment[];
    manualAnnotations: Array<Record<string, any>>;
    audioProsody: Array<Record<string, any>>;
    sourceSamples: Array<Record<string, any>>;
    persistenceSignals: SecondOrderLabelInstruction[];
  }>;
};

type SceneConstellationLayer = {
  layer_id?: string;
  label?: string;
  count?: number;
  authority?: string;
  source?: string;
  status?: string;
};

type MeaningSceneCard = {
  scene_id?: string;
  title?: string;
  display_title?: string;
  overview?: string;
  nlp_scene_summary_sentence?: string;
  nlp_scene_summary?: {
    sentence?: string;
    description?: Record<string, string | undefined>;
    interrogative_schema?: Record<string, string | undefined>;
    prose_sections?: Record<string, string | undefined>;
  };
  prose_sections?: Record<string, string | undefined>;
  interrogative_schema?: Record<string, string | undefined>;
  mise_en_scene_description?: Record<string, string | undefined>;
  said_in_scene?: Array<{ speaker?: string; text?: string }>;
  items?: Array<{ category?: string; label?: string; symbol?: string }>;
  resolved_items?: Array<{ category?: string; label?: string; symbol?: string }>;
};

const PLOT_LENSES: Array<{ id: PlotLens; label: string }> = [
  { id: "aristotle", label: "Aristotle" },
  { id: "freytag", label: "Freytag" },
  { id: "campbell", label: "Campbell" },
  { id: "frye", label: "Frye" },
  { id: "booker", label: "Booker" },
];

const DRAMATIC_ARCHETYPE_LENSES: Array<{
  id: DramaticArchetypeLens;
  label: string;
  tradition: string;
  insight: string;
  cues: string[];
  signalKeywords: string[];
}> = [
  {
    id: "shakespearean_performativity",
    label: "Performed agency",
    tradition: "Shakespearean",
    insight: "Agency shifts through public role, private motive, status pressure, and rhetoric.",
    cues: ["role shift", "status pressure", "double speech"],
    signalKeywords: [
      "role",
      "status",
      "power",
      "identity",
      "contradiction",
      "hesitation",
      "irony",
      "dominance",
      "authority",
    ],
  },
  {
    id: "proppian_function",
    label: "Narrative function",
    tradition: "Proppian",
    insight: "Agents are read through plot work: helper, opponent, donor, dispatcher, false hero.",
    cues: ["helper/opponent", "task", "false hero"],
    signalKeywords: [
      "helper",
      "opponent",
      "villain",
      "donor",
      "dispatcher",
      "quest",
      "task",
      "action",
      "obstacle",
      "support",
    ],
  },
  {
    id: "jungian_symbolic",
    label: "Symbolic shadow",
    tradition: "Jungian / Mythic",
    insight: "Agents are read as symbolic functions: shadow, mentor, trickster, anima/animus, self.",
    cues: ["shadow", "mentor", "trickster"],
    signalKeywords: [
      "shadow",
      "mentor",
      "trickster",
      "self",
      "mask",
      "fear",
      "desire",
      "symbol",
      "mirror",
      "projection",
    ],
  },
  {
    id: "campbellian_threshold",
    label: "Threshold journey",
    tradition: "Campbellian",
    insight: "Agents are read through transformation phases, thresholds, tests, ordeal, return.",
    cues: ["threshold", "test", "transformation"],
    signalKeywords: [
      "threshold",
      "journey",
      "transformation",
      "ordeal",
      "return",
      "test",
      "mentor",
      "crossing",
      "revelation",
      "sacrifice",
    ],
  },
  {
    id: "greimasian_actant",
    label: "Actant relation",
    tradition: "Greimasian",
    insight: "Agents are read by structural relation: subject, object, sender, receiver, helper, opponent.",
    cues: ["subject/object", "helper/opponent", "sender/receiver"],
    signalKeywords: [
      "subject",
      "object",
      "sender",
      "receiver",
      "helper",
      "opponent",
      "relation",
      "goal",
      "exchange",
      "pursuit",
    ],
  },
  {
    id: "burkean_motive",
    label: "Motive scene",
    tradition: "Burkean / Dramatistic",
    insight: "Agents are read through act, scene, agent, agency, purpose, guilt, and motive.",
    cues: ["act/scene", "agency", "purpose"],
    signalKeywords: [
      "act",
      "scene",
      "agent",
      "agency",
      "purpose",
      "motive",
      "guilt",
      "conflict",
      "meaning",
      "situation",
    ],
  },
];

const CHARACTER_FAMILIES = new Set([
  "Identification",
  "Interaction",
  "Role",
  "Relationship",
  "Affect",
  "Intensity",
]);

const PLOT_FAMILIES = new Set(["Scene", "Episode", "Situation", "Action", "ReportClaim"]);

function secondsFromInstruction(instruction: SecondOrderLabelInstruction): number {
  const raw = instruction.time_span?.start_ms ?? instruction.time_span?.start ?? 0;
  const number = Number(raw || 0);
  return instruction.time_span?.start_ms !== undefined || number > 1000 ? number / 1000 : number;
}

function endSecondsFromInstruction(instruction: SecondOrderLabelInstruction): number {
  const raw =
    instruction.time_span?.end_ms ??
    instruction.time_span?.end ??
    instruction.time_span?.start_ms ??
    instruction.time_span?.start ??
    0;
  const number = Number(raw || 0);
  return instruction.time_span?.end_ms !== undefined || number > 1000 ? number / 1000 : number;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function supportScore(instruction: SecondOrderLabelInstruction): number {
  return instruction.open_scores?.weighted_support_score ?? 0;
}

function supportBand(score: number): "weak" | "tentative" | "moderate" | "strong" {
  if (score >= 0.75) return "strong";
  if (score >= 0.62) return "moderate";
  if (score >= 0.45) return "tentative";
  return "weak";
}

function supportLabel(instruction: SecondOrderLabelInstruction): string {
  const score = supportScore(instruction);
  const band = supportBand(score);
  return `${band} support`;
}

function instructionLabel(instruction: SecondOrderLabelInstruction): string {
  return `${instruction.target_label_family} / ${instruction.candidate_label}`;
}

function sourceRefSummary(instruction: SecondOrderLabelInstruction): string {
  const refs = instruction.source_evidence_refs || [];
  if (refs.length === 0) {
    return "source traceback";
  }
  const first = refs[0];
  const firstLabel = first.evidence_id || first.evidence_kind || "source";
  return refs.length === 1 ? String(firstLabel) : `${firstLabel} +${refs.length - 1}`;
}

function plotLensTerms(instruction: SecondOrderLabelInstruction, lens: PlotLens): string[] {
  const payload = (instruction.source_feature_payload || {}) as Record<string, any>;
  const lenses = (payload.alternative_plot_lenses || {}) as Record<string, unknown>;
  const terms = lenses[lens];
  if (Array.isArray(terms) && terms.length > 0) {
    return terms.map(String);
  }
  if (lens === "freytag" && (PLOT_FAMILIES.has(instruction.target_label_family) || CHARACTER_FAMILIES.has(instruction.target_label_family))) {
    return [instruction.candidate_label];
  }
  return [];
}

function archetypeSignalText(instruction: SecondOrderLabelInstruction): string {
  const payload = (instruction.source_feature_payload || {}) as Record<string, unknown>;
  return [
    instruction.target_label_family,
    instruction.candidate_label,
    instruction.status,
    ...(instruction.participants_involved || []),
    ...Object.values(payload).flatMap((value) =>
      Array.isArray(value) ? value.map(String) : [String(value ?? "")],
    ),
  ]
    .join(" ")
    .toLowerCase();
}

function archetypeScore(
  instructions: SecondOrderLabelInstruction[],
  lens: DramaticArchetypeLens,
): number {
  const cues = DRAMATIC_ARCHETYPE_LENSES.find((entry) => entry.id === lens)?.signalKeywords || [];
  return instructions.reduce((score, instruction) => {
    const signalText = archetypeSignalText(instruction);
    const cueScore = cues.filter((cue) => signalText.includes(cue)).length;
    return score + cueScore * supportScore(instruction);
  }, 0);
}

function archetypeMatches(
  instructions: SecondOrderLabelInstruction[],
  lens: DramaticArchetypeLens,
): SecondOrderLabelInstruction[] {
  const cues = DRAMATIC_ARCHETYPE_LENSES.find((entry) => entry.id === lens)?.signalKeywords || [];
  return instructions.filter((instruction) => {
    const signalText = archetypeSignalText(instruction);
    return cues.some((cue) => signalText.includes(cue));
  });
}

function matchedArchetypeCues(
  instructions: SecondOrderLabelInstruction[],
  lens: DramaticArchetypeLens,
): string[] {
  const cues = DRAMATIC_ARCHETYPE_LENSES.find((entry) => entry.id === lens)?.signalKeywords || [];
  const signalText = instructions.map(archetypeSignalText).join(" ");
  return cues.filter((cue) => signalText.includes(cue)).slice(0, 4);
}

function groupByParticipant(instructions: SecondOrderLabelInstruction[]) {
  const groups = new Map<string, SecondOrderLabelInstruction[]>();
  for (const instruction of instructions) {
    const participants = instruction.participants_involved?.length
      ? instruction.participants_involved
      : ["unknown participant"];
    for (const participant of participants) {
      const key = String(participant || "unknown participant");
      groups.set(key, [...(groups.get(key) || []), instruction]);
    }
  }
  return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

function normalizeAgentKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()[\]{}:;,.]/g, " ")
    .replace(/\s+/g, " ");
}

function isUnknownAgentLabel(value: unknown): boolean {
  const key = normalizeAgentKey(value);
  return (
    !key ||
    key === "unknown" ||
    key === "unknown speaker" ||
    key === "unknown participant" ||
    /^unknown\b/.test(key) ||
    /^speaker\s*\d+$/.test(key)
  );
}

function narrativeAgentProfileAliases(profile: NarrativeAgentProfile): string[] {
  return [
    profile.narrative_agent_name,
    ...(profile.aliases || []),
    profile.attached_performer_metadata?.actor_name,
    ...(profile.source_metadata?.role_labels || []),
  ]
    .map(normalizeAgentKey)
    .filter(Boolean);
}

function profileMatchesParticipant(profile: NarrativeAgentProfile, participant: string): boolean {
  const participantKey = normalizeAgentKey(participant);
  if (!participantKey) return false;
  return narrativeAgentProfileAliases(profile).some(
    (alias) =>
      alias === participantKey ||
      participantKey.includes(alias) ||
      alias.includes(participantKey),
  );
}

function formatNarrativeAgentProfileBrief(profile: NarrativeAgentProfile): string {
  const name = String(profile.narrative_agent_name || "").trim();
  const performer = String(profile.attached_performer_metadata?.actor_name || "").trim();
  const labels = (profile.source_metadata?.role_labels || []).filter(Boolean).slice(0, 3).join(", ");
  const head = performer ? `${name || "Narrative agent"} (${performer})` : name || "Narrative agent";
  return [head, labels].filter(Boolean).join(" / ");
}

function formatAgentGovernanceLabel(row: CharacterSceneGovernanceRow): string {
  return row.profile ? formatNarrativeAgentProfileBrief(row.profile) : row.label;
}

function narrativeAgentProfileKey(profile: NarrativeAgentProfile, index = 0): string {
  return String(
    profile.profile_id ||
      profile.narrative_agent_name ||
      profile.attached_performer_metadata?.actor_name ||
      `profile-${index}`,
  );
}

function parseRoleLineToProfile(roleLine: string, index: number): NarrativeAgentProfile | null {
  const raw = String(roleLine || "").trim();
  if (!raw) return null;
  const [head, ...descriptionParts] = raw.split(":");
  const description = descriptionParts.join(":").trim();
  const performerMatch = head.match(/^(.*?)\s*\((.*?)\)\s*$/);
  const name = (performerMatch?.[1] || head).trim();
  const performer = (performerMatch?.[2] || "").trim();
  if (isUnknownAgentLabel(name)) return null;
  return {
    profile_id: `metadata-role:${normalizeAgentKey(name) || index}`,
    profile_type: "narrative_agent_profile",
    narrative_agent_name: name,
    aliases: [],
    attached_performer_metadata: performer
      ? { actor_name: performer, boundary: "attached metadata, not a natural-person profile" }
      : undefined,
    source_metadata: {
      role_labels: [],
      role_description: description,
      source_preference: "source_media_metadata.user_annotations.character_roles",
    },
    evidence_slots: {
      scene_links: [],
      meaning_plot_refs: [],
    },
  } as NarrativeAgentProfile;
}

function sourceMetadataNarrativeAgentProfiles(
  metadata: SourceMediaMetadata | undefined,
): NarrativeAgentProfile[] {
  const annotations = metadata?.user_annotations;
  if (!annotations) return [];
  const profiles = (annotations.narrative_agent_profiles || []).filter(
    (profile) =>
      !(
        isUnknownAgentLabel(profile.narrative_agent_name) &&
        isUnknownAgentLabel(profile.attached_performer_metadata?.actor_name)
      ),
  );

  for (const [index, definition] of (annotations.character_definitions || []).entries()) {
    const name = String(definition.character_name || "").trim();
    if (isUnknownAgentLabel(name)) continue;
    profiles.push({
      profile_id: `metadata-definition:${normalizeAgentKey(name) || index}`,
      profile_type: "narrative_agent_profile",
      narrative_agent_name: name,
      aliases: definition.aliases || [],
      attached_performer_metadata: definition.actor_name
        ? {
            actor_name: definition.actor_name,
            boundary: "attached metadata, not a natural-person profile",
          }
        : undefined,
      source_metadata: {
        role_labels: definition.role_labels || [],
        role_description: definition.role_description,
        relations: definition.relations || [],
        source_url: definition.source_url,
        source_preference:
          definition.source_preference || "source_media_metadata.user_annotations.character_definitions",
      },
      evidence_slots: {
        scene_links: [],
        meaning_plot_refs: [],
      },
    } as NarrativeAgentProfile);
  }

  for (const [index, roleLine] of (annotations.character_roles || []).entries()) {
    const profile = parseRoleLineToProfile(roleLine, index);
    if (profile) profiles.push(profile);
  }

  const seen = new Set<string>();
  return profiles.filter((profile, index) => {
    const key = normalizeAgentKey(
      profile.narrative_agent_name ||
        profile.attached_performer_metadata?.actor_name ||
        profile.profile_id ||
        index,
    );
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function masterSchemaRecordNarrativeAgentProfile(
  record: MasterSchemaResolvedEvidenceRecord,
  index: number,
): NarrativeAgentProfile | null {
  const metadata = (record.metadata || {}) as Record<string, any>;
  if (record.category === "narrative_agent_profile") {
    const name = String(metadata.narrative_agent_name || metadata.character_name || record.label || "").trim();
    if (isUnknownAgentLabel(name)) return null;
    return {
      profile_id: String(metadata.profile_id || record.targetId || record.id || `master-schema-agent-${index}`),
      profile_type: "narrative_agent_profile",
      narrative_agent_name: name,
      aliases: Array.isArray(metadata.aliases) ? metadata.aliases : [],
      attached_performer_metadata: metadata.attached_performer_metadata || metadata.actor_name
        ? {
            ...(typeof metadata.attached_performer_metadata === "object"
              ? metadata.attached_performer_metadata
              : {}),
            actor_name:
              metadata.attached_performer_metadata?.actor_name ||
              metadata.actor_name ||
              undefined,
            boundary:
              metadata.attached_performer_metadata?.boundary ||
              "attached metadata, not a natural-person profile",
          }
        : undefined,
      source_metadata: metadata.source_metadata || {
        role_labels: Array.isArray(metadata.role_labels) ? metadata.role_labels : [],
        role_description: metadata.role_description,
        relations: Array.isArray(metadata.relations) ? metadata.relations : [],
        source_preference: "master_schema",
      },
      evidence_slots: metadata.evidence_slots || {
        scene_links: [],
        meaning_plot_refs: [],
      },
      dramaturgical_tendencies: Array.isArray(metadata.dramaturgical_tendencies)
        ? metadata.dramaturgical_tendencies
        : [],
      interpretive_readings: Array.isArray(metadata.interpretive_readings)
        ? metadata.interpretive_readings
        : [],
      profile_extensions: Array.isArray(metadata.profile_extensions)
        ? metadata.profile_extensions
        : [],
    } as NarrativeAgentProfile;
  }
  if (record.category === "character_role") {
    return parseRoleLineToProfile(record.label, index);
  }
  return null;
}

function masterSchemaNarrativeAgentProfiles(
  records: MasterSchemaResolvedEvidenceRecord[] | undefined,
): NarrativeAgentProfile[] {
  const profiles = (records || [])
    .map(masterSchemaRecordNarrativeAgentProfile)
    .filter((profile): profile is NarrativeAgentProfile => Boolean(profile));
  const seen = new Set<string>();
  return profiles.filter((profile, index) => {
    const key = normalizeAgentKey(
      profile.narrative_agent_name ||
        profile.attached_performer_metadata?.actor_name ||
        profile.profile_id ||
        index,
    );
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeNarrativeAgentProfilesByMaturity(
  masterProfiles: NarrativeAgentProfile[],
  sourceProfiles: NarrativeAgentProfile[],
  sceneCardProfiles: NarrativeAgentProfile[],
): NarrativeAgentProfile[] {
  const merged: NarrativeAgentProfile[] = [];
  const seen = new Set<string>();
  for (const profile of [...masterProfiles, ...sourceProfiles, ...sceneCardProfiles]) {
    const key = normalizeAgentKey(
      profile.narrative_agent_name ||
        profile.attached_performer_metadata?.actor_name ||
        profile.profile_id,
    );
    if (!key || isUnknownAgentLabel(key) || seen.has(key)) continue;
    seen.add(key);
    merged.push(profile);
  }
  return merged;
}

function sceneCardsFromAnalysisData(analysisData: AnalysisData | null): MeaningSceneCard[] {
  const candidates = [
    (analysisData as any)?.rawJson?.mise_en_scene_scene_cards,
    (analysisData as any)?.status?.mise_en_scene_scene_cards,
    (analysisData as any)?.mise_en_scene_scene_cards,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const cards =
      (candidate as any).scene_cards ||
      (candidate as any).cards ||
      (candidate as any).scenes ||
      (candidate as any).items;
    if (Array.isArray(cards)) {
      return cards as MeaningSceneCard[];
    }
  }
  return [];
}

function sceneCardNarrativeAgentProfiles(cards: MeaningSceneCard[]): NarrativeAgentProfile[] {
  const stop = new Set([
    "Scene",
    "Card",
    "This",
    "The",
    "Mise",
    "Evidence",
    "Speaker",
    "Master",
    "Schema",
    "Meaning",
    "Plot",
    "Action",
    "Situation",
    "Role",
    "Interaction",
    "Universal",
  ]);
  const found = new Map<string, NarrativeAgentProfile>();
  const addName = (value: unknown, source: string) => {
    const raw = String(value || "").trim();
    if (!raw || /^unknown/i.test(raw) || /^speaker\s*\d+$/i.test(raw)) return;
    const names = raw.match(/\b(?:007|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) || [];
    for (const name of names) {
      if (stop.has(name) || name.length < 3) continue;
      const key = normalizeAgentKey(name);
      if (!key || found.has(key)) continue;
      found.set(key, {
        profile_id: `scene-card-agent:${key}`,
        profile_type: "narrative_agent_profile",
        narrative_agent_name: name,
        aliases: [],
        source_metadata: {
          role_labels: [],
          role_description: `Surfaced from ${source}. Needs analyst confirmation if metadata/Master Schema later disagrees.`,
          source_preference: "scene_cards_fallback",
        },
        evidence_slots: {
          scene_links: [],
          meaning_plot_refs: [],
        },
      } as NarrativeAgentProfile);
    }
  };
  for (const card of cards) {
    addName(card.overview, "Scene Cards overview");
    addName(card.nlp_scene_summary_sentence, "Scene Cards summary");
    for (const text of [
      ...Object.values(card.prose_sections || {}),
      ...Object.values(card.interrogative_schema || {}),
      ...Object.values(card.mise_en_scene_description || {}),
      ...Object.values(card.nlp_scene_summary?.description || {}),
      ...Object.values(card.nlp_scene_summary?.interrogative_schema || {}),
      ...Object.values(card.nlp_scene_summary?.prose_sections || {}),
    ]) {
      addName(text, "Scene Cards prose");
    }
    for (const speech of card.said_in_scene || []) {
      addName(speech.speaker, "Scene Cards speech");
      addName(speech.text, "Scene Cards speech");
    }
    for (const item of [...(card.items || []), ...(card.resolved_items || [])]) {
      if (["identification", "person", "character", "role"].includes(String(item.category || "").toLowerCase())) {
        addName(item.label || item.symbol, "Scene Cards evidence item");
      }
    }
  }
  return [...found.values()];
}

function sceneConstellationGovernanceFromMaster(
  records: MasterSchemaResolvedEvidenceRecord[] | undefined,
  analysisData: AnalysisData | null,
): { layers: SceneConstellationLayer[]; attendeeRule?: string } {
  const raw = (analysisData as any)?.rawJson?.vaa1_annotation_master_schema ||
    (analysisData as any)?.status?.vaa1_annotation_master_schema;
  const governance = raw?.scene_constellation_governance;
  if (governance && typeof governance === "object") {
    return {
      layers: Array.isArray(governance.layers) ? governance.layers : [],
      attendeeRule: governance.attendee_boundary_rule?.principle,
    };
  }
  return {
    layers: [
      {
        layer_id: "master_schema_narrative_agents",
        label: "Master Schema Narrative Agent Profiles",
        count: (records || []).filter((record) => record.category === "narrative_agent_profile").length,
        authority: "Master Schema",
        source: "masterSchemaResolvedEvidence.records",
        status: records?.length ? "available" : "pending",
      },
    ],
  };
}

function narrativeAgentProfileEvidenceChips(profile: NarrativeAgentProfile): string[] {
  const slots = profile.evidence_slots || {};
  return [
    [slots.lines, "lines"],
    [slots.audio_samples, "audio"],
    [slots.visual_patterns, "visual"],
    [slots.identification_refs, "ID"],
    [slots.scene_links, "scene"],
    [slots.meaning_plot_refs, "meaning/plot"],
  ]
    .filter(([items]) => Array.isArray(items) && items.length > 0)
    .map(([items, label]) => `${label} ${Array.isArray(items) ? items.length : ""}`.trim());
}

function instructionOverlapsScene(
  instruction: SecondOrderLabelInstruction,
  scene: MeaningSceneSegment,
): boolean {
  const start = secondsFromInstruction(instruction);
  const end = endSecondsFromInstruction(instruction);
  return start <= scene.end && end >= scene.start;
}

function fallbackSceneSegmentsFromInstructions(
  instructions: SecondOrderLabelInstruction[],
): MeaningSceneSegment[] {
  const ranges = instructions
    .map((instruction) => {
      const start = secondsFromInstruction(instruction);
      const end = Math.max(endSecondsFromInstruction(instruction), start + 0.5);
      return { start, end };
    })
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end))
    .sort((left, right) => left.start - right.start);

  if (ranges.length === 0) {
    return [];
  }

  const windowSeconds = 24;
  const firstStart = Math.max(0, Math.floor(ranges[0].start / windowSeconds) * windowSeconds);
  const lastEnd = Math.max(...ranges.map((range) => range.end), firstStart + windowSeconds);
  const segments: MeaningSceneSegment[] = [];

  for (let start = firstStart; start <= lastEnd; start += windowSeconds) {
    const end = Math.min(start + windowSeconds, Math.max(lastEnd, start + 1));
    segments.push({
      scene_index: segments.length + 1,
      start,
      end,
      duration: end - start,
    });
  }

  return segments;
}

function lineMatchesProfile(
  line: TranscriptSegment,
  profile: NarrativeAgentProfile,
  sourceMetadata: SourceMediaMetadata | undefined,
): boolean {
  const aliases = narrativeAgentProfileAliases(profile);
  const speakerKey = normalizeAgentKey(line.speaker);
  const referenceSpeakers =
    sourceMetadata?.user_annotations?.reference_speakers?.filter((speaker: any) =>
      aliases.some((alias) =>
        normalizeAgentKey(speaker?.identity_label || speaker?.name).includes(alias),
      ),
    ) || [];
  const speakerAliases = [
    ...aliases,
    ...referenceSpeakers.map((speaker: any) => normalizeAgentKey(speaker?.speaker_label)),
  ].filter(Boolean);
  if (speakerAliases.some((alias) => alias === speakerKey || speakerKey.includes(alias))) {
    return true;
  }
  const textKey = normalizeAgentKey(line.text);
  return aliases.some((alias) => textKey.includes(alias));
}

function manualAnnotationStart(annotation: Record<string, any>): number {
  return Number(annotation.start_seconds ?? annotation.timestamp_seconds ?? 0);
}

function manualAnnotationEnd(annotation: Record<string, any>): number {
  const start = manualAnnotationStart(annotation);
  const end = Number(annotation.end_seconds ?? annotation.timestamp_seconds ?? start);
  return Number.isFinite(end) ? Math.max(start, end) : start;
}

function manualAnnotationMatchesProfile(
  annotation: Record<string, any>,
  profile: NarrativeAgentProfile,
): boolean {
  const aliases = narrativeAgentProfileAliases(profile);
  if (aliases.length === 0) return false;
  const annotationKeys = [
    annotation.identity_affirmation,
    annotation.role_affirmation,
    annotation.custom_label,
    annotation.label,
  ]
    .map(normalizeAgentKey)
    .filter((key) => key && !isUnknownAgentLabel(key));
  return annotationKeys.some((annotationKey) =>
    aliases.some(
      (alias) =>
        annotationKey === alias ||
        annotationKey.includes(alias) ||
        alias.includes(annotationKey),
    ),
  );
}

function manualAnnotationsForProfileInScene(
  annotations: unknown[] | undefined,
  profile: NarrativeAgentProfile,
  scene: MeaningSceneSegment,
): Array<Record<string, any>> {
  return (annotations || [])
    .filter((annotation): annotation is Record<string, any> =>
      Boolean(annotation && typeof annotation === "object"),
    )
    .filter((annotation) =>
      Boolean(annotation.identity_affirmation || annotation.role_affirmation),
    )
    .filter((annotation) =>
      manualAnnotationStart(annotation) <= scene.end &&
      manualAnnotationEnd(annotation) >= scene.start,
    )
    .filter((annotation) => manualAnnotationMatchesProfile(annotation, profile));
}

function intervalOverlaps(start: unknown, end: unknown, scene: MeaningSceneSegment): boolean {
  const startNumber = Number(start ?? 0);
  const endNumber = Number(end ?? startNumber);
  if (!Number.isFinite(startNumber)) return false;
  const safeEnd = Number.isFinite(endNumber) ? Math.max(startNumber, endNumber) : startNumber;
  return startNumber <= scene.end && safeEnd >= scene.start;
}

function audioProsodyForProfileInScene(
  cues: unknown[] | undefined,
  profile: NarrativeAgentProfile,
  scene: MeaningSceneSegment,
  transcript: TranscriptSegment[],
  sourceMetadata: SourceMediaMetadata | undefined,
): Array<Record<string, any>> {
  const aliases = narrativeAgentProfileAliases(profile);
  if (aliases.length === 0) return [];
  const matchedLines = transcript
    .filter((line) => line.start <= scene.end && line.end >= scene.start)
    .filter((line) => lineMatchesProfile(line, profile, sourceMetadata));
  return (cues || [])
    .filter((cue): cue is Record<string, any> => Boolean(cue && typeof cue === "object"))
    .filter((cue) => intervalOverlaps(cue.start, cue.end, scene))
    .filter((cue) => {
      const cueText = normalizeAgentKey(cue.text);
      const textMatch = aliases.some((alias) => cueText.includes(alias));
      const lineMatch = matchedLines.some((line) =>
        intervalOverlaps(cue.start, cue.end, {
          scene_index: scene.scene_index,
          start: line.start,
          end: line.end,
        }),
      );
      return textMatch || lineMatch;
    });
}

function sourceSamplesForProfileInScene(
  samples: unknown[] | undefined,
  profile: NarrativeAgentProfile,
  scene: MeaningSceneSegment,
  manualAnnotations: Array<Record<string, any>>,
): Array<Record<string, any>> {
  const aliases = narrativeAgentProfileAliases(profile);
  if (aliases.length === 0) return [];
  return (samples || [])
    .filter((sample): sample is Record<string, any> => Boolean(sample && typeof sample === "object"))
    .filter((sample) => intervalOverlaps(sample.time_start, sample.time_end, scene))
    .filter((sample) => {
      const text = normalizeAgentKey([sample.label, sample.purpose, sample.sample_type].filter(Boolean).join(" "));
      const labelMatch = aliases.some((alias) => text.includes(alias));
      const manualOverlap = manualAnnotations.some((annotation) =>
        intervalOverlaps(sample.time_start, sample.time_end, {
          scene_index: scene.scene_index,
          start: manualAnnotationStart(annotation),
          end: manualAnnotationEnd(annotation),
        }),
      );
      return labelMatch || manualOverlap;
    });
}

function expressionLabel(sample: ExpressionSample): string {
  return String(
    sample.interpreted_expression?.label ||
      sample.dominant_emotion ||
      sample.rawDominantEmotion ||
      "expression",
  );
}

function expressionSamplesForSceneAgent(
  expressions: ExpressionSample[],
  scene: MeaningSceneSegment,
  agentInstructions: SecondOrderLabelInstruction[],
): ExpressionSample[] {
  const sceneExpressions = expressions.filter(
    (sample) => sample.timestamp >= scene.start && sample.timestamp <= scene.end,
  );
  if (agentInstructions.length === 0) {
    return sceneExpressions.slice(0, 2);
  }
  return sceneExpressions
    .filter((sample) =>
      agentInstructions.some((instruction) => {
        const start = secondsFromInstruction(instruction);
        const end = endSecondsFromInstruction(instruction);
        return sample.timestamp >= start - 1.5 && sample.timestamp <= end + 1.5;
      }),
    )
    .slice(0, 3);
}

function agentPersistenceInstructionsForParticipant(
  instructions: SecondOrderLabelInstruction[],
  participant: string,
): SecondOrderLabelInstruction[] {
  const participantKey = normalizeAgentKey(participant);
  return instructions.filter((instruction) => {
    if (instruction.source_feature_type !== "agent_persistence_scene_cut") {
      return false;
    }
    const payload = (instruction.source_feature_payload || {}) as Record<string, unknown>;
    const values = [
      payload.agent_label,
      payload.old_track_id,
      payload.new_track_id,
      ...(instruction.participants_involved || []),
    ].map(normalizeAgentKey);
    return values.some(
      (value) =>
        value &&
        (value === participantKey || value.includes(participantKey) || participantKey.includes(value)),
    );
  });
}

function participantTopArchetypes(
  instructions: SecondOrderLabelInstruction[],
): Array<{ lens: (typeof DRAMATIC_ARCHETYPE_LENSES)[number]; score: number }> {
  return DRAMATIC_ARCHETYPE_LENSES.map((lens) => ({
    lens,
    score: archetypeScore(instructions, lens.id),
  }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function sortParticipantGroupsByArchetype(
  groups: Array<[string, SecondOrderLabelInstruction[]]>,
  lens: DramaticArchetypeLens,
): Array<[string, SecondOrderLabelInstruction[]]> {
  return [...groups].sort((left, right) => {
    const scoreDelta = archetypeScore(right[1], lens) - archetypeScore(left[1], lens);
    if (scoreDelta !== 0) return scoreDelta;
    return left[0].localeCompare(right[0]);
  });
}

function buildParticipantGroupsWithMetadataProfiles(
  instructions: SecondOrderLabelInstruction[],
  profiles: NarrativeAgentProfile[],
): Array<[string, SecondOrderLabelInstruction[]]> {
  const groups = new Map<string, SecondOrderLabelInstruction[]>();
  groupByParticipant(instructions).forEach(([participant, items]) => {
    if (isUnknownAgentLabel(participant)) return;
    groups.set(participant, items);
  });
  profiles.forEach((profile, index) => {
    const label = String(
      profile.narrative_agent_name ||
        profile.attached_performer_metadata?.actor_name ||
        `Narrative agent ${index + 1}`,
    ).trim();
    if (isUnknownAgentLabel(label)) return;
    if (!groups.has(label)) {
      groups.set(label, []);
    }
  });
  return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

function formatAuditLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function MeaningPlotConfirmationStrip({ analysisData }: { analysisData: AnalysisData | null }) {
  const audit = analysisData?.metadata?.masterSchemaMaturityAudit;
  const program = audit?.confirmation_program;
  const anchor = audit?.user_confirmed_anchor;
  const families = (program?.confirmation_families || []).filter((family) =>
    [
      "narrative_structure_meaning_plot_confirmation",
      "mise_en_scene_level_understanding",
      "character_audio_trail_recognition",
      "character_visual_pattern_recognition",
    ].includes(family),
  );
  if (!program && !anchor) return null;
  return (
    <section className="mb-3 rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Anchor-Aware Meaning Confirmation
          </div>
          <div className="mt-0.5 max-w-3xl text-[10px] text-slate-500">
            Meaning and plot candidates should consult user-confirmed corrections before wider
            proliferation.
          </div>
        </div>
        <span className="shrink-0 rounded border border-cyan-700/60 bg-[#101010] px-2 py-1 text-[10px] text-cyan-100">
          {program?.consults_user_confirmed_anchor ? "Anchor consulted" : "Anchor pending"}
        </span>
      </div>
      {families.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {families.map((family) => (
            <span
              key={family}
              className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-200"
            >
              {formatAuditLabel(family)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

interface InstructionItemProps {
  instruction: SecondOrderLabelInstruction;
  activeLens: PlotLens;
  showLens?: boolean;
  onNavigate: (instruction: SecondOrderLabelInstruction) => void;
}

const InstructionItem = React.memo(function InstructionItem({
  instruction,
  activeLens,
  showLens,
  onNavigate,
}: InstructionItemProps) {
  const start = secondsFromInstruction(instruction);
  const end = endSecondsFromInstruction(instruction);
  const lensTerms = showLens ? plotLensTerms(instruction, activeLens) : [];

  const displayLabel = showLens && lensTerms.length > 0
    ? `${instruction.target_label_family} / ${lensTerms[0].replaceAll("_", " ")}`
    : instructionLabel(instruction);

  return (
    <button
      type="button"
      onClick={() => onNavigate(instruction)}
      className="w-full rounded border border-slate-800 bg-[#101010] px-2.5 py-2 text-left hover:border-cyan-700/60 hover:bg-cyan-950/10"
      title={`Jump to source ${formatTime(start)}. Traceback: ${sourceRefSummary(instruction)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] text-slate-100">{displayLabel}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {formatTime(start)}-{formatTime(end)} • {instruction.status} • {sourceRefSummary(instruction)}
          </div>
        </div>
        <div className="shrink-0 text-[10px] text-cyan-200">
          {supportLabel(instruction)}
        </div>
      </div>
      {lensTerms.length ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {lensTerms.slice(0, 4).map((term) => (
            <span
              key={`${instruction.instruction_id}:${activeLens}:${term}`}
              className="rounded border border-cyan-800/50 bg-cyan-950/25 px-1.5 py-0.5 text-[10px] text-cyan-100"
            >
              {term.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
});

export default function MeaningPlotPanel({ videoId: initialVideoId = "" }: { videoId?: string }) {
  const [selectedVideoId, setSelectedVideoId] = useState(initialVideoId);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLens, setActiveLens] = useState<PlotLens>("freytag");
  const [activeArchetypeLens, setActiveArchetypeLens] =
    useState<DramaticArchetypeLens>("shakespearean_performativity");
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [stagedSceneAgents, setStagedSceneAgents] = useState<Record<string, string[]>>({});
  const [openCharacterSceneProfiles, setOpenCharacterSceneProfiles] = useState<Record<string, boolean>>({});
  const [governedSourceMetadata, setGovernedSourceMetadata] = useState<SourceMediaMetadata | null>(null);

  useEffect(() => {
    const handler = (id: string) => setSelectedVideoId(id);
    eventBus.on("videoIdChanged", handler);
    return () => eventBus.off("videoIdChanged", handler);
  }, []);

  useEffect(() => {
    if (!selectedVideoId) {
      setAnalysisData(null);
      setGovernedSourceMetadata(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      VideoService.refreshAnalysis(selectedVideoId),
      apiService.getSourceMediaMetadata(selectedVideoId).catch(() => null),
    ])
      .then(([data, sourceMetadata]) => {
        if (!cancelled) {
          setAnalysisData(data);
          setGovernedSourceMetadata(sourceMetadata);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysisData(null);
          setGovernedSourceMetadata(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVideoId]);

  useEffect(() => {
    const metadataHandler = (id: string) => {
      if (!selectedVideoId || id !== selectedVideoId) {
        return;
      }
      apiService
        .getSourceMediaMetadata(selectedVideoId)
        .then((metadata) => {
          setGovernedSourceMetadata(metadata);
          return VideoService.refreshAnalysis(selectedVideoId);
        })
        .then((data) => setAnalysisData(data))
        .catch(() => {});
    };
    eventBus.on("sourceMediaMetadataChanged", metadataHandler);
    return () => eventBus.off("sourceMediaMetadataChanged", metadataHandler);
  }, [selectedVideoId]);

  const instructions = analysisData?.secondOrderLabelProliferation?.instructions || [];
  const sceneConstellationGovernance = useMemo(
    () =>
      sceneConstellationGovernanceFromMaster(
        analysisData?.masterSchemaResolvedEvidence?.records,
        analysisData,
      ),
    [analysisData],
  );
  const sourceMediaMetadata = governedSourceMetadata || analysisData?.metadata?.sourceMediaMetadata;
  const masterNarrativeAgentProfiles = useMemo(
    () => masterSchemaNarrativeAgentProfiles(analysisData?.masterSchemaResolvedEvidence?.records),
    [analysisData?.masterSchemaResolvedEvidence?.records],
  );
  const sourceNarrativeAgentProfiles = useMemo(
    () => sourceMetadataNarrativeAgentProfiles(sourceMediaMetadata),
    [sourceMediaMetadata],
  );
  const sceneCardProfiles = useMemo(
    () => sceneCardNarrativeAgentProfiles(sceneCardsFromAnalysisData(analysisData)),
    [analysisData],
  );
  const narrativeAgentProfiles = useMemo(
    () =>
      mergeNarrativeAgentProfilesByMaturity(
        masterNarrativeAgentProfiles,
        sourceNarrativeAgentProfiles,
        sceneCardProfiles,
      ),
    [masterNarrativeAgentProfiles, sceneCardProfiles, sourceNarrativeAgentProfiles],
  );
  const hasMeaningPlotSurface = instructions.length > 0 || narrativeAgentProfiles.length > 0;
  const sourceSceneSegments = useMemo(
    () => matureSceneSegmentsFromAnalysis(analysisData),
    [analysisData],
  );
  const sceneSegmentSourceLabel = matureSceneSegmentSourceLabel(analysisData);
  const sceneSegments = useMemo(
    () => {
      if (sourceSceneSegments.length) {
        return sourceSceneSegments;
      }
      const derived = fallbackSceneSegmentsFromInstructions(instructions);
      if (derived.length) {
        return derived;
      }
      if (narrativeAgentProfiles.length) {
        const duration = Number(sourceMediaMetadata?.duration_seconds || 0);
        return [{
          scene_index: 1,
          start: 0,
          end: Number.isFinite(duration) && duration > 0 ? duration : 1,
          duration: Number.isFinite(duration) && duration > 0 ? duration : 1,
        }];
      }
      return [];
    },
    [instructions, narrativeAgentProfiles.length, sourceMediaMetadata?.duration_seconds, sourceSceneSegments],
  );
  const sceneSegmentsAreDerived = sourceSceneSegments.length === 0 && sceneSegments.length > 0;
  const activeScene = sceneSegments[activeSceneIndex] || sceneSegments[0];
  const activeSceneKey = activeScene
    ? String(activeScene.scene_index ?? activeSceneIndex + 1)
    : "scene-1";
  const plotInstructions = useMemo(
    () =>
      instructions
        .filter((instruction) => PLOT_FAMILIES.has(instruction.target_label_family))
        .filter((instruction) => plotLensTerms(instruction, activeLens).length > 0)
        .sort((left, right) => secondsFromInstruction(left) - secondsFromInstruction(right)),
    [instructions, activeLens],
  );

  useEffect(() => {
    if (sceneSegments.length === 0) {
      setActiveSceneIndex(0);
      return;
    }
    if (activeSceneIndex >= sceneSegments.length) {
      setActiveSceneIndex(sceneSegments.length - 1);
    }
  }, [activeSceneIndex, sceneSegments.length]);
  const characterInstructions = useMemo(
    () =>
      instructions
        .filter((instruction) => CHARACTER_FAMILIES.has(instruction.target_label_family))
        .filter((instruction) => plotLensTerms(instruction, activeLens).length > 0)
        .sort((left, right) => supportScore(right) - supportScore(left)),
    [instructions, activeLens],
  );

  const navigateToInstruction = useCallback((instruction: SecondOrderLabelInstruction) => {
    if (!selectedVideoId) {
      return;
    }
    openVideoAtTime(selectedVideoId, secondsFromInstruction(instruction));
  }, [selectedVideoId]);

  const participantGroups = useMemo(
    () =>
      sortParticipantGroupsByArchetype(
        buildParticipantGroupsWithMetadataProfiles(characterInstructions, narrativeAgentProfiles),
        activeArchetypeLens,
      ),
    [characterInstructions, narrativeAgentProfiles, activeArchetypeLens],
  );
  const activeArchetype = DRAMATIC_ARCHETYPE_LENSES.find(
    (lens) => lens.id === activeArchetypeLens,
  ) || DRAMATIC_ARCHETYPE_LENSES[0];
  const activeArchetypeMatches = archetypeMatches(characterInstructions, activeArchetypeLens);
  const strongestArchetypeParticipant = participantGroups.find(
    ([, items]) => archetypeScore(items, activeArchetypeLens) > 0,
  );
  const sceneAgentRows = useMemo(() => {
    if (!activeScene) return [];
    return narrativeAgentProfiles.map((profile, index) => {
      const profileKey = narrativeAgentProfileKey(profile, index);
      const aliases = narrativeAgentProfileAliases(profile);
      const sceneInstructions = instructions.filter(
        (instruction) =>
          instructionOverlapsScene(instruction, activeScene) &&
          (instruction.participants_involved || []).some((participant) =>
            aliases.some((alias) => {
              const participantKey = normalizeAgentKey(participant);
              return participantKey === alias || participantKey.includes(alias) || alias.includes(participantKey);
            }),
          ),
      );
      const persistenceSignals = agentPersistenceInstructionsForParticipant(
        instructions.filter((instruction) => instructionOverlapsScene(instruction, activeScene)),
        profile.narrative_agent_name || profile.attached_performer_metadata?.actor_name || profileKey,
      );
      const lines = (analysisData?.transcriptTimeline || analysisData?.transcript || [])
        .filter((line) => line.start <= activeScene.end && line.end >= activeScene.start)
        .filter((line) => lineMatchesProfile(line, profile, sourceMediaMetadata))
        .slice(0, 4);
      const manualAnnotations = manualAnnotationsForProfileInScene(
        analysisData?.annotations,
        profile,
        activeScene,
      ).slice(0, 6);
      const audioProsody = audioProsodyForProfileInScene(
        analysisData?.audioProsody,
        profile,
        activeScene,
        analysisData?.transcriptTimeline || analysisData?.transcript || [],
        sourceMediaMetadata,
      ).slice(0, 4);
      const sourceSamples = sourceSamplesForProfileInScene(
        analysisData?.sourceSamples,
        profile,
        activeScene,
        manualAnnotations,
      ).slice(0, 4);
      const expressions = expressionSamplesForSceneAgent(
        analysisData?.expressionResults || [],
        activeScene,
        sceneInstructions,
      );
      const staged = (stagedSceneAgents[activeSceneKey] || []).includes(profileKey);
      const present =
        sceneInstructions.length > 0 ||
        persistenceSignals.length > 0 ||
        lines.length > 0 ||
        manualAnnotations.length > 0 ||
        audioProsody.length > 0 ||
        sourceSamples.length > 0;
      return {
        profile,
        profileKey,
        status: staged ? "staged" : present ? "surfaced" : "not surfaced",
        sceneInstructions,
        persistenceSignals,
        lines,
        manualAnnotations,
        audioProsody,
        sourceSamples,
        expressions,
      };
    });
  }, [
    analysisData?.annotations,
    analysisData?.audioProsody,
    activeScene,
    activeSceneKey,
    analysisData?.expressionResults,
    analysisData?.sourceSamples,
    analysisData?.transcript,
    analysisData?.transcriptTimeline,
    instructions,
    narrativeAgentProfiles,
    sourceMediaMetadata,
    stagedSceneAgents,
  ]);

  const addProfileToScene = useCallback((profileKey: string) => {
    setStagedSceneAgents((current) => {
      const existing = current[activeSceneKey] || [];
      if (existing.includes(profileKey)) return current;
      return { ...current, [activeSceneKey]: [...existing, profileKey] };
    });
  }, [activeSceneKey]);

  const removeProfileFromScene = useCallback((profileKey: string) => {
    setStagedSceneAgents((current) => ({
      ...current,
      [activeSceneKey]: (current[activeSceneKey] || []).filter((item) => item !== profileKey),
    }));
  }, [activeSceneKey]);

  const toggleProfileSceneActivation = useCallback((sceneKey: string, profileKey: string) => {
    setStagedSceneAgents((current) => {
      const existing = current[sceneKey] || [];
      if (existing.includes(profileKey)) {
        return {
          ...current,
          [sceneKey]: existing.filter((item) => item !== profileKey),
        };
      }
      return {
        ...current,
        [sceneKey]: [...existing, profileKey],
      };
    });
  }, []);

  const characterSceneGovernanceRows = useMemo<CharacterSceneGovernanceRow[]>(() => {
    const rows: CharacterSceneGovernanceRow[] = narrativeAgentProfiles.map((profile, index) => {
      const profileKey = narrativeAgentProfileKey(profile, index);
      const aliases = narrativeAgentProfileAliases(profile);
      const scenes = sceneSegments.map((scene, sceneIndex) => {
        const sceneKey = String(scene.scene_index ?? sceneIndex + 1);
        const sceneInstructions = instructions.filter(
          (instruction) =>
            instructionOverlapsScene(instruction, scene) &&
            (instruction.participants_involved || []).some((participant) =>
              aliases.some((alias) => {
                const participantKey = normalizeAgentKey(participant);
                return participantKey === alias || participantKey.includes(alias) || alias.includes(participantKey);
              }),
            ),
        );
        const lines = (analysisData?.transcriptTimeline || analysisData?.transcript || [])
          .filter((line) => line.start <= scene.end && line.end >= scene.start)
          .filter((line) => lineMatchesProfile(line, profile, sourceMediaMetadata));
        const manualAnnotations = manualAnnotationsForProfileInScene(
          analysisData?.annotations,
          profile,
          scene,
        );
        const audioProsody = audioProsodyForProfileInScene(
          analysisData?.audioProsody,
          profile,
          scene,
          analysisData?.transcriptTimeline || analysisData?.transcript || [],
          sourceMediaMetadata,
        );
        const sourceSamples = sourceSamplesForProfileInScene(
          analysisData?.sourceSamples,
          profile,
          scene,
          manualAnnotations,
        );
        const persistenceSignals = agentPersistenceInstructionsForParticipant(
          instructions.filter((instruction) => instructionOverlapsScene(instruction, scene)),
          profile.narrative_agent_name || profile.attached_performer_metadata?.actor_name || profileKey,
        );
        const staged = (stagedSceneAgents[sceneKey] || []).includes(profileKey);
        const surfaced =
          sceneInstructions.length > 0 ||
          lines.length > 0 ||
          manualAnnotations.length > 0 ||
          audioProsody.length > 0 ||
          sourceSamples.length > 0 ||
          persistenceSignals.length > 0;
        return {
          scene,
          sceneIndex,
          sceneKey,
          staged,
          surfaced,
          sceneInstructions,
          lines,
          manualAnnotations,
          audioProsody,
          sourceSamples,
          persistenceSignals,
        };
      });
      return {
        label: formatNarrativeAgentProfileBrief(profile),
        profile,
        profileKey,
        scenes,
      };
    });
    const knownProfileAliases = new Set(
      narrativeAgentProfiles.flatMap((profile) => narrativeAgentProfileAliases(profile)),
    );
    const participantRows: CharacterSceneGovernanceRow[] = narrativeAgentProfiles.length
      ? []
      : participantGroups
      .filter(([participant]) => {
        const participantKey = normalizeAgentKey(participant);
        return (
          participantKey &&
          !isUnknownAgentLabel(participantKey) &&
          !knownProfileAliases.has(participantKey) &&
          !narrativeAgentProfiles.some((profile) => profileMatchesParticipant(profile, participant))
        );
      })
      .map(([participant]) => {
        const participantKey = normalizeAgentKey(participant);
        const profileKey = `participant:${participantKey || participant}`;
        const scenes = sceneSegments.map((scene, sceneIndex) => {
          const sceneKey = String(scene.scene_index ?? sceneIndex + 1);
          const sceneInstructions = instructions.filter(
            (instruction) =>
              instructionOverlapsScene(instruction, scene) &&
              (instruction.participants_involved || []).some((candidate) => {
                const candidateKey = normalizeAgentKey(candidate);
                return (
                  candidateKey === participantKey ||
                  candidateKey.includes(participantKey) ||
                  participantKey.includes(candidateKey)
                );
              }),
          );
          const lines = (analysisData?.transcriptTimeline || analysisData?.transcript || [])
            .filter((line) => line.start <= scene.end && line.end >= scene.start)
            .filter((line) => normalizeAgentKey(line.speaker).includes(participantKey));
          const manualAnnotations: Array<Record<string, any>> = [];
          const audioProsody: Array<Record<string, any>> = [];
          const sourceSamples: Array<Record<string, any>> = [];
          const persistenceSignals = agentPersistenceInstructionsForParticipant(
            instructions.filter((instruction) => instructionOverlapsScene(instruction, scene)),
            participant,
          );
          const staged = (stagedSceneAgents[sceneKey] || []).includes(profileKey);
          const surfaced = sceneInstructions.length > 0 || lines.length > 0 || persistenceSignals.length > 0;
          return {
            scene,
            sceneIndex,
            sceneKey,
            staged,
            surfaced,
            sceneInstructions,
            lines,
            manualAnnotations,
            audioProsody,
            sourceSamples,
            persistenceSignals,
          };
        });
        return {
          label: participant,
          profileKey,
          scenes,
        };
      });

    return [...rows, ...participantRows].sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [
    analysisData?.transcript,
    analysisData?.transcriptTimeline,
    analysisData?.annotations,
    analysisData?.audioProsody,
    analysisData?.sourceSamples,
    instructions,
    narrativeAgentProfiles,
    participantGroups,
    sceneSegments,
    sourceMediaMetadata,
    stagedSceneAgents,
  ]);

  const toggleCharacterSceneProfile = useCallback((profileKey: string) => {
    setOpenCharacterSceneProfiles((current) => ({
      ...current,
      [profileKey]: !current[profileKey],
    }));
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#161616] text-slate-100">
      <div className="border-b border-white/8 bg-[#141414] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Meaning / Plot
            </div>
            <div className="mt-1 truncate text-[11px] text-slate-500">
              Navigable second-order paths; every indication jumps to source evidence.
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            {instructions.length} candidates
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {PLOT_LENSES.map((lens) => (
            <button
              key={lens.id}
              type="button"
              onClick={() => setActiveLens(lens.id)}
              className={`rounded border px-2 py-1 text-[11px] ${
                activeLens === lens.id
                  ? "border-cyan-600/60 bg-cyan-950/35 text-cyan-100"
                  : "border-white/10 bg-[#101010] text-slate-400 hover:bg-white/5"
              }`}
            >
              {lens.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <MeaningPlotConfirmationStrip analysisData={analysisData} />
        {loading ? (
          <div className="grid h-full min-h-0 min-w-[980px] grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-3">
            <section className="flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]">
              <div className="border-b border-white/8 px-3 py-2">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-800"></div>
                <div className="mt-2 h-2 w-48 animate-pulse rounded bg-slate-800"></div>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={`plot-skel-${i}`} className="h-[52px] w-full animate-pulse rounded border border-slate-800 bg-[#101010] px-2.5 py-2">
                    <div className="h-3 w-1/2 rounded bg-slate-700/50"></div>
                    <div className="mt-2 h-2 w-1/3 rounded bg-slate-800"></div>
                  </div>
                ))}
              </div>
            </section>
            <section className="flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]">
              <div className="border-b border-white/8 px-3 py-2">
                <div className="h-3 w-32 animate-pulse rounded bg-slate-800"></div>
                <div className="mt-2 h-2 w-56 animate-pulse rounded bg-slate-800"></div>
              </div>
              <div className="flex-1 space-y-3 p-2">
                {[1, 2].map((i) => (
                  <div key={`char-skel-${i}`} className="rounded border border-slate-800 bg-[#101010]/60">
                    <div className="border-b border-slate-800 px-2.5 py-2">
                      <div className="h-2 w-20 animate-pulse rounded bg-slate-800"></div>
                    </div>
                    <div className="space-y-1.5 p-1.5">
                      {[1, 2, 3].map((j) => (
                        <div key={`char-skel-item-${j}`} className="h-[52px] w-full animate-pulse rounded border border-slate-800 bg-[#101010] px-2.5 py-2">
                          <div className="h-3 w-1/2 rounded bg-slate-700/50"></div>
                          <div className="mt-2 h-2 w-1/3 rounded bg-slate-800"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : !selectedVideoId ? (
          <div className="rounded border border-white/8 bg-[#121212] px-4 py-4 text-sm text-slate-400">
            Open an analysis to view meaning and plot paths.
          </div>
        ) : !hasMeaningPlotSurface ? (
          <div className="rounded border border-white/8 bg-[#121212] px-4 py-4 text-sm text-slate-400">
            No second-order meaning candidates surfaced for this analysis yet.
          </div>
        ) : (
          <div className="grid h-full min-h-0 min-w-[980px] grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-3 overflow-hidden">
            <section className="flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]">
              <div className="border-b border-white/8 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Plot Path
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {PLOT_LENSES.find((lens) => lens.id === activeLens)?.label} lens over shared source evidence
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
                {plotInstructions.length ? (
                  plotInstructions.map((instruction) => (
                    <InstructionItem
                      key={instruction.instruction_id}
                      instruction={instruction}
                      activeLens={activeLens}
                      showLens
                      onNavigate={navigateToInstruction}
                    />
                  ))
                ) : (
                  <div className="px-2 py-3 text-[12px] text-slate-500">
                    No plot-path candidates yet.
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]">
              <div className="border-b border-white/8 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Character Paths
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Care, power, role, relation, affect, and intensity candidates.
                </div>
                <div className="mt-2 rounded border border-cyan-900/40 bg-cyan-950/10 px-2 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                        Master Schema Scene Governance
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        Scene counts are layer-specific; Meaning / Plot uses governed layers, not an independent scene truth.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sceneConstellationGovernance.layers.slice(0, 4).map((layer) => (
                        <span
                          key={layer.layer_id || layer.label}
                          className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300"
                          title={`${layer.authority || "authority pending"} / ${layer.source || "source pending"}`}
                        >
                          {layer.label || layer.layer_id}: {layer.count ?? 0}
                        </span>
                      ))}
                    </div>
                  </div>
                  {sceneConstellationGovernance.attendeeRule ? (
                    <div className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      {sceneConstellationGovernance.attendeeRule}
                    </div>
                  ) : (
                    <div className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      Narrative-agent attendance, entry, exit, speech, expression, and sample-profile persistence are treated as scene-boundary evidence under Master Schema governance.
                    </div>
                  )}
                </div>
                {sceneSegments.length > 0 && (
                  <div className="mt-2 rounded border border-slate-800 bg-[#101010] px-2 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                          Scene Agent Browser
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          Browse Narrative Agent Profiles by scene, lines, expressions, and source links.
                          {sceneSegmentsAreDerived
                            ? " Derived from evidence windows until formal scene segments arrive."
                            : ` Source: ${sceneSegmentSourceLabel}.`}
                        </div>
                      </div>
                      {activeScene && (
                        <button
                          type="button"
                          onClick={() => openVideoAtTime(selectedVideoId, activeScene.start)}
                          className="rounded border border-cyan-700/50 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/30"
                        >
                          Jump {formatTime(activeScene.start)}
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sceneSegments.map((scene, index) => (
                        <button
                          key={`meaning-scene-${scene.scene_index ?? index}`}
                          type="button"
                          onClick={() => setActiveSceneIndex(index)}
                          className={`rounded border px-1.5 py-0.5 text-[10px] ${
                            activeSceneIndex === index
                              ? "border-cyan-600/60 bg-cyan-950/35 text-cyan-100"
                              : "border-slate-700 bg-[#121212] text-slate-400 hover:bg-white/5"
                          }`}
                        >
                          S{scene.scene_index ?? index + 1}
                        </button>
                      ))}
                    </div>
                    {activeScene && (
                      <div className="mt-2 max-h-52 space-y-1.5 overflow-auto pr-1">
                        {sceneAgentRows.length > 0 ? sceneAgentRows.map((row) => (
                          <div
                            key={`${activeSceneKey}:${row.profileKey}`}
                            className="rounded border border-slate-800 bg-[#121212] px-2 py-1.5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[10px] text-slate-100">
                                  {formatNarrativeAgentProfileBrief(row.profile)}
                                </div>
                                <div className="mt-0.5 text-[9px] text-slate-500">
                                  {row.status} / manual {row.manualAnnotations.length} / audio {row.audioProsody.length} / samples {row.sourceSamples.length} / cues {row.sceneInstructions.length} / lines {row.lines.length} / expressions {row.expressions.length}
                                </div>
                              </div>
                              {row.status === "not surfaced" ? (
                                <button
                                  type="button"
                                  onClick={() => addProfileToScene(row.profileKey)}
                                  className="rounded border border-cyan-700/60 px-1.5 py-0.5 text-[9px] text-cyan-100 hover:bg-cyan-950/30"
                                >
                                  Add to scene
                                </button>
                              ) : row.status === "staged" ? (
                                <button
                                  type="button"
                                  onClick={() => removeProfileFromScene(row.profileKey)}
                                  className="rounded border border-rose-700/60 px-1.5 py-0.5 text-[9px] text-rose-100 hover:bg-rose-950/30"
                                >
                                  Remove staged
                                </button>
                              ) : null}
                            </div>
                            {row.lines.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {row.lines.slice(0, 2).map((line) => (
                                  <button
                                    key={`${row.profileKey}:line:${line.start}:${line.text}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, line.start)}
                                    className="block w-full truncate rounded border border-slate-800 px-1.5 py-0.5 text-left text-[9px] text-slate-300 hover:border-cyan-800/60"
                                  >
                                    {formatTime(line.start)} {line.speaker}: {line.text}
                                  </button>
                                ))}
                              </div>
                            )}
                            {row.manualAnnotations.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.manualAnnotations.slice(0, 4).map((annotation) => (
                                  <button
                                    key={`${row.profileKey}:manual:${annotation.id || manualAnnotationStart(annotation)}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, manualAnnotationStart(annotation))}
                                    className="rounded border border-emerald-700/50 px-1.5 py-0.5 text-[9px] text-emerald-100 hover:bg-emerald-950/25"
                                    title="Jump to manual subject indication"
                                  >
                                    manual {formatTime(manualAnnotationStart(annotation))}
                                  </button>
                                ))}
                              </div>
                            )}
                            {(row.audioProsody.length > 0 || row.sourceSamples.length > 0) && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.audioProsody.slice(0, 3).map((cue) => (
                                  <button
                                    key={`${row.profileKey}:prosody:${cue.cue_id || cue.start}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, Number(cue.start || 0))}
                                    className="rounded border border-sky-700/50 px-1.5 py-0.5 text-[9px] text-sky-100 hover:bg-sky-950/25"
                                    title="Jump to linked audio prosody cue"
                                  >
                                    prosody {formatTime(Number(cue.start || 0))}
                                  </button>
                                ))}
                                {row.sourceSamples.slice(0, 3).map((sample) => (
                                  <button
                                    key={`${row.profileKey}:sample:${sample.sample_id || sample.time_start}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, Number(sample.time_start || 0))}
                                    className="rounded border border-amber-700/50 px-1.5 py-0.5 text-[9px] text-amber-100 hover:bg-amber-950/25"
                                    title="Jump to linked source sample"
                                  >
                                    {String(sample.sample_type || "sample").replaceAll("_", "+")} {formatTime(Number(sample.time_start || 0))}
                                  </button>
                                ))}
                              </div>
                            )}
                            {(row.expressions.length > 0 || row.persistenceSignals.length > 0) && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.expressions.map((expression) => (
                                  <button
                                    key={`${row.profileKey}:expression:${expression.timestamp}:${expressionLabel(expression)}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, expression.timestamp)}
                                    className="rounded border border-fuchsia-700/50 px-1.5 py-0.5 text-[9px] text-fuchsia-100 hover:bg-fuchsia-950/25"
                                  >
                                    {expressionLabel(expression)} {formatTime(expression.timestamp)}
                                  </button>
                                ))}
                                {row.persistenceSignals.map((signal) => (
                                  <button
                                    key={`${row.profileKey}:persistence:${signal.instruction_id}`}
                                    type="button"
                                    onClick={() => navigateToInstruction(signal)}
                                    className="rounded border border-violet-700/50 px-1.5 py-0.5 text-[9px] text-violet-100 hover:bg-violet-950/25"
                                  >
                                    agent persistence {supportLabel(signal)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )) : (
                          <div className="text-[10px] text-slate-500">
                            No Narrative Agent Profiles available for scene browsing yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {characterSceneGovernanceRows.length > 0 && (
                  <div className="mt-2 rounded border border-slate-800 bg-[#101010] px-2 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                          Characters By Scene
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          Governance list: open one character to inspect only their surfaced or staged scenes.
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {characterSceneGovernanceRows.length} characters
                        {sceneSegmentsAreDerived ? " / derived scenes" : ""}
                      </div>
                    </div>
                    <div className="mt-2 max-h-64 space-y-1.5 overflow-auto pr-1">
                      {characterSceneGovernanceRows.map(({ label, profile, profileKey, scenes }) => {
                        const open = Boolean(openCharacterSceneProfiles[profileKey]);
                        const visibleScenes = scenes.filter(
                          (scene) => scene.surfaced || scene.staged,
                        );
                        return (
                          <div
                            key={`character-scenes:${profileKey}`}
                            className="rounded border border-slate-800 bg-[#121212]"
                          >
                            <button
                              type="button"
                              onClick={() => toggleCharacterSceneProfile(profileKey)}
                              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-white/5"
                            >
                              <span className="min-w-0 truncate text-[10px] text-slate-100">
                                {open ? "▾" : "▸"} {formatAgentGovernanceLabel({ label, profile, profileKey, scenes })}
                              </span>
                              <span className="shrink-0 text-[9px] text-slate-500">
                                {visibleScenes.length} scenes
                              </span>
                            </button>
                            <div className="flex flex-wrap gap-1 border-t border-slate-900/80 px-2 py-1.5">
                              {scenes.map((sceneRow) => {
                                const activated = sceneRow.surfaced || sceneRow.staged;
                                return (
                                  <button
                                    key={`${profileKey}:scene-switch:${sceneRow.sceneKey}`}
                                    type="button"
                                    onClick={() =>
                                      toggleProfileSceneActivation(sceneRow.sceneKey, profileKey)
                                    }
                                    className={`rounded border px-1.5 py-0.5 text-[9px] ${
                                      activated
                                        ? sceneRow.staged
                                          ? "border-cyan-500/70 bg-cyan-950/45 text-cyan-100"
                                          : "border-emerald-600/60 bg-emerald-950/30 text-emerald-100"
                                        : "border-slate-700 bg-[#101010] text-slate-500 hover:border-cyan-800/60 hover:text-cyan-100"
                                    }`}
                                    title={
                                      sceneRow.surfaced
                                        ? "Evidence already surfaces this character in the scene; click to add an analyst activation marker."
                                        : sceneRow.staged
                                          ? "Analyst activation marker is on; click to turn it off."
                                          : "Click to mark this character present in the scene."
                                    }
                                  >
                                    S{sceneRow.scene.scene_index ?? sceneRow.sceneIndex + 1}
                                  </button>
                                );
                              })}
                            </div>
                            {open && (
                              <div className="border-t border-slate-800 px-2 py-1.5">
                                {visibleScenes.length > 0 ? (
                                  <div className="space-y-1">
                                    {visibleScenes.map((sceneRow) => (
                                      <div
                                        key={`${profileKey}:scene-list:${sceneRow.sceneKey}`}
                                        className="rounded border border-slate-800 bg-[#101010] px-1.5 py-1"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveSceneIndex(sceneRow.sceneIndex);
                                              openVideoAtTime(selectedVideoId, sceneRow.scene.start);
                                            }}
                                            className="text-[9px] text-cyan-100 hover:underline"
                                          >
                                            Scene {sceneRow.scene.scene_index ?? sceneRow.sceneIndex + 1} / {formatTime(sceneRow.scene.start)}
                                          </button>
                                          <span className="text-[9px] text-slate-500">
                                            {sceneRow.staged ? "staged" : "surfaced"} / manual {sceneRow.manualAnnotations.length} / audio {sceneRow.audioProsody.length} / samples {sceneRow.sourceSamples.length} / cues {sceneRow.sceneInstructions.length} / lines {sceneRow.lines.length}
                                          </span>
                                        </div>
                                        {sceneRow.manualAnnotations[0] && (
                                          <button
                                            type="button"
                                            onClick={() => openVideoAtTime(selectedVideoId, manualAnnotationStart(sceneRow.manualAnnotations[0]))}
                                            className="mt-1 block w-full truncate text-left text-[9px] text-emerald-200 hover:text-emerald-100"
                                          >
                                            manual indication: {sceneRow.manualAnnotations[0].identity_affirmation || sceneRow.manualAnnotations[0].role_affirmation || sceneRow.manualAnnotations[0].label} / {formatTime(manualAnnotationStart(sceneRow.manualAnnotations[0]))}
                                          </button>
                                        )}
                                        {sceneRow.lines[0] && (
                                          <button
                                            type="button"
                                            onClick={() => openVideoAtTime(selectedVideoId, sceneRow.lines[0].start)}
                                            className="mt-1 block w-full truncate text-left text-[9px] text-slate-400 hover:text-cyan-100"
                                          >
                                            {sceneRow.lines[0].speaker}: {sceneRow.lines[0].text}
                                          </button>
                                        )}
                                        {sceneRow.audioProsody[0] && (
                                          <button
                                            type="button"
                                            onClick={() => openVideoAtTime(selectedVideoId, Number(sceneRow.audioProsody[0].start || 0))}
                                            className="mt-1 block w-full truncate text-left text-[9px] text-sky-200 hover:text-sky-100"
                                          >
                                            audio prosody: {sceneRow.audioProsody[0].emphasis?.label || sceneRow.audioProsody[0].pace?.label || "cue"} / {formatTime(Number(sceneRow.audioProsody[0].start || 0))}
                                          </button>
                                        )}
                                        {sceneRow.sourceSamples[0] && (
                                          <button
                                            type="button"
                                            onClick={() => openVideoAtTime(selectedVideoId, Number(sceneRow.sourceSamples[0].time_start || 0))}
                                            className="mt-1 block w-full truncate text-left text-[9px] text-amber-200 hover:text-amber-100"
                                          >
                                            source sample: {sceneRow.sourceSamples[0].label || sceneRow.sourceSamples[0].sample_type || "sample"} / {formatTime(Number(sceneRow.sourceSamples[0].time_start || 0))}
                                          </button>
                                        )}
                                        {sceneRow.persistenceSignals.length > 0 && (
                                          <div className="mt-1 text-[9px] text-violet-100">
                                            agent persistence signal available
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[9px] text-slate-500">
                                    No surfaced or staged scenes yet. Use Add to scene in the Scene Agent Browser to stage this profile.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="mt-2 rounded border border-slate-800 bg-[#101010] px-2 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                        Dramatic Archetype Readings
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        Cross-tradition interpretive lenses; not fixed Narrative Agent labels.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {DRAMATIC_ARCHETYPE_LENSES.map((lens) => (
                        <button
                          key={lens.id}
                          type="button"
                          onClick={() => setActiveArchetypeLens(lens.id)}
                          className={`rounded border px-1.5 py-0.5 text-[10px] ${
                            activeArchetypeLens === lens.id
                              ? "border-cyan-600/60 bg-cyan-950/35 text-cyan-100"
                              : "border-slate-700 bg-[#121212] text-slate-400 hover:bg-white/5"
                          }`}
                        >
                          {lens.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 rounded border border-cyan-900/40 bg-cyan-950/10 px-2 py-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium text-cyan-100">
                          {activeArchetype.tradition}: {activeArchetype.label}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {activeArchetype.insight}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[10px] text-cyan-200">
                        {activeArchetypeMatches.length} matching cue
                        {activeArchetypeMatches.length === 1 ? "" : "s"}
                        {strongestArchetypeParticipant
                          ? ` • strongest: ${strongestArchetypeParticipant[0]}`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeArchetype.cues.map((cue) => (
                      <span
                        key={`${activeArchetypeLens}:${cue}`}
                        className="rounded border border-slate-700 bg-[#121212] px-1.5 py-0.5 text-[10px] text-slate-300"
                      >
                        {cue}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-auto p-2">
                {participantGroups.length ? (
                  participantGroups.map(([participant, items]) => {
                    const matchedProfiles = narrativeAgentProfiles.filter((profile) =>
                      profileMatchesParticipant(profile, participant),
                    );
                    const persistenceSignals = agentPersistenceInstructionsForParticipant(
                      instructions,
                      participant,
                    );
                    return (
                    <div key={participant} className="rounded border border-slate-800 bg-[#101010]/60">
                      <div className="border-b border-slate-800 px-2.5 py-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-300">{participant}</div>
                          <div className="flex flex-wrap gap-1">
                            {participantTopArchetypes(items).map(({ lens, score }) => (
                              <span
                                key={`${participant}:${lens.id}`}
                                className={`rounded border px-1.5 py-0.5 text-[9px] ${
                                  lens.id === activeArchetypeLens
                                    ? "border-cyan-700/70 bg-cyan-950/30 text-cyan-100"
                                    : "border-slate-700 bg-[#121212] text-slate-400"
                                }`}
                                title={`Interpretive cue support ${score.toFixed(2)}`}
                              >
                                {lens.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                          <span>
                            {activeArchetype.label}:{" "}
                            {archetypeScore(items, activeArchetypeLens).toFixed(1)}
                          </span>
                          {matchedArchetypeCues(items, activeArchetypeLens).map((cue) => (
                            <span
                              key={`${participant}:${activeArchetypeLens}:${cue}`}
                              className="rounded border border-cyan-900/50 bg-cyan-950/15 px-1.5 py-0.5 text-cyan-100/80"
                            >
                              {cue}
                            </span>
                          ))}
                          {matchedArchetypeCues(items, activeArchetypeLens).length === 0 && (
                            <span>No direct cue for selected lens</span>
                          )}
                        </div>
                        {(matchedProfiles.length > 0 || persistenceSignals.length > 0) && (
                          <div className="mt-2 rounded border border-cyan-900/40 bg-cyan-950/10 px-2 py-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-cyan-200">
                                Narrative Agent Profile
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {matchedProfiles.length} profile{matchedProfiles.length === 1 ? "" : "s"}
                                {persistenceSignals.length
                                  ? ` / ${persistenceSignals.length} persistence signal${persistenceSignals.length === 1 ? "" : "s"}`
                                  : ""}
                              </div>
                            </div>
                            {matchedProfiles.slice(0, 2).map((profile, profileIndex) => (
                              <div
                                key={profile.profile_id || `${participant}:profile:${profileIndex}`}
                                className="mt-1 text-[10px] leading-relaxed text-slate-300"
                              >
                                <span className="text-cyan-100">
                                  {formatNarrativeAgentProfileBrief(profile)}
                                </span>
                                {profile.source_metadata?.role_description ? (
                                  <span className="text-slate-500">
                                    {" "}
                                    - {profile.source_metadata.role_description}
                                  </span>
                                ) : null}
                                {narrativeAgentProfileEvidenceChips(profile).length > 0 ? (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {narrativeAgentProfileEvidenceChips(profile).map((chip) => (
                                      <span
                                        key={`${profile.profile_id || participant}:${chip}`}
                                        className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-400"
                                      >
                                        {chip}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                            {persistenceSignals.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {persistenceSignals.slice(0, 3).map((signal) => (
                                  <button
                                    key={signal.instruction_id}
                                    type="button"
                                    onClick={() => navigateToInstruction(signal)}
                                    className="rounded border border-violet-500/30 bg-violet-950/20 px-1.5 py-0.5 text-[9px] text-violet-100 hover:bg-violet-900/30"
                                    title="Jump to agent sample-profile persistence evidence"
                                  >
                                    agent persistence {supportLabel(signal)}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 p-1.5">
                        {items.length > 0 ? [...items]
                          .sort((left, right) => {
                            const rightMatch = archetypeMatches([right], activeArchetypeLens).length;
                            const leftMatch = archetypeMatches([left], activeArchetypeLens).length;
                            if (rightMatch !== leftMatch) return rightMatch - leftMatch;
                            return supportScore(right) - supportScore(left);
                          })
                          .map((instruction) => (
                            <InstructionItem
                              key={instruction.instruction_id}
                              instruction={instruction}
                              activeLens={activeLens}
                              showLens
                              onNavigate={navigateToInstruction}
                            />
                          )) : (
                          <div className="rounded border border-slate-800 bg-[#101010] px-2.5 py-2 text-[11px] text-slate-500">
                            Metadata-seeded Narrative Agent Profile. No detected character-path cues have surfaced yet.
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <div className="px-2 py-3 text-[12px] text-slate-500">
                    No character-path candidates yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
