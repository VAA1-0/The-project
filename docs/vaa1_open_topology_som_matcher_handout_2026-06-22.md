# VAA1 Open-Topology SOM Scanner / Matcher Handout

Date: 2026-06-22

Purpose: explain the current scanner/matcher layer for Datascene/VAA1 Mature Data Proliferation: what it is for, what it is made of, how it works in practice, and how it should be developed next.

## Short Definition

The open-topology SOM scanner/matcher is a governed evidence-discovery worker.

It takes already existing source evidence and mature anchors, scans the current analysis for similar or related evidence, and writes traceable candidate matches. It does not silently create mature truth.

In plain terms:

```text
confirmed or source-linked anchor
  -> scanner/matcher refresh
  -> traceable candidate cluster
  -> analyst confirms, stages, defers, or drops
  -> Mature Data Proliferation bus can reuse the decision
```

## What It Is Made For

The matcher exists to help VAA1 deliver the promise of scalable multimodal analysis.

The analyst should not have to confirm the same character, object, named entity, or repeated setting hundreds of times when the system already has strong source-linked evidence. The matcher should use confirmed or well-anchored evidence as a substrate for finding later repetitions, especially in places where current analysis has been weak: late-video detections, fragmented BBox tracks, and repeated patterns that are visible but not yet mature.

Primary use cases:

- carry confirmed Narrative Agent identities forward across later BBoxes;
- find recurring objects, props, logos, vehicles, clothing, documents, and symbols;
- connect OCR/transcript/source-media named entities to later source evidence;
- detect recurring settings and environments such as sky, sea, forest, cityscape, studio, office, street, conference hall, and interior scenes;
- support repeated audio, prosody, music, interaction, action, camera, and visual-composition patterns;
- surface confirmable clusters in Data Maturation and Search;
- preserve provenance so the analyst can inspect why a candidate exists.

The matcher should save analyst time, not replace analyst authority.

## What It Is Not

The matcher is not a hidden auto-confirmation engine.

It must not:

- overwrite manual corrections;
- treat a raw track id as a global identity;
- promote raw detections into mature truth by itself;
- merge evidence across videos unless explicitly allowed by a future scoped workflow;
- hide weak matches behind confident labels;
- create another panel-local source of truth.

The output is candidate support until a governed decision exists.

## Current Implementation

Core backend file:

- `src/backend/analysis/evidence_proliferation_matcher.py`

Primary API endpoints:

- `POST /api/analysis/{analysis_id}/proliferation/match`
- `POST /api/analysis/{analysis_id}/proliferation/refresh`

Primary UI entry points:

- Search panel `Matcher` button;
- Video panel BBox/overlay right-click regime;
- Data Maturation scanner queue and governance matrix;
- Mature Data Proliferation bus previews and scanner launch requests.

Related files:

