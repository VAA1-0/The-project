import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const code = compile(readFileSync(new URL("../lib/correction-clock-guard.ts", import.meta.url), "utf8"));
const { correctionClockGuard, validateCorrectionClockGuard, validateCorrectionSourceBinding } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("stale clock editors cannot change or re-save annotations under a new timebase", () => {
  const guard = correctionClockGuard("a", { transcript_clock_offset_seconds: 0 });
  validateCorrectionClockGuard("a", {}, { transcript_clock_offset_seconds: 2, _clock_write_guard: guard });
  for (const incoming of [{ _clock_write_guard: guard }, { transcript_clock_offset_seconds: 0, _clock_write_guard: guard }]) {
    assert.throws(() => validateCorrectionClockGuard("a", { transcript_clock_offset_seconds: 2 }, incoming), /changed/);
  }
  assert.throws(() => validateCorrectionClockGuard("b", {}, { _clock_write_guard: guard }), /another analysis/);
  assert.throws(() => validateCorrectionClockGuard("a", {}, { transcript_clock_offset_seconds: 2 }), /Reload/);
});

test("unchanged legacy clocks remain writable and malformed offsets fail", () => {
  validateCorrectionClockGuard("a", {}, { manual_visual_annotations: [] });
  validateCorrectionClockGuard("a", { transcript_clock_offset_seconds: 2 }, { transcript_clock_offset_seconds: 2 });
  for (const value of [true, [], {}, "", " ", NaN, Infinity]) {
    assert.throws(() => validateCorrectionClockGuard("a", {}, { transcript_clock_offset_seconds: value }));
  }
});

test("actual dashboard POST rejects a stale clock without touching either artifact", async () => {
  const route = readFileSync(new URL("../app/api/local-analysis/[analysisId]/download/[fileType]/route.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("route.ts", route, ts.ScriptTarget.Latest, true);
  const post = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "POST");
  const fixture = `class CorrectionBindingUnavailable extends Error {}
    class CorrectionWriteBusy extends Error {}
    const NextResponse = { json: (body, init = {}) => ({ body, status: init.status || 200 }) };
    const assertLocalAnalysisBoundary = async () => {};
    const projectBoundaryErrorResponse = () => null;
    const withCorrectionWriteLock = async (_id, work) => work();
    const projectRoot = () => '/unused';
    const path = { join: (...parts) => parts.join('/'), dirname: () => '/unused' };
    const process = { pid: 1 };
    const readRichestAnnotationCorrections = async () => ({ transcript_clock_offset_seconds: 2 });
    const fs = new Proxy({}, { get: () => () => { throw new Error('Unexpected artifact write'); } });`;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(`${code}\n${fixture}\n${compile(post.getText(ast))}`).toString("base64")}`);
  const result = await mod.POST({ json: async () => ({ _clock_write_guard: correctionClockGuard("a", {}) }) }, { params: Promise.resolve({ analysisId: "a", fileType: "annotation_corrections" }) });
  assert.equal(result.status, 409);
  assert.match(result.body.detail, /clock changed/);
});

test("queued dashboard saves check generation inside the write queue and strip transient guards", async () => {
  const route = readFileSync(new URL("../app/api/local-analysis/[analysisId]/download/[fileType]/route.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("route.ts", route, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ["POST", "withCorrectionWriteLock"].includes(node.name?.text));
  const mergeCode = compile(readFileSync(new URL("../lib/annotation-correction-merge.ts", import.meta.url), "utf8"));
  const fixture = `class CorrectionBindingUnavailable extends Error {}
    class CorrectionWriteBusy extends Error {}
    const NextResponse = { json: (body, init = {}) => ({ body, status: init.status || 200 }) };
    const assertLocalAnalysisBoundary = async () => {};
    const projectBoundaryErrorResponse = () => null;
    const correctionWriteQueues = new Map();
    const withSharedCorrectionLock = async (_root, _id, work) => work();
    const projectRoot = () => '/unused';
    const path = { join: (...parts) => parts.join('/'), dirname: () => '/unused' };
    const process = { pid: 1 };
    export let saved = { transcript_clock_offset_seconds: 0, manual_visual_annotations: [{ id: 'preserved' }] };
    let pending;
    export let writes = 0;
    let failAfterCommit = false, committedFailure = false;
    export const failVerification = () => { failAfterCommit = true; };
    const readRichestAnnotationCorrections = async () => structuredClone(saved);
    const readCorrectionSourceBinding = async () => { if (committedFailure) throw new CorrectionBindingUnavailable('offline after commit'); return { analysis_id: 'a', binding_status: 'content_bound', source_fingerprint: 'sha256:fixture', clock_revision: 'revision:' + saved.transcript_clock_offset_seconds, timebase: { transcript_clock_offset_seconds: saved.transcript_clock_offset_seconds } }; };
    const fs = { mkdir: async () => {}, writeFile: async (_path, bytes) => { pending = JSON.parse(bytes); }, rename: async () => { saved = pending; writes++; committedFailure = failAfterCommit; } };
    const updateMasterSchemaCorrectionReviewLayer = async () => {};`;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(`${code}\n${mergeCode}\n${fixture}\n${compile(functions.map(n => n.getText(ast)).join("\n"))}`).toString("base64")}`);
  const guard = correctionClockGuard("a", {});
  const params = { params: Promise.resolve({ analysisId: "a", fileType: "annotation_corrections" }) };
  const responses = await Promise.all([
    mod.POST({ json: async () => ({ _clock_write_guard: guard, transcript_clock_offset_seconds: 0 }) }, params),
    mod.POST({ json: async () => ({ _clock_write_guard: guard, manual_visual_annotations: [{ id: 'stale' }] }) }, params),
  ]);
  assert.deepEqual(responses.map(r => r.status), [200, 409], JSON.stringify(responses));
  assert.equal(mod.writes, 1);
  assert.equal(mod.saved.transcript_clock_offset_seconds, 0);
  assert.equal(mod.saved._clock_write_guard, undefined);
  assert.deepEqual(mod.saved.manual_visual_annotations, [{ id: 'preserved' }]);
  assert.equal(responses[0].body.annotation_corrections._clock_write_guard.transcript_clock_offset_seconds, 0);
  mod.failVerification();
  const uncertain = await mod.POST({ json: async () => responses[0].body.annotation_corrections }, params);
  assert.equal(uncertain.status, 503);
  assert.equal(uncertain.body.canonical_committed, true);
  assert.match(uncertain.body.detail, /were written/);
  assert.equal(mod.writes, 2);
});

