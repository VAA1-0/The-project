export const CANONICAL_SOURCE_CLOCK_ID = "source_media.clock" as const;

export type SourceClockTimingStatus =
  | "explicit_user_correction"
  | "anchor_verified"
  | "vad_anchor_verified"
  | "source_measured"
  | "candidate"
  | "inherited"
  | "degraded"
  | "unknown";

export type CanonicalSourceClockScope = {
  clock_id: typeof CANONICAL_SOURCE_CLOCK_ID;
  /** Owning analysis; source_ref may identify an evidence row. */
  analysis_id?: string;
  source_ref: string;
  /** Versioned evidence supplies both; legacy evidence leaves both absent. */
  source_fingerprint?: string;
  clock_revision?: string;
  start_seconds: number;
  end_seconds: number;
  timing_status: SourceClockTimingStatus;
  precision_seconds?: number;
  revision_ref?: string;
};

export type SourceClockContext = {
  clock_id: typeof CANONICAL_SOURCE_CLOCK_ID;
  analysis_id: string;
  binding_status: "content_bound" | "source_unavailable";
  source_fingerprint: string | null;
  clock_revision: string | null;
  timebase?: {
    contract: string;
    source_fingerprint: string;
    duration_seconds: number | null;
    fps: number | null;
    audio_sample_rate: number | null;
    frame_rate_mode?: "constant" | "variable" | "unknown";
    transcript_clock_offset_seconds: number;
  };
};

export function sourceClockStatusForAuthority(authority: string): SourceClockTimingStatus {
  const normalized = String(authority || "").toLowerCase();
  const canonicalStatuses: SourceClockTimingStatus[] = [
    "explicit_user_correction", "anchor_verified", "vad_anchor_verified",
    "source_measured", "candidate", "inherited", "degraded", "unknown",
  ];
  if (canonicalStatuses.includes(normalized as SourceClockTimingStatus)) {
    return normalized as SourceClockTimingStatus;
  }
  // Semantic acceptance does not verify a temporal boundary.
  if (/degraded|synthetic|estimated/.test(normalized)) return "degraded";
  if (/candidate|detect|scanner|model/.test(normalized)) return "candidate";
  return "unknown";
}

