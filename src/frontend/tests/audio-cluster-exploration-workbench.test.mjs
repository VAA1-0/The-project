import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/V2components/components/panels/AudioPanel.tsx", import.meta.url),
  "utf8",
);

test("Narrative Agent audio rows surface the overlapping transcript line", () => {
  assert.match(source, /function transcriptTextForInterval/);
  assert.match(source, /data-vaa1-audio-candidate-transcript="true"/);
  assert.match(source, /No overlapping transcript line/);
  assert.match(source, /text: transcriptTextForInterval\(transcriptRows, member\.start, member\.end\)/);
});

test("Audio owns a Master-Schema-first Narrative Agent family workbench", () => {
  assert.match(source, /data-vaa1-audio-cluster-exploration="true"/);
  assert.match(source, /Audio recognition governance · Narrative Agent family exploration/);
  assert.match(source, /Mature Data Proliferation · audio sample-cloud review/);
  assert.match(source, /data-vaa1-narrative-agent-audio-families="true"/);
  assert.match(source, /Families come from confirmed Master Schema Narrative Agents/);
  assert.match(source, /narrativeAgentAudioFamilies/);
  assert.match(source, /confirmedNarrativeAgentAnnotation/);
  assert.match(source, /user-confirmed audio seed/);
  assert.match(source, /Master Schema presence overlap/);
  assert.match(source, /voice similarity/);
  assert.match(source, /data-vaa1-narrative-agent-audio-candidate="true"/);
  assert.match(source, /Confirm as…/);
  assert.match(source, /Datascene does not invent a voice match/);
  assert.match(source, /individualNarrativeAgentLabel/);
});

test("diarization stays internal and technical speaker buckets never become analyst categories", () => {
  assert.match(source, /audioClusterExploration\(diarization, 0\.25\)/);
  assert.match(source, /cosineDistance/);
  assert.match(source, /not exposed as analyst-facing categories or confirmation targets/);
  assert.match(source, /speakerGroups/);
  assert.doesNotMatch(source, /data-vaa1-technical-diarization-provenance="true"/);
  assert.doesNotMatch(source, /Diarization bucket/);
  assert.doesNotMatch(source, /persistAudioClusterDecision/);
});

test("the workbench accounts for semantic review labour", () => {
  assert.match(source, /data-vaa1-cluster-labour-account="true"/);
  assert.match(source, /audio_diarization\.embedding_index/);
  assert.match(source, /diarization\.speaker_turns/);
});

test("semantic family review exposes quality, boundary, coverage, competition, and non-writing threshold preview", () => {
  assert.match(source, /narrativeAgentAudioFamilyReview/);
  assert.match(source, /data-vaa1-semantic-threshold-preview="true"/);
  assert.match(source, /Preview changes review membership only and never writes governed data/);
  assert.match(source, /data-vaa1-semantic-family-metrics="true"/);
  assert.match(source, /Cohesion/);
  assert.match(source, /Sample coverage/);
  assert.match(source, /Time coverage/);
  assert.match(source, /data-vaa1-nearest-competing-family="true"/);
  assert.match(source, /data-vaa1-semantic-representative="true"/);
  assert.match(source, /data-vaa1-semantic-uncertain="true"/);
  assert.match(source, /data-vaa1-semantic-exclusions="true"/);
  assert.match(source, /no voice or source-time support/);
});

test("music and silence mature automatically while Foley remains reviewable", () => {
  assert.match(source, /soundCategory === "music" \|\| soundCategory === "silence"/);
  assert.match(source, /mature · automatic measurement/);
  assert.match(source, /No confirmation required/);
  assert.match(source, /Use Foley\/sound family review/);
  assert.match(source, /Foley sampling and proliferation candidates/);
  assert.match(source, /rowType: "foley-sampling"/);
});

test("speaker and Foley confirmation use tight bounded samples without discarding constellation support", () => {
  assert.match(source, /function singleSpeakerBoundary/);
  assert.match(source, /Another diarized speaker overlaps this sample/);
  assert.match(source, /Speaker sample exceeds one safe line-sized window \(8 s\)/);
  assert.match(source, /data-vaa1-bounded-audio-sample="true"/);
  assert.match(source, /audio\.currentTime >= end/);
  assert.match(source, /audio\.pause\(\)/);
  assert.match(source, /validForConfirmation: member\.boundarySafe/);
  assert.match(source, /Adjusted sample must remain between 250 ms and 8 s/);
  assert.match(source, /Foley sample exceeds one isolated sound-bite window \(3 s\)/);
  assert.match(source, /Speech overlaps this Foley interval/);
  assert.match(source, /validForConfirmation: row\.boundarySafe/);
  assert.match(source, /data-vaa1-audio-constellation-support="true"/);
  assert.match(source, /voice similarity/);
  assert.match(source, /Master Schema presence overlap/);
  assert.match(source, /Nearest competing family/);
});

