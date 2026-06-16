# Datascene Named Entity Regime Operationalization

Date: 2026-06-15

Purpose: operationalize the named entity regime as a governed Datascene/VAA1 layer without weakening the existing Narrative Agent, Master Schema, manual authority, and mature-data proliferation principles.

## Executive Answer

Yes, this should be operationalized.

The correct shape is a broad Entity Registry that sits under Master Schema governance. It should unify named entities from transcript, OCR, metadata, analyst annotations, object detections, audio sample clouds, visual sample clouds, and audiovisual Narrative Agent samples.

This should not replace Narrative Agent Profile semantics. It should give VAA1 a general entity substrate where Narrative Agents are one entity family among many.

The companion operational layer is Datascene Content Search. Search consumes governed entity, pattern, scene, transcript, OCR, object, metadata, sample-cloud, Meaning Network, and Master Schema evidence. It does not create truth; it returns ranked, source-linked, maturity-aware, traceable results.

## Naming And Governance Boundary

Use entity language for the general registry:

- organization
- place
- event
- date
- law or policy
- concept
- object
- visual symbol
- audio entity
- collection entity
- source-media entity

Use Narrative Agent language for represented people and characters inside audiovisual material:

- Narrative Agent
- audiovisual Narrative Agent sample
- Narrative Agent profile
- Narrative Agent appearance
- Narrative Agent presence interval

Avoid analyst-facing natural-person identity framing unless the source artifact explicitly requires it and the user has chosen that regime.

## Why This Matters

The current Mature Data Proliferation work has mainly strengthened BBox, Narrative Agent, Meaning Network, Master Schema, and manual presence intervals. The named entity regime widens the same principle to the rest of the media artifact.

That means these can become governed, searchable, traceable, and proliferatable:

- James Bond as a Narrative Agent.
- Nomi as an audiovisual Narrative Agent.
- National Library of Finland as an organization.
- AI Act as a law or policy.
- a flag as a visual symbol.
- microphone as an object.
- a recurring speaker voice as an audio entity.
- an OCR slide title as a text-derived entity.
- a filename, title card, collection name, or archive description as source-media metadata.

## Operational Architecture

The Entity Registry should be built as a Master Schema governed projection, not as a separate truth silo.

```text
raw sources
-> entity mention extraction
-> canonical entity registry
-> maturity and authority scoring
-> Master Schema registration
-> search index records
-> Meaning Network nodes and edges
-> Scene Cards and Narrative Agent panels
-> forensic traceback and exports
```

Content Search sits above that registry:

```text
entity registry + pattern registry + Master Schema + scene cards + Meaning Network
-> search index records
-> keyword/entity/object/Narrative Agent/pattern/semantic/multimodal/forensic queries
-> ranked source-linked results
-> jump, card, traceback, forensic render, export, or promotion-review actions
```

## Entity Mention Sources

The first operational pass should normalize mentions from:

- Transcript: names, places, organizations, laws, events, concepts.
- OCR: visible text, signs, titles, captions, document fragments, logos with text.
- Manual annotations: BBox/ROI labels, scene labels, Narrative Agent labels, relationship notes.
- Metadata: title, creator, date, keywords, archive collection, location, source-media metadata.
- Object detection: persons, cars, buildings, weapons, flags, microphones, documents, and other visual classes.
- Visual sample clouds: reusable visual evidence for subjects, objects, places, and symbols.
- Audio sample clouds: speaker, voice, soundmark, music cue, and recurring audio evidence.
- Audiovisual Narrative Agent samples: consolidated face, body, voice, transcript, OCR, metadata, and manual evidence for a represented agent.

## Maturity States

Use a simple common maturity model:

- `raw`: unprocessed or weak machine output.
- `candidate`: possible entity requiring review.
- `corroborated`: supported by multiple evidence sources.
- `mature`: confirmed by manual authority or strong governance rule.
- `rejected`: reviewed and marked false.
- `superseded`: replaced by better entity identity or evidence.

This maps cleanly into the existing Mature Data Proliferation model:

- raw substrate stays traceable.
- candidate is not promotion.
- corroborated can become governed hypothesis.
- mature can project broadly.
- rejected and superseded remain in traceback, not active panels.

## Authority Rules

The entity regime must inherit the existing authority rules:

- Manual correction wins.
- Manual confirmation wins.
- Manual rejection blocks projection.
- Raw detection never overrides mature data.
- Track id is not a Narrative Agent identity.
- New scene requires new evidence.
- Cross-scene relabeling requires evidence.
- Candidate proliferation is allowed only with visible status, traceback, and blocked overwrite actions.

