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
  assert.match(source, /data-vaa1-model-license-literature="true"/);
  assert.match(source, /candidate\.role/);
  assert.match(source, /reference\.peer_reviewed/);
  assert.match(source, /candidate\.runtime\.available/);
  assert.match(source, /no peer-reviewed literature declared/);
  assert.match(source, /does not install, license, or activate/);
  assert.match(source, /release-safe fallback remains a permissive local provider/);
  assert.match(source, /Datascene Native Object Appearance v1/);
  assert.match(source, /object_detection_license_authority/);
  assert.match(source, /analyst_explicit_selection/);
  assert.match(source, /release-safe fallback remains a permissive local provider/);
  assert.match(source, /analyst_authorized_development_profile_2026_10_25/);
  assert.match(source, /data-vaa1-object-detection-threshold="analyst-configurable"/);
  assert.match(source, /development profile uses analyst-authorized YOLOv8 at 15%/);
});

test("face measurement model knowledge is shared by Analysis Setup and the working Tools surface", () => {
  assert.match(source, /feature\.feature_id === "facial_landmark_embedding"/);
  assert.match(source, /data-vaa1-face-measurement-runtime="true"/);
  assert.match(source, /Installed and ready for local measurement/);
  assert.match(source, /candidate\.runtime\?\.installation_command/);
});
