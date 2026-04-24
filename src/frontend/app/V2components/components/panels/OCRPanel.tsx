import React, { useState, useEffect, useMemo } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { VideoService, type OCR } from "@/lib/video-service";
import { getVideoBlob, saveVideoBlob } from "@/lib/blob-store";
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

function normalizeOCRText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatPanelTime(value?: number | null): string {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe)) return "0:00.000";
  const clamped = Math.max(0, safe);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

function looksLikeUsefulOCR(text: string, confidence: number): boolean {
  const cleaned = normalizeOCRText(text);
  if (!cleaned || confidence < 0.55) {
    return false;
  }

  const alphaNum = cleaned.replace(/[^0-9A-Za-zÀ-ÿ]/g, "");
  if (alphaNum.length < 3) {
    return false;
  }

  const alphaNumRatio = alphaNum.length / Math.max(cleaned.length, 1);
  if (alphaNumRatio < 0.55) {
    return false;
  }

  if (/^(.)\1{2,}$/i.test(alphaNum)) {
    return false;
  }

  return true;
}

function normalizeOCRComparisonKey(value: string): string {
  return normalizeOCRText(value)
    .toUpperCase()
    .replace(/[|!]/g, "I")
    .replace(/[0O]/g, "O")
    .replace(/[5S]/g, "S")
    .replace(/[8B]/g, "B")
    .replace(/[2Z]/g, "Z")
    .replace(/[^0-9A-ZÀ-Ÿ]/g, "");
}

function editDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[left.length][right.length];
}

function regionBucket(bbox?: OCR["bbox"]): string {
  if (!bbox) {
    return "unknown";
  }
  const x = bbox.x ?? 0;
  const y = bbox.y ?? 0;
  if (y <= 180) {
    return x <= 320 ? "top_left" : x >= 1200 ? "top_right" : "top_mid";
  }
  if (y >= 760) {
    return x <= 320 ? "bottom_left" : x >= 1200 ? "bottom_right" : "bottom_mid";
  }
  return x <= 640 ? "mid_left" : x >= 1280 ? "mid_right" : "mid_center";
}

function stringsBelongTogether(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }
  const distance = editDistance(left, right);
  const maxLength = Math.max(left.length, right.length);
  if (maxLength <= 5) {
    return distance <= 1;
  }
  if (maxLength <= 10) {
    return distance <= 2;
  }
  return distance <= 3;
}

function preferredCanonicalText(values: Array<{ text: string; confidence: number; count: number }>): string {
  const ranked = [...values].sort((left, right) => {
    const leftClean = normalizeOCRText(left.text);
    const rightClean = normalizeOCRText(right.text);
    const leftAlpha = leftClean.replace(/[^0-9A-Za-zÀ-ÿ]/g, "").length / Math.max(leftClean.length, 1);
    const rightAlpha = rightClean.replace(/[^0-9A-Za-zÀ-ÿ]/g, "").length / Math.max(rightClean.length, 1);
    const leftScore = left.count * 2 + left.confidence + leftAlpha;
    const rightScore = right.count * 2 + right.confidence + rightAlpha;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return rightClean.length - leftClean.length;
  });
  return ranked[0]?.text || "";
}

function buildDisplayedOCRResults(results: Array<OCR>) {
  const sorted = [...results].sort((left, right) => {
    if ((right.confidence || 0) !== (left.confidence || 0)) {
      return (right.confidence || 0) - (left.confidence || 0);
    }
    return (left.timestamp || 0) - (right.timestamp || 0);
  });

  const grouped: Array<{
    canonicalKey: string;
    region: string;
    text: string;
    confidence: number;
    timestamp: number;
    count: number;
    variants: Array<{ text: string; confidence: number; count: number }>;
  }> = [];

  for (const item of sorted) {
    const text = normalizeOCRText(String(item?.text || ""));
    const confidence = Number(item?.confidence || 0);
    if (!looksLikeUsefulOCR(text, confidence)) {
      continue;
    }

    const comparisonKey = normalizeOCRComparisonKey(text);
    const region = regionBucket(item?.bbox);
    const existing = grouped.find(
      (entry) =>
        entry.region === region &&
        stringsBelongTogether(entry.canonicalKey, comparisonKey),
    );

    if (!existing) {
      grouped.push({
        canonicalKey: comparisonKey,
        region,
        text,
        confidence,
        timestamp: Number(item?.timestamp || 0),
        count: 1,
        variants: [{ text, confidence, count: 1 }],
      });
      continue;
    }

    existing.count += 1;
    const variant = existing.variants.find(
      (entry) => normalizeOCRText(entry.text).toLowerCase() === text.toLowerCase(),
    );
    if (variant) {
      variant.count += 1;
      variant.confidence = Math.max(variant.confidence, confidence);
    } else {
      existing.variants.push({ text, confidence, count: 1 });
    }
    if (confidence > existing.confidence) {
      existing.confidence = confidence;
      existing.timestamp = Number(item?.timestamp || existing.timestamp || 0);
    } else if (Number(item?.timestamp || Infinity) < existing.timestamp) {
      existing.timestamp = Number(item?.timestamp || existing.timestamp || 0);
    }
    existing.text = preferredCanonicalText(existing.variants);
  }

  return grouped.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return left.timestamp - right.timestamp;
  });
}

