# VAA1 Latest Delivery Note: Entity Registry, Content Search, And Maturation Support

Date: 2026-06-16

Purpose: record the latest practical deliveries before pushing, with their intended use principles made explicit.

## Delivery Summary

The latest sprint slice operationalizes the Datascene/VAA1 named entity and content search regime as governed runtime surfaces rather than loose schema promises.

Delivered layers:

- Datascene Entity Registry runtime view.
- Datascene Content Search runtime view.
- Entity Registry projection into Meaning Network.
- Entity harvesting into Scene Cards using existing fields only.
- Entity harvesting into Source Media / Metadata using existing candidate fields only.
- Mature Data Proliferation readiness metrics in the Data Maturation panel.
- Contract tests proving source scope, authority principles, search read-only behavior, and cross-panel projection.

## Core Principle

Confirmed analyst evidence and mature governed records are authority-bearing. Machine detections, scanner matches, and search hits may support review, but they must not silently rewrite mature data or override manual correction.

This preserves the VAA1 rule:

```text
Manual authority wins.
Candidate evidence supports.
Raw detections remain traceback substrate.
Search finds and explains; it does not mutate truth.
```

## Entity Registry Use

The Entity Registry now gathers named and pattern-like entities from governed sources into one analysis-scoped view.

Primary sources include:

- Master Schema resolved evidence.
- Manual native annotations.
- Object detections and labels.
- Transcript mentions.
- OCR mentions.
- Source samples.
- Source media metadata.

The registry is intended to help VAA1 ask: what entities are present, where did they come from, what authority do they carry, and which panels may consume them?

It is not intended to create a new uncontrolled identity layer.

## Content Search Use

Content Search now has a source-linked index substrate derived from Entity Registry mentions.

Intended uses:

- Find scenes, segments, entities, or evidence chains across transcript, OCR, objects, metadata, manual annotations, audiovisual samples, scene cards, and meaning structures.
- Return results with evidence references, maturity status, confidence, and jump targets.
- Support explicit analyst confirmations.
- Support implicit analyst confidence only through governed maturity and source evidence, not by guessing authority.

Content Search is read-only by design. It may surface review candidates, but it does not write mature labels by itself.

## Meaning Network Use

Entity Registry records now project into the Meaning Network as governed nodes.

Principle use:

- Make named entities visible in the interpretive graph.
- Preserve source references and Master time.
- Allow entity evidence to participate in network navigation and review.
- Keep Narrative Agent semantics separate from casual character-label drift.

The Meaning Network receives entity records as meaning-bearing nodes, not as automatic final claims.

## Scene Card Use

Scene Cards now harvest Entity Registry records into existing fields only.

No new Scene Card fields were added.

Harvesting routes:

- Narrative/person entities -> existing person-oriented scene-card items.
- Places -> existing place items.
- Objects and visual symbols -> existing prop/object items.
- Audio events and event-like entities -> existing event items.
- Concepts and other interpretive entities -> existing theme items.

This keeps Scene Cards useful for discovery while avoiding schema sprawl.

## Source Media / Metadata Use

Source Media / Metadata follows the same design principle as Scene Cards: entities are routed into existing metadata candidate fields only.

No new metadata fields were added.

Harvesting routes:

- Person entities -> existing `persons` candidate field.
- Narrative Agent and audiovisual character entities -> existing `character_roles` candidate field.
- Place entities -> existing `location_place` and `keywords`.
- Event entities -> existing `situation_event` and `keywords`.
- Object, concept, law/policy, audio, visual symbol, and collection entities -> existing `keywords`.
- Source-media-backed entities -> existing `source_context` when appropriate.

The metadata panel presents these as reviewable maturity candidates. Analysts still decide whether to use, fill blanks, or save.

## SOM / Open Topology Scanner Use

The audiovisual sample scanner / matcher / SOM open topology layer is treated as diagnostic candidate support.

Principle use:

- Surface similar audiovisual patterns.
- Support Mature Data Proliferation candidate discovery.
- Help analysts find likely related occurrences.
- Provide review pressure and evidence clusters.

It must not automatically mature, overwrite, or proliferate labels without governed confirmation.

## Mature Data Proliferation Use

This delivery improves Mature Data Proliferation by giving the system more governed candidate substrate:

- Named entities can be gathered across modalities.
- Search can expose source-linked evidence chains.
- Meaning Network can consume entity nodes.
- Scene Cards and Metadata can receive candidate support without schema changes.
- Data Maturation can show whether scanner/search/entity support is ready for review.

The regime becomes more dynamic without becoming careless.

## Guardrails

The delivery keeps these constraints:

- Analysis scope must prevent bleed between videos.
- Manual corrections and mature records outrank raw detections.
- Track identity does not equal Narrative Agent identity without confirmation.
- Search and scanner layers do not write mature truth directly.
- Existing panel schemas should be harvested into before new fields are introduced.
- Traceback and evidence refs must remain available for every promoted claim.

## Verification

Verified checks:

```bash
cd src/frontend && npm test -- --runTestsByPath tests/datascene-entity-search-contract.test.mjs tests/manual-annotation-governance.test.mjs tests/mature-data-proliferation-feedback-loop.test.mjs
cd src/frontend && npx tsc --noEmit
git diff --check
```

Result:

- 73 frontend contract tests passing.
- TypeScript clean.
- Diff whitespace check clean.

## Recommended Next Step

Before broader implementation, manually smoke-test one saved analysis and verify:

- Entity Registry records appear in Meaning Network.
- Scene Cards receive entity support in existing fields.
- Source Media / Metadata shows entity-derived candidate rows without adding fields.
- Data Maturation shows entity/search/scanner readiness.
- No Diamonds / No Time To Die cross-video bleed appears.
- Search and scanner results remain review candidates until analyst confirmation.
