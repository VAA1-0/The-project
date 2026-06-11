# VAA1 BBox Continuity UX Map And Wire Contract

Date: 2026-06-11

Purpose: define the UI path before another BBox implementation pass. This document turns the BBox / Meaning Network / Narrative Agent sprint gate into concrete user paths, panel responsibilities, UI states, and acceptance checks.

## Design Thesis

BBox is an evidence event tool, not a continuity authority.

The analyst should be able to confirm what is visible in a bounded source moment without the system silently converting that event into cross-scene Narrative Agent, object, or relation continuity. Continuity belongs in graph and agent review surfaces, where competing evidence can be compared.

```text
BBox/ROI
  source-local evidence event

Meaning Network
  candidate and confirmed continuity between evidence events

Narrative Agent
  agent-centered appearances, characteristics, conflicts, roles, relations, and paths

Master Schema
  mature projection and publication layer

Traceback
  source chain, old states, raw substrate, and decision history
```

## Primary User Case

### Adjacent Same-Track Conflicting Agent Assertions

The acceptance case is:

- `James Bond`, `43-46s`
- `Nomi`, `47-49s`
- same or confused raw `track_id`
- two separate analyst-confirmed BBox events
- no destructive merge
- continuity/conflict review moved to Meaning Network or Narrative Agent

This is the case that must pass before further BBox authority expansion.

## Panel Responsibilities

### BBox/ROI Panel

Primary job:

- create source-local visual evidence events;
- edit the selected event's time interval and geometry;
- show local maturity and traceback;
- hand continuity questions to graph/agent review.

Must show:

- active event id;
- category and assertion label;
- start/end time;
- geometry keyframe count;
- raw substrate: detector id, raw track id, source frame, raw label;
- save state: unsaved, saving, saved, save failed, backend-confirmed;
- continuity status: none, candidates, conflict, confirmed elsewhere;
- actions: Save local event, Save here, Traceback, Review continuity.

Must not do:

- broad agent propagation;
- same-track agent merging;
- promotion of continuity candidates;
- hidden retiming from old track intervals;
- destructive replacement of another event unless that exact event is selected.

### Meaning Network Graph

Primary job:

- compare evidence events across time, scene, track, source sample, relation, role, object, and agent context;
- expose candidate, confirmed, rejected, and conflicting continuity edges;
- turn local evidence into reviewable graph structure.

Must show:

- source-local BBox event nodes;
- Narrative Agent nodes;
- object nodes;
- scene/interval nodes;
- continuity candidate edges;
- conflict edges;
- confirmed continuity edges;
- rejected/negative evidence edges;
- source anchor badges and traceback affordances.

Core edge states:

- `candidate_continuity`
- `confirmed_continuity`
- `rejected_continuity`
- `conflict`
- `missing_evidence`
- `traceback_only`

### Narrative Agent View

Primary job:

- review one agent's appearances and continuity;
- hold agent-centered characteristics, roles, relations, paths, conflicts, and candidate appearances.

Must show:

- characteristic families and their source evidence;
- confirmed appearances;
- candidate appearances;
- rejected appearances;
- conflicting appearances;
- role/relation/action path;
- scene trajectory;
- source sample readiness;
- negative evidence;
- source evidence row for every appearance.

Each appearance row needs:

- source label;
- time interval;
- source panel;
- confidence or authority;
- maturity state;
- characteristic family contributions;
- traceback action;
- jump-to-video action;
- graph-edge action.

Working schema contract: `docs/vaa1_narrative_agent_characteristics_schema_and_proliferation_contract_2026-06-11.md`.

### Master Schema

Primary job:

- publish mature projections after local confirmation or ledgered promotion;
- avoid becoming an opaque private editing surface.

Must show:

- current mature claim;
- source evidence refs;
- authority level;
- maturity state;
- propagation state;
- open conflicts;
- candidate count;
- traceback.

### Traceback

Primary job:

- preserve the evidence chain and old states without restoring raw authority.

Must show:

- manual event history;
- raw detector and track substrate;
- previous labels and intervals;
- promotion decision history;
- graph continuity edges;
- rejected candidates as negative evidence.

## User Paths

### Path A: Create Source-Local BBox Event

1. Analyst selects BBox at current source time.
2. BBox editor opens in source-local mode.
3. Analyst sets category, assertion label, start/end, and geometry.
4. Analyst saves.
5. Backend returns canonical manual BBox event.
6. UI renders from returned event, not local draft.
7. Event appears in BBox event ledger and Meaning Network as a source node.

Acceptance:

- Save creates one source-local event.
- Raw track id is stored as substrate, not authority.
- The event can be reopened by event id.
- Refresh does not change the label, interval, or geometry.

### Path B: Adjacent Conflicting Agent Events

1. Analyst saves `James Bond 43-46s`.
2. Analyst saves `Nomi 47-49s`.
3. System detects same raw track or overlapping tracker lineage.
4. BBox keeps both events visible only in their own intervals.
5. Meaning Network creates or displays a conflict/candidate edge.
6. Narrative Agent views show each appearance under the correct agent, with conflict state visible.

