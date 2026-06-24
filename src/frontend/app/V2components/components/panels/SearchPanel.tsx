"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Clock,
  Database,
  FileText,
  Filter,
  GitBranch,
  RefreshCw,
  Search,
  Video,
} from "lucide-react";
import {
  VideoService,
  type AnalysisData,
  type DatasceneContentSearchIndexRecord,
  type DatasceneEntitySourceType,
  type DatasceneEntityType,
  type VideoMetadata,
} from "@/lib/video-service";
import { apiService } from "@/lib/api-service";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { openVideoAtTime } from "@/lib/video-navigation";
import { useLayoutHost } from "../LayoutHost";

type SearchPanelProps = {
  videoId?: string;
};

type SearchCorpusRow = {
  analysisId: string;
  sourceName: string;
  status?: VideoMetadata["status"];
  analysisData: AnalysisData | null;
  records: DatasceneContentSearchIndexRecord[];
};

type SearchMode = "all" | "narrative" | "pattern" | "matureData" | "clusters" | "forensic";
type MaturityFilter = "all" | "mature" | "review";

const SOURCE_LABELS: Record<DatasceneEntitySourceType, string> = {
  transcript: "Transcript",
  ocr: "OCR",
  annotation: "Manual",
  metadata: "Metadata",
  object_detection: "Objects",
  visual_sample_cloud: "Visual samples",
  audio_sample_cloud: "Audio samples",
  audiovisual_narrative_agent_sample: "AV agent samples",
  mature_data_bus: "Mature Data",
};

const TYPE_LABELS: Partial<Record<DatasceneEntityType, string>> = {
  PERSON_NAME: "Person",
  NARRATIVE_AGENT: "Narrative agent",
  AUDIOVISUAL_NARRATIVE_AGENT: "AV narrative agent",
  OBJECT: "Object",
  VISUAL_SYMBOL: "Visual symbol",
  AUDIO_ENTITY: "Audio entity",
  PLACE: "Place",
  EVENT: "Event",
  ORG: "Org",
  CONCEPT: "Concept",
  LAW_POLICY: "Law / policy",
  COLLECTION_ENTITY: "Collection",
  SOURCE_MEDIA_ENTITY: "Source media",
};

const SEARCH_MODES: Array<{ id: SearchMode; label: string }> = [
  { id: "all", label: "All" },
  { id: "narrative", label: "Narrative" },
  { id: "pattern", label: "Pattern" },
  { id: "matureData", label: "Mature Data" },
  { id: "clusters", label: "Clusters" },
  { id: "forensic", label: "Forensic" },
];

const SEARCHABLE_STATUSES = new Set(["completed", "synced"]);

function formatSeconds(value: number | undefined): string {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds)) return "00:00";
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remaining = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function uniqueValues<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function typeLabel(type: DatasceneEntityType): string {
  return TYPE_LABELS[type] || type.replaceAll("_", " ").toLowerCase();
}

function sourceLabel(source: DatasceneEntitySourceType): string {
  return SOURCE_LABELS[source] || source.replaceAll("_", " ");
}

function statusLabel(status?: VideoMetadata["status"]): string {
  if (!status) return "unknown";
  return String(status).replaceAll("_", " ");
}

function isSearchableAnalysis(video: VideoMetadata): boolean {
  return SEARCHABLE_STATUSES.has(String(video.status || ""));
}

function recordMatchesMode(record: DatasceneContentSearchIndexRecord, mode: SearchMode) {
  if (mode === "all") return true;
  if (mode === "narrative") {
    return (
      record.entity_type === "NARRATIVE_AGENT" ||
      record.entity_type === "AUDIOVISUAL_NARRATIVE_AGENT" ||
      record.entity_type === "PERSON_NAME"
    );
  }
  if (mode === "pattern") {
    return (
      record.entity_type === "OBJECT" ||
      record.entity_type === "VISUAL_SYMBOL" ||
      record.entity_type === "AUDIO_ENTITY" ||
      record.sources.some((source) =>
        [
          "object_detection",
          "visual_sample_cloud",
          "audio_sample_cloud",
          "audiovisual_narrative_agent_sample",
        ].includes(source.source_type),
      )
    );
  }
  if (mode === "matureData") {
    return record.search_surface === "mature_data";
  }
  if (mode === "clusters") {
    return record.search_surface === "confirmable_cluster";
  }
  return record.forensic_render_available || record.sources.some((source) => !!source.evidence_ref);
}

