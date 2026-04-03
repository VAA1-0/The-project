import React, { useEffect, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type AnalysisData } from "@/lib/video-service";
import { apiService } from "@/lib/api-service";
import { useLayoutHost } from "../LayoutHost";

const MATRIX_STORAGE_KEY = "vaa1.pos.matrix.sections";
const MATRIX_ANALYSES_STORAGE_KEY = "vaa1.pos.matrix.analyses";
const SECTION_ORDER = [
  "pos_counts",
  "pos_ratios",
  "grammar_features",
  "case_profile",
  "interrogatives",
  "tense_profile",
  "pos_words",
] as const;

const SECTION_LABELS: Record<string, string> = {
  pos_counts: "POS Counts",
  pos_ratios: "POS Ratios",
  grammar_features: "Grammar Features",
  case_profile: "Case Profile",
  interrogatives: "Interrogatives",
  tense_profile: "Tense Profile",
  pos_words: "POS Words",
};

function normalizeSectionOrder(sections: string[]) {
  const uniqueSections = Array.from(new Set(sections));
  const knownSections = SECTION_ORDER.filter((section) => uniqueSections.includes(section));
  const extraSections = uniqueSections.filter((section) => !SECTION_ORDER.includes(section as any));
  return [...knownSections, ...extraSections];
}

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

function buildPOSMatrixPayload(
  analysisRows: Array<{ id: string; sourceName: string; analysisData: AnalysisData | null }>,
  selectedSections: string[],
) {
  const analyses = analysisRows.map((row) => {
    const pos = row.analysisData?.posAnalysis?.[0];
    const posCounts = (pos?.pos_counts || {}) as Record<string, number>;
    const posRatios = (pos?.pos_ratios || {}) as Record<string, number>;
    const interrogatives = (pos?.interrogative_lens || {}) as Record<string, string[]>;
    const posWords = (pos?.pos_words || {}) as Record<string, string[]>;
    const grammarProfile = (pos?.grammar_profile || {}) as Record<string, any>;
    const caseProfile = (pos?.case_profile || {}) as Record<string, any>;
    const tenseProfile = (pos?.tense_profile || {}) as Record<string, any>;

    return {
      analysis_id: row.id,
      source_name: row.sourceName,
      pos_counts: {
        content_words:
          grammarProfile?.content_words?.count ??
          (posCounts.NOUN || 0) +
            (posCounts.VERB || 0) +
            (posCounts.ADJ || 0) +
            (posCounts.ADV || 0) +
            (posCounts.INTJ || 0),
        function_words:
          grammarProfile?.function_words?.count ??
          (posCounts.ADP || 0) +
            (posCounts.CONJ || 0) +
            (posCounts.DET || 0) +
            (posCounts.PRON || 0) +
            (posCounts.AUX_MODAL || 0),
        nouns: posCounts.NOUN || 0,
        verbs: posCounts.VERB || 0,
        adjectives: posCounts.ADJ || 0,
        adverbs: posCounts.ADV || 0,
        interjections: posCounts.INTJ || 0,
        prepositions: posCounts.ADP || 0,
        conjunctions: posCounts.CONJ || 0,
        determiners: posCounts.DET || 0,
        pronouns: posCounts.PRON || 0,
        auxiliaries_modals: posCounts.AUX_MODAL || 0,
      },
      pos_ratios: {
        verb_noun_ratio: posRatios.verb_noun_ratio ?? 0,
        pronoun_share: posRatios.pronoun_share ?? 0,
        nominalization_density: posRatios.nominalization_density ?? 0,
      },
      grammar_features: {
        content_words: grammarProfile?.content_words || {},
        function_words: grammarProfile?.function_words || {},
      },
      case_profile: {
        available: Boolean(caseProfile?.available),
        counts: caseProfile?.counts || {},
        examples: caseProfile?.examples || {},
        occurrences: caseProfile?.occurrences || {},
        labels: caseProfile?.labels || {},
        note: caseProfile?.note || "",
      },
      interrogatives: {
        who: interrogatives.who || [],
        what: interrogatives.what || [],
        when: interrogatives.when || [],
        why: interrogatives.why || [],
      },
      tense_profile: {
        available: tenseProfile?.available ?? false,
        counts: tenseProfile?.counts || {},
        examples: tenseProfile?.examples || {},
        note: tenseProfile?.note || "",
      },
      pos_words: {
        noun: posWords.NOUN || [],
        verb: posWords.VERB || [],
        adjective: posWords.ADJ || [],
        adverb: posWords.ADV || [],
        preposition: posWords.ADP || [],
        pronoun: posWords.PRON || [],
        determiner: posWords.DET || [],
        conjunction: posWords.CONJ || [],
        auxiliary_modal: posWords.AUX_MODAL || [],
      },
    };
  });

  return {
    selected_sections: selectedSections,
    analyses,
  };
}

