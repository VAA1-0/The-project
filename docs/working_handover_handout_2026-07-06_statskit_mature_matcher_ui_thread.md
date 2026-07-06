# Working Handover Handout - StatsKit, Matcher, and Core UI Thread

Date: 2026-07-06

Purpose: preserve the current thread state so the next session can start fresh without losing the design intent, implementation state, and unresolved delivery priorities.

## Core Direction

The General Sprint is still centered on making Datascene/VAA1 deliver actual scalable multimodal analysis, not scaffolds. The main promise is mature data proliferation: confirmed, source-linked truths should make the remaining video array easier to interpret, confirm, search, and reuse.

The governing design principles remain:

- Source-linked data first: every claim should keep source video time, BBox/ROI where available, transcript/audio/metadata evidence, and traceback.
- Mature data should propagate quietly: the analyst should not have to think about a "proliferation bus" as a separate chore.
- User confirmations are authoritative: they seed matching, update graphs, improve raw detection interpretation, and remain correctable.
- Candidate data must be navigable: every candidate shown to the analyst must be verifiable from source.
- Avoid widgety UI: dense data belongs in tables, dropdowns, workbenches, timelines, graphs, or compact indicators.
- Audio evidence must be actual. No placeholder audio scaffolds.

## What Progressed In This Thread

### Search And Existing Analyses

The Search UI work surfaced already existing analyses and search records. Earlier save/project crash work was repaired before this thread moved into mature data and StatsKit work.

Known Git state: commit `13db28e` was manually pushed by the user to `origin/petteri`.

### Mature Data Proliferation And Matcher

The central issue remains that confirmed known detections, such as James Bond or Dr. Madeleine Swann, should suppress later "confirm character / narrative agent" ambiguity when the same identity is strongly supported by mature evidence.

Work and design direction established:

- Mature detections should cascade from confirmed anchors into candidate matches.
- Confirmed matches should strengthen future matching, like a puzzle becoming easier as more pieces are placed.
- The matcher should support visual, audio, object, named entity, and repeated setting/pattern detection.
- The open topology SOM/matcher must remain traceable, with visible nodes/edges in the Meaning Network where useful.
- Matcher output must include verifiable choices, preferably with thumbnail galleries, source jumps, and batch confirm/drop/defer.
- Raw person tracks need systemic mitigation: they should not remain inert "person track" labels when mature narrative-agent, action, or entity evidence is available.
- Scene-level presence is useful but not enough. The system also needs on-screen presence, speaking, listening, and interaction states.

Existing matcher documentation to consult:

- `docs/vaa1_open_topology_som_matcher_handout_2026-06-22.md`
- `docs/working_handover_handout_2026-06-23_mature_matcher_operationalization.md`

### Meaning / Plot Panel

The Meaning / Plot panel was redesigned toward a cleaner analytical workspace.

Current intended behavior:

- Lens buttons are real interpretive modes: Aristotle, Freytag, Campbell, Frye, Booker, and Boje.
- The Meaning Network graph is the main object of the panel.
- Lens changes should reorganize and recolor the graph according to the theoretical view.
- Known scenes should remain visible even when interpretation changes.
- List-like features should be behind dropdowns.
- The graph should support expansion/fullscreen workspace behavior.
- Structural changes should be shown as an indicative color track.
- Segments should be treated as nodes with edges.

Remaining issues:

- Lens-specific descriptions should be short and explanatory.
- Boje showing `0 readings` needs investigation.
- Some graph support buttons were reported mute: add node, add edge, quick confirm, copy/paste anchor, rename node, open traceback drawer, jump to video time.
- Structural indication appeared overly concentrated at the beginning of the video array in one test; investigate whether the data source or graph layout is clipping or front-loading the evidence.
- Need natural-language explanations of how each lens changes the interpretation of represented phenomena and character relations.

### Narrative Agent Panel

The Narrative Agent panel is still too list-heavy and concept-heavy for practical character analysis.

Confirmed design direction:

- Start with a simple character selector.
- Then show recommended next actions for improving that character's mature data.
- Then show significance/relevance perspectives for the chosen character.
- Keep analysis in the Narrative Agent panel. Do not throw the analyst to Traceback or Meaning/Plot unless they explicitly choose a drill-down action.
- Each headline/work area should be its own dropdown so the analyst can focus on one work area at a time.
- Dramatic Archetype lens changes should produce interpretable analysis, not only visual color changes.
- Narrative-agent lensing should include macro, meso, micro, intrinsic, external, implicit, and explicit dimensions:
  - Macro: narrative agency across the whole work.
  - Meso: scene-level agency.
  - Micro: moment/situation-level agency.
  - POV: character's view, others' view of the character, and viewer-facing interpretation.
