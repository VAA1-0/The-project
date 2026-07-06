import React, { useEffect, useMemo, useRef, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import {
  VideoService,
  type AnalysisData,
  type MatureEvidenceAuthority,
  type MasterSchemaResolvedEvidenceRecord,
} from "@/lib/video-service";
import { apiService } from "@/lib/api-service";
import type {
  AnnotationCorrections,
  EvidenceProliferationMatchSummary,
  IdentityCandidate,
  IdentityCandidateLedger,
  ManualVisualAnnotation,
  SecondOrderLabelInstruction,
} from "@/lib/api-service";
import {
  broadcastAnalysisCorrectionRefresh,
  pushCorrectionSnapshot,
  removeManualVisualAnnotation,
  retimeManualVisualAnnotationsFromPresenceInterval,
  upsertManualVisualAnnotation,
  upsertMasterSchemaPresenceInterval,
} from "@/lib/annotation-corrections";
import {
  closeManualAnnotationInVideo,
  openManualAnnotationInVideo,
  openVideoAtTime,
} from "@/lib/video-navigation";
import { matureSceneSegmentsFromAnalysis } from "@/lib/scene-governance";
import { useLayoutHost } from "../LayoutHost";
import { SecondOrderLabelReviewTray } from "./SecondOrderLabelAffirmations";

const CATEGORY_ORDER: ManualVisualAnnotation["category"][] = [
  "Action",
  "Audio",
  "Cinematic Cues",
  "Expressions",
  "Genre",
  "Identification",
  "Interaction",
  "Metadata",
  "Movement",
  "Notes",
  "OBJ",
  "OCR",
  "Role",
  "Scene",
  "Transcription",
];

const MANUAL_SUBCATEGORIES: Record<ManualVisualAnnotation["category"], string[]> = {
  Action: ["Action"],
  Audio: ["Ambience", "Foley", "Music", "Prosody", "Sound event", "Speaker-state"],
  "Cinematic Cues": ["Composition", "Lighting", "Shot size", "Transition"],
  Expressions: ["Emotion", "Expression"],
  Genre: [
    "Media genre",
    "Media subgenre",
    "Situational genre",
    "Situational subgenre",
    "Situational taxonomy",
  ],
  Identification: ["Character", "Identity"],
  Interaction: ["Exchange", "Interaction"],
  Metadata: ["Context", "Correlation"],
  Movement: ["Camera movement", "Subject movement"],
  Notes: ["Timestamped note"],
  OBJ: ["Object label"],
  OCR: ["Visible text"],
  Role: ["Role affirmation"],
  Scene: ["Location", "Scene type"],
  Transcription: ["Speech content", "Transcript note"],
};

type LeafAnnotationDraft = {
  category: ManualVisualAnnotation["category"];
  subcategory: string;
  label: string;
  identityAffirmation: string;
  roleAffirmation: string;
  start: number;
  end: number;
  note: string;
};

type EvidenceTracebackSourceRefs = {
  media_id?: string;
  video_time?: number;
  time_range?: { start?: number; end?: number };
  bbox_id?: string | null;
  roi_id?: string | null;
  annotation_id?: string | null;
  metadata_id?: string | null;
  detector_run_id?: string | null;
};

type EvidenceNavigationTarget = {
  id: string;
  label: string;
  evidenceType: string;
  sourcePanel: string;
  start?: number;
  end?: number;
  sourceRefs?: EvidenceTracebackSourceRefs;
  sourceItem?: Record<string, unknown>;
  openPanelType?: string;
  focusSurface?: string;
};

type ScenePresenceSupport = "source" | "manual" | "cue" | "scene_ref" | "profile";

type NarrativeAgentPathRow = {
  key: string;
  label: string;
  aliases: string[];
  sourceLabels: string[];
  profileIds: string[];
  source: string;
  role?: string;
  start?: number;
  end?: number;
  sceneCount: number;
  manualCount: number;
  cueCount: number;
  evidenceChips: string[];
  cues: SecondOrderLabelInstruction[];
  sceneRefs: Array<string | number>;
  scenePresence: Array<{
    sceneIndex: number;
    sceneLabel: string;
    start: number;
    end: number;
    support: ScenePresenceSupport;
  }>;
  sourceItem?: Record<string, unknown>;
  sourceItems: Record<string, unknown>[];
};

type NarrativeAgentTimelineHandle = {
  key: string;
  label: string;
  kind: "source" | "scene" | "cue" | "occurrence";
  time: number;
  end?: number;
  title: string;
};

type NarrativeAgentTimelineHandleCommit = {
  row: NarrativeAgentPathRow;
  handle: NarrativeAgentTimelineHandle;
};

type NarrativeAgentGraphNode = {
  id: string;
  label: string;
  kind: "agent" | "source" | "scene" | "cue" | "occurrence";
  time?: number;
  end?: number;
  x: number;
  y: number;
  handle?: NarrativeAgentTimelineHandle;
  scene?: NarrativeAgentPathRow["scenePresence"][number];
};

type NarrativeAgentGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: "source_anchor" | "scene_presence" | "cue_support" | "occurrence_support";
  label: string;
};

type NarrativeAgentGraphModel = {
  nodes: NarrativeAgentGraphNode[];
  edges: NarrativeAgentGraphEdge[];
};

type NarrativeAgentRelevanceDimension = {
  id:
    | "task_fit"
    | "source_strength"
    | "novelty"
    | "comparative_value"
    | "interpretive_value"
    | "actionability";
  label: string;
  score: number;
  reason: string;
  evidenceCount: number;
  sourceTime?: number;
};

type NarrativeAgentSignificanceClaim = {
  level: "Macro" | "Meso" | "Micro";
  title: string;
  text: string;
  evidenceCount: number;
  sourceTime?: number;
};

type NarrativeAgentRelevanceSurface = {
  overallScore: number;
  context: {
    analystGoal: string;
    targetAudience: string;
    scope: string;
    activeLens: string;
  };
  statsSignals: Array<{
    label: string;
    value: string | number;
    detail: string;
  }>;
  dimensions: NarrativeAgentRelevanceDimension[];
  significanceClaims: NarrativeAgentSignificanceClaim[];
  firstSourceTime?: number;
};

const NARRATIVE_AGENT_ARCHETYPE_LENSES = [
  {
    id: "shakespearean_performativity",
    label: "Performed agency",
    tradition: "Shakespearean",
    description: "Public role, private motive, status pressure, and rhetorical agency.",
    graphDescription: "Macro role and public action sit near the agent; private motive and scene pressure stay inspectable below.",
  },
  {
    id: "proppian_function",
    label: "Narrative function",
    tradition: "Proppian",
    description: "Helper, opponent, donor, dispatcher, false hero, or task relation.",
    graphDescription: "Scene and occurrence nodes are arranged as task functions around helper, opponent, and quest movement.",
  },
  {
    id: "jungian_symbolic",
    label: "Symbolic shadow",
    tradition: "Jungian / Mythic",
    description: "Shadow, mentor, trickster, mask, projection, or symbolic relation.",
    graphDescription: "Cue nodes are pulled forward as symbolic signals while source and scene anchors remain traceable.",
  },
  {
    id: "greimasian_actant",
    label: "Actant relation",
    tradition: "Greimasian",
    description: "Subject, object, sender, receiver, helper, opponent, and goal structure.",
    graphDescription: "Relations spread into actant lanes so helpers, opponents, sender/receiver pressure, and object pursuit can be compared.",
  },
  {
    id: "burkean_motive",
    label: "Motive scene",
    tradition: "Burkean / Dramatistic",
    description: "Act, scene, agent, agency, purpose, guilt, and motive.",
    graphDescription: "Act, scene, agency, and purpose cues are separated so motive can be read against situation.",
  },
];

