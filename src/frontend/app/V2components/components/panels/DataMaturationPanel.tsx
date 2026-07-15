"use client";

import React, { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { openVideoAtTime } from "@/lib/video-navigation";
import { VideoService, type AnalysisData, type DetectedObject } from "@/lib/video-service";
import type { AnnotationCorrections, ProliferationDecision } from "@/lib/api-service";
import { useLayoutHost } from "../LayoutHost";

type ProliferationMode = "guarded" | "dynamic" | "research";
type MaturationQueue =
  | "all"
  | "manual"
  | "confirmations"
  | "bbox"
  | "patterns"
  | "content"
  | "scanner"
  | "sampling";
type MaturationDecision = "confirmed" | "deferred" | "canceled" | "staged_annotation";

type DataMaturationPanelProps = {
  videoId?: string;
};

type GovernanceMatrixRow = {
  id: string;
  label: string;
  family: string;
  authority: string;
  maturity: string;
  source: string;
  propagation: string;
  traceback: string;
  panel: string;
  reviewNeed: string;
  candidateId?: string;
  clusterKey?: string;
  hypothesisId?: string;
  opportunityId?: string;
  timestamp?: number | null;
  timeRange?: { start: number | null; end: number | null };
  bbox?: Record<string, unknown> | null;
  sourceRef?: string;
  canConfirm?: boolean;
  canStageAnnotation?: boolean;
  canDefer?: boolean;
  canDropCandidate?: boolean;
  canDropCluster?: boolean;
  queue: MaturationQueue;
};

type QualityTicket = {
  id: string;
  severity: "ok" | "warn" | "blocked";
  title: string;
  detail: string;
  targetPanel: string;
};

type GovernanceIssue = {
  id: string;
  kind: "posture" | "metric" | "lane" | "claim" | "quality";
  title: string;
  summary: string;
  detail: string;
  status: string;
  sourcePanel?: string;
  alignedPanels: string[];
  timestamp?: number | null;
  timeRange?: { start: number | null; end: number | null };
  bbox?: Record<string, unknown> | null;
  candidateId?: string;
  clusterKey?: string;
  hypothesisId?: string;
  opportunityId?: string;
  sourceRef?: string;
  canConfirm?: boolean;
  canStageAnnotation?: boolean;
  canDefer?: boolean;
  canDropCandidate?: boolean;
  canDropCluster?: boolean;
  governanceFacts?: Array<{ label: string; value: string }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function numberFrom(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function textFrom(value: unknown, fallback = ""): string {
  const text = String(value || "").trim();
  return text || fallback;
}

function manualAnnotationLabel(item: Record<string, unknown>): string {
  return (
    textFrom(item.identity_affirmation) ||
    textFrom(item.role_affirmation) ||
    textFrom(item.custom_label) ||
    textFrom(item.label) ||
    textFrom(item.category, "manual annotation")
  );
}

function timestampFromRecord(record: Record<string, unknown>): number | null {
  for (const key of [
    "timestamp_seconds",
    "timestamp",
    "start_seconds",
    "start",
    "time",
    "time_start",
  ]) {
    const value = Number(record[key]);
    if (Number.isFinite(value) && value >= 0) {
      return value > 1000 ? value / 1000 : value;
    }
  }
  return null;
}

function secondsFrom(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric > 1000 ? numeric / 1000 : numeric;
}

function rangeFromRecord(record: Record<string, unknown>): { start: number | null; end: number | null } {
  const nestedTime = asRecord(record.time || record.candidate_time || record.source_time);
  const start =
    secondsFrom(record.start_seconds) ??
    secondsFrom(record.start_time) ??
    secondsFrom(record.start) ??
    secondsFrom(record.timestamp_seconds) ??
    secondsFrom(record.timestamp) ??
    secondsFrom(nestedTime.start_seconds) ??
    secondsFrom(nestedTime.start_time) ??
    secondsFrom(nestedTime.start);
  const end =
    secondsFrom(record.end_seconds) ??
    secondsFrom(record.end_time) ??
    secondsFrom(record.end) ??
    secondsFrom(nestedTime.end_seconds) ??
    secondsFrom(nestedTime.end_time) ??
    secondsFrom(nestedTime.end) ??
    start;
  return { start, end };
}

function firstBBoxFromRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const direct =
    asRecord(record.coordinates).x !== undefined
      ? asRecord(record.coordinates)
      : asRecord(record.bbox).x1 !== undefined || asRecord(record.bbox).x !== undefined
        ? asRecord(record.bbox)
        : null;
  if (direct) return direct;
  const metadata = asRecord(record.metadata);
  const refs = asArray<Record<string, unknown>>(
    metadata.source_bbox_refs || record.source_bbox_refs || metadata.bbox_refs,
  );
  const ref = refs.find((item) => Object.keys(asRecord(item.bbox)).length > 0);
  return ref ? asRecord(ref.bbox) : null;
}

function firstSearchSource(record: Record<string, unknown>): Record<string, unknown> {
  return asArray<Record<string, unknown>>(record.sources)[0] || {};
}

function searchRowTimeRange(record: Record<string, unknown>): { start: number | null; end: number | null } {
  const source = firstSearchSource(record);
  return rangeFromRecord({
    start_time: record.start_time ?? source.start_time,
    end_time: record.end_time ?? source.end_time,
  });
}

function formatTimeRange(range?: { start: number | null; end: number | null }): string {
  if (!range || range.start === null || range.start === undefined) return "not anchored here";
  if (range.end !== null && range.end !== undefined && Math.abs(range.end - range.start) > 0.01) {
    return `${range.start.toFixed(2)}-${range.end.toFixed(2)}s`;
  }
  return `${range.start.toFixed(2)}s`;
}

function formatBBox(bbox?: Record<string, unknown> | null): string {
  if (!bbox) return "not anchored here";
  const x = bbox.x ?? bbox.x1;
  const y = bbox.y ?? bbox.y1;
  const w = bbox.w ?? bbox.width;
  const h = bbox.h ?? bbox.height;
  const x2 = bbox.x2;
  const y2 = bbox.y2;
  if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
    return `x ${Number(x).toFixed(3)}, y ${Number(y).toFixed(3)}, w ${Number(w).toFixed(3)}, h ${Number(h).toFixed(3)}`;
  }
  if (x !== undefined && y !== undefined && x2 !== undefined && y2 !== undefined) {
    return `x1 ${Number(x).toFixed(1)}, y1 ${Number(y).toFixed(1)}, x2 ${Number(x2).toFixed(1)}, y2 ${Number(y2).toFixed(1)}`;
  }
  return "BBox/ROI reference present";
}

function bboxConfirmationLabel(item: Record<string, unknown>): string {
  const confidence = secondsFrom(item.confidence);
  const probability = confidence !== null ? ` ${Math.round(Math.min(confidence, 1) * 100)}%` : "";
  const objectKind = textFrom(item.class_name || item.raw_class_name).toLowerCase();
  const target =
    objectKind === "person" || objectKind.includes("face")
      ? "Narrative Agent"
      : "object / agent";
  return `Confirm ${target}${probability}`;
}

function bboxConfirmationCandidate(item: Record<string, unknown>): boolean {
  if (!firstBBoxFromRecord(item)) return false;
  if (item.sourceType === "manual_visual") return false;
  const displayLabel = textFrom(item.displayLabel).toLowerCase();
  if (displayLabel.startsWith("confirm ") || item.narrative_agent_confirmation_required === true) {
    return true;
  }
  const objectKind = textFrom(item.class_name || item.raw_class_name).toLowerCase();
  const confidence = Number(item.confidence);
  return (
    objectKind === "person" ||
    objectKind.includes("face") ||
    (Number.isFinite(confidence) && confidence >= 0.45)
  );
}

type BBoxAggregate = {
  id: string;
  label: string;
  family: string;
  start: number;
  end: number;
  bbox: Record<string, unknown> | null;
  trackId: string;
  maxConfidence: number;
  count: number;
};

function bboxSpatialBucket(bbox: Record<string, unknown> | null): string {
  if (!bbox) return "no-bbox";
  const x = Number(bbox.x ?? bbox.x1);
  const y = Number(bbox.y ?? bbox.y1);
  const width = Number(
    bbox.w ?? bbox.width ?? (Number.isFinite(Number(bbox.x2)) && Number.isFinite(x) ? Number(bbox.x2) - x : NaN),
  );
  const height = Number(
    bbox.h ?? bbox.height ?? (Number.isFinite(Number(bbox.y2)) && Number.isFinite(y) ? Number(bbox.y2) - y : NaN),
  );
  if (![x, y, width, height].every(Number.isFinite)) return "bbox-ref";
  const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(width), Math.abs(height)) > 2 ? 80 : 0.08;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return [
    Math.round(centerX / scale),
    Math.round(centerY / scale),
    Math.round(width / scale),
    Math.round(height / scale),
  ].join(":");
}

