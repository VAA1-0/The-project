import { useEffect, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import {
  apiService,
  type SharedTaxonomyLabel,
  type SourceMediaMetadata,
} from "@/lib/api-service";
import CustomizableSelectField from "@/components/metadata/CustomizableSelectField";
import {
  getLearnedTaxonomyLabels,
  getExpertiseAxisOptions,
  getMediaGenreOptions,
  getMediaSubgenreOptions,
  getPrivacyAxisOptions,
  removeCustomTaxonomyLabel,
  registerCustomTaxonomyLabel,
  getSituationalSubgenreOptions,
  getSituationalGenreOptions,
  type CustomTaxonomyScope,
  type SharedTaxonomyOption,
} from "@/lib/metadata-taxonomy";

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function deriveCharacterDetectionSupport(metadata: SourceMediaMetadata | null) {
  if (!metadata) {
    return { score: 0, level: "Not available", supporting: [] as string[], constraining: [] as string[] };
  }

  const supporting: string[] = [];
  const constraining: string[] = [];
  let score = 0;

  const width = typeof metadata.width === "number" ? metadata.width : 0;
  const height = typeof metadata.height === "number" ? metadata.height : 0;
  const fps = typeof metadata.fps === "number" ? metadata.fps : 0;
  const duration = typeof metadata.duration_seconds === "number" ? metadata.duration_seconds : 0;
  const hasAudio = metadata.has_audio !== false;
  const sourceContext = metadata.user_annotations?.source_context?.trim() || "";

  if (width >= 1280 && height >= 720) {
    supporting.push("resolution supports steadier face and appearance cues");
    score += 2;
  } else if (width >= 854 && height >= 480) {
    supporting.push("resolution supports basic screen-presence tracking");
    score += 1;
  } else if (width > 0 && height > 0) {
    constraining.push("low resolution limits face and appearance continuity");
  }

  if (fps >= 24) {
    supporting.push("frame rate supports smoother motion continuity");
    score += 1;
  } else if (fps > 0 && fps < 12) {
    constraining.push("low frame rate weakens motion continuity");
  }

  if (duration >= 20) {
    supporting.push("clip duration supports stable primary/secondary agent ranking");
    score += 1;
  } else if (duration > 0 && duration < 5) {
    constraining.push("very short duration limits character continuity");
  }

  if (hasAudio) {
    supporting.push("audio track supports role and speaker triangulation");
    score += 1;
  } else {
    constraining.push("missing audio removes speaker-role support");
  }

  if (sourceContext) {
    supporting.push("source context note can strengthen editorial character reading");
    score += 1;
  }

  let level = "Low support";
  if (score >= 5) {
    level = "Strong support";
  } else if (score >= 3) {
    level = "Moderate support";
  }

  return { score, level, supporting, constraining };
}

type ReferenceSpeakerDraft = {
  speaker_label: string;
  identity_label: string;
  relation: string;
  reference_file: string;
  notes: string;
};

type MetadataCandidate = {
  key: string;
  label: string;
  current: string;
  suggestion: string;
  maturity: string;
  route: string;
  evidenceSources: string[];
};

type WebMetadataPreference = "main" | "supporting" | "background";

type WebMetadataSource = NonNullable<
  NonNullable<SourceMediaMetadata["user_annotations"]>["web_metadata_sources"]
>[number];

type WebCharacterRole = {
  actor?: string;
  character?: string;
  role?: string;
  description?: string;
};

type WebProductionCrewRole = {
  person?: string;
  department?: string;
};

type CharacterDefinition = NonNullable<
  NonNullable<SourceMediaMetadata["user_annotations"]>["character_definitions"]
>[number];

const displayedWebCandidateFields = new Set([
  "title",
  "description",
  "character_roles",
  "production_crew",
  "persons",
  "places",
  "dates",
  "keywords",
]);

function formatCandidateValue(value: unknown, separator = ", "): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(separator);
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function sameCandidateValue(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function formatWebCharacterRoleForGovernedField(role: WebCharacterRole): string {
  const actor = String(role?.actor || "").trim();
  const character = String(role?.character || "").trim();
  const roleLabel = String(role?.role || "").trim();
  const description = String(role?.description || "").trim();
  const head = actor ? `${character || "Unspecified character"} (${actor})` : character;
  const tail = [roleLabel, description].filter(Boolean).join("; ");
  return [head, tail].filter(Boolean).join(": ");
}

function formatWebProductionCrew(role: WebProductionCrewRole): string {
  return [role?.person, role?.department].filter(Boolean).join(": ");
}

function visibleWebMetadataCandidates(source: WebMetadataSource) {
  return (source.candidates || []).filter(
    (candidate) => !displayedWebCandidateFields.has(candidate.field || ""),
  );
}

function mergeCsvValues(current: string, incoming: string[]): string {
  const seen = new Set<string>();
  const values: string[] = [];
  [...current.split(","), ...incoming].forEach((value) => {
    const cleaned = value.trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) {
      return;
    }
    seen.add(key);
    values.push(cleaned);
  });
  return values.join(", ");
}

function formatCharacterDefinition(definition: CharacterDefinition): string {
  const character = String(definition.character_name || "").trim();
  const actor = String(definition.actor_name || "").trim();
  const roles = (definition.role_labels || []).filter(Boolean).join(", ");
  const description = String(definition.role_description || "").trim();
  const head = actor ? `${character || "Unspecified character"} (${actor})` : character;
  const tail = [roles, description].filter(Boolean).join("; ");
  return [head, tail].filter(Boolean).join(": ");
}

export default function SourceMediaMetadataPanel() {
  const [videoId, setVideoId] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [metadata, setMetadata] = useState<SourceMediaMetadata | null>(null);
  const [editorNotes, setEditorNotes] = useState("");
  const [sourceContext, setSourceContext] = useState("");
  const [provenanceNotes, setProvenanceNotes] = useState("");
  const [userTitle, setUserTitle] = useState("");
  const [scope, setScope] = useState("");
  const [description, setDescription] = useState("");
  const [persons, setPersons] = useState("");
  const [characterRoles, setCharacterRoles] = useState("");
  const [relations, setRelations] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationPlace, setLocationPlace] = useState("");
  const [locationRoom, setLocationRoom] = useState("");
  const [timeEra, setTimeEra] = useState("");
  const [timeYear, setTimeYear] = useState("");
  const [timeMoment, setTimeMoment] = useState("");
  const [situationEvent, setSituationEvent] = useState("");
  const [keywords, setKeywords] = useState("");
  const [interactionDynamics, setInteractionDynamics] = useState("");
  const [narrativeDevelopment, setNarrativeDevelopment] = useState("");
  const [performanceExpression, setPerformanceExpression] = useState("");
  const [genre, setGenre] = useState("");
  const [genreSubtype, setGenreSubtype] = useState("");
  const [situationalGenre, setSituationalGenre] = useState("");
  const [situationalSubtype, setSituationalSubtype] = useState("");
  const [privacyAxis, setPrivacyAxis] = useState("");
  const [expertiseAxis, setExpertiseAxis] = useState("");
  const [references, setReferences] = useState("");
  const [referenceSpeakers, setReferenceSpeakers] = useState<ReferenceSpeakerDraft[]>([]);
  const [referenceUploadFiles, setReferenceUploadFiles] = useState<File[]>([]);
  const [isUploadingReferences, setIsUploadingReferences] = useState(false);
  const [webMetadataUrl, setWebMetadataUrl] = useState("");
  const [isHarvestingWebMetadata, setIsHarvestingWebMetadata] = useState(false);
  const [webMetadataActionId, setWebMetadataActionId] = useState<string | null>(null);
  const [webRoleEdits, setWebRoleEdits] = useState<Record<string, WebCharacterRole[]>>({});
  const [referenceRelation, setReferenceRelation] = useState("");
  const [referenceSource, setReferenceSource] = useState("");
  const [confidence, setConfidence] = useState("");
  const [notes, setNotes] = useState("");
  const [customTaxonomyInputs, setCustomTaxonomyInputs] = useState({
    genre: "",
    genreSubtype: "",
    situationalGenre: "",
    situationalSubtype: "",
    privacyAxis: "",
    expertiseAxis: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [, setTaxonomyRefreshNonce] = useState(0);
  const [sharedTaxonomyLabels, setSharedTaxonomyLabels] = useState<
    SharedTaxonomyLabel[]
  >([]);

  useEffect(() => {
    const handler = (id: string) => {
      setVideoId(id);
    };
    const metadataHandler = (id: string) => {
      if (id === videoId) {
        setRefreshNonce((value) => value + 1);
      }
    };
    eventBus.on("videoIdChanged", handler);
    eventBus.on("sourceMediaMetadataChanged", metadataHandler);
    return () => {
      eventBus.off("videoIdChanged", handler);
      eventBus.off("sourceMediaMetadataChanged", metadataHandler);
    };
  }, [videoId]);

  useEffect(() => {
    async function load() {
      if (!videoId) {
        setMetadata(null);
        setEditorNotes("");
        setSourceContext("");
        setProvenanceNotes("");
        setUserTitle("");
        setScope("");
        setDescription("");
        setPersons("");
        setCharacterRoles("");
        setRelations("");
        setLocationCountry("");
        setLocationCity("");
        setLocationPlace("");
        setLocationRoom("");
        setTimeEra("");
        setTimeYear("");
        setTimeMoment("");
        setSituationEvent("");
        setKeywords("");
        setInteractionDynamics("");
        setNarrativeDevelopment("");
        setPerformanceExpression("");
        setGenre("");
        setGenreSubtype("");
        setSituationalGenre("");
        setSituationalSubtype("");
        setPrivacyAxis("");
        setExpertiseAxis("");
        setReferences("");
        setReferenceSpeakers([]);
        setReferenceUploadFiles([]);
        setWebMetadataUrl("");
        setWebMetadataActionId(null);
        setWebRoleEdits({});
        setReferenceRelation("");
        setReferenceSource("");
        setConfidence("");
        setNotes("");
        setCustomTaxonomyInputs({
          genre: "",
          genreSubtype: "",
          situationalGenre: "",
          situationalSubtype: "",
          privacyAxis: "",
          expertiseAxis: "",
        });
        return;
      }

      try {
        const nextMetadata = await apiService.getSourceMediaMetadata(videoId);
        setMetadata(nextMetadata);
        setEditorNotes(nextMetadata.user_annotations?.editor_notes || "");
        setSourceContext(nextMetadata.user_annotations?.source_context || "");
        setProvenanceNotes(nextMetadata.user_annotations?.provenance_notes || "");
        setUserTitle(nextMetadata.user_annotations?.title || "");
        setScope(nextMetadata.user_annotations?.scope || "");
        setDescription(nextMetadata.user_annotations?.description || "");
        setPersons((nextMetadata.user_annotations?.persons || []).join(", "));
        setCharacterRoles((nextMetadata.user_annotations?.character_roles || []).join("\n"));
        setRelations(nextMetadata.user_annotations?.relations || "");
        setLocationCountry(nextMetadata.user_annotations?.location_country || "");
        setLocationCity(nextMetadata.user_annotations?.location_city || "");
        setLocationPlace(nextMetadata.user_annotations?.location_place || "");
        setLocationRoom(nextMetadata.user_annotations?.location_room || "");
        setTimeEra(nextMetadata.user_annotations?.time_era || "");
        setTimeYear(nextMetadata.user_annotations?.time_year || "");
        setTimeMoment(nextMetadata.user_annotations?.time_moment || "");
        setSituationEvent(nextMetadata.user_annotations?.situation_event || "");
        setKeywords((nextMetadata.user_annotations?.keywords || []).join(", "));
        setInteractionDynamics(
          nextMetadata.user_annotations?.interaction_dynamics || "",
        );
        setNarrativeDevelopment(
          nextMetadata.user_annotations?.narrative_development || "",
        );
        setPerformanceExpression(
          nextMetadata.user_annotations?.performance_expression || "",
        );
        setGenre(nextMetadata.user_annotations?.genre || "");
        setGenreSubtype(nextMetadata.user_annotations?.genre_subtype || "");
        setSituationalGenre(
          nextMetadata.user_annotations?.situational_genre || "",
        );
        setSituationalSubtype(
          nextMetadata.user_annotations?.situational_subtype || "",
        );
        setPrivacyAxis(nextMetadata.user_annotations?.privacy_axis || "");
        setExpertiseAxis(nextMetadata.user_annotations?.expertise_axis || "");
        setReferences((nextMetadata.user_annotations?.references || []).join("\n"));
        setReferenceSpeakers(
          (nextMetadata.user_annotations?.reference_speakers || []).map((speaker) => ({
            speaker_label: speaker.speaker_label || "",
            identity_label: speaker.identity_label || "",
            relation: speaker.relation || "",
            reference_file: speaker.reference_file || "",
            notes: speaker.notes || "",
          })),
        );
        setReferenceRelation(nextMetadata.user_annotations?.reference_relation || "");
        setReferenceSource(nextMetadata.user_annotations?.reference_source || "");
        setConfidence(nextMetadata.user_annotations?.confidence || "");
        setNotes(nextMetadata.user_annotations?.notes || "");
        setCustomTaxonomyInputs({
          genre: "",
          genreSubtype: "",
          situationalGenre: "",
          situationalSubtype: "",
          privacyAxis: "",
          expertiseAxis: "",
        });
      } catch (error) {
        console.error("Failed to load source media metadata:", error);
        setMetadata(null);
      }
    }
    void load();
  }, [videoId, refreshNonce]);

  useEffect(() => {
    async function loadSharedTaxonomy() {
      try {
        const labels = await apiService.listSharedTaxonomyLabels();
        setSharedTaxonomyLabels(labels);
      } catch (error) {
        console.warn("Failed to load shared taxonomy labels:", error);
      }
    }
    void loadSharedTaxonomy();
  }, []);

  const saveMetadata = async () => {
    if (!videoId) {
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const saved = await apiService.updateSourceMediaMetadata(videoId, {
        editor_notes: editorNotes,
        source_context: sourceContext,
        provenance_notes: provenanceNotes,
        title: userTitle,
        scope,
        description,
        persons: persons
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        character_roles: characterRoles
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        relations,
        location_country: locationCountry,
        location_city: locationCity,
        location_place: locationPlace,
        location_room: locationRoom,
        time_era: timeEra,
        time_year: timeYear,
        time_moment: timeMoment,
        situation_event: situationEvent,
        keywords: keywords
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        interaction_dynamics: interactionDynamics,
        narrative_development: narrativeDevelopment,
        performance_expression: performanceExpression,
        genre,
        genre_subtype: genreSubtype,
        situational_genre: situationalGenre,
        situational_subtype: situationalSubtype,
        privacy_axis: privacyAxis,
        expertise_axis: expertiseAxis,
        references: references
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        reference_speakers: referenceSpeakers
          .map((speaker) => ({
            speaker_label: speaker.speaker_label.trim(),
            identity_label: speaker.identity_label.trim(),
            relation: speaker.relation.trim(),
            reference_file: speaker.reference_file.trim(),
            notes: speaker.notes.trim(),
          }))
          .filter(
            (speaker) =>
              speaker.speaker_label ||
              speaker.identity_label ||
              speaker.reference_file ||
              speaker.notes,
          ),
        reference_relation: referenceRelation,
        reference_source: referenceSource,
        confidence,
        notes,
      });
      setMetadata(saved);
      setSaveMessage("Metadata notes saved.");
      window.setTimeout(() => setSaveMessage(null), 1800);
    } catch (error) {
      console.error("Failed to save source media metadata:", error);
      setSaveMessage("Could not save metadata notes.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveMetadataPatch = async (
    patch: Parameters<typeof apiService.updateSourceMediaMetadata>[1],
    message: string,
  ) => {
    if (!videoId) {
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const saved = await apiService.updateSourceMediaMetadata(videoId, {
        editor_notes: editorNotes,
        source_context: sourceContext,
        provenance_notes: provenanceNotes,
        title: userTitle,
        scope,
        description,
        persons: persons
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        character_roles: characterRoles
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        relations,
        location_country: locationCountry,
        location_city: locationCity,
        location_place: locationPlace,
        location_room: locationRoom,
        time_era: timeEra,
        time_year: timeYear,
        time_moment: timeMoment,
        situation_event: situationEvent,
        keywords: keywords
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        interaction_dynamics: interactionDynamics,
        narrative_development: narrativeDevelopment,
        performance_expression: performanceExpression,
        genre,
        genre_subtype: genreSubtype,
        situational_genre: situationalGenre,
        situational_subtype: situationalSubtype,
        privacy_axis: privacyAxis,
        expertise_axis: expertiseAxis,
        references: references
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        reference_speakers: referenceSpeakers
          .map((speaker) => ({
            speaker_label: speaker.speaker_label.trim(),
            identity_label: speaker.identity_label.trim(),
            relation: speaker.relation.trim(),
            reference_file: speaker.reference_file.trim(),
            notes: speaker.notes.trim(),
          }))
          .filter(
            (speaker) =>
              speaker.speaker_label ||
              speaker.identity_label ||
              speaker.reference_file ||
              speaker.notes,
          ),
        reference_relation: referenceRelation,
        reference_source: referenceSource,
        confidence,
        notes,
        ...patch,
      });
      setMetadata(saved);
      setSaveMessage(message);
      window.setTimeout(() => setSaveMessage(null), 2200);
    } catch (error) {
      console.error("Failed to save source media metadata patch:", error);
      setSaveMessage("Could not save metadata update.");
    } finally {
      setIsSaving(false);
    }
  };

  const addReferenceSpeaker = () => {
    setReferenceSpeakers((current) => [
      ...current,
      {
        speaker_label: "",
        identity_label: "",
        relation: "",
        reference_file: "",
        notes: "",
      },
    ]);
  };

  const updateReferenceSpeaker = (
    index: number,
    key: keyof ReferenceSpeakerDraft,
    value: string,
  ) => {
    setReferenceSpeakers((current) =>
      current.map((speaker, speakerIndex) =>
        speakerIndex === index ? { ...speaker, [key]: value } : speaker,
      ),
    );
  };

  const removeReferenceSpeaker = (index: number) => {
    setReferenceSpeakers((current) =>
      current.filter((_, speakerIndex) => speakerIndex !== index),
    );
  };

  const sourceRoleKey = (source: WebMetadataSource, index: number) =>
    source.id || source.url || `source-${index}`;

  const getEditableWebRoles = (source: WebMetadataSource, sourceIndex: number) => {
    const key = sourceRoleKey(source, sourceIndex);
    return webRoleEdits[key] || source.fields?.character_roles || [];
  };

  const updateEditableWebRole = (
    source: WebMetadataSource,
    sourceIndex: number,
    roleIndex: number,
    field: keyof WebCharacterRole,
    value: string,
  ) => {
    const key = sourceRoleKey(source, sourceIndex);
    const baseRoles = webRoleEdits[key] || source.fields?.character_roles || [];
    setWebRoleEdits((current) => ({
      ...current,
      [key]: baseRoles.map((role, index) =>
        index === roleIndex ? { ...role, [field]: value } : role,
      ),
    }));
  };

  const dropEditableWebRole = (
    source: WebMetadataSource,
    sourceIndex: number,
    roleIndex: number,
  ) => {
    const key = sourceRoleKey(source, sourceIndex);
    const baseRoles = webRoleEdits[key] || source.fields?.character_roles || [];
    setWebRoleEdits((current) => ({
      ...current,
      [key]: baseRoles.filter((_, index) => index !== roleIndex),
    }));
  };

  const uploadReferenceFiles = async () => {
    if (!videoId || referenceUploadFiles.length === 0) return;
    setIsUploadingReferences(true);
    setSaveMessage(null);
    try {
      const saved = await apiService.uploadSourceMediaReferences(
        videoId,
        referenceUploadFiles,
      );
      setMetadata(saved);
      setReferenceUploadFiles([]);
      setSaveMessage("Reference files uploaded.");
      window.setTimeout(() => setSaveMessage(null), 1800);
    } catch (error) {
      console.error("Failed to upload reference files:", error);
      setSaveMessage("Could not upload reference files.");
    } finally {
      setIsUploadingReferences(false);
    }
  };

  const harvestWebMetadata = async () => {
    const trimmedUrl = webMetadataUrl.trim();
    if (!videoId || !trimmedUrl) return;
    setIsHarvestingWebMetadata(true);
    setSaveMessage(null);
    try {
      const saved = await apiService.harvestSourceMediaWebMetadata(
        videoId,
        trimmedUrl,
      );
      setMetadata(saved);
      setWebMetadataUrl("");
      setSaveMessage("Web metadata candidates retrieved.");
      window.setTimeout(() => setSaveMessage(null), 1800);
    } catch (error) {
      console.error("Failed to harvest web metadata:", error);
      setSaveMessage("Could not retrieve web metadata.");
    } finally {
      setIsHarvestingWebMetadata(false);
    }
  };

  const dedupeWebMetadataSources = async () => {
    if (!videoId) return;
    setWebMetadataActionId("dedupe");
    setSaveMessage(null);
    try {
      const saved = await apiService.dedupeSourceMediaWebMetadata(videoId);
      setMetadata(saved);
      setSaveMessage("Duplicate web metadata sources dropped.");
      window.setTimeout(() => setSaveMessage(null), 1800);
    } catch (error) {
      console.error("Failed to drop duplicate web metadata sources:", error);
      setSaveMessage("Could not drop duplicate web metadata sources.");
    } finally {
      setWebMetadataActionId(null);
    }
  };

  const updateWebMetadataPreference = async (
    sourceId: string | undefined,
    preference: WebMetadataPreference,
  ) => {
    if (!videoId || !sourceId) return;
    setWebMetadataActionId(sourceId);
    setSaveMessage(null);
    try {
      const saved = await apiService.updateSourceMediaWebMetadataPreference(
        videoId,
        sourceId,
        preference,
      );
      setMetadata(saved);
      setSaveMessage("Web metadata source preference updated.");
      window.setTimeout(() => setSaveMessage(null), 1800);
    } catch (error) {
      console.error("Failed to update web metadata source preference:", error);
      setSaveMessage("Could not update source preference.");
    } finally {
      setWebMetadataActionId(null);
    }
  };

  const deleteWebMetadataSource = async (sourceId: string | undefined) => {
    if (!videoId || !sourceId) return;
    setWebMetadataActionId(sourceId);
    setSaveMessage(null);
    try {
      const saved = await apiService.deleteSourceMediaWebMetadata(videoId, sourceId);
      setMetadata(saved);
      setSaveMessage("Web metadata source dropped.");
      window.setTimeout(() => setSaveMessage(null), 1800);
    } catch (error) {
      console.error("Failed to drop web metadata source:", error);
      setSaveMessage("Could not drop web metadata source.");
    } finally {
      setWebMetadataActionId(null);
    }
  };

  const removeLearnedTaxonomy = (
    scope: CustomTaxonomyScope,
    label: string,
    parentValue?: string,
  ) => {
    removeCustomTaxonomyLabel(scope, label, parentValue);
    setTaxonomyRefreshNonce((value) => value + 1);
    if (scope === "media_genre" && genre === label) {
      setGenre("");
      setGenreSubtype("");
    } else if (scope === "media_subgenre" && genreSubtype === label) {
      setGenreSubtype("");
    } else if (scope === "situational_genre" && situationalGenre === label) {
      setSituationalGenre("");
      setSituationalSubtype("");
    } else if (
      scope === "situational_subgenre" &&
      situationalSubtype === label
    ) {
      setSituationalSubtype("");
    } else if (scope === "privacy_axis" && privacyAxis === label) {
      setPrivacyAxis("");
    } else if (scope === "expertise_axis" && expertiseAxis === label) {
      setExpertiseAxis("");
    }
  };

  const updateCustomTaxonomyInput = (
    key: keyof typeof customTaxonomyInputs,
    value: string,
  ) => {
    setCustomTaxonomyInputs((previous) => ({ ...previous, [key]: value }));
  };

  const applyCustomTaxonomy = (
    key: keyof typeof customTaxonomyInputs,
    scope:
      | "media_genre"
      | "media_subgenre"
      | "situational_genre"
      | "situational_subgenre"
      | "privacy_axis"
      | "expertise_axis",
    assign: (value: string) => void,
    parentValue?: string,
  ) => {
    const customValue = customTaxonomyInputs[key].trim();
    if (!customValue) {
      return;
    }
    registerCustomTaxonomyLabel(scope, customValue, parentValue);
    assign(customValue);
    updateCustomTaxonomyInput(key, "");
  };

  const shareCustomTaxonomy = async (
    key: keyof typeof customTaxonomyInputs,
    scope: CustomTaxonomyScope,
    assign: (value: string) => void,
    parentValue?: string,
  ) => {
    const customValue = customTaxonomyInputs[key].trim();
    if (!customValue) {
      return;
    }

    try {
      const saved = await apiService.saveSharedTaxonomyLabel({
        scope,
        label: customValue,
        parent_value: parentValue,
        created_by: "analyst",
        source: "manual_share",
      });
      registerCustomTaxonomyLabel(scope, customValue, parentValue);
      assign(customValue);
      updateCustomTaxonomyInput(key, "");
      setSharedTaxonomyLabels((current) => {
        const next = current.filter(
          (entry) =>
            !(
              entry.scope === saved.scope &&
              (entry.parent_value || "") === (saved.parent_value || "") &&
              entry.label.trim().toLowerCase() === saved.label.trim().toLowerCase()
            ),
        );
        next.push(saved);
        return next.sort((left, right) =>
          left.label.localeCompare(right.label, undefined, {
            sensitivity: "base",
          }),
        );
      });
      setSaveMessage(`Shared taxonomy label saved: ${saved.label}`);
      window.setTimeout(() => setSaveMessage(null), 1800);
    } catch (error) {
      console.error("Failed to save shared taxonomy label:", error);
      setSaveMessage("Could not save shared taxonomy label.");
      window.setTimeout(() => setSaveMessage(null), 1800);
    }
  };

  const sharedTaxonomyOptions: SharedTaxonomyOption[] = sharedTaxonomyLabels.map(
    (entry) => ({
      scope: entry.scope,
      label: entry.label,
      parent_value: entry.parent_value,
    }),
  );

  const coreRows = [
    ["Original file", metadata?.original_filename],
    ["Stored file", metadata?.stored_filename],
    ["Source path", metadata?.source_video_path],
    ["Duration (s)", metadata?.duration_seconds],
    ["Size (bytes)", metadata?.size_bytes],
    ["Format", metadata?.format_name],
    ["MIME type", metadata?.mime_type],
    ["Video codec", metadata?.video_codec],
    ["Audio codec", metadata?.audio_codec],
    ["Resolution", metadata?.width && metadata?.height ? `${metadata.width} x ${metadata.height}` : null],
    ["FPS", metadata?.fps],
    ["Audio channels", metadata?.audio_channels],
    ["Sample rate", metadata?.audio_sample_rate],
    ["Recorded date/time", metadata?.recorded_at],
    ["GPS coordinates", metadata?.gps_coordinates],
    ["Camera make", metadata?.camera_make],
    ["Camera model", metadata?.camera_model],
    ["Recording device", metadata?.recording_device],
    ["Recording software", metadata?.recording_software],
    ["Filmed by", metadata?.filmed_by],
    ["Container extension", metadata?.container_extension],
    ["Has audio", metadata?.has_audio],
    ["Video bitrate", metadata?.video_bitrate],
    ["Audio bitrate", metadata?.audio_bitrate],
    ["Pipeline", metadata?.pipeline_type],
    ["CVAT ID", metadata?.cvatID],
    ["Source present", metadata?.source_video_exists],
    ["Filesystem modified", metadata?.filesystem_modified_at],
  ] as const;
  const characterSupport = deriveCharacterDetectionSupport(metadata);
  const characterDefinitions = metadata?.user_annotations?.character_definitions || [];
  const referenceFiles = metadata?.user_annotations?.reference_files || [];
  const webMetadataPreferenceRank: Record<WebMetadataPreference, number> = {
    main: 0,
    supporting: 1,
    background: 2,
  };
  const webMetadataSources: WebMetadataSource[] = [
    ...(metadata?.user_annotations?.web_metadata_sources || []),
  ].sort((left, right) => {
    const leftPreference = left.preference || "supporting";
    const rightPreference = right.preference || "supporting";
    const preferenceDelta =
      webMetadataPreferenceRank[leftPreference] -
      webMetadataPreferenceRank[rightPreference];
    if (preferenceDelta !== 0) {
      return preferenceDelta;
    }
    return (right.retrieved_at || "").localeCompare(left.retrieved_at || "");
  });
  const webMetadataCandidateCount = webMetadataSources.reduce(
    (total, source) => total + (source.candidates?.length || 0),
    0,
  );
  const placeSummary =
    [locationPlace, locationCity, locationCountry].filter(Boolean).join(", ") ||
    "Not set";
  const timeSummary =
    [timeMoment, timeYear, timeEra].filter(Boolean).join(", ") || "Not set";
  const situationSummary =
    [situationalGenre, situationalSubtype, situationEvent]
      .filter(Boolean)
      .join(" / ") || "Not set";
  const sourceSummaryRows = [
    ["Duration", metadata?.duration_seconds ? `${formatValue(metadata.duration_seconds)} s` : null],
    ["Resolution", metadata?.width && metadata?.height ? `${metadata.width} x ${metadata.height}` : null],
    ["Format", metadata?.format_name || metadata?.container_extension],
    ["Source present", metadata?.source_video_exists],
  ] as const;
  const maturityHighlights = [
    ["Situation / event", situationEvent],
    ["Character roles", characterRoles],
    ["Keywords", keywords],
    ["Interaction", interactionDynamics],
    ["Narrative", narrativeDevelopment],
    ["Source context", sourceContext],
  ].filter(([, value]) => Boolean(String(value || "").trim()));
  const candidateFieldConfig = [
    { key: "title", label: "Title", current: userTitle },
    { key: "persons", label: "People / roles", current: persons },
    { key: "character_roles", label: "Character roles", current: characterRoles },
    { key: "location_place", label: "Place", current: locationPlace },
    { key: "location_city", label: "City", current: locationCity },
    { key: "location_country", label: "Country", current: locationCountry },
    { key: "time_moment", label: "Time", current: timeMoment },
    { key: "source_context", label: "Source context", current: sourceContext },
    { key: "description", label: "Description / synopsis", current: description },
    { key: "situation_event", label: "Situation", current: situationEvent },
    { key: "keywords", label: "Keywords", current: keywords },
    { key: "interaction_dynamics", label: "Interaction", current: interactionDynamics },
    { key: "narrative_development", label: "Narrative development", current: narrativeDevelopment },
    { key: "performance_expression", label: "Performance / expression", current: performanceExpression },
    { key: "genre", label: "Genre", current: genre },
    { key: "genre_subtype", label: "Genre subtype", current: genreSubtype },
    { key: "situational_genre", label: "Situational genre", current: situationalGenre },
    { key: "situational_subtype", label: "Situational subtype", current: situationalSubtype },
    { key: "confidence", label: "Confidence", current: confidence },
  ];
  const maturityCandidateRows: MetadataCandidate[] = candidateFieldConfig
    .map((field) => {
      const suggestion = formatCandidateValue(
        metadata?.video_internal_harvest?.annotations?.[field.key],
        field.key === "character_roles" ? "\n" : ", ",
      );
      if (!suggestion || sameCandidateValue(field.current, suggestion)) {
        return null;
      }
      const fieldSource =
        metadata?.video_internal_harvest?.field_sources?.[field.key] ||
        metadata?.annotation_maturity?.[field.key] ||
        {};
      return {
        key: field.key,
        label: field.label,
        current: field.current,
        suggestion,
        maturity: fieldSource.maturity || "derived_video_internal",
        route: fieldSource.traceback?.route || "source_media.video_internal_maturity_harvest",
        evidenceSources: fieldSource.evidence_sources || [],
      };
    })
    .filter((row): row is MetadataCandidate => Boolean(row));
  const applyMaturityCandidate = (key: string, suggestion: string) => {
    if (key === "title") setUserTitle(suggestion);
    else if (key === "persons") setPersons(suggestion);
    else if (key === "character_roles") setCharacterRoles(suggestion);
    else if (key === "location_place") setLocationPlace(suggestion);
    else if (key === "location_city") setLocationCity(suggestion);
    else if (key === "location_country") setLocationCountry(suggestion);
    else if (key === "time_moment") setTimeMoment(suggestion);
    else if (key === "source_context") setSourceContext(suggestion);
    else if (key === "description") setDescription(suggestion);
    else if (key === "situation_event") setSituationEvent(suggestion);
    else if (key === "keywords") setKeywords(suggestion);
    else if (key === "interaction_dynamics") setInteractionDynamics(suggestion);
    else if (key === "narrative_development") setNarrativeDevelopment(suggestion);
    else if (key === "performance_expression") setPerformanceExpression(suggestion);
    else if (key === "genre") setGenre(suggestion);
    else if (key === "genre_subtype") setGenreSubtype(suggestion);
    else if (key === "situational_genre") setSituationalGenre(suggestion);
    else if (key === "situational_subtype") setSituationalSubtype(suggestion);
    else if (key === "confidence") setConfidence(suggestion.toLowerCase());
  };
  const applyEmptyMaturityCandidates = () => {
    maturityCandidateRows.forEach((row) => {
      if (!row.current.trim()) {
        applyMaturityCandidate(row.key, row.suggestion);
      }
    });
  };
  const applyWebSourceNarrativeMetadata = (
    source: WebMetadataSource,
    sourceIndex: number,
  ) => {
    const fields = source.fields || {};
    const roles = getEditableWebRoles(source, sourceIndex);
    const roleLines = roles
      .map(formatWebCharacterRoleForGovernedField)
      .filter(Boolean);
    const nextPersons = mergeCsvValues(persons, fields.persons || []);
    const nextKeywords = mergeCsvValues(keywords, fields.keywords || []);
    const worldTerms = [...(fields.places || []), ...(fields.dates || [])];
    const nextSourceContext =
      worldTerms.length > 0 && !sourceContext.trim()
        ? `Web narrative-world cues: ${worldTerms.join(", ")}`
        : sourceContext;
    if (roleLines.length > 0) {
      setCharacterRoles(roleLines.join("\n"));
    }
    if (fields.persons?.length) {
      setPersons(nextPersons);
    }
    if (fields.keywords?.length) {
      setKeywords(nextKeywords);
    }
    if (nextSourceContext !== sourceContext) {
      setSourceContext(nextSourceContext);
    }
    void saveMetadataPatch(
      {
        persons: nextPersons
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        character_roles: roleLines,
        keywords: nextKeywords
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        source_context: nextSourceContext,
      },
      "Web narrative metadata saved to governed fields.",
    );
  };
  const refreshMetadata = () => {
    setRefreshNonce((value) => value + 1);
  };
  const fieldLabelClass =
    "mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500";
  const compactInputClass =
    "w-full rounded border border-slate-700 bg-[#171717] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/60";
  const compactTextareaClass =
    "w-full rounded border border-slate-700 bg-[#171717] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/60";
  const subDetailClass =
    "rounded-md border border-slate-800 bg-slate-950/20";
  const subSummaryClass =
    "cursor-pointer px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-slate-300";
  const detailClass =
    "mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/35";
  const summaryClass =
    "cursor-pointer px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-300";

  return (
    <main className="h-full overflow-y-auto bg-[#111111] px-3 py-3 text-slate-200">
      <div className="rounded-lg bg-slate-700/25 p-3">
        <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
          Source Media
        </div>
        <div className="mt-2 text-sm text-slate-100">
          {metadata?.original_filename || "No analysis selected"}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Original media-source metadata for triangulation, export, and editorial notes.
        </div>
      </div>

      {!videoId ? (
        <div className="mt-3 rounded-lg bg-slate-700/20 p-3 text-sm text-slate-300">
          Select an analysis from Project to view source media metadata.
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-cyan-500/15 bg-cyan-950/10 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                  Primary Metadata
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Editable first-read metadata for the Master Schema.
                </div>
              </div>
              <button
                type="button"
                onClick={refreshMetadata}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800/60"
              >
                Refresh maturity
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveMetadata();
                }}
                disabled={isSaving}
                className="rounded-md border border-cyan-500/25 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-900/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <label className="block">
                <div className={fieldLabelClass}>Title</div>
                <input
                  value={userTitle}
                  onChange={(e) => setUserTitle(e.target.value)}
                  placeholder={metadata?.original_filename || "Title"}
                  className={compactInputClass}
                />
              </label>
              <label className="block">
                <div className={fieldLabelClass}>People / roles</div>
                <input
                  value={persons}
                  onChange={(e) => setPersons(e.target.value)}
                  placeholder="Comma separated"
                  className={compactInputClass}
                />
              </label>
              <label className="block md:col-span-2">
                <div className={fieldLabelClass}>Character roles</div>
                <textarea
                  value={characterRoles}
                  onChange={(e) => setCharacterRoles(e.target.value)}
                  placeholder="Character (actor): role; description"
                  rows={2}
                  className={compactTextareaClass}
                />
              </label>
              <label className="block">
                <div className={fieldLabelClass}>Place</div>
                <input
                  value={locationPlace}
                  onChange={(e) => setLocationPlace(e.target.value)}
                  placeholder={placeSummary}
                  className={compactInputClass}
                />
              </label>
              <label className="block">
                <div className={fieldLabelClass}>City</div>
                <input
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="City"
                  className={compactInputClass}
                />
              </label>
              <label className="block">
                <div className={fieldLabelClass}>Country</div>
                <input
                  value={locationCountry}
                  onChange={(e) => setLocationCountry(e.target.value)}
                  placeholder="Country"
                  className={compactInputClass}
                />
              </label>
              <label className="block">
                <div className={fieldLabelClass}>Time</div>
                <input
                  value={timeMoment}
                  onChange={(e) => setTimeMoment(e.target.value)}
                  placeholder={timeSummary}
                  className={compactInputClass}
                />
              </label>
              <label className="block md:col-span-2">
                <div className={fieldLabelClass}>Keywords</div>
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Comma separated"
                  className={compactInputClass}
                />
              </label>
              <label className="block md:col-span-2">
                <div className={fieldLabelClass}>Source context</div>
                <textarea
                  value={sourceContext}
                  onChange={(e) => setSourceContext(e.target.value)}
                  rows={2}
                  className={compactTextareaClass}
                />
              </label>
              <label className="block md:col-span-2">
                <div className={fieldLabelClass}>Interaction</div>
                <textarea
                  value={interactionDynamics}
                  onChange={(e) => setInteractionDynamics(e.target.value)}
                  rows={2}
                  className={compactTextareaClass}
                />
              </label>
              <label className="block md:col-span-2">
                <div className={fieldLabelClass}>Narrative development</div>
                <textarea
                  value={narrativeDevelopment}
                  onChange={(e) => setNarrativeDevelopment(e.target.value)}
                  rows={2}
                  className={compactTextareaClass}
                />
              </label>
              <label className="block md:col-span-2">
                <div className={fieldLabelClass}>Description / synopsis</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className={compactTextareaClass}
                />
              </label>
              <label className="block">
                <div className={fieldLabelClass}>Situation</div>
                <input
                  value={situationEvent}
                  onChange={(e) => setSituationEvent(e.target.value)}
                  placeholder={situationSummary}
                  className={compactInputClass}
                />
              </label>
              <label className="block">
                <div className={fieldLabelClass}>Confidence</div>
                <select
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  className={compactInputClass}
                >
                  <option value="">Not set</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>
            {saveMessage ? (
              <div className="mt-2 text-xs text-slate-400">{saveMessage}</div>
            ) : null}
            {characterDefinitions.length > 0 ? (
              <div className="mt-3 rounded-md border border-cyan-500/10 bg-slate-950/25 p-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">
                    Character Schema
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {characterDefinitions.length} definitions
                  </div>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {characterDefinitions.slice(0, 6).map((definition, index) => (
                    <div
                      key={`${definition.character_name || "character"}-${definition.actor_name || index}`}
                      className="rounded border border-slate-800 bg-slate-950/30 px-2 py-1.5"
                    >
                      <div className="text-xs text-slate-100">
                        {formatCharacterDefinition(definition) || "Unspecified character"}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        {definition.maturity_route || "master_schema.source_media_character_definition_maturity"}
                      </div>
                      {definition.source_url ? (
                        <div className="mt-1 truncate text-[10px] text-slate-600">
                          {definition.source_preference || "supporting"}: {definition.source_url}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {maturityHighlights.length > 0 ? (
              <div className="mt-3 rounded-md border border-cyan-500/10 bg-slate-950/25 p-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">
                  Mature Video-Internal Fill
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {maturityHighlights.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded border border-slate-800 bg-slate-950/30 px-2 py-1.5"
                    >
                      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        {label}
                      </div>
                      <div className="mt-1 line-clamp-3 text-xs text-slate-200">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <details className="mt-3 rounded-md border border-slate-800 bg-slate-950/25">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-slate-300">
                <span>Maturity candidates</span>
                <span className="normal-case tracking-normal text-slate-500">
                  {maturityCandidateRows.length} complements
                </span>
              </summary>
              <div className="border-t border-slate-800 p-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500">
                    Derived values are proposed as linked-data candidates; accepting a row only fills the local form until saved.
                  </div>
                  <button
                    type="button"
                    onClick={applyEmptyMaturityCandidates}
                    disabled={maturityCandidateRows.every((row) => row.current.trim())}
                    className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Fill blanks
                  </button>
                </div>
                {maturityCandidateRows.length === 0 ? (
                  <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs text-slate-400">
                    Current governed fields already match the mature video-internal suggestions.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-separate border-spacing-y-1 text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        <tr>
                          <th className="px-2 py-1 font-medium">Field</th>
                          <th className="px-2 py-1 font-medium">Current</th>
                          <th className="px-2 py-1 font-medium">Suggestion</th>
                          <th className="px-2 py-1 font-medium">Traceback</th>
                          <th className="px-2 py-1 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maturityCandidateRows.map((row) => (
                          <tr key={row.key} className="bg-slate-900/40">
                            <td className="rounded-l border-y border-l border-slate-800 px-2 py-2 align-top text-slate-200">
                              <div>{row.label}</div>
                              <div className="mt-1 text-[10px] text-cyan-300/70">
                                {row.maturity}
                              </div>
                            </td>
                            <td className="max-w-[220px] border-y border-slate-800 px-2 py-2 align-top text-slate-400">
                              <div className="line-clamp-3">
                                {row.current || "Blank"}
                              </div>
                            </td>
                            <td className="max-w-[280px] border-y border-slate-800 px-2 py-2 align-top text-slate-100">
                              <div className="line-clamp-4">{row.suggestion}</div>
                            </td>
                            <td className="max-w-[220px] border-y border-slate-800 px-2 py-2 align-top text-slate-500">
                              <div className="line-clamp-2">{row.route}</div>
                              {row.evidenceSources.length > 0 ? (
                                <div className="mt-1 line-clamp-2 text-[10px] text-slate-600">
                                  {row.evidenceSources.slice(0, 5).join(", ")}
                                </div>
                              ) : null}
                            </td>
                            <td className="rounded-r border-y border-r border-slate-800 px-2 py-2 align-top">
                              <button
                                type="button"
                                onClick={() => applyMaturityCandidate(row.key, row.suggestion)}
                                className="rounded border border-cyan-500/30 px-2 py-1 text-[11px] text-cyan-100 transition hover:bg-cyan-900/20"
                              >
                                Use
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </details>
          </div>

          <details open className={detailClass}>
            <summary className={summaryClass}>
              Media Facts
              <span className="ml-2 normal-case tracking-normal text-slate-500">
                file-derived evidence
              </span>
            </summary>
            <div className="border-t border-slate-800 p-3">
              <div className="grid gap-2 md:grid-cols-4">
                {sourceSummaryRows.map(([label, value]) => (
                  <div key={label} className="rounded-md bg-slate-800/35 px-2 py-2">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {label}
                    </div>
                    <div className="mt-1 text-xs text-slate-200 break-words">
                      {formatValue(value)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {coreRows.map(([label, value]) => (
                  <div key={label} className="rounded-md bg-slate-800/25 px-2 py-1.5">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {label}
                    </div>
                    <div className="mt-1 text-xs text-slate-200 break-words">
                      {formatValue(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>

          <details className={detailClass}>
            <summary className={summaryClass}>
              Governed Evidence Inputs
              <span className="ml-2 normal-case tracking-normal text-slate-500">
                files, web addresses, metadata libraries
              </span>
            </summary>
            <div className="border-t border-slate-800 p-3">
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Reference files
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    Upload supporting documents, images, or audio for governed confirmation.
                  </div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Web address metadata
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Retrieve title, synopsis, people/roles, places, dates, keywords, source URL, and exact retrieval date-time.
                  </div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Archive/library metadata
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Planned confirmation route for catalog records and institutional authority data.
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-cyan-500/15 bg-cyan-950/10 px-3 py-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[260px] flex-1">
                    <div className={fieldLabelClass}>Web address</div>
                    <input
                      value={webMetadataUrl}
                      onChange={(event) => setWebMetadataUrl(event.target.value)}
                      placeholder="https://example.org/source-page"
                      className={compactInputClass}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isHarvestingWebMetadata || !webMetadataUrl.trim()}
                    onClick={() => {
                      void harvestWebMetadata();
                    }}
                    className="rounded-md border border-cyan-500/25 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isHarvestingWebMetadata ? "Retrieving..." : "Retrieve metadata"}
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Retrieved web values stay as governed candidates until an analyst accepts them.
                </div>
              </div>
              {webMetadataSources.length > 0 ? (
                <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/25 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">
                      Web metadata sources
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[11px] text-slate-500">
                        {webMetadataSources.length} sources / {webMetadataCandidateCount} candidates
                      </div>
                      <button
                        type="button"
                        disabled={webMetadataActionId === "dedupe" || webMetadataSources.length < 2}
                        onClick={() => {
                          void dedupeWebMetadataSources();
                        }}
                        className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {webMetadataActionId === "dedupe" ? "Dropping..." : "Drop duplicates"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {webMetadataSources.map((source, sourceIndex) => (
                      <details
                        key={source.id || source.url}
                        className="rounded border border-slate-800 bg-slate-900/35"
                      >
                        <summary className="cursor-pointer px-2 py-2 text-xs text-slate-300">
                          <span className="font-medium text-slate-200">
                            {source.fields?.title || source.url || "Web metadata source"}
                          </span>
                          <span className="ml-2 rounded border border-cyan-500/20 bg-cyan-950/20 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-cyan-100/80">
                            {source.preference === "main"
                              ? "Main source"
                              : source.preference === "background"
                                ? "Background"
                                : "Supporting"}
                          </span>
                          <span className="ml-2 text-[11px] text-slate-500">
                            retrieved {source.retrieved_at || "unknown time"}
                          </span>
                        </summary>
                        <div className="border-t border-slate-800 p-2">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/25 px-2 py-2">
                            <div>
                              <div className={fieldLabelClass}>Source governance</div>
                              <div className="text-[11px] text-slate-500">
                                Main sources lead metadata synthesis; supporting and background sources remain audit evidence.
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(["main", "supporting", "background"] as WebMetadataPreference[]).map(
                                (preference) => {
                                  const selected =
                                    (source.preference || "supporting") === preference;
                                  return (
                                    <button
                                      key={preference}
                                      type="button"
                                      disabled={!source.id || webMetadataActionId === source.id}
                                      onClick={() => {
                                        void updateWebMetadataPreference(source.id, preference);
                                      }}
                                      className={`rounded border px-2 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                        selected
                                          ? "border-cyan-500/40 bg-cyan-950/30 text-cyan-100"
                                          : "border-slate-700 text-slate-300 hover:bg-slate-800/60"
                                      }`}
                                    >
                                      {preference === "main"
                                        ? "Main"
                                        : preference === "supporting"
                                          ? "Supporting"
                                          : "Background"}
                                    </button>
                                  );
                                },
                              )}
                              <button
                                type="button"
                                disabled={!source.id || webMetadataActionId === source.id}
                                onClick={() => {
                                  void deleteWebMetadataSource(source.id);
                                }}
                                className="rounded border border-rose-500/30 px-2 py-1 text-[11px] text-rose-100 transition hover:bg-rose-950/25 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {webMetadataActionId === source.id ? "Working..." : "Drop"}
                              </button>
                            </div>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="rounded bg-slate-950/30 px-2 py-1.5">
                              <div className={fieldLabelClass}>Source URL</div>
                              <div className="break-words text-xs text-slate-300">
                                {source.url}
                              </div>
                            </div>
                            <div className="rounded bg-slate-950/30 px-2 py-1.5">
                              <div className={fieldLabelClass}>Retrieved at</div>
                              <div className="text-xs text-slate-300">
                                {source.retrieved_at}
                              </div>
                            </div>
                            <div className="rounded bg-slate-950/30 px-2 py-1.5">
                              <div className={fieldLabelClass}>Description / synopsis</div>
                              <div className="max-h-32 overflow-y-auto whitespace-pre-wrap pr-1 text-xs leading-relaxed text-slate-300">
                                {source.fields?.description || "Not available"}
                              </div>
                            </div>
                            <div className="rounded bg-slate-950/30 px-2 py-1.5">
                              <div className={fieldLabelClass}>Cast / character roles</div>
                              <div className="max-h-56 space-y-1 overflow-y-auto pr-1 text-xs leading-relaxed text-slate-300">
                                {getEditableWebRoles(source, sourceIndex).length > 0 ? (
                                  getEditableWebRoles(source, sourceIndex).map((role, index) => (
                                    <div
                                      key={`${role.character || "character"}-${role.actor || index}`}
                                      className="rounded border border-slate-800 bg-slate-950/30 px-2 py-1.5"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="grid flex-1 gap-1 sm:grid-cols-2">
                                          <input
                                            value={role.character || ""}
                                            onChange={(event) =>
                                              updateEditableWebRole(
                                                source,
                                                sourceIndex,
                                                index,
                                                "character",
                                                event.target.value,
                                              )
                                            }
                                            placeholder="Character"
                                            className="min-w-0 rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] font-medium text-slate-100 outline-none focus:border-cyan-500/50"
                                          />
                                          <input
                                            value={role.actor || ""}
                                            onChange={(event) =>
                                              updateEditableWebRole(
                                                source,
                                                sourceIndex,
                                                index,
                                                "actor",
                                                event.target.value,
                                              )
                                            }
                                            placeholder="Actor"
                                            className="min-w-0 rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-cyan-500/50"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            dropEditableWebRole(source, sourceIndex, index)
                                          }
                                          className="rounded border border-rose-500/25 px-1.5 py-1 text-[10px] text-rose-100 transition hover:bg-rose-950/25"
                                        >
                                          Drop
                                        </button>
                                      </div>
                                      <input
                                        value={role.role || ""}
                                        onChange={(event) =>
                                          updateEditableWebRole(
                                            source,
                                            sourceIndex,
                                            index,
                                            "role",
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Role labels, comma separated"
                                        className="mt-1 w-full rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] text-cyan-100/80 outline-none focus:border-cyan-500/50"
                                      />
                                      <textarea
                                        value={role.description || ""}
                                        onChange={(event) =>
                                          updateEditableWebRole(
                                            source,
                                            sourceIndex,
                                            index,
                                            "description",
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Short role description"
                                        rows={2}
                                        className="mt-1 w-full rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-400 outline-none focus:border-cyan-500/50"
                                      />
                                    </div>
                                  ))
                                ) : (
                                  <div>Not available</div>
                                )}
                              </div>
                            </div>
                            <div className="rounded bg-slate-950/30 px-2 py-1.5">
                              <div className={fieldLabelClass}>Production crew</div>
                              <div className="max-h-28 overflow-y-auto whitespace-pre-wrap pr-1 text-xs leading-relaxed text-slate-300">
                                {(source.fields?.production_crew || [])
                                  .map(formatWebProductionCrew)
                                  .filter(Boolean)
                                  .join("\n") || "Not available"}
                              </div>
                            </div>
                            <div className="rounded bg-slate-950/30 px-2 py-1.5">
                              <div className={fieldLabelClass}>Narrative agents / world</div>
                              <div className="max-h-28 overflow-y-auto pr-1 text-xs leading-relaxed text-slate-300">
                                {[
                                  ...(source.fields?.persons || []),
                                  ...(source.fields?.places || []),
                                  ...(source.fields?.dates || []),
                                ].join(", ") || "Not available"}
                              </div>
                            </div>
                            <div className="rounded bg-slate-950/30 px-2 py-1.5 md:col-span-2">
                              <div className={fieldLabelClass}>Operational cues</div>
                              <div className="max-h-20 overflow-y-auto pr-1 text-xs leading-relaxed text-slate-300">
                                {(source.fields?.keywords || []).join(", ") || "Not available"}
                              </div>
                            </div>
                          </div>
                          {(source.fields?.character_roles || []).length > 0 ||
                          (source.fields?.persons || []).length > 0 ||
                          (source.fields?.keywords || []).length > 0 ? (
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-500/10 bg-slate-950/20 px-2 py-2">
                              <div className="text-[11px] text-slate-500">
                                Stage narrative agents, roles, and operational cues into governed metadata before saving.
                              </div>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => applyWebSourceNarrativeMetadata(source, sourceIndex)}
                                className="rounded border border-cyan-500/30 px-2 py-1 text-[11px] text-cyan-100 transition hover:bg-cyan-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isSaving ? "Saving..." : "Use narrative metadata"}
                              </button>
                            </div>
                          ) : null}
                          {visibleWebMetadataCandidates(source).length > 0 ? (
                            <div className="mt-2 overflow-x-auto">
                              <table className="w-full min-w-[620px] border-separate border-spacing-y-1 text-left text-xs">
                                <thead className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                                  <tr>
                                    <th className="px-2 py-1 font-medium">Field</th>
                                    <th className="px-2 py-1 font-medium">Value</th>
                                    <th className="px-2 py-1 font-medium">Confidence</th>
                                    <th className="px-2 py-1 font-medium">Review</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleWebMetadataCandidates(source).slice(0, 12).map((candidate, index) => (
                                    <tr
                                      key={`${candidate.field || "field"}-${candidate.value || index}`}
                                      className="bg-slate-900/40"
                                    >
                                      <td className="rounded-l border-y border-l border-slate-800 px-2 py-1.5 text-slate-300">
                                        {candidate.field}
                                      </td>
                                      <td className="border-y border-slate-800 px-2 py-1.5 text-slate-100">
                                        <div className="max-h-20 overflow-y-auto pr-1 leading-relaxed">
                                          {candidate.value}
                                        </div>
                                      </td>
                                      <td className="border-y border-slate-800 px-2 py-1.5 text-slate-400">
                                        {candidate.confidence || "candidate"}
                                      </td>
                                      <td className="rounded-r border-y border-r border-slate-800 px-2 py-1.5 text-slate-500">
                                        {candidate.review_state || "candidate"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ) : null}
            <div className="mt-3 rounded-md border border-slate-700/70 bg-[#151515] px-3 py-3">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpeg,.jpg,.png,.webp,.wav,.mp3,.m4a,.aac,.flac,.ogg"
                onChange={(event) =>
                  setReferenceUploadFiles(Array.from(event.target.files || []))
                }
                className="block w-full text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  {referenceUploadFiles.length} selected
                </div>
                <button
                  type="button"
                  disabled={
                    isUploadingReferences || referenceUploadFiles.length === 0
                  }
                  onClick={() => {
                    void uploadReferenceFiles();
                  }}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploadingReferences ? "Uploading..." : "Upload References"}
                </button>
              </div>
            </div>
            {referenceFiles.length === 0 ? (
              <div className="mt-2 text-sm text-slate-400">
                No reference files attached yet.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {referenceFiles.map((file) => {
                  const href = apiService.getSourceMediaReferenceUrl(
                    file.download_url,
                  );
                  return (
                    <div
                      key={file.stored_filename || file.filename}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-800/35 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-slate-200">
                          {file.filename || file.stored_filename || "Reference file"}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {[file.media_type, file.size_bytes ? `${file.size_bytes} bytes` : null]
                            .filter(Boolean)
                            .join(" • ") || "Attached reference"}
                        </div>
                      </div>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800/60"
                        >
                          Open
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </details>

          <details className={detailClass}>
            <summary className={summaryClass}>
              Character Detection Support
              <span className="ml-2 normal-case tracking-normal text-slate-500">
                indirect source quality signal
              </span>
            </summary>
            <div className="border-t border-slate-800 p-3">
              <div className="text-sm text-slate-200">
              {characterSupport.level}
              <span className="ml-2 text-xs text-slate-400">
                Metadata supports character detection indirectly, not as proof.
              </span>
            </div>

            {characterSupport.supporting.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Supporting
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {characterSupport.supporting.map((item) => (
                    <div
                      key={item}
                      className="rounded-md bg-slate-800/35 px-3 py-2 text-xs text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {characterSupport.constraining.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Constraining
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {characterSupport.constraining.map((item) => (
                    <div
                      key={item}
                      className="rounded-md bg-slate-800/25 px-3 py-2 text-xs text-slate-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </details>

          <details className={detailClass}>
            <summary className={summaryClass}>
              Curated Metadata Fields
              <span className="ml-2 normal-case tracking-normal text-slate-500">
                description, time, space, situation, and audit notes
              </span>
            </summary>
            <div className="border-t border-slate-800 p-3">
            <div className="space-y-2">
              <details open className={subDetailClass}>
                <summary className={subSummaryClass}>Primary Description</summary>
                <div className="space-y-2 border-t border-slate-800 p-3">
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Title
                </div>
                <input
                  value={userTitle}
                  onChange={(e) => setUserTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Scope
                </div>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                >
                  <option value="">Not set</option>
                  <option value="short clip">Short clip</option>
                  <option value="scene / segment">Scene / segment</option>
                  <option value="full recording">Full recording</option>
                  <option value="full episode / film">Full episode / film</option>
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Description
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
                </div>
              </details>
              <details className={subDetailClass}>
                <summary className={subSummaryClass}>People and Identity</summary>
                <div className="space-y-2 border-t border-slate-800 p-3">
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Persons
                </div>
                <input
                  value={persons}
                  onChange={(e) => setPersons(e.target.value)}
                  placeholder="Comma separated"
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Character roles
                </div>
                <textarea
                  value={characterRoles}
                  onChange={(e) => setCharacterRoles(e.target.value)}
                  placeholder="One role per line"
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Relations
                </div>
                <textarea
                  value={relations}
                  onChange={(e) => setRelations(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
                </div>
              </details>
              <details className={subDetailClass}>
                <summary className={subSummaryClass}>Time and Space</summary>
                <div className="space-y-2 border-t border-slate-800 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Location: country
                  </div>
                  <input
                    value={locationCountry}
                    onChange={(e) => setLocationCountry(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Location: city
                  </div>
                  <input
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Location: place
                  </div>
                  <input
                    value={locationPlace}
                    onChange={(e) => setLocationPlace(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Location: room
                  </div>
                  <input
                    value={locationRoom}
                    onChange={(e) => setLocationRoom(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Time: era
                  </div>
                  <input
                    value={timeEra}
                    onChange={(e) => setTimeEra(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Time: year
                  </div>
                  <input
                    value={timeYear}
                    onChange={(e) => setTimeYear(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Time: moment
                  </div>
                  <input
                    value={timeMoment}
                    onChange={(e) => setTimeMoment(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                  />
                </label>
              </div>
                </div>
              </details>
              <details className={subDetailClass}>
                <summary className={subSummaryClass}>Situation and Description Evidence</summary>
                <div className="space-y-2 border-t border-slate-800 p-3">
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Scene / event
                </div>
                <input
                  value={situationEvent}
                  onChange={(e) => setSituationEvent(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Keywords
                </div>
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Comma separated"
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Interaction
                </div>
                <textarea
                  value={interactionDynamics}
                  onChange={(e) => setInteractionDynamics(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Development
                </div>
                <textarea
                  value={narrativeDevelopment}
                  onChange={(e) => setNarrativeDevelopment(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Expression / delivery
                </div>
                <textarea
                  value={performanceExpression}
                  onChange={(e) => setPerformanceExpression(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
                </div>
              </details>
              <details className={subDetailClass}>
                <summary className={subSummaryClass}>Genre and Governance Axes</summary>
                <div className="space-y-2 border-t border-slate-800 p-3">
              <CustomizableSelectField
                label="Genre"
                value={genre}
                onChange={(nextValue) => {
                  setGenre(nextValue);
                  setGenreSubtype("");
                }}
                options={getMediaGenreOptions(genre, sharedTaxonomyOptions)}
                customValue={customTaxonomyInputs.genre}
                onCustomValueChange={(value) =>
                  updateCustomTaxonomyInput("genre", value)
                }
                onAddCustom={() =>
                  applyCustomTaxonomy("genre", "media_genre", (nextValue) => {
                    setGenre(nextValue);
                    setGenreSubtype("");
                  })
                }
                onShareCustom={() =>
                  shareCustomTaxonomy("genre", "media_genre", (nextValue) => {
                    setGenre(nextValue);
                    setGenreSubtype("");
                  })
                }
                learnedLabels={getLearnedTaxonomyLabels("media_genre")}
                onRemoveLearnedLabel={(label) =>
                  removeLearnedTaxonomy("media_genre", label)
                }
              />
              <CustomizableSelectField
                label="Genre subtype"
                value={genreSubtype}
                onChange={setGenreSubtype}
                options={getMediaSubgenreOptions(
                  genre,
                  genreSubtype,
                  sharedTaxonomyOptions,
                )}
                customValue={customTaxonomyInputs.genreSubtype}
                onCustomValueChange={(value) =>
                  updateCustomTaxonomyInput("genreSubtype", value)
                }
                onAddCustom={() =>
                  applyCustomTaxonomy(
                    "genreSubtype",
                    "media_subgenre",
                    setGenreSubtype,
                    genre,
                  )
                }
                onShareCustom={() =>
                  shareCustomTaxonomy(
                    "genreSubtype",
                    "media_subgenre",
                    setGenreSubtype,
                    genre,
                  )
                }
                disabled={!genre}
                emptyLabel={genre ? "Select subtype" : "Choose genre first"}
                customPlaceholder={
                  genre
                    ? "Add custom subtype if needed"
                    : "Choose genre first"
                }
                learnedLabels={getLearnedTaxonomyLabels("media_subgenre", genre)}
                onRemoveLearnedLabel={(label) =>
                  removeLearnedTaxonomy("media_subgenre", label, genre)
                }
              />
              <CustomizableSelectField
                label="Situation type"
                value={situationalGenre}
                onChange={(nextValue) => {
                  setSituationalGenre(nextValue);
                  setSituationalSubtype("");
                }}
                options={getSituationalGenreOptions(
                  situationalGenre,
                  sharedTaxonomyOptions,
                )}
                customValue={customTaxonomyInputs.situationalGenre}
                onCustomValueChange={(value) =>
                  updateCustomTaxonomyInput("situationalGenre", value)
                }
                onAddCustom={() =>
                  applyCustomTaxonomy(
                    "situationalGenre",
                    "situational_genre",
                    (nextValue) => {
                      setSituationalGenre(nextValue);
                      setSituationalSubtype("");
                    },
                  )
                }
                onShareCustom={() =>
                  shareCustomTaxonomy(
                    "situationalGenre",
                    "situational_genre",
                    (nextValue) => {
                      setSituationalGenre(nextValue);
                      setSituationalSubtype("");
                    },
                  )
                }
                learnedLabels={getLearnedTaxonomyLabels("situational_genre")}
                onRemoveLearnedLabel={(label) =>
                  removeLearnedTaxonomy("situational_genre", label)
                }
              />
              <CustomizableSelectField
                label="Situation detail"
                value={situationalSubtype}
                onChange={setSituationalSubtype}
                options={getSituationalSubgenreOptions(
                  situationalGenre,
                  situationalSubtype,
                  sharedTaxonomyOptions,
                )}
                customValue={customTaxonomyInputs.situationalSubtype}
                onCustomValueChange={(value) =>
                  updateCustomTaxonomyInput("situationalSubtype", value)
                }
                onAddCustom={() =>
                  applyCustomTaxonomy(
                    "situationalSubtype",
                    "situational_subgenre",
                    setSituationalSubtype,
                    situationalGenre,
                  )
                }
                onShareCustom={() =>
                  shareCustomTaxonomy(
                    "situationalSubtype",
                    "situational_subgenre",
                    setSituationalSubtype,
                    situationalGenre,
                  )
                }
                disabled={!situationalGenre}
                emptyLabel={
                  situationalGenre
                    ? "Select subtype"
                    : "Choose situational genre first"
                }
                customPlaceholder={
                  situationalGenre
                    ? "Add custom subtype if needed"
                    : "Choose situational genre first"
                }
                learnedLabels={getLearnedTaxonomyLabels(
                  "situational_subgenre",
                  situationalGenre,
                )}
                onRemoveLearnedLabel={(label) =>
                  removeLearnedTaxonomy(
                    "situational_subgenre",
                    label,
                    situationalGenre,
                  )
                }
              />
              <div className="grid gap-3 md:grid-cols-2">
                <CustomizableSelectField
                  label="Privacy"
                  value={privacyAxis}
                  onChange={setPrivacyAxis}
                  options={getPrivacyAxisOptions(
                    privacyAxis,
                    sharedTaxonomyOptions,
                  )}
                  customValue={customTaxonomyInputs.privacyAxis}
                  onCustomValueChange={(value) =>
                    updateCustomTaxonomyInput("privacyAxis", value)
                  }
                  onAddCustom={() =>
                    applyCustomTaxonomy(
                      "privacyAxis",
                      "privacy_axis",
                      setPrivacyAxis,
                    )
                  }
                  onShareCustom={() =>
                    shareCustomTaxonomy(
                      "privacyAxis",
                      "privacy_axis",
                      setPrivacyAxis,
                    )
                  }
                  learnedLabels={getLearnedTaxonomyLabels("privacy_axis")}
                  onRemoveLearnedLabel={(label) =>
                    removeLearnedTaxonomy("privacy_axis", label)
                  }
                />
                <CustomizableSelectField
                  label="Expertise"
                  value={expertiseAxis}
                  onChange={setExpertiseAxis}
                  options={getExpertiseAxisOptions(
                    expertiseAxis,
                    sharedTaxonomyOptions,
                  )}
                  customValue={customTaxonomyInputs.expertiseAxis}
                  onCustomValueChange={(value) =>
                    updateCustomTaxonomyInput("expertiseAxis", value)
                  }
                  onAddCustom={() =>
                    applyCustomTaxonomy(
                      "expertiseAxis",
                      "expertise_axis",
                      setExpertiseAxis,
                    )
                  }
                  onShareCustom={() =>
                    shareCustomTaxonomy(
                      "expertiseAxis",
                      "expertise_axis",
                      setExpertiseAxis,
                    )
                  }
                  learnedLabels={getLearnedTaxonomyLabels("expertise_axis")}
                  onRemoveLearnedLabel={(label) =>
                    removeLearnedTaxonomy("expertise_axis", label)
                  }
                />
              </div>
                </div>
              </details>
              <details className={subDetailClass}>
                <summary className={subSummaryClass}>References and Audit</summary>
                <div className="space-y-2 border-t border-slate-800 p-3">
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  References
                </div>
                <textarea
                  value={references}
                  onChange={(e) => setReferences(e.target.value)}
                  rows={3}
                  placeholder="One per line"
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <div className="rounded-md border border-emerald-500/20 bg-emerald-950/10 px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-emerald-100/75">
                    Reference speakers
                  </div>
                  <button
                    type="button"
                    onClick={addReferenceSpeaker}
                    className="rounded border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-100 transition hover:bg-emerald-900/20"
                  >
                    Add speaker
                  </button>
                </div>
                {referenceSpeakers.length === 0 ? (
                  <div className="text-[11px] text-slate-400">
                    Add speaker reference rows after attaching voice samples or source references.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {referenceSpeakers.map((speaker, index) => (
                      <div
                        key={index}
                        className="rounded border border-white/8 bg-[#141414] p-2"
                      >
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            value={speaker.speaker_label}
                            onChange={(event) =>
                              updateReferenceSpeaker(
                                index,
                                "speaker_label",
                                event.target.value,
                              )
                            }
                            placeholder="Speaker label"
                            className="rounded border border-slate-700 bg-[#171717] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/50"
                          />
                          <input
                            value={speaker.identity_label}
                            onChange={(event) =>
                              updateReferenceSpeaker(
                                index,
                                "identity_label",
                                event.target.value,
                              )
                            }
                            placeholder="Person identity"
                            className="rounded border border-slate-700 bg-[#171717] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/50"
                          />
                          <input
                            value={speaker.relation}
                            onChange={(event) =>
                              updateReferenceSpeaker(
                                index,
                                "relation",
                                event.target.value,
                              )
                            }
                            placeholder="Relation to source"
                            className="rounded border border-slate-700 bg-[#171717] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/50"
                          />
                          <select
                            value={speaker.reference_file}
                            onChange={(event) =>
                              updateReferenceSpeaker(
                                index,
                                "reference_file",
                                event.target.value,
                              )
                            }
                            className="rounded border border-slate-700 bg-[#171717] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/50"
                          >
                            <option value="">Reference file</option>
                            {referenceFiles.map((file) => (
                              <option
                                key={file.stored_filename || file.filename}
                                value={file.stored_filename || file.filename || ""}
                              >
                                {file.filename || file.stored_filename}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <input
                            value={speaker.notes}
                            onChange={(event) =>
                              updateReferenceSpeaker(
                                index,
                                "notes",
                                event.target.value,
                              )
                            }
                            placeholder="Reference note"
                            className="min-w-0 flex-1 rounded border border-slate-700 bg-[#171717] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/50"
                          />
                          <button
                            type="button"
                            onClick={() => removeReferenceSpeaker(index)}
                            className="rounded border border-rose-500/30 px-2 py-1 text-[10px] text-rose-200 transition hover:bg-rose-900/20"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Reference relation
                </div>
                <input
                  value={referenceRelation}
                  onChange={(e) => setReferenceRelation(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Reference source
                </div>
                <input
                  value={referenceSource}
                  onChange={(e) => setReferenceSource(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Confidence
                </div>
                <select
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                >
                  <option value="">Not set</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Notes
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Editor notes
                </div>
                <textarea
                  value={editorNotes}
                  onChange={(e) => setEditorNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Source context
                </div>
                <textarea
                  value={sourceContext}
                  onChange={(e) => setSourceContext(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Provenance notes
                </div>
                <textarea
                  value={provenanceNotes}
                  onChange={(e) => setProvenanceNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void saveMetadata();
                  }}
                  disabled={isSaving}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Metadata Notes"}
                </button>
                {saveMessage ? (
                  <span className="text-xs text-slate-400">{saveMessage}</span>
                ) : null}
              </div>
            </div>
              </details>
            </div>
            </div>
          </details>
        </>
      )}
    </main>
  );
}
