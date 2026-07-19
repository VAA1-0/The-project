export type GovernedSceneSegment = {
  scene_index: number;
  start: number;
  end: number;
  duration?: number;
  scene_id?: string;
  maturity_route?: string;
  authority?: string;
  source?: string;
  review_state?: string;
};

function numberFrom(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function secondsFromMaybeMs(value: unknown): number | null {
  const parsed = numberFrom(value);
  if (parsed === null) {
    return null;
  }
  return parsed > 1000 ? parsed / 1000 : parsed;
}

function normalizeSceneSegment(
  segment: Record<string, any>,
  index: number,
  fallbackSource: string,
): GovernedSceneSegment | null {
  const interval = segment.interval && typeof segment.interval === "object"
    ? segment.interval
    : {};
  const timeInterval = segment.time_interval && typeof segment.time_interval === "object"
    ? segment.time_interval
    : {};
  const start =
    secondsFromMaybeMs(segment.start) ??
    secondsFromMaybeMs(segment.start_seconds) ??
    secondsFromMaybeMs(segment.start_ms) ??
    secondsFromMaybeMs(interval.start) ??
    secondsFromMaybeMs(interval.start_seconds) ??
    secondsFromMaybeMs(interval.start_ms) ??
    secondsFromMaybeMs(timeInterval.start) ??
    secondsFromMaybeMs(timeInterval.start_seconds) ??
    secondsFromMaybeMs(timeInterval.start_ms);
  const end =
    secondsFromMaybeMs(segment.end) ??
    secondsFromMaybeMs(segment.end_seconds) ??
    secondsFromMaybeMs(segment.end_ms) ??
    secondsFromMaybeMs(interval.end) ??
    secondsFromMaybeMs(interval.end_seconds) ??
    secondsFromMaybeMs(interval.end_ms) ??
    secondsFromMaybeMs(timeInterval.end) ??
    secondsFromMaybeMs(timeInterval.end_seconds) ??
    secondsFromMaybeMs(timeInterval.end_ms);
  if (start === null || end === null) {
    return null;
  }
  const normalizedStart = Math.max(0, Math.min(start, end));
  const normalizedEnd = Math.max(normalizedStart, Math.max(start, end));
  return {
    scene_index: Number(segment.scene_index ?? segment.index ?? index + 1) || index + 1,
    start: normalizedStart,
    end: normalizedEnd,
    duration: numberFrom(segment.duration) ?? normalizedEnd - normalizedStart,
    scene_id: String(segment.scene_id || segment.id || "").trim() || undefined,
    maturity_route: String(segment.maturity_route || "").trim() || undefined,
    authority: String(segment.authority || "").trim() || undefined,
    source: String(segment.source || fallbackSource).trim() || fallbackSource,
    review_state: String(segment.review_state || segment.status || "").trim() || undefined,
  };
}

export function masterSchemaTemporalSegmentsFromAnalysis(
  analysisData: any,
): GovernedSceneSegment[] {
  const master =
    analysisData?.rawJson?.vaa1_annotation_master_schema ||
    analysisData?.status?.vaa1_annotation_master_schema ||
    analysisData?.vaa1_annotation_master_schema;
  const temporalSegments = Array.isArray(master?.temporal_segments)
    ? master.temporal_segments
    : [];
  // The master timeline also contains speaker turns and audio events. Those are
  // governed temporal evidence, but they are not scenes and must not become
  // Scene Card navigation entries.
  const explicitlyTypedScenes = temporalSegments.filter(
    (segment: Record<string, any>) =>
      String(segment?.segment_type || segment?.type || "").trim().toLowerCase() === "scene",
  );
  const sceneSegments = explicitlyTypedScenes.length
    ? explicitlyTypedScenes
    : temporalSegments.filter(
        (segment: Record<string, any>) =>
          Boolean(segment?.scene_id) ||
          String(segment?.event_family || "").trim().toLowerCase() === "scene_understanding",
      );
  return sceneSegments
    .map((segment: Record<string, any>, index: number) =>
      normalizeSceneSegment(segment, index, "vaa1_annotation_master_schema.temporal_segments"),
    )
    .filter(Boolean) as GovernedSceneSegment[];
}

export function motionSceneSegmentsFromAnalysis(
  analysisData: any,
): GovernedSceneSegment[] {
  const segments = analysisData?.metadata?.motionSceneBasis?.sceneSegments?.segments;
  if (!Array.isArray(segments)) {
    return [];
  }
  return segments
    .map((segment: Record<string, any>, index: number) =>
      normalizeSceneSegment(segment, index, "summary.scene_segments"),
    )
    .filter(Boolean) as GovernedSceneSegment[];
}

export function matureSceneSegmentsFromAnalysis(
  analysisData: any,
): GovernedSceneSegment[] {
  const masterSegments = masterSchemaTemporalSegmentsFromAnalysis(analysisData);
  if (masterSegments.length) {
    return masterSegments;
  }
  return motionSceneSegmentsFromAnalysis(analysisData);
}

export function matureSceneSegmentSourceLabel(analysisData: any): string {
  if (masterSchemaTemporalSegmentsFromAnalysis(analysisData).length) {
    return "Master Schema temporal segments";
  }
  if (motionSceneSegmentsFromAnalysis(analysisData).length) {
    return "Motion scene basis";
  }
  return "Derived scene windows";
}
