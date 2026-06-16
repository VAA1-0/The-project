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

const entityRegistrySchema = JSON.parse(
  readRepo("docs/schemas/vaa1.datascene_entity_registry.schema.json"),
);
const contentSearchSchema = JSON.parse(
  readRepo("docs/schemas/vaa1.datascene_content_search.schema.json"),
);
const operationalizationDoc = readRepo(
  "docs/vaa1_datascene_named_entity_regime_operationalization_2026-06-15.md",
);
const videoService = readFrontend("lib/video-service.ts");
const meaningPlotPanel = readFrontend(
  "app/V2components/components/panels/MeaningPlotPanel.tsx",
);
const sceneCardPanel = readFrontend(
  "app/V2components/components/panels/SceneCardPanel.tsx",
);
const sourceMediaMetadataPanel = readFrontend(
  "app/V2components/components/panels/SourceMediaMetadataPanel.tsx",
);
const dataMaturationPanel = readFrontend(
  "app/V2components/components/panels/DataMaturationPanel.tsx",
);
const apiServiceSource = readFrontend("lib/api-service.ts");
const searchPanel = readFrontend(
  "app/V2components/components/panels/SearchPanel.tsx",
);
const layoutHost = readFrontend("app/V2components/components/LayoutHost.tsx");
const menuBar = readFrontend("app/V2components/components/MenuBar.tsx");

test("Entity Registry schema uses Narrative Agent semantics and manual-wins governance", () => {
  assert.equal(entityRegistrySchema.schema_name, "vaa1.datascene_entity_registry.v1");
  assert.equal(entityRegistrySchema.version, "1.0.0");
  assert.equal(entityRegistrySchema.status, "operational_architecture_schema");

  for (const entityType of [
    "PERSON_NAME",
    "NARRATIVE_AGENT",
    "OBJECT",
    "VISUAL_SYMBOL",
    "AUDIO_ENTITY",
    "AUDIOVISUAL_NARRATIVE_AGENT",
    "LAW_POLICY",
    "COLLECTION_ENTITY",
  ]) {
    assert.equal(
      entityRegistrySchema.entity_types.includes(entityType),
      true,
      `${entityType} must remain an Entity Registry type`,
    );
  }

  assert.equal(
    entityRegistrySchema.entity_types.includes("CHARACTER"),
    false,
    "primary schema vocabulary must not drift back to character identity language",
  );
  assert.equal(
    entityRegistrySchema.entity_types.includes("AUDIOVISUAL_CHARACTER"),
    false,
    "audiovisual character remains a legacy alias, not the primary type",
  );

  assert.equal(entityRegistrySchema.authority_rules.manual_correction_wins, true);
  assert.equal(entityRegistrySchema.authority_rules.manual_confirmation_wins, true);
  assert.equal(
    entityRegistrySchema.authority_rules
      .track_identity_must_not_equal_narrative_agent_without_confirmation,
    true,
  );
  assert.equal(entityRegistrySchema.authority_rules.raw_detection_never_overrides_mature_entity, true);
});

