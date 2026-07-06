import React, { useEffect, useMemo, useState } from "react";
import { apiService, type SourceMediaMetadata } from "@/lib/api-service";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import {
  VideoService,
  type AnalysisData,
  type MasterSchemaResolvedEvidenceRecord,
} from "@/lib/video-service";

type StatsKitPanelProps = {
  analysisId?: string;
  videoId?: string;
};

type EvidenceMetric = {
  id: string;
  label: string;
  value: number | string;
  detail: string;
  evidence: string;
  missing?: boolean;
};

type RadarDimension = {
  id: string;
  label: string;
  score: number;
  reason: string;
  evidence: string;
  nextAction: string;
};

type SignificanceClaimType =
  | "statistical"
  | "practical"
  | "social"
  | "cultural"
  | "strategic"
  | "narrative"
  | "emotional"
  | "informational"
  | "mixed";

type SignificancePosition =
  | "first_person"
  | "second_person"
  | "third_person"
  | "social_context"
  | "viewer"
  | "analyst"
  | "institutional"
  | "comparative";

type SignificanceOrientation = "intrinsic" | "external";
type SignificanceExpression = "explicit" | "implicit" | "inferred";
type SignificanceAudience = "researcher" | "archivist" | "journalist" | "policymaker" | "curator" | "editor" | "public" | "custom";
type SignificanceObjectType = "scene" | "segment" | "video" | "collection" | "actor" | "event" | "theme" | "network" | "corpus";
type SignificanceDimensionKey = Exclude<SignificanceClaimType, "mixed">;

type SignificancePerspective = {
  position: SignificancePosition;
  orientation: SignificanceOrientation;
  expression: SignificanceExpression;
  audience_profile: SignificanceAudience;
  research_question: string;
};

type SignificanceDimensionValue = {
  score: number;
  basis: string;
  summary: string;
};

type SignificanceEvidenceSupport = {
  primaryEvidenceCount: number;
  secondaryEvidenceCount: number;
  counterEvidenceCount: number;
  missingEvidence: string[];
  evidenceStrength: "weak" | "moderate" | "strong" | "contested";
};

type SignificanceClaim = {
  claim_id: string;
  scope: "macro" | "meso" | "micro";
  object_type: SignificanceObjectType;
  object_ids: string[];
  title: string;
  claim: string;
  claim_type: SignificanceClaimType;
  perspective: SignificancePerspective;
  significance_vector: Partial<Record<SignificanceDimensionKey, SignificanceDimensionValue>>;
  evidence_support: SignificanceEvidenceSupport;
  evidence: string;
  status: "draft" | "candidate" | "reviewed" | "accepted" | "disputed" | "rejected";
  missingEvidence: string[];
  reasoning: string;
};

type SignificanceWorkbenchRow = {
  id: string;
  claimId: string;
  scope: SignificanceClaim["scope"];
  objectType: SignificanceObjectType;
  title: string;
  claim: string;
  claimType: SignificanceClaimType;
  position: SignificancePosition;
  orientation: SignificanceOrientation;
  expression: SignificanceExpression;
  audience: SignificanceAudience;
  dimension: SignificanceDimensionKey;
  score: number;
  evidenceStrength: SignificanceEvidenceSupport["evidenceStrength"];
  primaryEvidenceCount: number;
  secondaryEvidenceCount: number;
  counterEvidenceCount: number;
  missingEvidence: string[];
  status: SignificanceClaim["status"];
  reasoning: string;
  nextAction: string;
};

type ScannerRow = {
  id: string;
  lane: "relevance" | "significance";
  dimension: string;
  score: number | string;
  evidence: string;
  nextAction: string;
  status: string;
};

type SchemaCoverageRow = {
  id: string;
  object: string;
  count: number | string;
  source: string;
  status: string;
  nextAction: string;
};

type SchemaDeliveryAuditRow = {
  id: string;
  schemaObject: string;
  status: "delivered" | "partial" | "not_operational";
  delivered: string;
  missing: string;
  nextAction: string;
};

type StatsTableRow = {
  id: string;
  level: string;
  family: StatsFamily;
  method: string;
  statistic: string;
  value: number | string;
  unit: string;
  scope: string;
  evidence: string;
  status: string;
  note: string;
  requiredLayer: string;
  resultId?: string;
  sourceAction?: string;
  visualizationTypes: VisualizationMode[];
};

type MissingDataRow = {
  id: string;
  sourceLayer: string;
  blockedRows: number;
  examples: string;
  reason: string;
  nextAction: string;
};

type VisualizationTarget = "stats" | "significance" | "relevance";

type VisualizationDatum = {
  id: string;
  label: string;
  value: number;
  detail: string;
  group: string;
  status?: string;
};

type StatsWorkbenchColumn =
  | "select"
  | "level"
  | "method"
  | "statistic"
  | "value"
  | "unit"
  | "evidence"
  | "status"
  | "note";

const DEFAULT_STAT_COLUMN_WIDTHS: Record<StatsWorkbenchColumn, number> = {
  select: 42,
  level: 72,
  method: 118,
  statistic: 190,
  value: 120,
  unit: 72,
  evidence: 240,
  status: 95,
  note: 260,
};

const ADJUSTABLE_STAT_COLUMNS: Array<{ id: StatsWorkbenchColumn; label: string; min: number; max: number }> = [
  { id: "level", label: "Level", min: 56, max: 140 },
  { id: "method", label: "Method", min: 80, max: 220 },
  { id: "statistic", label: "Statistic", min: 130, max: 360 },
  { id: "value", label: "Value", min: 80, max: 240 },
  { id: "unit", label: "Unit", min: 56, max: 130 },
  { id: "evidence", label: "Evidence", min: 150, max: 460 },
  { id: "status", label: "Status", min: 76, max: 160 },
  { id: "note", label: "Data note", min: 170, max: 560 },
];

type MasterSchemaStatsCategory =
  | "persons"
  | "organizations"
  | "places"
  | "objects"
  | "actions"
  | "topics"
  | "emotions"
  | "cameraShots"
  | "speakers"
  | "sounds"
  | "music"
  | "colors";

type MasterSchemaStatsAuditRow = {
  id: MasterSchemaStatsCategory;
  label: string;
  statLabel: string;
  count: number;
  masterSchemaCount: number;
  entityRegistryCount: number;
  rawSubstrateCount: number;
  sourcePath: string;
  status: "master_schema" | "governed_candidate" | "raw_substrate" | "not_found";
  note: string;
};

type StatsKitSourceLayerDeliverable = {
  id: string;
  layer: string;
  status: "available" | "partial_proxy" | "missing";
  availableRows: number;
  currentSource: string;
  unlocks: string;
  nextAction: string;
};

type StatsFamily =
  | "descriptive"
  | "cross_tabulation"
  | "correlation"
  | "comparative"
  | "distribution"
  | "social_network"
  | "narrative"
  | "linguistic"
  | "visual"
  | "audio"
  | "temporal";

type VisualizationMode =
  | "bar_chart"
  | "percent_bars"
  | "duration_bars"
  | "histogram"
  | "boxplot"
  | "heatmap"
  | "timeline"
  | "network_graph"
  | "table";

const STAT_FAMILY_OPTIONS: Array<{ id: StatsFamily; label: string; description: string }> = [
  { id: "descriptive", label: "Level I / Descriptive", description: "Counts, percentages, durations, means, medians, variance, and standard deviation." },
  { id: "cross_tabulation", label: "Level II / Cross-tabs", description: "Relationships between categorical variables such as speaker x topic or location x emotion." },
  { id: "correlation", label: "Level III / Correlation", description: "Variables that move together, visualized as matrices or heatmaps." },
  { id: "comparative", label: "Level IV / Comparative", description: "Comparisons across videos, scenes, genres, outlets, or collections." },
  { id: "distribution", label: "Level V / Distribution", description: "Histograms, boxplots, percentiles, quartiles, and outliers." },
  { id: "social_network", label: "Social network", description: "Nodes, edges, centrality, density, communities, brokerage, and structural holes." },
  { id: "narrative", label: "Narrative", description: "Conflict, resolution, character curves, topic entropy, and narrative transitions." },
  { id: "linguistic", label: "Linguistic", description: "Transcript, POS, lexical diversity, speech acts, certainty, hedges, and readability." },
  { id: "visual", label: "Visual", description: "Objects, OCR, expressions, faces, brightness, color, motion, shots, and scene complexity." },
  { id: "audio", label: "Audio", description: "Speech, silence, music, noise, loudness, pitch, tempo, pauses, and overlap." },
  { id: "temporal", label: "Temporal", description: "Rolling averages, event rates, bursts, change points, and time-window statistics." },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function arrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function recordCount(value: unknown): number {
  return isRecord(value) ? Object.keys(value).length : 0;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pct(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function evidenceCountBag(metadata: SourceMediaMetadata | null): Record<string, number> {
  if (!metadata) return {};
  const harvest = isRecord(metadata.video_internal_harvest)
    ? metadata.video_internal_harvest.evidence_counts
    : undefined;
  const iteration = isRecord(metadata.maturity_iteration)
    ? metadata.maturity_iteration.evidence_counts
    : undefined;
  return {
    ...(isRecord(harvest) ? harvest : {}),
    ...(isRecord(iteration) ? iteration : {}),
  } as Record<string, number>;
}

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

function recordLooksLikePerson(record: MasterSchemaResolvedEvidenceRecord): boolean {
  const label = normalizedText(record.label);
  const raw = normalizedText(record.rawLabel);
  return (
    ["narrative_agent_profile", "character_role", "identity"].includes(record.category) ||
    label.includes("person") ||
    raw.includes("person") ||
    label.includes("character")
  );
}

function countMasterRecords(
  analysisData: AnalysisData | null,
  predicate: (record: MasterSchemaResolvedEvidenceRecord) => boolean,
): number {
  return (analysisData?.masterSchemaResolvedEvidence?.records || []).filter(predicate).length;
}

function countEntities(
  analysisData: AnalysisData | null,
  predicate: (entity: NonNullable<AnalysisData["entityRegistry"]>["entities"][number]) => boolean,
): number {
  return (analysisData?.entityRegistry?.entities || []).filter(predicate).length;
}

function countManualCategory(analysisData: AnalysisData | null, category: string, subcategory?: RegExp): number {
  const rows = Object.values(analysisData?.manualAnnotationsByCategory || {}).flat();
  return rows.filter((row) => {
    if (!row || row.category !== category) return false;
    return subcategory ? subcategory.test(row.subcategory || "") : true;
  }).length;
}

function masterAuditStatus(row: Omit<MasterSchemaStatsAuditRow, "status">): MasterSchemaStatsAuditRow["status"] {
  if (row.masterSchemaCount > 0) return "master_schema";
  if (row.entityRegistryCount > 0) return "governed_candidate";
  if (row.rawSubstrateCount > 0) return "raw_substrate";
  return "not_found";
}

function makeMasterAuditRow(
  row: Omit<MasterSchemaStatsAuditRow, "status" | "count" | "note"> & { note?: string },
): MasterSchemaStatsAuditRow {
  const count = Math.max(row.masterSchemaCount, row.entityRegistryCount, row.rawSubstrateCount);
  const status = masterAuditStatus({ ...row, count, note: "" });
  const note =
    row.note ||
    (status === "master_schema"
      ? "Available through Master Schema resolved evidence."
      : status === "governed_candidate"
        ? "Available through the governed entity registry; promote or route to Master Schema when needed."
        : status === "raw_substrate"
          ? "Available as raw analysis substrate; StatsKit may count it but must not call it mature."
          : "Not found in Master Schema, entity registry, or loaded raw substrate.");
  return { ...row, count, status, note };
}

function buildMasterSchemaStatsAudit(
  analysisData: AnalysisData | null,
  metadata: SourceMediaMetadata | null,
): MasterSchemaStatsAuditRow[] {
  const objects = analysisData?.detectedObjects || [];
  const rawObjects = analysisData?.rawDetectedObjects || objects;
  const transcript = analysisData?.transcript || [];
  const expressions = analysisData?.expressionResults || [];
  const audioProsody = analysisData?.audioProsody || [];
  const posRows = analysisData?.posAnalysis || [];
  const quantRows = analysisData?.quantAnalysis || [];
  const sceneSegments = analysisData?.metadata?.motionSceneBasis?.sceneSegments?.segments || [];
  const shotSamples = analysisData?.metadata?.cinematicClues?.shotSize?.samples || [];
  const transitionSamples = analysisData?.metadata?.cinematicClues?.transitionClues?.samples || [];
  const spatialToneSamples = analysisData?.metadata?.spatialToneScan?.samples || [];
  const evidenceCounts = evidenceCountBag(metadata);
  const objectCountFromMetadata = sumCounts(evidenceCounts, [/object/i, /tracked_objects/i, /ocr_items/i]);

  const personRawCount = rawObjects.filter((item) => normalizedText(item.class_name || item.raw_class_name) === "person").length;
  const objectRawCount = Math.max(objects.length, rawObjects.length, objectCountFromMetadata);
  const speakerNames = new Set(transcript.map((segment) => segment.speaker).filter((speaker) => speaker && speaker !== "Unknown"));
  const soundEnvironmentCount = audioProsody.filter((cue) => cue.sound_environment?.label).length;
  const musicProsodyCount = audioProsody.filter((cue) => /music|song|score|soundtrack/i.test(cue.sound_environment?.label || "")).length;
  const musicManualCount = countManualCategory(analysisData, "Audio", /music/i);
  const colorToneCount = spatialToneSamples.reduce((sum, sample) => {
    const zones = Object.values(sample.zones || {});
    return sum + zones.filter((zone) => zone.dominant_tone || zone.brightness_band || zone.saturation_band).length;
  }, 0);

  return [
    makeMasterAuditRow({
      id: "persons",
      label: "Persons",
      statLabel: "persons detected",
      masterSchemaCount: countMasterRecords(analysisData, recordLooksLikePerson),
      entityRegistryCount: countEntities(analysisData, (entity) =>
        ["PERSON_NAME", "NARRATIVE_AGENT", "AUDIOVISUAL_NARRATIVE_AGENT"].includes(entity.entity_type),
      ),
      rawSubstrateCount: personRawCount,
      sourcePath: "masterSchemaResolvedEvidence.records + entityRegistry.entities + rawDetectedObjects[class_name=person]",
    }),
    makeMasterAuditRow({
      id: "organizations",
      label: "Organizations",
      statLabel: "organizations detected",
      masterSchemaCount: countMasterRecords(analysisData, (record) => /org|organization|institution/i.test(`${record.label} ${record.rawLabel || ""}`)),
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "ORG"),
      rawSubstrateCount: sumCounts(evidenceCounts, [/org/i, /organization/i, /institution/i]),
      sourcePath: "entityRegistry[ORG] + source metadata organization fields",
    }),
    makeMasterAuditRow({
      id: "places",
      label: "Places",
      statLabel: "places detected",
      masterSchemaCount: countMasterRecords(analysisData, (record) => /place|location|setting|city|country/i.test(`${record.label} ${record.rawLabel || ""}`)),
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "PLACE"),
      rawSubstrateCount: sumCounts(evidenceCounts, [/place/i, /location/i, /setting/i, /geo/i]),
      sourcePath: "entityRegistry[PLACE] + Master Schema location/setting records",
    }),
    makeMasterAuditRow({
      id: "objects",
      label: "Objects",
      statLabel: "objects detected",
      masterSchemaCount: countMasterRecords(analysisData, (record) => record.category === "object"),
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "OBJECT"),
      rawSubstrateCount: objectRawCount,
      sourcePath: "masterSchemaResolvedEvidence[object] + entityRegistry[OBJECT] + detectedObjects/rawDetectedObjects",
    }),
    makeMasterAuditRow({
      id: "actions",
      label: "Actions",
      statLabel: "actions detected",
      masterSchemaCount: countManualCategory(analysisData, "Action") + countMasterRecords(analysisData, (record) => /action|gesture|movement|role/i.test(`${record.label} ${record.rawLabel || ""}`)),
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "EVENT"),
      rawSubstrateCount: posRows.length + sumCounts(evidenceCounts, [/action/i, /role/i, /pos/i, /gesture/i]),
      sourcePath: "manual Action annotations + POS/SFL/event evidence",
    }),
    makeMasterAuditRow({
      id: "topics",
      label: "Topics",
      statLabel: "topics detected",
      masterSchemaCount: countManualCategory(analysisData, "Notes") + countManualCategory(analysisData, "Metadata"),
      entityRegistryCount: countEntities(analysisData, (entity) => ["CONCEPT", "EVENT"].includes(entity.entity_type)),
      rawSubstrateCount: quantRows.length + sumCounts(evidenceCounts, [/topic/i, /meaning/i, /theme/i, /quant/i]),
      sourcePath: "entityRegistry[CONCEPT/EVENT] + Quant/POS/meaning evidence",
    }),
    makeMasterAuditRow({
      id: "emotions",
      label: "Emotions",
      statLabel: "emotions detected",
      masterSchemaCount: countMasterRecords(analysisData, (record) => record.category === "expression") + countManualCategory(analysisData, "Expressions"),
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "AUDIOVISUAL_NARRATIVE_AGENT"),
      rawSubstrateCount: expressions.length,
      sourcePath: "masterSchemaResolvedEvidence[expression] + expressionResults + manual Expressions",
    }),
    makeMasterAuditRow({
      id: "cameraShots",
      label: "Camera shots",
      statLabel: "camera shots detected",
      masterSchemaCount: countManualCategory(analysisData, "Cinematic Cues") + countManualCategory(analysisData, "Scene"),
      entityRegistryCount: 0,
      rawSubstrateCount: Math.max(sceneSegments.length, shotSamples.length, transitionSamples.length, sumCounts(evidenceCounts, [/shot/i, /scene_segment/i, /scene_card/i, /camera/i])),
      sourcePath: "motionSceneBasis.sceneSegments + cinematicClues.transitionClues/shotSize + manual Cinematic Cues",
      note: sceneSegments.length && sceneSegments.length <= 10
        ? "This is a scene/transition proxy count, not a finished shot-boundary count. A trailer can have many more cuts than this."
        : undefined,
    }),
    makeMasterAuditRow({
      id: "speakers",
      label: "Speakers",
      statLabel: "speakers detected",
      masterSchemaCount: countManualCategory(analysisData, "Transcription") + countManualCategory(analysisData, "Audio", /speaker/i),
      entityRegistryCount: 0,
      rawSubstrateCount: Math.max(speakerNames.size, num(analysisData?.metadata?.audioDiarizationTurns)),
      sourcePath: "transcript speakers + audioDiarization.turn_count + manual speaker annotations",
    }),
    makeMasterAuditRow({
      id: "sounds",
      label: "Sounds",
      statLabel: "sounds detected",
      masterSchemaCount: countManualCategory(analysisData, "Audio"),
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "AUDIO_ENTITY"),
      rawSubstrateCount: Math.max(soundEnvironmentCount, sumCounts(evidenceCounts, [/sound/i, /audio/i, /prosody/i, /noise/i])),
      sourcePath: "audioProsody.sound_environment + audio sample/entity registry + manual Audio annotations",
    }),
    makeMasterAuditRow({
      id: "music",
      label: "Music",
      statLabel: "music detected",
      masterSchemaCount: musicManualCount,
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "AUDIO_ENTITY" && /music|song/i.test(entity.canonical_name)),
      rawSubstrateCount: Math.max(musicProsodyCount, sumCounts(evidenceCounts, [/music/i, /song/i])),
      sourcePath: "audioProsody.sound_environment[music/song/score] + manual Audio/Music annotations + audio entities",
    }),
    makeMasterAuditRow({
      id: "colors",
      label: "Colors",
      statLabel: "colors detected",
      masterSchemaCount: countManualCategory(analysisData, "Cinematic Cues", /lighting|composition/i),
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "VISUAL_SYMBOL" && /color|brightness|contrast|light/i.test(entity.canonical_name)),
      rawSubstrateCount: Math.max(colorToneCount, sumCounts(evidenceCounts, [/color/i, /brightness/i, /contrast/i])),
      sourcePath: "spatialToneScan zone tone/brightness/saturation + manual Cinematic Cues + visual symbol entities",
    }),
  ];
}

