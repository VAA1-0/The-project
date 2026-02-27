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

export default function QuantitativeAnalysisPanel() {
  const [videoId, setVideoId] = useState("");

  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);

  // State for show/hide sections
  const [showBuildTokenStream, setShowBuildTokenStream] = useState(true);
  const [showCorpusSentenceWordStats, setShowCorpusSentenceWordStats] =
    useState(true);
  const [showTfidfTopTerms, setShowTfidfTopTerms] = useState(true);
  const [showBigrams, setShowBigrams] = useState(true);
  const [showSentenceTagging, setShowSentenceTagging] = useState(true);

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

  // Use analysisData (fallback to mock data if not available)
  const analysisDataquantAnalysis = analysisData?.quantAnalysis ?? {
    stats_df: [
      {
        Document: "analyze.txt",
        Sentences: 6,
        Words: 115,
      },
    ],
    token_info: {
      tokens: [
        "the",
        "early",
        "development",
        "of",
        "communication",
        "systems",
        "has",
        "always",
        "been",
        "shaped",
        "by",
        "the",
        "needs",
        "of",
        "the",
        "societies",
        "that",
        "use",
        "them",
        "as",
        "populations",
        "expanded",
        "people",
        "created",
        "more",
        "efficient",
        "methods",
        "for",
        "sharing",
        "information",
        "across",
        "greater",
        "distances",
        "written",
        "language",
        "emerged",
        "as",
        "a",
        "way",
        "to",
        "preserve",
        "knowledge",
        "beyond",
        "the",
        "limits",
        "of",
        "memory",
        "allowing",
        "ideas",
        "to",
        "be",
        "transmitted",
        "across",
        "generations",
        "over",
        "time",
        "improvements",
        "in",
        "materials",
        "such",
        "as",
        "paper",
        "and",
        "ink",
        "made",
        "writing",
        "more",
        "accessible",
        "eventually",
        "digital",
        "technologies",
        "accelerated",
        "this",
        "trend",
        "enabling",
        "rapid",
        "exchange",
        "of",
        "information",
        "on",
        "a",
        "global",
        "scale",
        "despite",
        "these",
        "changes",
        "the",
        "fundamental",
        "purpose",
        "of",
        "communication",
        "has",
        "remained",
        "constant",
        "to",
        "connect",
        "individuals",
        "through",
        "shared",
        "meaning",
      ],
      tokens_filtered: [
        "early",
        "development",
        "communication",
        "systems",
        "always",
        "shaped",
        "needs",
        "societies",
        "use",
        "populations",
        "expanded",
        "people",
        "created",
        "efficient",
        "methods",
        "sharing",
        "information",
        "across",
        "greater",
        "distances",
        "written",
        "language",
        "emerged",
        "way",
        "preserve",
        "knowledge",
        "beyond",
        "limits",
        "memory",
        "allowing",
        "ideas",
        "transmitted",
        "across",
        "generations",
        "time",
        "improvements",
        "materials",
        "paper",
        "ink",
        "made",
        "writing",
        "accessible",
        "eventually",
        "digital",
        "technologies",
        "accelerated",
        "trend",
        "enabling",
        "rapid",
        "exchange",
        "information",
        "global",
        "scale",
        "despite",
        "changes",
        "fundamental",
        "purpose",
        "communication",
        "remained",
        "constant",
        "connect",
        "individuals",
        "shared",
        "meaning",
      ],
      ttr: 0.82,
      freq_dist: {
        early: 1,
        development: 1,
        communication: 2,
        systems: 1,
        always: 1,
        shaped: 1,
        needs: 1,
        societies: 1,
        use: 1,
        populations: 1,
        expanded: 1,
        people: 1,
        created: 1,
        efficient: 1,
        methods: 1,
        sharing: 1,
        information: 2,
        across: 2,
        greater: 1,
        distances: 1,
        written: 1,
        language: 1,
        emerged: 1,
        way: 1,
        preserve: 1,
        knowledge: 1,
        beyond: 1,
        limits: 1,
        memory: 1,
        allowing: 1,
        ideas: 1,
        transmitted: 1,
        generations: 1,
        time: 1,
        improvements: 1,
        materials: 1,
        paper: 1,
        ink: 1,
        made: 1,
        writing: 1,
        accessible: 1,
        eventually: 1,
        digital: 1,
        technologies: 1,
        accelerated: 1,
        trend: 1,
        enabling: 1,
        rapid: 1,
        exchange: 1,
        global: 1,
        scale: 1,
        despite: 1,
        changes: 1,
        fundamental: 1,
        purpose: 1,
        remained: 1,
        constant: 1,
        connect: 1,
        individuals: 1,
        shared: 1,
        meaning: 1,
      },
    },
    tfidf_df: [
      {
        Document: "analyze.txt",
        TopTerms: [
          "information",
          "communication",
          "way",
          "writing",
          "trend",
          "transmitted",
          "time",
          "use",
          "written",
          "societies",
        ],
      },
    ],
    bigrams: [],
    sentence_tags: [
      {
        sentence:
          "The early development of communication systems has always been shaped by the needs of the societies that use them.",
        WHO: false,
        WHY: false,
      },
      {
        sentence:
          "As populations expanded, people created more efficient methods for sharing information across greater distances.",
        WHO: false,
        WHY: false,
      },
      {
        sentence:
          "Written language emerged as a way to preserve knowledge beyond the limits of memory, allowing ideas to be transmitted across generations.",
        WHO: false,
        WHY: false,
      },
      {
        sentence:
          "Over time, improvements in materials, such as paper and ink, made writing more accessible.",
        WHO: false,
        WHY: false,
      },
      {
        sentence:
          "Eventually, digital technologies accelerated this trend, enabling rapid exchange of information on a global scale.",
        WHO: false,
        WHY: false,
      },
      {
        sentence:
          "Despite these changes, the fundamental purpose of communication has remained constant: to connect individuals through shared meaning.",
        WHO: false,
        WHY: false,
      },
    ],
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
        {/* Build Token Stream (uses token_info from mock/analysis) */}
        <div className="border-b border-[#0a0a0a] shrink-0">
          <button
            onClick={() => setShowBuildTokenStream(!showBuildTokenStream)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-[#b8b8b8] text-[12px] font-medium">
              Build Token Stream
            </span>
            {showBuildTokenStream ? (
              <ChevronDown className="size-3.5 text-[#b8b8b8]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
        </div>

        {/* stats_df */}
        {showBuildTokenStream && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.token_info ||
            Object.keys(analysisDataquantAnalysis.token_info).length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No token information detected
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-200">
                  {"Total tokens: " +
                    (analysisDataquantAnalysis.token_info.tokens?.length ?? 0)}
                </div>
                <div className="text-sm text-slate-200">
                  {"Filtered tokens: " +
                    (analysisDataquantAnalysis.token_info.tokens_filtered
                      ?.length ?? 0)}
                </div>
                <div className="text-sm text-slate-200">
                  {"Type-token ratio (TTR): " +
                    analysisDataquantAnalysis.token_info.ttr}
                </div>
                <div className="text-sm text-slate-200">
                  {"Unique terms: " +
                    Object.keys(
                      analysisDataquantAnalysis.token_info.freq_dist ?? {},
                    ).length}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Corpus Sentence Word Stats */}
        <div className="border-b border-[#0a0a0a] shrink-0">
          <button
            onClick={() =>
              setShowCorpusSentenceWordStats(!showCorpusSentenceWordStats)
            }
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-[#b8b8b8] text-[12px] font-medium">
              Corpus Sentence Word Stats
            </span>
            {showCorpusSentenceWordStats ? (
              <ChevronDown className="size-3.5 text-[#b8b8b8]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
        </div>
        {showCorpusSentenceWordStats && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.stats_df ||
            analysisDataquantAnalysis.stats_df.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No content detected
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-200">
                  {"document: " +
                    analysisDataquantAnalysis.stats_df[0].Document}
                </div>
                <div className="text-sm text-slate-200">
                  {"sentences: " +
                    analysisDataquantAnalysis.stats_df[0].Sentences}
                </div>
                <div className="text-sm text-slate-200">
                  {"words: " +
                    analysisDataquantAnalysis.stats_df[0].Words}
                </div>
              </div>
            )}
          </div>
        )}
        {/* TFIDF Top Terms */}
        <div className="border-b border-[#0a0a0a] shrink-0">
          <button
            onClick={() => setShowTfidfTopTerms(!showTfidfTopTerms)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-[#b8b8b8] text-[12px] font-medium">
              TFIDF Top Terms
            </span>
            {showTfidfTopTerms ? (
              <ChevronDown className="size-3.5 text-[#b8b8b8]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
        </div>
        {/* Scrollable list container: responsive height with vertical scrolling */}
        {showTfidfTopTerms && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.tfidf_df ||
            analysisDataquantAnalysis.tfidf_df.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No TFIDF Top Terms detected
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-200">
                  {"document: " +
                    analysisDataquantAnalysis.tfidf_df[0].Document}
                </div>
                <div className="text-sm text-slate-200 mt-1">
                  {"Top terms: " +
                    analysisDataquantAnalysis.tfidf_df[0].TopTerms.join(", ")}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SentenceTagging */}
        <div className="border-b border-[#0a0a0a] shrink-0">
          <button
            onClick={() => setShowSentenceTagging(!showSentenceTagging)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-[#b8b8b8] text-[12px] font-medium">
              Sentence Tagging
            </span>
            {showSentenceTagging ? (
              <ChevronDown className="size-3.5 text-[#b8b8b8]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
        </div>
        {/* Scrollable list container: responsive height with vertical scrolling */}
        {showSentenceTagging && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.sentence_tags ||
            analysisDataquantAnalysis.sentence_tags.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No SentenceTagging detected
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                {analysisDataquantAnalysis.sentence_tags.map(
                  (
                    item: { sentence: string; WHO: boolean; WHY: boolean },
                    index: number,
                  ) => (
                    <div
                      key={index}
                      className="mb-2 border-b border-slate-600/40 pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="text-xs text-slate-400 mb-1">
                        Sentence {index + 1}
                      </div>
                      <div className="text-sm text-slate-200 mb-1">
                        {item.sentence}
                      </div>
                      <div className="text-xs text-slate-300 flex gap-4">
                        <span>WHO: {item.WHO ? "true" : "false"}</span>
                        <span>WHY: {item.WHY ? "true" : "false"}</span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {/* Bigrams */}
        <div className="border-b border-[#0a0a0a] shrink-0">
          <button
            onClick={() => setShowBigrams(!showBigrams)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-[#b8b8b8] text-[12px] font-medium">
              Bigrams
            </span>
            {showBigrams ? (
              <ChevronDown className="size-3.5 text-[#b8b8b8]" />
            ) : (
              <ChevronRight className="size-3.5 text-[#b8b8b8]" />
            )}
          </button>
        </div>
        {/* Scrollable list container: responsive height with vertical scrolling */}
        {showBigrams && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.bigrams ||
            analysisDataquantAnalysis.bigrams.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                No Bigrams detected
              </div>
            ) : (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                {analysisDataquantAnalysis.bigrams.map(
                  (bigram: string, index: number) => (
                    <div
                      key={index}
                      className="text-sm text-slate-200 flex items-center gap-2"
                    >
                      <span className="text-xs text-slate-400">
                        {index + 1}.
                      </span>
                      <span>{bigram}</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
