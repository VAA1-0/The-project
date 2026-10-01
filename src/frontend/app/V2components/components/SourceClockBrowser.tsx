"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import {
  formatPreciseSourceTime,
  parsePreciseSourceTime,
  type SourceClockContext,
} from "@/lib/source-clock";
import {
  getActiveSourceClockContext,
  publishSourceTime,
  subscribeSourceTime,
} from "@/lib/source-clock-events";

function activeAnalysisId(): string {
  return (
    eventBus.getLast<string>("videoIdChanged") ||
    eventBus.getLast<string>("activeAnalysisContext") ||
    ""
  );
}

/** Shared analyst-facing cursor and browser for every workspace panel. */
export default function SourceClockBrowser() {
  const [analysisId, setAnalysisId] = useState(activeAnalysisId);
  const [context, setContext] = useState<SourceClockContext | null>(
    getActiveSourceClockContext,
  );
  const [cursor, setCursor] = useState(0);
  const [draft, setDraft] = useState(() => formatPreciseSourceTime(0));
  const [message, setMessage] = useState("");
  const editing = useRef(false);

  useEffect(() => {
    const selectionChanged = () => {
      const id = activeAnalysisId();
      setAnalysisId(id);
      setContext(getActiveSourceClockContext());
      setMessage("");
    };
    const contextChanged = (next: SourceClockContext | null) => {
      setContext(next?.analysis_id === activeAnalysisId() ? next : null);
    };
    eventBus.on("videoIdChanged", selectionChanged);
    eventBus.on("activeAnalysisContext", selectionChanged);
    eventBus.on("sourceClockContextChanged", contextChanged);
    return () => {
      eventBus.off("videoIdChanged", selectionChanged);
      eventBus.off("activeAnalysisContext", selectionChanged);
      eventBus.off("sourceClockContextChanged", contextChanged);
    };
  }, []);

  useEffect(() => {
    if (!analysisId) return;
    return subscribeSourceTime(analysisId, (time) => {
      setCursor(time);
      if (!editing.current) setDraft(formatPreciseSourceTime(time));
      setMessage("");
    });
  }, [analysisId]);

  const browse = (event: FormEvent) => {
    event.preventDefault();
    const time = parsePreciseSourceTime(draft);
    const duration = context?.timebase?.duration_seconds;
    if (time === null) {
      setMessage("Use M:SS.mmm or H:MM:SS.mmm");
      return;
    }
    if (duration != null && time > duration) {
      setMessage(`Outside source (${formatPreciseSourceTime(duration)})`);
      return;
    }
    if (!analysisId || context?.binding_status !== "content_bound") {
      setMessage("Source clock unavailable");
      return;
    }
    if (!publishSourceTime(analysisId, time)) {
      setMessage("Clock changed; retry after verification");
      return;
    }
    setCursor(time);
    setDraft(formatPreciseSourceTime(time));
  };

  const duration = context?.timebase?.duration_seconds;
  const bound = context?.binding_status === "content_bound";

  return (
    <form
      onSubmit={browse}
      data-source-clock-browser="true"
      className="flex min-h-9 shrink-0 items-center gap-2 border-b border-cyan-950/60 bg-[#101719] px-2 py-1 text-[10px] text-slate-300"
      title={context?.clock_revision || "Canonical source clock"}
    >
      <span className="shrink-0 uppercase tracking-[0.14em] text-cyan-300/80">
        Source clock
      </span>
      <input
        aria-label="Browse source time"
        value={draft}
        disabled={!bound}
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={() => {
          editing.current = false;
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage("");
        }}
        className="w-[9.5rem] rounded border border-cyan-900/70 bg-black/30 px-2 py-1 font-mono text-xs tabular-nums text-cyan-50 outline-none focus:border-cyan-500 disabled:opacity-50"
        placeholder="0:00.000"
      />
      <button
        type="submit"
        disabled={!bound}
        className="rounded border border-cyan-800/70 px-2 py-1 uppercase tracking-wide text-cyan-100 hover:bg-cyan-950/60 disabled:opacity-40"
      >
        Go
      </button>
      <span data-source-clock-cursor="true" className="font-mono tabular-nums text-slate-400">
        {formatPreciseSourceTime(cursor)}
        {duration != null ? ` / ${formatPreciseSourceTime(duration)}` : ""}
      </span>
      <span className={`ml-auto truncate ${message ? "text-amber-300" : "text-slate-500"}`}>
        {message || (bound ? "global · revision bound" : analysisId ? "verifying…" : "no source")}
      </span>
    </form>
  );
}
