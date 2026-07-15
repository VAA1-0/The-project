# VAA1 Sprint Program: Data Maturation Proliferation Regime v2

Date: 2026-07-12

## 1. Objective

This document outlines the stepwise implementation plan for the **Data Maturation Proliferation Regime v2**. It operationalizes the architectural principles outlined in the project design review, moving VAA1 from a system with promising but fragmented intelligence to a governed, trustworthy analytical environment.

The core architectural shift is to separate **candidate discovery** from **data governance**. Similarity models may propose candidates, but only a canonical decision ledger and a deterministic projection engine can define and propagate mature truth.

## 2. Governing Principles

- **Proliferate Decisions, Not Guesses:** The system propagates the consequences of confirmed, authoritative decisions, not raw model outputs.
- **Project Canonical Truth, Do Not Copy Panel State:** Panels render projections from a single source of truth (the Master Schema, informed by the Decision Ledger). They do not maintain their own separate, competing states.
- **Use Matchers to Explore, Not to Govern:** Similarity scanners (like the "SOM-matcher") are candidate generators. Their output is always subject to review and never writes directly to mature data fields.
- **Analyst Authority is Final:** An explicit user correction is the highest authority and can only be superseded by another explicit user correction.

## 3. The Four-Layer Architecture

This sprint will implement the following four-layer architecture:

1.  **Evidence Substrate:** The immutable, versioned source observations (detections, transcript segments, etc.).
2.  **Canonical Decision Ledger:** The single, append-only source of truth for all authoritative decisions made by the analyst or a governed system process.
3.  **Projection Engine:** A deterministic service that calculates what each UI surface should display based on the current state of the evidence and the decision ledger.
4.  **Candidate Services:** Optional, pluggable systems (matchers, classifiers, LLMs) that propose new candidates for review.

---

### Step 0: Empirical Taxonomy Discovery and Delivery Sprint

**Goal:** Before implementing the v2 regime, conduct a comprehensive empirical audit of all existing data attributes in the VAA1 system. This is a mandatory, read-only discovery phase to establish a precise, machine-actionable Data Attribute Taxonomy and Dependency Model.

**Governing Document:**

-   `docs/sprint_program_empirical_taxonomy_discovery_2026-07-12.md`

**Acceptance Criteria:**

-   The audit is complete and has produced the required deliverables (Attribute Registry, Dependency Graph, Migration Matrix).
-   The team has a shared, empirically grounded understanding of the current data landscape before proceeding with implementation.

**Current gate status (2026-07-14): `NO-GO`.** The architectural findings report exists, but the field-level Attribute Registry, Implementation Bindings, Vocabulary Registry, typed Dependency Graph, Migration Matrix, representative runtime evidence index, and Pass 1 vertical-path proof are incomplete. The PDF inventory is an audit specification, not completion evidence.

Step 0 follows four empirical passes. Only Pass 1 blocks the BBox/ROI pilot; later analytical and experimental passes must not delay that bounded pilot once its ten go/no-go conditions pass.

---

## 4. Stepwise Implementation Program

### Step 1: Define and Implement the Canonical Decision Ledger

**Goal:** Establish the architectural heart of the new regime. Create a single, durable, and auditable log for every authoritative decision.

**Tasks:**

1.  **Finalize Schema:** After Pass 1, formalize `CanonicalDecision` with typed decision action and subject reference, property, temporal/spatial scope, value, independent authority/maturity/validity/review/conflict/projection states, supersession, evidence and provenance-event references, and invalidation policy.
2.  **Backend Service:** Create a dedicated backend ledger module and expose it through `api_server.py`; do not concentrate governance logic in the API entry point.
3.  **Persistence:** Ensure the ledger is persisted as a distinct, top-level artifact (e.g., `decision_ledger.json`) within the analysis results, separate from `annotation_corrections.json`.
4.  **API Endpoints:**
    -   `POST /api/analysis/{id}/decisions`: Create a new decision.
    -   `GET /api/analysis/{id}/decisions`: Retrieve the full ledger.
    -   `PUT /api/analysis/{id}/decisions/{decision_id}`: Update a decision (e.g., to mark it as superseded).

