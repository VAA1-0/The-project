# Datascene / VAA1 StatsKit, SignificanceKit, and RelevanceRadar

Date: 2026-07-01
Status: schema contract and implementation direction
Branch: petteri

## Purpose

StatsKit, SignificanceKit, and RelevanceRadar form a three-layer interpretation stack for Datascene/VAA1:

1. StatsKit measures source-linked evidence.
2. SignificanceKit explains why a measured or observed pattern matters.
3. RelevanceRadar ranks what matters for a specific analyst task, audience, scope, and lens.

The governing principle is simple: no relevance or significance claim should float free from source evidence. Every claim must remain inspectable through source video time, scene, modality, annotation, BBox/ROI, transcript span, audio segment, network node, or traceback.

## Current StatsKit State

The current StatsKit work has three concrete pieces:

- Schema: `docs/schemas/vaa1.statskit_schema.v1.json`
- Backend agent: `src/backend/analysis/statskit_agent.py`
- API route: `POST /api/analysis/{analysis_id}/statskit/run`

The backend currently reads available analysis artifacts from the result directory and can produce StatsRun JSON artifacts under `stats_runs/`.

Operational source-linked methods:

- POS analysis over transcript text.
- Word frequency over transcript segments.
- Transcript event-rate curve over time.
- Speech-ratio analysis from audio diarization / VAD segments.

Partly implemented or placeholder methods:

- Correlation heatmap currently uses mock variables.
- Simple network metrics currently use mock nodes and edges.
- Visual statistics are not yet attached to the StatsKit agent.
- StatsKit visualizations and interpretations are declared in the schema but not yet generated as a mature workflow.

Frontend state after the 2026-07-06 ground-level StatsKit pass:

- `src/frontend/app/V2components/components/panels/StatsKitPanel.tsx` is now a first-class Datascene panel, registered in `LayoutHost`.
- The Tools panel exposes `Open StatsKit` as a program-level workspace entry point.
- The panel listens to the active analysis, reads real Source Media metadata, and derives source-evidence metrics from actual metadata, mature anchors, harvested evidence counts, audio readiness, and external source references.
- The panel can call `POST /api/analysis/{analysis_id}/statskit/run` for transcript/audio StatsKit methods.
- The panel now behaves as a ground-level StatsKit workbench:
  - ordered left-column dropdowns: Stats workbench table, Significance workbench, Relevance scanner, and Stats metadata view;
  - a right-column Visualization panel that can target Stats, Significance, or Relevance data;
  - row checkboxes and check-all controls for Stats, Significance, and Relevance rows;
  - selectable Stats rows with method, value, evidence, required layer, source action, and visualization eligibility;
  - visualization renderers for bars, percent/duration bars, histogram, boxplot, heatmap, timeline, network-style node map, and table;
  - a Stats metadata view that groups schema coverage, Master Schema category audit, missing-data audit, source-layer delivery plan, delivery audit, and JSON object summaries under one collapsed governance surface.
- StatsKit category counts are audited against Master Schema resolved evidence, entity registry rows, and raw substrate so mature data such as person detections does not silently disappear from the workbench.
- Narrative Agent may still show a character-local StatsKit/Significance/Relevance summary, but that is a consumer surface. StatsKit itself is not owned by the Narrative Agent panel.

Important boundary:

The current panel is operational as a ground-level measurement and review workbench for program-level source metadata, Master Schema/category audit, available mature anchors, harvested evidence counts, selected rows, missing-data diagnostics, and backend StatsRun launch. It does not yet claim completed AI interpretation. Missing audio, transcript, BBox/ROI, shot-boundary, speaker-linked diarization, or source-time evidence must remain visible as missing evidence, not silently converted into significance.

## New Schema Contract

The combined schema lives at:

`docs/schemas/vaa1.significance_relevance_radar.schema.json`

It defines the top-level contract:

```json
{
  "StatsKit": {},
  "SignificanceKit": {},
  "RelevanceRadar": {}
}
```

This structure intentionally keeps StatsKit as the measurement and provenance layer, while SignificanceKit and RelevanceRadar remain interpretive layers above it.

