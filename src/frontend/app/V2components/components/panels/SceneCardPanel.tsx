"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Clock, Edit3, FileText, RefreshCcw, Save, Tags, Video } from "lucide-react";
import {
  apiService,
  type ManualVisualAnnotation,
  type SecondOrderLabelInstruction,
} from "@/lib/api-service";
import {
  broadcastAnalysisCorrectionRefresh,
  createEmptyCorrections,
  pushCorrectionSnapshot,
  upsertManualVisualAnnotation,
} from "@/lib/annotation-corrections";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type AnalysisData, type MatureEvidenceAuthority } from "@/lib/video-service";
import { openVideoAtTime } from "@/lib/video-navigation";
import { useLayoutHost } from "../LayoutHost";

type SceneCardBundle = {
  schema?: string;
  title?: string;
  artifact_type?: string;
  analysis_id?: string;
  source_video_id?: string;
  scene_cards?: SceneCard[];
  source_metadata_unchanged?: Record<string, unknown>;
};

type SceneCardSummary = {
  title?: string;
  summary?: string;
  facets?: Record<string, SceneCardFacet[]>;
};

type SceneCardFacet = {
  label?: string;
  symbol?: string;
  likelihood?: string;
  supporting_scene?: string;
};

type SceneCardSpeech = {
  evidence_id?: string;
  speaker?: string;
  text?: string;
  navigation_time_seconds?: number;
  time_interval?: {
    start_ms?: number;
    end_ms?: number;
  };
};

type SceneCardItem = {
  item_id?: string;
  category?: string;
  label?: string;
  symbol?: string;
  likelihood?: string;
  status?: string;
  navigation?: {
    panel?: string;
    time_seconds?: number;
    video_id?: string;
  };
};

type SceneMeaningPlotItem = {
  instruction_id?: string;
  event_id?: string;
  label?: string;
  target_label_family?: string;
  candidate_label?: string;
  status?: string;
  confidence?: number;
  lens_terms?: string[];
  navigation?: {
    panel?: string;
    time_seconds?: number;
    video_id?: string;
  };
  time_interval?: {
    start_ms?: number;
    end_ms?: number;
  };
};

type SceneMeaningPlot = {
  summary?: string;
  authority?: string;
  source?: string;
  instructions?: SceneMeaningPlotItem[];
  meaning_events?: SceneMeaningPlotItem[];
};

type SceneNlpSummary = {
  sentence?: string;
  authority?: string;
  description?: SceneMiseEnSceneDescription;
  summary_inputs?: Record<string, unknown>;
  source_evidence_ids?: string[];
};

type SceneMiseEnSceneDescription = {
  what_is_happening?: string;
  who_is_speaking?: string;
  situation?: string;
  meanings_constructed?: string;
  phenomena?: string;
};

type SceneCard = {
  schema?: string;
  title?: string;
  display_title?: string;
  scene_id?: string;
  overview?: string;
  nlp_scene_summary_sentence?: string;
  nlp_scene_summary?: SceneNlpSummary;
  mise_en_scene_description?: SceneMiseEnSceneDescription;
  scene_boundary_source?: string;
  time_interval?: {
    start_ms?: number;
    end_ms?: number;
  };
  tags?: Record<string, string[]>;
  said_in_scene?: SceneCardSpeech[];
  meaning_plot?: SceneMeaningPlot;
  items?: SceneCardItem[];
  resolved_items?: SceneCardItem[];
};

const FACET_ORDER = [
  "persons",
  "places",
  "speech",
  "situations",
  "events",
  "themes",
  "props",
  "costume",
  "actions",
  "cinematic_cues",
  "genre_form",
  "subject_domain",
];

