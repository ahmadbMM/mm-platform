// The bike catalogue (micromobility.sa/bikes): the categories, their sub-types, the models in
// them and each model's specifications, colours and photos. Staff maintain it from the booking
// app's staff page (Website > Bikes catalog); it lives in five tables of the same database the
// site already reads (supabase/migrations/20260927100000_bike_catalog.sql in the booking app).
//
// Read with the public key. Row security already shows the public only published categories and
// models (and the colours and photos of published models); the reads ask for published rows too,
// so that a policy change can never widen what this page shows. Everything is read in one go and
// kept for a minute per Worker instance, the way the site's content is (lib/site.ts, lib/memo.ts):
// a staff save shows within a minute, and a failed read keeps the last good copy.
import { edgeStore, memo, resetMemo } from "./memo";

export type CatalogCategory = {
  id: string;
  /** null = a category (Road, Mountain...); set = a sub-type of that category (Carbon...). */
  parent_id: string | null;
  slug: string;
  name_en: string;
  name_ar: string;
  blurb_en: string;
  blurb_ar: string;
  /** A /media/... path or an https URL, or null. */
  cover: string | null;
  sort: number;
};

export type CatalogSpecField = {
  key: string;
  label_en: string;
  label_ar: string;
  group_en: string;
  group_ar: string;
  unit_en: string;
  unit_ar: string;
  sort: number;
};

/** A specification's value in both languages; a blank Arabic reads as the English. */
export type SpecValue = { en?: string; ar?: string };

export type CatalogModel = {
  id: string;
  category_id: string;
  subtype_id: string | null;
  slug: string;
  brand: string;
  name: string;
  model_year: number | null;
  /** The rental type it rides as (Road, Mountain, Hybrid, Gravel, Kids, Road Carbon), which
   *  decides the ride price (lib/bikes.ts priceForType); null when it is not rented. */
  ride_type: string | null;
  tagline_en: string;
  tagline_ar: string;
  /** Plain text; blank lines separate paragraphs. Never markup. */
  description_en: string;
  description_ar: string;
  /** Keyed by a spec field's key. */
  specs: Record<string, SpecValue | string>;
  /** A /media/...pdf path or an https URL, or null. */
  spec_sheet: string | null;
  sort: number;
};

export type CatalogColor = {
  id: string;
  model_id: string;
  name_en: string;
  name_ar: string;
  /** "#rrggbb" or null. */
  hex: string | null;
  sort: number;
};

export type CatalogPhoto = {
  id: string;
  model_id: string;
  /** The colour this photo shows, or null when it is not one colour's. */
  color_id: string | null;
  url: string;
  alt_en: string;
  alt_ar: string;
  sort: number;
  is_cover: boolean;
};

export type Catalog = {
  categories: CatalogCategory[];
  fields: CatalogSpecField[];
  models: CatalogModel[];
  colors: CatalogColor[];
  photos: CatalogPhoto[];
};

const TTL_MS = 60_000; // a staff save shows within a minute
const KEY = "catalog";

// Each table's columns and order. Named rather than "*", so a column staff gain later is never
// sent to the page unasked; the order is the one staff set, then the name.
const TABLES = {
  categories: { table: "catalog_categories", cols: "id,parent_id,slug,name_en,name_ar,blurb_en,blurb_ar,cover,sort", filter: "published=is.true&order=sort.asc,name_en.asc" },
  fields: { table: "catalog_spec_fields", cols: "key,label_en,label_ar,group_en,group_ar,unit_en,unit_ar,sort", filter: "order=sort.asc,label_en.asc" },
  models: { table: "catalog_models", cols: "id,category_id,subtype_id,slug,brand,name,model_year,ride_type,tagline_en,tagline_ar,description_en,description_ar,specs,spec_sheet,sort", filter: "published=is.true&order=sort.asc,name.asc" },
  colors: { table: "catalog_colors", cols: "id,model_id,name_en,name_ar,hex,sort", filter: "order=sort.asc,name_en.asc" },
  photos: { table: "catalog_photos", cols: "id,model_id,color_id,url,alt_en,alt_ar,sort,is_cover", filter: "order=sort.asc,id.asc" },
} as const;

