"use client";

import { apiService, type ManualVisualAnnotation, type ProliferationDecision } from "@/lib/api-service";
import { openVideoAtTime } from "@/lib/video-navigation";

type Projection = {
  decisionId: string;
  label: string;
  start: number;
  end: number;
  geometry: { x: number; y: number; width: number; height: number } | null;
};

function numberValue(value: unknown): number | undefined {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function normalizedGeometry(value: unknown): Projection["geometry"] {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const source = (raw.bbox || raw.roi || raw) as Record<string, unknown>;
  const x = numberValue(source.x ?? source.left ?? source.x1);
  const y = numberValue(source.y ?? source.top ?? source.y1);
  const x2 = numberValue(source.x2);
  const y2 = numberValue(source.y2);
  const width = numberValue(source.width ?? source.w) ?? (x !== undefined && x2 !== undefined ? x2 - x : undefined);
  const height = numberValue(source.height ?? source.h) ?? (y !== undefined && y2 !== undefined ? y2 - y : undefined);
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null;
  if (Math.max(x, y, width, height) > 1.5 || width <= 0 || height <= 0) return null;
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0.01, Math.min(1, width)),
    height: Math.max(0.01, Math.min(1, height)),
  };
}

function projectionsFrom(
  decisions: ProliferationDecision[] | undefined,
  annotations: ManualVisualAnnotation[] | undefined,
): Projection[] {
  const familyAliases = new Map<string, string>();
  (decisions || []).forEach((decision) => {
    if (decision.decision !== "confirmed" || !decision.decision_id.startsWith("narrative-agent-family-governance:")) return;
    const source = String(decision.candidate_label || "").trim().toLowerCase();
    const target = String(decision.applied_label || "").trim();
    if (source && target) familyAliases.set(source, target);
  });
  const canonicalLabel = (value: unknown) => {
    let label = String(value || "Narrative Agent").trim();
    const visited = new Set<string>();
    while (familyAliases.has(label.toLowerCase()) && !visited.has(label.toLowerCase())) {
      visited.add(label.toLowerCase());
      label = familyAliases.get(label.toLowerCase()) || label;
    }
    return label;
  };
  const latestByCandidate = new Map<string, ProliferationDecision>();
  (decisions || []).forEach((decision) => {
    if (decision.decision !== "confirmed" || decision.governance_status?.confirmation_kind !== "visual_narrative_agent_occurrence") return;
    latestByCandidate.set(decision.candidate_id || decision.decision_id, decision);
  });
  const decisionProjections = [...latestByCandidate.values()].flatMap((decision) => {
    if (decision.decision !== "confirmed") return [];
    if (decision.governance_status?.confirmation_kind !== "visual_narrative_agent_occurrence") return [];
    const anchor = decision.source_anchors?.[0] || {};
    const start = numberValue(anchor.start_seconds ?? anchor.start);
    if (start === undefined) return [];
    const end = numberValue(anchor.end_seconds ?? anchor.end) ?? start;
    return [{
      decisionId: decision.decision_id,
      label: canonicalLabel(decision.applied_label || decision.candidate_label),
      start,
      end,
      geometry: normalizedGeometry(anchor.geometry),
    }];
  });
  const placeholderLabels = new Set([
    "", "character present", "unidentified person", "unknown character",
    "unknown person", "person", "confirm narrative agent",
  ]);
  const annotationProjections = (annotations || []).flatMap((annotation) => {
    if (annotation.category !== "Identification") return [];
    const rawLabel = annotation.identity_affirmation || annotation.narrative_agent_affirmation || annotation.custom_label || annotation.label;
    const normalized = String(rawLabel || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (placeholderLabels.has(normalized) || normalized.startsWith("confirm narrative agent ")) return [];
    const start = numberValue(annotation.start_seconds ?? annotation.timestamp_seconds);
    if (start === undefined) return [];
    return [{
      decisionId: `manual-visual:${annotation.id}`,
      label: canonicalLabel(rawLabel),
      start,
      end: numberValue(annotation.end_seconds) ?? start,
      geometry: normalizedGeometry(annotation.coordinates),
    }];
  });
  const unique = new Map<string, Projection>();
  [...annotationProjections, ...decisionProjections].forEach((projection) => {
    const box = projection.geometry;
    const key = [
      projection.label.trim().toLowerCase(),
      projection.start.toFixed(3),
      box?.x.toFixed(3), box?.y.toFixed(3), box?.width.toFixed(3), box?.height.toFixed(3),
    ].join(":");
    unique.set(key, projection);
  });
  return [...unique.values()];
}

export default function NarrativeAgentThumbnailProjectionStrip({
  analysisId,
  decisions,
  annotations,
  atTime,
  agentLabel,
  title = "Confirmed visual Narrative Agent evidence",
  max = 8,
}: {
  analysisId: string;
  decisions?: ProliferationDecision[];
  annotations?: ManualVisualAnnotation[];
  atTime?: number;
  agentLabel?: string;
  title?: string;
  max?: number;
}) {
  const normalizedLabel = String(agentLabel || "").trim().toLowerCase();
  const all = projectionsFrom(decisions, annotations);
  const filtered = all.filter((projection) => {
    if (normalizedLabel && projection.label.trim().toLowerCase() !== normalizedLabel) return false;
    if (atTime !== undefined && Number.isFinite(atTime)) {
      const tolerance = 2;
      return atTime >= projection.start - tolerance && atTime <= projection.end + tolerance;
    }
    return true;
  }).slice(0, max);
  if (!analysisId || filtered.length === 0) return null;
  return (
    <div
      className="flex min-w-0 items-center gap-1.5 overflow-x-auto rounded border border-emerald-900/40 bg-emerald-950/10 px-2 py-1.5"
      data-vaa1-narrative-agent-thumbnail-projection-strip="true"
      data-vaa1-projection-authority="mature-user-confirmation"
    >
      <span className="shrink-0 text-[8px] uppercase tracking-[0.1em] text-emerald-200/80">{title}</span>
      {filtered.map((projection) => {
        const geometry = projection.geometry;
        const cropUrl = apiService.objectSourceCropUrl(analysisId, projection.start, geometry ? {
          x1: geometry.x,
          y1: geometry.y,
          x2: geometry.x + geometry.width,
          y2: geometry.y + geometry.height,
        } : undefined);
        return (
          <button
            key={projection.decisionId}
            type="button"
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded border border-emerald-700/70 bg-black hover:border-cyan-500"
            onClick={() => openVideoAtTime(analysisId, projection.start)}
            title={`${projection.label} · ${projection.start.toFixed(3)}s · mature user confirmation`}
            aria-label={`Open confirmed ${projection.label} occurrence at ${projection.start.toFixed(3)} seconds`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cropUrl} alt="" loading="lazy" decoding="async" className="pointer-events-none h-full w-full object-cover" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/80 px-0.5 text-[7px] text-white">
              {projection.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
