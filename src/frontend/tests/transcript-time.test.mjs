import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTranscriptClockOffset,
  normalizeTranscriptSegmentTiming,
  normalizeTranscriptTimeSeconds,
} from "../lib/transcript-time.js";

test("transcript clock keeps second-based times as seconds", () => {
  assert.equal(normalizeTranscriptTimeSeconds(12.5), 12.5);
  assert.equal(normalizeTranscriptTimeSeconds("12.5s"), 12.5);
});

test("transcript clock converts millisecond-shaped values to seconds", () => {
  assert.equal(normalizeTranscriptTimeSeconds(12500), 12.5);
  assert.equal(normalizeTranscriptSegmentTiming({ start_ms: 12500, end_ms: 14800 }).start, 12.5);
  assert.equal(normalizeTranscriptSegmentTiming({ start_ms: 12500, end_ms: 14800 }).end, 14.8);
});

test("transcript clock prefers explicit seconds over millisecond fallback", () => {
  const timing = normalizeTranscriptSegmentTiming({
    start_seconds: 8.25,
    start_ms: 825000,
    end_seconds: 9.75,
    end_ms: 975000,
  });

  assert.equal(timing.start, 8.25);
  assert.equal(timing.end, 9.75);
  assert.equal(timing.t, "8.3s");
});

test("transcript clock accepts timestamp and clock-string fields", () => {
  assert.deepEqual(
    normalizeTranscriptSegmentTiming({ timestamp: "00:01:02.500", end_timestamp: "00:01:04" }),
    { t: "62.5s", start: 62.5, end: 64 },
  );
});

test("transcript clock normalizes reversed segment bounds", () => {
  assert.deepEqual(
    normalizeTranscriptSegmentTiming({ start: 20, end: 18 }),
    { t: "18.0s", start: 18, end: 20 },
  );
});

test("transcript clock offset maps speech-relative rows onto source-video time", () => {
  const segment = normalizeTranscriptSegmentTiming({
    start: 0,
    end: 2,
  });

  assert.deepEqual(applyTranscriptClockOffset(segment, 6.4), {
    t: "6.4s",
    start: 6.4,
    end: 8.4,
    sourceStart: 0,
    sourceEnd: 2,
  });
});

test("transcript clock offset preserves raw source timestamps after repeated application", () => {
  const shifted = applyTranscriptClockOffset(
    { t: "6.4s", start: 6.4, end: 8.4, sourceStart: 0, sourceEnd: 2 },
    6.4,
  );

  assert.equal(shifted.start, 6.4);
  assert.equal(shifted.end, 8.4);
  assert.equal(shifted.sourceStart, 0);
  assert.equal(shifted.sourceEnd, 2);
});
