import type { ManualVisualAnnotation } from "./api-service";
import type { DetectedObject, MatureEvidenceAuthority } from "./video-service";

export const MANUAL_POINT_VISIBILITY_SECONDS = 0.08;
export const MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS = 0.03;
export const MANUAL_GEOMETRY_INTERPOLATION_MAX_GAP_SECONDS = 5;
export const MANUAL_GEOMETRY_KEYFRAME_REPLACE_TOLERANCE_SECONDS = 0.075;

export type DraftBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type VideoContentRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClientPoint = {
  x: number;
  y: number;
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

export type ManualBBoxRoiAnnotationInput = {
  analysisId: string;
  annotationId: string;
  category: ManualVisualAnnotation["category"];
  subcategory?: string;
  label: string;
  customLabel?: string;
  box: DraftBox;
  start: number;
  end: number;
  anchorTime?: number;
  existingManual?: ManualVisualAnnotation;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  applyScope?: NonNullable<
    NonNullable<ManualVisualAnnotation["metadata_correlation"]>["apply_scope"]
  >;
  quickAnnotations?: string[];
  identityAffirmation?: string;
  roleAffirmation?: string;
  audioFoleyNote?: string;
  openNote?: string;
  sourceTrackKeyframes?: ManualGeometryKeyframe[];
  supersedes?: string[];
  relation?: NonNullable<
    NonNullable<ManualVisualAnnotation["metadata_correlation"]>["relation"]
  >;
  metadataPatch?: NonNullable<ManualVisualAnnotation["metadata_correlation"]>;
  confirmationFields?: Record<string, boolean>;
  confirmationActiveState?: Record<string, unknown>;
  confirmationEventId?: string;
  sourceNote?: string;
  updatedAt?: string;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeDraftBox(box: DraftBox): DraftBox {
  const x = clamp(box.x, 0, 1);
  const y = clamp(box.y, 0, 1);
  return {
    x,
    y,
    w: clamp(box.w, 0.002, Math.max(0.002, 1 - x)),
    h: clamp(box.h, 0.002, Math.max(0.002, 1 - y)),
  };
}

export function getTrueVideoContentRect({
  elementWidth,
  elementHeight,
  intrinsicWidth,
  intrinsicHeight,
}: {
  elementWidth: number;
  elementHeight: number;
  intrinsicWidth: number;
  intrinsicHeight: number;
}): VideoContentRect | null {
  if (
    elementWidth <= 0 ||
    elementHeight <= 0 ||
    intrinsicWidth <= 0 ||
    intrinsicHeight <= 0
  ) {
    return null;
  }

  const videoRatio = intrinsicWidth / intrinsicHeight;
  const elementRatio = elementWidth / elementHeight;

  let renderWidth = elementWidth;
  let renderHeight = elementHeight;
  let xOffset = 0;
  let yOffset = 0;

  if (elementRatio > videoRatio) {
    renderWidth = elementHeight * videoRatio;
    xOffset = (elementWidth - renderWidth) / 2;
  } else {
    renderHeight = elementWidth / videoRatio;
    yOffset = (elementHeight - renderHeight) / 2;
  }

  return {
    x: xOffset,
    y: yOffset,
    width: renderWidth,
    height: renderHeight,
  };
}

export function getTrueVideoContentRectForElement(
  videoEl: HTMLVideoElement | null | undefined,
): VideoContentRect | null {
  if (!videoEl) {
    return null;
  }
  return getTrueVideoContentRect({
    elementWidth: videoEl.clientWidth,
    elementHeight: videoEl.clientHeight,
    intrinsicWidth: videoEl.videoWidth,
    intrinsicHeight: videoEl.videoHeight,
  });
}

export function clientPointToNormalizedVideoPoint({
  clientX,
  clientY,
  elementRect,
  contentRect,
}: {
  clientX: number;
  clientY: number;
  elementRect: Pick<DOMRect, "left" | "top">;
  contentRect: VideoContentRect;
}): ClientPoint | null {
  if (contentRect.width <= 0 || contentRect.height <= 0) {
    return null;
  }
  return {
    x: clamp(
      (clientX - elementRect.left - contentRect.x) / contentRect.width,
      0,
      1,
    ),
    y: clamp(
      (clientY - elementRect.top - contentRect.y) / contentRect.height,
      0,
      1,
    ),
  };
}

export function projectNormalizedBoxToVideoContent(
  box: DraftBox,
  contentRect: VideoContentRect,
): { left: number; top: number; width: number; height: number } {
  const normalized = normalizeDraftBox(box);
  return {
    left: normalized.x * contentRect.width,
    top: normalized.y * contentRect.height,
    width: normalized.w * contentRect.width,
    height: normalized.h * contentRect.height,
  };
}

export function mergeManualGeometryKeyframes(
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

export function buildBoxFromNormalizedPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): DraftBox {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const right = Math.max(startX, endX);
  const bottom = Math.max(startY, endY);
  return normalizeDraftBox({
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  });
}

export function manualAnnotationTimeScopeKey(start: number, end: number): string {
  return `${Number(start).toFixed(3)}-${Number(end).toFixed(3)}`;
}

export function manualAnnotationBBoxFingerprint(box: DraftBox): string {
  return [box.x, box.y, box.w, box.h]
    .map((value) => Number(value).toFixed(4))
    .join("-");
}

export function calculateDraftBoxIoU(
  left: DraftBox | null,
  right: DraftBox | null,
): number {
  if (!left || !right) {
    return 0;
  }
  const leftX2 = left.x + left.w;
  const leftY2 = left.y + left.h;
  const rightX2 = right.x + right.w;
  const rightY2 = right.y + right.h;
  const intersectionW = Math.max(
    0,
    Math.min(leftX2, rightX2) - Math.max(left.x, right.x),
  );
  const intersectionH = Math.max(
    0,
    Math.min(leftY2, rightY2) - Math.max(left.y, right.y),
  );
  const intersection = intersectionW * intersectionH;
  if (intersection <= 0) {
    return 0;
  }
  const union = left.w * left.h + right.w * right.h - intersection;
  return union > 0 ? intersection / union : 0;
}

export function calculateDraftBoxCenterDistance(
  left: DraftBox | null,
  right: DraftBox | null,
): number {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(
    left.x + left.w / 2 - (right.x + right.w / 2),
    left.y + left.h / 2 - (right.y + right.h / 2),
  );
}

export function synthesizePersonBoxFromExpression(expressionBox: DraftBox): DraftBox {
  const centerX = expressionBox.x + expressionBox.w / 2;
  const width = clamp(Math.max(expressionBox.w * 2.35, 0.12), 0.002, 0.72);
  const height = clamp(Math.max(expressionBox.h * 4.6, 0.28), 0.002, 0.9);
  const x = clamp(centerX - width / 2, 0, Math.max(0, 1 - width));
  const y = clamp(
    expressionBox.y - expressionBox.h * 0.65,
    0,
    Math.max(0, 1 - height),
  );
  return normalizeDraftBox({ x, y, w: width, h: height });
}

export function geometryToNormalizedBox(
  geometry: unknown,
  videoWidth: number,
  videoHeight: number,
): DraftBox | null {
  const geometryRecord =
    geometry && typeof geometry === "object" && !Array.isArray(geometry)
      ? (geometry as Record<string, unknown>)
      : null;
  const rawBox =
    geometryRecord?.bbox && typeof geometryRecord.bbox === "object"
      ? (geometryRecord.bbox as Record<string, unknown>)
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

export function isSameSpaceBoxMatch(
  left: DraftBox | null,
  right: DraftBox | null,
): boolean {
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

export function analystManualAuthoritySuppressesObjectBox(
  objectBox: DraftBox | null,
  manualBox: DraftBox | null,
): boolean {
  if (!objectBox || !manualBox) {
    return false;
  }
  const iou = calculateDraftBoxIoU(objectBox, manualBox);
  if (iou >= 0.08) {
    return true;
  }
  const centerDistance = calculateDraftBoxCenterDistance(objectBox, manualBox);
  const areaRatio =
    Math.min(objectBox.w * objectBox.h, manualBox.w * manualBox.h) /
    Math.max(objectBox.w * objectBox.h, manualBox.w * manualBox.h, 0.000001);
  return centerDistance <= 0.18 && areaRatio >= 0.08;
}

export function buildManualCorrectionGeometryKeyframes({
  start,
  end,
  box,
  anchorTime,
  existingKeyframes = [],
  updatedAt = new Date().toISOString(),
}: {
  start: number;
  end: number;
  box: DraftBox;
  anchorTime?: number;
  existingKeyframes?: ManualGeometryKeyframe[];
  updatedAt?: string;
}): ManualGeometryKeyframe[] {
  const normalizedBox = normalizeDraftBox(box);
  const intervalStart = Number(Math.min(start, end).toFixed(3));
  const intervalEnd = Number(Math.max(start, end, intervalStart + 0.001).toFixed(3));
  const safeAnchor =
    typeof anchorTime === "number" && Number.isFinite(anchorTime)
      ? Number(clamp(anchorTime, intervalStart, intervalEnd).toFixed(3))
      : intervalStart;
  const governedExisting = existingKeyframes
    .filter(
      (keyframe): keyframe is ManualGeometryKeyframe =>
        keyframe?.source !== "track" &&
        typeof keyframe?.time === "number" &&
        Number.isFinite(keyframe.time) &&
        keyframe.time >= intervalStart - MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS &&
        keyframe.time <= intervalEnd + MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS &&
        Boolean(keyframe.coordinates),
    )
    .map((keyframe) => ({
      ...keyframe,
      time: Number(clamp(keyframe.time, intervalStart, intervalEnd).toFixed(3)),
      coordinates: normalizeDraftBox(keyframe.coordinates),
      source: "manual" as const,
    }))
    .filter(
      (keyframe) =>
        Math.abs(keyframe.time - safeAnchor) >
        MANUAL_GEOMETRY_KEYFRAME_REPLACE_TOLERANCE_SECONDS,
    );
  const nextKeyframes = [
    ...governedExisting,
    {
      time: safeAnchor,
      coordinates: normalizedBox,
      source: "manual" as const,
      updated_at: updatedAt,
    },
  ].sort((left, right) => left.time - right.time);

  if (nextKeyframes.length === 1) {
    return [intervalStart, safeAnchor, intervalEnd]
      .filter((time, index, times) => times.indexOf(time) === index)
      .sort((left, right) => left - right)
      .map((time) => ({
        time,
        coordinates: normalizedBox,
        source: "manual" as const,
        updated_at: updatedAt,
      }));
  }

  return nextKeyframes;
}

export function buildManualBBoxRoiAnnotation({
  analysisId,
  annotationId,
  category,
  subcategory,
  label,
  customLabel,
  box,
  start,
  end,
  anchorTime,
  existingManual,
  targetType,
  targetId,
  targetLabel,
  applyScope = "this_interval_only",
  quickAnnotations = [],
  identityAffirmation,
  roleAffirmation,
  audioFoleyNote,
  openNote,
  sourceTrackKeyframes = [],
  supersedes,
  relation = "extends",
  metadataPatch,
  confirmationFields,
  confirmationActiveState,
  confirmationEventId,
  sourceNote,
  updatedAt = new Date().toISOString(),
}: ManualBBoxRoiAnnotationInput): ManualVisualAnnotation {
  const intervalStart = Number(Math.min(start, end).toFixed(3));
  const intervalEnd = Number(Math.max(start, end, intervalStart + 0.001).toFixed(3));
  const safeAnchor =
    typeof anchorTime === "number" && Number.isFinite(anchorTime)
      ? Number(clamp(anchorTime, intervalStart, intervalEnd).toFixed(3))
      : intervalStart;
  const governedBox = normalizeDraftBox(box);
  const geometryTrackId = `${analysisId}:bbox-roi-geometry:${annotationId}`;
  const geometryKeyframes = mergeManualGeometryKeyframes(
    buildManualCorrectionGeometryKeyframes({
      start: intervalStart,
      end: intervalEnd,
      box: governedBox,
      anchorTime: safeAnchor,
      existingKeyframes: existingManual?.geometry_keyframes || [],
      updatedAt,
    }),
  );
  const metadata = existingManual?.metadata_correlation || {};
  const confirmedFields = {
    time_interval: true,
    geometry: true,
    label: true,
    ...(confirmationFields || {}),
  };

  return {
    ...(existingManual || {}),
    id: existingManual?.id || annotationId,
    category,
    subcategory,
    label,
    custom_label: customLabel,
    geometry_type: "box",
    coordinates: governedBox,
    geometry_keyframes: geometryKeyframes,
    timestamp_seconds: intervalStart,
    start_seconds: intervalStart,
    end_seconds: intervalEnd,
    identity_affirmation: identityAffirmation,
    role_affirmation: roleAffirmation,
    audio_foley_note: audioFoleyNote,
    open_note: openNote,
    metadata_correlation: {
      ...metadata,
      ...(metadataPatch || {}),
      target_type: targetType,
      target_id: targetId,
      target_label: targetLabel || metadata.target_label,
      apply_scope: applyScope,
      quick_annotations: quickAnnotations,
      bbox_roi_governance_schema: "vaa1.bbox_roi_governance.v1",
      authority_state: "manual_correction",
      maturity_state: "manual_correction",
      geometry_track_id: geometryTrackId,
      coordinate_system: "normalized_video",
      interpolation_policy: {
        ...(metadata.interpolation_policy || {}),
        allowed: true,
        max_gap_ms: 5000,
        break_on_scene_boundary: true,
        break_on_shot_cut: true,
        manual_confirmation_required_for_cross_boundary: true,
      },
      source_track_keyframes_retained_for_traceback:
        sourceTrackKeyframes.length > 0
          ? sourceTrackKeyframes.map((keyframe) => ({
              time: keyframe.time,
              source: keyframe.source,
            }))
          : metadata.source_track_keyframes_retained_for_traceback,
      manual_confirmation_event: {
        event_type: "manual_bbox_roi_confirmation",
        event_id:
          confirmationEventId ||
          `${analysisId}:manual-bbox-roi-confirmation:${annotationId}:${Date.now()}`,
        analysis_id: analysisId,
        bbox_roi_id: annotationId,
        authority_level: "manual_correction",
        confirmed_fields: confirmedFields,
        active_state_after_save: {
          start_ms: Math.round(intervalStart * 1000),
          end_ms: Math.round(intervalEnd * 1000),
          geometry_track_id: geometryTrackId,
          start_seconds: intervalStart,
          end_seconds: intervalEnd,
          bbox: governedBox,
          geometry_keyframe_time: safeAnchor,
          label,
          category,
          quick_annotations: quickAnnotations,
          ...(confirmationActiveState || {}),
        },
        supersedes: supersedes || (targetId ? [targetId] : []),
        old_states_retained_as: "traceback_provenance",
        propagation_required: true,
        partial_propagation_allowed: false,
      },
      relation,
      note: sourceNote || metadata.note,
    },
    teaches_regime: true,
    created_at: existingManual?.created_at || updatedAt,
    updated_at: updatedAt,
    updated_by: "analyst",
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
    const appearsNormalized =
      x1 >= 0 &&
      y1 >= 0 &&
      x2 >= 0 &&
      y2 >= 0 &&
      Math.max(x1, y1, x2, y2) <= 1.5;
    const scaleX = appearsNormalized ? 1 : width;
    const scaleY = appearsNormalized ? 1 : height;

    return normalizeDraftBox({
      x: Math.min(x1, x2) / scaleX,
      y: Math.min(y1, y2) / scaleY,
      w: Math.abs(x2 - x1) / scaleX,
      h: Math.abs(y2 - y1) / scaleY,
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
    const existingManual =
      existing?.sourceItem &&
      typeof existing.sourceItem === "object" &&
      !Array.isArray(existing.sourceItem)
        ? (existing.sourceItem as Partial<ManualVisualAnnotation>)
        : null;
    const existingStart =
      typeof existingManual?.start_seconds === "number"
        ? Number(existingManual.start_seconds)
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
