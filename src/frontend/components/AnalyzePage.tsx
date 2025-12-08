"use client"; // ⚠️ This component uses client-side hooks, review it

// Not the exact same as Figma, needs some refactoring later

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";

import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Separator } from "./ui/separator";
import { Toggle } from "./ui/toggle";
import { listJobs, listTasks } from "@/cvat-api/client";
import AnalyzePageV2 from "@/app/V2components/AnalyzePageV2";

export default function AnalyzePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  // track last created object URL so we can revoke it when it changes/unmounts
  const lastObjectUrl = React.useRef<string | null>(null);

  // Helper: format seconds into H:MM:SS or M:SS
  function formatDuration(sec?: number | null) {
    if (sec == null || isNaN(Number(sec))) return "…";
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (h > 0) return `${h}:${pad(m)}:${pad(ss)}`;
    return `${m}:${pad(ss)}`;
  }

  // Toggle states
  const [showTranscript, setShowTranscript] = useState(true);
  const [showSummary, setShowSummary] = useState(true);
  const [showObjects, setShowObjects] = useState(true);
  const [showQuantity, setShowQuantity] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);

  // Expand/collapse for each module
  const [expandTranscript, setExpandTranscript] = useState(false);
  const [expandSummary, setExpandSummary] = useState(false);
  const [expandObjects, setExpandObjects] = useState(false);
  const [expandQuantity, setExpandQuantity] = useState(false);
  const [expandAnnotations, setExpandAnnotations] = useState(false);

  // Compact toggle definitions to render via map (reduces repeated JSX)
  const toggleItems = [
    {
      key: "transcript",
      label: "Speech-to-Text",
      pressed: showTranscript,
      setPressed: setShowTranscript,
    },
    {
      key: "summary",
      label: "Summary",
      pressed: showSummary,
      setPressed: setShowSummary,
    },
    {
      key: "objects",
      label: "Object Detection",
      pressed: showObjects,
      setPressed: setShowObjects,
    },
    {
      key: "quantity",
      label: "Quantity Detection",
      pressed: showQuantity,
      setPressed: setShowQuantity,
    },
    {
      key: "annotations",
      label: "Annotation",
      pressed: showAnnotations,
      setPressed: setShowAnnotations,
    },
  ];

  // Raw CSV data state
  const [isLoading, setIsLoading] = useState(true);
  const [rawCsv, setRawCsv] = useState<string | null>(null);

  // KIAVASH HERE: Load metadata, blob and analysis on mount
  React.useEffect(() => {
    async function load() {
      if (!id) return;
      setIsLoading(true);

      try {
        // Load metadata
        const m = await VideoService.get(id);
        setMetadata(m);

        // Load video blob - hybrid approach
        // 1. First try to get the original video from IndexedDB (instant preview)
        let blob = await getVideoBlob(id);

        if (!blob) {
          // 2. Fallback: try to get the annotated video from the backend (after analysis completes)
          blob = await VideoService.getBlob(id);
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
        const analysis = await VideoService.getAnalysis(id);
        setAnalysisData(analysis);
        setRawCsv(analysis.rawCsv || null);
      } catch (err) {
        console.error("Failed to load data:", err);
        setBlobMissing(true);
        setVideoUrl(null);
        setAnalysisData(null);
        setRawCsv(null);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  // KIAVASH HERE : ANALYZE VIDEO HANDLER
  async function handleAnalyzeVideo() {
    if (!id) return;

    try {
      setAnalysisProgress(0);
      const result = await VideoService.startAnalysis(id, "full");
      alert(`Analysis started! Status: ${result.status}`);

      // Start polling
      pollAnalysisProgress(id);
    } catch (error) {
      console.error("Failed to start analysis:", error);
      alert("Failed to start analysis.");
    }
  }

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
    router.push(`/annotate/${id}`);
  };

  //<============= LOAD TASKS ==========>
  // Load tasks
  /*async function loadTasks() {
    try {
      const result = await listTasks();
      setTasks(result.results || []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  }*/
  //<=========================================>

  // KIAVASH HERE : EXPORT RAW DATA HANDLER
  async function handleExport() {
    if (!id || !analysisData) return;

    try {
      // Download the CSV file
      await VideoService.exportFile(id, "yolo_csv");

      // Optionally download other files
      // await VideoService.exportFile(id, 'ocr_csv');
      // await VideoService.exportFile(id, 'summary_json');
    } catch (error) {
      console.error("Failed to export:", error);
      alert("Failed to export data. Check console for details.");
    }
  }

  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function pollAnalysisProgress(analysisId: string) {
    setIsAnalyzing(true);

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
  // Use analysisData (fallback to empty arrays if not available)
  const transcript = analysisData?.transcript ?? [];
  const detectedObjects = analysisData?.detectedObjects ?? [];
  const quantityInfo = analysisData?.quantityDetection ?? [];
  const annotations = analysisData?.annotations ?? [];
  const summaryText = analysisData?.summary ?? "…";

  React.useEffect(() => {
    return () => {
      // cleanup object URL when component unmounts
      if (lastObjectUrl.current) {
        try {
          URL.revokeObjectURL(lastObjectUrl.current);
        } catch {}
        lastObjectUrl.current = null;
      }
    };
  }, []);

  return (
    <div className=" flex flex-col bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      {/* BODY LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        {/* MIDDLE SCROLLABLE AREA */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[900px] mx-auto">
          {/* TRANSCRIPT */}
          {showTranscript && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader
                onClick={() => setExpandTranscript(!expandTranscript)}
                className="cursor-pointer"
              >
                <CardTitle>Speech-to-Text</CardTitle>
                <CardDescription>
                  Transcript generated from audio
                </CardDescription>
              </CardHeader>
              {expandTranscript && (
                <CardContent className="space-y-3 max-h-[350px] overflow-y-auto">
                  {transcript.map((row: any) => (
                    <div key={row.t} className="p-3 bg-slate-700/30 rounded-lg">
                      <div className="text-xs text-cyan-300">
                        {row.t} • {row.speaker}
                      </div>
                      <div className="text-sm text-slate-200">{row.text}</div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* SUMMARY */}
          {showSummary && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader
                onClick={() => setExpandSummary(!expandSummary)}
                className="cursor-pointer"
              >
                <CardTitle>Summary</CardTitle>
                <CardDescription>Short breakdown of the video</CardDescription>
              </CardHeader>
              {expandSummary && (
                <CardContent>
                  <p className="text-slate-300">{summaryText}</p>
                </CardContent>
              )}
            </Card>
          )}

          {/* OBJECTS */}
          {showObjects && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader
                onClick={() => setExpandObjects(!expandObjects)}
                className="cursor-pointer"
              >
                <CardTitle>Detected Objects</CardTitle>
                <CardDescription>AI object detection results</CardDescription>
              </CardHeader>
              {expandObjects && (
                <CardContent className="space-y-3">
                  {detectedObjects.map((obj: any) => (
                    <div
                      key={obj.name}
                      className="p-3 rounded-lg bg-slate-700/30"
                    >
                      <div className="flex justify-between text-white">
                        <span>{obj.name}</span>
                        <span>{obj.count}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        First seen at {obj.firstSeen ?? obj.time}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* QUANTITY DETECTION */}
          {showQuantity && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader
                onClick={() => setExpandQuantity(!expandQuantity)}
                className="cursor-pointer"
              >
                <CardTitle>Quantity Detection</CardTitle>
                <CardDescription>Counts of people/objects</CardDescription>
              </CardHeader>
              {expandQuantity && (
                <CardContent>
                  {quantityInfo.map((q: any) => (
                    <div
                      key={q.label}
                      className="p-3 bg-slate-700/30 rounded-lg"
                    >
                      <div className="text-white font-medium">{q.label}</div>
                      <div className="text-xs text-slate-400">
                        {q.desc ?? JSON.stringify(q)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* ANNOTATIONS */}
          {showAnnotations && (
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/40 transition">
              <CardHeader
                onClick={() => setExpandAnnotations(!expandAnnotations)}
                className="cursor-pointer"
              >
                <CardTitle>Annotations</CardTitle>
                <CardDescription>User notes</CardDescription>
              </CardHeader>
              {expandAnnotations && (
                <CardContent className="space-y-3">
                  {annotations.map((a: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-700/30 rounded-lg">
                      <div className="text-sm text-slate-200">{a.note}</div>
                      <div className="text-xs text-slate-400">{a.time}</div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}
        </main>

        {/* FIXED RIGHT COLUMN — VIDEO PLAYER */}
        <aside className="w-[580px] border-l border-slate-700 bg-slate-800/30 p-6 flex flex-col gap-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-0">
              <div className="h-[350px] flex items-center justify-center bg-black rounded-t-lg">
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : blobMissing ? (
                  <div className="text-slate-400">
                    Video blob not found — please re-upload the video.
                  </div>
                ) : (
                  <div className="text-slate-400">Loading video...</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>Video Info</CardTitle>
              <CardDescription>Basic metadata</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-300 space-y-1">
              <div>
                <span className="text-slate-400">Filename:</span>{" "}
                {metadata?.name ?? "…"}
              </div>
              <div>
                <span className="text-slate-400">Duration:</span>{" "}
                {formatDuration(metadata?.length)}
              </div>
            </CardContent>
          </Card>

          {/* KIAVASH HERE : RAW DATA EXPORT */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle>Raw Data</CardTitle>
                  <CardDescription>Video data from CSV file</CardDescription>
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
                  className="bg-green-600/40 hover:bg-green-600/60 transition"
                  onClick={handleAnalyzeVideo}
                  disabled={isAnalyzing || !id}
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze"}
                </Button>

                {/* Download CSV button */}
                <Button
                  variant="default"
                  className="bg-blue-600/40 hover:bg-blue-600/60 transition"
                  onClick={handleExport}
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
            </CardHeader>

            <CardContent className="text-sm text-slate-300">
              {/* Loading indicator */}
              {isLoading && (
                <div className="text-slate-400 italic py-4">
                  Loading CSV data…
                </div>
              )}

              {/* Empty state */}
              {!isLoading && !rawCsv && (
                <div className="text-slate-400 py-4">
                  No raw data available for this video yet.
                </div>
              )}

              {/* Scrollable CSV viewer */}
              {!isLoading && rawCsv && (
                <div className="mt-2 max-h-[300px] overflow-auto rounded-lg bg-slate-900/40 p-3 border border-slate-700">
                  <pre className="whitespace-pre text-xs font-mono text-slate-200">
                    {rawCsv}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
      <AnalyzePageV2 />
    </div>
  );
}
