import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const panel = fs.readFileSync(path.join(root, "app/V2components/components/panels/DownloadPanel.tsx"), "utf8");
const api = fs.readFileSync(path.join(root, "lib/api-service.ts"), "utf8");

test("completed analysis account exposes evidence states, history, limitations and publication", () => {
  assert.match(panel, /data-vaa1-completed-analysis="true"/);
  for (const label of ["Confirmed", "Candidates", "Withheld", "Artifacts", "Limitations and missingness", "Decisions\/history", "Data Book publication"]) {
    assert.match(panel, new RegExp(label));
  }
});
test("analyst completion freezes an edition without declaring later correction impossible", () => {
  assert.match(panel, /Confirm Analysis 1\.0 complete/);
  assert.match(panel, /Freeze next edition/);
  assert.match(panel, /later corrections remain possible in a later edition/);
  assert.match(api, /completeAnalysisEdition/);
});
