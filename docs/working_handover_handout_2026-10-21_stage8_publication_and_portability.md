# Working Handover — Stage 8 Publication and Portability

Date: 2026-10-21

Status: active; Slices 8.1–8.3 implemented, rendered analyst inspection pending.

## Stage outcome

Stage 8 turns governed analysis into a publication that another Datascene
workspace can inspect, verify and restore without access to the originating
working directory. Publication must preserve source identity, clocks, evidence,
authority, accepted/candidate/history distinctions, restrictions, versions and
checksums. A ZIP file alone is not portability.

## Bounded delivery sequence

1. **Per-video integrity and isolated restoration** — generate one representative
   Data Book, verify every declared entry, reject unsafe paths and tampering,
   enforce the project boundary, and reproduce package, video, edition, Data
   Book and report identities.
2. **Publication-time eligibility** — re-evaluate freshness, source ownership,
   maturity and claim eligibility at export time. Never publish stale or
   unaccepted claims as current truth.
3. **Epistemic-state preservation** — carry accepted, candidate, rejected,
   deferred and superseded/history states through Data Book records, reports
   and restoration.
4. **Source-chain manifest** — connect every published claim and evidential
   sentence to its canonical record, exact source interval/geometry, producer
   and revision.
5. **Representative rendered acceptance** — inspect the No Time to Die
   per-video Data Book, navigate published Nomi material to source, and verify
   readable empty/missing states.
6. **Whole-project edition** — publish the selected project without flattening
   video identities, clocks, versions or hermeneutic spaces. Declare selection
   and aggregation rules.
7. **Whole-project isolated restore** — restore into an empty location, reproduce
   the visible assertions and source chains, and reject foreign-project,
   checksum and identity mismatches.
8. **Closeout** — record automated evidence, analyst acceptance, limitations,
   rights/privacy decisions and explicit deferrals before Stage 9.

## Slice 8.1 — Per-video integrity and isolated restoration

Implemented in `src/backend/analysis/data_book_publication.py` through
`restore_video_publication`.

The restore path:

- opens the publication independently of the analysis workspace;
- rejects duplicate or traversal-capable archive paths;
- requires the canonical publication manifest, Data Book and report;
- enforces an expected project boundary;
- verifies every declared entry checksum and byte length;
- recomputes the package content identity;
- verifies edition and video identity agreement; and
- returns a governed isolated-restore receipt.

Focused acceptance covers a successful restore, foreign-project rejection and
tamper rejection. This begins Stage 8; it does not yet close publication-time
eligibility, semantic-state preservation, rendered inspection or whole-project
restoration.

## Slice 8.2 — Publication-time eligibility and epistemic-state preservation

Delivered. The Narrative Agents chapter now embeds a checksummed governed
interpretation construct when a continuity projection is available. Export
revalidates project ownership, analysis membership, saved-state checksum,
canonical revision parity, graph/snapshot revision parity and invalidation
state. Stale, foreign, incomplete or revision-divergent projections fail closed.

The construct retains the complete canonical collection, graph relation
tickets, constellational snapshot and append-only decision history. It records
relation-ticket and decision-history counts without collapsing mature,
confirmed, candidate, rejected, deferred, superseded or stale states. The
isolated restore path independently verifies the construct checksum, project
and analysis identities and the `flattened: false` invariant.

Representative real-artifact proof passed for the No Time to Die analysis:

- 17 Data Book chapters restored;
- canonical revision
  `d0c26f39d2dde579733651bdb09d8223b6505d0c829f6c06ae4329d4aa9762ed`;
- export eligibility and saved revision verified;
- relation tickets preserved as 1 confirmed, 11 mature and 8 candidate;
- decision history preserved as 6 include, 1 accepted and 5 confirmed; and
- isolated restore returned `verified` with no state flattening.

Focused publication coverage now passes five tests, including current-revision
publication, mixed epistemic states, stale-revision refusal, foreign-project
refusal and archive tamper refusal.

## Slice 8.3 — Source-chain manifest and review render

