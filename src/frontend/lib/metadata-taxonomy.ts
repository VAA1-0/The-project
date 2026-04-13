export const MEDIA_GENRE_OPTIONS = [
  "news",
  "interview",
  "documentary",
  "research video",
  "drama / fiction",
  "advertising / promo",
  "music video",
  "stand-up / performance",
  "vlog",
  "explainer / commentary",
  "livestream / talk-to-camera",
  "podcast video",
  "reaction video",
  "tutorial / how-to",
  "short-form social clip",
  "meme / remix / edit",
  "archive / found footage",
  "institutional / campaign / public information",
  "webconferencing / meetings / webcalls",
  "other / mixed",
] as const;

export const MEDIA_SUBGENRE_OPTIONS: Record<string, string[]> = {
  news: [
    "breaking news",
    "studio anchor read",
    "field report",
    "panel discussion",
    "investigative segment",
  ],
  interview: [
    "studio interview",
    "field interview",
    "profile interview",
    "vox pop",
    "interrogative interview",
  ],
  documentary: [
    "tv documentary",
    "observational documentary",
    "explanatory documentary",
    "participatory documentary",
    "archival documentary",
    "docudrama",
    "biography documentary",
    "music documentary",
    "science documentary",
  ],
  "research video": [
    "experiment recording",
    "research interview",
    "counseling session",
    "fieldnotes video",
    "observation session",
    "lab demonstration",
  ],
  "drama / fiction": [
    "comedy",
    "tragedy",
    "suspense / thriller",
    "romance",
    "horror",
    "parody / satire",
    "epic / historical",
    "action / adventure",
    "crime / detective",
    "sci-fi",
    "fantasy",
    "melodrama",
  ],
  "advertising / promo": [
    "commercial spot",
    "brand film",
    "product demo",
    "campaign promo",
    "teaser",
  ],
  "music video": [
    "performance clip",
    "narrative clip",
    "lyric video",
    "live session",
    "dance-driven clip",
  ],
  "stand-up / performance": [
    "stand-up set",
    "monologue",
    "stage sketch",
    "spoken word",
    "live act",
  ],
  vlog: [
    "daily vlog",
    "personal update",
    "travel vlog",
    "confessional vlog",
    "family vlog",
  ],
  "explainer / commentary": [
    "explainer",
    "commentary",
    "essay video",
    "analysis breakdown",
    "news commentary",
  ],
  "livestream / talk-to-camera": [
    "solo livestream",
    "chat stream",
    "creator monologue",
    "Q&A stream",
    "event stream",
  ],
  "podcast video": [
    "studio podcast",
    "remote podcast",
    "panel podcast",
    "interview podcast",
    "video essay conversation",
  ],
  "reaction video": [
    "live reaction",
    "duet / stitch reaction",
    "commentary reaction",
    "trailer reaction",
    "watch-along reaction",
  ],
  "tutorial / how-to": [
    "screen tutorial",
    "hands-on demo",
    "step-by-step guide",
    "lesson",
    "workshop",
  ],
  "short-form social clip": [
    "short skit",
    "trend clip",
    "micro-vlog",
    "promo clip",
    "highlight snippet",
  ],
  "meme / remix / edit": [
    "remix",
    "supercut",
    "meme edit",
    "mashup",
    "found-audio edit",
  ],
  "archive / found footage": [
    "newsreel",
    "advertisement archive",
    "newscast archive",
    "news archive",
    "home video archive",
    "surveillance clip",
    "historical footage",
    "recovered media",
  ],
  "institutional / campaign / public information": [
    "press conference",
    "campaign message",
    "public information notice",
    "ceremonial address",
    "organizational briefing",
  ],
  "webconferencing / meetings / webcalls": [
    "team meeting",
    "webinar",
    "remote interview",
    "panel call",
    "classroom session",
  ],
  "other / mixed": ["hybrid format", "unclear / mixed genre", "other"],
};

export const SITUATIONAL_GENRE_OPTIONS = [
  "briefing",
  "confrontation",
  "celebration",
  "mourning",
  "negotiation",
  "confession",
  "testimony",
  "instruction",
  "debate",
  "interview",
  "announcement",
  "emergency response",
  "intimate interaction",
  "routine coordination",
  "leisure / socializing",
  "performance / entertainment",
  "travel / mobility",
  "personal care / inner life",
] as const;

