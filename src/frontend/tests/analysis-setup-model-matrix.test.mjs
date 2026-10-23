import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/V2components/components/panels/ToolsPanel.tsx", import.meta.url),
  "utf8",
);

test("Analysis setup keeps scan, morphology, licensed model, and other setup choices together", () => {
  assert.match(source, /key: "analysis", label: "Analysis setup"/);
  assert.match(source, />1\. Scan choice</);
  assert.match(source, />\s*2\. Morphology choice\s*</);
  assert.match(source, /3\. Model choice matrix and licence record/);
  assert.match(source, /4\. Other analysis setup navigation/);
});

test("model choices are project-scoped and disclose licence and runtime status", () => {
  assert.match(source, /ANALYSIS_MODEL_SELECTIONS_KEY_PREFIX/);
  assert.match(source, /activeProjectScopeId\(\)/);
  assert.match(source, /candidate\.license/);
  assert.match(source, /candidate\.core_compatible/);
  assert.match(source, /does not install, license, or activate/);
});
