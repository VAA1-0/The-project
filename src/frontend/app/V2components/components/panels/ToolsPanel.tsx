// src/frontend/app/V2components/components/panels/ToolsPanel.tsx
"use client";

import {
  Download,
  Play,
  Pause,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoService } from "@/lib/video-service";
import { listJobs } from "@/cvat-api/client";

import React, { useState } from "react";

interface ToolsPanelProps {
  videoId?: string | null;
}

export default function ToolsPanel({ videoId }: ToolsPanelProps) {
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);

  React.useEffect(() => {
    async function load() {
      if (!videoId) return;

      try {
        // Load metadata only - NO video blob loading
        const m = await VideoService.get(videoId);
        setMetadata(m);
      } catch (err) {
        console.error("ToolsPanel: Failed to load metadata:", err);
      }
    }
    load();
  }, [videoId]);

  async function handleAnalyzeVideo() {
    if (!videoId) return;

    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      const result = await VideoService.startAnalysis(videoId, "full");
      alert(`Analysis started! Status: ${result.status}`);

      // Start polling
      pollAnalysisProgress(videoId);
    } catch (error) {
      console.error("Failed to start analysis:", error);
      alert("Failed to start analysis.");
      setIsAnalyzing(false);
    }
  }

  async function pollAnalysisProgress(analysisId: string) {
    const interval = setInterval(async () => {
      try {
        const status = await VideoService.get(analysisId);
        setAnalysisProgress(status.progress || 0);

        if (status.status === "completed") {
          clearInterval(interval);
          setIsAnalyzing(false);

          // Refresh analysis data
          const updatedAnalysis = await VideoService.getAnalysis(analysisId);
          setAnalysisData(updatedAnalysis);
          setRawCsv(updatedAnalysis.rawCsv || null);

          alert("Analysis completed!");
          
          // Refresh metadata
          if (videoId) {
            const m = await VideoService.get(videoId);
            setMetadata(m);
          }
        } else if (status.status === "error") {
          clearInterval(interval);
          setIsAnalyzing(false);
          alert(`Analysis failed: ${status.error}`);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);
  }

  async function handleExport() {
    console.log("handleExport called", analysisData);

    if (!videoId || !analysisData) return;

    console.log("Exporting data for videoId:", videoId);

    try {
      // Download the CSV file
      await VideoService.exportFile(videoId, "yolo_csv");

      // Optionally download other files
      // await VideoService.exportFile(id, 'ocr_csv');
      // await VideoService.exportFile(id, 'summary_json');
    } catch (error) {
      console.error("Failed to export:", error);
      alert("Failed to export data. Check console for details.");
    }
  }

  const tools = [
    { icon: MessageSquareText, label: "Speech to text Tool" },
    { icon: Brain, label: "Summary" },
    { icon: View, label: "Object detection" },
    { icon: ChartScatter, label: "Quantity Detection" },
    { icon: ScanEye, label: "Annotations" },
  ];

  //<================ OPEN TASK AND LOAD JOB========================>

  // CVAT task/job state
  const [jobs, setJobs] = useState<any[]>([]);
  const [taskID, setTaskId] = useState<any>();
  const [jobReady, setJobReady] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);

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
            `⏳ Jobs not ready yet (attempt ${attempts}/${maxAttempts})`
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
            "Jobs are taking longer than expected. Try refreshing the task."
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

    if (selectedJob) {
      window.open(
        `/annotate/${selectedJob.id}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  return (
    <div className="h-full p-4 space-y-4 overflow-auto bg-[#1a1a1a]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-300">Tools Panel</h2>
        {metadata?.status && <StatusBadge status={metadata.status} />}
      </div>

      <div className="text-sm text-slate-300">
        Video ID: <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded">{videoId || "None"}</span>
      </div>

      {/* Analysis Controls */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-300">Analysis Controls</h3>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="default"
            className="bg-green-600 hover:bg-green-700 transition flex items-center gap-2"
            onClick={handleAnalyzeVideo}
            disabled={isAnalyzing || !videoId}
          >
            {isAnalyzing ? (
              <>
                <Pause className="size-4" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="size-4" />
                Analyze Video
              </>
            )}
          </Button>

          <Button
            variant="default"
            className="bg-blue-600 hover:bg-blue-700 transition flex items-center gap-2"
            onClick={() => {
              if (!videoId) {
                alert("Please select a video first");
                return;
              }
              alert("Check the Download Results panel on the right");
            }}
            disabled={!videoId}
          >
            <Download className="size-4" />
            View Downloads
          </Button>
        </div>

        {isAnalyzing && (
          <div className="mt-2">
            <div className="flex justify-between text-sm text-slate-400 mb-1">
              <span>Analysis in progress</span>
              <span>{analysisProgress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
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
          className="bg-green-600/40 hover:bg-green-600/60 transition"
          onClick={handleAnalyzeVideo}
          disabled={isAnalyzing || !videoId}
        >
          {isAnalyzing ? "Analyzing..." : "Analyze"}
        </Button>

        {/* Download CSV button */}
        <Button
          variant="default"
          className="bg-blue-600/40 hover:bg-blue-600/60 transition"
          onClick={() => {
            handleExport();
            console.log("Download button clicked");
          }}
        >
          Download
        </Button>

        {/* Annotate Button */}
        {!isPolling && !jobReady && (
          <Button
            variant="default"
            className="bg-green-600/40 hover:bg-green-600/60 transition"
            onClick={openTask}
            disabled={isAnalyzing || isPolling}
          >
            Jobs
          </Button>
        )}
        {isPolling ||
          (jobReady && (
            <Button
              variant="default"
              className="bg-green-600/40 hover:bg-green-600/60 transition"
              onClick={handleJobClick}
              disabled={isAnalyzing || isPolling}
            >
              {!jobReady ? "Polling" : "Annotate"}
            </Button>
          ))}
      </div>
    </div>
  );
}