import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const governance = readFileSync(new URL("../lib/scene-governance.ts", import.meta.url), "utf8");
const panel = readFileSync(
  new URL("../app/V2components/components/panels/SceneCardPanel.tsx", import.meta.url),
  "utf8",
);

test("measured scene detection outranks coarse Master Schema fallback windows", () => {
  const motion = governance.indexOf("const motionSegments = motionSceneSegmentsFromAnalysis");
  const master = governance.indexOf("const masterSegments = masterSchemaTemporalSegmentsFromAnalysis", motion);
  assert.ok(motion >= 0 && master > motion);
  assert.match(governance, /if \(motionSegments\.length\) \{\s*return motionSegments;/);
});

test("Scene Cards projects every measured scene interval into the navigable UI", () => {
  assert.match(panel, /matureSceneSegments\.map\(\(segment, index\)/);
  assert.match(panel, /scene_id: segment\.scene_id \|\| `detected-scene-/);
  assert.match(panel, /start_ms: Math\.round\(segment\.start \* 1000\)/);
  assert.match(panel, /scene_boundary_source: segment\.source/);
});
