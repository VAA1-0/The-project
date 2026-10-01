# Assessment of the three proposed Datascene relational lenses

Date: 2026-09-16. Decision: suitable for staged incorporation after contract revision; not ready for direct production registration.

This assessment concerns the three supplied version 1.0.0 schemas and the accompanying design proposal. The proposal's instructions are assessed as requirements, not executed as authorization to install new functionality. Original files, application code, saved analyses, and researcher decisions were not changed by this assessment. The findings distinguish the intended design from the inspected local implementation; they do not certify theoretical validity or production readiness.

The strongest feature of the proposal is its separation of shared evidence from framework-specific interpretation. Source-relative time, alternatives, explicit uncertainty, dependencies, and researcher decisions fit Datascene's operating principles. The schemas should become three optional, distinct analytical lenses over the existing governed evidence system. They should not become independent mature profiles or automatic classifications of persons.

## Evidence and validation

All three schemas pass `Draft202012Validator.check_schema`. The audit used jsonschema 4.23.0 in the existing base Conda environment because `jsonschema` is absent from `vaa1_core`. No package was installed and the application was not started in that environment. Runtime integration must declare and verify its own Draft 2020-12 validator dependency.

`check_schemas.py`, `schema_probe_results.json`, and three explicitly synthetic fixtures accompany this assessment. Fixtures contain deliberately unresolved references; their acceptance demonstrates structural permissiveness, not substantive validity. File hashes identify the exact inputs. With format checking enabled, invalid dates fail. All three schemas nevertheless accept reversed intervals, normalized regions outside the frame, duplicate anchors, and an automated candidate labelled as a confirmed interpretation. All reject an added `anchor_id`, because that property is absent and additional properties are prohibited. These results reproduce the main contract gaps.

The proposal explicitly anticipates application-level checks for several of these cases. Their schema acceptance is therefore not inherently a design error. The release blocker is the absence of a registered, tested adapter enforcing those checks for these particular lens records. JSON Schema's `format` is an annotation by default; explicit validation configuration is necessary ([official specification guidance](https://json-schema.org/understanding-json-schema/reference/type), [validator documentation](https://python-jsonschema.readthedocs.io/en/v4.21.1/validate/)).

## What Datascene already provides

| Existing implementation | Reusable capability | Boundary of the evidence |
|---|---|---|
| `src/backend/analysis/narrative_lens_reading.py` | Candidate-only lens conventions and manual-authority policy | Its existing narrative profiles do not implement these three frameworks. Adding cue words would not establish their constructs. |
| `src/backend/analysis/interpretation_registry.py` | Append-only candidate claims, propositions, relations, and invalidation records | Relations currently connect registered claims/propositions, not arbitrary lens participants. A participant association cannot be passed through unchanged. |
| `src/backend/analysis/decision_ledger.py` | Decisions, rejection, supersession, and dependency invalidation primitives | Its authority vocabulary and event shape differ from the supplied schemas. Defaults and supersession require special care. |
| `src/backend/analysis/framework_projection.py` | Source-linked framework projections without automatic promotion | Framework-specific projection builders are still required. |
| `src/backend/analysis/live_mature_data_proliferation_bus.py` | Proliferation-readiness audit | It explicitly describes itself as an audit; it is not a universal transaction or synchronization service. |
| `src/backend/analysis/governed_reporting.py` | Citation checking, source hashes, report invalidation and export | Export rejects invalidated report records, but does not generally require every exported record to be an analyst-confirmed lens claim. |
| `src/backend/analysis/data_book_publication.py` | Feature chapters and checksummed publication | New lens features require registration, eligibility rules, and restoration tests. |
| `docs/inventory/attribute_registry.json` | Attribute classifications, authority rules and dependencies | This is a small pass-1 inventory, not evidence that the proposed fields are already registered. |

These are integration points, not proof that an end-to-end lens service exists. No registrations under the supplied three framework identifiers were found in the searched source, schemas, or tests.

## Required schema and contract revisions

**1. Make evidence addressable.** Every lens uses `evidence_anchor_ids`, but `sourceAnchor` has no `anchor_id`. Add stable anchor identity or explicitly bind each reference to a versioned external evidence registry. Do not identify anchors by array position. Resolve all references within the declared source, analysis revision, and project; include those identities in a common envelope or resolvable registry contract. A source ID must not ambiguously substitute for an analysis-run ID. Require uniqueness by identifier, not merely whole-object equality.

