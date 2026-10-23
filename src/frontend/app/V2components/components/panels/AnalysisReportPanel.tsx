"use client";

import { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { apiService } from "@/lib/api-service";
import { useLayoutHost } from "../LayoutHost";
import { VideoService } from "@/lib/video-service";

type ReportMode = "scan" | "review";

const SECTIONS = [
  ["summary", "Summary"],
  ["scenes", "Scenes"],
  ["structure", "Narrative structure"],
  ["agents", "Narrative agents"],
  ["statistics", "Statistics"],
  ["language", "Quant + POS"],
  ["lenses", "Selected lenses"],
  ["maturity", "Analysis maturity"],
  ["comparison", "Comparison matrix"],
] as const;

const REPORT_MATRIX_STORAGE_KEY = "vaa1.analysis.report.matrix.analyses";

async function loadArtifact(analysisId: string, type: string) {
  const response = await fetch(`/api/local-analysis/${analysisId}/download/${type}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

function list(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function countRows(value: any): number {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return 0;
  for (const key of ["rows", "items", "results", "relationships", "scene_cards", "scenes", "profiles", "readings"]) {
    if (Array.isArray(value[key])) return value[key].length;
  }
  return 0;
}

function Missing({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-dashed border-slate-800 p-3 text-[11px] text-slate-500">{children}</div>;
}

export default function AnalysisReportPanel({ videoId: initialVideoId = "" }: { videoId?: string }) {
  const { openPanel } = useLayoutHost();
  const [videoId, setVideoId] = useState(initialVideoId || eventBus.getLast<string>("videoIdChanged") || "");
  const [mode, setMode] = useState<ReportMode>("scan");
  const [active, setActive] = useState("summary");
  const [completion, setCompletion] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [matrixRows, setMatrixRows] = useState<any[]>([]);
  const [selectedMatrixIds, setSelectedMatrixIds] = useState<string[]>([]);

  useEffect(() => {
    const handler = (id: string) => setVideoId(id);
    eventBus.on("videoIdChanged", handler);
    return () => eventBus.off("videoIdChanged", handler);
  }, []);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiService.getAnalysisCompletion(videoId),
      loadArtifact(videoId, "mise_en_scene_scene_cards"),
      loadArtifact(videoId, "narrative_lens_reading"),
      loadArtifact(videoId, "narrative_agent_continuity_projection"),
      loadArtifact(videoId, "native_statistical_interpretation"),
      loadArtifact(videoId, "pos_analysis"),
      loadArtifact(videoId, "quan_analysis"),
    ]).then(([nextCompletion, scenes, narrative, agents, statistics, pos, quant]) => {
      if (cancelled) return;
      setCompletion(nextCompletion);
      setArtifacts({ scenes, narrative, agents, statistics, pos, quant });
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;
    VideoService.list(200).then(async (records) => {
      const completed = records.filter((record) => record.status === "completed").slice(0, 30);
      const rows = await Promise.all(completed.map(async (record) => {
        try {
          const result = await apiService.getAnalysisCompletion(record.id);
          return { id: record.id, name: result.account?.source?.filename || record.name || record.id, ...result.account?.evidence };
        } catch {
          return { id: record.id, name: record.name || record.id, unavailable: true };
        }
      }));
      if (cancelled) return;
      setMatrixRows(rows);
      let saved: string[] = [];
      try { saved = JSON.parse(window.localStorage.getItem(REPORT_MATRIX_STORAGE_KEY) || "[]"); } catch { saved = []; }
      const eligible = saved.filter((id) => rows.some((row) => row.id === id));
      setSelectedMatrixIds(eligible.length ? eligible : rows.map((row) => row.id));
    });
    return () => { cancelled = true; };
  }, [videoId]);

  const toggleMatrixRow = (id: string) => {
    setSelectedMatrixIds((previous) => {
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
      window.localStorage.setItem(REPORT_MATRIX_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const account = completion?.account;
  const evidence = account?.evidence || {};
  const totalClaims = Number(evidence.confirmed || 0) + Number(evidence.candidates || 0) + Number(evidence.withheld || 0);
  const maturity = useMemo(() => [
    ["Confirmed", Number(evidence.confirmed || 0)],
    ["Candidate", Number(evidence.candidates || 0)],
    ["Withheld", Number(evidence.withheld || 0)],
    ["Artifacts", Number(evidence.artifact_count || 0)],
  ] as const, [evidence]);
  const sceneRows = list(artifacts.scenes?.scene_cards || artifacts.scenes?.scenes);
  const agentRows = list(artifacts.agents?.graph_projection?.nodes || artifacts.agents?.canonical_collection?.occurrences);
  const comparisonRows = useMemo(() => {
    const current = account ? [{ id: videoId, name: account.source?.filename || videoId, ...account.evidence }] : [];
    return [...current, ...matrixRows.filter((row) => row.id !== videoId)];
  }, [account, matrixRows, videoId]);

  const open = (panel: string) => openPanel(panel, videoId ? { videoId } : {});

  if (!videoId) return <div className="p-4 text-sm text-slate-500">Select an analysis to read its report.</div>;

  return <div className="flex h-full min-h-0 flex-col bg-[#151515] text-slate-200" data-vaa1-analysis-report="true">
    <header className="border-b border-slate-800 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Governed analysis report</div><h2 className="mt-1 text-base font-semibold">{account?.source?.filename || "Loading analysis…"}</h2><div className="mt-1 text-[10px] text-slate-500">{completion?.latest_edition?.label || "Working analysis"} · source-media clock · {String(videoId).slice(0, 8)}</div></div>
        <div className="flex rounded border border-slate-800 p-0.5 text-[10px]" aria-label="Report reading mode"><button onClick={() => setMode("scan")} className={`rounded px-2 py-1 ${mode === "scan" ? "bg-slate-700 text-white" : "text-slate-500"}`}>Fast scan</button><button onClick={() => setMode("review")} className={`rounded px-2 py-1 ${mode === "review" ? "bg-slate-700 text-white" : "text-slate-500"}`}>Evidence review</button></div>
      </div>
      <nav className="mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Analysis report sections">{SECTIONS.map(([id, label]) => <button key={id} onClick={() => setActive(id)} className={`whitespace-nowrap rounded px-2 py-1 text-[10px] ${active === id ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-400"}`}>{label}</button>)}</nav>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto p-4">
      {loading ? <div className="text-sm text-slate-500">Hydrating governed report sources…</div> : null}
      {!loading && active === "summary" && <section className="space-y-3"><h3 className="text-sm font-semibold">Summary</h3><p className="max-w-3xl text-[12px] leading-6 text-slate-300">This {account?.scope?.analysis_tier || "recorded"} analysis contains {evidence.confirmed || 0} confirmed findings, {evidence.candidates || 0} review candidates and {evidence.withheld || 0} withheld claims across {evidence.artifact_count || 0} governed artifacts. {account?.limitations?.length ? `${account.limitations.length} disclosed limitation(s) remain.` : "No recorded runtime limitation is disclosed in the completion account."}</p>{mode === "review" && <button onClick={() => open("MasterSchema")} className="rounded bg-slate-800 px-2 py-1 text-[10px]">Inspect claims in Master Schema</button>}</section>}
      {!loading && active === "scenes" && <section className="space-y-3"><h3 className="text-sm font-semibold">Scene-based summaries</h3>{sceneRows.length ? <div className="grid gap-2">{sceneRows.slice(0, mode === "scan" ? 5 : 50).map((scene: any, index: number) => <button key={scene.scene_id || index} onClick={() => open("SceneCards")} className="rounded border border-slate-800 p-3 text-left"><div className="text-[11px] font-medium">{scene.title || scene.label || `Scene ${index + 1}`}</div><div className="mt-1 line-clamp-3 text-[10px] leading-5 text-slate-400">{scene.summary || scene.description || "Source-linked scene record; open Scene Cards for evidence."}</div></button>)}</div> : <Missing>No governed scene summaries are available. Open Scene Cards to inspect missingness rather than generating prose.</Missing>}</section>}
      {!loading && active === "structure" && <section className="space-y-3"><h3 className="text-sm font-semibold">Narrative structure viewpoints</h3>{artifacts.narrative ? <><div className="text-[11px] text-slate-400">{countRows(artifacts.narrative)} governed narrative reading(s) are available.</div><button onClick={() => open("MeaningPlot")} className="rounded bg-slate-800 px-2 py-1 text-[10px]">Open narrative structure and evidence</button></> : <Missing>No governed narrative-structure reading is available for this analysis.</Missing>}</section>}
      {!loading && active === "agents" && <section className="space-y-3"><h3 className="text-sm font-semibold">Narrative agent summaries</h3>{artifacts.agents ? <><div className="text-[11px] text-slate-400">{agentRows.length || countRows(artifacts.agents)} source-linked agent record(s) are represented. Candidate and mature states remain distinct.</div><button onClick={() => open("ManualIdentification")} className="rounded bg-slate-800 px-2 py-1 text-[10px]">Open Narrative Agent panel</button></> : <Missing>No Narrative Agent continuity projection is available.</Missing>}</section>}
      {!loading && active === "statistics" && <section className="space-y-3"><h3 className="text-sm font-semibold">Statistical summary</h3>{artifacts.statistics ? <><div className="text-[11px] text-slate-400">{countRows(artifacts.statistics)} measured relationship or indicator record(s). Significance claims retain their method and eligibility.</div><button onClick={() => open("StatsKit")} className="rounded bg-slate-800 px-2 py-1 text-[10px]">Inspect indicators and significance</button></> : <Missing>No native statistical interpretation was produced for this analysis tier.</Missing>}</section>}
      {!loading && active === "language" && <section className="space-y-3"><h3 className="text-sm font-semibold">Quant and POS summaries</h3><div className="grid gap-2 sm:grid-cols-2">{[["POS", artifacts.pos, "POS"], ["Quant", artifacts.quant, "Quant"]].map(([label, value, panel]) => <div key={String(label)} className="rounded border border-slate-800 p-3"><div className="text-[11px] font-medium">{label}</div><div className="mt-1 text-[10px] text-slate-400">{value ? `${countRows(value)} governed row(s) available.` : "Not available for this analysis."}</div><button onClick={() => open(String(panel))} className="mt-2 rounded bg-slate-800 px-2 py-1 text-[10px]">Open {label}</button></div>)}</div></section>}
      {!loading && active === "lenses" && <section className="space-y-3"><h3 className="text-sm font-semibold">Selected-lens summaries</h3><p className="text-[11px] leading-5 text-slate-400">Lens readings remain attributable interpretations. This report indexes available readings; it does not silently merge them into canonical fact.</p><div className="flex gap-2"><button onClick={() => open("MeaningPlot")} className="rounded bg-slate-800 px-2 py-1 text-[10px]">Meaning / Plot</button><button onClick={() => open("StatsKit")} className="rounded bg-slate-800 px-2 py-1 text-[10px]">StatsKit</button></div></section>}
      {!loading && active === "maturity" && <section className="space-y-3"><h3 className="text-sm font-semibold">Analysis maturity graph</h3><div className="max-w-2xl space-y-2" role="img" aria-label="Analysis maturity graph">{maturity.map(([label, value]) => <div key={label}><div className="flex justify-between text-[10px] text-slate-400"><span>{label}</span><span>{value}</span></div><div className="mt-1 h-2 rounded bg-slate-900"><div className="h-2 rounded bg-slate-500" style={{ width: `${Math.max(3, totalClaims ? Math.min(100, value / totalClaims * 100) : value ? 100 : 3)}%` }} /></div></div>)}</div><div className="text-[10px] text-slate-500">Counts describe governed state, not analytical quality. Open Maturation for item-level provenance.</div><button onClick={() => open("DataMaturation")} className="rounded bg-slate-800 px-2 py-1 text-[10px]">Inspect maturity records</button></section>}
      {!loading && active === "comparison" && <section className="space-y-3" data-vaa1-analysis-report-comparison="true"><div><h3 className="text-sm font-semibold">Analysis report comparison matrix</h3><p className="mt-1 text-[10px] text-slate-500">Compare governed maturity and evidence volume across analyses in the active project. Counts are not normalized effect sizes.</p></div>{comparisonRows.length ? <div className="overflow-x-auto"><table className="min-w-full border-collapse text-left text-[10px]"><thead><tr className="border-b border-slate-700 text-slate-500"><th className="p-2">Use</th><th className="p-2">Analysis</th><th className="p-2 text-right">Confirmed</th><th className="p-2 text-right">Candidate</th><th className="p-2 text-right">Withheld</th><th className="p-2 text-right">Artifacts</th><th className="p-2">State</th></tr></thead><tbody>{comparisonRows.map((row) => <tr key={row.id} className={`border-b border-slate-900 ${selectedMatrixIds.includes(row.id) || row.id === videoId ? "text-slate-300" : "text-slate-600"}`}><td className="p-2"><input type="checkbox" checked={selectedMatrixIds.includes(row.id) || row.id === videoId} onChange={() => toggleMatrixRow(row.id)} aria-label={`Compare ${row.name}`} /></td><td className="max-w-[280px] truncate p-2" title={row.name}>{row.name}</td><td className="p-2 text-right">{row.confirmed ?? "—"}</td><td className="p-2 text-right">{row.candidates ?? "—"}</td><td className="p-2 text-right">{row.withheld ?? "—"}</td><td className="p-2 text-right">{row.artifact_count ?? "—"}</td><td className="p-2">{row.unavailable ? "completion account unavailable" : row.id === videoId ? "active" : "project"}</td></tr>)}</tbody></table></div> : <Missing>No completed project analyses are available for comparison.</Missing>}</section>}
    </main>
  </div>;
}
