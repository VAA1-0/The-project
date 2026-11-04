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
  "amused",
  "antagonist",
  "assertive",
  "by-stander",
  "car",
  "character",
  "character present",
  "chaser",
  "concerned",
  "door",
  "emphatic",
  "foe",
  "friend",
  "guard",
  "identity affirmed",
  "microphone",
  "narrative agent",
  "news anchor",
  "police officer",
  "protagonist",
  "reassuring",
  "reflective",
  "restrained",
  "serious",
  "speaker",
  "symbolic",
  "tense",
  "universal",
  "villain",
  "weapon",
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
    /^(?:chaser\b|man\s+in|person\b|police officer\b)/i.test(label) ||
    /\b(?:aston martin(?:i)?|car|engine|helicopter|lion head|logo|motorcycle|sailing boat|weapon)\b/i.test(label) ||
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

const addSourceCharacterValues = (labels: Set<string>, value: unknown): void => {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => addSourceCharacterValues(labels, entry));
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    addSourceCharacterValues(
      labels,
      record.narrative_agent_name || record.character_name || record.character || record.name || record.label,
    );
    return;
  }
  // Source metadata sometimes appends a role description to the character
  // name. The lineup needs the character, not the descriptive prose.
  const character = String(value).split(/\s*,\s*(?=[a-z])/i, 1)[0].trim();
  addLabel(labels, character);
};

/**
 * Strict admission boundary for visual Narrative Agent lineups.
 *
 * A row may originate only in Source Media character metadata or an explicit
 * analyst action. Expressions, scene cues, object labels, inferred roles and
 * detector classes remain available to their own consumers but cannot create
 * a character lineup row.
 */
export function visualLineupNarrativeAgentLabels(analysisData?: AnalysisData | null): string[] {
  const labels = new Set<string>();
  const annotations = analysisData?.metadata?.sourceMediaMetadata?.user_annotations;

  addSourceCharacterValues(labels, annotations?.narrative_agent_profiles);
  addSourceCharacterValues(labels, annotations?.character_definitions);
  addSourceCharacterValues(labels, annotations?.character_roles);
  addSourceCharacterValues(labels, annotations?.persons);
  (annotations?.web_metadata_sources || []).forEach((source) => {
    addSourceCharacterValues(labels, source.fields?.character_roles);
    addSourceCharacterValues(labels, source.fields?.persons);
  });

  (analysisData?.annotationCorrections?.manual_visual_annotations || []).forEach((entry: ManualVisualAnnotation) => {
    const confirmedFields = (entry.metadata_correlation?.manual_confirmation_event?.confirmed_fields || {}) as Record<string, unknown>;
    const explicitNarrativeAgent = confirmedFields.narrative_agent === true;
    const governedAudioAgent = entry.category === "Audio" && entry.subcategory === "Narrative Agent";
    const governedVisualAgent = entry.category === "Identification" && entry.subcategory === "Character";
    if (!explicitNarrativeAgent && !governedAudioAgent && !governedVisualAgent) return;
    addLabel(labels, entry.identity_affirmation || entry.custom_label || entry.label);
  });
  (analysisData?.masterSchemaResolvedEvidence?.records || []).forEach((record: MasterSchemaResolvedEvidenceRecord) => {
    if (
      record.category === "narrative_agent_profile" &&
      ["manual_annotation", "manual_correction"].includes(record.authority)
    ) addLabel(labels, record.label);
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
  (analysisData?.annotationCorrections?.proliferation_decisions || []).forEach((decision) => {
    if (
      decision.decision !== "confirmed" ||
      !String(decision.decision_id || "").startsWith("narrative-agent-family-governance:")
    ) return;
    const source = String(decision.candidate_label || "").trim();
    const target = String(decision.applied_label || "").replace(/\s+/g, " ").trim();
    if (!target || target.length > 100) return;
    if (source) {
      for (const existing of labels) {
        if (existing.localeCompare(source, undefined, { sensitivity: "base" }) === 0) labels.delete(existing);
      }
    }
    labels.add(target);
  });
  return [...labels].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

/** One analysis-scoped governed Narrative Agent list for every authoring surface. */
export function governedNarrativeAgentLabels(analysisData?: AnalysisData | null): string[] {
  const labels = new Set<string>();
  const annotations = analysisData?.metadata?.sourceMediaMetadata?.user_annotations;
  const knownPersons = Array.isArray(annotations?.persons)
    ? annotations.persons.filter((value) => String(value || "").trim())
    : [];
  (analysisData?.masterSchemaResolvedEvidence?.records || []).forEach((record: MasterSchemaResolvedEvidenceRecord) => {
    if (record.category === "narrative_agent_profile" && record.authority !== "raw_detection") {
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
    const confirmedFields = (entry.metadata_correlation?.manual_confirmation_event?.confirmed_fields || {}) as Record<string, unknown>;
    const explicitNarrativeAgent = confirmedFields.narrative_agent === true;
    const governedAudioAgent = entry.category === "Audio" && entry.subcategory === "Narrative Agent";
    const governedVisualAgent = entry.category === "Identification" && entry.subcategory === "Character";
    if (explicitNarrativeAgent || governedAudioAgent || governedVisualAgent) {
      addLabel(labels, entry.identity_affirmation);
    }
    if (explicitNarrativeAgent && !entry.identity_affirmation) {
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
  // Analyst-authored family governance is the final naming authority. It may
  // intentionally promote a role label such as "Police officer" into a
  // Narrative Agent row, so these explicit decisions are not passed back
  // through the automatic suggestion filter above.
  (analysisData?.annotationCorrections?.proliferation_decisions || []).forEach((decision) => {
    if (
      decision.decision !== "confirmed" ||
      !String(decision.decision_id || "").startsWith("narrative-agent-family-governance:")
    ) return;
    const source = String(decision.candidate_label || "").trim();
    const target = String(decision.applied_label || "").replace(/\s+/g, " ").trim();
    if (!target || target.length > 100) return;
    if (source) {
      for (const existing of labels) {
        if (existing.localeCompare(source, undefined, { sensitivity: "base" }) === 0) labels.delete(existing);
      }
    }
    labels.add(target);
  });
  return [...labels].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}
