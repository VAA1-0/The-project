// src/frontend/app/V2components/components/panels/VideoPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import {
  VideoService,
  type AnalysisData,
  type DetectedObject,
  type ExpressionSample,
  type OCR,
  type VideoMetadata,
  groupDetectedObjectsForDisplay,
} from "@/lib/video-service";
import { getVideoBlob, saveVideoBlob } from "@/lib/blob-store";
import {
  broadcastAnalysisCorrectionRefresh,
  buildCorrectionRule,
  buildDropCorrectionRule,
  mergeCorrectionRule,
  pushCorrectionSnapshot,
} from "@/lib/annotation-corrections";
import { Button } from "@/components/ui/button";
import { useLayoutHost } from "../LayoutHost";

const SINGLE_SOURCE_MARKS_KEY_PREFIX = "vaa1.video.marks.";
const CROSS_SOURCE_COMPARE_KEY = "vaa1.video.compare-anchor";

type OverlayToggleKey = "objects" | "ocr" | "expressions";

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
  modality: "object" | "ocr" | "expression";
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sourceItem?: any;
};

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
    (item) =>
      item.bbox?.x1 !== undefined &&
      item.bbox?.y1 !== undefined &&
      item.bbox?.x2 !== undefined &&
      item.bbox?.y2 !== undefined &&
      (item.confidence || 0) >= getObjectOverlayConfidenceThreshold(item.class_name) &&
      item.timestamp <= currentTime + 0.06 &&
      currentTime - item.timestamp <= 0.55,
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
    const duplicate = accepted.find((existing) => {
      if (existing.class_name !== item.class_name) {
        return false;
      }

      const iou = calculateObjectBBoxIoU(existing.bbox, item.bbox);
      const distance = calculateObjectBBoxCenterDistance(existing.bbox, item.bbox);
      return iou >= 0.45 || distance <= (item.class_name === "person" ? 90 : 70);
    });

    if (duplicate) {
      continue;
    }

    accepted.push(item);
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
      displayLabel: item.displayLabel || "person • face-aligned",
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
    displayLabel: `person • face-led ${index + 1}`,
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
          currentTime >= start - 0.2 &&
          currentTime <= end + 0.2
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
      displayLabel: best.displayLabel,
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
    objects: false,
    ocr: false,
    expressions: false,
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
    eventBus.emit("videoTimeLineChanged", safeTime);
  }, [duration]);

  const nudgeTime = React.useCallback(
    (deltaSeconds: number) => {
      jumpToTime(currentTime + deltaSeconds);
    },
    [currentTime, jumpToTime],
  );

  const setSingleSourceMark = React.useCallback(
    (mark: "a" | "b") => {
      persistSingleSourceMarks({
        ...singleSourceMarks,
        [mark]: currentTime,
      });
    },
    [currentTime, persistSingleSourceMarks, singleSourceMarks],
  );

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
      setVideoTimeLine(nextVideoTimeLine);
    };
    eventBus.on("videoTimeLineChanged", handler);
    return () => {
      eventBus.off("videoTimeLineChanged", handler);
    };
  }, []);

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

      try {
        const mediaSourcePromise = loadVideoSource(videoId);
        const analysisPromise = VideoService.getAnalysis(videoId);
        const mediaSource = await mediaSourcePromise;
        if (cancelled || activeLoadTokenRef.current !== loadToken) {
          if (mediaSource.videoUrl) {
            URL.revokeObjectURL(mediaSource.videoUrl);
          }
          return;
        }
        setMetadata(mediaSource.metadata);
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

        const nextAnalysis = await analysisPromise;
        if (cancelled || activeLoadTokenRef.current !== loadToken) {
          return;
        }
        setAnalysisData(nextAnalysis);
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
      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current);
        lastObjectUrl.current = null;
      }
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
          buildLocalObjectOverlays(rawDetectedObjects, currentTime),
          nearbyFaces,
        ),
        groupedDetectedObjects,
        currentTime,
      ),
    [currentTime, groupedDetectedObjects, nearbyFaces, rawDetectedObjects],
  );
  const activeOCR = useMemo(
    () => buildLocalOCROverlays(ocrResults, currentTime, videoWidth, videoHeight),
    [currentTime, ocrResults, videoHeight, videoWidth],
  );
  const activeExpressions = useMemo(
    () => findNearbyItems(expressionResults, 0.5),
    [expressionResults, findNearbyItems],
  );

  const overlayBoxes = useMemo(() => {
    const overlays: OverlayBox[] = [];

    if (!overlaysReady) {
      return overlays;
    }

    if (overlayToggles.objects) {
      activeRawObjects.forEach((item: DetectedObject, index: number) => {
        if (
          item.bbox?.x1 === undefined ||
          item.bbox?.y1 === undefined ||
          item.bbox?.x2 === undefined ||
          item.bbox?.y2 === undefined
        ) {
          return;
        }

        overlays.push({
          key: `object-${index}-${item.timestamp}`,
          modality: "object",
          label: item.displayLabel || item.class_name,
          color: "border-cyan-300/70 bg-transparent",
          x: item.bbox.x1,
          y: item.bbox.y1,
          w: item.bbox.x2 - item.bbox.x1,
          h: item.bbox.y2 - item.bbox.y1,
          sourceItem: item,
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

        overlays.push({
          key: `expression-${index}-${item.timestamp}`,
          modality: "expression",
          label: item.dominant_emotion || "expression",
          color: "border-fuchsia-400/80 bg-fuchsia-400/10",
          x: item.bbox.x,
          y: item.bbox.y,
          w: item.bbox.w,
          h: item.bbox.h,
          sourceItem: item,
        });
      });
    }

    return overlays;
  }, [activeExpressions, activeOCR, activeRawObjects, overlayToggles, overlaysReady]);

  const selectedOverlay = useMemo(
    () => overlayBoxes.find((overlay) => overlay.key === selectedOverlayKey) || null,
    [overlayBoxes, selectedOverlayKey],
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
    return {
      label:
        personCount === 0
          ? "no person"
          : personCount === 1
            ? "one person"
            : "multiple people",
      personCount,
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
      <div className="border-b border-slate-800 px-4 py-2">
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

      <div className="flex-1 px-4 pt-3 pb-4 min-h-0">
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div
            ref={mediaFrameRef}
            className={`relative min-h-[360px] shrink-0 overflow-hidden rounded-lg bg-black md:min-h-[420px] ${
              showCompareInPanel && compareSource ? "grid grid-cols-2 gap-2 bg-transparent" : "flex items-center justify-center"
            }`}
          >
            {isLoading ? (
              <div className="text-slate-400">Loading video...</div>
            ) : videoUrl && (!showCompareInPanel || !compareSource) ? (
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
                    className="pointer-events-none absolute"
                    style={{
                      left: renderedVideoRect.x,
                      top: renderedVideoRect.y,
                      width: renderedVideoRect.width,
                      height: renderedVideoRect.height,
                    }}
                  >
                    {overlayBoxes.map((overlay) => {
                      const videoWidth = videoRef.current?.videoWidth || 1;
                      const videoHeight = videoRef.current?.videoHeight || 1;
                      return (
                        <button
                          key={overlay.key}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedOverlayKey((current) =>
                              current === overlay.key ? null : overlay.key,
                            );
                          }}
                          className={`pointer-events-auto absolute overflow-hidden rounded border ${overlay.color} ${
                            overlay.modality === "object" ? "cursor-pointer" : "pointer-events-none"
                          } ${selectedOverlayKey === overlay.key ? "ring-2 ring-cyan-300/70" : ""}`}
                          style={{
                            left: `${(overlay.x / videoWidth) * 100}%`,
                            top: `${(overlay.y / videoHeight) * 100}%`,
                            width: `${(overlay.w / videoWidth) * 100}%`,
                            height: `${(overlay.h / videoHeight) * 100}%`,
                          }}
                          title={
                            overlay.modality === "object"
                              ? "Click for bbox actions"
                              : overlay.label
                          }
                        >
                          <div className="truncate bg-black/60 px-1 py-0.5 text-[10px] text-slate-100">
                            {overlay.label}
                          </div>
                          {selectedOverlayKey === overlay.key && overlay.modality === "object" && (
                            <div className="absolute left-0 top-0 z-20 -translate-y-full rounded border border-slate-700 bg-[#111111] px-1.5 py-1 shadow-lg">
                              <div className="mb-1 text-[10px] text-slate-300">
                                {overlay.label}
                              </div>
                              <div className="flex items-center gap-1">
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
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedOverlayKey(null);
                                  }}
                                  className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
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
              </div>
            </div>

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
