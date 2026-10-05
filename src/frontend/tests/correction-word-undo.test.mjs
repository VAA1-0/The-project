import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const lib = name => compile(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8'));
const undoCode = lib('correction-word-undo');
const { wordUndoSnapshot, prepareWordUndo, applyWordUndo, wordUndoVerified } = await import(`data:text/javascript;base64,${Buffer.from(undoCode).toString('base64')}`);
const guard = generation => ({ analysis_id:'a', binding_status:'content_bound', source_fingerprint:'hash', clock_revision:'clock', transcript_clock_offset_seconds:0, correction_generation:generation });
const edited = { id:'text:word', modality:'text', raw_value:'word', corrected_value:'corrected', updated_at:'2026-09-23' };
const document = (rows, generation='g1') => ({ text_substitutions:rows, correction_generation:generation, _clock_write_guard:guard(generation) });

test('inverse restores previous rule or removes a new rule while preserving unrelated later edits', () => {
  for (const before of [null, {...edited, corrected_value:'prior', updated_at:'old'}]) {
    const snapshot = wordUndoSnapshot(document(before ? [before] : []), document([edited]), edited.id);
    const independent = { id:'text:other', modality:'text', corrected_value:'independent' };
    const current = document([edited, independent], 'g2');
    const request = prepareWordUndo(snapshot, current);
    const saved = applyWordUndo(current, request, 'g3', 'now');
    assert.deepEqual(saved.text_substitutions, before ? [independent, before] : [independent]);
    assert.equal(saved.correction_undo_history.length, 1);
    assert.equal(saved.correction_undo_history[0].based_on_generation, 'g2');
    assert.ok(wordUndoVerified(snapshot, saved));
    const retry = applyWordUndo(saved, request, 'g4', 'later');
    assert.equal(retry.correction_generation, 'g3');
    assert.equal(retry.correction_undo_history.length, 1);
    assert.deepEqual(current.text_substitutions, [edited, independent]);
  }
});

test('inverse rejects conflicting target, changed clock, duplicates and operation-ID reuse', () => {
  const snapshot = wordUndoSnapshot(document([]), document([edited]), edited.id);
  const current = document([edited]);
  const request = prepareWordUndo(snapshot, current);
  assert.throws(() => applyWordUndo(document([{...edited, corrected_value:'later'}]), request, 'g2','now'), /changed after/);
  assert.throws(() => applyWordUndo(document([edited,edited]), request, 'g2','now'), /Duplicate/);
  assert.throws(() => prepareWordUndo(snapshot, {...current, _clock_write_guard:{...guard('g2'), clock_revision:'different'}}), /Source clock/);
  assert.throws(() => prepareWordUndo({},current), /older history/);
  const saved = applyWordUndo(current, request, 'g2','now');
  const altered = structuredClone(request); altered._word_undo.before = {...edited,corrected_value:'forged'};
  assert.throws(() => applyWordUndo(saved, altered,'g3','now'), /retry conflicts/);
});

test('actual route persists inverse and provenance, survives cached reload and rejects a stale concurrent save', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'word-undo-'));
  try {
    const directory = path.join(root,'outputs/api_results/a'); await fs.mkdir(directory,{recursive:true});
    const canonicalPath = path.join(directory,'annotation_corrections.json');
    const initial = document([edited]); delete initial._clock_write_guard;
    await fs.writeFile(canonicalPath, JSON.stringify(initial));
    // A newer imported cache must not resurrect the removed target.
    await fs.writeFile(path.join(directory,'analysis_record.json'),JSON.stringify({annotation_corrections:{...initial,updated_at:'2099-01-01'}}));
    const route = readFileSync(new URL('../app/api/local-analysis/[analysisId]/download/[fileType]/route.ts',import.meta.url),'utf8');
    const ast = ts.createSourceFile('route.ts',route,ts.ScriptTarget.Latest,true);
    const names = ['GET','POST','readRichestAnnotationCorrections','readRecord','analysisRecordPath','correctionMaturity','correctionDocumentTime','withCorrectionWriteLock','updateMasterSchemaCorrectionReviewLayer'];
    const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text)).map(n=>n.getText(ast));
    const fixture = `
      class CorrectionBindingUnavailable extends Error {}
      const projectRoot = () => ${JSON.stringify(root)};
      const safeProjectPath = p => path.join(projectRoot(),p);
      const correctionWriteQueues = new Map();
      const NextResponse = { json:(body,init={})=>({body,status:init.status||200}) };
      const assertLocalAnalysisBoundary = async () => ({ project_id: "fixture", analysis_id: "a" });
      const projectBoundaryErrorResponse = () => null;
      const readCorrectionSourceBinding = async () => ({analysis_id:'a',binding_status:'content_bound',source_fingerprint:'hash',clock_revision:'clock',timebase:{transcript_clock_offset_seconds:0}});
    `;
    const moduleCode = lib('correction-write-lock') + lib('annotation-correction-merge') + lib('correction-clock-guard') + undoCode + fixture + compile(functions.join('\n'));
    const mod = await import(`data:text/javascript;base64,${Buffer.from(moduleCode).toString('base64')}`);
    const params = {params:Promise.resolve({analysisId:'a',fileType:'annotation_corrections'})};
    const loaded = (await mod.GET({},params)).body;
    const snapshot = wordUndoSnapshot(document([]),loaded,edited.id);
    const request = prepareWordUndo(snapshot, loaded);
    const response = await mod.POST({json:async()=>request},params);
    assert.equal(response.status,200,JSON.stringify(response));
    const reopened = (await mod.GET({},params)).body;
    assert.deepEqual(reopened.text_substitutions,[]);
    assert.ok(wordUndoVerified(snapshot,reopened));
    const master = JSON.parse(await fs.readFile(path.join(directory,'vaa1_annotation_master_schema.json'),'utf8'));
    assert.deepEqual(master.review_layer.annotation_corrections.text_substitutions,[]);
    const bytes = await fs.readFile(canonicalPath,'utf8');
    assert.equal((await mod.POST({json:async()=>loaded},params)).status,409);
    assert.equal(await fs.readFile(canonicalPath,'utf8'),bytes);
    assert.equal(JSON.parse(bytes)._word_undo,undefined);
    const retry = prepareWordUndo(snapshot,reopened);
    assert.equal((await mod.POST({json:async()=>retry},params)).status,200);
    assert.equal((await mod.GET({},params)).body.correction_undo_history.length,1);
    assert.deepEqual(await fs.readdir(path.join(root,'.cache/correction-write-locks')),[]);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('collection inverse restores interval edits and removes additions without overwriting unrelated later work', async () => {
  const {correctionUndoSnapshot,prepareCorrectionUndo,applyCorrectionUndo,correctionUndoVerified}=await import(`data:text/javascript;base64,${Buffer.from(undoCode).toString('base64')}`);
  const before={...document([]),manual_transcript_entries:[{id:'span',start:71,end:72}]};
  const committed={...document([],'g2'),manual_transcript_entries:[{id:'span',start:71.5,end:72.5}],manual_visual_annotations:[{id:'box',label:'Bond'}]};
  const snapshot=correctionUndoSnapshot(before,committed);
  const current={...committed,...document([{id:'unrelated',modality:'text'}],'g3')};
  const request=prepareCorrectionUndo(snapshot,current);
  const saved=applyCorrectionUndo(current,request,'g4','now');
  assert.deepEqual(saved.manual_transcript_entries,before.manual_transcript_entries);
  assert.deepEqual(saved.manual_visual_annotations,[]);
  assert.deepEqual(saved.text_substitutions,current.text_substitutions);
  assert.ok(correctionUndoVerified(snapshot,saved));
  assert.equal(applyCorrectionUndo(saved,prepareCorrectionUndo(snapshot,{...saved,_clock_write_guard:guard('g4')}),'g5','later').correction_generation,'g4');
  assert.throws(()=>applyCorrectionUndo({...current,manual_transcript_entries:[{id:'span',start:99,end:100}]},request,'g4','now'),/changed after/);
  assert.throws(()=>prepareCorrectionUndo(snapshot,{...current,_clock_write_guard:{...guard('g3'),clock_revision:'new'}}),/Source clock/);
  assert.equal(current.manual_transcript_entries[0].start,71.5);
});
