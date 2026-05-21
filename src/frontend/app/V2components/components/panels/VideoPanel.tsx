// src/frontend/app/V2components/components/panels/VideoPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import {
  VideoService,
  type AnalysisData,
  type DetectedObject,
  type ExpressionSample,
  type MasterSchemaResolvedEvidenceRecord,
  type MatureEvidenceAuthority,
  type OCR,
  type VideoMetadata,
  groupDetectedObjectsForDisplay,
} from "@/lib/video-service";
import {
  buildEvidenceNavigationState,
  resolveManualVisualEvidence,
  type EvidenceNavigationState,
  type ResolvedEvidenceItem,
} from "@/lib/evidence-authority";
import { getVideoBlob, saveVideoBlob } from "@/lib/blob-store";
import {
  broadcastAnalysisCorrectionRefresh,
  buildCorrectionRule,
  buildDropCorrectionRule,
  mergeCorrectionRule,
  pushCorrectionSnapshot,
  removeManualVisualAnnotation,
  upsertManualVisualAnnotation,
} from "@/lib/annotation-corrections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMediaGenreOptions,
  getSituationalGenreOptions,
  MEDIA_SUBGENRE_OPTIONS,
  SITUATIONAL_SUBGENRE_OPTIONS,
  SITUATIONAL_TAXONOMY_OPTIONS,
} from "@/lib/metadata-taxonomy";
import { buildExpressionWeighting } from "@/lib/expression-weighting";
import { useLayoutHost } from "../LayoutHost";
import {
  formatSecondOrderInstructionLabel,
  getPrimarySecondOrderInstruction,
  SecondOrderLabelAffirmationChips,
} from "./SecondOrderLabelAffirmations";
import { apiService, type EvidenceProliferationCandidate, type ManualVisualAnnotation } from "@/lib/api-service";

const SINGLE_SOURCE_MARKS_KEY_PREFIX = "vaa1.video.marks.";
const CROSS_SOURCE_COMPARE_KEY = "vaa1.video.compare-anchor";
const MANUAL_POINT_VISIBILITY_SECONDS = 0.08;
const MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS = 0.03;
const MANUAL_GEOMETRY_INTERPOLATION_MAX_GAP_SECONDS = 0.5;
const EXPRESSION_IDENTITY_ANCHOR_WINDOW_SECONDS = 1.5;
const SELECTED_OVERLAY_STACK_RANK = 50000;
const VIDEO_CONTROL_CLEARANCE_PX = 52;

type OverlayToggleKey = "objects" | "ocr" | "expressions" | "manual";

type RenderedVideoRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SingleSourceMarks = {
  a?: number;
  b?: number;
};

type CompareAnchor = {
  videoId: string;
  name: string;
  time: number;
};

type CompareVideoSource = {
  videoId: string;
  name: string;
  time: number;
  videoUrl: string | null;
  metadata: VideoMetadata | null;
  blobMissing: boolean;
};

type OverlayBox = {
  key: string;
  modality: "object" | "ocr" | "expression" | "manual";
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sourceItem?: any;
};

type MatureObjectOverlayLabel = {
  label: string;
  rawLabel?: string;
  authority: MatureEvidenceAuthority;
  sourcePanel: string;
  maturityRoute?: string;
  mappingStatus?: string;
  roleLabel?: string;
  sourceCategory?: MasterSchemaResolvedEvidenceRecord["category"];
  traceback?: unknown;
  evidence_refs?: unknown;
  source_bbox_refs?: unknown;
  source_frame_refs?: unknown;
};

type BBoxMatureAuthority = {
  label: string;
  authority: MatureEvidenceAuthority;
  source: "manual_visual_annotation" | "master_schema" | "narrative_agent" | "proliferated_candidate";
  sourceItem?: unknown;
  roleLabel?: string;
  traceback?: unknown;
  evidence_refs?: unknown;
  source_bbox_refs?: unknown;
  source_frame_refs?: unknown;
};

type SelectedIndicationEdit = {
  category: ManualVisualAnnotation["category"];
  subcategory: string;
  label: string;
  identityAffirmation: string;
  applyScope: BBoxRoiApplyScope;
  quickAnnotations: string[];
  start: number;
  end: number;
  note: string;
};

type ManualAnnotationDraft = {
  category: ManualVisualAnnotation["category"];
  subcategory: string;
  readyLabel: string;
  label: string;
  mediaGenreParent: string;
  situationalGenreParent: string;
  identityAffirmation: string;
  roleAffirmation: string;
  audioFoleyNote: string;
  openNote: string;
};

type DraftBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type LockedForensicRoi = {
  box: DraftBox;
  videoId?: string;
  time?: number;
};

type ManualGeometryKeyframe = NonNullable<
  ManualVisualAnnotation["geometry_keyframes"]
>[number];

type OverlayGeometryDraft = {
  box: DraftBox;
  time: number;
};

type OverlayGeometryDrag = {
  overlayKey: string;
  mode: "move" | "resize-se";
  startPoint: { x: number; y: number };
  startBox: DraftBox;
};

type BBoxRoiApplyScope =
  | "this_interval_only"
  | "this_bbox_roi_only"
  | "current_scene"
  | "current_continuity_segment"
  | "linked_candidates"
  | "track_family"
  | "narrative_agent_family";

type ProliferationScope =
  | "same_video"
  | "open_analyses"
  | "selected_media_set"
  | "whole_case";

type ProliferationTarget =
  | "character_continuity"
  | "object"
  | "role"
  | "action"
  | "interaction"
  | "scene_episode"
  | "ocr_text_phrase"
  | "speaker_voice_continuity"
  | "sound_event"
  | "music_motif"
  | "ambient_sound"
  | "prosody_delivery_pattern"
  | "visual_pattern";

type ProliferationLauncherState = {
  open: boolean;
  scope: ProliferationScope;
  target: ProliferationTarget;
  requestProgress?: number;
  matchingProgress?: number;
  candidateCount?: number;
  candidates?: EvidenceProliferationCandidate[];
  message?: string;
  error?: string;
};

const PROLIFERATION_SCOPE_OPTIONS: Array<{
  value: ProliferationScope;
  label: string;
}> = [
  { value: "same_video", label: "Same video" },
  { value: "open_analyses", label: "Open analyses" },
  { value: "selected_media_set", label: "Selected media set" },
  { value: "whole_case", label: "Whole case" },
];

const PROLIFERATION_TARGET_OPTIONS: Array<{
  value: ProliferationTarget;
  label: string;
}> = [
  { value: "character_continuity", label: "Character continuity" },
  { value: "object", label: "Object" },
  { value: "role", label: "Role" },
  { value: "action", label: "Action" },
  { value: "interaction", label: "Interaction" },
  { value: "scene_episode", label: "Scene / episode" },
  { value: "ocr_text_phrase", label: "OCR / text phrase" },
  { value: "speaker_voice_continuity", label: "Speaker / voice continuity" },
  { value: "sound_event", label: "Sound event" },
  { value: "music_motif", label: "Music / motif" },
  { value: "ambient_sound", label: "Ambient sound" },
  { value: "prosody_delivery_pattern", label: "Prosody / delivery pattern" },
  { value: "visual_pattern", label: "Visual pattern" },
];

const DEFAULT_PROLIFERATION_LAUNCHER: ProliferationLauncherState = {
  open: false,
  scope: "same_video",
  target: "character_continuity",
  requestProgress: 0,
  matchingProgress: 0,
};

type PendingObjectOverlayEdit = {
  videoId?: string;
  timestamp?: number;
  trackId?: number;
  label?: string;
  start?: number;
  end?: number;
  category?: ManualVisualAnnotation["category"];
  note?: string;
};

type LocalObjectLabelOverride = {
  videoId?: string;
  trackId?: number;
  sourceLabel?: string;
  label: string;
  start?: number;
  end?: number;
};

type StoredProliferationMatch = {
  videoId?: string;
  overlayKey?: string;
  request_id?: string;
  candidate_count?: number;
  candidates?: EvidenceProliferationCandidate[];
  updated_at?: string;
};

type ForensicRegionSelectedPayload = {
  videoId: string;
  time: number;
  intent?: ForensicRoiIntent;
  label?: string;
  region: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  normalizedRegion: DraftBox;
};

type ForensicRoiIntent =
  | "identification"
  | "expression"
  | "micro_expression"
  | "movement"
  | "object"
  | "ocr"
  | "interaction"
  | "other";

const FORENSIC_ROI_INTENT_OPTIONS: Array<{
  value: ForensicRoiIntent;
  label: string;
}> = [
  { value: "expression", label: "Expressions" },
  { value: "identification", label: "Narrative Agent" },
  { value: "interaction", label: "Interaction" },
  { value: "micro_expression", label: "Micro-granular Expression" },
  { value: "movement", label: "Movement" },
  { value: "ocr", label: "OCR" },
  { value: "object", label: "Object" },
  { value: "other", label: "Other" },
];

type ForensicRegionDraftPayload = {
  videoId?: string;
  time?: number;
  region?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  normalizedRegion?: DraftBox;
};

const CUSTOM_LABEL_VALUE = "__custom__";

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

const NATIVE_ANNOTATION_CATEGORIES: ManualVisualAnnotation["category"][] = [
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

const BBOX_ROI_APPLY_SCOPE_OPTIONS: Array<{
  value: BBoxRoiApplyScope;
  label: string;
  dangerous?: boolean;
}> = [
  { value: "this_interval_only", label: "This interval only" },
  { value: "this_bbox_roi_only", label: "This BBox/ROI only" },
  { value: "current_scene", label: "Current scene" },
  { value: "current_continuity_segment", label: "Current continuity segment" },
  { value: "linked_candidates", label: "Linked candidates" },
  { value: "track_family", label: "Track family", dangerous: true },
  { value: "narrative_agent_family", label: "Narrative Agent family", dangerous: true },
];

const BBOX_ROI_EVIDENCE_HUB_SECTIONS: Array<{
  id:
    | "evidence"
    | "narrative_agent"
    | "relations"
    | "genre_dramaturgy"
    | "time_continuity"
    | "grouping"
    | "traceback_authority"
    | "operations";
  label: string;
  items: string[];
}> = [
  {
    id: "evidence",
    label: "Evidence",
    items: ["Object", "Expression", "OCR", "Audio", "Transcript", "Metadata", "Source Sample"],
  },
  {
    id: "narrative_agent",
    label: "Narrative Agent",
    items: ["Assign Agent", "Create Agent", "Agent Continuity", "Role Candidate"],
  },
  {
    id: "relations",
    label: "Relations",
    items: ["Agent to Agent", "Agent to Object", "Attention", "Conflict", "Cooperation", "Dominance"],
  },
  {
    id: "genre_dramaturgy",
    label: "Genre & Dramaturgy",
    items: ["Genre", "Dramatic Function", "Role Archetype", "Scene Function", "Tone"],
  },
  {
    id: "time_continuity",
    label: "Time & Continuity",
    items: ["Interval", "Keyframes", "Track Continuity", "Time Bank", "Compare Anchors"],
  },
  {
    id: "grouping",
    label: "Grouping",
    items: ["Group Evidence", "Track Family", "Interaction Cluster", "Scene Group"],
  },
  {
    id: "traceback_authority",
    label: "Traceback & Authority",
    items: ["Source Chain", "Manual Correction", "Geometry History", "Maturity History"],
  },
  {
    id: "operations",
    label: "Operations",
    items: ["Accept", "Correct", "Reject", "Save", "Render", "Open in Panel"],
  },
];

const BBOX_ROI_RELATION_QUICK_ACTIONS = [
  "speaking to",
  "listening to",
  "flirting with",
  "making out with",
  "leading",
  "encouraging",
  "comforting",
  "celebrating with",
  "supporting",
  "trusting",
  "threatening",
  "looking at",
  "following",
  "dominating",
  "protecting",
  "cooperating with",
  "interrogating",
];

const BBOX_ROI_ACTION_QUICK_ACTIONS = [
  "sitting",
  "walking",
  "driving/riding",
  "running",
  "swimming",
  "jumping",
  "climbing",
  "pulling",
  "taking",
  "handing",
];

const BBOX_ROI_QUICK_ANNOTATIONS = [
  ...BBOX_ROI_RELATION_QUICK_ACTIONS,
  ...BBOX_ROI_ACTION_QUICK_ACTIONS,
];

const MANUAL_CATEGORY_PANEL_MAP: Record<
  ManualVisualAnnotation["category"],
  string
> = {
  Action: "ManualAction",
  Audio: "ManualAudio",
  "Cinematic Cues": "ManualCinematicCues",
  Expressions: "ManualExpressions",
  Genre: "ManualGenre",
  Identification: "ManualIdentification",
  Interaction: "ManualInteraction",
  Metadata: "ManualMetadata",
  Movement: "ManualMovement",
  Notes: "ManualNotes",
  OBJ: "ManualOBJ",
  OCR: "ManualOCR",
  Role: "ManualRole",
  Scene: "ManualScene",
  Transcription: "ManualTranscription",
};

const NATIVE_ANNOTATION_SUBCATEGORIES: Record<
  ManualVisualAnnotation["category"],
  string[]
> = {
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

const NATIVE_ANNOTATION_LABELS: Record<string, string[]> = {
  "Action::Action": ["Driving", "Entering", "Exiting", "Holding", "Running", "Sitting", "Standing", "Walking"],
  "Audio::Ambience": ["Crowd noise", "Indoor hum", "Street noise", "Wind"],
  "Audio::Foley": ["Door close", "Footsteps", "Glass impact", "Walking on snow"],
  "Audio::Music": ["Background score", "Dissonant cue", "Suspense cue", "Theme cue"],
  "Audio::Prosody": ["Emphasis", "Flat delivery", "Raised voice", "Whisper"],
  "Audio::Sound event": ["Door slam", "Explosion", "Gun shot", "Phone ring"],
  "Audio::Speaker-state": ["Agitated", "Calm", "Fearful", "Urgent"],
  "Cinematic Cues::Composition": ["Center-weighted", "Foreground obstruction", "Symmetry", "Wide isolation"],
  "Cinematic Cues::Lighting": ["Backlit", "Cold lighting", "High contrast", "Low-key lighting"],
  "Cinematic Cues::Shot size": ["Close-up", "Extreme close-up", "Long shot", "Medium shot"],
  "Cinematic Cues::Transition": ["Cut", "Dissolve", "Fade", "Match cut"],
  "Expressions::Emotion": ["Anger", "Fear", "Joy", "Sadness", "Surprise"],
  "Expressions::Expression": ["Concern", "Determination", "Neutral", "Tension"],
  "Identification::Character": ["Character present", "Unidentified person"],
  "Identification::Identity": ["Narrative Agent affirmed", "Narrative Agent uncertain"],
  "Interaction::Exchange": ["Confrontation", "Conversation", "Observation", "Pursuit"],
  "Interaction::Interaction": ["Assistance", "Conflict", "Contact", "Threat"],
  "Metadata::Context": ["Metadata supports annotation", "Metadata updated from annotation"],
  "Metadata::Correlation": ["Contradicts metadata", "Extends metadata", "Matches metadata", "Supports metadata"],
  "Movement::Camera movement": ["Pan", "Static camera", "Tilt", "Zoom"],
  "Movement::Subject movement": ["Approach", "Retreat", "Turn", "Walk"],
  "Notes::Timestamped note": ["Analyst note", "Correction note", "Open note"],
  "OBJ::Object label": ["Bag", "Car", "Door", "Person", "Phone", "Weapon"],
  "OCR::Visible text": ["Name card", "On-screen caption", "Signage", "Subtitle"],
  "Role::Role affirmation": ["Authority", "Customer service", "Driver", "Guard", "Police officer"],
  "Scene::Location": ["Indoor", "Outdoor", "Street", "Waiting area"],
  "Scene::Scene type": ["Arrival", "Checkpoint", "Conversation scene", "Transition scene"],
  "Transcription::Speech content": ["Correct transcript", "Missing utterance", "Speaker overlap"],
  "Transcription::Transcript note": ["Ambiguous phrase", "Manual clarification", "Timestamp note"],
};

const NARRATIVE_AGENT_QUICK_CHOICES = ["by-stander", "friend", "foe", "crowd"];

type AudioTimelineMarker = {
  key: string;
  time: number;
  label: string;
  detail: string;
  colorClass: string;
};

type VideoFrameMetadata = {
  mediaTime: number;
};

function getObjectOverlayConfidenceThreshold(className: string): number {
  switch (className) {
    case "person":
      return 0.78;
    case "chair":
    case "bottle":
    case "handbag":
    case "backpack":
    case "potted plant":
    case "refrigerator":
    case "suitcase":
    case "sports ball":
      return 0.86;
    default:
      return 0.82;
  }
}

function getObjectFallbackConfidenceThreshold(className: string): number {
  return className === "person" ? 0.25 : getObjectOverlayConfidenceThreshold(className);
}

function isFallbackPersonDetection(item: DetectedObject): boolean {
  return (
    item.class_name === "person" &&
    (item.confidence || 0) < getObjectOverlayConfidenceThreshold("person")
  );
}

function getDefaultCategoryForOverlay(
  overlay: OverlayBox,
): ManualVisualAnnotation["category"] {
  if (overlay.modality === "ocr") return "OCR";
  if (overlay.modality === "expression") return "Expressions";
  if (overlay.modality === "manual") {
    const annotation = overlay.sourceItem as ManualVisualAnnotation | undefined;
    return annotation?.category || "OBJ";
  }
  const className = String(
    overlay.sourceItem?.class_name || overlay.sourceItem?.raw_class_name || overlay.label || "",
  ).toLowerCase();
  return className === "person" ? "Identification" : "OBJ";
}

function getFirstSubcategoryForCategory(
  category: ManualVisualAnnotation["category"],
): string {
  return NATIVE_ANNOTATION_SUBCATEGORIES[category]?.[0] || "";
}

function resolveIndicationLabel(
  category: ManualVisualAnnotation["category"],
  label: string,
): string {
  const trimmed = label.trim();
  if (trimmed) return trimmed;
  if (category === "Identification") return "Character present";
  if (category === "OBJ") return "Object present";
  if (category === "OCR") return "Visible text";
  return `${category} indication`;
}

function resolveManualVisualDisplayLabel(item: ManualVisualAnnotation): string {
  return (
    item.identity_affirmation ||
    item.role_affirmation ||
    item.custom_label ||
    item.label ||
    "manual annotation"
  ).trim();
}

function objectTrackTargetId(item: DetectedObject): string | null {
  const correlatedTargetId = (item as any).metadataCorrelation?.target_id;
  if (correlatedTargetId !== undefined && correlatedTargetId !== null) {
    return String(correlatedTargetId);
  }
  const trackId = item.trackId ?? (item as any).track_id;
  return trackId === undefined || trackId === null ? null : String(trackId);
}

function objectTrackTargetIds(item: DetectedObject): string[] {
  const ids = new Set<string>();
  const primary = objectTrackTargetId(item);
  if (primary) {
    ids.add(primary);
  }
  const duplicateIds = (item as any).duplicateTrackIds;
  if (Array.isArray(duplicateIds)) {
    duplicateIds.forEach((trackId) => {
      if (trackId !== undefined && trackId !== null) {
        ids.add(String(trackId));
      }
    });
  }
  const correlatedTargetId = (item as any).metadataCorrelation?.target_id;
  if (correlatedTargetId !== undefined && correlatedTargetId !== null) {
    ids.add(String(correlatedTargetId));
  }
  return Array.from(ids);
}

function manualObjectTargetId(item: ManualVisualAnnotation): string | null {
  const targetType = String(item.metadata_correlation?.target_type || "").toLowerCase();
  if (targetType !== "object") {
    return null;
  }
  const targetId = item.metadata_correlation?.target_id;
  return targetId === undefined || targetId === null ? null : String(targetId);
}

function normalizeEvidenceLabel(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function appendKnownNarrativeAgentLabel(
  labels: Set<string>,
  value: unknown,
): void {
  const label = String(value || "").trim();
  if (!label) return;
  const normalized = normalizeEvidenceLabel(label);
  if (
    !normalized ||
    normalized === "unknown" ||
    normalized === "unknown_speaker" ||
    normalized === "person" ||
    normalized.startsWith("person track") ||
    normalized.startsWith("track ")
  ) {
    return;
  }
  labels.add(label);
}

function isRawDetectionLikeLabel(value: unknown): boolean {
  const normalized = normalizeEvidenceLabel(value);
  return (
    !normalized ||
    normalized === "unknown" ||
    normalized === "unknown speaker" ||
    normalized === "unknown_speaker" ||
    normalized === "object" ||
    normalized === "person" ||
    normalized === "track" ||
    normalized.startsWith("person track") ||
    normalized.startsWith("track ") ||
    /^person\s*\d+$/i.test(normalized) ||
    /^person[_-]\d+$/i.test(normalized)
  );
}

function governedOverlayLabel(value: unknown): string | undefined {
  const label = String(value || "").trim();
  return label && !isRawDetectionLikeLabel(label) ? label : undefined;
}

function joinGovernedOverlayLabel(...values: unknown[]): string | undefined {
  const parts = values
    .map((value) => governedOverlayLabel(value))
    .filter(Boolean) as string[];
  return parts.length ? parts.join(" / ") : undefined;
}

function appendKnownNarrativeAgentValues(
  labels: Set<string>,
  value: unknown,
): void {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => appendKnownNarrativeAgentValues(labels, item));
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    appendKnownNarrativeAgentLabel(
      labels,
      record.narrative_agent_name ||
        record.character_name ||
        record.character ||
        record.name ||
        record.label,
    );
    appendKnownNarrativeAgentValues(labels, record.aliases);
    return;
  }
  appendKnownNarrativeAgentLabel(labels, value);
}

function unresolvedObjectConfirmationLabel(item: DetectedObject): string {
  const confidence = Number(item.confidence);
  const probability = Number.isFinite(confidence)
    ? ` ${Math.round(clamp(confidence, 0, 1) * 100)}%`
    : "";
  const objectKind = String(item.class_name || item.raw_class_name || "")
    .trim()
    .toLowerCase();
  const target =
    objectKind === "person" || objectKind.includes("face")
      ? "Narrative Agent"
      : "object / agent";
  return `Confirm ${target}${probability}`;
}

const MASTER_SCHEMA_OVERLAY_AUTHORITY_RANK: Record<MatureEvidenceAuthority, number> = {
  manual_correction: 50,
  manual_annotation: 40,
  mature_triangulated: 30,
  interpreted_detection: 20,
  raw_detection: 10,
};

function normalizeMasterSchemaObjectTargetId(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const trackMatch = raw.match(/^track-(.+)$/i);
  return trackMatch?.[1] || raw;
}

function masterSchemaRecordActiveAtTime(
  record: MasterSchemaResolvedEvidenceRecord,
  currentTime: number,
): boolean {
  const start = Number(record.start);
  const end = Number(record.end ?? record.start);
  if (
    Number.isFinite(start) &&
    currentTime < Math.min(start, end) - MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
  ) {
    return false;
  }
  if (
    Number.isFinite(end) &&
    currentTime > Math.max(start, end) + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
  ) {
    return false;
  }
  return true;
}

function chooseMatureObjectRecord(
  records: MasterSchemaResolvedEvidenceRecord[],
): MasterSchemaResolvedEvidenceRecord | undefined {
  return [...records].sort((left, right) => {
    const authorityDelta =
      (MASTER_SCHEMA_OVERLAY_AUTHORITY_RANK[right.authority] || 0) -
      (MASTER_SCHEMA_OVERLAY_AUTHORITY_RANK[left.authority] || 0);
    if (authorityDelta) return authorityDelta;
    const rightIsMaster = right.sourcePanel === "MasterSchema" ? 1 : 0;
    const leftIsMaster = left.sourcePanel === "MasterSchema" ? 1 : 0;
    if (rightIsMaster !== leftIsMaster) return rightIsMaster - leftIsMaster;
    return Number(right.start ?? 0) - Number(left.start ?? 0);
  })[0];
}

function buildMatureObjectOverlayLookup(
  records: MasterSchemaResolvedEvidenceRecord[] | undefined,
  currentTime: number,
): {
  byTrack: Map<string, MatureObjectOverlayLabel>;
  byRawLabel: Map<string, MatureObjectOverlayLabel>;
} {
  const activeObjectRecords = (records || []).filter(
    (record) =>
      record.category === "object" &&
      record.label &&
      !isRawDetectionLikeLabel(record.label) &&
      record.authority !== "raw_detection" &&
      masterSchemaRecordActiveAtTime(record, currentTime),
  );
  const groupedByTrack = new Map<string, MasterSchemaResolvedEvidenceRecord[]>();
  const groupedByRawLabel = new Map<string, MasterSchemaResolvedEvidenceRecord[]>();
  activeObjectRecords.forEach((record) => {
    const trackId = normalizeMasterSchemaObjectTargetId(record.targetId);
    if (trackId) {
      groupedByTrack.set(trackId, [...(groupedByTrack.get(trackId) || []), record]);
    }
    const rawLabel = normalizeEvidenceLabel(record.rawLabel);
    if (rawLabel && !trackId) {
      groupedByRawLabel.set(rawLabel, [...(groupedByRawLabel.get(rawLabel) || []), record]);
    }
  });

  const toOverlayLabel = (
    record: MasterSchemaResolvedEvidenceRecord,
  ): MatureObjectOverlayLabel => ({
    label: record.label,
    rawLabel: record.rawLabel,
    authority: record.authority,
    sourcePanel: record.sourcePanel,
    maturityRoute: record.maturityRoute,
    mappingStatus: record.mappingStatus,
    traceback: record.metadata?.traceback,
    evidence_refs: record.metadata?.evidence_refs,
    source_bbox_refs: record.metadata?.source_bbox_refs,
    source_frame_refs: record.metadata?.source_frame_refs,
  });

  return {
    byTrack: new Map(
      [...groupedByTrack.entries()].flatMap(([trackId, grouped]) => {
        const selected = chooseMatureObjectRecord(grouped);
        return selected ? [[trackId, toOverlayLabel(selected)] as const] : [];
      }),
    ),
    byRawLabel: new Map(
      [...groupedByRawLabel.entries()].flatMap(([label, grouped]) => {
        const selected = chooseMatureObjectRecord(grouped);
        return selected ? [[label, toOverlayLabel(selected)] as const] : [];
      }),
    ),
  };
}

function roleLabelForNarrativeAgent(record: MasterSchemaResolvedEvidenceRecord): string {
  const metadata = record.metadata || {};
  const role =
    metadata.role_label ||
    metadata.role_description ||
    metadata.character_role ||
    metadata.narrative_role;
  return role ? String(role) : "";
}

function identityLabelForOverlay(
  identityLabel: string,
  hasNarrativeAgentRecognition: boolean,
): string {
  return hasNarrativeAgentRecognition ? "" : identityLabel;
}

function buildMatureSubjectOverlayLookup(
  records: MasterSchemaResolvedEvidenceRecord[] | undefined,
  currentTime: number,
): {
  byTrack: Map<string, MatureObjectOverlayLabel>;
  byRawLabel: Map<string, MatureObjectOverlayLabel>;
} {
  const activeSubjectRecords = (records || []).filter(
    (record) =>
      ["narrative_agent_profile", "character_role", "identity"].includes(record.category) &&
      record.label &&
      !isRawDetectionLikeLabel(record.label) &&
      record.authority !== "raw_detection" &&
      masterSchemaRecordActiveAtTime(record, currentTime),
  );
  const groupedByTrack = new Map<string, MasterSchemaResolvedEvidenceRecord[]>();
  const groupedByRawLabel = new Map<string, MasterSchemaResolvedEvidenceRecord[]>();
  activeSubjectRecords.forEach((record) => {
    const trackId = normalizeMasterSchemaObjectTargetId(record.targetId);
    if (trackId) {
      groupedByTrack.set(trackId, [...(groupedByTrack.get(trackId) || []), record]);
    }
    const rawLabel = normalizeEvidenceLabel(record.rawLabel || record.label);
    if (rawLabel && !trackId) {
      groupedByRawLabel.set(rawLabel, [...(groupedByRawLabel.get(rawLabel) || []), record]);
    }
  });

  const toOverlayLabel = (
    record: MasterSchemaResolvedEvidenceRecord,
  ): MatureObjectOverlayLabel => ({
    label: record.label,
    rawLabel: record.rawLabel,
    authority: record.authority,
    sourcePanel: record.sourcePanel,
    maturityRoute: record.maturityRoute,
    mappingStatus: record.mappingStatus,
    roleLabel: roleLabelForNarrativeAgent(record),
    sourceCategory: record.category,
    traceback: record.metadata?.traceback,
    evidence_refs: record.metadata?.evidence_refs,
    source_bbox_refs: record.metadata?.source_bbox_refs,
    source_frame_refs: record.metadata?.source_frame_refs,
  });

  return {
    byTrack: new Map(
      [...groupedByTrack.entries()].flatMap(([trackId, grouped]) => {
        const selected = chooseMatureObjectRecord(grouped);
        return selected ? [[trackId, toOverlayLabel(selected)] as const] : [];
      }),
    ),
    byRawLabel: new Map(
      [...groupedByRawLabel.entries()].flatMap(([label, grouped]) => {
        const selected = chooseMatureObjectRecord(grouped);
        return selected ? [[label, toOverlayLabel(selected)] as const] : [];
      }),
    ),
  };
}

function getManualAnnotationBounds(entry: ManualVisualAnnotation) {
  const rawStart =
    typeof entry.start_seconds === "number"
      ? entry.start_seconds
      : entry.timestamp_seconds;
  const rawEnd =
    typeof entry.end_seconds === "number"
      ? entry.end_seconds
      : entry.timestamp_seconds;

  if (typeof rawStart !== "number" || typeof rawEnd !== "number") {
    return null;
  }

  const start = Math.min(rawStart, rawEnd);
  const end = Math.max(rawStart, rawEnd);
  const duration = end - start;
  const timestamp =
    typeof entry.timestamp_seconds === "number"
      ? entry.timestamp_seconds
      : (start + end) / 2;

  return {
    start,
    end,
    duration,
    timestamp,
  };
}

function isManualAnnotationVisibleAtTime(
  entry: ManualVisualAnnotation,
  currentTime: number,
) {
  const bounds = getManualAnnotationBounds(entry);
  if (!bounds) {
    return false;
  }

  if (bounds.duration <= MANUAL_POINT_VISIBILITY_SECONDS) {
    return (
      currentTime >= bounds.timestamp &&
      currentTime <= bounds.timestamp + MANUAL_POINT_VISIBILITY_SECONDS
    );
  }

  return (
    currentTime >= bounds.start &&
    currentTime <= bounds.end + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
  );
}

function getAttachedManualAnnotation(source: any): ManualVisualAnnotation | null {
  const candidate = source?.manual_annotation;
  return candidate && typeof candidate === "object"
    ? (candidate as ManualVisualAnnotation)
    : null;
}

function manualVisualAnnotationMatureLabel(
  item: ManualVisualAnnotation,
): string {
  return (
    item.identity_affirmation ||
    item.role_affirmation ||
    item.custom_label ||
    item.label ||
    ""
  ).trim();
}

function buildManualTrackMatureAuthority(
  annotations: ManualVisualAnnotation[],
): Map<string, BBoxMatureAuthority> {
  const byTrack = new Map<string, BBoxMatureAuthority>();
  annotations.forEach((item) => {
    const targetId = manualObjectTargetId(item);
    const label = manualVisualAnnotationMatureLabel(item);
    if (!targetId || !label) {
      return;
    }
    const existing = byTrack.get(targetId);
    const existingStart =
      typeof (existing?.sourceItem as any)?.start_seconds === "number"
        ? Number((existing?.sourceItem as any).start_seconds)
        : Number.NEGATIVE_INFINITY;
    const itemStart =
      typeof item.start_seconds === "number"
        ? Number(item.start_seconds)
        : Number(item.timestamp_seconds ?? Number.NEGATIVE_INFINITY);
    if (existing && existing.authority === "manual_annotation" && existingStart > itemStart) {
      return;
    }
    byTrack.set(targetId, {
      label,
      authority: "manual_annotation",
      source: "manual_visual_annotation",
      sourceItem: item,
      roleLabel: item.role_affirmation || undefined,
      traceback: item.id,
      evidence_refs: [item.id],
      source_bbox_refs: item.geometry_keyframes?.map((keyframe) => ({
        time: keyframe.time,
        source: keyframe.source,
      })),
      source_frame_refs: [
        item.timestamp_seconds,
        item.start_seconds,
        item.end_seconds,
      ].filter((value) => typeof value === "number"),
    });
  });
  return byTrack;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatPreciseTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00.000";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.floor((value - Math.floor(value)) * 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function formatCandidateTime(candidate: EvidenceProliferationCandidate): string {
  const start = Number(candidate.time?.start);
  const end = Number(candidate.time?.end);
  if (!Number.isFinite(start)) {
    return "time open";
  }
  if (!Number.isFinite(end) || Math.abs(end - start) < 0.001) {
    return formatPreciseTime(start);
  }
  return `${formatPreciseTime(start)}-${formatPreciseTime(end)}`;
}

function formatCandidateSource(value?: string): string {
  return String(value || "evidence")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function candidateProbability(candidate: EvidenceProliferationCandidate): number {
  return Number(candidate.match_probability ?? candidate.match_score ?? 0);
}

function loadStoredProliferationMatches(): StoredProliferationMatch[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem("vaa1.proliferation.matches") || "[]",
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sourceEvidenceFromCandidate(
  candidate: EvidenceProliferationCandidate,
): Record<string, unknown> {
  const sourceEvidence = candidate.provenance?.source_evidence;
  return sourceEvidence && typeof sourceEvidence === "object" && !Array.isArray(sourceEvidence)
    ? sourceEvidence as Record<string, unknown>
    : {};
}

function candidateTrackTargetId(candidate: EvidenceProliferationCandidate): string | null {
  const rawTrackId = candidate.raw?.track_id ?? candidate.raw?.trackId;
  if (rawTrackId !== undefined && rawTrackId !== null) {
    return String(rawTrackId);
  }
  const evidenceId = String(candidate.evidence_id || "");
  const objectMatch = evidenceId.match(/^object:(.+)$/);
  return objectMatch?.[1] || null;
}

function isMatureProliferationCandidate(
  candidate: EvidenceProliferationCandidate,
): boolean {
  if (isManualProliferationCandidate(candidate)) {
    return false;
  }
  const reviewState = String(candidate.review_state || "").toLowerCase();
  if (
    [
      "supported",
      "probable",
      "strong_support",
      "strongly_supported",
      "analyst_supported",
      "confirmed",
    ].includes(reviewState)
  ) {
    return true;
  }
  return candidateProbability(candidate) >= 0.5;
}

function resolveProliferatedDisplayLabel(
  candidate: EvidenceProliferationCandidate,
): string {
  const sourceEvidence = sourceEvidenceFromCandidate(candidate);
  const sourceLabel =
    String(sourceEvidence.label || sourceEvidence.source_label || "").trim();
  const targetLabel = String(candidate.label || "").trim();
  const normalizedSource = normalizeEvidenceLabel(sourceLabel);
  const normalizedTarget = normalizeEvidenceLabel(targetLabel);

  if (
    sourceLabel &&
    normalizedSource &&
    normalizedSource !== normalizedTarget &&
    !["object", "person", "track"].includes(normalizedSource)
  ) {
    return sourceLabel;
  }
  return (
    governedOverlayLabel(targetLabel) ||
    governedOverlayLabel(sourceLabel) ||
    `Review Narrative Agent ${Math.round(candidateProbability(candidate) * 100)}%`
  );
}

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest("input, textarea, select, button, [contenteditable='true']"),
  );
}

function isManualProliferationCandidate(candidate: EvidenceProliferationCandidate): boolean {
  return candidate.source_panel === "manual_visual_annotations" ||
    candidate.source_kind === "manual_annotation" ||
    candidate.source_kind === "manual_correction";
}

function orderVisibleProliferationCandidates(
  candidates: EvidenceProliferationCandidate[],
): EvidenceProliferationCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftManual = isManualProliferationCandidate(left);
    const rightManual = isManualProliferationCandidate(right);
    if (leftManual !== rightManual) {
      return leftManual ? 1 : -1;
    }
    return candidateProbability(right) - candidateProbability(left);
  });
}