function buildBBoxConfirmationAggregates(objects: DetectedObject[]): BBoxAggregate[] {
  const aggregates = new Map<string, BBoxAggregate>();
  objects.forEach((object) => {
    const item = object as unknown as Record<string, unknown>;
    if (!bboxConfirmationCandidate(item)) return;
    const timeRange = rangeFromRecord({
      timestamp_seconds: item.timestamp,
      start_seconds: item.startTimestamp,
      end_seconds: item.endTimestamp,
    });
    if (timeRange.start === null) return;
    const bbox = firstBBoxFromRecord(item);
    const rawTrackId = textFrom(item.trackId || item.track_id);
    const family = textFrom(item.class_name || item.raw_class_name, "object");
    const trackId = rawTrackId || `spatial:${family}:${bboxSpatialBucket(bbox)}`;
    const key = `${trackId}:${family}`;
    const confidence = numberFrom(item.confidence);
    const existing = aggregates.get(key);
    if (existing) {
      existing.start = Math.min(existing.start, timeRange.start);
      existing.end = Math.max(existing.end, timeRange.end ?? timeRange.start);
      existing.maxConfidence = Math.max(existing.maxConfidence, confidence);
      existing.count += 1;
      if (!existing.bbox && firstBBoxFromRecord(item)) {
        existing.bbox = firstBBoxFromRecord(item);
      }
      return;
    }
    aggregates.set(key, {
      id: `bbox-confirmation:${key}`,
      label: textFrom(item.displayLabel) || bboxConfirmationLabel(item),
      family,
      start: timeRange.start,
      end: timeRange.end ?? timeRange.start,
      bbox,
      trackId,
      maxConfidence: confidence,
      count: 1,
    });
  });
  return [...aggregates.values()]
    .filter((item) => item.count >= 2 || item.maxConfidence >= 0.55)
    .sort((left, right) => left.start - right.start);
}

function temporalCoverageAudit(source: Record<string, unknown>): {
  early: number;
  middle: number;
  late: number;
  status: "ok" | "warn";
} {
  const sourceMediaMetadata = asRecord(asRecord(source.metadata).sourceMediaMetadata);
  const duration = numberFrom(sourceMediaMetadata.duration_seconds);
  if (duration <= 0) {
    return { early: 0, middle: 0, late: 0, status: "ok" };
  }

  const corrections = asRecord(source.annotationCorrections);
  const evidenceRecords = [
    ...asArray<Record<string, unknown>>(corrections.manual_visual_annotations),
    ...asArray<Record<string, unknown>>(source.detectedObjects),
    ...asArray<Record<string, unknown>>(source.rawDetectedObjects),
    ...asArray<Record<string, unknown>>(source.transcriptTimeline),
    ...asArray<Record<string, unknown>>(source.transcript),
    ...asArray<Record<string, unknown>>(source.ocr),
    ...asArray<Record<string, unknown>>(source.expressionResults),
    ...asArray<Record<string, unknown>>(source.audioProsody),
    ...asArray<Record<string, unknown>>(source.sourceSamples),
  ];
  const counts = evidenceRecords.reduce<{ early: number; middle: number; late: number }>(
    (acc, record) => {
      const timestamp = timestampFromRecord(record);
      if (timestamp === null || timestamp > duration) return acc;
      const ratio = timestamp / duration;
      if (ratio < 1 / 3) acc.early += 1;
      else if (ratio < 2 / 3) acc.middle += 1;
      else acc.late += 1;
      return acc;
    },
    { early: 0, middle: 0, late: 0 },
  );
  const status = counts.early >= 8 && counts.late * 2 < counts.early ? "warn" : "ok";
  return { ...counts, status };
}

function countMatureSurfaces(audit: unknown): number {
  const record = asRecord(audit);
  const direct = numberFrom(record.mature_surface_count);
  if (direct > 0) return direct;

  const surfaces = record.mature_surfaces;
  if (Array.isArray(surfaces)) return surfaces.length;
  if (surfaces && typeof surfaces === "object") {
    return Object.values(surfaces as Record<string, unknown>).filter(Boolean).length;
  }

  return 0;
}

function countMatchCandidates(matches: unknown): number {
  return asArray(matches).reduce<number>((total, item) => {
    const record = asRecord(item);
    const candidates = asArray(record.candidates);
    return total + Math.max(1, candidates.length);
  }, 0);
}

function countAgentPersistence(summary: unknown): {
  labels: number;
  accepted: number;
  review: number;
} {
  const record = asRecord(summary);
  const labels = asArray(record.agent_persistence_labels);
  const accepted = labels.filter((label) => {
    const labelRecord = asRecord(label);
    const status = String(labelRecord.status || labelRecord.governance_status || "");
    return /accepted|confirmed|proliferation_allowed/i.test(status);
  }).length;
  const review = labels.filter((label) => {
    const labelRecord = asRecord(label);
    const status = String(labelRecord.status || labelRecord.governance_status || "");
    return /review|candidate|pending|to_be_confirmed/i.test(status);
  }).length;

  return { labels: labels.length, accepted, review };
}

function panelStatusClass(kind: "ok" | "warn" | "blocked"): string {
  if (kind === "ok") return "border-emerald-400/25 bg-emerald-400/8 text-emerald-100";
  if (kind === "warn") return "border-amber-400/25 bg-amber-400/8 text-amber-100";
  return "border-rose-400/25 bg-rose-400/8 text-rose-100";
}

