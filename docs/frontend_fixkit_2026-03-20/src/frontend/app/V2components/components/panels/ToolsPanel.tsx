"use client";

import {
  MessageSquareText,
  Brain,
  View,
  ScanEye,
  ChartScatter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";
import { listJobs, listTasks } from "@/cvat-api/client";

import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { useLayoutHost } from "../LayoutHost";

export default function ToolsPanel() {
  const { openPanel } = useLayoutHost();
  const [applyFaceAnonymization, setApplyFaceAnonymization] = useState(false);
  const [faceMessageStyle, setFaceMessageStyle] = useState<
    "plain" | "starfleet"
  >("plain");
  const [faceRequiresPersonDetection, setFaceRequiresPersonDetection] =
    useState(false);

  const [videoId, setVideoId] = useState("");

  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);

  const lastObjectUrl = React.useRef<string | null>(null);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);

  // CVAT task/job state
  const [jobs, setJobs] = useState<any[]>([]);
  const [taskID, setTaskId] = useState<any>();
  const [jobReady, setJobReady] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);

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
    async function load() {
      if (!videoId) {
        setIsLoading(false);
        return;
      }

      // Clear any existing polling interval when switching videos
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      setIsLoading(true);

      try {
        // Load metadata
        const m = await VideoService.get(videoId);

        console.log("Loaded metadata:", m);

        setMetadata(m);
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
      const result = await VideoService.startAnalysis(videoId, "full", {
        applyFaceAnonymization,
        faceMessageStyle,
        faceRequiresPersonDetection,
      });
      alert(`Analysis started! Status: ${result.status}`);

      // Start polling
      pollAnalysisProgress(videoId);
    } catch (error) {
      console.error("Failed to start analysis:", error);
      alert("Failed to start analysis.");
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
        setAnalysisProgress(status.progress || 0);

        if (status.status === "completed") {
          clearInterval(interval);
          pollingIntervalRef.current = null;
          setIsAnalyzing(false);

          // Refresh analysis data
          const updatedAnalysis = await VideoService.getAnalysis(analysisId);
          setAnalysisData(updatedAnalysis);
          setRawCsv(updatedAnalysis.rawCsv || null);

          // Force refresh the page
          window.location.reload();
          alert("Analysis completed!");
        } else if (status.status === "error") {
          clearInterval(interval);
          pollingIntervalRef.current = null;
          setIsAnalyzing(false);
          alert(`Analysis failed: ${status.error}`);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    // Store the interval in the ref
    pollingIntervalRef.current = interval;
  }

  async function handleExport() {
    console.log("handleExport called", analysisData);

    if (!videoId || !analysisData) return;

    console.log("Exporting data for videoId:", videoId);

    try {
      // Download the CSV file
      await VideoService.exportFile(videoId, "yolo_csv");

      // Optionally download other files
      await VideoService.exportFile(videoId, "ocr_csv");
      await VideoService.exportFile(videoId, "summary_json");
      if (analysisData?.downloadLinks?.face_anonymization_manifest) {
        await VideoService.exportFile(videoId, "face_anonymization_manifest");
      }
    } catch (error) {
      console.error("Failed to export:", error);
      alert("Failed to export data. Check console for details.");
    }
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
      disabled: !videoId,
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
  ];

  //<================ OPEN TASK AND LOAD JOB========================>

  async function openTask() {
    setIsPolling(true);
    setJobs([]);

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

        setJobs(jobList);

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
          setSelectedJob(jobList[0]);
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
      <div className="flex h-full">
        <div
          role="toolbar"
          aria-label="Analysis tools"
          className="bg-[#232323] w-[52px] h-full border-r border-[#0a0a0a] flex flex-col items-center py-2 gap-0"
        >
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            const isDisabled = Boolean(tool.disabled);
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    className={`w-full h-11 flex items-center justify-center transition-colors ${
                      isDisabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-white/10"
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

        <div>
          <div>Video Id: {videoId}</div>

          <div className="mt-3 space-y-3 rounded-md border border-white/10 bg-[#1b1b1b] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="face-anonymization-switch">
                  Face anonymization
                </Label>
                <p className="text-xs text-slate-400">
                  Keep this off by default and enable it only when you want
                  sampled face frames anonymized.
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
                  className="w-full max-w-[220px]"
                >
                  <SelectValue placeholder="Choose a style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">Plain</SelectItem>
                  <SelectItem value="starfleet">Engage</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                This only changes the human-facing tone, not the technical face
                analysis data.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="face-person-gate-switch">
                  Require YOLO person detection
                </Label>
                <p className="text-xs text-slate-400">
                  Only send sampled frames into face analysis when object
                  detection has already flagged a person.
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
          </div>

          <div className="mt-3 space-y-1 rounded-md border border-white/10 bg-[#151515] p-3 text-xs text-slate-300">
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
          </div>

          {/* Add progress indicator near Analyze button */}
          {isAnalyzing && (
            <div className="mt-2">
              <div className="text-sm text-slate-400">
                Analysis in progress: {analysisProgress}%
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Update Analyze button */}
          <Button
            variant="default"
            className="mt-3 bg-green-600/40 hover:bg-green-600/60 transition"
            onClick={handleAnalyzeVideo}
            disabled={isAnalyzing || !videoId}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>

          {/* Annotate Button */}
          {!isPolling && !jobReady && (
            <Button
              variant="default"
              className="mt-3 bg-green-600/40 hover:bg-green-600/60 transition"
              onClick={openTask}
              disabled={isAnalyzing || isPolling || !videoId}
            >
              Jobs
            </Button>
          )}
          {isPolling ||
            (jobReady && (
              <Button
                variant="default"
                className="mt-3 bg-green-600/40 hover:bg-green-600/60 transition"
                onClick={handleJobClick}
                disabled={isAnalyzing || isPolling || !videoId}
              >
                {!jobReady ? "Polling" : "Annotate"}
              </Button>
            ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
