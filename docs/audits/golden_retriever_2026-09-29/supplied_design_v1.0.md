# Datascene Golden Retriever Acquisition Service

## Design Specification 1.0

**Status:** Draft for implementation and validation  
**Date:** 29 September 2026  
**Scope:** Datascene Corpus Lab, Standalone, institutional and cloud deployments  
**Companion schema:** Datascene_Golden_Retriever_Schema_v1.0.json

## 1. Purpose

Golden Retriever is Datascene's governed acquisition, enrichment and corpus-admission service. It retrieves research material from heterogeneous sources, preserves an inspectable relationship to every source, and applies computation, storage and analyst attention parsimoniously.

The service is not defined as a web scraper. Web crawling is one connector capability among several. The same acquisition model covers:

- public websites and web search results;
- authenticated websites and intranets;
- local files, folders and removable research packages;
- institutional and cultural-heritage repositories;
- web archives and preserved WARC collections;
- REST, GraphQL and domain-specific APIs;
- RSS/Atom feeds and sitemaps;
- SQL, NoSQL, graph, vector and search-index databases;
- content and document management systems;
- S3-compatible and other object stores;
- analyst uploads and customer-local corpora.

All connectors produce the same Acquisition Envelope so that downstream Datascene components do not need source-specific logic.

## 2. Objectives

Golden Retriever shall:

1. acquire text, documents, images, audio, video, metadata and compound objects;
2. automate metadata and source-media discovery for retrieved sources and detected entities;
3. preserve source, version, selector, route, query and transformation lineage;
4. support controlled query-variety and route-diversity experiments;
5. keep automatic observations distinct from candidate and analyst-confirmed interpretations;
6. minimize marginal network, storage, CPU, GPU, model and analyst cost;
7. enforce rights, retention and acquisition-lane policies before corpus admission;
8. operate through one API contract across local Standalone, institutional and cloud deployment;
9. feed Corpus Lab categories, Text Bank packages, ontologies and benchmark collections;
10. keep the service private unless an authorized administrator explicitly changes deployment policy.

## 3. Non-objectives

Version 1.0 does not:

- bypass authentication, CAPTCHAs, source bans, robots policies or rate limits;
- conceal prohibited collection by changing routes;
- provide a general-purpose uncontrolled internet crawler;
- recursively enrich entity graphs without an explicit depth and budget;
- treat publicly accessible material as automatically redistributable or trainable;
- require complete audiovisual downloads when references, metadata or samples are sufficient;
- overwrite source observations when an analyst corrects a derived value.

## 4. Design principles

### 4.1 Source agnosticism

Every connector implements a common contract and returns normalized source, capture, media, entity, evidence and cost records.

### 4.2 Human authority

Automated results remain inspectable. Manual correction wins operationally, while original machine observations remain in the history.

### 4.3 Evidence before interpretation

Golden Retriever preserves the Datascene distinction:

observation != measurement != candidate interpretation != confirmed interpretation != research claim.

### 4.4 Immutable lineage

Every derivative points to a captured asset, segment, record or source. Live references and captured versions are stored separately.

### 4.5 Progressive processing

The service begins with the least expensive sufficient representation and deepens processing only when expected research value justifies the next cost.

### 4.6 Rights by component and purpose

Code, model, source data, derivative, redistribution, commercial-use and training eligibility are evaluated separately.

### 4.7 Deployment independence

The same records and service contract shall work on a local Standalone unit, an institutional compute environment, a supercomputing environment or a private cloud worker.

## 5. Source and connector model

### 5.1 Connector classes

| Connector class | Examples | Core acquisition mode |
|---|---|---|
| Web | HTTP pages, rendered sites, search results | discover, fetch, snapshot |
| Feed/index | RSS, Atom, sitemap, CDX | enumerate, incrementally poll |
| API | REST, GraphQL, domain API | query, paginate, retrieve |
| Local filesystem | files, folders, mounted volumes | enumerate, hash, ingest |
| Analyst upload | selected files or research packages | validate, quarantine, ingest |
| Archive repository | OAI-PMH, IIIF, SRU/SRW, WARC, BagIt | harvest metadata and representations |
| Institutional repository | publication, library or records repository | search, enumerate, retrieve |
| Intranet/CMS/DMS | authenticated internal web or document system | query and fetch with least privilege |
| Database | SQL, NoSQL, graph, vector, search index | read-only query or change feed |
| Object storage | S3-compatible bucket or institutional blob store | list, head, range-read, retrieve |
| Knowledge graph | authority file or entity graph | resolve and enrich |
| Media platform | hosted audiovisual collection | metadata, captions, permitted media |

Product-specific adapters can be added without changing the core schema.

### 5.2 Common connector contract

Every connector declares:

