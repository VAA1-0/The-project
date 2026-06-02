import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import type {
  AnnotationCorrectionRule,
  AnnotationCorrections,
  ManualVisualAnnotation,
  ManualTranscriptEntry,
} from "./api-service";

const POS_MATRIX_ANALYSES_STORAGE_KEY = "vaa1.pos.matrix.analyses";
const QUANT_MATRIX_ANALYSES_STORAGE_KEY = "vaa1.quant.matrix.analyses";
const CORRECTION_HISTORY_PREFIX = "vaa1.annotation.corrections.history.";
export const DROP_CORRECTION_VALUE = "__drop__";

export function createEmptyCorrections(
  existing?: AnnotationCorrections | null,
): AnnotationCorrections {
  return {
    analysis_id: existing?.analysis_id,
    version: 1,
    updated_at: new Date().toISOString(),
    updated_by: "analyst",
    text_substitutions: [],
    label_overrides: [],
    manual_transcript_entries: [],
    manual_visual_annotations: [],
    proliferation_decisions: [],
    master_schema_presence_intervals: [],
  };
}

function getCorrectionHistoryKey(videoId: string): string {
  return `${CORRECTION_HISTORY_PREFIX}${videoId}`;
}

function cloneCorrections(
  corrections: AnnotationCorrections | null | undefined,
): AnnotationCorrections | null {
  if (!corrections) {
    return null;
  }
  return JSON.parse(JSON.stringify(corrections)) as AnnotationCorrections;
}

export function buildCorrectionRule(
  modality: AnnotationCorrectionRule["modality"],
  rawValue: string,
  correctedValue: string,
  note = "",
  options?: {
    targetTimestamp?: number;
    targetStartTimestamp?: number;
    targetEndTimestamp?: number;
    targetTrackId?: number;
  },
): AnnotationCorrectionRule {
  const scopePart = [
    options?.targetTrackId !== undefined ? `track:${options.targetTrackId}` : "",
    options?.targetStartTimestamp !== undefined
      ? `start:${Number(options.targetStartTimestamp).toFixed(2)}`
      : "",
    options?.targetEndTimestamp !== undefined
      ? `end:${Number(options.targetEndTimestamp).toFixed(2)}`
      : "",
    options?.targetTimestamp !== undefined
      ? `ts:${Number(options.targetTimestamp).toFixed(2)}`
      : "",
  ]
    .filter(Boolean)
    .join(":");
  return {
    id: `${modality}:${rawValue.trim().toLowerCase()}${scopePart ? `:${scopePart}` : ""}`,
    modality,
    raw_value: rawValue,
    corrected_value: correctedValue,
    target_timestamp: options?.targetTimestamp,
    target_start_timestamp: options?.targetStartTimestamp,
    target_end_timestamp: options?.targetEndTimestamp,
    target_track_id: options?.targetTrackId,
    note,
    updated_at: new Date().toISOString(),
    updated_by: "analyst",
  };
}

export function mergeCorrectionRule(
  existing: AnnotationCorrections | null | undefined,
  rule: AnnotationCorrectionRule,
): AnnotationCorrections {
  const next: AnnotationCorrections = {
    ...(existing || {}),
    version: 1,
    updated_at: new Date().toISOString(),
    updated_by: "analyst",
    text_substitutions: [...(existing?.text_substitutions || [])],
    label_overrides: [...(existing?.label_overrides || [])],
    manual_visual_annotations: [...(existing?.manual_visual_annotations || [])],
    proliferation_decisions: [...(existing?.proliferation_decisions || [])],
  };

  const targetKey =
    rule.modality === "text" ? "text_substitutions" : "label_overrides";
  const current = [...(next[targetKey] || [])];
  const index = current.findIndex((entry) => entry.id === rule.id);
  if (index >= 0) {
    current[index] = rule;
  } else {
    current.push(rule);
  }
  next[targetKey] = current;
  return next;
}

export function buildDropCorrectionRule(
  modality: AnnotationCorrectionRule["modality"],
  rawValue: string,
  options?: {
    targetTimestamp?: number;
    targetStartTimestamp?: number;
    targetEndTimestamp?: number;
    targetTrackId?: number;
  },
): AnnotationCorrectionRule {
  return buildCorrectionRule(modality, rawValue, DROP_CORRECTION_VALUE, "", options);
}

