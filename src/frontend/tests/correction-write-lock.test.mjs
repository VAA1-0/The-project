import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const source = readFileSync(new URL("../lib/correction-write-lock.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { withSharedCorrectionLock } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const backend = fileURLToPath(new URL("../../backend/analysis", import.meta.url));
const python = process.env.VAA1_TEST_PYTHON || path.join(homedir(), "opt/anaconda3/envs/vaa1_core/bin/python");

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "datascene-lock-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function child(root, hold = false) {
  const code = `import sys\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nfrom correction_write_lock import correction_write_lock,CorrectionWriteBusy\ntry:\n with correction_write_lock(Path(sys.argv[2]),'analysis-a',.15):\n  print('acquired',flush=True)\n  ${hold ? 'sys.stdin.readline()' : 'pass'}\nexcept CorrectionWriteBusy:\n print('busy',flush=True)\n sys.exit(7)`;
  const proc = spawn(python, ["-c", code, backend, root], { stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  proc.stdout.on("data", value => { output += value; });
  const done = once(proc, "exit").then(([code]) => ({ code, output }));
  return { proc, done };
}

test("dashboard ownership excludes a backend writer until release", { timeout: 5000 }, async t => {
  const root = await fixture(t);
  await withSharedCorrectionLock(root, "analysis-a", async () => {
    assert.deepEqual(await child(root).done, { code: 7, output: "busy\n" });
  });
  assert.deepEqual(await child(root).done, { code: 0, output: "acquired\n" });
});

test("backend ownership excludes dashboard and releases on ordinary completion", { timeout: 5000 }, async t => {
  const root = await fixture(t);
  const held = child(root, true);
  t.after(() => held.proc.kill());
  await once(held.proc.stdout, "data");
  await assert.rejects(withSharedCorrectionLock(root, "analysis-a", async () => assert.fail("entered locked scope"), 100), /locked/);
  held.proc.stdin.end();
  assert.equal((await held.done).code, 0);
  assert.equal(await withSharedCorrectionLock(root, "analysis-a", async () => 42), 42);
});

test("exceptions release dashboard ownership without leaking locks", async t => {
  const root = await fixture(t);
  await assert.rejects(withSharedCorrectionLock(root, "analysis-a", async () => { throw new Error("fixture failure"); }), /fixture failure/);
  assert.equal(await withSharedCorrectionLock(root, "analysis-a", async () => "recovered"), "recovered");
  assert.deepEqual(await readdir(path.join(root, ".cache/correction-write-locks")), []);
});

test("a crashed process lock is recovered only after its owner is dead and grace has elapsed", { timeout: 5000 }, async t => {
  const root = await fixture(t);
  const held = child(root, true);
  t.after(() => held.proc.kill());
  await once(held.proc.stdout, "data");
  held.proc.kill("SIGKILL");
  await held.done;
  const folder = path.join(root, ".cache/correction-write-locks");
  const [name] = await readdir(folder);
  const ownerPath = path.join(folder, name, "owner.json");
  const owner = JSON.parse(await readFile(ownerPath, "utf8"));
  owner.created_at -= 120;
  await writeFile(ownerPath, JSON.stringify(owner));
  assert.equal(await withSharedCorrectionLock(root, "analysis-a", async () => "recovered", 100), "recovered");
  assert.deepEqual(await readdir(folder), []);
});

test("an old lock owned by a live process is never recovered", async t => {
  const root = await fixture(t);
  const key = (await import("node:crypto")).createHash("sha256").update("analysis-a").digest("hex");
  const lock = path.join(root, ".cache/correction-write-locks", `${key}.lock`);
  await mkdir(lock, { recursive: true });
  await writeFile(path.join(lock, "owner.json"), JSON.stringify({
    token: "live", pid: process.pid, analysis_id: "analysis-a", created_at: Date.now() / 1000 - 3600,
  }));
  await assert.rejects(withSharedCorrectionLock(root, "analysis-a", async () => assert.fail("entered live lock"), 100), /locked/);
});

test("different analyses can save concurrently", async t => {
  const root = await fixture(t);
  await withSharedCorrectionLock(root, "analysis-a", async () => {
    assert.equal(await withSharedCorrectionLock(root, "analysis-b", async () => 1, 50), 1);
  });
});
