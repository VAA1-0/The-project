# Datascene relational lenses

## Design specification for three source-bound, human-authoritative interpretive schemas

**Version:** 1.2.0 (design reader; revised draft schemas 1.1.0; original schemas archived at 1.0.0)  
**Status:** assessed design proposal; implementation deferred pending contract revisions and acceptance tests. Automated deductions are intended to be visible for review before confirmation.  
**Schemas:**

1. `latourian_association_dynamics.schema.json` — **Association Dynamics and Heterogeneous Agency**
2. `morenoan_relational_configuration.schema.json` — **Relational Configuration, Role Enactment and Group Dynamics**
3. `goffmanian_situated_conduct.schema.json` — **Comparative Sociology of Situated Conduct**

## 1. Purpose and epistemic status

These schemas add three optional analytical lenses to Datascene. They do not alter Datascene's critical process-realist orientation, create a second source of canonical truth, or authorize automated promotion to mature analytical authority. Automated deductions and interpretations are permitted as explicitly provisional, source-linked candidates available to the analyst. Each lens converts source-bound observations and registered analytical objects into framework-specific candidate relations. An analyst may confirm, correct, reject, retain as unresolved, or supersede those relations through Datascene's canonical decision ledger.

The lenses ask different questions of the same material:

| Lens | Topic-based question | Primary analytical object |
|---|---|---|
| Association Dynamics and Heterogeneous Agency | How is action enabled, displaced, translated and provisionally stabilized through heterogeneous associations? | Association among human and non-human participants |
| Relational Configuration, Role Enactment and Group Dynamics | How are roles enacted and created, choices and rejections organized, and group configurations reproduced or transformed? | Role relation, sociometric relation and enacted scene |
| Comparative Sociology of Situated Conduct | How do participants make themselves intelligible, sustain definitions, negotiate access, protect face, manage disruption and organize the perceptual field? | Situation, encounter, participation framework and interaction event |

These are sibling projections over shared evidence. They must never be merged into an undifferentiated relational ontology.

## 2. Datascene design principles applied from inception

### 2.1 Evidence before interpretation

Every reading requires one or more `source_anchors`. Every theoretically interpreted relation requires `evidence_anchor_ids`. The schema distinguishes `observed_relation`, `derived_relation`, `candidate_interpretation` and `confirmed_interpretation`. A detector score, linguistic match or network statistic cannot by itself establish agency, motive, face, tele, framing or stabilization.

The epistemic sequence is:

**observation → measurement → candidate interpretation → analyst decision → governed claim**

Each transition must remain inspectable. No stage inherits the epistemic status of the next stage merely because it is stored in the same record.

### 2.2 Canonical authority and append-only decisions

The schemas are validation envelopes, not canonical stores. Their `governance.record_status` is intended to represent effective review state. Before review, candidate provenance must identify the proposal record and producer; after review, the state must resolve through canonical analyst decisions. The original version 1.0.0 schemas required `ledger_event_id` even for candidates; the version 1.1.0 draft package corrects that requirement (section 14). Only the canonical Datascene ledger may authorize `analyst_confirmed` or `analyst_corrected`. Services may create `automated_candidate`, `imported_candidate` or `analyst_proposal` records. They may not promote their own output.

Corrections append new events. They do not mutate or erase the earlier proposal. `supersedes_event_id`, ledger history and input hashes preserve the analytical trajectory.

### 2.3 Source-bound time and space

All time-based anchors use `source_relative_seconds`. The unit is declared explicitly to prevent recurrence of the seconds/milliseconds ambiguity. Every anchor records clock authority and precision. Spatial evidence declares either normalized or pixel coordinates; these systems must not be mixed without a registered conversion.

For non-time-based photographs, documents and web captures, `time_start` and `time_end` should both be `0`, while `anchor_type`, spatial region, document span or capture metadata identify the evidence. A future common anchor schema may relax this compatibility convention; until then, no producer may invent synthetic elapsed time.

### 2.4 Uncertainty, absence and alternatives

Missing detection is not evidence of non-existence. Producers must omit unsupported optional readings or state `not_assessed`, `unknown`, `undetermined` or `unresolved` where these values are available. They must not substitute a confident category for missing evidence.

Competing interpretations belong in `alternatives`; they are not overwritten by the currently preferred reading. A later preference does not retroactively render an earlier reading irrational or nonexistent.

### 2.5 Dependency invalidation

