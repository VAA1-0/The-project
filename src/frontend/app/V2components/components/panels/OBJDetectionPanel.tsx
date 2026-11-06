import { prepareCorrectionUndo, correctionUndoVerified } from "@/lib/correction-word-undo";

import { parsePreciseSourceTime } from "@/lib/source-clock";

import { formatPreciseSourceTime } from "@/lib/source-clock";
import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import {
  VideoService,
  filterUntrackedRawObjectCandidates,
  groupDetectedObjectsForDisplay,
  type BodyMovementDetection,
} from "@/lib/video-service";
import { getVideoBlob, saveVideoBlob } from "@/lib/blob-store";
import {
  broadcastAnalysisCorrectionRefresh,
  canUndoCorrectionSnapshot,
  buildCorrectionRule,
  buildDropCorrectionRule,
  createEmptyCorrections,
  mergeCorrectionRule,
  pushCorrectionSnapshot,
  requireSavedManualVisualAnnotation,
  removeCorrectionRule,
  peekCorrectionSnapshot,
  acknowledgeCorrectionSnapshot,
  upsertManualVisualAnnotation,
} from "@/lib/annotation-corrections";
import { apiService } from "@/lib/api-service";
import type { AnnotationCorrections, ManualVisualAnnotation, ObjectAppearanceMeasurementResult, ProliferationDecision } from "@/lib/api-service";
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
  openVideoAtTime,
} from "@/lib/video-navigation";
import {
  buildManualBBoxRoiAnnotation,
  detectedObjectToNormalizedBox,
  manualAnnotationBBoxFingerprint,
  normalizeDraftBox,
} from "@/lib/bbox-authority";
import { SecondOrderLabelAffirmationChips } from "./SecondOrderLabelAffirmations";
import { SourceLinkedClusterThumbnail } from "../SourceLinkedClusterThumbnail";
import { DynamicPanelSection } from "../DynamicPanelSection";

