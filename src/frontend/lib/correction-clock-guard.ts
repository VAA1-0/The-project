export class CorrectionClockConflict extends Error {}

function offset(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) {
    throw new CorrectionClockConflict("Clock offset must be a finite number");
  }
  const result = Number(value);
  if (!Number.isFinite(result)) throw new CorrectionClockConflict("Clock offset must be a finite number");
  return result;
}

export interface CorrectionSourceBinding {
  analysis_id: string;
  binding_status: string;
  source_fingerprint: string | null;
  clock_revision: string | null;
  timebase?: { transcript_clock_offset_seconds: number };
}

export function correctionClockGuard(analysisId: string, corrections: any, context?: CorrectionSourceBinding) {
  const guard = { analysis_id: analysisId, correction_generation: corrections?.correction_generation ?? null, transcript_clock_offset_seconds: offset(corrections?.transcript_clock_offset_seconds) };
  if (!context) return guard;
  if (context.analysis_id !== analysisId) throw new CorrectionClockConflict("Clock binding belongs to another analysis");
  if (context.binding_status === "content_bound" && offset(context.timebase?.transcript_clock_offset_seconds) !== guard.transcript_clock_offset_seconds) {
    throw new CorrectionClockConflict("Correction snapshot and source clock disagree; reload before editing");
  }
  return { ...guard, binding_status: context.binding_status, source_fingerprint: context.source_fingerprint, clock_revision: context.clock_revision };
}

export function validateCorrectionSourceBinding(analysisId: string, incoming: any, context: CorrectionSourceBinding) {
  const guard = incoming?._clock_write_guard;
  if (!guard || (!("source_fingerprint" in guard) && !("clock_revision" in guard))) return;
  if (guard.analysis_id !== analysisId || context.analysis_id !== analysisId ||
      context.binding_status !== "content_bound" ||
      typeof guard.source_fingerprint !== "string" || !guard.source_fingerprint ||
      typeof guard.clock_revision !== "string" || !guard.clock_revision ||
      guard.source_fingerprint !== context.source_fingerprint || guard.clock_revision !== context.clock_revision) {
    throw new CorrectionClockConflict("Source or clock revision changed or is unavailable; reload corrections before saving");
  }
}

export function validateCorrectionClockGuard(analysisId: string, existing: any, incoming: any) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new CorrectionClockConflict("Corrections must be an object");
  const current = offset(existing?.transcript_clock_offset_seconds);
  const requested = "transcript_clock_offset_seconds" in incoming ? offset(incoming.transcript_clock_offset_seconds) : current;
  const guard = incoming._clock_write_guard;
  const generation = existing?.correction_generation ?? null;
  const supplied = guard?.correction_generation ?? null;
  if (generation !== null || supplied !== null) {
    if (typeof generation !== "string" || !generation || supplied !== generation) {
      throw new CorrectionClockConflict("Corrections changed since this editor was loaded; reload before saving");
    }
  }
  if (guard === undefined || guard === null) {
    if (requested !== current) throw new CorrectionClockConflict("Reload corrections before changing the source clock");
    return;
  }
  if (typeof guard !== "object" || guard.analysis_id !== analysisId || !("transcript_clock_offset_seconds" in guard)) {
    throw new CorrectionClockConflict("Correction clock guard is missing or belongs to another analysis");
  }
  if (offset(guard.transcript_clock_offset_seconds) !== current) {
    throw new CorrectionClockConflict("The source clock changed since these corrections were loaded; reload before saving");
  }
}
