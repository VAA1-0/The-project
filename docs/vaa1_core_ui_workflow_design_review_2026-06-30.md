# VAA1 / Datascene Core UI And Workflow Design Review

Date: 2026-06-30

Purpose: consolidate the Meaning / Plot, Narrative Agent, narrative lens, Mature Data Proliferation, and matcher workflow concerns into one design direction before further implementation.

## Design Thesis

Datascene should feel like an intelligent analytical partner, not a collection of powerful panels.

Every major panel must answer four questions in the first working viewport:

1. What am I looking at?
2. What does Datascene currently believe?
3. What is the next most useful analytical action?
4. What are the main navigable tools on this panel, and in what order should I use them?

The redesign is not primarily about adding features. It is about making Datascene's existing and emerging intelligence visible, navigable, and source-governed.

## Shared Panel Pattern

All analytical panels should converge on the same interaction grammar:

- **Current belief:** Datascene's best present reading, with confidence and maturity state.
- **Evidence:** source-linked BBox/ROI, transcript, OCR, audio, scene, object, entity, graph, and traceback support.
- **Next action:** confirm, correct, reject, defer, compare, stage annotation, or inspect source.
- **Advanced tools:** collapsed by default, expanded only when the analyst needs them.
- **Workspace expansion:** major graph, matcher, schema, or lens work can detach or enter full-screen mode without losing source context.

This pattern should become a shared UI component family rather than a one-off design in each panel.

## Meaning / Plot Panel

### Current Problem

The Meaning / Plot panel has become a feature list. Controls compete for attention, important tools are buried, and the panel does not guide the analyst through interpretation.

### Target Shape

The default panel should be organized as:

1. **Lens header**
   - Selected narrative framework.
   - Framework switcher: Aristotle, Freytag, Campbell, Frye, Booker, Boje.
   - Compact summary of the current structural reading.

2. **Key Figures**
   - A compact, non-widgety summary of the analytical landscape.
   - **N scenes:** Total number of scenes.
   - **N agents:** Total number of identified Narrative Agents.
   - **N nodes / edges:** Count of meaningful graph nodes and edges.
   - **N claims (mature/candidate):** Count of mature vs. candidate interpretive claims.
   - **N StatsResults (raw/reviewed):** Count of raw vs. reviewed statistical results.
   - This provides immediate statistical context for the interpretation.

2. **Current reading**
   - Main plot / meaning hypotheses.
   - Turning points.
   - conflicts.
   - agent roles.
   - scene functions.
   - unresolved interpretive questions.

3. **Evidence queue**
   - Source-linked claims requiring confirmation.
   - Mature claims already accepted.
   - Candidate claims from matcher, scene cards, transcript, audio, and graph relations.

4. **Meaning Network workspace**
   - Graph visible in compact form.
   - Expand to full-screen graph workspace.
   - Right-click node/edge actions, including matcher.
   - Matcher candidates rendered as graph nodes/edges and as review cards.

5. **Advanced sections**
   - Node markers.
   - Edge markers.
   - schema editing.
   - import/export.
   - experimental lenses.

### Acceptance Direction

- The first viewport communicates the selected lens, the current interpretation, and the next review action.
- The graph is not buried under unrelated controls.
- Secondary controls are collapsible.
- Matcher/SOM candidates are visible as both graph relations and reviewable evidence cards.
- The analyst can confirm several candidates and save one review round.

### 2026-07-01 Progress: Lens-Governed Meaning Network

The first Meaning / Plot reorganization slice has been implemented in the current branch.

Delivered:

- Aristotle, Freytag, Campbell, Frye, Booker, and Boje are available as operational lens choices.
- Each lens now carries an inline theory description, a distinct color track, lane ordering, agency weighting, and graph layout profile.
- Known scenes remain visible as the source-timed structural spine across lens changes.
- Scene segments are treated as graph segments with nodes and edges rather than as disconnected report rows.
- The selected lens changes how the same scene, agent, reading, and evidence material is arranged and emphasized.
- Boje can surface antenarrative evidence from fragmentary and conflictual candidate material even when no explicit Boje reading has been generated yet.
- The graph remains the primary workspace while dense support surfaces move behind dropdowns.
- Graph support actions now have concrete behavior instead of inert buttons.
- Fullscreen graph workspace entry is available for larger structural inspection.

