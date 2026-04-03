import React, { useEffect, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type AnalysisData } from "@/lib/video-service";
import { apiService } from "@/lib/api-service";
import { useLayoutHost } from "../LayoutHost";

const MATRIX_STORAGE_KEY = "vaa1.quant.matrix.sections";
const MATRIX_ANALYSES_STORAGE_KEY = "vaa1.quant.matrix.analyses";
const SECTION_ORDER = [
  "token_info",
  "corpus_stats",
  "tfidf",
  "sentence_tags",
  "bigrams",
  "concordance",
] as const;

const SECTION_LABELS: Record<string, string> = {
  token_info: "Token Info",
  corpus_stats: "Corpus Stats",
  tfidf: "TFIDF Top Terms",
  sentence_tags: "Sentence Tagging",
  bigrams: "Bigrams",
  concordance: "Concordance",
};

function downloadTextFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeSectionOrder(sections: string[]) {
  const uniqueSections = Array.from(new Set(sections));
  const knownSections = SECTION_ORDER.filter((section) => uniqueSections.includes(section));
  const extraSections = uniqueSections.filter((section) => !SECTION_ORDER.includes(section as any));
  return [...knownSections, ...extraSections];
}

function buildQuantMatrixPayload(
  analysisRows: Array<{ id: string; sourceName: string; analysisData: AnalysisData | null }>,
  selectedSections: string[],
) {
  const analyses = analysisRows.map((row) => {
    const quant = row.analysisData?.quantAnalysis?.[0];
    const stats = quant?.stats_df?.[0];
    const freqDist = quant?.token_info?.freq_dist ?? {};
    const topFrequencyTerms = Object.entries(freqDist)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 10)
      .map(([term, count]) => ({ term, count }));
    const bigramPreview = (quant?.bigrams ?? []).slice(0, 10).map((bigram) =>
      Array.isArray(bigram) ? bigram.join(" ") : String(bigram),
    );

    return {
      analysis_id: row.id,
      source_name: row.sourceName,
      token_info: {
        total_tokens: quant?.token_info?.tokens?.length ?? 0,
        filtered_tokens: quant?.token_info?.tokens_filtered?.length ?? 0,
        ttr: quant?.token_info?.ttr ?? 0,
        unique_terms: Object.keys(freqDist).length,
        most_frequent_terms: topFrequencyTerms,
      },
      corpus_stats: {
        sentences: stats?.Sentences ?? 0,
        words: stats?.Words ?? 0,
        avg_sentence_length: stats?.Sentences
          ? Number((Number(stats?.Words ?? 0) / Number(stats.Sentences)).toFixed(2))
          : 0,
      },
      tfidf_top_terms: quant?.tfidf_df?.[0]?.TopTerms ?? [],
      sentence_tagging: {
        who_hits: quant?.sentence_tags?.filter((item) => item.WHO).length ?? 0,
        why_hits: quant?.sentence_tags?.filter((item) => item.WHY).length ?? 0,
      },
      bigrams: bigramPreview,
      concordance: {
        keyword: quant?.concordance?.keyword ?? null,
        lines: quant?.concordance?.lines ?? [],
      },
    };
  });

  return {
    selected_sections: selectedSections,
    analyses,
  };
}