Every reading carries `dependency_ids` and an `input_snapshot_hash`. Changes to source identity, source clock, intervals, transcript, speaker attribution, Narrative Agent links, ROI, scene boundaries, taxonomies, provider versions or analyst decisions must mark affected readings `stale` or append an `invalidated` event. Recalculation creates a new candidate; it never silently updates a confirmed interpretation.

### 2.6 Controlled proliferation

`projection_bindings` identify consumer projections; they do not confer authority. Datascene must distinguish **candidate visibility and exploratory use** from **mature-data proliferation**. Automated deductions should be discoverable in the lens and relevant consumer surfaces before analyst confirmation. The analyst must be able to see what the system proposes, inspect its evidence and uncertainty, and compare alternatives without first endorsing the proposal.

A candidate may support a provisional graph edge, a scene-level suggestion, a search result, a review task, or an explicitly exploratory statistical view. These uses preserve candidate status and provenance. They must not overwrite confirmed labels, populate an accepted profile field, or become established premises for further deductions. A candidate derived from another candidate retains the full dependency chain and remains provisional; repeated reuse or apparent agreement does not raise its authority.

Only current analyst-confirmed or analyst-corrected assertions that pass consumer-specific checks may enter mature lens claims and accepted profile fields. Confirmation remains the gold standard for governed acceptance; it is not proof of empirical infallibility and remains revisable. Provisional acceptance is still provisional. Rejected, superseded and invalidated records remain retrievable in history, while unresolved, conflicted or stale readings remain accessible in explicitly labelled review views. None may silently enter mature claims. A candidate counts as a proposed reading, never as a confirmed empirical occurrence merely because it is visible.

### 2.7 Parsimony

The least inferential representation compatible with the evidence should be preferred. A visible speaking turn should first be stored as a timed observation. It becomes a Goffmanian footing change, Morenoan role creation or Latourian translation only when the relevant theoretical warrant is stated. The system must not infer an elaborate relation merely because a category is available.

### 2.8 Bidirectional navigation

Every projected relation must navigate back to its source evidence, and every source selection must reveal associated readings without forcing a context-destroying panel transition. A reading remains inspectable within its lens while allowing source seek to the same source, time and ROI. This implements the Datascene principles that the “saloon doors swing both ways” and that evidence remains navigable within the leaf.

### 2.9 Pi continuity

Reorientation of a circular or relational visualization changes the view, not the underlying record. Source identity, clock, relations, maturity, denominators and provenance remain invariant under rotation. Recurring interactional, role or association patterns must carry cycle or occurrence identity so recurrence is not mistaken for literal identity.

## 3. Shared data contract

All three schemas contain the following structural families:

- `framework`: immutable lens identity and concept-level attribution;
- `governance`: projected maturity, authority, ledger event, producer, parameters, dependencies and input hash;
- `source_anchors`: precise source evidence and optional spatial or textual localization;
- lens-specific participants, relations and events;
- `interpretive_summary`: a source-supported, uncertainty-qualified theoretical proposition;
- `alternatives`: competing readings and their adjudicative status;
- `projection_bindings`: references to downstream Datascene projections.

The definitions are repeated inside each file deliberately. Each JSON Schema passes structural meta-schema validation, but direct deployment is deferred because semantic and integration contracts remain incomplete. In implementation, the repeated governance and anchor definitions should be generated from a versioned common package to prevent drift. They should not be replaced with unversioned remote references.

### 3.1 Required runtime checks beyond JSON Schema

JSON Schema validates structure but cannot enforce all referential and governance rules. Datascene must additionally test that:

1. `time_end >= time_start`;
2. every referenced anchor, participant, relation, ledger event and dependency exists;
3. a `confirmed_interpretation` corresponds to an analyst-confirmed or analyst-corrected canonical ledger event;
4. automated writers cannot set analyst authority;
5. hashes correspond to the exact registered input snapshot;
6. every superseded, invalidated or stale reading is excluded from governed claims;
7. source and project ownership are identical across all referenced records;
8. spatial regions fit their declared coordinate system and source dimensions;
9. circular-view rotation does not mutate analytical values;
10. sensitive sociometric and identity information obeys access and publication controls.

### 3.2 Assessment findings and revisions required before implementation

The 2026-09-16 assessment checked the supplied schemas against the local Datascene implementation and exercised structural validation and ledger behavior. It found conceptual compatibility, but not an operational implementation of these three lenses. The following table records the assessment findings. The automatically verifiable subset is now delivered in the version 1.1.0 draft package; section 14 identifies the delivered scope and remaining requirements. The original supplied JSON files remain unchanged.

