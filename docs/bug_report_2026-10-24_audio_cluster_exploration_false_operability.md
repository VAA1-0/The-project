# Bug report — Audio cluster exploration false operability

Date: 24 October 2026

## Observation

The Audio Workbench reported a small number of candidate clusters and displayed
only a best representative and a problematic/boundary sample. In the rendered
No Time To Die check, 35 measured samples collapsed into one cosine-connected
component. The two visible cards were therefore samples from one component, not
two independently reviewable clusters. Sibling samples were reduced to an
unlabelled timeline strip and had no confirmation/drop controls.

## Impact

The surface looked operational while preventing the analyst from inspecting,
comparing or governing the evidence set. It also allowed the preview threshold
to merge samples carrying different diarization speaker labels. This violated:

- operational means actual;
- every navigation is delivered within its working panel;
- human authority over clustering;
- clear candidate versus mature state; and
- labour reduction through governed batch review.

## Cause

The first UI increment treated all embedding rows as one global cosine graph.
Connected components ignored the existing diarization cluster label. The UI
then rendered only the highest- and lowest-ranked members and mistook those
diagnostic highlights for a sufficient cluster review surface.

The first mitigation iteration still treated `SPEAKER_00` and `SPEAKER_01` as
the primary confirmable families. That was semantically wrong: diarization
buckets only say that speech segments are acoustically grouped. They neither
name nor recognize a Narrative Agent.

## Mitigation delivered

- Make confirmed Master Schema Narrative Agents—not diarization labels—the
  primary exploratory audio families.
- Project all confirmed Narrative Agents even when no audio candidate exists;
  missing voice evidence remains explicit rather than silently omitting the
  family.
- Rank source-timed family candidates using confirmed audio seeds where they
  exist, measured embedding similarity, and Master Schema presence overlap.
- Remove `SPEAKER_00/01` from the analyst-facing cluster surface entirely.
  Diarization may remain an internal segmentation and matching input, but it is
  not an analytical category, family, review target or confirmation choice.
- A candidate confirmation says **Confirm Narrative Agent** and creates a
  source-timed mature Narrative Agent record. It does not confirm “speech.”
- Music and silence detections mature automatically once source-linked and
  valid; they do not charge the analyst a confirmation tax. Foley and semantic
  sound-event families such as gunshots and engines remain reviewable.

- Render source-linked candidates under semantic Narrative Agent or sound-event
  families, with source navigation and explicit candidate/mature/dropped state.
- Keep acoustic membership and Narrative Agent confirmation separate internally;
  only the semantic Narrative Agent relation is presented for analyst review.
- Filter at the consumer boundary: expression labels such as `reassuring`,
  object labels, OCR labels and scene labels remain governed Master Schema data
  and continue to hydrate their own consumers; they are not erased or recast,
  but they cannot masquerade as Narrative Agent families in Audio.
- Add a semantic-family review layer with cohesion, sample/time/review coverage,
  strongest and threshold-boundary samples, nearest competing family, explicit
  exclusions and source navigation.
- Add a non-writing semantic threshold preview. It reports candidate membership
  gains and losses without changing Master Schema data or pretending that a
  threshold commit has occurred.

## Remaining acceptance

Manual rendered verification must prove that the active artifact displays the
governed Narrative Agent and semantic sound families; sample, batch and
Narrative Agent decisions visibly
acknowledge, survive reopen and hydrate Data Maturation, Master Schema, Meaning
Knowledge Graph and Narrative Agent consumers without a second confirmation
request.

## Follow-up incidents and fixes — 28 October 2026

Manual review of **Audio recognition governance · Narrative Agent family
exploration** exposed a second class of false operability: canonical data could
be saved while the visible row, destination family or editor state continued to
look unchanged. The following incidents are part of this bug's acceptance
record.

### Source-clock warning rejected ordinary confirmations

**Symptom:** confirming an audio row could report `Source or clock revision
changed or is unavailable; reload corrections before saving`. The message did
not say whether the annotation was saved.

**Cause:** a corrections snapshot loaded while source inspection was
unavailable carried `source_fingerprint: null` and `clock_revision: null`. The
write validator treated those explicit nulls as proof of a changed binding and
rejected an otherwise ordinary, generation-guarded annotation write.

**Fix:** retain the `source_unavailable` diagnostic state while allowing null
binding fields to mean “no affirmative source identity to compare.” Correction
generation and timebase guards still apply, and a real content-bound fingerprint
or clock-revision mismatch still fails closed. Failed Audio saves now say
`Not saved — …` explicitly.

### Character reassignment did not behave like table management

**Symptom:** two James Bond-family rows intended for Felix Leiter remained
stored and displayed as James Bond after the rejected interaction.

**Fix:** add a narrow, correction-locked
`reassign_audio_narrative_agent` operation. It reads the latest canonical table
inside the lock and changes only the requested row identities and their linked
proliferation decisions, evidence labels and Master Schema presence intervals.
It does not reconstruct or overwrite the full corrections artifact. The two
affected intervals were repaired and verified as Felix Leiter:

- `00:07.820–00:08.920`;
- `00:10.000–00:11.740`.

