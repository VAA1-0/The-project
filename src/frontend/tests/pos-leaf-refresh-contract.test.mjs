import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../app/V2components/components/panels/POSAnalyzePanel.tsx", import.meta.url),
  "utf8",
);
const matrixSource = fs.readFileSync(
  new URL("../app/V2components/components/panels/POSMatrixPanel.tsx", import.meta.url),
  "utf8",
);

test("POS leaf exposes a visible, local refresh control", () => {
  assert.match(source, /eventBus\.getLast<string>\("videoIdChanged"\) \|\| ""/);
  assert.match(source, /data-vaa1-pos-refresh="true"/);
  assert.match(source, /onClick=\{\(\) => void refreshPOSFromCorrectedTranscript\(\)\}/);
  assert.match(source, /disabled=\{!videoId \|\| isRefreshingPOS\}/);
  assert.match(source, /Refresh POS/);
});

test("POS refresh rebuilds from timed transcript and reloads canonical analysis", () => {
  assert.match(source, /apiService\.refreshPOSAnalysis\(videoId/);
  assert.match(source, /start: segment\?\.start/);
  assert.match(source, /end: segment\?\.end/);
  assert.match(source, /VideoService\.refreshAnalysis\(videoId\)/);
  assert.match(source, /eventBus\.emit\("posAnalysisChanged", \{ analysisId: videoId \}\)/);
  assert.doesNotMatch(
    source,
    /setPosRefreshMessage\("POS refreshed from corrected transcript\."\);\s*eventBus\.emit\("analysisCorrectionsChanged"/,
  );
});

test("POS refresh feedback remains inside the leaf panel", () => {
  assert.match(source, /data-vaa1-pos-refresh-status="success"/);
  assert.match(source, /data-vaa1-pos-refresh-status="error"/);
  assert.doesNotMatch(source, /alert\(/);
});

test("comparative matrix cannot delete the cohort after a transient read failure", () => {
  assert.match(matrixSource, /A transient read failure must not mutate/);
  assert.doesNotMatch(
    matrixSource,
    /if \(validIds\.length !== matrixAnalysisIds\.length\)/,
  );
  assert.match(matrixSource, /Selected analyses temporarily unavailable/);
});

test("Add to Matrix does not publish events from inside a React state updater", () => {
  const action = source
    .split("const toggleMatrixSection =", 2)[1]
    .split("const currentAnalysisInMatrix", 1)[0];
  assert.doesNotMatch(action, /setMatrixSections\(\(current\) =>/);
  assert.match(action, /const isRemoving = matrixSections\.includes\(section\)/);
  assert.match(action, /setMatrixSections\(next\)/);
  assert.match(action, /eventBus\.emit\("posMatrixSectionsChanged", next\)/);
  assert.doesNotMatch(action, /videoIdChanged/);
});

test("POS Matrix contains malformed legacy values without blanking the panel", () => {
  assert.match(matrixSource, /function asStringList\(value: unknown\)/);
  assert.match(matrixSource, /class POSMatrixCellBoundary extends React\.Component/);
  assert.match(matrixSource, /data-vaa1-pos-matrix-cell-error="true"/);
  assert.match(matrixSource, /The analysis remains in the matrix/);
  assert.match(matrixSource, /<POSMatrixCellBoundary analysisId=\{row\.id\} section=\{section\}>/);
});
