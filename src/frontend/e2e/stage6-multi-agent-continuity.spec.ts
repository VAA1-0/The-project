import { expect, test } from "@playwright/test";

test("Stage 6 keeps Bond and Nomi corridors distinct across panels and detached hydration", async ({ page }) => {
  await page.setContent(`
    <main style="background:#060909;color:#d7f9ff;padding:16px;font-family:system-ui">
      <button id="bond">James Bond</button><button id="nomi">Nomi</button>
      <section id="panels"></section><button id="detach">Detach Narrative Agent</button>
      <script>
        const corridors = {
          bond: { label: "James Bond", revision: "bond-revision-1", member: "bond-occurrence", start: 43, end: 46 },
          nomi: { label: "Nomi", revision: "nomi-revision-1", member: "nomi-occurrence", start: 47, end: 49 }
        };
        const consumers = ["Video", "Audio", "Narrative Agent", "Meaning / Plot", "Master Schema", "Data Maturation", "Search", "Traceback", "Measurements"];
        let selected = "bond";
        function render(target = document.getElementById("panels")) {
          const row = corridors[selected];
          target.innerHTML = consumers.map(consumer => '<article data-continuity-consumer="' + consumer + '" data-revision="' + row.revision + '" data-member="' + row.member + '"><b>' + consumer + '</b><button data-source-jump="' + row.start + '">' + row.label + ' ' + row.start + '–' + row.end + '</button></article>').join('');
          target.querySelectorAll('[data-source-jump]').forEach(button => button.onclick = () => document.body.dataset.sourceClock = button.dataset.sourceJump);
        }
        document.getElementById("bond").onclick = () => { selected = "bond"; render(); };
        document.getElementById("nomi").onclick = () => { selected = "nomi"; render(); };
        document.getElementById("detach").onclick = () => {
          const detached = document.createElement("aside");
          detached.dataset.detachedContinuityPanel = "true";
          render(detached);
          document.body.appendChild(detached);
        };
        render();
      </script>
    </main>
  `);

  const panels = page.locator("#panels [data-continuity-consumer]");
  await expect(panels).toHaveCount(9);
  await expect(page.locator('#panels [data-continuity-consumer][data-revision="bond-revision-1"]')).toHaveCount(9);
  await expect(page.locator('#panels [data-continuity-consumer][data-member="bond-occurrence"]')).toHaveCount(9);
  await panels.first().locator("[data-source-jump]").click();
  await expect(page.locator("body")).toHaveAttribute("data-source-clock", "43");

  await page.locator("#nomi").click();
  await expect(page.locator('#panels [data-continuity-consumer][data-revision="nomi-revision-1"]')).toHaveCount(9);
  await expect(page.locator('#panels [data-continuity-consumer][data-member="nomi-occurrence"]')).toHaveCount(9);
  await expect(panels.first()).not.toContainText("James Bond");

  await page.locator("#detach").click();
  const detached = page.locator('[data-detached-continuity-panel="true"] [data-continuity-consumer]');
  await expect(detached).toHaveCount(9);
  await expect(page.locator('[data-detached-continuity-panel="true"] [data-continuity-consumer][data-revision="nomi-revision-1"]')).toHaveCount(9);
  await expect(page.locator('[data-detached-continuity-panel="true"] [data-continuity-consumer][data-member="nomi-occurrence"]')).toHaveCount(9);
});