### Dropdown confirmation saved a label but did not move or mark the row

**Symptom:** the selected destination family could light up while the sample
remained in the matcher family and still appeared as an unconfirmed candidate.

**Cause:** row state used a compound identity containing the current family.
Moving a sample from `James Bond:sample` to `Felix Leiter:sample` therefore
changed the lookup key used for the confirmation receipt. The matcher preview
also remained authoritative over the analyst's allocation.

**Fix:** use the acoustic sample ID as the stable lineup identity. After a
verified save, the analyst-selected destination immediately becomes the
authoritative family, that family opens, and the destination compound key
receives the confirmation receipt. Hydration reconstructs the same placement
from the saved manual audio anchor.

### Confirmed dropdown looked blank

**Symptom:** the row moved to the right-hand destination list, but its dropdown
returned to `Confirm as…`, hiding the actual confirmed attribute.

**Cause:** the select control was hard-coded to `value=""` after every action.

**Fix:** bind the visible select value to the persisted proliferation
decision's `applied_label`. A confirmed row now surfaces
`Confirmed · <Narrative Agent>` as the first and selected option, including
after refresh. The manual check confirmed that `00:20.600–00:23.200` was
durably stored as `Gareth Mallory / M`; only its receipt display had been
missing.

### Stretch/shrink boundaries appeared temporary

**Symptom:** adjusted start/end sliders returned to the original diarization
interval after refresh. Confirmed rows also had no usable way to persist a
later boundary correction.

**Cause:** confirmation writes already carried the edited interval, but the
rendered sliders always hydrated from the raw diarization sample.

**Fix:** hydrate slider state from confirmed manual audio annotations, making
the saved start/end interval authoritative. Pre-confirmation edits are committed
with confirmation. For a confirmed row, pointer release or keyboard adjustment
updates the existing confirmation automatically by its original saved candidate
identity; it does not create a duplicate.

### Workbench froze after several confirmations

**Symptom:** the banner remained on `Saving narrative-agent audio
confirmation…`; dropdown menus stopped opening and all rows appeared disabled.
The analyst reasonably inferred that the latest annotation was not saved.

**Cause:** the canonical sidecar commit completed, but its foreground promise
continued to await downstream projection refresh and then a full analysis
refresh. `savingDecisionId` is a global interaction lock, so slow projection
work disabled every dropdown even after the durable write existed.

**Fix:** the verified canonical commit now returns its receipt immediately.
Master Schema, matcher/maturation and other dependent projections refresh in
the background, and Audio no longer awaits a full analysis reload before
unlocking. Projection failure emits a deferred-projection event rather than
misreporting the canonical save as unfinished.

The two confirmations visible around the freeze were verified in the canonical
artifact despite the stuck UI:

- `01:19.220–01:22.900` → Ernst Stavro Blofeld;
- `01:02.860–01:04.160` → James Bond.

### Layout obstruction

**Symptom:** static source, evidence, timing and waveform blocks consumed roughly
two thirds of the panel while the actual family navigation and assignment rows
occupied the remaining third.

**Fix:** move source path, selected evidence, visual anchors, timing audit and
waveform into a collapsed-by-default **Context & diagnostics** section using the
general dynamic-panel controls. Matcher threshold and methodological notes are
also collapsible. Family navigation and sample assignment remain the primary
open workspace.

### Verification added

Focused contracts now cover:

- source-unavailable snapshots without manufactured binding conflicts;
- stable-sample reassignment and destination receipts;
- the persisted Narrative Agent as the dropdown's visible value;
- boundary hydration and post-confirmation boundary saves;
- canonical Audio saves that are not held open by a full analysis refresh; and
- continued visual/audio lineup projection behavior.

The final focused run passed 29 audio and Narrative Agent lineup tests, with
TypeScript validation passing. Earlier correction-clock and audio runs also
passed their complete focused sets. Manual reopen verification across the
downstream consumers listed in **Remaining acceptance** is still required; the
bug report must not treat contract tests alone as rendered acceptance.

### Rapid-markup follow-up

Further consecutive-row testing showed that removing the post-commit refresh
wait was insufficient. While one canonical save was in flight,
`savingDecisionId !== null` still disabled every dropdown. The first selection
could therefore work while the second and third appeared mute. This contradicts
the intended interaction model: Narrative Agent allocation is table markup and
must be as fast as ticking consecutive rows.

The Audio family workbench now:

- applies the selected destination and confirmation receipt optimistically;
- leaves unrelated row dropdowns interactive immediately;
- queues decisions in click order rather than allowing stale concurrent writes;
- rebases each queued edit on the latest canonical correction generation before
  committing; and
- keeps downstream projection refresh outside the interaction-critical path.

The resulting acceptance requirement is explicit: an analyst must be able to
confirm several consecutive rows without waiting for the preceding row's disk
write or projections. Each click must surface its row-level state immediately,
while the ordered background queue preserves durable table semantics. The
expanded focused run passed 40 audio, correction-clock and Narrative Agent
lineup tests, with TypeScript validation passing.

### Confirmations became immutable and new characters fell back to matcher labels

