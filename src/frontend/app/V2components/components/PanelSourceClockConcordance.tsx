"use client";

import React, { useEffect, useMemo, useState } from "react";
import { VideoService, type AnalysisData } from "@/lib/video-service";
import { apiService } from "@/lib/api-service";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { governedNarrativeAgentLabels } from "@/lib/narrative-agent-registry";
import { sourceClockConcordance } from "@/lib/source-clock";
import { publishSourceTime, subscribeSourceTime } from "@/lib/source-clock-events";
import SourceClockConcordanceRail, { type ConcordanceDisplayItem } from "./SourceClockConcordanceRail";

type TimedItem = ConcordanceDisplayItem & { start: number; end?: number };

const PANEL_NAMES: Record<string, string> = {
  Transcript: "Transcript",
  Audio: "Audio",
  OBJDetection: "Objects",
  OCR: "OCR",
  POS: "POS",
  POSMatrix: "POS",
  Quant: "Quant",
  QuantMatrix: "Quant",
  MeaningPlot: "Meaning / Plot",
  MeaningNetwork: "Meaning / Plot",
  SceneCards: "Scene Cards",
  Search: "Search",
  MasterSchema: "Master Schema",
  DataMaturation: "Data Maturation",
  StatsKit: "StatsKit",
  TracebackDrawer: "Traceback",
  SourceMediaMetadata: "Narrative Agent",
};

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function timed(id: string, label: unknown, startValue: unknown, endValue?: unknown, detail?: string): TimedItem | null {
  const start = finite(startValue);
  if (start === null) return null;
  const end = finite(endValue);
  return { id, label: String(label || "Untitled evidence"), detail, start, ...(end !== null && end >= start ? { end } : {}) };
}

function masterRows(data: AnalysisData, predicate: (row: any) => boolean = () => true): TimedItem[] {
  return (data.masterSchemaResolvedEvidence?.records || [])
    .filter(predicate)
    .map((row, index) => timed(
      row.id || `master:${index}`,
      row.label,
      row.start,
      row.end,
      `${row.category} · ${row.sourcePanel} · ${row.authority}`,
    ))
    .filter((row): row is TimedItem => Boolean(row));
}

function quantRows(data: AnalysisData): TimedItem[] {
  const rows = new Map<string, TimedItem & { referenceCount: number }>();
  (data.quantAnalysis || []).forEach((analysis: any, analysisIndex: number) => {
    Object.values(analysis?.evidence_map || {}).flatMap((value: any) => Array.isArray(value) ? value : []).forEach((entry: any, entryIndex: number) => {
      (entry?.segment_refs || []).forEach((segment: any, segmentIndex: number) => {
        const label = entry.term || entry.phrase || entry.keyword || entry.sentence || entry.line || segment.text;
        const row = timed(`quant:${analysisIndex}:${entryIndex}:${segmentIndex}`, label, segment.start, segment.end, "source-linked Quant evidence");
        if (row) {
          const key = `${row.label.trim().toLowerCase()}|${row.start.toFixed(3)}|${Number(row.end ?? row.start).toFixed(3)}`;
          const existing = rows.get(key);
          if (existing) existing.referenceCount += 1;
          else rows.set(key, { ...row, referenceCount: 1 });
        }
      });
    });
  });
  return [...rows.values()].map(({ referenceCount, ...row }) => ({
    ...row,
    detail: referenceCount > 1
      ? `source-linked Quant evidence · ${referenceCount} analytical references`
      : row.detail,
  }));
}

