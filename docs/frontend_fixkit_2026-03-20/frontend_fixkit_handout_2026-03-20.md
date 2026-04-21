# VAA1 Frontend Fix-Kit Handout

Date: 2026-03-20
Project: VAA1
Purpose: short handout for frontend verification and Windows-side pull review

## 1. Current Launch Readiness

Local readiness was checked on the current Mac workspace.

Status:
- Frontend dependencies are installed in `src/frontend/node_modules`
- Docker is available
- Core Python runtime packages are missing from the active environment

Missing Python packages found in the active environment:
- `fastapi`
- `uvicorn`
- `cv2`
- `pandas`
- `numpy`

Practical timing estimate:
- Frontend only visible and running: about 2 to 5 minutes
- Backend + frontend together after Python env prep: about 20 to 45 minutes
- Fuller stack including Docker/CVAT pieces: about 45 to 90+ minutes

Conclusion:
- The frontend is no longer the main blocker
- The current blocker for seeing VAA1 run end-to-end on this machine is Python environment readiness

## 2. Frontend Fix-Kit Summary

The frontend work done in this pass falls into four groups:
- face-feature UI wiring
- download panel decluttering
- service-layer and request-contract updates
- TypeScript baseline repair

## 3. Files That Should Be Reviewed For Pull

High-priority feature files:
- `src/frontend/app/V2components/components/panels/ToolsPanel.tsx`
- `src/frontend/app/V2components/components/panels/DownloadPanel.tsx`
- `src/frontend/lib/api-service.ts`
- `src/frontend/lib/video-service.ts`
- `src/frontend/lib/config.ts`
- `src/frontend/lib/analysis-request.js`
- `src/frontend/tests/analysis-request.test.mjs`

High-priority TypeScript/build-health files:
- `src/frontend/package.json`
- `src/frontend/package-lock.json`
- `src/frontend/app/api/status/[id]/route.ts`
- `src/frontend/app/api/upload/route.ts`
- `src/frontend/app/page.tsx`
- `src/frontend/app/dashboard/analyze-results/[id]/page.tsx`
- `src/frontend/components/ui/calendar.tsx`
- `src/frontend/components/ui/chart.tsx`
- `src/frontend/components/ui/input-otp.tsx`

Bulk UI import-normalization files:
- multiple files under `src/frontend/components/ui/`

## 4. Feature Changes Delivered

### 4.1 Tools Panel

File:
- `src/frontend/app/V2components/components/panels/ToolsPanel.tsx`

Changes:
- added `Face anonymization` control
- added `Face message style` control
- UI label uses `Engage` while backend value remains `starfleet`
- added `Require YOLO person detection` control
- Analyze action now submits all three face-related options
- panel now shows returned face settings and backend timestamp metadata where available
- panel now shows face-frame sampling counts where available

Face-related options now covered in UI:
- `applyFaceAnonymization`
- `faceMessageStyle`
- `faceRequiresPersonDetection`

### 4.2 Download Panel

File:
- `src/frontend/app/V2components/components/panels/DownloadPanel.tsx`

Changes:
- shortened visible download labels
- reduced long path/file-name emphasis
- made panel read more like a results tray than a file browser
- simplified pending-state and unavailable-file messaging
- changed `Video ID` style wording toward `Session`

Short labels now include examples like:
- `Video`
- `Objects`
- `Summary`
- `Face Manifest`

## 5. Service-Layer Changes

### 5.1 API Service

File:
- `src/frontend/lib/api-service.ts`

Changes:
- added support for all three face options in analysis requests
- sends backend query params:
  - `apply_face_anonymization`
  - `face_message_style`
  - `face_requires_person_detection`
- added richer status metadata parsing for:
  - face settings
  - uploaded/start/completed timestamps
  - face sampling counts
- uses a shared request-parameter builder

### 5.2 Video Service

File:
- `src/frontend/lib/video-service.ts`

Changes:
- exposes returned face settings in metadata
- exposes backend timestamps in metadata
- exposes face sampling counts in metadata