| Finding | Required design resolution |
|---|---|
| All three schemas reference `evidence_anchor_ids` but prohibit an `anchor_id` property on anchors. | Define stable anchor identity or explicit versioned external-registry references. Resolve every reference within its source, project and analysis revision; never use array position as identity. |
| Candidates require `ledger_event_id`, while candidate services cannot append authoritative decisions. | Separate candidate/producer-event references from analyst decision references. Require decision references conditionally after review. |
| A single governance block cannot represent independently reviewed relations. | Give each reviewable assertion an identity and decision binding. Keep authority, maturity, validity, conflict and review state separately recoverable. |
| Existing ledger defaults can supply analyst authority when fields are omitted. | Derive authority from the trusted command boundary and explicit analyst action. Never trust imported or automated payloads to assert their own authority. |
| Existing ledger supersession matches subject, property and overlapping interval. | Use lens-qualified reading/assertion identities and explicit revision links so alternative readings and sibling lenses coexist. |
| Reversed intervals, out-of-frame normalized regions and automated-confirmed combinations pass structural validation. | Add semantic checks, coordinate/source bounds and authority-state checks. Validate date-time formats explicitly. |
| A hash-shaped string does not establish a valid dependency snapshot. | Recompute hashes from canonical evidence, source-clock, decision, taxonomy and producer/adapter versions; register invalidation edges. |
| Optional families conflate not assessed, not applicable, insufficient evidence and no findings. | Add a compact coverage state and reason per family. Do not invent an interpretation to satisfy a required collection. |
| Non-temporal anchor types lack document/page/offset or capture locators. | Introduce typed locators or limit the first release to supported video evidence. A zero-time compatibility value must never enter duration statistics. |
| Latourian participants and concept provenance are optional; stabilization need not cite support. | Require resolvable participants and attribution, and nonempty support for assessed stabilization. Give before/after translation states distinct evidence anchors. |
| Morenoan ethics is optional; sociometric scope still requires role relations. | Require applicable ethical/disclosure policy and scope-dependent content. Specify criterion, round, population boundary, counterrole targets, measurement scale and epistemic status. |
| Goffmanian rationale is optional and several interpretive families lack individual review state. | Require theoretical warrant and decision binding for each independently asserted interpretation, with appropriate sensitivity handling. |

The shared definitions should come from a versioned local package. Producer/model/rule versions are required for automated proposals. Registration must preserve the distinction between a source, an analysis run and an interpretation revision. Non-human participants should retain governed object identities rather than being forced into human Narrative Agent identity fields.

### 3.3 Existing components and their limits

Reuse `interpretation_registry.py` for appropriate candidate records, `decision_ledger.py` for analyst decisions, and `framework_projection.py` for derived framework views through explicit adapters. The interpretation registry currently relates claims/propositions; participant-to-participant associations need their own registered representation or a deliberate mapping. Existing `narrative_lens_reading.py` profiles establish candidate conventions but do not implement these three frameworks.

The live mature-data proliferation bus is an audit foundation, not proof of a universal transactional synchronization mechanism. The attribute inventory is a pass-1 registry and must be extended field by field. Governed reporting and Data Book publication provide useful citation and packaging infrastructure, but require lens-specific eligibility, disclosure and feature-registration rules. Generic export must not be assumed to enforce the stronger confirmed-claim rule automatically.

The assessment and reproducible probes are retained in the project at `docs/audits/relational_lenses_2026-09-16/`. Structural schema checks passed using jsonschema 4.23.0 in the existing base Conda environment. The package was absent from `vaa1_core`; runtime integration must declare its validator dependency without changing the established startup environments.

## 4. Association Dynamics and Heterogeneous Agency

### 4.1 Topic and theoretical association

This is a Latourian and actor-network-theoretical lens. Its topic is the empirical tracing of associations through which heterogeneous participants make a difference to a course of action. “Social” is not treated as a substance that explains associations in advance; the task is to follow how a collective is assembled, contested, translated and provisionally stabilized.

The lens is not installed as Datascene's governing ontology. That distinction is necessary because actor-network theory's methodological suspension of ready-made “social forces” sits in productive tension with critical realism's interest in stratified structures and causal mechanisms. Datascene uses the lens as a disciplined mode of association tracing: it can delay premature structural explanation and disclose mediations that a critical-realist analysis may subsequently seek to explain. It may not prohibit the analyst from investigating relatively enduring structures, causal powers or absences.

The schema uses `participant`, not “actor” as an ontological declaration. A participant becomes analytically actant-like only through evidenced relations. Human and non-human entities are treated symmetrically as possible participants in action, not as morally, cognitively or causally identical beings.

