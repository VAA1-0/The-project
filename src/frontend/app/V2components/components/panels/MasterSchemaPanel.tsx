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
  upsertManualVisualAnnotation,
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
};

const NARRATIVE_AGENT_ARCHETYPE_LENSES = [
  {
    id: "shakespearean_performativity",
    label: "Performed agency",
    tradition: "Shakespearean",
    description: "Public role, private motive, status pressure, and rhetorical agency.",
  },
  {
    id: "proppian_function",
    label: "Narrative function",
    tradition: "Proppian",
    description: "Helper, opponent, donor, dispatcher, false hero, or task relation.",
  },
  {
    id: "jungian_symbolic",
    label: "Symbolic shadow",
    tradition: "Jungian / Mythic",
    description: "Shadow, mentor, trickster, mask, projection, or symbolic relation.",
  },
  {
    id: "greimasian_actant",
    label: "Actant relation",
    tradition: "Greimasian",
    description: "Subject, object, sender, receiver, helper, opponent, and goal structure.",
  },
  {
    id: "burkean_motive",
    label: "Motive scene",
    tradition: "Burkean / Dramatistic",
    description: "Act, scene, agent, agency, purpose, guilt, and motive.",
  },
];

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
  const key = normalizeAgentKey(patch.label);
  if (!key) return;
  const existing = rows.get(key);
  const next: NarrativeAgentPathRow = {
    key,
    label: patch.label,
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
    scenePresence: existing?.scenePresence || patch.scenePresence || [],
    sourceItem: existing?.sourceItem || patch.sourceItem,
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

  const nextRows = [...rows.values()].map((row) => {
    const cues = instructions.filter((instruction) => instructionTouchesAgent(instruction, row.label));
    const cueStart = cues
      .map(secondsFromInstruction)
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right)[0];
    const supportTimes = [
      ...timeSupportsFromSourceItem(row.sourceItem),
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
            Mature Evidence View
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
    openEvidenceNavigation(videoId, target);
    if (navigation.panelType === "TracebackDrawer") {
      emitEvidenceTraceback(videoId, target);
    }
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
    emitEvidenceTraceback(videoId, target);
  };
  return (
    <section className="mb-2 rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
            User Confirmed Anchor
          </div>
          <div className="mt-0.5 max-w-3xl text-[10px] text-[var(--ui-passive-text)]">
            {anchor?.principle ||
              "User confirmed corrections and annotations anchor mature sense-making."}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-cyan-700/60 bg-[#111214] px-2 py-1 text-[10px] text-cyan-100 hover:border-cyan-400/80 hover:bg-cyan-950/30"
          onClick={() =>
            emitEvidenceTraceback(videoId, {
              id: "user_confirmed_anchor",
              label: program?.consults_user_confirmed_anchor
                ? "Confirmations consult anchors"
                : "Anchor consultation pending",
              evidenceType: "user_confirmed_anchor",
              sourcePanel: "MasterSchema",
              sourceRefs: { media_id: videoId, metadata_id: "user_confirmed_anchor" },
              sourceItem: asRecord(audit),
            })
          }
        >
          {program?.consults_user_confirmed_anchor
            ? "Confirmations consult anchors"
            : "Anchor consultation pending"}
        </button>
      </div>
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
            Master Schema Subject Authority
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
        {subjects.slice(0, 18).map((subject) => (
          <button
            key={subject.id}
            type="button"
            data-vaa1-master-schema-subject-navigation="true"
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
          </button>
        ))}
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
            Proliferation Candidate Matches
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

function NarrativeAgentCharacterPathsHome({
  analysisData,
  videoId,
  openPanel,
}: {
  analysisData: any;
  videoId: string;
  openPanel: (panelType: string, panelProps?: any) => void;
}) {
  const rows = useMemo(
    () => buildNarrativeAgentPathRows(analysisData),
    [analysisData],
  );
  return (
    <section
      className="mb-2 rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-2"
      data-vaa1-narrative-agent-character-paths="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
            Narrative Agent Character Paths
          </div>
          <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--ui-passive-text)]">
            Agent-centered continuity, scenes, evidence, and dramatic readings live here.
            Meaning / Plot remains the cross-agent plot map.
          </div>
        </div>
        <button
          type="button"
          className="rounded border border-cyan-700/60 bg-[#111214] px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/30"
          onClick={() => openPanel("MeaningPlot", videoId ? { videoId } : {})}
        >
          Meaning / Plot map
        </button>
      </div>

      <div className="mt-2 rounded border border-cyan-900/40 bg-[#111214] px-2 py-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
          Dramatic Archetype Readings
        </div>
        <div className="mt-0.5 text-[10px] text-[var(--ui-passive-text)]">
          Cross-tradition readings, not imposed as Narrative Agent labels.
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {NARRATIVE_AGENT_ARCHETYPE_LENSES.map((lens) => (
            <button
              key={lens.label}
              type="button"
              className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
              title={lens.description}
              data-vaa1-narrative-agent-archetype-navigation="true"
              onClick={() => {
                eventBus.emit("meaningPlotArchetypeLensRequested", lens.id);
                openPanel("MeaningPlot", videoId ? { videoId } : {});
              }}
            >
              {lens.label} / {lens.tradition}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {rows.length === 0 ? (
          <div className="rounded border border-slate-800 bg-[#111214] px-2 py-2 text-[10px] text-[var(--ui-passive-text)]">
            No governed Narrative Agent paths yet. Confirm or name an agent to seed this home.
          </div>
        ) : (
          rows.slice(0, 16).map((row) => (
            <div
              key={row.key}
              className="rounded border border-slate-800 bg-[#111214] px-2 py-2"
              data-vaa1-narrative-agent-path-row="true"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-slate-100">
                    {row.label}
                  </div>
                  <div className="mt-0.5 text-[9px] text-[var(--ui-passive-text)]">
                    {row.source}
                    {row.role ? ` / ${row.role}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  {row.start !== undefined && (
                    <button
                      type="button"
                      className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-600 hover:text-cyan-100"
                      onClick={() => openVideoAtTime(videoId, row.start || 0)}
                    >
                      source {formatSeconds(row.start)}
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
                  cues {row.cueCount}
                </span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">
                  scenes {row.sceneCount}
                </span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">
                  manual {row.manualCount}
                </span>
                {row.evidenceChips.slice(0, 6).map((chip) => (
                  <span
                    key={chip}
                    className="rounded border border-cyan-900/50 bg-cyan-950/20 px-1.5 py-0.5 text-[9px] text-cyan-100"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div
                className="mt-2 flex flex-wrap gap-1"
                data-vaa1-narrative-agent-scene-presence="true"
              >
                {row.scenePresence.length > 0 ? (
                  row.scenePresence.map((scene) => (
                    <button
                      key={`${row.key}:scene:${scene.sceneIndex}:${scene.start}`}
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
              {row.cues.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.cues.slice(0, 3).map((cue) => (
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
          ))
        )}
      </div>
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
      if (!videoId) {
        setAnalysisData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        setAnalysisData(await VideoService.getAnalysis(videoId));
      } catch (error) {
        console.error("Failed to load master schema annotations:", error);
        setAnalysisData(null);
      } finally {
        setIsLoading(false);
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

        {isLoading ? (
          <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
            Loading master schema...
          </div>
        ) : (
          <>
            <MatureEvidenceStrip analysisData={analysisData} />
            <ConfirmationProgramStrip analysisData={analysisData} videoId={videoId} />
            <MasterSchemaSubjectStrip analysisData={analysisData} videoId={videoId} />
            <MatureProliferationMatchStrip
              matches={analysisData?.evidenceProliferationMatches}
              videoId={videoId}
            />
            {category === "Identification" && (
              <NarrativeAgentCharacterPathsHome
                analysisData={analysisData}
                videoId={videoId}
                openPanel={openPanel}
              />
            )}
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
