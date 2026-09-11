# No Time to Die BBox recovery — 2026-09-07

Recovered 61 missing visual annotations and one object label override from `outputs/api_results/0b16df1c-bc47-4b24-b90f-4d34e53c68e4_bundle.zip` into active analysis `8183c1fd-7cb9-49d0-b20c-378399e9c41f` using the canonical local correction POST route.

The July 29 ledger belonged to a separate saved analysis edition of the same source. Source video, tracked-object and OCR artifacts were verified byte-for-byte against active artifacts. Source video SHA-256: `9b025baee45f793dee3b25bfb440233c8b216fef1e06cfce3951b93d6cf39c2f`.

Manual annotation count increased from 99 to 160; label overrides from 12 to 13. Every pre-existing manual annotation and label override was read-back verified unchanged. Original restored IDs, geometry, time ranges and analyst timestamps were retained, with recovery provenance attached. Newer analyst corrections retain their original priority. Master Schema review-layer corrections match the live canonical ledger.

Recovered examples include “Old Aston Martini James Bonds Car” at 3.0–4.1 seconds, and later Nomi, Q, Paloma and Lyutsifer Safin records. This supersedes the August 31 incident report's claim that no saved “Old Aston” wording was found: that earlier search missed the separate `0b16df1c` edition. The May edition in `docs/NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264_7_analysis_bundle.zip` has only 19 annotations; the July edition has 64.

Three audio/transcript-linked annotations and five expression overrides were excluded: older transcript timing and expression artifacts require separate validation. No transcript timing, source media, raw detections, or other project's data was changed. No analysis recomputation was started.

Recovery snapshots, original extracted ledger, request payload, before/after API readbacks and provenance are in `backups/bond-bbox-recovery-20260907/`. This is a targeted data reconciliation, not a general import/hydration-code fix. Downloads could not be searched because macOS denied access even outside the sandbox.
