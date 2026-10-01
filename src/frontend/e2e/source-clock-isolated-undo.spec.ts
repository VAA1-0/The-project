import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Created explicitly by scripts/create_source_clock_acceptance_fixture.py.
// Never default to an original saved analysis for a mutation test.
const fixturePath = process.env.VAA1_CLOCK_FIXTURE;

test('isolated transcript word correction survives reopen and verified undo', async ({page,request}) => {
  test.skip(!fixturePath, 'Requires an explicitly created isolated clock fixture');
  const fixture=JSON.parse(readFileSync(fixturePath!, 'utf8'));
  const id=fixture.analysis_id;
  expect(id).toMatch(/^clock-acceptance-/);
  expect(fixture.project_id).toBe('source-clock-acceptance');
  for (const path of Object.values(fixture.output_files)) expect(String(path)).toContain(`/api_results/${id}/`);
  test.setTimeout(180_000);
  await page.setViewportSize({width:2560,height:1440});
  await page.route('**/api/**', async route => {
    const req=route.request();
    if (!['GET','HEAD','OPTIONS'].includes(req.method()) && !req.url().includes(id)) return route.abort();
    return route.continue();
  });
  const correctionsUrl=`/api/local-analysis/${id}/download/annotation_corrections`;
  const before=await (await request.get(correctionsUrl)).json();
  const open=async()=>{
    await page.goto('/dashboard?activeProject=source-clock-acceptance');
    await page.locator(`[role="button"][data-analysis-id="${id}"]`).click();
    await page.locator('.lm_tab').filter({hasText:/^Transcript$/}).evaluate((tab:HTMLElement)=>tab.click());
  };
  await open();
  const token=page.locator('button[title="Open the source video at this transcript span and select this word for correction or drop."]').first();
  await expect(token).toBeVisible({timeout:90_000});
  await token.click();
  const input=page.getByPlaceholder('Correction inside panel, or leave blank for Unconfirmed');
  await input.fill('CLOCK_UNDO_ACCEPTANCE');
  await page.getByRole('button',{name:'Correct',exact:true}).click();
  await expect.poll(async()=>{
    const saved=await (await request.get(correctionsUrl)).json();
    return saved.text_substitutions?.some((r:any)=>r.corrected_value==='CLOCK_UNDO_ACCEPTANCE');
  },{timeout:30_000}).toBe(true);
  const historyKey=`vaa1.annotation.corrections.history.${id}`;
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),historyKey),{
    message:'The client must finish verified readback and store its guarded undo snapshot before navigation',
    timeout:30_000,
  }).not.toBeNull();
  await open();
  await expect(page.getByRole('button',{name:'CLOCK_UNDO_ACCEPTANCE',exact:true}).first()).toBeVisible({timeout:90_000});
  await page.getByRole('button',{name:'Undo last correction',exact:true}).click();
  await expect.poll(async()=>{
    const saved=await (await request.get(correctionsUrl)).json();
    return saved.text_substitutions?.some((r:any)=>r.corrected_value==='CLOCK_UNDO_ACCEPTANCE') ?? false;
  },{timeout:30_000}).toBe(false);
  const after=await (await request.get(correctionsUrl)).json();
  expect(after.manual_visual_annotations).toEqual(before.manual_visual_annotations);
  expect(after.text_substitutions).toEqual(before.text_substitutions);
  expect(after.correction_undo_history.length).toBe((before.correction_undo_history?.length||0)+1);
  await page.screenshot({path:'../../docs/audits/source_clock_2026-09-25/isolated-word-undo.png'});
});
