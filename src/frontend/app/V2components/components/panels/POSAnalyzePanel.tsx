import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { useLayoutHost } from "../LayoutHost";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";
import { apiService } from "@/lib/api-service";
import { openVideoAtTime } from "@/lib/video-navigation";

import {
  Download,
  Search,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const POS_CATEGORY_GROUPS = [
  {
    key: "content_words",
    label: "Content Words",
    categories: [
      { key: "NOUN", label: "nouns" },
      { key: "VERB", label: "verbs" },
      { key: "ADJ", label: "adjectives" },
      { key: "ADV", label: "adverbs" },
      { key: "INTJ", label: "interjections" },
    ],
  },
  {
    key: "function_words",
    label: "Function Words",
    categories: [
      { key: "ADP", label: "prepositions / adpositions" },
      { key: "CONJ", label: "conjunctions" },
      { key: "DET", label: "determiners" },
      { key: "PRON", label: "pronouns" },
      { key: "AUX_MODAL", label: "auxiliaries / modals" },
    ],
  },
] as const;

const POS_WORD_ROWS = [
  ["NOUN", "noun"],
  ["VERB", "verb"],
  ["ADJ", "adjective"],
  ["ADV", "adverb"],
  ["ADP", "preposition / adposition"],
  ["PRON", "pronoun"],
  ["DET", "determiner"],
  ["CONJ", "conjunction"],
  ["INTJ", "interjection"],
  ["AUX_MODAL", "auxiliary / modal"],
] as const;

function SoftPosDonut({
  counts,
}: {
      counts: {
        NOUN?: number;
        VERB?: number;
        ADJ?: number;
        ADV?: number;
        INTJ?: number;
        ADP?: number;
        DET?: number;
        PRON?: number;
        CONJ?: number;
        AUX_MODAL?: number;
  };
}) {
  const entries = [
    {
      key: "CONTENT",
      label: "Content",
      value:
        (counts.NOUN || 0) +
        (counts.VERB || 0) +
        (counts.ADJ || 0) +
        (counts.ADV || 0) +
        (counts.INTJ || 0),
      color: "#93c5fd",
    },
    {
      key: "FUNCTION",
      label: "Function",
      value:
        (counts.ADP || 0) +
        (counts.DET || 0) +
        (counts.PRON || 0) +
        (counts.CONJ || 0) +
        (counts.AUX_MODAL || 0),
      color: "#fcd34d",
    },
  ];
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#334155"
            strokeWidth="10"
          />
          {entries.map((entry) => {
            const dash = total > 0 ? (entry.value / total) * circumference : 0;
            const circle = (
              <circle
                key={entry.key}
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke={entry.color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                className="opacity-85"
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
            POS
          </div>
          <div className="text-lg font-semibold text-slate-100">{total}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-3 gap-y-2 text-xs text-slate-300">
        {entries.map((entry) => (
          <div key={entry.key} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span>
              {entry.label}: {entry.value}
            </span>
          </div>
        ))}
        <div className="text-[11px] text-slate-400">
          Content: nouns, verbs, adjectives, adverbs, interjections
        </div>
        <div className="text-[11px] text-slate-400">
          Function: adpositions, conjunctions, determiners, pronouns, auxiliaries
        </div>
      </div>
    </div>
  );
}

function confidenceSymbol(level?: string) {
  if (level === "high") return "●";
  if (level === "medium") return "◐";
  if (level === "low") return "○";
  return "·";
}

export default function POSAnalyzePanel() {
  const { openPanel } = useLayoutHost();
  const MATRIX_STORAGE_KEY = "vaa1.pos.matrix.sections";
  const MATRIX_ANALYSES_STORAGE_KEY = "vaa1.pos.matrix.analyses";
  const [videoId, setVideoId] = useState("");

  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isRefreshingPOS, setIsRefreshingPOS] = useState(false);
  const [posRefreshMessage, setPosRefreshMessage] = useState<string | null>(null);

  // State for show/hide sections
  const [showPosCounts, setShowPosCounts] = useState(false);
  const [showPosRatios, setShowPosRatios] = useState(false);
  const [showGrammarFeatures, setShowGrammarFeatures] = useState(false);
  const [showCaseProfile, setShowCaseProfile] = useState(false);
  const [showInterrogatives, setShowInterrogatives] = useState(false);
  const [showTenseProfile, setShowTenseProfile] = useState(false);
  const [showPosWords, setShowPosWords] = useState(false);
  const [expandedGrammarBuckets, setExpandedGrammarBuckets] = useState<string[]>([]);
  const [showPosMenu, setShowPosMenu] = useState(false);
  const [matrixSections, setMatrixSections] = useState<string[]>([]);
  const [matrixAnalysisIds, setMatrixAnalysisIds] = useState<string[]>([]);

  // Listen for video ID changes via event bus
  useEffect(() => {
    const handler = (id: string) => {
      setVideoId(id);
    };
    const correctionHandler = (id: string) => {
      if (id === videoId) {
        setRefreshNonce((current) => current + 1);
      }
    };
    eventBus.on("videoIdChanged", handler);
    eventBus.on("analysisCorrectionsChanged", correctionHandler);

    return () => {
      eventBus.off("videoIdChanged", handler);
      eventBus.off("analysisCorrectionsChanged", correctionHandler);
    };
  }, [videoId]);

  useEffect(() => {
    const syncMatrixSections = () => {
      const storedAnalyses = window.localStorage.getItem(MATRIX_ANALYSES_STORAGE_KEY);
      if (!storedAnalyses) {
        setMatrixSections([]);
        return;
      }
      try {
        const analysisIds = JSON.parse(storedAnalyses);
        if (!Array.isArray(analysisIds) || analysisIds.length === 0) {
          setMatrixSections([]);
          return;
        }
      } catch {
        setMatrixSections([]);
        return;
      }
      const stored = window.localStorage.getItem(MATRIX_STORAGE_KEY);
      if (!stored) {
        setMatrixSections([]);
        return;
      }
      try {
        setMatrixSections(JSON.parse(stored));
      } catch {
        setMatrixSections([]);
      }
    };

    const handleSectionsChanged = (sections: string[]) => {
      setMatrixSections(sections);
    };

    const handleAnalysesChanged = (analysisIds: string[]) => {
      setMatrixAnalysisIds(Array.isArray(analysisIds) ? analysisIds : []);
      if (!Array.isArray(analysisIds) || analysisIds.length === 0) {
        setMatrixSections([]);
        return;
      }
      syncMatrixSections();
    };

    syncMatrixSections();
    try {
      const storedAnalyses = window.localStorage.getItem(MATRIX_ANALYSES_STORAGE_KEY);
      setMatrixAnalysisIds(storedAnalyses ? JSON.parse(storedAnalyses) : []);
    } catch {
      setMatrixAnalysisIds([]);
    }
    eventBus.on("posMatrixSectionsChanged", handleSectionsChanged);
    eventBus.on("posMatrixAnalysesChanged", handleAnalysesChanged);

    return () => {
      eventBus.off("posMatrixSectionsChanged", handleSectionsChanged);
      eventBus.off("posMatrixAnalysesChanged", handleAnalysesChanged);
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
  }, [videoId, refreshNonce]);

  // Use analysisData (fallback to empty arrays if not available)
  const pos_counts = analysisData?.posAnalysis[0]?.pos_counts || {};
  const pos_ratios = analysisData?.posAnalysis[0]?.pos_ratios || {};
  const interrogative_lens =
    analysisData?.posAnalysis[0]?.interrogative_lens || {};
  const pos_words = analysisData?.posAnalysis[0]?.pos_words || {};
  const rawGrammarProfile = analysisData?.posAnalysis[0]?.grammar_profile || null;
  const grammarProfile =
    rawGrammarProfile?.content_words || rawGrammarProfile?.function_words
      ? rawGrammarProfile
      : {
          content_words: {
            count:
              (pos_counts?.NOUN || 0) +
              (pos_counts?.VERB || 0) +
              (pos_counts?.ADJ || 0) +
              (pos_counts?.ADV || 0) +
              (pos_counts?.INTJ || 0),
            categories: {
              NOUN: pos_counts?.NOUN || 0,
              VERB: pos_counts?.VERB || 0,
              ADJ: pos_counts?.ADJ || 0,
              ADV: pos_counts?.ADV || 0,
              INTJ: pos_counts?.INTJ || 0,
            },
          },
          function_words: {
            count:
              (pos_counts?.ADP || 0) +
              (pos_counts?.CONJ || 0) +
              (pos_counts?.DET || 0) +
              (pos_counts?.PRON || 0) +
              (pos_counts?.AUX_MODAL || 0),
            categories: {
              ADP: pos_counts?.ADP || 0,
              CONJ: pos_counts?.CONJ || 0,
              DET: pos_counts?.DET || 0,
              PRON: pos_counts?.PRON || 0,
              AUX_MODAL: pos_counts?.AUX_MODAL || 0,
            },
          },
        };
  const tenseProfile = analysisData?.posAnalysis[0]?.tense_profile || {};
  const caseProfile = analysisData?.posAnalysis[0]?.case_profile || {};
  const posNotes = analysisData?.posAnalysis[0]?.notes || [];
  const posAnalysisMode = analysisData?.posAnalysis[0]?.analysis_mode;
  const posTokenCount = analysisData?.posAnalysis[0]?.token_count;
  const posConfidence = analysisData?.posAnalysis[0]?.confidence_profile;
  const transcriptSegments =
    analysisData?.transcriptTimeline || analysisData?.transcript || [];
  const languageSupport = analysisData?.metadata?.languageSupport;
  const posError = analysisData?.metadata?.posError;
  const hasPosContent =
    Object.keys(pos_counts).length > 0 || Object.keys(pos_words).length > 0;
  const posSupportNote =
    !hasPosContent &&
    (languageSupport?.pos === "limited" ||
      languageSupport?.pos === "multilingual")
      ? `POS tagging is currently ${languageSupport?.pos} for this transcript language. Expected spaCy model: ${languageSupport?.spacy_model || "unknown"}`
      : null;
  const isLexicalFallback = posAnalysisMode === "lexical_fallback";
  const formatRatio = (value: number | undefined) =>
    Number.isFinite(value) ? Number(value).toFixed(3).replace(/\.?0+$/, "") : "0";
  const formatConfidence = (value?: number) =>
    Number.isFinite(value) ? Number(value).toFixed(2).replace(/\.?0+$/, "") : "0";
  const summaryChips = [
    posAnalysisMode ? `mode ${posAnalysisMode}` : null,
    posTokenCount !== undefined ? `${posTokenCount} tokens` : null,
    posConfidence?.overall?.level
      ? `${posConfidence.overall.level} confidence${
          posConfidence.overall.score !== undefined
            ? ` ${formatConfidence(posConfidence.overall.score)}`
            : ""
        }`
      : null,
    posConfidence?.overall?.triangulation_ready
      ? "triangulation ready"
      : null,
    posConfidence?.overall?.timestamp_ready === false
      ? "timestamp pending"
      : null,
  ].filter(Boolean);
  const interrogativeRows = [
    { key: "who", label: "who", value: interrogative_lens.who },
    { key: "what", label: "what", value: interrogative_lens.what },
    { key: "when", label: "when", value: interrogative_lens.when },
    { key: "where", label: "where", value: interrogative_lens.where },
    { key: "why", label: "why", value: interrogative_lens.why },
    { key: "how", label: "how", value: interrogative_lens.how },
    { key: "by_what_means", label: "means", value: interrogative_lens.by_what_means },
    { key: "towards_what_end", label: "end", value: interrogative_lens.towards_what_end },
    { key: "whence", label: "whence", value: interrogative_lens.whence },
    {
      key: "by_what_consequence",
      label: "consequence",
      value: interrogative_lens.by_what_consequence,
    },
  ];

  const openPOSMatrix = () => {
    if (videoId) {
      const stored = window.localStorage.getItem(MATRIX_ANALYSES_STORAGE_KEY);
      let analysisIds: string[] = [];
      if (stored) {
        try {
          analysisIds = JSON.parse(stored);
        } catch {
          analysisIds = [];
        }
      }
      const nextIds = analysisIds.includes(videoId)
        ? analysisIds
        : [...analysisIds, videoId];
      window.localStorage.setItem(
        MATRIX_ANALYSES_STORAGE_KEY,
        JSON.stringify(nextIds),
      );
      eventBus.emit("posMatrixAnalysesChanged", nextIds);
    }
    setShowPosMenu(false);
    openPanel("POSMatrix", { videoId });
  };

  const addCurrentAnalysisToPOSMatrix = () => {
    if (!videoId) {
      setShowPosMenu(false);
      return;
    }
    const stored = window.localStorage.getItem(MATRIX_ANALYSES_STORAGE_KEY);
    let analysisIds: string[] = [];
    if (stored) {
      try {
        analysisIds = JSON.parse(stored);
      } catch {
        analysisIds = [];
      }
    }
    const nextIds = analysisIds.includes(videoId)
      ? analysisIds
      : [...analysisIds, videoId];
    window.localStorage.setItem(
      MATRIX_ANALYSES_STORAGE_KEY,
      JSON.stringify(nextIds),
    );
    eventBus.emit("posMatrixAnalysesChanged", nextIds);
    setShowPosMenu(false);
  };

  const toggleMatrixSection = (section: string) => {
    setMatrixSections((current) => {
      const next = current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section];
      window.localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(next));
      if (!current.includes(section) && videoId) {
        const nextAnalysisIds = matrixAnalysisIds.includes(videoId)
          ? matrixAnalysisIds
          : [...matrixAnalysisIds, videoId];
        window.localStorage.setItem(
          MATRIX_ANALYSES_STORAGE_KEY,
          JSON.stringify(nextAnalysisIds),
        );
        setMatrixAnalysisIds(nextAnalysisIds);
        eventBus.emit("posMatrixAnalysesChanged", nextAnalysisIds);
      }
      eventBus.emit("posMatrixSectionsChanged", next);
      return next;
    });
  };
  const currentAnalysisInMatrix = !!videoId && matrixAnalysisIds.includes(videoId);

  const toggleGrammarBucket = (bucket: string) => {
    setExpandedGrammarBuckets((current) =>
      current.includes(bucket)
        ? current.filter((item) => item !== bucket)
        : [...current, bucket],
    );
  };

  const refreshPOSFromCorrectedTranscript = async () => {
    if (!videoId) {
      return;
    }

    try {
      setIsRefreshingPOS(true);
      setPosRefreshMessage(null);
      await apiService.refreshPOSAnalysis(videoId, {
        segments: transcriptSegments.map((segment: any) => ({
          text: segment?.text || "",
          start: segment?.start,
          end: segment?.end,
        })),
        language_code:
          analysisData?.metadata?.languageProfile?.code ||
          analysisData?.metadata?.audioLanguage ||
          "en",
      });
      const refreshedAnalysis = await VideoService.refreshAnalysis(videoId);
      setAnalysisData(refreshedAnalysis);
      setRawCsv(refreshedAnalysis.rawCsv || null);
      setRefreshNonce((current) => current + 1);
      setPosRefreshMessage("POS refreshed from corrected transcript.");
      window.setTimeout(() => setPosRefreshMessage(null), 2500);
      alert("POS refreshed from corrected transcript.");
    } catch (error) {
      console.error("POS refresh failed:", error);
      alert(
        "Could not refresh POS from the corrected transcript: " +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setIsRefreshingPOS(false);
    }
  };

  const renderGrammarWordButtons = (label: string, words: string[]) => (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {words.length === 0 ? (
        <span className="text-xs text-slate-500">none</span>
      ) : (
        words.map((word, index) => (
          <button
            key={`${label}-${word}-${index}`}
            type="button"
            onClick={() => jumpToTime(findTranscriptTimeForText(word))}
            className="rounded bg-slate-900/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-900/70 hover:text-slate-50"
          >
            {word}
          </button>
        ))
      )}
    </div>
  );

  const renderMorphologyGroup = (
    prefix: string,
    title: string,
    counts: Record<string, number>,
    examples: Record<string, string[]>,
    labels: Record<string, string>,
  ) => {
    const keys = Object.keys(counts || {});
    if (keys.length === 0) {
      return (
        <div className="rounded-md bg-slate-800/35 px-3 py-2 text-sm text-slate-400">
          No {title.toLowerCase()} detected
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
          {title}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {keys
            .sort((left, right) => {
              const leftCount = counts?.[left] || 0;
              const rightCount = counts?.[right] || 0;
              if (leftCount !== rightCount) {
                return rightCount - leftCount;
              }
              return left.localeCompare(right);
            })
            .map((key) => {
              const bucketKey = `${prefix}_${key}`;
              const isOpen = expandedGrammarBuckets.includes(bucketKey);
              return (
                <div
                  key={key}
                  className="rounded-md bg-slate-800/35 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleGrammarBucket(bucketKey)}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm text-slate-100"
                  >
                    <span>{labels?.[key] || key}</span>
                    <span className="text-slate-400">{counts?.[key] || 0}</span>
                  </button>
                  {isOpen &&
                    renderGrammarWordButtons(labels?.[key] || key, examples?.[key] || [])}
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  const jumpToTime = (time: number) => {
    if (!videoId) return;
    openVideoAtTime(videoId, time);
  };

  const findTranscriptTimeForText = (needle?: string) => {
    const normalizedNeedle = String(needle || "")
      .trim()
      .toLowerCase();
    if (!normalizedNeedle) {
      return transcriptSegments[0]?.start ?? 0;
    }
    const matched = transcriptSegments.find((segment: any) =>
      String(segment.text || "").toLowerCase().includes(normalizedNeedle),
    );
    return matched?.start ?? transcriptSegments[0]?.start ?? 0;
  };

  const renderSectionHeader = (
    label: string,
    open: boolean,
    onToggle: () => void,
    matrixKey: string,
  ) => (
    <div className="border-b border-white/8 shrink-0">
      <div className="w-full px-3 py-2 flex items-center justify-between gap-2">
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-white/5"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            {label}
          </span>
          {open ? (
            <ChevronDown className="size-3.5 text-[#b8b8b8]" />
          ) : (
            <ChevronRight className="size-3.5 text-[#b8b8b8]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleMatrixSection(matrixKey)}
          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${
            matrixSections.includes(matrixKey) && currentAnalysisInMatrix
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-white/10 bg-[#101010] text-slate-300 hover:bg-white/5"
          }`}
        >
          {matrixSections.includes(matrixKey) && currentAnalysisInMatrix
            ? "Matrix On"
            : "Add to Matrix"}
        </button>
      </div>
    </div>
  );

  /* Mock transcript data for demonstration */

  /*
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

  */

  const panelHeaderClass =
    "border-b border-white/8 bg-[#141414] px-3 py-2 flex items-center justify-between shrink-0";
  const panelSurfaceClass =
    "rounded border border-white/8 bg-[#151515] px-3 py-3";
  const panelSubtleSurfaceClass =
    "rounded border border-white/8 bg-[#171717] px-3 py-3 text-slate-300";
  const panelQuietNoteClass =
    "rounded border border-white/8 bg-[#121212] px-3 py-2 text-sm text-slate-300";
  const panelMetricTileClass =
    "rounded border border-white/8 bg-[#111111] px-3 py-2 text-sm text-slate-200";
  const panelChipClass =
    "rounded-full border border-white/10 bg-[#101010] px-2.5 py-1 text-[11px] text-slate-300";

  return (
    <main className="h-full flex flex-col overflow-hidden">
      <div className="text-xs text-slate-400 px-3 py-2 shrink-0">
        video Id: {videoId}
      </div>
      {posRefreshMessage ? (
        <div className="mx-3 mb-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {posRefreshMessage}
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className={panelHeaderClass}>
          <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
            POS governance
          </span>
          <div className="relative flex items-center gap-1">
            <button className="p-1 hover:bg-[#2a2a2a] rounded">
              <Search className="size-3.5 text-[#b8b8b8]" />
            </button>
            <button
              type="button"
              onClick={() => setShowPosMenu((current) => !current)}
              className="p-1 hover:bg-[#2a2a2a] rounded"
            >
              <MoreHorizontal className="size-3.5 text-[#b8b8b8]" />
            </button>
            {showPosMenu && (
              <div className="absolute right-0 top-7 z-10 min-w-48 rounded-md border border-slate-700 bg-[#171717] p-1 shadow-lg">
                <button
                  type="button"
                  onClick={addCurrentAnalysisToPOSMatrix}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/70"
                >
                  Add Current Analysis to POS Matrix
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void refreshPOSFromCorrectedTranscript();
                    setShowPosMenu(false);
                  }}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/70"
                >
                  {isRefreshingPOS ? "Refreshing POS..." : "Refresh POS from corrected transcript"}
                </button>
                <button
                  type="button"
                  onClick={openPOSMatrix}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/70"
                >
                  Open POS Matrix
                </button>
              </div>
            )}
          </div>
        </div>
        {/* POS COUNTS */}
        {renderSectionHeader(
          "POS COUNTS",
          showPosCounts,
          () => setShowPosCounts(!showPosCounts),
          "pos_counts",
        )}
        {showPosCounts && (
          <div className="space-y-2 px-3 py-2">
            {posError && (
              <div className="rounded border border-amber-500/20 bg-amber-500/8 px-3 py-3 text-amber-200">
                {posError}
              </div>
            )}
            {posSupportNote && (
              <div className={panelQuietNoteClass}>
                {posSupportNote}
              </div>
            )}
            {summaryChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {summaryChips.map((chip) => (
                  <span key={chip} className={panelChipClass}>
                    {chip}
                  </span>
                ))}
              </div>
            )}
            {posNotes.length > 0 && (
              <div className={panelQuietNoteClass}>
                {posNotes.join(" ")}
              </div>
            )}
            {Object.keys(pos_counts).length === 0 ? (
              <div className={panelSubtleSurfaceClass}>
                No content available
              </div>
            ) : (
              <div className={panelSurfaceClass}>
                <SoftPosDonut counts={pos_counts} />
              </div>
            )}
          </div>
        )}
        {/* POS RATIOS */}
        {renderSectionHeader(
          "POS RATIOS",
          showPosRatios,
          () => setShowPosRatios(!showPosRatios),
          "pos_ratios",
        )}
        {showPosRatios && (
          <div className="space-y-2 px-3 py-2">
            {Object.keys(pos_ratios).length === 0 ? (
              <div className={panelSubtleSurfaceClass}>
                No content detected
              </div>
            ) : (
                <div className={`${panelSurfaceClass} grid gap-2 md:grid-cols-2`}>
                <button
                  type="button"
                  onClick={() => jumpToTime(transcriptSegments[0]?.start ?? 0)}
                  className={`${panelMetricTileClass} text-left hover:bg-white/5`}
                >
                  {"verb noun ratio: " + formatRatio(pos_ratios?.verb_noun_ratio)}
                </button>
                <button
                  type="button"
                  onClick={() => jumpToTime(transcriptSegments[0]?.start ?? 0)}
                  className={`${panelMetricTileClass} text-left hover:bg-white/5`}
                >
                  {"modal density: " + formatRatio(pos_ratios?.modal_density)}
                </button>
                <button
                  type="button"
                  onClick={() => jumpToTime(transcriptSegments[0]?.start ?? 0)}
                  className={`${panelMetricTileClass} text-left hover:bg-white/5`}
                >
                  {"pronoun share: " + formatRatio(pos_ratios?.pronoun_share)}
                </button>
                <button
                  type="button"
                  onClick={() => jumpToTime(transcriptSegments[0]?.start ?? 0)}
                  className={`${panelMetricTileClass} text-left hover:bg-white/5`}
                >
                  {"adj adv ratio: " + formatRatio(pos_ratios?.adj_adv_ratio)}
                </button>
                <button
                  type="button"
                  onClick={() => jumpToTime(transcriptSegments[0]?.start ?? 0)}
                  className={`${panelMetricTileClass} text-left md:col-span-2 hover:bg-white/5`}
                >
                  {"nominalization density: " +
                    formatRatio(pos_ratios?.nominalization_density)}
                </button>
              </div>
            )}
          </div>
        )}
        {/* GRAMMAR FEATURES */}
        {renderSectionHeader(
          "GRAMMAR FEATURES",
          showGrammarFeatures,
          () => setShowGrammarFeatures(!showGrammarFeatures),
          "grammar_features",
        )}
        {showGrammarFeatures && (
          <div className="space-y-2 px-3 py-2">
            {!grammarProfile?.content_words && !grammarProfile?.function_words ? (
              <div className={panelSubtleSurfaceClass}>
                No grammar profile available
              </div>
            ) : (
              <div className={`${panelSurfaceClass} grid gap-2 md:grid-cols-2`}>
                {POS_CATEGORY_GROUPS.map((group) => (
                  <div key={group.key} className={panelMetricTileClass}>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                      {group.label}
                    </div>
                    <div className="mt-1 text-sm text-slate-100">
                      {grammarProfile?.[group.key]?.count || 0}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {group.categories.map((category) => {
                        const bucketKey = `${group.key}_${category.key}`;
                        const isOpen = expandedGrammarBuckets.includes(bucketKey);
                        const count =
                          grammarProfile?.[group.key]?.categories?.[category.key] || 0;
                        return (
                          <div
                            key={category.key}
                            className="w-full rounded border border-white/8 bg-[#161616] px-2 py-2"
                          >
                            <button
                              type="button"
                              onClick={() => toggleGrammarBucket(bucketKey)}
                              className="flex w-full items-center justify-between gap-2 text-left text-slate-300 hover:text-slate-50"
                            >
                              <span>{category.label}</span>
                              <span className="text-slate-400">{count}</span>
                            </button>
                            {isOpen &&
                              renderGrammarWordButtons(
                                category.label,
                                pos_words?.[category.key] || [],
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {renderSectionHeader(
          "CASE PROFILE",
          showCaseProfile,
          () => setShowCaseProfile(!showCaseProfile),
          "case_profile",
        )}
        {showCaseProfile && (
          <div className="space-y-2 px-3 py-2">
            {!caseProfile?.available ? (
              <div className={panelSubtleSurfaceClass}>
                {caseProfile?.note || "No case profile available"}
              </div>
            ) : (
              <>
                {caseProfile?.note && (
                  <div className={panelQuietNoteClass}>
                    {caseProfile.note}
                  </div>
                )}
                <div className={`${panelSurfaceClass} grid gap-2 md:grid-cols-2`}>
                  {Object.keys(caseProfile?.counts || {})
                    .sort((left, right) => {
                      const leftCount = caseProfile?.counts?.[left] || 0;
                      const rightCount = caseProfile?.counts?.[right] || 0;
                      if (leftCount !== rightCount) {
                        return rightCount - leftCount;
                      }
                      return left.localeCompare(right);
                    })
                    .map((key) => {
                      const count = caseProfile?.counts?.[key] || 0;
                      const examples = caseProfile?.examples?.[key] || [];
                      const label = caseProfile?.labels?.[key] || key;
                      const bucketKey = `case_${key}`;
                      const isOpen = expandedGrammarBuckets.includes(bucketKey);
                      return (
                        <div
                          key={key}
                          className={panelMetricTileClass}
                        >
                          <button
                            type="button"
                            onClick={() => toggleGrammarBucket(bucketKey)}
                            className="flex w-full items-center justify-between gap-2 text-left text-sm text-slate-100"
                          >
                            <span>{label}</span>
                            <span className="text-slate-400">{count}</span>
                          </button>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                            {key}
                          </div>
                          {isOpen && renderGrammarWordButtons(label, examples)}
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}
        {/* Interrogatives */}
        {renderSectionHeader(
          "INTERROGATIVES",
          showInterrogatives,
          () => setShowInterrogatives(!showInterrogatives),
          "interrogatives",
        )}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        {showInterrogatives && (
          <div className="space-y-2 px-3 py-2">
            {Object.keys(interrogative_lens || {}).length === 0 ? (
              <div className={panelSubtleSurfaceClass}>
                No interrogatives detected
              </div>
            ) : (
              <div className={`${panelSurfaceClass} grid gap-2`}>
                {interrogativeRows.map((row) => {
                  const confidence =
                    posConfidence?.interrogatives?.[row.key]?.level;
                  const displayValue = Array.isArray(row.value)
                    ? row.value.join(", ")
                    : String(row.value || "");
                  return (
                    <div
                      key={row.key}
                      className="grid grid-cols-[18px_88px_1fr] items-start gap-2 rounded border border-white/8 bg-[#111111] px-3 py-2 text-sm text-slate-200"
                    >
                      <span
                        className="pt-0.5 text-center text-slate-400"
                        title={confidence || "undetermined"}
                      >
                        {confidenceSymbol(confidence)}
                      </span>
                      <span className="text-slate-400">{row.label}</span>
                      <button
                        type="button"
                        onClick={() => jumpToTime(findTranscriptTimeForText(displayValue))}
                        className="text-left hover:text-slate-50"
                      >
                        {displayValue || " "}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* TENSE PROFILE */}
        {renderSectionHeader(
          "TENSE PROFILE",
          showTenseProfile,
          () => setShowTenseProfile(!showTenseProfile),
          "tense_profile",
        )}
        {showTenseProfile && (
          <div className="space-y-2 px-3 py-2">
            {!tenseProfile?.available ? (
              <div className={panelSubtleSurfaceClass}>
                {tenseProfile?.note || "No tense profile available"}
              </div>
            ) : (
              <>
                {tenseProfile?.note && (
                  <div className={panelQuietNoteClass}>
                    {tenseProfile.note}
                  </div>
                )}
                <div className={`${panelSurfaceClass} space-y-3`}>
                  {renderMorphologyGroup(
                    "tense",
                    "Tense",
                    tenseProfile?.tense_counts || {},
                    tenseProfile?.tense_examples || {},
                    tenseProfile?.tense_labels || {},
                  )}
                  {renderMorphologyGroup(
                    "verb_form",
                    "Verb Forms",
                    tenseProfile?.verb_form_counts || {},
                    tenseProfile?.verb_form_examples || {},
                    tenseProfile?.verb_form_labels || {},
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {/* POSWORDS */}
        {renderSectionHeader(
          "POS WORDS",
          showPosWords,
          () => setShowPosWords(!showPosWords),
          "pos_words",
        )}
        {/* Scrollable list container: fixed max height with vertical scrolling */}
        {showPosWords && (
          <div className="space-y-2 px-3 py-2">
            {Object.keys(pos_words || {}).length === 0 ? (
              <div className={panelSubtleSurfaceClass}>
                No POS words detected
              </div>
            ) : (
              <div className={panelSurfaceClass}>
                {POS_WORD_ROWS.map(([key, label]) => (
                  <div key={key} className="text-sm text-slate-200">
                    <span className="mr-2">{`${label}:`}</span>
                    {(pos_words?.[key] || []).length === 0 ? (
                      <span className="text-slate-500">none</span>
                    ) : (
                      (pos_words?.[key] || []).map((word: string, index: number, words: string[]) => (
                        <button
                          key={`${label}-${word}-${index}`}
                          type="button"
                          onClick={() => jumpToTime(findTranscriptTimeForText(word))}
                          className="mr-1 rounded px-1 py-0.5 hover:bg-slate-800/50 hover:text-slate-50"
                        >
                          {word}
                          {index < (words as string[]).length - 1 ? "," : ""}
                        </button>
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
