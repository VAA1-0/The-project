"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  formatPreciseSourceTime,
  type SourceClockConcordance,
  type SourceClockConcordanceHit,
} from "@/lib/source-clock";

export type ConcordanceDisplayItem = {
  id: string;
  label: string;
  detail?: string;
};

type Lane = "before" | "on-beat" | "after";

function hitCard(
  lane: Lane,
  hit: SourceClockConcordanceHit<ConcordanceDisplayItem> | null,
  cursor: number,
) {
  const laneLabel = lane === "on-beat" ? "On beat" : lane === "before" ? "Before" : "After";
  if (!hit) {
    return (
      <div
        data-source-clock-concordance-lane={lane}
        className="min-w-0 rounded border border-slate-800 bg-black/20 px-2.5 py-2 text-slate-500"
      >
        <div className="text-[9px] uppercase tracking-[0.14em]">{laneLabel}</div>
        <div className="mt-1 text-[11px]">
          {lane === "on-beat" ? `No detection at ${formatPreciseSourceTime(cursor)}` : `No ${lane} detection`}
        </div>
      </div>
    );
  }
  return (
    <div
      data-source-clock-concordance-lane={lane}
      className={`min-w-0 rounded border px-2.5 py-2 ${
        lane === "on-beat"
          ? "border-cyan-400/55 bg-cyan-950/20 text-cyan-50"
          : lane === "before"
            ? "border-violet-500/35 bg-violet-950/10 text-violet-100"
            : "border-amber-500/35 bg-amber-950/10 text-amber-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.14em] opacity-75">
        <span>{laneLabel}</span>
        <span className="font-mono normal-case tracking-normal">
          {formatPreciseSourceTime(hit.start_seconds)}
        </span>
      </div>
      <div className="mt-1 truncate text-[11px] font-medium" title={hit.item.label}>{hit.item.label}</div>
      {hit.item.detail ? <div className="mt-0.5 truncate text-[10px] opacity-70">{hit.item.detail}</div> : null}
      {lane !== "on-beat" ? (
        <div className="mt-1 text-[9px] opacity-65">{hit.distance_seconds.toFixed(3)}s from beat</div>
      ) : null}
    </div>
  );
}

function onBeatCard(
  hits: Array<SourceClockConcordanceHit<ConcordanceDisplayItem>>,
  cursor: number,
) {
  if (!hits.length) return hitCard("on-beat", null, cursor);
  return (
    <div
      data-source-clock-concordance-lane="on-beat"
      className="min-w-0 rounded border border-cyan-400/55 bg-cyan-950/20 px-2.5 py-2 text-cyan-50"
    >
      <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.14em] text-cyan-100/75">
        <span>On beat · {hits.length} detection{hits.length === 1 ? "" : "s"}</span>
        <span className="font-mono normal-case tracking-normal">{formatPreciseSourceTime(cursor)}</span>
      </div>
      <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto pr-1" data-source-clock-on-beat-list="true">
        {hits.map((hit) => (
          <div key={`${hit.item.id}:${hit.index}`} data-source-clock-on-beat-detection={hit.item.id} className="rounded border border-cyan-900/60 bg-black/20 px-2 py-1.5">
            <div className="text-[11px] font-medium">{hit.item.label}</div>
            {hit.item.detail ? <div className="mt-0.5 text-[10px] text-cyan-100/60">{hit.item.detail}</div> : null}
            <div className="mt-0.5 font-mono text-[9px] text-cyan-200/50">
              {formatPreciseSourceTime(hit.start_seconds)}
              {hit.end_seconds !== hit.start_seconds ? `–${formatPreciseSourceTime(hit.end_seconds)}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SourceClockConcordanceRail({
  modality,
  concordance,
  onNavigate,
}: {
  modality: string;
  concordance: SourceClockConcordance<ConcordanceDisplayItem>;
  onNavigate?: (timestamp: number) => void;
}) {
  const [lane, setLane] = useState<Lane>("on-beat");
  const [showConcordance, setShowConcordance] = useState(false);
  const primaryOnBeat = concordance.on_beat[0] || null;
  const sequence = useMemo(() => [
    concordance.before ? "before" as const : null,
    "on-beat" as const,
    concordance.after ? "after" as const : null,
  ].filter((value): value is Lane => value !== null), [concordance.after, concordance.before]);

  useEffect(() => {
    setLane("on-beat");
    setShowConcordance(false);
  }, [concordance.cursor_seconds]);

  const move = (direction: -1 | 1) => {
    const current = sequence.indexOf(lane);
    const next = Math.max(0, Math.min(sequence.length - 1, current + direction));
    const nextLane = sequence[next];
    setLane(nextLane);
    setShowConcordance(false);
    const nextHit = nextLane === "before"
      ? concordance.before
      : nextLane === "after"
        ? concordance.after
        : primaryOnBeat;
    if (nextHit) onNavigate?.(nextHit.start_seconds);
  };
  const activeHit = lane === "before"
    ? concordance.before
    : lane === "after"
      ? concordance.after
      : primaryOnBeat;

  return (
    <section
      data-source-clock-concordance="true"
      data-source-clock-modality={modality}
      className="mb-2 shrink-0 rounded border border-cyan-950/70 bg-[#0d1214] px-2 py-2 text-slate-200"
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-[10px] uppercase tracking-[0.14em] text-cyan-200/80">
          {modality} · {formatPreciseSourceTime(concordance.cursor_seconds)}
        </div>
        <button
          type="button"
          aria-label={`Previous ${modality} evidence`}
          disabled={sequence.indexOf(lane) <= 0}
          onClick={() => move(-1)}
          className="rounded-full border border-slate-700 p-1 text-slate-300 transition hover:border-violet-400 hover:text-violet-100 disabled:opacity-25"
        >
          <ChevronLeft className="size-3" />
        </button>
        <button
          type="button"
          aria-label={`Next ${modality} evidence`}
          disabled={sequence.indexOf(lane) >= sequence.length - 1}
          onClick={() => move(1)}
          className="rounded-full border border-slate-700 p-1 text-slate-300 transition hover:border-amber-400 hover:text-amber-100 disabled:opacity-25"
        >
          <ChevronRight className="size-3" />
        </button>
        <button
          type="button"
          aria-pressed={showConcordance}
          onClick={() => setShowConcordance((value) => !value)}
          className="rounded border border-cyan-800/70 px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-cyan-100 hover:bg-cyan-950/40"
        >
          Concordance
        </button>
      </div>
      {showConcordance ? (
        <div data-source-clock-concordance-frame="true" className="grid grid-cols-3 gap-2">
          {hitCard("before", concordance.before, concordance.cursor_seconds)}
          {onBeatCard(concordance.on_beat, concordance.cursor_seconds)}
          {hitCard("after", concordance.after, concordance.cursor_seconds)}
        </div>
      ) : (
        <div data-source-clock-concordance-primary={lane}>
          {lane === "on-beat"
            ? onBeatCard(concordance.on_beat, concordance.cursor_seconds)
            : hitCard(lane, activeHit, concordance.cursor_seconds)}
        </div>
      )}
    </section>
  );
}
