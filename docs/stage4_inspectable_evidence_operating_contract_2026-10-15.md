# Stage 4 Inspectable-Evidence Operating Contract

Date: 2026-10-15
Status: Delivered; rendered Stage 4 acceptance passed

Stage 4 makes evidence, authority and maturation navigable without creating a
new truth store. Stage 2 remains the accepted-state authority, Stage 3 governs
evidence reliability, and Stage 4 proves that the corresponding evidence and
maturity can actually be inspected and recovered in Datascene.

## S4 delivery interpretation

- **S4.1 — Permanent panel binding.** Every analysis panel retains or recovers
  its project-bound analysis/file id after late opening, refresh and restoration.
- **S4.2 — Independent hydration.** Registered evidence remains inspectable when
  the video blob or another optional consumer is unavailable.
- **S4.3 — Typed panel states.** Loading, empty, missing, unsupported, stale,
  failed and analysis-binding-unavailable remain distinct.
- **S4.4 — Stale response rejection.** Superseded selection generations cannot
  overwrite the current analysis.
- **S4.5 — Leaf-state preservation.** Selection, filters, expansion, pagination
  and reasonable scroll context survive source navigation.
- **S4.6 — Evidence-to-source navigation.** A leaf opens the correct Global
  Clock interval and source evidence.
- **S4.7 — Source-to-evidence navigation.** Video selection recovers the
  associated leaf record.
- **S4.8 — Loop prevention.** Reciprocal navigation does not create seek loops,
  duplicate leaves or unsolicited focus transfer.
- **S4.9 — Global Clock concordance.** Applicable Video and analysis panels raise
  the same beat automatically under the saloon-doors principle.
- **S4.10 — Local correction workflow.** Review and correction stay in Datascene
  and preserve the working environment.
- **S4.11 — Mature correction propagation.** One canonical confirmation reaches
  all applicable consumers without a second confirmation tax.
- **S4.12 — Constellational maturity inspection.** Data Maturation exposes the
  supporting visual, audio, transcript, movement, scene and confirmed-anchor
  evidence, including missing, duplicated and contradictory evidence.
- **S4.13 — Explicit maturity states.** Raw, candidate, supported, automatically
  eligible, analyst confirmed, mature, rejected, stale and superseded remain
  visibly distinct.
- **S4.14 — Governed 99% route.** Automatic maturity requires calibrated 99%
  proof, at least three independent modalities, source-time anchoring, project
  agreement, required visual geometry and no unresolved conflict. Detector,
  VAD, diarization or tracking confidence alone never qualifies.
- **S4.15 — Proliferation preview.** Data Maturation names the seed, candidates,
  scope, targets, conflicts, invalidations and reversibility before broad use.
- **S4.16 — Rendered proliferation parity.** Video/BBox, Transcript, Audio,
  Objects, Master Schema, Narrative Agent, Meaning/Plot, Scene Cards, StatsKit,
  Search and Traceback show the same canonical maturity and revision where
  applicable.
- **S4.17 — Traceback navigation.** A claim navigates through decision, evidence,
  coordinates, interval, method and provider to source.
- **S4.18 — Actionable quality review.** Quality and missingness lead to affected
  evidence and bounded repair rather than an empty destination.
- **S4.19 — BBox/ROI rendered inspection.** Selection, geometry, timing, mature
  labels, save, reopen and reciprocal navigation pass rendered acceptance.
- **S4.20 — Missing-media and detached-panel resilience.** Evidence remains
  inspectable and bound in missing-video and detached-window conditions.
- **S4.21 — Conservative Save and Refresh.** Save checkpoints without remounting;
  Refresh recovers binding and retrieves mature data without losing local state.
- **S4.22 — Consumer-matrix acceptance.** Rendered tests cover load/reopen,
  bidirectional navigation, correction, failure states, project isolation and
  restart. Manual acceptance is reserved for gestures automation cannot prove.

## Delivered first vertical slice

The shared event boundary now retains and replays validated active-analysis
context to late subscribers. Global panel navigation also listens to the live
Video context, requests it when absent, and resolves it again before Refresh.
Until recovered, the panel frame says `Analysis binding unavailable`; it does
not present missing identity as empty analytical data.

Data Maturation now renders the active constellational maturity rule. This is a
visible statement of the already tested backend gate, not a new confidence-only
authority route.

## Delivered second vertical slice

Transcript evidence navigation now carries a stable evidence id, authoritative
source interval, label, origin and review state into Video. Transcript keeps the
analyst-selected leaf visibly distinct from the nearest Global Clock row, so a
seek can raise the current beat without erasing working selection. Video raises
the same selected transcript interval in a closable evidence card, while the
existing source-clock ticket and duplicate suppression continue to prevent
reciprocal seek loops.

This proves the first bounded `Transcript → Video → Global Clock →
Transcript` corridor.

## Delivered third vertical slice

Audio now retains the analyst-selected governed sound interval or speaker turn
independently from the current Global Clock beat. Selected evidence is shown in
a persistent Audio card and highlighted in its source row; the current beat is
raised separately. The evidence envelope is recovered safely after a late panel
mount only when its analysis id matches the active Audio or Video binding, so a
previous project cannot reactivate stale focus.

Together with Video's governed audio evidence card and source-clock loop
suppression, this proves the bounded `Audio → Video → Global Clock → Audio`
corridor for governed sound intervals and diarization turns.

## Delivered fourth vertical slice

The same stable selection and clock-beat contract now covers speech/VAD,
prosody, music and sound classification, lyric/transcript matches, Foley
candidates and recognition-governance rows. Every source-opening action carries
a stable or deterministically derived evidence id, interval, label, source,
detail and review state. These rows therefore recover the same Audio and Video
evidence card instead of degrading into an anonymous seek.

This closes the Audio workbench row-family slice. Waveform windows remain a
compact navigation visualization rather than governed evidence rows; promoting
one must continue through its underlying measured interval or sample record.

## Delivered fifth vertical slice

The combined Transcript–Audio–Video corridor now passes rendered Chromium
acceptance against the project-owned CNN analysis. The protocol selects timed
Transcript evidence at `0:03.780`, verifies its durable selection and Video
evidence card, selects a governed Audio interval, verifies the corresponding
Audio and Video state, closes and reopens Audio, and confirms that both its
evidence card and source-row selection recover. Switching to another analysis
then clears the previous Audio selection, proving source isolation.

The test intentionally selects data through the active Project panel rather
than injecting an analysis id. An initial stale Bond fixture was correctly
rejected by project-boundary governance and was removed from this protocol.
The broader acceptance gates were completed in the sixth slice below.

## Delivered sixth vertical slice — Stage 4 closure

The final rendered gates passed against the project-owned COP30 workspace:

- all sixteen named surfaces share one revision-bound bidirectional Global
  Clock and navigate the selected source without contradictory cursor state;
- Audio visibly distinguishes analysis-binding-unavailable, loading, failed
  retrieval and ready states, and recovers after the injected outage is removed
  and the workspace restarts;
- selected Audio evidence remains present in a detached section, returns to its
  host after the popup closes, survives panel close/reopen, and is cleared on
  source switch; StatsKit independently passes reorder, fill, detach and return;
- BBox/ROI passes rendered letterbox projection, move, resize, fullscreen
  stability, normalized save and reopen; the production Video overlay exposes
  the same rendered-overlay contract for browser inspection; and
- the active Project panel, rather than a foreign analysis id, remains the sole
  entry into every rendered protocol.

Stage 4 is delivered. The tests use browser popups as the automatable detached-
window boundary; final physical multi-monitor placement remains a hardware
gesture rather than a software delivery gap.
