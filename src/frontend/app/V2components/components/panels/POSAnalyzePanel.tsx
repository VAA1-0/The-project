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

  return (
    <main className="flex-0 overflow-auto">
      <div className="text-xs text-slate-400">video Id: {videoId}</div>
      <div className="text-xs text-slate-400">
        text: {analysisData?.posAnalysis[0].text}
      </div>
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
        POS COUNTS:
        <div className="max-h-35 overflow-y-auto space-y-2 pr-2">
          {Object.keys(analysisData?.posAnalysis[0].pos_counts || {}).length ===
          0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No content available
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"nouns: " + analysisData?.posAnalysis[0].pos_counts?.NOUN}
              </div>
              <div className="text-sm text-slate-200">
                {"verbs: " + analysisData?.posAnalysis[0].pos_counts?.VERB}
              </div>
              <div className="text-sm text-slate-200">
                {"adjectives: " + analysisData?.posAnalysis[0].pos_counts?.ADP}
              </div>
              <div className="text-sm text-slate-200">
                {"adverbs: " + analysisData?.posAnalysis[0].pos_counts?.ADV}
              </div>
            </div>
          )}
        </div>
        {/* POS RATIOS */}
        POS RATIOS:
        <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
          {Object.keys(analysisData?.posAnalysis[0].pos_ratios || {}).length ===
          0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No content detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"verb noun ratio: " +
                  analysisData?.posAnalysis[0].pos_ratios?.verb_noun_ratio}
              </div>
              <div className="text-sm text-slate-200">
                {"modal density: " +
                  analysisData?.posAnalysis[0].pos_ratios?.modal_density}
              </div>
              <div className="text-sm text-slate-200">
                {"pronoun share: " +
                  analysisData?.posAnalysis[0].pos_ratios?.pronoun_share}
              </div>
              <div className="text-sm text-slate-200">
                {"adj adv ratio: " +
                  analysisData?.posAnalysis[0].pos_ratios?.adj_adv_ratio}
              </div>
              <div className="text-sm text-slate-200">
                {"nominalization density: " +
                  analysisData?.posAnalysis[0].pos_ratios
                    ?.nominalization_density}
              </div>
            </div>
          )}
        </div>
        {/* Interrogatives */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        Interrogatives:
        <div className="max-h-35 overflow-y-auto space-y-2 pr-2">
          {Object.keys(analysisData?.posAnalysis[0].interrogative_lens || {})
            .length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No interrogatives detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"who: " + analysisData?.posAnalysis[0].interrogative_lens.who}
              </div>
              <div className="text-sm text-slate-200">
                {"who: " + analysisData?.posAnalysis[0].interrogative_lens.who}
              </div>
              <div className="text-sm text-slate-200">
                {"what: " +
                  analysisData?.posAnalysis[0].interrogative_lens.what}
              </div>
              <div className="text-sm text-slate-200">
                {"when: " +
                  analysisData?.posAnalysis[0].interrogative_lens.when}
              </div>
              <div className="text-sm text-slate-200">
                {"where: " +
                  analysisData?.posAnalysis[0].interrogative_lens.where}
              </div>
              <div className="text-sm text-slate-200">
                {"why: " + analysisData?.posAnalysis[0].interrogative_lens.why}
              </div>
              <div className="text-sm text-slate-200">
                {"how: " + analysisData?.posAnalysis[0].interrogative_lens.how}
              </div>
              <div className="text-sm text-slate-200">
                {"by what means: " +
                  analysisData?.posAnalysis[0].interrogative_lens.by_what_means}
              </div>
              <div className="text-sm text-slate-200">
                {"towards what end: " +
                  analysisData?.posAnalysis[0].interrogative_lens
                    .towards_what_end}
              </div>
              <div className="text-sm text-slate-200">
                {"whence: " +
                  analysisData?.posAnalysis[0].interrogative_lens.whence}
              </div>
              <div className="text-sm text-slate-200">
                {"by what consequence: " +
                  analysisData?.posAnalysis[0].interrogative_lens
                    .by_what_consequence}
              </div>
            </div>
          )}
        </div>
        {/* POSWORDS */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        POSWORDS:
        <div className="max-h-35 overflow-y-auto space-y-2 pr-2">
          {Object.keys(analysisData?.posAnalysis[0].pos_words || {}).length ===
          0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No POS words detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"noun: " +
                  analysisData?.posAnalysis[0].pos_words?.NOUN.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"verb: " +
                  analysisData?.posAnalysis[0].pos_words?.VERB.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adjective: " +
                  analysisData?.posAnalysis[0].pos_words?.ADV.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"preposition: " +
                  analysisData?.posAnalysis[0].pos_words?.ADP.join(", ")}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
