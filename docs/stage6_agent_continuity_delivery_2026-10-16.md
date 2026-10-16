# Stage 6 — Governed Narrative Agent Continuity Delivery

Date: 2026-10-16

Status: Slices 1–5 delivered and contract-tested, including rendered
multi-agent, audio-continuity, source-navigation, and detached-panel acceptance.

## Governing corridor

James Bond is the representative continuity corridor. The corridor starts only
from independently governed, source-timed Narrative Agent confirmations. Raw
person tracks, face detections, speaker clusters, names in text, and scene
proximity may support a proposal but cannot establish identity or collection
membership.

The work remains hermetic to `bond-cop30-helsinki`. A continuity inventory that
contains more than one declared project fails closed rather than merging or
silently filtering foreign evidence.

## Slice 1 — Inventory and review proposal

Delivered in
`src/backend/analysis/narrative_agent_continuity.py`:

- inventories confirmed Narrative Agent identities and source occurrences;
- preserves every confirmed occurrence as an independently governed record;
- selects James Bond as the default representative corridor;
- surfaces precomputed recognition results only as proposed memberships;
- records tracker references only as supporting evidence;
- diagnoses one-track/multiple-agent false joins;
- diagnoses one-agent/multiple-track fragmentation;
- sends cross-scene membership to explicit boundary review;
- reports incomplete time/geometry anchors;
- produces a deterministic inventory fingerprint; and
- marks the continuity claim `not_accepted` until an analyst decision exists.

The James Bond/Nomi adjacent-confirmation case is a named contract test: two
different confirmed agents on one raw track remain two source events and open a
false-join diagnostic. They are never merged by the tracker.

## Evidence

Focused command:

```text
conda run -n vaa1_core python -m unittest \
  tests.test_narrative_agent_continuity_contract \
  tests.test_narrative_agent_recognition_array
```

Result: 7 tests passed.

Coverage includes:

- confirmed James Bond occurrences across analyses, scenes, and raw tracks;
- a review-only proposed James Bond occurrence;
- fragmentation and scene-boundary diagnostics;
- the James Bond/Nomi same-track false-join case;
- hard rejection of a mixed-project inventory;
- preservation of the prior rule that unmeasured raw tracks cannot become
  recognition; and
- preservation of the prior constellational recognition gates.

The Conda process emitted sandbox warnings while optional libraries attempted
to read CPU capabilities and write Ultralytics user settings. The test process
exited successfully; the warnings did not alter repository or project data.

## Remaining stepwise delivery

### Slice 2 — Analyst continuity decisions — delivered

Add canonical, append-only decisions for confirm, reject, defer, include,
exclude, split, merge, and undo. A decision changes collection membership, not
the member occurrence's identity, time, geometry, authority, or traceback.

Delivered in
`src/backend/analysis/narrative_agent_continuity_decisions.py`. The service:

- writes only through the canonical append-only decision ledger;
- requires explicit analyst authority and a matching project boundary;
- rejects unknown or cross-analysis occurrence membership;
- embeds an immutable occurrence snapshot for audit without changing the
  inventory record;
- supersedes prior membership decisions without deleting history;
- implements undo as a new decision and reprojects the prior effective state;
- records split and merge as governed collection-structure decisions; and
- exposes a deterministic current membership projection for downstream
  consumers.

Focused decision tests cover include/exclude precedence, immutable source
occurrences, append-only undo, split/merge history, unknown occurrences, and
foreign-project rejection.

### Slice 3 — Shared projection — delivered

Project the accepted collection through one versioned canonical envelope to
Video, Narrative Agent, Meaning/Plot, Master Schema, Data Maturation, Search,
Traceback, and eligible measurements. Every consumer must show the same member
set, revision, authority, maturity, gaps, and source navigation.

Delivered in
`src/backend/analysis/narrative_agent_continuity_projection.py` and the normal
analysis hydration path. The projection:

- requires explicit collection confirmation in addition to member decisions;
- uses one content-derived revision for all consumers;
- carries the same members, authority, maturity, gaps, source intervals,
  geometry, and traceback references to every view;
