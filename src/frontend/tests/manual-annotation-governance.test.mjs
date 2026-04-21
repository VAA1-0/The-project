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
const videoPanel = read("app/V2components/components/panels/VideoPanel.tsx");
const toolsPanel = read("app/V2components/components/panels/ToolsPanel.tsx");
const layoutHost = read("app/V2components/components/LayoutHost.tsx");
const videoService = read("lib/video-service.ts");

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