function scoreRecord(record: DatasceneContentSearchIndexRecord, query: string): number {
  if (!query) return 1;
  const needle = query.toLowerCase();
  const name = record.canonical_name.toLowerCase();
  const text = record.searchable_text.toLowerCase();
  const keywordHit = record.searchable_keywords.some((keyword) => keyword.includes(needle));
  let score = 0;
  if (name === needle) score += 50;
  if (name.includes(needle)) score += 25;
  if (keywordHit) score += 12;
  if (text.includes(needle)) score += 8;
  if (record.maturity_summary.has_manual_confirmation) score += 3;
  if (record.maturity_summary.has_multi_source_support) score += 2;
  if (record.search_surface === "mature_data") score += 4;
  if (record.search_surface === "confirmable_cluster") score += 3;
  return score;
}

function groupResultKey(row: SearchCorpusRow, record: DatasceneContentSearchIndexRecord) {
  return `${row.analysisId}:${record.canonical_entity_id}:${record.start_time}:${record.end_time}:${record.index_id}`;
}

function withSearchTimeout<T>(promise: Promise<T>, timeoutMs = 9000): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(null);
      });
  });
}

function sourceMediaFallbackSearchRecord(
  analysisId: string,
  metadata: VideoMetadata | null,
): DatasceneContentSearchIndexRecord {
  const name = metadata?.name || analysisId;
  const completedText = metadata?.analysisCompletedAt ? `completed ${metadata.analysisCompletedAt}` : "";
  const statusText = statusLabel(metadata?.status);
  const searchableText = [name, statusText, completedText, "source media saved analysis"].filter(Boolean).join(" ");
  return {
    index_id: `search-fallback:source-media:${analysisId}`,
    analysis_id: analysisId,
    canonical_entity_id: `source-media:${analysisId}`,
    canonical_name: name,
    entity_type: "SOURCE_MEDIA_ENTITY",
    start_time: 0,
    end_time: 0,
    searchable_text: searchableText,
    searchable_keywords: uniqueValues(
      searchableText
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter((part) => part.length > 1),
    ),
    sources: [
      {
        source_type: "metadata",
        source_id: analysisId,
        match_text: name,
        start_time: 0,
        end_time: 0,
        confidence: 1,
        maturity: "raw",
        authority_status: "single_model_detected",
        evidence_ref: `source-media:${analysisId}`,
        traceback_ref: `source-media:${analysisId}`,
      },
    ],
    maturity_summary: {
      highest_maturity: "raw",
      has_manual_confirmation: false,
      has_multi_source_support: false,
      requires_review: true,
    },
    forensic_render_available: false,
    entity_card_available: true,
    search_surface: "entity",
    confidence_percent: 100,
  };
}

