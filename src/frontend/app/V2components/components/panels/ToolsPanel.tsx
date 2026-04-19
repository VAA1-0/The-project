"use client";

import {
  MessageSquareText,
  Brain,
  View,
  ScanEye,
  ChartScatter,
  ScanSearch,
  SmilePlus,
  Languages,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoService } from "@/lib/video-service";
import {
  MORPHOLOGY_LANGUAGE_OPTIONS,
  MORPHOLOGY_PACK_POLICY_OPTIONS,
  morphologySlotCount,
  type MorphologyPackPolicy,
} from "@/lib/morphology-language-packs";
import type {
  AnalysisData,
  ExpressionSample,
  VideoMetadata,
} from "@/lib/video-service";
import { apiService } from "@/lib/api-service";
import type {
  AnalysisEvent,
  ManualVisualAnnotation,
  MorphologyCatalogItem,
} from "@/lib/api-service";
import { getVideoBlob } from "@/lib/blob-store";
import { listJobs } from "@/cvat-api/client";
import {
  broadcastAnalysisCorrectionRefresh,
  buildCorrectionRule,
  mergeCorrectionRule,
  pushCorrectionSnapshot,
} from "@/lib/annotation-corrections";

import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { useLayoutHost } from "../LayoutHost";
import CvatPluginPanel from "./CvatPluginPanel";

type ToolsWorkspace =
  | "analysis"
  | "annotation"
  | "visual"
  | "morphology"
  | "face"
  | "language"
  | "mission"
  | "expression";

type VisualWorkspaceView = "cinematic" | "inspectors";
type AnnotationPluginView = "menu" | "cvat";

type CinematicTimelineEntry = {
  key: string;
  start: number;
  end: number;
  label: string;
  origin?: "derived" | "analyst-added";
};

const CINEMATIC_SHOT_SIZE_OPTIONS = [
  "extreme wide shot",
  "wide shot",
  "medium wide shot",
  "medium shot",
  "medium close-up",
  "close-up",
  "extreme close-up",
  "two-shot",
  "over-the-shoulder",
  "point of view",
  "establishing shot",
];

const MANUAL_LEAF_NAV_OPTIONS: Array<{
  category: ManualVisualAnnotation["category"];
  panelType: string;
  label: string;
  panelProps?: Record<string, unknown>;
}> = [
  { category: "Action", panelType: "ManualAction", label: "Action" },
  {
    category: "Audio",
    panelType: "Audio",
    label: "Audio",
    panelProps: { panelMode: "audio" },
  },
  {
    category: "Cinematic Cues",
    panelType: "ManualCinematicCues",
    label: "Cinematic Cues",
  },
  {
    category: "Expressions",
    panelType: "Expressions",
    label: "Expressions",
  },
  { category: "Genre", panelType: "ManualGenre", label: "Genre" },
  {
    category: "Identification",
    panelType: "ManualIdentification",
    label: "Identification",
  },
  {
    category: "Interaction",
    panelType: "ManualInteraction",
    label: "Interaction",
  },
  { category: "Metadata", panelType: "ManualMetadata", label: "Metadata" },
  { category: "Movement", panelType: "ManualMovement", label: "Movement" },
  { category: "Notes", panelType: "ManualNotes", label: "Notes" },
  { category: "OBJ", panelType: "OBJDetection", label: "OBJ" },
  { category: "OCR", panelType: "OCR", label: "OCR" },
  { category: "Role", panelType: "ManualRole", label: "Role" },
  { category: "Scene", panelType: "ManualScene", label: "Scene" },
  {
    category: "Transcription",
    panelType: "Transcript",
    label: "Transcription",
  },
];

function cinematicEntryId(entry: CinematicTimelineEntry): string {
  return `${entry.key}:${entry.start}:${entry.end}`;
}

function compressCinematicSamples(
  clueType: string,
  samples?: Array<{ timestamp: number; label: string }>,
): CinematicTimelineEntry[] {
  if (!samples?.length) return [];
  const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const entries: CinematicTimelineEntry[] = [];

  for (const sample of sorted) {
    const label = String(sample.label || "unknown");
    const timestamp = Number(sample.timestamp || 0);
    const last = entries[entries.length - 1];
    if (last && last.label === label) {
      last.end = timestamp;
      continue;
    }
    entries.push({
      key: clueType,
      start: timestamp,
      end: timestamp,
      label,
    });
  }

  return entries;
}

function normalizeCinematicLabel(value: string, clueKey: string): string {
  const prefix = `${clueKey}:`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function classifyCinematicShotSize(heightRatio: number, widthRatio: number): string {
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

function formatSeconds(value?: number | null): string {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe)) return "0s";
  const rounded = Math.abs(safe) >= 10 ? safe.toFixed(1) : safe.toFixed(3);
  return `${Number(rounded)}s`;
}

