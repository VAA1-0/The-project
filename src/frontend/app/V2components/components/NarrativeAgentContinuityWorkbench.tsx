import { useCallback, useEffect, useMemo, useState } from "react";
import { apiService } from "@/lib/api-service";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { individualNarrativeAgentLabel } from "@/lib/narrative-agent-registry";
import { openVideoAtTime } from "@/lib/video-navigation";

type Occurrence = {
  occurrence_id: string;
  analysis_id: string;
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

type ContinuityPayload = {
  project_id: string;
  analysis_id: string;
  collection_id: string;
  analysis_artifacts?: Array<{ analysis_id: string; filename?: string }>;
  inventory?: {
    summary?: Record<string, number>;
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

  useEffect(() => {
    if (agent) return;
    setAgent(agentLabels.find((label) => label.toLowerCase() === "james bond") || agentLabels[0] || "");
  }, [agent, agentLabels]);

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
  const excluded = new Set(payload?.decision_projection?.excluded_occurrence_ids || []);
  const deferred = new Set(payload?.decision_projection?.deferred_occurrence_ids || []);

  const decide = async (
    operation: string,
    options: { occurrence?: Occurrence; targetKind?: string; targetDecisionId?: string; related?: string[] } = {},
  ) => {
    if (!payload) return;
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
      })) as { continuity_projection?: { revision?: string }; content_checksum?: string };
      const revision = result?.continuity_projection?.revision;
      setMessage(`Save committed${revision ? ` · revision ${String(revision).slice(0, 12)}` : ""}${result.content_checksum ? ` · checksum ${result.content_checksum.slice(0, 12)}` : ""}.`);
      publishSaloonDoors(artifacts.map((item) => item.analysis_id), {
        projectId,
        collectionId: payload.collection_id,
        revision,
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
      })) as { evidence_id?: string; status?: string; save_committed?: boolean; duplicate_of?: string };
      publishSaloonDoors(artifacts.map((item) => item.analysis_id), {
        projectId,
        analysisId,
        evidenceId: result.evidence_id,
        modality,
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
        `${committedId ? ` · ${committedId}` : ""}. Review and include it in the continuity collection when appropriate.`,
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
                if (event.target.value) setAgent(event.target.value);
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
            <div>{artifacts.length} artifacts</div><div>{occurrences.length} source occurrences</div><div>beat {stamp(cursor)}</div>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto pb-1" aria-label="Navigable Narrative Agent continuity graph">
          <div className="flex min-w-max items-start gap-3 border-y border-slate-800 py-3">
            {artifacts.map((artifact, artifactIndex) => {
              const rows = occurrences.filter((row) => row.analysis_id === artifact.analysis_id);
              return <div key={artifact.analysis_id} className="relative w-56 shrink-0 rounded border border-slate-800 bg-slate-950/50 p-2">
                {artifactIndex > 0 ? <div className="absolute -left-3 top-5 h-px w-3 bg-cyan-900" /> : null}
                <button type="button" onClick={() => openVideoAtTime(artifact.analysis_id, Number(rows[0]?.source_interval?.start || 0))} className="w-full truncate text-left text-[10px] font-medium text-cyan-100 hover:text-white" title={artifact.filename}>{artifact.filename || artifact.analysis_id}</button>
                <div className="mt-1 truncate text-[9px] text-slate-600" title={artifact.analysis_id}>{artifact.analysis_id}</div>
                <div className="mt-2 space-y-1.5">
                  {rows.length ? rows.map((row) => {
                    const state = included.has(row.occurrence_id) ? "included" : excluded.has(row.occurrence_id) ? "excluded" : deferred.has(row.occurrence_id) ? "deferred" : "unreviewed";
                    return <div key={row.occurrence_id} className="rounded border border-slate-800 bg-slate-900/60 p-1.5" data-continuity-membership={state}>
                      <button type="button" onClick={() => openVideoAtTime(row.analysis_id, Number(row.source_interval?.start || 0))} className="w-full text-left text-[10px] text-slate-200 hover:text-cyan-100">
                        {modalityLabels[row.evidence_modality || "visual"] || row.evidence_modality} · {stamp(row.source_interval?.start)}–{stamp(row.source_interval?.end)}
                      </button>
                      <div className="mt-0.5 text-[9px] text-slate-500">{state} · {row.authority}</div>
                      <div className="mt-1 flex gap-1">
                        <button type="button" disabled={busy} onClick={() => void decide("include", { occurrence: row })} className="rounded border border-emerald-800 px-1.5 py-0.5 text-[9px] text-emerald-200">Include</button>
                        <button type="button" disabled={busy} onClick={() => void decide("exclude", { occurrence: row })} className="rounded border border-rose-900 px-1.5 py-0.5 text-[9px] text-rose-200">Reject</button>
                        <button type="button" disabled={busy} onClick={() => void decide("defer", { occurrence: row })} className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">Defer</button>
                      </div>
                    </div>;
                  }) : <div className="rounded border border-dashed border-slate-800 px-2 py-3 text-center text-[9px] text-slate-600">No {agent || "agent"} evidence in this artifact</div>}
                </div>
              </div>;
            })}
          </div>
        </div>

        <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-2" data-vaa1-continuity-source-editor={editorOpen ? "open" : "closed"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-[10px] uppercase tracking-wide text-cyan-200/80">Confirm source input at current artifact</div><div className="text-[9px] text-slate-500">The source confirmation and collection membership remain separate governed acts.</div></div>
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
              <div className="rounded border border-amber-900/50 bg-amber-950/15 px-2 py-1 text-[9px] text-amber-100/75 md:col-span-4">Body movement supports the constellation; interpretation remains candidate-only until continuity membership is confirmed.</div>
            </> : null}
            <input value={note} onChange={(event) => setNote(event.target.value)} className="rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-200 md:col-span-2" placeholder="Analyst note (optional)" />
            <button type="button" disabled={busy || !agent.trim()} onClick={() => void confirmEvidence()} className="rounded border border-cyan-700 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/30">{busy ? "Saving…" : "Confirm source input"}</button>
          </div> : <div className="mt-2 rounded border border-emerald-900/60 bg-emerald-950/20 px-2 py-1.5 text-[10px] text-emerald-100" data-vaa1-source-confirmation-closed="true">Entry saved and closed. Use the occurrence above for membership review.</div>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={busy || !occurrences.length} onClick={() => void decide("confirm", { targetKind: "collection" })} className="rounded border border-emerald-700 px-2 py-1 text-[10px] text-emerald-100">Confirm collection</button>
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
