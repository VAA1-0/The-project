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
const menuBar = read("app/V2components/components/MenuBar.tsx");
const masterSchemaPanel = read("app/V2components/components/panels/MasterSchemaPanel.tsx");
const dataMaturationPanel = read("app/V2components/components/panels/DataMaturationPanel.tsx");
const sceneCardPanel = read("app/V2components/components/panels/SceneCardPanel.tsx");
const tracebackDrawerPanel = read("app/V2components/components/panels/TracebackDrawerPanel.tsx");
const secondOrderAffirmations = read(
  "app/V2components/components/panels/SecondOrderLabelAffirmations.tsx",
);
const videoService = read("lib/video-service.ts");
const evidenceAuthority = read("lib/evidence-authority.ts");
const bboxAuthority = read("lib/bbox-authority.ts");
const annotationCorrections = read("lib/annotation-corrections.ts");
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
    /const getOverlayGeometryDraftForEditing = React\.useCallback[\s\S]*selectedOverlayKey === overlayKey[\s\S]*activeOverlayEditorKey === overlayKey[\s\S]*overlayGeometryDrag\?\.overlayKey === overlayKey/,
    "selected or actively dragged bbox drafts must remain visible long enough to be saved",
  );

  assert.match(
    videoPanel,
    /setPendingOverlayGeometryAutoSave\(\{[\s\S]*overlayKey: overlayGeometryDrag\.overlayKey[\s\S]*box: draft\.box[\s\S]*time: draft\.time/,
    "bbox drag release must queue the analyst's resized geometry for automatic save",
  );

  assert.match(
    videoPanel,
    /const geometryDraft = getOverlayGeometryDraftForEditing\(overlay\.key\);[\s\S]*const expressionBox = geometryDraft\?\.box \|\| getOverlayNormalizedBox\(overlay\);[\s\S]*geometryDraft\?\.time \?\? getOverlayInteractionTime\(overlay\)/,
    "BBox/ROI save must use the manual drag geometry and keyframe time when a draft exists",
  );

  assert.match(
    videoPanel,
    /void saveSelectedIndication\(overlay, \{[\s\S]*\.\.\.edit,[\s\S]*start: Number\(autoSaveStart\.toFixed\(3\)\),[\s\S]*end: Number\(autoSaveEnd\.toFixed\(3\)\),/,
    "automatic bbox geometry save must reuse the shared manual BBox/ROI save path",
  );

  assert.match(
    videoPanel,
    /BBOX_GEOMETRY_AUTO_SAVE_WINDOW_SECONDS = ANALYSIS_FRAME_STEP_SECONDS \* 6/,
    "automatic bbox geometry saves need a small frame window so scrub/playback quantization does not drop the correction",
  );

  assert.match(
    videoPanel,
    /pendingOverlayGeometryAutoSave\.time - BBOX_GEOMETRY_AUTO_SAVE_WINDOW_SECONDS \/ 2[\s\S]*pendingOverlayGeometryAutoSave\.time \+ BBOX_GEOMETRY_AUTO_SAVE_WINDOW_SECONDS \/ 2[\s\S]*void saveSelectedIndication\(overlay, \{[\s\S]*start: Number\(autoSaveStart\.toFixed\(3\)\),[\s\S]*end: Number\(autoSaveEnd\.toFixed\(3\)\),/,
    "automatic bbox geometry saves must persist a bounded frame-window interval around the dragged timestamp",
  );

  assert.match(
    videoPanel,
    /resolveAuthoritativeManualGeometryAtTime/,
    "VideoPanel must delegate manual bbox geometry resolution to the shared authority boundary",
  );

  assert.match(
    bboxAuthority,
    /MANUAL_GEOMETRY_INTERPOLATION_MAX_GAP_SECONDS/,
    "manual bbox geometry must not interpolate freely across distant timestamps or cuts",
  );

  assert.match(
    bboxAuthority,
    /const exactManualKeyframe = merged\.find\([\s\S]*Math\.abs\(keyframe\.time - timestamp\) <=[\s\S]*MANUAL_GEOMETRY_KEYFRAME_REPLACE_TOLERANCE_SECONDS[\s\S]*return normalizeDraftBox\(exactManualKeyframe\.coordinates\);/,
    "manual geometry resolution must snap to exact analyst keyframes instead of drifting through interpolation near the saved frame",
  );

  assert.match(
    bboxAuthority,
    /const exactManualKeyframe = merged\.find\([\s\S]*if \(exactManualKeyframe\) \{[\s\S]*return normalizeDraftBox\(exactManualKeyframe\.coordinates\);[\s\S]*const before = \[\.\.\.merged\]\.reverse\(\)\.find/,
    "manual geometry resolution must prefer exact analyst keyframes before any scaling/interpolation is considered",
  );

  assert.match(
    videoPanel,
    /const sameAssertionTrackManualCandidates = trackManualCandidates\.filter\(\(item\) => \{[\s\S]*item\.category !== edit\.category[\s\S]*resolveManualVisualDisplayLabel\(item\)[\s\S]*normalizeEvidenceLabel\(label\)[\s\S]*const overlappingSameAssertionManual = sameAssertionTrackManualCandidates/,
    "same-track bbox correction reuse must be limited to the same governed assertion, so a later character confirmation cannot replace the previous manual interval",
  );

  assert.match(
    videoPanel,
    /const overlappingSameAssertionManual = sameAssertionTrackManualCandidates[\s\S]*MANUAL_INTERVAL_EDGE_TOLERANCE_SECONDS[\s\S]*const existingManual =[\s\S]*allManualVisualAnnotations\.find\(\(item\) => item\.id === annotationId\)[\s\S]*overlappingSameAssertionManual[\s\S]*overlay\.modality === "manual"/,
    "normal BBox/ROI Save may update an exact or overlapping same-assertion record, but must create a new record for a sequential manual-timed assertion",
  );

  assert.match(
    videoPanel,
    /const trackManualCandidates =[\s\S]*manualObjectCorrectionTargetId\(item\) === targetCandidateId/,
    "manual bbox keyframe sequence merging must be limited to the same object correction target",
  );

  assert.doesNotMatch(
    videoPanel,
    /nearbyTrackManual/,
    "nearby same-track BBox/ROI saves must not collapse separate analyst-timed annotations into one manual record",
  );

  assert.match(
    videoPanel,
    /const persistenceStart = start;[\s\S]*const persistenceEnd = end;[\s\S]*start: persistenceStart,[\s\S]*end: persistenceEnd,[\s\S]*anchorTime:\s*keyframeTime/,
    "normal BBox/ROI Save must persist the resolved analyst In/Out interval instead of widening it with stale saved bounds",
  );

  assert.doesNotMatch(
    videoPanel,
    /Math\.min\(start,\s*existingBounds\.start\)|Math\.max\(end,\s*existingBounds\.end/,
    "manual BBox/ROI time corrections must not be unioned with the previous saved interval",
  );

  assert.match(
    bboxAuthority,
    /keyframe\.source !== "track"/,
    "raw track keyframes must not be treated as manual geometry authority",
  );

  assert.match(
    bboxAuthority,
    /export function detectedObjectToNormalizedBox[\s\S]*const appearsNormalized =[\s\S]*Math\.max\(x1, y1, x2, y2\) <= 1\.5[\s\S]*const scaleX = appearsNormalized \? 1 : width[\s\S]*const scaleY = appearsNormalized \? 1 : height/,
    "detected object normalization must preserve already-normalized manual bbox coordinates instead of scaling them twice",
  );

  assert.match(
    videoPanel,
    /allManualVisualAnnotations\.find\(\(item\) => item\.id === annotationId\)/,
    "saving an object-backed bbox must load existing manual keyframes before adding a new timestamp",
  );

  assert.match(
    videoPanel,
    /saveNativeVisualAnnotation[\s\S]*const annotation = buildManualBBoxRoiAnnotation\(\{[\s\S]*targetType:\s*"native_annotation"[\s\S]*source_range_source:\s*"native_video_annotation"[\s\S]*native_annotation:\s*true/,
    "native BBox saves must use the shared BBox/ROI authority builder instead of a panel-local schema",
  );

  assert.doesNotMatch(
    videoPanel,
    /metadata_correlation:\s*null/,
    "native BBox saves must not bypass governance metadata with a null metadata correlation",
  );

  assert.match(
    bboxAuthority,
    /source_track_keyframes_retained_for_traceback/,
    "object-backed bbox saves must retain raw track keyframes as traceback metadata, not authoritative manual geometry",
  );

  assert.match(
    bboxAuthority,
    /bounds\.duration <= Number\.EPSILON[\s\S]*currentTime === bounds\.timestamp/,
    "manual point annotations must only surface at their allotted timestamp",
  );

  assert.match(
    bboxAuthority,
    /currentTime >= bounds\.start &&[\s\S]*currentTime <= bounds\.end/,
    "manual interval annotations must only surface inside their allotted in/out time",
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
    /type OverlayBox = \{[\s\S]*normalizedBox\?: DraftBox/,
    "overlay boxes must be allowed to carry normalized source-video authority instead of only projected pixels",
  );

  assert.match(
    videoPanel,
    /const fallback = overlayBoxToNormalizedBox\(overlay, videoWidth, videoHeight\)/,
    "video overlay rendering must resolve normalized source-video coordinates through bbox authority",
  );

  assert.match(
    videoPanel,
    /key: `manual-\$\{item\.id \|\| index\}`[\s\S]*normalizedBox: normalizeDraftBox\(resolvedBox\)/,
    "manual BBox/ROI overlays must render directly from normalized analyst geometry",
  );

  assert.match(
    videoPanel,
    /const manualOverridesByObjectTrack = new Map<string, ManualVisualAnnotation\[]>/,
    "manual object-track corrections must be tracked as time-aware sets, not a single override per track",
  );

  assert.match(
    videoPanel,
    /chooseLatestManualCorrection\(\s*trackMatches,[\s\S]*currentTime,[\s\S]*isManualAnnotationVisibleInSelectedWorkspace/,
    "video overlays must choose the latest active manual correction for a track by time/workspace",
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
    /const resolveEditWithTimeInputDrafts = React\.useCallback/,
    "BBox/ROI Save must resolve visible typed In/Out drafts before persisting",
  );

  assert.match(
    videoPanel,
    /void saveSelectedIndication\(overlay, nextEdit\)/,
    "BBox/ROI Save must persist the resolved typed interval, not a stale edit object",
  );

  assert.match(
    bboxAuthority,
    /export function buildManualCorrectionGeometryKeyframes[\s\S]*existingKeyframes[\s\S]*source: "manual" as const[\s\S]*safeAnchor/,
    "Saved BBox/ROI corrections must preserve analyst keyframes and add each reshape as manual authority",
  );

  assert.match(
    videoPanel,
    /const annotation = buildManualBBoxRoiAnnotation\(\{[\s\S]*analysisId:\s*videoId,[\s\S]*annotationId,[\s\S]*existingManual,[\s\S]*box:\s*governedBox,[\s\S]*start:\s*persistenceStart,[\s\S]*end:\s*persistenceEnd,[\s\S]*anchorTime:\s*keyframeTime/,
    "Video BBox/ROI Save must delegate the analyst-resolved interval geometry to the shared authority builder",
  );

  assert.match(
    videoPanel,
    /buildManualBBoxRoiAnnotation\(\{[\s\S]*applyScope,[\s\S]*sourceTrackKeyframes:\s*trackKeyframes,[\s\S]*confirmationFields:/,
    "Video BBox/ROI Save must pass scope, traceback track keyframes, and confirmation metadata through the shared authority builder",
  );

  assert.match(
    bboxAuthority,
    /bbox_roi_governance_schema: "vaa1\.bbox_roi_governance\.v1"[\s\S]*interpolation_policy:[\s\S]*allowed: true[\s\S]*manual_confirmation_required_for_cross_boundary: true/,
    "Saved BBox/ROI corrections may interpolate only between governed manual keyframes",
  );

  assert.match(
    bboxAuthority,
    /const confirmedFields = \{[\s\S]*time_interval: true,[\s\S]*geometry: true,[\s\S]*label: true,[\s\S]*confirmed_fields: confirmedFields/,
    "Saved BBox/ROI confirmation events must explicitly confirm time, geometry, and label",
  );

  assert.match(
    videoPanel,
    /void saveSelectedIndicationAtFrame\([\s\S]*overlay,[\s\S]*nextEdit,[\s\S]*workingFrameTime/,
    "BBox/ROI Save here must stretch from the resolved typed interval before saving",
  );

  assert.match(
    videoPanel,
    /const scrubSelectedOverlayTo[\s\S]*holdVideoPausedForBBoxNavigation\(\)[\s\S]*jumpToTime\(safeTime\)[\s\S]*holdVideoPausedForBBoxNavigation\(\)/,
    "BBox/ROI timeline scrubbing must hold playback instead of letting video controls start rolling",
  );

  assert.match(
    videoPanel,
    /bboxNavigationPauseLockRef[\s\S]*onPlay=\{\(\) => \{[\s\S]*bboxNavigationPauseLockRef\.current[\s\S]*videoRef\.current\?\.pause\(\)/,
    "BBox/ROI navigation must reject stray play events during bbox timeline seeking",
  );

  assert.match(
    videoPanel,
    /controls=\{false\}[\s\S]*data-vaa1-video-frame-fullscreen/,
    "video overlays must not depend on browser-native controls that can be covered by BBox layers",
  );

  assert.match(
    videoPanel,
    /const ANALYSIS_FRAME_STEP_SECONDS = 1 \/ 25/,
    "analysis transport should expose a stable frame-step unit outside the native player controls",
  );

  assert.match(
    videoPanel,
    /primaryPlaybackRate[\s\S]*0\.25[\s\S]*0\.5[\s\S]*1[\s\S]*2[\s\S]*4/,
    "analysis transport should expose slow and fast playback rates for repeated evidence review",
  );

  assert.match(
    videoPanel,
    /seekByAnalysisStep\(step\.delta\)/,
    "fine seek buttons should pause-and-step through the governed analysis transport",
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

  assert.match(
    videoPanel,
    /onPointerDown=\{\(event\) => \{[\s\S]*beginOverlayGeometryDrag\(event, overlay, "move"\)/,
    "editable bbox overlays should reserve first pointer contact for drag/move editing",
  );

  const bboxSingleClickHandler = videoPanel.match(
    /onClick=\{\(event\) => \{([\s\S]*?)\n\s*\}\}/,
  )?.[1];
  assert.ok(bboxSingleClickHandler, "bbox single-click handler was not found");
  assert.doesNotMatch(
    bboxSingleClickHandler,
    /openEvidencePanelForOverlay|setActiveOverlayEditorKey\(overlay\.key\)/,
    "single-click must only select/grab a bbox, not open the BBox/ROI navigation hub",
  );

  assert.match(
    videoPanel,
    /onDoubleClick=\{\(event\) => \{[\s\S]*openEvidencePanelForOverlay\(overlay\)/,
    "bbox evidence navigation should open on double-click, not first touch",
  );

  assert.match(
    videoPanel,
    /selected && activeOverlayEditorKey === overlay\.key/,
    "BBox/ROI navigation hub must render only after explicit double-click/editor activation",
  );

  assert.match(
    videoPanel,
    /data-vaa1-bbox-roi-move-handle="true"[\s\S]*beginOverlayGeometryDrag\(event, overlay, "move"\)/,
    "open BBox/ROI navigation must keep a dedicated move handle so the bbox remains spatially draggable",
  );

  assert.match(
    videoPanel,
    /event\.currentTarget\.setPointerCapture\?\.\(event\.pointerId\)/,
    "bbox drag must capture the pointer so horizontal movement is not lost while repositioning",
  );

  assert.match(
    videoPanel,
    /clientPointToNormalizedVideoPoint\(\{[\s\S]*clientX,[\s\S]*clientY,[\s\S]*elementRect: videoElementRect,[\s\S]*contentRect: renderedVideoRect/,
    "bbox drag coordinates must normalize through the shared rendered video content projection",
  );

  assert.match(
    videoPanel,
    /new ResizeObserver\(\(\) => scheduleRenderedVideoRectUpdate\(\)\)/,
    "BBox overlays must recompute rendered video geometry when the panel or video element is dynamically resized",
  );

  assert.match(
    videoPanel,
    /controlsList="nofullscreen"[\s\S]*data-vaa1-video-frame-fullscreen="true"/,
    "fullscreen must be routed through the VAA1 video workspace so overlays remain visible",
  );

  assert.match(
    videoPanel,
    /document\.addEventListener\("fullscreenchange", handleFullscreenChange\)/,
    "fullscreen transitions must refresh the rendered video rectangle for proportional bbox placement",
  );

  assert.match(
    videoPanel,
    /editableOverlay \|\| !overlapsVideoControls[\s\S]*\? "pointer-events-auto"[\s\S]*: "pointer-events-none"/,
    "editable bbox overlays must remain draggable even when they overlap the browser video controls area",
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

  assert.match(
    bboxAuthority,
    /const analystKeyframes = manualKeyframes\.filter\([\s\S]*keyframe\.source !== "track"[\s\S]*analystKeyframes\.length > 0 \? analystKeyframes : trackKeyframes/,
    "manual bbox keyframes must become the timing/geometry authority without raw OBJ track keyframes",
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

test("bbox coordinate projection is centralized before rendered overlays", () => {
  assert.match(
    bboxAuthority,
    /export function getTrueVideoContentRect\(/,
    "bbox authority must expose the single video content rectangle projection utility",
  );

  assert.match(
    bboxAuthority,
    /elementRatio > videoRatio[\s\S]*xOffset = \(elementWidth - renderWidth\) \/ 2[\s\S]*yOffset = \(elementHeight - renderHeight\) \/ 2/,
    "projection utility must strip letterboxing and pillarboxing from the HTML video element",
  );

  assert.match(
    bboxAuthority,
    /export function clientPointToNormalizedVideoPoint\(/,
    "pointer-to-bbox coordinates must be normalized through bbox authority, not panel-local DOM math",
  );

  assert.match(
    bboxAuthority,
    /export function projectNormalizedBoxToVideoContent\(/,
    "visible overlay pixels must be projected from normalized canonical geometry through bbox authority",
  );

  assert.match(
    bboxAuthority,
    /export function overlayBoxToNormalizedBox\([\s\S]*overlay\.normalizedBox[\s\S]*normalizeDraftBox\(overlay\.normalizedBox\)[\s\S]*overlay\.x \/ safeVideoWidth/,
    "legacy overlay pixel fallbacks must be normalized by bbox authority, not the VideoPanel render path",
  );

  assert.match(
    videoPanel,
    /setRenderedVideoRect\(getTrueVideoContentRectForElement\(videoElement\)\)/,
    "VideoPanel resize/fullscreen updates must use the shared true video content rect",
  );

  assert.match(
    videoPanel,
    /clientPointToNormalizedVideoPoint\(\{[\s\S]*contentRect: renderedVideoRect/,
    "BBox drag coordinates must use the shared content-rect point projection",
  );

  assert.match(
    videoPanel,
    /projectNormalizedBoxToVideoContent\(\s*normalizedBox,\s*renderedVideoRect,\s*\)/,
    "overlay pixel measurements must come from the shared normalized-box projection",
  );

  assert.doesNotMatch(
    videoPanel,
    /function getRenderedVideoRect\(/,
    "VideoPanel must not keep a duplicate video content rectangle calculator",
  );

  assert.doesNotMatch(
    videoPanel,
    /function mergeGeometryKeyframes\(/,
    "manual geometry keyframe merging must be owned by bbox authority",
  );

  for (const helper of [
    "manualAnnotationBBoxFingerprint",
    "manualAnnotationTimeScopeKey",
    "calculateDraftBoxIoU",
    "calculateDraftBoxCenterDistance",
    "synthesizePersonBoxFromExpression",
    "geometryToNormalizedBox",
    "overlayBoxToNormalizedBox",
    "isSameSpaceBoxMatch",
    "analystManualAuthoritySuppressesObjectBox",
  ]) {
    assert.match(
      bboxAuthority,
      new RegExp(`export function ${helper}\\(`),
      `${helper} must be exported by bbox authority`,
    );
    assert.doesNotMatch(
      videoPanel,
      new RegExp(`function ${helper}\\(`),
      `${helper} must not be reimplemented inside VideoPanel`,
    );
  }

  assert.doesNotMatch(
    objPanel,
    /function normalizeObjectBox\(/,
    "Objects panel must use bbox authority object-box normalization instead of panel-local geometry conversion",
  );
});

test("bbox save paths install backend canonical corrections immediately", () => {
  assert.match(
    videoPanel,
    /const applySavedAnnotationCorrections = React\.useCallback/,
    "VideoPanel must have a canonical correction response installer",
  );

  assert.match(
    videoPanel,
    /const savedCorrections = await VideoService\.saveAnnotationCorrections\([\s\S]*?applySavedAnnotationCorrections\(savedCorrections\);[\s\S]*?const refreshed = await VideoService\.refreshAnalysis/,
    "VideoPanel saves must install returned backend corrections before broad analysis refresh",
  );

  assert.match(
    objPanel,
    /const applySavedAnnotationCorrections = React\.useCallback/,
    "Objects panel must have a canonical correction response installer",
  );

  assert.match(
    objPanel,
    /const savedCorrections = await VideoService\.saveAnnotationCorrections\([\s\S]*?applySavedAnnotationCorrections\(savedCorrections\);[\s\S]*?const refreshed = await VideoService\.refreshAnalysis/,
    "Objects panel saves must install returned backend corrections before broad analysis refresh",
  );

  assert.match(
    annotationCorrections,
    /export function requireSavedManualVisualAnnotation/,
    "manual visual saves must have a shared canonical-return validator",
  );

  assert.match(
    videoPanel,
    /requireSavedManualVisualAnnotation\([\s\S]*savedCorrections,[\s\S]*annotation\.id,[\s\S]*"BBox\/ROI indication"/,
    "VideoPanel BBox/ROI Save must verify the backend returned the saved annotation before clearing UI state",
  );

  assert.match(
    objPanel,
    /requireSavedManualVisualAnnotation\([\s\S]*savedCorrections,[\s\S]*annotation\.id,[\s\S]*"Objects BBox\/ROI indication"/,
    "Objects panel BBox/ROI Save must verify the backend returned the saved annotation before clearing UI state",
  );

  assert.match(
    videoPanel,
    /setNativeSaveMessage\(`Could not save BBox\/ROI indication: \$\{message\}`\)/,
    "VideoPanel BBox/ROI Save must report the exact canonical-save failure path",
  );

  assert.match(
    objPanel,
    /setObjectActionMessage\(`Could not save indication: \$\{message\}`\)/,
    "Objects panel BBox/ROI Save must report the exact canonical-save failure path",
  );

  assert.doesNotMatch(
    videoPanel,
    /await VideoService\.saveAnnotationCorrections\(videoId, nextCorrections\);\s*const refreshed = await VideoService\.refreshAnalysis/,
    "VideoPanel must not discard the canonical save response before refresh",
  );

  assert.doesNotMatch(
    objPanel,
    /await VideoService\.saveAnnotationCorrections\(videoId, nextCorrections\);\s*const refreshed = await VideoService\.refreshAnalysis/,
    "Objects panel must not discard the canonical save response before refresh",
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

test("Transcript panel text words remain linked to source video time", () => {
  assert.match(
    speechPanel,
    /const openTranscriptRowAtSourceTime = \(row: any\) => \{[\s\S]*openVideoAtTime\(videoId, Number\(row\?\.start \?\? 0\)\);[\s\S]*\};/,
    "Transcript panel must centralize transcript row navigation through the shared video seek helper",
  );
  assert.match(
    speechPanel,
    /onClick=\{\(event\) => \{[\s\S]*event\.stopPropagation\(\);[\s\S]*openTranscriptRowAtSourceTime\(row\);[\s\S]*setSelectedWord\(cleanedWord\);/,
    "clicking visible transcript words must seek the source video before selecting text for correction",
  );
  assert.match(
    speechPanel,
    /onClick=\{\(\) => \{[\s\S]*openTranscriptRowAtSourceTime\(row\);[\s\S]*\}\}/,
    "clicking the transcript row must seek the same operational source time as the word text",
  );
});

test("Transcript panel surfaces degraded backend timing repair state", () => {
  assert.match(
    videoService,
    /function transcriptQualityForDisplay\([\s\S]*repairState\?\.quality_after \|\| repairState\?\.quality_before \|\| repairState\?\.quality/,
    "video service must fall back to backend transcript repair quality when the transcript artifact lacks embedded quality",
  );
  assert.match(
    videoService,
    /transcriptQuality: transcriptQualityForDisplay\(transcriptData, status\)/,
    "Transcript panel metadata must receive the authoritative display quality from transcript or repair state",
  );
});

test("Audio prosody follows corrected transcript operational clock", () => {
  assert.match(
    videoService,
    /function applyTranscriptClockOffsetToAudioProsody\([\s\S]*transcript_clock_offset_seconds[\s\S]*cue[\s\S]*start[\s\S]*sourceStart \+ offset[\s\S]*end[\s\S]*sourceEnd \+ offset/,
    "audio prosody cues must follow the same correction offset as Transcript rows",
  );
  assert.match(
    videoService,
    /const correctedAudioProsody =[\s\S]*applyTranscriptClockOffsetToAudioProsody\(audioProsodyData\.value, corrections\)/,
    "loaded analysis data must expose offset-corrected audio prosody cues",
  );
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
    /masterSchemaScopedRecords\([\s\S]*masterSchemaObjectRecords\(masterSchema\)[\s\S]*masterSchema[\s\S]*analysisId/,
    "resolved evidence must include analysis-scoped Master Schema object and track records",
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

  assert.match(
    videoPanel,
    /masterSchemaRecordHasFiniteTimeAnchor/,
    "Master Schema overlay labels must require a finite source time anchor before painting onto video frames",
  );

  assert.match(
    videoPanel,
    /currentTime < Math\.min\(start, end\)[\s\S]*currentTime > Math\.max\(start, end\)/,
    "Master Schema overlay labels must deactivate exactly outside their allotted start/end interval",
  );

  assert.match(
    videoPanel,
    /buildManualTrackMatureAuthority\([\s\S]*allManualVisualAnnotations,[\s\S]*currentTime,[\s\S]*\)/,
    "manual track authority must be resolved at the current video time, not across the whole raw track",
  );

  assert.match(
    videoPanel,
    /const manualTrackAuthority = \(\(\) => \{[\s\S]*manualTrackMatureAuthority\.get\(trackId\)[\s\S]*resolveManualGeometryAtTime\(sourceItem, currentTime\)[\s\S]*isSameSpaceBoxMatch\(objectNormalizedBox, authorityBox\)/,
    "manual track authority must prove the same local bbox occurrence, so one track id cannot eat unrelated detections in the same dialogue or scene",
  );

  assert.match(
    videoPanel,
    /manualAnnotationTimeScopeKey/,
    "object-backed bbox annotation ids must include the analyst-confirmed time interval",
  );

  assert.match(
    videoPanel,
    /manualAnnotationBBoxFingerprint/,
    "object-backed bbox annotation ids must include a bbox fingerprint so new scene confirmations do not overwrite previous scene agents",
  );

  assert.match(
    bboxAuthority,
    /metadata_correlation\?\.apply_scope[\s\S]*track_family[\s\S]*narrative_agent_family/,
    "manual object target authority must only become track-wide when the analyst explicitly chooses a wide apply scope",
  );

  assert.match(
    bboxAuthority,
    /export function manualObjectMatureAuthorityTargetId\([\s\S]*!\[[\s\S]*track_family[\s\S]*narrative_agent_family[\s\S]*current_continuity_segment[\s\S]*current_scene[\s\S]*\.includes\(scope\)[\s\S]*return null/,
    "mature track authority must reject empty or this-interval-only scope so track ids cannot imperialise future identities",
  );

  assert.match(
    bboxAuthority,
    /const targetId = manualObjectMatureAuthorityTargetId\(item\)/,
    "manual track mature authority must use the explicit broad-scope target resolver, not the general geometry target id",
  );

  assert.match(
    bboxAuthority,
    /export function manualObjectCorrectionTargetId/,
    "interval-scoped object corrections must still resolve their target track without becoming track-wide authority",
  );

  assert.match(
    videoPanel,
    /const targetId = manualObjectCorrectionTargetId\(item\)/,
    "Video BBox overlays must apply this-interval object corrections to the matching raw track",
  );

  assert.match(
    bboxAuthority,
    /export function analystManualAuthoritySuppressesObjectBox/,
    "analyst manual BBox authority must have an explicit suppression boundary for raw object overlays",
  );

  assert.match(
    videoPanel,
    /item\.sourceType === "manual_visual" && overlayToggles\.manual[\s\S]*return;/,
    "manual visual annotations must not re-enter the video surface as object detections while manual overlays are active",
  );

  assert.match(
    videoPanel,
    /const analystManualAuthorityActive =[\s\S]*activeManualSpatialOverrides\.some[\s\S]*analystManualAuthoritySuppressesObjectBox[\s\S]*if \(analystManualAuthorityActive && overlayToggles\.manual\) \{[\s\S]*return;/,
    "raw object overlays must become traceback-only when an analyst correction governs the same visual space",
  );

  assert.match(
    videoPanel,
    /manualObjectCorrectionTargetId\(overlay\.sourceItem as ManualVisualAnnotation\)/,
    "editing an existing manual object correction must preserve its object target id",
  );

  assert.match(
    videoPanel,
    /buildManualBBoxRoiAnnotation\(\{[\s\S]*annotationId,[\s\S]*existingManual,/,
    "saving a revised interval-scoped object correction must update the existing manual annotation instead of creating duplicate track corrections",
  );

  assert.match(
    videoService,
    /rule\.target_track_id !== undefined[\s\S]*Number\(rule\.target_track_id\) !== Number\(context\.trackId\)[\s\S]*return false;/,
    "scoped object correction rules must not return on track id before checking their time window",
  );
});

test("manual OBJ corrections outrank stale narrative-agent labels on object bboxes", () => {
  assert.match(
    videoPanel,
    /function isObjectManualOverride/,
    "Video overlays must identify active OBJ manual corrections",
  );

  assert.match(
    videoPanel,
    /if \(objectManualOverrideActive \|\| localOverride\) \{\s*return undefined;\s*\}/,
    "active OBJ corrections must suppress stale narrative-agent recognition for the same bbox",
  );

  assert.match(
    videoPanel,
    /const objectOverlayLabel =[\s\S]*localOverlayLabel \|\|[\s\S]*manualOverrideOverlayLabel \|\|[\s\S]*manualTrackOverlayLabel \|\|[\s\S]*narrativeAgentOverlayLabel/,
    "manual object labels must render before narrative-agent labels in bbox headers",
  );

  assert.match(
    videoPanel,
    /function chooseLatestManualCorrection[\s\S]*manualAnnotationUpdatedAt\(right\)[\s\S]*manualAnnotationUpdatedAt\(left\)/,
    "Video overlays must choose the latest visible manual correction when duplicate object corrections exist",
  );

  assert.match(
    videoPanel,
    /const activeTrackManual = chooseLatestManualCorrection\([\s\S]*trackMatches,[\s\S]*currentTime,[\s\S]*isManualAnnotationVisibleInSelectedWorkspace/,
    "Object overlays must not pick the first stale manual correction for a corrected track",
  );

  assert.match(
    videoPanel,
    /const resolvedNormalizedBox =[\s\S]*resolveManualGeometryAtTime\(manualOverride, currentTime\)[\s\S]*: objectNormalizedBox/,
    "object overlays governed by manual corrections must keep normalized analyst geometry through projection",
  );

  assert.match(
    videoPanel,
    /normalizedBox: resolvedNormalizedBox[\s\S]*normalizeDraftBox\(resolvedNormalizedBox\)/,
    "object overlays must not lose normalized coordinates when displayed in the Video Panel",
  );

  assert.match(
    videoPanel,
    /const authoritativeObjectManualIds = new Set<string>\(\)[\s\S]*manualOverlaySource = manualVisualAnnotations\.filter/,
    "Manual overlay rendering must suppress stale duplicate manual corrections for the same object target",
  );

  assert.match(
    videoPanel,
    /displayLabel:\s*manualOverrideOverlayLabel \|\| unresolvedOverlayLabel/,
    "active manual object overrides must surface their label in sourceItem displayLabel",
  );

  assert.match(
    objPanel,
    /const manualOverride = getManualOverrideForObject\(obj\)/,
    "Objects panel rows must use the selected authoritative manual override, not the raw override array",
  );

  assert.match(
    objPanel,
    /buildManualBBoxRoiAnnotation\(\{[\s\S]*analysisId:\s*videoId,[\s\S]*annotationId,[\s\S]*box:\s*governedBox/,
    "Objects panel BBox saves must delegate governed manual geometry to the shared authority builder",
  );

  assert.match(
    bboxAuthority,
    /export function buildManualBBoxRoiAnnotation[\s\S]*geometry_keyframes:\s*geometryKeyframes/,
    "Shared BBox/ROI authority builder must persist manual geometry keyframes as authority",
  );

  assert.match(
    bboxAuthority,
    /coordinates:\s*governedBox,[\s\S]*bbox_roi_governance_schema:\s*"vaa1\.bbox_roi_governance\.v1"/,
    "Shared BBox/ROI authority builder must persist governed geometry and schema metadata",
  );

  assert.match(
    bboxAuthority,
    /manual_confirmation_event:[\s\S]*authority_level: "manual_correction"/,
    "Shared BBox/ROI authority builder must persist manual correction confirmation metadata",
  );

  assert.match(
    objPanel,
    /resolveObjectDraftWithTimeInputs/,
    "Objects panel BBox Save must resolve visible typed In/Out drafts before persisting",
  );
});

test("saving bbox annotations closes the editor and clears selected workspace state", () => {
  assert.match(
    videoPanel,
    /setNativeAnnotationMode\(false\);[\s\S]*setSelectedWorkspaceAnnotationId\(null\);[\s\S]*setSelectedOverlayKey\(null\);[\s\S]*setSelectedOverlaySnapshot\(null\);/,
    "saving a newly drawn native bbox must close the bbox editor instead of reselecting it",
  );

  assert.match(
    videoPanel,
    /closeSelectedOverlayEditor\(overlay\.key\);[\s\S]*clearOverlayEditingWorkspace\(\[overlay\.key, `manual-\$\{annotation\.id\}`\]\);[\s\S]*setSelectedWorkspaceAnnotationId\(null\);[\s\S]*setSelectedOverlayKey\(null\);[\s\S]*setSelectedOverlaySnapshot\(null\);/,
    "saving an edited bbox indication must clear selected workspace state so stale anchors cannot remain active",
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
    /data-vaa1-meaning-plot-section-jumps="true"/,
    "Character Paths must expose in-panel jumps so lower archetype readings remain reachable",
  );

  assert.match(
    meaningPlotPanel,
    /scrollCharacterPathSection\(dramaticArchetypeReadingsRef\)[\s\S]*Dramatic archetypes/,
    "Dramatic archetype readings must be directly navigable from the Character Paths header",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-plot-dramatic-archetypes="true"/,
    "Dramatic archetype readings must expose a stable scroll target",
  );

  assert.match(
    meaningPlotPanel,
    /panelType:\s*"ManualIdentification"/,
    "Meaning / Plot Character Paths must bridge back to the Narrative Agent panel",
  );

  assert.match(
    meaningPlotPanel,
    /Cross-tradition interpretive lenses; not fixed Narrative Agent labels/,
    "archetypes must remain electable readings rather than imposed Narrative Agent definitions",
  );

  assert.match(
    meaningPlotPanel,
    /Performed agency/,
    "dramatic archetype copy should use agency language instead of identity-first language",
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

  assert.match(
    meaningPlotPanel,
    /narrativeLensReadingsFromAnalysis/,
    "Meaning / Plot must consume governed narrative lens reading artifacts, not only local second-order terms",
  );

  assert.match(
    meaningPlotPanel,
    /characterPathReadingsFromAnalysis/,
    "Character Paths must consume governed character path reading artifacts",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-character-path-reading-artifact="true"/,
    "Character Paths must expose a stable governed artifact surface",
  );

  assert.match(
    meaningPlotPanel,
    /scenePresenceReadings/,
    "scene-presence indicators must stay navigable from governed character path readings",
  );

  assert.match(
    meaningPlotPanel,
    /INTERPRETIVE_READING_UI_CONFIG/,
    "Meaning / Plot must keep interpretive lens visibility configurable before manual polishing",
  );

  assert.match(
    meaningPlotPanel,
    /readingCanSurface/,
    "Meaning / Plot must gate readings by maturity before surfacing interpretive prose",
  );
});

test("Narrative Agent panel owns Character Paths home", () => {
  assert.match(
    masterSchemaPanel,
    /function NarrativeAgentCharacterPathsHome/,
    "Narrative Agent panel must define the Character Paths home",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-character-paths="true"/,
    "Narrative Agent Character Paths must expose a stable surface",
  );

  assert.match(
    masterSchemaPanel,
    /Agent-centered continuity, scenes, evidence, and dramatic readings live here/,
    "Character Paths must be described as agent-centered in the Narrative Agent panel",
  );

  assert.match(
    masterSchemaPanel,
    /Meaning \/ Plot remains the cross-agent plot map/,
    "Narrative Agent panel must preserve Meaning / Plot as the cross-agent plot map",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-review-compass="true"/,
    "Narrative Agent panel must expose a stable review compass for usability",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-single-profile-selector="true"/,
    "Narrative Agent panel must expose a single-profile selector instead of dumping all agents at once",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-profile-dropdown="true"/,
    "Narrative Agent panel must use a dropdown to select one canonical agent profile",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-single-profile-view="true"/,
    "Narrative Agent panel must render one selected character profile at a time",
  );

  assert.match(
    masterSchemaPanel,
    /findNarrativeAgentRowKey[\s\S]*sharesProfile[\s\S]*sharesAlias[\s\S]*likelySame/,
    "Narrative Agent rows must combine multiple labels for the same character through profile, alias, or clear label evidence",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-combined-profile-aliases="true"/,
    "Narrative Agent panel must keep combined labels visible as source evidence",
  );

  assert.match(
    masterSchemaPanel,
    /Overview[\s\S]*Evidence[\s\S]*Semantics[\s\S]*Continuity[\s\S]*Scenes/,
    "Narrative Agent review compass must name overview, evidence, semantics, continuity, and scenes",
  );

  assert.match(
    masterSchemaPanel,
    /Agent semantics are source-linked and Master-time governed[\s\S]*Meaning Network for continuity review/,
    "Narrative Agent review compass must orient semantics to source evidence and route continuity to Meaning Network",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-timeline-strip="true"/,
    "Narrative Agent panel must expose a simple one-agent timeline strip",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-timeline-handle=\{handle\.kind\}/,
    "Narrative Agent timeline strip must render clickable source, scene, and cue handles",
  );

  assert.match(
    masterSchemaPanel,
    /sourceItems[\s\S]*timeSupportsFromSourceItem[\s\S]*kind:\s*"occurrence"/,
    "Narrative Agent timeline must preserve all merged source evidence items and render occurrence handles beyond the first source item",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-timeline-cursor-line="true"/,
    "Narrative Agent timeline must expose a visible cursor synchronized to source video time",
  );

  assert.match(
    masterSchemaPanel,
    /eventBus\.on\("videoTimeLineChanged", handler\)/,
    "Narrative Agent timeline cursor must use the shared source-video timeline event",
  );

  assert.match(
    masterSchemaPanel,
    /narrativeAgentNearestTimelineHandles[\s\S]*data-vaa1-narrative-agent-timeline-near-cursor="true"/,
    "Narrative Agent timeline must provide a readable near-cursor handle lane instead of relying on dense rail labels",
  );

  assert.match(
    masterSchemaPanel,
    /narrativeAgentHandleRailGlyph[\s\S]*className=\{`absolute top-1\/2 flex h-4 w-4/,
    "Narrative Agent rail handles must render as compact markers so the timeline remains navigable",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-timeline-handle-commits-presence="true"/,
    "Narrative Agent timeline handles must commit governed presence intervals, not only navigate",
  );

  assert.match(
    masterSchemaPanel,
    /openVideoAtTime\(videoId, handle\.time\)[\s\S]*onCommitTimelineHandle\(\{ row: selectedRow, handle \}\)/,
    "Narrative Agent timeline handles must request a saved handle and still navigate to source video time",
  );

  assert.match(
    masterSchemaPanel,
    /onCommitTimelineHandle=\{\(commit\) => \{[\s\S]*commitNarrativeAgentTimelineHandle\(commit\)/,
    "Narrative Agent timeline handle commit requests must route to the Master Schema save path",
  );

  assert.match(
    masterSchemaPanel,
    /buildNarrativeAgentTimelinePresenceInterval[\s\S]*master_schema_surface:\s*"narrative_agent_profile_annotations"[\s\S]*source_range_source:\s*"narrative_agent_timeline_handle"/,
    "Narrative Agent timeline handle saves must produce Master Schema presence intervals for the Narrative Agent surface",
  );

  assert.match(
    masterSchemaPanel,
    /upsertMasterSchemaPresenceInterval\(existingCorrections, interval/,
    "Narrative Agent timeline handles must use the shared Master Schema presence interval upsert engine",
  );

  assert.match(
    masterSchemaPanel,
    /presenceIntervals:[\s\S]*master_schema_presence_intervals[\s\S]*Master Schema Narrative Agent handle[\s\S]*timeline handle/,
    "Narrative Agent timeline and graph must rehydrate saved Master Schema handle intervals",
  );

  assert.match(
    masterSchemaPanel,
    /retimeManualVisualAnnotationsFromPresenceInterval\([\s\S]*nextCorrectionsBase,[\s\S]*interval/,
    "Narrative Agent timeline handles must retime linked manual visual annotations through the same presence interval path",
  );

  assert.match(
    meaningPlotPanel,
    /upsertMasterSchemaPresenceInterval\(existing, interval/,
    "Meaning Network graph handles must use the same shared Master Schema presence interval upsert engine",
  );

  assert.match(
    annotationCorrections,
    /export function upsertMasterSchemaPresenceInterval/,
    "Master Schema presence interval upsert must be shared between Meaning Network and Narrative Agent handles",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-timeline-open-meaning-network="true"/,
    "Narrative Agent timeline strip must hand fuller continuity review to Meaning Network",
  );

  assert.match(
    masterSchemaPanel,
    /type NarrativeAgentGraphNode[\s\S]*kind:\s*"agent" \| "source" \| "scene" \| "cue" \| "occurrence"/,
    "Narrative Agent panel must model a real one-agent graph with agent, source, scene, cue, and occurrence nodes",
  );

  assert.match(
    masterSchemaPanel,
    /function buildNarrativeAgentGraphModel[\s\S]*scene_presence[\s\S]*source_anchor[\s\S]*cue_support[\s\S]*occurrence_support/,
    "Narrative Agent graph must build typed evidence edges instead of rendering nominal labels only",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-operational-graph="true"/,
    "Narrative Agent panel must render an operational graph surface",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-graph-node=\{node\.kind\}/,
    "Narrative Agent graph must render interactive typed nodes",
  );

  assert.match(
    masterSchemaPanel,
    /selectNarrativeAgentGraphNode[\s\S]*seekNarrativeAgentGraphSource\(videoId, node\.time\)[\s\S]*narrativeAgentGraphNodeSelected/,
    "Narrative Agent graph node selection must seek source video without changing panel focus and emit a governed selection event",
  );

  assert.match(
    masterSchemaPanel,
    /function seekNarrativeAgentGraphSource[\s\S]*videoTimeLineChanged[\s\S]*narrativeAgentGraphSourceSeekRequested[\s\S]*focus_panel_changed:\s*false/,
    "Narrative Agent graph source seeking must use the loaded source-video clock instead of opening another panel",
  );

  assert.doesNotMatch(
    masterSchemaPanel,
    /selectNarrativeAgentGraphNode[\s\S]{0,500}openVideoAtTime/,
    "Narrative Agent graph node selection must not call the panel-opening video navigation helper",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-graph-node-handle-label="true"[\s\S]*formatSeconds\(node\.time\)/,
    "Narrative Agent graph nodes must visibly surface their handle time instead of generic node labels only",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-graph-node-start-handle="true"[\s\S]*data-vaa1-narrative-agent-graph-node-end-handle="true"[\s\S]*data-vaa1-narrative-agent-graph-node-duration-bar="true"/,
    "Narrative Agent graph nodes must expose visible stretchable start/end handles on the nodes themselves",
  );

  assert.match(
    masterSchemaPanel,
    /startNarrativeAgentGraphNodeHandleDrag[\s\S]*setGraphNodeHandleDrag/,
    "Narrative Agent graph node handles must drag in place and update the governed presence draft without panel navigation",
  );

  assert.match(
    masterSchemaPanel,
    /const handlePointerMove[\s\S]*setGraphDurationDrafts[\s\S]*narrativeAgentGraphNodeHandleDragged[\s\S]*window\.addEventListener\("pointermove", handlePointerMove\)/,
    "Narrative Agent graph node handle dragging must update the presence draft and emit a governed drag event",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-graph-open-annotation-card="true"/,
    "Narrative Agent graph must expose an annotation-card action",
  );

  assert.match(
    masterSchemaPanel,
    /openSelectedAgentAnnotationCard[\s\S]*nodeId[\s\S]*sourcePanel:\s*"NarrativeAgentPanel"[\s\S]*narrativeAgentGraphAnnotationCardRequested/,
    "Narrative Agent graph must request the selected agent's annotation card through the shared Meaning Network sheet path",
  );

  assert.doesNotMatch(
    masterSchemaPanel,
    /openSelectedAgentAnnotationCard[\s\S]{0,900}openPanel\("MeaningPlot"/,
    "Narrative Agent graph annotation-card handoff must not navigate away from the current panel",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-graph-selection-card="true"[\s\S]*data-vaa1-narrative-agent-graph-jump-source="true"/,
    "Narrative Agent graph must expose a selected-node work card with source jump action",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-narrative-agent-graph-fast-presence-editor="true"[\s\S]*data-vaa1-narrative-agent-graph-draggable-duration-handle="true"[\s\S]*data-vaa1-narrative-agent-graph-fast-confirm-presence="true"/,
    "Narrative Agent graph must support fast draggable presence-length confirmation in place",
  );

  assert.match(
    masterSchemaPanel,
    /confirmSelectedGraphNodePresence[\s\S]*onCommitTimelineHandle\(\{[\s\S]*quick-presence/,
    "Narrative Agent graph fast confirmation must reuse the governed timeline-handle save path",
  );

  assert.match(
    masterSchemaPanel,
    /analysisDataRef[\s\S]*currentAnalysis[\s\S]*currentAnalysis\.analysisId[\s\S]*setAnalysisData\(null\)/,
    "Narrative Agent panel must keep current analysis visible during same-video background refreshes",
  );

  assert.match(
    masterSchemaPanel,
    /isLoading && !analysisData[\s\S]*data-vaa1-master-schema-background-refresh="true"/,
    "Narrative Agent panel must show only a small background refresh state when current data is still usable",
  );

  assert.match(
    masterSchemaPanel,
    /VideoService\.saveAnnotationCorrections\(videoId, nextCorrections\)[\s\S]*setAnalysisData\(\(current:[\s\S]*annotationCorrections:\s*nextCorrections/,
    "Narrative Agent fast handle saves must update local corrections optimistically instead of reloading the panel",
  );

  assert.match(
    masterSchemaPanel,
    /suppressNextLocalCorrectionRefreshRef\.current = true[\s\S]*broadcastAnalysisCorrectionRefresh\(videoId\)/,
    "Narrative Agent fast handle saves must suppress their own correction-refresh reload",
  );

  assert.match(
    masterSchemaPanel,
    /const NARRATIVE_AGENT_ARCHETYPE_LENSES/,
    "Narrative Agent panel must keep dramatic archetype readings available",
  );

  assert.match(
    masterSchemaPanel,
    /Cross-tradition readings, not imposed as Narrative Agent labels/,
    "Dramatic archetypes must stay interpretive readings, not agent identity labels",
  );

  assert.match(
    masterSchemaPanel,
    /buildNarrativeAgentPathRows/,
    "Narrative Agent Character Paths must read governed agent rows from shared analysis data",
  );

  assert.match(
    videoService,
    /analysisId:\s*id/,
    "VideoService analysis data must carry the active analysis id so panels can reject stale cross-analysis payloads",
  );

  assert.match(
    videoService,
    /masterSchemaScopedRecords[\s\S]*schemaAnalysisId === analysisId[\s\S]*recordAnalysisId === analysisId/,
    "Master Schema resolved evidence must reject records from a foreign analysis id",
  );

  assert.match(
    masterSchemaPanel,
    /setAnalysisData\(null\)[\s\S]*VideoService\.getAnalysis\(requestedVideoId\)[\s\S]*nextAnalysisData\.analysisId[\s\S]*nextAnalysisData\.analysisId !== requestedVideoId/,
    "Narrative Agent panel must clear stale data and reject late analysis responses from another saved work",
  );

  assert.match(
    masterSchemaPanel,
    /category === "Identification"[\s\S]*<NarrativeAgentCharacterPathsHome/,
    "Character Paths home must render in the Narrative Agent / Identification panel",
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
    /data-vaa1-meaning-plot-panel-scroll="true"/,
    "Meaning / Plot body must expose scrolling so child panels can reveal full data arrays",
  );
});

test("Scene Cards bridge to interpretive lens readings", () => {
  assert.match(
    sceneCardPanel,
    /data-vaa1-scene-card-interpretive-readings="true"/,
    "Scene Cards must expose a stable bridge for scene-scoped interpretive readings",
  );

  assert.match(
    sceneCardPanel,
    /interpretiveReadingsFromStatus/,
    "Scene Cards must read governed interpretive artifacts from analysis status",
  );

  assert.match(
    sceneCardPanel,
    /navigateToInterpretiveReading/,
    "Scene Card readings must remain navigable back to source evidence and Meaning / Plot",
  );

  assert.match(
    sceneCardPanel,
    /readingCanSurface/,
    "Scene Cards must gate interpretive readings by maturity before surfacing them",
  );

  assert.match(
    videoService,
    /narrativeLensReading:\s*status\.narrative_lens_reading/,
    "VideoService must carry narrative lens readings into panel analysis data",
  );

  assert.match(
    videoService,
    /characterPathReading:\s*status\.character_path_reading/,
    "VideoService must carry character path readings into panel analysis data",
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
    /not imposed as Narrative Agent labels/,
    "Narrative Agent Profile readings must remain electable rather than fixed Narrative Agent definitions",
  );

  assert.match(
    sourceMediaPanel,
    /Narrative Agent refs/,
    "Narrative Agent Profile evidence trails should not expose identification-first wording",
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
    bboxAuthority,
    /buildManualCorrectionGeometryKeyframes\(\{[\s\S]*start:\s*intervalStart,[\s\S]*end:\s*intervalEnd,[\s\S]*box:\s*governedBox,[\s\S]*anchorTime:\s*safeAnchor,[\s\S]*existingKeyframes/,
    "saved bbox geometry must bind each analyst reshape to its own manual correction keyframe",
  );

  assert.match(
    videoPanel,
    /allManualVisualAnnotations\.find\(\(item\) => item\.id === annotationId\)/,
    "saving later geometry must load the existing annotation before superseding its governed correction state",
  );

  assert.match(
    bboxAuthority,
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

test("Narrative Agent triangulation stays exposed as a governed analysis artifact", () => {
  assert.match(
    apiService,
    /identity_triangulation\?: IdentityTriangulationStatus \| null;/,
    "analysis status must expose identity triangulation summary to panels",
  );

  assert.match(
    apiService,
    /identity_triangulation: "Narrative Agent Triangulation Bundle \(JSON\)"/,
    "Narrative Agent triangulation must have a user-facing download label",
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

  assert.match(
    apiService,
    /proliferation_allowed\?:\s*boolean/,
    "frontend API types must expose whether a candidate may actually proliferate",
  );

  assert.match(
    apiService,
    /master_object_projection\?:/,
    "proliferation candidates must carry the Master Schema governance projection",
  );

  assert.match(
    videoPanel,
    /function isReviewableProliferationCandidate/,
    "BBox/ROI overlays must distinguish reviewable near matches from mature projections",
  );

  assert.match(
    videoPanel,
    /to_be_confirmed_or_canceled/,
    "near matches must surface as confirm-or-cancel candidates instead of hidden backend options",
  );

  assert.match(
    videoPanel,
    /proliferated_review_candidate/,
    "BBox/ROI source items must preserve review candidate data for inspection and traceback",
  );

  assert.match(
    apiService,
    /proliferation_decisions\?:\s*ProliferationDecision\[\]/,
    "annotation corrections must persist proliferation confirm/cancel decisions",
  );

  assert.match(
    videoPanel,
    /recordProliferationCandidateDecision/,
    "BBox/ROI review candidates must support durable analyst decisions",
  );

  assert.match(
    videoPanel,
    /evidenceProliferationCandidateDecided/,
    "candidate decisions must emit an event for downstream propagation surfaces",
  );

  assert.match(
    videoPanel,
    /Confirmed proliferation candidate/,
    "confirmed candidates must create scoped mature correction rules",
  );
});

test("Data Maturation governance panel exposes dynamic proliferation control", () => {
  assert.match(
    layoutHost,
    /import DataMaturationPanel from "\.\/panels\/DataMaturationPanel"/,
    "layout host must import the Data Maturation governance panel",
  );

  assert.ok(
    registeredPanelTypes().includes("DataMaturation"),
    "Data Maturation must be registered as an openable GoldenLayout panel",
  );

  assert.match(
    layoutHost,
    /DataMaturation:\s*"Maturation"/,
    "Data Maturation must have a visible workspace title",
  );

  assert.match(
    menuBar,
    /openSchemaPanel\("DataMaturation"\)/,
    "Lenses menu must open Data Maturation with the active analysis context",
  );

  assert.match(
    toolsPanel,
    /data-vaa1-open-data-maturation="true"/,
    "Tools governance console must provide a Data Maturation entry point",
  );

  assert.match(
    dataMaturationPanel,
    /data-vaa1-data-maturation-panel="true"/,
    "Data Maturation panel must expose a stable panel hook",
  );

  assert.match(
    dataMaturationPanel,
    /data-vaa1-data-maturation-dynamic-controls="true"/,
    "Data Maturation panel must expose guarded, dynamic, and research postures",
  );

  assert.match(
    dataMaturationPanel,
    /candidate-rich, mature-write-light/i,
    "Data Maturation panel must diagnose conservative candidate accumulation",
  );

  assert.match(
    dataMaturationPanel,
    /data-vaa1-data-maturation-constellation-lane=\{constellationLane/,
    "Data Maturation panel must surface constellational co-occurrence as a lane",
  );

  assert.match(
    dataMaturationPanel,
    /data-vaa1-data-maturation-non-user-candidate-lane=\{nonUserCandidateLane/,
    "Data Maturation panel must surface non-user-confirmed candidate governance",
  );

  assert.match(
    dataMaturationPanel,
    /data-vaa1-data-maturation-audiovisual-source-sampling-lane=\{/,
    "Data Maturation panel must surface audiovisual source sampling as an operationalization gap",
  );

  assert.match(
    dataMaturationPanel,
    /source\.sourceSamples/,
    "Data Maturation panel must count explicit audiovisual source samples",
  );

  assert.match(
    dataMaturationPanel,
    /source\.audioSampleClouds/,
    "Data Maturation panel must count audio sample clouds as source sampling substrate",
  );

  assert.match(
    dataMaturationPanel,
    /data-vaa1-data-maturation-live-proliferation-bus-lane=\{/,
    "Data Maturation panel must surface the live proliferation bus as the v2 delivery requirement",
  );

  assert.match(
    dataMaturationPanel,
    /Matcher output[\s\S]*candidate-only[\s\S]*promotion decision exists/,
    "Data Maturation panel must preserve candidate-is-not-promotion governance language",
  );

  assert.match(
    dataMaturationPanel,
    /source\.evidenceProliferationMatches/,
    "Data Maturation panel must read proliferation matcher candidates",
  );

  assert.match(
    dataMaturationPanel,
    /corrections\.proliferation_decisions/,
    "Data Maturation panel must read durable proliferation decisions",
  );

  assert.match(
    dataMaturationPanel,
    /openGovernedPanel\("MeaningNetwork"\)/,
    "Data Maturation panel must link directly to the Meaning Network graph",
  );

  assert.match(
    dataMaturationPanel,
    /data-vaa1-data-maturation-governance-matrix="true"/,
    "Data Maturation panel must expose a governance matrix for inspectable mature claims and candidates",
  );

  assert.match(
    dataMaturationPanel,
    /buildGovernanceMatrixRows\([\s\S]*manual_visual_annotations[\s\S]*proliferation_decisions[\s\S]*masterSchemaResolvedEvidence[\s\S]*evidenceProliferationMatches/,
    "governance matrix rows must be derived from manual anchors, durable decisions, mature evidence, and matcher candidates",
  );

  assert.match(
    dataMaturationPanel,
    /data-vaa1-data-maturation-quality-agent-tray="true"/,
    "Data Maturation panel must expose an audit-only Quality Agent review tray",
  );

  assert.match(
    dataMaturationPanel,
    /These tickets warn[\s\S]*They do not overwrite mature data/,
    "Quality Agent tray must remain audit-only and must not silently overwrite mature data",
  );

  assert.match(
    dataMaturationPanel,
    /candidate-without-decision-ledger/,
    "Quality Agent tray must flag candidate evidence without durable promotion/cancel/defer decisions",
  );

  assert.match(
    dataMaturationPanel,
    /source-sampling-not-operationalized/,
    "Quality Agent tray must flag missing audiovisual source sampling substrate",
  );

  assert.match(
    dataMaturationPanel,
    /function temporalCoverageAudit\([\s\S]*manual_visual_annotations[\s\S]*rawDetectedObjects[\s\S]*transcriptTimeline[\s\S]*sourceSamples/,
    "Data Maturation must audit temporal evidence coverage across annotations, detections, transcript, audio, and samples",
  );

  assert.match(
    dataMaturationPanel,
    /late-video-evidence-dropoff/,
    "Quality Agent tray must flag dramatic late-video evidence drop-off for review",
  );
});

test("Datascene Meaning Network remains available for mature scene presence proliferation", () => {
  assert.match(
    apiService,
    /datascene_meaning_network\?:\s*Record<string, unknown> \| null/,
    "frontend API status must expose the datascene meaning network artifact",
  );

  assert.match(
    videoService,
    /datasceneMeaningNetwork\?:\s*Record<string, unknown> \| null/,
    "analysis data must carry the datascene meaning network for panels",
  );

  assert.match(
    videoService,
    /datasceneMeaningNetwork:\s*status\.datascene_meaning_network \|\| null/,
    "video service must map backend datascene meaning network status into analysis data",
  );

  assert.match(
    videoService,
    /datascene_meaning_network:\s*status\.datascene_meaning_network \|\| null/,
    "raw analysis JSON must retain the datascene meaning network for traceback and downloads",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-panel-tools="true"/,
    "Meaning / Plot must surface the Meaning Network panel tooling contract",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-add-node="true"/,
    "Meaning Network tooling must support fast new-node creation",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-quick-confirm="true"/,
    "Meaning Network node markers must support fast manual confirmation",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-copy-anchor="true"/,
    "Meaning Network node markers must support copying known anchors",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-paste-anchor="true"/,
    "Meaning Network tooling must support pasting known nodes to new coordinates",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-edge-marker="true"/,
    "Meaning Network edge markers must stay visible and navigable",
  );

  assert.match(
    meaningPlotPanel,
    /onContextMenu=\{\(event\) => openMeaningNetworkEdgeContextMenu\(event, edge\)\}/,
    "Meaning Network graph edges must expose the same VAA1 context menu workflow as nodes",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-graph-panel="true"/,
    "Meaning Network must render as a graph panel, not only as a row of buttons",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-graph-node="true"/,
    "Meaning Network graph nodes must be visible interactive markers",
  );

  assert.match(
    meaningPlotPanel,
    /onContextMenu=\{\(event\) => openMeaningNetworkNodeContextMenu\(event, node\)\}/,
    "Meaning Network graph nodes must replace the browser context menu with VAA1 analyst tools",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-context-menu="true"/,
    "Meaning Network right-click must open a VAA1 context menu",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-context-copy-item="true"/,
    "Meaning Network context menu must copy whole nodes or edges",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-context-copy-content="true"/,
    "Meaning Network context menu must copy node or edge content separately from the graph item",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-context-paste-content="true"/,
    "Meaning Network context menu must paste copied content onto existing nodes",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-context-traceback="true"/,
    "Meaning Network context menu must expose traceback as a first-class analyst action",
  );

  assert.match(
    meaningPlotPanel,
    /openMeaningNetworkTraceback[\s\S]*tracebackOpenRequested/,
    "Meaning Network traceback context actions must open the shared traceback drawer",
  );

  assert.match(
    meaningPlotPanel,
    /quickConfirmMeaningNetworkNode/,
    "Meaning Network nodes must offer a quick confirm control for analyst maturation",
  );

  assert.match(
    meaningPlotPanel,
    /meaning-network-quick-confirm/,
    "Meaning Network quick confirm must persist as a governed proliferation decision",
  );

  assert.match(
    meaningPlotPanel,
    /authority_level:\s*"manual_confirmation"/,
    "Meaning Network quick confirm must persist manual confirmation authority",
  );

  assert.match(
    meaningPlotPanel,
    /raw_detection_retained_as:\s*"traceback_only"/,
    "Meaning Network quick confirm must preserve old detector state as traceback rather than active truth",
  );

  assert.match(
    meaningPlotPanel,
    /VideoService\.saveAnnotationCorrections[\s\S]*VideoService\.refreshAnalysis/,
    "Meaning Network quick confirm must refresh mature projections after saving governed corrections",
  );

  assert.match(
    meaningPlotPanel,
    /masterRecordToMeaningNode/,
    "Meaning Network must surface Master Schema records as graph and timeline nodes",
  );

  assert.match(
    meaningPlotPanel,
    /master_schema_narrative_agents/,
    "Meaning Network must group Master Schema Narrative Agent nodes for review",
  );

  assert.match(
    meaningPlotPanel,
    /master_schema_objects/,
    "Meaning Network must group Master Schema object nodes for review",
  );

  assert.match(
    meaningPlotPanel,
    /tracks_same_entity_as/,
    "Meaning Network must expose probable object-agent continuity relations",
  );

  assert.match(
    meaningPlotPanel,
    /function dedupeMeaningNetworkEdges\(edges: MeaningNetworkEdge\[\]\): MeaningNetworkEdge\[\][\s\S]*const byId = new Map<string, MeaningNetworkEdge>/,
    "Meaning Network edges must be deduped before rendering so duplicate edge ids do not flood React with key warnings",
  );

  assert.match(
    meaningPlotPanel,
    /dedupeMeaningNetworkEdges\(\[[\s\S]*\.\.\.masterSchemaMeaningEdges,[\s\S]*\.\.\.\(\(datasceneMeaningNetwork\?\.meaning_network\?\.edges \|\| \[\]\) as MeaningNetworkEdge\[\]\),[\s\S]*\.\.\.draftMeaningNetworkEdges/,
    "Meaning Network must dedupe merged Master Schema, Datascene, and draft edge sources through one shared edge list",
  );

  assert.match(
    meaningPlotPanel,
    /dedupeMeaningNetworkEvidenceRefs\(\[[\s\S]*\.\.\.\(existing\.evidence_refs \|\| \[\]\),[\s\S]*\.\.\.\(normalizedEdge\.evidence_refs \|\| \[\]\),/,
    "Meaning Network edge dedupe must preserve evidence and traceback refs instead of dropping duplicate-edge provenance",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-whole-timeline="true"/,
    "Meaning Network must provide a whole timeline view over governed scenes and evidence",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-scene-timeline="true"/,
    "Meaning Network must provide a closer scene timeline view",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-character-timeline="true"/,
    "Meaning Network must provide Narrative Agent timeline views",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-expanded=\{meaningNetworkExpanded \? "true" : "false"\}/,
    "Meaning Network must support a larger workbench mode for holistic timeline review",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-scrollable-graph="true"/,
    "Meaning Network graph must be scrollable when mature evidence density grows",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-bounded-workbench="true"/,
    "Embedded Meaning Network workbench must stay internally scrollable in crowded layouts",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-plot-panel-scroll="true"/,
    "Meaning / Plot must expose panel-level scrolling so lower evidence surfaces remain reachable",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-sticky-action-rail="true"/,
    "Meaning Network lower action affordances must remain reachable when the graph is crowded",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-continuity-lane="true"/,
    "Meaning Network must expose a continuity lane for candidate, confirmed, rejected, and conflict edges",
  );

  assert.match(
    meaningPlotPanel,
    /function meaningNetworkContinuityState[\s\S]*candidate_continuity[\s\S]*confirmed_continuity[\s\S]*rejected_continuity[\s\S]*conflict|function meaningNetworkContinuityState[\s\S]*rejected_continuity[\s\S]*conflict[\s\S]*confirmed_continuity[\s\S]*candidate_continuity/,
    "Meaning Network continuity rows must keep continuity states separate from BBox relabel authority",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-narrative-agent-appearance-table="true"/,
    "Meaning Network workbench must expose a Narrative Agent appearance review table",
  );

  assert.match(
    meaningPlotPanel,
    /type NarrativeAgentAppearanceReviewRow = \{[\s\S]*state: "confirmed" \| "candidate" \| "conflict"/,
    "Narrative Agent appearance rows must distinguish confirmed, candidate, and conflict appearances",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-narrative-agent-semantic-readiness="true"/,
    "Meaning Network workbench must expose Narrative Agent semantic readiness",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-narrative-agent-visual-pattern-samples="true"/,
    "Narrative Agent semantic readiness must surface visual pattern sample status from the start",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-narrative-agent-audio-pattern-samples="true"/,
    "Narrative Agent semantic readiness must surface audio pattern sample status from the start",
  );

  assert.match(
    meaningPlotPanel,
    /NARRATIVE_AGENT_VOCAL_AFFECT_REGISTRY[\s\S]*positive:\s*\[[\s\S]*negative:\s*\[[\s\S]*regulating:\s*\[[\s\S]*ambivalent:\s*\[/,
    "Narrative Agent vocal-affect readiness must keep positive, negative, regulating, and ambivalent registries on equal footing",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-narrative-agent-balanced-vocal-affect-registry="true"/,
    "Narrative Agent semantic readiness must visibly reject a stress/emphasis-only audio-affect model",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-narrative-agent-master-time-contract="true"/,
    "Narrative Agent semantic readiness must state that visual, vocal, transcript, and scene presence evidence share Master time",
  );

  assert.match(
    meaningPlotPanel,
    /masterTimeLabel:\s*row\.timeLabel/,
    "Narrative Agent semantic readiness rows must derive their Master time label from the source evidence time label",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-narrative-agent-transcript-interpretation-samples="true"/,
    "Narrative Agent semantic readiness must include transcript interpretation samples on the same Master time surface",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-narrative-agent-scene-presence-prose="true"/,
    "Narrative Agent semantic readiness must include simple scene-presence prose",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-node-list-scroll="true"/,
    "Meaning Network node marker lists must be independently scrollable when hundreds of detections surface",
  );

  assert.match(
    meaningPlotPanel,
    /reviewableMeaningNetworkNodes\.map/,
    "Meaning Network node marker lists must not be hard-capped before scrolling can reveal all reviewable nodes",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-edge-list-scroll="true"/,
    "Meaning Network edge marker lists must be independently scrollable when hundreds of detections surface",
  );

  assert.match(
    meaningPlotPanel,
    /reviewableMeaningNetworkEdges\.map/,
    "Meaning Network edge marker lists must not be hard-capped before scrolling can reveal all reviewable edges",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-resizable-workspace=\{meaningNetworkExpanded \? "true" : "false"\}/,
    "Meaning Network expanded mode must behave as a resizable workspace, not a cramped embedded strip",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-open-own-panel="true"/,
    "Meaning Network must expose an own-panel workspace affordance for secondary display work",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-wheel-zoom="true"/,
    "Meaning Network graph must support mouse-wheel zoom for close inspection",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-zoom-controls="true"/,
    "Meaning Network graph must expose non-wheel zoom controls",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-zoom-in="true"/,
    "Meaning Network graph must expose zoom-in control",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-zoom-out="true"/,
    "Meaning Network graph must expose zoom-out control",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-paintable-scene="true"/,
    "Meaning Network scenes must render as paintable timeline spans, not only isolated nodes",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-node-presence-bar="true"/,
    "Meaning Network graph nodes must render time-anchored presence bars",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-stretchable-node-presence="true"/,
    "Meaning Network node presence bars must expose stretch handles for analyst duration correction",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-draggable-node-presence="true"/,
    "Meaning Network node presence bars must be draggable along the scene timeline",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-single-click-selects="true"/,
    "Meaning Network graph nodes must select and activate handles on single click instead of opening another panel",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-single-click-source-verifies="true"/,
    "Meaning Network graph nodes must remain attached to video source verification on single click",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkVerificationRange/,
    "Meaning Network navigation must resolve source time from evidence, mature presence intervals, or active scene fallback",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkSourceVerified/,
    "Meaning Network source verification must emit a traceable event before source-missing review",
  );

  assert.match(
    meaningPlotPanel,
    /range_source/,
    "Meaning Network source verification must identify whether the timestamp came from source evidence or a governed presence override",
  );

  assert.match(
    meaningPlotPanel,
    /source_traceback_refs/,
    "Meaning Network source verification must preserve traceback references for mature proliferation",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-source-verifying-click="true"/,
    "Meaning Network presence bars must seek the source video when clicked",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-double-click-opens-sheet="true"/,
    "Meaning Network nodes and edges must advertise double-click sheet navigation",
  );

  assert.match(
    meaningPlotPanel,
    /generic_narrative_agent_view_opened:\s*false/,
    "Double-clicking a Meaning Network node or edge must not open the general Narrative Agent overview",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-sheet="true"/,
    "Double-clicking a Meaning Network node or edge must open a specific Meaning Sheet",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-sheet-specific-storyline="true"/,
    "Narrative Agent node sheets must expose a specific storyline leaf action",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-agent-annotation-card="true"/,
    "Narrative Agent nodes must open an annotation card in the Meaning Network sheet",
  );

  assert.match(
    meaningPlotPanel,
    /narrativeAgentAnnotationCardRowsForNode[\s\S]*characterTimelineGroups[\s\S]*renamedMeaningNetworkMarkers/,
    "Narrative Agent annotation cards must gather related detections and annotations for the selected node",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-agent-annotation-card-row=\{row\.state\}/,
    "Narrative Agent annotation cards must render each related detection or annotation as an inspectable row",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-agent-annotation-card-jump="true"[\s\S]*navigateToMeaningNetworkEvidence\(row\.node\)/,
    "Narrative Agent annotation card rows must jump back to their source evidence",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-agent-annotation-card-confirm="true"[\s\S]*quickConfirmMeaningNetworkNode\(row\.node\)/,
    "Narrative Agent annotation card rows must allow confirmation through the existing governed node save path",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-agent-annotation-card-edit="true"[\s\S]*renameMeaningNetworkNode\(row\.node\)/,
    "Narrative Agent annotation card rows must expose an edit action for the linked node label",
  );

  assert.match(
    meaningPlotPanel,
    /focusNarrativeAgentNodeId[\s\S]*focusNarrativeAgentLabel/,
    "Meaning Network must accept a focused Narrative Agent request from the Narrative Agent graph",
  );

  assert.match(
    meaningPlotPanel,
    /openNarrativeAgentAnnotationCardForRequest[\s\S]*setMeaningNetworkViewMode\("graph"\)[\s\S]*setSelectedMeaningNetworkNodeId\(node\.node_id\)[\s\S]*setMeaningNetworkSheet\(\{ kind: "node", node \}\)/,
    "Meaning Network must focus the selected Narrative Agent node sheet as an annotation card without forcing a full-screen graph",
  );

  assert.doesNotMatch(
    meaningPlotPanel,
    /openNarrativeAgentAnnotationCardForRequest[\s\S]{0,900}setMeaningNetworkExpanded\(true\)/,
    "Narrative Agent graph annotation-card requests must not trap the dashboard in the expanded Meaning Network overlay",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-close-overlay="true"/,
    "Expanded Meaning Network graph must expose an in-panel close control",
  );

  assert.match(
    meaningPlotPanel,
    /closeMeaningNetworkOverlay[\s\S]*setMeaningNetworkExpanded\(false\)[\s\S]*meaningNetworkOverlayClosed/,
    "Meaning Network graph close must collapse the overlay and emit a traceable close event",
  );

  assert.match(
    meaningPlotPanel,
    /event\.key !== "Escape"[\s\S]*closeMeaningNetworkOverlay\(\)/,
    "Expanded Meaning Network graph must close with Escape when focus is not in an editor field",
  );

  assert.match(
    meaningPlotPanel,
    /eventBus\.on\("narrativeAgentGraphAnnotationCardRequested", handler\)/,
    "Meaning Network must listen for Narrative Agent graph annotation-card requests",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkNarrativeAgentAnnotationCardOpened/,
    "Meaning Network must emit a traceable event when a Narrative Agent graph request opens the annotation card",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-edge-explanation="true"/,
    "Meaning Network edge sheets must expose a plain-language edge explanation",
  );

  assert.match(
    meaningPlotPanel,
    /persistMeaningNetworkEdgeDecision[\s\S]*proliferation_decisions/,
    "Meaning Network edge confirm or reject actions must persist as governed correction decisions",
  );

  assert.match(
    meaningPlotPanel,
    /plain_language_meaning/,
    "Meaning Network edge decisions must preserve the analyst-facing edge reading",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-sfl-sheet="true"/,
    "Meaning Network node and edge sheets must expose SFL reading confirmation controls",
  );

  assert.match(
    meaningPlotPanel,
    /type MeaningNetworkInterpretiveReadingRecord = \{[\s\S]*schema:\s*"vaa1\.meaning_network_interpretive_reading\.v1"[\s\S]*reading_id:\s*string;[\s\S]*target_kind:[\s\S]*taxonomy_path:\s*string;[\s\S]*plain_language_meaning:\s*string;[\s\S]*source_traceback_refs:\s*string\[\];[\s\S]*user_correction_stands:\s*true/,
    "Meaning Network readings must persist as complete governed reading schemas, not partial SFL fragments",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-reading-ledger="true"/,
    "Meaning Network sheets must render a ledger of multiple saved readings for the same node or edge",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-reading-add-candidate="true"/,
    "Meaning Network sheets must let analysts add candidate readings without excluding other reading categories",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-reading-row="ideational"[\s\S]*data-vaa1-meaning-network-reading-row="interpersonal"[\s\S]*data-vaa1-meaning-network-reading-row="textual"[\s\S]*data-vaa1-meaning-network-reading-row="virtues"[\s\S]*data-vaa1-meaning-network-reading-row="vices"/,
    "Meaning Network sheets must expose every main reading category as its own operational row",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-reading-row="interpersonal"[\s\S]*Relation[\s\S]*Judgement group[\s\S]*Judgement value/,
    "Meaning Network interpersonal readings must align relation, judgement group, and judgement value subcategory controls",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-compact-source="true"[\s\S]*data-vaa1-meaning-network-compact-traceback="true"/,
    "Meaning Network source verification and traceback must stay compact metadata, not large widgets",
  );

  assert.match(
    meaningPlotPanel,
    /decision_id:\s*`meaning-network-reading:\$\{readingRecord\.reading_id\}`[\s\S]*candidate_id:\s*readingRecord\.reading_id/,
    "Meaning Network reading decisions must be keyed by a complete reading id so one node can hold several readings",
  );

  assert.doesNotMatch(
    meaningPlotPanel,
    /decision_id:\s*`meaning-network-sfl:\$\{kind\}:\$\{id\}`/,
    "Meaning Network readings must not use one overwrite-prone SFL decision id per node",
  );

  assert.match(
    meaningPlotPanel,
    /type MeaningNetworkReadingDecision = "confirmed" \| "canceled" \| "deferred" \| "inspected"/,
    "Meaning Network reading saves must distinguish candidate, confirmed, rejected, and deferred schema states",
  );

  assert.match(
    meaningPlotPanel,
    /maturity_result:\s*meaningNetworkReadingMaturityResult\(decision\)/,
    "Meaning Network reading maturity results must be derived from the reading decision, not a binary SFL category",
  );

  assert.match(
    meaningPlotPanel,
    /const isConfirmedReading = decision === "confirmed"[\s\S]*proliferation_allowed:\s*isConfirmedReading/,
    "Meaning Network candidate readings must stay complete but must not proliferate until confirmed",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-reading-row="vices"[\s\S]*Vice family[\s\S]*Vice axis[\s\S]*Vice value/,
    "Meaning Network sheets must expose vices as a main category with aligned subcategory controls",
  );

  assert.match(
    meaningPlotPanel,
    /MEANING_NETWORK_SFL_VICE_FAMILY_LABELS[\s\S]*meaningNetworkViceAxisLabel[\s\S]*data-vaa1-meaning-network-sfl-vice-family-select/,
    "Meaning Network vice rows must surface vice-facing family and axis attributes, not virtue-facing labels",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-sfl-confirmation-relation-select="true"/,
    "Meaning Network SFL sheets must expose confirm/reject/alignment relations from the schema",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-sfl-judgement-group-select="true"/,
    "Meaning Network SFL sheets must route interpersonal readings through judgement groups",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-sfl-virtue-family-select="true"/,
    "Meaning Network SFL sheets must route virtue readings through virtue families",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-sfl-virtue-axis-select="true"/,
    "Meaning Network SFL sheets must route virtue readings through virtue axes",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-sfl-virtue-vice-select="true"[\s\S]*data-vaa1-meaning-network-sfl-vice-value-select="true"/,
    "Meaning Network SFL sheets must let analysts select virtue and vice values separately",
  );

  assert.match(
    meaningPlotPanel,
    /persistMeaningNetworkSflDecision[\s\S]*proliferation_decisions/,
    "Meaning Network SFL confirmations must persist as governed correction decisions",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-proliferation-feedback="true"/,
    "Meaning Network confirmations must show a visible saved/proliferation receipt",
  );

  assert.match(
    meaningPlotPanel,
    /Data Maturity Proliferation/,
    "Meaning Network save feedback must explicitly name the Data Maturity Proliferation regime",
  );

  assert.match(
    meaningPlotPanel,
    /resetMeaningNetworkReviewFrame[\s\S]*setMeaningNetworkSheet\(null\)[\s\S]*setSelectedMeaningNetworkNodeId\(null\)[\s\S]*setMeaningNetworkViewMode\("graph"\)/,
    "Meaning Network saves must clear the active node or sheet and return the workbench to the basic graph view",
  );

  assert.match(
    meaningPlotPanel,
    /candidate_reading_contributes_to_plot_structure/,
    "Confirmed SFL readings must be marked as contributing to Plot Structure",
  );

  assert.match(
    meaningPlotPanel,
    /taxonomy_path/,
    "Confirmed SFL readings must persist their full schema taxonomy path",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-active-handle=\{selected \? "true" : "false"\}/,
    "Meaning Network handle visibility must be governed by active node selection",
  );

  assert.match(
    meaningPlotPanel,
    /persistMeaningNetworkPresenceInterval/,
    "Dragged Meaning Network presence intervals must persist as mature correction records",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-master-schema-presence-anchor="true"/,
    "Meaning Network presence bars must be framed as Master Schema presence anchors",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkNodePriority/,
    "Meaning Network graph density control must preserve scenes and on-camera agents before spoken-word crowding",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkCanonicalNodeType/,
    "Meaning Network lane routing must normalize backend node type variants before deciding on-camera agent lanes",
  );

  assert.match(
    meaningPlotPanel,
    /narrativeAgentProfileToMeaningNode/,
    "Meaning Network must seed on-camera Narrative Agent lanes from governed Narrative Agent profiles",
  );

  assert.match(
    meaningPlotPanel,
    /narrative_agent_profile_id/,
    "Meaning Network presence intervals must retain the governed Narrative Agent profile id for Master Schema sync",
  );

  assert.match(
    meaningPlotPanel,
    /master_schema_surface:\s*"narrative_agent_profile_annotations"/,
    "Narrative Agent presence edits must point back to the Master Schema Narrative Agent profile surface",
  );

  assert.match(
    meaningPlotPanel,
    /narrativeAgentProfilePresenceUpdated/,
    "Meaning Network edits must notify Narrative Agent profile/card surfaces after Master Schema presence updates",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkPresenceHandleScrubbed/,
    "Meaning Network presence handles must scrub the source video while an analyst drags timing",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-handle-live-video-scrub="true"/,
    "Meaning Network presence handles must advertise live video scrubbing",
  );

  assert.match(
    meaningPlotPanel,
    /eventBus\.on\("analysisCorrectionsChanged", correctionsHandler\)/,
    "Meaning / Plot must refresh when other panels commit Master Schema correction updates",
  );

  assert.match(
    sourceMediaPanel,
    /eventBus\.on\("narrativeAgentProfilePresenceUpdated", metadataHandler\)/,
    "Narrative Agent profile cards must refresh when Meaning Network presence edits update profile timing",
  );

  assert.match(
    sourceMediaPanel,
    /data-vaa1-narrative-agent-card-presence-from-meaning-network="true"/,
    "Narrative Agent profile cards must display Meaning Network handle-derived presence intervals",
  );

  assert.match(
    sourceMediaPanel,
    /VideoService\.refreshAnalysis\(videoId\)/,
    "Narrative Agent profile cards must read Master Schema correction intervals, not only local metadata",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-master-schema-presence-interval-sync="true"/,
    "Master Schema subjects must expose Meaning Network presence interval synchronization",
  );

  assert.match(
    masterSchemaPanel,
    /master_schema_presence_intervals/,
    "Master Schema panel must read canonical presence intervals from annotation corrections",
  );

  assert.match(
    meaningPlotPanel,
    /lane_id:\s*"on_camera_agents"/,
    "Narrative Agent profile nodes must be explicitly routed to the on-camera agents lane",
  );

  assert.match(
    layoutHost,
    /registerComponentFactoryFunction\(\s*"MeaningNetwork"/,
    "Meaning Network must be available as its own GoldenLayout panel, not only an embedded subfield",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-dedicated-panel=\{dedicatedMeaningNetworkPanel \? "true" : "false"\}/,
    "Meaning Network dedicated panel mode must advertise its full-panel state",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-video-sync-cursor="true"/,
    "Meaning Network must expose a timeline cursor synchronized with the video",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkCursorChanged/,
    "Meaning Network cursor movement must emit a sync event for graph-video navigation",
  );

  assert.match(
    meaningPlotPanel,
    /off_camera_presence/,
    "Meaning Network must support off-camera or presumed scene presence tracks",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-add-lane="true"/,
    "Meaning Network must allow analysts to add custom timeline lanes",
  );

  assert.match(
    meaningPlotPanel,
    /spoken_word[\s\S]*prosody/,
    "Meaning Network must place spoken word and prosody evidence onto the shared timeline",
  );

  assert.match(
    apiService,
    /master_schema_presence_intervals\?:/,
    "annotation corrections must persist Master Schema presence intervals",
  );

  assert.match(
    apiService,
    /source_verification_status\?:/,
    "persisted Master Schema presence intervals must carry source verification status",
  );

  assert.match(
    apiService,
    /source_evidence_refs\?:/,
    "persisted Master Schema presence intervals must carry source evidence references",
  );

  assert.match(
    apiService,
    /source_traceback_refs\?:/,
    "persisted Master Schema presence intervals must carry source traceback references",
  );

  assert.match(
    apiService,
    /meaning_network_custom_lanes\?:/,
    "annotation corrections must persist analyst-defined Meaning Network lanes",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-show-all-scenes="true"/,
    "Meaning Network must let analysts reset scene focus after isolating a scene",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-add-scene="true"/,
    "Meaning Network must expose a navigable add-scene operation",
  );

  assert.match(
    meaningPlotPanel,
    /data-vaa1-meaning-network-delete-scene="true"/,
    "Meaning Network must expose a navigable delete-scene operation",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkEvidenceTimeRange/,
    "Meaning Network node and edge markers must only navigate to video when a real source time range exists",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkSourceAnchorMissing/,
    "Meaning Network must route source-missing nodes to governed review instead of fake frame zero",
  );

  assert.match(
    meaningPlotPanel,
    /fallbackPanel:\s*"MeaningNetworkSheet"/,
    "Source-missing Meaning Network nodes must stay in the node or edge sheet instead of opening a dead Master Schema view",
  );

  assert.match(
    meaningPlotPanel,
    /generic_master_schema_view_opened:\s*false/,
    "Source-missing Meaning Network navigation must not open the generic Master Schema panel",
  );

  assert.match(
    meaningPlotPanel,
    /meaningNetworkLayoutSceneFallback/,
    "Meaning Network graph layout must only use scene fallback while a scene timeline or scene focus is active",
  );

  assert.match(
    meaningPlotPanel,
    /timelineDomain/,
    "Meaning Network graph layout must keep a whole-media time domain separate from focused scene fallback",
  );

  assert.doesNotMatch(
    meaningPlotPanel,
    /if \(!range && isNarrativeAgentMeaningNode\(node\)\) \{\s*return true;\s*\}/,
    "Untimed Narrative Agent nodes must not be treated as overlapping every scene",
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
    /selectedEditUsesNarrativeAgentPicker\s*=[\s\S]*edit\.category === "Identification"/,
    "BBox/ROI Narrative Agent choices must be gated to Identification work",
  );

  assert.match(
    videoPanel,
    /data-vaa1-bbox-roi-open-evidence-label="true"/,
    "BBox/ROI non-agent categories must keep a generic evidence-label input",
  );

  assert.match(
    videoPanel,
    /data-vaa1-native-open-evidence-label="true"/,
    "native OBJ/OCR/custom annotations must keep generic evidence labels instead of character pickers",
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
    /quickAnnotations:\s*edit\.quickAnnotations/,
    "Saved BBox/ROI manual confirmation must persist additive quick annotations",
  );

  assert.match(
    bboxAuthority,
    /quick_annotations:\s*quickAnnotations/,
    "Shared BBox/ROI authority builder must persist additive quick annotations",
  );

  assert.match(
    videoPanel,
    /applyScope:[\s\S]*"this_interval_only"/,
    "BBox/ROI manual correction scope must default to this interval only",
  );

  assert.match(
    bboxAuthority,
    /apply_scope:\s*applyScope/,
    "Saved BBox/ROI manual confirmation must persist the selected apply scope",
  );

  assert.match(
    videoPanel,
    /scopeRequiresConfirmation[\s\S]*window\.confirm/,
    "Dangerous BBox/ROI propagation scopes must require explicit confirmation",
  );

  assert.match(
    bboxAuthority,
    /manual_confirmation_event[\s\S]*manual_bbox_roi_confirmation[\s\S]*old_states_retained_as:\s*"traceback_provenance"/,
    "BBox/ROI saves must record manual confirmation events and retain old history as traceback provenance",
  );

  assert.match(
    videoPanel,
    /nativeVisualAnnotationSaved/,
    "saving a native visual annotation must emit a live update event for mature downstream surfaces",
  );

  assert.match(
    videoPanel,
    /meaningNetworkPresenceManualOverlays/,
    "Video panel must surface source-anchored Meaning Network presence intervals as governed BBox overlays",
  );

  assert.match(
    videoPanel,
    /meaning_network_presence_interval/,
    "Meaning Network-derived video BBoxes must retain their presence interval provenance",
  );

  assert.match(
    meaningPlotPanel,
    /eventBus\.on\("nativeVisualAnnotationSaved", handler\)/,
    "Meaning Network must consume native annotation saves as live node updates",
  );

  assert.match(
    meaningPlotPanel,
    /manual_visual_annotations/,
    "Meaning Network live native annotation nodes must point back to the Master Schema manual annotation surface",
  );

  assert.doesNotMatch(
    videoPanel,
    /const visibleTime =\s*const visibleTime =/,
    "BBox/ROI interaction timing must not contain duplicate ghost refresh/timing declarations",
  );

  assert.match(
    videoPanel,
    /useVisibleObjectTime[\s\S]*overlay\.modality === "object"/,
    "Object BBox/ROI correction timing must prefer the visible interaction time when detector bounds are stale",
  );

  assert.match(
    videoPanel,
    /setSelectedWorkspaceAnnotationId\(null\)/,
    "Saved manual BBox/ROI corrections must clear selected workspace state after persistence",
  );

  assert.match(
    videoPanel,
    /setSelectedOverlayKey\(null\)/,
    "Saved manual BBox/ROI corrections must close the active overlay instead of falling back to stale detector labels",
  );

  assert.match(
    videoPanel,
    /masterSchemaManualCorrectionCommitted[\s\S]*partial_propagation_allowed:\s*false/,
    "Manual BBox/ROI corrections must emit a Master Schema propagation event that disallows partial propagation",
  );

  assert.match(
    annotationCorrections,
    /buildMasterSchemaPresenceIntervalForManualAnnotation/,
    "Manual BBox/ROI corrections must be able to create the Master Schema presence anchor they feed",
  );

  assert.match(
    annotationCorrections,
    /manualVisualAnnotationPresenceNodeId/,
    "Manual BBox/ROI and Meaning Network presence intervals must share a stable node id rhythm",
  );

  assert.match(
    videoPanel,
    /upsertMasterSchemaPresenceIntervalForManualAnnotation\([\s\S]*upsertManualVisualAnnotation\(/,
    "BBox/ROI saves must update manual visual annotations and Master Schema presence intervals together",
  );

  assert.match(
    videoPanel,
    /interval\.source_evidence_refs\?\.some\([\s\S]*manual_visual_annotation/,
    "Video BBox visibility must honor Master Schema presence anchors linked to manual annotations regardless of source panel",
  );

  assert.match(
    meaningPlotPanel,
    /const sourceEvidenceRefs = interval\.source_evidence_refs\?\.length[\s\S]*interval\.source_evidence_refs/,
    "Meaning Network nodes rebuilt from Master Schema intervals must keep the original BBox evidence refs",
  );

  assert.match(
    meaningPlotPanel,
    /retimeManualVisualAnnotationsFromPresenceInterval\([\s\S]*nextCorrectionsBase,[\s\S]*interval/,
    "Meaning Network handle edits must retime linked manual BBox annotations while persisting Master Schema intervals",
  );

  assert.match(
    annotationCorrections,
    /master_schema_presence_interval_id:[\s\S]*interval\.id/,
    "Manual BBox annotations retimed from Master Schema must remember the governing presence interval",
  );

  assert.match(
    annotationCorrections,
    /removeManualVisualAnnotation[\s\S]*master_schema_presence_intervals:[\s\S]*manualVisualAnnotationPresenceIntervalId\(entryId\)[\s\S]*manual_visual_annotation/,
    "Removing a manual BBox must remove its Master Schema presence anchor so Meaning Network cannot keep a ghost interval",
  );

  assert.match(
    videoPanel,
    /restoreEvidenceToAnalysis[\s\S]*upsertMasterSchemaPresenceIntervalForManualAnnotation\([\s\S]*upsertManualVisualAnnotation/,
    "Restoring raw/provenance evidence must create a manual BBox and Master Schema presence anchor together",
  );

  assert.match(
    videoPanel,
    /restoreEvidenceToAnalysis[\s\S]*const annotation = buildManualBBoxRoiAnnotation\(\{[\s\S]*analysisId:\s*targetVideoId,[\s\S]*authorityState:\s*"manual_restored"[\s\S]*source_range_source:\s*"restore_to_analysis"[\s\S]*provenance_restore:\s*true/,
    "Restoring raw/provenance evidence must use the shared BBox/ROI authority builder while preserving restore provenance",
  );

  assert.match(
    videoPanel,
    /DROP_CORRECTION_VALUE[\s\S]*filteredOverrides[\s\S]*timeOverlaps/,
    "Restoring raw/provenance evidence must clear the matching drop suppression instead of leaving the source hidden",
  );

  assert.match(
    videoPanel,
    /data-vaa1-bbox-restore-to-analysis="true"/,
    "BBox/ROI evidence operations must expose Restore to analysis next to raw detection Drop",
  );

  assert.match(
    videoPanel,
    /const droppedEvidenceRepository = useMemo<DroppedEvidenceRepositoryItem\[\]>/,
    "VideoPanel must build an actual dropped evidence repository from suppression correction rules",
  );

  assert.match(
    videoPanel,
    /data-vaa1-dropped-evidence-repository="true"/,
    "Dropped detections must be browsable from a dedicated repository surface",
  );

  assert.match(
    videoPanel,
    /id="vaa1-dropped-evidence-picker"[\s\S]*role="listbox"[\s\S]*data-vaa1-dropped-evidence-restore="true"/,
    "Dropped evidence repository picker must expose a selected Restore action without expanding the video layout",
  );

  assert.match(
    videoPanel,
    /openTracebackForDroppedEvidence[\s\S]*sourcePanel: "DroppedEvidenceRepository"/,
    "Dropped evidence repository rows must preserve traceback navigation for each source item",
  );

  assert.match(
    videoPanel,
    /restoreDroppedEvidence[\s\S]*sourcePanel: "DroppedEvidenceRepository"/,
    "Dropped evidence repository restore actions must route through the governed restore writer",
  );

  assert.match(
    videoPanel,
    /restoreEvidenceToAnalysisRequested/,
    "VideoPanel must accept restore requests from provenance surfaces such as Traceback",
  );

  assert.match(
    tracebackDrawerPanel,
    /data-vaa1-action="restore-to-analysis"/,
    "Traceback drawer must expose Restore to analysis for raw/provenance evidence",
  );

  assert.match(
    tracebackDrawerPanel,
    /restoreEvidenceToAnalysisRequested/,
    "Traceback drawer restore must route through the VideoPanel correction authority writer",
  );
});

test("Master Schema Narrative Agent authority surfaces are navigable evidence anchors", () => {
  assert.match(
    masterSchemaPanel,
    /data-vaa1-master-schema-subject-navigation="true"/,
    "Master Schema Subject Authority cards must be clickable evidence navigation entries",
  );

  assert.match(
    masterSchemaPanel,
    /onContextMenu=\{\(event\) => openSubjectTraceback\(event, subject\)\}/,
    "governed subject cards must expose a secondary traceback path",
  );

  assert.match(
    masterSchemaPanel,
    /masterSchemaEvidenceNavigationRequested/,
    "Master Schema evidence clicks must emit a shared navigation event",
  );

  assert.match(
    masterSchemaPanel,
    /ANCHOR_SURFACE_NAVIGATION[\s\S]*panel_corrections[\s\S]*bbox_roi_corrections[\s\S]*metadata_corrections[\s\S]*narrative_agent_profiles/,
    "User Confirmed Anchor surfaces must map to concrete navigation targets",
  );

  assert.match(
    masterSchemaPanel,
    /openConfirmationFamily[\s\S]*concise_pattern_confirmation[\s\S]*emitEvidenceTraceback/,
    "Concise Pattern Confirmation chips must open their supporting traceback evidence",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-manual-narrative-agent-row-navigation=\{[\s\S]*group\.category === "Identification"/,
    "manual Narrative Agent rows must keep their direct video/BBox navigation affordance visible to tests",
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
    /expressionPersonAnchor \|\| synthesizedExpressionOwnerBox \|\| targetCandidateId[\s\S]*\? "object"/,
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
    bboxAuthority,
    /export function synthesizePersonBoxFromExpression/,
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

  assert.match(
    menuBar,
    /Narrative Agent Leaf/,
    "Top navigation should expose the legacy Identification leaf as Narrative Agent",
  );

  assert.match(
    layoutHost,
    /title:\s*"Narrative Agent"/,
    "GoldenLayout leaf title should expose the legacy Identification category as Narrative Agent",
  );

  assert.match(
    layoutHost,
    /normalizeLegacyLayoutLabels/,
    "Saved GoldenLayout workspaces should migrate legacy panel labels on restore",
  );

  assert.match(
    layoutHost,
    /layoutContainsComponent\(restoredLayout,\s*"VideoPanel"\)/,
    "Saved GoldenLayout workspaces must not restore without the Video panel",
  );

  assert.match(
    layoutHost,
    /Manual \$\{manualCategoryDisplayLabel\(leaf\.category\)\} annotations/,
    "Manual leaf descriptions should use analyst-facing Narrative Agent labels",
  );

  assert.match(
    videoPanel,
    /value:\s*"identification", label:\s*"Narrative Agent"/,
    "Video ROI intent label should use Narrative Agent while preserving the legacy intent value",
  );

  assert.match(
    toolsPanel,
    /Manual Narrative Agent annotations/,
    "Tools manual leaf copy should use Narrative Agent language",
  );

  assert.match(
    apiService,
    /identity_triangulation: "Narrative Agent Triangulation Bundle \(JSON\)"/,
    "Download labels should use Narrative Agent language for legacy identity artifacts",
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

test("browser refresh shortcuts remain reserved for the browser", () => {
  assert.match(
    videoPanel,
    /event\.defaultPrevented \|\| event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey/,
    "global video keyboard shortcuts must leave Cmd/Ctrl browser shortcuts alone",
  );

  assert.doesNotMatch(
    `${videoPanel}\n${meaningPlotPanel}\n${menuBar}\n${layoutHost}`,
    /(?:metaKey|ctrlKey)[\s\S]{0,160}key(?:\.toLowerCase\(\))?\s*={0,2}={0,1}\s*["']r["'][\s\S]{0,160}preventDefault\(\)/i,
    "VAA1 must not intercept Cmd/Ctrl+R refresh",
  );

  assert.match(
    menuBar,
    /Reload UI \/ Refresh Workspace/,
    "the menu must expose an explicit reload path when HMR does not surface new frontend changes",
  );
});
