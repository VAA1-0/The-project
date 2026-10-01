# Datascene interactive annotation operating practice

Date: 2026-08-05

## Principle

The analyst workspace remains operational during background analysis. Panel
confirmations and BBox/ROI annotations are committed as foreground work;
proliferation is derived background work.

## Required sequence

1. Update the panel optimistically so editing can continue.
2. Commit only the canonical correction payload to its small sidecar artifact.
3. Write atomically and acknowledge the durable commit immediately.
4. Mark Master Schema and panel proliferation as queued or deferred.
5. Perform proliferation through the heavyweight analysis slot when capacity is
   available.
6. Refresh consumers from the canonical artifact without overriding the analyst.

The commit path must never serialize the video analysis result, load detector
arrays, wait for the analysis execution lock, or run Scene Card, Meaning
Network, StatsKit, report, or maturity generation.

## Runtime practice

- Python save handlers run in the server worker pool rather than blocking the
  API event loop.
- Annotation saves wait no more than two seconds for the Python runtime before
  using the isolated dashboard-side writer.
- The dashboard-side writer writes only `annotation_corrections.json`; it does
  not read or rewrite `analysis_record.json`.
- Both writers use temporary-file replacement, so interruption cannot expose a
  partially written correction artifact.
- Saved-analysis hydration treats the correction sidecar as canonical input, so
  a dashboard-side commit survives restart and is available for later
  proliferation.
- Heavy analysis admission reserves 2 GiB of available system memory for the
  interactive workspace by default. The reserve can be configured with
  `VAA1_INTERACTIVE_MEMORY_HEADROOM_BYTES`; insufficient headroom rests the next
  analysis rather than consuming the annotation tier.

## Acceptance checks

- Saving a panel or BBox edit during a Science scan returns without waiting for
  `ANALYSIS_EXECUTION_LOCK`.
- A deliberately unresponsive Python API falls back to the sidecar commit in a
  bounded time.
- The analysis record size does not affect fallback save cost.
- Restart hydrates the committed correction.
- Proliferation may be pending, but the saved analyst value reopens immediately
  and remains the higher authority.