export function pushCorrectionSnapshot(
  videoId: string,
  corrections: AnnotationCorrections | null | undefined,
) {
  if (!videoId || typeof window === "undefined") {
    return;
  }
  try {
    const storageKey = getCorrectionHistoryKey(videoId);
    const current = JSON.parse(
      window.localStorage.getItem(storageKey) || "[]",
    ) as Array<AnnotationCorrections | null>;
    const next = [...current, cloneCorrections(corrections)].slice(-12);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {}
}

export function canUndoCorrectionSnapshot(videoId: string): boolean {
  if (!videoId || typeof window === "undefined") {
    return false;
  }
  try {
    const history = JSON.parse(
      window.localStorage.getItem(getCorrectionHistoryKey(videoId)) || "[]",
    );
    return Array.isArray(history) && history.length > 0;
  } catch {
    return false;
  }
}

export function undoLastCorrectionSnapshot(
  videoId: string,
): AnnotationCorrections | null {
  if (!videoId || typeof window === "undefined") {
    return null;
  }
  try {
    const storageKey = getCorrectionHistoryKey(videoId);
    const history = JSON.parse(
      window.localStorage.getItem(storageKey) || "[]",
    ) as Array<AnnotationCorrections | null>;
    if (!Array.isArray(history) || history.length === 0) {
      return null;
    }
    const restored = history[history.length - 1] ?? null;
    const nextHistory = history.slice(0, -1);
    window.localStorage.setItem(storageKey, JSON.stringify(nextHistory));
    return restored;
  } catch {
    return null;
  }
}

export function broadcastAnalysisCorrectionRefresh(videoId: string) {
  eventBus.emit("analysisCorrectionsChanged", videoId);
  eventBus.emit("videoIdChanged", videoId);

  try {
    const posIds = JSON.parse(
      window.localStorage.getItem(POS_MATRIX_ANALYSES_STORAGE_KEY) || "[]",
    );
    if (Array.isArray(posIds)) {
      eventBus.emit("posMatrixAnalysesChanged", [...posIds]);
    }
  } catch {}

  try {
    const quantIds = JSON.parse(
      window.localStorage.getItem(QUANT_MATRIX_ANALYSES_STORAGE_KEY) || "[]",
    );
    if (Array.isArray(quantIds)) {
      eventBus.emit("quantMatrixAnalysesChanged", [...quantIds]);
    }
  } catch {}
}

export function removeCorrectionRule(
  existing: AnnotationCorrections | null | undefined,
  ruleId: string,
): AnnotationCorrections {
  return {
    ...(existing || {}),
    version: 1,
    updated_at: new Date().toISOString(),
    updated_by: "analyst",
    text_substitutions: (existing?.text_substitutions || []).filter(
      (entry) => entry.id !== ruleId,
    ),
    label_overrides: (existing?.label_overrides || []).filter(
      (entry) => entry.id !== ruleId,
    ),
    manual_transcript_entries: [...(existing?.manual_transcript_entries || [])],
  };
}

export function upsertManualTranscriptEntry(
  existing: AnnotationCorrections | null | undefined,
  entry: ManualTranscriptEntry,
): AnnotationCorrections {
  const next: AnnotationCorrections = {
    ...(existing || {}),
    version: 1,
    updated_at: new Date().toISOString(),
    updated_by: "analyst",
    text_substitutions: [...(existing?.text_substitutions || [])],
    label_overrides: [...(existing?.label_overrides || [])],
    manual_transcript_entries: [...(existing?.manual_transcript_entries || [])],
    manual_visual_annotations: [...(existing?.manual_visual_annotations || [])],
  };

  const current = [...(next.manual_transcript_entries || [])];
  const index = current.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    current[index] = entry;
  } else {
    current.push(entry);
  }
  next.manual_transcript_entries = current.sort(
    (left, right) => Number(left.start || 0) - Number(right.start || 0),
  );
  return next;
}

export function removeManualTranscriptEntry(
  existing: AnnotationCorrections | null | undefined,
  entryId: string,
): AnnotationCorrections {
  return {
    ...(existing || {}),
    version: 1,
    updated_at: new Date().toISOString(),
    updated_by: "analyst",
    text_substitutions: [...(existing?.text_substitutions || [])],
    label_overrides: [...(existing?.label_overrides || [])],
    manual_transcript_entries: (existing?.manual_transcript_entries || []).filter(
      (entry) => entry.id !== entryId,
    ),
    manual_visual_annotations: [...(existing?.manual_visual_annotations || [])],
  };
}

export function upsertManualVisualAnnotation(
  existing: AnnotationCorrections | null | undefined,
  entry: ManualVisualAnnotation,
): AnnotationCorrections {
  const next: AnnotationCorrections = {
    ...(existing || {}),
    version: 1,
    updated_at: new Date().toISOString(),
    updated_by: "analyst",
    text_substitutions: [...(existing?.text_substitutions || [])],
    label_overrides: [...(existing?.label_overrides || [])],
    manual_transcript_entries: [...(existing?.manual_transcript_entries || [])],
    manual_visual_annotations: [...(existing?.manual_visual_annotations || [])],
  };

  const current = [...(next.manual_visual_annotations || [])];
  const index = current.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    current[index] = entry;
  } else {
    current.push(entry);
  }
  next.manual_visual_annotations = current.sort(
    (left, right) =>
      Number(left.timestamp_seconds || 0) - Number(right.timestamp_seconds || 0),
  );
  return next;
}