This is still an interpretive surface, not mature truth automation. Lens-specific graph views should be treated as source-linked hypotheses until confirmed or harvested through mature-data governance.

### Required Next Delivery: Lens Explanation Prose

The next Meaning / Plot design task is to translate lens changes into cohesive natural language.

Datascene should be able to explain, in clean prose, how choosing Aristotle, Freytag, Campbell, Frye, Booker, or Boje changes the interpretation of represented phenomena and character relations. This explanation must be multimodal. It should cite or reference how the selected lens uses:

- visual evidence and BBox/ROI presence;
- scene timing and scene transitions;
- transcript evidence and speaker/listener relations;
- measured audio, voice, or prosody evidence where available;
- objects, OCR, named entities, settings, and source metadata;
- Meaning Network nodes and edges;
- mature evidence, candidates, conflicts, and missing evidence.

The output should not merely restate the selected lens label. It should answer:

```text
What changed in the interpretation?
Which multimodal evidence caused that change?
Which character relations or phenomena are reweighted?
What remains candidate, conflicting, or unresolved?
```

This should become part of the Reporter Agent and the lens workspace, but only if it preserves Datascene authority rules.

## Narrative Agent Panel

### Current Problem

The Narrative Agent panel has too many equally weighted controls and too many redirects. The analyst loses context when local lens buttons open Meaning / Plot or Traceback instead of showing local evidence.

### Target Shape

The Narrative Agent panel should remain the home for one agent at a time.

Default structure:

1. **Agent selector and identity state**
   - canonical profile dropdown;
   - aliases;
   - maturity status;
   - source coverage;
   - unresolved identity conflicts.

2. **Agent belief card**
   - who Datascene believes this agent is;
   - where they appear;
   - when they are visibly present;
   - key statistical proportions:
     - **N appearances (confirmed/candidate):** Total count of appearances, broken down by maturity.
     - **Visual Presence:** Total duration in seconds and as a percentage of the source media.
     - **Speaking Time:** Total duration in seconds and as a percentage of all detected speech.
     - **Scene Participation:** Count of associated scenes.
     - **Evidence Mentions:** Count of mentions in transcript, OCR, and metadata.
   - when they speak;
   - when they listen;
   - which claims are mature, candidate, conflicted, or rejected.

3. **Evidence tabs**
   - Overview;
   - Evidence;
   - Semantics;
   - Continuity;
   - Scenes.

4. **Local lens evidence**
   - Dramatic archetypes;
   - Shakespearean agency;
   - Proppian functions;
   - Jungian / mythic roles;
   - Greimasian actants;
   - Burkean dramatistic roles.

5. **Recognition evidence**
   - Character audio recognition;
   - Character visual recognition;
   - Language / name / place confirmation;
   - Narrative structure confirmation;
   - Mise-en-scene understanding.

Each lens or recognition mode must show evidence inside the Narrative Agent panel first. Meaning Network and Traceback become optional drill-down actions, not forced destinations.

### Narrative Agent Annotation Workspace

The Narrative Agent panel must also become the easiest place to annotate anything concerning the selected agent.

The analyst should not need to leave the Narrative Agent panel to add, confirm, reject, or correct agent-specific meaning. The Meaning Sheet and BBox/ROI editor can remain powerful specialist surfaces, but their most common agent actions should be available locally.

Required local annotation affordances:

- identity and alias;
- visual presence;
- speaking;
- listening;
- relation to another agent, object, place, or institution;
- action;
- gesture;
- expression / affect;
- audio / voice / prosody;
- transcript attribution;
- scene participation;
- role / function;
- dramatic archetype;
- SFL ideational reading;
- SFL interpersonal reading;
- SFL textual reading;
- virtue reading;
- vice reading;
- source-sample creation;
- matcher candidate confirmation;
- conflict / negative evidence.

The panel should expose a compact annotation card for the selected agent. This card should reuse the governed choices already present in Meaning Sheet and BBox/ROI workflows, including:

- Ideational: subcategory, actor, object, action, event, situation, location, causal relation;
- Interpersonal: relation, judgement group, judgement value;
- Textual: sequence, continuity, contrast, framing, rhythm, transition;
- Virtues: virtue family, virtue axis, virtue value;
- Vices: vice family, vice axis, vice value;
- BBox/ROI detection selections: evidence, Narrative Agent, relations, time/continuity, traceback/authority, operations.

The local agent annotation card should provide the same basic actions as the source panels:

- Add;
- Confirm;
- Reject;
- Correct;
- Defer;
- Open source;
- Open traceback;
- Use ROI / source sample when available.

The design rule:

```text
If the analyst is thinking about one Narrative Agent, the annotation tool should be available in the Narrative Agent panel.
```

The BBox/ROI editor remains the best surface for drawing or adjusting geometry. Meaning Sheet remains the best surface for graph-wide node/edge semantics. But the Narrative Agent panel should offer local controls for the agent-level meaning derived from those surfaces.

### Agent Meaning As Mature Data

Confirmed agent-related meaning annotations are not local notes. They are mature Datascene evidence.

When the analyst confirms an agent-level annotation from the Narrative Agent panel, the program should create a governed mature-data write with:

- selected Narrative Agent profile;
- source time or interval;
- BBox/ROI or source-sample reference when available;
- source panel and source action;
- annotation family;
- annotation value;
- maturity state;
- authority;
- confidence;
- traceback;
- propagation target list.

These mature writes should propagate across:

- Master Schema subject authority;
- Meaning Network nodes;
- Meaning Network edges;
- Knowledge Network Graph nodes;
- Knowledge Network Graph edges;
- BBox/ROI labels and overlays;
- Narrative Agent profile cards;
- Scene Cards;
- Search;
- Traceback;
- Mature Data audit;
- matcher / scanner memory.

Examples:

- A confirmed `Dr. Madeleine Swann / ideational / actor` annotation should strengthen the Dr. Madeleine Swann Narrative Agent profile and surface as a mature graph node attribute.
- A confirmed `Dr. Madeleine Swann / interpersonal / confirms / acceptance` annotation should surface as a mature relation or edge candidate where source evidence supports it.
- A confirmed `Dr. Madeleine Swann / virtue / humanity / kindness` annotation should surface as an interpretable mature reading, not only as a private panel field.
- A confirmed BBox/ROI visual-presence annotation should strengthen future visual matching for that agent.
- A confirmed speaking/listening annotation should strengthen future audio-visual and relation matching.

The propagation rule:

```text
Confirmed Narrative Agent meaning becomes mature data.
Mature agent meaning becomes graph structure when it has a source-linked node or relation target.
Graph structure remains traceable to the original timebound source evidence.
```

The Knowledge Network Graph should therefore be a consumer of mature agent meaning, not a separate place where the same meaning has to be recreated manually.

### Acceptance Direction

- Lens buttons do not redirect by default.
- The panel presents source-linked local evidence.
- The analyst can confirm or reject claims without losing context.
- Visual presence, scene presence, speaking, and listening remain separate claims.
- Confirmations propagate to Meaning Network, Master Schema, BBox/ROI, Search, Scene Cards, and Traceback.
- Meaning Sheet and BBox/ROI annotation choices are locally available for the selected agent.
- The analyst can annotate agent semantics without being redirected away from the Narrative Agent panel.
- Confirmed agent meaning annotations become mature data and propagate into Meaning Network and Knowledge Network Graph nodes/edges.

## Narrative Structure Lenses

### Current Problem

Aristotle, Freytag, Campbell, Frye, and Booker are largely cosmetic. They do not yet change the interpretation of the same material.

### Required Lens Set

- Aristotle;
- Freytag;
- Campbell;
- Frye;
- Booker;
- Boje.

### Operational Requirement

Each lens should generate a distinct structural reading of the same dataset.

Selecting a lens should change:

- structural phases;
- turning points;
- conflicts;
- agent roles;
- scene functions;
- causal relations;
- unresolved hypotheses;
- Meaning Network layout;
- candidate mature evidence;
- review priorities.

The lens does not create truth by itself. It creates structured hypotheses. These hypotheses become mature analytical evidence only when supported by source-linked, traceable, confirmed or high-confidence governed evidence.

### Boje Lens Direction

The Boje lens should focus on antenarrative and distributed story fragments:

- fragmented story pieces;
- competing futures;
- bets on what the story may become;
- polyphonic voices;
- institutional and counter-institutional storylines;
- before-plot fragments that have not stabilized into one canonical arc.

This lens is especially important for news, documentary, corporate, organizational, and political material where a single heroic or dramatic arc is often misleading.

## Mature Data Proliferation UX

### Current Problem

The Mature Data Proliferation bus is strategically central but too visible as technical machinery. The analyst should not need to operate proliferation as a separate ritual.

### Target Behavior

Mature Data Proliferation should become nearly invisible:

- SOM / matcher runs quietly in the background when mature anchors exist.
- Candidate matches surface naturally where the analyst is already working.
- Manual confirmations immediately strengthen future matching.
- Confirmed matches become user-confirmed truths under Datascene/VAA1 authority rules.
- Candidate evidence remains candidate evidence until a governed promotion occurs.
- Rejections and deferrals feed the matcher as negative evidence.

### Analyst Experience

The analyst should experience the bus as:

```text
Datascene found 112 likely related evidence items.
Here are the 12 best verifiable candidates for "James Bond".
Confirm the ones that match.
Rejected candidates will reduce future noise.
Confirmed candidates will propagate across panels.
```

```text
Datascene found likely related evidence.
Here are the best verifiable candidates.
Confirm the ones that match.
Rejected candidates will reduce future noise.
Confirmed candidates will propagate across panels.
```

The analyst should not need to know whether the candidate came from a matcher refresh, a graph node action, a BBox action, a scene-card implication, or an entity registry projection.

## AI Agent Layer

The application should use agents to organize analysis work, not to bypass governance.

Every agent must obey:

```text
Source evidence first.
Manual analyst authority wins.
Candidate evidence supports.
Raw detections remain traceback substrate.
No mature truth without source, time, authority, maturity, and traceback.
```

### 1. Workflow Orchestrator Agent

Purpose: decide which background analytical tasks should run next.

Inputs:

- current panel;
- selected video time;
- selected node/edge/BBox/agent;
- known mature anchors;
- unresolved review queues;
- CPU budget;
- stale matcher state.

Outputs:

- launch matcher refresh;
- defer expensive scan;
- request lightweight preview only;
- populate local candidate queue;
- recommend next analyst action.

UI surface:

- invisible by default;
- visible only as compact status such as `Matcher refreshed`, `12 candidates ready`, or `Scan deferred: CPU budget`.

### 2. Evidence Curator Agent

Purpose: select the most useful evidence cards for the analyst.

Inputs:

- BBox/ROI detections;
- transcript spans;
- OCR;
- audio turns;
- scene cards;
- entity registry;
- Meaning Network nodes/edges;
- Traceback chains;
- Mature Data records.

Outputs:

- ranked evidence cards;
- source jumps;
- conflict warnings;
- missing-evidence notices;
- thumbnail / short clip requests.

UI surface:

- Meaning / Plot evidence queue;
- Narrative Agent evidence tabs;
- BBox matcher review gallery;
- Search mature-data results.

### 3. Matcher / Scanner Agent

Purpose: search the remaining video array for likely repeats of known mature anchors and related unknown candidates.

Inputs:

- mature anchors;
- manual confirmations;
- rejected matches;
- BBox tracks;
- visual samples;
- measured audio samples;
- transcript spans;
- OCR;
- object/entity detections;
- scene settings;
- Meaning Network topology.

Outputs:

- known similars;
- unknown similars;
- contextual supports;
- conflict candidates;
- negative candidates;
- confidence scores;
- graph nodes and edges.

Operational requirements:

- use lightweight thumbnails first;
- use short representative clips;
- use measured audio features, not placeholder audio;
- escalate to heavier embeddings only when lightweight evidence is insufficient;
- preserve source time, BBox/ROI, and traceback.

UI surface:

- local matcher queue;
- Meaning Network `Matcher / SOM candidates` lane;
- Narrative Agent recognition evidence;
- Mature Data candidate cards.

### 4. Narrative Structure Agent

Purpose: run the selected narrative framework as an interpretation engine.

Inputs:

- scene cards;
- transcript;
- agent roles;
- events;
- conflicts;
- source metadata;
- Meaning Network graph;
- mature and candidate evidence.

Outputs:

- lens-specific structural reading;
- turning point candidates;
- role candidates;
- conflict hypotheses;
- scene-function hypotheses;
- mature-evidence candidates.

UI surface:

- Meaning / Plot lens header;
- framework-specific graph reorganization;
- reviewable structural evidence cards.

### 5. Narrative Agent Profiler

Purpose: maintain one coherent analytical profile per agent while keeping aliases and uncertainty visible.

Inputs:

- confirmed Narrative Agent annotations;
- visual presence samples;
- audio speaker turns;
- transcript attributions;
- relations;
- actions;
- scene participation;
- matcher candidates;
- rejected identity hypotheses.

Outputs:

- canonical profile;
- alias list;
- presence intervals;
- speaking/listening candidates;
- role and relation hypotheses;
- identity conflicts.

UI surface:

- Narrative Agent panel;
- Meaning Network agent appearances;
- BBox labels;
- Search / Traceback.

### 6. Governance Agent

Purpose: prevent uncontrolled promotion and explain why evidence is or is not mature.

Inputs:

- all candidate decisions;
- source authority;
- manual confirmations;
- confidence scores;
- conflicts;
- missing time/BBox/audio/provenance;
- cross-video boundary checks.

Outputs:

- mature;
- candidate;
- blocked;
- conflicted;
- rejected;
- needs source sample;
- needs analyst decision.

UI surface:

- subtle warning badges;
- evidence cards;
- Data Maturation audit view;
- Traceback.

### 7. Performance Budget Agent

Purpose: keep Datascene responsive while scanners and matchers operate.

Inputs:

- CPU load;
- queue size;
- current panel;
- video length;
- number of mature anchors;
- sample availability;
- active user interaction.

Outputs:

- run now;
- throttle;
- postpone;
- thumbnail-only scan;
- audio-only scan;
- cache reuse;
- background refresh.

UI surface:

- mostly invisible;
- optional status line in debug or Maturation audit mode.

### 8. Reporter Agent

Purpose: translate the current mature Datascene into comprehensive, clean, concise prose.

The Reporter Agent is not a truth maker. It is a governed synthesis layer over already mature or clearly labeled candidate evidence.

Inputs:

- mature Master Schema records;
- confirmed Narrative Agent profiles;
- scene cards;
- Meaning Network nodes and edges;
- mature and candidate plot readings;
- source metadata;
- transcript summaries;
- OCR/entity registry;
- measured audio/prosody evidence;
- visual/object/setting evidence;
- Traceback authority and maturity labels;
- open conflicts and rejected claims.

Outputs:

- concise source-grounded analysis summary;
- scene-by-scene report;
- Narrative Agent report;
- plot / meaning report by selected lens;
- Mature Data coverage report;
- unresolved questions;
- evidence gaps;
- confidence and maturity caveats;
- customer-facing or analyst-facing prose modes.

UI surface:

- report drawer or detachable report workspace;
- `Draft report` action in Meaning / Plot, Narrative Agent, Scene Cards, and Data Maturation;
- source-linked citations or evidence chips;
- clear split between mature findings and candidate hypotheses.

Reporter output must preserve Datascene governance:

```text
Mature claims are written as findings.
Candidate claims are written as hypotheses.
Conflicts are written as conflicts.
Missing evidence is written as missing evidence.
Rejected claims are not resurrected as prose truth.
```

The Reporter Agent is useful only if it can explain what Datascene currently knows in ordinary prose without hiding uncertainty, authority, source time, or evidence provenance.

## Agent Coordination

The agents should not become independent, competing authorities. They should share one evidence ledger and one mature-data governance layer.

Recommended coordination pattern:

1. Workflow Orchestrator detects useful work.
2. Matcher / Scanner or Narrative Structure Agent produces candidates.
3. Evidence Curator ranks and presents candidates locally.
4. Governance Agent labels candidate authority and maturity.
5. Analyst confirms, corrects, rejects, or defers.
6. Confirmed decisions update Mature Data.
7. Matcher / Scanner uses the new mature decision to reduce uncertainty in the remaining detection array.
8. Meaning Network, Knowledge Network Graph, BBox/ROI, Narrative Agent, Search, Scene Cards, Master Schema, and Traceback refresh from the same governed source.
9. Reporter Agent translates the current governed state into prose without changing authority.

