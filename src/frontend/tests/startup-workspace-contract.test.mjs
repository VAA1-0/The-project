import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("startup workspace keeps Video alone between left project and right analysis stacks", () => {
  const source = read("app/V2components/components/LayoutHost.tsx");
  assert.match(source, /type:\s*"stack",\s*\n\s*width:\s*16,[\s\S]*componentType:\s*"ProjectPanel"[\s\S]*componentType:\s*"DownloadPanel"/);
  assert.match(source, /type:\s*"component",\s*\n\s*width:\s*56,\s*\n\s*componentType:\s*"VideoPanel"/);
  assert.match(source, /id:\s*"rightStack",[\s\S]*componentType:\s*"ToolsPanel"[\s\S]*componentType:\s*"Transcript"[\s\S]*componentType:\s*"OBJDetection"/);
  assert.match(source, /storedVersion\s*===\s*SAVED_LAYOUT_VERSION/);
});

test("opening an analysis discards prior-session cursor and queues global zero", () => {
  const video = read("app/V2components/components/panels/VideoPanel.tsx");
  const browser = read("app/V2components/components/SourceClockBrowser.tsx");
  const clock = read("lib/source-clock-events.ts");
  assert.match(video, /if \(sourceChanged\) \{[\s\S]*pendingSourceTimeRef\.current = 0;[\s\S]*setVideoTimeLine\(0\);[\s\S]*setCurrentTime\(0\);/);
  assert.doesNotMatch(video, /getLast<SourceClockTimeEvent>\("sourceClockTimeChanged"\)/);
  assert.match(video, /startupClockPinnedRef\.current \? 0 : nextTime/);
  assert.match(video, /!startupClockPinnedRef\.current && Math\.abs\(nextTime - lastBroadcastTimeRef\.current\)/);
  assert.match(clock, /pending = id \? \{[\s\S]*analysis_id: id,[\s\S]*selection_epoch: epoch,[\s\S]*time: 0,/);
  assert.match(browser, /const selectionChanged = \(\) => \{[\s\S]*setCursor\(0\);[\s\S]*setDraft\(formatPreciseSourceTime\(0\)\)/);
});