**2. Separate candidate provenance from analyst decisions.** `ledger_event_id` is required even for `automated_candidate`. Datascene's canonical decision writer rejects declared candidate services, so a new candidate cannot obtain an analyst decision merely to satisfy this field. Introduce a candidate-record or producer-event reference, and require canonical decision references only for reviewed states. Map schema authority values explicitly to ledger authorities such as `manual_confirmation` and `explicit_user_correction`; do not copy similarly named strings between contracts.

The current decision policy defaults missing authority to `explicit_user_correction`, missing writer class to `analyst_interaction`, and appended maturity to `analyst_confirmed`. An in-memory probe confirmed these defaults. The existing API forwards the supplied payload into this policy. Therefore, a lens adapter must derive writer authority from its trusted command boundary, deny promotion by candidate writers, and require a deliberate analyst action. A client-supplied `created_by` or authority label is not sufficient proof.

**3. Give assertions independent review identities.** A single root governance block cannot fully describe a reading in which one relation is accepted, another is rejected, and the summary remains unresolved. Use stable assertion IDs with individual decision references and effective status, or make one canonical record per independently reviewable assertion and project a composite reading. Keep authority, maturity, validity, conflict and review state distinct; preserve that a previously confirmed assertion has become stale.

This is also necessary for alternatives. The existing ledger automatically supersedes earlier decisions sharing subject, property and overlapping scope. The in-memory probe reproduced that behavior. Use lens-qualified reading/assertion identities and explicit revision relationships so confirmation of one alternative does not erase another framework's reading. Root `alternatives` currently lacks evidence references and decision identity, and its statuses omit superseded/stale states.

**4. Strengthen temporal and spatial semantics.** Enforce interval order, media-duration bounds, source-clock identity and revision, and a documented point-event convention. For normalized geometry, validate bounds and `x + width <= 1`, `y + height <= 1`; for pixels, require source dimensions and conversion provenance. Translation before/after states need separate temporal evidence, not only two prose strings under one undifferentiated anchor list.

The proposed zero-time convention for photographs, documents and web material should be explicitly typed as non-temporal and excluded from duration calculations. The present schema offers no page, text-offset, DOM/capture or equivalent document locator despite naming those anchor types. Use typed anchors in a subsequent version or restrict the first implementation to supported video evidence. Never let a missing locator become fabricated precision.

**5. Close framework-specific gaps.** Latourian associations require participant IDs while `participants` is optional. Require a populated participant collection or a declared external participant registry. Stabilization can currently be asserted without supporting associations; require nonempty support when assessed. Concept provenance is optional despite the proposal's attribution requirements. Non-human entities need governed object references without forced conversion into human Narrative Agent identities.

Morenoan `ethics` is optional, so even the fixed clinical-inference prohibition disappears when the object is omitted. Make the applicable policy mandatory and enforce disclosure at service and publication boundaries. `not_applicable` must not coexist with a restrictive policy without an explicit resolution rule. The `sociometric` scope nevertheless requires a nonempty role-relation list: use scope-dependent requirements so a choice study does not need invented role evidence. Define whether counterrole IDs reference people or role relations. Sociometric relations need epistemic status, occurrence/round identity, and measurement provenance; optional strength values need a stated scale. Require compatible directed evidence before declaring reciprocity.

For Goffmanian events, require an interpretive rationale when applying theoretical categories. `rationale` is currently optional. Per-event epistemic status does not cover all optional performance, framing, territory, or identity assessments. Add assessment state and decision binding where these objects make independent interpretive assertions. Team references need a defined target, and sensitive identity assertions need mandatory handling rules when applicable.

**6. Make absence and producer provenance explicit.** Omitting an optional family currently conflates not assessed, not applicable, insufficient evidence and assessed-with-no-findings. Add a lightweight family coverage record. Require producer/model/rule version and input specification for automated proposals. A SHA-256-shaped string establishes syntax only: the service must recompute it against a canonical snapshot including evidence versions, relevant decisions, taxonomy and adapter versions. Use a versioned common definition package and stable schema identifiers rather than relying on placeholder web domains.

## Putting the design principles into operation

