# Bug report: scene and Narrative Agent lineup projection

Date: 26 October 2026  
Status: mitigated in working tree; rendered manual acceptance remains

## Observed failures

1. Scene Cards displayed coarse 24-second Master Schema windows while measured scene-detection segments were available.
2. Visual Narrative Agent exploration treated occurrence and detector-track labels as separate character families, capped the view at eight rows, and could associate a short confirmed label such as `M` through substring matching.
3. Visual candidates required an extra exploration action before appearing.
4. Audio candidates were repeated across family cards and provided confirmation controls without a direct listen/reassign workflow.
5. Visual exploration expanded frame-level person observations into 197–212 live video thumbnails. The tiles remained black while decoders competed for resources, the browser became unresponsive, and prospective matches were withheld from family rows unless they crossed the confirmation threshold.
6. Previously mature samples could not be corrected, missing Narrative Agent families could not be created, aliases could not be merged, and the unresolved queue remained a single narrow strip. Re-harvested detections from already confirmed tracks could also fall back into the unresolved queue.
7. An unconfirmed Identification BBox could be visible in Video as `Character present / Confirm Narrative Agent` while being absent from every lineup row.

## Root causes

- Scene governance preferred the Master Schema fallback before the measured motion-scene projection.
- The visual lineup consumed occurrence rows directly instead of deriving its rows from the governed Narrative Agent registry.
- Mature-memory matching used substring containment. This is unsafe for short names and initials.
- The visual family list contained an arbitrary eight-row cap.
- The audio family surface rendered every family-to-sample hypothesis rather than one best provisional placement per source sample.
- The immediate visual queue used untracked frame observations as lineup members and embedded one video decoder per item.
- Facial discrimination returned UI occurrence keys rather than stable semantic family keys, while the consumer incorrectly treated the acceptance threshold as a visibility threshold.
- The lineup harvester accepted only automated `person` detections with a detector track and explicitly rejected the `manual_visual` source used by native Identification BBoxes. Untracked occurrences were discarded as well.
- A lineup confirmation persisted its governed decision receipt, but did not also materialize the confirmed source-time/BBox occurrence in `manual_visual_annotations`; schema-native and receipt-projecting consumers could therefore hydrate at different times.

## Mitigation delivered

- Measured scene segments now take precedence and are projected into navigable Scene Cards; existing card content is inherited only when its interval overlaps.
- The visual lineup shows every governed Narrative Agent simultaneously. Technical occurrence identities remain in provenance but no longer become analyst-facing families.
- Mature visual samples use exact normalized label/alias matching, remain locked to their confirmed family, and are removed from the candidate pool.
- Visual discrimination starts automatically once per artifact/family signature; the explicit control is retained as a rescan.
- Audio samples receive one best provisional family placement, can be dragged between Narrative Agent rows, include native play/pause controls, and retain explicit confirm/drop actions. Mature audio seeds cannot be reassigned.
- Every distinct source-time/BBox observation remains reviewable as a lazy JPEG occurrence. Detector-track authority may place related occurrences on a governed row, but it does not silently discard them; only the exact already-confirmed occurrence is suppressed as a duplicate.
- Lineup families use normalized Narrative Agent labels as discrimination keys. Every measured best match is placed provisionally on its most likely row, with the score visible; only confirmation grants maturity. Candidates without a usable measured match remain unresolved.
- The lineup uses lazy, source-linked JPEG crops rather than embedded video elements. The compact 56-pixel crop can be inspected in a larger in-panel still, and `Open in video` delegates motion/context review to the video panel.
- Both a direct crop click and the enlarged still's `Open in video` action use the shared source navigator, which raises the Video panel and seeks its global clock (the saloon-doors requirement).
- Confirmed lineup decisions are now read directly from the canonical annotation-corrections ledger and merged with identity-memory visual slots. This closes the post-confirmation gap in which a saved candidate disappeared before the older identity-memory projection caught up. The decision ID, interval, authority, reassignment reason, geometry, and traceback are retained as the mature thumbnail receipt, and its candidate ID is suppressed from later rescans.
- Mature thumbnails are draggable and revisable. A correction appends a superseding receipt while retaining the earlier mature decision in history.
- Narrative Agent rows support analyst-authorized creation, title revision, and merge/alias lineage. The shared governed registry consumes these decisions so associated panels receive the same canonical family list.
- Confirmed detector-track membership outranks facial similarity when placing harvested candidates; only detections lacking confirmed-track, governed-alias, and measured-face placement remain unresolved.
- The unresolved queue uses a bounded, vertically scrollable multi-row thumbnail grid instead of a single horizontal strip.
- Unresolved crops use a modestly larger 64-pixel review size. Analysts can activate several candidates with their checkboxes and drag any active crop to move the complete selection onto one Narrative Agent row; the moved set stays active for a single batch confirmation.
- Canonically confirmed occurrences are excluded from unresolved review by stable decision identity, confirmed detector track, or a source-time plus bounding-box overlap match. This prevents confirmations without a retained detector-track key from being re-harvested as unresolved candidates.
- Legacy/manual overlay confirmations linked through `metadata_correlation.target_id` or `target_label` participate in the same authority match. Their source-time and crop are projected as mature anchors on the canonical Narrative Agent row, rather than merely creating a name elsewhere in the panel.
- Family merge decisions are pairwise (`source → target`). Mature-anchor rendering matches only the canonical governed row label; accumulated descriptive aliases and source labels remain available for discovery but cannot distribute one confirmed occurrence into unrelated Narrative Agent rows.
- Drag/drop assignments are marked as analyst-staged authority. Harvest and face-measurement requests completing in the background merge around those staged records and may not replace their destination row or clear their active selection.
- Every source-linked person occurrence now faces lineup governance: tracked detections are represented by track, untracked detections by stable source-time/BBox occurrence, and unresolved manual/native Identification BBoxes by their annotation ID. Generic labels such as `Character present` never count as governed identity.
- Lineup confirmation now atomically persists both the provenance-rich proliferation decision and a mature canonical Identification annotation with the exact source interval and normalized BBox. Existing source annotations are upgraded in place; automated candidates receive a linked governed annotation. This makes Master Schema, Video/BBox, Narrative Agent registry/graph, Meaning Knowledge, Audio, Transcript, content search, and traceback consumers converge on the same user-confirmed truth after refresh.
- Video BBox arbitration now ranks explicit named Narrative Agent authority above generic placeholders on the same track. A newer `Character present` review box can no longer mask a saved named confirmation such as Eve Moneypenny. Older canonical Identification confirmations are also projected directly into Audio, Transcript, and Meaning Knowledge alongside newer decision receipts, with source-time/BBox deduplication.
- Drag-and-drop onto a governed Narrative Agent row is itself an explicit analyst confirmation and now saves immediately; no second button confirmation is requested. The same applies when correcting an already mature occurrence by dragging it to another row. Projection selects the latest receipt per candidate, while row rendering collapses the decision receipt and materialized Master Schema annotation by source interval and BBox so one confirmed sample cannot render twice.