### 5.3 Request Helper

Files:
- `src/frontend/lib/analysis-request.js`
- `src/frontend/tests/analysis-request.test.mjs`

Changes:
- added shared request builder for analysis query params
- added focused test coverage for:
  - safe defaults
  - all face-option params included when selected

## 6. Download Support Added

File:
- `src/frontend/lib/config.ts`

Changes:
- added support for `face_anonymization_manifest`
- included it in expected/supported downloadable file types

Result:
- anonymization outputs can now surface more cleanly through the frontend download layer

## 7. TypeScript Fixes Done

The TypeScript issue turned out to be mostly baseline frontend debt rather than a problem specific to the face-feature work.

### 7.1 Import Normalization

Area:
- many files in `src/frontend/components/ui/`

Changes:
- normalized bad version-suffixed imports such as package names written with embedded versions
- moved imports back to standard package-name form

This was the largest single source of TS failures.

### 7.2 Route and Page Fixes

Files:
- `src/frontend/app/api/status/[id]/route.ts`
- `src/frontend/app/api/upload/route.ts`
- `src/frontend/app/page.tsx`
- `src/frontend/app/dashboard/analyze-results/[id]/page.tsx`

Changes:
- fixed Next route typing/signature mismatch
- replaced `uuid` usage with `crypto.randomUUID()`
- corrected stale or missing imports in app pages

### 7.3 Component Typing / Compatibility Fixes

Files:
- `src/frontend/components/ui/calendar.tsx`
- `src/frontend/components/ui/chart.tsx`
- `src/frontend/components/ui/input-otp.tsx`

Changes:
- updated calendar wrapper for current `react-day-picker` API
- repaired a few local typing issues blocking clean typecheck

### 7.4 Dependency Alignment

Files:
- `src/frontend/package.json`
- `src/frontend/package-lock.json`

Changes:
- added missing frontend dependencies required by the existing UI layer
- upgraded `react-day-picker` to a version compatible with React 19

## 8. Verification Status

Targeted verification completed:
- request-contract test passes
- frontend TypeScript check passes cleanly

Commands used:
- `node --test src/frontend/tests/analysis-request.test.mjs`
- `./src/frontend/node_modules/.bin/tsc -p src/frontend/tsconfig.json --noEmit --pretty false`

Outcome:
- request test passed
- TypeScript check passed with exit code 0

## 9. Recommendation For Windows Frontend Review

Recommended pull priority:

Pull first:
- `ToolsPanel.tsx`
- `DownloadPanel.tsx`
- `api-service.ts`
- `video-service.ts`
- `config.ts`
- `analysis-request.js`
- `analysis-request.test.mjs`
- `package.json`
- `package-lock.json`

Review carefully before pull:
- `src/frontend/components/ui/*`
- `src/frontend/app/api/status/[id]/route.ts`
- `src/frontend/app/api/upload/route.ts`
- `src/frontend/app/page.tsx`
- `src/frontend/app/dashboard/analyze-results/[id]/page.tsx`

Reason:
- these are partly feature work and partly TypeScript/build-hygiene cleanup
- they are likely useful on Windows too, but should be checked against any local frontend branch divergence

## 10. Suggested Verification Checklist For Frontend Teammate

- Confirm new face controls render in the tools panel
- Confirm defaults still launch analysis without regression
- Confirm changed face settings are sent correctly
- Confirm YOLO person-gate option is included in requests
- Confirm timestamps and face-setting metadata display correctly when returned
- Confirm `Face Manifest` appears cleanly in downloads when generated
- Confirm download panel remains visually decluttered
- Run frontend TypeScript check
- Confirm `package.json` dependency changes install cleanly on Windows

## 11. Bottom Line

Frontend status is now much healthier:
- the face-feature slice is wired through
- the download panel is cleaner
- the request contract is tested
- TypeScript now passes cleanly

If this is pulled into the Windows frontend workspace, the main thing to verify is compatibility with any local branch differences, not whether the fix-kit itself is directionally correct.