function masterAuditCounts(auditRows: MasterSchemaStatsAuditRow[]): Record<MasterSchemaStatsCategory, number> {
  return Object.fromEntries(auditRows.map((row) => [row.id, row.count])) as Record<MasterSchemaStatsCategory, number>;
}

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values: number[]): number | null {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function variance(values: number[]): number | null {
  const clean = values.filter(Number.isFinite);
  const avg = mean(clean);
  if (avg === null || clean.length < 2) return null;
  return clean.reduce((sum, value) => sum + (value - avg) ** 2, 0) / clean.length;
}

function stdDev(values: number[]): number | null {
  const value = variance(values);
  return value === null ? null : Math.sqrt(value);
}

function roundStat(value: number | null, digits = 2): number | string {
  if (value === null || !Number.isFinite(value)) return "not computed";
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function intervalDuration(start: unknown, end: unknown): number {
  const startValue = num(start);
  const endValue = num(end);
  return Math.max(0, endValue - startValue);
}

function timedTranscriptDurations(analysisData: AnalysisData | null): number[] {
  return (analysisData?.transcript || [])
    .map((segment) => intervalDuration(segment.start, segment.end))
    .filter((value) => value > 0);
}

function speechDurationSeconds(analysisData: AnalysisData | null): number {
  return timedTranscriptDurations(analysisData).reduce((sum, value) => sum + value, 0);
}

function musicDurationSeconds(analysisData: AnalysisData | null): number | null {
  const musicCues = (analysisData?.audioProsody || []).filter((cue) =>
    /music|song|score|soundtrack/i.test(cue.sound_environment?.label || ""),
  );
  if (!musicCues.length) return null;
  return musicCues.reduce((sum, cue) => sum + intervalDuration(cue.start, cue.end), 0);
}

function speakerDurationValues(analysisData: AnalysisData | null): number[] {
  const durations = new Map<string, number>();
  (analysisData?.transcript || []).forEach((segment) => {
    const speaker = segment.speaker || "Unknown";
    durations.set(speaker, (durations.get(speaker) || 0) + intervalDuration(segment.start, segment.end));
  });
  return [...durations.values()].filter((value) => value > 0);
}

function speakingTempoValues(analysisData: AnalysisData | null): number[] {
  return (analysisData?.audioProsody || [])
    .map((cue) => cue.pace?.words_per_second)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function expressionToneValues(analysisData: AnalysisData | null): number[] {
  return (analysisData?.expressionResults || [])
    .map((sample) => {
      if (typeof sample.top_emotion_score === "number") return sample.top_emotion_score;
      const emotionScores = sample.emotion ? Object.values(sample.emotion) : [];
      return emotionScores.length ? Math.max(...emotionScores.map(num)) : null;
    })
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function motionIntensityValues(analysisData: AnalysisData | null): number[] {
  return (analysisData?.metadata?.motionSceneBasis?.motionEvidence?.samples || [])
    .map((sample) =>
      [
        sample.occupancy_shift,
        sample.foreground_delta,
        sample.background_delta,
        sample.zone_tone_shift,
      ].map(num).reduce((sum, value) => sum + Math.abs(value), 0),
    )
    .filter((value) => value > 0);
}

function shotDurationValues(analysisData: AnalysisData | null): number[] {
  return (analysisData?.metadata?.motionSceneBasis?.sceneSegments?.segments || [])
    .map((segment) => intervalDuration(segment.start, segment.end))
    .filter((value) => value > 0);
}

function sourceLayerStatus(availableRows: number, hasProxy = false): StatsKitSourceLayerDeliverable["status"] {
  if (availableRows > 0) return "available";
  if (hasProxy) return "partial_proxy";
  return "missing";
}

function buildStatsKitSourceLayerDeliverables(analysisData: AnalysisData | null): StatsKitSourceLayerDeliverable[] {
  const shotBoundaryRows = 0;
  const sceneProxyRows = analysisData?.metadata?.motionSceneBasis?.sceneSegments?.segments?.length || 0;
  const shotSizeProxyRows = analysisData?.metadata?.cinematicClues?.shotSize?.samples?.length || 0;
  const audioProsodyRows = analysisData?.audioProsody?.length || 0;
  const musicSoundRows = (analysisData?.audioProsody || []).filter((cue) =>
    cue.sound_environment?.label,
  ).length;
  const colorRows = (analysisData?.metadata?.spatialToneScan?.samples || []).reduce((sum, sample) => {
    const zones = Object.values(sample.zones || {});
    return sum + zones.filter((zone) => zone.dominant_tone || zone.brightness_band || zone.saturation_band).length;
  }, 0);
  const diarizationTurns = num(analysisData?.metadata?.audioDiarizationTurns);
  const transcriptSpeakerRows = (analysisData?.transcript || []).filter((segment) =>
    Boolean(segment.speaker && segment.speaker !== "Unknown" && intervalDuration(segment.start, segment.end) > 0),
  ).length;

  return [
    {
      id: "true-shot-boundary-intervals",
      layer: "True shot-boundary intervals",
      status: sourceLayerStatus(shotBoundaryRows, sceneProxyRows + shotSizeProxyRows > 0),
      availableRows: shotBoundaryRows,
      currentSource: sceneProxyRows || shotSizeProxyRows
        ? `${sceneProxyRows} scene segment proxy rows / ${shotSizeProxyRows} shot-size sample rows`
        : "No shot-boundary or cinematic proxy layer visible",
      unlocks: "shot duration distributions, trailer cut counts, camera rhythm variance, temporal change points",
      nextAction: "Add and persist a real shot-boundary detector output with start/end intervals and method provenance.",
    },
    {
      id: "audio-event-intervals",
      layer: "Audio event intervals: speech / silence / noise / music",
      status: sourceLayerStatus(0, audioProsodyRows > 0),
      availableRows: 0,
      currentSource: audioProsodyRows ? `${audioProsodyRows} prosody cues available as partial audio proxy` : "No audio event interval layer visible",
      unlocks: "speech/silence/noise/music ratios, audio timelines, event-rate curves, source-linked significance",
      nextAction: "Persist VAD/silence/noise/music intervals as governed audio events, not only summary readiness.",
    },
    {
      id: "music-sound-classifier",
      layer: "Music and sound classifier output over time",
      status: sourceLayerStatus(musicSoundRows),
      availableRows: musicSoundRows,
      currentSource: musicSoundRows ? "audioProsody.sound_environment labels" : "No classified music/sound timeline visible",
      unlocks: "music intensity x emotion, soundscape relevance, music/sound significance claims",
      nextAction: "Classify music, score, noise, ambience, and sound events over time and persist EvidenceLink-compatible intervals.",
    },
    {
      id: "color-brightness-contrast",
      layer: "Color / brightness / contrast frame-window extraction",
      status: sourceLayerStatus(colorRows),
      availableRows: colorRows,
      currentSource: colorRows ? "spatialToneScan zone tone/brightness/saturation" : "No color/brightness/contrast layer visible",
      unlocks: "brightness distributions, color entropy, darkness x fear, visual tone relevance",
      nextAction: "Extract color, brightness, contrast, and entropy over sampled frames or windows with source timestamps.",
    },
    {
      id: "speaker-linked-diarization",
      layer: "Speaker-linked diarization turns",
      status: sourceLayerStatus(diarizationTurns, transcriptSpeakerRows > 0),
      availableRows: diarizationTurns,
      currentSource: diarizationTurns
        ? `${diarizationTurns} diarization turns`
        : transcriptSpeakerRows
          ? `${transcriptSpeakerRows} transcript speaker-label intervals as partial proxy`
          : "No speaker-linked turn layer visible",
      unlocks: "speaker dominance, median turn, overlap, dialogue balance, gender by speaking time",
      nextAction: "Link diarized speaker turns to transcript spans and, when confirmed, Narrative Agents.",
    },
  ];
}

function sumCounts(counts: Record<string, number>, patterns: RegExp[]): number {
  return Object.entries(counts).reduce((sum, [key, value]) => {
    if (patterns.some((pattern) => pattern.test(key))) return sum + num(value);
    return sum;
  }, 0);
}

function asPercent(part: number, whole: number): number | string {
  if (!whole) return "not computed";
  return Math.round((part / whole) * 1000) / 10;
}

function statRow(
  family: StatsFamily,
  level: string,
  method: string,
  statistic: string,
  value: number | string,
  unit: string,
  evidence: string,
  status: "computed" | "candidate" | "needs source layer" | "needs corpus" | "not computed",
  note: string,
  requiredLayer = evidence,
  visualizationTypes: VisualizationMode[] = ["table"],
): StatsTableRow {
  return {
    id: `${family}:${method}:${statistic}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    level,
    family,
    method,
    statistic,
    value,
    unit,
    scope: "analysis",
    evidence,
    status,
    note,
    requiredLayer,
    sourceAction: `datascene://statskit/${family}/${method}`,
    visualizationTypes,
  };
}

function defaultVisualizationTypes(row: Pick<StatsTableRow, "method" | "unit" | "family" | "status">): VisualizationMode[] {
  const modes: VisualizationMode[] = ["table"];
  if (row.status === "computed" || row.status === "candidate" || row.status === "raw") {
    modes.push("bar_chart");
  }
  if (row.unit === "%") modes.push("percent_bars");
  if (row.unit === "seconds" || row.unit === "events/min") modes.push("duration_bars", "timeline");
  if (row.method === "histogram" || row.family === "distribution") modes.push("histogram", "boxplot");
  if (row.family === "cross_tabulation" || row.family === "correlation") modes.push("heatmap");
  if (row.family === "temporal" || row.family === "narrative") modes.push("timeline");
  if (row.family === "social_network") modes.push("network_graph");
  return [...new Set(modes)];
}

function buildSubstanceRows(
  metadata: SourceMediaMetadata | null,
  analysisData: AnalysisData | null,
  metrics: EvidenceMetric[],
  radar: RadarDimension[],
  runArtifact: Record<string, unknown> | null,
  masterAuditRows: MasterSchemaStatsAuditRow[],
): StatsTableRow[] {
  const counts = evidenceCountBag(metadata);
  const auditCounts = masterAuditCounts(masterAuditRows);
  const totalEvents = Object.values(auditCounts).reduce((sum, value) => sum + num(value), 0) ||
    Object.values(counts).reduce((sum, value) => sum + num(value), 0);
  const duration = num(metadata?.duration_seconds);
  const hasMetadata = Boolean(metadata);
  const sourceStatus = hasMetadata ? "computed" : "needs source layer";
  const computedOrMissing = (value: number) => (value > 0 ? "computed" : hasMetadata ? "not computed" : "needs source layer");
  const perMinute = (value: number) => (duration ? Math.round((value / (duration / 60)) * 100) / 100 : "not computed");

  const persons = auditCounts.persons || 0;
  const organizations = auditCounts.organizations || 0;
  const places = auditCounts.places || 0;
  const objects = auditCounts.objects || 0;
  const actions = auditCounts.actions || 0;
  const topics = auditCounts.topics || 0;
  const emotions = auditCounts.emotions || 0;
  const cameraShots = auditCounts.cameraShots || 0;
  const speakers = auditCounts.speakers || 0;
  const sounds = auditCounts.sounds || 0;
  const music = auditCounts.music || 0;
  const colors = auditCounts.colors || 0;
  const matureAnchors = Number(metrics.find((metric) => metric.id === "mature_anchors")?.value || 0);
  const audioPresent = metrics.find((metric) => metric.id === "audio_readiness" && !metric.missing) ? 1 : 0;
  const speechSeconds = speechDurationSeconds(analysisData);
  const musicSeconds = musicDurationSeconds(analysisData);
  const silenceSeconds = duration && speechSeconds ? Math.max(0, duration - speechSeconds) : null;
  const speakingTurnMedian = median(timedTranscriptDurations(analysisData));
  const tempoVariance = variance(speakingTempoValues(analysisData));
  const expressionVariance = variance(expressionToneValues(analysisData));
  const motionVariance = variance(motionIntensityValues(analysisData));
  const speakerDominanceStdDev = stdDev(speakerDurationValues(analysisData));
  const shotDurationStdDev = stdDev(shotDurationValues(analysisData));
  const movementStdDev = stdDev(motionIntensityValues(analysisData));
  const auditByStatLabel = new Map(masterAuditRows.map((row) => [row.statLabel, row]));
  const descriptiveEntries: Array<[string, number, string, MasterSchemaStatsAuditRow | undefined]> = [
    ["persons", persons, "Master Schema person/narrative-agent audit", auditByStatLabel.get("persons detected")],
    ["organizations", organizations, "Master Schema organization audit", auditByStatLabel.get("organizations detected")],
    ["places", places, "Master Schema place/location audit", auditByStatLabel.get("places detected")],
    ["objects", objects, "Master Schema object/detection audit", auditByStatLabel.get("objects detected")],
    ["actions", actions, "Master Schema action/POS/manual audit", auditByStatLabel.get("actions detected")],
    ["topics", topics, "Master Schema topic/meaning/quant audit", auditByStatLabel.get("topics detected")],
    ["emotions", emotions, "Master Schema expression/emotion audit", auditByStatLabel.get("emotions detected")],
    ["camera shots", cameraShots, "Master Schema scene/camera audit", auditByStatLabel.get("camera shots detected")],
    ["speakers", speakers, "Master Schema speaker/transcript/audio audit", auditByStatLabel.get("speakers detected")],
    ["sounds", sounds, "Master Schema audio/sound audit", auditByStatLabel.get("sounds detected")],
    ["music", music, "Master Schema music/audio audit", auditByStatLabel.get("music detected")],
    ["colors", colors, "Master Schema color/visual cue audit", auditByStatLabel.get("colors detected")],
  ];

  const rows: StatsTableRow[] = [
    ...descriptiveEntries.map(([label, value, evidence, audit]) =>
      statRow(
        "descriptive",
        "Level I",
        "frequency",
        `${label} detected`,
        value,
        "count",
        audit?.sourcePath || evidence,
        computedOrMissing(value),
        audit?.note || (value > 0 ? "Direct count from governed Datascene evidence." : "No source layer for this variable is visible yet."),
        audit?.sourcePath || evidence,
      ),
    ),
    ...descriptiveEntries.map(([label, value, evidence, audit]) =>
      statRow(
        "descriptive",
        "Level I",
        "percentage",
        `${label} share of harvested events`,
        asPercent(value, totalEvents),
        "%",
        audit?.sourcePath || evidence,
        totalEvents ? (value > 0 ? "computed" : "not computed") : "needs source layer",
        "Percentage is computed against the visible Master Schema / analysis substrate audit.",
        audit?.sourcePath || evidence,
      ),
    ),
    statRow(
      "descriptive",
      "Level I",
      "duration",
      "runtime",
      duration ? Math.round(duration * 100) / 100 : "not computed",
      "seconds",
      "source_media_metadata.duration_seconds",
      sourceStatus,
      "Total source-video duration; timed sub-durations require transcript, audio, scene, or object spans.",
    ),
    statRow(
      "descriptive",
      "Level I",
      "duration",
      "speech / silence / music duration",
      speechSeconds
        ? `speech ${roundStat(speechSeconds)} / silence ${roundStat(silenceSeconds)} / music ${musicSeconds === null ? "not classified" : roundStat(musicSeconds)}`
        : "not computed",
      "seconds",
      "timed transcript segments + optional audioProsody music environment labels",
      speechSeconds ? (musicSeconds === null ? "candidate" : "computed") : audioPresent ? "needs source layer" : "not computed",
      "Speech and silence are computed from timed transcript coverage; music requires classified audio environment intervals before it is fully actual.",
      "transcript segment intervals + audioProsody.sound_environment",
    ),
    statRow(
      "descriptive",
      "Level I",
      "mean",
      "mean scene length",
      cameraShots && duration ? Math.round((duration / cameraShots) * 100) / 100 : "not computed",
      "seconds",
      "source duration + scene/shot evidence count",
      cameraShots && duration ? "candidate" : "needs source layer",
      "Count-derived approximation until exact scene/shot boundaries are loaded.",
    ),
    statRow(
      "descriptive",
      "Level I",
      "median",
      "median speaking turn",
      roundStat(speakingTurnMedian),
      "seconds",
      "timed transcript segment intervals",
      speakingTurnMedian !== null ? "computed" : "needs source layer",
      speakingTurnMedian !== null ? "Median computed from timed transcript turns." : "Needs timed speaker turns before median can be calculated.",
      "transcript segment start/end intervals",
    ),
    statRow(
      "descriptive",
      "Level I",
      "variance",
      "camera movement / emotional tone / speaking tempo variance",
      `movement ${roundStat(motionVariance)} / emotion ${roundStat(expressionVariance)} / tempo ${roundStat(tempoVariance)}`,
      "score",
      "timed shot, emotion, and speech-tempo series",
      motionVariance !== null || expressionVariance !== null || tempoVariance !== null ? "computed" : "needs source layer",
      "Variance is computed for each timed vector that exists; missing vector families remain not computed inside the compound value.",
      "motionSceneBasis.motionEvidence.samples + expressionResults + audioProsody.pace",
    ),
    statRow(
      "descriptive",
      "Level I",
      "standard_deviation",
      "speaker dominance / shot duration / movement intensity",
      `speaker ${roundStat(speakerDominanceStdDev)} / shot ${roundStat(shotDurationStdDev)} / movement ${roundStat(movementStdDev)}`,
      "score",
      "timed speaker, shot, and movement series",
      speakerDominanceStdDev !== null || shotDurationStdDev !== null || movementStdDev !== null ? "computed" : "needs source layer",
      "Standard deviation is computed from whichever timed distributions are loaded.",
      "transcript speaker durations + scene segment durations + motion evidence samples",
    ),
    statRow("cross_tabulation", "Level II", "cross_tab", "Gender x speaking time", "not computed", "matrix", "speaker identity + gender label + timed speech turns", "needs source layer", "Requires speaker-linked demographics and speaking-time intervals."),
    statRow("cross_tabulation", "Level II", "cross_tab", "Location x emotion", "not computed", "matrix", "scene setting + expression/sentiment intervals", "needs source layer", "Requires location labels and timed emotional evidence."),
    statRow("cross_tabulation", "Level II", "cross_tab", "Speaker x topic", "not computed", "matrix", "speaker turns + topic/meaning spans", "needs source layer", "Requires transcript spans linked to speakers and topics."),
    statRow("correlation", "Level III", "correlation", "music intensity x negative emotion", "not computed", "r", "audio intensity time series + emotion time series", "needs source layer", "Requires aligned audio and emotion vectors."),
    statRow("correlation", "Level III", "correlation", "object density x narrative complexity", "not computed", "r", "object density series + narrative marker series", "needs source layer", "Requires per-window object and narrative measurements."),
    statRow("comparative", "Level IV", "comparative", "video-to-video comparison", "not computed", "table", "collection or comparative corpus", "needs corpus", "Single-video data is loaded; comparative statistics require multiple governed videos."),
    statRow("distribution", "Level V", "histogram", "shot length distribution", "not computed", "distribution", "shot boundary intervals", "needs source layer", "Requires exact shot durations."),
    statRow("distribution", "Level V", "boxplot", "speaker turn distribution", "not computed", "distribution", "speaker turn intervals", "needs source layer", "Requires timed speaker turns."),
    statRow("social_network", "Network", "degree", "entity interaction degree", matureAnchors, "nodes/edges", "manual anchors + interaction edges", matureAnchors ? "candidate" : "needs source layer", "Uses available mature anchors; actual centrality needs explicit edges."),
    statRow("social_network", "Network", "density", "interaction network density", "not computed", "score", "entity nodes + interaction edges", "needs source layer", "Requires a confirmed interaction edge set."),
    statRow("narrative", "Narrative", "event_rate", "scene transition rate", perMinute(cameraShots), "events/min", "scene/shot evidence count + duration", cameraShots && duration ? "candidate" : "needs source layer", "Count-derived transition proxy until exact boundaries are loaded."),
    statRow("narrative", "Narrative", "curve", "hero / villain / suspense / emotion curves", "not computed", "timeline", "character presence + affect + scene markers", "needs source layer", "Requires timed character and affect traces."),
    statRow("linguistic", "Linguistic", "frequency", "POS / transcript token evidence", actions, "count", "POS/transcript evidence counts", computedOrMissing(actions), "Available when POS or transcript layers have been harvested."),
    statRow("linguistic", "Linguistic", "lexical_diversity", "type-token ratio", "not computed", "ratio", "transcript token table", "needs source layer", "Requires transcript tokens, not just metadata."),
    statRow("visual", "Visual", "density", "object density", perMinute(objects), "events/min", "object/tracked_objects counts + duration", objects && duration ? "candidate" : computedOrMissing(objects), "Rate computed from available object count and runtime."),
    statRow("visual", "Visual", "density", "face / expression density", perMinute(emotions + persons), "events/min", "person/expression counts + duration", (emotions || persons) && duration ? "candidate" : computedOrMissing(emotions + persons), "Rate computed from visible person/expression counts."),
    statRow("audio", "Audio", "ratio", "audio readiness", audioPresent ? 100 : 0, "%", "source_media_metadata.has_audio", hasMetadata ? "computed" : "needs source layer", "This is only readiness; actual audio statistics require audio intervals."),
    statRow("audio", "Audio", "duration", "speech / silence / noise / music ratios", "not computed", "%", "VAD + diarization + audio classifier intervals", "needs source layer", "Actual audio evidence must be loaded before ratios are claimed."),
    statRow("temporal", "Temporal", "event_rate", "visible evidence event rate", perMinute(totalEvents), "events/min", "harvested evidence counts + duration", totalEvents && duration ? "candidate" : "needs source layer", "Aggregate rate; rolling windows require timestamped event rows."),
    statRow("temporal", "Temporal", "change_point", "burst / change-point detection", "not computed", "timeline", "timestamped multimodal event stream", "needs source layer", "Requires per-event timestamps across the full video."),
  ];

  rows.forEach((row) => {
    row.visualizationTypes = defaultVisualizationTypes(row);
  });

  const generatedResults = Array.isArray(runArtifact?.generated_results) ? runArtifact.generated_results : [];
  generatedResults.forEach((result, index) => {
    if (!isRecord(result)) return;
    const methodId = typeof result.method_id === "string" ? result.method_id : "statskit";
    const label = typeof result.result_label === "string" ? result.result_label : `Stats result ${index + 1}`;
    rows.push({
      id: typeof result.result_id === "string" ? result.result_id : `result:${index}`,
      level: "StatsRun",
      family: methodId.includes("audio") ? "audio" : methodId.includes("event") ? "temporal" : methodId.includes("word") ? "linguistic" : "descriptive",
      method: methodId,
      statistic: label,
      value: formatStatValue(result.value),
      unit: typeof result.result_type === "string" ? result.result_type : "result",
      scope: "run",
      evidence: arrayCount(result.linked_evidence) ? `${arrayCount(result.linked_evidence)} linked evidence rows` : "run artifact",
      status: typeof result.interpretation_status === "string" ? result.interpretation_status : "raw",
      note: "Generated by StatsKit endpoint or local fallback artifact.",
      requiredLayer: arrayCount(result.linked_evidence) ? "StatsKit EvidenceLink" : "StatsRun artifact",
      resultId: typeof result.result_id === "string" ? result.result_id : `result:${index}`,
      sourceAction: `datascene://statskit/result/${typeof result.result_id === "string" ? result.result_id : `result-${index}`}`,
      visualizationTypes: defaultVisualizationTypes({
        method: methodId,
        unit: typeof result.result_type === "string" ? result.result_type : "result",
        family: methodId.includes("audio") ? "audio" : methodId.includes("event") ? "temporal" : methodId.includes("word") ? "linguistic" : "descriptive",
        status: typeof result.interpretation_status === "string" ? result.interpretation_status : "raw",
      }),
    });
  });

  return rows;
}

function buildMetrics(metadata: SourceMediaMetadata | null, analysisData: AnalysisData | null): EvidenceMetric[] {
  const annotations = isRecord(metadata?.user_annotations) ? metadata?.user_annotations : {};
  const counts = evidenceCountBag(metadata);
  const characterDefinitions = arrayCount(annotations?.character_definitions);
  const narrativeProfiles = arrayCount(annotations?.narrative_agent_profiles);
  const webSources = arrayCount(annotations?.web_metadata_sources);
  const annotationMaturity = recordCount(metadata?.annotation_maturity);
  const masterResolvedRecords = analysisData?.masterSchemaResolvedEvidence?.records?.length || 0;
  const entityRecords = analysisData?.entityRegistry?.entities?.length || 0;
  const rawObjects = analysisData?.rawDetectedObjects?.length || analysisData?.detectedObjects?.length || 0;
  const hasAudio = Boolean(metadata?.has_audio);
  const duration = num(metadata?.duration_seconds);
  const resolution =
    metadata?.width && metadata?.height ? `${metadata.width} x ${metadata.height}` : "not reported";

  return [
    {
      id: "source_media",
      label: "Source media",
      value: metadata ? "loaded" : "missing",
      detail: metadata
        ? `${metadata.original_filename || metadata.analysis_id || "active analysis"} / ${duration.toFixed(2)}s / ${resolution}`
        : "Open an analysis to load source media metadata.",
      evidence: "source_media_metadata_json",
      missing: !metadata,
    },
    {
      id: "mature_anchors",
      label: "Mature anchors",
      value: characterDefinitions + narrativeProfiles + annotationMaturity + masterResolvedRecords,
      detail: `${characterDefinitions} character definitions, ${narrativeProfiles} narrative profiles, ${annotationMaturity} maturity records, ${masterResolvedRecords} Master Schema resolved records`,
      evidence: "masterSchemaResolvedEvidence + user_annotations + annotation_maturity",
      missing: characterDefinitions + narrativeProfiles + annotationMaturity + masterResolvedRecords === 0,
    },
    {
      id: "multimodal_counts",
      label: "Multimodal substrate",
      value: Object.values(counts).reduce((sum, value) => sum + num(value), 0) + entityRecords + rawObjects,
      detail: [
        `${entityRecords} entity records`,
        `${rawObjects} object substrate rows`,
        Object.entries(counts)
        .slice(0, 5)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" / "),
      ].filter(Boolean).join(" / ") || "No harvested evidence counts found.",
      evidence: "entityRegistry + detectedObjects + video_internal_harvest.evidence_counts + maturity_iteration.evidence_counts",
      missing: Object.keys(counts).length === 0 && entityRecords === 0 && rawObjects === 0,
    },
    {
      id: "audio_readiness",
      label: "Audio readiness",
      value: hasAudio ? "audio present" : "audio missing",
      detail: hasAudio
        ? "Source media reports an audio track. StatsKit can request speech-ratio analysis when diarization/VAD is available."
        : "No audio track reported, so audio significance cannot be claimed for this analysis.",
      evidence: "source_media_metadata.has_audio",
      missing: !hasAudio,
    },
    {
      id: "external_context",
      label: "External context",
      value: webSources,
      detail: `${webSources} web/source metadata references available for comparative interpretation`,
      evidence: "user_annotations.web_metadata_sources",
      missing: webSources === 0,
    },
  ];
}

function buildRadar(metrics: EvidenceMetric[]): RadarDimension[] {
  const sourceLoaded = metrics.find((metric) => metric.id === "source_media" && !metric.missing);
  const matureAnchors = Number(metrics.find((metric) => metric.id === "mature_anchors")?.value || 0);
  const substrate = Number(metrics.find((metric) => metric.id === "multimodal_counts")?.value || 0);
  const hasAudio = metrics.find((metric) => metric.id === "audio_readiness" && !metric.missing);
  const external = Number(metrics.find((metric) => metric.id === "external_context")?.value || 0);

  return [
    {
      id: "task_fit",
      label: "Task fit",
      score: clamp01((matureAnchors + substrate / 20) / 10),
      reason: "Ranks whether the current analysis has enough mature and multimodal evidence for analyst work.",
      evidence: "mature anchors + multimodal substrate",
      nextAction: matureAnchors ? "Inspect strongest mature anchors." : "Create source-time anchored confirmations.",
    },
    {
      id: "source_strength",
      label: "Source strength",
      score: clamp01((sourceLoaded ? 0.35 : 0) + matureAnchors / 20 + substrate / 200),
      reason: "Scores whether claims can be traced back to concrete source artifacts.",
      evidence: "source media metadata, manual anchors, harvested evidence counts",
      nextAction: "Open source-linked evidence before accepting significance claims.",
    },
    {
      id: "multimodal_strength",
      label: "Multimodal strength",
      score: clamp01((hasAudio ? 0.25 : 0) + substrate / 150),
      reason: "Estimates whether visual, transcript, object, OCR, and audio evidence can support one another.",
      evidence: "audio readiness + harvested multimodal counts",
      nextAction: hasAudio ? "Run or inspect speech-ratio StatsKit output." : "Add audio/VAD evidence before audio claims.",
    },
    {
      id: "comparative_value",
      label: "Comparative value",
      score: clamp01(external / 10 + matureAnchors / 30),
      reason: "Ranks whether the analysis has enough context for cross-scene or external comparison.",
      evidence: "web metadata sources + mature profiles",
      nextAction: "Compare mature entities and scenes with external source metadata.",
    },
    {
      id: "actionability",
      label: "Actionability",
      score: clamp01((sourceLoaded ? 0.3 : 0) + matureAnchors / 12),
      reason: "Scores whether the analyst has a practical next confirmation or review action.",
      evidence: "source-loaded state + user-confirmed anchors",
      nextAction: "Prioritize missing anchors with clear source time, BBox/ROI, transcript, or audio evidence.",
    },
  ];
}

function buildSignificance(metrics: EvidenceMetric[], radar: RadarDimension[]): SignificanceClaim[] {
  const matureAnchors = Number(metrics.find((metric) => metric.id === "mature_anchors")?.value || 0);
  const substrate = Number(metrics.find((metric) => metric.id === "multimodal_counts")?.value || 0);
  const sourceStrength = radar.find((dimension) => dimension.id === "source_strength")?.score || 0;
  const multimodalStrength = radar.find((dimension) => dimension.id === "multimodal_strength")?.score || 0;
  const comparativeStrength = radar.find((dimension) => dimension.id === "comparative_value")?.score || 0;
  const sourceReady = sourceStrength > 0.35 || multimodalStrength > 0.35;

  return [
    {
      claim_id: "significance:macro:video-level",
      scope: "macro",
      object_type: "video",
      object_ids: ["active-analysis"],
      title: "Video-level significance",
      claim_type: "narrative",
      perspective: {
        position: "analyst",
        orientation: "intrinsic",
        expression: matureAnchors > 0 ? "inferred" : "implicit",
        audience_profile: "researcher",
        research_question: "Which source-linked patterns can support interpretation of the whole video?",
      },
      significance_vector: {
        narrative: {
          score: matureAnchors > 0 ? 0.62 : 0.18,
          basis: "user_annotations + annotation_maturity",
          summary: "Macro significance depends on mature anchors that can explain the full video without detaching from source evidence.",
        },
        informational: {
          score: clamp01(sourceStrength),
          basis: "source metadata + mature anchors",
          summary: "The claim becomes more useful when the video-level reading can jump back to concrete source evidence.",
        },
      },
      evidence_support: {
        primaryEvidenceCount: matureAnchors,
        secondaryEvidenceCount: substrate,
        counterEvidenceCount: 0,
        missingEvidence: matureAnchors > 0 ? [] : ["manual mature anchors", "source-time confirmations"],
        evidenceStrength: matureAnchors > 0 ? "moderate" : "weak",
      },
      claim:
        matureAnchors > 0
          ? "The analysis has mature anchors that can support video-level interpretation."
          : "Video-level significance is not ready because mature anchors are missing.",
      evidence: "user_annotations + annotation_maturity",
      status: matureAnchors > 0 ? "candidate" : "draft",
      missingEvidence: matureAnchors > 0 ? [] : ["manual mature anchors", "source-time confirmations"],
      reasoning: "Macro claims require accepted or candidate source-linked anchors before they can become useful interpretation.",
    },
    {
      claim_id: "significance:meso:scene-sequence",
      scope: "meso",
      object_type: "scene",
      object_ids: ["active-scene-sequence"],
      title: "Scene and sequence significance",
      claim_type: "statistical",
      perspective: {
        position: "comparative",
        orientation: "intrinsic",
        expression: substrate > 0 ? "inferred" : "implicit",
        audience_profile: "researcher",
        research_question: "Which measured scene or sequence patterns are significant enough to compare?",
      },
      significance_vector: {
        statistical: {
          score: substrate > 0 ? 0.58 : 0.14,
          basis: "maturity_iteration/video_internal_harvest evidence counts",
          summary: "Scene significance should be ranked from measured scene/event evidence, not from metadata presence alone.",
        },
        narrative: {
          score: clamp01((substrate / 120) + comparativeStrength),
          basis: "scene/event source layers + comparative context",
          summary: "Repeated patterns become more narratively significant when they can be compared across scenes.",
        },
      },
      evidence_support: {
        primaryEvidenceCount: substrate,
        secondaryEvidenceCount: matureAnchors,
        counterEvidenceCount: 0,
        missingEvidence: substrate > 0 ? [] : ["harvested multimodal evidence counts", "scene or event source layers"],
        evidenceStrength: substrate > 0 ? "moderate" : "weak",
      },
      claim:
        substrate > 0
          ? "Harvested evidence counts can be used to rank scenes, transitions, and repeated patterns."
          : "Scene significance cannot be ranked until harvested source evidence is available.",
      evidence: "maturity_iteration/video_internal_harvest evidence counts",
      status: substrate > 0 ? "candidate" : "draft",
      missingEvidence: substrate > 0 ? [] : ["harvested multimodal evidence counts", "scene or event source layers"],
      reasoning: "Meso significance needs measured or harvested scene/event evidence rather than only source metadata.",
    },
    {
      claim_id: "significance:micro:source-moment",
      scope: "micro",
      object_type: "event",
      object_ids: ["active-source-moment"],
      title: "Source-moment significance",
      claim_type: "mixed",
      perspective: {
        position: "viewer",
        orientation: "external",
        expression: sourceReady ? "explicit" : "implicit",
        audience_profile: "researcher",
        research_question: "Which source moments matter to a viewer or analyst, and which evidence can open them?",
      },
      significance_vector: {
        emotional: {
          score: clamp01(multimodalStrength),
          basis: "audio readiness + harvested multimodal counts",
          summary: "Micro significance needs source-time affect, expression, audio, or gesture evidence before emotional interpretation is strong.",
        },
        informational: {
          score: clamp01(sourceStrength),
          basis: "source metadata, audio readiness, mature anchors",
          summary: "A source moment becomes operationally significant when it can be opened through video time, BBox/ROI, transcript, or audio evidence.",
        },
      },
      evidence_support: {
        primaryEvidenceCount: sourceReady ? Math.max(1, matureAnchors) : 0,
        secondaryEvidenceCount: sourceReady ? substrate : 0,
        counterEvidenceCount: 0,
        missingEvidence: sourceReady ? [] : ["source-time events", "BBox/ROI anchors", "transcript spans", "audio intervals"],
        evidenceStrength: sourceReady ? "moderate" : "weak",
      },
      claim:
        sourceReady
          ? "Some source-moment claims can be inspected through source metadata and multimodal signals."
          : "Micro significance needs stronger source-time, BBox/ROI, transcript, or audio evidence.",
      evidence: "source metadata, audio readiness, mature anchors",
      status: sourceReady ? "candidate" : "draft",
      missingEvidence:
        sourceReady
          ? []
          : ["source-time events", "BBox/ROI anchors", "transcript spans", "audio intervals"],
      reasoning: "Micro claims are only useful when they can jump to concrete source moments.",
    },
  ];
}

function buildSignificanceWorkbenchRows(claims: SignificanceClaim[]): SignificanceWorkbenchRow[] {
  return claims.flatMap((claim) => {
    const dimensions = Object.entries(claim.significance_vector) as Array<[SignificanceDimensionKey, SignificanceDimensionValue]>;
    return dimensions.map(([dimension, value]) => ({
      id: `${claim.claim_id}:${dimension}`,
      claimId: claim.claim_id,
      scope: claim.scope,
      objectType: claim.object_type,
      title: claim.title,
      claim: claim.claim,
      claimType: claim.claim_type,
      position: claim.perspective.position,
      orientation: claim.perspective.orientation,
      expression: claim.perspective.expression,
      audience: claim.perspective.audience_profile,
      dimension,
      score: value.score,
      evidenceStrength: claim.evidence_support.evidenceStrength,
      primaryEvidenceCount: claim.evidence_support.primaryEvidenceCount,
      secondaryEvidenceCount: claim.evidence_support.secondaryEvidenceCount,
      counterEvidenceCount: claim.evidence_support.counterEvidenceCount,
      missingEvidence: claim.evidence_support.missingEvidence,
      status: claim.status,
      reasoning: value.summary || claim.reasoning,
      nextAction: claim.evidence_support.counterEvidenceCount
        ? "Compare primary and counter evidence before accepting the claim."
        : claim.evidence_support.missingEvidence.length
          ? `Surface ${claim.evidence_support.missingEvidence[0]} before accepting this claim.`
          : "Review source evidence and either accept, dispute, or request counter-evidence.",
    }));
  });
}

function buildRelevanceScannerRows(radar: RadarDimension[], claims: SignificanceClaim[]): ScannerRow[] {
  return [
    ...radar.map((dimension) => ({
      id: `scanner:relevance:${dimension.id}`,
      lane: "relevance" as const,
      dimension: dimension.label,
      score: pct(dimension.score),
      evidence: dimension.evidence,
      nextAction: dimension.nextAction,
      status: dimension.score >= 0.66 ? "strong candidate" : dimension.score >= 0.35 ? "review candidate" : "weak evidence",
    })),
    ...claims.map((claim) => ({
      id: `scanner:significance:${claim.scope}:${claim.title}`,
      lane: "significance" as const,
      dimension: `${claim.scope} / ${claim.title}`,
      score: claim.status === "candidate" ? "candidate" : "needs evidence",
      evidence: claim.evidence,
      nextAction: claim.claim,
      status: claim.status,
    })),
  ];
}

function buildSchemaEvidenceLink(
  analysisId: string,
  evidenceId: string,
  modality: "transcript" | "visual" | "audio" | "metadata" | "manual_annotation" | "network" | "multimodal",
  sourceObjectId: string,
  durationSeconds = 0,
): Record<string, unknown> {
  return {
    evidence_id: evidenceId,
    video_id: analysisId || "analysis",
    timestamp: {
      start_seconds: 0,
      end_seconds: Math.max(0, durationSeconds),
    },
    modality,
    source_object_id: sourceObjectId,
    forensic_render_available: false,
    open_source_action: {
      action_type: "jump_to_video",
      target_uri: `datascene://analysis/${analysisId || "analysis"}/time/0`,
    },
  };
}

function buildSignificanceRelevanceSchemaBundle(
  analysisId: string,
  scope: "scene" | "video" | "collection",
  audience: "analyst" | "editor" | "researcher" | "journalist",
  metrics: EvidenceMetric[],
  radar: RadarDimension[],
  claims: SignificanceClaim[],
  runArtifact: Record<string, unknown> | null,
  metadata: SourceMediaMetadata | null,
): Record<string, unknown> {
  const durationSeconds = num(metadata?.duration_seconds);
  const generatedResults = Array.isArray(runArtifact?.generated_results) ? runArtifact.generated_results : [];
  const generatedInterpretations = Array.isArray(runArtifact?.generated_interpretations)
    ? runArtifact.generated_interpretations
    : [];
  const sourceEvidence = metrics.map((metric) =>
    buildSchemaEvidenceLink(
      analysisId,
      `schema-evidence:${analysisId || "analysis"}:${metric.id}`,
      metric.id === "audio_readiness" ? "audio" : metric.id === "mature_anchors" ? "manual_annotation" : "metadata",
      metric.evidence,
      durationSeconds,
    ),
  );
  const radarDimensions = radar.map((dimension) => ({
    dimension: dimension.id,
    score: Number(dimension.score.toFixed(3)),
    reason: dimension.reason,
    linked_evidence: [
      buildSchemaEvidenceLink(
        analysisId,
        `radar-evidence:${analysisId || "analysis"}:${dimension.id}`,
        "multimodal",
        dimension.evidence,
        durationSeconds,
      ),
    ],
  }));
  const overallRelevance = radar.length
    ? Number((radar.reduce((sum, dimension) => sum + dimension.score, 0) / radar.length).toFixed(3))
    : 0;

  return {
    StatsKit: {
      schema_ref: "docs/schemas/vaa1.statskit_schema.v1.json",
      source_stats_runs: runArtifact
        ? [
            {
              run_id: typeof runArtifact.run_id === "string" ? runArtifact.run_id : `statskit:${analysisId || "analysis"}`,
              run_name: typeof runArtifact.run_name === "string" ? runArtifact.run_name : "Program StatsKit source-linked run",
            },
          ]
        : [],
      source_results: generatedResults
        .filter(isRecord)
        .map((result) => ({
          result_id: typeof result.result_id === "string" ? result.result_id : "unknown-result",
          method_id: typeof result.method_id === "string" ? result.method_id : "unknown-method",
          result_label: typeof result.result_label === "string" ? result.result_label : "StatsResult",
          confidence_score: isRecord(result.confidence) && typeof result.confidence.confidence_score === "number"
            ? result.confidence.confidence_score
            : 0,
        })),
      source_interpretations: generatedInterpretations
        .filter(isRecord)
        .map((interpretation) => ({
          interpretation_id: typeof interpretation.interpretation_id === "string"
            ? interpretation.interpretation_id
            : "unknown-interpretation",
          claim: typeof interpretation.claim === "string" ? interpretation.claim : "",
          interpretive_strength: typeof interpretation.interpretive_strength === "string"
            ? interpretation.interpretive_strength
            : "weak",
        })),
      source_evidence: sourceEvidence,
    },
    SignificanceKit: {
      schema_name: "Datascene SignificanceKit",
      schema_version: "0.1.0",
      purpose: "To support traceable significance claims about Datascene evidence, statistics, patterns, scenes, actors, and interpretations.",
      core_principle: "Significance is multidimensional, perspectival, and always linked back to source evidence.",
      claims: claims.map((claim) => ({
        claim_id: claim.claim_id,
        title: claim.title,
        claim_text: claim.claim,
        claim_status: claim.status,
        claim_type: claim.claim_type,
        scope: {
          level: claim.scope,
          object_type: claim.object_type,
          object_ids: claim.object_ids.map((id) => id.replace("active-analysis", analysisId || "analysis")),
          time_window: {
            start_seconds: 0,
            end_seconds: durationSeconds,
          },
        },
        perspective: {
          ...claim.perspective,
          audience_profile: audience === "analyst" ? claim.perspective.audience_profile : audience,
        },
        significance_vector: Object.fromEntries(
          Object.entries(claim.significance_vector).map(([dimension, value]) => [
            dimension,
            {
              ...(value || {}),
              linked_evidence: sourceEvidence,
            },
          ]),
        ),
        evidence_support: {
          primary_evidence: claim.status === "candidate" ? sourceEvidence.slice(0, Math.max(1, claim.evidence_support.primaryEvidenceCount || 1)) : [],
          secondary_evidence: sourceEvidence.slice(0, claim.evidence_support.secondaryEvidenceCount),
          counter_evidence: [],
          missing_evidence: claim.evidence_support.missingEvidence,
          evidence_strength: claim.evidence_support.evidenceStrength,
        },
        interpretive_reasoning: {
          reasoning_summary: claim.reasoning,
          assumptions: [
            "Scores are assistive and remain candidate until analyst review.",
            `Perspective is ${claim.perspective.position}, ${claim.perspective.orientation}, ${claim.perspective.expression}.`,
          ],
          alternative_interpretations: [],
          uncertainties: claim.evidence_support.missingEvidence,
          requires_human_review: true,
        },
        traceback: {
          source_video_ids: analysisId ? [analysisId] : [],
          stats_result_ids: generatedResults.filter(isRecord).map((result) => String(result.result_id || "")),
          method_ids: generatedResults.filter(isRecord).map((result) => String(result.method_id || "")),
        },
        ui_behavior: {
          show_as_badge: true,
          show_as_radar_vector: true,
          show_on_timeline: claim.scope === "micro",
          allow_click_to_source: true,
          allow_expand_reasoning: true,
          allow_show_counter_evidence: true,
          allow_compare_perspectives: true,
          allow_export_claim_card: true,
        },
      })),
      profiles: [
        {
          profile_id: "profile:analyst-verification",
          profile_name: "Analyst verification",
          intended_use: "exploratory_analysis",
          dimension_weights: {
            statistical: 0.75,
            narrative: 0.7,
            informational: 0.85,
            emotional: 0.45,
          },
          default_perspective: {
            level: scope === "scene" ? "meso" : "macro",
            position: "analyst",
            orientation: "intrinsic",
            expression: "inferred",
          },
        },
      ],
      comparisons: [],
      governance_rules: {
        no_significance_without_evidence: true,
        statistical_significance_must_report_method: true,
        interpretive_significance_requires_reasoning_summary: true,
        all_claims_must_support_counter_evidence: true,
        manual_review_required_for_high_level_claims: true,
        aggregate_claims_must_expand_to_source_evidence: true,
        perspective_must_be_explicit: true,
        significance_scores_are_assistive_not_authoritative: true,
      },
    },
    RelevanceRadar: {
      radar_id: `relevance-radar:${analysisId || "analysis"}`,
      schema_version: "0.1.0",
      purpose: "Rank and explain the relevance of Datascene evidence, patterns, scenes, actors, and interpretations for a defined analyst task.",
      relevance_context: {
        research_question: "Which source-linked statistics and claims are ready for analyst review?",
        analyst_goal: "verification",
        target_audience: audience === "analyst" ? "researcher" : audience,
        scope,
        active_lens: ["statistical", "narrative", "informational"],
      },
      relevance_scores: {
        overall_relevance: overallRelevance,
        task_relevance: Number((radar.find((dimension) => dimension.id === "task_fit")?.score || 0).toFixed(3)),
        evidence_relevance: Number((radar.find((dimension) => dimension.id === "source_strength")?.score || 0).toFixed(3)),
        novelty_relevance: 0,
        comparative_relevance: Number((radar.find((dimension) => dimension.id === "comparative_value")?.score || 0).toFixed(3)),
        interpretive_relevance: Number((radar.find((dimension) => dimension.id === "multimodal_strength")?.score || 0).toFixed(3)),
        source_relevance: Number((radar.find((dimension) => dimension.id === "source_strength")?.score || 0).toFixed(3)),
        viewer_relevance: overallRelevance,
      },
      radar_dimensions: radarDimensions,
      ui_behavior: {
        visualization_type: "ranked_list",
        click_dimension_to_filter_results: true,
        click_score_to_open_evidence: true,
        show_why_this_matters: true,
        show_counter_evidence: true,
        allow_analyst_weighting: true,
        allow_audience_profile_switching: true,
      },
      traceback: {
        source_results: generatedResults.filter(isRecord).map((result) => ({
          result_id: String(result.result_id || ""),
          method_id: String(result.method_id || ""),
          result_label: String(result.result_label || ""),
        })),
        source_significance_claims: claims.map((claim) => ({ claim_id: claim.claim_id, title: claim.title })),
        source_evidence: sourceEvidence,
        calculation_method: "Weighted source readiness over mature anchors, multimodal substrate, audio readiness, and external context.",
        analyst_weighting_profile: audience,
      },
    },
  };
}

function statsEvidenceLink(
  analysisId: string,
  metricId: string,
  modality: "transcript" | "visual" | "audio" | "metadata" | "manual_annotation" | "multimodal",
  sourceObjectId: string,
  durationSeconds = 0,
): Record<string, unknown> {
  return {
    evidence_id: `statskit-evidence:${analysisId || "analysis"}:${metricId}`,
    video_id: analysisId,
    timestamp: {
      start_seconds: 0,
      end_seconds: Math.max(0, durationSeconds),
    },
    modality,
    source_object_id: sourceObjectId,
    forensic_render_available: false,
    open_source_action: {
      action_type: "jump_to_video",
      target_uri: `datascene://analysis/${analysisId || "analysis"}/time/0`,
    },
  };
}

function evidenceIdEndsWith(item: Record<string, unknown>, suffix: string): boolean {
  return typeof item.evidence_id === "string" && item.evidence_id.endsWith(suffix);
}

function buildLocalStatsRunArtifact(
  analysisId: string,
  scope: "scene" | "video" | "collection",
  audience: "analyst" | "editor" | "researcher" | "journalist",
  metadata: SourceMediaMetadata | null,
  metrics: EvidenceMetric[],
  radar: RadarDimension[],
  claims: SignificanceClaim[],
  masterAuditRows: MasterSchemaStatsAuditRow[],
): Record<string, unknown> {
  const counts = {
    ...evidenceCountBag(metadata),
    ...Object.fromEntries(masterAuditRows.map((row) => [row.id, row.count])),
  };
  const relevanceScores = Object.fromEntries(radar.map((dimension) => [dimension.id, Number(dimension.score.toFixed(3))]));
  const matureAnchorMetric = metrics.find((metric) => metric.id === "mature_anchors");
  const multimodalMetric = metrics.find((metric) => metric.id === "multimodal_counts");
  const audioMetric = metrics.find((metric) => metric.id === "audio_readiness");
  const durationSeconds = num(metadata?.duration_seconds);
  const linkedEvidence = metrics.map((metric) =>
    statsEvidenceLink(
      analysisId,
      metric.id,
      metric.id === "audio_readiness" ? "audio" : metric.id === "mature_anchors" ? "manual_annotation" : "metadata",
      metric.evidence,
      durationSeconds,
    ),
  );
  const resultIds = {
    counts: `statskit:${analysisId}:evidence-counts`,
    radar: `statskit:${analysisId}:relevance-radar`,
    anchors: `statskit:${analysisId}:mature-anchor-count`,
    substrate: `statskit:${analysisId}:multimodal-substrate-count`,
    claims: `statskit:${analysisId}:significance-claims`,
    audio: `statskit:${analysisId}:audio-readiness`,
  };

  return {
    run_id: `statskit-source-linked-${analysisId || "analysis"}`,
    run_name: "Program StatsKit source-linked run",
    schema: "Datascene StatsRun",
    schema_version: "0.1.0",
    status: "complete",
    created_at: new Date().toISOString(),
    created_by: "datascene_ui",
    input_scope: {
      scope_type: scope,
      video_ids: analysisId ? [analysisId] : [],
    },
    audience,
    provenance: {
      provenance_id: `statskit-provenance:${analysisId || "analysis"}`,
      pipeline_version: "VAA1_StatsKit_UI_0.1.0",
      data_sources_used: [
        "source_media_metadata_json",
        "user_annotations",
        "annotation_maturity",
        "video_internal_harvest.evidence_counts",
        "maturity_iteration.evidence_counts",
      ],
      processing_log: [
        "Built source-linked StatsRun from loaded Datascene analysis metadata.",
        "StatsKit category counts were routed through the Master Schema category audit when available.",
        "Python StatsKit endpoint was unavailable in this running environment.",
      ],
      known_limitations: [
        "Transcript/audio backend methods were not executed in this local fallback run.",
        "SignificanceKit and RelevanceRadar outputs remain candidate interpretations until analyst review.",
      ],
    },
    generated_results: [
      {
        result_id: resultIds.counts,
        method_id: "source_metadata_evidence_counts",
        result_label: "Evidence count distribution",
        result_type: "distribution",
        value: counts,
        linked_evidence: linkedEvidence,
        interpretation_status: Object.keys(counts).length ? "raw" : "candidate",
        analyst_notes: Object.keys(counts).length ? [] : ["No harvested evidence-count bag is visible in source metadata."],
      },
      {
        result_id: resultIds.radar,
        method_id: "relevance_radar",
        result_label: "RelevanceRadar scores",
        result_type: "distribution",
        value: relevanceScores,
        linked_evidence: radar.map((dimension) =>
          statsEvidenceLink(analysisId, `relevance:${dimension.id}`, "multimodal", dimension.evidence, durationSeconds),
        ),
        interpretation_status: "candidate",
        analyst_notes: radar.map((dimension) => `${dimension.label}: ${dimension.reason}`),
      },
      {
        result_id: resultIds.anchors,
        method_id: "mature_anchor_count",
        result_label: "Mature anchor count",
        result_type: "scalar",
        value: Number(matureAnchorMetric?.value || 0),
        linked_evidence: linkedEvidence.filter((item) => evidenceIdEndsWith(item, ":mature_anchors")),
        interpretation_status: Number(matureAnchorMetric?.value || 0) ? "raw" : "candidate",
        analyst_notes: [matureAnchorMetric?.detail || "No mature anchor metric available."],
      },
      {
        result_id: resultIds.substrate,
        method_id: "multimodal_substrate_count",
        result_label: "Multimodal substrate count",
        result_type: "scalar",
        value: Number(multimodalMetric?.value || 0),
        linked_evidence: linkedEvidence.filter((item) => evidenceIdEndsWith(item, ":multimodal_counts")),
        interpretation_status: Number(multimodalMetric?.value || 0) ? "raw" : "candidate",
        analyst_notes: [multimodalMetric?.detail || "No multimodal substrate metric available."],
      },
      {
        result_id: resultIds.claims,
        method_id: "significancekit_claims",
        result_label: "SignificanceKit claim readiness",
        result_type: "table",
        value: claims.map((claim) => ({
          scope: claim.scope,
          title: claim.title,
          status: claim.status,
          evidence: claim.evidence,
        })),
        linked_evidence: linkedEvidence,
        interpretation_status: "candidate",
        analyst_notes: ["Claims are generated from StatsKit source metrics and require analyst review before becoming accepted interpretation."],
      },
      {
        result_id: resultIds.audio,
        method_id: "audio_readiness",
        result_label: "Audio readiness",
        result_type: "scalar",
        value: audioMetric?.missing ? 0 : 1,
        linked_evidence: linkedEvidence.filter((item) => evidenceIdEndsWith(item, ":audio_readiness")),
        interpretation_status: audioMetric?.missing ? "candidate" : "raw",
        analyst_notes: [audioMetric?.detail || "No audio readiness metric available."],
      },
    ],
    generated_visualizations: [
      {
        visualization_id: `viz:${analysisId}:evidence-counts`,
        title: "Evidence Count Distribution",
        visualization_type: "bar_chart",
        input_result_ids: [resultIds.counts],
        interactive_features: {
          click_to_source: true,
          hover_to_evidence: true,
          filter_by_modality: true,
        },
      },
      {
        visualization_id: `viz:${analysisId}:relevance-radar`,
        title: "RelevanceRadar Ranked Scores",
        visualization_type: "dashboard_card",
        input_result_ids: [resultIds.radar],
        interactive_features: {
          click_to_source: true,
          hover_to_evidence: true,
          filter_by_modality: true,
        },
      },
    ],
    generated_interpretations: claims.map((claim) => ({
      interpretation_id: `statskit-interpretation:${analysisId}:${claim.scope}:${claim.title.toLowerCase().replace(/\W+/g, "-")}`,
      title: claim.title,
      claim: claim.claim,
      claim_type: claim.scope === "macro" ? "narrative" : claim.scope === "meso" ? "temporal" : "descriptive",
      based_on_result_ids: [resultIds.claims],
      linked_evidence: linkedEvidence,
      interpretive_strength: claim.status === "candidate" ? "moderate" : "weak",
      analyst_status: "draft",
      traceback: {
        source_results: [resultIds.claims],
        source_methods: ["significancekit_claims"],
        source_evidence: linkedEvidence.map((item) => String(item.evidence_id)),
      },
    })),
  };
}

const DEFAULT_STATSKIT_METHODS = [
  {
    method_id: "method-freq-001",
    method_family: "descriptive",
    method_name: "word_frequency",
    output_type: "distribution",
    input_variables: [],
  },
  {
    method_id: "method-event-rate-001",
    method_family: "temporal",
    method_name: "event_rate_curve",
    output_type: "time_series",
    input_variables: [],
  },
  {
    method_id: "method-speech-ratio-001",
    method_family: "audio",
    method_name: "speech_ratio_analysis",
    output_type: "scalar",
    input_variables: [],
  },
];

function formatStatValue(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `${value.length} rows`;
  if (isRecord(value)) return `${Object.keys(value).length} keys`;
  return "n/a";
}

function buildSchemaCoverageRows(
  runArtifact: Record<string, unknown> | null,
  claims: SignificanceClaim[],
  radar: RadarDimension[],
  metadata: SourceMediaMetadata | null,
): SchemaCoverageRow[] {
  const generatedResults = Array.isArray(runArtifact?.generated_results) ? runArtifact.generated_results : [];
  const generatedVisualizations = Array.isArray(runArtifact?.generated_visualizations) ? runArtifact.generated_visualizations : [];
  const generatedInterpretations = Array.isArray(runArtifact?.generated_interpretations)
    ? runArtifact.generated_interpretations
    : [];
  const evidenceLinks = generatedResults.flatMap((result) =>
    isRecord(result) && Array.isArray(result.linked_evidence) ? result.linked_evidence : [],
  );

  return [
    {
      id: "coverage:statsrun",
      object: "StatsRun",
      count: runArtifact ? 1 : 0,
      source: runArtifact ? "backend or local source-linked run" : "run button",
      status: runArtifact ? "populated" : "not run",
      nextAction: runArtifact ? "Inspect result rows and visualizations." : "Run StatsKit for a governed artifact.",
    },
    {
      id: "coverage:statsresult",
      object: "StatsResult",
      count: generatedResults.length,
      source: "generated_results",
      status: generatedResults.length ? "populated" : "missing",
      nextAction: generatedResults.length ? "Sort/visualize measured rows." : "Run transcript/audio/source methods.",
    },
    {
      id: "coverage:evidencelink",
      object: "EvidenceLink",
      count: evidenceLinks.length,
      source: "linked_evidence",
      status: evidenceLinks.length ? "source-linked" : metadata ? "metadata available" : "missing",
      nextAction: evidenceLinks.length ? "Use linked evidence for traceback." : "Load source metadata or run StatsKit.",
    },
    {
      id: "coverage:visualization",
      object: "StatsVisualization",
      count: generatedVisualizations.length,
      source: "generated_visualizations + panel modes",
      status: generatedVisualizations.length ? "available" : "panel-only",
      nextAction: "Choose evidence, relevance, result, significance, or schema view.",
    },
    {
      id: "coverage:interpretation",
      object: "StatsInterpretation",
      count: generatedInterpretations.length,
      source: "generated_interpretations",
      status: generatedInterpretations.length ? "draft" : "missing",
      nextAction: "Review claims before accepting interpretation.",
    },
    {
      id: "coverage:significance",
      object: "SignificanceClaim",
      count: claims.length,
      source: "SignificanceKit candidate claims",
      status: claims.length ? "candidate" : "missing",
      nextAction: "Open significance table and inspect evidence.",
    },
    {
      id: "coverage:relevance",
      object: "RelevanceRadar",
      count: radar.length,
      source: "radar_dimensions",
      status: radar.length ? "candidate ranking" : "missing",
      nextAction: "Use relevance scanner to prioritize review.",
    },
  ];
}

function buildSignificanceRelevanceDeliveryAudit(
  schemaBundle: Record<string, unknown>,
  runArtifact: Record<string, unknown> | null,
  claims: SignificanceClaim[],
  radar: RadarDimension[],
  statsRows: StatsTableRow[],
): SchemaDeliveryAuditRow[] {
  const generatedResults = Array.isArray(runArtifact?.generated_results) ? runArtifact.generated_results.filter(isRecord) : [];
  const statsKit = isRecord(schemaBundle.StatsKit) ? schemaBundle.StatsKit : {};
  const significanceKit = isRecord(schemaBundle.SignificanceKit) ? schemaBundle.SignificanceKit : {};
  const relevanceRadar = isRecord(schemaBundle.RelevanceRadar) ? schemaBundle.RelevanceRadar : {};
  const sourceResults = Array.isArray(statsKit.source_results) ? statsKit.source_results : [];
  const sourceEvidence = Array.isArray(statsKit.source_evidence) ? statsKit.source_evidence : [];
  const candidateClaims = claims.filter((claim) => claim.status === "candidate").length;
  const missingClaims = claims.flatMap((claim) => claim.missingEvidence);
  const computedStats = statsRows.filter((row) => ["computed", "candidate", "raw"].includes(row.status)).length;
  const missingStats = statsRows.length - computedStats;
  const uiBehavior = isRecord(relevanceRadar.ui_behavior) ? relevanceRadar.ui_behavior : {};
  const clickFilterDeclared = uiBehavior.click_dimension_to_filter_results === true;

  return [
    {
      id: "delivery:statskit-results",
      schemaObject: "StatsKit / StatsResult",
      status: sourceResults.length || generatedResults.length ? "partial" : "not_operational",
      delivered: `${sourceResults.length || generatedResults.length} StatsResult reference(s); ${computedStats} workbench rows have a computable or candidate source path.`,
      missing: missingStats
        ? `${missingStats} workbench rows still need source layers before StatsKit can compute actuals.`
        : "No visible StatsKit row is blocked in the current family set.",
      nextAction: "Route every StatsKit row through Master Schema evidence, then persist source-linked StatsResult rows from the backend run.",
    },
    {
      id: "delivery:evidence-links",
      schemaObject: "EvidenceLink / Traceback",
      status: sourceEvidence.length ? "partial" : "not_operational",
      delivered: `${sourceEvidence.length} source-evidence link(s) are present in the schema bundle.`,
      missing: "Most links are analysis-level fallback anchors; row-level source jumps, BBox/ROI targets, timed transcript spans, and audio intervals are not complete for every claim.",
      nextAction: "Attach each StatsResult, RelevanceRadar dimension, and SignificanceClaim to concrete EvidenceLink rows with source actions.",
    },
    {
      id: "delivery:significance-claims",
      schemaObject: "SignificanceKit / SignificanceClaim",
      status: candidateClaims ? "partial" : "not_operational",
      delivered: `${claims.length} macro/meso/micro claim shell(s), ${candidateClaims} candidate claim(s), reasoning summaries, perspective, and traceback fields.`,
      missing: missingClaims.length
        ? `Missing mature support includes ${[...new Set(missingClaims)].slice(0, 5).join(", ")}. Counter-evidence and alternate interpretations are still empty.`
        : "Claims have candidate evidence, but counter_evidence, alternate interpretations, and accepted analyst review are still not delivered.",
      nextAction: "Generate claims from selected StatsResults and require primary, secondary, counter_evidence, and source-action support before acceptance.",
    },
    {
      id: "delivery:relevance-context",
      schemaObject: "RelevanceRadar / RelevanceContext",
      status: radar.length ? "partial" : "not_operational",
      delivered: `${radar.length} relevance dimension(s) with scores, reasons, evidence labels, and next actions.`,
      missing: "Scores are readiness heuristics over available evidence; analyst weighting, task-specific lens interaction, and result filtering are not yet operational.",
      nextAction: "Bind relevance dimensions to selected StatsResults, analyst weights, audience profile, and source-evidence filters.",
    },
    {
      id: "delivery:ui-behavior",
      schemaObject: "RelevanceRadar / ui_behavior",
      status: clickFilterDeclared ? "partial" : "not_operational",
      delivered: clickFilterDeclared
        ? "The schema declares click_dimension_to_filter_results, click_score_to_open_evidence, counter-evidence display, and analyst weighting."
        : "The schema bundle is present, but RelevanceRadar interaction behavior is not declared.",
      missing: "Declared behavior is schema-shaped but not yet fully operational in the panel: clicking a scanner row inspects it, but does not filter StatsResults or jump to source evidence yet.",
      nextAction: "Implement scanner-row filtering, evidence drilldown, counter-evidence panels, and analyst weighting controls.",
    },
  ];
}

function visualizationData(
  mode: VisualizationMode,
  rows: StatsTableRow[],
): VisualizationDatum[] {
  const matchesMode = (row: StatsTableRow) => {
    if (mode === "percent_bars") return row.unit === "%";
    if (mode === "duration_bars") return row.unit === "seconds" || row.unit === "events/min";
    if (mode === "histogram") return row.method === "histogram" || row.family === "distribution";
    if (mode === "boxplot") return row.method === "boxplot" || row.family === "distribution";
    if (mode === "heatmap") return row.family === "cross_tabulation" || row.family === "correlation";
    if (mode === "timeline") return row.family === "temporal" || row.family === "narrative";
    if (mode === "network_graph") return row.family === "social_network";
    if (mode === "table") return true;
    return row.status === "computed" || row.status === "candidate" || row.status === "raw";
  };

  return rows
    .filter(matchesMode)
    .map((row): VisualizationDatum | null => {
      const value = typeof row.value === "number" ? row.value : Number(String(row.value).replace("%", ""));
      if (!Number.isFinite(value)) return null;
      return {
        id: row.id,
        label: row.statistic,
        value,
        detail: `${row.level} / ${row.method} / ${row.evidence}`,
        group: row.family,
        status: row.status,
      };
    })
    .filter((row): row is VisualizationDatum => Boolean(row))
    .sort((a, b) => b.value - a.value)
    .slice(0, 18);
}

function isVisualizable(row: StatsTableRow | null, mode: VisualizationMode): boolean {
  if (!row) return false;
  return row.visualizationTypes.includes(mode);
}

function selectedVisualizationData(
  selectedRows: StatsTableRow[],
  mode: VisualizationMode,
  peerRows: StatsTableRow[],
): VisualizationDatum[] {
  const visualizableRows = selectedRows.filter((row) => ["computed", "candidate", "raw"].includes(row.status));
  if (!visualizableRows.length) return visualizationData(mode, peerRows);
  if (mode === "table") return visualizationData("table", peerRows);
  const values = visualizableRows
    .map((row): VisualizationDatum | null => {
      const value = typeof row.value === "number" ? row.value : Number(String(row.value).replace("%", ""));
      if (!Number.isFinite(value)) return null;
      return {
        id: row.id,
        label: row.statistic,
        value,
        detail: `${row.level} / ${row.method} / ${row.evidence}`,
        group: row.family,
        status: row.status,
      };
    })
    .filter((row): row is VisualizationDatum => Boolean(row));
  if (values.length) return values;
  return visualizationData(mode, peerRows.filter((peer) => visualizableRows.some((row) => peer.method === row.method)));
}

function significanceVisualizationData(rows: SignificanceWorkbenchRow[]): VisualizationDatum[] {
  return rows.map((row) => ({
    id: row.id,
    label: `${row.dimension} / ${row.scope}`,
    value: Math.round(row.score * 100),
    detail: `${row.title} / ${row.position} / ${row.orientation} / ${row.expression}`,
    group: row.dimension,
    status: row.status,
  }));
}

function relevanceVisualizationData(radar: RadarDimension[]): VisualizationDatum[] {
  return radar.map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    value: Math.round(dimension.score * 100),
    detail: `${dimension.reason} / ${dimension.evidence}`,
    group: "relevance",
    status: dimension.score >= 0.66 ? "strong candidate" : dimension.score >= 0.35 ? "review candidate" : "weak evidence",
  }));
}

