# Bug report: recovered visual analysis retained a stale failure state

Date: 2026-08-05  
System: Datascene/VAA1 unattended corpus analysis  
Severity: High — queue progress blocked and workstation resources consumed

## User-visible incident

The corpus queue appeared active overnight, but Marcella 2 and Marcella 3 did
not advance. Marcella 1 was repeatedly launched even after its recovered visual
outputs had been produced and surfaced.

## Actual failure

An earlier Marcella 1 attempt persisted:

```text
visual_error = "'NoneType' object has no attribute 'write'"
```

A later checkpoint recovery successfully produced the governed visual branch,
including object, OCR, expression, face, and visual-tone records. The success
path replaced `results.visual_analysis`, but did not delete the obsolete
`results.visual_error` property.

Completion logic correctly treated any remaining required-branch error as a
partial/failed run. The scheduler consequently saw Marcella 1 as needing work
and launched it again. Each successful rerun retained the same obsolete flag,
forming a retry loop. The resulting analysis record also became unusually
large and repeatedly expensive to persist, degrading API and panel response.

## Root cause

The branch state was modeled with two independently persisted facts:

1. the current successful visual artifact set; and
2. an error string belonging to a superseded attempt.

The visual success transition populated the first fact without atomically
clearing the second. No queue-level retry bound prevented the contradiction
from consuming the queue indefinitely.

## Correction

The visual success transition now removes `visual_error` before checkpoint and
analysis-record persistence. Completion is then derived from the current
required-branch state.

## Operational workaround for existing records

For an already affected record:

1. stop the launcher or queue producer at a checkpoint boundary;
2. verify the governed visual checkpoint and required output files exist;
3. remove only the superseded `visual_error` and recompute completion state;
4. persist the reconciled analysis record atomically;
5. restart the corrected backend;
6. request the bounded status summary and confirm the recovered item advances;
7. resume the queue with the next incomplete analysis.

Never clear an error merely because a file with a plausible name exists. The
workaround requires the completed visual checkpoint and governed artifact set.

## Required regression checks

- failed visual attempt followed by successful checkpoint recovery clears the
  obsolete error and becomes completed;
- a genuinely failed recovery retains its current error;
- a completed item advances exactly once in the backup queue;
- the next queued analysis starts after the configured cooling period;
- status summary, persisted record, checkpoint, and panel counts agree.

## Prevention rule

Branch completion is an atomic state transition: successful artifacts,
completed-stage membership, current error removal, checkpoint persistence, and
public status must agree before the queue may make its next decision.
