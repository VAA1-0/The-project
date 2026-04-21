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

export default function SourceMediaMetadataPanel() {
  const [videoId, setVideoId] = useState("");
  const [metadata, setMetadata] = useState<SourceMediaMetadata | null>(null);
  const [editorNotes, setEditorNotes] = useState("");
  const [sourceContext, setSourceContext] = useState("");
  const [provenanceNotes, setProvenanceNotes] = useState("");
  const [userTitle, setUserTitle] = useState("");
  const [scope, setScope] = useState("");
  const [description, setDescription] = useState("");
  const [persons, setPersons] = useState("");
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
    eventBus.on("videoIdChanged", handler);
    return () => {
      eventBus.off("videoIdChanged", handler);
    };
  }, []);

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
  }, [videoId]);

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
  const referenceFiles = metadata?.user_annotations?.reference_files || [];

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
          <div className="mt-3 rounded-lg bg-slate-700/20 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
              Media Facts
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {coreRows.map(([label, value]) => (
                <div key={label} className="rounded-md bg-slate-800/35 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    {label}
                  </div>
                  <div className="mt-1 text-sm text-slate-200 break-words">
                    {formatValue(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-slate-700/20 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
              Reference Files
            </div>
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

          <div className="mt-3 rounded-lg bg-slate-700/20 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
              Character Detection Support
            </div>
            <div className="mt-2 text-sm text-slate-200">
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

          <div className="mt-3 rounded-lg bg-slate-700/20 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
              Added Information
            </div>
            <div className="mt-3 space-y-3">
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
                  Relations
                </div>
                <textarea
                  value={relations}
                  onChange={(e) => setRelations(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
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
          </div>
        </>
      )}
    </main>
  );
}
