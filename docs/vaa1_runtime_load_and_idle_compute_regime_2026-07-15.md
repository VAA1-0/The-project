# Datascene/VAA1 Runtime Load and Idle Compute Regime

Date: 2026-07-15
Status: implemented

## Purpose

Align the delivered canonical architecture with responsive scientific work. Datascene should not
load every analytical surface at once, and user downtime should improve likely next responses
without allowing background inference to compete with foreground work or declare mature truth.

## Foreground rules

1. User interaction has priority over warming work.
2. Hidden panel code is initialized only when the panel is first opened.
3. Full status, corrections, and reusable artifacts coalesce concurrent reads.
4. Source media retains a stable URL so byte-range requests can reuse browser state.
5. Correction writes invalidate related read caches.
6. The compact status endpoint supplies shell and playback bootstrap data without status-time
   artifact regeneration.

## Pareto idle order

After seven seconds of visible inactivity, or twelve seconds while hidden, at most one task runs:

1. compact status summary;
2. shared mature analysis view;
3. Master Schema artifact;
4. Scene Card artifact;
5. Datascene Meaning Network artifact.

This order favors datasets used across the most panels and common next actions. Completed warming
is not repeated for that analysis unless governed corrections change. Pointer, keyboard, wheel,
analysis-selection, and visibility activity cancel pending launches. Running network work is allowed
to finish safely, but no next task launches until a new idle window.

## Scientific boundary

Idle computation warms existing governed products. It does not confirm candidates, alter the
decision ledger, regenerate analytical truth, or run SOM/open-topology proliferation. Future idle
tasks must remain deterministic/read-only or write explicitly non-authoritative cache artifacts.

## Runtime evidence

For analysis `0b16df1c-bc47-4b24-b90f-4d34e53c68e4`:

- full status payload: 4,546,052 bytes;
- compact status payload: 55,119 bytes;
- warm compact response: 88–94 ms;
- compact transfer reduction: approximately 98.8%;
- stable media requests stopped after the bounded browser byte-range sequence;
- no continuing request traffic was observed during the final five-second foreground-idle sample.