## Computational Strategy

The redesign must protect responsiveness.

Default strategy:

- cache source samples;
- use thumbnails before clips;
- use short clips before full track scans;
- use lightweight embeddings before heavy models;
- scan locally around source time first;
- expand across scene, then whole video, then cross-video only when governed;
- run expensive scans in background;
- never block basic panel navigation on matcher work.

The matcher should become more accurate as mature data accumulates:

- every confirmed match adds a positive anchor;
- every rejection adds negative evidence;
- every deferral preserves uncertainty without promoting it;
- every mature cluster narrows future candidate search;
- every mature visual/audio/entity/scene relation reduces the plausible identities of remaining raw detections.

The mature-data pool should make the remaining raw detection regime less ambiguous over time.

## Implementation Slices

### Slice 1: Design System For Analytical Panels

- Shared `Current belief` card.
- Shared `Evidence card`.
- Shared `Next action` row.
- Shared collapsible advanced section.
- Shared source-jump and traceback controls.

### Slice 2: Meaning / Plot Reorganization

- Add Boje to lens header.
- Collapse secondary graph controls.
- Move matcher queue into a clear local review section.
- Expose graph workspace expansion.
- Make selected lens visibly alter graph organization metadata, even before full framework intelligence is complete.

### Slice 3: Narrative Agent Local Evidence

- Stop lens buttons from redirecting by default.
- Render archetype, agency, Propp, Jungian, Greimas, and Burke evidence locally.
- Render audio/visual/name/place/mise-en-scene confirmation evidence locally.
- Keep optional drill-down buttons.
- Add a local Narrative Agent annotation card that reuses Meaning Sheet SFL controls and BBox/ROI detection-selection controls.
- Make Add, Confirm, Reject, Correct, Defer, Open Source, Open Traceback, and Use ROI/source sample available from the selected agent context.
- Route confirmed agent meaning annotations into the mature-data write path so they propagate to Meaning Network and Knowledge Network Graph nodes/edges.

### Slice 4: Operational Lens Engines

- Implement framework-specific structural readings.
- Use the same source dataset for all lenses.
- Generate reviewable hypotheses, not automatic mature truth.
- Add mature-evidence harvesting path for confirmed structural detections.

### Slice 5: Quiet Mature Data Proliferation

- Run lightweight matcher refresh in the background when mature anchors change.
- Surface candidates in the panel where the analyst is working.
- Batch-confirm visual candidates from thumbnail gallery.
- Feed confirmations and rejections back into matcher memory.

### Slice 6: Performance And Governance Hardening

- Add scan budget telemetry.
- Cache thumbnails and short clips.
- Use measured audio features for audio claims.
- Prevent cross-video bleed.
- Keep all promotions source-time, BBox/ROI, maturity, authority, and traceback governed.

### Slice 7: Reporter Agent

- Add report draft action over the current mature Datascene.
- Produce concise prose summaries with clear mature/candidate/conflict separation.
- Generate scene, agent, lens, and mature-data coverage reports.
- Keep every report paragraph traceable back to source evidence.

## Acceptance Criteria

- The Meaning / Plot panel has a clear first-viewport workflow.
- The Narrative Agent panel has a clear first-viewport workflow.
- Lens buttons generate local evidence rather than forced redirects.
- Boje is available as a narrative structure lens.
- Narrative structure lenses produce distinct interpretations over the same material.
- Narrative Agent panel exposes local annotation controls for agent semantics, Meaning Sheet readings, and common BBox/ROI detection selections.
- Confirmed Narrative Agent meaning annotations surface as mature data across Meaning Network and Knowledge Network Graph nodes/edges.
- Matcher candidates surface where the analyst is working.
- Multiple visual candidates can be selected and saved in one review round.
- Mature Data Proliferation strengthens future matching without requiring explicit analyst ritual.
- Reporter Agent can draft clean prose from the current mature Datascene while preserving candidate/conflict/missing-evidence caveats.
- Raw person tracks remain detector substrate until mature evidence resolves them.
- Audio evidence is measured and source-derived, not placeholder scaffolding.
- All candidate-to-mature promotions remain source-linked, timebound, traceback-visible, and manually correctable.
