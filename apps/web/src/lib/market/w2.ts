import {
  MK_CONDITIONS, MK_DECLARATIONS, MK_DESC_MAX, MK_DESC_MIN, MK_FACT_KEYS, MK_FAULTS_MAX, MK_FOR_WHOM, MK_PHOTOS_MAX, MK_PRICE_MAX,
  MK_PRICE_MIN, MK_SERIAL_MAX, MK_TITLE_MAX, MK_TITLE_MIN, MK_WHEEL_SIZES, isMkAction, isMkCity, isMkCondition, isMkNameMode, isMkPhotoName,
  mkClean, mkHasLink, mkHasPhone, mkIsObj, mkSerial, mkSoldShown,
  type MkAction, type MkCategory, type MkCondition, type MkDeclaration, type MkDeclarations, type MkFactKey, type MkFacts,
  type MkListingFields, type MkListingMine, type MkNameMode, type MkStatus,
} from "./core";

// Selling on the Marketplace (W2): the plain rules of the selling form, My listings and their routes, kept apart from
// the screens so they can be tested. Browser-safe: it imports lib/market/core.ts only. The database decides everything
// (market_listing_save, market_listing_publish, market_listing_state); what is here says the same thing sooner, in the
// form, so a seller is told at the field and nothing typed is sent to be refused.

/* ------------------------------------------------------------------ the form as the seller fills it */

/** A listing's fields as the form holds them: what an input holds is a text, whatever the database keeps. */
export type W2Form = {
  photos: string[];
  /** A product type's slug; "" before one is chosen. */
  category: string;
  facts: Record<MkFactKey, string>;
  condition: MkCondition | "";
  faults: string;
  title: string;
  description: string;
  price: string;
  negotiable: boolean;
  city: string;
  serial: string;
  declarations: Record<MkDeclaration, boolean>;
};
/** Every key market_listing_save takes, each with a value (null: nothing). */
export type W2Fields = Required<MkListingFields>;

const noFacts = (): Record<MkFactKey, string> => ({ brand: "", model: "", year: "", frame_size: "", wheel_size: "", size: "", for_whom: "" });
const noTicks = (): Record<MkDeclaration, boolean> => ({ complete: false, unmodified: false, speed_25: false, charger: false });
export const w2Empty = (): W2Form => ({
  photos: [], category: "", facts: noFacts(), condition: "", faults: "", title: "", description: "", price: "", negotiable: false, city: "", serial: "",
  declarations: noTicks(),
});

/** The form for one of the seller's own listings (a draft to carry on with, a listing to edit), or the empty one. */
export function w2FormOf(l: MkListingMine | null | undefined): W2Form {
  const f = w2Empty();
  if (!l) return f;
  for (const k of MK_FACT_KEYS) { const v = l.facts?.[k]; if (typeof v === "string" || typeof v === "number") f.facts[k] = String(v); }
  for (const k of MK_DECLARATIONS) f.declarations[k] = l.declarations?.[k] === true;
  return {
    ...f,
    photos: Array.isArray(l.photos) ? l.photos.filter((p): p is string => typeof p === "string") : [],
    category: l.category ?? "", condition: isMkCondition(l.condition) ? l.condition : "", faults: l.faults ?? "", title: l.title ?? "",
    description: l.description ?? "", price: typeof l.price === "number" ? String(l.price) : "", negotiable: l.negotiable === true,
    city: l.city ?? "", serial: l.serial ?? "",
  };
}

/** A form as this browser kept it (the copy the selling form writes beside itself, so a reload or a lost connection
 *  costs nothing typed): read back key by key, each value of its kind and inside its limits, anything else as
 *  `fallback` has it. Never trusted further than a form the seller could have typed: the database checks every save. */