export const SITUATIONAL_SUBGENRE_OPTIONS: Record<string, string[]> = {
  briefing: [
    "press briefing",
    "status update",
    "organizational briefing",
    "explainer briefing",
  ],
  confrontation: [
    "argument",
    "interrogation",
    "accusation",
    "disciplinary exchange",
  ],
  celebration: ["party", "ceremony", "congratulation", "festive gathering"],
  mourning: ["memorial", "condolence", "grief response", "funeral-related scene"],
  negotiation: ["bargaining", "mediation", "diplomatic exchange", "decision-making"],
  confession: ["apology", "disclosure", "emotional admission", "private confession"],
  testimony: ["witness account", "statement to authority", "interview testimony", "documentary testimony"],
  instruction: ["tutorial", "coaching", "classroom instruction", "procedural guidance"],
  debate: ["formal debate", "panel debate", "argumentative exchange", "cross-talk"],
  interview: ["profile interview", "investigative interview", "webcall interview", "vox pop"],
  announcement: ["public announcement", "internal update", "launch reveal", "policy statement"],
  "emergency response": [
    "crisis briefing",
    "rescue coordination",
    "urgent public warning",
    "on-scene response",
  ],
  "intimate interaction": [
    "romantic exchange",
    "family intimacy",
    "emotional support",
    "making love",
  ],
  "routine coordination": ["meeting", "scheduling", "teamwork", "administrative coordination"],
  "leisure / socializing": ["hanging out", "chatting", "public leisure", "game / pastime"],
  "performance / entertainment": ["performance", "rehearsal", "stand-up", "musical moment"],
  "travel / mobility": ["commute", "transit update", "journey segment", "arrival / departure"],
  "personal care / inner life": [
    "grooming",
    "self-talk",
    "reflection",
    "therapeutic / self-care moment",
  ],
};

export const PRIVACY_AXIS_OPTIONS = [
  "public",
  "semi-public",
  "private",
] as const;

export const EXPERTISE_AXIS_OPTIONS = [
  "professional",
  "mixed professional-lay",
  "lay / non-professional",
] as const;

export type CustomTaxonomyScope =
  | "media_genre"
  | "media_subgenre"
  | "situational_genre"
  | "situational_subgenre"
  | "privacy_axis"
  | "expertise_axis";

const CUSTOM_TAXONOMY_STORAGE_KEY = "vaa1.custom_taxonomy_counts.v1";
const CUSTOM_LABEL_PROMOTION_THRESHOLD = 1;

type CustomTaxonomyEntry = {
  label: string;
  count: number;
};

export type LearnedTaxonomyLabel = {
  label: string;
  count: number;
  promoted: boolean;
};

export type SharedTaxonomyOption = {
  label: string;
  parent_value?: string;
  scope: CustomTaxonomyScope;
};

type CustomTaxonomyStore = Partial<
  Record<CustomTaxonomyScope, Record<string, CustomTaxonomyEntry>>
>;

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function makeScopedKey(value: string, parentValue?: string): string {
  const normalizedValue = normalizeLabel(value).toLowerCase();
  const normalizedParent = normalizeLabel(parentValue || "").toLowerCase();
  return normalizedParent ? `${normalizedParent}::${normalizedValue}` : normalizedValue;
}

function readCustomTaxonomyStore(): CustomTaxonomyStore {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_TAXONOMY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as CustomTaxonomyStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCustomTaxonomyStore(store: CustomTaxonomyStore) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CUSTOM_TAXONOMY_STORAGE_KEY,
      JSON.stringify(store),
    );
  } catch {
    // Ignore localStorage write failures so metadata editing still works.
  }
}

function mergeUniqueOptions(options: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  options.forEach((option) => {
    const normalized = normalizeLabel(option);
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(normalized);
  });

  return merged;
}

function getPromotedCustomOptions(
  scope: CustomTaxonomyScope,
  parentValue?: string,
): string[] {
  return getLearnedTaxonomyLabels(scope, parentValue)
    .filter((entry) => entry.promoted)
    .map((entry) => entry.label)
    .sort((a, b) => a.localeCompare(b));
}