function buildGovernanceMatrixRows(source: Record<string, unknown>): GovernanceMatrixRow[] {
  const corrections = asRecord(source.annotationCorrections);
  const manualVisualAnnotations = asArray<Record<string, unknown>>(
    corrections.manual_visual_annotations,
  );
  const proliferationDecisions = asArray<Record<string, unknown>>(
    corrections.proliferation_decisions,
  );
  const resolvedEvidence = asArray<Record<string, unknown>>(
    asRecord(source.masterSchemaResolvedEvidence).records,
  );
  const matchCandidates = asArray<Record<string, unknown>>(
    source.evidenceProliferationMatches,
  );
  const liveBus = asRecord(source.liveMatureDataProliferationAudit);
  const liveHypotheses = asArray<Record<string, unknown>>(
    liveBus.governed_mature_hypotheses_preview,
  );
  const genreRuleObservations = asArray<Record<string, unknown>>(
    liveBus.genre_rule_observations_preview,
  );
  const suppressedCandidateOpportunities = asArray<Record<string, unknown>>(
    liveBus.suppressed_candidate_opportunities_preview,
  );
  const scannerLaunchRequests = asArray<Record<string, unknown>>(
    liveBus.scanner_matcher_launch_requests_preview,
  );
  const searchIndexRecords = asArray<Record<string, unknown>>(
    asRecord(source.contentSearch).search_index_records,
  );
  const bboxSourceObjects = [
    ...asArray<DetectedObject>(source.detectedObjects),
    ...asArray<DetectedObject>(source.rawDetectedObjects),
  ];
  const audioProsodyCues = asArray<Record<string, unknown>>(source.audioProsody);

  const rows: GovernanceMatrixRow[] = [];

  manualVisualAnnotations.slice(0, 6).forEach((item, index) => {
    const id = textFrom(item.id, `manual-${index}`);
    const metadata = asRecord(item.metadata_correlation);
    const timeRange = rangeFromRecord(item);
    rows.push({
      id,
      label: manualAnnotationLabel(item),
      family: textFrom(item.category, "manual"),
      authority: textFrom(metadata.authority_state, "manual_correction"),
      maturity: textFrom(metadata.maturity_state, "manual_correction"),
      source: textFrom(metadata.source_panel, "BBox/ROI"),
      propagation: metadata.propagation_required === false ? "local" : "projection required",
      traceback: textFrom(metadata.geometry_track_id || id, "traceback required"),
      panel: "TracebackDrawer",
      reviewNeed: "source-local authority",
      timestamp: timeRange.start,
      timeRange,
      bbox: firstBBoxFromRecord(item),
      sourceRef: id,
      queue: "manual",
    });
  });

  resolvedEvidence.slice(0, 6).forEach((item, index) => {
    const metadata = asRecord(item.metadata);
    const timeRange = rangeFromRecord({ ...metadata, ...item });
    rows.push({
      id: textFrom(item.id || item.evidence_id, `resolved-${index}`),
      label: textFrom(item.label || metadata.current_label, "resolved evidence"),
      family: textFrom(item.category || metadata.category, "Master Schema"),
      authority: textFrom(item.authority || item.authority_level, "mature"),
      maturity: textFrom(item.maturity_state || metadata.maturity_state, "resolved"),
      source: textFrom(item.source_panel || metadata.source_panel, "Master Schema"),
      propagation: textFrom(metadata.propagation_state, "projected"),
      traceback: textFrom(item.traceback || metadata.traceback_ref, "traceback required"),
      panel: "MasterSchema",
      reviewNeed: textFrom(metadata.review_need, "inspect if conflicting"),
      timestamp: timeRange.start,
      timeRange,
      bbox: firstBBoxFromRecord({ ...metadata, ...item }),
      sourceRef: textFrom(item.source_ref || metadata.source_ref || item.traceback),
      queue: "manual",
    });
  });

  proliferationDecisions.slice(0, 4).forEach((item, index) => {
    const timeRange = rangeFromRecord(item);
    const sourceAnchors = asArray<Record<string, unknown>>(item.source_anchors);
    const anchorBBox = sourceAnchors.map(firstBBoxFromRecord).find(Boolean) || null;
    rows.push({
      id: textFrom(item.id || item.decision_id || item.candidate_id, `decision-${index}`),
      label: textFrom(item.label || item.target_label || item.candidate_label, "decision"),
      family: textFrom(item.target || item.category, "proliferation"),
      authority: "decision_ledger",
      maturity: textFrom(item.decision || item.status, "reviewed"),
      source: textFrom(item.source_panel, "candidate review"),
      propagation: Array.isArray(item.proliferates_to) ? "confirmed projection" : "review only",
      traceback: textFrom(item.source_traceback_refs, "traceback required"),
      panel: "MasterSchema",
      reviewNeed: Array.isArray(item.proliferates_to) ? "projection audit" : "candidate retained",
      timestamp: timeRange.start,
      timeRange,
      bbox: anchorBBox,
      sourceRef: textFrom(item.source_opportunity_id || item.opportunity_id || item.candidate_id),
      candidateId: textFrom(item.candidate_id),
      clusterKey: textFrom(item.cluster_key),
      hypothesisId: textFrom(item.hypothesis_id),
      opportunityId: textFrom(item.opportunity_id || item.source_opportunity_id),
      queue: "confirmations",
    });
  });

  matchCandidates.slice(0, 4).forEach((item, index) => {
    const timeRange = rangeFromRecord(item);
    rows.push({
      id: textFrom(item.request_id || item.candidate_id, `candidate-${index}`),
      label: textFrom(item.label || item.target_label, "match candidate"),
      family: "candidate",
      authority: "candidate_only",
      maturity: "review_candidate",
      source: textFrom(item.source_panel, "matcher"),
      propagation: "blocked until decision",
      traceback: textFrom(item.traceback_ref, "traceback required"),
      panel: "MeaningNetwork",
      reviewNeed: "needs analyst decision",
      candidateId: textFrom(item.candidate_id || item.request_id),
      clusterKey: textFrom(item.cluster_key),
      opportunityId: textFrom(item.opportunity_id || item.request_id),
      timestamp: timeRange.start,
      timeRange,
      bbox: firstBBoxFromRecord(item),
      sourceRef: textFrom(item.traceback_ref || item.request_id),
      canConfirm: timeRange.start !== null,
      canDefer: true,
      canDropCandidate: true,
      canDropCluster: Boolean(textFrom(item.cluster_key)),
      queue: "confirmations",
    });
  });

  liveHypotheses.slice(0, 6).forEach((item, index) => {
    const timeRange = rangeFromRecord(item);
    rows.push({
      id: textFrom(item.hypothesis_id || item.candidate_id, `governed-hypothesis-${index}`),
      label: textFrom(item.candidate_label || item.seed_label, "governed hypothesis"),
      family: textFrom(item.candidate_category, "proliferation"),
      authority: "governed_mature_hypothesis",
      maturity: textFrom(item.maturity_projection_state, "review_visible_not_mature"),
      source: textFrom(item.candidate_source_panel, "live proliferation bus"),
      propagation: "automatic review projection",
      traceback: textFrom(item.source_opportunity_id || item.candidate_source_ref, "traceback required"),
      panel: "MeaningNetwork",
      reviewNeed: textFrom(item.review_badge, "needs_review"),
      candidateId: textFrom(item.candidate_id),
      clusterKey: textFrom(item.cluster_key),
      hypothesisId: textFrom(item.hypothesis_id),
      opportunityId: textFrom(item.source_opportunity_id),
      timestamp: timeRange.start,
      timeRange,
      bbox: firstBBoxFromRecord(item),
      sourceRef: textFrom(item.candidate_source_ref || item.source_opportunity_id),
      canConfirm: timeRange.start !== null,
      canDefer: true,
      canDropCandidate: true,
      canDropCluster: Boolean(textFrom(item.cluster_key)),
      queue: "confirmations",
    });
  });

  suppressedCandidateOpportunities.slice(0, 8).forEach((item, index) => {
    const timeRange = rangeFromRecord(item);
    rows.push({
      id: textFrom(item.opportunity_id || item.candidate_id, `suppressed-candidate-${index}`),
      label: textFrom(item.candidate_label || item.label || item.seed_label, "suppressed candidate"),
      family: textFrom(item.candidate_category || item.category, "candidate"),
      authority: "candidate_only",
      maturity: "blocked_promotion",
      source: textFrom(item.source_panel || item.candidate_source_panel, "live proliferation bus"),
      propagation: textFrom(item.suppression_reason, "blocked until decision"),
      traceback: textFrom(item.source_ref || item.candidate_source_ref || item.opportunity_id, "traceback required"),
      panel: "VideoPanel",
      reviewNeed: "needs analyst decision",
      candidateId: textFrom(item.candidate_id || item.opportunity_id),
      clusterKey: textFrom(item.cluster_key),
      hypothesisId: textFrom(item.hypothesis_id),
      opportunityId: textFrom(item.opportunity_id || item.source_opportunity_id),
      timestamp: timeRange.start,
      timeRange,
      bbox: firstBBoxFromRecord(item),
      sourceRef: textFrom(item.source_ref || item.candidate_source_ref || item.opportunity_id),
      canConfirm: timeRange.start !== null,
      canDefer: true,
      canDropCandidate: true,
      canDropCluster: Boolean(textFrom(item.cluster_key)),
      queue: "confirmations",
    });
  });

  buildBBoxConfirmationAggregates(bboxSourceObjects).forEach((item) => {
    rows.push({
      id: item.id,
      label: `${item.label} (${item.count} detections)`,
      family: item.family,
      authority: "bbox_detection",
      maturity: "needs_manual_annotation",
      source: "Video BBox/ROI",
      propagation: "stage manual annotation",
      traceback: `object-track:${item.trackId}`,
      panel: "VideoPanel",
      reviewNeed: `${Math.round(item.maxConfidence * 100)}% max confidence`,
      candidateId: item.id,
      opportunityId: item.id,
      timestamp: item.start,
      timeRange: { start: item.start, end: item.end },
      bbox: item.bbox,
      sourceRef: `track:${item.trackId}`,
      canStageAnnotation: true,
      canDefer: true,
      canDropCandidate: true,
      queue: "bbox",
    });
  });

  audioProsodyCues.slice(0, 24).forEach((item, index) => {
    const timeRange = rangeFromRecord(item);
    if (timeRange.start === null) return;
    const roleSupport = textFrom(asRecord(item.interaction_cues).role_support);
    const rhythm = textFrom(asRecord(item.rhythm_profile).label);
    const tonality = textFrom(asRecord(item.tonality_profile).label);
    const label = textFrom(item.text, roleSupport || rhythm || "audio prosody cue");
    rows.push({
      id: textFrom(item.cue_id, `audio-pattern-${index}`),
      label,
      family: "audio prosody",
      authority: "audio_detection",
      maturity: textFrom(item.review_state, "needs_annotation"),
      source: "Audio",
      propagation: "stage audio/source annotation",
      traceback: textFrom(item.cue_id, `audio:${index}`),
      panel: "VideoPanel",
      reviewNeed: [roleSupport, rhythm, tonality].filter(Boolean).join(" / ") || "audio pattern",
      candidateId: textFrom(item.cue_id, `audio-pattern-${index}`),
      opportunityId: textFrom(item.cue_id, `audio-pattern-${index}`),
      timestamp: timeRange.start,
      timeRange,
      bbox: null,
      sourceRef: textFrom(item.cue_id, `audio:${index}`),
      canStageAnnotation: true,
      canDefer: true,
      canDropCandidate: true,
      queue: "patterns",
    });
  });

  scannerLaunchRequests.slice(0, 8).forEach((item, index) => {
    const timeRange = rangeFromRecord(item);
    rows.push({
      id: textFrom(item.request_id || item.candidate_id, `scanner-request-${index}`),
      label: textFrom(item.candidate_label || item.label || item.reason, "SOM/scanner candidate"),
      family: textFrom(item.candidate_category || item.category, "scanner support"),
      authority: "scanner_matcher_candidate",
      maturity: "review_required",
      source: textFrom(item.source_panel, "SOM / scanner"),
      propagation: "scanner support required",
      traceback: textFrom(item.source_ref || item.request_id, "traceback required"),
      panel: "VideoPanel",
      reviewNeed: "review source match",
      candidateId: textFrom(item.candidate_id || item.request_id),
      clusterKey: textFrom(item.cluster_key),
      opportunityId: textFrom(item.opportunity_id || item.request_id),
      timestamp: timeRange.start,
      timeRange,
      bbox: firstBBoxFromRecord(item),
      sourceRef: textFrom(item.source_ref || item.request_id),
      canConfirm: false,
      canDefer: true,
      canDropCandidate: true,
      canDropCluster: Boolean(textFrom(item.cluster_key)),
      queue: "scanner",
    });
  });

  genreRuleObservations.slice(0, 4).forEach((item, index) => {
    const timeRange = rangeFromRecord(item);
    rows.push({
      id: textFrom(item.observation_id, `genre-rule-${index}`),
      label: textFrom(item.label, "genre rule observation"),
      family: textFrom(item.category, "genre-specific known"),
      authority: textFrom(item.authority_class, "content_derived_mature_observation"),
      maturity: textFrom(item.maturity_projection_state, "mature_with_confidence_rating"),
      source: textFrom(item.source_panel, "genre rule"),
      propagation: textFrom(item.genre_rule_id, "genre-specific cascade"),
      traceback: textFrom(item.source_ref, "traceback required"),
      panel: "TracebackDrawer",
      reviewNeed: `${numberFrom(item.confidence_percent)}% confidence`,
      candidateId: textFrom(item.observation_id),
      timestamp: timeRange.start,
      timeRange,
      bbox: firstBBoxFromRecord(item),
      sourceRef: textFrom(item.source_ref || item.observation_id),
      canConfirm: false,
      canDefer: true,
      canDropCandidate: true,
      queue: "content",
    });
  });

  searchIndexRecords
    .filter((item) => asRecord(item.maturity_summary).requires_review === true)
    .slice(0, 16)
    .forEach((item, index) => {
      const timeRange = searchRowTimeRange(item);
      const sourceItem = firstSearchSource(item);
      const cluster = asRecord(item.cluster_summary);
      const searchSurface = textFrom(item.search_surface);
      const isConfirmableCluster = searchSurface === "confirmable_cluster";
      const isMatureDataSurface = searchSurface === "mature_data";
      rows.push({
        id: textFrom(item.index_id || item.canonical_entity_id, `search-candidate-${index}`),
        label: textFrom(item.canonical_name || item.searchable_text, "search review candidate"),
        family: textFrom(item.search_surface || item.entity_type, "content search"),
        authority: textFrom(sourceItem.authority_status, "search_candidate"),
        maturity: textFrom(asRecord(item.maturity_summary).highest_maturity, "review_candidate"),
        source: textFrom(sourceItem.source_type, "Content Search"),
        propagation:
          cluster.promotion_requires_decision === true
            ? "promotion requires decision"
            : "blocked until decision",
        traceback: textFrom(sourceItem.traceback_ref || sourceItem.evidence_ref || item.index_id, "traceback required"),
        panel: "VideoPanel",
        reviewNeed: `${numberFrom(item.confidence_percent || sourceItem.confidence) || 0}% confidence`,
        candidateId: textFrom(item.index_id || item.canonical_entity_id),
        clusterKey: textFrom(cluster.cluster_key),
        opportunityId: textFrom(sourceItem.evidence_ref || item.index_id),
        timestamp: timeRange.start,
        timeRange,
        bbox: firstBBoxFromRecord(item),
        sourceRef: textFrom(sourceItem.evidence_ref || sourceItem.traceback_ref || item.index_id),
        canConfirm: isConfirmableCluster && timeRange.start !== null,
        canStageAnnotation: !isConfirmableCluster && !isMatureDataSurface,
        canDefer: true,
        canDropCandidate: true,
        canDropCluster: Boolean(textFrom(cluster.cluster_key)),
        queue:
          isConfirmableCluster
            ? "confirmations"
            : isMatureDataSurface
              ? "content"
              : "patterns",
      });
    });

  return rows.sort((left, right) => {
    const leftActionable = left.canConfirm || left.canDefer || left.canDropCandidate ? 0 : 1;
    const rightActionable = right.canConfirm || right.canDefer || right.canDropCandidate ? 0 : 1;
    if (leftActionable !== rightActionable) return leftActionable - rightActionable;
    return (left.timestamp ?? 999999) - (right.timestamp ?? 999999);
  });
}

