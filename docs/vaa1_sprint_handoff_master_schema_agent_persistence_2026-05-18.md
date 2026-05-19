# VAA1 sprint handoff: Master Schema maturity and agent persistence

Date: 2026-05-18
Branch/context: `petteri`

## Purpose Of This Handout

This handout is for opening a fresh Codex thread without losing the current sprint state.
The previous thread became sluggish while working on Master Schema maturity routing,
Source Media metadata, Narrative Agent Profiles, Characters By Scene, and Agent
Persistence operationalization.

## Non-Negotiable Architecture Invariant

The **Master Schema is the single mature-data authority**.

Any user-added or user-corrected data, whether it originates in Source Media metadata,
BBox/ROI annotation, transcript correction, Scene, Scene Cards, Meaning / Plot, or any
other panel, must mature into Master Schema and then surface program-wide from there.

Authority order:

1. User-confirmed / user-corrected data
2. Governed metadata routed through Master Schema
3. Mature triangulated/proliferated evidence
4. Interpreted automatic candidates
5. Raw detections

Therefore, downstream UI must not let `unknown` or `unknown_speaker` override known
Master Schema / metadata character subjects.

## Current Pain Point To Resume From

The urgent visible bug is in **Meaning / Plot -> Characters By Scene**.

Observed in the browser:

- `Characters By Scene` still shows `unknown` and `unknown_speaker`.
- The list does not reliably populate from metadata-known characters.
- The desired behavior is simple:
  - Consult Master Schema first.
  - If Master Schema has governed Narrative Agent Profiles / character roles, list those.
  - If not, fall back to Source Media metadata: `narrative_agent_profiles`,
    `character_definitions`, then `character_roles`.
  - If not, fall back to Scene Cards named agents/speakers/items.
  - Only then use second-order participants, and never let `unknown` rows appear when
    known character data exists.

## Important Files In Play

