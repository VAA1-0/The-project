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
  };
}
