import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../../..");
const contract = fs.readFileSync(
  path.join(root, "docs/stage5_reproducible_measurements_operating_contract_2026-10-15.md"),
  "utf8",
);
const regime = fs.readFileSync(
  path.join(root, "docs/vaa1_general_sprint_regime_remaining_tasks.md"),
  "utf8",
);

test("Stage 5 requires the recovery ladder before not computed", () => {
  assert.match(contract, /user-facing phrase `not computed` is allowed only for\s+`rehydration_failed`/);
  assert.match(contract, /Inspect the full-analysis manifest and measurement registry/);
  assert.match(contract, /Repair a missing or stale consumer projection/);
  assert.match(contract, /bounded selective recomputation/);
  assert.match(contract, /persist a recovery receipt/);
  assert.match(contract, /may not\s+fabricate data/);
});

test("Stage 5 requires one canonical measurement envelope across consumers", () => {
  assert.match(contract, /StatsKit, the originating evidence panel,\s+Master Schema, Data Maturation, Search, Traceback and report\/export/);
  assert.match(contract, /measurement id, run id, value, unit,\s+population\/denominator, input versions, method version, maturity, freshness and\s+revision/);
  assert.match(contract, /may not recalculate or relabel\s+the measurement locally/);
});

test("General Sprint Regime carries the recovery-first amendment", () => {
  assert.match(regime, /Stage 5 operating contract/);
  assert.match(regime, /`Not computed` is reserved for evidenced rehydration failure/);
  assert.match(regime, /One canonical measurement envelope must agree across all associated panels/);
});