function compactLabel(value: string, maxLength = 24) {
  if (value.length <= maxLength) {
    return value;
  }
  const dotIndex = value.lastIndexOf(".");
  const extension =
    dotIndex > 0 && value.length - dotIndex <= 6 ? value.slice(dotIndex) : "";
  const base = extension ? value.slice(0, dotIndex) : value;
  const trimmedBase = base.slice(0, Math.max(12, maxLength - extension.length - 1));
  return `${trimmedBase}…${extension}`;
}

export default function POSMatrixPanel({
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
  const [expandedGrammarCells, setExpandedGrammarCells] = useState<string[]>([]);
  const [expandedPosCountBuckets, setExpandedPosCountBuckets] = useState<string[]>([]);
  const [expandedCaseBuckets, setExpandedCaseBuckets] = useState<string[]>([]);
  const [expandedInterrogativeBuckets, setExpandedInterrogativeBuckets] = useState<string[]>([]);
  const [availableAnalyses, setAvailableAnalyses] = useState<
    Array<{ id: string; name: string; status?: string }>
  >([]);
  const [showAnalysisList, setShowAnalysisList] = useState(false);
  const [showMatrixControls, setShowMatrixControls] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);

  const updateSelectedSections = (next: string[]) => {
    const normalized = normalizeSectionOrder(next);
    setSelectedSections(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(normalized));
    }
    eventBus.emit("posMatrixSectionsChanged", normalized);
  };

  const toggleSection = (section: string) => {
    const next = selectedSections.includes(section)
      ? selectedSections.filter((item) => item !== section)
      : [...selectedSections, section];
    updateSelectedSections(next);
  };

  const toggleCollapsedSection = (section: string) => {
    setCollapsedSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  };

  const updateMatrixAnalysisIds = (next: string[]) => {
    setMatrixAnalysisIds(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MATRIX_ANALYSES_STORAGE_KEY, JSON.stringify(next));
    }
    eventBus.emit("posMatrixAnalysesChanged", next);
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

  useEffect(() => {
    const handleSectionsChanged = (sections: string[]) => {
      setSelectedSections(normalizeSectionOrder(sections));
    };
    const handleAnalysesChanged = (ids: string[]) => {
      setMatrixAnalysisIds(ids);
    };

    eventBus.on("posMatrixSectionsChanged", handleSectionsChanged);
    eventBus.on("posMatrixAnalysesChanged", handleAnalysesChanged);

    return () => {
      eventBus.off("posMatrixSectionsChanged", handleSectionsChanged);
      eventBus.off("posMatrixAnalysesChanged", handleAnalysesChanged);
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
        eventBus.emit("posMatrixAnalysesChanged", validIds);
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
    const payload = buildPOSMatrixPayload(analysisRows, selectedSections);

    void Promise.allSettled(
      analysisRows.map((row) => apiService.savePOSMatrixSnapshot(row.id, payload)),
    );
  }, [selectedSections, analysisRows]);

  useEffect(() => {
    if (
      analysisRows.length > 0 &&
      selectedSections.length > 0 &&
      !selectedSections.includes("case_profile")
    ) {
      updateSelectedSections([...selectedSections, "case_profile"]);
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

  const toggleExpandedGrammarCell = (key: string) => {
    setExpandedGrammarCells((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const toggleExpandedPosCountBucket = (key: string) => {
    setExpandedPosCountBuckets((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const toggleExpandedCaseBucket = (key: string) => {
    setExpandedCaseBuckets((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const toggleExpandedInterrogativeBucket = (key: string) => {
    setExpandedInterrogativeBuckets((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
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

  const renderClickableWords = (
    analysisId: string,
    analysisData: AnalysisData | null,
    words: string[],
    limit = 4,
  ) => {
    const visible = words.slice(0, limit);
    if (visible.length === 0) {
      return <span className="text-slate-500">none</span>;
    }
    return visible.map((word, index) => (
      <button
        key={`${analysisId}-${word}-${index}`}
        type="button"
        onClick={() =>
          jumpToAnalysisTime(
            analysisId,
            findTranscriptTimeForText(analysisData, word),
          )
        }
        className="mr-1 text-[11px] text-slate-200 hover:text-slate-50"
      >
        {word}
        {index < visible.length - 1 ? "," : ""}
      </button>
    ));
  };

  const renderClickableList = (
    analysisId: string,
    analysisData: AnalysisData | null,
    values: string[],
  ) => {
    if (!values.length) {
      return <span className="text-slate-500">none</span>;
    }
    return (
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
        {values.map((value, index) => (
          <button
            key={`${analysisId}-${value}-${index}`}
            type="button"
            onClick={() =>
              jumpToAnalysisTime(
                analysisId,
                findTranscriptTimeForText(analysisData, value),
              )
            }
            className="text-[11px] text-slate-300 hover:text-slate-100"
          >
            {value}
          </button>
        ))}
      </div>
    );
  };

  const getOrderedWordEntries = (
    analysisData: AnalysisData | null,
    words: string[],
  ) => {
    const transcript = analysisData?.transcript || [];
    let searchStartIndex = 0;

    return words
      .map((word) => String(word || "").trim())
      .filter(Boolean)
      .map((word, index) => {
        const normalized = word.toLowerCase();
        const relativeIndex = transcript
          .slice(searchStartIndex)
          .findIndex((segment: any) =>
            String(segment?.text || "").toLowerCase().includes(normalized),
          );
        const segmentIndex =
          relativeIndex >= 0 ? searchStartIndex + relativeIndex : Number.MAX_SAFE_INTEGER;
        if (segmentIndex !== Number.MAX_SAFE_INTEGER) {
          searchStartIndex = segmentIndex;
        }
        return {
          word,
          occurrence: index + 1,
          segmentIndex,
          time:
            segmentIndex !== Number.MAX_SAFE_INTEGER
              ? Number(transcript[segmentIndex]?.start ?? 0)
              : findTranscriptTimeForText(analysisData, word),
        };
      });
  };

  const renderOrderedWordList = (
    analysisId: string,
    analysisData: AnalysisData | null,
    words: string[],
  ) => {
    const orderedWords = getOrderedWordEntries(analysisData, words);
    if (orderedWords.length === 0) {
      return <div className="mt-1 text-[11px] text-slate-500">none</div>;
    }
    return (
      <div className="mt-2 space-y-1">
        {orderedWords.map((entry) => (
          <button
            key={`${analysisId}-${entry.word}-${entry.occurrence}`}
            type="button"
            onClick={() => jumpToAnalysisTime(analysisId, entry.time)}
            className="block text-left text-[11px] text-slate-300 hover:text-slate-100"
          >
            <span className="text-slate-500">{entry.occurrence}.</span>
            <span className="ml-2">{entry.word}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderMorphologyUnavailableNotice = (
    analysisData: AnalysisData | null,
    fallbackNote: string,
  ) => {
    const pos = analysisData?.posAnalysis?.[0];
    const analysisMode = pos?.analysis_mode;
    const languageSupport = analysisData?.metadata?.languageSupport;
    const noteLines = [
      fallbackNote,
      analysisMode === "lexical_fallback"
        ? "This analysis used lexical fallback rather than model-backed morphology."
        : null,
      languageSupport?.pos === "limited" || languageSupport?.pos === "multilingual"
        ? `POS support is ${languageSupport?.pos} for this transcript language. Expected spaCy model: ${languageSupport?.spacy_model || "unknown"}.`
        : null,
    ].filter(Boolean);

    return (
      <div className="space-y-1 border-b border-slate-900/70 pb-1 text-[11px] text-slate-400">
        {noteLines.map((line, index) => (
          <div key={`morph-note-${index}`}>{line}</div>
        ))}
      </div>
    );
  };

  const renderCell = (
    section: string,
    analysisId: string,
    analysisData: AnalysisData | null,
  ) => {
    const pos = analysisData?.posAnalysis?.[0];
    if (!pos) {
      return (
        <div className="text-sm text-slate-400">
          No POS data loaded yet for this analysis.
        </div>
      );
    }

    const posCounts = (pos.pos_counts || {}) as Record<string, number>;
    const posRatios = (pos.pos_ratios || {}) as Record<string, number>;
    const grammarProfile = (pos.grammar_profile || {}) as Record<string, any>;
    const interrogatives = (pos.interrogative_lens || {}) as Record<string, string[]>;
    const tenseProfile = (pos.tense_profile || {}) as Record<string, any>;
    const posWords = (pos.pos_words || {}) as Record<string, string[]>;
    const caseProfile = (pos.case_profile || {}) as Record<string, any>;
    const contentWordCount =
      grammarProfile?.content_words?.count ??
      (posCounts.NOUN || 0) +
        (posCounts.VERB || 0) +
        (posCounts.ADJ || 0) +
        (posCounts.ADV || 0) +
        (posCounts.INTJ || 0);
    const functionWordCount =
      grammarProfile?.function_words?.count ??
      (posCounts.ADP || 0) +
        (posCounts.CONJ || 0) +
        (posCounts.DET || 0) +
        (posCounts.PRON || 0) +
        (posCounts.AUX_MODAL || 0);

    switch (section) {
      case "pos_counts":
        return (
          <div className="space-y-3 text-[11px] text-slate-300">
            <div className="border-b border-slate-900/70 pb-2">
              <div className="text-slate-500">Content Words</div>
              <div className="mt-1 text-slate-200">{contentWordCount}</div>
              <div className="mt-2 space-y-1">
                {[
                  ["nouns", posCounts.NOUN || 0, posWords.NOUN || []],
                  ["verbs", posCounts.VERB || 0, posWords.VERB || []],
                  ["adjectives", posCounts.ADJ || 0, posWords.ADJ || []],
                  ["adverbs", posCounts.ADV || 0, posWords.ADV || []],
                  ["interjections", posCounts.INTJ || 0, posWords.INTJ || []],
                ].map(([label, count, words]) => {
                  const bucketKey = `${analysisId}:pos_counts:${String(label)}`;
                  const isExpanded = expandedPosCountBuckets.includes(bucketKey);
                  return (
                  <div
                    key={String(label)}
                    className="border-b border-slate-900/70 pb-1 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpandedPosCountBucket(bucketKey)}
                      className={`flex w-full items-center justify-between gap-2 text-left ${
                        isExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <span>{label}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-slate-200">{Number(count)}</span>
                        <span className="text-[10px] text-slate-500">{isExpanded ? "v" : ">"}</span>
                      </span>
                    </button>
                    {isExpanded
                      ? renderOrderedWordList(
                          analysisId,
                          analysisData,
                          words as string[],
                        )
                      : null}
                  </div>
                )})}
              </div>
            </div>
            <div className="border-b border-slate-900/70 pb-2">
              <div className="text-slate-500">Function Words</div>
              <div className="mt-1 text-slate-200">{functionWordCount}</div>
              <div className="mt-2 space-y-1">
                {[
                  ["prepositions / adpositions", posCounts.ADP || 0, posWords.ADP || []],
                  ["conjunctions", posCounts.CONJ || 0, posWords.CONJ || []],
                  ["determiners", posCounts.DET || 0, posWords.DET || []],
                  ["pronouns", posCounts.PRON || 0, posWords.PRON || []],
                  ["auxiliaries / modals", posCounts.AUX_MODAL || 0, posWords.AUX_MODAL || []],
                ].map(([label, count, words]) => {
                  const bucketKey = `${analysisId}:pos_counts:${String(label)}`;
                  const isExpanded = expandedPosCountBuckets.includes(bucketKey);
                  return (
                  <div
                    key={String(label)}
                    className="border-b border-slate-900/70 pb-1 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpandedPosCountBucket(bucketKey)}
                      className={`flex w-full items-center justify-between gap-2 text-left ${
                        isExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <span>{label}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-slate-200">{Number(count)}</span>
                        <span className="text-[10px] text-slate-500">{isExpanded ? "v" : ">"}</span>
                      </span>
                    </button>
                    {isExpanded
                      ? renderOrderedWordList(
                          analysisId,
                          analysisData,
                          words as string[],
                        )
                      : null}
                  </div>
                )})}
              </div>
            </div>
          </div>
        );
      case "pos_ratios":
        return (
          <div className="space-y-1 text-[11px] text-slate-300">
            <div className="border-b border-slate-800/70 pb-1">
              <span className="text-slate-500">Verb/Noun</span>
              <span className="ml-2 text-slate-200">{Number(posRatios.verb_noun_ratio ?? 0).toFixed(3).replace(/\.?0+$/, "")}</span>
            </div>
            <div className="border-b border-slate-800/70 pb-1">
              <span className="text-slate-500">Pronoun share</span>
              <span className="ml-2 text-slate-200">{Number(posRatios.pronoun_share ?? 0).toFixed(3).replace(/\.?0+$/, "")}</span>
            </div>
            <div className="border-b border-slate-800/70 pb-1">
              <span className="text-slate-500">Nominalization</span>
              <span className="ml-2 text-slate-200">{Number(posRatios.nominalization_density ?? 0).toFixed(3).replace(/\.?0+$/, "")}</span>
            </div>
          </div>
        );
      case "grammar_features":
        return (
          <div className="space-y-3 text-sm text-slate-300">
            <div className="border-b border-slate-900/70 pb-2">
              <button
                type="button"
                onClick={() =>
                  toggleExpandedGrammarCell(`${analysisId}:content_words`)
                }
                className={`w-full text-left text-[11px] ${
                  expandedGrammarCells.includes(`${analysisId}:content_words`)
                    ? "text-slate-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Content words
              </button>
              <div className="mt-1 text-[11px] text-slate-200">
                {grammarProfile?.content_words?.count ?? (
                  (posCounts.NOUN || 0) +
                  (posCounts.VERB || 0) +
                  (posCounts.ADJ || 0) +
                  (posCounts.ADV || 0)
                )}
              </div>
              {expandedGrammarCells.includes(`${analysisId}:content_words`) ? (
                <div className="mt-2 space-y-2">
                  {[
                    ["noun", posWords.NOUN || []],
                    ["verb", posWords.VERB || []],
                    ["adjective", posWords.ADJ || []],
                    ["adverb", posWords.ADV || []],
                  ].map(([label, words]) => (
                    <div
                      key={String(label)}
                      className="border-l border-slate-800/80 px-2 py-1.5 text-[11px] text-slate-300"
                    >
                      <div className="text-slate-500">{label}</div>
                      {renderClickableList(
                        analysisId,
                        analysisData,
                        words as string[],
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 space-y-1 text-[11px]">
                  {[
                    ["noun", posWords.NOUN || []],
                    ["verb", posWords.VERB || []],
                    ["adjective", posWords.ADJ || []],
                    ["adverb", posWords.ADV || []],
                  ].map(([label, words]) => (
                    <div
                      key={String(label)}
                      className="border-b border-slate-900/70 pb-1 last:border-b-0"
                    >
                      <span className="text-slate-500">{label}</span>
                      <span className="ml-2 text-slate-200">{(words as string[]).length}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-b border-slate-900/70 pb-2">
              <button
                type="button"
                onClick={() =>
                  toggleExpandedGrammarCell(`${analysisId}:function_words`)
                }
                className={`w-full text-left text-[11px] ${
                  expandedGrammarCells.includes(`${analysisId}:function_words`)
                    ? "text-slate-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Function words
              </button>
              <div className="mt-1 text-[11px] text-slate-200">
                {grammarProfile?.function_words?.count ?? (
                  (posCounts.ADP || 0) +
                  (posCounts.CONJ || 0) +
                  (posCounts.DET || 0) +
                  (posCounts.PRON || 0) +
                  (posCounts.AUX_MODAL || 0)
                )}
              </div>
              {expandedGrammarCells.includes(`${analysisId}:function_words`) ? (
                <div className="mt-2 space-y-2">
                  {[
                    ["adposition", posWords.ADP || []],
                    ["conjunction", posWords.CONJ || []],
                    ["determiner", posWords.DET || []],
                    ["pronoun", posWords.PRON || []],
                    ["aux/modal", posWords.AUX_MODAL || []],
                  ].map(([label, words]) => (
                    <div
                      key={String(label)}
                      className="border-l border-slate-800/80 px-2 py-1.5 text-[11px] text-slate-300"
                    >
                      <div className="text-slate-500">{label}</div>
                      {renderClickableList(
                        analysisId,
                        analysisData,
                        words as string[],
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 space-y-1 text-[11px]">
                  {[
                    ["adposition", posWords.ADP || []],
                    ["conjunction", posWords.CONJ || []],
                    ["determiner", posWords.DET || []],
                    ["pronoun", posWords.PRON || []],
                    ["aux/modal", posWords.AUX_MODAL || []],
                  ].map(([label, words]) => (
                    <div
                      key={String(label)}
                      className="border-b border-slate-900/70 pb-1 last:border-b-0"
                    >
                      <span className="text-slate-500">{label}</span>
                      <span className="ml-2 text-slate-200">{(words as string[]).length}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case "case_profile": {
        const caseCounts = caseProfile?.counts || {};
        const caseExamples = caseProfile?.examples || {};
        const caseOccurrences = caseProfile?.occurrences || {};
        const caseLabels = caseProfile?.labels || {};
        const caseEntries = Object.entries(caseCounts)
          .sort((a, b) => Number(b[1]) - Number(a[1]));
        return caseEntries.length > 0 ? (
          <div className="space-y-1 text-[11px] text-slate-300">
            {caseEntries.map(([key, count]) => {
              const bucketKey = `${analysisId}:case_profile:${key}`;
              const isExpanded = expandedCaseBuckets.includes(bucketKey);
              const words = ((caseOccurrences?.[key] || caseExamples?.[key] || []) as string[]);
              return (
                <div key={key} className="border-b border-slate-900/70 pb-1.5 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleExpandedCaseBucket(bucketKey)}
                    className={`flex w-full items-center justify-between gap-2 text-left ${
                      isExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span>{caseLabels[key] || key}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-slate-200">{Number(count)}</span>
                      <span className="text-[10px] text-slate-500">{isExpanded ? "v" : ">"}</span>
                    </span>
                  </button>
                  {isExpanded
                    ? renderOrderedWordList(
                        analysisId,
                        analysisData,
                        words,
                      )
                    : null}
                </div>
              );
            })}
          </div>
        ) : (
          renderMorphologyUnavailableNotice(
            analysisData,
            caseProfile?.note || "No case profile available",
          )
        );
      }
      case "interrogatives": {
        const rows = [
          ["who", interrogatives.who],
          ["what", interrogatives.what],
          ["when", interrogatives.when],
          ["why", interrogatives.why],
        ] as const;
        return (
          <div className="space-y-1 text-[11px] text-slate-300">
            {rows.map(([label, value]) => {
              const items = Array.isArray(value) ? value : [];
              const bucketKey = `${analysisId}:interrogative:${label}`;
              const isExpanded = expandedInterrogativeBuckets.includes(bucketKey);
              return (
                <div key={label} className="border-b border-slate-900/70 pb-1.5 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleExpandedInterrogativeBucket(bucketKey)}
                    className={`flex w-full items-center justify-between gap-2 text-left ${
                      isExpanded ? "text-slate-300" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-[10px] text-slate-500">{isExpanded ? "v" : ">"}</span>
                  </button>
                  <div className="mt-1 text-[11px] text-slate-500">{items.length}</div>
                  {isExpanded ? renderClickableList(analysisId, analysisData, items) : null}
                </div>
              );
            })}
          </div>
        );
      }
      case "tense_profile": {
        if (!tenseProfile?.available) {
          return renderMorphologyUnavailableNotice(
            analysisData,
            tenseProfile?.note || "No tense profile available",
          );
        }
        return (
          <div className="space-y-1 text-[11px] text-slate-300">
            {[
              ["present", "Present"],
              ["past", "Past"],
              ["future_like", "Future-like"],
              ["infinitive", "Infinitive"],
              ["participle", "Participle"],
              ["gerund_like", "Gerund-like"],
            ].map(([key, label]) => (
              <div key={String(key)} className="border-b border-slate-900/70 pb-1.5 last:border-b-0">
                <span className="text-slate-500">{label}</span>
                <span className="ml-2 text-slate-200">{tenseProfile?.counts?.[key] || 0}</span>
                <div className="mt-1 text-[11px] text-slate-300">
                  {renderClickableWords(
                    analysisId,
                    analysisData,
                    (tenseProfile?.examples?.[key] || []) as string[],
                    5,
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }
      case "pos_words":
        return (
          <div className="space-y-1 text-[11px] text-slate-300">
            <div className="border-b border-slate-900/70 pb-1.5">
              <span className="text-slate-500">noun</span>
              <span className="ml-2">
              {renderClickableWords(analysisId, analysisData, posWords.NOUN || [], 8)}
              </span>
            </div>
            <div className="border-b border-slate-900/70 pb-1.5">
              <span className="text-slate-500">verb</span>
              <span className="ml-2">
              {renderClickableWords(analysisId, analysisData, posWords.VERB || [], 8)}
              </span>
            </div>
            <div className="border-b border-slate-900/70 pb-1.5">
              <span className="text-slate-500">adjective</span>
              <span className="ml-2">
              {renderClickableWords(analysisId, analysisData, posWords.ADJ || [], 8)}
              </span>
            </div>
            <div className="border-b border-slate-900/70 pb-1.5 last:border-b-0">
              <span className="text-slate-500">pronoun</span>
              <span className="ml-2">
              {renderClickableWords(analysisId, analysisData, posWords.PRON || [], 8)}
              </span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const orderedSelectedSections = normalizeSectionOrder(selectedSections);

  const exportJSON = () => {
    const payload = buildPOSMatrixPayload(analysisRows, selectedSections);
    downloadTextFile(
      "pos_matrix.json",
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  };

  const exportCSV = () => {
    const rows = analysisRows.map((row) => {
      const pos = row.analysisData?.posAnalysis?.[0];
      const posCounts = (pos?.pos_counts || {}) as Record<string, number>;
      const posRatios = (pos?.pos_ratios || {}) as Record<string, number>;
      const interrogatives = (pos?.interrogative_lens || {}) as Record<string, string[]>;
      const grammarProfile = (pos?.grammar_profile || {}) as Record<string, any>;
      const caseProfile = (pos?.case_profile || {}) as Record<string, any>;
      const tenseProfile = (pos?.tense_profile || {}) as Record<string, any>;
      const posWords = (pos?.pos_words || {}) as Record<string, string[]>;

      return [
        row.sourceName,
        posCounts.NOUN || 0,
        posCounts.VERB || 0,
        posCounts.ADJ || 0,
        posCounts.ADP || 0,
        posCounts.ADV || 0,
        posCounts.INTJ || 0,
        posCounts.PRON || 0,
        posCounts.DET || 0,
        posCounts.CONJ || 0,
        posCounts.AUX_MODAL || 0,
        caseProfile?.available ? JSON.stringify(caseProfile?.counts || {}) : "",
        Number(posRatios.verb_noun_ratio ?? 0).toFixed(3),
        Number(posRatios.pronoun_share ?? 0).toFixed(3),
        Number(posRatios.nominalization_density ?? 0).toFixed(3),
        grammarProfile?.content_words?.count ?? "",
        grammarProfile?.function_words?.count ?? "",
        (interrogatives.who || []).join(" | "),
        (interrogatives.what || []).join(" | "),
        (interrogatives.when || []).join(" | "),
        (interrogatives.why || []).join(" | "),
        tenseProfile?.available ? Number(tenseProfile?.counts?.present || 0) : "",
        tenseProfile?.available ? Number(tenseProfile?.counts?.past || 0) : "",
        (posWords.NOUN || []).slice(0, 8).join(" | "),
        (posWords.VERB || []).slice(0, 8).join(" | "),
        (posWords.ADJ || []).slice(0, 8).join(" | "),
        (posWords.PRON || []).slice(0, 8).join(" | "),
      ];
    });

    const header = [
      "analysis",
      "nouns",
      "verbs",
      "adjectives",
      "preps",
      "adverbs",
      "interjections",
      "pronouns",
      "determiners",
      "conjunctions",
      "auxiliaries_modals",
      "case_counts",
      "verb_noun_ratio",
      "pronoun_share",
      "nominalization_density",
      "content_words",
      "function_words",
      "who",
      "what",
      "when",
      "why",
      "present_tense",
      "past_tense",
      "noun_words",
      "verb_words",
      "adjective_words",
      "pronoun_words",
    ];

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    downloadTextFile("pos_matrix.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
  };

  return (
    <main className="h-full overflow-y-auto bg-[#111111] px-3 py-3 text-slate-200">
      <div className="mt-3 rounded-lg bg-slate-700/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            POS comparison matrix
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
                  <div className="text-[10px] text-slate-500">
                    Included analyses
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
                            onClick={() => openAnalysisPanel(row.id, "POS")}
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
                            remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {availableAnalyses.filter((video) => !matrixAnalysisIds.includes(video.id)).length > 0 && (
                    <>
                      <div className="mt-3 text-[10px] text-slate-500">
                        Available analyses
                      </div>
                      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                        {availableAnalyses
                          .filter((video) => !matrixAnalysisIds.includes(video.id))
                          .map((video) => (
                            <div
                              key={`add-${video.id}`}
                              className="flex items-center justify-between gap-2 border-b border-slate-900/70 px-2 py-1 last:border-b-0"
                            >
                              <div className="truncate text-[11px] text-slate-400" title={video.name}>
                                {video.name}
                              </div>
                              <button
                                type="button"
                                onClick={() => addAnalysisColumn(video.id)}
                                className="text-[10px] text-slate-500 hover:text-slate-100"
                              >
                                include
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
                  <div className="text-[10px] text-slate-500">
                    Matrix fields
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
                            active ? "text-slate-100" : "text-slate-500 hover:text-slate-100"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 border-t border-slate-800 pt-2">
                    <div className="text-[10px] text-slate-500">
                      Row view
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
                              visible ? "text-slate-100" : "text-slate-500 hover:text-slate-100"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {selectedSections.length === 0 ? (
          <div className="mt-2 text-sm text-slate-300">
            No POS fields selected yet. Use `Add to POS Matrix` on the POS headings.
          </div>
        ) : analysisRows.length === 0 ? (
          <div className="mt-2 text-sm text-slate-300">
            Add at least one analysis to start comparison.
          </div>
        ) : orderedSelectedSections.length === 0 ? (
          <div className="mt-2 text-sm text-slate-300">
            No rows are currently in focus. Use `Controls` to choose the rows you want to view.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <div
              className="grid min-w-[760px] gap-2"
              style={{
                gridTemplateColumns: `150px repeat(${analysisRows.length}, minmax(220px, 1fr))`,
              }}
            >
              <div className="sticky left-0 z-10 bg-[#141414] px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">
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
                      onClick={() => openAnalysisPanel(row.id, "POS")}
                      className="truncate text-left text-[11px] text-slate-300 hover:text-slate-50"
                      title={`Open ${row.sourceName} in POS`}
                    >
                      {compactLabel(row.sourceName)}
                    </button>
                    <div className="flex flex-wrap gap-2 text-[9px] text-slate-600">
                      <button
                        type="button"
                        onClick={() => openAnalysisPanel(row.id, "POS")}
                        className="hover:text-slate-200"
                      >
                        POS
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
                          Remove
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
                      title={SECTION_LABELS[section] || section}
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
                        {renderCell(section, row.id, row.analysisData)}
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