export function w2FormRead(raw: unknown, fallback: W2Form): W2Form {
  if (!mkIsObj(raw)) return fallback;
  const text = (v: unknown, d: string, max: number) => (typeof v === "string" ? v.slice(0, max) : d);
  const out: W2Form = { ...fallback, facts: { ...fallback.facts }, declarations: { ...fallback.declarations }, photos: [...fallback.photos] };
  if (Array.isArray(raw.photos)) out.photos = [...new Set(raw.photos.filter((p): p is string => isMkPhotoName(p) && p[0] === "l"))].slice(0, MK_PHOTOS_MAX);
  out.category = text(raw.category, out.category, 60);
  if (mkIsObj(raw.facts)) for (const k of MK_FACT_KEYS) out.facts[k] = text(raw.facts[k], out.facts[k], 80);
  if (raw.condition === "" || isMkCondition(raw.condition)) out.condition = raw.condition;
  out.faults = text(raw.faults, out.faults, MK_FAULTS_MAX * 2);
  out.title = text(raw.title, out.title, MK_TITLE_MAX * 2);
  out.description = text(raw.description, out.description, MK_DESC_MAX * 2);
  out.price = text(raw.price, out.price, 20);
  if (typeof raw.negotiable === "boolean") out.negotiable = raw.negotiable;
  out.city = text(raw.city, out.city, 40);
  out.serial = text(raw.serial, out.serial, MK_SERIAL_MAX * 2);
  if (mkIsObj(raw.declarations)) for (const k of MK_DECLARATIONS) if (typeof raw.declarations[k] === "boolean") out.declarations[k] = raw.declarations[k] as boolean;
  return out;
}

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
/** A whole number as people type one: Arabic and Persian digits read as Western ones, spaces and thousands commas
 *  taken out, a trailing ".00" let go. null for anything else (and for nothing typed). */
export function w2Whole(text: string): number | null {
  const s = toLatin(text).replace(/[\s,٬،]/g, "");
  if (!/^\d{1,9}(?:\.0+)?$/.test(s)) return null;
  return Number(s.replace(/\..*$/, ""));
}
/** A serial number as the database keeps it, before it is checked: no spaces, upper case; "" when nothing was typed. */
export const w2SerialText = (text: string): string => toLatin(text).replace(/\s+/g, "").toUpperCase();
/** The newest model year a listing may name: next year's. */
export const w2YearMax = (now: number = Date.now()): number => new Date(now).getUTCFullYear() + 1;
export const W2_YEAR_MIN = 1980;
/** A fact's longest text (the database's own). */
export const W2_FACT_MAX: Partial<Record<MkFactKey, number>> = { brand: 40, model: 60, frame_size: 12, size: 20 };

const trueOnly = (d: MkDeclarations | null | undefined): MkDeclarations => {
  const out: MkDeclarations = {};
  for (const k of MK_DECLARATIONS) if (d?.[k] === true) out[k] = true;
  return out;
};

/** What the form would have the listing hold, in the database's own values: the facts the category asks for and no
 *  others, a serial only where the category takes one, the four ticks only for a "declare" category, every text as the
 *  database cleans it. A value that cannot be read (a price that is not a number) is null here; w2Issues says so. */
export function w2Fields(form: W2Form, cat: MkCategory | null, now: number = Date.now()): W2Fields {
  const facts: MkFacts = {};
  for (const k of MK_FACT_KEYS) {
    if (!cat?.facts.includes(k)) continue;
    const raw = form.facts[k];
    if (k === "year") {
      const y = w2Whole(raw);
      if (y !== null && y >= W2_YEAR_MIN && y <= w2YearMax(now)) facts.year = y;
    } else if (k === "wheel_size") {
      if ((MK_WHEEL_SIZES as readonly string[]).includes(raw)) facts.wheel_size = raw;
    } else if (k === "for_whom") {
      if ((MK_FOR_WHOM as readonly string[]).includes(raw)) facts.for_whom = raw;
    } else {
      const v = mkClean(raw);
      if (v) facts[k] = v;
    }
  }
  const price = w2Whole(form.price);
  return {
    photos: [...form.photos],
    category: cat ? cat.slug : null,
    title: mkClean(form.title) || null,
    description: mkClean(form.description) || null,
    condition: form.condition || null,
    faults: mkClean(form.faults) || null,
    price: price !== null && price >= MK_PRICE_MIN && price <= MK_PRICE_MAX ? price : null,
    negotiable: form.negotiable,
    city: isMkCity(form.city) ? form.city : null,
    facts,
    serial: cat?.needs_serial ? w2SerialText(form.serial) || null : null,
    declarations: cat?.tier === "declare" ? trueOnly(form.declarations) : {},
  };
}