export default function SearchPanel({ videoId: initialVideoId = "" }: SearchPanelProps) {
  const { openPanel } = useLayoutHost();
  const [selectedVideoId, setSelectedVideoId] = useState(initialVideoId);
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [corpus, setCorpus] = useState<SearchCorpusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("all");
  const [sourceFilter, setSourceFilter] = useState<DatasceneEntitySourceType | "all">("all");
  const [typeFilter, setTypeFilter] = useState<DatasceneEntityType | "all">("all");
  const [maturityFilter, setMaturityFilter] = useState<MaturityFilter>("all");
  const [matcherRefreshing, setMatcherRefreshing] = useState(false);
  const [matcherRefreshMessage, setMatcherRefreshMessage] = useState("");
  const [corpusRefreshNonce, setCorpusRefreshNonce] = useState(0);

  useEffect(() => {
    const handler = (id: string) => setSelectedVideoId(id);
    eventBus.on("videoIdChanged", handler);
    return () => {
      eventBus.off("videoIdChanged", handler);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadVideos() {
      const list = await VideoService.list(50).catch(() => []);
      if (!mounted) return;
      setVideos(list);
      if (!selectedVideoId) {
        const firstCompleted = list.find((video) => video.status === "completed") || list[0];
        if (firstCompleted?.id) {
          setSelectedVideoId(firstCompleted.id);
        }
      }
    }
    void loadVideos();
    const refresh = () => void loadVideos();
    window.addEventListener("video-uploaded", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("video-uploaded", refresh);
    };
  }, [selectedVideoId]);

  const loadIds = useMemo(() => {
    if (selectedVideoId === "__all__") {
      return videos.map((video) => video.id);
    }
    return selectedVideoId ? [selectedVideoId] : [];
  }, [selectedVideoId, videos]);

  useEffect(() => {
    let mounted = true;
    async function loadCorpus() {
      if (loadIds.length === 0) {
        setCorpus([]);
        return;
      }
      setLoading(true);
      try {
        const rows = await Promise.all(
          loadIds.map(async (analysisId): Promise<SearchCorpusRow> => {
            const [metadata, analysisData] = await Promise.all([
              withSearchTimeout(VideoService.get(analysisId)),
              withSearchTimeout(VideoService.getAnalysis(analysisId)),
            ]);
            // Governed Content Search remains the primary source: analysisData.contentSearch?.search_index_records.
            const safeAnalysisData = analysisData || { contentSearch: null };
            const contentRecords = safeAnalysisData.contentSearch?.search_index_records || [];
            return {
              analysisId,
              sourceName: metadata?.name || analysisData?.metadata?.sourceName || analysisId,
              status: metadata?.status,
              analysisData,
              records: contentRecords.length > 0
                ? contentRecords
                : [sourceMediaFallbackSearchRecord(analysisId, metadata)],
            };
          }),
        );
        if (!mounted) return;
        setCorpus(rows);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadCorpus();
    return () => {
      mounted = false;
    };
  }, [corpusRefreshNonce, loadIds]);

  const runMatcherRefresh = async () => {
    if (!selectedVideoId || selectedVideoId === "__all__" || matcherRefreshing) {
      return;
    }
    setMatcherRefreshing(true);
    setMatcherRefreshMessage("Matcher refresh running...");
    try {
      const result = await apiService.refreshEvidenceProliferationMatcher(selectedVideoId, {
        request_limit: 12,
        candidate_limit: 25,
      });
      const candidateCount = Number(result.candidate_count || 0);
      const matchCount = Number(result.match_count || 0);
      setMatcherRefreshMessage(
        `Matcher refreshed: ${matchCount} runs, ${candidateCount} candidates`,
      );
      setCorpusRefreshNonce((current) => current + 1);
      eventBus.emit("analysisCorrectionsChanged", { analysisId: selectedVideoId });
    } catch (error) {
      setMatcherRefreshMessage(
        error instanceof Error ? error.message : "Matcher refresh failed",
      );
    } finally {
      setMatcherRefreshing(false);
    }
  };

  const availableSources = useMemo(
    () =>
      uniqueValues(
        corpus.flatMap((row) =>
          row.records.flatMap((record) => record.sources.map((source) => source.source_type)),
        ),
      ).sort(),
    [corpus],
  );

  const availableTypes = useMemo(
    () => uniqueValues(corpus.flatMap((row) => row.records.map((record) => record.entity_type))).sort(),
    [corpus],
  );

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return corpus
      .flatMap((row) =>
        row.records.map((record) => ({
          row,
          record,
          score: scoreRecord(record, trimmed),
        })),
      )
      .filter(({ score }) => score > 0)
      .filter(({ record }) => recordMatchesMode(record, mode))
      .filter(({ record }) =>
        sourceFilter === "all"
          ? true
          : record.sources.some((source) => source.source_type === sourceFilter),
      )
      .filter(({ record }) => (typeFilter === "all" ? true : record.entity_type === typeFilter))
      .filter(({ record }) => {
        if (maturityFilter === "all") return true;
        if (maturityFilter === "mature") return record.maturity_summary.highest_maturity === "mature";
        return record.maturity_summary.requires_review;
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.record.start_time - right.record.start_time;
      })
      .slice(0, 120);
  }, [corpus, maturityFilter, mode, query, sourceFilter, typeFilter]);

  const selectedVideoName =
    selectedVideoId === "__all__"
      ? "All existing analyses"
      : videos.find((video) => video.id === selectedVideoId)?.name || selectedVideoId || "No analysis";

  const totalRecords = corpus.reduce((sum, row) => sum + row.records.length, 0);
  const matureDataRecords = corpus.reduce(
    (sum, row) =>
      sum + row.records.filter((record) => record.search_surface === "mature_data").length,
    0,
  );
  const confirmableClusters = corpus.reduce(
    (sum, row) =>
      sum +
      row.records.filter((record) => record.search_surface === "confirmable_cluster").length,
    0,
  );
  const searchableAnalyses = videos.filter(isSearchableAnalysis).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-200">
              <Search className="h-4 w-4" />
              Datascene Search
            </div>
            <div className="mt-1 text-xs text-neutral-400">
              {selectedVideoName} / {videos.length} analyses surfaced / {searchableAnalyses} searchable / {totalRecords} indexed records / {matureDataRecords} mature data / {confirmableClusters} confirmable clusters
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-8 max-w-[260px] rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-100"
              value={selectedVideoId || ""}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedVideoId(nextId);
                if (nextId && nextId !== "__all__") {
                  eventBus.emit("videoIdChanged", nextId);
                }
              }}
            >
              <option value="">Select analysis</option>
              <option value="__all__">All existing analyses</option>
              {videos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.name || video.id} [{statusLabel(video.status)}]
                </option>
              ))}
            </select>
            <button
              className="inline-flex h-8 items-center gap-2 rounded border border-neutral-700 px-3 text-xs text-neutral-200 hover:border-cyan-500 hover:text-cyan-100"
              onClick={() => openPanel("DataMaturation", selectedVideoId && selectedVideoId !== "__all__" ? { videoId: selectedVideoId } : {})}
              title="Open Data Maturation"
            >
              <Database className="h-4 w-4" />
              Maturation
            </button>
            <button
              className="inline-flex h-8 items-center gap-2 rounded border border-neutral-700 px-3 text-xs text-neutral-200 hover:border-violet-500 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={runMatcherRefresh}
              disabled={!selectedVideoId || selectedVideoId === "__all__" || matcherRefreshing}
              title="Run traceable open-topology scanner/matcher refresh for this analysis"
              data-datascene-search-run-matcher-refresh="true"
            >
              <RefreshCw className={`h-4 w-4 ${matcherRefreshing ? "animate-spin" : ""}`} />
              Matcher
            </button>
          </div>
        </div>
        {matcherRefreshMessage ? (
          <div
            className="mt-2 rounded border border-violet-900/60 bg-violet-950/20 px-2 py-1 text-[11px] text-violet-100"
            data-datascene-search-matcher-refresh-status="true"
          >
            {matcherRefreshMessage}
          </div>
        ) : null}
      </div>

      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search speech, OCR, entities, objects, metadata"
              className="h-10 w-full rounded border border-neutral-700 bg-neutral-900 pl-9 pr-3 text-sm text-neutral-100 outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-8 items-center gap-1 rounded border border-neutral-800 bg-neutral-900 px-1">
              {SEARCH_MODES.map((item) => (
                <button
                  key={item.id}
                  className={`h-6 rounded px-2 text-xs ${
                    mode === item.id
                      ? "bg-cyan-500 text-neutral-950"
                      : "text-neutral-300 hover:bg-neutral-800"
                  }`}
                  onClick={() => setMode(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Filter className="h-4 w-4 text-neutral-500" />
            <select
              className="h-8 rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-100"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as DatasceneEntitySourceType | "all")}
            >
              <option value="all">All sources</option>
              {availableSources.map((source) => (
                <option key={source} value={source}>
                  {sourceLabel(source)}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-100"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as DatasceneEntityType | "all")}
            >
              <option value="all">All types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-100"
              value={maturityFilter}
              onChange={(event) => setMaturityFilter(event.target.value as MaturityFilter)}
            >
              <option value="all">All maturity</option>
              <option value="mature">Mature only</option>
              <option value="review">Needs review</option>
            </select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 text-sm text-neutral-400">Loading search index...</div>
        ) : results.length === 0 ? (
          <div className="p-4 text-sm text-neutral-400">
            {totalRecords === 0
              ? "Existing analyses are surfaced here. Search records appear when an analysis has completed governed Content Search indexing."
              : "No matching records."}
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {results.map(({ row, record }) => {
              const primarySource = record.sources[0];
              return (
                <div
                  key={groupResultKey(row, record)}
                  className="px-4 py-3 hover:bg-neutral-900/70"
                  data-datascene-search-result="true"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-neutral-100">
                          {record.canonical_name}
                        </span>
                        <span className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300">
                          {typeLabel(record.entity_type)}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] ${
                            record.maturity_summary.requires_review
                              ? "bg-amber-950 text-amber-200"
                              : "bg-emerald-950 text-emerald-200"
                          }`}
                        >
                          {record.maturity_summary.highest_maturity}
                        </span>
                        {record.search_surface === "mature_data" ? (
                          <span className="rounded bg-cyan-950 px-2 py-0.5 text-[11px] text-cyan-200">
                            Mature Data{record.confidence_percent ? ` ${record.confidence_percent}%` : ""}
                          </span>
                        ) : null}
                        {record.search_surface === "confirmable_cluster" ? (
                          <span className="rounded bg-violet-950 px-2 py-0.5 text-[11px] text-violet-200">
                            Confirmable cluster
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-neutral-400">
                        {primarySource?.match_text || primarySource?.detected_class || record.searchable_text}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          {sourceLabel(primarySource?.source_type || "metadata")}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatSeconds(record.start_time)}-{formatSeconds(record.end_time)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Boxes className="h-3.5 w-3.5" />
                          {row.sourceName}
                        </span>
                        {record.cluster_summary ? (
                          <span className="inline-flex items-center gap-1 text-violet-300">
                            <GitBranch className="h-3.5 w-3.5" />
                            {record.cluster_summary.propagation_state}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {record.search_surface === "mature_data" ||
                      record.search_surface === "confirmable_cluster" ? (
                        <button
                          className="inline-flex h-8 items-center gap-2 rounded border border-neutral-700 px-3 text-xs text-neutral-200 hover:border-amber-500 hover:text-amber-100"
                          onClick={() => openPanel("DataMaturation", { videoId: row.analysisId })}
                          title="Review Mature Data proliferation"
                        >
                          <Database className="h-4 w-4" />
                          Review
                        </button>
                      ) : null}
                      <button
                        className="inline-flex h-8 items-center gap-2 rounded border border-neutral-700 px-3 text-xs text-neutral-200 hover:border-cyan-500 hover:text-cyan-100"
                        onClick={() => openVideoAtTime(row.analysisId, record.start_time)}
                        title="Open video at result time"
                      >
                        <Video className="h-4 w-4" />
                        Open
                      </button>
                      <button
                        className="inline-flex h-8 items-center gap-2 rounded border border-neutral-700 px-3 text-xs text-neutral-200 hover:border-cyan-500 hover:text-cyan-100"
                        onClick={() => openPanel("MeaningNetwork", { videoId: row.analysisId })}
                        title="Open Meaning Network"
                      >
                        <GitBranch className="h-4 w-4" />
                        Network
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {record.searchable_keywords.slice(0, 8).map((keyword) => (
                      <span
                        key={`${record.index_id}:${keyword}`}
                        className="rounded bg-neutral-900 px-2 py-0.5 text-[10px] text-neutral-500"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
