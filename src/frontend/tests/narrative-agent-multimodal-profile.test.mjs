import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(
  new URL("../app/V2components/components/panels/DataMaturationPanel.tsx", import.meta.url),
  "utf8",
);

test("Narrative Agent profiles surface governed visual, audio, speaker-turn, and movement evidence", () => {
  assert.match(panel, /data-vaa1-digital-twin-evidence-counts="true"/);
  assert.match(panel, /twin\.evidence\?\.speaker_turn\?\.length/);
  assert.match(panel, /twin\.evidence\?\.body_movement\?\.length/);
  assert.match(panel, /Open Audio \/ speaker turns/);
  assert.match(panel, /Open body movement/);
});
