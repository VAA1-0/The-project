/** Guarded inverse of one committed transcript word correction. */
function conflict(message: string): never {
  const error = new Error(message);
  error.name = "CorrectionClockConflict";
  throw error;
}
function stable(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function row(document: any, id: string) {
  const rows = (document?.text_substitutions || []).filter((item: any) => item?.id === id);
  if (rows.length > 1) conflict('Duplicate word correction identity; inspect corrections before undo.');
  return rows[0] ?? null;
}
function sameBinding(left: any, right: any) {
  return left?.binding_status === 'content_bound' && right?.binding_status === 'content_bound' &&
    !!left.source_fingerprint && !!left.clock_revision && left.analysis_id === right.analysis_id &&
    left.source_fingerprint === right.source_fingerprint && left.clock_revision === right.clock_revision &&
    left.transcript_clock_offset_seconds === right.transcript_clock_offset_seconds;
}
export function wordUndoSnapshot(before: any, committed: any, id: string) {
  const after = row(committed, id);
  if (!after || after.modality !== 'text' || !committed?._clock_write_guard?.correction_generation) {
    conflict('Correction saved, but its undo record could not be verified. Reopen and inspect the correction.');
  }
  return JSON.parse(JSON.stringify({ ...before, _word_undo: {
    operation_id: globalThis.crypto.randomUUID(), id, before: row(before, id), after,
    binding: committed._clock_write_guard,
  } }));
}
export function prepareWordUndo(snapshot: any, current: any) {
  const operation = snapshot?._word_undo;
  if (!operation) conflict('This older history entry has no verified before/after edit. History is retained.');
  if (!sameBinding(operation.binding, current?._clock_write_guard)) conflict('Source clock changed; this undo requires review. History is retained.');
  if (!current?._clock_write_guard?.correction_generation) conflict('Reload corrections before undo.');
  return { _clock_write_guard: { ...current._clock_write_guard }, _word_undo: operation };
}
export function applyWordUndo(existing: any, incoming: any, generation: string, timestamp: string) {
  const op = incoming?._word_undo;
  if (!op || typeof op.operation_id !== 'string' || !op.operation_id || typeof op.id !== 'string' || !op.id ||
      !op.after || op.after.id !== op.id || op.after.modality !== 'text' ||
      (op.before !== null && (!op.before || op.before.id !== op.id || op.before.modality !== 'text')) ||
      !sameBinding(op.binding, incoming._clock_write_guard)) conflict('Invalid or foreign word undo operation.');
  const history = existing.correction_undo_history ?? [];
  if (!Array.isArray(history)) conflict('Undo history cannot be read; inspect saved corrections.');
  const previous = history.find((event: any) => event.operation_id === op.operation_id);
  const present = row(existing, op.id);
  if (previous) {
    if (stable(previous.operation) !== stable(op) || stable(present) !== stable(op.before)) conflict('Undo retry conflicts with a later correction.');
    return { ...existing }; // Already committed: no duplicate event or generation.
  }
  if (stable(present) !== stable(op.after)) conflict('This word correction changed after the edit; undo would overwrite it. History is retained.');
  const remaining = (existing.text_substitutions || []).filter((item: any) => item.id !== op.id);
  if (op.before !== null) remaining.push(op.before);
  return { ...existing, text_substitutions: remaining, correction_generation: generation,
    updated_at: timestamp, updated_by: 'analyst',
    correction_undo_history: [...history, { operation_id: op.operation_id, operation: op,
      action: op.before === null ? 'remove_word_correction' : 'restore_word_correction',
      based_on_generation: existing.correction_generation, resulting_generation: generation, recorded_at: timestamp }],
  };
}
export function wordUndoVerified(snapshot: any, saved: any): boolean {
  const op = snapshot?._word_undo;
  return !!op && (saved?.correction_undo_history || []).some((event: any) =>
    event.operation_id === op.operation_id && stable(event.operation) === stable(op)) &&
    stable(row(saved, op.id)) === stable(op.before);
}

const undoCollections = ['text_substitutions', 'label_overrides', 'manual_transcript_entries',
  'manual_visual_annotations', 'master_schema_presence_intervals', 'meaning_network_custom_lanes',
  'proliferation_decisions'] as const;
function correctionIdentity(item: any): string {
  const id = item?.id ?? item?.decision_id ?? item?.lane_id ?? item?.node_id;
  if (typeof id !== 'string' || !id) conflict('Correction has no stable identity; history requires review.');
  return id;
}
function correctionRows(document: any, collection: string): Map<string, any> {
  const rows = document?.[collection] ?? [];
  if (!Array.isArray(rows)) conflict('Correction collection cannot be read.');
  const map = new Map<string, any>();
  for (const item of rows) {
    const id = correctionIdentity(item);
    if (map.has(id)) conflict('Duplicate correction identity; history requires review.');
    map.set(id, item);
  }
  return map;
}

/** Record only the exact collection members changed by this successful commit. */
export function correctionUndoSnapshot(before: any, committed: any) {
  if (!sameBinding(before?._clock_write_guard, committed?._clock_write_guard)) return null;
  const changes: any[] = [];
  for (const collection of undoCollections) {
    const prior = correctionRows(before, collection), next = correctionRows(committed, collection);
    for (const id of new Set([...prior.keys(), ...next.keys()])) {
      const old = prior.get(id) ?? null, current = next.get(id) ?? null;
      if (stable(old) !== stable(current)) changes.push({ collection, id, before: old, after: current });
    }
  }
  if (!changes.length) return null;
  return JSON.parse(JSON.stringify({ _correction_undo: {
    operation_id: globalThis.crypto.randomUUID(), changes, binding: committed._clock_write_guard,
  } }));
}
export function prepareCorrectionUndo(snapshot: any, current: any) {
  if (snapshot?._word_undo) return prepareWordUndo(snapshot, current);
  const operation = snapshot?._correction_undo;
  if (!operation) conflict('This older history entry has no verified before/after edit. History is retained.');
  if (!sameBinding(operation.binding, current?._clock_write_guard) || !current?._clock_write_guard?.correction_generation) {
    conflict('Source clock changed or is unavailable; undo requires review. History is retained.');
  }
  return { _clock_write_guard: { ...current._clock_write_guard }, _correction_undo: operation };
}
export function applyCorrectionUndo(existing: any, incoming: any, generation: string, timestamp: string) {
  const op = incoming?._correction_undo;
  if (!op || typeof op.operation_id !== 'string' || !op.operation_id || !Array.isArray(op.changes) || !op.changes.length ||
      !sameBinding(op.binding, incoming._clock_write_guard)) conflict('Invalid or foreign correction undo operation.');
  const seen = new Set<string>();
  for (const change of op.changes) {
    if (!change || !undoCollections.includes(change.collection) || typeof change.id !== 'string' || !change.id ||
        seen.has(`${change.collection}:${change.id}`) || (change.before === null && change.after === null)) conflict('Invalid undo target.');
    seen.add(`${change.collection}:${change.id}`);
    for (const item of [change.before, change.after]) {
      if (item !== null && correctionIdentity(item) !== change.id) conflict('Invalid undo identity.');
    }
  }
  const history = existing.correction_undo_history ?? [];
  if (!Array.isArray(history)) conflict('Undo history cannot be read.');
  const previous = history.find((event: any) => event.operation_id === op.operation_id);
  if (previous && stable(previous.operation) !== stable(op)) conflict('Undo retry conflicts with a recorded operation.');
  for (const change of op.changes) {
    const current = correctionRows(existing, change.collection).get(change.id) ?? null;
    if (stable(current) !== stable(previous ? change.before : change.after)) conflict('A correction changed after this edit; history is retained.');
  }
  if (previous) return { ...existing };
  const saved = { ...existing };
  for (const change of op.changes) {
    const rows = correctionRows(saved, change.collection);
    if (change.before === null) rows.delete(change.id); else rows.set(change.id, change.before);
    saved[change.collection] = [...rows.values()];
  }
  return { ...saved, correction_generation: generation, updated_at: timestamp, updated_by: 'analyst',
    correction_undo_history: [...history, { operation_id: op.operation_id, operation: op,
      action: 'restore_correction_members', based_on_generation: existing.correction_generation,
      resulting_generation: generation, recorded_at: timestamp }] };
}
export function correctionUndoVerified(snapshot: any, saved: any): boolean {
  if (snapshot?._word_undo) return wordUndoVerified(snapshot, saved);
  const op = snapshot?._correction_undo;
  return !!op && (saved?.correction_undo_history ?? []).some((event: any) =>
    event.operation_id === op.operation_id && stable(event.operation) === stable(op)) &&
    op.changes.every((change: any) => stable(correctionRows(saved, change.collection).get(change.id) ?? null) === stable(change.before));
}
