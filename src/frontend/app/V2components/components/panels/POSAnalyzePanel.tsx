import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";

import { Download, Search, MoreHorizontal } from "lucide-react";

export default function POSAnalyzePanel() {
  const [videoId, setVideoId] = useState("");

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
    eventBus.on("textChanged", handler);

    return () => {
      eventBus.off("textChanged", handler);
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

  // Use analysisData (fallback to empty arrays if not available)
  const transcript = analysisData?.transcript ?? [];
  const detectedObjects = analysisData?.detectedObjects ?? [];

  const POSCounts = {
    nouns: analysisData?.posCounts?.nouns ?? 0,
    verbs: analysisData?.posCounts?.verbs ?? 0,
    adjectives: analysisData?.posCounts?.adjectives ?? 0,
    adverbs: analysisData?.posCounts?.adverbs ?? 0,
  };

  const POSRatios = {
    verbNounRatio: analysisData?.posRatios?.VerbNounRatio ?? 0,
    modalDensity: analysisData?.posRatios?.ModalDensity ?? 0,
    pronounShare: analysisData?.posRatios?.PronounShare ?? 0,
    adjectiveAdverbRatio: analysisData?.posRatios?.AdjectiveAdverbRatio ?? 0,
  };

  return (
    <main className="flex-0 overflow-auto">
      <div className="text-xs text-slate-400">video Id: {videoId}</div>
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
        {/* POS COUNTS */}
        <div className="max-h-35 overflow-y-auto space-y-2 pr-2">
          POS COUNTS:
          {Object.keys(POSRatios).length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No content available
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"nouns: " + POSRatios.verbNounRatio}
              </div>
              <div className="text-sm text-slate-200">
                {"verbs: " + POSRatios.modalDensity}
              </div>
              <div className="text-sm text-slate-200">
                {"adjectives: " + POSRatios.adjectiveAdverbRatio}
              </div>
              <div className="text-sm text-slate-200">
                {"adverbs: " + POSRatios.pronounShare}
              </div>
            </div>
          )}
        </div>
        {/* POS RATIOS */}
        <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
          POS RATIOS:
          {transcript.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No content detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"nouns: " + POSCounts.nouns}
              </div>
              <div className="text-sm text-slate-200">
                {"verbs: " + POSCounts.verbs}
              </div>
              <div className="text-sm text-slate-200">
                {"adjectives: " + POSCounts.adjectives}
              </div>
              <div className="text-sm text-slate-200">
                {"adverbs: " + POSCounts.adverbs}
              </div>
            </div>
          )}
        </div>
        {/* Detected Objects */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        Detected Objects:
        <div className="max-h-50 overflow-y-auto space-y-2 pr-2">
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
      </div>
    </main>
  );
}
