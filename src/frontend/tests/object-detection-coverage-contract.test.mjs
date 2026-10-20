import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("object workbench exposes raw candidates without presenting them as tracked evidence", () => {
  const panel = read("app/V2components/components/panels/OBJDetectionPanel.tsx");

  assert.match(panel, /Unmatched raw candidates/);
  assert.match(panel, /filterUntrackedRawObjectCandidates\(groupedObjects, rawDetectedObjects\)/);
  assert.match(panel, /raw samples are already represented by tracked intervals/);
  assert.match(panel, /analysisData\?\.rawDetectedObjects/);
});

test("candidate filtering uses class and tracked source intervals without promoting raw data", () => {
  const service = read("lib/video-service.ts");

  assert.match(service, /export function filterUntrackedRawObjectCandidates/);
  assert.match(service, /rawClass !== trackedClass/);
  assert.match(service, /Math\.min\(start, end\) - edgeTolerance/);
  assert.match(service, /Math\.max\(start, end\) \+ edgeTolerance/);
});

test("video overlay falls back to raw detections only when no tracked object covers the beat", () => {
  const panel = read("app/V2components/components/panels/VideoPanel.tsx");

  assert.match(
    panel,
    /trackedAtCurrentBeat\.length\s*\?\s*trackedAtCurrentBeat\s*:\s*buildLocalObjectOverlays\(rawDetectedObjects, currentTime\)/,
  );
  assert.match(panel, /does not promote them to tracked or mature evidence/);
});
