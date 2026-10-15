import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Data Maturation exposes the governed constellational maturity gate", () => {
  const panel = read("app/V2components/components/panels/DataMaturationPanel.tsx");
  assert.match(panel, /data-vaa1-constellational-maturity-contract="true"/);
  assert.match(panel, /data-vaa1-constellational-proof-threshold="0\.99"/);
  assert.match(panel, /three independent modalities/);
  assert.match(panel, /source-time anchoring/);
  assert.match(panel, /project agreement/);
  assert.match(panel, /no unresolved conflict/);
  assert.match(panel, /duplicated derived confidence remains a candidate/);
});

test("Stage 4 records completed rendered consumer-matrix acceptance", () => {
  const contract = read("../../docs/stage4_inspectable_evidence_operating_contract_2026-10-15.md");
  assert.match(contract, /Status: Delivered; rendered Stage 4 acceptance passed/);
  assert.match(contract, /Delivered sixth vertical slice — Stage 4 closure/);
  assert.match(contract, /all sixteen named surfaces share one revision-bound bidirectional Global\s+Clock/);
  assert.match(contract, /Stage 4 is delivered/);
});
