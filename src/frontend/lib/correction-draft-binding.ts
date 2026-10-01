import type { AnnotationCorrections } from "./api-service";

type Guard = NonNullable<AnnotationCorrections["_clock_write_guard"]>;
export type CorrectionDraftBinding = { analysisId: string; guard: Guard | null };

/** Copy at draft opening; subsequent hydration must not rebind this draft. */
export function captureCorrectionDraftBinding(analysisId: string, corrections?: AnnotationCorrections | null): CorrectionDraftBinding {
  return { analysisId, guard: corrections?._clock_write_guard ? { ...corrections._clock_write_guard } : null };
}

export function correctionsForDraft(binding: CorrectionDraftBinding, analysisId: string, current?: AnnotationCorrections | null): AnnotationCorrections {
  const original = binding.guard;
  const latest = current?._clock_write_guard;
  if (binding.analysisId !== analysisId || !original || original.analysis_id !== analysisId ||
      original.binding_status !== "content_bound" || !original.source_fingerprint || !original.clock_revision ||
      !latest || latest.analysis_id !== analysisId || latest.binding_status !== "content_bound" ||
      latest.source_fingerprint !== original.source_fingerprint || latest.clock_revision !== original.clock_revision ||
      latest.transcript_clock_offset_seconds !== original.transcript_clock_offset_seconds ||
      (latest.correction_generation ?? null) !== (original.correction_generation ?? null)) {
    throw new Error("This draft no longer has a current source-clock binding. Your draft is retained; reload the analysis and reopen the editor before saving.");
  }
  return { ...(current || {}), _clock_write_guard: { ...original } };
}
