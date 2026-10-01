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

test("transcript clock converts explicitly named millisecond fields to seconds", () => {
  assert.equal(normalizeTranscriptTimeSeconds(12500), 12500);
  assert.equal(normalizeTranscriptSegmentTiming({ start_ms: 12500, end_ms: 14800 }).start, 12.5);
  assert.equal(normalizeTranscriptSegmentTiming({ start_ms: 12500, end_ms: 14800 }).end, 14.8);
});

test("long-source seconds and clock strings never trigger unit guessing", () => {
  for (const value of [1000, 1001, 12500]) {
    assert.equal(normalizeTranscriptTimeSeconds(value), value);
    assert.equal(normalizeTranscriptSegmentTiming({ start_seconds: value, end_seconds: value + 2 }).start, value);
    assert.equal(normalizeTranscriptSegmentTiming({ start: value, end: value + 2 }).end, value + 2);
  }
  assert.equal(normalizeTranscriptTimeSeconds("00:20:00.250"), 1200.25);
  assert.equal(normalizeTranscriptTimeSeconds("1200.25s"), 1200.25);
});

test("explicit long-source seconds outrank conflicting milliseconds", () => {
  assert.deepEqual(normalizeTranscriptSegmentTiming({ start_seconds: 1200, end_seconds: 1202, start_ms: 5000, end_ms: 6000 }), {
    t: "1200.0s", start: 1200, end: 1202,
  });
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

test("zero clock offset does not let provenance timestamps overwrite repaired global clock", () => {
  const repaired = applyTranscriptClockOffset(
    {
      t: "6.4s",
      start: 6.4,
      end: 8.4,
      sourceStart: 0,
      sourceEnd: 2,
      timingAuthority: "original_whisper_timecode",
    },
    0,
  );

  assert.equal(repaired.start, 6.4);
  assert.equal(repaired.end, 8.4);
  assert.equal(repaired.sourceStart, 0);
  assert.equal(repaired.sourceEnd, 2);
});
