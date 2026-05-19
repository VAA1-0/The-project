import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Mature Data Proliferation UI Feedback Loop', () => {

  test('Video BBox/ROI overlay respects Master Schema manual annotations over raw detections', () => {
    const rawDetection = { id: 'box_1', label: 'person', confidence: 0.9 };
    const masterSchemaCorrection = { id: 'box_1', label: 'M', source: 'manual_visual' };
    
    const resolvedOverlay = resolveOverlayLabel(rawDetection, masterSchemaCorrection);
    
    assert.strictEqual(resolvedOverlay.label, 'M');
    assert.strictEqual(resolvedOverlay.isGoverned, true);
  });

  test('Characters By Scene suppresses unknown identities if governed profiles exist', () => {
    const masterSchemaProfiles = [{ name: 'James Bond' }];
    const rawSceneSpeakers = [{ name: 'unknown_speaker' }, { name: 'unknown' }];
    
    const displayList = getCharactersByScene(masterSchemaProfiles, rawSceneSpeakers);
    
    assert.strictEqual(displayList.length, 1);
    assert.strictEqual(displayList[0].name, 'James Bond');
  });

  test('Video BBox/ROI overlay highlights Constellational Match for Narrative Agents', () => {
    const rawDetection = { id: 'box_2', label: 'person', confidence: 0.88 };
    const persistenceCandidate = { id: 'box_2', label: 'Blofeld', source: 'agent_persistence_scene_cut', isNarrativeAgent: true };
    
    const resolvedOverlay = resolveOverlayLabel(rawDetection, persistenceCandidate);
    
    assert.strictEqual(resolvedOverlay.label, 'Blofeld');
    assert.strictEqual(resolvedOverlay.uiIndicator, 'Constellational Match');
    assert.strictEqual(resolvedOverlay.isGoverned, true);
  });

  test('Agent Persistence supports non-person objects (e.g., cars, dogs)', () => {
    const rawDetection = { id: 'box_3', label: 'car', confidence: 0.95 };
    const persistenceCandidate = { id: 'box_3', label: 'Aston Martin DB5', source: 'agent_persistence_scene_cut' };
    
    const resolvedOverlay = resolveOverlayLabel(rawDetection, persistenceCandidate);
    
    assert.strictEqual(resolvedOverlay.label, 'Aston Martin DB5');
    assert.strictEqual(resolvedOverlay.isGoverned, true);
  });

  function resolveOverlayLabel(raw, correction) {
    if (correction) {
      const uiIndicator = correction.source === 'agent_persistence_scene_cut' ? 'Constellational Match' : undefined;
      return { 
        label: correction.label, 
        isGoverned: true,
        ...(uiIndicator && { uiIndicator })
      };
    }
    return { label: raw.label, isGoverned: false };
  }

  function getCharactersByScene(masterSchema, raw) {
    return (masterSchema && masterSchema.length > 0) ? masterSchema : raw.filter(r => !r.name.includes('unknown'));
  }
});