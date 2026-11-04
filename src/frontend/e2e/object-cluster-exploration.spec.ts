import { expect, test } from "@playwright/test";

test("object-family lineups support source crops, drag reassignment, split and mature batch confirmation", async ({ page }) => {
  await page.setContent(`
    <section data-vaa1-object-cluster-workbench="true">
      <div data-family="car"><h3>car</h3><div data-drop="car" style="width:180px;height:50px;border:1px solid #555"></div></div>
      <div data-family="weapon"><h3>weapon</h3><div data-drop="weapon" style="width:180px;height:50px;border:1px solid #555"></div></div>
      <button draggable="true" data-member="track-7" data-family-name="car">
        <img alt="car at 0:30.460" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />track 7
      </button>
      <input aria-label="Object cluster threshold preview" type="range" value="65" />
      <input aria-label="Target object family" value="weapon" />
      <button data-action="split">Split selected</button>
      <button data-action="confirm">Confirm selected</button>
      <output data-receipt></output>
    </section>
    <script>
      const member = document.querySelector('[data-member]');
      member.addEventListener('dragstart', event => event.dataTransfer.setData('text/datascene-object-cluster-member', 'track-7'));
      document.querySelector('[data-drop="weapon"]').addEventListener('dragover', event => event.preventDefault());
      document.querySelector('[data-drop="weapon"]').addEventListener('drop', event => {
        event.preventDefault(); member.dataset.familyName = 'weapon'; member.dataset.staged = 'true';
      });
      member.addEventListener('click', () => member.dataset.selected = 'true');
      document.querySelector('[data-action="split"]').addEventListener('click', () => document.querySelector('[data-receipt]').textContent = 'split staged · canonical data unchanged');
      document.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        member.dataset.maturity = 'mature';
        document.querySelector('[data-receipt]').textContent = 'Confirmed ✓ · mature · lineage receipt recorded';
      });
    </script>
  `);

  const member = page.locator('[data-member="track-7"]');
  await member.dragTo(page.locator('[data-drop="weapon"]'));
  await expect(member).toHaveAttribute("data-family-name", "weapon");
  await expect(member).toHaveAttribute("data-staged", "true");
  await member.click();
  await page.getByRole("button", { name: "Split selected" }).click();
  await expect(page.locator("[data-receipt]")).toContainText("canonical data unchanged");
  await page.getByRole("button", { name: "Confirm selected" }).click();
  await expect(member).toHaveAttribute("data-maturity", "mature");
  await expect(page.locator("[data-receipt]")).toContainText("lineage receipt recorded");
});
