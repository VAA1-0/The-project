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
  const CorpusSentenceWordStats = {
    nouns: analysisData?.posCounts?.nouns ?? 0,
    verbs: analysisData?.posCounts?.verbs ?? 0,
    adjectives: analysisData?.posCounts?.adjectives ?? 0,
    adverbs: analysisData?.posCounts?.adverbs ?? 0,
  };

  const BuildTokenStream = {
    verbNounRatio: analysisData?.posRatios?.VerbNounRatio ?? 0,
    modalDensity: analysisData?.posRatios?.ModalDensity ?? 0,
    pronounShare: analysisData?.posRatios?.PronounShare ?? 0,
    adjectiveAdverbRatio: analysisData?.posRatios?.AdjectiveAdverbRatio ?? 0,
  };

  const TFIDFTopTerms = {
    who: analysisData?.interrogatives?.who ?? 0,
    what: analysisData?.interrogatives?.what ?? 0,
    when: analysisData?.interrogatives?.when ?? 0,
    where: analysisData?.interrogatives?.where ?? 0,
    why: analysisData?.interrogatives?.why ?? 0,
    how: analysisData?.interrogatives?.how ?? 0,
    by_what_means: analysisData?.interrogatives?.by_what_means ?? 0,
    towards_what_end: analysisData?.interrogatives?.towards_what_end ?? 0,
    whence: analysisData?.interrogatives?.whence ?? 0,
    by_what_consequence: analysisData?.interrogatives?.by_what_consequence ?? 0,
  };

  const Bigrams = {
    NOUN: analysisData?.posWords?.NOUN ?? [],
    VERB: analysisData?.posWords?.VERB ?? [],
    ADJ: analysisData?.posWords?.ADJ ?? [],
    ADV: analysisData?.posWords?.ADV ?? [],
    PRON: analysisData?.posWords?.PRON ?? [],
    AUX_MODAL: analysisData?.posWords?.AUX_MODAL ?? [],
    ADP: analysisData?.posWords?.ADP ?? [],
    CONJ: analysisData?.posWords?.CONJ ?? [],
  };

  const SentenceTagging = {
    NOUN: analysisData?.posWords?.NOUN ?? [],
    VERB: analysisData?.posWords?.VERB ?? [],
    ADJ: analysisData?.posWords?.ADJ ?? [],
    ADV: analysisData?.posWords?.ADV ?? [],
    PRON: analysisData?.posWords?.PRON ?? [],
    AUX_MODAL: analysisData?.posWords?.AUX_MODAL ?? [],
    ADP: analysisData?.posWords?.ADP ?? [],
    CONJ: analysisData?.posWords?.CONJ ?? [],
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
        {/* Build Token Stream */}
        <div className="max-h-30 overflow-y-auto space-y-2 pr-2">
          Build Token Stream:
          {Object.keys(BuildTokenStream).length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No content available
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"nouns: " + BuildTokenStream.verbNounRatio}
              </div>
              <div className="text-sm text-slate-200">
                {"verbs: " + BuildTokenStream.modalDensity}
              </div>
              <div className="text-sm text-slate-200">
                {"adjectives: " + BuildTokenStream.adjectiveAdverbRatio}
              </div>
              <div className="text-sm text-slate-200">
                {"adverbs: " + BuildTokenStream.pronounShare}
              </div>
            </div>
          )}
        </div>
        {/* Corpus Sentence Word Stats */}
        <div className="max-h-30 overflow-y-auto space-y-2 pr-2">
          Corpus Sentence Word Stats:
          {Object.keys(CorpusSentenceWordStats).length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No content detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"nouns: " + CorpusSentenceWordStats.nouns}
              </div>
              <div className="text-sm text-slate-200">
                {"verbs: " + CorpusSentenceWordStats.verbs}
              </div>
              <div className="text-sm text-slate-200">
                {"adjectives: " + CorpusSentenceWordStats.adjectives}
              </div>
              <div className="text-sm text-slate-200">
                {"adverbs: " + CorpusSentenceWordStats.adverbs}
              </div>
            </div>
          )}
        </div>
        {/* TFIDF Top Terms */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        TFIDF Top Terms:
        <div className="max-h-30 overflow-y-auto space-y-2 pr-2">
          {Object.keys(TFIDFTopTerms).length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No TFIDF Top Terms detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"who: " + TFIDFTopTerms.who}
              </div>
              <div className="text-sm text-slate-200">
                {"what: " + TFIDFTopTerms.what}
              </div>
              <div className="text-sm text-slate-200">
                {"when: " + TFIDFTopTerms.when}
              </div>
              <div className="text-sm text-slate-200">
                {"where: " + TFIDFTopTerms.where}
              </div>
              <div className="text-sm text-slate-200">
                {"why: " + TFIDFTopTerms.why}
              </div>
              <div className="text-sm text-slate-200">
                {"how: " + TFIDFTopTerms.how}
              </div>
              <div className="text-sm text-slate-200">
                {"by what means: " + TFIDFTopTerms.by_what_means}
              </div>
              <div className="text-sm text-slate-200">
                {"towards what end: " + TFIDFTopTerms.towards_what_end}
              </div>
              <div className="text-sm text-slate-200">
                {"whence: " + TFIDFTopTerms.whence}
              </div>
              <div className="text-sm text-slate-200">
                {"by what consequence: " + TFIDFTopTerms.by_what_consequence}
              </div>
            </div>
          )}
        </div>
        {/* Bigrams */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        Bigrams:
        <div className="max-h-30 overflow-y-auto space-y-2 pr-2">
          {Object.keys(Bigrams).length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No Bigrams detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"noun: " + Bigrams.NOUN.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"verb: " + Bigrams.VERB.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adjective: " + Bigrams.ADJ.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adverb: " + Bigrams.ADV.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"pronoun: " + Bigrams.PRON.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"aux/modal: " + Bigrams.AUX_MODAL.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adposition: " + Bigrams.ADP.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"conjunction: " + Bigrams.CONJ.join(", ")}
              </div>
            </div>
          )}
        </div>
        {/* SentenceTagging */}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        SentenceTagging:
        <div className="max-h-30 overflow-y-auto space-y-2 pr-2">
          {Object.keys(SentenceTagging).length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
              No SentenceTagging detected
            </div>
          ) : (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-sm text-slate-200">
                {"noun: " + SentenceTagging.NOUN.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"verb: " + SentenceTagging.VERB.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adjective: " + SentenceTagging.ADJ.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adverb: " + SentenceTagging.ADV.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"pronoun: " + SentenceTagging.PRON.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"aux/modal: " + SentenceTagging.AUX_MODAL.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"adposition: " + SentenceTagging.ADP.join(", ")}
              </div>
              <div className="text-sm text-slate-200">
                {"conjunction: " + SentenceTagging.CONJ.join(", ")}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
