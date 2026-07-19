import attributeRegistry from "../../../docs/inventory/attribute_registry.json";
import coverageMatrix from "../../../docs/inventory/design_attribute_coverage_matrix.json";
import remainingProfiles from "../../../docs/inventory/domain_atomic_profiles_remaining_17.json";
import narrativeProfiles from "../../../docs/inventory/narrative_interpretive_atomic_profiles.json";
import statsProfile from "../../../docs/inventory/stats_interpretation_profile.json";

export type EmpiricalTaxonomyAttribute = {
  attributeId: string;
  attributeLabel: string;
  categoryId: string;
  categoryLabel: string;
  categoryStatus: string;
  attributeStatus: string;
  theme: string;
  knownPaths: string[];
  description: string;
};

type CoverageCategory = { category_id: string; status: string; actual_surfaces?: string[]; scientific_gap?: string };
type ProfileAttribute = { attribute_id: string; definition?: string; inventory_categories?: string[]; implementation_status?: string };
type DomainProfile = {
  category_id: string;
  current_status: string;
  atomic_attributes: string[];
  known_paths?: string[];
  delivery_boundary?: string;
};

const categories = (coverageMatrix.categories || []) as CoverageCategory[];
const minimumAttributes = (statsProfile.attributes || []) as ProfileAttribute[];
const domainProfiles = [
  ...((remainingProfiles.profiles || []) as DomainProfile[]),
  ...((narrativeProfiles.profiles || []) as DomainProfile[]),
];
const architectureAttributes = (attributeRegistry.attributes || []) as ProfileAttribute[];
const categoryById = new Map(categories.map((category) => [category.category_id, category]));
const rows = new Map<string, EmpiricalTaxonomyAttribute>();

function readableLabel(identifier: string): string {
  const label = identifier.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : identifier;
}

function taxonomyTheme(categoryId: string): string {
  const prefix = categoryId.split(".")[0];
  if (["audio", "visual", "narrative", "governance", "source", "language", "scene", "research", "analytics"].includes(prefix)) {
    return prefix;
  }
  if (["external", "delivery"].includes(prefix)) return "external and delivery";
  return "method and architecture";
}

function addAttribute(row: EmpiricalTaxonomyAttribute): void {
  const key = `${row.categoryId}:${row.attributeId}`;
  const existing = rows.get(key);
  rows.set(key, existing
    ? { ...existing, ...row, knownPaths: [...new Set([...existing.knownPaths, ...row.knownPaths])] }
    : row);
}

minimumAttributes.forEach((attribute) => {
  (attribute.inventory_categories || []).forEach((categoryId) => {
    const category = categoryById.get(categoryId);
    addAttribute({
      attributeId: attribute.attribute_id,
      attributeLabel: readableLabel(attribute.attribute_id),
      categoryId,
      categoryLabel: readableLabel(categoryId),
      categoryStatus: category?.status || "contracted",
      attributeStatus: attribute.implementation_status || category?.status || "contracted",
      theme: taxonomyTheme(categoryId),
      knownPaths: category?.actual_surfaces || [],
      description: attribute.definition || category?.scientific_gap || "Canonical atomic attribute contract.",
    });
  });
});

domainProfiles.forEach((profile) => {
  const category = categoryById.get(profile.category_id);
  profile.atomic_attributes.forEach((attributeId) => addAttribute({
    attributeId,
    attributeLabel: readableLabel(attributeId),
    categoryId: profile.category_id,
    categoryLabel: readableLabel(profile.category_id),
    categoryStatus: category?.status || profile.current_status,
    attributeStatus: profile.current_status || category?.status || "contracted",
    theme: taxonomyTheme(profile.category_id),
    knownPaths: [...(profile.known_paths || []), ...(category?.actual_surfaces || [])],
    description: profile.delivery_boundary || category?.scientific_gap || "Domain atomic attribute contract.",
  }));
});

architectureAttributes.forEach((attribute) => addAttribute({
  attributeId: attribute.attribute_id,
  attributeLabel: readableLabel(attribute.attribute_id),
  categoryId: "architecture.canonical_attributes",
  categoryLabel: "Canonical architecture",
  categoryStatus: attribute.implementation_status || "partial",
  attributeStatus: attribute.implementation_status || "partial",
  theme: "method and architecture",
  knownPaths: ["docs/inventory/attribute_registry.json", "docs/inventory/implementation_bindings.json"],
  description: attribute.definition || "Canonical architectural attribute.",
}));

// Keep every category in the 47-category coverage authority visible, including
// a quiet placeholder when its finer atomic profile is not registered yet.
categories.forEach((category) => {
  if ([...rows.values()].some((row) => row.categoryId === category.category_id)) return;
  addAttribute({
    attributeId: `${category.category_id}.profile_pending`,
    attributeLabel: "Atomic profile pending",
    categoryId: category.category_id,
    categoryLabel: readableLabel(category.category_id),
    categoryStatus: category.status,
    attributeStatus: "profile_pending",
    theme: taxonomyTheme(category.category_id),
    knownPaths: category.actual_surfaces || [],
    description: category.scientific_gap || "Atomic runtime profile remains to be completed.",
  });
});

export const EMPIRICAL_TAXONOMY_ATTRIBUTES = [...rows.values()].sort(
  (left, right) => left.categoryId.localeCompare(right.categoryId) || left.attributeId.localeCompare(right.attributeId),
);

export const EMPIRICAL_TAXONOMY_CATEGORY_COUNT = categories.length;
