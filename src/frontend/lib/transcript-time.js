function numberFromTranscriptTime(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const colonParts = trimmed.split(":");
  if (colonParts.length > 1 && colonParts.every((part) => part.trim() !== "")) {
    const parsedParts = colonParts.map((part) => Number(part));
    if (parsedParts.every(Number.isFinite)) {
      return parsedParts.reduce((total, part) => total * 60 + part, 0);
    }
  }
  const parsed = Number(trimmed.replace(/s$/i, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeTranscriptTimeSeconds(value) {
  const parsed = numberFromTranscriptTime(value);
  if (parsed === null) {
    return null;
  }
  return parsed > 1000 ? parsed / 1000 : parsed;
}

function transcriptTimeFromFields(segment, secondsKeys, millisecondsKeys) {
  for (const key of secondsKeys) {
    const value = normalizeTranscriptTimeSeconds(segment[key]);
    if (value !== null) {
      return value;
    }
  }
  for (const key of millisecondsKeys) {
    const value = numberFromTranscriptTime(segment[key]);
    if (value !== null) {
      return value / 1000;
    }
  }
  return null;
}

export function normalizeTranscriptSegmentTiming(segment) {
  const source = segment && typeof segment === "object" ? segment : {};
  const start =
    transcriptTimeFromFields(
      source,
      ["start_seconds", "start", "timestamp_seconds", "timestamp", "time_seconds", "time"],
      ["start_ms", "timestamp_ms", "time_ms"],
    ) ?? 0;
  const rawEnd = transcriptTimeFromFields(
    source,
    ["end_seconds", "end", "end_timestamp_seconds", "end_timestamp"],
    ["end_ms", "end_timestamp_ms"],
  );
  const end = rawEnd ?? start;
  const normalizedStart = Math.max(0, Math.min(start, end));
  const normalizedEnd = Math.max(normalizedStart, Math.max(start, end));
  return {
    t: `${normalizedStart.toFixed(1)}s`,
    start: normalizedStart,
    end: normalizedEnd,
  };
}

export function applyTranscriptClockOffset(segment, offsetSeconds) {
  const source = segment && typeof segment === "object" ? segment : {};
  const sourceStart = Number(source.sourceStart ?? source.start ?? 0);
  const sourceEnd = Number(source.sourceEnd ?? source.end ?? sourceStart);
  const offset = Number(offsetSeconds || 0);
  const start = Math.max(0, sourceStart + offset);
  const end = Math.max(start, sourceEnd + offset);
  return {
    ...source,
    t: `${start.toFixed(1)}s`,
    start,
    end,
    sourceStart,
    sourceEnd,
  };
}
