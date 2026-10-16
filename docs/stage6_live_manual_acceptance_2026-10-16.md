# Stage 6 Live Manual Acceptance — Bond/COP30/Helsinki

Date: 2026-10-16

Status: Step 1 passed; Step 2 workbench launch passed read-only. The first live
analyst mutation is intentionally still pending.

## Step 1 — Runtime, project boundary, and mature-evidence inventory

### Result

Passed for runtime health, hermetic project membership, and read-only evidence
inventory.

The documented macOS launcher reported both services healthy:

- backend: `127.0.0.1:8000`;
- frontend: `127.0.0.1:3001`.

The live analysis catalogue contains exactly six records assigned to
`bond-cop30-helsinki`:

1. *No Time to Die* trailer — `81920e95-a0b2-4173-bc23-86db7909a0a9`;
2. *Diamonds Are Forever* trailer — `0c1ad551-d377-4bfd-a980-bd6936964445`;
3. Brazil long — `27450ac4-5074-4214-b56b-9204bc306e39`;
4. Brazil short — `60119099-4c43-4817-ba6f-d660f6a9cd3a`;
5. YLE/Sari Multala short source — `d745f918-79e7-46ae-aee1-8bd2a6ec5f79`;
6. Helsinki/Galaxy Song source — `836a1d87-bc0d-480e-8ded-2b1146d22f76`.

The unrelated COP30 research analyses remain assigned to their own project IDs
and did not enter this inventory.

### Representative mature visual evidence

The *No Time to Die* saved record contains many James Bond and Nomi source
occurrences. The live inventory confirmed the important continuity conflict:

- Nomi on raw track 17 at approximately `37.922–38.900`;
- James Bond on raw track 17 at approximately `38.000–40.700`;
- Nomi again on raw track 17 at approximately `41.350–42.000`.

This is the intended Stage 6 negative case: the raw track cannot establish
identity or merge the two Narrative Agents.

The same source also contains additional independently timed Bond and Nomi
confirmations on other tracks. *Diamonds Are Forever* contains confirmed James
Bond occurrences at approximately `30.530–34.034` and `55.055–55.155`.

### Audio-continuity readiness

The live saved project currently returned:

- zero explicit James Bond/Nomi Audio-panel confirmation records; and
- zero James Bond/Nomi transcript `speaker_confirmation` records.

Raw VAD, diarization, transcript text, or voice similarity must not be promoted
to fill this gap. A real analyst confirmation is required before the live audio
continuity path can be accepted.

## Step 2 — Launch continuity review workbench

Passed read-only on 2026-10-16; stopped before mutation.

The running customer application now exposes a project-scoped continuity API
and an analyst-facing workbench in the actual Narrative Agent graph panel. The
rendered live check confirmed:

- exactly six `bond-cop30-helsinki` analysis artifacts and no foreign records;
- 33 confirmed James Bond source occurrences in the read-only corridor;
- visible source-confirmation and collection-confirmation controls;
- artifact/source-clock navigation inside the continuity graph;
- visual, audio, transcript/audio, and scene-presence input routes; and
- include, reject, defer, split, merge, collection-confirm, and undo actions.

The API contract tests also confirmed that an analysis outside the selected
project fails with `403`, scene presence does not require invented BBox
geometry, audio evidence remains artifact-owned, and one continuity revision is
written to every project analysis consumer.

No continuity decision or project data was written during this manual step.

## Required next manual acceptance action

1. Add a real James Bond or Nomi Audio confirmation through the Narrative Agent
   workbench at a verified source-clock interval.
2. Include that occurrence and confirm the collection as the analyst.
3. Verify cross-panel parity,
   correction/invalidation, save/reopen, detached panels, navigation, and
   export against the live six-source project.

The mutation gate remains intentionally analyst-controlled. No automated score,
raw track, VAD label, or test fixture replaced the missing human confirmation.
