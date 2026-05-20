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

Second invariant now promoted from `docs/vaa_1_narrative_agent_maturity_corrections.md`:

The **Narrative Agent is the user-facing semantic subject**.

`identity`, `Identification`, `identity_affirmation`, `identity_triangulation`, and
`Identity leaf` remain tolerated as internal legacy schema/API fields while the migration
is in progress, but they must not be the analyst-facing concept. In UI copy, panel names,
task wording, and sprint language, identity-related work should be governed under
**Narrative Agent** language.

Compatibility rule:

- Do not break saved `ManualVisualAnnotation` records or backend artifacts by renaming
  storage keys in one large cut.
- Add UI aliases and adapter functions first.
- Keep legacy field names at API/storage boundaries until a versioned schema migration is
  available.
- Test that the UI no longer exposes identity-first language while existing payloads still
  load and save.

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

## Current Sprint Priority Order

### P0 - Traceback visualization alive

The first priority is now to make the traceback tool visibly alive in the UI.

Minimum viable traceback visualization:

1. Add a dedicated traceback affordance on BBox/ROI, object rows, Narrative Agent rows,
   Scene Browser rows, and report/meaning candidates when source refs exist.
2. Open a navigable Traceback panel or drawer that shows:
   - current mature claim / Narrative Agent label
   - authority level
   - source evidence chain
   - timestamps and source jumps
   - bbox/frame refs when present
   - raw detector substrate preserved as provenance, not as semantic truth
3. Support one-click navigation from traceback nodes back to video time / panel source.
4. Use stable selectors so the planned DOM/Playwright fixture can prove traceback is
   visible, clickable, and source-linked.
5. Acceptance: a visible mature BBox / ROI label can be traced back to raw detector,
   manual annotation, metadata, expression, transcript, or second-order source evidence.

Traceback visualization must take precedence over further semantic feature expansion.

### P1 - Identity-language migration under Narrative Agent governance

Implement a compatibility-safe semantic migration:

1. Create UI vocabulary adapters:
   - `Identification` -> `Narrative Agent`
   - `Identity leaf` -> `Narrative Agent`
   - `identity candidate` -> `Narrative Agent candidate`
   - `identity triangulation` -> `Narrative Agent triangulation`
   - `identity_affirmation` -> analyst-facing `Narrative Agent label`
2. Do not rename persisted fields yet. Map legacy field names to user-facing labels at
   panel and service boundaries.
3. Add tests that grep rendered/source copy for forbidden user-facing identity phrases,
   while allowing internal API/storage names.
4. Rename panel tab titles and dropdown category labels before changing backend schemas.
5. Update Master Schema resolved evidence categories so legacy `identity` records surface
   as Narrative Agent evidence in UI.
6. Keep import/export compatibility with old analyses by reading both legacy and future
   Narrative Agent field names.
7. Only after UI and service adapters are stable, introduce a versioned backend schema:
   `narrative_agent_candidate`, `narrative_agent_label`, `speaker_agent_link`,
   `narrative_agent_triangulation`.

### P2 - BBox / ROI Narrative Agent behavior

Recently completed and still under manual test:

- Raw detections no longer surface as mature BBox/ROI labels.
- Known Narrative Agent dropdowns are present in BBox and native ROI flows.
- Expression-derived Narrative Agent saves persist.
- Orphan expression boxes now initiate expression-owner person bbox requests rather than
  turning expression bboxes into person objects.

Remaining work:

- Prove this in a rendered DOM/Playwright fixture.
- Ensure the traceback affordance is visible on every mature/synthesized person bbox.
- Confirm object-label corrections do not bleed by raw label across scenes.

### P3 - Characters By Scene and agent persistence

Status:

- Master Schema / metadata / Scene Card subject sources have been wired into Meaning / Plot.
- Unknown fallback suppression has been improved.
- Agent persistence exists as a governed candidate family, but needs richer UI confirmation
  and traceback explanation.

Remaining:

- Finish scene membership confirmation controls.
- Make persistence candidate score explanations visible in traceback.
- Confirmed persistence must mutate Master Schema with provenance, not raw tracker ids.

### P4 - User-chosen model/runtime use

Goal:

