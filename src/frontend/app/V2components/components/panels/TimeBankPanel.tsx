import React, { useEffect, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { apiService } from "@/lib/api-service";
import { VideoService, type AnalysisData } from "@/lib/video-service";
import { openVideoAtTime } from "@/lib/video-navigation";

const TIMEBANK_ANALYSES_STORAGE_KEY = "vaa1.timebank.analyses";
const TIMEBANK_SECTIONS_STORAGE_KEY = "vaa1.timebank.sections";
const TIMEBANK_SECTION_WIDTHS_STORAGE_KEY = "vaa1.timebank.sectionWidths";

type TimeBankObject = {
  id: string;
  object_type: string;
  anchor_id: string;
  payload?: Record<string, any>;
  confidence?: number | null;
  created_by?: string;
};

type TimeBankAnchor = {
  anchor_id: string;
  media_id: string;
  t_start_ms: number;
  t_end_ms?: number | null;
  frame_index?: number | null;
};

type TimeBankEnvelope = {
  media_ref?: {
    media_id?: string;
    source_filename?: string;
    source_uri?: string;
  };
  anchors?: TimeBankAnchor[];
  objects?: TimeBankObject[];
};

type TimeBankRow = {
  id: string;
  sourceName: string;
  bank: {
    transcript?: TimeBankEnvelope | null;
    audio?: TimeBankEnvelope | null;
    meaning?: TimeBankEnvelope | null;
    ocr?: TimeBankEnvelope | null;
    objects?: TimeBankEnvelope | null;
    expressions?: TimeBankEnvelope | null;
  };
};

function buildEnvelopeFromAnalysisData(
  analysisData: AnalysisData | null,
  type: "audio" | "transcript" | "meaning" | "ocr" | "objects" | "expressions",
  analysisId: string,
  sourceName: string,
): TimeBankEnvelope | null {
  if (!analysisData) {
    return null;
  }

  const sourceUri = `vaa1://media/${analysisId}`;
  const makeAnchorId = (prefix: string, index: number) => `${prefix}_${analysisId}_${index}`;

  if (type === "audio") {
    const anchors = (analysisData.audioProsody || []).map((item, index) => ({
      anchor_id: makeAnchorId("audio", index),
      media_id: analysisId,
      t_start_ms: Math.round(Number(item.start || 0) * 1000),
      t_end_ms: Math.round(Number(item.end || 0) * 1000),
    }));
    const objects = (analysisData.audioProsody || []).map((item, index) => ({
      id: item.cue_id || `audio_event_${analysisId}_${index}`,
      object_type: "audio_prosody",
      anchor_id: anchors[index].anchor_id,
      payload: {
        text: item.text,
        pace: item.pace || {},
        pauses: item.pauses || {},
        turn_structure: item.turn_structure || {},
        interaction_cues: item.interaction_cues || {},
        rhythm_profile: item.rhythm_profile || {},
        tonality_profile: item.tonality_profile || {},
        emphasis: item.emphasis || {},
        pitch_energy_contour: item.pitch_energy_contour || {},
        sound_environment: item.sound_environment || {},
      },
      confidence: item.emphasis?.score ?? null,
      created_by: "client_fallback",
    }));
    return {
      media_ref: {
        media_id: analysisId,
        source_filename: sourceName,
        source_uri: sourceUri,
      },
      anchors,
      objects,
    };
  }

  if (type === "transcript") {
    const transcriptRows = analysisData.transcriptTimeline || analysisData.transcript || [];
    const anchors = transcriptRows.map((item, index) => ({
      anchor_id: makeAnchorId("txt", index),
      media_id: analysisId,
      t_start_ms: Math.round(Number(item.start || 0) * 1000),
      t_end_ms: Math.round(Number(item.end || 0) * 1000),
    }));
    const objects = transcriptRows.map((item, index) => ({
      id: `txt_event_${analysisId}_${index}`,
      object_type: item.synthetic ? "transcript_interval_marker" : "utterance",
      anchor_id: anchors[index].anchor_id,
      payload: {
        text: item.text,
        raw_text: item.rawText || item.text,
        segment_type: item.segmentType || "utterance",
        synthetic: Boolean(item.synthetic),
      },
      confidence: null,
      created_by: "client_fallback",
    }));
    return {
      media_ref: {
        media_id: analysisId,
        source_filename: sourceName,
        source_uri: sourceUri,
      },
      anchors,
      objects,
    };
  }

  if (type === "meaning") {
    const instructions = analysisData.secondOrderLabelProliferation?.instructions || [];
    const anchors = instructions.map((item, index) => ({
      anchor_id: makeAnchorId("meaning", index),
      media_id: analysisId,
      t_start_ms: Math.round(Number(item.time_span?.start_ms ?? item.time_span?.start ?? 0)),
      t_end_ms: Math.round(
        Number(
          item.time_span?.end_ms ??
            item.time_span?.end ??
            item.time_span?.start_ms ??
            item.time_span?.start ??
            0,
        ),
      ),
    }));
    const objects = instructions.map((item, index) => ({
      id: item.instruction_id || `meaning_event_${analysisId}_${index}`,
      object_type: "second_order_label_candidate",
      anchor_id: anchors[index].anchor_id,
      payload: {
        target_label_family: item.target_label_family,
        candidate_label: item.candidate_label,
        status: item.status,
        participants: item.participants_involved || [],
        objects: item.objects_involved || [],
        ui_surfaces: item.ui_surfaces || [],
        source_event_id: item.source_event_id,
        source_evidence_refs: item.source_evidence_refs || [],
        traceback: item.traceback || {},
      },
      confidence: item.open_scores?.weighted_support_score ?? null,
      created_by: "second_order_label_proliferation",
    }));
    return {
      media_ref: {
        media_id: analysisId,
        source_filename: sourceName,
        source_uri: sourceUri,
      },
      anchors,
      objects,
    };
  }

  if (type === "ocr") {
    const anchors = (analysisData.ocr || []).map((item, index) => ({
      anchor_id: makeAnchorId("ocr", index),
      media_id: analysisId,
      t_start_ms: Math.round(Number(item.timestamp || 0) * 1000),
      t_end_ms: Math.round(Number(item.timestamp || 0) * 1000),
    }));
    const objects = (analysisData.ocr || []).map((item, index) => ({
      id: `ocr_event_${analysisId}_${index}`,
      object_type: "ocr_region",
      anchor_id: anchors[index].anchor_id,
      payload: {
        text: item.text,
        bbox: item.bbox || {},
      },
      confidence: item.confidence,
      created_by: "client_fallback",
    }));
    return {
      media_ref: {
        media_id: analysisId,
        source_filename: sourceName,
        source_uri: sourceUri,
      },
      anchors,
      objects,
    };
  }

  if (type === "objects") {
    const anchors = (analysisData.detectedObjects || []).map((item, index) => ({
      anchor_id: makeAnchorId("obj", index),
      media_id: analysisId,
      t_start_ms: Math.round(
        Number(item.startTimestamp ?? item.timestamp ?? 0) * 1000,
      ),
      t_end_ms: Math.round(
        Number(item.endTimestamp ?? item.timestamp ?? 0) * 1000,
      ),
    }));
    const objects = (analysisData.detectedObjects || []).map((item, index) => {
      const bbox = item.bbox
        ? {
            x: Number(item.bbox.x1 || 0),
            y: Number(item.bbox.y1 || 0),
            w: Math.max(0, Number(item.bbox.x2 || 0) - Number(item.bbox.x1 || 0)),
            h: Math.max(0, Number(item.bbox.y2 || 0) - Number(item.bbox.y1 || 0)),
          }
        : {};
      return {
        id: `obj_event_${analysisId}_${index}`,
        object_type: item.sourceType === "manual_visual" ? "manual_visual_annotation" : "object_detection",
        anchor_id: anchors[index].anchor_id,
        payload: {
          category: item.annotationCategory || "OBJ",
          subcategory: item.annotationSubcategory,
          label: item.displayLabel || item.class_name,
          custom_label: item.customLabel,
          bbox,
          source_type: item.sourceType || "automated",
          identity_affirmation: item.identityAffirmation,
          role_affirmation: item.roleAffirmation,
          audio_foley_note: item.audioFoleyNote,
          open_note: item.openNote,
          metadata_correlation: item.metadataCorrelation,
          teaches_regime: item.teachesRegime,
        },
        confidence: item.confidence,
        created_by: "client_fallback",
      };
    });
    return {
      media_ref: {
        media_id: analysisId,
        source_filename: sourceName,
        source_uri: sourceUri,
      },
      anchors,
      objects,
    };
  }

  const anchors = (analysisData.expressionResults || []).map((item, index) => ({
    anchor_id: makeAnchorId("expr", index),
    media_id: analysisId,
    t_start_ms: Math.round(Number(item.timestamp || 0) * 1000),
    t_end_ms: Math.round(Number(item.timestamp || 0) * 1000),
    frame_index: item.frame_index,
  }));
  const objects = (analysisData.expressionResults || []).map((item, index) => ({
    id: `expr_event_${analysisId}_${index}`,
    object_type: "emotion_signal",
    anchor_id: anchors[index].anchor_id,
    payload: {
      dominant_emotion: item.dominant_emotion,
      emotion: item.emotion,
      face_id: item.face_id,
      bbox: item.bbox || {},
      error: item.error,
    },
    confidence: null,
    created_by: "client_fallback",
  }));
  return {
    media_ref: {
      media_id: analysisId,
      source_filename: sourceName,
      source_uri: sourceUri,
    },
    anchors,
    objects,
  };
}

const SECTION_LABELS = {
  audio: "Audio",
  transcript: "Transcript",
  meaning: "Meaning",
  ocr: "OCR",
  objects: "Objects",
  expressions: "Expressions",
} as const;

type TimeBankSection = keyof typeof SECTION_LABELS;

const DEFAULT_SECTIONS = (Object.keys(SECTION_LABELS) as TimeBankSection[]).sort(
  (left, right) =>
    SECTION_LABELS[left].localeCompare(SECTION_LABELS[right], undefined, {
      sensitivity: "base",
    }),
);

const DEFAULT_SECTION_WIDTHS: Record<TimeBankSection, number> = {
  audio: 380,
  expressions: 280,
  meaning: 360,
  objects: 300,
  ocr: 300,
  transcript: 340,
};

function compactLabel(value: string, maxLength = 26) {
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

async function loadTimeBankEnvelope(
  analysisId: string,
  fileType:
    | "audio_prosody"
    | "time_bank_audio"
    | "linked_transcript"
    | "time_bank_ocr"
    | "time_bank_objects"
    | "time_bank_expressions",
): Promise<TimeBankEnvelope | null> {
  try {
    const blob = await apiService.downloadFile(analysisId, fileType);
    const text = await blob.text();
    const parsed = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === "object" &&
      (Array.isArray(parsed.anchors) || Array.isArray(parsed.objects))
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function formatTimeMs(ms?: number | null) {
  const safe = Math.max(0, Number(ms || 0));
  const totalSeconds = safe / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor(safe % 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function buildAnchorMap(envelope?: TimeBankEnvelope | null) {
  const map = new Map<string, TimeBankAnchor>();
  for (const anchor of envelope?.anchors || []) {
    map.set(anchor.anchor_id, anchor);
  }
  return map;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function TimeBankPanel({ videoId: initialVideoId = "" }: { videoId?: string }) {
  const [selectedVideoId, setSelectedVideoId] = useState(initialVideoId);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [analysisIds, setAnalysisIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return initialVideoId ? [initialVideoId] : [];
    }
    const stored = window.localStorage.getItem(TIMEBANK_ANALYSES_STORAGE_KEY);
    if (!stored) {
      return initialVideoId ? [initialVideoId] : [];
    }
    try {
      const parsed = JSON.parse(stored);
      const next = Array.isArray(parsed) ? parsed : [];
      if (
        initialVideoId &&
        !next.includes(initialVideoId)
      ) {
        next.push(initialVideoId);
      }
      return next.sort();
    } catch {
      return initialVideoId ? [initialVideoId] : [];
    }
  });
  const [sections, setSections] = useState<TimeBankSection[]>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SECTIONS;
    }
    const stored = window.localStorage.getItem(TIMEBANK_SECTIONS_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SECTIONS;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return DEFAULT_SECTIONS;
      }
      const filtered = parsed.filter((key): key is TimeBankSection => key in SECTION_LABELS);
      const missing = DEFAULT_SECTIONS.filter((key) => !filtered.includes(key));
      return [...filtered, ...missing];
    } catch {
      return DEFAULT_SECTIONS;
    }
  });
  const [sectionWidths, setSectionWidths] = useState<Record<TimeBankSection, number>>(
    () => {
      if (typeof window === "undefined") {
        return DEFAULT_SECTION_WIDTHS;
      }
      const stored = window.localStorage.getItem(TIMEBANK_SECTION_WIDTHS_STORAGE_KEY);
      if (!stored) {
        return DEFAULT_SECTION_WIDTHS;
      }
      try {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SECTION_WIDTHS,
          ...(parsed || {}),
        };
      } catch {
        return DEFAULT_SECTION_WIDTHS;
      }
    },
  );
  const [rows, setRows] = useState<TimeBankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draggedSection, setDraggedSection] = useState<TimeBankSection | null>(null);
  const currentIncluded = !!selectedVideoId && analysisIds.includes(selectedVideoId);

  useEffect(() => {
    const handler = (id: string) => {
      setSelectedVideoId(id);
    };
    const correctionHandler = (id: string) => {
      if (analysisIds.includes(id)) {
        setRefreshNonce((current) => current + 1);
      }
    };
    eventBus.on("videoIdChanged", handler);
    eventBus.on("analysisCorrectionsChanged", correctionHandler);
    return () => {
      eventBus.off("videoIdChanged", handler);
      eventBus.off("analysisCorrectionsChanged", correctionHandler);
    };
  }, [analysisIds]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      TIMEBANK_ANALYSES_STORAGE_KEY,
      JSON.stringify([...analysisIds].sort()),
    );
  }, [analysisIds, refreshNonce]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      TIMEBANK_SECTIONS_STORAGE_KEY,
      JSON.stringify(sections),
    );
  }, [sections]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      TIMEBANK_SECTION_WIDTHS_STORAGE_KEY,
      JSON.stringify(sectionWidths),
    );
  }, [sectionWidths]);

  useEffect(() => {
    async function load() {
      if (analysisIds.length === 0) {
        setRows([]);
        return;
      }
      setLoading(true);
      const nextRows = await Promise.all(
        analysisIds.map(async (analysisId) => {
          const status = await apiService.getStatus(analysisId).catch(() => null);
          if (!status) {
            return null;
          }
          const [video, analysisData, audio, transcript, ocr, objects, expressions] = await Promise.all([
            VideoService.get(analysisId).catch(() => ({ name: "Selected analysis" })),
            VideoService.getAnalysis(analysisId).catch(() => null),
            loadTimeBankEnvelope(analysisId, "time_bank_audio"),
            loadTimeBankEnvelope(analysisId, "linked_transcript"),
            loadTimeBankEnvelope(analysisId, "time_bank_ocr"),
            loadTimeBankEnvelope(analysisId, "time_bank_objects"),
            loadTimeBankEnvelope(analysisId, "time_bank_expressions"),
          ]);
          const resolvedSourceName = (video as any)?.name || "Selected analysis";

          const correctedAudio =
            buildEnvelopeFromAnalysisData(analysisData, "audio", analysisId, resolvedSourceName);
          const correctedTranscript = buildEnvelopeFromAnalysisData(
            analysisData,
            "transcript",
            analysisId,
            resolvedSourceName,
          );
          const correctedOcr =
            buildEnvelopeFromAnalysisData(analysisData, "ocr", analysisId, resolvedSourceName);
          const correctedMeaning = buildEnvelopeFromAnalysisData(
            analysisData,
            "meaning",
            analysisId,
            resolvedSourceName,
          );
          const correctedObjects =
            buildEnvelopeFromAnalysisData(analysisData, "objects", analysisId, resolvedSourceName);
          const correctedExpressions = buildEnvelopeFromAnalysisData(
            analysisData,
            "expressions",
            analysisId,
            resolvedSourceName,
          );

          return {
            id: analysisId,
            sourceName: resolvedSourceName,
            bank: {
              audio: correctedAudio || audio,
              transcript: correctedTranscript || transcript,
              meaning: correctedMeaning,
              ocr: correctedOcr || ocr,
              objects: correctedObjects || objects,
              expressions: correctedExpressions || expressions,
            },
          } satisfies TimeBankRow;
        }),
      );
      const validRows: TimeBankRow[] = [];
      for (const row of nextRows) {
        if (row !== null) {
          validRows.push(row);
        }
      }
      const validIds = validRows.map((row) => row.id);
      if (validIds.length !== analysisIds.length) {
        setAnalysisIds(validIds.sort());
      }
      validRows.sort((left, right) =>
        left.sourceName.localeCompare(right.sourceName, undefined, { sensitivity: "base" }),
      );
      setRows(validRows);
      setLoading(false);
    }
    void load();
  }, [analysisIds, refreshNonce]);

  const addCurrentAnalysis = () => {
    if (!selectedVideoId) {
      return;
    }
    setAnalysisIds((current) =>
      current.includes(selectedVideoId)
        ? current
        : [...current, selectedVideoId].sort(),
    );
  };

  const clearAnalyses = () => {
    setAnalysisIds(selectedVideoId ? [selectedVideoId] : []);
  };

  const removeAnalysis = (analysisId: string) => {
    setAnalysisIds((current) => current.filter((id) => id !== analysisId));
  };

  const reorderSection = (targetSection: TimeBankSection) => {
    if (!draggedSection || draggedSection === targetSection) {
      return;
    }
    setSections((current) => {
      const fromIndex = current.indexOf(draggedSection);
      const toIndex = current.indexOf(targetSection);
      return moveItem(current, fromIndex, toIndex);
    });
  };

  const adjustSectionWidth = (
    section: TimeBankSection,
    delta: number,
  ) => {
    setSectionWidths((current) => ({
      ...current,
      [section]: Math.max(240, Math.min(720, (current[section] || 300) + delta)),
    }));
  };

  const seekTo = (analysisId: string, tStartMs?: number | null) => {
    openVideoAtTime(analysisId, Number(tStartMs || 0) / 1000);
  };

  const renderCell = (
    section: TimeBankSection,
    row: TimeBankRow,
  ) => {
    const envelope = row.bank[section];
    const objects = envelope?.objects || [];
    const anchorMap = buildAnchorMap(envelope);

    const previewObjects = objects.slice(0, 16);

    return (
      <div className="rounded-sm border border-[#242424] bg-[#101010]">
        <div className="flex items-center justify-between border-b border-[#202020] px-2.5 py-1.5 text-[11px] text-[#8f8f8f]">
          <span>{objects.length} events</span>
          {objects.length > previewObjects.length ? (
            <span>+{objects.length - previewObjects.length} hidden</span>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
        {objects.length === 0 ? (
          <div className="px-2.5 py-3 text-[12px] text-[#8f8f8f]">
            No {SECTION_LABELS[section].toLowerCase()} events loaded.
          </div>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            {previewObjects.map((object, index) => {
              const anchor = anchorMap.get(object.anchor_id);
              const payload = object.payload || {};
              const timeLabel = formatTimeMs(anchor?.t_start_ms);
              const confidence =
                object.confidence !== undefined && object.confidence !== null
                  ? `${Math.round(Number(object.confidence) * 100)}%`
                  : null;

              let primary = object.object_type;
              let secondary = "";

              if (section === "transcript") {
                primary = String(payload.text || "").trim() || "Utterance";
                secondary = payload.language_name || payload.language || "";
              } else if (section === "audio") {
                primary =
                  payload.sound_environment?.label ||
                  payload.turn_structure?.transition ||
                  payload.pace?.label ||
                  "Audio cue";
                const details: string[] = [];
                if (payload.sound_environment?.label) {
                  details.push(`env: ${payload.sound_environment.label}`);
                }
                if (payload.interaction_cues?.role_support) {
                  details.push(`role: ${payload.interaction_cues.role_support}`);
                }
                if (payload.rhythm_profile?.label) {
                  details.push(`rhythm: ${payload.rhythm_profile.label}`);
                }
                if (payload.tonality_profile?.label) {
                  details.push(`tone: ${payload.tonality_profile.label}`);
                }
                if (payload.pace?.label) {
                  details.push(`pace: ${payload.pace.label}`);
                }
                if (payload.emphasis?.label) {
                  details.push(`emphasis: ${payload.emphasis.label}`);
                }
                if (payload.pitch_energy_contour?.label) {
                  details.push(payload.pitch_energy_contour.label);
                }
                secondary = details.join(" • ");
              } else if (section === "ocr") {
                primary = String(payload.text || "").trim() || "OCR";
                secondary = payload.bbox
                  ? `${Math.round(payload.bbox.x || 0)}, ${Math.round(payload.bbox.y || 0)}`
                  : "";
              } else if (section === "meaning") {
                primary = `${payload.target_label_family || "Meaning"} / ${
                  payload.candidate_label || object.object_type
                }`;
                const refs = Array.isArray(payload.source_evidence_refs)
                  ? payload.source_evidence_refs.length
                  : 0;
                const participants = Array.isArray(payload.participants)
                  ? payload.participants.filter(Boolean).join(", ")
                  : "";
                secondary = [
                  payload.status,
                  participants ? `participants: ${participants}` : "",
                  refs ? `${refs} source refs` : "traceback ready",
                ]
                  .filter(Boolean)
                  .join(" • ");
              } else if (section === "objects") {
                primary = String(payload.label || "Object");
                secondary = payload.bbox
                  ? `${Math.round(payload.bbox.x || 0)}, ${Math.round(payload.bbox.y || 0)}`
                  : "";
              } else if (section === "expressions") {
                primary = String(payload.dominant_emotion || "Expression");
                secondary = payload.face_id !== undefined ? `Face ${payload.face_id}` : "";
              }

              return (
                <button
                  key={object.id}
                  onClick={() => seekTo(row.id, anchor?.t_start_ms)}
                  className={`w-full px-2.5 py-1.5 text-left transition-colors hover:bg-[#171717] ${
                    index < previewObjects.length - 1 ? "border-b border-[#1d1d1d]" : ""
                  }`}
                  title={`Jump to ${timeLabel}`}
                >
                  <div className="grid grid-cols-[72px_minmax(0,1fr)_52px] items-start gap-2">
                    <div className="text-[11px] text-[#8f8f8f]">{timeLabel}</div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] text-slate-200">{primary}</div>
                      {secondary ? (
                        <div
                          className={`text-[11px] text-[#8f8f8f] ${
                            section === "audio" ? "whitespace-normal break-words" : "truncate"
                          }`}
                        >
                          {secondary}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right text-[11px] text-[#8f8f8f]">
                      {confidence || " "}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#161616] text-slate-100">
      <div className="border-b border-white/8 bg-[#141414] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Time Bank
            </div>
            <div className="mt-1 truncate text-[11px] text-slate-400">
              Navigable multimodal evidence with side-by-side comparison
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={addCurrentAnalysis}
              className={`rounded border px-2 py-1 ${
                currentIncluded
                  ? "border-blue-500/30 bg-blue-500/10 text-slate-100"
                  : "border-white/10 bg-[#101010] text-slate-300 hover:bg-white/5"
              }`}
              title={
                currentIncluded
                  ? "The currently selected analysis is already included."
                  : "Add the currently selected analysis to the Time Bank comparison set."
              }
            >
              {currentIncluded ? "Current Added" : "Add Current"}
            </button>
            <button
              onClick={clearAnalyses}
              className="rounded border border-white/10 bg-[#101010] px-2 py-1 text-slate-400 hover:bg-white/5"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {analysisIds.map((analysisId) => {
            const row = rows.find((entry) => entry.id === analysisId);
            const label = compactLabel(row?.sourceName || analysisId);
            const isCurrent = analysisId === selectedVideoId;
            return (
              <button
                key={analysisId}
                onClick={() => {
                  eventBus.emit("videoIdChanged", analysisId);
                }}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                  isCurrent
                    ? "border-blue-500/40 bg-blue-500/10 text-slate-100"
                    : "border-white/10 bg-[#101010] text-slate-400 hover:bg-white/5"
                }`}
                title={row?.sourceName || analysisId}
              >
                {label}
                {analysisIds.length > 1 ? (
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      removeAnalysis(analysisId);
                    }}
                    className="ml-2 text-[#8f8f8f] hover:text-slate-100"
                  >
                    ×
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="mt-3 rounded border border-white/8 bg-[#121212] px-3 py-2 text-[11px] text-slate-400">
          Open another analysis in VAA1, then press `Add Current` to compare it side by side here. Drag feature headings to reorder the columns.
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-3">
        {loading ? (
          <div className="rounded border border-white/8 bg-[#121212] px-4 py-4 text-sm text-slate-400">Loading Time Bank…</div>
        ) : rows.length === 0 ? (
          <div className="rounded border border-white/8 bg-[#121212] px-4 py-4 text-sm text-slate-400">
            No analyses selected. Open an analysis, then use `Add Current`.
          </div>
        ) : (
          <div className="min-w-[1040px]">
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `210px ${sections
                  .map((section) => `minmax(${sectionWidths[section] || 300}px, 1fr)`)
                  .join(" ")}`,
              }}
            >
              <div className="rounded border border-white/8 bg-[#151515] px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Source
                </div>
                <div className="mt-1 text-[11px] text-slate-500">Timeline row</div>
              </div>
              {sections.map((section) => (
                <div
                  key={`head-${section}`}
                  draggable
                  onDragStart={() => setDraggedSection(section)}
                  onDragEnd={() => setDraggedSection(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    reorderSection(section);
                    setDraggedSection(null);
                  }}
                  className="rounded border border-white/8 bg-[#151515] px-3 py-2.5"
                  title="Drag to reorder feature columns"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      {SECTION_LABELS[section]}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          adjustSectionWidth(section, -40);
                        }}
                        className="rounded border border-white/10 bg-[#101010] px-1 hover:bg-white/5"
                        title="Narrow this column"
                      >
                        -
                      </button>
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          adjustSectionWidth(section, 40);
                        }}
                        className="rounded border border-white/10 bg-[#101010] px-1 hover:bg-white/5"
                        title="Widen this column"
                      >
                        +
                      </button>
                      <span>drag</span>
                    </div>
                  </div>
                  <div className="mt-1 grid grid-cols-[72px_minmax(0,1fr)_52px] gap-2 text-[11px] text-slate-500">
                    <span>Time</span>
                    <span>Evidence</span>
                    <span className="text-right">Conf.</span>
                  </div>
                </div>
              ))}

              {rows.map((row) => (
                <React.Fragment key={row.id}>
                  <button
                    onClick={() => eventBus.emit("videoIdChanged", row.id)}
                    className="min-w-0 rounded border border-white/8 bg-[#151515] px-3 py-2 text-left hover:bg-white/5"
                    title={`${row.sourceName}\n${row.id}`}
                  >
                    <div className="truncate text-[12px] text-slate-200">
                      {compactLabel(row.sourceName, 34)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {row.id === selectedVideoId ? "current source" : "source ready"}
                    </div>
                  </button>
                  {sections.map((section) => (
                    <div key={`${row.id}-${section}`} className="align-top">
                      {renderCell(section, row)}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
