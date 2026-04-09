import type { ExpressionSample } from "./video-service";
import type { SourceMediaMetadata } from "./api-service";

type WeightFamily = Record<string, number>;

const EXPRESSION_FAMILY_LABELS = [
  "amused",
  "assertive",
  "composed",
  "concerned",
  "emphatic",
  "focused",
  "formal_neutral",
  "reflective",
  "reassuring",
  "serious",
  "skeptical",
  "warm",
] as const;

const DEFAULT_WEIGHT = 1.0;
const CONFLICT_THRESHOLD = 0.08;

const MEDIA_GENRE_PROFILES: Record<string, WeightFamily> = {
  news: {
    serious: 1.35,
    focused: 1.2,
    formal_neutral: 1.35,
    concerned: 1.2,
    emphatic: 1.1,
    amused: 0.6,
    warm: 0.75,
    composed: 1.25,
    reflective: 0.95,
    skeptical: 1.0,
    assertive: 1.1,
    reassuring: 0.95,
  },
  interview: {
    serious: 1.15,
    focused: 1.2,
    formal_neutral: 1.1,
    concerned: 1.1,
    emphatic: 1.05,
    amused: 0.9,
    warm: 1.0,
    composed: 1.1,
    reflective: 1.3,
    skeptical: 1.15,
    assertive: 1.05,
    reassuring: 1.0,
  },
  institutional_campaign_public_information: {
    serious: 1.25,
    focused: 1.1,
    formal_neutral: 1.3,
    concerned: 1.1,
    emphatic: 1.15,
    amused: 0.55,
    warm: 0.9,
    composed: 1.2,
    reflective: 0.95,
    skeptical: 0.85,
    assertive: 1.2,
    reassuring: 1.2,
  },
  drama_fiction: {
    serious: 1.0,
    focused: 1.0,
    formal_neutral: 0.9,
    concerned: 1.0,
    emphatic: 1.1,
    amused: 1.05,
    warm: 1.0,
    composed: 0.95,
    reflective: 1.05,
    skeptical: 1.0,
    assertive: 1.05,
    reassuring: 0.95,
  },
  vlog: {
    serious: 0.9,
    focused: 1.0,
    formal_neutral: 0.7,
    concerned: 0.95,
    emphatic: 1.2,
    amused: 1.3,
    warm: 1.25,
    composed: 0.85,
    reflective: 1.05,
    skeptical: 0.95,
    assertive: 1.0,
    reassuring: 1.1,
  },
};

const GENRE_SUBTYPE_PROFILES: Record<string, WeightFamily> = {
  studio_anchor_read: {
    formal_neutral: 1.2,
    serious: 1.15,
    composed: 1.1,
    warm: 0.85,
    amused: 0.6,
  },
  breaking_news: {
    concerned: 1.2,
    emphatic: 1.15,
    serious: 1.1,
    reassuring: 0.9,
  },
  press_conference: {
    assertive: 1.15,
    formal_neutral: 1.1,
    serious: 1.1,
    amused: 0.7,
  },
  profile_interview: {
    reflective: 1.15,
    warm: 1.05,
    focused: 1.05,
  },
  interrogative_interview: {
    skeptical: 1.15,
    focused: 1.1,
    assertive: 1.05,
  },
  organizational_briefing: {
    formal_neutral: 1.15,
    composed: 1.1,
    reassuring: 1.05,
    amused: 0.75,
  },
  public_information_notice: {
    reassuring: 1.2,
    formal_neutral: 1.1,
    serious: 1.05,
  },
  campaign_message: {
    emphatic: 1.15,
    assertive: 1.1,
    warm: 1.05,
  },
  confessional_vlog: {
    reflective: 1.15,
    warm: 1.1,
    concerned: 1.05,
    formal_neutral: 0.8,
  },
  daily_vlog: {
    warm: 1.15,
    amused: 1.1,
    emphatic: 1.05,
    formal_neutral: 0.8,
  },
  personal_update: {
    warm: 1.1,
    reflective: 1.05,
    reassuring: 1.05,
  },
  drama_fiction_general: {
    emphatic: 1.05,
    amused: 1.05,
    reflective: 1.05,
    formal_neutral: 0.9,
  },
};

