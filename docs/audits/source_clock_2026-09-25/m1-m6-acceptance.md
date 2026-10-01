# Global clock M1–M6 acceptance record — 25 September 2026

## Outcome

The global-clock implementation and automated evidence are delivered, but Stage 1 is **not closed**. The governing handout defines M1–M6 as ordered manual gates. This run completed the bounded rendered and round-trip work available from the repository; it does not relabel missing analyst observations as passes.

| Gate | Recorded status | Evidence from this run | Remaining acceptance work |
|---|---|---|---|
| M1 — same-source agreement | Partial; automated/rendered evidence passes | Precise clock tests cover minute rollover, frame/sample conversion and a 12,500-second value. Rendered Expressions-to-Video seek passed. | Perform the three-surface Bond landmark observation at 1:11.000 and a minute boundary. No available saved source exceeds 1,000 seconds, so the required real long-recording observation remains blocked on such a source. |
| M2 — source switching | **Passed** | Scoped navigation tests pass A → B → A, delayed lookup, revision refresh, selection epochs and fail-closed unavailable media. A rendered Chromium run used two isolated sources with distinct fingerprints/revisions, delayed A by 2.5 seconds, selected and sought B at `0:30.000`, proved late A could not displace B, then reopened A. The analyst reviewed the staged evidence and confirmed the sequence as pass. | Closed. |
| M3 — save, reopen and undo | **Passed** | Isolated identity `clock-acceptance-5324d4dd643a453bb188c33657a6b227` saved a `1:11.000–1:12.250` manual Transcript interval, verified readback, close/reopen and authoritative consumer projection, survived the documented backend replacement restart, then completed guarded inverse undo. The marker left active projections, a new correction generation and append-only undo event were created, and the prior James Bond decision remained current. The analyst reviewed and confirmed the user-case sequence. | Closed. |
| M4 — invalidation boundary | **Passed** | Two isolated actual-data fixtures passed the boundary: local `1:11.000–1:12.000` change staled exactly 2 overlapping decisions and retained 159 unrelated temporal decisions; whole-source change staled 161/161 temporal decisions while retaining the non-temporal decision. Repeats were idempotent, candidate artifacts and protected originals were unchanged, and the rendered Bond/COP30/Helsinki project surface excluded Marcella and clock fixtures. The analyst confirmed M4 on 1 October 2026. | Closed. |
| M5 — full consumer matrix | **Failed analyst review; open** | The first rendered run proved clock transport across 16 wrappers, not consumer evidence response. Analyst review found missing auto-surfacing/highlighting or hydration in Transcript, Audio, Objects, Scene Cards and Meaning/Plot, and unresolved beat semantics in POS, Quant, Narrative Agent, Master Schema, Data Maturation, Search, StatsKit and Traceback. OCR and Expressions correctly had no detection at the tested beat. | Implement and rerun the consumer-response matrix; retain explicit no-hit and non-temporal states. A real >1,000-second source is also still required. |
| M6 — portable restoration | Core round trip passes; ordered manual gate remains dependent | Exported `source-clock-portable-acceptance` as a valid ZIP and imported it under separate identity `ff3b958a-3709-40ef-bf45-a08ef264a48d`. Restored media: 155.104535 s, 24 fps, 44,100 Hz. Source fingerprint `sha256:9b025baee45f793dee3b25bfb440233c8b216fef1e06cfce3951b93d6cf39c2f` and clock revision `clock-v1:090136e316575f653476b21e6baf01178e5bcd9a1b19d7e56bfe228c2d2e9e66` were retained. Semantic comparison retained correction generation `4aaa2d4b...`, one undo record and 161 manual annotations. | Recheck M1 landmarks and the full M3 analyst trace in the imported copy once those upstream manual gates are complete. |

## Verification ledger

- Frontend focused clock/correction suite: **71 passed**.
- Backend clock/correction/invalidation/decision suite: **74 passed plus 25 subtests**.
- TypeScript: passed.
- Isolated rendered word save/reopen/undo: **1 passed**.
- Rendered clock/hydration/search set: initial run **4 passed, 1 fixture-count assertion failed**. The product displayed 19 analyses after acceptance fixtures were added, while the test expected exactly 12. The assertion now accepts a populated catalogue; focused rerun: **2 passed**.
- Protected originals: all **32 output artifacts** other than the intentionally mutable catalogue match `docs/audits/source_clock_2026-09-22/baseline_manifest.json`. The catalogue changed only because isolated fixtures and the imported copy were registered.
- Runtime after documented `scripts/start_vaa1_macos.sh --replace`: backend `/api/health` healthy; frontend `/dashboard` HTTP 200.

