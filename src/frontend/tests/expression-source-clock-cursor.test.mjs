import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../app/V2components/components/panels/ExpressionPanel.tsx", import.meta.url),
  "utf8",
);
const concordanceRail = fs.readFileSync(
  new URL("../app/V2components/components/SourceClockConcordanceRail.tsx", import.meta.url),
  "utf8",
);

test("Expressions delegates beat context to the shared concordance rail", () => {
  assert.match(source, /subscribeSourceTime\(videoId,/);
  assert.match(source, /publishSourceTime\(videoId, timestamp\)/);
  assert.match(source, /SourceClockConcordanceRail[\s\S]*modality="Expressions"/);
  assert.match(source, /data-testid="expression-source-clock-cursor"/);
  assert.match(concordanceRail, /data-source-clock-concordance-primary=/);
  assert.match(concordanceRail, />\s*Concordance\s*</);
  assert.match(concordanceRail, /Previous \$\{modality\} evidence/);
  assert.match(concordanceRail, /Next \$\{modality\} evidence/);
  assert.match(concordanceRail, /onNavigate\?\.\(nextHit\.start_seconds\)/);
});

test("Expressions distinguishes on-beat, before and after samples", () => {
  assert.match(source, /sourceClockConcordance/);
  assert.match(source, /data-source-clock-relation=/);
  assert.match(source, /clockRelation === "on-beat"/);
  assert.match(source, /clockRelation === "before"/);
  assert.match(source, /clockRelation === "after"/);
  assert.match(source, /formatPanelTime\(sample\.timestamp\)/);
  assert.doesNotMatch(source, /Number\(sample\.timestamp\)\.toFixed\(2\)/);
});
