import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const report = fs.readFileSync(path.join(root, "app/V2components/components/panels/AnalysisReportPanel.tsx"), "utf8");
const layout = fs.readFileSync(path.join(root, "app/V2components/components/LayoutHost.tsx"), "utf8");
const menu = fs.readFileSync(path.join(root, "app/V2components/components/MenuBar.tsx"), "utf8");

test("Analysis Report is a first-class panel available from Window navigation", () => {
  assert.match(layout, /registerComponentFactoryFunction\(\s*"AnalysisReport"/);
  assert.match(menu, /label: "Analysis Report"[\s\S]*openPanel\("AnalysisReport"/);
  assert.match(report, /data-vaa1-analysis-report="true"/);
});

test("report supports fast scan and slow evidence review across all requested views", () => {
  assert.match(report, /Fast scan/);
  assert.match(report, /Evidence review/);
  for (const label of ["Summary", "Scenes", "Narrative structure", "Narrative agents", "Statistics", "Quant + POS", "Selected lenses", "Analysis maturity", "Comparison matrix"]) {
    assert.equal(report.includes(label), true, `${label} report view must be present`);
  }
});

test("report comparison matrix follows Quant/POS-style explicit project selection", () => {
  assert.match(report, /data-vaa1-analysis-report-comparison="true"/);
  assert.match(report, /REPORT_MATRIX_STORAGE_KEY/);
  assert.match(report, /type="checkbox"/);
  assert.match(report, /Confirmed[\s\S]*Candidate[\s\S]*Withheld[\s\S]*Artifacts/);
  assert.match(report, /VideoService\.list\(200\)/);
});

test("report returns readers to governed consumer panels and preserves missingness", () => {
  for (const panel of ["MasterSchema", "SceneCards", "MeaningPlot", "ManualIdentification", "StatsKit", "DataMaturation"]) {
    assert.match(report, new RegExp(`open\\(\\"${panel}\\"\\)`));
  }
  assert.match(report, /\[\["POS", artifacts\.pos, "POS"\], \["Quant", artifacts\.quant, "Quant"\]\]/);
  assert.match(report, /rather than generating prose/);
  assert.match(report, /does not silently merge them into canonical fact/);
});
