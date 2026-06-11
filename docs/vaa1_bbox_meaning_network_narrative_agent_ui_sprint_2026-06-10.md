# VAA1 BBox, Meaning Network, And Narrative Agent UI Sprint

Date: 2026-06-10

Purpose: stop the BBox/ROI surface from carrying more semantic and continuity responsibility than one video overlay can safely hold.

## Core Decision

BBox/ROI is not the home of continuity.

BBox/ROI should capture, correct, inspect, and traceback source-local visual evidence. Continuity questions belong in the Meaning Network Graph and Narrative Agent views, where the analyst can compare scenes, relations, intervals, claims, conflicts, and candidate links without one raw detection track becoming accidental authority.

## Why This Sprint Is Needed

Recent BBox failures show a product-design problem, not only a code problem:

- raw `track_id` continuity has been treated as if it can carry Narrative Agent continuity;
- manual time corrections can be saved while later BBox logic still treats old intervals as reusable authority;
- sequential manual confirmations can collapse into one record when the UI assumes same track means same assertion;
- BBox tries to do annotation, agent assertion, geometry correction, propagation, continuity, traceback, candidate review, and mature projection at once;
- the analyst cannot currently see enough of the continuity decision space before a local BBox action starts affecting other moments.

The principle must become visible in the UI:

```text
Manual annotation wins locally.
Continuity is proposed graphically.
Mature proliferation is ledgered.
Raw tracks remain traceback and candidate substrate.
```

## Product Boundaries

### BBox/ROI Surface

The BBox/ROI panel should answer:

- What is visible here?
- What exact time interval and geometry did the analyst confirm?
- What source-local label, role, object, action, relation, or note was confirmed?
- What raw detector, track, sample, or frame did this correction supersede?
- What is the traceback for this source-local claim?
- Is this BBox event linked to any continuity candidates elsewhere?

The BBox/ROI panel should not decide:

- whether two appearances across scenes are the same Narrative Agent;
- whether a car, object, role, relation, or dialogue participant persists across scene boundaries;
- whether a local correction should become a broader mature data claim;
- whether candidate continuity should be promoted.

### Meaning Network Graph

The Meaning Network Graph should answer:

- Which evidence events co-occur?
- Which scenes, intervals, agents, objects, places, relations, roles, and claims are connected?
- Where are continuity hypotheses strong, weak, conflicting, or missing?
- What source anchors support or contradict each graph edge?
- Which candidates are ready for analyst confirmation, deferral, cancellation, or promotion?

The current implementation surface is `MeaningPlotPanel`; the sprint may rename, split, or expand it into a dedicated Meaning Network Graph workbench.

### Narrative Agent View

The Narrative Agent view should answer:

- Where does this Narrative Agent appear?
- Which BBox/ROI events, transcript lines, speakers, expressions, objects, relations, roles, and scenes support the profile?
- Which appearances are confirmed, candidate, conflicted, or rejected?
- What paths, roles, relations, and scene trajectories are visible?
- Which continuity claims need analyst review?
- Which governed characteristics are maturing, and how do they improve future Mature Data Proliferation?

If the dedicated Narrative Agent view is not yet separate, the first UI slice can route through Master Schema plus Meaning/Plot while preserving this product boundary.

Working schema contract: `docs/vaa1_narrative_agent_characteristics_schema_and_proliferation_contract_2026-06-11.md`.

## Analyst User Paths

### Path 1: Source-Local BBox Confirmation

1. Analyst opens the video at a source moment.
2. Analyst selects or draws a BBox.
3. Analyst sets exact in/out time and source-local geometry.
4. Analyst confirms the visible evidence, such as `James Bond`, `Nomi`, `police car`, `speaking`, `holding phone`, or `threatening posture`.
5. Save creates a distinct manual evidence event.
6. The event appears as local mature evidence in BBox/ROI and as a source node in Meaning Network.
7. No cross-scene continuity is applied automatically.

Acceptance:

- A later same-track BBox save cannot delete, retime, relabel, or hide this event.
- The saved event survives refresh and project reopen.
- Traceback shows raw detection and old states without restoring raw authority.

### Path 2: Sequential Same-Track Conflicting Agent Assertions

1. Analyst confirms `James Bond` at `43-46s`.
2. Analyst confirms `Nomi` at `47-49s`.
3. Both confirmations are saved as separate source-local events.
4. If raw tracking claims one track connects them, the UI shows this as a conflict/candidate, not as truth.
5. Meaning Network displays two source nodes and a possible continuity conflict edge.
6. Narrative Agent view receives confirmed local appearances for the correct agent profiles.

Acceptance:

- `James Bond 43-46s` remains visible and traceable.
- `Nomi 47-49s` remains visible and traceable.
- No track id can merge the two agent assertions.
- The system asks a continuity question in graph/agent space rather than altering either BBox event.

### Path 3: Same Object Across Scenes

1. Analyst confirms a car in one scene.
2. The source-local BBox is saved as an object evidence event.
3. Visual sample cloud, raw tracks, color/shape, scene context, OCR, audio, and co-occurrence produce candidates elsewhere.
4. Meaning Network shows candidate object continuity across scenes.
5. Analyst confirms, rejects, or defers the continuity edge.
6. Mature proliferation writes only after a ledgered decision.

Acceptance:

- A track can suggest continuity but cannot absorb all car detections between two appearances.
- Candidate continuity can be reviewed as a graph edge, with each source event preserved.

### Path 4: Narrative Agent Continuity Review

