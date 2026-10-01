import { CANONICAL_SOURCE_CLOCK_ID, sourceSeconds, type SourceClockContext } from "@/lib/source-clock";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";

export type SourceClockNavigationTicket = {
  analysis_id: string;
  selection_epoch: number;
  clock_revision: string | null;
  source_fingerprint: string | null;
};
export type SourceClockTimeEvent = SourceClockNavigationTicket & {
  clock_id: typeof CANONICAL_SOURCE_CLOCK_ID;
  timestamp_seconds: number;
  binding_status: "content_bound" | "source_unavailable";
};

type ClockLoader = (id: string) => Promise<SourceClockContext>;
let loader: ClockLoader | null = null;
let selected = "";
let epoch = 0;
let request = 0;
let context: SourceClockContext | null = null;
let pending: { ticket: SourceClockNavigationTicket; time: number } | null = null;
let installed = false;

function activeId(): string {
  const videoId = eventBus.getLast<string>("videoIdChanged");
  const analysisId = eventBus.getLast<string>("activeAnalysisContext");
  return (typeof videoId === "string" && videoId.trim()) ||
    (typeof analysisId === "string" && analysisId.trim()) || "";
}
function selectionChanged() {
  const id = activeId();
  if (selected === id) return;
  selected = id;
  epoch += 1;
  context = null;
  pending = null;
  request += 1;
  eventBus.emit("sourceClockContextChanged", null);
  void refreshSourceClock();
}
function install() {
  if (installed) return;
  installed = true;
  eventBus.on("videoIdChanged", selectionChanged);
  eventBus.on("activeAnalysisContext", selectionChanged);
  const refresh = (payload: any) => {
    const id = typeof payload === "string" ? payload : payload?.analysisId || payload?.videoId;
    if (id === selected) {
      // Invalidate immediately, before any asynchronous verification can finish.
      epoch += 1;
      context = null;
      pending = null;
      eventBus.emit("sourceClockContextChanged", null);
      void refreshSourceClock();
    }
  };
  eventBus.on("analysisCorrectionsChanged", refresh);
  eventBus.on("sourceMediaMetadataChanged", refresh);
  selectionChanged();
}

/** Installed by the workspace. No source bytes or corrections are changed. */
export function startSourceClockSession(readClock: ClockLoader): () => void {
  loader = readClock;
  install();
  void refreshSourceClock();
  return () => {
    loader = null;
    request += 1;
    epoch += 1;
    context = null;
    pending = null;
  };
}

export async function refreshSourceClock(): Promise<void> {
  if (!loader || !selected) return;
  const id = selected;
  const ticket = ++request;
  try {
    const next = await loader(id);
    if (ticket !== request || selected !== id) return;
    if (next.analysis_id !== id || next.clock_id !== CANONICAL_SOURCE_CLOCK_ID ||
        !["content_bound", "source_unavailable"].includes(next.binding_status) ||
        (next.binding_status === "content_bound" && (!next.clock_revision || !next.source_fingerprint))) {
      throw new Error("Invalid source clock response");
    }
    if (context && (context.clock_revision !== next.clock_revision || context.source_fingerprint !== next.source_fingerprint)) {
      epoch += 1;
      pending = null;
    }
    context = next;
    eventBus.emit("sourceClockContextChanged", next);
    if (next.binding_status !== "content_bound") {
      pending = null;
      eventBus.emit("sourceClockNavigationUnavailable", {
        analysis_id: id,
        message: "Source media is unavailable; timing navigation is paused",
      });
      return;
    }
    const queued = pending;
    pending = null;
    if (queued && queued.ticket.selection_epoch === epoch && queued.ticket.analysis_id === selected) {
      publishSourceTime(id, queued.time, captureSourceClockNavigation(id));
    }
  } catch (error) {
    if (ticket !== request || selected !== id) return;
    context = null;
    pending = null;
    eventBus.emit("sourceClockNavigationUnavailable", { analysis_id: id, message: String(error) });
  }
}

/** Capture before scheduling work; an A → B → A switch invalidates this ticket. */
export function captureSourceClockNavigation(analysisId: string): SourceClockNavigationTicket {
  install();
  selectionChanged();
  return { analysis_id: analysisId, selection_epoch: epoch,
    clock_revision: context?.clock_revision ?? null, source_fingerprint: context?.source_fingerprint ?? null };
}
export function isCurrentSourceClockNavigation(ticket: SourceClockNavigationTicket): boolean {
  return ticket.analysis_id === selected && selected === activeId() && ticket.selection_epoch === epoch &&
    ticket.clock_revision === (context?.clock_revision ?? null) &&
    ticket.source_fingerprint === (context?.source_fingerprint ?? null);
}
export function isCurrentSourceTime(event: SourceClockTimeEvent, analysisId: string): boolean {
  return context?.binding_status === "content_bound" && event?.clock_id === CANONICAL_SOURCE_CLOCK_ID && event.analysis_id === analysisId &&
    event.binding_status === context.binding_status && sourceSeconds(event.timestamp_seconds) !== null &&
    isCurrentSourceClockNavigation(event);
}
export function subscribeSourceTime(analysisId: string, receive: (time: number, event: SourceClockTimeEvent) => void): () => void {
  install();
  const listener = (event: SourceClockTimeEvent) => {
    if (isCurrentSourceTime(event, analysisId)) receive(event.timestamp_seconds, event);
  };
  eventBus.on("sourceClockTimeChanged", listener);
  const previous = eventBus.getLast<SourceClockTimeEvent>("sourceClockTimeChanged");
  if (previous) listener(previous);
  return () => eventBus.off("sourceClockTimeChanged", listener);
}

/** Consumers receive the complete identity; unscoped numeric events are not forwarded. */
export function publishSourceTime(analysisId: string | null | undefined, time: unknown, captured?: SourceClockNavigationTicket): boolean {
  install();
  selectionChanged();
  const timestamp = sourceSeconds(time);
  if (!analysisId || analysisId !== selected || timestamp === null) return false;
  const ticket = captured ?? captureSourceClockNavigation(analysisId);
  if (!isCurrentSourceClockNavigation(ticket)) return false;
  if (!context) {
    pending = { ticket, time: timestamp };
    return false;
  }
  if (context.binding_status !== "content_bound") return false;
  const duration = context.timebase?.duration_seconds;
  if (duration != null && timestamp > duration) return false;
  const event: SourceClockTimeEvent = { ...ticket, clock_id: CANONICAL_SOURCE_CLOCK_ID,
    timestamp_seconds: timestamp, binding_status: context.binding_status };
  eventBus.emit("sourceClockTimeChanged", event);
  return isCurrentSourceTime(event, analysisId);
}

export function getActiveSourceClockContext(): SourceClockContext | null {
  return selected === activeId() ? context : null;
}
