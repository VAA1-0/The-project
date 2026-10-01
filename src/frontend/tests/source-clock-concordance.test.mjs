import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../lib/source-clock.ts", import.meta.url),
  "utf8",
);

test("concordance preserves separate before, on-beat and after evidence", () => {
  assert.match(source, /export function sourceClockConcordance/);
  assert.match(source, /before: SourceClockConcordanceHit<T> \| null/);
  assert.match(source, /on_beat: SourceClockConcordanceHit<T>\[\]/);
  assert.match(source, /after: SourceClockConcordanceHit<T> \| null/);
  assert.match(source, /cursor \+ tolerance >= hit\.start_seconds/);
  assert.match(source, /cursor - tolerance <= hit\.end_seconds/);
});
