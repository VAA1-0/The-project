import type { ManualVisualAnnotation } from "./api-service";
import type { DetectedObject } from "./video-service";

export type EvidenceKind =
  | "raw_detection"
  | "grouped_detection"
  | "manual_annotation"
  | "manual_correction";

export const EVIDENCE_AUTHORITY_ORDER: Record<EvidenceKind, number> = {
  raw_detection: 10,
  grouped_detection: 20,
  manual_annotation: 30,
  manual_correction: 40,
};

export type EvidenceGeometryType = "bbox" | "roi" | "polygon" | "none";
export type EvidenceCoordinateSystem = "normalized" | "pixel" | "source";

export type EvidenceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  coordinateSystem: EvidenceCoordinateSystem;
};

export type EvidenceGeometryKeyframe = {
  time: number;
  box: EvidenceBox;
  source: "manual" | "track" | "interpolated";
  updatedAt?: string;
};

export type EvidenceGeometry = {
  type: EvidenceGeometryType;
  box?: EvidenceBox;
  keyframes: EvidenceGeometryKeyframe[];
};

export type EvidenceTimeInterval = {
  start: number;
  end: number;
  source: EvidenceKind | "draft";
};

export type EvidenceLabels = {
  objectLabel?: string;
  identityLabel?: string;
  roleLabel?: string;
  category?: ManualVisualAnnotation["category"] | string;
  subcategory?: string;
  confidence?: number;
  labelSource: EvidenceKind | "automated_detection";
};

export type EvidenceProvenance = {
  derivedFrom: string[];
  supersedes: string[];
  preservedForTraceback: boolean;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  relation?: NonNullable<ManualVisualAnnotation["metadata_correlation"]>["relation"];
  note?: string;
  createdBy?: "system" | "analyst";
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type ResolvedEvidenceItem = {
  evidenceId: string;
  mediaId: string;
  evidenceKind: EvidenceKind;
  authorityLevel: number;
  time: EvidenceTimeInterval;
  geometry: EvidenceGeometry;
  labels: EvidenceLabels;
  provenance: EvidenceProvenance;
  associatedPanels: string[];
  navigation: {
    isNavigable: boolean;
    navigationTime: number;
    visibleFrom: number;
    visibleUntil: number;
    sliderMin: number;
    sliderMax: number;
    syncTargetPanels: string[];
  };
  source: {
    kind: "manual_visual_annotation" | "detected_object";
    item: ManualVisualAnnotation | DetectedObject;
  };
};

export type EvidenceNavigationState = {
  activeEvidenceId: string | null;
  activeMediaId: string | null;
  activeTime: number;
  activeInterval: EvidenceTimeInterval | null;
  activeGeometry: EvidenceGeometry | null;
  activePanels: string[];
};

const DEFAULT_SYNC_PANELS = ["VideoPanel", "MasterSchemaPanel"];

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampStartEnd(start: number, end: number): EvidenceTimeInterval {
  const safeStart = Math.max(0, finiteNumber(start, 0));
  const safeEnd = Math.max(safeStart, finiteNumber(end, safeStart));
  return {
    start: safeStart,
    end: safeEnd,
    source: "raw_detection",
  };
}

function manualAnnotationKind(annotation: ManualVisualAnnotation): EvidenceKind {
  const correlation = annotation.metadata_correlation;
  return correlation?.target_id || correlation?.target_type
    ? "manual_correction"
    : "manual_annotation";
}

function manualAnnotationPanels(annotation: ManualVisualAnnotation): string[] {
  const panels = new Set(DEFAULT_SYNC_PANELS);
  if (annotation.category === "OBJ") {
    panels.add("OBJDetectionPanel");
  }
  if (annotation.category === "Identification") {
    panels.add("IdentificationPanel");
  }
  return [...panels];
}

function objectDetectionPanels(): string[] {
  return ["VideoPanel", "OBJDetectionPanel"];
}

function manualBox(annotation: ManualVisualAnnotation): EvidenceBox {
  return {
    x: finiteNumber(annotation.coordinates?.x, 0),
    y: finiteNumber(annotation.coordinates?.y, 0),
    w: finiteNumber(annotation.coordinates?.w, 0),
    h: finiteNumber(annotation.coordinates?.h, 0),
    coordinateSystem: "normalized",
  };
}

function detectionBox(object: DetectedObject): EvidenceBox | undefined {
  const box = object.bbox;
  if (!box) {
    return undefined;
  }
  const x1 = finiteNumber(box.x1, 0);
  const y1 = finiteNumber(box.y1, 0);
  const x2 = finiteNumber(box.x2, x1);
  const y2 = finiteNumber(box.y2, y1);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
    coordinateSystem: "source",
  };
}

function navigationFor(
  time: EvidenceTimeInterval,
  panels: string[],
): ResolvedEvidenceItem["navigation"] {
  return {
    isNavigable: true,
    navigationTime: time.start,
    visibleFrom: time.start,
    visibleUntil: time.end,
    sliderMin: time.start,
    sliderMax: Math.max(time.end, time.start),
    syncTargetPanels: panels,
  };
}

