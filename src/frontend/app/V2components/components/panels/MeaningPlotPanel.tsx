import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { eventBus } from "@/lib/golden-layout-lib/eventBus";
import { VideoService, type AnalysisData, type MasterSchemaResolvedEvidenceRecord } from "@/lib/video-service";
import type { AudioProsodyCue, ExpressionSample, TranscriptSegment } from "@/lib/video-service";
import { openVideoAtTime } from "@/lib/video-navigation";
import { apiService, type AnnotationCorrections, type ManualVisualAnnotation, type ProliferationDecision, type SecondOrderLabelInstruction, type SourceMediaMetadata } from "@/lib/api-service";
import {
  retimeManualVisualAnnotationsFromPresenceInterval,
} from "@/lib/annotation-corrections";
import {
  matureSceneSegmentsFromAnalysis,
  matureSceneSegmentSourceLabel,
} from "@/lib/scene-governance";

type PlotLens = "aristotle" | "freytag" | "campbell" | "frye" | "booker";
type DramaticArchetypeLens =
  | "shakespearean_performativity"
  | "proppian_function"
  | "jungian_symbolic"
  | "campbellian_threshold"
  | "greimasian_actant"
  | "burkean_motive"
  | "bojean_antenarrative";

type NarrativeAgentProfile = NonNullable<
  NonNullable<SourceMediaMetadata["user_annotations"]>["narrative_agent_profiles"]
>[number];

type MeaningSceneSegment = {
  scene_index?: number;
  start: number;
  end: number;
  duration?: number;
};

type CharacterSceneGovernanceRow = {
  label: string;
  profile?: NarrativeAgentProfile;
  profileKey: string;
  scenes: Array<{
    scene: MeaningSceneSegment;
    sceneIndex: number;
    sceneKey: string;
    staged: boolean;
    surfaced: boolean;
    sceneInstructions: SecondOrderLabelInstruction[];
    lines: TranscriptSegment[];
    manualAnnotations: Array<Record<string, any>>;
    audioProsody: Array<Record<string, any>>;
    sourceSamples: Array<Record<string, any>>;
    persistenceSignals: SecondOrderLabelInstruction[];
  }>;
};

type SceneConstellationLayer = {
  layer_id?: string;
  label?: string;
  count?: number;
  authority?: string;
  source?: string;
  status?: string;
};

type MeaningSceneCard = {
  scene_id?: string;
  title?: string;
  display_title?: string;
  overview?: string;
  nlp_scene_summary_sentence?: string;
  nlp_scene_summary?: {
    sentence?: string;
    description?: Record<string, string | undefined>;
    interrogative_schema?: Record<string, string | undefined>;
    prose_sections?: Record<string, string | undefined>;
  };
  prose_sections?: Record<string, string | undefined>;
  interrogative_schema?: Record<string, string | undefined>;
  mise_en_scene_description?: Record<string, string | undefined>;
  said_in_scene?: Array<{ speaker?: string; text?: string }>;
  items?: Array<{ category?: string; label?: string; symbol?: string }>;
  resolved_items?: Array<{ category?: string; label?: string; symbol?: string }>;
};

type InterpretiveReading = {
  reading_id?: string;
  lens_id?: string;
  lens_label?: string;
  lens_question?: string;
  reading_type?: string;
  claim_label?: string;
  claim_prose?: string;
  support_score?: number;
  maturity_state?: string;
  maturity_gate?: {
    state?: string;
    reason?: string;
    can_surface?: boolean;
    requires_review?: boolean;
    source_anchor_present?: boolean;
    narrative_agent_profile_present?: boolean;
    support_band?: string;
    source_ref_count?: number;
    evidence_kinds?: string[];
  };
  authority_level?: string;
  target?: {
    target_type?: string;
    target_label_family?: string;
    source_instruction_id?: string;
    time_span?: {
      start_ms?: number;
      end_ms?: number;
      start?: number;
      end?: number;
    };
  };
  time_span?: {
    start_ms?: number;
    end_ms?: number;
    start?: number;
    end?: number;
  };
  scene_refs?: Array<Record<string, any>>;
  evidence_refs?: Array<Record<string, any>>;
  narrative_agent?: {
    profile_key?: string;
    current_label?: string;
    boundary?: string;
  };
  archetype_scores?: Record<string, number>;
  analyst_actions?: string[];
};

type MeaningNetworkEvidenceRef = {
  evidence_id?: string;
  source_type?: string;
  time_range?: { start?: number; end?: number };
  traceback_record_id?: string;
  confidence?: number;
};

type MeaningNetworkNode = {
  node_id: string;
  node_type: string;
  label: string;
  description?: string;
  attributes?: Record<string, any>;
  maturity?: { level?: string; authority?: string; confidence?: number };
  evidence_refs?: MeaningNetworkEvidenceRef[];
  ui?: {
    display_group?: string;
    quick_confirm_enabled?: boolean;
    copy_paste_enabled?: boolean;
    update_enabled?: boolean;
    source_navigation_enabled?: boolean;
    node_marker?: Record<string, any>;
  };
};

type MeaningNetworkEdge = {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  weight?: number;
  maturity?: { level?: string; authority?: string; confidence?: number };
  evidence_refs?: MeaningNetworkEvidenceRef[];
  ui?: {
    quick_confirm_enabled?: boolean;
    copy_paste_enabled?: boolean;
    update_enabled?: boolean;
    source_navigation_enabled?: boolean;
    edge_marker?: Record<string, any>;
  };
};

type MeaningNetworkArtifact = {
  schema?: string;
  meaning_network?: {
    nodes?: MeaningNetworkNode[];
    edges?: MeaningNetworkEdge[];
    continuity_anchors?: Array<Record<string, any>>;
    ui_contract?: Record<string, any>;
  };
  summary?: Record<string, any>;
};

type MeaningNetworkViewMode = "graph" | "whole_timeline" | "scene_timeline" | "character_timeline";

type MeaningNetworkPresenceMode = "on_camera" | "off_camera" | "ambient" | "location" | "music" | string;

type MeaningNetworkLane = {
  lane_id: string;
  label: string;
  nodeTypes?: string[];
  presenceMode?: MeaningNetworkPresenceMode;
};

type MeaningNetworkPresenceBar = {
  node: MeaningNetworkNode;
  x: number;
  y: number;
  width: number;
  height: number;
  start: number;
  end: number;
  sourceTimed: boolean;
};

type MeaningNetworkTimeRange = {
  start: number;
  end: number;
};

type MeaningNetworkVerificationRange = MeaningNetworkTimeRange & {
  range_source: "evidence_ref" | "presence_override";
  source_verification_status: "source_time_resolved";
  source_evidence_refs: MeaningNetworkEvidenceRef[];
  source_traceback_refs: string[];
  source_types: string[];
};

type MeaningNetworkPresenceDrag = {
  nodeId: string;
  handle: "start" | "end" | "move";
  pointerId: number;
  originSeconds: number;
  originalStart: number;
  originalEnd: number;
};

type MeaningNetworkCopiedContent = {
  kind: "node" | "edge";
  label?: string;
  description?: string;
  node_type?: string;
  edge_type?: string;
  attributes?: Record<string, any>;
  maturity?: { level?: string; authority?: string; confidence?: number };
  evidence_refs?: MeaningNetworkEvidenceRef[];
};

type MeaningNetworkContextMenuState = {
  x: number;
  y: number;
  kind: "node" | "edge";
  node?: MeaningNetworkNode;
  edge?: MeaningNetworkEdge;
};

type MeaningNetworkSheetState = {
  kind: "node" | "edge";
  node?: MeaningNetworkNode;
  edge?: MeaningNetworkEdge;
};

type MeaningNetworkSflLayer = "ideational" | "interpersonal" | "textual" | "virtues_and_vices";
type MeaningNetworkMoralPolarity = "virtue" | "vice" | "ambivalent" | "not_moralized";

type MeaningNetworkSflDraft = {
  sfl_layer: MeaningNetworkSflLayer;
  sfl_category: string;
  judgement_group: string;
  judgement_axis: string;
  moral_polarity: MeaningNetworkMoralPolarity;
  virtue_family: string;
  virtue_axis: string;
  virtue_vice_value: string;
  confirmation_relation: string;
  applied_label: string;
};

type MeaningNetworkPresenceInterval = NonNullable<AnnotationCorrections["master_schema_presence_intervals"]>[number];

const MEANING_NETWORK_DEFAULT_LANES: MeaningNetworkLane[] = [
  { lane_id: "scene", label: "Scenes", nodeTypes: ["scene"] },
  { lane_id: "on_camera_agents", label: "On-camera agents", nodeTypes: ["character", "narrative_agent", "speaker", "identity"] },
  { lane_id: "off_camera_presence", label: "Off-camera / presumed presence", nodeTypes: ["off_camera_presence"], presenceMode: "off_camera" },
  { lane_id: "spoken_word", label: "Spoken word", nodeTypes: ["transcript", "spoken_word"] },
  { lane_id: "prosody", label: "Prosody / delivery", nodeTypes: ["prosody"] },
  { lane_id: "objects", label: "Objects / props", nodeTypes: ["object"] },
  { lane_id: "location", label: "Location / setting", nodeTypes: ["location"], presenceMode: "location" },
  { lane_id: "music", label: "Music / sonic field", nodeTypes: ["music"], presenceMode: "music" },
  { lane_id: "evidence", label: "Evidence / language", nodeTypes: ["evidence_fragment", "expression", "manual_annotation"] },
  { lane_id: "other", label: "Other meaning tracks" },
];

const INTERPRETIVE_READING_UI_CONFIG = {
  minVisibleSupport: 0.35,
  maxPlotReadingsPerLens: 12,
  maxScenePresenceChips: 14,
  maxAgentReadingGroups: 8,
  showLowSupportCandidates: true,
};

const PLOT_LENSES: Array<{ id: PlotLens; label: string }> = [
  { id: "aristotle", label: "Aristotle" },
  { id: "freytag", label: "Freytag" },
  { id: "campbell", label: "Campbell" },
  { id: "frye", label: "Frye" },
  { id: "booker", label: "Booker" },
];

const MEANING_NETWORK_SFL_LAYERS: Array<{ value: MeaningNetworkSflLayer; label: string }> = [
  { value: "ideational", label: "Ideational" },
  { value: "interpersonal", label: "Interpersonal" },
  { value: "textual", label: "Textual" },
  { value: "virtues_and_vices", label: "Virtues / vices" },
];

const MEANING_NETWORK_SFL_IDEATIONAL_CATEGORIES = [
  "actor",
  "object",
  "action",
  "event",
  "process",
  "situation",
  "location",
  "time",
  "causal_relation",
  "material_relation",
  "symbolic_object",
];

const MEANING_NETWORK_SFL_TEXTUAL_CATEGORIES = [
  "sequence",
  "continuity",
  "contrast",
  "emphasis",
  "framing",
  "rhythm",
  "transition",
  "repetition",
  "silence",
  "editing_structure",
];

const MEANING_NETWORK_SFL_JUDGEMENT: Record<string, string[]> = {
  alignment_positive: [
    "acceptance",
    "affirmation",
    "confirmation",
    "agreement",
    "support",
    "solidarity",
    "trust",
    "endorsement",
    "legitimization",
  ],
  alignment_negative: [
    "rejection",
    "denial",
    "contradiction",
    "dismissal",
    "hostility",
    "delegitimization",
    "distrust",
    "opposition",
    "alienation",
  ],
  authority_positive: [
    "command",
    "guidance",
    "permission",
    "advice",
    "validation",
    "authorization",
  ],
  authority_negative: [
    "prohibition",
    "suppression",
    "silencing",
    "humiliation",
    "coercion",
    "domination",
  ],
  relational_positive: [
    "care",
    "love",
    "compassion",
    "respect",
    "admiration",
    "reconciliation",
  ],
  relational_negative: [
    "cruelty",
    "contempt",
    "ridicule",
    "hatred",
    "abandonment",
    "exclusion",
  ],
};

const MEANING_NETWORK_SFL_CONFIRMATION_RELATIONS = [
  "confirms",
  "rejects",
  "aligns_with",
  "opposes",
  "morally_legitimizes",
  "morally_delegitimizes",
];

const MEANING_NETWORK_SFL_VIRTUES: Record<string, Record<string, { positive: string[]; antithesis: string[] }>> = {
  wisdom_and_knowledge: {
    creativity: {
      positive: ["creativity", "inventiveness", "adaptive_imagination", "innovation", "resourcefulness"],
      antithesis: ["rigidity", "dogmatism", "mental_stagnation", "imitative_thinking", "destructive_chaos"],
    },
    curiosity: {
      positive: ["exploration", "wonder", "interest", "discovery", "questioning"],
      antithesis: ["apathy", "closedness", "avoidance", "fear_of_discovery", "intellectual_passivity"],
    },
    open_mindedness_judgment: {
      positive: ["critical_thinking", "reflection", "balanced_reasoning", "fair_evaluation", "perspective_taking"],
      antithesis: ["bias", "prejudice", "fanaticism", "impulsiveness", "delusion"],
    },
    love_of_learning: {
      positive: ["study", "mastery", "growth", "deep_engagement", "discipline_of_learning"],
      antithesis: ["anti_intellectualism", "shallowness", "willful_ignorance", "cynical_disengagement"],
    },
    perspective: {
      positive: ["wisdom", "guidance", "counsel", "holistic_understanding", "maturity"],
      antithesis: ["confusion", "naivety", "misguidance", "short_sightedness"],
    },
  },
  courage: {
    bravery: {
      positive: ["bravery", "risk_taking", "moral_courage", "steadfastness", "resistance"],
      antithesis: ["cowardice", "avoidance", "submission", "paralysis"],
    },
    persistence_perseverance: {
      positive: ["perseverance", "discipline", "endurance", "commitment", "finishing_what_one_starts"],
      antithesis: ["quitting", "collapse", "fickleness", "disintegration"],
    },
    integrity_honesty: {
      positive: ["truthfulness", "authenticity", "transparency", "sincerity"],
      antithesis: ["deception", "manipulation", "corruption", "duplicity"],
    },
    vitality_zest: {
      positive: ["energy", "enthusiasm", "aliveness", "engagement"],
      antithesis: ["apathy", "exhaustion", "nihilism", "emotional_deadness"],
    },
  },
  humanity: {
    love: {
      positive: ["love", "attachment", "care", "devotion", "intimacy"],
      antithesis: ["alienation", "detachment", "abandonment", "emotional_coldness"],
    },
    kindness: {
      positive: ["kindness", "compassion", "generosity", "mercy", "helpfulness"],
      antithesis: ["cruelty", "sadism", "selfishness", "indifference"],
    },
    social_intelligence: {
      positive: ["empathy", "attunement", "diplomacy", "relational_awareness"],
      antithesis: ["social_blindness", "manipulation", "emotional_stupidity", "callousness"],
    },
  },
  justice: {
    teamwork_citizenship: {
      positive: ["cooperation", "solidarity", "loyalty", "shared_responsibility"],
      antithesis: ["betrayal", "fragmentation", "self_interest", "tribal_sabotage"],
    },
    fairness: {
      positive: ["equity", "impartiality", "justice", "reciprocity"],
      antithesis: ["corruption", "bias", "favoritism", "oppression"],
    },
    leadership: {
      positive: ["guidance", "organization", "protection", "collective_motivation"],
      antithesis: ["tyranny", "chaos", "abdication", "manipulative_domination"],
    },
  },
  temperance: {
    forgiveness: {
      positive: ["forgiveness", "reconciliation", "release", "mercy", "restoration"],
      antithesis: ["vengefulness", "resentment", "obsession", "punitive_fixation"],
    },
    humility_modesty: {
      positive: ["humility", "modesty", "balance", "self_awareness", "groundedness"],
      antithesis: ["arrogance", "grandiosity", "narcissism", "hubris"],
    },
    prudence: {
      positive: ["foresight", "restraint", "carefulness", "deliberation"],
      antithesis: ["recklessness", "impulsiveness", "self_destruction"],
    },
    self_regulation: {
      positive: ["discipline", "control", "stability", "consistency"],
      antithesis: ["addiction", "compulsion", "loss_of_control", "chaotic_behavior"],
    },
  },
  transcendence: {
    appreciation_of_beauty_and_excellence: {
      positive: ["awe", "elevation", "admiration", "reverence"],
      antithesis: ["cynicism", "degradation", "vulgarization", "emptiness"],
    },
    gratitude: {
      positive: ["thankfulness", "recognition", "reciprocity", "humble_appreciation"],
      antithesis: ["entitlement", "bitterness", "ingratitude", "resentful_consumption"],
    },
    hope: {
      positive: ["optimism", "future_orientation", "faith_in_possibility", "renewal"],
      antithesis: ["despair", "fatalism", "hopelessness", "collapse"],
    },
    humor: {
      positive: ["playfulness", "joy", "comic_relief", "bonding", "lightness"],
      antithesis: ["cynical_ridicule", "humiliation", "mockery", "nihilistic_irony"],
    },
    spirituality: {
      positive: ["meaning", "sacredness", "connectedness", "transcendent_orientation"],
      antithesis: ["nihilism", "existential_emptiness", "alienation", "spiritual_collapse"],
    },
  },
};

const DRAMATIC_ARCHETYPE_LENSES: Array<{
  id: DramaticArchetypeLens;
  label: string;
  tradition: string;
  insight: string;
  cues: string[];
  signalKeywords: string[];
}> = [
  {
    id: "shakespearean_performativity",
    label: "Performed agency",
    tradition: "Shakespearean",
    insight: "Agency shifts through public role, private motive, status pressure, and rhetoric.",
    cues: ["role shift", "status pressure", "double speech"],
    signalKeywords: [
      "role",
      "status",
      "power",
      "identity",
      "contradiction",
      "hesitation",
      "irony",
      "dominance",
      "authority",
    ],
  },
  {
    id: "proppian_function",
    label: "Narrative function",
    tradition: "Proppian",
    insight: "Agents are read through plot work: helper, opponent, donor, dispatcher, false hero.",
    cues: ["helper/opponent", "task", "false hero"],
    signalKeywords: [
      "helper",
      "opponent",
      "villain",
      "donor",
      "dispatcher",
      "quest",
      "task",
      "action",
      "obstacle",
      "support",
    ],
  },
  {
    id: "jungian_symbolic",
    label: "Symbolic shadow",
    tradition: "Jungian / Mythic",
    insight: "Agents are read as symbolic functions: shadow, mentor, trickster, anima/animus, self.",
    cues: ["shadow", "mentor", "trickster"],
    signalKeywords: [
      "shadow",
      "mentor",
      "trickster",
      "self",
      "mask",
      "fear",
      "desire",
      "symbol",
      "mirror",
      "projection",
    ],
  },
  {
    id: "campbellian_threshold",
    label: "Threshold journey",
    tradition: "Campbellian",
    insight: "Agents are read through transformation phases, thresholds, tests, ordeal, return.",
    cues: ["threshold", "test", "transformation"],
    signalKeywords: [
      "threshold",
      "journey",
      "transformation",
      "ordeal",
      "return",
      "test",
      "mentor",
      "crossing",
      "revelation",
      "sacrifice",
    ],
  },
  {
    id: "greimasian_actant",
    label: "Actant relation",
    tradition: "Greimasian",
    insight: "Agents are read by structural relation: subject, object, sender, receiver, helper, opponent.",
    cues: ["subject/object", "helper/opponent", "sender/receiver"],
    signalKeywords: [
      "subject",
      "object",
      "sender",
      "receiver",
      "helper",
      "opponent",
      "relation",
      "goal",
      "exchange",
      "pursuit",
    ],
  },
  {
    id: "burkean_motive",
    label: "Motive scene",
    tradition: "Burkean / Dramatistic",
    insight: "Agents are read through act, scene, agent, agency, purpose, guilt, and motive.",
    cues: ["act/scene", "agency", "purpose"],
    signalKeywords: [
      "act",
      "scene",
      "agent",
      "agency",
      "purpose",
      "motive",
      "guilt",
      "conflict",
      "meaning",
      "situation",
    ],
  },
  {
    id: "bojean_antenarrative",
    label: "Antenarrative emergence (5 B's)",
    tradition: "Bojean",
    insight: "Agents and scenes are read through fragmentation, suppressed voices, and speculative bets on the future.",
    cues: ["speculative bet", "suppressed voice", "rhizomatic link"],
    signalKeywords: [
      "bet",
      "speculation",
      "future",
      "suppressed",
      "marginalized",
      "interrupted",
      "network",
      "emergence",
    ],
  },
];

const CHARACTER_FAMILIES = new Set([
  "Identification",
  "Interaction",
  "Role",
  "Relationship",
  "Affect",
  "Intensity",
]);

const PLOT_FAMILIES = new Set(["Scene", "Episode", "Situation", "Action", "ReportClaim"]);

function secondsFromInstruction(instruction: SecondOrderLabelInstruction): number {
  const raw = instruction.time_span?.start_ms ?? instruction.time_span?.start ?? 0;
  const number = Number(raw || 0);
  return instruction.time_span?.start_ms !== undefined || number > 1000 ? number / 1000 : number;
}

function endSecondsFromInstruction(instruction: SecondOrderLabelInstruction): number {
  const raw =
    instruction.time_span?.end_ms ??
    instruction.time_span?.end ??
    instruction.time_span?.start_ms ??
    instruction.time_span?.start ??
    0;
  const number = Number(raw || 0);
  return instruction.time_span?.end_ms !== undefined || number > 1000 ? number / 1000 : number;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function readingStartSeconds(reading: InterpretiveReading): number {
  const span = reading.target?.time_span || reading.time_span || {};
  const raw = span.start_ms ?? span.start ?? 0;
  const number = Number(raw || 0);
  return span.start_ms !== undefined || number > 1000 ? number / 1000 : number;
}

function readingEndSeconds(reading: InterpretiveReading): number {
  const span = reading.target?.time_span || reading.time_span || {};
  const raw = span.end_ms ?? span.end ?? span.start_ms ?? span.start ?? 0;
  const number = Number(raw || 0);
  return span.end_ms !== undefined || number > 1000 ? number / 1000 : number;
}

function readingEvidenceSummary(reading: InterpretiveReading): string {
  const refs = reading.evidence_refs || [];
  if (!refs.length) return "traceback pending";
  const first = refs[0];
  const label = first.evidence_id || first.evidence_kind || first.source_surface || "source";
  return refs.length === 1 ? String(label) : `${label} +${refs.length - 1}`;
}

function readingCanSurface(reading: InterpretiveReading): boolean {
  if (reading.maturity_gate?.can_surface === false) return false;
  const support = typeof reading.support_score === "number" ? reading.support_score : 1;
  if (support >= INTERPRETIVE_READING_UI_CONFIG.minVisibleSupport) return true;
  return Boolean(
    INTERPRETIVE_READING_UI_CONFIG.showLowSupportCandidates &&
      reading.maturity_state === "candidate_low_support",
  );
}

function readingMaturityLabel(reading: InterpretiveReading): string {
  return String(reading.maturity_gate?.state || reading.maturity_state || "candidate")
    .replaceAll("_", " ");
}

function narrativeLensReadingsFromAnalysis(analysisData: AnalysisData | null): InterpretiveReading[] {
  const candidates = [
    (analysisData as any)?.narrativeLensReading,
    (analysisData as any)?.rawJson?.narrative_lens_reading,
    (analysisData as any)?.status?.narrative_lens_reading,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && Array.isArray((candidate as any).readings)) {
      return (candidate as any).readings as InterpretiveReading[];
    }
  }
  return [];
}

function characterPathReadingsFromAnalysis(analysisData: AnalysisData | null): InterpretiveReading[] {
  const candidates = [
    (analysisData as any)?.characterPathReading,
    (analysisData as any)?.rawJson?.character_path_reading,
    (analysisData as any)?.status?.character_path_reading,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && Array.isArray((candidate as any).readings)) {
      return (candidate as any).readings as InterpretiveReading[];
    }
  }
  return [];
}

function datasceneMeaningNetworkFromAnalysis(
  analysisData: AnalysisData | null,
): MeaningNetworkArtifact | null {
  const candidates = [
    (analysisData as any)?.datasceneMeaningNetwork,
    (analysisData as any)?.rawJson?.datascene_meaning_network,
    (analysisData as any)?.status?.datascene_meaning_network,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && (candidate as any).meaning_network) {
      return candidate as MeaningNetworkArtifact;
    }
  }
  return null;
}

function masterRecordToMeaningNode(
  record: MasterSchemaResolvedEvidenceRecord,
): MeaningNetworkNode {
  const hasStart = typeof record.start === "number" && Number.isFinite(record.start);
  const hasEnd = typeof record.end === "number" && Number.isFinite(record.end);
  const start = hasStart ? Number(record.start) : hasEnd ? Number(record.end) : null;
  const end = hasEnd ? Number(record.end) : start;
  const isAgent = ["narrative_agent_profile", "character_role", "identity"].includes(record.category);
  const evidenceRef: MeaningNetworkEvidenceRef = {
    evidence_id: record.id,
    source_type:
      record.category === "transcript"
        ? "transcript"
        : record.category === "object"
          ? "object_detection"
          : record.category === "expression"
            ? "expression_detection"
            : "manual_annotation",
    traceback_record_id: `traceback:${record.id}`,
  };
  if (start !== null && end !== null) {
    evidenceRef.time_range = { start, end };
  }
  return {
    node_id: `master:${record.category}:${record.id}`,
    node_type: isAgent ? "narrative_agent" : record.category,
    label: record.label,
    description: `${record.sourcePanel} / ${record.maturityRoute || record.authority}`,
    attributes: {
      master_schema_record_id: record.id,
      source_panel: record.sourcePanel,
      category: record.category,
      target_id: record.targetId,
      raw_label: record.rawLabel,
      mapping_status: record.mappingStatus,
    },
    maturity: {
      level: record.authority === "manual_correction" || record.authority === "manual_annotation"
        ? "analyst_confirmed"
        : record.authority === "raw_detection"
          ? "raw_detected"
          : "machine_inferred",
      authority: record.authority === "raw_detection" ? "detector" : "analyst",
      confidence: record.authority === "raw_detection" ? 0.45 : 0.85,
    },
    evidence_refs: [evidenceRef],
    ui: {
      display_group: isAgent
        ? "master_schema_narrative_agents"
        : record.category === "object"
          ? "master_schema_objects"
          : "master_schema_evidence",
      quick_confirm_enabled: record.authority !== "raw_detection",
      copy_paste_enabled: true,
      update_enabled: true,
      source_navigation_enabled: Boolean(evidenceRef.time_range),
    },
  };
}

function sceneSegmentToMeaningNode(scene: MeaningSceneSegment, index: number): MeaningNetworkNode {
  const sceneKey = meaningNetworkSceneKey(scene, index);
  return {
    node_id: `scene:${sceneKey}`,
    node_type: "scene",
    label: `Scene ${sceneKey}`,
    attributes: {
      scene_key: sceneKey,
      scene_index: scene.scene_index ?? index + 1,
    },
    maturity: { level: "machine_inferred", authority: "schema_rule", confidence: 0.65 },
    evidence_refs: [
      {
        evidence_id: `scene:${sceneKey}`,
        source_type: "scene",
        time_range: { start: scene.start, end: scene.end },
        traceback_record_id: `traceback:scene:${sceneKey}`,
      },
    ],
    ui: {
      display_group: "scene_timeline",
      quick_confirm_enabled: true,
      copy_paste_enabled: false,
      update_enabled: true,
      source_navigation_enabled: true,
    },
  };
}

function presenceIntervalToMeaningNode(interval: MeaningNetworkPresenceInterval): MeaningNetworkNode {
  const sourceEvidenceRefs = interval.source_evidence_refs?.length
    ? interval.source_evidence_refs
    : [
        {
          evidence_id: interval.id,
          source_type: "manual_presence_interval",
          time_range: { start: interval.start_seconds, end: interval.end_seconds },
          traceback_record_id: `traceback:${interval.id}`,
        },
      ];
  return {
    node_id: interval.node_id,
    node_type: interval.node_type || "off_camera_presence",
    label: interval.label || interval.node_id,
    description: `${interval.lane_id || "presence"} / ${interval.presence_mode || "presence"}`,
    attributes: {
      lane_id: interval.lane_id,
      presence_mode: interval.presence_mode,
      persisted_presence_interval_id: interval.id,
    },
    maturity: {
      level: interval.authority_level === "manual_correction" ? "analyst_confirmed" : "candidate",
      authority: interval.authority_level,
      confidence: interval.authority_level === "manual_correction" ? 0.95 : 0.55,
    },
    evidence_refs: sourceEvidenceRefs,
    ui: {
      display_group: interval.lane_id || "meaning_network_presence",
      quick_confirm_enabled: true,
      copy_paste_enabled: true,
      update_enabled: true,
      source_navigation_enabled: true,
    },
  };
}

function transcriptSegmentToMeaningNode(segment: TranscriptSegment, index: number): MeaningNetworkNode {
  const start = Number(segment.start || 0);
  const end = Math.max(Number(segment.end || start), start + 0.05);
  const label = segment.speaker && segment.speaker !== "Unknown" ? `${segment.speaker}: ${segment.text}` : segment.text;
  return {
    node_id: `transcript:${segment.targetId || index}:${start.toFixed(3)}`,
    node_type: "transcript",
    label: meaningNetworkShortLabel(label || "spoken word", 80),
    description: "Transcript spoken word",
    attributes: {
      lane_id: "spoken_word",
      speaker: segment.speaker,
      segment_type: segment.segmentType,
      correction_source: segment.correctionSource,
    },
    maturity: {
      level: segment.status === "confirmed" || segment.correctionSource === "manual" ? "analyst_confirmed" : "machine_inferred",
      authority: segment.correctionSource === "manual" ? "manual_correction" : "transcript",
      confidence: segment.status === "confirmed" || segment.correctionSource === "manual" ? 0.9 : 0.68,
    },
    evidence_refs: [
      {
        evidence_id: `transcript:${index}`,
        source_type: "transcript",
        time_range: { start, end },
        traceback_record_id: `traceback:transcript:${index}`,
      },
    ],
    ui: {
      display_group: "spoken_word",
      quick_confirm_enabled: true,
      copy_paste_enabled: true,
      update_enabled: true,
      source_navigation_enabled: true,
    },
  };
}

function prosodyCueToMeaningNode(cue: AudioProsodyCue, index: number): MeaningNetworkNode {
  const start = Number(cue.start || 0);
  const end = Math.max(Number(cue.end || start), start + 0.05);
  const label =
    cue.interaction_cues?.role_support ||
    cue.emphasis?.label ||
    cue.pace?.label ||
    cue.sound_environment?.label ||
    "prosody cue";
  return {
    node_id: `prosody:${cue.cue_id || index}:${start.toFixed(3)}`,
    node_type: "prosody",
    label,
    description: cue.text || "Audio prosody cue",
    attributes: {
      lane_id: "prosody",
      presence_mode: "prosody",
      pace: cue.pace?.label,
      emphasis: cue.emphasis?.label,
      rhythm: cue.rhythm_profile?.label,
      tonality: cue.tonality_profile?.label,
      sound_environment: cue.sound_environment?.label,
    },
    maturity: { level: "machine_inferred", authority: "audio_prosody", confidence: 0.68 },
    evidence_refs: [
      {
        evidence_id: cue.cue_id || `prosody:${index}`,
        source_type: "audio_prosody",
        time_range: { start, end },
        traceback_record_id: `traceback:prosody:${cue.cue_id || index}`,
      },
    ],
    ui: {
      display_group: "prosody",
      quick_confirm_enabled: true,
      copy_paste_enabled: true,
      update_enabled: true,
      source_navigation_enabled: true,
    },
  };
}

function narrativeAgentProfileToMeaningNode(profile: NarrativeAgentProfile, index: number): MeaningNetworkNode {
  const label =
    profile.narrative_agent_name ||
    profile.attached_performer_metadata?.actor_name ||
    profile.profile_id ||
    `Narrative Agent ${index + 1}`;
  const profileId = String(profile.profile_id || normalizeAgentKey(label) || index);
  return {
    node_id: `profile:narrative-agent:${profileId}`,
    node_type: "narrative_agent",
    label,
    description: profile.source_metadata?.role_description || "Governed Narrative Agent profile",
    attributes: {
      lane_id: "on_camera_agents",
      presence_mode: "on_camera",
      profile_id: profileId,
      narrative_agent_profile_id: profileId,
      master_schema_surface: "narrative_agent_profile_annotations",
      source_preference: profile.source_metadata?.source_preference,
      role_labels: profile.source_metadata?.role_labels || [],
      actor_name: profile.attached_performer_metadata?.actor_name,
    },
    maturity: {
      level: "analyst_confirmed",
      authority: "narrative_agent_registry",
      confidence: 0.88,
    },
    evidence_refs: [
      {
        evidence_id: `narrative-agent-profile:${profileId}`,
        source_type: "narrative_agent_profile",
        traceback_record_id: `traceback:narrative-agent-profile:${profileId}`,
      },
    ],
    ui: {
      display_group: "master_schema_narrative_agents",
      quick_confirm_enabled: true,
      copy_paste_enabled: true,
      update_enabled: true,
      source_navigation_enabled: false,
    },
  };
}

