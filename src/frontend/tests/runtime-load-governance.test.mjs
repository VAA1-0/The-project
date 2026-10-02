import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("source media URLs remain stable for browser range reuse", () => {
  const source = read("lib/api-service.ts");
  const localDownload = read("app/api/local-analysis/[analysisId]/download/[fileType]/route.ts");
  assert.match(
    source,
    /if \(fileType === "source_video"\)[\s\S]*?localAnalysisUrl\(analysisId, `\/download\/\$\{encodeURIComponent\(fileType\)\}`\)/,
  );
  assert.match(localDownload, /request\.headers\.get\("range"\)/);
  assert.match(localDownload, /"accept-ranges": "bytes"/);
  assert.match(localDownload, /status: 206/);
  assert.match(localDownload, /createCancelableFileStream\(filePath, start, end\)/);
  assert.match(localDownload, /async cancel\(\)[\s\S]*?cancelled = true[\s\S]*?await close\(\)/);
  assert.doesNotMatch(localDownload, /Readable\.toWeb|createReadStream/);
});

test("status and reusable artifacts coalesce concurrent reads", () => {
  const source = read("lib/api-service.ts");
  assert.match(source, /statusPromises\.get\(analysisId\)/);
  assert.match(source, /artifactPromises\.get\(cacheKey\)/);
  assert.match(source, /getStatusSummary\(analysisId/);
});

test("analysis opening stays on bounded metadata and releases the video shell first", () => {
  const api = read("lib/api-service.ts");
  const service = read("lib/video-service.ts");
  const videoPanel = read("app/V2components/components/panels/VideoPanel.tsx");
  const localRoute = read("app/api/local-analysis/[analysisId]/route.ts");

  assert.match(api, /AbortSignal\.timeout\(2_000\)/);
  assert.match(api, /localAnalysisUrl\(analysisId, "", \{ summary: "1" \}\)/);
  assert.match(api, /context_analysis_id: analysisId/);
  assert.match(api, /if \(projectId\) params\.set\("project_id", projectId\)/);
  assert.doesNotMatch(
    api.match(/async getStatusSummary[\s\S]*?async listForensicRenderJobs/)?.[0] || "",
    /this\.getStatus\(analysisId\)/,
  );
  assert.match(service, /getAnalysis[\s\S]*?getStatusSummary\(id\)/);
  assert.match(localRoute, /BOUNDED_RECORD_PREFIX_BYTES = 64 \* 1024/);
  const localDownloadRoute = read("app/api/local-analysis/[analysisId]/download/[fileType]/route.ts");
  assert.match(localDownloadRoute, /const directPaths: Record<string, string>/);
  assert.match(localDownloadRoute, /vaa1_annotation_master_schema/);
  assert.match(api, /api\/download\/\$\{analysisId\}\/\$\{fileType\}[\s\S]*?AbortSignal\.timeout\(2_000\)/);
  assert.match(service, /loadJsonArtifact\(id, "datascene_meaning_network"\)/);
  assert.match(
    videoPanel,
    /const mediaSource = await loadVideoSource\(videoId\)[\s\S]*?setVideoUrl\([\s\S]*?const nextAnalysis = await analysisPromise/,
  );
});

test("saved-analysis catalogue uses bounded local recovery and self-heals", () => {
  const api = read("lib/api-service.ts");
  const catalogueRoute = read("app/api/local-analyses/route.ts");
  const projectPanel = read("app/V2components/components/panels/ProjectPanel.tsx");

  assert.match(api, /api\/analyses\?limit=\$\{limit\}[\s\S]*?AbortSignal\.timeout\(15_000\)/);
  assert.match(catalogueRoute, /BOUNDED_RECORD_PREFIX_BYTES = \d+ \* 1024 \* 1024/);
  assert.match(catalogueRoute, /readBoundedRecord\(recordPath\)/);
  assert.doesNotMatch(catalogueRoute, /JSON\.parse\(await fs\.readFile\(recordPath/);
  assert.match(catalogueRoute, /Visual analysis incomplete/);
  assert.match(catalogueRoute, /info\.status === "completed" && requiredBranchError \? "error"/);
  assert.match(projectPanel, /if \(list\.length === 0\)[\s\S]*?setTimeout\(\(\) => void loadListSafe\(\), 10_000\)/);
  assert.match(projectPanel, /Bond, COP30 and Helsinki project/);
  assert.match(projectPanel, /Marcella project/);
  assert.match(projectPanel, /projectGroups\.map/);
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
  assert.doesNotMatch(sourceMedia, /<details[^>]*\sopen(?:\s|>)/);
  // Audio and StatsKit top-level media sections are DynamicPanelSections
  // (closed by default); nested record disclosures may remain open within them.
  for (const panel of [audio, stats]) {
    assert.match(panel, /<DynamicPanelSectionGroup/);
    assert.doesNotMatch(panel, /<DynamicPanelSection[^>]*\sdefaultOpen(?:\s|=|>)/);
  }
});

test("all local hydration fallbacks carry the active project and analysis context", () => {
  const api = read("lib/api-service.ts");
  assert.match(api, /function localAnalysisUrl\([\s\S]*?hermeneuticContextQuery\(analysisId\)/);
  assert.match(api, /context_analysis_id: analysisId/);
  assert.match(api, /project_id/);
  assert.match(api, /localAnalysisUrl\(analysisId, `\/download\/\$\{encodeURIComponent\(fileType\)\}`/);
  assert.match(api, /localAnalysisUrl\(analysisId, "\/download\/annotation_corrections"/);
  assert.match(api, /localAnalysisUrl\(analysisId, "\/source-media"\)/);
  assert.doesNotMatch(api, /`\/api\/local-analysis\/\$\{analysisId\}/);
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
