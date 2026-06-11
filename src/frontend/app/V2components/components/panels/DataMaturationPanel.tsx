"use client";

import React, { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type AnalysisData } from "@/lib/video-service";
import { useLayoutHost } from "../LayoutHost";

type ProliferationMode = "guarded" | "dynamic" | "research";

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
};

type QualityTicket = {
  id: string;
  severity: "ok" | "warn" | "blocked";
  title: string;
  detail: string;
  targetPanel: string;
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

  const rows: GovernanceMatrixRow[] = [];

  manualVisualAnnotations.slice(0, 6).forEach((item, index) => {
    const id = textFrom(item.id, `manual-${index}`);
    const metadata = asRecord(item.metadata_correlation);
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
    });
  });

  resolvedEvidence.slice(0, 6).forEach((item, index) => {
    const metadata = asRecord(item.metadata);
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
    });
  });

  proliferationDecisions.slice(0, 4).forEach((item, index) => {
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
    });
  });

  matchCandidates.slice(0, 4).forEach((item, index) => {
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
    });
  });

  return rows.slice(0, 12);
}

function buildQualityTickets(
  metrics: {
    manualAnchorCount: number;
    candidateCount: number;
    matureWriteCount: number;
    matureSurfaces: number;
    proliferationDecisions: number;
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
      detail: "Candidate evidence is present without durable promotion/cancel/defer decisions.",
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

export default function DataMaturationPanel({ videoId: initialVideoId }: DataMaturationPanelProps) {
  const { openPanel } = useLayoutHost();
  const [videoId, setVideoId] = useState(initialVideoId || "");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ProliferationMode>("dynamic");

  useEffect(() => {
    const videoHandler = (id: string) => {
      setVideoId(id || "");
    };
    const correctionHandler = (id?: string) => {
      if (!id || id === videoId) {
        setVideoId((current) => current);
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
      setAnalysisData(null);
      return;
    }

    setLoading(true);
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
  }, [videoId]);

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
    const sourceSamples = asArray(source.sourceSamples);
    const audioSampleClouds = asArray(asRecord(source.audioSampleClouds).clouds);
    const audiovisualSampleCount = sourceSamples.length + audioSampleClouds.length;
    const resolvedEvidence = asArray(asRecord(source.masterSchemaResolvedEvidence).records).length;
    const matureSurfaces = countMatureSurfaces(source.masterSchemaMaturityAudit);
    const manualAnchorCount = manualVisualAnnotations.length + confirmedDecisions;
    const candidateCount = matchCandidates + secondOrderInstructions.length + agentPersistence.review;
    const matureWriteCount = matureSurfaces + resolvedEvidence + agentPersistence.accepted + confirmedDecisions;
    const temporalCoverage = temporalCoverageAudit(source);
    const busStatus: "ok" | "warn" | "blocked" =
      manualAnchorCount > 0 && candidateCount > 0 && matureWriteCount > 0
        ? "ok"
        : candidateCount > 0 && matureWriteCount === 0
          ? "blocked"
          : "warn";
    const governanceMatrixRows = buildGovernanceMatrixRows(source);

    return {
      manualVisualAnnotations: manualVisualAnnotations.length,
      proliferationDecisions: proliferationDecisions.length,
      confirmedDecisions,
      rejectedDecisions,
      secondOrderInstructions: secondOrderInstructions.length,
      matchCandidates,
      resolvedEvidence,
      matureSurfaces,
      sourceSamples: sourceSamples.length,
      audioSampleClouds: audioSampleClouds.length,
      audiovisualSampleCount,
      agentPersistence,
      manualAnchorCount,
      candidateCount,
      matureWriteCount,
      busStatus,
      governanceMatrixRows,
      temporalCoverage,
    };
  }, [analysisData]);

  const qualityTickets = useMemo(
    () => buildQualityTickets(metrics),
    [metrics],
  );

  const openGovernedPanel = (panelType: string) => {
    if (videoId) {
      eventBus.emit("videoIdChanged", videoId);
    }
    openPanel(panelType, videoId ? { videoId } : {});
    if (videoId) {
      window.setTimeout(() => eventBus.emit("videoIdChanged", videoId), 0);
    }
  };

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
                onClick={() => setMode(item)}
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
            ? "Bus is active: anchors, candidates, and mature writes are all present."
            : metrics.busStatus === "blocked"
              ? "Candidate-rich, mature-write-light: evidence exists but the bus is not installing enough mature surfaces."
              : "Partial signal: confirm or stage more anchors before trusting broad proliferation."}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-4">
        <MetricCard label="Manual anchors" value={metrics.manualAnchorCount} detail={`${metrics.manualVisualAnnotations} visual, ${metrics.confirmedDecisions} accepted decisions`} />
        <MetricCard label="Candidates" value={metrics.candidateCount} detail={`${metrics.matchCandidates} matcher, ${metrics.secondOrderInstructions} second-order`} />
        <MetricCard label="Mature writes" value={metrics.matureWriteCount} detail={`${metrics.matureSurfaces} surfaces, ${metrics.resolvedEvidence} resolved evidence`} />
        <MetricCard label="Review pressure" value={metrics.agentPersistence.review + metrics.rejectedDecisions} detail={`${metrics.agentPersistence.labels} persistence labels tracked`} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <Lane
          title="Manual confirmed anchors"
          status="source of truth"
          dataAttr="manual-anchors"
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
        >
          Detector-only evidence should stop disappearing into conservative review:
          dynamic mode should stage it with confidence, traceability, and a clear
          cancel path.
        </Lane>
        <Lane title="Mature data surfaces" status="delivery" dataAttr="mature-surfaces">
          Mature writes should appear in Master Schema, Meaning Network, Traceback,
          and source-timed panels as reusable analytic leverage for the annotator.
        </Lane>
        <Lane
          title="Audiovisual source sampling"
          status="not operationalized"
          dataAttr="audiovisual-source-sampling"
          audiovisualSourceSamplingLane
        >
          Visual/audio source samples and sample clouds should become regular
          multimodal anchors for matching, traceback, and promotion, not only
          optional forensic artifacts. Current samples: {metrics.audiovisualSampleCount}
          {" "}({metrics.sourceSamples} source, {metrics.audioSampleClouds} audio clouds).
        </Lane>
        <Lane
          title="Live proliferation bus"
          status="v2 requirement"
          dataAttr="live-proliferation-bus"
          liveProliferationBusLane
        >
          Mature data needs a signal-triggered sweep from hydrated artifacts to
          candidate generation, promotion eligibility, decision ledger, panel
          projection, Meaning Network continuity, and traceback. Matcher output
          should remain candidate-only until a promotion decision exists.
        </Lane>
      </div>

      <section
        className="mt-4 rounded border border-white/10 bg-[#101010] p-3"
        data-vaa1-data-maturation-governance-matrix="true"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Governance matrix
            </div>
            <div className="text-sm font-semibold text-slate-100">
              Mature claim and candidate surface audit
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            {metrics.governanceMatrixRows.length} inspectable rows
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
                <th className="py-2 pr-3">Propagation</th>
                <th className="py-2 pr-3">Review</th>
                <th className="py-2 pr-3">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {metrics.governanceMatrixRows.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={7}>
                    No governed claims are visible for this analysis yet.
                  </td>
                </tr>
              ) : (
                metrics.governanceMatrixRows.map((row) => (
                  <tr key={row.id} data-vaa1-data-maturation-governance-row={row.id}>
                    <td className="max-w-[220px] py-2 pr-3">
                      <div className="truncate text-slate-100">{row.label}</div>
                      <div className="truncate font-mono text-[10px] text-slate-500">{row.id}</div>
                    </td>
                    <td className="py-2 pr-3 text-cyan-100">{row.authority}</td>
                    <td className="py-2 pr-3 text-slate-300">{row.maturity}</td>
                    <td className="py-2 pr-3 text-slate-400">{row.source}</td>
                    <td className="py-2 pr-3 text-slate-400">{row.propagation}</td>
                    <td className="py-2 pr-3 text-amber-100">{row.reviewNeed}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className="rounded border border-white/10 bg-[#181818] px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                        onClick={() => openGovernedPanel(row.panel)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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
                  onClick={() => openGovernedPanel(ticket.targetPanel)}
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

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded border border-white/10 bg-[#101010] px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
      <div className="mt-1 text-[11px] leading-4 text-slate-400">{detail}</div>
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
  children,
}: {
  title: string;
  status: string;
  dataAttr: string;
  constellationLane?: boolean;
  nonUserCandidateLane?: boolean;
  audiovisualSourceSamplingLane?: boolean;
  liveProliferationBusLane?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded border border-white/10 bg-[#101010] p-3"
      data-vaa1-data-maturation-lane={dataAttr}
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
        <div className="rounded border border-white/10 bg-[#181818] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-400">
          {status}
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-400">{children}</p>
    </section>
  );
}