## Artifacts and scope

- The M3 copy and the M6 imported copy are new isolated acceptance artifacts. They were retained for reproducibility.
- `/tmp/source-clock-portable-acceptance.zip` is the tested export bundle.
- The pre-existing broader frontend failures remain separate release work.
- Stage 1 may be closed only after the remaining manual observations above are attached and explicitly marked pass/fail.

## Stepwise analyst acceptance session

### M1a — No Time to Die short-source agreement

Status: **ready for analyst observation**. Use only the isolated saved-work copy `clock-acceptance-db1f40f585954e1bbd0885c52bbfdfd1` in project `source-clock-acceptance`; its displayed source label is `Clock acceptance A.mp4`, copied from No Time to Die. Do not select the original analysis.

1. Open the isolated copy and pause Video at `01:11.000`.
2. In Transcript, add or open a manual marker bounded `71.000–71.000`, then invoke its video navigation. Record the displayed bound and the Video element time.
3. In Expressions, use a manual Expressions annotation at `71.000`, then invoke its video navigation. Record the displayed time and the Video element time. The automatic sample at 71 seconds is a no-face gap and must remain explicit; it must not be presented as an automatic expression detection.
4. Compare the Transcript marker, Expressions marker and Video. Pass this landmark only if all address source second `71.000` within the 24 fps frame precision (one frame = 0.041667 seconds).
5. Repeat the display/navigation check across the minute boundary using `59.999`, `60.000` and `60.001`. Pass only if formatting rolls to `01:00.xxx`, never emits a `00:60.xxx` component, and no seconds/milliseconds scaling error appears.
6. Record the analyst name/time, actual observed values, pass/fail and any screenshot in this section before proceeding to M2.

Source facts for comparison: duration `155.104535` seconds, constant reported frame rate `24 fps`, audio sampling rate `44,100 Hz`, transcript offset `0`, fingerprint `sha256:9b025baee45f793dee3b25bfb440233c8b216fef1e06cfce3951b93d6cf39c2f`, clock revision `clock-v1:090136e316575f653476b21e6baf01178e5bcd9a1b19d7e56bfe228c2d2e9e66`.

Analyst result, 25 September 2026 at approximately 16:38 Europe/Helsinki: **fail — canonical vicinity is operational, but the clock is not globally legible across panels**.

Evidence supplied by the analyst:

- `Screenshot 2026-09-25 at 16.37.56.png`: Video is paused at `0:11.000`; its active cue is the `0:10–0:11` transcript neighborhood, and Transcript exposes the containing canonical span `0:10.000–0:11.740`. This is an operational vicinity match, not an exact point equality: Video supplies a cursor while Transcript supplies an interval.
- `Screenshot 2026-09-25 at 16.38.39.png`: the same Video cursor remains `0:11.000`, but automatic Expressions rows display raw-second labels such as `59.00s`, `60.00s` and `61.00s`. The panel does not expose the same visible cursor or the same clock notation, and it does not make absence of an expression sample at the current cursor locally obvious.
- The analyst's human judgment is that audio/transcript and expression evidence reach the operational vicinity, but the time presentation does not read as one global clock.

Interpretation: underlying source-time addressing is substantially working, but M1's human comparison criterion fails. The UI currently mixes a point cursor, interval bounds, cue shorthand and raw seconds. A human must mentally translate between these representations and cannot immediately prove that the panels share one source clock.

Required remediation before rerunning M1a:

1. Render every source time with the canonical `M:SS.mmm` display (and `H:MM:SS.mmm` when hours are present); do not render automatic Expressions as raw `59.00s` values.
2. Show the active source cursor prominently in every temporal panel, bound to the selected analysis/source fingerprint/clock revision.
3. Preserve interval bounds while separately showing whether the shared cursor is inside, before or after the interval.
4. Highlight or scroll to the active/nearest row when the cursor changes; if no evidence exists at that instant, show an explicit sampling-gap/unsupported state rather than implying a hit.
5. Keep duration and offset labels in the same clock notation. Raw seconds may remain available as secondary technical metadata, never as the primary analyst clock.