export default function OCRPanel() {
  const [videoId, setVideoId] = useState("");

  // Event bus video time line state
  const [videoTimeLine, setVideoTimeLine] = useState<number>(0);

  const lastObjectUrl = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [blobMissing, setBlobMissing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

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
          if (blob) {
            await saveVideoBlob(videoId, blob);
          }
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

  const ocrResults = analysisData?.ocr ?? [];
  const manualOCRAnnotations =
    analysisData?.manualAnnotationsByCategory?.OCR || [];
  const displayedOCRResults = useMemo(
    () => buildDisplayedOCRResults(ocrResults),
    [ocrResults],
  );

  const saveOCRCorrection = async (rawValue: string) => {
    if (!videoId || !rawValue) {
      return;
    }
    const correctedValue = window.prompt("Correct OCR reading:", rawValue);
    if (!correctedValue || correctedValue.trim() === rawValue.trim()) {
      return;
    }
    const nextCorrections = mergeCorrectionRule(
      analysisData?.annotationCorrections,
      buildCorrectionRule("ocr", rawValue, correctedValue.trim()),
    );
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const dropOCRDetection = async (obj: any) => {
    if (!videoId || !obj?.text) {
      return;
    }
    const nextCorrections = mergeCorrectionRule(
      analysisData?.annotationCorrections,
      buildDropCorrectionRule("ocr", obj.text, {
        targetTimestamp: obj.timestamp,
      }),
    );
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const revertOCRCorrection = async (obj: any) => {
    if (!videoId || !obj?.text) {
      return;
    }
    const scopedRuleId = buildDropCorrectionRule("ocr", obj.text, {
      targetTimestamp: obj.timestamp,
    }).id;
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

  return (
    <TooltipProvider delayDuration={200}>
      <main className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-[#1a1a1a] px-3 py-2 border-b border-[#0a0a0a] flex items-center justify-between shrink-0">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
              OCR
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
                  <p>Search transcript</p>
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
            <div className="mb-2 shrink-0 flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
                OCR results
              </div>
              <div className="text-[10px] text-[var(--ui-passive-text)]">
                {displayedOCRResults.length} surfaced / {ocrResults.length} raw
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2">
              {manualOCRAnnotations.length > 0 && (
                <div className="mb-2 rounded border border-amber-400/20 bg-amber-400/5 px-3 py-2">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-amber-100/80">
                    Manual OCR annotations
                  </div>
                  <div className="space-y-1">
                    {manualOCRAnnotations.map((item: any) => (
                      <button
                        key={item.id}
                        type="button"
                        className="block w-full rounded border border-slate-800 bg-slate-950/20 px-2 py-1 text-left text-[10px] text-slate-200 hover:bg-slate-900/35"
                        onClick={() => {
                          openManualAnnotationInVideo(videoId, item);
                        }}
                      >
                        <div className="font-medium">
                          {item.label || item.custom_label || "Manual OCR annotation"}
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
              {displayedOCRResults.length === 0 ? (
                <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
                  No OCR Results
                </div>
              ) : (
                displayedOCRResults.map((obj: any, idx: number) => (
                  <div
                    key={`${obj.text}-${idx}`}
                    className="cursor-pointer rounded border border-slate-800 bg-slate-950/20 px-3 py-2 transition hover:bg-slate-900/35"
                    onClick={() => {
                      openVideoAtTime(videoId, obj.timestamp);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="line-clamp-2 text-[11px] text-slate-200">
                        {obj.text}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void saveOCRCorrection(obj.text);
                          }}
                          className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700/70 hover:text-slate-50"
                        >
                          Correct
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void dropOCRDetection(obj);
                          }}
                          className="rounded bg-rose-900/40 px-1.5 py-0.5 text-[10px] text-rose-200 hover:bg-rose-800/55 hover:text-rose-50"
                        >
                          Drop
                        </button>
                        <span className="text-[10px] text-[var(--ui-passive-text)]">
                          {(obj.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                      Seen {obj.timestamp.toFixed(2)}s
                      {obj.count > 1 ? ` • ${obj.count} hits` : ""}
                    </div>
                    {obj.variants?.length > 1 && (
                      <div className="mt-1 line-clamp-2 text-[10px] text-[var(--ui-passive-text)]">
                        Variants:{" "}
                        {obj.variants
                          .sort(
                            (left: any, right: any) =>
                              right.count - left.count ||
                              right.confidence - left.confidence,
                          )
                          .slice(0, 4)
                          .map((entry: any) => entry.text)
                          .join(" • ")}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-[var(--ui-passive-text)]">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void revertOCRCorrection(obj);
                        }}
                        className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700/70 hover:text-slate-50"
                      >
                        Revert
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
