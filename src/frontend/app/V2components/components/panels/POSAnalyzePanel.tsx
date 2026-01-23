import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";

import {
  Download,
  Search,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function POSAnalyzePanel() {
  const [videoId, setVideoId] = useState("");

  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);

  // State for show/hide sections
  const [showPosCounts, setShowPosCounts] = useState(true);
  const [showPosRatios, setShowPosRatios] = useState(true);
  const [showInterrogatives, setShowInterrogatives] = useState(true);
  const [showPosWords, setShowPosWords] = useState(true);

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
  /*
  const pos_counts = analysisData?.posAnalysis[0]?.pos_counts || {};
  const pos_ratios = analysisData?.posAnalysis[0]?.pos_ratios || {};
  const interrogative_lens =
    analysisData?.posAnalysis[0]?.interrogative_lens || {};
  const pos_words = analysisData?.posAnalysis[0]?.pos_words || {};
  */

  /* Mock transcript data for demonstration */
  const pos_counts = {
    NOUN: 16,
    ADV: 1,
    VERB: 4,
    ADP: 2,
  };
  const pos_ratios = {
    verb_noun_ratio: 0.0,
    modal_density: 0.0,
    pronoun_share: 0.0,
    adj_adv_ratio: 0.0,
    nominalization_density: 0.0,
  };
  const interrogative_lens = {
    who: [],
    what: [],
    when: [],
    where: [],
    why: [],
    how: [],
    by_what_means: [],
    towards_what_end: [],
    whence: [],
    by_what_consequence: [],
  };
  const pos_words = {
    NOUN: [
      "Näin",
      "ministeri",
      "kommentoja",
      "eherutusta",
      "ilta",
      "päivänä",
      "nyt",
      "näyttää",
      "siltä",
      "molemmin",
      "saamassa",
      "tekstiniossa",
      "otetaan",
      "askeleita",
      "eteenpäinilmastonmuutoksen",
      "hillinnässä",
    ],
    ADV: ["että"],
    VERB: ["on", "saanut", "tehdä", "näkyväksi"],
    ADP: ["niin", "kuin"],
  };

  return (
    <main className="h-full flex flex-col overflow-hidden">
      <div className="text-xs text-slate-400 px-3 py-2 shrink-0">
        video Id: {videoId}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between shrink-0">
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
        <div className="border-b border-[#0a0a0a] shrink-0">
          <button
            onClick={() => setShowPosCounts(!showPosCounts)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-[#b8b8b8] text-[12px] font-medium">
              POS COUNTS
            </span>
            {showPosCounts ? (
              <ChevronDown className="size-3.5 text-[#b8b8b8]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
        </div>
        {showPosCounts && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3 py-2">
            {Object.keys(pos_counts).length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No content available
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-200">
                  {"nouns: " + pos_counts?.NOUN}
                </div>
                <div className="text-sm text-slate-200">
                  {"verbs: " + pos_counts?.VERB}
                </div>
                <div className="text-sm text-slate-200">
                  {"adjectives: " + pos_counts?.ADP}
                </div>
                <div className="text-sm text-slate-200">
                  {"adverbs: " + pos_counts?.ADV}
                </div>
              </div>
            )}
          </div>
        )}
        {/* POS RATIOS */}
        <div className="border-b border-[#0a0a0a] shrink-0">
          <button
            onClick={() => setShowPosRatios(!showPosRatios)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-[#b8b8b8] text-[12px] font-medium">
              POS RATIOS
            </span>
            {showPosRatios ? (
              <ChevronDown className="size-3.5 text-[#b8b8b8]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
        </div>
        {showPosRatios && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3">
            {Object.keys(pos_ratios).length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No content detected
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-200">
                  {"verb noun ratio: " + pos_ratios?.verb_noun_ratio}
                </div>
                <div className="text-sm text-slate-200">
                  {"modal density: " + pos_ratios?.modal_density}
                </div>
                <div className="text-sm text-slate-200">
                  {"pronoun share: " + pos_ratios?.pronoun_share}
                </div>
                <div className="text-sm text-slate-200">
                  {"adj adv ratio: " + pos_ratios?.adj_adv_ratio}
                </div>
                <div className="text-sm text-slate-200">
                  {"nominalization density: " +
                    pos_ratios?.nominalization_density}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Interrogatives */}
        <div className="border-b border-[#0a0a0a] shrink-0">
          <button
            onClick={() => setShowInterrogatives(!showInterrogatives)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-[#b8b8b8] text-[12px] font-medium">
              INTERROGATIVES
            </span>
            {showInterrogatives ? (
              <ChevronDown className="size-3.5 text-[#b8b8b8]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
        </div>
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        {showInterrogatives && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3">
            {Object.keys(interrogative_lens || {}).length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No interrogatives detected
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-200">
                  {"who: " + interrogative_lens.who}
                </div>
                <div className="text-sm text-slate-200">
                  {"who: " + interrogative_lens.who}
                </div>
                <div className="text-sm text-slate-200">
                  {"what: " + interrogative_lens.what}
                </div>
                <div className="text-sm text-slate-200">
                  {"when: " + interrogative_lens.when}
                </div>
                <div className="text-sm text-slate-200">
                  {"where: " + interrogative_lens.where}
                </div>
                <div className="text-sm text-slate-200">
                  {"why: " + interrogative_lens.why}
                </div>
                <div className="text-sm text-slate-200">
                  {"how: " + interrogative_lens.how}
                </div>
                <div className="text-sm text-slate-200">
                  {"by what means: " + interrogative_lens.by_what_means}
                </div>
                <div className="text-sm text-slate-200">
                  {"towards what end: " + interrogative_lens.towards_what_end}
                </div>
                <div className="text-sm text-slate-200">
                  {"whence: " + interrogative_lens.whence}
                </div>
                <div className="text-sm text-slate-200">
                  {"by what consequence: " +
                    interrogative_lens.by_what_consequence}
                </div>
              </div>
            )}
          </div>
        )}
        {/* POSWORDS */}
        <div className="border-b border-[#0a0a0a] shrink-0">
          <button
            onClick={() => setShowPosWords(!showPosWords)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-[#b8b8b8] text-[12px] font-medium">
              POS WORDS
            </span>
            {showPosWords ? (
              <ChevronDown className="size-3.5 text-[#b8b8b8]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
        </div>
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        {showPosWords && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3">
            {Object.keys(pos_words || {}).length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No POS words detected
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-200">
                  {"noun: " + pos_words?.NOUN.join(", ")}
                </div>
                <div className="text-sm text-slate-200">
                  {"verb: " + pos_words?.VERB.join(", ")}
                </div>
                <div className="text-sm text-slate-200">
                  {"adjective: " + pos_words?.ADV.join(", ")}
                </div>
                <div className="text-sm text-slate-200">
                  {"preposition: " + pos_words?.ADP.join(", ")}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
