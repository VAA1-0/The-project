# Datascene/VAA1 Calm Analytical Indication Design Contract

Date: 2026-07-14

## Principle

Datascene should communicate uncertainty, missing layers, stale state, and review needs without turning the interface into an alarm system. Indications exist to support the next analytical action, not to dramatize system limitations.

## Default interaction rule

Use the smallest local indication that preserves scientific honesty:

1. Show the best current reading normally, with compact authority/maturity metadata when useful.
2. Show candidate, partial, stale, or missing state beside the affected value or control.
3. Offer one calm next action such as `Inspect source`, `Run extraction`, `Review`, or `Add annotation`.
4. Put technical detail, dependency diagnostics, and provenance behind disclosure or traceback.
5. Do not repeat the same state across banners, cards, toasts, and dialogs.

## Tone vocabulary

- `quiet`: neutral inline note; default for missing optional data and unavailable projections.
- `informative`: compact local state that affects interpretation but does not block work.
- `attention`: restrained review cue for stale/conflicting evidence that could change a current claim.
- `blocking`: reserved for destructive actions, corrupted persistence, rights/consent restrictions, or inability to preserve scientific state.

Missing optional data is never `blocking` merely because a richer analysis could be run.

## Language

Prefer:

- `No source-linked indication is available here.`
- `Speaker assignment has not been reviewed.`
- `This value uses a scene proxy; shot intervals are not available.`
- `Timing changed. Review dependent prosody when useful.`

Avoid:

- all caps;
- repeated warning icons;
- exclamation marks;
- global banners for panel-local conditions;
- language such as `CRITICAL`, `FAILED`, or `MISSING DATA` when work can continue safely;
- presenting low confidence as an emergency.

## Progressive disclosure

The first viewport should answer what Datascene currently believes and what the analyst can do next. Detailed missing-layer inventories belong in source readiness, traceback, governance, or developer observability views—not in every analytical card.

## Notification budget

- One visible indication per affected analytical object.
- One toast only after a user-initiated action succeeds or cannot safely complete.
- Persistent banners only for program-wide blocking conditions.
- Diagnostics should be deduplicated by condition and scope.
- Resolved indications disappear without celebratory or repetitive messaging.

## Scientific integrity

Calm presentation must not hide uncertainty. Authority, maturity, validity, provenance, and source availability remain accessible and exportable. The design changes emphasis and placement, not the underlying record.

## Acceptance

- Optional missing layers use quiet local notes.
- Candidate and stale readings remain visually distinguishable from mature/current readings.
- Every indication offers a relevant next action or no action when none is needed.
- Advanced detail is reachable within one disclosure or traceback action.
- Only truly blocking scientific-state or rights failures interrupt the workflow.
