import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function quotedValues(source) {
  return [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function unique(values) {
  return [...new Set(values)];
}

const apiService = read("lib/api-service.ts");
const videoNavigation = read("lib/video-navigation.ts");
const videoPanel = read("app/V2components/components/panels/VideoPanel.tsx");
const toolsPanel = read("app/V2components/components/panels/ToolsPanel.tsx");
const ocrPanel = read("app/V2components/components/panels/OCRPanel.tsx");
const expressionPanel = read("app/V2components/components/panels/ExpressionPanel.tsx");
const posAnalyzePanel = read("app/V2components/components/panels/POSAnalyzePanel.tsx");
const posMatrixPanel = read("app/V2components/components/panels/POSMatrixPanel.tsx");
const quantAnalysisPanel = read("app/V2components/components/panels/QuantitativeAnalysisPanel.tsx");
const quantMatrixPanel = read("app/V2components/components/panels/QuantMatrixPanel.tsx");
const speechPanel = read("app/V2components/components/panels/SpeechToTextPanel.tsx");
const timeBankPanel = read("app/V2components/components/panels/TimeBankPanel.tsx");
const meaningPlotPanel = read("app/V2components/components/panels/MeaningPlotPanel.tsx");
const sourceMediaPanel = read("app/V2components/components/panels/SourceMediaMetadataPanel.tsx");
const globalsCss = read("styles/globals.css");
const objPanel = read("app/V2components/components/panels/OBJDetectionPanel.tsx");
const layoutHost = read("app/V2components/components/LayoutHost.tsx");
const masterSchemaPanel = read("app/V2components/components/panels/MasterSchemaPanel.tsx");
const sceneCardPanel = read("app/V2components/components/panels/SceneCardPanel.tsx");
const tracebackDrawerPanel = read("app/V2components/components/panels/TracebackDrawerPanel.tsx");
const secondOrderAffirmations = read(
  "app/V2components/components/panels/SecondOrderLabelAffirmations.tsx",
);
const videoService = read("lib/video-service.ts");
const evidenceAuthority = read("lib/evidence-authority.ts");
const sceneGovernance = read("lib/scene-governance.ts");

function manualCategoryUnion() {
  const block = apiService.match(
    /export interface ManualVisualAnnotation[\s\S]*?category:\s*([\s\S]*?);/,
  )?.[1];
  assert.ok(block, "ManualVisualAnnotation.category union was not found");
  return unique(quotedValues(block));
}

function nativeAnnotationCategories() {
  const block = videoPanel.match(
    /const NATIVE_ANNOTATION_CATEGORIES[\s\S]*?=\s*\[([\s\S]*?)\];/,
  )?.[1];
  assert.ok(block, "NATIVE_ANNOTATION_CATEGORIES was not found");
  return unique(quotedValues(block));
}

function forensicIntentOptions(source) {
  const block = source.match(
    /const FORENSIC_ROI_INTENT_OPTIONS[\s\S]*?=\s*\[([\s\S]*?)\];/,
  )?.[1];
  assert.ok(block, "FORENSIC_ROI_INTENT_OPTIONS was not found");
  return unique(
    [...block.matchAll(/value:\s*"([^"]+)"/g)].map((match) => match[1]),
  );
}

function toolsLeafCategories() {
  const block = toolsPanel.match(
    /const MANUAL_LEAF_NAV_OPTIONS[\s\S]*?=\s*\[([\s\S]*?)\];/,
  )?.[1];
  assert.ok(block, "MANUAL_LEAF_NAV_OPTIONS was not found");
  return unique(
    [...block.matchAll(/category:\s*"([^"]+)"/g)].map((match) => match[1]),
  );
}

function toolsLeafPanelTypes() {
  const block = toolsPanel.match(
    /const MANUAL_LEAF_NAV_OPTIONS[\s\S]*?=\s*\[([\s\S]*?)\];/,
  )?.[1];
  assert.ok(block, "MANUAL_LEAF_NAV_OPTIONS was not found");
  return unique(
    [...block.matchAll(/panelType:\s*"([^"]+)"/g)].map((match) => match[1]),
  );
}

function layoutLeafConfigs() {
  const block = layoutHost.match(
    /const MANUAL_LEAF_PANEL_CONFIGS\s*=\s*\[([\s\S]*?)\];/,
  )?.[1];
  assert.ok(block, "MANUAL_LEAF_PANEL_CONFIGS was not found");

  return [...block.matchAll(/componentType:\s*"([^"]+)"[\s\S]*?category:\s*"([^"]+)"/g)].map(
    (match) => ({
      componentType: match[1],
      category: match[2],
    }),
  );
}

function registeredPanelTypes() {
  const explicitFactories = [
    ...layoutHost.matchAll(/registerComponentFactoryFunction\(\s*"([^"]+)"/g),
  ].map((match) => match[1]);

  return unique([
    ...explicitFactories,
    ...layoutLeafConfigs().map((config) => config.componentType),
  ]);
}

function keyExistsForCategoryInSubcategoryMap(category) {
  const block = videoPanel.match(
    /const NATIVE_ANNOTATION_SUBCATEGORIES[\s\S]*?=\s*\{([\s\S]*?)\};/,
  )?.[1];
  assert.ok(block, "NATIVE_ANNOTATION_SUBCATEGORIES was not found");

  const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quotedKey = new RegExp(`"${escaped}"\\s*:`);
  const bareKey = new RegExp(`(^|\\n)\\s*${escaped}\\s*:`);
  return quotedKey.test(block) || bareKey.test(block);
}

test("manual annotation categories stay aligned across type, video UI, and Tools navigation", () => {
  const canonical = manualCategoryUnion();

  assert.deepEqual(nativeAnnotationCategories(), canonical);
  assert.deepEqual(toolsLeafCategories(), canonical);
});

test("manual annotation categories stay alphabetized for governance dropdowns", () => {
  const canonical = manualCategoryUnion();
  const sorted = [...canonical].sort((left, right) => left.localeCompare(right));

  assert.deepEqual(canonical, sorted);
});

test("every manual category has subcategory support in the native video annotator", () => {
  for (const category of manualCategoryUnion()) {
    assert.equal(
      keyExistsForCategoryInSubcategoryMap(category),
      true,
      `${category} is missing from NATIVE_ANNOTATION_SUBCATEGORIES`,
    );
  }
});

test("Tools leaf routes point only to registered GoldenLayout panels", () => {
  const validPanels = registeredPanelTypes();

  for (const panelType of toolsLeafPanelTypes()) {
    assert.equal(
      validPanels.includes(panelType),
      true,
      `${panelType} is not registered in LayoutHost`,
    );
  }
});

test("every manual category has a Master Schema leaf panel available", () => {
  const categoriesFromType = manualCategoryUnion();
  const categoriesFromLeaves = layoutLeafConfigs().map((config) => config.category);

  assert.deepEqual(categoriesFromLeaves, categoriesFromType);
  assert.match(
    layoutHost,
    /new ReactComponentWrapper\(\s*container,\s*MasterSchemaPanel,[\s\S]*?category:\s*leaf\.category/,
    "manual leaf panels must render through MasterSchemaPanel with category filtering",
  );
});

test("forensic ROI intent options stay aligned across Tools and Video panels", () => {
  const toolsIntents = forensicIntentOptions(toolsPanel);
  const videoIntents = forensicIntentOptions(videoPanel);

  assert.deepEqual(toolsIntents, videoIntents);
  assert.equal(
    toolsIntents.includes("micro_expression"),
    true,
    "micro_expression forensic intent must remain available in both panels",
  );
});

test("Objects panel remains a leaf, not the master schema sink", () => {
  assert.match(
    videoService,
    /entry\.category === "OBJ" \|\| isExpressionOwnerPersonRequest\(entry\)/,
    "manual OBJ annotations and explicit expression-owner person requests should be converted into DetectedObject rows",
  );

  assert.match(
    videoService,
    /function groupManualVisualAnnotationsByCategory/,
    "manual annotations must remain grouped by category for Master Schema and leaf panels",
  );
});

test("manual bbox geometry stays timestamp scoped", () => {
  assert.match(
    apiService,
    /geometry_keyframes\?:\s*Array<\{\s*time:\s*number;[\s\S]*?coordinates:/,
    "manual visual annotations must support timestamped bbox keyframes",
  );

  assert.match(
    videoPanel,
    /type OverlayGeometryDraft\s*=\s*\{[\s\S]*?box:\s*DraftBox;[\s\S]*?time:\s*number;/,
    "temporary bbox drag state must store the timestamp it belongs to",
  );

  assert.match(
    videoPanel,
    /Math\.abs\(draft\.time - currentTime\)\s*<=\s*0\.075/,
    "temporary bbox drafts must not override keyframe geometry at other timestamps",
  );

  assert.match(
    videoPanel,
    /MANUAL_GEOMETRY_INTERPOLATION_MAX_GAP_SECONDS/,
    "manual bbox geometry must not interpolate freely across distant timestamps or cuts",
  );

  assert.match(
    videoPanel,
    /allManualVisualAnnotations\.find\(\(item\) => item\.id === annotationId\)/,
    "saving an object-backed bbox must load existing manual keyframes before adding a new timestamp",
  );

  assert.match(
    videoPanel,
    /currentTime >= bounds\.timestamp &&[\s\S]*currentTime <= bounds\.timestamp \+ MANUAL_POINT_VISIBILITY_SECONDS/,
    "manual point annotations must not surface before their actual timestamp",
  );

  assert.match(
    videoPanel,
    /currentTime >= bounds\.start &&[\s\S]*currentTime <= bounds\.end \+ MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS/,
    "manual interval annotations must not surface before their actual in time",
  );

  assert.match(
    videoPanel,
    /const isManualAnnotationVisibleInSelectedWorkspace = React\.useCallback\(/,
    "selected manual annotations must support an explicit editing workspace",
  );

  assert.match(
    videoPanel,
    /selectedOverlayTimelinePadding\[selectedOverlayKey\]/,
    "selected manual annotation workspace visibility must include the expanded bbox slider workspace",
  );

  assert.match(
    videoPanel,
    /selectedOverlaySnapshot[\s\S]*!overlays\.some\(\(overlay\) => overlay\.key === selectedOverlayKey\)/,
    "selected object bbox must stay pinned while the analyst scrubs inside the expanded workspace",
  );

  assert.match(
    videoPanel,
    /const manualOverridesByObjectTrack = new Map<string, ManualVisualAnnotation\[]>/,
    "manual object-track corrections must be tracked as time-aware sets, not a single override per track",
  );

  assert.match(
    videoPanel,
    /trackMatches\.find\(\s*\(entry\)\s*=>\s*isManualAnnotationVisibleAtTime\(entry, currentTime\)\s*\|\|\s*isManualAnnotationVisibleInSelectedWorkspace\(entry\)/,
    "video overlays must choose the active manual correction for a track by time/workspace",
  );

  assert.match(
    videoPanel,
    /isManualAnnotationVisibleAtTime\(selectedManual, currentTime\) \|\|\s*isManualAnnotationVisibleInSelectedWorkspace\(selectedManual\)/,
    "selected manual annotations should remain visible inside their active edit workspace",
  );

  assert.doesNotMatch(
    videoPanel,
    /const scrubAndExtendSelectedOverlay[\s\S]*?if \(!overdraftActive\) \{\s*return;\s*\}/,
    "selected bbox timeline scrubbing should keep extending the active edit when the scrub moves outside saved bounds",
  );

  assert.match(
    videoPanel,
    /const workspaceStart = clamp\(\s*intervalStart - Math\.max\(0, timelinePadding\.before\)/,
    "selected bbox slider should allow an explicit temporary workspace before the saved interval",
  );

  assert.match(
    videoPanel,
    /const workspaceEnd = clamp\(\s*intervalEnd \+ Math\.max\(0, timelinePadding\.after\)/,
    "selected bbox slider should allow an explicit temporary workspace after the saved interval",
  );

  assert.match(
    videoPanel,
    /setSelectedOverlayTimelinePadding\(\(current\) => \{[\s\S]*before: existing\.before \+ continuationSeconds,[\s\S]*after: existing\.after \+ continuationSeconds,/,
    "Extend in should add requested temporary slider workspace before and after the selected interval",
  );

  assert.match(
    videoPanel,
    /const \[selectedOverlayTimeDrag, setSelectedOverlayTimeDrag\]/,
    "bbox time framing should support one drag gesture over the slider",
  );

  assert.match(
    videoPanel,
    /finishSelectedOverlayTimeDraw\(overlay\.key, scrubValue\)/,
    "releasing the selected bbox slider should commit the drawn in/out interval",
  );

  assert.match(
    videoPanel,
    /type LockedForensicRoi = \{[\s\S]*box: DraftBox;[\s\S]*videoId\?: string;[\s\S]*time\?: number;/,
    "locked ROI overlays must carry video/time scope instead of rendering as global boxes",
  );

  assert.match(
    videoPanel,
    /const visibleLockedForensicRoiBox = useMemo\(\(\) => \{/,
    "locked ROI overlays must resolve through scoped visibility before rendering",
  );

  assert.match(
    videoPanel,
    /setLockedForensicRoiBox\(null\);[\s\S]*setNativeAnnotationMode\(true\)/,
    "opening native annotation mode must clear stale locked ROI overlays",
  );

  assert.match(
    videoPanel,
    /const minSize = 0\.004/,
    "bbox resize should allow analyst-scale small boxes without coarse minimum sizing",
  );

  assert.doesNotMatch(
    videoPanel,
    /jumpToTime\(nextStart\)|jumpToTime\(nextEnd\)/,
    "Extend in/out must not seek playback away from the analyst's current frame",
  );

  assert.doesNotMatch(
    videoPanel,
    /Math\.min\(start, end\)\s*-\s*0\.2/,
    "object override visibility must not use an early pre-roll before the analyst in time",
  );

  assert.doesNotMatch(
    videoPanel,
    /spanStart - 0\.06/,
    "raw object overlays must not surface before their actual start timestamp",
  );

  assert.doesNotMatch(
    videoPanel,
    /Math\.abs\(\(item\.timestamp \?\? spanStart\) - currentTime\)\s*<=\s*0\.35/,
    "point detections must not surface symmetrically before their actual timestamp",
  );

  assert.match(
    videoPanel,
    /clearOverlayEditingWorkspace\(\[overlay\.key,\s*`manual-\$\{annotation\.id\}`\]\)/,
    "saving an indication must clear temporary bbox workspace so saved keyframes become authoritative",
  );

  assert.doesNotMatch(
    videoPanel,
    /source:\s*"indication_editor"/,
    "saving a video bbox indication should close locally without forcing a surprise panel focus jump",
  );
});

test("manual annotation panels use shared VAA1 video navigation helpers", () => {
  assert.match(
    videoNavigation,
    /export function openManualAnnotationInVideo/,
    "shared manual video navigation helper must exist",
  );

  assert.match(
    videoNavigation,
    /focusVideoPanel\?:\s*boolean/,
    "manual annotation sync must support updating video evidence without stealing panel focus",
  );

  assert.match(
    videoNavigation,
    /export function closeManualAnnotationInVideo/,
    "manual annotation editor close state must sync to the video bbox editor",
  );

  assert.match(
    videoPanel,
    /eventBus\.on\("videoIndicationEditClose"/,
    "VideoPanel must close the matching bbox editor when a linked annotation editor closes",
  );

  for (const source of [
    masterSchemaPanel,
    toolsPanel,
    ocrPanel,
    expressionPanel,
    speechPanel,
    objPanel,
  ]) {
    assert.match(
      source,
      /openManualAnnotationInVideo\(/,
      "manual annotation panels should use shared video navigation",
    );
  }

  assert.match(
    objPanel,
    /openObjectIndicationInVideo\(/,
    "object indication editing should use shared video navigation",
  );
});

test("detection and analysis panels use shared VAA1 video seek navigation", () => {
  assert.match(
    videoNavigation,
    /export function openVideoAtTime/,
    "shared video seek helper must exist",
  );

  for (const source of [
    ocrPanel,
    expressionPanel,
    speechPanel,
    toolsPanel,
    posAnalyzePanel,
    posMatrixPanel,
    quantAnalysisPanel,
    quantMatrixPanel,
    timeBankPanel,
  ]) {
    assert.match(
      source,
      /openVideoAtTime|openSharedVideoAtTime/,
      "detection and analysis panels should use shared video seek navigation",
    );
  }
});

test("linked evidence authority is centralized before panel navigation", () => {
  assert.match(
    evidenceAuthority,
    /export type ResolvedEvidenceItem = \{/,
    "panel-facing evidence must have one resolved contract",
  );

  assert.match(
    evidenceAuthority,
    /export type EvidenceNavigationState = \{/,
    "active evidence navigation must be represented as shared state",
  );

  assert.match(
    evidenceAuthority,
    /export const EVIDENCE_AUTHORITY_ORDER[\s\S]*raw_detection:\s*10,[\s\S]*grouped_detection:\s*20,[\s\S]*manual_annotation:\s*30,[\s\S]*manual_correction:\s*40,/,
    "manual correction must outrank manual annotation, grouped detection, and raw detection",
  );

  assert.match(
    evidenceAuthority,
    /export function resolveManualVisualEvidence/,
    "manual annotations and corrections must resolve through the evidence authority layer",
  );

  assert.match(
    evidenceAuthority,
    /export function resolveDetectedObjectEvidence/,
    "raw and grouped detections must resolve through the evidence authority layer",
  );

  assert.match(
    evidenceAuthority,
    /export function resolveAuthoritativeEvidence/,
    "panels must be able to request the authoritative evidence candidate instead of rebuilding authority locally",
  );

  assert.match(
    evidenceAuthority,
    /metadata_correlation[\s\S]*\?\s*"manual_correction"[\s\S]*:\s*"manual_annotation"/,
    "manual annotations linked to source evidence must be treated as manual corrections",
  );
});

test("video bbox labels consume Master Schema maturity before raw detector labels", () => {
  assert.match(
    videoService,
    /vaa1_annotation_master_schema\?: unknown;/,
    "analysis status must expose the Master Schema artifact to the frontend service",
  );

  assert.match(
    videoService,
    /records\.push\(\.\.\.masterSchemaObjectRecords\(masterSchema\)\)/,
    "resolved evidence must include Master Schema object and track records",
  );

  assert.match(
    videoPanel,
    /function buildMatureObjectOverlayLookup/,
    "VideoPanel must build a mature object lookup from resolved Master Schema evidence",
  );

  assert.match(
    videoPanel,
    /masterSchemaMatureOverride[\s\S]*matureProliferatedOverride/,
    "BBox overlays must consult Master Schema mature labels before proliferation/raw fallbacks",
  );

  assert.match(
    videoPanel,
    /master_schema_mature_label/,
    "BBox source items must carry the chosen Master Schema label for traceback",
  );
});

test("video bbox labels keep mature narrative-agent identity above plot cues", () => {
  assert.match(
    videoPanel,
    /function buildMatureSubjectOverlayLookup/,
    "VideoPanel must build a target-bound subject lookup from resolved Master Schema evidence",
  );

  assert.match(
    videoPanel,
    /narrativeAgentOverride[\s\S]*localOverride[\s\S]*masterSchemaMatureOverride[\s\S]*matureProliferatedOverride/,
    "BBox overlays must prioritize Narrative Agent Recognition before object labels, plot proliferation, or raw labels",
  );

  assert.match(
    videoPanel,
    /roleLabelForNarrativeAgent/,
    "BBox subject labels must be able to append mature character-role metadata such as The Protagonist",
  );

  assert.match(
    videoPanel,
    /hasNarrativeAgentRecognition[\s\S]*\?\s*""[\s\S]*identityLabel/,
    "second-order Identification/Role cues must not replace a confirmed narrative-agent bbox label",
  );

  assert.match(
    videoPanel,
    /narrative_agent_recognition/,
    "BBox source items must carry narrative-agent provenance for traceback",
  );
});

test("Master Schema surfaces the user-confirmed anchor confirmation program", () => {
  assert.match(
    videoService,
    /export interface MasterSchemaMaturityAudit/,
    "frontend analysis data must type the Master Schema maturity audit",
  );

  assert.match(
    videoService,
    /masterSchemaMaturityAudit:\s*masterSchemaMaturityAudit\(/,
    "video service must expose the audit on panel-facing analysis metadata",
  );

  assert.match(
    masterSchemaPanel,
    /function ConfirmationProgramStrip/,
    "Master Schema panel must render the confirmation program strip",
  );

  assert.match(
    masterSchemaPanel,
    /User Confirmed Anchor/,
    "Master Schema panel must name user-confirmed evidence as the analysis anchor",
  );

  assert.match(
    masterSchemaPanel,
    /Concise Pattern Confirmations/,
    "Master Schema panel must surface concise program-wide confirmation families",
  );
});

test("Master Schema is the mature subject source for narrative agents", () => {
  assert.match(
    videoService,
    /masterSchemaNarrativeAgentRecords/,
    "frontend service must resolve Master Schema narrative-agent and character-role records",
  );

  assert.match(
    videoService,
    /narrative_agent_profile_annotations/,
    "Master Schema narrative-agent profiles must be promoted into resolved evidence",
  );

  assert.match(
    videoService,
    /character_role_annotations/,
    "Master Schema character-role metadata must be promoted into resolved evidence",
  );

  assert.match(
    videoService,
    /manualAnnotationNarrativeAgentRecords/,
    "manual Identification/Role annotations must be promoted into the resolved subject authority stream",
  );

  assert.match(
    videoService,
    /hasManualSubjectAffirmation/,
    "manual identity or role affirmations must surface as subjects even when stored under another annotation category",
  );

  assert.match(
    videoService,
    /master_schema\.review_layer\.manual_subject_annotation/,
    "manual subject indications must keep Master Schema review-layer provenance",
  );

  assert.match(
    videoService,
    /manualTargetId[\s\S]*timestamp_seconds[\s\S]*targetId:\s*manualTargetId \|\| item\.id/,
    "manual subject promotion must preserve target/time-bound James Bond indications instead of deduping only by character name",
  );

  assert.match(
    masterSchemaPanel,
    /Master Schema Subject Authority/,
    "Master Schema panel must visibly surface governed subject authority",
  );

  assert.match(
    meaningPlotPanel,
    /masterSchemaNarrativeAgentProfiles/,
    "Meaning / Plot must read Narrative Agent Profiles from Master Schema first",
  );

  assert.match(
    meaningPlotPanel,
    /narrativeAgentProfiles\.length\s*\?\s*\[\]/,
    "Meaning / Plot must suppress unknown participant fallback when governed profiles exist",
  );

  assert.match(
    meaningPlotPanel,
    /isUnknownAgentLabel/,
    "Meaning / Plot must reject unknown participant labels before building character governance rows",
  );

  assert.match(
    meaningPlotPanel,
    /sceneCardProfiles/,
    "Meaning / Plot must include Scene Card subjects after Master Schema and Source Media metadata",
  );
});

test("Meaning Plot keeps confirmation families anchor-aware", () => {
  assert.match(
    meaningPlotPanel,
    /function MeaningPlotConfirmationStrip/,
    "Meaning / Plot must expose a confirmation strip for mature meaning proliferation",
  );

  assert.match(
    meaningPlotPanel,
    /Anchor-Aware Meaning Confirmation/,
    "Meaning / Plot must name anchor-aware confirmation in the UI",
  );

  assert.match(
    meaningPlotPanel,
    /narrative_structure_meaning_plot_confirmation/,
    "Meaning / Plot must surface the narrative structure confirmation family",
  );

  assert.match(
    meaningPlotPanel,
    /mise_en_scene_level_understanding/,
    "Meaning / Plot must surface the mise-en-scene understanding confirmation family",
  );
});

test("Meaning Plot character paths keep dramatic archetypes electable", () => {
  assert.match(
    meaningPlotPanel,
    /const DRAMATIC_ARCHETYPE_LENSES/,
    "Meaning / Plot must define dramatic archetype lenses for Character Paths",
  );

  assert.match(
    meaningPlotPanel,
    /Dramatic Archetype Readings/,
    "Character Paths must visibly surface dramatic archetype readings",
  );

  assert.match(
    meaningPlotPanel,
    /Cross-tradition interpretive lenses; not identity labels/,
    "archetypes must remain electable readings rather than imposed identities",
  );

  assert.match(
    meaningPlotPanel,
    /tradition:\s*"Proppian"/,
    "dramatic archetypes must include non-Shakespearean traditions",
  );

  assert.match(
    meaningPlotPanel,
    /tradition:\s*"Jungian \/ Mythic"/,
    "dramatic archetypes must include symbolic/mythic readings",
  );

  assert.match(
    meaningPlotPanel,
    /sortParticipantGroupsByArchetype/,
    "selecting an archetype lens must change participant ranking in the analyzed context",
  );

  assert.match(
    meaningPlotPanel,
    /strongest:/,
    "selected archetype lenses must surface contextual insight, not only buttons",
  );

  assert.match(
    meaningPlotPanel,
    /participantTopArchetypes/,
    "participant rows should show archetype signal companions",
  );

  assert.match(
    meaningPlotPanel,
    /buildParticipantGroupsWithMetadataProfiles/,
    "Character Paths must seed the character list from media metadata Narrative Agent Profiles",
  );

  assert.match(
    meaningPlotPanel,
    /Metadata-seeded Narrative Agent Profile/,
    "metadata-seeded agents must remain visible before detected cues surface",
  );
});

test("Meaning Plot character paths expose scene-based narrative agent browsing", () => {
  assert.match(
    sceneGovernance,
    /masterSchemaTemporalSegmentsFromAnalysis/,
    "frontend panels must share a Master Schema-first scene segment reader",
  );

  assert.match(
    meaningPlotPanel,
    /matureSceneSegmentsFromAnalysis\(analysisData\)/,
    "Meaning / Plot must consume mature scene segments before deriving scene windows",
  );

  assert.match(
    toolsPanel,
    /matureSceneSegmentsFromAnalysis\(analysisData\)/,
    "Scene leaf tooling must consume mature scene segments from the shared scene governance helper",
  );

  assert.match(
    read("app/V2components/components/panels/SceneCardPanel.tsx"),
    /governed scene/,
    "Scene Cards must disclose governed scene count when card materialization lags Master Schema scene understanding",
  );

  assert.match(
    meaningPlotPanel,
    /Scene Agent Browser/,
    "Meaning / Plot must expose a scene browser for Narrative Agent Profiles",
  );

  assert.match(
    meaningPlotPanel,
    /Add to scene/,
    "scene browser must let analysts stage Narrative Agent Profiles into scenes",
  );

  assert.match(
    meaningPlotPanel,
    /lineMatchesProfile/,
    "scene browser must surface agent-linked transcript lines",
  );

  assert.match(
    meaningPlotPanel,
    /expressionSamplesForSceneAgent/,
    "scene browser must surface agent-linked expression samples",
  );

  assert.match(
    meaningPlotPanel,
    /agent_persistence_scene_cut/,
    "scene browser must expose agent persistence signals",
  );

  assert.match(
    meaningPlotPanel,
    /Characters By Scene/,
    "Meaning / Plot must expose a collapsed governance list of characters by scene",
  );

  assert.match(
    meaningPlotPanel,
    /fallbackSceneSegmentsFromInstructions/,
    "scene governance must derive browsable evidence windows when formal scene segments are absent",
  );

  assert.match(
    meaningPlotPanel,
    /sceneSegmentsAreDerived/,
    "the UI must disclose derived evidence windows instead of silently hiding scene browsing",
  );

  assert.match(
    meaningPlotPanel,
    /participantRows/,
    "character-by-scene governance must fall back to surfaced participants when metadata profiles are absent",
  );

  assert.match(
    meaningPlotPanel,
    /openCharacterSceneProfiles/,
    "character scene rows must be independently expandable",
  );

  assert.match(
    meaningPlotPanel,
    /toggleProfileSceneActivation/,
    "Characters By Scene must provide in-place multi-scene activation switches per character",
  );

  assert.match(
    meaningPlotPanel,
    /\$\{profileKey\}:scene-switch/,
    "scene activation switches must render under each character row rather than navigating away",
  );

  assert.match(
    meaningPlotPanel,
    /sceneSegments\.map/,
    "scene browsing must expose the whole scene array instead of a sliced subset",
  );

  assert.match(
    meaningPlotPanel,
    /min-h-0 flex-1 overflow-hidden p-3/,
    "Meaning / Plot body must constrain height so child panels can scroll through full data arrays",
  );
});

test("Narrative Agent Profiles expose agent narrative analytic layers", () => {
  assert.match(
    sourceMediaPanel,
    /Agent Narrative Profiles track an agent path through narrative time/,
    "Narrative Agent Profiles must explain agent path and narrative context maturation",
  );

  assert.match(
    sourceMediaPanel,
    /const AGENT_NARRATIVE_PROFILE_LAYERS/,
    "Narrative Agent Profiles must define path, context, network, and evidence layers",
  );

  assert.match(
    sourceMediaPanel,
    /Agent Narrative Profile/,
    "Source Media metadata must visibly surface Agent Narrative Profile layers",
  );

  assert.match(
    sourceMediaPanel,
    /Cross-tradition readings/,
    "Narrative Agent Profiles must make dramatic readings available in-profile",
  );

  assert.match(
    sourceMediaPanel,
    /tradition:\s*"Greimasian"/,
    "Narrative Agent Profile readings must support actant-network interpretation",
  );

  assert.match(
    sourceMediaPanel,
    /tradition:\s*"Burkean \/ Dramatistic"/,
    "Narrative Agent Profile readings must support motive-scene interpretation",
  );

  assert.match(
    sourceMediaPanel,
    /not imposed as identity labels/,
    "Narrative Agent Profile readings must remain electable rather than fixed identities",
  );
});

test("timestamped overlay geometry stays scoped to one analysis and timestamp", () => {
  assert.match(
    videoPanel,
    /type LockedForensicRoi = \{[\s\S]*box: DraftBox;[\s\S]*videoId\?: string;[\s\S]*time\?: number;/,
    "locked ROI overlays must include analysis/video and timestamp ownership",
  );

  assert.match(
    videoPanel,
    /lockedForensicRoiBox\.videoId && lockedForensicRoiBox\.videoId !== videoId/,
    "locked ROI overlays must not render on a different active analysis/video",
  );

  assert.match(
    videoPanel,
    /Math\.abs\(currentTime - lockedForensicRoiBox\.time\) > 1/,
    "locked ROI overlays must not render at unrelated timestamps",
  );

  assert.match(
    videoPanel,
    /time: Number\(keyframeTime\.toFixed\(3\)\),[\s\S]*coordinates: normalizeDraftBox\(normalizedBox\),[\s\S]*source: "manual"/,
    "saved bbox geometry must bind each analyst-adjusted coordinate set to its own timestamp",
  );

  assert.match(
    videoPanel,
    /allManualVisualAnnotations\.find\(\(item\) => item\.id === annotationId\)/,
    "saving later geometry must load the existing annotation before adding a timestamped keyframe",
  );

  assert.match(
    videoPanel,
    /span <= MANUAL_GEOMETRY_INTERPOLATION_MAX_GAP_SECONDS/,
    "manual bbox interpolation must be bounded so later boxes cannot smear across cuts",
  );
});

test("one evidence occurrence can participate in multiple independent tracks", () => {
  assert.match(
    evidenceAuthority,
    /export type EvidenceTrackType =[\s\S]*"Identification"[\s\S]*"Interaction"[\s\S]*"Action"[\s\S]*"Role"[\s\S]*"Scene"/,
    "evidence tracks must cover different analyst scopes, not only object tracking",
  );

  assert.match(
    evidenceAuthority,
    /export type EvidenceTrackScope =[\s\S]*"continuous"[\s\S]*"episodic"[\s\S]*"non_contiguous"[\s\S]*"interpretive"/,
    "evidence tracks must support episodic and non-contiguous narrative structure",
  );

  assert.match(
    evidenceAuthority,
    /export type EvidenceTrackMembership = \{[\s\S]*occurrenceId: string;[\s\S]*trackId: string;[\s\S]*relation: EvidenceTrackRelation;/,
    "track membership must be separate from the occurrence so one detection can join many tracks",
  );

  assert.match(
    evidenceAuthority,
    /trackMemberships: EvidenceTrackMembership\[\];/,
    "evidence occurrence must store an array of track memberships",
  );

  assert.match(
    evidenceAuthority,
    /export function addEvidenceTrackMembership\([\s\S]*trackMemberships: \[\.\.\.existing, membership\]/,
    "adding a membership must preserve existing memberships instead of replacing the track",
  );

  assert.doesNotMatch(
    evidenceAuthority,
    /trackId:\s*string;\s*\/\/\s*single|singleTrack|primaryTrackOnly/,
    "evidence authority must not encode a single-track-only assumption",
  );
});

test("audio sample clouds stay exposed as governed analysis artifacts", () => {
  assert.match(
    apiService,
    /audio_sample_clouds\?: AudioSampleClouds \| null;/,
    "analysis status must expose governed audio sample clouds to panels",
  );

  assert.match(
    apiService,
    /audio_sample_clouds: "Audio Sample Clouds \(JSON\)"/,
    "audio sample clouds must have a user-facing download label",
  );

  assert.match(
    apiService,
    /audio_sample_clouds: "\.json"/,
    "audio sample clouds must remain a JSON artifact",
  );

  assert.match(
    apiService,
    /authority_order\?: string\[\];/,
    "audio sample clouds must carry their sample authority order",
  );
});

test("identity triangulation stays exposed as a governed analysis artifact", () => {
  assert.match(
    apiService,
    /identity_triangulation\?: IdentityTriangulationStatus \| null;/,
    "analysis status must expose identity triangulation summary to panels",
  );

  assert.match(
    apiService,
    /identity_triangulation: "Identity Triangulation Bundle \(JSON\)"/,
    "identity triangulation must have a user-facing download label",
  );

  assert.match(
    apiService,
    /identity_triangulation: "\.json"/,
    "identity triangulation must remain a JSON artifact",
  );
});

test("forensic traceback exposes a navigable tree contract", () => {
  assert.match(
    apiService,
    /traceback_tree_path\?: string;/,
    "forensic render jobs must expose the traceback tree artifact path",
  );

  assert.match(
    apiService,
    /export interface ForensicTracebackTree \{[\s\S]*traceback_tree_schema: string;[\s\S]*nodes\?: Array/,
    "frontend API types must include the traceback tree node contract",
  );

  assert.match(
    apiService,
    /Promise<\{ traceback: ForensicTracebackRecord; tree\?: ForensicTracebackTree \| null \}>/,
    "traceback fetch must return both the flat record and tree payload",
  );
});

test("second-order labels surface as governed affirmations without confirmation tax", () => {
  assert.match(
    apiService,
    /export interface SecondOrderLabelProliferationPlan/,
    "frontend API types must expose the second-order proliferation plan",
  );

  assert.match(
    videoService,
    /secondOrderLabelProliferation: status\.second_order_label_proliferation \|\| null/,
    "video service must carry the proliferation plan into analysis data",
  );

  assert.match(
    secondOrderAffirmations,
    /analyst_confirmation_is_not_required_for_every_candidate/,
    "second-order UI must preserve the no confirmation tax governance flag",
  );

  assert.match(
    secondOrderAffirmations,
    /manual override remains available/i,
    "second-order labels must tell analysts manual override remains authoritative",
  );

  assert.match(
    videoPanel,
    /surface="bbox_roi_overlay"/,
    "BBox/ROI editor must surface second-order affirmation chips",
  );

  assert.match(
    objPanel,
    /surface="objects_panel"/,
    "Objects panel must surface second-order affirmation chips",
  );

  assert.match(
    masterSchemaPanel,
    /SecondOrderLabelReviewTray/,
    "Master Schema must expose the batch review tray for second-order labels",
  );
});

test("meaning plot panel keeps second-order visualizations navigable to source", () => {
  assert.match(
    layoutHost,
    /MeaningPlotPanel/,
    "layout host must register the Meaning / Plot panel",
  );

  assert.match(
    meaningPlotPanel,
    /openVideoAtTime/,
    "meaning plot candidates must navigate back to the source video timestamp",
  );

  assert.match(
    meaningPlotPanel,
    /source_evidence_refs/,
    "meaning plot candidates must surface source evidence references",
  );

  assert.match(
    meaningPlotPanel,
    /Aristotle[\s\S]*Freytag[\s\S]*Campbell[\s\S]*Frye[\s\S]*Booker/,
    "meaning plot panel must expose alternative plot lenses",
  );
});

test("evidence proliferation launch remains governed and analyst initiated", () => {
  assert.match(
    videoPanel,
    /Proliferate/,
    "BBox/ROI editor must expose an analyst-initiated proliferation action",
  );

  assert.match(
    videoPanel,
    /evidenceProliferationRequested/,
    "proliferation launch must emit a shared event for future review surfaces",
  );

  assert.match(
    videoPanel,
    /manual_correction_wins:\s*true/,
    "proliferation requests must preserve manual correction authority",
  );

  assert.match(
    videoPanel,
    /evidence_linked_not_timeline_linear:\s*true/,
    "proliferation requests must not assume linear story or detection order",
  );

  assert.match(
    videoPanel,
    /outputs_are_candidates_until_verified_by_evidence:\s*true/,
    "proliferation outputs must remain candidates until supported by evidence",
  );
});

test("BBox/ROI editor behaves as an evidence navigation hub", () => {
  assert.match(
    videoPanel,
    /data-vaa1-bbox-roi-evidence-hub="true"/,
    "BBox/ROI editor must expose the evidence navigation hub surface",
  );

  assert.match(
    videoPanel,
    /BBOX_ROI_EVIDENCE_HUB_SECTIONS[\s\S]*Evidence[\s\S]*Narrative Agent[\s\S]*Relations[\s\S]*Traceback & Authority[\s\S]*Operations/,
    "BBox/ROI hub must group actions by evidence dimensions instead of one flat category menu",
  );

  assert.match(
    videoPanel,
    /BBOX_ROI_RELATION_QUICK_ACTIONS[\s\S]*speaking to[\s\S]*flirting with[\s\S]*making out with[\s\S]*leading[\s\S]*cooperating with/,
    "BBox/ROI hub must expose relational quick actions across positive, intimate, and analytic social phenomena",
  );

  assert.match(
    videoPanel,
    /BBOX_ROI_ACTION_QUICK_ACTIONS[\s\S]*sitting[\s\S]*walking[\s\S]*driving\/riding[\s\S]*running[\s\S]*swimming[\s\S]*jumping[\s\S]*climbing[\s\S]*pulling[\s\S]*taking[\s\S]*handing/,
    "BBox/ROI hub must expose basic action and movement quick annotations",
  );

  assert.match(
    videoPanel,
    /quickAnnotations:[\s\S]*\[\]/,
    "BBox/ROI quick annotations must default to an additive empty set",
  );

  assert.match(
    videoPanel,
    /data-vaa1-quick-annotation-active=\{active \? "true" : "false"\}/,
    "BBox/ROI quick annotations must show their active multi-select state",
  );

  assert.match(
    videoPanel,
    /quick_annotations:\s*edit\.quickAnnotations/,
    "Saved BBox/ROI manual confirmation must persist additive quick annotations",
  );

  assert.match(
    videoPanel,
    /applyScope:[\s\S]*"this_interval_only"/,
    "BBox/ROI manual correction scope must default to this interval only",
  );

  assert.match(
    videoPanel,
    /apply_scope:\s*applyScope/,
    "Saved BBox/ROI manual confirmation must persist the selected apply scope",
  );

  assert.match(
    videoPanel,
    /scopeRequiresConfirmation[\s\S]*window\.confirm/,
    "Dangerous BBox/ROI propagation scopes must require explicit confirmation",
  );

  assert.match(
    videoPanel,
    /manual_confirmation_event[\s\S]*manual_bbox_roi_confirmation[\s\S]*old_states_retained_as:\s*"traceback_provenance"/,
    "BBox/ROI saves must record manual confirmation events and retain old history as traceback provenance",
  );
});

test("GoldenLayout leaf tabs stay on one compact row", () => {
  assert.match(
    globalsCss,
    /\.lm_header[\s\S]*white-space:\s*nowrap/,
    "GoldenLayout headers must prevent leaf tabs from wrapping into a second row",
  );

  assert.match(
    globalsCss,
    /\.lm_header \.lm_tab \.lm_title[\s\S]*text-overflow:\s*ellipsis/,
    "long leaf panel labels must truncate instead of bleeding beyond the tab layout",
  );
});

test("BBox/ROI object pipeline never promotes raw track labels as display truth", () => {
  assert.match(
    videoService,
    /function governedObjectDisplayLabel/,
    "VideoService must centralize object display-label governance before panel rendering",
  );

  assert.doesNotMatch(
    videoService,
    /displayLabel:\s*`\$\{item\.class_name\} track \$\{nextTrackId\}`/,
    "grouped object tracks must not mint raw '<class> track N' display labels",
  );

  assert.doesNotMatch(
    videoPanel,
    /displayLabel:\s*`Person track x/,
    "VideoPanel duplicate grouping must not mint Person track display labels",
  );

  assert.doesNotMatch(
    videoPanel,
    /displayLabel:\s*item\.displayLabel \|\| "Person track/,
    "VideoPanel fallback objects must not preserve Person track display labels",
  );

  assert.match(
    videoPanel,
    /function isRawDetectionLikeLabel[\s\S]*startsWith\("person track"\)/,
    "VideoPanel must recognize raw track labels as unsafe user-facing labels",
  );

  assert.match(
    videoPanel,
    /record\.category === "object"[\s\S]*!isRawDetectionLikeLabel\(record\.label\)[\s\S]*record\.authority !== "raw_detection"/,
    "Master Schema object lookup must reject raw-like labels even if they arrive with interpreted authority",
  );

  assert.match(
    videoPanel,
    /unresolvedObjectConfirmationLabel\(item\)/,
    "unresolved detections must render as Narrative Agent/object confirmation prompts with probability",
  );

  assert.match(
    videoPanel,
    /if \(rawLabel && !trackId\)/,
    "mature raw-label lookup must not index track-scoped object labels that can bleed across scenes",
  );

  assert.match(
    videoPanel,
    /if \(override\.trackId !== undefined\)[\s\S]*return sameTrack/,
    "local object label overrides with a track id must only apply to that track",
  );

  assert.match(
    videoPanel,
    /if \(targetIds\.length === 0\)[\s\S]*matureObjectOverlayLookup\.byRawLabel/,
    "raw-label mature object fallback must only apply when no object track target exists",
  );
});

test("expression identity saves anchor to nearby person geometry", () => {
  assert.match(
    videoPanel,
    /const findExpressionPersonAnchor = React\.useCallback/,
    "VideoPanel must find a nearby person/object anchor before saving expression-derived identities",
  );

  assert.match(
    videoPanel,
    /expressionPersonAnchor \|\| synthesizedExpressionOwnerBox \? "object" : overlay\.modality/,
    "expression-derived Identification saves must correlate to the person/object target, not the raw expression event",
  );

  assert.match(
    videoPanel,
    /expressionPersonAnchor\?\.box \|\| synthesizedExpressionOwnerBox \|\| expressionBox/,
    "expression-derived Identification saves must persist anchored or synthesized person geometry, not the raw expression box when orphaned",
  );

  assert.match(
    videoPanel,
    /EXPRESSION_IDENTITY_ANCHOR_WINDOW_SECONDS/,
    "expression-derived identities must save a durable confirmation window instead of a one-frame expression point",
  );

  assert.match(
    videoPanel,
    /source_expression_key/,
    "anchored expression saves must retain provenance back to the source expression box",
  );

  assert.match(
    apiService,
    /source_expression_key\?: string/,
    "ManualVisualAnnotation metadata must type expression provenance so it survives save/load",
  );

  assert.match(
    videoPanel,
    /function synthesizePersonBoxFromExpression/,
    "orphan expression boxes must synthesize a person-sized owner bbox instead of becoming the person bbox themselves",
  );

  assert.match(
    videoPanel,
    /source_expression_owner_request:\s*Boolean\(synthesizedExpressionOwnerBox\)/,
    "orphan expression-owner saves must initiate and persist a person detection request marker",
  );

  assert.match(
    videoPanel,
    /expressionOwnerPersonDetectionRequested/,
    "orphan expression-owner saves must broadcast the new person detection request for other UI surfaces",
  );

  assert.match(
    videoService,
    /function isExpressionOwnerPersonRequest/,
    "VideoService must surface expression-owner requests as person objects in the object pipeline",
  );

  assert.match(
    videoService,
    /entry\.category === "OBJ" \|\| isExpressionOwnerPersonRequest\(entry\)/,
    "manual expression-owner requests must participate in OBJ/person overlays without changing the source expression evidence",
  );

  assert.match(
    apiService,
    /source_expression_owner_request\?: boolean/,
    "ManualVisualAnnotation metadata must type expression-owner person request provenance",
  );
});

test("Narrative Agent maturity policy language is reflected in UI surfaces", () => {
  const narrativePolicy = read("../../docs/vaa_1_narrative_agent_maturity_corrections.md");

  assert.match(
    narrativePolicy,
    /An expression bbox is not itself a person bbox/,
    "semantic policy must define the expression-owner person request rule",
  );

  assert.match(
    objPanel,
    /Detector substrate:/,
    "Objects UI should present raw detector values as substrate, not semantic truth",
  );

  assert.match(
    masterSchemaPanel,
    /Confirmed Narrative Agent label/,
    "Master Schema identity promotion UI should use Narrative Agent language",
  );

  assert.match(
    sourceMediaPanel,
    /Narrative Agent label/,
    "Source metadata speaker/agent UI should use Narrative Agent language",
  );
});

test("Traceback drawer is a calm navigable source-chain surface", () => {
  assert.match(
    layoutHost,
    /TracebackDrawerPanel/,
    "LayoutHost must register the Traceback drawer panel",
  );

  assert.match(
    tracebackDrawerPanel,
    /data-vaa1-panel="traceback-drawer"/,
    "Traceback drawer must expose the stable panel selector",
  );

  assert.match(
    tracebackDrawerPanel,
    /data-vaa1-traceback-section="claim-header"/,
    "Traceback drawer must render the mature-claim header section",
  );

  assert.match(
    tracebackDrawerPanel,
    /data-vaa1-traceback-section="source-chain"/,
    "Traceback drawer must render the source chain section",
  );

  assert.match(
    tracebackDrawerPanel,
    /data-vaa1-traceback-section="evidence-tree"/,
    "Traceback drawer must render the calm evidence tree visualization",
  );

  assert.match(
    tracebackDrawerPanel,
    /data-vaa1-traceback-section="entity-timeline"/,
    "Traceback drawer must render the same-entity timeline visualization",
  );

  assert.match(
    tracebackDrawerPanel,
    /manualAuthority[\s\S]*\? 1/,
    "Manual Narrative Agent authority must display as 100% analyst confidence",
  );

  assert.match(
    tracebackDrawerPanel,
    /data-vaa1-action="jump-to-video-time"/,
    "Traceback drawer must expose one-click source navigation",
  );

  assert.match(
    videoPanel,
    /data-vaa1-traceback-button="true"/,
    "BBox/ROI overlays must expose a traceback affordance",
  );

  assert.match(
    videoPanel,
    /tracebackOpenRequested/,
    "VideoPanel must open the drawer with inline traceback payloads",
  );

  assert.match(
    videoPanel,
    /onContextMenu=\{\(event\) => \{[\s\S]*openTracebackForOverlay\(overlay, edit\)/,
    "BBox/ROI overlays must preserve the right-click traceback principle",
  );

  assert.match(
    sceneCardPanel,
    /openPanel\("TracebackDrawer"/,
    "Scene evidence traceback must open the shared drawer instead of an alert",
  );

  assert.doesNotMatch(
    sceneCardPanel,
    /window\.alert\([\s\S]*Evidence:/,
    "Scene evidence traceback must not use the old alert visualization",
  );
});

test("Video panel swaps loaded media atomically without duplicate preload frames", () => {
  assert.match(
    videoPanel,
    /const \[mediaSource, nextAnalysis\] = await Promise\.all/,
    "VideoPanel must wait for media and analysis before swapping visible selected-analysis state",
  );

  assert.match(
    videoPanel,
    /setIsLoading\(true\);\s*setBlobMissing\(false\);\s*try/,
    "VideoPanel must not blank the current stable media surface while a replacement analysis is loading",
  );

  assert.match(
    videoPanel,
    /\{videoUrl && \(!showCompareInPanel \|\| !compareSource\) \? \(/,
    "VideoPanel must keep an existing playable video surface ahead of transient loading copy",
  );

  assert.doesNotMatch(
    videoPanel,
    /Loading video\.\.\./,
    "VideoPanel should not show the old raw loading-video text frame",
  );
});
