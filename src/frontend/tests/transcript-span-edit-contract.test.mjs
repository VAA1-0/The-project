import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Transcript Edit span separates source targeting from corrected timing", () => {
  const panel = read("app/V2components/components/panels/SpeechToTextPanel.tsx");
  const corrections = read("lib/annotation-corrections.ts");
  const service = read("lib/video-service.ts");

  assert.match(panel, /targetStart:\s*Number\(row\?\.sourceStart/);
  assert.match(panel, /targetStartTimestamp:\s*editorDraft\.targetStart/);
  assert.match(panel, /correctedStartTimestamp:\s*start/);
  assert.match(panel, /correctedEndTimestamp:\s*end/);
  assert.match(corrections, /corrected_start_timestamp:\s*options\?\.correctedStartTimestamp/);
  assert.match(service, /spanRule\?\.corrected_start_timestamp/);
  assert.match(service, /timingAuthority:\s*spanRule\s*\?\s*"manual_correction"/);
});

test("Transcript speaker confirmation uses governed characters and durable source roles", () => {
  const panel = read("app/V2components/components/panels/SpeechToTextPanel.tsx");
  const corrections = read("lib/annotation-corrections.ts");
  const service = read("lib/video-service.ts");

  assert.match(panel, /governedNarrativeAgentLabels\(analysisData\)/);
  for (const label of ["Announcer", "Voice-over narration", "Background noise", "Crowd"]) {
    assert.match(panel, new RegExp(`"${label}"`));
  }
  assert.match(panel, /data-vaa1-transcript-speaker-confirmation="true"/);
  assert.match(panel, /speakerConfirmation:\s*editorDraft\.speakerConfirmation/);
  assert.match(corrections, /speaker_confirmation:\s*options\?\.speakerConfirmation/);
  assert.match(service, /speaker:\s*spanRule\?\.speaker_confirmation \|\| segment\.speaker/);
  assert.match(service, /speaker:\s*entry\.speaker_confirmation \|\| "Analyst note"/);
  assert.match(
    service,
    /category:\s*"speaker_assignment"[\s\S]*maturityRoute:\s*isSourceClass[\s\S]*"canonical\.speaker\.assignment"/,
  );
  assert.match(
    service,
    /category:\s*"speaker_audio_profile_candidate"[\s\S]*requires_audio_quality_gate:\s*true[\s\S]*overlapping_diarization_turn_ids/,
  );
  assert.match(service, /proliferation_mode:\s*"reviewable_candidates_only"/);
  assert.match(service, /identity_auto_promotion_allowed:\s*false/);
});

test("source metadata persons surface as individual Narrative Agents", () => {
  const registry = read("lib/narrative-agent-registry.ts");
  const service = read("lib/video-service.ts");
  const audio = read("app/V2components/components/panels/AudioPanel.tsx");
  const video = read("app/V2components/components/panels/VideoPanel.tsx");
  const transcript = read("app/V2components/components/panels/SpeechToTextPanel.tsx");
  const meaning = read("app/V2components/components/panels/MeaningPlotPanel.tsx");

  assert.match(registry, /const knownPersons = Array\.isArray\(annotations\?\.persons\)/);
  assert.match(registry, /if \(knownPersons\.length > 0\)[\s\S]*?addValues\(labels, knownPersons\)/);
  assert.match(registry, /split\(\/\[,;\\n\]\+\/\)/);
  assert.match(service, /apiService\.getSourceMediaMetadata\(id\)/);
  assert.match(video, /eventBus\.on\("sourceMediaMetadataChanged", sourceMetadataHandler\)/);
  assert.match(transcript, /eventBus\.on\("sourceMediaMetadataChanged", sourceMetadataHandler\)/);
  assert.match(audio, /governedNarrativeAgentLabels\(analysisData\)/);
  assert.match(meaning, /metadata-person:[\s\S]*?source_media_metadata\.user_annotations\.persons/);
  assert.match(meaning, /if \(knownPersons\.length === 0\)/);
});

test("transcript saves require canonical sidecar readback before acknowledgement", () => {
  const panel = read("app/V2components/components/panels/SpeechToTextPanel.tsx");
  const api = read("lib/api-service.ts");

  assert.match(api, /const artifactUrl = localAnalysisUrl\(analysisId, "\/download\/annotation_corrections"\)/);
  assert.match(api, /method: "POST"[\s\S]*?verificationResponse[\s\S]*?cache: "no-store"/);
  assert.match(api, /verified\.updated_at !== expected\.updated_at/);
  assert.match(panel, /Saved and verified \$\{normalizedStatus\} transcript correction/);
});

test("transcript interval saves retain a guarded inverse after verified readback", () => {
  const service = read("lib/video-service.ts");
  assert.match(
    service,
    /const before = recordUndo \? await apiService\.getAnnotationCorrections\(id\) : null;[\s\S]*const saved = await apiService\.saveAnnotationCorrections\(id, corrections\);[\s\S]*correctionUndoSnapshot\(before, saved\)[\s\S]*pushCorrectionSnapshot\(id, snapshot\)/,
  );
});

test("saved manual intervals reopen as time-authoritative clock evidence", () => {
  const service = read("lib/video-service.ts");
  assert.match(
    service,
    /const manualEntries[\s\S]*timingStatus:\s*"manual_correction"[\s\S]*timingAuthority:\s*"manual_correction"[\s\S]*sourceTimeValid:\s*true/,
  );
});

test("verified correction saves invalidate stale derived projections before reopen", () => {
  const service = read("lib/video-service.ts");
  assert.match(
    service,
    /const saved = await apiService\.saveAnnotationCorrections\(id, corrections\);[\s\S]*this\.analysisCache\.delete\(id\);[\s\S]*eventBus\.emit\("analysisCorrectionsChanged"/,
  );
});

test("Speaker confirmations project into Meaning Network and Narrative Agent evidence", () => {
  const meaning = read("app/V2components/components/panels/MeaningPlotPanel.tsx");

  assert.match(meaning, /attributes\?\.(?:category|\\["category"\\]) === "speaker_assignment"/);
  assert.match(meaning, /edge_type:\s*"has_speaker_assignment"/);
  assert.match(meaning, /edge_type:\s*"spoken_by"/);
  assert.match(
    meaning,
    /normalizeAgentKey\(line\.speaker\)[\s\S]*speakerAliases\.some/,
    "confirmed transcript speakers must participate in Narrative Agent line matching",
  );
});

test("Confirmed Narrative Agent prosody reaches graphs and multimodal motors", () => {
  const service = read("lib/video-service.ts");
  const meaning = read("app/V2components/components/panels/MeaningPlotPanel.tsx");
  const master = read("app/V2components/components/panels/MasterSchemaPanel.tsx");

  assert.match(service, /function projectConfirmedSpeakersOntoProsody/);
  assert.match(service, /segment\.speakerConfirmation[\s\S]*Math\.min\(cueEnd, segmentEnd\)/);
  assert.match(service, /narrativeAgentProsody:\s*!conflict && speakerLabels\.length === 1/);
  for (const motor of [
    "master_schema",
    "meaning_network",
    "narrative_agent_graph",
    "audio_sample_cloud",
    "evidence_proliferation_matcher",
    "stats_interpretation",
    "scene_cards",
    "time_bank",
  ]) {
    assert.match(service, new RegExp(`"${motor}"`));
  }
  assert.match(service, /"narrative_agent_prosody"/);
  assert.match(meaning, /confirmed_speaker:\s*cue\.confirmedSpeaker/);
  assert.match(meaning, /edge_type:\s*"prosody_of"/);
  assert.match(master, /Governed Narrative Agent prosody/);
});
