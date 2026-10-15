import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Transcript emits a provenance-bearing evidence focus before source navigation", () => {
  const transcript = read("app/V2components/components/panels/SpeechToTextPanel.tsx");
  assert.match(transcript, /function transcriptEvidenceId/);
  assert.match(transcript, /setSelectedTranscriptEvidenceId\(evidenceId\)/);
  assert.match(transcript, /eventBus\.emit\("transcriptEvidenceFocus", \{[\s\S]*videoId,[\s\S]*evidenceId,[\s\S]*start,[\s\S]*end,[\s\S]*source: "Transcript"[\s\S]*reviewState:/);
  assert.match(transcript, /data-vaa1-transcript-active-evidence=/);
  assert.match(transcript, /data-source-clock-nearest=/);
});

test("Video raises and retains the selected Transcript evidence interval", () => {
  const video = read("app/V2components/components/panels/VideoPanel.tsx");
  assert.match(video, /eventBus\.on\("transcriptEvidenceFocus", handler\)/);
  assert.match(video, /setFocusedTranscriptEvidence/);
  assert.match(video, /data-vaa1-focused-transcript-evidence="true"/);
  assert.match(video, /Transcript evidence · \{focusedTranscriptEvidence\.label\}/);
});

test("Stage 4 records the bounded reciprocal navigation corridor without claiming completion", () => {
  const contract = read("../../docs/stage4_inspectable_evidence_operating_contract_2026-10-15.md");
  assert.match(contract, /Delivered second vertical slice/);
  assert.match(contract, /Transcript → Video → Global Clock →\s*Transcript/);
  assert.match(contract, /Delivered third vertical slice/);
  assert.match(contract, /Audio → Video → Global Clock → Audio/);
});

test("Audio preserves analyst selection separately from the active Global Clock beat", () => {
  const audio = read("app/V2components/components/panels/AudioPanel.tsx");
  assert.match(audio, /subscribeSourceTime\(analysisId, \(time\) => setSourceClockTime\(time\)\)/);
  assert.match(audio, /eventBus\.on\("audioEvidenceFocus", handler\)/);
  assert.match(audio, /retainedFocus\?\.videoId === analysisId/);
  assert.match(audio, /data-vaa1-audio-active-evidence="true"/);
  assert.match(audio, /data-vaa1-audio-selected-row=/);
  assert.match(audio, /data-vaa1-audio-evidence-row/);
  assert.match(audio, /data-source-clock-nearest=/);
  assert.match(audio, /Selected audio evidence · \{selectedAudioEvidence\.label\}/);
});

test("Video recovers focus only for its current analysis binding", () => {
  const video = read("app/V2components/components/panels/VideoPanel.tsx");
  assert.match(video, /getLast<FocusedAudioEvidence>\("audioEvidenceFocus"\)/);
  assert.match(video, /retainedFocus\?\.videoId === videoId/);
});

test("every governed Audio row family carries durable evidence identity into navigation", () => {
  const audio = read("app/V2components/components/panels/AudioPanel.tsx");
  assert.match(audio, /const audioEvidenceRowProps =/);
  assert.match(audio, /sectionId="speech-diarization"[\s\S]*renderAudioEventRows\(categorizedEvents\.speech\)/);
  for (const sectionId of ["prosody", "music-sound", "lyrics", "foley-sampling", "recognition-governance"]) {
    const start = audio.indexOf(`sectionId="${sectionId}"`);
    assert.notEqual(start, -1, `${sectionId} section must exist`);
    const next = audio.indexOf("<DynamicPanelSection ", start + 1);
    const section = audio.slice(start, next === -1 ? undefined : next);
    assert.match(section, /FocusedAudioEvidence/, `${sectionId} must build a governed focus envelope`);
    assert.match(section, /audioEvidenceRowProps\(evidence\)/, `${sectionId} must retain selection and beat state`);
    assert.match(section, /evidenceId: evidence\.evidenceId/, `${sectionId} must navigate with stable identity`);
    assert.match(section, /reviewState: evidence\.reviewState/, `${sectionId} must preserve maturity state`);
  }
});

test("Stage 4 records closure of the Audio row-family slice", () => {
  const contract = read("../../docs/stage4_inspectable_evidence_operating_contract_2026-10-15.md");
  assert.match(contract, /Delivered fourth vertical slice/);
  assert.match(contract, /closes the Audio workbench row-family slice/);
  assert.match(contract, /combined Transcript–Audio–Video corridor now passes rendered Chromium/);
});

test("rendered acceptance covers evidence navigation, panel reopen, and source isolation", () => {
  const rendered = read("e2e/stage4-transcript-audio-video-corridor.spec.ts");
  assert.match(rendered, /data-vaa1-transcript-active-evidence/);
  assert.match(rendered, /data-vaa1-focused-transcript-evidence/);
  assert.match(rendered, /data-vaa1-audio-selected-row/);
  assert.match(rendered, /data-vaa1-focused-audio-evidence/);
  assert.match(rendered, /lm_close_tab/);
  assert.match(rendered, /sourceButtons\.nth\(1\)\.click/);
  assert.match(rendered, /data-vaa1-audio-active-evidence[\s\S]*toHaveCount\(0\)/);
});

test("Stage 4 records the passed rendered Transcript–Audio–Video corridor", () => {
  const contract = read("../../docs/stage4_inspectable_evidence_operating_contract_2026-10-15.md");
  assert.match(contract, /Delivered fifth vertical slice/);
  assert.match(contract, /passes rendered Chromium\s*acceptance/);
  assert.match(contract, /closes and reopens Audio/);
  assert.match(contract, /Switching to another analysis\s*then clears the previous Audio selection/);
});

test("Stage 4 closure records matrix, failures, detach, and BBox/ROI acceptance", () => {
  const contract = read("../../docs/stage4_inspectable_evidence_operating_contract_2026-10-15.md");
  assert.match(contract, /all sixteen named surfaces/);
  assert.match(contract, /analysis-binding-unavailable, loading, failed\s*retrieval and ready states/);
  assert.match(contract, /selected Audio evidence remains present in a detached section/);
  assert.match(contract, /BBox\/ROI passes rendered letterbox projection, move, resize, fullscreen\s*stability, normalized save and reopen/);
});