export default function QuantMatrixPanel({
  videoId: initialVideoId = "",
}: {
  videoId?: string;
}) {
  const { openPanel } = useLayoutHost();
  const [sourceName, setSourceName] = useState("No analysis selected");
  const [matrixAnalysisIds, setMatrixAnalysisIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return initialVideoId ? [initialVideoId] : [];
    }
    const stored = window.localStorage.getItem(MATRIX_ANALYSES_STORAGE_KEY);
    if (!stored) {
      return initialVideoId ? [initialVideoId] : [];
    }
    try {
      const parsed = JSON.parse(stored);
      if (
        initialVideoId &&
        Array.isArray(parsed) &&
        !parsed.includes(initialVideoId)
      ) {
        return [...parsed, initialVideoId];
      }
      return parsed;
    } catch {
      return initialVideoId ? [initialVideoId] : [];
    }
  });
  const [analysisRows, setAnalysisRows] = useState<
    Array<{ id: string; sourceName: string; analysisData: AnalysisData | null }>
  >([]);
  const [availableAnalyses, setAvailableAnalyses] = useState<
    Array<{ id: string; name: string; status?: string }>
  >([]);
  const [selectedSections, setSelectedSections] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    const stored = window.localStorage.getItem(MATRIX_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    try {
      return normalizeSectionOrder(JSON.parse(stored));
    } catch {
      return [];
    }
  });
  const [expandedCells, setExpandedCells] = useState<string[]>([]);
  const [selectedConcordanceKeywords, setSelectedConcordanceKeywords] = useState<Record<string, string>>({});
  const [showMatrixControls, setShowMatrixControls] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([...SECTION_ORDER]);
  const [showAnalysisList, setShowAnalysisList] = useState(false);

  const updateSelectedSections = (next: string[]) => {
    const normalized = normalizeSectionOrder(next);
    setSelectedSections(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(normalized));
    }
    eventBus.emit("quantMatrixSectionsChanged", normalized);
  };

  const toggleSection = (section: string) => {
    const next = selectedSections.includes(section)
      ? selectedSections.filter((item) => item !== section)
      : [...selectedSections, section];
    updateSelectedSections(next);
  };

  const removeSection = (section: string) => {
    if (!selectedSections.includes(section)) {
      return;
    }
    updateSelectedSections(selectedSections.filter((item) => item !== section));
  };
  const orderedSelectedSections = normalizeSectionOrder(selectedSections);
  const visibleSections = orderedSelectedSections.filter(
    (section) => !collapsedSections.includes(section),
  );

  const updateMatrixAnalysisIds = (next: string[]) => {
    setMatrixAnalysisIds(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MATRIX_ANALYSES_STORAGE_KEY, JSON.stringify(next));
    }
    eventBus.emit("quantMatrixAnalysesChanged", next);
  };

  const hideAnalysisColumn = (analysisId: string) => {
    updateMatrixAnalysisIds(matrixAnalysisIds.filter((id) => id !== analysisId));
  };

  const addAnalysisColumn = (analysisId: string) => {
    if (matrixAnalysisIds.includes(analysisId)) {
      return;
    }
    updateMatrixAnalysisIds([...matrixAnalysisIds, analysisId]);
  };

  const toggleCollapsedSection = (section: string) => {
    setCollapsedSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  };

  const expandAllRows = () => {
    setCollapsedSections([]);
  };

  const collapseAllRows = () => {
    setCollapsedSections([...SECTION_ORDER]);
  };

  useEffect(() => {
    const handleSectionsChanged = (sections: string[]) => {
      setSelectedSections(normalizeSectionOrder(sections));
    };
    const handleAnalysesChanged = (ids: string[]) => {
      setMatrixAnalysisIds(ids);
    };

    eventBus.on("quantMatrixSectionsChanged", handleSectionsChanged);
    eventBus.on("quantMatrixAnalysesChanged", handleAnalysesChanged);

    return () => {
      eventBus.off("quantMatrixSectionsChanged", handleSectionsChanged);
      eventBus.off("quantMatrixAnalysesChanged", handleAnalysesChanged);
    };
  }, []);

  useEffect(() => {
    async function loadAvailableAnalyses() {
      try {
        const videos = await VideoService.list(200);
        setAvailableAnalyses(
          videos
            .filter((video) => video.status === "completed")
            .map((video) => ({
              id: video.id,
              name: video.name || "Selected analysis",
              status: video.status,
            })),
        );
      } catch {
        setAvailableAnalyses([]);
      }
    }
    void loadAvailableAnalyses();
  }, []);

  useEffect(() => {
    async function loadRows() {
      if (matrixAnalysisIds.length === 0) {
        setSourceName("No analysis selected");
        setAnalysisRows([]);
        return;
      }
      const rows = await Promise.all(
        matrixAnalysisIds.map(async (analysisId) => {
          try {
            const [video, analysis] = await Promise.all([
              VideoService.get(analysisId),
              VideoService.getAnalysis(analysisId),
            ]);
            return {
              id: analysisId,
              sourceName: video.name || "Selected analysis",
              analysisData: analysis,
            };
          } catch {
            return {
              id: analysisId,
              sourceName: "Selected analysis",
              analysisData: null,
            };
          }
        }),
      );
      const validRows = rows.filter((row) => row.analysisData !== null);
      const validIds = validRows.map((row) => row.id);
      if (validIds.length !== matrixAnalysisIds.length) {
        setMatrixAnalysisIds(validIds);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(MATRIX_ANALYSES_STORAGE_KEY, JSON.stringify(validIds));
        }
        eventBus.emit("quantMatrixAnalysesChanged", validIds);
      }
      setAnalysisRows(validRows);
      setSourceName(validRows[0]?.sourceName || "Selected analysis");
    }
    void loadRows();
  }, [matrixAnalysisIds]);

  useEffect(() => {
    if (selectedSections.length === 0 || analysisRows.length === 0) {
      return;
    }
    const payload = buildQuantMatrixPayload(analysisRows, selectedSections);

    void Promise.allSettled(
      analysisRows.map((row) => apiService.saveQuantMatrixSnapshot(row.id, payload)),
    );
  }, [selectedSections, analysisRows]);

  useEffect(() => {
    if (
      analysisRows.length > 0 &&
      selectedSections.length > 0 &&
      !selectedSections.includes("concordance")
    ) {
      const hasConcordanceCandidates = analysisRows.some((row) => {
        const quant = row.analysisData?.quantAnalysis?.[0];
        const freqDist = quant?.token_info?.freq_dist ?? {};
        const tfidfTerms = quant?.tfidf_df?.[0]?.TopTerms ?? [];
        return (
          Boolean(quant?.concordance?.keyword) ||
          Object.keys(freqDist).length > 0 ||
          tfidfTerms.length > 0
        );
      });
      if (hasConcordanceCandidates) {
        updateSelectedSections([...selectedSections, "concordance"]);
      }
    }
  }, [analysisRows, selectedSections]);

  const jumpToAnalysisTime = (analysisId: string, time: number) => {
    eventBus.emit("videoIdChanged", analysisId);
    eventBus.emit("videoTimeLineChanged", Math.max(0, time));
  };

  const openAnalysisPanel = (analysisId: string, panelType: string) => {
    eventBus.emit("videoIdChanged", analysisId);
    openPanel(panelType, { videoId: analysisId });
  };

  const findTranscriptTimeForText = (
    analysisData: AnalysisData | null,
    needle?: string,
  ) => {
    const segments = analysisData?.transcript || [];
    const normalizedNeedle = String(needle || "").trim().toLowerCase();
    if (!normalizedNeedle) {
      return segments[0]?.start ?? 0;
    }
    const matched = segments.find((segment: any) =>
      String(segment.text || "").toLowerCase().includes(normalizedNeedle),
    );
    return matched?.start ?? segments[0]?.start ?? 0;
  };

  const findTranscriptTimeForTerms = (
    analysisData: AnalysisData | null,
    terms: string[],
  ) => {
    const segments = analysisData?.transcript || [];
    if (!terms.length) {
      return segments[0]?.start ?? 0;
    }
    const matched = segments.find((segment: any) => {
      const text = String(segment.text || "").toLowerCase();
      return terms.every((term) => text.includes(term.toLowerCase()));
    });
    return matched?.start ?? findTranscriptTimeForText(analysisData, terms[0]);
  };
  const deriveTranscriptContext = (
    analysisData: AnalysisData | null,
    segment?: { text?: string; start?: number; end?: number },
    windowSize = 2,
  ) => {
    const segments = analysisData?.transcript || [];
    if (!segment || segments.length === 0) {
      return segment?.text || "";
    }
    const targetIndex = segments.findIndex((candidate: any) => {
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
    const endIndex = Math.min(segments.length, targetIndex + windowSize + 1);
    return segments
      .slice(startIndex, endIndex)
      .map((candidate: any) => String(candidate?.text || "").trim())
      .filter(Boolean)
      .join(" ");
  };
  const deriveTranscriptOccurrences = (
    analysisData: AnalysisData | null,
    needle?: string,
    windowSize = 2,
  ) => {
    const segments = analysisData?.transcript || [];
    const normalizedNeedle = String(needle || "").trim().toLowerCase();
    if (!normalizedNeedle) {
      return [];
    }
    return segments
      .map((segment: any, index: number) => ({ segment, index }))
      .filter(({ segment }) =>
        String(segment?.text || "").toLowerCase().includes(normalizedNeedle),
      )
      .map(({ segment, index }) => {
        const startIndex = Math.max(0, index - windowSize);
        const endIndex = Math.min(segments.length, index + windowSize + 1);
        const contextText = segments
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
              className="bg-amber-300/10 text-amber-100"
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

  const toggleExpandedCell = (key: string) => {
    setExpandedCells((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const renderConcordanceContext = (entry: any) => {
    const left = String(entry?.left_context || "").trim();
    const keyword = String(entry?.keyword || "").trim();
    const right = String(entry?.right_context || "").trim();

    return (
      <div className="leading-relaxed">
        {left ? <span className="text-slate-500">... {left} </span> : null}
        <span className="bg-amber-300/10 text-amber-100">
          {keyword}
        </span>
        {right ? <span className="text-slate-300"> {right} ...</span> : null}
      </div>
    );
  };
  const splitKeywordContext = (text: string, keyword: string) => {
    const sourceText = String(text || "");
    const target = String(keyword || "").trim();
    if (!sourceText || !target) {
      return { left_context: sourceText, keyword: target, right_context: "" };
    }
    const match = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").exec(sourceText);
    if (!match || match.index === undefined) {
      return { left_context: sourceText, keyword: target, right_context: "" };
    }
    return {
      left_context: sourceText.slice(0, match.index).trim(),
      keyword: match[0],
      right_context: sourceText.slice(match.index + match[0].length).trim(),
    };
  };

  const buildConcordanceEntriesForKeyword = (
    analysisData: AnalysisData | null,
    keyword: string,
    windowSize = 2,
  ) => {
    const segments = analysisData?.transcript || [];
    const normalizedKeyword = String(keyword || "").trim().toLowerCase();
    if (!normalizedKeyword) {
      return [];
    }
    return segments
      .map((segment: any, index: number) => ({ segment, index }))
      .filter(({ segment }: { segment: any; index: number }) =>
        String(segment?.text || "").toLowerCase().includes(normalizedKeyword),
      )
      .map(({ segment, index }: { segment: any; index: number }) => {
        const startIndex = Math.max(0, index - windowSize);
        const endIndex = Math.min(segments.length, index + windowSize + 1);
        const contextText = segments
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

  const renderOrderedEvidenceList = (
    analysisId: string,
    analysisData: AnalysisData | null,
    key: string,
    segmentRefs: Array<{ text?: string; context_text?: string; start?: number; end?: number; t?: string }>,
    snippets: string[],
    fallbackNeedle?: string,
  ) => {
    const isExpanded = expandedCells.includes(key);
    const resolvedSegments =
      segmentRefs.length > 0
        ? segmentRefs
        : deriveTranscriptOccurrences(analysisData, fallbackNeedle);
    const displaySegments = isExpanded ? resolvedSegments : resolvedSegments.slice(0, 3);
    const displaySnippets = isExpanded ? snippets : snippets.slice(0, 3);

    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => toggleExpandedCell(key)}
          className={`mb-2 text-[10px] ${
            isExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          evidence
        </button>
        {isExpanded || segmentRefs.length > 0 || snippets.length > 0 ? (
          <div className="space-y-1.5">
            {displaySegments.length > 0
              ? displaySegments.map((segment, index) => (
                  <button
                    key={`${key}-segment-${index}`}
                    type="button"
                    onClick={() =>
                      jumpToAnalysisTime(
                        analysisId,
                        segment.start ?? findTranscriptTimeForText(analysisData, segment.text),
                      )
                    }
                    className="block w-full border-l border-slate-800/80 px-2 py-1 text-left text-[11px] text-slate-300 hover:border-slate-600 hover:bg-slate-900/25 hover:text-slate-100"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-slate-500">
                      <span>{index + 1}.</span>
                      <span>{segment.t || ""}</span>
                    </div>
                    <div className="leading-relaxed">
                      {renderHighlightedOccurrence(
                        segment.text || fallbackNeedle || "",
                        fallbackNeedle,
                      )}
                    </div>
                  </button>
                ))
              : displaySnippets.map((snippet, index) => (
                  <button
                    key={`${key}-snippet-${index}`}
                    type="button"
                    onClick={() =>
                      jumpToAnalysisTime(
                        analysisId,
                        findTranscriptTimeForText(analysisData, snippet),
                      )
                    }
                    className="block w-full border-l border-slate-800/80 px-2 py-1 text-left text-[11px] text-slate-300 hover:border-slate-600 hover:bg-slate-900/25 hover:text-slate-100"
                  >
                    <div className="mb-1 text-[10px] text-slate-500">{index + 1}.</div>
                    <div className="leading-relaxed">
                      {renderHighlightedOccurrence(snippet, fallbackNeedle)}
                    </div>
                  </button>
                ))}
          </div>
        ) : null}
      </div>
    );
  };

  const compactLabel = (value: string, maxLength = 24) => {
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

  const renderSectionPreview = (
    section: string,
    analysisId: string,
    analysisData: AnalysisData | null,
  ) => {
    const quant = analysisData?.quantAnalysis?.[0];
    const stats = quant?.stats_df?.[0];
    const topTerms = quant?.tfidf_df?.[0]?.TopTerms?.slice(0, 6) ?? [];
    const uniqueTermCount = Object.keys(quant?.token_info?.freq_dist ?? {}).length;
    const frequentTerms = Object.entries(quant?.token_info?.freq_dist ?? {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6);
    const tfidfEvidence = quant?.evidence_map?.tfidf_terms ?? [];
    const bigramEvidence = quant?.evidence_map?.bigrams ?? [];
    const sentenceTagEvidence = quant?.evidence_map?.sentence_tags ?? [];
    const concordanceEvidence = quant?.evidence_map?.concordance ?? [];
    const concordanceKeywordOptions = Array.from(
      new Set(
        [
          quant?.concordance?.keyword,
          ...frequentTerms.map(([term]) => String(term)),
          ...((quant?.tfidf_df?.[0]?.TopTerms as string[] | undefined) || []),
        ]
          .map((term) => String(term || "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 12);
    const activeConcordanceKeyword =
      selectedConcordanceKeywords[analysisId]?.trim() ||
      quant?.concordance?.keyword ||
      "";
    const whoCount = quant?.sentence_tags?.filter((item) => item.WHO).length ?? 0;
    const whyCount = quant?.sentence_tags?.filter((item) => item.WHY).length ?? 0;
    const bigrams = (quant?.bigrams ?? []).slice(0, 4);
    const concordanceEntries = activeConcordanceKeyword
      ? buildConcordanceEntriesForKeyword(analysisData, activeConcordanceKeyword)
      : [];

    if (!quant) {
      return (
        <div className="mt-2 text-sm text-slate-400">
          No Quant data loaded yet for this analysis.
        </div>
      );
    }

    switch (section) {
      case "token_info": {
        const tokenCellKey = `${analysisId}:${section}`;
        const tokenExpanded = expandedCells.includes(tokenCellKey);
        return (
          <div className="space-y-3 text-sm text-slate-300">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="border-b border-slate-800/70 pb-1">
                <span className="text-slate-500">Tokens</span>
                <span className="ml-2 text-slate-200">{quant.token_info?.tokens?.length ?? 0}</span>
              </div>
              <div className="border-b border-slate-800/70 pb-1">
                <span className="text-slate-500">Filtered</span>
                <span className="ml-2 text-slate-200">{quant.token_info?.tokens_filtered?.length ?? 0}</span>
              </div>
              <div className="border-b border-slate-800/70 pb-1">
                <span className="text-slate-500">TTR</span>
                <span className="ml-2 text-slate-200">
                  {Number(quant.token_info?.ttr ?? 0).toFixed(3).replace(/\.?0+$/, "")}
                </span>
              </div>
              <div className="border-b border-slate-800/70 pb-1">
                <span className="text-slate-500">Unique terms</span>
                <span className="ml-2 text-slate-200">{uniqueTermCount}</span>
              </div>
            </div>
            {frequentTerms.length > 0 ? (
              <div>
                <button
                  type="button"
                  onClick={() => toggleExpandedCell(tokenCellKey)}
                  className={`mb-2 text-[10px] ${
                    tokenExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Frequent terms
                </button>
                <div className="space-y-1 text-[11px] text-slate-300">
                  {frequentTerms
                    .slice(0, tokenExpanded ? frequentTerms.length : 6)
                    .map(([term, count]) => (
                      <div key={term} className="border-b border-slate-900/70 pb-1 last:border-b-0">
                        <span className="text-slate-200">{term}</span>
                        <span className="ml-2 text-slate-500">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      }
      case "corpus_stats":
        return (
          <div className="space-y-1 text-[11px] text-slate-300">
            <div className="border-b border-slate-800/70 pb-1">
              <span className="text-slate-500">Sentences</span>
              <span className="ml-2 text-slate-200">{stats?.Sentences ?? 0}</span>
            </div>
            <div className="border-b border-slate-800/70 pb-1">
              <span className="text-slate-500">Words</span>
              <span className="ml-2 text-slate-200">{stats?.Words ?? 0}</span>
            </div>
            <div className="border-b border-slate-800/70 pb-1">
              <span className="text-slate-500">Avg sentence</span>
              <span className="ml-2 text-slate-200">
                {stats?.Sentences
                  ? (Number(stats?.Words ?? 0) / Number(stats.Sentences))
                      .toFixed(1)
                      .replace(/\.0$/, "")
                  : "0"}
              </span>
            </div>
          </div>
        );
      case "tfidf": {
        const tfidfCellKey = `${analysisId}:${section}`;
        const tfidfExpanded = expandedCells.includes(tfidfCellKey);
        return topTerms.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => toggleExpandedCell(tfidfCellKey)}
              className={`mb-2 text-[10px] ${
                tfidfExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              TF-IDF terms
            </button>
            <div className="grid gap-2">
            {topTerms
              .slice(0, tfidfExpanded ? topTerms.length : 6)
              .map((term) => {
                const evidence =
                  tfidfEvidence.find((item: any) => item?.term === term) || {};
                return (
                  <div key={term} className="border-b border-slate-900/70 pb-2 last:border-b-0">
                    <button
                      type="button"
                      onClick={() =>
                        jumpToAnalysisTime(
                          analysisId,
                          findTranscriptTimeForText(analysisData, term),
                        )
                      }
                      className="text-left text-[11px] text-slate-100 hover:text-slate-50"
                    >
                      {term}
                    </button>
                    {renderOrderedEvidenceList(
                      analysisId,
                      analysisData,
                      `${tfidfCellKey}:${term}:evidence`,
                      evidence?.segment_refs || [],
                      evidence?.snippets || [],
                      String(term),
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-slate-400">No TFIDF terms yet.</div>
        );
      }
      case "sentence_tags": {
        const tagCellKey = `${analysisId}:${section}`;
        const tagExpanded = expandedCells.includes(tagCellKey);
        return (
          <div className="space-y-2 text-sm text-slate-300">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="border-b border-slate-800/70 pb-1">
                <span className="text-slate-500">WHO hits</span>
                <span className="ml-2 text-slate-200">{whoCount}</span>
              </div>
              <div className="border-b border-slate-800/70 pb-1">
                <span className="text-slate-500">WHY hits</span>
                <span className="ml-2 text-slate-200">{whyCount}</span>
              </div>
            </div>
            {(quant?.sentence_tags?.length ?? 0) > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => toggleExpandedCell(tagCellKey)}
                  className={`mb-2 text-[10px] ${
                    tagExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Tagged sentences
                </button>
                {tagExpanded && (
                  <div className="space-y-2">
                    {(quant?.sentence_tags ?? []).slice(0, 8).map((item, index) => (
                      <div key={`${analysisId}-sentence-${index}`} className="border-b border-slate-900/70 pb-2 last:border-b-0">
                        <button
                          type="button"
                          onClick={() =>
                            jumpToAnalysisTime(
                              analysisId,
                              findTranscriptTimeForText(analysisData, item.sentence),
                            )
                          }
                          className="block w-full border-l border-slate-800/80 px-2 py-1.5 text-left text-[11px] text-slate-300 hover:border-slate-600 hover:bg-slate-900/25 hover:text-slate-100"
                        >
                          {item.sentence}
                        </button>
                        <div className="mt-2 text-[10px] text-slate-500">
                          {(
                            sentenceTagEvidence.find((entry: any) => entry?.sentence === item.sentence)
                              ?.segment_refs?.[0]?.t ||
                            (
                              sentenceTagEvidence.find((entry: any) => entry?.sentence === item.sentence)
                                ?.matched_terms || []
                            ).slice(0, 8).join(", ")
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }
      case "bigrams": {
        const bigramCellKey = `${analysisId}:${section}`;
        const bigramExpanded = expandedCells.includes(bigramCellKey);
        return bigrams.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => toggleExpandedCell(bigramCellKey)}
              className={`mb-2 text-[10px] ${
                bigramExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Bigrams
            </button>
            <div className="grid gap-2">
            {bigrams
              .slice(0, bigramExpanded ? bigrams.length : 4)
              .map((bigram, index) => {
                const terms = Array.isArray(bigram)
                  ? bigram.map(String)
                  : String(bigram).split(/\s+/);
                const evidence =
                  bigramEvidence.find((entry: any) => entry?.phrase === (Array.isArray(bigram) ? bigram.join(" ") : String(bigram))) || {};
                return (
                  <div key={`${section}-${index}`} className="border-b border-slate-900/70 pb-2 last:border-b-0">
                    <button
                      type="button"
                      onClick={() =>
                        jumpToAnalysisTime(
                          analysisId,
                          findTranscriptTimeForTerms(analysisData, terms),
                        )
                      }
                      className="text-left text-[11px] text-slate-100 hover:text-slate-50"
                    >
                      {Array.isArray(bigram) ? bigram.join(" ") : String(bigram)}
                    </button>
                    {(evidence?.snippets || []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {(evidence.snippets || []).slice(0, bigramExpanded ? 5 : 2).map((snippet: string, snippetIndex: number) => (
                          <button
                            key={`${section}-${index}-${snippetIndex}`}
                            type="button"
                            onClick={() =>
                              jumpToAnalysisTime(
                                analysisId,
                                evidence?.segment_refs?.[snippetIndex]?.start ??
                                  findTranscriptTimeForText(analysisData, snippet),
                              )
                            }
                            className="block w-full border-l border-slate-800/80 px-2 py-1 text-left text-[11px] text-slate-300 hover:border-slate-600 hover:bg-slate-900/25 hover:text-slate-100"
                          >
                            <div className="mb-1 text-[10px] text-slate-500">
                              {evidence?.segment_refs?.[snippetIndex]?.t || ""}
                            </div>
                            {evidence?.segment_refs?.[snippetIndex]?.text || snippet}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )})}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-slate-400">No bigrams detected.</div>
        );
      }
      case "concordance": {
        const concordanceCellKey = `${analysisId}:${section}`;
        const concordanceExpanded = expandedCells.includes(concordanceCellKey);
        return activeConcordanceKeyword || concordanceKeywordOptions.length > 0 ? (
          <div>
            <div className="mb-2 flex flex-col gap-2">
              <input
                type="text"
                value={selectedConcordanceKeywords[analysisId] ?? activeConcordanceKeyword}
                onChange={(event) =>
                  setSelectedConcordanceKeywords((current) => ({
                    ...current,
                    [analysisId]: event.target.value,
                  }))
                }
                className="border-b border-slate-700 bg-transparent px-0 py-1.5 text-[11px] text-slate-200 outline-none placeholder:text-slate-500"
                placeholder="Type concordance word"
              />
              {concordanceKeywordOptions.length > 0 && (
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  {concordanceKeywordOptions.map((term) => (
                    <button
                      key={`${analysisId}-${term}`}
                      type="button"
                      onClick={() =>
                        setSelectedConcordanceKeywords((current) => ({
                          ...current,
                          [analysisId]: term,
                        }))
                      }
                      className={`text-[10px] ${
                        term.toLowerCase() === activeConcordanceKeyword.toLowerCase()
                          ? "text-amber-100 underline underline-offset-2"
                          : "text-slate-500 hover:text-slate-200"
                      }`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleExpandedCell(concordanceCellKey)}
              className={`mb-2 text-[10px] ${
                concordanceExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Concordance
            </button>
            {concordanceEntries.length > 0 ? (
              <div className="space-y-2">
              {concordanceEntries
                .slice(0, concordanceExpanded ? concordanceEntries.length : 3)
                .map((entry: any, index) => {
                  const evidence =
                    concordanceEvidence.find(
                      (evidenceEntry: any) =>
                        evidenceEntry?.line === (entry.text || entry.right_context),
                    ) || {};
                  return (
                    <div key={`${section}-${index}`} className="border-b border-slate-900/70 pb-2 last:border-b-0">
                      <button
                        type="button"
                        onClick={() =>
                          jumpToAnalysisTime(
                            analysisId,
                            entry.start ??
                              findTranscriptTimeForText(
                                analysisData,
                                entry.text || entry.right_context,
                              ),
                          )
                        }
                        className="block w-full border-l border-slate-800/80 px-2 py-1.5 text-left text-[11px] text-slate-300 hover:border-slate-600 hover:bg-slate-900/25 hover:text-slate-100"
                      >
                        <div className="mb-1 text-[10px] text-slate-500">
                          {entry.t || evidence?.segment_refs?.[0]?.t || `${index + 1}.`}
                        </div>
                        {renderConcordanceContext(entry)}
                      </button>
                      <div className="mt-2 text-[10px] text-slate-500">
                        keyword: {entry.keyword || evidence?.keyword || activeConcordanceKeyword || "n/a"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-400">
                No keyword-in-context lines detected for this word.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2 text-sm text-slate-400">No concordance preview yet.</div>
        );
      }
      default:
        return null;
    }
  };

  const exportJSON = () => {
    const payload = buildQuantMatrixPayload(analysisRows, selectedSections);
    downloadTextFile(
      "quant_matrix.json",
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  };

  const exportCSV = () => {
    const rows = analysisRows.map((row) => {
      const quant = row.analysisData?.quantAnalysis?.[0];
      const stats = quant?.stats_df?.[0];
      const freqDist = quant?.token_info?.freq_dist ?? {};
      const topTerms = (quant?.tfidf_df?.[0]?.TopTerms ?? []).slice(0, 6).join(" | ");
      const frequentTerms = Object.entries(freqDist)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 6)
        .map(([term, count]) => `${term} (${count})`)
        .join(" | ");
      const whoHits = quant?.sentence_tags?.filter((item) => item.WHO).length ?? 0;
      const whyHits = quant?.sentence_tags?.filter((item) => item.WHY).length ?? 0;
      const concordanceLines = (quant?.concordance?.lines ?? []).slice(0, 3).join(" | ");
      const bigrams = (quant?.bigrams ?? [])
        .slice(0, 4)
        .map((bigram) => (Array.isArray(bigram) ? bigram.join(" ") : String(bigram)))
        .join(" | ");

      return [
        row.sourceName,
        quant?.token_info?.tokens?.length ?? 0,
        quant?.token_info?.tokens_filtered?.length ?? 0,
        Number(quant?.token_info?.ttr ?? 0).toFixed(3),
        Object.keys(freqDist).length,
        stats?.Sentences ?? 0,
        stats?.Words ?? 0,
        stats?.Sentences
          ? (Number(stats?.Words ?? 0) / Number(stats.Sentences)).toFixed(2)
          : "0",
        whoHits,
        whyHits,
        topTerms,
        frequentTerms,
        bigrams,
        concordanceLines,
      ];
    });

    const header = [
      "analysis",
      "tokens",
      "filtered_tokens",
      "ttr",
      "unique_terms",
      "sentences",
      "words",
      "avg_sentence_length",
      "who_hits",
      "why_hits",
      "tfidf_top_terms",
      "most_frequent_terms",
      "bigrams",
      "concordance_lines",
    ];

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    downloadTextFile("quant_matrix.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
  };

  return (
    <main className="h-full overflow-y-auto bg-[#111111] px-3 py-3 text-slate-200">
      <div className="rounded-lg bg-slate-700/15 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Quant comparison matrix
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <button
              type="button"
              onClick={exportJSON}
              disabled={analysisRows.length === 0}
              className="rounded-full border border-slate-800/70 px-2 py-0.5 hover:border-slate-600 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={exportCSV}
              disabled={analysisRows.length === 0}
              className="rounded-full border border-slate-800/70 px-2 py-0.5 hover:border-slate-600 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              CSV
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAnalysisList((current) => !current);
                  if (!showAnalysisList) {
                    setShowMatrixControls(false);
                  }
                }}
                className="rounded-full border border-slate-800/70 px-2 py-0.5 hover:border-slate-600 hover:text-slate-300"
              >
                Videos
              </button>
              {showAnalysisList && (
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-800 bg-[#141414] p-2 shadow-xl">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Included Analyses
                  </div>
                  {analysisRows.length === 0 ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      No analyses in matrix yet.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {analysisRows.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-2 border-b border-slate-900/70 px-2 py-1 last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => openAnalysisPanel(row.id, "Quant")}
                            className="truncate text-left text-[11px] text-slate-300 hover:text-slate-100"
                            title={row.sourceName}
                          >
                            {row.sourceName}
                          </button>
                          <button
                            type="button"
                            onClick={() => hideAnalysisColumn(row.id)}
                            className="text-[10px] text-slate-500 hover:text-slate-200"
                          >
                            hide
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {availableAnalyses.filter((video) => !matrixAnalysisIds.includes(video.id)).length > 0 && (
                    <>
                      <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                        Bring Video Into Matrix
                      </div>
                      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                        {availableAnalyses
                          .filter((video) => !matrixAnalysisIds.includes(video.id))
                          .map((video) => (
                            <div
                              key={`add-${video.id}`}
                              className="flex items-center justify-between gap-2 rounded-md bg-slate-900/20 px-2 py-1"
                            >
                              <div
                              className="truncate text-[11px] text-slate-400"
                                title={video.name}
                              >
                                {video.name}
                              </div>
                              <button
                                type="button"
                                onClick={() => addAnalysisColumn(video.id)}
                              className="text-[10px] text-slate-500 hover:text-slate-100"
                              >
                                add
                              </button>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowMatrixControls((current) => !current);
                  if (!showMatrixControls) {
                    setShowAnalysisList(false);
                  }
                }}
                className="rounded-full border border-slate-800/70 px-2 py-0.5 hover:border-slate-600 hover:text-slate-300"
              >
                Controls
              </button>
              {showMatrixControls && (
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-slate-800 bg-[#141414] p-2 shadow-xl">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Matrix Fields
                  </div>
                  <div className="mt-2 space-y-1">
                    {SECTION_ORDER.map((section) => {
                      const label = SECTION_LABELS[section] || section;
                      const active = selectedSections.includes(section);
                      return (
                        <button
                          key={`toggle-${section}`}
                          type="button"
                          onClick={() => toggleSection(section)}
                          className={`block w-full border-b border-slate-900/70 px-2 py-1 text-left text-[11px] last:border-b-0 ${
                            active
                              ? "text-slate-100"
                              : "text-slate-500 hover:text-slate-100"
                          }`}
                        >
                          {active ? `Hide ${label}` : `Show ${label}`}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 border-t border-slate-800 pt-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Row View
                    </div>
                    <div className="mt-2 space-y-1">
                      {orderedSelectedSections.map((section) => {
                        const visible = !collapsedSections.includes(section);
                        const label = SECTION_LABELS[section] || section;
                        return (
                          <button
                            key={`row-focus-${section}`}
                            type="button"
                            onClick={() => toggleCollapsedSection(section)}
                          className={`block w-full border-b border-slate-900/70 px-2 py-1 text-left text-[11px] last:border-b-0 ${
                            visible
                              ? "text-slate-100"
                              : "text-slate-500 hover:text-slate-100"
                          }`}
                          >
                            {visible ? `Hide ${label}` : `Show ${label}`}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={expandAllRows}
                        className="text-[10px] text-slate-500 hover:text-slate-200"
                      >
                        expand all
                      </button>
                      <button
                        type="button"
                        onClick={collapseAllRows}
                        className="text-[10px] text-slate-500 hover:text-slate-200"
                      >
                        collapse all
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {selectedSections.length === 0 ? (
          <div className="mt-2 text-sm text-slate-300">
            No Quant fields selected yet. Use `Add to Quant Matrix` on the Quant Detail headings.
          </div>
        ) : analysisRows.length === 0 ? (
          <div className="mt-2 text-sm text-slate-300">
            Add at least one analysis to start comparison.
          </div>
        ) : orderedSelectedSections.length === 0 ? (
          <div className="mt-2 text-sm text-slate-300">
            No rows are currently in focus. Open `Controls` and choose the rows you want to view.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <div
              className="grid min-w-[760px] gap-2"
              style={{
                gridTemplateColumns: `150px repeat(${analysisRows.length}, minmax(220px, 1fr))`,
              }}
            >
              <div className="sticky left-0 z-10 rounded-lg bg-[#141414] px-2 py-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">
                Fields
              </div>
              {analysisRows.map((row) => (
                <div
                  key={`header-${row.id}`}
                  className="border-b border-slate-900/70 px-2 py-1.5"
                  title={row.sourceName}
                >
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => openAnalysisPanel(row.id, "Quant")}
                      className="truncate text-left text-[11px] text-slate-300 hover:text-slate-50"
                      title={`Open ${row.sourceName} in Quant`}
                    >
                      {compactLabel(row.sourceName)}
                    </button>
                    <div className="flex flex-wrap gap-2 text-[9px] text-slate-600">
                      <button
                        type="button"
                        onClick={() => openAnalysisPanel(row.id, "Quant")}
                        className="hover:text-slate-200"
                      >
                        Quant
                      </button>
                      <button
                        type="button"
                        onClick={() => openAnalysisPanel(row.id, "Transcript")}
                        className="hover:text-slate-200"
                      >
                        Transcript
                      </button>
                      {showMatrixControls && (
                        <button
                          type="button"
                          onClick={() => hideAnalysisColumn(row.id)}
                          className="hover:text-slate-200"
                        >
                          Hide
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {orderedSelectedSections.map((section) => (
                <React.Fragment key={section}>
                  <div className="sticky left-0 z-10 bg-[#141414] px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => toggleCollapsedSection(section)}
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-900/70 pb-1 text-left text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:text-slate-200"
                      title={`${collapsedSections.includes(section) ? "Show" : "Hide"} ${SECTION_LABELS[section] || section}`}
                    >
                      <span>{SECTION_LABELS[section] || section}</span>
                      <span className="text-[10px] text-slate-500">
                        {collapsedSections.includes(section) ? ">" : "v"}
                      </span>
                    </button>
                  </div>
                  {collapsedSections.includes(section) ? (
                    <div
                      className="col-span-full h-1 border-b border-slate-900/50"
                      style={{ gridColumn: `span ${analysisRows.length}` }}
                    />
                  ) : (
                    analysisRows.map((row) => (
                      <div
                        key={`${row.id}-${section}`}
                        className="border-b border-slate-900/60 p-2"
                      >
                        {renderSectionPreview(section, row.id, row.analysisData)}
                      </div>
                    ))
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
