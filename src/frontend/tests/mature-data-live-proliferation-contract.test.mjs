import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const frontendRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(import.meta.dirname, "../../..");

function readFrontend(relativePath) {
  return readFileSync(resolve(frontendRoot, relativePath), "utf8");
}

function readRepo(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

const busSource = readRepo("src/backend/analysis/live_mature_data_proliferation_bus.py");
const apiServer = readRepo("api_server.py");
const videoService = readFrontend("lib/video-service.ts");
const apiService = readFrontend("lib/api-service.ts");
const dataMaturationPanel = readFrontend(
  "app/V2components/components/panels/DataMaturationPanel.tsx",
);

test("live mature-data bus creates governed hypotheses without promoting candidates", () => {
  assert.match(
    busSource,
    /def build_governed_mature_hypotheses/,
    "backend must create first-class governed hypothesis records",
  );
  assert.match(
    busSource,
    /"authority_class":\s*"governed_mature_hypothesis"/,
    "hypotheses must use the governed mature authority class",
  );
  assert.match(
    busSource,
    /"maturity_projection_state":\s*"review_visible_not_mature"/,
    "automatic projections must stay visibly review-only",
  );
  assert.match(
    busSource,
    /"can_override_manual_authority":\s*False/,
    "automatic projections must never override manual authority",
  );
  assert.match(
    busSource,
    /"promotion_requires_decision":\s*True/,
    "promotion must remain ledger-gated",
  );
  assert.match(
    busSource,
    /"governed_mature_hypotheses":\s*governed_hypotheses/,
    "audit payload must expose the generated hypotheses",
  );
  assert.match(
    busSource,
    /collect_content_derived_mature_observations/,
    "source metadata and scene cards must feed confidence-rated mature observations",
  );
  assert.match(
    busSource,
    /collect_genre_rule_observations/,
    "genre-specific knowns must feed the live bus",
  );
  assert.match(
    busSource,
    /entity_match_candidates/,
    "entity matches must surface as proliferation bus candidates",
  );
  assert.match(
    busSource,
    /news_lower_third_ocr_entities_are_on_screen/,
    "news lower-third OCR rule must be encoded as an actual cascade rule",
  );
  assert.match(
    busSource,
    /apply_proliferation_decision_suppression/,
    "live bus must honor manual candidate and cluster cancellation decisions",
  );
  assert.match(
    busSource,
    /cluster_canceled_by_analyst/,
    "whole confirmable clusters must be droppable by analyst decision",
  );
  assert.match(
    busSource,
    /candidate_canceled_by_analyst/,
    "individual automatically proliferated candidates must be droppable",
  );
});

test("status and VideoService expose the live proliferation summary to panels", () => {
  assert.match(
    apiServer,
    /governed_mature_hypotheses_preview/,
    "API status must include a bounded governed hypothesis preview",
  );
  assert.match(
    apiServer,
    /genre_rule_observations_preview/,
    "API status must include a bounded genre-rule observation preview",
  );
  assert.match(
    apiServer,
    /proposed_audiovisual_samples_preview/,
    "API status must include proposed audiovisual sample anchors",
  );
  assert.match(
    apiServer,
    /suppressed_candidate_opportunities_preview/,
    "API status must include suppressed candidate opportunities for audit visibility",
  );
  assert.match(
    apiServer,
    /governed_mature_hypothesis_count/,
    "old saved analyses must be regenerated if they lack governed hypothesis counts",
  );
  assert.match(
    apiService,
    /live_mature_data_proliferation_audit\?:\s*Record<string, unknown>\s*\|\s*null/,
    "low-level API status type must expose the live bus audit summary",
  );
  assert.match(
    videoService,
    /liveMatureDataProliferationAudit\?:\s*Record<string, unknown>\s*\|\s*null/,
    "AnalysisData must expose the live bus audit summary",
  );
  assert.match(
    videoService,
    /liveMatureDataProliferationAudit:\s*\n\s*status\.live_mature_data_proliferation_audit\s*\|\|\s*null/,
    "VideoService must map backend snake_case audit into panel-friendly camelCase data",
  );
});

test("Data Maturation panel treats governed hypotheses as review pressure, not mature writes", () => {
  assert.match(
    dataMaturationPanel,
    /governedMatureHypotheses/,
    "panel must count governed hypotheses explicitly",
  );
  assert.match(
    dataMaturationPanel,
    /MetricCard label="Governed hypotheses"/,
    "panel must surface the automatic governed layer",
  );
  assert.match(
    dataMaturationPanel,
    /automatic review projections/,
    "panel copy must name automatic review projection behavior",
  );
  assert.match(
    dataMaturationPanel,
    /Content-derived mature/,
    "panel must surface confidence-rated content-derived mature observations",
  );
  assert.match(
    dataMaturationPanel,
    /Genre-specific knowns/,
    "panel must surface genre-specific cascade rules",
  );
  assert.match(
    dataMaturationPanel,
    /proposedAudiovisualSamples/,
    "panel must surface proposed audiovisual sample anchors",
  );
  assert.match(
    dataMaturationPanel,
    /persistProliferationDrop/,
    "panel must let analysts drop automatically proliferated candidates through the decision ledger",
  );
  assert.match(
    dataMaturationPanel,
    /Drop cluster/,
    "panel must let analysts drop a whole off-target confirmable cluster",
  );
  assert.match(
    dataMaturationPanel,
    /matureWriteCount =\s*\n\s*matureSurfaces \+/,
    "governed hypotheses must not be counted as mature writes",
  );
  assert.match(
    dataMaturationPanel,
    /Review pressure" value=\{metrics\.agentPersistence\.review \+ metrics\.rejectedDecisions \+ metrics\.governedMatureHypotheses\}/,
    "governed hypotheses should increase review pressure",
  );
});
