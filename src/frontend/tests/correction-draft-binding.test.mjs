import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const code = compile(readFileSync(new URL('../lib/correction-draft-binding.ts', import.meta.url), 'utf8'));
const { captureCorrectionDraftBinding, correctionsForDraft } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const corrections = () => ({ _clock_write_guard: { analysis_id: 'a', binding_status: 'content_bound', source_fingerprint: 'hash', clock_revision: 'r1', transcript_clock_offset_seconds: 0 } });

test('draft copies binding while preserving same-clock independent corrections', () => {
  const initial = corrections();
  const draft = captureCorrectionDraftBinding('a', initial);
  initial._clock_write_guard.clock_revision = 'r2';
  assert.equal(draft.guard.clock_revision, 'r1');
  const refreshed = { ...corrections(), manual_visual_annotations: [{ id: 'independent' }] };
  const save = correctionsForDraft(draft, 'a', refreshed);
  assert.deepEqual(save.manual_visual_annotations, refreshed.manual_visual_annotations);
  assert.deepEqual(save._clock_write_guard, draft.guard);
  assert.notEqual(save._clock_write_guard, draft.guard);
});

test('draft rejects changed timebase, media, selection and unbound evidence', () => {
  const draft = captureCorrectionDraftBinding('a', corrections());
  for (const patch of [{ correction_generation: 'new-save' }, { clock_revision: 'r2' }, { source_fingerprint: 'other' }, { transcript_clock_offset_seconds: 2 }, { binding_status: 'source_unavailable' }, { analysis_id: 'b' }]) {
    const current = corrections(); Object.assign(current._clock_write_guard, patch);
    assert.throws(() => correctionsForDraft(draft, 'a', current), /draft is retained/);
  }
  assert.throws(() => correctionsForDraft(draft, 'b', corrections()));
  assert.throws(() => correctionsForDraft(captureCorrectionDraftBinding('a', {}), 'a', corrections()));
});

async function panelFixture() {
  const source = readFileSync(new URL('../app/V2components/components/panels/SpeechToTextPanel.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('panel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ['saveTranscriptEditor', 'removeTranscriptEditorEntry', 'openTranscriptSpanEditor', 'openManualTranscriptEditor'].includes(node.name.getText(ast))) declarations.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }; visit(ast);
  assert.equal(declarations.length, 4);
  const fixture = `
    const videoId = 'a';
    export let analysisData = { annotationCorrections: ${JSON.stringify(corrections())} };
    const activeVideoId = { current: 'a' }, videoTimeLine = 71;
    export let editorDraft = null, message = null, writes = 0, surfaced = 0, submitted = null;
    const activeEditorDraft = { get current() { return editorDraft; } };
    let changeSourceDuringSave = false, failSave = false, replaceDraftDuringSave = false;
    export const replaceDuringSave = () => { replaceDraftDuringSave = true; };
    export const switchDuringSave = () => { changeSourceDuringSave = true; };
    export const rejectSave = () => { failSave = true; };
    const setEditorDraft = value => { editorDraft = value; };
    const setEditorMessage = value => { message = value; };
    const setSelectedWord = () => {}, setSelectedWordDraft = () => {};
    const surfaceCorrections = () => { surfaced++; };
    const broadcastAnalysisCorrectionRefresh = () => {}, pushCorrectionSnapshot = () => {};
    const correctionUndoSnapshot = () => ({ _correction_undo: { operation_id: 'fixture' } });
    const upsertManualTranscriptEntry = (current, entry) => ({ ...current, manual_transcript_entries: [entry] });
    const removeManualTranscriptEntry = current => current;
    const VideoService = { saveAnnotationCorrections: async (_id, current) => {
      writes++; submitted = current;
      if (failSave) throw new Error('Server rejected stale revision');
      if (changeSourceDuringSave) activeVideoId.current = 'b';
      if (replaceDraftDuringSave) editorDraft = { ...editorDraft, text: 'newer draft' };
      return current;
    } };
  `;
  return import(`data:text/javascript;base64,${Buffer.from(code + fixture + compile(declarations.map(d => {
    const name = d.slice(0, d.indexOf(' ='));
    if (['saveTranscriptEditor', 'removeTranscriptEditorEntry'].includes(name)) {
      // A React render captures its draft value; model that closure explicitly.
      return 'const make_' + name + ' = (editorDraft) => ' + d.slice(d.indexOf('=') + 1) + '; export const ' + name + ' = () => make_' + name + '(editorDraft)();';
    }
    return 'export const ' + d + ';';
  }).join('\n')) + '\n//'+Math.random()).toString('base64')}`);
}

test('actual draft openers capture binding; refresh blocks save and removal', async () => {
  for (const action of ['saveTranscriptEditor', 'removeTranscriptEditorEntry']) {
    const panel = await panelFixture();
    panel.openTranscriptSpanEditor({ correctionSource: 'manual', targetId: 'entry', start: 71, end: 72, text: 'test' });
    const draft = panel.editorDraft;
    panel.analysisData.annotationCorrections._clock_write_guard.clock_revision = 'r2';
    await panel[action]();
    assert.equal(panel.writes, 0);
    assert.equal(panel.editorDraft, draft);
    assert.match(panel.message, /draft is retained/);
  }
  const panel = await panelFixture();
  panel.openManualTranscriptEditor();
  await panel.saveTranscriptEditor();
  assert.equal(panel.writes, 1);
  assert.equal(panel.submitted._clock_write_guard.clock_revision, 'r1');
  assert.equal(panel.editorDraft, null);
});

test('actual save retains failed drafts and ignores replies for another video', async () => {
  const failed = await panelFixture(); failed.openManualTranscriptEditor(); failed.rejectSave();
  await failed.saveTranscriptEditor();
  assert.ok(failed.editorDraft); assert.match(failed.message, /Server rejected/);
  const switched = await panelFixture(); switched.openManualTranscriptEditor(); switched.switchDuringSave();
  await switched.saveTranscriptEditor();
  assert.equal(switched.surfaced, 0); assert.ok(switched.editorDraft);
  const replaced = await panelFixture(); replaced.openManualTranscriptEditor(); replaced.replaceDuringSave();
  await replaced.saveTranscriptEditor();
  assert.equal(replaced.surfaced, 0); assert.equal(replaced.editorDraft.text, 'newer draft');
});
