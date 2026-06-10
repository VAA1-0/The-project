"use client";

import React, { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type AnalysisData } from "@/lib/video-service";
import { useLayoutHost } from "../LayoutHost";

type ProliferationMode = "guarded" | "dynamic" | "research";

type DataMaturationPanelProps = {
  videoId?: string;
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
    const busStatus: "ok" | "warn" | "blocked" =
      manualAnchorCount > 0 && candidateCount > 0 && matureWriteCount > 0
        ? "ok"
        : candidateCount > 0 && matureWriteCount === 0
          ? "blocked"
          : "warn";

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
    };
  }, [analysisData]);

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
