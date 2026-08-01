import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  apiService,
  type NativeStatisticalInterpretationRun,
  type SourceMediaMetadata,
} from "@/lib/api-service";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { EMPIRICAL_TAXONOMY_ATTRIBUTES } from "@/lib/empirical-taxonomy";
import {
  VideoService,
  type AnalysisData,
  type MasterSchemaResolvedEvidenceRecord,
  type VideoMetadata,
} from "@/lib/video-service";
import NativeStatisticalInterpretationStrip from "../NativeStatisticalInterpretationStrip";
import SceneLanguageSFLView from "../SceneLanguageSFLView";

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

type InlineEvidenceRecord = {
  id: string;
  label: string;
  start?: number;
  end?: number;
  authority: string;
  source: string;
};

const INLINE_EVIDENCE_PAGE_SIZE = 12;

type MissingDataRow = {
  id: string;
  sourceLayer: string;
  blockedRows: number;
  examples: string;
  reason: string;
  nextAction: string;
};

type VisualizationTarget = "stats" | "significance" | "relevance" | "comparison";

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
  | "expressions"
  | "cameraShots"
  | "sceneCards"
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

type ComparisonCorpusVideo = {
  analysisId: string;
  sourceName: string;
  metadata: SourceMediaMetadata | null;
  analysisData: AnalysisData | null;
  statsRows: StatsTableRow[];
};

type ComparisonFeatureRow = {
  analysisId: string;
  sourceName: string;
  value: number | null;
  displayValue: string;
  status: StatsTableRow["status"] | "missing";
  evidence: string;
};

type StudioWorkflowStep =
  | "corpus"
  | "unit"
  | "variables"
  | "matrix"
  | "quality"
  | "analyses"
  | "diagnostics"
  | "variants"
  | "interpretation"
  | "traceback"
  | "export";

type StatsComparisonStudioPackage = {
  StatsComparisonStudio: {
    schema_name: "Datascene Stats Comparison Studio";
    schema_version: "0.1.0";
    purpose: string;
    workflow: StudioWorkflowStep[];
    runtime_policy: typeof LOCAL_STATS_COMPARISON_POLICY;
    core_objects: Record<string, unknown>;
    v1_supported_methods: Record<string, string[]>;
  };
};

type StatsFamily =
  | "taxonomy"
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

const VISUALIZATION_MODE_OPTIONS: Array<{ id: VisualizationMode; label: string }> = [
  { id: "bar_chart", label: "Bar chart" },
  { id: "percent_bars", label: "Percent bars" },
  { id: "duration_bars", label: "Duration / rate bars" },
  { id: "histogram", label: "Histogram" },
  { id: "boxplot", label: "Boxplot" },
  { id: "heatmap", label: "Heatmap" },
  { id: "timeline", label: "Timeline" },
  { id: "network_graph", label: "Network graph" },
  { id: "table", label: "Table" },
];

