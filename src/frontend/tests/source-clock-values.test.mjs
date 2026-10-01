import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/source-clock.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { formatPreciseSourceTime, parsePreciseSourceTime, sourceClockStatusForAuthority } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("precise display rounds once to milliseconds, including minute rollover", () => {
  assert.equal(formatPreciseSourceTime(1.001), "0:01.001");
  assert.equal(formatPreciseSourceTime(59.9996), "1:00.000");
  assert.equal(formatPreciseSourceTime(1200.25), "20:00.250");
  assert.equal(formatPreciseSourceTime(3723.25), "1:02:03.250");
  assert.equal(formatPreciseSourceTime(12500.456), "3:28:20.456");
});

test("precise source time round trips within half a millisecond", () => {
  for (const value of [0, .001, 1.001, 71, 999.9999, 1000.001, 3600.1234, 12500.456]) {
    assert.ok(Math.abs(parsePreciseSourceTime(formatPreciseSourceTime(value)) - value) <= .000500001);
  }
});

test("parser accepts seconds and unambiguous minute/hour forms", () => {
  for (const [text, expected] of [["71.000", 71], ["1:11.000", 71], ["1:02:03.250", 3723.25], ["120:00", 7200]]) {
    assert.equal(parsePreciseSourceTime(text), expected);
  }
});

test("malformed input cannot silently become a different correction", () => {
  for (const text of ["", "1:", ":1", "1::2", "1:2:3:4", "1:60", "1:60:00", "1.5:20", "-1", "Infinity", "0x10", "1e3"]) {
    assert.equal(parsePreciseSourceTime(text), null, text);
  }
});

test("canonical timing statuses retain their exact authority", () => {
  for (const status of ["explicit_user_correction", "anchor_verified", "vad_anchor_verified", "source_measured", "candidate", "inherited", "degraded", "unknown"]) {
    assert.equal(sourceClockStatusForAuthority(status), status);
  }
});