/** What a listing holds now, in the same shape (the empty listing before a draft exists). */
export function w2Stored(l: MkListingMine | null | undefined): W2Fields {
  const facts: MkFacts = {};
  for (const k of MK_FACT_KEYS) { const v = l?.facts?.[k]; if (typeof v === "string" || typeof v === "number") facts[k] = v; }
  return {
    photos: Array.isArray(l?.photos) ? [...l.photos] : [], category: l?.category ?? null, title: l?.title ?? null, description: l?.description ?? null,
    condition: l?.condition ?? null, faults: l?.faults ?? null, price: l?.price ?? null, negotiable: l?.negotiable === true, city: l?.city ?? null,
    facts, serial: l?.serial ?? null, declarations: trueOnly(l?.declarations),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** The keys whose value is no longer what the listing holds: what a save sends, and nothing else (a key left out
 *  stays as it is). `base` is what the database last took. */
export function w2Changes(base: W2Fields, want: W2Fields): MkListingFields {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(want) as (keyof W2Fields)[]) if (!same(base[k], want[k])) out[k] = want[k];
  return out as MkListingFields;
}
export const w2HasChanges = (c: MkListingFields): boolean => Object.keys(c).length > 0;

/* ------------------------------------------------------------------ the steps, and what each still needs */

/** The form's steps, in order. "final" holds the serial number, the declarations, the name and the consent tick. */
export const W2_STEPS = ["item", "details", "words", "price", "final", "review"] as const;
export type W2Step = (typeof W2_STEPS)[number];
export const isW2Step = (v: unknown): v is W2Step => typeof v === "string" && (W2_STEPS as readonly string[]).includes(v);

/** The states a seller may edit a listing in (market_listing_save's own). */
export const W2_EDITABLE: readonly MkStatus[] = ["draft", "live", "reserved", "expired"];
export const w2Editable = (s: MkStatus): boolean => W2_EDITABLE.includes(s);

/** The steps this listing's form has. A draft has them all (it is published at the end, with its name and tick). A
 *  listing already published keeps the name it was published with, so its "final" step is there only when the
 *  category asks for a serial number or the declarations. */
export function w2Steps(draft: boolean, cat: MkCategory | null): W2Step[] {
  return W2_STEPS.filter((s) => s !== "final" || draft || !!cat?.needs_serial || cat?.tier === "declare");
}
/** The step after (+1) or before (-1) one, among the steps this form has; null at either end. */
export function w2StepFrom(steps: readonly W2Step[], at: W2Step, by: 1 | -1): W2Step | null {
  const i = steps.indexOf(at);
  return i < 0 ? steps[0] ?? null : steps[i + by] ?? null;
}

/** Where a form opens. A listing already published opens on its review, where each part has its own Edit. A draft
 *  opens on the first step that still needs something, so a seller carries on where they stopped. */
export function w2StartStep(draft: boolean, steps: readonly W2Step[], issues: readonly Pick<W2Issue, "step">[]): W2Step {
  if (!draft) return "review";
  return steps.find((s) => issues.some((i) => i.step === s)) ?? "review";
}

/** One thing the form still needs. `field` is the control it is about; `key` chooses its words (components/market/w2/
 *  say.ts); `n` a number those words carry. `hard`: the database would refuse the value even in a draft, so it is never
 *  sent; the others only stand in the way of publishing. */
export type W2Issue = { step: W2Step; field: string; key: string; n?: number; hard: boolean };

/** What the account and its choices on the last step bring to the check. */
export type W2Ctx = {
  /** A draft: it is published at the end, so the name and the ticks are asked for. */
  draft: boolean;
  /** A new account's price ceiling (market_me limits.price_max). */
  priceMax: number;
  /** The account lists as its approved shop: no name is chosen. */
  shop: boolean;
  /** What "first name and last initial" would show; null when the account has no name to show. */
  shortName: string | null;
  nameMode: MkNameMode | "";
  consent: boolean;
  /** The account has not accepted the current rules, so their tick is asked for. */
  termsNeeded: boolean;
  termsTick: boolean;
  now?: number;
};

const textIssue = (step: W2Step, field: string, v: string): W2Issue | null =>
  mkHasLink(v) ? { step, field, key: "link", hard: true } : mkHasPhone(v) ? { step, field, key: "phone", hard: true } : null;

/** Everything the form still needs before it can be published (a draft) or saved (a listing on sale), in the order of
 *  its steps: the publish rules of market_listing_publish, said at the field. */
export function w2Issues(form: W2Form, cat: MkCategory | null, ctx: W2Ctx): W2Issue[] {
  const out: W2Issue[] = [];
  const add = (i: W2Issue | null) => { if (i) out.push(i); };
  const now = ctx.now ?? Date.now();

  // photos and category
  const min = cat?.min_photos ?? 1;
  if (form.photos.length > MK_PHOTOS_MAX) out.push({ step: "item", field: "photos", key: "photos_max", hard: true });
  else if (form.photos.length < min) out.push({ step: "item", field: "photos", key: "photos", n: min, hard: false });
  if (!cat || cat.parent === null) out.push({ step: "item", field: "category", key: "category", hard: false });

  // the facts, the condition and the known faults
  for (const k of MK_FACT_KEYS) {
    if (!cat?.facts.includes(k)) continue;
    const raw = form.facts[k], field = `fact_${k}`;
    if (k === "year") {
      if (!raw.trim()) continue;
      const y = w2Whole(raw);
      if (y === null || y < W2_YEAR_MIN || y > w2YearMax(now)) out.push({ step: "details", field, key: "year", hard: true });
    } else if (k !== "wheel_size" && k !== "for_whom") {
      const v = mkClean(raw);
      if (v.length > (W2_FACT_MAX[k] ?? 60)) out.push({ step: "details", field, key: "long", hard: true });
      else add(textIssue("details", field, v));
    }
  }
  if (!form.condition) out.push({ step: "details", field: "condition", key: "condition", hard: false });
  else if (cat?.tier === "new_only" && form.condition !== "new") out.push({ step: "details", field: "condition", key: "new_only", hard: false });
  const faults = mkClean(form.faults);
  if (faults.length > MK_FAULTS_MAX) out.push({ step: "details", field: "faults", key: "long", hard: true });
  else add(textIssue("details", "faults", faults));

  // the title and the description
  const title = mkClean(form.title), titleBad = textIssue("words", "title", title);
  if (title.length > MK_TITLE_MAX) out.push({ step: "words", field: "title", key: "title", hard: true });
  else if (titleBad) out.push(titleBad);
  else if (title.length < MK_TITLE_MIN) out.push({ step: "words", field: "title", key: "title", hard: false });
  const desc = mkClean(form.description), descBad = textIssue("words", "description", desc);
  if (desc.length > MK_DESC_MAX) out.push({ step: "words", field: "description", key: "description", hard: true });
  else if (descBad) out.push(descBad);
  else if (desc.length < MK_DESC_MIN) out.push({ step: "words", field: "description", key: "description", hard: false });

  // the price and the city
  const price = w2Whole(form.price);
  if (!form.price.trim()) out.push({ step: "price", field: "price", key: "price", hard: false });
  else if (price === null || price < MK_PRICE_MIN || price > MK_PRICE_MAX) out.push({ step: "price", field: "price", key: "price", hard: true });
  else if (price > ctx.priceMax) out.push({ step: "price", field: "price", key: "price_max", n: ctx.priceMax, hard: false });
  if (!isMkCity(form.city)) out.push({ step: "price", field: "city", key: "city", hard: false });

  // the serial number, the declarations, the name and the ticks
  if (cat?.needs_serial) {
    const s = w2SerialText(form.serial);
    if (!s) out.push({ step: "final", field: "serial", key: "serial", hard: false });
    else if (!mkSerial(s)) out.push({ step: "final", field: "serial", key: "serial", hard: true });
  }
  if (cat?.tier === "declare" && !MK_DECLARATIONS.every((k) => form.declarations[k])) out.push({ step: "final", field: "declarations", key: "declare", hard: false });
  if (ctx.draft) {
    if (!ctx.shop && (ctx.nameMode === "" || (ctx.nameMode === "short" && !ctx.shortName))) out.push({ step: "final", field: "name_mode", key: "name_mode", hard: false });
    if (!ctx.consent) out.push({ step: "final", field: "consent", key: "consent", hard: false });
    if (ctx.termsNeeded && !ctx.termsTick) out.push({ step: "final", field: "terms", key: "terms", hard: false });
  }
  return out;
}

/** Which of a listing's keys a control's value goes into. */
function keyOfField(field: string): keyof W2Fields | null {
  if (field.startsWith("fact_")) return "facts";
  return (["photos", "category", "title", "description", "condition", "faults", "price", "city", "serial", "declarations"] as const).find((k) => k === field) ?? null;
}
/** What a draft's save may send of its changes: everything but the keys whose value the database would refuse (a
 *  link in the title, a year that is not one). Those stay in the form, said at their field, until they are put right. */
export function w2Sendable(changes: MkListingFields, issues: readonly W2Issue[]): MkListingFields {
  const held = new Set(issues.filter((i) => i.hard).map((i) => keyOfField(i.field)));
  return Object.fromEntries(Object.entries(changes).filter(([k]) => !held.has(k as keyof W2Fields))) as MkListingFields;
}

/** The check that looks only at the values the database would refuse outright, whoever the account is: what a draft's
 *  save holds back, and what decides where a draft opens. */
export const W2_HARD_ONLY: W2Ctx = { draft: false, priceMax: Number.MAX_SAFE_INTEGER, shop: true, shortName: null, nameMode: "", consent: true, termsNeeded: false, termsTick: true };

/** What one save sends (market_listing_save's `p`), or null when there is nothing to send. `l` is the listing as the
 *  database last answered it (null: no draft yet), `base` what it holds.
 *  - No draft yet: nothing is sent unless `create` - the first photo makes the draft (and Next, once there is one);
 *    putting the page away with only a category chosen never does. With `create` an empty change still makes it.
 *  - A draft: what changed, without the values the database would refuse outright (they stay in the form, said at
 *    their field); with `all`, everything that changed.
 *  - A listing already published: nothing unless `all` (it is saved in one go from its review, because the database
 *    holds a listing on sale to every publish rule on each save). */
export function w2SaveWhat(l: Pick<MkListingMine, "status"> | null, base: W2Fields, form: W2Form, cat: MkCategory | null, o: { all?: boolean; create?: boolean } = {}, now: number = Date.now()): MkListingFields | null {
  if (!l && !o.create) return null;
  if (l && l.status !== "draft" && !o.all) return null;
  let changes = w2Changes(base, w2Fields(form, cat, now));
  if (!o.all) changes = w2Sendable(changes, w2Issues(form, cat, { ...W2_HARD_ONLY, now }));
  return w2HasChanges(changes) || !l ? changes : null;
}

/** Where a refusal the database gave belongs in the form: its step and its control; null for one that is about the
 *  account or the moment (a limit, a pause, no connection), which is said where the seller pressed. */
export function w2Place(error: string, detail: string): { step: W2Step; field: string } | null {
  const byKey: Record<string, { step: W2Step; field: string }> = {
    photos: { step: "item", field: "photos" }, category: { step: "item", field: "category" },
    condition: { step: "details", field: "condition" }, faults: { step: "details", field: "faults" }, facts: { step: "details", field: "facts" },
    title: { step: "words", field: "title" }, description: { step: "words", field: "description" },
    price: { step: "price", field: "price" }, negotiable: { step: "price", field: "price" }, city: { step: "price", field: "city" },
    serial: { step: "final", field: "serial" }, declarations: { step: "final", field: "declarations" }, name_mode: { step: "final", field: "name_mode" },
  };
  if (error === "input" || error === "link" || error === "phone") return byKey[detail] ?? null;
  if (error === "photos") return byKey.photos;
  if (error === "serial") return byKey.serial;
  if (error === "declare") return byKey.declarations;
  if (error === "new_only") return byKey.condition;
  if (error === "price") return byKey.price;
  if (error === "consent") return { step: "final", field: "consent" };
  if (error === "terms") return { step: "final", field: "terms" };
  return null;
}

/* ------------------------------------------------------------------ the form kept in this browser */

/** How long this browser keeps a form beside the page: twelve hours, so a phone several people use holds no one's
 *  listing for longer. */
export const W2_KEPT_MS = 12 * 3600 * 1000;
/** What a listing's form opens with. `step` null: where the form itself would open. */
export type W2Kept = { form: W2Form; step: W2Step | null; nameMode: MkNameMode | "" };

/** What the selling form writes beside itself for one listing: when the database last changed the listing (`at`),
 *  when this was written, the step and the name choice, and the form itself ONLY while it holds something the
 *  database has not taken yet - a form that is saved is the database's and is not kept twice. */
export function w2KeptValue(l: Pick<MkListingMine, "updated_at">, form: W2Form, dirty: boolean, step: W2Step, nameMode: MkNameMode | "", now: number): Record<string, unknown> {
  return { at: l.updated_at, saved: now, dirty, step, nameMode, ...(dirty ? { form } : {}) };
}
/** A kept value past its time, or one that is not ours to read: it is let go. */
export const w2KeptOld = (raw: unknown, now: number): boolean => !(mkIsObj(raw) && typeof raw.saved === "number" && now - raw.saved < W2_KEPT_MS);

/** The form one of the seller's listings opens with, given what this browser kept for it (`raw`: the parsed value,
 *  anything else when there is none). The kept form is used only when it held something unsaved and is either of
 *  this very state of the listing or recent; when the listing changed since (a save whose answer never arrived,
 *  another device), its photos are the database's. Everything else is the listing as the database has it. */
export function w2KeptRead(raw: unknown, l: MkListingMine | null, now: number): W2Kept {
  const server = w2FormOf(l);
  if (!l || !mkIsObj(raw)) return { form: server, step: null, nameMode: "" };
  const same = raw.at === l.updated_at;
  const recent = !w2KeptOld(raw, now);
  let form = server;
  if (raw.dirty === true && (same || recent)) {
    form = w2FormRead(raw.form, server);
    if (!same) form = { ...form, photos: server.photos };
  }
  return { form, step: isW2Step(raw.step) && (same || recent) ? raw.step : null, nameMode: isMkNameMode(raw.nameMode) ? raw.nameMode : "" };
}

/* ------------------------------------------------------------------ the photo step */

/** The shots a bike's listing is asked for, in the order of its photo slots: the first is the cover. */
export const W2_SHOTS = ["drive", "other", "drivetrain", "cockpit", "frame", "damage"] as const;
export type W2Shot = (typeof W2_SHOTS)[number];
/** A whole bicycle (an e-bike too): its empty photo slots are drawn as labelled shot outlines. */
export const w2IsBike = (cat: Pick<MkCategory, "slug"> | null | undefined): boolean => !!cat && /^cycling-bike-/.test(cat.slug);
/** The empty slots drawn after `taken` photos (stored and on their way): for a bike the shots not yet filled, by
 *  place; for anything else, and for a bike once its shots are filled, one plain slot while there is room. */
export function w2Slots(taken: number, cat: MkCategory | null): (W2Shot | "plain")[] {
  if (taken >= MK_PHOTOS_MAX) return [];
  const shots = w2IsBike(cat) ? W2_SHOTS.slice(Math.min(taken, W2_SHOTS.length)) : [];
  return shots.length ? shots : ["plain"];
}
/** A list with the item at `from` put at `to`; the same list when either is outside it. */
export function w2Move<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from === to || from < 0 || to < 0 || from >= out.length || to >= out.length) return out;
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/* ------------------------------------------------------------------ My listings */

