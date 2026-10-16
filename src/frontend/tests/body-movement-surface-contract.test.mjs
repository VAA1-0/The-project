import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../lib/video-service.ts", import.meta.url), "utf8");
const video = readFileSync(new URL("../app/V2components/components/panels/VideoPanel.tsx", import.meta.url), "utf8");
const objects = readFileSync(new URL("../app/V2components/components/panels/OBJDetectionPanel.tsx", import.meta.url), "utf8");
const meaning = readFileSync(new URL("../app/V2components/components/panels/MeaningPlotPanel.tsx", import.meta.url), "utf8");

test("behavioral detections hydrate as canonical analysis data", () => {
  assert.match(service, /bodyMovementDetections: BodyMovementDetection\[\]/);
  assert.match(service, /collectBodyMovementDetections/);
  assert.match(service, /body_movement_detections/);
  assert.match(service, /pose_detections/);
});

test("behavioral detections surface in object and rendered BBox views", () => {
  assert.match(objects, /Body movement detections/);
  assert.match(objects, /analysisData\?\.bodyMovementDetections/);
  assert.match(video, /bodyMovementDetections/);
  assert.match(video, /behavioral candidate/);
});

test("behavioral evidence becomes traceable candidate nodes and agent relations", () => {
  assert.match(meaning, /bodyMovementMeaningNodes/);
  assert.match(meaning, /bodyMovementMeaningEdges/);
  assert.match(meaning, /behavioral_supports/);
  assert.match(meaning, /candidate_only/);
});