1. Analyst opens a Narrative Agent.
2. The view lists confirmed appearances, candidate appearances, rejected appearances, conflicts, relations, roles, and scene trajectory.
3. The view groups evidence into agent semantic families: persona/alias, appearance, voice, expression, gesture/action, role, relation, scene trajectory, object association, linguistic register, continuity, and negative evidence.
4. Selecting a candidate opens synchronized evidence: BBox crop, video time, transcript line, scene card, expression sample, audio window, graph edge, and traceback.
5. Analyst confirms or rejects continuity.
6. The promotion decision updates Meaning Network, Master Schema, BBox projection, Narrative Agent characteristics, and reports.

Acceptance:

- The agent profile is built from evidence events, not raw track ids.
- Every accepted continuity claim has source anchors and traceback.
- Rejected candidates remain inspectable as negative evidence.
- Every new Narrative Agent field or row states which characteristic family it matures and what proliferation hint, projection, rejection, or traceback value it creates.

## Required UI Changes Before New BBox Coding

1. BBox event ledger:
   - Show saved BBox events as distinct records, not one mutable track authority.
   - Display event id, time interval, label/assertion, category, target substrate, geometry keyframes, maturity, and traceback.

2. Continuity handoff affordance:
   - Replace broad BBox apply-scope behavior with an explicit action: `Review continuity`.
   - This opens Meaning Network or Narrative Agent review with the BBox event as source.

3. Candidate continuity tray:
   - In BBox, show candidates only as small review indicators.
   - Candidate confirmation happens in Meaning Network or Narrative Agent, not inside the single BBox editor.

4. Meaning Network continuity lane:
   - Add lanes for source-local events, candidate edges, confirmed continuity, rejected continuity, conflicts, and missing evidence.
   - Edges must expose confidence, evidence refs, source samples, time spans, and decision state.

5. Narrative Agent appearance table:
   - Add confirmed/candidate/rejected appearances.
   - Each row jumps to source video, BBox, transcript, scene, graph edge, and traceback.
   - Each row contributes to governed characteristic families instead of only listing a name and time.

6. Conflict-first review:
   - If a raw track spans two different manual agent assertions, surface it as a conflict.
   - Do not ask for a new character confirmation in the BBox unless the source-local event is missing.

7. Save-state inspection:
   - Add a visible saved-state readout for BBox event count, active local event, continuity candidates, and last canonical save response.

## Data Model Direction

The UI should force this separation:

```text
raw_detection_track
  -> traceback substrate

manual_bbox_event
  -> source-local evidence authority

continuity_candidate_edge
  -> Meaning Network / Narrative Agent review object

promotion_decision
  -> ledgered mature propagation

mature_projection
  -> panel display result
```

Important distinction:

- A geometry continuity track may connect BBox events for visual review.
- A Narrative Agent continuity edge may connect agent appearances.
- These are different objects and must not share one implicit `track_id` authority.

## UI Sprint Deliverables

### Sprint A: UX Map And Wire Contract

- Create user-path diagrams for BBox event creation, continuity review, Narrative Agent review, and mature promotion.
- Define screen responsibilities for BBox/ROI, Meaning Network, Narrative Agent, Master Schema, and Traceback.
- Define copy language for `source-local`, `candidate continuity`, `confirmed continuity`, `conflict`, and `promotion`.
- Working contract: `docs/vaa1_bbox_continuity_ux_map_wire_contract_2026-06-11.md`.

Exit criteria:

- The team can explain where an analyst should answer “is this the same person/object?” without pointing to the BBox editor.

### Sprint B: Clickable UI Skeleton

- Add or mock stable UI states for:
  - BBox event ledger,
  - Review continuity handoff,
  - Meaning Network candidate edge lane,
  - Narrative Agent appearance table,
  - Narrative Agent characteristic families and source-sample readiness,
  - conflict review.

Exit criteria:

- A user can walk through James Bond `43-46s` and Nomi `47-49s` without losing either local annotation.

### Sprint C: Saved Fixture And Rendered Test

- Build deterministic saved-analysis fixture with:
  - two adjacent manual BBox events on a shared raw track,
  - conflicting agent assertions,
  - graph continuity conflict,
  - Narrative Agent appearance rows,
  - traceback refs.

Exit criteria:

- Playwright or rendered fixture proves both annotations remain visible after save, refresh, reopen, graph review, and agent review.

### Sprint D: Implementation Gate

Only after Sprints A-C pass should production BBox code be overhauled.

Implementation may proceed when:

- BBox no longer owns continuity decisions.
- Meaning Network has candidate/confirmed/rejected continuity states.
- Narrative Agent can review appearances and continuity.
- Raw tracks are visibly substrate, not agent authority.
- Manual local events remain immutable unless the analyst edits that exact event.

## Non-Negotiable Acceptance Tests

1. `James Bond 43-46s` and `Nomi 47-49s` can exist on the same raw track without either event being dropped.
2. A same-track conflict opens Meaning Network/Narrative Agent continuity review, not a destructive BBox relabel.
3. BBox Save creates or edits a source-local event only.
4. `Save here` can add geometry keyframes to the selected event, but cannot merge agent assertions.
5. Continuity promotion requires a decision ledger entry.
6. Mature projections update panels only from ledgered decisions or local manual events.
7. Traceback preserves raw track history without restoring raw authority.

## Immediate Recommendation

Pause deeper BBox implementation work.

Next action should be a UI design sprint around the James Bond / Nomi adjacent-confirmation case, because it exposes the key product boundary:

```text
BBox records evidence.
Meaning Network compares evidence.
Narrative Agent owns agent continuity.
Master Schema publishes mature projections.
Traceback preserves the chain.
```