### 4.2 Core practices

- Register human, collective, institutional, technical, textual, material and other participants without presupposing which are decisive.
- Trace directed or reciprocal associations through evidence.
- Distinguish a candidate **intermediary**, which appears to transport action without transformation, from a candidate **mediator**, which transforms what passes through it.
- Record translation as a change between a documented “before” and “after.”
- Represent problematization, interessement, enrolment and mobilization as possible translation moments, not mandatory stages.
- Track controversies as open empirical sites in which participants and relations become visible.
- Treat stabilization and black-boxing as provisional accomplishments. Allow reopening.
- Record obligatory passage points and delegation only when their relational effects are evidenced.

### 4.3 Prohibited shortcuts

- Do not label every object an actant merely because it appears in a frame.
- Do not infer agency from salience, screen time or detector confidence alone.
- Do not equate a graph edge with a causal relation.
- Do not treat network centrality as theoretical importance without a defined network boundary and substantive warrant.
- Do not use ANT vocabulary to erase power, institutions or asymmetries already evidenced in the material.

Attribution must not reduce actor-network theory to Latour alone. Association tracing, generalized symmetry and heterogeneous networks developed across work by Latour, Michel Callon and John Law. The four moments of translation—problematization, interessement, enrolment and mobilization—must be attributed specifically to Callon's analysis rather than recorded as a Latourian invention. Latour remains the principal attribution for the schema's topic-based synthesis, especially the distinction between mediators and intermediaries and the instruction to trace associations.

### 4.4 StatsKit use

StatsKit may describe association frequency, recurrence, duration, participant diversity, path structure, centralization or controversy dynamics. Units, nesting, missingness, boundary construction and edge-generation rules must be declared. Network statistics remain measurements under a specified graph construction, not proof of mediation, translation or causal power.

## 5. Relational Configuration, Role Enactment and Group Dynamics

### 5.1 Topic and theoretical association

This is a Morenoan lens integrating sociometry, role theory, psychodrama, sociodrama and group analysis. Its topic is the organization of interpersonal and collective relations through choices, rejections, role complementarities, enacted scenes, spontaneity and emergent group configurations.

The wider designation is intentional. “Psychodramatic schema” alone would reduce Moreno's contribution to a repertoire of therapeutic stage techniques. The schema retains his effort to systematize social analysis through sociometric relations, sociograms, social atoms, group structures and role processes.

### 5.2 Analytical levels

- **Role level:** enacted, ascribed, claimed, latent, emergent, conflicted or rejected roles.
- **Relational level:** criterion-specific positive, negative, neutral, ambivalent, unexpressed or unknown sociometric choices.
- **Social-atom level:** the focal participant's criterion-bounded relational configuration.
- **Scene level:** observed, represented, psychodramatic or sociodramatic enactment.
- **Group level:** cohesion, fragmentation, centralization, polarization, isolation, reciprocity and transition.

Role taking, role playing and role creating are represented as distinct processes. Role reversal, doubling and mirroring are recorded only when the material contains such an enactment or a researcher has explicitly coded the operation. A role always remains relational: it should be connected to one or more counterroles rather than treated as a free-standing personality attribute.

### 5.3 Sociometric discipline

A sociometric choice is meaningless without a criterion: “Whom would you choose for what?” The schema therefore requires `criterion`. Absence of an expressed choice must not be coded as rejection. Reciprocity must be computed from compatible directed choices rather than presumed. `tele` is included only as a cautious candidate status, not as a directly detectable psychological substance.

### 5.4 Ethical boundary

This schema is for research representation, not automated psychotherapy or diagnosis. `clinical_inference_prohibited` is fixed to `true`. Sensitive attractions, rejections, stigmatized identities and interpersonal relations require restriction, pseudonymization, aggregation or participant review as appropriate. In facilitated psychodrama or sociodrama, consent and research/therapeutic roles must be documented outside the schema and referenced here.

### 5.5 StatsKit use

StatsKit may compute criterion-specific indegree and outdegree, reciprocity, isolates, dyads, triads, subgroup structure, change between rounds and role-transition frequencies. Statistical summaries must not collapse different choice criteria, conflate expressed and inferred relations, or expose sensitive individual-level sociograms in publication.

## 6. Comparative Sociology of Situated Conduct

### 6.1 Topic and theoretical association