/** What a seller can do with one of their listings, in the order its buttons are drawn. A held or a hidden listing
 *  offers nothing: it says what happened and no more. */
export type W2Act = "continue" | "view" | "edit" | "reserve" | "unreserve" | "sold" | "unsold" | "renew" | "repost" | "share" | "delete";
export function w2Acts(l: Pick<MkListingMine, "status" | "renewable" | "commission_received" | "expires_at" | "sold_at">, now: number = Date.now()): W2Act[] {
  const renew: W2Act[] = l.renewable ? ["renew"] : [];
  switch (l.status) {
    case "draft": return ["continue", "delete"];
    case "live": return [...renew, "view", "sold", "reserve", "edit", "share", "delete"];
    case "reserved": return [...renew, "view", "sold", "unreserve", "edit", "share", "delete"];
    case "sold": {
      // back on sale while the sale can still fall through: the commission not ticked received, the listing not past its time
      const t = l.expires_at ? Date.parse(l.expires_at) : NaN;
      const back = !l.commission_received && Number.isFinite(t) && t > now;
      return [...(mkSoldShown(l.sold_at, now) ? ["view" as const] : []), ...(back ? ["unsold" as const] : []), "delete"];
    }
    case "expired": return ["repost", "edit", "delete"];
    default: return [];
  }
}
/** The action market_listing_state is asked for by each button that changes a listing's state. */
export const W2_STATE_OF: Partial<Record<W2Act, MkAction>> = { reserve: "reserved", unreserve: "live", unsold: "live", sold: "sold", renew: "renew", repost: "renew", delete: "deleted" };