- The Character Annotation Toolkit should be available economically inside the Narrative Agent panel, including node and edge annotation features.
- Agent-related meaning annotations should become mature data and propagate to Knowledge/Meaning Network nodes and edges.

Remaining issues:

- User Confirmed Anchor controls were redirecting to Traceback. They should display evidence in-panel.
- Dramatic Archetype controls were redirecting or not changing the graph meaningfully.
- The panel still contains too many advanced terms before it provides a simple analytical path.

### StatsKit, SignificanceKit, And RelevanceRadar

StatsKit was introduced as a dedicated panel, not just a Narrative Agent subfeature.

Relevant new or modified artifacts include:

- `docs/vaa1_significance_relevance_radar_statskit_contract_2026-07-01.md`
- `docs/schemas/vaa1.statskit_schema.v1.json`
- `docs/schemas/vaa1.significance_relevance_radar.schema.json`
- `src/backend/analysis/statskit_agent.py`
- `src/frontend/app/V2components/components/panels/StatsKitPanel.tsx`

Current UI state after the 2026-07-06 ground-level StatsKit pass:

- StatsKit appears in the top panel menu.
- It shows a workbench table with selectable rows, row checkboxes, check-all controls, adjustable columns, and a selected-stat inspector.
- It exposes stats families:
  - Level I / Descriptive
  - Level II / Cross-tabs
  - Level III / Correlation
  - Level IV / Comparative
  - Level V / Distribution
  - Social network
  - Narrative
  - Linguistic
  - Visual
  - Audio
  - Temporal
- Some values are computed from available source metadata, e.g. object counts, runtime, event rates, object density, audio readiness, scene transition proxy.
- Many rows are still `not computed` because required source layers are missing.
- The current Run StatsKit path often reports that the Python endpoint is unavailable, then builds a local/fallback StatsRun from loaded metadata.
- Master Schema category audit now checks StatsKit listed categories against Master Schema resolved evidence, entity registry rows, and raw substrate, so data such as person detections can surface instead of incorrectly reporting zero.
- Missing-data and source-layer delivery audits identify why blocked measures are not yet actuals.
- The panel layout is now ordered as:
  - Stats workbench table;
  - Significance workbench;
  - Relevance scanner;
  - Stats metadata view.
- Visualization occupies the right column beside these dropdowns.
- Visualization can target Stats, Significance, or Relevance data.
- Visualization modes now have operational renderers for bars, percent/duration bars, histogram, boxplot, heatmap, timeline, network-style node map, and table.
- SignificanceKit is represented as a schema-aware workbench with perspective, intrinsic/external orientation, explicit/implicit/inferred expression, audience, significance dimension, score, evidence support, status, and missing evidence.
- Relevance scanner rows are selectable and inspectable, with checkboxes and check-all controls.
- Stats metadata view groups schema coverage, Master Schema audit, source-layer plan, missing-data audit, delivery audit, and schema summaries under one collapsed governance surface.

### Program Observability And Maturation Economics

The performance observability schema supplied in this thread should be treated as a whole-program developer layer, not as a StatsKit/Significance/Relevance analysis panel.

Relevant new contracts:

- `docs/schemas/vaa1.performance_observability_layer.schema.json`
- `docs/schemas/vaa1.data_maturation_economics.schema.json`

Intended scope:

- uploading;
- quick sweeps;
- science scan;
- forensic scan;
- speech/audio/visual extraction;
- data maturation and iteration;
- manual program use;
- matcher/proliferation runs;
- StatsKit, SignificanceKit, and RelevanceKit maturation;
- export;
- UI render and responsiveness.

The first surface should be an under-the-hood developer/diagnostic view with full fidelity. It may show stage timings, resource peaks, input/output volumes, cache behavior, database behavior, UI responsiveness, errors, bottlenecks, provenance integrity, benchmark comparisons, and engineering recommendations. It should not compete with analyst workbenches.

The companion economics layer is paramount because runtime observability only tells us whether Datascene can run. Data maturation economics tells us whether a pass was worth doing:

- compute/storage/analyst cost;
- candidate, reviewed, confirmed, mature, rejected, deferred, and orphan yield;
- noise ratio and maturation rate;
- analyst cost per mature item;
- compute cost per mature item;
- reuse across Master Schema, BBox/ROI, transcript, audio, objects, scene cards, Meaning Network, Narrative Agent, Search, StatsKit, SignificanceKit, RelevanceKit, Traceback, and report/export;
- iteration ROI and diminishing-return flags.

Later product work can decide what subset of this developer view should be exposed to users, customers, or exported governance reports. For now, the internal view should be complete.

The user clarified the intended StatsKit substance:

