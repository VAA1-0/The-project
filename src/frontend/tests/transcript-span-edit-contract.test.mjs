import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Transcript Edit span separates source targeting from corrected timing", () => {
  const panel = read("app/V2components/components/panels/SpeechToTextPanel.tsx");
  const corrections = read("lib/annotation-corrections.ts");
  const service = read("lib/video-service.ts");

  assert.match(panel, /targetStart:\s*Number\(row\?\.sourceStart/);
  assert.match(panel, /targetStartTimestamp:\s*editorDraft\.targetStart/);
  assert.match(panel, /correctedStartTimestamp:\s*start/);
  assert.match(panel, /correctedEndTimestamp:\s*end/);
  assert.match(corrections, /corrected_start_timestamp:\s*options\?\.correctedStartTimestamp/);
  assert.match(service, /spanRule\?\.corrected_start_timestamp/);
  assert.match(service, /timingAuthority:\s*spanRule\s*\?\s*"manual_correction"/);
});