function meaningNetworkSceneKey(scene: MeaningSceneSegment, index = 0): string {
  return String(scene.scene_index ?? index + 1);
}

function meaningNetworkEvidenceStart(refs?: MeaningNetworkEvidenceRef[]): number {
  return meaningNetworkEvidenceTimeRange(refs)?.start ?? 0;
}

function meaningNetworkTimedEvidenceRef(
  refs?: MeaningNetworkEvidenceRef[],
): { ref: MeaningNetworkEvidenceRef; range: MeaningNetworkTimeRange } | null {
  const ref = refs?.find((item) => item?.time_range?.start !== undefined || item?.time_range?.end !== undefined);
  if (!ref?.time_range) return null;
  const startRaw = Number(ref.time_range.start ?? ref.time_range.end);
  if (!Number.isFinite(startRaw)) return null;
  const endRaw = Number(ref.time_range.end ?? startRaw);
  const end = Number.isFinite(endRaw) ? endRaw : startRaw;
  return {
    ref,
    range: {
      start: Math.min(startRaw, end),
      end: Math.max(startRaw, end),
    },
  };
}

function meaningNetworkEvidenceTimeRange(refs?: MeaningNetworkEvidenceRef[]): MeaningNetworkTimeRange | null {
  return meaningNetworkTimedEvidenceRef(refs)?.range || null;
}

function meaningNetworkSourceTypes(refs?: MeaningNetworkEvidenceRef[]): string[] {
  return Array.from(new Set((refs || []).map((ref) => ref.source_type).filter(Boolean) as string[]));
}

function meaningNetworkTracebackRefs(refs?: MeaningNetworkEvidenceRef[]): string[] {
  return Array.from(new Set((refs || []).map((ref) => ref.traceback_record_id).filter(Boolean) as string[]));
}

function meaningNetworkSourceTimeLabel(refs?: MeaningNetworkEvidenceRef[]): string {
  const range = meaningNetworkEvidenceTimeRange(refs);
  return range ? `@ ${formatTime(range.start)}` : "@ source pending";
}

function meaningNetworkMaturityLabel(item: { maturity?: { level?: string; authority?: string } }): string {
  return String(item.maturity?.level || "candidate").replaceAll("_", " ");
}

function meaningNetworkNodeKindLabel(nodeType: string): string {
  return String(nodeType || "node").replaceAll("_", " ");
}

function meaningNetworkEdgeKindLabel(edgeType: string): string {
  return String(edgeType || "meaning_network_edge").replaceAll("_", " ");
}

function meaningNetworkEdgePlainLanguage(edge: MeaningNetworkEdge, sourceLabel?: string, targetLabel?: string): string {
  const source = sourceLabel || edge.source_node_id || "source node";
  const target = targetLabel || edge.target_node_id || "target node";
  const relation = meaningNetworkEdgeKindLabel(edge.edge_type);
  const evidenceTypes = meaningNetworkSourceTypes(edge.evidence_refs);
  const evidenceSummary = evidenceTypes.length
    ? `Supported by ${evidenceTypes.join(", ")} evidence.`
    : "No source evidence is attached yet.";
  return `${source} ${relation} ${target}. ${evidenceSummary}`;
}

function meaningNetworkEdgeReason(edge: MeaningNetworkEdge): string {
  const kind = meaningNetworkCanonicalNodeType(edge.edge_type);
  if (kind.includes("co_occurs") || kind.includes("appears_with")) {
    return "The linked items share a scene, time span, or source evidence constellation.";
  }
  if (kind.includes("spoken_by")) {
    return "The edge links spoken language to a speaker or Narrative Agent candidate.";
  }
  if (kind.includes("supports")) {
    return "The source node is being used as evidence support for the target claim.";
  }
  if (kind.includes("contradicts")) {
    return "The source and target claims are in tension and require analyst review.";
  }
  if (kind.includes("precedes") || kind.includes("follows")) {
    return "The edge carries a temporal reading of narrative sequence.";
  }
  if (kind.includes("copy_of_anchor")) {
    return "The edge preserves a copied continuity anchor and should remain traceable.";
  }
  return "The edge is a reviewable relation between governed Meaning Network objects.";
}

function meaningNetworkSflDraftKey(kind: "node" | "edge", id: string): string {
  return `${kind}:${id}`;
}

function meaningNetworkSflDefaultDraft(
  kind: "node" | "edge",
  item: MeaningNetworkNode | MeaningNetworkEdge,
): MeaningNetworkSflDraft {
  const canonical =
    kind === "node"
      ? meaningNetworkCanonicalNodeType((item as MeaningNetworkNode).node_type)
      : meaningNetworkCanonicalNodeType((item as MeaningNetworkEdge).edge_type);
  const attributes = kind === "node" ? ((item as MeaningNetworkNode).attributes || {}) : {};
  const hintedLayer = String(attributes.sfl_layer || attributes.sflLayer || "").toLowerCase();
  const sfl_layer: MeaningNetworkSflLayer =
    hintedLayer === "ideational" ||
    hintedLayer === "interpersonal" ||
    hintedLayer === "textual" ||
    hintedLayer === "virtues_and_vices"
      ? hintedLayer
      : canonical.includes("judgement") ||
          canonical.includes("judgment") ||
          canonical.includes("moral") ||
          canonical.includes("virtue") ||
          canonical.includes("vice")
        ? "virtues_and_vices"
        : canonical.includes("spoken") || canonical.includes("speaker") || canonical.includes("agent")
          ? "interpersonal"
          : canonical.includes("precedes") || canonical.includes("follows") || canonical.includes("scene")
            ? "textual"
          : "ideational";
  const defaultJudgementGroup = canonical.includes("reject") ||
    canonical.includes("dismiss") ||
    canonical.includes("contradict") ||
    canonical.includes("oppos") ||
    canonical.includes("delegitimiz")
    ? "alignment_negative"
    : canonical.includes("authority")
      ? "authority_positive"
      : canonical.includes("care") || canonical.includes("relation")
        ? "relational_positive"
        : "alignment_positive";
  const judgement_axis = String(
    attributes.judgement_axis ||
      attributes.judgment_axis ||
      attributes.moral_axis ||
      MEANING_NETWORK_SFL_JUDGEMENT[defaultJudgementGroup][0],
  );
  const virtue_family = String(attributes.virtue_family || "humanity");
  const virtue_axis = String(attributes.virtue_axis || "kindness");
  const moral_polarity: MeaningNetworkMoralPolarity = canonical.includes("vice")
    ? "vice"
    : canonical.includes("virtue")
      ? "virtue"
      : canonical.includes("contradict") || canonical.includes("harm")
        ? "ambivalent"
        : "not_moralized";
  const virtue_vice_value = String(
    attributes.virtue_vice_value ||
      attributes.virtue ||
      attributes.vice ||
      (moral_polarity === "vice"
        ? MEANING_NETWORK_SFL_VIRTUES[virtue_family]?.[virtue_axis]?.antithesis?.[0]
        : MEANING_NETWORK_SFL_VIRTUES[virtue_family]?.[virtue_axis]?.positive?.[0]) ||
      "kindness",
  );
  const sfl_category = String(
    attributes.sfl_category ||
      (sfl_layer === "textual" ? "sequence" : sfl_layer === "ideational" ? "situation" : judgement_axis),
  );
  const confirmation_relation = String(
    attributes.confirmation_relation ||
      (canonical.includes("reject") || canonical.includes("dismiss") || canonical.includes("oppos") ? "rejects" : "confirms"),
  );
  const applied_label = String(
    attributes.sfl_reading_label ||
      attributes.meaning_reading ||
      `${sfl_layer.replaceAll("_", " ")} / ${sfl_layer === "virtues_and_vices" ? virtue_vice_value : sfl_category}`,
  );
  return {
    sfl_layer,
    sfl_category,
    judgement_group: defaultJudgementGroup,
    judgement_axis,
    moral_polarity,
    virtue_family,
    virtue_axis,
    virtue_vice_value,
    confirmation_relation,
    applied_label,
  };
}

function meaningNetworkSflPlainLanguage(draft: MeaningNetworkSflDraft): string {
  const layer = draft.sfl_layer.replaceAll("_", " ");
  if (draft.sfl_layer === "virtues_and_vices") {
    const polarity = draft.moral_polarity === "vice" ? "antithesis" : "positive";
    return `${layer} reading: ${draft.virtue_family.replaceAll("_", " ")} / ${draft.virtue_axis.replaceAll("_", " ")} / ${polarity} / ${draft.virtue_vice_value.replaceAll("_", " ")}.`;
  }
  if (draft.sfl_layer === "interpersonal") {
    return `${layer} judgement: ${draft.confirmation_relation.replaceAll("_", " ")} through ${draft.judgement_group.replaceAll("_", " ")} / ${draft.judgement_axis.replaceAll("_", " ")}.`;
  }
  return `${layer} reading: ${draft.sfl_category.replaceAll("_", " ")}.`;
}

function meaningNetworkCanonicalNodeType(nodeType: string): string {
  return String(nodeType || "node").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function meaningNetworkLaneForNode(
  node: MeaningNetworkNode,
  lanes: MeaningNetworkLane[] = MEANING_NETWORK_DEFAULT_LANES,
): MeaningNetworkLane {
  const canonicalType = meaningNetworkCanonicalNodeType(node.node_type);
  const forcedAgentLane = ["narrative_agent", "character", "identity", "speaker"].includes(canonicalType) ||
    String(node.ui?.display_group || "") === "master_schema_narrative_agents";
  if (forcedAgentLane) {
    return lanes.find((lane) => lane.lane_id === "on_camera_agents") || MEANING_NETWORK_DEFAULT_LANES[1];
  }
  return lanes.find((lane) =>
    lane.nodeTypes?.includes(canonicalType) ||
    (lane.presenceMode && node.attributes?.presence_mode === lane.presenceMode) ||
    node.attributes?.lane_id === lane.lane_id,
  ) || lanes[lanes.length - 1] || MEANING_NETWORK_DEFAULT_LANES[MEANING_NETWORK_DEFAULT_LANES.length - 1];
}

function meaningNetworkLaneIdForNodeType(nodeType: string): string {
  return meaningNetworkLaneForNode({ node_id: "", node_type: nodeType, label: "" }).lane_id;
}

function meaningNetworkPresenceModeForNodeType(nodeType: string): MeaningNetworkPresenceMode {
  const canonicalType = meaningNetworkCanonicalNodeType(nodeType);
  if (canonicalType === "off_camera_presence") return "off_camera";
  if (canonicalType === "music") return "music";
  if (canonicalType === "location") return "location";
  if (canonicalType === "prosody") return "prosody";
  return "on_camera";
}

function meaningNetworkNodeEnd(node: MeaningNetworkNode): number {
  return meaningNetworkEvidenceTimeRange(node.evidence_refs)?.end ?? meaningNetworkEvidenceStart(node.evidence_refs);
}

function meaningNetworkPresenceRange(
  node: MeaningNetworkNode,
  overrides?: Record<string, { start: number; end: number }>,
  fallbackRange?: { start: number; end: number } | null,
): { start: number; end: number; sourceTimed: boolean } {
  const override = overrides?.[node.node_id];
  if (override) {
    return {
      start: Math.min(override.start, override.end),
      end: Math.max(override.start, override.end),
      sourceTimed: true,
    };
  }
  const range = meaningNetworkEvidenceTimeRange(node.evidence_refs);
  const fallback = fallbackRange && meaningNetworkCanonicalNodeType(node.node_type) !== "scene" ? fallbackRange : null;
  const start = range?.start ?? fallback?.start ?? meaningNetworkEvidenceStart(node.evidence_refs);
  const end = Math.max(range?.end ?? fallback?.end ?? start, start + 0.35);
  return { start, end, sourceTimed: Boolean(range) };
}

function isNarrativeAgentMeaningNode(node: MeaningNetworkNode): boolean {
  return ["narrative_agent", "character", "identity", "speaker", "off_camera_presence"].includes(meaningNetworkCanonicalNodeType(node.node_type));
}

function meaningNetworkNodeOverlapsScene(node: MeaningNetworkNode, scene: MeaningSceneSegment): boolean {
  const range = meaningNetworkEvidenceTimeRange(node.evidence_refs);
  if (!range) return false;
  const start = range?.start ?? meaningNetworkEvidenceStart(node.evidence_refs);
  const end = range?.end ?? meaningNetworkNodeEnd(node);
  return Math.max(start, scene.start) <= Math.min(end, scene.end);
}

function meaningNetworkShortLabel(label: string, maxLength = 26): string {
  const value = String(label || "node");
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function meaningNetworkNodePriority(node: MeaningNetworkNode): number {
  const canonicalType = meaningNetworkCanonicalNodeType(node.node_type);
  if (canonicalType === "scene") return 0;
  if (["narrative_agent", "character", "identity", "speaker"].includes(canonicalType)) return 1;
  if (canonicalType === "off_camera_presence") return 2;
  if (canonicalType === "object") return 3;
  if (canonicalType === "transcript") return 4;
  if (canonicalType === "prosody") return 5;
  return 6;
}

function meaningNetworkGraphLayout(
  nodes: MeaningNetworkNode[],
  edges: MeaningNetworkEdge[],
  lanes: MeaningNetworkLane[] = MEANING_NETWORK_DEFAULT_LANES,
  presenceOverrides: Record<string, { start: number; end: number }> = {},
  fallbackUntimedRange: MeaningNetworkTimeRange | null = null,
  timelineDomain: MeaningNetworkTimeRange | null = null,
) {
  const laneNodes = lanes.map((lane) => ({
    lane,
    nodes: nodes.filter((node) => meaningNetworkLaneForNode(node, lanes).lane_id === lane.lane_id),
  }));
  const visibleNodes = laneNodes.flatMap((entry) => {
    const laneLimit =
      entry.lane.lane_id === "scene"
        ? 24
        : entry.lane.lane_id === "on_camera_agents"
          ? 48
          : entry.lane.lane_id === "spoken_word"
            ? 42
            : 28;
    return [...entry.nodes]
      .sort((left, right) => {
        const priority = meaningNetworkNodePriority(left) - meaningNetworkNodePriority(right);
        if (priority !== 0) return priority;
        const leftStart = meaningNetworkPresenceRange(left, presenceOverrides, fallbackUntimedRange).start;
        const rightStart = meaningNetworkPresenceRange(right, presenceOverrides, fallbackUntimedRange).start;
        if (leftStart !== rightStart) return leftStart - rightStart;
        return left.label.localeCompare(right.label);
      })
      .slice(0, laneLimit);
  });
  const width = Math.max(1200, visibleNodes.length * 72);
  const ordered = laneNodes.flatMap((entry) => entry.nodes)
    .filter((node) => visibleNodes.includes(node));
  const positions = new Map<string, { x: number; y: number }>();
  const domainStart = Number.isFinite(Number(timelineDomain?.start)) ? Number(timelineDomain?.start) : 0;
  const domainEnd = Number.isFinite(Number(timelineDomain?.end)) ? Number(timelineDomain?.end) : 1;
  const temporalStart = Math.min(domainStart, ...ordered.map((node) => meaningNetworkPresenceRange(node, presenceOverrides, fallbackUntimedRange).start));
  const temporalEnd = Math.max(domainEnd, ...ordered.map((node) => meaningNetworkPresenceRange(node, presenceOverrides, fallbackUntimedRange).end));
  const temporalSpan = Math.max(1, temporalEnd - temporalStart);
  const xForNode = (node: MeaningNetworkNode, fallbackIndex: number, fallbackCount: number) => {
    const start = meaningNetworkEvidenceStart(node.evidence_refs);
    if (Number.isFinite(start) && start > 0) {
      return 80 + ((start - temporalStart) / temporalSpan) * (width - 160);
    }
    const gap = width / Math.max(fallbackCount + 1, 2);
    return gap * (fallbackIndex + 1);
  };
  const sceneNodes = nodes.filter((node) => meaningNetworkCanonicalNodeType(node.node_type) === "scene");
  const sceneBands = sceneNodes
    .filter((node) => ordered.includes(node))
    .map((node, index) => {
      const start = meaningNetworkEvidenceStart(node.evidence_refs);
      const end = Math.max(meaningNetworkNodeEnd(node), start + 0.2);
      const x1 = 80 + ((start - temporalStart) / temporalSpan) * (width - 160);
      const x2 = 80 + ((end - temporalStart) / temporalSpan) * (width - 160);
      return {
        node,
        x: Math.round(Math.min(x1, x2)),
        y: 18 + (index % 2) * 8,
        width: Math.max(44, Math.round(Math.abs(x2 - x1))),
        height: 76,
      };
    });
  const laneBands = laneNodes.map((entry, index) => ({
    lane: entry.lane,
    y: 38 + index * 84,
    height: index === 0 ? 74 : 66,
  }));
  laneNodes.forEach((row, rowIndex) => {
    const visible = row.nodes.filter((node) => ordered.includes(node));
    const yBase = laneBands[rowIndex]?.y ?? 55 + rowIndex * 84;
    const laneGap = row.lane.lane_id === "scene" ? 0 : 28;
    visible.forEach((node, index) => {
      const lane = laneGap ? index % 2 : 0;
      positions.set(node.node_id, {
        x: Math.round(xForNode(node, index, visible.length)),
        y: yBase + 22 + lane * laneGap,
      });
    });
  });
  const nodeBars: MeaningNetworkPresenceBar[] = ordered
    .filter((node) => meaningNetworkCanonicalNodeType(node.node_type) !== "scene")
    .flatMap((node) => {
      const point = positions.get(node.node_id);
      if (!point) return [];
      const range = meaningNetworkPresenceRange(node, presenceOverrides, fallbackUntimedRange);
      const { start, end } = range;
      const x1 = 80 + ((start - temporalStart) / temporalSpan) * (width - 160);
      const x2 = 80 + ((end - temporalStart) / temporalSpan) * (width - 160);
      const barWidth = Math.max(30, Math.round(Math.abs(x2 - x1)));
      return [{
        node,
        x: Math.round(Math.min(x1, x2)),
        y: point.y - 9,
        width: barWidth,
        height: 18,
        start,
        end,
        sourceTimed: range.sourceTimed,
      }];
    });
  const maxY = Math.max(580, ...[...positions.values()].map((point) => point.y + 82));
  const height = maxY;
  const visibleEdges = edges.filter(
    (edge) => positions.has(edge.source_node_id) && positions.has(edge.target_node_id),
  ).slice(0, 260);
  return { width, height, nodes: ordered, edges: visibleEdges, positions, sceneBands, nodeBars, laneBands, temporalStart, temporalEnd };
}

function backendLensIdForPlotLens(lens: PlotLens): string {
  const mapping: Record<PlotLens, string> = {
    aristotle: "aristotelian",
    freytag: "freytagian",
    campbell: "campbellian",
    frye: "fryean",
    booker: "bookerian",
  };
  return mapping[lens];
}

function supportScore(instruction: SecondOrderLabelInstruction): number {
  return instruction.open_scores?.weighted_support_score ?? 0;
}

function supportBand(score: number): "weak" | "tentative" | "moderate" | "strong" {
  if (score >= 0.75) return "strong";
  if (score >= 0.62) return "moderate";
  if (score >= 0.45) return "tentative";
  return "weak";
}

function supportLabel(instruction: SecondOrderLabelInstruction): string {
  const score = supportScore(instruction);
  const band = supportBand(score);
  return `${band} support`;
}

function instructionLabel(instruction: SecondOrderLabelInstruction): string {
  return `${instruction.target_label_family} / ${instruction.candidate_label}`;
}

function sourceRefSummary(instruction: SecondOrderLabelInstruction): string {
  const refs = instruction.source_evidence_refs || [];
  if (refs.length === 0) {
    return "source traceback";
  }
  const first = refs[0];
  const firstLabel = first.evidence_id || first.evidence_kind || "source";
  return refs.length === 1 ? String(firstLabel) : `${firstLabel} +${refs.length - 1}`;
}

function plotLensTerms(instruction: SecondOrderLabelInstruction, lens: PlotLens): string[] {
  const payload = (instruction.source_feature_payload || {}) as Record<string, any>;
  const lenses = (payload.alternative_plot_lenses || {}) as Record<string, unknown>;
  const terms = lenses[lens];
  if (Array.isArray(terms) && terms.length > 0) {
    return terms.map(String);
  }
  if (lens === "freytag" && (PLOT_FAMILIES.has(instruction.target_label_family) || CHARACTER_FAMILIES.has(instruction.target_label_family))) {
    return [instruction.candidate_label];
  }
  return [];
}

function archetypeSignalText(instruction: SecondOrderLabelInstruction): string {
  const payload = (instruction.source_feature_payload || {}) as Record<string, unknown>;
  return [
    instruction.target_label_family,
    instruction.candidate_label,
    instruction.status,
    ...(instruction.participants_involved || []),
    ...Object.values(payload).flatMap((value) =>
      Array.isArray(value) ? value.map(String) : [String(value ?? "")],
    ),
  ]
    .join(" ")
    .toLowerCase();
}

function archetypeScore(
  instructions: SecondOrderLabelInstruction[],
  lens: DramaticArchetypeLens,
): number {
  const cues = DRAMATIC_ARCHETYPE_LENSES.find((entry) => entry.id === lens)?.signalKeywords || [];
  return instructions.reduce((score, instruction) => {
    const signalText = archetypeSignalText(instruction);
    const cueScore = cues.filter((cue) => signalText.includes(cue)).length;
    return score + cueScore * supportScore(instruction);
  }, 0);
}

function archetypeMatches(
  instructions: SecondOrderLabelInstruction[],
  lens: DramaticArchetypeLens,
): SecondOrderLabelInstruction[] {
  const cues = DRAMATIC_ARCHETYPE_LENSES.find((entry) => entry.id === lens)?.signalKeywords || [];
  return instructions.filter((instruction) => {
    const signalText = archetypeSignalText(instruction);
    return cues.some((cue) => signalText.includes(cue));
  });
}

function matchedArchetypeCues(
  instructions: SecondOrderLabelInstruction[],
  lens: DramaticArchetypeLens,
): string[] {
  const cues = DRAMATIC_ARCHETYPE_LENSES.find((entry) => entry.id === lens)?.signalKeywords || [];
  const signalText = instructions.map(archetypeSignalText).join(" ");
  return cues.filter((cue) => signalText.includes(cue)).slice(0, 4);
}

function groupByParticipant(instructions: SecondOrderLabelInstruction[]) {
  const groups = new Map<string, SecondOrderLabelInstruction[]>();
  for (const instruction of instructions) {
    const participants = instruction.participants_involved?.length
      ? instruction.participants_involved
      : ["unknown participant"];
    for (const participant of participants) {
      const key = String(participant || "unknown participant");
      groups.set(key, [...(groups.get(key) || []), instruction]);
    }
  }
  return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

function normalizeAgentKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()[\]{}:;,.]/g, " ")
    .replace(/\s+/g, " ");
}

function isUnknownAgentLabel(value: unknown): boolean {
  const key = normalizeAgentKey(value);
  return (
    !key ||
    key === "unknown" ||
    key === "unknown speaker" ||
    key === "unknown participant" ||
    /^unknown\b/.test(key) ||
    /^speaker\s*\d+$/.test(key)
  );
}

function narrativeAgentProfileAliases(profile: NarrativeAgentProfile): string[] {
  return [
    profile.narrative_agent_name,
    ...(profile.aliases || []),
    profile.attached_performer_metadata?.actor_name,
    ...(profile.source_metadata?.role_labels || []),
  ]
    .map(normalizeAgentKey)
    .filter(Boolean);
}

function profileMatchesParticipant(profile: NarrativeAgentProfile, participant: string): boolean {
  const participantKey = normalizeAgentKey(participant);
  if (!participantKey) return false;
  return narrativeAgentProfileAliases(profile).some(
    (alias) =>
      alias === participantKey ||
      participantKey.includes(alias) ||
      alias.includes(participantKey),
  );
}

function formatNarrativeAgentProfileBrief(profile: NarrativeAgentProfile): string {
  const name = String(profile.narrative_agent_name || "").trim();
  const performer = String(profile.attached_performer_metadata?.actor_name || "").trim();
  const labels = (profile.source_metadata?.role_labels || []).filter(Boolean).slice(0, 3).join(", ");
  const head = performer ? `${name || "Narrative agent"} (${performer})` : name || "Narrative agent";
  return [head, labels].filter(Boolean).join(" / ");
}

function formatAgentGovernanceLabel(row: CharacterSceneGovernanceRow): string {
  return row.profile ? formatNarrativeAgentProfileBrief(row.profile) : row.label;
}

function narrativeAgentProfileKey(profile: NarrativeAgentProfile, index = 0): string {
  return String(
    profile.profile_id ||
      profile.narrative_agent_name ||
      profile.attached_performer_metadata?.actor_name ||
      `profile-${index}`,
  );
}

function parseRoleLineToProfile(roleLine: string, index: number): NarrativeAgentProfile | null {
  const raw = String(roleLine || "").trim();
  if (!raw) return null;
  const [head, ...descriptionParts] = raw.split(":");
  const description = descriptionParts.join(":").trim();
  const performerMatch = head.match(/^(.*?)\s*\((.*?)\)\s*$/);
  const name = (performerMatch?.[1] || head).trim();
  const performer = (performerMatch?.[2] || "").trim();
  if (isUnknownAgentLabel(name)) return null;
  return {
    profile_id: `metadata-role:${normalizeAgentKey(name) || index}`,
    profile_type: "narrative_agent_profile",
    narrative_agent_name: name,
    aliases: [],
    attached_performer_metadata: performer
      ? { actor_name: performer, boundary: "attached metadata, not a natural-person profile" }
      : undefined,
    source_metadata: {
      role_labels: [],
      role_description: description,
      source_preference: "source_media_metadata.user_annotations.character_roles",
    },
    evidence_slots: {
      scene_links: [],
      meaning_plot_refs: [],
    },
  } as NarrativeAgentProfile;
}

