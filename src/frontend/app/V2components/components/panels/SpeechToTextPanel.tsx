import React, { useState } from "react";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";

import { Download, Search, MoreHorizontal } from "lucide-react";

interface SpeechToTextPanelProps {
  videoId?: string | null;
}

export default function SpeechToTextPanel({ videoId }: SpeechToTextPanelProps) {
  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);

  React.useEffect(() => {
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

  // Use analysisData (fallback to empty arrays if not available)
  const transcript = analysisData?.transcript ?? [];
  const detectedObjects = analysisData?.detectedObjects ?? [];
  const quantityInfo = analysisData?.quantityDetection ?? [];
  const annotations = analysisData?.annotations ?? [];
  const summaryText = analysisData?.summary ?? "…";

  return (
    <main className="flex-0 overflow-auto">
      <div>video Id: {videoId}</div>
      <div className="mt-4">
        {/* Header */}
        <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between">
          <span className="text-[#b8b8b8] text-[12px]">Analyze Results</span>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-[#2a2a2a] rounded">
              <Search className="size-3.5 text-[#b8b8b8]" />
            </button>
            <button className="p-1 hover:bg-[#2a2a2a] rounded">
              <MoreHorizontal className="size-3.5 text-[#b8b8b8]" />
            </button>
          </div>
        </div>
        {/* SUMMARY */}
        <div className="max-h-30 overflow-y-auto space-y-2 pr-2">
          Summary:
          {summaryText.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No summary available
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">{summaryText}</div>
            </div>
          )}
        </div>
        {/* Speech to text */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
          Speech to Text:
          {transcript.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No speech to text detected
            </div>
          ) : (
            transcript.map((row: any) => (
              <div key={row.t} className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-xs text-cyan-300">
                  {row.t} • {row.speaker}
                </div>
                <div className="text-sm text-slate-200">{row.text}</div>
              </div>
            ))
          )}
        </div>
        {/* Detected Objects */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        Detected Objects:
        <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
          {detectedObjects.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No detected objects
            </div>
          ) : (
            detectedObjects.map((obj: any, idx: number) => (
              <div
                key={`${obj.class_name}-${idx}`}
                className="p-3 rounded-lg bg-slate-700/30"
              >
                <div className="flex justify-between text-white">
                  <span>{obj.class_name}</span>
                </div>
                <div className="text-xs text-slate-400">
                  Seen at {obj.timestamp.toFixed(2)}s{" • "}Confidence:{" "}
                  {(obj.confidence * 100).toFixed(2)}%
                </div>
              </div>
            ))
          )}
        </div>
        {/*
        Quantity Detection
        <div className="max-h-30 overflow-y-auto space-y-2 pr-2">
          Quantity Detection:
          {quantityInfo.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No speech to text detected
            </div>
          ) : (
            quantityInfo.map((row: any) => (
              <div key={row.label} className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-white font-medium">{row.label}</div>
                <div className="text-xs text-slate-400">
                  {row.desc ?? JSON.stringify(row)}
                </div>
              </div>
            ))
          )}
        </div>
        Annotations
        <div className="max-h-30 overflow-y-auto space-y-2 pr-2">
          Annotations:
          {annotations.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No annotations available
            </div>
          ) : (
            annotations.map((a: any, idx: number) => (
              <div key={idx} className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-200">{a.note}</div>
                <div className="text-xs text-slate-400">{a.time}</div>
              </div>
            ))
          )}
        </div>
        */}
      </div>
    </main>
  );
}
