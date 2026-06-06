import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { useLayoutHost } from "../LayoutHost";
import { openVideoAtTime } from "@/lib/video-navigation";
import { normalizeTranscriptSegmentTiming } from "@/lib/transcript-time";

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
  const { openPanel } = useLayoutHost();
  const MATRIX_STORAGE_KEY = "vaa1.quant.matrix.sections";
  const MATRIX_ANALYSES_STORAGE_KEY = "vaa1.quant.matrix.analyses";
  const [videoId, setVideoId] = useState("");

  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // State for show/hide sections
  const [showBuildTokenStream, setShowBuildTokenStream] = useState(true);
  const [showCorpusSentenceWordStats, setShowCorpusSentenceWordStats] =
    useState(true);
  const [showTfidfTopTerms, setShowTfidfTopTerms] = useState(true);
  const [showBigrams, setShowBigrams] = useState(true);
  const [showSentenceTagging, setShowSentenceTagging] = useState(true);
  const [showConcordance, setShowConcordance] = useState(true);
  const [showQuantMenu, setShowQuantMenu] = useState(false);
  const [matrixSections, setMatrixSections] = useState<string[]>([]);
  const [matrixAnalysisIds, setMatrixAnalysisIds] = useState<string[]>([]);
  const [expandedEvidence, setExpandedEvidence] = useState<string[]>([]);
  const [selectedConcordanceKeyword, setSelectedConcordanceKeyword] = useState("");

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
    eventBus.on("quantMatrixSectionsChanged", handleSectionsChanged);
    eventBus.on("quantMatrixAnalysesChanged", handleAnalysesChanged);

    return () => {
      eventBus.off("quantMatrixSectionsChanged", handleSectionsChanged);
      eventBus.off("quantMatrixAnalysesChanged", handleAnalysesChanged);
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

  // Use analysisData (fallback to mock data if not available)

  const analysisDataquantAnalysis = analysisData?.quantAnalysis?.[0] ?? {}
  const transcriptSegments =
    analysisData?.transcriptTimeline || analysisData?.transcript || [];
  const sourceName = analysisData?.metadata?.sourceName;
  const compactLabel = (value?: string, maxLength = 26) => {
    if (!value) {
      return "";
    }
    if (value.length <= maxLength) {
      return value;
    }
    const dotIndex = value.lastIndexOf(".");
    const extension =
      dotIndex > 0 && value.length - dotIndex <= 6 ? value.slice(dotIndex) : "";
    const base = extension ? value.slice(0, dotIndex) : value;
    const trimmedBase = base.slice(0, Math.max(12, maxLength - extension.length - 1));
    return `${trimmedBase}…${extension}`;
  };
  const humanDocumentLabel = (() => {
    const rawDocument = analysisDataquantAnalysis.stats_df?.[0]?.Document;
    if (!rawDocument && sourceName) {
      return sourceName;
    }
    if (!rawDocument) {
      return undefined;
    }
    if (
      sourceName &&
      /_transcript\.json$/i.test(rawDocument) &&
      /^[0-9a-f-]{20,}_transcript\.json$/i.test(rawDocument)
    ) {
      return sourceName;
    }
    return rawDocument;
  })();
  const displayDocumentLabel = compactLabel(humanDocumentLabel);
  const topFrequencyTerms = Object.entries(
    analysisDataquantAnalysis.token_info?.freq_dist ?? {},
  )
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 10);
  const concordanceKeywordOptions = Array.from(
    new Set(
      [
        analysisDataquantAnalysis.concordance?.keyword,
        ...topFrequencyTerms.map(([term]) => String(term)),
        ...((analysisDataquantAnalysis.tfidf_df?.[0]?.TopTerms as string[] | undefined) || []),
      ]
        .map((term) => String(term || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 16);
  const quantEvidence = analysisDataquantAnalysis.evidence_map || {};
  const frequentTermEvidence = quantEvidence.frequent_terms || [];
  const tfidfEvidence = quantEvidence.tfidf_terms || [];
  const bigramEvidence = quantEvidence.bigrams || [];
  const sentenceTagEvidence = quantEvidence.sentence_tags || [];
  const concordanceEvidence = quantEvidence.concordance || [];
  const concordanceEntries = analysisDataquantAnalysis.concordance?.entries || [];
  const activeConcordanceKeyword =
    selectedConcordanceKeyword.trim() ||
    analysisDataquantAnalysis.concordance?.keyword ||
    "";
  const renderConcordanceContext = (entry: any) => {
    const left = String(entry?.left_context || "").trim();
    const keyword = String(entry?.keyword || "").trim();
    const right = String(entry?.right_context || "").trim();

    return (
      <div className="leading-relaxed">
        {left ? <span className="text-slate-500">... {left} </span> : null}
        <span className="rounded bg-amber-400/20 px-1 py-0.5 text-amber-200">
          {keyword}
        </span>
        {right ? <span className="text-slate-200"> {right} ...</span> : null}
      </div>
    );
  };
  const splitKeywordContext = (text: string, keyword: string) => {
    const sourceText = String(text || "");
    const target = String(keyword || "").trim();
    if (!sourceText || !target) {
      return {
        left_context: sourceText,
        keyword: target,
        right_context: "",
      };
    }
    const match = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").exec(sourceText);
    if (!match || match.index === undefined) {
      return {
        left_context: sourceText,
        keyword: target,
        right_context: "",
      };
    }
    return {
      left_context: sourceText.slice(0, match.index).trim(),
      keyword: match[0],
      right_context: sourceText.slice(match.index + match[0].length).trim(),
    };
  };
  const buildConcordanceEntriesForKeyword = (keyword: string, windowSize = 2) => {
    const normalizedKeyword = String(keyword || "").trim().toLowerCase();
    if (!normalizedKeyword) {
      return [];
    }
    return transcriptSegments
      .map((segment: any, index: number) => ({ segment, index }))
      .filter(({ segment }: { segment: any; index: number }) =>
        String(segment?.text || "").toLowerCase().includes(normalizedKeyword),
      )
      .map(({ segment, index }: { segment: any; index: number }) => {
        const startIndex = Math.max(0, index - windowSize);
        const endIndex = Math.min(transcriptSegments.length, index + windowSize + 1);
        const contextText = transcriptSegments
          .slice(startIndex, endIndex)
          .map((candidate: any) => String(candidate?.text || "").trim())
          .filter(Boolean)
          .join(" ");
        return {
          ...splitKeywordContext(contextText, keyword),
          text: contextText,
          start: segment?.start,
          end: segment?.end,
          t: segment?.t,
        };
      })
      .slice(0, 10);
  };
  const activeConcordanceEntries = activeConcordanceKeyword
    ? buildConcordanceEntriesForKeyword(activeConcordanceKeyword)
    : concordanceEntries;

  useEffect(() => {
    setSelectedConcordanceKeyword(
      analysisDataquantAnalysis.concordance?.keyword || "",
    );
  }, [analysisDataquantAnalysis.concordance?.keyword, videoId]);
  const openTranscriptReference = () => {
    if (!videoId) {
      return;
    }
    eventBus.emit("videoIdChanged", videoId);
    openPanel("Transcript");
  };
  const jumpToTime = (time: number) => {
    if (!videoId) return;
    openVideoAtTime(videoId, time);
  };
  const segmentNavigationTime = (segment: any) => {
    const timing = normalizeTranscriptSegmentTiming(segment || {});
    if (timing.start > 0 || segment?.start !== undefined || segment?.start_ms !== undefined) {
      return timing.start;
    }
    return findTranscriptTimeForText(segment?.text);
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
  const findTranscriptTimeForTerms = (terms: string[]) => {
    if (!terms.length) {
      return transcriptSegments[0]?.start ?? 0;
    }
    const matched = transcriptSegments.find((segment: any) => {
      const text = String(segment.text || "").toLowerCase();
      return terms.every((term) => text.includes(term.toLowerCase()));
    });
    return matched?.start ?? findTranscriptTimeForText(terms[0]);
  };
  const deriveTranscriptContext = (
    segment?: { text?: string; start?: number; end?: number },
    windowSize = 2,
  ) => {
    if (!segment) {
      return "";
    }
    const targetIndex = transcriptSegments.findIndex((candidate: any) => {
      const sameStart =
        segment.start !== undefined &&
        candidate?.start !== undefined &&
        Number(candidate.start) === Number(segment.start);
      const sameText =
        String(candidate?.text || "").trim() &&
        String(candidate?.text || "").trim() === String(segment.text || "").trim();
      return sameStart || sameText;
    });
    if (targetIndex < 0) {
      return segment.text || "";
    }
    const startIndex = Math.max(0, targetIndex - windowSize);
    const endIndex = Math.min(transcriptSegments.length, targetIndex + windowSize + 1);
    return transcriptSegments
      .slice(startIndex, endIndex)
      .map((candidate: any) => String(candidate?.text || "").trim())
      .filter(Boolean)
      .join(" ");
  };
  const deriveTranscriptOccurrences = (needle?: string, windowSize = 2) => {
    const normalizedNeedle = String(needle || "").trim().toLowerCase();
    if (!normalizedNeedle) {
      return [];
    }
    return transcriptSegments
      .map((segment: any, index: number) => ({ segment, index }))
      .filter(({ segment }: { segment: any; index: number }) =>
        String(segment?.text || "").toLowerCase().includes(normalizedNeedle),
      )
      .map(({ segment, index }: { segment: any; index: number }) => {
        const startIndex = Math.max(0, index - windowSize);
        const endIndex = Math.min(transcriptSegments.length, index + windowSize + 1);
        const contextText = transcriptSegments
          .slice(startIndex, endIndex)
          .map((candidate: any) => String(candidate?.text || "").trim())
          .filter(Boolean)
          .join(" ");
        return {
          text: segment?.text,
          context_text: contextText,
          start: segment?.start,
          end: segment?.end,
          t: segment?.t,
        };
      });
  };
  const renderHighlightedOccurrence = (text: string, needle?: string) => {
    const sourceText = String(text || "");
    const target = String(needle || "").trim();
    if (!sourceText || !target) {
      return <span>{sourceText}</span>;
    }
    const match = new RegExp(`(${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    const parts = sourceText.split(match);
    return (
      <span>
        {parts.map((part, index) =>
          part.toLowerCase() === target.toLowerCase() ? (
            <span
              key={`${target}-${index}`}
              className="rounded bg-amber-400/20 px-1 py-0.5 text-amber-200"
            >
              {part}
            </span>
          ) : (
            <span key={`${part}-${index}`}>{part}</span>
          ),
        )}
      </span>
    );
  };
  const toggleEvidence = (key: string) => {
    setExpandedEvidence((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };
  const renderEvidenceSnippets = (key: string, snippets: string[], fallbackNeedle?: string) => {
    const isOpen = expandedEvidence.includes(key);
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => toggleEvidence(key)}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          {isOpen ? "hide evidence" : "evidence"}
        </button>
        {isOpen && (
          <div className="mt-2 space-y-2">
            {(snippets.length > 0 ? snippets : fallbackNeedle ? [fallbackNeedle] : []).map(
              (snippet, index) => (
                <button
                  key={`${key}-${index}`}
                  type="button"
                  onClick={() => jumpToTime(findTranscriptTimeForText(snippet))}
                  className="block w-full rounded-md bg-slate-900/35 px-2.5 py-2 text-left text-xs text-slate-200 hover:bg-slate-900/60 hover:text-slate-50"
                >
                  {snippet}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    );
  };
  const renderEvidenceSegments = (
    key: string,
    segmentRefs: Array<{ text?: string; context_text?: string; start?: number; end?: number; t?: string }>,
    snippets: string[],
    fallbackNeedle?: string,
  ) => {
    const isOpen = expandedEvidence.includes(key);
    const derivedOccurrences =
      segmentRefs.length === 0 && fallbackNeedle
        ? deriveTranscriptOccurrences(fallbackNeedle)
        : [];
    const displaySegments = segmentRefs.length > 0 ? segmentRefs : derivedOccurrences;
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => toggleEvidence(key)}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          {isOpen ? "hide evidence" : "evidence"}
        </button>
        {isOpen && (
          <div className="mt-2 space-y-2">
            {displaySegments.length > 0
              ? displaySegments.map((segment: any, index: number) => (
                  <button
                    key={`${key}-segment-${index}`}
                    type="button"
                    onClick={() => jumpToTime(segmentNavigationTime(segment))}
                    className="block w-full rounded-md bg-slate-900/35 px-2.5 py-2 text-left text-xs text-slate-200 hover:bg-slate-900/60 hover:text-slate-50"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                      <span>{index + 1}.</span>
                      <span>{segment.t || `${segment.start ?? 0}s - ${segment.end ?? 0}s`}</span>
                    </div>
                    <div className="leading-relaxed">
                      {renderHighlightedOccurrence(
                        segment.text || fallbackNeedle || "",
                        fallbackNeedle,
                      )}
                    </div>
                  </button>
                ))
              : (snippets.length > 0 ? snippets : fallbackNeedle ? [fallbackNeedle] : []).map(
                  (snippet, index) => (
                    <button
                      key={`${key}-${index}`}
                      type="button"
                      onClick={() => jumpToTime(findTranscriptTimeForText(snippet))}
                      className="block w-full rounded-md bg-slate-900/35 px-2.5 py-2 text-left text-xs text-slate-200 hover:bg-slate-900/60 hover:text-slate-50"
                    >
                      <div className="mb-1 text-[11px] text-slate-400">{index + 1}.</div>
                      <div className="leading-relaxed">
                        {renderHighlightedOccurrence(snippet, fallbackNeedle)}
                      </div>
                    </button>
                  ),
                )}
          </div>
        )}
      </div>
    );
  };
  const openQuantMatrix = () => {
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
      eventBus.emit("quantMatrixAnalysesChanged", nextIds);
    }
    setShowQuantMenu(false);
    openPanel("QuantMatrix", { videoId });
  };
  const addCurrentAnalysisToQuantMatrix = () => {
    if (!videoId) {
      setShowQuantMenu(false);
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
    eventBus.emit("quantMatrixAnalysesChanged", nextIds);
    setShowQuantMenu(false);
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
        eventBus.emit("quantMatrixAnalysesChanged", nextAnalysisIds);
      }
      eventBus.emit("quantMatrixSectionsChanged", next);
      return next;
    });
  };
  const currentAnalysisInMatrix = !!videoId && matrixAnalysisIds.includes(videoId);
  const matrixToggleLabel = (section: string) =>
    matrixSections.includes(section) && currentAnalysisInMatrix
      ? "In Matrix"
      : "Add to Quant Matrix";
  const summaryChips = [
    analysisDataquantAnalysis.stats_df?.[0]?.Words !== undefined
      ? `${analysisDataquantAnalysis.stats_df[0].Words} words`
      : null,
    analysisDataquantAnalysis.token_info?.tokens_filtered?.length !== undefined
      ? `${analysisDataquantAnalysis.token_info.tokens_filtered.length} filtered`
      : null,
    analysisDataquantAnalysis.token_info?.ttr !== undefined
      ? `TTR ${Number(analysisDataquantAnalysis.token_info.ttr)
          .toFixed(3)
          .replace(/\.?0+$/, "")}`
      : null,
    analysisDataquantAnalysis.concordance?.keyword
      ? `concordance ${analysisDataquantAnalysis.concordance.keyword}`
      : null,
  ].filter(Boolean);

  /*
  const analysisDataquantAnalysis = analysisData?.quantAnalysis.[0] ?? {
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
  */

  // console.log(analysisDataquantAnalysis.token_info.tokens[1])

  const renderSectionHeader = (
    title: string,
    open: boolean,
    onToggleOpen: () => void,
    matrixKey: string,
  ) => (
    <div className="border-b border-white/8 shrink-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={onToggleOpen}
          className="flex min-w-0 flex-1 items-center justify-between rounded px-1 py-1 transition-colors hover:bg-white/5"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            {title}
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
          title={matrixToggleLabel(matrixKey)}
        >
          {matrixSections.includes(matrixKey) && currentAnalysisInMatrix
            ? "Matrix On"
            : "Add to Matrix"}
        </button>
      </div>
    </div>
  );

  const panelHeaderClass =
    "border-b border-white/8 bg-[#141414] px-3 py-2 flex items-center justify-between shrink-0";
  const panelSurfaceClass =
    "rounded border border-white/8 bg-[#151515] px-3 py-3";
  const panelSubtleSurfaceClass =
    "rounded border border-white/8 bg-[#171717] px-3 py-3 text-slate-300";
  const panelMetricTileClass =
    "rounded border border-white/8 bg-[#111111] px-3 py-2 text-sm text-slate-200";
  const panelChipClass =
    "rounded-full border border-white/10 bg-[#101010] px-2.5 py-1 text-[11px] text-slate-300";

  return (
    <main className="h-full flex flex-col overflow-hidden">
      <div className="text-xs text-slate-400 px-3 py-2 shrink-0">
        video Id: {videoId}
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className={panelHeaderClass}>
          <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
            Quant governance
          </span>
          <div className="relative flex items-center gap-1">
            <button className="p-1 hover:bg-[#2a2a2a] rounded">
              <Search className="size-3.5 text-[#b8b8b8]" />
            </button>
            <button
              type="button"
              onClick={() => setShowQuantMenu((current) => !current)}
              className="p-1 hover:bg-[#2a2a2a] rounded"
            >
              <MoreHorizontal className="size-3.5 text-[#b8b8b8]" />
            </button>
            {showQuantMenu && (
              <div className="absolute right-0 top-7 z-10 min-w-44 rounded-md border border-slate-700 bg-[#171717] p-1 shadow-lg">
                <button
                  type="button"
                  onClick={addCurrentAnalysisToQuantMatrix}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/70"
                >
                  Add Current Analysis to Quant Matrix
                </button>
                <button
                  type="button"
                  onClick={openQuantMatrix}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/70"
                >
                  Open Quant Matrix
                </button>
              </div>
            )}
          </div>
        </div>
        {summaryChips.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 py-3">
            {humanDocumentLabel && (
              <button
                type="button"
                onClick={openTranscriptReference}
                title={humanDocumentLabel}
                className="rounded-full border border-white/10 bg-[#101010] px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/5 hover:text-slate-50"
              >
                source {displayDocumentLabel}
              </button>
            )}
            {summaryChips.map((chip) => (
              <span key={chip} className={panelChipClass} title={chip ?? undefined}>
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Build Token Stream (uses token_info from mock/analysis) */}
        {renderSectionHeader(
          "Token Info",
          showBuildTokenStream,
          () => setShowBuildTokenStream(!showBuildTokenStream),
          "token_info",
        )}

        {/* stats_df */}
        {showBuildTokenStream && (
          <div className="space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.token_info ||
            Object.keys(analysisDataquantAnalysis.token_info).length === 0 ? (
              <div className={panelSubtleSurfaceClass}>
                No token information detected
              </div>
            ) : (
              <div className={panelSurfaceClass}>
                <div className="grid gap-2 md:grid-cols-2">
                <div className={panelMetricTileClass}>
                  {"Total tokens: " +
                    (analysisDataquantAnalysis.token_info.tokens?.length ?? 0)}
                </div>
                <div className={panelMetricTileClass}>
                  {"Filtered tokens: " +
                    (analysisDataquantAnalysis.token_info.tokens_filtered
                      ?.length ?? 0)}
                </div>
                <div className={panelMetricTileClass}>
                  {"Type-token ratio (TTR): " +
                    Number(analysisDataquantAnalysis.token_info.ttr)
                      .toFixed(3)
                      .replace(/\.?0+$/, "")}
                </div>
                <div className={panelMetricTileClass}>
                  {"Unique terms: " +
                    Object.keys(
                      analysisDataquantAnalysis.token_info.freq_dist ?? {},
                    ).length}
                </div>
                </div>
                {topFrequencyTerms.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      Most frequent terms
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {topFrequencyTerms.map(([term, count]) => {
                        return (
                          <div key={term} className="rounded border border-white/8 bg-[#111111] px-2.5 py-2">
                            <div className="rounded-full border border-white/10 bg-[#101010] px-2.5 py-1 text-xs text-slate-200">
                              {term} ({String(count)})
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Corpus Sentence Word Stats */}
        {renderSectionHeader(
          "Corpus Sentence Word Stats",
          showCorpusSentenceWordStats,
          () => setShowCorpusSentenceWordStats(!showCorpusSentenceWordStats),
          "corpus_stats",
        )}
        {showCorpusSentenceWordStats && (
          <div className="space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.stats_df ||
            analysisDataquantAnalysis.stats_df.length === 0 ? (
              <div className={panelSubtleSurfaceClass}>
                No content detected
              </div>
            ) : (
              <div className={`${panelSurfaceClass} grid gap-2 md:grid-cols-3`}>
                <div className={panelMetricTileClass}>
                  {"sentences: " +
                    analysisDataquantAnalysis.stats_df[0].Sentences}
                </div>
                <div className={panelMetricTileClass}>
                  {"words: " +
                    analysisDataquantAnalysis.stats_df[0].Words}
                </div>
                <div className={panelMetricTileClass}>
                  {"avg sentence length: " +
                    (
                      analysisDataquantAnalysis.stats_df[0].Sentences > 0
                        ? (
                            analysisDataquantAnalysis.stats_df[0].Words /
                            analysisDataquantAnalysis.stats_df[0].Sentences
                          ).toFixed(1)
                        : "0"
                    )}
                </div>
              </div>
            )}
          </div>
        )}
        {/* TFIDF Top Terms */}
        {renderSectionHeader(
          "TFIDF Top Terms",
          showTfidfTopTerms,
          () => setShowTfidfTopTerms(!showTfidfTopTerms),
          "tfidf",
        )}
        {/* Scrollable list container: responsive height with vertical scrolling */}
        {showTfidfTopTerms && (
          <div className="space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.tfidf_df ||
            analysisDataquantAnalysis.tfidf_df.length === 0 ? (
              <div className={panelSubtleSurfaceClass}>
                No TFIDF Top Terms detected
              </div>
            ) : (
              <div className={panelSurfaceClass}>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {analysisDataquantAnalysis.tfidf_df[0].TopTerms.map(
                    (term: string) => {
                      const evidence =
                        tfidfEvidence.find((item: any) => item?.term === term) || {};
                      return (
                        <div key={term} className="rounded border border-white/8 bg-[#111111] px-2.5 py-2">
                          <button
                            type="button"
                            onClick={() => jumpToTime(findTranscriptTimeForText(term))}
                            className="rounded-full border border-white/10 bg-[#101010] px-2.5 py-1 text-xs text-slate-200 hover:bg-white/5"
                          >
                            {term}
                          </button>
                          {renderEvidenceSegments(
                            `tfidf-${term}`,
                            evidence?.segment_refs || [],
                            evidence?.snippets || [],
                            term,
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SentenceTagging */}
        {renderSectionHeader(
          "Sentence Tagging",
          showSentenceTagging,
          () => setShowSentenceTagging(!showSentenceTagging),
          "sentence_tags",
        )}
        {/* Scrollable list container: responsive height with vertical scrolling */}
        {showSentenceTagging && (
          <div className="space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.sentence_tags ||
            analysisDataquantAnalysis.sentence_tags.length === 0 ? (
              <div className={panelSubtleSurfaceClass}>
                No SentenceTagging detected
              </div>
            ) : (
              <div className={panelSurfaceClass}>
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
                      <button
                        type="button"
                        onClick={() => jumpToTime(findTranscriptTimeForText(item.sentence))}
                        className="mb-1 text-left text-sm text-slate-200 hover:text-slate-50"
                      >
                        {item.sentence}
                      </button>
                      <div className="text-xs text-slate-300 flex gap-2">
                        <span className={`rounded-full px-2 py-0.5 ${item.WHO ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800/45 text-slate-400"}`}>
                          WHO {item.WHO ? "yes" : "no"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 ${item.WHY ? "bg-amber-500/15 text-amber-200" : "bg-slate-800/45 text-slate-400"}`}>
                          WHY {item.WHY ? "yes" : "no"}
                        </span>
                      </div>
                      {renderEvidenceSegments(
                        `sentence-${index}`,
                        (
                          sentenceTagEvidence.find((entry: any) => entry?.sentence === item.sentence)
                            ?.segment_refs || []
                        ),
                        [item.sentence],
                        item.sentence,
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {/* Bigrams */}
        {renderSectionHeader(
          "Bigrams",
          showBigrams,
          () => setShowBigrams(!showBigrams),
          "bigrams",
        )}
        {/* Scrollable list container: responsive height with vertical scrolling */}
        {showBigrams && (
          <div className="space-y-2 px-3 py-2">
            {!analysisDataquantAnalysis.bigrams ||
            analysisDataquantAnalysis.bigrams.length === 0 ? (
              <div className={panelSubtleSurfaceClass}>
                No Bigrams detected
              </div>
            ) : (
              <div className={panelSurfaceClass}>
                {analysisDataquantAnalysis.bigrams.map(
                  (bigram: string, index: number) => (
                    <div
                      key={index}
                      className="mb-2 border-b border-slate-600/40 pb-2 last:border-b-0 last:pb-0"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          jumpToTime(
                            findTranscriptTimeForTerms(
                              String(bigram)
                                .split(/\s+/)
                                .filter(Boolean),
                            ),
                          )
                        }
                        className="flex items-center gap-2 text-left text-sm text-slate-200 hover:text-slate-50"
                      >
                        <span className="text-xs text-slate-400">
                          {index + 1}.
                        </span>
                        <span>{bigram}</span>
                      </button>
                      {renderEvidenceSegments(
                        `bigram-${index}`,
                        (
                          bigramEvidence.find(
                            (entry: any) => entry?.phrase === String(bigram),
                          )?.segment_refs || []
                        ),
                        (
                          bigramEvidence.find(
                            (entry: any) => entry?.phrase === String(bigram),
                          )?.snippets || []
                        ),
                        String(bigram),
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {/* Concordance */}
        {renderSectionHeader(
          "Concordance",
          showConcordance,
          () => setShowConcordance(!showConcordance),
          "concordance",
        )}
        {showConcordance && (
          <div className="space-y-2 px-3 py-2">
            {!activeConcordanceKeyword ? (
              <div className={panelSubtleSurfaceClass}>
                No concordance available
              </div>
            ) : (
              <div className={panelSurfaceClass}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <label className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      Concordance Word
                    </label>
                    <input
                      type="text"
                      value={selectedConcordanceKeyword}
                      onChange={(event) => setSelectedConcordanceKeyword(event.target.value)}
                      className="rounded border border-white/10 bg-[#111111] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                      placeholder="Type any word"
                    />
                  </div>
                  {concordanceKeywordOptions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {concordanceKeywordOptions.map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => setSelectedConcordanceKeyword(term)}
                          className={`rounded-full px-2.5 py-1 text-[11px] ${
                            term.toLowerCase() === activeConcordanceKeyword.toLowerCase()
                              ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                              : "border border-white/10 bg-[#101010] text-slate-300 hover:bg-white/5 hover:text-slate-100"
                          }`}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 text-sm text-slate-200">
                  {"keyword: " + activeConcordanceKeyword}
                </div>
                {activeConcordanceEntries.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-300">
                    No keyword-in-context lines detected
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {activeConcordanceEntries.map(
                      (entry: any, index: number) => (
                        <div
                          key={`${activeConcordanceKeyword}-${index}`}
                          className="rounded border border-white/8 bg-[#111111] px-3 py-2 text-sm text-slate-200"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              jumpToTime(
                                entry.start ?? findTranscriptTimeForText(entry.text || entry.right_context),
                              )
                            }
                            className="text-left hover:text-slate-50"
                          >
                            <div className="mb-1 text-[11px] text-slate-400">
                              {entry.t || `${index + 1}.`}
                            </div>
                            {renderConcordanceContext(entry)}
                          </button>
                          {renderEvidenceSegments(
                            `concordance-${index}`,
                            (
                          concordanceEvidence.find((evidenceEntry: any) => evidenceEntry?.line === (entry.text || entry.right_context))
                            ?.segment_refs || []
                            ),
                        [entry.text || entry.right_context],
                        activeConcordanceKeyword,
                      )}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
