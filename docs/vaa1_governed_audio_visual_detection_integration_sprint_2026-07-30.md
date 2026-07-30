# VAA1 governed audio and visual detection integration sprint

Date: 2026-07-30
Branch: `petteri`
Acceptance analysis: `0b16df1c-bc47-4b24-b90f-4d34e53c68e4`
Acceptance source: `NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264 (7).mp4`

## Sprint outcome

This sprint converted the current visual and audio detection artifacts into governed,
analyst-facing features. The work covered extraction, canonical persistence, navigable
row presentation, StatsKit projection, Data Maturation, Meaning Network participation,
Narrative Agent audio evidence, multimodal interpretation inputs, matcher inventory,
governed reporting, and reopen-safe runtime hydration.

The central delivery rule was:

> Detect once, retain source authority, and project every delivered evidence line to every
> useful consumer. Confirmation changes maturity and identity binding; it does not decide
> whether evidence is visible.

## Visual delivery

### Governed measurements

- Added adaptive visual measurement for dense, candidate-aware frame analysis.
- Added measured spatial-tone windows with brightness, contrast, saturation, dominant
  tone, and luminance entropy.
- Integrated measured shot boundaries without substituting broad scene intervals for
  shots.
- Added motion, transition, lighting, spatial, frame-class, color-regime, and related
  cue-inspector projections using the available measured or detector-derived evidence.
- Kept unavailable evidence calm and explicit. Missing measurement is not rendered as a
  measured zero.

### Visual-cue interaction

- Kept Video as the stable source viewer.
- Moved cue selection into the Tools → Visual cues workspace.
- Replaced the bottom button strip with an alphabetized top dropdown.
- Rendered cue results as governable, source-linked rows rather than a fixed set of
  widgets.
- Made the complete result array navigable instead of truncating it to an initial sample.
- Made supporting annotation disclosures and Motion and scene basis collapsed by default.
- Corrected mean scene duration derivation when governed intervals exist.
- Proliferated motion evidence into Cinematic clues as well as Cue inspectors.

## Audio delivery

### Governed event intervals

The acceptance analysis contains 42 canonical audio-event intervals:

- 15 music intervals;
- 16 noise intervals;
- 1 silence interval; and
- 10 speech intervals.

The intervals surface as governed rows in Audio Workbench and retain class, confidence,
energy/evidence, authority, and source extent. Selecting a row opens or focuses the
existing Video panel, seeks to the interval start, pauses playback, highlights the full
interval, and exposes its review record.

### Speaker-linked diarization

The acceptance analysis contains 39 measured diarization turns. They surface through the
Audio Workbench, Transcript overlap context, Master Schema, StatsKit, Data Maturation,
Meaning Network, and matcher evidence inventory.

The current diarization authority remains measured acoustic clustering with unresolved
speaker identity. A cluster label is not a Narrative Agent identity. Analyst-confirmed
Audio annotations can provide governed Narrative Agent audio anchors, but the raw turn
and its source relationship remain available for traceback.

## Data maturation and proliferation

- Added Audio annotations to the sampling queue.
- Made the audiovisual sampling lane status reflect actual sample availability.
- Converted analyst-confirmed Audio annotations into governed Narrative Agent audio
  memories and analysis-scoped meta-anchor evidence.
- Rebuilt second-order meaning and live maturation artifacts after relevant corrections.
- Made proliferation refresh the explicit recomputation boundary for multimodal,
  Meaning Network, and maturation projections.
- Added canonical audio event counts, ratios, intervals, diarization turns, and confirmed
  audio anchors to multimodal meaning-stage inputs.

## Meaning Network

The Meaning Network is now an evidence-bearing network rather than a confirmation-only
endpoint.

Every delivered line enters the network with its source reference and maturity state:

- governed audio-event intervals become `audio_event` nodes;
- diarization turns become unresolved `speaker` evidence nodes;
- confirmed agent-audio anchors become analyst-confirmed `narrative_agent` nodes;
- tracked visual detections remain visual evidence or character candidates according to
  their governed maturity; and
- transcript lines remain source-linked speaker evidence.

Scene membership is an optional governed relationship, not an admission gate. If scene
cards lack usable time bounds, evidence remains visible with
`scene_membership_status: unresolved`. It retains one-click source navigation and can be
bound to a scene later without inventing timing.

After runtime regeneration, the acceptance analysis reported:

- 224 Meaning Network nodes;
- 42/42 audio-event nodes;
- 39/39 diarization-turn nodes;
- 94 visual-detection nodes;
- 39 transcript-line nodes; and
- 217/217 time-based evidence nodes with source navigation.

## StatsKit

StatsKit now audits and calculates from the current canonical audio and visual layers.
Its source-layer deliverables include:

- adaptive visual measurements;
- spatial-tone measurements;
- measured shot-boundary intervals;
- motion and transition evidence;
- governed music/noise/silence/speech intervals;
- speaker-diarization turns; and
- audio sampling and analyst-confirmation state.

StatsKit reports the available measured population and authority rather than treating a
missing layer as zero. Audio intervals, diarization turns, visual samples, and confirmed
audio anchors remain distinct populations so descriptive statistics cannot silently
promote identity or interpretation.

## Matcher, reporting, and interpretation motors

- The matcher inventory now accepts governed temporal segments, available foundational
  source layers, adaptive visual measurements, and shot boundaries.
- Governed reporting accepts measurement evidence while preserving non-canonical report
  authority and traceback.
- Multimodal interpretation receives actual interval and turn arrays, not only cue
  counts.
- Meaning and Narrative Agent graphs consume evidence according to maturity; an
  unconfirmed line remains visible but cannot become a confirmed identity or mature
  narrative claim by projection alone.

## Verification

Focused backend verification passed:

```text
27 passed
```

The covered contracts include adaptive/spatial visual measurement, visual integration,
governed reporting, audio maturation, multimodal meaning, and Meaning Network projection.

Frontend verification passed:

- TypeScript validation with `npx tsc --noEmit`;
- 64 manual-annotation governance contract tests.

The runtime was restarted and the acceptance analysis was regenerated through the
governed proliferation refresh route. The resulting canonical counts were inspected from
the live status projection.

## Scientific and operational boundaries

- Scene intervals are not measured shots.
- Color and lighting measurements are not semantic interpretations.
- Visual change is not automatically object or camera motion.
- A diarization cluster is not a known speaker.
- A transcript overlap is not biometric identity evidence.
- Detector or model confidence cannot outrank analyst confirmation.
- Missing measurements remain unavailable, not zero.
- All automatic proliferation remains source-linked, maturity-aware, reviewable, and
  reversible.

## Remaining work

- Manually complete the remaining browser-level acceptance observations recorded in
  `docs/vaa1_visual_detection_corrective_integration_manual_acceptance_2026-07-30.md`.
- Improve governed scene timing so currently unscoped evidence can receive measured or
  confirmed scene membership.
- Continue audio sample-cloud maturation and analyst-confirmed speaker identity work
  without promoting acoustic clusters automatically.
- Extend multimodal interpretation only after its participating source layers meet their
  stated authority and coverage thresholds.
