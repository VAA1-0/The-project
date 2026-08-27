import { eventBus } from "@/lib/golden-layout-lib/eventBus";

export default function LanguageParityMetaView({ data, analysisData }: { data?: any; analysisData?: any }) {
  if (analysisData) {
    const pos = analysisData.posAnalysis?.[0] || {};
    const quant = analysisData.quantAnalysis?.[0] || {};
    const posTokens = Number(pos.token_count || 0);
    const quantTokens = Array.isArray(quant.token_info?.tokens) ? quant.token_info.tokens.length : Number(quant.token_info?.total_tokens || 0);
    const classified = Object.values(pos.pos_counts || {}).reduce((sum: number, value) => sum + Number(value || 0), 0);
    const transcript = analysisData.transcriptTimeline || analysisData.transcript || [];
    const timed = transcript.filter((row: any) => row.start != null && row.end != null).length;
    if (posTokens && quantTokens) data = {
      ...data,
      cross_panel: { pos_quant_token_parity_percentage: Math.round((1 - Math.abs(posTokens - quantTokens) / Math.max(posTokens, quantTokens)) * 1000) / 10, token_difference: Math.abs(posTokens - quantTokens), ...(data?.cross_panel || {}) },
      transcript: { timed_coverage_percentage: transcript.length ? Math.round(timed / transcript.length * 1000) / 10 : 100, ...(data?.transcript || {}) },
      quant: { input_token_count: quantTokens, ...(data?.quant || {}) },
      pos: {
        input_token_count: posTokens,
        classified_occurrence_count: classified,
        classification_coverage_percentage: Math.round(classified / posTokens * 1000) / 10,
        outside_category_counts: pos.taxonomy_review?.outside_category_counts || {},
        outside_category_examples: pos.taxonomy_review?.outside_category_examples || {},
        ...(data?.pos || {}),
      },
    };
  }
  if (!data) return <div className="mx-3 mb-2 rounded border border-cyan-900/60 bg-[#101414] px-3 py-2" data-vaa1-language-metaview="awaiting-refresh">
    <div className="text-[10px] font-semibold text-cyan-200">Language MetaView · measurement refresh available</div>
    <div className="mt-1 text-[9px] text-slate-400">Reopen this analysis or refresh POS/Quant to load the shared Transcript–POS–Quant comparison.</div>
  </div>;
  const p = data.cross_panel?.pos_quant_token_parity_percentage ?? 0;
  const cards = [
    ["POS–Quant agreement", `${p}%`],
    ["Transcript timing", `${data.transcript?.timed_coverage_percentage ?? 0}%`],
    ["Displayed POS taxonomy", `${data.pos?.classification_coverage_percentage ?? 0}%`],
    ["Tokens to review", String(data.cross_panel?.token_difference ?? 0)],
  ];
  const readiness = [p, data.transcript?.timed_coverage_percentage ?? 0, data.pos?.classification_coverage_percentage ?? 0, p];
  const readinessAxes = [
    ["Cross-panel agreement", readiness[0]],
    ["Transcript timing", readiness[1]],
    ["Displayed POS taxonomy", readiness[2]],
    ["Denominator alignment", readiness[3]],
  ];
  const points = readiness.map((value: number, index: number) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2;
    const radius = 42 * value / 100;
    return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
  }).join(" ");
  const attention = [
    (data.cross_panel?.token_difference ?? 0) > 0 ? { label: `Review ${data.cross_panel.token_difference} tokenizer differences`, panelType: "Quant", target: "token_info" } : null,
    (data.pos?.classification_coverage_percentage ?? 100) < 100 ? { label: `Confirmation needed · ${Math.round(100 - data.pos.classification_coverage_percentage)}% outside the displayed POS taxonomy`, panelType: "POS", target: "pos_counts" } : null,
  ].filter(Boolean) as Array<{ label: string; panelType: string; target: string }>;
  const openAttention = (item: { panelType: string; target: string }) => {
    eventBus.emit("openPanelRequest", { panelType: item.panelType });
    window.setTimeout(() => eventBus.emit("languageParityAttentionRequest", { panelType: item.panelType, target: item.target }), 50);
  };
  return <details open className="mx-3 mb-2 rounded border border-cyan-900/60 bg-[#101414]" data-vaa1-language-metaview="measured">
    <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold text-cyan-200">Language MetaView · {p}% cross-panel agreement</summary>
    <div className="grid grid-cols-2 gap-1 border-t border-cyan-950 p-2 xl:grid-cols-4">
      {cards.map(([label, value]) => <div key={label} className="rounded border border-slate-800 bg-[#0b0b0b] px-2 py-1.5"><div className="text-[9px] text-slate-500">{label}</div><div className="text-sm text-slate-200">{value}</div></div>)}
    </div>
    <div className="grid gap-4 border-t border-cyan-950 p-3 lg:grid-cols-[320px_1fr]">
      <div className="rounded border border-slate-800 bg-[#0b0b0b] p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">Attribute readiness</div>
        <div className="mb-2 text-[10px] text-slate-500">Centre = 0% · outer boundary = 100%</div>
        <div className="relative mx-auto h-72 w-72 max-w-full">
        <svg viewBox="0 0 100 100" className="absolute inset-6 h-60 w-60 max-w-[calc(100%-3rem)]" aria-label="Language attribute readiness radar">
          {[10.5, 21, 31.5, 42].map((radius) => <polygon key={radius} points={`50,${50-radius} ${50+radius},50 50,${50+radius} ${50-radius},50`} fill="none" stroke="#263445" strokeWidth="0.7" />)}
          <line x1="50" y1="8" x2="50" y2="92" stroke="#334155" strokeWidth="0.6" />
          <line x1="8" y1="50" x2="92" y2="50" stroke="#334155" strokeWidth="0.6" />
          <polygon points={points} fill="rgba(34,211,238,.22)" stroke="#22d3ee" strokeWidth="1.8" />
          {points.split(" ").map((point, index) => { const [cx, cy] = point.split(","); return <circle key={index} cx={cx} cy={cy} r="1.8" fill="#67e8f9" />; })}
        </svg>
        <div className="absolute left-1/2 top-0 -translate-x-1/2 text-center text-[10px] text-slate-300">Agreement<br/><strong className="text-cyan-200">{readiness[0]}%</strong></div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-right text-[10px] text-slate-300">Timing<br/><strong className="text-cyan-200">{readiness[1]}%</strong></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center text-[10px] text-slate-300">POS taxonomy<br/><strong className="text-cyan-200">{readiness[2]}%</strong></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] text-slate-300">Alignment<br/><strong className="text-cyan-200">{readiness[3]}%</strong></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {readinessAxes.map(([label, value]) => <div key={label as string} className="rounded border border-slate-800 px-2 py-1.5"><div className="text-[10px] text-slate-400">{label}</div><div className="text-base font-semibold text-cyan-200">{value}%</div></div>)}
        </div>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Attention available</div>
        {attention.length ? attention.map((item) => {
          const isPos = item.panelType === "POS";
          const input = Number(isPos ? data.pos?.input_token_count : data.pos?.input_token_count) || 0;
          const compared = Number(isPos ? data.pos?.classified_occurrence_count : data.quant?.input_token_count) || 0;
          const difference = isPos ? Math.max(0, input - compared) : Number(data.cross_panel?.token_difference || 0);
          const categoryCounts = isPos ? (data.pos?.outside_category_counts || {}) : {};
          const categoryExamples = isPos ? (data.pos?.outside_category_examples || {}) : {};
          const confirmationCategories = Object.keys(categoryCounts).length > 0 ? Object.keys(categoryCounts) : ["NUM", "PART", "SYM", "X"];
          return <details open key={item.label} className="mt-2 rounded border border-amber-900/50 bg-amber-950/10">
            <summary className="cursor-pointer px-3 py-2 text-xs text-amber-200 hover:bg-amber-950/30">{item.label}</summary>
            <div className="border-t border-amber-900/30 px-3 py-3 text-xs text-slate-300">
              <div className="grid grid-cols-3 gap-2">
                <div><span className="block text-[10px] text-slate-500">Input</span><strong>{input}</strong></div>
                <div><span className="block text-[10px] text-slate-500">{isPos ? "Displayed categories" : "Quant tokens"}</span><strong>{compared}</strong></div>
                <div><span className="block text-[10px] text-slate-500">Difference</span><strong className="text-amber-200">{difference}</strong></div>
              </div>
              {isPos ? <div className="mt-3 rounded border border-amber-700/40 bg-black/20 px-3 py-3" data-vaa1-confirmation-category="pos-taxonomy">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-200">Confirm these attributes</div>
                <div className="mt-2 flex flex-wrap gap-2">{confirmationCategories.map((category) => <span key={category} className="rounded border border-amber-700/50 bg-amber-950/30 px-2 py-1 font-semibold text-amber-100">{category}{categoryCounts[category] != null ? ` · ${categoryCounts[category]} tokens` : ""}</span>)}</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded border border-white/10 px-2 py-2"><span className="block text-[10px] text-slate-500">Category assignment</span><strong className="text-amber-100">Confirmation needed</strong></div>
                  <div className="rounded border border-white/10 px-2 py-2"><span className="block text-[10px] text-slate-500">Timestamp linkage</span><strong className="text-amber-100">Confirmation needed</strong></div>
                </div>
              </div> : null}
              {isPos && Object.keys(categoryCounts).length > 0 ? <div className="mt-3 space-y-2" data-vaa1-attention-evidence="pos-taxonomy-rows">
                {Object.entries(categoryCounts).map(([category, count]) => <div key={category} className="rounded border border-white/10 bg-black/20 px-3 py-2">
                  <div className="flex items-center justify-between"><strong className="text-amber-100">{category}</strong><span>{Number(count)} tokens</span></div>
                  <div className="mt-1 text-slate-400">{(categoryExamples[category] || []).join(", ") || "No token examples published"}</div>
                </div>)}
              </div> : null}
              {!isPos ? <div className="mt-3 grid grid-cols-2 gap-2" data-vaa1-attention-evidence="tokenizer-rows"><div className="rounded border border-white/10 px-2 py-2">POS token denominator: <strong>{input}</strong></div><div className="rounded border border-white/10 px-2 py-2">Quant token denominator: <strong>{compared}</strong></div></div> : null}
              {!isPos ? <p className="mt-3 text-slate-400">Confirm tokenizer exclusions and denominator alignment between POS and Quant.</p> : null}
              <button type="button" onClick={() => openAttention(item)} className="mt-3 rounded border border-cyan-700/60 px-3 py-2 text-cyan-200 hover:bg-cyan-950/30">Optional: open related view →</button>
            </div>
          </details>;
        }) : <div className="mt-2 text-xs text-emerald-300">All measured language attributes are ready.</div>}
      </div>
    </div>
  </details>;
}
