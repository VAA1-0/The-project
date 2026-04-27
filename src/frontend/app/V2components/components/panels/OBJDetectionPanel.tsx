import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { VideoService, groupDetectedObjectsForDisplay } from "@/lib/video-service";
import { getVideoBlob, saveVideoBlob } from "@/lib/blob-store";
import {
  broadcastAnalysisCorrectionRefresh,
  canUndoCorrectionSnapshot,
  buildCorrectionRule,
  buildDropCorrectionRule,
  createEmptyCorrections,
  mergeCorrectionRule,
  pushCorrectionSnapshot,
  removeCorrectionRule,
  undoLastCorrectionSnapshot,
  upsertManualVisualAnnotation,
} from "@/lib/annotation-corrections";
import type { ManualVisualAnnotation } from "@/lib/api-service";
import { useLayoutHost } from "../LayoutHost";

import { Download, Search, MoreHorizontal, RotateCcw } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  closeManualAnnotationInVideo,
  openManualAnnotationInVideo,
  openObjectIndicationInVideo,
} from "@/lib/video-navigation";
import { SecondOrderLabelAffirmationChips } from "./SecondOrderLabelAffirmations";

const OBJECT_INDICATION_CATEGORIES: ManualVisualAnnotation["category"][] = [
  "OBJ",
  "Identification",
  "Role",
  "Action",
  "Movement",
  "Interaction",
  "Scene",
  "Cinematic Cues",
  "Expressions",
  "OCR",
  "Notes",
];

const OBJECT_INDICATION_SUBCATEGORIES: Record<
  ManualVisualAnnotation["category"],
  string[]
> = {
  Action: ["Action"],
  Audio: ["Sound event"],
  "Cinematic Cues": ["Composition", "Shot size"],
  Expressions: ["Expression"],
  Genre: ["Media genre"],
  Identification: ["Character", "Identity"],
  Interaction: ["Interaction"],
  Metadata: ["Correlation"],
  Movement: ["Subject movement"],
  Notes: ["Timestamped note"],
  OBJ: ["Object label"],
  OCR: ["Visible text"],
  Role: ["Role affirmation"],
  Scene: ["Scene type"],
  Transcription: ["Transcript note"],
};

type ObjectIndicationDraft = {
  category: ManualVisualAnnotation["category"];
  subcategory: string;
  label: string;
  start: number;
  end: number;
  note: string;
};

function objectRowKey(obj: any, index = 0): string {
  return [
    obj.trackId ?? obj.class_name ?? "object",
    obj.startTimestamp ?? obj.timestamp ?? 0,
    obj.endTimestamp ?? obj.timestamp ?? 0,
    index,
  ].join(":");
}

function firstSubcategory(category: ManualVisualAnnotation["category"]): string {
  return OBJECT_INDICATION_SUBCATEGORIES[category]?.[0] || "Object label";
}

