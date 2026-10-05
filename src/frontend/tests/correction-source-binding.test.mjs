import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const code = ts.transpileModule(readFileSync(new URL('../lib/correction-source-binding.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readCorrectionSourceBinding, CorrectionBindingUnavailable } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('clock transport validates identity, availability and numeric timebase without fallback', async () => {
  const original = globalThis.fetch;
  const valid = { analysis_id: 'a', binding_status: 'content_bound', source_fingerprint: 'hash', clock_revision: 'revision', timebase: { transcript_clock_offset_seconds: 0 } };
  let payload = valid;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal);
      return { ok: true, json: async () => payload };
    };
    assert.deepEqual(await readCorrectionSourceBinding('a', 'project-a'), valid);
    for (const invalid of [{ ...valid, analysis_id: 'b' }, { ...valid, clock_revision: '' }, { ...valid, timebase: {} }, { ...valid, binding_status: 'unknown' }]) {
      payload = invalid;
      await assert.rejects(readCorrectionSourceBinding('a', 'project-a'), CorrectionBindingUnavailable);
    }
    payload = { analysis_id: 'a', binding_status: 'source_unavailable', source_fingerprint: null, clock_revision: null };
    assert.equal((await readCorrectionSourceBinding('a', 'project-a')).binding_status, 'source_unavailable');
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(readCorrectionSourceBinding('a', 'project-a'), CorrectionBindingUnavailable);
    globalThis.fetch = async () => { throw new Error('timeout'); };
    await assert.rejects(readCorrectionSourceBinding('a', 'project-a'), /timeout/);
  } finally { globalThis.fetch = original; }
});

test('actual API save carries the loaded guard and refuses a changed readback binding', async () => {
  const source = readFileSync(new URL('../lib/api-service.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('api.ts', source, ts.ScriptTarget.Latest, true);
  let method;
  const visit = node => {
    if (ts.isMethodDeclaration(node) && node.name?.getText(ast) === 'saveAnnotationCorrections') method = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(method);
  const compiled = ts.transpileModule(`
    const localAnalysisUrl = (analysisId, suffix = "", extra = {}) => {
      const params = new URLSearchParams({ context_analysis_id: analysisId, project_id: "bond-cop30-helsinki", ...extra });
      return \`/api/local-analysis/\${encodeURIComponent(analysisId)}\${suffix}?\${params.toString()}\`;
    };
    export class Service { invalidateReadCaches() {} ${method.getText(ast)} }
  `, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { Service } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const original = globalThis.fetch;
  const loaded = { updated_at: 'fixture', _clock_write_guard: { analysis_id: 'a', transcript_clock_offset_seconds: 0, source_fingerprint: 'hash', clock_revision: 'old' } };
  try {
    let replace = false;
    globalThis.fetch = async (url, options) => {
      assert.match(String(url), /^\/api\/local-analysis\/a\/download\/annotation_corrections\?/);
      if (options.method === 'POST') {
        assert.deepEqual(JSON.parse(options.body)._clock_write_guard, loaded._clock_write_guard);
        return { ok: true, json: async () => ({ annotation_corrections: loaded }) };
      }
      return { ok: true, json: async () => replace ? { ...loaded, _clock_write_guard: { ...loaded._clock_write_guard, clock_revision: 'new' } } : loaded };
    };
    assert.deepEqual(await new Service().saveAnnotationCorrections('a', loaded), loaded);
    replace = true;
    await assert.rejects(new Service().saveAnnotationCorrections('a', loaded), /changed during readback/);
  } finally { globalThis.fetch = original; }
});
