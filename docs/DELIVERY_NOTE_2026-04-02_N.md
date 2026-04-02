# VAA1 Actual Upgrade Delivery

## Delivery intent
This delivery is intended to provide the actual upgraded VAA1 working stage, not only a historical snapshot and not the older `main` branch currently visible on GitHub.

The authoritative code reference for this delivery is:
- repository: `https://github.com/VAA1-0/The-project.git`
- branch: `petteri`
- base delivery commit: `3c6f548`

Important:
- GitHub `main` is behind this delivered stage
- the active upgrade path should be taken from branch `petteri`

## Primary delivery artifact
The actual runnable delivery package is:
- `vaa1_clean_delivery_bundle_2026-04-02_N.tar.gz`

This bundle should be delivered together with the notes and environment files listed below.

## Required notes and documentation
Include these files with the delivery:
- `docs/DELIVERY_NOTE_2026-04-02_N.md`
- `docs/working_handover_handout_2026-04-02_N.md`
- `docs/clean_delivery_bundle_2026-04-02_N.md`
- `SESSION_HANDOFF.md`
- `README_face_pipeline_stage.md`
- `README_vaa1_face_pipeline_colleague_bundle.md`

## Required environment files
Include these files with the delivery:
- `environment.yml`
- `environment-MacOS-face.yml`
- `requirements.txt`
- `vaa1_core.lock.yml`
- `vaa1_face.lock.yml`
- `samples/environment-MacOS.yml`

## Platform note
Environment setup differs by platform.

- `environment.yml` is Windows-oriented and includes Windows-pinned packages
- Mac setup should use `samples/environment-MacOS.yml`
- Windows CPU setup should use `environment.yml`

Do not assume that one environment file is correct for both platforms without adjustment.

## Mac setup
Run on the target Mac:

```bash
cd "/path/to/delivery"
tar -xzf vaa1_clean_delivery_bundle_2026-04-02_N.tar.gz
cd The-project
conda env create -f samples/environment-MacOS.yml
cd src/frontend
npm install
cd ../..
kill -9 $(lsof -ti tcp:8000)
conda run -n vaa1_compatible python -u api_server.py
```

Second terminal:

```bash
cd "/path/to/delivery/The-project/src/frontend"
kill -9 $(lsof -ti tcp:3000)
pkill -f "next dev"
rm -f ".next/dev/lock"
npm run dev -- --webpack
```

Open:
- `http://localhost:3000`
- `http://localhost:8000/docs`

## Windows CPU setup
Run on the target Windows machine in Anaconda Prompt or PowerShell:

```bash
cd C:\path\to\delivery
tar -xzf vaa1_clean_delivery_bundle_2026-04-02_N.tar.gz
cd The-project
conda env create -f environment.yml
cd src\frontend
npm install
cd ..\..
conda run -n vaa1_compatible python -u api_server.py
```

Second terminal:

```bash
cd C:\path\to\delivery\The-project\src\frontend
npm run dev -- --webpack
```

Open:
- `http://localhost:3000`
- `http://localhost:8000/docs`

## If the Conda environment name differs
Check the environment file and use the name defined there.

Mac:

```bash
sed -n '1,20p' samples/environment-MacOS.yml
```

Windows:

```bash
type environment.yml
```

Then replace `vaa1_compatible` in the startup command with the actual environment name from the file.

## Port conflict fixes
If backend port `8000` is already in use:

```bash
kill -9 $(lsof -ti tcp:8000)
```

If frontend port `3000` is already in use on Mac:

```bash
kill -9 $(lsof -ti tcp:3000)
pkill -f "next dev"
rm -f "/path/to/The-project/src/frontend/.next/dev/lock"
```

## What this upgraded delivery includes
- current VAA1 workspace stage beyond the older GitHub `main`
- cleaner delivery and handoff documentation
- expanded POS category delivery
- expandable grammar categories
- clickable POS word navigation
- `Case profile`
- improved `Tense profile`
- clearer separation between tense and verb-form presentation

## What still needs honest caution
- structured case and tense output depends on language-model morphology support
- Mac and Windows are separate setup targets
- Windows CPU support should be validated on an actual Windows machine before claiming full parity

## GitHub delivery rule
For GitHub publication:
- use branch `petteri` as the code reference
- use this note as the delivery instruction
- use the local bundle as the actual runnable package

Recommended practice:
- GitHub branch for traceability
- delivery bundle for runnable transfer

## Short recipient instruction
Do not use GitHub `main` as the runnable reference for this stage.

Use:
- branch `petteri`
- commit `3c6f548`
- `vaa1_clean_delivery_bundle_2026-04-02_N.tar.gz`
- the platform-appropriate environment file

## Delivery summary
This is the actual VAA1 upgrade delivery for the current stage.
It should be delivered as:
- code reference on GitHub under branch `petteri`
- runnable source bundle
- environment files
- handoff and setup notes for both Mac and Windows CPU use
