"use client";

import React, { useState } from "react";

export function SourceLinkedClusterThumbnail({ cropUrl, label, sourceTimeLabel, state, reviewSize = false, onOpen }: {
  cropUrl: string;
  label: string;
  sourceTimeLabel: string;
  state: "mature" | "candidate" | "selected";
  reviewSize?: boolean;
  onOpen: () => void;
}) {
  const [isInspecting, setIsInspecting] = useState(false);
  return <div className={`group relative shrink-0 ${reviewSize ? "h-16 w-16" : "h-14 w-14"}`} data-vaa1-source-linked-cluster-thumbnail-shell="true">
    <button type="button" className={`group relative overflow-hidden rounded border bg-black text-left ${reviewSize ? "h-16 w-16" : "h-14 w-14"} ${state === "mature" ? "border-emerald-700/70" : state === "selected" ? "border-cyan-300 ring-1 ring-cyan-400/60" : "border-slate-700 hover:border-cyan-700"}`} title={`${label} · ${sourceTimeLabel} · open source`} aria-label={`Open ${label} at ${sourceTimeLabel}`} onClick={onOpen} data-vaa1-source-linked-cluster-thumbnail="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cropUrl} alt="" loading="lazy" decoding="async" className="pointer-events-none h-full w-full object-cover" data-vaa1-source-linked-jpeg-crop="true" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/80 px-1 py-0.5 text-[8px] text-slate-100">{sourceTimeLabel}</span>
      {state === "mature" ? <span className="pointer-events-none absolute right-0.5 top-0.5 rounded bg-emerald-900/90 px-1 text-[8px] text-emerald-100">mature</span> : null}
    </button>
    <button type="button" className="absolute bottom-3.5 right-0.5 rounded bg-black/75 px-1 text-[9px] text-slate-200 opacity-0 transition-opacity hover:bg-slate-800 group-hover:opacity-100 focus:opacity-100" aria-label={`Inspect larger still for ${label} at ${sourceTimeLabel}`} title="Inspect larger still" onClick={(event) => { event.stopPropagation(); setIsInspecting(true); }} data-vaa1-source-linked-cluster-thumbnail-inspect="true">⤢</button>
    {isInspecting ? <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/70 p-6" role="dialog" aria-modal="true" aria-label={`${label} source still`} onClick={() => setIsInspecting(false)} data-vaa1-source-linked-cluster-thumbnail-lightbox="true">
      <div className="w-[min(420px,90vw)] rounded border border-slate-600 bg-[#111] p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cropUrl} alt={`${label} at ${sourceTimeLabel}`} className="max-h-[65vh] w-full rounded bg-black object-contain" />
        <div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[11px] text-slate-200">{label} · {sourceTimeLabel}</span><div className="flex gap-1"><button type="button" className="rounded border border-cyan-800 px-2 py-1 text-[10px] text-cyan-100" onClick={() => { setIsInspecting(false); onOpen(); }}>Open in video</button><button type="button" className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300" onClick={() => setIsInspecting(false)}>Close</button></div></div>
      </div>
    </div> : null}
  </div>;
}
