const CORRECTION_COLLECTIONS = [
  "text_substitutions",
  "label_overrides",
  "manual_transcript_entries",
  "manual_visual_annotations",
  "proliferation_decisions",
  "master_schema_presence_intervals",
  "meaning_network_custom_lanes",
] as const;

function itemIdentity(item: any, index: number) {
  return String(
    item?.id ??
      item?.decision_id ??
      item?.lane_id ??
      item?.node_id ??
      `position:${index}`,
  );
}

function itemTime(item: any) {
  const value = Date.parse(String(item?.updated_at || item?.created_at || ""));
  return Number.isFinite(value) ? value : 0;
}

function mergeCollection(existing: any, incoming: any) {
  const prior = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  const merged = new Map<string, any>();
  prior.forEach((item, index) => merged.set(itemIdentity(item, index), item));
  next.forEach((item, index) => {
    const key = itemIdentity(item, index);
    const current = merged.get(key);
    if (!current || itemTime(item) >= itemTime(current)) merged.set(key, item);
  });
  return [...merged.values()];
}

/** Preserve independent edits made from stale browser snapshots.
 * Collection members merge by stable identity; the newest edit to the same
 * member wins. A save can therefore never erase an unrelated correction merely
 * because it was absent from that client's old snapshot.
 */
export function mergeAnnotationCorrections(existing: any, incoming: any) {
  if (!existing || typeof existing !== "object") return incoming;
  if (!incoming || typeof incoming !== "object") return existing;
  const merged = { ...existing, ...incoming };
  for (const key of CORRECTION_COLLECTIONS) {
    merged[key] = mergeCollection(existing[key], incoming[key]);
  }
  return merged;
}

