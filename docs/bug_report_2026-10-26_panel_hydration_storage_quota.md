# Bug report — panel hydration aborted by browser-storage quota

Date: 26 October 2026  
Status: systemically mitigated; repository and rendered regression coverage added  
Initially observed surfaces: Tools / Analysis Setup and Narrative Agent continuity  
Audited surfaces: all default analytical panels, workspace layout, Project queue, Video marks and proliferation memory, POS/Quant matrices, Time Bank, morphology, Analysis Report, disclosures, taxonomy, correction history, and the local library

## Summary

The Tools panel and then the Narrative Agent panel appeared as empty, non-hydrated leaves while the Project and Video panels remained operational. Canonical analysis data and backend endpoints were available. The consumer panels failed during React effects that attempted to persist local UI preferences in `localStorage`.

Chrome raised `QuotaExceededError` for the project-scoped storage origin. The writes were not guarded. The exception escaped the effect, aborted the affected React subtree, and made a local preference-storage failure look like missing analytical data.

This violates Datascene's operational hydration and graceful-degradation principles: browser convenience storage is not canonical analytical storage and must never prevent a source-linked consumer from rendering.

## Reproduction

1. Fill or simulate exhaustion of the browser origin's `localStorage` quota.
2. Open the Bond/COP30/Helsinki workspace.
3. Open Tools / Analysis Setup. Its automatic model-default write throws and the panel is blank.
4. Open the Narrative Agent leaf with a known agent selected. Its continuity-review draft write throws and the panel is blank.
5. Observe that Project, Video, source clock, and backend analysis requests can remain healthy.

## Root cause

- Tools wrote the complete project model-selection record directly with `localStorage.setItem`.
- Narrative Agent wrote relation-ticket drafts directly with `localStorage.setItem`.
- Neither path treated quota exhaustion as an expected recoverable condition.
- Preference records were not bounded before serialization.
- Panel rendering was therefore coupled to a non-authoritative browser persistence mechanism.

The analytical source arrays, Master Schema, and Narrative Agent continuity API were not the cause. This was a consumer hydration failure at the local preference boundary.

## Mitigation delivered

- Bound and compact model-selection and continuity-review preference records.
- Guard all affected storage writes.
- Prefer persistent local storage when available.
- Fall back to tab-scoped session storage when the origin quota is full.
- Fall back to live component memory if both browser stores are unavailable.
- Keep the panel rendered and show a neutral persistence notice to the analyst.
- Read the tab-scoped fallback before an older local record during the active session.
- Preserve canonical analytical data and API hydration independently of preference persistence.
- Route all panel and shared-UI reads/writes through one quota-safe browser-storage adapter.
- Add a repository gate that rejects new raw `localStorage.setItem` calls in panels or shared UI services.
- Add a rendered full-panel-family acceptance test with every durable storage write forced to raise `QuotaExceededError`.

## Acceptance criteria

- A forced `QuotaExceededError` produces no uncaught page error.
- Tools continues to render Analysis Setup and the model/licence matrix.
- Narrative Agent continues to render its selected-agent continuity workbench and source-linked evidence.
- The analyst receives a quiet notice when a preference is session-only.
- Master Schema and backend data are neither deleted nor rewritten as part of recovery.
- Normal browsers retain project-scoped preferences in local storage.

## Regression requirement

Every panel that uses browser storage must treat it as optional. Future panel code must not call `localStorage.setItem` from a hydration or render-critical path without a quota-safe fallback. A storage failure may reduce preference durability, but it must not reduce analytical operability or hide mature data.