export function resolveManualVisualEvidence(
  mediaId: string,
  annotation: ManualVisualAnnotation,
): ResolvedEvidenceItem {
  const evidenceKind = manualAnnotationKind(annotation);
  const start = finiteNumber(
    annotation.start_seconds ?? annotation.timestamp_seconds,
    0,
  );
  const end = finiteNumber(
    annotation.end_seconds ?? annotation.timestamp_seconds ?? start,
    start,
  );
  const time = {
    ...clampStartEnd(start, end),
    source: evidenceKind,
  };
  const panels = manualAnnotationPanels(annotation);
  const correlation = annotation.metadata_correlation;
  const box = manualBox(annotation);

  return {
    evidenceId: annotation.id,
    mediaId,
    evidenceKind,
    authorityLevel: EVIDENCE_AUTHORITY_ORDER[evidenceKind],
    time,
    geometry: {
      type: "bbox",
      box,
      keyframes: (annotation.geometry_keyframes || []).map((keyframe) => ({
        time: finiteNumber(keyframe.time, time.start),
        box: {
          x: finiteNumber(keyframe.coordinates?.x, box.x),
          y: finiteNumber(keyframe.coordinates?.y, box.y),
          w: finiteNumber(keyframe.coordinates?.w, box.w),
          h: finiteNumber(keyframe.coordinates?.h, box.h),
          coordinateSystem: "normalized",
        },
        source: keyframe.source || "manual",
        updatedAt: keyframe.updated_at,
      })),
    },
    labels: {
      objectLabel: annotation.category === "OBJ" ? annotation.label : undefined,
      identityLabel: annotation.identity_affirmation,
      roleLabel: annotation.role_affirmation,
      category: annotation.category,
      subcategory: annotation.subcategory,
      labelSource: evidenceKind,
    },
    provenance: {
      derivedFrom: correlation?.target_id ? [correlation.target_id] : [],
      supersedes: evidenceKind === "manual_correction" && correlation?.target_id
        ? [correlation.target_id]
        : [],
      preservedForTraceback: true,
      targetType: correlation?.target_type,
      targetId: correlation?.target_id,
      targetLabel: correlation?.target_label,
      relation: correlation?.relation,
      note: correlation?.note || annotation.open_note,
      createdBy: "analyst",
      createdAt: annotation.created_at,
      updatedAt: annotation.updated_at,
      updatedBy: annotation.updated_by,
    },
    associatedPanels: panels,
    navigation: navigationFor(time, panels),
    source: {
      kind: "manual_visual_annotation",
      item: annotation,
    },
  };
}

export function resolveDetectedObjectEvidence(
  mediaId: string,
  object: DetectedObject,
  evidenceKind: Extract<EvidenceKind, "raw_detection" | "grouped_detection"> = "raw_detection",
): ResolvedEvidenceItem {
  const start = finiteNumber(object.startTimestamp ?? object.timestamp, 0);
  const end = finiteNumber(object.endTimestamp ?? object.timestamp ?? start, start);
  const time = {
    ...clampStartEnd(start, end),
    source: evidenceKind,
  };
  const panels = objectDetectionPanels();
  const evidenceId =
    object.trackId !== undefined
      ? `${mediaId}:object-track:${object.trackId}`
      : `${mediaId}:object:${object.class_name}:${Number(object.timestamp || 0).toFixed(3)}`;
  const label = object.displayLabel || object.class_name || object.raw_class_name;
  const box = detectionBox(object);

  return {
    evidenceId,
    mediaId,
    evidenceKind,
    authorityLevel: EVIDENCE_AUTHORITY_ORDER[evidenceKind],
    time,
    geometry: {
      type: box ? "bbox" : "none",
      box,
      keyframes: [],
    },
    labels: {
      objectLabel: label,
      category: object.annotationCategory || "OBJ",
      subcategory: object.annotationSubcategory,
      confidence: object.confidence,
      labelSource: "automated_detection",
    },
    provenance: {
      derivedFrom: [],
      supersedes: [],
      preservedForTraceback: true,
      targetType: object.trackId !== undefined ? "object_track" : "object_detection",
      targetId: object.trackId !== undefined ? String(object.trackId) : undefined,
      targetLabel: label,
      createdBy: "system",
    },
    associatedPanels: panels,
    navigation: navigationFor(time, panels),
    source: {
      kind: "detected_object",
      item: object,
    },
  };
}

export function resolveAuthoritativeEvidence(
  candidates: ResolvedEvidenceItem[],
): ResolvedEvidenceItem | null {
  return [...candidates].sort((left, right) => {
    if (left.authorityLevel !== right.authorityLevel) {
      return right.authorityLevel - left.authorityLevel;
    }
    return right.time.start - left.time.start;
  })[0] || null;
}

export function buildEvidenceNavigationState(
  activeEvidence: ResolvedEvidenceItem | null,
): EvidenceNavigationState {
  if (!activeEvidence) {
    return {
      activeEvidenceId: null,
      activeMediaId: null,
      activeTime: 0,
      activeInterval: null,
      activeGeometry: null,
      activePanels: [],
    };
  }

  return {
    activeEvidenceId: activeEvidence.evidenceId,
    activeMediaId: activeEvidence.mediaId,
    activeTime: activeEvidence.navigation.navigationTime,
    activeInterval: activeEvidence.time,
    activeGeometry: activeEvidence.geometry,
    activePanels: activeEvidence.associatedPanels,
  };
}