export function formatPreciseSourceTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00.000";
  const ticks = Math.round(value * 1000);
  const hours = Math.floor(ticks / 3600000);
  const minutes = Math.floor(ticks / 60000) % 60;
  const seconds = Math.floor(ticks / 1000) % 60;
  const milliseconds = ticks % 1000;
  const tail = `${String(minutes).padStart(hours ? 2 : 1, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  return hours ? `${hours}:${tail}` : tail;
}

export function parsePreciseSourceTime(value: string): number | null {
  const trimmed = String(value || "").trim();
  if (!/^\d+(?::\d+){0,2}(?:\.\d+)?$/.test(trimmed)) return null;
  const parts = trimmed.split(":");
  const count = parts.length;
  const seconds = Number(parts.pop());
  const minutes = parts.length ? Number(parts.pop()) : 0;
  const hours = parts.length ? Number(parts.pop()) : 0;
  if (![seconds, minutes, hours].every(Number.isFinite) || seconds < 0 || minutes < 0 || hours < 0) return null;
  if ((count > 1 && seconds >= 60) || (count === 3 && minutes >= 60)) return null;
  const result = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(result) ? result : null;
}

/** Numeric fields declare units through their names, never their magnitude. */
export function sourceSeconds(value: unknown, unit: "seconds" | "milliseconds" = "seconds"): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return unit === "milliseconds" ? numeric / 1000 : numeric;
}

export function sourceTimeBoundary(span: Record<string, unknown> | null | undefined, boundary: "start" | "end"): number | null {
  if (!span) return null;
  for (const key of [`${boundary}_seconds`, boundary, `${boundary}_ms`]) {
    if (span[key] !== undefined && span[key] !== null) {
      return sourceSeconds(span[key], key.endsWith("_ms") ? "milliseconds" : "seconds");
    }
  }
  return null;
}

export type SourceClockConcordanceHit<T> = {
  item: T;
  index: number;
  start_seconds: number;
  end_seconds: number;
  distance_seconds: number;
};

export type SourceClockConcordance<T> = {
  cursor_seconds: number;
  before: SourceClockConcordanceHit<T> | null;
  on_beat: SourceClockConcordanceHit<T>[];
  after: SourceClockConcordanceHit<T> | null;
};

/**
 * Resolve a modality's evidence around one canonical source beat without
 * interpolating evidence into a time where it is absent.
 *
 * Intervals are on-beat only when they contain the cursor. Point samples use
 * the declared tolerance. The closest prior and following records remain
 * separate contextual neighbors even when no on-beat record exists.
 */
export function sourceClockConcordance<T>(
  items: readonly T[],
  cursorSeconds: number,
  intervalFor: (item: T) => { start: unknown; end?: unknown } | null,
  toleranceSeconds = 0.001,
): SourceClockConcordance<T> {
  const cursor = sourceSeconds(cursorSeconds) ?? 0;
  const tolerance = Math.max(0, Number(toleranceSeconds) || 0);
  const normalized = items.flatMap((item, index) => {
    const interval = intervalFor(item);
    const start = sourceSeconds(interval?.start);
    const end = sourceSeconds(interval?.end ?? interval?.start);
    if (start === null || end === null) return [];
    return [{
      item,
      index,
      start_seconds: Math.min(start, end),
      end_seconds: Math.max(start, end),
    }];
  }).sort((left, right) =>
    left.start_seconds - right.start_seconds ||
    left.end_seconds - right.end_seconds ||
    left.index - right.index
  );
  const onBeat = normalized.filter((hit) =>
    cursor + tolerance >= hit.start_seconds &&
    cursor - tolerance <= hit.end_seconds
  ).map((hit) => ({ ...hit, distance_seconds: 0 }));
  const beforeCandidates = normalized.filter((hit) => hit.end_seconds < cursor - tolerance);
  const afterCandidates = normalized.filter((hit) => hit.start_seconds > cursor + tolerance);
  const before = beforeCandidates.length
    ? beforeCandidates.reduce((closest, hit) =>
        hit.end_seconds > closest.end_seconds ? hit : closest
      )
    : null;
  const after = afterCandidates.length
    ? afterCandidates.reduce((closest, hit) =>
        hit.start_seconds < closest.start_seconds ? hit : closest
      )
    : null;
  return {
    cursor_seconds: cursor,
    before: before ? { ...before, distance_seconds: cursor - before.end_seconds } : null,
    on_beat: onBeat,
    after: after ? { ...after, distance_seconds: after.start_seconds - cursor } : null,
  };
}

export type SourcePrecision = {
  fps?: number | null;
  audio_sample_rate?: number | null;
  frame_rate_mode?: "constant" | "variable" | "unknown";
  presentation_timestamps_seconds?: readonly number[];
};

/** Frame indexes are zero-based. VFR/unknown sources need measured presentation timestamps. */
export function sourceFrameSeconds(frame: unknown, metadata: SourcePrecision): number | null {
  if (typeof frame !== "number" || !Number.isSafeInteger(frame) || frame < 0) return null;
  const timestamps = metadata.presentation_timestamps_seconds;
  if (timestamps) {
    if (timestamps.some((time, index) => sourceSeconds(time) === null || (index > 0 && time <= timestamps[index - 1]))) return null;
    return sourceSeconds(timestamps[frame]);
  }
  const fps = sourceSeconds(metadata.fps);
  return metadata.frame_rate_mode === "constant" && fps && fps > 0 ? frame / fps : null;
}

export function sourceSampleSeconds(sample: unknown, metadata: SourcePrecision): number | null {
  const rate = sourceSeconds(metadata.audio_sample_rate);
  if (typeof sample !== "number" || !Number.isSafeInteger(sample) || sample < 0 || !rate || rate <= 0) return null;
  return sample / rate;
}

/** Display resolution is 1 ms; nominal FPS alone never establishes exact frame precision. */
export function sourcePrecision(metadata: SourcePrecision) {
  const fps = sourceSeconds(metadata.fps);
  const rate = sourceSeconds(metadata.audio_sample_rate);
  return {
    display_resolution_seconds: 0.001,
    frame_precision_seconds: metadata.frame_rate_mode === "constant" && fps ? 1 / fps : null,
    nominal_frame_duration_seconds: fps ? 1 / fps : null,
    sample_precision_seconds: rate ? 1 / rate : null,
    frame_rate_mode: metadata.frame_rate_mode ?? "unknown",
  };
}