- `api_server.py`
- `src/frontend/lib/api-service.ts`
- `src/frontend/app/V2components/components/panels/SearchPanel.tsx`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/app/V2components/components/panels/DataMaturationPanel.tsx`
- `src/backend/analysis/live_mature_data_proliferation_bus.py`

## What It Is Made Of

The matcher is composed of five practical parts.

### 1. Evidence Collector

The matcher builds a pool of matchable evidence from the current analysis.

Current evidence sources include:

- manual visual annotations;
- annotation corrections;
- object detections;
- OCR detections;
- expression detections;
- transcript segments;
- source media metadata;
- audio diarization turns;
- audio sample clouds;
- audio prosody cues;
- visual sample clouds;
- source samples;
- visual cues;
- cinematic clues;
- Master Schema categories where present.

Each evidence item is normalized into a candidate-like record with:

- label;
- category;
- source panel;
- source kind;
- time interval;
- BBox/geometry where available;
- raw source fields;
- source timesphere.

### 2. Match Request

A match request tells the matcher what kind of evidence to seek.

Current target categories include:

- `character_continuity`
- `object`
- `named_entity`
- `scene_setting`
- `speaker_voice_continuity`
- `sound_event`
- `music_motif`
- `ambient_sound`
- `prosody_delivery_pattern`
- `visual_pattern`
- `action`
- `interaction`
- `scene_episode`
- `ocr_text_phrase`

The request carries a seed evidence profile:

- selected/confirmed label;
- source label;
- category;
- time interval;
- BBox/geometry;
- source track id, if available;
- source modality;
- governance settings.

### 3. Closest-Match Scoring

The matcher evaluates candidate evidence against the seed.

Current scoring dimensions:

- text/semantic overlap;
- temporal closeness;
- spatial consistency;
- track continuity;
- contextual modality support;
- sample-cloud support;
- manual-source authority.

This is deliberately not a single label-overlap match. The matcher should be able to say:

```text
This looks relevant because it is close in time, similarly placed, from the same source modality,
and supported by a manual anchor or sample cloud.
```

The output includes:

- `match_probability`;
- `similarity_score`;
- probability band;
- component scores;
- reason for match;
- source timesphere;
- seed timesphere.

### 4. Governance Wrapper

Every candidate is wrapped in mature-data governance.

Candidate output includes:

- candidate id;
- source refs;
- source anchors;
- evidence refs;
- traceback refs;
- projection targets;
- cluster context;
- review state;
- allowed actions;
- blocked actions;
- proliferation reason;
- whether review is required.

The important rule:

```text
Candidate evidence can support review pressure.
It cannot become mature truth without manual authority or a governed promotion decision.
```

### 5. Open-Topology SOM Trace

Each matcher run now emits:

```text
schema: vaa1.open_topology_som_traceable.v1
```

This is not a fixed grid visual SOM yet. It is an open topology trace map: a graph-like representation of how the seed and candidates relate.

It contains:

- seed node;
- candidate nodes;
- weighted similarity edges;
- open candidate clusters;
- source refs;
- source anchors;
- review-required flags;
- traceback refs.

The term `open topology` matters because the evidence space is not a clean rectangular grid. A character, logo, sea shot, named entity, or music motif may recur across irregular source contexts. The matcher should preserve that messy topology rather than forcing every match into one rigid track.

## How It Works In Actual Practice

### Meaning Network Workflow

The matcher is now also a Datascene Meaning Network graph producer.

Matcher and scanner output should surface as graph topology, not as hidden panel-local state:

```text
known source-linked anchor
  -> matcher/scanner run
  -> matcher_anchor node
  -> matcher_candidate nodes
  -> traceable_similarity / constellational_match_candidate edges
  -> graph navigation, traceback, confirm/defer/drop governance