- connector identity, class and implementation version;
- endpoint or an opaque local source-root identifier;
- supported discovery, search, metadata, content and synchronization operations;
- supported modalities and formats;
- authentication mode and opaque secret reference;
- rate, concurrency, query and byte limits;
- source-specific policy and permitted operations;
- checkpoint and incremental-synchronization support;
- version-history and deletion-detection support;
- health, test and quarantine status;
- cost-estimation capability.

Credentials, passwords, tokens and connection strings must not be stored in acquisition manifests. Only an opaque credential reference is permitted.

### 5.3 Connector capabilities

The capability vocabulary includes:

- list;
- search;
- discover_links;
- fetch_metadata;
- fetch_content;
- fetch_media_reference;
- fetch_media;
- range_read;
- incremental_sync;
- version_history;
- delete_detection;
- server_side_filter;
- full_text_query;
- structured_query;
- semantic_query;
- streaming;
- resume;
- route_selection.

Unsupported capabilities must be explicit rather than inferred.

### 5.4 Local files

Local acquisition supports:

- individual files;
- recursive folders;
- watched intake folders;
- mounted volumes and network shares;
- ZIP/TAR research packages;
- BagIt-style packages;
- existing Datascene corpus manifests.

The source root is represented by an opaque root ID. Manifests store a normalized relative path, never a user credential. Files are hashed before processing. Archives are scanned and expanded in a controlled quarantine area with file-count, compression-ratio and size limits.

Initial format coverage should include PDF, DOCX, PPTX, XLSX, CSV, TSV, JSON, JSONL, XML, HTML, TXT, common image formats, common audio formats and common video containers.

### 5.5 Intranets

Intranet connectors use explicitly authorized, read-only service accounts where possible. They must:

- operate only within declared collections or paths;
- log the source identity and account scope;
- preserve access classification in every derivative;
- prevent restricted derivatives from being exported to a less restrictive lane;
- support revocation and revalidation of access;
- avoid credential capture in logs and manifests.

Interactive login handoff may initialize a session, but the acquisition worker must not imitate users or expand access beyond the granted account.

### 5.6 Databases

Database connectors are read-only by default. Each query records:

- database source ID and logical collection;
- query template or a redacted, normalized query representation;
- parameter values when they are safe to retain;
- transaction/snapshot or observation time;
- pagination and ordering rules;
- returned record identifiers;
- schema or mapping version;
- row/record selector;
- estimated and actual records and bytes.

The connector must prevent mutating statements. Query allowlists, maximum result counts and statement timeouts are required for production use.

### 5.7 Repositories and archives

Repository adapters should preserve repository-native identifiers, collections, manifests, representations and version history. Golden Retriever should support:

- metadata-only harvesting;
- representation discovery before download;
- IIIF-style image and manifest references;
- OAI-PMH-style incremental harvesting;
- WARC/CDX lookup for archived web evidence;
- repository checksums and fixity data;
- compound objects and parent-child structures;
- embargo, access and reuse conditions.

## 6. Unified acquisition lifecycle

1. An analyst creates a Study Brief.
2. The system resolves permitted connectors and source policies.
3. A canonical query and optional query family are compiled.
4. A route/query/time experiment is generated when applicable.
5. Connectors return source candidates and cost estimates.
6. Cheap metadata, rights and duplicate checks run first.
7. Candidates receive utility, risk and estimated-cost scores.
8. The budget engine selects a processing depth.
9. Permitted content or media references are captured.
10. Transformations produce normalized text, OCR, transcripts, keyframes or other analytical objects.
11. Entity enrichment proceeds within explicit hop and cost limits.
12. Analysts inspect evidence and accept, correct, reject or quarantine results.
13. Accepted items are mapped to Corpus Lab, ontology and benchmark targets.
14. Reproducibility and missing-source reports are exported.

## 7. Acquisition Envelope

Each connector output is wrapped in an Acquisition Envelope containing:

- study and run identity;
- connector and source-policy identity;
- query, query variant, route and time block;
- source candidate and canonical source identity;
- fetch attempt and status;
- metadata observations;
- media references and captured assets;
- content and perceptual hashes;
- rights and retention observations;
- estimated and realized cost;
- transformations and tool versions;
- evidence selectors and lineage edges;
- analyst decisions and maturity states.

Connectors may return partial envelopes. Required missing fields must be declared rather than silently omitted.

## 8. Metadata and source-media automation

### 8.1 Source entity

For every source, Golden Retriever attempts to collect:

- canonical and observed locator;
- source-native stable identifier;
- title, description, language and dates;
- author, publisher, channel and institutional authority;
- MIME type, format, file size, duration and dimensions;
- embedded structured metadata;
- parent collection and compound-object relations;
- captions, transcripts, attachments and alternative representations;
- thumbnail, image, audio and video references;
- licence, terms, access and retention observations;
- checksums, versions and prior captures.

