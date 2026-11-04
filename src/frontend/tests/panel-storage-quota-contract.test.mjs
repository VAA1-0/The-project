import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";

const frontendRoot = new URL("..", import.meta.url);

test("panels and shared UI services do not write raw local storage", () => {
  const matches = execFileSync(
    "rg",
    [
      "-n",
      "(?:window\\.)?localStorage\\.setItem",
      "app/V2components",
      "lib",
      "--glob",
      "*.ts",
      "--glob",
      "*.tsx",
    ],
    { cwd: frontendRoot, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((line) => !line.startsWith("lib/browser-storage.ts:"));

  assert.deepEqual(matches, [], `Raw render-critical storage writes remain:\n${matches.join("\n")}`);
});

test("quota-safe storage preserves a tab fallback and memory terminal state", () => {
  const source = readFileSync(new URL("../lib/browser-storage.ts", import.meta.url), "utf8");
  assert.match(source, /window\.localStorage\.setItem/);
  assert.match(source, /window\.sessionStorage\.setItem/);
  assert.match(source, /return "memory"/);
  assert.match(source, /sessionStorage\.getItem[\s\S]*localStorage\.getItem/);
});
