import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(
  new URL("../app/V2components/components/panels/DataMaturationPanel.tsx", import.meta.url),
  "utf8",
);
const api = readFileSync(new URL("../lib/api-service.ts", import.meta.url), "utf8");

test("every empirical family uses one source-linked cluster workbench shell", () => {
  assert.match(panel, /data-vaa1-shared-empirical-cluster-workbench="true"/);
  assert.match(panel, /data-vaa1-cluster-quality-header="true"/);
  assert.match(panel, /Cohesion \/ purity proxy/);
  assert.match(panel, /Nearest competitor/);
  assert.match(panel, /data-vaa1-cluster-temporal-distribution="true"/);
  assert.match(panel, /data-vaa1-cluster-representative-problematic="true"/);
  assert.match(panel, /data-vaa1-cluster-sample-list="true"/);
  assert.match(panel, /data-vaa1-cluster-adjustment-bench="true"/);
  assert.match(panel, /data-vaa1-cluster-propagation-impact="true"/);
});

test("threshold preview is non-writing and missing families stay honest", () => {
  assert.match(panel, /data-vaa1-cluster-threshold-preview="non-writing"/);
  assert.match(panel, /Preview only—does not write/);
  assert.match(panel, /No synthetic samples are created/);
  assert.match(panel, /category matcher not registered/);
});

test("batch decisions preserve explicit user authority and domain-aware projections", () => {
  assert.match(panel, /persistEmpiricalClusterBatch/);
  assert.match(panel, /explicit_user_confirmation/);
  assert.match(panel, /confirmation_is_absolute_user_authority/);
  assert.match(panel, /family\.domain === "visual"/);
  assert.match(panel, /family\.domain === "audio"/);
  assert.match(panel, /Confirm selected/);
  assert.match(panel, /Defer selected/);
  assert.match(panel, /Exclude selected/);
  assert.match(panel, /Requires preserved family lineage and rollback receipt/);
  assert.match(panel, /Commit threshold/);
});

test("generic measured-embedding previews use the canonical backend route", () => {
  assert.match(api, /exploreEmpiricalClusters/);
  assert.match(api, /\/clusters\/explore/);
  assert.match(api, /none_preview_only/);
});
