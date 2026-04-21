import React, { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService } from "@/lib/video-service";
import { apiService } from "@/lib/api-service";
import type {
  IdentityCandidate,
  IdentityCandidateLedger,
  ManualVisualAnnotation,
} from "@/lib/api-service";

const CATEGORY_ORDER: ManualVisualAnnotation["category"][] = [
  "OBJ",
  "OCR",
  "Expressions",
  "Cinematic Cues",
  "Audio",
  "Transcription",
  "Genre",
  "Scene",
  "Role",
  "Identification",
  "Interaction",
  "Action",
  "Movement",
  "Metadata",
  "Notes",
];

function formatSeconds(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "time n/a";
  }
  return `${value.toFixed(2)}s`;
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
  const [videoId, setVideoId] = useState(initialVideoId);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [identityLedger, setIdentityLedger] =
    useState<IdentityCandidateLedger | null>(null);
  const [identityActionMessage, setIdentityActionMessage] = useState("");
  const [isIdentityActionBusy, setIsIdentityActionBusy] = useState(false);
  const [identityDrafts, setIdentityDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (initialVideoId) {
      setVideoId(initialVideoId);
    }
  }, [initialVideoId]);

  useEffect(() => {
    const videoHandler = (id: string) => setVideoId(id);
    const correctionHandler = (id: string) => {
      if (id === videoId) {
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
        <span className="text-[10px] text-[var(--ui-passive-text)]">
          {totalAnnotations} manual annotation{totalAnnotations === 1 ? "" : "s"}
        </span>
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
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded border border-slate-800 bg-[#111214] px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-slate-900/60"
                      onClick={() =>
                        eventBus.emit(
                          "videoTimeLineChanged",
                          Number(item.timestamp_seconds || 0),
                        )
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">
                          {getManualAnnotationTitle(item)}
                        </span>
                        <span className="shrink-0 text-[var(--ui-passive-text)]">
                          {formatSeconds(item.timestamp_seconds)}
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
                      {item.category === "Genre" &&
                      item.subcategory?.startsWith("Situational") ? (
                        <div className="mt-1 rounded border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-sky-100">
                          Situational genre branch is under schema review.
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