- Level I: descriptive statistics for persons, organizations, places, objects, actions, topics, emotions, camera shots, speakers, sounds, music, colors, percentages, durations, means, medians, variance, standard deviation.
- Level II: cross-tabulations such as gender by speaking time, location by emotion, speaker by topic, object by violence, camera angle by authority, time by theme, video by genre.
- Level III: correlations such as music intensity by negative emotion, camera movement by conflict, noise by interruption, darkness by fear, speech speed by stress, object density by narrative complexity.
- Level IV: comparative statistics across videos, outlets, genres, and corpora.
- Level V: distributions with histogram, density, boxplot, percentiles, quartiles, and outliers.
- Social network statistics: degree, betweenness, closeness, eigenvector, density, diameter, communities, cliques, brokerage, structural holes.
- Narrative statistics: conflict frequency, resolution frequency, character introduction rate, scene transition rate, topic transition entropy, branching, hero/villain/suspense/emotion curves, dialogue balance.
- Linguistic statistics: word frequencies, type-token ratio, lexical diversity, POS, dependency, sentiment, readability, speech acts, questions, negation, pronouns, modality, hedges, certainty.
- Visual statistics: brightness, contrast, color entropy, movement entropy, object density, object diversity, face density, text density, motion vectors, shot duration, camera motion, scene complexity.
- Audio statistics: speaking ratio, silence ratio, noise ratio, music ratio, loudness, pitch, speech tempo, pause duration, speaker overlap, acoustic diversity.
- Temporal statistics: rolling averages, moving windows, cumulative counts, event-rate curves, burst detection, change-point detection, temporal autocorrelation.

## Immediate Bottlenecks

1. Ground-level StatsKit is now present as a professional workbench, but it still needs deeper source-linking and persisted backend StatsRun consumption.
2. SignificanceKit and RelevanceRadar/RelevanceKit are schema-aware and selectable, but their usability still needs serious work: source drilldown, counter-evidence, analyst weighting, audience/task switching, claim review actions, and result filtering are not mature yet.
3. Some StatsKit actuals are still blocked by missing source layers:
   - timed speaker diarization
   - speaker-linked transcript turns
   - timed audio VAD/music/noise/loudness/pitch/speech tempo
   - shot boundary intervals
   - expression/affect time series
   - demographic/role labels
   - corpus/video-set selection
   - confirmed interaction edges for network statistics
4. Visualization choices must remain honest: if a visualization cannot be rendered from current data, show exactly which source layer is missing.
5. Matcher/SOM and StatsKit may affect performance. Use cached lightweight thumbnails, representative clips, progressive refinement, and explicit refresh controls where needed.
6. Performance observability is not yet implemented. Without it, Datascene cannot systematically compare upload, quick sweep, science scan, forensic scan, maturation/iteration, manual use, export, and UI render costs.
7. Data maturation economics is not yet implemented. Without it, Datascene cannot reliably tell when an iteration pass is high-yield, noisy, wasteful, or showing diminishing returns.

## Recommended Next Implementation Sequence

### 1. Mature StatsKit From Ground-Level Workbench To Actual Source-Linked Analytics

- Persist StatsKit run artifacts into the active analysis status so every panel consumes the same StatsRun, StatsResult, StatsInterpretation, and EvidenceLink objects.
- Connect computed rows to source navigation actions wherever evidence exists.
- Deliver the missing source layers required for actual measures:
  - true shot-boundary intervals;
  - audio event intervals for speech, silence, noise, and music;
  - music/sound classifier output over time;
  - color/brightness/contrast extraction from sampled frames or frame windows;
  - speaker-linked diarization turns.
- Expand visualization beyond current numeric workbench renderers into source-linked charts where clicking marks a row, evidence object, or source interval.
- Keep the Stats metadata view under the hood for governance and debugging, not as the primary analyst experience.

### 2. Mature SignificanceKit And RelevanceRadar/RelevanceKit Usability

- Feed SignificanceKit claims from actual StatsResults, EvidenceLinks, and analyst-confirmed evidence.
- Require primary, secondary, counter, and missing evidence support before any claim can move beyond candidate.
- Add accept, dispute, reject, and request-evidence review actions.
- Make Relevance scanner rows filter StatsResults and open source-linked evidence.
- Add analyst weighting, task/audience switching, and counter-evidence display.
- Keep all scores assistive and candidate until governed by review.

### 3. Then Stabilize Narrative Agent Panel

- Put the character selector first.
- Show character-specific next best actions.
- Keep User Confirmed Anchor, lens readings, and evidence views inside the panel.
- Add practical dropdowns for each headline/work area.
- Integrate the Character Annotation Toolkit in a compact form.
- Make lens views change both graph and prose explanation.
- Consume the mature StatsKit/Significance/Relevance outputs as character-local summaries, without making Narrative Agent the owner of the StatsKit stack.

### 4. Then Continue Matcher/Mature Proliferation

