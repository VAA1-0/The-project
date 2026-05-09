import React, { useCallback, useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type AnalysisData } from "@/lib/video-service";
import { openVideoAtTime } from "@/lib/video-navigation";
import type { SecondOrderLabelInstruction } from "@/lib/api-service";

type PlotLens = "aristotle" | "freytag" | "campbell" | "frye" | "booker";

const PLOT_LENSES: Array<{ id: PlotLens; label: string }> = [
  { id: "aristotle", label: "Aristotle" },
  { id: "freytag", label: "Freytag" },
  { id: "campbell", label: "Campbell" },
  { id: "frye", label: "Frye" },
  { id: "booker", label: "Booker" },
];

const CHARACTER_FAMILIES = new Set([
  "Identification",
  "Interaction",
  "Role",
  "Relationship",
  "Affect",
  "Intensity",
]);

const PLOT_FAMILIES = new Set(["Scene", "Episode", "Situation", "Action", "ReportClaim"]);

function secondsFromInstruction(instruction: SecondOrderLabelInstruction): number {
  const raw = instruction.time_span?.start_ms ?? instruction.time_span?.start ?? 0;
  const number = Number(raw || 0);
  return instruction.time_span?.start_ms !== undefined || number > 1000 ? number / 1000 : number;
}

function endSecondsFromInstruction(instruction: SecondOrderLabelInstruction): number {
  const raw =
    instruction.time_span?.end_ms ??
    instruction.time_span?.end ??
    instruction.time_span?.start_ms ??
    instruction.time_span?.start ??
    0;
  const number = Number(raw || 0);
  return instruction.time_span?.end_ms !== undefined || number > 1000 ? number / 1000 : number;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function confidence(instruction: SecondOrderLabelInstruction): number {
  return instruction.open_scores?.weighted_support_score ?? 0;
}

function instructionLabel(instruction: SecondOrderLabelInstruction): string {
  return `${instruction.target_label_family} / ${instruction.candidate_label}`;
}

function sourceRefSummary(instruction: SecondOrderLabelInstruction): string {
  const refs = instruction.source_evidence_refs || [];
  if (refs.length === 0) {
    return "source traceback";
  }
  const first = refs[0];
  const firstLabel = first.evidence_id || first.evidence_kind || "source";
  return refs.length === 1 ? String(firstLabel) : `${firstLabel} +${refs.length - 1}`;
}

function plotLensTerms(instruction: SecondOrderLabelInstruction, lens: PlotLens): string[] {
  const payload = (instruction.source_feature_payload || {}) as Record<string, any>;
  const lenses = (payload.alternative_plot_lenses || {}) as Record<string, unknown>;
  const terms = lenses[lens];
  if (Array.isArray(terms) && terms.length > 0) {
    return terms.map(String);
  }
  if (lens === "freytag" && (PLOT_FAMILIES.has(instruction.target_label_family) || CHARACTER_FAMILIES.has(instruction.target_label_family))) {
    return [instruction.candidate_label];
  }
  return [];
}

function groupByParticipant(instructions: SecondOrderLabelInstruction[]) {
  const groups = new Map<string, SecondOrderLabelInstruction[]>();
  for (const instruction of instructions) {
    const participants = instruction.participants_involved?.length
      ? instruction.participants_involved
      : ["unknown participant"];
    for (const participant of participants) {
      const key = String(participant || "unknown participant");
      groups.set(key, [...(groups.get(key) || []), instruction]);
    }
  }
  return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

interface InstructionItemProps {
  instruction: SecondOrderLabelInstruction;
  activeLens: PlotLens;
  showLens?: boolean;
  onNavigate: (instruction: SecondOrderLabelInstruction) => void;
}

const InstructionItem = React.memo(function InstructionItem({
  instruction,
  activeLens,
  showLens,
  onNavigate,
}: InstructionItemProps) {
  const start = secondsFromInstruction(instruction);
  const end = endSecondsFromInstruction(instruction);
  const lensTerms = showLens ? plotLensTerms(instruction, activeLens) : [];

  const displayLabel = showLens && lensTerms.length > 0
    ? `${instruction.target_label_family} / ${lensTerms[0].replaceAll("_", " ")}`
    : instructionLabel(instruction);

  return (
    <button
      type="button"
      onClick={() => onNavigate(instruction)}
      className="w-full rounded border border-slate-800 bg-[#101010] px-2.5 py-2 text-left hover:border-cyan-700/60 hover:bg-cyan-950/10"
      title={`Jump to source ${formatTime(start)}. Traceback: ${sourceRefSummary(instruction)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] text-slate-100">{displayLabel}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {formatTime(start)}-{formatTime(end)} • {instruction.status} • {sourceRefSummary(instruction)}
          </div>
        </div>
        <div className="shrink-0 text-[10px] text-cyan-200">
          {Math.round(confidence(instruction) * 100)}%
        </div>
      </div>
      {lensTerms.length ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {lensTerms.slice(0, 4).map((term) => (
            <span
              key={`${instruction.instruction_id}:${activeLens}:${term}`}
              className="rounded border border-cyan-800/50 bg-cyan-950/25 px-1.5 py-0.5 text-[10px] text-cyan-100"
            >
              {term.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
});

export default function MeaningPlotPanel({ videoId: initialVideoId = "" }: { videoId?: string }) {
  const [selectedVideoId, setSelectedVideoId] = useState(initialVideoId);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLens, setActiveLens] = useState<PlotLens>("freytag");

  useEffect(() => {
    const handler = (id: string) => setSelectedVideoId(id);
    eventBus.on("videoIdChanged", handler);
    return () => eventBus.off("videoIdChanged", handler);
  }, []);

  useEffect(() => {
    if (!selectedVideoId) {
      setAnalysisData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    VideoService.getAnalysis(selectedVideoId)
      .then((data) => {
        if (!cancelled) {
          setAnalysisData(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysisData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVideoId]);

  const instructions = analysisData?.secondOrderLabelProliferation?.instructions || [];
  const plotInstructions = useMemo(
    () =>
      instructions
        .filter((instruction) => PLOT_FAMILIES.has(instruction.target_label_family))
        .filter((instruction) => plotLensTerms(instruction, activeLens).length > 0)
        .sort((left, right) => secondsFromInstruction(left) - secondsFromInstruction(right)),
    [instructions, activeLens],
  );
  const characterInstructions = useMemo(
    () =>
      instructions
        .filter((instruction) => CHARACTER_FAMILIES.has(instruction.target_label_family))
        .filter((instruction) => plotLensTerms(instruction, activeLens).length > 0)
        .sort((left, right) => confidence(right) - confidence(left)),
    [instructions, activeLens],
  );

  const navigateToInstruction = useCallback((instruction: SecondOrderLabelInstruction) => {
    if (!selectedVideoId) {
      return;
    }
    openVideoAtTime(selectedVideoId, secondsFromInstruction(instruction));
  }, [selectedVideoId]);

  const participantGroups = groupByParticipant(characterInstructions);

  return (
    <div className="flex h-full flex-col bg-[#161616] text-slate-100">
      <div className="border-b border-white/8 bg-[#141414] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Meaning / Plot
            </div>
            <div className="mt-1 truncate text-[11px] text-slate-500">
              Navigable second-order paths; every indication jumps to source evidence.
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            {instructions.length} candidates
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {PLOT_LENSES.map((lens) => (
            <button
              key={lens.id}
              type="button"
              onClick={() => setActiveLens(lens.id)}
              className={`rounded border px-2 py-1 text-[11px] ${
                activeLens === lens.id
                  ? "border-cyan-600/60 bg-cyan-950/35 text-cyan-100"
                  : "border-white/10 bg-[#101010] text-slate-400 hover:bg-white/5"
              }`}
            >
              {lens.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <div className="rounded border border-white/8 bg-[#121212] px-4 py-4 text-sm text-slate-400">
            Loading meaning paths...
          </div>
        ) : !selectedVideoId ? (
          <div className="rounded border border-white/8 bg-[#121212] px-4 py-4 text-sm text-slate-400">
            Open an analysis to view meaning and plot paths.
          </div>
        ) : instructions.length === 0 ? (
          <div className="rounded border border-white/8 bg-[#121212] px-4 py-4 text-sm text-slate-400">
            No second-order meaning candidates surfaced for this analysis yet.
          </div>
        ) : (
          <div className="grid h-full min-h-0 min-w-[980px] grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-3">
            <section className="flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]">
              <div className="border-b border-white/8 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Plot Path
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {PLOT_LENSES.find((lens) => lens.id === activeLens)?.label} lens over shared source evidence
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
                {plotInstructions.length ? (
                  plotInstructions.map((instruction) => (
                    <InstructionItem
                      key={instruction.instruction_id}
                      instruction={instruction}
                      activeLens={activeLens}
                      showLens
                      onNavigate={navigateToInstruction}
                    />
                  ))
                ) : (
                  <div className="px-2 py-3 text-[12px] text-slate-500">
                    No plot-path candidates yet.
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]">
              <div className="border-b border-white/8 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Character Paths
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Care, power, role, relation, affect, and intensity candidates.
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-auto p-2">
                {participantGroups.length ? (
                  participantGroups.map(([participant, items]) => (
                    <div key={participant} className="rounded border border-slate-800 bg-[#101010]/60">
                      <div className="border-b border-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300">
                        {participant}
                      </div>
                      <div className="space-y-1.5 p-1.5">
                        {items.slice(0, 8).map((instruction) => (
                          <InstructionItem
                            key={instruction.instruction_id}
                            instruction={instruction}
                            activeLens={activeLens}
                            showLens
                            onNavigate={navigateToInstruction}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-3 text-[12px] text-slate-500">
                    No character-path candidates yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