function posRows(data: AnalysisData): TimedItem[] {
  const lexicon = new Map<string, Set<string>>();
  (data.posAnalysis || []).forEach((analysis) => {
    Object.entries(analysis.pos_words || {}).forEach(([category, words]) => {
      (words || []).forEach((word) => {
        const normalized = String(word).toLocaleLowerCase().replace(/^\W+|\W+$/g, "");
        if (!normalized) return;
        const categories = lexicon.get(normalized) || new Set<string>();
        categories.add(category);
        lexicon.set(normalized, categories);
      });
    });
  });
  const rows: TimedItem[] = [];
  (data.transcriptTimeline || data.transcript || []).forEach((segment, segmentIndex) => {
    const seen = new Set<string>();
    String(segment.text || "").match(/[\p{L}\p{N}'’-]+/gu)?.forEach((surface) => {
      const normalized = surface.toLocaleLowerCase().replace(/^\W+|\W+$/g, "");
      (lexicon.get(normalized) || []).forEach((category) => {
        const key = `${normalized}:${category}`;
        if (seen.has(key)) return;
        seen.add(key);
        const row = timed(
          `pos:${segmentIndex}:${key}`,
          `${surface} · ${category}`,
          segment.start,
          segment.end,
          "POS occurrence linked to transcript interval",
        );
        if (row) rows.push(row);
      });
    });
  });
  return rows;
}

function continuityRows(panelName: string, data: AnalysisData): TimedItem[] {
  const consumerByPanel: Record<string, string> = {
    Objects: "video",
    Audio: "audio",
    "Narrative Agent": "narrative_agent",
    "Meaning / Plot": "meaning_plot",
    "Master Schema": "master_schema",
    "Data Maturation": "data_maturation",
    Search: "search",
    Traceback: "traceback",
    StatsKit: "measurements",
  };
  const consumer = consumerByPanel[panelName];
  const envelope = data.narrativeAgentContinuityProjection as any;
  const view = envelope?.consumer_views?.[consumer];
  if (!consumer || !view || view.revision !== envelope?.revision) return [];
  return (Array.isArray(view.source_navigation) ? view.source_navigation : [])
    .map((row: any, index: number) => timed(
      `continuity:${view.collection_id}:${row.occurrence_id || index}`,
      `${envelope?.canonical_collection?.narrative_agent_label || "Narrative Agent"} continuity`,
      row?.source_interval?.start,
      row?.source_interval?.end,
      `${view.maturity} · ${String(view.revision).slice(0, 10)}`,
    ))
    .filter((row: TimedItem | null): row is TimedItem => Boolean(row));
}

function rowsForPanel(panelName: string, data: AnalysisData): TimedItem[] {
  if (panelName === "Transcript") return (data.transcriptTimeline || data.transcript || []).map((row, index) => timed(`transcript:${index}`, row.text, row.start, row.end, row.speaker)).filter((row): row is TimedItem => Boolean(row));
  if (panelName === "Audio") {
    const prosody = (data.audioProsody || []).map((row, index) => timed(row.cue_id || `prosody:${index}`, row.text || row.rhythm_profile?.label || "Audio prosody", row.start, row.end, "audio prosody"));
    const events = (data.metadata?.audioEventIntervals?.intervals || []).map((row, index) => timed(row.event_id || `audio-event:${index}`, row.event_type || "Audio event", row.start, row.end, "audio event"));
    const turns = ((data.audioDiarization as any)?.speaker_turns || []).map((row: any, index: number) => timed(`speaker-turn:${index}`, row.speaker || row.speaker_label || "Speaker turn", row.start, row.end, "speaker diarization"));
    return [...prosody, ...events, ...turns].filter((row): row is TimedItem => Boolean(row));
  }
  if (panelName === "Objects") return [...continuityRows(panelName, data), ...(data.detectedObjects || []).map((row, index) => timed(`object:${index}`, row.displayLabel || row.class_name, row.startTimestamp ?? row.timestamp, row.endTimestamp, `${Math.round(Number(row.confidence || 0) * 100)}% confidence`)).filter((row): row is TimedItem => Boolean(row))];
  if (panelName === "OCR") return (data.ocr || []).map((row, index) => timed(`ocr:${index}`, row.text, row.timestamp, undefined, `${Math.round(Number(row.confidence || 0) * 100)}% confidence`)).filter((row): row is TimedItem => Boolean(row));
  if (panelName === "POS") return posRows(data);
  if (panelName === "Quant" || panelName === "StatsKit") return [...continuityRows(panelName, data), ...quantRows(data)];
  if (panelName === "Scene Cards") {
    const cards = ((data.miseEnSceneSceneCards as any)?.scene_cards || []) as any[];
    return cards.map((card, index) => timed(card.scene_id || `scene:${index}`, card.display_title || card.title || card.overview || `Scene ${index + 1}`, Number(card.time_interval?.start_ms) / 1000, Number(card.time_interval?.end_ms) / 1000, "scene interval")).filter((row): row is TimedItem => Boolean(row));
  }
  if (panelName === "Search") return [...continuityRows(panelName, data), ...(data.contentSearch?.search_index_records || []).map((row, index) => timed(row.index_id || `search:${index}`, row.canonical_name, row.start_time, row.end_time, `${row.entity_type} · ${row.maturity_summary.highest_maturity}`)).filter((row): row is TimedItem => Boolean(row))];
  if (panelName === "Meaning / Plot") {
    const mentions = (data.entityRegistry?.entities || []).flatMap((entity) => entity.source_mentions.map((mention) => timed(`meaning:${entity.entity_id}:${mention.mention_id}`, entity.canonical_name, mention.start_time, mention.end_time, `${entity.entity_type} · ${mention.source_type}`)));
    return [...continuityRows(panelName, data), ...mentions, ...masterRows(data, (row) => ["second_order", "scene_card", "organization", "place"].includes(row.category))].filter((row): row is TimedItem => Boolean(row));
  }
  if (panelName === "Narrative Agent") return [...continuityRows(panelName, data), ...masterRows(data, (row) => ["identity", "narrative_agent_profile", "character_role", "speaker_assignment", "narrative_agent_prosody"].includes(row.category))];
  if (["Master Schema", "Data Maturation", "Traceback"].includes(panelName)) return [...continuityRows(panelName, data), ...masterRows(data)];
  return [];
}

