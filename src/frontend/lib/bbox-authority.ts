import type { ManualVisualAnnotation } from "./api-service";
import type { DetectedObject, MatureEvidenceAuthority } from "./video-service";

export const MANUAL_POINT_VISIBILITY_SECONDS = 0.08;
export const MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS = 0.03;
export const MANUAL_GEOMETRY_INTERPOLATION_MAX_GAP_SECONDS = 0.5;

export type DraftBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ManualGeometryKeyframe = NonNullable<
  ManualVisualAnnotation["geometry_keyframes"]
>[number];

export type BBoxMatureAuthority = {
  label: string;
  authority: MatureEvidenceAuthority;
  source:
    | "manual_visual_annotation"
    | "master_schema"
    | "narrative_agent"
    | "proliferated_candidate";
  sourceItem?: unknown;
  roleLabel?: string;
  traceback?: unknown;
  evidence_refs?: unknown;
  source_bbox_refs?: unknown;
  source_frame_refs?: unknown;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeDraftBox(box: DraftBox): DraftBox {
  return {
    x: clamp(box.x, 0, 1),
    y: clamp(box.y, 0, 1),
    w: clamp(box.w, 0.002, 1),
    h: clamp(box.h, 0.002, 1),
  };
}

export function interpolateBoxes(left: DraftBox, right: DraftBox, t: number): DraftBox {
  const safeT = clamp(t, 0, 1);
  return normalizeDraftBox({
    x: left.x + (right.x - left.x) * safeT,
    y: left.y + (right.y - left.y) * safeT,
    w: left.w + (right.w - left.w) * safeT,
    h: left.h + (right.h - left.h) * safeT,
  });
}

export function manualObjectTargetId(item: ManualVisualAnnotation): string | null {
  const targetType = String(item.metadata_correlation?.target_type || "").toLowerCase();
  if (targetType !== "object") {
    return null;
  }
  const scope = String(item.metadata_correlation?.apply_scope || "").toLowerCase();
  if (
    scope &&
    ![
      "track_family",
      "narrative_agent_family",
      "current_continuity_segment",
      "current_scene",
    ].includes(scope)
  ) {
    return null;
  }
  const targetId = item.metadata_correlation?.target_id;
  return targetId === undefined || targetId === null ? null : String(targetId);
}

export function manualObjectCorrectionTargetId(
  item: ManualVisualAnnotation,
): string | null {
  const targetType = String(item.metadata_correlation?.target_type || "").toLowerCase();
  if (targetType !== "object") {
    return null;
  }
  const targetId = item.metadata_correlation?.target_id;
  return targetId === undefined || targetId === null ? null : String(targetId);
}

export function resolveManualVisualDisplayLabel(item: ManualVisualAnnotation): string {
  return (
    item.identity_affirmation ||
    item.role_affirmation ||
    item.custom_label ||
    item.label ||
    "manual annotation"
  ).trim();
}

export function manualVisualAnnotationMatureLabel(
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

export function getManualAnnotationBounds(entry: ManualVisualAnnotation) {
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

export function isManualAnnotationVisibleAtTime(
  entry: ManualVisualAnnotation,
  currentTime: number,
) {
  const bounds = getManualAnnotationBounds(entry);
  if (!bounds) {
    return false;
  }

  if (bounds.duration <= Number.EPSILON) {
    return currentTime === bounds.timestamp;
  }

  return currentTime >= bounds.start && currentTime <= bounds.end;
}

export function manualGeometryKeyframesHaveAuthority(
  manualKeyframes: ManualGeometryKeyframe[],
): boolean {
  return manualKeyframes.some((keyframe) => keyframe.source !== "track");
}

export function selectAuthoritativeGeometryKeyframes(
  manualKeyframes: ManualGeometryKeyframe[],
  trackKeyframes: ManualGeometryKeyframe[],
): ManualGeometryKeyframe[] {
  const analystKeyframes = manualKeyframes.filter(
    (keyframe) => keyframe.source !== "track",
  );
  return analystKeyframes.length > 0 ? analystKeyframes : trackKeyframes;
}

export function resolveManualOverlayBBox(
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

export function resolveObjectOverlayBBox(
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

export function detectedObjectToNormalizedBox(
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

export function resolveManualGeometryAtTime({
  item,
  timestamp,
  trackKeyframes,
  videoWidth,
  videoHeight,
}: {
  item: ManualVisualAnnotation;
  timestamp: number;
  trackKeyframes: ManualGeometryKeyframe[];
  videoWidth: number;
  videoHeight: number;
}): DraftBox | null {
  const manualKeyframes = Array.isArray(item.geometry_keyframes)
    ? item.geometry_keyframes
    : [];
  const authoritativeKeyframes = selectAuthoritativeGeometryKeyframes(
    manualKeyframes,
    trackKeyframes,
  );
  const merged = authoritativeKeyframes
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
}

export function buildManualTrackMatureAuthority(
  annotations: ManualVisualAnnotation[],
  currentTime: number,
): Map<string, BBoxMatureAuthority> {
  const byTrack = new Map<string, BBoxMatureAuthority>();
  annotations.forEach((item) => {
    if (!isManualAnnotationVisibleAtTime(item, currentTime)) {
      return;
    }
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
    });
  });
  return byTrack;
}