test("canonical offset outranks a newer cached bundle and corrupt sidecars do not fall back", async () => {
  const route = readFileSync(new URL("../app/api/local-analysis/[analysisId]/download/[fileType]/route.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("route.ts", route, ts.ScriptTarget.Latest, true);
  const reader = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "readRichestAnnotationCorrections");
  const mergeCode = compile(readFileSync(new URL("../lib/annotation-correction-merge.ts", import.meta.url), "utf8"));
  const fixture = `const projectRoot = () => '/fixture';
    const path = { join: (...parts) => parts.join('/'), isAbsolute: () => true };
    const readRecord = async () => ({ annotation_corrections: { updated_at: '2026-09-24', correction_generation: 'stale', transcript_clock_offset_seconds: 99 } });
    const correctionDocumentTime = value => Date.parse(value?.updated_at) || 0;
    const correctionMaturity = () => 0;
    let bytes = JSON.stringify({ updated_at: '2026-09-20', correction_generation: 'canonical', transcript_clock_offset_seconds: 2 });
    export const replaceBytes = value => { bytes = value; };
    const fs = { readFile: async () => bytes };`;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(`${mergeCode}\n${fixture}\n${compile('export '+reader.getText(ast))}`).toString("base64")}`);
  assert.equal((await mod.readRichestAnnotationCorrections("a")).transcript_clock_offset_seconds, 2);
  assert.equal((await mod.readRichestAnnotationCorrections("a")).correction_generation, "canonical");
  for (const bytes of ["broken", "null", "[]"]) {
    mod.replaceBytes(bytes);
    await assert.rejects(mod.readRichestAnnotationCorrections("a"), /saved file has not been replaced/);
  }
});

test("bound snapshots reject changed revisions, unavailable media and inconsistent offsets", () => {
  const context = { analysis_id: "a", binding_status: "content_bound", source_fingerprint: "sha256:one", clock_revision: "clock-v1:one", timebase: { transcript_clock_offset_seconds: 0 } };
  const guard = correctionClockGuard("a", {}, context);
  validateCorrectionSourceBinding("a", { _clock_write_guard: guard }, context);
  for (const changed of [
    { ...context, source_fingerprint: "sha256:two" },
    { ...context, clock_revision: "clock-v1:two" },
    { ...context, analysis_id: "b" },
    { ...context, binding_status: "source_unavailable", source_fingerprint: null, clock_revision: null },
  ]) assert.throws(() => validateCorrectionSourceBinding("a", { _clock_write_guard: guard }, changed), /reload/);
  for (const partial of [{ ...guard, clock_revision: undefined }, { ...guard, source_fingerprint: null }]) {
    assert.throws(() => validateCorrectionSourceBinding("a", { _clock_write_guard: partial }, context));
  }
  assert.throws(() => correctionClockGuard("b", {}, context), /another analysis/);
  assert.throws(() => correctionClockGuard("a", { transcript_clock_offset_seconds: 2 }, context), /disagree/);
  validateCorrectionSourceBinding("a", { _clock_write_guard: correctionClockGuard("a", {}) }, context);
});

test("actual dashboard locks snapshot reads and rejects replaced source before writes", async () => {
  const route = readFileSync(new URL("../app/api/local-analysis/[analysisId]/download/[fileType]/route.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("route.ts", route, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ["GET", "POST"].includes(node.name?.text));
  const fixture = `class CorrectionWriteBusy extends Error {}
    class CorrectionBindingUnavailable extends Error {}
    const NextResponse = { json: (body, init = {}) => ({ body, status: init.status || 200 }) };
    const assertLocalAnalysisBoundary = async () => {};
    const projectBoundaryErrorResponse = () => null;
    let locked = false;
    const withCorrectionWriteLock = async (_id, work) => { locked = true; try { return await work(); } finally { locked = false; } };
    const projectRoot = () => '/unused';
    const path = { join: (...parts) => parts.join('/'), dirname: () => '/unused' };
    const process = { pid: 1 };
    const readRichestAnnotationCorrections = async () => { if (!locked) throw new Error('Unlocked correction read'); return { transcript_clock_offset_seconds: 2 }; };
    export let context = { analysis_id: 'a', binding_status: 'content_bound', source_fingerprint: 'sha256:one', clock_revision: 'clock-v1:one', timebase: { transcript_clock_offset_seconds: 2 } };
    export const replaceContext = value => { context = value; };
    const readCorrectionSourceBinding = async () => { if (!locked) throw new Error('Unlocked binding read'); if (!context) throw new CorrectionBindingUnavailable('offline'); return context; };
    const fs = new Proxy({}, { get: () => () => { throw new Error('Unexpected artifact write'); } });`;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(`${code}\n${fixture}\n${compile(functions.map(n => n.getText(ast)).join("\n"))}`).toString("base64")}`);
  const params = { params: Promise.resolve({ analysisId: "a", fileType: "annotation_corrections" }) };
  const loaded = await mod.GET({}, params);
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body._clock_write_guard.clock_revision, 'clock-v1:one');
  mod.replaceContext({ ...mod.context, source_fingerprint: 'sha256:replacement' });
  const rejected = await mod.POST({ json: async () => loaded.body }, params);
  assert.equal(rejected.status, 409);
  mod.replaceContext(null);
  const readOnly = await mod.GET({}, params);
  assert.equal(readOnly.status, 200);
  assert.equal(readOnly.body._hydration_state.evidence, 'available');
  assert.equal(readOnly.body._hydration_state.editing, 'read_only');
  assert.equal(readOnly.body._clock_write_guard.binding_status, 'source_unavailable');
  assert.equal(readOnly.body._clock_write_guard.source_fingerprint, null);
  assert.equal(readOnly.body.transcript_clock_offset_seconds, 2);
  assert.equal(readOnly.body._clock_write_guard.transcript_clock_offset_seconds, 2);
  assert.equal((await mod.POST({ json: async () => readOnly.body }, params)).status, 503);
});

