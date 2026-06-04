import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const bboxAuthority = readFileSync(resolve(root, "lib/bbox-authority.ts"), "utf8");
const videoPanel = readFileSync(
  resolve(root, "app/V2components/components/panels/VideoPanel.tsx"),
  "utf8",
);

const KEYFRAME_SNAP_TOLERANCE_SECONDS = Number(
  bboxAuthority.match(
    /MANUAL_GEOMETRY_KEYFRAME_REPLACE_TOLERANCE_SECONDS\s*=\s*([0-9.]+)/,
  )?.[1],
);
const MAX_INTERPOLATION_GAP_SECONDS = Number(
  bboxAuthority.match(/MANUAL_GEOMETRY_INTERPOLATION_MAX_GAP_SECONDS\s*=\s*([0-9.]+)/)
    ?.[1],
);

function normalizeBox(box) {
  const x = clamp(box.x, 0, 1);
  const y = clamp(box.y, 0, 1);
  return {
    x,
    y,
    w: clamp(box.w, 0.002, Math.max(0.002, 1 - x)),
    h: clamp(box.h, 0.002, Math.max(0.002, 1 - y)),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function interpolateBoxes(left, right, t) {
  const safeT = clamp(t, 0, 1);
  return normalizeBox({
    x: left.x + (right.x - left.x) * safeT,
    y: left.y + (right.y - left.y) * safeT,
    w: left.w + (right.w - left.w) * safeT,
    h: left.h + (right.h - left.h) * safeT,
  });
}

function resolveManualBoxAtTime(keyframes, timestamp) {
  const merged = keyframes
    .filter(
      (keyframe) =>
        keyframe?.source !== "track" &&
        Number.isFinite(keyframe.time) &&
        keyframe.coordinates,
    )
    .sort((left, right) => left.time - right.time);

  const exactManualKeyframe = merged.find(
    (keyframe) =>
      Math.abs(keyframe.time - timestamp) <= KEYFRAME_SNAP_TOLERANCE_SECONDS,
  );
  if (exactManualKeyframe) {
    return normalizeBox(exactManualKeyframe.coordinates);
  }

  const before = [...merged].reverse().find((keyframe) => keyframe.time <= timestamp);
  const after = merged.find((keyframe) => keyframe.time >= timestamp);
  if (before && after && before !== after) {
    const span = Math.max(0.001, after.time - before.time);
    if (span <= MAX_INTERPOLATION_GAP_SECONDS) {
      return interpolateBoxes(
        normalizeBox(before.coordinates),
        normalizeBox(after.coordinates),
        (timestamp - before.time) / span,
      );
    }
  }
  return normalizeBox((before || after || merged[0]).coordinates);
}

function projectBox(box, contentRect) {
  const normalized = normalizeBox(box);
  return {
    left: normalized.x * contentRect.width,
    top: normalized.y * contentRect.height,
    width: normalized.w * contentRect.width,
    height: normalized.h * contentRect.height,
  };
}

function assertBoxClose(actual, expected, message) {
  for (const key of ["left", "top", "width", "height"]) {
    assert.ok(
      Math.abs(actual[key] - expected[key]) <= 0.001,
      `${message}: ${key} expected ${expected[key]}, got ${actual[key]}`,
    );
  }
}

test("police-car BBox rendered fixture follows exact manual keyframes across scrub", () => {
  assert.ok(
    Number.isFinite(KEYFRAME_SNAP_TOLERANCE_SECONDS) &&
      KEYFRAME_SNAP_TOLERANCE_SECONDS > 0,
    "fixture must read the shared manual keyframe snap tolerance",
  );
  assert.ok(
    Number.isFinite(MAX_INTERPOLATION_GAP_SECONDS) && MAX_INTERPOLATION_GAP_SECONDS > 0,
    "fixture must read the shared bounded interpolation gap",
  );
  assert.match(
    bboxAuthority,
    /const exactManualKeyframe = merged\.find[\s\S]*return normalizeDraftBox\(exactManualKeyframe\.coordinates\);/,
    "shared resolver must snap to manual keyframes before rendered projection",
  );
  assert.match(
    videoPanel,
    /const trackManualCandidates =[\s\S]*manualObjectCorrectionTargetId\(item\) === targetCandidateId[\s\S]*const nearbyTrackManual = trackManualCandidates/,
    "VideoPanel must merge nearby corrections only for the same object target",
  );

  const renderedVideoRect = { x: 0, y: 0, width: 960, height: 540 };
  const rawDetectorTrack = new Map([
    [0, { x: 0.09, y: 0.56, w: 0.36, h: 0.22 }],
    [0.24, { x: 0.12, y: 0.55, w: 0.34, h: 0.2 }],
    [0.48, { x: 0.16, y: 0.53, w: 0.31, h: 0.18 }],
  ]);
  const manualKeyframes = [
    {
      time: 0,
      source: "manual",
      coordinates: { x: 0.105, y: 0.585, w: 0.315, h: 0.155 },
    },
    {
      time: 0.24,
      source: "manual",
      coordinates: { x: 0.14, y: 0.575, w: 0.29, h: 0.145 },
    },
    {
      time: 0.48,
      source: "manual",
      coordinates: { x: 0.18, y: 0.565, w: 0.255, h: 0.13 },
    },
  ];

  for (const keyframe of manualKeyframes) {
    const rendered = projectBox(
      resolveManualBoxAtTime(manualKeyframes, keyframe.time),
      renderedVideoRect,
    );
    const expected = projectBox(keyframe.coordinates, renderedVideoRect);
    const rawRendered = projectBox(rawDetectorTrack.get(keyframe.time), renderedVideoRect);
    assertBoxClose(
      rendered,
      expected,
      `corrected frame ${keyframe.time} must render exact analyst geometry`,
    );
    assert.notDeepStrictEqual(
      rendered,
      rawRendered,
      `corrected frame ${keyframe.time} must not fall back to raw detector geometry`,
    );
  }

  const betweenTime = 0.36;
  const expectedBetween = projectBox(
    interpolateBoxes(manualKeyframes[1].coordinates, manualKeyframes[2].coordinates, 0.5),
    renderedVideoRect,
  );
  assertBoxClose(
    projectBox(resolveManualBoxAtTime(manualKeyframes, betweenTime), renderedVideoRect),
    expectedBetween,
    "between corrected frames must scale from analyst keyframes",
  );

  for (const scrubTime of [0.48, 0, 0.24, 0.36, 0]) {
    const rendered = projectBox(resolveManualBoxAtTime(manualKeyframes, scrubTime), renderedVideoRect);
    assert.ok(
      rendered.width > 0 && rendered.height > 0,
      `scrub ${scrubTime} must keep a visible manual BBox overlay`,
    );
  }
});

test("police-car BBox rendered fixture scales proportionally after panel resize", () => {
  const manualKeyframes = [
    {
      time: 0.12,
      source: "manual",
      coordinates: { x: 0.14, y: 0.575, w: 0.29, h: 0.145 },
    },
  ];
  const desktopRect = { x: 0, y: 0, width: 960, height: 540 };
  const resizedRect = { x: 0, y: 0, width: 1440, height: 810 };

  const desktop = projectBox(resolveManualBoxAtTime(manualKeyframes, 0.12), desktopRect);
  const resized = projectBox(resolveManualBoxAtTime(manualKeyframes, 0.12), resizedRect);

  assertBoxClose(
    resized,
    {
      left: desktop.left * 1.5,
      top: desktop.top * 1.5,
      width: desktop.width * 1.5,
      height: desktop.height * 1.5,
    },
    "rendered BBox pixels must scale from stable normalized analyst geometry",
  );
});