function sourceMetadataNarrativeAgentProfiles(
  metadata: SourceMediaMetadata | undefined,
): NarrativeAgentProfile[] {
  const annotations = metadata?.user_annotations;
  if (!annotations) return [];
  const profiles = (annotations.narrative_agent_profiles || []).filter(
    (profile) =>
      !(
        isUnknownAgentLabel(profile.narrative_agent_name) &&
        isUnknownAgentLabel(profile.attached_performer_metadata?.actor_name)
      ),
  );

  for (const [index, definition] of (annotations.character_definitions || []).entries()) {
    const name = String(definition.character_name || "").trim();
    if (isUnknownAgentLabel(name)) continue;
    profiles.push({
      profile_id: `metadata-definition:${normalizeAgentKey(name) || index}`,
      profile_type: "narrative_agent_profile",
      narrative_agent_name: name,
      aliases: definition.aliases || [],
      attached_performer_metadata: definition.actor_name
        ? {
            actor_name: definition.actor_name,
            boundary: "attached metadata, not a natural-person profile",
          }
        : undefined,
      source_metadata: {
        role_labels: definition.role_labels || [],
        role_description: definition.role_description,
        relations: definition.relations || [],
        source_url: definition.source_url,
        source_preference:
          definition.source_preference || "source_media_metadata.user_annotations.character_definitions",
      },
      evidence_slots: {
        scene_links: [],
        meaning_plot_refs: [],
      },
    } as NarrativeAgentProfile);
  }

  for (const [index, roleLine] of (annotations.character_roles || []).entries()) {
    const profile = parseRoleLineToProfile(roleLine, index);
    if (profile) profiles.push(profile);
  }

  const seen = new Set<string>();
  return profiles.filter((profile, index) => {
    const key = normalizeAgentKey(
      profile.narrative_agent_name ||
        profile.attached_performer_metadata?.actor_name ||
        profile.profile_id ||
        index,
    );
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function masterSchemaRecordNarrativeAgentProfile(
  record: MasterSchemaResolvedEvidenceRecord,
  index: number,
): NarrativeAgentProfile | null {
  const metadata = (record.metadata || {}) as Record<string, any>;
  if (record.category === "narrative_agent_profile") {
    const name = String(metadata.narrative_agent_name || metadata.character_name || record.label || "").trim();
    if (isUnknownAgentLabel(name)) return null;
    return {
      profile_id: String(metadata.profile_id || record.targetId || record.id || `master-schema-agent-${index}`),
      profile_type: "narrative_agent_profile",
      narrative_agent_name: name,
      aliases: Array.isArray(metadata.aliases) ? metadata.aliases : [],
      attached_performer_metadata: metadata.attached_performer_metadata || metadata.actor_name
        ? {
            ...(typeof metadata.attached_performer_metadata === "object"
              ? metadata.attached_performer_metadata
              : {}),
            actor_name:
              metadata.attached_performer_metadata?.actor_name ||
              metadata.actor_name ||
              undefined,
            boundary:
              metadata.attached_performer_metadata?.boundary ||
              "attached metadata, not a natural-person profile",
          }
        : undefined,
      source_metadata: metadata.source_metadata || {
        role_labels: Array.isArray(metadata.role_labels) ? metadata.role_labels : [],
        role_description: metadata.role_description,
        relations: Array.isArray(metadata.relations) ? metadata.relations : [],
        source_preference: "master_schema",
      },
      evidence_slots: metadata.evidence_slots || {
        scene_links: [],
        meaning_plot_refs: [],
      },
      dramaturgical_tendencies: Array.isArray(metadata.dramaturgical_tendencies)
        ? metadata.dramaturgical_tendencies
        : [],
      interpretive_readings: Array.isArray(metadata.interpretive_readings)
        ? metadata.interpretive_readings
        : [],
      profile_extensions: Array.isArray(metadata.profile_extensions)
        ? metadata.profile_extensions
        : [],
    } as NarrativeAgentProfile;
  }
  if (record.category === "character_role") {
    return parseRoleLineToProfile(record.label, index);
  }
  return null;
}

function masterSchemaNarrativeAgentProfiles(
  records: MasterSchemaResolvedEvidenceRecord[] | undefined,
): NarrativeAgentProfile[] {
  const profiles = (records || [])
    .map(masterSchemaRecordNarrativeAgentProfile)
    .filter((profile): profile is NarrativeAgentProfile => Boolean(profile));
  const seen = new Set<string>();
  return profiles.filter((profile, index) => {
    const key = normalizeAgentKey(
      profile.narrative_agent_name ||
        profile.attached_performer_metadata?.actor_name ||
        profile.profile_id ||
        index,
    );
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeNarrativeAgentProfilesByMaturity(
  masterProfiles: NarrativeAgentProfile[],
  sourceProfiles: NarrativeAgentProfile[],
  sceneCardProfiles: NarrativeAgentProfile[],
): NarrativeAgentProfile[] {
  const merged: NarrativeAgentProfile[] = [];
  const seen = new Set<string>();
  for (const profile of [...masterProfiles, ...sourceProfiles, ...sceneCardProfiles]) {
    const key = normalizeAgentKey(
      profile.narrative_agent_name ||
        profile.attached_performer_metadata?.actor_name ||
        profile.profile_id,
    );
    if (!key || isUnknownAgentLabel(key) || seen.has(key)) continue;
    seen.add(key);
    merged.push(profile);
  }
  return merged;
}

function sceneCardsFromAnalysisData(analysisData: AnalysisData | null): MeaningSceneCard[] {
  const candidates = [
    (analysisData as any)?.rawJson?.mise_en_scene_scene_cards,
    (analysisData as any)?.status?.mise_en_scene_scene_cards,
    (analysisData as any)?.mise_en_scene_scene_cards,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const cards =
      (candidate as any).scene_cards ||
      (candidate as any).cards ||
      (candidate as any).scenes ||
      (candidate as any).items;
    if (Array.isArray(cards)) {
      return cards as MeaningSceneCard[];
    }
  }
  return [];
}

function sceneCardNarrativeAgentProfiles(cards: MeaningSceneCard[]): NarrativeAgentProfile[] {
  const stop = new Set([
    "Scene",
    "Card",
    "This",
    "The",
    "Mise",
    "Evidence",
    "Speaker",
    "Master",
    "Schema",
    "Meaning",
    "Plot",
    "Action",
    "Situation",
    "Role",
    "Interaction",
    "Universal",
  ]);
  const found = new Map<string, NarrativeAgentProfile>();
  const addName = (value: unknown, source: string) => {
    const raw = String(value || "").trim();
    if (!raw || /^unknown/i.test(raw) || /^speaker\s*\d+$/i.test(raw)) return;
    const names = raw.match(/\b(?:007|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) || [];
    for (const name of names) {
      if (stop.has(name) || name.length < 3) continue;
      const key = normalizeAgentKey(name);
      if (!key || found.has(key)) continue;
      found.set(key, {
        profile_id: `scene-card-agent:${key}`,
        profile_type: "narrative_agent_profile",
        narrative_agent_name: name,
        aliases: [],
        source_metadata: {
          role_labels: [],
          role_description: `Surfaced from ${source}. Needs analyst confirmation if metadata/Master Schema later disagrees.`,
          source_preference: "scene_cards_fallback",
        },
        evidence_slots: {
          scene_links: [],
          meaning_plot_refs: [],
        },
      } as NarrativeAgentProfile);
    }
  };
  for (const card of cards) {
    addName(card.overview, "Scene Cards overview");
    addName(card.nlp_scene_summary_sentence, "Scene Cards summary");
    for (const text of [
      ...Object.values(card.prose_sections || {}),
      ...Object.values(card.interrogative_schema || {}),
      ...Object.values(card.mise_en_scene_description || {}),
      ...Object.values(card.nlp_scene_summary?.description || {}),
      ...Object.values(card.nlp_scene_summary?.interrogative_schema || {}),
      ...Object.values(card.nlp_scene_summary?.prose_sections || {}),
    ]) {
      addName(text, "Scene Cards prose");
    }
    for (const speech of card.said_in_scene || []) {
      addName(speech.speaker, "Scene Cards speech");
      addName(speech.text, "Scene Cards speech");
    }
    for (const item of [...(card.items || []), ...(card.resolved_items || [])]) {
      if (["identification", "person", "character", "role"].includes(String(item.category || "").toLowerCase())) {
        addName(item.label || item.symbol, "Scene Cards evidence item");
      }
    }
  }
  return [...found.values()];
}

function sceneConstellationGovernanceFromMaster(
  records: MasterSchemaResolvedEvidenceRecord[] | undefined,
  analysisData: AnalysisData | null,
): { layers: SceneConstellationLayer[]; attendeeRule?: string } {
  const raw = (analysisData as any)?.rawJson?.vaa1_annotation_master_schema ||
    (analysisData as any)?.status?.vaa1_annotation_master_schema;
  const governance = raw?.scene_constellation_governance;
  if (governance && typeof governance === "object") {
    return {
      layers: Array.isArray(governance.layers) ? governance.layers : [],
      attendeeRule: governance.attendee_boundary_rule?.principle,
    };
  }
  return {
    layers: [
      {
        layer_id: "master_schema_narrative_agents",
        label: "Master Schema Narrative Agent Profiles",
        count: (records || []).filter((record) => record.category === "narrative_agent_profile").length,
        authority: "Master Schema",
        source: "masterSchemaResolvedEvidence.records",
        status: records?.length ? "available" : "pending",
      },
    ],
  };
}

function narrativeAgentProfileEvidenceChips(profile: NarrativeAgentProfile): string[] {
  const slots = profile.evidence_slots || {};
  return [
    [slots.lines, "lines"],
    [slots.audio_samples, "audio"],
    [slots.visual_patterns, "visual"],
    [slots.identification_refs, "ID"],
    [slots.scene_links, "scene"],
    [slots.meaning_plot_refs, "meaning/plot"],
  ]
    .filter(([items]) => Array.isArray(items) && items.length > 0)
    .map(([items, label]) => `${label} ${Array.isArray(items) ? items.length : ""}`.trim());
}

function instructionOverlapsScene(
  instruction: SecondOrderLabelInstruction,
  scene: MeaningSceneSegment,
): boolean {
  const start = secondsFromInstruction(instruction);
  const end = endSecondsFromInstruction(instruction);
  return start <= scene.end && end >= scene.start;
}

function fallbackSceneSegmentsFromInstructions(
  instructions: SecondOrderLabelInstruction[],
): MeaningSceneSegment[] {
  const ranges = instructions
    .map((instruction) => {
      const start = secondsFromInstruction(instruction);
      const end = Math.max(endSecondsFromInstruction(instruction), start + 0.5);
      return { start, end };
    })
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end))
    .sort((left, right) => left.start - right.start);

  if (ranges.length === 0) {
    return [];
  }

  const windowSeconds = 24;
  const firstStart = Math.max(0, Math.floor(ranges[0].start / windowSeconds) * windowSeconds);
  const lastEnd = Math.max(...ranges.map((range) => range.end), firstStart + windowSeconds);
  const segments: MeaningSceneSegment[] = [];

  for (let start = firstStart; start <= lastEnd; start += windowSeconds) {
    const end = Math.min(start + windowSeconds, Math.max(lastEnd, start + 1));
    segments.push({
      scene_index: segments.length + 1,
      start,
      end,
      duration: end - start,
    });
  }

  return segments;
}

function lineMatchesProfile(
  line: TranscriptSegment,
  profile: NarrativeAgentProfile,
  sourceMetadata: SourceMediaMetadata | undefined,
): boolean {
  const aliases = narrativeAgentProfileAliases(profile);
  const speakerKey = normalizeAgentKey(line.speaker);
  const referenceSpeakers =
    sourceMetadata?.user_annotations?.reference_speakers?.filter((speaker: any) =>
      aliases.some((alias) =>
        normalizeAgentKey(speaker?.identity_label || speaker?.name).includes(alias),
      ),
    ) || [];
  const speakerAliases = [
    ...aliases,
    ...referenceSpeakers.map((speaker: any) => normalizeAgentKey(speaker?.speaker_label)),
  ].filter(Boolean);
  if (speakerAliases.some((alias) => alias === speakerKey || speakerKey.includes(alias))) {
    return true;
  }
  const textKey = normalizeAgentKey(line.text);
  return aliases.some((alias) => textKey.includes(alias));
}

function manualAnnotationStart(annotation: Record<string, any>): number {
  return Number(annotation.start_seconds ?? annotation.timestamp_seconds ?? 0);
}

function manualAnnotationEnd(annotation: Record<string, any>): number {
  const start = manualAnnotationStart(annotation);
  const end = Number(annotation.end_seconds ?? annotation.timestamp_seconds ?? start);
  return Number.isFinite(end) ? Math.max(start, end) : start;
}

function manualAnnotationMatchesProfile(
  annotation: Record<string, any>,
  profile: NarrativeAgentProfile,
): boolean {
  const aliases = narrativeAgentProfileAliases(profile);
  if (aliases.length === 0) return false;
  const annotationKeys = [
    annotation.identity_affirmation,
    annotation.role_affirmation,
    annotation.custom_label,
    annotation.label,
  ]
    .map(normalizeAgentKey)
    .filter((key) => key && !isUnknownAgentLabel(key));
  return annotationKeys.some((annotationKey) =>
    aliases.some(
      (alias) =>
        annotationKey === alias ||
        annotationKey.includes(alias) ||
        alias.includes(annotationKey),
    ),
  );
}

function manualAnnotationsForProfileInScene(
  annotations: unknown[] | undefined,
  profile: NarrativeAgentProfile,
  scene: MeaningSceneSegment,
): Array<Record<string, any>> {
  return (annotations || [])
    .filter((annotation): annotation is Record<string, any> =>
      Boolean(annotation && typeof annotation === "object"),
    )
    .filter((annotation) =>
      Boolean(annotation.identity_affirmation || annotation.role_affirmation),
    )
    .filter((annotation) =>
      manualAnnotationStart(annotation) <= scene.end &&
      manualAnnotationEnd(annotation) >= scene.start,
    )
    .filter((annotation) => manualAnnotationMatchesProfile(annotation, profile));
}

function intervalOverlaps(start: unknown, end: unknown, scene: MeaningSceneSegment): boolean {
  const startNumber = Number(start ?? 0);
  const endNumber = Number(end ?? startNumber);
  if (!Number.isFinite(startNumber)) return false;
  const safeEnd = Number.isFinite(endNumber) ? Math.max(startNumber, endNumber) : startNumber;
  return startNumber <= scene.end && safeEnd >= scene.start;
}

function audioProsodyForProfileInScene(
  cues: unknown[] | undefined,
  profile: NarrativeAgentProfile,
  scene: MeaningSceneSegment,
  transcript: TranscriptSegment[],
  sourceMetadata: SourceMediaMetadata | undefined,
): Array<Record<string, any>> {
  const aliases = narrativeAgentProfileAliases(profile);
  if (aliases.length === 0) return [];
  const matchedLines = transcript
    .filter((line) => line.start <= scene.end && line.end >= scene.start)
    .filter((line) => lineMatchesProfile(line, profile, sourceMetadata));
  return (cues || [])
    .filter((cue): cue is Record<string, any> => Boolean(cue && typeof cue === "object"))
    .filter((cue) => intervalOverlaps(cue.start, cue.end, scene))
    .filter((cue) => {
      const cueText = normalizeAgentKey(cue.text);
      const textMatch = aliases.some((alias) => cueText.includes(alias));
      const lineMatch = matchedLines.some((line) =>
        intervalOverlaps(cue.start, cue.end, {
          scene_index: scene.scene_index,
          start: line.start,
          end: line.end,
        }),
      );
      return textMatch || lineMatch;
    });
}

function sourceSamplesForProfileInScene(
  samples: unknown[] | undefined,
  profile: NarrativeAgentProfile,
  scene: MeaningSceneSegment,
  manualAnnotations: Array<Record<string, any>>,
): Array<Record<string, any>> {
  const aliases = narrativeAgentProfileAliases(profile);
  if (aliases.length === 0) return [];
  return (samples || [])
    .filter((sample): sample is Record<string, any> => Boolean(sample && typeof sample === "object"))
    .filter((sample) => intervalOverlaps(sample.time_start, sample.time_end, scene))
    .filter((sample) => {
      const text = normalizeAgentKey([sample.label, sample.purpose, sample.sample_type].filter(Boolean).join(" "));
      const labelMatch = aliases.some((alias) => text.includes(alias));
      const manualOverlap = manualAnnotations.some((annotation) =>
        intervalOverlaps(sample.time_start, sample.time_end, {
          scene_index: scene.scene_index,
          start: manualAnnotationStart(annotation),
          end: manualAnnotationEnd(annotation),
        }),
      );
      return labelMatch || manualOverlap;
    });
}

function expressionLabel(sample: ExpressionSample): string {
  return String(
    sample.interpreted_expression?.label ||
      sample.dominant_emotion ||
      sample.rawDominantEmotion ||
      "expression",
  );
}

function expressionSamplesForSceneAgent(
  expressions: ExpressionSample[],
  scene: MeaningSceneSegment,
  agentInstructions: SecondOrderLabelInstruction[],
): ExpressionSample[] {
  const sceneExpressions = expressions.filter(
    (sample) => sample.timestamp >= scene.start && sample.timestamp <= scene.end,
  );
  if (agentInstructions.length === 0) {
    return sceneExpressions.slice(0, 2);
  }
  return sceneExpressions
    .filter((sample) =>
      agentInstructions.some((instruction) => {
        const start = secondsFromInstruction(instruction);
        const end = endSecondsFromInstruction(instruction);
        return sample.timestamp >= start - 1.5 && sample.timestamp <= end + 1.5;
      }),
    )
    .slice(0, 3);
}

function agentPersistenceInstructionsForParticipant(
  instructions: SecondOrderLabelInstruction[],
  participant: string,
): SecondOrderLabelInstruction[] {
  const participantKey = normalizeAgentKey(participant);
  return instructions.filter((instruction) => {
    if (instruction.source_feature_type !== "agent_persistence_scene_cut") {
      return false;
    }
    const payload = (instruction.source_feature_payload || {}) as Record<string, unknown>;
    const values = [
      payload.agent_label,
      payload.old_track_id,
      payload.new_track_id,
      ...(instruction.participants_involved || []),
    ].map(normalizeAgentKey);
    return values.some(
      (value) =>
        value &&
        (value === participantKey || value.includes(participantKey) || participantKey.includes(value)),
    );
  });
}

function participantTopArchetypes(
  instructions: SecondOrderLabelInstruction[],
): Array<{ lens: (typeof DRAMATIC_ARCHETYPE_LENSES)[number]; score: number }> {
  return DRAMATIC_ARCHETYPE_LENSES.map((lens) => ({
    lens,
    score: archetypeScore(instructions, lens.id),
  }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function sortParticipantGroupsByArchetype(
  groups: Array<[string, SecondOrderLabelInstruction[]]>,
  lens: DramaticArchetypeLens,
): Array<[string, SecondOrderLabelInstruction[]]> {
  return [...groups].sort((left, right) => {
    const scoreDelta = archetypeScore(right[1], lens) - archetypeScore(left[1], lens);
    if (scoreDelta !== 0) return scoreDelta;
    return left[0].localeCompare(right[0]);
  });
}

function buildParticipantGroupsWithMetadataProfiles(
  instructions: SecondOrderLabelInstruction[],
  profiles: NarrativeAgentProfile[],
): Array<[string, SecondOrderLabelInstruction[]]> {
  const groups = new Map<string, SecondOrderLabelInstruction[]>();
  groupByParticipant(instructions).forEach(([participant, items]) => {
    if (isUnknownAgentLabel(participant)) return;
    groups.set(participant, items);
  });
  profiles.forEach((profile, index) => {
    const label = String(
      profile.narrative_agent_name ||
        profile.attached_performer_metadata?.actor_name ||
        `Narrative agent ${index + 1}`,
    ).trim();
    if (isUnknownAgentLabel(label)) return;
    if (!groups.has(label)) {
      groups.set(label, []);
    }
  });
  return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

function formatAuditLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function MeaningPlotConfirmationStrip({ analysisData }: { analysisData: AnalysisData | null }) {
  const audit = analysisData?.metadata?.masterSchemaMaturityAudit;
  const program = audit?.confirmation_program;
  const anchor = audit?.user_confirmed_anchor;
  const families = (program?.confirmation_families || []).filter((family) =>
    [
      "narrative_structure_meaning_plot_confirmation",
      "mise_en_scene_level_understanding",
      "character_audio_trail_recognition",
      "character_visual_pattern_recognition",
    ].includes(family),
  );
  if (!program && !anchor) return null;
  return (
    <section className="mb-3 rounded border border-cyan-500/20 bg-cyan-950/10 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Anchor-Aware Meaning Confirmation
          </div>
          <div className="mt-0.5 max-w-3xl text-[10px] text-slate-500">
            Meaning and plot candidates should consult user-confirmed corrections before wider
            proliferation.
          </div>
        </div>
        <span className="shrink-0 rounded border border-cyan-700/60 bg-[#101010] px-2 py-1 text-[10px] text-cyan-100">
          {program?.consults_user_confirmed_anchor ? "Anchor consulted" : "Anchor pending"}
        </span>
      </div>
      {families.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {families.map((family) => (
            <span
              key={family}
              className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-200"
            >
              {formatAuditLabel(family)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

interface InstructionItemProps {
  instruction: SecondOrderLabelInstruction;
  activeLens: PlotLens;
  showLens?: boolean;
  onNavigate: (instruction: SecondOrderLabelInstruction) => void;
}

const InstructionItem = React.memo(function InstructionItem({
  instruction,
  activeLens,
  showLens,
  onNavigate,
}: InstructionItemProps) {
  const start = secondsFromInstruction(instruction);
  const end = endSecondsFromInstruction(instruction);
  const lensTerms = showLens ? plotLensTerms(instruction, activeLens) : [];

  const displayLabel = showLens && lensTerms.length > 0
    ? `${instruction.target_label_family} / ${lensTerms[0].replaceAll("_", " ")}`
    : instructionLabel(instruction);

  return (
    <button
      type="button"
      onClick={() => onNavigate(instruction)}
      className="w-full rounded border border-slate-800 bg-[#101010] px-2.5 py-2 text-left hover:border-cyan-700/60 hover:bg-cyan-950/10"
      title={`Jump to source ${formatTime(start)}. Traceback: ${sourceRefSummary(instruction)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] text-slate-100">{displayLabel}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {formatTime(start)}-{formatTime(end)} • {instruction.status} • {sourceRefSummary(instruction)}
          </div>
        </div>
        <div className="shrink-0 text-[10px] text-cyan-200">
          {supportLabel(instruction)}
        </div>
      </div>
      {lensTerms.length ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {lensTerms.slice(0, 4).map((term) => (
            <span
              key={`${instruction.instruction_id}:${activeLens}:${term}`}
              className="rounded border border-cyan-800/50 bg-cyan-950/25 px-1.5 py-0.5 text-[10px] text-cyan-100"
            >
              {term.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
});

interface InterpretiveReadingItemProps {
  reading: InterpretiveReading;
  onNavigate: (reading: InterpretiveReading) => void;
}

const InterpretiveReadingItem = React.memo(function InterpretiveReadingItem({
  reading,
  onNavigate,
}: InterpretiveReadingItemProps) {
  const start = readingStartSeconds(reading);
  const end = readingEndSeconds(reading);
  const label =
    reading.lens_label ||
    reading.reading_type?.replaceAll("_", " ") ||
    reading.target?.target_label_family ||
    "Interpretive reading";
  return (
    <button
      type="button"
      onClick={() => onNavigate(reading)}
      className="w-full rounded border border-cyan-900/50 bg-cyan-950/10 px-2.5 py-2 text-left hover:border-cyan-600/70 hover:bg-cyan-950/25"
      title={`Jump to source ${formatTime(start)}. Traceback: ${readingEvidenceSummary(reading)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium text-cyan-100">{label}</div>
          <div className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-slate-300">
            {reading.claim_prose || reading.claim_label || "Reading prose pending."}
          </div>
          <div className="mt-1 text-[9px] text-slate-500">
            {formatTime(start)}-{formatTime(end)} • {readingMaturityLabel(reading)} • {readingEvidenceSummary(reading)}
          </div>
          {reading.maturity_gate?.reason && (
            <div className="mt-1 line-clamp-1 text-[9px] text-slate-500">
              {reading.maturity_gate.reason}
            </div>
          )}
        </div>
        <div className="shrink-0 rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300">
          {typeof reading.support_score === "number"
            ? reading.support_score.toFixed(2)
            : reading.authority_level || "reading"}
        </div>
      </div>
    </button>
  );
});

export default function MeaningPlotPanel({
  videoId: initialVideoId = "",
  initialMeaningNetworkExpanded = false,
  initialMeaningNetworkViewMode = "graph",
  dedicatedMeaningNetworkPanel = false,
}: {
  videoId?: string;
  initialMeaningNetworkExpanded?: boolean;
  initialMeaningNetworkViewMode?: MeaningNetworkViewMode;
  dedicatedMeaningNetworkPanel?: boolean;
}) {
  const [selectedVideoId, setSelectedVideoId] = useState(initialVideoId);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLens, setActiveLens] = useState<PlotLens>("freytag");
  const [activeArchetypeLens, setActiveArchetypeLens] =
    useState<DramaticArchetypeLens>("shakespearean_performativity");
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [stagedSceneAgents, setStagedSceneAgents] = useState<Record<string, string[]>>({});
  const [openCharacterSceneProfiles, setOpenCharacterSceneProfiles] = useState<Record<string, boolean>>({});
  const [governedSourceMetadata, setGovernedSourceMetadata] = useState<SourceMediaMetadata | null>(null);
  const [copiedMeaningNetworkNode, setCopiedMeaningNetworkNode] = useState<MeaningNetworkNode | null>(null);
  const [copiedMeaningNetworkEdge, setCopiedMeaningNetworkEdge] = useState<MeaningNetworkEdge | null>(null);
  const [copiedMeaningNetworkContent, setCopiedMeaningNetworkContent] = useState<MeaningNetworkCopiedContent | null>(null);
  const [meaningNetworkContextMenu, setMeaningNetworkContextMenu] = useState<MeaningNetworkContextMenuState | null>(null);
  const [meaningNetworkSheet, setMeaningNetworkSheet] = useState<MeaningNetworkSheetState | null>(null);
  const [meaningNetworkSaveFeedback, setMeaningNetworkSaveFeedback] = useState<{
    status: "saved" | "staged" | "error";
    message: string;
    detail: string;
    updatedAt: string;
  } | null>(null);
  const [confirmedMeaningNetworkMarkers, setConfirmedMeaningNetworkMarkers] = useState<Record<string, boolean>>({});
  const [confirmedMeaningNetworkEdges, setConfirmedMeaningNetworkEdges] = useState<Record<string, "confirmed" | "rejected">>({});
  const [meaningNetworkSflDrafts, setMeaningNetworkSflDrafts] = useState<Record<string, MeaningNetworkSflDraft>>({});
  const [renamedMeaningNetworkMarkers, setRenamedMeaningNetworkMarkers] = useState<Record<string, string>>({});
  const [draftMeaningNetworkNodes, setDraftMeaningNetworkNodes] = useState<MeaningNetworkNode[]>([]);
  const [draftMeaningNetworkEdges, setDraftMeaningNetworkEdges] = useState<MeaningNetworkEdge[]>([]);
  const [draftMeaningNetworkScenes, setDraftMeaningNetworkScenes] = useState<MeaningSceneSegment[]>([]);
  const [hiddenMeaningNetworkScenes, setHiddenMeaningNetworkScenes] = useState<Record<string, boolean>>({});
  const [draftMeaningNetworkLanes, setDraftMeaningNetworkLanes] = useState<MeaningNetworkLane[]>([]);
  const [meaningNetworkPresenceOverrides, setMeaningNetworkPresenceOverrides] = useState<Record<string, { start: number; end: number }>>({});
  const [meaningNetworkPresenceDrag, setMeaningNetworkPresenceDrag] = useState<MeaningNetworkPresenceDrag | null>(null);
  const [selectedMeaningNetworkNodeId, setSelectedMeaningNetworkNodeId] = useState<string | null>(null);
  const [meaningNetworkViewMode, setMeaningNetworkViewMode] = useState<MeaningNetworkViewMode>(initialMeaningNetworkViewMode);
  const [meaningNetworkExpanded, setMeaningNetworkExpanded] = useState(initialMeaningNetworkExpanded);
  const [meaningNetworkZoom, setMeaningNetworkZoom] = useState(1);
  const [meaningNetworkCursorSeconds, setMeaningNetworkCursorSeconds] = useState(0);
  const [focusedMeaningNetworkSceneKey, setFocusedMeaningNetworkSceneKey] = useState<string | null>(null);
  const meaningNetworkGraphSvgRef = useRef<SVGSVGElement | null>(null);
  const meaningNetworkLiveScrubRef = useRef(0);
  const plotPathRef = useRef<HTMLDivElement | null>(null);
  const sceneAgentBrowserRef = useRef<HTMLDivElement | null>(null);
  const characterSceneListRef = useRef<HTMLDivElement | null>(null);
  const dramaticArchetypeReadingsRef = useRef<HTMLDivElement | null>(null);
  const participantRankingRef = useRef<HTMLDivElement | null>(null);

  const scrollCharacterPathSection = useCallback(
    (target: React.RefObject<HTMLDivElement | null>) => {
      target.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [],
  );

  useEffect(() => {
    const handler = (id: string) => setSelectedVideoId(id);
    eventBus.on("videoIdChanged", handler);
    return () => eventBus.off("videoIdChanged", handler);
  }, []);

  useEffect(() => {
    if (!meaningNetworkContextMenu) {
      return undefined;
    }
    const close = () => setMeaningNetworkContextMenu(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", handleKey);
    };
  }, [meaningNetworkContextMenu]);

  useEffect(() => {
    const handler = (time: number) => {
      const seconds = Number(time || 0);
      if (Number.isFinite(seconds)) {
        setMeaningNetworkCursorSeconds(Math.max(0, seconds));
      }
    };
    eventBus.on("videoTimeLineChanged", handler);
    return () => eventBus.off("videoTimeLineChanged", handler);
  }, []);

  useEffect(() => {
    const handler = (lens: DramaticArchetypeLens) => {
      if (DRAMATIC_ARCHETYPE_LENSES.some((item) => item.id === lens)) {
        setActiveArchetypeLens(lens);
        scrollCharacterPathSection(dramaticArchetypeReadingsRef);
      }
    };
    eventBus.on("meaningPlotArchetypeLensRequested", handler);
    return () => eventBus.off("meaningPlotArchetypeLensRequested", handler);
  }, [scrollCharacterPathSection]);

  useEffect(() => {
    if (!selectedVideoId) {
      setAnalysisData(null);
      setGovernedSourceMetadata(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      VideoService.refreshAnalysis(selectedVideoId),
      apiService.getSourceMediaMetadata(selectedVideoId).catch(() => null),
    ])
      .then(([data, sourceMetadata]) => {
        if (!cancelled) {
          setAnalysisData(data);
          setGovernedSourceMetadata(sourceMetadata);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysisData(null);
          setGovernedSourceMetadata(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVideoId]);

  useEffect(() => {
    const metadataHandler = (id: string) => {
      if (!selectedVideoId || id !== selectedVideoId) {
        return;
      }
      apiService
        .getSourceMediaMetadata(selectedVideoId)
        .then((metadata) => {
          setGovernedSourceMetadata(metadata);
          return VideoService.refreshAnalysis(selectedVideoId);
        })
        .then((data) => setAnalysisData(data))
        .catch(() => {});
    };
    eventBus.on("sourceMediaMetadataChanged", metadataHandler);
    return () => eventBus.off("sourceMediaMetadataChanged", metadataHandler);
  }, [selectedVideoId]);

  useEffect(() => {
    const correctionsHandler = (id: string) => {
      if (!selectedVideoId || id !== selectedVideoId) {
        return;
      }
      VideoService.refreshAnalysis(selectedVideoId)
        .then((data) => setAnalysisData(data))
        .catch(() => {});
    };
    eventBus.on("analysisCorrectionsChanged", correctionsHandler);
    return () => eventBus.off("analysisCorrectionsChanged", correctionsHandler);
  }, [selectedVideoId]);

  useEffect(() => {
    const handler = (payload: { videoId?: string; annotation?: ManualVisualAnnotation }) => {
      if (!selectedVideoId || payload.videoId !== selectedVideoId || !payload.annotation) {
        return;
      }
      const annotation = payload.annotation;
      const start = Number(annotation.start_seconds ?? annotation.timestamp_seconds ?? 0);
      const end = Math.max(start + 0.05, Number(annotation.end_seconds ?? annotation.timestamp_seconds ?? start));
      const node: MeaningNetworkNode = {
        node_id: `master:manual_annotation:${annotation.id}`,
        node_type:
          annotation.category === "OBJ"
            ? "object"
            : annotation.category === "OCR" || annotation.category === "Transcription"
              ? "spoken_word"
              : annotation.category === "Audio"
                ? "prosody"
                : annotation.category === "Scene"
                  ? "situation"
                  : annotation.category === "Identification"
                    ? "narrative_agent"
                    : "manual_annotation",
        label: annotation.custom_label || annotation.label || annotation.open_note || annotation.category,
        description: `${annotation.category} / ${annotation.subcategory}`,
        attributes: {
          analyst_created: true,
          manual_annotation_id: annotation.id,
          master_schema_surface: "manual_visual_annotations",
          lane_id:
            annotation.category === "OBJ"
              ? "objects"
              : annotation.category === "OCR" || annotation.category === "Transcription"
                ? "spoken_word"
                : annotation.category === "Audio"
                  ? "prosody"
                  : undefined,
        },
        maturity: { level: "analyst_confirmed", authority: "manual_annotation", confidence: 1 },
        evidence_refs: [
          {
            evidence_id: annotation.id,
            source_type: "manual_visual_annotation",
            time_range: { start, end },
            traceback_record_id: `traceback:${annotation.id}`,
            confidence: 1,
          },
        ],
        ui: {
          display_group: "analyst_added_nodes",
          quick_confirm_enabled: true,
          copy_paste_enabled: true,
          update_enabled: true,
          source_navigation_enabled: true,
        },
      };
      setDraftMeaningNetworkNodes((current) => [
        node,
        ...current.filter((item) => item.node_id !== node.node_id),
      ]);
      setMeaningNetworkCursorSeconds(start);
    };
    eventBus.on("nativeVisualAnnotationSaved", handler);
    return () => eventBus.off("nativeVisualAnnotationSaved", handler);
  }, [selectedVideoId]);

  const instructions = analysisData?.secondOrderLabelProliferation?.instructions || [];
  const narrativeLensReadings = useMemo(
    () => narrativeLensReadingsFromAnalysis(analysisData),
    [analysisData],
  );
  const characterPathReadings = useMemo(
    () => characterPathReadingsFromAnalysis(analysisData),
    [analysisData],
  );
  const datasceneMeaningNetwork = useMemo(
    () => datasceneMeaningNetworkFromAnalysis(analysisData),
    [analysisData],
  );
  const meaningNetworkUiContract = datasceneMeaningNetwork?.meaning_network?.ui_contract || {};
  const persistedMeaningNetworkPresenceIntervals = useMemo(
    () => analysisData?.annotationCorrections?.master_schema_presence_intervals || [],
    [analysisData?.annotationCorrections?.master_schema_presence_intervals],
  );
  const persistedMeaningNetworkLanes = useMemo<MeaningNetworkLane[]>(
    () =>
      (analysisData?.annotationCorrections?.meaning_network_custom_lanes || []).map((lane) => ({
        lane_id: lane.lane_id,
        label: lane.label,
      })),
    [analysisData?.annotationCorrections?.meaning_network_custom_lanes],
  );
  const meaningNetworkLanes = useMemo(
    () => [...MEANING_NETWORK_DEFAULT_LANES, ...persistedMeaningNetworkLanes, ...draftMeaningNetworkLanes],
    [draftMeaningNetworkLanes, persistedMeaningNetworkLanes],
  );
  useEffect(() => {
    const overrides: Record<string, { start: number; end: number }> = {};
    persistedMeaningNetworkPresenceIntervals.forEach((interval) => {
      if (!interval.node_id) return;
      const start = Number(interval.start_seconds);
      const end = Number(interval.end_seconds);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        overrides[interval.node_id] = { start, end };
      }
    });
    setMeaningNetworkPresenceOverrides((current) => ({ ...overrides, ...current }));
  }, [persistedMeaningNetworkPresenceIntervals]);
  const activeNarrativeLensReadings = useMemo(
    () =>
      narrativeLensReadings
        .filter((reading) => reading.lens_id === backendLensIdForPlotLens(activeLens))
        .filter(readingCanSurface)
        .sort((left, right) => readingStartSeconds(left) - readingStartSeconds(right)),
    [activeLens, narrativeLensReadings],
  );
  const sceneConstellationGovernance = useMemo(
    () =>
      sceneConstellationGovernanceFromMaster(
        analysisData?.masterSchemaResolvedEvidence?.records,
        analysisData,
      ),
    [analysisData],
  );
  const sourceMediaMetadata = governedSourceMetadata || analysisData?.metadata?.sourceMediaMetadata;
  const masterNarrativeAgentProfiles = useMemo(
    () => masterSchemaNarrativeAgentProfiles(analysisData?.masterSchemaResolvedEvidence?.records),
    [analysisData?.masterSchemaResolvedEvidence?.records],
  );
  const sourceNarrativeAgentProfiles = useMemo(
    () => sourceMetadataNarrativeAgentProfiles(sourceMediaMetadata),
    [sourceMediaMetadata],
  );
  const sceneCardProfiles = useMemo(
    () => sceneCardNarrativeAgentProfiles(sceneCardsFromAnalysisData(analysisData)),
    [analysisData],
  );
  const narrativeAgentProfiles = useMemo(
    () =>
      mergeNarrativeAgentProfilesByMaturity(
        masterNarrativeAgentProfiles,
        sourceNarrativeAgentProfiles,
        sceneCardProfiles,
      ),
    [masterNarrativeAgentProfiles, sceneCardProfiles, sourceNarrativeAgentProfiles],
  );
  const sourceSceneSegments = useMemo(
    () => matureSceneSegmentsFromAnalysis(analysisData),
    [analysisData],
  );
  const sceneSegmentSourceLabel = matureSceneSegmentSourceLabel(analysisData);
  const sceneSegments = useMemo(
    () => {
      if (sourceSceneSegments.length) {
        return sourceSceneSegments;
      }
      const derived = fallbackSceneSegmentsFromInstructions(instructions);
      if (derived.length) {
        return derived;
      }
      if (narrativeAgentProfiles.length) {
        const duration = Number(sourceMediaMetadata?.duration_seconds || 0);
        return [{
          scene_index: 1,
          start: 0,
          end: Number.isFinite(duration) && duration > 0 ? duration : 1,
          duration: Number.isFinite(duration) && duration > 0 ? duration : 1,
        }];
      }
      return [];
    },
    [instructions, narrativeAgentProfiles.length, sourceMediaMetadata?.duration_seconds, sourceSceneSegments],
  );
  const meaningNetworkSceneSegments = useMemo(
    () =>
      [...sceneSegments, ...draftMeaningNetworkScenes].filter(
        (scene, index) => !hiddenMeaningNetworkScenes[meaningNetworkSceneKey(scene, index)],
      ),
    [draftMeaningNetworkScenes, hiddenMeaningNetworkScenes, sceneSegments],
  );
  const masterSchemaMeaningNodes = useMemo(
    () =>
      (analysisData?.masterSchemaResolvedEvidence?.records || [])
        .filter((record) =>
          Boolean(record.label) &&
          ["object", "manual_annotation", "identity", "narrative_agent_profile", "character_role", "transcript", "expression"].includes(record.category),
        )
        .slice(0, 220)
        .map(masterRecordToMeaningNode),
    [analysisData?.masterSchemaResolvedEvidence?.records],
  );
  const sceneMeaningNodes = useMemo(
    () => meaningNetworkSceneSegments.map(sceneSegmentToMeaningNode),
    [meaningNetworkSceneSegments],
  );
  const persistedPresenceMeaningNodes = useMemo(
    () => persistedMeaningNetworkPresenceIntervals.map(presenceIntervalToMeaningNode),
    [persistedMeaningNetworkPresenceIntervals],
  );
  const transcriptMeaningNodes = useMemo(
    () => (analysisData?.transcriptTimeline || analysisData?.transcript || [])
      .slice(0, 220)
      .map(transcriptSegmentToMeaningNode),
    [analysisData?.transcript, analysisData?.transcriptTimeline],
  );
  const prosodyMeaningNodes = useMemo(
    () => (analysisData?.audioProsody || [])
      .slice(0, 220)
      .map(prosodyCueToMeaningNode),
    [analysisData?.audioProsody],
  );
  const narrativeAgentProfileMeaningNodes = useMemo(
    () => narrativeAgentProfiles.map(narrativeAgentProfileToMeaningNode),
    [narrativeAgentProfiles],
  );
  const meaningNetworkNodes = useMemo(
    () => {
      const byId = new Map<string, MeaningNetworkNode>();
      [
        ...sceneMeaningNodes,
        ...narrativeAgentProfileMeaningNodes,
        ...masterSchemaMeaningNodes,
        ...persistedPresenceMeaningNodes,
        ...transcriptMeaningNodes,
        ...prosodyMeaningNodes,
        ...((datasceneMeaningNetwork?.meaning_network?.nodes || []) as MeaningNetworkNode[]),
        ...draftMeaningNetworkNodes,
      ].forEach((node) => byId.set(node.node_id, node));
      return [...byId.values()];
    },
    [datasceneMeaningNetwork, draftMeaningNetworkNodes, masterSchemaMeaningNodes, narrativeAgentProfileMeaningNodes, persistedPresenceMeaningNodes, prosodyMeaningNodes, sceneMeaningNodes, transcriptMeaningNodes],
  );
  const masterSchemaMeaningEdges = useMemo<MeaningNetworkEdge[]>(
    () => {
      const edges: MeaningNetworkEdge[] = [];
      sceneMeaningNodes.forEach((sceneNode, index) => {
        const scene = meaningNetworkSceneSegments[index];
        if (!scene) return;
        masterSchemaMeaningNodes
          .filter((node) => meaningNetworkCanonicalNodeType(node.node_type) !== "scene" && meaningNetworkNodeOverlapsScene(node, scene))
          .slice(0, 70)
          .forEach((node) => {
            edges.push({
              edge_id: `edge:${node.node_id}:belongs:${sceneNode.node_id}`,
              source_node_id: node.node_id,
              target_node_id: sceneNode.node_id,
              edge_type: "belongs_to_scene",
              weight: node.maturity?.level === "raw_detected" ? 0.35 : 0.75,
              maturity: node.maturity,
              evidence_refs: node.evidence_refs,
              ui: {
                quick_confirm_enabled: true,
                copy_paste_enabled: true,
                update_enabled: true,
                source_navigation_enabled: true,
              },
            });
          });
      });
      const agentNodes = masterSchemaMeaningNodes.filter((node) => meaningNetworkCanonicalNodeType(node.node_type) === "narrative_agent");
      const objectNodes = masterSchemaMeaningNodes.filter((node) => node.node_type === "object");
      agentNodes.slice(0, 80).forEach((agent) => {
        objectNodes
          .filter((object) => {
            const agentTarget = String(agent.attributes?.target_id || "");
            const objectTarget = String(object.attributes?.target_id || "");
            return (
              (agentTarget && objectTarget && agentTarget === objectTarget) ||
              Math.abs(meaningNetworkEvidenceStart(agent.evidence_refs) - meaningNetworkEvidenceStart(object.evidence_refs)) <= 0.5
            );
          })
          .slice(0, 4)
          .forEach((object) => {
            edges.push({
              edge_id: `edge:${agent.node_id}:tracks:${object.node_id}`,
              source_node_id: agent.node_id,
              target_node_id: object.node_id,
              edge_type: "tracks_same_entity_as",
              weight: 0.78,
              maturity: agent.maturity,
              evidence_refs: [...(agent.evidence_refs || []), ...(object.evidence_refs || [])],
              ui: {
                quick_confirm_enabled: true,
                copy_paste_enabled: true,
                update_enabled: true,
                source_navigation_enabled: true,
              },
            });
          });
      });
      return edges;
    },
    [masterSchemaMeaningNodes, sceneMeaningNodes, meaningNetworkSceneSegments],
  );
  const meaningNetworkEdges = useMemo(
    () => [
      ...masterSchemaMeaningEdges,
      ...((datasceneMeaningNetwork?.meaning_network?.edges || []) as MeaningNetworkEdge[]),
      ...draftMeaningNetworkEdges,
    ],
    [datasceneMeaningNetwork, draftMeaningNetworkEdges, masterSchemaMeaningEdges],
  );
  const reviewableMeaningNetworkNodes = useMemo(
    () =>
      meaningNetworkNodes
        .filter((node) =>
          [
            "characters_in_scene",
            "scene_speakers",
            "diagnostics",
            "scene_timeline",
            "master_schema_narrative_agents",
            "master_schema_objects",
            "master_schema_evidence",
            "spoken_word",
            "prosody",
            "meaning_network_presence",
            "analyst_added_nodes",
            "analyst_pasted_nodes",
          ].includes(String(node.ui?.display_group || "")),
        )
        .sort((left, right) => meaningNetworkEvidenceStart(left.evidence_refs) - meaningNetworkEvidenceStart(right.evidence_refs)),
    [meaningNetworkNodes],
  );
  const reviewableMeaningNetworkEdges = useMemo(
    () =>
      meaningNetworkEdges
        .filter((edge) => ["co_occurs_with", "belongs_to_scene", "copy_of_anchor", "tracks_same_entity_as"].includes(edge.edge_type))
        .sort((left, right) => meaningNetworkEvidenceStart(left.evidence_refs) - meaningNetworkEvidenceStart(right.evidence_refs)),
    [meaningNetworkEdges],
  );
  const focusedMeaningNetworkScene = useMemo(
    () =>
      focusedMeaningNetworkSceneKey
        ? meaningNetworkSceneSegments.find((scene, index) => meaningNetworkSceneKey(scene, index) === focusedMeaningNetworkSceneKey)
        : null,
    [focusedMeaningNetworkSceneKey, meaningNetworkSceneSegments],
  );
  const visibleMeaningNetworkNodes = useMemo(
    () => {
      if (!focusedMeaningNetworkScene) {
        return meaningNetworkNodes;
      }
      const focusedSceneNodeId = `scene:${meaningNetworkSceneKey(focusedMeaningNetworkScene)}`;
      return meaningNetworkNodes.filter(
        (node) =>
          node.node_id === focusedSceneNodeId ||
          (meaningNetworkCanonicalNodeType(node.node_type) !== "scene" && meaningNetworkNodeOverlapsScene(node, focusedMeaningNetworkScene)),
      );
    },
    [focusedMeaningNetworkScene, meaningNetworkNodes],
  );
  const visibleMeaningNetworkEdges = useMemo(
    () => {
      if (!focusedMeaningNetworkScene) {
        return meaningNetworkEdges;
      }
      const visibleIds = new Set(visibleMeaningNetworkNodes.map((node) => node.node_id));
      return meaningNetworkEdges.filter(
        (edge) =>
          (visibleIds.has(edge.source_node_id) && visibleIds.has(edge.target_node_id)) ||
          meaningNetworkEvidenceStart(edge.evidence_refs) >= focusedMeaningNetworkScene.start &&
            meaningNetworkEvidenceStart(edge.evidence_refs) <= focusedMeaningNetworkScene.end,
      );
    },
    [focusedMeaningNetworkScene, meaningNetworkEdges, visibleMeaningNetworkNodes],
  );
  const hasMeaningPlotSurface =
    instructions.length > 0 ||
    narrativeAgentProfiles.length > 0 ||
    narrativeLensReadings.length > 0 ||
    characterPathReadings.length > 0 ||
    meaningNetworkNodes.length > 0;
  const sceneSegmentsAreDerived = sourceSceneSegments.length === 0 && sceneSegments.length > 0;
  const activeScene = sceneSegments[activeSceneIndex] || sceneSegments[0];
  const activeSceneKey = activeScene
    ? String(activeScene.scene_index ?? activeSceneIndex + 1)
    : "scene-1";
  const activeMeaningNetworkScene =
    (focusedMeaningNetworkSceneKey
      ? meaningNetworkSceneSegments.find((scene, index) => meaningNetworkSceneKey(scene, index) === focusedMeaningNetworkSceneKey)
      : null) ||
    meaningNetworkSceneSegments[activeSceneIndex] ||
    meaningNetworkSceneSegments[0];
  const meaningNetworkTimelineDuration = useMemo(
    () => {
      const mediaDuration = Number(sourceMediaMetadata?.duration_seconds || 0);
      const sceneEnd = Math.max(0, ...sceneSegments.map((scene) => Number(scene.end || 0)));
      const nodeEnd = Math.max(
        0,
        ...meaningNetworkNodes.map((node) => meaningNetworkNodeEnd(node)),
      );
      const duration = Math.max(mediaDuration, sceneEnd, nodeEnd, 1);
      return Number.isFinite(duration) && duration > 0 ? duration : 1;
    },
    [meaningNetworkNodes, sceneSegments, sourceMediaMetadata?.duration_seconds],
  );
  const meaningNetworkLayoutSceneFallback = useMemo(() => {
    const sceneForFocusedLayout =
      focusedMeaningNetworkSceneKey || meaningNetworkViewMode === "scene_timeline"
        ? activeMeaningNetworkScene
        : null;
    return sceneForFocusedLayout
      ? {
          start: Number(sceneForFocusedLayout.start || 0),
          end: Number(sceneForFocusedLayout.end || sceneForFocusedLayout.start || 0),
        }
      : null;
  }, [activeMeaningNetworkScene, focusedMeaningNetworkSceneKey, meaningNetworkViewMode]);
  const meaningNetworkGraph = useMemo(
    () => meaningNetworkGraphLayout(
      visibleMeaningNetworkNodes,
      visibleMeaningNetworkEdges,
      meaningNetworkLanes,
      meaningNetworkPresenceOverrides,
      meaningNetworkLayoutSceneFallback,
      { start: 0, end: meaningNetworkTimelineDuration },
    ),
    [meaningNetworkLanes, meaningNetworkLayoutSceneFallback, meaningNetworkPresenceOverrides, meaningNetworkTimelineDuration, visibleMeaningNetworkEdges, visibleMeaningNetworkNodes],
  );
  const meaningNetworkCursorX = useMemo(() => {
    const span = Math.max(0.001, meaningNetworkGraph.temporalEnd - meaningNetworkGraph.temporalStart);
    const ratio = Math.min(1, Math.max(0, (meaningNetworkCursorSeconds - meaningNetworkGraph.temporalStart) / span));
    return 80 + ratio * Math.max(meaningNetworkGraph.width - 160, 1);
  }, [meaningNetworkCursorSeconds, meaningNetworkGraph.temporalEnd, meaningNetworkGraph.temporalStart, meaningNetworkGraph.width]);
  const activeSceneMeaningNodes = useMemo(
    () =>
      activeMeaningNetworkScene
        ? meaningNetworkNodes.filter((node) => meaningNetworkCanonicalNodeType(node.node_type) !== "scene" && meaningNetworkNodeOverlapsScene(node, activeMeaningNetworkScene))
        : [],
    [activeMeaningNetworkScene, meaningNetworkNodes],
  );
  const characterTimelineNodes = useMemo(
    () =>
      meaningNetworkNodes
        .filter((node) => ["narrative_agent", "character", "identity"].includes(meaningNetworkCanonicalNodeType(node.node_type)))
        .sort((left, right) => meaningNetworkEvidenceStart(left.evidence_refs) - meaningNetworkEvidenceStart(right.evidence_refs)),
    [meaningNetworkNodes],
  );
  const characterTimelineGroups = useMemo(
    () => {
      const groups = new Map<string, MeaningNetworkNode[]>();
      characterTimelineNodes.forEach((node) => {
        const label = renamedMeaningNetworkMarkers[node.node_id] || node.label || "Unknown narrative agent";
        const key = label.toLowerCase();
        const existing = groups.get(key) || [];
        existing.push(node);
        groups.set(key, existing);
      });
      return [...groups.entries()].map(([key, nodes]) => ({
        key,
        label: renamedMeaningNetworkMarkers[nodes[0]?.node_id || ""] || nodes[0]?.label || "Unknown narrative agent",
        nodes,
      }));
    },
    [characterTimelineNodes, renamedMeaningNetworkMarkers],
  );
  const plotInstructions = useMemo(
    () =>
      instructions
        .filter((instruction) => PLOT_FAMILIES.has(instruction.target_label_family))
        .filter((instruction) => plotLensTerms(instruction, activeLens).length > 0)
        .sort((left, right) => secondsFromInstruction(left) - secondsFromInstruction(right)),
    [instructions, activeLens],
  );

  useEffect(() => {
    if (sceneSegments.length === 0) {
      setActiveSceneIndex(0);
      return;
    }
    if (activeSceneIndex >= sceneSegments.length) {
      setActiveSceneIndex(sceneSegments.length - 1);
    }
  }, [activeSceneIndex, sceneSegments.length]);
  const characterInstructions = useMemo(
    () =>
      instructions
        .filter((instruction) => CHARACTER_FAMILIES.has(instruction.target_label_family))
        .filter((instruction) => plotLensTerms(instruction, activeLens).length > 0)
        .sort((left, right) => supportScore(right) - supportScore(left)),
    [instructions, activeLens],
  );

  const navigateToInstruction = useCallback((instruction: SecondOrderLabelInstruction) => {
    if (!selectedVideoId) {
      return;
    }
    openVideoAtTime(selectedVideoId, secondsFromInstruction(instruction));
  }, [selectedVideoId]);

  const navigateToReading = useCallback((reading: InterpretiveReading) => {
    if (!selectedVideoId) {
      return;
    }
    openVideoAtTime(selectedVideoId, readingStartSeconds(reading));
  }, [selectedVideoId]);

  const meaningNetworkVerificationRange = useCallback((
    item: Partial<MeaningNetworkNode> & { evidence_refs?: MeaningNetworkEvidenceRef[] },
  ): MeaningNetworkVerificationRange | null => {
    if (item.node_id && item.node_type && item.label && meaningNetworkPresenceOverrides[item.node_id]) {
      const range = meaningNetworkPresenceRange(
        item as MeaningNetworkNode,
        meaningNetworkPresenceOverrides,
        null,
      );
      return {
        start: range.start,
        end: range.end,
        range_source: "presence_override",
        source_verification_status: "source_time_resolved",
        source_evidence_refs: item.evidence_refs || [],
        source_traceback_refs: meaningNetworkTracebackRefs(item.evidence_refs),
        source_types: meaningNetworkSourceTypes(item.evidence_refs),
      };
    }
    const evidenceMatch = meaningNetworkTimedEvidenceRef(item.evidence_refs);
    if (evidenceMatch) {
      return {
        ...evidenceMatch.range,
        range_source: "evidence_ref",
        source_verification_status: "source_time_resolved",
        source_evidence_refs: item.evidence_refs || [evidenceMatch.ref],
        source_traceback_refs: meaningNetworkTracebackRefs(item.evidence_refs),
        source_types: meaningNetworkSourceTypes(item.evidence_refs),
      };
    }
    return null;
  }, [meaningNetworkPresenceOverrides]);

  const navigateToMeaningNetworkEvidence = useCallback(
    (item: Partial<MeaningNetworkNode & MeaningNetworkEdge> & { evidence_refs?: MeaningNetworkEvidenceRef[] }) => {
      if (!selectedVideoId) {
        return;
      }
      const range = meaningNetworkVerificationRange(item);
      if (range) {
        setMeaningNetworkCursorSeconds(range.start);
        openVideoAtTime(selectedVideoId, range.start);
        eventBus.emit("meaningNetworkSourceVerified", {
          videoId: selectedVideoId,
          node_id: item.node_id,
          timestamp: range.start,
          end_timestamp: range.end,
          range_source: range.range_source,
          source_verification_status: range.source_verification_status,
          source_evidence_refs: range.source_evidence_refs,
          source_traceback_refs: range.source_traceback_refs,
          source_types: range.source_types,
          source: "meaning_network_node_verification",
        });
        return;
      }
      eventBus.emit("meaningNetworkSourceAnchorMissing", {
        videoId: selectedVideoId,
        node_id: item.node_id,
        edge_id: item.edge_id,
        evidenceRefs: item.evidence_refs || [],
        fallbackPanel: "MeaningNetworkSheet",
        generic_master_schema_view_opened: false,
      });
      if (item.node_id) {
        const node = meaningNetworkNodes.find((candidate) => candidate.node_id === item.node_id);
        if (node) {
          setSelectedMeaningNetworkNodeId(node.node_id);
          setMeaningNetworkSheet({ kind: "node", node });
        }
      } else if (item.edge_id) {
        const edge = meaningNetworkEdges.find((candidate) => candidate.edge_id === item.edge_id);
        if (edge) {
          setMeaningNetworkSheet({ kind: "edge", edge });
        }
      }
    },
    [meaningNetworkEdges, meaningNetworkNodes, meaningNetworkVerificationRange, selectedVideoId],
  );

  const openMeaningNetworkNodeInspector = useCallback((node: MeaningNetworkNode) => {
    setSelectedMeaningNetworkNodeId(node.node_id);
    setMeaningNetworkSheet({ kind: "node", node });
    eventBus.emit("meaningNetworkSheetOpened", {
      videoId: selectedVideoId,
      kind: "node",
      node_id: node.node_id,
      node_type: node.node_type,
      source_navigation_first: true,
      generic_narrative_agent_view_opened: false,
    });
  }, [selectedVideoId]);

  const openMeaningNetworkEdgeInspector = useCallback((edge: MeaningNetworkEdge) => {
    setMeaningNetworkSheet({ kind: "edge", edge });
    eventBus.emit("meaningNetworkSheetOpened", {
      videoId: selectedVideoId,
      kind: "edge",
      edge_id: edge.edge_id,
      edge_type: edge.edge_type,
      source_navigation_first: true,
      generic_narrative_agent_view_opened: false,
    });
  }, [selectedVideoId]);

  const openSpecificNarrativeAgentStoryline = useCallback((node: MeaningNetworkNode) => {
    eventBus.emit("openPanelRequest", {
      panelType: "ManualIdentification",
      panelProps: selectedVideoId
        ? {
            videoId: selectedVideoId,
            narrativeAgentNodeId: node.node_id,
            narrativeAgentLabel: renamedMeaningNetworkMarkers[node.node_id] || node.label,
            narrativeAgentStorylineLeaf: true,
            openAsFocusedLeaf: true,
          }
        : {},
    });
    eventBus.emit("meaningNetworkSpecificStorylineOpened", {
      videoId: selectedVideoId,
      node_id: node.node_id,
      label: renamedMeaningNetworkMarkers[node.node_id] || node.label,
      opened_from: "meaning_network_node_sheet",
      generic_narrative_agent_view_opened: false,
    });
  }, [renamedMeaningNetworkMarkers, selectedVideoId]);

  const openMeaningNetworkTraceback = useCallback((
    item: MeaningNetworkNode | MeaningNetworkEdge,
    kind: "node" | "edge",
  ) => {
    const evidenceRefs = item.evidence_refs || [];
    const payload = {
      videoId: selectedVideoId,
      sourcePanel: "MeaningNetwork",
      claim_id: kind === "node" ? (item as MeaningNetworkNode).node_id : (item as MeaningNetworkEdge).edge_id,
      claim_label: kind === "node"
        ? renamedMeaningNetworkMarkers[(item as MeaningNetworkNode).node_id] || (item as MeaningNetworkNode).label
        : (item as MeaningNetworkEdge).edge_type,
      claim_type: kind === "node" ? (item as MeaningNetworkNode).node_type : "meaning_network_edge",
      claim_status: String(item.maturity?.level || "reviewable"),
      maturity_level: String(item.maturity?.level || "candidate"),
      authority_level: String(item.maturity?.authority || "meaning_network"),
      authority_source: "MeaningNetwork",
      review_status: "reviewable",
      source_refs: {
        evidence_refs: evidenceRefs,
        traceback_record_ids: meaningNetworkTracebackRefs(evidenceRefs),
      },
      sourceItem: item as Record<string, unknown>,
    };
    eventBus.emit("openPanelRequest", {
      panelType: "TracebackDrawer",
      panelProps: { payload },
    });
    eventBus.emit("tracebackOpenRequested", payload);
  }, [renamedMeaningNetworkMarkers, selectedVideoId]);

  const openMeaningNetworkNodeContextMenu = useCallback((
    event: React.MouseEvent<SVGGElement | SVGRectElement | SVGCircleElement>,
    node: MeaningNetworkNode,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedMeaningNetworkNodeId(node.node_id);
    setMeaningNetworkContextMenu({
      x: event.clientX,
      y: event.clientY,
      kind: "node",
      node,
    });
  }, []);

  const openMeaningNetworkEdgeContextMenu = useCallback((
    event: React.MouseEvent<SVGGElement | SVGLineElement>,
    edge: MeaningNetworkEdge,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setMeaningNetworkContextMenu({
      x: event.clientX,
      y: event.clientY,
      kind: "edge",
      edge,
    });
  }, []);

  const changeMeaningNetworkZoom = useCallback((delta: number) => {
    setMeaningNetworkZoom((current) => {
      const next = Math.round((current + delta) * 100) / 100;
      return Math.min(2.75, Math.max(0.45, next));
    });
  }, []);

  const meaningNetworkSecondsFromPointer = useCallback((event: React.PointerEvent<SVGElement>) => {
    const svg = meaningNetworkGraphSvgRef.current;
    if (!svg) return meaningNetworkGraph.temporalStart;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * meaningNetworkGraph.width;
    const span = Math.max(0.001, meaningNetworkGraph.temporalEnd - meaningNetworkGraph.temporalStart);
    const ratio = Math.min(1, Math.max(0, (x - 80) / Math.max(meaningNetworkGraph.width - 160, 1)));
    return meaningNetworkGraph.temporalStart + ratio * span;
  }, [meaningNetworkGraph.temporalEnd, meaningNetworkGraph.temporalStart, meaningNetworkGraph.width]);

  const seekMeaningNetworkCursor = useCallback((seconds: number) => {
    const safe = Math.max(0, Number(seconds || 0));
    setMeaningNetworkCursorSeconds(safe);
    if (selectedVideoId) {
      openVideoAtTime(selectedVideoId, safe);
    }
    eventBus.emit("meaningNetworkCursorChanged", {
      videoId: selectedVideoId,
      timestamp: safe,
      source: "meaning_network_timeline_cursor",
      synchronized_video: true,
    });
  }, [selectedVideoId]);

  const seekMeaningNetworkCursorFromPointer = useCallback((event: React.PointerEvent<SVGElement>) => {
    seekMeaningNetworkCursor(meaningNetworkSecondsFromPointer(event));
  }, [meaningNetworkSecondsFromPointer, seekMeaningNetworkCursor]);

  const persistMeaningNetworkPresenceInterval = useCallback(async (
    node: MeaningNetworkNode,
    range: { start: number; end: number },
  ) => {
    if (!selectedVideoId) return;
    const start = Math.max(0, Math.min(range.start, range.end));
    const end = Math.max(start + 0.05, Math.max(range.start, range.end));
    const now = new Date().toISOString();
    const existing = analysisData?.annotationCorrections || {};
    const lane = meaningNetworkLaneForNode(node, meaningNetworkLanes);
    const narrativeAgentProfileId =
      String(node.attributes?.narrative_agent_profile_id || node.attributes?.profile_id || "").trim() || undefined;
    const sourceVerification = meaningNetworkVerificationRange(node);
    const sourceEvidenceRefs = sourceVerification?.source_evidence_refs || node.evidence_refs || [];
    const sourceTracebackRefs =
      sourceVerification?.source_traceback_refs?.length
        ? sourceVerification.source_traceback_refs
        : meaningNetworkTracebackRefs(sourceEvidenceRefs);
    const interval: MeaningNetworkPresenceInterval = {
      id: `meaning-network-presence:${node.node_id}`,
      node_id: node.node_id,
      node_type: node.node_type,
      label: renamedMeaningNetworkMarkers[node.node_id] || node.label,
      narrative_agent_profile_id: narrativeAgentProfileId,
      master_schema_surface:
        narrativeAgentProfileId || isNarrativeAgentMeaningNode(node)
          ? "narrative_agent_profile_annotations"
          : String(node.attributes?.master_schema_surface || "master_schema_presence_intervals"),
      lane_id: String(node.attributes?.lane_id || lane.lane_id),
      presence_mode: String(node.attributes?.presence_mode || lane.presenceMode || meaningNetworkPresenceModeForNodeType(node.node_type)),
      start_seconds: Number(start.toFixed(3)),
      end_seconds: Number(end.toFixed(3)),
      authority_level: "manual_correction",
      source_panel: "MeaningNetwork",
      source_profile_surface: "NarrativeAgentProfiles",
      source_verification_status: sourceVerification?.source_verification_status || "source_time_resolved",
      source_range_source: sourceVerification?.range_source || "manual_interval",
      source_evidence_refs: sourceEvidenceRefs,
      source_traceback_refs: sourceTracebackRefs,
      propagation_required: true,
      partial_propagation_allowed: false,
      proliferates_to: [
        "master_schema",
        "meaning_network",
        "narrative_agent_cards",
        "video_panel",
        "bbox_roi_panel",
        "scene_card_panel",
      ],
      updated_at: now,
      updated_by: "analyst",
    };
    const currentIntervals = existing.master_schema_presence_intervals || [];
    const nextIntervals = [
      ...currentIntervals.filter((item) => item.id !== interval.id && item.node_id !== interval.node_id),
      interval,
    ];
    const nextCorrectionsBase: AnnotationCorrections = {
      ...existing,
      analysis_id: selectedVideoId,
      version: 1,
      updated_at: now,
      updated_by: "analyst",
      text_substitutions: existing.text_substitutions || [],
      label_overrides: existing.label_overrides || [],
      manual_transcript_entries: existing.manual_transcript_entries || [],
      manual_visual_annotations: existing.manual_visual_annotations || [],
      proliferation_decisions: existing.proliferation_decisions || [],
      meaning_network_custom_lanes: existing.meaning_network_custom_lanes || [],
      master_schema_presence_intervals: nextIntervals,
    };
    const nextCorrections = retimeManualVisualAnnotationsFromPresenceInterval(
      nextCorrectionsBase,
      interval,
      { now },
    );
    await VideoService.saveAnnotationCorrections(selectedVideoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(selectedVideoId);
    setAnalysisData(refreshed);
    eventBus.emit("meaningNetworkPresenceIntervalCommitted", {
      videoId: selectedVideoId,
      interval,
      event_type: "master_schema_updated",
      update_source: "meaning_network_presence_drag",
      update_authority: "manual_correction",
      master_schema_surface: interval.master_schema_surface,
      narrative_agent_profile_id: interval.narrative_agent_profile_id,
      source_verification_status: interval.source_verification_status,
      source_range_source: interval.source_range_source,
      source_evidence_refs: interval.source_evidence_refs,
      source_traceback_refs: interval.source_traceback_refs,
      propagation_required: true,
      partial_propagation_allowed: false,
      affected_panels: ["meaning_network", "master_schema", "video_panel", "bbox_roi_panel", "scene_card_panel", "narrative_agent_panel"],
    });
    eventBus.emit("narrativeAgentProfilePresenceUpdated", {
      videoId: selectedVideoId,
      interval,
      profile_id: interval.narrative_agent_profile_id,
      source_panel: "MeaningNetwork",
      master_schema_surface: interval.master_schema_surface,
      source_verification_status: interval.source_verification_status,
      source_evidence_refs: interval.source_evidence_refs,
    });
    eventBus.emit("analysisCorrectionsChanged", selectedVideoId);
  }, [analysisData?.annotationCorrections, meaningNetworkLanes, meaningNetworkVerificationRange, renamedMeaningNetworkMarkers, selectedVideoId]);

  const beginMeaningNetworkPresenceDrag = useCallback((
    bar: MeaningNetworkPresenceBar,
    handle: MeaningNetworkPresenceDrag["handle"],
    event: React.PointerEvent<SVGGElement | SVGRectElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedMeaningNetworkNodeId(bar.node.node_id);
    setMeaningNetworkPresenceDrag({
      nodeId: bar.node.node_id,
      handle,
      pointerId: event.pointerId,
      originSeconds: meaningNetworkSecondsFromPointer(event),
      originalStart: bar.start,
      originalEnd: bar.end,
    });
    setMeaningNetworkCursorSeconds(handle === "end" ? bar.end : bar.start);
    if (selectedVideoId) {
      openVideoAtTime(selectedVideoId, handle === "end" ? bar.end : bar.start);
    }
  }, [meaningNetworkSecondsFromPointer, selectedVideoId]);

  const updateMeaningNetworkPresenceDrag = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!meaningNetworkPresenceDrag) return;
    event.preventDefault();
    const seconds = meaningNetworkSecondsFromPointer(event);
    const delta = seconds - meaningNetworkPresenceDrag.originSeconds;
    const minDuration = 0.05;
    const maxEnd = Math.max(meaningNetworkTimelineDuration, meaningNetworkGraph.temporalEnd, meaningNetworkPresenceDrag.originalEnd + Math.abs(delta));
    let nextStart = meaningNetworkPresenceDrag.originalStart;
    let nextEnd = meaningNetworkPresenceDrag.originalEnd;
    if (meaningNetworkPresenceDrag.handle === "start") {
      nextStart = Math.min(meaningNetworkPresenceDrag.originalStart + delta, meaningNetworkPresenceDrag.originalEnd - minDuration);
    } else if (meaningNetworkPresenceDrag.handle === "end") {
      nextEnd = Math.max(meaningNetworkPresenceDrag.originalEnd + delta, meaningNetworkPresenceDrag.originalStart + minDuration);
    } else {
      nextStart = meaningNetworkPresenceDrag.originalStart + delta;
      nextEnd = meaningNetworkPresenceDrag.originalEnd + delta;
    }
    const shift = nextStart < 0 ? -nextStart : nextEnd > maxEnd ? maxEnd - nextEnd : 0;
    nextStart = Math.max(0, nextStart + shift);
    nextEnd = Math.max(nextStart + minDuration, nextEnd + shift);
    const scrubSeconds = meaningNetworkPresenceDrag.handle === "end" ? nextEnd : nextStart;
    setMeaningNetworkCursorSeconds(scrubSeconds);
    const now = Date.now();
    if (selectedVideoId && now - meaningNetworkLiveScrubRef.current > 80) {
      meaningNetworkLiveScrubRef.current = now;
      openVideoAtTime(selectedVideoId, scrubSeconds);
      eventBus.emit("meaningNetworkPresenceHandleScrubbed", {
        videoId: selectedVideoId,
        node_id: meaningNetworkPresenceDrag.nodeId,
        handle: meaningNetworkPresenceDrag.handle,
        time: scrubSeconds,
        source_sync_required: true,
      });
    }
    setMeaningNetworkPresenceOverrides((current) => ({
      ...current,
      [meaningNetworkPresenceDrag.nodeId]: { start: nextStart, end: nextEnd },
    }));
  }, [meaningNetworkGraph.temporalEnd, meaningNetworkPresenceDrag, meaningNetworkSecondsFromPointer, meaningNetworkTimelineDuration, selectedVideoId]);

  const endMeaningNetworkPresenceDrag = useCallback(() => {
    if (!meaningNetworkPresenceDrag) return;
    const node = meaningNetworkNodes.find((item) => item.node_id === meaningNetworkPresenceDrag.nodeId);
    const range = meaningNetworkPresenceOverrides[meaningNetworkPresenceDrag.nodeId];
    setMeaningNetworkPresenceDrag(null);
    const changed = range && (
      Math.abs(range.start - meaningNetworkPresenceDrag.originalStart) > 0.01 ||
      Math.abs(range.end - meaningNetworkPresenceDrag.originalEnd) > 0.01
    );
    if (node && range && changed) {
      void persistMeaningNetworkPresenceInterval(node, range);
    }
  }, [meaningNetworkNodes, meaningNetworkPresenceDrag, meaningNetworkPresenceOverrides, persistMeaningNetworkPresenceInterval]);

  const handleMeaningNetworkWheelZoom = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (meaningNetworkViewMode !== "graph") {
      return;
    }
    event.preventDefault();
    changeMeaningNetworkZoom(event.deltaY < 0 ? 0.12 : -0.12);
  }, [changeMeaningNetworkZoom, meaningNetworkViewMode]);

  const resetMeaningNetworkReviewFrame = useCallback(() => {
    setMeaningNetworkSheet(null);
    setMeaningNetworkContextMenu(null);
    setSelectedMeaningNetworkNodeId(null);
    setMeaningNetworkViewMode("graph");
  }, []);

  const reportMeaningNetworkMaturitySave = useCallback((message: string, detail: string, status: "saved" | "staged" | "error" = "saved") => {
    setMeaningNetworkSaveFeedback({
      status,
      message,
      detail,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const quickConfirmMeaningNetworkNode = useCallback(async (node: MeaningNetworkNode) => {
    setConfirmedMeaningNetworkMarkers((current) => ({ ...current, [node.node_id]: true }));
    const sourceVerification = meaningNetworkVerificationRange(node);
    const sourceEvidenceRefs = sourceVerification?.source_evidence_refs || node.evidence_refs || [];
    const sourceTracebackRefs =
      sourceVerification?.source_traceback_refs?.length
        ? sourceVerification.source_traceback_refs
        : meaningNetworkTracebackRefs(sourceEvidenceRefs);
    const label = renamedMeaningNetworkMarkers[node.node_id] || node.label;
    const projectionTargets = [
      "master_schema",
      "meaning_network",
      "narrative_agent_cards",
      "video_panel",
      "bbox_roi_panel",
      "scene_card_panel",
      "traceback",
    ];
    const now = new Date().toISOString();
    let decision: ProliferationDecision | null = null;
    if (selectedVideoId) {
      const existing = analysisData?.annotationCorrections || {};
      decision = {
        decision_id: `meaning-network-quick-confirm:${node.node_id}`,
        candidate_id: node.node_id,
        request_id: `meaning-network:${selectedVideoId}`,
        decision: "confirmed",
        authority_level: "manual_confirmation",
        source_panel: "MeaningNetwork",
        source_verification_status: sourceVerification?.source_verification_status || "source_anchor_missing",
        source_range_source: sourceVerification?.range_source,
        candidate_label: node.label,
        applied_label: label,
        target_evidence_id: sourceEvidenceRefs[0]?.evidence_id || node.node_id,
        source_anchors: sourceVerification
          ? [
              {
                start_seconds: Number(sourceVerification.start.toFixed(3)),
                end_seconds: Number(sourceVerification.end.toFixed(3)),
                range_source: sourceVerification.range_source,
                source_types: sourceVerification.source_types,
              },
            ]
          : [],
        evidence_refs: sourceEvidenceRefs,
        source_traceback_refs: sourceTracebackRefs,
        projection_targets: projectionTargets,
        proliferates_to: projectionTargets,
        governance_status: {
          maturity_result: "analyst_confirmed",
          propagation_required: true,
          partial_propagation_allowed: false,
          source_verification_status: sourceVerification?.source_verification_status || "source_anchor_missing",
          corrected_data_proliferates: true,
          raw_detection_retained_as: "traceback_only",
        },
        proliferation_allowed: true,
        decision_reason: "meaning_network_quick_confirm",
        created_at: now,
        created_by: "analyst",
      };
      const currentDecisions = existing.proliferation_decisions || [];
      const nextCorrections: AnnotationCorrections = {
        ...existing,
        analysis_id: selectedVideoId,
        version: 1,
        updated_at: now,
        updated_by: "analyst",
        text_substitutions: existing.text_substitutions || [],
        label_overrides: existing.label_overrides || [],
        manual_transcript_entries: existing.manual_transcript_entries || [],
        manual_visual_annotations: existing.manual_visual_annotations || [],
        master_schema_presence_intervals: existing.master_schema_presence_intervals || [],
        meaning_network_custom_lanes: existing.meaning_network_custom_lanes || [],
        proliferation_decisions: [
          ...currentDecisions.filter((item) => item.decision_id !== decision?.decision_id && item.candidate_id !== node.node_id),
          decision,
        ],
      };
      await VideoService.saveAnnotationCorrections(selectedVideoId, nextCorrections);
      const refreshed = await VideoService.refreshAnalysis(selectedVideoId);
      setAnalysisData(refreshed);
      resetMeaningNetworkReviewFrame();
      reportMeaningNetworkMaturitySave(
        "Confirming node saved",
        "Saved correction bundle was sent to the Data Maturity Proliferation regime with Master Schema as the anchor.",
      );
    } else {
      reportMeaningNetworkMaturitySave(
        "Confirming node staged locally",
        "Open an analysis before saving if this correction should enter Data Maturity Proliferation.",
        "staged",
      );
    }
    eventBus.emit("meaningNetworkNodeQuickConfirmed", {
      videoId: selectedVideoId,
      node_id: node.node_id,
      node_type: node.node_type,
      label,
      maturity_result: "analyst_confirmed",
      authority_level: "manual_confirmation",
      event_type: "master_schema_updated",
      update_source: "meaning_network_quick_confirm",
      source_verification_status: sourceVerification?.source_verification_status || "source_anchor_missing",
      source_range_source: sourceVerification?.range_source,
      source_evidence_refs: sourceEvidenceRefs,
      source_traceback_refs: sourceTracebackRefs,
      proliferation_decision: decision,
      evidence_refs: sourceEvidenceRefs,
      affected_panels: projectionTargets,
    });
    if (selectedVideoId) {
      eventBus.emit("analysisCorrectionsChanged", selectedVideoId);
    }
  }, [
    analysisData?.annotationCorrections,
    meaningNetworkVerificationRange,
    renamedMeaningNetworkMarkers,
    reportMeaningNetworkMaturitySave,
    resetMeaningNetworkReviewFrame,
    selectedVideoId,
  ]);

  const persistMeaningNetworkEdgeDecision = useCallback(async (
    edge: MeaningNetworkEdge,
    decision: "confirmed" | "canceled" | "inspected",
    options?: { editedMeaning?: string },
  ) => {
    const sourceNode = meaningNetworkNodes.find((node) => node.node_id === edge.source_node_id);
    const targetNode = meaningNetworkNodes.find((node) => node.node_id === edge.target_node_id);
    const sourceLabel = sourceNode ? renamedMeaningNetworkMarkers[sourceNode.node_id] || sourceNode.label : edge.source_node_id;
    const targetLabel = targetNode ? renamedMeaningNetworkMarkers[targetNode.node_id] || targetNode.label : edge.target_node_id;
    const plainMeaning = options?.editedMeaning?.trim() || meaningNetworkEdgePlainLanguage(edge, sourceLabel, targetLabel);
    const evidenceRefs = edge.evidence_refs || [];
    const tracebackRefs = meaningNetworkTracebackRefs(evidenceRefs);
    const sourceRange = meaningNetworkEvidenceTimeRange(evidenceRefs);
    const now = new Date().toISOString();
    if (decision === "confirmed" || decision === "canceled") {
      setConfirmedMeaningNetworkEdges((current) => ({
        ...current,
        [edge.edge_id]: decision === "confirmed" ? "confirmed" : "rejected",
      }));
    }
    if (!selectedVideoId) {
      reportMeaningNetworkMaturitySave(
        "Edge decision staged locally",
        "Open an analysis before saving if this edge decision should enter Data Maturity Proliferation.",
        "staged",
      );
      return;
    }
    const existing = analysisData?.annotationCorrections || {};
    const projectionTargets = [
      "master_schema",
      "meaning_network",
      "narrative_agent_cards",
      "video_panel",
      "bbox_roi_panel",
      "scene_card_panel",
      "traceback",
    ];
    const proliferationDecision: ProliferationDecision = {
      decision_id: `meaning-network-edge:${edge.edge_id}`,
      candidate_id: edge.edge_id,
      request_id: `meaning-network:${selectedVideoId}`,
      decision,
      authority_level: decision === "confirmed" ? "manual_confirmation" : decision === "canceled" ? "manual_rejection" : "manual_review",
      source_panel: "MeaningNetwork",
      source_verification_status: sourceRange ? "source_time_resolved" : "source_anchor_missing",
      source_range_source: sourceRange ? "evidence_ref" : undefined,
      candidate_label: meaningNetworkEdgeKindLabel(edge.edge_type),
      applied_label: plainMeaning,
      target_evidence_id: evidenceRefs[0]?.evidence_id || edge.edge_id,
      source_anchors: sourceRange
        ? [
            {
              start_seconds: Number(sourceRange.start.toFixed(3)),
              end_seconds: Number(sourceRange.end.toFixed(3)),
              range_source: "evidence_ref",
              source_types: meaningNetworkSourceTypes(evidenceRefs),
            },
          ]
        : [],
      evidence_refs: evidenceRefs,
      source_traceback_refs: tracebackRefs,
      projection_targets: projectionTargets,
      proliferates_to: projectionTargets,
      governance_status: {
        maturity_result:
          decision === "confirmed"
            ? "analyst_confirmed_edge_meaning"
            : decision === "canceled"
              ? "analyst_rejected_edge_meaning"
              : "analyst_reviewed_edge_meaning",
        edge_id: edge.edge_id,
        edge_type: edge.edge_type,
        source_node_id: edge.source_node_id,
        target_node_id: edge.target_node_id,
        plain_language_meaning: plainMeaning,
        why_this_edge_exists: meaningNetworkEdgeReason(edge),
        propagation_required: decision === "confirmed",
        partial_propagation_allowed: false,
        source_verification_status: sourceRange ? "source_time_resolved" : "source_anchor_missing",
        corrected_data_proliferates: decision === "confirmed",
        raw_detection_retained_as: "traceback_only",
      },
      proliferation_allowed: decision === "confirmed",
      decision_reason: options?.editedMeaning ? "meaning_network_edge_meaning_edit" : "meaning_network_edge_sheet_decision",
      created_at: now,
      created_by: "analyst",
    };
    const currentDecisions = existing.proliferation_decisions || [];
    const nextCorrections: AnnotationCorrections = {
      ...existing,
      analysis_id: selectedVideoId,
      version: 1,
      updated_at: now,
      updated_by: "analyst",
      text_substitutions: existing.text_substitutions || [],
      label_overrides: existing.label_overrides || [],
      manual_transcript_entries: existing.manual_transcript_entries || [],
      manual_visual_annotations: existing.manual_visual_annotations || [],
      master_schema_presence_intervals: existing.master_schema_presence_intervals || [],
      meaning_network_custom_lanes: existing.meaning_network_custom_lanes || [],
      proliferation_decisions: [
        ...currentDecisions.filter((item) => item.decision_id !== proliferationDecision.decision_id && item.candidate_id !== edge.edge_id),
        proliferationDecision,
      ],
    };
    await VideoService.saveAnnotationCorrections(selectedVideoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(selectedVideoId);
    setAnalysisData(refreshed);
    resetMeaningNetworkReviewFrame();
    reportMeaningNetworkMaturitySave(
      decision === "confirmed" ? "Confirming edge saved" : decision === "canceled" ? "Rejecting edge saved" : "Edge reading saved",
      "Saved edge correction bundle was sent to the Data Maturity Proliferation regime with Master Schema as the anchor.",
    );
    eventBus.emit("meaningNetworkEdgeDecisionCommitted", {
      videoId: selectedVideoId,
      edge_id: edge.edge_id,
      decision,
      plain_language_meaning: plainMeaning,
      event_type: "master_schema_updated",
      update_source: "meaning_network_edge_sheet",
      update_authority: proliferationDecision.authority_level,
      source_verification_status: proliferationDecision.source_verification_status,
      source_evidence_refs: evidenceRefs,
      source_traceback_refs: tracebackRefs,
      affected_panels: projectionTargets,
    });
    eventBus.emit("analysisCorrectionsChanged", selectedVideoId);
  }, [
    analysisData?.annotationCorrections,
    meaningNetworkNodes,
    renamedMeaningNetworkMarkers,
    reportMeaningNetworkMaturitySave,
    resetMeaningNetworkReviewFrame,
    selectedVideoId,
  ]);

  const getMeaningNetworkSflDraft = useCallback((
    kind: "node" | "edge",
    item: MeaningNetworkNode | MeaningNetworkEdge,
  ): MeaningNetworkSflDraft => {
    const id = kind === "node" ? (item as MeaningNetworkNode).node_id : (item as MeaningNetworkEdge).edge_id;
    return meaningNetworkSflDrafts[meaningNetworkSflDraftKey(kind, id)] || meaningNetworkSflDefaultDraft(kind, item);
  }, [meaningNetworkSflDrafts]);

  const updateMeaningNetworkSflDraft = useCallback((
    kind: "node" | "edge",
    item: MeaningNetworkNode | MeaningNetworkEdge,
    patch: Partial<MeaningNetworkSflDraft>,
  ) => {
    const id = kind === "node" ? (item as MeaningNetworkNode).node_id : (item as MeaningNetworkEdge).edge_id;
    const key = meaningNetworkSflDraftKey(kind, id);
    setMeaningNetworkSflDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] || meaningNetworkSflDefaultDraft(kind, item)),
        ...patch,
      },
    }));
  }, []);

  const persistMeaningNetworkSflDecision = useCallback(async (
    kind: "node" | "edge",
    item: MeaningNetworkNode | MeaningNetworkEdge,
    decision: "confirmed" | "canceled",
  ) => {
    const id = kind === "node" ? (item as MeaningNetworkNode).node_id : (item as MeaningNetworkEdge).edge_id;
    const refs = item.evidence_refs || [];
    const range = meaningNetworkEvidenceTimeRange(refs);
    const tracebackRefs = meaningNetworkTracebackRefs(refs);
    const draft = getMeaningNetworkSflDraft(kind, item);
    const now = new Date().toISOString();
    if (!selectedVideoId) {
      reportMeaningNetworkMaturitySave(
        "SFL reading staged locally",
        "Open an analysis before saving if this SFL reading should enter Data Maturity Proliferation.",
        "staged",
      );
      return;
    }
    const existing = analysisData?.annotationCorrections || {};
    const projectionTargets = [
      "master_schema",
      "meaning_network",
      "plot_structure",
      "narrative_lens_reading",
      "narrative_agent_cards",
      "scene_card_panel",
      "bbox_roi_panel",
      "video_panel",
      "traceback",
    ];
    const proliferationDecision: ProliferationDecision = {
      decision_id: `meaning-network-sfl:${kind}:${id}`,
      candidate_id: `${kind}:${id}:sfl:${draft.sfl_layer}`,
      request_id: `meaning-network-sfl:${selectedVideoId}`,
      decision,
      authority_level: decision === "confirmed" ? "manual_confirmation" : "manual_rejection",
      source_panel: "MeaningNetwork",
      source_verification_status: range ? "source_time_resolved" : "source_anchor_missing",
      source_range_source: range ? "evidence_ref" : undefined,
      candidate_label: `SFL ${draft.sfl_layer.replaceAll("_", " ")}`,
      applied_label: meaningNetworkSflPlainLanguage(draft),
      target_evidence_id: refs[0]?.evidence_id || id,
      source_anchors: range
        ? [
            {
              start_seconds: Number(range.start.toFixed(3)),
              end_seconds: Number(range.end.toFixed(3)),
              range_source: "evidence_ref",
              source_types: meaningNetworkSourceTypes(refs),
            },
          ]
        : [],
      evidence_refs: refs,
      source_traceback_refs: tracebackRefs,
      projection_targets: projectionTargets,
      proliferates_to: projectionTargets,
      governance_status: {
        schema: "vaa1.meaning_network_sfl_confirmation.v1",
        maturity_result:
          decision === "confirmed"
            ? "analyst_confirmed_sfl_reading"
            : "analyst_rejected_sfl_reading",
        anchor: "master_schema",
        user_correction_stands: true,
        target_kind: kind,
        target_id: id,
        sfl_layer: draft.sfl_layer,
        sfl_category: draft.sfl_category,
        judgement_group: draft.judgement_group,
        judgement_axis: draft.judgement_axis,
        moral_polarity: draft.moral_polarity,
        virtue_family: draft.virtue_family,
        virtue_axis: draft.virtue_axis,
        virtue_vice_value: draft.virtue_vice_value,
        confirmation_relation: draft.confirmation_relation,
        taxonomy_path:
          draft.sfl_layer === "virtues_and_vices"
            ? `virtues_and_vices.${draft.virtue_family}.${draft.virtue_axis}.${draft.moral_polarity === "vice" ? "antithesis" : "positive"}.${draft.virtue_vice_value}`
            : draft.sfl_layer === "interpersonal"
              ? `sfl.interpersonal.judgement_categories.${draft.judgement_group}.${draft.judgement_axis}`
              : `sfl.${draft.sfl_layer}.${draft.sfl_category}`,
        applied_label: draft.applied_label,
        plain_language_meaning: meaningNetworkSflPlainLanguage(draft),
        candidate_reading_contributes_to_plot_structure: decision === "confirmed",
        character_meaning_surface_ready: kind === "node",
        source_verification_status: range ? "source_time_resolved" : "source_anchor_missing",
        propagation_required: decision === "confirmed",
        partial_propagation_allowed: false,
        corrected_data_proliferates: decision === "confirmed",
        raw_parser_output_retained_as: "candidate_traceback_only",
      },
      proliferation_allowed: decision === "confirmed",
      decision_reason: "meaning_network_sfl_sheet_decision",
      created_at: now,
      created_by: "analyst",
    };
    const currentDecisions = existing.proliferation_decisions || [];
    const nextCorrections: AnnotationCorrections = {
      ...existing,
      analysis_id: selectedVideoId,
      version: 1,
      updated_at: now,
      updated_by: "analyst",
      text_substitutions: existing.text_substitutions || [],
      label_overrides: existing.label_overrides || [],
      manual_transcript_entries: existing.manual_transcript_entries || [],
      manual_visual_annotations: existing.manual_visual_annotations || [],
      master_schema_presence_intervals: existing.master_schema_presence_intervals || [],
      meaning_network_custom_lanes: existing.meaning_network_custom_lanes || [],
      proliferation_decisions: [
        ...currentDecisions.filter((entry) => entry.decision_id !== proliferationDecision.decision_id),
        proliferationDecision,
      ],
    };
    await VideoService.saveAnnotationCorrections(selectedVideoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(selectedVideoId);
    setAnalysisData(refreshed);
    resetMeaningNetworkReviewFrame();
    reportMeaningNetworkMaturitySave(
      decision === "confirmed" ? "Confirming SFL reading saved" : "Rejecting SFL reading saved",
      "Saved SFL correction bundle was sent to the Data Maturity Proliferation regime and contributes through the Master Schema authority path.",
    );
    eventBus.emit("meaningNetworkSflDecisionCommitted", {
      videoId: selectedVideoId,
      target_kind: kind,
      target_id: id,
      decision,
      event_type: "master_schema_updated",
      update_source: "meaning_network_sfl_sheet",
      update_authority: proliferationDecision.authority_level,
      sfl_layer: draft.sfl_layer,
      judgement_axis: draft.judgement_axis,
      moral_polarity: draft.moral_polarity,
      virtue_vice_value: draft.virtue_vice_value,
      affected_panels: projectionTargets,
      source_evidence_refs: refs,
      source_traceback_refs: tracebackRefs,
    });
    eventBus.emit("analysisCorrectionsChanged", selectedVideoId);
  }, [
    analysisData?.annotationCorrections,
    getMeaningNetworkSflDraft,
    reportMeaningNetworkMaturitySave,
    resetMeaningNetworkReviewFrame,
    selectedVideoId,
  ]);

  const renderMeaningNetworkSflControls = useCallback((
    kind: "node" | "edge",
    item: MeaningNetworkNode | MeaningNetworkEdge,
  ) => {
    const draft = getMeaningNetworkSflDraft(kind, item);
    const judgementGroups = Object.keys(MEANING_NETWORK_SFL_JUDGEMENT);
    const judgementValues =
      MEANING_NETWORK_SFL_JUDGEMENT[draft.judgement_group] ||
      MEANING_NETWORK_SFL_JUDGEMENT[judgementGroups[0]] ||
      [];
    const virtueFamilies = Object.keys(MEANING_NETWORK_SFL_VIRTUES);
    const virtueFamily = MEANING_NETWORK_SFL_VIRTUES[draft.virtue_family]
      ? draft.virtue_family
      : virtueFamilies[0];
    const virtueAxes = Object.keys(MEANING_NETWORK_SFL_VIRTUES[virtueFamily] || {});
    const virtueAxis = MEANING_NETWORK_SFL_VIRTUES[virtueFamily]?.[draft.virtue_axis]
      ? draft.virtue_axis
      : virtueAxes[0];
    const virtuePolarity = draft.moral_polarity === "vice" ? "antithesis" : "positive";
    const virtueValues = MEANING_NETWORK_SFL_VIRTUES[virtueFamily]?.[virtueAxis]?.[virtuePolarity] || [];
    const applyLayerDefaults = (nextLayer: MeaningNetworkSflLayer) => {
      if (nextLayer === "interpersonal") {
        const nextGroup = draft.judgement_group || "alignment_positive";
        updateMeaningNetworkSflDraft(kind, item, {
          sfl_layer: nextLayer,
          judgement_group: nextGroup,
          judgement_axis: MEANING_NETWORK_SFL_JUDGEMENT[nextGroup]?.[0] || "affirmation",
          confirmation_relation: "confirms",
        });
        return;
      }
      if (nextLayer === "virtues_and_vices") {
        const nextFamily = virtueFamily || "humanity";
        const nextAxis = Object.keys(MEANING_NETWORK_SFL_VIRTUES[nextFamily] || {})[0] || "kindness";
        updateMeaningNetworkSflDraft(kind, item, {
          sfl_layer: nextLayer,
          moral_polarity: "virtue",
          virtue_family: nextFamily,
          virtue_axis: nextAxis,
          virtue_vice_value: MEANING_NETWORK_SFL_VIRTUES[nextFamily]?.[nextAxis]?.positive?.[0] || "kindness",
          confirmation_relation: "morally_legitimizes",
        });
        return;
      }
      updateMeaningNetworkSflDraft(kind, item, {
        sfl_layer: nextLayer,
        sfl_category:
          nextLayer === "textual"
            ? MEANING_NETWORK_SFL_TEXTUAL_CATEGORIES[0]
            : MEANING_NETWORK_SFL_IDEATIONAL_CATEGORIES[0],
        confirmation_relation: "confirms",
      });
    };

    return (
      <div className="mt-2 rounded border border-slate-800 bg-[#050707] p-2" data-vaa1-meaning-network-sfl-sheet="true">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">SFL / moral reading</div>
            <div className="mt-1 text-[10px] leading-relaxed text-slate-300" data-vaa1-meaning-network-sfl-plain-language="true">
              {meaningNetworkSflPlainLanguage(draft)}
            </div>
          </div>
          <span className="rounded border border-cyan-900/60 bg-cyan-950/10 px-1.5 py-0.5 text-[9px] text-cyan-100">
            candidate
          </span>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
            Main category
            <select
              value={draft.sfl_layer}
              onChange={(event) => applyLayerDefaults(event.target.value as MeaningNetworkSflLayer)}
              className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
              data-vaa1-meaning-network-sfl-layer-select="true"
            >
              {MEANING_NETWORK_SFL_LAYERS.map((layer) => (
                <option key={layer.value} value={layer.value}>{layer.label}</option>
              ))}
            </select>
          </label>

          {draft.sfl_layer === "ideational" ? (
            <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
              Ideational category
              <select
                value={draft.sfl_category}
                onChange={(event) => updateMeaningNetworkSflDraft(kind, item, { sfl_category: event.target.value })}
                className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                data-vaa1-meaning-network-sfl-subcategory-select="true"
              >
                {MEANING_NETWORK_SFL_IDEATIONAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
          ) : null}

          {draft.sfl_layer === "textual" ? (
            <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
              Textual category
              <select
                value={draft.sfl_category}
                onChange={(event) => updateMeaningNetworkSflDraft(kind, item, { sfl_category: event.target.value })}
                className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                data-vaa1-meaning-network-sfl-subcategory-select="true"
              >
                {MEANING_NETWORK_SFL_TEXTUAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
          ) : null}

          {draft.sfl_layer === "interpersonal" ? (
            <>
              <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                Relation
                <select
                  value={draft.confirmation_relation}
                  onChange={(event) => updateMeaningNetworkSflDraft(kind, item, { confirmation_relation: event.target.value })}
                  className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                  data-vaa1-meaning-network-sfl-confirmation-relation-select="true"
                >
                  {MEANING_NETWORK_SFL_CONFIRMATION_RELATIONS.map((relation) => (
                    <option key={relation} value={relation}>{relation.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                Judgement group
                <select
                  value={draft.judgement_group}
                  onChange={(event) => updateMeaningNetworkSflDraft(kind, item, {
                    judgement_group: event.target.value,
                    judgement_axis: MEANING_NETWORK_SFL_JUDGEMENT[event.target.value]?.[0] || "",
                  })}
                  className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                  data-vaa1-meaning-network-sfl-judgement-group-select="true"
                >
                  {judgementGroups.map((group) => (
                    <option key={group} value={group}>{group.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                Judgement value
                <select
                  value={draft.judgement_axis}
                  onChange={(event) => updateMeaningNetworkSflDraft(kind, item, { judgement_axis: event.target.value })}
                  className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                  data-vaa1-meaning-network-sfl-judgement-select="true"
                >
                  {judgementValues.map((axis) => (
                    <option key={axis} value={axis}>{axis.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {draft.sfl_layer === "virtues_and_vices" ? (
            <>
              <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                Virtue family
                <select
                  value={virtueFamily}
                  onChange={(event) => {
                    const nextFamily = event.target.value;
                    const nextAxis = Object.keys(MEANING_NETWORK_SFL_VIRTUES[nextFamily] || {})[0] || "";
                    const nextPolarity = draft.moral_polarity === "vice" ? "antithesis" : "positive";
                    updateMeaningNetworkSflDraft(kind, item, {
                      virtue_family: nextFamily,
                      virtue_axis: nextAxis,
                      virtue_vice_value: MEANING_NETWORK_SFL_VIRTUES[nextFamily]?.[nextAxis]?.[nextPolarity]?.[0] || "",
                    });
                  }}
                  className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                  data-vaa1-meaning-network-sfl-virtue-family-select="true"
                >
                  {virtueFamilies.map((family) => (
                    <option key={family} value={family}>{family.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                Virtue axis
                <select
                  value={virtueAxis}
                  onChange={(event) => {
                    const nextAxis = event.target.value;
                    updateMeaningNetworkSflDraft(kind, item, {
                      virtue_axis: nextAxis,
                      virtue_vice_value: MEANING_NETWORK_SFL_VIRTUES[virtueFamily]?.[nextAxis]?.[virtuePolarity]?.[0] || "",
                    });
                  }}
                  className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                  data-vaa1-meaning-network-sfl-virtue-axis-select="true"
                >
                  {virtueAxes.map((axis) => (
                    <option key={axis} value={axis}>{axis.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                Polarity
                <select
                  value={draft.moral_polarity === "vice" ? "vice" : "virtue"}
                  onChange={(event) => {
                    const nextPolarity = event.target.value as MeaningNetworkMoralPolarity;
                    const nextBucket = nextPolarity === "vice" ? "antithesis" : "positive";
                    updateMeaningNetworkSflDraft(kind, item, {
                      moral_polarity: nextPolarity,
                      confirmation_relation: nextPolarity === "vice" ? "morally_delegitimizes" : "morally_legitimizes",
                      virtue_vice_value: MEANING_NETWORK_SFL_VIRTUES[virtueFamily]?.[virtueAxis]?.[nextBucket]?.[0] || "",
                    });
                  }}
                  className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                  data-vaa1-meaning-network-sfl-moral-select="true"
                >
                  <option value="virtue">Virtue / positive</option>
                  <option value="vice">Vice / antithesis</option>
                </select>
              </label>
              <label className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                Schema value
                <select
                  value={draft.virtue_vice_value}
                  onChange={(event) => updateMeaningNetworkSflDraft(kind, item, { virtue_vice_value: event.target.value })}
                  className="mt-1 w-full rounded border border-slate-800 bg-[#101010] px-1.5 py-1 text-[10px] normal-case tracking-normal text-slate-100"
                  data-vaa1-meaning-network-sfl-virtue-vice-select="true"
                >
                  {virtueValues.map((value) => (
                    <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => void persistMeaningNetworkSflDecision(kind, item, "confirmed")}
            className="rounded border border-emerald-800/70 bg-[#101010] px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-950/25"
            data-vaa1-meaning-network-sfl-confirm="true"
          >
            Confirm SFL reading
          </button>
          <button
            type="button"
            onClick={() => void persistMeaningNetworkSflDecision(kind, item, "canceled")}
            className="rounded border border-rose-900/70 bg-[#101010] px-2 py-1 text-[10px] text-rose-100 hover:bg-rose-950/25"
            data-vaa1-meaning-network-sfl-reject="true"
          >
            Reject SFL reading
          </button>
        </div>
      </div>
    );
  }, [
    getMeaningNetworkSflDraft,
    persistMeaningNetworkSflDecision,
    updateMeaningNetworkSflDraft,
  ]);

  const editMeaningNetworkEdgeMeaning = useCallback((edge: MeaningNetworkEdge) => {
    if (typeof window === "undefined") {
      return;
    }
    const sourceNode = meaningNetworkNodes.find((node) => node.node_id === edge.source_node_id);
    const targetNode = meaningNetworkNodes.find((node) => node.node_id === edge.target_node_id);
    const sourceLabel = sourceNode ? renamedMeaningNetworkMarkers[sourceNode.node_id] || sourceNode.label : edge.source_node_id;
    const targetLabel = targetNode ? renamedMeaningNetworkMarkers[targetNode.node_id] || targetNode.label : edge.target_node_id;
    const current = meaningNetworkEdgePlainLanguage(edge, sourceLabel, targetLabel);
    const next = window.prompt("Edit Meaning Network edge reading", current);
    if (!next || !next.trim()) {
      return;
    }
    void persistMeaningNetworkEdgeDecision(edge, "inspected", { editedMeaning: next.trim() });
  }, [meaningNetworkNodes, persistMeaningNetworkEdgeDecision, renamedMeaningNetworkMarkers]);

  const copyMeaningNetworkNode = useCallback((node: MeaningNetworkNode) => {
    setCopiedMeaningNetworkNode(node);
    eventBus.emit("meaningNetworkAnchorCopied", {
      videoId: selectedVideoId,
      node_id: node.node_id,
      label: renamedMeaningNetworkMarkers[node.node_id] || node.label,
    });
  }, [renamedMeaningNetworkMarkers, selectedVideoId]);

  const copyMeaningNetworkEdge = useCallback((edge: MeaningNetworkEdge) => {
    setCopiedMeaningNetworkEdge(edge);
    eventBus.emit("meaningNetworkEdgeCopied", {
      videoId: selectedVideoId,
      edge_id: edge.edge_id,
      edge_type: edge.edge_type,
      source_node_id: edge.source_node_id,
      target_node_id: edge.target_node_id,
      evidence_refs: edge.evidence_refs || [],
    });
  }, [selectedVideoId]);

  const copyMeaningNetworkItemContent = useCallback((item: MeaningNetworkNode | MeaningNetworkEdge, kind: "node" | "edge") => {
    const content: MeaningNetworkCopiedContent = kind === "node"
      ? {
          kind,
          label: renamedMeaningNetworkMarkers[(item as MeaningNetworkNode).node_id] || (item as MeaningNetworkNode).label,
          description: (item as MeaningNetworkNode).description,
          node_type: (item as MeaningNetworkNode).node_type,
          attributes: (item as MeaningNetworkNode).attributes,
          maturity: (item as MeaningNetworkNode).maturity,
          evidence_refs: (item as MeaningNetworkNode).evidence_refs || [],
        }
      : {
          kind,
          edge_type: (item as MeaningNetworkEdge).edge_type,
          maturity: (item as MeaningNetworkEdge).maturity,
          evidence_refs: (item as MeaningNetworkEdge).evidence_refs || [],
        };
    setCopiedMeaningNetworkContent(content);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(JSON.stringify(content, null, 2)).catch(() => undefined);
    }
    eventBus.emit("meaningNetworkContentCopied", {
      videoId: selectedVideoId,
      kind,
      content,
    });
  }, [renamedMeaningNetworkMarkers, selectedVideoId]);

  const pasteMeaningNetworkContentOntoNode = useCallback((targetNode: MeaningNetworkNode) => {
    if (!copiedMeaningNetworkContent) return;
    const label = copiedMeaningNetworkContent.label?.trim();
    if (label) {
      setRenamedMeaningNetworkMarkers((current) => ({ ...current, [targetNode.node_id]: label }));
    }
    const sourceRefs = copiedMeaningNetworkContent.evidence_refs || [];
    if (sourceRefs.length) {
      setDraftMeaningNetworkNodes((current) =>
        current.map((node) =>
          node.node_id === targetNode.node_id
            ? {
                ...node,
                description: copiedMeaningNetworkContent.description || node.description,
                attributes: {
                  ...(node.attributes || {}),
                  pasted_content_from: copiedMeaningNetworkContent.kind,
                  ...(copiedMeaningNetworkContent.attributes || {}),
                },
                evidence_refs: [...sourceRefs, ...(node.evidence_refs || [])],
              }
            : node,
        ),
      );
    }
    eventBus.emit("meaningNetworkContentPasted", {
      videoId: selectedVideoId,
      target_node_id: targetNode.node_id,
      copied_kind: copiedMeaningNetworkContent.kind,
      applied_label: label,
      evidence_refs: sourceRefs,
    });
  }, [copiedMeaningNetworkContent, selectedVideoId]);

  const pasteMeaningNetworkEdgeDuplicate = useCallback(() => {
    if (!copiedMeaningNetworkEdge) return;
    const pasted: MeaningNetworkEdge = {
      ...copiedMeaningNetworkEdge,
      edge_id: `copy:${copiedMeaningNetworkEdge.edge_id}:${Date.now()}`,
      edge_type: copiedMeaningNetworkEdge.edge_type || "copy_of_anchor",
      maturity: { ...(copiedMeaningNetworkEdge.maturity || {}), level: "analyst_reviewed", authority: "analyst" },
      evidence_refs: [
        {
          evidence_id: `copy:${copiedMeaningNetworkEdge.edge_id}`,
          source_type: "manual_annotation",
          time_range: meaningNetworkEvidenceTimeRange(copiedMeaningNetworkEdge.evidence_refs) || undefined,
          traceback_record_id: `traceback:copy:${copiedMeaningNetworkEdge.edge_id}`,
        },
        ...(copiedMeaningNetworkEdge.evidence_refs || []),
      ],
      ui: {
        ...(copiedMeaningNetworkEdge.ui || {}),
        quick_confirm_enabled: true,
        copy_paste_enabled: true,
        update_enabled: true,
        source_navigation_enabled: true,
      },
    };
    setDraftMeaningNetworkEdges((current) => [pasted, ...current]);
    eventBus.emit("meaningNetworkEdgePasted", {
      videoId: selectedVideoId,
      source_edge_id: copiedMeaningNetworkEdge.edge_id,
      target_edge_id: pasted.edge_id,
      edge_type: pasted.edge_type,
    });
  }, [copiedMeaningNetworkEdge, selectedVideoId]);

  const addMeaningNetworkNodeAtScene = useCallback((nodeType: string) => {
    const start = activeMeaningNetworkScene?.start ?? activeScene?.start ?? 0;
    const end = activeMeaningNetworkScene?.end ?? activeScene?.end ?? start;
    const laneId = meaningNetworkLaneIdForNodeType(nodeType);
    const presenceMode = meaningNetworkPresenceModeForNodeType(nodeType);
    const node: MeaningNetworkNode = {
      node_id: `draft:${nodeType}:${Date.now()}`,
      node_type: nodeType,
      label: `${meaningNetworkNodeKindLabel(nodeType)} candidate`,
      description: "Analyst-created Meaning Network node. Confirm or rename before mature proliferation.",
      attributes: {
        scene_key: activeSceneKey,
        analyst_created: true,
        lane_id: laneId,
        presence_mode: presenceMode,
      },
      maturity: { level: "analyst_reviewed", authority: "analyst", confidence: 1 },
      evidence_refs: [
        {
          evidence_id: `manual:${nodeType}:${Date.now()}`,
          source_type: "manual_annotation",
          time_range: { start, end },
          traceback_record_id: `traceback:manual:${nodeType}`,
        },
      ],
      ui: {
        display_group: "analyst_added_nodes",
        quick_confirm_enabled: true,
        copy_paste_enabled: true,
        update_enabled: true,
        source_navigation_enabled: true,
      },
    };
    setDraftMeaningNetworkNodes((current) => [node, ...current]);
    eventBus.emit("meaningNetworkNodeAdded", { videoId: selectedVideoId, node });
  }, [activeMeaningNetworkScene?.end, activeMeaningNetworkScene?.start, activeScene?.end, activeScene?.start, activeSceneKey, selectedVideoId]);

  const addMeaningNetworkLane = useCallback(async () => {
    const label = window.prompt("Add Meaning Network timeline lane", "Off-camera threat");
    const trimmed = label?.trim();
    if (!trimmed || !selectedVideoId) return;
    const lane: MeaningNetworkLane = {
      lane_id: `custom:${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_")}:${Date.now()}`,
      label: trimmed,
    };
    setDraftMeaningNetworkLanes((current) => [...current, lane]);
    const existing = analysisData?.annotationCorrections || {};
    const now = new Date().toISOString();
    const nextCorrections: AnnotationCorrections = {
      ...existing,
      analysis_id: selectedVideoId,
      version: 1,
      updated_at: now,
      updated_by: "analyst",
      text_substitutions: existing.text_substitutions || [],
      label_overrides: existing.label_overrides || [],
      manual_transcript_entries: existing.manual_transcript_entries || [],
      manual_visual_annotations: existing.manual_visual_annotations || [],
      proliferation_decisions: existing.proliferation_decisions || [],
      master_schema_presence_intervals: existing.master_schema_presence_intervals || [],
      meaning_network_custom_lanes: [
        ...(existing.meaning_network_custom_lanes || []),
        { lane_id: lane.lane_id, label: lane.label, created_by: "analyst", updated_at: now },
      ],
    };
    await VideoService.saveAnnotationCorrections(selectedVideoId, nextCorrections);
    const refreshed = await VideoService.refreshAnalysis(selectedVideoId);
    setAnalysisData(refreshed);
    eventBus.emit("meaningNetworkLaneAdded", {
      videoId: selectedVideoId,
      lane,
      event_type: "master_schema_updated",
      update_source: "meaning_network_lane_tooling",
      update_authority: "manual_correction",
    });
  }, [analysisData?.annotationCorrections, selectedVideoId]);

  const addMeaningNetworkSceneAtTimeline = useCallback(() => {
    const lastSceneEnd = Math.max(0, ...meaningNetworkSceneSegments.map((scene) => Number(scene.end || 0)));
    const seedScene = activeMeaningNetworkScene || activeScene;
    const duration = Math.max(1, Number(seedScene?.duration || 5));
    const start = seedScene ? Math.max(Number(seedScene.start || 0), Number(seedScene.end || 0)) : lastSceneEnd;
    const scene: MeaningSceneSegment = {
      scene_index: Math.max(0, ...meaningNetworkSceneSegments.map((item) => Number(item.scene_index || 0))) + 1,
      start,
      end: start + duration,
      duration,
    };
    setDraftMeaningNetworkScenes((current) => [...current, scene]);
    setFocusedMeaningNetworkSceneKey(meaningNetworkSceneKey(scene));
    setMeaningNetworkViewMode("graph");
    eventBus.emit("meaningNetworkSceneAdded", {
      videoId: selectedVideoId,
      scene_key: meaningNetworkSceneKey(scene),
      time_range: { start: scene.start, end: scene.end },
      maturity_result: "analyst_reviewed_scene_boundary",
    });
  }, [activeMeaningNetworkScene, activeScene, meaningNetworkSceneSegments, selectedVideoId]);

  const deleteFocusedMeaningNetworkScene = useCallback(() => {
    const sceneKey = focusedMeaningNetworkSceneKey || activeSceneKey;
    setHiddenMeaningNetworkScenes((current) => ({ ...current, [sceneKey]: true }));
    setDraftMeaningNetworkScenes((current) =>
      current.filter((scene, index) => meaningNetworkSceneKey(scene, index) !== sceneKey),
    );
    setFocusedMeaningNetworkSceneKey(null);
    eventBus.emit("meaningNetworkSceneDeleted", {
      videoId: selectedVideoId,
      scene_key: sceneKey,
      maturity_result: "analyst_removed_scene_from_network_view",
    });
  }, [activeSceneKey, focusedMeaningNetworkSceneKey, selectedVideoId]);

  const pasteMeaningNetworkNodeAtScene = useCallback(() => {
    if (!copiedMeaningNetworkNode) {
      return;
    }
    const start = activeMeaningNetworkScene?.start ?? activeScene?.start ?? meaningNetworkEvidenceStart(copiedMeaningNetworkNode.evidence_refs);
    const end = activeMeaningNetworkScene?.end ?? activeScene?.end ?? start;
    const pasted: MeaningNetworkNode = {
      ...copiedMeaningNetworkNode,
      node_id: `copy:${copiedMeaningNetworkNode.node_id}:${Date.now()}`,
      label: renamedMeaningNetworkMarkers[copiedMeaningNetworkNode.node_id] || copiedMeaningNetworkNode.label,
      attributes: {
        ...(copiedMeaningNetworkNode.attributes || {}),
        copied_from_node_id: copiedMeaningNetworkNode.node_id,
        scene_key: activeSceneKey,
        analyst_pasted_to_coordinate: true,
      },
      maturity: { level: "analyst_reviewed", authority: "analyst", confidence: 1 },
      evidence_refs: [
        {
          evidence_id: `copy:${copiedMeaningNetworkNode.node_id}`,
          source_type: "manual_annotation",
          time_range: { start, end },
          traceback_record_id: `traceback:copy:${copiedMeaningNetworkNode.node_id}`,
        },
        ...(copiedMeaningNetworkNode.evidence_refs || []),
      ],
      ui: {
        ...(copiedMeaningNetworkNode.ui || {}),
        display_group: "analyst_pasted_nodes",
        quick_confirm_enabled: true,
        copy_paste_enabled: true,
        update_enabled: true,
        source_navigation_enabled: true,
      },
    };
    setDraftMeaningNetworkNodes((current) => [pasted, ...current]);
    eventBus.emit("meaningNetworkAnchorPasted", {
      videoId: selectedVideoId,
      source_node_id: copiedMeaningNetworkNode.node_id,
      target_node_id: pasted.node_id,
      target_time: start,
      creates_edge_type: "copy_of_anchor",
    });
  }, [activeMeaningNetworkScene?.end, activeMeaningNetworkScene?.start, activeScene?.end, activeScene?.start, activeSceneKey, copiedMeaningNetworkNode, renamedMeaningNetworkMarkers, selectedVideoId]);

  const renameMeaningNetworkNode = useCallback((node: MeaningNetworkNode) => {
    if (typeof window === "undefined") {
      return;
    }
    const nextLabel = window.prompt("Rename Meaning Network node", renamedMeaningNetworkMarkers[node.node_id] || node.label);
    if (!nextLabel || !nextLabel.trim()) {
      return;
    }
    setRenamedMeaningNetworkMarkers((current) => ({ ...current, [node.node_id]: nextLabel.trim() }));
    eventBus.emit("meaningNetworkNodeRenamed", {
      videoId: selectedVideoId,
      node_id: node.node_id,
      label: nextLabel.trim(),
      evidence_refs: node.evidence_refs || [],
    });
  }, [renamedMeaningNetworkMarkers, selectedVideoId]);

  const participantGroups = useMemo(
    () =>
      sortParticipantGroupsByArchetype(
        buildParticipantGroupsWithMetadataProfiles(characterInstructions, narrativeAgentProfiles),
        activeArchetypeLens,
      ),
    [characterInstructions, narrativeAgentProfiles, activeArchetypeLens],
  );
  const activeArchetype = DRAMATIC_ARCHETYPE_LENSES.find(
    (lens) => lens.id === activeArchetypeLens,
  ) || DRAMATIC_ARCHETYPE_LENSES[0];
  const characterPathReadingsByAgent = useMemo(() => {
    const groups = new Map<string, InterpretiveReading[]>();
    for (const reading of characterPathReadings) {
      if (!readingCanSurface(reading)) continue;
      const label =
        reading.narrative_agent?.current_label ||
        reading.narrative_agent?.profile_key ||
        "Narrative Agent";
      groups.set(label, [...(groups.get(label) || []), reading]);
    }
    return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [characterPathReadings]);
  const scenePresenceReadings = useMemo(
    () =>
      characterPathReadings
        .filter((reading) => reading.reading_type === "scene_presence")
        .filter(readingCanSurface)
        .sort((left, right) => readingStartSeconds(left) - readingStartSeconds(right)),
    [characterPathReadings],
  );
  const activeArchetypeMatches = archetypeMatches(characterInstructions, activeArchetypeLens);
  const strongestArchetypeParticipant = participantGroups.find(
    ([, items]) => archetypeScore(items, activeArchetypeLens) > 0,
  );
  const sceneAgentRows = useMemo(() => {
    if (!activeScene) return [];
    return narrativeAgentProfiles.map((profile, index) => {
      const profileKey = narrativeAgentProfileKey(profile, index);
      const aliases = narrativeAgentProfileAliases(profile);
      const sceneInstructions = instructions.filter(
        (instruction) =>
          instructionOverlapsScene(instruction, activeScene) &&
          (instruction.participants_involved || []).some((participant) =>
            aliases.some((alias) => {
              const participantKey = normalizeAgentKey(participant);
              return participantKey === alias || participantKey.includes(alias) || alias.includes(participantKey);
            }),
          ),
      );
      const persistenceSignals = agentPersistenceInstructionsForParticipant(
        instructions.filter((instruction) => instructionOverlapsScene(instruction, activeScene)),
        profile.narrative_agent_name || profile.attached_performer_metadata?.actor_name || profileKey,
      );
      const lines = (analysisData?.transcriptTimeline || analysisData?.transcript || [])
        .filter((line) => line.start <= activeScene.end && line.end >= activeScene.start)
        .filter((line) => lineMatchesProfile(line, profile, sourceMediaMetadata))
        .slice(0, 4);
      const manualAnnotations = manualAnnotationsForProfileInScene(
        analysisData?.annotations,
        profile,
        activeScene,
      ).slice(0, 6);
      const audioProsody = audioProsodyForProfileInScene(
        analysisData?.audioProsody,
        profile,
        activeScene,
        analysisData?.transcriptTimeline || analysisData?.transcript || [],
        sourceMediaMetadata,
      ).slice(0, 4);
      const sourceSamples = sourceSamplesForProfileInScene(
        analysisData?.sourceSamples,
        profile,
        activeScene,
        manualAnnotations,
      ).slice(0, 4);
      const expressions = expressionSamplesForSceneAgent(
        analysisData?.expressionResults || [],
        activeScene,
        sceneInstructions,
      );
      const staged = (stagedSceneAgents[activeSceneKey] || []).includes(profileKey);
      const present =
        sceneInstructions.length > 0 ||
        persistenceSignals.length > 0 ||
        lines.length > 0 ||
        manualAnnotations.length > 0 ||
        audioProsody.length > 0 ||
        sourceSamples.length > 0;
      return {
        profile,
        profileKey,
        status: staged ? "staged" : present ? "surfaced" : "not surfaced",
        sceneInstructions,
        persistenceSignals,
        lines,
        manualAnnotations,
        audioProsody,
        sourceSamples,
        expressions,
      };
    });
  }, [
    analysisData?.annotations,
    analysisData?.audioProsody,
    activeScene,
    activeSceneKey,
    analysisData?.expressionResults,
    analysisData?.sourceSamples,
    analysisData?.transcript,
    analysisData?.transcriptTimeline,
    instructions,
    narrativeAgentProfiles,
    sourceMediaMetadata,
    stagedSceneAgents,
  ]);

  const addProfileToScene = useCallback((profileKey: string) => {
    setStagedSceneAgents((current) => {
      const existing = current[activeSceneKey] || [];
      if (existing.includes(profileKey)) return current;
      return { ...current, [activeSceneKey]: [...existing, profileKey] };
    });
  }, [activeSceneKey]);

  const removeProfileFromScene = useCallback((profileKey: string) => {
    setStagedSceneAgents((current) => ({
      ...current,
      [activeSceneKey]: (current[activeSceneKey] || []).filter((item) => item !== profileKey),
    }));
  }, [activeSceneKey]);

  const toggleProfileSceneActivation = useCallback((sceneKey: string, profileKey: string) => {
    setStagedSceneAgents((current) => {
      const existing = current[sceneKey] || [];
      if (existing.includes(profileKey)) {
        return {
          ...current,
          [sceneKey]: existing.filter((item) => item !== profileKey),
        };
      }
      return {
        ...current,
        [sceneKey]: [...existing, profileKey],
      };
    });
  }, []);

  const characterSceneGovernanceRows = useMemo<CharacterSceneGovernanceRow[]>(() => {
    const rows: CharacterSceneGovernanceRow[] = narrativeAgentProfiles.map((profile, index) => {
      const profileKey = narrativeAgentProfileKey(profile, index);
      const aliases = narrativeAgentProfileAliases(profile);
      const scenes = sceneSegments.map((scene, sceneIndex) => {
        const sceneKey = String(scene.scene_index ?? sceneIndex + 1);
        const sceneInstructions = instructions.filter(
          (instruction) =>
            instructionOverlapsScene(instruction, scene) &&
            (instruction.participants_involved || []).some((participant) =>
              aliases.some((alias) => {
                const participantKey = normalizeAgentKey(participant);
                return participantKey === alias || participantKey.includes(alias) || alias.includes(participantKey);
              }),
            ),
        );
        const lines = (analysisData?.transcriptTimeline || analysisData?.transcript || [])
          .filter((line) => line.start <= scene.end && line.end >= scene.start)
          .filter((line) => lineMatchesProfile(line, profile, sourceMediaMetadata));
        const manualAnnotations = manualAnnotationsForProfileInScene(
          analysisData?.annotations,
          profile,
          scene,
        );
        const audioProsody = audioProsodyForProfileInScene(
          analysisData?.audioProsody,
          profile,
          scene,
          analysisData?.transcriptTimeline || analysisData?.transcript || [],
          sourceMediaMetadata,
        );
        const sourceSamples = sourceSamplesForProfileInScene(
          analysisData?.sourceSamples,
          profile,
          scene,
          manualAnnotations,
        );
        const persistenceSignals = agentPersistenceInstructionsForParticipant(
          instructions.filter((instruction) => instructionOverlapsScene(instruction, scene)),
          profile.narrative_agent_name || profile.attached_performer_metadata?.actor_name || profileKey,
        );
        const staged = (stagedSceneAgents[sceneKey] || []).includes(profileKey);
        const surfaced =
          sceneInstructions.length > 0 ||
          lines.length > 0 ||
          manualAnnotations.length > 0 ||
          audioProsody.length > 0 ||
          sourceSamples.length > 0 ||
          persistenceSignals.length > 0;
        return {
          scene,
          sceneIndex,
          sceneKey,
          staged,
          surfaced,
          sceneInstructions,
          lines,
          manualAnnotations,
          audioProsody,
          sourceSamples,
          persistenceSignals,
        };
      });
      return {
        label: formatNarrativeAgentProfileBrief(profile),
        profile,
        profileKey,
        scenes,
      };
    });
    const knownProfileAliases = new Set(
      narrativeAgentProfiles.flatMap((profile) => narrativeAgentProfileAliases(profile)),
    );
    const participantRows: CharacterSceneGovernanceRow[] = narrativeAgentProfiles.length
      ? []
      : participantGroups
      .filter(([participant]) => {
        const participantKey = normalizeAgentKey(participant);
        return (
          participantKey &&
          !isUnknownAgentLabel(participantKey) &&
          !knownProfileAliases.has(participantKey) &&
          !narrativeAgentProfiles.some((profile) => profileMatchesParticipant(profile, participant))
        );
      })
      .map(([participant]) => {
        const participantKey = normalizeAgentKey(participant);
        const profileKey = `participant:${participantKey || participant}`;
        const scenes = sceneSegments.map((scene, sceneIndex) => {
          const sceneKey = String(scene.scene_index ?? sceneIndex + 1);
          const sceneInstructions = instructions.filter(
            (instruction) =>
              instructionOverlapsScene(instruction, scene) &&
              (instruction.participants_involved || []).some((candidate) => {
                const candidateKey = normalizeAgentKey(candidate);
                return (
                  candidateKey === participantKey ||
                  candidateKey.includes(participantKey) ||
                  participantKey.includes(candidateKey)
                );
              }),
          );
          const lines = (analysisData?.transcriptTimeline || analysisData?.transcript || [])
            .filter((line) => line.start <= scene.end && line.end >= scene.start)
            .filter((line) => normalizeAgentKey(line.speaker).includes(participantKey));
          const manualAnnotations: Array<Record<string, any>> = [];
          const audioProsody: Array<Record<string, any>> = [];
          const sourceSamples: Array<Record<string, any>> = [];
          const persistenceSignals = agentPersistenceInstructionsForParticipant(
            instructions.filter((instruction) => instructionOverlapsScene(instruction, scene)),
            participant,
          );
          const staged = (stagedSceneAgents[sceneKey] || []).includes(profileKey);
          const surfaced = sceneInstructions.length > 0 || lines.length > 0 || persistenceSignals.length > 0;
          return {
            scene,
            sceneIndex,
            sceneKey,
            staged,
            surfaced,
            sceneInstructions,
            lines,
            manualAnnotations,
            audioProsody,
            sourceSamples,
            persistenceSignals,
          };
        });
        return {
          label: participant,
          profileKey,
          scenes,
        };
      });

    return [...rows, ...participantRows].sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [
    analysisData?.transcript,
    analysisData?.transcriptTimeline,
    analysisData?.annotations,
    analysisData?.audioProsody,
    analysisData?.sourceSamples,
    instructions,
    narrativeAgentProfiles,
    participantGroups,
    sceneSegments,
    sourceMediaMetadata,
    stagedSceneAgents,
  ]);

  const toggleCharacterSceneProfile = useCallback((profileKey: string) => {
    setOpenCharacterSceneProfiles((current) => ({
      ...current,
      [profileKey]: !current[profileKey],
    }));
  }, []);

  const openNarrativeAgentPaths = useCallback(() => {
    eventBus.emit("openPanelRequest", {
      panelType: "ManualIdentification",
      panelProps: selectedVideoId ? { videoId: selectedVideoId } : {},
    });
  }, [selectedVideoId]);

  return (
    <div className="flex h-full flex-col bg-[#161616] text-slate-100">
      <div className="border-b border-white/8 bg-[#141414] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Meaning / Plot
            </div>
            <div className="mt-1 truncate text-[11px] text-slate-500">
              Review plot claims, compare lenses, and jump every candidate back to source evidence.
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            {instructions.length} candidates / {activeNarrativeLensReadings.length || plotInstructions.length} in current lens
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {PLOT_LENSES.map((lens) => (
            <button
              key={lens.id}
              type="button"
              onClick={() => setActiveLens(lens.id)}
              className={`rounded border px-2 py-1 text-[11px] ${
                activeLens === lens.id
                  ? "border-cyan-600/60 bg-cyan-950/35 text-cyan-100"
                  : "border-white/10 bg-[#101010] text-slate-400 hover:bg-white/5"
              }`}
            >
              {lens.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3" data-vaa1-meaning-plot-panel-scroll="true">
        <MeaningPlotConfirmationStrip analysisData={analysisData} />
        {loading ? (
          <div className="grid h-full min-h-0 min-w-[980px] grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-3">
            <section className="flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]">
              <div className="border-b border-white/8 px-3 py-2">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-800"></div>
                <div className="mt-2 h-2 w-48 animate-pulse rounded bg-slate-800"></div>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={`plot-skel-${i}`} className="h-[52px] w-full animate-pulse rounded border border-slate-800 bg-[#101010] px-2.5 py-2">
                    <div className="h-3 w-1/2 rounded bg-slate-700/50"></div>
                    <div className="mt-2 h-2 w-1/3 rounded bg-slate-800"></div>
                  </div>
                ))}
              </div>
            </section>
            <section className="flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]">
              <div className="border-b border-white/8 px-3 py-2">
                <div className="h-3 w-32 animate-pulse rounded bg-slate-800"></div>
                <div className="mt-2 h-2 w-56 animate-pulse rounded bg-slate-800"></div>
              </div>
              <div className="flex-1 space-y-3 p-2">
                {[1, 2].map((i) => (
                  <div key={`char-skel-${i}`} className="rounded border border-slate-800 bg-[#101010]/60">
                    <div className="border-b border-slate-800 px-2.5 py-2">
                      <div className="h-2 w-20 animate-pulse rounded bg-slate-800"></div>
                    </div>
                    <div className="space-y-1.5 p-1.5">
                      {[1, 2, 3].map((j) => (
                        <div key={`char-skel-item-${j}`} className="h-[52px] w-full animate-pulse rounded border border-slate-800 bg-[#101010] px-2.5 py-2">
                          <div className="h-3 w-1/2 rounded bg-slate-700/50"></div>
                          <div className="mt-2 h-2 w-1/3 rounded bg-slate-800"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : !selectedVideoId ? (
          <div className="rounded border border-white/8 bg-[#121212] px-4 py-4 text-sm text-slate-400">
            Open an analysis to view meaning and plot paths.
          </div>
        ) : !hasMeaningPlotSurface ? (
          <div className="rounded border border-white/8 bg-[#121212] px-4 py-4 text-sm text-slate-400">
            No second-order meaning candidates surfaced for this analysis yet.
          </div>
        ) : (
          <div className="flex min-h-full min-w-[980px] flex-col gap-3">
            <section
              className="rounded border border-cyan-900/40 bg-cyan-950/10 px-3 py-2"
              data-vaa1-meaning-plot-operational-workbench="true"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                    Analyst moves
                  </div>
                  <div className="mt-0.5 max-w-3xl text-[10px] leading-relaxed text-slate-400">
                    Treat candidates as reviewable claims: inspect the source, compare lens fit,
                    check agent scene presence, then confirm, correct, or leave as tentative support.
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => scrollCharacterPathSection(plotPathRef)}
                    className="rounded border border-cyan-700/60 bg-[#101010] px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/25"
                  >
                    Review plot claims
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCharacterPathSection(sceneAgentBrowserRef)}
                    className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                  >
                    Check scene agents
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCharacterPathSection(dramaticArchetypeReadingsRef)}
                    className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                  >
                    Test archetypes
                  </button>
                  <button
                    type="button"
                    onClick={openNarrativeAgentPaths}
                    className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                  >
                    Open agent paths
                  </button>
                </div>
              </div>
              {meaningNetworkSaveFeedback ? (
                <div
                  className={`mt-2 rounded border px-2.5 py-2 ${
                    meaningNetworkSaveFeedback.status === "saved"
                      ? "border-emerald-800/70 bg-emerald-950/20"
                      : meaningNetworkSaveFeedback.status === "staged"
                        ? "border-amber-800/70 bg-amber-950/20"
                        : "border-rose-900/70 bg-rose-950/20"
                  }`}
                  data-vaa1-meaning-network-proliferation-feedback="true"
                  data-vaa1-meaning-network-save-state={meaningNetworkSaveFeedback.status}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-100">
                        {meaningNetworkSaveFeedback.message}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-relaxed text-slate-300">
                        {meaningNetworkSaveFeedback.detail}
                      </div>
                    </div>
                    <div className="shrink-0 rounded border border-emerald-800/70 bg-[#101010] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-emerald-200">
                      Data Maturity Proliferation
                    </div>
                  </div>
                  <div className="mt-1 text-[9px] text-slate-500">
                    Saved correction bundle / {new Date(meaningNetworkSaveFeedback.updatedAt).toLocaleTimeString()}
                  </div>
                </div>
              ) : null}
              <div className="mt-2 grid gap-1.5 md:grid-cols-4">
                <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">current lens</div>
                  <div className="mt-0.5 text-[11px] text-slate-200">
                    {PLOT_LENSES.find((lens) => lens.id === activeLens)?.label}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">review queue</div>
                  <div className="mt-0.5 text-[11px] text-slate-200">
                    {activeNarrativeLensReadings.length || plotInstructions.length} plot readings
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">scene grounding</div>
                  <div className="mt-0.5 text-[11px] text-slate-200">{sceneSegments.length} governed scenes</div>
                </div>
                <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">agent context</div>
                  <div className="mt-0.5 text-[11px] text-slate-200">
                    {characterPathReadings.length || characterSceneGovernanceRows.length} paths
                  </div>
                </div>
              </div>
            </section>

            <section
              className={
                dedicatedMeaningNetworkPanel
                  ? "flex h-full min-h-[620px] resize flex-col overflow-auto rounded border border-teal-700/60 bg-[#080b0b] px-4 py-3"
                  : meaningNetworkExpanded
                  ? "fixed left-4 top-4 z-50 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] resize overflow-auto rounded border border-teal-700/60 bg-[#080b0b] px-4 py-3 shadow-2xl shadow-black/70"
                  : "max-h-[calc(100vh-170px)] overflow-auto rounded border border-teal-900/40 bg-teal-950/10 px-3 py-2"
              }
              data-vaa1-meaning-network-panel-tools="true"
              data-vaa1-meaning-network-bounded-workbench="true"
              data-vaa1-meaning-network-expanded={meaningNetworkExpanded ? "true" : "false"}
              data-vaa1-meaning-network-dedicated-panel={dedicatedMeaningNetworkPanel ? "true" : "false"}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-teal-200">
                    Datascene Meaning Network
                  </div>
                  <div className="mt-0.5 max-w-3xl text-[10px] leading-relaxed text-slate-400">
                    Fast manual graph work: confirm source-linked nodes, add new nodes at the current scene coordinate,
                    copy known nodes, paste linked duplicates, and jump every marker back to video evidence.
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  {[
                    ["graph", "Graph"],
                    ["whole_timeline", "Whole timeline"],
                    ["scene_timeline", "Scene timeline"],
                    ["character_timeline", "Character timeline"],
                  ].map(([mode, label]) => (
                    <button
                      key={`meaning-network-view:${mode}`}
                      type="button"
                      onClick={() => setMeaningNetworkViewMode(mode as MeaningNetworkViewMode)}
                      className={`rounded border px-2 py-1 text-[10px] ${
                        meaningNetworkViewMode === mode
                          ? "border-teal-500 bg-teal-950/40 text-teal-100"
                          : "border-slate-700 bg-[#101010] text-slate-300 hover:border-teal-700 hover:text-teal-100"
                      }`}
                      data-vaa1-meaning-network-view-mode={mode}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMeaningNetworkExpanded((value) => !value)}
                    disabled={dedicatedMeaningNetworkPanel}
                    className="rounded border border-cyan-700/70 bg-[#101010] px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/25"
                    data-vaa1-meaning-network-expand-toggle="true"
                  >
                    {dedicatedMeaningNetworkPanel ? "Dedicated panel" : meaningNetworkExpanded ? "Collapse" : "Expand"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      eventBus.emit("openPanelRequest", {
                        panelType: "MeaningNetwork",
                        panelProps: {
                          videoId: selectedVideoId,
                          initialMeaningNetworkExpanded: true,
                          initialMeaningNetworkViewMode: "graph",
                          forceNewPanel: true,
                        },
                      });
                    }}
                    className="rounded border border-cyan-700/70 bg-[#101010] px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/25"
                    data-vaa1-meaning-network-open-own-panel="true"
                  >
                    Open workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusedMeaningNetworkSceneKey(null)}
                    disabled={!focusedMeaningNetworkSceneKey}
                    className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                    data-vaa1-meaning-network-show-all-scenes="true"
                  >
                    Show all scenes
                  </button>
                  <button
                    type="button"
                    onClick={addMeaningNetworkSceneAtTimeline}
                    className="rounded border border-teal-700/60 bg-[#101010] px-2 py-1 text-[10px] text-teal-100 hover:bg-teal-950/25"
                    data-vaa1-meaning-network-add-scene="true"
                  >
                    + Scene
                  </button>
                  <button
                    type="button"
                    onClick={deleteFocusedMeaningNetworkScene}
                    disabled={!focusedMeaningNetworkSceneKey && !activeScene}
                    className="rounded border border-rose-900/70 bg-[#101010] px-2 py-1 text-[10px] text-rose-100 hover:bg-rose-950/25 disabled:cursor-not-allowed disabled:opacity-40"
                    data-vaa1-meaning-network-delete-scene="true"
                  >
                    Delete scene
                  </button>
                  {[
                    "+ Character",
                    "+ Narrative Agent",
                    "+ Off-camera Presence",
                    "+ Object",
                    "+ Spoken Word",
                    "+ Prosody",
                    "+ Music",
                    "+ Location",
                    "+ Situation",
                    "+ Continuity Anchor",
                  ].map((label) => (
                    <button
                      key={`meaning-network-add:${label}`}
                      type="button"
                      onClick={() => addMeaningNetworkNodeAtScene(label.replace("+ ", "").toLowerCase().replace(/[^a-z0-9]+/g, "_"))}
                      className="rounded border border-teal-700/60 bg-[#101010] px-2 py-1 text-[10px] text-teal-100 hover:bg-teal-950/25"
                      data-vaa1-meaning-network-add-node="true"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={addMeaningNetworkLane}
                    className="rounded border border-cyan-800/70 bg-[#101010] px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/25"
                    data-vaa1-meaning-network-add-lane="true"
                  >
                    + Lane
                  </button>
                  <button
                    type="button"
                    onClick={pasteMeaningNetworkNodeAtScene}
                    disabled={!copiedMeaningNetworkNode}
                    className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-teal-700 hover:text-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
                    data-vaa1-meaning-network-paste-anchor="true"
                  >
                    Paste copied node
                  </button>
                </div>
              </div>
              <div
                className="mt-2 rounded border border-slate-800 bg-[#080b0b] p-2"
                data-vaa1-meaning-network-graph-panel="true"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                    {meaningNetworkViewMode === "graph" && "Network graph"}
                    {meaningNetworkViewMode === "whole_timeline" && "Whole timeline"}
                    {meaningNetworkViewMode === "scene_timeline" && "Scene timeline"}
                    {meaningNetworkViewMode === "character_timeline" && "Character timeline"}
                  </div>
                  <div className="text-[9px] text-teal-200">
                    {meaningNetworkGraph.nodes.length} nodes / {meaningNetworkGraph.edges.length} edges
                  </div>
                </div>
                {meaningNetworkViewMode === "graph" && (
                  <div className="mb-1.5 flex flex-wrap items-center gap-1" data-vaa1-meaning-network-zoom-controls="true">
                    <button
                      type="button"
                      onClick={() => changeMeaningNetworkZoom(-0.18)}
                      className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-teal-700 hover:text-teal-100"
                      data-vaa1-meaning-network-zoom-out="true"
                    >
                      Zoom out
                    </button>
                    <button
                      type="button"
                      onClick={() => changeMeaningNetworkZoom(0.18)}
                      className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-teal-700 hover:text-teal-100"
                      data-vaa1-meaning-network-zoom-in="true"
                    >
                      Zoom in
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeaningNetworkZoom(1)}
                      className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-teal-700 hover:text-teal-100"
                      data-vaa1-meaning-network-zoom-reset="true"
                    >
                      Reset
                    </button>
                    <div className="rounded border border-slate-800 bg-[#101010] px-2 py-1 text-[10px] text-slate-400">
                      {Math.round(meaningNetworkZoom * 100)}%
                    </div>
                    <div
                      className="rounded border border-teal-900/60 bg-[#101010] px-2 py-1 text-[10px] text-teal-100"
                      data-vaa1-meaning-network-synced-cursor-readout="true"
                    >
                      Cursor {formatTime(meaningNetworkCursorSeconds)}
                    </div>
                  </div>
                )}
                {meaningNetworkViewMode === "graph" && meaningNetworkGraph.nodes.length > 0 ? (
                  <div
                    className={`${meaningNetworkExpanded ? "h-[calc(100vh-260px)] min-h-[520px]" : "h-[280px]"} overflow-auto rounded bg-[#050707]`}
                    onWheel={handleMeaningNetworkWheelZoom}
                    data-vaa1-meaning-network-scrollable-graph="true"
                    data-vaa1-meaning-network-wheel-zoom="true"
                    data-vaa1-meaning-network-resizable-workspace={meaningNetworkExpanded ? "true" : "false"}
                  >
                  <svg
                    ref={meaningNetworkGraphSvgRef}
                    viewBox={`0 0 ${meaningNetworkGraph.width} ${meaningNetworkGraph.height}`}
                    className="max-w-none rounded bg-[#050707]"
                    style={{
                      width: `${meaningNetworkGraph.width * meaningNetworkZoom}px`,
                      height: `${meaningNetworkGraph.height * meaningNetworkZoom}px`,
                      minWidth: "100%",
                    }}
                    role="img"
                    aria-label="Datascene Meaning Network graph"
                    onPointerDown={seekMeaningNetworkCursorFromPointer}
                    onPointerMove={updateMeaningNetworkPresenceDrag}
                    onPointerUp={endMeaningNetworkPresenceDrag}
                    onPointerLeave={endMeaningNetworkPresenceDrag}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={meaningNetworkGraph.width}
                      height={meaningNetworkGraph.height}
                      fill="transparent"
                      data-vaa1-meaning-network-clickable-timefield="true"
                      data-vaa1-meaning-network-video-sync-cursor="true"
                    />
                    {meaningNetworkGraph.laneBands.map((band) => (
                      <g
                        key={`graph-lane:${band.lane.lane_id}`}
                        data-vaa1-meaning-network-lane="true"
                        data-vaa1-meaning-network-analyst-track="true"
                      >
                        <rect
                          x={0}
                          y={band.y - 18}
                          width={meaningNetworkGraph.width}
                          height={band.height}
                          fill={band.lane.lane_id === "off_camera_presence" ? "#1e1b4b" : "#020617"}
                          opacity={band.lane.lane_id === "scene" ? 0.22 : 0.13}
                        />
                        <text x={12} y={band.y - 3} className="fill-slate-500 text-[9px]">
                          {band.lane.label}
                        </text>
                      </g>
                    ))}
                    {meaningNetworkGraph.sceneBands.map((band) => (
                      <g
                        key={`graph-scene-band:${band.node.node_id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          const sceneKey = String(band.node.attributes?.scene_key || band.node.attributes?.scene_index || "");
                          setFocusedMeaningNetworkSceneKey(sceneKey || null);
                          const nextIndex = meaningNetworkSceneSegments.findIndex(
                            (scene, index) => meaningNetworkSceneKey(scene, index) === sceneKey,
                          );
                          if (nextIndex >= 0) setActiveSceneIndex(nextIndex);
                          navigateToMeaningNetworkEvidence(band.node);
                        }}
                        className="cursor-pointer"
                        data-vaa1-meaning-network-scene-band="true"
                        data-vaa1-meaning-network-paintable-scene="true"
                      >
                        <rect
                          x={band.x}
                          y={band.y}
                          width={band.width}
                          height={band.height}
                          rx={4}
                          fill={focusedMeaningNetworkSceneKey === String(band.node.attributes?.scene_key)
                            ? "#134e4a"
                            : "#0f172a"}
                          stroke={focusedMeaningNetworkSceneKey === String(band.node.attributes?.scene_key)
                            ? "#5eead4"
                            : "#164e63"}
                          strokeWidth={1.5}
                          opacity={0.55}
                        />
                        <rect x={band.x} y={band.y} width={5} height={band.height} fill="#2dd4bf" opacity={0.8} />
                        <rect x={band.x + band.width - 5} y={band.y} width={5} height={band.height} fill="#2dd4bf" opacity={0.8} />
                        <text x={band.x + 8} y={band.y + 14} className="fill-cyan-100 text-[9px]">
                          {meaningNetworkShortLabel(band.node.label, 18)}
                        </text>
                      </g>
                    ))}
                    {meaningNetworkGraph.nodeBars.map((bar) => {
                      const label = renamedMeaningNetworkMarkers[bar.node.node_id] || bar.node.label;
                      const confirmed = confirmedMeaningNetworkMarkers[bar.node.node_id];
                      const selected = selectedMeaningNetworkNodeId === bar.node.node_id;
                      const isObject = bar.node.node_type === "object";
                      const stroke = confirmed ? "#34d399" : isObject ? "#f59e0b" : "#2dd4bf";
                      const fill = confirmed ? "#064e3b" : isObject ? "#451a03" : "#0f172a";
                      return (
                        <g
                          key={`graph-node-presence:${bar.node.node_id}`}
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedMeaningNetworkNodeId(bar.node.node_id);
                            setMeaningNetworkCursorSeconds(bar.start);
                            if (selectedVideoId) {
                              openVideoAtTime(selectedVideoId, bar.start);
                            }
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            openMeaningNetworkNodeInspector(bar.node);
                          }}
                          onContextMenu={(event) => openMeaningNetworkNodeContextMenu(event, bar.node)}
                          onPointerDown={(event) => beginMeaningNetworkPresenceDrag(bar, "move", event)}
                          className="cursor-ew-resize"
                          data-vaa1-meaning-network-node-presence-bar="true"
                          data-vaa1-meaning-network-source-verifying-click="true"
                          data-vaa1-meaning-network-stretchable-node-presence="true"
                          data-vaa1-meaning-network-draggable-node-presence="true"
                          data-vaa1-meaning-network-handle-live-video-scrub="true"
                          data-vaa1-meaning-network-master-schema-presence-anchor="true"
                        >
                          <title>
                            {`${label} / ${formatTime(bar.start)}-${formatTime(bar.end)}${bar.sourceTimed ? "" : " / source time pending"}`}
                          </title>
                          <rect
                            x={bar.x}
                            y={bar.y}
                            width={bar.width}
                            height={bar.height}
                            rx={5}
                            fill={fill}
                            stroke={selected ? "#e0f2fe" : stroke}
                            strokeWidth={selected ? 2.4 : 1.4}
                            opacity={bar.sourceTimed ? 0.78 : 0.56}
                          />
                          <rect
                            x={bar.x - 3}
                            y={bar.y - 1}
                            width={5}
                            height={bar.height + 2}
                            rx={2}
                            fill={stroke}
                            opacity={selected ? 1 : 0.28}
                            onPointerDown={(event) => beginMeaningNetworkPresenceDrag(bar, "start", event)}
                            data-vaa1-meaning-network-active-handle={selected ? "true" : "false"}
                            data-vaa1-meaning-network-handle-live-video-scrub="true"
                            data-vaa1-meaning-network-presence-start-handle="true"
                          />
                          <rect
                            x={bar.x + bar.width - 2}
                            y={bar.y - 1}
                            width={5}
                            height={bar.height + 2}
                            rx={2}
                            fill={stroke}
                            opacity={selected ? 1 : 0.28}
                            onPointerDown={(event) => beginMeaningNetworkPresenceDrag(bar, "end", event)}
                            data-vaa1-meaning-network-active-handle={selected ? "true" : "false"}
                            data-vaa1-meaning-network-handle-live-video-scrub="true"
                            data-vaa1-meaning-network-presence-end-handle="true"
                          />
                          {selected ? (
                            <>
                              <rect
                                x={bar.x}
                                y={bar.y - 18}
                                width={Math.min(Math.max(bar.width, 120), 260)}
                                height={14}
                                rx={3}
                                fill="#020617"
                                stroke="#334155"
                                opacity={0.94}
                              />
                              <text
                                x={bar.x + 6}
                                y={bar.y - 8}
                                className="fill-slate-100 text-[8px]"
                              >
                                {meaningNetworkShortLabel(label, 38)}
                              </text>
                            </>
                          ) : null}
                        </g>
                      );
                    })}
                    <g
                      data-vaa1-meaning-network-playhead="true"
                      data-vaa1-meaning-network-video-sync-cursor="true"
                    >
                      <line
                        x1={meaningNetworkCursorX}
                        y1={0}
                        x2={meaningNetworkCursorX}
                        y2={meaningNetworkGraph.height}
                        stroke="#facc15"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        opacity={0.86}
                        pointerEvents="none"
                      />
                      <rect
                        x={meaningNetworkCursorX - 31}
                        y={4}
                        width={62}
                        height={16}
                        rx={3}
                        fill="#422006"
                        stroke="#facc15"
                        opacity={0.94}
                        pointerEvents="none"
                      />
                      <text
                        x={meaningNetworkCursorX}
                        y={15}
                        textAnchor="middle"
                        className="fill-yellow-100 text-[8px]"
                        pointerEvents="none"
                      >
                        {formatTime(meaningNetworkCursorSeconds)}
                      </text>
                    </g>
                    {meaningNetworkGraph.edges.map((edge) => {
                      const from = meaningNetworkGraph.positions.get(edge.source_node_id);
                      const to = meaningNetworkGraph.positions.get(edge.target_node_id);
                      if (!from || !to) return null;
                      return (
                        <g
                          key={`graph-edge:${edge.edge_id}`}
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigateToMeaningNetworkEvidence(edge);
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            openMeaningNetworkEdgeInspector(edge);
                          }}
                          onContextMenu={(event) => openMeaningNetworkEdgeContextMenu(event, edge)}
                          data-vaa1-meaning-network-graph-edge="true"
                          data-vaa1-meaning-network-single-click-source-verifies="true"
                          data-vaa1-meaning-network-double-click-opens-sheet="true"
                          data-vaa1-meaning-network-context-menu-target="edge"
                        >
                          <line
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke="transparent"
                            strokeWidth={14}
                            strokeLinecap="round"
                          />
                          <line
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke={edge.edge_type === "co_occurs_with" ? "#2dd4bf" : "#334155"}
                            strokeWidth={edge.edge_type === "co_occurs_with" ? 2 : 1}
                            strokeOpacity={0.75}
                          />
                        </g>
                      );
                    })}
                    {meaningNetworkGraph.nodes.map((node) => {
                      const point = meaningNetworkGraph.positions.get(node.node_id);
                      if (!point) return null;
                      const confirmed = confirmedMeaningNetworkMarkers[node.node_id];
                      const selected = selectedMeaningNetworkNodeId === node.node_id;
                      const label = renamedMeaningNetworkMarkers[node.node_id] || node.label;
                      const rawLike = node.node_type === "evidence_fragment";
                      return (
                        <g
                          key={`graph-node:${node.node_id}`}
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedMeaningNetworkNodeId(node.node_id);
                            if (meaningNetworkCanonicalNodeType(node.node_type) === "scene") {
                              const sceneKey = String(node.attributes?.scene_key || node.attributes?.scene_index || "");
                              setFocusedMeaningNetworkSceneKey(sceneKey || null);
                              const nextIndex = meaningNetworkSceneSegments.findIndex(
                                (scene, index) => meaningNetworkSceneKey(scene, index) === sceneKey,
                              );
                              if (nextIndex >= 0) setActiveSceneIndex(nextIndex);
                            }
                            navigateToMeaningNetworkEvidence(node);
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            openMeaningNetworkNodeInspector(node);
                          }}
                          onContextMenu={(event) => openMeaningNetworkNodeContextMenu(event, node)}
                          onPointerDown={(event) => {
                            if (meaningNetworkCanonicalNodeType(node.node_type) !== "scene") {
                              event.stopPropagation();
                            }
                          }}
                          className="cursor-pointer"
                          data-vaa1-meaning-network-graph-node="true"
                          data-vaa1-meaning-network-single-click-selects="true"
                          data-vaa1-meaning-network-single-click-source-verifies="true"
                          data-vaa1-meaning-network-context-menu-target="node"
                          data-vaa1-meaning-network-double-click-opens-sheet="true"
                          data-vaa1-meaning-network-opens-general-agent-view="false"
                        >
                          <title>{label}</title>
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={confirmed ? 14 : 11}
                            fill={confirmed ? "#064e3b" : rawLike ? "#422006" : "#0f172a"}
                            stroke={selected ? "#e0f2fe" : confirmed ? "#34d399" : rawLike ? "#f59e0b" : "#2dd4bf"}
                            strokeWidth={selected ? 3 : 2}
                          />
                          {selected && !meaningNetworkGraph.nodeBars.some((bar) => bar.node.node_id === node.node_id) ? (
                            <>
                              <rect
                                x={point.x - 62}
                                y={point.y + 20}
                                width={124}
                                height={28}
                                rx={3}
                                fill="#020617"
                                stroke="#334155"
                                opacity={0.94}
                              />
                              <text
                                x={point.x}
                                y={point.y + 32}
                                textAnchor="middle"
                                className="fill-slate-200 text-[9px]"
                              >
                                {meaningNetworkShortLabel(label, 24)}
                              </text>
                              <text
                                x={point.x}
                                y={point.y + 43}
                                textAnchor="middle"
                                className="fill-slate-500 text-[8px]"
                              >
                                {meaningNetworkNodeKindLabel(node.node_type)}
                              </text>
                            </>
                          ) : null}
                        </g>
                      );
                    })}
                  </svg>
                  </div>
                ) : null}
                {meaningNetworkContextMenu ? (
                  <div
                    className="fixed z-[80] min-w-[190px] rounded border border-teal-800/70 bg-[#101010] p-1 shadow-2xl shadow-black/70"
                    style={{
                      left: typeof window === "undefined"
                        ? meaningNetworkContextMenu.x
                        : Math.min(meaningNetworkContextMenu.x, Math.max(16, window.innerWidth - 220)),
                      top: typeof window === "undefined"
                        ? meaningNetworkContextMenu.y
                        : Math.min(meaningNetworkContextMenu.y, Math.max(16, window.innerHeight - 260)),
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onContextMenu={(event) => event.preventDefault()}
                    data-vaa1-meaning-network-context-menu="true"
                    data-vaa1-meaning-network-context-kind={meaningNetworkContextMenu.kind}
                  >
                    <div className="border-b border-slate-800 px-2 py-1.5">
                      <div className="truncate text-[10px] font-medium text-slate-100">
                        {meaningNetworkContextMenu.kind === "node"
                          ? renamedMeaningNetworkMarkers[meaningNetworkContextMenu.node?.node_id || ""] || meaningNetworkContextMenu.node?.label || "Node"
                          : meaningNetworkContextMenu.edge?.edge_type || "Edge"}
                      </div>
                      <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-slate-500">
                        Meaning Network {meaningNetworkContextMenu.kind}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (meaningNetworkContextMenu.node) copyMeaningNetworkNode(meaningNetworkContextMenu.node);
                        if (meaningNetworkContextMenu.edge) copyMeaningNetworkEdge(meaningNetworkContextMenu.edge);
                        setMeaningNetworkContextMenu(null);
                      }}
                      className="mt-1 block w-full rounded px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-teal-950/40"
                      data-vaa1-meaning-network-context-copy-item="true"
                    >
                      Copy {meaningNetworkContextMenu.kind}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (meaningNetworkContextMenu.node) openMeaningNetworkNodeInspector(meaningNetworkContextMenu.node);
                        if (meaningNetworkContextMenu.edge) openMeaningNetworkEdgeInspector(meaningNetworkContextMenu.edge);
                        setMeaningNetworkContextMenu(null);
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-cyan-200 hover:bg-cyan-950/40"
                      data-vaa1-meaning-network-context-open-sheet="true"
                    >
                      Open sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const item = meaningNetworkContextMenu.node || meaningNetworkContextMenu.edge;
                        if (item) copyMeaningNetworkItemContent(item, meaningNetworkContextMenu.kind);
                        setMeaningNetworkContextMenu(null);
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-teal-950/40"
                      data-vaa1-meaning-network-context-copy-content="true"
                    >
                      Copy content
                    </button>
                    {meaningNetworkContextMenu.node ? (
                      <button
                        type="button"
                        disabled={!copiedMeaningNetworkContent}
                        onClick={() => {
                          if (meaningNetworkContextMenu.node) pasteMeaningNetworkContentOntoNode(meaningNetworkContextMenu.node);
                          setMeaningNetworkContextMenu(null);
                        }}
                        className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-teal-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                        data-vaa1-meaning-network-context-paste-content="true"
                      >
                        Paste content onto node
                      </button>
                    ) : null}
                    {meaningNetworkContextMenu.node ? (
                      <button
                        type="button"
                        disabled={!copiedMeaningNetworkNode}
                        onClick={() => {
                          pasteMeaningNetworkNodeAtScene();
                          setMeaningNetworkContextMenu(null);
                        }}
                        className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-teal-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                        data-vaa1-meaning-network-context-paste-node="true"
                      >
                        Paste copied node here
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!copiedMeaningNetworkEdge}
                        onClick={() => {
                          pasteMeaningNetworkEdgeDuplicate();
                          setMeaningNetworkContextMenu(null);
                        }}
                        className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-teal-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                        data-vaa1-meaning-network-context-paste-edge="true"
                      >
                        Paste copied edge
                      </button>
                    )}
                    <div className="my-1 border-t border-slate-800" />
                    {meaningNetworkContextMenu.node ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (meaningNetworkContextMenu.node) void quickConfirmMeaningNetworkNode(meaningNetworkContextMenu.node);
                          setMeaningNetworkContextMenu(null);
                        }}
                        className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-emerald-200 hover:bg-emerald-950/40"
                        data-vaa1-meaning-network-context-quick-confirm="true"
                      >
                        Quick confirm
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        const item = meaningNetworkContextMenu.node || meaningNetworkContextMenu.edge;
                        if (item) navigateToMeaningNetworkEvidence(item);
                        setMeaningNetworkContextMenu(null);
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-cyan-200 hover:bg-cyan-950/40"
                      data-vaa1-meaning-network-context-jump-source="true"
                    >
                      Jump to source
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const item = meaningNetworkContextMenu.node || meaningNetworkContextMenu.edge;
                        if (item) openMeaningNetworkTraceback(item, meaningNetworkContextMenu.kind);
                        setMeaningNetworkContextMenu(null);
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-amber-200 hover:bg-amber-950/40"
                      data-vaa1-meaning-network-context-traceback="true"
                    >
                      Open traceback
                    </button>
                  </div>
                ) : null}
                {meaningNetworkSheet ? (
                  <div
                    className="mt-2 max-h-[320px] overflow-auto rounded border border-cyan-900/70 bg-[#071011] p-3"
                    data-vaa1-meaning-network-sheet="true"
                    data-vaa1-meaning-network-sheet-kind={meaningNetworkSheet.kind}
                    data-vaa1-meaning-network-opens-general-agent-view="false"
                  >
                    {meaningNetworkSheet.kind === "node" && meaningNetworkSheet.node ? (() => {
                      const node = meaningNetworkSheet.node;
                      const label = renamedMeaningNetworkMarkers[node.node_id] || node.label;
                      const refs = node.evidence_refs || [];
                      const range = meaningNetworkVerificationRange(node);
                      return (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[9px] uppercase tracking-[0.12em] text-cyan-300">
                                Meaning Sheet / node
                              </div>
                              <div className="mt-0.5 truncate text-[12px] font-medium text-slate-100">
                                {label}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-400">
                                {meaningNetworkNodeKindLabel(node.node_type)} / {meaningNetworkMaturityLabel(node)} / {node.maturity?.authority || "authority pending"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={resetMeaningNetworkReviewFrame}
                              className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                              aria-label="Close Meaning Sheet"
                            >
                              Close
                            </button>
                          </div>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <div className="rounded border border-slate-800 bg-[#050707] p-2">
                              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Source verification</div>
                              <div className="mt-1 text-[10px] text-slate-300">
                                {range
                                  ? `${formatTime(range.start)}-${formatTime(range.end)} / ${range.range_source.replaceAll("_", " ")}`
                                  : "Source time pending"}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-500">
                                {meaningNetworkSourceTypes(refs).join(", ") || "No source types attached"}
                              </div>
                            </div>
                            <div className="rounded border border-slate-800 bg-[#050707] p-2">
                              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Traceback</div>
                              <div className="mt-1 text-[10px] text-slate-300">
                                {meaningNetworkTracebackRefs(refs).slice(0, 3).join(", ") || "Traceback pending"}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-500">
                                Evidence refs: {refs.length}
                              </div>
                            </div>
                          </div>
                          {renderMeaningNetworkSflControls("node", node)}
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => navigateToMeaningNetworkEvidence(node)}
                              className="rounded border border-cyan-800/70 bg-[#101010] px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/25"
                              data-vaa1-meaning-network-sheet-source-verify="true"
                            >
                              Jump to source
                            </button>
                            <button
                              type="button"
                              onClick={() => openMeaningNetworkTraceback(node, "node")}
                              className="rounded border border-amber-800/70 bg-[#101010] px-2 py-1 text-[10px] text-amber-100 hover:bg-amber-950/25"
                              data-vaa1-meaning-network-sheet-traceback="true"
                            >
                              Traceback
                            </button>
                            <button
                              type="button"
                              onClick={() => void quickConfirmMeaningNetworkNode(node)}
                              className="rounded border border-emerald-800/70 bg-[#101010] px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-950/25"
                              data-vaa1-meaning-network-sheet-confirm="true"
                            >
                              Confirm node
                            </button>
                            <button
                              type="button"
                              onClick={() => renameMeaningNetworkNode(node)}
                              className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-teal-700 hover:text-teal-100"
                              data-vaa1-meaning-network-sheet-edit="true"
                            >
                              Rename
                            </button>
                            {isNarrativeAgentMeaningNode(node) ? (
                              <button
                                type="button"
                                onClick={() => openSpecificNarrativeAgentStoryline(node)}
                                className="rounded border border-violet-800/70 bg-[#101010] px-2 py-1 text-[10px] text-violet-100 hover:bg-violet-950/25"
                                data-vaa1-meaning-network-sheet-specific-storyline="true"
                              >
                                Open specific storyline
                              </button>
                            ) : null}
                          </div>
                        </>
                      );
                    })() : null}
                    {meaningNetworkSheet.kind === "edge" && meaningNetworkSheet.edge ? (() => {
                      const edge = meaningNetworkSheet.edge;
                      const sourceNode = meaningNetworkNodes.find((node) => node.node_id === edge.source_node_id);
                      const targetNode = meaningNetworkNodes.find((node) => node.node_id === edge.target_node_id);
                      const sourceLabel = sourceNode ? renamedMeaningNetworkMarkers[sourceNode.node_id] || sourceNode.label : edge.source_node_id;
                      const targetLabel = targetNode ? renamedMeaningNetworkMarkers[targetNode.node_id] || targetNode.label : edge.target_node_id;
                      const refs = edge.evidence_refs || [];
                      const range = meaningNetworkEvidenceTimeRange(refs);
                      const edgeStatus = confirmedMeaningNetworkEdges[edge.edge_id];
                      return (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[9px] uppercase tracking-[0.12em] text-cyan-300">
                                Meaning Sheet / edge
                              </div>
                              <div className="mt-0.5 truncate text-[12px] font-medium text-slate-100">
                                {meaningNetworkEdgeKindLabel(edge.edge_type)}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-400">
                                {meaningNetworkMaturityLabel(edge)} / {edge.maturity?.authority || "authority pending"}{edgeStatus ? ` / ${edgeStatus}` : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={resetMeaningNetworkReviewFrame}
                              className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-700 hover:text-cyan-100"
                              aria-label="Close Meaning Sheet"
                            >
                              Close
                            </button>
                          </div>
                          <div className="mt-2 rounded border border-slate-800 bg-[#050707] p-2" data-vaa1-meaning-network-edge-explanation="true">
                            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Plain-language edge reading</div>
                            <div className="mt-1 text-[10px] leading-relaxed text-slate-200">
                              {meaningNetworkEdgePlainLanguage(edge, sourceLabel, targetLabel)}
                            </div>
                            <div className="mt-2 text-[9px] uppercase tracking-[0.12em] text-slate-500">Why this edge exists</div>
                            <div className="mt-1 text-[10px] leading-relaxed text-slate-300">
                              {meaningNetworkEdgeReason(edge)}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <div className="rounded border border-slate-800 bg-[#050707] p-2">
                              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Linked nodes</div>
                              <div className="mt-1 text-[10px] text-slate-300">
                                {sourceLabel} {"->"} {targetLabel}
                              </div>
                            </div>
                            <div className="rounded border border-slate-800 bg-[#050707] p-2">
                              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Source and traceback</div>
                              <div className="mt-1 text-[10px] text-slate-300">
                                {range ? `${formatTime(range.start)}-${formatTime(range.end)}` : "Source time pending"}
                              </div>
                              <div className="mt-1 text-[10px] text-slate-500">
                                {meaningNetworkTracebackRefs(refs).slice(0, 3).join(", ") || "Traceback pending"}
                              </div>
                            </div>
                          </div>
                          {renderMeaningNetworkSflControls("edge", edge)}
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => navigateToMeaningNetworkEvidence(edge)}
                              className="rounded border border-cyan-800/70 bg-[#101010] px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/25"
                              data-vaa1-meaning-network-sheet-source-verify="true"
                            >
                              Jump to source
                            </button>
                            <button
                              type="button"
                              onClick={() => openMeaningNetworkTraceback(edge, "edge")}
                              className="rounded border border-amber-800/70 bg-[#101010] px-2 py-1 text-[10px] text-amber-100 hover:bg-amber-950/25"
                              data-vaa1-meaning-network-sheet-traceback="true"
                            >
                              Traceback
                            </button>
                            <button
                              type="button"
                              onClick={() => void persistMeaningNetworkEdgeDecision(edge, "confirmed")}
                              className="rounded border border-emerald-800/70 bg-[#101010] px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-950/25"
                              data-vaa1-meaning-network-sheet-confirm-edge="true"
                            >
                              Confirm edge
                            </button>
                            <button
                              type="button"
                              onClick={() => editMeaningNetworkEdgeMeaning(edge)}
                              className="rounded border border-slate-700 bg-[#101010] px-2 py-1 text-[10px] text-slate-300 hover:border-teal-700 hover:text-teal-100"
                              data-vaa1-meaning-network-sheet-edit-edge="true"
                            >
                              Edit reading
                            </button>
                            <button
                              type="button"
                              onClick={() => void persistMeaningNetworkEdgeDecision(edge, "canceled")}
                              className="rounded border border-rose-900/70 bg-[#101010] px-2 py-1 text-[10px] text-rose-100 hover:bg-rose-950/25"
                              data-vaa1-meaning-network-sheet-reject-edge="true"
                            >
                              Reject edge
                            </button>
                          </div>
                        </>
                      );
                    })() : null}
                  </div>
                ) : null}
                {meaningNetworkViewMode === "whole_timeline" ? (
                  <div
                    className={`${meaningNetworkExpanded ? "min-h-[460px]" : "min-h-[260px]"} rounded border border-slate-900 bg-[#050707] p-3`}
                    data-vaa1-meaning-network-whole-timeline="true"
                  >
                    <div className="relative h-24 border-b border-slate-800">
                      {meaningNetworkSceneSegments.map((scene, sceneIndex) => {
                        const start = Math.max(0, Math.min(100, (Number(scene.start || 0) / meaningNetworkTimelineDuration) * 100));
                        const end = Math.max(start + 1, Math.min(100, (Number(scene.end || 0) / meaningNetworkTimelineDuration) * 100));
                        const sceneKey = meaningNetworkSceneKey(scene, sceneIndex);
                        return (
                          <button
                            key={`meaning-network-whole-scene:${sceneKey}`}
                            type="button"
                            onClick={() => {
                              setFocusedMeaningNetworkSceneKey(sceneKey);
                              setActiveSceneIndex(sceneIndex);
                            }}
                            className={`absolute top-2 h-14 rounded border text-left hover:border-cyan-600/80 ${
                              focusedMeaningNetworkSceneKey === sceneKey
                                ? "border-teal-500 bg-teal-950/40"
                                : "border-cyan-900/70 bg-cyan-950/20"
                            }`}
                            style={{ left: `${start}%`, width: `${Math.max(2, end - start)}%` }}
                            title={`Scene ${sceneKey}: ${formatTime(Number(scene.start || 0))}-${formatTime(Number(scene.end || 0))}`}
                            data-vaa1-meaning-network-paintable-scene="true"
                          >
                            <span className="block truncate px-1 py-1 text-[9px] text-cyan-100">S{sceneKey}</span>
                          </button>
                        );
                      })}
                      {meaningNetworkNodes.filter((node) => meaningNetworkCanonicalNodeType(node.node_type) !== "scene").slice(0, 140).map((node) => {
                        const position = Math.max(0, Math.min(100, (meaningNetworkEvidenceStart(node.evidence_refs) / meaningNetworkTimelineDuration) * 100));
                        const confirmed = confirmedMeaningNetworkMarkers[node.node_id];
                        return (
                          <button
                            key={`meaning-network-whole-node:${node.node_id}`}
                            type="button"
                            onClick={() => navigateToMeaningNetworkEvidence(node)}
                            className={`absolute bottom-0 h-5 w-1.5 -translate-x-1/2 rounded-sm ${confirmed ? "bg-emerald-400" : node.node_type === "object" ? "bg-amber-400" : "bg-teal-300"}`}
                            style={{ left: `${position}%` }}
                            title={`${renamedMeaningNetworkMarkers[node.node_id] || node.label} ${meaningNetworkSourceTimeLabel(node.evidence_refs)}`}
                            data-vaa1-meaning-network-timeline-marker="true"
                          />
                        );
                      })}
                    </div>
                    <div className="mt-3 grid gap-1.5 md:grid-cols-3">
                      {meaningNetworkSceneSegments.slice(0, meaningNetworkExpanded ? 18 : 9).map((scene, index) => {
                        const sceneKey = meaningNetworkSceneKey(scene, index);
                        const count = meaningNetworkNodes.filter((node) => meaningNetworkCanonicalNodeType(node.node_type) !== "scene" && meaningNetworkNodeOverlapsScene(node, scene)).length;
                        return (
                          <button
                            key={`meaning-network-scene-summary:${sceneKey}`}
                            type="button"
                            onClick={() => {
                              setActiveSceneIndex(index);
                              setFocusedMeaningNetworkSceneKey(sceneKey);
                              setMeaningNetworkViewMode("scene_timeline");
                            }}
                            className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5 text-left hover:border-teal-800/70"
                          >
                            <div className="text-[10px] text-slate-100">Scene {sceneKey}</div>
                            <div className="mt-0.5 text-[9px] text-slate-500">
                              {formatTime(Number(scene.start || 0))}-{formatTime(Number(scene.end || 0))} / {count} nodes
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {meaningNetworkViewMode === "scene_timeline" ? (
                  <div
                    className={`${meaningNetworkExpanded ? "min-h-[460px]" : "min-h-[260px]"} rounded border border-slate-900 bg-[#050707] p-3`}
                    data-vaa1-meaning-network-scene-timeline="true"
                  >
                    <div className="mb-2 flex flex-wrap gap-1">
                      {meaningNetworkSceneSegments.slice(0, 24).map((scene, index) => {
                        const sceneKey = meaningNetworkSceneKey(scene, index);
                        return (
                        <button
                          key={`meaning-network-scene-tab:${sceneKey}`}
                          type="button"
                          onClick={() => {
                            setActiveSceneIndex(index);
                            setFocusedMeaningNetworkSceneKey(sceneKey);
                          }}
                          className={`rounded border px-2 py-1 text-[9px] ${
                            focusedMeaningNetworkSceneKey === sceneKey || (!focusedMeaningNetworkSceneKey && index === activeSceneIndex)
                              ? "border-teal-500 bg-teal-950/40 text-teal-100"
                              : "border-slate-800 bg-[#101010] text-slate-400 hover:border-teal-800"
                          }`}
                        >
                          S{sceneKey}
                        </button>
                        );
                      })}
                    </div>
                    <div className="rounded border border-slate-800 bg-[#080b0b] p-2">
                      <div className="text-[10px] text-slate-200">
                        Scene {activeMeaningNetworkScene ? meaningNetworkSceneKey(activeMeaningNetworkScene, activeSceneIndex) : activeSceneIndex + 1}
                        {activeMeaningNetworkScene ? ` / ${formatTime(Number(activeMeaningNetworkScene.start || 0))}-${formatTime(Number(activeMeaningNetworkScene.end || 0))}` : ""}
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {activeSceneMeaningNodes.slice(0, meaningNetworkExpanded ? 60 : 20).map((node) => (
                          <button
                            key={`meaning-network-scene-node:${node.node_id}`}
                            type="button"
                            onClick={() => navigateToMeaningNetworkEvidence(node)}
                            className="block w-full rounded border border-slate-800 bg-[#101010] px-2 py-1.5 text-left hover:border-teal-800/70"
                            data-vaa1-meaning-network-scene-marker="true"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[10px] text-slate-100">
                                {renamedMeaningNetworkMarkers[node.node_id] || node.label}
                              </span>
                              <span className="shrink-0 text-[9px] text-teal-200">
                                {meaningNetworkSourceTimeLabel(node.evidence_refs)}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[9px] text-slate-500">
                              {meaningNetworkNodeKindLabel(node.node_type)} / {meaningNetworkMaturityLabel(node)}
                            </div>
                          </button>
                        ))}
                        {!activeSceneMeaningNodes.length && (
                          <div className="rounded border border-dashed border-slate-800 px-2 py-3 text-[10px] text-slate-500">
                            No source-linked nodes are currently grounded in this scene.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
                {meaningNetworkViewMode === "character_timeline" ? (
                  <div
                    className={`${meaningNetworkExpanded ? "min-h-[460px]" : "min-h-[260px]"} rounded border border-slate-900 bg-[#050707] p-3`}
                    data-vaa1-meaning-network-character-timeline="true"
                  >
                    <div className="space-y-2">
                      {characterTimelineGroups.slice(0, meaningNetworkExpanded ? 28 : 12).map((group) => (
                        <div key={`meaning-network-character-row:${group.key}`} className="rounded border border-slate-800 bg-[#080b0b] p-2">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="truncate text-[10px] text-slate-100">{group.label}</div>
                            <div className="shrink-0 text-[9px] text-teal-200">{group.nodes.length} marks</div>
                          </div>
                          <div className="relative h-8 rounded bg-[#101010]">
                            {group.nodes.map((node) => {
                              const position = Math.max(0, Math.min(100, (meaningNetworkEvidenceStart(node.evidence_refs) / meaningNetworkTimelineDuration) * 100));
                              return (
                                <button
                                  key={`meaning-network-character-mark:${node.node_id}`}
                                  type="button"
                                  onClick={() => navigateToMeaningNetworkEvidence(node)}
                                  className="absolute top-1 h-6 w-2 -translate-x-1/2 rounded bg-teal-300 hover:bg-emerald-300"
                                  style={{ left: `${position}%` }}
                                  title={`${node.label} ${meaningNetworkSourceTimeLabel(node.evidence_refs)}`}
                                  data-vaa1-meaning-network-character-marker="true"
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {!characterTimelineGroups.length && (
                        <div className="rounded border border-dashed border-slate-800 px-2 py-3 text-[10px] text-slate-500">
                          Narrative Agent timeline marks will appear when Master Schema agent/profile evidence is available.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
                {meaningNetworkViewMode === "graph" && meaningNetworkGraph.nodes.length === 0 ? (
                  <div className="flex h-[160px] items-center justify-center rounded border border-dashed border-slate-800 bg-[#050707] text-[10px] text-slate-500">
                    Add a node or run the datascene meaning network artifact to populate the graph.
                  </div>
                ) : null}
                <div className="mt-1.5 text-[9px] text-slate-500">
                  Click a node/edge/timeline marker to jump to source; double-click a graph node or edge to open its Meaning Sheet.
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-h-0 rounded border border-slate-800 bg-[#101010]">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                      Node markers
                    </div>
                    <div className="text-[9px] text-teal-200">
                      {reviewableMeaningNetworkNodes.length} navigable
                    </div>
                  </div>
                  <div className="max-h-56 space-y-1 overflow-auto p-1.5" data-vaa1-meaning-network-node-list-scroll="true">
                    {reviewableMeaningNetworkNodes.map((node) => {
                      const confirmed = confirmedMeaningNetworkMarkers[node.node_id];
                      const label = renamedMeaningNetworkMarkers[node.node_id] || node.label;
                      return (
                        <div
                          key={node.node_id}
                          className="rounded border border-slate-800 bg-[#141414] px-2 py-1.5"
                          data-vaa1-meaning-network-node-marker="true"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => navigateToMeaningNetworkEvidence(node)}
                              className="min-w-0 text-left"
                              title="Jump to source video evidence"
                            >
                              <div className="truncate text-[10px] text-slate-100">{label}</div>
                              <div className="mt-0.5 text-[9px] text-slate-500">
                                {meaningNetworkNodeKindLabel(node.node_type)} / {meaningNetworkMaturityLabel(node)}
                                {" "}{meaningNetworkSourceTimeLabel(node.evidence_refs)}
                              </div>
                            </button>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => quickConfirmMeaningNetworkNode(node)}
                                className={`rounded border px-1.5 py-0.5 text-[9px] ${
                                  confirmed
                                    ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-100"
                                    : "border-slate-700 bg-[#101010] text-slate-300 hover:border-emerald-700 hover:text-emerald-100"
                                }`}
                                data-vaa1-meaning-network-quick-confirm="true"
                              >
                                {confirmed ? "confirmed" : "confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyMeaningNetworkNode(node)}
                                className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-teal-700 hover:text-teal-100"
                                data-vaa1-meaning-network-copy-anchor="true"
                              >
                                copy
                              </button>
                              <button
                                type="button"
                                onClick={() => renameMeaningNetworkNode(node)}
                                className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-teal-700 hover:text-teal-100"
                                data-vaa1-meaning-network-update-marker="true"
                              >
                                rename
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!reviewableMeaningNetworkNodes.length && (
                      <div className="px-2 py-2 text-[10px] text-slate-500">
                        Meaning Network nodes will appear after scene/person/transcript evidence is available.
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-h-0 rounded border border-slate-800 bg-[#101010]">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                      Edge markers
                    </div>
                    <div className="text-[9px] text-teal-200">
                      {reviewableMeaningNetworkEdges.length} source linked
                    </div>
                  </div>
                  <div className="max-h-56 space-y-1 overflow-auto p-1.5" data-vaa1-meaning-network-edge-list-scroll="true">
                    {reviewableMeaningNetworkEdges.map((edge) => (
                      <button
                        key={edge.edge_id}
                        type="button"
                        onClick={() => navigateToMeaningNetworkEvidence(edge)}
                        className="block w-full rounded border border-slate-800 bg-[#141414] px-2 py-1.5 text-left hover:border-teal-800/60"
                        data-vaa1-meaning-network-edge-marker="true"
                        title="Jump to source evidence for this edge"
                      >
                        <div className="truncate text-[10px] text-slate-100">
                          {edge.edge_type.replaceAll("_", " ")}
                        </div>
                        <div className="mt-0.5 text-[9px] text-slate-500">
                          {meaningNetworkMaturityLabel(edge)} / weight {Number(edge.weight || 0).toFixed(2)}
                          {" "}{meaningNetworkSourceTimeLabel(edge.evidence_refs)}
                        </div>
                      </button>
                    ))}
                    {!reviewableMeaningNetworkEdges.length && (
                      <div className="px-2 py-2 text-[10px] text-slate-500">
                        Edge markers will appear when source-linked co-presence or continuity relations exist.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div
                className="sticky bottom-0 z-10 mt-2 flex flex-wrap gap-1 border-t border-slate-900 bg-[#080b0b]/95 pt-2 text-[9px] text-slate-500"
                data-vaa1-meaning-network-sticky-action-rail="true"
              >
                {(meaningNetworkUiContract.required_affordances || [])
                  .filter((item: unknown) =>
                    ["add_node", "add_edge", "quick_confirm", "copy_anchor", "paste_anchor", "rename_node", "jump_to_video_time", "open_traceback_drawer"].includes(String(item)),
                  )
                  .slice(0, 8)
                  .map((item: unknown) => (
                    <span
                      key={`meaning-network-affordance:${String(item)}`}
                      className="rounded border border-slate-800 bg-[#101010] px-1.5 py-0.5"
                    >
                      {String(item).replaceAll("_", " ")}
                    </span>
                  ))}
              </div>
            </section>

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-3 overflow-hidden">
            <section
              ref={plotPathRef}
              className="scroll-mt-2 flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]"
              data-vaa1-meaning-plot-review-queue="true"
            >
              <div className="border-b border-white/8 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Plot Review Queue
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Click a claim to inspect source evidence; use the lens as a question, not a conclusion.
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
                {activeNarrativeLensReadings.length > 0 && (
                  <div className="space-y-1.5 rounded border border-cyan-900/40 bg-cyan-950/10 p-1.5">
                    <div className="px-1 text-[10px] uppercase tracking-[0.14em] text-cyan-200">
                      Interpretive Lens Readings
                    </div>
                    {activeNarrativeLensReadings.slice(0, INTERPRETIVE_READING_UI_CONFIG.maxPlotReadingsPerLens).map((reading) => (
                      <InterpretiveReadingItem
                        key={reading.reading_id || `${reading.lens_id}:${readingStartSeconds(reading)}`}
                        reading={reading}
                        onNavigate={navigateToReading}
                      />
                    ))}
                  </div>
                )}
                {plotInstructions.length ? (
                  plotInstructions.map((instruction) => (
                    <InstructionItem
                      key={instruction.instruction_id}
                      instruction={instruction}
                      activeLens={activeLens}
                      showLens
                      onNavigate={navigateToInstruction}
                    />
                  ))
                ) : (
                  <div className="px-2 py-3 text-[12px] text-slate-500">
                    No plot-path candidates yet.
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded border border-white/8 bg-[#121212]">
              <div className="border-b border-white/8 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Character Paths
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Operational triage for scene presence, relation cues, and archetype readings.
                </div>
                <div
                  className="mt-2 flex flex-wrap gap-1"
                  data-vaa1-meaning-plot-section-jumps="true"
                >
                  <button
                    type="button"
                    onClick={() => scrollCharacterPathSection(sceneAgentBrowserRef)}
                    className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-cyan-800/60 hover:text-cyan-100"
                  >
                    Scene agents
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCharacterPathSection(characterSceneListRef)}
                    className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-cyan-800/60 hover:text-cyan-100"
                  >
                    Characters by scene
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCharacterPathSection(dramaticArchetypeReadingsRef)}
                    className="rounded border border-cyan-700/60 bg-cyan-950/20 px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-950/35"
                  >
                    Dramatic archetypes
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCharacterPathSection(participantRankingRef)}
                    className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-cyan-800/60 hover:text-cyan-100"
                  >
                    Participant ranking
                  </button>
                  <button
                    type="button"
                    onClick={openNarrativeAgentPaths}
                    className="rounded border border-cyan-700/60 bg-[#101010] px-1.5 py-0.5 text-[10px] text-cyan-100 hover:bg-cyan-950/25"
                  >
                    Narrative Agent paths
                  </button>
                </div>
                <div className="mt-2 rounded border border-cyan-900/40 bg-cyan-950/10 px-2 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                        Master Schema Scene Governance
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        Scene counts are layer-specific; Meaning / Plot uses governed layers, not an independent scene truth.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sceneConstellationGovernance.layers.slice(0, 4).map((layer) => (
                        <span
                          key={layer.layer_id || layer.label}
                          className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-300"
                          title={`${layer.authority || "authority pending"} / ${layer.source || "source pending"}`}
                        >
                          {layer.label || layer.layer_id}: {layer.count ?? 0}
                        </span>
                      ))}
                    </div>
                  </div>
                  {sceneConstellationGovernance.attendeeRule ? (
                    <div className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      {sceneConstellationGovernance.attendeeRule}
                    </div>
                  ) : (
                    <div className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      Narrative-agent attendance, entry, exit, speech, expression, and sample-profile persistence are treated as scene-boundary evidence under Master Schema governance.
                    </div>
                  )}
                </div>
                {characterPathReadings.length > 0 && (
                  <div
                    className="mt-2 rounded border border-cyan-900/40 bg-cyan-950/10 px-2 py-2"
                    data-vaa1-character-path-reading-artifact="true"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                          Narrative Agent Character Paths
                        </div>
                        <div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                          Agent-centered continuity, scenes, evidence, and dramatic readings. Each chip jumps to its source anchor.
                        </div>
                      </div>
                      <div className="text-[10px] text-cyan-200">
                        {characterPathReadings.length} readings / {scenePresenceReadings.length} scene-presence
                      </div>
                    </div>
                    {scenePresenceReadings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {scenePresenceReadings.slice(0, INTERPRETIVE_READING_UI_CONFIG.maxScenePresenceChips).map((reading) => (
                          <button
                            key={reading.reading_id || `scene-presence:${readingStartSeconds(reading)}`}
                            type="button"
                            onClick={() => navigateToReading(reading)}
                            className="rounded border border-emerald-700/50 bg-[#101010] px-1.5 py-0.5 text-[9px] text-emerald-100 hover:bg-emerald-950/30"
                            title={reading.claim_prose || "Jump to scene-presence reading"}
                          >
                            {reading.narrative_agent?.current_label || "Agent"} {formatTime(readingStartSeconds(reading))}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 max-h-40 space-y-1.5 overflow-auto pr-1">
                      {characterPathReadingsByAgent.slice(0, INTERPRETIVE_READING_UI_CONFIG.maxAgentReadingGroups).map(([agentLabel, readings]) => (
                        <div
                          key={`character-path-artifact:${agentLabel}`}
                          className="rounded border border-slate-800 bg-[#101010] px-2 py-1.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 truncate text-[10px] text-slate-100">
                              {agentLabel}
                            </div>
                            <div className="text-[9px] text-slate-500">
                                  {readings.length} surfaced readings
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {readings.slice(0, 5).map((reading) => (
                              <button
                                key={reading.reading_id || `${agentLabel}:${reading.reading_type}`}
                                type="button"
                                onClick={() => navigateToReading(reading)}
                                className="rounded border border-slate-700 bg-[#121212] px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-700/60 hover:text-cyan-100"
                                title={reading.maturity_gate?.reason || "Open source-linked character-path reading"}
                              >
                                {(reading.reading_type || "path").replaceAll("_", " ")} / {readingMaturityLabel(reading)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {sceneSegments.length > 0 && (
                  <div
                    ref={sceneAgentBrowserRef}
                    className="scroll-mt-2 mt-2 rounded border border-slate-800 bg-[#101010] px-2 py-2"
                    data-vaa1-meaning-plot-scene-agent-browser="true"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                          Scene Agent Browser
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          Browse Narrative Agent Profiles by scene, lines, expressions, and source links.
                          {sceneSegmentsAreDerived
                            ? " Derived from evidence windows until formal scene segments arrive."
                            : ` Source: ${sceneSegmentSourceLabel}.`}
                        </div>
                      </div>
                      {activeScene && (
                        <button
                          type="button"
                          onClick={() => openVideoAtTime(selectedVideoId, activeScene.start)}
                          className="rounded border border-cyan-700/50 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/30"
                        >
                          Jump {formatTime(activeScene.start)}
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sceneSegments.map((scene, index) => (
                        <button
                          key={`meaning-scene-${scene.scene_index ?? index}`}
                          type="button"
                          onClick={() => setActiveSceneIndex(index)}
                          className={`rounded border px-1.5 py-0.5 text-[10px] ${
                            activeSceneIndex === index
                              ? "border-cyan-600/60 bg-cyan-950/35 text-cyan-100"
                              : "border-slate-700 bg-[#121212] text-slate-400 hover:bg-white/5"
                          }`}
                        >
                          S{scene.scene_index ?? index + 1}
                        </button>
                      ))}
                    </div>
                    {activeScene && (
                      <div className="mt-2 max-h-52 space-y-1.5 overflow-auto pr-1">
                        {sceneAgentRows.length > 0 ? sceneAgentRows.map((row) => (
                          <div
                            key={`${activeSceneKey}:${row.profileKey}`}
                            className="rounded border border-slate-800 bg-[#121212] px-2 py-1.5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[10px] text-slate-100">
                                  {formatNarrativeAgentProfileBrief(row.profile)}
                                </div>
                                <div className="mt-0.5 text-[9px] text-slate-500">
                                  {row.status} / manual {row.manualAnnotations.length} / audio {row.audioProsody.length} / samples {row.sourceSamples.length} / cues {row.sceneInstructions.length} / lines {row.lines.length} / expressions {row.expressions.length}
                                </div>
                              </div>
                              {row.status === "not surfaced" ? (
                                <button
                                  type="button"
                                  onClick={() => addProfileToScene(row.profileKey)}
                                  className="rounded border border-cyan-700/60 px-1.5 py-0.5 text-[9px] text-cyan-100 hover:bg-cyan-950/30"
                                >
                                  Add to scene
                                </button>
                              ) : row.status === "staged" ? (
                                <button
                                  type="button"
                                  onClick={() => removeProfileFromScene(row.profileKey)}
                                  className="rounded border border-rose-700/60 px-1.5 py-0.5 text-[9px] text-rose-100 hover:bg-rose-950/30"
                                >
                                  Remove staged
                                </button>
                              ) : null}
                            </div>
                            {row.lines.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {row.lines.slice(0, 2).map((line) => (
                                  <button
                                    key={`${row.profileKey}:line:${line.start}:${line.text}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, line.start)}
                                    className="block w-full truncate rounded border border-slate-800 px-1.5 py-0.5 text-left text-[9px] text-slate-300 hover:border-cyan-800/60"
                                  >
                                    {formatTime(line.start)} {line.speaker}: {line.text}
                                  </button>
                                ))}
                              </div>
                            )}
                            {row.manualAnnotations.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.manualAnnotations.slice(0, 4).map((annotation) => (
                                  <button
                                    key={`${row.profileKey}:manual:${annotation.id || manualAnnotationStart(annotation)}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, manualAnnotationStart(annotation))}
                                    className="rounded border border-emerald-700/50 px-1.5 py-0.5 text-[9px] text-emerald-100 hover:bg-emerald-950/25"
                                    title="Jump to manual subject indication"
                                  >
                                    manual {formatTime(manualAnnotationStart(annotation))}
                                  </button>
                                ))}
                              </div>
                            )}
                            {(row.audioProsody.length > 0 || row.sourceSamples.length > 0) && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.audioProsody.slice(0, 3).map((cue) => (
                                  <button
                                    key={`${row.profileKey}:prosody:${cue.cue_id || cue.start}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, Number(cue.start || 0))}
                                    className="rounded border border-sky-700/50 px-1.5 py-0.5 text-[9px] text-sky-100 hover:bg-sky-950/25"
                                    title="Jump to linked audio prosody cue"
                                  >
                                    prosody {formatTime(Number(cue.start || 0))}
                                  </button>
                                ))}
                                {row.sourceSamples.slice(0, 3).map((sample) => (
                                  <button
                                    key={`${row.profileKey}:sample:${sample.sample_id || sample.time_start}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, Number(sample.time_start || 0))}
                                    className="rounded border border-amber-700/50 px-1.5 py-0.5 text-[9px] text-amber-100 hover:bg-amber-950/25"
                                    title="Jump to linked source sample"
                                  >
                                    {String(sample.sample_type || "sample").replaceAll("_", "+")} {formatTime(Number(sample.time_start || 0))}
                                  </button>
                                ))}
                              </div>
                            )}
                            {(row.expressions.length > 0 || row.persistenceSignals.length > 0) && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.expressions.map((expression) => (
                                  <button
                                    key={`${row.profileKey}:expression:${expression.timestamp}:${expressionLabel(expression)}`}
                                    type="button"
                                    onClick={() => openVideoAtTime(selectedVideoId, expression.timestamp)}
                                    className="rounded border border-fuchsia-700/50 px-1.5 py-0.5 text-[9px] text-fuchsia-100 hover:bg-fuchsia-950/25"
                                  >
                                    {expressionLabel(expression)} {formatTime(expression.timestamp)}
                                  </button>
                                ))}
                                {row.persistenceSignals.map((signal) => (
                                  <button
                                    key={`${row.profileKey}:persistence:${signal.instruction_id}`}
                                    type="button"
                                    onClick={() => navigateToInstruction(signal)}
                                    className="rounded border border-violet-700/50 px-1.5 py-0.5 text-[9px] text-violet-100 hover:bg-violet-950/25"
                                  >
                                    agent persistence {supportLabel(signal)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )) : (
                          <div className="text-[10px] text-slate-500">
                            No Narrative Agent Profiles available for scene browsing yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {characterSceneGovernanceRows.length > 0 && (
                  <div
                    ref={characterSceneListRef}
                    className="scroll-mt-2 mt-2 rounded border border-slate-800 bg-[#101010] px-2 py-2"
                    data-vaa1-meaning-plot-character-scene-list="true"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                          Characters By Scene
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          Governance list: open one character to inspect only their surfaced or staged scenes.
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {characterSceneGovernanceRows.length} characters
                        {sceneSegmentsAreDerived ? " / derived scenes" : ""}
                      </div>
                    </div>
                    <div className="mt-2 max-h-64 space-y-1.5 overflow-auto pr-1">
                      {characterSceneGovernanceRows.map(({ label, profile, profileKey, scenes }) => {
                        const open = Boolean(openCharacterSceneProfiles[profileKey]);
                        const visibleScenes = scenes.filter(
                          (scene) => scene.surfaced || scene.staged,
                        );
                        return (
                          <div
                            key={`character-scenes:${profileKey}`}
                            className="rounded border border-slate-800 bg-[#121212]"
                          >
                            <button
                              type="button"
                              onClick={() => toggleCharacterSceneProfile(profileKey)}
                              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-white/5"
                            >
                              <span className="min-w-0 truncate text-[10px] text-slate-100">
                                {open ? "▾" : "▸"} {formatAgentGovernanceLabel({ label, profile, profileKey, scenes })}
                              </span>
                              <span className="shrink-0 text-[9px] text-slate-500">
                                {visibleScenes.length} scenes
                              </span>
                            </button>
                            <div className="flex flex-wrap gap-1 border-t border-slate-900/80 px-2 py-1.5">
                              {scenes.map((sceneRow) => {
                                const activated = sceneRow.surfaced || sceneRow.staged;
                                return (
                                  <button
                                    key={`${profileKey}:scene-switch:${sceneRow.sceneKey}`}
                                    type="button"
                                    onClick={() =>
                                      toggleProfileSceneActivation(sceneRow.sceneKey, profileKey)
                                    }
                                    className={`rounded border px-1.5 py-0.5 text-[9px] ${
                                      activated
                                        ? sceneRow.staged
                                          ? "border-cyan-500/70 bg-cyan-950/45 text-cyan-100"
                                          : "border-emerald-600/60 bg-emerald-950/30 text-emerald-100"
                                        : "border-slate-700 bg-[#101010] text-slate-500 hover:border-cyan-800/60 hover:text-cyan-100"
                                    }`}
                                    title={
                                      sceneRow.surfaced
                                        ? "Evidence already surfaces this character in the scene; click to add an analyst activation marker."
                                        : sceneRow.staged
                                          ? "Analyst activation marker is on; click to turn it off."
                                          : "Click to mark this character present in the scene."
                                    }
                                  >
                                    S{sceneRow.scene.scene_index ?? sceneRow.sceneIndex + 1}
                                  </button>
                                );
                              })}
                            </div>
                            {open && (
                              <div className="border-t border-slate-800 px-2 py-1.5">
                                {visibleScenes.length > 0 ? (
                                  <div className="space-y-1">
                                    {visibleScenes.map((sceneRow) => (
                                      <div
                                        key={`${profileKey}:scene-list:${sceneRow.sceneKey}`}
                                        className="rounded border border-slate-800 bg-[#101010] px-1.5 py-1"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveSceneIndex(sceneRow.sceneIndex);
                                              openVideoAtTime(selectedVideoId, sceneRow.scene.start);
                                            }}
                                            className="text-[9px] text-cyan-100 hover:underline"
                                          >
                                            Scene {sceneRow.scene.scene_index ?? sceneRow.sceneIndex + 1} / {formatTime(sceneRow.scene.start)}
                                          </button>
                                          <span className="text-[9px] text-slate-500">
                                            {sceneRow.staged ? "staged" : "surfaced"} / manual {sceneRow.manualAnnotations.length} / audio {sceneRow.audioProsody.length} / samples {sceneRow.sourceSamples.length} / cues {sceneRow.sceneInstructions.length} / lines {sceneRow.lines.length}
                                          </span>
                                        </div>
                                        {sceneRow.manualAnnotations[0] && (
                                          <button
                                            type="button"
                                            onClick={() => openVideoAtTime(selectedVideoId, manualAnnotationStart(sceneRow.manualAnnotations[0]))}
                                            className="mt-1 block w-full truncate text-left text-[9px] text-emerald-200 hover:text-emerald-100"
                                          >
                                            manual indication: {sceneRow.manualAnnotations[0].identity_affirmation || sceneRow.manualAnnotations[0].role_affirmation || sceneRow.manualAnnotations[0].label} / {formatTime(manualAnnotationStart(sceneRow.manualAnnotations[0]))}
                                          </button>
                                        )}
                                        {sceneRow.lines[0] && (
                                          <button
                                            type="button"
                                            onClick={() => openVideoAtTime(selectedVideoId, sceneRow.lines[0].start)}
                                            className="mt-1 block w-full truncate text-left text-[9px] text-slate-400 hover:text-cyan-100"
                                          >
                                            {sceneRow.lines[0].speaker}: {sceneRow.lines[0].text}
                                          </button>
                                        )}
                                        {sceneRow.audioProsody[0] && (
                                          <button
                                            type="button"
                                            onClick={() => openVideoAtTime(selectedVideoId, Number(sceneRow.audioProsody[0].start || 0))}
                                            className="mt-1 block w-full truncate text-left text-[9px] text-sky-200 hover:text-sky-100"
                                          >
                                            audio prosody: {sceneRow.audioProsody[0].emphasis?.label || sceneRow.audioProsody[0].pace?.label || "cue"} / {formatTime(Number(sceneRow.audioProsody[0].start || 0))}
                                          </button>
                                        )}
                                        {sceneRow.sourceSamples[0] && (
                                          <button
                                            type="button"
                                            onClick={() => openVideoAtTime(selectedVideoId, Number(sceneRow.sourceSamples[0].time_start || 0))}
                                            className="mt-1 block w-full truncate text-left text-[9px] text-amber-200 hover:text-amber-100"
                                          >
                                            source sample: {sceneRow.sourceSamples[0].label || sceneRow.sourceSamples[0].sample_type || "sample"} / {formatTime(Number(sceneRow.sourceSamples[0].time_start || 0))}
                                          </button>
                                        )}
                                        {sceneRow.persistenceSignals.length > 0 && (
                                          <div className="mt-1 text-[9px] text-violet-100">
                                            agent persistence signal available
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[9px] text-slate-500">
                                    No surfaced or staged scenes yet. Use Add to scene in the Scene Agent Browser to stage this profile.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div
                  ref={dramaticArchetypeReadingsRef}
                  className="scroll-mt-2 mt-2 rounded border border-slate-800 bg-[#101010] px-2 py-2"
                  data-vaa1-meaning-plot-dramatic-archetypes="true"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                        Dramatic Archetype Readings
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        Cross-tradition interpretive lenses; not fixed Narrative Agent labels.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {DRAMATIC_ARCHETYPE_LENSES.map((lens) => (
                        <button
                          key={lens.id}
                          type="button"
                          onClick={() => setActiveArchetypeLens(lens.id)}
                          className={`rounded border px-1.5 py-0.5 text-[10px] ${
                            activeArchetypeLens === lens.id
                              ? "border-cyan-600/60 bg-cyan-950/35 text-cyan-100"
                              : "border-slate-700 bg-[#121212] text-slate-400 hover:bg-white/5"
                          }`}
                        >
                          {lens.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 rounded border border-cyan-900/40 bg-cyan-950/10 px-2 py-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium text-cyan-100">
                          {activeArchetype.tradition}: {activeArchetype.label}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {activeArchetype.insight}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[10px] text-cyan-200">
                        {activeArchetypeMatches.length} matching cue
                        {activeArchetypeMatches.length === 1 ? "" : "s"}
                        {strongestArchetypeParticipant
                          ? ` • strongest: ${strongestArchetypeParticipant[0]}`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeArchetype.cues.map((cue) => (
                      <span
                        key={`${activeArchetypeLens}:${cue}`}
                        className="rounded border border-slate-700 bg-[#121212] px-1.5 py-0.5 text-[10px] text-slate-300"
                      >
                        {cue}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div
                ref={participantRankingRef}
                className="scroll-mt-2 min-h-0 flex-1 space-y-3 overflow-auto p-2"
                data-vaa1-meaning-plot-participant-ranking="true"
              >
                {participantGroups.length ? (
                  participantGroups.map(([participant, items]) => {
                    const matchedProfiles = narrativeAgentProfiles.filter((profile) =>
                      profileMatchesParticipant(profile, participant),
                    );
                    const persistenceSignals = agentPersistenceInstructionsForParticipant(
                      instructions,
                      participant,
                    );
                    return (
                    <div key={participant} className="rounded border border-slate-800 bg-[#101010]/60">
                      <div className="border-b border-slate-800 px-2.5 py-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-300">{participant}</div>
                          <div className="flex flex-wrap gap-1">
                            {participantTopArchetypes(items).map(({ lens, score }) => (
                              <span
                                key={`${participant}:${lens.id}`}
                                className={`rounded border px-1.5 py-0.5 text-[9px] ${
                                  lens.id === activeArchetypeLens
                                    ? "border-cyan-700/70 bg-cyan-950/30 text-cyan-100"
                                    : "border-slate-700 bg-[#121212] text-slate-400"
                                }`}
                                title={`Interpretive cue support ${score.toFixed(2)}`}
                              >
                                {lens.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                          <span>
                            {activeArchetype.label}:{" "}
                            {archetypeScore(items, activeArchetypeLens).toFixed(1)}
                          </span>
                          {matchedArchetypeCues(items, activeArchetypeLens).map((cue) => (
                            <span
                              key={`${participant}:${activeArchetypeLens}:${cue}`}
                              className="rounded border border-cyan-900/50 bg-cyan-950/15 px-1.5 py-0.5 text-cyan-100/80"
                            >
                              {cue}
                            </span>
                          ))}
                          {matchedArchetypeCues(items, activeArchetypeLens).length === 0 && (
                            <span>No direct cue for selected lens</span>
                          )}
                        </div>
                        {(matchedProfiles.length > 0 || persistenceSignals.length > 0) && (
                          <div className="mt-2 rounded border border-cyan-900/40 bg-cyan-950/10 px-2 py-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-cyan-200">
                                Narrative Agent Profile
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {matchedProfiles.length} profile{matchedProfiles.length === 1 ? "" : "s"}
                                {persistenceSignals.length
                                  ? ` / ${persistenceSignals.length} persistence signal${persistenceSignals.length === 1 ? "" : "s"}`
                                  : ""}
                              </div>
                            </div>
                            {matchedProfiles.slice(0, 2).map((profile, profileIndex) => (
                              <div
                                key={profile.profile_id || `${participant}:profile:${profileIndex}`}
                                className="mt-1 text-[10px] leading-relaxed text-slate-300"
                              >
                                <span className="text-cyan-100">
                                  {formatNarrativeAgentProfileBrief(profile)}
                                </span>
                                {profile.source_metadata?.role_description ? (
                                  <span className="text-slate-500">
                                    {" "}
                                    - {profile.source_metadata.role_description}
                                  </span>
                                ) : null}
                                {narrativeAgentProfileEvidenceChips(profile).length > 0 ? (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {narrativeAgentProfileEvidenceChips(profile).map((chip) => (
                                      <span
                                        key={`${profile.profile_id || participant}:${chip}`}
                                        className="rounded border border-slate-700 bg-[#101010] px-1.5 py-0.5 text-[9px] text-slate-400"
                                      >
                                        {chip}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                            {persistenceSignals.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {persistenceSignals.slice(0, 3).map((signal) => (
                                  <button
                                    key={signal.instruction_id}
                                    type="button"
                                    onClick={() => navigateToInstruction(signal)}
                                    className="rounded border border-violet-500/30 bg-violet-950/20 px-1.5 py-0.5 text-[9px] text-violet-100 hover:bg-violet-900/30"
                                    title="Jump to agent sample-profile persistence evidence"
                                  >
                                    agent persistence {supportLabel(signal)}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 p-1.5">
                        {items.length > 0 ? [...items]
                          .sort((left, right) => {
                            const rightMatch = archetypeMatches([right], activeArchetypeLens).length;
                            const leftMatch = archetypeMatches([left], activeArchetypeLens).length;
                            if (rightMatch !== leftMatch) return rightMatch - leftMatch;
                            return supportScore(right) - supportScore(left);
                          })
                          .map((instruction) => (
                            <InstructionItem
                              key={instruction.instruction_id}
                              instruction={instruction}
                              activeLens={activeLens}
                              showLens
                              onNavigate={navigateToInstruction}
                            />
                          )) : (
                          <div className="rounded border border-slate-800 bg-[#101010] px-2.5 py-2 text-[11px] text-slate-500">
                            Metadata-seeded Narrative Agent Profile. No detected character-path cues have surfaced yet.
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <div className="px-2 py-3 text-[12px] text-slate-500">
                    No character-path candidates yet.
                  </div>
                )}
              </div>
            </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