The integration should have one governed retrieval path per analysis revision: immutable evidence and candidate records, canonical analyst decisions, then a deterministic accepted-state projection coordinated through the Master Schema. Panels, graphs, search and publication consume that projection. A projection cache is permissible when keyed by evidence and ledger revisions and safely rebuildable; it must never become another authority store.

An analyst selects a source interval or evidence item and opens a lens. The selected evidence remains visible alongside the proposed assertion, its warrant and uncertainty. Confirmation, correction, rejection and deferral act locally on the named assertion. Traceback seeks the same source and interval, including ROI when present. Reverse navigation reveals associated readings without destroying the analyst's current context. Local Datascene editors and context menus replace browser prompts. The active analytical object stays visible; provenance and secondary families start in compact disclosures, following the calm-panel contract.

These requirements must be tested in the rendered interface. Today's POS/Quant/Expressions incidents show why a valid artifact and a healthy API are insufficient. Each lens needs retained-selection initialization, stale-response cancellation, loading/error/empty distinctions, reopening tests and hydration independent of video-blob retrieval. A visible review indication must expose the relevant evidence and action.

A dependency change appends an invalidation event or projects explicit staleness while preserving the prior decision. It removes affected assertions from current mature claims across every consumer. Recalculation produces a new candidate. It does not inherit confirmation. Immutable historical publications remain historical editions; current export must check dependency freshness again. Tests should cover interrupted commits, concurrent edits, idempotent retry and restart reconstruction, so a ledger write cannot leave a falsely current panel projection.

The publication rule needs a lens-specific gate: only current, eligible analyst-confirmed/corrected assertions may appear as mature lens claims. Candidate and rejected records can remain in a clearly designated research audit package if authorized, but must not enter the mature claim stream. Existing generic report export is not sufficient enforcement of the proposal's stronger rule.

## Methodological use and delivery order

For the first pilot, I recommend an analyst-created Goffmanian encounter reading over a short, source-linked interval. It fits the existing transcript, speaker-turn, scene and manual-annotation surfaces with relatively little new measurement infrastructure. A detected facial expression does not establish face-work; a speaking turn does not establish footing. The analyst must supply the theoretical warrant and define the analytical unit.

A Morenoan pilot should distinguish recorded or elicited choices from interpreted role relations and from a character's represented relationships. Absence of a choice is not rejection. Criterion, bounded population and observation round must travel with every derived network measure. A Latourian pilot should require evidence that an entity changes or enables a course of action; visual presence or graph centrality alone is insufficient. Keep heterogeneous association tracing distinct from causal explanation and from Narrative Agent recognition.

For edited material such as the Bond trailer, explicitly distinguish source chronology, represented narrative chronology and the interaction being claimed. Adjacent shots do not by themselves demonstrate copresence or a continuous encounter. Assess reliability and construct validity within each genre before asserting comparability across Bond, COP30 and Helsinki. This assessment does not independently verify the proposal's historical attribution table.

Delivery should proceed through four reviewable stages: revised common contracts and failing/passing fixtures; one analyst-led lens with durable decisions and restoration; dependency invalidation plus controlled projections/publication; then the other lenses and explicitly specified StatsKit variables. Computational assistance can retrieve, organize and propose evidence throughout, but must not manufacture theoretical certainty.

Release acceptance must demonstrate unresolved-reference rejection, trustworthy authority enforcement, independent alternatives, correct timing and geometry, project isolation, full dependency invalidation, bidirectional navigation, mature-label precedence, restart/import restoration, and cross-panel parity. Statistical variables must declare units, denominators, nesting, missingness, network boundaries and edge rules. Circular-view rotation must change only the view, with values and provenance invariant. Approval for incorporation should follow these demonstrated behaviors, not schema validity alone.

## Local sources reviewed

- `docs/vaa1_operating_principles_constellational_meaning_network_2026-05-26.md`
- `docs/vaa1_mature_data_surface_governance_principle_2026-05-08.md`
- `docs/vaa1_universal_calm_panel_leaf_design_regime_2026-07-15.md`
- `docs/working_handover_handout_2026-08-28_full_analysis_robustness.md`
- The source modules and registry paths listed above; decision API in `api_server.py`.
- The four supplied Desktop files. The accompanying document's “implementation-ready” label is not accepted as proof of runtime readiness.
