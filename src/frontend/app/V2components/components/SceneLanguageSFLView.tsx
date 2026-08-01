"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiService } from "@/lib/api-service";
import { openVideoAtTime } from "@/lib/video-navigation";

type Perspective = "pos" | "quant" | "transcript" | "scene";
type Interval = { start_ms?: number; end_ms?: number };
type SceneCard = { scene_id?: string; title?: string; display_title?: string; time_interval?: Interval };
type Token = { text?: string; lemma?: string; pos?: string; dep?: string };
type Utterance = {
  utterance_id?: string;
  text?: string;
  time_interval?: Interval;
  syntax?: { negation?: boolean; modals?: string[] };
  token_trace?: Token[];
  sfl_lite?: {
    ideational?: { process_type?: string };
    interpersonal?: { speech_function?: string; modality?: Array<{ modal?: string; type?: string; strength?: string }> };
    textual?: { theme_candidate?: string; sentence_type?: string };
  };
};

function seconds(ms?: number) { return Number(ms || 0) / 1000; }
function stamp(value: number) {
  const minutes = Math.floor(value / 60);
  return `${minutes}:${(value - minutes * 60).toFixed(1).padStart(4, "0")}`;
}
function overlaps(a: Interval = {}, b: Interval = {}) {
  return Number(a.end_ms || 0) > Number(b.start_ms || 0) && Number(a.start_ms || 0) < Number(b.end_ms || 0);
}
function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((result, value) => {
    if (value) result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}
function profile(values: string[]) {
  return Object.entries(countBy(values)).sort((a, b) => b[1] - a[1]).map(([key, value]) => `${key} ${value}`).join(" · ") || "—";
}

export default function SceneLanguageSFLView({
  analysisId,
  perspective = "scene",
  initialSceneCards,
  defaultOpen = false,
}: {
  analysisId: string;
  perspective?: Perspective;
  initialSceneCards?: SceneCard[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState<SceneCard[]>(initialSceneCards || []);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (initialSceneCards?.length) setCards(initialSceneCards);
  }, [initialSceneCards]);

  const load = async () => {
    if (!analysisId || utterances.length || loading) return;
    setLoading(true);
    setError("");
    try {
      const requests: Promise<Blob>[] = [apiService.downloadFile(analysisId, "dependency_sfl_stage1")];
      if (!cards.length) requests.push(apiService.downloadFile(analysisId, "mise_en_scene_scene_cards"));
      const blobs = await Promise.all(requests);
      const sfl = JSON.parse(await blobs[0].text());
      setUtterances(Array.isArray(sfl?.utterances) ? sfl.utterances : []);
      if (!cards.length && blobs[1]) {
        const scenes = JSON.parse(await blobs[1].text());
        setCards(Array.isArray(scenes?.scene_cards) ? scenes.scene_cards : []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Language/SFL view could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => cards.map((card, index) => {
    const sceneUtterances = utterances.filter((utterance) => overlaps(card.time_interval, utterance.time_interval));
    const tokens = sceneUtterances.flatMap((utterance) => utterance.token_trace || []).filter((token) => token.pos !== "PUNCT");
    const words = tokens.map((token) => String(token.text || "")).filter(Boolean);
    const duration = Math.max(0.001, seconds(card.time_interval?.end_ms) - seconds(card.time_interval?.start_ms));
    const lexical = new Set(tokens.map((token) => String(token.lemma || token.text || "").toLowerCase()).filter(Boolean));
    return {
      card,
      id: card.scene_id || `scene:${index + 1}`,
      utterances: sceneUtterances,
      tokens,
      wordCount: words.length,
      lexicalDiversity: words.length ? lexical.size / words.length : 0,
      wordsPerSecond: words.length / duration,
      negations: sceneUtterances.filter((utterance) => utterance.syntax?.negation).length,
      questions: sceneUtterances.filter((utterance) => utterance.sfl_lite?.interpersonal?.speech_function === "question").length,
      pos: profile(tokens.map((token) => String(token.pos || ""))),
      processes: profile(sceneUtterances.map((utterance) => String(utterance.sfl_lite?.ideational?.process_type || ""))),
      speechFunctions: profile(sceneUtterances.map((utterance) => String(utterance.sfl_lite?.interpersonal?.speech_function || ""))),
      modalities: profile(sceneUtterances.flatMap((utterance) => utterance.sfl_lite?.interpersonal?.modality || []).map((item) => item.modal || item.type || "")),
    };
  }).filter((row) => row.utterances.length), [cards, utterances]);

  const focusLabel = perspective === "scene" ? "Language analysis by scene" : `${perspective.toUpperCase()} and SFL by scene`;

  return (
    <details
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        if (event.currentTarget.open) void load();
      }}
      className="overflow-hidden rounded border border-white/8 bg-[#101010]"
      data-vaa1-scene-language-sfl="true"
    >
      <summary className="cursor-pointer list-none border-b border-white/8 px-3 py-2 text-[11px] font-medium text-slate-300">
        {focusLabel}
      </summary>
      <div className="px-3 py-2">
        {loading && <div className="text-[10px] text-slate-500">Loading…</div>}
        {error && <div className="text-[10px] text-slate-400">{error}</div>}
        {!loading && !error && utterances.length > 0 && rows.length === 0 && <div className="text-[10px] text-slate-500">No source-linked scene rows.</div>}
        {rows.length ? (
          <div className="overflow-auto rounded border border-white/8">
            <table className="w-full border-collapse text-left text-[10px]">
              <thead className="bg-[#151515] text-[9px] text-slate-500">
                <tr>
                  <th className="border-b border-white/8 px-2 py-1.5 font-medium">Scene</th>
                  {(perspective === "scene" || perspective === "transcript") && <th className="border-b border-white/8 px-2 py-1.5 font-medium">Transcript</th>}
                  {(perspective === "scene" || perspective === "pos") && <th className="border-b border-white/8 px-2 py-1.5 font-medium">POS</th>}
                  {(perspective === "scene" || perspective === "quant") && <th className="border-b border-white/8 px-2 py-1.5 font-medium">Quant</th>}
                  <th className="border-b border-white/8 px-2 py-1.5 font-medium">SFL</th>
                  <th className="border-b border-white/8 px-2 py-1.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const isExpanded = expanded.includes(row.id);
                  const start = seconds(row.card.time_interval?.start_ms);
                  return <React.Fragment key={row.id}>
                    <tr className="border-b border-white/8 align-top hover:bg-white/[0.025]">
                      <td className="px-2 py-1.5">
                        <button type="button" className="text-left font-medium text-slate-200 hover:text-white" onClick={() => setExpanded((current) => isExpanded ? current.filter((id) => id !== row.id) : [...current, row.id])}>
                          {row.card.display_title || row.card.title || `Scene Card ${index + 1}`}
                        </button>
                      </td>
                      {(perspective === "scene" || perspective === "transcript") && <td className="px-2 py-1.5 text-slate-400">{row.utterances.length} utterances</td>}
                      {(perspective === "scene" || perspective === "pos") && <td className="px-2 py-1.5 text-slate-400">{row.pos}</td>}
                      {(perspective === "scene" || perspective === "quant") && <td className="px-2 py-1.5 text-slate-400">{row.wordCount} words · {row.wordsPerSecond.toFixed(2)} words/s · TTR {row.lexicalDiversity.toFixed(2)} · Q {row.questions} · Neg {row.negations}</td>}
                      <td className="px-2 py-1.5 text-slate-400">{row.processes} · {row.speechFunctions} · modality {row.modalities}</td>
                      <td className="px-2 py-1.5"><button type="button" onClick={() => openVideoAtTime(analysisId, start)} className="text-slate-300 hover:text-white">{stamp(start)}</button></td>
                    </tr>
                    {isExpanded && <tr className="border-b border-white/8 bg-[#0d0d0d]"><td colSpan={6} className="p-0">
                      {row.utterances.map((utterance, utteranceIndex) => {
                        const utteranceStart = seconds(utterance.time_interval?.start_ms);
                        return <button key={utterance.utterance_id || utteranceIndex} type="button" onClick={() => openVideoAtTime(analysisId, utteranceStart)} className="grid w-full grid-cols-[52px_minmax(0,1fr)_minmax(120px,0.6fr)] gap-2 border-b border-white/5 px-2 py-1.5 text-left text-[10px] hover:bg-white/[0.035]">
                          <span className="text-slate-500">{stamp(utteranceStart)}</span>
                          <span className="text-slate-300">{utterance.text || "—"}</span>
                          <span className="text-slate-500">{utterance.sfl_lite?.ideational?.process_type || "undetermined"} · {utterance.sfl_lite?.interpersonal?.speech_function || "undetermined"}{utterance.sfl_lite?.interpersonal?.modality?.length ? ` · ${utterance.sfl_lite.interpersonal.modality.map((item) => item.modal || item.type).join(", ")}` : ""}</span>
                        </button>;
                      })}
                    </td></tr>}
                  </React.Fragment>;
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </details>
  );
}
