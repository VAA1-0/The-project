# VAA1 Operating Principles: Constellational Triangulation and the Meaning Network Graph

Date: 2026-05-26

## Core thesis

VAA1 should not treat raw detections as meaning.

The system should build meaning from source-linked constellations: scenes, agents, objects, spoken words, prosody, locations, music, off-camera presences, relations, and analyst-confirmed corrections.

The Meaning Network Graph is the operational workspace where those constellations become inspectable, navigable, correctable, and eventually mature enough to proliferate through the Master Schema.

Narrative Agent presence handles are an important part of this, but they are only one feature inside the larger Meaning Network regime.

## Meaning Network Graph as a whole

The Meaning Network Graph should function as a governed multimodal workspace, not merely as a visualization.

It should support:

- whole-timeline review,
- scene-timeline review,
- character / Narrative Agent timelines,
- source-linked node and edge navigation,
- manual node creation,
- manual node confirmation,
- copy / paste of known nodes to new scene coordinates,
- source-linked edge review,
- zooming, scrolling, and expandable workspace behavior,
- dedicated panel use for secondary-display work,
- custom analyst tracks such as music, location, off-camera presence, spoken word, prosody, object, situation, and continuity anchors.

The graph should remain subordinate to the Master Schema. It can propose, organize, and display meaning, but it should not become an isolated semantic authority.

## Functional delivery rule

The Meaning Network sprint must deliver actual analyst functions, not partial cosmetics.

Controls, buttons, labels, and lens names only count as delivered when they change the analyst's usable analysis state. A Plot lens selector is not useful because it says "Freytag" or "Campbell". It is useful only when it surfaces an inspectable Datascene reading of narrative structure: what scenes, agents, edges, tensions, transitions, and evidence anchors support that reading, how mature the reading is, and what the analyst can confirm, correct, reject, or compare.

The first priority is narrative structure support. Character meaning dimensions should follow after the narrative-structure readings are actually working, because character meaning needs the structure of scenes, transitions, conflicts, reversals, relations, and stakes to land in the right analytical place.

Forensic render is also a real Meaning Network tool, not a future-facing label. A forensic render action should create or open an inspectable source-linked artifact: a BBox crop, zoom, evidence plate, node montage, edge montage, before/after comparison, traceback render, or report asset. It must preserve time, source media, coordinate basis, maturity state, analyst authority, and traceback. It may be delivered stepwise, but each step must produce a usable rendered artifact or a navigable render request with clear persistence state.

Both Plot lens readings and forensic render can be subdivided into smaller deliveries. The acceptance bar for each slice is still functional: the analyst must gain a new way to inspect, compare, save, trace, or correct meaning, not merely see a new named affordance.

## Processual achievements so far

The current sprint has moved the Meaning Network Graph from a mute button surface toward an operational workspace.

Implemented or partially implemented achievements:

- Meaning Network is visible as a graph rather than only a row of inert controls.
- Graph nodes can be added manually by the analyst.
- Graph nodes can be copied, renamed, confirmed, and used as navigable markers.
- Graph view can surface Master Schema-derived records.
- Scene bands exist as timeline spans rather than only isolated points.
- Whole-timeline, scene-timeline, and character-timeline modes have been introduced.
- The graph supports scrollable and zoomable inspection.
- A dedicated Meaning Network panel route exists so the graph can move beyond a cramped subfield.
- Node presence bars can represent an entity's duration rather than a single timestamp.
- Presence bars have handles that can be stretched and dragged.
- Meaning Network handle edits can persist into `master_schema_presence_intervals`.
- Meaning Network handle edits notify Narrative Agent profile/card surfaces.
- Narrative Agent cards can surface Meaning Network-derived presence intervals.
- Master Schema subject cards can surface the same presence intervals.
- Meaning Network cursor behavior has started to synchronize graph time with video time.
- Clicking source-linked graph nodes is expected to verify against the video rather than opening an abstract schema view first.

These are processual achievements: they establish the workflow architecture, but they still need hardening, layout refinement, and deeper evidence triangulation.

## Constellational triangulation

A mature Meaning Network node should not depend on one detector.

It should be inferred from an evidence constellation that can include:

- visual bbox, face, body, object, expression, or ROI evidence,
- transcript text and corrected transcript text,
- diarization turns and speaker-agent links,
- prosody and sound-event evidence,
- scene boundaries and scene governance,
- object-agent and agent-agent relations,
- off-camera or implied scene presence,
- music, location, and atmosphere tracks,
- manual annotations, confirmations, corrections, drops, and replacements,
- prior mature Narrative Agent profile intervals,
- Meaning Network node and edge context.

