import { expect, test } from "@playwright/test";

const BOND_ID = "8183c1fd-7cb9-49d0-b20c-378399e9c41f";
const MARCELLA_ID = "c034341f-3fba-495e-a7d1-0af03a46cb6c";
const BACKEND = "http://127.0.0.1:8000";
const boundLocal = (path: string, analysisId = BOND_ID) =>
  `${path}${path.includes("?") ? "&" : "?"}project_id=bond-cop30-helsinki&context_analysis_id=${analysisId}`;

test("restored projects remain separate and Bond data surfaces through governed routes", async ({ page, request }) => {
  test.setTimeout(120_000);
  const catalogueResponse = await request.get(`${BACKEND}/api/analyses?limit=100`);
  expect(catalogueResponse.ok()).toBeTruthy();
  const catalogue = await catalogueResponse.json();
  const rows = Object.entries(catalogue.analyses || {}) as Array<[string, any]>;
  const bondProject = rows.filter(([, row]) => row.project_id === "bond-cop30-helsinki");
  const marcellaProject = rows.filter(([, row]) => row.project_id === "research-test-2026");

  expect(bondProject).toHaveLength(5);
  expect(marcellaProject).toHaveLength(7);
  expect(bondProject.every(([, row]) => !/Marcella/i.test(row.filename || ""))).toBeTruthy();
  expect(marcellaProject.every(([, row]) => /Marcella/i.test(row.filename || ""))).toBeTruthy();
  expect(bondProject.map(([, row]) => row.filename)).toEqual(expect.arrayContaining([
    "NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264.mp4",
    "Diamonds_Are_Forever_1971_James_Bond.mp4",
    "brazil_complete.mp4",
    "english_brazil_short.mp4",
    "vaa1_working_checkpoint_2026-03-25.mp4",
  ]));

  for (const [analysisId] of bondProject) {
    const source = await request.get(boundLocal(`/api/local-analysis/${analysisId}/download/source_video`, analysisId), {
      headers: { range: "bytes=0-1023" },
    });
    expect([200, 206]).toContain(source.status());
  }

  const requiredArtifacts = [
    "transcript", "linked_transcript", "pos_analysis", "quan_analysis",
    "audio_prosody", "audio_diarization", "time_bank_audio",
    "tracked_objects_json", "ocr_csv", "expression_json",
    "vaa1_annotation_master_schema", "mise_en_scene_scene_cards",
    "narrative_lens_reading", "datascene_meaning_network",
    "native_statistical_interpretation", "annotation_corrections",
  ];
  for (const artifact of requiredArtifacts) {
    const response = await request.get(boundLocal(`/api/local-analysis/${BOND_ID}/download/${artifact}`));
    expect(response.ok(), `${artifact} must surface`).toBeTruthy();
    expect((await response.body()).length, `${artifact} must contain data`).toBeGreaterThan(2);
  }

  const transcript = await (await request.get(boundLocal(`/api/local-analysis/${BOND_ID}/download/transcript`))).json();
  expect(transcript.transcription_strategy).toBe("original_whisper_timecode");
  expect(transcript.segments).toHaveLength(35);
  expect(transcript.segments[0]).toMatchObject({
    start: 6.28,
    end: 7.6,
    timing_authority: "original_whisper_timecode",
    text: "Why would I betray you?",
  });

  await page.goto("/dashboard?catalogue=projects-20260831");
  await expect(page.locator(".lm_goldenlayout")).toBeVisible();
  await expect(page.getByText("Bond, COP30 and Helsinki project")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Marcella project")).toBeVisible();
  await expect(page.getByText("NO_TIME_TO_DIE_Trailer_UK", { exact: false })).toBeVisible();
  await expect(page.locator(".lm_tab").filter({ hasText: "Transcript" })).toHaveCount(1);
  await expect(page.locator(".lm_tab").filter({ hasText: "Scene Cards" })).toHaveCount(1);
  await expect(page.locator(".lm_tab").filter({ hasText: "Master Schema" })).toHaveCount(1);
  await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);
  await expect(page.getByText("Console Error")).toHaveCount(0);
});

test("ordinary dashboard loads only the active Bond, COP30 and Helsinki project", async ({ page }) => {
  const relevantConsoleErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /same key|Local status summary unavailable/i.test(message.text())
    ) {
      relevantConsoleErrors.push(message.text());
    }
  });
  await page.goto("/dashboard");
  await expect(page.getByText("Bond, COP30 and Helsinki project")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Marcella project")).toHaveCount(0);
  await expect(page.getByText("source clock acceptance", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Select video/ })).toHaveCount(5);
  await page.waitForTimeout(750);
  expect(relevantConsoleErrors).toEqual([]);
});

test("Bond workspace rejects a foreign Marcella analysis before artifact hydration", async ({ page }) => {
  const foreignArtifactRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(`/api/local-analysis/${MARCELLA_ID}`)) {
      foreignArtifactRequests.push(request.url());
    }
  });

  await page.goto(
    `/dashboard?activeProject=bond-cop30-helsinki&workspace=default&analysis_id=${MARCELLA_ID}`,
  );
  await expect(page.getByText("Bond, COP30 and Helsinki project")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("PROJECT BOUNDARY VIOLATION — foreign analysis blocked.", { exact: true })).toBeVisible();
  await expect(page.getByText("Marcella project")).toHaveCount(0);
  await page.waitForTimeout(750);
  expect(foreignArtifactRequests).toEqual([]);
});

test("local analysis routes enforce project and analysis entity context", async ({ request }) => {
  const valid = await request.get(
    boundLocal(`/api/local-analysis/${BOND_ID}/download/transcript`),
  );
  expect(valid.ok()).toBeTruthy();

  const foreign = await request.get(
    `/api/local-analysis/${MARCELLA_ID}/download/transcript?project_id=bond-cop30-helsinki&context_analysis_id=${MARCELLA_ID}`,
  );
  expect(foreign.status()).toBe(403);
  await expect(foreign.json()).resolves.toMatchObject({
    code: "PROJECT_MEMBERSHIP_MISMATCH",
    boundary: "project_analysis_entity",
  });

  const mismatchedAnalysis = await request.get(
    `/api/local-analysis/${BOND_ID}/download/transcript?project_id=bond-cop30-helsinki&context_analysis_id=${MARCELLA_ID}`,
  );
  expect(mismatchedAnalysis.status()).toBe(409);
  await expect(mismatchedAnalysis.json()).resolves.toMatchObject({
    code: "ANALYSIS_CONTEXT_MISMATCH",
  });

  const contextFree = await request.get(
    `/api/local-analysis/${BOND_ID}/download/transcript`,
    { headers: { referer: "" } },
  );
  expect(contextFree.status()).toBe(428);
  await expect(contextFree.json()).resolves.toMatchObject({
    code: "PROJECT_CONTEXT_REQUIRED",
  });
});