function ManualAnnotationLeafSection({
  title,
  categoryTone,
  items,
  videoId,
}: {
  title: string;
  categoryTone: string;
  items: ManualVisualAnnotation[];
  videoId: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">
            {title}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            {categoryTone}
          </div>
        </div>
        <div className="rounded border border-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-100/70">
          {items.length}
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="w-full rounded border border-white/8 bg-[#141414] px-2 py-2 text-left text-[11px] text-slate-300 transition hover:bg-slate-800/30"
            onClick={() => {
              eventBus.emit("videoIdChanged", videoId);
              eventBus.emit(
                "videoTimeLineChanged",
                Number(item.timestamp_seconds || 0),
              );
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-medium text-slate-100">
                {item.label || item.subcategory || title}
              </span>
              <span className="shrink-0 text-slate-500">
                {formatSeconds(item.timestamp_seconds)}
              </span>
            </div>
            <div className="mt-1 text-slate-400">
              {item.subcategory || item.category}
            </div>
            {item.open_note ? (
              <div className="mt-1 text-slate-400">{item.open_note}</div>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function classifySceneDensity(sceneCount: number, meanDuration: number): string {
  if (sceneCount >= 350 || meanDuration <= 0.45) {
    return "very high cut density";
  }
  if (sceneCount >= 160 || meanDuration <= 1.2) {
    return "high-cut density";
  }
  if (sceneCount >= 60 || meanDuration <= 2.8) {
    return "moderate-cut density";
  }
  return "longer scene holds";
}

function describeSceneBasis(sceneCount: number, meanDuration: number): string {
  if (sceneCount >= 350 || meanDuration <= 0.45) {
    return "This material shows very dense cutting, which can legitimately produce many short bands. Treat this as navigational evidence, not final scene truth.";
  }
  if (sceneCount >= 160 || meanDuration <= 1.2) {
    return "This readout suggests fast-cut material. Use merged bands first, then inspect raw intervals only when needed.";
  }
  if (sceneCount >= 60 || meanDuration <= 2.8) {
    return "This looks like moderate cutting. The derived bands should be usable as a first pass, but they still need analyst review.";
  }
  return "This material appears to hold shots longer, so derived scene bands should read more cleanly at top level.";
}

function describeMotionBasis(
  summary?: {
    dominant_motion?: string | null;
    sample_count?: number;
    high_motion_samples?: number;
    mean_occupancy_shift?: number;
  } | null,
): string {
  if (!summary) {
    return "Motion evidence is not available yet.";
  }
  const dominant = String(summary.dominant_motion || "unknown");
  const highMotionSamples = Number(summary.high_motion_samples ?? 0);
  const sampleCount = Math.max(1, Number(summary.sample_count ?? 0));
  const ratio = highMotionSamples / sampleCount;

  if (dominant === "low motion" && ratio < 0.15) {
    return "Overall motion reads as restrained, with activity spikes likely concentrated around cuts or brief bursts.";
  }
  if (ratio >= 0.35) {
    return "This segment shows sustained visual churn. Use the notable moments as jump points into the densest activity.";
  }
  return "Motion evidence is mixed rather than constant. The notable moments are the best entry points for quick review.";
}

function mergeMicroScenes(
  segments: Array<{ scene_index: number; start: number; end: number; duration?: number }>,
  minDurationSeconds = 0.75,
) {
  if (!segments.length) return [];
  const merged: Array<{ scene_index: number; start: number; end: number; duration: number; mergedCount: number }> = [];

  for (const segment of segments) {
    const start = Number(segment.start ?? 0);
    const end = Number(segment.end ?? start);
    const duration = Math.max(0, Number(segment.duration ?? end - start));
    const last = merged[merged.length - 1];

    if (
      last &&
      (duration < minDurationSeconds || last.duration < minDurationSeconds)
    ) {
      last.end = end;
      last.duration = Math.max(0, last.end - last.start);
      last.mergedCount += 1;
      continue;
    }

    merged.push({
      scene_index: segment.scene_index,
      start,
      end,
      duration,
      mergedCount: 1,
    });
  }

  return merged;
}

export default function ToolsPanel() {
  const { openPanel } = useLayoutHost();
  const selectSurfaceClassName =
    "w-full max-w-[260px] border-white/12 bg-[#202020] text-slate-200 data-[placeholder]:text-slate-400";
  const selectContentClassName =
    "border-white/12 bg-[#202020] text-slate-200";
  const morphologySectionRef = React.useRef<HTMLDivElement | null>(null);
  const faceSectionRef = React.useRef<HTMLDivElement | null>(null);
  const languageSectionRef = React.useRef<HTMLDivElement | null>(null);
  const missionSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [analysisTier, setAnalysisTier] = useState<
    "quick_sweep" | "science_scan" | "forensic_sensor"
  >("science_scan");
  const [modalityFocus, setModalityFocus] = useState<
    "multimodal" | "graphics" | "audio" | "images" | "text"
  >("multimodal");
  const [morphologyPackPolicy, setMorphologyPackPolicy] =
    useState<MorphologyPackPolicy>("core_only");
  const [morphologyLanguages, setMorphologyLanguages] = useState<string[]>([
    "",
    "",
  ]);
  const [specialUseMorphologyLanguage, setSpecialUseMorphologyLanguage] =
    useState("");
  const [allowRoughInterpretation, setAllowRoughInterpretation] =
    useState(true);
  const [applyFaceAnonymization, setApplyFaceAnonymization] = useState(false);
  const [faceMessageStyle, setFaceMessageStyle] = useState<
    "plain" | "starfleet"
  >("plain");
  const [faceRequiresPersonDetection, setFaceRequiresPersonDetection] =
    useState(false);
  const [expressionPreviewCount, setExpressionPreviewCount] = useState([4]);

  const [videoId, setVideoId] = useState("");

  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [activeVisualView, setActiveVisualView] =
    useState<VisualWorkspaceView>("cinematic");
  const [openCinematicSections, setOpenCinematicSections] = useState<
    Record<string, boolean>
  >({
    "shot-size": true,
  });
  const [activeCinematicCorrectionId, setActiveCinematicCorrectionId] =
    useState<string | null>(null);
  const [activeCinematicCorrectionValue, setActiveCinematicCorrectionValue] =
    useState("");
  const [pendingShotSizeTimestamp, setPendingShotSizeTimestamp] = useState("");
  const [shotAdditionSelectKey, setShotAdditionSelectKey] = useState(0);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);

  const lastObjectUrl = React.useRef<string | null>(null);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);

  // CVAT task/job state
  const [taskID, setTaskId] = useState<number | undefined>();
  const [jobReady, setJobReady] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [morphologySearch, setMorphologySearch] = useState("");
  const [morphologyCatalog, setMorphologyCatalog] = useState<
    MorphologyCatalogItem[]
  >([]);
  const [morphologyCatalogLoading, setMorphologyCatalogLoading] =
    useState(false);
  const [morphologyCatalogError, setMorphologyCatalogError] = useState<
    string | null
  >(null);
  const [showMorphologyRecords, setShowMorphologyRecords] = useState(false);
  const [showFaceRecords, setShowFaceRecords] = useState(false);
  const [showLanguageRecords, setShowLanguageRecords] = useState(false);
  const [showMissionRecords, setShowMissionRecords] = useState(false);
  const [showExpressionRecords, setShowExpressionRecords] = useState(false);
  const [activeWorkspace, setActiveWorkspace] =
    useState<ToolsWorkspace>("analysis");
  const [activeAnnotationPlugin, setActiveAnnotationPlugin] =
    useState<AnnotationPluginView>("menu");

  const workspaceOptions: Array<{ key: ToolsWorkspace; label: string }> = [
    { key: "analysis", label: "Analysis setup" },
    { key: "annotation", label: "Annotation workspace" },
    { key: "visual", label: "Visual cues" },
    { key: "morphology", label: "Morphology catalog" },
    { key: "face", label: "Face records" },
    { key: "language", label: "Language records" },
    { key: "mission", label: "Mission records" },
    { key: "expression", label: "Expression records" },
  ];

  const activateWorkspaceSection = (section: ToolsWorkspace) => {
    if (section !== "annotation") {
      setActiveAnnotationPlugin("menu");
    }

    if (section === "analysis") {
      setActiveWorkspace("analysis");
      return;
    }
    if (section === "annotation") {
      setActiveWorkspace("annotation");
      return;
    }
    if (section === "visual") {
      setActiveWorkspace("visual");
      setActiveVisualView("cinematic");
      return;
    }
    if (section === "morphology") {
      setActiveWorkspace("morphology");
      setShowMorphologyRecords(true);
      window.setTimeout(() => {
        morphologySectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
      return;
    }
    if (section === "face") {
      setActiveWorkspace("face");
      setShowFaceRecords(true);
      window.setTimeout(() => {
        faceSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
      return;
    }
    if (section === "language") {
      setActiveWorkspace("language");
      setShowLanguageRecords(true);
      window.setTimeout(() => {
        languageSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
      return;
    }
    if (section === "mission") {
      setActiveWorkspace("mission");
      setShowMissionRecords(true);
      window.setTimeout(() => {
        missionSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
      return;
    }
    if (section === "expression") {
      setActiveWorkspace("expression");
      setShowExpressionRecords(true);
    }
  };

  const expressionAggregate = React.useMemo(() => {
    const samples = analysisData?.expressionResults ?? [];
    const counts = new Map<string, number>();

    for (const sample of samples) {
      if (!sample?.dominant_emotion) continue;
      counts.set(
        sample.dominant_emotion,
        (counts.get(sample.dominant_emotion) ?? 0) + 1,
      );
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [analysisData]);

  const expressionTimeline = React.useMemo(() => {
    const samples = analysisData?.expressionResults ?? [];
    return samples
      .filter((sample: ExpressionSample) => sample?.dominant_emotion)
      .slice(0, expressionPreviewCount[0] ?? 4);
  }, [analysisData, expressionPreviewCount]);

  const manualCinematicAnnotations =
    analysisData?.manualAnnotationsByCategory?.["Cinematic Cues"] ?? [];
  const manualSceneAnnotations =
    analysisData?.manualAnnotationsByCategory?.Scene ?? [];
  const manualActionAnnotations =
    analysisData?.manualAnnotationsByCategory?.Action ?? [];
  const manualIdentificationAnnotations =
    analysisData?.manualAnnotationsByCategory?.Identification ?? [];

  const motionSceneBasis = analysisData?.metadata?.motionSceneBasis;
  const motionEvidenceSummary = motionSceneBasis?.motionEvidence?.summary;
  const motionEvidenceSamples = React.useMemo(
    () => motionSceneBasis?.motionEvidence?.samples ?? [],
    [motionSceneBasis?.motionEvidence?.samples],
  );
  const sceneSegmentSummary = motionSceneBasis?.sceneSegments?.summary;
  const sceneSegments = React.useMemo(
    () => motionSceneBasis?.sceneSegments?.segments ?? [],
    [motionSceneBasis?.sceneSegments?.segments],
  );
  const notableMotionMoments = React.useMemo(() => {
    if (!motionEvidenceSamples.length) return [];
    const sorted = [...motionEvidenceSamples].sort(
      (left, right) =>
        (right.occupancy_shift ?? 0) - (left.occupancy_shift ?? 0) ||
        (right.foreground_delta ?? 0) - (left.foreground_delta ?? 0),
    );
    const unique: typeof motionEvidenceSamples = [];
    for (const sample of sorted) {
      if (
        unique.some(
          (existing) => Math.abs((existing.timestamp ?? 0) - (sample.timestamp ?? 0)) < 0.5,
        )
      ) {
        continue;
      }
      unique.push(sample);
      if (unique.length >= 4) break;
    }
    return unique.sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
  }, [motionEvidenceSamples]);
  const mergedSceneSegments = React.useMemo(
    () => mergeMicroScenes(sceneSegments),
    [sceneSegments],
  );
  const mergedScenePreview = React.useMemo(
    () => mergedSceneSegments.slice(0, 6),
    [mergedSceneSegments],
  );
  const sceneDensityLabel = React.useMemo(
    () =>
      classifySceneDensity(
        Number(sceneSegmentSummary?.scene_count ?? 0),
        Number(sceneSegmentSummary?.mean_scene_duration ?? 0),
      ),
    [sceneSegmentSummary?.mean_scene_duration, sceneSegmentSummary?.scene_count],
  );
  const sceneBasisDescription = React.useMemo(
    () =>
      describeSceneBasis(
        Number(sceneSegmentSummary?.scene_count ?? 0),
        Number(sceneSegmentSummary?.mean_scene_duration ?? 0),
      ),
    [sceneSegmentSummary?.mean_scene_duration, sceneSegmentSummary?.scene_count],
  );
  const motionBasisDescription = React.useMemo(
    () => describeMotionBasis(motionEvidenceSummary),
    [motionEvidenceSummary],
  );

  const analysisTierLabel = React.useMemo(() => {
    const labels = {
      quick_sweep: "Quick sweep",
      science_scan: "Science scan",
      forensic_sensor: "Forensic sensor",
    } as const;
    return labels[analysisTier];
  }, [analysisTier]);

  const modalityFocusLabel = React.useMemo(() => {
    const labels = {
      multimodal: "Multimodal",
      graphics: "Graphics",
      audio: "Audio",
      images: "Images",
      text: "Text",
    } as const;
    return labels[modalityFocus];
  }, [modalityFocus]);

  const morphologyPackLabel = React.useMemo(() => {
    const match = MORPHOLOGY_PACK_POLICY_OPTIONS.find(
      (option) => option.value === morphologyPackPolicy,
    );
    return match?.label || "English core";
  }, [morphologyPackPolicy]);

  const morphologySlotLimit = React.useMemo(
    () => morphologySlotCount(morphologyPackPolicy),
    [morphologyPackPolicy],
  );

  const selectedMorphologyLanguageLabels = React.useMemo(() => {
    return morphologyLanguages
      .filter(Boolean)
      .map(
        (code) =>
          MORPHOLOGY_LANGUAGE_OPTIONS.find((option) => option.code === code)?.label ||
          code,
      );
  }, [morphologyLanguages]);

  const filteredMorphologyCatalog = React.useMemo(() => {
    const needle = morphologySearch.trim().toLowerCase();
    if (!needle) {
      return morphologyCatalog;
    }

    return morphologyCatalog.filter((item) => {
      const haystacks = [
        item.code,
        item.name,
        item.spacy_model || "",
        ...(item.notes || []),
      ];
      return haystacks.some((value) => value.toLowerCase().includes(needle));
    });
  }, [morphologyCatalog, morphologySearch]);

  const stageLabel = React.useMemo(() => {
    const stage = metadata?.missionStage;
    const stageMap: Record<string, string> = {
      queued: "Queued",
      preflight: "Preflight",
      visual_scan: "Visual Sweep",
      visual_complete: "Visual Sweep Complete",
      audio_extract: "Audio Extraction",
      transcription: "Transcription",
      language_model: "Language Calibration",
      pos_analysis: "POS Analysis",
      quant_analysis: "Quant Analysis",
      audio_complete: "Audio Complete",
      complete: "Mission Complete",
      red_alert: "Red Alert",
    };
    return stage ? stageMap[stage] ?? stage : null;
  }, [metadata?.missionStage]);

  const missionLog = React.useMemo(() => {
    return [...(metadata?.eventLog || [])]
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, 6);
  }, [metadata?.eventLog]);

  const formatLogTimestamp = React.useCallback((value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  }, []);

  const openVideoAtTime = React.useCallback(
    (nextTime: number, cueKey?: string) => {
      if (!videoId) return;
      const cueMap: Record<string, string> = {
        "shot-size": "shot",
        transition: "transition",
        movement: "motion",
        composition: "spatial",
        "subject-arrangement": "human",
      };
      const mappedCue = cueKey ? cueMap[cueKey] : undefined;
      eventBus.emit("videoIdChanged", videoId);
      openPanel("VideoPanel");
      window.setTimeout(() => {
        eventBus.emit("videoIdChanged", videoId);
        if (mappedCue) {
          eventBus.emit("visualCueOpen", mappedCue);
        }
        eventBus.emit("videoTimeLineChanged", nextTime);
      }, 60);
      window.setTimeout(() => {
        eventBus.emit("videoIdChanged", videoId);
        if (mappedCue) {
          eventBus.emit("visualCueOpen", mappedCue);
        }
        eventBus.emit("videoTimeLineChanged", nextTime);
      }, 180);
    },
    [openPanel, videoId],
  );

  const getCorrectedCinematicEntry = React.useCallback(
    (entry: CinematicTimelineEntry) => {
      const overrides = analysisData?.annotationCorrections?.label_overrides || [];
      const matchingRule = overrides.find((rule) => {
        if (rule?.modality !== "cinematic") return false;
        if (!String(rule?.raw_value || "").trim().toLowerCase().startsWith(`${entry.key}:`)) return false;
        return (
          Number(rule?.target_start_timestamp) === Number(entry.start) &&
          Number(rule?.target_end_timestamp) === Number(entry.end)
        );
      });
      const value = matchingRule?.corrected_value?.trim() || entry.label;
      return normalizeCinematicLabel(value, entry.key);
    },
    [analysisData?.annotationCorrections?.label_overrides],
  );

  const saveCinematicCorrection = React.useCallback(
    async (entry: CinematicTimelineEntry, explicitValue?: string) => {
      if (!videoId) return;
      const currentLabel = getCorrectedCinematicEntry(entry);
      const correctedValue =
        explicitValue?.trim() ||
        window.prompt("Set analyst override for cinematic clue:", currentLabel)?.trim();
      if (!correctedValue || correctedValue.trim() === currentLabel.trim()) {
        return;
      }

      const filteredOverrides = (analysisData?.annotationCorrections?.label_overrides || []).filter(
        (rule) =>
          !(
            rule?.modality === "cinematic" &&
            String(rule?.raw_value || "").trim().toLowerCase().startsWith(`${entry.key}:`) &&
            Number(rule?.target_start_timestamp) === Number(entry.start) &&
            Number(rule?.target_end_timestamp) === Number(entry.end)
          ),
      );
      const rawValue = `${entry.key}:${entry.label}`;
      const nextCorrections = mergeCorrectionRule(
        {
          ...(analysisData?.annotationCorrections || {}),
          label_overrides: filteredOverrides,
        },
        buildCorrectionRule("cinematic", rawValue, correctedValue.trim(), "", {
          targetStartTimestamp: entry.start,
          targetEndTimestamp: entry.end,
          targetTimestamp: entry.start,
        }),
      );
      pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
      await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
      const refreshed = await VideoService.refreshAnalysis(videoId);
      setAnalysisData(refreshed);
      setActiveCinematicCorrectionId(null);
      setActiveCinematicCorrectionValue("");
      broadcastAnalysisCorrectionRefresh(videoId);
    },
    [analysisData?.annotationCorrections, getCorrectedCinematicEntry, videoId],
  );

  const saveCinematicShotAddition = React.useCallback(
    async (label: string) => {
      if (!videoId) return;
      const parsedTimestamp = Number.parseFloat(pendingShotSizeTimestamp);
      const targetTimestamp = Number.isFinite(parsedTimestamp)
        ? Math.max(0, parsedTimestamp)
        : Math.max(0, currentVideoTime);
      const filteredOverrides = (
        analysisData?.annotationCorrections?.label_overrides || []
      ).filter(
        (rule) =>
          !(
            rule?.modality === "cinematic" &&
            String(rule?.raw_value || "").trim().toLowerCase() ===
              "cinematic-add:shot-size" &&
            Number(rule?.target_timestamp) === Number(targetTimestamp)
          ),
      );
      const nextCorrections = mergeCorrectionRule(
        {
          ...(analysisData?.annotationCorrections || {}),
          label_overrides: filteredOverrides,
        },
        buildCorrectionRule(
          "cinematic",
          "cinematic-add:shot-size",
          label.trim(),
          "",
          {
            targetTimestamp,
            targetStartTimestamp: targetTimestamp,
            targetEndTimestamp: targetTimestamp,
          },
        ),
      );
      pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
      await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
      const refreshed = await VideoService.refreshAnalysis(videoId);
      setAnalysisData(refreshed);
      setPendingShotSizeTimestamp(currentVideoTime.toFixed(1));
      setShotAdditionSelectKey((previous) => previous + 1);
      broadcastAnalysisCorrectionRefresh(videoId);
    },
    [
      analysisData?.annotationCorrections,
      currentVideoTime,
      pendingShotSizeTimestamp,
      videoId,
    ],
  );

  const deleteCinematicShotAddition = React.useCallback(
    async (entry: CinematicTimelineEntry) => {
      if (!videoId || entry.origin !== "analyst-added") return;
      const filteredOverrides = (
        analysisData?.annotationCorrections?.label_overrides || []
      ).filter(
        (rule) =>
          !(
            rule?.modality === "cinematic" &&
            String(rule?.raw_value || "").trim().toLowerCase() ===
              "cinematic-add:shot-size" &&
            Number(rule?.target_timestamp) === Number(entry.start) &&
            Number(rule?.target_end_timestamp ?? rule?.target_timestamp ?? entry.start) ===
              Number(entry.end)
          ),
      );
      const nextCorrections = {
        ...(analysisData?.annotationCorrections || {}),
        label_overrides: filteredOverrides,
      };
      pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
      await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
      const refreshed = await VideoService.refreshAnalysis(videoId);
      setAnalysisData(refreshed);
      broadcastAnalysisCorrectionRefresh(videoId);
    },
    [analysisData?.annotationCorrections, videoId],
  );

  const cinematicTimelineSections = React.useMemo(() => {
    const clues = analysisData?.metadata?.cinematicClues;
    const sections: Array<{ key: string; label: string; entries: CinematicTimelineEntry[] }> = [];
    const mergeShotEntries = (entries: CinematicTimelineEntry[]) =>
      entries.sort((left, right) => {
        if (left.start !== right.start) return left.start - right.start;
        if (left.end !== right.end) return left.end - right.end;
        return left.label.localeCompare(right.label);
      });
    const addedShotSizeEntries: CinematicTimelineEntry[] = (
      analysisData?.annotationCorrections?.label_overrides || []
    )
      .filter(
        (rule) =>
          rule?.modality === "cinematic" &&
          String(rule?.raw_value || "").trim().toLowerCase() ===
            "cinematic-add:shot-size" &&
          String(rule?.corrected_value || "").trim(),
      )
      .map((rule) => {
        const timestamp =
          Number(rule?.target_timestamp) ||
          Number(rule?.target_start_timestamp) ||
          0;
        return {
          key: "shot-size",
          start: timestamp,
          end: Number(rule?.target_end_timestamp ?? timestamp),
          label: String(rule?.corrected_value || "").trim(),
          origin: "analyst-added",
        };
      });

    const shotIntervals =
      clues?.shotSize?.summary?.interval_summaries?.map((interval) => ({
        key: "shot-size",
        start: Number(interval.start ?? 0),
        end: Number(interval.end ?? interval.start ?? 0),
        label: normalizeCinematicLabel(
          String(interval.dominant_label || "unknown"),
          "shot-size",
        ),
        origin: "derived" as const,
      })) || [];
    if (shotIntervals.length) {
      sections.push({
        key: "shot-size",
        label: "Shot size",
        entries: mergeShotEntries([...shotIntervals, ...addedShotSizeEntries]),
      });
    } else {
      const shotEntries = clues
        ? compressCinematicSamples("shot-size", clues.shotSize?.samples)
        : [];
      if (shotEntries.length) {
        sections.push({
          key: "shot-size",
          label: "Shot size",
          entries: mergeShotEntries([...shotEntries, ...addedShotSizeEntries]),
        });
      } else {
        const personObjects = (analysisData?.rawDetectedObjects || []).filter(
          (item) => (item.class_name || item.raw_class_name || "").toLowerCase() === "person",
        );
        const estimatedWidth = Math.max(
          1920,
          ...personObjects.map((item) => Math.max(0, item.bbox?.x2 ?? 0)),
        );
        const estimatedHeight = Math.max(
          1080,
          ...personObjects.map((item) => Math.max(0, item.bbox?.y2 ?? 0)),
        );
        const byBucket = new Map<number, typeof personObjects>();
        for (const item of personObjects) {
          const bucket = Math.floor((item.timestamp || 0) / 5);
          const current = byBucket.get(bucket) || [];
          current.push(item);
          byBucket.set(bucket, current);
        }
        const fallbackEntries: CinematicTimelineEntry[] = [...byBucket.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([bucket, items]) => {
            const dominant = items.reduce((best, current) => {
              const bestArea =
                Math.max(0, (best.bbox?.x2 ?? 0) - (best.bbox?.x1 ?? 0)) *
                Math.max(0, (best.bbox?.y2 ?? 0) - (best.bbox?.y1 ?? 0));
              const currentArea =
                Math.max(0, (current.bbox?.x2 ?? 0) - (current.bbox?.x1 ?? 0)) *
                Math.max(0, (current.bbox?.y2 ?? 0) - (current.bbox?.y1 ?? 0));
              return currentArea > bestArea ? current : best;
            }, items[0]);
            const width = Math.max(
              0,
              (dominant.bbox?.x2 ?? 0) - (dominant.bbox?.x1 ?? 0),
            );
            const height = Math.max(
              0,
              (dominant.bbox?.y2 ?? 0) - (dominant.bbox?.y1 ?? 0),
            );
            return {
              key: "shot-size",
              start: bucket * 5,
              end: bucket * 5 + 5,
              label: classifyCinematicShotSize(
                height / Math.max(estimatedHeight, 1),
                width / Math.max(estimatedWidth, 1),
              ),
              origin: "derived" as const,
            };
          });
        if (fallbackEntries.length) {
          sections.push({
            key: "shot-size",
            label: "Shot size",
            entries: mergeShotEntries([...fallbackEntries, ...addedShotSizeEntries]),
          });
        } else if (addedShotSizeEntries.length) {
          sections.push({
            key: "shot-size",
            label: "Shot size",
            entries: addedShotSizeEntries,
          });
        }
      }
    }

    if (clues) {
      const transitionEntries = compressCinematicSamples(
        "transition",
        clues.transitionClues?.samples,
      );
      if (transitionEntries.length) {
        sections.push({ key: "transition", label: "Transition", entries: transitionEntries });
      }

      const movementEntries = compressCinematicSamples("movement", clues.movementHint?.samples);
      if (movementEntries.length) {
        sections.push({ key: "movement", label: "Movement", entries: movementEntries });
      }

      const compositionEntries = compressCinematicSamples(
        "composition",
        clues.compositionHint?.samples,
      );
      if (compositionEntries.length) {
        sections.push({ key: "composition", label: "Composition", entries: compositionEntries });
      }

      const subjectArrangementEntries = compressCinematicSamples(
        "subject-arrangement",
        clues.subjectArrangementHint?.samples,
      );
      if (subjectArrangementEntries.length) {
        sections.push({
          key: "subject-arrangement",
          label: "Subject arrangement",
          entries: subjectArrangementEntries,
        });
      }
    }

    return sections;
  }, [
    analysisData?.annotationCorrections?.label_overrides,
    analysisData?.metadata?.cinematicClues,
    analysisData?.rawDetectedObjects,
  ]);

  // Listen for video ID changes via event bus
  useEffect(() => {
    const handler = (id: string) => {
      setVideoId(id);
    };
    eventBus.on("videoIdChanged", handler);

    return () => {
      eventBus.off("videoIdChanged", handler);
    };
  }, []);

  useEffect(() => {
    const handler = (nextTime: number) => {
      setCurrentVideoTime(Number(nextTime) || 0);
    };
    eventBus.on("videoTimeLineChanged", handler);

    return () => {
      eventBus.off("videoTimeLineChanged", handler);
    };
  }, []);

  useEffect(() => {
    if (!pendingShotSizeTimestamp) {
      setPendingShotSizeTimestamp(currentVideoTime.toFixed(1));
    }
  }, [currentVideoTime, pendingShotSizeTimestamp]);

  useEffect(() => {
    let mounted = true;

    async function loadMorphologyCatalog() {
      try {
        setMorphologyCatalogLoading(true);
        setMorphologyCatalogError(null);
        const result = await apiService.getMorphologyCatalog();
        if (!mounted) return;
        setMorphologyCatalog(result.items || []);
      } catch (error) {
        if (!mounted) return;
        setMorphologyCatalogError(
          error instanceof Error ? error.message : "Could not load morphology catalog.",
        );
      } finally {
        if (mounted) {
          setMorphologyCatalogLoading(false);
        }
      }
    }

    loadMorphologyCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const focusSection = (section: string) => {
      const nextSection = workspaceOptions.find((item) => item.key === section);
      if (nextSection) {
        activateWorkspaceSection(nextSection.key);
      }
    };

    eventBus.on<string>("toolsSectionFocus", focusSection);
    return () => {
      eventBus.off<string>("toolsSectionFocus", focusSection);
    };
  }, []);

  useEffect(() => {
    if (activeWorkspace !== "visual") {
      eventBus.emit("visualCueClose", null);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    async function load() {
      if (!videoId) {
        return;
      }

      // Clear any existing polling interval when switching videos
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      try {
        // Load metadata
        const m = await VideoService.get(videoId);

        console.log("Loaded metadata:", m);

        setMetadata(m);
        setAnalysisTier(
          (m.analysisTier as
            | "quick_sweep"
            | "science_scan"
            | "forensic_sensor") || "science_scan",
        );
        setModalityFocus(
          (m.modalityFocus as
            | "multimodal"
            | "graphics"
            | "audio"
            | "images"
            | "text") || "multimodal",
        );
        setMorphologyPackPolicy(
          (m.languagePackPolicy?.policy as MorphologyPackPolicy) || "core_only",
        );
        setMorphologyLanguages([
          m.languagePackPolicy?.selected_languages?.[0]?.code || "",
          m.languagePackPolicy?.selected_languages?.[1]?.code || "",
        ]);
        setSpecialUseMorphologyLanguage(
          m.languagePackPolicy?.special_use_language?.code ||
            m.languagePackPolicy?.special_use_language?.name ||
            "",
        );
        setAllowRoughInterpretation(
          m.languagePackPolicy?.allow_rough_interpretation ?? true,
        );
        setApplyFaceAnonymization(Boolean(m.applyFaceAnonymization));
        setFaceMessageStyle(m.faceMessageStyle || "plain");
        setFaceRequiresPersonDetection(Boolean(m.faceRequiresPersonDetection));

        // Check and update isAnalyzing status based on video status
        if (m.status === "processing") {
          setIsAnalyzing(true);
          setAnalysisProgress(m.progress || 0);
          // Start polling for this video's analysis progress
          pollAnalysisProgress(videoId);
        } else {
          setIsAnalyzing(false);
          setAnalysisProgress(m.progress || 0);
        }

        // Load video blob - hybrid approach
        // 1. First try to get the original video from IndexedDB (instant preview)
        let blob = await getVideoBlob(videoId);

        if (!blob) {
          // 2. Fallback: try to get the annotated video from the backend (after analysis completes)
          blob = await VideoService.getBlob(videoId);
        }
        if (blob) {
          if (lastObjectUrl.current) {
            URL.revokeObjectURL(lastObjectUrl.current);
          }
          const url = URL.createObjectURL(blob);
          lastObjectUrl.current = url;
          setBlobMissing(false);
        } else {
          setBlobMissing(true);
        }

        // Load analysis data
        const analysis = await VideoService.getAnalysis(videoId);

        setAnalysisData(analysis);
      } catch (err) {
        console.error("Failed to load data:", err);
        setBlobMissing(true);
      }
    }
    load();

    // Cleanup function: clear polling interval when component unmounts or videoId changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [videoId]);

  async function handleAnalyzeVideo() {
    if (!videoId) return;

    try {
      setAnalysisProgress(0);
      await VideoService.startAnalysis(videoId, "full", {
        analysisTier,
        modalityFocus,
        morphologyPackPolicy,
        morphologyLanguages: morphologyLanguages.filter(Boolean),
        specialUseMorphologyLanguage,
        allowRoughInterpretation,
        applyFaceAnonymization,
        faceMessageStyle,
        faceRequiresPersonDetection,
      });
      alert(
        `Launch sequence confirmed. ${analysisTierLabel} / ${modalityFocusLabel} / ${morphologyPackLabel} is underway.`,
      );

      // Start polling
      pollAnalysisProgress(videoId);
    } catch (error) {
      console.error("Failed to start analysis:", error);
      alert("Launch did not engage. Please review the captain's log and try again.");
    }
  }

  async function pollAnalysisProgress(analysisId: string) {
    // Clear any existing polling interval before starting a new one
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setIsAnalyzing(true);

    const interval = setInterval(async () => {
      try {
        const status = await VideoService.get(analysisId);
        setMetadata(status);
        setAnalysisProgress(status.progress || 0);

        if (status.status === "completed") {
          clearInterval(interval);
          pollingIntervalRef.current = null;
          setIsAnalyzing(false);

          // Refresh analysis data
          const updatedAnalysis = await VideoService.getAnalysis(analysisId);
          setAnalysisData(updatedAnalysis);

          // Force refresh the page
          window.location.reload();
          alert("Mission complete. Fresh reports are ready for review.");
        } else if (status.status === "error") {
          clearInterval(interval);
          pollingIntervalRef.current = null;
          setIsAnalyzing(false);
          alert(
            `Red alert: ${
              status.error || "a critical subsystem went offline"
            }. Review the captain's log.`,
          );
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    // Store the interval in the ref
    pollingIntervalRef.current = interval;
  }

  function updateMorphologyLanguage(index: number, value: string) {
    setMorphologyLanguages((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function placeMorphologyLanguage(
    value: string,
    target: "slot_1" | "slot_2" | "special" = "slot_1",
  ) {
    if (target === "special") {
      setSpecialUseMorphologyLanguage(value);
      return;
    }

    const slotIndex = target === "slot_1" ? 0 : 1;
    updateMorphologyLanguage(slotIndex, value);
  }

  function describeMorphologyStatus(item: MorphologyCatalogItem) {
    if (item.installed) {
      return "Local record: installed";
    }
    if (item.has_named_pipeline) {
      return "Local record: declared model";
    }
    return "Local record: lexical fallback";
  }

  type ToolButton = {
    icon: LucideIcon;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  };

  const tools: ToolButton[] = [
    {
      icon: MessageSquareText,
      label: "Speech to text Tool",
      onClick: () => {
        console.log("Speech to text clicked");
        openPanel("Transcript");
      },
      disabled: !videoId,
    },
    {
      icon: Brain,
      label: "POS Analysis Tool",
      onClick: () => {
        console.log("POS Analysis clicked");
        openPanel("POS");
      },
      disabled: !videoId || !analysisData,
    },
    {
      icon: View,
      label: "Object detection",
      onClick: () => {
        console.log("Object detection clicked");
        openPanel("OBJDetection");
      },
      disabled:
        !videoId ||
        ((metadata?.analysisTier === "quick_sweep" || metadata?.status === "completed") &&
          !(Number(analysisData?.detectedObjects?.length ?? 0) > 0)),
    },
    {
      icon: ScanSearch,
      label: "OCR Detection",
      onClick: () => {
        console.log("OCR clicked");
        openPanel("OCR");
      },
      disabled:
        !videoId ||
        ((metadata?.analysisTier === "quick_sweep" || metadata?.status === "completed") &&
          !(Number(analysisData?.ocr?.length ?? 0) > 0)),
    },
    {
      icon: ChartScatter,
      label: "Quantity Detection",
      onClick: () => {
        console.log("Quantity Detection clicked");
        openPanel("Quant");
      },
      disabled: !videoId,
    },
    {
      icon: SmilePlus,
      label: "Expression Detection",
      onClick: () => {
        console.log("Expression Detection clicked");
        openPanel("Expressions");
      },
      disabled:
        !videoId ||
        ((metadata?.analysisTier === "quick_sweep" || metadata?.status === "completed") &&
          !(Number(analysisData?.expressionResults?.length ?? 0) > 0)),
    },
    {
      icon: ScanEye,
      label: "Annotation workspace",
      onClick: () => {
        setActiveWorkspace("annotation");
      },
      disabled: !videoId || isPolling || isAnalyzing,
    },
    {
      icon: Languages,
      label: "Languages",
      onClick: () => {
        languageSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      },
      disabled: !videoId,
    },
  ];

  //<================ OPEN TASK AND LOAD JOB========================>

  async function openTask() {
    setIsPolling(true);

    // 1️⃣ Extract CVAT ID from metadata or fallback to existing taskID
    const cvatID = metadata?.cvatID ?? taskID;

    if (!cvatID) {
      console.log("❌ No CVAT id found in metadata!");
      return;
    }

    console.log("Metadata found:", metadata);
    console.log("Using CVAT ID:", cvatID);
    const resolvedCvatId = cvatID;

    // Update internal state (won’t be immediately available, but that's fine)
    setTaskId(resolvedCvatId);

    console.log(`📂 Opening CVAT task ${resolvedCvatId}...`);

    // 2️⃣ Poll for jobs
    let attempts = 0;
    const maxAttempts = 60;

    async function pollJobs() {
      try {
        const result = await listJobs(resolvedCvatId);
        const jobList = Array.isArray(result) ? result : result.results || [];

        if (jobList.length === 0 && attempts < maxAttempts) {
          attempts++;
          console.log(
            `⏳ Jobs not ready yet (attempt ${attempts}/${maxAttempts})`,
          );
          setTimeout(pollJobs, 3000);
        } else if (jobList.length > 0) {
          console.log(`✅ Found ${jobList.length} job(s)`);
          setJobReady(true);
          setIsPolling(false);
        } else {
          console.warn("⚠️ No jobs found after maximum attempts");
          alert(
            "Jobs are taking longer than expected. Try refreshing the task.",
          );
        }
      } catch (err) {
        console.error("Failed to load jobs:", err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollJobs, 3000);
        }
      }
    }

    pollJobs();
  }
  //<============================================================>
  //<================OPEN JOBS==================================>
  const handleJobClick = async () => {
    // Navigate to the annotation page
    // router.push(`/annotate/${videoId}`);
    window.open(`/annotate/${videoId}`);
    console.log("Selected Job:", metadata?.cvatID ?? taskID ?? null);
    //window.open(`http://localhost:8080/tasks/${metadata.cvatID}`, "_blank");
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full min-h-0">
        <div
          role="toolbar"
          aria-label="Analysis controls"
          className="bg-[#232323] w-[52px] h-full border-r border-[#0a0a0a] flex flex-col items-center py-2 gap-0"
        >
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            const isDisabled = Boolean(tool.disabled);
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    className={`w-full h-11 flex items-center justify-center text-[var(--ui-passive-text)] transition-colors ${
                      isDisabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-white/10 hover:text-slate-300"
                    } ${index === 0 ? "mt-2" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                    type="button"
                    aria-label={tool.label}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    tabIndex={index === 0 ? 0 : -1}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        const next = (index + 1) % tools.length;
                        (
                          e.currentTarget.parentElement?.parentElement?.querySelectorAll(
                            "button",
                          )[next] as HTMLButtonElement
                        )?.focus();
                        e.preventDefault();
                      } else if (e.key === "ArrowUp") {
                        const prev = (index - 1 + tools.length) % tools.length;
                        (
                          e.currentTarget.parentElement?.parentElement?.querySelectorAll(
                            "button",
                          )[prev] as HTMLButtonElement
                        )?.focus();
                        e.preventDefault();
                      }
                    }}
                    onClick={() => {
                      if (!isDisabled) {
                        tool.onClick?.();
                      }
                    }}
                  >
                    <Icon className="size-5" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{tool.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-[#111111]">
          <div
            className={`flex-1 px-4 py-3 ${
              activeWorkspace === "annotation"
                ? "flex min-h-0 flex-col overflow-hidden"
                : "overflow-y-auto"
            }`}
          >
            <div
              className={
                activeWorkspace === "annotation"
                  ? "flex min-h-0 flex-1 flex-col gap-3"
                  : "space-y-3 pb-4"
              }
            >
              {activeWorkspace === "annotation" && (
                <div className="flex min-h-0 flex-1 flex-col space-y-3 rounded border border-white/8 bg-[#151515] p-3 text-xs text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    Annotation tools
                  </div>
                  {activeAnnotationPlugin === "cvat" ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-white/10 bg-[#111111]">
                      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                          CVAT annotator
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 border-white/10 bg-transparent px-2 text-[10px] text-slate-300 hover:bg-white/5"
                          onClick={() => setActiveAnnotationPlugin("menu")}
                        >
                          Back
                        </Button>
                      </div>
                      <div className="min-h-[320px] flex-1 overflow-hidden">
                        <CvatPluginPanel
                          forcedVideoId={videoId}
                          compact
                          hideHeader
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded border border-white/10 bg-[#111111] p-3">
                      <div className="rounded border border-white/10 bg-[#151515] px-3 py-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-200">
                              Native annotation console
                            </div>
                            <div className="mt-1 text-[10px] leading-relaxed text-slate-500">
                              One entry point for manual annotations: choose the category in
                              the Video panel, draw the box, then review the saved cue in its
                              leaf and in Master Schema.
                            </div>
                          </div>
                          <div className="rounded border border-emerald-500/20 bg-emerald-950/10 px-2 py-0.5 text-[10px] text-emerald-100/80">
                            Active
                          </div>
                        </div>
                        <Button
                          type="button"
                          disabled={!videoId}
                          onClick={() => {
                            if (videoId) {
                              eventBus.emit("videoIdChanged", videoId);
                            }
                            openPanel("VideoPanel");
                            window.setTimeout(() => {
                              if (videoId) {
                                eventBus.emit("videoIdChanged", videoId);
                              }
                              eventBus.emit("nativeAnnotationOpen", null);
                            }, 40);
                          }}
                          className="w-full justify-start border border-white/10 bg-[#202020] text-slate-100 hover:bg-[#2a2a2a]"
                        >
                          Open native annotator
                        </Button>
                        <div className="mt-3 rounded border border-white/10 bg-[#111111] px-3 py-3">
                          <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                            Manual data governance leaf
                          </div>
                          <Select
                            onValueChange={(panelType) => {
                              const selectedLeaf = MANUAL_LEAF_NAV_OPTIONS.find(
                                (option) => option.panelType === panelType,
                              );
                              const panelProps = {
                                ...(selectedLeaf?.panelProps || {}),
                                ...(videoId ? { videoId } : {}),
                              };
                              if (videoId) {
                                eventBus.emit("videoIdChanged", videoId);
                              }
                              openPanel(panelType, panelProps);
                              if (videoId) {
                                window.setTimeout(() => {
                                  eventBus.emit("videoIdChanged", videoId);
                                }, 0);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 border-white/10 bg-[#171717] text-[11px] text-slate-200">
                              <SelectValue placeholder="Open manual leaf or Master Schema" />
                            </SelectTrigger>
                            <SelectContent className="border-white/12 bg-[#202020] text-slate-200">
                              <SelectItem value="MasterSchema">
                                Master Schema (all manual annotations)
                              </SelectItem>
                              {MANUAL_LEAF_NAV_OPTIONS.map((option) => (
                                <SelectItem
                                  key={`${option.category}-${option.panelType}`}
                                  value={option.panelType}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="rounded border border-white/10 bg-[#141414] px-3 py-3">
                        <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                          External annotation bridge
                        </div>
                      <Button
                        type="button"
                        disabled={!videoId || isPolling || isAnalyzing}
                        onClick={() => {
                          if (!videoId) return;
                          setActiveAnnotationPlugin("cvat");
                          if (!jobReady) {
                            void openTask();
                          }
                        }}
                        className="w-full justify-start border border-white/10 bg-[#202020] text-slate-200 hover:bg-[#2a2a2a]"
                      >
                        CVAT plugin
                      </Button>
                      </div>
                      <div className="rounded border border-dashed border-white/10 px-3 py-2 text-slate-600">
                        LLM annotation
                      </div>
                      <div className="rounded border border-dashed border-white/10 px-3 py-2 text-slate-600">
                        Atlas.ti
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeWorkspace === "visual" && (
                <div className="space-y-3 rounded border border-white/8 bg-[#151515] p-3 text-xs text-slate-300">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Visual cues
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Evidence-oriented review of cinematic patterns, motion, and scene structure.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                    {[
                      ["cinematic", "Cinematic clues"],
                      ["inspectors", "Cue inspectors"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`rounded border px-2 py-1 transition-colors ${
                          activeVisualView === key
                            ? "border-slate-500/60 bg-[#161616] text-slate-100"
                            : "border-white/10 bg-[#101010] text-slate-500 hover:bg-white/5 hover:text-slate-300"
                        }`}
                        onClick={() => setActiveVisualView(key as VisualWorkspaceView)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {activeVisualView === "cinematic" && (
                    <div className="rounded border border-white/8 bg-[#171717] px-3 py-3 text-[11px] text-slate-400">
                      <div className="mb-3 grid gap-2 md:grid-cols-2">
                        <ManualAnnotationLeafSection
                          title="Manual cinematic cues"
                          categoryTone="Analyst-added shot, framing, and cinematic evidence."
                          items={manualCinematicAnnotations}
                          videoId={videoId}
                        />
                        <ManualAnnotationLeafSection
                          title="Manual scene annotations"
                          categoryTone="Analyst scene calls alongside derived scene bands."
                          items={manualSceneAnnotations}
                          videoId={videoId}
                        />
                      </div>
                      {motionSceneBasis && (
                        <div className="mb-3 rounded-md border border-white/8 bg-[#151515] px-3 py-3">
                          <div className="mb-3 font-medium text-slate-200">
                            Motion and scene basis
                          </div>
                          <div className="mb-3 overflow-hidden rounded border border-white/8 bg-[#121212]">
                            <div className="grid gap-px bg-white/8 md:grid-cols-2">
                              <div className="bg-[#151515] px-3 py-2 text-[10px] text-slate-400">
                                <div className="uppercase tracking-wide text-slate-500">Reading</div>
                                <div className="mt-1 text-slate-200">Provisional derived basis</div>
                              </div>
                              <div className="bg-[#151515] px-3 py-2 text-[10px] text-slate-400">
                                <div className="uppercase tracking-wide text-slate-500">Density</div>
                                <div className="mt-1 text-slate-200">{sceneDensityLabel}</div>
                              </div>
                            </div>
                          </div>
                          <div className="mb-3 border-l-2 border-slate-700 pl-3 text-[10px] leading-relaxed text-slate-400">
                            {sceneBasisDescription}
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="overflow-hidden rounded border border-white/8 bg-[#141414]">
                              <div className="border-b border-white/8 px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500">
                                Motion evidence
                              </div>
                              <div className="space-y-3 px-3 py-3">
                                <div className="text-sm text-slate-200">
                                  {motionEvidenceSummary?.dominant_motion || "No dominant motion yet"}
                                </div>
                                <div className="overflow-hidden rounded border border-white/8 bg-[#121212]">
                                  <div className="divide-y divide-white/8 text-[10px] text-slate-400">
                                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                                      <span>Samples</span>
                                      <span className="text-slate-200">{motionEvidenceSummary?.sample_count ?? 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                                      <span>High-motion samples</span>
                                      <span className="text-slate-200">{motionEvidenceSummary?.high_motion_samples ?? 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                                      <span>Mean occupancy shift</span>
                                      <span className="text-slate-200">{motionEvidenceSummary?.mean_occupancy_shift ?? 0}</span>
                                    </div>
                                    {motionSceneBasis.motionEvidence?.method ? (
                                      <div className="px-3 py-2">
                                        <span className="text-slate-500">Method</span>
                                        <div className="mt-1 text-slate-300">{motionSceneBasis.motionEvidence.method}</div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="border-l-2 border-slate-700 pl-3 text-[10px] leading-relaxed text-slate-400">
                                  {motionBasisDescription}
                                </div>
                                {notableMotionMoments.length > 0 && (
                                  <div className="overflow-hidden rounded border border-white/8 bg-[#121212]">
                                    <div className="border-b border-white/8 px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500">
                                      Notable motion moments
                                    </div>
                                    <div className="divide-y divide-white/8 text-[10px] text-slate-300">
                                      {notableMotionMoments.map((sample, index) => (
                                        <button
                                          type="button"
                                          key={`motion-${sample.timestamp}-${index}`}
                                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-800/30"
                                          onClick={() => {
                                            eventBus.emit("videoIdChanged", videoId);
                                            eventBus.emit("videoTimeLineChanged", Number(sample.timestamp || 0));
                                          }}
                                        >
                                          <span className="truncate">
                                            {sample.motion_label || "unknown"} / {sample.activity_label || "unknown"}
                                          </span>
                                          <span className="shrink-0 text-slate-500">
                                            {formatSeconds(sample.timestamp)}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="overflow-hidden rounded border border-white/8 bg-[#141414]">
                              <div className="border-b border-white/8 px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500">
                                Scene basis
                              </div>
                              <div className="space-y-3 px-3 py-3">
                                <div className="text-sm text-slate-200">
                                  {sceneSegmentSummary?.scene_count ?? 0} scene intervals
                                </div>
                                <div className="overflow-hidden rounded border border-white/8 bg-[#121212]">
                                  <div className="divide-y divide-white/8 text-[10px] text-slate-400">
                                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                                      <span>Merged review bands</span>
                                      <span className="text-slate-200">{mergedSceneSegments.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                                      <span>Mean scene duration</span>
                                      <span className="text-slate-200">{formatSeconds(sceneSegmentSummary?.mean_scene_duration)}</span>
                                    </div>
                                    {motionSceneBasis.sceneSegments?.source ? (
                                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                                        <span>Source</span>
                                        <span className="text-slate-200">{motionSceneBasis.sceneSegments.source}</span>
                                      </div>
                                    ) : null}
                                    {motionSceneBasis.sceneSegments?.method ? (
                                      <div className="px-3 py-2">
                                        <span className="text-slate-500">Method</span>
                                        <div className="mt-1 text-slate-300">{motionSceneBasis.sceneSegments.method}</div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                {mergedScenePreview.length > 0 && (
                                  <div className="overflow-hidden rounded border border-white/8 bg-[#121212]">
                                    <div className="border-b border-white/8 px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500">
                                      Opening scene bands
                                    </div>
                                    <div className="divide-y divide-white/8 text-[10px] text-slate-300">
                                      {mergedScenePreview.map((segment) => (
                                        <button
                                          type="button"
                                          key={`scene-${segment.scene_index}-${segment.start}-${segment.end}`}
                                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-800/30"
                                          onClick={() => {
                                            eventBus.emit("videoIdChanged", videoId);
                                            eventBus.emit("videoTimeLineChanged", Number(segment.start || 0));
                                          }}
                                        >
                                          <span className="truncate">
                                            Scene {segment.scene_index}
                                            {segment.mergedCount > 1 ? ` • merged x${segment.mergedCount}` : ""}
                                          </span>
                                          <span className="shrink-0 text-slate-500">
                                            {formatSeconds(segment.start)}-{formatSeconds(segment.end)}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {cinematicTimelineSections.length > 0 ? (
                        <div className="rounded-md border border-white/8 bg-[#141414] px-2 py-2">
                          <div className="max-h-none space-y-2 overflow-visible pr-1">
                            {cinematicTimelineSections.map((section) => (
                              <Collapsible
                                key={section.key}
                                open={Boolean(openCinematicSections[section.key])}
                                onOpenChange={(nextOpen) =>
                                  setOpenCinematicSections((previous) => ({
                                    ...previous,
                                    [section.key]: nextOpen,
                                  }))
                                }
                              >
                                <CollapsibleTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between rounded border border-white/8 bg-[#191919] px-2 py-2 text-left text-[11px] text-slate-300 transition-colors hover:text-slate-100"
                                  >
                                    <span>{section.label}</span>
                                    <span className="text-slate-500">
                                      {openCinematicSections[section.key] ? "-" : "+"}
                                    </span>
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-1 space-y-1">
                                  {section.key === "shot-size" ? (
                                    <div className="mb-2 rounded border border-white/8 bg-[#161616] px-2 py-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Select
                                          key={shotAdditionSelectKey}
                                          onValueChange={(value) => {
                                            void saveCinematicShotAddition(value);
                                          }}
                                        >
                                          <SelectTrigger className="h-7 w-[170px] border-white/8 bg-[#1a1a1a] text-[10px] text-slate-400">
                                            <SelectValue placeholder="Add shot size" />
                                          </SelectTrigger>
                                          <SelectContent className="border-white/12 bg-[#202020] text-slate-200">
                                            {CINEMATIC_SHOT_SIZE_OPTIONS.map((option) => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.1"
                                          value={pendingShotSizeTimestamp}
                                          onChange={(event) =>
                                            setPendingShotSizeTimestamp(event.target.value)
                                          }
                                          className="h-7 w-[92px] border-white/8 bg-[#1a1a1a] px-2 text-[10px] text-slate-400"
                                          placeholder="0.0"
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                  {section.entries.map((entry, index) => (
                                    <div
                                      key={`${section.key}-${entry.start}-${entry.end}-${index}`}
                                      className="flex items-start gap-2"
                                    >
                                      {(() => {
                                        const entryId = cinematicEntryId(entry);
                                        const hasDropdownOptions = entry.key === "shot-size";
                                        const correctionOpen =
                                          activeCinematicCorrectionId === entryId;
                                        return (
                                          <>
                                      <button
                                        type="button"
                                        className="flex min-w-0 flex-1 items-start justify-between rounded border border-white/8 bg-[#191919] px-2 py-1 text-left text-[11px] text-slate-300 transition-colors hover:text-slate-100"
                                        onClick={() => openVideoAtTime(entry.start)}
                                      >
                                        <span className="min-w-0 truncate pr-2">
                                          {index + 1}. {getCorrectedCinematicEntry(entry)}
                                        </span>
                                        <span className="ml-3 shrink-0 text-slate-500">
                                          {entry.start}s-{entry.end}s
                                        </span>
                                      </button>
                                      {hasDropdownOptions ? (
                                        correctionOpen ? (
                                          <div className="flex shrink-0 items-center gap-2">
                                            <Select
                                              open={correctionOpen}
                                              onOpenChange={(nextOpen) => {
                                                if (!nextOpen) {
                                                  setActiveCinematicCorrectionId(null);
                                                  setActiveCinematicCorrectionValue("");
                                                }
                                              }}
                                              value={activeCinematicCorrectionValue}
                                              onValueChange={(value) => {
                                                setActiveCinematicCorrectionValue(value);
                                                void saveCinematicCorrection(entry, value);
                                              }}
                                            >
                                              <SelectTrigger className="h-8 w-[190px] border-white/12 bg-[#202020] text-[11px] text-slate-200">
                                                <SelectValue placeholder="Select correction" />
                                              </SelectTrigger>
                                              <SelectContent className="border-white/12 bg-[#202020] text-slate-200">
                                                {CINEMATIC_SHOT_SIZE_OPTIONS.map((option) => (
                                                  <SelectItem key={option} value={option}>
                                                    {option}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            className="shrink-0 rounded border border-white/8 bg-[#191919] px-2 py-1 text-[10px] text-slate-400 transition-colors hover:text-slate-100"
                                            onClick={() => {
                                              setActiveCinematicCorrectionId(entryId);
                                              setActiveCinematicCorrectionValue(
                                                getCorrectedCinematicEntry(entry),
                                              );
                                            }}
                                          >
                                            Correct
                                          </button>
                                        )
                                      ) : (
                                        <button
                                          type="button"
                                          className="shrink-0 rounded border border-white/8 bg-[#191919] px-2 py-1 text-[10px] text-slate-400 transition-colors hover:text-slate-100"
                                          onClick={() => saveCinematicCorrection(entry)}
                                        >
                                          Correct
                                        </button>
                                      )}
                                      {entry.origin === "analyst-added" ? (
                                        <button
                                          type="button"
                                          className="shrink-0 rounded border border-red-500/20 bg-[#191919] px-2 py-1 text-[10px] text-red-300/80 transition-colors hover:text-red-200"
                                          onClick={() => {
                                            void deleteCinematicShotAddition(entry);
                                          }}
                                        >
                                          Delete
                                        </button>
                                      ) : null}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  ))}
                                </CollapsibleContent>
                              </Collapsible>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-md border border-white/8 bg-[#141414] px-3 py-2 text-[11px] text-slate-500">
                          No cinematic clue record available for this analysis yet.
                        </div>
                      )}
                    </div>
                  )}
                  {activeVisualView === "inspectors" && (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <ManualAnnotationLeafSection
                          title="Manual action annotations"
                          categoryTone="Analyst-observed actions and event beats."
                          items={manualActionAnnotations}
                          videoId={videoId}
                        />
                        <ManualAnnotationLeafSection
                          title="Manual identification annotations"
                          categoryTone="Identity and role evidence kept separate from object detections."
                          items={manualIdentificationAnnotations}
                          videoId={videoId}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                    {[
                      ["shot", "Shot size"],
                      ["frame", "Frame class"],
                      ["spatial", "Spatial scan"],
                      ["text", "Text/graphic"],
                      ["human", "Human presence"],
                      ["margin", "Margin scan"],
                      ["corner", "Corner scan"],
                      ["depth", "Depth scan"],
                      ["lighting", "Lighting"],
                      ["color", "Color regime"],
                      ["clutter", "Visual clutter"],
                      ["motion", "Motion scan"],
                      ["transition", "Transition scan"],
                      ["tone", "Tone scan"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className="rounded border border-white/8 bg-[#171717] px-2 py-1 transition-colors hover:text-slate-200"
                        disabled={!videoId}
                        onClick={() => {
                          if (!videoId) return;
                          eventBus.emit("videoIdChanged", videoId);
                          openPanel("VideoPanel");
                          window.setTimeout(() => {
                            eventBus.emit("videoIdChanged", videoId);
                            eventBus.emit("visualCueOpen", key);
                          }, 40);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                    </div>
                  )}
                </div>
              )}

              {(activeWorkspace === "analysis" || activeWorkspace === "morphology") && (
              <div className="space-y-3 rounded-md border border-white/10 bg-[#1b1b1b] p-3">
                <div className="space-y-1">
                  <Label htmlFor="analysis-tier">Analysis tier</Label>
                  <Select
                    value={analysisTier}
                    onValueChange={(
                      value: "quick_sweep" | "science_scan" | "forensic_sensor",
                    ) => setAnalysisTier(value)}
                    disabled={isAnalyzing || !videoId}
                  >
                    <SelectTrigger
                      id="analysis-tier"
                      className={selectSurfaceClassName}
                    >
                      <SelectValue placeholder="Choose analysis tier" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                      <SelectItem value="quick_sweep">
                        Quick sweep
                      </SelectItem>
                      <SelectItem value="science_scan">
                        Science scan
                      </SelectItem>
                      <SelectItem value="forensic_sensor">
                        Forensic sensor
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400">
                    Quick sweep is a transcript-led scout mode and currently skips
                    the heavy visual sweep. Science scan is the main research mode,
                    and Forensic sensor keeps the densest temporal sweep.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="modality-focus">Modality focus</Label>
                  <Select
                    value={modalityFocus}
                    onValueChange={(
                      value: "multimodal" | "graphics" | "audio" | "images" | "text",
                    ) => setModalityFocus(value)}
                    disabled={isAnalyzing || !videoId}
                  >
                    <SelectTrigger
                      id="modality-focus"
                      className={selectSurfaceClassName}
                    >
                      <SelectValue placeholder="Choose modality focus" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                      <SelectItem value="multimodal">Multimodal</SelectItem>
                      <SelectItem value="graphics">Graphics</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                      <SelectItem value="images">Images</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400">
                    Use this to emphasize the material type the researcher wants to
                    work with, instead of forcing a full sweep every time.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="morphology-pack-policy">
                    Morphology regime
                  </Label>
                  <Select
                    value={morphologyPackPolicy}
                    onValueChange={(value: MorphologyPackPolicy) =>
                      setMorphologyPackPolicy(value)
                    }
                    disabled={isAnalyzing || !videoId}
                  >
                    <SelectTrigger
                      id="morphology-pack-policy"
                      className={selectSurfaceClassName}
                    >
                      <SelectValue placeholder="Choose morphology pack policy" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                      {MORPHOLOGY_PACK_POLICY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400">
                    English remains fixed. Additional morphology slots can be
                    assigned per run as needed.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {[0, 1].map((index) => (
                    <div key={index} className="space-y-1">
                      <Label htmlFor={`morphology-language-${index}`}>
                        Morphology slot {index + 1}
                      </Label>
                      <Select
                        value={morphologyLanguages[index] || ""}
                        onValueChange={(value: string) =>
                          updateMorphologyLanguage(index, value)
                        }
                        disabled={
                          isAnalyzing ||
                          !videoId ||
                          index >= morphologySlotLimit
                        }
                      >
                        <SelectTrigger
                          id={`morphology-language-${index}`}
                          className={selectSurfaceClassName}
                        >
                          <SelectValue
                            placeholder={
                              index < morphologySlotLimit
                                ? "Choose a language"
                                : "Slot not active"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className={selectContentClassName}>
                          {MORPHOLOGY_LANGUAGE_OPTIONS.map((option) => (
                            <SelectItem key={option.code} value={option.code}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="special-use-morphology-language">
                    Special-use morphology record
                  </Label>
                  <Input
                    id="special-use-morphology-language"
                    value={specialUseMorphologyLanguage}
                    onChange={(event) =>
                      setSpecialUseMorphologyLanguage(event.target.value)
                    }
                    disabled={isAnalyzing || !videoId}
                    className="w-full max-w-[260px] border-white/12 bg-[#202020] text-slate-200 placeholder:text-slate-500"
                    placeholder="e.g. Ukrainian, Arabic, Hindi"
                  />
                  <p className="text-xs text-slate-400">
                    Record a special-use morphology request that may sit outside
                    the active slot count.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="rough-interpretation-switch">
                      Rough interpretation
                    </Label>
                    <p className="text-xs text-slate-400">
                      Lexical fallback remains available for unsupported
                      languages when this record is enabled.
                    </p>
                  </div>
                  <Switch
                    id="rough-interpretation-switch"
                    checked={allowRoughInterpretation}
                    onCheckedChange={setAllowRoughInterpretation}
                    disabled={isAnalyzing || !videoId}
                    aria-label="Allow rough interpretation fallback"
                  />
                </div>

                <Collapsible
                  open={showMorphologyRecords}
                  onOpenChange={setShowMorphologyRecords}
                >
                  <div
                    ref={morphologySectionRef}
                    className="rounded-md border border-white/8 bg-[#171717] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm text-slate-200">
                          Morphology catalog
                        </div>
                        <div className="text-xs text-slate-500">
                          Search, local availability, and slot assignment.
                        </div>
                      </div>
                      <CollapsibleTrigger className="text-xs text-slate-500 transition-colors hover:text-slate-200">
                        {showMorphologyRecords ? "hide" : "catalog"}
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="space-y-2 pt-3">
                      <Input
                        id="morphology-search"
                        value={morphologySearch}
                        onChange={(event) => setMorphologySearch(event.target.value)}
                        disabled={isAnalyzing || morphologyCatalogLoading}
                        className="w-full max-w-[320px] border-white/12 bg-[#202020] text-slate-200 placeholder:text-slate-500"
                        placeholder="Search Finnish, Arabic, Japanese, zh..."
                      />

                      {morphologyCatalogError && (
                        <div className="text-xs text-amber-300">
                          Catalog record: {morphologyCatalogError}
                        </div>
                      )}

                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {filteredMorphologyCatalog.slice(0, 12).map((item) => (
                          <div
                            key={item.code}
                            className="rounded border border-white/8 bg-[#141414] px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <div className="text-sm text-slate-200">
                                  {item.name}
                                  <span className="ml-2 text-xs text-slate-500">
                                    {item.code}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {describeMorphologyStatus(item)}
                                  {item.spacy_model ? ` • ${item.spacy_model}` : ""}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  POS target {item.target_support?.pos || "limited"}
                                  {item.is_eu_official ? " • EU" : ""}
                                  {item.is_un_official ? " • UN" : ""}
                                  {item.is_recommended_extra ? " • extra" : ""}
                                </div>
                              </div>

                              <div className="flex shrink-0 gap-2 text-[11px] text-slate-400">
                                <button
                                  type="button"
                                  className="transition-colors hover:text-slate-200"
                                  onClick={() => placeMorphologyLanguage(item.code, "slot_1")}
                                  disabled={isAnalyzing || !videoId || morphologySlotLimit < 1}
                                >
                                  slot 1
                                </button>
                                <button
                                  type="button"
                                  className="transition-colors hover:text-slate-200"
                                  onClick={() => placeMorphologyLanguage(item.code, "slot_2")}
                                  disabled={isAnalyzing || !videoId || morphologySlotLimit < 2}
                                >
                                  slot 2
                                </button>
                                <button
                                  type="button"
                                  className="transition-colors hover:text-slate-200"
                                  onClick={() => placeMorphologyLanguage(item.code, "special")}
                                  disabled={isAnalyzing || !videoId}
                                >
                                  special
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {!morphologyCatalogLoading &&
                          filteredMorphologyCatalog.length === 0 && (
                            <div className="text-xs text-slate-500">
                              No morphology records matched that search.
                            </div>
                          )}
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Search and slot exchange are available here. Pack installation
                        and feed-repair APIs remain the next layer.
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>
              )}

              {activeWorkspace === "face" && (
              <Collapsible open={showFaceRecords} onOpenChange={setShowFaceRecords}>
                <div
                  ref={faceSectionRef}
                  className="rounded-md border border-white/10 bg-[#1b1b1b] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm text-slate-200">Face records</div>
                      <div className="text-xs text-slate-500">
                        Sampling, anonymization, and person-gate settings.
                      </div>
                    </div>
                    <CollapsibleTrigger className="text-xs text-slate-500 transition-colors hover:text-slate-200">
                      {showFaceRecords ? "hide" : "records"}
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="face-anonymization-switch">
                          Face anonymization
                        </Label>
                        <p className="text-xs text-slate-400">
                          Sampled face frames can be anonymized when this record is
                          enabled.
                        </p>
                      </div>
                      <Switch
                        id="face-anonymization-switch"
                        checked={applyFaceAnonymization}
                        onCheckedChange={setApplyFaceAnonymization}
                        disabled={isAnalyzing || !videoId}
                        aria-label="Enable face anonymization"
                      />
                    </div>

                    <div className="space-y-1">
                  <Label htmlFor="face-message-style">Face message style</Label>
                  <Select
                    value={faceMessageStyle}
                    onValueChange={(value: "plain" | "starfleet") =>
                      setFaceMessageStyle(value)
                    }
                    disabled={isAnalyzing || !videoId}
                  >
                    <SelectTrigger
                      id="face-message-style"
                      className="w-full max-w-[220px] border-white/12 bg-[#202020] text-slate-200 data-[placeholder]:text-slate-400"
                    >
                      <SelectValue placeholder="Choose a style" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClassName}>
                      <SelectItem value="plain">Plain</SelectItem>
                      <SelectItem value="starfleet">Engage</SelectItem>
                    </SelectContent>
                  </Select>
                      <p className="text-xs text-slate-400">
                        This record changes the human-facing tone only, not the
                        technical face analysis.
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="face-person-gate-switch">
                          Require YOLO person detection
                        </Label>
                        <p className="text-xs text-slate-400">
                          Face analysis is limited to frames where object detection
                          already records a person.
                        </p>
                      </div>
                      <Switch
                        id="face-person-gate-switch"
                        checked={faceRequiresPersonDetection}
                        onCheckedChange={setFaceRequiresPersonDetection}
                        disabled={isAnalyzing || !videoId}
                        aria-label="Require person detection before face analysis"
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
              )}

              {(activeWorkspace === "analysis" ||
                activeWorkspace === "language" ||
                activeWorkspace === "mission") && (
              <div className="space-y-1 rounded-md border border-white/10 bg-[#151515] p-3 text-xs text-slate-300">
                <div>
                  Analysis setup: {analysisTierLabel}, {modalityFocusLabel}, {morphologyPackLabel}.
                </div>
                <div>
                  Morphology languages: English
                  {selectedMorphologyLanguageLabels.length
                    ? ` + ${selectedMorphologyLanguageLabels.join(", ")}`
                    : ""}
                  {specialUseMorphologyLanguage
                    ? `; special-use ${specialUseMorphologyLanguage}`
                    : ""}
                  . Rough interpretation {allowRoughInterpretation ? "on" : "off"}.
                </div>
                <div>
                  Current face settings: anonymization{" "}
                  {applyFaceAnonymization ? "on" : "off"}, style{" "}
                  {faceMessageStyle === "starfleet" ? "Engage" : "Plain"}, person
                  gate {faceRequiresPersonDetection ? "on" : "off"}.
                </div>
                {metadata?.uploadedAt && <div>Uploaded: {metadata.uploadedAt}</div>}
                {metadata?.analysisStartedAt && (
                  <div>Analysis started: {metadata.analysisStartedAt}</div>
                )}
                {metadata?.analysisCompletedAt && (
                  <div>Analysis completed: {metadata.analysisCompletedAt}</div>
                )}
                {stageLabel && <div>Mission stage: {stageLabel}.</div>}
                {metadata?.missionMessage && (
                  <div>Captain&apos;s log: {metadata.missionMessage}</div>
                )}
                {metadata?.sourceVideoExists === false && metadata?.sourceVideoMessage && (
                  <div className="text-amber-300">
                    Media note: {metadata.sourceVideoMessage}
                  </div>
                )}
                {blobMissing && metadata?.status === "completed" && (
                  <div>
                    Reopened from saved analysis. Preview video is not stored in this
                    browser, but results and downloads are available.
                  </div>
                )}
                {analysisData?.metadata?.faceFramesConsidered !== undefined && (
                  <div>
                    Face frame sampling: {analysisData.metadata.faceFramesSelected ?? 0}
                    {" / "}
                    {analysisData.metadata.faceFramesConsidered ?? 0} selected
                    {analysisData.metadata.faceFramesSkippedNoPerson !== undefined &&
                      `, ${analysisData.metadata.faceFramesSkippedNoPerson} skipped without person`}
                    .
                  </div>
                )}
                {analysisData?.metadata?.expressionSamples !== undefined && (
                  <div>
                    Expression samples: {analysisData.metadata.expressionSamples ?? 0}
                    {analysisData.metadata.expressionStatus &&
                      ` (${analysisData.metadata.expressionStatus})`}
                    {analysisData.metadata.expressionError &&
                      `, last error: ${analysisData.metadata.expressionError}`}
                    .
                  </div>
                )}
                {analysisData?.metadata?.audioError && (
                  <div>Audio channel note: {analysisData.metadata.audioError}</div>
                )}
                {analysisData?.metadata?.posError && (
                  <div>Linguistic station note: {analysisData.metadata.posError}</div>
                )}
                {analysisData?.metadata?.quantError && (
                  <div>Quant lens note: {analysisData.metadata.quantError}</div>
                )}
              </div>
              )}

              {activeWorkspace === "language" &&
              (analysisData?.metadata?.audioLanguage ||
                analysisData?.metadata?.languageProfile ||
                analysisData?.metadata?.languageSupport) && (
                <Collapsible
                  open={showLanguageRecords}
                  onOpenChange={setShowLanguageRecords}
                >
                  <div
                    ref={languageSectionRef}
                    className="rounded-md border border-white/10 bg-[#151515] p-3 text-xs text-slate-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-200">Language records</div>
                        <div className="text-[11px] text-slate-500">
                          Detection, profile, and support notes.
                        </div>
                      </div>
                      <CollapsibleTrigger className="text-xs text-slate-500 transition-colors hover:text-slate-200">
                        {showLanguageRecords ? "hide" : "records"}
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-2 pt-3">
                      {analysisData?.metadata?.audioLanguage && (
                        <div>
                          Audio record:{" "}
                          {analysisData.metadata.audioLanguageName ??
                            analysisData.metadata.audioLanguage}
                          {analysisData.metadata.audioLanguage &&
                            analysisData.metadata.audioLanguageName &&
                            ` (${analysisData.metadata.audioLanguage})`}
                          {analysisData.metadata.audioLanguageSource &&
                            ` via ${analysisData.metadata.audioLanguageSource}`}
                          {analysisData.metadata.audioLanguageConfidence !== undefined &&
                            `, confidence ${analysisData.metadata.audioLanguageConfidence}`}
                          .
                        </div>
                      )}
                      {analysisData?.metadata?.languageProfile && (
                        <div>
                          Profile record:{" "}
                          {analysisData.metadata.languageProfile.name ??
                            analysisData.metadata.languageProfile.code ??
                            "unknown"}
                          {analysisData.metadata.languageProfile.code &&
                            analysisData.metadata.languageProfile.name &&
                            ` (${analysisData.metadata.languageProfile.code})`}
                          {analysisData.metadata.languageProfile.source &&
                            ` via ${analysisData.metadata.languageProfile.source}`}
                          {analysisData.metadata.languageProfile.confidence !==
                            undefined &&
                            `, confidence ${analysisData.metadata.languageProfile.confidence}`}
                          .
                        </div>
                      )}
                      {analysisData?.metadata?.languageSupport && (
                        <div>
                          Support record: Quant{" "}
                          {analysisData.metadata.languageSupport.quant ?? "unknown"},
                          POS {analysisData.metadata.languageSupport.pos ?? "unknown"},
                          future discourse{" "}
                          {analysisData.metadata.languageSupport.future_discourse ??
                            "unknown"}
                          .
                        </div>
                      )}
                      {analysisData?.metadata?.languageSupport?.registry_target_support && (
                        <div>
                          Target record: Quant{" "}
                          {analysisData.metadata.languageSupport
                            .registry_target_support.quant ?? "unknown"}
                          , POS{" "}
                          {analysisData.metadata.languageSupport
                            .registry_target_support.pos ?? "unknown"}
                          , future discourse{" "}
                          {analysisData.metadata.languageSupport
                            .registry_target_support.future_discourse ?? "unknown"}
                          .
                        </div>
                      )}
                      {analysisData?.metadata?.languageSupport?.regional_varieties
                        ?.length ? (
                        <div>
                          Varieties:{" "}
                          {analysisData.metadata.languageSupport.regional_varieties.join(
                            ", ",
                          )}
                          .
                        </div>
                      ) : null}
                      {analysisData?.metadata?.languageSupport?.notes?.length ? (
                        <div>
                          Notes: {analysisData.metadata.languageSupport.notes.join(" ")}
                        </div>
                      ) : null}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {activeWorkspace === "mission" && missionLog.length > 0 && (
                <Collapsible
                  open={showMissionRecords}
                  onOpenChange={setShowMissionRecords}
                >
                  <div
                    ref={missionSectionRef}
                    className="rounded-md border border-white/10 bg-[#151515] p-3 text-xs text-slate-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-200">Mission records</div>
                        <div className="text-[11px] text-slate-500">
                          Recent analysis events and progress notes.
                        </div>
                      </div>
                      <CollapsibleTrigger className="text-xs text-slate-500 transition-colors hover:text-slate-200">
                        {showMissionRecords ? "hide" : "records"}
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-2 pt-3">
                      {missionLog.map((entry: AnalysisEvent, index: number) => (
                        <div
                          key={`${entry.timestamp}-${entry.event_type}-${index}`}
                          className="rounded border border-white/5 bg-black/10 px-2 py-2"
                        >
                          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                            <span>{entry.event_type.replace(/_/g, " ")}</span>
                            <span>{formatLogTimestamp(entry.timestamp)}</span>
                          </div>
                          {entry.mission_message && (
                            <div className="mt-1 text-slate-200">
                              {entry.mission_message}
                            </div>
                          )}
                          {(entry.progress !== undefined || entry.mission_stage) && (
                            <div className="mt-1 text-[11px] text-slate-500">
                              {entry.progress !== undefined
                                ? `Progress ${entry.progress}%`
                                : "Progress unknown"}
                              {entry.mission_stage && ` • ${entry.mission_stage}`}
                            </div>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {activeWorkspace === "expression" &&
              Number(analysisData?.expressionResults?.length ?? 0) > 0 && (
                <Collapsible
                  open={showExpressionRecords}
                  onOpenChange={setShowExpressionRecords}
                >
                <div className="rounded-md border border-white/10 bg-[#151515] p-3 text-xs text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-200">Expression records</div>
                      <div className="text-[11px] text-slate-500">
                        Aggregate and preview samples.
                      </div>
                    </div>
                    <CollapsibleTrigger className="text-xs text-slate-500 transition-colors hover:text-slate-200">
                      {showExpressionRecords ? "hide" : "records"}
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="space-y-2 pt-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Preview depth</span>
                      <span>{expressionPreviewCount[0]} frames</span>
                    </div>
                    <Slider
                      value={expressionPreviewCount}
                      min={1}
                      max={Math.min(
                        12,
                        Math.max(1, Number(analysisData?.expressionResults?.length ?? 1)),
                      )}
                      step={1}
                      onValueChange={setExpressionPreviewCount}
                      aria-label="Expression preview depth"
                    />
                  </div>
                  {expressionAggregate.length > 0 && (
                    <div>
                      Aggregate:{" "}
                      {expressionAggregate
                        .map(([emotion, count]) => `${emotion}: ${count}`)
                        .join(", ")}
                      .
                    </div>
                  )}
                  <div className="space-y-1">
                    {expressionTimeline.map((sample: ExpressionSample, index: number) => (
                      <div key={`${sample.timestamp}-${sample.face_id ?? index}`}>
                        {sample.timestamp.toFixed(1)}s - {sample.dominant_emotion}
                      </div>
                    ))}
                  </div>
                  </CollapsibleContent>
                </div>
                </Collapsible>
              )}

              {activeWorkspace === "language" &&
                !analysisData?.metadata?.audioLanguage &&
                !analysisData?.metadata?.languageProfile &&
                !analysisData?.metadata?.languageSupport && (
                  <div className="rounded-md border border-white/10 bg-[#151515] p-3 text-xs text-slate-500">
                    No language records are available for this analysis yet.
                  </div>
                )}

              {activeWorkspace === "mission" && missionLog.length === 0 && (
                <div className="rounded-md border border-white/10 bg-[#151515] p-3 text-xs text-slate-500">
                  No mission records are available for this analysis yet.
                </div>
              )}

              {activeWorkspace === "expression" &&
                !(Number(analysisData?.expressionResults?.length ?? 0) > 0) && (
                  <div className="rounded-md border border-white/10 bg-[#151515] p-3 text-xs text-slate-500">
                    No expression records are available for this analysis yet.
                  </div>
                )}
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#151515] px-4 py-3">
            {isAnalyzing && (
              <div className="mb-3">
                <div className="text-sm text-slate-400">
                  {stageLabel ? `${stageLabel}: ` : "Analysis in progress: "}
                  {analysisProgress}%
                </div>
                {metadata?.missionMessage && (
                  <div className="mt-1 text-xs text-slate-500">
                    {metadata.missionMessage}
                  </div>
                )}
                <div className="mt-1 h-2 w-full rounded-full bg-slate-700">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500">
              Analysis launch now lives in the Project panel at the source row.
              Tools remains available for records, catalog work, and auxiliary
              configuration.
            </div>

            {jobReady && !isPolling && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="default"
                  className="bg-green-600/40 hover:bg-green-600/60 transition"
                  onClick={handleJobClick}
                  disabled={isAnalyzing || !videoId}
                >
                  Annotate
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-white/8 bg-[#141414] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-passive-text)]">
              Analysis Desk
            </div>
            <div className="mt-1 text-sm text-[var(--ui-passive-text)]">
              {metadata?.name
                ? `Current analysis: ${metadata.name}`
                : videoId
                  ? "Current analysis selected"
                  : "No analysis selected"}
            </div>
            {videoId && (
              <div className="mt-1 text-xs text-slate-500">
                Reference: <span className="font-mono">{videoId}</span>
              </div>
            )}
            <div className="mt-2 text-xs text-slate-500">
              {activeWorkspace === "annotation"
                ? "Choose an annotation method from Annotation tools. CVAT is currently the optional manual visual annotation plugin."
                : "Use Annotation workspace when you want to add optional manual annotation plugins alongside the core VAA1 workflow."}
            </div>
            <div className="mt-3 max-w-[240px]">
              <Select
                value={activeWorkspace}
                onValueChange={(value) =>
                  activateWorkspaceSection(value as ToolsWorkspace)
                }
              >
                <SelectTrigger className={selectSurfaceClassName}>
                  <SelectValue placeholder="Tools menu" />
                </SelectTrigger>
                <SelectContent className={selectContentClassName}>
                  {workspaceOptions.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
