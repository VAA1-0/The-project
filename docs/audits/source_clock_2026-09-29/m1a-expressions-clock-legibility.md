# M1a Expressions clock-legibility increment — 29 September 2026

## Outcome

Delivered the Expressions-specific remediation identified by the failed M1a
analyst observation. The panel now presents the active revision-bound source
cursor in canonical `M:SS.mmm`/`H:MM:SS.mmm` form, distinguishes a sample at the
cursor from a sampling gap, names the nearest sample and distance for a gap, and
highlights that nearest row.

This is not an M1 pass. It does not change source timestamps, make an absent
sample into evidence, complete Transcript interval/cursor presentation, provide
the required source longer than 1,000 seconds, or substitute automation for the
isolated analyst rerun.

## Verification

- `node --test tests/expression-source-clock-cursor.test.mjs tests/source-clock-values.test.mjs tests/source-clock-events.test.mjs`: 31 passed.
- `npx tsc --noEmit`: passed.
- No saved analysis, correction ledger or source-media artifact was written.

## Next bounded step

Rerun M1a on the existing isolated acceptance copy. If Expressions is legible but
the Transcript cursor-versus-interval relationship still fails the human test,
deliver only that presentation gap before proceeding to M2. M1b remains blocked
until an explicitly isolated real source longer than 1,000 seconds is available.
