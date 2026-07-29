import React, { useEffect, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService } from "@/lib/video-service";
import { apiService, type SourceMediaMetadata } from "@/lib/api-service";
import { buildExpressionWeighting } from "@/lib/expression-weighting";
import {
  broadcastAnalysisCorrectionRefresh,
  canUndoCorrectionSnapshot,
  buildCorrectionRule,
  buildDropCorrectionRule,
  createEmptyCorrections,
  mergeCorrectionRule,
  pushCorrectionSnapshot,
  removeCorrectionRule,
  undoLastCorrectionSnapshot,
} from "@/lib/annotation-corrections";
import { Search, MoreHorizontal, RotateCcw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openManualAnnotationInVideo, openVideoAtTime } from "@/lib/video-navigation";

function formatPanelTime(value?: number | null): string {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe)) return "0:00.000";
  const clamped = Math.max(0, safe);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

const EXPRESSION_CORRECTION_OPTIONS = [
  "amused",
  "approving",
  "assertive",
  "attentive",
  "authoritative",
  "composed",
  "concerned",
  "deliberate",
  "emphatic",
  "empathetic",
  "focused",
  "formal_neutral",
  "reflective",
  "reassuring",
  "restrained",
  "serious",
  "skeptical",
  "tense",
  "uneasy",
  "warm",
] as const;