const { sourceSeconds, sourceTimeBoundary } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
test("explicit units preserve long seconds and short milliseconds", () => {
  assert.equal(sourceSeconds(12500), 12500);
  assert.equal(sourceSeconds(500, "milliseconds"), .5);
  assert.equal(sourceTimeBoundary({ start: 12500, start_ms: 500 }, "start"), 12500);
  assert.equal(sourceTimeBoundary({ start_seconds: 71, start: 99 }, "start"), 71);
  for (const value of [null, undefined, "", " ", true, NaN, Infinity, -1, {}]) assert.equal(sourceSeconds(value), null);
  assert.equal(sourceTimeBoundary({ start_seconds: "bad", start_ms: 500 }, "start"), null);
});
test("semantic acceptance cannot confer verified timing", () => {
  for (const value of ["analyst_confirmed", "manual", "user", "governed", "verified", "source"]) assert.equal(sourceClockStatusForAuthority(value), "unknown");
  assert.equal(sourceClockStatusForAuthority("source_estimated"), "degraded");
  assert.equal(sourceClockStatusForAuthority("confirmed_model_candidate"), "candidate");
});
for (const [file, names] of [
  ["SceneCardPanel", ["instructionStartSeconds", "instructionEndSeconds"]],
  ["MeaningPlotPanel", ["secondsFromInstruction", "endSecondsFromInstruction"]],
  ["MasterSchemaPanel", ["secondsFromInstruction"]],
  ["SecondOrderLabelAffirmations", ["instructionStart", "instructionEnd"]],
]) {
  test(`${file} converts units without guessing`, async () => {
    const panel = readFileSync(new URL(`../app/V2components/components/panels/${file}.tsx`, import.meta.url), "utf8");
    const ast = ts.createSourceFile("panel.tsx", panel, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
    assert.equal(functions.length, names.length);
    const code = ts.transpileModule(functions.map(node => `export ${node.getText(ast)}`).join("\n"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const module = await import(`data:text/javascript;base64,${Buffer.from(`${compiled}\n${code}`).toString("base64")}`);
    for (const name of names) {
      assert.equal(module[name]({ time_span: { start: 12500, end: 12500 } }), 12500);
      assert.equal(module[name]({ time_span: { start_ms: 500, end_ms: 500 } }), .5);
    }
    if (file === "SceneCardPanel" || file === "MeaningPlotPanel") assert.equal(module[names[1]]({ time_span: { start_ms: 500 } }), .5);
  });
}

test("governed scene normalization handles nested units and missing values", async () => {
  const scene = readFileSync(new URL("../lib/scene-governance.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("scene.ts", scene, ts.ScriptTarget.Latest, true);
  const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ["numberFrom", "normalizeSceneSegment"].includes(node.name?.text));
  const code = ts.transpileModule(nodes.map(node => `export ${node.getText(ast)}`).join("\n"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const { normalizeSceneSegment } = await import(`data:text/javascript;base64,${Buffer.from(`${compiled}\n${code}`).toString("base64")}`);
  for (const [segment, expected] of [
    [{ start: 12500, end: 12502 }, [12500, 12502]],
    [{ start_ms: 250, end_ms: 500 }, [.25, .5]],
    [{ interval: { start_seconds: 1200, end_seconds: 1300 } }, [1200, 1300]],
    [{ time_interval: { start_ms: 100, end_ms: 200 } }, [.1, .2]],
  ]) {
    const actual = normalizeSceneSegment(segment, 0, "fixture");
    assert.deepEqual([actual.start, actual.end], expected);
  }
  assert.equal(normalizeSceneSegment({}, 0, "fixture"), null);
});

test("navigation rejects invalid seeks, preserves zero, and honors seek suppression", async () => {
  const navigation = readFileSync(new URL("../lib/video-navigation.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("navigation.ts", navigation, ts.ScriptTarget.Latest, true);
  const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node));
  const code = ts.transpileModule(nodes.map(node => node.getText(ast)).join("\n"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const stubs = `export const events = [];
    const eventBus = { emit: (...args) => events.push(args), getLast: (name) => events.findLast(([event]) => event === name)?.[1] };
    const publishSourceTime = (id, time) => eventBus.emit("sourceClockTimeChanged", {analysis_id:id,timestamp_seconds:time});
    const resolveManualVisualEvidence = () => ({});
    const buildEvidenceNavigationState = () => ({ activeTime: 0 });`;
  const module = await import(`data:text/javascript;base64,${Buffer.from(`${compiled}\n${stubs}\n${code}`).toString("base64")}`);
  for (const time of [NaN, Infinity, -1]) module.openVideoAtTime("source-a", time);
  module.openVideoAtTime("", 71);
  assert.deepEqual(module.events, []);
  module.openVideoAtTime("source-a", 12500);
  assert.deepEqual(module.events.at(-1), ["sourceClockTimeChanged", {analysis_id:"source-a",timestamp_seconds:12500}]);
  module.events.length = 0;
  module.openManualAnnotationInVideo("source-a", { id: "a", start_seconds: 71 });
  assert.deepEqual(module.events.find(([name]) => name === "sourceClockTimeChanged"), ["sourceClockTimeChanged", {analysis_id:"source-a",timestamp_seconds:0}]);
  module.events.length = 0;
  module.openManualAnnotationInVideo("source-a", { id: "a", start_seconds: 71 }, { seekVideo: false });
  assert.ok(module.events.some(([name]) => name === "openPanelRequest"));
  assert.ok(!module.events.some(([name]) => name === "sourceClockTimeChanged"));
});

for (const [file, name, input] of [
  ["OCRPanel", "formatPanelTime", 59.9996], ["ExpressionPanel", "formatPanelTime", 59.9996],
  ["AudioPanel", "formatTime", 59.9996], ["MeaningPlotPanel", "formatTime", 59.9996],
  ["OBJDetectionPanel", "formatPreciseTime", 59.9996], ["SpeechToTextPanel", "formatSpeechSeconds", 59.9996],
  ["TracebackDrawerPanel", "secondsText", 59.9996], ["TimeBankPanel", "formatTimeMs", 59999.6],
]) {
  test(`${file} formats minute rollover through the shared clock`, async () => {
    const panel = readFileSync(new URL(`../app/V2components/components/panels/${file}.tsx`, import.meta.url), "utf8");
    const ast = ts.createSourceFile("panel.tsx", panel, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(node);
    const code = ts.transpileModule(`export ${node.getText(ast)}`, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const module = await import(`data:text/javascript;base64,${Buffer.from(`${compiled}\n${code}`).toString("base64")}`);
    assert.equal(module[name](input), "1:00.000");
  });
}

test('frame/sample adapters require declared precision and use VFR presentation timestamps', async () => {
  const m = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  assert.equal(m.sourceFrameSeconds(24,{fps:24,frame_rate_mode:'constant'}),1);
  assert.equal(m.sourceFrameSeconds(24,{fps:24}),null);
  assert.equal(m.sourceFrameSeconds(2,{fps:24,frame_rate_mode:'variable',presentation_timestamps_seconds:[0,.04,.11]}),.11);
  assert.equal(m.sourceFrameSeconds(3,{presentation_timestamps_seconds:[0,.04,.11]}),null);
  assert.equal(m.sourceFrameSeconds(1,{presentation_timestamps_seconds:[0,-1]}),null);
  assert.equal(m.sourceSampleSeconds(48000,{audio_sample_rate:48000}),1);
  for (const invalid of [-1,Infinity,NaN,1.5,null]) {
    assert.equal(m.sourceSampleSeconds(invalid,{audio_sample_rate:48000}),null);
    assert.equal(m.sourceFrameSeconds(invalid,{fps:24,frame_rate_mode:'constant'}),null);
  }
  assert.equal(m.sourceSampleSeconds(0,{audio_sample_rate:0}),null);
  assert.equal(m.sourcePrecision({fps:24}).frame_precision_seconds,null);
  assert.equal(m.sourcePrecision({fps:24,frame_rate_mode:'constant'}).frame_precision_seconds,1/24);
});
