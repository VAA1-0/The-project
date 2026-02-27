import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";

import { Search, MoreHorizontal } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function OCRPanel() {
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
  }, [videoId]);

  const ocrResults = analysisData?.ocr ?? [];

  return (
    <TooltipProvider delayDuration={200}>
      <main className="h-full flex flex-col overflow-hidden">
        <div className="text-xs text-slate-400 px-3 py-2 shrink-0">
          video Id: {videoId}
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between shrink-0">
            <span className="text-[#b8b8b8] text-[12px]">Analyze Results</span>
            <div className="flex items-center gap-1">
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
          {/* Detected Objects */}
          {/* Scrollable list container: flexible height with vertical scrolling */}
          <div className="flex-1 min-h-0 px-3 pb-3 flex flex-col">
            <div className="text-sm font-semibold mb-2 shrink-0">
              OCR Results:
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {ocrResults.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                  No OCR Results
                </div>
              ) : (
                ocrResults.map((obj: any, idx: number) => (
                  <div
                    key={`${obj.text}-${idx}`}
                    className="p-3 rounded-lg bg-slate-700/30 cursor-pointer hover:bg-slate-700/50"
                    // Click to seek video to object timestamp
                    onClick={() => {
                      eventBus.emit("videoTimeLineChanged", obj.timestamp);
                      console.log("Seeking video to", obj.timestamp);
                    }}
                  >
                    <div className="flex justify-between text-white">
                      <span>{obj.text}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Seen at {obj.timestamp.toFixed(2)}s{" • "}Confidence:{" "}
                      {(obj.confidence * 100).toFixed(2)}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
