# VAA1 Shared Taxonomy Governance Design

Date: 2026-04-11  
Status: design note  
Purpose: define how VAA1 should move from browser-local learned labels to a governed shared taxonomy workflow

## Why This Design Exists

VAA1 now supports analyst-friendly categorical metadata entry with:

- one-click dropdowns
- custom-label entry
- browser-local saved labels
- local removal of saved labels

That is a good interim analyst experience, but it is not sufficient as a system-wide governance model.

If VAA1 is to be used by many users, the taxonomy cannot remain:

- personal
- hidden in browser local storage
- unreviewed
- unversioned

The system needs a shared taxonomy layer that can grow without collapsing into inconsistency.

## Governing Principle

VAA1 should support **controlled evolution**, not rigid lock-in and not uncontrolled label sprawl.

That means:

- analysts must be able to name something the current dropdown does not cover
- new labels must not silently become global truth
- administrators must be able to approve, rename, merge, retire, and document labels
- the user experience must remain lightweight for analysts

In short:

- analysts propose
- VAA1 remembers
- governance decides
- approved labels become shared

## Current State

Implemented now:

- custom taxonomy labels are saved in browser-local storage
- local labels remain available on that browser until removed
- local labels can be manually removed
- this behavior exists on the VAA1 side, not in raw CVAT

Current limitations:

- labels are not shared across users or machines
- there is no review queue
- there is no distinction between local suggestion and approved system label
- there is no rename / merge / retire governance workflow
- no audit trail exists for taxonomy changes

## Target Taxonomy Layers

The taxonomy should be understood as four layers.

### Layer 1. Core System Taxonomy

Purpose:

- provide the default shared labels shipped with VAA1

Examples:

- `news`
- `drama / fiction`
- `public`
- `professional`

Characteristics:

- versioned with the product
- stable by default
- visible to all users
- editable only through governed admin flow

### Layer 2. Approved Shared Extension Labels

Purpose:

- allow the taxonomy to grow beyond the original seed list

Examples:

- `intimate`
- new situational detail labels
- new media subtype labels

Characteristics:

- visible to all users
- stored in backend persistence
- approved by admin or governance role
- versioned and auditable

### Layer 3. Local Analyst Draft Labels

Purpose:

- allow analysts to work without blockage when the list is incomplete

Characteristics:

- visible only to the current user/browser until submitted or approved
- removable by the user
- should not automatically become shared
- should be easy to submit for review

### Layer 4. Retired / Blocked Labels

Purpose:

- prevent repeated reintroduction of bad labels

Examples:

- misspellings
- duplicate synonyms
- deprecated formulations

Characteristics:

- not shown in shared dropdown options
- may be mapped to a preferred replacement
- optionally hidden from analyst suggestion lists
- retained for audit and migration purposes

## Required Label States

Each non-core label should have a lifecycle state.

Recommended states:

- `draft_local`
  - created by analyst locally
  - not yet shared
- `submitted`
  - proposed for shared review
- `approved_shared`
  - visible system-wide
- `renamed`
  - superseded by another label
- `merged`
  - folded into another canonical label
- `retired`
  - no longer offered for new use
- `blocked`
  - intentionally prevented from reuse

## Governance Roles

### Analyst

Can:

- choose approved labels
- create local draft labels
- remove local draft labels
- submit a local draft label for review

Cannot:

- silently publish system-wide labels
- rename shared labels globally
- retire shared labels globally

### Reviewer / Taxonomy Curator

Can:

- inspect submitted labels
- add rationale
- recommend approval, rename, merge, or rejection

May or may not have final authority depending on team setup.

### Taxonomy Admin

Can:

- approve submitted labels as shared
- rename labels
- merge duplicates
- retire outdated labels
- block problematic labels
- define canonical preferred terms

### Platform Admin

Can:

- do everything a taxonomy admin can do
- also manage persistence, migration, audit access, and recovery

## Required Data Model

The shared taxonomy should be stored in backend persistence, not only in frontend local storage.

Recommended top-level fields per label:

- `id`
- `scope`
- `label`
- `normalized_label`
- `parent_label_id` or `parent_label`
- `status`
- `source`
  - `core`
  - `approved_extension`
  - `user_submission`
- `created_by`
- `created_at`
- `approved_by`
- `approved_at`
- `retired_at`
- `replacement_label_id`
- `notes`
- `usage_count`