## Data Flow

The intended flow is:

1. Datascene analysis artifacts produce source evidence.
2. StatsKit creates StatsRun, StatsResult, StatsInterpretation, and EvidenceLink objects.
3. SignificanceKit creates source-linked SignificanceClaim objects from StatsKit evidence, mature annotations, scene cards, network nodes, and multimodal detections.
4. RelevanceRadar ranks those claims against a concrete analysis context.
5. The UI presents ranked next actions and source-linked explanations.

Example:

- StatsKit detects a high speech-ratio section and links it to audio VAD timestamps.
- Scene cards and Narrative Agent evidence identify which characters are present.
- SignificanceKit proposes that the scene has high narrative or interpersonal significance.
- RelevanceRadar ranks it as important for `narrative_analysis` or `reporting`.
- The analyst can click the score and jump to source evidence, not just read a summary.

## SignificanceKit

SignificanceKit is for explaining why evidence matters. It is not a truth engine and does not overwrite mature source data.

Each SignificanceClaim includes:

- claim status: draft, candidate, reviewed, accepted, disputed, rejected
- claim type: statistical, practical, social, cultural, strategic, narrative, emotional, informational, or mixed
- scope: micro, meso, or macro
- object type: scene, segment, video, collection, actor, event, theme, network, or corpus
- perspective: viewer, analyst, institutional, social context, comparative, and related positions
- orientation: intrinsic or external
- expression: explicit, implicit, or inferred
- evidence support: primary evidence, secondary evidence, counter evidence, missing evidence
- traceback: source videos, scenes, methods, annotations, visualizations, and forensic renders

This lets Datascene distinguish between:

- what is in the source,
- what has been measured,
- what has been inferred,
- why it matters,
- who it matters to,
- and how strongly the evidence supports the interpretation.

Current UI status:

- SignificanceKit is represented as a schema-aware workbench, not only a text claim list.
- The workbench exposes scope, object type, perspective position, intrinsic/external orientation, explicit/implicit/inferred expression, audience profile, significance dimension, score, evidence support, status, and missing evidence.
- Significance rows can be selected individually or checked in bulk and visualized through the shared Visualization panel.
- The current claims are still candidate/readiness claims derived from available StatsKit/source signals. Counter-evidence, alternate interpretations, source-action drilldown, accepted/disputed review workflows, and richer claim authoring still need serious usability work before SignificanceKit can be considered mature.

## RelevanceRadar

RelevanceRadar ranks evidence and claims for a specific analyst context.

Core context fields:

- research question
- analyst goal
- target audience
- scope
- active lens

Core scores:

- overall relevance
- task relevance
- evidence relevance
- novelty relevance
- comparative relevance
- interpretive relevance
- source relevance
- viewer relevance

Core radar dimensions:

- task fit
- source strength
- novelty
- comparative value
- interpretive value
- actionability

This should drive the UI in practical ways:

- click a dimension to filter results
- click a score to open evidence
- show why this matters
- show counter evidence
- allow analyst weighting
- allow audience profile switching

Current UI status:

- RelevanceRadar is represented as a Relevance scanner dropdown with selectable rows, checkboxes, check-all controls, a row inspector, and visualization support through the shared right-column Visualization panel.
- The scanner currently ranks readiness-style relevance/significance rows and explains evidence labels and next actions.
- It is not yet a mature RelevanceKit/Radar workflow: row selection inspects and visualizes, but does not yet filter all StatsResults, open source evidence, apply analyst weighting, show counter-evidence, or switch audience/task profiles as a full operational workflow.

## Narrative Agent Use

For the Narrative Agent panel, this stack should support a character-first workflow, but Narrative Agent should not become the home of StatsKit:

1. Choose one character.
2. Show the most relevant source-linked evidence for that character.
3. Show what Datascene currently believes.
4. Show what the analyst should do next to strengthen the character profile.
5. Explain significance across macro, meso, and micro levels.

The same character can have:

- macro agency: role in the full video, collection, or story arc
- meso agency: role within scenes or sequences
- micro agency: local speech, gesture, gaze, reaction, action, or interaction

