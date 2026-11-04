import type { MorphologyPackPolicy } from "@/lib/morphology-language-packs";
import { activeProjectScopeId } from "@/lib/active-project-scope";
import { getBrowserStorageItem, setBrowserStorageItem } from "@/lib/browser-storage";

export const MORPHOLOGY_CONFIGURATION_KEY = "vaa1.analysis.morphology-configuration.v1";

function storageKey(): string {
  return `${MORPHOLOGY_CONFIGURATION_KEY}.${encodeURIComponent(activeProjectScopeId() || "catalogue")}`;
}

export type MorphologyConfiguration = {
  policy: MorphologyPackPolicy;
  languages: string[];
  specialUseLanguage: string;
  allowRoughInterpretation: boolean;
};

export function readMorphologyConfiguration(): MorphologyConfiguration | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(getBrowserStorageItem(storageKey()) || "null");
    if (!value || !["core_only", "plus_1", "plus_2", "plus_3"].includes(value.policy)) {
      if (activeProjectScopeId() === "research-test-2-20226-cop30-vids") {
        return {
          policy: "plus_3",
          languages: ["fi", "de", "sv"],
          specialUseLanguage: "",
          allowRoughInterpretation: true,
        };
      }
      return null;
    }
    return {
      policy: value.policy,
      languages: Array.isArray(value.languages) ? value.languages.slice(0, 3).filter(Boolean) : [],
      specialUseLanguage: typeof value.specialUseLanguage === "string" ? value.specialUseLanguage : "",
      allowRoughInterpretation: value.allowRoughInterpretation !== false,
    };
  } catch {
    return null;
  }
}

export function writeMorphologyConfiguration(value: MorphologyConfiguration): void {
  if (typeof window === "undefined") return;
  setBrowserStorageItem(storageKey(), JSON.stringify(value));
}
