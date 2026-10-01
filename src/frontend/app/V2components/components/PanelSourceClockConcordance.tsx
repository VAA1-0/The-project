"use client";

import React, { useEffect, useMemo, useState } from "react";
import { VideoService, type AnalysisData } from "@/lib/video-service";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
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

function rowsForPanel(panelName: string, data: AnalysisData): TimedItem[] {
  if (panelName === "Transcript") return (data.transcriptTimeline || data.transcript || []).map((row, index) => timed(`transcript:${index}`, row.text, row.start, row.end, row.speaker)).filter((row): row is TimedItem => Boolean(row));
  if (panelName === "Audio") {
    const prosody = (data.audioProsody || []).map((row, index) => timed(row.cue_id || `prosody:${index}`, row.text || row.rhythm_profile?.label || "Audio prosody", row.start, row.end, "audio prosody"));
    const events = (data.metadata?.audioEventIntervals?.intervals || []).map((row, index) => timed(row.event_id || `audio-event:${index}`, row.event_type || "Audio event", row.start, row.end, "audio event"));
    const turns = ((data.audioDiarization as any)?.speaker_turns || []).map((row: any, index: number) => timed(`speaker-turn:${index}`, row.speaker || row.speaker_label || "Speaker turn", row.start, row.end, "speaker diarization"));
    return [...prosody, ...events, ...turns].filter((row): row is TimedItem => Boolean(row));
  }
  if (panelName === "Objects") return (data.detectedObjects || []).map((row, index) => timed(`object:${index}`, row.displayLabel || row.class_name, row.startTimestamp ?? row.timestamp, row.endTimestamp, `${Math.round(Number(row.confidence || 0) * 100)}% confidence`)).filter((row): row is TimedItem => Boolean(row));
  if (panelName === "OCR") return (data.ocr || []).map((row, index) => timed(`ocr:${index}`, row.text, row.timestamp, undefined, `${Math.round(Number(row.confidence || 0) * 100)}% confidence`)).filter((row): row is TimedItem => Boolean(row));
  if (panelName === "POS") return posRows(data);
  if (panelName === "Quant" || panelName === "StatsKit") return quantRows(data);
  if (panelName === "Scene Cards") {
    const cards = ((data.miseEnSceneSceneCards as any)?.scene_cards || []) as any[];
    return cards.map((card, index) => timed(card.scene_id || `scene:${index}`, card.display_title || card.title || card.overview || `Scene ${index + 1}`, Number(card.time_interval?.start_ms) / 1000, Number(card.time_interval?.end_ms) / 1000, "scene interval")).filter((row): row is TimedItem => Boolean(row));
  }
  if (panelName === "Search") return (data.contentSearch?.search_index_records || []).map((row, index) => timed(row.index_id || `search:${index}`, row.canonical_name, row.start_time, row.end_time, `${row.entity_type} · ${row.maturity_summary.highest_maturity}`)).filter((row): row is TimedItem => Boolean(row));
  if (panelName === "Meaning / Plot") {
    const mentions = (data.entityRegistry?.entities || []).flatMap((entity) => entity.source_mentions.map((mention) => timed(`meaning:${entity.entity_id}:${mention.mention_id}`, entity.canonical_name, mention.start_time, mention.end_time, `${entity.entity_type} · ${mention.source_type}`)));
    return [...mentions, ...masterRows(data, (row) => ["second_order", "scene_card", "organization", "place"].includes(row.category))].filter((row): row is TimedItem => Boolean(row));
  }
  if (panelName === "Narrative Agent") return masterRows(data, (row) => ["identity", "narrative_agent_profile", "character_role", "speaker_assignment", "narrative_agent_prosody"].includes(row.category));
  if (["Master Schema", "Data Maturation", "Traceback"].includes(panelName)) return masterRows(data);
  return [];
}

export default function PanelSourceClockConcordance({ componentName, category }: { componentName: string; category?: string }) {
  const panelName = category === "Identification" ? "Narrative Agent" : PANEL_NAMES[componentName];
  const [videoId, setVideoId] = useState(() => eventBus.getLast<string>("videoIdChanged") || "");
  const [cursor, setCursor] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);

  useEffect(() => {
    const handler = (id: string) => setVideoId(id || "");
    eventBus.on("videoIdChanged", handler);
    return () => eventBus.off("videoIdChanged", handler);
  }, []);
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
  return (
    <div data-panel-source-clock-concordance={panelName} className="shrink-0 px-2 pt-2">
      {aggregateOnly ? <div className="mb-2 rounded border border-slate-800 bg-slate-950/30 px-2 py-1.5 text-[10px] text-slate-400">No source-timed {panelName} evidence at this beat. Current results are aggregate-only and are not promoted into clock hits.</div> : null}
      {posLinkageGap ? <div role="status" data-pos-source-linkage-gap="true" className="mb-2 rounded border border-amber-700/60 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-100">Transcript text exists at this beat, but no governed POS occurrence maps to it. This is a POS–Transcript linkage gap, not evidence that linguistic data is absent.</div> : null}
      <SourceClockConcordanceRail modality={panelName} concordance={concordance} onNavigate={(timestamp) => publishSourceTime(videoId, timestamp)} />
    </div>
  );
}