Delivered automatically. Every relation ticket is classified at publication
time. A claim enters the publishable claim list only when it has evidence, an
analysis ID authorized by the checksummed saved continuity state, and an exact
source interval. Older tickets that retained exact evidence but lacked a
materialized navigation object receive a deterministic navigation projection
from that evidence reference; the derivation is declared in the manifest.

Claims without this chain remain in the complete audit projection but are
listed as withheld and are not rendered as findings. Candidate state is never
converted to acceptance.

The Narrative Agents chapter now contains:

- `Governed Narrative Agent Interpretation.json`;
- `Interpretation Source Chain Manifest.json`; and
- `Governed Interpretation Review.md`.

Each claim records ticket/assertion/edge identity, predicate, epistemic state,
authority, analyst meaning, warrant, alternatives, evidence references, exact
source navigation, producer/schema identity and canonical revision. The
source-chain manifest has its own checksum and must exactly match the embedded
construct during isolated restoration.

The representative No Time to Die build passed with 20 source-linked claims,
zero withheld claims and the predicates `evidence_of_identity`,
`occurs_during`, `participates_in` and `dialogue_with`. The archive restored as
`verified`. Fifteen adjacent publication, continuity-export and persistence
tests pass.

Rendered and live publication acceptance passed on 22 October 2026. A stale
backend listener was identified and removed before the corrected publication
was regenerated. The resulting archive has validation state `complete`, a new
content checksum, 60 archive paths and an independently verified restore
receipt covering 59 integrity-manifest entries and all 17 chapters.

The Narrative Agents chapter no longer treats the currently selected agent as
the publication boundary. It includes both the governed Nomi interpretation
construct and a complete source-timed confirmation register containing all 144
active accepted Narrative Agent assignments currently present in the canonical
decision ledger, across 60 preserved labels. Labels are not silently merged:
apparent aliases remain visible pending an analyst-governed merge. The readable
register and JSON projection retain maturity, authority, decision identity,
evidence references and exact source intervals. Candidate interpretation
relations remain visibly candidate and are not promoted to accepted findings.

Slice 8.3 is therefore closed for the representative per-video publication.

## Immediate next slice

## Slice 8.4 — Whole-project edition and isolated restoration

Delivered and automatically accepted on 22 October 2026. Corpus publication
now rejects cross-project input and duplicate video identities, embeds every
selected analysis as an independently restorable video publication and uses
the complete governed video ID in archive paths. This repaired a discovered
collision defect in which videos sharing the same first eight ID characters
could overwrite one another.

`restore_corpus_publication` verifies safe and unique paths, every top-level
checksum and byte length, corpus content identity, project ownership, declared
video selection, nested archive integrity, browsable/nested manifest parity,
video/package/edition/content identities, and preservation of distinct source
clocks. Foreign-project, tampered and flattened packages fail closed.

The representative `bond-cop30-helsinki` project passed with six videos, six
independent editions, six source clocks and 27 corpus integrity entries. Two
consecutive live builds produced the identical archive checksum
`sha256:41f8e4a1f9417bbaa0ceedcdfa1dd35a2a9aaf6f33e40090ca103f228d12c588`.
The volatile corpus registry/integrity timestamps that initially defeated
reproducibility were bound to the governed edition time. All 33 adjacent Data
Book and continuity tests pass.

## Stage 8 closure

Manually accepted by the analyst on 22 October 2026. The downloaded corpus ZIP
opened normally outside the working repository and visibly contained the
Chapter 5 Research Report, Corpus Publication Manifest and six separate Video
Publications. Together with the verified isolated restore, deterministic repeat
build, per-video source-chain inspection and complete Narrative Agent register,
this closes the bounded Stage 8 publication and portability gate.

Stage 9 release qualification is now the forward frontier.

## Manual acceptance queue

After Slice 8.2, generate the No Time to Die video publication and inspect:

1. the readable chapter tree and validation summary;
2. Nomi identity, speaker and role claims with source return;
3. candidate interpretation labels without promotion;
4. confirmation and correction history;
5. source clock and project identity;
6. archive integrity; and
7. restore into an isolated directory.
