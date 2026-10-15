# Stage 5 Reproducible-Measurements Operating Contract

Date: 2026-10-15
Status: Prepared with recovery-first and cross-panel-parity amendments; delivery open

Stage 5 turns governed evidence into reproducible measurements. It does not
permit an empty consumer response to become evidence that data is absent.
Measurements remain distinct from interpretations, and recovery never invents
a value or silently substitutes a proxy.

## Recovery-first measurement states

A measurement surfaces one explicit state:

- `registered` — the measurement contract exists but has not been hydrated;
- `hydrating` — registered artifacts and projections are being resolved;
- `recovered` — persisted inputs or results were found and rebound;
- `computed` — a governed run produced a reproducible result;
- `degraded` — a result exists with declared quality or coverage limitations;
- `recompute_required` — inputs exist, but the registered result is stale;
- `rehydration_failed` — the recovery ladder completed without a usable result;
- `unsupported` — no registered producer or method exists for this capability.

The user-facing phrase `not computed` is allowed only for
`rehydration_failed`, after a recovery receipt is persisted. Unsupported work is
shown as `unsupported`, and a queued or eligible calculation is shown as
`recompute required`; neither is collapsed into `not computed`.

## Mandatory rehydration and mitigation ladder

Before a measurement may become `rehydration_failed` / `not computed`, the
system must:

1. Validate the active project, analysis, source fingerprint, Global Clock
   revision and measurement identity.
2. Inspect the full-analysis manifest and measurement registry for the declared
   producer, artifact, version and dependencies.
3. Load the canonical persisted result directly, independently of optional
   video bytes and panel mount order.
4. Recover eligible governed inputs from their canonical artifacts and accepted
   Master Schema projection; candidate and historical inputs remain typed.
5. Repair a missing or stale consumer projection from the canonical record
   without creating a second authority store.
6. When the registered method, inputs and execution policy permit it, run a
   bounded selective recomputation rather than rerunning unrelated analysis.
7. Reconcile the resulting measurement envelope across every applicable
   consumer and reject mixed run, input or revision generations.
8. If recovery still fails, persist a recovery receipt naming attempts,
   unavailable dependencies, errors, timestamps, versions, retry eligibility
   and the next analyst/developer action.

The ladder fails closed. It may recover, recompute, or explain; it may not
fabricate data, infer maturity from UI visibility, or disguise a proxy as the
requested measurement.

## Canonical measurement envelope

Every computed or degraded result carries:

- measurement and run ids;
- active project, analysis and source identities;
- source fingerprint and Global Clock revision where temporal;
- input artifact ids, versions, checksums and accepted/candidate scope;
- unit of analysis, population and denominator;
- inclusion, exclusion, missingness and nesting rules;
- method and implementation version;
- effective parameters, baseline and random seed where applicable;
- estimate, units, uncertainty and diagnostics;
- maturity, freshness, limitations and invalidation state;
- evidence/source-navigation links; and
- creation, recomputation and supersession provenance.

## Cross-panel measurement parity

One canonical measurement envelope is projected to all applicable panels. At a
minimum, parity is checked across StatsKit, the originating evidence panel,
Master Schema, Data Maturation, Search, Traceback and report/export. Meaning /
Plot and Narrative Agent also receive the measurement when their claims or
paths consume it.

Applicable panels must agree on measurement id, run id, value, unit,
population/denominator, input versions, method version, maturity, freshness and
revision. Panels may present different views, but may not recalculate or relabel
the measurement locally. A correction invalidates every dependent projection;
selective recomputation publishes one new envelope and supersedes the old run
everywhere.

## Stepwise delivery

1. Inventory and classify existing measurement motors and consumers.
2. Deliver one transcript/audio measurement corridor with the complete envelope.
3. Implement and render the recovery ladder and recovery receipt.
4. Prove cross-panel parity for that corridor.
5. Prove correction-triggered selective recomputation and unaffected-run reuse.
6. Prove save, reopen, restart and export/import preservation.
7. Expand the same contract motor by motor to visual, scene, object, language,
   graph and comparison measurements.

## First-slice acceptance gate

For one real transcript/audio measurement, rendered and backend tests must show:

- a declared population and denominator;
- versioned inputs, method and effective parameters;
- source navigation to the contributing records;
- recovery from a deliberately missing consumer projection;
- a persisted recovery receipt when an injected rehydration attempt fails;
- the same canonical envelope in every associated panel;
- selective recomputation after a bounded correction; and
- preservation across save/reopen and export/import.

Only after this corridor passes should Stage 5 expand to the next measurement
family.