- `api_server.py`
- `src/frontend/lib/video-service.ts`
- `src/frontend/lib/api-service.ts`
- `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`
- `src/frontend/app/V2components/components/panels/MasterSchemaPanel.tsx`
- `src/frontend/app/V2components/components/panels/SecondOrderLabelAffirmations.tsx`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/backend/analysis/agent_persistence.py`
- `src/backend/analysis/second_order_label_proliferation.py`
- `tests/test_agent_persistence_contract.py`
- `src/frontend/tests/manual-annotation-governance.test.mjs`
- `docs/vaa1_agent_persistence_operationalization_note_2026-05-18.md`
- `docs/vaa1_pre_exe_manual_test_checklist_2026-05-16.md`

## Work Already Added In This Sprint

### Backend agent persistence

New backend module:

- `src/backend/analysis/agent_persistence.py`

It defines:

- `AgentPersistenceManager`
- `agent_persistence_scene_cut` schema
- non-mutating cross-scene sample-profile comparison
- accepted/review candidate output
- `build_agent_persistence_feature_event`

Terminology note:

- Avoid judicially loaded "identity persistence" for new feature naming.
- Prefer `agent persistence`, `sample-profile persistence`, or `Narrative Agent Profile`
  language.

### Second-order proliferation

Updated:

- `src/backend/analysis/second_order_label_proliferation.py`

It now recognizes `agent_persistence_scene_cut` and can surface it as governed
second-order evidence.

### API server

Updated:

- `api_server.py`

Current work includes:

- reading/writing `agent_persistence_scene_cut.json`
- including it in derived artifacts
- routing source metadata character roles / definitions / Narrative Agent Profiles
  into Master Schema surfaces
- beginning a `scene_constellation_governance` artifact in Master Schema
- adding `attendee_boundary_rule`, because scene boundaries are often distinguished by
  who attends, enters, exits, speaks, disappears, or reappears

Important caution:

- The backend must ensure Source Media metadata saves refresh Master Schema metadata
  surfaces immediately, so the frontend can see governed subject data without relying
  on stale status snapshots.

### Frontend Meaning / Plot

Updated:

- `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`

Added concepts:

- `Scene Agent Browser`
- `Characters By Scene`
- dramatic archetype readings across multiple traditions
- Master Schema scene governance strip
- fallback evidence windows when formal scene segments are absent
- partial code path for Master Schema / metadata / Scene Card character sources

Current defect:

- `Characters By Scene` still displays unknown rows in the running browser.
- It needs a strict mature-source chain and should list known characters even if scene
  membership has not yet been detected. In that case, scene rows can show "not surfaced"
  or "needs scene confirmation", but the character list itself should come from known
  mature subjects.

### Frontend Master Schema

Updated:

- `src/frontend/app/V2components/components/panels/MasterSchemaPanel.tsx`
- `src/frontend/lib/video-service.ts`

Work started:

- `video-service.ts` promotes Master Schema narrative-agent records and character-role
  records into resolved evidence.
- `MasterSchemaPanel.tsx` has a `Master Schema Subject Authority` strip.

Later redesign requirement:

- Master Schema layout should become a data-governance matrix surface, similar in
  spirit to POS / Quant matrices.
- All mature data should be inspectable and correctable through dropdown navigation.
- Avoid panel-specific widget clutter in that future layout.

### Tests

Added/updated:

- `tests/test_agent_persistence_contract.py`
- `tests/test_second_order_label_proliferation_contract.py`
- `tests/test_second_order_pipeline_wiring_contract.py`
- `src/frontend/tests/manual-annotation-governance.test.mjs`

Recent verification before this handout:

- `npx tsc --noEmit` passed
- `npm test` passed, 29/29
- backend focused tests passed, 15/15
- backend `py_compile` passed

Re-run these in the next thread after completing the Characters By Scene repair.

## Agent Persistence Operationalization Note

Read:

- `docs/vaa1_agent_persistence_operationalization_note_2026-05-18.md`

The note says the current pipeline is passive-visible but not yet operationally complete.
Next steps:

1. Visual integration in `VideoPanel.tsx` BBox/ROI overlays.
2. Analyst confirmation on persistence candidates.
3. Confirmation must mutate Master Schema with provenance, not silently mutate root
   tracker IDs.
4. Compute persistence natively in the primary frame pipeline later.
5. Traceback UI must show why links scored as they did.
6. Later expand to whole-case cross-video scope.

Core rule:

Candidate -> analyst confirmation -> Master Schema maturity -> program-wide surfacing.

## Recommended Next Thread Instructions

Start the next thread with:

> Continue from `docs/vaa1_sprint_handoff_master_schema_agent_persistence_2026-05-18.md`.
> First fix `Characters By Scene` so it populates from the most mature known character list:
> Master Schema first, then Source Media metadata, then Scene Cards, then second-order
> participants only as a last resort. Unknown rows must not appear when known characters
> exist. Then run frontend and backend tests.

## Immediate Implementation Checklist

1. Inspect current `MeaningPlotPanel.tsx` around:
   - `masterSchemaNarrativeAgentProfiles`
   - `sourceMetadataNarrativeAgentProfiles`
   - `sceneCardNarrativeAgentProfiles`
   - `characterSceneGovernanceRows`
   - `participantRows`

2. Ensure known characters populate even with zero detected scene links:
   - rows should show known character names
   - scene entries can say `not surfaced`, `staged`, or `needs scene confirmation`
   - unknown fallback should be suppressed if known source rows exist

3. Ensure `MasterSchemaPanel.tsx` visibly exposes governed subject data:
   - Narrative Agent Profiles
   - character definitions
   - character roles

4. Ensure Source Media metadata update path regenerates Master Schema subject surfaces.

5. Run:
   - `npx tsc --noEmit` from `src/frontend`
   - `npm test` from `src/frontend`
   - `python3 -m unittest tests.test_agent_persistence_contract tests.test_second_order_label_proliferation_contract tests.test_second_order_pipeline_wiring_contract`
   - `python3 -m py_compile api_server.py src/backend/analysis/agent_persistence.py src/backend/analysis/second_order_label_proliferation.py`

## Current Git State Warning

There are many uncommitted modified and untracked files in this sprint. Do not reset or
revert user/worktree changes. Work with the existing modifications.