export default function PanelSourceClockConcordance({ componentName, category }: { componentName: string; category?: string }) {
  const panelName = category === "Identification" ? "Narrative Agent" : PANEL_NAMES[componentName];
  const [videoId, setVideoId] = useState(() => eventBus.getLast<string>("videoIdChanged") || "");
  const [cursor, setCursor] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [recognitionDraft, setRecognitionDraft] = useState<{
    id: string; label: string; start: number; end: number;
  } | null>(null);
  const [recognitionAgent, setRecognitionAgent] = useState("");
  const [recognitionBusy, setRecognitionBusy] = useState(false);
  const [recognitionMessage, setRecognitionMessage] = useState("");
  const [confirmedRecognitionIds, setConfirmedRecognitionIds] = useState<Set<string>>(() => new Set());
  const [confirmationReceipt, setConfirmationReceipt] = useState<{
    occurrenceId?: string; modality?: string; start?: number; end?: number; revision?: string;
  } | null>(null);

  useEffect(() => {
    const handler = (id: string) => setVideoId(id || "");
    eventBus.on("videoIdChanged", handler);
    return () => eventBus.off("videoIdChanged", handler);
  }, []);
  useEffect(() => {
    const handler = (publication: {
      analysisId?: string; occurrenceId?: string; modality?: string;
      sourceInterval?: { start?: number; end?: number }; state?: string; maturity?: string; revision?: string;
    }) => {
      if (publication.analysisId !== videoId || publication.state !== "confirmed") return;
      setConfirmationReceipt({
        occurrenceId: publication.occurrenceId,
        modality: publication.modality,
        start: publication.sourceInterval?.start,
        end: publication.sourceInterval?.end,
        revision: publication.revision,
      });
    };
    eventBus.on("confirmationNavigationUpdated", handler);
    return () => eventBus.off("confirmationNavigationUpdated", handler);
  }, [videoId]);
  useEffect(() => {
    setCursor(null);
    if (!videoId || !panelName) return;
    return subscribeSourceTime(videoId, setCursor);
  }, [panelName, videoId]);
  useEffect(() => {
    let cancelled = false;
    setAnalysis(null);
    if (!videoId || !panelName) return;
    void VideoService.getAnalysis(videoId).then((next) => { if (!cancelled) setAnalysis(next); }).catch(() => { if (!cancelled) setAnalysis(null); });
    return () => { cancelled = true; };
  }, [panelName, videoId]);

  const rows = useMemo(() => panelName && analysis ? rowsForPanel(panelName, analysis) : [], [analysis, panelName]);
  const concordance = useMemo(() => cursor === null ? null : sourceClockConcordance(rows, cursor, (row) => ({ start: row.start, end: row.end })), [cursor, rows]);
  if (!panelName || !concordance || !videoId) return null;
  const aggregateOnly = (panelName === "POS" || panelName === "StatsKit") && rows.length === 0;
  const transcriptAtCursor = panelName === "POS" && cursor !== null
    ? (analysis?.transcriptTimeline || analysis?.transcript || []).find((segment) =>
        Boolean(String(segment.text || "").trim()) &&
        cursor >= Number(segment.start) && cursor <= Number(segment.end),
      )
    : null;
  const posLinkageGap = panelName === "POS" && Boolean(transcriptAtCursor) && concordance.on_beat.length === 0;
  const recognitionAgentLabels = governedNarrativeAgentLabels(analysis);
  const selectedKnownAgent = recognitionAgentLabels.find(
    (label) => label.localeCompare(recognitionAgent.trim(), undefined, { sensitivity: "base" }) === 0,
  ) || "";

  const confirmAudioRecognition = async () => {
    if (!recognitionDraft || !recognitionAgent.trim() || !analysis?.projectId) {
      setRecognitionMessage("Select or enter a Narrative Agent before confirming this source input.");
      return;
    }
    setRecognitionBusy(true);
    setRecognitionMessage("");
    try {
      const result = await apiService.confirmNarrativeAgentContinuityEvidence(analysis.projectId, {
        evidence_id: `continuity-ui-${crypto.randomUUID()}`,
        analysis_id: videoId,
        agent: recognitionAgent.trim(),
        modality: "audio",
        start_seconds: recognitionDraft.start,
        end_seconds: recognitionDraft.end,
        source_ref: recognitionDraft.id,
        note: `Confirmed from Audio on-beat detection: ${recognitionDraft.label}`,
        created_by: "datascene_analyst",
      }) as {
        evidence_id?: string;
        duplicate_of?: string;
        status?: string;
        maturity?: string;
        continuity_projection?: Record<string, unknown>;
      };
      const receipt = result.evidence_id || result.duplicate_of;
      setRecognitionMessage(
        `${result.status === "unchanged" ? "Source confirmation already committed" : "Source confirmation committed"}` +
        `${receipt ? ` · ${receipt}` : ""}. Mature Master Schema data proliferated to all associated panels.`,
      );
      const confirmedDetectionId = recognitionDraft.id;
      setConfirmedRecognitionIds((current) => new Set(current).add(confirmedDetectionId));
      if (result.continuity_projection) {
        setAnalysis((current) => current ? {
          ...current,
          narrativeAgentContinuityProjection: result.continuity_projection,
        } : current);
      }
      setRecognitionDraft(null);
      const publication = {
        analysisId: videoId,
        evidenceId: receipt,
        modality: "audio",
        maturity: "mature",
        revision: String(result.continuity_projection?.revision || ""),
      };
      eventBus.emit("analysisCorrectionsChanged", publication);
      eventBus.emit("narrativeAgentContinuityUpdated", publication);
      eventBus.emit("matureDataProliferated", publication);
    } catch (error) {
      setRecognitionMessage(error instanceof Error ? error.message : "Audio recognition confirmation failed.");
    } finally {
      setRecognitionBusy(false);
    }
  };
  const isMatureAudioRecognition = (hit: { item: ConcordanceDisplayItem; start_seconds: number; end_seconds: number }) => {
    if (confirmedRecognitionIds.has(hit.item.id)) return true;
    const projection = analysis?.narrativeAgentContinuityProjection as any;
    if (projection?.canonical_collection?.maturity !== "mature_governed_agent_track") return false;
    return (projection?.canonical_collection?.members || []).some((member: any) =>
      member?.evidence_modality === "audio" &&
      Math.abs(Number(member?.source_interval?.start) - hit.start_seconds) <= 0.05 &&
      Math.abs(Number(member?.source_interval?.end) - hit.end_seconds) <= 0.05,
    );
  };
  return (
    <div data-panel-source-clock-concordance={panelName} className="shrink-0 px-2 pt-2">
      {confirmationReceipt ? <button type="button" onClick={() => publishSourceTime(videoId, Number(confirmationReceipt.start || 0))} className="mb-2 w-full rounded border border-slate-600 bg-slate-800/60 px-2 py-1.5 text-left text-[10px] text-slate-200" data-vaa1-shared-confirmation-navigation-receipt="true">
        Confirmed ✓ · mature {confirmationReceipt.modality || "source"} · {Number(confirmationReceipt.start || 0).toFixed(3)}–{Number(confirmationReceipt.end ?? confirmationReceipt.start ?? 0).toFixed(3)}{confirmationReceipt.revision ? ` · revision ${confirmationReceipt.revision.slice(0, 8)}` : ""}
      </button> : null}
      {aggregateOnly ? <div className="mb-2 rounded border border-slate-800 bg-slate-950/30 px-2 py-1.5 text-[10px] text-slate-400">No source-timed {panelName} evidence at this beat. Current results are aggregate-only and are not promoted into clock hits.</div> : null}
      {posLinkageGap ? <div role="status" data-pos-source-linkage-gap="true" className="mb-2 rounded border border-amber-700/60 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-100">Transcript text exists at this beat, but no governed POS occurrence maps to it. This is a POS–Transcript linkage gap, not evidence that linguistic data is absent.</div> : null}
      <SourceClockConcordanceRail
        modality={panelName}
        concordance={concordance}
        onNavigate={(timestamp) => publishSourceTime(videoId, timestamp)}
        onRecognize={panelName === "Audio" ? (hit) => {
          publishSourceTime(videoId, hit.start_seconds);
          setRecognitionDraft({
            id: hit.item.id,
            label: hit.item.label,
            start: hit.start_seconds,
            end: hit.end_seconds,
          });
          setRecognitionMessage("");
        } : undefined}
        isRecognized={panelName === "Audio" ? isMatureAudioRecognition : undefined}
      />
      {panelName === "Audio" && recognitionDraft ? (
        <div className="mb-2 rounded border border-cyan-700/60 bg-cyan-950/20 p-2" data-audio-inline-recognition-review="true">
          <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-100">Audio recognition review</div>
          <div className="mt-1 text-[10px] text-slate-300">
            {recognitionDraft.label} · {recognitionDraft.start.toFixed(3)}–{recognitionDraft.end.toFixed(3)}
          </div>
          <div className="mt-2 grid gap-1.5">
            <select
              value={selectedKnownAgent}
              onChange={(event) => setRecognitionAgent(event.target.value)}
              aria-label="Known Narrative Agent for audio recognition"
              className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
            >
              <option value="">Select a known Narrative Agent…</option>
              {recognitionAgentLabels.map((label) => <option key={label.toLocaleLowerCase()} value={label}>{label}</option>)}
            </select>
            <input
              value={recognitionAgent}
              onChange={(event) => setRecognitionAgent(event.target.value)}
              aria-label="Narrative Agent identity for audio recognition"
              placeholder="Or enter a new Narrative Agent"
              className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
            />
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={recognitionBusy || !recognitionAgent.trim()} onClick={() => void confirmAudioRecognition()} className="rounded border border-cyan-700 px-2 py-1 text-[10px] text-cyan-100">
                {recognitionBusy ? "Saving…" : "Confirm source input"}
              </button>
              <button type="button" disabled={recognitionBusy} onClick={() => setRecognitionDraft(null)} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300">Cancel</button>
            </div>
          </div>
          <div className="mt-1.5 text-[9px] text-slate-500">The detection supports review; it does not establish identity or continuity membership.</div>
        </div>
      ) : null}
      {panelName === "Audio" && recognitionMessage ? <div role="status" className="mb-2 rounded border border-slate-800 px-2 py-1.5 text-[10px] text-slate-300">{recognitionMessage}</div> : null}
    </div>
  );
}