### 8.2 Mentioned entity

Persons, organizations, places, products, events, works and concepts detected inside a source enter an Entity Expansion Queue. Each candidate may be resolved against configured authority sources and enriched with aliases, stable identifiers, relationships and media references.

Every metadata claim is independently linked to the source that supports it. Resolution confidence and maturity are stored separately.

### 8.3 Expansion controls

Entity enrichment is bounded by:

- maximum hop depth;
- maximum child entities;
- permitted relationship types;
- permitted authority sources;
- estimated data and compute budget;
- novelty and coverage threshold;
- analyst approval at configured boundaries.

## 9. Query and route experimentation

### 9.1 Query family

A Query Family contains:

- canonical intent;
- required and excluded concepts;
- ontology concepts and aliases;
- languages and spelling/transliteration options;
- allowed broadening and narrowing;
- approved variants;
- semantic-drift threshold;
- generator and seed.

### 9.2 Route profile

A Route Profile records a stable non-secret route identifier, region, jurisdiction, route class, permitted sources, session policy, rate budget and health state.

Route diversity is used to measure localization, ranking, CDN, availability and version differences. It must not be used to defeat access controls.

### 9.3 Experimental separation

The Workbench first compares the same query across routes in a shared time block, then compares query variants within a route, and finally creates a counterbalanced query x route x time matrix. This prevents route, wording and time effects from being conflated.

Repeated attempts do not create duplicate media downloads. Unique content is stored once; every retrieval attempt remains represented.

## 10. Evidence and lineage

### 10.1 Identity layers

- SourceRecord identifies the external or local source.
- CaptureRecord identifies an observation of that source at a time and version.
- MediaReference records an available representation without implying local retention.
- CapturedAsset records retained bytes.
- Segment identifies a page, span, time interval, bounding region, record or field.
- TransformationRun identifies the operation producing a derivative.
- EvidenceLink connects an observation, claim or analytical object to supporting or contradicting evidence.

### 10.2 Required selectors

Selectors may address:

- whole source or whole asset;
- URL fragment, DOM path or text quotation;
- PDF page and bounding region;
- character or token span;
- audio/video time interval and track;
- image frame and bounding region;
- database collection, record and field;
- archive package member;
- spreadsheet sheet, range, row or column.

### 10.3 Lineage invariants

- No captured object exists without a SourceRecord and CaptureRecord.
- No derivative exists without a TransformationRun and input reference.
- No analytical claim exists without at least one EvidenceLink or an explicit ungrounded status.
- No correction deletes the superseded observation.
- No live source update replaces a prior capture.
- No corpus export omits the provenance bundle.

Referential integrity across arrays is validated by the Datascene service validator because JSON Schema alone cannot guarantee that referenced IDs exist.

## 11. Workbench/Lab UI

### 11.1 Navigation

The Acquisition area contains:

1. Study Brief
2. Source and Connector Registry
3. Query Lab
4. Route Lab
5. Acquisition Matrix
6. Run Monitor
7. Entity Explorer
8. Evidence Workbench
9. Economics Console
10. Corpus Admission
11. Coverage Map
12. Export and Reproducibility

### 11.2 Evidence Workbench

The Workbench uses three persistent regions:

- Source pane: captured page, file, record, image, waveform, transcript or video.
- Analytical canvas: entities, segments, observations, claims and relations.
- Evidence rail: source, capture version, selector, rights, maturity, lineage and cost.

Selecting any analytical object must navigate immediately to its supporting source location. Items lacking evidence display a visible ungrounded state and cannot be admitted to a validated corpus.

### 11.3 Source continuity

The UI always shows:

- source and capture identity;
- live locator and captured-version status;
- selected evidence coordinates;
- transformation chain;
- analyst correction history;
- rights and retention state;
- processing cost and reused derivatives.

## 12. Parsimony and data economics

### 12.1 Processing profiles

| Profile | Default operations |
|---|---|
| Reference | Locator, identity and minimal metadata |
| Preview | Structured metadata, snippets and media references |
| Standard | Selected capture, text extraction, OCR and economical sampling |
| Deep | Full permitted capture and advanced multimodal processing |
| Forensic | Maximum fidelity, detailed chain of custody and preservation |

### 12.2 Progressive evidence ladder

Candidates advance through reference, metadata, light capture, sampling, focused processing, deep processing and human validation. Each transition requires budget availability and expected marginal value.

### 12.3 Cost ledger

The Economics Ledger measures:

- requests and network bytes;
- original and derivative storage;
- CPU seconds;
- GPU seconds;
- model/API calls and tokens;
- analyst minutes;
- licence/access cost;
- reprocessing and versioning cost.

It compares these with:

