import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../app/V2components/components/DynamicPanelSection.tsx", import.meta.url),
  "utf8",
);

test("panel sections default to alphabetical order and require reasons for exceptions", () => {
  assert.match(source, /title\.localeCompare/);
  assert.match(source, /orderPriority/);
  assert.match(source, /without an orderReason/);
  assert.match(source, /alphabetical default/);
});

test("drag order is scoped and persisted per host panel", () => {
  assert.match(source, /vaa1\.panel-section-order\.\$\{panelId\}/);
  assert.match(source, /application\/x-datascene-panel-section/);
  assert.match(source, /data-vaa1-panel-section-drag-handle/);
  assert.match(source, /localStorage\.setItem/);
});

test("detached live content returns to its host when the window closes", () => {
  assert.match(source, /createPortal\(card, portalTarget\)/);
  assert.match(source, /beforeunload/);
  assert.match(source, /detachedWindow\.current\.closed/);
  assert.match(source, /setInterval/);
  assert.match(source, /setPortalTarget\(null\)/);
  assert.match(source, /Closing that window returns it here/);
});

test("sections expose fill-panel and detach controls", () => {
  assert.match(source, /Fill panel/);
  assert.match(source, /Detach to another screen/);
  assert.match(source, /aria-label=\{focused \? "Return" : "Fill"\}/);
  assert.match(source, /aria-label="Detach"/);
  assert.match(source, /role="tooltip"/);
  assert.match(source, /absolute inset-0/);
});