const SITUATIONAL_GENRE_PROFILES: Record<string, WeightFamily> = {
  announcement: {
    emphatic: 1.1,
    formal_neutral: 1.05,
    assertive: 1.05,
  },
  briefing: {
    serious: 1.15,
    formal_neutral: 1.15,
    focused: 1.1,
    amused: 0.75,
  },
  celebration: {
    warm: 1.15,
    amused: 1.2,
    reassuring: 1.05,
  },
  confession: {
    reflective: 1.2,
    concerned: 1.1,
    composed: 0.9,
  },
  confrontation: {
    assertive: 1.2,
    skeptical: 1.1,
    serious: 1.05,
    warm: 0.8,
  },
  debate: {
    assertive: 1.1,
    skeptical: 1.15,
    focused: 1.1,
  },
  emergency_response: {
    concerned: 1.2,
    emphatic: 1.15,
    serious: 1.1,
  },
  instruction: {
    focused: 1.1,
    reassuring: 1.05,
    formal_neutral: 1.05,
  },
  intimate_interaction: {
    warm: 1.2,
    reflective: 1.1,
    amused: 1.05,
    formal_neutral: 0.75,
  },
  interview: {
    reflective: 1.15,
    focused: 1.1,
    skeptical: 1.05,
  },
  leisure_socializing: {
    warm: 1.15,
    amused: 1.15,
    serious: 0.85,
  },
  mourning: {
    concerned: 1.2,
    reflective: 1.15,
    warm: 0.85,
  },
  negotiation: {
    focused: 1.15,
    skeptical: 1.1,
    composed: 1.05,
  },
  performance_entertainment: {
    emphatic: 1.15,
    amused: 1.1,
    warm: 1.05,
  },
  personal_care_inner_life: {
    reflective: 1.15,
    composed: 1.05,
    formal_neutral: 0.85,
  },
  routine_coordination: {
    formal_neutral: 1.1,
    focused: 1.05,
    composed: 1.05,
  },
  testimony: {
    serious: 1.1,
    reflective: 1.1,
    concerned: 1.05,
  },
  travel_mobility: {
    focused: 1.05,
    composed: 0.95,
    emphatic: 1.05,
  },
};

const SITUATIONAL_SUBTYPE_PROFILES: Record<string, WeightFamily> = {
  crisis_briefing: {
    concerned: 1.2,
    emphatic: 1.1,
    serious: 1.1,
  },
  explainer_briefing: {
    focused: 1.1,
    reassuring: 1.05,
    formal_neutral: 1.05,
  },
  formal_debate: {
    skeptical: 1.15,
    assertive: 1.1,
    focused: 1.1,
  },
  investigative_interview: {
    skeptical: 1.15,
    reflective: 1.1,
    serious: 1.05,
  },
  organizational_briefing: {
    formal_neutral: 1.1,
    composed: 1.1,
    serious: 1.05,
  },
  policy_statement: {
    assertive: 1.1,
    formal_neutral: 1.1,
    reassuring: 1.05,
  },
  public_announcement: {
    emphatic: 1.1,
    serious: 1.05,
    formal_neutral: 1.05,
  },
  reflection: {
    reflective: 1.2,
    composed: 1.05,
    warm: 0.95,
  },
  tutorial: {
    focused: 1.1,
    reassuring: 1.05,
    formal_neutral: 1.05,
  },
  witness_account: {
    serious: 1.1,
    concerned: 1.05,
    reflective: 1.1,
  },
};

const PRIVACY_PROFILES: Record<string, WeightFamily> = {
  private: {
    warm: 1.1,
    reflective: 1.1,
    amused: 1.05,
    formal_neutral: 0.85,
  },
  semi_public: {},
  public: {
    formal_neutral: 1.1,
    serious: 1.05,
    composed: 1.05,
    amused: 0.9,
  },
};

const EXPERTISE_PROFILES: Record<string, WeightFamily> = {
  lay_non_professional: {
    warm: 1.05,
    amused: 1.05,
    formal_neutral: 0.9,
  },
  mixed_professional_lay: {},
  professional: {
    formal_neutral: 1.1,
    focused: 1.05,
    composed: 1.05,
    serious: 1.05,
  },
};

