# VAA1 StatsKit governed interpretation operationalization plan

Date: 2026-08-01

## Delivered vertical slice — research question to report sentence

The first executable path is Expressions ↔ prosody:

`research question → validated persisted plan → native scene-level run → governed statistical results → paired-scene visualization data → source-linked significance proposition → draft report sentence`

The backend persists this chain in `stats_research_question_workflow.json`. Each computed result records the Spearman coefficient, paired-scene sample size, variables, source intervals, uncertainty availability, significance-test status, substantive proposition, chart specification, and report sentence. StatsKit Analysis setup runs this workflow and exposes every contributing scene as a Video seek action. The same native result feeds Statistical overview, Visualization, and Significance workbench.

This motor uses governed scene intervals, expression detections, and audio prosody. A run is refused when the relationship is not estimable; the backend does not manufacture a placeholder result.

## Objective

Turn the governed statistical interpretation schemas into the operating contract between StatsKit measurements, Significance, Visualization, review, report writing, persistence, reopening, and export. Primary workbenches show actual records. Readiness and configuration targets remain in the Taxonomy and Stats metadata governance disclosures rather than competing with computed results.

## Operating flow

1. Analysis setup defines the research question, analytical unit, variables, baseline, time policy, missing-data policy, weighting, multiplicity, and planned methods.
2. Validation resolves every variable to a persisted Datascene source layer and reports method eligibility.
3. Eligible motors create statistical results with population accounting, estimates, uncertainty state, diagnostics, evidence references, source intervals, limitations, and interpretive permissions.
4. Results create interpretation propositions without adding causal, intentional, identity, general-population, or statistical-significance claims unless the plan explicitly supports them.
5. Propositions populate Significance. Their measured association magnitude, evidence support, scope, frames, counter-evidence, qualifiers, and source intervals remain separate fields.
6. Numeric results and significance dimensions populate Visualization directly. Selecting a workbench row selects its visualization target and data.
7. Sentence plans bind propositions, numbers, qualifiers, and citations before deterministic or constrained realization.
8. Analyst decisions are appended to the decision ledger. Accepted or qualified sentences become eligible for governed export.

## Delivery status

### Operating now

- Native scene-level descriptive and Spearman relationship motors.
- Paired-scene evidence and video-source navigation.
- Native relationships adapted into measured Significance rows.
- Significance selection drives the Visualization target.
- Association magnitude is labelled as magnitude, not statistical significance.
- Non-operating rows are absent from ordinary Stats families.
- Taxonomy retains the complete readiness/configuration registry.
- Corrected core and frontend/backend API schemas are stored under `docs/schemas`.

### Next implementation slice

- Persist `analysis_plan` records with version and validation state.
- Add an API adapter that returns the new request/response envelopes while retaining current endpoints during migration.
- Normalize native interpretation artifacts into `statistical_result` records.
- Persist propositions and sentence plans through the interpretation registry.
- Add analyst review controls to Significance using the canonical decision ledger.
- Export accepted report sentences with checksums and provenance references.

## Source-layer execution map

| Source layer | Current producer | Actual measures unlocked | Stats families |
|---|---|---|---|
| Transcript timeline | governed transcript artifact | words, rate, questions, negation, utterance spans | descriptive, linguistic, temporal |
| POS token trace | POS and dependency/SFL artifacts | POS counts, diversity, grammatical profiles | descriptive, linguistic, cross-tabulation |
| Dependency/SFL | `dependency_sfl_stage1` | process, proposal, modality and speech-function ratios | linguistic, correlation, narrative |
| Expression | expression artifact with numeric valence/activation | expression diversity, valence and activation series | descriptive, correlation, temporal |
| Audio prosody | governed prosody artifact | speech rate and vocal emphasis | audio, correlation, temporal |
| Audio intervals | audio-event and diarization artifacts | speech/music/noise coverage and speaker turns | audio, distribution, cross-tabulation |
| Objects/props | governed object and Scene Card evidence | occurrence, diversity and density | visual, descriptive, correlation |
| Scene Cards | governed scene intervals | scene aggregation and paired-scene matrices | descriptive, correlation, narrative |
| Shot and visual tone | governed shot/tone artifacts | duration, brightness, contrast and saturation series | visual, distribution, temporal |
| Comparison corpus | selected saved analyses | video/genre/collection comparisons | comparative, distribution |

## Status conversion rule

The former display statuses are not statistical findings:

- `computed`, `raw`, `candidate`, `reviewed`, and `accepted` may appear in the operating workbench when backed by an actual record.
- `partial`, `experimental`, `nominal`, `not computed`, `missing`, and `needs source layer` belong to governance/configuration views.
- A configuration target becomes operating only after it has a producer, persisted artifact, variable mapping, eligible method, result record, and evidence/source route.
- Zero is a result only when a governed source layer was measured and returned zero. Absence of a producer is never coerced to zero.

## Acceptance checks for each new motor

1. The source artifact exists and is reopenable.
2. Variable type, role, unit, maturity requirement, and source path validate.
3. Population and denominator are explicit.
4. Missingness and effective sample size are recorded.
5. The method eligibility decision is reproducible.
6. Every result has evidence references; timed results have source intervals.
7. Significance receives a proposition, not a duplicate statistic label.
8. Visualization consumes the selected numeric result or dimension.
9. Source actions seek the existing Video panel.
10. Review and export preserve the original result and append decisions rather than overwriting history.

## Completion boundary

The schema work is complete only when an analyst can save a plan, validate it, run actual eligible motors, inspect results, open their sources, interpret them in Significance, visualize selected values, qualify report sentences, reopen the run, and export a provenance-complete bundle.
