import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const panelPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../app/V2components/components/panels/DataMaturationPanel.tsx",
);
const source = fs.readFileSync(panelPath, "utf8");

test("Data Maturation exposes Narrative Agent Digital Twin navigation", () => {
  assert.match(source, /getNarrativeAgentDigitalTwins/);
  assert.match(source, /data-vaa1-narrative-agent-digital-twin-navigation/);
  assert.match(source, /data-vaa1-digital-twin-source-jump/);
  assert.match(source, /openVideoAtTime\(anchor\.analysis_id, start\)/);
  assert.match(source, /modality_coverage\.present/);
  assert.match(source, /modality_coverage\.missing/);
  assert.match(source, /data-vaa1-digital-twin-recognition-workflow/);
  assert.match(source, /data-vaa1-digital-twin-candidate-bands/);
  assert.match(source, /data-vaa1-digital-twin-shared-decision-regime/);
  assert.match(source, /confirmation is never requested twice/);
  assert.match(source, /data-vaa1-digital-twin-applicable-navigation/);
  assert.match(source, /Open Narrative Agent/);
  assert.match(source, /Open Scene Cards/);
  assert.match(source, /Open Transcript/);
  assert.match(source, /Open Audio/);
  assert.match(source, /Open OCR/);
  assert.match(source, /Open Meaning Network/);
  assert.match(source, /Open Master Schema/);
  assert.match(source, /Open Traceback/);
  assert.match(source, /openPanel\("ManualIdentification"/);
  assert.match(source, /openPanel\("Transcript"/);
  assert.match(source, /openPanel\("TracebackDrawer"/);
  assert.match(source, /data-vaa1-digital-twin-primary-confirmation/);
  assert.match(source, /Confirm Digital Twin 100%/);
  assert.match(source, /data-vaa1-digital-twin-confirmed/);
  assert.match(source, /Digital Twin confirmed 100%/);
  assert.match(source, /decision\.candidate_id === twin\.twin_id/);
  assert.match(source, /One user confirmation satisfies maturation/);
  assert.match(source, /queue: isConfirmedDecision \? "content" : "manual"/);
  assert.match(source, /data-vaa1-digital-twin-single-frame-warning/);
  assert.match(source, /cross-dissolve/);
});