test("audio family review acknowledges saves and uses a focused assignment workspace", () => {
  assert.match(source, /optimisticAudioDecisions/);
  assert.match(source, /data-vaa1-audio-decision-receipt=/);
  assert.match(source, /Mature · \$\{target\.label\}/);
  assert.match(source, /data-vaa1-audio-family-focus-layout="true"/);
  assert.match(source, /data-vaa1-audio-family-destination-list="true"/);
  assert.match(source, /setSelectedAudioFamilyId\(family\.id\)/);
  assert.match(source, /application\/x-datascene-narrative-agent-audio-candidate/);
  assert.match(source, /data-vaa1-audio-new-character="true"/);
  assert.match(source, /New: \{newNarrativeAgentByTarget\.__audio_family_new__\.trim\(\)\}/);
  assert.match(source, /Confirm as…/);
  assert.match(source, /data-vaa1-audio-boundary-editor="true"/);
  assert.match(source, /onNavigate=\{\(\) => jumpTo/);
  assert.match(source, /voiceSimilarity \* 0\.65/);
  assert.match(source, /sample\.quality \* 0\.15/);
});

test("dropdown confirmation moves the stable sample to its saved family and retains its receipt", () => {
  assert.match(source, /lineupSampleId:\s*member\.id/);
  assert.match(source, /\[target\.lineupSampleId as string\]: destinationFamily\.id/);
  assert.match(source, /setSelectedAudioFamilyId\(destinationFamily\.id\)/);
  assert.match(source, /`\$\{destinationFamily\.id\}:\$\{target\.lineupSampleId\}`/);
  assert.match(source, /latestDecisionFor\(target\)\?\.applied_label/);
  assert.match(source, /Confirmed · \{confirmedNarrativeAgent\}/);
  assert.match(source, /value=\{confirmedNarrativeAgent\}/);
});

test("stretch and shrink boundaries hydrate from corrections and save for confirmed rows", () => {
  assert.match(source, /persisted\[sample\.id\] = \{ start, end \}/);
  assert.match(source, /setAudioBoundaryEdits\(\(current\) => \(\{ \.\.\.current, \.\.\.persisted \}\)\)/);
  assert.match(source, /const persistConfirmedBoundary/);
  assert.match(source, /onPointerUp=\{finishBoundaryPointer\}/);
  assert.match(source, /onKeyUp=\{persistConfirmedBoundary\}/);
  assert.match(source, /savedCandidateId \? \{ \.\.\.target, id: savedCandidateId \} : target/);
});

test("a durable audio save is not held open by a full analysis refresh", () => {
  const saveFlow = source.split("await VideoService.saveAnnotationCorrections", 2)[1]
    .split("setSaveMessage(", 1)[0];
  assert.doesNotMatch(saveFlow, /await VideoService\.refreshAnalysis/);
});

test("rapid markup serializes saves and confirms only after exact canonical read-back", () => {
  assert.match(source, /const audioDecisionQueue = useRef<Promise<void>>\(Promise\.resolve\(\)\)/);
  assert.match(source, /setSaveMessage\(`Saving · \$\{appliedLabel\}`\)/);
  assert.match(source, /audioDecisionQueue\.current = audioDecisionQueue\.current/);
  assert.match(source, /await VideoService\.saveAnnotationCorrections\(analysisId, nextCorrections\)/);
  assert.match(source, /await apiService\.getAnnotationCorrections\(analysisId\)/);
  assert.match(source, /canonical read-back did not contain the exact label and edited interval/);
  assert.match(source, /queueAudioDecision\([\s\S]*"agent", label\)/);
  assert.doesNotMatch(source, /if \(label\) \{ setOptimisticAudioLabels/);
  assert.doesNotMatch(source, /disabled=\{savingDecisionId !== null \|\| status === "confirmed"/);
});

test("confirmed allocations remain editable and new labels never fall back to the matcher family", () => {
  assert.match(source, /String\(saved\.identity_affirmation \|\| saved\.custom_label \|\| saved\.label \|\| ""\)\.trim\(\) === appliedLabel/);
  assert.match(source, /optimisticAudioLabels\[target\.id\] \|\| latestDecisionFor\(target\)\?\.applied_label/);
  assert.match(source, /disabled=\{!editedBoundarySafe\}/);
  assert.match(source, /savedCandidateId \? \{ \.\.\.target, id: savedCandidateId \} : target/);
  assert.doesNotMatch(source, /disabled=\{status === "confirmed" \|\| member\.directSeed/);
});

test("start and end boundary controls cannot overlap or retain pointer capture", () => {
  assert.match(source, /grid min-w-0 gap-0\.5/);
  assert.match(source, /grid-cols-\[28px_minmax\(0,1fr\)\]/);
  assert.match(source, /className="block w-full min-w-0"/);
  assert.match(source, /hasPointerCapture\(event\.pointerId\)/);
  assert.match(source, /releasePointerCapture\(event\.pointerId\)/);
  assert.match(source, /onPointerCancel=\{finishBoundaryPointer\}/);
  assert.match(source, /aria-label=\{`Start boundary/);
  assert.match(source, /aria-label=\{`End boundary/);
});
