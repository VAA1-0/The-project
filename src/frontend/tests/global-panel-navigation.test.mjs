import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("every Datascene leaf receives conservative global save and refresh controls", () => {
  const host = read("app/V2components/components/LayoutHost.tsx");
  assert.match(host, /function GlobalPanelNavigation/);
  assert.match(host, /data-vaa1-global-panel-navigation="true"/);
  assert.match(host, /aria-label="Save panel"/);
  assert.match(host, /aria-label="Refresh panel"/);
  assert.match(host, /<GlobalPanelNavigation[\s\S]*componentName=\{componentName\}/);
});
test("panel save checkpoints layout and verifies canonical persistence without remounting", () => {
  const host = read("app/V2components/components/LayoutHost.tsx");
  assert.match(host, /workspaceCheckpointRequested/);
  assert.match(host, /layout\.saveLayout\(\)/);
  assert.match(host, /apiService\.getAnnotationCorrections\(analysisId\)/);
  assert.match(host, /panelSaveRequested/);
  assert.match(host, /Saved/);
  assert.doesNotMatch(host, /panelSaveRequested[\s\S]{0,500}window\.location\.reload/);
});

test("panel refresh reloads canonical data and broadcasts the saved envelope in place", () => {
  const host = read("app/V2components/components/LayoutHost.tsx");
  assert.match(host, /VideoService\.refreshAnalysis\(targetAnalysisId\)/);
  assert.match(host, /analysisCorrectionsChanged/);
  assert.match(host, /annotationCorrections: canonicalCorrections/);
  assert.match(host, /panelRefreshRequested/);
  assert.doesNotMatch(host, /panelRefreshRequested[\s\S]{0,500}window\.location\.reload/);
});

test("late-opened panels recover retained project-bound analysis identity", () => {
  const host = read("app/V2components/components/LayoutHost.tsx");
  const bus = read("lib/golden-layout-lib/eventBus.ts");
  assert.match(bus, /RETAINED_CONTEXT_EVENTS[\s\S]*"videoIdChanged"[\s\S]*"activeAnalysisContext"/);
  assert.match(bus, /RETAINED_CONTEXT_EVENTS\.has\(event\)[\s\S]*this\.latest\.has\(event\)[\s\S]*cb\(this\.latest\.get\(event\) as T\)/);
  assert.match(host, /eventBus\.on\("activeAnalysisContext", handleAnalysis\)/);
  assert.match(host, /eventBus\.emit\("activeAnalysisContextRequest", null\)/);
  assert.match(host, /Analysis binding unavailable/);
  assert.match(host, /targetAnalysisId[\s\S]*VideoService\.refreshAnalysis\(targetAnalysisId\)/);
});