M1a must be rerun after this presentation remediation. The current evidence is valuable acceptance evidence and is not a reason to alter the underlying timestamps.

Remediation evidence, 29 September 2026 at 14:55 Europe/Helsinki: the analyst's
refreshed running view shows all three visible Source Clock browsers at
`0:00.042`, each marked `global · revision bound`. Expressions shows
`Source cursor 0:00.042 · no expression sample at cursor; nearest 0:07.000
(6.958s away)`, highlights the nearest row and renders its rows canonically.
This closes the Expressions presentation defect observed on 25 September, but
does not itself pass M1a because it uses the original Bond analysis at the
opening cursor rather than the isolated acceptance copy at 1:11.000 and the
minute-boundary probes. Transcript cursor-versus-interval presentation was then
delivered and automatically verified; it awaits the same isolated observation.

Analyst rerun, 29 September 2026 at 15:06 Europe/Helsinki: **fail — the clock
relation is correct, but active evidence did not automatically follow the
cursor**. At `1:11.000`, Transcript correctly reported that the cursor was after
the nearest authoritative interval `1:08.200–1:10.680` by `0:00.320` and
highlighted that row. The analyst nevertheless had to scroll to its vicinity.
The identified character at the cursor was highlighted in its list but was not
automatically raised into view. The analyst also observed two audible speakers
inside the single transcript interval.

Artifact inspection confirms the transcript span is assigned wholesale to
`SPEAKER_01` with diarization confidence `0.5997`; there is no measured second
speaker boundary from which Datascene can safely generate a split. Transcript
auto-follow has now been added, and low-confidence speaker boundaries below
0.65 are explicitly flagged for review rather than silently treated as a
single confirmed speaker. The character-list auto-follow and analyst-reviewed
speaker split remain open. M1a is not passed.

Analyst rerun after remediation, 29 September 2026 at 15:14 Europe/Helsinki:
**the 1:11.000 Video/Transcript landmark passes**. Project, Video and Transcript
Source Clock browsers simultaneously display `1:11.000` and remain
`global · revision bound`. Transcript automatically raises and highlights the
nearest authoritative interval `1:08.200–1:10.680`, states that the cursor is
after it by `0:00.320`, and exposes the 60% speaker-boundary warning. No evidence
was silently stretched to cover the gap. M1a remains open for the Expressions
comparison at this landmark and the `0:59.999` / `1:00.000` / `1:00.001`
boundary observation.

Analyst confirmation, 29 September 2026: **M1a passes**. The analyst confirmed
the canonical minute-boundary behavior after the accepted `1:11.000` landmark.
Video, Transcript and Expressions use the shared revision-bound cursor,
canonical rollover, explicit interval/sample gaps and automatic nearest-evidence
following. This closes the short-source portion of M1 only. M1b remains blocked
on a real source longer than 1,000 seconds and is not waived by this result.

### M1b — long-source agreement

Status: **waiting for a source longer than 1,000 seconds**. No Time to Die is 155.104535 seconds and cannot satisfy this part of the governing gate. The automated 12,500-second representation test is retained as preflight evidence, not substituted for analyst observation.

Live catalogue recheck, 29 September 2026: all 19 registered analyses returned
a canonical source-clock context. The longest real source is
`1MarcellaPhd_VSpirituality BLS S20.mp4` at `506.038875` seconds. Therefore no
registered source satisfies M1b, and the gate remains explicitly blocked rather
than being inferred from an artificial duration.

### M2 — isolated delayed source switching

Status: **passed**.

On 29 September 2026, Chromium exercised isolated A
`clock-acceptance-db1f40f585954e1bbd0885c52bbfdfd1` and isolated B
`clock-acceptance-bdf5e416bdd54be4be30454aea9f6b09`. A is 155.104535 seconds
with fingerprint `sha256:9b025b...` and revision `clock-v1:090136...`; B is
218.959456 seconds with fingerprint `sha256:97dae5...` and revision
`clock-v1:e20598...`.

The run delayed A's first clock response by 2.5 seconds, switched to B before
that response completed, verified B stayed active after the late A response,
sought B to `0:30.000` across every visible clock browser, and reopened A under
A's own revision. Chromium: **1 passed**. The new B fixture's protected source
hashes all match after the run. The original single final-state capture was
withdrawn because it did not make the sequence intelligible to the analyst.
Five staged captures now show A waiting, B bound, B surviving late A, B synced
at `0:30.000`, and A reopened; see the M2 audit record.