- Let the user choose the detection/rendering runtime where VAA1 has viable alternatives,
  instead of hard-coding one operational path.

Required scope:

- YOLOv8 model choice and configuration.
- FFmpeg path/configuration.
- Alternative detector/runtime options where available.
- Clear UI/settings disclosure of which runtime produced which artifact.
- Traceback must record model/runtime choice, version, path, parameters, and fallback reason.

Compatibility rule:

- Existing YOLOv8 and FFmpeg defaults must continue to work.
- Alternative paths must be opt-in or explicitly selected.
- A failed alternative must fall back cleanly or report an actionable error without corrupting
  the analysis ledger.

### P5 - User agreement and consent layer

Goal:

- Add a visible user agreement / operating consent layer for local analysis, external APIs,
  model choices, data retention, source media handling, and generated derivative artifacts.

Required scope:

- First-run agreement.
- Per-feature consent where a feature sends data outside the local environment.
- Clear distinction between local processing and external processing.
- Agreement state stored locally and inspectable.
- Export/report disclosure of analysis conditions where relevant.

Acceptance:

- VAA1 must not silently use external services, upload source media, or run paid/remote
  analysis without a user-visible agreement path.

### P6 - LLM API integration governance

Goal:

- Integrate LLM API use as a governed, optional analysis layer rather than an invisible
  dependency.

Required scope:

- API key configuration and validation.
- Model selection.
- Cost/rate-limit awareness.
- Prompt/version provenance in traceback.
- Clear marking of LLM-generated interpretation as candidate/inferred until supported by
  source evidence or analyst confirmation.
- Failure modes that do not block local/non-LLM analysis.

Compatibility rule:

- The core VAA1 pipeline must remain usable without an LLM API key.
- LLM outputs must feed Master Schema / traceback through governed candidate routes, not
  directly overwrite mature data.

### P7 - Executable packaging

Goal:

- Package VAA1 into an `.exe`/desktop-distributable workflow suitable for non-developer use.

Required scope:

- Startup orchestration for backend, frontend, local services, and required binaries.
- Bundled or discoverable FFmpeg/runtime dependencies.
- Configuration UI for paths, ports, models, and API keys.
- Update/repair path for common startup failures.
- Logs and diagnostics suitable for support.
- Preserve the current development run scripts as the engineering path.

Acceptance:

- A user can launch VAA1 without manually starting backend/frontend terminals.
- Packaging must not hide traceback, consent, model/runtime, or data-location governance.

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

0. Build the first visible Traceback panel/drawer:
   - source refs from BBox/ROI, object rows, Narrative Agent rows, scene rows, and
     meaning candidates
   - source-jump actions
   - authority and maturity badges
   - stable DOM selectors for tests

1. Add the compatibility-safe Narrative Agent vocabulary layer:
   - UI labels and tab titles use Narrative Agent language
   - legacy field names remain internal
   - tests block user-facing `identity` / `Identification` regression copy

2. Inspect current `MeaningPlotPanel.tsx` around:
   - `masterSchemaNarrativeAgentProfiles`
   - `sourceMetadataNarrativeAgentProfiles`
   - `sceneCardNarrativeAgentProfiles`
   - `characterSceneGovernanceRows`
   - `participantRows`

3. Ensure known characters populate even with zero detected scene links:
   - rows should show known character names
   - scene entries can say `not surfaced`, `staged`, or `needs scene confirmation`
   - unknown fallback should be suppressed if known source rows exist

4. Ensure `MasterSchemaPanel.tsx` visibly exposes governed subject data:
   - Narrative Agent Profiles
   - character definitions
   - character roles

5. Ensure Source Media metadata update path regenerates Master Schema subject surfaces.

6. Run:
   - `npx tsc --noEmit` from `src/frontend`
   - `npm test` from `src/frontend`
   - `python3 -m unittest tests.test_agent_persistence_contract tests.test_second_order_label_proliferation_contract tests.test_second_order_pipeline_wiring_contract`
   - `python3 -m py_compile api_server.py src/backend/analysis/agent_persistence.py src/backend/analysis/second_order_label_proliferation.py`

## Current Git State Warning

There are many uncommitted modified and untracked files in this sprint. Do not reset or
revert user/worktree changes. Work with the existing modifications.
