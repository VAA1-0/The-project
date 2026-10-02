import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stats = fs.readFileSync(
  new URL("../app/V2components/components/panels/StatsKitPanel.tsx", import.meta.url),
  "utf8",
);

test("StatsKit principal workbenches use the movable section host", () => {
  assert.match(stats, /DynamicPanelSectionGroup panelId="statskit"/);
  for (const id of [
    "analysis-completeness",
    "analysis-setup",
    "comparison-studio",
    "language-analysis",
    "relevance-scanner",
    "research-question",
    "significance-workbench",
    "stats-metadata",
    "stats-workbench",
    "statistical-overview",
    "visualization",
  ]) {
    assert.match(stats, new RegExp(`sectionId="${id}"`));
  }
});

test("closed StatsKit section headers communicate current feature status", () => {
  assert.match(stats, /visibleStatsRows\.length.*selected/);
  assert.match(stats, /plottedData\.length.*numeric row/);
  assert.match(stats, /scannerRows\.length.*dimensions/);
  assert.match(stats, /masterAuditRows\.length.*categories/);
  assert.match(stats, /filteredSignificanceRows\.length.*selected/);
});

test("StatsKit does not override the alphabetical section default", () => {
  const dynamicSectionBlock = stats.slice(stats.indexOf('<DynamicPanelSectionGroup panelId="statskit"'));
  assert.doesNotMatch(dynamicSectionBlock, /orderPriority=/);
  assert.doesNotMatch(dynamicSectionBlock, /orderReason=/);
});
