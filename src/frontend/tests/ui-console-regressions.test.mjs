import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const traceback = fs.readFileSync(
  new URL("../app/V2components/components/panels/TracebackDrawerPanel.tsx", import.meta.url),
  "utf8",
);
const apiService = fs.readFileSync(
  new URL("../lib/api-service.ts", import.meta.url),
  "utf8",
);

test("Traceback evidence rows have unique React identity when provenance IDs repeat", () => {
  assert.match(traceback, /levelNodes\.map\(\(node, nodeIndex\)/);
  assert.match(traceback, /key=\{`tree-\$\{level\}-\$\{node\.node_id\}-\$\{nodeIndex\}`\}/);
});

test("missing and foreign-project status summaries resolve to bounded unavailable state", () => {
  assert.match(apiService, /function unavailableStatusSummary/);
  assert.match(apiService, /response\.status === 404/);
  assert.match(apiService, /value\.project_id !== activeProject/);
  assert.doesNotMatch(
    apiService,
    /response\.status === 404[\s\S]{0,300}throw new Error\(`Local status summary unavailable/,
  );
});