Acceptance:

- The first event is not deleted.
- The first event is not hidden outside an accidental selected-workspace rule.
- The second event does not inherit the first event id.
- BBox does not ask for a new character confirmation unless the current source-local event is missing.

### Path C: Review Continuity From BBox

1. Analyst sees a continuity indicator on a BBox event.
2. Analyst clicks `Review continuity`.
3. Meaning Network opens with the BBox event selected.
4. Candidate edges are visible.
5. Analyst can inspect source anchors before confirming, rejecting, or deferring.

Acceptance:

- The review opens graph/agent context, not a destructive BBox relabel control.
- Candidate confirmation creates a decision ledger entry.
- BBox projection updates only after ledgered confirmation.

### Path D: Review Agent Appearance

1. Analyst opens Narrative Agent.
2. Appearance table lists confirmed and candidate appearances.
3. Analyst opens one candidate.
4. UI shows BBox crop, source time, scene context, transcript/prosody if available, graph edge, and traceback.
5. Analyst confirms or rejects continuity.

Acceptance:

- The agent profile never treats a raw track id as enough evidence by itself.
- Rejected appearances remain visible as negative evidence.
- Confirmed appearances have source anchors and mature projection refs.

## Wire Contract

### BBox Event Ledger Row

Fields:

- `event_id`
- `label`
- `category`
- `start_seconds`
- `end_seconds`
- `geometry_keyframes_count`
- `source_track_id`
- `source_detector_label`
- `authority_state`
- `maturity_state`
- `continuity_state`
- `last_saved_at`

Actions:

- `Open`
- `Edit local event`
- `Traceback`
- `Review continuity`

### BBox Editor Header

Required visible states:

- `Source-local event`
- `Unsaved draft`
- `Saved locally`
- `Canonical save confirmed`
- `Continuity candidate`
- `Continuity conflict`
- `Mature projection active`

Copy rule:

- Use `source-local` for BBox evidence.
- Use `continuity candidate` for graph/agent proposals.
- Use `mature projection` only after local manual confirmation or decision-ledger promotion.

### Meaning Network Continuity Edge Sheet

Fields:

- `edge_id`
- `edge_state`
- `from_event_id`
- `to_event_id`
- `continuity_type`
- `evidence_refs`
- `source_samples`
- `confidence`
- `authority`
- `decision_id`
- `traceback_refs`

Actions:

- `Confirm continuity`
- `Reject continuity`
- `Defer`
- `Open source A`
- `Open source B`
- `Open Narrative Agent`
- `Open Traceback`

### Narrative Agent Appearance Row

Fields:

- `appearance_id`
- `agent_label`
- `source_event_id`
- `time_range`
- `scene`
- `characteristic_refs`
- `role`
- `relation`
- `appearance_state`
- `authority`
- `source_sample_refs`
- `negative_evidence_refs`
- `traceback_refs`

Actions:

- `Open source`
- `Open graph edge`
- `Confirm appearance`
- `Reject appearance`
- `Traceback`

### Narrative Agent Characteristic Row

Fields:

- `observation_id`
- `agent_label`
- `characteristic_family`
- `claim`
- `value`
- `source_event_id`
- `time_range`
- `scene`
- `authority`
- `maturity_state`
- `projection_targets`
- `source_sample_refs`
- `negative_evidence_refs`
- `traceback_refs`

Actions:

- `Open source`
- `Open graph edge`
- `Create proliferation hint`
- `Reject candidate`
- `Traceback`

## Implementation Guardrails

Do not implement another BBox authority pass until these hold:

- BBox source-local event ids are distinct from raw track ids.
- Same raw track does not imply same manual event.
- BBox Save edits only the selected event or creates a new event.
- `Save here` adds geometry to the selected event only.
- Continuity review has a graph/agent destination.
- Candidate promotion requires a decision ledger entry.
- Traceback can show raw substrate without making it display truth.

## First UI Skeleton Slice

The safest next implementation slice is not a full graph rebuild. It is a visible routing skeleton:

1. Add BBox event ledger readout in the BBox/ROI editor.
2. Add `Review continuity` action beside saved manual BBox events.
3. Route that action to Meaning/Plot with a selected source event payload.
4. Add a Meaning Network continuity lane placeholder with candidate/conflict/confirmed/rejected states.
5. Add a Narrative Agent appearance-table placeholder sourced from manual BBox events.
6. Add a Narrative Agent semantic-family placeholder showing how each appearance matures persona/alias, appearance, voice, role, relation, continuity, or negative evidence.
7. Add a fixture for James Bond `43-46s` and Nomi `47-49s`.

This gives the analyst the right mental model before deeper data migration begins.

## Acceptance Checklist For Sprint A

- Product boundary is clear enough to explain without code.
- James Bond / Nomi case is the named canonical acceptance path.
- BBox has a source-local event contract.
- Meaning Network has a continuity edge contract.
- Narrative Agent has an appearance row contract.
- Narrative Agent has a characteristic row contract.
- Raw track id is demoted to substrate.
- No new BBox implementation work is allowed to bypass this contract.