test("Content Search schema covers multimodal sources while staying read-only", () => {
  for (const source of [
    "transcript",
    "ocr",
    "manual_annotations",
    "metadata",
    "object_detection",
    "audiovisual_narrative_agent_samples",
    "visual_sample_clouds",
    "audio_sample_clouds",
    "detected_pattern_entities",
    "motion_patterns",
    "scene_cards",
    "meaning_network",
    "master_schema",
  ]) {
    assert.equal(
      contentSearchSchema.source_switchboard[source],
      true,
      `${source} must remain enabled for governed content search`,
    );
  }

  assert.equal(
    contentSearchSchema.legacy_aliases.character_search,
    "narrative_agent_search",
  );
  assert.equal(
    contentSearchSchema.legacy_aliases.AUDIOVISUAL_CHARACTER,
    "AUDIOVISUAL_NARRATIVE_AGENT",
  );
  assert.equal(contentSearchSchema.search_modes.narrative_agent_search.enabled, true);
  assert.equal(contentSearchSchema.search_modes.pattern_search.enabled, true);
  assert.equal(contentSearchSchema.return_levels.pattern, "Return detected or mature pattern records.");
  assert.equal(contentSearchSchema.return_levels.forensic.includes("evidence"), true);

  assert.equal(contentSearchSchema.governance_rules.search_does_not_overwrite_data, true);
  assert.equal(
    contentSearchSchema.governance_rules
      .analysis_scoped_records_must_not_bleed_to_other_videos,
    true,
  );
  assert.equal(contentSearchSchema.som_open_topology_boundary.can_suggest, true);
  assert.equal(contentSearchSchema.som_open_topology_boundary.can_override_master_schema, false);
  assert.equal(
    contentSearchSchema.som_open_topology_boundary.can_mark_mature_without_decision,
    false,
  );

  for (const requiredOutput of [
    "candidate_id",
    "source_refs",
    "similarity_score",
    "cluster_context",
    "reason_for_match",
    "review_required",
    "blocked_actions",
  ]) {
    assert.equal(
      contentSearchSchema.som_open_topology_boundary.required_outputs.includes(
        requiredOutput,
      ),
      true,
      `SOM/open topology scanner output must include ${requiredOutput}`,
    );
  }
});

test("VideoService exposes operational Entity Registry and Content Search views", () => {
  assert.match(
    videoService,
    /entityRegistry\?:\s*DatasceneEntityRegistryView;/,
    "AnalysisData must expose the governed Entity Registry",
  );
  assert.match(
    videoService,
    /contentSearch\?:\s*DatasceneContentSearchView;/,
    "AnalysisData must expose the governed Content Search view",
  );
  assert.match(
    videoService,
    /function buildDatasceneEntityRegistryView/,
    "VideoService must build the Entity Registry view from analysis evidence",
  );
  assert.match(
    videoService,
    /function buildDatasceneContentSearchView/,
    "VideoService must build the Content Search view from Entity Registry evidence",
  );
  assert.match(
    videoService,
    /masterSchemaResolvedEvidence,\s*\n\s*\}\);\s*\n\s*const contentSearch = buildDatasceneContentSearchView\(\{/,
    "Content Search must be derived after Entity Registry so search stays source-linked",
  );
  assert.match(
    videoService,
    /entityRegistry\.entities\.flatMap/,
    "Content Search index records must derive from entity registry records",
  );
});

test("Runtime builders preserve Master-time, analysis scope, and manual authority", () => {
  assert.match(
    videoService,
    /schema:\s*"vaa1\.datascene_entity_registry\.v1"/,
    "Entity Registry runtime view must carry the schema id",
  );
  assert.match(
    videoService,
    /analysis_id:\s*resolvedAnalysisId/,
    "Entity Registry records must carry analysis scope",
  );
  assert.match(
    videoService,
    /start_time:\s*finiteNumber\(record\.start\)\s*\?\?\s*0/,
    "Master Schema records must keep Master-time start anchors",
  );
  assert.match(
    videoService,
    /end_time:\s*finiteNumber\(record\.end\)\s*\?\?\s*finiteNumber\(record\.start\)/,
    "Master Schema records must keep Master-time end anchors",
  );
  assert.match(
    videoService,
    /sourceIsManual\s*\?\s*"mature"\s*:\s*item\.displayLabel\s*\?\s*"candidate"\s*:\s*"raw"/,
    "raw object detection must remain raw/candidate while manual visual evidence becomes mature",
  );
  assert.match(
    videoService,
    /track_identity_must_not_equal_narrative_agent_without_confirmation:\s*true/,
    "runtime governance must block track id from becoming Narrative Agent identity by itself",
  );
  assert.match(
    videoService,
    /analysis_scoped_records_must_not_bleed_to_other_videos:\s*true/,
    "runtime governance must explicitly block cross-video bleed",
  );
  assert.match(
    videoService,
    /search_does_not_overwrite_data:\s*true/,
    "Content Search must remain a read/project/review layer",
  );
});

