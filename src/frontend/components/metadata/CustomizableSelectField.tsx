import type { LearnedTaxonomyLabel } from "@/lib/metadata-taxonomy";

type CustomizableSelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  customValue: string;
  onCustomValueChange: (value: string) => void;
  onAddCustom: () => void;
  disabled?: boolean;
  emptyLabel?: string;
  customPlaceholder?: string;
  learnedLabels?: LearnedTaxonomyLabel[];
  onRemoveLearnedLabel?: (label: string) => void;
  onShareCustom?: () => void;
};

export default function CustomizableSelectField({
  label,
  value,
  onChange,
  options,
  customValue,
  onCustomValueChange,
  onAddCustom,
  disabled = false,
  emptyLabel = "Not set",
  customPlaceholder = "Add custom label if needed",
  learnedLabels = [],
  onRemoveLearnedLabel,
  onShareCustom,
}: CustomizableSelectFieldProps) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500 disabled:text-slate-500"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <div className="mt-2 flex gap-2">
        <input
          value={customValue}
          onChange={(e) => onCustomValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddCustom();
            }
          }}
          placeholder={customPlaceholder}
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
        />
        <button
          type="button"
          onClick={onAddCustom}
          className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-700/60"
        >
          Use
        </button>
        {onShareCustom ? (
          <button
            type="button"
            onClick={onShareCustom}
            className="rounded-md border border-emerald-700/70 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-200 transition hover:bg-emerald-800/30"
          >
            Share
          </button>
        ) : null}
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        Custom labels are saved on this browser until you remove them. A future shared workflow can promote approved labels system-wide.
      </div>
      {learnedLabels.length > 0 ? (
        <div className="mt-2">
          <div className="mb-1 text-[10px] text-slate-500">
            Saved on this browser
          </div>
          <div className="flex flex-wrap gap-2">
            {learnedLabels.map((entry) => (
              <span
                key={entry.label}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/40 px-2 py-1 text-[11px] text-slate-200"
              >
                <span>
                  {entry.label}
                </span>
                {onRemoveLearnedLabel ? (
                  <button
                    type="button"
                    onClick={() => onRemoveLearnedLabel(entry.label)}
                    className="text-slate-400 transition hover:text-red-300"
                    aria-label={`Remove learned label ${entry.label}`}
                    title="Remove learned label"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </label>
  );
}