- Build a verified sample pool for each mature identity/object/entity.
- Add audiovisual sample support, not just visual thumbnails.
- Allow batch confirm/drop/defer from matcher review.
- Ensure confirmed matches write mature data and propagate to:
  - BBox overlays
  - Meaning/Knowledge Network nodes and edges
  - Narrative Agent panel
  - Search
  - Master Schema
  - Traceback
- Reduce scene-bound restriction when mature cross-scene evidence is strong.

### 5. Add Under-The-Hood Observability And Economics

- Generate performance observability records for upload, sweep, scan, maturation, manual-use, export, and UI-render stages.
- Generate data maturation economics records for candidate discovery, analyst review, mature propagation, matcher iteration, and StatsKit/Significance/Relevance maturation passes.
- Store both records under the active analysis/run output.
- Build the first developer-only diagnostic view as an under-the-hood surface, not an analyst-facing panel.
- Use observability to decide runtime readiness and bottleneck sprints.
- Use economics to decide whether to continue iteration, tune thresholds, add source layers, improve review UI, cache/batch work, or stop a low-yield pass.

## Manual Test Checklist For The Next Thread

1. Start backend/frontend with the latest documented start sequence.
2. Load the latest saved analysis.
3. Open StatsKit from the top panel menu.
4. Run StatsKit.
5. Switch through every Stats family and verify computed/missing rows.
6. Click a computed row and verify the inspector opens with evidence and source navigation.
7. Click a missing row and verify it explains the missing source layer.
8. Use Stats, Significance, and Relevance checkboxes/check-all controls and verify the right-column Visualization target updates.
9. Switch visualization modes and verify bars, histogram, boxplot, heatmap, timeline, network-style node map, and table render selected numeric data or a precise missing-data reason.
10. Open Stats metadata view and verify it contains schema coverage, Master Schema category audit, source-layer plan, missing-data audit, delivery audit, and schema summaries.
11. Click Relevance scanner rows and verify they inspect linked evidence labels and next actions. Future work: filter StatsResults and open source evidence.
12. Click SignificanceKit rows and verify perspective, orientation, expression, evidence support, status, and missing evidence are visible. Future work: counter-evidence and review actions.
13. Confirm no panel redirects unless the analyst explicitly chooses a drill-down action.
14. Open Meaning/Plot and verify lens changes preserve known scenes while changing interpretive structure.
15. Open Narrative Agent and verify the first interaction is character selection, not a wall of features.
16. Future observability check: run one upload/scan/maturation path and verify a developer-only observability record captures stages, timings, resources, bottlenecks, and verdict.
17. Future economics check: run one maturation/iteration path and verify an economics record captures cost, yield, noise, reuse, ROI, and diminishing-return status.

## Current Repository Caution

The worktree is dirty and contains many ongoing changes and untracked files. Do not revert anything casually. Known changed areas include:

- `api_server.py`
- `src/backend/analysis/statskit_agent.py`
- `src/frontend/app/V2components/components/panels/StatsKitPanel.tsx`
- `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`
- `src/frontend/app/V2components/components/panels/MasterSchemaPanel.tsx`
- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/lib/api-service.ts`
- StatsKit, Significance, RelevanceRadar schemas and documentation
- Performance observability and data maturation economics schemas
- Search and mature-data schema changes
- Some generated deck/material files

Before editing in the next thread, run:

```bash
git status --short
```

Then inspect only the files relevant to the next implementation slice.

## Suggested Fresh-Thread Prompt

Please read `docs/working_handover_handout_2026-07-06_statskit_mature_matcher_ui_thread.md`, then inspect `src/frontend/app/V2components/components/panels/StatsKitPanel.tsx`, `src/backend/analysis/statskit_agent.py`, `docs/schemas/vaa1.statskit_schema.v1.json`, `docs/schemas/vaa1.significance_relevance_radar.schema.json`, `docs/schemas/vaa1.performance_observability_layer.schema.json`, and `docs/schemas/vaa1.data_maturation_economics.schema.json`. Ground-level StatsKit is now present. Start by persisting actual StatsRun/StatsResult/EvidenceLink outputs into the active analysis, then mature SignificanceKit and RelevanceRadar/RelevanceKit usability with source drilldown, counter-evidence, analyst weighting, review actions, and filtering. Keep the performance observability and data maturation economics work as an under-the-hood developer layer for the whole program: upload, quick sweeps, science scan, forensic scan, maturation/iteration, manual program use, export, and UI rendering.

## Tests

For the latest StatsKit UI implementation before this handout update:

- `cd src/frontend && npx tsc --noEmit`
- `node --test src/frontend/tests/manual-annotation-governance.test.mjs`
- `git diff --check -- src/frontend/app/V2components/components/panels/StatsKitPanel.tsx src/frontend/tests/manual-annotation-governance.test.mjs`

After editing this handout, rerun the same focused checks before moving on.