const OBJECT_INDICATION_CATEGORIES: ManualVisualAnnotation["category"][] = [
  "Action",
  "Cinematic Cues",
  "Expressions",
  "Identification",
  "Interaction",
  "Movement",
  "Notes",
  "OBJ",
  "OCR",
  "Role",
  "Scene",
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

type ObjectClusterMember = {
  key: string;
  evidenceId: string;
  object: any;
  family: string;
  sourceFamily: string;
  trackId: string;
  start: number;
  end: number;
  quality: number;
  confirmed: boolean;
};

type ObjectClusterFamily = {
  name: string;
  members: ObjectClusterMember[];
  representative: ObjectClusterMember;
  boundary: ObjectClusterMember;
  cohesion: number;
  temporalStart: number;
  temporalEnd: number;
};

function objectRowKey(obj: any, index = 0): string {
  return getObjectEvidenceId(obj, index);
}

function firstSubcategory(category: ManualVisualAnnotation["category"]): string {
  return OBJECT_INDICATION_SUBCATEGORIES[category]?.[0] || "Object label";
}

function formatPreciseTime(value?: number): string {
  return typeof value === "number" && Number.isFinite(value) ? formatPreciseSourceTime(value) : "time n/a";
}

function parsePreciseTimeInput(value: string): number | null {
  return parsePreciseSourceTime(value);
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

function objManualCategoryDisplayLabel(category: ManualVisualAnnotation["category"]): string {
  return category === "Identification" ? "Narrative Agent" : category;
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
  const governedTrackId = obj?.detectorTrackUid ?? obj?.detector_track_uid;
  if (governedTrackId !== undefined && governedTrackId !== null) {
    return String(governedTrackId);
  }
  const trackId = obj?.trackId ?? obj?.track_id;
  return trackId === undefined || trackId === null ? null : String(trackId);
}

function getObjectEvidenceId(obj: any, index = 0): string {
  const governedTrackId = obj?.detectorTrackUid ?? obj?.detector_track_uid;
  if (governedTrackId !== undefined && governedTrackId !== null && String(governedTrackId).trim()) {
    return String(governedTrackId);
  }
  const bbox = obj?.bbox && typeof obj.bbox === "object"
    ? [obj.bbox.x, obj.bbox.y, obj.bbox.w ?? obj.bbox.width, obj.bbox.h ?? obj.bbox.height]
        .map((value) => Number(value ?? 0).toFixed(4)).join(",")
    : "no-bbox";
  return [
    "legacy-object-evidence",
    obj?.detectorProvider ?? "legacy-provider",
    obj?.detectorRunId ?? "legacy-run",
    obj?.raw_class_name ?? obj?.class_name ?? "object",
    obj?.trackId ?? obj?.track_id ?? `row-${index}`,
    Number(obj?.startTimestamp ?? obj?.timestamp ?? 0).toFixed(3),
    Number(obj?.endTimestamp ?? obj?.timestamp ?? 0).toFixed(3),
    bbox,
  ].join(":");
}

function getObjectTrackRefs(obj: any): string[] {
  return [...new Set([
    getObjectEvidenceId(obj),
    getObjectTrackId(obj),
    obj?.trackId ?? obj?.track_id,
  ].filter((value) => value !== undefined && value !== null).map(String))];
}

function getObjectSourceLabel(obj: any): string {
  const trackId = obj?.trackId ?? obj?.track_id ?? getObjectTrackId(obj);
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
  const broadScopeOverrides = overrides.filter((item) =>
    [
      "track_family",
      "narrative_agent_family",
      "current_continuity_segment",
      "current_scene",
    ].includes(String(item.metadata_correlation?.apply_scope || "").toLowerCase()),
  );
  const candidates = overlapping.length > 0 ? overlapping : broadScopeOverrides;
  if (candidates.length === 0) {
    return undefined;
  }
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
  const [objectClusterThreshold, setObjectClusterThreshold] = useState(65);
  const [activeObjectFamily, setActiveObjectFamily] = useState("");
  const [selectedObjectClusterSamples, setSelectedObjectClusterSamples] = useState<string[]>([]);
  const [stagedObjectFamilies, setStagedObjectFamilies] = useState<Record<string, string>>({});
  const [objectFamilyDraft, setObjectFamilyDraft] = useState("");
  const [objectClusterBusy, setObjectClusterBusy] = useState(false);
  const [objectAppearanceMeasurement, setObjectAppearanceMeasurement] = useState<ObjectAppearanceMeasurementResult | null>(null);
  const [objectAppearanceBusy, setObjectAppearanceBusy] = useState(false);
  const [objectEvidenceLayerFilter, setObjectEvidenceLayerFilter] = useState("all");
  const [collapsedObjectFamilyRows, setCollapsedObjectFamilyRows] = useState<Record<string, boolean>>({});
  const [objectFamilyOrder, setObjectFamilyOrder] = useState<string[]>([]);
  const [editingObjectFamily, setEditingObjectFamily] = useState("");
  const [objectFamilyTitleDraft, setObjectFamilyTitleDraft] = useState("");
  const [objectMergeTarget, setObjectMergeTarget] = useState("");
  const [selectedUnmatchedObjectKeys, setSelectedUnmatchedObjectKeys] = useState<string[]>([]);
  const [newObjectFamilyTitle, setNewObjectFamilyTitle] = useState("");

  const knownCharacters = React.useMemo(() => {
    const records = analysisData?.masterSchemaResolvedEvidence?.records || [];
    const agents = records
      .filter((r: any) => ["narrative_agent_profile", "character_role", "identity"].includes(r.category))
      .map((r: any) => r.label)
      .filter(Boolean);
    return Array.from(new Set(agents)).sort() as string[];
  }, [analysisData?.masterSchemaResolvedEvidence?.records]);

  const applySavedAnnotationCorrections = React.useCallback(
    (savedCorrections: AnnotationCorrections) => {
      setAnalysisData((current: any) =>
        current
          ? {
              ...current,
              annotationCorrections: savedCorrections,
            }
          : current,
      );
    },
    [],
  );

  // Listen for video ID changes via event bus
  useEffect(() => {
    const handler = (id: string) => {
      setVideoId(id);
      setActiveObjectFamily("");
      setSelectedObjectClusterSamples([]);
      setStagedObjectFamilies({});
      setObjectFamilyDraft("");
      setObjectAppearanceMeasurement(null);
      setCollapsedObjectFamilyRows({});
      setObjectFamilyOrder([]);
      setEditingObjectFamily("");
      setSelectedUnmatchedObjectKeys([]);
      setNewObjectFamilyTitle("");
    };
    const correctionHandler = (
      payload: string | { analysisId: string; corrections?: AnnotationCorrections },
    ) => {
      const id = typeof payload === "string" ? payload : payload.analysisId;
      if (id === videoId) {
        if (typeof payload !== "string" && payload.corrections) {
          // Install the canonical foreground commit immediately. Waiting for a
          // heavyweight analysis refresh leaves the Objects leaf showing raw
          // "person" after Video has accepted an analyst identity.
          applySavedAnnotationCorrections(payload.corrections);
        } else {
          setRefreshNonce((current) => current + 1);
        }
      }
    };
    eventBus.on("videoIdChanged", handler);
    eventBus.on("analysisCorrectionsChanged", correctionHandler);

    return () => {
      eventBus.off("videoIdChanged", handler);
      eventBus.off("analysisCorrectionsChanged", correctionHandler);
    };
  }, [applySavedAnnotationCorrections, videoId]);

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
  const rawDetectedObjects = analysisData?.rawDetectedObjects ?? [];
  const bodyMovementDetections = analysisData?.bodyMovementDetections ?? [];
  const confirmedObjectTrackIds = new Set(
    (analysisData?.annotationCorrections?.manual_visual_annotations || [])
      .map((item: ManualVisualAnnotation) => manualObjectTargetId(item))
      .filter((targetId: string | null): targetId is string => Boolean(targetId)),
  );
  const groupedObjects = [...groupDetectedObjectsForDisplay(detectedObjects)].sort(
    (left: any, right: any) => {
      // An analyst confirmation is mature evidence, so keep its source track
      // visible above the raw detector queue instead of burying it among every
      // other person found on the same beat.
      const leftConfirmed = getObjectTrackRefs(left).some((ref) => confirmedObjectTrackIds.has(ref));
      const rightConfirmed = getObjectTrackRefs(right).some((ref) => confirmedObjectTrackIds.has(ref));
      if (leftConfirmed !== rightConfirmed) {
        return leftConfirmed ? -1 : 1;
      }
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
  const untrackedRawObjectCandidates = React.useMemo(
    () => filterUntrackedRawObjectCandidates(groupedObjects, rawDetectedObjects),
    [groupedObjects, rawDetectedObjects],
  );
  const representedRawObjectCount = Math.max(
    0,
    rawDetectedObjects.length - untrackedRawObjectCandidates.length,
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
      const trackOverrides = getObjectTrackRefs(obj).flatMap((trackId) => manualOverridesByTrack.get(trackId) || []);
      const governedTrackId = String(obj?.detectorTrackUid ?? obj?.detector_track_uid ?? "");
      const sourceLabels = new Set([
        getObjectSourceLabel(obj),
        obj?.raw_class_name,
        obj?.class_name,
        obj?.displayLabel,
      ].filter(Boolean).map((value) => String(value).trim().toLocaleLowerCase()));
      const objStart = Number(obj.startTimestamp ?? obj.timestamp ?? 0);
      const objEnd = Number(obj.endTimestamp ?? obj.timestamp ?? objStart);
      const eligibleOverrides = trackOverrides.filter((item) => {
        const targetId = manualObjectTargetId(item) || "";
        if (governedTrackId && targetId === governedTrackId) return true;
        const targetLabel = String(item.metadata_correlation?.target_label || "").trim().toLocaleLowerCase();
        if (targetLabel) return sourceLabels.has(targetLabel);
        const bounds = getManualAnnotationBounds(item);
        return objEnd >= bounds.start && objStart <= bounds.end;
      });
      return pickAuthoritativeObjectOverride(eligibleOverrides, obj);
    },
    [manualOverridesByTrack],
  );

  const hasAmbiguousLegacyTrackCollision = React.useCallback((obj: any): boolean => {
    const rawTrackId = obj?.trackId ?? obj?.track_id;
    if (rawTrackId === undefined || rawTrackId === null) return false;
    const rawOverrides = manualOverridesByTrack.get(String(rawTrackId)) || [];
    return rawOverrides.length > 0 && !getManualOverrideForObject(obj);
  }, [getManualOverrideForObject, manualOverridesByTrack]);

  const objectEvidenceLayers = React.useMemo(() => {
    const providers = new Map<string, number>();
    const runs = new Map<string, { provider: string; count: number }>();
    for (const obj of groupedObjects) {
      if (obj.sourceType === "manual_visual") continue;
      const provider = String(obj.detectorProvider || "legacy provider");
      providers.set(provider, (providers.get(provider) || 0) + 1);
      if (obj.detectorRunId) {
        const key = String(obj.detectorRunId);
        const prior = runs.get(key);
        runs.set(key, { provider, count: (prior?.count || 0) + 1 });
      }
    }
    return {
      providers: [...providers.entries()].sort((left, right) => left[0].localeCompare(right[0])),
      runs: [...runs.entries()].sort((left, right) => left[0].localeCompare(right[0])),
    };
  }, [groupedObjects]);

  const visibleGroupedObjects = React.useMemo(() => groupedObjects.filter((obj: any) => {
    if (obj.sourceType === "manual_visual" || getManualOverrideForObject(obj)) return true;
    if (objectEvidenceLayerFilter === "all") return true;
    if (objectEvidenceLayerFilter.startsWith("provider:")) {
      return String(obj.detectorProvider || "legacy provider") === objectEvidenceLayerFilter.slice("provider:".length);
    }
    if (objectEvidenceLayerFilter.startsWith("run:")) {
      return String(obj.detectorRunId || "") === objectEvidenceLayerFilter.slice("run:".length);
    }
    return true;
  }), [getManualOverrideForObject, groupedObjects, objectEvidenceLayerFilter]);

  const getLatestObjectLabel = React.useCallback(
    (obj: any): string => {
      const manualOverride = getManualOverrideForObject(obj);
      return manualOverride
        ? resolveManualVisualDisplayLabel(manualOverride)
        : String(obj.displayLabel || obj.class_name || "Object present");
    },
    [getManualOverrideForObject],
  );

  const promotedUnmatchedObjects = React.useMemo(
    () => untrackedRawObjectCandidates.filter((obj: any) => Boolean(getManualOverrideForObject(obj))),
    [getManualOverrideForObject, untrackedRawObjectCandidates],
  );
  const objectClusterMembers = React.useMemo<ObjectClusterMember[]>(() =>
    [...visibleGroupedObjects, ...promotedUnmatchedObjects].flatMap((obj: any, index: number) => {
      const detectorLabel = String(obj.raw_class_name || obj.class_name || "").trim().toLowerCase();
      if (detectorLabel === "person" || detectorLabel.startsWith("person ")) return [];
      const key = objectRowKey(obj, index);
      const sourceFamily = String(obj.raw_class_name || obj.class_name || obj.displayLabel || "Unclassified object").trim();
      const family = stagedObjectFamilies[key]
        || (hasAmbiguousLegacyTrackCollision(obj) ? "Undetermined" : getLatestObjectLabel(obj))
        || sourceFamily;
      const start = Number(obj.startTimestamp ?? obj.timestamp ?? 0);
      const end = Math.max(start, Number(obj.endTimestamp ?? obj.timestamp ?? start));
      return [{
        key,
        evidenceId: getObjectEvidenceId(obj, index),
        object: obj,
        family,
        sourceFamily,
        trackId: getObjectTrackId(obj) || key,
        start,
        end,
        quality: Math.max(0, Math.min(1, Number(obj.confidence ?? 0))),
        confirmed: Boolean(getManualOverrideForObject(obj)),
      }];
    }),
  [getLatestObjectLabel, getManualOverrideForObject, hasAmbiguousLegacyTrackCollision, visibleGroupedObjects, promotedUnmatchedObjects, stagedObjectFamilies]);

  const unmatchedObjectClusterMembers = React.useMemo<ObjectClusterMember[]>(() =>
    untrackedRawObjectCandidates.flatMap((obj: any, index: number) => {
      if (getManualOverrideForObject(obj)) return [];
      const detectorLabel = String(obj.raw_class_name || obj.class_name || "").trim().toLowerCase();
      if (detectorLabel === "person" || detectorLabel.startsWith("person ")) return [];
      const evidenceId = getObjectEvidenceId(obj, index);
      const start = Number(obj.startTimestamp ?? obj.timestamp ?? 0);
      const end = Math.max(start, Number(obj.endTimestamp ?? obj.timestamp ?? start));
      const sourceFamily = String(obj.raw_class_name || obj.class_name || obj.displayLabel || "Unclassified object").trim();
      return [{
        key: `unmatched:${evidenceId}`,
        evidenceId,
        object: obj,
        family: "Undetermined",
        sourceFamily,
        trackId: getObjectTrackId(obj) || `raw-${index + 1}`,
        start,
        end,
        quality: Math.max(0, Math.min(1, Number(obj.confidence ?? 0))),
        confirmed: false,
      }];
    }),
  [getManualOverrideForObject, untrackedRawObjectCandidates]);

  const allObjectClusterFamilies = React.useMemo<ObjectClusterFamily[]>(() => {
    const groups = new Map<string, ObjectClusterMember[]>();
    for (const member of objectClusterMembers) {
      groups.set(member.family, [...(groups.get(member.family) || []), member]);
    }
    return Array.from(groups.entries()).map(([name, members]) => {
      const ranked = [...members].sort((left, right) => right.quality - left.quality || left.start - right.start);
      return {
        name,
        members: ranked,
        representative: ranked[0],
        boundary: ranked[ranked.length - 1],
        cohesion: ranked.reduce((sum, member) => sum + member.quality, 0) / Math.max(1, ranked.length),
        temporalStart: Math.min(...ranked.map((member) => member.start)),
        temporalEnd: Math.max(...ranked.map((member) => member.end)),
      };
    }).sort((left, right) => right.members.length - left.members.length || left.name.localeCompare(right.name));
  }, [objectClusterMembers]);

  const objectFamilyRowDisposition = React.useMemo(() => {
    const disposition = new Map<string, "dropped" | "active">();
    for (const decision of analysisData?.annotationCorrections?.proliferation_decisions || []) {
      const governance = decision.governance_status as Record<string, unknown> | undefined;
      if (governance?.schema !== "datascene.object_lineup_row_disposition.v1") continue;
      const family = String(governance.family || decision.candidate_label || "").trim();
      if (!family) continue;
      disposition.set(family, governance.operation === "drop_row" ? "dropped" : "active");
    }
    return disposition;
  }, [analysisData?.annotationCorrections?.proliferation_decisions]);
  const objectClusterFamilies = React.useMemo(
    () => allObjectClusterFamilies.filter((family) => objectFamilyRowDisposition.get(family.name) !== "dropped"),
    [allObjectClusterFamilies, objectFamilyRowDisposition],
  );
  const droppedObjectClusterFamilies = React.useMemo(
    () => allObjectClusterFamilies.filter((family) => objectFamilyRowDisposition.get(family.name) === "dropped"),
    [allObjectClusterFamilies, objectFamilyRowDisposition],
  );
  const governedObjectFamilyNames = React.useMemo(() => {
    const names = new Set<string>();
    for (const annotation of analysisData?.annotationCorrections?.manual_visual_annotations || []) {
      if (annotation.category !== "OBJ") continue;
      const label = resolveManualVisualDisplayLabel(annotation).trim();
      if (label) names.add(label);
    }
    for (const decision of analysisData?.annotationCorrections?.proliferation_decisions || []) {
      const governance = decision.governance_status as Record<string, unknown> | undefined;
      if (decision.decision !== "confirmed" || governance?.schema !== "datascene.governed_object_cluster.v1") continue;
      const label = String(decision.applied_label || governance.target_family || "").trim();
      if (label) names.add(label);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [analysisData?.annotationCorrections]);

  const selectedObjectFamily = objectClusterFamilies.find((family) => family.name === activeObjectFamily) || objectClusterFamilies[0] || null;
  const orderedObjectClusterFamilies = React.useMemo(() => {
    const byName = new Map(objectClusterFamilies.map((family) => [family.name, family]));
    return [
      ...objectFamilyOrder.flatMap((name) => byName.get(name) ? [byName.get(name)!] : []),
      ...objectClusterFamilies.filter((family) => !objectFamilyOrder.includes(family.name)),
    ];
  }, [objectClusterFamilies, objectFamilyOrder]);
  const measuredObjectFamilies = React.useMemo(
    () => new Map((objectAppearanceMeasurement?.families || []).map((family) => [family.key, family])),
    [objectAppearanceMeasurement],
  );
  const measuredObjectMembers = React.useMemo(() => {
    const rows = new Map<string, ObjectAppearanceMeasurementResult["families"][number]["members"][number]>();
    for (const family of objectAppearanceMeasurement?.families || []) {
      for (const member of family.members || []) rows.set(member.evidence_id, member);
    }
    return rows;
  }, [objectAppearanceMeasurement]);
  const selectedMeasuredObjectFamily = selectedObjectFamily
    ? measuredObjectFamilies.get(selectedObjectFamily.name) || null
    : null;
  const objectMemberReviewScore = React.useCallback(
    (member: ObjectClusterMember) => measuredObjectMembers.get(member.key)?.family_cosine_similarity ?? member.quality,
    [measuredObjectMembers],
  );
  const selectedObjectFamilyKeys = selectedObjectFamily
    ? selectedObjectClusterSamples.filter((key) => selectedObjectFamily.members.some((member) => member.key === key))
    : [];
  const objectTimelineEnd = Math.max(1, ...objectClusterMembers.map((member) => member.end));
  const objectReviewContext = React.useMemo(() => {
    const annotations =
      analysisData?.source_media_metadata?.user_annotations ||
      metadata?.source_media_metadata?.user_annotations ||
      metadata?.user_annotations ||
      {};
    return {
      media_genre: String(annotations.genre || "").trim(),
      media_subgenre: String(annotations.genre_subtype || "").trim(),
      situational_genre: String(annotations.situational_genre || "").trim(),
      situational_subgenre: String(annotations.situational_subtype || "").trim(),
      privacy: String(annotations.privacy_axis || "").trim(),
      expertise: String(annotations.expertise_axis || "").trim(),
    };
  }, [analysisData?.source_media_metadata?.user_annotations, metadata]);
  const activeObjectReviewContext = Object.entries(objectReviewContext).filter(([, value]) => value);

  const measureObjectAppearance = async () => {
    if (!videoId || !objectClusterFamilies.length) return;
    setObjectAppearanceBusy(true);
    setObjectActionMessage("Measuring source-linked object appearance across the visible families...");
    try {
      const result = await apiService.measureObjectAppearance(videoId, {
        request_id: `objects-panel-${Date.now()}`,
        model: "Datascene Native Object Appearance v1",
        cosine_similarity_threshold: objectClusterThreshold / 100,
        ambiguity_margin: 0.04,
        sample_count: 5,
        review_context: objectReviewContext,
        families: objectClusterFamilies.map((family) => ({
          key: family.name,
          label: family.name,
          members: family.members.map((member) => ({
            evidence_id: member.key,
            track_id: member.trackId,
            source_time: { start: member.start, end: member.end },
            geometry: { bbox: member.object.bbox },
            raw_detector_family: member.sourceFamily,
          })),
        })),
      });
      setObjectAppearanceMeasurement(result);
      setObjectActionMessage(
        result.status === "completed_measured"
          ? `Measured ${result.measured_member_count || 0}/${result.member_count || 0} object tracks. Similarity remains candidate evidence until analyst confirmation.`
          : result.message || `Object appearance measurement returned ${result.status}.`,
      );
    } catch (error) {
      setObjectActionMessage(`Object appearance measurement failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setObjectAppearanceBusy(false);
    }
  };

  useEffect(() => {
    const handler = (payload: any) => {
      if (!payload || payload.videoId !== videoId) return;
      const source = payload.sourceItem || {};
      const targetTrackId = String(
        source.trackId ??
          source.track_id ??
          source.metadata_correlation?.target_id ??
          "",
      );
      if (!targetTrackId) return;
      const index = groupedObjects.findIndex(
        (item: any) => getObjectTrackId(item) === targetTrackId,
      );
      if (index >= 0) {
        setSelectedObjectKey(objectRowKey(groupedObjects[index], index));
      }
    };
    eventBus.on("videoEvidenceSelected", handler);
    return () => eventBus.off("videoEvidenceSelected", handler);
  }, [groupedObjects, videoId]);

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

  const resolveObjectDraftWithTimeInputs = (
    rowKey: string,
    draft: ObjectIndicationDraft,
  ): ObjectIndicationDraft => {
    const startDraft = objectTimeInputDrafts[`${rowKey}:start`];
    const endDraft = objectTimeInputDrafts[`${rowKey}:end`];
    const parsedStart =
      startDraft !== undefined ? parsePreciseTimeInput(startDraft) : null;
    const parsedEnd =
      endDraft !== undefined ? parsePreciseTimeInput(endDraft) : null;
    const start = Math.max(0, parsedStart ?? draft.start);
    const end = Math.max(parsedEnd ?? draft.end, start + 0.001);
    return { ...draft, start, end };
  };

  const clearObjectTimeInputDrafts = (rowKey: string) => {
    setObjectTimeInputDrafts((current) => {
      const startKey = `${rowKey}:start`;
      const endKey = `${rowKey}:end`;
      if (current[startKey] === undefined && current[endKey] === undefined) {
        return current;
      }
      const next = { ...current };
      delete next[startKey];
      delete next[endKey];
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
      return false;
    }
    const latestLabel = getLatestObjectLabel(obj);
    const draft =
      objectDrafts[key] ||
      buildObjectIndicationDraft(obj, latestLabel, getManualOverrideForObject(obj));
    const resolvedDraft = resolveObjectDraftWithTimeInputs(key, draft);
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
    const coordinates = detectedObjectToNormalizedBox(obj, width, height);
    if (!coordinates) {
      setObjectActionMessage("Could not save indication: object has no usable box.");
      return false;
    }
    const start = Number(resolvedDraft.start || obj.startTimestamp || obj.timestamp || 0);
    const end = Math.max(Number(resolvedDraft.end || start), start + 0.001);
    const label = resolvedDraft.label.trim() || latestLabel || obj.displayLabel || obj.class_name || "Object present";
    const existingManual = getManualOverrideForObject(obj);
    const targetId = String(obj.trackId ?? key);
    const governedBox = normalizeDraftBox(coordinates);
    const updatedAt = new Date().toISOString();
    const annotationId =
      existingManual?.id ||
      `${videoId}:object-indication:${targetId}:${Number(start).toFixed(3)}-${Number(end).toFixed(3)}:${manualAnnotationBBoxFingerprint(governedBox)}`;
    const annotation = buildManualBBoxRoiAnnotation({
      analysisId: videoId,
      annotationId,
      existingManual,
      category: resolvedDraft.category,
      subcategory: resolvedDraft.subcategory || firstSubcategory(resolvedDraft.category),
      label,
      customLabel: resolvedDraft.label.trim() || undefined,
      box: governedBox,
      start,
      end,
      anchorTime: start,
      targetType: "object",
      targetId,
      targetLabel: existingManual?.metadata_correlation?.target_label || getObjectSourceLabel(obj),
      applyScope: "this_interval_only",
      identityAffirmation:
        resolvedDraft.category === "Identification" ? label : undefined,
      roleAffirmation: resolvedDraft.category === "Role" ? label : undefined,
      openNote: resolvedDraft.note.trim() || undefined,
      supersedes: [targetId],
      sourceNote: "Adopted from Objects leaf panel indication editor.",
      updatedAt,
    });

    const existingCorrections = analysisData?.annotationCorrections;
    const nextCorrections = upsertManualVisualAnnotation(
      existingCorrections,
      annotation,
    );
    let refreshed;
    try {
      const savedCorrections = await VideoService.saveAnnotationCorrections(
        videoId,
        nextCorrections,
      );
      requireSavedManualVisualAnnotation(
        savedCorrections,
        annotation.id,
        "Objects BBox/ROI indication",
      );
      applySavedAnnotationCorrections(savedCorrections);
      refreshed = await VideoService.refreshAnalysis(videoId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setObjectActionMessage(`Could not save indication: ${message}`);
      return;
    }
    setAnalysisData(refreshed);
    clearObjectTimeInputDrafts(key);
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

  const persistObjectFamilyRowDisposition = async (
    family: ObjectClusterFamily,
    operation: "drop_row" | "restore_row",
  ) => {
    if (!videoId) return;
    const now = new Date().toISOString();
    const decisionId = `${videoId}:object-lineup-row:${operation}:${Date.now()}`;
    const decision: ProliferationDecision = {
      decision_id: decisionId,
      candidate_id: `object-family-row:${family.name}`,
      decision_scope: "cluster",
      cluster_key: `object-family:${family.name}`,
      decision: operation === "drop_row" ? "canceled" : "inspected",
      authority_level: "explicit_user_confirmation",
      candidate_label: family.name,
      applied_label: family.name,
      source_panel: "Objects",
      source_verification_status: "source_time_resolved",
      source_range_source: "evidence_ref",
      source_anchors: family.members.map((member) => ({ source_ref: `object-track:${member.trackId}`, source_time: { start: member.start, end: member.end }, source_panel: "Objects" })),
      evidence_refs: family.members.map((member) => ({ id: member.key, track_id: member.trackId, raw_detector_family: member.sourceFamily })),
      source_traceback_refs: family.members.map((member) => `object-track:${member.trackId}`),
      projection_targets: ["Objects", "TracebackDrawer"],
      proliferates_to: [],
      governance_status: {
        schema: "datascene.object_lineup_row_disposition.v1",
        operation,
        family: family.name,
        member_track_ids: family.members.map((member) => member.trackId),
        raw_evidence_preserved: true,
        mature_claims_preserved: true,
        semantic_effect: "lineup_projection_only",
        reversible: true,
      },
      proliferation_allowed: false,
      decision_reason: operation === "drop_row"
        ? "Analyst dropped a redundant legacy lineup row after consolidation; raw detections, confirmations and lineage remain in traceback."
        : "Analyst restored a previously dropped object lineup row for review.",
      created_at: now,
      created_by: "analyst",
    };
    const current: AnnotationCorrections = analysisData?.annotationCorrections || createEmptyCorrections();
    const next: AnnotationCorrections = {
      ...current,
      version: 1,
      updated_at: now,
      updated_by: "analyst",
      proliferation_decisions: [...(current.proliferation_decisions || []), decision],
    };
    setObjectClusterBusy(true);
    setObjectActionMessage(`${operation === "drop_row" ? "Dropping" : "Restoring"} ${family.name} lineup row...`);
    try {
      const saved = await VideoService.saveAnnotationCorrections(videoId, next, {
        before: current,
      });
      applySavedAnnotationCorrections(saved);
      setEditingObjectFamily("");
      setActiveObjectFamily("");
      setObjectActionMessage(operation === "drop_row"
        ? `${family.name} removed from the active lineup. Its detections and mature history remain in Traceback and can be restored below.`
        : `${family.name} restored to the active object lineup.`);
      broadcastAnalysisCorrectionRefresh(videoId);
    } catch (error) {
      setObjectActionMessage(`Object lineup row ${operation === "drop_row" ? "drop" : "restore"} failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setObjectClusterBusy(false);
    }
  };

  const persistObjectClusterOperation = async ({
    action,
    memberKeys,
    targetFamily,
    sourceFamilies,
  }: {
    action: "confirm" | "reassign" | "merge" | "split";
    memberKeys: string[];
    targetFamily: string;
    sourceFamilies: string[];
  }) => {
    const requestedFamily = targetFamily.trim();
    const appliedFamily = action === "merge"
      ? governedObjectFamilyNames.find(
          (family) => family.toLocaleLowerCase() === requestedFamily.toLocaleLowerCase(),
        ) || requestedFamily
      : requestedFamily;
    if (!videoId || !appliedFamily || memberKeys.length === 0) {
      setObjectActionMessage("Object-family operation needs a target family and at least one selected source sample.");
      return;
    }
    if (action === "confirm" && appliedFamily.toLocaleLowerCase() === "undetermined") {
      setObjectActionMessage("Confirmation blocked: Undetermined is a review queue, not a semantic object family. Name or move the selected artefacts first.");
      return false;
    }
    if (action === "merge" && !governedObjectFamilyNames.includes(appliedFamily)) {
      setObjectActionMessage("Merge blocked: choose a governed confirmed family from the merge target list.");
      return;
    }
    if (action === "split") {
      const sourceFamily = objectClusterFamilies.find((family) => family.name === sourceFamilies[0]);
      if (!sourceFamily || memberKeys.length >= sourceFamily.members.length) {
        setObjectActionMessage("Split blocked: select a proper subset of one source family.");
        return false;
      }
    }
    const members = [...objectClusterMembers, ...unmatchedObjectClusterMembers]
      .filter((member) => memberKeys.includes(member.key));
    const width = Number(metadata?.width ?? metadata?.source_media_metadata?.width ?? analysisData?.source_media_metadata?.width ?? analysisData?.metadata?.width ?? 0);
    const height = Number(metadata?.height ?? metadata?.source_media_metadata?.height ?? analysisData?.source_media_metadata?.height ?? analysisData?.metadata?.height ?? 0);
    const prepared = members.flatMap((member) => {
      const box = detectedObjectToNormalizedBox(member.object, width, height);
      return box ? [{ member, box: normalizeDraftBox(box) }] : [];
    });
    if (!prepared.length) {
      setObjectActionMessage("Object-family operation blocked: selected samples have no usable source BBox.");
      return;
    }
    setObjectClusterBusy(true);
    const now = new Date().toISOString();
    const lineageId = `${videoId}:object-cluster-lineage:${action}:${Date.now()}`;
    const targetWasExistingFamily = governedObjectFamilyNames.some(
      (family) => family.trim().toLocaleLowerCase() === appliedFamily.toLocaleLowerCase(),
    ) || objectClusterFamilies.some(
      (family) => family.name.trim().toLocaleLowerCase() === appliedFamily.toLocaleLowerCase(),
    );
    const taxonomyTermState = targetWasExistingFamily
      ? "existing_analysis_family"
      : "analyst_proposed_local_term";
    let nextCorrections: AnnotationCorrections = analysisData?.annotationCorrections || createEmptyCorrections();
    const savedAnnotationIds: string[] = [];
    for (const { member, box } of prepared) {
      const existingManual = getManualOverrideForObject(member.object);
      const annotationId = existingManual?.id || `${videoId}:object-cluster-evidence:${encodeURIComponent(member.evidenceId)}`;
      const annotation = buildManualBBoxRoiAnnotation({
        analysisId: videoId,
        annotationId,
        existingManual,
        category: "OBJ",
        subcategory: "Object label",
        label: appliedFamily,
        customLabel: appliedFamily,
        box,
        start: member.start,
        end: Math.max(member.end, member.start + 0.001),
        anchorTime: member.start,
        targetType: "object",
        targetId: member.evidenceId,
        targetLabel: member.sourceFamily,
        applyScope: "track_family",
        quickAnnotations: [
          `object_cluster_family:${appliedFamily}`,
          `object_cluster_lineage:${lineageId}`,
          `object_cluster_operation:${action}`,
          ...sourceFamilies.map((family) => `object_cluster_source_family:${family}`),
        ],
        supersedes: [member.evidenceId, member.trackId, ...(existingManual ? [existingManual.id] : [])],
        authorityState: "explicit_user_confirmation",
        relation: action === "confirm" ? "extends" : "contradicts",
        metadataPatch: {
          object_cluster_schema: "datascene.governed_object_cluster.v1",
          object_cluster_family: appliedFamily,
          object_cluster_lineage_id: lineageId,
          object_cluster_operation: action,
          object_cluster_source_families: sourceFamilies,
          detector_label_retained_as_provenance: member.sourceFamily,
          taxonomy_term_state: taxonomyTermState,
          ontology_effect: "none_until_separate_taxonomy_or_relation_governance",
          genre_situation_effect: "review_context_only",
        },
        confirmationActiveState: {
          maturity: "mature",
          semantic_object_family: appliedFamily,
          object_cluster_lineage_id: lineageId,
        },
        confirmationEventId: `${lineageId}:${encodeURIComponent(member.evidenceId)}`,
        sourceNote: `Governed Objects cluster ${action}; raw detector class retained as provenance.`,
        updatedAt: now,
      });
      nextCorrections = upsertManualVisualAnnotation(nextCorrections, annotation);
      savedAnnotationIds.push(annotation.id);
    }
    const lineageDecision: ProliferationDecision = {
      decision_id: lineageId,
      candidate_id: `object-cluster:${appliedFamily}`,
      decision_scope: "cluster",
      cluster_key: `object-family:${appliedFamily}`,
      decision: "confirmed",
      authority_level: "explicit_user_confirmation",
      candidate_label: appliedFamily,
      applied_label: appliedFamily,
      source_panel: "Objects",
      source_verification_status: "source_time_resolved",
      source_range_source: "evidence_ref",
      source_anchors: prepared.map(({ member }) => ({
        source_ref: `object-evidence:${member.evidenceId}`,
        source_time: { start: member.start, end: member.end },
        source_panel: "Objects",
      })),
      evidence_refs: prepared.map(({ member }) => ({
        id: member.evidenceId,
        track_id: member.trackId,
        raw_detector_family: member.sourceFamily,
      })),
      source_traceback_refs: prepared.map(({ member }) => `object-evidence:${member.evidenceId}`),
      projection_targets: ["MasterSchema", "Objects", "VideoPanel", "SceneCards", "MeaningNetwork", "Search", "TracebackDrawer", "DataBook", "ScientificReport", "Export"],
      proliferates_to: ["master_schema", "objects", "video", "scene_cards", "meaning_network", "search", "traceback", "data_book", "scientific_report", "export"],
      governance_status: {
        schema: "datascene.governed_object_cluster.v1",
        maturity: "mature",
        operation: action,
        lineage_id: lineageId,
        source_families: sourceFamilies,
        target_family: appliedFamily,
        member_track_ids: prepared.map(({ member }) => member.trackId),
        member_evidence_ids: prepared.map(({ member }) => member.evidenceId),
        raw_detector_classes_are_provenance_only: true,
        taxonomy_term_state: taxonomyTermState,
        semantic_scope: "object_family",
        ontology_effect: "none_until_separate_taxonomy_or_relation_governance",
        genre_situation_effect: "review_context_only",
        review_context: objectReviewContext,
      },
      proliferation_allowed: true,
      decision_reason: `Analyst confirmed governed object-family ${action}; one confirmation matures every selected source-linked member.`,
      created_at: now,
      created_by: "analyst",
    };
    nextCorrections = {
      ...nextCorrections,
      version: 1,
      updated_at: now,
      updated_by: "analyst",
      proliferation_decisions: [
        ...(nextCorrections.proliferation_decisions || []).filter((decision) => decision.decision_id !== lineageId),
        lineageDecision,
      ],
    };
    const previousCorrections = analysisData?.annotationCorrections || createEmptyCorrections();
    // Table management must feel immediate. Install the exact prospective
    // canonical bundle locally while the durable sidecar performs its bounded
    // write/readback. A failed receipt rolls this projection back below.
    applySavedAnnotationCorrections(nextCorrections);
    setStagedObjectFamilies((current) => {
      const next = { ...current };
      memberKeys.forEach((key) => delete next[key]);
      return next;
    });
      setSelectedObjectClusterSamples([]);
      setSelectedUnmatchedObjectKeys([]);
      setNewObjectFamilyTitle("");
    setActiveObjectFamily(appliedFamily);
    setObjectFamilyDraft("");
    setEditingObjectFamily("");
    setObjectActionMessage(`Saving ${action} for ${prepared.length} object track${prepared.length === 1 ? "" : "s"}…`);
    try {
      const saved = await VideoService.saveAnnotationCorrections(videoId, nextCorrections, {
        before: previousCorrections,
      });
      for (const annotationId of savedAnnotationIds) {
        const savedAnnotation = requireSavedManualVisualAnnotation(saved, annotationId, "Objects cluster operation");
        if (resolveManualVisualDisplayLabel(savedAnnotation) !== appliedFamily) {
          throw new Error(`Objects cluster readback label mismatch for ${annotationId}`);
        }
        const expectedMember = prepared.find(({ member }) => (
          `${videoId}:object-cluster-evidence:${encodeURIComponent(member.evidenceId)}` === annotationId ||
          getManualOverrideForObject(member.object)?.id === annotationId
        ));
        if (expectedMember && String(savedAnnotation.metadata_correlation?.target_id || "") !== expectedMember.member.evidenceId) {
          throw new Error(`Objects cluster readback evidence mismatch for ${annotationId}`);
        }
      }
      applySavedAnnotationCorrections(saved);
      setObjectActionMessage(`${prepared.length} object track${prepared.length === 1 ? "" : "s"} confirmed as ${appliedFamily}. Master Schema proliferation recorded.`);
      broadcastAnalysisCorrectionRefresh(videoId);
      return true;
    } catch (error) {
      applySavedAnnotationCorrections(previousCorrections);
      setEditingObjectFamily(sourceFamilies[0] || "");
      setObjectFamilyTitleDraft(appliedFamily);
      setObjectActionMessage(`Object-family ${action} failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setObjectClusterBusy(false);
    }
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
    const savedCorrections = await VideoService.saveAnnotationCorrections(
      videoId,
      nextCorrections,
    );
    applySavedAnnotationCorrections(savedCorrections);
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
    const savedCorrections = await VideoService.saveAnnotationCorrections(
      videoId,
      nextCorrections,
    );
    applySavedAnnotationCorrections(savedCorrections);
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
    const savedCorrections = await VideoService.saveAnnotationCorrections(
      videoId,
      nextCorrections,
    );
    applySavedAnnotationCorrections(savedCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const undoLastCorrection = async () => {
    if (!videoId) return;
    const snapshot = peekCorrectionSnapshot(videoId);
    if (!snapshot) return;
    try {
      const request = prepareCorrectionUndo(snapshot.corrections, analysisData?.annotationCorrections);
      const saved = await VideoService.saveAnnotationCorrections(videoId, request);
      if (!correctionUndoVerified(snapshot.corrections, saved)) throw new Error("Undo could not be verified. History is retained.");
      acknowledgeCorrectionSnapshot(videoId, snapshot.token);
      if (eventBus.getLast<string>("videoIdChanged") !== videoId) return;
      applySavedAnnotationCorrections(saved);
      const refreshed = await VideoService.refreshAnalysis(videoId);
      if (eventBus.getLast<string>("videoIdChanged") !== videoId) return;
      setAnalysisData(refreshed);
      broadcastAnalysisCorrectionRefresh(videoId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Undo failed; history is retained.");
    }
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
            <DynamicPanelSection
              sectionId="body-movement-evidence"
              title="Body movement evidence"
              summary={`${bodyMovementDetections.length} source-linked attributes`}
              defaultOpen={bodyMovementDetections.length > 0}
            >
              <div className="max-h-[55vh] space-y-1 overflow-y-auto p-2 group-data-[vaa1-section-filled=true]:max-h-none">
                {bodyMovementDetections.length ? bodyMovementDetections.map((movement: BodyMovementDetection) => (
                  <button
                    key={movement.evidenceId}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1 text-left text-[10px] hover:border-cyan-700"
                    onClick={() => {
                      if (videoId) openVideoAtTime(videoId, movement.start);
                      eventBus.emit("videoEvidenceSelected", {
                        videoId,
                        panelType: "VideoPanel",
                        modality: "object",
                        timestamp: movement.start,
                        label: movement.movementType,
                        sourceItem: {
                          sourceType: "behavioral_detection",
                          sourceAnnotationId: movement.evidenceId,
                          ...movement,
                        },
                      });
                    }}
                    data-vaa1-movement-saloon-door="true"
                  >
                    <span className="min-w-0 truncate text-slate-200">
                      {movement.narrativeAgentLabel ? `${movement.narrativeAgentLabel} · ` : ""}{movement.movementType}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {formatPreciseTime(movement.start)} · {movement.maturity === "candidate_only" ? "candidate" : "confirmed"}
                    </span>
                  </button>
                )) : <div className="text-[10px] text-slate-600">No source-timed body movement evidence</div>}
              </div>
            </DynamicPanelSection>
            <details open className="mb-2 shrink-0 rounded border border-cyan-900/50 bg-cyan-950/10" data-vaa1-object-cluster-workbench="true">
              <summary className="cursor-pointer list-none px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-cyan-200 marker:hidden">
                Object-family cluster exploration · {objectClusterFamilies.length} families · {objectClusterMembers.length} tracks
              </summary>
              <div className="max-h-[58vh] overflow-auto border-t border-cyan-900/30 p-2">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2 text-[10px] text-slate-400">
                  <span>Semantic object families are reviewed here. Raw detector classes remain traceback provenance. Person tracks remain governed in Narrative Agent.</span>
                  <div className="flex flex-wrap items-center gap-1">
                    <select aria-label="Object evidence provider or run" value={objectEvidenceLayerFilter} onChange={(event) => setObjectEvidenceLayerFilter(event.target.value)} className="rounded border border-white/10 bg-[#171717] px-2 py-1 text-[9px] text-slate-300" data-vaa1-object-provider-run-filter="true">
                      <option value="all">All active detector runs</option>
                      {objectEvidenceLayers.providers.map(([provider, count]) => <option key={`provider-${provider}`} value={`provider:${provider}`}>{provider} · {count} tracks</option>)}
                      {objectEvidenceLayers.runs.map(([runId, details]) => <option key={runId} value={`run:${runId}`}>{details.provider} · run {runId.replace("object-run:", "")} · {details.count}</option>)}
                    </select>
                    <button type="button" disabled={objectAppearanceBusy || !objectClusterMembers.length} className="rounded border border-cyan-800/70 bg-cyan-950/30 px-2 py-1 text-[9px] text-cyan-100 disabled:opacity-40" onClick={() => void measureObjectAppearance()} data-vaa1-object-appearance-measure="native-v1">
                      {objectAppearanceBusy ? "Measuring…" : objectAppearanceMeasurement?.status === "completed_measured" ? "Remeasure appearance" : "Measure appearance"}
                    </button>
                  </div>
                </div>
                <div className="mb-2 text-[9px] text-slate-500" data-vaa1-object-mature-filter-immunity="true">Confirmed Master Schema objects remain visible under every detector filter. Filtering changes the raw evidence view, never maturity.</div>
                {objectAppearanceMeasurement ? <div className="mb-2 rounded border border-white/8 bg-black/20 px-2 py-1.5 text-[9px] text-slate-400" data-vaa1-object-appearance-status={objectAppearanceMeasurement.status}>
                  <span className={objectAppearanceMeasurement.status === "completed_measured" ? "text-emerald-300" : "text-amber-300"}>{objectAppearanceMeasurement.model?.name || "Object appearance motor"} · {objectAppearanceMeasurement.status.replaceAll("_", " ")}</span>
                  {" · "}{objectAppearanceMeasurement.measured_member_count || 0}/{objectAppearanceMeasurement.member_count || 0} tracks measured · vectors {objectAppearanceMeasurement.embedding_storage?.export_default || "withheld"} from export · scores are not probabilities
                </div> : null}
                <div className="mb-2 rounded border border-violet-900/35 bg-violet-950/10 px-2 py-1.5 text-[9px] text-slate-400" data-vaa1-object-context-boundary="review-only">
                  <div className="text-violet-200">Genre and situation are review context—not object labels or ontology truth.</div>
                  <div className="mt-0.5">
                    {activeObjectReviewContext.length
                      ? activeObjectReviewContext.map(([axis, value]) => `${axis.replaceAll("_", " ")}: ${value}`).join(" · ")
                      : "No governed genre or situational axes are active for this source."}
                  </div>
                  <div className="mt-0.5 text-slate-500">Context may prioritize review or justify an analyst-requested specialist sweep. It never changes appearance similarity, confirms a semantic family, or creates an object–genre/object–situation relation.</div>
                </div>
                {objectClusterFamilies.length ? <>
                  {selectedObjectFamily ? <div className="sticky top-0 z-20 mb-2 rounded border border-cyan-700/60 bg-[#10181b]/95 p-2 shadow-lg backdrop-blur" data-vaa1-object-cluster-adjustment-bench="true" data-vaa1-object-bench-position="before-family-catalogue">
                    <div className="grid gap-2 md:grid-cols-4">
                      <div><div className="text-[8px] uppercase text-slate-500">Active family</div><div className="truncate text-[11px] text-cyan-100">{selectedObjectFamily.name}</div></div>
                      <div><div className="text-[8px] uppercase text-slate-500">Coverage</div><div className="text-[11px] text-slate-200">{formatPreciseTime(selectedObjectFamily.temporalStart)}–{formatPreciseTime(selectedObjectFamily.temporalEnd)}</div></div>
                      <div><div className="text-[8px] uppercase text-slate-500">Purity evidence</div><div className="text-[11px] text-slate-200">{selectedMeasuredObjectFamily?.cohesion != null ? `${Math.round(selectedMeasuredObjectFamily.cohesion * 100)}% measured cohesion` : `${Math.round(selectedObjectFamily.cohesion * 100)}% detector-confidence proxy`}</div></div>
                      <div><div className="text-[8px] uppercase text-slate-500">Nearest competitor</div><div className="text-[11px] text-slate-400">{selectedMeasuredObjectFamily?.nearest_competing_family_label ? `${selectedMeasuredObjectFamily.nearest_competing_family_label} · ${Math.round((selectedMeasuredObjectFamily.nearest_competing_similarity || 0) * 100)}% similarity` : objectAppearanceMeasurement ? "no measured competitor" : "measure appearance to compare"}</div></div>
                    </div>
                    <div className="mt-2" data-vaa1-object-cluster-temporal-distribution="true"><div className="relative h-5 rounded border border-white/8 bg-black/30">{selectedObjectFamily.members.map((member) => <button key={`object-time-${member.key}`} type="button" title={`Open track ${member.trackId} at ${formatPreciseTime(member.start)}`} aria-label={`Open track ${member.trackId} at ${formatPreciseTime(member.start)} in source`} className={`absolute top-1 h-3 min-w-[5px] rounded ${selectedObjectClusterSamples.includes(member.key) ? "bg-cyan-300" : "bg-cyan-800"}`} style={{ left: `${Math.min(99, (member.start / objectTimelineEnd) * 100)}%`, width: `${Math.max(0.5, ((member.end - member.start) / objectTimelineEnd) * 100)}%` }} onClick={() => activateObjectInVideo(member.object, member.key)} />)}</div></div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-400" data-vaa1-object-threshold-preview="non-writing"><span>{objectAppearanceMeasurement ? "Cosine-similarity" : "Detector-confidence proxy"} threshold preview · {objectClusterThreshold}% · {selectedObjectFamily.members.filter((member) => objectMemberReviewScore(member) * 100 >= objectClusterThreshold).length} included / {selectedObjectFamily.members.filter((member) => objectMemberReviewScore(member) * 100 < objectClusterThreshold).length} excluded</span><span>Preview never writes</span></div>
                    <input aria-label="Object cluster threshold preview" type="range" min="0" max="100" value={objectClusterThreshold} onChange={(event) => setObjectClusterThreshold(Number(event.target.value))} className="mt-1 w-full accent-cyan-600" />
                    <div className="mt-2 grid gap-2 md:grid-cols-[minmax(180px,1fr)_auto]">
                      <div><input list="object-family-choices" value={objectFamilyDraft} onChange={(event) => setObjectFamilyDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && selectedObjectClusterSamples.length && objectFamilyDraft.trim() && !objectClusterBusy) { event.preventDefault(); void persistObjectClusterOperation({ action: "reassign", memberKeys: selectedObjectClusterSamples, targetFamily: objectFamilyDraft, sourceFamilies: [...new Set(objectClusterMembers.filter((member) => selectedObjectClusterSamples.includes(member.key)).map((member) => member.family))] }); } }} placeholder={selectedObjectFamily.name === "Undetermined" ? "Name selected artefacts to create a row" : "Target or new semantic object family"} className="w-full rounded border border-white/10 bg-[#171717] px-2 py-1.5 text-[10px] text-slate-200" /><datalist id="object-family-choices">{objectClusterFamilies.filter((family) => family.name !== "Undetermined").map((family) => <option key={family.name} value={family.name} />)}</datalist></div>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className="rounded border border-white/10 px-2 py-1 text-[9px] text-slate-300" onClick={() => setSelectedObjectClusterSamples(selectedObjectFamily.members.filter((member) => objectMemberReviewScore(member) * 100 >= objectClusterThreshold).map((member) => member.key))}>Select included</button>
                        <button type="button" disabled={objectClusterBusy || selectedObjectFamily.name === "Undetermined"} title={selectedObjectFamily.name === "Undetermined" ? "Undetermined is a review queue; name or move its artefacts instead" : undefined} className="rounded border border-emerald-900/70 bg-emerald-950/20 px-2 py-1 text-[9px] text-emerald-200 disabled:opacity-40" onClick={() => void persistObjectClusterOperation({ action: "confirm", memberKeys: selectedObjectFamilyKeys.length ? selectedObjectFamilyKeys : selectedObjectFamily.members.map((member) => member.key), targetFamily: selectedObjectFamily.name, sourceFamilies: [selectedObjectFamily.name] })}>{selectedObjectFamily.name === "Undetermined" ? "Name selected first" : selectedObjectFamilyKeys.length ? `Confirm selected (${selectedObjectFamilyKeys.length})` : "Confirm family"}</button>
                        <button type="button" disabled={objectClusterBusy || !selectedObjectClusterSamples.length || !objectFamilyDraft.trim()} className="rounded border border-cyan-700 bg-cyan-950/25 px-2 py-1 text-[9px] font-medium text-cyan-100 disabled:opacity-40" onClick={() => void persistObjectClusterOperation({ action: "reassign", memberKeys: selectedObjectClusterSamples, targetFamily: objectFamilyDraft, sourceFamilies: [...new Set(objectClusterMembers.filter((member) => selectedObjectClusterSamples.includes(member.key)).map((member) => member.family))] })}>{selectedObjectFamily.name === "Undetermined" && !governedObjectFamilyNames.includes(objectFamilyDraft.trim()) ? `Create row from selected (${selectedObjectClusterSamples.length})` : `Move selected (${selectedObjectClusterSamples.length})`}</button>
                        <button type="button" disabled={objectClusterBusy || !selectedObjectFamilyKeys.length || !objectFamilyDraft.trim() || selectedObjectFamilyKeys.length >= selectedObjectFamily.members.length} className="rounded border border-violet-900/70 px-2 py-1 text-[9px] text-violet-200 disabled:opacity-40" onClick={() => void persistObjectClusterOperation({ action: "split", memberKeys: selectedObjectFamilyKeys, targetFamily: objectFamilyDraft, sourceFamilies: [selectedObjectFamily.name] })}>Split selected</button>
                        <button type="button" disabled={objectClusterBusy || !objectFamilyDraft.trim() || objectFamilyDraft.trim() === selectedObjectFamily.name || !objectClusterFamilies.some((family) => family.name === objectFamilyDraft.trim())} className="rounded border border-amber-900/70 px-2 py-1 text-[9px] text-amber-200 disabled:opacity-40" onClick={() => void persistObjectClusterOperation({ action: "merge", memberKeys: selectedObjectFamily.members.map((member) => member.key), targetFamily: objectFamilyDraft, sourceFamilies: [selectedObjectFamily.name, objectFamilyDraft] })}>Merge family</button>
                      </div>
                    </div>
                    {objectActionMessage ? <div role="status" aria-live="assertive" className={`mt-2 rounded border px-2 py-1 text-[10px] ${/failed|blocked/i.test(objectActionMessage) ? "border-red-700/80 bg-red-950/35 text-red-100" : /saving/i.test(objectActionMessage) ? "border-amber-600/80 bg-amber-950/30 text-amber-100" : "border-emerald-700/70 bg-emerald-950/25 text-emerald-100"}`}>{objectActionMessage}</div> : null}
                    <div className="mt-2 text-[9px] text-slate-500">Select review thumbnails below. Each crop carries its exact source time. As in the Narrative Agent lineup, dropping an artefact onto another family row confirms the governed reassignment immediately.</div>
                  </div> : null}
                  <div className="space-y-2" data-vaa1-object-family-lineups="true" data-vaa1-object-lineup-volume-layout="wrapping-grid">
                    {orderedObjectClusterFamilies.map((family) => {
                      const active = selectedObjectFamily?.name === family.name;
                      const rowCollapsed = Boolean(collapsedObjectFamilyRows[family.name]);
                      const fullyMature = family.members.length > 0 && family.members.every((member) => member.confirmed);
                      const measuredFamily = measuredObjectFamilies.get(family.name);
                      const detectorProviders = [...new Set(family.members.map((member) => String(member.object.detectorProvider || "legacy provider")))];
                      const included = family.members.filter((member) => objectMemberReviewScore(member) * 100 >= objectClusterThreshold);
                      return <section
                        key={family.name}
                        className={`rounded border px-2 py-2 transition-colors ${fullyMature ? "border-emerald-700/70 bg-emerald-950/15" : active ? "border-cyan-500/70 bg-cyan-950/20" : "border-white/10 bg-[#111]"}`}
                        data-vaa1-object-family={family.name}
                        onClick={() => setActiveObjectFamily(family.name)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const rowPayload = event.dataTransfer.getData("application/x-datascene-object-lineup-row");
                          if (rowPayload && rowPayload !== family.name) {
                            const currentOrder = orderedObjectClusterFamilies.map((item) => item.name);
                            const sourceIndex = currentOrder.indexOf(rowPayload);
                            const targetIndex = currentOrder.indexOf(family.name);
                            if (sourceIndex >= 0 && targetIndex >= 0) {
                              currentOrder.splice(sourceIndex, 1);
                              currentOrder.splice(targetIndex, 0, rowPayload);
                              setObjectFamilyOrder(currentOrder);
                              setObjectActionMessage("Object lineup order updated for this workspace.");
                            }
                            return;
                          }
                          const key = event.dataTransfer.getData("application/x-datascene-object-cluster-member");
                          if (!key) return;
                          const source = objectClusterMembers.find((member) => member.key === key);
                          if (!source || source.family === family.name) return;
                          void persistObjectClusterOperation({ action: "reassign", memberKeys: [key], targetFamily: family.name, sourceFamilies: [source.family] });
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <button type="button" draggable className="cursor-grab rounded border border-slate-700 px-1 py-0.5 text-[9px] text-slate-400 hover:border-cyan-700 hover:text-cyan-200 active:cursor-grabbing" aria-label={`Drag ${family.name} lineup row to reorder`} title="Drag to reorder this lineup row" onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-datascene-object-lineup-row", family.name); }} data-vaa1-object-lineup-row-drag-handle="true">⋮⋮</button>
                            <button type="button" className="grid h-5 w-5 shrink-0 place-items-center rounded border border-slate-700 text-[10px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100" onClick={(event) => { event.stopPropagation(); setCollapsedObjectFamilyRows((current) => ({ ...current, [family.name]: !current[family.name] })); }} aria-expanded={!rowCollapsed} aria-label={`${rowCollapsed ? "Expand" : "Collapse"} ${family.name} lineup row`} data-vaa1-object-lineup-row-collapse="true">{rowCollapsed ? "▸" : "▾"}</button>
                            <div className="min-w-0">
                              {editingObjectFamily === family.name ? <div className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={objectFamilyTitleDraft}
                                  onChange={(event) => setObjectFamilyTitleDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      setEditingObjectFamily("");
                                      setObjectFamilyTitleDraft("");
                                      return;
                                    }
                                    if (event.key === "Enter" && objectFamilyTitleDraft.trim() && !objectClusterBusy) {
                                      event.preventDefault();
                                      void persistObjectClusterOperation({
                                        action: "reassign",
                                        memberKeys: family.members.map((member) => member.key),
                                        targetFamily: objectFamilyTitleDraft,
                                        sourceFamilies: [family.name],
                                      });
                                    }
                                  }}
                                  className={`min-w-36 rounded border bg-black px-1.5 py-1 text-[10px] text-slate-100 ${objectFamilyTitleDraft.trim() !== family.name ? "border-amber-500/80 ring-1 ring-amber-500/30" : "border-slate-700"}`}
                                  aria-label={`Edit ${family.name} object row title`}
                                  aria-describedby={`object-title-hint-${family.name}`}
                                />
                                <button type="button" disabled={!objectFamilyTitleDraft.trim() || objectClusterBusy} className="rounded border border-cyan-800 px-1.5 py-1 text-[9px] text-cyan-100 disabled:opacity-40" onClick={async () => { const saved = await persistObjectClusterOperation({ action: "reassign", memberKeys: family.members.map((member) => member.key), targetFamily: objectFamilyTitleDraft, sourceFamilies: [family.name] }); if (saved) setEditingObjectFamily(""); }}>Save title</button>
                                <span id={`object-title-hint-${family.name}`} className="text-[8px] text-slate-500">Enter saves · Esc cancels</span>
                                <input list="governed-object-family-merge-targets" value={objectMergeTarget} onChange={(event) => setObjectMergeTarget(event.target.value)} placeholder="Merge into confirmed family…" className="min-w-52 rounded border border-slate-700 bg-black px-1.5 py-1 text-[9px] text-slate-200" aria-label={`Merge ${family.name} into a governed object family`} />
                                <datalist id="governed-object-family-merge-targets">{governedObjectFamilyNames.filter((label) => label !== family.name).map((label) => <option key={label} value={label} />)}</datalist>
                                <button type="button" disabled={!objectMergeTarget || !governedObjectFamilyNames.includes(objectMergeTarget) || objectClusterBusy} className="rounded border border-amber-800 px-1.5 py-1 text-[9px] text-amber-100 disabled:opacity-40" onClick={async () => { const saved = await persistObjectClusterOperation({ action: "merge", memberKeys: family.members.map((member) => member.key), targetFamily: objectMergeTarget, sourceFamilies: [family.name, objectMergeTarget] }); if (saved) { setEditingObjectFamily(""); setObjectMergeTarget(""); } }}>Merge</button>
                                <button type="button" disabled={objectClusterBusy} className="rounded border border-rose-900/80 px-1.5 py-1 text-[9px] text-rose-200 disabled:opacity-40" title="Remove this redundant row from the active lineup while preserving every detection and receipt" onClick={() => void persistObjectFamilyRowDisposition(family, "drop_row")}>Drop row</button>
                                <button type="button" className="px-1 text-[9px] text-slate-400" onClick={() => setEditingObjectFamily("")}>Cancel</button>
                              </div> : <button type="button" className="truncate text-left text-[10px] font-medium text-slate-100 hover:text-cyan-200" onClick={(event) => { event.stopPropagation(); setObjectActionMessage(null); setEditingObjectFamily(family.name); setObjectFamilyTitleDraft(family.name); setObjectMergeTarget(""); }} title="Rename or merge this object-family row">{family.name}</button>}
                              <div className={fullyMature ? "text-[8px] text-emerald-300" : "text-[8px] text-slate-500"}>{fullyMature ? "100% analyst confirmed · mature" : `${family.members.filter((member) => member.confirmed).length} mature · ${family.members.length - family.members.filter((member) => member.confirmed).length} candidate`} · {included.length} above preview</div>
                              <div className="text-[8px] text-slate-600" data-vaa1-object-provider-lineage="true">{detectorProviders.join(" + ")} · {measuredFamily?.cohesion != null ? `measured cohesion ${Math.round(measuredFamily.cohesion * 100)}%` : `detector-confidence proxy ${Math.round(family.cohesion * 100)}%`}</div>
                            </div>
                          </div>
                          <button type="button" disabled={family.name === "Undetermined" || !family.members.some((member) => selectedObjectClusterSamples.includes(member.key)) || objectClusterBusy} title={family.name === "Undetermined" ? "Name or move selected artefacts using the workbench above" : undefined} className="rounded border border-emerald-800/70 px-2 py-1 text-[9px] text-emerald-100 disabled:opacity-35" onClick={(event) => { event.stopPropagation(); const ids = family.members.filter((member) => selectedObjectClusterSamples.includes(member.key)).map((member) => member.key); void persistObjectClusterOperation({ action: "confirm", memberKeys: ids, targetFamily: family.name, sourceFamilies: [family.name] }); }}>{family.name === "Undetermined" ? "Name selected in workbench" : `Confirm selected (${family.members.filter((member) => selectedObjectClusterSamples.includes(member.key)).length})`}</button>
                        </div>
                        {!rowCollapsed ? <div className="mt-1.5 grid min-h-16 grid-cols-[repeat(auto-fill,4rem)] content-start gap-1.5 pb-1" data-vaa1-object-family-review-thumbnails="true" data-vaa1-lineup-volume-layout="wrapping-grid">
                          {family.members.map((member) => {
                            const selected = selectedObjectClusterSamples.includes(member.key);
                            return <div key={member.key} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-datascene-object-cluster-member", member.key); }} className="relative shrink-0 cursor-grab active:cursor-grabbing" data-vaa1-object-cluster-thumbnail="true" data-vaa1-object-cluster-selected={selected ? "true" : "false"}>
                              <SourceLinkedClusterThumbnail cropUrl={apiService.objectSourceCropUrl(videoId, member.start, member.object.bbox)} label={`${family.name} track ${member.trackId}`} sourceTimeLabel={formatPreciseTime(member.start)} state={member.confirmed ? "mature" : selected ? "selected" : "candidate"} onOpen={() => activateObjectInVideo(member.object, member.key)} />
                              <button type="button" className={`absolute left-0.5 top-0.5 grid h-4 w-4 place-items-center rounded border text-[9px] ${selected ? "border-cyan-200 bg-cyan-700 text-white" : "border-slate-400 bg-black/75 text-transparent"}`} aria-label={`${selected ? "Unselect" : "Select"} ${family.name} track ${member.trackId} at ${formatPreciseTime(member.start)}`} onClick={(event) => { event.stopPropagation(); setSelectedObjectClusterSamples((current) => current.includes(member.key) ? current.filter((key) => key !== member.key) : [...current, member.key]); }}>✓</button>
                            </div>;
                          })}
                        </div> : null}
                        <div className="mt-1 grid grid-cols-2 gap-1 text-[8px] text-slate-500"><span className="truncate">Representative: track {measuredFamily?.representative_evidence_id ? `measured as ${measuredFamily.representative_evidence_id}` : `${family.representative.trackId} · confidence ${Math.round(family.representative.quality * 100)}%`}</span><span className="truncate">Boundary: track {measuredFamily?.boundary_evidence_id ? `measured as ${measuredFamily.boundary_evidence_id}` : `${family.boundary.trackId} · confidence ${Math.round(family.boundary.quality * 100)}%`}</span></div>
                      </section>;
                    })}
                  </div>
                  {droppedObjectClusterFamilies.length ? <details className="mt-2 rounded border border-rose-950/50 bg-black/15" data-vaa1-dropped-object-lineup-rows="true"><summary className="cursor-pointer px-2 py-1 text-[9px] uppercase text-slate-500">Dropped legacy rows · {droppedObjectClusterFamilies.length}</summary><div className="space-y-1 border-t border-white/8 p-2">{droppedObjectClusterFamilies.map((family) => <div key={`dropped:${family.name}`} className="flex items-center justify-between gap-2 rounded border border-white/8 px-2 py-1 text-[9px]"><span className="min-w-0 truncate text-slate-400">{family.name} · {family.members.length} preserved tracks</span><button type="button" disabled={objectClusterBusy} className="rounded border border-cyan-900 px-2 py-1 text-cyan-200 disabled:opacity-40" onClick={() => void persistObjectFamilyRowDisposition(family, "restore_row")}>Restore row</button></div>)}</div></details> : null}
                  <details className="mt-2 rounded border border-white/8 bg-black/15" data-vaa1-object-cluster-lineage="true"><summary className="cursor-pointer px-2 py-1 text-[9px] uppercase text-slate-500">Lineage receipts · {(analysisData?.annotationCorrections?.proliferation_decisions || []).filter((decision: ProliferationDecision) => (decision.governance_status as any)?.schema === "datascene.governed_object_cluster.v1").length}</summary><div className="space-y-1 border-t border-white/8 p-2">{(analysisData?.annotationCorrections?.proliferation_decisions || []).filter((decision: ProliferationDecision) => (decision.governance_status as any)?.schema === "datascene.governed_object_cluster.v1").slice().reverse().map((decision: ProliferationDecision) => <div key={decision.decision_id} className="text-[9px] text-slate-400">{String((decision.governance_status as any)?.operation || "confirm")} · {decision.applied_label} · {String((decision.governance_status as any)?.member_track_ids?.length || 0)} tracks · mature</div>)}</div></details>
                </> : <div className="rounded border border-slate-800 p-2 text-[10px] text-slate-500">No non-person object tracks are registered for cluster exploration.</div>}
              </div>
            </details>
            <div className="mb-2 shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
              Tracked objects · {groupedObjects.length}
            </div>
            <details className="mb-2 shrink-0 rounded border border-slate-800 bg-slate-950/20">
              <summary className="cursor-pointer list-none px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-400 marker:hidden">
                Unmatched raw candidates · {unmatchedObjectClusterMembers.length}
              </summary>
              <div className="max-h-40 space-y-1 overflow-y-auto border-t border-slate-800 p-2">
                <div className="mb-1 text-[10px] text-slate-500">
                  {representedRawObjectCount} of {rawDetectedObjects.length} raw samples are already represented by tracked intervals. Unmatched samples remain candidates until an analyst confirms them.
                </div>
                {unmatchedObjectClusterMembers.length ? <div className="mb-2 flex flex-wrap items-center gap-1 rounded border border-cyan-950/70 bg-cyan-950/10 p-1.5" data-vaa1-new-object-family-row="true">
                  <input
                    value={newObjectFamilyTitle}
                    onChange={(event) => setNewObjectFamilyTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && newObjectFamilyTitle.trim() && selectedUnmatchedObjectKeys.length && !objectClusterBusy) {
                        event.preventDefault();
                        void persistObjectClusterOperation({
                          action: "reassign",
                          memberKeys: selectedUnmatchedObjectKeys,
                          targetFamily: newObjectFamilyTitle,
                          sourceFamilies: [...new Set(unmatchedObjectClusterMembers.filter((member) => selectedUnmatchedObjectKeys.includes(member.key)).map((member) => member.sourceFamily))],
                        });
                      }
                    }}
                    placeholder="New object-family row title"
                    aria-label="New object-family row title"
                    className="min-w-52 flex-1 rounded border border-slate-700 bg-black px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    disabled={!newObjectFamilyTitle.trim() || !selectedUnmatchedObjectKeys.length || objectClusterBusy}
                    className="rounded border border-cyan-700 px-2 py-1 text-[9px] text-cyan-100 disabled:opacity-40"
                    onClick={() => void persistObjectClusterOperation({
                      action: "reassign",
                      memberKeys: selectedUnmatchedObjectKeys,
                      targetFamily: newObjectFamilyTitle,
                      sourceFamilies: [...new Set(unmatchedObjectClusterMembers.filter((member) => selectedUnmatchedObjectKeys.includes(member.key)).map((member) => member.sourceFamily))],
                    })}
                  >
                    Create row from selected ({selectedUnmatchedObjectKeys.length})
                  </button>
                </div> : null}
                {unmatchedObjectClusterMembers.length ? unmatchedObjectClusterMembers.map((member) => {
                  const obj = member.object;
                  const timestamp = member.start;
                  const selected = selectedUnmatchedObjectKeys.includes(member.key);
                  return (
                    <div key={member.key} className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-[10px] ${selected ? "border-cyan-600 bg-cyan-950/20" : "border-slate-800"}`}>
                      <button type="button" className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[9px] ${selected ? "border-cyan-200 bg-cyan-700 text-white" : "border-slate-500 bg-black text-transparent"}`} aria-label={`${selected ? "Unselect" : "Select"} unmatched ${member.sourceFamily} at ${formatPreciseTime(timestamp)}`} onClick={() => setSelectedUnmatchedObjectKeys((current) => current.includes(member.key) ? current.filter((key) => key !== member.key) : [...current, member.key])}>✓</button>
                      <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left" onClick={() => eventBus.emit("videoTimeLineChanged", timestamp)}>
                        <span className="min-w-0 truncate text-slate-300">{String(obj.displayLabel || obj.class_name || "Object candidate")}</span>
                        <span className="shrink-0 text-slate-500">{formatPreciseTime(timestamp)} · candidate</span>
                      </button>
                    </div>
                  );
                }) : (
                  <div className="text-[10px] text-slate-600">Every raw detector sample is represented by a tracked interval</div>
                )}
              </div>
            </details>
            {objectActionMessage && (
              <div
                role="status"
                aria-live="assertive"
                data-vaa1-object-operation-receipt="true"
                className={`mb-2 rounded border px-3 py-2 text-[11px] font-medium shadow-sm ${/failed|blocked/i.test(objectActionMessage) ? "border-red-700/80 bg-red-950/35 text-red-100" : /saving|merging/i.test(objectActionMessage) ? "border-amber-600/80 bg-amber-950/30 text-amber-100" : "border-emerald-700/70 bg-emerald-950/25 text-emerald-100"}`}
              >
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
                  const manualOverride = getManualOverrideForObject(obj);
                  const draft =
                    objectDrafts[rowKey] ||
                    buildObjectIndicationDraft(obj, latestLabel, manualOverride);
                  const startInputKey = `${rowKey}:start`;
                  const endInputKey = `${rowKey}:end`;
                  return (
                  <details
                    key={rowKey}
                    open={selected ? true : undefined}
                    className={`group rounded border transition ${
                      selected
                        ? "border-cyan-600/70 bg-cyan-950/15"
                        : obj.sourceType === "manual_visual"
                        ? "border-emerald-700/60 bg-emerald-950/20"
                        : "border-slate-800 bg-slate-950/20"
                    }`}
                  >
                    <summary
                      className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 marker:hidden"
                      onClick={() => activateObjectInVideo(obj, rowKey)}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[11px] text-slate-200">
                          {latestLabel}
                        </div>
                        <div className="truncate text-[10px] text-[var(--ui-passive-text)]">
                          Source: {sourceLabel}
                        </div>
                        {manualOverride && (
                          <div className="truncate text-[10px] text-emerald-300">
                            Analyst confirmed · detector confidence {(Number(obj.confidence || 0) * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-[var(--ui-passive-text)]">
                        {formatPreciseTime(obj.startTimestamp ?? obj.timestamp)}
                        {` · ${(obj.confidence * 100).toFixed(1)}%`}
                      </span>
                    </summary>
                    <div className="border-t border-slate-800 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
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
                      </div>
                    {manualOverride && (
                      <div className="mt-1 text-[10px] text-emerald-300/90">
                        Latest analyst label • source remains {sourceLabel}
                      </div>
                    )}
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
                                  {objManualCategoryDisplayLabel(category)}
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
                          <div className="mt-0.5 flex flex-col gap-1">
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
                                  updateObjectDraft(rowKey, {
                                    label: val,
                                    ...(isKnownCharacter ? { category: "Identification" } : {}),
                                  });
                                }
                              }}
                              className="w-full rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-200"
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
                              type="text"
                              value={draft.label}
                              onChange={(event) =>
                                updateObjectDraft(rowKey, { label: event.target.value })
                              }
                              className="w-full rounded border border-slate-700 bg-black/70 px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-200"
                              placeholder="Analyst label or Narrative Agent"
                              aria-label="Object indication label"
                            />
                          </div>
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
                          Detector substrate: {obj.raw_class_name}
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
                    <SecondOrderLabelAffirmationChips
                      plan={analysisData?.secondOrderLabelProliferation}
                      surface="objects_panel"
                      targetLabelFamilies={[
                        "OBJ",
                        "Identification",
                        obj.class_name,
                        obj.displayLabel,
                        latestLabel,
                      ]}
                      timeSpan={{
                        start: obj.startTimestamp ?? obj.timestamp,
                        end: obj.endTimestamp ?? obj.timestamp,
                      }}
                      compact
                      limit={2}
                    />
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
                        Narrative Agent: {obj.identityAffirmation}
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
                  </details>
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