function slugify(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\/]+/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function emptyScores(): Record<string, number> {
  return Object.fromEntries(
    EXPRESSION_FAMILY_LABELS.map((label) => [label, 0]),
  ) as Record<string, number>;
}

function clampWeight(weight: number): number {
  return Math.max(0.5, Math.min(1.35, weight));
}

function addWeightedContribution(
  target: Record<string, number>,
  additions: Array<[string, number]>,
  strength: number,
) {
  additions.forEach(([label, multiplier]) => {
    if (!(label in target)) {
      return;
    }
    target[label] += Math.max(0, strength * multiplier);
  });
}

function buildBaseExpressionScores(sample: ExpressionSample): Record<string, number> {
  const scores = emptyScores();
  const confidenceBase =
    sample.top_emotion_score && sample.top_emotion_score > 0
      ? sample.top_emotion_score
      : sample.expression_evidence?.top_score && sample.expression_evidence.top_score > 0
        ? sample.expression_evidence.top_score
        : sample.expression_evidence?.level === "clear"
          ? 0.72
          : sample.expression_evidence?.level === "weak"
            ? 0.48
            : 0.35;

  const interpretedLabel = sample.interpreted_expression?.label || "";
  if (interpretedLabel && interpretedLabel in scores) {
    scores[interpretedLabel] += confidenceBase;
    (sample.interpreted_expression?.near_neighbors || [])
      .filter((label) => label in scores)
      .slice(0, 3)
      .forEach((neighbor, index) => {
        scores[neighbor] += confidenceBase * (index === 0 ? 0.36 : 0.22);
      });
  }

  const rawEmotionScores = sample.emotion || {};
  Object.entries(rawEmotionScores).forEach(([rawEmotion, rawScore]) => {
    const strength = Number(rawScore) > 1 ? Number(rawScore) / 100 : Number(rawScore);
    if (!Number.isFinite(strength) || strength <= 0) {
      return;
    }
    switch (rawEmotion.toLowerCase()) {
      case "happy":
        addWeightedContribution(
          scores,
          [
            ["warm", 1.0],
            ["amused", 0.75],
            ["reassuring", 0.45],
          ],
          strength,
        );
        break;
      case "surprise":
        addWeightedContribution(
          scores,
          [
            ["emphatic", 1.0],
            ["focused", 0.35],
            ["serious", 0.2],
          ],
          strength,
        );
        break;
      case "sad":
        addWeightedContribution(
          scores,
          [
            ["concerned", 1.0],
            ["reflective", 0.8],
            ["composed", 0.2],
          ],
          strength,
        );
        break;
      case "angry":
        addWeightedContribution(
          scores,
          [
            ["assertive", 1.0],
            ["serious", 0.75],
            ["skeptical", 0.35],
          ],
          strength,
        );
        break;
      case "fear":
        addWeightedContribution(
          scores,
          [
            ["concerned", 0.9],
            ["skeptical", 0.4],
            ["serious", 0.25],
          ],
          strength,
        );
        break;
      case "disgust":
        addWeightedContribution(
          scores,
          [
            ["skeptical", 1.0],
            ["assertive", 0.25],
            ["serious", 0.2],
          ],
          strength,
        );
        break;
      case "neutral":
        addWeightedContribution(
          scores,
          [
            ["formal_neutral", 1.0],
            ["composed", 0.85],
            ["serious", 0.7],
            ["focused", 0.45],
            ["reassuring", 0.25],
          ],
          strength,
        );
        break;
      default:
        break;
    }
  });

  const maxScore = Math.max(...Object.values(scores), 0);
  if (maxScore <= 0) {
    return scores;
  }
  return Object.fromEntries(
    Object.entries(scores).map(([label, value]) => [label, Number((value / maxScore).toFixed(4))]),
  );
}

