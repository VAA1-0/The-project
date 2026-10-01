import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../lib/annotation-correction-merge.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(module,exports){${compiled}\n})(module,module.exports)`, { module });
const { mergeAnnotationCorrections } = module.exports;

test("two stale clients retain independent panel and BBox saves", () => {
  const base = { updated_at: "2026-08-05T10:00:00Z", text_substitutions: [], manual_visual_annotations: [] };
  const panelSave = { ...base, updated_at: "2026-08-05T10:00:01Z", text_substitutions: [{ id: "panel:1", corrected_value: "saved", updated_at: "2026-08-05T10:00:01Z" }] };
  const bboxFromStaleClient = { ...base, updated_at: "2026-08-05T10:00:02Z", manual_visual_annotations: [{ id: "bbox:1", label: "Character", updated_at: "2026-08-05T10:00:02Z" }] };
  const merged = mergeAnnotationCorrections(panelSave, bboxFromStaleClient);
  assert.equal([...merged.text_substitutions].map((item) => item.id).join(","), "panel:1");
  assert.equal([...merged.manual_visual_annotations].map((item) => item.id).join(","), "bbox:1");
});

test("newer edit wins for the same stable correction identity", () => {
  const existing = { text_substitutions: [{ id: "panel:1", corrected_value: "old", updated_at: "2026-08-05T10:00:01Z" }] };
  const incoming = { text_substitutions: [{ id: "panel:1", corrected_value: "new", updated_at: "2026-08-05T10:00:02Z" }] };
  assert.equal(mergeAnnotationCorrections(existing, incoming).text_substitutions[0].corrected_value, "new");
});

test("save service publishes canonical associated memory", () => {
  const service = readFileSync(new URL("../lib/video-service.ts", import.meta.url), "utf8");
  assert.match(service, /analysisCorrectionsChanged[\s\S]*?corrections: saved/);
  assert.match(service, /annotationCorrections: saved/);
});

test("local save route writes corrections through Master Schema review layer", () => {
  const route = readFileSync(
    new URL("../app/api/local-analysis/[analysisId]/download/[fileType]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /updateMasterSchemaCorrectionReviewLayer/);
  assert.match(route, /review_layer:[\s\S]*annotation_corrections: corrections/);
  assert.match(route, /dependent_projection: "master_schema_refreshed"/);
});
