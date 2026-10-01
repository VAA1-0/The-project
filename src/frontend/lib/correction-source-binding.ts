import type { CorrectionSourceBinding } from "./correction-clock-guard";

export class CorrectionBindingUnavailable extends Error {}

/** Called only while the caller owns the shared correction lock.
 * The backend context GET does not reacquire that lock.
 */
export async function readCorrectionSourceBinding(analysisId: string): Promise<CorrectionSourceBinding> {
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/api/analysis/${encodeURIComponent(analysisId)}/source-clock`, {
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Clock service returned ${response.status}`);
    const context = await response.json();
    if (context?.analysis_id !== analysisId ||
        !["content_bound", "source_unavailable"].includes(context?.binding_status) ||
        (context.binding_status === "content_bound" &&
          (typeof context.source_fingerprint !== "string" || !context.source_fingerprint ||
           typeof context.clock_revision !== "string" || !context.clock_revision ||
           typeof context.timebase?.transcript_clock_offset_seconds !== "number" ||
           !Number.isFinite(context.timebase.transcript_clock_offset_seconds)))) {
      throw new Error("Invalid source-clock response");
    }
    return context;
  } catch (error) {
    throw new CorrectionBindingUnavailable(`Could not verify the source clock; retry when the backend is available. ${error instanceof Error ? error.message : ""}`);
  }
}