Analyst confirmation, 29 September 2026: the staged A → B → A sequence is
accepted as pass. M2 is closed. This does not alter M1b's independent blocked
status or pre-accept M3–M6.

### M3 — isolated interval save, restart and undo

Status: **rendered pass; analyst confirmation pending**.

User case: on isolated analysis
`clock-acceptance-5324d4dd643a453bb188c33657a6b227`, create confirmed Transcript
marker `M3 interval continuity marker` at `1:11.000–1:12.250`; verify the
canonical save; switch away and reopen; seek the shared clock to `1:11.000` and
confirm the marker is the authoritative containing interval; restart the backend
with the documented launcher; reopen with the retained guarded history; undo;
verify active projections no longer contain the marker while history retains the
inverse operation.

Rendered phases: **2 passed**. The save generation was
`51112dca-fce3-474b-b136-1ece099d9692`; undo produced generation
`7ef2093b-90cc-42e1-a237-64ff8b28c20f` and one
`restore_correction_members` event. The canonical ledger still has 180 decisions
and retains accepted decision `manual-visual:3415d5024c232f699842` at
`1:11.000–1:12.000`. Active Master Schema temporal segments contain no M3
marker; its occurrence inside `correction_undo_history` is required provenance,
not a live projection. All protected original hashes match.

Evidence: `docs/audits/source_clock_2026-09-29/m3-interval-restart-undo.md`.

Analyst confirmation, 29 September 2026: the save → reopen → restart → reopen →
guarded undo sequence is accepted as pass. **M3 is closed.**

### M4 — isolated local and whole-source invalidation

Status: **passed**.

On 1 October 2026, isolated fixture
`clock-acceptance-6a421c09dab340ddbdee2145453184e6` applied a local clock change
at `1:11.000–1:12.000`. Exactly two overlapping active accepted decisions
became stale with reason `source_clock_changed`; 159 other active temporal
decisions and one non-temporal decision remained active. Repeating the same
operation appended nothing and left the ledger byte-identical.

Separate fixture `clock-acceptance-22d4c9bdad5241b7b77f8f84debbf909`
then applied a whole-source timebase change. Exactly 161 of 161 active temporal
decisions became stale with reason `source_timebase_changed`; zero temporal
decisions remained active and the non-temporal decision remained active. Its
repeat also returned no invalidation. Candidate artifacts retained their
hashes, the other fixture remained unchanged during the global operation, and
all protected originals match.

The active-project catalogue and a focused Chromium run also verified that the
Bond/COP30/Helsinki surface contains exactly its five records and no Marcella or
clock-acceptance records. Evidence:
`docs/audits/source_clock_2026-10-01/m4-invalidation-boundary.md`.

Analyst confirmation, 1 October 2026: the local-versus-whole-source
invalidation boundary is accepted as pass. **M4 is closed.**

### M5 — full 16-surface consumer matrix

Status: **failed analyst review; open**.

On 1 October 2026, one rendered Chromium run opened all 16 named consumers on
the active Bond analysis. Each surface published its own revision-bound seek
between `1:11.000` and `1:11.015`, and Video followed. Video then published
`1:12.000`, which every surface received under the same bound source clock.
The run passed in 1.5 minutes. Thirty-four focused precision/missing-time tests,
the rendered no-media POS/Quant case and TypeScript also pass. Traceback now has
a direct Window entry and participates as a first-class surface.

The automated 12,500-second representation check passes, but no real saved
source exceeds 1,000 seconds. M5 therefore remains blocked on its physical
long-source observation rather than treating synthetic time as analyst
evidence. Evidence:
`docs/audits/source_clock_2026-10-01/m5-consumer-matrix.md`.

Correction after analyst review, 1 October 2026: the run above established
transport only. It did not establish that each consumer raised the associated
evidence on the beat. Transcript did not scroll the highlighted hit into view;
Audio did not highlight or surface a hit; Objects was empty; Scene Cards did not
raise the containing scene; Meaning/Plot did not raise the graph cursor; the
remaining semantic/aggregate panels need explicit temporal-hit versus
non-temporal semantics. **M5 is not passed.**
