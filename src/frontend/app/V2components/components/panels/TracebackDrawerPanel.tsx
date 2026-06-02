"use client";

import React, { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { apiService, type ForensicTracebackRecord, type ForensicTracebackTree } from "@/lib/api-service";

type TracebackSourceRefs = {
  media_id?: string;
  video_time?: number | string;
  time_range?: { start?: number | string; end?: number | string };
  frame_id?: string | null;
  bbox_id?: string | null;
  roi_id?: string | null;
  transcript_span_id?: string | null;
  metadata_id?: string | null;
  detector_run_id?: string | null;
  annotation_id?: string | null;
};

type TracebackNode = {
  node_id: string;
  node_type:
    | "mature_claim"
    | "manual_annotation"
    | "raw_detection"
    | "metadata"
    | "transcript"
    | "expression"
    | "object"
    | "frame"
    | "bbox"
    | "roi"
    | "scene"
    | "narrative_agent"
    | "plot_candidate";
  label: string;
  status: "raw" | "inferred" | "verified" | "corrected" | "mature" | "dropped" | "superseded";
  authority: "detector" | "analyst" | "imported_metadata" | "transcript" | "model_inference" | "merged";
  confidence?: number | null;
  source_refs?: TracebackSourceRefs;
};

type TracebackEdge = {
  source: string;
  target: string;
  relation: string;
};

type TracebackTimelineEvent = {
  id: string;
  label: string;
  time: number;
  endTime?: number;
  authority: TracebackNode["authority"];
  status: TracebackNode["status"];
  source: string;
};

export type TracebackDrawerPayload = {
  claim_id?: string;
  claim_label?: string;
  claim_type?: string;
  claim_status?: string;
  maturity_level?: string;
  confidence?: number | null;
  authority_level?: string;
  authority_source?: string;
  manual_override_status?: string;
  active_revision_id?: string;
  superseded_revision_ids?: string[];
  review_status?: string;
  created_by?: string;
  last_modified?: string;
  videoId?: string;
  sourcePanel?: string;
  sourceItem?: Record<string, unknown>;
  source_refs?: TracebackSourceRefs;
  nodes?: TracebackNode[];
  edges?: TracebackEdge[];
  forensicRenderJobId?: string;
  traceback?: ForensicTracebackRecord | Record<string, unknown> | null;
  tree?: ForensicTracebackTree | null;
};

type TracebackDrawerPanelProps = {
  payload?: TracebackDrawerPayload;
};

function valueText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "not supplied";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function secondsText(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return valueText(value);
  const minutes = Math.floor(numeric / 60);
  const seconds = numeric - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

function confidenceText(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "not supplied";
  return numeric <= 1 ? `${Math.round(numeric * 100)}%` : `${Math.round(numeric)}%`;
}

function hasManualAuthority(payload: TracebackDrawerPayload, sourceItem: Record<string, unknown>): boolean {
  const manual = asRecord(sourceItem.manual_annotation);
  return (
    payload.claim_type === "manual" ||
    payload.authority_level === "manual_annotation" ||
    payload.authority_level === "analyst" ||
    Object.keys(manual).length > 0
  );
}

function canRestoreToAnalysis(payload: TracebackDrawerPayload): boolean {
  const sourceItem = asRecord(payload.sourceItem);
  if (!payload.videoId || hasManualAuthority(payload, sourceItem)) {
    return false;
  }
  const hasSourceGeometry = Boolean(
    sourceItem.bbox ||
      sourceItem.coordinates ||
      sourceItem.normalizedBox ||
      sourceItem.normalized_box,
  );
  const hasSourceTime = Boolean(
    payload.source_refs?.video_time !== undefined ||
      payload.source_refs?.time_range?.start !== undefined ||
      sourceItem.timestamp !== undefined ||
      sourceItem.startTimestamp !== undefined ||
      sourceItem.start_seconds !== undefined,
  );
  return hasSourceGeometry && hasSourceTime;
}

function normalizeTreeNodes(tree?: ForensicTracebackTree | null): TracebackNode[] {
  return (tree?.nodes || []).map((node, index) => {
    const payload = asRecord(node.payload);
    return {
      node_id: node.id || `tree-node-${index}`,
      node_type: (node.type as TracebackNode["node_type"]) || "metadata",
      label: node.label || valueText(payload.label || node.type || `Traceback node ${index + 1}`),
      status: (payload.status as TracebackNode["status"]) || "inferred",
      authority: (payload.authority as TracebackNode["authority"]) || "model_inference",
      confidence:
        typeof payload.confidence === "number" ? Number(payload.confidence) : null,
      source_refs: asRecord(payload.source_refs) as TracebackSourceRefs,
    };
  });
}

function normalizeTreeEdges(tree?: ForensicTracebackTree | null): TracebackEdge[] {
  return (tree?.edges || []).map((edge) => ({
    source: edge.source,
    target: edge.target,
    relation: edge.relation || "supports",
  }));
}

function fallbackEvidenceTreeEdges(nodes: TracebackNode[]): TracebackEdge[] {
  if (nodes.length < 2) return [];
  const root = nodes[0];
  return nodes.slice(1).map((node) => ({
    source: root.node_id,
    target: node.node_id,
    relation:
      node.status === "raw"
        ? "retains detector substrate"
        : node.authority === "analyst"
          ? "manual authority"
          : "supports claim",
  }));
}

function normalizeInlineNodes(payload: TracebackDrawerPayload): TracebackNode[] {
  if (payload.nodes?.length) return payload.nodes;
  const sourceItem = asRecord(payload.sourceItem);
  const manualAuthority = hasManualAuthority(payload, sourceItem);
  const nodes: TracebackNode[] = [
    {
      node_id: payload.claim_id || "mature-claim",
      node_type: "mature_claim",
      label: payload.claim_label || "Traceable claim",
      status:
        manualAuthority
          ? "mature"
          : payload.maturity_level === "raw_detection" || payload.claim_status === "candidate"
          ? "inferred"
          : "mature",
      authority:
        manualAuthority || payload.authority_level?.startsWith("manual")
          ? "analyst"
          : "model_inference",
      confidence: payload.confidence ?? null,
      source_refs: payload.source_refs,
    },
  ];

  const manual = asRecord(sourceItem.manual_annotation);
  if (manualAuthority) {
    nodes.push({
      node_id: valueText(manual.id || payload.source_refs?.annotation_id || "manual-annotation"),
      node_type: "manual_annotation",
      label: valueText(
        manual.label ||
          manual.identity_affirmation ||
          sourceItem.label ||
          payload.claim_label ||
          "Manual Narrative Agent annotation",
      ),
      status: "corrected",
      authority: "analyst",
      confidence: 1,
      source_refs: {
        annotation_id: valueText(manual.id || payload.source_refs?.annotation_id || ""),
        media_id: payload.source_refs?.media_id,
        video_time:
          (manual.timestamp_seconds as string | number | undefined) ||
          payload.source_refs?.video_time,
        time_range: {
          start:
            (manual.start_seconds as string | number | undefined) ||
            payload.source_refs?.time_range?.start,
          end:
            (manual.end_seconds as string | number | undefined) ||
            payload.source_refs?.time_range?.end,
        },
        bbox_id: payload.source_refs?.bbox_id,
        roi_id: payload.source_refs?.roi_id,
      },
    });
  }

  if (payload.source_refs?.bbox_id || payload.source_refs?.roi_id || payload.source_refs?.video_time) {
    nodes.push({
      node_id: valueText(
        payload.source_refs?.bbox_id || payload.source_refs?.roi_id || "frame-bbox-reference",
      ),
      node_type: payload.source_refs?.roi_id ? "roi" : "bbox",
      label: payload.source_refs?.roi_id ? "ROI source reference" : "BBox source reference",
      status: manualAuthority ? "verified" : "inferred",
      authority: manualAuthority ? "analyst" : "merged",
      source_refs: payload.source_refs,
    });
  }

  if (payload.videoId || payload.source_refs?.media_id) {
    nodes.push({
      node_id: valueText(payload.source_refs?.media_id || payload.videoId || "source-media"),
      node_type: "frame",
      label: "Source media frame",
      status: "verified",
      authority: "merged",
      source_refs: payload.source_refs,
    });
  }

  const rawLabel = sourceItem.raw_class_name || sourceItem.class_name || sourceItem.rawDominantEmotion;
  if (rawLabel) {
    nodes.push({
      node_id: valueText(sourceItem.trackId || sourceItem.track_id || sourceItem.timestamp || "raw-substrate"),
      node_type:
        payload.claim_type === "expression" ? "expression" : payload.claim_type === "object" ? "object" : "raw_detection",
      label: `Detector substrate: ${valueText(rawLabel)}`,
      status: "raw",
      authority: "detector",
      confidence: typeof sourceItem.confidence === "number" ? Number(sourceItem.confidence) : null,
      source_refs: {
        video_time: sourceItem.timestamp as string | number | undefined,
        bbox_id: valueText(sourceItem.trackId || sourceItem.track_id || ""),
      },
    });
  }

  const evidenceRefs = sourceItem.evidence_refs || sourceItem.source_evidence_refs;
  if (Array.isArray(evidenceRefs)) {
    evidenceRefs.slice(0, 8).forEach((ref, index) => {
      nodes.push({
        node_id: `evidence-ref-${index}`,
        node_type: "metadata",
        label: valueText(ref),
        status: "verified",
        authority: "merged",
        source_refs: payload.source_refs,
      });
    });
  }

  return nodes;
}

function treeLevelForNode(node: TracebackNode): number {
  if (node.node_type === "mature_claim" || node.status === "mature") return 0;
  if (node.authority === "analyst" || node.node_type === "manual_annotation") return 1;
  if (
    node.node_type === "metadata" ||
    node.node_type === "transcript" ||
    node.node_type === "narrative_agent" ||
    node.status === "verified" ||
    node.status === "corrected"
  ) {
    return 2;
  }
  return 3;
}

function nodeToneClass(node: TracebackNode): string {
  if (node.status === "raw") return "border-slate-700 bg-slate-950/60 text-slate-300";
  if (node.authority === "analyst") return "border-emerald-700/70 bg-emerald-950/30 text-emerald-100";
  if (node.node_type === "mature_claim" || node.status === "mature") {
    return "border-cyan-700/70 bg-cyan-950/30 text-cyan-100";
  }
  if (node.node_type === "metadata" || node.node_type === "transcript") {
    return "border-indigo-800/70 bg-indigo-950/20 text-indigo-100";
  }
  return "border-slate-700 bg-black/25 text-slate-200";
}

function timelineTimeFromRefs(refs?: TracebackSourceRefs): number | null {
  const value = refs?.video_time ?? refs?.time_range?.start;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function timelineEventsFromPayload(
  payload: TracebackDrawerPayload,
  nodes: TracebackNode[],
): TracebackTimelineEvent[] {
  const sourceItem = asRecord(payload.sourceItem);
  const events = new Map<string, TracebackTimelineEvent>();
  const pushEvent = (event: TracebackTimelineEvent) => {
    if (!Number.isFinite(event.time)) return;
    events.set(event.id, event);
  };

  nodes.forEach((node) => {
    const time = timelineTimeFromRefs(node.source_refs);
    if (time === null) return;
    pushEvent({
      id: `node-${node.node_id}-${time}`,
      label: node.label,
      time,
      endTime:
        node.source_refs?.time_range?.end !== undefined
          ? Number(node.source_refs.time_range.end)
          : undefined,
      authority: node.authority,
      status: node.status,
      source: node.node_type,
    });
  });

  const frameRefs = sourceItem.source_frame_refs;
  if (Array.isArray(frameRefs)) {
    frameRefs.forEach((timeValue, index) => {
      const time = Number(timeValue);
      pushEvent({
        id: `frame-ref-${index}-${time}`,
        label: payload.claim_label || "Same entity frame reference",
        time,
        authority: hasManualAuthority(payload, sourceItem) ? "analyst" : "merged",
        status: hasManualAuthority(payload, sourceItem) ? "verified" : "inferred",
        source: "frame_ref",
      });
    });
  }

  const bboxRefs = sourceItem.source_bbox_refs;
  if (Array.isArray(bboxRefs)) {
    bboxRefs.forEach((ref, index) => {
      const record = asRecord(ref);
      const time = Number(record.time ?? record.timestamp ?? record.video_time);
      pushEvent({
        id: `bbox-ref-${index}-${time}`,
        label: payload.claim_label || "Same entity BBox reference",
        time,
        authority: hasManualAuthority(payload, sourceItem) ? "analyst" : "merged",
        status: hasManualAuthority(payload, sourceItem) ? "verified" : "inferred",
        source: valueText(record.source || "bbox_ref"),
      });
    });
  }

  return Array.from(events.values()).sort((left, right) => left.time - right.time);
}

function normalizeTracebackPayload(payload: TracebackDrawerPayload): TracebackDrawerPayload {
  const sourceItem = asRecord(payload.sourceItem);
  const traceback = asRecord(payload.traceback || sourceItem.traceback);
  const mature = asRecord(sourceItem.master_schema_mature_label || sourceItem.narrative_agent_recognition);
  const manualAuthority = hasManualAuthority(payload, sourceItem);
  return {
    ...payload,
    claim_id: payload.claim_id || valueText(sourceItem.id || sourceItem.trackId || sourceItem.track_id || traceback.artifact_id || "traceback-claim"),
    claim_label:
      payload.claim_label ||
      valueText(sourceItem.displayLabel || mature.label || sourceItem.label || traceback.artifact_id || "Traceable claim"),
    claim_type: payload.claim_type || valueText(sourceItem.annotationCategory || sourceItem.class_name || traceback.artifact_type || "evidence"),
    claim_status: manualAuthority
      ? "manual authority"
      : payload.claim_status || "candidate",
    maturity_level: manualAuthority
      ? "manual_annotation"
      : payload.maturity_level || valueText(mature.authority || sourceItem.authority || "candidate"),
    confidence:
      manualAuthority
        ? 1
        : payload.confidence ??
      (typeof sourceItem.confidence === "number" ? Number(sourceItem.confidence) : null),
    authority_level: manualAuthority
      ? "manual_annotation"
      : payload.authority_level || valueText(mature.authority || sourceItem.authority || "candidate"),
    authority_source: manualAuthority
      ? valueText(payload.authority_source || mature.sourcePanel || sourceItem.sourceType || "analyst")
      : payload.authority_source || valueText(mature.sourcePanel || sourceItem.sourceType || payload.sourcePanel || "VAA1"),
    review_status: payload.review_status || "reviewable",
    created_by: payload.created_by || valueText(traceback.created_by || sourceItem.updated_by || "system_candidate"),
    last_modified: payload.last_modified || valueText(traceback.created_at || sourceItem.updated_at || ""),
  };
}

export default function TracebackDrawerPanel({ payload: initialPayload }: TracebackDrawerPanelProps) {
  const [payload, setPayload] = useState<TracebackDrawerPayload>(
    normalizeTracebackPayload(initialPayload || {}),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (next: TracebackDrawerPayload) => {
      setPayload(normalizeTracebackPayload(next || {}));
      setError("");
    };
    eventBus.on<TracebackDrawerPayload>("tracebackOpenRequested", handler);
    return () => eventBus.off<TracebackDrawerPayload>("tracebackOpenRequested", handler);
  }, []);

  useEffect(() => {
    if (!payload.videoId || !payload.forensicRenderJobId || payload.traceback) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiService
      .getForensicRenderTraceback(payload.videoId, payload.forensicRenderJobId)
      .then((result) => {
        if (cancelled) return;
        setPayload((current) =>
          normalizeTracebackPayload({
            ...current,
            traceback: result.traceback,
            tree: result.tree || null,
          }),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payload.forensicRenderJobId, payload.traceback, payload.videoId]);

  const normalized = useMemo(() => normalizeTracebackPayload(payload), [payload]);
  const nodes = useMemo(() => {
    const treeNodes = normalizeTreeNodes(normalized.tree);
    return treeNodes.length ? treeNodes : normalizeInlineNodes(normalized);
  }, [normalized]);
  const edges = useMemo(() => {
    const treeEdges = normalizeTreeEdges(normalized.tree);
    if (treeEdges.length) return treeEdges;
    if (normalized.edges?.length) return normalized.edges;
    return fallbackEvidenceTreeEdges(nodes);
  }, [nodes, normalized.edges, normalized.tree]);
  const treeLevels = useMemo(() => {
    const levels = new Map<number, TracebackNode[]>();
    nodes.forEach((node) => {
      const level = treeLevelForNode(node);
      levels.set(level, [...(levels.get(level) || []), node]);
    });
    return Array.from(levels.entries()).sort(([left], [right]) => left - right);
  }, [nodes]);
  const timelineEvents = useMemo(
    () => timelineEventsFromPayload(normalized, nodes),
    [nodes, normalized],
  );

  const jumpToVideo = () => {
    if (normalized.videoId) eventBus.emit("videoIdChanged", normalized.videoId);
    const time =
      normalized.source_refs?.video_time ??
      normalized.source_refs?.time_range?.start ??
      nodes.find((node) => node.source_refs?.video_time)?.source_refs?.video_time;
    const numeric = Number(time);
    if (Number.isFinite(numeric)) eventBus.emit("videoTimeLineChanged", numeric);
    eventBus.emit("openPanelRequest", {
      panelType: "VideoPanel",
      panelProps: normalized.videoId ? { videoId: normalized.videoId } : {},
    });
  };

  const jumpToPanel = (panelType: string) => {
    eventBus.emit("openPanelRequest", {
      panelType,
      panelProps: normalized.videoId ? { videoId: normalized.videoId } : {},
    });
  };

  const jumpToTimelineEvent = (event: TracebackTimelineEvent) => {
    if (normalized.videoId) eventBus.emit("videoIdChanged", normalized.videoId);
    eventBus.emit("videoTimeLineChanged", event.time);
    eventBus.emit("openPanelRequest", {
      panelType: "VideoPanel",
      panelProps: normalized.videoId ? { videoId: normalized.videoId } : {},
    });
  };

  const restoreToAnalysis = () => {
    if (!canRestoreToAnalysis(normalized)) {
      return;
    }
    eventBus.emit("restoreEvidenceToAnalysisRequested", {
      videoId: normalized.videoId,
      sourcePanel: "TracebackDrawer",
      sourceItem: normalized.sourceItem,
      source_refs: normalized.source_refs,
      claim_label: normalized.claim_label,
      claim_type: normalized.claim_type,
      authority_source: normalized.authority_source,
      traceback: normalized.traceback,
    });
    eventBus.emit("openPanelRequest", {
      panelType: "VideoPanel",
      panelProps: normalized.videoId ? { videoId: normalized.videoId } : {},
    });
  };

  return (
    <aside
      data-vaa1-panel="traceback-drawer"
      className="flex h-full min-h-0 flex-col bg-[#101213] text-slate-200"
    >
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">
          Calm Traceability
        </div>
        <h2 className="mt-1 text-sm font-semibold text-slate-50">Traceback</h2>
        <p className="mt-1 text-[11px] leading-4 text-slate-400">
          Source-chain view for mature claims, candidates, manual actions, and detector substrate.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <section
          data-vaa1-traceback-section="claim-header"
          className="rounded border border-cyan-900/50 bg-cyan-950/10 p-3"
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">
            Mature Claim
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-50">{normalized.claim_label}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div>Type: {normalized.claim_type}</div>
            <div>Status: {normalized.claim_status}</div>
            <div>Maturity: {normalized.maturity_level}</div>
            <div>Confidence: {confidenceText(normalized.confidence)}</div>
            <div>Created by: {normalized.created_by}</div>
            <div>Modified: {normalized.last_modified}</div>
          </div>
        </section>

        <section
          data-vaa1-traceback-section="authority-status"
          className="rounded border border-emerald-900/50 bg-emerald-950/10 p-3"
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
            Authority
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div>Level: {normalized.authority_level}</div>
            <div>Source: {normalized.authority_source}</div>
            <div>Manual override: {normalized.manual_override_status || "not active"}</div>
            <div>Review: {normalized.review_status}</div>
          </div>
        </section>

        <section
          data-vaa1-traceback-section="entity-timeline"
          className="rounded border border-slate-800 bg-[#151719] p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                Entity Timeline
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                Same Narrative Agent / label references currently available to this claim.
              </div>
            </div>
            <div className="text-[10px] text-slate-500">{timelineEvents.length} events</div>
          </div>
          {timelineEvents.length > 0 ? (
            <div className="space-y-2">
              <div className="relative h-6 rounded border border-slate-800 bg-black/30">
                {timelineEvents.map((event, index) => {
                  const first = timelineEvents[0]?.time ?? event.time;
                  const last = timelineEvents[timelineEvents.length - 1]?.time ?? event.time;
                  const span = Math.max(0.001, last - first);
                  const left = ((event.time - first) / span) * 100;
                  return (
                    <button
                      key={`timeline-dot-${event.id}-${index}`}
                      type="button"
                      title={`${event.label} at ${secondsText(event.time)}`}
                      aria-label={`Jump to ${event.label} at ${secondsText(event.time)}`}
                      onClick={() => jumpToTimelineEvent(event)}
                      className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                        event.authority === "analyst"
                          ? "border-emerald-200 bg-emerald-500"
                          : event.status === "raw"
                            ? "border-slate-500 bg-slate-700"
                            : "border-cyan-200 bg-cyan-500"
                      }`}
                      style={{ left: `${Math.max(2, Math.min(98, left))}%` }}
                    />
                  );
                })}
              </div>
              <div className="grid gap-1">
                {timelineEvents.slice(0, 8).map((event) => (
                  <button
                    key={`timeline-row-${event.id}`}
                    type="button"
                    data-vaa1-action="jump-to-entity-timeline-event"
                    onClick={() => jumpToTimelineEvent(event)}
                    className="grid grid-cols-[52px_1fr_auto] items-center gap-2 rounded border border-slate-800 bg-black/20 px-2 py-1 text-left text-[11px] text-slate-200 hover:border-cyan-800 hover:bg-cyan-950/20"
                  >
                    <span className="font-mono text-cyan-200">{secondsText(event.time)}</span>
                    <span className="truncate">{event.label}</span>
                    <span className="text-[10px] text-slate-500">{event.source}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded border border-slate-800 bg-black/20 px-2 py-2 text-[11px] text-slate-500">
              No additional same-entity timeline references are attached yet.
            </div>
          )}
        </section>

        <section
          data-vaa1-traceback-section="source-chain"
          className="rounded border border-slate-800 bg-[#151719] p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Source Chain
            </div>
            <div className="text-[10px] text-slate-500">evidence tree + chain</div>
          </div>
          <div
            data-vaa1-traceback-section="evidence-tree"
            className="mb-3 rounded border border-cyan-950/70 bg-black/20 p-2"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">
                Evidence Tree
              </div>
              <div className="text-[10px] text-slate-500">
                {nodes.length} nodes / {edges.length} links
              </div>
            </div>
            <div className="space-y-2">
              {treeLevels.map(([level, levelNodes], levelIndex) => (
                <div key={level} className="relative">
                  {levelIndex > 0 && (
                    <div className="mx-auto mb-2 h-4 w-px border-l border-dotted border-slate-700" />
                  )}
                  <div
                    className={`grid gap-2 ${
                      levelNodes.length > 1 ? "grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    {levelNodes.map((node) => {
                      const incoming = edges.filter((edge) => edge.target === node.node_id);
                      return (
                        <div
                          key={`tree-${node.node_id}`}
                          data-vaa1-traceback-node-id={`tree-${node.node_id}`}
                          className={`rounded border px-2 py-1.5 ${nodeToneClass(node)}`}
                        >
                          <div className="truncate text-[11px] font-medium" title={node.label}>
                            {node.label}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 text-[9px] uppercase tracking-[0.1em] text-slate-400">
                            <span>{node.node_type}</span>
                            <span>{node.status}</span>
                          </div>
                          {incoming.length > 0 && (
                            <div className="mt-1 truncate text-[9px] text-slate-500">
                              {incoming.map((edge) => edge.relation).join(" / ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {nodes.map((node, index) => (
              <div
                key={`${node.node_id}-${index}`}
                data-vaa1-traceback-node-id={node.node_id}
                className="grid grid-cols-[18px_1fr] gap-2"
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`mt-1 h-3 w-3 rounded-full border ${
                      node.status === "raw"
                        ? "border-slate-600 bg-slate-900"
                        : node.authority === "analyst"
                          ? "border-emerald-300 bg-emerald-900"
                          : node.status === "mature"
                            ? "border-cyan-300 bg-cyan-900"
                            : "border-slate-500 bg-slate-800"
                    }`}
                  />
                  {index < nodes.length - 1 && <div className="h-full min-h-5 border-l border-slate-700" />}
                </div>
                <div className="rounded border border-slate-800 bg-black/20 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-100">{node.label}</span>
                    <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-slate-400">
                      {node.node_type}
                    </span>
                    <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">
                      {node.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    Authority: {node.authority}
                    {node.confidence !== undefined && node.confidence !== null
                      ? ` / confidence ${confidenceText(node.confidence)}`
                      : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          data-vaa1-traceback-section="evidence-refs"
          className="rounded border border-slate-800 bg-[#151719] p-3"
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            Evidence References
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div>Media: {valueText(normalized.source_refs?.media_id || normalized.videoId)}</div>
            <div>Video time: {secondsText(normalized.source_refs?.video_time)}</div>
            <div>Frame: {valueText(normalized.source_refs?.frame_id)}</div>
            <div>BBox: {valueText(normalized.source_refs?.bbox_id)}</div>
            <div>ROI: {valueText(normalized.source_refs?.roi_id)}</div>
            <div>Transcript: {valueText(normalized.source_refs?.transcript_span_id)}</div>
            <div>Metadata: {valueText(normalized.source_refs?.metadata_id)}</div>
            <div>Detector: {valueText(normalized.source_refs?.detector_run_id)}</div>
          </div>
        </section>

        <section
          data-vaa1-traceback-section="source-jumps"
          className="rounded border border-slate-800 bg-[#151719] p-3"
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            Source Jumps
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              data-vaa1-action="jump-to-video-time"
              onClick={jumpToVideo}
              className="rounded border border-cyan-800 bg-cyan-950/30 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-900/40"
            >
              Jump to video time
            </button>
            <button
              type="button"
              data-vaa1-action="jump-to-bbox"
              onClick={() => jumpToPanel("VideoPanel")}
              className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              Show BBox/ROI
            </button>
            <button
              type="button"
              data-vaa1-action="jump-to-transcript"
              onClick={() => jumpToPanel("Transcript")}
              className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              Open transcript span
            </button>
            <button
              type="button"
              data-vaa1-action="jump-to-scene"
              onClick={() => jumpToPanel("SceneCards")}
              className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              Open scene
            </button>
            <button
              type="button"
              data-vaa1-action="jump-to-metadata"
              onClick={() => jumpToPanel("SourceMediaMetadata")}
              className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              Open metadata
            </button>
            <button
              type="button"
              data-vaa1-action="restore-to-analysis"
              disabled={!canRestoreToAnalysis(normalized)}
              onClick={restoreToAnalysis}
              className="rounded border border-emerald-800 bg-emerald-950/20 px-2 py-1 text-[11px] text-emerald-100 hover:bg-emerald-900/35 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-transparent disabled:text-slate-600"
            >
              Restore to analysis
            </button>
          </div>
        </section>

        <section
          data-vaa1-traceback-section="revision-history"
          className="rounded border border-slate-800 bg-[#151719] p-3"
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            Revision History
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Active revision: {normalized.active_revision_id || "current"}.
            Superseded revisions: {(normalized.superseded_revision_ids || []).join(", ") || "none supplied"}.
          </div>
        </section>

        {loading && <div className="text-[11px] text-cyan-300">Loading backend traceback...</div>}
        {error && <div className="text-[11px] text-rose-300">{error}</div>}
      </div>
    </aside>
  );
}