The goal is not to hide uncertainty. The goal is to surface structured uncertainty in a form the analyst can inspect, confirm, cancel, modify, or mature.

## Narrative Agent presence handles

Narrative Agent handles should be automated only when there is enough support to propose a meaningful interval.

Recommended maturity tiers:

1. Suggested handle
   - Proposed from weak, partial, or single-modality evidence.
   - Visible in the graph.
   - Must be cancellable.
   - Does not proliferate as truth.

2. Supported handle
   - Proposed from cross-modal agreement, such as visual presence plus transcript continuity, diarization continuity, prosody, object relation, or scene logic.
   - Can guide the analyst.
   - Remains reviewable.

3. Mature handle
   - Analyst-confirmed or supported by very high-confidence cross-modal evidence with source anchors.
   - Persists into the Master Schema.
   - Proliferates to Narrative Agent cards, video/BBox/ROI, scene cards, Meaning / Plot, reports, search, and traceback.

Manual correction remains the highest authority.

## Off-camera and implied presence

Meaning often depends on entities that are not visible in a frame.

Examples:

- chasers in a car chase,
- a speaker heard before they appear,
- a car indicated by sound before visual entrance,
- a remembered person shaping dialogue,
- music or environmental sound defining situation,
- location or institutional context shaping action.

The Meaning Network should support off-camera / presumed presence lanes. These should remain source-linked where possible and maturity-aware where source evidence is indirect.

## Spoken word, prosody, and linguistic evidence

The Meaning Network should not be visual-only.

Transcript segments, diarization turns, prosody cues, SFL/dependency outputs, and interpretive language evidence should appear as timeline-aware nodes or bars.

These should be linked to:

- source time,
- transcript segment ids,
- speaker-agent links,
- maturity state,
- stale/recomputed status where transcript or speaker links change.

This is essential because character presence and scene meaning often begin in language, voice, or sound before they are visually evident.

## Source navigation rule

Every node, bar, edge, or marker should be source-verifiable unless explicitly marked as source-pending.

Correct behavior:

```text
Click node/bar/edge -> seek or open source evidence
Double-click node/edge -> open its specific Meaning Sheet / evidence hub
Narrative Agent node sheet -> expose Open this specific storyline leaf / panel
Right-click or trace action -> open traceback
```

Incorrect behavior:

```text
Click node -> open abstract Master Schema view while source evidence exists
```

Master Schema inspection is important, but source verification should be the first operational gesture when source evidence exists.

Double-clicking a Meaning Network node or edge should not open the general Narrative Agent(s) overview. It should open a navigation field for the selected node or edge. If the selected object is tied to a Narrative Agent or character path, that navigation field can include an explicit action to open the specific Narrative Agent storyline. That storyline may be hosted inside the general Narrative Agent surface, but it should open as a focused panel or leaf of its own rather than dropping the analyst into a broad agent list.

## Master Schema feedback loop

Meaning Network edits must feed back into the Master Schema.

The Master Schema is the canonical maturity anchor. BBox/ROI hubs, Meaning Network node/edge sheets, Narrative Agent leaves, scene cards, reports, traceback, and associated panels should behave as synchronized projections of the governed Master Schema state. They may collect corrections and propose candidates, but they must not become competing local sources of mature truth.

User corrections stand across the whole loop. A user-corrected label, time interval, coordinate, dimension, node reading, edge reading, storyline, character-path leaf, or presence interval can only be replaced by another explicit user correction. Automated detections, plot-lens readings, graph inferences, mature-data candidates, and panel-local drafts can support the analyst, but they must not silently override the corrected bundle.

At minimum, a persisted Meaning Network interval should update:

- `master_schema_presence_intervals`,
- Narrative Agent profile/card presence,
- Master Schema subject surfaces,
- BBox/ROI and video overlays where relevant,
- scene cards,
- Meaning / Plot and Character Paths,
- traceback,
- reports/search where mature enough.

The graph should display the current mature state, not stale local guesses.

Every feedback event that moves data toward maturity should carry enough governance metadata for associated panels to refresh coherently:

- source anchors and evidence refs,
- maturity state and authority level,
- user-correction provenance when present,
- affected panels and projection targets,
- traceback ids,
- stale/recomputed status when upstream evidence changes,
- explicit candidate/confirmed/rejected state.

## Narrative Agent and character-path feedback