test('correction generation rejects stale same-clock saves and downgrade attempts', () => {
  const current = { correction_generation: 'generation-2' };
  for (const incoming of [{}, { _clock_write_guard: correctionClockGuard('a', {}) },
      { _clock_write_guard: correctionClockGuard('a', { correction_generation: 'generation-1' }) }]) {
    assert.throws(() => validateCorrectionClockGuard('a', current, incoming), /Corrections changed/);
  }
  validateCorrectionClockGuard('a', current, { _clock_write_guard: correctionClockGuard('a', current) });
});

test('dashboard delegates global offset changes without holding its lock and preserves backend failure', async () => {
  const route=readFileSync(new URL('../app/api/local-analysis/[analysisId]/download/[fileType]/route.ts',import.meta.url),'utf8');
  const ast=ts.createSourceFile('route.ts',route,ts.ScriptTarget.Latest,true);
  const post=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='POST');
  const fixture=`
    const process={env:{}};
    const NextResponse={json:(body,init={})=>({body,status:init.status||200})};
    const assertLocalAnalysisBoundary=async()=>{};
    const projectBoundaryErrorResponse=()=>null;
    const withCorrectionWriteLock=()=>{throw new Error('Dashboard must not acquire the backend lock');};
    export let calls=[];
    const fetch=async(url,options)=>{calls.push([url,JSON.parse(options.body)]);return {status:409,json:async()=>({detail:'stale clock'})};};
  `;
  const m=await import(`data:text/javascript;base64,${Buffer.from(fixture+compile(post.getText(ast))).toString('base64')}`);
  const payload={transcript_clock_offset_seconds:2,_clock_write_guard:{analysis_id:'a',transcript_clock_offset_seconds:0}};
  const response=await m.POST({json:async()=>payload},{params:Promise.resolve({analysisId:'a',fileType:'annotation_corrections'})});
  assert.equal(response.status,409); assert.equal(response.body.detail,'stale clock');
  assert.deepEqual(m.calls,[['http://127.0.0.1:8000/api/annotation-corrections/a',payload]]);
});