This is a Goffmanian lens for comparative qualitative analysis of the interaction order. It examines how participants establish what is happening, become mutually intelligible, distribute participation and access, present identities, sustain face, contain vulnerability, manage information, respond to disruption and repair the working consensus.

The title deliberately exceeds “dramaturgical analysis.” Goffman's contribution also includes interaction ritual, face-work, participation frameworks, footing, territories of the self, stigma and identity-information management, institutional encounters and frame analysis.

### 6.2 Concept families

- **Situation and encounter:** occasion, gathering, focused or unfocused interaction and working consensus.
- **Performance:** performer, audience, team, routine, setting, personal front, expressions given and given off, defensive and protective practices.
- **Participation:** speaker, addressed recipient, ratified listener, bystander, overhearer, eavesdropper and represented party.
- **Footing and production format:** alignment shifts and the analytically distinct animator, author and principal.
- **Face and ritual:** line, face claim, threat, deference, demeanour, avoidance, challenge and corrective processes.
- **Disruption and repair:** incident, embarrassment, account, apology, correction, restoration or collapse of working consensus.
- **Regions and territories:** front region, back region, outside, personal space, use space, information preserve and conversational preserve.
- **Frames:** primary frameworks, keying, fabrication, rekeying, frame ambiguity, dispute, break and restoration.
- **Identity information:** identity claims, attribution, disclosure, concealment, passing, covering and stigma management, with explicit sensitivity controls.

### 6.3 Professional attribution

The schema requires concept provenance because Goffman's synthesis drew upon and developed problems with longer histories. It distinguishes:

- `goffman_original_or_principal_synthesis`;
- `documented_influence`;
- `genealogical_antecedent`;
- `parallel_postwar_development`;
- `later_extension`.

The following associations should guide the initial registry:

| Source | Contribution retained under original attribution | Association with Goffman |
|---|---|---|
| Émile Durkheim | Ritual, classification, sacredness and social facts | Genealogical antecedent and major basis for interaction ritual |
| Georg Simmel | Forms of association, reciprocal orientation, secrecy, sociability and social distance | Genealogical antecedent |
| Charles H. Cooley | Looking-glass self | Genealogical antecedent |
| William I. and Dorothy S. Thomas | Definition of the situation | Direct prerequisite; not a Goffmanian invention |
| George Herbert Mead | Social constitution of self and role taking | Interactionist antecedent; Goffman is not reducible to Mead |
| Kenneth Burke | Dramatism, symbolic action, motive, identification and pentadic relations | Pre-Goffmanian dramaturgical theory; separately attributed |
| Alfred Schütz | Intersubjectivity, typification and multiple realities | Phenomenological antecedent |
| W. Lloyd Warner and A. R. Radcliffe-Brown | Ceremony, social organization and relational anthropology | Documented anthropological influences |
| Everett C. Hughes | Careers, institutions, status dilemmas and occupational worlds | Major Chicago teacher and documented influence |
| Talcott Parsons | Normative roles and social systems | Contemporary theoretical context |
| Robert F. Bales | Systematic Interaction Process Analysis | Parallel post-war systematization, not Goffman's method |
| George C. Homans | Systematic study of the human group | Parallel post-war microsociology |
| Ray Birdwhistell | Kinesics and systematic bodily communication | Parallel and intersecting multimodal programme |
| Gregory Bateson | Metacommunication and the play frame | Explicit precursor to Goffman's transformation of frame analysis |
| Harold Garfinkel | Practical production and accountability of social order | Parallel emerging programme; not to be absorbed into Goffman |
| J. L. Moreno | Sociometry, role theory, encounter and psychodrama | Independent predecessor and parallel relational programme |

The register must be maintained claim by claim. Inclusion in this table does not establish direct influence in every case.

### 6.4 Multimodal practice

Candidate evidence may include turn-taking, overlap, address terms, gaze, bodily orientation, distance, posture, gesture, expression, prosody, clothing, setting, props, entry and exit, camera organization, editing, audience visibility and access boundaries. SFL may contribute mood, modality, appraisal, engagement, address and information structure. These observations can support but never automatically establish face, footing, fabrication, stigma, motive or a definition of the situation.

### 6.5 StatsKit use

StatsKit may describe speaking allocation, interruption, response latency, gaze distribution, participation transitions, repair sequences, region changes or recurrent frame transformations. Frames, turns and encounters are nested observations; repeated frame detections are not independent cases. Statistical regularity does not establish the meaning or ritual consequence of conduct.

## 7. Cross-lens associations without conceptual collapse

The same evidence may support three readings. A lectern may be:

