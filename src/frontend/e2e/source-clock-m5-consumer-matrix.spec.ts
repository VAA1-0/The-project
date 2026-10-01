import { expect, test, type Locator, type Page } from "@playwright/test";

const BOND_ID = "8183c1fd-7cb9-49d0-b20c-378399e9c41f";

type Surface = {
  name: string;
  tab: string;
  menu?: "Lenses" | "Window";
  item?: string;
};

const SURFACES: Surface[] = [
  { name: "Video", tab: "Video" },
  { name: "Transcript", tab: "Transcript" },
  { name: "Audio", tab: "Audio", menu: "Window", item: "Audio" },
  { name: "Objects", tab: "Objects", menu: "Lenses", item: "OBJ Detection Lens" },
  { name: "OCR", tab: "OCR", menu: "Lenses", item: "OCR Lens" },
  { name: "Expressions", tab: "Expressions", menu: "Lenses", item: "Expression Lens" },
  { name: "POS", tab: "POS", menu: "Lenses", item: "POS analysis Lens" },
  { name: "Quant", tab: "Quant", menu: "Lenses", item: "Quantitative Analysis" },
  { name: "Scene Cards", tab: "Scene Cards", menu: "Lenses", item: "Scene Cards" },
  { name: "Narrative Agent", tab: "Narrative Agent", menu: "Lenses", item: "Narrative Agent Leaf" },
  { name: "Meaning / Plot", tab: "Meaning / Plot", menu: "Window", item: "Meaning / Plot" },
  { name: "Master Schema", tab: "Master Schema", menu: "Lenses", item: "Master Schema" },
  { name: "Data Maturation", tab: "Maturation", menu: "Lenses", item: "Data Maturation" },
  { name: "Search", tab: "Search", menu: "Lenses", item: "Search" },
  { name: "StatsKit", tab: "StatsKit", menu: "Lenses", item: "StatsKit" },
  { name: "Traceback", tab: "Traceback", menu: "Window", item: "Traceback" },
];

function tabFor(page: Page, label: string): Locator {
  return page.locator(".lm_tab").filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).last();
}

async function ensureSurface(page: Page, surface: Surface): Promise<Locator> {
  let tab = tabFor(page, surface.tab);
  if ((await tab.count()) === 0) {
    if (!surface.menu || !surface.item) throw new Error(`${surface.name} has no opening route`);
    await page.getByRole("button", { name: surface.menu, exact: true }).click();
    await page.getByRole("button", { name: surface.item, exact: true }).click();
    tab = tabFor(page, surface.tab);
  }
  await expect(tab, `${surface.name} tab`).toBeVisible();
  await tab.evaluate((element: HTMLElement) => element.click());
  const stack = tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
  const browser = stack.locator('[data-source-clock-browser="true"]:visible');
  await expect(browser, `${surface.name} source clock`).toHaveCount(1);
  await expect(browser).toContainText("global · revision bound", { timeout: 30_000 });
  return browser;
}

test("M5 all sixteen surfaces share one revision-bound bidirectional source clock", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto(`/dashboard?activeProject=bond-cop30-helsinki&workspace=default&analysis_id=${BOND_ID}`);
  await page.getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer_UK/ }).click();

  const opened: Array<{ surface: Surface; browser: Locator }> = [];
  for (const [index, surface] of SURFACES.entries()) {
    const browser = await ensureSurface(page, surface);
    const requested = 71 + index / 1000;
    await browser.getByLabel("Browse source time").fill(`1:11.${String(index).padStart(3, "0")}`);
    await browser.getByRole("button", { name: "Go", exact: true }).click();
    await expect(browser.locator('[data-source-clock-cursor="true"]')).toContainText(
      `1:11.${String(index).padStart(3, "0")}`,
    );
    await expect.poll(async () => {
      const values = await page.locator("video").evaluateAll((videos) =>
        videos.map((video) => (video as HTMLVideoElement).currentTime),
      );
      return values.some((value) => Math.abs(value - requested) < 0.1);
    }, { message: `${surface.name} must navigate the selected Bond source` }).toBe(true);
    opened.push({ surface, browser });
  }

  const videoClock = opened.find(({ surface }) => surface.name === "Video")!.browser;
  await videoClock.getByLabel("Browse source time").fill("1:12.000");
  await videoClock.getByRole("button", { name: "Go", exact: true }).click();

  for (const { surface, browser } of opened) {
    await expect(
      browser.locator('[data-source-clock-cursor="true"]'),
      `${surface.name} must receive Video's return navigation`,
    ).toContainText("1:12.000");
    await expect(browser).toContainText("global · revision bound");
  }
});