- accepted items;
- unique evidence;
- coverage gain;
- ontology gaps filled;
- benchmark value;
- analytical packages supported;
- reuse value.

### 12.4 Priority

The recommended acquisition priority is:

utility = relevance + novelty + coverage gain + evidence strength + reuse value

priority = utility / (compute + storage + network + human cost + rights risk)

Weights are study-specific, visible and versioned.

### 12.5 Economy rules

- Deduplicate before retrieval and processing.
- Reuse version-matched OCR, transcripts, embeddings and entity resolution.
- Keep one unique capture while preserving multiple retrieval attempts.
- Prefer metadata and references before full media.
- Sample pages, frames, clips and regions before full processing.
- Apply incremental processing to changed portions.
- Stop when marginal coverage gain drops below the study threshold.
- Keep indexes and heavyweight embeddings rebuildable where possible.
- Count analyst attention as a cost.
- Never lower provenance quality merely to reduce cost.

## 13. Governance and security

Golden Retriever applies three distinct acquisition lanes:

- Research Analysis;
- Product Training;
- Transient Analysis.

Each source and asset records acquisition eligibility, retention, permitted outputs, redistribution, model-training eligibility, attribution and restrictions.

Additional controls include:

- least-privilege and preferably read-only credentials;
- encrypted secret storage outside manifests;
- connector allowlists and network boundaries;
- malware and archive-bomb quarantine;
- maximum object, archive and collection sizes;
- parameterized database queries;
- audit logging;
- explicit PII and sensitive-data classifications;
- retention expiry and legal-hold states;
- per-customer isolation;
- export-policy validation.

## 14. Corpus Lab integration

Corpus candidates can be mapped to:

- general-purpose corpus;
- Sports;
- Crisis;
- other genre and situation collections;
- Meaning and Plot;
- Narrative Agents;
- SFL;
- Forensics;
- Behavioral Narratives;
- Moreno, Latour and Goffman lenses;
- Digital Humanities, Social Data Science, Statistics, Computer Science and Systems Science vocabularies;
- Golden Corpus benchmarks;
- customer-local corpora.

Admission records include accepted analytical uses, ontology mappings, biases, missing coverage, eligible outputs and evidence maturity.

## 15. Schema 1.0 modules

The companion JSON Schema defines:

1. study;
2. connector;
3. retrieval experiment;
4. source and capture;
5. entity and claim;
6. media reference, asset and segment;
7. transformation;
8. evidence;
9. economics;
10. governance;
11. corpus admission;
12. acquisition package.

JSON Schema validates record shapes, identifiers, enumerations and local conditional requirements. A Datascene semantic validator additionally checks cross-record references, acyclicity, source-lineage completeness, budget arithmetic and policy compatibility.

## 16. MVP implementation boundary

### Included

- local file/folder and analyst-upload connector;
- static HTTP, RSS/Atom and sitemap connector;
- one browser-rendered connector;
- one REST API connector;
- one OAI-PMH or IIIF repository adapter;
- one read-only SQL adapter;
- metadata and media-reference discovery;
- PDF text extraction and OCR fallback;
- image, audio and video metadata;
- content and perceptual deduplication;
- query-family and three-route experiment;
- Reference, Preview, Standard and Deep profiles;
- cost estimation and realized-cost ledger;
- evidence review and Corpus Lab admission;
- manifest and reproducibility export.

### Deferred

- unrestricted distributed crawling;
- mutating database operations;
- automatic access escalation;
- full support for every repository protocol;
- large-scale full-video processing;
- automatic Product Training admission;
- recursive graph expansion without review gates.

## 17. Validation criteria

Version 1.0 is internally usable when:

1. identical input, configuration and seed reproduce the same acquisition plan;
2. local, web, repository, intranet and database records share one envelope;
3. every derivative resolves to a capture and precise evidence selector;
4. repeated routes and queries do not duplicate retained media;
5. source version changes are detected without overwriting history;
6. restricted material cannot enter an incompatible lane;
7. connectors stop or pause on access-policy or rate-limit conflicts;
8. database connectors reject mutating statements;
9. archives are safely bounded and quarantined;
10. economic estimates and realized costs are visible per item and study;
11. low-yield acquisition can be stopped using marginal-coverage rules;
12. manual corrections remain authoritative and auditable;
13. multimodal segments retain page, spatial or temporal alignment;
14. all corpus admissions include provenance, rights and maturity records;
15. the service remains private by default.

## 18. Versioning

Schema version 1.0 follows semantic versioning:

- patch: clarifications and backward-compatible validation corrections;
- minor: backward-compatible fields or connector capabilities;
- major: incompatible record, identity or invariant changes.

Connectors declare both the service schema version and their own implementation version. Migrations produce new records or versions and never rewrite historical acquisition evidence in place.

