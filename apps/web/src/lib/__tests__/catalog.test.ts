import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  coverOf, findCategory, findModel, findSubtype, loadCatalog, modelPath, modelsIn, paragraphs, pick, resetCatalog, specGroups, subtypesOf, topCategories,
  type Catalog, type CatalogModel,
} from "../catalog";
import { priceForType } from "../bikes";
import { memoSettled } from "../memo";

// The bike catalogue (lib/catalog.ts): how it is read, and how a model's address, its
// specifications and its cover photo are worked out from the five tables.
const cat = (id: string, slug: string, parent_id: string | null = null, x: Partial<Catalog["categories"][number]> = {}) =>
  ({ id, parent_id, slug, name_en: slug[0].toUpperCase() + slug.slice(1), name_ar: "", blurb_en: "", blurb_ar: "", cover: null, sort: 0, ...x });
const model = (id: string, slug: string, category_id: string, subtype_id: string | null = null, x: Partial<CatalogModel> = {}): CatalogModel =>
  ({ id, category_id, subtype_id, slug, brand: "Alvas", name: slug.toUpperCase(), model_year: null, ride_type: null, tagline_en: "", tagline_ar: "", description_en: "", description_ar: "", specs: {}, spec_sheet: null, sort: 0, ...x });

const CATALOG: Catalog = {
  categories: [cat("c-road", "road"), cat("c-mtb", "mountain"), cat("s-carbon", "carbon", "c-road"), cat("s-endurance", "endurance", "c-road")],
  fields: [
    { key: "frame", label_en: "Frame", label_ar: "الإطار", group_en: "Frame", group_ar: "الهيكل", unit_en: "", unit_ar: "", sort: 10 },
    { key: "weight", label_en: "Weight", label_ar: "الوزن", group_en: "Frame", group_ar: "الهيكل", unit_en: "kg", unit_ar: "كجم", sort: 40 },
    { key: "groupset", label_en: "Groupset", label_ar: "المجموعة", group_en: "Drivetrain", group_ar: "نقل الحركة", unit_en: "", unit_ar: "", sort: 50 },
    { key: "range", label_en: "Range", label_ar: "المدى", group_en: "Electric", group_ar: "الكهرباء", unit_en: "km", unit_ar: "كم", sort: 170 },
  ],
  models: [
    model("m1", "da54", "c-road", "s-carbon", { specs: { frame: { en: "Toray T800 carbon", ar: "كربون توراي T800" }, weight: { en: "8.2", ar: "" }, groupset: "Shimano 105", speeds: { en: "22" }, range: { en: " " } } }),
    model("m2", "city-1", "c-road"),
    model("m3", "rock", "c-mtb", "s-gone"), // its sub-type is not published
  ],
  colors: [],
  photos: [
    { id: "p1", model_id: "m1", color_id: null, url: "/media/bikes/a.jpg", alt_en: "Side view", alt_ar: "", sort: 2, is_cover: false },
    { id: "p2", model_id: "m1", color_id: null, url: "/media/bikes/b.jpg", alt_en: "", alt_ar: "", sort: 1, is_cover: true },
    { id: "p3", model_id: "m2", color_id: null, url: "https://example.com/c.jpg", alt_en: "", alt_ar: "", sort: 5, is_cover: false },
  ],
};

describe("a model's address", () => {
  it("is /bikes/<category>/<sub-type>/<model>, or without the sub-type when it has none", () => {
    expect(modelPath(CATALOG.models[0], CATALOG.categories)).toBe("/bikes/road/carbon/da54");
    expect(modelPath(CATALOG.models[1], CATALOG.categories)).toBe("/bikes/road/city-1");
  });
  it("leaves out a sub-type that is not published, so the model stays reachable", () => {
    expect(modelPath(CATALOG.models[2], CATALOG.categories)).toBe("/bikes/mountain/rock");
  });
});

describe("finding things", () => {
  it("finds categories, sub-types within their category, and models by their unique slug", () => {
    expect(topCategories(CATALOG).map((c) => c.slug)).toEqual(["road", "mountain"]);
    expect(subtypesOf(CATALOG, "c-road").map((c) => c.slug)).toEqual(["carbon", "endurance"]);
    expect(findCategory(CATALOG, "road")?.id).toBe("c-road");
    expect(findCategory(CATALOG, "carbon")).toBeNull(); // a sub-type is not a category
    expect(findSubtype(CATALOG, CATALOG.categories[0], "carbon")?.id).toBe("s-carbon");
    expect(findSubtype(CATALOG, CATALOG.categories[1], "carbon")).toBeNull(); // not this category's
    expect(findModel(CATALOG, "da54")?.id).toBe("m1");
    expect(findModel(CATALOG, "nope")).toBeNull();
  });
  it("lists a category's models, sub-typed or not, and a sub-type's own", () => {
    expect(modelsIn(CATALOG, CATALOG.categories[0]).map((m) => m.slug)).toEqual(["da54", "city-1"]);
    expect(modelsIn(CATALOG, CATALOG.categories[2]).map((m) => m.slug)).toEqual(["da54"]);
    expect(modelsIn(CATALOG, CATALOG.categories[3])).toEqual([]);
  });
});

describe("pick", () => {
  it("reads Arabic only on the Arabic page and only when it is written; every other language reads English", () => {
    expect(pick("ar", "Frame", "الإطار")).toBe("الإطار");
    expect(pick("ar", "Frame", "  ")).toBe("Frame");
    expect(pick("en", "Frame", "الإطار")).toBe("Frame");
    expect(pick("de", "Frame", "الإطار")).toBe("Frame");
    expect(pick("en", null, undefined)).toBe("");
  });
});

