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
  source_ref: string;
  start_seconds: number;
  end_seconds: number;
  timing_status: SourceClockTimingStatus;
  precision_seconds?: number;
  revision_ref?: string;
};

export function sourceClockStatusForAuthority(authority: string): SourceClockTimingStatus {
  const normalized = String(authority || "").toLowerCase();
  if (/manual|explicit|user/.test(normalized)) return "explicit_user_correction";
  if (/verified|confirmed|governed/.test(normalized)) return "anchor_verified";
  if (/measured|source/.test(normalized)) return "source_measured";
  if (/candidate|detect|scanner|model/.test(normalized)) return "candidate";
  if (/degraded|synthetic|estimated/.test(normalized)) return "degraded";
  return "unknown";
}

export function formatPreciseSourceTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00.000";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.floor((value - Math.floor(value)) * 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

export function parsePreciseSourceTime(value: string): number | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  const seconds = Number(parts.pop());
  const minutes = parts.length ? Number(parts.pop()) : 0;
  const hours = parts.length ? Number(parts.pop()) : 0;
  if (![seconds, minutes, hours].every(Number.isFinite) || seconds < 0 || minutes < 0 || hours < 0) return null;
  return hours * 3600 + minutes * 60 + seconds;
}