**Key Files:**

-   `docs/schemas/vaa1_canonical_decision_ledger.v2.schema.json` (New)
-   `src/backend/analysis/decision_ledger.py` (New)
-   `api_server.py`
-   `tests/test_decision_ledger_contract.py` (New)

**Acceptance Criteria:**

-   A new, validated decision can be added to the ledger via an API call.
-   The entire ledger can be retrieved for an analysis.
-   Decisions are persisted and survive a server restart.
-   Contract tests prove the schema and basic CRUD operations.

**Governance Check:** This step creates the foundation for all subsequent governance actions, establishing a single source of truth for decisions.

---

### Step 2: Refactor a Pilot Workflow - BBox/ROI Label Correction

**Goal:** Prove the new architecture by refactoring a single, critical workflow to use the Decision Ledger and a rudimentary Projection Engine. The BBox/ROI label workflow is the ideal pilot due to its known fragility.

**Tasks:**

1.  **Refactor `saveSelectedIndication`:** In `VideoPanel.tsx`, modify the save logic for BBox/ROI labels. Instead of creating a complex `ManualVisualAnnotation` rule directly, it should now create and `POST` a canonical `Decision` to the new `/api/analysis/{id}/decisions` endpoint.
    -   `subject_ref` will be the `track_id` or a stable object ID.
    -   `property` will be `label`.
    -   `scope` will contain the time interval and geometry.
    -   `value` will be the new analyst-provided label.
    -   `authority` will be `explicit_user_correction`.
2.  **Create a Backend Projection Service:** Implement a deterministic backend projection contract for subject, time, and geometry scope. The frontend may call and cache it but must not become the authority resolver.
3.  **Implement Projection Logic:** Resolve the ledger against immutable tracked-object evidence and return the displayed value plus authority, maturity, validity, source refs, decision refs, and traceback refs.
4.  **Update `VideoPanel.tsx`:** Modify the BBox overlay rendering logic to call `getProjectedLabelForTrack` to get the display label, instead of its current complex, local override logic.

**Key Files:**