## Acceptance still required

- Confirm the live Scene Cards count and boundaries match the measured detector artifact.
- Verify all known Narrative Agents appear together and that confirmed `M`, `Nomi`, and `James Bond` anchors occur only in their own rows.
- Drag one unconfirmed visual candidate to another row, confirm it, reopen, and verify Master Schema proliferation.
- Play, pause, reassign, confirm, and drop separate audio candidates; then save/reopen and verify graph/panel parity.

## Follow-up: constellational proof could never mature an imperfect match

At `61.416 s`, the artifact contains a dense James Bond constellation: a source-timed visual occurrence with measured geometry, mature visual-family memory, track/cross-scene continuity, scene context, and name-bearing speech/textual evidence. The matcher nevertheless left the occurrence behind a generic `Character present` review label.

The governance evaluator imposed two separate 0.99 gates: the accumulated constellational proof had to reach 0.99 **and the individual candidate match also had to reach 0.99**. The matcher itself normally caps or moderates individual similarities, so quantitative accumulation could not compensate for any imperfect component. In addition, no producer built the typed proof envelope from the matcher's own component measurements. This made the advertised automatic mature path effectively unreachable for ordinary matcher output.

Mitigation:

- Individual match probability is retained as a traceable measurement but is no longer a second maturity threshold.
- Correlated measurements inside one channel are collapsed to their strongest value.
- Independent visual, textual, scene-context, and mature-constellation-memory channels are accumulated with a governed noisy-OR proof function.
- At least three independent channels, source time, visual geometry, project parity, and absence of mature negative conflict remain mandatory.
- A combined proof at or above 0.99 is now `mature_triangulated_evidence`, is marked proliferation-allowed without another analyst confirmation, and carries the seed Narrative Agent label rather than the raw `person` detector label.
- Human/source confirmation remains immediate 100% authority and any correction overrides the automatic result; it is no longer required to make the native deduction.

## Follow-up: set/location evidence projected as zero

The active No Time To Die analysis already contained `31` recurring environment clusters measured from `155` source frames. `VideoService` did not copy `summary.set_location_recognition` into the canonical frontend analysis envelope, so Scene Cards necessarily rendered zero.

The dedicated Source Media fields `location_country`, `location_city`, `location_place`, and `location_room` are empty in this artifact. Scene-scoped place evidence exists separately in governed Scene annotations. The mitigation therefore does not misrepresent Scene evidence as Source Media metadata:

- measured recurrence is now hydrated into Scene Cards;
- the header reports both clusters overlapping the selected scene and the artifact-wide measured total;
- Source Media proposals remain their own attributed lane;
- Scene annotation and Scene Card place proposals appear in a separate Scene evidence lane.