The same character also needs multiple perspectives:

- the character's implied or explicit point of view
- other characters' views of that character
- the viewer's likely interpretation
- the analyst's interpretive frame
- institutional or genre-specific context

RelevanceRadar should help decide what to show first. For example, if the analyst's task is narrative analysis, scenes with high character agency and strong source evidence should rise above low-confidence visual coincidences.

Panel ownership rule:

- StatsKit panel: program-wide measurement, provenance, source evidence metrics, and backend StatsRun control.
- Narrative Agent panel: character-specific consumption of StatsKit, SignificanceKit, and RelevanceRadar outputs.
- Meaning / Plot panel: lens-specific interpretation and network visualization that can consume StatsKit evidence.
- Search and Scene Cards: retrieval and review surfaces that can rank or filter using RelevanceRadar output.

Adjacent developer-layer rule:

- Performance observability records whether Datascene can run: upload, quick sweep, science scan, forensic scan, extraction, maturation/iteration, manual program use, export, UI render, resource cost, bottlenecks, and readiness verdicts.
- Data maturation economics records whether a maturation pass was worth doing: compute/storage/analyst cost, candidate yield, mature yield, noise, reuse, iteration ROI, and diminishing returns.
- These layers should live under the hood using `docs/schemas/vaa1.performance_observability_layer.schema.json` and `docs/schemas/vaa1.data_maturation_economics.schema.json`.
- StatsKit should consume source-linked analytical data, not become a metadata parade for developer runtime diagnostics.

## Design Implications

This feature should not become another dense panel of metrics. It should answer:

- Why is this item relevant now?
- What evidence supports that judgment?
- What source should I inspect?
- What can I confirm, reject, or compare next?

Recommended UI surfaces:

- Program-level StatsKit panel for active analysis evidence metrics and StatsRun control.
- Character significance card in Narrative Agent panel as a consumer surface.
- RelevanceRadar summary beside the chosen character or selected scene.
- Ranked next-actions list.
- Clickable evidence drawer with source time, BBox/ROI, audio, transcript, scene, and traceback.
- Optional radar chart only after the ranked evidence list is already useful.

## Governance

Rules encoded in the schema:

- no significance without evidence
- statistical significance must report method
- interpretive significance requires reasoning summary
- claims must support counter evidence
- high-level claims require manual review
- aggregate claims must expand to source evidence
- perspective must be explicit
- scores are assistive, not authoritative

This is aligned with the Datascene/VAA1 principle that analyst-confirmed source-linked evidence remains the highest authority.

## Delivery Notes

Do not present this as a completed AI interpretation system yet. The contract is ready for implementation, and the ground-level StatsKit workbench is now present in the UI. SignificanceKit and RelevanceRadar/RelevanceKit are schema-aware and selectable, but their usability, source-linking, counter-evidence handling, weighting, and review workflows are still next work.

The next practical implementation should:

1. Persist StatsKit run artifacts into the active analysis status so every panel can consume the same run outputs.
2. Persist the missing source layers required for actual StatsKit measurements: true shot-boundary intervals, audio event intervals for speech/silence/noise/music, music/sound classifier output over time, color/brightness/contrast frame-window extraction, and speaker-linked diarization turns.
3. Feed SignificanceKit claims from selected StatsResults and analyst-confirmed evidence, including primary, secondary, counter, and missing evidence.
4. Feed RelevanceRadar from actual StatsResult and EvidenceLink objects rather than readiness heuristics alone.
5. Render character-local relevance inside the Narrative Agent panel for the selected character.
6. Render scene/video-level relevance in StatsKit, Meaning / Plot, Search, Scene Cards, and Source Media where useful.
7. Rank evidence and recommendations instead of showing another raw list.
8. Make every radar dimension click through to source-linked evidence and optionally filter StatsResults.
9. Add analyst weighting, audience profile switching, counter-evidence display, and accept/dispute/reject review actions.
10. Keep all claims candidate until analyst-confirmed or otherwise governed.

Quality bar:

No scaffold-only UI. If a score, claim, or recommendation appears, it must point to actual source evidence or explicitly say what evidence is missing.
