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

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const config = {
      completed: { color: "bg-green-500/20 text-green-300 border-green-500/30", icon: CheckCircle, label: "Completed" },
      processing: { color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Clock, label: "Processing" },
      uploaded: { color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Clock, label: "Uploaded" },
      error: { color: "bg-red-500/20 text-red-300 border-red-500/30", icon: AlertCircle, label: "Error" },
    };

    const cfg = config[status as keyof typeof config] || config.uploaded;
    const Icon = cfg.icon;

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${cfg.color}`}>
        <Icon className="size-3" />
        <span>{cfg.label}</span>
      </div>
    );
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
      </div>

      {/* Analysis Status */}
      <div className="pt-4 border-t border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Analysis Status</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Video Selected:</span>
            <span className={videoId ? "text-green-400" : "text-red-400"}>
              {videoId ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Metadata:</span>
            <span className={metadata ? "text-green-400" : "text-yellow-400"}>
              {metadata ? "Loaded" : "Not Loaded"}
            </span>
          </div>
          {metadata?.status && (
            <div className="flex justify-between">
              <span className="text-slate-400">Analysis Status:</span>
              <span className={
                metadata.status === 'completed' ? 'text-green-400' :
                metadata.status === 'processing' ? 'text-yellow-400' :
                metadata.status === 'error' ? 'text-red-400' : 'text-slate-400'
              }>
                {metadata.status.toUpperCase()}
              </span>
            </div>
          )}
          {metadata?.pipelineType && (
            <div className="flex justify-between">
              <span className="text-slate-400">Pipeline Type:</span>
              <span className="text-cyan-400">{metadata.pipelineType}</span>
            </div>
          )}
          {metadata?.cvatID && (
            <div className="flex justify-between">
              <span className="text-slate-400">CVAT ID:</span>
              <span className="text-purple-400">{metadata.cvatID}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}