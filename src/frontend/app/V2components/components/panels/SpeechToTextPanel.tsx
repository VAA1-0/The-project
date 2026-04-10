import React, { useState, useEffect } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

import { VideoService } from "@/lib/video-service";
import { getVideoBlob } from "@/lib/blob-store";
import {
  broadcastAnalysisCorrectionRefresh,
  buildDropCorrectionRule,
  canUndoCorrectionSnapshot,
  buildCorrectionRule,
  createEmptyCorrections,
  mergeCorrectionRule,
  pushCorrectionSnapshot,
  removeManualTranscriptEntry,
  undoLastCorrectionSnapshot,
  upsertManualTranscriptEntry,
} from "@/lib/annotation-corrections";

import {
  Download,
  Search,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatSpeechSeconds(value?: number | null): string {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe)) return "0s";
  const rounded = Math.abs(safe) >= 10 ? safe.toFixed(1) : safe.toFixed(2);
  return `${Number(rounded)}s`;
}

type TranscriptEditorDraft = {
  mode: "span" | "manual";
  source: "transcript" | "manual";
  targetId?: string;
  rawText?: string;
  start: string;
  end: string;
  text: string;
  status: "confirmed" | "unconfirmed";
  note: string;
};

export default function SpeechToTextPanel({
  videoId: initialVideoId = "",
  panelMode = "transcript",
}: {
  videoId?: string;
  panelMode?: "transcript" | "audio";
}) {
  const [videoId, setVideoId] = useState(initialVideoId);

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
  const [selectedWord, setSelectedWord] = useState<string>("");
  const [selectedWordDraft, setSelectedWordDraft] = useState<string>("");
  const [editorDraft, setEditorDraft] = useState<TranscriptEditorDraft | null>(null);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);

  // State for show/hide summary
  const [showSummary, setShowSummary] = useState(true);

  // Listen for video ID changes via event bus
  useEffect(() => {
    if (initialVideoId) {
      setVideoId(initialVideoId);
    }
  }, [initialVideoId]);

  useEffect(() => {
    const handler = (id: string) => {
      setVideoId(id);
    };
    const timeHandler = (time: number) => {
      setVideoTimeLine(Number(time) || 0);
    };
    const correctionHandler = (id: string) => {
      if (id === videoId) {
        setRefreshNonce((current) => current + 1);
      }
    };
    eventBus.on("videoIdChanged", handler);
    eventBus.on("videoTimeLineChanged", timeHandler);
    eventBus.on("analysisCorrectionsChanged", correctionHandler);

    return () => {
      eventBus.off("videoIdChanged", handler);
      eventBus.off("videoTimeLineChanged", timeHandler);
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
        let blob = await VideoService.getBlob(videoId);
        if (!blob) {
          blob = await getVideoBlob(videoId);
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
  const transcript = analysisData?.transcriptTimeline ?? analysisData?.transcript ?? [];
  const audioProsody = analysisData?.audioProsody ?? [];
  const transcriptQuality = analysisData?.metadata?.transcriptQuality;
  const transcriptMissionNote =
    metadata?.missionMessage ||
    analysisData?.metadata?.audioError ||
    analysisData?.metadata?.audioProsodyError ||
    analysisData?.metadata?.posError ||
    analysisData?.metadata?.quantError;

  /* Mock transcript data for demonstration */
  /*
  const transcript = [
    {
      start: 0.0,
      end: 2.04,
      text: "actually happening. We asked the BBC",
    },
    {
      start: 2.04,
      end: 3.84,
      text: "pilot editor Justin Rola who sent",
    },
    {
      start: 3.84,
      end: 5.28,
      text: "this report from Brazil.",
    },
    {
      start: 6.36,
      end: 8.32,
      text: "When the world faces a big challenge",
    },
    {
      start: 8.32,
      end: 10.12,
      text: "like climate change, you would hope",
    },
    {
      start: 10.12,
      end: 12.24,
      text: "that everyone would come together to",
    },
    {
      start: 12.24,
      end: 14.04,
      text: "help fix it, wouldn't you? And that is why",
    },
    {
      start: 14.04,
      end: 16.4,
      text: "each year countries come together at",
    },
    {
      start: 16.4,
      end: 18.88,
      text: "these COP conferences, these UN",
    },
    {
      start: 18.88,
      end: 21.96,
      text: "Climate Summit to talk about solutions.",
    },
    {
      start: 23.12,
      end: 25.84,
      text: "This one is being held in a city right",
    },
    {
      start: 25.84,
      end: 28.0,
      text: "on the edge of the Amazon jungle.",
    },
    {
      start: 28.12,
      end: 31.0,
      text: "Now the problem is even after 30 of these",
    },
    {
      start: 31.0,
      end: 33.08,
      text: "meetings, emissions of carbon dioxide,",
    },
    {
      start: 33.28,
      end: 35.8,
      text: "that is the main gas warming our planet",
    },
    {
      start: 35.8,
      end: 37.8,
      text: "up are still increasing.",
    },
    {
      start: 37.96,
      end: 40.4,
      text: "So it's easy to see why lots of people",
    },
    {
      start: 40.4,
      end: 42.96,
      text: "say these talks just aren't working.",
    },
    {
      start: 43.36,
      end: 45.48,
      text: "It all comes down to energy.",
    },
    {
      start: 45.8,
      end: 47.68,
      text: "We need energy for everything we do.",
    },
    {
      start: 47.68,
      end: 49.72,
      text: "You can't make anything or go anywhere",
    },
    {
      start: 49.72,
      end: 52.32,
      text: "without it. The problem is most of the",
    },
    {
      start: 52.32,
      end: 54.44,
      text: "energy we use comes from fossil fuels,",
    },
    {
      start: 54.44,
      end: 57.6,
      text: "things like petrol, diesel, gas and coal.",
    },
    {
      start: 57.8,
      end: 60.92,
      text: "Burning them creates carbon dioxide.",
    },
    {
      start: 62.04,
      end: 64.08,
      text: "Now countries want to get rich up.",
    },
    {
      start: 64.08,
      end: 65.84,
      text: "They want to grow their economies and",
    },
    {
      start: 65.84,
      end: 68.04,
      text: "part of that means making and selling",
    },
    {
      start: 68.04,
      end: 70.04,
      text: "things. But because we rely so much",
    },
    {
      start: 70.04,
      end: 73.2,
      text: "on fossil fuels, that means more emissions.",
    },
    {
      start: 73.72,
      end: 74.6,
      text: "Let's take a look inside.",
    },
    {
      start: 77.92,
      end: 81.08,
      text: "Now this is the main hall and it is huge.",
    },
    {
      start: 81.08,
      end: 83.84,
      text: "It's more than half a mile long and they",
    },
    {
      start: 83.84,
      end: 86.04,
      text: "are still finishing putting it together.",
    },
    {
      start: 86.36,
      end: 89.72,
      text: "Now to reduce emissions, we need to switch",
    },
    {
      start: 89.72,
      end: 92.2,
      text: "to cleaner energy sources, things like",
    },
    {
      start: 92.2,
      end: 94.08,
      text: "solar, wind and nuclear and that is",
    },
    {
      start: 94.08,
      end: 95.12,
      text: "beginning to happen.",
    },
    {
      start: 95.28,
      end: 97.4,
      text: "But getting the whole world to change",
    },
    {
      start: 97.4,
      end: 99.48,
      text: "the way it does things is a big task",
    },
    {
      start: 99.64,
      end: 101.52,
      text: "and it is expensive.",
    },
    {
      start: 101.68,
      end: 104.4,
      text: "And when money's involved, it's very hard",
    },
    {
      start: 104.52,
      end: 106.0,
      text: "to get people to agree.",
    },
    {
      start: 106.12,
      end: 107.84,
      text: "Poor countries say to rich countries,",
    },
    {
      start: 107.84,
      end: 110.56,
      text: "you need to pay for us to get clean energy",
    },
    {
      start: 110.64,
      end: 113.52,
      text: "because you got rich burning fossil fuels.",
    },
    {
      start: 113.68,
      end: 115.44,
      text: "Rich countries often say, well, listen,",
    },
    {
      start: 115.56,
      end: 117.48,
      text: "we've got our own problems to worry about.",
    },
    {
      start: 117.6,
      end: 119.88,
      text: "And when one country says it's not going",
    },
    {
      start: 119.88,
      end: 123.24,
      text: "to help out, other countries say, well,",
    },
    {
      start: 123.24,
      end: 124.0,
      text: "why should I?",
    },
    {
      start: 125.44,
      end: 127.8,
      text: "The hope is that clean energy will become",
    },
    {
      start: 127.8,
      end: 129.56,
      text: "the cheapest option and that is beginning",
    },
    {
      start: 129.56,
      end: 132.0,
      text: "to happen. But switching takes time.",
    },
    {
      start: 132.2,
      end: 134.28,
      text: "The aim of getting people to meet things",
    },
    {
      start: 134.28,
      end: 136.12,
      text: "like this is to speed things up.",
    },
    {
      start: 136.16,
      end: 138.4,
      text: "But countries can only make promises and in",
    },
    {
      start: 138.4,
      end: 140.76,
      text: "reality, they often find changes more",
    },
    {
      start: 140.76,
      end: 141.88,
      text: "difficult than they thought.",
    },
    {
      start: 141.88,
      end: 144.64,
      text: "Still climate change affects everything",
    },
    {
      start: 144.64,
      end: 145.96,
      text: "and everyone on earth.",
    },
    {
      start: 146.16,
      end: 148.2,
      text: "So getting everyone together in room.",
    },
  ];
  */

  const summaryText = analysisData?.summary ?? "…";
  const isAudioMode = panelMode === "audio";
  const prosodySectionClass = isAudioMode
    ? "shrink min-h-[220px] max-h-[58%] overflow-y-auto space-y-2 pr-2 mb-4"
    : "shrink-0 max-h-40 overflow-y-auto space-y-2 pr-2 mb-4";
  const transcriptSectionClass = isAudioMode
    ? "min-h-[140px] max-h-[34%] overflow-y-auto space-y-2 pr-2"
    : "flex-1 overflow-y-auto space-y-2 pr-2";

  const saveTextCorrection = async (rawValue: string) => {
    if (!videoId || !rawValue) {
      return;
    }
    const correctedValue = selectedWordDraft.trim() || "Unconfirmed";
    const nextCorrections = mergeCorrectionRule(
      analysisData?.annotationCorrections,
      buildCorrectionRule("text", rawValue, correctedValue.trim()),
    );
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setSelectedWord("");
    setSelectedWordDraft("");
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const openTranscriptSpanEditor = (row: any) => {
    setEditorMessage(null);
    setEditorDraft({
      mode: "span",
      source: row?.correctionSource === "manual" ? "manual" : "transcript",
      targetId: row?.targetId,
      rawText: String(row?.rawText || row?.text || "").trim(),
      start: String(Number(row?.start ?? 0)),
      end: String(Number(row?.end ?? row?.start ?? 0)),
      text:
        String(row?.rawText || row?.text || "").trim() === "Unconfirmed"
          ? ""
          : String(row?.rawText || row?.text || "").trim(),
      status: row?.status === "unconfirmed" ? "unconfirmed" : "confirmed",
      note: "",
    });
  };

  const openManualTranscriptEditor = () => {
    const baseStart = Math.max(0, Number(videoTimeLine || 0));
    const baseEnd = Number((baseStart + 2).toFixed(2));
    setEditorMessage(null);
    setEditorDraft({
      mode: "manual",
      source: "manual",
      start: String(Number(baseStart.toFixed(2))),
      end: String(baseEnd),
      text: "",
      status: "unconfirmed",
      note: "",
    });
  };

  const saveTranscriptEditor = async () => {
    if (!videoId || !editorDraft) {
      return;
    }
    const start = Number(editorDraft.start);
    const end = Number(editorDraft.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      setEditorMessage("Check the start and end timestamps.");
      return;
    }
    const normalizedText = editorDraft.text.trim() || "Unconfirmed";
    const normalizedStatus =
      editorDraft.status === "unconfirmed" || normalizedText === "Unconfirmed"
        ? "unconfirmed"
        : "confirmed";

    let nextCorrections = analysisData?.annotationCorrections;
    if (editorDraft.source === "manual") {
      const entryId =
        editorDraft.targetId || `manual:${start.toFixed(2)}:${end.toFixed(2)}`;
      nextCorrections = upsertManualTranscriptEntry(nextCorrections, {
        id: entryId,
        start,
        end,
        text: normalizedStatus === "unconfirmed" ? "" : normalizedText,
        status: normalizedStatus,
        note: editorDraft.note.trim(),
        updated_at: new Date().toISOString(),
        updated_by: "analyst",
      });
    } else {
      const rawText = String(editorDraft.rawText || "").trim() || "Unconfirmed";
      nextCorrections = mergeCorrectionRule(
        nextCorrections,
        buildCorrectionRule("text", rawText, normalizedText, editorDraft.note.trim(), {
          targetStartTimestamp: start,
          targetEndTimestamp: end,
        }),
      );
    }
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setSelectedWord("");
    setSelectedWordDraft("");
    setEditorDraft(null);
    setEditorMessage(null);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const removeTranscriptEditorEntry = async () => {
    if (!videoId || !editorDraft || editorDraft.source !== "manual" || !editorDraft.targetId) {
      return;
    }
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    const nextCorrections = removeManualTranscriptEntry(
      analysisData?.annotationCorrections,
      editorDraft.targetId,
    );
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setSelectedWord("");
    setSelectedWordDraft("");
    setEditorDraft(null);
    setEditorMessage(null);
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const dropTextCorrection = async (rawValue: string) => {
    if (!videoId || !rawValue) {
      return;
    }
    const nextCorrections = mergeCorrectionRule(
      analysisData?.annotationCorrections,
      buildDropCorrectionRule("text", rawValue),
    );
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setSelectedWord("");
    setSelectedWordDraft("");
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
    setSelectedWord("");
    setSelectedWordDraft("");
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const canUndo = canUndoCorrectionSnapshot(videoId);

  return (
    <TooltipProvider delayDuration={200}>
      <main className="h-full flex flex-col overflow-hidden">
        <div className="text-xs text-slate-400 px-3 py-2 shrink-0 flex items-center justify-between gap-3">
          <span>video Id: {videoId}</span>
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
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* SUMMARY */}
          <div className="border-b border-white/8 shrink-0">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="w-full px-3 py-2 flex items-center justify-between rounded px-1 hover:bg-white/5 transition-colors"
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                Summary
              </span>
              {showSummary ? (
                <ChevronDown className="size-3.5 text-[#b8b8b8]" />
              ) : (
                <ChevronRight className="size-3.5 text-[#b8b8b8]" />
              )}
            </button>
          </div>
          {showSummary && (
            <div className="flex-1 min-h-20 overflow-y-auto space-y-2 px-3 py-2">
              {summaryText.length === 0 ? (
                <div className="rounded border border-white/8 bg-[#171717] px-3 py-3 text-slate-300">
                  No summary available
                </div>
              ) : (
                <div className="rounded border border-white/8 bg-[#151515] px-3 py-3">
                  <div className="text-sm text-slate-200">{summaryText}</div>
                </div>
              )}
            </div>
          )}

          {/* Speech to text */}
          {/* Scrollable list container: flexible height with vertical scrolling */}
          <div className="min-h-0 px-3 flex flex-col">
            <div className="mb-3 shrink-0 rounded border border-white/8 bg-[#151515] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    Transcript governance
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    Keep transcript corrections, unresolved marks, and manual timestamp entries inside this panel.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openManualTranscriptEditor}
                  className="rounded border border-white/10 bg-[#101010] px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/40 hover:text-slate-50"
                >
                  Add marker
                </button>
              </div>
              {editorDraft ? (
                <div className="mt-3 rounded border border-white/8 bg-[#111111] px-3 py-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        {editorDraft.mode === "manual" ? "New transcript marker" : "Transcript span editor"}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        Empty transcript text is surfaced as <span className="text-amber-200">Unconfirmed</span>.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditorDraft(null);
                        setEditorMessage(null);
                      }}
                      className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[11px] text-slate-400">
                      <div className="mb-1 uppercase tracking-[0.14em]">Start</div>
                      <input
                        value={editorDraft.start}
                        onChange={(event) =>
                          setEditorDraft((current) =>
                            current ? { ...current, start: event.target.value } : current,
                          )
                        }
                        className="w-full rounded border border-white/10 bg-[#171717] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                      />
                    </label>
                    <label className="text-[11px] text-slate-400">
                      <div className="mb-1 uppercase tracking-[0.14em]">End</div>
                      <input
                        value={editorDraft.end}
                        onChange={(event) =>
                          setEditorDraft((current) =>
                            current ? { ...current, end: event.target.value } : current,
                          )
                        }
                        className="w-full rounded border border-white/10 bg-[#171717] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                      />
                    </label>
                  </div>
                  <label className="mt-3 block text-[11px] text-slate-400">
                    <div className="mb-1 uppercase tracking-[0.14em]">Transcript text</div>
                    <textarea
                      value={editorDraft.text}
                      onChange={(event) =>
                        setEditorDraft((current) =>
                          current ? { ...current, text: event.target.value } : current,
                        )
                      }
                      placeholder="Leave blank to mark as Unconfirmed"
                      className="min-h-[84px] w-full rounded border border-white/10 bg-[#171717] px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-[11px] text-slate-400">
                      <div className="mb-1 uppercase tracking-[0.14em]">Status</div>
                      <select
                        value={editorDraft.status}
                        onChange={(event) =>
                          setEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  status: event.target.value as "confirmed" | "unconfirmed",
                                }
                              : current,
                          )
                        }
                        className="w-full rounded border border-white/10 bg-[#171717] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="unconfirmed">Unconfirmed</option>
                      </select>
                    </label>
                    <label className="text-[11px] text-slate-400">
                      <div className="mb-1 uppercase tracking-[0.14em]">Note</div>
                      <input
                        value={editorDraft.note}
                        onChange={(event) =>
                          setEditorDraft((current) =>
                            current ? { ...current, note: event.target.value } : current,
                          )
                        }
                        placeholder="Optional analyst note"
                        className="w-full rounded border border-white/10 bg-[#171717] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                      />
                    </label>
                  </div>
                  {editorMessage ? (
                    <div className="mt-3 text-xs text-amber-200">{editorMessage}</div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500">
                      Manual markers are stored with timestamps and reloaded with the analysis corrections.
                    </div>
                    <div className="flex items-center gap-2">
                      {editorDraft.source === "manual" && editorDraft.targetId ? (
                        <button
                          type="button"
                          onClick={() => {
                            void removeTranscriptEditorEntry();
                          }}
                          className="rounded border border-rose-500/30 bg-rose-950/10 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-900/20"
                        >
                          Remove marker
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          void saveTranscriptEditor();
                        }}
                        className="rounded border border-white/10 bg-[#101010] px-2.5 py-1.5 text-[11px] text-slate-100 hover:bg-slate-800/40"
                      >
                        Save in panel
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mb-2 shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Audio prosody
            </div>
            <div className={prosodySectionClass}>
              {audioProsody.length === 0 ? (
                <div className="rounded border border-white/8 bg-[#171717] px-3 py-3 text-xs text-slate-400">
                  No prosody cues on channel yet.
                </div>
              ) : (
                audioProsody.slice(0, 8).map((cue: any) => (
                  <div
                    key={cue.cue_id || `${cue.start}-${cue.end}`}
                    className="cursor-pointer rounded border border-white/8 bg-[#171717] px-3 py-3 transition-colors hover:bg-slate-800/25"
                    onClick={() => {
                      eventBus.emit("videoTimeLineChanged", cue.start);
                    }}
                  >
                    <div className="text-[11px] text-slate-300">
                      {formatSpeechSeconds(cue.start)} ~ {formatSpeechSeconds(cue.end)}
                    </div>
                    <div className="mt-2 text-xs text-slate-300">
                      Pace: {cue.pace?.label || "n/a"}
                      {typeof cue.pace?.words_per_second === "number"
                        ? ` • ${cue.pace.words_per_second.toFixed(2)} w/s`
                        : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      Pause: {cue.pauses?.before_label || "n/a"} before
                      {typeof cue.pauses?.before_seconds === "number"
                        ? ` (${cue.pauses.before_seconds.toFixed(2)}s)`
                        : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      Turn: {cue.turn_structure?.transition || "n/a"}
                      {cue.turn_structure?.likely_turn_boundary
                        ? " • likely boundary"
                        : ""}
                      {cue.turn_structure?.overlap_cue
                        ? ` • overlap ${cue.turn_structure.overlap_seconds?.toFixed(2)}s`
                        : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      Role support: {cue.interaction_cues?.role_support || "n/a"}
                      {typeof cue.interaction_cues?.run_length === "number"
                        ? ` • run ${cue.interaction_cues.run_position || 1}/${cue.interaction_cues.run_length}`
                        : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      Rhythm: {cue.rhythm_profile?.label || "n/a"}
                    </div>
                    <div className="text-xs text-slate-400">
                      Tonality: {cue.tonality_profile?.label || "n/a"}
                    </div>
                    <div className="text-xs text-slate-400">
                      Environment: {cue.sound_environment?.label || "n/a"}
                    </div>
                    <div className="text-xs text-slate-400">
                      Emphasis: {cue.emphasis?.label || "n/a"}
                      {typeof cue.emphasis?.score === "number"
                        ? ` • ${Math.round(cue.emphasis.score * 100)}%`
                        : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      Contour: {cue.pitch_energy_contour?.label || "n/a"}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mb-2 shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              {isAudioMode ? "Transcript Support:" : "Speech to Text:"}
            </div>
            {selectedWord ? (
              <div className="mb-2 shrink-0 rounded border border-white/8 bg-[#171717] px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Selected word
                    </div>
                    <div className="mt-1 text-xs text-slate-300">
                      Raw token: <span className="font-medium text-slate-100">{selectedWord}</span>
                    </div>
                    <input
                      value={selectedWordDraft}
                      onChange={(event) => setSelectedWordDraft(event.target.value)}
                      placeholder="Correction inside panel, or leave blank for Unconfirmed"
                      className="mt-2 w-full rounded border border-white/10 bg-[#121212] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void saveTextCorrection(selectedWord);
                      }}
                      className="rounded bg-slate-800/70 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700/80 hover:text-slate-50"
                    >
                      Correct
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void dropTextCorrection(selectedWord);
                      }}
                      className="rounded bg-rose-900/40 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-800/55 hover:text-rose-50"
                    >
                      Drop
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWord("");
                        setSelectedWordDraft("");
                      }}
                      className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={transcriptSectionClass}>
              {transcript.length === 0 ? (
                <div className="rounded border border-white/8 bg-[#171717] px-3 py-3 text-slate-300">
                  <div>No transcript on channel yet.</div>
                  {transcriptMissionNote && (
                    <div className="mt-2 text-xs text-slate-400">
                      {transcriptMissionNote}
                    </div>
                  )}
                </div>
              ) : (
                transcript.map((row: any) => {
                  const isSynthetic = Boolean(row.synthetic);
                  const segmentLabel =
                    row.segmentType === "manual_entry"
                      ? "Manual marker"
                      : row.segmentType === "unresolved_tail"
                        ? "Unresolved tail"
                        : row.segmentType === "unresolved_interval"
                          ? "Unresolved interval"
                          : "Transcript span";
                  return (
                  <div
                    key={`${row.targetId || row.start}-${row.end}-${row.segmentType || "utterance"}`}
                    className={`rounded border px-3 py-3 transition-colors ${
                      isSynthetic
                        ? "border-amber-500/20 bg-amber-950/10 text-slate-300"
                        : "cursor-pointer border-white/8 bg-[#171717] hover:bg-slate-800/25"
                    }`}
                    onClick={() => {
                      eventBus.emit("videoTimeLineChanged", row.start);
                      console.log("Seeking video to", row.start);
                    }}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="space-y-1 text-[11px] text-slate-400">
                        <div className={isSynthetic ? "text-amber-200/80" : "text-slate-500"}>
                          {segmentLabel}
                        </div>
                        <div className="text-slate-200">
                          {formatSpeechSeconds(row.start)} ~ {formatSpeechSeconds(row.end)}
                        </div>
                        <div>
                          duration {formatSpeechSeconds(Number(row.end ?? 0) - Number(row.start ?? 0))}
                        </div>
                      </div>
                      {isSynthetic ? (
                        <div className="rounded border border-amber-500/20 bg-amber-950/10 px-2 py-1 text-[10px] text-amber-100/80">
                          Coverage marker
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="rounded border border-white/8 bg-[#121212] px-2 py-1 text-[10px] text-slate-400">
                            {row.status === "unconfirmed" ? "Unconfirmed" : "Confirmed"}
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openTranscriptSpanEditor(row);
                            }}
                            className="rounded border border-white/8 bg-[#121212] px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800/40 hover:text-slate-50"
                            title="Edit this transcript span inside the panel"
                          >
                            Edit span
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      className={`border-l-2 pl-3 text-[13px] leading-6 ${
                        isSynthetic
                          ? "border-amber-500/20 text-slate-300"
                          : "border-slate-700 text-slate-200"
                      }`}
                    >
                      {String(row.text || "")
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((word: string, index: number) => (
                          (() => {
                            const cleanedWord = word.replace(
                              /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
                              "",
                            );
                            const isSelected = cleanedWord && cleanedWord === selectedWord;
                            return (
                          <button
                            key={`${row.start}-${word}-${index}`}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!isSynthetic && cleanedWord) {
                                setSelectedWord(cleanedWord);
                                setSelectedWordDraft(cleanedWord);
                              }
                            }}
                            disabled={isSynthetic}
                            className={`mr-1 inline rounded px-0.5 py-0 text-[13px] leading-6 ${
                              isSynthetic
                                ? "cursor-default text-slate-300"
                                : "hover:bg-slate-700/35 hover:text-slate-50"
                            } ${
                              isSelected
                                ? "bg-cyan-900/40 text-cyan-100"
                                : "text-slate-200"
                            }`}
                            title={
                              isSynthetic
                                ? "Synthetic coverage marker"
                                : "Click to select this word for correction or drop."
                            }
                          >
                            {word}
                          </button>
                            );
                          })()
                        ))}
                    </div>
                  </div>
                );
                })
              )}
            </div>
            {transcriptQuality?.status === "degraded" ? (
              <div className="mt-3 rounded border border-amber-500/20 bg-amber-950/10 px-3 py-2 text-[11px] text-amber-100/85">
                Transcript coverage is flagged for review. Last decoded speech ends at{" "}
                {formatSpeechSeconds(transcriptQuality.last_segment_end_seconds)} with about{" "}
                {formatSpeechSeconds(transcriptQuality.trailing_uncovered_seconds)} still uncovered.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
