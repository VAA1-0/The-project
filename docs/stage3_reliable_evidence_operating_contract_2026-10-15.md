# Stage 3 Reliable-Evidence Operating Contract

Date: 2026-10-15
Status: Governing delivery preparation; implementation remains incremental

This contract refines Stage 3 of the General Sprint Regime. It does not declare
all evidence branches delivered. A branch is operational only when its producer,
canonical artifact, versioned lineage, hydration, consumer route, invalidation,
reopen behavior and rendered use are proven together.

## Operating balance

Stage 3 makes Datascene's evidence dependable without making it brittle.
Available evidence remains inspectable even when incomplete or degraded, but its
permitted use is governed. Missing data stays missing, a fallback identifies
itself as a fallback, and a proxy never impersonates a measurement.

Automation may compute evidence freely inside the selected project and provider
policy. It may not silently change the authority of an analyst decision, identify
a speaker from a diarization turn, convert a shot into a scene, or fabricate a
measurement because an optional provider is unavailable.

The existing `vaa1.full_analysis_manifest.v1` is the one completeness register
to strengthen. Stage 3 must not introduce a second competing registry.

## S3 delivery interpretation

- **S3.1 — Canonical evidence inventory.** Register every active evidence branch
  once, with stable branch id, producer, artifact key, schema and applicable
  analysis profiles. Dormant designs do not count as active evidence.
- **S3.2 — Immutable artifact identity.** Canonical artifacts carry analysis id,
  project/source identity, checksum, schema version, creation time and artifact
  revision. Recomputed artifacts receive a new identity rather than silently
  replacing lineage.
- **S3.3 — Method and provider versions.** Record method id/version, provider and
  provider version for every computed branch. `method_version: null` cannot pass
  the Stage 3 gate for an active measured branch.
- **S3.4 — Effective settings.** Persist the settings that materially affect the
  result: model, thresholds, sampling, language, device, time windows and relevant
  feature flags. Defaults must be resolved into the run record.
- **S3.5 — Explicit capability states.** Use typed states such as available,
  degraded, disabled by policy, provider unavailable, not applicable, failed,
  stale and not computed. Empty arrays are not a substitute for capability state.
- **S3.6 — Honest fallback contracts.** A fallback names its method, limitation,
  trigger and permitted uses. It cannot inherit the authority or label of the
  unavailable primary method.
- **S3.7 — Reuse before recomputation.** Reuse an artifact only when its source,
  clock revision, method/settings, dependencies, checksum and policy remain
  compatible. Otherwise compute a new version or report why computation cannot
  proceed.
- **S3.8 — Dependency graph.** Register upstream artifact versions and downstream
  consumers. Corrections invalidate the affected branch closure, not the whole
  project and not merely the currently visible panel.
- **S3.9 — Transcript evidence.** Preserve measured/verified/manual transcript
  timing separately from quarantined chunked or recovery candidates. Text and
  timing authority remain independently inspectable. Every source-timed
  Speech-to-text span may receive an explicit Narrative Agent confirmation from
  the governed project registry or a first-time analyst-entered project-bound
  name; non-agent sources such as crowd or voice-over remain separately typed
  audio-source confirmations. A first-time confirmation becomes governed data
  only through the explicit save and canonical projection path.
- **S3.10 — VAD boundary.** Voice activity detection establishes speech/non-speech
  evidence only. It does not author transcript wording, speaker identity or scene
  boundaries. VAD intervals retain audio-sample coordinates and provider lineage.
  A source-timed VAD detection may receive an existing or first-time Narrative
  Agent name only through an explicit analyst confirmation; the saved confirmation
  is a distinct mature anchor and never a promotion of VAD confidence itself.
- **S3.11 — Diarization boundary.** Diarization produces speaker-turn candidates.
  It does not identify a Narrative Agent without analyst authority or governed
  constellational proof. Turn timing remains distinct from transcript timing.
- **S3.12 — Audio events and prosody.** Persist measured intervals/cues with
  units, coverage, missingness and source windows. Prosodic interpretation must
  remain distinguishable from the underlying acoustic measurement. Source-timed
  speech, diarization, prosody and governed audio-detection rows expose the same
  project-bound Narrative Agent confirmation path and proliferate a confirmed
  assignment without promoting an unconfirmed speaker cluster.
- **S3.13 — Audiovisual sample clouds.** Audio and visual samples become
  first-class, project-bound evidence with source intervals, crops/windows,
  embedding/provider versions, quality and consent/policy. Missing samples do not
  become synthetic anchors.
