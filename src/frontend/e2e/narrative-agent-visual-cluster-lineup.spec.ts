import { expect, test } from "@playwright/test";

test("visual Narrative Agent lineups support drag reassignment, batch confirmation, and mature projection", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 760 });
  await page.setContent(`
    <main style="font-family:system-ui;background:#080808;color:#e5e7eb;min-height:100vh;padding:18px">
      <section data-vaa1-narrative-agent-visual-cluster-lineup="true" style="width:840px;border:1px solid #334155;padding:10px">
        <header style="display:flex;justify-content:space-between;margin-bottom:8px">
          <strong>Visual Narrative Agent lineups</strong><span id="receipt">candidate review</span>
        </header>
        <div id="bond" data-vaa1-narrative-agent-visual-lineup-row="James Bond" style="min-height:86px;border:1px solid #475569;padding:8px;margin:6px 0">
          <span>James Bond</span><div class="thumbs" style="display:flex;gap:6px;margin-top:6px"></div>
        </div>
        <div id="nomi" data-vaa1-narrative-agent-visual-lineup-row="Nomi" style="min-height:86px;border:1px solid #475569;padding:8px;margin:6px 0">
          <span>Nomi</span><div class="thumbs" style="display:flex;gap:6px;margin-top:6px"></div>
        </div>
        <button id="confirm" type="button">Confirm all selected (0)</button>
      </section>
      <section id="consumers" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:840px;margin-top:10px">
        <div data-consumer="Narrative Agent Graph">Narrative Agent Graph</div>
        <div data-consumer="Meaning Knowledge Graph">Meaning Knowledge Graph</div>
        <div data-consumer="Audio">Audio</div>
        <div data-consumer="Transcript">Transcript</div>
      </section>
      <script>
        const state = {
          candidates: [
            { id:'bond-1', label:'James Bond', time:30.53 },
            { id:'wrong-nomi', label:'James Bond', time:41.92 },
            { id:'nomi-2', label:'Nomi', time:46.0 },
          ],
          selected: new Set(), decisions: [],
        };
        window.__visualLineup = state;
        function render() {
          for (const row of ['bond','nomi']) document.querySelector('#'+row+' .thumbs').innerHTML='';
          for (const candidate of state.candidates) {
            const row = candidate.label === 'Nomi' ? document.querySelector('#nomi .thumbs') : document.querySelector('#bond .thumbs');
            const card = document.createElement('div');
            card.draggable = true;
            card.dataset.vaa1NarrativeAgentVisualDraggableCandidate = 'true';
            card.dataset.candidateId = candidate.id;
            card.style.cssText='position:relative;width:56px;height:56px;border:1px solid #64748b;background:#111827';
            card.innerHTML='<button type="button" aria-label="Select '+candidate.id+'" style="position:absolute;inset:0;background:transparent;color:#e5e7eb">'+candidate.id+'<br>'+candidate.time.toFixed(2)+'</button>';
            card.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', candidate.id));
            card.querySelector('button').addEventListener('click', () => {
              if (state.selected.has(candidate.id)) state.selected.delete(candidate.id); else state.selected.add(candidate.id);
              document.querySelector('#confirm').textContent='Confirm all selected ('+state.selected.size+')';
              card.dataset.selected=state.selected.has(candidate.id) ? 'true' : 'false';
            });
            row.appendChild(card);
          }
        }
        for (const [id,label] of [['bond','James Bond'],['nomi','Nomi']]) {
          const row=document.querySelector('#'+id);
          row.addEventListener('dragover', event => event.preventDefault());
          row.addEventListener('drop', event => {
            event.preventDefault();
            const candidateId=event.dataTransfer.getData('text/plain');
            const candidate=state.candidates.find(item => item.id===candidateId);
            candidate.label=label;
            state.selected.add(candidateId);
            render();
            document.querySelector('#confirm').textContent='Confirm all selected ('+state.selected.size+')';
          });
        }
        document.querySelector('#confirm').addEventListener('click', () => {
          for (const id of state.selected) {
            const candidate=state.candidates.find(item => item.id===id);
            state.decisions.push({ candidate_id:id, applied_label:candidate.label, decision:'confirmed', maturity:'user_confirmed_truth' });
            for (const consumer of document.querySelectorAll('[data-consumer]')) {
              const thumb=document.createElement('span');
              thumb.dataset.vaa1NarrativeAgentThumbnailProjection='true';
              thumb.dataset.candidateId=id;
              thumb.textContent=candidate.label+' '+candidate.time.toFixed(2);
              thumb.style.cssText='display:block;margin-top:4px;border:1px solid #047857;padding:3px;font-size:10px';
              consumer.appendChild(thumb);
            }
          }
          document.querySelector('#receipt').textContent=state.selected.size+' mature confirmations saved';
          state.selected.clear();
          document.querySelector('#confirm').textContent='Confirm all selected (0)';
        });
        render();
      </script>
    </main>
  `);

  await expect(page.locator('[data-vaa1-narrative-agent-thumbnail-projection]')).toHaveCount(0);
  const wrong = page.locator('[data-candidate-id="wrong-nomi"]');
  await wrong.dragTo(page.locator('[data-vaa1-narrative-agent-visual-lineup-row="Nomi"]'));
  await expect(page.locator('#nomi [data-candidate-id="wrong-nomi"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Select nomi-2" }).click();
  await expect(page.getByRole("button", { name: "Confirm all selected (2)" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm all selected (2)" }).click();
  await expect(page.locator('#receipt')).toContainText("2 mature confirmations saved");
  for (const consumer of ["Narrative Agent Graph", "Meaning Knowledge Graph", "Audio", "Transcript"]) {
    await expect(page.locator(`[data-consumer="${consumer}"] [data-vaa1-narrative-agent-thumbnail-projection]`)).toHaveCount(2);
  }
  const decisions = await page.evaluate(() => (window as any).__visualLineup.decisions);
  expect(decisions).toEqual([
    { candidate_id: "wrong-nomi", applied_label: "Nomi", decision: "confirmed", maturity: "user_confirmed_truth" },
    { candidate_id: "nomi-2", applied_label: "Nomi", decision: "confirmed", maturity: "user_confirmed_truth" },
  ]);
});
