import { useState } from "react";
import type { NativeStatisticalInterpretationRun } from "@/lib/api-service";
import { openVideoAtTime } from "@/lib/video-navigation";

type Props = {
  run?: NativeStatisticalInterpretationRun | null;
  panel: "statskit" | "search" | "scene_cards" | "narrative_agent" | "meaning_network" | "meaning_plot" | "data_maturation" | "master_schema" | "traceback" | "publication";
  onOpenStatistic?: (metricId: string, metricLabel: string) => void;
  defaultOpen?: boolean;
};

const label = (value?: string) => (value || "").replace(/_/g, " ");

export default function NativeStatisticalInterpretationStrip({ run, panel, onOpenStatistic, defaultOpen = true }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const finding = run?.finding;
  if (!finding?.finding_id) return null;
  const route = run?.panel_routes?.[panel];
  const interval = finding.source_interval;
  const observations = finding.observations || [];
  const relationships = run?.relationships || [];
  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="rounded border border-cyan-950/70 bg-[#0b1214] px-3 py-2 text-[10px] text-slate-300"
      data-vaa1-native-statistical-interpretation={panel}
    >
      <summary className="cursor-pointer list-none font-semibold text-cyan-200 marker:hidden">
        Statistical overview
      </summary>
      <div className="mt-2 grid gap-2">
        <div>
          {finding.independent_signal_family_count || 0} measured signal families form a cross-signal pattern at{" "}
          <span className="font-mono text-cyan-100">
            {Number(interval?.start_seconds || 0).toFixed(3)}–{Number(interval?.end_seconds || 0).toFixed(3)} s
          </span>.
          {run?.analysis_id ? (
            <button
              type="button"
              className="ml-2 rounded border border-cyan-700/60 px-2 py-0.5 text-cyan-100 hover:bg-cyan-950/40"
              onClick={() => openVideoAtTime(run.analysis_id || "", Number(interval?.start_seconds || 0))}
            >
              Open source interval
            </button>
          ) : null}
        </div>
        {panel !== "statskit" && route ? <div className="text-slate-400">{label(route.role)} · {label(route.status)}</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="text-[9px] uppercase tracking-wide text-slate-500">
              <tr><th className="py-1 pr-3">Statistic</th><th className="py-1 pr-3">Observed</th><th className="py-1 pr-3">Baseline median</th><th className="py-1">Robust z</th></tr>
            </thead>
            <tbody>
              {observations.map((item) => (
                <tr key={item.observation_id || item.metric_id} className="border-t border-slate-900">
                  <td className="py-1 pr-3">
                    {onOpenStatistic ? (
                      <button
                        type="button"
                        className="text-left font-semibold text-cyan-100 underline decoration-cyan-800 underline-offset-2 hover:text-cyan-50"
                        onClick={() => onOpenStatistic(item.metric_id || "", item.metric_label || item.metric_id || "")}
                        data-vaa1-open-statistical-pattern-in-workbench="true"
                      >
                        {item.metric_label || item.metric_id}
                      </button>
                    ) : item.metric_label || item.metric_id}
                  </td>
                  <td className="py-1 pr-3 font-mono">{item.observed_value} {item.unit}</td>
                  <td className="py-1 pr-3 font-mono">{item.baseline?.median ?? "unavailable"}</td>
                  <td className="py-1 font-mono">{item.standardized_deviation?.value == null ? "unavailable" : item.standardized_deviation.value.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {relationships.length ? (
          <div>
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-violet-200">Cross-signal associations</div>
            <div className="grid gap-1">
              {relationships.slice(0, 8).map((relationship) => (
                <div key={relationship.relationship_id} className="grid gap-1 border-t border-slate-900 py-1 md:grid-cols-[1fr_auto]">
                  <div>{relationship.substantive_reading || relationship.interpretation}</div>
                  <div className="font-mono text-violet-200">
                    ρ {Number(relationship.coefficient || 0).toFixed(3)} · n={relationship.scene_count || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