const STAT_FAMILY_OPTIONS: Array<{ id: StatsFamily; label: string; description: string }> = [
  { id: "taxonomy", label: "Taxonomy / Attribute readiness", description: "All canonical empirical attributes, including operational, partial, contracted, experimental, and missing layers." },
  { id: "descriptive", label: "Level I / Descriptive", description: "Counts, percentages, durations, means, medians, variance, and standard deviation." },
  { id: "cross_tabulation", label: "Level II / Cross-tabs", description: "Relationships between categorical variables such as speaker x topic or location x expression." },
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

function audioSampleCloudRows(analysisData: AnalysisData | null): Array<Record<string, unknown>> {
  const clouds = Array.isArray(analysisData?.audioSampleClouds?.clouds)
    ? analysisData.audioSampleClouds.clouds as Array<Record<string, unknown>>
    : [];
  const flattened = clouds.flatMap((cloud) => {
    const samples = Array.isArray(cloud.samples) ? cloud.samples as Array<Record<string, unknown>> : [];
    return samples.map((sample) => ({ ...sample, cloud_label: cloud.entity_label, cloud_type: cloud.entity_type }));
  });
  const directSamples = Array.isArray(analysisData?.audioSampleClouds?.samples)
    ? analysisData.audioSampleClouds.samples as Array<Record<string, unknown>>
    : [];
  return [...flattened, ...directSamples];
}

function sourceTextHas(pattern: RegExp, ...values: unknown[]): number {
  return values.some((value) => pattern.test(JSON.stringify(value || ""))) ? 1 : 0;
}

function confirmedMetadataValues(metadata: SourceMediaMetadata | null, keys: string[]): string[] {
  const annotations: Record<string, unknown> = isRecord(metadata?.user_annotations) ? metadata.user_annotations : {};
  const values = keys.flatMap((key) => {
    const value = annotations[key];
    if (Array.isArray(value)) return value.map(String);
    return typeof value === "string" ? [value] : [];
  });
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function userAnnotationValueCount(metadata: SourceMediaMetadata | null): number {
  const annotations: Record<string, unknown> = isRecord(metadata?.user_annotations) ? metadata.user_annotations : {};
  return Object.values(annotations).reduce<number>((sum, value) => {
    if (Array.isArray(value)) return sum + value.length;
    if (isRecord(value)) return sum + Object.keys(value).length;
    if (typeof value === "string") return sum + (value.trim() ? 1 : 0);
    return sum + (value === null || value === undefined ? 0 : 1);
  }, 0);
}

function artifactReadings(artifact: unknown): Array<Record<string, unknown>> {
  if (!isRecord(artifact) || !Array.isArray(artifact.readings)) return [];
  return artifact.readings.filter(isRecord);
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
  const shotBoundaryIntervals = analysisData?.metadata?.motionSceneBasis?.shotBoundaries?.intervals || [];
  const audioEventIntervals = analysisData?.metadata?.audioEventIntervals?.intervals || [];
  const shotSamples = analysisData?.metadata?.cinematicClues?.shotSize?.samples || [];
  const transitionSamples = analysisData?.metadata?.cinematicClues?.transitionClues?.samples || [];
  const sceneCardArtifact = analysisData?.miseEnSceneSceneCards;
  const sceneCards = Array.isArray(sceneCardArtifact?.scene_cards) ? sceneCardArtifact.scene_cards : [];
  const sceneCardSummaryCount = num(sceneCardArtifact?.scene_card_count);
  const spatialToneSamples = analysisData?.metadata?.spatialToneScan?.samples || [];
  const evidenceCounts = evidenceCountBag(metadata);
  const confirmedOrganizations = confirmedMetadataValues(metadata, ["organizations"]);
  const confirmedPlaces = confirmedMetadataValues(metadata, ["location_place", "location_city", "location_country", "location_room"]);
  const objectCountFromMetadata = sumCounts(evidenceCounts, [/object/i, /tracked_objects/i, /ocr_items/i]);

  const personRawCount = rawObjects.filter((item) => normalizedText(item.class_name || item.raw_class_name) === "person").length;
  const objectRawCount = Math.max(objects.length, rawObjects.length, objectCountFromMetadata);
  const speakerNames = new Set(transcript.map((segment) => segment.speaker).filter((speaker) => speaker && speaker !== "Unknown"));
  const diarizationTurns = analysisData?.audioDiarization?.speaker_turns || [];
  const diarizationSpeakerLabels = new Set(
    diarizationTurns
      .map((turn) => turn.speaker_label)
      .filter((speaker): speaker is string => Boolean(speaker && speaker !== "Unknown")),
  );
  const diarizationSpeakerCount = Math.max(
    num(analysisData?.audioDiarization?.turn_count) ? diarizationSpeakerLabels.size : 0,
    num((analysisData?.audioDiarization as any)?.measurement?.speaker_cluster_count),
  );
  const soundEnvironmentCount = audioProsody.filter((cue) => cue.sound_environment?.label).length;
  const soundIntervalCount = audioEventIntervals.filter((interval) => interval.event_type).length;
  const audioSampleRows = audioSampleCloudRows(analysisData);
  const audioSampleSoundCount = audioSampleRows.length;
  const musicProsodyCount = audioProsody.filter((cue) => /music|song|score|soundtrack/i.test(cue.sound_environment?.label || "")).length;
  const musicIntervalCount = audioEventIntervals.filter((interval) => /music|song|score|soundtrack/i.test(interval.event_type || "")).length;
  const musicSampleCount = audioSampleRows.filter((sample) =>
    /music|song|score|soundtrack/i.test(JSON.stringify(sample)),
  ).length;
  const sourceMusicMetadataCount = sourceTextHas(
    /music by|composer|score|soundtrack|song/i,
    metadata,
    analysisData?.audioSampleClouds,
  );
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
      entityRegistryCount: Math.max(
        countEntities(analysisData, (entity) => entity.entity_type === "ORG"),
        confirmedOrganizations.length,
      ),
      rawSubstrateCount: sumCounts(evidenceCounts, [/org/i, /organization/i, /institution/i]),
      sourcePath: "user_annotations.organizations + entityRegistry[ORG] + source metadata organization fields",
      note: confirmedOrganizations.length
        ? "Includes user-confirmed Source Media organizations; user authority is retained through Mature Data Proliferation."
        : undefined,
    }),
    makeMasterAuditRow({
      id: "places",
      label: "Places",
      statLabel: "places detected",
      masterSchemaCount: countMasterRecords(analysisData, (record) => /place|location|setting|city|country/i.test(`${record.label} ${record.rawLabel || ""}`)),
      entityRegistryCount: Math.max(
        countEntities(analysisData, (entity) => entity.entity_type === "PLACE"),
        confirmedPlaces.length,
      ),
      rawSubstrateCount: sumCounts(evidenceCounts, [/place/i, /location/i, /setting/i, /geo/i]),
      sourcePath: "user_annotations.location_* + entityRegistry[PLACE] + Master Schema location/setting records",
      note: confirmedPlaces.length
        ? "Includes user-confirmed Source Media place fields; user authority is retained through Mature Data Proliferation."
        : undefined,
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
      id: "expressions",
      label: "Expressions",
      statLabel: "expressions detected",
      masterSchemaCount: countMasterRecords(analysisData, (record) => record.category === "expression") + countManualCategory(analysisData, "Expressions"),
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "AUDIOVISUAL_NARRATIVE_AGENT"),
      rawSubstrateCount: expressions.length,
      sourcePath: "masterSchemaResolvedEvidence[expression] + expressionResults + manual Expressions",
    }),
    makeMasterAuditRow({
      id: "cameraShots",
      label: "Camera shots",
      statLabel: "Camera shots",
      masterSchemaCount: countMasterRecords(analysisData, (record) => record.category === "shot_boundary") + countManualCategory(analysisData, "Cinematic Cues"),
      entityRegistryCount: 0,
      rawSubstrateCount: Math.max(shotBoundaryIntervals.length, shotSamples.length, transitionSamples.length, sumCounts(evidenceCounts, [/shot_boundary/i, /camera_shot/i])),
      sourcePath: "Master Schema shot_boundary_interval segments + cinematicClues.transitionClues/shotSize + manual Cinematic Cues",
      note: shotBoundaryIntervals.length
        ? "Shot count comes from governed Master Schema shot-boundary intervals."
        : "Scene Cards and scene intervals are excluded: they are governed scene units, not measured camera shots.",
    }),
    makeMasterAuditRow({
      id: "sceneCards",
      label: "Scene Cards",
      statLabel: "Scene Cards",
      masterSchemaCount: countMasterRecords(analysisData, (record) => /scene_card|scene_interval/i.test(`${record.category} ${record.label}`)),
      entityRegistryCount: 0,
      rawSubstrateCount: Math.max(sceneCardSummaryCount, sceneCards.length, sceneSegments.length),
      sourcePath: "mise_en_scene_scene_cards.scene_cards + motionSceneBasis.sceneSegments",
      note: sceneCardSummaryCount || sceneCards.length
        ? "Governed Scene Card count from the persisted mise-en-scene report; kept separate from measured shot boundaries."
        : undefined,
    }),
    makeMasterAuditRow({
      id: "speakers",
      label: "Speakers",
      statLabel: "speakers detected",
      masterSchemaCount: countMasterRecords(analysisData, (record) => /speaker|diarization|speaker_turn/i.test(`${record.category} ${record.label}`)) + countManualCategory(analysisData, "Audio", /speaker/i),
      entityRegistryCount: 0,
      rawSubstrateCount: Math.max(
        diarizationSpeakerCount,
        countMasterRecords(analysisData, (record) => record.category === "speaker_diarization"),
        speakerNames.size > 1 ? speakerNames.size : 0,
        num(analysisData?.metadata?.audioDiarizationTurns) > 1 ? num(analysisData?.metadata?.audioDiarizationTurns) : 0,
      ),
      sourcePath: "Master Schema temporal_segments[event_family=speaker_diarization_turn] + audioDiarization.speaker_turns/clusters + transcript speakers + manual speaker annotations",
      note: diarizationSpeakerCount === 1
        ? "One measured diarization speaker cluster is visible. Surface it as a candidate audio speaker, but review because single-speaker results across dialogue-heavy material are a red flag."
        : speakerNames.size === 1 && !num(analysisData?.metadata?.audioDiarizationTurns)
          ? "Only one transcript speaker label is visible; treated as an unresolved transcript proxy, not a speaker-recognition result."
          : undefined,
    }),
    makeMasterAuditRow({
      id: "sounds",
      label: "Sounds",
      statLabel: "sounds detected",
      masterSchemaCount: countMasterRecords(analysisData, (record) => record.category === "audio_event") + countManualCategory(analysisData, "Audio"),
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "AUDIO_ENTITY"),
      rawSubstrateCount: Math.max(audioSampleSoundCount, soundIntervalCount, soundEnvironmentCount, sumCounts(evidenceCounts, [/sound/i, /audio/i, /prosody/i, /noise/i])),
      sourcePath: "Master Schema audio_event_interval segments + audioProsody.sound_environment + audio_sample_clouds + audio sample/entity registry + manual Audio annotations",
    }),
    makeMasterAuditRow({
      id: "music",
      label: "Music",
      statLabel: "music detected",
      masterSchemaCount: countMasterRecords(analysisData, (record) => record.category === "audio_event" && /music|song|score|soundtrack/i.test(record.label)) + musicManualCount,
      entityRegistryCount: countEntities(analysisData, (entity) => entity.entity_type === "AUDIO_ENTITY" && /music|song/i.test(entity.canonical_name)),
      rawSubstrateCount: Math.max(musicIntervalCount, musicProsodyCount, musicSampleCount, sourceMusicMetadataCount, sumCounts(evidenceCounts, [/music/i, /song/i])),
      sourcePath: "Master Schema audio_event_interval[music] + audioProsody.sound_environment[music/song/score] + audio_sample_clouds/source media music metadata + manual Audio/Music annotations + audio entities",
      note: musicIntervalCount || musicProsodyCount
        ? undefined
        : sourceMusicMetadataCount
          ? "Music is visible as source-media metadata substrate; timed music detection still requires a music/sound classifier interval layer."
          : undefined,
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
  const speechEvents = analysisData?.metadata?.audioEventIntervals?.intervals?.filter((interval) =>
    /speech|voice|dialogue/i.test(interval.event_type || ""),
  ) || [];
  if (speechEvents.length) {
    return speechEvents.reduce((sum, interval) => sum + intervalDuration(interval.start, interval.end), 0);
  }
  return timedTranscriptDurations(analysisData).reduce((sum, value) => sum + value, 0);
}

function audioEventDurationSeconds(analysisData: AnalysisData | null, pattern: RegExp): number | null {
  const events = analysisData?.metadata?.audioEventIntervals?.intervals?.filter((interval) =>
    pattern.test(interval.event_type || ""),
  ) || [];
  if (!events.length) return null;
  return events.reduce((sum, interval) => sum + intervalDuration(interval.start, interval.end), 0);
}

function musicDurationSeconds(analysisData: AnalysisData | null): number | null {
  const musicEventSeconds = audioEventDurationSeconds(analysisData, /music|song|score|soundtrack/i);
  if (musicEventSeconds !== null) return musicEventSeconds;
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
  const legacy = (analysisData?.metadata?.motionSceneBasis?.motionEvidence?.samples || [])
    .map((sample) =>
      [
        sample.occupancy_shift,
        sample.foreground_delta,
        sample.background_delta,
        sample.zone_tone_shift,
      ].map(num).reduce((sum, value) => sum + Math.abs(value), 0),
    )
    .filter((value) => value > 0);
  if (legacy.length) return legacy;
  return (analysisData?.metadata?.adaptiveVisualScan?.samples || [])
    .slice(1)
    .map((sample) => {
      const frameDelta = num(sample.motion?.frame_delta);
      const changedFraction = num(sample.motion?.changed_fraction);
      return Math.abs(frameDelta) + Math.abs(changedFraction * 100);
    })
    .filter((value) => value > 0);
}

function shotDurationValues(analysisData: AnalysisData | null): number[] {
  const shotDurations = (analysisData?.metadata?.motionSceneBasis?.shotBoundaries?.intervals || [])
    .map((segment) => intervalDuration(segment.start, segment.end))
    .filter((value) => value > 0);
  if (shotDurations.length) return shotDurations;
  return (analysisData?.metadata?.motionSceneBasis?.sceneSegments?.segments || [])
    .map((segment) => intervalDuration(segment.start, segment.end))
    .filter((value) => value > 0);
}

function spatialToneValues(
  analysisData: AnalysisData | null,
  field: "brightness" | "contrast" | "saturation" | "luminance_entropy",
): number[] {
  return (analysisData?.metadata?.spatialToneScan?.samples || [])
    .map((sample) => sample.zones?.whole_frame?.[field])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function sceneCardDurationValues(analysisData: AnalysisData | null): number[] {
  const artifact = analysisData?.miseEnSceneSceneCards;
  const cards = Array.isArray(artifact?.scene_cards) ? artifact.scene_cards : [];
  const cardDurations = cards
    .map((item) => {
      if (!item || typeof item !== "object") return 0;
      const interval = (item as { time_interval?: { start_ms?: unknown; end_ms?: unknown } }).time_interval;
      return intervalDuration(interval?.start_ms, interval?.end_ms) / 1000;
    })
    .filter((value) => value > 0);
  if (cardDurations.length) return cardDurations;
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
  const shotBoundaryRows = analysisData?.metadata?.motionSceneBasis?.shotBoundaries?.intervals?.length || 0;
  const sceneProxyRows = analysisData?.metadata?.motionSceneBasis?.sceneSegments?.segments?.length || 0;
  const shotSizeProxyRows = analysisData?.metadata?.cinematicClues?.shotSize?.samples?.length || 0;
  const audioEventRows = analysisData?.metadata?.audioEventIntervals?.intervals?.length || 0;
  const audioProsodyRows = analysisData?.audioProsody?.length || 0;
  const adaptiveVisualRows =
    analysisData?.metadata?.adaptiveVisualScan?.samples?.length || 0;
  const adaptiveMotionRows = (
    analysisData?.metadata?.adaptiveVisualScan?.samples || []
  ).filter((sample) => sample.motion).length;
  const adaptiveTransitionRows = (
    analysisData?.metadata?.adaptiveVisualScan?.samples || []
  ).filter((sample) => sample.transition?.candidate).length;
  const adaptiveLightingRows = (
    analysisData?.metadata?.adaptiveVisualScan?.samples || []
  ).filter((sample) => sample.lighting?.event).length;
  const audioSampleRows = audioSampleCloudRows(analysisData).length;
  const audioSampleArtifact = isRecord(analysisData?.audioSampleClouds)
    ? analysisData.audioSampleClouds
    : {};
  const audioEconomics = isRecord(audioSampleArtifact.maturation_economics)
    ? audioSampleArtifact.maturation_economics
    : {};
  const audioYield = isRecord(audioEconomics.yield_observations)
    ? audioEconomics.yield_observations
    : {};
  const audioDensePolicy = isRecord(audioEconomics.dense_analysis_policy)
    ? audioEconomics.dense_analysis_policy
    : {};
  const reusableAudioSamples = num(audioYield.reusable_sample_count);
  const uniqueAudioSamples = num(audioYield.unique_sample_count);
  const duplicateAudioSamples = num(audioYield.duplicate_sample_count);
  const confirmedAudioAnchors = countManualCategory(analysisData, "Audio");
  const musicAnalysisRows = countMasterRecords(analysisData, (record) => record.category === "music_analysis");
  const musicSoundRows = (analysisData?.audioProsody || []).filter((cue) =>
    cue.sound_environment?.label,
  ).length + (analysisData?.metadata?.audioEventIntervals?.intervals || []).filter((interval) =>
    /music|noise|sound|speech|silence/i.test(interval.event_type || ""),
  ).length + musicAnalysisRows;
  const colorRows = (analysisData?.metadata?.spatialToneScan?.samples || []).reduce((sum, sample) => {
    const zones = Object.values(sample.zones || {});
    return sum + zones.filter((zone) => zone.dominant_tone || zone.brightness_band || zone.saturation_band).length;
  }, 0);
  const diarizationTurns = Math.max(
    num(analysisData?.audioDiarization?.turn_count),
    num(analysisData?.metadata?.audioDiarizationTurns),
  );
  const transcriptSpeakerRows = (analysisData?.transcript || []).filter((segment) =>
    Boolean(segment.speaker && segment.speaker !== "Unknown" && intervalDuration(segment.start, segment.end) > 0),
  ).length;

  return [
    {
      id: "adaptive-visual-measurements",
      layer: "Adaptive visual measurements: frame / lighting / motion / transition / spatial",
      status: sourceLayerStatus(adaptiveVisualRows),
      availableRows: adaptiveVisualRows,
      currentSource: adaptiveVisualRows
        ? `adaptive_visual_scan: ${adaptiveMotionRows} motion / ${adaptiveTransitionRows} transition candidates / ${adaptiveLightingRows} lighting events`
        : "No adaptive visual measurement array visible",
      unlocks:
        "motion distributions, transition rates, lighting-event density, frame-class and spatial occupancy statistics",
      nextAction: adaptiveVisualRows
        ? "Use the canonical adaptive scan for StatsKit visual actuals while preserving candidate authority."
        : "Run or hydrate adaptive visual measurement before computing visual actuals.",
    },
    {
      id: "true-shot-boundary-intervals",
      layer: "True shot-boundary intervals",
      status: sourceLayerStatus(shotBoundaryRows, sceneProxyRows + shotSizeProxyRows > 0),
      availableRows: shotBoundaryRows,
      currentSource: shotBoundaryRows
        ? "Master Schema shot_boundary_interval rows"
        : sceneProxyRows || shotSizeProxyRows
        ? `${sceneProxyRows} scene segment proxy rows / ${shotSizeProxyRows} shot-size sample rows`
        : "No shot-boundary or cinematic proxy layer visible",
      unlocks: "shot duration distributions, trailer cut counts, camera rhythm variance, temporal change points",
      nextAction: shotBoundaryRows
        ? "Use governed shot intervals for shot distributions, camera rhythm, and significance/relevance timing."
        : "Add and persist a real shot-boundary detector output with start/end intervals and method provenance.",
    },
    {
      id: "audio-event-intervals",
      layer: "Audio event intervals: speech / silence / noise / music",
      status: sourceLayerStatus(audioEventRows, audioProsodyRows > 0),
      availableRows: audioEventRows,
      currentSource: audioEventRows
        ? "Canonical audio_event_intervals rows with Master Schema projection"
        : audioProsodyRows ? `${audioProsodyRows} prosody cues available as partial audio proxy` : "No audio event interval layer visible",
      unlocks: "speech/silence/noise/music ratios, audio timelines, event-rate curves, source-linked significance",
      nextAction: audioEventRows
        ? "Use these governed intervals for StatsKit, SignificanceKit, and RelevanceKit audio actuals."
        : "Persist VAD/silence/noise/music intervals as governed audio events, not only summary readiness.",
    },
    {
      id: "speaker-diarization-turns",
      layer: "Speaker-linked diarization turns",
      status: sourceLayerStatus(diarizationTurns),
      availableRows: diarizationTurns,
      currentSource: diarizationTurns
        ? "Canonical audio_diarization.speaker_turns with Master Schema projection"
        : "No measured diarization turn array visible",
      unlocks:
        "speaker-cluster counts, turn duration, speaking-time share, overlap, and unresolved identity rates",
      nextAction: diarizationTurns
        ? "Compute speaker statistics while keeping cluster identity provisional until confirmed."
        : "Hydrate measured speaker turns before speaker statistics are claimed.",
    },
    {
      id: "audio-sampling-and-confirmation",
      layer: "Audio samples and Narrative Agent audio confirmations",
      status: sourceLayerStatus(audioSampleRows + confirmedAudioAnchors),
      availableRows: audioSampleRows + confirmedAudioAnchors,
      currentSource:
        `${audioSampleRows} audio sample rows / ${reusableAudioSamples} reusable / ` +
        `${uniqueAudioSamples} unique / ${duplicateAudioSamples} duplicate / ` +
        `${confirmedAudioAnchors} analyst Audio annotations`,
      unlocks:
        "sample coverage, confirmation rates, voice-pattern support, and maturation throughput",
      nextAction: audioDensePolicy.reason
        ? `${String(audioDensePolicy.recommendation || "governed sampling")}: ${String(audioDensePolicy.reason)}`
        : "Separate measured sample counts from analyst-confirmed identity anchors in every statistic.",
    },
    {
      id: "music-sound-classifier",
      layer: "Music and sound classifier output over time",
      status: sourceLayerStatus(musicSoundRows),
      availableRows: musicSoundRows,
      currentSource: musicSoundRows ? "Master Schema audio/music rows + audioProsody.sound_environment labels" : "No classified music/sound timeline visible",
      unlocks: "music intensity x expression, soundscape relevance, music/sound significance claims",
      nextAction: "Classify music, score, noise, ambience, and sound events over time and persist EvidenceLink-compatible intervals.",
    },
    {
      id: "color-brightness-contrast",
      layer: "Color / brightness / contrast frame-window extraction",
      status: sourceLayerStatus(colorRows),
      availableRows: colorRows,
      currentSource: colorRows ? "spatialToneScan zone tone/brightness/saturation" : "No color/brightness/contrast layer visible",
      unlocks: "brightness distributions, color entropy, darkness x fear, visual tone relevance",
      nextAction: colorRows
        ? "Use governed frame-window measurements for visual distributions and source-linked interpretation."
        : "Extract color, brightness, contrast, and entropy over sampled frames or windows with source timestamps.",
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
  const expressions = auditCounts.expressions || 0;
  const cameraShots = auditCounts.cameraShots || 0;
  const sceneCards = auditCounts.sceneCards || 0;
  const speakers = auditCounts.speakers || 0;
  const sounds = auditCounts.sounds || 0;
  const music = auditCounts.music || 0;
  const colors = auditCounts.colors || 0;
  const matureAnchors = Number(metrics.find((metric) => metric.id === "mature_anchors")?.value || 0);
  const audioPresent = metrics.find((metric) => metric.id === "audio_readiness" && !metric.missing) ? 1 : 0;
  const audioEventRows = analysisData?.metadata?.audioEventIntervals?.intervals?.length || 0;
  const speechSeconds = speechDurationSeconds(analysisData);
  const musicSeconds = musicDurationSeconds(analysisData);
  const silenceEventSeconds = audioEventDurationSeconds(analysisData, /silence|quiet/i);
  const noiseSeconds = audioEventDurationSeconds(analysisData, /noise|sound|ambience|ambient/i);
  const silenceSeconds = silenceEventSeconds !== null
    ? silenceEventSeconds
    : duration && speechSeconds ? Math.max(0, duration - speechSeconds) : null;
  const speakingTurnMedian = median(timedTranscriptDurations(analysisData));
  const tempoVariance = variance(speakingTempoValues(analysisData));
  const expressionVariance = variance(expressionToneValues(analysisData));
  const motionVariance = variance(motionIntensityValues(analysisData));
  const speakerDominanceStdDev = stdDev(speakerDurationValues(analysisData));
  const shotDurationStdDev = stdDev(shotDurationValues(analysisData));
  const shotDurations = shotDurationValues(analysisData);
  const sceneCardDurations = sceneCardDurationValues(analysisData);
  const movementStdDev = stdDev(motionIntensityValues(analysisData));
  const brightnessValues = spatialToneValues(analysisData, "brightness");
  const contrastValues = spatialToneValues(analysisData, "contrast");
  const saturationValues = spatialToneValues(analysisData, "saturation");
  const entropyValues = spatialToneValues(analysisData, "luminance_entropy");
  const auditById = new Map(masterAuditRows.map((row) => [row.id, row]));
  const descriptiveEntries: Array<[string, number, string, MasterSchemaStatsAuditRow | undefined]> = [
    ["Actions", actions, "Master Schema action/POS/manual audit", auditById.get("actions")],
    ["Camera shots", cameraShots, "Master Schema shot-boundary audit", auditById.get("cameraShots")],
    ["Colors", colors, "Master Schema color/visual cue audit", auditById.get("colors")],
    ["Expressions", expressions, "Master Schema expression audit", auditById.get("expressions")],
    ["Music", music, "Master Schema music/audio audit", auditById.get("music")],
    ["Objects", objects, "Master Schema object/detection audit", auditById.get("objects")],
    ["Organizations", organizations, "Master Schema organization audit", auditById.get("organizations")],
    ["Persons", persons, "Master Schema person/narrative-agent audit", auditById.get("persons")],
    ["Places", places, "Master Schema place/location audit", auditById.get("places")],
    ["Scene Cards", sceneCards, "Governed mise-en-scene Scene Card audit", auditById.get("sceneCards")],
    ["Source annotations", userAnnotationValueCount(metadata), "source_media_metadata.user_annotations (analyst-authored source evidence)", undefined],
    ["Sounds", sounds, "Master Schema audio/sound audit", auditById.get("sounds")],
    ["Speakers", speakers, "Master Schema speaker/transcript/audio audit", auditById.get("speakers")],
    ["Topics", topics, "Master Schema topic/meaning/quant audit", auditById.get("topics")],
  ];

  const taxonomyRows: StatsTableRow[] = EMPIRICAL_TAXONOMY_ATTRIBUTES.map((attribute) => ({
    id: `taxonomy:${attribute.categoryId}:${attribute.attributeId}`,
    level: "Taxonomy",
    family: "taxonomy",
    method: attribute.categoryLabel,
    statistic: attribute.attributeLabel,
    value: attribute.attributeStatus,
    unit: "attribute",
    scope: attribute.theme,
    evidence: attribute.knownPaths.length ? attribute.knownPaths.join(" + ") : "No runtime path registered yet",
    status: attribute.attributeStatus,
    note: attribute.description,
    requiredLayer: attribute.categoryId,
    sourceAction: `datascene://taxonomy/${attribute.categoryId}/${attribute.attributeId}`,
    visualizationTypes: ["table"],
  }));

  const pos = analysisData?.posAnalysis?.[0];
  const quant = analysisData?.quantAnalysis?.[0];
  const narrativeLensArtifact = analysisData?.narrativeLensReading;
  const narrativeLensReadings = artifactReadings(narrativeLensArtifact);
  const characterPathArtifact = analysisData?.characterPathReading;
  const characterPathReadings = artifactReadings(characterPathArtifact);
  const posTaggedTokens = Object.values(pos?.pos_counts || {}).reduce((sum, value) => sum + num(value), 0);
  const linguisticRows: StatsTableRow[] = [
    statRow(
      "descriptive", "Level I", "POS", "POS tagged tokens",
      pos ? (pos.token_count || posTaggedTokens) : "not computed", "tokens",
      "posAnalysis.token_count + posAnalysis.pos_counts", pos ? "computed" : "not computed",
      "Part-of-speech observations produced from the loaded transcript language pipeline.", "language.pos_dependency_sfl", ["table", "bar_chart"],
    ),
    statRow(
      "descriptive", "Level I", "POS", "POS categories represented",
      pos ? Object.values(pos.pos_counts || {}).filter((value) => num(value) > 0).length : "not computed", "categories",
      "posAnalysis.pos_counts", pos ? "computed" : "not computed",
      "Number of POS categories with at least one observed token.", "language.pos_dependency_sfl", ["table", "bar_chart"],
    ),
    statRow(
      "descriptive", "Level I", "Quant", "Quant tokens",
      quant ? quant.token_info?.tokens?.length || 0 : "not computed", "tokens",
      "quantAnalysis.token_info.tokens", quant ? "computed" : "not computed",
      "Corpus tokens retained by the Quant analysis artifact.", "language.quant_corpus", ["table", "bar_chart"],
    ),
    statRow(
      "descriptive", "Level I", "Quant", "Unique terms",
      quant ? Object.keys(quant.token_info?.freq_dist || {}).length : "not computed", "terms",
      "quantAnalysis.token_info.freq_dist", quant ? "computed" : "not computed",
      "Distinct terms in the governed Quant frequency distribution.", "language.quant_corpus", ["table", "bar_chart"],
    ),
    statRow(
      "descriptive", "Level I", "Quant", "Bigrams",
      quant ? quant.bigrams?.length || 0 : "not computed", "bigrams",
      "quantAnalysis.bigrams + quantAnalysis.evidence_map.bigrams", quant ? "computed" : "not computed",
      "Two-token sequences retained by the Quant artifact; evidence-map entries preserve source spans when available.", "language.quant_corpus", ["table", "bar_chart"],
    ),
    statRow(
      "descriptive", "Level I", "Quant", "Concordance lines",
      quant ? quant.concordance?.lines?.length || 0 : "not computed", "lines",
      "quantAnalysis.concordance.lines + quantAnalysis.evidence_map.concordance", quant ? "computed" : "not computed",
      "Source-linked concordance contexts available for the active Quant keyword.", "language.quant_corpus", ["table", "bar_chart"],
    ),
  ];
  const plotLensRows: StatsTableRow[] = [
    ["Aristotle", "aristotelian"],
    ["Booker", "bookerian"],
    ["Campbell", "campbellian"],
    ["Freytag", "freytagian"],
    ["Frye", "fryean"],
  ].map(([label, lensId]) => statRow(
    "descriptive", "Interpretive", "Plot lens readings", label,
    narrativeLensArtifact ? narrativeLensReadings.filter((reading) => reading.lens_id === lensId).length : "not computed",
    "readings", `narrativeLensReading.readings[lens_id=${lensId}]`, narrativeLensArtifact ? "computed" : "not computed",
    `Count of governed ${label} reading candidates. A reading remains an interpretation, not an empirical fact.`,
    "narrative.lenses_structures", ["table", "bar_chart"],
  ));
  const frameworkRows: StatsTableRow[] = [
    ["Performed agency / Shakespearean", "shakespearean_performativity"],
    ["Narrative function / Proppian", "proppian_function"],
    ["Symbolic shadow / Jungian / Mythic", "jungian_symbolic"],
    ["Actant relation / Greimasian", "greimasian_actant"],
    ["Motive scene / Burkean / Dramatistic", "burkean_motive"],
  ].map(([label, frameworkId]) => {
    const matching = characterPathReadings.filter((reading) =>
      [reading.framework_id, reading.archetype_id, reading.lens_id, reading.tradition]
        .map((value) => String(value || "").toLowerCase())
        .includes(frameworkId),
    );
    return statRow(
      "descriptive", "Interpretive", "Agency and character frameworks", label,
      matching.length ? matching.length : "not computed", "readings",
      `characterPathReading.readings[framework=${frameworkId}]`, matching.length ? "computed" : "not computed",
      matching.length
        ? `Count of source-linked ${label} reading candidates.`
        : "The framework is available in Meaning / Plot, but no framework-explicit governed reading was persisted for this analysis.",
      "narrative.characters_agency_roles_archetypes", ["table", "bar_chart"],
    );
  });

  const rows: StatsTableRow[] = [
    ...taxonomyRows,
    ...linguisticRows,
    ...plotLensRows,
    ...frameworkRows,
    ...descriptiveEntries.map(([label, value, evidence, audit]) =>
      statRow(
        "descriptive",
        "Level I",
        "frequency",
        label,
        audit?.status === "not_found" ? "not computed" : value,
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
        `${label} share`,
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
        ? `speech ${roundStat(speechSeconds)} / silence ${roundStat(silenceSeconds)} / noise ${noiseSeconds === null ? "not classified" : roundStat(noiseSeconds)} / music ${musicSeconds === null ? "not classified" : roundStat(musicSeconds)}`
        : "not computed",
      "seconds",
      "Master Schema audio_event_interval segments + timed transcript fallback",
      audioEventRows ? "computed" : speechSeconds ? (musicSeconds === null ? "candidate" : "computed") : audioPresent ? "needs source layer" : "not computed",
      audioEventRows
        ? "Speech, silence, noise, and music are computed from governed Master Schema audio-event intervals."
        : "Speech and silence use transcript coverage as a fallback; music requires classified audio environment intervals before it is fully actual.",
      "Master Schema temporal_segments[event_family=audio_event_interval] + transcript segment intervals",
    ),
    statRow(
      "descriptive",
      "Level I",
      "mean",
      "Mean scene length",
      roundStat(mean(sceneCardDurations)),
      "seconds",
      "mise_en_scene_scene_cards.scene_cards.time_interval",
      sceneCardDurations.length ? "computed" : "needs source layer",
      sceneCardDurations.length
        ? "Computed from governed scene intervals; no shot-count proxy is used."
        : "Needs persisted Scene Card or governed scene intervals.",
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
      "camera movement / expression tone / speaking tempo variance",
      `movement ${roundStat(motionVariance)} / expression ${roundStat(expressionVariance)} / tempo ${roundStat(tempoVariance)}`,
      "score",
      "timed shot, expression, and speech-tempo series",
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
    statRow("cross_tabulation", "Level II", "cross_tab", "Location x expression", "not computed", "matrix", "scene setting + expression/sentiment intervals", "needs source layer", "Requires location labels and timed expression evidence."),
    statRow("cross_tabulation", "Level II", "cross_tab", "Speaker x topic", "not computed", "matrix", "speaker turns + topic/meaning spans", "needs source layer", "Requires transcript spans linked to speakers and topics."),
    statRow("correlation", "Level III", "correlation", "music intensity x expression valence", "not computed", "r", "audio intensity time series + expression time series", "needs source layer", "Requires aligned audio and expression vectors."),
    statRow("correlation", "Level III", "correlation", "object density x narrative complexity", "not computed", "r", "object density series + narrative marker series", "needs source layer", "Requires per-window object and narrative measurements."),
    statRow("comparative", "Level IV", "comparative", "video-to-video comparison", "not computed", "table", "collection or comparative corpus", "needs corpus", "Single-video data is loaded; comparative statistics require multiple governed videos."),
    statRow(
      "distribution",
      "Level V",
      "histogram",
      "shot length distribution",
      shotDurations.length ? `${shotDurations.length} intervals / median ${roundStat(median(shotDurations))}s` : "not computed",
      "distribution",
      "Master Schema shot_boundary_interval segments",
      shotDurations.length ? "computed" : "needs source layer",
      shotDurations.length ? "Distribution is available from governed shot-boundary intervals." : "Requires exact shot durations.",
      "Master Schema temporal_segments[event_family=shot_boundary_interval]",
    ),
    statRow("distribution", "Level V", "boxplot", "speaker turn distribution", "not computed", "distribution", "speaker turn intervals", "needs source layer", "Requires timed speaker turns."),
    statRow("social_network", "Network", "degree", "entity interaction degree", matureAnchors, "nodes/edges", "manual anchors + interaction edges", matureAnchors ? "candidate" : "needs source layer", "Uses available mature anchors; actual centrality needs explicit edges."),
    statRow("social_network", "Network", "density", "interaction network density", "not computed", "score", "entity nodes + interaction edges", "needs source layer", "Requires a confirmed interaction edge set."),
    statRow("narrative", "Narrative", "event_rate", "scene transition rate", perMinute(cameraShots), "events/min", "scene/shot evidence count + duration", cameraShots && duration ? "candidate" : "needs source layer", "Count-derived transition proxy until exact boundaries are loaded."),
    statRow("narrative", "Narrative", "curve", "hero / villain / suspense / expression curves", "not computed", "timeline", "character presence + expression + scene markers", "needs source layer", "Requires timed character and expression traces."),
    statRow("linguistic", "Linguistic", "frequency", "POS / transcript token evidence", actions, "count", "POS/transcript evidence counts", computedOrMissing(actions), "Available when POS or transcript layers have been harvested."),
    statRow("linguistic", "Linguistic", "lexical_diversity", "type-token ratio", "not computed", "ratio", "transcript token table", "needs source layer", "Requires transcript tokens, not just metadata."),
    statRow("visual", "Visual", "density", "object density", perMinute(objects), "events/min", "object/tracked_objects counts + duration", objects && duration ? "candidate" : computedOrMissing(objects), "Rate computed from available object count and runtime."),
    statRow("visual", "Visual", "density", "face / expression density", perMinute(expressions + persons), "events/min", "person/expression counts + duration", (expressions || persons) && duration ? "candidate" : computedOrMissing(expressions + persons), "Rate computed from visible person/expression counts."),
    statRow(
      "visual",
      "Visual",
      "mean",
      "mean brightness / contrast / saturation / color entropy",
      brightnessValues.length
        ? `brightness ${roundStat(mean(brightnessValues))} / contrast ${roundStat(mean(contrastValues))} / saturation ${roundStat(mean(saturationValues))} / entropy ${roundStat(mean(entropyValues))}`
        : "not computed",
      "frame-window measure",
      "spatialToneScan.samples[].zones.whole_frame",
      brightnessValues.length ? "computed" : "needs source layer",
      brightnessValues.length
        ? "Computed from persisted, source-timed whole-frame visual measurements."
        : "Requires persisted source-timed spatial-tone measurements.",
      "spatial_tone_scan.json",
    ),
    statRow(
      "distribution",
      "Level V",
      "distribution",
      "brightness / contrast distribution",
      brightnessValues.length
        ? `${brightnessValues.length} windows / brightness median ${roundStat(median(brightnessValues))} / contrast median ${roundStat(median(contrastValues))}`
        : "not computed",
      "distribution",
      "spatialToneScan.samples[].zones.whole_frame",
      brightnessValues.length ? "computed" : "needs source layer",
      brightnessValues.length
        ? "Distribution is available from governed source-frame windows."
        : "Requires measured brightness and contrast windows.",
      "spatial_tone_scan.json",
    ),
    statRow("audio", "Audio", "ratio", "audio readiness", audioPresent ? 100 : 0, "%", "source_media_metadata.has_audio", hasMetadata ? "computed" : "needs source layer", "This is only readiness; actual audio statistics require audio intervals."),
    statRow(
      "audio",
      "Audio",
      "duration",
      "speech / silence / noise / music ratios",
      audioEventRows && analysisData?.metadata?.audioEventIntervals?.summary?.ratios
        ? Object.entries(analysisData.metadata.audioEventIntervals.summary.ratios)
            .map(([key, value]) => `${key} ${Math.round(Number(value) * 1000) / 10}%`)
            .join(" / ")
        : "not computed",
      "%",
      "Master Schema audio_event_interval segments",
      audioEventRows ? "computed" : "needs source layer",
      audioEventRows
        ? "Ratios are computed from governed speech/silence/noise/music intervals."
        : "Actual audio evidence must be loaded before ratios are claimed.",
      "Master Schema temporal_segments[event_family=audio_event_interval]",
    ),
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

function statNumericValue(row: StatsTableRow | null | undefined): number | null {
  if (!row) return null;
  if (typeof row.value === "number" && Number.isFinite(row.value)) return row.value;
  const parsed = Number(String(row.value).replace("%", "").match(/-?\d+(?:\.\d+)?/)?.[0] || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function buildLocalComparisonStatsRows(
  metadata: SourceMediaMetadata | null,
  analysisData: AnalysisData | null,
): StatsTableRow[] {
  const auditRows = buildMasterSchemaStatsAudit(analysisData, metadata);
  const metrics = buildMetrics(metadata, analysisData);
  const radar = buildRadar(metrics);
  return [
    ...buildSubstanceRows(metadata, analysisData, metrics, radar, null, auditRows),
    ...buildNativePatternStatsRows(metadata, analysisData),
  ];
}

function buildNativePatternStatsRows(
  metadata: SourceMediaMetadata | null,
  analysisData: AnalysisData | null,
  runOverride?: NativeStatisticalInterpretationRun | null,
): StatsTableRow[] {
  const run = runOverride || analysisData?.nativeStatisticalInterpretation;
  const finding = run?.finding;
  if (!finding) return [];
  const interval = finding.source_interval;
  const sourceAction = `datascene://analysis/${run?.analysis_id || metadata?.analysis_id || "unknown"}/video?t=${Number(interval?.start_seconds || 0)}`;
  const familyForSignal = (signal = ""): StatsFamily =>
    ["speech", "audio_event", "prosody"].includes(signal) ? "audio" :
      ["transcript", "sfl"].includes(signal) ? "linguistic" :
        ["visual_tone", "visual_motion", "expression", "props"].includes(signal) ? "visual" : "descriptive";
  const observationRows: StatsTableRow[] = (finding.observations || []).map((observation) => ({
    id: `native-pattern:${observation.metric_id}`,
    level: "scene",
    family: familyForSignal(observation.signal_family),
    method: "robust z relative to other governed scenes",
    statistic: observation.metric_label || observation.metric_id || "measured attribute",
    value: Number(observation.observed_value || 0),
    unit: observation.unit || "value",
    scope: "micro source interval / meso within-video baseline",
    evidence: (observation.evidence_refs || []).join(" + ") || "native statistical interpretation",
    status: "computed",
    note: `baseline median ${observation.baseline?.median ?? "unavailable"}; robust z ${observation.standardized_deviation?.value?.toFixed(3) ?? "unavailable"}`,
    requiredLayer: observation.signal_family || "measured source layer",
    resultId: observation.observation_id,
    sourceAction,
    visualizationTypes: ["bar_chart", "table", "timeline"],
  }));
  const relationshipRows: StatsTableRow[] = (run?.relationships || []).map((relationship) => ({
    id: `native-relationship:${relationship.left_metric}:${relationship.right_metric}`,
    level: "meso",
    family: "correlation",
    method: relationship.method || "spearman_rank_correlation",
    statistic: `${relationship.left_metric?.replaceAll("_", " ")} ↔ ${relationship.right_metric?.replaceAll("_", " ")}`,
    value: Number(relationship.coefficient || 0),
    unit: "Spearman rho",
    scope: "micro evidence / meso computed / macro comparison candidate",
    evidence: `${relationship.scene_count || 0} governed scenes`,
    status: "candidate",
    note: relationship.substantive_reading || relationship.interpretation || "Measured scene relationship.",
    requiredLayer: relationship.coupling || "cross-signal paired observations",
    resultId: relationship.relationship_id,
    sourceAction,
    visualizationTypes: ["heatmap", "network_graph", "table"],
  }));
  const metadataRecord = metadata as unknown as Record<string, unknown> | null;
  const storedIndex = metadataRecord && isRecord(metadataRecord.statistical_pattern_index)
    ? metadataRecord.statistical_pattern_index
    : null;
  const indexValue = Number(storedIndex?.value ?? finding.salience_index);
  const indexRows: StatsTableRow[] = Number.isFinite(indexValue) ? [{
    id: "file-statistical-pattern-index",
    level: "file",
    family: "comparative",
    method: "mean of capped absolute robust-z components",
    statistic: "statistical pattern index",
    value: indexValue,
    unit: "0–1 index",
    scope: "video file / corpus comparison",
    evidence: `${finding.observations?.length || 0} measured attributes`,
    status: "computed",
    note: "File-level comparison feature for corpus sorting, filtering, quality and genre analysis.",
    requiredLayer: "native statistical interpretation",
    resultId: finding.finding_id,
    sourceAction,
    visualizationTypes: ["bar_chart", "histogram", "boxplot", "table"],
  }] : [];
  return [...indexRows, ...observationRows, ...relationshipRows];
}

function findComparableFeatureRow(
  rows: StatsTableRow[],
  selected: StatsTableRow | null,
): StatsTableRow | null {
  if (!selected) return null;
  return rows.find((row) => row.id === selected.id) ||
    rows.find((row) =>
      row.family === selected.family &&
      row.method === selected.method &&
      row.statistic === selected.statistic,
    ) ||
    null;
}

function buildComparisonFeatureRows(
  corpus: ComparisonCorpusVideo[],
  selected: StatsTableRow | null,
): ComparisonFeatureRow[] {
  return corpus.map((item) => {
    const row = findComparableFeatureRow(item.statsRows, selected);
    const value = statNumericValue(row);
    return {
      analysisId: item.analysisId,
      sourceName: item.sourceName,
      value,
      displayValue: row ? String(row.value) : "missing",
      status: row?.status || "missing",
      evidence: row?.evidence || "No matching StatsKit row in this local analysis.",
    };
  });
}

function comparisonSummary(rows: ComparisonFeatureRow[]): {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  delta: number | null;
} {
  const values = rows.map((row) => row.value).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) {
    return { count: 0, min: null, max: null, mean: null, delta: null };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    count: values.length,
    min,
    max,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    delta: max - min,
  };
}

function comparisonVisualizationData(rows: ComparisonFeatureRow[]): VisualizationDatum[] {
  return rows
    .map((row): VisualizationDatum | null => {
      if (row.value === null || !Number.isFinite(row.value)) return null;
      return {
        id: row.analysisId,
        label: row.sourceName,
        value: row.value,
        detail: `${row.status} / ${row.evidence}`,
        group: "comparison",
        status: row.status,
      };
    })
    .filter((row): row is VisualizationDatum => Boolean(row));
}

function missingnessVisualizationData(
  missingness: ReturnType<typeof buildMissingnessProfile>,
): VisualizationDatum[] {
  return missingness.map((row) => ({
    id: row.variable_id,
    label: row.label,
    value: Math.round(row.missing_rate * 100),
    detail: `${row.missing_count} missing / ${row.observed_count} observed`,
    group: "missingness",
    status: row.missing_count ? "needs review" : "complete",
  }));
}

const LOCAL_STATS_COMPARISON_POLICY = {
  mode: "local_offline_first",
  defaultDataLocation: "local saved Datascene analyses",
  licensePolicy: "license-free core; licensed scripts and online providers require explicit activation",
  offlineStandalone: "available when saved analyses and local artifacts are present",
};

const STATS_COMPARISON_WORKFLOW: StudioWorkflowStep[] = [
  "corpus",
  "unit",
  "variables",
  "matrix",
  "quality",
  "analyses",
  "diagnostics",
  "variants",
  "interpretation",
  "traceback",
  "export",
];

const STATS_COMPARISON_SUPPORTED_METHODS = {
  descriptive_comparison: [
    "corpus_summary_table",
    "per_video_profile_table",
    "group_comparison_table",
    "mean_median_comparison",
    "proportion_comparison",
    "distribution_comparison",
  ],
  association: [
    "correlation_heatmap",
    "pairwise_scatterplot",
    "cross_tabulation",
  ],
  exploratory_multivariate: [
    "pca_corpus_map",
    "pca_loadings_table",
    "kmeans_cluster_explorer",
    "nearest_neighbor_similarity",
    "outlier_detection",
  ],
  traceback: [
    "click_table_cell_to_source",
    "click_chart_point_to_video",
    "click_cluster_to_member_videos",
    "click_outlier_to_source_scene",
    "click_correlation_to_underlying_observations",
  ],
};

function buildFeatureMatrix(
  corpus: ComparisonCorpusVideo[],
  variables: StatsTableRow[],
): Array<Record<string, string | number | null>> {
  return corpus.map((item) => {
    const row: Record<string, string | number | null> = {
      analysis_id: item.analysisId,
      source_name: item.sourceName,
    };
    variables.forEach((variable) => {
      row[variable.id] = statNumericValue(findComparableFeatureRow(item.statsRows, variable));
    });
    return row;
  });
}

function buildVariableRegistry(variables: StatsTableRow[]) {
  return variables.map((variable) => ({
    variable_id: variable.id,
    label: variable.statistic,
    method: variable.method,
    family: variable.family,
    measurement_level: variable.unit === "%" ? "ratio_percent" : typeof variable.value === "number" ? "numeric" : "mixed",
    unit: variable.unit,
    provenance: variable.evidence,
    required_layer: variable.requiredLayer,
    comparability: ["computed", "candidate", "raw"].includes(variable.status) ? "comparable" : "needs_review",
  }));
}

function buildMissingnessProfile(matrix: Array<Record<string, string | number | null>>, variables: StatsTableRow[]) {
  return variables.map((variable) => {
    const missing = matrix.filter((row) => row[variable.id] === null || row[variable.id] === undefined).length;
    return {
      variable_id: variable.id,
      label: variable.statistic,
      missing_count: missing,
      observed_count: Math.max(0, matrix.length - missing),
      missing_rate: matrix.length ? missing / matrix.length : 0,
    };
  });
}

function buildStatsComparisonStudioPackage({
  activeAnalysisId,
  corpus,
  variables,
  selectedFeatureRows,
  unitOfAnalysis,
  variantMode,
}: {
  activeAnalysisId: string;
  corpus: ComparisonCorpusVideo[];
  variables: StatsTableRow[];
  selectedFeatureRows: ComparisonFeatureRow[];
  unitOfAnalysis: string;
  variantMode: string;
}): StatsComparisonStudioPackage {
  const matrix = buildFeatureMatrix(corpus, variables);
  const missingness = buildMissingnessProfile(matrix, variables);
  const numericValues = selectedFeatureRows
    .map((row) => row.value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const summary = comparisonSummary(selectedFeatureRows);
  const qualityWarnings = [
    ...(corpus.length < 2 ? ["Corpus needs at least two videos for comparison."] : []),
    ...missingness.filter((row) => row.missing_count > 0).slice(0, 4).map((row) => `${row.label} has missing values.`),
    ...(numericValues.length < selectedFeatureRows.length ? ["Selected feature has non-numeric or missing rows in the corpus."] : []),
  ];
  return {
    StatsComparisonStudio: {
      schema_name: "Datascene Stats Comparison Studio",
      schema_version: "0.1.0",
      purpose: "Professional statistical comparison environment for multimodal Datascene corpora.",
      workflow: STATS_COMPARISON_WORKFLOW,
      runtime_policy: LOCAL_STATS_COMPARISON_POLICY,
      core_objects: {
        AnalysisProject: {
          project_id: `stats-comparison:${activeAnalysisId || "local"}`,
          active_analysis_id: activeAnalysisId,
          execution_environment: "local_datascene_runtime",
        },
        CorpusDefinition: {
          corpus_id: "local_saved_analysis_corpus",
          analysis_ids: corpus.map((item) => item.analysisId),
          source_names: corpus.map((item) => item.sourceName),
          inclusion_rule: "completed local Datascene analyses selected by the analyst",
        },
        UnitOfAnalysisModel: {
          unit: unitOfAnalysis,
          observation_count: corpus.length,
          supported_units: ["video", "scene", "shot", "speaker_turn", "source_moment"],
        },
        VariableRegistry: buildVariableRegistry(variables),
        FeatureMatrix: {
          matrix_version: "local-ui-0.1.0",
          row_count: matrix.length,
          column_count: variables.length,
          rows: matrix,
        },
        MissingnessProfile: missingness,
        UncertaintyModel: {
          policy: "propagate source row status into diagnostics",
          source_statuses: selectedFeatureRows.reduce<Record<string, number>>((acc, row) => {
            acc[row.status] = (acc[row.status] || 0) + 1;
            return acc;
          }, {}),
        },
        AnalysisRecipe: {
          selected_methods: ["per_video_profile_table", "mean_median_comparison", "distribution_comparison"],
          variant_mode: variantMode,
          variables: variables.map((variable) => variable.id),
        },
        AnalysisRun: {
          run_id: `local-comparison:${activeAnalysisId || "no-active-analysis"}`,
          status: corpus.length > 1 && variables.length ? "ready" : "needs_inputs",
          executed_in: "frontend_local_corpus_builder",
        },
        AnalysisDiagnostics: {
          quality_flags: qualityWarnings,
          comparable_numeric_rows: numericValues.length,
          corpus_size: corpus.length,
        },
        AnalysisResult: {
          selected_feature_summary: summary,
          selected_feature_rows: selectedFeatureRows,
        },
        AnalysisVisualization: {
          available_modes: ["table", "bar_chart", "histogram", "boxplot", "heatmap"],
          current_binding: "selected StatsKit feature across selected local videos",
        },
        AnalysisInterpretation: {
          status: summary.count > 1 ? "candidate" : "needs_corpus",
          claim: summary.delta === null
            ? "No interpretable cross-video difference is available yet."
            : `The selected feature varies by ${roundStat(summary.delta)} across the local comparison corpus.`,
          review_state: "analyst_review_required",
        },
        AnalysisVariant: [
          { variant_id: "all_selected", specification: "Use all checked local videos." },
          { variant_id: "computed_only", specification: "Use only computed/candidate numeric rows." },
        ],
        AnalysisProvenanceGraph: {
          root: "StatsComparisonStudio",
          edges: selectedFeatureRows.map((row) => ({
            from: "AnalysisResult",
            to: `analysis:${row.analysisId}`,
            evidence: row.evidence,
            source_action: `datascene://analysis/${row.analysisId}/statskit`,
          })),
        },
      },
      v1_supported_methods: STATS_COMPARISON_SUPPORTED_METHODS,
    },
  };
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
  const [activeAnalysisId, setActiveAnalysisId] = useState(() => {
    const remembered = eventBus.getLast<unknown>("videoIdChanged");
    const rememberedId = typeof remembered === "string"
      ? remembered
      : isRecord(remembered)
        ? String(remembered.analysisId || remembered.videoId || remembered.id || "")
        : "";
    return analysisId || videoId || rememberedId;
  });
  const [sourceMetadataRefreshNonce, setSourceMetadataRefreshNonce] = useState(0);
  const [metadata, setMetadata] = useState<SourceMediaMetadata | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "complete" | "failed">("idle");
  const [runSummary, setRunSummary] = useState("");
  const [runArtifact, setRunArtifact] = useState<Record<string, unknown> | null>(null);
  const [interpretationRunning, setInterpretationRunning] = useState(false);
  const [interpretationResult, setInterpretationResult] = useState<NativeStatisticalInterpretationRun | null>(null);
  const [statisticalOverviewVisible, setStatisticalOverviewVisible] = useState(true);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const workbenchRef = useRef<HTMLDetailsElement | null>(null);
  const [comparisonStudioOpen, setComparisonStudioOpen] = useState(false);
  const comparisonStudioRef = useRef<HTMLDetailsElement | null>(null);
  const [scope, setScope] = useState<"scene" | "video" | "collection">("video");
  const [audience, setAudience] = useState<"analyst" | "editor" | "researcher" | "journalist">("analyst");
  const [statFamily, setStatFamily] = useState<StatsFamily>("descriptive");
  const [taxonomyTheme, setTaxonomyTheme] = useState("all");
  const [taxonomySubcategory, setTaxonomySubcategory] = useState("all");
  const [taxonomySearch, setTaxonomySearch] = useState("");
  const [selectedReadinessLayerId, setSelectedReadinessLayerId] = useState(
    "true-shot-boundary-intervals",
  );
  const [visualization, setVisualization] = useState<VisualizationMode>("bar_chart");
  const [visualizationTarget, setVisualizationTarget] = useState<VisualizationTarget>("stats");
  const [selectedStatId, setSelectedStatId] = useState("");
  const [expandedEvidenceRowId, setExpandedEvidenceRowId] = useState("");
  const [inlineEvidencePage, setInlineEvidencePage] = useState(0);
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
  const [availableComparisonVideos, setAvailableComparisonVideos] = useState<VideoMetadata[]>([]);
  const [selectedComparisonIds, setSelectedComparisonIds] = useState<string[]>([]);
  const [comparisonCorpus, setComparisonCorpus] = useState<ComparisonCorpusVideo[]>([]);
  const [comparisonStatus, setComparisonStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [comparisonError, setComparisonError] = useState("");
  const [studioStep, setStudioStep] = useState<StudioWorkflowStep>("corpus");
  const [studioUnitOfAnalysis, setStudioUnitOfAnalysis] = useState("video");
  const [studioVariantMode, setStudioVariantMode] = useState("all_selected");
  const [statsReportDraft, setStatsReportDraft] = useState("");

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
    const handler = (payload?: unknown) => {
      const changedId = isRecord(payload) ? String(payload.analysisId || payload.videoId || "") : String(payload || "");
      if (!changedId || changedId === activeAnalysisId) {
        setSourceMetadataRefreshNonce((value) => value + 1);
      }
    };
    eventBus.on("sourceMediaMetadataUpdated", handler);
    return () => eventBus.off("sourceMediaMetadataUpdated", handler);
  }, [activeAnalysisId]);

  useEffect(() => {
    const nextId = analysisId || videoId || "";
    if (!nextId) return;
    void Promise.resolve().then(() => setActiveAnalysisId(nextId));
  }, [analysisId, videoId]);

  useEffect(() => {
    setExpandedEvidenceRowId("");
    setInlineEvidencePage(0);
  }, [activeAnalysisId, statFamily, taxonomyTheme, taxonomySubcategory]);

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
  }, [activeAnalysisId, sourceMetadataRefreshNonce]);

  useEffect(() => {
    if (!comparisonStudioOpen) return;
    let cancelled = false;
    VideoService.listVideos(20)
      .then((videos) => {
        if (cancelled) return;
        const completed = videos.filter((video) => video.status === "completed");
        setAvailableComparisonVideos(completed);
        setSelectedComparisonIds((current) => {
          const valid = new Set(completed.map((video) => video.id));
          const retained = current.filter((id) => valid.has(id));
          if (retained.length) return retained;
          const defaults = [
            activeAnalysisId,
            ...completed.filter((video) => video.id !== activeAnalysisId).slice(0, 5).map((video) => video.id),
          ].filter(Boolean);
          return [...new Set(defaults)];
        });
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("StatsKit comparison corpus list failed:", error);
          setAvailableComparisonVideos([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeAnalysisId, comparisonStudioOpen]);

  useEffect(() => {
    if (!comparisonStudioOpen) {
      setComparisonStatus("idle");
      return;
    }
    const ids = [...new Set(selectedComparisonIds.filter(Boolean))].slice(0, 8);
    if (!ids.length) {
      setComparisonCorpus([]);
      setComparisonStatus("idle");
      return;
    }
    let cancelled = false;
    setComparisonStatus("loading");
    setComparisonError("");
    Promise.allSettled(ids.map(async (id): Promise<ComparisonCorpusVideo> => {
      if (id === activeAnalysisId && (metadata || analysisData)) {
        return {
          analysisId: id,
          sourceName: metadata?.original_filename || metadata?.analysis_id || analysisData?.metadata?.sourceName || id,
          metadata,
          analysisData,
          statsRows: buildLocalComparisonStatsRows(metadata, analysisData),
        };
      }
      const [metadataResult, analysisResult] = await Promise.allSettled([
        apiService.getSourceMediaMetadata(id),
        VideoService.getAnalysis(id),
      ]);
      const nextMetadata = metadataResult.status === "fulfilled" ? metadataResult.value : null;
      const nextAnalysisData = analysisResult.status === "fulfilled" ? analysisResult.value : null;
      return {
        analysisId: id,
        sourceName: nextMetadata?.original_filename || nextAnalysisData?.metadata?.sourceName || id,
        metadata: nextMetadata,
        analysisData: nextAnalysisData,
        statsRows: buildLocalComparisonStatsRows(nextMetadata, nextAnalysisData),
      };
    }))
      .then((results) => {
        if (cancelled) return;
        const fulfilled = results
          .filter((result): result is PromiseFulfilledResult<ComparisonCorpusVideo> => result.status === "fulfilled")
          .map((result) => result.value)
          .filter((item) => item.statsRows.length > 0);
        setComparisonCorpus(fulfilled);
        setComparisonStatus(fulfilled.length > 1 ? "ready" : "idle");
        const rejected = results.filter((result) => result.status === "rejected");
        setComparisonError(rejected.length ? `${rejected.length} local analysis record(s) could not be loaded for comparison.` : "");
      })
      .catch((error) => {
        if (!cancelled) {
          setComparisonCorpus([]);
          setComparisonStatus("failed");
          setComparisonError(error instanceof Error ? error.message : "Local comparison corpus load failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeAnalysisId,
    comparisonStudioOpen,
    selectedComparisonIds.join("|"),
    metadata,
    analysisData,
  ]);

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

  const runStatisticalInterpretation = async () => {
    if (!activeAnalysisId || interpretationRunning) return;
    setInterpretationRunning(true);
    setRunSummary("Computing scene-level deviations and cross-signal associations...");
    try {
      const result = await apiService.runNativeStatisticalInterpretation(activeAnalysisId);
      setInterpretationResult(result);
      setStatisticalOverviewVisible(true);
      const refreshed = await VideoService.refreshAnalysis(activeAnalysisId);
      setAnalysisData(refreshed);
      setRunSummary("");
      eventBus.emit("analysisCorrectionsChanged", activeAnalysisId);
    } catch (error) {
      setRunSummary(error instanceof Error ? error.message : "Statistical interpretation failed");
    } finally {
      setInterpretationRunning(false);
    }
  };

  const clearStatsKitInquiry = () => {
    setInterpretationResult(null);
    setStatisticalOverviewVisible(false);
    setRunArtifact(null);
    setRunSummary("");
    setRunStatus("idle");
    setSelectedStatId("");
    setSelectedStatIds([]);
    setExpandedEvidenceRowId("");
    setSelectedScannerRowId("");
    setSelectedScannerRowIds([]);
    setSelectedSignificanceRowId("");
    setSelectedSignificanceRowIds([]);
    setVisualizationTarget("stats");
    setVisualization("bar_chart");
    setWorkbenchOpen(false);
  };

  const refreshStatsKitInquiry = async () => {
    clearStatsKitInquiry();
    if (!activeAnalysisId) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const refreshed = await VideoService.refreshAnalysis(activeAnalysisId);
      setAnalysisData(refreshed);
      const refreshedMetadata = await apiService.getSourceMediaMetadata(activeAnalysisId);
      setMetadata(refreshedMetadata);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "StatsKit refresh failed");
    } finally {
      setIsLoading(false);
    }
  };

  const statsRows = useMemo(
    () => [
      ...buildSubstanceRows(metadata, analysisData, metrics, radar, runArtifact, masterAuditRows),
      ...buildNativePatternStatsRows(metadata, analysisData, interpretationResult),
    ],
    [metadata, analysisData, interpretationResult, metrics, radar, runArtifact, masterAuditRows],
  );
  const operationalStatsRows = useMemo(
    () => statsRows.map((row) => {
      if (row.family !== "comparative" || row.statistic !== "video-to-video comparison") {
        return row;
      }
      if (comparisonCorpus.length < 2) return row;
      return {
        ...row,
        value: comparisonCorpus.length,
        unit: "videos",
        evidence: "local Datascene saved analyses + Master Schema StatsKit rows",
        status: "computed" as const,
        note: "Computed from the local offline comparison corpus. No online provider or licensed script is used.",
        requiredLayer: "local Datascene comparison corpus",
        visualizationTypes: defaultVisualizationTypes({ ...row, status: "computed", unit: "videos" }),
      };
    }),
    [statsRows, comparisonCorpus.length],
  );
  const schemaCoverageRows = buildSchemaCoverageRows(runArtifact, claims, radar, metadata);
  const schemaBundle = useMemo(
    () => buildSignificanceRelevanceSchemaBundle(activeAnalysisId, scope, audience, metrics, radar, claims, runArtifact, metadata),
    [activeAnalysisId, scope, audience, metrics, radar, claims, runArtifact, metadata],
  );
  const significanceRelevanceDeliveryAudit = useMemo(
    () => buildSignificanceRelevanceDeliveryAudit(schemaBundle, runArtifact, claims, radar, operationalStatsRows),
    [schemaBundle, runArtifact, claims, radar, operationalStatsRows],
  );
  const selectedFamily = STAT_FAMILY_OPTIONS.find((option) => option.id === statFamily) || STAT_FAMILY_OPTIONS[0];
  const methodOrder = ["frequency", "percentage", "duration", "mean", "median", "variance", "standard_deviation"];
  const taxonomySubcategories = [...new Set(
    operationalStatsRows
      .filter((row) =>
        row.family === "taxonomy" &&
        (taxonomyTheme === "all" || row.scope === taxonomyTheme),
      )
      .map((row) => row.method)
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  const normalizedTaxonomySearch = taxonomySearch.trim().toLowerCase();
  const visibleStatsRows = operationalStatsRows
    .filter((row) =>
      row.family === statFamily &&
      (statFamily !== "correlation" || row.id.startsWith("native-relationship:")) &&
      (
        statFamily !== "taxonomy" ||
        (
          (taxonomyTheme === "all" || row.scope === taxonomyTheme) &&
          (taxonomySubcategory === "all" || row.method === taxonomySubcategory) &&
          (
            !normalizedTaxonomySearch ||
            `${row.method} ${row.statistic} ${row.evidence} ${row.status} ${row.note}`
              .toLowerCase()
              .includes(normalizedTaxonomySearch)
          )
        )
      ),
    )
    .sort((left, right) => {
      if (statFamily === "correlation") {
        const nativeDifference = Number(right.id.startsWith("native-relationship:")) - Number(left.id.startsWith("native-relationship:"));
        if (nativeDifference) return nativeDifference;
      }
      if (statFamily === "taxonomy") {
        return left.method.localeCompare(right.method, undefined, { sensitivity: "base" }) ||
          left.statistic.localeCompare(right.statistic, undefined, { sensitivity: "base" });
      }
      const leftMethod = methodOrder.indexOf(left.method);
      const rightMethod = methodOrder.indexOf(right.method);
      const methodDifference = (leftMethod < 0 ? methodOrder.length : leftMethod) - (rightMethod < 0 ? methodOrder.length : rightMethod);
      return methodDifference || left.statistic.localeCompare(right.statistic, undefined, { sensitivity: "base" });
    });
  const visibleStatsRowIds = visibleStatsRows.map((row) => row.id).join("|");
  const activeNativeRun = interpretationResult || analysisData?.nativeStatisticalInterpretation;
  const relationshipExplorerRows = statFamily === "correlation"
    ? (activeNativeRun?.relationships || []).map((relationship) => ({
        relationship,
        row: visibleStatsRows.find((candidate) => candidate.resultId === relationship.relationship_id) || null,
      })).filter((item) => item.row)
    : [];
  const selectedStat = visibleStatsRows.find((row) => row.id === selectedStatId) || visibleStatsRows[0] || null;
  const inlineEvidenceRecords = useMemo<InlineEvidenceRecord[]>(() => {
    if (!selectedStat) return [];
    const basis = `${selectedStat.statistic} ${selectedStat.method} ${selectedStat.requiredLayer} ${selectedStat.evidence}`.toLowerCase();
    const nativeRun = interpretationResult || analysisData?.nativeStatisticalInterpretation;
    const nativeRelationship = (nativeRun?.relationships || []).find((relationship) => relationship.relationship_id === selectedStat.resultId);
    if (nativeRelationship) {
      return (nativeRelationship.source_intervals || []).map((interval, index) => ({
        id: `${nativeRelationship.relationship_id}:scene:${index + 1}`,
        label: `${nativeRelationship.left_metric?.replaceAll("_", " ")} ↔ ${nativeRelationship.right_metric?.replaceAll("_", " ")} · scene ${index + 1}`,
        start: Number(interval.start_seconds || 0),
        end: Number(interval.end_seconds || interval.start_seconds || 0),
        authority: "computed paired observation",
        source: nativeRelationship.method || "spearman_rank_correlation",
      }));
    }
    if (selectedStat.family === "comparative") {
      return comparisonCorpus.map((item) => {
        const comparable = findComparableFeatureRow(item.statsRows, selectedStat);
        return {
          id: `comparison:${selectedStat.id}:${item.analysisId}`,
          label: `${item.sourceName} · ${comparable?.value ?? "missing"} ${comparable?.unit || ""}`,
          start: 0,
          end: 0,
          authority: comparable?.status || "missing",
          source: "StatsKit comparison corpus",
        };
      });
    }
    const category =
      basis.includes("camera shot") ||
      basis.includes("shot_boundary") ||
      (basis.includes("visual shot") && !basis.includes("visual scene"))
      ? "shot_boundary"
      : basis.includes("scene card")
        ? "scene_card"
        : basis.includes("organization")
          ? "organization"
          : basis.includes("place") || basis.includes("location")
            ? "place"
            : basis.includes("expression")
              ? "expression"
              : basis.includes("object")
                ? "object"
                : basis.includes("speaker")
                  ? "speaker_diarization"
                  : basis.includes("transcript") || basis.includes("speech")
                    ? "transcript"
                    : null;
    const masterRows = (analysisData?.masterSchemaResolvedEvidence?.records || [])
      .filter((record) => !category || record.category === category)
      .map((record) => ({
        id: record.id,
        label: record.label,
        start: record.start,
        end: record.end,
        authority: record.authority,
        source: record.sourcePanel,
      }));
    if (category === "shot_boundary") {
      if (masterRows.length) return masterRows;
      return (analysisData?.metadata?.motionSceneBasis?.shotBoundaries?.intervals || [])
        .map((interval, index) => ({
          id: String(interval.shot_id || `shot-boundary:${index + 1}`),
          label: `Shot ${index + 1}`,
          start: Number(interval.start ?? 0),
          end: Number(interval.end ?? interval.start ?? 0),
          authority: "measured governed interval",
          source: "shot_boundaries.json",
        }));
    }
    if (
      basis.includes("spatial_tone") ||
      basis.includes("brightness") ||
      basis.includes("contrast") ||
      basis.includes("saturation") ||
      basis.includes("color entropy") ||
      basis.includes("luminance entropy")
    ) {
      return (analysisData?.metadata?.spatialToneScan?.samples || []).map((sample, index) => {
        const wholeFrame = sample.zones?.whole_frame;
        return {
          id: `spatial-tone:${index + 1}`,
          label: [
            wholeFrame?.dominant_tone || "Measured visual tone",
            typeof wholeFrame?.brightness === "number"
              ? `brightness ${wholeFrame.brightness.toFixed(1)}`
              : wholeFrame?.brightness_band,
            typeof wholeFrame?.contrast === "number"
              ? `contrast ${wholeFrame.contrast.toFixed(1)}`
              : wholeFrame?.contrast_band,
          ].filter(Boolean).join(" · "),
          start: Number(sample.timestamp ?? 0),
          end: Number(sample.timestamp ?? 0) + 1,
          authority: "measured governed window",
          source: "spatial_tone_scan.json",
        };
      });
    }
    if (category) return masterRows;

    if (selectedStat.method === "Plot lens readings") {
      const lensId = selectedStat.evidence.match(/lens_id=([^\]]+)/)?.[1];
      return artifactReadings(analysisData?.narrativeLensReading)
        .filter((reading) => !lensId || reading.lens_id === lensId)
        .map((reading, index) => {
          const target = isRecord(reading.target) ? reading.target : {};
          const span = isRecord(target.time_span) ? target.time_span : {};
          return {
            id: String(reading.reading_id || `lens-reading:${index}`),
            label: String(reading.claim_prose || reading.claim_label || selectedStat.statistic),
            start: Number(span.start_ms) / 1000,
            end: Number(span.end_ms) / 1000,
            authority: String(reading.authority_level || reading.maturity_state || "interpretive reading"),
            source: "narrative_lens_reading",
          };
        });
    }

    if (selectedStat.statistic === "Source annotations") {
      const annotations = isRecord(metadata?.user_annotations) ? metadata.user_annotations : {};
      return Object.entries(annotations).flatMap(([field, value]) => {
        const values = Array.isArray(value) ? value : [value];
        return values.filter((item) => item !== null && item !== undefined && String(item).trim()).map((item, index) => ({
          id: `source-annotation:${field}:${index}`,
          label: `${field.replaceAll("_", " ")}: ${typeof item === "string" ? item : JSON.stringify(item)}`,
          authority: "user confirmed source metadata",
          source: "source_media_metadata.user_annotations",
        }));
      });
    }
    return [];
  }, [analysisData, comparisonCorpus, interpretationResult, metadata, selectedStat]);
  const inlineEvidencePageCount = Math.max(1, Math.ceil(inlineEvidenceRecords.length / INLINE_EVIDENCE_PAGE_SIZE));
  const safeInlineEvidencePage = Math.min(inlineEvidencePage, inlineEvidencePageCount - 1);
  const inlineEvidencePageStart = safeInlineEvidencePage * INLINE_EVIDENCE_PAGE_SIZE;
  const visibleInlineEvidenceRecords = inlineEvidenceRecords.slice(
    inlineEvidencePageStart,
    inlineEvidencePageStart + INLINE_EVIDENCE_PAGE_SIZE,
  );
  const selectedStatsForVisualization = visibleStatsRows.filter((row) => selectedStatIds.includes(row.id));
  const visualizationRows = selectedStatsForVisualization.length
    ? selectedStatsForVisualization
    : selectedStat
      ? [selectedStat]
      : [];
  const computedRows = visibleStatsRows.filter((row) => statFamily === "taxonomy"
    ? !["missing", "profile_pending", "not_operational"].includes(row.status)
    : ["computed", "candidate", "raw"].includes(row.status)).length;
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
  const studioVariables = useMemo(() => {
    const checked = operationalStatsRows.filter((row) => selectedStatIds.includes(row.id));
    if (checked.length) return checked.slice(0, 12);
    if (selectedStat) return [selectedStat];
    return operationalStatsRows.filter((row) => ["computed", "candidate", "raw"].includes(row.status)).slice(0, 8);
  }, [operationalStatsRows, selectedStatIds, selectedStat]);
  const comparisonFeatureRows = useMemo(
    () => buildComparisonFeatureRows(comparisonCorpus, selectedStat),
    [comparisonCorpus, selectedStat],
  );
  const comparisonFeatureSummary = useMemo(
    () => comparisonSummary(comparisonFeatureRows),
    [comparisonFeatureRows],
  );
  const studioFeatureMatrix = useMemo(
    () => buildFeatureMatrix(comparisonCorpus, studioVariables),
    [comparisonCorpus, studioVariables],
  );
  const studioMissingnessProfile = useMemo(
    () => buildMissingnessProfile(studioFeatureMatrix, studioVariables),
    [studioFeatureMatrix, studioVariables],
  );
  const comparisonPlottedData = useMemo(
    () => comparisonVisualizationData(comparisonFeatureRows),
    [comparisonFeatureRows],
  );
  const missingnessPlottedData = useMemo(
    () => missingnessVisualizationData(studioMissingnessProfile),
    [studioMissingnessProfile],
  );
  const plottedData = visualizationTarget === "significance"
    ? significancePlottedData
    : visualizationTarget === "relevance"
      ? relevancePlottedData
      : visualizationTarget === "comparison"
        ? studioStep === "quality"
          ? missingnessPlottedData
          : comparisonPlottedData
        : statsPlottedData;
  const missingDataRows = buildMissingDataRows(operationalStatsRows);
  const sourceLayerDeliverables = useMemo(
    () => buildStatsKitSourceLayerDeliverables(analysisData),
    [analysisData],
  );
  const selectedReadinessLayer =
    sourceLayerDeliverables.find((row) => row.id === selectedReadinessLayerId) ||
    sourceLayerDeliverables[0] ||
    null;
  const selectedCanVisualize = plottedData.length > 0;
  const studioPackage = useMemo(
    () => buildStatsComparisonStudioPackage({
      activeAnalysisId,
      corpus: comparisonCorpus,
      variables: studioVariables,
      selectedFeatureRows: comparisonFeatureRows,
      unitOfAnalysis: studioUnitOfAnalysis,
      variantMode: studioVariantMode,
    }),
    [
      activeAnalysisId,
      comparisonCorpus,
      studioVariables,
      comparisonFeatureRows,
      studioUnitOfAnalysis,
      studioVariantMode,
    ],
  );
  const selectedResultCount = isRecord(schemaBundle.StatsKit) && Array.isArray(schemaBundle.StatsKit.source_results)
    ? schemaBundle.StatsKit.source_results.length
    : 0;
  const writeStatsReportDraft = () => {
    const relationships = analysisData?.nativeStatisticalInterpretation?.relationships || [];
    const strongest = [...relationships].sort((left, right) => Math.abs(Number(right.coefficient || 0)) - Math.abs(Number(left.coefficient || 0))).slice(0, 5);
    const indexRows = comparisonCorpus.map((item) => {
      const row = item.statsRows.find((candidate) => candidate.id === "file-statistical-pattern-index");
      return { name: item.sourceName, value: statNumericValue(row) };
    }).filter((row) => row.value !== null);
    const indexSentence = indexRows.length > 1
      ? `Across ${indexRows.length} files, the statistical pattern index ranges from ${roundStat(Math.min(...indexRows.map((row) => row.value as number)))} to ${roundStat(Math.max(...indexRows.map((row) => row.value as number)))}.`
      : indexRows.length === 1
        ? `${indexRows[0].name} has a file-level statistical pattern index of ${roundStat(indexRows[0].value as number)}.`
        : "No comparable file-level pattern indices are loaded.";
    const relationshipText = strongest.length
      ? strongest.map((relationship) => {
          const frames = relationship.analytical_frames;
          return `- ${relationship.left_metric?.replaceAll("_", " ")} and ${relationship.right_metric?.replaceAll("_", " ")} show a ${relationship.direction} ${relationship.strength_label} rank association (Spearman ρ=${Number(relationship.coefficient || 0).toFixed(3)}, n=${relationship.scene_count || 0} scenes). Frame: ${(frames?.orientation || []).join("/")}; ${(frames?.evidence_expression || []).join("/")} evidence; meso result grounded in micro intervals.`;
        }).join("\n")
      : "- No framed cross-signal relationships are available.";
    setStatsReportDraft([
      `Statistical pattern report — ${sourceName}`,
      "",
      "Corpus overview",
      indexSentence,
      "",
      "Cross-signal results",
      relationshipText,
      "",
      "Analytical reading",
      "These results identify measured co-variation for analyst interpretation. Micro evidence can be opened at source; meso relationships are computed across governed scenes; macro claims require a multi-file comparison.",
    ].join("\n"));
  };
  const downloadStatsReportDraft = () => {
    if (!statsReportDraft) return;
    const blob = new Blob([statsReportDraft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `datascene_statistical_pattern_report_${activeAnalysisId || "corpus"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const selectedScannerRow = scannerRows.find((row) => row.id === selectedScannerRowId) || scannerRows[0] || null;
  const selectedSignificanceRow =
    filteredSignificanceRows.find((row) => row.id === selectedSignificanceRowId) ||
    filteredSignificanceRows[0] ||
    null;
  const sourceName = metadata?.original_filename || metadata?.analysis_id || activeAnalysisId || "no analysis";
  const selectedComparisonSet = new Set(selectedComparisonIds);
  const duration = num(metadata?.duration_seconds);
  const compactIndicators = [
    `${metadata ? "source loaded" : "source missing"}`,
    `${duration ? `${duration.toFixed(1)}s` : "duration n/a"}`,
    `${analysisData?.masterSchemaResolvedEvidence?.records?.length || 0} master records`,
    `${visibleStatsRows.length} ${selectedFamily.label}`,
    `${visualizationRows.length} selected`,
    statFamily === "taxonomy"
      ? `${computedRows} mapped / ${missingRows} target-only`
      : `${computedRows} computed / ${missingRows} missing`,
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

  useEffect(() => {
    if (["matrix", "quality", "analyses", "diagnostics", "variants", "interpretation"].includes(studioStep)) {
      setVisualizationTarget("comparison");
    }
  }, [studioStep]);

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

  const toggleComparisonVideo = (analysisId: string) => {
    setSelectedComparisonIds((current) =>
      current.includes(analysisId)
        ? current.filter((id) => id !== analysisId)
        : [...current, analysisId],
    );
  };

  const exportStudioPackage = () => {
    const blob = new Blob([JSON.stringify(studioPackage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `datascene_stats_comparison_studio_${activeAnalysisId || "local"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const setColumnWidth = (column: StatsWorkbenchColumn, width: number) => {
    setStatColumnWidths((current) => ({
      ...current,
      [column]: width,
    }));
  };

  const resetColumnWidths = () => setStatColumnWidths(DEFAULT_STAT_COLUMN_WIDTHS);

  const storedPatternIndex = isRecord((metadata as unknown as Record<string, unknown> | null)?.statistical_pattern_index)
    ? (metadata as unknown as Record<string, unknown>).statistical_pattern_index as Record<string, unknown>
    : null;
  const currentFinding = interpretationResult?.finding || analysisData?.nativeStatisticalInterpretation?.finding;
  const filePatternIndex = storedPatternIndex || (currentFinding ? {
    value: currentFinding.salience_index,
    attribute_count: currentFinding.observations?.length || 0,
    signal_family_count: currentFinding.independent_signal_family_count || 0,
    signal_families: currentFinding.signal_families || [],
    selected_source_interval: currentFinding.source_interval,
    method: "mean_of_capped_absolute_robust_z_components",
  } : null);

  const openPatternAttributeInWorkbench = (metricId: string, metricLabel: string) => {
    const normalized = (value: string) => value
      .toLowerCase()
      .replace(/[_/]+/g, " ")
      .replace(/\b(mean|ratio|rate|index)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const target = normalized(`${metricId} ${metricLabel}`);
    const targetTokens = new Set(target.split(" ").filter((token) => token.length > 2));
    const ranked = operationalStatsRows
      .map((row) => {
        const rowText = normalized(`${row.statistic} ${row.method} ${row.evidence} ${row.requiredLayer}`);
        const overlap = [...targetTokens].filter((token) => rowText.includes(token)).length;
        const exact = rowText.includes(normalized(metricLabel)) || rowText.includes(normalized(metricId));
        return { row, score: overlap + (exact ? 10 : 0) };
      })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)[0]?.row;
    if (!ranked) {
      setRunSummary(`No Stats workbench attribute is registered for ${metricLabel || metricId}.`);
      return;
    }
    setStatFamily(ranked.family);
    setSelectedStatId(ranked.id);
    setSelectedStatIds((current) => current.includes(ranked.id) ? current : [...current, ranked.id]);
    setExpandedEvidenceRowId(ranked.id);
    setInlineEvidencePage(0);
    setVisualizationTarget("stats");
    setWorkbenchOpen(true);
    setRunSummary(`${metricLabel || metricId} opened in the Stats workbench.`);
    window.requestAnimationFrame(() => workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <section className="flex h-full flex-col overflow-auto bg-[#151515] p-3 text-[11px] text-slate-200" data-vaa1-statskit-panel="true">
      <div className="order-1 flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-900/50 bg-[#101010] px-3 py-2">
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

      <details open className="order-2 mt-2 rounded border border-slate-800 bg-[#101010]" data-vaa1-statskit-box-collapsible="true">
        <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-slate-200 marker:hidden">Analysis setup</summary>
        <div className="grid gap-2 border-t border-slate-800 p-2 xl:grid-cols-[1fr_190px_150px_150px_120px_150px_90px_90px]">
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
            onChange={(event) => {
              setStatFamily(event.target.value as StatsFamily);
              setWorkbenchOpen(true);
            }}
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
        <button
          type="button"
          className="rounded border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-[10px] font-semibold text-violet-100 hover:bg-violet-500/20 disabled:opacity-40"
          disabled={!activeAnalysisId || interpretationRunning}
          onClick={runStatisticalInterpretation}
          data-vaa1-run-statistical-interpretation="true"
        >
          {interpretationRunning ? "Finding scenes..." : "Find statistical patterns"}
        </button>
        <button type="button" onClick={() => void refreshStatsKitInquiry()} className="rounded border border-slate-700 px-2 py-2 text-[10px] text-slate-300 hover:bg-white/5">Refresh</button>
        <button type="button" onClick={clearStatsKitInquiry} className="rounded border border-slate-700 px-2 py-2 text-[10px] text-slate-300 hover:bg-white/5">Clear</button>
        </div>
      </details>

      {statisticalOverviewVisible && (interpretationResult || analysisData?.nativeStatisticalInterpretation) ? <div className="order-3 mt-2">
        <NativeStatisticalInterpretationStrip
          run={interpretationResult || analysisData?.nativeStatisticalInterpretation}
          panel="statskit"
          onOpenStatistic={openPatternAttributeInWorkbench}
          defaultOpen={false}
        />
      </div> : null}

      <div className="order-4 mt-2">
        {activeAnalysisId && <SceneLanguageSFLView analysisId={activeAnalysisId} perspective="scene" />}
      </div>

      {(isLoading || loadError) && (
        <div className="order-3 mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2 text-[10px] text-slate-300">
          {isLoading ? "Loading source metadata..." : null}
          {loadError ? <span className="text-amber-200">{loadError}</span> : null}
        </div>
      )}

      <details
        ref={comparisonStudioRef}
        open={comparisonStudioOpen}
        onToggle={(event) => setComparisonStudioOpen(event.currentTarget.open)}
        className="order-7 mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2"
        data-vaa1-statskit-cross-video-comparison="true"
        data-vaa1-statskit-local-offline-policy="true"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold text-slate-200">StatsKit comparison studio</div>
          </div>
          <div className="font-mono text-[9px] text-cyan-100">
            {comparisonStatus} / {comparisonCorpus.length} video(s)
          </div>
        </summary>
        <div className="mt-2 flex flex-wrap gap-1" data-vaa1-statskit-comparison-studio-workflow="true">
          {STATS_COMPARISON_WORKFLOW.map((step, index) => (
            <button
              key={step}
              type="button"
              className={`rounded border px-2 py-1 text-[8px] uppercase tracking-[0.1em] ${studioStep === step ? "border-cyan-500/60 bg-cyan-950/30 text-cyan-100" : "border-slate-800 bg-[#090909] text-slate-500 hover:text-slate-200"}`}
              onClick={() => setStudioStep(step)}
            >
              {index + 1}. {step.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <label className="rounded border border-slate-800 bg-[#090909] px-2 py-1.5">
            <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500">Unit of analysis</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-[#050505] px-2 py-1 text-[10px] text-slate-100"
              value={studioUnitOfAnalysis}
              onChange={(event) => setStudioUnitOfAnalysis(event.target.value)}
              data-vaa1-statskit-unit-of-analysis-model="true"
            >
              <option value="video">Video</option>
              <option value="scene">Scene</option>
              <option value="shot">Shot</option>
              <option value="speaker_turn">Speaker turn</option>
              <option value="source_moment">Source moment</option>
            </select>
          </label>
          <label className="rounded border border-slate-800 bg-[#090909] px-2 py-1.5">
            <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500">Variant</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-[#050505] px-2 py-1 text-[10px] text-slate-100"
              value={studioVariantMode}
              onChange={(event) => setStudioVariantMode(event.target.value)}
              data-vaa1-statskit-analysis-variant="true"
            >
              <option value="all_selected">All selected videos</option>
              <option value="computed_only">Computed/candidate numeric rows</option>
              <option value="active_family_only">Active family variables</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/20"
            onClick={exportStudioPackage}
            data-vaa1-statskit-reproducible-package-export="true"
          >
            Export package
          </button>
        </div>
        <div className="mt-2 rounded border border-cyan-900/40 bg-[#090909] px-3 py-2" data-vaa1-statskit-active-studio-step={studioStep}>
          {studioStep === "corpus" ? (
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Define corpus</div>
                <div className="mt-1 text-[10px] text-slate-400">Choose completed local analyses for the comparison corpus. The feature matrix and diagnostics update from this checked set.</div>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center text-[9px]">
                <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">available</div><div className="font-mono text-cyan-100">{availableComparisonVideos.length}</div></div>
                <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">checked</div><div className="font-mono text-cyan-100">{selectedComparisonIds.length}</div></div>
                <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">loaded</div><div className="font-mono text-cyan-100">{comparisonCorpus.length}</div></div>
              </div>
            </div>
          ) : studioStep === "unit" ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Define unit of analysis</div>
              <div className="mt-1 text-[10px] text-slate-400">Current unit is <span className="font-mono text-cyan-100">{studioUnitOfAnalysis}</span>. Video-level comparison is operational now; scene, shot, speaker-turn, and source-moment units are schema-declared and will become fully operational as those interval tables mature.</div>
            </div>
          ) : studioStep === "variables" ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Select variables</div>
              <div className="mt-1 text-[10px] text-slate-400">{studioVariables.length} variable(s) are active. Check rows in the Stats workbench to add variables to the studio matrix.</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {studioVariables.map((variable) => (
                  <span key={variable.id} className="rounded border border-slate-800 bg-[#050505] px-2 py-1 text-[9px] text-slate-300">{variable.statistic}</span>
                ))}
              </div>
            </div>
          ) : studioStep === "matrix" ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Build feature matrix</div>
              <div className="mt-1 text-[10px] text-slate-400">Matrix shape: <span className="font-mono text-cyan-100">{comparisonCorpus.length}</span> observations x <span className="font-mono text-cyan-100">{studioVariables.length}</span> variables. Missing cells stay explicit instead of being silently coerced.</div>
            </div>
          ) : studioStep === "quality" ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Inspect data quality</div>
              <div className="mt-1 text-[10px] text-slate-400">Missingness, row status, and uncertainty are computed from local StatsKit rows and Master Schema-derived source status.</div>
            </div>
          ) : studioStep === "analyses" ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Run analyses</div>
              <div className="mt-1 text-[10px] text-slate-400">Available now: per-video profile table, mean/median comparison, distribution comparison, and selected-feature summary. Association and exploratory multivariate methods are registered as v1 studio methods and wait for richer matrices.</div>
            </div>
          ) : studioStep === "diagnostics" ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Inspect diagnostics</div>
              <div className="mt-1 text-[10px] text-slate-400">Corpus size, comparable row count, selected feature delta, and missingness warnings are active diagnostics for the current studio run.</div>
            </div>
          ) : studioStep === "variants" ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Compare variants</div>
              <div className="mt-1 text-[10px] text-slate-400">Current variant is <span className="font-mono text-cyan-100">{studioVariantMode}</span>. Change the variant selector to rebuild the exported AnalysisRecipe and AnalysisVariant objects.</div>
            </div>
          ) : studioStep === "interpretation" ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Interpret results</div>
              <div className="mt-1 text-[10px] text-slate-400">{comparisonFeatureSummary.delta === null ? "No cross-video delta is interpretable yet." : `Candidate claim: selected feature varies by ${roundStat(comparisonFeatureSummary.delta)} across the local corpus.`}</div>
            </div>
          ) : studioStep === "traceback" ? (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Trace back to source</div>
              <div className="mt-1 text-[10px] text-slate-400">{comparisonFeatureRows.length} provenance edge(s) are available in the export. Source actions use <span className="font-mono text-cyan-100">datascene://analysis/.../statskit</span> anchors.</div>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Export reproducible package</div>
                <div className="mt-1 text-[10px] text-slate-400">The export contains corpus definition, unit model, variable registry, feature matrix, missingness profile, diagnostics, variant specification, interpretation, and provenance graph.</div>
              </div>
              <button
                type="button"
                className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/20"
                onClick={exportStudioPackage}
              >
                Export package
              </button>
            </div>
          )}
        </div>
        <div className={`${["corpus", "unit"].includes(studioStep) ? "grid" : "hidden"} mt-2 gap-2 lg:grid-cols-[0.95fr_1.05fr]`}>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Comparison set</div>
              <div className="text-[9px] text-slate-500">{selectedComparisonIds.length} checked</div>
            </div>
            <div className="mt-2 max-h-40 overflow-auto pr-1">
              {availableComparisonVideos.length ? (
                availableComparisonVideos.map((video) => (
                  <label key={video.id} className="mb-1 flex items-center gap-2 rounded border border-slate-900 bg-[#101010] px-2 py-1 text-[9px] text-slate-300">
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-cyan-400"
                      checked={selectedComparisonSet.has(video.id)}
                      onChange={() => toggleComparisonVideo(video.id)}
                      data-vaa1-statskit-comparison-video-checkbox="true"
                    />
                    <span className="min-w-0 flex-1 truncate" title={video.name}>{video.name}</span>
                    <span className="shrink-0 font-mono text-slate-500">{video.id === activeAnalysisId ? "active" : video.status}</span>
                  </label>
                ))
              ) : (
                <div className="rounded border border-amber-900/50 bg-amber-950/10 px-2 py-1.5 text-[9px] text-amber-100">
                  No completed local analyses are visible yet.
                </div>
              )}
            </div>
            {comparisonError ? <div className="mt-2 text-[9px] text-amber-200">{comparisonError}</div> : null}
            <div className="mt-2 grid gap-1 text-[9px] text-slate-500" data-vaa1-statskit-license-free-policy="true">
              <div><span className="text-slate-400">Mode:</span> {LOCAL_STATS_COMPARISON_POLICY.mode}</div>
              <div><span className="text-slate-400">Data:</span> {LOCAL_STATS_COMPARISON_POLICY.defaultDataLocation}</div>
              <div><span className="text-slate-400">Policy:</span> {LOCAL_STATS_COMPARISON_POLICY.licensePolicy}</div>
              <div><span className="text-slate-400">Standalone:</span> {LOCAL_STATS_COMPARISON_POLICY.offlineStandalone}</div>
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2" data-vaa1-statskit-feature-home-stats="true">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Selected feature home stats</div>
                <div className="mt-1 truncate text-[10px] font-semibold text-slate-100">{selectedStat?.statistic || "Select a StatsKit row"}</div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center text-[9px]">
                <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">n</div><div className="font-mono text-cyan-100">{comparisonFeatureSummary.count}</div></div>
                <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">mean</div><div className="font-mono text-cyan-100">{comparisonFeatureSummary.mean === null ? "n/a" : roundStat(comparisonFeatureSummary.mean)}</div></div>
                <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">min</div><div className="font-mono text-cyan-100">{comparisonFeatureSummary.min === null ? "n/a" : roundStat(comparisonFeatureSummary.min)}</div></div>
                <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">delta</div><div className="font-mono text-cyan-100">{comparisonFeatureSummary.delta === null ? "n/a" : roundStat(comparisonFeatureSummary.delta)}</div></div>
              </div>
            </div>
            <div className="mt-2 overflow-auto rounded border border-slate-800">
              <table className="w-full border-collapse text-left text-[9px]">
                <thead className="bg-[#151515] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="border-b border-slate-800 px-2 py-1.5">Video</th>
                    <th className="border-b border-slate-800 px-2 py-1.5">Value</th>
                    <th className="border-b border-slate-800 px-2 py-1.5">Status</th>
                    <th className="border-b border-slate-800 px-2 py-1.5">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatureRows.length ? comparisonFeatureRows.map((row) => (
                    <tr key={row.analysisId} className="border-b border-slate-950">
                      <td className="max-w-[220px] truncate px-2 py-1.5 font-semibold text-slate-100" title={row.sourceName}>{row.sourceName}</td>
                      <td className="px-2 py-1.5 font-mono text-cyan-100">{row.displayValue}</td>
                      <td className={row.status === "computed" || row.status === "candidate" || row.status === "raw" ? "px-2 py-1.5 text-cyan-200" : "px-2 py-1.5 text-amber-200"}>{row.status}</td>
                      <td className="max-w-[300px] truncate px-2 py-1.5 text-slate-500" title={row.evidence}>{row.evidence}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="px-2 py-1.5 text-slate-500" colSpan={4}>Select a StatsKit row and at least two local analyses to compare this feature.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className={`${studioStep === "interpretation" ? "grid" : "hidden"} mt-2 gap-2 lg:grid-cols-[0.9fr_1.1fr]`} data-vaa1-statskit-interpretation-step-workspace="true">
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Analysis interpretation</div>
            <div className="mt-2 rounded border border-slate-800 bg-[#101010] px-2 py-2 text-[10px] text-slate-300">
              {comparisonFeatureSummary.delta === null ? (
                "No cross-video claim is interpretable yet. Select a numeric feature and at least two comparable videos."
              ) : (
                `Candidate comparison claim: ${selectedStat?.statistic || "selected feature"} varies by ${roundStat(comparisonFeatureSummary.delta)} across ${comparisonFeatureSummary.count} comparable local observations.`
              )}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[9px]">
              <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">n</div><div className="font-mono text-cyan-100">{comparisonFeatureSummary.count}</div></div>
              <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">mean</div><div className="font-mono text-cyan-100">{comparisonFeatureSummary.mean === null ? "n/a" : roundStat(comparisonFeatureSummary.mean)}</div></div>
              <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">min</div><div className="font-mono text-cyan-100">{comparisonFeatureSummary.min === null ? "n/a" : roundStat(comparisonFeatureSummary.min)}</div></div>
              <div className="rounded border border-slate-800 px-2 py-1"><div className="text-slate-500">delta</div><div className="font-mono text-cyan-100">{comparisonFeatureSummary.delta === null ? "n/a" : roundStat(comparisonFeatureSummary.delta)}</div></div>
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Interpretation support</div>
            <div className="mt-2 overflow-auto rounded border border-slate-800">
              <table className="w-full border-collapse text-left text-[9px]">
                <thead className="bg-[#151515] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="border-b border-slate-800 px-2 py-1.5">Observation</th>
                    <th className="border-b border-slate-800 px-2 py-1.5">Value</th>
                    <th className="border-b border-slate-800 px-2 py-1.5">Interpretive status</th>
                    <th className="border-b border-slate-800 px-2 py-1.5">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatureRows.length ? comparisonFeatureRows.map((row) => (
                    <tr key={row.analysisId} className="border-b border-slate-950">
                      <td className="max-w-[220px] truncate px-2 py-1.5 font-semibold text-slate-100" title={row.sourceName}>{row.sourceName}</td>
                      <td className="px-2 py-1.5 font-mono text-cyan-100">{row.displayValue}</td>
                      <td className={row.value === null ? "px-2 py-1.5 text-amber-200" : "px-2 py-1.5 text-cyan-200"}>{row.value === null ? "cannot support claim" : "supports comparison"}</td>
                      <td className="max-w-[320px] truncate px-2 py-1.5 text-slate-500" title={row.evidence}>{row.evidence}</td>
                    </tr>
                  )) : (
                    <tr><td className="px-2 py-1.5 text-slate-500" colSpan={4}>Select a feature to inspect interpretation support.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded border border-violet-900/50 bg-[#090909] px-3 py-2 lg:col-span-2" data-vaa1-stats-motor-report-writer="true">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-200">Stats motor report writer</div>
                <div className="mt-1 text-[9px] text-slate-500">Builds editable prose from checked workbench variables, file indices, framed relationships, corpus comparisons, and source-linked methods.</div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={writeStatsReportDraft} className="rounded border border-violet-700/60 bg-violet-950/20 px-3 py-1.5 text-[9px] font-semibold text-violet-100 hover:bg-violet-900/30">Write draft</button>
                <button type="button" disabled={!statsReportDraft} onClick={downloadStatsReportDraft} className="rounded border border-slate-700 px-3 py-1.5 text-[9px] text-slate-300 disabled:opacity-40">Download .txt</button>
              </div>
            </div>
            <textarea
              value={statsReportDraft}
              onChange={(event) => setStatsReportDraft(event.target.value)}
              placeholder="Select variables or relationships, then write a statistical report draft."
              className="mt-2 min-h-56 w-full resize-y rounded border border-slate-700 bg-[#050505] p-3 font-mono text-[10px] leading-relaxed text-slate-200 placeholder:text-slate-600"
              data-vaa1-stats-report-draft-editor="true"
            />
          </div>
        </div>
        <div className={`${studioStep === "traceback" ? "block" : "hidden"} mt-2 rounded border border-slate-800 bg-[#090909] px-3 py-2`} data-vaa1-statskit-traceback-step-workspace="true">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Traceback graph</div>
              <div className="mt-1 text-[9px] text-slate-500">{comparisonFeatureRows.length} provenance edge(s) for {selectedStat?.statistic || "the selected feature"}</div>
            </div>
            <div className="rounded border border-slate-800 px-2 py-1 font-mono text-[9px] text-cyan-100">{STATS_COMPARISON_SUPPORTED_METHODS.traceback.length} actions</div>
          </div>
          <div className="mt-2 overflow-auto rounded border border-slate-800">
            <table className="w-full border-collapse text-left text-[9px]">
              <thead className="bg-[#151515] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="border-b border-slate-800 px-2 py-1.5">Source action</th>
                  <th className="border-b border-slate-800 px-2 py-1.5">Observation</th>
                  <th className="border-b border-slate-800 px-2 py-1.5">Evidence layer</th>
                  <th className="border-b border-slate-800 px-2 py-1.5">Traceback next action</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatureRows.length ? comparisonFeatureRows.map((row) => {
                  const sourceAction = `datascene://analysis/${row.analysisId}/statskit/${selectedStat?.id || "selected-feature"}`;
                  return (
                    <tr key={row.analysisId} className="border-b border-slate-950">
                      <td className="max-w-[260px] truncate px-2 py-1.5 font-mono text-cyan-100" title={sourceAction}>{sourceAction}</td>
                      <td className="max-w-[220px] truncate px-2 py-1.5 font-semibold text-slate-100" title={row.sourceName}>{row.sourceName}</td>
                      <td className="max-w-[360px] truncate px-2 py-1.5 text-slate-400" title={row.evidence}>{row.evidence}</td>
                      <td className={row.value === null ? "px-2 py-1.5 text-amber-200" : "px-2 py-1.5 text-cyan-200"}>{row.value === null ? "Open required source layer before accepting claim." : "Click-through can inspect the source analysis and evidence layer."}</td>
                    </tr>
                  );
                }) : (
                  <tr><td className="px-2 py-1.5 text-slate-500" colSpan={4}>Select a StatsKit feature to build traceback edges.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className={`${studioStep === "matrix" ? "block" : "hidden"} mt-2 rounded border border-slate-800 bg-[#090909] px-3 py-2`} data-vaa1-statskit-matrix-step-workspace="true">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Feature matrix builder</div>
              <div className="mt-1 text-[9px] text-slate-500">{studioFeatureMatrix.length} observations x {studioVariables.length} variables</div>
            </div>
            <div className="rounded border border-slate-800 px-2 py-1 font-mono text-[9px] text-cyan-100">version local-ui-0.1.0</div>
          </div>
          <div className="mt-2 overflow-auto rounded border border-slate-800">
            <table className="w-full border-collapse text-left text-[9px]">
              <thead className="bg-[#151515] uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="border-b border-slate-800 px-2 py-1.5">Observation</th>
                  {studioVariables.map((variable) => (
                    <th key={variable.id} className="border-b border-slate-800 px-2 py-1.5" title={variable.evidence}>{variable.statistic}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studioFeatureMatrix.length ? studioFeatureMatrix.map((row) => (
                  <tr key={String(row.analysis_id)} className="border-b border-slate-950">
                    <td className="max-w-[260px] truncate px-2 py-1.5 font-semibold text-slate-100">{row.source_name}</td>
                    {studioVariables.map((variable) => (
                      <td key={variable.id} className={row[variable.id] === null ? "px-2 py-1.5 text-amber-200" : "px-2 py-1.5 font-mono text-cyan-100"}>
                        {row[variable.id] ?? "missing"}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr><td className="px-2 py-1.5 text-slate-500" colSpan={Math.max(1, studioVariables.length + 1)}>Select corpus videos and variables to build the matrix.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${studioStep === "quality" ? "grid" : "hidden"} mt-2 gap-2 lg:grid-cols-[1fr_0.75fr]`} data-vaa1-statskit-quality-step-workspace="true">
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Missingness profile</div>
            <div className="mt-2 space-y-2">
              {studioMissingnessProfile.map((row) => (
                <div key={row.variable_id} className="grid grid-cols-[1fr_52px] items-center gap-2">
                  <div>
                    <div className="truncate text-[9px] text-slate-300" title={row.label}>{row.label}</div>
                    <div className="mt-1 h-2 overflow-hidden rounded bg-slate-950">
                      <div className={row.missing_count ? "h-2 rounded bg-amber-400" : "h-2 rounded bg-cyan-400"} style={{ width: `${Math.max(2, row.missing_rate * 100)}%` }} />
                    </div>
                  </div>
                  <div className={row.missing_count ? "text-right font-mono text-[9px] text-amber-200" : "text-right font-mono text-[9px] text-cyan-100"}>
                    {Math.round(row.missing_rate * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Uncertainty model</div>
            <div className="mt-2 space-y-1 text-[9px] text-slate-400">
              {Object.entries(comparisonFeatureRows.reduce<Record<string, number>>((acc, row) => {
                acc[row.status] = (acc[row.status] || 0) + 1;
                return acc;
              }, {})).map(([status, count]) => (
                <div key={status} className="flex justify-between gap-2"><span>{status}</span><span className="font-mono text-cyan-100">{count}</span></div>
              ))}
              <div className="pt-2 text-slate-500">Source row status is propagated into diagnostics and export; no imputation is applied in this version.</div>
            </div>
          </div>
        </div>

        <div className={`${studioStep === "analyses" ? "grid" : "hidden"} mt-2 gap-2 lg:grid-cols-3`} data-vaa1-statskit-analyses-step-workspace="true">
          {Object.entries(STATS_COMPARISON_SUPPORTED_METHODS).filter(([family]) => family !== "traceback").map(([family, methods]) => (
            <div key={family} className="rounded border border-slate-800 bg-[#090909] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">{family.replace(/_/g, " ")}</div>
              <div className="mt-2 space-y-1">
                {methods.map((method) => {
                  const ready = family === "descriptive_comparison" ? comparisonCorpus.length > 1 && studioVariables.length > 0 : studioFeatureMatrix.length > 2 && studioVariables.length > 1;
                  return (
                    <div key={method} className="flex items-center justify-between gap-2 rounded border border-slate-900 bg-[#101010] px-2 py-1 text-[9px]">
                      <span className="text-slate-300">{method}</span>
                      <span className={ready ? "font-mono text-cyan-100" : "font-mono text-amber-200"}>{ready ? "ready" : "needs data"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={`${studioStep === "diagnostics" ? "grid" : "hidden"} mt-2 gap-2 lg:grid-cols-[1fr_1fr]`} data-vaa1-statskit-diagnostics-step-workspace="true">
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Assumption checks</div>
            <div className="mt-2 space-y-1 text-[9px] text-slate-400">
              <div className={comparisonCorpus.length > 1 ? "text-cyan-100" : "text-amber-200"}>Corpus size: {comparisonCorpus.length > 1 ? "sufficient for comparison" : "needs at least two videos"}</div>
              <div className={studioVariables.length ? "text-cyan-100" : "text-amber-200"}>Variables: {studioVariables.length ? `${studioVariables.length} selected` : "none selected"}</div>
              <div className={comparisonFeatureSummary.count > 1 ? "text-cyan-100" : "text-amber-200"}>Numeric selected feature rows: {comparisonFeatureSummary.count}</div>
              <div className={studioMissingnessProfile.some((row) => row.missing_count > 0) ? "text-amber-200" : "text-cyan-100"}>
                Missingness: {studioMissingnessProfile.some((row) => row.missing_count > 0) ? "present" : "none visible"}
              </div>
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Quality flags</div>
            <div className="mt-2 space-y-1 text-[9px] text-slate-400">
              {(studioPackage.StatsComparisonStudio.core_objects.AnalysisDiagnostics as { quality_flags?: string[] }).quality_flags?.length ? (
                (studioPackage.StatsComparisonStudio.core_objects.AnalysisDiagnostics as { quality_flags?: string[] }).quality_flags?.map((flag) => (
                  <div key={flag} className="rounded border border-amber-900/40 bg-amber-950/10 px-2 py-1 text-amber-100">{flag}</div>
                ))
              ) : (
                <div className="rounded border border-cyan-900/40 bg-cyan-950/10 px-2 py-1 text-cyan-100">No active quality flags for the selected comparison.</div>
              )}
            </div>
          </div>
        </div>

        <div className={`${studioStep === "variants" ? "block" : "hidden"} mt-2 rounded border border-slate-800 bg-[#090909] px-3 py-2`} data-vaa1-statskit-variants-step-workspace="true">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Variant comparison</div>
          <div className="mt-2 overflow-auto rounded border border-slate-800">
            <table className="w-full border-collapse text-left text-[9px]">
              <thead className="bg-[#151515] uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="border-b border-slate-800 px-2 py-1.5">Variant</th>
                  <th className="border-b border-slate-800 px-2 py-1.5">Corpus</th>
                  <th className="border-b border-slate-800 px-2 py-1.5">Variables</th>
                  <th className="border-b border-slate-800 px-2 py-1.5">Comparable rows</th>
                  <th className="border-b border-slate-800 px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: "all_selected", corpus: comparisonCorpus.length, variables: studioVariables.length, comparable: comparisonFeatureSummary.count },
                  { id: "computed_only", corpus: comparisonCorpus.length, variables: studioVariables.filter((row) => ["computed", "candidate", "raw"].includes(row.status)).length, comparable: comparisonFeatureRows.filter((row) => ["computed", "candidate", "raw"].includes(row.status)).length },
                  { id: "active_family_only", corpus: comparisonCorpus.length, variables: visibleStatsRows.filter((row) => ["computed", "candidate", "raw"].includes(row.status)).length, comparable: comparisonFeatureSummary.count },
                ].map((variant) => (
                  <tr key={variant.id} className={studioVariantMode === variant.id ? "border-b border-slate-950 bg-cyan-950/20" : "border-b border-slate-950"}>
                    <td className="px-2 py-1.5 font-semibold text-slate-100">{variant.id}</td>
                    <td className="px-2 py-1.5 font-mono text-cyan-100">{variant.corpus}</td>
                    <td className="px-2 py-1.5 font-mono text-cyan-100">{variant.variables}</td>
                    <td className="px-2 py-1.5 font-mono text-cyan-100">{variant.comparable}</td>
                    <td className={variant.corpus > 1 && variant.variables ? "px-2 py-1.5 text-cyan-200" : "px-2 py-1.5 text-amber-200"}>{variant.corpus > 1 && variant.variables ? "ready" : "needs inputs"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${["variables", "export"].includes(studioStep) ? "grid" : "hidden"} mt-2 gap-2 lg:grid-cols-3`} data-vaa1-statskit-comparison-studio-core-objects="true">
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2" data-vaa1-statskit-variable-registry="true">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Variable registry</div>
            <div className="mt-1 text-[9px] text-slate-500">{studioVariables.length} variable(s) from checked StatsKit rows</div>
            <div className="mt-2 max-h-32 overflow-auto">
              {buildVariableRegistry(studioVariables).map((variable) => (
                <div key={variable.variable_id} className="mb-1 rounded border border-slate-900 bg-[#101010] px-2 py-1">
                  <div className="truncate text-[9px] font-semibold text-slate-100" title={variable.label}>{variable.label}</div>
                  <div className="mt-0.5 text-[8px] text-slate-500">{variable.measurement_level} / {variable.unit} / {variable.comparability}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2" data-vaa1-statskit-feature-matrix="true">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Feature matrix</div>
            <div className="mt-1 text-[9px] text-slate-500">
              {comparisonCorpus.length} row(s) x {studioVariables.length} variable(s)
            </div>
            <div className="mt-2 overflow-auto rounded border border-slate-800">
              <table className="w-full border-collapse text-left text-[8px]">
                <thead className="bg-[#151515] uppercase tracking-[0.1em] text-slate-500">
                  <tr>
                    <th className="border-b border-slate-800 px-2 py-1">Video</th>
                    {studioVariables.slice(0, 4).map((variable) => (
                      <th key={variable.id} className="border-b border-slate-800 px-2 py-1">{variable.statistic}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildFeatureMatrix(comparisonCorpus, studioVariables).slice(0, 6).map((row) => (
                    <tr key={String(row.analysis_id)} className="border-b border-slate-950">
                      <td className="max-w-[120px] truncate px-2 py-1 text-slate-300">{row.source_name}</td>
                      {studioVariables.slice(0, 4).map((variable) => (
                        <td key={variable.id} className="px-2 py-1 font-mono text-cyan-100">{row[variable.id] ?? "missing"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2" data-vaa1-statskit-missingness-profile="true">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Data quality</div>
            <div className="mt-1 text-[9px] text-slate-500">Missingness and uncertainty from local row status.</div>
            <div className="mt-2 space-y-1">
              {buildMissingnessProfile(buildFeatureMatrix(comparisonCorpus, studioVariables), studioVariables).slice(0, 5).map((row) => (
                <div key={row.variable_id} className="grid grid-cols-[1fr_48px] gap-2 text-[9px]">
                  <span className="truncate text-slate-400" title={row.label}>{row.label}</span>
                  <span className={row.missing_count ? "text-right font-mono text-amber-200" : "text-right font-mono text-cyan-100"}>
                    {Math.round(row.missing_rate * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2" data-vaa1-statskit-analysis-recipe="true">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Run analyses</div>
            <div className="mt-2 grid gap-1 text-[9px] text-slate-400">
              <div>Descriptive: {STATS_COMPARISON_SUPPORTED_METHODS.descriptive_comparison.length} methods</div>
              <div>Association: {STATS_COMPARISON_SUPPORTED_METHODS.association.length} methods</div>
              <div>Exploratory: {STATS_COMPARISON_SUPPORTED_METHODS.exploratory_multivariate.length} methods</div>
              <div className={comparisonCorpus.length > 1 ? "text-cyan-100" : "text-amber-200"}>
                AnalysisRun: {comparisonCorpus.length > 1 && studioVariables.length ? "ready" : "needs inputs"}
              </div>
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2" data-vaa1-statskit-analysis-diagnostics="true">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Diagnostics</div>
            <div className="mt-2 space-y-1 text-[9px] text-slate-400">
              <div>Corpus size: <span className="font-mono text-cyan-100">{comparisonCorpus.length}</span></div>
              <div>Comparable selected rows: <span className="font-mono text-cyan-100">{comparisonFeatureSummary.count}</span></div>
              <div>Selected feature delta: <span className="font-mono text-cyan-100">{comparisonFeatureSummary.delta === null ? "n/a" : roundStat(comparisonFeatureSummary.delta)}</span></div>
              <div className={comparisonFeatureSummary.count > 1 ? "text-cyan-100" : "text-amber-200"}>
                {comparisonFeatureSummary.count > 1 ? "Candidate interpretation available" : "More comparable rows needed"}
              </div>
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-[#090909] px-3 py-2" data-vaa1-statskit-provenance-graph="true">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Traceback / export</div>
            <div className="mt-2 space-y-1 text-[9px] text-slate-400">
              <div>Traceback actions: {STATS_COMPARISON_SUPPORTED_METHODS.traceback.length}</div>
              <div>Provenance edges: {comparisonFeatureRows.length}</div>
              <div>Package schema: {studioPackage.StatsComparisonStudio.schema_version}</div>
              <div className="text-slate-500">Cells and chart points retain `datascene://analysis/.../statskit` source actions in the export.</div>
            </div>
          </div>
        </div>
      </details>

      <div className="order-4 mt-2 grid gap-2" data-vaa1-statskit-ordered-workbench-layout="true" data-vaa1-statskit-layout-priority="workbench-visualization-support">
        <details
          ref={workbenchRef}
          open={workbenchOpen}
          onToggle={(event) => setWorkbenchOpen(event.currentTarget.open)}
          className="order-1 overflow-hidden rounded border border-slate-800 bg-[#101010]"
          data-vaa1-statskit-source-signals="true"
          data-vaa1-statskit-workbench-collapsible="true"
          data-vaa1-statskit-box-collapsible="true"
          data-vaa1-statskit-layout-slot="A"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-200">Stats workbench table</div>
            </div>
            <div className="text-right text-[9px] uppercase tracking-[0.12em] text-slate-500">
              <div>{visibleStatsRows.length} rows</div>
              <div>{selectedStatIds.length || (selectedStat ? 1 : 0)} selected</div>
            </div>
          </summary>
          {statFamily === "correlation" ? (
            <div className="border-b border-violet-900/40 bg-violet-950/10 px-3 py-2" data-vaa1-statistical-relationship-explorer="true">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-200">Computed relationship explorer</div>
                  <div className="mt-0.5 text-[9px] text-slate-500">Measured scene relationships with direct source navigation.</div>
                </div>
                <div className="font-mono text-[9px] text-violet-200">{relationshipExplorerRows.length} computed</div>
              </div>
              <div className="mt-2 grid gap-2">
                {relationshipExplorerRows.map(({ relationship, row }) => (
                  <div key={relationship.relationship_id} className="rounded border border-violet-900/50 bg-[#090909] px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100">{relationship.left_metric?.replaceAll("_", " ")} ↔ {relationship.right_metric?.replaceAll("_", " ")}</div>
                        <div className="mt-1 text-[10px] leading-relaxed text-slate-300">{row?.note}</div>
                      </div>
                      <div className="shrink-0 rounded border border-violet-800/60 px-2 py-1 font-mono text-violet-100">ρ {Number(relationship.coefficient || 0).toFixed(3)} · n={relationship.scene_count || 0}</div>
                    </div>
                    <details className="mt-2 rounded border border-slate-800 bg-[#101010] px-2 py-1" data-vaa1-relationship-analytical-lenses="true">
                      <summary className="cursor-pointer text-[9px] font-semibold text-slate-400">Analytical lenses and evidence classification</summary>
                      <div className="mt-2 grid gap-1 text-[9px] text-slate-400">
                        <div><span className="text-cyan-200">Computed scale:</span> meso—one association estimated across scenes; micro rows provide its paired evidence.</div>
                        <div><span className="text-emerald-200">Available reading lenses:</span> {(relationship.analytical_frames?.orientation || []).join(" and ") || "not assigned"}. These are analyst perspectives, not outputs of the correlation equation.</div>
                        <div><span className="text-sky-200">Evidence modes:</span> {(relationship.analytical_frames?.evidence_expression || []).join(" and ") || "not assigned"}. These classify the measured source layers; they are not separate coefficients.</div>
                        <div><span className="text-violet-200">Relationship status:</span> inferred from paired measurements.</div>
                      </div>
                    </details>
                    <div className="mt-2 overflow-auto rounded border border-slate-800" data-vaa1-statistical-relationship-paired-workbench="true">
                      <table className="w-full border-collapse text-left text-[9px]">
                        <thead className="bg-[#151515] uppercase tracking-[0.1em] text-slate-500">
                          <tr>
                            <th className="border-b border-slate-800 px-2 py-1">Scene</th>
                            <th className="border-b border-slate-800 px-2 py-1">{relationship.left_metric?.replaceAll("_", " ")}</th>
                            <th className="border-b border-slate-800 px-2 py-1">{relationship.right_metric?.replaceAll("_", " ")}</th>
                            <th className="border-b border-slate-800 px-2 py-1">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(relationship.paired_observations || []).map((pair, index) => (
                            <tr key={`${relationship.relationship_id}:pair:${pair.scene_ref || index}`} className="border-b border-slate-900">
                              <td className="px-2 py-1 text-slate-300">{pair.scene_ref || `Scene ${index + 1}`}</td>
                              <td className="px-2 py-1 font-mono text-cyan-100">{Number(pair.left_value || 0).toFixed(4)}</td>
                              <td className="px-2 py-1 font-mono text-violet-100">{Number(pair.right_value || 0).toFixed(4)}</td>
                              <td className="px-2 py-1">
                                <button type="button" onClick={() => eventBus.emit("videoTimeLineChanged", Number(pair.start_seconds || 0))} className="rounded border border-slate-700 px-2 py-0.5 font-mono text-cyan-100 hover:border-cyan-600">{Number(pair.start_seconds || 0).toFixed(1)}s</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[9px] text-slate-500">Contributing scenes:</span>
                      {(relationship.source_intervals || []).map((interval, index) => (
                        <button
                          key={`${relationship.relationship_id}:source:${index}`}
                          type="button"
                          onClick={() => eventBus.emit("videoTimeLineChanged", Number(interval.start_seconds || 0))}
                          className="rounded border border-slate-700 bg-[#101010] px-2 py-1 font-mono text-[9px] text-cyan-100 hover:border-cyan-600"
                          title={`Open ${Number(interval.start_seconds || 0).toFixed(3)}–${Number(interval.end_seconds || 0).toFixed(3)} seconds`}
                        >
                          Scene {index + 1} · {Number(interval.start_seconds || 0).toFixed(1)}s
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (!row) return;
                          setSelectedStatId(row.id);
                          setSelectedStatIds((current) => current.includes(row.id) ? current : [...current, row.id]);
                          setExpandedEvidenceRowId(row.id);
                          setInlineEvidencePage(0);
                        }}
                        className="rounded border border-violet-700/60 bg-violet-950/30 px-2 py-1 text-[9px] font-semibold text-violet-100"
                      >
                        Select for analysis
                      </button>
                    </div>
                  </div>
                ))}
                {(activeNativeRun?.relationship_diagnostics || []).filter((diagnostic) => diagnostic.status === "constant_pattern").map((diagnostic) => (
                  <div key={`${diagnostic.left_metric}:${diagnostic.right_metric}`} className="rounded border border-amber-900/40 bg-amber-950/10 px-3 py-2" data-vaa1-statistical-relationship-unavailable="true">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-slate-300">{diagnostic.left_metric?.replaceAll("_", " ")} ↔ {diagnostic.right_metric?.replaceAll("_", " ")}</div>
                      <div className="text-[8px] uppercase tracking-[0.12em] text-amber-200">{diagnostic.status === "constant_pattern" ? "constant pattern" : "insufficient data"}</div>
                    </div>
                    <div className="mt-1 text-[9px] text-amber-100/80">
                      {diagnostic.status === "constant_pattern"
                        ? `${diagnostic.left_unique_value_count === 1 ? `${diagnostic.left_metric?.replaceAll("_", " ")} stays at ${diagnostic.left_constant_value} in every scene. ` : ""}${diagnostic.right_unique_value_count === 1 ? `${diagnostic.right_metric?.replaceAll("_", " ")} stays at ${diagnostic.right_constant_value} in every scene. ` : ""}The stable pattern is computed; a rank coefficient is undefined because correlation requires variation.`
                        : diagnostic.reason} · {diagnostic.paired_scene_count || 0} paired scene(s)
                    </div>
                  </div>
                ))}
                {!relationshipExplorerRows.length ? <div className="text-[9px] text-amber-200">No computed cross-signal relationships are loaded for this analysis.</div> : null}
              </div>
            </div>
          ) : null}
          <div className="border-b border-slate-800 px-3 py-2" data-vaa1-statskit-column-controls="true">
            {statFamily === "taxonomy" ? (
              <div className="mb-3 grid gap-2 rounded border border-slate-800 bg-[#0b0b0b] p-2">
                <div className="grid gap-2 md:grid-cols-3">
                  <label className="grid gap-1 text-[9px] text-slate-400" data-vaa1-statskit-taxonomy-theme-filter="true">
                    <span>Category</span>
                    <select
                      value={taxonomyTheme}
                      onChange={(event) => {
                        setTaxonomyTheme(event.target.value);
                        setTaxonomySubcategory("all");
                      }}
                      className="rounded border border-slate-700 bg-[#090909] px-2 py-1.5 text-[10px] text-slate-200"
                    >
                      {[
                        "all",
                        "analytics",
                        "audio",
                        "external and delivery",
                        "governance",
                        "language",
                        "method and architecture",
                        "narrative",
                        "research",
                        "scene",
                        "source",
                        "visual",
                      ].map((theme) => (
                        <option key={theme} value={theme}>{theme === "all" ? "All categories" : theme.charAt(0).toUpperCase() + theme.slice(1)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[9px] text-slate-400" data-vaa1-statskit-taxonomy-subcategory-filter="true">
                    <span>Subcategory</span>
                    <select
                      value={taxonomySubcategory}
                      onChange={(event) => setTaxonomySubcategory(event.target.value)}
                      className="rounded border border-slate-700 bg-[#090909] px-2 py-1.5 text-[10px] text-slate-200"
                    >
                      <option value="all">All subcategories</option>
                      {taxonomySubcategories.map((subcategory) => (
                        <option key={subcategory} value={subcategory}>{subcategory}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[9px] text-slate-400" data-vaa1-statskit-taxonomy-search="true">
                    <span>Find entry</span>
                    <input
                      type="search"
                      value={taxonomySearch}
                      onChange={(event) => setTaxonomySearch(event.target.value)}
                      placeholder="shot, color, transcript…"
                      className="rounded border border-slate-700 bg-[#090909] px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600"
                    />
                  </label>
                </div>
                <div className="grid gap-2 border-t border-slate-800 pt-2 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)_auto]" data-vaa1-statskit-governed-source-layer-navigator="true">
                  <label className="grid gap-1 text-[9px] text-slate-400">
                    <span>Governed measured source layer</span>
                    <select
                      value={selectedReadinessLayer?.id || ""}
                      onChange={(event) => setSelectedReadinessLayerId(event.target.value)}
                      className="rounded border border-cyan-900/70 bg-[#090909] px-2 py-1.5 text-[10px] text-cyan-100"
                    >
                      {sourceLayerDeliverables.map((row) => (
                        <option key={row.id} value={row.id}>{row.layer}</option>
                      ))}
                    </select>
                  </label>
                  {selectedReadinessLayer ? (
                    <div className="grid content-center gap-1 text-[9px] text-slate-400">
                      <div>
                        <span className={selectedReadinessLayer.status === "available" ? "text-cyan-200" : selectedReadinessLayer.status === "partial_proxy" ? "text-sky-200" : "text-amber-200"}>
                          {selectedReadinessLayer.status.replace(/_/g, " ")}
                        </span>
                        <span className="ml-2 font-mono text-slate-300">{selectedReadinessLayer.availableRows} rows</span>
                      </div>
                      <div>{selectedReadinessLayer.currentSource}</div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={!selectedReadinessLayer}
                    className="self-end rounded border border-cyan-800/60 bg-cyan-950/20 px-3 py-1.5 text-[9px] font-semibold text-cyan-100 hover:bg-cyan-900/30 disabled:opacity-40"
                    onClick={() => {
                      if (!selectedReadinessLayer) return;
                      const isShot = selectedReadinessLayer.id === "true-shot-boundary-intervals";
                      const isTone = selectedReadinessLayer.id === "color-brightness-contrast";
                      const targetFamily: StatsFamily = isShot ? "distribution" : isTone ? "visual" : "descriptive";
                      const targetRow = operationalStatsRows.find((row) =>
                        row.family === targetFamily &&
                        (
                          (isShot && row.statistic === "shot length distribution") ||
                          (isTone && row.statistic.includes("mean brightness"))
                        ),
                      );
                      setStatFamily(targetFamily);
                      if (targetRow) {
                        setSelectedStatId(targetRow.id);
                        setExpandedEvidenceRowId(targetRow.id);
                        setInlineEvidencePage(0);
                      }
                    }}
                    data-vaa1-statskit-open-measured-statistics="true"
                  >
                    Open measured statistics
                  </button>
                </div>
              </div>
            ) : null}
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
              className="table-fixed border-collapse text-left text-[11px]"
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
                  <React.Fragment key={row.id}>
                  <tr
                    className={`cursor-pointer border-b border-slate-900 hover:bg-cyan-950/10 ${selectedStat?.id === row.id ? "bg-cyan-950/20 outline outline-1 outline-cyan-800/60" : ""}`}
                    onClick={() => {
                      setSelectedStatId(row.id);
                      setExpandedEvidenceRowId((current) => {
                        const next = current === row.id ? "" : row.id;
                        if (next) setInlineEvidencePage(0);
                        return next;
                      });
                    }}
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
                  {expandedEvidenceRowId === row.id ? (
                    <tr data-vaa1-statskit-inline-evidence="true">
                      <td colSpan={9} className="border-b border-slate-800 bg-[#0c0c0c] px-4 py-3">
                        <div className="grid gap-2 text-[10px] text-slate-400">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold text-slate-200">Evidence inspection</div>
                            <div className="flex items-center gap-2">
                              <div className="text-[9px] text-slate-500">{inlineEvidenceRecords.length} linked record(s)</div>
                              <button
                                type="button"
                                className="rounded border border-slate-700 px-2 py-0.5 text-[9px] text-slate-400 hover:text-slate-200"
                                onClick={() => setExpandedEvidenceRowId("")}
                                data-vaa1-statskit-close-inline-evidence="true"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                          <div><span className="text-slate-500">Evidence layer:</span> {row.evidence}</div>
                          <div><span className="text-slate-500">Required layer:</span> {row.requiredLayer}</div>
                          <div><span className="text-slate-500">{row.family === "correlation" ? "Likely statistical indication:" : "Data note:"}</span> {row.note}</div>
                          {row.family === "comparative" ? (
                            <button
                              type="button"
                              className="w-fit rounded border border-cyan-800/60 bg-cyan-950/20 px-3 py-1 text-[9px] font-semibold text-cyan-100 hover:bg-cyan-900/30"
                              onClick={() => {
                                setComparisonStudioOpen(true);
                                setStudioStep("corpus");
                                window.requestAnimationFrame(() => comparisonStudioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                              }}
                              data-vaa1-open-comparison-studio-from-aggregate="true"
                            >
                              Open this attribute in Comparison Studio
                            </button>
                          ) : null}
                          {inlineEvidenceRecords.length ? (
                            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                              {visibleInlineEvidenceRecords.map((record) => {
                                const sourceStart = typeof record.start === "number" && Number.isFinite(record.start) ? record.start : null;
                                const timed = sourceStart !== null;
                                return (
                                  <button
                                    key={record.id}
                                    type="button"
                                    disabled={!timed}
                                    onClick={() => sourceStart !== null && eventBus.emit("videoTimeLineChanged", sourceStart)}
                                    className="rounded border border-slate-800 bg-[#111111] px-2 py-1.5 text-left text-[9px] text-slate-300 enabled:hover:border-slate-600 disabled:cursor-default"
                                    title={timed ? "Seek the existing video to this source time" : "Untimed source record"}
                                  >
                                    <div className="line-clamp-2">{record.label}</div>
                                    <div className="mt-1 font-mono text-slate-500">
                                      {sourceStart !== null ? `${sourceStart.toFixed(3)}s${typeof record.end === "number" ? `–${record.end.toFixed(3)}s` : ""}` : "untimed"} · {record.authority} · {record.source}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-slate-500">No record-level anchors are loaded for this row. The evidence contract remains visible without leaving StatsKit.</div>
                          )}
                          {inlineEvidenceRecords.length > INLINE_EVIDENCE_PAGE_SIZE ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-900 pt-2" data-vaa1-statskit-inline-evidence-pagination="true">
                              <div className="text-[9px] text-slate-500">
                                {inlineEvidencePageStart + 1}–{Math.min(inlineEvidencePageStart + INLINE_EVIDENCE_PAGE_SIZE, inlineEvidenceRecords.length)} of {inlineEvidenceRecords.length} linked records
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={safeInlineEvidencePage === 0}
                                  onClick={() => setInlineEvidencePage((page) => Math.max(0, page - 1))}
                                  className="rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-400 enabled:hover:text-slate-200 disabled:opacity-40"
                                >
                                  Previous
                                </button>
                                <span className="px-1 font-mono text-[9px] text-slate-500">{safeInlineEvidencePage + 1} / {inlineEvidencePageCount}</span>
                                <button
                                  type="button"
                                  disabled={safeInlineEvidencePage >= inlineEvidencePageCount - 1}
                                  onClick={() => setInlineEvidencePage((page) => Math.min(inlineEvidencePageCount - 1, page + 1))}
                                  className="rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-400 enabled:hover:text-slate-200 disabled:opacity-40"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="order-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-statskit-visualization="true" data-vaa1-statskit-box-collapsible="true" data-vaa1-statskit-layout-slot="B">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-200">Visualization</div>
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
                <option value="comparison">Comparison studio</option>
              </select>
            </label>
            <label className="grid gap-1 text-[9px] uppercase tracking-[0.12em] text-slate-500" data-vaa1-visualization-mode-selector="true">
              Chart type
              <select
                className="rounded border border-slate-700 bg-[#090909] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                value={visualization}
                onChange={(event) => setVisualization(event.target.value as VisualizationMode)}
              >
                {VISUALIZATION_MODE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 rounded border border-slate-800 bg-[#090909] px-2 py-1.5 text-[9px] text-slate-400">
            {plottedData.length} numeric row(s) available for {visualization.replace(/_/g, " ")}.
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
                  <div><span className="text-slate-500">Inspection:</span> available directly beneath the selected workbench row</div>
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

        <details className="order-3 overflow-hidden rounded border border-slate-800 bg-[#101010]" data-vaa1-relevance-scanner="true" data-vaa1-statskit-box-collapsible="true" data-vaa1-relevance-scanner-default-collapsed="true" data-vaa1-statskit-layout-slot="C">
          <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-800 px-3 py-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-200">Relevance scanner</div>
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

      <details className="order-8 mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-stats-metadata-view="true" data-vaa1-statskit-box-collapsible="true" data-vaa1-statskit-layout-slot="F">
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-200">
          Stats metadata view
          <span className="sr-only">schema coverage, audits, source-layer plan, and JSON contracts</span>
        </summary>
        {filePatternIndex ? (
          <div className="mt-2 grid gap-2 rounded border border-cyan-900/50 bg-[#090909] px-3 py-2 md:grid-cols-[auto_1fr]" data-vaa1-file-statistical-pattern-index="true">
            <div className="min-w-24 rounded border border-cyan-900/60 bg-cyan-950/20 px-3 py-2 text-center">
              <div className="text-[8px] uppercase tracking-[0.14em] text-slate-500">Pattern index</div>
              <div className="mt-1 font-mono text-xl text-cyan-100">{Number(filePatternIndex.value || 0).toFixed(3)}</div>
              <div className="text-[8px] text-slate-500">0–1</div>
            </div>
            <div className="grid content-center gap-1 text-[9px] text-slate-400">
              <div><span className="text-slate-500">File metadata field:</span> <span className="font-mono text-cyan-100">statistical_pattern_index</span></div>
              <div>{Number(filePatternIndex.attribute_count || 0)} workbench attributes across {Number(filePatternIndex.signal_family_count || 0)} signal families</div>
              <div><span className="text-slate-500">Families:</span> {Array.isArray(filePatternIndex.signal_families) ? filePatternIndex.signal_families.join(", ") : "unavailable"}</div>
              <div><span className="text-slate-500">Method:</span> mean of capped absolute robust-z components</div>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-[9px] text-slate-500">Run Find statistical patterns to add the comparison index to this file's metadata.</div>
        )}

      <details className="mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-statskit-master-schema-category-audit="true" data-vaa1-statskit-box-collapsible="true">
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-200">
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
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-200">
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
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-200">
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
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-200">
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
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-200">
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
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-200">
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

      <details className="order-6 mt-2 rounded border border-slate-800 bg-[#101010] px-3 py-2" data-vaa1-significancekit-claims="true" data-vaa1-statskit-significance-relevance-surface="true" data-vaa1-statskit-box-collapsible="true" data-vaa1-statskit-layout-slot="D">
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-200">
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
