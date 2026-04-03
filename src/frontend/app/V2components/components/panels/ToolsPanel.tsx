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
import type { AnalysisEvent, MorphologyCatalogItem } from "@/lib/api-service";
import { getVideoBlob } from "@/lib/blob-store";
import { listJobs } from "@/cvat-api/client";

import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { useLayoutHost } from "../LayoutHost";

type ToolsWorkspace =
  | "analysis"
  | "visual"
  | "morphology"
  | "face"
  | "language"
  | "mission"
  | "expression";

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
      const targets: Record<string, () => void> = {
        analysis: () => {
          setActiveWorkspace("analysis");
        },
        visual: () => {
          setActiveWorkspace("visual");
        },
        morphology: () => {
          setActiveWorkspace("morphology");
          setShowMorphologyRecords(true);
          window.setTimeout(() => {
            morphologySectionRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 80);
        },
        face: () => {
          setActiveWorkspace("face");
          setShowFaceRecords(true);
          window.setTimeout(() => {
            faceSectionRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 80);
        },
        language: () => {
          setActiveWorkspace("language");
          setShowLanguageRecords(true);
          window.setTimeout(() => {
            languageSectionRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 80);
        },
        mission: () => {
          setActiveWorkspace("mission");
          setShowMissionRecords(true);
          window.setTimeout(() => {
            missionSectionRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 80);
        },
        expression: () => {
          setActiveWorkspace("expression");
          setShowExpressionRecords(true);
        },
      };

      targets[section]?.();
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
          !(analysisData?.detectedObjects?.length > 0)),
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
          !(analysisData?.ocr?.length > 0)),
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
          !(analysisData?.expressionResults?.length > 0)),
    },
    {
      icon: ScanEye,
      label: "Annotations",
      onClick: () => {
        if (!videoId) return;
        if (jobReady) {
          handleJobClick();
        } else {
          openTask();
        }
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

    // Update internal state (won’t be immediately available, but that's fine)
    setTaskId(cvatID);

    console.log(`📂 Opening CVAT task ${cvatID}...`);

    // 2️⃣ Poll for jobs
    let attempts = 0;
    const maxAttempts = 60;

    async function pollJobs() {
      try {
        const result = await listJobs(cvatID);
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
    console.log("Selected Job:", metadata.cvatID);
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
          <div className="border-b border-white/10 px-4 py-3">
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
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
              {[
                ["analysis", "Analysis setup"],
                ["visual", "Visual cues"],
                ["morphology", "Morphology catalog"],
                ["face", "Face records"],
                ["language", "Language records"],
                ["mission", "Mission records"],
                ["expression", "Expression records"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`rounded border px-2 py-1 transition-colors ${
                    activeWorkspace === key
                      ? "border-slate-500 bg-slate-800/70 text-slate-200"
                      : "border-white/8 bg-[#171717] text-slate-500 hover:text-slate-300"
                  }`}
                  onClick={() => setActiveWorkspace(key as ToolsWorkspace)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3 pb-4">
              {activeWorkspace === "visual" && (
                <div className="space-y-3 rounded-md border border-white/10 bg-[#1b1b1b] p-3 text-xs text-slate-300">
                  <div>
                    <div className="font-medium text-slate-200">Visual cues</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Open a particular cue in the Video panel when you need to inspect an underlying visual indication.
                    </div>
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
                  <div className="text-[11px] text-slate-500">
                    These cues remain provisional. Use them for checking and confirmation rather than final interpretive claims.
                  </div>
                  <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-100/85">
                    Visual cues note: this tool needs a thorough check-up and calibration session.
                    The cues should participate in an active feedback loop so they can become more
                    accurate and indicative over time. A broader triangulation principle may be needed
                    across the program, so these signals are checked against other evidence rather than
                    treated as standalone truth.
                  </div>
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
              analysisData?.expressionResults?.length > 0 && (
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
                      max={Math.min(12, analysisData.expressionResults.length)}
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
                !(analysisData?.expressionResults?.length > 0) && (
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
        </div>
      </div>
    </TooltipProvider>
  );
}
