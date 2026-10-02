import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/V2components/components/useUniversalPanelDisclosures.ts", import.meta.url), "utf8");
const host = fs.readFileSync(new URL("../app/V2components/components/LayoutHost.tsx", import.meta.url), "utf8");

test("all Golden Layout leaves install universal disclosure behavior", () => {
  assert.match(host, /useUniversalPanelDisclosures\(disclosureScopeRef, componentName\)/);
  assert.match(source, /data-vaa1-global-disclosure-controls/);
  assert.match(source, /Drag to reorder/);
  assert.match(source, /Fill panel/);
  assert.match(source, /Detach to another screen/);
});

test("global ordering preserves documented semantic exceptions", () => {
  for (const component of ["AudioPanel", "POSAnalyzePanel", "QuantitativeAnalysisPanel", "SourceMediaMetadataPanel", "VideoPanel"]) {
    assert.match(source, new RegExp(`"${component}"`));
  }
  assert.match(source, /localeCompare/);
  assert.match(source, /localStorage\.setItem/);
});

test("native dynamic sections are not double-enhanced", () => {
  assert.match(source, /closest\("\[data-vaa1-dynamic-panel-section\]"\)/);
});