type MasterSchemaPresenceInterval = NonNullable<
  AnnotationCorrections["master_schema_presence_intervals"]
>[number];

function manualVisualAnnotationNodeType(entry: ManualVisualAnnotation): string {
  if (entry.category === "OBJ") {
    return "object";
  }
  if (entry.category === "Identification") {
    return "narrative_agent";
  }
  if (entry.category === "OCR" || entry.category === "Transcription") {
    return "spoken_word";
  }
  if (entry.category === "Audio") {
    return "prosody";
  }
  if (entry.category === "Scene") {
    return "situation";
  }
  return "manual_annotation";
}

function manualVisualAnnotationLaneId(entry: ManualVisualAnnotation): string {
  if (entry.category === "Identification") {
    return "on_camera_agents";
  }
  if (entry.category === "OBJ") {
    return "objects";
  }
  if (entry.category === "OCR" || entry.category === "Transcription") {
    return "spoken_word";
  }
  if (entry.category === "Audio") {
    return "prosody";
  }
  return "manual_visual_annotations";
}

export function manualVisualAnnotationPresenceNodeId(entryId: string): string {
  return `master:manual_annotation:${entryId}`;
}

export function manualVisualAnnotationPresenceIntervalId(entryId: string): string {
  return `meaning-network-presence:${manualVisualAnnotationPresenceNodeId(entryId)}`;
}

export function buildMasterSchemaPresenceIntervalForManualAnnotation(
  entry: ManualVisualAnnotation,
  options?: {
    now?: string;
    sourcePanel?: string;
  },
): MasterSchemaPresenceInterval {
  const start = Number(entry.start_seconds ?? entry.timestamp_seconds ?? 0);
  const end = Math.max(
    start + 0.001,
    Number(entry.end_seconds ?? entry.timestamp_seconds ?? start),
  );
  const now = options?.now || new Date().toISOString();
  return {
    id: manualVisualAnnotationPresenceIntervalId(entry.id),
    node_id: manualVisualAnnotationPresenceNodeId(entry.id),
    node_type: manualVisualAnnotationNodeType(entry),
    label: entry.custom_label || entry.label || entry.category,
    master_schema_surface: "manual_visual_annotations",
    lane_id: manualVisualAnnotationLaneId(entry),
    presence_mode: "on_camera",
    start_seconds: Number(start.toFixed(3)),
    end_seconds: Number(end.toFixed(3)),
    authority_level: "manual_correction",
    source_panel: options?.sourcePanel || "BBox/ROI",
    source_verification_status: "source_time_resolved",
    source_range_source: "manual_interval",
    source_evidence_refs: [
      {
        evidence_id: entry.id,
        source_type: "manual_visual_annotation",
        time_range: {
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3)),
        },
        traceback_record_id: `traceback:${entry.id}`,
        confidence: 1,
      },
    ],
    source_traceback_refs: [`traceback:${entry.id}`],
    propagation_required: true,
    partial_propagation_allowed: false,
    proliferates_to: [
      "master_schema",
      "meaning_network",
      "video_panel",
      "bbox_roi_panel",
      "scene_card_panel",
      "traceback",
    ],
    updated_at: now,
    updated_by: "analyst",
  };
}

export function upsertMasterSchemaPresenceIntervalForManualAnnotation(
  existing: AnnotationCorrections | null | undefined,
  entry: ManualVisualAnnotation,
  options?: {
    now?: string;
    sourcePanel?: string;
  },
): AnnotationCorrections {
  const interval = buildMasterSchemaPresenceIntervalForManualAnnotation(entry, options);
  const current = existing?.master_schema_presence_intervals || [];
  return {
    ...(existing || {}),
    version: 1,
    updated_at: options?.now || new Date().toISOString(),
    updated_by: "analyst",
    text_substitutions: [...(existing?.text_substitutions || [])],
    label_overrides: [...(existing?.label_overrides || [])],
    manual_transcript_entries: [...(existing?.manual_transcript_entries || [])],
    manual_visual_annotations: [...(existing?.manual_visual_annotations || [])],
    proliferation_decisions: [...(existing?.proliferation_decisions || [])],
    meaning_network_custom_lanes: [...(existing?.meaning_network_custom_lanes || [])],
    master_schema_presence_intervals: [
      ...current.filter(
        (item) => item.id !== interval.id && item.node_id !== interval.node_id,
      ),
      interval,
    ],
  };
}

