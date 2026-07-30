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
  setTranscriptClockOffset,
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
import { openManualAnnotationInVideo, openVideoAtTime } from "@/lib/video-navigation";
import { normalizeTranscriptSegmentTiming } from "@/lib/transcript-time";
import { governedNarrativeAgentLabels } from "@/lib/narrative-agent-registry";

const TRANSCRIPT_SOURCE_SPEAKERS = [
  "Announcer",
  "Voice-over narration",
  "Background noise",
  "Crowd",
] as const;

function formatSpeechSeconds(value?: number | null): string {
  const safe = Number(value);
  if (!Number.isFinite(safe)) return "0:00.000";
  const clamped = Math.max(0, safe);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

const VERIFIED_TRANSCRIPT_REPAIR_STATUSES = new Set(["manual_correction", "original_whisper_timecode"]);
const NON_AUTHORITATIVE_TRANSCRIPT_TIMING_STATUSES = new Set([
  "automatic_transcript_timestamp",
  "inherited_after_vad_anchor",
  "needs_per_line_sync",
]);
const NON_AUTHORITATIVE_TRANSCRIPT_TIMING_AUTHORITIES = new Set([
  "quick_sweep_transcript",
  "quick_sweep_transcript_priority",
  "chunked_fallback",
  "tail_recovery_fallback",
  "fallback_candidate",
  "scaffold",
  "text_only_no_source_timing",
]);

function rowHasTimingAuthority(row: any): boolean {
  const timingStatus = String(row?.timingStatus || row?.timing_status || "").trim();
  const timingAuthority = String(row?.timingAuthority || row?.timing_authority || "").trim();
  const sourceTimeValid = row?.sourceTimeValid ?? row?.source_time_valid;
  if (
    NON_AUTHORITATIVE_TRANSCRIPT_TIMING_STATUSES.has(timingStatus) ||
    NON_AUTHORITATIVE_TRANSCRIPT_TIMING_AUTHORITIES.has(timingAuthority)
  ) {
    return false;
  }
  if (timingAuthority === "manual_correction") {
    return sourceTimeValid !== false || timingStatus === "manual_correction";
  }
  return (
    timingAuthority === "original_whisper_timecode" ||
    timingAuthority === "full_pass" ||
    VERIFIED_TRANSCRIPT_REPAIR_STATUSES.has(timingStatus) ||
    [
      "manual_correction",
      "original_whisper_timecode",
    ].includes(timingStatus)
  );
}

function rowHasCandidateOnlyTiming(row: any): boolean {
  const timingStatus = String(row?.timingStatus || row?.timing_status || "").trim();
  const timingAuthority = String(row?.timingAuthority || row?.timing_authority || "").trim();
  const timingSource = String(row?.timingSource || row?.timing_source || "").trim();
  const sourceTimeValid = row?.sourceTimeValid ?? row?.source_time_valid;
  return (
    sourceTimeValid === false ||
    NON_AUTHORITATIVE_TRANSCRIPT_TIMING_STATUSES.has(timingStatus) ||
    NON_AUTHORITATIVE_TRANSCRIPT_TIMING_AUTHORITIES.has(timingAuthority) ||
    /chunked|fallback|scaffold|quick_sweep/i.test(timingSource)
  );
}

function transcriptPayloadDeclaresOperationalWhisperClock(payload: any): boolean {
  const timingAuthority = payload?.timing_authority || payload?.timingAuthority || {};
  const operationalAuthority = String(
    timingAuthority?.operational_authority || timingAuthority?.operationalAuthority || "",
  );
  return (
    operationalAuthority === "original_whisper_timecode" ||
    operationalAuthority === "manual_correction" ||
    operationalAuthority === "manual_correction_for_verified_rows"
  );
}

function transcriptRowsLookLikeScaffold(rows: any[] = []): boolean {
  const utterances = rows.filter((row) => {
    const text = String(row?.text || "").trim();
    return (
      text &&
      !text.startsWith("[Unresolved") &&
      row?.segmentType !== "unresolved_interval" &&
      row?.segment_type !== "unresolved_interval"
    );
  });
  if (utterances.some(rowHasTimingAuthority) || utterances.length < 4) {
    return false;
  }
  return utterances.slice(0, 4).every((row, index) => {
    const start = Number(row?.start ?? row?.start_seconds ?? 0);
    return Number.isFinite(start) && Math.abs(start - index * 2) <= 0.01;
  });
}

function transcriptPayloadHasTimingAuthority(payload: any): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (transcriptPayloadDeclaresOperationalWhisperClock(payload)) {
    return true;
  }
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  return segments.some(rowHasTimingAuthority);
}