- a material participant delegating and stabilizing authority in the association-dynamics lens;
- an element conditioning speaker and audience roles in the relational-configuration lens;
- part of the setting, front region and expressive equipment in the situated-conduct lens.

These readings may be compared through shared source anchors and Narrative Agent bindings. Their category values must not be copied across lenses as if they were synonyms. Cross-lens relations should be expressed in the Meaning Network as `supports_comparison_with`, `contrasts_with`, `elaborates` or another registered meta-relation, never `same_as` unless an analyst explicitly confirms equivalence.

## 8. Master Schema registration

Before runtime use, register each root artifact and every canonical field in the Datascene Attribute Registry. The registration should specify:

- field identifier and version;
- observation, measurement, interpretation, governance or projection class;
- permitted producers;
- authority and maturity rules;
- source-anchor requirements;
- dependencies and invalidation triggers;
- consumer eligibility;
- sensitivity and publication class;
- migration rule;
- test owner.

Recommended canonical artifact types:

- `interpretive.lens.latourian_association_dynamics.v1`
- `interpretive.lens.morenoan_relational_configuration.v1`
- `interpretive.lens.goffmanian_situated_conduct.v1`

Consumer rule: **automated deductions must be available for analyst inspection in their lens and relevant downstream review surfaces before confirmation. Only current, eligible analyst-confirmed or analyst-corrected assertions may populate accepted profile fields or mature lens claims.** Candidate evidence may be exported as an explicitly provisional working or audit record under applicable disclosure controls; inclusion in a package does not confer maturity.

### 8.1 Consumer contracts

Every consumer reads the same versioned, Master Schema-coordinated projection. It receives assertion identity, lens identity, source anchors, candidate provenance or decision references, effective state, dependencies and eligibility for its particular use. Candidate and accepted views may be separate query results over this common record system; neither is a panel-local authority store.

| Consumer | Candidate use before confirmation | Use after confirmation and eligibility checks |
|---|---|---|
| Lens panel and Data Maturation review queue | Surface source-linked automated readings, warrant, alternatives, uncertainty and review actions. | Display the accepted assertion with its decision history and any later freshness warnings. |
| Meaning Network / Meaning-Plot | Display explicitly provisional association, participation or role edges in an inspectable candidate layer. Candidate edges must not silently contribute to accepted-network measures. | Project governed lens-specific relations with stable assertion IDs and traceback; preserve conceptual distinctions between lenses. |
| Narrative Agent and object/entity profiles | Show proposed role, participation or association attributes in a suggestions area beside existing accepted information. | Populate appropriate scoped profile attributes without overwriting higher-authority corrections. Retain non-human entities as governed objects where appropriate. |
| Scene Cards, Video/ROI and Transcript | Link a selected scene, interval, ROI or utterance to candidate readings. Offer a concise indication and a direct local inspection action. | Surface accepted interpretive facets while preserving the original observation and source clock. |
| Search and Time Bank | Index candidate text and anchors with state filters and clear provisional labels. Candidate inclusion must not be mistaken for confirmed evidence retrieval. | Retrieve current accepted readings with the same source identifiers and historical traceability. |
| StatsKit | Permit an explicitly exploratory candidate view with declared inclusion rules, counts, uncertainty and provenance. Separate proposed-reading counts from confirmed-occurrence measures. | Compute registered variables over eligible assertions using declared units, denominators, nesting, missingness and network boundaries. Confirmation alone does not establish statistical validity. |
| Matchers and other candidate producers | Use provisional readings to retrieve related evidence or propose comparisons while retaining candidate dependencies. Do not use them as confirmed training labels or settled premises. | Consume eligible accepted assertions as governed inputs; newly derived theoretical readings still begin as candidates. |
| Traceback and audit | Preserve all proposal versions, rejected alternatives, decisions, stale states and input snapshots. | Reconstruct the accepted state and explain each change without erasing prior interpretations. |
| Data Book and Scientific Report | Allow clearly designated working/audit appendices or exports where disclosure permits. Candidate material stays out of the mature claim stream and is explicitly identified wherever discussed as a proposal. | Publish eligible current lens claims with evidence citations and decision references. Recheck dependency freshness and disclosure at export time. |

Cross-lens comparisons join through shared evidence and registered entities; they do not copy category values as synonyms. An utterance may support a candidate Goffmanian participation shift, a Morenoan role relation and a Latourian delegation relation. Each retains its own warrant, uncertainty and adjudication. A consumer can show disagreement without forcing a single preferred theoretical vocabulary.

### 8.2 Candidate presentation and analytical continuity

