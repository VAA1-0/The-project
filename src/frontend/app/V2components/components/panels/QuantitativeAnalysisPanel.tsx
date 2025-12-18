import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";

import { Download, Search, MoreHorizontal } from "lucide-react";

export default function QuantitativeAnalysisPanel() {
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
  const analysisDataquantAnalysis = [
    {
      text: "This one is being held in a city right on the edge of the Amerson jungle. Now the problem is...",
      build_token_stream: {
        NOUN: 6,
        VERB: 1,
        ADP: 3,
        ADV: 2,
      },
      corpus_sentence_word_stats: {
        verb_noun_ratio: 0.16666666666666666,
        modal_density: 0.0,
        pronoun_share: 0.0,
        adj_adv_ratio: 0.0,
        nominalization_density: 0.05,
      },
      tfidf_top_terms: {
        who: ["This one", "the problem"],
        what: [
          "This one is being held in a city right on the edge of the Amerson jungle.",
        ],
        when: ["Now"],
        where: ["in a city"],
        why: [],
        how: [],
        by_what_means: [],
        towards_what_end: [],
        whence: [],
        by_what_consequence: [],
      },
      bigrams: {
        NOUN: ["one", "city", "edge", "Amerson", "jungle", "problem"],
        VERB: ["held"],
        ADV: ["right", "Now"],
        ADP: ["in", "on", "of"],
      },
      sentencetagging: {
        NOUN: ["one", "city", "edge", "Amerson", "jungle", "problem"],
        VERB: ["held"],
        ADV: ["right", "Now"],
        ADP: ["in", "on", "of"],
      },
    },
  ];

  return (
    <main className="flex-0 overflow-auto">
      <div className="text-xs text-slate-400">video Id: {videoId}</div>
      <div className="text-xs text-slate-400">
        text: {analysisDataquantAnalysis[0].text}
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
        {/* Build Token Stream */}
        Build Token Stream:
        <div className="max-h-25 overflow-y-auto space-y-2 pr-2">
          {Object.keys(analysisDataquantAnalysis[0].build_token_stream)
            .length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No content available
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"nouns: " +
                  analysisDataquantAnalysis[0].build_token_stream.NOUN}
              </div>
              <div className="text-sm text-slate-200">
                {"verbs: " +
                  analysisDataquantAnalysis[0].build_token_stream.VERB}
              </div>
              <div className="text-sm text-slate-200">
                {"adjectives: " +
                  analysisDataquantAnalysis[0].build_token_stream.ADP}
              </div>
              <div className="text-sm text-slate-200">
                {"adverbs: " +
                  analysisDataquantAnalysis[0].build_token_stream.ADV}
              </div>
            </div>
          )}
        </div>
        {/* Corpus Sentence Word Stats */}
        Corpus Sentence Word Stats:
        <div className="max-h-25 overflow-y-auto space-y-2 pr-2">
          {Object.keys(analysisDataquantAnalysis[0].corpus_sentence_word_stats)
            .length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No content detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"nouns: " +
                  analysisDataquantAnalysis[0].corpus_sentence_word_stats
                    .verb_noun_ratio}
              </div>
              <div className="text-sm text-slate-200">
                {"verbs: " +
                  analysisDataquantAnalysis[0].corpus_sentence_word_stats
                    .modal_density}
              </div>
              <div className="text-sm text-slate-200">
                {"adjectives: " +
                  analysisDataquantAnalysis[0].corpus_sentence_word_stats
                    .pronoun_share}
              </div>
              <div className="text-sm text-slate-200">
                {"adverbs: " +
                  analysisDataquantAnalysis[0].corpus_sentence_word_stats
                    .adj_adv_ratio}
              </div>
            </div>
          )}
        </div>
        {/* TFIDF Top Terms */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        TFIDF Top Terms:
        <div className="max-h-25 overflow-y-auto space-y-2 pr-2">
          {Object.keys(analysisDataquantAnalysis[0].tfidf_top_terms).length ===
          0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No TFIDF Top Terms detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"who: " + analysisDataquantAnalysis[0].tfidf_top_terms.who}
              </div>
              <div className="text-sm text-slate-200">
                {"what: " + analysisDataquantAnalysis[0].tfidf_top_terms.what}
              </div>
              <div className="text-sm text-slate-200">
                {"when: " + analysisDataquantAnalysis[0].tfidf_top_terms.when}
              </div>
              <div className="text-sm text-slate-200">
                {"where: " + analysisDataquantAnalysis[0].tfidf_top_terms.where}
              </div>
              <div className="text-sm text-slate-200">
                {"why: " + analysisDataquantAnalysis[0].tfidf_top_terms.why}
              </div>
              <div className="text-sm text-slate-200">
                {"how: " + analysisDataquantAnalysis[0].tfidf_top_terms.how}
              </div>
              <div className="text-sm text-slate-200">
                {"by what means: " +
                  analysisDataquantAnalysis[0].tfidf_top_terms.by_what_means}
              </div>
              <div className="text-sm text-slate-200">
                {"towards what end: " +
                  analysisDataquantAnalysis[0].tfidf_top_terms.towards_what_end}
              </div>
              <div className="text-sm text-slate-200">
                {"whence: " +
                  analysisDataquantAnalysis[0].tfidf_top_terms.whence}
              </div>
              <div className="text-sm text-slate-200">
                {"by what consequence: " +
                  analysisDataquantAnalysis[0].tfidf_top_terms
                    .by_what_consequence}
              </div>
            </div>
          )}
        </div>
        {/* Bigrams */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        Bigrams:
        <div className="max-h-25 overflow-y-auto space-y-2 pr-2">
          {Object.keys(analysisDataquantAnalysis[0].bigrams).length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No Bigrams detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"noun: " +
                  analysisDataquantAnalysis[0].bigrams.NOUN.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"verb: " +
                  analysisDataquantAnalysis[0].bigrams.VERB.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adjective: " +
                  analysisDataquantAnalysis[0].bigrams.ADP.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adverb: " +
                  analysisDataquantAnalysis[0].bigrams.ADV.join(", ")}
              </div>
            </div>
          )}
        </div>
        {/* SentenceTagging */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        SentenceTagging:
        <div className="max-h-25 overflow-y-auto space-y-2 pr-2">
          {Object.keys(analysisDataquantAnalysis[0].sentencetagging).length ===
          0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No SentenceTagging detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"noun: " +
                  analysisDataquantAnalysis[0].sentencetagging.NOUN.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"verb: " +
                  analysisDataquantAnalysis[0].sentencetagging.VERB.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adjective: " +
                  analysisDataquantAnalysis[0].sentencetagging.ADP.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adverb: " +
                  analysisDataquantAnalysis[0].sentencetagging.ADV.join(", ")}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
