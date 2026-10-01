import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const read = file => readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), 'utf8');
const projectBoundaryFixture = `
const isAnalysisAllowedInActiveProject = () => true;
const projectScopeViolation = analysisId => ({ active_project_id: 'fixture', rejected_analysis_id: analysisId, source: 'event', message: 'fixture' });
`;
const source = compile(read('source-clock')) + projectBoundaryFixture + compile(read('golden-layout-lib/eventBus').replace(/^import .*;\n/gm, '')) + compile(read('source-clock-events').replace(/^import .*;\n/gm, ''));
let serial = 0;
async function fixture(loader) {
  const m = await import(`data:text/javascript;base64,${Buffer.from(source + `\n//${++serial}`).toString('base64')}`);
  m.startSourceClockSession(loader ?? (async id => context(id)));
  return m;
}
const context = (id, revision='r1') => ({ clock_id:'source_media.clock', analysis_id:id, binding_status:'content_bound', source_fingerprint:`hash:${id}`, clock_revision:revision, timebase:{duration_seconds:20000} });
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };

test('events carry source revision, preserve zero and long seconds, and reject unscoped/foreign events', async () => {
  const m = await fixture(); const times=[];
  m.eventBus.emit('videoIdChanged','a'); await settle();
  const stop = m.subscribeSourceTime('a',(t,event)=>times.push([t,event.clock_revision]));
  assert.equal(m.publishSourceTime('a',12500),true);
  assert.equal(m.publishSourceTime('a',0),true);
  m.eventBus.emit('videoTimeLineChanged',99);
  m.eventBus.emit('sourceClockTimeChanged',{timestamp_seconds:99});
  for (const value of [NaN,Infinity,-1,null,'',20001]) assert.equal(m.publishSourceTime('a',value),false);
  m.eventBus.emit('videoIdChanged','b'); await settle();
  assert.equal(m.publishSourceTime('a',71),false);
  m.publishSourceTime('b',72);
  assert.deepEqual(times,[[12500,'r1'],[0,'r1']]); stop();
});

test('late lookup and queued seeks cannot cross A → B → A selection boundaries', async () => {
  const requests=[]; const m=await fixture(id=>new Promise(resolve=>requests.push({id,resolve})));
  m.eventBus.emit('videoIdChanged','a');
  const old=m.captureSourceClockNavigation('a'); m.publishSourceTime('a',71,old);
  m.eventBus.emit('videoIdChanged','b'); m.eventBus.emit('videoIdChanged','a');
  requests[0].resolve(context('a','old')); await settle();
  assert.equal(m.publishSourceTime('a',72,old),false);
  requests.at(-1).resolve(context('a','new')); await settle();
  const times=[]; m.subscribeSourceTime('a',(t)=>times.push(t));
  assert.deepEqual(times,[]);
  assert.equal(m.publishSourceTime('a',73),true); assert.deepEqual(times,[73]);
});

test('a source-clock revision refresh rejects old callbacks and replay while allowing current navigation', async () => {
  let revision='r1'; const m=await fixture(async id=>context(id,revision));
  m.eventBus.emit('videoIdChanged','a'); await settle();
  const old=m.captureSourceClockNavigation('a'); m.publishSourceTime('a',71,old);
  revision='r2'; m.eventBus.emit('analysisCorrectionsChanged',{analysisId:'a'}); await settle();
  assert.equal(m.publishSourceTime('a',72,old),false);
  const times=[]; m.subscribeSourceTime('a',t=>times.push(t)); assert.deepEqual(times,[]);
  assert.equal(m.publishSourceTime('a',73),true); assert.deepEqual(times,[73]);
});

test('a current queued seek is replayed to a newly mounted consumer; failed context fails closed', async () => {
  let resolve; const m=await fixture(()=>new Promise(done=>resolve=done));
  m.eventBus.emit('videoIdChanged','a'); m.publishSourceTime('a',0);
  resolve(context('a')); await settle();
  const times=[]; m.subscribeSourceTime('a',t=>times.push(t)); assert.deepEqual(times,[0]);
  m.startSourceClockSession(async()=>{throw new Error('offline');}); await settle();
  assert.equal(m.publishSourceTime('a',71),false);
});

test('synchronous switching during dispatch prevents later consumers accepting the old event', async () => {
  const m=await fixture(); m.eventBus.emit('videoIdChanged','a'); await settle();
  m.eventBus.on('sourceClockTimeChanged',()=>m.eventBus.emit('videoIdChanged','b'));
  const times=[]; m.subscribeSourceTime('a',t=>times.push(t));
  assert.equal(m.publishSourceTime('a',99),false); assert.deepEqual(times,[]);
});

test('an empty video selection falls back to the active analysis context', async () => {
  const m=await fixture();
  m.eventBus.emit('videoIdChanged','');
  m.eventBus.emit('activeAnalysisContext','a'); await settle();
  assert.equal(m.publishSourceTime('a',71),true);
});

test('source-unavailable contexts remain inspectable but never authorize navigation', async () => {
  const m=await fixture(async id=>({
    clock_id:'source_media.clock', analysis_id:id, binding_status:'source_unavailable',
    source_fingerprint:null, clock_revision:null,
  }));
  const unavailable=[]; const times=[];
  m.eventBus.on('sourceClockNavigationUnavailable',event=>unavailable.push(event));
  m.eventBus.emit('videoIdChanged','a');
  m.publishSourceTime('a',71); await settle();
  m.subscribeSourceTime('a',time=>times.push(time));
  assert.equal(m.getActiveSourceClockContext()?.binding_status,'source_unavailable');
  assert.equal(m.publishSourceTime('a',72),false);
  assert.deepEqual(times,[]);
  assert.equal(unavailable.at(-1)?.analysis_id,'a');
});
