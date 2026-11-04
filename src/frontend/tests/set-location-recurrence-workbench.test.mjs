import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(
  new URL("../app/V2components/components/panels/SceneCardPanel.tsx", import.meta.url),
  "utf8",
);
const api = readFileSync(new URL("../lib/api-service.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../lib/video-service.ts", import.meta.url), "utf8");

test("Scene Cards exposes operational set and location recurrence", () => {
  assert.match(panel, /data-vaa1-set-location-recurrence="true"/);
  assert.match(panel, /Measure recurrence/);
  assert.match(panel, /Source Media proposals/);
  assert.match(panel, /Representative/);
  assert.match(panel, /Boundary/);
  assert.match(panel, /recurrence is measured evidence—not a geographic identity/);
  assert.match(panel, /openPanel\("SourceMediaMetadata"/);
  assert.match(panel, /navigateToTime\(Number\(representative\.timestamp/);
  assert.match(panel, /setLocationThumbnailUrl\(selectedVideoId, sample\.sample_id\)/);
  assert.match(panel, /Confirm set \/ location/);
  assert.match(panel, /set \/ location confirmation/);
  assert.match(panel, /Confirmed · mature/);
  assert.match(panel, /data-vaa1-scene-location-proposals="true"/);
  assert.match(panel, /Scene evidence proposals/);
  assert.match(panel, /category !== "scene" && !subcategory\.includes\("location"\)/);
  assert.match(panel, /measured total/);
});

test("set recurrence action persists through the backend measurement endpoint", () => {
  assert.match(api, /measureSetLocationRecurrence/);
  assert.match(api, /set-location-recurrence\/measure/);
  assert.match(api, /persist: true/);
  assert.match(api, /setLocationThumbnailUrl/);
  assert.match(panel, /apiService\.measureSetLocationRecurrence\(selectedVideoId\)/);
  assert.match(service, /set_location_recognition:[\s\S]*status\.summary[\s\S]*set_location_recognition/);
});
