import { useCallback, useEffect, useMemo, useState } from "react";
import { apiService } from "@/lib/api-service";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { individualNarrativeAgentLabel } from "@/lib/narrative-agent-registry";
import { openVideoAtTime } from "@/lib/video-navigation";

type Occurrence = {
  occurrence_id: string;
  analysis_id: string;
  hermeneutic_space_id?: string;
  narrative_agent_label?: string;
  evidence_modality?: string;
  authority?: string;
  membership_state?: string;
  scene_id?: string;
  source_interval?: { start?: number; end?: number };
  source_geometry?: Record<string, unknown> | null;
};

type SourceIntervalSuggestion = {
  modality: "audio" | "transcript_audio";
  start: number;
  end: number;
  sourceRef?: string;
  transcriptText?: string;
};

type RelationTicket = {
  ticket_id: string;
  edge_id: string;
  assertion_id: string;
  subject_node_id?: string;
  predicate: string;
  object_node_id?: string;
  state: string;
  authority?: string;
  allowed_decisions?: string[];
  warrant?: string;
  alternatives?: string[];
  uncertainty?: string;
  analyst_meaning?: string;
  evidence_refs?: Array<{ time_range?: { start?: number; end?: number }; analysis_id?: string }>;
  source_navigation?: {
    analysis_id?: string;
    source_interval?: { start?: number; end?: number };
    return_panel?: string;
    return_ticket_id?: string;
    preserve_review_position?: boolean;
  } | null;
};

type ConstellationalDialogueCandidate = {
  label?: string;
  probability?: number;
  probability_basis?: {
    method?: string;
    temporal_distance_seconds?: number;
    audio_bearing_modalities?: number;
    calibration?: string;
  };
};

type ConstellationalLayer = {
  state?: string;
  claims?: string[];
  candidates?: ConstellationalDialogueCandidate[];
  reason?: string | null;
  scene_presence_estimates?: Array<{ scene_id?: string; presence_probability?: number; state?: string; independent_modalities?: string[] }>;
};

type ConstellationalSnapshot = {
  revision?: string;
  layers?: Record<string, ConstellationalLayer>;
};

type AudioMatchSuggestion = {
  candidate_id: string;
  analysis_id: string;
  hermeneutic_space_id?: string;
  source_interval?: { start?: number; end?: number };
  speaker_label?: string;
  transcript_text?: string;
  comparison_score?: number | null;
  comparison_state?: string;
  eligible_for_confirmation?: boolean;
  decision_state?: string;
  maturity?: string;
};

type ContinuityPayload = {
  project_id: string;
  analysis_id: string;
  collection_id: string;
  analysis_artifacts?: Array<{ analysis_id: string; filename?: string }>;
  inventory?: {
    summary?: Record<string, number>;
    selected_agent?: { confirmed_roles?: string[]; role_authority?: string; role_probability?: number | null };
    confirmed_agents?: Array<{ narrative_agent_label?: string; authority?: string; confirmation_scope?: string }>;
    confirmed_occurrences?: Occurrence[];
    selected_continuity_corridor?: { proposed_members?: Occurrence[] };
    diagnostics?: Record<string, unknown[]>;
  };
  decision_projection?: {
    included_occurrence_ids?: string[];
    excluded_occurrence_ids?: string[];
    deferred_occurrence_ids?: string[];
    active_decision_ids?: string[];
    collection_confirmation?: unknown;
  };
  continuity_projection?: {
    revision?: string;
    canonical_collection?: {
      continuity_claim?: string;
      maturity?: string;
      member_occurrence_ids?: string[];
      blocking_diagnostics?: unknown[];
      automatic_mature_occurrence_ids?: string[];
    };
    graph_projection?: {
      revision?: string;
      nodes?: Array<Record<string, unknown>>;
      edges?: Array<Record<string, unknown>>;
      relation_tickets?: RelationTicket[];
    };
    constellational_snapshot?: ConstellationalSnapshot;
    audio_sample_matching?: {
      confirmed_seed_samples?: Array<{ seed_id: string; analysis_id: string; source_interval?: { start?: number; end?: number }; maturity?: string }>;
      suggestions?: AudioMatchSuggestion[];
      aggregate_support?: { measured_match_count?: number; probable_match_count?: number; independent_probable_match_count?: number; correlated_representation_count?: number; aggregate_probability?: number | null; state?: string };
      active_speaker_synchrony?: { state?: string; reason?: string };
    };
  } | null;
};

const modalityLabels: Record<string, string> = {
  visual: "Visual",
  audio: "Audio",
  transcript_audio: "Transcript + audio",
  scene_presence: "Scene presence",
  body_movement: "Body movement",
};

function stamp(value: unknown): string {
  const seconds = Number(value || 0);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Continuity operation failed";
  try {
    const parsed = JSON.parse(error.message);
    return String(parsed.detail || error.message);
  } catch {
    return error.message;
  }
}

function publishSaloonDoors(analysisIds: string[], detail: Record<string, unknown>) {
  for (const analysisId of analysisIds) {
    eventBus.emit("analysisCorrectionsChanged", { analysisId, ...detail });
  }
  eventBus.emit("narrativeAgentContinuityUpdated", detail);
  eventBus.emit("matureDataProliferated", detail);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vaa1-narrative-agent-continuity-updated", { detail }));
  }
}