export function retimeManualVisualAnnotationsFromPresenceInterval(
  existing: AnnotationCorrections | null | undefined,
  interval: MasterSchemaPresenceInterval,
  options?: {
    now?: string;
  },
): AnnotationCorrections {
  const sourceIds = new Set(
    (interval.source_evidence_refs || [])
      .filter((ref) => ref.source_type === "manual_visual_annotation")
      .map((ref) => String(ref.evidence_id || "").trim())
      .filter(Boolean),
  );
  if (sourceIds.size === 0) {
    return {
      ...(existing || {}),
      manual_visual_annotations: [...(existing?.manual_visual_annotations || [])],
    };
  }
  const start = Number(interval.start_seconds);
  const end = Number(interval.end_seconds);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return {
      ...(existing || {}),
      manual_visual_annotations: [...(existing?.manual_visual_annotations || [])],
    };
  }
  const safeStart = Number(Math.min(start, end).toFixed(3));
  const safeEnd = Number(Math.max(safeStart + 0.001, Math.max(start, end)).toFixed(3));
  const now = options?.now || new Date().toISOString();
  return {
    ...(existing || {}),
    version: 1,
    updated_at: now,
    updated_by: "analyst",
    text_substitutions: [...(existing?.text_substitutions || [])],
    label_overrides: [...(existing?.label_overrides || [])],
    manual_transcript_entries: [...(existing?.manual_transcript_entries || [])],
    manual_visual_annotations: (existing?.manual_visual_annotations || []).map((entry) => {
      if (!sourceIds.has(entry.id)) {
        return entry;
      }
      return {
        ...entry,
        timestamp_seconds: safeStart,
        start_seconds: safeStart,
        end_seconds: safeEnd,
        metadata_correlation: {
          ...(entry.metadata_correlation || {}),
          master_schema_presence_interval_id: interval.id,
          source_range_source: "master_schema_presence_interval",
          manual_confirmation_event: {
            ...(entry.metadata_correlation?.manual_confirmation_event || {}),
            confirmed_fields: {
              ...(entry.metadata_correlation?.manual_confirmation_event?.confirmed_fields || {}),
              time_interval: true,
            },
            active_state_after_save: {
              ...(entry.metadata_correlation?.manual_confirmation_event?.active_state_after_save || {}),
              start_seconds: safeStart,
              end_seconds: safeEnd,
              start_ms: Math.round(safeStart * 1000),
              end_ms: Math.round(safeEnd * 1000),
            },
            propagation_required: true,
            partial_propagation_allowed: false,
          },
        },
        updated_at: now,
        updated_by: "analyst",
      };
    }),
    proliferation_decisions: [...(existing?.proliferation_decisions || [])],
    meaning_network_custom_lanes: [...(existing?.meaning_network_custom_lanes || [])],
    master_schema_presence_intervals: [...(existing?.master_schema_presence_intervals || [])],
  };
}

export function requireSavedManualVisualAnnotation(
  corrections: AnnotationCorrections | null | undefined,
  entryId: string,
  context = "BBox/ROI correction",
): ManualVisualAnnotation {
  const saved = (corrections?.manual_visual_annotations || []).find(
    (entry) => entry.id === entryId,
  );
  if (!saved) {
    throw new Error(
      `${context} save returned without canonical manual_visual_annotations entry ${entryId}`,
    );
  }
  if (
    saved.geometry_type !== "box" ||
    !saved.coordinates ||
    typeof saved.coordinates.x !== "number" ||
    typeof saved.coordinates.y !== "number" ||
    typeof saved.coordinates.w !== "number" ||
    typeof saved.coordinates.h !== "number"
  ) {
    throw new Error(
      `${context} save returned entry ${entryId} without canonical box coordinates`,
    );
  }
  return saved;
}

export function removeManualVisualAnnotation(
  existing: AnnotationCorrections | null | undefined,
  entryId: string,
): AnnotationCorrections {
  return {
    ...(existing || {}),
    version: 1,
    updated_at: new Date().toISOString(),
    updated_by: "analyst",
    text_substitutions: [...(existing?.text_substitutions || [])],
    label_overrides: [...(existing?.label_overrides || [])],
    manual_transcript_entries: [...(existing?.manual_transcript_entries || [])],
    manual_visual_annotations: (existing?.manual_visual_annotations || []).filter(
      (entry) => entry.id !== entryId,
    ),
    master_schema_presence_intervals: (
      existing?.master_schema_presence_intervals || []
    ).filter((interval) => {
      if (
        interval.id === manualVisualAnnotationPresenceIntervalId(entryId) ||
        interval.node_id === manualVisualAnnotationPresenceNodeId(entryId)
      ) {
        return false;
      }
      return !(interval.source_evidence_refs || []).some(
        (ref) =>
          ref.source_type === "manual_visual_annotation" &&
          String(ref.evidence_id || "").trim() === entryId,
      );
    }),
  };
}
