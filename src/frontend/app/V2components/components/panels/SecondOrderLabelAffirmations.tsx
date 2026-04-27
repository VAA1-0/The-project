"use client";

import React from "react";
import type {
  SecondOrderLabelInstruction,
  SecondOrderLabelProliferationPlan,
} from "@/lib/api-service";

type TimeSpanSeconds = {
  start?: number;
  end?: number;
};

type ChipSurface =
  | "bbox_roi_overlay"
  | "objects_panel"
  | "master_schema"
  | "meaning_panel"
  | "printout"
  | string;

type ChipProps = {
  plan?: SecondOrderLabelProliferationPlan | null;
  surface: ChipSurface;
  targetLabelFamilies?: string[];
  timeSpan?: TimeSpanSeconds | null;
  compact?: boolean;
  limit?: number;
  emptyText?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  candidate: "Candidate",
  probable: "Probable",
  strongly_supported: "Strong",
  analyst_confirmed: "Confirmed",
};

const STATUS_CLASSES: Record<string, string> = {
  candidate: "border-slate-700 bg-slate-900/60 text-slate-200",
  probable: "border-sky-700/70 bg-sky-950/45 text-sky-100",
  strongly_supported: "border-emerald-700/70 bg-emerald-950/45 text-emerald-100",
  analyst_confirmed: "border-cyan-600/70 bg-cyan-950/55 text-cyan-100",
};

const GOVERNANCE_NOTE = "analyst_confirmation_is_not_required_for_every_candidate";

function normalizeSeconds(value?: number): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return value > 1000 ? value / 1000 : value;
}

function instructionStart(instruction: SecondOrderLabelInstruction): number | null {
  return normalizeSeconds(instruction.time_span?.start ?? instruction.time_span?.start_ms);
}

function instructionEnd(instruction: SecondOrderLabelInstruction): number | null {
  return normalizeSeconds(instruction.time_span?.end ?? instruction.time_span?.end_ms);
}

function overlaps(instruction: SecondOrderLabelInstruction, span?: TimeSpanSeconds | null): boolean {
  if (!span || typeof span.start !== "number" || typeof span.end !== "number") {
    return true;
  }
  const start = instructionStart(instruction);
  const end = instructionEnd(instruction);
  if (start === null || end === null) {
    return true;
  }
  return start <= span.end && end >= span.start;
}

function priority(instruction: SecondOrderLabelInstruction): number {
  return instruction.open_scores?.delivery_priority ?? instruction.open_scores?.weighted_support_score ?? 0;
}

function labelFor(instruction: SecondOrderLabelInstruction): string {
  const status = STATUS_LABELS[instruction.status] || instruction.status || "Candidate";
  return `${status}: ${instruction.target_label_family} / ${instruction.candidate_label}`;
}

function titleFor(instruction: SecondOrderLabelInstruction): string {
  const score = instruction.open_scores?.weighted_support_score;
  const priorityScore = instruction.open_scores?.delivery_priority;
  const confirmation = instruction.requires_immediate_confirmation
    ? "Review prompt"
    : "No immediate confirmation";
  return [
    labelFor(instruction),
    typeof score === "number" ? `support ${Math.round(score * 100)}%` : null,
    typeof priorityScore === "number" ? `priority ${Math.round(priorityScore * 100)}%` : null,
    confirmation,
    "Manual override remains available",
  ]
    .filter(Boolean)
    .join(" • ");
}

export function getSecondOrderInstructionsForSurface({
  plan,
  surface,
  targetLabelFamilies,
  timeSpan,
  limit,
}: ChipProps): SecondOrderLabelInstruction[] {
  const familySet = new Set(targetLabelFamilies || []);
  const instructions = (plan?.instructions || [])
    .filter((instruction) => instruction.may_surface_in_ui !== false)
    .filter((instruction) => (instruction.ui_surfaces || []).includes(surface))
    .filter((instruction) => familySet.size === 0 || familySet.has(instruction.target_label_family))
    .filter((instruction) => overlaps(instruction, timeSpan))
    .sort((left, right) => priority(right) - priority(left));

  return typeof limit === "number" ? instructions.slice(0, limit) : instructions;
}

export function SecondOrderLabelAffirmationChips({
  plan,
  surface,
  targetLabelFamilies,
  timeSpan,
  compact = false,
  limit = 4,
  emptyText = null,
}: ChipProps) {
  const instructions = getSecondOrderInstructionsForSurface({
    plan,
    surface,
    targetLabelFamilies,
    timeSpan,
    limit,
  });

  if (instructions.length === 0) {
    return emptyText ? (
      <div className="text-[10px] text-slate-500">{emptyText}</div>
    ) : null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "text-[9px]" : "text-[10px]"}`}>
      {instructions.map((instruction) => {
        const cls = STATUS_CLASSES[instruction.status] || STATUS_CLASSES.candidate;
        const prompt = instruction.requires_immediate_confirmation;
        return (
          <span
            key={instruction.instruction_id}
            title={titleFor(instruction)}
            className={`max-w-full truncate rounded border px-1.5 py-0.5 ${cls} ${
              prompt ? "ring-1 ring-amber-300/60" : ""
            }`}
          >
            {prompt ? "Review: " : ""}
            {labelFor(instruction)}
          </span>
        );
      })}
    </div>
  );
}

export function SecondOrderLabelReviewTray({
  plan,
}: {
  plan?: SecondOrderLabelProliferationPlan | null;
}) {
  if (!plan?.instructions?.length) {
    return null;
  }
  const immediate = plan.summary?.immediate_confirmation_count || 0;
  const statusCounts = plan.summary?.status_counts || {};
  return (
    <section className="my-2 rounded border border-cyan-800/40 bg-cyan-950/15 px-3 py-2 text-[11px] text-cyan-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Second-order label affirmations</div>
          <div className="mt-0.5 text-[10px] text-cyan-200/80">
            Open-weight labels surface as candidates, probable, or strong support. Manual override
            stays authoritative.
          </div>
          <div className="sr-only">{GOVERNANCE_NOTE}</div>
        </div>
        <div className="shrink-0 text-right text-[10px] text-cyan-200/80">
          {plan.summary?.instruction_count || plan.instructions.length} labels
          {immediate ? ` • ${immediate} review` : " • no confirmation tax"}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        {Object.entries(statusCounts).map(([status, count]) => (
          <span
            key={status}
            className={`rounded border px-1.5 py-0.5 ${STATUS_CLASSES[status] || STATUS_CLASSES.candidate}`}
          >
            {STATUS_LABELS[status] || status}: {count}
          </span>
        ))}
      </div>
    </section>
  );
}