function formatPreciseTime(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "time n/a";
  }
  const safeValue = Math.max(0, value);
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.floor(safeValue % 60);
  const milliseconds = Math.floor((safeValue - Math.floor(safeValue)) * 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
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

function resolveManualVisualDisplayLabel(item: ManualVisualAnnotation): string {
  return (
    item.identity_affirmation ||
    item.role_affirmation ||
    item.custom_label ||
    item.label ||
    "manual annotation"
  ).trim();
}

function manualObjectTargetId(item: ManualVisualAnnotation): string | null {
  const targetType = String(item.metadata_correlation?.target_type || "").toLowerCase();
  if (targetType !== "object") {
    return null;
  }
  const targetId = item.metadata_correlation?.target_id;
  return targetId === undefined || targetId === null ? null : String(targetId);
}

function getObjectTrackId(obj: any): string | null {
  const trackId = obj?.trackId ?? obj?.track_id;
  return trackId === undefined || trackId === null ? null : String(trackId);
}

function getObjectSourceLabel(obj: any): string {
  const trackId = getObjectTrackId(obj);
  const rawLabel = String(
    obj?.raw_class_name || obj?.class_name || obj?.displayLabel || "",
  ).trim();
  if (trackId && rawLabel.toLowerCase().startsWith("person")) {
    return `person track ${trackId}`;
  }
  if (trackId) {
    return rawLabel ? `${rawLabel} track ${trackId}` : `track ${trackId}`;
  }
  return rawLabel || "source object";
}

function getManualAnnotationBounds(item: ManualVisualAnnotation) {
  const start = Number(item.start_seconds ?? item.timestamp_seconds ?? 0);
  const end = Number(item.end_seconds ?? item.timestamp_seconds ?? start);
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

function pickAuthoritativeObjectOverride(
  overrides: ManualVisualAnnotation[],
  obj: any,
): ManualVisualAnnotation | undefined {
  if (!overrides.length) {
    return undefined;
  }
  const objStart = Number(obj.startTimestamp ?? obj.timestamp ?? 0);
  const objEnd = Number(obj.endTimestamp ?? obj.timestamp ?? objStart);
  const overlapping = overrides.filter((item) => {
    const bounds = getManualAnnotationBounds(item);
    return objEnd >= bounds.start && objStart <= bounds.end;
  });
  const candidates = overlapping.length > 0 ? overlapping : overrides;
  return [...candidates].sort((left, right) => {
    const leftUpdated = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightUpdated = Date.parse(right.updated_at || right.created_at || "") || 0;
    if (leftUpdated !== rightUpdated) {
      return rightUpdated - leftUpdated;
    }
    const leftStart = getManualAnnotationBounds(left).start;
    const rightStart = getManualAnnotationBounds(right).start;
    return rightStart - leftStart;
  })[0];
}

function buildObjectIndicationDraft(
  obj: any,
  latestLabel?: string,
  manualOverride?: ManualVisualAnnotation,
): ObjectIndicationDraft {
  const overrideBounds = manualOverride ? getManualAnnotationBounds(manualOverride) : null;
  const start = Number(overrideBounds?.start ?? obj.startTimestamp ?? obj.timestamp ?? 0);
  const end = Number(overrideBounds?.end ?? obj.endTimestamp ?? obj.timestamp ?? start);
  const isPerson = String(obj.raw_class_name || obj.class_name || "")
    .toLowerCase()
    .includes("person");
  const category: ManualVisualAnnotation["category"] =
    manualOverride?.category || (isPerson ? "Identification" : "OBJ");
  return {
    category,
    subcategory: manualOverride?.subcategory || firstSubcategory(category),
    label: String(
      latestLabel ||
        (manualOverride ? resolveManualVisualDisplayLabel(manualOverride) : "") ||
        obj.displayLabel ||
        obj.class_name ||
        "Object present",
    ),
    start,
    end: Math.max(end, start + 0.001),
    note: manualOverride?.open_note || "",
  };
}

function normalizeObjectBox(
  obj: any,
  width: number,
  height: number,
): ManualVisualAnnotation["coordinates"] | null {
  const bbox = obj?.bbox;
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
  const [x1Raw, y1Raw, x2Raw, y2Raw] = values;
  const appearsNormalized = Math.max(...values.map(Math.abs)) <= 1.5;
  const safeWidth = width > 1 ? width : 1920;
  const safeHeight = height > 1 ? height : 1080;
  const x1 = appearsNormalized ? x1Raw : x1Raw / safeWidth;
  const y1 = appearsNormalized ? y1Raw : y1Raw / safeHeight;
  const x2 = appearsNormalized ? x2Raw : x2Raw / safeWidth;
  const y2 = appearsNormalized ? y2Raw : y2Raw / safeHeight;
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const right = Math.max(x1, x2);
  const bottom = Math.max(y1, y2);
  return {
    x: Math.min(Math.max(left, 0), 1),
    y: Math.min(Math.max(top, 0), 1),
    w: Math.min(Math.max(right - left, 0.002), 1),
    h: Math.min(Math.max(bottom - top, 0.002), 1),
  };
}

export default function OBJDetectionPanel() {
  const { openPanel } = useLayoutHost();
  const [videoId, setVideoId] = useState("");

  // Event bus video time line state
  const [videoTimeLine, setVideoTimeLine] = useState<number>(0);

  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedObjectKey, setSelectedObjectKey] = useState<string | null>(null);
  const [objectDrafts, setObjectDrafts] = useState<Record<string, ObjectIndicationDraft>>({});
  const [objectTimeInputDrafts, setObjectTimeInputDrafts] = useState<Record<string, string>>({});
  const [objectActionMessage, setObjectActionMessage] = useState<string | null>(null);

  // Listen for video ID changes via event bus
  useEffect(() => {
    const handler = (id: string) => {
      setVideoId(id);
    };
    const correctionHandler = (id: string) => {
      if (id === videoId) {
        setRefreshNonce((current) => current + 1);
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
    async function load() {
      if (!videoId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Load metadata
        const m = await VideoService.get(videoId);

        console.log("Loaded metadata:", m);

        setMetadata(m);

        // Load video blob - hybrid approach
        // 1. First try to get the original video from IndexedDB (instant preview)
        let blob = await getVideoBlob(videoId);

        if (!blob) {
          // 2. Fallback: try to get the annotated video from the backend (after analysis completes)
          blob = await VideoService.getBlob(videoId);
          if (blob) {
            await saveVideoBlob(videoId, blob);
          }
        }
        if (blob) {
          if (lastObjectUrl.current) {
            URL.revokeObjectURL(lastObjectUrl.current);
          }
          const url = URL.createObjectURL(blob);
          lastObjectUrl.current = url;
          setVideoUrl(url);
          setBlobMissing(false);
        } else {
          setBlobMissing(true);
          setVideoUrl(null);
        }

        // Load analysis data
        const analysis = await VideoService.getAnalysis(videoId);

        setAnalysisData(analysis);
        setRawCsv(analysis.rawCsv || null);
      } catch (err) {
        console.error("Failed to load data:", err);
        setBlobMissing(true);
        setVideoUrl(null);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [videoId, refreshNonce]);

  const detectedObjects = analysisData?.detectedObjects ?? [];
  const groupedObjects = [...groupDetectedObjectsForDisplay(detectedObjects)].sort(
    (left: any, right: any) => {
      const leftStart = left.startTimestamp ?? left.timestamp ?? 0;
      const rightStart = right.startTimestamp ?? right.timestamp ?? 0;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }

      const leftEnd = left.endTimestamp ?? left.timestamp ?? 0;
      const rightEnd = right.endTimestamp ?? right.timestamp ?? 0;
      if (leftEnd !== rightEnd) {
        return leftEnd - rightEnd;
      }

      const leftTrack = left.trackId ?? Number.MAX_SAFE_INTEGER;
      const rightTrack = right.trackId ?? Number.MAX_SAFE_INTEGER;
      if (leftTrack !== rightTrack) {
        return leftTrack - rightTrack;
      }

      return String(left.displayLabel || left.class_name || "").localeCompare(
        String(right.displayLabel || right.class_name || ""),
      );
    },
  );
  const summaryText = analysisData?.summary ?? "…";
  const manualOverridesByTrack = React.useMemo(() => {
    const overrides = new Map<string, ManualVisualAnnotation[]>();
    for (const item of analysisData?.annotationCorrections?.manual_visual_annotations || []) {
      const targetId = manualObjectTargetId(item);
      if (targetId) {
        const existing = overrides.get(targetId) || [];
        overrides.set(targetId, [...existing, item]);
      }
    }
    return overrides;
  }, [analysisData?.annotationCorrections?.manual_visual_annotations]);

  const getManualOverrideForObject = React.useCallback(
    (obj: any): ManualVisualAnnotation | undefined => {
      const trackId = getObjectTrackId(obj);
      const trackOverrides = trackId ? manualOverridesByTrack.get(trackId) || [] : [];
      return pickAuthoritativeObjectOverride(trackOverrides, obj);
    },
    [manualOverridesByTrack],
  );

  const getLatestObjectLabel = React.useCallback(
    (obj: any): string => {
      const manualOverride = getManualOverrideForObject(obj);
      return manualOverride
        ? resolveManualVisualDisplayLabel(manualOverride)
        : String(obj.displayLabel || obj.class_name || "Object present");
    },
    [getManualOverrideForObject],
  );

  const updateObjectDraft = (
    key: string,
    patch: Partial<ObjectIndicationDraft>,
  ) => {
    setObjectDrafts((current) => {
      const obj = groupedObjects.find((item: any, index: number) => objectRowKey(item, index) === key);
      const manualOverride = obj ? getManualOverrideForObject(obj) : undefined;
      const base =
        current[key] ||
        (obj
          ? buildObjectIndicationDraft(obj, getLatestObjectLabel(obj), manualOverride)
          : null);
      if (!base) {
        return current;
      }
      const next = { ...base, ...patch };
      if (patch.category && patch.category !== base.category) {
        next.subcategory = firstSubcategory(patch.category);
      }
      next.start = Number.isFinite(Number(next.start)) ? Number(next.start) : 0;
      next.end = Math.max(Number(next.end), next.start + 0.001);
      return { ...current, [key]: next };
    });
  };

  const commitObjectTimeInput = (
    inputKey: string,
    rowKey: string,
    field: "start" | "end",
    fallbackValue: number,
  ) => {
    const draftValue = objectTimeInputDrafts[inputKey];
    if (draftValue === undefined) return;
    const parsed = parsePreciseTimeInput(draftValue);
    if (parsed !== null) {
      updateObjectDraft(rowKey, { [field]: parsed });
    } else {
      setObjectActionMessage(`Invalid time. Keeping ${formatPreciseTime(fallbackValue)}.`);
    }
    setObjectTimeInputDrafts((current) => {
      const next = { ...current };
      delete next[inputKey];
      return next;
    });
  };

  const activateObjectInVideo = (obj: any, key: string) => {
    const latestLabel = getLatestObjectLabel(obj);
    const draft =
      objectDrafts[key] ||
      buildObjectIndicationDraft(obj, latestLabel, getManualOverrideForObject(obj));
    setSelectedObjectKey(key);
    setObjectDrafts((current) => ({ ...current, [key]: draft }));
    const cueTime = Number(draft.start || obj.startTimestamp || obj.timestamp || 0);
    openObjectIndicationInVideo(videoId, {
      timestamp: cueTime,
      trackId: obj.trackId,
      label: latestLabel,
      start: draft.start,
      end: draft.end,
      category: draft.category,
      note: draft.note,
    });
  };

  const saveObjectIndication = async (obj: any, key: string) => {
    if (!videoId) {
      return;
    }
    const latestLabel = getLatestObjectLabel(obj);
    const draft =
      objectDrafts[key] ||
      buildObjectIndicationDraft(obj, latestLabel, getManualOverrideForObject(obj));
    const width = Number(
      metadata?.width ??
        metadata?.source_media_metadata?.width ??
        analysisData?.source_media_metadata?.width ??
        analysisData?.metadata?.width ??
        0,
    );
    const height = Number(
      metadata?.height ??
        metadata?.source_media_metadata?.height ??
        analysisData?.source_media_metadata?.height ??
        analysisData?.metadata?.height ??
        0,
    );
    const coordinates = normalizeObjectBox(obj, width, height);
    if (!coordinates) {
      setObjectActionMessage("Could not save indication: object has no usable box.");
      return;
    }
    const start = Number(draft.start || obj.startTimestamp || obj.timestamp || 0);
    const end = Math.max(Number(draft.end || start), start + 0.001);
    const label = draft.label.trim() || latestLabel || obj.displayLabel || obj.class_name || "Object present";
    const annotation: ManualVisualAnnotation = {
      id: `${videoId}:object-indication:${obj.trackId ?? key}`,
      category: draft.category,
      subcategory: draft.subcategory || firstSubcategory(draft.category),
      label,
      custom_label: draft.label.trim() || undefined,
      geometry_type: "box",
      coordinates,
      timestamp_seconds: Number(start.toFixed(3)),
      start_seconds: Number(start.toFixed(3)),
      end_seconds: Number(end.toFixed(3)),
      identity_affirmation:
        draft.category === "Identification" ? label : undefined,
      role_affirmation: draft.category === "Role" ? label : undefined,
      open_note: draft.note.trim() || undefined,
      metadata_correlation: {
        target_type: "object",
        target_id: String(obj.trackId ?? key),
      target_label: getObjectSourceLabel(obj),
        relation: "extends",
        note: "Adopted from Objects leaf panel indication editor.",
      },
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
    setSelectedObjectKey(null);
    setObjectDrafts((current) => ({
      ...current,
      [key]: buildObjectIndicationDraft(
        {
          ...obj,
          annotationCategory: annotation.category,
          annotationSubcategory: annotation.subcategory,
          identityAffirmation: annotation.identity_affirmation,
          roleAffirmation: annotation.role_affirmation,
          openNote: annotation.open_note,
          startTimestamp: annotation.start_seconds,
          endTimestamp: annotation.end_seconds,
          displayLabel: label,
        },
        label,
        annotation,
      ),
    }));
    setObjectActionMessage(`Saved indication: ${annotation.category} / ${label}`);
    broadcastAnalysisCorrectionRefresh(videoId);
    eventBus.emit("videoObjectLabelOverride", {
      videoId,
      trackId: obj.trackId,
      sourceLabel: getObjectSourceLabel(obj),
      label,
      start,
      end,
    });
    openManualAnnotationInVideo(videoId, annotation, {
      focusVideoPanel: false,
      seekVideo: false,
    });
    closeManualAnnotationInVideo(videoId, annotation.id);
  };

  const saveObjectCorrection = async (obj: any) => {
    const rawValue = obj?.raw_class_name || obj?.class_name || obj?.displayLabel;
    if (!videoId || !rawValue) {
      return;
    }
    const suggested = Array.from(
      new Set(
        groupedObjects
          .map((item: any) => item.raw_class_name || item.class_name || item.displayLabel)
          .filter(Boolean),
      ),
    )
      .sort()
      .slice(0, 12);
    const correctedValue = window.prompt(
      `Correct object label:\n${rawValue}\n\nLikely labels: ${suggested.join(", ")}`,
      rawValue,
    );
    if (!correctedValue || correctedValue.trim() === rawValue.trim()) {
      return;
    }
    const existingCorrections = analysisData?.annotationCorrections;
    const filteredOverrides = (existingCorrections?.label_overrides || []).filter(
      (rule: any) =>
        !(
          rule?.modality === "object" &&
          String(rule?.raw_value || "").trim().toLowerCase() ===
            rawValue.trim().toLowerCase() &&
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
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const revertObjectCorrection = async (obj: any) => {
    if (!videoId) {
      return;
    }
    const rawValue = obj?.raw_class_name || obj?.class_name || obj?.displayLabel;
    const scopedRuleId = buildCorrectionRule("object", rawValue, "__revert__", "", {
      targetTimestamp: obj.timestamp,
      targetStartTimestamp: obj.startTimestamp ?? obj.timestamp,
      targetEndTimestamp: obj.endTimestamp ?? obj.timestamp,
      targetTrackId: obj.trackId,
    }).id;
    let nextCorrections = removeCorrectionRule(
      analysisData?.annotationCorrections,
      scopedRuleId,
    );
    for (const rule of analysisData?.annotationCorrections?.label_overrides || []) {
      if (
        rule?.modality === "object" &&
        String(rule?.raw_value || "").trim().toLowerCase() ===
          String(rawValue).trim().toLowerCase() &&
        (rule?.target_track_id === undefined ||
          Number(rule.target_track_id) === Number(obj.trackId))
      ) {
        nextCorrections = removeCorrectionRule(nextCorrections, rule.id);
      }
    }
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const dropObjectDetection = async (obj: any) => {
    if (!videoId) {
      return;
    }
    const rawValue = obj?.raw_class_name || obj?.class_name || obj?.displayLabel;
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
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const undoLastCorrection = async () => {
    if (!videoId) {
      return;
    }
    const restored = undoLastCorrectionSnapshot(videoId);
    if (restored === null && !analysisData?.annotationCorrections) {
      return;
    }
    const nextCorrections =
      restored || createEmptyCorrections(analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const canUndo = canUndoCorrectionSnapshot(videoId);

  return (
    <TooltipProvider delayDuration={200}>
      <main className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between shrink-0">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
              Objects
            </span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      void undoLastCorrection();
                    }}
                    disabled={!canUndo}
                    className="p-1 hover:bg-[#2a2a2a] rounded disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <RotateCcw className="size-3.5 text-[#b8b8b8]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Undo last correction</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-[#2a2a2a] rounded">
                    <Search className="size-3.5 text-[#b8b8b8]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search transcript</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-[#2a2a2a] rounded">
                    <MoreHorizontal className="size-3.5 text-[#b8b8b8]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>More actions</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex-1 min-h-0 px-3 pb-3 flex flex-col">
            <div className="mb-2 shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
              Detected objects
            </div>
            {objectActionMessage && (
              <div className="mb-2 rounded border border-emerald-900/50 bg-emerald-950/20 px-2 py-1 text-[10px] text-emerald-200">
                {objectActionMessage}
              </div>
            )}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2">
              {groupedObjects.length === 0 ? (
                <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
                  No detected objects
                </div>
              ) : (
                groupedObjects.map((obj: any, idx: number) => {
                  const rowKey = objectRowKey(obj, idx);
                  const selected = selectedObjectKey === rowKey;
                  const latestLabel = getLatestObjectLabel(obj);
                  const trackId = getObjectTrackId(obj);
                  const sourceLabel = getObjectSourceLabel(obj);
                  const manualOverride = trackId ? manualOverridesByTrack.get(trackId) : undefined;
                  const draft =
                    objectDrafts[rowKey] || buildObjectIndicationDraft(obj, latestLabel);
                  const startInputKey = `${rowKey}:start`;
                  const endInputKey = `${rowKey}:end`;
                  return (
                  <div
                    key={rowKey}
                    className={`cursor-pointer rounded border px-3 py-2 transition hover:bg-slate-900/35 ${
                      selected
                        ? "border-cyan-600/70 bg-cyan-950/15"
                        : obj.sourceType === "manual_visual"
                        ? "border-emerald-700/60 bg-emerald-950/20"
                        : "border-slate-800 bg-slate-950/20"
                    }`}
                    onClick={() => {
                      activateObjectInVideo(obj, rowKey);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] text-slate-200">
                          {latestLabel}
                        </div>
                        <div className="truncate text-[10px] text-[var(--ui-passive-text)]">
                          Source: {sourceLabel}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            activateObjectInVideo(obj, rowKey);
                          }}
                          className="rounded bg-cyan-900/50 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-800/70"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void dropObjectDetection(obj);
                          }}
                          className="rounded bg-rose-900/40 px-1.5 py-0.5 text-[10px] text-rose-200 hover:bg-rose-800/55 hover:text-rose-50"
                        >
                          Drop
                        </button>
                        <span className="text-[10px] text-[var(--ui-passive-text)]">
                          {(obj.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {manualOverride && (
                      <div className="mt-1 text-[10px] text-emerald-300/90">
                        Latest analyst label • source remains {sourceLabel}
                      </div>
                    )}
                    <div className="mt-1">
                      <SecondOrderLabelAffirmationChips
                        plan={analysisData?.secondOrderLabelProliferation}
                        surface="objects_panel"
                        targetLabelFamilies={[
                          "Interaction",
                          "Action",
                          "Movement",
                          "Object",
                          "Identification",
                        ]}
                        timeSpan={{
                          start: Number(obj.startTimestamp ?? obj.timestamp ?? 0),
                          end: Number(obj.endTimestamp ?? obj.timestamp ?? 0),
                        }}
                        compact
                        limit={3}
                      />
                    </div>
                    {obj.sourceType === "manual_visual" && (
                      <div className="mt-1 text-[10px] text-emerald-300/90">
                        Native annotation
                        {obj.annotationCategory ? ` • ${obj.annotationCategory}` : ""}
                        {obj.annotationSubcategory ? ` • ${obj.annotationSubcategory}` : ""}
                      </div>
                    )}
                    {selected && (
                      <div
                        className="mt-2 rounded border border-slate-800 bg-black/30 p-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="mb-1 grid grid-cols-[1fr_1fr] gap-1">
                          <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                            Category
                            <select
                              value={draft.category}
                              onChange={(event) =>
                                updateObjectDraft(rowKey, {
                                  category: event.target.value as ManualVisualAnnotation["category"],
                                })
                              }
                              className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-200"
                              aria-label="Object indication category"
                            >
                              {OBJECT_INDICATION_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                            Attribute
                            <select
                              value={draft.subcategory}
                              onChange={(event) =>
                                updateObjectDraft(rowKey, { subcategory: event.target.value })
                              }
                              className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-200"
                              aria-label="Object indication subcategory"
                            >
                              {(OBJECT_INDICATION_SUBCATEGORIES[draft.category] || []).map(
                                (subcategory) => (
                                  <option key={subcategory} value={subcategory}>
                                    {subcategory}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        </div>
                        <label className="mb-1 block text-[9px] uppercase tracking-[0.12em] text-slate-500">
                          Latest label
                          <input
                            type="text"
                            value={draft.label}
                            onChange={(event) =>
                              updateObjectDraft(rowKey, { label: event.target.value })
                            }
                            className="mt-0.5 w-full rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-200"
                            placeholder="Analyst label or identity"
                            aria-label="Object indication label"
                          />
                        </label>
                        <div className="mb-1 grid grid-cols-[1fr_1fr_auto_auto] gap-1">
                          <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                            In {formatPreciseTime(draft.start)}
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                objectTimeInputDrafts[startInputKey] ??
                                formatPreciseTime(draft.start)
                              }
                              onChange={(event) => {
                                setObjectTimeInputDrafts((current) => ({
                                  ...current,
                                  [startInputKey]: event.target.value,
                                }));
                              }}
                              onBlur={() =>
                                commitObjectTimeInput(
                                  startInputKey,
                                  rowKey,
                                  "start",
                                  draft.start,
                                )
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitObjectTimeInput(
                                    startInputKey,
                                    rowKey,
                                    "start",
                                    draft.start,
                                  );
                                  event.currentTarget.blur();
                                } else if (event.key === "Escape") {
                                  setObjectTimeInputDrafts((current) => {
                                    const next = { ...current };
                                    delete next[startInputKey];
                                    return next;
                                  });
                                  event.currentTarget.blur();
                                }
                              }}
                              className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-200"
                              aria-label="Object indication start"
                            />
                          </label>
                          <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                            Out {formatPreciseTime(draft.end)}
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                objectTimeInputDrafts[endInputKey] ??
                                formatPreciseTime(draft.end)
                              }
                              onChange={(event) => {
                                setObjectTimeInputDrafts((current) => ({
                                  ...current,
                                  [endInputKey]: event.target.value,
                                }));
                              }}
                              onBlur={() =>
                                commitObjectTimeInput(
                                  endInputKey,
                                  rowKey,
                                  "end",
                                  draft.end,
                                )
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitObjectTimeInput(
                                    endInputKey,
                                    rowKey,
                                    "end",
                                    draft.end,
                                  );
                                  event.currentTarget.blur();
                                } else if (event.key === "Escape") {
                                  setObjectTimeInputDrafts((current) => {
                                    const next = { ...current };
                                    delete next[endInputKey];
                                    return next;
                                  });
                                  event.currentTarget.blur();
                                }
                              }}
                              className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-200"
                              aria-label="Object indication end"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateObjectDraft(rowKey, { start: videoTimeLine })
                            }
                            className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                          >
                            In
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateObjectDraft(rowKey, { end: videoTimeLine })
                            }
                            className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                          >
                            Out
                          </button>
                        </div>
                        <textarea
                          value={draft.note}
                          onChange={(event) =>
                            updateObjectDraft(rowKey, { note: event.target.value })
                          }
                          className="mb-1 h-12 w-full resize-none rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] text-slate-200"
                          placeholder="Analyst note"
                          aria-label="Object indication note"
                        />
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              void saveObjectIndication(obj, rowKey);
                            }}
                            className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] text-emerald-100 hover:bg-emerald-800/70"
                          >
                            Save indication
                          </button>
                          <button
                            type="button"
                            onClick={() => activateObjectInVideo(obj, rowKey)}
                            className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700/80"
                          >
                            Show video
                          </button>
                        </div>
                      </div>
                    )}
                    {obj.raw_class_name &&
                      (obj.displayLabel || obj.class_name) &&
                      !String(obj.displayLabel || obj.class_name)
                        .toLowerCase()
                        .startsWith(String(obj.raw_class_name).toLowerCase()) && (
                        <div className="mt-1 text-[10px] text-amber-300/90">
                          Raw label: {obj.raw_class_name}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void revertObjectCorrection(obj);
                            }}
                            className="ml-2 rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700/70 hover:text-slate-50"
                          >
                            Revert
                          </button>
                        </div>
                      )}
                    <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                      Seen {formatPreciseTime(obj.startTimestamp ?? obj.timestamp)}
                      {obj.endTimestamp !== undefined &&
                        obj.endTimestamp !== obj.startTimestamp &&
                        ` - ${formatPreciseTime(obj.endTimestamp)}`}
                      {" • "}
                      {obj.occurrenceCount && obj.occurrenceCount > 1
                        ? `${obj.occurrenceCount} detections grouped`
                        : ""}
                    </div>
                    {obj.identityAffirmation && (
                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        Identification: {obj.identityAffirmation}
                      </div>
                    )}
                    {obj.roleAffirmation && (
                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        Role: {obj.roleAffirmation}
                      </div>
                    )}
                    {obj.openNote && (
                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        Note: {obj.openNote}
                      </div>
                    )}
                    {obj.screenPresenceProfile && (
                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        {obj.screenPresenceProfile.tier === "primary"
                          ? "Primary on-screen agent"
                          : obj.screenPresenceProfile.tier === "secondary"
                            ? "Secondary on-screen agent"
                            : "Background on-screen agent"}
                        {" • "}
                        {obj.screenPresenceProfile.profileId}
                        {" • "}
                        {Math.round(obj.screenPresenceProfile.dominanceScore * 100)}%
                      </div>
                    )}
                    {obj.screenPresenceProfile?.cues?.length > 0 && (
                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        Cues: {obj.screenPresenceProfile.cues.join(" • ")}
                      </div>
                    )}
                    {obj.demographicSummary && (
                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        Possible{" "}
                        {[
                          obj.demographicSummary.ageBand,
                          obj.demographicSummary.genderPresentation,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                        {" • "}
                        {obj.demographicSummary.confidenceLabel}
                        {typeof obj.demographicSummary.confidenceScore === "number" &&
                          ` ${Math.round(obj.demographicSummary.confidenceScore * 100)}%`}
                      </div>
                    )}
                    {obj.demographicSummary?.audioSupport && (
                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        Audio support: {obj.demographicSummary.audioSupport.label}
                        {" • "}
                        {obj.demographicSummary.audioSupport.overlappingSegments} segment
                        {obj.demographicSummary.audioSupport.overlappingSegments === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