/** One table's rows with the public key; null when it could not be read. */
async function readTable<T>(spec: { table: string; cols: string; filter: string }, fetchImpl: typeof fetch): Promise<T[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetchImpl(`${url}/rest/v1/${spec.table}?select=${spec.cols}&${spec.filter}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown;
    return Array.isArray(rows) ? (rows.filter((r) => r && typeof r === "object") as T[]) : null;
  } catch {
    return null; // unreachable or slow
  }
}

/** The five tables, all or nothing: half a catalogue (models without their categories) would
 *  render as pages with no address, so a read that misses any table counts as failed. */
async function readCatalog(fetchImpl: typeof fetch): Promise<Catalog | null> {
  const [categories, fields, models, colors, photos] = await Promise.all([
    readTable<CatalogCategory>(TABLES.categories, fetchImpl),
    readTable<CatalogSpecField>(TABLES.fields, fetchImpl),
    readTable<CatalogModel>(TABLES.models, fetchImpl),
    readTable<CatalogColor>(TABLES.colors, fetchImpl),
    readTable<CatalogPhoto>(TABLES.photos, fetchImpl),
  ]);
  if (!categories || !fields || !models || !colors || !photos) return null;
  // A model whose category staff have unpublished has no page to be on: left out everywhere.
  const known = new Set(categories.map((c) => c.id));
  return { categories, fields, models: models.filter((m) => known.has(m.category_id)), colors, photos };
}

/**
 * The published catalogue, read once per Worker instance and kept for a minute (lib/memo.ts:
 * everyone asking at once shares the read, a copy past the minute is served while it is refreshed,
 * and a failed read keeps the last good copy - this instance's, else the edge's). Null only when
 * nothing has ever been read: the pages then fail (error.tsx, nothing cached) rather than answer
 * "not found", or an empty catalogue the edge would keep for a minute.
 */
export async function loadCatalog(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<Catalog | null> {
  return memo<Catalog>(KEY, { ttl: TTL_MS, now, read: () => readCatalog(fetchImpl), keep: edgeStore("catalog") });
}

/** For tests: forget the cached copy. */
export function resetCatalog(): void {
  resetMemo(KEY);
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Arabic when the page is Arabic and the Arabic is written; else the English. Every other
 *  language reads the catalogue in English (the owner's decision: brands and specifications are
 *  not translated). */
export function pick(locale: string, en: string | null | undefined, ar: string | null | undefined): string {
  if (locale === "ar" && ar && ar.trim()) return ar.trim();
  return (en ?? "").trim();
}

export const topCategories = (catalog: Catalog): CatalogCategory[] => catalog.categories.filter((c) => c.parent_id === null);

export const subtypesOf = (catalog: Catalog, categoryId: string): CatalogCategory[] => catalog.categories.filter((c) => c.parent_id === categoryId);

/** A category (not a sub-type) by its address segment. */
export const findCategory = (catalog: Catalog, slug: string): CatalogCategory | null =>
  catalog.categories.find((c) => c.parent_id === null && c.slug === slug) ?? null;

/** One of this category's sub-types by its address segment. */
export const findSubtype = (catalog: Catalog, category: CatalogCategory, slug: string): CatalogCategory | null =>
  catalog.categories.find((c) => c.parent_id === category.id && c.slug === slug) ?? null;

/** A model by its slug, which is unique across the whole catalogue. */
export const findModel = (catalog: Catalog, slug: string): CatalogModel | null => catalog.models.find((m) => m.slug === slug) ?? null;

export const categoryOf = (model: CatalogModel, categories: CatalogCategory[]): CatalogCategory | null =>
  categories.find((c) => c.id === model.category_id && c.parent_id === null) ?? null;

/** The model's sub-type, when it has one that is published and is one of its category's. */
export const subtypeOf = (model: CatalogModel, categories: CatalogCategory[]): CatalogCategory | null =>
  model.subtype_id ? categories.find((c) => c.id === model.subtype_id && c.parent_id === model.category_id) ?? null : null;

/** A model's one address: /bikes/<category>/<sub-type>/<model>, or /bikes/<category>/<model>
 *  when it has no sub-type. A sub-type that is not published is left out of the address, so the
 *  model stays reachable from its category. (A model with no published category is never loaded
 *  - readCatalog - so the catalogue itself is only a guard here.) */
export function modelPath(model: CatalogModel, categories: CatalogCategory[]): string {
  const cat = categoryOf(model, categories);
  if (!cat) return "/bikes";
  const sub = subtypeOf(model, categories);
  return sub ? `/bikes/${cat.slug}/${sub.slug}/${model.slug}` : `/bikes/${cat.slug}/${model.slug}`;
}

/** The models of a category (all of them, sub-typed or not) or of one sub-type. */
export function modelsIn(catalog: Catalog, categoryOrSubtype: CatalogCategory): CatalogModel[] {
  return categoryOrSubtype.parent_id === null
    ? catalog.models.filter((m) => m.category_id === categoryOrSubtype.id)
    : catalog.models.filter((m) => m.subtype_id === categoryOrSubtype.id);
}

export type SpecRow = { label: string; value: string };
export type SpecGroup = { group: string; rows: SpecRow[] };

/** The model's specifications as the page lists them: in the fields' order, grouped under each
 *  field's group as the groups first appear, the unit after the value ("8.2 kg"). A field with no
 *  value and a value for a field staff have removed are both left out. */
export function specGroups(model: CatalogModel, fields: CatalogSpecField[], locale: string): SpecGroup[] {
  const groups: SpecGroup[] = [];
  const specs = model.specs && typeof model.specs === "object" ? model.specs : {};
  for (const f of fields) {
    const raw = specs[f.key];
    const v = typeof raw === "string" ? raw : raw && typeof raw === "object" ? pick(locale, raw.en, raw.ar) : "";
    const value = v.trim();
    if (!value) continue;
    const unit = pick(locale, f.unit_en, f.unit_ar);
    const group = pick(locale, f.group_en, f.group_ar);
    const row = { label: pick(locale, f.label_en, f.label_ar), value: unit ? `${value} ${unit}` : value };
    const g = groups.find((x) => x.group === group);
    if (g) g.rows.push(row);
    else groups.push({ group, rows: [row] });
  }
  return groups;
}

/** A model's photos, in order. */
export const photosOf = (model: CatalogModel, photos: CatalogPhoto[]): CatalogPhoto[] => photos.filter((p) => p.model_id === model.id);

/** A model's colours, in order. */
export const colorsOf = (model: CatalogModel, colors: CatalogColor[]): CatalogColor[] => colors.filter((c) => c.model_id === model.id);

/** The photo that stands for the model: the one staff marked as the cover, else the first. */
export function coverOf(model: CatalogModel, photos: CatalogPhoto[]): CatalogPhoto | null {
  const own = photosOf(model, photos);
  return own.find((p) => p.is_cover) ?? own[0] ?? null;
}

/** The description's paragraphs: blank lines separate them; a line break within one is a space. */
export function paragraphs(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join(" ")).filter(Boolean);
}