- **S3.14 — Objects, OCR and expressions.** Preserve detector substrate,
  coordinates, confidence, provider/settings and sampling coverage. Manual
  corrections project through Stage 2 authority without mutating raw evidence.
- **S3.15 — Shot boundaries.** A shot boundary is an audiovisual/editing
  measurement. Sampled transition proxies remain explicitly degraded and may not
  be reported as true shot detections.
- **S3.16 — Scene boundaries.** Scenes are governed semantic structures with
  their own producer and evidence. Transcript windows or shots may support a
  scene candidate but do not automatically become scenes.
- **S3.17 — Visual measurements.** Spatial tone, adaptive temporal measurements,
  camera/shot measures and related signals retain units, sampling denominators,
  method versions and source-frame anchors.
- **S3.18 — SFL and dependency evidence.** Persist language/model selection,
  engine state and source-token/segment alignment. Regex or blank-model fallbacks
  remain limited evidence and cannot masquerade as full linguistic parses.
- **S3.19 — Quality and missingness.** Every branch reports row/sample coverage,
  relevant quality dimensions, missing fields and operational limitations.
  Quality governs permitted use while evidence remains calmly inspectable.
- **S3.20 — Projection/hydration parity.** Canonical artifact rows, Master Schema
  projection rows, hydrated rows and the intended consumer route must agree.
  A checksum without an operational consumer is not a delivered branch.
- **S3.21 — Provider and optional-feature policy.** Select and test primary,
  fallback, disabled and unavailable behavior before activating a provider. Music,
  lyrics, acquisition, licensed and remote services remain off unless explicitly
  selected for the evidence-core use case.
- **S3.22 — Operational acceptance.** Backend contracts and rendered frontend
  tests prove compute/reuse, degraded/unavailable behavior, hydration, source
  navigation, correction invalidation, reopen and bounded repair. Schemas and
  source assertions alone are preparation, not delivery.

## Current implementation assessment

### Existing foundation

The current full-analysis manifest already registers 15 branches and provides:

- artifact paths and SHA-256 checksums;
- schema and row-count inspection;
- requested-profile applicability;
- projection, hydration and consumer-route parity;
- typed missing, degraded and repair states;
- branch-specific bounded repair entry points;
- frontend completeness navigation.

Transcript/POS/Quant, audio prosody/events/diarization/sample clouds,
objects/OCR/expressions, shot boundaries, spatial tone, adaptive visual
measurement and relational connectivity have manifest entries. This is a useful
partial foundation, not blanket Stage 3 completion.

### Gaps that block the Stage 3 gate

- Active branches currently emit `method_version: null` from the manifest.
- Effective settings and provider identity are not normalized across branches.
- VAD, scene segmentation, visual sample clouds and SFL/dependency are not
  first-class manifest branches.
- Artifact dependency versions and freshness are not uniformly represented.
- Branch quality/missingness is uneven and is not yet part of one common manifest
  contract.
- Some fallbacks are well labeled locally but lack a program-wide permitted-use
  contract.
- Save/reopen and rendered unavailable/degraded behavior are not proven for the
  complete evidence-core matrix.

## Recommended first vertical slice: speech-to-scene evidence corridor

The first bounded slice is:

```text
source audio
→ VAD intervals
→ diarization turns
→ transcript segments
→ scene candidates/accepted scenes
→ Audio, Transcript and Scene Cards hydration
```

This follows the previously documented B3 recommendation and tests the most
important Stage 3 boundaries together.

Acceptance requires:

1. canonical, checksummed artifacts for all four layers;
2. non-null method/provider versions and effective settings;
3. source-clock intervals and audio sample coordinates;
4. explicit VAD, diarization, transcript and scene authority separation, with
   Narrative Agent confirmation available from both Transcript and Audio rows;
5. matching artifact/projection/hydration counts and named consumer routes;
6. typed primary, degraded, disabled and unavailable states;
7. reuse when compatible and targeted recomputation after an overlapping
   transcript/speaker/clock correction;
8. preservation after save/reopen;
9. rendered Audio, Transcript and Scene Cards proof at the same Global Clock
   beat; and
10. no speaker identity or scene acceptance produced solely by VAD/diarization
    confidence.

Only after this slice passes should the same contract expand to the visual
evidence corridor and audiovisual sample-cloud operationalization.
