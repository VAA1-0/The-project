import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const videoService = read("lib/video-service.ts");
const localArtifactRoute = read("app/api/local-analysis/[analysisId]/download/[fileType]/route.ts");
const statsKit = read("app/V2components/components/panels/StatsKitPanel.tsx");

test("completed analyses hydrate canonical StatsKit visual and relationship sidecars", () => {
  for (const artifact of [
    "spatial_tone_scan",
    "adaptive_visual_scan",
    "native_statistical_interpretation",
  ]) {
    assert.match(videoService, new RegExp(`loadJsonArtifact\\(id, "${artifact}"\\)`));
    assert.match(localArtifactRoute, new RegExp(`${artifact}: path\\.join\\(resultDirectory`));
  }
  assert.match(videoService, /spatialToneScan:\s*hydratedSpatialToneScan/);
  assert.match(videoService, /adaptiveVisualScan:\s*hydratedAdaptiveVisualScan/);
});

test("unimplemented contradiction resolution is not scored as a selected-analysis zero", () => {
  assert.doesNotMatch(statsKit, /id:\s*"contradiction"[^\n]*value:\s*null/);
  assert.match(statsKit, /data-vaa1-unimplemented-maturity-capability="contradiction-resolution"/);
  assert.match(statsKit, /platform capability gap, not a measured zero/);
});
