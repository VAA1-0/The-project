# VAA1 Metadata Governance Handoff - 2026-05-15

## Current Goal

Continue the Source Media metadata governance work after refreshing the dev thread.

## Implemented In Current Patch

- Web metadata governance controls:
  - Drop duplicate web sources.
  - Mark web sources as main, supporting, or background.
  - Drop individual web sources.
- Web metadata scraper first pass:
  - Stores retrieval timestamp with date and time.
  - Extracts Wikipedia lead description instead of source-author noise.
  - Avoids treating "Contributors to Wikimedia projects" as a person.
  - Adds VAA1 taxonomy-oriented genre and situation candidates.
- Metadata maturity proliferation:
  - Primary metadata can be filled from mature video-internal evidence.
  - Source media panel exposes mature video-internal fill candidates.
- UI refactor:
  - Source Media metadata panel uses a more compact data-governance layout.
  - Media facts, governed inputs, character support, and curated fields are collapsible.
- Latest local additions:
  - Scraped long text fields are rendered as scrollable text blocks instead of clipped line clamps.
  - Web scrape emits `character_roles` and `production_crew` separately.
  - Frontend displays `Cast / character roles` and `Production crew` separately.

## Verification Already Run

- `conda run -n vaa1_core python -m py_compile api_server.py` passed.
- `conda run -n vaa1_core python -m unittest tests.test_source_media_metadata_contract` passed.
- `./node_modules/.bin/eslint app/V2components/components/panels/SourceMediaMetadataPanel.tsx` passed.
- `./node_modules/.bin/tsc --noEmit --project tsconfig.json` passed after the character-role typing fix.

## Backend State

The last backend restart behaved poorly in this long thread:

- A process bound to `127.0.0.1:8000`, but `/api/health` returned `000`.
- That unhealthy process was killed.
- Next thread should start the backend fresh with:

```bash
conda run -n vaa1_core uvicorn api_server:app --host 127.0.0.1 --port 8000
```

If sandbox blocks binding, run the same command with escalation.

## Manual Test To Run Next

1. Start backend and confirm:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health
```

Expected: `200`.

2. Hard refresh VAA1 browser page.
3. Open No Time To Die analysis.
4. Source Media -> Governed Evidence Inputs.
5. Retrieve Wikipedia metadata again.
6. Confirm:
   - Description / synopsis is scrollable and not clipped.
   - Cast / character roles appears, e.g. James Bond / Daniel Craig with role description where available.
   - Production crew is separate.
   - Drop duplicates works.
   - Main / Supporting / Background works.
   - Drop source works.

## Known Remaining Work

- Character-role prose should become more archive-useful, e.g.
  "James Bond / 007 (Daniel Craig): male protagonist; retired MI6 secret agent."
- Scraped character roles should feed Primary Metadata and Master Schema maturity routes deliberately.
- External metadata sources should support source preference and confirmation before overwriting curated manual fields.
- Backend startup is still too slow due heavy imports/model initialization; consider a light API boot path and lazy-load analysis stack.
