import React, { useEffect, useMemo, useRef, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import {
  VideoService,
  type AnalysisData,
  type MatureEvidenceAuthority,
} from "@/lib/video-service";
import { apiService } from "@/lib/api-service";
import type {
  IdentityCandidate,
  IdentityCandidateLedger,
  ManualVisualAnnotation,
} from "@/lib/api-service";
import {
  broadcastAnalysisCorrectionRefresh,
  pushCorrectionSnapshot,
  removeManualVisualAnnotation,
  upsertManualVisualAnnotation,
} from "@/lib/annotation-corrections";
import {
  closeManualAnnotationInVideo,
  openManualAnnotationInVideo,
} from "@/lib/video-navigation";
import { useLayoutHost } from "../LayoutHost";
import { SecondOrderLabelReviewTray } from "./SecondOrderLabelAffirmations";

const CATEGORY_ORDER: ManualVisualAnnotation["category"][] = [
  "Action",
  "Audio",
  "Cinematic Cues",
  "Expressions",
  "Genre",
  "Identification",
  "Interaction",
  "Metadata",
  "Movement",
  "Notes",
  "OBJ",
  "OCR",
  "Role",
  "Scene",
  "Transcription",
];

const MANUAL_SUBCATEGORIES: Record<ManualVisualAnnotation["category"], string[]> = {
  Action: ["Action"],
  Audio: ["Ambience", "Foley", "Music", "Prosody", "Sound event", "Speaker-state"],
  "Cinematic Cues": ["Composition", "Lighting", "Shot size", "Transition"],
  Expressions: ["Emotion", "Expression"],
  Genre: [
    "Media genre",
    "Media subgenre",
    "Situational genre",
    "Situational subgenre",
    "Situational taxonomy",
  ],
  Identification: ["Character", "Identity"],
  Interaction: ["Exchange", "Interaction"],
  Metadata: ["Context", "Correlation"],
  Movement: ["Camera movement", "Subject movement"],
  Notes: ["Timestamped note"],
  OBJ: ["Object label"],
  OCR: ["Visible text"],
  Role: ["Role affirmation"],
  Scene: ["Location", "Scene type"],
  Transcription: ["Speech content", "Transcript note"],
};

type LeafAnnotationDraft = {
  category: ManualVisualAnnotation["category"];
  subcategory: string;
  label: string;
  identityAffirmation: string;
  roleAffirmation: string;
  start: number;
  end: number;
  note: string;
};

function firstSubcategory(category: ManualVisualAnnotation["category"]): string {
  return MANUAL_SUBCATEGORIES[category]?.[0] || "";
}

function buildLeafDraft(item: ManualVisualAnnotation): LeafAnnotationDraft {
  const start =
    typeof item.start_seconds === "number"
      ? item.start_seconds
      : item.timestamp_seconds || 0;
  const end =
    typeof item.end_seconds === "number"
      ? item.end_seconds
      : item.timestamp_seconds || start;
  return {
    category: item.category,
    subcategory: item.subcategory || firstSubcategory(item.category),
    label:
      item.custom_label ||
      item.identity_affirmation ||
      item.role_affirmation ||
      item.label ||
      "",
    identityAffirmation: item.identity_affirmation || "",
    roleAffirmation: item.role_affirmation || "",
    start: Math.max(0, Math.min(start, end)),
    end: Math.max(start, end),
    note: item.open_note || "",
  };
}

function resolveLeafLabel(draft: LeafAnnotationDraft): string {
  const label = draft.label.trim();
  if (label) return label;
  if (draft.category === "Identification") return "Character present";
  if (draft.category === "OBJ") return "Object present";
  if (draft.category === "OCR") return "Visible text";
  return `${draft.category} indication`;
}

function formatSeconds(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "time n/a";
  }
  const safeValue = Math.max(0, value);
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.floor(safeValue % 60);
  const milliseconds = Math.floor((safeValue - Math.floor(safeValue)) * 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.includes(":")) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }
  const [minutesPart, secondsPart] = trimmed.split(":");
  const minutes = Number(minutesPart);
  const seconds = Number(secondsPart);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  return minutes * 60 + seconds;
}

