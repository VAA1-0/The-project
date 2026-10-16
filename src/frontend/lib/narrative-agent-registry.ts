import type { ManualVisualAnnotation } from "./api-service";
import type { AnalysisData, MasterSchemaResolvedEvidenceRecord } from "./video-service";

const NON_AGENT_AUDIO_SOURCES = new Set([
  "announcer",
  "background noise",
  "crowd",
  "voice-over narration",
]);

const NON_AGENT_IDENTITY_LABELS = new Set([
  "agent",
  "antagonist",
  "character",
  "character present",
  "chaser",
  "door",
  "foe",
  "friend",
  "guard",
  "microphone",
  "narrative agent",
  "news anchor",
  "police officer",
  "protagonist",
  "speaker",
  "villain",
]);

/**
 * Keep chooser values identity-shaped. Relationship descriptions, scene casts,
 * track labels, and prose belong to evidence attributes—not to the canonical
 * Narrative Agent menu. The open authoring field remains free text, so this
 * guard only governs suggestions assembled from stored analysis data.
 */
export const individualNarrativeAgentLabel = (value: unknown): string => {
  let label = String(value || "").replace(/\s+/g, " ").trim();
  if (!label) return "";

  // Preserve the identity portion of profile-style labels such as
  // "James Bond (Daniel Craig): protagonist, secret agent".
  if (label.includes(":")) label = label.split(":", 1)[0].trim();
  label = label.replace(/\s+\([^)]*\)\s*$/, "").trim();

  const normalized = label.toLowerCase().replace(/_/g, " ");
  if (
    !label ||
    label.length > 100 ||
    ["unknown", "unknown speaker", "person", "object", "track"].includes(normalized) ||
    NON_AGENT_IDENTITY_LABELS.has(normalized) ||
    /(?:,|\s+(?:and|with|versus|vs\.?)\s+)/i.test(label) ||
    /^(?:directed|music|produced)\s+by\b/i.test(label) ||
    /^man\s+in\b/i.test(label) ||
    /\b(?:person\s+)?track\s*\d+\b/i.test(label) ||
    /^person\s*\d+$/i.test(label)
  ) return "";

  return label;
};

const addLabel = (labels: Set<string>, value: unknown): void => {
  const label = individualNarrativeAgentLabel(value);
  if (!label) return;
  if ([...labels].some((existing) => existing.localeCompare(label, undefined, { sensitivity: "base" }) === 0)) return;
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

const addRoleValues = (labels: Set<string>, value: unknown): void => {
  if (Array.isArray(value)) {
    value.forEach((entry) => addRoleValues(labels, entry));
    return;
  }
  if (typeof value === "string") {
    value
      .split(/[,;\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => addLabel(labels, entry));
    return;
  }
  addValues(labels, value);
};

/** One analysis-scoped governed Narrative Agent list for every authoring surface. */
export function governedNarrativeAgentLabels(analysisData?: AnalysisData | null): string[] {
  const labels = new Set<string>();
  const annotations = analysisData?.metadata?.sourceMediaMetadata?.user_annotations;
  const knownPersons = Array.isArray(annotations?.persons)
    ? annotations.persons.filter((value) => String(value || "").trim())
    : [];
  (analysisData?.masterSchemaResolvedEvidence?.records || []).forEach((record: MasterSchemaResolvedEvidenceRecord) => {
    if (["narrative_agent_profile", "identity"].includes(record.category) && record.authority !== "raw_detection") {
      addLabel(labels, record.label);
    } else if (record.category === "character_role" && knownPersons.length === 0 && record.authority !== "raw_detection") {
      addRoleValues(labels, record.label);
    }
  });
  addValues(labels, annotations?.narrative_agent_profiles);
  addValues(labels, annotations?.character_definitions);
  if (knownPersons.length > 0) {
    addValues(labels, knownPersons);
  } else {
    addRoleValues(labels, annotations?.character_roles);
  }
  (annotations?.web_metadata_sources || []).forEach((source) => {
    addValues(labels, source.fields?.character_roles);
    addValues(labels, source.fields?.persons);
  });
  (analysisData?.annotationCorrections?.manual_visual_annotations || []).forEach((entry: ManualVisualAnnotation) => {
    if (["Identification", "Role", "OBJ", "Audio"].includes(entry.category)) {
      addLabel(labels, entry.identity_affirmation);
    }
    if (entry.category === "Identification") {
      addLabel(labels, entry.custom_label);
      addLabel(labels, entry.label);
    }
  });
  [
    ...(analysisData?.transcript || []),
    ...(analysisData?.transcriptTimeline || []),
  ].forEach((row) => {
    const confirmedSpeaker = String(row?.speakerConfirmation || "").trim();
    if (confirmedSpeaker && !NON_AGENT_AUDIO_SOURCES.has(confirmedSpeaker.toLowerCase())) {
      addLabel(labels, confirmedSpeaker);
    }
  });
  (analysisData?.entityRegistry?.entities || []).forEach((entity) => {
    if (["NARRATIVE_AGENT", "AUDIOVISUAL_NARRATIVE_AGENT"].includes(entity.entity_type)) {
      addLabel(labels, entity.canonical_name);
    }
  });
  return [...labels].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}
