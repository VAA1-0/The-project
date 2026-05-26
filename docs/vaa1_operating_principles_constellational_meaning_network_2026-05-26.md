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
Double-click Narrative Agent node -> open Narrative Agent profile / card context
Right-click or trace action -> open traceback
```

Incorrect behavior:

```text
Click node -> open abstract Master Schema view while source evidence exists
```

Master Schema inspection is important, but source verification should be the first operational gesture when source evidence exists.

## Master Schema feedback loop

Meaning Network edits must feed back into the Master Schema.

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

## Next steps

Immediate next steps:

- Fix lane routing so on-camera Narrative Agent nodes consistently appear in the on-camera lane.
- Ensure every source-linked Narrative Agent node click seeks the video before opening schema/profile context.
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
