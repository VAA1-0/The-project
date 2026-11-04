import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/V2components/components/panels/DataMaturationPanel.tsx", import.meta.url),
  "utf8",
);

test("Data Maturation exposes all empirical detection cluster domains", () => {
  assert.match(source, /type EmpiricalClusterDomain = "visual" \| "audio" \| "textual"/);
  assert.match(source, /data-vaa1-empirical-cluster-taxonomy="true"/);
  assert.match(source, /data-vaa1-cluster-domain-selector="true"/);
  for (const family of [
    "object_and_object_track",
    "set_location_and_environment",
    "visual_concept_recurrence_candidate",
    "speaker_turn_and_diarization_cluster",
    "audio_sample_and_sample_cloud",
    "transcript_segment_and_word",
    "ocr_text",
    "token_lemma_and_pos",
    "quant_frequency_and_repetition",
    "named_entity_and_reference",
  ]) {
    assert.match(source, new RegExp(`id: "${family}"`));
  }
});

test("cluster taxonomy derives truthful availability and keeps interpretation deferred", () => {
  assert.match(source, /data-vaa1-cluster-family-state=\{row\.count > 0 \? "evidence_available" : "not_available"\}/);
  assert.match(source, /disabled=\{row\.count === 0\}/);
  assert.match(source, /Existing evidence projections only · interpretation deferred/);
  assert.match(source, /data-vaa1-interpretive-clusters-deferred="true"/);
  assert.match(source, /openPanel\(row\.panel, \{ videoId \}\)/);
});

test("set and location exploration includes governed source metadata proposals", () => {
  for (const field of ["location_country", "location_city", "location_place", "location_room"]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /source_media_metadata:location_/);
  assert.match(source, /visual\.set_location_recognition/);
  assert.match(source, /measured wide-frame recurrence, Source Media location proposals, and Scene Card setting evidence/);
  assert.match(source, /samples: empiricalClusterSamples\(setLocationRecords, "set-location", "Set \/ location"\)/);
});