type NarrativeAgentArchetypeLens = typeof NARRATIVE_AGENT_ARCHETYPE_LENSES[number];
type NarrativeAgentArchetypeLensId = typeof NARRATIVE_AGENT_ARCHETYPE_LENSES[number]["id"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberFrom(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeAgentKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => stringFrom(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function arrayStringsFromUnknown(value: unknown): string[] {
  return Array.isArray(value) ? uniqueStrings(value) : [];
}

function narrativeAgentAliasKeys(values: unknown[]): string[] {
  return uniqueStrings(values)
    .map(normalizeAgentKey)
    .filter(Boolean);
}

function labelsLikelySameNarrativeAgent(left: string, right: string): boolean {
  const leftKey = normalizeAgentKey(left);
  const rightKey = normalizeAgentKey(right);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  const leftTokens = leftKey.split(" ");
  const rightTokens = rightKey.split(" ");
  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;
  if (shorter.length === 1 && shorter[0].length < 4) return false;
  return shorter.every((token) => longer.includes(token));
}

function secondsFromInstruction(instruction: SecondOrderLabelInstruction): number {
  const raw = instruction.time_span?.start_ms ?? instruction.time_span?.start ?? 0;
  const numeric = Number(raw || 0);
  return instruction.time_span?.start_ms !== undefined || numeric > 1000
    ? numeric / 1000
    : numeric;
}

function instructionTouchesAgent(
  instruction: SecondOrderLabelInstruction,
  label: string,
): boolean {
  const labelKey = normalizeAgentKey(label);
  if (!labelKey) return false;
  const participants = instruction.participants_involved || [];
  const targetText = normalizeAgentKey([
    instruction.target_label_family,
    instruction.candidate_label,
    instruction.status,
    ...participants,
  ].join(" "));
  return targetText.includes(labelKey) || participants.some((participant) => {
    const participantKey = normalizeAgentKey(participant);
    return participantKey === labelKey || participantKey.includes(labelKey) || labelKey.includes(participantKey);
  });
}

function narrativeAgentLabelFromRecord(
  record: MasterSchemaResolvedEvidenceRecord,
): string {
  const metadata = asRecord(record.metadata);
  return (
    stringFrom(metadata.narrative_agent_name) ||
    stringFrom(metadata.character_name) ||
    stringFrom(metadata.agent_label) ||
    stringFrom(metadata.current_label) ||
    stringFrom(record.label) ||
    "Narrative Agent"
  );
}

function narrativeAgentLabelFromProfile(profile: Record<string, unknown>): string {
  const performer = asRecord(profile.attached_performer_metadata);
  return (
    stringFrom(profile.narrative_agent_name) ||
    stringFrom(profile.character_name) ||
    stringFrom(profile.current_label) ||
    stringFrom(performer.actor_name) ||
    stringFrom(profile.profile_id) ||
    "Narrative Agent"
  );
}

function narrativeAgentProfileEvidenceChips(profile: Record<string, unknown>): string[] {
  const slots = asRecord(profile.evidence_slots);
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

function narrativeAgentAliasesFromSource(
  label: string,
  sourceItem?: Record<string, unknown>,
): string[] {
  const source = asRecord(sourceItem);
  const metadata = asRecord(source.metadata);
  const performer = asRecord(source.attached_performer_metadata);
  const sourceMetadata = asRecord(source.source_metadata);
  return uniqueStrings([
    label,
    source.narrative_agent_name,
    source.character_name,
    source.current_label,
    source.agent_label,
    source.identity_affirmation,
    source.custom_label,
    source.label,
    performer.actor_name,
    metadata.narrative_agent_name,
    metadata.character_name,
    metadata.agent_label,
    metadata.current_label,
    metadata.identity_affirmation,
    metadata.custom_label,
    metadata.label,
    ...arrayStringsFromUnknown(source.aliases),
    ...arrayStringsFromUnknown(source.alias_labels),
    ...arrayStringsFromUnknown(source.character_aliases),
    ...arrayStringsFromUnknown(source.known_aliases),
    ...arrayStringsFromUnknown(source.alternative_labels),
    ...arrayStringsFromUnknown(source.previous_labels),
    ...arrayStringsFromUnknown(metadata.aliases),
    ...arrayStringsFromUnknown(metadata.alias_labels),
    ...arrayStringsFromUnknown(metadata.character_aliases),
    ...arrayStringsFromUnknown(metadata.known_aliases),
    ...arrayStringsFromUnknown(metadata.alternative_labels),
    ...arrayStringsFromUnknown(metadata.previous_labels),
    ...arrayStringsFromUnknown(sourceMetadata.aliases),
    ...arrayStringsFromUnknown(sourceMetadata.alias_labels),
    ...arrayStringsFromUnknown(sourceMetadata.character_aliases),
  ]);
}

function narrativeAgentProfileIdsFromSource(sourceItem?: Record<string, unknown>): string[] {
  const source = asRecord(sourceItem);
  const metadata = asRecord(source.metadata);
  return uniqueStrings([
    source.profile_id,
    source.narrative_agent_profile_id,
    source.character_id,
    metadata.profile_id,
    metadata.narrative_agent_profile_id,
    metadata.character_id,
  ]);
}

function findNarrativeAgentRowKey(
  rows: Map<string, NarrativeAgentPathRow>,
  label: string,
  aliases: string[],
  profileIds: string[],
): string {
  const labelKey = normalizeAgentKey(label);
  const aliasKeys = new Set(narrativeAgentAliasKeys([label, ...aliases]));
  if (labelKey && rows.has(labelKey)) return labelKey;
  for (const [key, row] of rows.entries()) {
    const rowAliasKeys = new Set(narrativeAgentAliasKeys([row.label, ...row.aliases]));
    const sharesProfile = profileIds.some((profileId) => row.profileIds.includes(profileId));
    const sharesAlias = [...aliasKeys].some((aliasKey) => rowAliasKeys.has(aliasKey));
    const likelySame = [row.label, ...row.aliases].some((rowLabel) =>
      [label, ...aliases].some((candidateLabel) =>
        labelsLikelySameNarrativeAgent(rowLabel, candidateLabel),
      ),
    );
    if (sharesProfile || sharesAlias || likelySame) return key;
  }
  return labelKey;
}

function arrayFromUnknown(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sceneRefsFromUnknown(value: unknown): Array<string | number> {
  return arrayFromUnknown(value)
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") return item;
      const record = asRecord(item);
      return (
        stringFrom(record.scene_id) ||
        numberFrom(record.scene_index) ||
        numberFrom(record.index) ||
        stringFrom(record.id)
      );
    })
    .filter((item): item is string | number => item !== undefined && item !== null && item !== "");
}

function timeSupportsFromSourceItem(
  item?: Record<string, unknown>,
): Array<{ start: number; end?: number; support: ScenePresenceSupport }> {
  if (!item) return [];
  const start = numberFrom(
    item.start ??
      item.start_seconds ??
      item.timestamp_seconds ??
      item.time_start ??
      asRecord(item.time_interval).start ??
      asRecord(item.time_interval).start_seconds,
  );
  const end = numberFrom(
    item.end ??
      item.end_seconds ??
      item.time_end ??
      asRecord(item.time_interval).end ??
      asRecord(item.time_interval).end_seconds,
  );
  if (start === undefined) return [];
  return [{
    start,
    end,
    support: item.category === "Identification" ? "manual" : "source",
  }];
}

function upsertNarrativeAgentPathRow(
  rows: Map<string, NarrativeAgentPathRow>,
  patch: Partial<NarrativeAgentPathRow> & { label: string; source: string },
) {
  const aliases = uniqueStrings([
    ...(patch.aliases || []),
    ...narrativeAgentAliasesFromSource(patch.label, patch.sourceItem),
  ]);
  const profileIds = uniqueStrings([
    ...(patch.profileIds || []),
    ...narrativeAgentProfileIdsFromSource(patch.sourceItem),
  ]);
  const key = findNarrativeAgentRowKey(rows, patch.label, aliases, profileIds);
  if (!key) return;
  const existing = rows.get(key);
  const sourceLabels = uniqueStrings([
    ...(existing?.sourceLabels || []),
    ...(patch.sourceLabels || []),
    patch.label,
  ]);
  const nextAliases = uniqueStrings([
    ...(existing?.aliases || []),
    ...aliases,
    patch.label,
  ]);
  const nextProfileIds = uniqueStrings([
    ...(existing?.profileIds || []),
    ...profileIds,
  ]);
  const sourceItems = [
    ...(existing?.sourceItems || []),
    ...(patch.sourceItems || []),
    ...(patch.sourceItem ? [patch.sourceItem] : []),
  ];
  const next: NarrativeAgentPathRow = {
    key,
    label: existing?.label || patch.label,
    aliases: nextAliases,
    sourceLabels,
    profileIds: nextProfileIds,
    source: existing?.source || patch.source,
    role: patch.role || existing?.role,
    start:
      existing?.start !== undefined && patch.start !== undefined
        ? Math.min(existing.start, patch.start)
        : existing?.start ?? patch.start,
    end:
      existing?.end !== undefined && patch.end !== undefined
        ? Math.max(existing.end, patch.end)
        : existing?.end ?? patch.end,
    sceneCount: Math.max(existing?.sceneCount || 0, patch.sceneCount || 0),
    manualCount: (existing?.manualCount || 0) + (patch.manualCount || 0),
    cueCount: existing?.cueCount || patch.cueCount || 0,
    evidenceChips: Array.from(
      new Set([...(existing?.evidenceChips || []), ...(patch.evidenceChips || [])]),
    ),
    cues: existing?.cues || patch.cues || [],
    sceneRefs: Array.from(new Set([...(existing?.sceneRefs || []), ...(patch.sceneRefs || [])])),
    scenePresence: [...(existing?.scenePresence || []), ...(patch.scenePresence || [])],
    sourceItem: existing?.sourceItem || patch.sourceItem,
    sourceItems,
  };
  rows.set(key, next);
}

function buildNarrativeAgentPathRows(analysisData: any): NarrativeAgentPathRow[] {
  const rows = new Map<string, NarrativeAgentPathRow>();
  const records: MasterSchemaResolvedEvidenceRecord[] =
    analysisData?.masterSchemaResolvedEvidence?.records || [];
  const instructions: SecondOrderLabelInstruction[] =
    analysisData?.secondOrderLabelProliferation?.instructions || [];
  const sceneSegments = matureSceneSegmentsFromAnalysis(analysisData);
  const manualIdentification: ManualVisualAnnotation[] =
    analysisData?.manualAnnotationsByCategory?.Identification || [];
  const presenceIntervals: MeaningNetworkPresenceInterval[] =
    analysisData?.annotationCorrections?.master_schema_presence_intervals || [];
  const narrativeAgentProfiles: Record<string, unknown>[] =
    analysisData?.metadata?.sourceMediaMetadata?.user_annotations?.narrative_agent_profiles ||
    analysisData?.sourceMediaMetadata?.user_annotations?.narrative_agent_profiles ||
    [];

  for (const record of records) {
    if (!["narrative_agent_profile", "character_role", "identity"].includes(record.category)) {
      continue;
    }
    const metadata = asRecord(record.metadata);
    const label = narrativeAgentLabelFromRecord(record);
    upsertNarrativeAgentPathRow(rows, {
      label,
      source: record.category === "narrative_agent_profile"
        ? "Master Schema Narrative Agent Profile"
        : "Master Schema evidence",
      role: stringFrom(metadata.role) || stringFrom(metadata.role_label),
      start: record.start,
      end: record.end,
      sceneCount: Array.isArray(metadata.scene_refs) ? metadata.scene_refs.length : 0,
      sceneRefs: sceneRefsFromUnknown(metadata.scene_refs),
      evidenceChips: record.category === "identity" ? ["ID evidence"] : ["Master Schema"],
      sourceItem: record as unknown as Record<string, unknown>,
    });
  }

  for (const profile of narrativeAgentProfiles) {
    const label = narrativeAgentLabelFromProfile(profile);
    upsertNarrativeAgentPathRow(rows, {
      label,
      source: "Source Media Narrative Agent Profile",
      role:
        Array.isArray(asRecord(profile.source_metadata).role_labels)
          ? (asRecord(profile.source_metadata).role_labels as string[])[0]
          : stringFrom(asRecord(profile.source_metadata).role_description),
      sceneCount:
        Array.isArray(asRecord(profile.evidence_slots).scene_links)
          ? (asRecord(profile.evidence_slots).scene_links as unknown[]).length
          : 0,
      sceneRefs: sceneRefsFromUnknown(asRecord(profile.evidence_slots).scene_links),
      evidenceChips: narrativeAgentProfileEvidenceChips(profile),
      sourceItem: profile,
    });
  }

  for (const annotation of manualIdentification) {
    const label =
      annotation.identity_affirmation ||
      annotation.custom_label ||
      annotation.label ||
      "Narrative Agent annotation";
    upsertNarrativeAgentPathRow(rows, {
      label,
      source: "Manual Narrative Agent annotation",
      role: annotation.role_affirmation,
      start: numberFrom(annotation.start_seconds ?? annotation.timestamp_seconds),
      end: numberFrom(annotation.end_seconds),
      manualCount: 1,
      sceneRefs: [],
      evidenceChips: ["manual correction"],
      sourceItem: annotation as unknown as Record<string, unknown>,
    });
  }

  for (const interval of presenceIntervals) {
    const isNarrativeAgentInterval =
      interval.node_type === "narrative_agent" ||
      interval.lane_id === "on_camera_agents" ||
      interval.master_schema_surface === "narrative_agent_profile_annotations" ||
      Boolean(interval.narrative_agent_profile_id);
    if (!isNarrativeAgentInterval) continue;
    const label =
      interval.label ||
      interval.narrative_agent_profile_id ||
      interval.node_id ||
      "Narrative Agent handle";
    upsertNarrativeAgentPathRow(rows, {
      label,
      source: "Master Schema Narrative Agent handle",
      start: interval.start_seconds,
      end: interval.end_seconds,
      manualCount: interval.authority_level === "manual_correction" ? 1 : 0,
      sceneRefs: [],
      profileIds: interval.narrative_agent_profile_id ? [interval.narrative_agent_profile_id] : [],
      evidenceChips: ["timeline handle"],
      sourceItem: {
        ...interval,
        category: "Identification",
        narrative_agent_profile_id: interval.narrative_agent_profile_id,
        profile_id: interval.narrative_agent_profile_id,
        label,
        start_seconds: interval.start_seconds,
        end_seconds: interval.end_seconds,
      } as Record<string, unknown>,
    });
  }

  const nextRows = [...rows.values()].map((row) => {
    const cues = instructions.filter((instruction) => instructionTouchesAgent(instruction, row.label));
    const cueStart = cues
      .map(secondsFromInstruction)
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right)[0];
    const sourceItems = row.sourceItems.length ? row.sourceItems : [row.sourceItem].filter(Boolean) as Record<string, unknown>[];
    const supportTimes = [
      ...sourceItems.flatMap(timeSupportsFromSourceItem),
      ...cues.map((cue) => ({
        start: secondsFromInstruction(cue),
        end: cue.time_span?.end_ms !== undefined
          ? Number(cue.time_span.end_ms) / 1000
          : numberFrom(cue.time_span?.end),
        support: "cue" as const,
      })),
    ].filter((support) => Number.isFinite(support.start));
    const scenePresence = sceneSegments
      .filter((scene) => {
        const sceneRefKeys = [
          scene.scene_index,
          String(scene.scene_index),
          scene.scene_id,
        ].filter((value) => value !== undefined && value !== null);
        const hasSceneRef = row.sceneRefs.some((ref) =>
          sceneRefKeys.some((key) => String(key) === String(ref)),
        );
        if (hasSceneRef) return true;
        return supportTimes.some((support) => {
          const supportEnd = support.end ?? support.start;
          return support.start <= scene.end && supportEnd >= scene.start;
        });
      })
      .map((scene) => {
        const support = supportTimes.find((item) => {
          const supportEnd = item.end ?? item.start;
          return item.start <= scene.end && supportEnd >= scene.start;
        });
        return {
          sceneIndex: scene.scene_index,
          sceneLabel: `S${scene.scene_index}`,
          start: scene.start,
          end: scene.end,
          support: (support?.support || (row.sceneRefs.length ? "scene_ref" : "profile")) as ScenePresenceSupport,
        };
      })
      .slice(0, 12);
    return {
      ...row,
      cues,
      cueCount: cues.length,
      start: row.start ?? cueStart,
      sceneCount: Math.max(row.sceneCount, scenePresence.length),
      scenePresence,
      evidenceChips: row.evidenceChips.length ? row.evidenceChips : ["profile"],
    };
  });

  return nextRows.sort((left, right) => {
    const supportDelta =
      right.manualCount + right.cueCount + right.sceneCount -
      (left.manualCount + left.cueCount + left.sceneCount);
    if (supportDelta !== 0) return supportDelta;
    return left.label.localeCompare(right.label);
  });
}

function sourceRefId(
  metadata: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return null;
}

function buildRecordSourceRefs(
  videoId: string,
  record: MasterSchemaResolvedEvidenceRecord,
): EvidenceTracebackSourceRefs {
  const metadata = asRecord(record.metadata);
  const start = numberFrom(record.start ?? metadata.time_start ?? metadata.start_seconds);
  const end = numberFrom(record.end ?? metadata.time_end ?? metadata.end_seconds);
  return {
    media_id: videoId,
    video_time: start,
    time_range: start !== undefined || end !== undefined ? { start, end } : undefined,
    bbox_id: sourceRefId(metadata, ["bbox_id", "source_bbox_id", "track_id"]),
    roi_id: sourceRefId(metadata, ["roi_id", "source_roi_id"]),
    annotation_id: record.targetId || sourceRefId(metadata, ["annotation_id"]),
    metadata_id: sourceRefId(metadata, ["metadata_id", "profile_id", "character_id"]),
    detector_run_id: sourceRefId(metadata, ["detector_run_id", "run_id"]),
  };
}

function emitEvidenceTraceback(videoId: string, target: EvidenceNavigationTarget) {
  const sourceRefs = target.sourceRefs || {
    media_id: videoId,
    video_time: target.start,
    time_range:
      target.start !== undefined || target.end !== undefined
        ? { start: target.start, end: target.end }
        : undefined,
    metadata_id: target.id,
  };
  const payload = {
    videoId,
    sourcePanel: target.sourcePanel,
    claim_id: target.id,
    claim_label: target.label,
    claim_type: target.evidenceType,
    claim_status: "mature",
    maturity_level: target.evidenceType,
    authority_level: "master_schema",
    authority_source: target.sourcePanel,
    review_status: "reviewable",
    source_refs: sourceRefs,
    sourceItem: target.sourceItem || {},
  };
  eventBus.emit("openPanelRequest", {
    panelType: "TracebackDrawer",
    panelProps: { payload },
  });
  eventBus.emit("tracebackOpenRequested", payload);
}

function openEvidenceNavigation(videoId: string, target: EvidenceNavigationTarget) {
  eventBus.emit("masterSchemaEvidenceNavigationRequested", {
    videoId,
    evidenceType: target.evidenceType,
    evidenceId: target.id,
    label: target.label,
    sourceRefs: target.sourceRefs,
    focusSurface: target.focusSurface,
  });
  if (target.openPanelType) {
    eventBus.emit("openPanelRequest", {
      panelType: target.openPanelType,
      panelProps: videoId ? { videoId } : {},
    });
  }
  if (videoId && target.start !== undefined) {
    openVideoAtTime(videoId, target.start);
  }
  if (target.sourceRefs?.bbox_id || target.sourceRefs?.roi_id) {
    eventBus.emit("videoEvidenceSelected", {
      videoId,
      panelType: "MasterSchema",
      overlayKey: target.sourceRefs.bbox_id || target.sourceRefs.roi_id,
      modality: target.sourceRefs.bbox_id ? "bbox" : "roi",
      timestamp: target.start,
      label: target.label,
      sourceItem: target.sourceItem,
      navigationState: {
        activeTime: target.start,
        timeRange: target.sourceRefs.time_range,
        geometry: target.sourceRefs.bbox_id ? "bbox" : "roi",
      },
    });
  } else if (target.openPanelType === "SourceMediaMetadata") {
    eventBus.emit("sourceMediaMetadataFocusRequested", {
      videoId,
      evidenceId: target.id,
      label: target.label,
    });
  }
}

function firstSubcategory(category: ManualVisualAnnotation["category"]): string {
  return MANUAL_SUBCATEGORIES[category]?.[0] || "";
}

function manualCategoryDisplayLabel(category: ManualVisualAnnotation["category"]): string {
  return category === "Identification" ? "Narrative Agent" : category;
}

function manualSubcategoryDisplayLabel(
  category: ManualVisualAnnotation["category"],
  subcategory: string,
): string {
  if (category !== "Identification") return subcategory;
  if (subcategory === "Identity") return "Agent label";
  if (subcategory === "Character") return "Character / Agent";
  return subcategory;
}

function buildLeafDraft(item: ManualVisualAnnotation): LeafAnnotationDraft {
  const start =
    typeof item.start_seconds === "number"
      ? item.start_seconds
      : item.timestamp_seconds || 0;
  const end =
    typeof item.end_seconds === "number"
      ? item.end_seconds
      : item.timestamp_seconds || start;
  return {
    category: item.category,
    subcategory: item.subcategory || firstSubcategory(item.category),
    label:
      item.custom_label ||
      item.identity_affirmation ||
      item.role_affirmation ||
      item.label ||
      "",
    identityAffirmation: item.identity_affirmation || "",
    roleAffirmation: item.role_affirmation || "",
    start: Math.max(0, Math.min(start, end)),
    end: Math.max(start, end),
    note: item.open_note || "",
  };
}

function resolveLeafLabel(draft: LeafAnnotationDraft): string {
  const label = draft.label.trim();
  if (label) return label;
  if (draft.category === "Identification") return "Character present";
  if (draft.category === "OBJ") return "Object present";
  if (draft.category === "OCR") return "Visible text";
  return `${draft.category} indication`;
}

function formatSeconds(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "time n/a";
  }
  const safeValue = Math.max(0, value);
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.floor(safeValue % 60);
  const milliseconds = Math.floor((safeValue - Math.floor(safeValue)) * 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function formatNarrativeAgentTimeRange(time: unknown): string {
  const record = asRecord(time);
  const start = numberFrom(record.start ?? record.time_start);
  const end = numberFrom(record.end ?? record.time_end);
  if (start === undefined) return "source time pending";
  if (end === undefined || end === start) return formatSeconds(start);
  return `${formatSeconds(start)}-${formatSeconds(end)}`;
}

function narrativeAgentProliferationAudit(analysisData: unknown): Record<string, unknown> {
  const source = asRecord(analysisData);
  return asRecord(source.liveMatureDataProliferationAudit);
}

function narrativeAgentIdentityMemories(analysisData: unknown): Record<string, unknown>[] {
  return arrayFromUnknown(
    narrativeAgentProliferationAudit(analysisData).narrative_agent_identity_memories,
  ).map(asRecord);
}

function narrativeAgentIdentityContinuityCandidates(analysisData: unknown): Record<string, unknown>[] {
  return arrayFromUnknown(
    narrativeAgentProliferationAudit(analysisData).identity_continuity_candidates,
  ).map(asRecord);
}

function narrativeAgentMemoryMatchesRow(
  memory: Record<string, unknown>,
  row: NarrativeAgentPathRow,
): boolean {
  const memoryLabels = [
    memory.canonical_label,
    ...arrayStringsFromUnknown(memory.aliases),
  ].map(normalizeAgentKey).filter(Boolean);
  const rowLabels = [
    row.label,
    ...row.aliases,
    ...row.sourceLabels,
  ].map(normalizeAgentKey).filter(Boolean);
  return memoryLabels.some((memoryLabel) =>
    rowLabels.some((rowLabel) =>
      memoryLabel === rowLabel ||
      memoryLabel.includes(rowLabel) ||
      rowLabel.includes(memoryLabel),
    ),
  );
}

function narrativeAgentIdentityMemoryForRow(
  analysisData: unknown,
  row?: NarrativeAgentPathRow,
): Record<string, unknown> | undefined {
  const memories = narrativeAgentIdentityMemories(analysisData);
  if (!row) return memories[0];
  return memories.find((memory) => narrativeAgentMemoryMatchesRow(memory, row));
}

function narrativeAgentContinuityCandidatesForMemory(
  analysisData: unknown,
  memory?: Record<string, unknown>,
): Record<string, unknown>[] {
  const candidates = narrativeAgentIdentityContinuityCandidates(analysisData);
  if (!memory) return candidates.slice(0, 4);
  const agentId = stringFrom(memory.agent_id);
  const label = normalizeAgentKey(memory.canonical_label);
  return candidates.filter((candidate) => {
    const candidateAgentId = stringFrom(candidate.agent_id);
    const candidateLabel = normalizeAgentKey(candidate.candidate_label);
    return (
      (agentId && candidateAgentId === agentId) ||
      (label && candidateLabel === label)
    );
  });
}

function narrativeAgentTimelineHandles(row: NarrativeAgentPathRow): NarrativeAgentTimelineHandle[] {
  const handles: NarrativeAgentTimelineHandle[] = [];
  const sourceItems = row.sourceItems.length ? row.sourceItems : [row.sourceItem].filter(Boolean) as Record<string, unknown>[];
  sourceItems
    .flatMap((item, index) =>
      timeSupportsFromSourceItem(item).map((support) => ({
        key: `${row.key}:timeline:occurrence:${index}:${support.start}`,
        label: support.support === "manual" ? "manual" : "seen",
        kind: "occurrence" as const,
        time: support.start,
        end: support.end,
        title: `${support.support} occurrence ${formatSeconds(support.start)}-${formatSeconds(support.end ?? support.start)}`,
      })),
    )
    .slice(0, 24)
    .forEach((handle) => handles.push(handle));
  if (row.start !== undefined) {
    handles.push({
      key: `${row.key}:timeline:source:${row.start}`,
      label: "source",
      kind: "source",
      time: row.start,
      end: row.end,
      title: `Source anchor ${formatSeconds(row.start)}`,
    });
  }
  row.scenePresence.slice(0, 8).forEach((scene) => {
    handles.push({
      key: `${row.key}:timeline:scene:${scene.sceneIndex}:${scene.start}`,
      label: scene.sceneLabel,
      kind: "scene",
      time: scene.start,
      end: scene.end,
      title: `${scene.sceneLabel} ${scene.support} support ${formatSeconds(scene.start)}-${formatSeconds(scene.end)}`,
    });
  });
  row.cues.slice(0, 8).forEach((cue) => {
    const cueTime = secondsFromInstruction(cue);
    handles.push({
      key: `${row.key}:timeline:cue:${cue.instruction_id}`,
      label: "cue",
      kind: "cue",
      time: cueTime,
      title: `${cue.candidate_label || "cue"} ${formatSeconds(cueTime)}`,
    });
  });
  return handles
    .filter((handle) => Number.isFinite(handle.time))
    .sort((left, right) => left.time - right.time);
}

function narrativeAgentTimelinePosition(
  handle: NarrativeAgentTimelineHandle,
  handles: NarrativeAgentTimelineHandle[],
): number {
  return narrativeAgentTimelinePositionForTime(handle.time, handles);
}

function narrativeAgentTimelinePositionForTime(
  time: number,
  handles: NarrativeAgentTimelineHandle[],
): number {
  const times = [...handles.map((item) => item.time), time].filter((value) => Number.isFinite(value));
  if (times.length <= 1) return 50;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(max - min, 1);
  return Math.min(98, Math.max(2, ((time - min) / span) * 96 + 2));
}

function narrativeAgentTimelineDomain(
  handles: NarrativeAgentTimelineHandle[],
): { start: number; end: number } | null {
  const times = handles.flatMap((handle) => [handle.time, handle.end]).filter((time): time is number =>
    typeof time === "number" && Number.isFinite(time),
  );
  if (!times.length) return null;
  return { start: Math.min(...times), end: Math.max(...times) };
}

function narrativeAgentNearestTimelineHandles(
  handles: NarrativeAgentTimelineHandle[],
  cursorTime: number,
  limit = 5,
): NarrativeAgentTimelineHandle[] {
  return [...handles]
    .sort((left, right) =>
      Math.abs(left.time - cursorTime) - Math.abs(right.time - cursorTime) ||
      left.time - right.time,
    )
    .slice(0, limit)
    .sort((left, right) => left.time - right.time);
}

function narrativeAgentHandleRailGlyph(handle: NarrativeAgentTimelineHandle): string {
  if (handle.kind === "scene") return handle.label.replace(/^S/i, "");
  if (handle.kind === "source") return "S";
  return "";
}

function narrativeAgentGraphNodeTone(kind: NarrativeAgentGraphNode["kind"]): string {
  if (kind === "agent") return "border-cyan-400 bg-cyan-950 text-cyan-100";
  if (kind === "scene") return "border-emerald-500 bg-emerald-950 text-emerald-100";
  if (kind === "source") return "border-sky-500 bg-sky-950 text-sky-100";
  if (kind === "cue") return "border-violet-500 bg-violet-950 text-violet-100";
  return "border-amber-500 bg-amber-950 text-amber-100";
}

function narrativeAgentArchetypeLensById(lensId: NarrativeAgentArchetypeLensId) {
  return NARRATIVE_AGENT_ARCHETYPE_LENSES.find((lens) => lens.id === lensId) ||
    NARRATIVE_AGENT_ARCHETYPE_LENSES[0];
}

function narrativeAgentLensY(
  lensId: NarrativeAgentArchetypeLensId,
  kind: NarrativeAgentGraphNode["kind"],
  index: number,
): number {
  if (lensId === "shakespearean_performativity") {
    if (kind === "agent") return 48;
    if (kind === "scene") return 20;
    if (kind === "source") return 66;
    if (kind === "cue") return 82;
    return index % 2 === 0 ? 36 : 58;
  }
  if (lensId === "proppian_function") {
    if (kind === "agent") return 44;
    if (kind === "scene") return 18;
    if (kind === "source") return 78;
    if (kind === "cue") return 62;
    return 32 + (index % 3) * 16;
  }
  if (lensId === "jungian_symbolic") {
    if (kind === "agent") return 54;
    if (kind === "scene") return 72;
    if (kind === "source") return 82;
    if (kind === "cue") return 24 + (index % 2) * 10;
    return 44;
  }
  if (lensId === "greimasian_actant") {
    if (kind === "agent") return 50;
    if (kind === "scene") return 18 + (index % 2) * 12;
    if (kind === "source") return 82;
    if (kind === "cue") return 68;
    return 34 + (index % 4) * 10;
  }
  if (lensId === "burkean_motive") {
    if (kind === "agent") return 46;
    if (kind === "scene") return 30;
    if (kind === "source") return 76;
    if (kind === "cue") return 62;
    return index % 2 === 0 ? 18 : 86;
  }
  return kind === "agent" ? 50 : kind === "scene" ? 22 : kind === "source" ? 66 : kind === "cue" ? 82 : 72;
}

function narrativeAgentGraphNodeShortLabel(node: NarrativeAgentGraphNode): string {
  if (node.kind === "agent") return "Agent";
  if (node.kind === "scene") return node.label.replace(/^S/i, "S");
  if (node.kind === "source") return "Src";
  if (node.kind === "cue") return "Cue";
  return "Seen";
}

function narrativeAgentGraphNodeHandleLabel(node: NarrativeAgentGraphNode): string {
  const prefix = narrativeAgentGraphNodeShortLabel(node);
  if (node.time === undefined) return prefix;
  return `${prefix} ${formatSeconds(node.time)}`;
}

function seekNarrativeAgentGraphSource(videoId: string, time: number) {
  const timestamp = Math.max(0, Number(time || 0));
  eventBus.emit("videoTimeLineChanged", timestamp);
  eventBus.emit("narrativeAgentGraphSourceSeekRequested", {
    videoId,
    timestamp,
    source_panel: "NarrativeAgentPanel",
    focus_panel_changed: false,
  });
}

function buildNarrativeAgentGraphModel(
  row: NarrativeAgentPathRow,
  handles: NarrativeAgentTimelineHandle[],
  activeLensId: NarrativeAgentArchetypeLensId = "shakespearean_performativity",
): NarrativeAgentGraphModel {
  const agentNodeId = `agent:${row.key}`;
  const nodes: NarrativeAgentGraphNode[] = [{
    id: agentNodeId,
    label: row.label,
    kind: "agent",
    x: 50,
    y: narrativeAgentLensY(activeLensId, "agent", 0),
    time: row.start,
    end: row.end,
  }];
  const edges: NarrativeAgentGraphEdge[] = [];
  const addNode = (node: NarrativeAgentGraphNode, edge: Omit<NarrativeAgentGraphEdge, "id" | "source" | "target">) => {
    if (!nodes.some((item) => item.id === node.id)) {
      nodes.push(node);
    }
    edges.push({
      id: `edge:${agentNodeId}:${node.id}:${edge.kind}`,
      source: agentNodeId,
      target: node.id,
      ...edge,
    });
  };

  row.scenePresence.slice(0, 6).forEach((scene, index) => {
    const x = 12 + index * (76 / Math.max(1, Math.min(5, row.scenePresence.length - 1)));
    addNode(
      {
        id: `scene:${row.key}:${scene.sceneIndex}:${scene.start}`,
        label: scene.sceneLabel,
        kind: "scene",
        x,
        y: narrativeAgentLensY(activeLensId, "scene", index),
        time: scene.start,
        end: scene.end,
        scene,
      },
      {
        kind: "scene_presence",
        label: scene.support,
      },
    );
  });

  handles
    .filter((handle) => handle.kind !== "scene")
    .slice(0, 10)
    .forEach((handle, index, selectedHandles) => {
      const x = 10 + index * (80 / Math.max(1, selectedHandles.length - 1));
      const nodeKind = handle.kind === "source"
        ? "source"
        : handle.kind === "cue"
          ? "cue"
          : "occurrence";
      const y = narrativeAgentLensY(activeLensId, nodeKind, index);
      const kind = handle.kind === "source"
        ? "source_anchor"
        : handle.kind === "cue"
          ? "cue_support"
          : "occurrence_support";
      addNode(
        {
          id: `handle:${handle.key}`,
          label: handle.label,
          kind: handle.kind,
          x,
          y,
          time: handle.time,
          end: handle.end,
          handle,
        },
        {
          kind,
          label: handle.label,
        },
      );
    });

  return { nodes, edges };
}

function clampNarrativeAgentScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatNarrativeAgentScore(value: number): string {
  return `${Math.round(clampNarrativeAgentScore(value) * 100)}%`;
}

function narrativeAgentPlural(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildNarrativeAgentRelevanceSurface({
  row,
  activeLens,
  graphModel,
  timelineHandles,
  visualSampleSlots,
  audioSampleSlots,
  audiovisualSampleSlots,
  continuityCandidates,
  recommendationsCount,
}: {
  row: NarrativeAgentPathRow;
  activeLens: NarrativeAgentArchetypeLens;
  graphModel: NarrativeAgentGraphModel;
  timelineHandles: NarrativeAgentTimelineHandle[];
  visualSampleSlots: Record<string, unknown>[];
  audioSampleSlots: Record<string, unknown>[];
  audiovisualSampleSlots: Record<string, unknown>[];
  continuityCandidates: Record<string, unknown>[];
  recommendationsCount: number;
}): NarrativeAgentRelevanceSurface {
  const sceneCount = Math.max(row.sceneCount || 0, row.scenePresence.length);
  const manualCount = Math.max(row.manualCount || 0, row.sourceItems.length);
  const cueCount = Math.max(row.cueCount || 0, row.cues.length);
  const sampleCount = visualSampleSlots.length + audioSampleSlots.length + audiovisualSampleSlots.length;
  const sourceHandleCount = timelineHandles.length;
  const graphEvidenceCount = graphModel.nodes.length + graphModel.edges.length;
  const firstSourceTime = numberFrom(
    row.start ??
      row.scenePresence[0]?.start ??
      timelineHandles[0]?.time ??
      asRecord(visualSampleSlots[0]?.time).start ??
      asRecord(audioSampleSlots[0]?.time).start ??
      asRecord(audiovisualSampleSlots[0]?.time).start,
  );
  const taskFit = clampNarrativeAgentScore(
    0.2 + sceneCount * 0.09 + cueCount * 0.035 + graphModel.edges.length * 0.025,
  );
  const sourceStrength = clampNarrativeAgentScore(
    0.12 + manualCount * 0.12 + sourceHandleCount * 0.04 + sampleCount * 0.08,
  );
  const novelty = clampNarrativeAgentScore(
    0.35 + continuityCandidates.length * 0.08 + Math.max(0, row.sourceLabels.length - 1) * 0.05,
  );
  const comparativeValue = clampNarrativeAgentScore(
    0.2 + row.sourceLabels.length * 0.06 + sceneCount * 0.06 + continuityCandidates.length * 0.06,
  );
  const interpretiveValue = clampNarrativeAgentScore(
    0.18 + cueCount * 0.05 + sceneCount * 0.08 + graphEvidenceCount * 0.015,
  );
  const actionability = clampNarrativeAgentScore(
    recommendationsCount > 0 ? 0.72 + recommendationsCount * 0.035 : 0.88,
  );
  const dimensions: NarrativeAgentRelevanceDimension[] = [
    {
      id: "task_fit",
      label: "Task fit",
      score: taskFit,
      reason: `${row.label} has ${narrativeAgentPlural(sceneCount, "scene")} and ${narrativeAgentPlural(cueCount, "cue")} available for narrative analysis.`,
      evidenceCount: sceneCount + cueCount,
      sourceTime: firstSourceTime,
    },
    {
      id: "source_strength",
      label: "Source strength",
      score: sourceStrength,
      reason: `${narrativeAgentPlural(sourceHandleCount, "source handle")} and ${narrativeAgentPlural(manualCount, "confirmed item")} support this profile.`,
      evidenceCount: sourceHandleCount + manualCount,
      sourceTime: firstSourceTime,
    },
    {
      id: "novelty",
      label: "Novelty",
      score: novelty,
      reason: `${narrativeAgentPlural(continuityCandidates.length, "continuity candidate")} can change what Datascene knows about this character.`,
      evidenceCount: continuityCandidates.length,
      sourceTime: firstSourceTime,
    },
    {
      id: "comparative_value",
      label: "Comparative value",
      score: comparativeValue,
      reason: `${narrativeAgentPlural(row.sourceLabels.length, "label")} and ${narrativeAgentPlural(sceneCount, "scene")} allow comparison across appearances.`,
      evidenceCount: row.sourceLabels.length + sceneCount,
      sourceTime: firstSourceTime,
    },
    {
      id: "interpretive_value",
      label: "Interpretive value",
      score: interpretiveValue,
      reason: `${activeLens.tradition} currently reads this character through ${activeLens.description.toLowerCase()}`,
      evidenceCount: cueCount + graphEvidenceCount,
      sourceTime: firstSourceTime,
    },
    {
      id: "actionability",
      label: "Actionability",
      score: actionability,
      reason: recommendationsCount > 0
        ? `${narrativeAgentPlural(recommendationsCount, "next step")} can strengthen the profile.`
        : "The basic profile is ready for first-pass interpretation.",
      evidenceCount: recommendationsCount,
      sourceTime: firstSourceTime,
    },
  ];
  const overallScore = clampNarrativeAgentScore(
    dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / Math.max(1, dimensions.length),
  );
  return {
    overallScore,
    context: {
      analystGoal: "narrative analysis",
      targetAudience: "analyst",
      scope: "video",
      activeLens: activeLens.tradition,
    },
    statsSignals: [
      {
        label: "Source handles",
        value: sourceHandleCount,
        detail: "time-linked scene, cue, and source anchors",
      },
      {
        label: "Manual anchors",
        value: manualCount,
        detail: "confirmed or governed character evidence",
      },
      {
        label: "Samples",
        value: `${visualSampleSlots.length}/${audioSampleSlots.length}/${audiovisualSampleSlots.length}`,
        detail: "visual / audio / audiovisual memory slots",
      },
      {
        label: "Graph support",
        value: `${graphModel.nodes.length}/${graphModel.edges.length}`,
        detail: "nodes / edges in this character view",
      },
      {
        label: "Candidates",
        value: continuityCandidates.length,
        detail: "reviewable continuity candidates",
      },
    ],
    dimensions,
    significanceClaims: [
      {
        level: "Macro",
        title: "Narrative agency",
        text: `${row.label} is represented as a character-level agent across ${narrativeAgentPlural(sceneCount, "scene")}.`,
        evidenceCount: sceneCount + manualCount,
        sourceTime: firstSourceTime,
      },
      {
        level: "Meso",
        title: "Scene agency",
        text: `The selected lens organizes this character through ${activeLens.tradition} scene relations and source-linked handles.`,
        evidenceCount: graphModel.edges.length,
        sourceTime: firstSourceTime,
      },
      {
        level: "Micro",
        title: "Situational agency",
        text: `${narrativeAgentPlural(cueCount, "cue")} and ${narrativeAgentPlural(sourceHandleCount, "handle")} can anchor speaking, listening, looking, and action claims.`,
        evidenceCount: cueCount + sourceHandleCount,
        sourceTime: firstSourceTime,
      },
    ],
    firstSourceTime,
  };
}

function narrativeAgentPathProfileId(row: NarrativeAgentPathRow): string | undefined {
  const source = asRecord(row.sourceItem);
  const metadata = asRecord(source.metadata);
  return stringFrom(source.profile_id) ||
    stringFrom(metadata.profile_id) ||
    stringFrom(source.narrative_agent_profile_id) ||
    stringFrom(metadata.narrative_agent_profile_id);
}

function narrativeAgentPathNodeId(row: NarrativeAgentPathRow): string {
  const profileId = narrativeAgentPathProfileId(row);
  if (profileId) return `profile:narrative-agent:${profileId}`;
  return `narrative-agent-path:${row.key}`;
}

function narrativeAgentHandleSourceEvidenceRef(
  row: NarrativeAgentPathRow,
  handle: NarrativeAgentTimelineHandle,
) {
  const source = asRecord(row.sourceItem);
  const metadata = asRecord(source.metadata);
  const sourceId =
    stringFrom(source.id) ||
    stringFrom(source.annotation_id) ||
    stringFrom(source.profile_id) ||
    stringFrom(metadata.profile_id) ||
    `${row.key}:${handle.kind}:${handle.time}`;
  const sourceType = row.source.includes("Manual")
    ? "manual_visual_annotation"
    : row.source.includes("Source Media")
      ? "source_media_narrative_agent_profile"
      : "master_schema_narrative_agent";
  return {
    evidence_id: sourceId,
    source_type: sourceType,
    time_range: {
      start: handle.time,
      end: handle.end ?? handle.time,
    },
    traceback_record_id: `traceback:${sourceId}`,
    confidence: 1,
  };
}

function buildNarrativeAgentTimelinePresenceInterval(
  row: NarrativeAgentPathRow,
  handle: NarrativeAgentTimelineHandle,
  options?: { now?: string },
): MeaningNetworkPresenceInterval {
  const start = Math.max(0, Math.min(handle.time, handle.end ?? handle.time));
  const end = Math.max(start + 0.05, Math.max(handle.time, handle.end ?? handle.time));
  const nodeId = narrativeAgentPathNodeId(row);
  const profileId = narrativeAgentPathProfileId(row);
  const evidenceRef = narrativeAgentHandleSourceEvidenceRef(row, handle);
  return {
    id: `meaning-network-presence:${nodeId}`,
    node_id: nodeId,
    node_type: "narrative_agent",
    label: row.label,
    narrative_agent_profile_id: profileId,
    master_schema_surface: "narrative_agent_profile_annotations",
    lane_id: "on_camera_agents",
    presence_mode: "on_camera",
    start_seconds: Number(start.toFixed(3)),
    end_seconds: Number(end.toFixed(3)),
    authority_level: "manual_correction",
    source_panel: "NarrativeAgentPanel",
    source_profile_surface: "NarrativeAgentProfiles",
    source_verification_status: "source_time_resolved",
    source_range_source: "narrative_agent_timeline_handle",
    source_evidence_refs: [evidenceRef],
    source_traceback_refs: [evidenceRef.traceback_record_id],
    propagation_required: true,
    partial_propagation_allowed: false,
    proliferates_to: [
      "master_schema",
      "meaning_network",
      "narrative_agent_cards",
      "video_panel",
      "bbox_roi_panel",
      "scene_card_panel",
    ],
    updated_at: options?.now || new Date().toISOString(),
    updated_by: "analyst",
  };
}

type MeaningNetworkPresenceInterval = NonNullable<AnnotationCorrections["master_schema_presence_intervals"]>[number];

function normalizePresenceMatch(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function presenceIntervalsForMasterSubject(
  intervals: MeaningNetworkPresenceInterval[],
  subject: MasterSchemaResolvedEvidenceRecord,
) {
  const subjectId = normalizePresenceMatch(subject.id);
  const subjectLabel = normalizePresenceMatch(subject.label);
  const sourceItem = subject as unknown as Record<string, unknown>;
  const profileId = normalizePresenceMatch(
    sourceItem.profile_id ||
      sourceItem.narrative_agent_profile_id ||
      (sourceItem.attributes as Record<string, unknown> | undefined)?.profile_id ||
      (sourceItem.attributes as Record<string, unknown> | undefined)?.narrative_agent_profile_id,
  );
  return intervals.filter((interval) => {
    const intervalProfileId = normalizePresenceMatch(interval.narrative_agent_profile_id);
    const intervalLabel = normalizePresenceMatch(interval.label);
    const intervalNodeId = normalizePresenceMatch(interval.node_id);
    return Boolean(
      (profileId && (intervalProfileId === profileId || intervalNodeId.includes(profileId))) ||
        (subjectId && intervalNodeId.includes(subjectId)) ||
        (subjectLabel && (intervalLabel.includes(subjectLabel) || intervalNodeId.includes(subjectLabel))),
    );
  });
}

function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.includes(":")) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }
  const [minutesPart, secondsPart] = trimmed.split(":");
  const minutes = Number(minutesPart);
  const seconds = Number(secondsPart);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  return minutes * 60 + seconds;
}

function getManualAnnotationTitle(item: ManualVisualAnnotation): string {
  if (item.category === "Identification") {
    return (
      item.identity_affirmation ||
      item.custom_label ||
      item.label ||
      "Narrative Agent annotation"
    );
  }
  if (item.category === "Role") {
    return (
      item.role_affirmation ||
      item.identity_affirmation ||
      item.custom_label ||
      item.label ||
      "Role annotation"
    );
  }
  if (item.category === "Audio") {
    return (
      item.audio_foley_note ||
      item.custom_label ||
      item.label ||
      "Audio annotation"
    );
  }
  return item.label || item.custom_label || "Manual annotation";
}

function getManualAnnotationDetail(item: ManualVisualAnnotation): string {
  const details = [
    item.subcategory || "Unspecified subcategory",
    item.label && item.label !== getManualAnnotationTitle(item) ? item.label : "",
    item.identity_affirmation && item.category !== "Identification"
      ? `Narrative Agent: ${item.identity_affirmation}`
      : "",
    item.role_affirmation && item.category !== "Role"
      ? `role: ${item.role_affirmation}`
      : "",
    item.teaches_regime ? "teaches regime" : "",
  ].filter(Boolean);

  return details.join(" • ");
}

function AutomaticEvidenceSection({
  category,
  analysisData,
  videoId,
  identityLedger,
  identityActionMessage,
  isIdentityActionBusy,
  identityDrafts,
  onCreateIdentityCandidates,
  onIdentityDraftChange,
  onPromoteIdentityCandidate,
}: {
  category?: ManualVisualAnnotation["category"];
  analysisData: any;
  videoId?: string;
  identityLedger?: IdentityCandidateLedger | null;
  identityActionMessage?: string;
  isIdentityActionBusy?: boolean;
  identityDrafts?: Record<string, string>;
  onCreateIdentityCandidates?: () => void;
  onIdentityDraftChange?: (candidateId: string, value: string) => void;
  onPromoteIdentityCandidate?: (candidate: IdentityCandidate, label: string) => void;
}) {
  if (category === "Identification") {
    const candidates = identityLedger?.candidates || [];
    const openCandidateEvidence = (candidate: IdentityCandidate) => {
      if (!videoId) return;
      const evidence = candidate.evidence || {};
      const start = numberFrom(evidence.time_start);
      const end = numberFrom(evidence.time_end);
      const label =
        candidate.promoted_identity ||
        candidate.candidate_label ||
        candidate.candidate_id;
      const target: EvidenceNavigationTarget = {
        id: candidate.candidate_id,
        label,
        evidenceType: "narrative_agent_refinement_candidate",
        sourcePanel: "ManualIdentification",
        start,
        end,
        openPanelType: "ManualIdentification",
        focusSurface: "narrative_agent_refinement_candidates",
        sourceRefs: {
          media_id: videoId,
          video_time: start,
          time_range: start !== undefined || end !== undefined ? { start, end } : undefined,
          bbox_id:
            evidence.track_id !== undefined && evidence.track_id !== null
              ? String(evidence.track_id)
              : null,
          annotation_id:
            evidence.annotation_id !== undefined && evidence.annotation_id !== null
              ? String(evidence.annotation_id)
              : candidate.candidate_id,
        },
        sourceItem: candidate as unknown as Record<string, unknown>,
      };
      openEvidenceNavigation(videoId, target);
      emitEvidenceTraceback(videoId, target);
    };
    return (
      <section className="mb-2 rounded border border-slate-800 bg-slate-950/20">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <h3 className="text-[11px] font-semibold text-slate-200">
            Narrative Agent refinement candidates
          </h3>
          <span className="text-[10px] text-[var(--ui-passive-text)]">
            {candidates.length}
          </span>
        </div>
        <div className="space-y-2 p-2">
          {candidates.length === 0 ? (
            <div className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-[10px] text-[var(--ui-passive-text)]">
              No Narrative Agent candidates prepared for this analysis.
            </div>
          ) : (
            candidates.map((candidate) => (
              <div
                key={candidate.candidate_id}
                role="button"
                tabIndex={0}
                className="rounded border border-slate-800 bg-[#111214] px-2 py-2 text-[10px] text-slate-200"
                onClick={() => openCandidateEvidence(candidate)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCandidateEvidence(candidate);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {candidate.promoted_identity ||
                        candidate.candidate_label ||
                        candidate.candidate_id}
                    </div>
                    <div className="mt-0.5 text-[var(--ui-passive-text)]">
                      {candidate.evidence?.annotation_type || "annotation"}{" "}
                      {candidate.evidence?.track_id
                        ? `track ${candidate.evidence.track_id}`
                        : candidate.evidence?.annotation_id || ""}
                      {candidate.evidence?.time_start !== undefined
                        ? ` • ${formatSeconds(candidate.evidence.time_start)}`
                        : ""}
                    </div>
                  </div>
                  <span className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">
                    {candidate.review_state || "unreviewed"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <input
                    onClick={(event) => event.stopPropagation()}
                    value={
                      identityDrafts?.[candidate.candidate_id] ??
                      candidate.promoted_identity ??
                      ""
                    }
                    onChange={(event) =>
                      onIdentityDraftChange?.(
                        candidate.candidate_id,
                        event.target.value,
                      )
                    }
                    disabled={
                      isIdentityActionBusy || candidate.review_state === "promoted"
                    }
                    placeholder="Confirmed Narrative Agent label"
                    className="min-w-0 flex-1 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100 outline-none focus:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPromoteIdentityCandidate?.(
                        candidate,
                        identityDrafts?.[candidate.candidate_id] ||
                          candidate.promoted_identity ||
                          "",
                      );
                    }}
                    disabled={
                      isIdentityActionBusy ||
                      candidate.review_state === "promoted" ||
                      !(
                        identityDrafts?.[candidate.candidate_id] ||
                        candidate.promoted_identity ||
                        ""
                      ).trim()
                    }
                    className="shrink-0 rounded border border-emerald-500/30 bg-emerald-950/20 px-2 py-1 text-[10px] text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Promote
                  </button>
                </div>
                <div className="mt-1 text-[var(--ui-passive-text)]">
                  Visual, cinematic, speaker, and reference evidence slots are reserved.
                </div>
              </div>
            ))
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--ui-passive-text)]">
              {identityActionMessage || identityLedger?.status || "Candidate review ready."}
            </span>
            <button
              type="button"
              disabled={isIdentityActionBusy}
              className="rounded border border-cyan-500/30 bg-cyan-950/20 px-2 py-1 text-[10px] text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onCreateIdentityCandidates}
            >
              Refresh candidates
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (category === "Audio") {
    const audioProsody = analysisData?.audioProsody || [];
    return (
      <section className="mb-2 rounded border border-slate-800 bg-slate-950/20">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <h3 className="text-[11px] font-semibold text-slate-200">
            Automatic audio evidence
          </h3>
          <span className="text-[10px] text-[var(--ui-passive-text)]">
            {audioProsody.length}
          </span>
        </div>
        <div className="space-y-1 p-2">
          {audioProsody.length === 0 ? (
            <div className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-[10px] text-[var(--ui-passive-text)]">
              No automatic audio prosody cues available.
            </div>
          ) : (
            audioProsody.map((cue: any) => (
              <button
                key={cue.cue_id || `${cue.start}-${cue.end}`}
                type="button"
                className="block w-full rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-slate-900/60"
                onClick={() =>
                  eventBus.emit("videoTimeLineChanged", Number(cue.start || 0))
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">
                    {cue.sound_environment?.label || "Audio cue"}
                  </span>
                  <span className="shrink-0 text-[var(--ui-passive-text)]">
                    {formatSeconds(cue.start)}-{formatSeconds(cue.end)}
                  </span>
                </div>
                <div className="mt-0.5 text-[var(--ui-passive-text)]">
                  Pace {cue.pace?.label || "n/a"} • Rhythm{" "}
                  {cue.rhythm_profile?.label || "n/a"} • Tonality{" "}
                  {cue.tonality_profile?.label || "n/a"}
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  if (category === "Genre") {
    const sourceAnnotations = analysisData?.metadata?.sourceAnnotations || {};
    const rows = [
      ["Media genre", sourceAnnotations.genre],
      ["Media subgenre", sourceAnnotations.genre_subtype],
      ["Situational genre", sourceAnnotations.situational_genre],
      ["Situational subgenre", sourceAnnotations.situational_subtype],
    ].filter(([, value]) => value);

    return (
      <section className="mb-2 rounded border border-slate-800 bg-slate-950/20">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <h3 className="text-[11px] font-semibold text-slate-200">
            Source genre evidence
          </h3>
          <span className="text-[10px] text-[var(--ui-passive-text)]">
            {rows.length}
          </span>
        </div>
        <div className="space-y-1 p-2">
          {rows.length === 0 ? (
            <div className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-[10px] text-[var(--ui-passive-text)]">
              No source-level genre annotations available.
            </div>
          ) : (
            rows.map(([label, value]) => (
              <div
                key={label}
                className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-[10px] text-slate-200"
              >
                <div className="font-medium">{value}</div>
                <div className="mt-0.5 text-[var(--ui-passive-text)]">
                  {label}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  return null;
}

function MatureEvidenceStrip({ analysisData }: { analysisData: AnalysisData | null }) {
  const resolved = analysisData?.masterSchemaResolvedEvidence;
  if (!resolved) return null;
  const labels: Record<string, string> = {
    manual_correction: "Manual corrections",
    manual_annotation: "Manual annotations",
    mature_triangulated: "Triangulated",
    interpreted_detection: "Interpreted",
    raw_detection: "Raw",
  };
  const order: MatureEvidenceAuthority[] = resolved.authorityOrder || [];
  const counts = resolved.counts || {};
  return (
    <section className="mb-2 rounded border border-emerald-500/20 bg-emerald-950/10 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
            Evidence reliability
          </div>
          <div className="mt-0.5 text-[10px] text-[var(--ui-passive-text)]">
            Master Schema first-read layer; raw repositories remain preserved.
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {order.map((authority) => (
            <span
              key={authority}
              className="rounded border border-slate-700 bg-[#111214] px-2 py-1 text-[10px] text-slate-200"
            >
              {labels[authority] || authority}: {counts[authority] || 0}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatAuditLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

const ANCHOR_SURFACE_NAVIGATION: Record<
  string,
  { panelType: string; evidenceType: string; focusSurface: string; label: string }
> = {
  panel_corrections: {
    panelType: "MasterSchema",
    evidenceType: "manual_panel_corrections",
    focusSurface: "panel_corrections",
    label: "Panel Corrections",
  },
  bbox_roi_corrections: {
    panelType: "VideoPanel",
    evidenceType: "bbox_roi_corrections",
    focusSurface: "bbox_roi_corrections",
    label: "Bbox Roi Corrections",
  },
  metadata_corrections: {
    panelType: "SourceMediaMetadata",
    evidenceType: "metadata_corrections",
    focusSurface: "metadata_corrections",
    label: "Metadata Corrections",
  },
  narrative_agent_profiles: {
    panelType: "ManualIdentification",
    evidenceType: "narrative_agent_profiles",
    focusSurface: "narrative_agent_profiles",
    label: "Narrative Agent Profiles",
  },
};

function surfaceNavigation(surface: { surface?: string; route?: string }) {
  const key = (surface.surface || surface.route || "").toLowerCase();
  return ANCHOR_SURFACE_NAVIGATION[key] || {
    panelType: "TracebackDrawer",
    evidenceType: key || "user_confirmed_anchor",
    focusSurface: key || "user_confirmed_anchor",
    label: formatAuditLabel(surface.surface || surface.route || "Anchor surface"),
  };
}

function ConfirmationProgramStrip({
  analysisData,
  videoId,
}: {
  analysisData: AnalysisData | null;
  videoId: string;
}) {
  const [localInspection, setLocalInspection] = useState<{
    id: string;
    label: string;
    kind: "anchor" | "family" | "program";
    status?: string;
    route?: string;
    note: string;
    target: EvidenceNavigationTarget;
  } | null>(null);
  const audit = analysisData?.metadata?.masterSchemaMaturityAudit;
  const anchor = audit?.user_confirmed_anchor;
  const program = audit?.confirmation_program;
  if (!anchor && !program) return null;
  const anchorSurfaces = anchor?.anchor_surfaces || [];
  const families = program?.confirmation_families || [];
  const openAnchorSurface = (surface: { surface?: string; status?: string; route?: string }) => {
    const navigation = surfaceNavigation(surface);
    const target: EvidenceNavigationTarget = {
      id: surface.surface || surface.route || navigation.focusSurface,
      label: navigation.label,
      evidenceType: navigation.evidenceType,
      sourcePanel: "MasterSchema",
      openPanelType: navigation.panelType === "TracebackDrawer" ? undefined : navigation.panelType,
      focusSurface: navigation.focusSurface,
      sourceRefs: { media_id: videoId, metadata_id: surface.route || surface.surface || null },
      sourceItem: surface as Record<string, unknown>,
    };
    setLocalInspection({
      id: target.id,
      label: navigation.label,
      kind: "anchor",
      status: surface.status || "pending",
      route: surface.route || surface.surface,
      note: "This tells Datascene which analyst-confirmed evidence can be trusted before wider matching or character interpretation.",
      target,
    });
  };
  const openConfirmationFamily = (family: string) => {
    const target: EvidenceNavigationTarget = {
      id: `confirmation_family:${family}`,
      label: formatAuditLabel(family),
      evidenceType: "concise_pattern_confirmation",
      sourcePanel: "MasterSchema",
      openPanelType: "TracebackDrawer",
      focusSurface: family,
      sourceRefs: { media_id: videoId, metadata_id: family },
      sourceItem: {
        confirmation_family: family,
        consults_user_confirmed_anchor: program?.consults_user_confirmed_anchor,
      },
    };
    setLocalInspection({
      id: target.id,
      label: formatAuditLabel(family),
      kind: "family",
      status: program?.consults_user_confirmed_anchor ? "uses confirmed anchors" : "anchor consultation pending",
      route: family,
      note: "This confirmation family describes what kind of character evidence should consult already-confirmed anchors before becoming mature data.",
      target,
    });
  };
  const inspectProgram = () => {
    const target: EvidenceNavigationTarget = {
      id: "user_confirmed_anchor",
      label: program?.consults_user_confirmed_anchor
        ? "Confirmed anchors are active"
        : "Anchor consultation pending",
      evidenceType: "user_confirmed_anchor",
      sourcePanel: "MasterSchema",
      focusSurface: "user_confirmed_anchor",
      sourceRefs: { media_id: videoId, metadata_id: "user_confirmed_anchor" },
      sourceItem: asRecord(audit),
    };
    setLocalInspection({
      id: target.id,
      label: target.label,
      kind: "program",
      status: program?.consults_user_confirmed_anchor ? "active" : "pending",
      route: "user_confirmed_anchor",
      note: anchor?.principle || "User confirmed corrections and annotations anchor mature sense-making.",
      target,
    });
  };
  return (
    <section className="mb-2 rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
            Analyst confirmations
          </div>
          <div className="mt-0.5 max-w-3xl text-[10px] text-[var(--ui-passive-text)]">
            {anchor?.principle ||
              "User confirmed corrections and annotations anchor mature sense-making."}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-cyan-700/60 bg-[#111214] px-2 py-1 text-[10px] text-cyan-100 hover:border-cyan-400/80 hover:bg-cyan-950/30"
          onClick={inspectProgram}
        >
          {program?.consults_user_confirmed_anchor
            ? "Inspect confirmed anchors"
            : "Anchor consultation pending"}
        </button>
      </div>
      {localInspection ? (
        <div
          className="mt-2 rounded border border-cyan-800/60 bg-cyan-950/20 px-2 py-2"
          data-vaa1-user-confirmed-anchor-local-inspection="true"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-cyan-100">
                {localInspection.label}
              </div>
              <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--ui-passive-text)]">
                {localInspection.note}
              </div>
            </div>
            <span className="shrink-0 rounded border border-cyan-700/60 bg-[#101010] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-cyan-100">
              {localInspection.status || localInspection.kind}
            </span>
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1">
              <div className="text-[8px] uppercase tracking-[0.12em] text-slate-500">What this is</div>
              <div className="mt-0.5 text-[10px] text-slate-200">{localInspection.kind}</div>
            </div>
            <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1">
              <div className="text-[8px] uppercase tracking-[0.12em] text-slate-500">Where it applies</div>
              <div className="mt-0.5 truncate text-[10px] text-slate-200">{localInspection.route || "anchor program"}</div>
            </div>
            <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1">
              <div className="text-[8px] uppercase tracking-[0.12em] text-slate-500">Panel behavior</div>
              <div className="mt-0.5 text-[10px] text-slate-200">stays here unless opened</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="rounded border border-cyan-700/70 bg-[#101010] px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/30"
              onClick={() => openEvidenceNavigation(videoId, localInspection.target)}
            >
              Open linked source
            </button>
            <button
              type="button"
              className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-200 hover:border-cyan-700"
              onClick={() => emitEvidenceTraceback(videoId, localInspection.target)}
            >
              Open Traceback
            </button>
            <button
              type="button"
              className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500"
              onClick={() => setLocalInspection(null)}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
      {anchorSurfaces.length > 0 && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {anchorSurfaces.map((surface) => {
            const navigation = surfaceNavigation(surface);
            return (
            <button
              key={surface.surface || surface.route}
              type="button"
              onClick={() => openAnchorSurface(surface)}
              className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5"
            >
              <div className="text-[10px] font-medium text-slate-200">
                {navigation.label}
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-cyan-200/80">
                {surface.status || "pending"}
              </div>
            </button>
          )})}
        </div>
      )}
      {families.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Concise Pattern Confirmations
          </div>
          <div className="flex flex-wrap gap-1.5">
            {families.map((family) => (
              <button
                key={family}
                type="button"
                onClick={() => openConfirmationFamily(family)}
                className="rounded border border-slate-700 bg-[#111214] px-2 py-1 text-[10px] text-slate-200 hover:border-cyan-400/70 hover:bg-cyan-950/30"
              >
                {formatAuditLabel(family)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function masterSubjectRecords(
  analysisData: AnalysisData | null,
): MasterSchemaResolvedEvidenceRecord[] {
  return (analysisData?.masterSchemaResolvedEvidence?.records || []).filter((record) =>
    ["narrative_agent_profile", "character_role"].includes(record.category),
  );
}

function MasterSchemaSubjectStrip({
  analysisData,
  videoId,
}: {
  analysisData: AnalysisData | null;
  videoId: string;
}) {
  const subjects = masterSubjectRecords(analysisData);
  const presenceIntervals = analysisData?.annotationCorrections?.master_schema_presence_intervals || [];
  if (subjects.length === 0) {
    return null;
  }
  const openSubject = (subject: MasterSchemaResolvedEvidenceRecord) => {
    const sourceRefs = buildRecordSourceRefs(videoId, subject);
    const hasTime = subject.start !== undefined || sourceRefs.video_time !== undefined;
    const hasGeometry = Boolean(sourceRefs.bbox_id || sourceRefs.roi_id);
    const target: EvidenceNavigationTarget = {
      id: subject.id,
      label: subject.label,
      evidenceType: "narrative_agent",
      sourcePanel: subject.sourcePanel || "MasterSchema",
      start: numberFrom(subject.start ?? sourceRefs.video_time),
      end: numberFrom(subject.end ?? sourceRefs.time_range?.end),
      openPanelType:
        hasTime || hasGeometry ? "ManualIdentification" : "SourceMediaMetadata",
      focusSurface: "master_schema_subject_authority",
      sourceRefs,
      sourceItem: subject as unknown as Record<string, unknown>,
    };
    openEvidenceNavigation(videoId, target);
  };
  const openSubjectTraceback = (
    event: React.MouseEvent,
    subject: MasterSchemaResolvedEvidenceRecord,
  ) => {
    event.preventDefault();
    emitEvidenceTraceback(videoId, {
      id: subject.id,
      label: subject.label,
      evidenceType: "narrative_agent",
      sourcePanel: subject.sourcePanel || "MasterSchema",
      start: numberFrom(subject.start),
      end: numberFrom(subject.end),
      sourceRefs: buildRecordSourceRefs(videoId, subject),
      sourceItem: subject as unknown as Record<string, unknown>,
    });
  };
  return (
    <section className="mb-2 rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
            Known character profiles
          </div>
          <div className="mt-0.5 text-[10px] text-[var(--ui-passive-text)]">
            Governed Narrative Agent Profiles and character-role metadata are the mature subject source for downstream panels.
          </div>
        </div>
        <span className="shrink-0 rounded border border-cyan-700/60 bg-[#111214] px-2 py-1 text-[10px] text-cyan-100">
          {subjects.length} governed subject{subjects.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
        {subjects.slice(0, 18).map((subject) => {
          const subjectPresenceIntervals = presenceIntervalsForMasterSubject(presenceIntervals, subject);
          return (
          <button
            key={subject.id}
            type="button"
            data-vaa1-master-schema-subject-navigation="true"
            data-vaa1-master-schema-presence-interval-sync="true"
            onClick={() => openSubject(subject)}
            onContextMenu={(event) => openSubjectTraceback(event, subject)}
            className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-left hover:border-cyan-400/70 hover:bg-cyan-950/25"
          >
            <div className="truncate text-[10px] font-medium text-slate-100">
              {subject.label}
            </div>
            <div className="mt-0.5 truncate text-[9px] text-[var(--ui-passive-text)]">
              {subject.category.replaceAll("_", " ")} / {subject.maturityRoute || "master schema"}
            </div>
            {subjectPresenceIntervals.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {subjectPresenceIntervals.slice(0, 2).map((interval) => (
                  <span
                    key={interval.id || `${interval.node_id}:${interval.start_seconds}`}
                    className="rounded border border-emerald-800/70 bg-emerald-950/20 px-1 py-0.5 text-[8px] text-emerald-100"
                    title={`${interval.source_panel || "MeaningNetwork"} / ${interval.authority_level || "candidate"}`}
                  >
                    {formatSeconds(interval.start_seconds)}-{formatSeconds(interval.end_seconds)}
                  </span>
                ))}
              </div>
            ) : null}
          </button>
        );})}
      </div>
    </section>
  );
}

function MatureProliferationMatchStrip({
  matches,
  videoId,
}: {
  matches?: EvidenceProliferationMatchSummary[];
  videoId: string;
}) {
  const visibleMatches = (matches || []).filter(
    (match) => match.request_id || match.candidate_count,
  );
  if (visibleMatches.length === 0) {
    return null;
  }
  return (
    <section className="mb-2 rounded border border-amber-500/20 bg-amber-950/10 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">
            Suggested matches
          </div>
          <div className="mt-0.5 text-[10px] text-[var(--ui-passive-text)]">
            Mature evidence matches remain candidate support until source evidence confirms them.
          </div>
        </div>
        <span className="shrink-0 rounded border border-amber-700/60 bg-[#111214] px-2 py-1 text-[10px] text-amber-100">
          {visibleMatches.length} run{visibleMatches.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
        {visibleMatches.slice(0, 12).map((match, index) => {
          const requestId = match.request_id || `proliferation_match:${index}`;
          const candidateCount = Number(match.candidate_count || 0);
          const label = `${candidateCount} candidate${
            candidateCount === 1 ? "" : "s"
          } / ${match.status || "completed"}`;
          return (
            <button
              key={requestId}
              type="button"
              data-vaa1-proliferation-match-navigation="true"
              className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-left hover:border-amber-400/70 hover:bg-amber-950/25"
              onClick={() =>
                emitEvidenceTraceback(videoId, {
                  id: requestId,
                  label,
                  evidenceType: "evidence_proliferation_match",
                  sourcePanel: "MasterSchema",
                  sourceRefs: {
                    media_id: videoId,
                    metadata_id: requestId,
                  },
                  sourceItem: {
                    ...match,
                    governance: {
                      outputs_are_candidates_until_supported_by_evidence: true,
                      manual_correction_wins: true,
                      traceback_required: true,
                    },
                  },
                })
              }
            >
              <div className="truncate text-[10px] font-medium text-slate-100">
                {label}
              </div>
              <div className="mt-0.5 truncate text-[9px] text-[var(--ui-passive-text)]">
                {requestId}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PanelDropdownSection({
  title,
  summary,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  count?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="mb-2 rounded border border-slate-800 bg-slate-950/20"
      open={defaultOpen}
      data-vaa1-headline-dropdown="true"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-200 marker:content-none">
        <span className="min-w-0">
          <span className="block uppercase tracking-[0.12em] text-cyan-200">
            {title}
          </span>
          {summary ? (
            <span className="mt-0.5 block text-[9px] font-normal normal-case leading-relaxed text-[var(--ui-passive-text)]">
              {summary}
            </span>
          ) : null}
        </span>
        {count !== undefined ? (
          <span className="shrink-0 rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] font-normal text-slate-300">
            {count}
          </span>
        ) : null}
      </summary>
      <div className="p-2" data-vaa1-headline-dropdown-body="true">
        {children}
      </div>
    </details>
  );
}

function NarrativeAgentCharacterPathsHome({
  analysisData,
  videoId,
  openPanel,
  onCommitTimelineHandle,
}: {
  analysisData: any;
  videoId: string;
  openPanel: (panelType: string, panelProps?: any) => void;
  onCommitTimelineHandle: (commit: NarrativeAgentTimelineHandleCommit) => void;
}) {
  const rows = useMemo(
    () => buildNarrativeAgentPathRows(analysisData),
    [analysisData],
  );
  const [selectedAgentKey, setSelectedAgentKey] = useState("");
  const [activeNarrativeAgentArchetypeLens, setActiveNarrativeAgentArchetypeLens] =
    useState<NarrativeAgentArchetypeLensId>("shakespearean_performativity");
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState("");
  const [graphDurationDrafts, setGraphDurationDrafts] = useState<Record<string, { start: number; end: number }>>({});
  const [graphNodeHandleDrag, setGraphNodeHandleDrag] = useState<{
    nodeId: string;
    handle: "start" | "end";
    originX: number;
    originStart: number;
    originEnd: number;
    secondsPerPixel: number;
  } | null>(null);
  const [videoTimelineCursor, setVideoTimelineCursor] = useState(0);
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!rows.length) {
      if (selectedAgentKey) setSelectedAgentKey("");
      return;
    }
    if (!selectedAgentKey || !rows.some((row) => row.key === selectedAgentKey)) {
      setSelectedAgentKey(rows[0].key);
    }
  }, [rows, selectedAgentKey]);
  const selectedRow = rows.find((row) => row.key === selectedAgentKey) || rows[0];
  const selectedTimelineHandles = selectedRow ? narrativeAgentTimelineHandles(selectedRow) : [];
  const activeNarrativeAgentArchetype = narrativeAgentArchetypeLensById(activeNarrativeAgentArchetypeLens);
  const selectedGraphModel = selectedRow
    ? buildNarrativeAgentGraphModel(selectedRow, selectedTimelineHandles, activeNarrativeAgentArchetypeLens)
    : { nodes: [], edges: [] };
  const selectedGraphNode =
    selectedGraphModel.nodes.find((node) => node.id === selectedGraphNodeId) ||
    selectedGraphModel.nodes[0];
  const selectedGraphNodeDraft = selectedGraphNode?.time !== undefined
    ? graphDurationDrafts[selectedGraphNode.id] || {
        start: selectedGraphNode.time,
        end: Math.max(selectedGraphNode.end ?? selectedGraphNode.time + 2, selectedGraphNode.time + 0.05),
      }
    : null;
  const selectedTimelineDomain = narrativeAgentTimelineDomain(selectedTimelineHandles);
  const selectedTimelineCursorLeft = selectedTimelineHandles.length
    ? narrativeAgentTimelinePositionForTime(videoTimelineCursor, selectedTimelineHandles)
    : 50;
  const selectedNearbyTimelineHandles = narrativeAgentNearestTimelineHandles(
    selectedTimelineHandles,
    videoTimelineCursor,
  );
  const selectedIdentityMemory = narrativeAgentIdentityMemoryForRow(analysisData, selectedRow);
  const selectedIdentityContinuityCandidates = narrativeAgentContinuityCandidatesForMemory(
    analysisData,
    selectedIdentityMemory,
  );
  const selectedVisualSampleSlots = arrayFromUnknown(
    selectedIdentityMemory?.visual_sample_slots,
  ).map(asRecord);
  const selectedAudioSampleSlots = arrayFromUnknown(
    selectedIdentityMemory?.audio_sample_slots,
  ).map(asRecord);
  const selectedAudiovisualSampleSlots = arrayFromUnknown(
    selectedIdentityMemory?.audiovisual_sample_slots,
  ).map(asRecord);
  const selectedCharacterRecommendations = selectedRow ? [
    ...(!selectedIdentityMemory ? [{
      title: "Create identity memory",
      detail: "Confirm this character on a time and BBox/ROI anchored source sample so future matches have a trusted reference.",
      action: "Use a visible source handle or BBox confirmation.",
    }] : []),
    ...(selectedVisualSampleSlots.length === 0 ? [{
      title: "Add visual samples",
      detail: "The character needs one or more source-linked visual samples, especially if clothing or setting changes between scenes.",
      action: "Open a source moment where the face or body is visible.",
    }] : []),
    ...(selectedAudioSampleSlots.length === 0 ? [{
      title: "Add audio samples",
      detail: "Voice and speech evidence should participate in character continuity, not only visual matching.",
      action: "Use a speaking moment or transcript-linked audio cue.",
    }] : []),
    ...(selectedRow.scenePresence.length === 0 ? [{
      title: "Mark scene presence",
      detail: "Scene-level presence helps Datascene understand where the character matters even before every BBox is resolved.",
      action: "Confirm the character in at least one governed scene.",
    }] : []),
    ...(selectedRow.manualCount === 0 ? [{
      title: "Add analyst confirmation",
      detail: "No manual confirmation is attached to this profile yet. A single good confirmation can strengthen downstream matching.",
      action: "Confirm a source-time annotation for this character.",
    }] : []),
    ...(selectedIdentityContinuityCandidates.length > 0 ? [{
      title: "Review possible matches",
      detail: `${selectedIdentityContinuityCandidates.length} continuity candidate${selectedIdentityContinuityCandidates.length === 1 ? "" : "s"} can be checked against this character.`,
      action: "Open the graph/source handles and compare candidates.",
    }] : []),
  ].slice(0, 4) : [];
  const selectedRelevanceSurface = selectedRow ? buildNarrativeAgentRelevanceSurface({
    row: selectedRow,
    activeLens: activeNarrativeAgentArchetype,
    graphModel: selectedGraphModel,
    timelineHandles: selectedTimelineHandles,
    visualSampleSlots: selectedVisualSampleSlots,
    audioSampleSlots: selectedAudioSampleSlots,
    audiovisualSampleSlots: selectedAudiovisualSampleSlots,
    continuityCandidates: selectedIdentityContinuityCandidates,
    recommendationsCount: selectedCharacterRecommendations.length,
  }) : null;
  useEffect(() => {
    const handler = (time: number) => {
      const next = Number(time);
      if (Number.isFinite(next)) {
        setVideoTimelineCursor(Math.max(0, next));
      }
    };
    eventBus.on("videoTimeLineChanged", handler);
    return () => eventBus.off("videoTimeLineChanged", handler);
  }, []);
  useEffect(() => {
    if (!selectedGraphModel.nodes.length) {
      if (selectedGraphNodeId) setSelectedGraphNodeId("");
      return;
    }
    if (!selectedGraphNodeId || !selectedGraphModel.nodes.some((node) => node.id === selectedGraphNodeId)) {
      setSelectedGraphNodeId(selectedGraphModel.nodes[0].id);
    }
  }, [selectedGraphModel.nodes, selectedGraphNodeId]);
  const openSelectedAgentAnnotationCard = () => {
    if (!selectedRow) return;
    const nodeId = narrativeAgentPathNodeId(selectedRow);
    const payload = {
      videoId,
      nodeId,
      label: selectedRow.label,
      sourcePanel: "NarrativeAgentPanel",
    };
    eventBus.emit("narrativeAgentGraphAnnotationCardRequested", payload);
  };
  const selectNarrativeAgentGraphNode = (node: NarrativeAgentGraphNode) => {
    setSelectedGraphNodeId(node.id);
    if (node.time !== undefined) {
      const nodeTime = node.time;
      setGraphDurationDrafts((current) => ({
        ...current,
        [node.id]: current[node.id] || {
          start: nodeTime,
          end: Math.max(node.end ?? nodeTime + 2, nodeTime + 0.05),
        },
      }));
    }
    if (videoId && node.time !== undefined) {
      seekNarrativeAgentGraphSource(videoId, node.time);
    }
    eventBus.emit("narrativeAgentGraphNodeSelected", {
      videoId,
      row_key: selectedRow?.key,
      label: selectedRow?.label,
      node_id: node.id,
      node_kind: node.kind,
      timestamp: node.time,
      end_timestamp: node.end,
      source_panel: "NarrativeAgentPanel",
    });
  };
  const updateSelectedGraphNodeDraft = (patch: Partial<{ start: number; end: number }>) => {
    if (!selectedGraphNode || selectedGraphNode.time === undefined) return;
    setGraphDurationDrafts((current) => {
      const existing = current[selectedGraphNode.id] || selectedGraphNodeDraft || {
        start: selectedGraphNode.time || 0,
        end: Math.max(selectedGraphNode.end ?? (selectedGraphNode.time || 0) + 2, (selectedGraphNode.time || 0) + 0.05),
      };
      const start = Math.max(0, patch.start ?? existing.start);
      const end = Math.max(start + 0.05, patch.end ?? existing.end);
      return {
        ...current,
        [selectedGraphNode.id]: { start, end },
      };
    });
  };
  const startNarrativeAgentGraphNodeHandleDrag = (
    event: React.PointerEvent<HTMLSpanElement>,
    node: NarrativeAgentGraphNode,
    handle: "start" | "end",
  ) => {
    if (node.time === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    selectNarrativeAgentGraphNode(node);
    const existing = graphDurationDrafts[node.id] || {
      start: node.time,
      end: Math.max(node.end ?? node.time + 2, node.time + 0.05),
    };
    const graphWidth = Math.max(1, graphCanvasRef.current?.getBoundingClientRect().width || 520);
    const domainStart = selectedTimelineDomain?.start ?? 0;
    const domainEnd = Math.max(selectedTimelineDomain?.end ?? existing.end, existing.end, existing.start + 10);
    setGraphNodeHandleDrag({
      nodeId: node.id,
      handle,
      originX: event.clientX,
      originStart: existing.start,
      originEnd: existing.end,
      secondsPerPixel: Math.max((domainEnd - domainStart) / graphWidth, 0.01),
    });
  };
  useEffect(() => {
    if (!graphNodeHandleDrag) return;
    const handlePointerMove = (event: PointerEvent) => {
      const deltaSeconds = (event.clientX - graphNodeHandleDrag.originX) * graphNodeHandleDrag.secondsPerPixel;
      const nextStart = graphNodeHandleDrag.handle === "start"
        ? Math.max(0, graphNodeHandleDrag.originStart + deltaSeconds)
        : graphNodeHandleDrag.originStart;
      const nextEnd = graphNodeHandleDrag.handle === "end"
        ? Math.max(nextStart + 0.05, graphNodeHandleDrag.originEnd + deltaSeconds)
        : Math.max(nextStart + 0.05, graphNodeHandleDrag.originEnd);
      const draft = { start: nextStart, end: nextEnd };
      setGraphDurationDrafts((current) => ({
        ...current,
        [graphNodeHandleDrag.nodeId]: draft,
      }));
      if (videoId) {
        seekNarrativeAgentGraphSource(videoId, graphNodeHandleDrag.handle === "start" ? nextStart : nextEnd);
      }
      eventBus.emit("narrativeAgentGraphNodeHandleDragged", {
        videoId,
        row_key: selectedRow?.key,
        node_id: graphNodeHandleDrag.nodeId,
        handle: graphNodeHandleDrag.handle,
        start_timestamp: nextStart,
        end_timestamp: nextEnd,
        source_panel: "NarrativeAgentPanel",
      });
    };
    const handlePointerUp = () => setGraphNodeHandleDrag(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [graphNodeHandleDrag, selectedRow?.key, videoId]);
  const confirmSelectedGraphNodePresence = () => {
    if (!selectedRow || !selectedGraphNode || !selectedGraphNodeDraft) return;
    onCommitTimelineHandle({
      row: selectedRow,
      handle: {
        key: `${selectedGraphNode.id}:quick-presence`,
        label: "manual",
        kind: selectedGraphNode.kind === "cue" ? "cue" : selectedGraphNode.kind === "source" ? "source" : "occurrence",
        time: selectedGraphNodeDraft.start,
        end: selectedGraphNodeDraft.end,
        title: `Manual presence ${formatSeconds(selectedGraphNodeDraft.start)}-${formatSeconds(selectedGraphNodeDraft.end)}`,
      },
    });
  };
  return (
    <section
      className="mb-2 rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-2"
      data-vaa1-narrative-agent-character-paths="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
            Character workspace
          </div>
          <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--ui-passive-text)]">
            Start with one character, then inspect what Datascene knows, what is missing, and what should be confirmed next.
          </div>
        </div>
        <button
          type="button"
          className="rounded border border-cyan-700/60 bg-[#111214] px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/30"
          onClick={() => openPanel("MeaningPlot", videoId ? { videoId } : {})}
        >
          Open plot map
        </button>
      </div>

      <PanelDropdownSection
        title="Choose Character"
        summary="Pick one character to inspect. Everything below follows this selection."
        count={`${rows.length} profiles`}
        defaultOpen
      >
      <div data-vaa1-narrative-agent-single-profile-selector="true">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label className="min-w-[220px] flex-1">
            <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
              Character
            </span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-[#0c0d0f] px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-cyan-600"
              value={selectedAgentKey}
              data-vaa1-narrative-agent-profile-dropdown="true"
              onChange={(event) => setSelectedAgentKey(event.target.value)}
            >
              {rows.length === 0 ? (
                <option value="">No governed Narrative Agents</option>
              ) : (
                rows.map((row) => (
                  <option key={`narrative-agent-option:${row.key}`} value={row.key}>
                    {row.label}
                    {row.sourceLabels.length > 1 ? ` (${row.sourceLabels.length} labels combined)` : ""}
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="text-right text-[9px] text-[var(--ui-passive-text)]">
            {rows.length} canonical profile{rows.length === 1 ? "" : "s"}
            <br />
            One-character view
          </div>
        </div>
        {selectedRow && selectedRow.sourceLabels.length > 1 ? (
          <div
            className="mt-2 flex flex-wrap gap-1"
            data-vaa1-narrative-agent-combined-profile-aliases="true"
          >
            <span className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-400">
              combined labels
            </span>
            {selectedRow.sourceLabels.slice(0, 8).map((label) => (
              <span
                key={`narrative-agent-combined-label:${selectedRow.key}:${label}`}
                className="rounded border border-cyan-900/50 bg-cyan-950/20 px-1.5 py-0.5 text-[9px] text-cyan-100"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      </PanelDropdownSection>

      <PanelDropdownSection
        title="StatsKit + Significance + Relevance"
        summary="Ranks this character's source-linked evidence for the current analyst task."
        count={selectedRelevanceSurface ? `${formatNarrativeAgentScore(selectedRelevanceSurface.overallScore)} relevance` : "pending"}
        defaultOpen
      >
        {selectedRelevanceSurface ? (
          <div
            className="space-y-2"
            data-vaa1-statskit-significance-relevance-surface="true"
            data-vaa1-relevance-radar-selected-character={selectedRow?.label || ""}
          >
            <div className="grid gap-1.5 md:grid-cols-4">
              <div className="rounded border border-cyan-800/60 bg-cyan-950/20 px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.12em] text-cyan-300">
                  Analyst goal
                </div>
                <div className="mt-0.5 text-[10px] text-slate-100">
                  {selectedRelevanceSurface.context.analystGoal}
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.12em] text-slate-500">
                  Active lens
                </div>
                <div className="mt-0.5 text-[10px] text-slate-100">
                  {selectedRelevanceSurface.context.activeLens}
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
                <div className="text-[8px] uppercase tracking-[0.12em] text-slate-500">
                  Scope
                </div>
                <div className="mt-0.5 text-[10px] text-slate-100">
                  {selectedRelevanceSurface.context.scope}
                </div>
              </div>
              <button
                type="button"
                disabled={selectedRelevanceSurface.firstSourceTime === undefined}
                className="rounded border border-cyan-800/60 bg-[#101010] px-2 py-1.5 text-left text-[10px] text-cyan-100 hover:bg-cyan-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (selectedRelevanceSurface.firstSourceTime !== undefined) {
                    openVideoAtTime(videoId, selectedRelevanceSurface.firstSourceTime);
                  }
                }}
              >
                Source {selectedRelevanceSurface.firstSourceTime !== undefined
                  ? formatSeconds(selectedRelevanceSurface.firstSourceTime)
                  : "pending"}
              </button>
            </div>

            <div className="grid gap-1.5 md:grid-cols-5" data-vaa1-statskit-source-signals="true">
              {selectedRelevanceSurface.statsSignals.map((signal) => (
                <div
                  key={`statskit-signal:${signal.label}`}
                  className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5"
                >
                  <div className="text-[8px] uppercase tracking-[0.12em] text-slate-500">
                    {signal.label}
                  </div>
                  <div className="mt-0.5 text-[14px] font-semibold text-slate-100">
                    {signal.value}
                  </div>
                  <div className="mt-0.5 text-[9px] leading-relaxed text-[var(--ui-passive-text)]">
                    {signal.detail}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-1.5 lg:grid-cols-2" data-vaa1-relevance-radar-dimensions="true">
              {selectedRelevanceSurface.dimensions.map((dimension) => (
                <button
                  key={`relevance-radar-dimension:${dimension.id}`}
                  type="button"
                  disabled={dimension.sourceTime === undefined}
                  className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5 text-left hover:border-cyan-500/70 hover:bg-cyan-950/20 disabled:cursor-not-allowed disabled:opacity-70"
                  data-vaa1-relevance-radar-dimension={dimension.id}
                  onClick={() => {
                    if (dimension.sourceTime !== undefined) {
                      openVideoAtTime(videoId, dimension.sourceTime);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-slate-100">
                      {dimension.label}
                    </span>
                    <span className="rounded border border-cyan-800/60 bg-cyan-950/20 px-1.5 py-0.5 text-[9px] text-cyan-100">
                      {formatNarrativeAgentScore(dimension.score)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-900">
                    <div
                      className="h-full rounded bg-cyan-400/80"
                      style={{ width: `${Math.round(clampNarrativeAgentScore(dimension.score) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[9px] leading-relaxed text-[var(--ui-passive-text)]">
                    {dimension.reason}
                  </div>
                  <div className="mt-1 text-[8px] uppercase tracking-[0.12em] text-slate-500">
                    {dimension.evidenceCount} evidence signal{dimension.evidenceCount === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid gap-1.5 md:grid-cols-3" data-vaa1-significancekit-claims="true">
              {selectedRelevanceSurface.significanceClaims.map((claim) => (
                <button
                  key={`significance-claim:${claim.level}:${claim.title}`}
                  type="button"
                  disabled={claim.sourceTime === undefined}
                  className="rounded border border-emerald-900/60 bg-emerald-950/10 px-2 py-1.5 text-left hover:border-emerald-500/70 hover:bg-emerald-950/20 disabled:cursor-not-allowed disabled:opacity-70"
                  data-vaa1-significancekit-scope={claim.level.toLowerCase()}
                  onClick={() => {
                    if (claim.sourceTime !== undefined) {
                      openVideoAtTime(videoId, claim.sourceTime);
                    }
                  }}
                >
                  <div className="text-[8px] uppercase tracking-[0.12em] text-emerald-300">
                    {claim.level}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-slate-100">
                    {claim.title}
                  </div>
                  <div className="mt-1 text-[9px] leading-relaxed text-[var(--ui-passive-text)]">
                    {claim.text}
                  </div>
                  <div className="mt-1 text-[8px] uppercase tracking-[0.12em] text-emerald-200/70">
                    {claim.evidenceCount} linked signal{claim.evidenceCount === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5 text-[10px] text-[var(--ui-passive-text)]">
            Select a governed character profile to calculate source-linked relevance and significance.
          </div>
        )}
      </PanelDropdownSection>

      <PanelDropdownSection
        title="Recommended Next Steps"
        summary="Practical checks that would make this character more useful for analysis and matching."
        count={selectedCharacterRecommendations.length || "ready"}
        defaultOpen
      >
        {selectedCharacterRecommendations.length > 0 ? (
          <div className="grid gap-1.5 md:grid-cols-2" data-vaa1-narrative-agent-recommendations="true">
            {selectedCharacterRecommendations.map((recommendation) => (
              <div
                key={`${selectedRow?.key}:recommendation:${recommendation.title}`}
                className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5"
              >
                <div className="text-[10px] font-semibold text-cyan-100">
                  {recommendation.title}
                </div>
                <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--ui-passive-text)]">
                  {recommendation.detail}
                </div>
                <div className="mt-1 rounded border border-cyan-900/50 bg-cyan-950/20 px-1.5 py-0.5 text-[9px] text-cyan-100">
                  {recommendation.action}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border border-emerald-800/50 bg-emerald-950/10 px-2 py-1.5 text-[10px] text-emerald-100">
            This character already has the basic source-linked evidence needed for first-pass interpretation.
          </div>
        )}
      </PanelDropdownSection>

      <PanelDropdownSection
        title="Review Modes"
        summary="Switch between overview, evidence, semantics, continuity, and scene checks without leaving this panel."
        count="5 modes"
      >
        <div
          className="flex flex-wrap items-start justify-between gap-2"
          data-vaa1-narrative-agent-review-compass="true"
        >
          <div className="flex flex-wrap gap-1" data-vaa1-narrative-agent-review-modes="true">
            {[
              "Overview",
              "Evidence",
              "Semantics",
              "Continuity",
              "Scenes",
            ].map((mode) => (
              <span
                key={`narrative-agent-review-mode:${mode}`}
                className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300"
              >
                {mode}
              </span>
            ))}
          </div>
        </div>
      </PanelDropdownSection>

      <PanelDropdownSection
        title="Matching Memory"
        summary="Shows whether this character has source-linked visual/audio samples that can support future matching."
        count={selectedIdentityMemory ? "memory linked" : "memory pending"}
      >
      <div data-vaa1-narrative-agent-proliferation-provenance="true">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-200">
              Matching memory
            </div>
            <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--ui-passive-text)]">
              Manual Narrative Agent confirmations seed audiovisual identity memory, continuity candidates, and source-timed review.
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="rounded border border-emerald-800/70 bg-[#101010] px-1.5 py-0.5 text-[9px] text-emerald-100">
              {selectedIdentityMemory ? "memory linked" : "memory pending"}
            </span>
            <span
              className="rounded border border-cyan-800/70 bg-[#101010] px-1.5 py-0.5 text-[9px] text-cyan-100"
              data-vaa1-narrative-agent-constellational-matching-governance="true"
            >
              constellation governed
            </span>
          </div>
        </div>
        {selectedIdentityMemory ? (
          <>
            <div className="mt-2 grid gap-1.5 md:grid-cols-3">
              <div
                className="rounded border border-slate-800 bg-[#0c0d0f] px-2 py-1.5"
                data-vaa1-narrative-agent-multi-visual-samples="true"
              >
                <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                  visual samples
                </div>
                <div className="mt-1 text-[14px] font-semibold text-slate-100">
                  {selectedVisualSampleSlots.length}
                </div>
                <div className="mt-0.5 text-[9px] leading-relaxed text-[var(--ui-passive-text)]">
                  multiple looks retained for clothing, lighting, scale, and scene changes
                </div>
              </div>
              <div
                className="rounded border border-slate-800 bg-[#0c0d0f] px-2 py-1.5"
                data-vaa1-narrative-agent-audiovisual-memory="true"
              >
                <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                  audio windows
                </div>
                <div className="mt-1 text-[14px] font-semibold text-slate-100">
                  {selectedAudioSampleSlots.length}
                </div>
                <div className="mt-0.5 text-[9px] leading-relaxed text-[var(--ui-passive-text)]">
                  audiovisual samples pair appearance with voice or source-audio windows
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-[#0c0d0f] px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                  continuity candidates
                </div>
                <div className="mt-1 text-[14px] font-semibold text-slate-100">
                  {selectedIdentityContinuityCandidates.length}
                </div>
                <div className="mt-0.5 text-[9px] leading-relaxed text-[var(--ui-passive-text)]">
                  late or unresolved BBoxes stay reviewable until an analyst decision
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedAudiovisualSampleSlots.slice(0, 6).map((slot, index) => {
                const time = asRecord(slot.time);
                const start = numberFrom(time.start ?? time.time_start);
                return (
                  <button
                    key={stringFrom(slot.sample_id) || `av-memory:${index}`}
                    type="button"
                    className="rounded border border-emerald-800/60 bg-[#101010] px-1.5 py-0.5 text-[9px] text-emerald-100 hover:bg-emerald-950/30"
                    title={stringFrom(slot.sample_state) || "audiovisual identity memory"}
                    onClick={() => {
                      if (start !== undefined) openVideoAtTime(videoId, start);
                    }}
                  >
                    AV {formatNarrativeAgentTimeRange(slot.time)}
                  </button>
                );
              })}
              {selectedIdentityContinuityCandidates.slice(0, 4).map((candidate, index) => {
                const time = asRecord(candidate.target_time);
                const start = numberFrom(time.start ?? time.time_start);
                return (
                  <button
                    key={stringFrom(candidate.candidate_id) || `continuity:${index}`}
                    type="button"
                    className="rounded border border-amber-800/60 bg-amber-950/15 px-1.5 py-0.5 text-[9px] text-amber-100 hover:bg-amber-950/30"
                    title="Review continuity candidate from Mature Data Proliferation bus"
                    onClick={() => {
                      if (start !== undefined) openVideoAtTime(videoId, start);
                    }}
                  >
                    candidate {formatNarrativeAgentTimeRange(candidate.target_time)}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-2 rounded border border-dashed border-slate-800 px-2 py-2 text-[10px] text-[var(--ui-passive-text)]">
            Confirm this agent in a source-time/BBox anchored annotation to create audiovisual identity memory for proliferation.
          </div>
        )}
      </div>
      </PanelDropdownSection>

      <PanelDropdownSection
        title="Interpretation Lenses"
        summary="Optional theory views for reading the character. These do not overwrite source evidence or identity labels."
        count={activeNarrativeAgentArchetype.tradition}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="max-w-3xl text-[10px] leading-relaxed text-[var(--ui-passive-text)]">
            <span className="font-semibold text-cyan-100">
              {activeNarrativeAgentArchetype.label} / {activeNarrativeAgentArchetype.tradition}.
            </span>{" "}
            {activeNarrativeAgentArchetype.description} {activeNarrativeAgentArchetype.graphDescription}
            <span className="ml-1 text-slate-500">
              Interpretive readings stay separate from agent identity.
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1" data-vaa1-narrative-agent-local-archetype-lenses="true">
          {NARRATIVE_AGENT_ARCHETYPE_LENSES.map((lens) => {
            const active = lens.id === activeNarrativeAgentArchetypeLens;
            return (
              <button
                key={lens.label}
                type="button"
                className={`rounded border px-1.5 py-0.5 text-[9px] ${
                  active
                    ? "border-cyan-400 bg-cyan-950/50 text-cyan-100"
                    : "border-slate-700 bg-[#101010] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                }`}
                title={lens.description}
                data-vaa1-narrative-agent-archetype-local-control="true"
                onClick={() => {
                  setActiveNarrativeAgentArchetypeLens(lens.id);
                  eventBus.emit("narrativeAgentArchetypeLensChanged", {
                    videoId,
                    lens_id: lens.id,
                    source_panel: "NarrativeAgentPanel",
                    focus_panel_changed: false,
                  });
                }}
              >
                {lens.label} / {lens.tradition}
              </button>
            );
          })}
        </div>
      </PanelDropdownSection>

      <PanelDropdownSection
        title="Character Evidence Graph"
        summary="Trace source moments, scene presence, cues, and quick confirmations for the selected character."
        count={selectedGraphModel.nodes.length ? `${selectedGraphModel.nodes.length} nodes` : "no graph"}
      >
      <div className="space-y-1.5">
        {rows.length === 0 ? (
          <div className="rounded border border-slate-800 bg-[#111214] px-2 py-2 text-[10px] text-[var(--ui-passive-text)]">
            No governed Narrative Agent paths yet. Confirm or name an agent to seed this home.
          </div>
        ) : selectedRow ? (
              <div
                key={selectedRow.key}
                className="rounded border border-slate-800 bg-[#111214] px-2 py-2"
                data-vaa1-narrative-agent-path-row="true"
                data-vaa1-narrative-agent-single-profile-view="true"
              >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-slate-100">
                    {selectedRow.label}
                  </div>
                  <div className="mt-0.5 text-[9px] text-[var(--ui-passive-text)]">
                    {selectedRow.source}
                    {selectedRow.role ? ` / ${selectedRow.role}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  {selectedRow.start !== undefined && (
                    <button
                      type="button"
                      className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-600 hover:text-cyan-100"
                      onClick={() => openVideoAtTime(videoId, selectedRow.start || 0)}
                    >
                      source {formatSeconds(selectedRow.start)}
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-600 hover:text-cyan-100"
                    onClick={() => openPanel("MeaningPlot", videoId ? { videoId } : {})}
                  >
                    plot map
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">
                  cues {selectedRow.cueCount}
                </span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">
                  scenes {selectedRow.sceneCount}
                </span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">
                  manual {selectedRow.manualCount}
                </span>
                {selectedRow.evidenceChips.slice(0, 6).map((chip) => (
                  <span
                    key={chip}
                    className="rounded border border-cyan-900/50 bg-cyan-950/20 px-1.5 py-0.5 text-[9px] text-cyan-100"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div
                className="mt-2 rounded border border-slate-800 bg-[#0c0d0f] px-2 py-2"
                data-vaa1-narrative-agent-timeline-strip="true"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                    Agent timeline handles
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300"
                      data-vaa1-narrative-agent-timeline-cursor-label="true"
                    >
                      cursor {formatSeconds(videoTimelineCursor)}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-cyan-800/70 bg-[#101010] px-1.5 py-0.5 text-[9px] text-cyan-100 hover:bg-cyan-950/30"
                      data-vaa1-narrative-agent-timeline-open-meaning-network="true"
                      onClick={() => openPanel("MeaningPlot", videoId ? { videoId } : {})}
                    >
                      Open in Meaning Network
                    </button>
                  </div>
                </div>
                {selectedTimelineHandles.length > 0 ? (
                  <div
                    className="relative h-10 rounded border border-slate-900 bg-[#070808]"
                    data-vaa1-narrative-agent-timeline-cursor="true"
                  >
                    <div className="absolute left-2 right-2 top-1/2 h-px bg-slate-700" />
                    {selectedTimelineDomain ? (
                      <div className="absolute left-2 right-2 top-1 flex justify-between text-[8px] text-slate-500">
                        <span>{formatSeconds(selectedTimelineDomain.start)}</span>
                        <span>{formatSeconds(selectedTimelineDomain.end)}</span>
                      </div>
                    ) : null}
                    <div
                      className="absolute bottom-1 top-1 w-px bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.7)]"
                      style={{ left: `${selectedTimelineCursorLeft}%` }}
                      title={`Current video time ${formatSeconds(videoTimelineCursor)}`}
                      data-vaa1-narrative-agent-timeline-cursor-line="true"
                    />
                    {selectedTimelineHandles.map((handle) => {
                      const left = narrativeAgentTimelinePosition(handle, selectedTimelineHandles);
                      const tone = handle.kind === "source"
                        ? "border-cyan-500 bg-cyan-950 text-cyan-100"
                        : handle.kind === "scene"
                          ? "border-emerald-500 bg-emerald-950 text-emerald-100"
                          : handle.kind === "occurrence"
                            ? "border-amber-500 bg-amber-950 text-amber-100"
                            : "border-violet-500 bg-violet-950 text-violet-100";
                      return (
                        <button
                          key={handle.key}
                          type="button"
                          className={`absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[7px] leading-none ${tone}`}
                          style={{ left: `${left}%` }}
                          title={handle.title}
                          aria-label={`${handle.kind} handle ${formatSeconds(handle.time)}`}
                          data-vaa1-narrative-agent-timeline-handle={handle.kind}
                          data-vaa1-narrative-agent-timeline-handle-commits-presence="true"
                          onClick={() => {
                            openVideoAtTime(videoId, handle.time);
                            onCommitTimelineHandle({ row: selectedRow, handle });
                          }}
                        >
                          {narrativeAgentHandleRailGlyph(handle)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-slate-800 px-2 py-2 text-[9px] text-[var(--ui-passive-text)]">
                    Timeline handles appear when this agent has source, scene, or cue time anchors.
                  </div>
                )}
                {selectedNearbyTimelineHandles.length > 0 ? (
                  <div
                    className="mt-2 flex flex-wrap gap-1"
                    data-vaa1-narrative-agent-timeline-near-cursor="true"
                  >
                    <span className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-400">
                      near cursor
                    </span>
                    {selectedNearbyTimelineHandles.map((handle) => (
                      <button
                        key={`near-cursor:${handle.key}`}
                        type="button"
                        className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                        title={handle.title}
                        onClick={() => {
                          openVideoAtTime(videoId, handle.time);
                          onCommitTimelineHandle({ row: selectedRow, handle });
                        }}
                      >
                        {formatSeconds(handle.time)} {handle.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div
                className="mt-2 rounded border border-cyan-900/40 bg-[#0c0d0f] px-2 py-2"
                data-vaa1-narrative-agent-operational-graph="true"
                data-vaa1-narrative-agent-graph-active-lens={activeNarrativeAgentArchetypeLens}
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-cyan-200">
                      Agent graph / {activeNarrativeAgentArchetype.tradition}
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--ui-passive-text)]">
                      {activeNarrativeAgentArchetype.graphDescription}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-violet-800/70 bg-[#101010] px-1.5 py-0.5 text-[9px] text-violet-100 hover:bg-violet-950/30"
                    data-vaa1-narrative-agent-graph-open-annotation-card="true"
                    onClick={openSelectedAgentAnnotationCard}
                  >
                    Annotation card
                  </button>
                </div>
                <div
                  ref={graphCanvasRef}
                  className="relative h-48 overflow-hidden rounded border border-slate-900 bg-[#070808]"
                  data-vaa1-narrative-agent-graph-canvas="true"
                >
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {selectedGraphModel.edges.map((edge) => {
                      const source = selectedGraphModel.nodes.find((node) => node.id === edge.source);
                      const target = selectedGraphModel.nodes.find((node) => node.id === edge.target);
                      if (!source || !target) return null;
                      return (
                        <line
                          key={edge.id}
                          x1={source.x}
                          y1={source.y}
                          x2={target.x}
                          y2={target.y}
                          stroke="rgba(34, 211, 238, 0.35)"
                          strokeWidth="0.5"
                          data-vaa1-narrative-agent-graph-edge={edge.kind}
                        />
                      );
                    })}
                  </svg>
                  {selectedGraphModel.nodes.map((node) => {
                    const selected = selectedGraphNode?.id === node.id;
                    return (
                      <button
                        key={node.id}
                        type="button"
                        className={`absolute flex h-10 min-w-12 max-w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded border px-1 text-[8px] font-semibold leading-tight shadow-sm ${narrativeAgentGraphNodeTone(node.kind)} ${selected ? "ring-2 ring-cyan-200" : ""}`}
                        style={{ left: `${node.x}%`, top: `${node.y}%` }}
                        title={`${node.label}${node.time !== undefined ? ` / ${formatSeconds(node.time)}` : ""}`}
                        aria-label={narrativeAgentGraphNodeHandleLabel(node)}
                        data-vaa1-narrative-agent-graph-node={node.kind}
                        data-vaa1-narrative-agent-graph-node-handle-label="true"
                        data-vaa1-narrative-agent-graph-node-selected={selected ? "true" : "false"}
                        onClick={() => selectNarrativeAgentGraphNode(node)}
                        onDoubleClick={openSelectedAgentAnnotationCard}
                      >
                        <span>{narrativeAgentGraphNodeShortLabel(node)}</span>
                        {node.time !== undefined ? (
                          <span className="mt-0.5 text-[7px] font-normal opacity-90">
                            {formatSeconds(node.time)}
                          </span>
                        ) : null}
                        {node.time !== undefined ? (
                          <>
                            <span
                              role="slider"
                              tabIndex={0}
                              aria-label={`Drag start of ${narrativeAgentGraphNodeHandleLabel(node)}`}
                              aria-valuemin={0}
                              aria-valuenow={graphDurationDrafts[node.id]?.start ?? node.time}
                              aria-valuetext={formatSeconds(graphDurationDrafts[node.id]?.start ?? node.time)}
                              className="absolute -left-1.5 top-1/2 h-5 w-2 -translate-y-1/2 cursor-ew-resize rounded border border-cyan-200 bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                              title="Drag presence start"
                              data-vaa1-narrative-agent-graph-node-start-handle="true"
                              data-vaa1-narrative-agent-graph-stretchable-node-handle="start"
                              onPointerDown={(event) => startNarrativeAgentGraphNodeHandleDrag(event, node, "start")}
                              onClick={(event) => event.stopPropagation()}
                            />
                            <span
                              role="slider"
                              tabIndex={0}
                              aria-label={`Drag end of ${narrativeAgentGraphNodeHandleLabel(node)}`}
                              aria-valuemin={0}
                              aria-valuenow={graphDurationDrafts[node.id]?.end ?? Math.max(node.end ?? node.time + 2, node.time + 0.05)}
                              aria-valuetext={formatSeconds(graphDurationDrafts[node.id]?.end ?? Math.max(node.end ?? node.time + 2, node.time + 0.05))}
                              className="absolute -right-1.5 top-1/2 h-5 w-2 -translate-y-1/2 cursor-ew-resize rounded border border-cyan-200 bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                              title="Drag presence end"
                              data-vaa1-narrative-agent-graph-node-end-handle="true"
                              data-vaa1-narrative-agent-graph-stretchable-node-handle="end"
                              onPointerDown={(event) => startNarrativeAgentGraphNodeHandleDrag(event, node, "end")}
                              onClick={(event) => event.stopPropagation()}
                            />
                            <span
                              className="pointer-events-none absolute -bottom-1 left-1 right-1 h-0.5 rounded-full bg-cyan-300"
                              data-vaa1-narrative-agent-graph-node-duration-bar="true"
                            />
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {selectedGraphNode ? (
                  <div
                    className="mt-2 flex flex-wrap items-center gap-1"
                    data-vaa1-narrative-agent-graph-selection-card="true"
                  >
                    <span className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300">
                      {selectedGraphNode.kind}
                    </span>
                    <span className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300">
                      {selectedGraphNode.label}
                    </span>
                    {selectedGraphNode.time !== undefined ? (
                      <button
                        type="button"
                        className="rounded border border-cyan-800/70 bg-[#101010] px-1.5 py-0.5 text-[9px] text-cyan-100 hover:bg-cyan-950/30"
                        data-vaa1-narrative-agent-graph-jump-source="true"
                        onClick={() => seekNarrativeAgentGraphSource(videoId, selectedGraphNode.time || 0)}
                      >
                        Jump {formatSeconds(selectedGraphNode.time)}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded border border-violet-800/70 bg-[#101010] px-1.5 py-0.5 text-[9px] text-violet-100 hover:bg-violet-950/30"
                      data-vaa1-narrative-agent-graph-selection-open-card="true"
                      onClick={openSelectedAgentAnnotationCard}
                    >
                      Open card
                    </button>
                    {selectedGraphNodeDraft ? (
                      <div
                        className="mt-1 flex w-full flex-wrap items-center gap-1 rounded border border-slate-800 bg-[#080b0b] px-2 py-1"
                        data-vaa1-narrative-agent-graph-fast-presence-editor="true"
                      >
                        <span className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300">
                          {formatSeconds(selectedGraphNodeDraft.start)}-{formatSeconds(selectedGraphNodeDraft.end)}
                        </span>
                        <button
                          type="button"
                          className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                          data-vaa1-narrative-agent-graph-presence-start-back="true"
                          onClick={() => updateSelectedGraphNodeDraft({ start: selectedGraphNodeDraft.start - 1 })}
                        >
                          start -1s
                        </button>
                        <button
                          type="button"
                          className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                          data-vaa1-narrative-agent-graph-presence-end-forward="true"
                          onClick={() => updateSelectedGraphNodeDraft({ end: selectedGraphNodeDraft.end + 1 })}
                        >
                          end +1s
                        </button>
                        <input
                          type="range"
                          min={Math.max(0, selectedGraphNodeDraft.start + 0.05)}
                          max={Math.max(
                            selectedGraphNodeDraft.end + 10,
                            selectedTimelineDomain?.end ?? selectedGraphNodeDraft.end + 10,
                          )}
                          step="0.05"
                          value={selectedGraphNodeDraft.end}
                          className="h-1 min-w-[140px] flex-1 accent-cyan-400"
                          aria-label="Drag Narrative Agent presence end"
                          data-vaa1-narrative-agent-graph-draggable-duration-handle="true"
                          onChange={(event) => updateSelectedGraphNodeDraft({ end: Number(event.target.value) })}
                        />
                        <button
                          type="button"
                          className="rounded border border-emerald-800/70 bg-[#101010] px-1.5 py-0.5 text-[9px] text-emerald-100 hover:bg-emerald-950/30"
                          data-vaa1-narrative-agent-graph-fast-confirm-presence="true"
                          onClick={confirmSelectedGraphNodePresence}
                        >
                          Confirm presence
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div
                className="mt-2 flex flex-wrap gap-1"
                data-vaa1-narrative-agent-scene-presence="true"
              >
                {selectedRow.scenePresence.length > 0 ? (
                  selectedRow.scenePresence.map((scene) => (
                    <button
                      key={`${selectedRow.key}:scene:${scene.sceneIndex}:${scene.start}`}
                      type="button"
                      className="rounded border border-emerald-800/60 bg-emerald-950/15 px-1.5 py-0.5 text-[9px] text-emerald-100 hover:bg-emerald-950/30"
                      title={`${scene.support} support / ${formatSeconds(scene.start)}-${formatSeconds(scene.end)}`}
                      onClick={() => openVideoAtTime(videoId, scene.start)}
                    >
                      {scene.sceneLabel} {formatSeconds(scene.start)}
                    </button>
                  ))
                ) : (
                  <span className="rounded border border-slate-800 bg-[#101010] px-1.5 py-0.5 text-[9px] text-[var(--ui-passive-text)]">
                    scene presence pending
                  </span>
                )}
              </div>
              {selectedRow.cues.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedRow.cues.slice(0, 3).map((cue) => (
                    <button
                      key={cue.instruction_id}
                      type="button"
                      className="rounded border border-slate-800 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                      onClick={() => openVideoAtTime(videoId, secondsFromInstruction(cue))}
                    >
                      {formatSeconds(secondsFromInstruction(cue))} {cue.candidate_label}
                    </button>
                  ))}
                </div>
              )}
            </div>
        ) : null}
      </div>
      </PanelDropdownSection>
    </section>
  );
}

export default function MasterSchemaPanel({
  videoId: initialVideoId = "",
  category,
  panelTitle = "Master Schema",
  panelDescription = "This is the master review surface for native manual annotations. Leaf panels may show category-specific views, but this panel keeps the full analyst schema together.",
}: {
  videoId?: string;
  category?: ManualVisualAnnotation["category"];
  panelTitle?: string;
  panelDescription?: string;
}) {
  const { openPanel } = useLayoutHost();
  const [videoId, setVideoId] = useState(initialVideoId);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [identityLedger, setIdentityLedger] =
    useState<IdentityCandidateLedger | null>(null);
  const [identityActionMessage, setIdentityActionMessage] = useState("");
  const [isIdentityActionBusy, setIsIdentityActionBusy] = useState(false);
  const [identityDrafts, setIdentityDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [leafDrafts, setLeafDrafts] = useState<Record<string, LeafAnnotationDraft>>({});
  const [timeInputDrafts, setTimeInputDrafts] = useState<Record<string, string>>({});
  const [leafActionMessage, setLeafActionMessage] = useState("");
  const suppressNextLocalCorrectionRefreshRef = useRef(false);
  const analysisLoadRequestRef = useRef(0);
  const analysisDataRef = useRef<AnalysisData | null>(null);

  useEffect(() => {
    analysisDataRef.current = analysisData;
  }, [analysisData]);

  const knownCharacters = React.useMemo(() => {
    const records = analysisData?.masterSchemaResolvedEvidence?.records || [];
    const agents = records
      .filter((r: any) => ["narrative_agent_profile", "character_role", "identity"].includes(r.category))
      .map((r: any) => r.label)
      .filter(Boolean);
    return Array.from(new Set(agents)).sort() as string[];
  }, [analysisData?.masterSchemaResolvedEvidence?.records]);

  useEffect(() => {
    if (initialVideoId) {
      setVideoId(initialVideoId);
    }
  }, [initialVideoId]);

  useEffect(() => {
    const videoHandler = (id: string) => setVideoId(id);
    const correctionHandler = (id: string) => {
      if (id === videoId) {
        if (suppressNextLocalCorrectionRefreshRef.current) {
          suppressNextLocalCorrectionRefreshRef.current = false;
          return;
        }
        setRefreshNonce((current) => current + 1);
      }
    };

    eventBus.on("videoIdChanged", videoHandler);
    eventBus.on("analysisCorrectionsChanged", correctionHandler);

    return () => {
      eventBus.off("videoIdChanged", videoHandler);
      eventBus.off("analysisCorrectionsChanged", correctionHandler);
    };
  }, [videoId]);

  useEffect(() => {
    async function load() {
      const requestedVideoId = videoId;
      const requestId = analysisLoadRequestRef.current + 1;
      analysisLoadRequestRef.current = requestId;
      if (!videoId) {
        setAnalysisData(null);
        setIsLoading(false);
        return;
      }

      const currentAnalysis = analysisDataRef.current;
      if (
        !currentAnalysis ||
        (currentAnalysis.analysisId && currentAnalysis.analysisId !== requestedVideoId)
      ) {
        setAnalysisData(null);
      }
      setIsLoading(true);
      try {
        const nextAnalysisData = await VideoService.getAnalysis(requestedVideoId);
        if (
          analysisLoadRequestRef.current !== requestId ||
          requestedVideoId !== videoId ||
          (nextAnalysisData.analysisId && nextAnalysisData.analysisId !== requestedVideoId)
        ) {
          return;
        }
        setAnalysisData(nextAnalysisData);
      } catch (error) {
        console.error("Failed to load master schema annotations:", error);
        if (analysisLoadRequestRef.current === requestId) {
          setAnalysisData(null);
        }
      } finally {
        if (analysisLoadRequestRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }

    void load();
  }, [videoId, refreshNonce]);

  useEffect(() => {
    async function loadIdentityLedger() {
      if (!videoId || category !== "Identification") {
        setIdentityLedger(null);
        return;
      }

      try {
        const nextLedger = await apiService.getIdentityCandidates(videoId);
        setIdentityLedger(nextLedger);
        setIdentityDrafts((current) => {
          const next = { ...current };
          for (const candidate of nextLedger.candidates || []) {
            if (next[candidate.candidate_id] === undefined) {
              next[candidate.candidate_id] = candidate.promoted_identity || "";
            }
          }
          return next;
        });
      } catch (error) {
        console.warn("Failed to load Narrative Agent candidates:", error);
        setIdentityLedger(null);
      }
    }

    void loadIdentityLedger();
  }, [videoId, category, refreshNonce]);

  async function createIdentityCandidates() {
    if (!videoId) return;
    setIsIdentityActionBusy(true);
    setIdentityActionMessage("Refreshing Narrative Agent candidates...");
    try {
      await apiService.runIdentityRefinement(videoId);
      setIdentityLedger(await apiService.getIdentityCandidates(videoId));
      setIdentityActionMessage("Narrative Agent candidates refreshed.");
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      console.error("Failed to refresh Narrative Agent candidates:", error);
      setIdentityActionMessage("Narrative Agent candidate refresh failed.");
    } finally {
      setIsIdentityActionBusy(false);
    }
  }

  function updateIdentityDraft(candidateId: string, value: string) {
    setIdentityDrafts((current) => ({ ...current, [candidateId]: value }));
  }

  async function promoteIdentityCandidate(candidate: IdentityCandidate, label: string) {
    if (!videoId) return;
    const identityLabel = label.trim();
    if (!identityLabel) return;

    setIsIdentityActionBusy(true);
    setIdentityActionMessage("Promoting Narrative Agent candidate...");
    try {
      await apiService.promoteIdentityCandidate(
        videoId,
        candidate.candidate_id,
        identityLabel,
      );
      setIdentityLedger(await apiService.getIdentityCandidates(videoId));
      setIdentityActionMessage("Narrative Agent candidate promoted.");
      setRefreshNonce((current) => current + 1);
      eventBus.emit("analysisCorrectionsChanged", videoId);
    } catch (error) {
      console.error("Failed to promote Narrative Agent candidate:", error);
      setIdentityActionMessage("Narrative Agent promotion failed.");
    } finally {
      setIsIdentityActionBusy(false);
    }
  }

  function activateVideoForAnnotation(item: ManualVisualAnnotation) {
    openManualAnnotationInVideo(videoId, item);
  }

  function selectAnnotationForEditing(item: ManualVisualAnnotation) {
    setSelectedAnnotationId(item.id);
    setLeafDrafts((current) =>
      current[item.id] ? current : { ...current, [item.id]: buildLeafDraft(item) },
    );
    activateVideoForAnnotation(item);
  }

  function updateLeafDraft(
    annotationId: string,
    patch: Partial<LeafAnnotationDraft>,
  ) {
    const item = (analysisData?.annotationCorrections?.manual_visual_annotations || []).find(
      (entry: ManualVisualAnnotation) => entry.id === annotationId,
    );
    setLeafDrafts((current) => {
      const base = current[annotationId] || (item ? buildLeafDraft(item) : null);
      if (!base) return current;
      const next = { ...base, ...patch };
      if (patch.category && patch.category !== base.category) {
        next.subcategory = firstSubcategory(patch.category);
      }
      next.start = Math.max(0, Number(next.start) || 0);
      next.end = Math.max(next.start + 0.001, Number(next.end) || next.start + 0.001);
      return { ...current, [annotationId]: next };
    });
  }

  function commitLeafTimeInput(
    inputKey: string,
    annotationId: string,
    field: "start" | "end",
    fallbackValue: number,
  ) {
    const draftValue = timeInputDrafts[inputKey];
    if (draftValue === undefined) return;
    const parsed = parseTimeInput(draftValue);
    if (parsed !== null) {
      updateLeafDraft(annotationId, { [field]: parsed });
    }
    setTimeInputDrafts((current) => {
      const next = { ...current };
      delete next[inputKey];
      return next;
    });
    if (parsed === null) {
      setLeafActionMessage(`Invalid time. Keeping ${formatSeconds(fallbackValue)}.`);
    }
  }

  async function saveLeafAnnotation(item: ManualVisualAnnotation) {
    if (!videoId) {
      setLeafActionMessage("Cannot save: no active analysis is selected.");
      return;
    }
    const draft = leafDrafts[item.id] || buildLeafDraft(item);
    const label = resolveLeafLabel(draft);
    const nextAnnotation: ManualVisualAnnotation = {
      ...item,
      category: draft.category,
      subcategory: draft.subcategory || firstSubcategory(draft.category),
      label,
      custom_label: draft.label.trim() || item.custom_label,
      timestamp_seconds: Number(draft.start.toFixed(3)),
      start_seconds: Number(draft.start.toFixed(3)),
      end_seconds: Number(draft.end.toFixed(3)),
      identity_affirmation:
        draft.category === "Identification"
          ? draft.identityAffirmation.trim() || label
          : draft.identityAffirmation.trim() || undefined,
      role_affirmation:
        draft.category === "Role"
          ? draft.roleAffirmation.trim() || label
          : draft.roleAffirmation.trim() || undefined,
      open_note: draft.note.trim() || undefined,
      updated_at: new Date().toISOString(),
      updated_by: "analyst",
    };
    const existingCorrections = analysisData?.annotationCorrections;
    const nextCorrections = upsertManualVisualAnnotation(
      existingCorrections,
      nextAnnotation,
    );
    setLeafActionMessage(`Saving ${manualCategoryDisplayLabel(draft.category)} / ${label}...`);
    try {
      pushCorrectionSnapshot(videoId, existingCorrections);
      const savedCorrections = await VideoService.saveAnnotationCorrections(
        videoId,
        nextCorrections,
      );
      const savedAnnotation =
        (savedCorrections.manual_visual_annotations || []).find(
          (entry: ManualVisualAnnotation) => entry.id === nextAnnotation.id,
        ) || nextAnnotation;
      setAnalysisData((current: any) =>
        current
          ? (() => {
              const nextManualGroups = (
                savedCorrections.manual_visual_annotations || []
              ).reduce(
                (
                  groups: Partial<
                    Record<ManualVisualAnnotation["category"], ManualVisualAnnotation[]>
                  >,
                  entry: ManualVisualAnnotation,
                ) => {
                  const items = groups[entry.category] || [];
                  groups[entry.category] = [...items, entry];
                  return groups;
                },
                {},
              );
              for (const items of Object.values(nextManualGroups)) {
                items?.sort(
                  (left: ManualVisualAnnotation, right: ManualVisualAnnotation) =>
                    Number(left.timestamp_seconds || 0) -
                    Number(right.timestamp_seconds || 0),
                );
              }
              return {
                ...current,
                annotationCorrections: savedCorrections,
                manualAnnotationsByCategory: nextManualGroups,
              };
            })()
          : current,
      );
      setLeafDrafts((current) => ({
        ...current,
        [savedAnnotation.id]: buildLeafDraft(savedAnnotation),
      }));
      setSelectedAnnotationId(null);
      setLeafActionMessage(`Saved ${manualCategoryDisplayLabel(draft.category)} / ${label}`);
      openManualAnnotationInVideo(videoId, savedAnnotation, {
        focusVideoPanel: false,
        seekVideo: false,
      });
      closeManualAnnotationInVideo(videoId, savedAnnotation.id);
      suppressNextLocalCorrectionRefreshRef.current = true;
      broadcastAnalysisCorrectionRefresh(videoId);
    } catch (error) {
      console.error("Failed to save master schema annotation:", error);
      setSelectedAnnotationId(nextAnnotation.id);
      setLeafActionMessage(
        error instanceof Error
          ? `Save failed: ${error.message}`
          : "Save failed. See console for details.",
      );
    }
  }

  async function deleteLeafAnnotation(item: ManualVisualAnnotation) {
    if (!videoId || !item.id) return;
    const existingCorrections = analysisData?.annotationCorrections;
    const nextCorrections = removeManualVisualAnnotation(existingCorrections, item.id);
    pushCorrectionSnapshot(videoId, existingCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    setAnalysisData(await VideoService.getAnalysis(videoId));
    setSelectedAnnotationId(null);
    setLeafActionMessage("Deleted indication.");
    eventBus.emit("videoIdChanged", videoId);
    eventBus.emit("videoTimeLineChanged", Number(item.start_seconds || item.timestamp_seconds || 0));
    broadcastAnalysisCorrectionRefresh(videoId);
  }

  async function commitNarrativeAgentTimelineHandle({
    row,
    handle,
  }: NarrativeAgentTimelineHandleCommit) {
    if (!videoId) return;
    const now = new Date().toISOString();
    const existingCorrections = analysisData?.annotationCorrections;
    const interval = buildNarrativeAgentTimelinePresenceInterval(row, handle, { now });
    const nextCorrectionsBase = {
      ...upsertMasterSchemaPresenceInterval(existingCorrections, interval, { now }),
      analysis_id: videoId,
    };
    const nextCorrections = retimeManualVisualAnnotationsFromPresenceInterval(
      nextCorrectionsBase,
      interval,
      { now },
    );
    setLeafActionMessage(`Saving Narrative Agent handle ${row.label} / ${formatSeconds(handle.time)}...`);
    try {
      pushCorrectionSnapshot(videoId, existingCorrections);
      await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
      setAnalysisData((current: AnalysisData | null) =>
        current
          ? {
              ...current,
              annotationCorrections: nextCorrections,
            }
          : current,
      );
      setLeafActionMessage(`Saved Narrative Agent handle ${row.label} / ${formatSeconds(handle.time)}`);
      eventBus.emit("meaningNetworkPresenceIntervalCommitted", {
        videoId,
        interval,
        event_type: "master_schema_updated",
        update_source: "narrative_agent_timeline_handle",
        update_authority: "manual_correction",
        master_schema_surface: interval.master_schema_surface,
        narrative_agent_profile_id: interval.narrative_agent_profile_id,
        source_verification_status: interval.source_verification_status,
        source_range_source: interval.source_range_source,
        source_evidence_refs: interval.source_evidence_refs,
        source_traceback_refs: interval.source_traceback_refs,
        propagation_required: true,
        partial_propagation_allowed: false,
        affected_panels: [
          "meaning_network",
          "master_schema",
          "video_panel",
          "bbox_roi_panel",
          "scene_card_panel",
          "narrative_agent_panel",
        ],
      });
      eventBus.emit("narrativeAgentProfilePresenceUpdated", {
        videoId,
        interval,
        profile_id: interval.narrative_agent_profile_id,
        source_panel: "NarrativeAgentPanel",
        master_schema_surface: interval.master_schema_surface,
        source_verification_status: interval.source_verification_status,
        source_evidence_refs: interval.source_evidence_refs,
      });
      suppressNextLocalCorrectionRefreshRef.current = true;
      broadcastAnalysisCorrectionRefresh(videoId);
    } catch (error) {
      console.error("Failed to save Narrative Agent timeline handle:", error);
      setLeafActionMessage(
        error instanceof Error
          ? `Handle save failed: ${error.message}`
          : "Handle save failed. See console for details.",
      );
    }
  }

  const groupedAnnotations = useMemo(() => {
    const groups =
      analysisData?.manualAnnotationsByCategory ||
      ({} as Partial<
        Record<ManualVisualAnnotation["category"], ManualVisualAnnotation[]>
      >);

    const orderedCategories = category ? [category] : CATEGORY_ORDER;

    return orderedCategories.map((currentCategory) => ({
      category: currentCategory,
      items: [...(groups[currentCategory] || [])].sort(
        (left, right) =>
          Number(left.timestamp_seconds || 0) -
          Number(right.timestamp_seconds || 0),
      ),
    })).filter((group) => group.items.length > 0);
  }, [analysisData?.manualAnnotationsByCategory, category]);

  const totalAnnotations = groupedAnnotations.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  return (
    <main className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-[#0a0a0a] bg-[#1a1a1a] px-3 py-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
          {panelTitle}
        </span>
        <div className="flex items-center gap-2">
          {category === "Scene" && (
            <button
              type="button"
              onClick={() => openPanel("SceneCards", videoId ? { videoId } : {})}
              className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-lime-500/70 hover:bg-lime-950/20"
            >
              Scene Cards
            </button>
          )}
          <span className="text-[10px] text-[var(--ui-passive-text)]">
            {totalAnnotations} manual annotation{totalAnnotations === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="my-2 rounded border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-[11px] text-sky-100">
          {panelDescription}
        </div>

        {isLoading && !analysisData ? (
          <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
            Loading master schema...
          </div>
        ) : (
          <>
            {isLoading ? (
              <div
                className="my-2 rounded border border-slate-800 bg-slate-950/20 px-2 py-1 text-[10px] text-[var(--ui-passive-text)]"
                data-vaa1-master-schema-background-refresh="true"
              >
                Refreshing in background...
              </div>
            ) : null}
            {category === "Identification" && (
              <NarrativeAgentCharacterPathsHome
                analysisData={analysisData}
                videoId={videoId}
                openPanel={openPanel}
                onCommitTimelineHandle={(commit) => {
                  void commitNarrativeAgentTimelineHandle(commit);
                }}
              />
            )}
            {category === "Identification" ? (
              <>
                <PanelDropdownSection
                  title="Evidence Reliability"
                  summary="Shows how much evidence is analyst-confirmed, interpreted, triangulated, or still raw."
                  defaultOpen={false}
                >
                  <MatureEvidenceStrip analysisData={analysisData} />
                </PanelDropdownSection>
                <PanelDropdownSection
                  title="Analyst Confirmations"
                  summary="Shows which confirmed annotations Datascene can trust before wider matching."
                  defaultOpen={false}
                >
                  <ConfirmationProgramStrip analysisData={analysisData} videoId={videoId} />
                </PanelDropdownSection>
                <PanelDropdownSection
                  title="Known Character Profiles"
                  summary="Confirmed or governed character records available to this analysis."
                  defaultOpen={false}
                >
                  <MasterSchemaSubjectStrip analysisData={analysisData} videoId={videoId} />
                </PanelDropdownSection>
                <PanelDropdownSection
                  title="Suggested Matches"
                  summary="Matcher results that may help confirm more appearances of known characters."
                  count={Array.isArray(analysisData?.evidenceProliferationMatches) ? analysisData.evidenceProliferationMatches.length : undefined}
                  defaultOpen={false}
                >
                  <MatureProliferationMatchStrip
                    matches={analysisData?.evidenceProliferationMatches}
                    videoId={videoId}
                  />
                </PanelDropdownSection>
              </>
            ) : (
              <>
                <MatureEvidenceStrip analysisData={analysisData} />
                <ConfirmationProgramStrip analysisData={analysisData} videoId={videoId} />
                <MasterSchemaSubjectStrip analysisData={analysisData} videoId={videoId} />
                <MatureProliferationMatchStrip
                  matches={analysisData?.evidenceProliferationMatches}
                  videoId={videoId}
                />
              </>
            )}
            {category === "Identification" ? (
              <>
                <PanelDropdownSection
                  title="Suggested Labels"
                  summary="Candidate meanings and labels that can be reviewed before becoming mature evidence."
                  defaultOpen={false}
                >
                  <SecondOrderLabelReviewTray
                    plan={analysisData?.secondOrderLabelProliferation}
                  />
                </PanelDropdownSection>
                <PanelDropdownSection
                  title="Character Candidates"
                  summary="Possible character identity candidates that can be refreshed and promoted."
                  count={identityLedger?.candidates?.length ?? 0}
                  defaultOpen={false}
                >
                  <AutomaticEvidenceSection
                    category={category}
                    analysisData={analysisData}
                    videoId={videoId}
                    identityLedger={identityLedger}
                    identityActionMessage={identityActionMessage}
                    isIdentityActionBusy={isIdentityActionBusy}
                    identityDrafts={identityDrafts}
                    onCreateIdentityCandidates={createIdentityCandidates}
                    onIdentityDraftChange={updateIdentityDraft}
                    onPromoteIdentityCandidate={promoteIdentityCandidate}
                  />
                </PanelDropdownSection>
              </>
            ) : (
              <>
                <SecondOrderLabelReviewTray
                  plan={analysisData?.secondOrderLabelProliferation}
                />
                <AutomaticEvidenceSection
                  category={category}
                  analysisData={analysisData}
                  videoId={videoId}
                  identityLedger={identityLedger}
                  identityActionMessage={identityActionMessage}
                  isIdentityActionBusy={isIdentityActionBusy}
                  identityDrafts={identityDrafts}
                  onCreateIdentityCandidates={createIdentityCandidates}
                  onIdentityDraftChange={updateIdentityDraft}
                  onPromoteIdentityCandidate={promoteIdentityCandidate}
                />
              </>
            )}
            <PanelDropdownSection
              title={category === "Identification" ? "Source Annotations" : "Manual Annotations"}
              summary="Source-time and BBox/ROI anchored analyst annotations."
              count={totalAnnotations}
              defaultOpen={category !== "Identification"}
            >
            {groupedAnnotations.length === 0 ? (
          <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
            No manual annotations in this schema view yet.
          </div>
            ) : (
          <div className="space-y-2">
            {groupedAnnotations.map((group) => (
              <section
                key={group.category}
                className="rounded border border-slate-800 bg-slate-950/20"
              >
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                  <h3 className="text-[11px] font-semibold text-slate-200">
                    {manualCategoryDisplayLabel(group.category)}
                  </h3>
                  <span className="text-[10px] text-[var(--ui-passive-text)]">
                    {group.items.length}
                  </span>
                </div>
                <div className="space-y-1 p-2">
                  {group.items.map((item) => {
                    const selected = selectedAnnotationId === item.id;
                    const draft = leafDrafts[item.id] || buildLeafDraft(item);
                    const startInputKey = `${item.id}:start`;
                    const endInputKey = `${item.id}:end`;
                    return (
                      <div
                        key={item.id}
                        className={`rounded border ${
                          selected
                            ? "border-cyan-400/40 bg-cyan-400/5"
                            : "border-slate-800 bg-[#111214]"
                        } px-2 py-1.5 text-[10px] text-slate-200`}
                      >
                        <button
                          type="button"
                          data-vaa1-manual-narrative-agent-row-navigation={
                            group.category === "Identification" ? "true" : undefined
                          }
                          className="block w-full text-left hover:text-slate-50"
                          onClick={() => selectAnnotationForEditing(item)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium">
                              {getManualAnnotationTitle(item)}
                            </span>
                            <span className="shrink-0 text-[var(--ui-passive-text)]">
                              {formatSeconds(item.start_seconds ?? item.timestamp_seconds)}
                              {item.end_seconds !== undefined
                                ? `-${formatSeconds(item.end_seconds)}`
                                : ""}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[var(--ui-passive-text)]">
                            {getManualAnnotationDetail(item)}
                          </div>
                          {item.open_note ? (
                            <div className="mt-0.5 line-clamp-2 text-[var(--ui-passive-text)]">
                              {item.open_note}
                            </div>
                          ) : null}
                        </button>

                        {selected ? (
                          <div className="mt-2 rounded border border-slate-800 bg-black/25 p-2">
                            <div className="grid gap-1 md:grid-cols-[1fr_1fr]">
                              <select
                                value={draft.category}
                                onChange={(event) =>
                                  updateLeafDraft(item.id, {
                                    category: event.target.value as ManualVisualAnnotation["category"],
                                  })
                                }
                                className="min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
                              >
                                {CATEGORY_ORDER.map((option) => (
                                  <option key={option} value={option}>
                                    {manualCategoryDisplayLabel(option)}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={draft.subcategory}
                                onChange={(event) =>
                                  updateLeafDraft(item.id, {
                                    subcategory: event.target.value,
                                  })
                                }
                                className="min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
                              >
                                {(MANUAL_SUBCATEGORIES[draft.category] || []).map((option) => (
                                  <option key={option} value={option}>
                                    {manualSubcategoryDisplayLabel(draft.category, option)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="mt-1 grid gap-1 md:grid-cols-[1fr_0.6fr_0.6fr]">
                              <div className="flex flex-col gap-1 min-w-0">
                                <select
                                  value={
                                    ["bystander", "friend", "foe"].includes(draft.label.toLowerCase())
                                      ? draft.label.toLowerCase()
                                      : knownCharacters.includes(draft.label)
                                      ? draft.label
                                      : "open tag"
                                  }
                                  onChange={(event) => {
                                    const val = event.target.value;
                                    if (val !== "open tag") {
                                      const isKnownCharacter = knownCharacters.includes(val);
                                      updateLeafDraft(item.id, {
                                        label: val,
                                        ...(isKnownCharacter ? { category: "Identification" } : {}),
                                        identityAffirmation:
                                          isKnownCharacter || draft.category === "Identification"
                                            ? val
                                            : draft.identityAffirmation,
                                      });
                                    }
                                  }}
                                  className="w-full rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
                                  aria-label="Quick label select"
                                >
                                  <option value="open tag">Open tag</option>
                                  {knownCharacters.length > 0 && (
                                    <optgroup label="A) Narrative Agent">
                                      {knownCharacters.map((char: string) => (
                                        <option key={char} value={char}>
                                          {char}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <optgroup label="B) By-stander">
                                    <option value="bystander">bystander</option>
                                  </optgroup>
                                  <optgroup label="C) Friend/Foe">
                                    <option value="friend">friend</option>
                                    <option value="foe">foe</option>
                                  </optgroup>
                                </select>
                                <input
                                  value={draft.label}
                                  onChange={(event) =>
                                    updateLeafDraft(item.id, {
                                      label: event.target.value,
                                      identityAffirmation:
                                        draft.category === "Identification"
                                          ? event.target.value
                                          : draft.identityAffirmation,
                                    })
                                  }
                                  className="w-full rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
                                  placeholder="Label, Narrative Agent, or indication"
                                />
                              </div>
                              <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                                In {formatSeconds(draft.start)}
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    timeInputDrafts[startInputKey] ??
                                    formatSeconds(draft.start)
                                  }
                                  onChange={(event) => {
                                    setTimeInputDrafts((current) => ({
                                      ...current,
                                      [startInputKey]: event.target.value,
                                    }));
                                  }}
                                  onBlur={() =>
                                    commitLeafTimeInput(
                                      startInputKey,
                                      item.id,
                                      "start",
                                      draft.start,
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      commitLeafTimeInput(
                                        startInputKey,
                                        item.id,
                                        "start",
                                        draft.start,
                                      );
                                      event.currentTarget.blur();
                                    } else if (event.key === "Escape") {
                                      setTimeInputDrafts((current) => {
                                        const next = { ...current };
                                        delete next[startInputKey];
                                        return next;
                                      });
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                                  aria-label="Start time"
                                />
                              </label>
                              <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                                Out {formatSeconds(draft.end)}
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    timeInputDrafts[endInputKey] ??
                                    formatSeconds(draft.end)
                                  }
                                  onChange={(event) => {
                                    setTimeInputDrafts((current) => ({
                                      ...current,
                                      [endInputKey]: event.target.value,
                                    }));
                                  }}
                                  onBlur={() =>
                                    commitLeafTimeInput(
                                      endInputKey,
                                      item.id,
                                      "end",
                                      draft.end,
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      commitLeafTimeInput(
                                        endInputKey,
                                        item.id,
                                        "end",
                                        draft.end,
                                      );
                                      event.currentTarget.blur();
                                    } else if (event.key === "Escape") {
                                      setTimeInputDrafts((current) => {
                                        const next = { ...current };
                                        delete next[endInputKey];
                                        return next;
                                      });
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                                  aria-label="End time"
                                />
                              </label>
                            </div>
                            <textarea
                              value={draft.note}
                              onChange={(event) =>
                                updateLeafDraft(item.id, { note: event.target.value })
                              }
                              className="mt-1 min-h-14 w-full rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
                              placeholder="Analyst note"
                            />
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                className="rounded bg-emerald-900/50 px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-800/70"
                                onClick={() => void saveLeafAnnotation(item)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                                onClick={() => activateVideoForAnnotation(item)}
                              >
                                Show video
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                                onClick={() => {
                                  const start = Number(draft.start || 0);
                                  eventBus.emit("videoTimeLineChanged", start);
                                }}
                              >
                                Go start
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                                onClick={() => {
                                  const end = Number(draft.end || 0);
                                  eventBus.emit("videoTimeLineChanged", end);
                                }}
                              >
                                Go end
                              </button>
                              <button
                                type="button"
                                className="rounded bg-rose-900/40 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-800/60"
                                onClick={() => void deleteLeafAnnotation(item)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
            )}
            </PanelDropdownSection>
            {leafActionMessage ? (
              <div className="mt-2 rounded border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-100">
                {leafActionMessage}
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
