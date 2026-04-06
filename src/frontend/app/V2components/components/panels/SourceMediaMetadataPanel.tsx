import { useEffect, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { apiService, type SourceMediaMetadata } from "@/lib/api-service";

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
  const [references, setReferences] = useState("");
  const [referenceRelation, setReferenceRelation] = useState("");
  const [referenceSource, setReferenceSource] = useState("");
  const [confidence, setConfidence] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
        setReferences("");
        setReferenceRelation("");
        setReferenceSource("");
        setConfidence("");
        setNotes("");
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
        setReferences((nextMetadata.user_annotations?.references || []).join("\n"));
        setReferenceRelation(nextMetadata.user_annotations?.reference_relation || "");
        setReferenceSource(nextMetadata.user_annotations?.reference_source || "");
        setConfidence(nextMetadata.user_annotations?.confidence || "");
        setNotes(nextMetadata.user_annotations?.notes || "");
      } catch (error) {
        console.error("Failed to load source media metadata:", error);
        setMetadata(null);
      }
    }
    void load();
  }, [videoId]);

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
        references: references
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
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
                  Situation / event
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
                  Interaction dynamics
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
                  Narrative / situation development
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
                  Performance / expression
                </div>
                <textarea
                  value={performanceExpression}
                  onChange={(e) => setPerformanceExpression(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  Genre
                </div>
                <input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                />
              </label>
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
