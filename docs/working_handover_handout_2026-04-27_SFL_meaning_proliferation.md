# VAA1 Sprint Handout: SFL, Meaning-Making, and Label Proliferation

Date: 2026-04-27

## Core Principle

Analyst labor is for judgment, not repetition.

VAA1 should surface useful second-order labels at scale with open weights, provenance, and traceback, while preserving manual annotation and manual correction as the highest authority.

## Delivered

### 1. SFL + Dependency Stage 1 Basis

Added a backend artifact builder:

- `src/backend/analysis/dependency_sfl_stage1.py`
- schema: `vaa1.dependency_sfl_stage1.v1`

It produces:

- token-level traceback
- dependency/SFL-lite features
- speech function candidates
- process type candidates
- modality, stance, affect, intensity hints
- metadata, genre, and culture context slots
- open weights
- authority policy

Governance rule:

- parser output may seed candidates
- parser output must not override manual annotation or correction

### 2. Low-Hanging Multimodal Meaning Layer

Added:

- `src/backend/analysis/multimodal_meaning_stage1.py`
- schema: `vaa1.multimodal_meaning.stage1.v1`

It creates candidate meaning events for:

- turn-taking
- addressivity
- repair/self-correction
- repetition
- topic shifts
- micro-rituals
- power-balance candidates
- gaze target priority
- object significance escalation
- spatial/cinematic clue candidates

It also records that VAA1 must not assume story-world meaning is linear. Episodic narration and cross-cutting can link events across non-linear narrative relations.

### 3. Second-Order Label Proliferation

Added:

- `src/backend/analysis/second_order_label_proliferation.py`
- schema: `vaa1.second_order_label_proliferation_plan.v1`

It turns meaning events into label instructions for:

- Interaction
- Action
- Movement
- Identification
- Role
- Scene
- Episode
- Situation
- Expression
- Object
- ReportClaim
- ForensicObservation

It uses graduated affirmation:

- candidate
- probable
- strongly supported
- analyst confirmed

Confirmation policy:

- do not interrupt the analyst for every useful candidate
- surface routine findings as chips/badges
- prompt only at high-impact authority boundaries
- preserve manual override everywhere

### 4. UI Read-Only Surfacing

Added:

- `src/frontend/app/V2components/components/panels/SecondOrderLabelAffirmations.tsx`

Mounted second-order label affirmations in:

- Video BBox/ROI editor
- Objects panel rows
- Master Schema review tray
- Master Schema annotation rows

These are read-only governed affirmations. They do not mutate saved annotations.

## Verification

Passed:

```bash
python3 tests/test_dependency_sfl_stage1_contract.py
python3 tests/test_multimodal_meaning_stage1_contract.py
python3 tests/test_second_order_label_proliferation_contract.py
python3 -m py_compile src/backend/analysis/dependency_sfl_stage1.py src/backend/analysis/multimodal_meaning_stage1.py src/backend/analysis/second_order_label_proliferation.py tests/test_dependency_sfl_stage1_contract.py tests/test_multimodal_meaning_stage1_contract.py tests/test_second_order_label_proliferation_contract.py
cd src/frontend && npx tsc --noEmit
cd src/frontend && node --test tests/manual-annotation-governance.test.mjs
```

Known verification note:

- `npm run lint` is still blocked by the existing frontend lint backlog, not by this sprint's changes.

## Current Boundary

This sprint delivered the basis and first read-only UI surfacing.

It has not yet implemented:

- backend pipeline wiring that automatically creates these artifacts during every analysis
- analyst mass-approve/reject actions
- saved annotation mutation from second-order labels
- report/printout export rendering for the new label instructions
- external LLM label check-up execution

## Next Recommended Step

Wire artifact generation into the analysis pipeline, then add a batch review surface:

1. Generate SFL/dependency artifact.
2. Generate multimodal meaning artifact.
3. Generate second-order label proliferation plan.
4. Surface chips in existing panels.
5. Add mass review actions only for promotion/export/authority boundaries.

The desired analyst experience remains:

VAA1 finds and proposes.
VAA1 affirms low-risk patterns at scale.
The analyst corrects, promotes, rejects, or sharpens.
Those corrections govern the next wave of proliferation.

