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
  undoLastCorrectionSnapshot,
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
  const transcript = analysisData?.transcript ?? [];
  const audioProsody = analysisData?.audioProsody ?? [];
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
    const correctedValue = window.prompt("Correct transcript word/spelling:", rawValue);
    if (!correctedValue || correctedValue.trim() === rawValue.trim()) {
      return;
    }
    const nextCorrections = mergeCorrectionRule(
      analysisData?.annotationCorrections,
      buildCorrectionRule("text", rawValue, correctedValue.trim()),
    );
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setSelectedWord("");
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const saveTranscriptSpanCorrection = async (row: any) => {
    if (!videoId) {
      return;
    }
    const rawText = String(row?.rawText || row?.text || "").trim();
    if (!rawText) {
      return;
    }
    const correctedValue = window.prompt("Correct transcript span:", rawText);
    if (!correctedValue || correctedValue.trim() === rawText) {
      return;
    }
    const nextCorrections = mergeCorrectionRule(
      analysisData?.annotationCorrections,
      buildCorrectionRule("text", rawText, correctedValue.trim()),
    );
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setSelectedWord("");
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const dropTextCorrection = async (rawValue: string) => {
    if (!videoId || !rawValue) {
      return;
    }
    const confirmed = window.confirm(`Drop transcript word "${rawValue}" from surfaced views?`);
    if (!confirmed) {
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
          <div className="border-b border-[#0a0a0a] shrink-0">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#2a2a2a] transition-colors"
            >
              <span className="text-[#b8b8b8] text-[12px] font-medium">
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
                <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300 py-2">
                  No summary available
                </div>
              ) : (
                <div className="p-3 bg-slate-700/30 rounded-lg py-2">
                  <div className="text-sm text-slate-200">{summaryText}</div>
                </div>
              )}
            </div>
          )}

          {/* Speech to text */}
          {/* Scrollable list container: flexible height with vertical scrolling */}
          <div className="min-h-0 px-3 flex flex-col">
            <div className="text-sm font-semibold mb-2 shrink-0">
              Audio Prosody:
            </div>
            <div className={prosodySectionClass}>
              {audioProsody.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-700/20 text-slate-400 text-xs">
                  No prosody cues on channel yet.
                </div>
              ) : (
                audioProsody.slice(0, 8).map((cue: any) => (
                  <div
                    key={cue.cue_id || `${cue.start}-${cue.end}`}
                    className="p-3 bg-slate-700/20 rounded-lg cursor-pointer hover:bg-slate-700/35 transition-colors"
                    onClick={() => {
                      eventBus.emit("videoTimeLineChanged", cue.start);
                    }}
                  >
                    <div className="text-[11px] text-amber-300">
                      {cue.start}s ~ {cue.end}s
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
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
            <div className="text-sm font-semibold mb-2 shrink-0">
              {isAudioMode ? "Transcript Support:" : "Speech to Text:"}
            </div>
            {selectedWord ? (
              <div className="mb-2 shrink-0 rounded border border-slate-700 bg-slate-900/60 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-300">
                    Selected word: <span className="font-medium text-slate-100">{selectedWord}</span>
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
                      onClick={() => setSelectedWord("")}
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
                <div className="p-3 rounded-lg bg-slate-700/20 text-slate-300">
                  <div>No transcript on channel yet.</div>
                  {transcriptMissionNote && (
                    <div className="mt-2 text-xs text-slate-400">
                      {transcriptMissionNote}
                    </div>
                  )}
                </div>
              ) : (
                transcript.map((row: any) => (
                  <div
                    key={row.start}
                    className="p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50"
                    // Click to seek video to object timestamp
                    onClick={() => {
                      eventBus.emit("videoTimeLineChanged", row.start);
                      console.log("Seeking video to", row.start);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-cyan-300">
                        {row.start}s ~ {row.end}s
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void saveTranscriptSpanCorrection(row);
                        }}
                        className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700/70 hover:text-slate-50"
                        title="Correct this whole transcript span"
                      >
                        Correct span
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
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
                              if (cleanedWord) {
                                setSelectedWord(cleanedWord);
                              }
                            }}
                            className={`rounded px-1 py-0.5 text-sm hover:bg-slate-700/60 hover:text-slate-50 ${
                              isSelected
                                ? "bg-cyan-900/40 text-cyan-100"
                                : "text-slate-200"
                            }`}
                            title="Click to select this word for correction or drop."
                          >
                            {word}
                          </button>
                            );
                          })()
                        ))}
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
