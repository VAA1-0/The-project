import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const projectPanel = readFileSync(
  new URL("../app/V2components/components/panels/ProjectPanel.tsx", import.meta.url),
  "utf8",
);
const apiService = readFileSync(new URL("../lib/api-service.ts", import.meta.url), "utf8");
const statsKitPanel = readFileSync(
  new URL("../app/V2components/components/panels/StatsKitPanel.tsx", import.meta.url),
  "utf8",
);

test("Project panel exposes governed completeness navigation", () => {
  assert.match(projectPanel, /Full analysis verified/);
  assert.match(projectPanel, /analysis feature.*missing/);
  assert.match(projectPanel, /openPanel\("StatsKit"/);
  assert.match(statsKitPanel, /data-vaa1-analysis-completeness/);
  assert.match(statsKitPanel, /Refresh missing features/);
});

test("Project panel offers scoped repair instead of a page reload", () => {
  assert.match(projectPanel, /Refresh missing/);
  assert.match(projectPanel, /refreshAnalysisCompleteness\(id\)/);
  assert.match(apiService, /\/completeness\/refresh/);
  assert.doesNotMatch(projectPanel, /window\.location\.reload/);
});
