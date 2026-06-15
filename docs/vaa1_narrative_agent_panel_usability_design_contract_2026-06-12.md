# VAA1 Narrative Agent Panel Usability Design Contract

Date: 2026-06-12

Purpose: make the Narrative Agent panel usable as the home of agent semantics, rather than a dense list of labels, evidence chips, and cross-panel jumps.

## Design Thesis

The Narrative Agent panel should help the analyst understand one agent at a time.

It should answer:

- What is this agent doing across the source?
- What source evidence supports the reading?
- What is confirmed, candidate, conflicted, rejected, or missing?
- What visual, vocal, transcript, scene, relation, and role evidence is available?
- Which continuity questions belong in Meaning Network review?
- Which claims are mature enough to proliferate?

## Panel Shape

The default panel state is a single-agent view. A dropdown selects one canonical Narrative Agent profile at a time.

If the same character appears under two or three labels, the panel should combine those labels into one canonical profile when there is profile-id, alias, or clear label-containment evidence. The source labels remain visible as aliases and traceback; the UI does not erase them.

The panel should organize work into five review modes:

1. Overview:
   - compact agent profile, maturity state, source coverage, latest analyst decisions.

2. Evidence:
   - source-linked BBox/ROI events, transcript lines, visual samples, audio samples, expressions, prosody, scene cards, and traceback.

3. Semantics:
   - persona/alias, appearance, voice/speech, expression/affect, gesture/action, role/function, relation, scene trajectory, object association, linguistic register, continuity, and negative evidence.

4. Continuity:
   - confirmed appearances, candidate appearances, conflicts, rejected continuities, missing evidence, and Meaning Network handoff.

5. Scenes:
   - scene presence prose, scene-by-scene support, entrance/exit, speech, expression, source samples, and Master time anchors.

## Usability Rules

- The first viewport must explain what the agent panel is for.
- The analyst should not need to know whether evidence came from BBox, Master Schema, Meaning Network, transcript, or source metadata before understanding the agent.
- Evidence rows must expose source jumps, Master time, authority, maturity, and traceback.
- Interpretation rows must separate visual expression, vocal expression, and transcript interpretation.
- Positive, negative, regulating, and ambivalent vocal-affect cues must be equally available.
- Continuity decisions must route to Meaning Network or a dedicated continuity review surface, not to a destructive BBox relabel workflow.
- Empty states must name what is missing and how to create or inspect the missing evidence.

## First UI Skeleton

The first usable panel slice is a review compass at the top of the Narrative Agent Character Paths home:

- Overview
- Evidence
- Semantics
- Continuity
- Scenes

Each compass item names the work surface and points the analyst to the current source of truth. This is an orientation layer, not a new authority path.

The second small slice is a one-agent timeline strip:

- source handle;
- scene-presence handles;
- cue handles;
- click-to-source navigation;
- handle-to-user-annotation commit through `master_schema_presence_intervals`;
- Open in Meaning Network action.

The strip is a local annotation and navigation aid. It must use the same Master Schema presence-interval engine as Meaning Network handles, so a handle committed here stands in the overall analysis and syncs back to Meaning Network, Master Schema, Video/BBox, Scene Cards, and Narrative Agent cards.

It must not become a second full graph or make continuity decisions inside the Narrative Agent panel.

The third small slice is profile containment:

- a Narrative Agent dropdown;
- one canonical profile rendered per panel view;
- combined source labels shown as aliases;
- conservative merge rules based on shared profile ids, explicit aliases, or clear label containment;
- no silent merge when the evidence is ambiguous.

## Acceptance

- The Narrative Agent panel exposes a stable review compass.
- The Narrative Agent panel exposes a dropdown for selecting one canonical profile.
- The panel renders only one selected Narrative Agent profile at a time.
- Multiple labels for the same character can be combined into one profile when governed alias/profile evidence supports it.
- Combined labels stay visible as source aliases and traceback evidence.
- The compass names Overview, Evidence, Semantics, Continuity, and Scenes.
- The compass explicitly keeps Meaning Network as the continuity review destination.
- The panel states that agent semantics are source-linked and Master-time governed.
- The panel exposes a simple one-agent timeline strip with source, scene, and cue handles.
- Timeline handles jump to source-video time and commit governed presence intervals.
- Timeline handles use the same `master_schema_presence_intervals` schema and retiming path as Meaning Network graph handles.
- Fuller continuity review remains a Meaning Network action.
- No new UI element promotes data without source anchors, maturity state, and traceback.