function buildQualityTickets(
  metrics: {
    manualAnchorCount: number;
    candidateCount: number;
    matureWriteCount: number;
    matureSurfaces: number;
    proliferationDecisions: number;
    governedMatureHypotheses: number;
    contentDerivedMatureObservations: number;
    genreRuleObservations: number;
    proposedAudiovisualSamples: number;
    audiovisualSampleCount: number;
    temporalCoverage: { early: number; middle: number; late: number; status: "ok" | "warn" };
    busStatus: "ok" | "warn" | "blocked";
  },
): QualityTicket[] {
  const tickets: QualityTicket[] = [];

  if (metrics.busStatus === "blocked") {
    tickets.push({
      id: "candidate-rich-mature-write-light",
      severity: "blocked",
      title: "Candidate-rich, mature-write-light",
      detail: "Candidates exist, but mature projections or ledgered decisions are not keeping up.",
      targetPanel: "DataMaturation",
    });
  }

  if (metrics.manualAnchorCount > 0 && metrics.matureSurfaces === 0) {
    tickets.push({
      id: "manual-anchor-without-surface",
      severity: "warn",
      title: "Manual anchors need mature surface proof",
      detail: "Manual confirmations exist, but no mature surface count is visible in the audit summary.",
      targetPanel: "MasterSchema",
    });
  }

  if (metrics.candidateCount > 0 && metrics.proliferationDecisions === 0) {
    tickets.push({
      id: "candidate-without-decision-ledger",
      severity: "warn",
      title: "Candidate ledger gap",
      detail:
        metrics.governedMatureHypotheses > 0
          ? "Automatic governed hypotheses are visible, but promotion/cancel/defer decisions still need ledger entries."
          : "Candidate evidence is present without durable promotion/cancel/defer decisions.",
      targetPanel: "MeaningNetwork",
    });
  }

  if (metrics.audiovisualSampleCount === 0) {
    tickets.push({
      id: "source-sampling-not-operationalized",
      severity: "warn",
      title: "Audiovisual source sampling missing",
      detail: "No source samples or audio sample clouds are visible as matching substrate.",
      targetPanel: "DataMaturation",
    });
  }

  if (metrics.temporalCoverage.status === "warn") {
    tickets.push({
      id: "late-video-evidence-dropoff",
      severity: "warn",
      title: "Late-video evidence drop-off",
      detail: `Evidence density drops toward the end: early ${metrics.temporalCoverage.early}, middle ${metrics.temporalCoverage.middle}, late ${metrics.temporalCoverage.late}. Inspect whether this is media truth or pipeline degradation.`,
      targetPanel: "DataMaturation",
    });
  }

  if (tickets.length === 0) {
    tickets.push({
      id: "quality-agent-clear",
      severity: "ok",
      title: "No immediate governance blockers",
      detail: "The audit-only review tray did not find a candidate, surface, ledger, or source-sampling blocker.",
      targetPanel: "MasterSchema",
    });
  }

  return tickets;
}

function issueFromPosture(mode: ProliferationMode): GovernanceIssue {
  const details: Record<ProliferationMode, string> = {
    guarded:
      "Guarded mode keeps candidates visible but emphasizes manual authority, cancel paths, and source proof before any projection.",
    dynamic:
      "Dynamic mode should stage confirmation needs, matcher support, and mature-data candidates directly in this panel while preserving manual wins.",
    research:
      "Research mode should expose scanner/matcher support, gaps, clusters, and ambiguity without treating diagnostic output as mature truth.",
  };
  return {
    id: `posture:${mode}`,
    kind: "posture",
    title: `${mode[0].toUpperCase()}${mode.slice(1)} posture`,
    summary: "Operating posture selected for the Maturation panel.",
    detail: details[mode],
    status: mode,
    alignedPanels: ["DataMaturation", "MasterSchema", "MeaningNetwork", "TracebackDrawer"],
    governanceFacts: [
      { label: "Manual authority", value: "wins" },
      { label: "Matcher output", value: "candidate-only" },
      { label: "Decision ledger", value: "required for promotion/cancel/defer" },
    ],
  };
}

function issueFromMetric(label: string, value: number, detail: string): GovernanceIssue {
  return {
    id: `metric:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    kind: "metric",
    title: label,
    summary: `${value} currently visible`,
    detail,
    status: "panel-local metric",
    alignedPanels: ["DataMaturation", "MasterSchema", "Search", "TracebackDrawer"],
    governanceFacts: [
      { label: "Count", value: String(value) },
      { label: "Panel action", value: "inspect locally before opening another panel" },
    ],
  };
}

function issueFromLane(title: string, status: string, detail: string): GovernanceIssue {
  return {
    id: `lane:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    kind: "lane",
    title,
    summary: status,
    detail,
    status,
    alignedPanels: ["DataMaturation", "MasterSchema", "MeaningNetwork", "TracebackDrawer"],
    governanceFacts: [
      { label: "Governance lane", value: title },
      { label: "Local resolution", value: "review, stage, drop, defer, or open source deliberately" },
    ],
  };
}

function issueFromGovernanceRow(row: GovernanceMatrixRow): GovernanceIssue {
  return {
    id: `claim:${row.id}`,
    kind: "claim",
    title: row.label,
    summary: `${row.authority} / ${row.maturity}`,
    detail:
      "This mature claim or candidate surface should be handled inside Maturation first. Use the aligned panel buttons only when you need source evidence, schema projection, or traceback context.",
    status: row.reviewNeed,
    sourcePanel: row.source,
    alignedPanels: [row.panel, "VideoPanel", "MasterSchema", "TracebackDrawer"],
    timestamp: row.timestamp ?? row.timeRange?.start ?? null,
    timeRange: row.timeRange,
    bbox: row.bbox,
    candidateId: row.candidateId,
    clusterKey: row.clusterKey,
    hypothesisId: row.hypothesisId,
    opportunityId: row.opportunityId,
    sourceRef: row.sourceRef || row.traceback,
    canConfirm: row.canConfirm,
    canStageAnnotation: row.canStageAnnotation,
    canDefer: row.canDefer,
    canDropCandidate: row.canDropCandidate,
    canDropCluster: row.canDropCluster,
    governanceFacts: [
      { label: "Authority", value: row.authority },
      { label: "Maturity", value: row.maturity },
      { label: "Source", value: row.source },
      { label: "Source time", value: formatTimeRange(row.timeRange) },
      { label: "BBox/ROI", value: formatBBox(row.bbox) },
      { label: "Propagation", value: row.propagation },
      { label: "Traceback", value: row.traceback },
      { label: "Review", value: row.reviewNeed },
    ],
  };
}

function issueFromQualityTicket(ticket: QualityTicket): GovernanceIssue {
  return {
    id: `quality:${ticket.id}`,
    kind: "quality",
    title: ticket.title,
    summary: ticket.severity,
    detail: ticket.detail,
    status: ticket.severity,
    alignedPanels: [ticket.targetPanel, "DataMaturation", "MasterSchema", "TracebackDrawer"],
    governanceFacts: [
      { label: "Ticket", value: ticket.id },
      { label: "Target", value: ticket.targetPanel },
      { label: "Overwrite mature data", value: "no" },
    ],
  };
}

