import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const adapter = fs.readFileSync(new URL("../app/V2components/components/PanelSourceClockConcordance.tsx", import.meta.url), "utf8");
const wrapper = fs.readFileSync(new URL("../lib/golden-layout-lib/ReactComponentWrapper.tsx", import.meta.url), "utf8");
const host = fs.readFileSync(new URL("../app/V2components/components/LayoutHost.tsx", import.meta.url), "utf8");
const rail = fs.readFileSync(new URL("../app/V2components/components/SourceClockConcordanceRail.tsx", import.meta.url), "utf8");
const meaningPlot = fs.readFileSync(new URL("../app/V2components/components/panels/MeaningPlotPanel.tsx", import.meta.url), "utf8");
const sceneCards = fs.readFileSync(new URL("../app/V2components/components/panels/SceneCardPanel.tsx", import.meta.url), "utf8");

test("temporal panels share one revision-bound concordance adapter", () => {
  for (const panel of ["Transcript", "Audio", "OBJDetection", "OCR", "POS", "Quant", "MeaningPlot", "SceneCards", "Search", "MasterSchema", "DataMaturation", "StatsKit", "TracebackDrawer", "SourceMediaMetadata"]) {
    assert.match(adapter, new RegExp(`${panel}:`));
  }
  assert.match(adapter, /sourceClockConcordance\(rows, cursor/);
  assert.match(adapter, /publishSourceTime\(videoId, timestamp\)/);
  assert.match(adapter, /aggregate-only and are not promoted into clock hits/);
});

test("the primary on-beat lane renders every matching detection", () => {
  assert.match(rail, /concordance\.on_beat/);
  assert.match(rail, /data-source-clock-on-beat-list="true"/);
  assert.match(rail, /hits\.map/);
  assert.doesNotMatch(rail, /additional on-beat detection/);
});

test("Meaning Plot follows the cursor and exposes associated graph nodes", () => {
  assert.match(meaningPlot, /activeMeaningNetworkNodesAtCursor/);
  assert.match(meaningPlot, /meaningNetworkGraphScrollRef/);
  assert.match(meaningPlot, /data-vaa1-meaning-network-cursor-concordance="true"/);
  assert.match(meaningPlot, /data-vaa1-meaning-network-active-at-cursor/);
  assert.match(meaningPlot, /viewport\.scrollTo/);
});

test("Scene Cards follows the containing half-open source interval", () => {
  assert.match(sceneCards, /subscribeSourceTime\(selectedVideoId/);
  assert.match(sceneCards, /time >= start && \(time < end/);
  assert.match(sceneCards, /setSelectedSceneId\(sceneId\)/);
  assert.match(sceneCards, /scrollIntoView\(\{ block: "nearest" \}\)/);
});

test("Quant deduplicates repeated references and POS projects governed tokens to transcript time", () => {
  assert.match(adapter, /const rows = new Map<string, TimedItem & \{ referenceCount: number \}>/);
  assert.match(adapter, /analytical references/);
  assert.match(adapter, /function posRows/);
  assert.match(adapter, /POS occurrence linked to transcript interval/);
  assert.match(adapter, /data-pos-source-linkage-gap="true"/);
  assert.match(adapter, /This is a POS–Transcript linkage gap/);
});

test("panel identity comes from stable Golden Layout component types", () => {
  assert.match(wrapper, /container\.componentType/);
  assert.match(host, /PanelSourceClockConcordance componentName=\{componentName\}/);
});
