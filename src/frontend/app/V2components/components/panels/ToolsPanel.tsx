import {
  MessageSquareText,
  Brain,
  View,
  ScanEye,
  ChartScatter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoService } from "@/lib/video-service";

import { useState } from "react";

interface ToolsPanelProps {
  videoId?: string | null;
}

export default function ToolsPanel({ videoId }: ToolsPanelProps) {
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);

  async function handleAnalyzeVideo() {
    if (!videoId) return;

    try {
      setAnalysisProgress(0);
      const result = await VideoService.startAnalysis(videoId, "full");
      alert(`Analysis started! Status: ${result.status}`);

      // Start polling
      pollAnalysisProgress(videoId);
    } catch (error) {
      console.error("Failed to start analysis:", error);
      alert("Failed to start analysis.");
    }
  }

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

  async function handleExport() {
    console.log("Exporting data for videoId:", videoId);

    if (!videoId || !analysisData) return;

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

  return (
    <div className="flex h-full">
      <div className="bg-[#232323] w-[52px] h-full border-r border-[#0a0a0a] flex flex-col items-center py-2 gap-0">
        {tools.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <button
              key={index}
              className={`w-full h-11 flex items-center justify-center transition-colors hover:bg-white/10 ${
                index === 0 ? "mt-2" : ""
              }`}
              title={tool.label}
            >
              <Icon className="size-5" strokeWidth={1.5} />
            </button>
          );
        })}
      </div>

      <div>
        <div>Video Id: {videoId}</div>

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
      </div>
    </div>
  );
}
