import test from "node:test";
import assert from "node:assert/strict";

import { buildAnalysisSearchParams } from "../lib/analysis-request.js";

test("buildAnalysisSearchParams uses safe defaults", () => {
  const params = buildAnalysisSearchParams();

  assert.equal(params.get("pipeline_type"), "full");
  assert.equal(params.get("apply_face_anonymization"), "false");
  assert.equal(params.get("face_message_style"), "plain");
  assert.equal(params.get("face_requires_person_detection"), "false");
});

test("buildAnalysisSearchParams includes all selected face options", () => {
  const params = buildAnalysisSearchParams("visual_only", {
    applyFaceAnonymization: true,
    faceMessageStyle: "starfleet",
    faceRequiresPersonDetection: true,
  });

  assert.equal(params.get("pipeline_type"), "visual_only");
  assert.equal(params.get("apply_face_anonymization"), "true");
  assert.equal(params.get("face_message_style"), "starfleet");
  assert.equal(params.get("face_requires_person_detection"), "true");
});