Recommended scope values:

- `media_genre`
- `media_subgenre`
- `situational_genre`
- `situational_subgenre`
- `privacy`
- `expertise`

Note:

Use `privacy` and `expertise` as analyst-facing governance terms even if internal legacy storage still uses `_axis` in some places during transition.

## Normalization Rules

Shared taxonomy governance needs explicit normalization.

Recommended normalization:

- trim leading/trailing whitespace
- collapse repeated internal whitespace
- compare case-insensitively for duplicate detection
- preserve display label casing separately from normalized matching form

Examples:

- `Intimate`
- `intimate`
- ` intimate `

should resolve to the same normalized candidate.

## Duplicate And Synonym Policy

Not every new label should become a new category.

When a label is submitted, the system should check:

- exact normalized duplicate
- near-duplicate spelling
- likely synonym
- parent-category mismatch

Admin action choices should include:

- approve as new canonical label
- map to existing canonical label
- merge into another label
- reject with rationale

Example:

- analyst submits `intimate`
- system detects no exact duplicate
- admin can:
  - approve `intimate`
  - map it to `private`
  - or keep both if they are meaningfully distinct

## Analyst Workflow

### Desired Lightweight Flow

1. Analyst opens metadata dropdown.
2. If needed label exists, they use it.
3. If not, they type a custom label.
4. VAA1 lets them continue immediately.
5. VAA1 marks that label as local or pending.
6. Later, the label may be approved or mapped into the shared taxonomy.

### Analyst Experience Rule

The analyst should never be blocked from proceeding because governance is incomplete.

Governance should happen around the work, not against it.

## Admin Workflow

### Required Review Queue

VAA1 should eventually provide a taxonomy review queue with:

- submitted label
- scope
- parent category if relevant
- submitting user
- example media item(s)
- existing similar labels
- decision actions

### Required Admin Actions

- `Approve`
- `Approve with renamed display label`
- `Merge into existing label`
- `Retire`
- `Block`
- `Return with note`

## UI Requirements

### Analyst-Facing UI

Must show:

- approved dropdown options
- current chosen value
- local saved labels
- a remove control for local saved labels
- clear wording that distinguishes:
  - local saved label
  - shared approved taxonomy

Should eventually also show:

- `Submit for shared use`
- `Pending review`
- `Approved system-wide`

### Admin-Facing UI

Must eventually show:

- review queue
- scope filters
- usage counts
- duplicate suggestions
- merge / rename / retire controls
- audit trail

## Persistence Strategy

### Interim

Keep current browser-local behavior for analyst continuity.

### Next Implementation Step

Add backend persistence for taxonomy records and label submissions.

### Migration Rule

When backend shared taxonomy exists:

- local browser labels should not be discarded blindly
- VAA1 should offer to reconcile them:
  - keep local only
  - submit for review
  - replace with approved shared label

## Audit And Traceability

Taxonomy changes must be reviewable.

Required audit events:

- label created
- label submitted
- label approved
- label renamed
- label merged
- label retired
- label blocked

Why this matters:

- annotation meaning changes over time
- the taxonomy is part of interpretation, not just interface chrome
- researchers and reviewers need to know when classification language shifted

## Relationship To CVAT

This governance model belongs primarily to **VAA1**, not to raw CVAT.

Why:

- VAA1 owns interpretive context and durable schema meaning
- CVAT is the working annotation engine
- the shared taxonomy should remain VAA1-governed even when CVAT is embedded or linked

So:

- CVAT labels may still be operational task labels
- VAA1 shared taxonomy is the higher-order interpretive vocabulary

## Recommended Implementation Order

1. backend taxonomy store and API
2. shared vs local label distinction in frontend
3. label submission workflow
4. admin review queue
5. rename / merge / retire tooling
6. migration path from browser-local labels

## Immediate Recommendation

For the next implementation slice:

- keep current local saved-label behavior
- add backend persistence for shared approved labels
- add a lightweight `Submit for shared use` action
- do not wait for the full admin UI before starting backend persistence

That will let the system evolve without breaking the current analyst experience.

## Summary

The right governance model is not "lock every label in advance" and not "let every label become global by accident."  
It is a layered model where analysts can work immediately, local suggestions are preserved, and approved shared taxonomy grows through explicit review.