The `00:54.880–00:55.280` row exposed two further table-management failures.
The analyst selected `New: Police officer`, but the optimistic receipt displayed
James Bond because no Police officer family existed yet and the fallback reused
the matcher family's label. The attempted Police officer annotation was not
present in the canonical corrections artifact. Once the false James Bond state
appeared, the select was disabled for both confirmed rows and mature seeds, so
the error could not be corrected in place.

Confirmed and mature rows now retain an active Narrative Agent selector. A
revision resolves and reuses the original saved `candidate_id`, ensuring the
new choice replaces the previous allocation rather than creating a parallel
annotation. Optimistic row state stores the analyst's explicit label separately
from matcher-family state, so a new character immediately displays its own name
instead of falling back to James Bond. After persistence, normal hydration adds
the new character family and projects the stable sample into it. The focused
Audio workbench suite passes 12/12 with TypeScript validation passing.

### End-boundary control intercepted the start-boundary control

The paired Start and End range inputs were rendered in two half-width columns,
but each browser-native range retained a larger intrinsic width. The End input
therefore overflowed its cell and physically covered part of the Start input.
After dragging End, its active pointer surface continued to receive interaction
where the analyst expected to grab Start.

The controls now use two separate vertical tracks. Every label and input has a
bounded `min-width: 0`/full-width layout, so their hit areas cannot overlap.
Pointer capture is explicitly released and the range is blurred at drag end or
pointer cancellation before the confirmed boundary is queued for persistence.
Start and End also have distinct accessible labels. The focused Audio suite now
passes 13/13 with TypeScript validation passing.

### Confirmed samples do not yet support safe automatic speaker allocation

The 22 confirmed, source-linked audio samples were evaluated as voice seeds
against the stored diarization embeddings. A leave-one-out nearest-seed test
identified only 6 of 22 confirmed samples correctly (27.27%). Raw cosine scores
were frequently above 0.99 even for an incorrect character, and the winning
margin over the second candidate was usually very small. The similarity score
is therefore not a calibrated identity probability and must not trigger an
automatic confirmation or mature-data projection.

The same test produced ranked candidates for the 13 remaining turns, but these
are suitable only as analyst-facing suggestions. Acceptance for automation now
requires held-out speaker accuracy and decision thresholds to be validated on
the confirmed set. Until then, the safe workflow is to show the top candidates,
their margin and supporting samples, while keeping the final allocation in the
fast editable markup queue. Transcript context, scene adjacency and neighboring
confirmed turns may improve ranking, but must remain separately inspectable
evidence rather than silently becoming speaker identity.

### Closeout hiccups: line joins, dialogue claims and consumer proof

The completed markup exposed three acceptance gaps. Candidate rows showed
matcher support but not the actual overlapping transcript, so the analyst could
not inspect the line and identity together. Confirmed audio identities entered
the Meaning Network as nodes but were not joined to their transcript nodes, and
the network consequently could not show who participated in a dialogue. Finally,
automated projection checks did not by themselves prove that the exact label and
analyst-edited interval survived a rendered reopen in every declared consumer.

Mitigation is deliberately asymmetric. An overlapping transcript receives an
analyst-confirmed `spoken_by` relation because the speaker identity was directly
confirmed for that source interval. Consecutive, differently identified turns
within a short, shared-scene window receive only a
`dialogue_copresence_candidate` edge. Datascene does not infer `speaks_to`, an
addressee, topic or intent from temporal adjacency. The Audio row surfaces the
overlapping transcript directly, and closeout requires rendered save/reopen
inspection of Audio, Master Schema, Data Maturation, Narrative Agent and Meaning
Knowledge consumers with the saved start and end times intact.

### Optimistic confirmation could outlive a failed save

The markup row previously changed to a confirmed appearance before its queued
write completed. If the write then failed, the analyst could move on believing
that the annotation was safe. The canonical audit found 22 saved workbench
turns and 13 still unconfirmed; an optimistic screen state is not evidence that
the missing 13 were ever committed.

The save contract is now literal: selection starts the serialized write, but the
row remains unconfirmed until Datascene reads the canonical corrections back and
finds the exact annotation ID, Narrative Agent label, start time, end time and
proliferation decision. Only then does the row show confirmed. Any missing or
mismatched field returns `Not saved` and leaves the row available for retry.
The final pre-delivery audit finds **24 of 35** diarized turns in the canonical
Audio Workbench confirmation table; the remaining 11 are visibly unconfirmed,
not silently counted as saved.

The first correction still passed through a whole-bundle browser cycle, which
was semantically safe but too slow for checkbox-speed markup. The final
mitigation moves row retrieval and mutation behind one narrow backend PATCH.
Inside the correction lock the backend reads the latest canonical table,
upserts one audio identity, presence interval and proliferation decision,
atomically renames the correction file, and returns the committed row. Heavy
consumer projection is requested asynchronously after that receipt. An
idempotent live checks returned the exact label and interval with HTTP 200; the
warmed annotation-only round trip completed in **0.226 seconds**. No video bytes
or analysis artifact are part of that foreground transaction.