function secondsFromMs(value?: number): number {
  return Math.max(0, Number(value || 0) / 1000);
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}`;
}

function titleCaseFacet(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function sourcePanelName(panel?: string): string {
  const normalized = String(panel || "").toLowerCase();
  if (normalized.includes("transcript")) return "Transcript";
  if (normalized.includes("obj") || normalized.includes("object")) return "OBJDetection";
  if (normalized.includes("ocr")) return "OCR";
  if (normalized.includes("expression")) return "Expressions";
  if (normalized.includes("audio")) return "Tools";
  if (normalized.includes("master") || normalized.includes("manual")) return "ManualScene";
  return "VideoPanel";
}

function authoritySymbol(authority?: MatureEvidenceAuthority): string {
  if (authority === "manual_correction" || authority === "manual_annotation") return "✓";
  if (authority === "mature_triangulated") return "◆";
  if (authority === "interpreted_detection") return "◐";
  return "●";
}

function intervalsOverlap(start: number, end: number, itemStart?: number, itemEnd?: number): boolean {
  const left = Number(itemStart ?? 0);
  const right = Number(itemEnd ?? itemStart ?? 0);
  return right >= start && left <= end;
}

function instructionStartSeconds(instruction: SecondOrderLabelInstruction): number {
  const raw = instruction.time_span?.start_ms ?? instruction.time_span?.start ?? 0;
  const value = Number(raw || 0);
  return instruction.time_span?.start_ms !== undefined || value > 1000 ? value / 1000 : value;
}

function instructionEndSeconds(instruction: SecondOrderLabelInstruction): number {
  const raw =
    instruction.time_span?.end_ms ??
    instruction.time_span?.end ??
    instruction.time_span?.start_ms ??
    instruction.time_span?.start ??
    0;
  const value = Number(raw || 0);
  return instruction.time_span?.end_ms !== undefined || value > 1000 ? value / 1000 : value;
}

function meaningLensTerms(instruction: SecondOrderLabelInstruction): string[] {
  const payload = instruction.source_feature_payload || {};
  const lenses = payload.alternative_plot_lenses;
  if (!lenses || typeof lenses !== "object" || Array.isArray(lenses)) {
    return [];
  }
  const terms: string[] = [];
  for (const value of Object.values(lenses as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    for (const term of value.slice(0, 3)) {
      const clean = String(term || "").replaceAll("_", " ").trim();
      if (clean && !terms.includes(clean)) {
        terms.push(clean);
      }
    }
  }
  return terms.slice(0, 8);
}

async function loadJsonDownload<T>(analysisId: string, fileType: string): Promise<T | null> {
  try {
    const blob = await apiService.downloadFile(analysisId, fileType);
    return JSON.parse(await blob.text()) as T;
  } catch (error) {
    console.warn(`SceneCardPanel could not load ${fileType}:`, error);
    return null;
  }
}

export default function SceneCardPanel({ videoId: initialVideoId = "" }: { videoId?: string }) {
  const { openPanel } = useLayoutHost();
  const [selectedVideoId, setSelectedVideoId] = useState(initialVideoId);
  const [bundle, setBundle] = useState<SceneCardBundle | null>(null);
  const [metadataSummary, setMetadataSummary] = useState<SceneCardSummary | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [noteDraft, setNoteDraft] = useState("");
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [reportDraftWriting, setReportDraftWriting] = useState(false);
  const [reportDraftMessage, setReportDraftMessage] = useState("");

  useEffect(() => {
    const handler = (id: string) => setSelectedVideoId(id);
    const correctionHandler = (id: string) => {
      if (id === selectedVideoId) {
        setRefreshNonce((value) => value + 1);
      }
    };
    eventBus.on("videoIdChanged", handler);
    eventBus.on("analysisCorrectionsChanged", correctionHandler);
    return () => {
      eventBus.off("videoIdChanged", handler);
      eventBus.off("analysisCorrectionsChanged", correctionHandler);
    };
  }, [selectedVideoId]);

  useEffect(() => {
    if (!selectedVideoId) {
      return;
    }

    let cancelled = false;

    const loadSceneCards = async () => {
      setLoading(true);
      setError("");
      try {
        const nextAnalysis = await VideoService.refreshAnalysis(selectedVideoId);
        if (!cancelled) {
          setAnalysisData(nextAnalysis);
        }
        const [nextBundle, nextSummary] = await Promise.all([
          loadJsonDownload<SceneCardBundle>(selectedVideoId, "mise_en_scene_scene_cards"),
          loadJsonDownload<SceneCardSummary>(
            selectedVideoId,
            "source_extraction_metadata_summary",
          ),
        ]);
        if (cancelled) return;
        setBundle(nextBundle);
        setMetadataSummary(nextSummary);
        const nextCards = nextBundle?.scene_cards || [];
        const firstSceneId = nextCards[0]?.scene_id || "";
        setSelectedSceneId((previous) =>
          nextCards.some((card) => card.scene_id === previous) ? previous : firstSceneId,
        );
        if (!nextBundle?.scene_cards?.length) {
          setError("Scene Card Report is not available for this analysis.");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Scene Card load failed.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSceneCards();

    return () => {
      cancelled = true;
    };
  }, [selectedVideoId, refreshNonce]);

  const cards = useMemo(() => bundle?.scene_cards || [], [bundle?.scene_cards]);
  const selectedCard = useMemo(() => {
    return cards.find((card) => card.scene_id === selectedSceneId) || cards[0] || null;
  }, [cards, selectedSceneId]);

  const sceneStart = secondsFromMs(selectedCard?.time_interval?.start_ms);
  const sceneEnd = secondsFromMs(selectedCard?.time_interval?.end_ms);
  const matureSpeech = useMemo<SceneCardSpeech[]>(() => {
    if (!selectedCard || !analysisData?.transcript?.length) {
      return selectedCard?.said_in_scene || [];
    }
    const corrected = analysisData.transcript
      .filter((segment) => intervalsOverlap(sceneStart, sceneEnd, segment.start, segment.end))
      .map((segment, index) => ({
        evidence_id: segment.targetId || `mature-transcript:${index}`,
        speaker:
          segment.correctionSource === "manual"
            ? "Analyst note"
            : segment.speaker || "SPEAKER_UNKNOWN",
        text: segment.text,
        navigation_time_seconds: segment.start,
        time_interval: {
          start_ms: Math.round(Number(segment.start || 0) * 1000),
          end_ms: Math.round(Number(segment.end || segment.start || 0) * 1000),
        },
      }));
    return corrected.length ? corrected : selectedCard.said_in_scene || [];
  }, [analysisData?.transcript, sceneEnd, sceneStart, selectedCard]);

  const matureItems = useMemo<SceneCardItem[]>(() => {
    const records = analysisData?.masterSchemaResolvedEvidence?.records || [];
    const resolvedItems = records
      .filter((record) =>
        ["object", "ocr", "expression", "manual_annotation", "identity", "second_order"].includes(
          record.category,
        ),
      )
      .filter((record) => intervalsOverlap(sceneStart, sceneEnd, record.start, record.end))
      .map((record) => ({
        item_id: `mature:${record.id}`,
        category:
          record.category === "object"
            ? "props"
            : record.category === "expression"
              ? "situations"
              : record.category === "manual_annotation"
                ? "situations"
                : record.category === "identity"
                  ? "persons"
                  : record.category === "second_order"
                    ? "themes"
                    : "props",
        label: record.label,
        symbol: authoritySymbol(record.authority),
        likelihood: record.authority,
        status: record.authority.startsWith("manual") ? "manual" : "mature",
        navigation: {
          panel: record.sourcePanel,
          time_seconds: record.start ?? sceneStart,
          video_id: selectedVideoId,
        },
      }));
    const audioItems = (analysisData?.audioProsody || [])
      .filter((cue) => intervalsOverlap(sceneStart, sceneEnd, cue.start, cue.end))
      .map((cue) => ({
        item_id: `mature-audio:${cue.cue_id}`,
        category: "events",
        label:
          cue.sound_environment?.label ||
          cue.emphasis?.label ||
          cue.rhythm_profile?.label ||
          cue.tonality_profile?.label ||
          "audio prosody cue",
        symbol: "◐",
        likelihood: "interpreted_detection",
        status: "mature",
        navigation: {
          panel: "Tools",
          time_seconds: cue.start,
          video_id: selectedVideoId,
        },
      }));
    return [...resolvedItems, ...audioItems];
  }, [
    analysisData?.audioProsody,
    analysisData?.masterSchemaResolvedEvidence?.records,
    sceneEnd,
    sceneStart,
    selectedVideoId,
  ]);

  const matureMeaningPlot = useMemo<SceneMeaningPlot | null>(() => {
    const existing = selectedCard?.meaning_plot;
    if (existing?.instructions?.length || existing?.meaning_events?.length) {
      return existing;
    }
    const families = new Set(["Scene", "Episode", "Situation", "Action", "ReportClaim"]);
    const instructions = (analysisData?.secondOrderLabelProliferation?.instructions || [])
      .filter((instruction) => families.has(instruction.target_label_family))
      .filter((instruction) =>
        intervalsOverlap(
          sceneStart,
          sceneEnd,
          instructionStartSeconds(instruction),
          instructionEndSeconds(instruction),
        ),
      )
      .sort((left, right) => {
        const rightScore = right.open_scores?.weighted_support_score ?? 0;
        const leftScore = left.open_scores?.weighted_support_score ?? 0;
        return rightScore - leftScore;
      })
      .slice(0, 12)
      .map((instruction) => ({
        instruction_id: instruction.instruction_id,
        label: `${instruction.target_label_family}: ${instruction.candidate_label.replaceAll("_", " ")}`,
        target_label_family: instruction.target_label_family,
        candidate_label: instruction.candidate_label,
        status: instruction.status,
        confidence: instruction.open_scores?.weighted_support_score,
        lens_terms: meaningLensTerms(instruction),
        navigation: {
          panel: "MeaningPlot",
          time_seconds: instructionStartSeconds(instruction),
          video_id: selectedVideoId,
        },
        time_interval: {
          start_ms: Math.round(instructionStartSeconds(instruction) * 1000),
          end_ms: Math.round(instructionEndSeconds(instruction) * 1000),
        },
      }));
    if (!instructions.length) {
      return existing || null;
    }
    return {
      summary: `Meaning / plot candidates: ${instructions
        .slice(0, 3)
        .map((item) => item.label)
        .join("; ")}.`,
      authority: "mature_interpretive_candidate",
      source: "master_schema_resolved_second_order",
      instructions,
      meaning_events: existing?.meaning_events || [],
    };
  }, [
    analysisData?.secondOrderLabelProliferation?.instructions,
    sceneEnd,
    sceneStart,
    selectedCard?.meaning_plot,
    selectedVideoId,
  ]);

  const visibleItems = useMemo(() => {
    const rawItems = selectedCard?.resolved_items || selectedCard?.items || [];
    const byIdentity = new Map<string, SceneCardItem>();
    for (const item of [...matureItems, ...rawItems]) {
      const key = `${item.category}:${String(item.label || "").toLowerCase()}`;
      if (!byIdentity.has(key)) {
        byIdentity.set(key, item);
      }
    }
    return Array.from(byIdentity.values());
  }, [matureItems, selectedCard?.items, selectedCard?.resolved_items]);

  const miseEnSceneDescription = useMemo(() => {
    return (
      selectedCard?.mise_en_scene_description ||
      selectedCard?.nlp_scene_summary?.description ||
      null
    );
  }, [selectedCard?.mise_en_scene_description, selectedCard?.nlp_scene_summary?.description]);

  useEffect(() => {
    if (!selectedCard) {
      setNoteDraft("");
      setShowNoteEditor(false);
      setSaveMessage("");
      return;
    }
    setNoteDraft(selectedCard.overview || "");
    setShowNoteEditor(false);
    setSaveMessage("");
  }, [selectedCard?.scene_id, selectedCard]);

  const navigateToTime = (seconds: number) => {
    if (!selectedVideoId) return;
    openVideoAtTime(selectedVideoId, seconds);
  };

  const navigateToScene = (card: SceneCard) => {
    setSelectedSceneId(card.scene_id || "");
    navigateToTime(secondsFromMs(card.time_interval?.start_ms));
  };

  const navigateToEvidence = (item: SceneCardItem) => {
    const seconds =
      typeof item.navigation?.time_seconds === "number"
        ? item.navigation.time_seconds
        : sceneStart;
    const targetVideoId = item.navigation?.video_id || selectedVideoId;
    if (targetVideoId) {
      openVideoAtTime(targetVideoId, seconds);
    }
    openPanel(sourcePanelName(item.navigation?.panel), targetVideoId ? { videoId: targetVideoId } : {});
  };

  const navigateToMeaningPlot = (item: SceneMeaningPlotItem) => {
    const seconds =
      typeof item.navigation?.time_seconds === "number"
        ? item.navigation.time_seconds
        : secondsFromMs(item.time_interval?.start_ms);
    if (selectedVideoId) {
      openVideoAtTime(selectedVideoId, seconds);
      openPanel("MeaningPlot", { videoId: selectedVideoId });
    }
  };

  const saveSceneNote = async () => {
    if (!selectedVideoId || !selectedCard || !noteDraft.trim()) return;
    setSavingNote(true);
    setSaveMessage("");
    try {
      const existing = await apiService.getAnnotationCorrections(selectedVideoId);
      const baseCorrections = createEmptyCorrections(existing);
      const annotation: ManualVisualAnnotation = {
        id: `scene-card-note:${selectedCard.scene_id || "scene"}:${Math.round(sceneStart * 1000)}`,
        category: "Scene",
        subcategory: "mise-en-scene note",
        label: "Mise-en-scene scene note",
        custom_label: "Mise-en-scene scene note",
        geometry_type: "box",
        coordinates: { x: 0, y: 0, w: 1, h: 1 },
        timestamp_seconds: sceneStart,
        start_seconds: sceneStart,
        end_seconds: sceneEnd || sceneStart,
        open_note: noteDraft.trim(),
        metadata_correlation: {
          target_type: "scene_card",
          target_id: selectedCard.scene_id || selectedCard.title || "scene_card",
          target_label: selectedCard.display_title || selectedCard.title || "Scene Card",
          relation: "extends",
          note: "Created from the Mise-en-Scene Scene Card panel.",
        },
        teaches_regime: true,
        updated_at: new Date().toISOString(),
        updated_by: "analyst",
      };
      pushCorrectionSnapshot(selectedVideoId, existing || baseCorrections);
      const nextCorrections = upsertManualVisualAnnotation(existing || baseCorrections, annotation);
      await VideoService.saveAnnotationCorrections(selectedVideoId, nextCorrections);
      broadcastAnalysisCorrectionRefresh(selectedVideoId);
      setSaveMessage("Saved to the manual Scene leaf.");
      openPanel("ManualScene", { videoId: selectedVideoId });
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "Scene note save failed.");
    } finally {
      setSavingNote(false);
    }
  };

  const writeSceneCardReportDraft = async () => {
    if (!selectedVideoId) return;
    setReportDraftWriting(true);
    setReportDraftMessage("");
    try {
      const result = await apiService.writeAiAgentSceneCardReportDraft(selectedVideoId);
      setReportDraftMessage(
        `Report draft written with ${result.scene_count} scene${result.scene_count === 1 ? "" : "s"}. It is now available in Downloads as Scene Card Draft.`,
      );
    } catch (draftError) {
      setReportDraftMessage(
        draftError instanceof Error ? draftError.message : "Scene Card report draft failed.",
      );
    } finally {
      setReportDraftWriting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0f0f0f] text-slate-200">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] text-lime-300">
              Mise-en-Scene
            </div>
            <h2 className="truncate text-sm font-semibold text-slate-100">
              {bundle?.title || "Scene Card Report"}
            </h2>
            <div className="mt-1 text-[11px] text-[var(--ui-passive-text)]">
              {selectedVideoId ? `${cards.length} scene card${cards.length === 1 ? "" : "s"}` : "No analysis selected"}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setRefreshNonce((value) => value + 1)}
              className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-lime-500/70 hover:bg-lime-950/20"
              title="Reload Scene Card Report"
            >
              <RefreshCcw className="size-3" />
              Refresh
            </button>
            <button
              type="button"
              onClick={writeSceneCardReportDraft}
              disabled={!selectedVideoId || reportDraftWriting || loading || !cards.length}
              className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-500/70 hover:bg-cyan-950/20 disabled:cursor-not-allowed disabled:opacity-50"
              title="Write a Markdown report draft from these Scene Cards"
            >
              <FileText className="size-3" />
              {reportDraftWriting ? "Drafting..." : "Draft report"}
            </button>
          </div>
        </div>
      </header>

      {!selectedVideoId ? (
        <div className="p-4 text-sm text-slate-400">Select an analysed video to view Scene Cards.</div>
      ) : loading ? (
        <div className="p-4 text-sm text-slate-400">Loading Scene Card Report...</div>
      ) : error ? (
        <div className="p-4 text-sm text-slate-400">{error}</div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(160px,0.7fr)_minmax(0,2fr)] overflow-hidden">
          <aside className="overflow-y-auto border-r border-slate-800 bg-[#111] p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <Tags className="size-3" />
              Scenes
            </div>
            <div className="space-y-1.5">
              {cards.map((card, index) => {
                const start = secondsFromMs(card.time_interval?.start_ms);
                const active = card.scene_id === selectedCard?.scene_id;
                return (
                  <button
                    key={card.scene_id || index}
                    type="button"
                    onClick={() => navigateToScene(card)}
                    className={`w-full rounded border px-2 py-2 text-left text-[11px] ${
                      active
                        ? "border-lime-500/60 bg-lime-950/20 text-lime-100"
                        : "border-slate-800 bg-[#151515] text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <div className="truncate font-medium">
                      {card.display_title || card.title || `Scene ${index + 1}`}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {formatTime(start)} • {card.scene_boundary_source || "detected"}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-w-0 overflow-y-auto p-4">
            {selectedCard && (
              <div className="space-y-4">
                {reportDraftMessage && (
                  <div className="rounded border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-[11px] text-cyan-100">
                    {reportDraftMessage}
                  </div>
                )}

                <section className="border-b border-slate-800 pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-100">
                        {selectedCard.display_title || selectedCard.title || "Scene Card"}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatTime(sceneStart)}-{formatTime(sceneEnd)}
                        </span>
                        <span>{selectedCard.scene_boundary_source || "detected"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigateToTime(sceneStart)}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-500/70 hover:bg-cyan-950/20"
                        title="Open this scene in the video panel"
                      >
                        <Video className="size-3" />
                        Video
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNoteEditor((value) => !value)}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-amber-500/70 hover:bg-amber-950/20"
                        title="Save a manual correction or note for this scene"
                      >
                        <Edit3 className="size-3" />
                        Correct
                      </button>
                      <button
                        type="button"
                        onClick={() => openPanel("ManualScene", selectedVideoId ? { videoId: selectedVideoId } : {})}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-lime-500/70 hover:bg-lime-950/20"
                        title="Open the manual Scene annotation leaf"
                      >
                        <FileText className="size-3" />
                        Scene leaf
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {selectedCard.overview || "No overview available."}
                  </p>
                  {(selectedCard.nlp_scene_summary_sentence ||
                    selectedCard.nlp_scene_summary?.sentence) && (
                    <div className="mt-3 rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-2">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-300">
                        What Is Happening
                      </div>
                      <p className="text-sm leading-6 text-slate-100">
                        {selectedCard.nlp_scene_summary_sentence ||
                          selectedCard.nlp_scene_summary?.sentence}
                      </p>
                      {selectedCard.nlp_scene_summary?.authority && (
                        <div className="mt-1 text-[10px] text-slate-500">
                          {selectedCard.nlp_scene_summary.authority.replaceAll("_", " ")}
                        </div>
                      )}
                      {miseEnSceneDescription && (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {[
                            ["Who is speaking?", miseEnSceneDescription.who_is_speaking],
                            ["In what situation?", miseEnSceneDescription.situation],
                            [
                              "What meanings are being constructed?",
                              miseEnSceneDescription.meanings_constructed,
                            ],
                            [
                              "What phenomena occur in the material?",
                              miseEnSceneDescription.phenomena,
                            ],
                          ]
                            .filter(([, value]) => Boolean(value))
                            .map(([label, value]) => (
                              <div
                                key={label}
                                className="rounded border border-cyan-900/60 bg-[#0d1417] px-2 py-2"
                              >
                                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-400/80">
                                  {label}
                                </div>
                                <div className="mt-1 text-[12px] leading-5 text-slate-200">
                                  {value}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                  {showNoteEditor && (
                    <div className="mt-3 border border-slate-800 bg-[#111] p-3">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Manual Scene Note
                      </label>
                      <textarea
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        className="min-h-20 w-full resize-y rounded border border-slate-800 bg-[#0b0b0b] px-2 py-2 text-[12px] leading-5 text-slate-100 outline-none focus:border-amber-500/70"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={saveSceneNote}
                          disabled={savingNote || !noteDraft.trim()}
                          className="inline-flex items-center gap-1 rounded border border-amber-700/70 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Save className="size-3" />
                          {savingNote ? "Saving..." : "Save to Scene leaf"}
                        </button>
                        {saveMessage && (
                          <span className="text-[11px] text-slate-400">{saveMessage}</span>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-300">
                    Said In Scene
                  </div>
                  <div className="space-y-2">
                    {matureSpeech.slice(0, 80).map((utterance, index) => {
                      const start =
                        typeof utterance.navigation_time_seconds === "number"
                          ? utterance.navigation_time_seconds
                          : secondsFromMs(utterance.time_interval?.start_ms);
                      return (
                        <button
                          key={utterance.evidence_id || index}
                          type="button"
                          onClick={() => {
                            navigateToTime(start);
                            openPanel("Transcript", selectedVideoId ? { videoId: selectedVideoId } : {});
                          }}
                          className="w-full border-l border-cyan-700/80 bg-[#111] px-3 py-2 text-left hover:border-cyan-500 hover:bg-cyan-950/10"
                          title="Jump to this utterance"
                        >
                          <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-slate-500">
                            <span>{utterance.speaker || "Speaker"}</span>
                            <span>{formatTime(start)}</span>
                          </div>
                          <div className="text-[12px] leading-5 text-slate-100">
                            {utterance.text || ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {matureMeaningPlot && (
                  <section className="border-y border-slate-800 py-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-300">
                      Meaning / Plot
                    </div>
                    <p className="text-[12px] leading-5 text-slate-300">
                      {matureMeaningPlot.summary || "No plot / meaning candidates surfaced for this scene yet."}
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {(matureMeaningPlot.instructions || [])
                        .slice(0, 6)
                        .map((item, index) => {
                          const start =
                            typeof item.navigation?.time_seconds === "number"
                              ? item.navigation.time_seconds
                              : secondsFromMs(item.time_interval?.start_ms);
                          return (
                            <button
                              key={item.instruction_id || item.event_id || index}
                              type="button"
                              onClick={() => navigateToMeaningPlot(item)}
                              className="border border-violet-900/60 bg-violet-950/10 px-2 py-2 text-left hover:border-violet-500/70 hover:bg-violet-950/20"
                              title="Open this meaning / plot candidate"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 truncate text-[12px] text-violet-100">
                                  {item.label || "meaning candidate"}
                                </span>
                                <span className="shrink-0 text-[10px] text-slate-500">
                                  {formatTime(start)}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(item.lens_terms || []).slice(0, 4).map((term) => (
                                  <span
                                    key={`${item.instruction_id || index}:${term}`}
                                    className="rounded border border-violet-800/60 px-1.5 py-0.5 text-[10px] text-violet-100/80"
                                  >
                                    {term}
                                  </span>
                                ))}
                                {item.status && (
                                  <span className="rounded border border-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                    {item.status}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </section>
                )}

                {metadataSummary?.summary && (
                  <section className="border-b border-slate-800 pb-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-300">
                      Source Extraction Metadata Summary
                    </div>
                    <p className="text-[12px] leading-5 text-slate-300">{metadataSummary.summary}</p>
                  </section>
                )}

                <section>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Ontology Facets
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {FACET_ORDER.map((facet) => {
                      const values = selectedCard.tags?.[facet] || [];
                      if (!values.length) return null;
                      return (
                        <div key={facet} className="border-t border-slate-800 pt-2">
                          <div className="mb-1 text-[11px] text-slate-500">{titleCaseFacet(facet)}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {values.slice(0, 18).map((value) => (
                              <span
                                key={value}
                                className="rounded border border-slate-800 bg-[#151515] px-2 py-1 text-[11px] text-slate-200"
                              >
                                {value}
                              </span>
                            ))}
                            {values.length > 18 && (
                              <span className="px-1 py-1 text-[11px] text-slate-500">
                                +{values.length - 18}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Evidence Items
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {visibleItems.slice(0, 80).map((item, index) => (
                      <button
                        key={item.item_id || `${item.category}-${item.label}-${index}`}
                        type="button"
                        onClick={() => navigateToEvidence(item)}
                        className="flex items-start justify-between gap-2 border border-slate-800 bg-[#111] px-2 py-2 text-left hover:border-cyan-500/70 hover:bg-cyan-950/10"
                        title="Open the source evidence"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12px] text-slate-200">
                            {item.symbol ? `${item.symbol} ` : ""}
                            {item.label || "Unnamed evidence"}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {item.category || "uncategorized"} • {item.likelihood || item.status || "system"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
