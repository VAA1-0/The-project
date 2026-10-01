import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../app/V2components/components/panels/SpeechToTextPanel.tsx", import.meta.url),
  "utf8",
);

test("Transcript exposes the revision-bound source cursor and interval relationship", () => {
  assert.match(source, /subscribeSourceTime\(videoId, timeHandler\)/);
  assert.match(source, /data-testid="transcript-source-clock-cursor"/);
  assert.match(source, /Source cursor \{formatSpeechSeconds\(videoTimeLine\)\}/);
  assert.match(source, /inside transcript interval/);
  assert.match(source, /nearest transcript interval/);
  assert.match(source, /no authoritative transcript interval available/);
});

test("Transcript highlights the authoritative interval nearest the source cursor", () => {
  assert.match(source, /function nearestTranscriptCursorMatch/);
  assert.match(source, /rowHasTimingAuthority\(row\)/);
  assert.match(source, /data-source-clock-nearest=\{cursorMatch \? "true" : undefined\}/);
  assert.match(source, /Cursor \{cursorMatch\.relation\} this interval/);
});

test("Transcript follows the matched interval without inventing a speaker split", () => {
  assert.match(source, /transcriptRowRefs\.current[\s\S]*scrollIntoView\(\{ block: "nearest", behavior: "smooth" \}\)/);
  assert.match(source, /linkedSpeakerTurn\.turn\.diarization_confidence < 0\.65/);
  assert.match(source, /data-speaker-boundary-review="true"/);
  assert.match(source, /may contain a speaker change/);
});
