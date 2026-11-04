import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/browser-storage.ts", import.meta.url), "utf8");
const module = { exports: {} };
new Function("exports", "module", ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(module.exports, module);

test("quota exhaustion falls back to session storage without throwing", () => {
  const session = new Map();
  global.window = {
    localStorage: {
      setItem() {
        const error = new Error("quota full");
        error.name = "QuotaExceededError";
        throw error;
      },
      getItem() { return null; },
    },
    sessionStorage: {
      setItem(key, value) { session.set(key, value); },
      getItem(key) { return session.get(key) ?? null; },
      removeItem(key) { session.delete(key); },
    },
  };

  assert.equal(module.exports.setBrowserStorageItem("navigation", "small-state"), "session");
  assert.equal(module.exports.getBrowserStorageItem("navigation"), "small-state");
  delete global.window;
});

