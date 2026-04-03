export type MorphologyPackPolicy = "core_only" | "plus_1" | "plus_2";

export const MORPHOLOGY_PACK_POLICY_OPTIONS: Array<{
  value: MorphologyPackPolicy;
  label: string;
  slots: number;
}> = [
  { value: "core_only", label: "English core", slots: 0 },
  { value: "plus_1", label: "English +1", slots: 1 },
  { value: "plus_2", label: "English +2", slots: 2 },
];

export const MORPHOLOGY_LANGUAGE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "ar", label: "Arabic" },
  { code: "bg", label: "Bulgarian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "es", label: "Spanish" },
  { code: "et", label: "Estonian" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "ga", label: "Irish" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hr", label: "Croatian" },
  { code: "hu", label: "Hungarian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "lt", label: "Lithuanian" },
  { code: "lv", label: "Latvian" },
  { code: "mt", label: "Maltese" },
  { code: "nl", label: "Dutch" },
  { code: "no", label: "Norwegian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "sv", label: "Swedish" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "zh", label: "Chinese" },
  { code: "fa", label: "Persian / Farsi" },
];

export function morphologySlotCount(policy: MorphologyPackPolicy): number {
  return MORPHOLOGY_PACK_POLICY_OPTIONS.find((item) => item.value === policy)?.slots ?? 0;
}
