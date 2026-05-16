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
const globalsCss = read("styles/globals.css");
const objPanel = read("app/V2components/components/panels/OBJDetectionPanel.tsx");
const layoutHost = read("app/V2components/components/LayoutHost.tsx");
const masterSchemaPanel = read("app/V2components/components/panels/MasterSchemaPanel.tsx");
const secondOrderAffirmations = read(
  "app/V2components/components/panels/SecondOrderLabelAffirmations.tsx",
);
const videoService = read("lib/video-service.ts");
const evidenceAuthority = read("lib/evidence-authority.ts");

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
    /\.filter\(\(entry:\s*ManualVisualAnnotation\)\s*=>\s*entry\.category\s*===\s*"OBJ"\)/,
    "only manual OBJ annotations should be converted into DetectedObject rows",
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
