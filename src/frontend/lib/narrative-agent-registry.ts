import type { ManualVisualAnnotation } from "./api-service";
import type { AnalysisData, MasterSchemaResolvedEvidenceRecord } from "./video-service";

const addLabel = (labels: Set<string>, value: unknown): void => {
  const label = String(value || "").trim();
  const normalized = label.toLowerCase().replace(/_/g, " ");
  if (!label || ["unknown", "unknown speaker", "person", "object", "track"].includes(normalized)) return;
  if (normalized.startsWith("person track") || normalized.startsWith("track ") || /^person\s*\d+$/.test(normalized)) return;
  labels.add(label);
};

const addValues = (labels: Set<string>, value: unknown): void => {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => addValues(labels, entry));
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    addLabel(labels, record.narrative_agent_name || record.character_name || record.character || record.name || record.label);
    addValues(labels, record.aliases);
    return;
  }
  addLabel(labels, value);
};

/** One analysis-scoped governed Narrative Agent list for every authoring surface. */
export function governedNarrativeAgentLabels(analysisData?: AnalysisData | null): string[] {
  const labels = new Set<string>();
  (analysisData?.masterSchemaResolvedEvidence?.records || []).forEach((record: MasterSchemaResolvedEvidenceRecord) => {
    if (["narrative_agent_profile", "character_role", "identity"].includes(record.category) && record.authority !== "raw_detection") {
      addLabel(labels, record.label);
    }
  });
  const annotations = analysisData?.metadata?.sourceMediaMetadata?.user_annotations;
  addValues(labels, annotations?.narrative_agent_profiles);
  addValues(labels, annotations?.character_definitions);
  addValues(labels, annotations?.character_roles);
  (annotations?.web_metadata_sources || []).forEach((source) => {
    addValues(labels, source.fields?.character_roles);
    addValues(labels, source.fields?.persons);
  });
  (analysisData?.annotationCorrections?.manual_visual_annotations || []).forEach((entry: ManualVisualAnnotation) => {
    addLabel(labels, entry.identity_affirmation);
    if (entry.category === "Identification") {
      addLabel(labels, entry.custom_label);
      addLabel(labels, entry.label);
    }
  });
  (analysisData?.entityRegistry?.entities || []).forEach((entity) => {
    if (["NARRATIVE_AGENT", "AUDIOVISUAL_NARRATIVE_AGENT"].includes(entity.entity_type)) {
      addLabel(labels, entity.canonical_name);
    }
  });
  return [...labels].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}