function scannerVisualizationData(rows: ScannerRow[]): VisualizationDatum[] {
  return rows
    .map((row): VisualizationDatum | null => {
      const value = typeof row.score === "number" ? row.score : Number(String(row.score).replace("%", ""));
      if (!Number.isFinite(value)) return null;
      return {
        id: row.id,
        label: row.dimension,
        value,
        detail: `${row.lane} / ${row.evidence} / ${row.nextAction}`,
        group: row.lane,
        status: row.status,
      };
    })
    .filter((row): row is VisualizationDatum => Boolean(row));
}

function quartiles(values: number[]): { min: number; q1: number; median: number; q3: number; max: number } | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const pick = (index: number) => sorted[Math.max(0, Math.min(sorted.length - 1, index))];
  return {
    min: sorted[0],
    q1: pick(Math.floor((sorted.length - 1) * 0.25)),
    median: pick(Math.floor((sorted.length - 1) * 0.5)),
    q3: pick(Math.floor((sorted.length - 1) * 0.75)),
    max: sorted[sorted.length - 1],
  };
}

function VisualizationRenderer({
  mode,
  data,
  target,
}: {
  mode: VisualizationMode;
  data: VisualizationDatum[];
  target: VisualizationTarget;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const minValue = Math.min(0, ...data.map((item) => item.value));
  const distribution = quartiles(data.map((item) => item.value));
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const bucketMin = minValue + ((maxValue - minValue) / 6) * index;
    const bucketMax = index === 5 ? maxValue : minValue + ((maxValue - minValue) / 6) * (index + 1);
    const count = data.filter((item) => item.value >= bucketMin && item.value <= bucketMax && (index === 5 || item.value < bucketMax)).length;
    return { id: `bucket:${index}`, label: `${Math.round(bucketMin)}-${Math.round(bucketMax)}`, value: count };
  });
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.value));

  if (!data.length) {
    return (
      <div className="rounded border border-amber-900/50 bg-amber-950/10 px-3 py-2 text-[10px] text-amber-100">
        No numeric {target} data is available for this visualization yet.
      </div>
    );
  }

  if (mode === "table") {
    return (
      <div className="overflow-auto rounded border border-slate-800" data-vaa1-visualization-mode-table="true">
        <table className="w-full border-collapse text-left text-[9px]">
          <thead className="bg-[#151515] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="border-b border-slate-800 px-2 py-1.5">Label</th>
              <th className="border-b border-slate-800 px-2 py-1.5">Value</th>
              <th className="border-b border-slate-800 px-2 py-1.5">Group</th>
              <th className="border-b border-slate-800 px-2 py-1.5">Detail</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="border-b border-slate-950">
                <td className="px-2 py-1.5 font-semibold text-slate-100">{item.label}</td>
                <td className="px-2 py-1.5 font-mono text-cyan-100">{item.value}</td>
                <td className="px-2 py-1.5 text-slate-400">{item.group}</td>
                <td className="px-2 py-1.5 text-slate-500">{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (mode === "histogram") {
    return (
      <div className="grid grid-cols-6 items-end gap-2 rounded border border-slate-800 px-3 py-2" data-vaa1-visualization-mode-histogram="true">
        {buckets.map((bucket) => (
          <div key={bucket.id} className="grid gap-1">
            <div className="flex h-28 items-end rounded bg-slate-950">
              <div className="w-full rounded bg-cyan-500/80" style={{ height: `${Math.max(4, (bucket.value / maxBucket) * 100)}%` }} />
            </div>
            <div className="truncate text-center text-[8px] text-slate-500">{bucket.label}</div>
            <div className="text-center font-mono text-[9px] text-cyan-100">{bucket.value}</div>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "boxplot" && distribution) {
    const range = Math.max(1, distribution.max - distribution.min);
    const left = ((distribution.q1 - distribution.min) / range) * 100;
    const width = Math.max(2, ((distribution.q3 - distribution.q1) / range) * 100);
    const median = ((distribution.median - distribution.min) / range) * 100;
    return (
      <div className="rounded border border-slate-800 px-3 py-4" data-vaa1-visualization-mode-boxplot="true">
        <div className="relative h-14">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-700" />
          <div className="absolute top-4 h-6 rounded border border-cyan-400/80 bg-cyan-500/20" style={{ left: `${left}%`, width: `${width}%` }} />
          <div className="absolute top-2 h-10 w-px bg-cyan-100" style={{ left: `${median}%` }} />
        </div>
        <div className="grid grid-cols-5 gap-1 text-center font-mono text-[9px] text-slate-400">
          <span>min {Math.round(distribution.min)}</span>
          <span>q1 {Math.round(distribution.q1)}</span>
          <span>med {Math.round(distribution.median)}</span>
          <span>q3 {Math.round(distribution.q3)}</span>
          <span>max {Math.round(distribution.max)}</span>
        </div>
      </div>
    );
  }

  if (mode === "heatmap") {
    return (
      <div className="grid grid-cols-4 gap-1 rounded border border-slate-800 px-3 py-2" data-vaa1-visualization-mode-heatmap="true">
        {data.slice(0, 16).map((item) => (
          <div
            key={item.id}
            className="min-h-[54px] rounded border border-slate-800 px-2 py-1"
            style={{ backgroundColor: `rgba(34, 211, 238, ${0.12 + (item.value / maxValue) * 0.55})` }}
            title={item.detail}
          >
            <div className="truncate text-[8px] text-slate-200">{item.label}</div>
            <div className="mt-1 font-mono text-[10px] text-cyan-50">{item.value}</div>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "timeline") {
    return (
      <div className="rounded border border-slate-800 px-3 py-3" data-vaa1-visualization-mode-timeline="true">
        <div className="relative h-20 border-b border-slate-800">
          {data.map((item, index) => (
            <div
              key={item.id}
              className="absolute bottom-0 w-2 rounded-t bg-cyan-400"
              style={{
                left: `${data.length === 1 ? 50 : (index / (data.length - 1)) * 96}%`,
                height: `${Math.max(8, (item.value / maxValue) * 72)}px`,
              }}
              title={`${item.label}: ${item.value}`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between gap-2 text-[8px] text-slate-500">
          <span>{data[0]?.label}</span>
          <span>{data[data.length - 1]?.label}</span>
        </div>
      </div>
    );
  }

  if (mode === "network_graph") {
    return (
      <div className="rounded border border-slate-800 px-3 py-3" data-vaa1-visualization-mode-network="true">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {data.slice(0, 12).map((item) => (
            <div key={item.id} className="grid h-20 w-20 place-items-center rounded-full border border-cyan-700/70 bg-cyan-950/20 px-2 text-center" title={item.detail}>
              <div>
                <div className="line-clamp-2 text-[8px] font-semibold text-slate-100">{item.label}</div>
                <div className="mt-1 font-mono text-[10px] text-cyan-100">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-center text-[8px] text-slate-500">Node size is fixed; value is shown inside each node for inspectable comparison.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-vaa1-visualization-mode-bars="true">
      {data.map((item) => (
        <div key={item.id} className="grid grid-cols-[120px_1fr_42px] items-center gap-2">
          <div className="truncate text-[9px] text-slate-400" title={item.label}>{item.label}</div>
          <div className="h-3 overflow-hidden rounded bg-slate-900">
            <div
              className="h-3 rounded bg-cyan-400"
              style={{ width: `${Math.max(3, Math.round((item.value / maxValue) * 100))}%` }}
            />
          </div>
          <div className="text-right font-mono text-[9px] text-cyan-100">{mode === "percent_bars" ? `${item.value}%` : item.value}</div>
        </div>
      ))}
    </div>
  );
}

function buildMissingDataRows(rows: StatsTableRow[]): MissingDataRow[] {
  const blockedRows = rows.filter((row) => !["computed", "candidate", "raw"].includes(row.status));
  const grouped = blockedRows.reduce<Record<string, StatsTableRow[]>>((acc, row) => {
    const key = row.requiredLayer || row.evidence || "unclassified source layer";
    acc[key] = [...(acc[key] || []), row];
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([sourceLayer, layerRows]) => ({
      id: `missing:${sourceLayer.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      sourceLayer,
      blockedRows: layerRows.length,
      examples: layerRows.slice(0, 4).map((row) => row.statistic).join(" / "),
      reason: layerRows.some((row) => row.status === "needs corpus")
        ? "The current scope does not expose a governed comparative corpus."
        : "StatsKit cannot compute this honestly until the source layer exposes timed, linked rows.",
      nextAction: layerRows.some((row) => row.requiredLayer.includes("audio") || row.requiredLayer.includes("VAD"))
        ? "Run or repair audio diarization/VAD/music/noise extraction and persist intervals."
        : layerRows.some((row) => row.requiredLayer.includes("speaker"))
          ? "Link transcript turns to speakers and persist timed speaker intervals."
          : layerRows.some((row) => row.requiredLayer.includes("shot"))
            ? "Load shot boundary intervals and scene transition records."
            : "Surface this layer in the active analysis artifact with EvidenceLink-compatible anchors.",
    }))
    .sort((a, b) => b.blockedRows - a.blockedRows);
}

function StatsKitPanel({ analysisId, videoId }: StatsKitPanelProps) {
  const [activeAnalysisId, setActiveAnalysisId] = useState(analysisId || videoId || "");
  const [metadata, setMetadata] = useState<SourceMediaMetadata | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "complete" | "failed">("idle");
  const [runSummary, setRunSummary] = useState("");
  const [runArtifact, setRunArtifact] = useState<Record<string, unknown> | null>(null);
  const [scope, setScope] = useState<"scene" | "video" | "collection">("video");
  const [audience, setAudience] = useState<"analyst" | "editor" | "researcher" | "journalist">("analyst");
  const [statFamily, setStatFamily] = useState<StatsFamily>("descriptive");
  const [visualization, setVisualization] = useState<VisualizationMode>("bar_chart");
  const [visualizationTarget, setVisualizationTarget] = useState<VisualizationTarget>("stats");
  const [selectedStatId, setSelectedStatId] = useState("");
  const [selectedStatIds, setSelectedStatIds] = useState<string[]>([]);
  const [selectedScannerRowId, setSelectedScannerRowId] = useState("");
  const [selectedScannerRowIds, setSelectedScannerRowIds] = useState<string[]>([]);
  const [selectedSignificanceRowId, setSelectedSignificanceRowId] = useState("");
  const [selectedSignificanceRowIds, setSelectedSignificanceRowIds] = useState<string[]>([]);
  const [significancePositionFilter, setSignificancePositionFilter] = useState<"all" | SignificancePosition>("all");
  const [significanceOrientationFilter, setSignificanceOrientationFilter] = useState<"all" | SignificanceOrientation>("all");
  const [significanceExpressionFilter, setSignificanceExpressionFilter] = useState<"all" | SignificanceExpression>("all");
  const [significanceDimensionFilter, setSignificanceDimensionFilter] = useState<"all" | SignificanceDimensionKey>("all");
  const [statColumnWidths, setStatColumnWidths] =
    useState<Record<StatsWorkbenchColumn, number>>(DEFAULT_STAT_COLUMN_WIDTHS);

  useEffect(() => {
    const handler = (payload?: unknown) => {
      const nextId = typeof payload === "string"
        ? payload
        : isRecord(payload)
          ? String(payload.analysisId || payload.videoId || payload.id || "")
          : "";
      if (nextId) setActiveAnalysisId(nextId);
    };
    eventBus.on("videoIdChanged", handler);
    return () => {
      eventBus.off("videoIdChanged", handler);
    };
  }, []);

  useEffect(() => {
    const nextId = analysisId || videoId || "";
    if (!nextId) return;
    void Promise.resolve().then(() => setActiveAnalysisId(nextId));
  }, [analysisId, videoId]);

  useEffect(() => {
    if (!activeAnalysisId) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setIsLoading(true);
        setLoadError("");
      }
    });
    Promise.allSettled([
      apiService.getSourceMediaMetadata(activeAnalysisId),
      VideoService.getAnalysis(activeAnalysisId),
    ])
      .then(([metadataResult, analysisResult]) => {
        if (cancelled) return;
        if (metadataResult.status === "fulfilled") {
          setMetadata(metadataResult.value);
        } else {
          setMetadata(null);
        }
        if (analysisResult.status === "fulfilled") {
          setAnalysisData(analysisResult.value);
          if (metadataResult.status === "rejected") {
            setMetadata(analysisResult.value.metadata?.sourceMediaMetadata || null);
          }
        } else {
          setAnalysisData(null);
        }
        if (metadataResult.status === "rejected" && analysisResult.status === "rejected") {
          throw metadataResult.reason || analysisResult.reason;
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMetadata(null);
          setAnalysisData(null);
          setLoadError(error instanceof Error ? error.message : "Source metadata load failed");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAnalysisId]);

  const masterAuditRows = useMemo(
    () => buildMasterSchemaStatsAudit(analysisData, metadata),
    [analysisData, metadata],
  );
  const metrics = useMemo(() => buildMetrics(metadata, analysisData), [metadata, analysisData]);
  const radar = useMemo(() => buildRadar(metrics), [metrics]);
  const claims = useMemo(() => buildSignificance(metrics, radar), [metrics, radar]);
  const significanceWorkbenchRows = useMemo(() => buildSignificanceWorkbenchRows(claims), [claims]);
  const scannerRows = useMemo(() => buildRelevanceScannerRows(radar, claims), [radar, claims]);
  const overall = radar.length
    ? radar.reduce((sum, dimension) => sum + dimension.score, 0) / radar.length
    : 0;

  const runStatsKit = async () => {
    if (!activeAnalysisId) {
      setRunStatus("failed");
      setRunSummary("Select or open an analysis before running StatsKit. The workbench still shows required statistical rows.");
      return;
    }
    setRunStatus("running");
    setRunSummary("Running source-linked transcript/audio StatsKit methods...");
    try {
      const result = await apiService.runStatsKit(activeAnalysisId, {
        run_name: "Program StatsKit quick run",
        created_by: "datascene_ui",
        input_scope: {
          scope_type: scope,
          video_ids: [activeAnalysisId],
        },
        selected_methods: DEFAULT_STATSKIT_METHODS,
      });
      const resultCount = arrayCount(result.generated_results);
      const runId = typeof result.run_id === "string" ? result.run_id : "StatsRun";
      setRunArtifact(result);
      setRunStatus("complete");
      setRunSummary(`${runId} complete with ${resultCount} source-linked result(s).`);
      setVisualization("bar_chart");
    } catch (error) {
      const message = error instanceof Error ? error.message : "StatsKit run failed";
      if (message.includes("404")) {
        const fallbackRun = buildLocalStatsRunArtifact(
          activeAnalysisId,
          scope,
          audience,
          metadata,
          metrics,
          radar,
          claims,
          masterAuditRows,
        );
        setRunArtifact(fallbackRun);
        setRunStatus("complete");
        setRunSummary(
          "Python StatsKit endpoint unavailable; built a source-linked StatsRun from loaded Datascene metadata.",
        );
        setVisualization("bar_chart");
      } else {
        setRunStatus("failed");
        setRunSummary(message);
      }
    }
  };

  const statsRows = useMemo(
    () => buildSubstanceRows(metadata, analysisData, metrics, radar, runArtifact, masterAuditRows),
    [metadata, analysisData, metrics, radar, runArtifact, masterAuditRows],
  );
  const schemaCoverageRows = buildSchemaCoverageRows(runArtifact, claims, radar, metadata);
  const schemaBundle = useMemo(
    () => buildSignificanceRelevanceSchemaBundle(activeAnalysisId, scope, audience, metrics, radar, claims, runArtifact, metadata),
    [activeAnalysisId, scope, audience, metrics, radar, claims, runArtifact, metadata],
  );
  const significanceRelevanceDeliveryAudit = useMemo(
    () => buildSignificanceRelevanceDeliveryAudit(schemaBundle, runArtifact, claims, radar, statsRows),
    [schemaBundle, runArtifact, claims, radar, statsRows],
  );
  const selectedFamily = STAT_FAMILY_OPTIONS.find((option) => option.id === statFamily) || STAT_FAMILY_OPTIONS[0];
  const visibleStatsRows = statsRows.filter((row) => row.family === statFamily);
  const visibleStatsRowIds = visibleStatsRows.map((row) => row.id).join("|");
  const selectedStat = visibleStatsRows.find((row) => row.id === selectedStatId) || visibleStatsRows[0] || null;
  const selectedStatsForVisualization = visibleStatsRows.filter((row) => selectedStatIds.includes(row.id));
  const visualizationRows = selectedStatsForVisualization.length
    ? selectedStatsForVisualization
    : selectedStat
      ? [selectedStat]
      : [];
  const computedRows = visibleStatsRows.filter((row) => ["computed", "candidate", "raw"].includes(row.status)).length;
  const missingRows = visibleStatsRows.length - computedRows;
  const filteredSignificanceRows = significanceWorkbenchRows.filter((row) =>
    (significancePositionFilter === "all" || row.position === significancePositionFilter) &&
    (significanceOrientationFilter === "all" || row.orientation === significanceOrientationFilter) &&
    (significanceExpressionFilter === "all" || row.expression === significanceExpressionFilter) &&
    (significanceDimensionFilter === "all" || row.dimension === significanceDimensionFilter),
  );
  const selectedSignificanceRowsForVisualization = filteredSignificanceRows.filter((row) => selectedSignificanceRowIds.includes(row.id));
  const selectedScannerRowsForVisualization = scannerRows.filter((row) => selectedScannerRowIds.includes(row.id));
  const statsPlottedData = selectedVisualizationData(visualizationRows, visualization, visibleStatsRows);
  const significancePlottedData = significanceVisualizationData(
    selectedSignificanceRowsForVisualization.length
      ? selectedSignificanceRowsForVisualization
      : filteredSignificanceRows,
  );
  const relevancePlottedData = scannerVisualizationData(
    selectedScannerRowsForVisualization.length
      ? selectedScannerRowsForVisualization
      : scannerRows,
  );
  const plottedData = visualizationTarget === "significance"
    ? significancePlottedData
    : visualizationTarget === "relevance"
      ? relevancePlottedData
      : statsPlottedData;
  const missingDataRows = buildMissingDataRows(statsRows);
  const sourceLayerDeliverables = useMemo(
    () => buildStatsKitSourceLayerDeliverables(analysisData),
    [analysisData],
  );
  const selectedCanVisualize = plottedData.length > 0;
  const selectedResultCount = isRecord(schemaBundle.StatsKit) && Array.isArray(schemaBundle.StatsKit.source_results)
    ? schemaBundle.StatsKit.source_results.length
    : 0;
  const selectedScannerRow = scannerRows.find((row) => row.id === selectedScannerRowId) || scannerRows[0] || null;
  const selectedSignificanceRow =
    filteredSignificanceRows.find((row) => row.id === selectedSignificanceRowId) ||
    filteredSignificanceRows[0] ||
    null;
  const sourceName = metadata?.original_filename || metadata?.analysis_id || activeAnalysisId || "no analysis";
  const duration = num(metadata?.duration_seconds);
  const compactIndicators = [
    `${metadata ? "source loaded" : "source missing"}`,
    `${duration ? `${duration.toFixed(1)}s` : "duration n/a"}`,
    `${analysisData?.masterSchemaResolvedEvidence?.records?.length || 0} master records`,
    `${visibleStatsRows.length} ${selectedFamily.label}`,
    `${visualizationRows.length} selected`,
    `${computedRows} computed / ${missingRows} missing`,
    `${runStatus}`,
  ];

  useEffect(() => {
    if (!visibleStatsRows.length) {
      setSelectedStatId("");
      setSelectedStatIds([]);
      return;
    }
    if (!selectedStatId || !visibleStatsRows.some((row) => row.id === selectedStatId)) {
      setSelectedStatId(visibleStatsRows[0].id);
    }
    const visibleIds = new Set(visibleStatsRows.map((row) => row.id));
    setSelectedStatIds((current) => {
      const filtered = current.filter((id) => visibleIds.has(id));
      return filtered.length === current.length ? current : filtered;
    });
  }, [selectedStatId, visibleStatsRowIds]);

  const toggleVisualizationRow = (rowId: string) => {
    setSelectedStatIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    );
  };

  const toggleSignificanceVisualizationRow = (rowId: string) => {
    setSelectedSignificanceRowIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    );
  };

  const toggleScannerVisualizationRow = (rowId: string) => {
    setSelectedScannerRowIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    );
  };

  const setColumnWidth = (column: StatsWorkbenchColumn, width: number) => {
    setStatColumnWidths((current) => ({
      ...current,
      [column]: width,
    }));
  };

  const resetColumnWidths = () => setStatColumnWidths(DEFAULT_STAT_COLUMN_WIDTHS);

  return (
    <section className="h-full overflow-auto bg-[#151515] p-3 text-[11px] text-slate-200" data-vaa1-statskit-panel="true">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-900/50 bg-[#101010] px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">StatsKit</div>
          <div className="mt-1 truncate text-[10px] text-slate-400">{sourceName}</div>
        </div>
        <div className="flex flex-wrap gap-1 text-[9px] uppercase tracking-[0.12em] text-slate-400">
          {compactIndicators.map((indicator) => (
            <span key={indicator} className="rounded border border-slate-800 bg-[#090909] px-2 py-1">
              {indicator}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 grid gap-2 xl:grid-cols-[1fr_190px_150px_150px_150px_130px]">
        <label className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
          <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500">Active analysis</span>
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] text-slate-100"
            value={activeAnalysisId}
            onChange={(event) => setActiveAnalysisId(event.target.value)}
            placeholder="Select an analysis"
          />
        </label>
        <label className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
          <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500">Stats family</span>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] text-slate-100"
            value={statFamily}
            onChange={(event) => setStatFamily(event.target.value as StatsFamily)}
          >
            {STAT_FAMILY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
          <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500">Scope</span>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] text-slate-100"
            value={scope}
            onChange={(event) => setScope(event.target.value as "scene" | "video" | "collection")}
          >
            <option value="scene">Scene</option>
            <option value="video">Video</option>
            <option value="collection">Collection</option>
          </select>
        </label>
        <label className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
          <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500">Visualization</span>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] text-slate-100"
            value={visualization}
            onChange={(event) => setVisualization(event.target.value as VisualizationMode)}
          >
            <option value="bar_chart">Bar chart</option>
            <option value="percent_bars">Percent bars</option>
            <option value="duration_bars">Duration/rate bars</option>
            <option value="histogram">Histogram</option>
            <option value="boxplot">Boxplot</option>
            <option value="heatmap">Heatmap</option>
            <option value="timeline">Timeline</option>
            <option value="network_graph">Network graph</option>
            <option value="table">Table</option>
          </select>
        </label>
        <label className="hidden rounded border border-slate-800 bg-[#101010] px-2 py-1.5 xl:block">
          <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500">Audience</span>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] text-slate-100"
            value={audience}
            onChange={(event) => setAudience(event.target.value as "analyst" | "editor" | "researcher" | "journalist")}
          >
            <option value="analyst">Analyst</option>
            <option value="editor">Editor</option>
            <option value="researcher">Researcher</option>
            <option value="journalist">Journalist</option>
          </select>
        </label>
        <button
          type="button"
          className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-40"
          disabled={runStatus === "running"}
          onClick={runStatsKit}
          data-vaa1-run-statskit="true"
        >
          {runStatus === "running" ? "Running..." : "Run StatsKit"}
        </button>
      </div>

      {(isLoading || loadError || runSummary) && (
        <div className="mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2 text-[10px] text-slate-300">
          {isLoading ? "Loading source metadata..." : null}
          {loadError ? <span className="text-amber-200">{loadError}</span> : null}
          {runSummary ? (
            <span className={runStatus === "failed" ? "text-rose-200" : "text-cyan-100"}>{runSummary}</span>
          ) : null}
        </div>
      )}

      <div className="mt-2 grid gap-2 xl:grid-cols-[1.35fr_0.65fr]" data-vaa1-statskit-ordered-workbench-layout="true">
        <details className="order-1 overflow-hidden rounded border border-slate-800 bg-[#101010] xl:col-start-1 xl:row-start-1" open data-vaa1-statskit-source-signals="true" data-vaa1-statskit-workbench-collapsible="true" data-vaa1-statskit-box-collapsible="true" data-vaa1-statskit-layout-slot="A">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Stats workbench table</div>
              <div className="mt-0.5 text-[9px] text-slate-500">{selectedFamily.description}</div>
            </div>
            <div className="text-right text-[9px] uppercase tracking-[0.12em] text-slate-500">
              <div>{visibleStatsRows.length} rows</div>
              <div>{selectedStatIds.length || (selectedStat ? 1 : 0)} selected</div>
            </div>
          </summary>
          <div className="border-b border-slate-800 px-3 py-2" data-vaa1-statskit-column-controls="true">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className="rounded border border-cyan-700/50 bg-cyan-950/20 px-2 py-1 text-[9px] font-semibold text-cyan-100 hover:bg-cyan-900/30"
                  onClick={() => setSelectedStatIds(visibleStatsRows.filter((row) => {
                    const value = typeof row.value === "number" ? row.value : Number(String(row.value).replace("%", ""));
                    return ["computed", "candidate", "raw"].includes(row.status) && Number.isFinite(value);
                  }).map((row) => row.id))}
                  data-vaa1-statskit-select-all-visible="true"
                  data-vaa1-statskit-check-all="true"
                >
                  Check all
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[9px] text-slate-300 hover:bg-slate-900"
                  onClick={() => setSelectedStatIds([])}
                  data-vaa1-statskit-clear-selection="true"
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[9px] text-slate-300 hover:bg-slate-900"
                  onClick={resetColumnWidths}
                  data-vaa1-statskit-reset-column-widths="true"
                >
                  Reset columns
                </button>
              </div>
              <div className="text-[9px] text-slate-500">Checked rows render together when the selected visualization accepts their values.</div>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {ADJUSTABLE_STAT_COLUMNS.map((column) => (
                <label key={column.id} className="grid grid-cols-[70px_1fr_42px] items-center gap-2 text-[9px] text-slate-400">
                  <span>{column.label}</span>
                  <input
                    type="range"
                    min={column.min}
                    max={column.max}
                    value={statColumnWidths[column.id]}
                    onChange={(event) => setColumnWidth(column.id, Number(event.target.value))}
                    className="w-full accent-cyan-400"
                    data-vaa1-statskit-column-width-slider="true"
                  />
                  <span className="text-right font-mono text-slate-500">{statColumnWidths[column.id]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto" data-vaa1-statskit-workbench-table-uses-panel-height="true">
            <table
              className="table-fixed border-collapse text-left text-[10px]"
              style={{ minWidth: Object.values(statColumnWidths).reduce((sum, width) => sum + width, 0) }}
            >
              <colgroup>
                <col style={{ width: statColumnWidths.select }} />
                <col style={{ width: statColumnWidths.level }} />
                <col style={{ width: statColumnWidths.method }} />
                <col style={{ width: statColumnWidths.statistic }} />
                <col style={{ width: statColumnWidths.value }} />
                <col style={{ width: statColumnWidths.unit }} />
                <col style={{ width: statColumnWidths.evidence }} />
                <col style={{ width: statColumnWidths.status }} />
                <col style={{ width: statColumnWidths.note }} />
              </colgroup>
              <thead className="sticky top-0 bg-[#151515] text-[9px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="border-b border-slate-800 px-2 py-2 font-semibold">Plot</th>
                  <th className="border-b border-slate-800 px-3 py-2 font-semibold">Level</th>
                  <th className="border-b border-slate-800 px-3 py-2 font-semibold">Method</th>
                  <th className="border-b border-slate-800 px-3 py-2 font-semibold">Statistic</th>
                  <th className="border-b border-slate-800 px-3 py-2 font-semibold">Value</th>
                  <th className="border-b border-slate-800 px-3 py-2 font-semibold">Unit</th>
                  <th className="border-b border-slate-800 px-3 py-2 font-semibold">Evidence</th>
                  <th className="border-b border-slate-800 px-3 py-2 font-semibold">Status</th>
                  <th className="border-b border-slate-800 px-3 py-2 font-semibold">Data note</th>
                </tr>
              </thead>
              <tbody>
                {visibleStatsRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-b border-slate-900 hover:bg-cyan-950/10 ${selectedStat?.id === row.id ? "bg-cyan-950/20 outline outline-1 outline-cyan-800/60" : ""}`}
                    onClick={() => setSelectedStatId(row.id)}
                    data-vaa1-statskit-selectable-row="true"
                    data-vaa1-statskit-selected-row={selectedStat?.id === row.id ? "true" : "false"}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedStatIds.includes(row.id)}
                        onChange={() => toggleVisualizationRow(row.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-3 w-3 accent-cyan-400"
                        aria-label={`Plot ${row.statistic}`}
                        data-vaa1-statskit-row-plot-checkbox="true"
                      />
                    </td>
                    <td className="truncate px-3 py-2 font-mono text-[9px] text-slate-500" title={row.level}>{row.level}</td>
                    <td className="truncate px-3 py-2 font-mono text-[9px] text-slate-400" title={row.method}>{row.method}</td>
                    <td className="px-3 py-2 font-semibold text-slate-100" title={row.statistic}>{row.statistic}</td>
                    <td className="px-3 py-2 text-cyan-100" title={String(row.value)}>{row.value}</td>
                    <td className="truncate px-3 py-2 text-slate-400" title={row.unit}>{row.unit}</td>
                    <td className="px-3 py-2 text-slate-500" title={row.evidence}>{row.evidence}</td>
                    <td className={row.status === "computed" || row.status === "candidate" || row.status === "raw" ? "px-3 py-2 text-cyan-200" : "px-3 py-2 text-amber-200"} title={row.status}>{row.status}</td>
                    <td className="px-3 py-2 text-slate-500" title={row.note}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="order-5 rounded border border-slate-800 bg-[#101010] px-3 py-2 xl:sticky xl:top-2 xl:col-start-2 xl:row-span-4 xl:row-start-1 xl:self-start" open data-vaa1-statskit-visualization="true" data-vaa1-statskit-box-collapsible="true" data-vaa1-statskit-layout-slot="right-visualization">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Visualization</div>
              <div className="mt-0.5 text-[9px] text-slate-500">{visualizationTarget} / {selectedFamily.label}</div>
            </div>
            <div className="rounded border border-cyan-900/60 px-2 py-1 text-[10px] text-cyan-100">{visualization.replace(/_/g, " ")}</div>
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" data-vaa1-visualization-target-selector="true">
            <label className="grid gap-1 text-[9px] uppercase tracking-[0.12em] text-slate-500">
              Visualize
              <select
                className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                value={visualizationTarget}
                onChange={(event) => setVisualizationTarget(event.target.value as VisualizationTarget)}
              >
                <option value="stats">Stats workbench</option>
                <option value="significance">Significance workbench</option>
                <option value="relevance">Relevance scanner</option>
              </select>
            </label>
            <div className="rounded border border-slate-800 bg-[#090909] px-2 py-1.5 text-[9px] text-slate-400">
              {plottedData.length} numeric row(s) available for {visualization.replace(/_/g, " ")}.
            </div>
          </div>
          <div
            className="mt-3 rounded border border-slate-800 bg-[#090909] px-3 py-2"
            data-vaa1-statskit-selected-stat-inspector="true"
            data-vaa1-statskit-visualization-eligible={selectedCanVisualize ? "true" : "false"}
          >
            {selectedStat ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold text-slate-100">{selectedStat.statistic}</div>
                    <div className="mt-0.5 font-mono text-[9px] text-slate-500">{selectedStat.level} / {selectedStat.method}</div>
                  </div>
                  <div className={["computed", "candidate", "raw"].includes(selectedStat.status) ? "shrink-0 text-[9px] uppercase tracking-[0.12em] text-cyan-200" : "shrink-0 text-[9px] uppercase tracking-[0.12em] text-amber-200"}>
                    {selectedStat.status}
                  </div>
                </div>
                <div className="mt-2 grid gap-2 text-[9px] text-slate-400">
                  <div><span className="text-slate-500">Value:</span> <span className="font-mono text-cyan-100">{selectedStat.value}</span> {selectedStat.unit}</div>
                  <div><span className="text-slate-500">Evidence:</span> {selectedStat.evidence}</div>
                  <div><span className="text-slate-500">Required layer:</span> {selectedStat.requiredLayer}</div>
                  <div><span className="text-slate-500">Source action:</span> {selectedStat.sourceAction || "source pending"}</div>
                  <div><span className="text-slate-500">Visualization eligibility:</span> {selectedStat.visualizationTypes.join(", ")}</div>
                </div>
                {!selectedCanVisualize ? (
                  <div className="mt-2 rounded border border-amber-900/50 bg-amber-950/10 px-2 py-1.5 text-[9px] text-amber-100">
                    No numeric {visualizationTarget} rows are available for {visualization.replace(/_/g, " ")}. Select rows or surface the required data layer first.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-[10px] text-slate-500">Select a statistic row to inspect its method, evidence, and visualization options.</div>
            )}
          </div>
          <div className="mt-3" data-vaa1-operational-visualization-renderer="true" data-vaa1-visualization-target={visualizationTarget}>
            <VisualizationRenderer mode={visualization} data={plottedData} target={visualizationTarget} />
          </div>
        </details>

        <details className="order-3 overflow-hidden rounded border border-slate-800 bg-[#101010] xl:col-start-1 xl:row-start-3" data-vaa1-relevance-scanner="true" data-vaa1-statskit-box-collapsible="true" data-vaa1-relevance-scanner-default-collapsed="true" data-vaa1-statskit-layout-slot="C">
          <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-800 px-3 py-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Relevance scanner</div>
              <div className="mt-0.5 text-[9px] text-slate-500">Relevance and significance rows ranked for review.</div>
            </div>
            <div className="font-mono text-[9px] text-cyan-100">{pct(overall)} mean</div>
          </summary>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 px-3 py-2" data-vaa1-relevance-scanner-checkbox-controls="true">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border border-cyan-700/50 bg-cyan-950/20 px-2 py-1 text-[9px] font-semibold text-cyan-100 hover:bg-cyan-900/30"
                onClick={() => setSelectedScannerRowIds(scannerRows.filter((row) => Number.isFinite(Number(String(row.score).replace("%", "")))).map((row) => row.id))}
                data-vaa1-relevance-scanner-check-all="true"
              >
                Check all
              </button>
              <button
                type="button"
                className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[9px] text-slate-300 hover:bg-slate-900"
                onClick={() => setSelectedScannerRowIds([])}
                data-vaa1-relevance-scanner-clear-checks="true"
              >
                Clear
              </button>
            </div>
            <div className="text-[9px] text-slate-500">{selectedScannerRowIds.length} checked for visualization</div>
          </div>
          <table className="w-full border-collapse text-left text-[9px]">
            <thead className="text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="border-b border-slate-900 px-2 py-1.5">Plot</th>
                <th className="border-b border-slate-900 px-2 py-1.5">Lane</th>
                <th className="border-b border-slate-900 px-2 py-1.5">Dimension</th>
                <th className="border-b border-slate-900 px-2 py-1.5">Score</th>
                <th className="border-b border-slate-900 px-2 py-1.5">Next action</th>
              </tr>
            </thead>
            <tbody>
              {scannerRows.slice(0, 8).map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-slate-950 hover:bg-cyan-950/10 ${selectedScannerRow?.id === row.id ? "bg-cyan-950/20" : ""}`}
                  onClick={() => setSelectedScannerRowId(row.id)}
                  data-vaa1-relevance-scanner-selectable-row="true"
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedScannerRowIds.includes(row.id)}
                      onChange={() => toggleScannerVisualizationRow(row.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="h-3 w-3 accent-cyan-400"
                      aria-label={`Plot ${row.dimension}`}
                      data-vaa1-relevance-scanner-row-checkbox="true"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">{row.lane}</td>
                  <td className="px-2 py-1.5 font-semibold text-slate-200">{row.dimension}</td>
                  <td className="px-2 py-1.5 font-mono text-cyan-100">{row.score}</td>
                  <td className="px-2 py-1.5 text-slate-400">{row.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-800 px-3 py-2" data-vaa1-relevance-scanner-row-inspector="true">
            {selectedScannerRow ? (
              <div className="grid gap-1 text-[9px] text-slate-400">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">{selectedScannerRow.dimension}</span>
                  <span className="font-mono uppercase tracking-[0.12em] text-cyan-100">{selectedScannerRow.status}</span>
                </div>
                <div><span className="text-slate-500">Evidence:</span> {selectedScannerRow.evidence}</div>
                <div><span className="text-slate-500">Next action:</span> {selectedScannerRow.nextAction}</div>
                <div className="rounded border border-amber-900/40 bg-amber-950/10 px-2 py-1 text-amber-100">
                  Scanner rows are schema-shaped but not yet fully operational: selecting a row inspects it, while result filtering, source drilldown, counter-evidence display, and analyst weighting still need delivery.
                </div>
              </div>
            ) : (
              <div className="text-[9px] text-slate-500">Open a scanner row to inspect evidence, status, and the missing operational behavior.</div>
            )}
          </div>
        </details>

      <details className="order-4 mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2 xl:col-start-1 xl:row-start-4" data-vaa1-stats-metadata-view="true" data-vaa1-statskit-box-collapsible="true" data-vaa1-statskit-layout-slot="D">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          Stats metadata view
          <span className="ml-2 font-mono text-[9px] text-slate-500">schema coverage, audits, source-layer plan, and JSON contracts</span>
        </summary>

      <details className="mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-statskit-master-schema-category-audit="true" data-vaa1-statskit-box-collapsible="true">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          Master Schema category audit
          <span className="ml-2 font-mono text-[9px] text-slate-500">{masterAuditRows.length} StatsKit categories</span>
        </summary>
        <div className="mt-2 overflow-auto rounded border border-slate-800 bg-[#090909]">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead className="bg-[#151515] text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="border-b border-slate-800 px-3 py-2">StatsKit category</th>
                <th className="border-b border-slate-800 px-3 py-2">Used count</th>
                <th className="border-b border-slate-800 px-3 py-2">Master Schema</th>
                <th className="border-b border-slate-800 px-3 py-2">Entity registry</th>
                <th className="border-b border-slate-800 px-3 py-2">Raw substrate</th>
                <th className="border-b border-slate-800 px-3 py-2">Status</th>
                <th className="border-b border-slate-800 px-3 py-2">Source path</th>
              </tr>
            </thead>
            <tbody>
              {masterAuditRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-950 hover:bg-cyan-950/10">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-100">{row.label}</div>
                    <div className="mt-0.5 font-mono text-[9px] text-slate-500">{row.statLabel}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-cyan-100">{row.count}</td>
                  <td className="px-3 py-2 font-mono text-cyan-100">{row.masterSchemaCount}</td>
                  <td className="px-3 py-2 font-mono text-cyan-100">{row.entityRegistryCount}</td>
                  <td className="px-3 py-2 font-mono text-cyan-100">{row.rawSubstrateCount}</td>
                  <td className={row.status === "not_found" ? "px-3 py-2 text-amber-200" : row.status === "raw_substrate" ? "px-3 py-2 text-sky-200" : "px-3 py-2 text-cyan-200"}>
                    {row.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    <div>{row.sourcePath}</div>
                    <div className="mt-1 text-[9px] text-slate-500">{row.note}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-statskit-source-layer-delivery-plan="true" data-vaa1-statskit-box-collapsible="true">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          StatsKit source-layer delivery plan
          <span className="ml-2 font-mono text-[9px] text-slate-500">{sourceLayerDeliverables.length} required layers</span>
        </summary>
        <div className="mt-2 overflow-auto rounded border border-slate-800 bg-[#090909]">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead className="bg-[#151515] text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="border-b border-slate-800 px-3 py-2">Required source layer</th>
                <th className="border-b border-slate-800 px-3 py-2">Status</th>
                <th className="border-b border-slate-800 px-3 py-2">Rows</th>
                <th className="border-b border-slate-800 px-3 py-2">Current source</th>
                <th className="border-b border-slate-800 px-3 py-2">Unlocks</th>
                <th className="border-b border-slate-800 px-3 py-2">Next delivery action</th>
              </tr>
            </thead>
            <tbody>
              {sourceLayerDeliverables.map((row) => (
                <tr key={row.id} className="border-b border-slate-950 hover:bg-cyan-950/10">
                  <td className="px-3 py-2 font-semibold text-slate-100">{row.layer}</td>
                  <td className={row.status === "available" ? "px-3 py-2 text-cyan-200" : row.status === "partial_proxy" ? "px-3 py-2 text-sky-200" : "px-3 py-2 text-amber-200"}>
                    {row.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2 font-mono text-cyan-100">{row.availableRows}</td>
                  <td className="px-3 py-2 text-slate-400">{row.currentSource}</td>
                  <td className="px-3 py-2 text-slate-400">{row.unlocks}</td>
                  <td className="px-3 py-2 text-slate-300">{row.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-statskit-missing-data-audit="true" data-vaa1-statskit-box-collapsible="true">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          Missing data audit
          <span className="ml-2 font-mono text-[9px] text-slate-500">{missingDataRows.length} blocked source layer(s)</span>
        </summary>
        <div className="mt-2 overflow-auto rounded border border-slate-800 bg-[#090909]">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead className="bg-[#151515] text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="border-b border-slate-800 px-3 py-2">Missing source layer</th>
                <th className="border-b border-slate-800 px-3 py-2">Blocked rows</th>
                <th className="border-b border-slate-800 px-3 py-2">Examples</th>
                <th className="border-b border-slate-800 px-3 py-2">Why not surfaced</th>
                <th className="border-b border-slate-800 px-3 py-2">Next data action</th>
              </tr>
            </thead>
            <tbody>
              {missingDataRows.length ? (
                missingDataRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-950 hover:bg-amber-950/10">
                    <td className="px-3 py-2 font-semibold text-amber-100">{row.sourceLayer}</td>
                    <td className="px-3 py-2 font-mono text-cyan-100">{row.blockedRows}</td>
                    <td className="px-3 py-2 text-slate-400">{row.examples}</td>
                    <td className="px-3 py-2 text-slate-500">{row.reason}</td>
                    <td className="px-3 py-2 text-slate-300">{row.nextAction}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-2 text-cyan-100" colSpan={5}>All visible StatsKit rows have a computable or candidate source path for the current family set.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <details className="mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-statskit-schema-coverage="true" data-vaa1-statskit-box-collapsible="true">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          StatsKit JSON contract coverage
          <span className="ml-2 font-mono text-[9px] text-slate-500">{schemaCoverageRows.length} objects / {selectedResultCount} StatsResult refs</span>
        </summary>
        <div className="mt-2 overflow-auto rounded border border-slate-800 bg-[#090909]">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead className="bg-[#151515] text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="border-b border-slate-800 px-3 py-2">Object</th>
                <th className="border-b border-slate-800 px-3 py-2">Count</th>
                <th className="border-b border-slate-800 px-3 py-2">Source</th>
                <th className="border-b border-slate-800 px-3 py-2">Status</th>
                <th className="border-b border-slate-800 px-3 py-2">Next data action</th>
              </tr>
            </thead>
            <tbody>
              {schemaCoverageRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-950 hover:bg-cyan-950/10">
                  <td className="px-3 py-2 font-semibold text-slate-100">{row.object}</td>
                  <td className="px-3 py-2 font-mono text-cyan-100">{row.count}</td>
                  <td className="px-3 py-2 text-slate-400">{row.source}</td>
                  <td className="px-3 py-2 text-slate-300">{row.status}</td>
                  <td className="px-3 py-2 text-slate-500">{row.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-significance-relevance-delivery-audit="true" data-vaa1-statskit-box-collapsible="true">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          Significance / Relevance delivery audit
          <span className="ml-2 font-mono text-[9px] text-slate-500">schema vs operational substance</span>
        </summary>
        <div className="mt-2 overflow-auto rounded border border-slate-800 bg-[#090909]">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead className="bg-[#151515] text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="border-b border-slate-800 px-3 py-2">Schema object</th>
                <th className="border-b border-slate-800 px-3 py-2">Status</th>
                <th className="border-b border-slate-800 px-3 py-2">Delivered</th>
                <th className="border-b border-slate-800 px-3 py-2">Missing substance</th>
                <th className="border-b border-slate-800 px-3 py-2">Next delivery action</th>
              </tr>
            </thead>
            <tbody>
              {significanceRelevanceDeliveryAudit.map((row) => (
                <tr key={row.id} className="border-b border-slate-950 hover:bg-cyan-950/10">
                  <td className="px-3 py-2 font-semibold text-slate-100">{row.schemaObject}</td>
                  <td className={row.status === "delivered" ? "px-3 py-2 text-cyan-200" : row.status === "partial" ? "px-3 py-2 text-sky-200" : "px-3 py-2 text-amber-200"}>
                    {row.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{row.delivered}</td>
                  <td className="px-3 py-2 text-amber-100">{row.missing}</td>
                  <td className="px-3 py-2 text-slate-300">{row.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-significance-relevance-json-schema-bundle="true" data-vaa1-statskit-box-collapsible="true">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          Significance / Relevance JSON schema objects
          <span className="ml-2 font-mono text-[9px] text-slate-500">StatsKit + SignificanceKit + RelevanceRadar</span>
        </summary>
        <div className="mt-2 grid gap-2 lg:grid-cols-3">
          {Object.entries(schemaBundle).map(([objectName, objectValue]) => (
            <div key={objectName} className="rounded border border-slate-800 bg-[#090909] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">{objectName}</div>
              <div className="mt-1 space-y-1 text-[9px] text-slate-400">
                {isRecord(objectValue) ? Object.entries(objectValue).slice(0, 7).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <span className="truncate text-slate-500">{key}</span>
                    <span className="shrink-0 font-mono text-slate-300">{Array.isArray(value) ? `${value.length} rows` : isRecord(value) ? `${Object.keys(value).length} keys` : String(value).slice(0, 24)}</span>
                  </div>
                )) : null}
              </div>
            </div>
          ))}
        </div>
      </details>
      </details>

      <details className="order-2 mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2 xl:col-start-1 xl:row-start-2" data-vaa1-significancekit-claims="true" data-vaa1-statskit-significance-relevance-surface="true" data-vaa1-statskit-box-collapsible="true" data-vaa1-statskit-layout-slot="B">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          Significance workbench
          <span className="ml-2 font-mono text-[9px] text-slate-500">{filteredSignificanceRows.length} schema row(s)</span>
        </summary>
        <div className="mt-2 grid gap-2 md:grid-cols-4" data-vaa1-significance-workbench-filters="true">
          <label className="grid gap-1 text-[9px] uppercase tracking-[0.12em] text-slate-500">
            Perspective
            <select
              className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
              value={significancePositionFilter}
              onChange={(event) => setSignificancePositionFilter(event.target.value as "all" | SignificancePosition)}
            >
              <option value="all">All positions</option>
              {Array.from(new Set(significanceWorkbenchRows.map((row) => row.position))).map((position) => (
                <option key={position} value={position}>{position.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[9px] uppercase tracking-[0.12em] text-slate-500">
            Orientation
            <select
              className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
              value={significanceOrientationFilter}
              onChange={(event) => setSignificanceOrientationFilter(event.target.value as "all" | SignificanceOrientation)}
            >
              <option value="all">All orientations</option>
              {Array.from(new Set(significanceWorkbenchRows.map((row) => row.orientation))).map((orientation) => (
                <option key={orientation} value={orientation}>{orientation}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[9px] uppercase tracking-[0.12em] text-slate-500">
            Expression
            <select
              className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
              value={significanceExpressionFilter}
              onChange={(event) => setSignificanceExpressionFilter(event.target.value as "all" | SignificanceExpression)}
            >
              <option value="all">All expressions</option>
              {Array.from(new Set(significanceWorkbenchRows.map((row) => row.expression))).map((expression) => (
                <option key={expression} value={expression}>{expression}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[9px] uppercase tracking-[0.12em] text-slate-500">
            Dimension
            <select
              className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
              value={significanceDimensionFilter}
              onChange={(event) => setSignificanceDimensionFilter(event.target.value as "all" | SignificanceDimensionKey)}
            >
              <option value="all">All dimensions</option>
              {Array.from(new Set(significanceWorkbenchRows.map((row) => row.dimension))).map((dimension) => (
                <option key={dimension} value={dimension}>{dimension}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-[#090909] px-2 py-1.5" data-vaa1-significance-workbench-checkbox-controls="true">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="rounded border border-cyan-700/50 bg-cyan-950/20 px-2 py-1 text-[9px] font-semibold text-cyan-100 hover:bg-cyan-900/30"
              onClick={() => setSelectedSignificanceRowIds(filteredSignificanceRows.map((row) => row.id))}
              data-vaa1-significance-workbench-check-all="true"
            >
              Check all
            </button>
            <button
              type="button"
              className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[9px] text-slate-300 hover:bg-slate-900"
              onClick={() => setSelectedSignificanceRowIds([])}
              data-vaa1-significance-workbench-clear-checks="true"
            >
              Clear
            </button>
          </div>
          <div className="text-[9px] text-slate-500">{selectedSignificanceRowIds.length} checked for visualization</div>
        </div>
        <div className="mt-2 overflow-auto rounded border border-slate-800 bg-[#090909]">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead className="text-[8px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="border-b border-slate-800 px-3 py-2">Plot</th>
                <th className="border-b border-slate-800 px-3 py-2">Scope</th>
                <th className="border-b border-slate-800 px-3 py-2">Object</th>
                <th className="border-b border-slate-800 px-3 py-2">Perspective</th>
                <th className="border-b border-slate-800 px-3 py-2">Orient.</th>
                <th className="border-b border-slate-800 px-3 py-2">Expr.</th>
                <th className="border-b border-slate-800 px-3 py-2">Audience</th>
                <th className="border-b border-slate-800 px-3 py-2">Dimension</th>
                <th className="border-b border-slate-800 px-3 py-2">Score</th>
                <th className="border-b border-slate-800 px-3 py-2">Support</th>
                <th className="border-b border-slate-800 px-3 py-2">Claim</th>
                <th className="border-b border-slate-800 px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignificanceRows.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-slate-950 hover:bg-cyan-950/10 ${selectedSignificanceRow?.id === row.id ? "bg-cyan-950/20" : ""}`}
                  onClick={() => setSelectedSignificanceRowId(row.id)}
                  data-vaa1-significance-workbench-row="true"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedSignificanceRowIds.includes(row.id)}
                      onChange={() => toggleSignificanceVisualizationRow(row.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="h-3 w-3 accent-cyan-400"
                      aria-label={`Plot ${row.title} ${row.dimension}`}
                      data-vaa1-significance-workbench-row-checkbox="true"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-cyan-100">{row.scope}</td>
                  <td className="px-3 py-2 text-slate-400">{row.objectType}</td>
                  <td className="px-3 py-2 text-slate-300">{row.position.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-slate-300">{row.orientation}</td>
                  <td className="px-3 py-2 text-slate-300">{row.expression}</td>
                  <td className="px-3 py-2 text-slate-400">{row.audience}</td>
                  <td className="px-3 py-2 font-semibold text-slate-100">{row.dimension}</td>
                  <td className="px-3 py-2 font-mono text-cyan-100">{pct(row.score)}</td>
                  <td className="px-3 py-2 text-slate-400">
                    <div>{row.evidenceStrength}</div>
                    <div className="mt-0.5 font-mono text-[9px] text-slate-500">P{row.primaryEvidenceCount} / S{row.secondaryEvidenceCount} / C{row.counterEvidenceCount}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-100">{row.title}</div>
                    <div className="mt-1 text-[9px] text-slate-500">{row.claim}</div>
                    {row.missingEvidence.length ? (
                      <div className="mt-1 text-[9px] text-amber-200">Missing: {row.missingEvidence.join(", ")}</div>
                    ) : null}
                  </td>
                  <td className={row.status === "candidate" ? "px-3 py-2 text-cyan-200" : "px-3 py-2 text-amber-200"}>
                    {row.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 rounded border border-slate-800 bg-[#090909] px-3 py-2" data-vaa1-significance-workbench-inspector="true">
          {selectedSignificanceRow ? (
            <div className="grid gap-2 text-[9px] text-slate-400 lg:grid-cols-[1fr_1fr]">
              <div>
                <div className="text-[10px] font-semibold text-slate-100">{selectedSignificanceRow.title}</div>
                <div className="mt-1">{selectedSignificanceRow.reasoning}</div>
                <div className="mt-2 text-slate-500">Next action: <span className="text-slate-300">{selectedSignificanceRow.nextAction}</span></div>
              </div>
              <div className="grid gap-1">
                <div><span className="text-slate-500">Schema path:</span> SignificanceClaim.scope / perspective / significance_vector / evidence_support</div>
                <div><span className="text-slate-500">Perspective:</span> {selectedSignificanceRow.position.replace(/_/g, " ")} / {selectedSignificanceRow.orientation} / {selectedSignificanceRow.expression}</div>
                <div><span className="text-slate-500">Dimension:</span> {selectedSignificanceRow.dimension} at {pct(selectedSignificanceRow.score)}</div>
                <div><span className="text-slate-500">Evidence support:</span> primary {selectedSignificanceRow.primaryEvidenceCount}, secondary {selectedSignificanceRow.secondaryEvidenceCount}, counter {selectedSignificanceRow.counterEvidenceCount}</div>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-500">No significance row matches the current filters.</div>
          )}
        </div>
      </details>
      </div>
    </section>
  );
}

export default StatsKitPanel;
