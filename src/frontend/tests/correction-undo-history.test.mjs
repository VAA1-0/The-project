import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const source = readFileSync(new URL('../lib/annotation-corrections.ts', import.meta.url), 'utf8').replace(/^import \{ eventBus \}[^\n]+\n/m, 'const eventBus = { emit() {} };\n');
const history = await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`);

test('peek leaves undo history intact and acknowledgment does not consume newer entries', () => {
  const original = globalThis.window, storage = new Map();
  globalThis.window = { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) } };
  try {
    history.pushCorrectionSnapshot('a', { text_substitutions: [] });
    const first = history.peekCorrectionSnapshot('a');
    assert.deepEqual(history.peekCorrectionSnapshot('a'), first);
    history.pushCorrectionSnapshot('a', { text_substitutions: [{ id: 'newer' }] });
    assert.equal(history.acknowledgeCorrectionSnapshot('a', first.token), false);
    const newer = history.peekCorrectionSnapshot('a');
    assert.equal(history.acknowledgeCorrectionSnapshot('a', newer.token), true);
    assert.deepEqual(history.peekCorrectionSnapshot('a'), first);
    assert.equal(history.acknowledgeCorrectionSnapshot('a', first.token), true);
    assert.equal(history.peekCorrectionSnapshot('a'), null);
  } finally { globalThis.window = original; }
});

test('undo readback detects merge-retained corrections while ignoring save metadata', () => {
  const desired = { text_substitutions: [], transcript_clock_offset_seconds: 0, updated_at: 'old' };
  assert.equal(history.correctionSnapshotRestored(desired, { ...desired, updated_at: 'new' }), true);
  assert.equal(history.correctionSnapshotRestored(desired, { ...desired, text_substitutions: [{ id: 'retained' }] }), false);
  assert.equal(history.correctionSnapshotRestored(desired, { ...desired, transcript_clock_offset_seconds: 2 }), false);
  assert.equal(history.correctionSnapshotRestored({}, { text_substitutions: [{ id: 'retained' }] }), false);
  assert.equal(history.correctionSnapshotRestored({}, { text_substitutions: [] }), true);
});

async function fixture() {
  const binding = compile(readFileSync(new URL('../lib/correction-draft-binding.ts', import.meta.url), 'utf8'));
  const source = readFileSync(new URL('../app/V2components/components/panels/SpeechToTextPanel.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('panel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const funcs = [];
  const visit = n => { if (ts.isVariableDeclaration(n) && ['commitWordCorrection', 'undoLastCorrection'].includes(n.name.getText(ast))) funcs.push('export const '+n.getText(ast)+';'); ts.forEachChild(n, visit); }; visit(ast);
  assert.equal(funcs.length, 2);
  const state = `
    const videoId = 'a', activeVideoId = { current: 'a' }, undoPending = { current: false };
    const guard = { analysis_id: 'a', binding_status: 'content_bound', source_fingerprint: 'hash', clock_revision: 'r1', transcript_clock_offset_seconds: 0 };
    export const analysisData = { annotationCorrections: { _clock_write_guard: guard } };
    const wordBinding = { current: captureCorrectionDraftBinding('a', analysisData.annotationCorrections) };
    const selectedWordDraft = 'corrected';
    export let writes = 0, consumed = 0, pushed = 0, cleared = 0, message = null;
    let fail = false, verified = true;
    export const reject = () => { fail = true; };
    export const mismatch = () => { verified = false; };
    const peekCorrectionSnapshot = () => ({ token: 'token', corrections: { _clock_write_guard: { ...guard, clock_revision: 'r1' } } });
    const acknowledgeCorrectionSnapshot = () => { consumed++; return true; };
    const correctionUndoVerified = () => verified;
    const wordUndoSnapshot = before => before;
    const prepareCorrectionUndo = (snapshot, current) => correctionsForDraft(captureCorrectionDraftBinding('a', snapshot), 'a', current);
    const pushCorrectionSnapshot = () => { pushed++; };
    const mergeCorrectionRule = current => current;
    const buildDropCorrectionRule = () => ({}), buildCorrectionRule = () => ({});
    const VideoService = { saveAnnotationCorrections: async (_id, data) => { writes++; if (fail) throw new Error('rejected'); return data; } };
    const surfaceCorrections = () => {}, broadcastAnalysisCorrectionRefresh = () => {};
    const setWordMessage = v => { message = v; };
    const setSelectedWord = () => { cleared++; }, setSelectedWordDraft = () => {};
  `;
  return import(`data:text/javascript;base64,${Buffer.from(binding + state + compile(funcs.join('\n')) + '\n//'+Math.random()).toString('base64')}`);
}

test('actual word save/drop retain stale drafts and only push history after successful save', async () => {
  for (const drop of [false, true]) {
    const stale = await fixture(); stale.analysisData.annotationCorrections._clock_write_guard.clock_revision = 'r2';
    await stale.commitWordCorrection('word', drop);
    assert.equal(stale.writes, 0); assert.equal(stale.cleared, 0); assert.equal(stale.pushed, 0);
    const rejected = await fixture(); rejected.reject(); await rejected.commitWordCorrection('word', drop);
    assert.equal(rejected.pushed, 0); assert.equal(rejected.cleared, 0); assert.equal(rejected.message, 'rejected');
    const valid = await fixture(); await valid.commitWordCorrection('word', drop);
    assert.equal(valid.pushed, 1); assert.equal(valid.cleared, 1);
  }
});

test('actual undo preserves history on rejection, stale binding and unverified restoration', async () => {
  for (const mode of ['reject', 'mismatch', 'stale', 'valid']) {
    const panel = await fixture();
    if (mode === 'reject') panel.reject();
    if (mode === 'mismatch') panel.mismatch();
    if (mode === 'stale') panel.analysisData.annotationCorrections._clock_write_guard.clock_revision = 'r2';
    await panel.undoLastCorrection();
    assert.equal(panel.consumed, mode === 'valid' ? 1 : 0);
    if (mode === 'stale') assert.equal(panel.writes, 0);
  }
});