- excludes rejected and deferred occurrences from mature membership;
- blocks measurement eligibility until continuity is accepted and free from
  blocking integrity diagnostics;
- fails closed on foreign projects or missing occurrence records; and
- hydrates source-clock rows in Objects/Video, Narrative Agent, Meaning/Plot,
  Master Schema, Data Maturation, Search, Traceback, and StatsKit.

The backend status contract and frontend video-service adapter expose the same
envelope without reconstructing panel-specific continuity truth.

### Slice 4 — Persistence and invalidation — delivered

Verify correction, selective downstream invalidation, project save/reopen,
source navigation, detached-panel hydration, and export. Neither restart nor
reopen may admit foreign-project data or allow a sparse projection to outrank
the mature continuity ledger.

Delivered in
`src/backend/analysis/narrative_agent_continuity_persistence.py`, canonical
saved-analysis hydration, the analysis status response, and analysis bundle
export. The slice provides:

- atomic temporary-write, checksum validation, readback verification, and
  replace-on-success for the canonical saved state;
- a canonical state containing inventory, decision ledger, projection,
  analysis membership, project identity, and projection revision;
- a replaceable UI/export projection derived from the committed state;
- fail-closed reopen for checksum damage, project mismatch, or undeclared
  analysis membership;
- selective invalidation only when a changed occurrence belongs to the
  collection;
- `stale_retry` consumer state and measurement ineligibility after a member
  occurrence changes;
- preservation of accepted continuity when an unrelated occurrence changes;
- hydration through the normal status endpoint, which detached panels also
  use, rather than through panel-local storage; and
- inclusion of both continuity artifacts in analysis import, download, and
  bundle-export mappings.

Source navigation continues to use the shared intervals and geometry embedded
in the versioned Slice 3 consumer views.

### Slice 5 — Expansion and rendered acceptance — delivered

After the James Bond corridor passes rendered acceptance, repeat the contract
with at least one additional confirmed agent and a deliberate negative case.
Expansion is blocked if it depends on raw tracking authority or weakens project
isolation.

Delivered with Nomi as the second confirmed agent and the James Bond/Nomi
same-track case as the deliberate negative boundary:

- a multi-agent projection matrix keeps one versioned envelope per governed
  Narrative Agent corridor;
- a source occurrence cannot mature in two agent corridors;
- sharing a raw tracker reference never merges agents;
- Bond and Nomi preserve distinct members and revisions across all consumers;
- a rendered Playwright acceptance verifies Video, Audio, Narrative Agent,
  Meaning/Plot, Master Schema, Data Maturation, Search, Traceback, and
  Measurements;
- rendered source navigation advances the source clock from the selected
  occurrence; and
- a detached panel hydrates the same selected-agent revision and membership.

Audio continuity is governed by the same collection contract. Explicitly
confirmed Audio-panel anchors and transcript speaker confirmations become
independent source-timed occurrences. VAD and diarization identifiers remain
supporting references only and cannot create Narrative Agent identity or
membership. Non-agent sound sources such as Crowd, background noise, and
voice-over narration are excluded from agent corridors.

## Current claim boundary

The five planned Stage 6 slices and the operational continuity workbench are
delivered. The live API is hermetic to the selected project, while every
occurrence remains owned by exactly one analysis artifact/video and one source
clock interval.

The Narrative Agent graph now provides:

- project-wide corridor inventory over artifact-owned occurrences;
- direct source navigation for all six project videos;
- visual, audio, transcript/audio, and scene-presence confirmation at the
  global-clock beat;
- a strict separation between confirming source evidence and accepting
  continuity membership;
- include, reject, defer, collection-confirm, split, merge, and append-only undo;
- a save receipt with canonical revision and checksum; and
- one saloon-door publication event for Video, Audio, Transcript, Narrative
  Agent, Meaning/Plot, Master Schema, Data Maturation, Search, Traceback, and
  Measurements.

Collection states are indexed by Narrative Agent so accepting one corridor does
not overwrite another agent's saved state. A customer-data mutation pass remains
an analyst acceptance exercise: no synthetic decision was written into the live
Bond/COP30/Helsinki workspace during automated verification.
