import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../lib/video-service.ts", import.meta.url), "utf8");
const video = readFileSync(new URL("../app/V2components/components/panels/VideoPanel.tsx", import.meta.url), "utf8");
const objects = readFileSync(new URL("../app/V2components/components/panels/OBJDetectionPanel.tsx", import.meta.url), "utf8");
const audio = readFileSync(new URL("../app/V2components/components/panels/AudioPanel.tsx", import.meta.url), "utf8");
const meaning = readFileSync(new URL("../app/V2components/components/panels/MeaningPlotPanel.tsx", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../../api_server.py", import.meta.url), "utf8");

test("behavioral detections hydrate as canonical analysis data", () => {
  assert.match(service, /bodyMovementDetections: BodyMovementDetection\[\]/);
  assert.match(service, /collectBodyMovementDetections/);
  assert.match(service, /body_movement_detections/);
  assert.match(service, /pose_detections/);
  assert.match(service, /loadJsonArtifact\(id, "body_movement_detections"\)/);
  assert.match(backend, /"body_movement_detections": \(/);
});

test("behavioral detections surface in object and rendered BBox views", () => {
  assert.match(objects, /Body movement evidence/);
  assert.match(objects, /analysisData\?\.bodyMovementDetections/);
  assert.match(objects, /data-vaa1-movement-saloon-door/);
  assert.match(objects, /openVideoAtTime\(videoId, movement\.start\)/);
  assert.match(video, /bodyMovementDetections/);
  assert.match(video, /behavioral candidate/);
  assert.match(video, /data-vaa1-evidence-source=/);
});

test("behavioral evidence becomes traceable candidate nodes and agent relations", () => {
  assert.match(meaning, /bodyMovementMeaningNodes/);
  assert.match(meaning, /bodyMovementMeaningEdges/);
  assert.match(meaning, /behavioral_supports/);
  assert.match(meaning, /candidate_only/);
});

test("measured lip synchrony hydrates and surfaces as source-linked evidence", () => {
  assert.match(service, /activeSpeakerSynchrony\?:/);
  assert.match(service, /active_speaker_synchrony/);
  assert.match(service, /loadJsonArtifact\(id, "active_speaker_synchrony"\)/);
  assert.match(backend, /"active_speaker_synchrony": \(/);
  assert.match(audio, /activeSpeakerSynchronyRows/);
  assert.match(audio, /data-vaa1-active-speaker-synchrony="true"/);
  assert.match(audio, /data-vaa1-lip-sync-row=/);
  assert.match(audio, /jumpTo\(row\.start,/);
});
