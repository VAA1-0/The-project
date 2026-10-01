# Global Clock M4 invalidation boundary — 1 October 2026

## Outcome

M4 is passed. Two isolated copies
of the 155.104535-second Bond source exercised the local and whole-source
boundaries without writing to the original analysis.

| User case | Expected boundary | Actual result |
|---|---|---|
| Local change at `1:11.000–1:12.000` | Stale only active accepted decisions that overlap the interval | Exactly 2 decisions became stale. The other 159 active temporal decisions and the one non-temporal decision remained active. |
| Repeat the same local change | Do not append duplicate history | `invalidation: null`; the ledger SHA-256 remained `ea1dd7ec…`. |
| Whole-source timebase change | Stale every active temporal accepted decision | Exactly 161 of 161 active temporal decisions became stale; zero remained active. The non-temporal decision remained active. |
| Repeat the same whole-source change | Do not append duplicate history | `invalidation: null`. |
| Candidate/accepted separation | Do not promote, reject, or rewrite candidates | Both `second_order_label_proliferation.json` candidate artifacts retained their pre-run hashes (`783c7997…` local; `f1596f0b…` global). Canonical invalidations were appended only to each fixture's decision ledger. |
| Cross-source isolation | Do not touch the other fixture or the original Bond analysis | The local ledger hash did not change during the global run. All 10 protected source artifacts for each fixture still match their manifest hashes. |
| Active research-project surface | Show only Bond/COP30/Helsinki, not Marcella or acceptance fixtures | The scoped catalogue returned exactly 5 records, all with project ID `bond-cop30-helsinki`. Focused Chromium acceptance passed with five source buttons and no Marcella project. |

The local invalidation records reason code `source_clock_changed`, validity
effect `stale`, and interval scope. The whole-source event records
`source_timebase_changed`, validity effect `stale`, and `change_scope: source`.
Both retain the fixture analysis ID, source fingerprint and clock revision.

The copied ledger contained one historical decision ID derived under the
original analysis identity. On first canonical hydration, Datascene appended a
fixture-bound replacement that explicitly superseded that historical event.
The local invalidation correctly targeted the active replacement, not the
superseded record. History was retained.

`live_mature_data_proliferation_audit.json` was regenerated once when the
global fixture was first hydrated because the compact audit summary was not
embedded in its copied analysis record. This is a derived audit projection,
not the second-order candidate authority. It stabilized after hydration; the
candidate artifact itself remained byte-identical.

## Verification

- Backend source-clock, API invalidation and decision-ledger suite: **18 passed
  plus 4 subtests**.
- Rendered active-project isolation: **1 passed**.
- Backend health and proliferation route passed through the documented
  `scripts/start_vaa1_macos.sh --backend-only` startup path.
- Local fixture: `clock-acceptance-6a421c09dab340ddbdee2145453184e6`.
- Whole-source fixture: `clock-acceptance-22d4c9bdad5241b7b77f8f84debbf909`.

## Human confirmation

Confirm these two observable rules: a local clock correction affects only the
two overlapping accepted decisions, while a whole-source timebase correction
affects all 161 temporal accepted decisions. In both cases, candidate records,
unrelated sources, original evidence, and the active Bond/COP30/Helsinki
project surface remain separate.

Analyst confirmation, 1 October 2026: **M4 passes and is closed.**

## Project-surface remediation

The analyst's screenshot of the bare `/dashboard` route exposed Marcella below
the active Bond project. The ordinary dashboard now defaults to project
`bond-cop30-helsinki`; a different project requires an explicit
`activeProject=...` selection. Cross-project aggregation remains available only
through the deliberate `catalogue=...` administrative route. The bare-dashboard
Chromium check verifies five Bond/COP30/Helsinki sources and no Marcella or
clock-acceptance project data.

Two console defects raised during the same review were also closed. Traceback
evidence rows now combine tree level, provenance ID and stable row position for
React identity, so repeated provenance IDs no longer produce duplicate-key
warnings. A missing or foreign-project status summary now resolves to an
explicit bounded unavailable state on a genuine 404; non-404 service failures
remain errors. Two focused regression tests, TypeScript and the two-test
rendered project-boundary specification pass, and the rendered check fails if
either reported console message recurs.