export default function ExpressionPanel() {
  const [videoId, setVideoId] = useState("");
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [sourceMetadata, setSourceMetadata] = useState<SourceMediaMetadata | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [openCorrectionKey, setOpenCorrectionKey] = useState<string | null>(null);

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
    async function load() {
      if (!videoId) {
        setAnalysisData(null);
        setSourceMetadata(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [analysis, metadata] = await Promise.all([
          VideoService.getAnalysis(videoId),
          apiService.getSourceMediaMetadata(videoId).catch(() => null),
        ]);
        setAnalysisData(analysis);
        setSourceMetadata(metadata);
      } catch (err) {
        console.error("Failed to load expression data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [videoId, refreshNonce]);

  const expressionResults = analysisData?.expressionResults ?? [];

  const saveExpressionCorrection = async (
    rawValue: string,
    correctedValue: string,
    timestamp?: number,
  ) => {
    if (!videoId || !rawValue) {
      return;
    }
    if (!correctedValue || correctedValue.trim() === rawValue.trim()) {
      setOpenCorrectionKey(null);
      return;
    }
    const existingCorrections = analysisData?.annotationCorrections;
    const filteredOverrides = (existingCorrections?.label_overrides || []).filter(
      (rule: any) =>
        !(
          rule?.modality === "expression" &&
          String(rule?.raw_value || "").trim().toLowerCase() ===
            rawValue.trim().toLowerCase() &&
          rule?.target_timestamp === undefined
        ),
    );
    const nextCorrections = mergeCorrectionRule(
      {
        ...(existingCorrections || {}),
        label_overrides: filteredOverrides,
      },
      buildCorrectionRule("expression", rawValue, correctedValue.trim(), "", {
        targetTimestamp: timestamp,
      }),
    );
    pushCorrectionSnapshot(videoId, existingCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setOpenCorrectionKey(null);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const revertExpressionCorrection = async (sample: any) => {
    if (!videoId) {
      return;
    }
    const rawValue =
      sample?.rawDominantEmotion || sample?.dominant_emotion || "Unknown";
    const scopedRuleId = buildCorrectionRule(
      "expression",
      rawValue,
      "__revert__",
      "",
      {
        targetTimestamp: sample.timestamp,
      },
    ).id;
    const nextCorrections = removeCorrectionRule(
      analysisData?.annotationCorrections,
      scopedRuleId,
    );
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const dropExpressionDetection = async (sample: any) => {
    if (!videoId) {
      return;
    }
    const rawValue =
      sample?.rawDominantEmotion || sample?.dominant_emotion || "Unknown";
    const nextCorrections = mergeCorrectionRule(
      analysisData?.annotationCorrections,
      buildDropCorrectionRule("expression", rawValue, {
        targetTimestamp: sample.timestamp,
      }),
    );
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const undoLastCorrection = async () => {
    if (!videoId) {
      return;
    }
    const restored = undoLastCorrectionSnapshot(videoId);
    if (restored === null && !analysisData?.annotationCorrections) {
      return;
    }
    const nextCorrections =
      restored || createEmptyCorrections(analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const canUndo = canUndoCorrectionSnapshot(videoId);
  const manualExpressionAnnotations =
    analysisData?.manualAnnotationsByCategory?.Expressions || [];

  return (
    <TooltipProvider delayDuration={200}>
      <main className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between shrink-0">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
              Expressions
            </span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      void undoLastCorrection();
                    }}
                    disabled={!canUndo}
                    className="p-1 hover:bg-[#2a2a2a] rounded disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <RotateCcw className="size-3.5 text-[#b8b8b8]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Undo last correction</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-[#2a2a2a] rounded">
                    <Search className="size-3.5 text-[#b8b8b8]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search expression samples</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-[#2a2a2a] rounded">
                    <MoreHorizontal className="size-3.5 text-[#b8b8b8]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>More actions</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex-1 min-h-0 px-3 pb-3 flex flex-col">
            <div className="mb-2 shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
              Emotion timeline
            </div>
            {analysisData?.expressionSamplingCoverage?.noFaceOrInvalidSamples > 0 ? (
              <div className="mb-2 shrink-0 rounded border border-slate-800 bg-slate-950/20 px-3 py-1.5 text-[10px] text-[var(--ui-passive-text)]">
                {analysisData.expressionSamplingCoverage.sourceDetections} source-linked
                expression detections ·{" "}
                {analysisData.expressionSamplingCoverage.noFaceOrInvalidSamples} no-face
                sampling gaps excluded
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2">
              {isLoading ? (
                <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
                  Loading expression results...
                </div>
              ) : expressionResults.length === 0 &&
                manualExpressionAnnotations.length === 0 ? (
                <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
                  No expression results
                </div>
              ) : (
                <>
                  {manualExpressionAnnotations.length > 0 && (
                    <div className="mb-2 rounded border border-amber-400/20 bg-amber-400/5 px-3 py-2">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-amber-100/80">
                        Manual expression annotations
                      </div>
                      <div className="space-y-1">
                        {manualExpressionAnnotations.map((item: any) => (
                          <button
                            key={item.id}
                            type="button"
                            className="block w-full rounded border border-slate-800 bg-slate-950/20 px-2 py-1 text-left text-[10px] text-slate-200 hover:bg-slate-900/35"
                            onClick={() => {
                              openManualAnnotationInVideo(videoId, item);
                            }}
                          >
                            <div className="font-medium">
                              {item.label ||
                                item.custom_label ||
                                "Manual expression annotation"}
                            </div>
                            <div className="text-[var(--ui-passive-text)]">
                              {formatPanelTime(item.timestamp_seconds)}
                              {item.subcategory ? ` • ${item.subcategory}` : ""}
                            </div>
                            {item.open_note ? (
                              <div className="mt-0.5 line-clamp-2 text-[var(--ui-passive-text)]">
                                {item.open_note}
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {expressionResults.map((sample: any, idx: number) => {
                  const weighting = buildExpressionWeighting(sample, sourceMetadata);
                  const weightedPrimaryLabel = weighting.ranking.weighted_primary.label;
                  const matureExpressionLabel =
                    weightedPrimaryLabel && weightedPrimaryLabel !== "unavailable"
                      ? weightedPrimaryLabel
                      : sample.interpreted_expression?.label ||
                        sample.dominant_emotion ||
                        "Unknown";
                  const rawExpressionLabel =
                    sample.rawDominantEmotion || sample.dominant_emotion || "Unknown";
                  const correctionKey = `${sample.timestamp}-${sample.face_id ?? idx}`;
                  return (
                    <details
                      key={correctionKey}
                      className="group rounded border border-slate-800 bg-slate-950/20"
                  >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 marker:hidden">
                        <span
                          className={`min-w-0 truncate text-[11px] ${
                            sample.quality === "weak"
                              ? "text-[#b8b8b8]"
                              : "text-slate-200"
                          }`}
                        >
                          {matureExpressionLabel}
                        </span>
                        <span className="shrink-0 text-[10px] text-[var(--ui-passive-text)]">
                          {Number(sample.timestamp).toFixed(2)}s
                          {` · ${(weighting.ranking.margin_to_second * 100).toFixed(1)}% margin`}
                        </span>
                      </summary>
                      <div className="border-t border-slate-800 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openVideoAtTime(videoId, sample.timestamp)}
                            className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700/70 hover:text-slate-50"
                          >
                            Show in video
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenCorrectionKey((current) =>
                                current === correctionKey ? null : correctionKey,
                              );
                            }}
                            className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700/70 hover:text-slate-50"
                          >
                            Correct
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void dropExpressionDetection(sample);
                            }}
                            className="rounded bg-rose-900/40 px-1.5 py-0.5 text-[10px] text-rose-200 hover:bg-rose-800/55 hover:text-rose-50"
                          >
                            Drop
                          </button>
                        </div>

                      {openCorrectionKey === correctionKey ? (
                        <div
                          className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-800 bg-[#141414] p-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {EXPRESSION_CORRECTION_OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                void saveExpressionCorrection(
                                  sample.rawDominantEmotion ||
                                    sample.dominant_emotion ||
                                    "Unknown",
                                  option,
                                  sample.timestamp,
                                );
                              }}
                              className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-slate-200 transition hover:bg-slate-800/80"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {rawExpressionLabel &&
                        rawExpressionLabel !== matureExpressionLabel && (
                          <div className="mt-1 text-[10px] text-amber-300/90">
                            Raw label: {rawExpressionLabel}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void revertExpressionCorrection(sample);
                              }}
                              className="ml-2 rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700/70 hover:text-slate-50"
                            >
                              Revert
                            </button>
                          </div>
                        )}

                      {sample.interpreted_expression ? (
                        <div className="mt-1 text-[10px] text-slate-300">
                          Ontology label: {sample.interpreted_expression.label}
                          {sample.interpreted_expression.confidence
                            ? ` • ${sample.interpreted_expression.confidence}`
                            : ""}
                          {sample.interpreted_expression.near_neighbors?.length
                            ? ` • neighbors ${sample.interpreted_expression.near_neighbors.join(", ")}`
                            : ""}
                        </div>
                      ) : null}

                      <div className="mt-1 text-[10px] text-cyan-200/90">
                        Weighted reading: {weighting.ranking.weighted_primary.label}
                        {weighting.ranking.keep_runner_up_visible
                          ? ` • runner-up ${weighting.ranking.weighted_runner_up.label}`
                          : ""}
                        {` • margin ${(weighting.ranking.margin_to_second * 100).toFixed(1)}%`}
                      </div>

                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        Context:{" "}
                        {[
                          sourceMetadata?.user_annotations?.genre || "genre not set",
                          sourceMetadata?.user_annotations?.genre_subtype,
                          sourceMetadata?.user_annotations?.situational_genre,
                          sourceMetadata?.user_annotations?.situational_subtype,
                          sourceMetadata?.user_annotations?.privacy_axis,
                          sourceMetadata?.user_annotations?.expertise_axis,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>

                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        Applied weights: genre{" "}
                        {weighting.applied_weights.expression.media_genre_weight.toFixed(
                          2,
                        )}
                        {` • subtype ${weighting.applied_weights.expression.genre_subtype_weight.toFixed(2)}`}
                        {` • situation ${weighting.applied_weights.expression.situational_genre_weight.toFixed(2)}`}
                        {` • sub-situation ${weighting.applied_weights.expression.situational_subtype_weight.toFixed(2)}`}
                        {` • privacy ${weighting.applied_weights.expression.privacy_weight.toFixed(2)}`}
                        {` • expertise ${weighting.applied_weights.expression.expertise_weight.toFixed(2)}`}
                      </div>

                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        Base vs weighted:{" "}
                        {weighting.ranking.base_primary
                          ? `${weighting.ranking.base_primary.label} ${(weighting.ranking.base_primary.score * 100).toFixed(1)}%`
                          : "no base reading"}
                        {` -> ${weighting.ranking.weighted_primary.label} ${(weighting.ranking.weighted_primary.score * 100).toFixed(1)}%`}
                      </div>

                      <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                        {sample.error
                          ? `Error: ${sample.error}`
                          : sample.emotion
                            ? Object.entries(sample.emotion)
                                .sort((a: any, b: any) => Number(b[1]) - Number(a[1]))
                                .slice(0, 3)
                                .map(
                                  ([emotion, score]: any) =>
                                    `${emotion} ${(Number(score) * 100).toFixed(1)}%`,
                                )
                                .join(" • ")
                            : "No probability scores"}
                      </div>

                      {sample.face_signal ||
                      sample.expression_evidence ||
                      sample.affect_hints ? (
                        <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                          {sample.face_signal?.level
                            ? `Face signal: ${sample.face_signal.level}`
                            : null}
                          {sample.face_signal?.face_count_in_frame !== null &&
                          sample.face_signal?.face_count_in_frame !== undefined
                            ? ` • faces ${sample.face_signal.face_count_in_frame}`
                            : ""}
                          {sample.face_signal?.face_area_share !== null &&
                          sample.face_signal?.face_area_share !== undefined
                            ? ` • area ${(Number(sample.face_signal.face_area_share) * 100).toFixed(1)}%`
                            : ""}
                        </div>
                      ) : null}

                      {sample.expression_evidence || sample.affect_hints ? (
                        <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                          {sample.expression_evidence?.level
                            ? `Expression evidence: ${sample.expression_evidence.level}`
                            : null}
                          {sample.affect_hints?.valence
                            ? ` • valence ${sample.affect_hints.valence}`
                            : ""}
                          {sample.affect_hints?.activation
                            ? ` • activation ${sample.affect_hints.activation}`
                            : ""}
                          {sample.affect_hints?.confidence
                            ? ` • affect ${sample.affect_hints.confidence}`
                            : ""}
                        </div>
                      ) : null}

                      {sample.social_function_profile ||
                      sample.interpreted_expression?.social_function?.length ? (
                        <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                          {sample.interpreted_expression?.social_function?.length
                            ? `Social function: ${sample.interpreted_expression.social_function.join(", ")}`
                            : "Social function profile available"}
                        </div>
                      ) : null}

                      {!sample.error &&
                      (sample.top_emotion_score !== null ||
                        sample.score_margin !== null ||
                        sample.quality) ? (
                        <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                          {sample.quality ? `Signal: ${sample.quality}` : null}
                          {sample.top_emotion_score !== null &&
                          sample.top_emotion_score !== undefined
                            ? ` • top ${(Number(sample.top_emotion_score) * 100).toFixed(1)}%`
                            : ""}
                          {sample.score_margin !== null &&
                          sample.score_margin !== undefined
                            ? ` • margin ${(Number(sample.score_margin) * 100).toFixed(1)}%`
                            : ""}
                        </div>
                      ) : null}
                      </div>
                    </details>
                  );
                })}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