/** The groups My listings can be narrowed to, and the states each holds. */
export const W2_GROUPS = ["live", "draft", "sold", "ended"] as const;
export type W2Group = (typeof W2_GROUPS)[number];
export function w2GroupOf(s: MkStatus): W2Group {
  return s === "draft" ? "draft" : s === "sold" ? "sold" : s === "expired" || s === "hidden" || s === "deleted" ? "ended" : "live";
}
/** The groups that hold at least one of these listings, in their order. */
export const w2GroupsIn = (items: readonly Pick<MkListingMine, "status">[]): W2Group[] => W2_GROUPS.filter((g) => items.some((l) => w2GroupOf(l.status) === g));

/* ------------------------------------------------------------------ what the routes take */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELD_KEYS = ["category", "title", "description", "condition", "faults", "price", "negotiable", "city", "facts", "serial", "declarations", "photos"] as const;
const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

/** POST /api/market/listing/save's `fields`, checked: only the keys market_listing_save takes, each of its shape (a
 *  text within reach of its column, a price inside the table's bounds, a photo name of the marketplace's bucket); null
 *  for anything else. The exact verdict on a value (its cleaned length, a link in it) is the database's. */
export function w2BodyFields(raw: unknown): MkListingFields | null {
  if (!mkIsObj(raw)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!(FIELD_KEYS as readonly string[]).includes(k)) return null;
    switch (k as (typeof FIELD_KEYS)[number]) {
      case "category": if (v !== null && !(str(v, 60) && v.length >= 2 && SLUG.test(v))) return null; break;
      case "title": if (v !== null && !str(v, 400)) return null; break;
      case "description": if (v !== null && !str(v, 6000)) return null; break;
      case "faults": if (v !== null && !str(v, 2000)) return null; break;
      case "serial": if (v !== null && !str(v, MK_SERIAL_MAX * 3)) return null; break;
      case "condition": if (v !== null && !isMkCondition(v)) return null; break;
      case "city": if (v !== null && !isMkCity(v)) return null; break;
      case "price": if (v !== null && !(typeof v === "number" && Number.isInteger(v) && v >= MK_PRICE_MIN && v <= MK_PRICE_MAX)) return null; break;
      case "negotiable": if (typeof v !== "boolean") return null; break;
      case "facts":
        if (!mkIsObj(v)) return null;
        for (const [fk, fv] of Object.entries(v)) {
          if (!(MK_FACT_KEYS as readonly string[]).includes(fk)) return null;
          if (!(str(fv, 200) || (typeof fv === "number" && Number.isFinite(fv)))) return null;
        }
        break;
      case "declarations":
        if (!mkIsObj(v)) return null;
        for (const [dk, dv] of Object.entries(v)) if (!(MK_DECLARATIONS as readonly string[]).includes(dk) || typeof dv !== "boolean") return null;
        break;
      case "photos":
        if (!Array.isArray(v) || v.length > MK_PHOTOS_MAX || new Set(v).size !== v.length) return null;
        // a seller's photo is one of the marketplace's own bucket, under a listing (never a shop's logo or a site path)
        for (const p of v) if (!isMkPhotoName(p) || p[0] !== "l") return null;
        break;
    }
    out[k] = v;
  }
  return out as MkListingFields;
}