Automated deductions must be discoverable without a confirmation step. A lens opens with a compact, populated candidate list when eligible candidates exist. Relevant consumers expose a clearly named candidate control or local suggestions area; they must not show an unexplained empty panel merely because nothing has matured. The analyst can filter to accepted-only, candidates-only or a clearly distinguished combined view. Higher-authority accepted information remains the first-read profile value.

Use calm sentence-case labels such as “Automated candidate”, “Analyst confirmed”, “Needs review” and “Stale evidence”. A candidate's first-read row identifies its proposition, lens, source interval and review state. Expanding it exposes the evidence, rule/model provenance, theoretical warrant, counter-evidence, alternatives and uncertainty. Do not manufacture a numerical confidence score; model confidence is not equivalent to theoretical validity. Candidate volume should be bounded through grouping and progressive disclosure while preserving access to all records.

Confirm, correct, reject and defer actions operate on the named assertion in its current leaf using Datascene's local editors and context menus. Source-to-lens and lens-to-source navigation preserve source time, ROI and selection context. Opening a candidate or rotating a visualization changes neither its authority nor the source evidence.

All consumers must use one governed retrieval path keyed by source, analysis revision, evidence snapshot and ledger revision. Rebuildable caches may accelerate it but cannot become independent mature profiles. A dependency change preserves historical decisions, marks affected views stale and excludes the assertions from current mature claims. Recalculation creates a new candidate for review. Transaction, retry and restart behavior must prevent a successful ledger write from leaving a falsely current projection.

The POS, Quant and Expressions hydration incidents demonstrate that artifact presence is insufficient. New leaves must recover the current selection when mounted, ignore stale responses after a selection change, load evidence without requiring a video blob, and distinguish loading, failed retrieval, no candidates and no accepted readings. A readiness indication must expose its evidence and a direct useful action.

## 9. Implementation sequence

**Runtime integration deferred:** the offline contract-cleanup subset has been delivered and automatically tested (section 14). This sequence remains the future runtime delivery plan. The original supplied schemas remain archived at version 1.0.0; revised version 1.1.0 drafts are not enabled in the application.

Begin with the contract revisions in section 3.2, followed by one analyst-led, source-bound pilot with visible automated candidates. A Goffmanian encounter reading is a practical first slice because it can reuse transcript, turn, scene and manual-annotation surfaces. Validate restoration, independent alternatives and dependency invalidation before extending the other lenses or mature consumers.

For edited material such as the Bond trailer, distinguish source chronology, represented chronology and the encounter being claimed. Adjacent shots alone do not demonstrate copresence. Corpus-specific construct and reliability assessment precedes claims of comparability across Bond, COP30 and Helsinki.

1. Register artifact and field semantics in the Attribute Registry.
2. Implement backend Draft 2020-12 validation and the additional referential checks listed above.
3. Implement candidate writers with no ledger-confirmation capability.
4. Add append-only analyst decision commands and projected-state adapters.
5. Add dependency/invalidation edges for source, clock, transcript, ROI, scene and Narrative Agent changes.
6. Add lens panels and consumer review surfaces with visible automated candidates, local evidence navigation, alternatives and maturity display.
7. Add controlled consumer projections and verify that stale records disappear from mature views.
8. Add StatsKit variables only after units, aggregation and sampling rules are registered.
9. Add governed-reporting eligibility and Data Book provenance.
10. Run contract, restoration, invalidation, authorization and cross-panel navigation tests before enabling the lenses by default.

## 10. Minimum acceptance tests

Each lens should fail release unless tests demonstrate:

- rejection of unknown fields and malformed IDs;
- rejection of missing source anchors and dependencies;
- explicit source-relative seconds and precision;
- denial of canonical writes by automated services;
- preservation of earlier candidates after correction;
- deterministic projected state under the same ledger and inputs;
- invalidation after source-clock, transcript, ROI, scene or Narrative Agent correction;
- isolation between projects and source records;
- coexistence of competing interpretations;
- source-to-lens and lens-to-source navigation;
- exclusion of candidate, rejected, invalidated and stale assertions from mature report claims, with explicitly provisional audit exports tested separately;
- restricted handling of sensitive Morenoan and Goffmanian identity relations;
- invariant values under Pi-view rotation;
- valid round-trip serialization and checksummed publication;
- visible automated deductions before any confirmation, including correct loading and empty states;
- candidate visibility across relevant consumers without mutation of accepted profile fields;
- no authority promotion through candidate reuse, graph projection, statistics or export;
- distinct candidate and accepted denominators in exploratory analyses;
- late-mounted panel hydration, missing-media resilience, failed-fetch recovery and stale-response rejection;
- successful restart/import restoration and idempotent decision retries without lost alternatives;
- consumer parity after confirmation, correction, rejection and dependency invalidation.