function getManualAnnotationTitle(item: ManualVisualAnnotation): string {
  if (item.category === "Identification") {
    return (
      item.identity_affirmation ||
      item.custom_label ||
      item.label ||
      "Identification annotation"
    );
  }
  if (item.category === "Role") {
    return (
      item.role_affirmation ||
      item.identity_affirmation ||
      item.custom_label ||
      item.label ||
      "Role annotation"
    );
  }
  if (item.category === "Audio") {
    return (
      item.audio_foley_note ||
      item.custom_label ||
      item.label ||
      "Audio annotation"
    );
  }
  return item.label || item.custom_label || "Manual annotation";
}

function getManualAnnotationDetail(item: ManualVisualAnnotation): string {
  const details = [
    item.subcategory || "Unspecified subcategory",
    item.label && item.label !== getManualAnnotationTitle(item) ? item.label : "",
    item.identity_affirmation && item.category !== "Identification"
      ? `identity: ${item.identity_affirmation}`
      : "",
    item.role_affirmation && item.category !== "Role"
      ? `role: ${item.role_affirmation}`
      : "",
    item.teaches_regime ? "teaches regime" : "",
  ].filter(Boolean);

  return details.join(" • ");
}

function AutomaticEvidenceSection({
  category,
  analysisData,
  identityLedger,
  identityActionMessage,
  isIdentityActionBusy,
  identityDrafts,
  onCreateIdentityCandidates,
  onIdentityDraftChange,
  onPromoteIdentityCandidate,
}: {
  category?: ManualVisualAnnotation["category"];
  analysisData: any;
  identityLedger?: IdentityCandidateLedger | null;
  identityActionMessage?: string;
  isIdentityActionBusy?: boolean;
  identityDrafts?: Record<string, string>;
  onCreateIdentityCandidates?: () => void;
  onIdentityDraftChange?: (candidateId: string, value: string) => void;
  onPromoteIdentityCandidate?: (candidate: IdentityCandidate, label: string) => void;
}) {
  if (category === "Identification") {
    const candidates = identityLedger?.candidates || [];
    return (
      <section className="mb-2 rounded border border-slate-800 bg-slate-950/20">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <h3 className="text-[11px] font-semibold text-slate-200">
            Identity refinement candidates
          </h3>
          <span className="text-[10px] text-[var(--ui-passive-text)]">
            {candidates.length}
          </span>
        </div>
        <div className="space-y-2 p-2">
          {candidates.length === 0 ? (
            <div className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-[10px] text-[var(--ui-passive-text)]">
              No identity candidates prepared for this analysis.
            </div>
          ) : (
            candidates.map((candidate) => (
              <div
                key={candidate.candidate_id}
                className="rounded border border-slate-800 bg-[#111214] px-2 py-2 text-[10px] text-slate-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {candidate.promoted_identity ||
                        candidate.candidate_label ||
                        candidate.candidate_id}
                    </div>
                    <div className="mt-0.5 text-[var(--ui-passive-text)]">
                      {candidate.evidence?.annotation_type || "annotation"}{" "}
                      {candidate.evidence?.track_id
                        ? `track ${candidate.evidence.track_id}`
                        : candidate.evidence?.annotation_id || ""}
                      {candidate.evidence?.time_start !== undefined
                        ? ` • ${formatSeconds(candidate.evidence.time_start)}`
                        : ""}
                    </div>
                  </div>
                  <span className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">
                    {candidate.review_state || "unreviewed"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <input
                    value={
                      identityDrafts?.[candidate.candidate_id] ??
                      candidate.promoted_identity ??
                      ""
                    }
                    onChange={(event) =>
                      onIdentityDraftChange?.(
                        candidate.candidate_id,
                        event.target.value,
                      )
                    }
                    disabled={
                      isIdentityActionBusy || candidate.review_state === "promoted"
                    }
                    placeholder="Confirmed identity label"
                    className="min-w-0 flex-1 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100 outline-none focus:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={
                      isIdentityActionBusy ||
                      candidate.review_state === "promoted" ||
                      !(
                        identityDrafts?.[candidate.candidate_id] ||
                        candidate.promoted_identity ||
                        ""
                      ).trim()
                    }
                    className="shrink-0 rounded border border-emerald-500/30 bg-emerald-950/20 px-2 py-1 text-[10px] text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() =>
                      onPromoteIdentityCandidate?.(
                        candidate,
                        identityDrafts?.[candidate.candidate_id] ||
                          candidate.promoted_identity ||
                          "",
                      )
                    }
                  >
                    Promote
                  </button>
                </div>
                <div className="mt-1 text-[var(--ui-passive-text)]">
                  Visual, cinematic, speaker, and reference evidence slots are reserved.
                </div>
              </div>
            ))
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--ui-passive-text)]">
              {identityActionMessage || identityLedger?.status || "Candidate review ready."}
            </span>
            <button
              type="button"
              disabled={isIdentityActionBusy}
              className="rounded border border-cyan-500/30 bg-cyan-950/20 px-2 py-1 text-[10px] text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onCreateIdentityCandidates}
            >
              Refresh candidates
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (category === "Audio") {
    const audioProsody = analysisData?.audioProsody || [];
    return (
      <section className="mb-2 rounded border border-slate-800 bg-slate-950/20">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <h3 className="text-[11px] font-semibold text-slate-200">
            Automatic audio evidence
          </h3>
          <span className="text-[10px] text-[var(--ui-passive-text)]">
            {audioProsody.length}
          </span>
        </div>
        <div className="space-y-1 p-2">
          {audioProsody.length === 0 ? (
            <div className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-[10px] text-[var(--ui-passive-text)]">
              No automatic audio prosody cues available.
            </div>
          ) : (
            audioProsody.map((cue: any) => (
              <button
                key={cue.cue_id || `${cue.start}-${cue.end}`}
                type="button"
                className="block w-full rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-slate-900/60"
                onClick={() =>
                  eventBus.emit("videoTimeLineChanged", Number(cue.start || 0))
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">
                    {cue.sound_environment?.label || "Audio cue"}
                  </span>
                  <span className="shrink-0 text-[var(--ui-passive-text)]">
                    {formatSeconds(cue.start)}-{formatSeconds(cue.end)}
                  </span>
                </div>
                <div className="mt-0.5 text-[var(--ui-passive-text)]">
                  Pace {cue.pace?.label || "n/a"} • Rhythm{" "}
                  {cue.rhythm_profile?.label || "n/a"} • Tonality{" "}
                  {cue.tonality_profile?.label || "n/a"}
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  if (category === "Genre") {
    const sourceAnnotations = analysisData?.metadata?.sourceAnnotations || {};
    const rows = [
      ["Media genre", sourceAnnotations.genre],
      ["Media subgenre", sourceAnnotations.genre_subtype],
      ["Situational genre", sourceAnnotations.situational_genre],
      ["Situational subgenre", sourceAnnotations.situational_subtype],
    ].filter(([, value]) => value);

    return (
      <section className="mb-2 rounded border border-slate-800 bg-slate-950/20">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <h3 className="text-[11px] font-semibold text-slate-200">
            Source genre evidence
          </h3>
          <span className="text-[10px] text-[var(--ui-passive-text)]">
            {rows.length}
          </span>
        </div>
        <div className="space-y-1 p-2">
          {rows.length === 0 ? (
            <div className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-[10px] text-[var(--ui-passive-text)]">
              No source-level genre annotations available.
            </div>
          ) : (
            rows.map(([label, value]) => (
              <div
                key={label}
                className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-[10px] text-slate-200"
              >
                <div className="font-medium">{value}</div>
                <div className="mt-0.5 text-[var(--ui-passive-text)]">
                  {label}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  return null;
}

function MatureEvidenceStrip({ analysisData }: { analysisData: AnalysisData | null }) {
  const resolved = analysisData?.masterSchemaResolvedEvidence;
  if (!resolved) return null;
  const labels: Record<string, string> = {
    manual_correction: "Manual corrections",
    manual_annotation: "Manual annotations",
    mature_triangulated: "Triangulated",
    interpreted_detection: "Interpreted",
    raw_detection: "Raw",
  };
  const order: MatureEvidenceAuthority[] = resolved.authorityOrder || [];
  const counts = resolved.counts || {};
  return (
    <section className="mb-2 rounded border border-emerald-500/20 bg-emerald-950/10 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
            Mature Evidence View
          </div>
          <div className="mt-0.5 text-[10px] text-[var(--ui-passive-text)]">
            Master Schema first-read layer; raw repositories remain preserved.
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {order.map((authority) => (
            <span
              key={authority}
              className="rounded border border-slate-700 bg-[#111214] px-2 py-1 text-[10px] text-slate-200"
            >
              {labels[authority] || authority}: {counts[authority] || 0}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatAuditLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function ConfirmationProgramStrip({ analysisData }: { analysisData: AnalysisData | null }) {
  const audit = analysisData?.metadata?.masterSchemaMaturityAudit;
  const anchor = audit?.user_confirmed_anchor;
  const program = audit?.confirmation_program;
  if (!anchor && !program) return null;
  const anchorSurfaces = anchor?.anchor_surfaces || [];
  const families = program?.confirmation_families || [];
  return (
    <section className="mb-2 rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
            User Confirmed Anchor
          </div>
          <div className="mt-0.5 max-w-3xl text-[10px] text-[var(--ui-passive-text)]">
            {anchor?.principle ||
              "User confirmed corrections and annotations anchor mature sense-making."}
          </div>
        </div>
        <div className="shrink-0 rounded border border-cyan-700/60 bg-[#111214] px-2 py-1 text-[10px] text-cyan-100">
          {program?.consults_user_confirmed_anchor
            ? "Confirmations consult anchors"
            : "Anchor consultation pending"}
        </div>
      </div>
      {anchorSurfaces.length > 0 && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {anchorSurfaces.map((surface) => (
            <div
              key={surface.surface || surface.route}
              className="rounded border border-slate-800 bg-[#111214] px-2 py-1.5"
            >
              <div className="text-[10px] font-medium text-slate-200">
                {formatAuditLabel(surface.surface || "anchor surface")}
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-cyan-200/80">
                {surface.status || "pending"}
              </div>
            </div>
          ))}
        </div>
      )}
      {families.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Concise Pattern Confirmations
          </div>
          <div className="flex flex-wrap gap-1.5">
            {families.map((family) => (
              <span
                key={family}
                className="rounded border border-slate-700 bg-[#111214] px-2 py-1 text-[10px] text-slate-200"
              >
                {formatAuditLabel(family)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function MasterSchemaPanel({
  videoId: initialVideoId = "",
  category,
  panelTitle = "Master Schema",
  panelDescription = "This is the master review surface for native manual annotations. Leaf panels may show category-specific views, but this panel keeps the full analyst schema together.",
}: {
  videoId?: string;
  category?: ManualVisualAnnotation["category"];
  panelTitle?: string;
  panelDescription?: string;
}) {
  const { openPanel } = useLayoutHost();
  const [videoId, setVideoId] = useState(initialVideoId);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [identityLedger, setIdentityLedger] =
    useState<IdentityCandidateLedger | null>(null);
  const [identityActionMessage, setIdentityActionMessage] = useState("");
  const [isIdentityActionBusy, setIsIdentityActionBusy] = useState(false);
  const [identityDrafts, setIdentityDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [leafDrafts, setLeafDrafts] = useState<Record<string, LeafAnnotationDraft>>({});
  const [timeInputDrafts, setTimeInputDrafts] = useState<Record<string, string>>({});
  const [leafActionMessage, setLeafActionMessage] = useState("");
  const suppressNextLocalCorrectionRefreshRef = useRef(false);

  useEffect(() => {
    if (initialVideoId) {
      setVideoId(initialVideoId);
    }
  }, [initialVideoId]);

  useEffect(() => {
    const videoHandler = (id: string) => setVideoId(id);
    const correctionHandler = (id: string) => {
      if (id === videoId) {
        if (suppressNextLocalCorrectionRefreshRef.current) {
          suppressNextLocalCorrectionRefreshRef.current = false;
          return;
        }
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
    async function load() {
      if (!videoId) {
        setAnalysisData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        setAnalysisData(await VideoService.getAnalysis(videoId));
      } catch (error) {
        console.error("Failed to load master schema annotations:", error);
        setAnalysisData(null);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [videoId, refreshNonce]);

  useEffect(() => {
    async function loadIdentityLedger() {
      if (!videoId || category !== "Identification") {
        setIdentityLedger(null);
        return;
      }

      try {
        const nextLedger = await apiService.getIdentityCandidates(videoId);
        setIdentityLedger(nextLedger);
        setIdentityDrafts((current) => {
          const next = { ...current };
          for (const candidate of nextLedger.candidates || []) {
            if (next[candidate.candidate_id] === undefined) {
              next[candidate.candidate_id] = candidate.promoted_identity || "";
            }
          }
          return next;
        });
      } catch (error) {
        console.warn("Failed to load identity candidates:", error);
        setIdentityLedger(null);
      }
    }

    void loadIdentityLedger();
  }, [videoId, category, refreshNonce]);

  async function createIdentityCandidates() {
    if (!videoId) return;
    setIsIdentityActionBusy(true);
    setIdentityActionMessage("Refreshing identity candidates...");
    try {
      await apiService.runIdentityRefinement(videoId);
      setIdentityLedger(await apiService.getIdentityCandidates(videoId));
      setIdentityActionMessage("Identity candidates refreshed.");
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      console.error("Failed to refresh identity candidates:", error);
      setIdentityActionMessage("Identity candidate refresh failed.");
    } finally {
      setIsIdentityActionBusy(false);
    }
  }

  function updateIdentityDraft(candidateId: string, value: string) {
    setIdentityDrafts((current) => ({ ...current, [candidateId]: value }));
  }

  async function promoteIdentityCandidate(candidate: IdentityCandidate, label: string) {
    if (!videoId) return;
    const identityLabel = label.trim();
    if (!identityLabel) return;

    setIsIdentityActionBusy(true);
    setIdentityActionMessage("Promoting identity candidate...");
    try {
      await apiService.promoteIdentityCandidate(
        videoId,
        candidate.candidate_id,
        identityLabel,
      );
      setIdentityLedger(await apiService.getIdentityCandidates(videoId));
      setIdentityActionMessage("Identity candidate promoted.");
      setRefreshNonce((current) => current + 1);
      eventBus.emit("analysisCorrectionsChanged", videoId);
    } catch (error) {
      console.error("Failed to promote identity candidate:", error);
      setIdentityActionMessage("Identity promotion failed.");
    } finally {
      setIsIdentityActionBusy(false);
    }
  }

  function activateVideoForAnnotation(item: ManualVisualAnnotation) {
    openManualAnnotationInVideo(videoId, item);
  }

  function selectAnnotationForEditing(item: ManualVisualAnnotation) {
    setSelectedAnnotationId(item.id);
    setLeafDrafts((current) =>
      current[item.id] ? current : { ...current, [item.id]: buildLeafDraft(item) },
    );
    activateVideoForAnnotation(item);
  }

  function updateLeafDraft(
    annotationId: string,
    patch: Partial<LeafAnnotationDraft>,
  ) {
    const item = (analysisData?.annotationCorrections?.manual_visual_annotations || []).find(
      (entry: ManualVisualAnnotation) => entry.id === annotationId,
    );
    setLeafDrafts((current) => {
      const base = current[annotationId] || (item ? buildLeafDraft(item) : null);
      if (!base) return current;
      const next = { ...base, ...patch };
      if (patch.category && patch.category !== base.category) {
        next.subcategory = firstSubcategory(patch.category);
      }
      next.start = Math.max(0, Number(next.start) || 0);
      next.end = Math.max(next.start + 0.001, Number(next.end) || next.start + 0.001);
      return { ...current, [annotationId]: next };
    });
  }

  function commitLeafTimeInput(
    inputKey: string,
    annotationId: string,
    field: "start" | "end",
    fallbackValue: number,
  ) {
    const draftValue = timeInputDrafts[inputKey];
    if (draftValue === undefined) return;
    const parsed = parseTimeInput(draftValue);
    if (parsed !== null) {
      updateLeafDraft(annotationId, { [field]: parsed });
    }
    setTimeInputDrafts((current) => {
      const next = { ...current };
      delete next[inputKey];
      return next;
    });
    if (parsed === null) {
      setLeafActionMessage(`Invalid time. Keeping ${formatSeconds(fallbackValue)}.`);
    }
  }

  async function saveLeafAnnotation(item: ManualVisualAnnotation) {
    if (!videoId) {
      setLeafActionMessage("Cannot save: no active analysis is selected.");
      return;
    }
    const draft = leafDrafts[item.id] || buildLeafDraft(item);
    const label = resolveLeafLabel(draft);
    const nextAnnotation: ManualVisualAnnotation = {
      ...item,
      category: draft.category,
      subcategory: draft.subcategory || firstSubcategory(draft.category),
      label,
      custom_label: draft.label.trim() || item.custom_label,
      timestamp_seconds: Number(draft.start.toFixed(3)),
      start_seconds: Number(draft.start.toFixed(3)),
      end_seconds: Number(draft.end.toFixed(3)),
      identity_affirmation:
        draft.category === "Identification"
          ? draft.identityAffirmation.trim() || label
          : draft.identityAffirmation.trim() || undefined,
      role_affirmation:
        draft.category === "Role"
          ? draft.roleAffirmation.trim() || label
          : draft.roleAffirmation.trim() || undefined,
      open_note: draft.note.trim() || undefined,
      updated_at: new Date().toISOString(),
      updated_by: "analyst",
    };
    const existingCorrections = analysisData?.annotationCorrections;
    const nextCorrections = upsertManualVisualAnnotation(
      existingCorrections,
      nextAnnotation,
    );
    setLeafActionMessage(`Saving ${draft.category} / ${label}...`);
    try {
      pushCorrectionSnapshot(videoId, existingCorrections);
      const savedCorrections = await VideoService.saveAnnotationCorrections(
        videoId,
        nextCorrections,
      );
      const savedAnnotation =
        (savedCorrections.manual_visual_annotations || []).find(
          (entry: ManualVisualAnnotation) => entry.id === nextAnnotation.id,
        ) || nextAnnotation;
      setAnalysisData((current: any) =>
        current
          ? (() => {
              const nextManualGroups = (
                savedCorrections.manual_visual_annotations || []
              ).reduce(
                (
                  groups: Partial<
                    Record<ManualVisualAnnotation["category"], ManualVisualAnnotation[]>
                  >,
                  entry: ManualVisualAnnotation,
                ) => {
                  const items = groups[entry.category] || [];
                  groups[entry.category] = [...items, entry];
                  return groups;
                },
                {},
              );
              for (const items of Object.values(nextManualGroups)) {
                items?.sort(
                  (left: ManualVisualAnnotation, right: ManualVisualAnnotation) =>
                    Number(left.timestamp_seconds || 0) -
                    Number(right.timestamp_seconds || 0),
                );
              }
              return {
                ...current,
                annotationCorrections: savedCorrections,
                manualAnnotationsByCategory: nextManualGroups,
              };
            })()
          : current,
      );
      setLeafDrafts((current) => ({
        ...current,
        [savedAnnotation.id]: buildLeafDraft(savedAnnotation),
      }));
      setSelectedAnnotationId(null);
      setLeafActionMessage(`Saved ${draft.category} / ${label}`);
      openManualAnnotationInVideo(videoId, savedAnnotation, {
        focusVideoPanel: false,
        seekVideo: false,
      });
      closeManualAnnotationInVideo(videoId, savedAnnotation.id);
      suppressNextLocalCorrectionRefreshRef.current = true;
      broadcastAnalysisCorrectionRefresh(videoId);
    } catch (error) {
      console.error("Failed to save master schema annotation:", error);
      setSelectedAnnotationId(nextAnnotation.id);
      setLeafActionMessage(
        error instanceof Error
          ? `Save failed: ${error.message}`
          : "Save failed. See console for details.",
      );
    }
  }

  async function deleteLeafAnnotation(item: ManualVisualAnnotation) {
    if (!videoId || !item.id) return;
    const existingCorrections = analysisData?.annotationCorrections;
    const nextCorrections = removeManualVisualAnnotation(existingCorrections, item.id);
    pushCorrectionSnapshot(videoId, existingCorrections);
    await VideoService.saveAnnotationCorrections(videoId, nextCorrections);
    setAnalysisData(await VideoService.getAnalysis(videoId));
    setSelectedAnnotationId(null);
    setLeafActionMessage("Deleted indication.");
    eventBus.emit("videoIdChanged", videoId);
    eventBus.emit("videoTimeLineChanged", Number(item.start_seconds || item.timestamp_seconds || 0));
    broadcastAnalysisCorrectionRefresh(videoId);
  }

  const groupedAnnotations = useMemo(() => {
    const groups =
      analysisData?.manualAnnotationsByCategory ||
      ({} as Partial<
        Record<ManualVisualAnnotation["category"], ManualVisualAnnotation[]>
      >);

    const orderedCategories = category ? [category] : CATEGORY_ORDER;

    return orderedCategories.map((currentCategory) => ({
      category: currentCategory,
      items: [...(groups[currentCategory] || [])].sort(
        (left, right) =>
          Number(left.timestamp_seconds || 0) -
          Number(right.timestamp_seconds || 0),
      ),
    })).filter((group) => group.items.length > 0);
  }, [analysisData?.manualAnnotationsByCategory, category]);

  const totalAnnotations = groupedAnnotations.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  return (
    <main className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-[#0a0a0a] bg-[#1a1a1a] px-3 py-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ui-passive-text)]">
          {panelTitle}
        </span>
        <div className="flex items-center gap-2">
          {category === "Scene" && (
            <button
              type="button"
              onClick={() => openPanel("SceneCards", videoId ? { videoId } : {})}
              className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-lime-500/70 hover:bg-lime-950/20"
            >
              Scene Cards
            </button>
          )}
          <span className="text-[10px] text-[var(--ui-passive-text)]">
            {totalAnnotations} manual annotation{totalAnnotations === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="my-2 rounded border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-[11px] text-sky-100">
          {panelDescription}
        </div>

        {isLoading ? (
          <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
            Loading master schema...
          </div>
        ) : (
          <>
            <MatureEvidenceStrip analysisData={analysisData} />
            <ConfirmationProgramStrip analysisData={analysisData} />
            <SecondOrderLabelReviewTray
              plan={analysisData?.secondOrderLabelProliferation}
            />
            <AutomaticEvidenceSection
              category={category}
              analysisData={analysisData}
          identityLedger={identityLedger}
          identityActionMessage={identityActionMessage}
          isIdentityActionBusy={isIdentityActionBusy}
          identityDrafts={identityDrafts}
          onCreateIdentityCandidates={createIdentityCandidates}
          onIdentityDraftChange={updateIdentityDraft}
          onPromoteIdentityCandidate={promoteIdentityCandidate}
        />
            {groupedAnnotations.length === 0 ? (
          <div className="rounded border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-[var(--ui-passive-text)]">
            No manual annotations in this schema view yet.
          </div>
            ) : (
          <div className="space-y-2">
            {groupedAnnotations.map((group) => (
              <section
                key={group.category}
                className="rounded border border-slate-800 bg-slate-950/20"
              >
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                  <h3 className="text-[11px] font-semibold text-slate-200">
                    {group.category}
                  </h3>
                  <span className="text-[10px] text-[var(--ui-passive-text)]">
                    {group.items.length}
                  </span>
                </div>
                <div className="space-y-1 p-2">
                  {group.items.map((item) => {
                    const selected = selectedAnnotationId === item.id;
                    const draft = leafDrafts[item.id] || buildLeafDraft(item);
                    const startInputKey = `${item.id}:start`;
                    const endInputKey = `${item.id}:end`;
                    return (
                      <div
                        key={item.id}
                        className={`rounded border ${
                          selected
                            ? "border-cyan-400/40 bg-cyan-400/5"
                            : "border-slate-800 bg-[#111214]"
                        } px-2 py-1.5 text-[10px] text-slate-200`}
                      >
                        <button
                          type="button"
                          className="block w-full text-left hover:text-slate-50"
                          onClick={() => selectAnnotationForEditing(item)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium">
                              {getManualAnnotationTitle(item)}
                            </span>
                            <span className="shrink-0 text-[var(--ui-passive-text)]">
                              {formatSeconds(item.start_seconds ?? item.timestamp_seconds)}
                              {item.end_seconds !== undefined
                                ? `-${formatSeconds(item.end_seconds)}`
                                : ""}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[var(--ui-passive-text)]">
                            {getManualAnnotationDetail(item)}
                          </div>
                          {item.open_note ? (
                            <div className="mt-0.5 line-clamp-2 text-[var(--ui-passive-text)]">
                              {item.open_note}
                            </div>
                          ) : null}
                        </button>

                        {selected ? (
                          <div className="mt-2 rounded border border-slate-800 bg-black/25 p-2">
                            <div className="grid gap-1 md:grid-cols-[1fr_1fr]">
                              <select
                                value={draft.category}
                                onChange={(event) =>
                                  updateLeafDraft(item.id, {
                                    category: event.target.value as ManualVisualAnnotation["category"],
                                  })
                                }
                                className="min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
                              >
                                {CATEGORY_ORDER.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={draft.subcategory}
                                onChange={(event) =>
                                  updateLeafDraft(item.id, {
                                    subcategory: event.target.value,
                                  })
                                }
                                className="min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
                              >
                                {(MANUAL_SUBCATEGORIES[draft.category] || []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="mt-1 grid gap-1 md:grid-cols-[1fr_0.6fr_0.6fr]">
                              <input
                                value={draft.label}
                                onChange={(event) =>
                                  updateLeafDraft(item.id, {
                                    label: event.target.value,
                                    identityAffirmation:
                                      draft.category === "Identification"
                                        ? event.target.value
                                        : draft.identityAffirmation,
                                  })
                                }
                                className="min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
                                placeholder="Label, identity, or indication"
                              />
                              <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                                In {formatSeconds(draft.start)}
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    timeInputDrafts[startInputKey] ??
                                    formatSeconds(draft.start)
                                  }
                                  onChange={(event) => {
                                    setTimeInputDrafts((current) => ({
                                      ...current,
                                      [startInputKey]: event.target.value,
                                    }));
                                  }}
                                  onBlur={() =>
                                    commitLeafTimeInput(
                                      startInputKey,
                                      item.id,
                                      "start",
                                      draft.start,
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      commitLeafTimeInput(
                                        startInputKey,
                                        item.id,
                                        "start",
                                        draft.start,
                                      );
                                      event.currentTarget.blur();
                                    } else if (event.key === "Escape") {
                                      setTimeInputDrafts((current) => {
                                        const next = { ...current };
                                        delete next[startInputKey];
                                        return next;
                                      });
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                                  aria-label="Start time"
                                />
                              </label>
                              <label className="min-w-0 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                                Out {formatSeconds(draft.end)}
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    timeInputDrafts[endInputKey] ??
                                    formatSeconds(draft.end)
                                  }
                                  onChange={(event) => {
                                    setTimeInputDrafts((current) => ({
                                      ...current,
                                      [endInputKey]: event.target.value,
                                    }));
                                  }}
                                  onBlur={() =>
                                    commitLeafTimeInput(
                                      endInputKey,
                                      item.id,
                                      "end",
                                      draft.end,
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      commitLeafTimeInput(
                                        endInputKey,
                                        item.id,
                                        "end",
                                        draft.end,
                                      );
                                      event.currentTarget.blur();
                                    } else if (event.key === "Escape") {
                                      setTimeInputDrafts((current) => {
                                        const next = { ...current };
                                        delete next[endInputKey];
                                        return next;
                                      });
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className="mt-0.5 w-full min-w-0 rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                                  aria-label="End time"
                                />
                              </label>
                            </div>
                            <textarea
                              value={draft.note}
                              onChange={(event) =>
                                updateLeafDraft(item.id, { note: event.target.value })
                              }
                              className="mt-1 min-h-14 w-full rounded border border-slate-700 bg-[#171717] px-2 py-1 text-[10px] text-slate-100"
                              placeholder="Analyst note"
                            />
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                className="rounded bg-emerald-900/50 px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-800/70"
                                onClick={() => void saveLeafAnnotation(item)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                                onClick={() => activateVideoForAnnotation(item)}
                              >
                                Show video
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                                onClick={() => {
                                  const start = Number(draft.start || 0);
                                  eventBus.emit("videoTimeLineChanged", start);
                                }}
                              >
                                Go start
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                                onClick={() => {
                                  const end = Number(draft.end || 0);
                                  eventBus.emit("videoTimeLineChanged", end);
                                }}
                              >
                                Go end
                              </button>
                              <button
                                type="button"
                                className="rounded bg-rose-900/40 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-800/60"
                                onClick={() => void deleteLeafAnnotation(item)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
            )}
            {leafActionMessage ? (
              <div className="mt-2 rounded border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-100">
                {leafActionMessage}
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