-   `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
-   `src/frontend/lib/video-service.ts`
-   `src/frontend/lib/bbox-authority.ts`

**Acceptance Criteria:**

-   Correcting a BBox label in the UI creates a new entry in `decision_ledger.json`.
-   Upon refresh, the `VideoPanel` displays the corrected label on the BBox.
-   The correction is scoped to the correct time and geometry; other detections on the same track are unaffected unless the scope dictates it.
-   The original raw detector label remains unchanged in its source artifact.

**Governance Check:** This step proves that a panel can render a projection from a canonical decision, breaking the "panel-local truth" anti-pattern.

---

### Step 3: Decouple the "SOM-Matcher" into a Pure Candidate Service

**Goal:** Architecturally reposition the matcher as a "Layer 4: Candidate Service" that proposes candidates to the Decision Ledger but never writes mature data itself.

**Tasks:**

1.  **Refactor `live_mature_data_proliferation_bus.py`:**
    -   Rename the module to `candidate_discovery_agent.py` or similar to reflect its new role.
    -   Ensure its output is *always* a list of `Candidate` objects, each with a `requires_confirmation: true` flag.
    -   Remove any logic that attempts to directly create or modify "mature" artifacts. Its sole job is to find and score potential matches.
2.  **Modify Matcher UI:** In `MeaningPlotPanel.tsx` and `VideoPanel.tsx`, ensure that the UI for reviewing matcher results is clear.
    -   The "Confirm" action should not directly apply the label. Instead, it should trigger the creation of a `Decision` (as in Step 2) and save it to the ledger.
    -   The "Reject" action should create a `Decision` with a `value` of `__rejected__` or similar, which the Projection Engine can use to suppress future false positives.
3.  **Economical Samples:** Update the matcher's evidence gathering to prefer pre-computed embeddings or static thumbnails over loading video clips, as per your analysis.

**Key Files:**

-   `src/backend/analysis/live_mature_data_proliferation_bus.py` (to be refactored/renamed)
-   `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`
-   `src/frontend/app/V2components/components/panels/VideoPanel.tsx`

**Acceptance Criteria:**

-   The matcher's output is a list of candidates that are presented for review.
-   Confirming a candidate creates a canonical `Decision` in the ledger.
-   Rejecting a candidate creates a canonical rejection `Decision`.
-   The matcher no longer has any code paths that can directly modify a "mature" data field.

**Governance Check:** This strictly enforces the boundary between candidate discovery and authoritative decision-making.

---

### Step 4: Generalize the Projection Engine and Migrate Panels

**Goal:** Expand the pilot Projection Engine from Step 2 into a more general service and migrate all major panels to consume it.

**Tasks:**

1.  **Expand Projection Service:** Generalize the `getProjectedLabelForTrack` function into a more comprehensive `getProjectedState(subjectRef, timestamp)` service. This service will be responsible for returning the complete, authoritative state (label, attributes, etc.) for any subject at any point in time.
2.  **Migrate Panels:** One by one, refactor the following panels to get their data from the new Projection Service instead of reading and interpreting raw artifacts locally:
    -   `MeaningPlotPanel.tsx`
    -   `SceneCardPanel.tsx`
    -   `SourceMediaMetadataPanel.tsx`
    -   `NarrativeAgentPanel.tsx` (or its equivalent in `MasterSchemaPanel.tsx`)
3.  **Implement Projection Policies:** Instead of hardcoding which panels update, the `Decision` schema should include a `projection_policy` field (e.g., `all_character_assignment_consumers`), as you recommended. The Projection Engine will use this to determine the scope of a decision's impact.

**Key Files:**

-   `src/frontend/lib/video-service.ts`
-   All major panel components (`.tsx` files).

**Acceptance Criteria:**

-   A single manual correction made in the `VideoPanel` is correctly and instantly reflected in the `MeaningPlotPanel`, `SceneCardPanel`, and `NarrativeAgentPanel`.
-   Panels are visibly simpler, as complex state resolution logic has been moved to the central service.
-   The system feels more cohesive and responsive to analyst input.

**Governance Check:** This completes the transition to a "Project Canonical Truth" model, eliminating data inconsistency between panels.

---

### Step 5: Add Regression Coverage and Finalize Documentation

**Goal:** Lock in the new architecture with comprehensive tests and update all relevant documentation to reflect the new regime.

**Tasks:**

1.  **Backend Tests:** Add contract tests for the Decision Ledger API, ensuring that scope, authority, and supersession rules are enforced.
2.  **Frontend Tests:** Expand the `manual-annotation-governance.test.mjs` suite to cover the full decision-projection-render loop. Add tests that prove a rejected candidate does not reappear.
3.  **Playwright Tests:** Implement the rendered DOM fixture test described in `docs/vaa1_bbox_roi_dom_fixture_testnote_2026-05-18.md` to provide end-to-end verification.
4.  **Update Documentation:**
    -   Update the `Program Map` to reflect the new 4-layer architecture.
    -   Update all relevant `working_handover_handout_*.md` files to deprecate old architectural assumptions.
    -   Create a new canonical document: `docs/architecture/data_maturation_regime_v2.md`, which consolidates the principles from this sprint.

**Acceptance Criteria:**

-   The test suite provides strong guarantees that manual authority is preserved and that candidates cannot become mature truth without a canonical decision.
-   All project documentation accurately reflects the new, more robust architecture.

This stepwise program directly addresses the architectural weaknesses you identified. By building the governance layers first and treating similarity search as a pluggable service, we can deliver a system that is not only more powerful but also fundamentally more trustworthy and maintainable.