The Narrative Agent panel needs the same governed-data maturity as BBox/ROI and Meaning Network surfaces.

Recognized character paths should surface as their own Narrative Agent leaves, not only as implied names or collapsed profile hints. Each leaf should carry:

- a character/path label,
- source-linked presence timeline,
- scene-by-scene summary,
- role and relation evidence,
- character/path meaning readings when available,
- maturity state and analyst authority,
- source anchors and traceback,
- links back to related BBox/ROI evidence hubs and Meaning Network node/edge sheets.

The Character/Path Meaning schemas should be fed by proliferated mature data rather than remaining parallel abstractions. Mature BBox/ROI confirmations, manual annotations, transcript/speaker links, Meaning Network presence intervals, scene anchors, object relations, prosody, SFL/dependency cues, and analyst profile corrections should all be able to support character/path leaves when they carry source anchors and maturity state.

BBox/ROI hubs, Meaning Network node/edge sheets, and Narrative Agent leaves should share a common interaction grammar. The analyst should not have to relearn confirmation behavior panel by panel:

- single click verifies source or selects the working object,
- double click opens the detailed sheet/hub for interpretation and confirmation,
- Narrative Agent navigation from that sheet opens the specific storyline leaf, not the general Narrative Agent(s) overview,
- right click exposes traceback, forensic render, confirm/correct/reject/drop, copy/paste anchor, and related navigation actions,
- every mature proliferation step shows what source evidence and authority state will travel with it.

## Next steps

Immediate next steps:

- Fix lane routing so on-camera Narrative Agent nodes consistently appear in the on-camera lane.
- Ensure every source-linked Narrative Agent node click seeks the video before opening schema/profile context.
- Add Meaning Network node/edge sheets that preserve Narrative Agent profile access while keeping source verification first.
- Surface recognized character paths as Narrative Agent leaves with timelines, summaries, maturity, source anchors, and traceback.
- Make the timeline cursor drag reliably and keep graph/video time synchronized.
- Harden presence handle dragging so live video scrub, final persistence, and panel refresh all agree.
- Improve graph layout to prevent textual overlap.
- Make the Meaning Network panel dynamically resizable and practical as a full workspace.
- Add visible source-pending status for nodes that cannot navigate to source yet.
- Add edge-management affordances that are understandable, navigable, and source-linked.
- Add scene add/delete/edit operations that update the governed scene model.
- Allow scene spans to be painted and resized on the timeline.
- Add custom analyst lanes and make them persistent.
- Add spoken word, prosody, music, location, and off-camera presence as first-class timeline tracks.

Medium next steps:

- Implement constellational handle proposals from transcript, diarization, visual detections, object tracks, sound/prosody, and scene boundaries.
- Implement Plot lens projections as real candidate Datascene readings of narrative structure. Each reading should contain projected scene/node roles, projected edge meanings, evidence refs, maturity state, a readable summary, compare/delta support, and analyst accept/edit/reject actions.
- Keep Plot lens readings candidate-only until analyst-confirmed. They may inform Meaning / Plot and report prose, but they must not become mature narrative truth without source anchors and confirmation.
- Deliver forensic render as a working Meaning Network action: start with BBox/ROI crop or zoom renders and node/edge evidence plates, then expand to montages, before/after comparisons, and report assets.
- Ensure every forensic render stores or exposes source media id, time range, coordinate basis, selected node/edge/BBox ids, maturity state, output type, and traceback link.
- Add open weighting for proposal thresholds.
- Surface near matches as `to_be_confirmed_or_canceled` candidates.
- Add contradiction display, not only support display.
- Add stale marking when transcript, speaker-agent links, bbox geometry, or scene boundaries are corrected.
- Add Playwright coverage for graph navigation, handle dragging, source seeking, panel synchronization, and persistence.

Longer next steps:

- Incorporate SOM or similar near-match comparison for audio, visual, object, and situational profiles.
- Build a mature relation engine for agent-agent, agent-object, agent-location, agent-sound, and agent-scene relations.
- Use the Meaning Network as a bridge between raw multimodal evidence and analyst-facing prose.
- Ensure generated prose always cites the source constellation and maturity status behind it.

## Operating principle

The Meaning Network Graph should become the analyst's multimodal sense-making instrument.

It should let the analyst see what the system thinks is present, why it thinks so, where the source evidence is, how mature the claim is, and what will happen if the analyst confirms, corrects, extends, or cancels it.

The graph should help VAA1 move from empty detections to mature, traceable, navigable, analyst-controlled narrative evidence.