test("Entity Registry projects into governed panels without creating new truth islands", () => {
  assert.match(
    meaningPlotPanel,
    /function datasceneEntityToMeaningNode/,
    "Meaning Network must project Entity Registry records into graph nodes",
  );
  assert.match(
    meaningPlotPanel,
    /analysisData\?\.entityRegistry\?\.entities/,
    "Meaning Network must consume analysis-scoped Entity Registry records",
  );
  assert.match(
    sceneCardPanel,
    /analysisData\?\.entityRegistry\?\.entities/,
    "Scene Cards must harvest entity evidence from Entity Registry",
  );
  assert.match(
    sceneCardPanel,
    /category:\s*[\s\S]*"persons"[\s\S]*"places"[\s\S]*"props"[\s\S]*"events"[\s\S]*"themes"/,
    "Scene Cards must map entities into existing scene-card categories instead of adding fields",
  );
  assert.match(
    sourceMediaMetadataPanel,
    /function entityRegistryMetadataCandidateRows/,
    "Source Media must harvest entity evidence into existing metadata candidate rows",
  );
  assert.match(
    sourceMediaMetadataPanel,
    /entity_registry\.source_media_metadata_harvest/,
    "Source Media entity harvesting must remain traceable candidate support",
  );
  assert.match(
    dataMaturationPanel,
    /scannerReadySearchRecords/,
    "Data Maturation must count search/scanner candidates as review pressure, not mature truth",
  );
  assert.match(
    dataMaturationPanel,
    /SOM \/ scanner support/,
    "Data Maturation must expose SOM/open-topology support status",
  );
});

test("Datascene Search panel reads Content Search without mutating governed data", () => {
  assert.match(
    searchPanel,
    /analysisData\.contentSearch\?\.search_index_records/,
    "Search UI must read the governed Content Search index",
  );
  assert.match(
    searchPanel,
    /openVideoAtTime\(row\.analysisId,\s*record\.start_time\)/,
    "Search results must navigate through source-linked Master-time anchors",
  );
  assert.match(
    searchPanel,
    /record\.maturity_summary\.requires_review/,
    "Search results must expose review state instead of treating candidates as truth",
  );
  assert.doesNotMatch(
    searchPanel,
    /updateAnnotationCorrections|saveAnnotationCorrections|upsertMasterSchema/,
    "Search UI must remain read-only for the first governed release",
  );
  assert.match(
    layoutHost,
    /import SearchPanel/,
    "LayoutHost must register the Datascene Search panel",
  );
  assert.match(
    menuBar,
    /openPanel\("Search"/,
    "MenuBar must expose the Datascene Search panel",
  );
});

test("saved-analysis local fallback does not break Save Analysis or Save Project", () => {
  assert.match(
    apiServiceSource,
    /\/api\/local-analysis\/\$\{analysisId\}\/bundle/,
    "Save Analysis must have a local bundle fallback for surfaced saved analyses",
  );
  assert.match(
    apiServiceSource,
    /\/api\/local-project-bundle/,
    "Save Project must have a local project bundle fallback for surfaced saved analyses",
  );
  assert.doesNotMatch(
    apiServiceSource,
    /downloadUrl\(this\.getBundleDownloadUrl\(analysisId\)/,
    "Save Analysis must not bypass fallback/error handling with a direct backend-only anchor",
  );
});

test("operationalization doc places search above registry and keeps scanner diagnostic", () => {
  assert.match(
    operationalizationDoc,
    /Content Search sits above (the Entity Registry|that registry)/,
  );
  assert.match(
    operationalizationDoc,
    /SOM \/ Open Topology Scanner Boundary|SOM\/open topology/,
  );
  assert.match(
    operationalizationDoc,
    /must not:[\s\S]*override Master Schema/,
  );
});