/** POST /api/market/listing/publish's body, checked; null for anything else. */
export function w2BodyPublish(b: Record<string, unknown>): { id: number; nameMode: MkNameMode; consent: boolean; terms: string | null } | null {
  const id = b.id, terms = b.terms ?? null;
  if (!(typeof id === "number" && Number.isSafeInteger(id) && id > 0)) return null;
  if (!isMkNameMode(b.nameMode) || typeof b.consent !== "boolean") return null;
  if (terms !== null && !(typeof terms === "string" && /^[A-Za-z0-9._-]{1,20}$/.test(terms))) return null;
  return { id, nameMode: b.nameMode, consent: b.consent, terms };
}

/** POST /api/market/listing/state's body, checked: "sold" carries the price it sold for, nothing else carries one. */
export function w2BodyState(b: Record<string, unknown>): { id: number; action: MkAction; price: number | null } | null {
  const id = b.id;
  if (!(typeof id === "number" && Number.isSafeInteger(id) && id > 0) || !isMkAction(b.action)) return null;
  if (b.action !== "sold") return b.price === undefined || b.price === null ? { id, action: b.action, price: null } : null;
  const p = b.price;
  return typeof p === "number" && Number.isInteger(p) && p >= MK_PRICE_MIN && p <= MK_PRICE_MAX ? { id, action: "sold", price: p } : null;
}

/** The conditions a category's picker offers, in order (all five; a "new only" category refuses the others in words). */
export const W2_CONDITIONS = MK_CONDITIONS;