## First Delivery Slice

Recommended first implementation:

1. Add `docs/schemas/vaa1.datascene_entity_registry.schema.json` as the canonical architecture schema.
2. Add `docs/schemas/vaa1.datascene_content_search.schema.json` as the search layer above the Entity Registry.
3. Add a backend/frontend contract helper that builds an `entityRegistry` view from current analysis data:
   - transcript timeline
   - OCR rows
   - manual visual annotations
   - metadata source media annotations
   - detected objects
   - source samples
   - visual and audio sample clouds
   - Narrative Agent profiles
4. Attach `analysis_id` to every entity and mention.
5. Attach `source_mentions`, `traceback_refs`, `maturity`, `authority_status`, and `proliferation_policy`.
6. Project the registry into:
   - Master Schema Subject Authority
   - Meaning Network
   - Scene Cards
   - Search index
   - forensic traceback/export records
7. Add tests that prove:
   - manual entity correction outranks OCR/transcript/object detections
   - entity records do not bleed across videos
   - Narrative Agent entities keep Narrative Agent language
   - object detections become entity evidence but cannot become mature labels alone
   - search records preserve source time and traceback

## Datascene Content Search Layer

The Content Search layer should expose:

- source switchboard: transcript, OCR, manual annotations, metadata, object detection, audiovisual Narrative Agent samples, visual sample clouds, audio sample clouds, detected pattern entities, motion patterns, scene cards, Meaning Network, and Master Schema.
- search modes: keyword, entity, object, Narrative Agent, semantic, pattern, multimodal, and forensic.
- return levels: video, scene, segment, frame, entity, pattern, and forensic.
- ranking policy: manual confirmation first, maturity boost, multi-source boost, semantic relevance, confidence, temporal precision, and raw-detection penalty.
- result actions: jump to video, open scene card, open entity card, open pattern card, open forensic render, promote to mature-data candidate, and export result.

Search must remain read/project/review oriented. It may open candidate promotion flows, but it must not silently mutate Master Schema, Entity Registry, Narrative Agent, or Meaning Network truth.

## SOM / Open Topology Scanner Boundary

No additional SOM instruction is needed for the first implementation slice.

For now, SOM/open topology should be treated as a diagnostic scanner and matcher:

- It may cluster similar evidence.
- It may surface near matches.
- It may create review candidates.
- It may help rank search or proliferation candidates.
- It may explain why a pattern or entity candidate was suggested.

It must not:

- override Master Schema.
- mark evidence mature without a decision ledger entry.
- overwrite manual corrections.
- convert track continuity into Narrative Agent identity.
- proliferate cross-scene claims without source evidence and traceback.

When the scanner/matcher becomes an implementation task, the required output contract should include:

- `candidate_id`
- `source_refs`
- `similarity_score`
- `cluster_context`
- `reason_for_match`
- `review_required`
- `blocked_actions`
- `traceback_refs`

## UI Surface

The best UI surface is not a new busy panel at first.

Add an Entity Registry lane inside Master Schema and Meaning Network:

- Entity Registry summary row in Master Schema.
- Entity chips on Meaning Network nodes.
- Entity mention cards in traceback.
- Search filter by entity type and maturity.
- Candidate review tray for cross-modal entity matches.
- Content Search source filters and return-level controls.

Later, a dedicated Entity Registry panel can be useful, but only after the registry proves it can hydrate, filter, search, and trace across multiple videos.

## Mature Data Proliferation Impact

This is directly useful for the Mature Data Proliferation problem.

The Entity Registry creates a stable substrate for cross-modal proliferation:

- A confirmed OCR title can support metadata and Scene Cards.
- A confirmed place can support scene continuity.
- A confirmed object can support Meaning Network continuity.
- A confirmed Narrative Agent sample can support later candidate appearances.
- A confirmed audio entity can support speaker and transcript alignment.
- A confirmed law, concept, or organization can support search and report generation.

The key is that these projections remain governed. They may spread, but they must carry maturity, source anchors, authority, and traceback.

## Release Gate

Do not call the named entity regime operational until the following are true:

- Entity records are analysis-scoped.
- Entity mentions carry source time or source field anchors.
- Manual correction and rejection override all automated entity evidence.
- Narrative Agent entities do not become natural-person identity profiles.
- Search records preserve traceback.
- Cross-video tests prove no entity bleed.
- At least transcript, OCR, metadata, manual annotations, object detections, and Narrative Agent profiles feed the same registry view.