function parsePreciseTimeInput(value: string): number | null {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getOverlayStackRank(
  modality: OverlayBox["modality"],
  normalizedBox: DraftBox,
): number {
  const area = clamp(Math.max(0.000001, normalizedBox.w * normalizedBox.h), 0, 1);
  const specificity =
    modality === "expression"
      ? 4000
      : modality === "ocr"
        ? 3000
        : modality === "manual"
          ? 2000
          : 1000;
  const smallBoxPriority = Math.round((1 - area) * 900);
  return specificity + smallBoxPriority;
}

function resolveObjectOverlayBBox(
  bbox: DetectedObject["bbox"],
  videoWidth: number,
  videoHeight: number,
): { x: number; y: number; w: number; h: number } | null {
  if (
    !bbox ||
    bbox.x1 === undefined ||
    bbox.y1 === undefined ||
    bbox.x2 === undefined ||
    bbox.y2 === undefined
  ) {
    return null;
  }

  const values = [bbox.x1, bbox.y1, bbox.x2, bbox.y2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [rawX1, rawY1, rawX2, rawY2] = values;
  const appearsNormalized =
    rawX1 >= 0 &&
    rawY1 >= 0 &&
    rawX2 >= 0 &&
    rawY2 >= 0 &&
    Math.max(rawX1, rawY1, rawX2, rawY2) <= 1.5;
  const scaleX = appearsNormalized ? videoWidth : 1;
  const scaleY = appearsNormalized ? videoHeight : 1;
  const x1 = rawX1 * scaleX;
  const y1 = rawY1 * scaleY;
  const x2 = rawX2 * scaleX;
  const y2 = rawY2 * scaleY;
  const left = clamp(Math.min(x1, x2), 0, videoWidth);
  const top = clamp(Math.min(y1, y2), 0, videoHeight);
  const right = clamp(Math.max(x1, x2), 0, videoWidth);
  const bottom = clamp(Math.max(y1, y2), 0, videoHeight);

  if (right - left < 2 || bottom - top < 2) {
    return null;
  }

  return {
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  };
}

function resolveManualOverlayBBox(
  coordinates: ManualVisualAnnotation["coordinates"] | undefined,
  videoWidth: number,
  videoHeight: number,
): { x: number; y: number; w: number; h: number } | null {
  if (
    !coordinates ||
    coordinates.x === undefined ||
    coordinates.y === undefined ||
    coordinates.w === undefined ||
    coordinates.h === undefined
  ) {
    return null;
  }
  const values = [coordinates.x, coordinates.y, coordinates.w, coordinates.h].map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const [rawX, rawY, rawW, rawH] = values;
  const appearsNormalized =
    rawX >= 0 &&
    rawY >= 0 &&
    rawW >= 0 &&
    rawH >= 0 &&
    Math.max(rawX, rawY, rawW, rawH) <= 1.5;
  const x = appearsNormalized ? rawX * videoWidth : rawX;
  const y = appearsNormalized ? rawY * videoHeight : rawY;
  const w = appearsNormalized ? rawW * videoWidth : rawW;
  const h = appearsNormalized ? rawH * videoHeight : rawH;
  const safeW = clamp(Math.max(8, w), 8, videoWidth);
  const safeH = clamp(Math.max(8, h), 8, videoHeight);
  return {
    x: clamp(x, 0, Math.max(0, videoWidth - safeW)),
    y: clamp(y, 0, Math.max(0, videoHeight - safeH)),
    w: safeW,
    h: safeH,
  };
}

function normalizeDraftBox(box: DraftBox): DraftBox {
  return {
    x: clamp(box.x, 0, 1),
    y: clamp(box.y, 0, 1),
    w: clamp(box.w, 0.002, 1),
    h: clamp(box.h, 0.002, 1),
  };
}

function calculateDraftBoxIoU(left: DraftBox | null, right: DraftBox | null): number {
  if (!left || !right) {
    return 0;
  }
  const leftX2 = left.x + left.w;
  const leftY2 = left.y + left.h;
  const rightX2 = right.x + right.w;
  const rightY2 = right.y + right.h;
  const intersectionW = Math.max(0, Math.min(leftX2, rightX2) - Math.max(left.x, right.x));
  const intersectionH = Math.max(0, Math.min(leftY2, rightY2) - Math.max(left.y, right.y));
  const intersection = intersectionW * intersectionH;
  if (intersection <= 0) {
    return 0;
  }
  const union = (left.w * left.h) + (right.w * right.h) - intersection;
  return union > 0 ? intersection / union : 0;
}

function calculateDraftBoxCenterDistance(left: DraftBox | null, right: DraftBox | null): number {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(
    left.x + left.w / 2 - (right.x + right.w / 2),
    left.y + left.h / 2 - (right.y + right.h / 2),
  );
}

function synthesizePersonBoxFromExpression(expressionBox: DraftBox): DraftBox {
  const centerX = expressionBox.x + expressionBox.w / 2;
  const width = clamp(Math.max(expressionBox.w * 2.35, 0.12), 0.002, 0.72);
  const height = clamp(Math.max(expressionBox.h * 4.6, 0.28), 0.002, 0.9);
  const x = clamp(centerX - width / 2, 0, Math.max(0, 1 - width));
  const y = clamp(expressionBox.y - expressionBox.h * 0.65, 0, Math.max(0, 1 - height));
  return normalizeDraftBox({ x, y, w: width, h: height });
}

function detectedObjectToNormalizedBox(
  item: DetectedObject | undefined,
  videoWidth: number,
  videoHeight: number,
): DraftBox | null {
  if (
    !item?.bbox ||
    item.bbox.x1 === undefined ||
    item.bbox.y1 === undefined ||
    item.bbox.x2 === undefined ||
    item.bbox.y2 === undefined
  ) {
    return null;
  }
  const width = Math.max(1, videoWidth);
  const height = Math.max(1, videoHeight);
  const x1 = Number(item.bbox.x1);
  const y1 = Number(item.bbox.y1);
  const x2 = Number(item.bbox.x2);
  const y2 = Number(item.bbox.y2);
  if (![x1, y1, x2, y2].some((value) => !Number.isFinite(value))) {
    return normalizeDraftBox({
      x: Math.min(x1, x2) / width,
      y: Math.min(y1, y2) / height,
      w: Math.abs(x2 - x1) / width,
      h: Math.abs(y2 - y1) / height,
    });
  }
  return null;
}

function geometryToNormalizedBox(
  geometry: unknown,
  videoWidth: number,
  videoHeight: number,
): DraftBox | null {
  const geometryRecord =
    geometry && typeof geometry === "object" && !Array.isArray(geometry)
      ? geometry as Record<string, unknown>
      : null;
  const rawBox =
    geometryRecord?.bbox && typeof geometryRecord.bbox === "object"
      ? geometryRecord.bbox as Record<string, unknown>
      : geometryRecord;
  if (!rawBox) {
    return null;
  }
  const x = Number(rawBox.x ?? rawBox.left ?? rawBox.x1);
  const y = Number(rawBox.y ?? rawBox.top ?? rawBox.y1);
  const rawWidth = Number(rawBox.width ?? rawBox.w);
  const rawHeight = Number(rawBox.height ?? rawBox.h);
  const x2 = Number(rawBox.x2);
  const y2 = Number(rawBox.y2);
  let width = Number.isFinite(rawWidth) ? rawWidth : Number.NaN;
  let height = Number.isFinite(rawHeight) ? rawHeight : Number.NaN;
  if (!Number.isFinite(width) && Number.isFinite(x) && Number.isFinite(x2)) {
    width = x2 - x;
  }
  if (!Number.isFinite(height) && Number.isFinite(y) && Number.isFinite(y2)) {
    height = y2 - y;
  }
  if (![x, y, width, height].every(Number.isFinite) || width === 0 || height === 0) {
    return null;
  }
  const values = [x, y, x + width, y + height].map(Math.abs);
  const appearsNormalized = Math.max(...values) <= 1.5;
  const scaleX = appearsNormalized ? 1 : Math.max(1, videoWidth);
  const scaleY = appearsNormalized ? 1 : Math.max(1, videoHeight);
  return normalizeDraftBox({
    x: Math.min(x, x + width) / scaleX,
    y: Math.min(y, y + height) / scaleY,
    w: Math.abs(width) / scaleX,
    h: Math.abs(height) / scaleY,
  });
}

function isSameSpaceBoxMatch(left: DraftBox | null, right: DraftBox | null): boolean {
  if (!left || !right) {
    return false;
  }
  const iou = calculateDraftBoxIoU(left, right);
  if (iou >= 0.45) {
    return true;
  }
  const centerDistance = calculateDraftBoxCenterDistance(left, right);
  const areaRatio =
    Math.min(left.w * left.h, right.w * right.h) /
    Math.max(left.w * left.h, right.w * right.h, 0.000001);
  return iou >= 0.25 && centerDistance <= 0.06 && areaRatio >= 0.35;
}

function interpolateBoxes(
  left: DraftBox,
  right: DraftBox,
  ratio: number,
): DraftBox {
  const safeRatio = clamp(ratio, 0, 1);
  return normalizeDraftBox({
    x: left.x + (right.x - left.x) * safeRatio,
    y: left.y + (right.y - left.y) * safeRatio,
    w: left.w + (right.w - left.w) * safeRatio,
    h: left.h + (right.h - left.h) * safeRatio,
  });
}

function mergeGeometryKeyframes(
  keyframes: ManualGeometryKeyframe[],
): ManualGeometryKeyframe[] {
  const byTime = new Map<number, ManualGeometryKeyframe>();
  for (const keyframe of keyframes) {
    if (!Number.isFinite(keyframe.time)) {
      continue;
    }
    const time = Number(keyframe.time.toFixed(3));
    const existing = byTime.get(time);
    if (!existing || keyframe.source === "manual") {
      byTime.set(time, {
        ...keyframe,
        time,
        coordinates: normalizeDraftBox(keyframe.coordinates),
      });
    }
  }
  return Array.from(byTime.values()).sort((left, right) => left.time - right.time);
}

function buildBoxFromPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): DraftBox {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const right = Math.max(startX, endX);
  const bottom = Math.max(startY, endY);
  return {
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  };
}

function classifyShotSize(heightRatio: number, widthRatio: number): string {
  if (heightRatio >= 0.9 || widthRatio >= 0.75) {
    return "extreme close-up";
  }
  if (heightRatio >= 0.72 || widthRatio >= 0.58) {
    return "close-up";
  }
  if (heightRatio >= 0.58) {
    return "cowboy shot";
  }
  if (heightRatio >= 0.42) {
    return "medium close-up";
  }
  if (heightRatio >= 0.28) {
    return "medium shot";
  }
  if (heightRatio >= 0.12) {
    return "long shot";
  }
  return "extreme long shot";
}

function zoneForPoint(
  x: number,
  y: number,
  width: number,
  height: number,
): "left" | "center" | "right" | "upper" | "middle" | "lower" {
  if (x < width / 3) {
    return "left";
  }
  if (x > (width * 2) / 3) {
    return "right";
  }
  if (y < height / 3) {
    return "upper";
  }
  if (y > (height * 2) / 3) {
    return "lower";
  }
  return "center";
}

function classifyToneFamilyFromRgb(red: number, green: number, blue: number): string {
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  if (spread < 18) {
    if (Math.max(red, green, blue) < 70) {
      return "dark neutral";
    }
    if (Math.max(red, green, blue) > 190) {
      return "light neutral";
    }
    return "neutral";
  }
  if (green >= blue && green >= red) {
    return "green";
  }
  if (blue >= green && blue >= red) {
    return "blue-cyan";
  }
  if (red >= green && red >= blue) {
    return "red-magenta";
  }
  return "mixed";
}

function classifyBrightnessBand(value: number): string {
  if (value < 70) {
    return "dark";
  }
  if (value < 170) {
    return "mid";
  }
  return "bright";
}

function classifySaturationBand(red: number, green: number, blue: number): string {
  const maxValue = Math.max(red, green, blue);
  const minValue = Math.min(red, green, blue);
  const saturation = maxValue === 0 ? 0 : ((maxValue - minValue) / maxValue) * 255;
  if (saturation < 40) {
    return "low";
  }
  if (saturation < 110) {
    return "moderate";
  }
  return "high";
}

function dedupeTimelinePoints(values: number[], duration: number): number[] {
  const seen = new Set<number>();
  return values
    .filter((value) => Number.isFinite(value) && value >= 0 && duration > 0)
    .map((value) => Number(value.toFixed(1)))
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

function dedupeAudioTimelineMarkers(
  markers: AudioTimelineMarker[],
  duration: number,
): AudioTimelineMarker[] {
  const seen = new Set<string>();
  return markers
    .filter(
      (marker) =>
        Number.isFinite(marker.time) && marker.time >= 0 && duration > 0,
    )
    .map((marker) => ({
      ...marker,
      time: Number(marker.time.toFixed(1)),
    }))
    .filter((marker) => {
      const bucket = `${marker.colorClass}:${marker.time.toFixed(1)}`;
      if (seen.has(bucket)) {
        return false;
      }
      seen.add(bucket);
      return true;
    });
}

function normalizeOverlayText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isLikelyGraphicText(text: string, confidence: number): boolean {
  const cleaned = normalizeOverlayText(text);
  if (!cleaned) {
    return false;
  }

  const alphaNum = cleaned.replace(/[^0-9A-Za-zÀ-ÿ]/g, "");
  if (alphaNum.length < 2) {
    return false;
  }

  const upperCompact = /^[A-Z0-9]{2,8}$/.test(cleaned);
  if (upperCompact && confidence >= 0.22) {
    return true;
  }

  if (confidence < 0.38) {
    return false;
  }

  const alphaNumRatio = alphaNum.length / Math.max(cleaned.length, 1);
  return alphaNumRatio >= 0.55;
}

function bboxLooksLikeOverlayGraphic(
  bbox: NonNullable<OCR["bbox"]>,
  videoWidth: number,
  videoHeight: number,
  confidence: number,
): boolean {
  const x = bbox.x ?? 0;
  const y = bbox.y ?? 0;
  const w = bbox.w ?? 0;
  const h = bbox.h ?? 0;
  const areaShare = (w * h) / Math.max(videoWidth * videoHeight, 1);
  const nearTop = y <= videoHeight * 0.24;
  const nearBottom = y + h >= videoHeight * 0.72;
  const nearLeft = x <= videoWidth * 0.18;
  const nearRight = x + w >= videoWidth * 0.82;

  if (areaShare <= 0.000015 || areaShare >= 0.08) {
    return false;
  }

  if (confidence >= 0.72) {
    return true;
  }

  return nearTop || nearBottom || nearLeft || nearRight;
}

function buildLocalOCROverlays(
  items: OCR[],
  currentTime: number,
  videoWidth: number,
  videoHeight: number,
): OCR[] {
  const candidates = items
    .filter(
      (item) =>
        item.bbox?.x !== undefined &&
        item.bbox?.y !== undefined &&
        item.bbox?.w !== undefined &&
        item.bbox?.h !== undefined &&
        item.timestamp <= currentTime + 0.06 &&
        currentTime - item.timestamp <= 0.55 &&
        isLikelyGraphicText(item.text, item.confidence) &&
        bboxLooksLikeOverlayGraphic(
          item.bbox,
          videoWidth,
          videoHeight,
          item.confidence,
        ),
    )
    .sort(
      (left, right) =>
        (right.confidence || 0) - (left.confidence || 0) ||
        Math.abs(left.timestamp - currentTime) - Math.abs(right.timestamp - currentTime),
    );

  const accepted: OCR[] = [];
  for (const item of candidates) {
    const duplicate = accepted.find((existing) => {
      const left = existing.bbox;
      const right = item.bbox;
      if (!left || !right) {
        return false;
      }
      const sameText =
        normalizeOverlayText(existing.text).toLowerCase() ===
        normalizeOverlayText(item.text).toLowerCase();
      const horizontalGap = Math.abs((left.x ?? 0) - (right.x ?? 0));
      const verticalGap = Math.abs((left.y ?? 0) - (right.y ?? 0));
      return sameText && horizontalGap <= 40 && verticalGap <= 24;
    });
    if (!duplicate) {
      accepted.push(item);
    }
  }

  return accepted.slice(0, 8);
}

function calculateObjectBBoxCenterDistance(
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

function calculateObjectBBoxIoU(
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

function buildLocalObjectOverlays(
  items: DetectedObject[],
  currentTime: number,
): DetectedObject[] {
  const candidates = items.filter(
    (item) => {
      if (
        item.bbox?.x1 === undefined ||
        item.bbox?.y1 === undefined ||
        item.bbox?.x2 === undefined ||
        item.bbox?.y2 === undefined ||
        (item.confidence || 0) < getObjectFallbackConfidenceThreshold(item.class_name)
      ) {
        return false;
      }

      const start = item.startTimestamp ?? item.timestamp;
      const end = item.endTimestamp ?? item.timestamp;
      if (typeof start !== "number" || typeof end !== "number") {
        return false;
      }
      const spanStart = Math.min(start, end);
      const spanEnd = Math.max(start, end);
      if (spanEnd - spanStart > 0.001) {
        return (
          currentTime >= spanStart &&
          currentTime <= spanEnd + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
        );
      }
      const pointTime = item.timestamp ?? spanStart;
      return (
        currentTime >= pointTime &&
        currentTime <= pointTime + MANUAL_POINT_VISIBILITY_SECONDS
      );
    },
  );

  if (candidates.length === 0) {
    return [];
  }

  const sorted = [...candidates].sort(
    (left, right) =>
      Math.abs(left.timestamp - currentTime) - Math.abs(right.timestamp - currentTime) ||
      (right.confidence || 0) - (left.confidence || 0),
  );
  const accepted: DetectedObject[] = [];

  for (const item of sorted) {
    const duplicateIndex = accepted.findIndex((existing) => {
      if (existing.class_name !== item.class_name) {
        return false;
      }

      const iou = calculateObjectBBoxIoU(existing.bbox, item.bbox);
      const distance = calculateObjectBBoxCenterDistance(existing.bbox, item.bbox);
      return iou >= 0.45 || (item.class_name !== "person" && distance <= 70);
    });

    if (duplicateIndex >= 0) {
      const existing = accepted[duplicateIndex];
      const existingCount = existing.occurrenceCount || 1;
      const itemCount = item.occurrenceCount || 1;
      const duplicateTrackIds = new Set(
        [
          ...(((existing as any).duplicateTrackIds as Array<number | string> | undefined) || []),
          existing.trackId,
          item.trackId,
        ].filter((value) => value !== undefined && value !== null),
      );
      const stronger = (item.confidence || 0) > (existing.confidence || 0) ? item : existing;
      accepted[duplicateIndex] = {
        ...stronger,
        occurrenceCount: existingCount + itemCount,
        displayLabel:
          item.class_name === "person"
            ? undefined
            : governedOverlayLabel(stronger.displayLabel) || stronger.class_name,
        ...(duplicateTrackIds.size > 0
          ? { duplicateTrackIds: Array.from(duplicateTrackIds) }
          : {}),
      } as DetectedObject;
      continue;
    }

    accepted.push(
      isFallbackPersonDetection(item)
        ? {
            ...item,
            displayLabel: governedOverlayLabel(item.displayLabel),
          }
        : item.class_name === "person"
        ? {
            ...item,
            displayLabel: governedOverlayLabel(item.displayLabel),
          }
        : item,
    );
  }

  return accepted
    .filter((item) => {
      const bbox = item.bbox;
      if (
        !bbox ||
        bbox.x1 === undefined ||
        bbox.y1 === undefined ||
        bbox.x2 === undefined ||
        bbox.y2 === undefined
      ) {
        return false;
      }

      const width = Math.max(0, bbox.x2 - bbox.x1);
      const height = Math.max(0, bbox.y2 - bbox.y1);
      const area = width * height;
      const frameArea = 1920 * 1080;
      const areaShare = area / frameArea;

      if (item.class_name !== "person" && areaShare > 0.14) {
        return false;
      }

      if (item.class_name === "person" && areaShare > 0.42) {
        return false;
      }

      return true;
    })
    .sort(
      (left, right) =>
        (right.confidence || 0) - (left.confidence || 0) ||
        Math.abs(left.timestamp - currentTime) - Math.abs(right.timestamp - currentTime),
    )
    .slice(0, 8);
}

function findNearbyFaces(
  faceResults: any,
  currentTime: number,
): Array<{ x: number; y: number; w: number; h: number; timestamp: number }> {
  const frames = faceResults?.frames ?? [];
  if (!Array.isArray(frames)) {
    return [];
  }

  return frames
    .filter((frame: any) => {
      const t = typeof frame?.source_timestamp === "number" ? frame.source_timestamp : undefined;
      return (
        t !== undefined &&
        t <= currentTime + 0.06 &&
        currentTime - t <= 0.55
      );
    })
    .flatMap((frame: any) =>
      (frame.faces ?? [])
        .filter((face: any) => {
          const region = face?.region;
          if (
            !region ||
            region.x === undefined ||
            region.y === undefined ||
            region.w === undefined ||
            region.h === undefined
          ) {
            return false;
          }
          const warningCodes = new Set((face?.warnings ?? []).map((warning: any) => warning.code));
          return !warningCodes.has("LOW_FACE_CONFIDENCE");
        })
        .map((face: any) => ({
          x: Number(face.region.x),
          y: Number(face.region.y),
          w: Number(face.region.w),
          h: Number(face.region.h),
          timestamp: typeof frame?.source_timestamp === "number" ? frame.source_timestamp : currentTime,
        })),
    );
}

function personBoxMatchesFace(
  person: DetectedObject,
  face: { x: number; y: number; w: number; h: number },
): boolean {
  const bbox = person.bbox;
  if (
    !bbox ||
    bbox.x1 === undefined ||
    bbox.y1 === undefined ||
    bbox.x2 === undefined ||
    bbox.y2 === undefined
  ) {
    return false;
  }

  const faceCx = face.x + face.w / 2;
  const faceCy = face.y + face.h / 2;
  const padX = (bbox.x2 - bbox.x1) * 0.2;
  const padY = (bbox.y2 - bbox.y1) * 0.2;

  return (
    faceCx >= bbox.x1 - padX &&
    faceCx <= bbox.x2 + padX &&
    faceCy >= bbox.y1 - padY &&
    faceCy <= bbox.y2 + padY
  );
}

function refinePersonOverlaysWithFaces(
  objects: DetectedObject[],
  nearbyFaces: Array<{ x: number; y: number; w: number; h: number; timestamp: number }>,
): DetectedObject[] {
  if (nearbyFaces.length === 0) {
    return objects;
  }

  const refined = objects.map((item) => {
    if (item.class_name !== "person") {
      return item;
    }

    const match = nearbyFaces.find((face) => personBoxMatchesFace(item, face));
    if (!match || !item.bbox) {
      return item;
    }

    const x1 = Math.min(item.bbox.x1 ?? match.x, match.x);
    const y1 = Math.min(item.bbox.y1 ?? match.y, match.y);
    const x2 = Math.max(item.bbox.x2 ?? match.x + match.w, match.x + match.w);
    const y2 = Math.max(item.bbox.y2 ?? match.y + match.h, match.y + match.h);

    return {
      ...item,
      bbox: { x1, y1, x2, y2 },
      displayLabel: governedOverlayLabel(item.displayLabel),
    };
  });

  const unmatchedFaces = nearbyFaces.filter(
    (face) => !refined.some((item) => item.class_name === "person" && personBoxMatchesFace(item, face)),
  );

  const synthesizedPeople = unmatchedFaces.map((face, index) => ({
    timestamp: face.timestamp,
    class_id: 0,
    class_name: "person",
    confidence: 0.55,
    bbox: {
      x1: Math.max(0, face.x - face.w * 0.6),
      y1: Math.max(0, face.y - face.h * 0.25),
      x2: face.x + face.w * 1.6,
      y2: face.y + face.h * 3.4,
    },
    displayLabel: undefined,
  })) as DetectedObject[];

  return [...refined, ...synthesizedPeople];
}

function alignActiveObjectLabelsWithGroupedTracks(
  activeObjects: DetectedObject[],
  groupedObjects: DetectedObject[],
  currentTime: number,
): DetectedObject[] {
  return activeObjects.map((item) => {
    const rawLabel = item.raw_class_name || item.class_name;
    const candidates = groupedObjects
      .filter((grouped) => {
        const groupedRawLabel = grouped.raw_class_name || grouped.class_name;
        const start = grouped.startTimestamp ?? grouped.timestamp ?? 0;
        const end = grouped.endTimestamp ?? grouped.timestamp ?? start;
        return (
          groupedRawLabel === rawLabel &&
          currentTime >= start &&
          currentTime <= end + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
        );
      })
      .map((grouped) => ({
        grouped,
        iou: calculateObjectBBoxIoU(grouped.bbox, item.bbox),
        distance: calculateObjectBBoxCenterDistance(grouped.bbox, item.bbox),
      }))
      .sort((left, right) => {
        if (right.iou !== left.iou) {
          return right.iou - left.iou;
        }
        if (left.distance !== right.distance) {
          return left.distance - right.distance;
        }
        const leftStart = left.grouped.startTimestamp ?? left.grouped.timestamp ?? 0;
        const rightStart = right.grouped.startTimestamp ?? right.grouped.timestamp ?? 0;
        return leftStart - rightStart;
      });

    const best = candidates[0]?.grouped;
    if (!best?.displayLabel) {
      return item;
    }

    return {
      ...item,
      displayLabel: governedOverlayLabel(best.displayLabel),
      trackId: item.trackId ?? best.trackId,
      startTimestamp: item.startTimestamp ?? best.startTimestamp,
      endTimestamp: item.endTimestamp ?? best.endTimestamp,
      raw_class_name: item.raw_class_name ?? best.raw_class_name,
    };
  });
}

function getRenderedVideoRect(
  containerWidth: number,
  containerHeight: number,
  intrinsicWidth: number,
  intrinsicHeight: number,
): RenderedVideoRect | null {
  if (
    !containerWidth ||
    !containerHeight ||
    !intrinsicWidth ||
    !intrinsicHeight
  ) {
    return null;
  }

  const containerRatio = containerWidth / containerHeight;
  const intrinsicRatio = intrinsicWidth / intrinsicHeight;

  if (intrinsicRatio > containerRatio) {
    const width = containerWidth;
    const height = width / intrinsicRatio;
    return {
      x: 0,
      y: (containerHeight - height) / 2,
      width,
      height,
    };
  }

  const height = containerHeight;
  const width = height * intrinsicRatio;
  return {
    x: (containerWidth - width) / 2,
    y: 0,
    width,
    height,
  };
}

function formatCompareSourceLabel(
  sourceName: string | undefined,
  fallback: string,
): string {
  return sourceName || fallback;
}

export default function VideoPanel() {
  const { openPanel } = useLayoutHost();
  const [videoId, setVideoId] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [mediaRefreshNonce, setMediaRefreshNonce] = useState(0);
  const [correctionRefreshNonce, setCorrectionRefreshNonce] = useState(0);
  const [videoTimeLine, setVideoTimeLine] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frameReadyTime, setFrameReadyTime] = useState<number | null>(null);
  const [renderedVideoRect, setRenderedVideoRect] =
    useState<RenderedVideoRect | null>(null);
  const [overlayToggles, setOverlayToggles] = useState<
    Record<OverlayToggleKey, boolean>
  >({
    objects: true,
    ocr: false,
    expressions: false,
    manual: true,
  });
  const [shotSizeOpen, setShotSizeOpen] = useState(false);
  const [frameClassOpen, setFrameClassOpen] = useState(false);
  const [spatialScanOpen, setSpatialScanOpen] = useState(false);
  const [textGraphicOpen, setTextGraphicOpen] = useState(false);
  const [humanPresenceOpen, setHumanPresenceOpen] = useState(false);
  const [marginScanOpen, setMarginScanOpen] = useState(false);
  const [cornerScanOpen, setCornerScanOpen] = useState(false);
  const [depthScanOpen, setDepthScanOpen] = useState(false);
  const [lightingOpen, setLightingOpen] = useState(false);
  const [toneScanOpen, setToneScanOpen] = useState(false);
  const [colorRegimeOpen, setColorRegimeOpen] = useState(false);
  const [visualClutterOpen, setVisualClutterOpen] = useState(false);
  const [motionScanOpen, setMotionScanOpen] = useState(false);
  const [transitionScanOpen, setTransitionScanOpen] = useState(false);
  const closeVisualCueInspectors = React.useCallback(() => {
    setShotSizeOpen(false);
    setFrameClassOpen(false);
    setSpatialScanOpen(false);
    setTextGraphicOpen(false);
    setHumanPresenceOpen(false);
    setMarginScanOpen(false);
    setCornerScanOpen(false);
    setDepthScanOpen(false);
    setLightingOpen(false);
    setColorRegimeOpen(false);
    setVisualClutterOpen(false);
    setMotionScanOpen(false);
    setTransitionScanOpen(false);
    setToneScanOpen(false);
  }, []);
  const [liveToneSample, setLiveToneSample] = useState<{
    timestamp: number;
    frame_class?: string;
    dominant_tone?: string;
    overall_brightness?: number;
    overall_saturation?: number;
    frame_diff?: number;
    tone_shift?: number;
    motion_level?: string;
    transition_hint?: string;
    zones: Record<
      string,
      {
        dominant_tone: string;
        brightness_band: string;
        saturation_band: string;
        brightness_value?: number;
        rgb?: [number, number, number];
      }
    >;
  } | null>(null);
  const [singleSourceMarks, setSingleSourceMarks] = useState<SingleSourceMarks>(
    {},
  );
  const [compareAnchor, setCompareAnchor] = useState<CompareAnchor | null>(null);
  const [showCompareInPanel, setShowCompareInPanel] = useState(false);
  const [linkedComparePlayback, setLinkedComparePlayback] = useState(true);
  const [compareSource, setCompareSource] = useState<CompareVideoSource | null>(null);
  const [selectedOverlayKey, setSelectedOverlayKey] = useState<string | null>(null);
  const [selectedOverlaySnapshot, setSelectedOverlaySnapshot] =
    useState<OverlayBox | null>(null);
  const [selectedWorkspaceAnnotationId, setSelectedWorkspaceAnnotationId] = useState<
    string | null
  >(null);
  const [activeEvidenceNavigation, setActiveEvidenceNavigation] =
    useState<EvidenceNavigationState | null>(null);
  const [selectedIndicationEdits, setSelectedIndicationEdits] = useState<
    Record<string, SelectedIndicationEdit>
  >({});
  const [selectedOverlayScrub, setSelectedOverlayScrub] = useState<{
    overlayKey: string;
    value: number;
    active: boolean;
  } | null>(null);
  const [selectedOverlayTimeDrag, setSelectedOverlayTimeDrag] = useState<{
    overlayKey: string;
    start: number;
  } | null>(null);
  const [selectedTimeInputDrafts, setSelectedTimeInputDrafts] = useState<
    Record<string, string>
  >({});
  const [selectedOverlayOverdrafts, setSelectedOverlayOverdrafts] = useState<
    Record<string, boolean>
  >({});
  const [selectedOverlayTimelinePadding, setSelectedOverlayTimelinePadding] = useState<
    Record<string, { before: number; after: number }>
  >({});
  const [selectedOverlayContinuationSeconds, setSelectedOverlayContinuationSeconds] = useState<
    Record<string, number>
  >({});
  const [overlayGeometryDrafts, setOverlayGeometryDrafts] = useState<
    Record<string, OverlayGeometryDraft>
  >({});
  const [overlayGeometryDrag, setOverlayGeometryDrag] =
    useState<OverlayGeometryDrag | null>(null);
  const [selectedOverlayProliferation, setSelectedOverlayProliferation] = useState<
    Record<string, ProliferationLauncherState>
  >({});
  const [pendingObjectOverlayEdit, setPendingObjectOverlayEdit] =
    useState<PendingObjectOverlayEdit | null>(null);
  const [localObjectLabelOverrides, setLocalObjectLabelOverrides] = useState<
    LocalObjectLabelOverride[]
  >([]);
  const [storedProliferationMatches, setStoredProliferationMatches] = useState<
    StoredProliferationMatch[]
  >(() => loadStoredProliferationMatches());
  const [annotationWorkspaceActive, setAnnotationWorkspaceActive] = useState(false);
  const [nativeAnnotationMode, setNativeAnnotationMode] = useState(false);
  const [forensicRoiMode, setForensicRoiMode] = useState(false);
  const [forensicRoiIntent, setForensicRoiIntent] =
    useState<ForensicRoiIntent>("identification");
  const [forensicRoiMenu, setForensicRoiMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [draftBox, setDraftBox] = useState<DraftBox | null>(null);
  const [lockedForensicRoiBox, setLockedForensicRoiBoxState] =
    useState<LockedForensicRoi | null>(null);
  const [draftTimestamp, setDraftTimestamp] = useState<number | null>(null);
  const [draftStartPoint, setDraftStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [forensicRoiDragOffset, setForensicRoiDragOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [nativeAnnotationDraft, setNativeAnnotationDraft] =
    useState<ManualAnnotationDraft>({
      category: "OBJ",
      subcategory: "Object label",
      readyLabel: "",
      label: "",
      mediaGenreParent: "",
      situationalGenreParent: "",
      identityAffirmation: "",
      roleAffirmation: "",
      audioFoleyNote: "",
      openNote: "",
    });
  const [nativeSaveMessage, setNativeSaveMessage] = useState<string | null>(null);

  const setLockedForensicRoiBox = React.useCallback(
    (value: DraftBox | LockedForensicRoi | null) => {
      if (!value) {
        setLockedForensicRoiBoxState(null);
        return;
      }
      if ("box" in value) {
        setLockedForensicRoiBoxState(value);
        return;
      }
      setLockedForensicRoiBoxState({
        box: value,
        videoId,
        time: Number((draftTimestamp ?? currentTime).toFixed(3)),
      });
    },
    [currentTime, draftTimestamp, videoId],
  );

  const visibleLockedForensicRoiBox = useMemo(() => {
    if (!lockedForensicRoiBox) {
      return null;
    }
    if (lockedForensicRoiBox.videoId && lockedForensicRoiBox.videoId !== videoId) {
      return null;
    }
    if (
      typeof lockedForensicRoiBox.time === "number" &&
      Math.abs(currentTime - lockedForensicRoiBox.time) > 1
    ) {
      return null;
    }
    return lockedForensicRoiBox.box;
  }, [currentTime, lockedForensicRoiBox, videoId]);

  const lastObjectUrl = React.useRef<string | null>(null);
  const lastCompareObjectUrl = React.useRef<string | null>(null);
  const lastBroadcastTimeRef = React.useRef<number>(-1);
  const compareSyncLockRef = React.useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const compareVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const mediaFrameRef = React.useRef<HTMLDivElement | null>(null);
  const overlayArmedRef = React.useRef(false);
  const activeLoadTokenRef = React.useRef(0);
  const videoFrameCallbackIdRef = React.useRef<number | null>(null);
  const nativeOverlayRef = React.useRef<HTMLDivElement | null>(null);
  const frameReadyTimeRef = React.useRef<number | null>(null);
  const usesFrameCallbackRef = React.useRef(false);
  const previousToneProbeRef = React.useRef<{
    overallBrightness: number;
    overallSaturation: number;
    dominantTone: string;
    zoneTones: Record<string, string>;
    zoneRgb: Record<string, [number, number, number]>;
  } | null>(null);

  const loadVideoSource = React.useCallback(async (analysisId: string) => {
    const nextMetadata = await VideoService.get(analysisId);
    if (nextMetadata.status === "completed" && nextMetadata.sourceVideoExists) {
      return {
        metadata: nextMetadata,
        videoUrl: apiService.getDownloadUrl(analysisId, "source_video"),
        blobMissing: false,
      };
    }

    let blob = await VideoService.getBlob(analysisId);
    if (blob) {
      await saveVideoBlob(analysisId, blob);
    } else {
      blob = await getVideoBlob(analysisId);
    }

    return {
      metadata: nextMetadata,
      videoUrl: blob ? URL.createObjectURL(blob) : null,
      blobMissing: !blob,
    };
  }, []);

  const handleLocateMedia = async () => {
    if (!videoId) {
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.style.display = "none";

    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      const selectedFile = target?.files?.[0];
      if (!selectedFile) {
        return;
      }

      try {
        await saveVideoBlob(videoId, selectedFile);

        if (lastObjectUrl.current) {
          URL.revokeObjectURL(lastObjectUrl.current);
          lastObjectUrl.current = null;
        }

        const url = URL.createObjectURL(selectedFile);
        lastObjectUrl.current = url;
        setVideoUrl(url);
        setBlobMissing(false);
        eventBus.emit("mediaLinked", videoId);

        alert(
          "Media located. This video is now linked to the current analysis in this browser.",
        );
      } catch (error) {
        console.error("VideoPanel: Failed to attach located media:", error);
        alert("Could not attach the selected media file.");
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const updateRenderedVideoRect = React.useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      setRenderedVideoRect(null);
      return;
    }

    setRenderedVideoRect(
      getRenderedVideoRect(
        videoElement.clientWidth,
        videoElement.clientHeight,
        videoElement.videoWidth,
        videoElement.videoHeight,
      ),
    );
  }, []);

  const persistSingleSourceMarks = React.useCallback(
    (nextMarks: SingleSourceMarks) => {
      setSingleSourceMarks(nextMarks);
      if (!videoId) {
        return;
      }
      localStorage.setItem(
        `${SINGLE_SOURCE_MARKS_KEY_PREFIX}${videoId}`,
        JSON.stringify(nextMarks),
      );
      eventBus.emit("singleSourceMarksChanged", {
        videoId,
        marks: nextMarks,
      });
    },
    [videoId],
  );

  const jumpToTime = React.useCallback((nextTime: number) => {
    const safeTime = clamp(nextTime, 0, duration || Number.MAX_SAFE_INTEGER);
    setCurrentTime(safeTime);
    setVideoTimeLine(safeTime);
    if (videoRef.current) {
      videoRef.current.currentTime = safeTime;
    }
    lastBroadcastTimeRef.current = safeTime;
    eventBus.emit("videoTimeLineChanged", safeTime);
  }, [duration]);

  const nudgeTime = React.useCallback(
    (deltaSeconds: number) => {
      const baseTime = videoRef.current?.currentTime ?? currentTime;
      jumpToTime(baseTime + deltaSeconds);
    },
    [currentTime, jumpToTime],
  );

  const togglePrimaryPlayback = React.useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }
    if (videoElement.paused || videoElement.ended) {
      void videoElement.play().catch(() => {});
    } else {
      videoElement.pause();
    }
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!videoId || isInteractiveElement(event.target)) {
        return;
      }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        togglePrimaryPlayback();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeTime(event.shiftKey ? -0.1 : -1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeTime(event.shiftKey ? 0.1 : 1);
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [nudgeTime, togglePrimaryPlayback, videoId]);

  const setSingleSourceMark = React.useCallback(
    (mark: "a" | "b") => {
      persistSingleSourceMarks({
        ...singleSourceMarks,
        [mark]: currentTime,
      });
    },
    [currentTime, persistSingleSourceMarks, singleSourceMarks],
  );

  const scrubSelectedOverlayTo = React.useCallback(
    (overlayKey: string, nextTime: number, minTime = 0, maxTime = duration) => {
      const safeTime = clamp(
        nextTime,
        Math.max(0, minTime),
        Math.max(Math.max(0, minTime), maxTime || duration || Number.MAX_SAFE_INTEGER),
      );
      setSelectedOverlayScrub({ overlayKey, value: safeTime, active: true });
      jumpToTime(safeTime);
    },
    [duration, jumpToTime],
  );

  const finishSelectedOverlayScrub = React.useCallback(() => {
    setSelectedOverlayScrub((current) =>
      current ? { ...current, active: false } : current,
    );
  }, []);

  useEffect(() => {
    if (!selectedOverlayScrub || selectedOverlayScrub.active) {
      return;
    }
    if (Math.abs(currentTime - selectedOverlayScrub.value) > 0.05) {
      return;
    }
    setSelectedOverlayScrub(null);
  }, [currentTime, selectedOverlayScrub]);

  useEffect(() => {
    setSelectedOverlayScrub(null);
  }, [selectedOverlayKey]);

  useEffect(() => {
    if (!selectedOverlayKey) {
      setSelectedWorkspaceAnnotationId(null);
    }
  }, [selectedOverlayKey]);

  const closeSelectedOverlayEditor = React.useCallback((overlayKey: string) => {
    setSelectedOverlayKey((current) => (current === overlayKey ? null : current));
    setSelectedOverlaySnapshot((current) =>
      current?.key === overlayKey ? null : current,
    );
    setSelectedWorkspaceAnnotationId((current) =>
      overlayKey === `manual-${current}` ? null : current,
    );
    setSelectedOverlayScrub((current) =>
      current?.overlayKey === overlayKey ? null : current,
    );
    setSelectedOverlayTimeDrag((current) =>
      current?.overlayKey === overlayKey ? null : current,
    );
    setOverlayGeometryDrafts((current) => {
      if (!current[overlayKey]) {
        return current;
      }
      const next = { ...current };
      delete next[overlayKey];
      return next;
    });
    setSelectedOverlayTimelinePadding((current) => {
      if (!current[overlayKey]) {
        return current;
      }
      const next = { ...current };
      delete next[overlayKey];
      return next;
    });
  }, []);

  const clearOverlayEditingWorkspace = React.useCallback((overlayKeys: string[]) => {
    const keys = new Set(overlayKeys.filter(Boolean));
    if (keys.size === 0) {
      return;
    }
    setSelectedOverlayScrub((current) =>
      current && keys.has(current.overlayKey) ? null : current,
    );
    setSelectedOverlayTimeDrag((current) =>
      current && keys.has(current.overlayKey) ? null : current,
    );
    setOverlayGeometryDrafts((current) => {
      const next = { ...current };
      let changed = false;
      keys.forEach((key) => {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : current;
    });
    setSelectedOverlayTimelinePadding((current) => {
      const next = { ...current };
      let changed = false;
      keys.forEach((key) => {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : current;
    });
    setSelectedOverlayOverdrafts((current) => {
      const next = { ...current };
      let changed = false;
      keys.forEach((key) => {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, []);

  const clearSingleSourceMarks = React.useCallback(() => {
    persistSingleSourceMarks({});
  }, [persistSingleSourceMarks]);

  const setCrossSourceCompareAnchor = React.useCallback(() => {
    if (!videoId) {
      return;
    }

    const nextAnchor = {
      videoId,
      name: metadata?.name || "Selected analysis",
      time: currentTime,
    };
    localStorage.setItem(CROSS_SOURCE_COMPARE_KEY, JSON.stringify(nextAnchor));
    setCompareAnchor(nextAnchor);
  }, [currentTime, metadata?.name, videoId]);

  const openCompareAnchor = React.useCallback(() => {
    if (!compareAnchor) {
      return;
    }
    eventBus.emit("videoIdChanged", compareAnchor.videoId);
    eventBus.emit("videoTimeLineChanged", compareAnchor.time);
  }, [compareAnchor]);

  const openCompareView = React.useCallback(() => {
    if (!compareAnchor || !videoId || compareAnchor.videoId === videoId) {
      return;
    }
    setShowCompareInPanel(true);
  }, [compareAnchor, videoId]);

  const clearCompareAnchor = React.useCallback(() => {
    localStorage.removeItem(CROSS_SOURCE_COMPARE_KEY);
    setCompareAnchor(null);
  }, []);

  useEffect(() => {
    const handler = (id: string) => {
      setVideoId(id);
    };
    const correctionHandler = (id: string) => {
      if (id === videoId) {
        setCorrectionRefreshNonce((value) => value + 1);
      }
    };
    eventBus.on("videoIdChanged", handler);
    eventBus.on("analysisCorrectionsChanged", correctionHandler);
    return () => {
      eventBus.off("videoIdChanged", handler);
      eventBus.off("analysisCorrectionsChanged", correctionHandler);
    };
  }, [videoId]);

  useEffect(() => {
    const handler = (nextVideoTimeLine: number) => {
      // Break the seek-loop race condition that causes playback stuttering.
      // If the incoming time is what we just broadcasted, it is a delayed 
      // React state update catching up to our natural playback.
      if (Math.abs(nextVideoTimeLine - lastBroadcastTimeRef.current) < 0.05) {
        return;
      }
      setVideoTimeLine(nextVideoTimeLine);
    };
    eventBus.on("videoTimeLineChanged", handler);
    return () => {
      eventBus.off("videoTimeLineChanged", handler);
    };
  }, []);

  useEffect(() => {
    const handler = (payload?: {
      videoId?: string;
      annotationId?: string;
      timestamp?: number;
      annotation?: ManualVisualAnnotation;
      resolvedEvidence?: ResolvedEvidenceItem;
      navigationState?: EvidenceNavigationState;
    }) => {
      if (!payload?.annotationId) {
        return;
      }
      const targetVideoId = payload.videoId || videoId;
      if (payload.videoId && payload.videoId !== videoId) {
        setVideoId(payload.videoId);
      }
      if (payload.annotation) {
        setAnalysisData((current) => {
          if (!current) return current;
          return {
            ...current,
            annotationCorrections: upsertManualVisualAnnotation(
              current.annotationCorrections,
              payload.annotation as ManualVisualAnnotation,
            ),
          };
        });
      }
      const resolvedEvidence =
        payload.resolvedEvidence ||
        (payload.annotation && targetVideoId
          ? resolveManualVisualEvidence(targetVideoId, payload.annotation)
          : null);
      const navigationState =
        payload.navigationState || buildEvidenceNavigationState(resolvedEvidence);
      setActiveEvidenceNavigation(navigationState);
      const targetTime =
        navigationState.activeEvidenceId && typeof navigationState.activeTime === "number"
          ? navigationState.activeTime
          : typeof payload.timestamp === "number"
            ? payload.timestamp
            : currentTime;
      const overlayKey = `manual-${payload.annotationId}`;
      const nextEdit = payload.annotation
        ? {
            category: payload.annotation.category,
            subcategory:
              payload.annotation.subcategory ||
              getFirstSubcategoryForCategory(payload.annotation.category),
            label: resolveManualVisualDisplayLabel(payload.annotation),
            identityAffirmation: payload.annotation.identity_affirmation || "",
            applyScope:
              ((payload.annotation.metadata_correlation as any)?.apply_scope as BBoxRoiApplyScope) ||
              "this_interval_only",
            quickAnnotations:
              ((payload.annotation.metadata_correlation as any)?.quick_annotations as string[]) ||
              [],
            start: Number((resolvedEvidence?.time.start ?? targetTime).toFixed(3)),
            end: Number(
              (resolvedEvidence?.time.end ?? targetTime + 0.001).toFixed(3),
            ),
            note: payload.annotation.open_note || "",
          }
        : null;
      if (nextEdit) {
        setSelectedIndicationEdits((current) => ({
          ...current,
          [overlayKey]: nextEdit,
        }));
      }
      jumpToTime(targetTime);
      setAnnotationWorkspaceActive(true);
      setNativeAnnotationMode(false);
      setForensicRoiMode(false);
      setSelectedWorkspaceAnnotationId(payload.annotationId);
      setSelectedOverlayKey(overlayKey);
    };

    eventBus.on("videoIndicationEditOpen", handler);
    return () => {
      eventBus.off("videoIndicationEditOpen", handler);
    };
  }, [currentTime, jumpToTime, videoId]);

  useEffect(() => {
    const handler = (payload?: {
      videoId?: string;
      annotationId?: string;
      overlayKey?: string;
    }) => {
      if (payload?.videoId && payload.videoId !== videoId) {
        return;
      }
      const overlayKey =
        payload?.overlayKey ||
        (payload?.annotationId ? `manual-${payload.annotationId}` : null);
      if (!overlayKey) {
        return;
      }
      closeSelectedOverlayEditor(overlayKey);
    };

    eventBus.on("videoIndicationEditClose", handler);
    return () => {
      eventBus.off("videoIndicationEditClose", handler);
    };
  }, [closeSelectedOverlayEditor, videoId]);

  useEffect(() => {
    const handler = (payload?: PendingObjectOverlayEdit) => {
      if (!payload) {
        return;
      }
      if (payload.videoId && payload.videoId !== videoId) {
        setVideoId(payload.videoId);
      }
      const targetTime =
        typeof payload.timestamp === "number" ? payload.timestamp : currentTime;
      jumpToTime(targetTime);
      setAnnotationWorkspaceActive(true);
      setNativeAnnotationMode(false);
      setForensicRoiMode(false);
      setPendingObjectOverlayEdit(payload);
    };

    eventBus.on("videoObjectIndicationEditOpen", handler);
    return () => {
      eventBus.off("videoObjectIndicationEditOpen", handler);
    };
  }, [currentTime, jumpToTime, videoId]);

  useEffect(() => {
    const handler = (payload?: LocalObjectLabelOverride) => {
      if (!payload?.label) {
        return;
      }
      if (payload.videoId && payload.videoId !== videoId) {
        return;
      }
      setLocalObjectLabelOverrides((current) => {
        const next = current.filter((item) => {
          const sameTrack =
            payload.trackId !== undefined &&
            item.trackId !== undefined &&
            Number(item.trackId) === Number(payload.trackId);
          const sameSource =
            normalizeEvidenceLabel(payload.sourceLabel) &&
            normalizeEvidenceLabel(payload.sourceLabel) ===
              normalizeEvidenceLabel(item.sourceLabel);
          return !(sameTrack || sameSource);
        });
        return [...next, payload];
      });
    };

    eventBus.on("videoObjectLabelOverride", handler);
    return () => {
      eventBus.off("videoObjectLabelOverride", handler);
    };
  }, [videoId]);

  useEffect(() => {
    const handler = (preset: string) => {
      setAnnotationWorkspaceActive(preset === "annotation");
    };
    eventBus.on<string>("workspacePresetChanged", handler);
    return () => {
      eventBus.off<string>("workspacePresetChanged", handler);
    };
  }, []);

  useEffect(() => {
    setStoredProliferationMatches(loadStoredProliferationMatches());
  }, [videoId]);

  useEffect(() => {
    const handler = () => {
      setSelectedOverlayKey(null);
      setNativeSaveMessage(null);
      setForensicRoiMode(false);
      setLockedForensicRoiBox(null);
      setNativeAnnotationMode(true);
      setAnnotationWorkspaceActive(true);
    };

    eventBus.on("nativeAnnotationOpen", handler);
    return () => {
      eventBus.off("nativeAnnotationOpen", handler);
    };
  }, []);

  useEffect(() => {
    const handler = (payload?: ForensicRegionDraftPayload & { intent?: ForensicRoiIntent }) => {
      setNativeAnnotationMode(false);
      setForensicRoiMode(true);
      if (payload?.intent) {
        setForensicRoiIntent(payload.intent);
      }
      const videoElement = videoRef.current;
      const naturalWidth = Math.max(1, videoElement?.videoWidth || 1);
      const naturalHeight = Math.max(1, videoElement?.videoHeight || 1);
      const normalizedRegion = payload?.normalizedRegion
        ? payload.normalizedRegion
        : payload?.region
          ? {
              x: clamp(payload.region.x / naturalWidth, 0, 1),
              y: clamp(payload.region.y / naturalHeight, 0, 1),
              w: clamp(payload.region.w / naturalWidth, 0, 1),
              h: clamp(payload.region.h / naturalHeight, 0, 1),
            }
          : null;
      if (normalizedRegion) {
        const scopedTime =
          typeof payload?.time === "number"
            ? Number(payload.time.toFixed(3))
            : Number(currentTime.toFixed(3));
        setDraftBox(normalizedRegion);
        setLockedForensicRoiBox({
          box: normalizedRegion,
          videoId: payload?.videoId || videoId,
          time: scopedTime,
        });
        setDraftTimestamp(scopedTime);
      } else {
        setDraftTimestamp(null);
      }
      setForensicRoiMenu(null);
      setSelectedOverlayKey(null);
      setDraftStartPoint(null);
      setForensicRoiDragOffset(null);
    };

    eventBus.on("forensicRoiToolOpen", handler);
    return () => {
      eventBus.off("forensicRoiToolOpen", handler);
    };
  }, [currentTime]);

  useEffect(() => {
    const handler = (payload: ForensicRegionDraftPayload) => {
      if (payload?.videoId && payload.videoId !== videoId) {
        return;
      }
      const videoElement = videoRef.current;
      const naturalWidth = Math.max(1, videoElement?.videoWidth || 1);
      const naturalHeight = Math.max(1, videoElement?.videoHeight || 1);
      const normalizedRegion = payload?.normalizedRegion
        ? payload.normalizedRegion
        : payload?.region
          ? {
              x: clamp(payload.region.x / naturalWidth, 0, 1),
              y: clamp(payload.region.y / naturalHeight, 0, 1),
              w: clamp(payload.region.w / naturalWidth, 0, 1),
              h: clamp(payload.region.h / naturalHeight, 0, 1),
            }
          : null;
      if (!normalizedRegion) {
        return;
      }

      setSelectedOverlayKey(null);
      setForensicRoiMode(false);
      setLockedForensicRoiBox(null);
      setNativeAnnotationMode(true);
      setAnnotationWorkspaceActive(true);
      setDraftStartPoint(null);
      const scopedTime =
        typeof payload?.time === "number"
          ? Number(payload.time.toFixed(3))
          : Number(currentTime.toFixed(3));
      setDraftTimestamp(scopedTime);
      setDraftBox(normalizedRegion);
      setLockedForensicRoiBox({
        box: normalizedRegion,
        videoId: payload?.videoId || videoId,
        time: scopedTime,
      });
      setNativeSaveMessage("Forensic ROI loaded into native annotation.");
    };

    eventBus.on("forensicRegionDraftOpen", handler);
    return () => {
      eventBus.off("forensicRegionDraftOpen", handler);
    };
  }, [currentTime, videoId]);

  useEffect(() => {
    const handleVisualCueOpen = (cue: string) => {
      closeVisualCueInspectors();
      switch (cue) {
        case "shot":
          setShotSizeOpen(true);
          break;
        case "frame":
          setFrameClassOpen(true);
          break;
        case "spatial":
          setSpatialScanOpen(true);
          break;
        case "text":
          setTextGraphicOpen(true);
          break;
        case "human":
          setHumanPresenceOpen(true);
          break;
        case "margin":
          setMarginScanOpen(true);
          break;
        case "corner":
          setCornerScanOpen(true);
          break;
        case "depth":
          setDepthScanOpen(true);
          break;
        case "lighting":
          setLightingOpen(true);
          break;
        case "color":
          setColorRegimeOpen(true);
          break;
        case "clutter":
          setVisualClutterOpen(true);
          break;
        case "motion":
          setMotionScanOpen(true);
          break;
        case "transition":
          setTransitionScanOpen(true);
          break;
        case "tone":
          setToneScanOpen(true);
          break;
        default:
          break;
      }
    };

    const handleVisualCueClose = () => {
      closeVisualCueInspectors();
    };

    eventBus.on<string>("visualCueOpen", handleVisualCueOpen);
    eventBus.on("visualCueClose", handleVisualCueClose);
    return () => {
      eventBus.off<string>("visualCueOpen", handleVisualCueOpen);
      eventBus.off("visualCueClose", handleVisualCueClose);
    };
  }, [closeVisualCueInspectors]);

  useEffect(() => {
    const handler = (analysisId: string) => {
      if (!analysisId || analysisId === videoId) {
        setMediaRefreshNonce((value) => value + 1);
      }
    };
    eventBus.on("mediaLinked", handler);
    return () => {
      eventBus.off("mediaLinked", handler);
    };
  }, [videoId]);

  useEffect(() => {
    const handler = (payload: { analysisId: string; blob: Blob }) => {
      if (!payload?.analysisId) {
        return;
      }

      const loadToken = ++activeLoadTokenRef.current;

      if (payload.analysisId !== videoId) {
        setVideoId(payload.analysisId);
      }

      setMetadata(null);
      setAnalysisData(null);
      setCurrentTime(0);
      setVideoTimeLine(0);
      setDuration(0);
      setFrameReadyTime(null);
      lastBroadcastTimeRef.current = -1;
      overlayArmedRef.current = false;
      setIsLoading(true);

      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current);
        lastObjectUrl.current = null;
      }

      const url = URL.createObjectURL(payload.blob);
      lastObjectUrl.current = url;
      setVideoUrl(url);
      setBlobMissing(false);
      void Promise.all([
        VideoService.get(payload.analysisId),
        VideoService.getAnalysis(payload.analysisId),
      ])
        .then(([nextMetadata, nextAnalysis]) => {
          if (activeLoadTokenRef.current !== loadToken) {
            return;
          }
          setMetadata(nextMetadata);
          setAnalysisData(nextAnalysis);
          setIsLoading(false);
        })
        .catch(() => {
          if (activeLoadTokenRef.current !== loadToken) {
            return;
          }
          setIsLoading(false);
        });
    };

    eventBus.on("mediaBlobReady", handler);
    return () => {
      eventBus.off("mediaBlobReady", handler);
    };
  }, [videoId]);

  useEffect(() => {
    const loadToken = ++activeLoadTokenRef.current;
    let cancelled = false;

    async function load() {
      if (!videoId) {
        setMetadata(null);
        setAnalysisData(null);
        setVideoUrl(null);
        setBlobMissing(false);
        setCurrentTime(0);
        setVideoTimeLine(0);
        setDuration(0);
        setFrameReadyTime(null);
        lastBroadcastTimeRef.current = -1;
        overlayArmedRef.current = false;
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setBlobMissing(false);

      try {
        const mediaSourcePromise = loadVideoSource(videoId);
        const analysisPromise = VideoService.getAnalysis(videoId);
        const [mediaSource, nextAnalysis] = await Promise.all([
          mediaSourcePromise,
          analysisPromise,
        ]);
        if (cancelled || activeLoadTokenRef.current !== loadToken) {
          if (mediaSource.videoUrl) {
            URL.revokeObjectURL(mediaSource.videoUrl);
          }
          return;
        }
        setMetadata(mediaSource.metadata);
        setAnalysisData(nextAnalysis);
        setCurrentTime(0);
        setVideoTimeLine(0);
        setDuration(0);
        setFrameReadyTime(null);
        lastBroadcastTimeRef.current = -1;
        overlayArmedRef.current = false;
        if (mediaSource.videoUrl) {
          if (lastObjectUrl.current) {
            URL.revokeObjectURL(lastObjectUrl.current);
            lastObjectUrl.current = null;
          }
          lastObjectUrl.current = mediaSource.videoUrl;
          setVideoUrl(mediaSource.videoUrl);
          setBlobMissing(false);
        } else {
          if (lastObjectUrl.current) {
            URL.revokeObjectURL(lastObjectUrl.current);
            lastObjectUrl.current = null;
          }
          setBlobMissing(true);
          setVideoUrl(null);
        }
      } catch (err) {
        if (cancelled || activeLoadTokenRef.current !== loadToken) {
          return;
        }
        console.error("VideoPanel: Failed to load video:", err);
        setBlobMissing(true);
        setVideoUrl(null);
      } finally {
        if (!cancelled && activeLoadTokenRef.current === loadToken) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (lastCompareObjectUrl.current) {
        URL.revokeObjectURL(lastCompareObjectUrl.current);
        lastCompareObjectUrl.current = null;
      }
    };
  }, [videoId, mediaRefreshNonce]);

  useEffect(() => {
    let cancelled = false;

    async function refreshAnalysisOnly() {
      if (!videoId || correctionRefreshNonce === 0) {
        return;
      }

      try {
        const [nextMetadata, nextAnalysis] = await Promise.all([
          VideoService.get(videoId),
          VideoService.getAnalysis(videoId),
        ]);
        if (cancelled) {
          return;
        }
        setMetadata(nextMetadata);
        setAnalysisData(nextAnalysis);
      } catch (err) {
        if (cancelled) {
          return;
        }
        console.error("VideoPanel: Failed to refresh corrected analysis:", err);
      }
    }

    void refreshAnalysisOnly();

    return () => {
      cancelled = true;
    };
  }, [videoId, correctionRefreshNonce]);

  useEffect(() => {
    let cancelled = false;

    async function loadCompareSource() {
      if (
        !showCompareInPanel ||
        !compareAnchor ||
        !videoId ||
        compareAnchor.videoId === videoId
      ) {
        setCompareSource(null);
        return;
      }

      try {
        const loaded = await loadVideoSource(compareAnchor.videoId);
        if (cancelled) {
          if (loaded.videoUrl) {
            URL.revokeObjectURL(loaded.videoUrl);
          }
          return;
        }

        if (lastCompareObjectUrl.current) {
          URL.revokeObjectURL(lastCompareObjectUrl.current);
          lastCompareObjectUrl.current = null;
        }

        lastCompareObjectUrl.current = loaded.videoUrl;
        setCompareSource({
          videoId: compareAnchor.videoId,
          name: compareAnchor.name,
          time: compareAnchor.time,
          videoUrl: loaded.videoUrl,
          metadata: loaded.metadata,
          blobMissing: loaded.blobMissing,
        });
      } catch (error) {
        console.error("VideoPanel: Failed to load compare source:", error);
        if (!cancelled) {
          setCompareSource(null);
        }
      }
    }

    void loadCompareSource();

    return () => {
      cancelled = true;
    };
  }, [compareAnchor, loadVideoSource, showCompareInPanel, videoId]);

  useEffect(() => {
    if (
      videoRef.current &&
      typeof videoTimeLine === "number" &&
      !isLoading &&
      videoUrl
    ) {
      if (Math.abs(videoRef.current.currentTime - videoTimeLine) > 0.1) {
        setFrameReadyTime(null);
        overlayArmedRef.current = false;
        videoRef.current.currentTime = videoTimeLine;
      }
      setCurrentTime(videoTimeLine);
    }
  }, [videoTimeLine, isLoading, videoUrl]);

  const overlaysReady = useMemo(() => {
    if (!videoUrl || isLoading || frameReadyTime === null) {
      return false;
    }
    return Math.abs(frameReadyTime - currentTime) <= 0.2;
  }, [currentTime, frameReadyTime, isLoading, videoUrl]);

  useEffect(() => {
    if (!videoId) {
      setSingleSourceMarks({});
      return;
    }
    try {
      const raw = localStorage.getItem(`${SINGLE_SOURCE_MARKS_KEY_PREFIX}${videoId}`);
      setSingleSourceMarks(raw ? JSON.parse(raw) : {});
    } catch {
      setSingleSourceMarks({});
    }
  }, [videoId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CROSS_SOURCE_COMPARE_KEY);
      setCompareAnchor(raw ? JSON.parse(raw) : null);
    } catch {
      setCompareAnchor(null);
    }
  }, [videoId]);

  useEffect(() => {
    const handleResize = () => updateRenderedVideoRect();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateRenderedVideoRect]);

  useEffect(() => {
    frameReadyTimeRef.current = frameReadyTime;
  }, [frameReadyTime]);

  useEffect(() => {
    const videoElement = videoRef.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (
            callback: (now: number, metadata: VideoFrameMetadata) => void,
          ) => number;
          cancelVideoFrameCallback?: (handle: number) => void;
        })
      | null;

    if (!videoElement?.requestVideoFrameCallback) {
      usesFrameCallbackRef.current = false;
      return;
    }

    usesFrameCallbackRef.current = true;
    let cancelled = false;

    const pumpFrame = (_now: number, metadata: VideoFrameMetadata) => {
      if (cancelled) {
        return;
      }

      const nextTime = metadata.mediaTime;
      setCurrentTime(nextTime);
      if (
        !overlayArmedRef.current ||
        Math.abs((frameReadyTimeRef.current ?? -999) - nextTime) > 0.033
      ) {
        overlayArmedRef.current = true;
        setFrameReadyTime(nextTime);
      }
      if (Math.abs(nextTime - lastBroadcastTimeRef.current) >= 0.1) {
        lastBroadcastTimeRef.current = nextTime;
        eventBus.emit("videoTimeLineChanged", nextTime);
      }

      videoFrameCallbackIdRef.current = videoElement.requestVideoFrameCallback!(pumpFrame);
    };

    videoFrameCallbackIdRef.current = videoElement.requestVideoFrameCallback(pumpFrame);

    return () => {
      cancelled = true;
      usesFrameCallbackRef.current = false;
      if (
        videoFrameCallbackIdRef.current !== null &&
        videoElement.cancelVideoFrameCallback
      ) {
        videoElement.cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
      }
      videoFrameCallbackIdRef.current = null;
    };
  }, [videoUrl]);

  const transcript = analysisData?.transcript ?? [];
  const detectedObjects = analysisData?.detectedObjects ?? [];
  const rawDetectedObjects = analysisData?.rawDetectedObjects ?? detectedObjects;
  const faceResults = analysisData?.faceResults ?? null;
  const videoWidth = videoRef.current?.videoWidth || 1920;
  const videoHeight = videoRef.current?.videoHeight || 1080;
  const knownCharacters = useMemo(() => {
    const labels = new Set<string>();
    const records = analysisData?.masterSchemaResolvedEvidence?.records || [];
    records.forEach((record: MasterSchemaResolvedEvidenceRecord) => {
      if (
        ["narrative_agent_profile", "character_role", "identity"].includes(
          record.category,
        ) &&
        record.authority !== "raw_detection"
      ) {
        appendKnownNarrativeAgentLabel(labels, record.label);
      }
    });

    const sourceMediaMetadata = analysisData?.metadata?.sourceMediaMetadata;
    appendKnownNarrativeAgentValues(
      labels,
      sourceMediaMetadata?.user_annotations?.narrative_agent_profiles,
    );
    appendKnownNarrativeAgentValues(
      labels,
      sourceMediaMetadata?.user_annotations?.character_definitions,
    );
    appendKnownNarrativeAgentValues(
      labels,
      sourceMediaMetadata?.user_annotations?.character_roles,
    );
    (sourceMediaMetadata?.user_annotations?.web_metadata_sources || []).forEach(
      (source) => {
        appendKnownNarrativeAgentValues(labels, source.fields?.character_roles);
        appendKnownNarrativeAgentValues(labels, source.fields?.persons);
      },
    );

    (analysisData?.annotationCorrections?.manual_visual_annotations || []).forEach(
      (entry: ManualVisualAnnotation) => {
        appendKnownNarrativeAgentLabel(labels, entry.identity_affirmation);
        if (entry.category === "Identification") {
          appendKnownNarrativeAgentLabel(labels, entry.label);
          appendKnownNarrativeAgentLabel(labels, entry.custom_label);
        }
      },
    );

    return Array.from(labels).sort((left, right) => left.localeCompare(right));
  }, [
    analysisData?.annotationCorrections?.manual_visual_annotations,
    analysisData?.masterSchemaResolvedEvidence?.records,
    analysisData?.metadata?.sourceMediaMetadata,
  ]);
  const fallbackShotSizeSummary = useMemo(() => {
    const personItems = rawDetectedObjects.filter(
      (item) => (item.class_name || item.raw_class_name || "").toLowerCase() === "person",
    );
    if (personItems.length === 0) {
      return null;
    }

    const perTimestamp = new Map<number, DetectedObject[]>();
    for (const item of personItems) {
      const timestamp = Number((item.timestamp || 0).toFixed(3));
      const existing = perTimestamp.get(timestamp) || [];
      existing.push(item);
      perTimestamp.set(timestamp, existing);
    }

    const distribution = new Map<string, number>();
    for (const items of perTimestamp.values()) {
      const dominant = items.reduce((best, current) => {
        const bestBox = best.bbox || {};
        const currentBox = current.bbox || {};
        const bestArea =
          Math.max(0, (bestBox.x2 ?? 0) - (bestBox.x1 ?? 0)) *
          Math.max(0, (bestBox.y2 ?? 0) - (bestBox.y1 ?? 0));
        const currentArea =
          Math.max(0, (currentBox.x2 ?? 0) - (currentBox.x1 ?? 0)) *
          Math.max(0, (currentBox.y2 ?? 0) - (currentBox.y1 ?? 0));
        return currentArea > bestArea ? current : best;
      }, items[0]);

      const box = dominant.bbox || {};
      const width = Math.max(0, (box.x2 ?? 0) - (box.x1 ?? 0));
      const height = Math.max(0, (box.y2 ?? 0) - (box.y1 ?? 0));
      const label = classifyShotSize(
        height / Math.max(videoHeight, 1),
        width / Math.max(videoWidth, 1),
      );
      distribution.set(label, (distribution.get(label) || 0) + 1);
    }

    const entries = Array.from(distribution.entries()).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    );
    if (entries.length === 0) {
      return null;
    }

    return {
      dominant_label: entries[0][0],
      sample_count: perTimestamp.size,
      distribution: Object.fromEntries(entries),
    };
  }, [rawDetectedObjects, videoHeight, videoWidth]);
  const fallbackShotSizeSamples = useMemo(() => {
    const personItems = rawDetectedObjects.filter(
      (item) => (item.class_name || item.raw_class_name || "").toLowerCase() === "person",
    );
    if (personItems.length === 0) {
      return [];
    }

    const perTimestamp = new Map<number, DetectedObject[]>();
    for (const item of personItems) {
      const timestamp = Number((item.timestamp || 0).toFixed(3));
      const existing = perTimestamp.get(timestamp) || [];
      existing.push(item);
      perTimestamp.set(timestamp, existing);
    }

    return Array.from(perTimestamp.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([timestamp, items]) => {
        const dominant = items.reduce((best, current) => {
          const bestBox = best.bbox || {};
          const currentBox = current.bbox || {};
          const bestArea =
            Math.max(0, (bestBox.x2 ?? 0) - (bestBox.x1 ?? 0)) *
            Math.max(0, (bestBox.y2 ?? 0) - (bestBox.y1 ?? 0));
          const currentArea =
            Math.max(0, (currentBox.x2 ?? 0) - (currentBox.x1 ?? 0)) *
            Math.max(0, (currentBox.y2 ?? 0) - (currentBox.y1 ?? 0));
          return currentArea > bestArea ? current : best;
        }, items[0]);
        const box = dominant.bbox || {};
        return {
          timestamp,
          label: classifyShotSize(
            Math.max(0, (box.y2 ?? 0) - (box.y1 ?? 0)) / Math.max(videoHeight, 1),
            Math.max(0, (box.x2 ?? 0) - (box.x1 ?? 0)) / Math.max(videoWidth, 1),
          ),
          person_count: items.length,
        };
      });
  }, [rawDetectedObjects, videoHeight, videoWidth]);
  const groupedDetectedObjects = useMemo(
    () => groupDetectedObjectsForDisplay(detectedObjects),
    [detectedObjects],
  );
  const objectTrackSamplesById = useMemo(() => {
    const samples = new Map<string, DetectedObject[]>();
    for (const item of [...rawDetectedObjects, ...detectedObjects]) {
      const trackId = objectTrackTargetId(item);
      if (!trackId || !detectedObjectToNormalizedBox(item, videoWidth, videoHeight)) {
        continue;
      }
      const existing = samples.get(trackId) || [];
      existing.push(item);
      samples.set(trackId, existing);
    }
    for (const [trackId, items] of samples.entries()) {
      const byTime = new Map<number, DetectedObject>();
      for (const item of items) {
        const timestamp = Number((item.timestamp || item.startTimestamp || 0).toFixed(3));
        const previous = byTime.get(timestamp);
        if (!previous || (item.confidence || 0) >= (previous.confidence || 0)) {
          byTime.set(timestamp, item);
        }
      }
      samples.set(
        trackId,
        Array.from(byTime.values()).sort(
          (left, right) => (left.timestamp || 0) - (right.timestamp || 0),
        ),
      );
    }
    return samples;
  }, [detectedObjects, rawDetectedObjects, videoHeight, videoWidth]);
  const ocrResults = analysisData?.ocr ?? [];
  const expressionResults = analysisData?.expressionResults ?? [];
  const audioProsody = analysisData?.audioProsody ?? [];

  const activeTranscriptSegment = useMemo(
    () =>
      transcript.find(
        (segment) => currentTime >= segment.start && currentTime <= segment.end,
      ) ?? null,
    [currentTime, transcript],
  );

  const nearbyTranscriptSegments = useMemo(
    () =>
      [...transcript]
        .sort((left, right) => {
          const leftDistance = Math.abs(left.start - currentTime);
          const rightDistance = Math.abs(right.start - currentTime);
          if (leftDistance !== rightDistance) {
            return leftDistance - rightDistance;
          }
          return left.start - right.start;
        })
        .slice(0, 4),
    [currentTime, transcript],
  );

  const findNearbyItems = React.useCallback(
    <T extends { timestamp: number }>(items: T[], tolerance: number) =>
      items.filter((item) => Math.abs(item.timestamp - currentTime) <= tolerance),
    [currentTime],
  );

  const nearbyFaces = useMemo(
    () => findNearbyFaces(faceResults, currentTime),
    [currentTime, faceResults],
  );
  const activeRawObjects = useMemo(
    () =>
      alignActiveObjectLabelsWithGroupedTracks(
        refinePersonOverlaysWithFaces(
          buildLocalObjectOverlays(groupedDetectedObjects, currentTime),
          nearbyFaces,
        ),
        groupedDetectedObjects,
        currentTime,
      ),
    [currentTime, groupedDetectedObjects, nearbyFaces],
  );
  const activeOCR = useMemo(
    () => buildLocalOCROverlays(ocrResults, currentTime, videoWidth, videoHeight),
    [currentTime, ocrResults, videoHeight, videoWidth],
  );
  const activeExpressions = useMemo(
    () => findNearbyItems(expressionResults, 0.5),
    [expressionResults, findNearbyItems],
  );
  const allManualVisualAnnotations = useMemo(
    () => analysisData?.annotationCorrections?.manual_visual_annotations || [],
    [analysisData?.annotationCorrections?.manual_visual_annotations],
  );
  const manualVisualAnnotations = useMemo(
    () =>
      allManualVisualAnnotations.filter(
        (entry: ManualVisualAnnotation) =>
          isManualAnnotationVisibleAtTime(entry, currentTime),
      ),
    [allManualVisualAnnotations, currentTime],
  );
  const isManualAnnotationVisibleInSelectedWorkspace = React.useCallback(
    (entry: ManualVisualAnnotation) => {
      if (!entry.id) {
        return false;
      }
      const overlayKey = `manual-${entry.id}`;
      if (
        selectedWorkspaceAnnotationId !== entry.id ||
        !selectedOverlayKey
      ) {
        return false;
      }
      const edit = selectedIndicationEdits[selectedOverlayKey];
      if (!edit) {
        return false;
      }
      const intervalStart = clamp(
        Math.min(edit.start, edit.end),
        0,
        duration || Number.MAX_SAFE_INTEGER,
      );
      const intervalEnd = clamp(
        Math.max(edit.start, edit.end, Math.min(edit.start, edit.end) + 0.001),
        0,
        duration || Number.MAX_SAFE_INTEGER,
      );
      const padding =
        selectedOverlayTimelinePadding[selectedOverlayKey] ||
        selectedOverlayTimelinePadding[overlayKey] ||
        { before: 0, after: 0 };
      const workspaceStart = clamp(
        intervalStart - Math.max(0, padding.before),
        0,
        duration || Number.MAX_SAFE_INTEGER,
      );
      const workspaceEnd = clamp(
        intervalEnd + Math.max(0, padding.after),
        0,
        duration || Number.MAX_SAFE_INTEGER,
      );
      return (
        currentTime >= workspaceStart &&
        currentTime <= workspaceEnd + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
      );
    },
    [
      currentTime,
      duration,
      selectedIndicationEdits,
      selectedOverlayKey,
      selectedOverlayTimelinePadding,
      selectedWorkspaceAnnotationId,
    ],
  );
  const buildTrackGeometryKeyframes = React.useCallback(
    (trackId: string | null): ManualGeometryKeyframe[] => {
      if (!trackId) {
        return [];
      }
      const samples = objectTrackSamplesById.get(trackId) || [];
      return samples
        .map((item) => {
          const box = detectedObjectToNormalizedBox(item, videoWidth, videoHeight);
          if (!box || typeof item.timestamp !== "number") {
            return null;
          }
          return {
            time: Number(item.timestamp.toFixed(3)),
            coordinates: box,
            source: "track" as const,
          };
        })
        .filter(Boolean) as ManualGeometryKeyframe[];
    },
    [objectTrackSamplesById, videoHeight, videoWidth],
  );
  const resolveManualGeometryAtTime = React.useCallback(
    (item: ManualVisualAnnotation, timestamp: number): DraftBox | null => {
      const manualKeyframes = Array.isArray(item.geometry_keyframes)
        ? item.geometry_keyframes
        : [];
      const trackKeyframes = buildTrackGeometryKeyframes(manualObjectTargetId(item));
      const merged = [...trackKeyframes, ...manualKeyframes]
        .filter(
          (keyframe): keyframe is ManualGeometryKeyframe =>
            typeof keyframe?.time === "number" &&
            Number.isFinite(keyframe.time) &&
            Boolean(keyframe.coordinates),
        )
        .sort((left, right) => left.time - right.time);

      if (merged.length === 0) {
        const fallbackBox = resolveManualOverlayBBox(item.coordinates, videoWidth, videoHeight);
        return fallbackBox
          ? normalizeDraftBox({
              x: fallbackBox.x / Math.max(1, videoWidth),
              y: fallbackBox.y / Math.max(1, videoHeight),
              w: fallbackBox.w / Math.max(1, videoWidth),
              h: fallbackBox.h / Math.max(1, videoHeight),
            })
          : null;
      }

      const before = [...merged].reverse().find((keyframe) => keyframe.time <= timestamp);
      const after = merged.find((keyframe) => keyframe.time >= timestamp);
      if (before && after && before !== after) {
        const span = Math.max(0.001, after.time - before.time);
        if (span <= MANUAL_GEOMETRY_INTERPOLATION_MAX_GAP_SECONDS) {
          return interpolateBoxes(
            normalizeDraftBox(before.coordinates),
            normalizeDraftBox(after.coordinates),
            (timestamp - before.time) / span,
          );
        }
      }
      const nearest = before || after || merged[0];
      return normalizeDraftBox(nearest.coordinates);
    },
    [buildTrackGeometryKeyframes, videoHeight, videoWidth],
  );
  const nativeSubcategoryOptions = useMemo(
    () =>
      [...(NATIVE_ANNOTATION_SUBCATEGORIES[nativeAnnotationDraft.category] || [])].sort(
        (left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }),
      ),
    [nativeAnnotationDraft.category],
  );
  const nativeReadyLabelOptions = useMemo(() => {
    let options: string[] = [];

    if (nativeAnnotationDraft.category === "Genre") {
      if (nativeAnnotationDraft.subcategory === "Media genre") {
        options = getMediaGenreOptions();
      } else if (nativeAnnotationDraft.subcategory === "Media subgenre") {
        options = nativeAnnotationDraft.mediaGenreParent
          ? [...(MEDIA_SUBGENRE_OPTIONS[nativeAnnotationDraft.mediaGenreParent] || [])].sort(
              (left, right) =>
                left.localeCompare(right, undefined, { sensitivity: "base" }),
            )
          : [];
      } else if (nativeAnnotationDraft.subcategory === "Situational genre") {
        options = getSituationalGenreOptions();
      } else if (nativeAnnotationDraft.subcategory === "Situational subgenre") {
        options = nativeAnnotationDraft.situationalGenreParent
          ? [
              ...(SITUATIONAL_SUBGENRE_OPTIONS[
                nativeAnnotationDraft.situationalGenreParent
              ] || []),
            ].sort((left, right) =>
              left.localeCompare(right, undefined, { sensitivity: "base" }),
            )
          : [];
      } else if (nativeAnnotationDraft.subcategory === "Situational taxonomy") {
        options = [...SITUATIONAL_TAXONOMY_OPTIONS];
      }
    } else {
      const key = `${nativeAnnotationDraft.category}::${nativeAnnotationDraft.subcategory}`;
      options = [...(NATIVE_ANNOTATION_LABELS[key] || [])].sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" }),
      );
    }

    options.push("Custom...");
    return options;
  }, [
    nativeAnnotationDraft.category,
    nativeAnnotationDraft.mediaGenreParent,
    nativeAnnotationDraft.situationalGenreParent,
	    nativeAnnotationDraft.subcategory,
	  ]);
  const showNativeNarrativeAgentPicker =
    nativeAnnotationDraft.category === "Identification";

  const overlayBoxes = useMemo(() => {
    const overlays: OverlayBox[] = [];

    if (!videoUrl || isLoading) {
      return overlays;
    }

    const manualOverridesByObjectTrack = new Map<string, ManualVisualAnnotation[]>();
    const manualOverridesBySourceLabel = new Map<string, ManualVisualAnnotation>();
    allManualVisualAnnotations.forEach((item) => {
      const targetId = manualObjectTargetId(item);
      if (targetId) {
        const existing = manualOverridesByObjectTrack.get(targetId) || [];
        manualOverridesByObjectTrack.set(targetId, [...existing, item]);
      }
      const targetLabel = normalizeEvidenceLabel(item.metadata_correlation?.target_label);
      if (targetLabel) {
        manualOverridesBySourceLabel.set(targetLabel, item);
      }
    });
    const manualTrackMatureAuthority = buildManualTrackMatureAuthority(allManualVisualAnnotations);
    const activeManualObjectTrackIds = new Set<string>();
    manualVisualAnnotations.forEach((item) => {
      const targetId = manualObjectTargetId(item);
      if (targetId) {
        activeManualObjectTrackIds.add(targetId);
      }
    });
    const activeLocalObjectLabelOverrides = localObjectLabelOverrides.filter((item) => {
      if (item.videoId && item.videoId !== videoId) {
        return false;
      }
      const start = typeof item.start === "number" ? item.start : Number.NEGATIVE_INFINITY;
      const end = typeof item.end === "number" ? item.end : Number.POSITIVE_INFINITY;
      return (
        currentTime >= Math.min(start, end) &&
        currentTime <= Math.max(start, end) + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
      );
    });
    const matureObjectOverlayLookup = buildMatureObjectOverlayLookup(
      analysisData?.masterSchemaResolvedEvidence?.records,
      currentTime,
    );
    const matureSubjectOverlayLookup = buildMatureSubjectOverlayLookup(
      analysisData?.masterSchemaResolvedEvidence?.records,
      currentTime,
    );
    const activeManualSpatialOverrides = allManualVisualAnnotations
      .map((item) => {
        if (
          item.geometry_type !== "box" ||
          !(
            isManualAnnotationVisibleAtTime(item, currentTime) ||
            isManualAnnotationVisibleInSelectedWorkspace(item)
          )
        ) {
          return null;
        }
        const box = resolveManualGeometryAtTime(item, currentTime);
        return box ? { item, box } : null;
      })
      .filter(Boolean) as Array<{ item: ManualVisualAnnotation; box: DraftBox }>;
    const matureProliferationByObjectTrack = new Map<
      string,
      { candidate: EvidenceProliferationCandidate; updatedAt: number }
    >();
    const matureProliferationSpatialCandidates: Array<{
      candidate: EvidenceProliferationCandidate;
      box: DraftBox;
      updatedAt: number;
    }> = [];
    storedProliferationMatches.forEach((match) => {
      if (match.videoId && match.videoId !== videoId) {
        return;
      }
      const updatedAt = Date.parse(match.updated_at || "");
      const matchUpdatedAt = Number.isFinite(updatedAt) ? updatedAt : 0;
      (match.candidates || []).forEach((candidate) => {
        if (!isMatureProliferationCandidate(candidate)) {
          return;
        }
        const trackId = candidateTrackTargetId(candidate);
        const start = Number(candidate.time?.start);
        const end = Number(candidate.time?.end ?? start);
        if (
          Number.isFinite(start) &&
          currentTime < Math.min(start, end) - MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
        ) {
          return;
        }
        if (
          Number.isFinite(end) &&
          currentTime > Math.max(start, end) + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
        ) {
          return;
        }
        const candidateBox = geometryToNormalizedBox(candidate.geometry, videoWidth, videoHeight);
        if (candidateBox) {
          matureProliferationSpatialCandidates.push({
            candidate,
            box: candidateBox,
            updatedAt: matchUpdatedAt,
          });
        }
        if (trackId) {
          const existing = matureProliferationByObjectTrack.get(trackId);
          const candidateScore =
            matchUpdatedAt + (candidateProbability(candidate) * 1000);
          const existingScore = existing
            ? existing.updatedAt + (candidateProbability(existing.candidate) * 1000)
            : Number.NEGATIVE_INFINITY;
          if (!existing || candidateScore > existingScore) {
            matureProliferationByObjectTrack.set(trackId, {
              candidate,
              updatedAt: matchUpdatedAt,
            });
          }
        }
      });
    });

    if (overlayToggles.objects) {
      activeRawObjects.forEach((item: DetectedObject, index: number) => {
        const targetId = objectTrackTargetId(item);
        const targetIds = objectTrackTargetIds(item);
        const objectNormalizedBox = detectedObjectToNormalizedBox(item, videoWidth, videoHeight);
        const manualOverride = (() => {
          const trackMatches = targetIds.flatMap(
            (trackId) => manualOverridesByObjectTrack.get(trackId) || [],
          );
          const selectedTrackManual =
            selectedWorkspaceAnnotationId && trackMatches.length > 0
              ? trackMatches.find((entry) => entry.id === selectedWorkspaceAnnotationId)
              : undefined;
          if (selectedTrackManual) {
            return selectedTrackManual;
          }
          const activeTrackManual = trackMatches.find(
            (entry) =>
              isManualAnnotationVisibleAtTime(entry, currentTime) ||
              isManualAnnotationVisibleInSelectedWorkspace(entry),
          );
          if (activeTrackManual) {
            return activeTrackManual;
          }
          const labels = [
            item.displayLabel,
            item.class_name,
            item.raw_class_name,
            targetId ? `${item.class_name} track ${targetId}` : "",
            targetId ? `person track ${targetId}` : "",
            ...targetIds.flatMap((trackId) => [
              `${item.class_name} track ${trackId}`,
              `person track ${trackId}`,
            ]),
          ].map(normalizeEvidenceLabel);
          if (targetIds.length === 0) {
            for (const label of labels) {
              if (label && manualOverridesBySourceLabel.has(label)) {
                return manualOverridesBySourceLabel.get(label);
              }
            }
          }
          if (objectNormalizedBox) {
            const spatialMatches = activeManualSpatialOverrides
              .filter(({ item: manualItem, box }) => {
                const manualLabel = resolveManualVisualDisplayLabel(manualItem);
                return (
                  Boolean(manualLabel) &&
                  isSameSpaceBoxMatch(objectNormalizedBox, box)
                );
              })
              .sort(
                (left, right) =>
                  calculateDraftBoxIoU(objectNormalizedBox, right.box) -
                  calculateDraftBoxIoU(objectNormalizedBox, left.box),
              );
            if (spatialMatches[0]) {
              return spatialMatches[0].item;
            }
          }
          return undefined;
        })();
        const manualOverrideActive =
          !!manualOverride &&
          (isManualAnnotationVisibleAtTime(manualOverride, currentTime) ||
            isManualAnnotationVisibleInSelectedWorkspace(manualOverride));
        const sourceLabels = [
          item.displayLabel,
          item.class_name,
          item.raw_class_name,
          targetId ? `${item.class_name} track ${targetId}` : "",
          targetId ? `person track ${targetId}` : "",
          ...targetIds.flatMap((trackId) => [
            `${item.class_name} track ${trackId}`,
            `person track ${trackId}`,
          ]),
        ].map(normalizeEvidenceLabel);
        const narrativeAgentOverride = (() => {
          for (const trackId of targetIds) {
            const trackOverride = matureSubjectOverlayLookup.byTrack.get(trackId);
            if (trackOverride) {
              return trackOverride;
            }
          }
          if (targetIds.length === 0) {
            for (const sourceLabel of sourceLabels) {
              const labelOverride = matureSubjectOverlayLookup.byRawLabel.get(sourceLabel);
              if (labelOverride) {
                return labelOverride;
              }
            }
          }
          return undefined;
        })();
        const localOverride = (() => {
          return activeLocalObjectLabelOverrides.find((override) => {
            const sameTrack =
              override.trackId !== undefined &&
              targetIds.some((trackId) => Number(override.trackId) === Number(trackId));
            if (override.trackId !== undefined) {
              return sameTrack;
            }
            const overrideSource = normalizeEvidenceLabel(override.sourceLabel);
            return targetIds.length === 0 && Boolean(overrideSource && sourceLabels.includes(overrideSource));
          });
        })();
        const masterSchemaMatureOverride = (() => {
          if (manualOverrideActive || localOverride) {
            return undefined;
          }
          for (const trackId of targetIds) {
            const trackOverride = matureObjectOverlayLookup.byTrack.get(trackId);
            if (trackOverride) {
              return trackOverride;
            }
          }
          if (targetIds.length === 0) {
            for (const sourceLabel of sourceLabels) {
              const labelOverride = matureObjectOverlayLookup.byRawLabel.get(sourceLabel);
              if (labelOverride) {
                return labelOverride;
              }
            }
          }
          return undefined;
        })();
        const hasNarrativeAgentRecognition = Boolean(narrativeAgentOverride);
        const identityLabel = identityLabelForOverlay(
          narrativeAgentOverride?.label || "",
          hasNarrativeAgentRecognition,
        );
        const manualTrackAuthority = targetIds
          .map((trackId) => manualTrackMatureAuthority.get(trackId))
          .find(Boolean);
        const matureProliferatedOverride = (() => {
          if (manualOverrideActive || localOverride || masterSchemaMatureOverride) {
            return undefined;
          }
          for (const trackId of targetIds) {
            const trackCandidate = matureProliferationByObjectTrack.get(trackId)?.candidate;
            if (trackCandidate) {
              return trackCandidate;
            }
          }
          if (!objectNormalizedBox) {
            return undefined;
          }
          return matureProliferationSpatialCandidates
            .filter(({ box }) => isSameSpaceBoxMatch(objectNormalizedBox, box))
            .sort((left, right) => {
              const rightScore =
                calculateDraftBoxIoU(objectNormalizedBox, right.box) * 2 +
                candidateProbability(right.candidate) +
                right.updatedAt / 10000000000000;
              const leftScore =
                calculateDraftBoxIoU(objectNormalizedBox, left.box) * 2 +
                candidateProbability(left.candidate) +
                left.updatedAt / 10000000000000;
              return rightScore - leftScore;
            })[0]?.candidate;
        })();
        const resolvedBox =
          manualOverrideActive && manualOverride?.geometry_type === "box"
            ? (() => {
                const normalized = resolveManualGeometryAtTime(manualOverride, currentTime);
                if (!normalized) return null;
                return {
                  x: normalized.x * videoWidth,
                  y: normalized.y * videoHeight,
                  w: normalized.w * videoWidth,
                  h: normalized.h * videoHeight,
                };
              })()
            : resolveObjectOverlayBBox(item.bbox, videoWidth, videoHeight);
        if (!resolvedBox) {
          return;
        }
        if (
          targetIds.length > 0 &&
          manualOverrideActive &&
          targetIds.some((trackId) => activeManualObjectTrackIds.has(trackId)) &&
          overlayToggles.manual
        ) {
          return;
        }

        const localOverlayLabel = governedOverlayLabel(localOverride?.label);
        const manualTrackOverlayLabel = manualTrackAuthority
          ? joinGovernedOverlayLabel(
              manualTrackAuthority.label,
              manualTrackAuthority.roleLabel,
            )
          : undefined;
        const narrativeAgentOverlayLabel = narrativeAgentOverride
          ? joinGovernedOverlayLabel(
              narrativeAgentOverride.label || identityLabel,
              narrativeAgentOverride.roleLabel,
            )
          : undefined;
        const masterSchemaOverlayLabel = governedOverlayLabel(
          masterSchemaMatureOverride?.label,
        );
        const proliferatedOverlayLabel = matureProliferatedOverride
          ? governedOverlayLabel(resolveProliferatedDisplayLabel(matureProliferatedOverride))
          : undefined;
        const manualOverrideOverlayLabel = manualOverrideActive
          ? governedOverlayLabel(resolveManualVisualDisplayLabel(manualOverride))
          : undefined;
        const unresolvedOverlayLabel = unresolvedObjectConfirmationLabel(item);
        const objectOverlayLabel =
          localOverlayLabel ||
          manualTrackOverlayLabel ||
          narrativeAgentOverlayLabel ||
          masterSchemaOverlayLabel ||
          proliferatedOverlayLabel ||
          manualOverrideOverlayLabel ||
          unresolvedOverlayLabel;

        overlays.push({
          key: `object-${index}-${item.timestamp}`,
          modality: "object",
          label: objectOverlayLabel,
          color: localOverride || manualOverrideActive || manualTrackAuthority
            ? "border-emerald-300/80 bg-emerald-300/10"
            : masterSchemaMatureOverride
            ? "border-violet-300/85 bg-violet-300/10"
            : narrativeAgentOverride
            ? "border-violet-300/85 bg-violet-300/10"
            : matureProliferatedOverride
            ? "border-sky-300/85 bg-sky-300/10"
            : "border-amber-300/80 bg-amber-300/10",
          x: resolvedBox.x,
          y: resolvedBox.y,
          w: resolvedBox.w,
          h: resolvedBox.h,
          sourceItem:
            manualOverrideActive && manualOverride
              ? {
                  ...item,
                  manual_annotation: manualOverride,
                }
              : manualTrackAuthority
              ? {
                  ...item,
                  manual_annotation: manualTrackAuthority.sourceItem,
                  master_schema_mature_label: manualTrackAuthority,
                  narrative_agent_recognition: manualTrackAuthority,
                  bbox_mature_authority: manualTrackAuthority,
                  displayLabel: manualTrackOverlayLabel || unresolvedOverlayLabel,
                  traceback: manualTrackAuthority.traceback,
                  evidence_refs: manualTrackAuthority.evidence_refs,
                  source_bbox_refs: manualTrackAuthority.source_bbox_refs,
                  source_frame_refs: manualTrackAuthority.source_frame_refs,
                }
              : matureProliferatedOverride
              ? {
                  ...item,
                  proliferated_annotation: matureProliferatedOverride,
                  displayLabel: proliferatedOverlayLabel || unresolvedOverlayLabel,
                  agent_persistence_labels: ["Constellational Match"],
                }
              : narrativeAgentOverride
              ? {
                  ...item,
                  master_schema_mature_label: narrativeAgentOverride,
                  narrative_agent_recognition: narrativeAgentOverride,
                  traceback: narrativeAgentOverride.traceback,
                  evidence_refs: narrativeAgentOverride.evidence_refs,
                  source_bbox_refs: narrativeAgentOverride.source_bbox_refs,
                  source_frame_refs: narrativeAgentOverride.source_frame_refs,
                  displayLabel: [
                    narrativeAgentOverlayLabel || unresolvedOverlayLabel,
                  ].filter(Boolean).join(" / "),
                }
              : masterSchemaMatureOverride
              ? {
                  ...item,
                  master_schema_mature_label: masterSchemaMatureOverride,
                  traceback: masterSchemaMatureOverride.traceback,
                  evidence_refs: masterSchemaMatureOverride.evidence_refs,
                  source_bbox_refs: masterSchemaMatureOverride.source_bbox_refs,
                  source_frame_refs: masterSchemaMatureOverride.source_frame_refs,
                  displayLabel: masterSchemaOverlayLabel || unresolvedOverlayLabel,
                }
              : {
                  ...item,
                  displayLabel: unresolvedObjectConfirmationLabel(item),
                  raw_detection_hidden: true,
                  narrative_agent_confirmation_required: true,
                },
        });
      });
    }

    if (overlayToggles.ocr) {
      activeOCR.forEach((item: OCR, index: number) => {
        if (
          item.bbox?.x === undefined ||
          item.bbox?.y === undefined ||
          item.bbox?.w === undefined ||
          item.bbox?.h === undefined
        ) {
          return;
        }

        overlays.push({
          key: `ocr-${index}-${item.timestamp}`,
          modality: "ocr",
          label: item.text,
          color: "border-emerald-400/80 bg-emerald-400/10",
          x: item.bbox.x,
          y: item.bbox.y,
          w: item.bbox.w,
          h: item.bbox.h,
          sourceItem: item,
        });
      });
    }

    if (overlayToggles.expressions) {
      activeExpressions.forEach((item: ExpressionSample, index: number) => {
        if (
          item.bbox?.x === undefined ||
          item.bbox?.y === undefined ||
          item.bbox?.w === undefined ||
          item.bbox?.h === undefined
        ) {
          return;
        }
        const sourceAnnotations = analysisData?.metadata?.sourceAnnotations || {};
        const weighting = buildExpressionWeighting(item, {
          user_annotations: {
            genre: sourceAnnotations.genre || "",
            genre_subtype: sourceAnnotations.genre_subtype || "",
            situational_genre: sourceAnnotations.situational_genre || "",
            situational_subtype: sourceAnnotations.situational_subtype || "",
            privacy_axis: "",
            expertise_axis: "",
          },
        } as any);
        const weightedLabel = weighting.ranking.weighted_primary.label;

        overlays.push({
          key: `expression-${index}-${item.timestamp}`,
          modality: "expression",
          label:
            weightedLabel && weightedLabel !== "unavailable"
              ? weightedLabel
              : item.dominant_emotion || "expression",
          color: "border-fuchsia-400/80 bg-fuchsia-400/10",
          x: item.bbox.x,
          y: item.bbox.y,
          w: item.bbox.w,
          h: item.bbox.h,
          sourceItem: item,
        });
      });
    }

    if (overlayToggles.manual) {
      const selectedManualId = selectedOverlayKey?.startsWith("manual-")
        ? selectedOverlayKey.replace(/^manual-/, "")
        : null;
      const manualOverlaySource = [...manualVisualAnnotations];
      if (
        selectedManualId &&
        !manualOverlaySource.some((item) => item.id === selectedManualId)
      ) {
        const selectedManual = allManualVisualAnnotations.find(
          (item) => item.id === selectedManualId,
        );
        if (
          selectedManual &&
          (isManualAnnotationVisibleAtTime(selectedManual, currentTime) ||
            isManualAnnotationVisibleInSelectedWorkspace(selectedManual))
        ) {
          manualOverlaySource.push(selectedManual);
        }
      }
      manualOverlaySource.forEach((item: ManualVisualAnnotation, index: number) => {
        if (item.geometry_type !== "box") {
          return;
        }
        const resolvedBox = resolveManualGeometryAtTime(item, currentTime);
        if (!resolvedBox) return;

        overlays.push({
          key: `manual-${item.id || index}`,
          modality: "manual",
          label: resolveManualVisualDisplayLabel(item),
          color: "border-amber-300/90 bg-amber-300/10",
          x: resolvedBox.x * videoWidth,
          y: resolvedBox.y * videoHeight,
          w: resolvedBox.w * videoWidth,
          h: resolvedBox.h * videoHeight,
          sourceItem: item,
        });
      });
    }

    if (
      selectedOverlayKey &&
      selectedOverlaySnapshot &&
      !overlays.some((overlay) => overlay.key === selectedOverlayKey)
    ) {
      const edit = selectedIndicationEdits[selectedOverlayKey];
      const padding = selectedOverlayTimelinePadding[selectedOverlayKey] || {
        before: 0,
        after: 0,
      };
      if (edit) {
        const intervalStart = clamp(
          Math.min(edit.start, edit.end) - Math.max(0, padding.before),
          0,
          duration || Number.MAX_SAFE_INTEGER,
        );
        const intervalEnd = clamp(
          Math.max(edit.start, edit.end) + Math.max(0, padding.after),
          0,
          duration || Number.MAX_SAFE_INTEGER,
        );
        if (
          currentTime >= intervalStart &&
          currentTime <= intervalEnd + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
        ) {
          overlays.push(selectedOverlaySnapshot);
        }
      }
    }

    return overlays;
  }, [
    activeExpressions,
    activeOCR,
    activeRawObjects,
    analysisData?.masterSchemaResolvedEvidence?.records,
    analysisData?.metadata?.sourceAnnotations,
    allManualVisualAnnotations,
    currentTime,
    localObjectLabelOverrides,
    manualVisualAnnotations,
    overlayToggles,
    resolveManualGeometryAtTime,
    isManualAnnotationVisibleInSelectedWorkspace,
    storedProliferationMatches,
    duration,
    selectedIndicationEdits,
    selectedOverlayKey,
    selectedOverlaySnapshot,
    selectedOverlayTimelinePadding,
    selectedWorkspaceAnnotationId,
    isLoading,
    videoUrl,
    videoId,
    videoHeight,
    videoWidth,
  ]);

  const selectedOverlay = useMemo(
    () => overlayBoxes.find((overlay) => overlay.key === selectedOverlayKey) || null,
    [overlayBoxes, selectedOverlayKey],
  );

  const getOverlayNormalizedBox = React.useCallback(
    (overlay: OverlayBox): DraftBox => {
      const videoWidth = Math.max(1, videoRef.current?.videoWidth || 1);
      const videoHeight = Math.max(1, videoRef.current?.videoHeight || 1);
      const fallback = {
        x: clamp(overlay.x / videoWidth, 0, 1),
        y: clamp(overlay.y / videoHeight, 0, 1),
        w: clamp(overlay.w / videoWidth, 0.002, 1),
        h: clamp(overlay.h / videoHeight, 0.002, 1),
      };
      const draft = overlayGeometryDrafts[overlay.key];
      if (
        draft &&
        Number.isFinite(draft.time) &&
        Math.abs(draft.time - currentTime) <= 0.075
      ) {
        return draft.box;
      }
      return fallback;
    },
    [currentTime, overlayGeometryDrafts],
  );

  const findExpressionPersonAnchor = React.useCallback(
    (overlay: OverlayBox): { item: DetectedObject; box: DraftBox; trackId: string | null } | null => {
      if (overlay.modality !== "expression") {
        return null;
      }
      const expressionBox = getOverlayNormalizedBox(overlay);
      const expressionCenter = {
        x: expressionBox.x + expressionBox.w / 2,
        y: expressionBox.y + expressionBox.h / 2,
      };
      const candidates = activeRawObjects
        .map((item) => {
          const box = detectedObjectToNormalizedBox(item, videoWidth, videoHeight);
          if (!box) {
            return null;
          }
          const className = normalizeEvidenceLabel(
            item.raw_class_name || item.class_name || item.displayLabel,
          );
          const containsCenter =
            expressionCenter.x >= box.x &&
            expressionCenter.x <= box.x + box.w &&
            expressionCenter.y >= box.y &&
            expressionCenter.y <= box.y + box.h;
          const iou = calculateDraftBoxIoU(expressionBox, box);
          const distance = calculateDraftBoxCenterDistance(expressionBox, box);
          const isPerson =
            className === "person" ||
            className.startsWith("person ") ||
            className.startsWith("person track");
          if (!isPerson || (!containsCenter && iou <= 0)) {
            return null;
          }
          return {
            item,
            box,
            trackId: objectTrackTargetId(item),
            score:
              (isPerson ? 100 : 0) +
              (containsCenter ? 10 : 0) +
              iou * 20 -
              distance,
          };
        })
        .filter(Boolean) as Array<{
          item: DetectedObject;
          box: DraftBox;
          trackId: string | null;
          score: number;
        }>;
      return candidates.sort((left, right) => right.score - left.score)[0] || null;
    },
    [activeRawObjects, getOverlayNormalizedBox, videoHeight, videoWidth],
  );

  const getRenderedVideoPoint = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!renderedVideoRect || renderedVideoRect.width <= 0 || renderedVideoRect.height <= 0) {
        return null;
      }
      return {
        x: clamp((clientX - renderedVideoRect.x) / renderedVideoRect.width, 0, 1),
        y: clamp((clientY - renderedVideoRect.y) / renderedVideoRect.height, 0, 1),
      };
    },
    [renderedVideoRect],
  );

  const beginOverlayGeometryDrag = React.useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      overlay: OverlayBox,
      mode: OverlayGeometryDrag["mode"],
    ) => {
      const startPoint = getRenderedVideoPoint(event.clientX, event.clientY);
      if (!startPoint) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      videoRef.current?.pause();
      setSelectedOverlayKey(overlay.key);
      setOverlayGeometryDrag({
        overlayKey: overlay.key,
        mode,
        startPoint,
        startBox: getOverlayNormalizedBox(overlay),
      });
    },
    [getOverlayNormalizedBox, getRenderedVideoPoint],
  );

  useEffect(() => {
    if (!overlayGeometryDrag) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const point = getRenderedVideoPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      const minSize = 0.004;
      const dx = point.x - overlayGeometryDrag.startPoint.x;
      const dy = point.y - overlayGeometryDrag.startPoint.y;
      const rawEndX = overlayGeometryDrag.startBox.x + overlayGeometryDrag.startBox.w + dx;
      const rawEndY = overlayGeometryDrag.startBox.y + overlayGeometryDrag.startBox.h + dy;
      const nextX = clamp(
        Math.min(overlayGeometryDrag.startBox.x, rawEndX),
        0,
        1 - minSize,
      );
      const nextY = clamp(
        Math.min(overlayGeometryDrag.startBox.y, rawEndY),
        0,
        1 - minSize,
      );
      const nextW = clamp(
        Math.abs(rawEndX - overlayGeometryDrag.startBox.x),
        minSize,
        1 - nextX,
      );
      const nextH = clamp(
        Math.abs(rawEndY - overlayGeometryDrag.startBox.y),
        minSize,
        1 - nextY,
      );
      const nextBox =
        overlayGeometryDrag.mode === "move"
          ? {
              ...overlayGeometryDrag.startBox,
              x: clamp(
                overlayGeometryDrag.startBox.x + dx,
                0,
                Math.max(0, 1 - overlayGeometryDrag.startBox.w),
              ),
              y: clamp(
                overlayGeometryDrag.startBox.y + dy,
                0,
                Math.max(0, 1 - overlayGeometryDrag.startBox.h),
              ),
            }
          : {
              ...overlayGeometryDrag.startBox,
              x: nextX,
              y: nextY,
              w: nextW,
              h: nextH,
            };

      setOverlayGeometryDrafts((current) => ({
        ...current,
        [overlayGeometryDrag.overlayKey]: {
          box: normalizeDraftBox(nextBox),
          time: currentTime,
        },
      }));
    };

    const handlePointerUp = () => {
      setOverlayGeometryDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [currentTime, getRenderedVideoPoint, overlayGeometryDrag]);

  const getOverlayTimestamp = React.useCallback(
    (overlay: OverlayBox) => {
      const source = overlay.sourceItem || {};
      const attachedManual = getAttachedManualAnnotation(source);
      const timestamp =
        typeof attachedManual?.timestamp_seconds === "number"
          ? attachedManual.timestamp_seconds
          : typeof attachedManual?.start_seconds === "number"
            ? attachedManual.start_seconds
          : typeof source.timestamp_seconds === "number"
            ? source.timestamp_seconds
          : typeof source.timestamp === "number"
            ? source.timestamp
            : typeof source.startTimestamp === "number"
              ? source.startTimestamp
              : currentTime;
      return Number.isFinite(timestamp) ? Number(timestamp) : currentTime;
    },
    [currentTime],
  );

  const getOverlayTimeBounds = React.useCallback(
    (overlay: OverlayBox) => {
      const source = overlay.sourceItem || {};
      const attachedManual = getAttachedManualAnnotation(source);
      const timestamp = getOverlayTimestamp(overlay);
      const rawStart =
        typeof attachedManual?.start_seconds === "number"
          ? attachedManual.start_seconds
          : typeof source.start_seconds === "number"
            ? source.start_seconds
          : typeof source.startTimestamp === "number"
            ? source.startTimestamp
            : typeof source.start_timestamp === "number"
              ? source.start_timestamp
              : timestamp;
      const rawEnd =
        typeof attachedManual?.end_seconds === "number"
          ? attachedManual.end_seconds
          : typeof source.end_seconds === "number"
            ? source.end_seconds
          : typeof source.endTimestamp === "number"
            ? source.endTimestamp
            : typeof source.end_timestamp === "number"
              ? source.end_timestamp
              : timestamp;
      const start = Number.isFinite(rawStart) ? Number(rawStart) : timestamp;
      const end = Number.isFinite(rawEnd) ? Number(rawEnd) : timestamp;
      return {
        start: clamp(Math.min(start, end), 0, duration || Number.MAX_SAFE_INTEGER),
        end: clamp(Math.max(start, end, timestamp + 0.1), 0, duration || Number.MAX_SAFE_INTEGER),
      };
    },
    [duration, getOverlayTimestamp],
  );

  const getOverlayInteractionTime = React.useCallback(
    (overlay: OverlayBox) => {
      const bounds = getOverlayTimeBounds(overlay);
      const scrubValue =
        selectedOverlayScrub?.overlayKey === overlay.key
          ? selectedOverlayScrub.value
          : null;
      const visibleTime =
        typeof scrubValue === "number" && Number.isFinite(scrubValue)
          ? scrubValue
          : currentTime;
      if (
        selectedOverlayKey === overlay.key &&
        Number.isFinite(visibleTime)
      ) {
        return clamp(visibleTime, 0, duration || Number.MAX_SAFE_INTEGER);
      }
      if (
        Number.isFinite(visibleTime) &&
        visibleTime >= bounds.start - MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS &&
        visibleTime <= bounds.end + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS
      ) {
        return clamp(visibleTime, 0, duration || Number.MAX_SAFE_INTEGER);
      }
      return getOverlayTimestamp(overlay);
    },
    [
      currentTime,
      duration,
      getOverlayTimeBounds,
      getOverlayTimestamp,
      selectedOverlayKey,
      selectedOverlayScrub,
    ],
  );

  const buildIndicationEditForOverlay = React.useCallback(
    (overlay: OverlayBox): SelectedIndicationEdit => {
      const source = overlay.sourceItem || {};
      const bounds = getOverlayTimeBounds(overlay);
      const category = getDefaultCategoryForOverlay(overlay);
      const manual =
        overlay.modality === "manual"
          ? (source as ManualVisualAnnotation)
          : getAttachedManualAnnotation(source);
      const needsNarrativeAgentConfirmation = Boolean(
        source.narrative_agent_confirmation_required,
      );
      const label = needsNarrativeAgentConfirmation
        ? ""
        : (manual ? resolveManualVisualDisplayLabel(manual) : "") ||
          overlay.label ||
          "";
      return {
        category:
          manual?.category ||
          (needsNarrativeAgentConfirmation ? "Identification" : category),
        subcategory:
          manual?.subcategory ||
          getFirstSubcategoryForCategory(
            manual?.category ||
              (needsNarrativeAgentConfirmation ? "Identification" : category),
        ),
        label,
        identityAffirmation: manual?.identity_affirmation || "",
        applyScope:
          ((manual?.metadata_correlation as any)?.apply_scope as BBoxRoiApplyScope) ||
          "this_interval_only",
        quickAnnotations:
          ((manual?.metadata_correlation as any)?.quick_annotations as string[]) ||
          [],
        start: bounds.start,
        end: bounds.end,
        note: manual?.open_note || "",
      };
    },
    [getOverlayTimeBounds],
  );

  const getSelectedIndicationEdit = React.useCallback(
    (overlay: OverlayBox) =>
      selectedIndicationEdits[overlay.key] || buildIndicationEditForOverlay(overlay),
    [buildIndicationEditForOverlay, selectedIndicationEdits],
  );

  const updateSelectedIndicationEdit = React.useCallback(
    (overlayKey: string, patch: Partial<SelectedIndicationEdit>) => {
      setSelectedIndicationEdits((current) => {
        const overlay = overlayBoxes.find((item) => item.key === overlayKey);
        const base =
          current[overlayKey] || (overlay ? buildIndicationEditForOverlay(overlay) : null);
        if (!base) return current;
        const next = { ...base, ...patch };
        if (patch.category && patch.category !== base.category) {
          next.subcategory = getFirstSubcategoryForCategory(patch.category);
          next.label = resolveIndicationLabel(patch.category, next.label);
        }
        next.start = clamp(Number(next.start), 0, duration || Number.MAX_SAFE_INTEGER);
        next.end = clamp(
          Math.max(Number(next.end), next.start + 0.001),
          0,
          duration || Number.MAX_SAFE_INTEGER,
        );
        return {
          ...current,
          [overlayKey]: next,
        };
      });
    },
    [buildIndicationEditForOverlay, duration, overlayBoxes],
  );

  const updateSelectedOverlayProliferation = React.useCallback(
    (overlayKey: string, patch: Partial<ProliferationLauncherState>) => {
      setSelectedOverlayProliferation((current) => ({
        ...current,
        [overlayKey]: {
          ...DEFAULT_PROLIFERATION_LAUNCHER,
          ...(current[overlayKey] || {}),
          ...patch,
        },
      }));
    },
    [],
  );

  const prepareProliferationFromOverlay = React.useCallback(
    (
      overlay: OverlayBox,
      edit: SelectedIndicationEdit,
      launcher: ProliferationLauncherState,
      sourceLabel: string,
    ) => {
      const normalizedBox = getOverlayNormalizedBox(overlay);
      const sourceItem =
        overlay.sourceItem && typeof overlay.sourceItem === "object"
          ? (overlay.sourceItem as Record<string, unknown>)
          : {};
      const sourceCorrelation =
        sourceItem.metadata_correlation && typeof sourceItem.metadata_correlation === "object"
          ? (sourceItem.metadata_correlation as Record<string, unknown>)
          : {};
      const sourceTrackId =
        sourceItem.trackId ??
        sourceItem.track_id ??
        sourceCorrelation.target_id ??
        sourceCorrelation.track_id;
      const request = {
        request_id: `proliferate-${Date.now()}-${overlay.key}`,
        created_at: new Date().toISOString(),
        video_id: videoId,
        evidence: {
          overlay_key: overlay.key,
          modality: overlay.modality,
          label: edit.label || overlay.label,
          source_label: sourceLabel || overlay.label,
          category: edit.category,
          source_track_id:
            sourceTrackId !== undefined && sourceTrackId !== null ? String(sourceTrackId) : undefined,
          source_target_type:
            typeof sourceCorrelation.target_type === "string"
              ? sourceCorrelation.target_type
              : overlay.modality,
          geometry: {
            geometry_type: "bbox",
            coordinate_system: "normalized",
            bbox: {
              x: Number(normalizedBox.x.toFixed(6)),
              y: Number(normalizedBox.y.toFixed(6)),
              width: Number(normalizedBox.w.toFixed(6)),
              height: Number(normalizedBox.h.toFixed(6)),
            },
          },
          interval: {
            start: Number(edit.start.toFixed(3)),
            end: Number(edit.end.toFixed(3)),
          },
        },
        scope: launcher.scope,
        target: launcher.target,
        governance: {
          manual_correction_wins: true,
          evidence_linked_not_timeline_linear: true,
          analyst_confirmation_is_optional: true,
          outputs_are_candidates_until_verified_by_evidence: true,
        },
      };

      if (typeof window !== "undefined") {
        const storageKey = "vaa1.proliferation.requests";
        const existing = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
        window.localStorage.setItem(
          storageKey,
          JSON.stringify([request, ...(Array.isArray(existing) ? existing : [])].slice(0, 25)),
        );
      }
      eventBus.emit("evidenceProliferationRequested", request);
      updateSelectedOverlayProliferation(overlay.key, {
        open: true,
        requestProgress: 100,
        matchingProgress: 25,
        candidateCount: 0,
        candidates: [],
        error: undefined,
        message: "Request prepared. Matching candidates...",
      });
      void apiService
        .matchEvidenceProliferation(videoId, request)
        .then((result) => {
          eventBus.emit("evidenceProliferationMatched", {
            videoId,
            overlayKey: overlay.key,
            request,
            result,
          });
          if (typeof window !== "undefined") {
            const storageKey = "vaa1.proliferation.matches";
            const existing = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
            const nextMatches = [
              {
                videoId,
                overlayKey: overlay.key,
                request_id: result.request_id,
                candidate_count: result.candidate_count,
                candidates: result.candidates || [],
                updated_at: new Date().toISOString(),
              },
              ...(Array.isArray(existing) ? existing : []),
            ].slice(0, 25);
            window.localStorage.setItem(storageKey, JSON.stringify(nextMatches));
            setStoredProliferationMatches(nextMatches);
          }
          updateSelectedOverlayProliferation(overlay.key, {
            open: true,
            requestProgress: result.progress?.request_preparation ?? 100,
            matchingProgress: result.progress?.candidate_matching ?? 100,
            candidateCount: result.candidate_count ?? result.candidates?.length ?? 0,
            candidates: result.candidates || [],
            error: undefined,
            message: `Candidate matching complete: ${
              result.candidate_count ?? result.candidates?.length ?? 0
            } candidate${(result.candidate_count ?? result.candidates?.length ?? 0) === 1 ? "" : "s"}.`,
          });
        })
        .catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const backendNeedsRefresh = errorMessage.includes("404");
          updateSelectedOverlayProliferation(overlay.key, {
            open: true,
            requestProgress: 100,
            matchingProgress: 0,
            candidateCount: 0,
            candidates: [],
            error: backendNeedsRefresh
              ? "Candidate search is not available in the running analysis service yet. Refresh the analysis service, then prepare candidates again."
              : errorMessage,
            message: backendNeedsRefresh
              ? "Request prepared. Candidate search service needs refresh."
              : "Request prepared. Candidate matching could not run.",
          });
        });
    },
    [getOverlayNormalizedBox, updateSelectedOverlayProliferation, videoId],
  );

  const cutSelectedIndicationOut = React.useCallback(
    (overlayKey: string, explicitCutTime?: number) => {
      const cutTime =
        typeof explicitCutTime === "number"
          ? explicitCutTime
          : selectedOverlayScrub?.overlayKey === overlayKey
          ? selectedOverlayScrub.value
          : currentTime;
      updateSelectedIndicationEdit(overlayKey, { end: cutTime });
      setSelectedOverlayScrub({ overlayKey, value: cutTime, active: false });
    },
    [currentTime, selectedOverlayScrub, updateSelectedIndicationEdit],
  );

  const finishSelectedOverlayTimeDraw = React.useCallback(
    (overlayKey: string, fallbackTime: number) => {
      const drag =
        selectedOverlayTimeDrag?.overlayKey === overlayKey
          ? selectedOverlayTimeDrag
          : null;
      const releaseTime =
        selectedOverlayScrub?.overlayKey === overlayKey
          ? selectedOverlayScrub.value
          : fallbackTime;
      if (drag) {
        const start = Math.min(drag.start, releaseTime);
        const end = Math.max(drag.start, releaseTime, start + 0.001);
        updateSelectedIndicationEdit(overlayKey, { start, end });
      }
      setSelectedOverlayTimeDrag(null);
      finishSelectedOverlayScrub();
    },
    [
      finishSelectedOverlayScrub,
      selectedOverlayScrub,
      selectedOverlayTimeDrag,
      updateSelectedIndicationEdit,
    ],
  );

  const scrubAndExtendSelectedOverlay = React.useCallback(
    (
      overlayKey: string,
      nextTime: number,
      minTime: number,
      maxTime: number,
      edit: SelectedIndicationEdit,
      _overdraftActive: boolean,
    ) => {
      const safeTime = clamp(nextTime, minTime, maxTime);
      scrubSelectedOverlayTo(overlayKey, safeTime, minTime, maxTime);
      const patch: Partial<SelectedIndicationEdit> = {};
      if (safeTime < edit.start) {
        patch.start = safeTime;
      }
      if (safeTime > edit.end) {
        patch.end = safeTime;
      }
      if (patch.start !== undefined || patch.end !== undefined) {
        updateSelectedIndicationEdit(overlayKey, patch);
      }
    },
    [scrubSelectedOverlayTo, updateSelectedIndicationEdit],
  );

  const commitSelectedTimeInput = React.useCallback(
    (
      inputKey: string,
      overlayKey: string,
      field: "start" | "end",
      fallbackValue: number,
    ) => {
      setSelectedTimeInputDrafts((current) => {
        const draftValue = current[inputKey];
        if (draftValue === undefined) {
          return current;
        }
        const parsed = parsePreciseTimeInput(draftValue);
        if (parsed !== null) {
          updateSelectedIndicationEdit(overlayKey, { [field]: parsed });
        }
        const next = { ...current };
        next[inputKey] = formatPreciseTime(parsed ?? fallbackValue);
        window.setTimeout(() => {
          setSelectedTimeInputDrafts((latest) => {
            const cleared = { ...latest };
            delete cleared[inputKey];
            return cleared;
          });
        }, 0);
        return next;
      });
    },
    [updateSelectedIndicationEdit],
  );

  const selectOverlayForEditing = React.useCallback(
    (overlay: OverlayBox) => {
      const source = overlay.sourceItem || {};
      const attachedManual =
        overlay.modality === "manual"
          ? (source as ManualVisualAnnotation)
          : getAttachedManualAnnotation(source);
      const authoritativeEdit = buildIndicationEditForOverlay(overlay);
      setSelectedIndicationEdits((current) =>
        selectedOverlayKey === overlay.key && current[overlay.key]
          ? current
          : {
              ...current,
              [overlay.key]: authoritativeEdit,
            },
      );
      setSelectedWorkspaceAnnotationId(attachedManual?.id || null);
      setSelectedOverlayKey(overlay.key);
      setSelectedOverlaySnapshot(overlay);
    },
    [buildIndicationEditForOverlay, getAttachedManualAnnotation, selectedOverlayKey],
  );

  useEffect(() => {
    if (!pendingObjectOverlayEdit || overlayBoxes.length === 0) {
      return;
    }
    const match = overlayBoxes.find((overlay) => {
      if (overlay.modality !== "object") {
        return false;
      }
      const source = overlay.sourceItem || {};
      const sameTrack =
        pendingObjectOverlayEdit.trackId !== undefined &&
        Number(source.trackId ?? source.track_id) ===
          Number(pendingObjectOverlayEdit.trackId);
      const sameLabel =
        pendingObjectOverlayEdit.label &&
        String(overlay.label || source.displayLabel || source.class_name || "")
          .toLowerCase()
          .includes(String(pendingObjectOverlayEdit.label).toLowerCase());
      return sameTrack || sameLabel;
    });
    if (!match) {
      return;
    }
    const authoritativeEdit = buildIndicationEditForOverlay(match);
    setSelectedIndicationEdits((current) => ({
      ...current,
      [match.key]: {
        ...authoritativeEdit,
        start:
          typeof pendingObjectOverlayEdit.start === "number"
            ? pendingObjectOverlayEdit.start
            : authoritativeEdit.start,
        end:
          typeof pendingObjectOverlayEdit.end === "number"
            ? pendingObjectOverlayEdit.end
            : authoritativeEdit.end,
        category:
          pendingObjectOverlayEdit.category ||
          authoritativeEdit.category,
        note:
          pendingObjectOverlayEdit.note ??
          authoritativeEdit.note,
      },
    }));
    setSelectedOverlayKey(match.key);
    setPendingObjectOverlayEdit(null);
  }, [buildIndicationEditForOverlay, overlayBoxes, pendingObjectOverlayEdit]);

  const openEvidencePanelForOverlay = React.useCallback(
    (overlay: OverlayBox) => {
      if (!videoId) {
        return;
      }

      const source = overlay.sourceItem || {};
      const timestamp = getOverlayInteractionTime(overlay);

      let panelType = "MasterSchema";
      if (overlay.modality === "object") {
        panelType = "OBJDetection";
      } else if (overlay.modality === "ocr") {
        panelType = "OCR";
      } else if (overlay.modality === "expression") {
        panelType = "Expressions";
      } else if (overlay.modality === "manual") {
        const annotation = source as ManualVisualAnnotation;
        panelType = MANUAL_CATEGORY_PANEL_MAP[annotation.category] || "MasterSchema";
      }

      openPanel(panelType, {
        videoId,
        source: "video_overlay",
        evidenceKey: overlay.key,
        timestamp,
      });
      eventBus.emit("videoIdChanged", videoId);
      eventBus.emit("videoTimeLineChanged", timestamp);
      eventBus.emit("videoEvidenceSelected", {
        videoId,
        panelType,
        overlayKey: overlay.key,
        modality: overlay.modality,
        timestamp,
        label: overlay.label,
        sourceItem: source,
      });
    },
    [getOverlayInteractionTime, openPanel, videoId],
  );

  const openTracebackForOverlay = React.useCallback(
    (overlay: OverlayBox, edit?: SelectedIndicationEdit) => {
      if (!videoId) {
        return;
      }
      const source = overlay.sourceItem || {};
      const timestamp = getOverlayInteractionTime(overlay);
      const sourceTrackId = source.trackId ?? source.track_id;
      const matureAuthority =
        source.bbox_mature_authority ||
        source.narrative_agent_recognition ||
        source.master_schema_mature_label ||
        source.manual_annotation;
      const manualAuthority = overlay.modality === "manual" || Boolean(source.manual_annotation);
      const payload = {
        videoId,
        sourcePanel: "VideoPanel",
        claim_id: `${videoId}:${overlay.key}`,
        claim_label: source.displayLabel || overlay.label,
        claim_type: overlay.modality,
        claim_status: manualAuthority
          ? "manual authority"
          : source.raw_detection_hidden ? "candidate" : "reviewable",
        maturity_level:
          manualAuthority ? "manual_annotation" :
          matureAuthority?.authority ||
          source.annotationCategory ||
          (source.raw_detection_hidden ? "narrative_agent_candidate" : "candidate"),
        confidence:
          manualAuthority ? 1 :
          typeof source.confidence === "number" ? Number(source.confidence) : null,
        authority_level:
          manualAuthority ? "manual_annotation" :
          matureAuthority?.authority ||
          (source.manual_annotation ? "manual_annotation" : "candidate"),
        authority_source:
          matureAuthority?.sourcePanel ||
          matureAuthority?.source ||
          source.sourceType ||
          "VideoPanel",
        review_status: source.raw_detection_hidden ? "requires analyst confirmation" : "reviewable",
        source_refs: {
          media_id: videoId,
          video_time: timestamp,
          time_range: edit ? { start: edit.start, end: edit.end } : undefined,
          bbox_id: sourceTrackId !== undefined && sourceTrackId !== null
            ? String(sourceTrackId)
            : overlay.key,
          roi_id: overlay.modality === "manual" ? overlay.key : undefined,
          annotation_id: source.manual_annotation?.id || source.id,
        },
        sourceItem: {
          ...source,
          label: overlay.label,
          evidence_refs: source.evidence_refs || matureAuthority?.evidence_refs,
          source_bbox_refs: source.source_bbox_refs || matureAuthority?.source_bbox_refs,
          source_frame_refs: source.source_frame_refs || matureAuthority?.source_frame_refs,
          traceback: source.traceback || matureAuthority?.traceback,
        },
      };
      openPanel("TracebackDrawer", { payload });
      eventBus.emit("tracebackOpenRequested", payload);
    },
    [getOverlayInteractionTime, openPanel, videoId],
  );

  const seedForensicRoiFromOverlay = React.useCallback(
    (overlay: OverlayBox, edit?: SelectedIndicationEdit) => {
      if (!videoId || !videoRef.current) {
        return;
      }
      const videoWidth = Math.max(1, videoRef.current.videoWidth || 1);
      const videoHeight = Math.max(1, videoRef.current.videoHeight || 1);
      const indication = edit || getSelectedIndicationEdit(overlay);
      const timestamp = clamp(indication.start, 0, duration || Number.MAX_SAFE_INTEGER);
      const endTimestamp = clamp(
        Math.max(indication.end, timestamp + 0.001),
        0,
        duration || Number.MAX_SAFE_INTEGER,
      );
      const intent: ForensicRoiIntent =
        indication.category === "OCR" || overlay.modality === "ocr"
          ? "ocr"
          : indication.category === "Expressions" || overlay.modality === "expression"
            ? "micro_expression"
            : indication.category === "Identification"
              ? "identification"
              : indication.category === "Movement"
                ? "movement"
                : indication.category === "Interaction"
                  ? "interaction"
                  : indication.category === "OBJ"
                    ? "object"
                    : "other";
      const normalizedRegion = getOverlayNormalizedBox(overlay);
      setDraftBox(normalizedRegion);
      const scopedTime = Number(timestamp.toFixed(3));
      setLockedForensicRoiBox({
        box: normalizedRegion,
        videoId,
        time: scopedTime,
      });
      setDraftTimestamp(scopedTime);
      openPanel("ToolsPanel", { videoId, workspace: "forensic" });
      eventBus.emit("toolsWorkspaceOpen", { workspace: "forensic", videoId });
      eventBus.emit("forensicRegionSelected", {
        videoId,
        time: Number(timestamp.toFixed(3)),
        time_start: Number(Math.max(0, timestamp).toFixed(3)),
        time_end: Number(Math.max(timestamp + 0.001, endTimestamp).toFixed(3)),
        intent,
        label: resolveIndicationLabel(indication.category, indication.label),
        region: {
          x: Math.round(normalizedRegion.x * videoWidth),
          y: Math.round(normalizedRegion.y * videoHeight),
          w: Math.round(normalizedRegion.w * videoWidth),
          h: Math.round(normalizedRegion.h * videoHeight),
        },
        normalizedRegion,
      });
    },
    [duration, getOverlayNormalizedBox, getSelectedIndicationEdit, openPanel, videoId],
  );

  const getAuthoritativeVideoTime = React.useCallback(() => {
    const videoTime = videoRef.current?.currentTime;
    return Number.isFinite(videoTime) ? Number(videoTime) : currentTime;
  }, [currentTime]);

  const resetNativeAnnotationDraft = React.useCallback(() => {
    setDraftBox(null);
    setLockedForensicRoiBox(null);
    setDraftStartPoint(null);
    setNativeAnnotationDraft({
      category: "OBJ",
      subcategory: "Object label",
      readyLabel: "",
      label: "",
      mediaGenreParent: analysisData?.metadata?.sourceAnnotations?.genre || "",
      situationalGenreParent:
        analysisData?.metadata?.sourceAnnotations?.situational_genre || "",
      identityAffirmation: "",
      roleAffirmation: "",
      audioFoleyNote: "",
      openNote: "",
    });
  }, [
    analysisData?.metadata?.sourceAnnotations?.genre,
    analysisData?.metadata?.sourceAnnotations?.situational_genre,
  ]);

  const saveNativeVisualAnnotation = React.useCallback(async () => {
    const resolvedLabel =
      nativeAnnotationDraft.category === "Identification" &&
      (nativeAnnotationDraft.identityAffirmation.trim() ||
        nativeAnnotationDraft.label.trim())
        ? nativeAnnotationDraft.identityAffirmation.trim() ||
          nativeAnnotationDraft.label.trim()
        : nativeAnnotationDraft.readyLabel &&
      nativeAnnotationDraft.readyLabel !== CUSTOM_LABEL_VALUE
        ? nativeAnnotationDraft.readyLabel
        : nativeAnnotationDraft.label.trim();
    if (!videoId || !draftBox || !resolvedLabel.trim()) {
      return;
    }

    const annotationTimestamp = Number(
      (draftTimestamp ?? getAuthoritativeVideoTime()).toFixed(3),
    );
    const annotation: ManualVisualAnnotation = {
      id: `${videoId}:${Date.now()}`,
      category: nativeAnnotationDraft.category,
      subcategory: nativeAnnotationDraft.subcategory,
      label: resolvedLabel.trim(),
      custom_label:
        nativeAnnotationDraft.readyLabel === CUSTOM_LABEL_VALUE
          ? nativeAnnotationDraft.label.trim()
          : undefined,
      geometry_type: "box",
      coordinates: draftBox,
      geometry_keyframes: [
        {
          time: annotationTimestamp,
          coordinates: normalizeDraftBox(draftBox),
          source: "manual",
          updated_at: new Date().toISOString(),
        },
      ],
      timestamp_seconds: annotationTimestamp,
      start_seconds: annotationTimestamp,
      end_seconds: annotationTimestamp,
      identity_affirmation: nativeAnnotationDraft.identityAffirmation.trim() || undefined,
      role_affirmation: nativeAnnotationDraft.roleAffirmation.trim() || undefined,
      audio_foley_note: nativeAnnotationDraft.audioFoleyNote.trim() || undefined,
      open_note: nativeAnnotationDraft.openNote.trim() || undefined,
      metadata_correlation: null,
      teaches_regime: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: "analyst",
    };

    const existingCorrections = analysisData?.annotationCorrections;
    const nextCorrections = upsertManualVisualAnnotation(
      existingCorrections,
      annotation,
    );
    pushCorrectionSnapshot(videoId, existingCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    jumpToTime(annotationTimestamp);
    setNativeAnnotationMode(false);
    setSelectedWorkspaceAnnotationId(annotation.id);
    setSelectedOverlayKey(`manual-${annotation.id}`);
    const savedDetail = (
      annotation.identity_affirmation ||
      annotation.role_affirmation ||
      annotation.custom_label ||
      ""
    ).trim();
    setNativeSaveMessage(
      savedDetail
        ? `Saved native annotation: ${annotation.category} / ${annotation.label} / ${savedDetail}`
        : `Saved native annotation: ${annotation.category} / ${annotation.label}`,
    );
    resetNativeAnnotationDraft();
    broadcastAnalysisCorrectionRefresh(videoId);
  }, [
    analysisData?.annotationCorrections,
    draftBox,
    draftTimestamp,
    getAuthoritativeVideoTime,
    jumpToTime,
    nativeAnnotationDraft,
    resetNativeAnnotationDraft,
    videoId,
  ]);

  const removeNativeVisualAnnotation = React.useCallback(async () => {
    if (!videoId || !selectedOverlay || selectedOverlay.modality !== "manual") {
      return;
    }
    const annotation = selectedOverlay.sourceItem as ManualVisualAnnotation | undefined;
    if (!annotation?.id) {
      return;
    }
    const existingCorrections = analysisData?.annotationCorrections;
    const nextCorrections = removeManualVisualAnnotation(
      existingCorrections,
      annotation.id,
    );
    pushCorrectionSnapshot(videoId, existingCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setSelectedOverlayKey(null);
    setNativeSaveMessage("Removed native annotation.");
    broadcastAnalysisCorrectionRefresh(videoId);
  }, [analysisData?.annotationCorrections, selectedOverlay, videoId]);

  const saveSelectedIndication = React.useCallback(
    async (overlay: OverlayBox, edit: SelectedIndicationEdit) => {
      if (!videoId || !videoRef.current) {
        return;
      }
      const applyScope = edit.applyScope || "this_interval_only";
      const scopeRequiresConfirmation = BBOX_ROI_APPLY_SCOPE_OPTIONS.some(
        (option) => option.value === applyScope && option.dangerous,
      );
      if (
        scopeRequiresConfirmation &&
        !window.confirm(
          "Apply this BBox/ROI correction beyond the current interval? This can affect a wider track or Narrative Agent family.",
        )
      ) {
        return;
      }
      const label = resolveIndicationLabel(edit.category, edit.label);
      const source = overlay.sourceItem || {};
      const expressionPersonAnchor =
        edit.category === "Identification" ? findExpressionPersonAnchor(overlay) : null;
      const expressionTimestamp = getOverlayTimestamp(overlay);
      const expressionBox = getOverlayNormalizedBox(overlay);
      const synthesizedExpressionOwnerBox =
        overlay.modality === "expression" &&
        edit.category === "Identification" &&
        !expressionPersonAnchor
          ? synthesizePersonBoxFromExpression(expressionBox)
          : null;
      const expressionOwnerTargetId = synthesizedExpressionOwnerBox
        ? `expression-owner:${overlay.key}`
        : null;
      const rawStart =
        overlay.modality === "expression" && edit.category === "Identification"
          ? Math.min(edit.start, expressionTimestamp - EXPRESSION_IDENTITY_ANCHOR_WINDOW_SECONDS)
          : edit.start;
      const rawEnd =
        overlay.modality === "expression" && edit.category === "Identification"
          ? Math.max(edit.end, expressionTimestamp + EXPRESSION_IDENTITY_ANCHOR_WINDOW_SECONDS)
          : edit.end;
      const anchorStart =
        expressionPersonAnchor && typeof expressionPersonAnchor.item.startTimestamp === "number"
          ? expressionPersonAnchor.item.startTimestamp
          : expressionPersonAnchor && typeof expressionPersonAnchor.item.timestamp === "number"
            ? expressionPersonAnchor.item.timestamp
            : null;
      const anchorEnd =
        expressionPersonAnchor && typeof expressionPersonAnchor.item.endTimestamp === "number"
          ? expressionPersonAnchor.item.endTimestamp
          : expressionPersonAnchor && typeof expressionPersonAnchor.item.timestamp === "number"
            ? expressionPersonAnchor.item.timestamp
            : null;
      const anchorHasInterval =
        Number.isFinite(anchorStart) &&
        Number.isFinite(anchorEnd) &&
        Math.abs(Number(anchorEnd) - Number(anchorStart)) > 0.1;
      const boundedStart =
        expressionPersonAnchor && anchorHasInterval
          ? Math.max(rawStart, Number(anchorStart))
          : rawStart;
      const boundedEnd =
        expressionPersonAnchor && anchorHasInterval
          ? Math.min(rawEnd, Number(anchorEnd))
          : rawEnd;
      const start = clamp(
        Math.min(boundedStart, boundedEnd),
        0,
        duration || Number.MAX_SAFE_INTEGER,
      );
      const end = clamp(
        Math.max(boundedEnd, start + 0.001),
        0,
        duration || Number.MAX_SAFE_INTEGER,
      );
      const targetTrackId = String(
        expressionPersonAnchor?.trackId ??
          expressionOwnerTargetId ??
          source.trackId ??
          source.track_id ??
          (overlay.modality === "manual"
            ? manualObjectTargetId(overlay.sourceItem as ManualVisualAnnotation)
            : null) ??
          "",
      ).trim();
      const annotationId =
        overlay.modality === "manual"
          ? (overlay.sourceItem as ManualVisualAnnotation | undefined)?.id ||
            `${videoId}:indication:${overlay.modality}:${overlay.key}`
          : expressionPersonAnchor
            ? `${videoId}:indication:expression-agent:${targetTrackId || "untracked"}:${overlay.key}`
            : expressionOwnerTargetId
              ? `${videoId}:indication:${expressionOwnerTargetId}`
            : `${videoId}:indication:${overlay.modality}:${source.trackId ?? source.track_id ?? overlay.key}`;
      const existingManual =
        allManualVisualAnnotations.find((item) => item.id === annotationId) ||
        (overlay.modality === "manual"
          ? (overlay.sourceItem as ManualVisualAnnotation | undefined)
          : undefined);
      const normalizedBox = expressionPersonAnchor?.box || synthesizedExpressionOwnerBox || expressionBox;
      const keyframeTime = clamp(
        getOverlayInteractionTime(overlay),
        start,
        end,
      );
      const trackKeyframes = buildTrackGeometryKeyframes(targetTrackId || null);
      const geometryKeyframes = mergeGeometryKeyframes([
        ...(existingManual?.geometry_keyframes || []),
        ...trackKeyframes,
        {
          time: Number(keyframeTime.toFixed(3)),
          coordinates: normalizeDraftBox(normalizedBox),
          source: "manual",
          updated_at: new Date().toISOString(),
        },
      ]);
      const annotation: ManualVisualAnnotation = {
        ...(existingManual || {}),
        id: annotationId,
        category: edit.category,
        subcategory: edit.subcategory || getFirstSubcategoryForCategory(edit.category),
        label,
        custom_label: edit.label.trim() || undefined,
        geometry_type: "box",
        coordinates: {
          x: clamp(normalizedBox.x, 0, 1),
          y: clamp(normalizedBox.y, 0, 1),
          w: clamp(normalizedBox.w, 0.002, 1),
          h: clamp(normalizedBox.h, 0.002, 1),
        },
        geometry_keyframes: geometryKeyframes,
        timestamp_seconds: Number(start.toFixed(3)),
        start_seconds: Number(start.toFixed(3)),
        end_seconds: Number(end.toFixed(3)),
        identity_affirmation:
          edit.category === "Identification"
            ? (edit.identityAffirmation.trim() || label)
            : edit.identityAffirmation.trim() || undefined,
        role_affirmation:
          edit.category === "Role" ? edit.label.trim() || undefined : undefined,
        audio_foley_note: existingManual?.audio_foley_note,
        open_note: edit.note.trim() || existingManual?.open_note,
        metadata_correlation: {
          ...(existingManual?.metadata_correlation || {}),
          target_type:
            expressionPersonAnchor || synthesizedExpressionOwnerBox ? "object" : overlay.modality,
          target_id: String(
            expressionPersonAnchor?.trackId ??
              expressionOwnerTargetId ??
              source.trackId ??
              source.track_id ??
              overlay.key,
          ),
          target_label: expressionPersonAnchor || synthesizedExpressionOwnerBox
            ? String(
                expressionPersonAnchor?.item.displayLabel ||
                  expressionPersonAnchor?.item.class_name ||
                  expressionPersonAnchor?.item.raw_class_name ||
                  "person",
              )
            : overlay.label,
          source_expression_key:
            overlay.modality === "expression" ? overlay.key : undefined,
          source_expression_label:
            overlay.modality === "expression" ? overlay.label : undefined,
          source_expression_timestamp:
            overlay.modality === "expression"
              ? Number(expressionTimestamp.toFixed(3))
              : undefined,
          source_expression_owner_request: Boolean(synthesizedExpressionOwnerBox),
          synthesized_person_detection: Boolean(synthesizedExpressionOwnerBox),
          apply_scope: applyScope,
          quick_annotations: edit.quickAnnotations || [],
          manual_confirmation_event: {
            event_type: "manual_bbox_roi_confirmation",
            authority_level: "manual_correction",
            active_state_after_save: {
              start_seconds: Number(start.toFixed(3)),
              end_seconds: Number(end.toFixed(3)),
              label,
              category: edit.category,
              quick_annotations: edit.quickAnnotations || [],
            },
            old_states_retained_as: "traceback_provenance",
            propagation_required: true,
          },
          maturity_policy:
            overlay.modality === "expression"
              ? "narrative_agent_maturity.expression_owner_person_request"
              : undefined,
          relation: "extends",
          note: synthesizedExpressionOwnerBox
            ? "Expression had no mature person bbox; initiated an expression-owner person detection request."
            : "Adopted from video overlay indication editor.",
        },
        teaches_regime: true,
        created_at: existingManual?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: "analyst",
      };

      const existingCorrections = analysisData?.annotationCorrections;
      const nextCorrections = upsertManualVisualAnnotation(
        existingCorrections,
        annotation,
      );
      pushCorrectionSnapshot(videoId, existingCorrections);
      await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
      const refreshed = await VideoService.refreshAnalysis(videoId);
      setAnalysisData(refreshed);
      closeSelectedOverlayEditor(overlay.key);
      clearOverlayEditingWorkspace([overlay.key, `manual-${annotation.id}`]);
      setSelectedIndicationEdits((current) => ({
        ...current,
        [`manual-${annotation.id}`]: edit,
      }));
      setNativeSaveMessage(`Saved indication: ${annotation.category} / ${label}`);
      if (synthesizedExpressionOwnerBox) {
        eventBus.emit("expressionOwnerPersonDetectionRequested", {
          videoId,
          overlayKey: overlay.key,
          annotationId: annotation.id,
          targetId: expressionOwnerTargetId,
          label,
          bbox: synthesizedExpressionOwnerBox,
          timestamp: Number(expressionTimestamp.toFixed(3)),
          maturityPolicy: "narrative_agent_maturity.expression_owner_person_request",
        });
      }
      eventBus.emit("videoEvidenceSelected", {
        videoId,
        panelType: MANUAL_CATEGORY_PANEL_MAP[annotation.category] || "MasterSchema",
        overlayKey: `manual-${annotation.id}`,
        modality: "manual",
        timestamp: start,
        label,
        sourceItem: annotation,
      });
      broadcastAnalysisCorrectionRefresh(videoId);
    },
    [
      analysisData?.annotationCorrections,
      allManualVisualAnnotations,
      buildTrackGeometryKeyframes,
      clearOverlayEditingWorkspace,
      closeSelectedOverlayEditor,
      duration,
      findExpressionPersonAnchor,
      getOverlayInteractionTime,
      getOverlayNormalizedBox,
      getOverlayTimestamp,
      videoId,
    ],
  );

  const saveSelectedIndicationAtFrame = React.useCallback(
    async (
      overlay: OverlayBox,
      edit: SelectedIndicationEdit,
      frameTime: number,
    ) => {
      const safeFrameTime = clamp(
        frameTime,
        0,
        duration || Number.MAX_SAFE_INTEGER,
      );
      const stretchedEdit = {
        ...edit,
        start: Math.min(edit.start, safeFrameTime),
        end: Math.max(edit.end, safeFrameTime, edit.start + 0.001),
      };
      await saveSelectedIndication(overlay, stretchedEdit);
    },
    [duration, saveSelectedIndication],
  );

  const buildNormalizedDraftPoint = React.useCallback(
    (clientX: number, clientY: number) => {
      const overlayElement = nativeOverlayRef.current;
      if (!overlayElement) {
        return null;
      }
      const rect = overlayElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      return { x, y };
    },
    [],
  );

  const handleNativeAnnotationPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!nativeAnnotationMode && !forensicRoiMode) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      videoRef.current?.pause();
      const point = buildNormalizedDraftPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      setSelectedOverlayKey(null);
      setDraftTimestamp(Number(getAuthoritativeVideoTime().toFixed(3)));

      const activeForensicBox = draftBox || visibleLockedForensicRoiBox;
      const pointerInsideActiveBox =
        forensicRoiMode &&
        activeForensicBox &&
        point.x >= activeForensicBox.x &&
        point.x <= activeForensicBox.x + activeForensicBox.w &&
        point.y >= activeForensicBox.y &&
        point.y <= activeForensicBox.y + activeForensicBox.h;

      if (pointerInsideActiveBox && activeForensicBox) {
        setDraftBox(activeForensicBox);
        setLockedForensicRoiBox(null);
        setDraftStartPoint(null);
        setForensicRoiDragOffset({
          x: point.x - activeForensicBox.x,
          y: point.y - activeForensicBox.y,
        });
        return;
      }

      setForensicRoiDragOffset(null);
      setLockedForensicRoiBox(null);
      setDraftStartPoint(point);
      setDraftBox({ x: point.x, y: point.y, w: 0, h: 0 });
    },
    [
      buildNormalizedDraftPoint,
      draftBox,
      forensicRoiMode,
      getAuthoritativeVideoTime,
      nativeAnnotationMode,
      visibleLockedForensicRoiBox,
    ],
  );

  const handleNativeAnnotationPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!nativeAnnotationMode && !forensicRoiMode) {
        return;
      }
      event.preventDefault();
      const point = buildNormalizedDraftPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      if (forensicRoiMode && forensicRoiDragOffset && draftBox) {
        setDraftBox({
          ...draftBox,
          x: clamp(point.x - forensicRoiDragOffset.x, 0, Math.max(0, 1 - draftBox.w)),
          y: clamp(point.y - forensicRoiDragOffset.y, 0, Math.max(0, 1 - draftBox.h)),
        });
        return;
      }
      if (!draftStartPoint) {
        return;
      }
      setDraftBox(
        buildBoxFromPoints(
          draftStartPoint.x,
          draftStartPoint.y,
          point.x,
          point.y,
        ),
      );
    },
    [
      buildNormalizedDraftPoint,
      draftBox,
      draftStartPoint,
      forensicRoiDragOffset,
      forensicRoiMode,
      nativeAnnotationMode,
    ],
  );

  const handleNativeAnnotationPointerUp = React.useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    event?.preventDefault();
    if (event?.currentTarget && event.pointerId !== undefined) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    if (!draftBox || draftBox.w < 0.01 || draftBox.h < 0.01) {
      setDraftBox(null);
      setDraftTimestamp(null);
      setDraftStartPoint(null);
      setForensicRoiDragOffset(null);
      return;
    }

    if (forensicRoiMode && videoId) {
      const videoElement = videoRef.current;
      const naturalWidth = Math.max(1, videoElement?.videoWidth || 1);
      const naturalHeight = Math.max(1, videoElement?.videoHeight || 1);
      const selectedTime = Number(
        (draftTimestamp ?? getAuthoritativeVideoTime()).toFixed(3),
      );
      const intentLabel =
        FORENSIC_ROI_INTENT_OPTIONS.find((option) => option.value === forensicRoiIntent)
          ?.label || forensicRoiIntent;
      const payload: ForensicRegionSelectedPayload = {
        videoId,
        time: selectedTime,
        intent: forensicRoiIntent,
        label: `${intentLabel} ROI`,
        region: {
          x: Math.round(draftBox.x * naturalWidth),
          y: Math.round(draftBox.y * naturalHeight),
          w: Math.round(draftBox.w * naturalWidth),
          h: Math.round(draftBox.h * naturalHeight),
        },
        normalizedRegion: draftBox,
      };
      eventBus.emit("forensicRegionSelected", payload);
      setLockedForensicRoiBox({
        box: draftBox,
        videoId,
        time: selectedTime,
      });
      setForensicRoiMode(false);
    }
    setDraftStartPoint(null);
    setForensicRoiDragOffset(null);
  }, [
    draftBox,
    draftTimestamp,
    forensicRoiDragOffset,
    forensicRoiIntent,
    forensicRoiMode,
    getAuthoritativeVideoTime,
    videoId,
  ]);

  const handleForensicRoiContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!forensicRoiMode && !visibleLockedForensicRoiBox && !draftBox) {
        return;
      }
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      setForensicRoiMenu({
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
      });
    },
    [draftBox, forensicRoiMode, visibleLockedForensicRoiBox],
  );

  const chooseForensicRoiIntent = React.useCallback((intent: ForensicRoiIntent) => {
    setForensicRoiIntent(intent);
    setForensicRoiMenu(null);
    eventBus.emit("forensicRoiIntentSelected", { intent });
  }, []);

  const handleForensicRoiWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!forensicRoiMode) {
        return;
      }
      event.preventDefault();
      const direction = event.deltaY > 0 ? 1 : -1;
      nudgeTime(direction * 0.04);
    },
    [forensicRoiMode, nudgeTime],
  );

  const saveObjectBBoxCorrection = React.useCallback(async () => {
    if (!videoId || !selectedOverlay || selectedOverlay.modality !== "object") {
      return;
    }
    const obj = selectedOverlay.sourceItem;
    const rawValue = obj?.raw_class_name || obj?.class_name || selectedOverlay.label;
    if (!rawValue) {
      return;
    }
    const suggested = Array.from(
      new Set(
        groupedDetectedObjects
          .map((item: any) => item.raw_class_name || item.class_name || item.displayLabel)
          .filter(Boolean),
      ),
    )
      .sort()
      .slice(0, 12);
    const correctedValue = window.prompt(
      `Correct bbox label:\n${rawValue}\n\nLikely labels: ${suggested.join(", ")}`,
      selectedOverlay.label || rawValue,
    );
    if (!correctedValue || correctedValue.trim() === selectedOverlay.label?.trim()) {
      return;
    }
    const existingCorrections = analysisData?.annotationCorrections;
    const filteredOverrides = (existingCorrections?.label_overrides || []).filter(
      (rule: any) =>
        !(
          rule?.modality === "object" &&
          String(rule?.raw_value || "").trim().toLowerCase() ===
            String(rawValue).trim().toLowerCase() &&
          rule?.target_timestamp === undefined &&
          rule?.target_start_timestamp === undefined &&
          rule?.target_end_timestamp === undefined &&
          rule?.target_track_id === undefined
        ),
    );
    const nextCorrections = mergeCorrectionRule(
      {
        ...(existingCorrections || {}),
        label_overrides: filteredOverrides,
      },
      buildCorrectionRule("object", rawValue, correctedValue.trim(), "", {
        targetTimestamp: obj.timestamp,
        targetStartTimestamp: obj.startTimestamp ?? obj.timestamp,
        targetEndTimestamp: obj.endTimestamp ?? obj.timestamp,
        targetTrackId: obj.trackId,
      }),
    );
    pushCorrectionSnapshot(videoId, existingCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setSelectedOverlayKey(null);
    broadcastAnalysisCorrectionRefresh(videoId);
  }, [analysisData?.annotationCorrections, groupedDetectedObjects, selectedOverlay, videoId]);

  const dropObjectBBoxDetection = React.useCallback(async () => {
    if (!videoId || !selectedOverlay || selectedOverlay.modality !== "object") {
      return;
    }
    const obj = selectedOverlay.sourceItem;
    const rawValue = obj?.raw_class_name || obj?.class_name || selectedOverlay.label;
    if (!rawValue) {
      return;
    }
    const nextCorrections = mergeCorrectionRule(
      analysisData?.annotationCorrections,
      buildDropCorrectionRule("object", rawValue, {
        targetTimestamp: obj.timestamp,
        targetStartTimestamp: obj.startTimestamp ?? obj.timestamp,
        targetEndTimestamp: obj.endTimestamp ?? obj.timestamp,
        targetTrackId: obj.trackId,
      }),
    );
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setSelectedOverlayKey(null);
    broadcastAnalysisCorrectionRefresh(videoId);
  }, [analysisData?.annotationCorrections, selectedOverlay, videoId]);

  const transcriptMarkers = useMemo(
    () => dedupeTimelinePoints(transcript.map((segment) => segment.start), duration),
    [duration, transcript],
  );
  const objectMarkers = useMemo(
    () =>
      dedupeTimelinePoints(
        groupedDetectedObjects.map((item) => item.timestamp),
        duration,
      ),
    [duration, groupedDetectedObjects],
  );
  const ocrMarkers = useMemo(
    () => dedupeTimelinePoints(ocrResults.map((item) => item.timestamp), duration),
    [duration, ocrResults],
  );
  const expressionMarkers = useMemo(
    () =>
      dedupeTimelinePoints(expressionResults.map((item) => item.timestamp), duration),
    [duration, expressionResults],
  );
  const audioTimelineMarkers = useMemo(() => {
    const markers: AudioTimelineMarker[] = [];
    let lastEnvironmentLabel: string | null = null;

    for (const cue of audioProsody) {
      const cueTime = typeof cue.start === "number" ? cue.start : undefined;
      if (cueTime === undefined) {
        continue;
      }

      const roleSupport = cue.interaction_cues?.role_support?.trim() || null;
      const turnTransition = cue.turn_structure?.transition?.trim() || null;
      const environmentLabel = cue.sound_environment?.label?.trim() || null;
      const emphasisScore = cue.emphasis?.score ?? 0;

      if (
        roleSupport &&
        (roleSupport.includes("floor opening") ||
          roleSupport.includes("possible interruption") ||
          roleSupport.includes("turn reset"))
      ) {
        markers.push({
          key: `audio-role-${cue.cue_id}`,
          time: cueTime,
          label: "Role cue",
          detail: roleSupport,
          colorClass: "bg-teal-300/85",
        });
      }

      if (cue.turn_structure?.overlap_cue) {
        markers.push({
          key: `audio-overlap-${cue.cue_id}`,
          time: cueTime,
          label: "Overlap",
          detail: turnTransition || "possible overlap",
          colorClass: "bg-rose-300/85",
        });
      } else if (cue.turn_structure?.likely_turn_boundary) {
        markers.push({
          key: `audio-turn-${cue.cue_id}`,
          time: cueTime,
          label: "Turn",
          detail: turnTransition || "speaker-change window",
          colorClass: "bg-sky-300/85",
        });
      }

      if (emphasisScore >= 0.75) {
        markers.push({
          key: `audio-emphasis-${cue.cue_id}`,
          time: cueTime,
          label: "Emphasis",
          detail: cue.emphasis?.label || "strong emphasis",
          colorClass: "bg-amber-300/90",
        });
      }

      if (environmentLabel && environmentLabel !== lastEnvironmentLabel) {
        markers.push({
          key: `audio-environment-${cue.cue_id}`,
          time: cueTime,
          label: "Environment",
          detail: environmentLabel,
          colorClass: "bg-emerald-300/80",
        });
        lastEnvironmentLabel = environmentLabel;
      }
    }

    return dedupeAudioTimelineMarkers(markers, duration);
  }, [audioProsody, duration]);

  const compareDelta =
    singleSourceMarks.a !== undefined && singleSourceMarks.b !== undefined
      ? Math.abs(singleSourceMarks.b - singleSourceMarks.a)
      : null;

  const displayName = metadata?.name || "Selected analysis";
  const subtleState = metadata?.status
    ? metadata.processingTime !== undefined
      ? `${metadata.status} • ${metadata.processingTime}s`
      : metadata.status
    : null;

  const sourceCueBits = [
    duration ? `Duration ${formatTime(duration)}` : null,
    videoRef.current?.videoWidth && videoRef.current?.videoHeight
      ? `${videoRef.current.videoWidth}×${videoRef.current.videoHeight}`
      : null,
    metadata?.sourceVideoExists === false ? "Source missing" : null,
    metadata?.sourceVideoPath ? "Source linked" : null,
  ].filter(Boolean) as string[];

  const shotSizeSummary =
    analysisData?.metadata?.cinematicClues?.shotSize?.summary || fallbackShotSizeSummary;
  const shotSizeSamples =
    analysisData?.metadata?.cinematicClues?.shotSize?.samples || fallbackShotSizeSamples;
  const correctedCurrentShotSample = useMemo(() => {
    if (!shotSizeSamples.length) {
      return null;
    }
    const nearby = [...shotSizeSamples]
      .filter((sample) => Math.abs((sample.timestamp ?? 0) - currentTime) <= 0.35)
      .sort((left, right) => {
        const leftDistance = Math.abs((left.timestamp ?? 0) - currentTime);
        const rightDistance = Math.abs((right.timestamp ?? 0) - currentTime);
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
        return (left.timestamp ?? 0) - (right.timestamp ?? 0);
      });
    return nearby[0] || null;
  }, [currentTime, shotSizeSamples]);
  const currentShotSizeEstimate = useMemo(() => {
    if (correctedCurrentShotSample?.label) {
      return {
        label: correctedCurrentShotSample.label,
        person_count: correctedCurrentShotSample.person_count ?? 0,
        timestamp: correctedCurrentShotSample.timestamp ?? currentTime,
      };
    }
    const people = rawDetectedObjects.filter((item) => {
      if ((item.class_name || item.raw_class_name || "").toLowerCase() !== "person") {
        return false;
      }
      if ((item.confidence || 0) < getObjectOverlayConfidenceThreshold("person")) {
        return false;
      }
      return Math.abs((item.timestamp || 0) - currentTime) <= 0.12;
    });
    if (people.length === 0) {
      return {
        label: "no human framing",
        person_count: 0,
        timestamp: currentTime,
      };
    }
    const dominant = people.reduce((best, current) => {
      const bestBox = best.bbox || {};
      const currentBox = current.bbox || {};
      const bestArea =
        Math.max(0, (bestBox.x2 ?? 0) - (bestBox.x1 ?? 0)) *
        Math.max(0, (bestBox.y2 ?? 0) - (bestBox.y1 ?? 0));
      const currentArea =
        Math.max(0, (currentBox.x2 ?? 0) - (currentBox.x1 ?? 0)) *
        Math.max(0, (currentBox.y2 ?? 0) - (currentBox.y1 ?? 0));
      return currentArea > bestArea ? current : best;
    }, people[0]);
    const box = dominant.bbox || {};
    const width = Math.max(0, (box.x2 ?? 0) - (box.x1 ?? 0));
    const height = Math.max(0, (box.y2 ?? 0) - (box.y1 ?? 0));
    return {
      label: classifyShotSize(
        height / Math.max(videoHeight, 1),
        width / Math.max(videoWidth, 1),
      ),
      person_count: people.length,
      timestamp: currentTime,
    };
  }, [correctedCurrentShotSample, currentTime, rawDetectedObjects, videoHeight, videoWidth]);
  const nearbyShotSizeSamples = useMemo(
    () =>
      [...shotSizeSamples]
        .filter((sample) => Math.abs((sample.timestamp ?? 0) - currentTime) <= 2.0)
        .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0))
        .slice(0, 8),
    [currentTime, shotSizeSamples],
  );
  const currentToneSample = useMemo(() => {
    const samples = analysisData?.metadata?.spatialToneScan?.samples || [];
    if (samples.length === 0) {
      return liveToneSample;
    }
    return [...samples].sort((left, right) => {
      const leftDistance = Math.abs((left.timestamp ?? 0) - currentTime);
      const rightDistance = Math.abs((right.timestamp ?? 0) - currentTime);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      return (left.timestamp ?? 0) - (right.timestamp ?? 0);
    })[0];
  }, [analysisData?.metadata?.spatialToneScan?.samples, currentTime, liveToneSample]);
  const currentSpatialScan = useMemo(() => {
    const zoneCounts = new Map<string, { people: number; text: number; objects: number; occupancy?: number }>();
    const ensureZone = (zone: string) => {
      if (!zoneCounts.has(zone)) {
        zoneCounts.set(zone, { people: 0, text: 0, objects: 0, occupancy: undefined });
      }
      return zoneCounts.get(zone)!;
    };

    for (const item of activeRawObjects) {
      const box = item.bbox || {};
      if (
        box.x1 === undefined ||
        box.y1 === undefined ||
        box.x2 === undefined ||
        box.y2 === undefined
      ) {
        continue;
      }
      const zone = zoneForPoint(
        (box.x1 + box.x2) / 2,
        (box.y1 + box.y2) / 2,
        videoWidth,
        videoHeight,
      );
      const bucket = ensureZone(zone);
      if (item.class_name === "person") {
        bucket.people += 1;
      } else {
        bucket.objects += 1;
      }
    }

    for (const item of activeOCR) {
      const box = item.bbox || {};
      if (
        box.x === undefined ||
        box.y === undefined ||
        box.w === undefined ||
        box.h === undefined
      ) {
        continue;
      }
      const zone = zoneForPoint(
        box.x + box.w / 2,
        box.y + box.h / 2,
        videoWidth,
        videoHeight,
      );
      ensureZone(zone).text += 1;
    }

    const entries = Array.from(zoneCounts.entries())
      .map(([zone, counts]) => ({ zone, ...counts }))
      .filter((entry) => entry.people || entry.text || entry.objects)
      .sort(
        (left, right) =>
          right.people + right.text + right.objects - (left.people + left.text + left.objects),
      );

    if (currentToneSample?.zones) {
      for (const [zone, zoneData] of Object.entries(currentToneSample.zones)) {
        ensureZone(zone).occupancy = zoneData?.occupancy_mass;
      }
    }

    return {
      entries: entries.slice(0, 6),
    };
  }, [activeOCR, activeRawObjects, currentToneSample, videoHeight, videoWidth]);
  const currentFrameClass = useMemo(() => {
    if (currentToneSample?.frame_class) {
      return currentToneSample.frame_class;
    }

    const people = currentSpatialScan.entries.reduce((sum, entry) => sum + entry.people, 0);
    const text = currentSpatialScan.entries.reduce((sum, entry) => sum + entry.text, 0);
    const objects = currentSpatialScan.entries.reduce((sum, entry) => sum + entry.objects, 0);

    if (people > 0) {
      return "human-centered";
    }
    if (text > 0 && objects === 0) {
      return "graphic";
    }
    if (objects > 0 || text > 0) {
      return "mixed";
    }
    return "scene-centered";
  }, [currentSpatialScan.entries, currentToneSample]);
  const currentTextGraphicScan = useMemo(() => {
    const entries = activeOCR
      .map((item) => {
        const box = item.bbox || {};
        if (
          box.x === undefined ||
          box.y === undefined ||
          box.w === undefined ||
          box.h === undefined
        ) {
          return null;
        }
        const centerX = box.x + box.w / 2;
        const centerY = box.y + box.h / 2;
        const zone = zoneForPoint(centerX, centerY, videoWidth, videoHeight);
        const lowerBand = centerY > videoHeight * 0.7;
        const upperBand = centerY < videoHeight * 0.22;
        const cornerLike =
          (centerX < videoWidth * 0.18 || centerX > videoWidth * 0.82) &&
          (centerY < videoHeight * 0.22 || centerY > videoHeight * 0.78);
        return {
          text: item.text,
          zone,
          subtitleLike: lowerBand && box.w >= videoWidth * 0.18,
          titleLike: upperBand && box.w >= videoWidth * 0.16,
          cornerLike,
        };
      })
      .filter(Boolean) as Array<{
      text: string;
      zone: string;
      subtitleLike: boolean;
      titleLike: boolean;
      cornerLike: boolean;
    }>;

    const zoneCounts = new Map<string, number>();
    for (const entry of entries) {
      zoneCounts.set(entry.zone, (zoneCounts.get(entry.zone) || 0) + 1);
    }

    return {
      textPresent: entries.length > 0,
      subtitleLikeCount: entries.filter((entry) => entry.subtitleLike).length,
      titleLikeCount: entries.filter((entry) => entry.titleLike).length,
      cornerLikeCount: entries.filter((entry) => entry.cornerLike).length,
      zoneDistribution: Array.from(zoneCounts.entries()).sort((left, right) => right[1] - left[1]),
      samples: entries.slice(0, 8),
    };
  }, [activeOCR, videoHeight, videoWidth]);
  const currentDepthScan = useMemo(() => {
    const entries = activeRawObjects
      .map((item) => {
        const box = item.bbox || {};
        if (
          box.x1 === undefined ||
          box.y1 === undefined ||
          box.x2 === undefined ||
          box.y2 === undefined
        ) {
          return null;
        }
        const width = Math.max(0, box.x2 - box.x1);
        const height = Math.max(0, box.y2 - box.y1);
        const areaShare = (width * height) / Math.max(videoWidth * videoHeight, 1);
        const baseLayer =
          areaShare >= 0.12
            ? "foreground"
            : areaShare >= 0.04
              ? "midground"
              : "background";
        const adjustedLayer =
          box.y2 >= videoHeight * 0.72 && baseLayer !== "background"
            ? baseLayer
            : box.y2 <= videoHeight * 0.38 && baseLayer === "foreground"
              ? "midground"
              : baseLayer;
        return {
          label: item.class_name,
          layer: adjustedLayer,
          areaShare,
        };
      })
      .filter(Boolean) as Array<{ label: string; layer: string; areaShare: number }>;

    const counts = { foreground: 0, midground: 0, background: 0 };
    for (const entry of entries) {
      if (entry.layer === "foreground") counts.foreground += 1;
      if (entry.layer === "midground") counts.midground += 1;
      if (entry.layer === "background") counts.background += 1;
    }

    return {
      counts,
      entries: entries.slice(0, 8),
    };
  }, [activeRawObjects, videoHeight, videoWidth]);
  const toneScanSummary = analysisData?.metadata?.spatialToneScan?.summary;
  const toneScanZones =
    currentToneSample?.zones ||
    Object.fromEntries(
      Object.entries(toneScanSummary?.dominant_tone_by_zone || {}).map(([zone, tone]) => [
        zone,
        {
          dominant_tone: tone,
          brightness_band: "mid",
          saturation_band: "moderate",
          brightness_value: undefined,
        },
      ]),
    );
  const currentLightingScan = useMemo(() => {
    const zones = Object.values(toneScanZones || {});
    if (zones.length === 0) {
      return {
        available: false,
        brightness: "unknown",
        contrast: "unknown",
        spread: { dark: 0, mid: 0, bright: 0 },
        avgBrightness: null,
        brightnessRange: null,
      };
    }

    const spread = { dark: 0, mid: 0, bright: 0 };
    const brightnessValues: number[] = [];
    for (const zone of zones) {
      if (zone.brightness_band === "dark") spread.dark += 1;
      else if (zone.brightness_band === "bright") spread.bright += 1;
      else spread.mid += 1;
      if (typeof zone.brightness_value === "number") {
        brightnessValues.push(zone.brightness_value);
      }
    }

    const avgBrightness =
      brightnessValues.length > 0
        ? brightnessValues.reduce((sum, value) => sum + value, 0) / brightnessValues.length
        : null;
    const brightnessRange =
      brightnessValues.length > 0
        ? Math.max(...brightnessValues) - Math.min(...brightnessValues)
        : null;

    const brightness =
      avgBrightness === null
        ? spread.bright >= 4
          ? "bright"
          : spread.dark >= 4
            ? "low-key"
            : "balanced"
        : avgBrightness >= 175
          ? "bright"
          : avgBrightness <= 95
            ? "low-key"
            : "balanced";
    const contrast =
      brightnessRange === null
        ? spread.dark > 0 && spread.bright > 0
          ? "high contrast"
          : "even contrast"
        : brightnessRange >= 85
          ? "high contrast"
          : brightnessRange <= 35
            ? "soft contrast"
            : "even contrast";

    return {
      available: brightnessValues.length > 0 || zones.length > 0,
      brightness,
      contrast,
      spread,
      avgBrightness,
      brightnessRange,
    };
  }, [toneScanZones]);
  const currentHumanPresenceScan = useMemo(() => {
    const personCount = activeRawObjects.filter((item) => item.class_name === "person").length;
    const fallbackCount = activeRawObjects.filter(isFallbackPersonDetection).length;
    return {
      label:
        personCount === 0
          ? "no person"
          : personCount === 1
            ? "one person"
            : "multiple people",
      personCount,
      fallbackCount,
      faceVisibility: nearbyFaces.length > 0 ? "face visible" : "no clear face",
    };
  }, [activeRawObjects, nearbyFaces.length]);
  const currentMarginScan = useMemo(() => {
    const counts = { left_margin: 0, center: 0, right_margin: 0, upper_band: 0, lower_band: 0 };
    const items = [
      ...activeRawObjects.map((item) => ({
        x: (((item.bbox?.x1 ?? 0) + (item.bbox?.x2 ?? 0)) / 2),
        y: (((item.bbox?.y1 ?? 0) + (item.bbox?.y2 ?? 0)) / 2),
      })),
      ...activeOCR.map((item) => ({
        x: (item.bbox?.x ?? 0) + ((item.bbox?.w ?? 0) / 2),
        y: (item.bbox?.y ?? 0) + ((item.bbox?.h ?? 0) / 2),
      })),
    ];
    for (const item of items) {
      if (item.x < videoWidth * 0.18) counts.left_margin += 1;
      else if (item.x > videoWidth * 0.82) counts.right_margin += 1;
      else counts.center += 1;
      if (item.y < videoHeight * 0.28) counts.upper_band += 1;
      if (item.y > videoHeight * 0.72) counts.lower_band += 1;
    }
    return counts;
  }, [activeOCR, activeRawObjects, videoHeight, videoWidth]);
  const currentCornerScan = useMemo(() => {
    const counts = { upper_left: 0, upper_right: 0, lower_left: 0, lower_right: 0 };
    const items = [
      ...activeRawObjects.map((item) => ({
        x: (((item.bbox?.x1 ?? 0) + (item.bbox?.x2 ?? 0)) / 2),
        y: (((item.bbox?.y1 ?? 0) + (item.bbox?.y2 ?? 0)) / 2),
      })),
      ...activeOCR.map((item) => ({
        x: (item.bbox?.x ?? 0) + ((item.bbox?.w ?? 0) / 2),
        y: (item.bbox?.y ?? 0) + ((item.bbox?.h ?? 0) / 2),
      })),
    ];
    for (const item of items) {
      if (item.x < videoWidth * 0.2 && item.y < videoHeight * 0.2) counts.upper_left += 1;
      if (item.x > videoWidth * 0.8 && item.y < videoHeight * 0.2) counts.upper_right += 1;
      if (item.x < videoWidth * 0.2 && item.y > videoHeight * 0.8) counts.lower_left += 1;
      if (item.x > videoWidth * 0.8 && item.y > videoHeight * 0.8) counts.lower_right += 1;
    }
    return counts;
  }, [activeOCR, activeRawObjects, videoHeight, videoWidth]);
  const currentColorRegimeScan = useMemo(() => {
    const zones = Object.values(toneScanZones || {});
    const toneCounts = new Map<string, number>();
    let warm = 0;
    let cool = 0;
    let saturated = 0;
    let muted = 0;
    for (const zone of zones) {
      toneCounts.set(zone.dominant_tone, (toneCounts.get(zone.dominant_tone) || 0) + 1);
      if (zone.dominant_tone === "red-magenta") warm += 1;
      if (zone.dominant_tone === "blue-cyan" || zone.dominant_tone === "green") cool += 1;
      if (zone.saturation_band === "high") saturated += 1;
      if (zone.saturation_band === "low") muted += 1;
    }
    return {
      temperature: warm > cool ? "warm" : cool > warm ? "cool" : "balanced",
      saturation: saturated >= 3 ? "saturated" : muted >= 3 ? "muted" : "mixed",
      dominantPaletteBlock:
        Array.from(toneCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown",
      paletteShift:
        typeof liveToneSample?.tone_shift === "number"
          ? liveToneSample.tone_shift >= 3
            ? "shift detected"
            : "stable"
          : "unknown",
    };
  }, [liveToneSample?.tone_shift, toneScanZones]);
  const currentVisualClutterScan = useMemo(() => {
    const itemCount = activeRawObjects.length + activeOCR.length;
    const occupancyMass = currentSpatialScan.entries.reduce(
      (sum, entry) => sum + (typeof entry.occupancy === "number" ? entry.occupancy : 0),
      0,
    );
    return {
      label:
        itemCount >= 12 || occupancyMass >= 1.6
          ? "dense"
          : itemCount >= 5 || occupancyMass >= 0.7
            ? "moderate"
            : "sparse",
      itemCount,
      occupancyMass,
    };
  }, [activeOCR.length, activeRawObjects.length, currentSpatialScan.entries]);
  const currentMotionScan = useMemo(() => {
    const motionSamples = analysisData?.metadata?.motionSceneBasis?.motionEvidence?.samples || [];
    const nearestMotionSample = motionSamples.length
      ? [...motionSamples].sort((left, right) => {
          const leftDistance = Math.abs((left.timestamp ?? 0) - currentTime);
          const rightDistance = Math.abs((right.timestamp ?? 0) - currentTime);
          if (leftDistance !== rightDistance) {
            return leftDistance - rightDistance;
          }
          return (left.timestamp ?? 0) - (right.timestamp ?? 0);
        })[0]
      : null;
    const diff = liveToneSample?.frame_diff;
    const summary = analysisData?.metadata?.motionSceneBasis?.motionEvidence?.summary;
    const sceneSegments = analysisData?.metadata?.motionSceneBasis?.sceneSegments?.segments || [];
    const activeScene = sceneSegments.find(
      (segment) =>
        typeof segment?.start === "number" &&
        typeof segment?.end === "number" &&
        currentTime >= segment.start &&
        currentTime <= segment.end,
    );
    return {
      label: nearestMotionSample?.motion_label
        || (typeof diff !== "number"
          ? "unknown"
          : diff < 12
            ? "static"
            : diff < 28
              ? "mild motion"
              : "strong motion"),
      diff,
      sample: nearestMotionSample,
      summary,
      activeScene,
    };
  }, [
    analysisData?.metadata?.motionSceneBasis?.motionEvidence?.samples,
    analysisData?.metadata?.motionSceneBasis?.motionEvidence?.summary,
    analysisData?.metadata?.motionSceneBasis?.sceneSegments?.segments,
    currentTime,
    liveToneSample?.frame_diff,
  ]);
  const currentTransitionScan = useMemo(() => {
    return {
      label: liveToneSample?.transition_hint || "continuity stable",
      toneShift: liveToneSample?.tone_shift,
      frameDiff: liveToneSample?.frame_diff,
    };
  }, [liveToneSample?.frame_diff, liveToneSample?.tone_shift, liveToneSample?.transition_hint]);
  const activeInspectorKey = shotSizeOpen
    ? "shot"
    : frameClassOpen
      ? "frame"
    : spatialScanOpen
      ? "spatial"
      : textGraphicOpen
        ? "text"
      : humanPresenceOpen
        ? "human"
      : marginScanOpen
        ? "margin"
      : cornerScanOpen
        ? "corner"
      : depthScanOpen
        ? "depth"
      : lightingOpen
        ? "lighting"
      : colorRegimeOpen
        ? "color"
      : visualClutterOpen
        ? "clutter"
      : motionScanOpen
        ? "motion"
      : transitionScanOpen
        ? "transition"
      : toneScanOpen
        ? "tone"
        : null;

  const compareReady =
    Boolean(compareAnchor) &&
    Boolean(videoId) &&
    compareAnchor?.videoId !== videoId;

  const compareInstruction = compareAnchor
    ? compareReady
      ? showCompareInPanel
        ? "Synced compare is open below. Use Play sync and Pause sync for the clearest linked comparison."
        : "Anchor saved from another source. Open synced compare to view both videos here."
      : "Anchor is set on this same source. Open a different source to start a synced compare."
    : "Set a compare anchor on one source, then open a second source and start synced compare.";

  useEffect(() => {
    if (
      (!toneScanOpen &&
        !lightingOpen &&
        !motionScanOpen &&
        !transitionScanOpen &&
        !colorRegimeOpen &&
        !frameClassOpen) ||
      !videoRef.current
    ) {
      return;
    }

    const video = videoRef.current;
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    if (!width || !height) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(width, 180);
    canvas.height = Math.min(height, 120);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const zones = {
      left: [0, 0, Math.floor(canvas.width / 3), canvas.height],
      center: [
        Math.floor(canvas.width / 3),
        0,
        Math.floor((canvas.width * 2) / 3),
        canvas.height,
      ],
      right: [Math.floor((canvas.width * 2) / 3), 0, canvas.width, canvas.height],
      upper: [0, 0, canvas.width, Math.floor(canvas.height / 3)],
      middle: [
        0,
        Math.floor(canvas.height / 3),
        canvas.width,
        Math.floor((canvas.height * 2) / 3),
      ],
      lower: [0, Math.floor((canvas.height * 2) / 3), canvas.width, canvas.height],
    } as const;

    const nextZones: Record<
      string,
      {
        dominant_tone: string;
        brightness_band: string;
        saturation_band: string;
        brightness_value: number;
        rgb: [number, number, number];
      }
    > = {};
    let brightnessTotal = 0;
    let saturationTotal = 0;
    let zoneCount = 0;

    for (const [zone, [x1, y1, x2, y2]] of Object.entries(zones)) {
      const regionWidth = Math.max(1, x2 - x1);
      const regionHeight = Math.max(1, y2 - y1);
      const data = context.getImageData(x1, y1, regionWidth, regionHeight).data;
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        red += data[index] || 0;
        green += data[index + 1] || 0;
        blue += data[index + 2] || 0;
        count += 1;
      }
      const avgRed = red / Math.max(count, 1);
      const avgGreen = green / Math.max(count, 1);
      const avgBlue = blue / Math.max(count, 1);
      const brightnessValue = (avgRed + avgGreen + avgBlue) / 3;
      const saturationValue =
        Math.max(avgRed, avgGreen, avgBlue) - Math.min(avgRed, avgGreen, avgBlue);
      nextZones[zone] = {
        dominant_tone: classifyToneFamilyFromRgb(avgRed, avgGreen, avgBlue),
        brightness_band: classifyBrightnessBand(brightnessValue),
        saturation_band: classifySaturationBand(avgRed, avgGreen, avgBlue),
        brightness_value: brightnessValue,
        rgb: [avgRed, avgGreen, avgBlue],
      };
      brightnessTotal += brightnessValue;
      saturationTotal += saturationValue;
      zoneCount += 1;
    }

    const overallBrightness = zoneCount > 0 ? brightnessTotal / zoneCount : 0;
    const overallSaturation = zoneCount > 0 ? saturationTotal / zoneCount : 0;
    const dominantTone =
      Object.entries(
        Object.values(nextZones).reduce<Record<string, number>>((acc, zone) => {
          acc[zone.dominant_tone] = (acc[zone.dominant_tone] || 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";

    const previousProbe = previousToneProbeRef.current;
    const frameDiff = previousProbe
      ? Math.abs(overallBrightness - previousProbe.overallBrightness) +
        Math.abs(overallSaturation - previousProbe.overallSaturation)
      : 0;
    const toneShift = previousProbe
      ? Object.entries(nextZones).reduce((sum, [zone, currentZone]) => {
          const previousRgb = previousProbe.zoneRgb[zone];
          if (!previousRgb) {
            return sum;
          }
          return (
            sum +
            Math.abs(currentZone.rgb[0] - previousRgb[0]) +
            Math.abs(currentZone.rgb[1] - previousRgb[1]) +
            Math.abs(currentZone.rgb[2] - previousRgb[2])
          );
        }, 0) /
          Math.max(Object.keys(nextZones).length, 1)
      : 0;
    const transitionHint =
      frameDiff >= 35 || toneShift >= 90
        ? "possible cut"
        : frameDiff >= 18 || toneShift >= 45
          ? "possible dissolve/fade"
          : "continuity stable";
    const motionLevel =
      frameDiff >= 28 ? "strong motion" : frameDiff >= 12 ? "mild motion" : "static";

    previousToneProbeRef.current = {
      overallBrightness,
      overallSaturation,
      dominantTone,
      zoneTones: Object.fromEntries(
        Object.entries(nextZones).map(([zone, zoneData]) => [zone, zoneData.dominant_tone]),
      ),
      zoneRgb: Object.fromEntries(
        Object.entries(nextZones).map(([zone, zoneData]) => [zone, zoneData.rgb]),
      ),
    };

    setLiveToneSample({
      timestamp: currentTime,
      frame_class:
        currentHumanPresenceScan.personCount > 0
          ? "human-centered"
          : currentTextGraphicScan.textPresent && activeRawObjects.length === 0
            ? "graphic"
            : activeRawObjects.length > 0 || activeOCR.length > 0
              ? "mixed"
              : "scene-centered",
      dominant_tone: dominantTone,
      overall_brightness: overallBrightness,
      overall_saturation: overallSaturation,
      frame_diff: frameDiff,
      tone_shift: toneShift,
      motion_level: motionLevel,
      transition_hint: transitionHint,
      zones: nextZones,
    });
  }, [
    activeOCR.length,
    activeRawObjects.length,
    colorRegimeOpen,
    currentHumanPresenceScan.personCount,
    currentTextGraphicScan.textPresent,
    currentTime,
    frameClassOpen,
    lightingOpen,
    motionScanOpen,
    toneScanOpen,
    transitionScanOpen,
    videoUrl,
  ]);

  const syncCompareToReferences = React.useCallback(() => {
    if (!compareAnchor) {
      return;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = currentTime;
    }
    if (compareVideoRef.current) {
      compareVideoRef.current.currentTime = compareAnchor.time;
    }
  }, [compareAnchor, currentTime]);

  const playSyncCompare = React.useCallback(() => {
    if (
      !showCompareInPanel ||
      !compareReady ||
      !compareAnchor ||
      !videoRef.current ||
      !compareVideoRef.current
    ) {
      return;
    }

    compareSyncLockRef.current = true;
    videoRef.current.currentTime = currentTime;
    compareVideoRef.current.currentTime = compareAnchor.time;

    Promise.allSettled([
      videoRef.current.play(),
      compareVideoRef.current.play(),
    ]).finally(() => {
      window.setTimeout(() => {
        compareSyncLockRef.current = false;
      }, 0);
    });
  }, [compareAnchor, compareReady, currentTime, showCompareInPanel]);

  const pauseSyncCompare = React.useCallback(() => {
    if (!videoRef.current || !compareVideoRef.current) {
      return;
    }

    compareSyncLockRef.current = true;
    videoRef.current.pause();
    compareVideoRef.current.pause();
    window.setTimeout(() => {
      compareSyncLockRef.current = false;
    }, 0);
  }, []);

  const syncCompareSide = React.useCallback(
    (source: "main" | "compare") => {
      if (
        !linkedComparePlayback ||
        compareSyncLockRef.current ||
        !compareAnchor ||
        !videoRef.current ||
        !compareVideoRef.current
      ) {
        return;
      }

      compareSyncLockRef.current = true;
      const offset = currentTime - compareAnchor.time;

      if (source === "main") {
        compareVideoRef.current.currentTime = Math.max(
          0,
          videoRef.current.currentTime - offset,
        );
      } else {
        videoRef.current.currentTime = Math.max(
          0,
          compareVideoRef.current.currentTime + offset,
        );
      }

      window.setTimeout(() => {
        compareSyncLockRef.current = false;
      }, 0);
    },
    [compareAnchor, currentTime, linkedComparePlayback],
  );

  return (
    <div className="flex h-full flex-col">
      <div
        className={`border-b border-slate-800 ${annotationWorkspaceActive ? "px-3 py-1.5" : "px-4 py-2"}`}
      >
        <div className="flex items-center justify-between gap-3 text-sm">
          <div
            className="min-w-0 truncate text-[var(--ui-passive-text)]"
            title={displayName}
          >
            {displayName}
          </div>
          {subtleState && (
            <div className="shrink-0 text-[11px] text-[var(--ui-passive-text)]">
              {subtleState}
            </div>
          )}
        </div>
        {(blobMissing ||
          (metadata?.sourceVideoExists === false &&
            metadata?.sourceVideoMessage)) && (
          <div className="mt-1 text-[11px] text-[var(--ui-passive-text)]">
            {blobMissing &&
              "Preview not stored in this browser. Reopen from saved outputs if needed."}
            {blobMissing &&
              metadata?.sourceVideoExists === false &&
              metadata?.sourceVideoMessage &&
              " "}
            {metadata?.sourceVideoExists === false &&
              metadata?.sourceVideoMessage && (
                <span className="text-amber-300">
                  {metadata.sourceVideoMessage}
                </span>
              )}
          </div>
        )}
      </div>

      <div
        className={`flex-1 min-h-0 overflow-y-auto ${annotationWorkspaceActive ? "px-3 pt-2 pb-3" : "px-4 pt-3 pb-4"}`}
      >
        <div className={`flex min-h-full flex-col ${annotationWorkspaceActive ? "gap-2" : "gap-3"}`}>
          <div
            ref={mediaFrameRef}
            className={`relative shrink-0 overflow-hidden rounded-lg bg-black ${
              annotationWorkspaceActive
                ? "min-h-[160px] md:min-h-[220px]"
                : "min-h-[240px] md:min-h-[300px]"
            } ${
              showCompareInPanel && compareSource ? "grid grid-cols-2 gap-2 bg-transparent" : "flex items-center justify-center"
            }`}
          >
            {videoUrl && (!showCompareInPanel || !compareSource) ? (
              <>
                <video
                  key={videoUrl}
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="h-full w-full object-contain"
                  onLoadedMetadata={() => {
                    if (!videoRef.current) {
                      return;
                    }
                    setDuration(videoRef.current.duration || 0);
                    setFrameReadyTime(null);
                    overlayArmedRef.current = false;
                    updateRenderedVideoRect();
                  }}
                  onTimeUpdate={() => {
                    if (!videoRef.current) {
                      return;
                    }
                    if (usesFrameCallbackRef.current) {
                      return;
                    }
                    const nextTime = videoRef.current.currentTime;
                    setCurrentTime(nextTime);
                    if (!overlayArmedRef.current || Math.abs((frameReadyTime ?? -999) - nextTime) > 0.2) {
                      overlayArmedRef.current = true;
                      setFrameReadyTime(nextTime);
                    }
                    if (Math.abs(nextTime - lastBroadcastTimeRef.current) >= 0.25) {
                      lastBroadcastTimeRef.current = nextTime;
                      eventBus.emit("videoTimeLineChanged", nextTime);
                    }
                  }}
                  onSeeked={() => {
                    if (!videoRef.current) {
                      return;
                    }
                    const nextTime = videoRef.current.currentTime;
                    lastBroadcastTimeRef.current = nextTime;
                    setCurrentTime(nextTime);
                    overlayArmedRef.current = true;
                    setFrameReadyTime(nextTime);
                    eventBus.emit("videoTimeLineChanged", nextTime);
                  }}
                  onCanPlay={updateRenderedVideoRect}
                  onError={() => {
                    console.error("VideoPanel: Video failed to load");
                    setBlobMissing(true);
                  }}
                />

                {renderedVideoRect && overlayBoxes.length > 0 && (
                  <div
                    className="pointer-events-none absolute z-20"
                    style={{
                      left: renderedVideoRect.x,
                      top: renderedVideoRect.y,
                      width: renderedVideoRect.width,
                      height: renderedVideoRect.height,
                    }}
                  >
                    {overlayBoxes.map((overlay) => {
                      const selected = selectedOverlayKey === overlay.key;
                      const edit = getSelectedIndicationEdit(overlay);
                      const trackId = overlay.sourceItem?.trackId ?? (overlay.sourceItem as any)?.track_id;

                      const startInputKey = `${overlay.key}:start`;
                      const endInputKey = `${overlay.key}:end`;
                      const normalizedBox = getOverlayNormalizedBox(overlay);
                      const overlayStackRank = selected
                        ? SELECTED_OVERLAY_STACK_RANK
                        : getOverlayStackRank(overlay.modality, normalizedBox);
                      const overdraftActive = Boolean(selectedOverlayOverdrafts[overlay.key]);
                      const timelinePadding = selectedOverlayTimelinePadding[overlay.key] || {
                        before: 0,
                        after: 0,
                      };
                      const continuationSeconds = Math.max(
                        1,
                        Number(selectedOverlayContinuationSeconds[overlay.key] ?? 30),
                      );
                      const intervalStart = clamp(
                        Math.min(edit.start, edit.end),
                        0,
                        duration || Number.MAX_SAFE_INTEGER,
                      );
                      const intervalEnd = clamp(
                        Math.max(edit.start, edit.end, intervalStart + 0.001),
                        0,
                        duration || Number.MAX_SAFE_INTEGER,
                      );
                      const sceneEnd =
                        typeof currentMotionScan.activeScene?.end === "number"
                          ? currentMotionScan.activeScene.end
                          : duration || intervalEnd;
                      const sceneStart =
                        typeof currentMotionScan.activeScene?.start === "number"
                          ? currentMotionScan.activeScene.start
                          : 0;
                      const hasSceneBounds =
                        typeof currentMotionScan.activeScene?.start === "number" ||
                        typeof currentMotionScan.activeScene?.end === "number";
                      const workingFrameTime = clamp(
                        currentTime,
                        0,
                        duration || Number.MAX_SAFE_INTEGER,
                      );
                      const workspaceStart = clamp(
                        intervalStart - Math.max(0, timelinePadding.before),
                        0,
                        duration || Number.MAX_SAFE_INTEGER,
                      );
                      const workspaceEnd = clamp(
                        intervalEnd + Math.max(0, timelinePadding.after),
                        0,
                        duration || Number.MAX_SAFE_INTEGER,
                      );
                      const scrubMin = overdraftActive
                        ? hasSceneBounds
                          ? Math.min(workspaceStart, clamp(sceneStart, 0, workspaceStart))
                          : workspaceStart
                        : workspaceStart;
                      const scrubMax = Math.max(
                        workspaceEnd,
                        overdraftActive && hasSceneBounds
                          ? clamp(sceneEnd, workspaceEnd, duration || sceneEnd)
                          : workspaceEnd,
                      );
                      const scrubValue =
                        selectedOverlayScrub?.overlayKey === overlay.key
                          ? clamp(selectedOverlayScrub.value, scrubMin, scrubMax)
                          : workingFrameTime;
                      const stretchActionLabel = "Extend in";
                      const overlayLeftPx = normalizedBox.x * renderedVideoRect.width;
                      const overlayTopPx = normalizedBox.y * renderedVideoRect.height;
                      const overlayWidthPx = normalizedBox.w * renderedVideoRect.width;
                      const overlayHeightPx = normalizedBox.h * renderedVideoRect.height;
                      const overlapsVideoControls =
                        overlayTopPx + overlayHeightPx >
                        renderedVideoRect.height - VIDEO_CONTROL_CLEARANCE_PX;
                      const selectedEditorWidthPx = Math.min(
                        360,
                        Math.max(280, renderedVideoRect.width - 16),
                      );
                      const editorPreferredHeight = 320;
                      const editorSpaceAbove = normalizedBox.y * renderedVideoRect.height;
                      const editorSpaceBelow =
                        (1 - normalizedBox.y - normalizedBox.h) * renderedVideoRect.height;
                      const selectedEditorBelow =
                        editorSpaceBelow >= editorPreferredHeight ||
                        editorSpaceAbove < editorPreferredHeight;
                      const selectedEditorMaxHeight = Math.max(
                        180,
                        Math.min(420, renderedVideoRect.height - 12),
                      );
                      const preferredEditorLeftPx =
                        overlayLeftPx + overlayWidthPx / 2 - selectedEditorWidthPx / 2;
                      const selectedEditorLeftPx = clamp(
                        preferredEditorLeftPx,
                        4,
                        Math.max(4, renderedVideoRect.width - selectedEditorWidthPx - 4),
                      );
                      const preferredEditorTopPx = selectedEditorBelow
                        ? overlayTopPx + overlayHeightPx + 6
                        : overlayTopPx - selectedEditorMaxHeight - 6;
                      const selectedEditorTopPx = clamp(
                        preferredEditorTopPx,
                        4,
                        Math.max(4, renderedVideoRect.height - selectedEditorMaxHeight - 4),
                      );
                      const selectedEditorStyle = {
                        left: selectedEditorLeftPx - overlayLeftPx,
                        top: selectedEditorTopPx - overlayTopPx,
                        width: selectedEditorWidthPx,
                        maxHeight: selectedEditorMaxHeight,
                      };
                      const editableOverlay =
                        overlay.modality === "manual" || overlay.modality === "object";
                      const overlaySourceLabel =
                        overlay.modality === "manual"
                          ? String(
                              (overlay.sourceItem as ManualVisualAnnotation | undefined)
                                ?.metadata_correlation?.target_label || "",
                            ).trim()
                          : (() => {
                              const source = overlay.sourceItem || {};
                              if (source.raw_detection_hidden) {
                                return "";
                              }
                              const trackId = source.trackId ?? source.track_id;
                              const rawLabel = String(
                                source.raw_class_name ||
                                  source.class_name ||
                                  source.displayLabel ||
                                  "",
                              ).trim();
                              if (trackId !== undefined && trackId !== null) {
                                return governedOverlayLabel(rawLabel.toLowerCase().startsWith("person")
                                  ? `person track ${trackId}`
                                  : rawLabel
                                    ? `${rawLabel} track ${trackId}`
                                    : `track ${trackId}`) || "";
                              }
                              return governedOverlayLabel(rawLabel) || "";
                            })();
                      const compactOverlayLabel =
                        overlaySourceLabel &&
                        normalizeEvidenceLabel(overlaySourceLabel) !==
                          normalizeEvidenceLabel(overlay.label)
                          ? `${overlay.label} / ${overlaySourceLabel}`
                          : overlay.label;
                      const primarySecondOrderLabel = formatSecondOrderInstructionLabel(
                        getPrimarySecondOrderInstruction({
                          plan: analysisData?.secondOrderLabelProliferation,
                          surface: "bbox_roi_overlay",
                          targetLabelFamilies: [edit.category],
                          timeSpan: { start: edit.start, end: edit.end },
                        }),
                      );
                      const visibleOverlayLabel = compactOverlayLabel;
                      const proliferationLauncher = {
                        ...DEFAULT_PROLIFERATION_LAUNCHER,
                        ...(selectedOverlayProliferation[overlay.key] || {}),
                      };
                      return (
                        <div
                          key={overlay.key}
                          role="button"
                          tabIndex={0}
                          onPointerDown={(event) => {
                            if (!editableOverlay || isInteractiveElement(event.target)) {
                              return;
                            }
                            beginOverlayGeometryDrag(event, overlay, "move");
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            selectOverlayForEditing(overlay);
                          }}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openEvidencePanelForOverlay(overlay);
                            selectOverlayForEditing(overlay);
                          }}
                          onKeyDown={(event) => {
                            if (isInteractiveElement(event.target)) {
                              return;
                            }
                            if (event.key !== "Enter" && event.key !== " ") {
                              return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            openEvidencePanelForOverlay(overlay);
                            selectOverlayForEditing(overlay);
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            selectOverlayForEditing(overlay);
                            openTracebackForOverlay(overlay, edit);
                          }}
                          className={`${
                            overlapsVideoControls ? "pointer-events-none" : "pointer-events-auto"
                          } absolute rounded border ${overlay.color} ${
                            selected ? "overflow-visible" : "overflow-hidden"
                          } ${
                            editableOverlay ? "cursor-move" : "cursor-pointer"
                          } ${selected ? "ring-2 ring-cyan-300/70" : ""}`}
                          style={{
                            left: `${normalizedBox.x * 100}%`,
                            top: `${normalizedBox.y * 100}%`,
                            width: `${normalizedBox.w * 100}%`,
                            height: `${normalizedBox.h * 100}%`,
                            zIndex: overlayStackRank,
                          }}
                          title={
                            overlay.modality === "object" || overlay.modality === "manual"
                              ? "Drag to move; double-click for evidence panel and bbox actions"
                              : "Double-click for evidence panel"
                          }
                        >
                          <div
                            className={`truncate bg-black/60 px-1 py-0.5 text-[10px] text-slate-100 ${
                              editableOverlay ? "cursor-move" : ""
                            }`}
                            title={
                              editableOverlay
                                ? `Drag to move indication box: ${visibleOverlayLabel}${
                                    primarySecondOrderLabel
                                      ? ` • source label ${compactOverlayLabel}`
                                      : ""
                                  }`
                                : visibleOverlayLabel
                            }
                            onPointerDown={
                              editableOverlay
                                ? (event) => beginOverlayGeometryDrag(event, overlay, "move")
                                : undefined
                            }
                          >
                            {visibleOverlayLabel}
                          </div>
                          {(overlay.sourceItem?.traceback ||
                            overlay.sourceItem?.evidence_refs ||
                            overlay.sourceItem?.source_bbox_refs ||
                            overlay.sourceItem?.source_frame_refs ||
                            selected) && (
                            <button
                              type="button"
                              data-vaa1-traceback-button="true"
                              title="Open traceback source chain"
                              aria-label="Open traceback source chain"
                              onClick={(event) => {
                                event.stopPropagation();
                                openTracebackForOverlay(overlay, edit);
                              }}
                              className="pointer-events-auto absolute right-1 top-5 z-40 rounded border border-cyan-700/70 bg-black/80 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-cyan-100 shadow hover:bg-cyan-950"
                            >
                              Trace
                            </button>
                          )}
                          <div className="pointer-events-auto">
                            <SecondOrderLabelAffirmationChips
                              plan={analysisData?.secondOrderLabelProliferation}
                              surface="bbox_roi_overlay"
                              targetLabelFamilies={[
                                edit.category,
                                "Identification",
                                "Expression",
                                "Interaction",
                                "Action",
                                "Role",
                              ]}
                              timeSpan={{ start: edit.start, end: edit.end }}
                              trackId={trackId}
                              compact
                              limit={2}
                            />
                          </div>
                          {editableOverlay && (
                            <button
                              type="button"
                              title="Resize indication box"
                              aria-label="Resize indication box"
                              onPointerDown={(event) =>
                                beginOverlayGeometryDrag(event, overlay, "resize-se")
                              }
                              onClick={(event) => event.stopPropagation()}
                              className="absolute bottom-0 right-0 z-30 h-4 w-4 cursor-nwse-resize rounded-tl border border-cyan-300/60 bg-black/80 text-[10px] leading-3 text-cyan-100 hover:bg-cyan-950"
                            >
                              /
                            </button>
                          )}
                          {selected && (
                            <>
                      <div
                                className="absolute z-50 overflow-y-auto rounded border border-slate-700 bg-[#111111]/95 px-2 py-1.5 shadow-lg"
                                style={selectedEditorStyle}
                                onClick={(event) => event.stopPropagation()}
                                onMouseDown={(event) => event.stopPropagation()}
                                onPointerDown={(event) => event.stopPropagation()}
                              >
                                <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-slate-300">
                                  <span
                                    className="truncate font-medium text-cyan-100"
                                    title={compactOverlayLabel}
                                  >
                                    {compactOverlayLabel}
                                  </span>
                                  <span className="shrink-0 text-slate-500">
                                    {formatPreciseTime(scrubValue)}
                                  </span>
                                </div>
                                {primarySecondOrderLabel &&
                                  normalizeEvidenceLabel(primarySecondOrderLabel) !==
                                    normalizeEvidenceLabel(compactOverlayLabel) && (
                                    <div
                                      className="mb-1 truncate text-[9px] text-cyan-200/80"
                                      title={primarySecondOrderLabel}
                                    >
                                      Suggested meaning: {primarySecondOrderLabel}
                                    </div>
                                  )}
                                <div className="mb-1 flex items-center justify-between gap-2 text-[9px] text-slate-500">
                                  <span>Drag slider to mark interest</span>
                                  <span>
                                    {formatPreciseTime(edit.start)}-{formatPreciseTime(edit.end)}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={scrubMin}
                                  max={scrubMax}
                                  step={0.001}
                                  value={scrubValue}
                                  onClick={(event) => event.stopPropagation()}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onPointerDown={(event) => {
                                    event.stopPropagation();
                                    setSelectedOverlayScrub({
                                      overlayKey: overlay.key,
                                      value: scrubValue,
                                      active: true,
                                    });
                                    setSelectedOverlayTimeDrag({
                                      overlayKey: overlay.key,
                                      start: scrubValue,
                                    });
                                    videoRef.current?.pause();
                                  }}
                                  onPointerUp={(event) => {
                                    event.stopPropagation();
                                    finishSelectedOverlayTimeDraw(overlay.key, scrubValue);
                                  }}
                                  onPointerCancel={(event) => {
                                    event.stopPropagation();
                                    setSelectedOverlayTimeDrag(null);
                                    finishSelectedOverlayScrub();
                                  }}
                                  onBlur={() => {
                                    setSelectedOverlayTimeDrag(null);
                                    finishSelectedOverlayScrub();
                                  }}
                                  onChange={(event) =>
                                    scrubSelectedOverlayTo(
                                      overlay.key,
                                      Number(event.target.value),
                                      scrubMin,
                                      scrubMax,
                                    )
                                  }
                                  className="mb-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-300"
                                  aria-label="Selected indication timeline"
                                />
                                <div className="mb-1 flex items-center gap-1 text-[10px] text-slate-400">
                                  <label className="flex items-center gap-1 whitespace-nowrap">
                                    <span className="text-slate-500">+s</span>
                                    <input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={continuationSeconds}
                                      onChange={(event) => {
                                        const nextValue = Math.max(
                                          1,
                                          Number(event.target.value || 30),
                                        );
                                        setSelectedOverlayContinuationSeconds((current) => ({
                                          ...current,
                                          [overlay.key]: nextValue,
                                        }));
                                      }}
                                      onClick={(event) => event.stopPropagation()}
                                      className="w-12 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] text-slate-200"
                                      aria-label="Continuation seconds"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    title="Add workspace seconds before and after this indication"
                                    aria-label="Extend indication timeline workspace"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedOverlayTimelinePadding((current) => {
                                        const existing = current[overlay.key] || {
                                          before: 0,
                                          after: 0,
                                        };
                                        return {
                                          ...current,
                                          [overlay.key]: {
                                            before: existing.before + continuationSeconds,
                                            after: existing.after + continuationSeconds,
                                          },
                                        };
                                      });
                                      setSelectedOverlayScrub({
                                        overlayKey: overlay.key,
                                        value: clamp(edit.start, scrubMin, scrubMax),
                                        active: false,
                                      });
                                    }}
                                    className="rounded bg-cyan-900/45 px-1 py-0.5 text-cyan-100 hover:bg-cyan-800/65"
                                  >
                                    {stretchActionLabel}
                                  </button>
                                  <button
                                    type="button"
                                    title="Cut indication out at current frame"
                                    aria-label="Cut indication out at current frame"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      cutSelectedIndicationOut(overlay.key, scrubValue);
                                    }}
                                    className="rounded bg-amber-900/45 px-1 py-0.5 text-amber-100 hover:bg-amber-800/65"
                                  >
                                    Cut out
                                  </button>
                                  <button
                                    type="button"
                                    title="Step back 100 ms"
                                    aria-label="Step selected indication back 100 milliseconds"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      scrubAndExtendSelectedOverlay(
                                        overlay.key,
                                        scrubValue - 0.1,
                                        scrubMin,
                                        scrubMax,
                                        edit,
                                        overdraftActive,
                                      );
                                      finishSelectedOverlayScrub();
                                    }}
                                    className="rounded border border-slate-700 px-1 py-0.5 hover:bg-slate-800"
                                  >
                                    -100ms
                                  </button>
                                  <button
                                    type="button"
                                    title="Step forward 100 ms"
                                    aria-label="Step selected indication forward 100 milliseconds"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      scrubAndExtendSelectedOverlay(
                                        overlay.key,
                                        scrubValue + 0.1,
                                        scrubMin,
                                        scrubMax,
                                        edit,
                                        overdraftActive,
                                      );
                                      finishSelectedOverlayScrub();
                                    }}
                                    className="rounded border border-slate-700 px-1 py-0.5 hover:bg-slate-800"
                                  >
                                    +100ms
                                  </button>
                                  <label className="ml-auto flex items-center gap-1 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={overdraftActive}
                                      onChange={(event) => {
                                        event.stopPropagation();
                                        setSelectedOverlayOverdrafts((current) => ({
                                          ...current,
                                          [overlay.key]: event.target.checked,
                                        }));
                                      }}
                                      onClick={(event) => event.stopPropagation()}
                                      className="h-3 w-3 accent-cyan-300"
                                    />
                                    Overdraft
                                  </label>
                                </div>
                                <div
                                  data-vaa1-bbox-roi-evidence-hub="true"
                                  className="mb-1 rounded border border-cyan-950/70 bg-black/25 p-1.5"
                                >
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-200">
                                      BBox/ROI Evidence Hub
                                    </div>
                                    <div className="text-[9px] text-slate-500">
                                      anchor, not detector truth
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    {BBOX_ROI_EVIDENCE_HUB_SECTIONS.map((section) => (
                                      <button
                                        key={section.id}
                                        type="button"
                                        data-vaa1-bbox-roi-hub-section={section.id}
                                        title={section.items.join(", ")}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (section.id === "traceback_authority") {
                                            openTracebackForOverlay(overlay, edit);
                                            return;
                                          }
                                          if (section.id === "narrative_agent") {
                                            updateSelectedIndicationEdit(overlay.key, {
                                              category: "Identification",
                                              identityAffirmation: edit.identityAffirmation || edit.label,
                                            });
                                          } else if (section.id === "relations") {
                                            updateSelectedIndicationEdit(overlay.key, {
                                              category: "Interaction",
                                              label:
                                                edit.category === "Interaction"
                                                  ? edit.label
                                                  : "Interaction",
                                            });
                                          } else if (section.id === "genre_dramaturgy") {
                                            updateSelectedIndicationEdit(overlay.key, {
                                              category: "Genre",
                                            });
                                          } else if (section.id === "time_continuity") {
                                            updateSelectedIndicationEdit(overlay.key, {
                                              category: "Movement",
                                            });
                                          } else if (section.id === "evidence") {
                                            updateSelectedIndicationEdit(overlay.key, {
                                              category: getDefaultCategoryForOverlay(overlay),
                                            });
                                          }
                                        }}
                                        className={`rounded border px-1.5 py-1 text-left hover:bg-cyan-950/30 ${
                                          (section.id === "narrative_agent" &&
                                            edit.category === "Identification") ||
                                          (section.id === "relations" &&
                                            edit.category === "Interaction") ||
                                          (section.id === "genre_dramaturgy" &&
                                            edit.category === "Genre") ||
                                          (section.id === "time_continuity" &&
                                            edit.category === "Movement")
                                            ? "border-cyan-600 bg-cyan-950/35 text-cyan-50"
                                            : "border-slate-800 bg-black/20 text-slate-300"
                                        }`}
                                      >
                                        <div className="truncate text-[10px] font-medium">
                                          {section.label}
                                        </div>
                                        <div className="mt-0.5 truncate text-[8px] text-slate-500">
                                          {section.items.slice(0, 3).join(" / ")}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                  <div className="mt-1 grid grid-cols-[auto_1fr] items-center gap-1">
                                    <label
                                      htmlFor={`bbox-roi-scope-${overlay.key}`}
                                      className="text-[9px] uppercase tracking-[0.12em] text-slate-500"
                                    >
                                      Apply to
                                    </label>
                                    <select
                                      id={`bbox-roi-scope-${overlay.key}`}
                                      value={edit.applyScope}
                                      onChange={(event) =>
                                        updateSelectedIndicationEdit(overlay.key, {
                                          applyScope: event.target.value as BBoxRoiApplyScope,
                                        })
                                      }
                                      className="min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] text-slate-200"
                                      aria-label="BBox/ROI annotation scope"
                                    >
                                      {BBOX_ROI_APPLY_SCOPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                          {option.dangerous ? " - confirm before propagation" : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {BBOX_ROI_QUICK_ANNOTATIONS.map((annotation) => {
                                      const active = edit.quickAnnotations.includes(annotation);
                                      const actionAnnotation =
                                        BBOX_ROI_ACTION_QUICK_ACTIONS.includes(annotation);
                                      return (
                                      <button
                                        key={annotation}
                                        type="button"
                                        data-vaa1-relation-quick-action="true"
                                        data-vaa1-quick-annotation-active={active ? "true" : "false"}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          const nextQuickAnnotations = active
                                            ? edit.quickAnnotations.filter((item) => item !== annotation)
                                            : [...edit.quickAnnotations, annotation];
                                          updateSelectedIndicationEdit(overlay.key, {
                                            quickAnnotations: nextQuickAnnotations,
                                            note: nextQuickAnnotations.length
                                              ? `Quick annotations: ${nextQuickAnnotations.join(", ")}`
                                              : edit.note,
                                          });
                                        }}
                                        className={`rounded border px-1 py-0.5 text-[9px] hover:border-cyan-700 hover:text-cyan-100 ${
                                          active
                                            ? actionAnnotation
                                              ? "border-amber-500/70 bg-amber-950/45 text-amber-100"
                                              : "border-emerald-500/70 bg-emerald-950/45 text-emerald-100"
                                            : "border-slate-800 bg-slate-950/50 text-slate-300"
                                        }`}
                                      >
                                        {active ? "- " : "+ "}
                                        {annotation}
                                      </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="mb-1 grid grid-cols-[1fr_1fr_1.35fr] gap-1">
                                  <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                                    In
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={
                                        selectedTimeInputDrafts[startInputKey] ??
                                        formatPreciseTime(edit.start)
                                      }
                                      onChange={(event) => {
                                        setSelectedTimeInputDrafts((current) => ({
                                          ...current,
                                          [startInputKey]: event.target.value,
                                        }));
                                      }}
                                      onBlur={() =>
                                        commitSelectedTimeInput(
                                          startInputKey,
                                          overlay.key,
                                          "start",
                                          edit.start,
                                        )
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          commitSelectedTimeInput(
                                            startInputKey,
                                            overlay.key,
                                            "start",
                                            edit.start,
                                          );
                                          event.currentTarget.blur();
                                        } else if (event.key === "Escape") {
                                          setSelectedTimeInputDrafts((current) => {
                                            const next = { ...current };
                                            delete next[startInputKey];
                                            return next;
                                          });
                                          event.currentTarget.blur();
                                        }
                                      }}
                                      className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-200"
                                      aria-label="Indication start time"
                                    />
                                  </label>
                                  <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                                    Out
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={
                                        selectedTimeInputDrafts[endInputKey] ??
                                        formatPreciseTime(edit.end)
                                      }
                                      onChange={(event) => {
                                        setSelectedTimeInputDrafts((current) => ({
                                          ...current,
                                          [endInputKey]: event.target.value,
                                        }));
                                      }}
                                      onBlur={() =>
                                        commitSelectedTimeInput(
                                          endInputKey,
                                          overlay.key,
                                          "end",
                                          edit.end,
                                        )
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          commitSelectedTimeInput(
                                            endInputKey,
                                            overlay.key,
                                            "end",
                                            edit.end,
                                          );
                                          event.currentTarget.blur();
                                        } else if (event.key === "Escape") {
                                          setSelectedTimeInputDrafts((current) => {
                                            const next = { ...current };
                                            delete next[endInputKey];
                                            return next;
                                          });
                                          event.currentTarget.blur();
                                        }
                                      }}
                                      className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-200"
                                      aria-label="Indication end time"
                                    />
                                  </label>
                                  <select
                                    value={edit.category}
                                    onChange={(event) =>
                                      updateSelectedIndicationEdit(overlay.key, {
                                        category: event.target.value as ManualVisualAnnotation["category"],
                                      })
                                    }
                                    className="min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] text-slate-200"
                                    aria-label="Indication category"
                                  >
                                    {NATIVE_ANNOTATION_CATEGORIES.map((category) => (
                                      <option key={category} value={category}>
                                        {manualCategoryDisplayLabel(category)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="mb-1 flex flex-col gap-1">
                                <div className="flex flex-col gap-1">
                                  <select
                                    value={
                                      edit.label.toLowerCase() === "bystander"
                                        ? "by-stander"
                                        : NARRATIVE_AGENT_QUICK_CHOICES.includes(edit.label.toLowerCase())
                                        ? edit.label.toLowerCase()
                                        : knownCharacters.includes(edit.label)
                                        ? edit.label
                                        : "open tag"
                                    }
                                    onChange={(event) => {
                                      const val = event.target.value;
                                      if (val !== "open tag") {
                                        const isKnownCharacter = knownCharacters.includes(val);
                                        const isQuickAgentChoice =
                                          NARRATIVE_AGENT_QUICK_CHOICES.includes(val);
                                        updateSelectedIndicationEdit(overlay.key, {
                                          label: val,
                                          ...(isKnownCharacter || isQuickAgentChoice
                                            ? { category: "Identification" }
                                            : {}),
                                          identityAffirmation:
                                            isKnownCharacter ||
                                            isQuickAgentChoice ||
                                            edit.category === "Identification"
                                              ? val
                                              : edit.identityAffirmation,
                                        });
                                      }
                                    }}
                                    className="h-7 w-full rounded border border-cyan-700/70 bg-black/85 px-2 py-1 text-[11px] text-cyan-50"
                                    aria-label="Narrative Agent choice"
                                  >
                                    <option value="open tag">open tag</option>
                                    {knownCharacters.length > 0 && (
                                      <optgroup label="Known Narrative Agents">
                                        {knownCharacters.map((char: string) => (
                                          <option key={char} value={char}>
                                            {char}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    <optgroup label="Additional choices">
                                      {NARRATIVE_AGENT_QUICK_CHOICES.map((choice) => (
                                        <option key={choice} value={choice}>
                                          {choice}
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                                  <div className="grid grid-cols-[1fr_auto_auto] gap-1">
                                  <input
                                    type="text"
                                    value={edit.label}
                                    onChange={(event) =>
                                      updateSelectedIndicationEdit(overlay.key, {
                                        label: event.target.value,
                                        identityAffirmation:
                                          edit.category === "Identification"
                                            ? event.target.value
                                            : edit.identityAffirmation,
                                      })
                                    }
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => {
                                      event.stopPropagation();
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void saveSelectedIndication(overlay, {
                                          ...edit,
                                          label: event.currentTarget.value,
                                          identityAffirmation:
                                            edit.category === "Identification"
                                              ? event.currentTarget.value
                                              : edit.identityAffirmation,
                                        });
                                      }
                                    }}
                                    className="h-7 min-w-0 rounded border border-slate-700 bg-black/85 px-2 py-1 text-[11px] text-slate-100"
                                    placeholder="Write new Narrative Agent / open tag"
                                    aria-label="New Narrative Agent or open tag"
                                  />
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateSelectedIndicationEdit(overlay.key, {
                                        start: scrubValue,
                                      });
                                    }}
                                    className="rounded border border-slate-700 px-1 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                                  >
                                    In
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      cutSelectedIndicationOut(overlay.key, scrubValue);
                                    }}
                                    className="rounded bg-amber-900/45 px-1 py-0.5 text-[10px] text-amber-100 hover:bg-amber-800/65"
                                  >
                                    Out
                                  </button>
                                  </div>
                                </div>
                                <SecondOrderLabelAffirmationChips
                                  plan={analysisData?.secondOrderLabelProliferation}
                                  surface="bbox_roi_overlay"
                                  targetLabelFamilies={[
                                    edit.category,
                                    "Identification",
                                    "Expression",
                                    "Interaction",
                                    "Action",
                                    "Role",
                                    "Scene",
                                    "Episode",
                                  ]}
                                  timeSpan={{ start: edit.start, end: edit.end }}
                                  compact
                                  limit={3}
                                />
                                <div className="flex flex-wrap items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void saveSelectedIndication(overlay, edit);
                                    }}
                                    className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] text-emerald-100 hover:bg-emerald-800/70"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    title="Stretch indication to this frame, save this bbox keyframe, and close"
                                    aria-label="Stretch indication to current frame and save"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void saveSelectedIndicationAtFrame(
                                        overlay,
                                        edit,
                                        workingFrameTime,
                                      );
                                    }}
                                    className="rounded bg-cyan-900/50 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-800/70"
                                  >
                                    Save here
                                  </button>
                                  {overlay.modality === "object" ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void saveObjectBBoxCorrection();
                                        }}
                                        className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700/80 hover:text-slate-50"
                                      >
                                        Correct
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void dropObjectBBoxDetection();
                                        }}
                                        className="rounded bg-rose-900/40 px-1.5 py-0.5 text-[10px] text-rose-200 hover:bg-rose-800/55 hover:text-rose-50"
                                      >
                                        Drop
                                      </button>
                                    </>
                                  ) : overlay.modality === "manual" ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void removeNativeVisualAnnotation();
                                      }}
                                      className="rounded bg-rose-900/40 px-1.5 py-0.5 text-[10px] text-rose-200 hover:bg-rose-800/55 hover:text-rose-50"
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    data-vaa1-traceback-button="true"
                                    title="Open calm traceback source-chain drawer"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openTracebackForOverlay(overlay, edit);
                                    }}
                                    className="rounded border border-cyan-800/70 bg-black/40 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-950"
                                  >
                                    Traceback
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      seedForensicRoiFromOverlay(overlay, edit);
                                    }}
                                    className="rounded bg-cyan-900/50 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-800/70"
                                  >
                                    Use ROI
                                  </button>
                                  <button
                                    type="button"
                                    title="Prepare a governed candidate search from this evidence item"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateSelectedOverlayProliferation(overlay.key, {
                                        open: !proliferationLauncher.open,
                                      });
                                    }}
                                    className="rounded border border-cyan-800/70 bg-cyan-950/30 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-900/45"
                                  >
                                    Proliferate
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      closeSelectedOverlayEditor(overlay.key);
                                    }}
                                    className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                </div>
                                {proliferationLauncher.open ? (
                                  <div className="mt-1 rounded border border-cyan-900/60 bg-cyan-950/20 p-1.5">
                                    <div className="mb-1 text-[9px] text-cyan-100/80">
                                      Proliferate from this evidence. Results stay as quiet
                                      candidates until supported or corrected.
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                      <select
                                        value={proliferationLauncher.scope}
                                        onChange={(event) =>
                                          updateSelectedOverlayProliferation(overlay.key, {
                                            scope: event.target.value as ProliferationScope,
                                            message: undefined,
                                            requestProgress: 0,
                                            matchingProgress: 0,
                                            candidateCount: 0,
                                            candidates: [],
                                            error: undefined,
                                          })
                                        }
                                        className="min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] text-slate-200"
                                        aria-label="Proliferation scope"
                                      >
                                        {PROLIFERATION_SCOPE_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        value={proliferationLauncher.target}
                                        onChange={(event) =>
                                          updateSelectedOverlayProliferation(overlay.key, {
                                            target: event.target.value as ProliferationTarget,
                                            message: undefined,
                                            requestProgress: 0,
                                            matchingProgress: 0,
                                            candidateCount: 0,
                                            candidates: [],
                                            error: undefined,
                                          })
                                        }
                                        className="min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] text-slate-200"
                                        aria-label="Proliferation target"
                                      >
                                        {PROLIFERATION_TARGET_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          prepareProliferationFromOverlay(
                                            overlay,
                                            edit,
                                            proliferationLauncher,
                                            overlaySourceLabel || compactOverlayLabel,
                                          );
                                        }}
                                        className="rounded bg-cyan-900/50 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-800/70"
                                      >
                                        Prepare candidates
                                      </button>
                                      {proliferationLauncher.message ? (
                                        <span
                                          className={`text-[9px] ${
                                            proliferationLauncher.error
                                              ? "text-amber-200/90"
                                              : "text-cyan-200/80"
                                          }`}
                                        >
                                          {proliferationLauncher.message}
                                        </span>
                                      ) : null}
                                    </div>
                                    {proliferationLauncher.message ? (
                                      <div className="mt-1 space-y-1 text-[9px] text-cyan-100/80">
                                        <div>
                                          <div className="mb-0.5 flex items-center justify-between gap-2">
                                            <span>Request preparation</span>
                                            <span>{proliferationLauncher.requestProgress ?? 0}%</span>
                                          </div>
                                          <div className="h-1.5 overflow-hidden rounded bg-slate-800">
                                            <div
                                              className="h-full rounded bg-cyan-400"
                                              style={{
                                                width: `${clamp(
                                                  proliferationLauncher.requestProgress ?? 0,
                                                  0,
                                                  100,
                                                )}%`,
                                              }}
                                            />
                                          </div>
                                        </div>
                                        <div>
                                          <div className="mb-0.5 flex items-center justify-between gap-2">
                                            <span>Candidate matching</span>
                                            <span>{proliferationLauncher.matchingProgress ?? 0}%</span>
                                          </div>
                                          <div className="h-1.5 overflow-hidden rounded bg-slate-800">
                                            <div
                                              className="h-full rounded bg-amber-400/80"
                                              style={{
                                                width: `${clamp(
                                                  proliferationLauncher.matchingProgress ?? 0,
                                                  0,
                                                  100,
                                                )}%`,
                                              }}
                                            />
                                          </div>
                                          {proliferationLauncher.matchingProgress === 0 ? (
                                            <div className="mt-0.5 text-slate-500">
                                              Matching has not returned candidates yet.
                                            </div>
                                          ) : null}
                                        </div>
                                        {proliferationLauncher.candidates?.length ? (
                                          <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-cyan-900/50 bg-black/35 p-1.5">
                                            <div className="flex items-center justify-between gap-2 text-[9px] uppercase text-cyan-100/70">
                                              <span>Closest similar profiles</span>
                                              <span>{proliferationLauncher.candidateCount || 0}</span>
                                            </div>
                                            {orderVisibleProliferationCandidates(proliferationLauncher.candidates).slice(0, 8).map((candidate) => (
                                              <div
                                                key={candidate.candidate_id}
                                                className="rounded border border-slate-800 bg-slate-950/70 p-1 text-slate-300"
                                              >
                                                <div className="flex items-start justify-between gap-2">
                                                  <span className="min-w-0 truncate font-medium text-slate-100">
                                                    {candidate.label || candidate.evidence_id || "Candidate"}
                                                  </span>
                                                  <span className="shrink-0 rounded bg-cyan-950 px-1 text-cyan-100">
                                                    {Math.round(candidateProbability(candidate) * 100)}%
                                                  </span>
                                                </div>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[8px] text-slate-400">
                                                  <span className="rounded bg-cyan-950/80 px-1 text-cyan-100/85">
                                                    closest match
                                                  </span>
                                                  {isManualProliferationCandidate(candidate) ? (
                                                    <span className="rounded bg-slate-900 px-1 text-slate-500">
                                                      manual source
                                                    </span>
                                                  ) : (
                                                    <span className="rounded bg-emerald-950/60 px-1 text-emerald-100/80">
                                                      similar profile
                                                    </span>
                                                  )}
                                                  <span className="rounded bg-slate-900 px-1">
                                                    {formatCandidateSource(candidate.source_panel)}
                                                  </span>
                                                  {candidate.category ? (
                                                    <span className="rounded bg-slate-900 px-1">
                                                      {candidate.category}
                                                    </span>
                                                  ) : null}
                                                  <span className="rounded bg-slate-900 px-1">
                                                    {formatCandidateTime(candidate)}
                                                  </span>
                                                  <span className="rounded bg-amber-950/70 px-1 text-amber-100/80">
                                                    {candidate.review_state || "candidate"}
                                                  </span>
                                                </div>
                                                {candidate.closest_match?.components ? (
                                                  <div className="mt-0.5 grid grid-cols-3 gap-0.5 text-[8px] text-slate-500">
                                                    {[
                                                      ["time", candidate.closest_match.components.time_proximity],
                                                      ["space", candidate.closest_match.components.spatial_consistency],
                                                      ["track", candidate.closest_match.components.track_continuity],
                                                    ].map(([label, value]) => (
                                                      <span key={String(label)} className="truncate">
                                                        {label}:{" "}
                                                        {typeof value === "number"
                                                          ? `${Math.round(value * 100)}%`
                                                          : "open"}
                                                      </span>
                                                    ))}
                                                  </div>
                                                ) : null}
                                              </div>
                                            ))}
                                            {(proliferationLauncher.candidateCount || 0) > 8 ? (
                                              <div className="text-slate-500">
                                                +{(proliferationLauncher.candidateCount || 0) - 8} more
                                                candidate
                                                {(proliferationLauncher.candidateCount || 0) - 8 === 1
                                                  ? ""
                                                  : "s"}
                                              </div>
                                            ) : null}
                                          </div>
                                        ) : null}
                                        {proliferationLauncher.error ? (
                                          <div className="line-clamp-2 text-amber-200/80">
                                            {proliferationLauncher.error}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {renderedVideoRect &&
                  (nativeAnnotationMode || forensicRoiMode || visibleLockedForensicRoiBox) && (
                  <div
                    ref={nativeOverlayRef}
                    className={`absolute ${nativeAnnotationMode || forensicRoiMode ? "z-30" : "z-10"} cursor-crosshair`}
                    style={{
                      left: renderedVideoRect.x,
                      top: renderedVideoRect.y,
                      width: renderedVideoRect.width,
                      height: renderedVideoRect.height,
                      pointerEvents:
                        nativeAnnotationMode || forensicRoiMode
                          ? "auto"
                          : "none",
                    }}
                    onClick={(event) => {
                      if (nativeAnnotationMode || forensicRoiMode || !visibleLockedForensicRoiBox) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      openPanel("ToolsPanel", { videoId, workspace: "forensic" });
                      eventBus.emit("toolsWorkspaceOpen", { workspace: "forensic", videoId });
                    }}
                    onPointerDown={handleNativeAnnotationPointerDown}
                    onPointerMove={handleNativeAnnotationPointerMove}
                    onPointerUp={handleNativeAnnotationPointerUp}
                    onPointerLeave={handleNativeAnnotationPointerUp}
                    onWheel={handleForensicRoiWheel}
                    onContextMenu={handleForensicRoiContextMenu}
                  >
                    {forensicRoiMode && (
                      <div className="pointer-events-none absolute left-2 top-2 rounded border border-cyan-300/40 bg-black/70 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100">
                        Forensic ROI armed / {forensicRoiIntent} / drag box or draw new
                      </div>
                    )}
                    {(draftBox || visibleLockedForensicRoiBox) && (
                      <div
                        className={`absolute border-2 ${
                          forensicRoiMode
                            ? "border-cyan-300/90 bg-cyan-300/10"
                            : "border-amber-300/90 bg-amber-300/10"
                        }`}
                        style={{
                          left: `${((draftBox || visibleLockedForensicRoiBox)?.x ?? 0) * 100}%`,
                          top: `${((draftBox || visibleLockedForensicRoiBox)?.y ?? 0) * 100}%`,
                          width: `${((draftBox || visibleLockedForensicRoiBox)?.w ?? 0) * 100}%`,
                          height: `${((draftBox || visibleLockedForensicRoiBox)?.h ?? 0) * 100}%`,
                        }}
                      />
                    )}
                    {forensicRoiMenu && (
                      <div
                        className="absolute z-20 min-w-36 rounded border border-cyan-300/20 bg-[#101214] p-1 text-[11px] text-slate-200 shadow-xl"
                        style={{
                          left: forensicRoiMenu.x,
                          top: forensicRoiMenu.y,
                        }}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onPointerMove={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onPointerUp={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      >
                        {FORENSIC_ROI_INTENT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`block w-full rounded px-2 py-1 text-left hover:bg-cyan-300/10 ${
                              option.value === forensicRoiIntent
                                ? "text-cyan-100"
                                : "text-slate-300"
                            }`}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              chooseForensicRoiIntent(option.value);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : videoUrl && showCompareInPanel && compareSource ? (
              <>
                <div className="flex min-h-0 flex-col rounded-lg border border-slate-800 bg-black">
                  <div className="border-b border-slate-800 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
                      Current source
                    </div>
                    <div
                      className="mt-1 truncate text-[11px] text-[var(--ui-passive-text)]"
                      title={formatCompareSourceLabel(metadata?.name, displayName)}
                    >
                      {formatCompareSourceLabel(metadata?.name, displayName)}
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    <video
                      key={videoUrl}
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      className="h-full w-full object-contain"
                      onLoadedMetadata={() => {
                        if (!videoRef.current) {
                          return;
                        }
                        setDuration(videoRef.current.duration || 0);
                      }}
                      onTimeUpdate={() => {
                        if (!videoRef.current) {
                          return;
                        }
                        const nextTime = videoRef.current.currentTime;
                        setCurrentTime(nextTime);
                        if (Math.abs(nextTime - lastBroadcastTimeRef.current) >= 0.25) {
                          lastBroadcastTimeRef.current = nextTime;
                          eventBus.emit("videoTimeLineChanged", nextTime);
                        }
                      }}
                      onSeeked={() => {
                        if (!videoRef.current) {
                          return;
                        }
                        const nextTime = videoRef.current.currentTime;
                        setCurrentTime(nextTime);
                        lastBroadcastTimeRef.current = nextTime;
                        eventBus.emit("videoTimeLineChanged", nextTime);
                        syncCompareSide("main");
                      }}
                      onPlay={() => {
                        if (
                          linkedComparePlayback &&
                          compareVideoRef.current &&
                          !compareSyncLockRef.current
                        ) {
                          void compareVideoRef.current.play().catch(() => {});
                        }
                      }}
                      onPause={() => {
                        if (
                          linkedComparePlayback &&
                          compareVideoRef.current &&
                          !compareSyncLockRef.current &&
                          !videoRef.current?.ended
                        ) {
                          compareVideoRef.current.pause();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex min-h-0 flex-col rounded-lg border border-slate-800 bg-black">
                  <div className="border-b border-slate-800 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
                      Compare source
                    </div>
                    <div
                      className="mt-1 truncate text-[11px] text-[var(--ui-passive-text)]"
                      title={formatCompareSourceLabel(compareSource.name, "Compare source")}
                    >
                      {formatCompareSourceLabel(compareSource.name, "Compare source")}
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    {compareSource.videoUrl ? (
                      <video
                        key={compareSource.videoUrl}
                        ref={compareVideoRef}
                        src={compareSource.videoUrl}
                        controls
                        className="h-full w-full object-contain"
                        onLoadedMetadata={() => {
                          if (!compareVideoRef.current) {
                            return;
                          }
                          compareVideoRef.current.currentTime = compareSource.time;
                        }}
                        onSeeked={() => syncCompareSide("compare")}
                        onPlay={() => {
                          if (
                            linkedComparePlayback &&
                            videoRef.current &&
                            !compareSyncLockRef.current
                          ) {
                            void videoRef.current.play().catch(() => {});
                          }
                        }}
                        onPause={() => {
                          if (
                            linkedComparePlayback &&
                            videoRef.current &&
                            !compareSyncLockRef.current &&
                            !compareVideoRef.current?.ended
                          ) {
                            videoRef.current.pause();
                          }
                        }}
                      />
                    ) : (
                      <div className="p-4 text-center text-sm text-[var(--ui-passive-text)]">
                        Compare preview unavailable.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : isLoading ? (
              <div className="p-4 text-center text-slate-400">
                <div className="text-sm">Preparing video panel...</div>
              </div>
            ) : blobMissing ? (
              <div className="p-4 text-center text-slate-400">
                <div className="mb-2 text-lg">Video Not Available</div>
                <div className="text-sm">The video could not be loaded.</div>
                {metadata?.sourceVideoExists === false &&
                  metadata?.sourceVideoPath && (
                    <div className="mt-2 text-xs text-amber-300">
                      Restore the video to the saved path if you want playback with
                      this analysis.
                    </div>
                  )}
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleLocateMedia}
                    disabled={!videoId}
                  >
                    Locate Media...
                  </Button>
                </div>
                <div className="mt-2 text-xs text-[var(--ui-passive-text)]">
                  Choose the original video file from your computer to use it with
                  this analysis in the current browser.
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400">
                <div className="mb-2 text-lg">No Video Selected</div>
                <div className="text-sm">Select a video from the Project Panel</div>
              </div>
            )}
          </div>

          <div className="shrink-0 rounded-lg border border-slate-800 bg-[#141414] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-[11px] text-[var(--ui-passive-text)]">
                <span>
                  {formatPreciseTime(currentTime)} / {formatPreciseTime(duration)}
                </span>
                {sourceCueBits.length > 0 && (
                  <span>{sourceCueBits.join(" • ")}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  {
                    key: "objects" as const,
                    label: `Objects ${groupedDetectedObjects.length}`,
                  },
                  {
                    key: "ocr" as const,
                    label: `OCR ${ocrResults.length}`,
                  },
                  {
                    key: "expressions" as const,
                    label: `Expressions ${expressionResults.length}`,
                  },
                  {
                    key: "manual" as const,
                    label: `Native ${analysisData?.annotationCorrections?.manual_visual_annotations?.length || 0}`,
                  },
                ].map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    className={`rounded border px-2 py-1 text-[10px] transition ${
                      overlayToggles[toggle.key]
                        ? "border-slate-600 bg-slate-800/80 text-slate-200"
                        : "border-slate-800 text-[var(--ui-passive-text)] hover:bg-slate-800/40 hover:text-slate-300"
                    }`}
                    onClick={() =>
                      setOverlayToggles((previous) => ({
                        ...previous,
                        [toggle.key]: !previous[toggle.key],
                      }))
                    }
                  >
                    {toggle.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`rounded border px-2 py-1 text-[10px] transition ${
                    nativeAnnotationMode
                      ? "border-amber-400/70 bg-amber-400/15 text-amber-100"
                      : "border-slate-800 text-[var(--ui-passive-text)] hover:bg-slate-800/40 hover:text-slate-300"
                  }`}
                  onClick={() => {
                    if (nativeAnnotationMode) {
                      setNativeAnnotationMode(false);
                      resetNativeAnnotationDraft();
                      return;
                    }
                    setSelectedOverlayKey(null);
                    setNativeSaveMessage(null);
                    setForensicRoiMode(false);
                    setNativeAnnotationMode(true);
                  }}
                >
                  {nativeAnnotationMode ? "Cancel native" : "Native annotate"}
                </button>
              </div>
            </div>

            {nativeAnnotationMode && (
              <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-amber-100">
                    Draw a box on the video, then save the correction into VAA1.
                  </div>
                  <div className="text-[10px] text-amber-200/80">
                    Frame {formatPreciseTime(currentTime)}
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {nativeAnnotationDraft.category === "Genre" &&
                    nativeAnnotationDraft.subcategory.startsWith("Situational") && (
                      <div className="rounded border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-[11px] text-sky-100 md:col-span-2">
                        Situational genre is under active schema review. Save the
                        observation as evidence, but treat the label as analyst-provisional.
                      </div>
                    )}
                  <Select
                    value={nativeAnnotationDraft.category}
                    onValueChange={(value: ManualVisualAnnotation["category"]) => {
                      const nextSubcategory =
                        NATIVE_ANNOTATION_SUBCATEGORIES[value]?.slice().sort((left, right) =>
                          left.localeCompare(right, undefined, { sensitivity: "base" }),
                        )[0] || "";
                      setNativeAnnotationDraft((current) => ({
                        ...current,
                        category: value,
                        subcategory: nextSubcategory,
                        readyLabel: "",
                        label: "",
                        mediaGenreParent:
                          value === "Genre"
                            ? current.mediaGenreParent ||
                              analysisData?.metadata?.sourceAnnotations?.genre ||
                              ""
                            : current.mediaGenreParent,
                        situationalGenreParent:
                          value === "Genre"
                            ? current.situationalGenreParent ||
                              analysisData?.metadata?.sourceAnnotations?.situational_genre ||
                              ""
                            : current.situationalGenreParent,
                      }));
                    }}
                  >
                    <SelectTrigger className="border-amber-400/20 bg-[#111214] text-slate-100">
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent className="border-amber-400/20 bg-[#111214] text-slate-100">
                      {NATIVE_ANNOTATION_CATEGORIES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {manualCategoryDisplayLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={nativeAnnotationDraft.subcategory}
                    onValueChange={(value) =>
                      setNativeAnnotationDraft((current) => ({
                        ...current,
                        subcategory: value,
                        readyLabel: "",
                        label: "",
                        mediaGenreParent:
                          value === "Media subgenre" || value === "Media genre"
                            ? current.mediaGenreParent
                            : current.mediaGenreParent,
                        situationalGenreParent:
                          value === "Situational subgenre" ||
                          value === "Situational genre" ||
                          value === "Situational taxonomy"
                            ? current.situationalGenreParent
                            : current.situationalGenreParent,
                      }))
                    }
                  >
                    <SelectTrigger className="border-amber-400/20 bg-[#111214] text-slate-100">
                      <SelectValue placeholder="Choose subcategory" />
                    </SelectTrigger>
                    <SelectContent className="border-amber-400/20 bg-[#111214] text-slate-100">
                      {nativeSubcategoryOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {manualSubcategoryDisplayLabel(nativeAnnotationDraft.category, option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={nativeAnnotationDraft.readyLabel}
                    onValueChange={(value) =>
                      setNativeAnnotationDraft((current) => ({
                        ...current,
                        readyLabel: value,
                        label: value === CUSTOM_LABEL_VALUE ? current.label : "",
                      }))
                    }
                  >
                    <SelectTrigger className="border-amber-400/20 bg-[#111214] text-slate-100">
                      <SelectValue placeholder="Choose label" />
                    </SelectTrigger>
                    <SelectContent className="border-amber-400/20 bg-[#111214] text-slate-100">
                      {nativeReadyLabelOptions.map((option) => (
                        <SelectItem
                          key={option}
                          value={option === "Custom..." ? CUSTOM_LABEL_VALUE : option}
                        >
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {nativeAnnotationDraft.category === "Genre" &&
                    nativeAnnotationDraft.subcategory === "Media subgenre" && (
                      <Select
                        value={nativeAnnotationDraft.mediaGenreParent}
                        onValueChange={(value) =>
                          setNativeAnnotationDraft((current) => ({
                            ...current,
                            mediaGenreParent: value,
                            readyLabel: "",
                            label: "",
                          }))
                        }
                      >
                        <SelectTrigger className="border-amber-400/20 bg-[#111214] text-slate-100">
                          <SelectValue placeholder="Choose media genre first" />
                        </SelectTrigger>
                        <SelectContent className="border-amber-400/20 bg-[#111214] text-slate-100">
                          {getMediaGenreOptions().map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  {nativeAnnotationDraft.category === "Genre" &&
                    nativeAnnotationDraft.subcategory === "Situational subgenre" && (
                      <Select
                        value={nativeAnnotationDraft.situationalGenreParent}
                        onValueChange={(value) =>
                          setNativeAnnotationDraft((current) => ({
                            ...current,
                            situationalGenreParent: value,
                            readyLabel: "",
                            label: "",
                          }))
                        }
                      >
                        <SelectTrigger className="border-amber-400/20 bg-[#111214] text-slate-100">
                          <SelectValue placeholder="Choose situational genre first" />
                        </SelectTrigger>
                        <SelectContent className="border-amber-400/20 bg-[#111214] text-slate-100">
                          {getSituationalGenreOptions().map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
	                      </Select>
	                    )}
	                  {showNativeNarrativeAgentPicker && (
	                    <div className="flex flex-col gap-1 md:col-span-2">
	                      <select
	                        value={
	                          nativeAnnotationDraft.label.toLowerCase() === "bystander"
	                            ? "by-stander"
	                            : NARRATIVE_AGENT_QUICK_CHOICES.includes(
	                                nativeAnnotationDraft.label.toLowerCase(),
	                              )
	                            ? nativeAnnotationDraft.label.toLowerCase()
	                            : knownCharacters.includes(nativeAnnotationDraft.label)
	                            ? nativeAnnotationDraft.label
	                            : "open tag"
	                        }
	                        onChange={(event) => {
	                          const val = event.target.value;
	                          if (val !== "open tag") {
	                            const isKnownCharacter = knownCharacters.includes(val);
	                            const isQuickAgentChoice =
	                              NARRATIVE_AGENT_QUICK_CHOICES.includes(val);
	                            setNativeAnnotationDraft((current) => ({
	                              ...current,
	                              label: val,
	                              readyLabel: CUSTOM_LABEL_VALUE,
	                              ...(isKnownCharacter || isQuickAgentChoice
	                                ? { category: "Identification", subcategory: "Character" }
	                                : {}),
	                              identityAffirmation:
	                                isKnownCharacter ||
	                                isQuickAgentChoice ||
	                                current.category === "Identification"
	                                  ? val
	                                  : current.identityAffirmation,
	                            }));
	                          }
	                        }}
	                        className="w-full rounded border border-amber-400/50 bg-[#111214] px-3 py-2 text-sm text-amber-50"
	                        aria-label="Narrative Agent choice"
	                      >
	                        <option value="open tag">open tag</option>
	                        {knownCharacters.length > 0 && (
	                          <optgroup label="Known Narrative Agents">
	                            {knownCharacters.map((char: string) => (
	                              <option key={char} value={char}>
	                                {char}
	                              </option>
	                            ))}
	                          </optgroup>
	                        )}
	                        <optgroup label="Additional choices">
	                          {NARRATIVE_AGENT_QUICK_CHOICES.map((choice) => (
	                            <option key={choice} value={choice}>
	                              {choice}
	                            </option>
	                          ))}
	                        </optgroup>
	                      </select>
	                      <Input
	                        value={nativeAnnotationDraft.label}
	                        onChange={(event) =>
	                          setNativeAnnotationDraft((current) => ({
	                            ...current,
	                            label: event.target.value,
	                            readyLabel: CUSTOM_LABEL_VALUE,
	                            identityAffirmation: event.target.value,
	                          }))
	                        }
	                        placeholder="Write new Narrative Agent / open tag"
	                        className="border-amber-400/35 bg-[#111214] text-slate-100"
	                        aria-label="New Narrative Agent or open tag"
	                      />
	                    </div>
	                  )}
	                  <Input
	                    value={nativeAnnotationDraft.identityAffirmation}
                    onChange={(event) =>
                      setNativeAnnotationDraft((current) => ({
                        ...current,
                        identityAffirmation: event.target.value,
                      }))
                    }
                    placeholder="Narrative Agent label"
                    className="border-amber-400/20 bg-[#111214] text-slate-100"
                  />
	                  {nativeAnnotationDraft.readyLabel === CUSTOM_LABEL_VALUE &&
	                    !showNativeNarrativeAgentPicker && (
                    <div className="flex flex-col gap-1 md:col-span-2">
	                      <select
	                        value={
	                          nativeAnnotationDraft.label.toLowerCase() === "bystander"
	                            ? "by-stander"
	                            : NARRATIVE_AGENT_QUICK_CHOICES.includes(nativeAnnotationDraft.label.toLowerCase())
	                            ? nativeAnnotationDraft.label.toLowerCase()
	                            : knownCharacters.includes(nativeAnnotationDraft.label)
	                            ? nativeAnnotationDraft.label
	                            : "open tag"
                        }
                        onChange={(event) => {
	                          const val = event.target.value;
	                          if (val !== "open tag") {
	                            const isKnownCharacter = knownCharacters.includes(val);
	                            const isQuickAgentChoice =
	                              NARRATIVE_AGENT_QUICK_CHOICES.includes(val);
	                            setNativeAnnotationDraft((current) => ({
	                              ...current,
	                              label: val,
	                              ...(isKnownCharacter || isQuickAgentChoice
	                                ? { category: "Identification", subcategory: "Character" }
	                                : {}),
	                              identityAffirmation:
	                                isKnownCharacter ||
	                                isQuickAgentChoice ||
	                                current.category === "Identification"
	                                  ? val
	                                  : current.identityAffirmation,
	                            }));
                          }
                        }}
	                        className="w-full rounded border border-amber-400/20 bg-[#111214] px-3 py-2 text-sm text-slate-100"
	                        aria-label="Narrative Agent choice"
	                      >
	                        <option value="open tag">open tag</option>
	                        {knownCharacters.length > 0 && (
	                          <optgroup label="Known Narrative Agents">
	                            {knownCharacters.map((char: string) => (
	                              <option key={char} value={char}>
	                                {char}
                              </option>
	                            ))}
	                          </optgroup>
	                        )}
	                        <optgroup label="Additional choices">
	                          {NARRATIVE_AGENT_QUICK_CHOICES.map((choice) => (
	                            <option key={choice} value={choice}>
	                              {choice}
	                            </option>
	                          ))}
	                        </optgroup>
	                      </select>
                      <Input
                        value={nativeAnnotationDraft.label}
                        onChange={(event) =>
                          setNativeAnnotationDraft((current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
	                        placeholder="Write new Narrative Agent / open tag"
                        className="border-amber-400/20 bg-[#111214] text-slate-100"
                      />
                    </div>
                  )}
                  <Input
                    value={nativeAnnotationDraft.roleAffirmation}
                    onChange={(event) =>
                      setNativeAnnotationDraft((current) => ({
                        ...current,
                        roleAffirmation: event.target.value,
                      }))
                    }
                    placeholder="Role affirmation"
                    className="border-amber-400/20 bg-[#111214] text-slate-100"
                  />
                  <Input
                    value={nativeAnnotationDraft.audioFoleyNote}
                    onChange={(event) =>
                      setNativeAnnotationDraft((current) => ({
                        ...current,
                        audioFoleyNote: event.target.value,
                      }))
                    }
                    placeholder="Audio foley note"
                    className="border-amber-400/20 bg-[#111214] text-slate-100"
                  />
                </div>
                <Textarea
                  value={nativeAnnotationDraft.openNote}
                  onChange={(event) =>
                    setNativeAnnotationDraft((current) => ({
                      ...current,
                      openNote: event.target.value,
                    }))
                  }
                  placeholder="Open note"
                  className="mt-2 min-h-[72px] border-amber-400/20 bg-[#111214] text-slate-100"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-amber-100/80">
                  <span>
                    {draftBox
                      ? `box ${draftBox.w.toFixed(3)} × ${draftBox.h.toFixed(3)}`
                      : "no box drawn yet"}
                  </span>
                  <span>
                    {manualCategoryDisplayLabel(nativeAnnotationDraft.category)} /{" "}
                    {manualSubcategoryDisplayLabel(
                      nativeAnnotationDraft.category,
                      nativeAnnotationDraft.subcategory,
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void saveNativeVisualAnnotation()}
                    disabled={
                      !draftBox ||
                      !(
                        (nativeAnnotationDraft.readyLabel &&
                          nativeAnnotationDraft.readyLabel !== CUSTOM_LABEL_VALUE) ||
                        nativeAnnotationDraft.label.trim()
                      )
                    }
                  >
                    Save native annotation
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setNativeAnnotationMode(false);
                      resetNativeAnnotationDraft();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {nativeSaveMessage && (
              <div className="mt-2 rounded border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-100">
                {nativeSaveMessage}
              </div>
            )}

            <div className="relative mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--ui-passive-text)]">
              <button
                type="button"
                className="hover:text-slate-300"
                onClick={() => {
                  openPanel("ToolsPanel");
                  window.setTimeout(() => {
                    eventBus.emit("toolsSectionFocus", "visual");
                  }, 40);
                }}
              >
                Visual cues
              </button>
              {activeInspectorKey && (
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => {
                    closeVisualCueInspectors();
                  }}
                >
                  hide cue
                </button>
              )}

              {activeInspectorKey && (
                <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-md border border-slate-800 bg-[#111214]/95 px-3 py-2 shadow-2xl backdrop-blur">
                  {activeInspectorKey === "shot" && (
                    <>
                      {currentShotSizeEstimate && (
                        <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                          Current frame estimate: {currentShotSizeEstimate.label}
                        </div>
                      )}
                      {nearbyShotSizeSamples.length > 0 && (
                        <>
                          <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                            Nearby confirmations
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {nearbyShotSizeSamples.map((sample, index) => (
                              <button
                                key={`${sample.timestamp}-${sample.label}-${index}`}
                                type="button"
                                className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1 text-left text-[10px] text-[var(--ui-passive-text)] hover:bg-slate-800/40 hover:text-slate-300"
                                onClick={() => jumpToTime(sample.timestamp)}
                              >
                                <div>{formatTime(sample.timestamp)}</div>
                                <div>{sample.label}</div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {activeInspectorKey === "frame" && (
                    <>
                      <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                        Provisional frame class
                      </div>
                      <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1 text-[10px] text-[var(--ui-passive-text)]">
                        {currentFrameClass}
                      </div>
                    </>
                  )}

                  {activeInspectorKey === "spatial" && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {currentSpatialScan.entries.length > 0 ? (
                          currentSpatialScan.entries.map((entry) => (
                            <div
                              key={entry.zone}
                              className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1"
                            >
                              <div>{entry.zone}</div>
                              <div>
                                p {entry.people} • t {entry.text} • o {entry.objects}
                              </div>
                              {typeof entry.occupancy === "number" && (
                                <div>mass {entry.occupancy.toFixed(2)}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div>No active spatial indicators in this frame.</div>
                        )}
                      </div>
                    </>
                  )}

                  {activeInspectorKey === "text" && (
                    <>
                      <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                        Text present: {currentTextGraphicScan.textPresent ? "yes" : "no"}
                      </div>
                      <div className="mb-2 flex flex-wrap gap-2 text-[10px] text-[var(--ui-passive-text)]">
                        <span>subtitle-like {currentTextGraphicScan.subtitleLikeCount}</span>
                        <span>title-like {currentTextGraphicScan.titleLikeCount}</span>
                        <span>corner-like {currentTextGraphicScan.cornerLikeCount}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentTextGraphicScan.zoneDistribution.map(([zone, count]) => (
                          <div
                            key={zone}
                            className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1"
                          >
                            <div>{zone}</div>
                            <div>{count} hits</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {activeInspectorKey === "human" && (
                    <>
                      <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                        {currentHumanPresenceScan.label} • {currentHumanPresenceScan.faceVisibility}
                      </div>
                      <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1 text-[10px] text-[var(--ui-passive-text)]">
                        persons {currentHumanPresenceScan.personCount}
                        {currentHumanPresenceScan.fallbackCount > 0
                          ? ` / fallback ${currentHumanPresenceScan.fallbackCount}`
                          : ""}
                      </div>
                    </>
                  )}

                  {activeInspectorKey === "margin" && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(currentMarginScan).map(([zone, count]) => (
                        <div
                          key={zone}
                          className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1"
                        >
                          <div>{zone}</div>
                          <div>{count}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeInspectorKey === "corner" && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(currentCornerScan).map(([zone, count]) => (
                        <div
                          key={zone}
                          className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1"
                        >
                          <div>{zone}</div>
                          <div>{count}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeInspectorKey === "depth" && (
                    <>
                      <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                        foreground {currentDepthScan.counts.foreground} • midground {currentDepthScan.counts.midground} • background {currentDepthScan.counts.background}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentDepthScan.entries.length > 0 ? (
                          currentDepthScan.entries.map((entry, index) => (
                            <div
                              key={`${entry.label}-${entry.layer}-${index}`}
                              className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1"
                            >
                              <div>{entry.label}</div>
                              <div>{entry.layer}</div>
                              <div>mass {entry.areaShare.toFixed(2)}</div>
                            </div>
                          ))
                        ) : (
                          <div>No active depth indicators in this frame.</div>
                        )}
                      </div>
                    </>
                  )}

                  {activeInspectorKey === "lighting" && (
                    <>
                      {currentLightingScan.available ? (
                        <>
                          <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                            {currentLightingScan.brightness} • {currentLightingScan.contrast}
                          </div>
                          {typeof currentLightingScan.avgBrightness === "number" && (
                            <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                              mean {currentLightingScan.avgBrightness.toFixed(0)}
                              {typeof currentLightingScan.brightnessRange === "number" &&
                                ` • range ${currentLightingScan.brightnessRange.toFixed(0)}`}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                              dark {currentLightingScan.spread.dark}
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                              mid {currentLightingScan.spread.mid}
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                              bright {currentLightingScan.spread.bright}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-[var(--ui-passive-text)]">
                          No lighting sample yet.
                        </div>
                      )}
                    </>
                  )}

                  {activeInspectorKey === "color" && (
                    <>
                      <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                        {currentColorRegimeScan.temperature} • {currentColorRegimeScan.saturation}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-[var(--ui-passive-text)]">
                        <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                          palette {currentColorRegimeScan.dominantPaletteBlock}
                        </div>
                        <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                          {currentColorRegimeScan.paletteShift}
                        </div>
                      </div>
                    </>
                  )}

                  {activeInspectorKey === "clutter" && (
                    <>
                      <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                        {currentVisualClutterScan.label}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-[var(--ui-passive-text)]">
                        <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                          items {currentVisualClutterScan.itemCount}
                        </div>
                        <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                          mass {currentVisualClutterScan.occupancyMass.toFixed(2)}
                        </div>
                      </div>
                    </>
                  )}

                  {activeInspectorKey === "motion" && (
                    <>
                      <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                        {currentMotionScan.label}
                      </div>
                      {currentMotionScan.sample?.activity_label && (
                        <div className="mb-2 rounded border border-slate-800 bg-slate-950/20 px-2 py-1 text-[10px] text-[var(--ui-passive-text)]">
                          activity {currentMotionScan.sample.activity_label}
                        </div>
                      )}
                      {typeof currentMotionScan.diff === "number" && (
                        <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1 text-[10px] text-[var(--ui-passive-text)]">
                          diff {currentMotionScan.diff.toFixed(1)}
                        </div>
                      )}
                      {currentMotionScan.sample && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[var(--ui-passive-text)]">
                          {typeof currentMotionScan.sample.occupancy_shift === "number" && (
                            <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                              occupancy shift {currentMotionScan.sample.occupancy_shift.toFixed(2)}
                            </div>
                          )}
                          {typeof currentMotionScan.sample.foreground_delta === "number" && (
                            <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                              foreground {currentMotionScan.sample.foreground_delta.toFixed(2)}
                            </div>
                          )}
                          {typeof currentMotionScan.sample.background_delta === "number" && (
                            <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                              background {currentMotionScan.sample.background_delta.toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                      {currentMotionScan.summary && (
                        <div className="mt-2 text-[10px] text-[var(--ui-passive-text)]">
                          dominant {currentMotionScan.summary.dominant_motion || "unknown"} •
                          samples {currentMotionScan.summary.sample_count ?? 0} •
                          high motion {currentMotionScan.summary.high_motion_samples ?? 0}
                        </div>
                      )}
                      {currentMotionScan.activeScene && (
                        <div className="mt-2 text-[10px] text-[var(--ui-passive-text)]">
                          scene {currentMotionScan.activeScene.scene_index} •{" "}
                          {formatTime(currentMotionScan.activeScene.start)} to{" "}
                          {formatTime(currentMotionScan.activeScene.end)}
                        </div>
                      )}
                    </>
                  )}

                  {activeInspectorKey === "transition" && (
                    <>
                      <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                        {currentTransitionScan.label}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-[var(--ui-passive-text)]">
                        {typeof currentTransitionScan.frameDiff === "number" && (
                          <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                            diff {currentTransitionScan.frameDiff.toFixed(1)}
                          </div>
                        )}
                        {typeof currentTransitionScan.toneShift === "number" && (
                          <div className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1">
                            tone shift {currentTransitionScan.toneShift.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {activeInspectorKey === "tone" && (
                    <>
                      {currentToneSample?.timestamp !== undefined && (
                        <div className="mb-2 text-[10px] text-[var(--ui-passive-text)]">
                          Nearest tone sample {formatTime(currentToneSample.timestamp)}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(toneScanZones || {}).map(
                          ([zone, tone]) => (
                            <div
                              key={zone}
                              className="rounded border border-slate-800 bg-slate-950/20 px-2 py-1"
                            >
                              <div>{zone}</div>
                              <div>{tone.dominant_tone}</div>
                              <div>
                                {tone.brightness_band || "mid"} •{" "}
                                {tone.saturation_band || "moderate"}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {activeInspectorKey && <div className="mt-[7.5rem]" />}

            {videoUrl && duration > 0 && (
              <div className="mt-3">
                <div className="relative">
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.001}
                    value={currentTime}
                    onChange={(event) => jumpToTime(Number(event.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-slate-500"
                    aria-label="Video timeline"
                  />
                  <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2">
                    {transcriptMarkers.map((time) => (
                      <span
                        key={`transcript-${time}`}
                        className="absolute h-2 w-[2px] rounded bg-slate-300/80"
                        style={{ left: `${(time / duration) * 100}%` }}
                      />
                    ))}
                    {objectMarkers.map((time) => (
                      <span
                        key={`object-${time}`}
                        className="absolute h-2 w-[2px] rounded bg-cyan-400/80"
                        style={{ left: `${(time / duration) * 100}%` }}
                      />
                    ))}
                    {ocrMarkers.map((time) => (
                      <span
                        key={`ocr-${time}`}
                        className="absolute h-2 w-[2px] rounded bg-emerald-400/80"
                        style={{ left: `${(time / duration) * 100}%` }}
                      />
                    ))}
                    {expressionMarkers.map((time) => (
                      <span
                        key={`expression-${time}`}
                        className="absolute h-2 w-[2px] rounded bg-fuchsia-400/80"
                        style={{ left: `${(time / duration) * 100}%` }}
                      />
                    ))}
                    {singleSourceMarks.a !== undefined && (
                      <span
                        className="absolute h-3 w-[3px] rounded bg-amber-300"
                        style={{ left: `${(singleSourceMarks.a / duration) * 100}%` }}
                      />
                    )}
                    {singleSourceMarks.b !== undefined && (
                      <span
                        className="absolute h-3 w-[3px] rounded bg-violet-300"
                        style={{ left: `${(singleSourceMarks.b / duration) * 100}%` }}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--ui-passive-text)]">
                  <span className="uppercase tracking-[0.12em] text-[#8f8f8f]">
                    Fine seek
                  </span>
                  {[
                    { label: "-1s", delta: -1 },
                    { label: "-100ms", delta: -0.1 },
                    { label: "-40ms", delta: -0.04 },
                    { label: "+40ms", delta: 0.04 },
                    { label: "+100ms", delta: 0.1 },
                    { label: "+1s", delta: 1 },
                  ].map((step) => (
                    <button
                      key={step.label}
                      type="button"
                      className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                      onClick={() => nudgeTime(step.delta)}
                    >
                      {step.label}
                    </button>
                  ))}
                </div>

                {audioTimelineMarkers.length > 0 && (
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-[var(--ui-passive-text)]">
                      <span>Audio lane</span>
                      <span>Role, turn, overlap, emphasis, environment</span>
                    </div>
                    <div className="relative h-3 rounded-full border border-slate-800 bg-slate-950/80">
                      {audioTimelineMarkers.map((marker) => (
                        <button
                          key={marker.key}
                          type="button"
                          className={`absolute top-1/2 h-2 w-[3px] -translate-y-1/2 rounded-full ${marker.colorClass} transition hover:h-3 hover:w-1`}
                          style={{ left: `${(marker.time / duration) * 100}%` }}
                          title={`${marker.label}: ${marker.detail} @ ${formatTime(marker.time)}`}
                          onClick={() => jumpToTime(marker.time)}
                          aria-label={`${marker.label} at ${formatTime(marker.time)}`}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-[var(--ui-passive-text)]">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-teal-300/85" />
                        Role cue
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-sky-300/85" />
                        Turn
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-300/85" />
                        Overlap
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-300/90" />
                        Emphasis
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
                        Environment
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--ui-passive-text)]">
                    <button
                      type="button"
                      className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                      onClick={() => setSingleSourceMark("a")}
                    >
                      Mark A
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                      onClick={() => setSingleSourceMark("b")}
                    >
                      Mark B
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                      onClick={clearSingleSourceMarks}
                    >
                      Clear A/B
                    </button>
                    {singleSourceMarks.a !== undefined && (
                      <span>A {formatTime(singleSourceMarks.a)}</span>
                    )}
                    {singleSourceMarks.b !== undefined && (
                      <span>B {formatTime(singleSourceMarks.b)}</span>
                    )}
                    {compareDelta !== null && <span>Delta {formatTime(compareDelta)}</span>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--ui-passive-text)]">
                    <button
                      type="button"
                      className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                      onClick={setCrossSourceCompareAnchor}
                    >
                      Set Compare Anchor
                    </button>
                    {compareAnchor && (
                      <>
                        <span
                          className="truncate"
                          title={`${compareAnchor.name} @ ${formatTime(compareAnchor.time)}`}
                        >
                          {compareAnchor.videoId === videoId
                            ? `Anchor here @ ${formatTime(compareAnchor.time)}`
                            : `${compareAnchor.name} @ ${formatTime(compareAnchor.time)}`}
                        </span>
                        {!showCompareInPanel && (
                          <button
                            type="button"
                            className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                            onClick={openCompareAnchor}
                          >
                            Jump to anchor
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                          onClick={openCompareView}
                          disabled={!compareReady}
                        >
                          {showCompareInPanel ? "Synced compare open" : "Start synced compare"}
                        </button>
                        {showCompareInPanel && compareReady && (
                          <>
                            <button
                              type="button"
                              className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                              onClick={playSyncCompare}
                            >
                              Play sync
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                              onClick={pauseSyncCompare}
                            >
                              Pause sync
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                              onClick={() => setLinkedComparePlayback((value) => !value)}
                            >
                              {linkedComparePlayback ? "Sync playback on" : "Sync playback off"}
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                              onClick={syncCompareToReferences}
                            >
                              Reset sync
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                              onClick={() => setShowCompareInPanel(false)}
                            >
                              Close Compare
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="rounded border border-slate-800 px-2 py-1 hover:bg-slate-800/40 hover:text-slate-300"
                          onClick={clearCompareAnchor}
                        >
                          Clear Anchor
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-[var(--ui-passive-text)]">
                  {compareInstruction}
                </div>

                {(activeTranscriptSegment || nearbyTranscriptSegments.length > 0) && (
                  <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      {activeTranscriptSegment && (
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 uppercase tracking-[0.14em] text-[10px] text-[var(--ui-passive-text)]">
                            Current cue
                          </div>
                          <div
                            className="truncate text-slate-300"
                            title={activeTranscriptSegment.text}
                          >
                            {activeTranscriptSegment.text}
                          </div>
                          <div className="mt-1 text-[10px]">
                            {formatTime(activeTranscriptSegment.start)} -{" "}
                            {formatTime(activeTranscriptSegment.end)}
                          </div>
                        </div>
                      )}

                      {nearbyTranscriptSegments.length > 0 && (
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 uppercase tracking-[0.14em] text-[10px] text-[var(--ui-passive-text)]">
                            Cue jumps
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {nearbyTranscriptSegments.map((segment) => (
                              <button
                                key={`${segment.start}-${segment.end}`}
                                type="button"
                                className="max-w-[220px] rounded border border-slate-800 bg-slate-950/20 px-2 py-1 text-left text-[10px] text-[var(--ui-passive-text)] hover:bg-slate-800/40 hover:text-slate-300"
                                onClick={() => jumpToTime(segment.start)}
                                title={segment.text}
                              >
                                <div>{formatTime(segment.start)}</div>
                                <div className="truncate">{segment.text}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {metadata?.sourceVideoPath && (
                  <div className="mt-2 text-[10px] text-[var(--ui-passive-text)]">
                    <span className="mr-2 uppercase tracking-[0.14em]">Source</span>
                    <span className="truncate align-middle" title={metadata.sourceVideoPath}>
                      {metadata.sourceVideoPath}
                    </span>
                    {metadata.sourceVideoExists === false &&
                      metadata.sourceVideoMessage && (
                        <span className="ml-2 text-amber-300">
                          {metadata.sourceVideoMessage}
                        </span>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