## 11. Scholarly anchors

The principal theoretical anchors for implementation are Bruno Latour's *Reassembling the Social* (Oxford University Press, 2005); Michel Callon's “Some Elements of a Sociology of Translation” (1986); John Law's writings on heterogeneous engineering and actor-network theory; Jacob L. Moreno's *Who Shall Survive?* (1934; revised edition 1953) and *Sociometry, Experimental Method and the Science of Society* (Beacon House, 1951); and Erving Goffman's *The Presentation of Self in Everyday Life* (1956/1959), “On Face-Work” (1955), *Behavior in Public Places* (1963), *Stigma* (1963), *Relations in Public* (1971), *Frame Analysis* (1974), “Footing” (1979), *Forms of Talk* (1981), and “The Interaction Order” (1983).

For attribution preceding or surrounding Goffman's early work, the registry should separately represent Kenneth Burke's *A Grammar of Motives* (1945), Robert F. Bales's *Interaction Process Analysis* (1950), George C. Homans's *The Human Group* (1950), Talcott Parsons's *The Social System* (1951), Ray Birdwhistell's *Introduction to Kinesics* (1952), and Gregory Bateson's “A Theory of Play and Fantasy” (1955), alongside the earlier Durkheimian, Simmelian, Thomasian, Cooleyan, Meadian and Schützian foundations. These associations should be described as antecedence, documented influence or parallel development according to the evidence; they must not be indiscriminately credited to Goffman.

## 12. Status statement

These files define controlled representations for future Datascene implementation. They do not establish that automated Latourian, Morenoan or Goffmanian inference is empirically valid, that the corresponding backend services exist, or that the constructs have been calibrated across genres and populations. Initial operation should therefore be analyst-led annotation with computational candidate assistance, followed by corpus-specific reliability and construct-validity studies.


## 13. Revision record — 2026-09-16

Design reader version 1.1.0 incorporates the implementation assessment and the user's direction that automated deductions be surfaced for analyst eyes before maturation. It adds explicit consumer contracts, schema revision requirements, continuity rules and acceptance criteria. The previous “implementation-ready” designation has been withdrawn. The JSON schemas remain version 1.0.0 and are intentionally resting; no producer, panel or runtime schema registration was added.

The scholarly attribution section is retained from the supplied proposal and has not been independently revalidated in this revision. The existing implementation assessment is a dated record; its narrower candidate-visibility recommendation is superseded by the policy in sections 2.6 and 8 of this reader.


## 14. Automated contract-cleanup delivery — 2026-09-16

Reader version 1.2.0 records delivery of the known schema corrections that do not require manual testing. The previous revision record remains historical. Original version 1.0.0 inputs are preserved; the revised version 1.1.0 schemas live in `docs/schemas/relational_lenses/1.1.0/`. The package README documents generation, validation, migration limits and deferred work.

Delivered changes include addressable/versioned anchors and analysis/project identity; candidate provenance without a mandatory analyst decision; declared authority-state checks; automated producer metadata; supported alternatives and mandatory concept provenance; principal-relation warrants; Latourian participants/stabilization support; and Morenoan ethics, scope-dependent required content and sociometric metadata. Standalone schemas share generated definitions to prevent drift. Offline semantic checks validate local references and duplicate identifiers, interval order and normalized geometry bounds. Synthetic fixtures exercise candidates before confirmation as well as rejection of invalid records.

These changes do not implement trusted writer authorization, independently reviewed assertions, complete source ownership or external-reference resolution, runtime dependency invalidation, candidate panels, consumer synchronization, statistical validity or publication authorization. In particular, a structurally valid analyst decision reference is not evidence that such a decision exists. The validator states this boundary explicitly. The policy of surfacing automated deductions before maturation remains unchanged.

No live analysis, profile, source annotation, runtime registry or application environment was migrated. Future integration retains the staged acceptance criteria above; passing offline checks is not a substitute for rendered interaction and cross-consumer tests.

Validation for this delivery: 24 automated contract tests passed, generated standalone schemas matched their versioned sources, and the candidate CLI example passed with no analyst decision. Historical confirmation remains representable when a reading becomes stale, invalidated, superseded or conflicted; this does not make it eligible for a current mature claim.