export default function NarrativeAgentContinuityWorkbench({
  projectId,
  analysisId,
  agentLabels,
  sourceIntervals = [],
}: {
  projectId: string;
  analysisId: string;
  agentLabels: string[];
  sourceIntervals?: SourceIntervalSuggestion[];
}) {
  const [agent, setAgent] = useState("");
  const [payload, setPayload] = useState<ContinuityPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [modality, setModality] = useState("scene_presence");
  const [start, setStart] = useState("0.000");
  const [end, setEnd] = useState("0.000");
  const [sourceRef, setSourceRef] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [movementType, setMovementType] = useState("");
  const [movementIntensity, setMovementIntensity] = useState("");
  const [poseRef, setPoseRef] = useState("");
  const [visualBox, setVisualBox] = useState({ x: "", y: "", w: "", h: "" });
  const [note, setNote] = useState("");
  const [relatedCollection, setRelatedCollection] = useState("");
  const [relationDrafts, setRelationDrafts] = useState<Record<string, string>>({});
  const [activeRelationTicketId, setActiveRelationTicketId] = useState("");
  const [reviewHydratedKey, setReviewHydratedKey] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [selectedAudioMatches, setSelectedAudioMatches] = useState<Set<string>>(new Set());
  const [audioDecisionReceipts, setAudioDecisionReceipts] = useState<Record<string, { state: string; revision?: string }>>({});
  const [sourceDecisionReceipts, setSourceDecisionReceipts] = useState<Record<string, { state: string; revision?: string; maturity: string }>>({});
  const reviewStorageKey = `vaa1.continuity-review.${projectId}.${analysisId}.${agent.trim().toLocaleLowerCase()}`;

  useEffect(() => {
    if (typeof window === "undefined" || !agent.trim()) return;
    try {
      const restored = JSON.parse(window.localStorage.getItem(reviewStorageKey) || "{}");
      setActiveRelationTicketId(String(restored.activeRelationTicketId || ""));
      setRelationDrafts(restored.relationDrafts && typeof restored.relationDrafts === "object" ? restored.relationDrafts : {});
    } catch {
      setActiveRelationTicketId("");
      setRelationDrafts({});
    }
    setReviewHydratedKey(reviewStorageKey);
  }, [agent, reviewStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || reviewHydratedKey !== reviewStorageKey) return;
    window.localStorage.setItem(reviewStorageKey, JSON.stringify({ activeRelationTicketId, relationDrafts }));
  }, [activeRelationTicketId, relationDrafts, reviewHydratedKey, reviewStorageKey]);

  const publishAgentSelection = (label: string) => {
    const next = label.trim();
    if (!next) return;
    eventBus.emit("narrativeAgentSelectionChanged", {
      analysisId,
      label: next,
      source: "continuity_workbench",
    });
  };

  useEffect(() => {
    if (agent) return;
    setAgent(agentLabels.find((label) => label.toLowerCase() === "james bond") || agentLabels[0] || "");
  }, [agent, agentLabels]);

  useEffect(() => {
    const handler = (payload: { analysisId?: string; label?: string; source?: string }) => {
      if (payload.analysisId !== analysisId || payload.source === "continuity_workbench") return;
      const next = String(payload.label || "").trim();
      if (next && next.localeCompare(agent, undefined, { sensitivity: "base" }) !== 0) {
        setAgent(next);
      }
    };
    eventBus.on("narrativeAgentSelectionChanged", handler);
    return () => eventBus.off("narrativeAgentSelectionChanged", handler);
  }, [agent, analysisId]);

  useEffect(() => {
    const onClock = (value: number) => {
      const next = Number(value);
      if (!Number.isFinite(next)) return;
      setCursor(next);
      const matching = sourceIntervals
        .filter((interval) => interval.modality === modality && interval.start <= next + 0.05 && interval.end >= next - 0.05)
        .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
      if (matching) {
        setStart(matching.start.toFixed(3));
        setEnd(matching.end.toFixed(3));
        setSourceRef(matching.sourceRef || "");
        if (matching.transcriptText) setTranscriptText(matching.transcriptText);
        setEditorOpen(true);
        setMessage(`Detected ${modalityLabels[matching.modality]} interval raised from the global-clock beat. Review or adjust before confirming.`);
      } else {
        setStart(next.toFixed(3));
        setEnd(next.toFixed(3));
      }
    };
    eventBus.on("videoTimeLineChanged", onClock);
    const retained = eventBus.getLast<number>("videoTimeLineChanged");
    if (Number.isFinite(Number(retained))) onClock(Number(retained));
    return () => eventBus.off("videoTimeLineChanged", onClock);
  }, [modality, sourceIntervals]);

  const selectModality = (nextModality: string) => {
    setModality(nextModality);
    const matching = sourceIntervals
      .filter((interval) => interval.modality === nextModality && interval.start <= cursor + 0.05 && interval.end >= cursor - 0.05)
      .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
    if (!matching) return;
    setStart(matching.start.toFixed(3));
    setEnd(matching.end.toFixed(3));
    setSourceRef(matching.sourceRef || "");
    setTranscriptText(matching.transcriptText || "");
    setEditorOpen(true);
    setMessage(`Detected ${modalityLabels[matching.modality]} interval raised from the global-clock beat. Review or adjust before confirming.`);
  };

  const refresh = useCallback(async () => {
    if (!projectId || !analysisId || !agent.trim()) return;
    setBusy(true);
    try {
      setPayload((await apiService.getNarrativeAgentContinuity(projectId, analysisId, agent.trim())) as ContinuityPayload);
    } catch (error) {
      setPayload(null);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [agent, analysisId, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const artifacts = payload?.analysis_artifacts || [];
  const availableAgentLabels = useMemo(() => {
    const labels = new Map<string, string>();
    const add = (value: unknown) => {
      const label = individualNarrativeAgentLabel(value);
      const identityKey = label.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      if (label && identityKey && !labels.has(identityKey)) labels.set(identityKey, label);
    };
    agentLabels.forEach(add);
    (payload?.inventory?.confirmed_agents || []).forEach((row) => add(row.narrative_agent_label));
    (payload?.inventory?.confirmed_occurrences || []).forEach((row) => add(row.narrative_agent_label));
    return [...labels.values()].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  }, [agentLabels, payload]);
  const selectedKnownAgent = availableAgentLabels.find(
    (label) => label.localeCompare(agent.trim(), undefined, { sensitivity: "base" }) === 0,
  ) || "";
  const occurrences = useMemo(() => {
    const confirmed = payload?.inventory?.confirmed_occurrences || [];
    const proposed = payload?.inventory?.selected_continuity_corridor?.proposed_members || [];
    const seen = new Set<string>();
    return [...confirmed, ...proposed].filter((row) => {
      if (seen.has(row.occurrence_id)) return false;
      seen.add(row.occurrence_id);
      return row.narrative_agent_label?.toLowerCase() === agent.trim().toLowerCase();
    });
  }, [agent, payload]);
  const included = new Set(payload?.decision_projection?.included_occurrence_ids || []);
  const automaticMature = new Set(payload?.continuity_projection?.canonical_collection?.automatic_mature_occurrence_ids || []);
  const excluded = new Set(payload?.decision_projection?.excluded_occurrence_ids || []);
  const deferred = new Set(payload?.decision_projection?.deferred_occurrence_ids || []);
  const relationTickets = payload?.continuity_projection?.graph_projection?.relation_tickets || [];
  const activeArtifact = artifacts.find((artifact) => artifact.analysis_id === analysisId) || {
    analysis_id: analysisId,
    filename: analysisId,
  };
  const activeOccurrences = occurrences.filter((row) => row.analysis_id === analysisId);
  const activeRelationTickets = relationTickets.filter((ticket) =>
    (ticket.evidence_refs || []).some((evidence) => evidence.analysis_id === analysisId),
  );

  const openRelationSource = (ticket: RelationTicket) => {
    const navigation = ticket.source_navigation;
    const evidence = ticket.evidence_refs?.[0];
    const targetAnalysisId = navigation?.analysis_id || evidence?.analysis_id;
    const targetStart = navigation?.source_interval?.start ?? evidence?.time_range?.start;
    setActiveRelationTicketId(ticket.ticket_id);
    if (targetAnalysisId) openVideoAtTime(targetAnalysisId, Number(targetStart || 0));
  };
  const constellationalSnapshot = payload?.continuity_projection?.constellational_snapshot;
  const constellationalLayers = constellationalSnapshot?.layers || {};
  const audioMatching = payload?.continuity_projection?.audio_sample_matching;
  const aggregateAudioSupport = audioMatching?.aggregate_support;
  const activeSpeakerSynchrony = audioMatching?.active_speaker_synchrony;
  const activeAudioSeeds = (audioMatching?.confirmed_seed_samples || []).filter((seed) => seed.analysis_id === analysisId);
  const confirmedMetadataRoles = payload?.inventory?.selected_agent?.confirmed_roles || [];
  const audioSuggestions = (audioMatching?.suggestions || []).filter(
    (candidate) => candidate.analysis_id === analysisId && (!candidate.hermeneutic_space_id || candidate.hermeneutic_space_id === analysisId),
  );
  const comparisonRows = artifacts.map((artifact) => {
    const rows = occurrences.filter((row) => row.analysis_id === artifact.analysis_id);
    const starts = rows.map((row) => Number(row.source_interval?.start)).filter(Number.isFinite);
    const ends = rows.map((row) => Number(row.source_interval?.end)).filter(Number.isFinite);
    return {
      ...artifact,
      rows,
      includedCount: rows.filter((row) => included.has(row.occurrence_id)).length,
      modalities: [...new Set(rows.map((row) => modalityLabels[row.evidence_modality || "visual"] || row.evidence_modality || "Visual"))],
      first: starts.length ? Math.min(...starts) : null,
      last: ends.length ? Math.max(...ends) : null,
    };
  });

  const decideRelation = async (
    ticket: RelationTicket,
    operation: "confirm_relation" | "revise_relation" | "reject_relation" | "defer_relation",
  ) => {
    if (!payload) return;
    setBusy(true);
    setMessage("");
    try {
      const result = (await apiService.decideNarrativeAgentContinuity(projectId, {
        analysis_id: ticket.evidence_refs?.[0]?.analysis_id || analysisId,
        agent: agent.trim(),
        collection_id: payload.collection_id,
        operation,
        edge_id: ticket.edge_id,
        analyst_meaning: relationDrafts[ticket.ticket_id] || ticket.analyst_meaning || "",
        created_by: "datascene_analyst",
      })) as { continuity_projection?: ContinuityPayload["continuity_projection"]; content_checksum?: string };
      publishSaloonDoors(artifacts.map((item) => item.analysis_id), {
        projectId,
        analysisId,
        analysisIds: artifacts.map((item) => item.analysis_id),
        collectionId: payload.collection_id,
        revision: result.continuity_projection?.revision,
        graphProjection: result.continuity_projection?.graph_projection,
        constellationalSnapshot: result.continuity_projection?.constellational_snapshot,
      });
      await refresh();
      setMessage(`Relation ticket saved · ${operation.replace("_relation", "")} · revision ${String(result.continuity_projection?.revision || "").slice(0, 12)}.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const decideAudioMatches = async (
    operation: "confirm_audio_match" | "reject_audio_match" | "defer_audio_match",
    candidateIds: string[],
  ) => {
    if (!payload || !candidateIds.length) return;
    setBusy(true);
    setMessage("");
    try {
      let latest: { continuity_projection?: ContinuityPayload["continuity_projection"] } | null = null;
      for (const candidateId of candidateIds) {
        latest = await apiService.decideNarrativeAgentContinuity(projectId, {
          analysis_id: analysisId,
          agent: agent.trim(),
          collection_id: payload.collection_id,
          operation,
          candidate_id: candidateId,
          created_by: "datascene_analyst",
        }) as { continuity_projection?: ContinuityPayload["continuity_projection"] };
      }
      const savedState = operation === "confirm_audio_match" ? "confirmed" : operation === "reject_audio_match" ? "rejected" : "deferred";
      const savedRevision = latest?.continuity_projection?.revision;
      setAudioDecisionReceipts((current) => ({
        ...current,
        ...Object.fromEntries(candidateIds.map((candidateId) => [candidateId, { state: savedState, revision: savedRevision }])),
      }));
      setSelectedAudioMatches(new Set());
      publishSaloonDoors(artifacts.map((item) => item.analysis_id), {
        projectId, analysisId, collectionId: payload.collection_id,
        revision: latest?.continuity_projection?.revision,
        audioSampleMatching: latest?.continuity_projection?.audio_sample_matching,
      });
      await refresh();
      setMessage(`${candidateIds.length} audio match decision${candidateIds.length === 1 ? "" : "s"} saved · ${operation.replace("_audio_match", "")}.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (
    operation: string,
    options: { occurrence?: Occurrence; targetKind?: string; targetDecisionId?: string; related?: string[] } = {},
  ) => {
    if (!payload) return;
    if (options.occurrence?.source_interval) {
      openVideoAtTime(options.occurrence.analysis_id, Number(options.occurrence.source_interval.start || 0));
    }
    setBusy(true);
    setMessage("");
    try {
      const result = (await apiService.decideNarrativeAgentContinuity(projectId, {
        analysis_id: options.occurrence?.analysis_id || analysisId,
        agent: agent.trim(),
        collection_id: payload.collection_id,
        operation,
        occurrence_id: options.occurrence?.occurrence_id,
        target_kind: options.targetKind,
        target_decision_id: options.targetDecisionId,
        related_collection_ids: options.related,
        created_by: "datascene_analyst",
      })) as { continuity_projection?: ContinuityPayload["continuity_projection"]; content_checksum?: string };
      const revision = result?.continuity_projection?.revision;
      if (options.occurrence) {
        const state = operation === "include" || operation === "confirm" ? "confirmed" : operation === "exclude" || operation === "reject" ? "rejected" : "deferred";
        setSourceDecisionReceipts((current) => ({
          ...current,
          [options.occurrence!.occurrence_id]: { state, revision, maturity: state === "confirmed" ? "mature" : state },
        }));
        eventBus.emit("confirmationNavigationUpdated", {
          analysisId: options.occurrence.analysis_id,
          occurrenceId: options.occurrence.occurrence_id,
          modality: options.occurrence.evidence_modality,
          sourceInterval: options.occurrence.source_interval,
          state,
          maturity: state === "confirmed" ? "mature_user_confirmation" : state,
          revision,
        });
      }
      setMessage(`Save committed${revision ? ` · revision ${String(revision).slice(0, 12)}` : ""}${result.content_checksum ? ` · checksum ${result.content_checksum.slice(0, 12)}` : ""}.`);
      publishSaloonDoors(artifacts.map((item) => item.analysis_id), {
        projectId,
        collectionId: payload.collection_id,
        revision,
        analysisIds: artifacts.map((item) => item.analysis_id),
        graphProjection: result?.continuity_projection?.graph_projection,
        constellationalSnapshot: result?.continuity_projection?.constellational_snapshot,
      });
      await refresh();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmEvidence = async () => {
    const parsedStart = Number(start);
    const parsedEnd = Number(end);
    const parsedBox = {
      x: Number(visualBox.x), y: Number(visualBox.y), w: Number(visualBox.w), h: Number(visualBox.h),
    };
    if (!agent.trim() || !Number.isFinite(parsedStart) || !Number.isFinite(parsedEnd)) {
      setMessage("Narrative Agent and a valid source-clock interval are required.");
      return;
    }
    if (["visual", "body_movement"].includes(modality) && (
      !Object.values(parsedBox).every(Number.isFinite) || parsedBox.x < 0 || parsedBox.y < 0 ||
      parsedBox.w <= 0 || parsedBox.h <= 0 || parsedBox.x + parsedBox.w > 1 || parsedBox.y + parsedBox.h > 1
    )) {
      setMessage(`${modality === "body_movement" ? "Body movement" : "Visual"} input requires normalized X/Y/W/H BBox coordinates between 0 and 1.`);
      return;
    }
    if (modality === "body_movement" && !movementType.trim()) {
      setMessage("Body movement input requires a movement type.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = (await apiService.confirmNarrativeAgentContinuityEvidence(projectId, {
        evidence_id: `continuity-ui-${crypto.randomUUID()}`,
        analysis_id: analysisId,
        agent: agent.trim(),
        modality,
        start_seconds: parsedStart,
        end_seconds: parsedEnd,
        source_ref: sourceRef,
        scene_id: sceneId,
        transcript_text: transcriptText,
        coordinates: ["visual", "body_movement"].includes(modality) ? parsedBox : undefined,
        movement_type: modality === "body_movement" ? movementType.trim() : undefined,
        movement_intensity: modality === "body_movement" && movementIntensity.trim() ? Number(movementIntensity) : undefined,
        pose_ref: modality === "body_movement" ? poseRef.trim() : undefined,
        note,
        created_by: "datascene_analyst",
      })) as {
        evidence_id?: string;
        status?: string;
        save_committed?: boolean;
        duplicate_of?: string;
        continuity_projection?: ContinuityPayload["continuity_projection"];
      };
      publishSaloonDoors(artifacts.map((item) => item.analysis_id), {
        projectId,
        analysisId,
        evidenceId: result.evidence_id,
        modality,
        analysisIds: artifacts.map((item) => item.analysis_id),
        revision: result.continuity_projection?.revision,
        graphProjection: result.continuity_projection?.graph_projection,
        constellationalSnapshot: result.continuity_projection?.constellational_snapshot,
      });
      await refresh();
      setSourceRef("");
      setSceneId("");
      setTranscriptText("");
      setMovementType("");
      setMovementIntensity("");
      setPoseRef("");
      setVisualBox({ x: "", y: "", w: "", h: "" });
      setNote("");
      setEditorOpen(false);
      const committedId = result.evidence_id || result.duplicate_of;
      setMessage(
        `${result.status === "unchanged" ? "Source confirmation already committed" : "Source confirmation committed"}` +
        ` · ${modalityLabels[modality] || modality} · ${stamp(parsedStart)}–${stamp(parsedEnd)}` +
        `${committedId ? ` · ${committedId}` : ""}. Mature Master Schema data proliferated to all associated panels.`,
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (!projectId) return null;

  return (
    <section className="mt-3 rounded border border-cyan-900/40 bg-slate-950/30" data-narrative-agent-continuity-workbench="true">
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.13em] text-cyan-200">Narrative Agent continuity graph</div>
            <div className="mt-0.5 text-[10px] text-slate-500">Project corridor · artifact-owned evidence · tracking is never identity authority</div>
          </div>
          <button type="button" disabled={busy} onClick={(event) => { event.preventDefault(); void refresh(); }} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-500">{busy ? "Working…" : "Refresh"}</button>
        </div>
      </div>
      <div className="border-t border-slate-800 p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_auto]">
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Narrative Agent
            <select
              value={selectedKnownAgent}
              onChange={(event) => {
                if (event.target.value) {
                  setAgent(event.target.value);
                  publishAgentSelection(event.target.value);
                }
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-[#171717] px-2 py-1.5 text-xs normal-case text-slate-100"
              data-vaa1-known-narrative-agent-select="true"
              aria-label="Known Narrative Agent"
            >
              <option value="">Select any known agent…</option>
              {availableAgentLabels.map((label) => <option key={label.toLocaleLowerCase()} value={label}>{label}</option>)}
            </select>
            <input
              value={agent}
              onChange={(event) => setAgent(event.target.value)}
              onBlur={(event) => publishAgentSelection(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") publishAgentSelection(event.currentTarget.value);
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-[#171717] px-2 py-1.5 text-xs normal-case text-slate-100"
              placeholder="Or enter a new Narrative Agent"
              autoComplete="off"
              data-vaa1-open-narrative-agent-entry="true"
              aria-label="Narrative Agent identity entry"
            />
            <span className="mt-1 block text-[9px] normal-case text-slate-600">Includes Source Media Metadata identity confirmations and source-confirmed agents; type a new identity when absent.</span>
          </label>
          <div className="rounded border border-slate-800 px-2 py-1.5 text-[10px] text-slate-400">
            <div className="uppercase tracking-wide text-slate-500">Hermetic scope</div>
            <div className="mt-1 break-all text-slate-200">{projectId}</div>
            <div className="mt-0.5 break-all">current artifact {analysisId}</div>
          </div>
          <div className="rounded border border-slate-800 px-2 py-1.5 text-[10px] text-slate-400">
            <div>Active video</div><div>{activeOccurrences.length} source occurrences</div><div>beat {stamp(cursor)}</div>
          </div>
        </div>
        {confirmedMetadataRoles.length ? <div className="mt-2 flex flex-wrap items-center gap-1" data-vaa1-confirmed-metadata-roles="true">
          <span className="text-[9px] text-slate-500">Mature Source Media role</span>
          {confirmedMetadataRoles.map((role) => <span key={role} className="rounded border border-slate-600 bg-slate-800/60 px-1.5 py-0.5 text-[9px] text-slate-100">{role} · 100% confirmed</span>)}
        </div> : null}

        <div className="mt-3 border-y border-slate-800 py-3" aria-label="Active-video Narrative Agent analysis" data-vaa1-active-video-narrative-agent-path="true">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-cyan-200">Active-video Narrative Agent path</div>
          <div className="rounded border border-cyan-900/50 bg-slate-950/50 p-2">
                <button type="button" onClick={() => openVideoAtTime(activeArtifact.analysis_id, Number(activeOccurrences[0]?.source_interval?.start || 0))} className="w-full truncate text-left text-[10px] font-medium text-cyan-100 hover:text-white" title={activeArtifact.filename}>{activeArtifact.filename || activeArtifact.analysis_id}</button>
                <div className="mt-1 truncate text-[9px] text-slate-600" title={activeArtifact.analysis_id}>{activeArtifact.analysis_id}</div>
                <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                  {activeOccurrences.length ? activeOccurrences.map((row) => {
                    const receipt = sourceDecisionReceipts[row.occurrence_id];
                    const state = receipt?.state === "rejected" || excluded.has(row.occurrence_id) ? "excluded" : receipt?.state === "deferred" || deferred.has(row.occurrence_id) ? "deferred" : receipt?.state === "confirmed" || automaticMature.has(row.occurrence_id) || included.has(row.occurrence_id) || row.authority === "explicit_analyst_confirmation" ? "included" : "unreviewed";
                    const isMature = state === "included";
                    return <div key={row.occurrence_id} className={`rounded border p-1.5 transition-colors ${isMature ? "border-slate-600 bg-slate-800/60" : "border-slate-800 bg-slate-900/60"}`} data-continuity-membership={state} data-confirmation-modality={row.evidence_modality || "visual"}>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openVideoAtTime(row.analysis_id, Number(row.source_interval?.start || 0))} className="min-w-0 flex-1 text-left text-[10px] text-slate-200 hover:text-cyan-100" aria-label={`Open ${row.evidence_modality || "visual"} confirmation source`}>
                          {modalityLabels[row.evidence_modality || "visual"] || row.evidence_modality} · {stamp(row.source_interval?.start)}–{stamp(row.source_interval?.end)}
                        </button>
                        {isMature ? <span className="rounded border border-slate-500 bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-100" data-vaa1-confirmation-navigation-receipt="true">Confirmed ✓ · mature{receipt?.revision ? ` · ${receipt.revision.slice(0, 8)}` : ""}</span> : null}
                      </div>
                      <div className="mt-0.5 text-[9px] text-slate-500">{state} · {row.authority}{isMature ? " · Master Schema proliferation" : ""}</div>
                      <div className="mt-1 flex gap-1">
                        {isMature ? <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[9px] text-slate-200">Mature</span> : <button type="button" disabled={busy} onClick={() => void decide("include", { occurrence: row })} className="rounded border border-slate-600 px-1.5 py-0.5 text-[9px] text-slate-200">Confirm</button>}
                        <button type="button" disabled={busy} onClick={() => void decide("exclude", { occurrence: row })} className="rounded border border-rose-900 px-1.5 py-0.5 text-[9px] text-rose-200">Reject</button>
                        <button type="button" disabled={busy} onClick={() => void decide("defer", { occurrence: row })} className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">Defer</button>
                      </div>
                    </div>;
                  }) : <div className="rounded border border-dashed border-slate-800 px-2 py-3 text-center text-[9px] text-slate-600">No {agent || "agent"} evidence in this active video</div>}
                </div>
          </div>
        </div>

        <div className="mt-3 rounded border border-slate-800 bg-slate-950/30" data-vaa1-narrative-agent-comparison="true">
          <button type="button" onClick={() => setComparisonOpen((current) => !current)} className="flex w-full items-center justify-between px-2 py-2 text-left">
            <span><span className="text-[10px] uppercase tracking-wide text-cyan-200">Narrative Agent comparison</span><span className="ml-2 text-[9px] text-slate-500">{artifacts.length} project videos</span></span>
            <span className="text-[10px] text-slate-500">{comparisonOpen ? "Close matrix" : "Open matrix"}</span>
          </button>
          {comparisonOpen ? <div className="overflow-x-auto border-t border-slate-800 p-2">
            <table className="min-w-full text-left text-[9px]" aria-label="Narrative Agent paths across videos">
              <thead className="text-slate-500"><tr><th className="px-2 py-1">Video</th><th className="px-2 py-1">Occurrences</th><th className="px-2 py-1">Mature</th><th className="px-2 py-1">Modalities</th><th className="px-2 py-1">Path span</th><th className="px-2 py-1">Action</th></tr></thead>
              <tbody>{comparisonRows.map((row) => <tr key={row.analysis_id} className={row.analysis_id === analysisId ? "border-t border-cyan-900/60 bg-cyan-950/10" : "border-t border-slate-800"}>
                <td className="max-w-64 truncate px-2 py-1.5 text-slate-200" title={row.filename || row.analysis_id}>{row.filename || row.analysis_id}{row.analysis_id === analysisId ? " · active" : ""}</td>
                <td className="px-2 py-1.5 text-slate-300">{row.rows.length}</td>
                <td className="px-2 py-1.5 text-slate-300">{row.includedCount}</td>
                <td className="px-2 py-1.5 text-slate-400">{row.modalities.join(", ") || "No evidence"}</td>
                <td className="px-2 py-1.5 text-slate-400">{row.first === null ? "—" : `${stamp(row.first)}–${stamp(row.last)}`}</td>
                <td className="px-2 py-1.5"><button type="button" disabled={!row.rows.length} onClick={() => openVideoAtTime(row.analysis_id, Number(row.first || 0))} className="rounded border border-slate-700 px-1.5 py-0.5 text-cyan-200 disabled:text-slate-600">Open path</button></td>
              </tr>)}</tbody>
            </table>
          </div> : null}
        </div>

        <div className="mt-3 rounded border border-cyan-900/50 bg-cyan-950/10 p-2" data-vaa1-narrative-agent-audio-matching="true">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-[10px] uppercase tracking-wide text-cyan-200">Narrative Agent audio sample matches</div><div className="text-[9px] text-slate-500">A confirmed speaker interval is the mature seed. Only audio windows inside this private analyzed artifact may appear here.</div></div>
            <span className="text-[9px] text-slate-500">{activeAudioSeeds.length} mature seed · {audioSuggestions.length} suggestions</span>
          </div>
          {activeAudioSeeds.map((seed) => <button key={seed.seed_id} type="button" onClick={() => openVideoAtTime(seed.analysis_id, Number(seed.source_interval?.start || 0))} className="mt-2 mr-1 rounded border border-emerald-800 px-2 py-1 text-[9px] text-emerald-200">Mature seed · {stamp(seed.source_interval?.start)}–{stamp(seed.source_interval?.end)}</button>)}
          <div className="mt-2 grid gap-1 text-[9px] text-slate-400 sm:grid-cols-2">
            <div className="rounded border border-slate-800 bg-slate-950/40 p-1.5" data-audio-aggregate-state={aggregateAudioSupport?.state || "missing"}>
              Aggregate voice support · {aggregateAudioSupport?.independent_probable_match_count || 0} independent probable match{aggregateAudioSupport?.independent_probable_match_count === 1 ? "" : "es"}
              {typeof aggregateAudioSupport?.aggregate_probability === "number" ? ` · ${Math.round(aggregateAudioSupport.aggregate_probability * 100)}% cumulative candidate probability` : " · awaiting measured voice comparison"}
              {aggregateAudioSupport?.correlated_representation_count ? ` · ${aggregateAudioSupport.correlated_representation_count} duplicate representation(s) counted once` : ""}
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/40 p-1.5" data-active-speaker-synchrony={activeSpeakerSynchrony?.state || "missing"}>
              Lip-sync / active speaker · {activeSpeakerSynchrony?.state === "measured" ? "measured" : "not measured"}
              {activeSpeakerSynchrony?.reason ? ` · ${activeSpeakerSynchrony.reason}` : ""}
            </div>
          </div>
          {audioSuggestions.length ? <>
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {audioSuggestions.map((candidate) => {
                const selected = selectedAudioMatches.has(candidate.candidate_id);
                const receipt = audioDecisionReceipts[candidate.candidate_id];
                const effectiveState = receipt?.state || candidate.decision_state || "unreviewed";
                const confirmed = effectiveState === "confirmed";
                return <div key={candidate.candidate_id} className={`flex items-center gap-2 rounded border p-1.5 transition-colors ${confirmed ? "border-slate-600 bg-slate-800/60" : selected ? "border-cyan-800/70 bg-cyan-950/20" : "border-slate-800 bg-slate-950/50"}`} data-audio-match-state={effectiveState}>
                  <input type="checkbox" checked={selected} disabled={!candidate.eligible_for_confirmation || confirmed} onChange={(event) => setSelectedAudioMatches((current) => { const next = new Set(current); if (event.target.checked) next.add(candidate.candidate_id); else next.delete(candidate.candidate_id); return next; })} aria-label={`Select audio match ${candidate.candidate_id}`} />
                  <button type="button" onClick={() => openVideoAtTime(candidate.analysis_id, Number(candidate.source_interval?.start || 0))} className="min-w-0 flex-1 text-left text-[9px] text-slate-300 hover:text-cyan-100"><span className="text-slate-100">{candidate.speaker_label || "Audio window"}</span> · {stamp(candidate.source_interval?.start)}–{stamp(candidate.source_interval?.end)}{candidate.transcript_text ? ` · ${candidate.transcript_text}` : ""}</button>
                  <span className="text-[9px] text-slate-500">{candidate.comparison_score == null ? "unscored" : `${Math.round(candidate.comparison_score * 100)}% measured`} · {effectiveState}{receipt?.revision ? ` · saved ${receipt.revision.slice(0, 8)}` : ""}</span>
                  <button type="button" disabled={busy || !candidate.eligible_for_confirmation || confirmed} onClick={() => void decideAudioMatches("confirm_audio_match", [candidate.candidate_id])} className={`rounded border px-1.5 py-0.5 text-[9px] ${confirmed ? "border-slate-500 bg-slate-700 text-slate-100" : "border-slate-600 text-slate-200 hover:bg-slate-800"}`}>{confirmed ? "Confirmed ✓" : "Confirm"}</button>
                  <button type="button" disabled={busy} onClick={() => void decideAudioMatches("reject_audio_match", [candidate.candidate_id])} className="rounded border border-rose-900 px-1.5 py-0.5 text-[9px] text-rose-200">Reject</button>
                  <button type="button" disabled={busy} onClick={() => void decideAudioMatches("defer_audio_match", [candidate.candidate_id])} className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">Defer</button>
                </div>;
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <button type="button" onClick={() => setSelectedAudioMatches(new Set(audioSuggestions.filter((row) => row.eligible_for_confirmation && (audioDecisionReceipts[row.candidate_id]?.state || row.decision_state) !== "confirmed").map((row) => row.candidate_id)))} className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">Select all eligible</button>
              <button type="button" disabled={!selectedAudioMatches.size} onClick={() => setSelectedAudioMatches(new Set())} className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">Clear selection</button>
              <span className="self-center px-1 text-[9px] text-slate-400" aria-live="polite">{selectedAudioMatches.size} selected</span>
              <button type="button" disabled={busy || !selectedAudioMatches.size} onClick={() => void decideAudioMatches("confirm_audio_match", [...selectedAudioMatches])} className="rounded border border-slate-600 bg-slate-800/40 px-1.5 py-0.5 text-[9px] text-slate-100">Confirm selected ({selectedAudioMatches.size})</button>
              <button type="button" disabled={busy || !selectedAudioMatches.size} onClick={() => void decideAudioMatches("reject_audio_match", [...selectedAudioMatches])} className="rounded border border-rose-900 px-1.5 py-0.5 text-[9px] text-rose-200">Reject selected</button>
            </div>
          </> : <div className="mt-2 rounded border border-dashed border-slate-800 p-2 text-[9px] text-slate-500">The mature seed is saved. No eligible project audio sample windows are currently available for comparison.</div>}
        </div>

        <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-2" data-vaa1-constellational-dialogue-candidates="true">
          <div className="text-[10px] uppercase tracking-wide text-cyan-200">Constellational snapshot</div>
          <div className="mt-1 text-[9px] text-slate-500">Presence proliferates automatically. Dialogue remains a visible probability-bearing candidate until its semantic relation is reviewed.</div>
          <div className="mt-2 grid gap-1.5 md:grid-cols-2">
            {Object.entries(constellationalLayers).map(([layerKey, layer]) => <div key={layerKey} className="rounded border border-slate-800 bg-slate-950/50 p-2">
              <div className="flex items-center justify-between gap-2"><span className="text-[9px] text-slate-300">{layerKey.replaceAll("_", " ")}</span><span className="text-[9px] text-slate-500">{layer.state || "missing"}</span></div>
              {(layer.claims || []).length ? <div className="mt-1 text-[9px] text-slate-400">{layer.claims?.join(", ")}</div> : null}
              {(layer.candidates || []).map((candidate) => <div key={`${layerKey}:${candidate.label}`} className="mt-1 rounded border border-cyan-950 px-1.5 py-1 text-[9px] text-cyan-100">
                <span>{candidate.label || "Dialogue candidate"}</span>
                {typeof candidate.probability === "number" ? <span className="ml-1 text-cyan-300">{Math.round(candidate.probability * 100)}% constellational probability</span> : null}
                {typeof candidate.probability_basis?.temporal_distance_seconds === "number" ? <span className="ml-1 text-slate-500">· {candidate.probability_basis.temporal_distance_seconds.toFixed(3)}s separation</span> : null}
              </div>)}
              {layer.reason ? <div className="mt-1 text-[9px] text-slate-600">{layer.reason}</div> : null}
            </div>)}
          </div>
        </div>

        {activeRelationTickets.length ? <div className="mt-3 rounded border border-violet-900/50 bg-violet-950/10 p-2" data-vaa1-continuity-relation-tickets="true">
          <div className="text-[10px] uppercase tracking-wide text-violet-200">Editable graph relation tickets</div>
          <div className="mt-1 text-[9px] text-slate-500">Shared by the Narrative Agent and Meaning Knowledge graphs. One decision updates both projections.</div>
          <div className="mt-2 space-y-2">
            {activeRelationTickets.map((ticket) => {
              const needsConfirmation = ticket.allowed_decisions?.includes("confirm") ?? !["mature", "confirmed"].includes(ticket.state);
              return <div key={ticket.ticket_id} className={`rounded border bg-slate-950/50 p-2 ${activeRelationTicketId === ticket.ticket_id ? "border-violet-500/70" : "border-slate-800"}`} data-relation-ticket-state={ticket.state} data-vaa1-active-relation-ticket={activeRelationTicketId === ticket.ticket_id ? "true" : "false"}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => openRelationSource(ticket)} className="text-left text-[10px] font-medium text-violet-100 hover:text-white">{ticket.predicate.replaceAll("_", " ")}</button>
                  <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">{ticket.state} · {ticket.authority}{!needsConfirmation ? " · proliferated" : ""}</span>
                </div>
                {activeRelationTicketId === ticket.ticket_id ? <div className="mt-1 text-[9px] text-violet-300" data-vaa1-review-position-restored="true">Review position retained · source return stays on this ticket</div> : null}
                <div className="mt-1 text-[9px] text-slate-400">{ticket.warrant}</div>
                {ticket.alternatives?.length ? <ul className="mt-1 list-disc pl-4 text-[9px] text-slate-500">{ticket.alternatives.map((alternative) => <li key={alternative}>{alternative}</li>)}</ul> : null}
                <input value={relationDrafts[ticket.ticket_id] ?? ticket.analyst_meaning ?? ""} onChange={(event) => setRelationDrafts((current) => ({ ...current, [ticket.ticket_id]: event.target.value }))} className="mt-2 w-full rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100" placeholder="Analyst account / corrected edge meaning" aria-label={`Analyst meaning for ${ticket.predicate}`} />
                <div className="mt-2 flex flex-wrap gap-1">
                  {needsConfirmation ? <button type="button" disabled={busy} onClick={() => void decideRelation(ticket, "confirm_relation")} className="rounded border border-emerald-800 px-1.5 py-0.5 text-[9px] text-emerald-200">Confirm relation</button> : <span className="rounded border border-slate-600 bg-slate-800/60 px-1.5 py-0.5 text-[9px] text-slate-100">Already mature · no reconfirmation</span>}
                  <button type="button" disabled={busy || !(relationDrafts[ticket.ticket_id] || "").trim()} onClick={() => void decideRelation(ticket, "revise_relation")} className="rounded border border-cyan-800 px-1.5 py-0.5 text-[9px] text-cyan-200">Revise and confirm</button>
                  <button type="button" disabled={busy} onClick={() => void decideRelation(ticket, "reject_relation")} className="rounded border border-rose-900 px-1.5 py-0.5 text-[9px] text-rose-200">Reject relation</button>
                  {needsConfirmation ? <button type="button" disabled={busy} onClick={() => void decideRelation(ticket, "defer_relation")} className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">Defer relation</button> : null}
                </div>
              </div>;
            })}
          </div>
        </div> : null}

        <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-2" data-vaa1-continuity-source-editor={editorOpen ? "open" : "closed"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-[10px] uppercase tracking-wide text-cyan-200/80">Confirm source input at current artifact</div><div className="text-[9px] text-slate-500">Every explicit user confirmation is immediately mature Master Schema data and proliferates to associated panels.</div></div>
            <div className="flex items-center gap-2">
              <div className="text-[9px] text-slate-500">global beat {stamp(cursor)}</div>
              {!editorOpen ? <button type="button" onClick={() => { setStart(cursor.toFixed(3)); setEnd(cursor.toFixed(3)); setEditorOpen(true); setMessage(""); }} className="rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-300">Add another source input</button> : null}
            </div>
          </div>
          {editorOpen ? <div className="mt-2 grid gap-2 md:grid-cols-4">
            <select value={modality} onChange={(event) => selectModality(event.target.value)} className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200">
              <option value="scene_presence">Scene presence</option><option value="visual">Visual input</option><option value="audio">Audio input</option><option value="transcript_audio">Transcript + audio input</option><option value="body_movement">Body movement</option>
            </select>
            <input value={start} onChange={(event) => setStart(event.target.value)} aria-label="Source start seconds" data-vaa1-correctable-suggested-start="true" className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200" placeholder="Start seconds" />
            <input value={end} onChange={(event) => setEnd(event.target.value)} aria-label="Source end seconds" data-vaa1-correctable-suggested-end="true" className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200" placeholder="End seconds" />
            <input value={sceneId} onChange={(event) => setSceneId(event.target.value)} className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200" placeholder="Scene ID (optional)" />
            <input value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200" placeholder="Track / speaker / evidence ref" />
            {["visual", "body_movement"].includes(modality) ? <div className="grid grid-cols-4 gap-1 md:col-span-2" aria-label="Normalized visual BBox coordinates">
              {(["x", "y", "w", "h"] as const).map((axis) => <input key={axis} value={visualBox[axis]} onChange={(event) => setVisualBox((current) => ({ ...current, [axis]: event.target.value }))} aria-label={`BBox ${axis.toUpperCase()}`} className="min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200" placeholder={`${axis.toUpperCase()} 0–1`} />)}
            </div> : null}
            {modality === "transcript_audio" ? <input value={transcriptText} onChange={(event) => setTranscriptText(event.target.value)} className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200 md:col-span-2" placeholder="Confirmed transcript text" /> : null}
            {modality === "body_movement" ? <>
              <input value={movementType} onChange={(event) => setMovementType(event.target.value)} aria-label="Movement type" className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200" placeholder="Movement type" />
              <input value={movementIntensity} onChange={(event) => setMovementIntensity(event.target.value)} inputMode="decimal" className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200" placeholder="Intensity 0–1 (optional)" />
              <input value={poseRef} onChange={(event) => setPoseRef(event.target.value)} className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200" placeholder="Pose / skeleton ref (optional)" />
              <div className="rounded border border-amber-900/50 bg-amber-950/15 px-2 py-1 text-[9px] text-amber-100/75 md:col-span-4">The confirmed body-movement evidence is immediately mature; any later automated interpretation remains a separately governed derived claim.</div>
            </> : null}
            <input value={note} onChange={(event) => setNote(event.target.value)} className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200 md:col-span-2" placeholder="Analyst note (optional)" />
            <button type="button" disabled={busy || !agent.trim()} onClick={() => void confirmEvidence()} className="rounded border border-cyan-700 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/30">{busy ? "Saving…" : "Confirm source input"}</button>
          </div> : <div className="mt-2 rounded border border-emerald-900/60 bg-emerald-950/20 px-2 py-1.5 text-[10px] text-emerald-100" data-vaa1-source-confirmation-closed="true">Entry saved, mature, proliferated, and closed.</div>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {!payload?.decision_projection?.collection_confirmation && occurrences.some((row) => row.authority !== "explicit_analyst_confirmation") ? <button type="button" disabled={busy} onClick={() => void decide("confirm", { targetKind: "collection" })} className="rounded border border-emerald-700 px-2 py-1 text-[10px] text-emerald-100">Confirm legacy candidate collection</button> : null}
          <button type="button" disabled={busy || !(payload?.decision_projection?.active_decision_ids || []).length} onClick={() => { const ids = payload?.decision_projection?.active_decision_ids || []; void decide("undo", { targetDecisionId: ids[ids.length - 1] }); }} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300">Undo last decision</button>
          <input value={relatedCollection} onChange={(event) => setRelatedCollection(event.target.value)} className="min-w-64 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200" placeholder="Related collection ID for split / merge" />
          <button type="button" disabled={busy || !relatedCollection.trim()} onClick={() => void decide("split", { related: [relatedCollection.trim()] })} className="rounded border border-amber-800 px-2 py-1 text-[10px] text-amber-100">Split</button>
          <button type="button" disabled={busy || !relatedCollection.trim()} onClick={() => void decide("merge", { related: [relatedCollection.trim()] })} className="rounded border border-violet-800 px-2 py-1 text-[10px] text-violet-100">Merge</button>
          <span className="ml-auto text-[9px] text-slate-500">{payload?.continuity_projection?.canonical_collection?.maturity || "membership_review"}</span>
        </div>
        {message ? <div className="mt-2 rounded border border-slate-800 px-2 py-1.5 text-[10px] text-slate-300" role="status">{message}</div> : null}
      </div>
    </section>
  );
}