function normalizeTranscriptPayloadRows(rows: any[] = []) {
  return rows.map((row) => {
    const timing = normalizeTranscriptSegmentTiming(row || {});
    const hasSourceTiming = rowHasTimingAuthority(row);
    const candidateOnlyTiming = rowHasCandidateOnlyTiming(row);
    const displayStart = candidateOnlyTiming && !hasSourceTiming ? null : timing.start;
    const displayEnd = candidateOnlyTiming && !hasSourceTiming ? null : timing.end;
    return {
      ...timing,
      start: displayStart,
      end: displayEnd,
      candidateStart: row?.candidate_start ?? row?.candidateStart,
      candidateEnd: row?.candidate_end ?? row?.candidateEnd,
      text: row?.text || "",
      rawText: row?.raw_text || row?.rawText || row?.text || "",
      speaker: row?.speaker || row?.speaker_label || "Speaker 1",
      sourceStart: Number(row?.source_start ?? row?.sourceStart ?? timing.start),
      sourceEnd: Number(row?.source_end ?? row?.sourceEnd ?? timing.end),
      segmentType: row?.segment_type || row?.segmentType || "utterance",
      synthetic: Boolean(row?.synthetic),
      timingStatus: row?.timing_status || row?.timingStatus,
      timingAuthority: row?.timing_authority || row?.timingAuthority,
      timingSource: row?.timing_source || row?.timingSource,
      sourceTimingStatus: row?.source_timing_status || row?.sourceTimingStatus,
      sourceTimeValid: row?.source_time_valid ?? row?.sourceTimeValid,
      status: row?.status,
      correctionSource: row?.correctionSource || "transcript",
      targetId: row?.targetId,
    };
  });
}

