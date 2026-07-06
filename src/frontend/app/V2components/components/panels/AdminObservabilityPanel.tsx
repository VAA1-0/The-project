"use client";

type AdminObservabilityPanelProps = {
  analysisId?: string;
  videoId?: string;
};

const programScopes = [
  "Upload",
  "Quick sweep",
  "Science scan",
  "Forensic scan",
  "Data maturation / iteration",
  "Manual program use",
  "Matcher / proliferation",
  "StatsKit / SignificanceKit / RelevanceKit maturation",
  "Export",
  "UI render",
];

const observabilitySections = [
  "Runtime environment",
  "Pipeline stage observations",
  "Resource observations",
  "Cache and database observations",
  "UI responsiveness",
  "Provenance integrity",
  "Bottleneck findings",
  "Operational verdict",
];

const economicsSections = [
  "Compute, storage, and analyst cost",
  "Candidate, reviewed, confirmed, mature, rejected, deferred, and orphan yield",
  "Noise ratio and maturation rate",
  "Analyst and compute cost per mature item",
  "Reuse across downstream program surfaces",
  "Iteration ROI and diminishing returns",
  "Economic verdict",
];

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
      {children}
    </span>
  );
}

function AdminSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/10 py-4">
      <div className="mb-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
          {title}
        </h3>
        <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-400">
          {subtitle}
        </p>
      </div>
      {children}
    </section>
  );
}

export default function AdminObservabilityPanel({
  analysisId,
  videoId,
}: AdminObservabilityPanelProps) {
  const activeAnalysisId = analysisId || videoId || "no active analysis";

  return (
    <div
      data-vaa1-admin-observability-panel="true"
      className="h-full overflow-auto bg-[#101113] p-4 text-slate-200"
    >
      <header className="mb-4 border-b border-cyan-400/20 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Admin / under the hood
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-50">
              Performance Observability And Maturation Economics
            </h2>
            <p className="mt-2 max-w-4xl text-[12px] leading-5 text-slate-400">
              Developer-facing view for full program observability. This leaf is
              not an analyst workbench and should stay separate from StatsKit,
              SignificanceKit, and RelevanceKit operational surfaces.
            </p>
          </div>
          <StatusPill>schema ready / artifact writer pending</StatusPill>
        </div>
        <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3">
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-slate-500">Active analysis</div>
            <div className="mt-1 font-mono text-cyan-100">{activeAnalysisId}</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-slate-500">Observability schema</div>
            <div className="mt-1 font-mono text-cyan-100">
              vaa1.performance_observability_layer
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-slate-500">Economics schema</div>
            <div className="mt-1 font-mono text-cyan-100">
              vaa1.data_maturation_economics
            </div>
          </div>
        </div>
      </header>

      <AdminSection
        title="Navigation Contract"
        subtitle="This is the in-program Admin leaf for developer diagnostics. It should be opened from Tools or the Window menu and should not be mixed into analyst panels."
      >
        <div
          data-vaa1-admin-observability-navigation-contract="true"
          className="grid gap-2 sm:grid-cols-2"
        >
          <div className="rounded border border-white/10 bg-[#15171a] p-3">
            <div className="text-[11px] font-semibold text-slate-100">
              Current navigation
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">
              Open from Tools as "Open Admin / Observability" or from the top
              Window menu as "Admin / Observability".
            </p>
          </div>
          <div className="rounded border border-white/10 bg-[#15171a] p-3">
            <div className="text-[11px] font-semibold text-slate-100">
              Intended artifact location
            </div>
            <p className="mt-2 font-mono text-[11px] leading-5 text-slate-400">
              outputs/&lt;analysis_id&gt;/observability/
              performance_observability_*.json
              <br />
              outputs/&lt;analysis_id&gt;/observability/
              data_maturation_economics_*.json
            </p>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Program Scope"
        subtitle="The observability layer is whole-program infrastructure, spanning runtime paths and manual interaction paths."
      >
        <div
          data-vaa1-admin-observability-program-scope="true"
          className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"
        >
          {programScopes.map((scope) => (
            <div
              key={scope}
              className="rounded border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-slate-300"
            >
              {scope}
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        title="Performance Observability"
        subtitle="Answers whether Datascene can run, where it is expensive, and which runtime stage requires engineering attention."
      >
        <div
          data-vaa1-admin-performance-observability-contract="true"
          className="grid gap-2 md:grid-cols-2"
        >
          {observabilitySections.map((section) => (
            <div
              key={section}
              className="rounded border border-cyan-400/15 bg-cyan-400/5 px-3 py-2 text-[11px] text-cyan-50"
            >
              {section}
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        title="Data Maturation Economics"
        subtitle="Answers whether a maturation or iteration pass created enough reusable mature value to justify its cost."
      >
        <div
          data-vaa1-admin-maturation-economics-contract="true"
          className="grid gap-2 md:grid-cols-2"
        >
          {economicsSections.map((section) => (
            <div
              key={section}
              className="rounded border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-[11px] text-emerald-50"
            >
              {section}
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        title="Run Artifact Status"
        subtitle="The leaf is navigable now. The next backend slice should write actual observability and economics artifacts for this panel to read."
      >
        <div
          data-vaa1-admin-observability-artifact-empty-state="true"
          className="rounded border border-amber-300/20 bg-amber-400/10 p-3 text-[11px] leading-5 text-amber-50"
        >
          No persisted observability run has been loaded in this first Admin
          leaf yet. This is expected until the writer records actual
          PerformanceObservability and DataMaturationEconomics JSON artifacts
          under the active analysis.
        </div>
      </AdminSection>
    </div>
  );
}