export function getLearnedTaxonomyLabels(
  scope: CustomTaxonomyScope,
  parentValue?: string,
): LearnedTaxonomyLabel[] {
  const store = readCustomTaxonomyStore();
  const scopedStore = store[scope] || {};
  const parentKey = normalizeLabel(parentValue || "").toLowerCase();

  return Object.entries(scopedStore)
    .filter(([key, entry]) => {
      if (!entry) {
        return false;
      }
      if (!parentKey) {
        return !key.includes("::");
      }
      return key.startsWith(`${parentKey}::`);
    })
    .map(([, entry]) => ({
      label: normalizeLabel(entry.label),
      count: entry.count,
      promoted: entry.count >= CUSTOM_LABEL_PROMOTION_THRESHOLD,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function registerCustomTaxonomyLabel(
  scope: CustomTaxonomyScope,
  value: string,
  parentValue?: string,
) {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return;
  }

  const store = readCustomTaxonomyStore();
  const scopedStore = store[scope] || {};
  const scopedKey = makeScopedKey(normalized, parentValue);
  const existing = scopedStore[scopedKey];

  scopedStore[scopedKey] = {
    label: normalized,
    count: (existing?.count || 0) + 1,
  };
  store[scope] = scopedStore;
  writeCustomTaxonomyStore(store);
}

export function removeCustomTaxonomyLabel(
  scope: CustomTaxonomyScope,
  value: string,
  parentValue?: string,
) {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return;
  }

  const store = readCustomTaxonomyStore();
  const scopedStore = store[scope];
  if (!scopedStore) {
    return;
  }

  const scopedKey = makeScopedKey(normalized, parentValue);
  if (!(scopedKey in scopedStore)) {
    return;
  }

  delete scopedStore[scopedKey];
  if (Object.keys(scopedStore).length === 0) {
    delete store[scope];
  } else {
    store[scope] = scopedStore;
  }
  writeCustomTaxonomyStore(store);
}

export function getSharedTaxonomyOptions(
  labels: SharedTaxonomyOption[],
  scope: CustomTaxonomyScope,
  parentValue?: string,
): string[] {
  const normalizedParent = normalizeLabel(parentValue || "").toLowerCase();
  return labels
    .filter((entry) => {
      if (entry.scope !== scope) {
        return false;
      }
      const entryParent = normalizeLabel(entry.parent_value || "").toLowerCase();
      if (!normalizedParent) {
        return !entryParent;
      }
      return entryParent === normalizedParent;
    })
    .map((entry) => normalizeLabel(entry.label))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function getMediaSubgenreOptions(
  genre: string,
  currentValue = "",
  sharedOptions: SharedTaxonomyOption[] = [],
): string[] {
  return mergeUniqueOptions([
    ...(MEDIA_SUBGENRE_OPTIONS[genre] || []),
    ...getSharedTaxonomyOptions(sharedOptions, "media_subgenre", genre),
    ...getPromotedCustomOptions("media_subgenre", genre),
    currentValue,
  ]);
}

export function getMediaGenreOptions(
  currentValue = "",
  sharedOptions: SharedTaxonomyOption[] = [],
): string[] {
  return mergeUniqueOptions([
    ...MEDIA_GENRE_OPTIONS,
    ...getSharedTaxonomyOptions(sharedOptions, "media_genre"),
    ...getPromotedCustomOptions("media_genre"),
    currentValue,
  ]);
}

export function getSituationalGenreOptions(
  currentValue = "",
  sharedOptions: SharedTaxonomyOption[] = [],
): string[] {
  return mergeUniqueOptions([
    ...SITUATIONAL_GENRE_OPTIONS,
    ...getSharedTaxonomyOptions(sharedOptions, "situational_genre"),
    ...getPromotedCustomOptions("situational_genre"),
    currentValue,
  ]);
}

export function getSituationalSubgenreOptions(
  genre: string,
  currentValue = "",
  sharedOptions: SharedTaxonomyOption[] = [],
): string[] {
  return mergeUniqueOptions([
    ...(SITUATIONAL_SUBGENRE_OPTIONS[genre] || []),
    ...getSharedTaxonomyOptions(sharedOptions, "situational_subgenre", genre),
    ...getPromotedCustomOptions("situational_subgenre", genre),
    currentValue,
  ]);
}

export function getPrivacyAxisOptions(
  currentValue = "",
  sharedOptions: SharedTaxonomyOption[] = [],
): string[] {
  return mergeUniqueOptions([
    ...PRIVACY_AXIS_OPTIONS,
    ...getSharedTaxonomyOptions(sharedOptions, "privacy_axis"),
    ...getPromotedCustomOptions("privacy_axis"),
    currentValue,
  ]);
}

export function getExpertiseAxisOptions(
  currentValue = "",
  sharedOptions: SharedTaxonomyOption[] = [],
): string[] {
  return mergeUniqueOptions([
    ...EXPERTISE_AXIS_OPTIONS,
    ...getSharedTaxonomyOptions(sharedOptions, "expertise_axis"),
    ...getPromotedCustomOptions("expertise_axis"),
    currentValue,
  ]);
}