async function loadAuthoritativeTranscriptRows(videoId: string) {
  const noCacheToken = Date.now().toString(36);
  const response = await fetch(
    `/api/local-analysis/${videoId}/download/transcript?_=${noCacheToken}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return null;
  }
  const payload = await response.json();
  if (!transcriptPayloadHasTimingAuthority(payload)) {
    return null;
  }
  return {
    transcript: normalizeTranscriptPayloadRows(payload.segments || []),
    transcriptTimeline: normalizeTranscriptPayloadRows(
      payload.timeline_segments || payload.segments || [],
    ),
  };
}

type TranscriptEditorDraft = {
  mode: "span" | "manual";
  source: "transcript" | "manual";
  targetId?: string;
  rawText?: string;
  targetStart?: number;
  targetEnd?: number;
  start: string;
  end: string;
  text: string;
  status: "confirmed" | "unconfirmed";
  speakerConfirmation: string;
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
  const speakerConfirmationOptions = React.useMemo(
    () => [
      ...governedNarrativeAgentLabels(analysisData),
      ...TRANSCRIPT_SOURCE_SPEAKERS,
    ].filter((label, index, labels) =>
      labels.findIndex((candidate) => candidate.toLowerCase() === label.toLowerCase()) === index,
    ),
    [analysisData],
  );
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedWord, setSelectedWord] = useState<string>("");
  const [selectedWordDraft, setSelectedWordDraft] = useState<string>("");
  const [editorDraft, setEditorDraft] = useState<TranscriptEditorDraft | null>(null);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);

  // State for show/hide summary
  const [showSummary, setShowSummary] = useState(false);

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

        // Load analysis data and hard-stop stale scaffold transcript clocks before rendering.
        const analysis = await VideoService.getAnalysis(videoId);
        let displayAnalysis = analysis;
        const analysisRows = analysis.transcript ?? analysis.transcriptTimeline ?? [];
        if (transcriptRowsLookLikeScaffold(analysisRows)) {
          const authoritativeRows = await loadAuthoritativeTranscriptRows(videoId);
          if (authoritativeRows) {
            displayAnalysis = {
              ...analysis,
              transcript: authoritativeRows.transcript,
              transcriptTimeline: authoritativeRows.transcriptTimeline,
              metadata: {
                ...((analysis.metadata || {}) as Record<string, unknown>),
                transcriptSourceDecision:
                  "rejected scaffold transcript rows; surfaced original Whisper timecode artifact",
              },
            } as unknown as typeof analysis;
          }
        }

        setAnalysisData(displayAnalysis);
        setRawCsv(displayAnalysis.rawCsv || null);
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
  const rawTranscript =
    panelMode === "audio"
      ? analysisData?.transcriptTimeline ?? analysisData?.transcript ?? []
      : analysisData?.transcript ?? analysisData?.transcriptTimeline ?? [];
  const transcriptSourceBlocked = transcriptRowsLookLikeScaffold(rawTranscript);
  const transcript = transcriptSourceBlocked
    ? rawTranscript.filter((row: any) => {
        const text = String(row?.text || "").trim();
        return (
          text.startsWith("[Unresolved") ||
          row?.segmentType === "unresolved_interval" ||
          row?.segment_type === "unresolved_interval"
        );
      })
    : rawTranscript;
  const transcriptClockOffset = Number(
    analysisData?.annotationCorrections?.transcript_clock_offset_seconds || 0,
  );
  const audioProsody = analysisData?.audioProsody ?? [];
  const manualAudioAnnotations =
    analysisData?.manualAnnotationsByCategory?.Audio ?? [];
  const manualTranscriptionAnnotations =
    analysisData?.manualAnnotationsByCategory?.Transcription ?? [];
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
    ? "shrink min-h-[190px] max-h-[50%] overflow-y-auto space-y-2 pr-2 mb-4"
    : "shrink-0 max-h-40 overflow-y-auto space-y-2 pr-2 mb-4";
  const transcriptSectionClass = isAudioMode
    ? "min-h-[170px] max-h-[42%] overflow-y-auto space-y-2 pr-2"
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
      targetStart: Number(row?.sourceStart ?? row?.start ?? 0),
      targetEnd: Number(row?.sourceEnd ?? row?.end ?? row?.start ?? 0),
      start: String(Number(row?.start ?? 0)),
      end: String(Number(row?.end ?? row?.start ?? 0)),
      text:
        String(row?.rawText || row?.text || "").trim() === "Unconfirmed"
          ? ""
          : String(row?.rawText || row?.text || "").trim(),
      status: row?.status === "unconfirmed" ? "unconfirmed" : "confirmed",
      speakerConfirmation: String(row?.speakerConfirmation || ""),
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
      speakerConfirmation: "",
      note: "",
    });
  };

  const syncTranscriptClockToRow = async (row: any) => {
    if (!videoId) {
      return;
    }
    const sourceStart = Number(row?.sourceStart ?? row?.start ?? 0);
    if (!Number.isFinite(sourceStart)) {
      setEditorMessage("Transcript row does not have a usable source timestamp.");
      return;
    }
    const currentVideoTime = Math.max(0, Number(videoTimeLine || 0));
    const nextOffset = currentVideoTime - sourceStart;
    pushCorrectionSnapshot(videoId, analysisData?.annotationCorrections);
    const nextCorrections = setTranscriptClockOffset(
      analysisData?.annotationCorrections,
      nextOffset,
    );
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    setEditorMessage(
      `Transcript clock synced: ${nextOffset.toFixed(3)}s offset from transcript source time.`,
    );
    broadcastAnalysisCorrectionRefresh(videoId);
  };

  const openTranscriptRowAtSourceTime = (row: any) => {
    if (!videoId || row?.synthetic || !rowHasTimingAuthority(row)) {
      setEditorMessage("This transcript row is text-only until per-line source timing is verified.");
      return;
    }
    const start = Number(row?.start);
    if (!Number.isFinite(start)) {
      setEditorMessage("This transcript row does not have a valid source timestamp.");
      return;
    }
    openVideoAtTime(videoId, start);
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
        speaker_confirmation: editorDraft.speakerConfirmation.trim() || undefined,
        note: editorDraft.note.trim(),
        updated_at: new Date().toISOString(),
        updated_by: "analyst",
      });
    } else {
      const rawText = String(editorDraft.rawText || "").trim() || "Unconfirmed";
      nextCorrections = mergeCorrectionRule(
        nextCorrections,
        buildCorrectionRule("text", rawText, normalizedText, editorDraft.note.trim(), {
          targetStartTimestamp: editorDraft.targetStart,
          targetEndTimestamp: editorDraft.targetEnd,
          correctedStartTimestamp: start,
          correctedEndTimestamp: end,
          speakerConfirmation: editorDraft.speakerConfirmation.trim() || undefined,
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
                  <div className="mt-1 text-[11px] text-slate-500">
                    Clock offset {formatSpeechSeconds(transcriptClockOffset)}.
                    To correct drift, pause video at the spoken line and use Sync clock on that transcript row.
                  </div>
                  {transcriptSourceBlocked ? (
                    <div className="mt-2 rounded border border-rose-500/30 bg-rose-950/20 px-2 py-1 text-[11px] text-rose-100">
                      Scaffold transcript timing rejected: spoken rows at 0,2,4,6 seconds are not displayed.
                    </div>
                  ) : null}
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
                  <div className="mt-3 grid grid-cols-3 gap-3">
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
                      <div className="mb-1 uppercase tracking-[0.14em]">Speaker confirmation</div>
                      <select
                        value={editorDraft.speakerConfirmation}
                        onChange={(event) =>
                          setEditorDraft((current) =>
                            current
                              ? { ...current, speakerConfirmation: event.target.value }
                              : current,
                          )
                        }
                        data-vaa1-transcript-speaker-confirmation="true"
                        className="w-full rounded border border-white/10 bg-[#171717] px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                      >
                        <option value="">Select speaker</option>
                        {editorDraft.speakerConfirmation &&
                        !speakerConfirmationOptions.some(
                          (label) => label.toLowerCase() === editorDraft.speakerConfirmation.toLowerCase(),
                        ) ? (
                          <option value={editorDraft.speakerConfirmation}>
                            {editorDraft.speakerConfirmation}
                          </option>
                        ) : null}
                        {speakerConfirmationOptions.map((label) => (
                          <option key={label} value={label}>
                            {label}
                          </option>
                        ))}
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
            <details className="mb-2 shrink-0 border border-white/8 bg-[#141414]">
              <summary className="cursor-pointer px-3 py-2 text-slate-400">
                Audio prosody
              </summary>
            <div className={`${prosodySectionClass} border-t border-white/8 p-2`}>
              {isAudioMode ? (
                <div className="rounded border border-emerald-500/20 bg-emerald-950/10 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-100/80">
                      Diarization stack
                    </div>
                    <div className="rounded border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-100/70">
                      {analysisData?.audioDiarization?.status || "planned"}
                    </div>
                  </div>
                  <div className="grid gap-2 text-[11px] text-slate-300 sm:grid-cols-2">
                    <div className="rounded border border-white/8 bg-[#141414] px-2 py-2">
                      VAD:{" "}
                      {analysisData?.audioDiarization?.stack_plan?.vad?.provider ||
                        "pyannote.audio"}
                    </div>
                    <div className="rounded border border-white/8 bg-[#141414] px-2 py-2">
                      Diarization:{" "}
                      {analysisData?.audioDiarization?.stack_plan?.diarization?.provider ||
                        "pyannote.audio"}
                    </div>
                    <div className="rounded border border-white/8 bg-[#141414] px-2 py-2">
                      Embeddings:{" "}
                      {analysisData?.audioDiarization?.stack_plan?.speaker_embeddings
                        ?.primary_provider || "pyannote.audio"}
                    </div>
                    <div className="rounded border border-white/8 bg-[#141414] px-2 py-2">
                      Real-time:{" "}
                      {analysisData?.audioDiarization?.stack_plan?.real_time?.provider ||
                        "diart"}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                    <span>
                      Turns: {analysisData?.audioDiarization?.turn_count ?? 0}
                    </span>
                    <span>
                      Reference upload:{" "}
                      {analysisData?.audioDiarization?.stack_plan?.reference_upload
                        ?.provider || "custom"}
                    </span>
                    <span>
                      Alternative embeddings:{" "}
                      {analysisData?.audioDiarization?.stack_plan?.speaker_embeddings
                        ?.alternative_provider || "SpeechBrain"}
                    </span>
                  </div>
                  {analysisData?.metadata?.audioDiarizationError ? (
                    <div className="mt-2 text-[10px] text-amber-200">
                      {analysisData.metadata.audioDiarizationError}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {manualAudioAnnotations.length > 0 ? (
                <div className="rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">
                      Manual audio annotations
                    </div>
                    <div className="rounded border border-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-100/70">
                      {manualAudioAnnotations.length}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {manualAudioAnnotations.map((item: any) => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full rounded border border-white/8 bg-[#141414] px-2 py-2 text-left text-xs text-slate-300 transition hover:bg-slate-800/30"
                        onClick={() => {
                          openManualAnnotationInVideo(videoId, item);
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-100">
                            {item.label || "Manual audio cue"}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-500">
                            {formatSpeechSeconds(item.timestamp_seconds)}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {item.subcategory || "Audio"}
                        </div>
                        {(item.audio_foley_note || item.open_note) && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            {item.audio_foley_note || item.open_note}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {audioProsody.length === 0 ? (
                <div className="rounded border border-white/8 bg-[#171717] px-3 py-3 text-xs text-slate-400">
                  No prosody cues on channel yet.
                </div>
              ) : (
                audioProsody.map((cue: any) => (
                  <div
                    key={cue.cue_id || `${cue.start}-${cue.end}`}
                    className="cursor-pointer rounded border border-white/8 bg-[#171717] px-3 py-3 transition-colors hover:bg-slate-800/25"
                    onClick={() => {
                      openVideoAtTime(videoId, cue.start);
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
            </details>
            <div className="mb-2 shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              {isAudioMode ? "Transcript support" : "Speech to text"}
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
              {manualTranscriptionAnnotations.length > 0 ? (
                <div className="rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">
                      Manual transcription annotations
                    </div>
                    <div className="rounded border border-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-100/70">
                      {manualTranscriptionAnnotations.length}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {manualTranscriptionAnnotations.map((item: any) => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full rounded border border-white/8 bg-[#141414] px-2 py-2 text-left text-xs text-slate-300 transition hover:bg-slate-800/30"
                        onClick={() => {
                          openManualAnnotationInVideo(videoId, item);
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-100">
                            {item.label || "Manual transcription cue"}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-500">
                            {formatSpeechSeconds(item.timestamp_seconds)}
                          </span>
                        </div>
                        {(item.open_note || item.subcategory) && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            {item.open_note || item.subcategory}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
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
                  const hasSourceTiming = rowHasTimingAuthority(row);
                  const linkedSpeakerTurn = (
                    analysisData?.audioDiarization?.speaker_turns || []
                  )
                    .map((turn: any) => ({
                      turn,
                      overlap: Math.max(
                        0,
                        Math.min(Number(row.end || 0), Number(turn.end || 0)) -
                          Math.max(Number(row.start || 0), Number(turn.start || 0)),
                      ),
                    }))
                    .sort(
                      (
                        left: { turn: any; overlap: number },
                        right: { turn: any; overlap: number },
                      ) => right.overlap - left.overlap,
                    )[0];
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
                      openTranscriptRowAtSourceTime(row);
                    }}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="space-y-1 text-[11px] text-slate-400">
                        <div className={isSynthetic ? "text-amber-200/80" : "text-slate-500"}>
                          {segmentLabel}
                        </div>
                        <div className="text-slate-200">
                          {hasSourceTiming
                            ? `${formatSpeechSeconds(row.start)} ~ ${formatSpeechSeconds(row.end)}`
                            : "Unresolved source time"}
                        </div>
                        <div>
                          {hasSourceTiming
                            ? `duration ${formatSpeechSeconds(Number(row.end) - Number(row.start))}`
                            : "duration unresolved"}
                        </div>
                        <div>{row.speaker || "Speaker unconfirmed"}</div>
                        {linkedSpeakerTurn?.overlap > 0 ? (
                          <div
                            className="text-fuchsia-200/80"
                            title="Measured acoustic diarization cluster; identity remains provisional until confirmed."
                          >
                            Diarization:{" "}
                            {linkedSpeakerTurn.turn.speaker_label ||
                              "unresolved cluster"}
                          </div>
                        ) : null}
                      </div>
                      {isSynthetic ? (
                        <div className="rounded border border-amber-500/20 bg-amber-950/10 px-2 py-1 text-[10px] text-amber-100/80">
                          Coverage marker
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="rounded border border-white/8 bg-[#121212] px-2 py-1 text-[10px] text-slate-400">
                            {!hasSourceTiming
                              ? "Needs timing"
                              : row.status === "unconfirmed"
                                ? "Unconfirmed"
                                : "Confirmed"}
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              syncTranscriptClockToRow(row);
                            }}
                            disabled={!hasSourceTiming}
                            className="rounded border border-sky-500/20 bg-sky-950/20 px-2 py-1 text-[10px] text-sky-100 hover:bg-sky-900/30"
                          >
                            Sync clock
                          </button>
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
                              openTranscriptRowAtSourceTime(row);
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
                                : "Open the source video at this transcript span and select this word for correction or drop."
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