describe("specGroups", () => {
  it("groups the filled fields in field order, with the unit, skipping blanks and unknown keys", () => {
    expect(specGroups(CATALOG.models[0], CATALOG.fields, "en")).toEqual([
      { group: "Frame", rows: [{ label: "Frame", value: "Toray T800 carbon" }, { label: "Weight", value: "8.2 kg" }] },
      { group: "Drivetrain", rows: [{ label: "Groupset", value: "Shimano 105" }] },
    ]);
  });
  it("reads the Arabic labels, units and values, falling back to the English value", () => {
    expect(specGroups(CATALOG.models[0], CATALOG.fields, "ar")).toEqual([
      { group: "الهيكل", rows: [{ label: "الإطار", value: "كربون توراي T800" }, { label: "الوزن", value: "8.2 كجم" }] },
      { group: "نقل الحركة", rows: [{ label: "المجموعة", value: "Shimano 105" }] },
    ]);
  });
  it("is empty for a model with no specifications", () => {
    expect(specGroups(CATALOG.models[1], CATALOG.fields, "en")).toEqual([]);
  });
});

describe("coverOf", () => {
  it("takes the photo marked as the cover, else the first by sort, else nothing", () => {
    expect(coverOf(CATALOG.models[0], CATALOG.photos)?.id).toBe("p2");
    expect(coverOf(CATALOG.models[1], CATALOG.photos)?.id).toBe("p3");
    expect(coverOf(CATALOG.models[2], CATALOG.photos)).toBeNull();
  });
});

describe("paragraphs", () => {
  it("splits on blank lines and joins the lines within one", () => {
    expect(paragraphs("One\nstill one.\n\n\nTwo.\r\n\r\nThree.  \n")).toEqual(["One still one.", "Two.", "Three."]);
    expect(paragraphs("")).toEqual([]);
  });
});

describe("priceForType", () => {
  it("states the rental app's rate for a type, and nothing for one it does not price", () => {
    expect(priceForType("Road")).toBe(75);
    expect(priceForType("Road Carbon")).toBe(250);
    expect(priceForType(" Kids ")).toBe(57.5);
    expect(priceForType("Gravel")).toBeNull();
    expect(priceForType("Own")).toBeNull();
    expect(priceForType("")).toBeNull();
  });
});

describe("loadCatalog", () => {
  const rows = (byTable: Record<string, unknown[]>) =>
    vi.fn(async (url: string) => {
      const table = url.match(/rest\/v1\/(\w+)\?/)?.[1] ?? "";
      return new Response(JSON.stringify(byTable[table] ?? []), { status: 200, headers: { "content-type": "application/json" } });
    });
  const FULL = {
    catalog_categories: [cat("c-road", "road"), cat("s-carbon", "carbon", "c-road")],
    catalog_spec_fields: CATALOG.fields,
    catalog_models: [model("m1", "da54", "c-road", "s-carbon"), model("m9", "orphan", "c-hidden")],
    catalog_colors: [],
    catalog_photos: [],
  };
  beforeEach(() => {
    resetCatalog();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reads the five tables once, published rows only, with the public key, and keeps them for a minute", async () => {
    const f = rows(FULL);
    const a = await loadCatalog(f as unknown as typeof fetch, 1_000);
    const b = await loadCatalog(f as unknown as typeof fetch, 30_000);
    expect(b).toBe(a);
    expect(f).toHaveBeenCalledTimes(5);
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls.find((u) => u.includes("catalog_models"))).toContain("published=is.true");
    expect(urls.find((u) => u.includes("catalog_categories"))).toContain("published=is.true");
    expect(urls.find((u) => u.includes("catalog_models"))).toContain("order=sort.asc,name.asc");
    expect(((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>).apikey).toBe("anon");
    // a model whose category is not published has no page: left out
    expect(a?.models.map((m) => m.slug)).toEqual(["da54"]);
    expect(await loadCatalog(f as unknown as typeof fetch, 62_000)).toBe(a); // past the minute: served as it is, refreshed behind
    expect(f).toHaveBeenCalledTimes(10);
    await memoSettled();
  });

  it("keeps the last good copy when a read fails, and answers null when it never read anything", async () => {
    const good = await loadCatalog(rows(FULL) as unknown as typeof fetch, 0);
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await loadCatalog(down as unknown as typeof fetch, 70_000)).toBe(good);
    await memoSettled();
    expect(await loadCatalog(down as unknown as typeof fetch, 80_000)).toBe(good); // the refresh failed: the copy stays
    const refused = vi.fn(async () => new Response("{}", { status: 402 }));
    expect(await loadCatalog(refused as unknown as typeof fetch, 140_000)).toBe(good);
    await memoSettled();
    resetCatalog();
    expect(await loadCatalog(down as unknown as typeof fetch, 0)).toBeNull();
  });

  it("a Worker that has just started takes the edge's copy when the database is down", async () => {
    // Cloudflare's cache at the edge, as a Worker sees it (caches.default).
    const store = new Map<string, string>();
    vi.stubGlobal("caches", { default: {
      match: async (k: string) => (store.has(k) ? new Response(store.get(k)) : undefined),
      put: async (k: string, r: Response) => { store.set(k, await r.text()); },
    } });
    try {
      const good = await loadCatalog(rows(FULL) as unknown as typeof fetch, 0);
      resetCatalog(); // a new instance: nothing in memory
      const down = vi.fn(async () => { throw new Error("offline"); });
      expect(await loadCatalog(down as unknown as typeof fetch, 0)).toEqual(good);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("counts a read that misses one table as failed", async () => {
    const partial = vi.fn(async (url: string) => (url.includes("catalog_photos") ? new Response("oops", { status: 500 }) : new Response("[]", { status: 200 })));
    expect(await loadCatalog(partial as unknown as typeof fetch, 0)).toBeNull();
  });
});
