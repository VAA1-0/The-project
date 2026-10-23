# Bug report — Quick Sweep completes before all associated consumers surface

Date: 22 October 2026
Stage: 9.6 representative workflows
Severity: Release-blocking for full source-to-panel acceptance

## Finding

The post-runtime-fix Quick Sweep analysis
`dbd6b19c-c791-4a1f-89be-985d3cbba765` completed its pipeline at 100%, but its
`full_analysis_manifest.json` remained `partial`.

Audio event intervals, diarization, sample clouds, prosody, Objects and OCR had
declared consumer routes and parity receipts. Transcript, linked transcript,
POS and Quant artifacts hydrated but lacked verified projection/consumer parity.
Expression, shot-boundary, spatial-tone, adaptive-visual and native-statistical
artifacts were absent under the full-profile manifest.

The sine-wave fixture legitimately contains no speech. Zero evidence rows are
not themselves a defect; failure to distinguish an eligible empty result from a
missing projection is a defect.

## Design-principle impact

- Source-linked data cannot be said to surface operationally merely because the
  analysis process completed.
- The saloon-doors principle is not proven until each eligible panel both
  hydrates and returns to the same source coordinate.
- A consumer route string is not rendered navigation proof.
- Quick Sweep-disabled branches must be `not_applicable`, not reported as
  mysteriously missing full-scan artifacts.

## Required mitigation

1. Make the analysis manifest tier-aware using the normalized effective profile.
2. Mark intentionally disabled branches `not_applicable` with the effective
   setting that disabled them.
3. Treat valid empty artifacts as eligible empty results, while still requiring
   hydration and consumer-route parity.
4. Generate language parity for transcript, linked transcript, POS and Quant
   even when their governed row count is zero.
5. Add rendered reciprocal-navigation acceptance for every panel eligible under
   the source/scan combination.
6. Permit the source workflow to become `operational` only after save/reopen and
   export/restore preserve those routes.

## Current disposition

Partially mitigated. The manifest now derives requirements from the effective
scan profile, persists language parity for valid zero-row artifacts and marks
Quick Sweep-disabled branches `not_applicable`. Re-evaluation of acceptance run
`dbd6b19c-c791-4a1f-89be-985d3cbba765` reports `full`: 8 required, 8 delivered,
zero blocking branches.

Rendered reciprocal-navigation, save/reopen and export/restore proof remains
open. Therefore the artifact-to-consumer contract passes, but the complete
human-visible source-to-panel workflow is not yet accepted.