function getPerLabelCombinedWeights(context: {
  media_genre: string;
  genre_subtype: string;
  situational_genre: string;
  situational_subtype: string;
  privacy_axis: string;
  expertise_axis: string;
}): Record<string, number> {
  const mediaWeights = MEDIA_GENRE_PROFILES[context.media_genre] || {};
  const subtypeWeights = GENRE_SUBTYPE_PROFILES[context.genre_subtype] || {};
  const situationalWeights =
    SITUATIONAL_GENRE_PROFILES[context.situational_genre] || {};
  const situationalSubtypeWeights =
    SITUATIONAL_SUBTYPE_PROFILES[context.situational_subtype] || {};
  const privacyWeights = PRIVACY_PROFILES[context.privacy_axis] || {};
  const expertiseWeights = EXPERTISE_PROFILES[context.expertise_axis] || {};

  return Object.fromEntries(
    EXPRESSION_FAMILY_LABELS.map((label) => [
      label,
      Number(
        (
          clampWeight(mediaWeights[label] ?? DEFAULT_WEIGHT) *
          clampWeight(subtypeWeights[label] ?? DEFAULT_WEIGHT) *
          clampWeight(situationalWeights[label] ?? DEFAULT_WEIGHT) *
          clampWeight(situationalSubtypeWeights[label] ?? DEFAULT_WEIGHT) *
          clampWeight(privacyWeights[label] ?? DEFAULT_WEIGHT) *
          clampWeight(expertiseWeights[label] ?? DEFAULT_WEIGHT)
        ).toFixed(4),
      ),
    ]),
  );
}

function summarizeAxisWeight(
  profile: WeightFamily | undefined,
  focusLabel: string,
): number {
  return Number(clampWeight(profile?.[focusLabel] ?? DEFAULT_WEIGHT).toFixed(3));
}

function rankScores(scores: Record<string, number>) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([label, score]) => ({ label, score: Number(score.toFixed(4)) }));
}

export function buildExpressionWeighting(
  sample: ExpressionSample,
  metadata?: SourceMediaMetadata | null,
) {
  const annotations = metadata?.user_annotations;
  const context = {
    media_genre: slugify(annotations?.genre),
    genre_subtype: slugify(annotations?.genre_subtype),
    situational_genre: slugify(annotations?.situational_genre),
    situational_subtype: slugify(annotations?.situational_subtype),
    privacy_axis: slugify(annotations?.privacy_axis),
    expertise_axis: slugify(annotations?.expertise_axis),
  };

  const base_scores = buildBaseExpressionScores(sample);
  const per_label_weights = getPerLabelCombinedWeights(context);
  const weighted_raw = Object.fromEntries(
    Object.entries(base_scores).map(([label, value]) => [
      label,
      Number((value * (per_label_weights[label] || DEFAULT_WEIGHT)).toFixed(6)),
    ]),
  );
  const weightedMax = Math.max(...Object.values(weighted_raw), 0);
  const weighted_scores =
    weightedMax > 0
      ? Object.fromEntries(
          Object.entries(weighted_raw).map(([label, value]) => [
            label,
            Number((value / weightedMax).toFixed(4)),
          ]),
        )
      : weighted_raw;

  const rankedBase = rankScores(base_scores);
  const rankedWeighted = rankScores(weighted_scores);
  const primary = rankedWeighted[0] || { label: "unavailable", score: 0 };
  const runnerUp = rankedWeighted[1] || { label: "unavailable", score: 0 };
  const margin = Number((primary.score - runnerUp.score).toFixed(4));

  return {
    context,
    base_scores,
    applied_weights: {
      expression: {
        media_genre_weight: summarizeAxisWeight(
          MEDIA_GENRE_PROFILES[context.media_genre],
          primary.label,
        ),
        genre_subtype_weight: summarizeAxisWeight(
          GENRE_SUBTYPE_PROFILES[context.genre_subtype],
          primary.label,
        ),
        situational_genre_weight: summarizeAxisWeight(
          SITUATIONAL_GENRE_PROFILES[context.situational_genre],
          primary.label,
        ),
        situational_subtype_weight: summarizeAxisWeight(
          SITUATIONAL_SUBTYPE_PROFILES[context.situational_subtype],
          primary.label,
        ),
        privacy_weight: summarizeAxisWeight(
          PRIVACY_PROFILES[context.privacy_axis],
          primary.label,
        ),
        expertise_weight: summarizeAxisWeight(
          EXPERTISE_PROFILES[context.expertise_axis],
          primary.label,
        ),
      },
    },
    weighted_scores,
    ranking: {
      base_primary: rankedBase[0] || null,
      weighted_primary: primary,
      weighted_runner_up: runnerUp,
      margin_to_second: margin,
      keep_runner_up_visible: margin < CONFLICT_THRESHOLD,
    },
  };
}