export default function DataMaturationPanel({ videoId: initialVideoId }: DataMaturationPanelProps) {
  const { openPanel } = useLayoutHost();
  const [videoId, setVideoId] = useState(initialVideoId || "");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ProliferationMode>("dynamic");
  const [activeQueue, setActiveQueue] = useState<MaturationQueue>("confirmations");
  const [saveMessage, setSaveMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedIssue, setSelectedIssue] = useState<GovernanceIssue>(() =>
    issueFromPosture("dynamic"),
  );

  useEffect(() => {
    const videoHandler = (id: string) => {
      setVideoId(id || "");
    };
    const correctionHandler = (id?: string) => {
      if (!id || id === videoId) {
        setRefreshNonce((current) => current + 1);
      }
    };

    eventBus.on("videoIdChanged", videoHandler);
    eventBus.on("analysisCorrectionsChanged", correctionHandler);
    return () => {
      eventBus.off("videoIdChanged", videoHandler);
      eventBus.off("analysisCorrectionsChanged", correctionHandler);
    };
  }, [videoId]);

  useEffect(() => {
    let canceled = false;
    if (!videoId) {
      queueMicrotask(() => {
        if (!canceled) {
          setAnalysisData(null);
          setLoading(false);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!canceled) setLoading(true);
    });
    VideoService.getAnalysis(videoId)
      .then((analysis) => {
        if (!canceled) setAnalysisData(analysis);
      })
      .catch((error) => {
        console.warn("Failed to load data maturation analysis:", error);
        if (!canceled) setAnalysisData(null);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [refreshNonce, videoId]);

  const metrics = useMemo(() => {
    const source = asRecord(analysisData);
    const corrections = asRecord(source.annotationCorrections);
    const manualVisualAnnotations = asArray(corrections.manual_visual_annotations);
    const proliferationDecisions = asArray(corrections.proliferation_decisions);
    const confirmedDecisions = proliferationDecisions.filter((decision) => {
      const record = asRecord(decision);
      const status = String(record.decision || record.status || "");
      return /confirm|accept|proliferat|promote/i.test(status);
    }).length;
    const rejectedDecisions = proliferationDecisions.filter((decision) => {
      const record = asRecord(decision);
      const status = String(record.decision || record.status || "");
      return /reject|cancel|drop|block/i.test(status);
    }).length;

    const secondOrder = asRecord(source.secondOrderLabelProliferation);
    const secondOrderInstructions = asArray(secondOrder.instructions);
    const agentPersistence = countAgentPersistence(source.secondOrderLabelProliferation);
    const matchCandidates = countMatchCandidates(source.evidenceProliferationMatches);
    const liveBus = asRecord(source.liveMatureDataProliferationAudit);
    const liveBusSummary = asRecord(liveBus.summary);
    const liveCandidateOpportunities = numberFrom(
      liveBusSummary.candidate_opportunity_count,
    );
    const governedMatureHypotheses = numberFrom(
      liveBusSummary.governed_mature_hypothesis_count,
    );
    const automaticReviewProjections = numberFrom(
      liveBusSummary.automatic_review_projection_count,
    );
    const blockedPromotions = numberFrom(liveBusSummary.blocked_promotion_count);
    const contentDerivedMatureObservations = numberFrom(
      liveBusSummary.content_derived_mature_observation_count,
    );
    const genreRuleObservations = numberFrom(
      liveBusSummary.genre_rule_observation_count,
    );
    const proposedAudiovisualSamples = numberFrom(
      liveBusSummary.proposed_audiovisual_sample_count,
    );
    const sourceSamples = asArray(source.sourceSamples);
    const audioSampleClouds = asArray(asRecord(source.audioSampleClouds).clouds);
    const audiovisualSampleCount = sourceSamples.length + audioSampleClouds.length;
    const entityRegistry = asRecord(source.entityRegistry);
    const entityRecords = asArray<Record<string, unknown>>(entityRegistry.entities);
    const contentSearch = asRecord(source.contentSearch);
    const searchIndexRecords = asArray<Record<string, unknown>>(
      contentSearch.search_index_records,
    );
    const matureEntityRecords = entityRecords.filter((entity) =>
      /mature|corroborated/i.test(String(entity.maturity || "")),
    ).length;
    const entitySourceMentionCount = entityRecords.reduce((total, entity) => {
      return total + asArray(entity.source_mentions).length;
    }, 0);
    const scannerReadySearchRecords = searchIndexRecords.filter((record) => {
      const summary = asRecord(record.maturity_summary);
      return summary.requires_review === true;
    }).length;
    const resolvedEvidence = asArray(asRecord(source.masterSchemaResolvedEvidence).records).length;
    const matureSurfaces = countMatureSurfaces(source.masterSchemaMaturityAudit);
    const manualAnchorCount = manualVisualAnnotations.length + confirmedDecisions;
    const candidateCount =
      matchCandidates +
      liveCandidateOpportunities +
      secondOrderInstructions.length +
      agentPersistence.review +
      scannerReadySearchRecords;
    const matureWriteCount =
      matureSurfaces +
      resolvedEvidence +
      agentPersistence.accepted +
      confirmedDecisions +
      matureEntityRecords;
    const temporalCoverage = temporalCoverageAudit(source);
    const busStatus: "ok" | "warn" | "blocked" =
      manualAnchorCount > 0 && governedMatureHypotheses > 0
        ? "ok"
        : manualAnchorCount > 0 && candidateCount > 0 && matureWriteCount > 0
        ? "ok"
        : candidateCount > 0 && matureWriteCount === 0
          ? "blocked"
          : "warn";
    const governanceMatrixRows = buildGovernanceMatrixRows(source);
    const confirmationRows = governanceMatrixRows.filter(
      (row) => row.queue === "confirmations",
    ).length;
    const detectedPatternRows = governanceMatrixRows.filter(
      (row) => row.queue === "patterns",
    ).length;
    const bboxConfirmationRows = governanceMatrixRows.filter((row) => row.queue === "bbox").length;
    const scannerRows = governanceMatrixRows.filter((row) => row.queue === "scanner").length;

    return {
      manualVisualAnnotations: manualVisualAnnotations.length,
      proliferationDecisions: proliferationDecisions.length,
      confirmedDecisions,
      rejectedDecisions,
      secondOrderInstructions: secondOrderInstructions.length,
      matchCandidates,
      liveCandidateOpportunities,
      governedMatureHypotheses,
      automaticReviewProjections,
      blockedPromotions,
      contentDerivedMatureObservations,
      genreRuleObservations,
      proposedAudiovisualSamples,
      resolvedEvidence,
      matureSurfaces,
      sourceSamples: sourceSamples.length,
      audioSampleClouds: audioSampleClouds.length,
      audiovisualSampleCount,
      entityRecords: entityRecords.length,
      matureEntityRecords,
      entitySourceMentionCount,
      searchIndexRecords: searchIndexRecords.length,
      scannerReadySearchRecords,
      agentPersistence,
      manualAnchorCount,
      candidateCount,
      matureWriteCount,
      busStatus,
      governanceMatrixRows,
      confirmationRows,
      detectedPatternRows,
      bboxConfirmationRows,
      scannerRows,
      temporalCoverage,
    };
  }, [analysisData]);

  const qualityTickets = useMemo(
    () => buildQualityTickets(metrics),
    [metrics],
  );

  const visibleGovernanceRows = useMemo(() => {
    if (activeQueue === "all") return metrics.governanceMatrixRows;
    return metrics.governanceMatrixRows.filter((row) => row.queue === activeQueue);
  }, [activeQueue, metrics.governanceMatrixRows]);

  const selectGovernanceRow = (row: GovernanceMatrixRow) => {
    setSelectedIssue(issueFromGovernanceRow(row));
    if (row.timestamp !== null && row.timestamp !== undefined && videoId) {
      openVideoAtTime(videoId, row.timestamp);
    }
  };

  const activateQueue = (queue: MaturationQueue, issue: GovernanceIssue) => {
    setActiveQueue(queue);
    setSelectedIssue(issue);
    const first = metrics.governanceMatrixRows.find((row) => row.queue === queue);
    if (first) {
      selectGovernanceRow(first);
    }
  };

  const openGovernedPanel = (panelType: string) => {
    if (videoId) {
      eventBus.emit("videoIdChanged", videoId);
    }
    openPanel(panelType, videoId ? { videoId } : {});
    if (videoId) {
      window.setTimeout(() => eventBus.emit("videoIdChanged", videoId), 0);
    }
  };

  const openAlignedPanel = (panelType: string, timestamp?: number | null) => {
    if (panelType === "DataMaturation") {
      return;
    }
    if (panelType === "VideoPanel" && videoId && timestamp !== null && timestamp !== undefined) {
      openVideoAtTime(videoId, timestamp);
      return;
    }
    openGovernedPanel(panelType);
  };

  const persistProliferationDecision = async (
    row: GovernanceMatrixRow,
    decisionKind: MaturationDecision,
    scope: "candidate" | "cluster" | "hypothesis" = "candidate",
  ) => {
    if (!videoId) return;
    const target =
      scope === "cluster"
        ? row.clusterKey || row.candidateId || row.hypothesisId
        : scope === "hypothesis"
          ? row.hypothesisId || row.candidateId
          : row.candidateId || row.hypothesisId || row.id;
    if (!target) return;
    const existing: AnnotationCorrections = analysisData?.annotationCorrections || {};
    const now = new Date().toISOString();
    const confirmed = decisionKind === "confirmed";
    const canceled = decisionKind === "canceled";
    const stagedAnnotation = decisionKind === "staged_annotation";
    const decision: ProliferationDecision = {
      decision_id: `${decisionKind}:${scope}:${target}`,
      candidate_id: row.candidateId || target,
      decision_scope: scope,
      cluster_key: scope === "cluster" ? row.clusterKey : undefined,
      hypothesis_id: row.hypothesisId,
      target_hypothesis_id: row.hypothesisId,
      opportunity_id: row.opportunityId,
      source_opportunity_id: row.opportunityId,
      decision: decisionKind,
      authority_level: "manual_annotation_review",
      candidate_label: row.label,
      source_panel: row.source,
      source_verification_status:
        row.timeRange?.start !== null && row.timeRange?.start !== undefined
          ? "source_time_resolved"
          : "source_anchor_missing",
      source_range_source:
        row.timeRange?.start !== null && row.timeRange?.start !== undefined
          ? "evidence_ref"
          : undefined,
      source_anchors: [
        {
          source_ref: row.sourceRef || row.traceback,
          source_time: row.timeRange || { start: row.timestamp ?? null, end: row.timestamp ?? null },
          bbox_roi: row.bbox || null,
          source_panel: row.source,
        },
      ],
      evidence_refs: [
        {
          id: row.id,
          traceback: row.traceback,
          panel: row.panel,
          time: row.timeRange || null,
          bbox_roi: row.bbox || null,
        },
      ],
      source_traceback_refs: row.traceback ? [row.traceback] : [],
      projection_targets: confirmed
        ? ["MasterSchema", "MeaningNetwork", "TracebackDrawer", "VideoPanel"]
        : [],
      proliferates_to: confirmed
        ? ["master_schema", "meaning_network", "traceback", "source_timed_panels"]
        : [],
      proliferation_allowed: confirmed,
      decision_reason:
        confirmed
          ? "Analyst confirmed mature-data proliferation inside the Maturation panel."
          : canceled
            ? scope === "cluster"
              ? "Analyst dropped a confirmable mature-data cluster inside the Maturation panel."
              : "Analyst dropped an individual mature-data candidate inside the Maturation panel."
            : stagedAnnotation
              ? "Analyst staged this detected pattern for manual annotation inside the Maturation panel."
              : "Analyst deferred this mature-data candidate for later review inside the Maturation panel.",
      created_at: now,
      created_by: "analyst",
    };
    const decisions = [
      ...(existing.proliferation_decisions || []).filter(
        (item) => item.decision_id !== decision.decision_id,
      ),
      decision,
    ];
    const nextCorrections: AnnotationCorrections = {
      ...existing,
      version: 1,
      updated_at: now,
      updated_by: "analyst",
      text_substitutions: [...(existing.text_substitutions || [])],
      label_overrides: [...(existing.label_overrides || [])],
      manual_transcript_entries: [...(existing.manual_transcript_entries || [])],
      manual_visual_annotations: [...(existing.manual_visual_annotations || [])],
      proliferation_decisions: decisions,
    };
    setSaveMessage(
      confirmed
        ? "Confirming proliferation..."
        : canceled
          ? scope === "cluster"
            ? "Dropping cluster..."
            : "Dropping candidate..."
          : stagedAnnotation
            ? "Staging annotation..."
            : "Deferring candidate...",
    );
    const saved = await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    setAnalysisData((current) =>
      current ? { ...current, annotationCorrections: saved } : current,
    );
    const refreshed = await VideoService.refreshAnalysis(videoId);
    setAnalysisData(refreshed);
    eventBus.emit("analysisCorrectionsChanged", videoId);
    setSaveMessage(
      confirmed
        ? "Proliferation confirmed."
        : canceled
          ? scope === "cluster"
            ? "Cluster dropped."
            : "Candidate dropped."
          : stagedAnnotation
            ? "Annotation staged."
            : "Candidate deferred.",
    );
    setSelectedIssue(issueFromGovernanceRow(row));
  };

  const persistIssueDecision = async (
    issue: GovernanceIssue,
    decisionKind: MaturationDecision,
    scope: "candidate" | "cluster" | "hypothesis" = "candidate",
  ) => {
    const row: GovernanceMatrixRow = {
      id: issue.id.replace(/^claim:/, ""),
      label: issue.title,
      family: issue.kind,
      authority: "maturation_panel",
      maturity: issue.summary,
      source: issue.sourcePanel || "DataMaturation",
      propagation: decisionKind === "confirmed" ? "confirmed projection" : "review only",
      traceback: issue.sourceRef || issue.id,
      panel: "DataMaturation",
      reviewNeed: issue.status,
      candidateId: issue.candidateId || issue.id.replace(/^claim:/, ""),
      clusterKey: issue.clusterKey,
      hypothesisId: issue.hypothesisId,
      opportunityId: issue.opportunityId,
      timestamp: issue.timestamp,
      timeRange: issue.timeRange,
      bbox: issue.bbox,
      sourceRef: issue.sourceRef,
      canConfirm: issue.canConfirm,
      canDefer: issue.canDefer,
      canDropCandidate: issue.canDropCandidate,
      canDropCluster: issue.canDropCluster,
      canStageAnnotation: issue.canStageAnnotation,
      queue: "confirmations",
    };
    await persistProliferationDecision(row, decisionKind, scope);
  };

  const persistProliferationDrop = async (
    row: GovernanceMatrixRow,
    scope: "candidate" | "cluster",
  ) => persistProliferationDecision(row, "canceled", scope);

  return (
    <div
      className="h-full overflow-auto bg-[#181818] px-4 py-4 text-slate-200"
      data-vaa1-data-maturation-panel="true"
      data-vaa1-data-maturation-mode={mode}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Data Maturation Proliferation
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-100">
            Proliferation governance
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Inspect whether confirmed evidence, constellational candidates, and
            non-user-confirmed detections are becoming mature usable data.
          </p>
        </div>
        <div className="rounded border border-white/10 bg-[#111111] px-3 py-2 text-right text-[11px] text-slate-400">
          <div className="text-slate-500">Analysis</div>
          <div className="max-w-[220px] truncate font-mono text-slate-200">
            {videoId || "No active analysis"}
          </div>
          {loading ? <div className="mt-1 text-cyan-200">Refreshing...</div> : null}
          {saveMessage ? <div className="mt-1 text-amber-200">{saveMessage}</div> : null}
        </div>
      </div>

      <section
        className="mb-4 rounded border border-white/10 bg-[#101010] p-3"
        data-vaa1-data-maturation-dynamic-controls="true"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Operating posture
            </div>
            <div className="text-sm font-semibold text-slate-100">
              Move from conservative storage to governed dynamic proliferation
            </div>
          </div>
          <div className="flex overflow-hidden rounded border border-white/10 bg-[#181818] text-[11px]">
            {(["guarded", "dynamic", "research"] as ProliferationMode[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`px-3 py-1.5 capitalize ${
                  mode === item ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400 hover:bg-white/5"
                }`}
                onClick={() => {
                  setMode(item);
                  setSelectedIssue(issueFromPosture(item));
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div
          className={`rounded border px-3 py-2 text-xs ${panelStatusClass(metrics.busStatus)}`}
          data-vaa1-data-maturation-bus-health="true"
        >
          {metrics.busStatus === "ok"
            ? "Bus is active: anchors are automatically proliferating into governed review projections."
            : metrics.busStatus === "blocked"
              ? "Candidate-rich, mature-write-light: evidence exists but the bus is not installing enough mature surfaces."
              : "Partial signal: confirm or stage more anchors before trusting broad proliferation."}
        </div>
      </section>

      <details className="rounded border border-white/10 bg-[#101010]">
        <summary className="cursor-pointer list-none px-3 py-2 text-[12px] text-slate-300 marker:hidden">
          Maturation overview · {metrics.matureWriteCount} mature writes · {metrics.confirmationRows} awaiting confirmation
        </summary>
        <div className="grid gap-2 border-t border-white/10 p-2 lg:grid-cols-4">
        <MetricCard label="Manual anchors" value={metrics.manualAnchorCount} detail={`${metrics.manualVisualAnnotations} visual, ${metrics.confirmedDecisions} accepted decisions`} active={activeQueue === "manual"} onInspect={(issue) => activateQueue("manual", issue)} />
        <MetricCard label="Needs confirmation" value={metrics.confirmationRows} detail="mature-data candidates requiring promote/defer/drop" active={activeQueue === "confirmations"} onInspect={(issue) => activateQueue("confirmations", issue)} />
        <MetricCard label="BBox confirmations" value={metrics.bboxConfirmationRows} detail="timebound BBox/ROI detections needing manual annotation" active={activeQueue === "bbox"} onInspect={(issue) => activateQueue("bbox", issue)} />
        <MetricCard label="Detected patterns" value={metrics.detectedPatternRows} detail="raw source patterns needing annotation, not mature truth" active={activeQueue === "patterns"} onInspect={(issue) => activateQueue("patterns", issue)} />
        <MetricCard label="Governed hypotheses" value={metrics.governedMatureHypotheses} detail={`${metrics.automaticReviewProjections} automatic review projections, ${metrics.blockedPromotions} blocked promotions`} active={activeQueue === "confirmations"} onInspect={(issue) => activateQueue("confirmations", issue)} />
        <MetricCard label="Mature writes" value={metrics.matureWriteCount} detail={`${metrics.matureSurfaces} surfaces, ${metrics.resolvedEvidence} resolved evidence, ${metrics.matureEntityRecords} entities`} active={activeQueue === "content"} onInspect={(issue) => activateQueue("content", issue)} />
        <MetricCard label="Review pressure" value={metrics.agentPersistence.review + metrics.rejectedDecisions + metrics.governedMatureHypotheses} detail={`${metrics.agentPersistence.labels} persistence labels tracked`} onInspect={setSelectedIssue} />
        </div>

      <div className="grid gap-2 border-t border-white/10 p-2 lg:grid-cols-3">
        <MetricCard
          label="Entity Registry"
          value={metrics.entityRecords}
          detail={`${metrics.entitySourceMentionCount} source mentions harvested`}
          onInspect={setSelectedIssue}
        />
        <MetricCard
          label="Content-derived mature"
          value={metrics.contentDerivedMatureObservations}
          detail={`${metrics.genreRuleObservations} genre-rule observations, confidence-rated`}
          active={activeQueue === "content"}
          onInspect={(issue) => activateQueue("content", issue)}
        />
        <MetricCard
          label="Content Search"
          value={metrics.searchIndexRecords}
          detail="source-linked index rows"
          active={activeQueue === "patterns"}
          onInspect={(issue) => activateQueue("patterns", issue)}
        />
        <MetricCard
          label="SOM / scanner support"
          value={metrics.scannerRows}
          detail="scanner launch/support requests, not transcript passages"
          active={activeQueue === "scanner"}
          onInspect={(issue) => activateQueue("scanner", issue)}
        />
      </div>
      </details>

      <section
        className="mt-4 rounded border border-white/10 bg-[#101010] p-3"
        data-vaa1-data-maturation-governance-matrix="true"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Active queue: {activeQueue}
            </div>
            <div className="text-sm font-semibold text-slate-100">
              Mature claim and candidate surface audit
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded border border-white/10 bg-[#181818] text-[10px]">
              {(["all", "manual", "confirmations", "bbox", "patterns", "content", "scanner"] as MaturationQueue[]).map(
                (queue) => (
                  <button
                    key={queue}
                    type="button"
                    className={`px-2 py-1 capitalize ${
                      activeQueue === queue
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "text-slate-400 hover:bg-white/5"
                    }`}
                    data-vaa1-data-maturation-queue-filter={queue}
                    onClick={() => {
                      setActiveQueue(queue);
                      const first = metrics.governanceMatrixRows.find(
                        (row) => queue === "all" || row.queue === queue,
                      );
                      if (first) selectGovernanceRow(first);
                    }}
                  >
                    {queue}
                  </button>
                ),
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              {visibleGovernanceRows.length} shown / {metrics.governanceMatrixRows.length} total
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[11px]">
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="py-2 pr-3">Claim</th>
                <th className="py-2 pr-3">Authority</th>
                <th className="py-2 pr-3">Maturity</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">BBox/ROI</th>
                <th className="py-2 pr-3">Propagation</th>
                <th className="py-2 pr-3">Review</th>
                <th className="py-2 pr-3">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visibleGovernanceRows.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={9}>
                    No rows are visible in this queue yet.
                  </td>
                </tr>
              ) : (
                visibleGovernanceRows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-cyan-400/5"
                    data-vaa1-data-maturation-governance-row={row.id}
                    data-vaa1-data-maturation-governance-row-queue={row.queue}
                    onClick={() => selectGovernanceRow(row)}
                  >
                    <td className="max-w-[220px] py-2 pr-3">
                      <div className="truncate text-slate-100">{row.label}</div>
                      <div className="truncate font-mono text-[10px] text-slate-500">{row.id}</div>
                    </td>
                    <td className="py-2 pr-3 text-cyan-100">{row.authority}</td>
                    <td className="py-2 pr-3 text-slate-300">{row.maturity}</td>
                    <td className="py-2 pr-3 text-slate-400">{row.source}</td>
                    <td className="py-2 pr-3 text-slate-400">{formatTimeRange(row.timeRange)}</td>
                    <td className="max-w-[190px] py-2 pr-3 text-slate-400">
                      <span className="block truncate">{formatBBox(row.bbox)}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-400">{row.propagation}</td>
                    <td className="py-2 pr-3 text-amber-100">{row.reviewNeed}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded border border-white/10 bg-[#181818] px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectGovernanceRow(row);
                          }}
                        >
                          Select
                        </button>
                        {row.canDropCandidate ? (
                          <button
                            type="button"
                            className="rounded border border-rose-400/25 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-100 hover:bg-rose-500/20"
                            onClick={(event) => {
                              event.stopPropagation();
                              void persistProliferationDrop(row, "candidate");
                            }}
                          >
                            Drop
                          </button>
                        ) : null}
                        {row.canConfirm ? (
                          <button
                            type="button"
                            className="rounded border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-500/20"
                            data-vaa1-data-maturation-row-confirm="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              void persistProliferationDecision(row, "confirmed", row.hypothesisId ? "hypothesis" : "candidate");
                            }}
                          >
                            Confirm
                          </button>
                        ) : null}
                        {row.canStageAnnotation ? (
                          <button
                            type="button"
                            className="rounded border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/20"
                            data-vaa1-data-maturation-row-stage-annotation="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              void persistProliferationDecision(row, "staged_annotation");
                            }}
                          >
                            Stage annotation
                          </button>
                        ) : null}
                        {row.canDefer ? (
                          <button
                            type="button"
                            className="rounded border border-white/10 bg-[#181818] px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                            data-vaa1-data-maturation-row-defer="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              void persistProliferationDecision(row, "deferred", row.hypothesisId ? "hypothesis" : "candidate");
                            }}
                          >
                            Defer
                          </button>
                        ) : null}
                        {row.canDropCluster ? (
                          <button
                            type="button"
                            className="rounded border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100 hover:bg-amber-500/20"
                            onClick={(event) => {
                              event.stopPropagation();
                              void persistProliferationDrop(row, "cluster");
                            }}
                          >
                            Drop cluster
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <GovernanceIssueDrawer
        issue={selectedIssue}
        onOpenAlignedPanel={openAlignedPanel}
        onDecision={persistIssueDecision}
      />

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <Lane
          title="Manual confirmed anchors"
          status="source of truth"
          dataAttr="manual-anchors"
          active={activeQueue === "manual"}
          onInspect={(issue) => activateQueue("manual", issue)}
        >
          User-confirmed detections should seed matching, source jumps, and
          Master Schema maturity without losing the original timestamp or BBox/ROI
          authority.
        </Lane>
        <Lane
          title="Constellational co-occurrence"
          status="dynamic queue"
          dataAttr="constellation"
          constellationLane
          active={activeQueue === "confirmations"}
          onInspect={(issue) => activateQueue("confirmations", issue)}
        >
          Co-occurring objects, OCR, POS, transcript, role, scene, and Quant
          signals should form candidates that can be promoted when their source
          anchors agree.
        </Lane>
        <Lane
          title="Non-user confirmed data"
          status="needs leverage"
          dataAttr="non-user"
          nonUserCandidateLane
          active={activeQueue === "patterns"}
          onInspect={(issue) => activateQueue("patterns", issue)}
        >
          Detector-only passages and patterns should be staged for annotation
          with confidence, traceability, and a clear cancel path. They are not
          mature-data confirmations yet.
        </Lane>
        <Lane title="Mature data surfaces" status="delivery" dataAttr="mature-surfaces" active={activeQueue === "content"} onInspect={(issue) => activateQueue("content", issue)}>
          Mature writes should appear in Master Schema, Meaning Network, Traceback,
          and source-timed panels as reusable analytic leverage for the annotator.
        </Lane>
        <Lane
          title="Audiovisual source sampling"
          status="not operationalized"
          dataAttr="audiovisual-source-sampling"
          audiovisualSourceSamplingLane
          active={activeQueue === "sampling"}
          onInspect={(issue) => activateQueue("sampling", issue)}
        >
          Visual/audio source samples and sample clouds should become regular
          multimodal anchors for matching, traceback, and promotion, not only
          optional forensic artifacts. Current samples: {metrics.audiovisualSampleCount}
          {" "}({metrics.sourceSamples} source, {metrics.audioSampleClouds} audio clouds).
        </Lane>
        <Lane
          title="Live proliferation bus"
          status="automatic review projection"
          dataAttr="live-proliferation-bus"
          liveProliferationBusLane
          active={activeQueue === "confirmations"}
          onInspect={(issue) => activateQueue("confirmations", issue)}
        >
          Mature data now sweeps hydrated artifacts into governed hypotheses:
          visible review pressure with traceback, never confirmed mature truth
          until a promotion decision exists. Current governed hypotheses:{" "}
          {metrics.governedMatureHypotheses}. Matcher output should remain
          candidate-only until a promotion decision exists.
        </Lane>
        <Lane
          title="Genre-specific knowns"
          status="cascading rule"
          dataAttr="genre-specific-knowns"
          active={activeQueue === "content"}
          onInspect={(issue) => activateQueue("content", issue)}
        >
          News lower-third OCR now seeds confidence-rated mature observations and
          proposes audiovisual identity samples for later source-sample cloud
          matching. Proposed audiovisual samples: {metrics.proposedAudiovisualSamples}.
        </Lane>
      </div>

      <section
        className="mt-4 rounded border border-white/10 bg-[#101010] p-3"
        data-vaa1-data-maturation-quality-agent-tray="true"
      >
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Quality Agent
          </div>
          <div className="text-sm font-semibold text-slate-100">
            Audit-only review tray
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            These tickets warn about missing anchors, stale projections, candidate
            ledger gaps, and source-sampling gaps. They do not overwrite mature data.
          </p>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {qualityTickets.map((ticket) => (
            <div
              key={ticket.id}
              className={`rounded border px-3 py-2 text-xs ${panelStatusClass(ticket.severity)}`}
              data-vaa1-data-maturation-quality-ticket={ticket.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{ticket.title}</div>
                  <p className="mt-1 leading-5 opacity-85">{ticket.detail}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded border border-white/10 bg-black/15 px-2 py-1 text-[10px] hover:bg-black/25"
                  onClick={() => setSelectedIssue(issueFromQualityTicket(ticket))}
                >
                  Inspect
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/20"
          data-vaa1-data-maturation-meaning-network-action="true"
          onClick={() => openGovernedPanel("MeaningNetwork")}
        >
          Open Meaning Network
        </button>
        <button
          type="button"
          className="rounded border border-white/10 bg-[#202020] px-3 py-2 text-xs text-slate-100 hover:bg-[#2a2a2a]"
          onClick={() => openGovernedPanel("MasterSchema")}
        >
          Open Master Schema
        </button>
        <button
          type="button"
          className="rounded border border-white/10 bg-[#202020] px-3 py-2 text-xs text-slate-100 hover:bg-[#2a2a2a]"
          onClick={() => openGovernedPanel("TracebackDrawer")}
        >
          Open Traceback
        </button>
        <button
          type="button"
          className="rounded border border-white/10 bg-[#202020] px-3 py-2 text-xs text-slate-100 hover:bg-[#2a2a2a]"
          onClick={() => openGovernedPanel("VideoPanel")}
        >
          Open Source
        </button>
      </div>
    </div>
  );
}

function GovernanceIssueDrawer({
  issue,
  onOpenAlignedPanel,
  onDecision,
}: {
  issue: GovernanceIssue;
  onOpenAlignedPanel: (panelType: string, timestamp?: number | null) => void;
  onDecision: (
    issue: GovernanceIssue,
    decisionKind: MaturationDecision,
    scope?: "candidate" | "cluster" | "hypothesis",
  ) => void | Promise<void>;
}) {
  const alignedPanels = Array.from(new Set(issue.alignedPanels)).filter(
    (panel) => panel && panel !== "DataMaturation",
  );
  const hasSourceTime = issue.timestamp !== null && issue.timestamp !== undefined;
  const hasSourceBox = Boolean(issue.bbox);
  const canAct = Boolean(
    issue.kind === "claim" &&
      (issue.canConfirm ||
        issue.canStageAnnotation ||
        issue.canDefer ||
        issue.canDropCandidate ||
        issue.canDropCluster),
  );
  return (
    <section
      className="sticky top-0 z-20 mb-4 max-h-[42vh] overflow-auto rounded border border-cyan-400/20 bg-[#0f1718] p-3 shadow-2xl shadow-black/35"
      data-vaa1-data-maturation-local-issue-drawer="true"
      data-vaa1-data-maturation-selected-issue={issue.id}
      data-vaa1-data-maturation-sticky-decision-drawer="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-300/80">
            Selected Maturation case
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-slate-100">
            {issue.title}
          </h3>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-300">
            {issue.detail}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100">
          {issue.status}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <IssueFact label="Issue" value={issue.summary} />
        <IssueFact label="Type" value={issue.kind} />
        <IssueFact label="Source" value={issue.sourcePanel || "panel-local"} />
        <IssueFact label="Source time" value={formatTimeRange(issue.timeRange)} />
        <IssueFact label="BBox/ROI" value={formatBBox(issue.bbox)} />
      </div>

      {issue.governanceFacts?.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {issue.governanceFacts.map((fact) => (
            <IssueFact key={`${fact.label}:${fact.value}`} label={fact.label} value={fact.value} />
          ))}
        </div>
      ) : null}

      <div
        className="mt-3 grid gap-2 md:grid-cols-3"
        data-vaa1-data-maturation-cluster-scanner-context="true"
      >
        <IssueFact label="Candidate" value={issue.candidateId || "none selected"} />
        <IssueFact label="Cluster" value={issue.clusterKey || "single candidate"} />
        <IssueFact label="SOM / scanner" value={issue.sourceRef || "no scanner source ref"} />
      </div>

      <div
        className="mt-3 rounded border border-white/10 bg-black/15 p-3"
        data-vaa1-data-maturation-quick-decision-console="true"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Quick decision
            </div>
            <div className="text-xs text-slate-300">
              {canAct
                ? issue.canStageAnnotation && !issue.canConfirm
                  ? "Stage this detected pattern for manual annotation, or drop/defer it here."
                  : "Confirm, defer, or drop this proliferated mature-data candidate here."
                : "This selected item is informational or already source-authoritative."}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 text-[10px]">
            <span
              className={`rounded border px-2 py-1 ${
                hasSourceTime
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-400/25 bg-amber-500/10 text-amber-100"
              }`}
              data-vaa1-data-maturation-source-time-status={hasSourceTime ? "anchored" : "missing"}
            >
              {hasSourceTime ? "time anchored" : "time missing"}
            </span>
            <span
              className={`rounded border px-2 py-1 ${
                hasSourceBox
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-400/25 bg-amber-500/10 text-amber-100"
              }`}
              data-vaa1-data-maturation-source-box-status={hasSourceBox ? "anchored" : "missing"}
            >
              {hasSourceBox ? "BBox/ROI anchored" : "BBox/ROI missing"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-45"
            data-vaa1-data-maturation-open-source-at-time="true"
            disabled={!hasSourceTime}
            onClick={() => onOpenAlignedPanel("VideoPanel", issue.timestamp)}
          >
            Open source at time
          </button>
          <button
            type="button"
            className="rounded border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-45"
            data-vaa1-data-maturation-quick-decision="confirm"
            disabled={!issue.canConfirm || !hasSourceTime}
            onClick={() =>
              onDecision(issue, "confirmed", issue.hypothesisId ? "hypothesis" : "candidate")
            }
          >
            Confirm proliferation
          </button>
          <button
            type="button"
            className="rounded border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-45"
            data-vaa1-data-maturation-quick-decision="stage-annotation"
            disabled={!issue.canStageAnnotation || !hasSourceTime}
            onClick={() => onDecision(issue, "staged_annotation", "candidate")}
          >
            Stage annotation
          </button>
          <button
            type="button"
            className="rounded border border-white/10 bg-[#202020] px-3 py-2 text-xs text-slate-100 hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-45"
            data-vaa1-data-maturation-quick-decision="defer"
            disabled={!issue.canDefer}
            onClick={() =>
              onDecision(issue, "deferred", issue.hypothesisId ? "hypothesis" : "candidate")
            }
          >
            Defer
          </button>
          <button
            type="button"
            className="rounded border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-45"
            data-vaa1-data-maturation-quick-decision="drop-candidate"
            disabled={!issue.canDropCandidate}
            onClick={() => onDecision(issue, "canceled", "candidate")}
          >
            Drop candidate
          </button>
          <button
            type="button"
            className="rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-45"
            data-vaa1-data-maturation-quick-decision="drop-cluster"
            disabled={!issue.canDropCluster}
            onClick={() => onDecision(issue, "canceled", "cluster")}
          >
            Drop cluster
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {alignedPanels.map((panel) => (
          <button
            key={panel}
            type="button"
            className="rounded border border-white/10 bg-[#202020] px-3 py-2 text-xs text-slate-100 hover:bg-[#2a2a2a]"
            data-vaa1-data-maturation-aligned-panel-action={panel}
            onClick={() => onOpenAlignedPanel(panel, issue.timestamp)}
          >
            Open {panel.replace(/([a-z])([A-Z])/g, "$1 $2")}
          </button>
        ))}
      </div>
    </section>
  );
}

function IssueFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/15 px-2 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-[11px] text-slate-200">{value}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  active = false,
  onInspect,
}: {
  label: string;
  value: number;
  detail: string;
  active?: boolean;
  onInspect?: (issue: GovernanceIssue) => void;
}) {
  const content = (
    <>
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
      <div className="mt-1 text-[11px] leading-4 text-slate-400">{detail}</div>
    </>
  );
  if (onInspect) {
    return (
      <button
        type="button"
        className={`rounded border px-3 py-3 text-left hover:border-cyan-400/35 hover:bg-[#141b1c] ${
          active ? "border-cyan-400/45 bg-[#102022]" : "border-white/10 bg-[#101010]"
        }`}
        data-vaa1-data-maturation-metric-card={label}
        data-vaa1-data-maturation-metric-active={active ? "true" : undefined}
        onClick={() => onInspect(issueFromMetric(label, value, detail))}
      >
        {content}
      </button>
    );
  }
  return (
    <div className="rounded border border-white/10 bg-[#101010] px-3 py-3">
      {content}
    </div>
  );
}

function Lane({
  title,
  status,
  dataAttr,
  constellationLane = false,
  nonUserCandidateLane = false,
  audiovisualSourceSamplingLane = false,
  liveProliferationBusLane = false,
  active = false,
  onInspect,
  children,
}: {
  title: string;
  status: string;
  dataAttr: string;
  constellationLane?: boolean;
  nonUserCandidateLane?: boolean;
  audiovisualSourceSamplingLane?: boolean;
  liveProliferationBusLane?: boolean;
  active?: boolean;
  onInspect?: (issue: GovernanceIssue) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded border p-3 ${
        active ? "border-cyan-400/45 bg-[#102022]" : "border-white/10 bg-[#101010]"
      }`}
      data-vaa1-data-maturation-lane={dataAttr}
      data-vaa1-data-maturation-lane-active={active ? "true" : undefined}
      data-vaa1-data-maturation-constellation-lane={constellationLane ? "true" : undefined}
      data-vaa1-data-maturation-non-user-candidate-lane={nonUserCandidateLane ? "true" : undefined}
      data-vaa1-data-maturation-audiovisual-source-sampling-lane={
        audiovisualSourceSamplingLane ? "true" : undefined
      }
      data-vaa1-data-maturation-live-proliferation-bus-lane={
        liveProliferationBusLane ? "true" : undefined
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        <button
          type="button"
          className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] hover:border-cyan-400/35 hover:text-cyan-100 ${
            active
              ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
              : "border-white/10 bg-[#181818] text-slate-400"
          }`}
          data-vaa1-data-maturation-lane-inspect={dataAttr}
          onClick={() =>
            onInspect?.(
              issueFromLane(
                title,
                status,
                typeof children === "string" ? children : `${title}: ${status}`,
              ),
            )
          }
        >
          {status}
        </button>
      </div>
      <p className="text-xs leading-5 text-slate-400">{children}</p>
    </section>
  );
}
