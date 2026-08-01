# Working handover: Stats research-question and visualization delivery

Date: 2026-08-01
Branch: `petteri`

## Delivered outcome

StatsKit now provides a persisted research-question workflow from validated plan through governed result, source-linked visualization, significance proposition, and draft report sentence.

Delivered cross-signal motors:

- Expressions ↔ vocal delivery
- Expressions ↔ transcript
- SFL ↔ vocal delivery
- Props ↔ SFL processes
- Transcript ↔ vocal emphasis

Each estimable relationship retains Spearman's rho, paired-scene sample size, variables, scene observations, source intervals, uncertainty availability, statistical-test status, substantive reading, visualization specification, and report sentence. Non-estimable relationships are refused rather than represented as results.

## Analyst workflow

1. Open StatsKit and Analysis setup.
2. State or retain the research question.
3. Select a delivered Stats motor and scope.
4. Run the research question.
5. Open Research question view.
6. Choose a computed relationship with Visualize.
7. Inspect the large labelled scatterplot, source-time measurements, and paired-scene table.
8. Select a point or source time to seek the Video panel.
9. Inspect the directly visible draft report sentence.

The research-question text is persisted, while the selected motor currently governs executable variables and method. General natural-language question resolution remains a later delivery.

## Visualization delivery

The relationship view now includes:

- explicit horizontal and vertical measures with units;
- Spearman's rho and sample size;
- readable numeric axes and scene labels;
- a large scatterplot;
- separate-unit source timelines;
- one paired row per governed scene;
- two-way Video navigation from plot, timeline, and table;
- analyst selection of the active relationship.

Circular visualization is reserved for data with genuine cyclic, recurring, or relational structure. It is not applied decoratively to ordinary correlations.

## Maturity governance

The visualization panel separates:

- Multimodal coverage: representation and operational availability of the analysis array.
- Analytical maturity: coverage, temporal alignment, provenance completeness, taxonomy completeness, human confirmation, cross-modal agreement, contradiction resolution, and relational connectivity.

State regime:

- Ready: at least 0.80, muted sage circle.
- Developing: 0.55–0.79, muted ochre square.
- Needs attention: below 0.55, muted dusty-rose diamond.
- Not assessed: no governed aggregate, slate cross.

Every dimension exposes current value, target, measured basis, affected analyses, and a concrete next action. Overall maturity is constrained by the weakest measured dimension and cannot be Ready while a critical dimension remains unassessed.

## Main implementation files

- `src/backend/analysis/stats_research_question.py`
- `api_server.py`
- `src/frontend/lib/api-service.ts`
- `src/frontend/app/V2components/components/panels/StatsKitPanel.tsx`
- `docs/schemas/vaa1.stats_research_question_workflow.v1.schema.json`
- `docs/schemas/Datascene_VAA1_stats_interpretation_core_v1.schema.json`
- `docs/schemas/vaa1.statskit_frontend_backend_api.v1.schema.json`
- `docs/vaa1_statskit_governed_interpretation_operationalization_plan_2026-08-01.md`
- `tests/test_stats_research_question.py`

## Validation and manual acceptance

- TypeScript compilation passed.
- Focused research-question backend tests passed.
- Native statistical interpretation tests passed.
- JSON schemas parse under the declared 2020-12 draft.
- Diff integrity check passed.
- Manual Expressions ↔ prosody run passed.
- Scene, scatterplot-point, timeline-point, and table source navigation passed.
- Research question view, report sentence, scatterplot, source timeline, multimodal coverage, and analytical maturity views were manually inspected.

The local runtime uses the documented `vaa1_core` backend and the Next.js frontend on ports 8000 and 3001.

## Next continuation

Next work should begin with the controlled natural-language research-question resolver. It should map analyst wording to the delivered motor catalogue, show the resolved unit, variables, method, scope, and required layers, and require confirmation before execution. After that, extend circular views only to suitable recurring, categorical, dependency, or multi-cycle data.