```

The Meaning Network projection preserves the linked-data principle:

- every matcher node keeps its source refs, traceback refs, time range, and BBox/ROI when available;
- every matcher edge keeps its match basis, weight, maturity authority, and review-required state;
- the topology is open, not a fixed grid: anchors, candidates, clusters, scenes, transcript/audio/OCR support, and manual corrections can form irregular graph neighborhoods;
- the graph renders the topology as navigable nodes and edges, while the Mature Data Proliferation bus remains responsible for promotion governance;
- manual correction and analyst confirmation remain the authority layer.

Operational graph objects:

- `matcher_anchor`: a known/manual/source-linked seed used by the scanner;
- `matcher_candidate`: a possible repetition or related multimodal pattern;
- `traceable_similarity`: a candidate edge from a known anchor to a similar source-linked detection;
- `constellational_match_candidate`: a candidate edge supported by multiple modalities, for example BBox + transcript + audio + OCR + scene card;
- `open_topology_som_cluster`: a cluster continuity anchor used for copy/paste, linked duplication, or batch review.

The Meaning Network graph should support these analyst moves:

- click a matcher node to jump to the source time/BBox when available;
- click a matcher edge to inspect why the match exists;
- copy a known matcher anchor and paste a linked duplicate into another source coordinate;
- confirm, defer, or reject candidate nodes/edges without overwriting the original detection;
- use the graph as a navigable review surface for matcher output, rather than forcing the analyst to scroll through isolated table rows.

This means a late-video “Confirm character” BBox should not remain an isolated uncertainty if earlier known anchors exist. It should appear in the graph as a candidate match against the known anchor, with source navigation and a clear promotion decision path.

### Search Panel Workflow

1. Analyst opens Search.
2. Analyst selects one completed analysis.
3. Analyst presses `Matcher`.
4. Frontend calls:

```text
POST /api/analysis/{analysis_id}/proliferation/refresh
```

5. Backend builds scanner refresh requests from high-value anchors and evidence.
6. Backend writes one or more matcher ledgers.
7. Search reloads the analysis corpus.
8. New mature-data or cluster records become visible through the normal Content Search and Data Maturation paths.

This keeps Search read-only. Search can launch discovery, but corrections still belong to governed review surfaces.

### Video Right-Click Workflow

1. Analyst right-clicks a BBox/overlay.
2. Video panel opens Traceback as before.
3. The same right-click also launches an open-topology matcher refresh for the current analysis.
4. The refresh writes traceable candidate output.
5. Data Maturation/Search can show the result as reviewable support.

This allows the analyst to work from the source evidence surface without leaving the video context.

### Data Maturation Workflow

Data Maturation is the review/governance surface.

Scanner/matcher output should appear as:

- scanner support;
- candidate rows;
- confirmable clusters;
- mature-data hypotheses;
- candidate/cluster review pressure.

The analyst should be able to:

- inspect source;
- confirm proliferation where anchored;
- stage annotation where it is a source pattern;
- defer;
- drop a candidate;
- drop a cluster.

Dropped candidates and clusters are not deleted. They are suppressed through the durable `annotation_corrections.proliferation_decisions` ledger.

## How It Supports Mature Data Proliferation

The matcher supports the Mature Data bus by creating reviewable evidence clusters.

Examples:

### Narrative Agent

Manual confirmations say:

```text
James Bond at 00:08-00:12
James Bond at 01:14-01:21
```

The matcher can scan later unresolved `Confirm Character` BBoxes and surface:

```text
James Bond candidate at 02:50-02:58
match basis: manual identity anchor + visual similarity + central person + scene continuity
review state: confirm_or_drop_identity_continuity
```

### Object

Manual or mature evidence says:

```text
Aston Martin DB5
```

The matcher can surface later car detections, logos, dashboard shots, or vehicle interiors as object-continuity candidates.

### Named Entity

OCR says:

```text
JUSTIN ROWLATT BBC CLIMATE EDITOR
```

The matcher can connect this to:

- transcript references;
- later reporter BBoxes;
- source metadata;
- Entity Registry aliases;
- lower-third OCR recurrence.

### Scene Setting

Scene evidence says:

```text
forest
sea
cityscape
studio
conference hall
```

The matcher can group repeated setting evidence so scene cards, search, reports, and Meaning Network can reuse setting continuity instead of treating every occurrence as isolated raw description.

## Governance Model

The matcher follows the same authority ladder as the rest of VAA1:

1. Manual correction wins.
2. Manual annotation and confirmation are authoritative inside their time/BBox scope.
3. Mature Master Schema projections are reusable.
4. Scanner/matcher output is candidate support.
5. Raw detections remain traceback substrate.

The matcher may help populate:

- Data Maturation review pressure;
- Content Search mature-data/cluster records;
- Narrative Agent continuity memory;
- Object and entity candidate clusters;
- traceback and report evidence;
- future source-sample matching queues.

It must not independently mutate mature truth.

## Current Strengths

The current implementation is useful because it:

- uses a shared backend matcher instead of panel-local matching logic;
- consumes multiple modalities;
- outputs source anchors and traceback refs;
- emits open-topology candidate clusters;
- supports analyst-triggered refresh from Search and Video;
- preserves the diagnostic/candidate boundary;
- supports future scanner types without requiring a brand-new panel.

## Current Limits

The current matcher is not yet a full embedding or computer-vision reidentification system.

Important limits:

- visual similarity is still mostly metadata/time/BBox/context based;
- audio comparison uses existing audio metadata/sample-cloud evidence, not a mature speaker embedding pipeline;
- source sample writing is not fully operationalized;
- scene setting matching depends on available visual/cinematic cue labels;
- refresh requests are seeded heuristically;
- UI still needs rendered proof for larger analyses;
- candidate clusters are useful but not yet a polished analyst review board;
- right-click refresh currently triggers a backend refresh, but does not yet expose a full context menu with visible action choices.

## Further Development

### 1. Source Sample Writer

The matcher gets much stronger when VAA1 can create source samples automatically.

Needed:

- visual crops from BBox/ROI intervals;
- audio windows from the same source time;
- audiovisual sample records;
- sample ids linked back to candidates and mature anchors;
- failure states when media is unavailable.

### 2. Embedding-Based Matchers

Future matcher backends can plug into the same governance shell:

- face/body embeddings;
- object embeddings;
- OCR/entity embeddings;
- speaker/voice embeddings;
- scene/environment embeddings;
- music/audio motif embeddings.

The governance output should stay the same even if the internal matcher improves.

### 3. Better Open-Topology Review UI

The current SOM output is traceable data. It should become a useful UI view.

Future UI:

- show clusters as small source-linked groups;
- show seed-to-candidate edges;
- sort by confidence and conflict;
- support one-click source verification;
- support confirm/drop cluster in place;
- show why a candidate belongs to a cluster.

### 4. Full-Timeline Coverage Audit

The matcher should report whether it scanned the whole timeline.

Needed metrics:

- candidate density by video quartile;
- late-video candidate count;
- source sample coverage;
- audio coverage;
- BBox coverage;
- scene setting coverage;
- unresolved central-person count;
- suppressed candidate count.

This directly addresses the recurring failure mode where the beginning of a video matures well but the end remains sparse.

### 5. Domain-Specific Matchers

Different media genres should get different matching rules.

Examples:

- news: lower thirds, presenter/reporter roles, studio/field split, named locations;
- films: protagonists, props, vehicles, recurring settings, action motifs;
- interviews: speaker identity, voice continuity, shot/reverse-shot patterns;
- sports: players, teams, scoreboards, field/court locations;
- surveillance/forensics: repeated persons, vehicles, objects, camera positions.

### 6. Right-Click Regime Expansion

Right-click should eventually expose visible choices:

- Open Traceback;
- Run Matcher Refresh;
- Match this BBox;
- Match this object;
- Match this named entity;
- Match this setting;
- Drop similar cluster;
- Open Data Maturation queue.

Current right-click behavior already preserves Traceback and starts the refresh, but it should become more explicit for analyst trust.

### 7. Persistent Matcher Ledger

Matcher refreshes should have a durable ledger:

- refresh id;
- request ids;
- candidates found;
- clusters created;
- decisions made;
- suppressed candidates;
- stale/recomputed status;
- source artifacts used.

This will make matcher behavior auditable across saves, refreshes, and handoffs.

## Practical Acceptance Criteria

A useful scanner/matcher delivery should satisfy these checks:

- pressing Search `Matcher` creates traceable matcher output for the selected analysis;
- right-clicking a BBox/overlay can launch a governed matcher refresh;
- matcher output includes source refs, similarity score, cluster context, reason for match, review requirement, and blocked actions;
- Narrative Agent, Object, Named Entity, and Scene Setting targets are supported;
- candidates appear through Data Maturation/Search review surfaces;
- candidates do not silently become mature truth;
- dropping a candidate or cluster suppresses it durably;
- no cross-video bleed occurs;
- late-video unresolved evidence is scanned and visible.

## Bottom Line

The open-topology SOM scanner/matcher is the bridge between VAA1's careful confirmation culture and actual scalable analysis.

It lets mature anchors teach the system where to look next, while keeping the analyst in charge of truth.

The correct future is not one giant automatic recognizer. The correct future is a governed family of scanner/matcher workers that can discover repeated patterns across people, objects, named entities, settings, audio, and scenes, then return traceable candidates that the analyst can confirm, correct, defer, or drop.
