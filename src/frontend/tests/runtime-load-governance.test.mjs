import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("source media URLs remain stable for browser range reuse", () => {
  const source = read("lib/api-service.ts");
  assert.match(
    source,
    /if \(fileType === "source_video"\)[\s\S]*?api\/download\/\$\{analysisId\}\/\$\{fileType\}`/,
  );
});

test("status and reusable artifacts coalesce concurrent reads", () => {
  const source = read("lib/api-service.ts");
  assert.match(source, /statusPromises\.get\(analysisId\)/);
  assert.match(source, /artifactPromises\.get\(cacheKey\)/);
  assert.match(source, /getStatusSummary\(analysisId/);
});

test("hidden GoldenLayout tabs defer analytical panel initialization", () => {
  const source = read("lib/golden-layout-lib/ReactComponentWrapper.tsx");
  assert.match(source, /container\.on\("show", mount\)/);
  assert.match(source, /if \(container\.visible && !container\.isHidden\) mount\(\)/);
});

test("idle precompute is bounded, ordered, and activity interruptible", () => {
  const source = read("lib/idle-precompute.ts");
  assert.match(source, /const HIGH_VALUE_ARTIFACTS = \[/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /pointerdown/);
  assert.match(source, /running = true/);
  assert.match(source, /tasksFor\(analysisId\)\.find/);
  assert.doesNotMatch(source, /proliferation\/refresh/);
});

test("every GoldenLayout leaf receives the calm universal panel language", () => {
  const wrapper = read("lib/golden-layout-lib/ReactComponentWrapper.tsx");
  const styles = read("styles/globals.css");
  assert.match(wrapper, /this\.el\.className = "vaa1-panel-leaf"/);
  assert.match(styles, /--vaa1-leaf-surface: #222222/);
  assert.match(styles, /--vaa1-leaf-header: #141414/);
  assert.match(styles, /--vaa1-leaf-expanded: #151515/);
  assert.match(styles, /--vaa1-leaf-subtle: #171717/);
  assert.match(styles, /--vaa1-leaf-border: rgba\(255, 255, 255, 0\.08\)/);
  assert.match(styles, /\.vaa1-panel-leaf \.uppercase \{\s*letter-spacing: 0\.14em/);
  assert.match(styles, /\.vaa1-panel-leaf summary/);
  assert.match(styles, /\.vaa1-panel-leaf select/);
  assert.match(styles, /\.vaa1-panel-leaf > \* \{\s*background-color: var\(--vaa1-leaf-surface\)/);
  assert.match(styles, /details:not\(\[open\]\) > summary > div:first-child > :not\(:first-child\)/);
  assert.match(styles, /\.vaa1-panel-leaf \[class\*="overflow-y-auto"\][\s\S]*?background-color: var\(--vaa1-leaf-surface\) !important/);
});

test("reference analytical disclosures begin collapsed", () => {
  const pos = read("app/V2components/components/panels/POSAnalyzePanel.tsx");
  const quant = read("app/V2components/components/panels/QuantitativeAnalysisPanel.tsx");
  const transcript = read("app/V2components/components/panels/SpeechToTextPanel.tsx");
  const audio = read("app/V2components/components/panels/AudioPanel.tsx");
  const sourceMedia = read("app/V2components/components/panels/SourceMediaMetadataPanel.tsx");
  const stats = read("app/V2components/components/panels/StatsKitPanel.tsx");
  assert.doesNotMatch(pos, /const \[show(?:PosCounts|PosRatios|GrammarFeatures|CaseProfile|Interrogatives|TenseProfile|PosWords)[^\n]*useState\(true\)/);
  assert.doesNotMatch(quant, /const \[show(?:BuildTokenStream|TfidfTopTerms|Bigrams|SentenceTagging|Concordance)[^\n]*useState\(true\)/);
  assert.match(transcript, /const \[showSummary, setShowSummary\] = useState\(false\)/);
  for (const panel of [audio, sourceMedia, stats]) {
    assert.doesNotMatch(panel, /<details[^>]*\sopen(?:\s|>)/);
  }
});

test("dense evidence feeds and schema workspaces collapse at the record or section boundary", () => {
  const objects = read("app/V2components/components/panels/OBJDetectionPanel.tsx");
  const ocr = read("app/V2components/components/panels/OCRPanel.tsx");
  const expressions = read("app/V2components/components/panels/ExpressionPanel.tsx");
  const schema = read("app/V2components/components/panels/MasterSchemaPanel.tsx");
  const scenes = read("app/V2components/components/panels/SceneCardPanel.tsx");
  const tools = read("app/V2components/components/panels/ToolsPanel.tsx");

  assert.match(objects, /groupedObjects\.map[\s\S]*?<details/);
  assert.match(ocr, /displayedOCRResults\.map[\s\S]*?<details/);
  assert.match(expressions, /expressionResults\.map[\s\S]*?<details/);
  assert.doesNotMatch(schema, /title="(?:Choose Character|StatsKit \+ Significance \+ Relevance|Recommended Next Steps)"[\s\S]{0,180}?defaultOpen/);
  assert.match(schema, /title="Suggested labels"/);
  assert.match(scenes, /<div[^>]*>[\s\S]*?Scene account[\s\S]*?<p className="text-sm leading-6/);
  assert.match(scenes, /<summary[^>]*>[\s\S]*?Scene attributes/);
  assert.match(scenes, /Said in scene · \{matureSpeech\.length\}/);
  assert.match(tools, /Analysis and morphology setup/);
});

test("lazy Audio selection and final support panels follow the disclosure contract", () => {
  const eventBus = read("lib/golden-layout-lib/eventBus.ts");
  const audio = read("app/V2components/components/panels/AudioPanel.tsx");
  const sourceMedia = read("app/V2components/components/panels/SourceMediaMetadataPanel.tsx");
  const tools = read("app/V2components/components/panels/ToolsPanel.tsx");

  assert.match(eventBus, /private latest = new Map/);
  assert.match(eventBus, /getLast<T>\(event: string\)/);
  assert.match(audio, /eventBus\.getLast<string>\("videoIdChanged"\)/);
  assert.match(audio, /eventBus\.on\("videoIdChanged", handler\)/);
  assert.match(sourceMedia, /<details[^>]*>[\s\S]*?<summary[^>]*>[\s\S]*?Primary metadata/);
  assert.match(tools, /<span[^>]*>Tools<\/span>[\s\S]*?<Select[\s\S]*?workspaceOptions\.map/);
  assert.doesNotMatch(tools, /workspaceOptions\.find\(\(item\) => item\.key === activeWorkspace\)/);
  assert.match(
    tools,
    /AI Agent processes[\s\S]*?Analysis setup[\s\S]*?Annotation workspace[\s\S]*?Expression records[\s\S]*?Face records[\s\S]*?Forensic render[\s\S]*?Language records[\s\S]*?Mission records[\s\S]*?Morphology catalog[\s\S]*?Visual cues/,
  );
});
