import {
  MK_RULES, SA_CITIES, isMkCity, isMkPhotoName, mkClean, mkHasLink, mkHasPhone,
  type MkShopFields, type MkShopMine, type MkShopStatus,
} from "./core";

// A shop's application and "My shop" (W4), the part that is the same on the server and in the browser and can be
// tested: the form as it is typed, what stands in the way of sending it, the values the database is sent, and what a
// refusal is about. The database decides everything (the booking app's market_shop_apply); these rules are its own,
// said early so that a long form is not sent to be refused. A shop's commercial registration and VAT numbers are a
// business's identifiers: they are asked for and shown. No personal ID number is asked for anywhere.

/* ------------------------------------------------------------------ the form */

/** The form's fields, in the order the page asks for them; each is what was typed, as text. */
export const W4_KEYS = [
  "name_en", "name_ar", "sells", "about_en", "about_ar", "logo",
  "cr_no", "cr_activity", "vat_no",
  "city", "address", "map_url",
  "phone", "whatsapp",
  "returns_en", "returns_ar",
] as const;
export type W4Key = (typeof W4_KEYS)[number];
export type W4Form = Record<W4Key, string>;

/** What an approved shop's owner can no longer change (staff can): a different value is refused "MKT_INPUT: locked". */
export const W4_LOCKED: readonly W4Key[] = ["name_en", "cr_no", "cr_activity", "vat_no", "city"];
export const w4IsLocked = (k: W4Key): boolean => W4_LOCKED.includes(k);
/** The fields that are sentences: a link or a phone number in one of them is refused. */
export const W4_PROSE: readonly W4Key[] = ["name_en", "name_ar", "sells", "about_en", "about_ar", "returns_en", "returns_ar"];

/** The longest each text may be, as the database's columns have it. */
export const W4_MAX: Record<W4Key, number> = {
  name_en: 60, name_ar: 60, sells: 300, about_en: 600, about_ar: 600, logo: 60,
  cr_no: 10, cr_activity: 120, vat_no: 15,
  city: 20, address: 200, map_url: 300,
  phone: 20, whatsapp: 20,
  returns_en: 600, returns_ar: 600,
};
export const W4_NAME_MIN = 2;
export const W4_ACTIVITY_MIN = 2;

export const w4Blank = (): W4Form => Object.fromEntries(W4_KEYS.map((k) => [k, ""])) as W4Form;

const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
/** The digits of what was typed, Arabic and Persian digits read as Western ones. */
export const w4Digits = (v: string): string => toLatinDigits(v).replace(/\D/g, "");

/** A Saudi number as the database keeps it, digits with the country code first ("966501234567"), or null. Read from
 *  the ways people write one: 0501234567, 501234567, +966 50 123 4567, 00966501234567, and a landline 0126061234. */
export function w4Phone(v: string): string | null {
  let d = w4Digits(v);
  if (d.startsWith("00")) d = d.slice(2);
  if (/^966\d{9}$/.test(d)) return d;
  if (/^0[1-9]\d{8}$/.test(d)) return `966${d.slice(1)}`;
  if (/^[1-9]\d{8}$/.test(d)) return `966${d}`;
  return null;
}
/** A WhatsApp number: a Saudi mobile ("9665" and eight more digits), or null. */
export function w4Wa(v: string): string | null {
  const d = w4Phone(v);
  return d && /^9665\d{8}$/.test(d) ? d : null;
}
/** A stored number as its owner types it: "966501234567" is "0501234567". Anything else stays as it is. */
export const w4PhoneLocal = (digits: string | null | undefined): string => (digits && /^966\d{9}$/.test(digits) ? `0${digits.slice(3)}` : digits ?? "");
/** A stored number as a page shows it, to be drawn left to right: "+966 50 123 4567". */
export function w4PhoneShown(digits: string | null | undefined): string {
  const d = digits ?? "";
  const m = /^966(\d{2})(\d{3})(\d{4})$/.exec(d);
  return m ? `+966 ${m[1]} ${m[2]} ${m[3]}` : d;
}

/** A commercial registration number: ten digits. */
export const w4CrOk = (v: string): boolean => /^\d{10}$/.test(toLatinDigits(v).replace(/[\s-]/g, ""));
/** A VAT number: fifteen digits that start and end with 3. */
export const w4VatOk = (v: string): boolean => /^3\d{13}3$/.test(toLatinDigits(v).replace(/[\s-]/g, ""));
/** A map link the database takes: the share links of the map most people use, over https. */
export const W4_MAP_URL = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|maps\.google\.com)[/?]/;
export const w4MapOk = (v: string): boolean => v.length <= W4_MAX.map_url && W4_MAP_URL.test(v) && !/\s/.test(v);
/** A shop's logo as the database names it: a photo of the marketplace's own bucket, in a shop's folder. */
export const w4LogoOk = (v: unknown): v is string => isMkPhotoName(v) && v.startsWith("s");

/** The form of a shop that already exists (or the empty form): what its owner would type to get the same values. */
export function w4FormOf(shop: MkShopMine | null | undefined): W4Form {
  const f = w4Blank();
  if (!shop) return f;
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  f.name_en = text(shop.name_en); f.name_ar = text(shop.name_ar); f.sells = text(shop.sells);
  f.about_en = text(shop.about_en); f.about_ar = text(shop.about_ar); f.logo = w4LogoOk(shop.logo) ? shop.logo : "";
  f.cr_no = text(shop.cr_no); f.cr_activity = text(shop.cr_activity); f.vat_no = text(shop.vat_no);
  f.city = isMkCity(shop.city) ? shop.city : ""; f.address = text(shop.address); f.map_url = text(shop.map_url);
  f.phone = w4PhoneLocal(text(shop.phone)); f.whatsapp = w4PhoneLocal(text(shop.whatsapp));
  f.returns_en = text(shop.returns_en); f.returns_ar = text(shop.returns_ar);
  return f;
}

/** Whether two forms would send different values. */
export const w4Changed = (a: W4Form, b: W4Form): boolean => W4_KEYS.some((k) => valueOf(a, k) !== valueOf(b, k));

/** One field's value as the database is sent it: cleaned as the database cleans it, a number as its digits, a link
 *  trimmed; "" for nothing. A number that cannot be read stays as typed, so that it is refused and not lost. */
function valueOf(f: W4Form, k: W4Key): string {
  const v = f[k] ?? "";
  switch (k) {
    case "cr_no": case "vat_no": return toLatinDigits(v).replace(/[\s-]/g, "");
    case "phone": return v.trim() ? w4Phone(v) ?? v.trim() : "";
    case "whatsapp": return v.trim() ? w4Wa(v) ?? v.trim() : "";
    case "map_url": case "logo": case "city": return v.trim();
    default: return mkClean(v);
  }
}

/* ------------------------------------------------------------------ what stands in the way */

export type W4IssueKey = "required" | "short" | "long" | "cr" | "vat" | "city" | "map" | "phone" | "whatsapp" | "link" | "phone_text" | "agree";
export type W4Field = W4Key | "agreement";
export type W4Issue = { field: W4Field; key: W4IssueKey };

/** What the form itself can see is wrong, one thing per field at most, in the page's order, so the first can be
 *  shown and focused. `locked`: an approved shop's edit, where the five locked fields are not the owner's to change
 *  and are not judged. `agree`: the agreement's tick, asked for whenever `needAgree` is true. */
export function w4Issues(f: W4Form, o: { locked?: boolean; needAgree?: boolean; agree?: boolean } = {}): W4Issue[] {
  const out: W4Issue[] = [];
  const add = (field: W4Field, key: W4IssueKey) => { if (!out.some((i) => i.field === field)) out.push({ field, key }); };
  for (const k of W4_KEYS) {
    if (o.locked && w4IsLocked(k)) continue;
    const raw = f[k] ?? "", v = valueOf(f, k);
    switch (k) {
      case "name_en":
        if (!v) add(k, "required"); else if (v.length < W4_NAME_MIN) add(k, "short");
        break;
      case "name_ar":
        if (v && v.length < W4_NAME_MIN) add(k, "short");
        break;
      case "cr_no":
        if (!v) add(k, "required"); else if (!/^\d{10}$/.test(v)) add(k, "cr");
        break;
      case "cr_activity":
        if (!v) add(k, "required"); else if (v.length < W4_ACTIVITY_MIN) add(k, "short");
        break;
      case "vat_no":
        if (v && !/^3\d{13}3$/.test(v)) add(k, "vat");
        break;
      case "city":
        if (!isMkCity(v)) add(k, "city"); // none chosen, or one the list does not have: "Choose a city."
        break;
      case "map_url":
        if (v && !w4MapOk(v)) add(k, "map");
        break;
      case "phone":
        if (raw.trim() && !w4Phone(raw)) add(k, "phone");
        break;
      case "whatsapp":
        if (raw.trim() && !w4Wa(raw)) add(k, "whatsapp");
        break;
      case "logo":
        if (v && !w4LogoOk(v)) add(k, "required");
        break;
      default:
        break;
    }
    if (k !== "logo" && k !== "phone" && k !== "whatsapp" && v.length > W4_MAX[k]) add(k, "long");
    if (W4_PROSE.includes(k) && v) {
      if (mkHasLink(v)) add(k, "link");
      else if (mkHasPhone(v)) add(k, "phone_text");
    }
  }
  if (o.needAgree && !o.agree) add("agreement", "agree");
  return out;
}

/** The values market_shop_apply is sent: every field the form has, nothing for an empty optional one (null clears
 *  it), and the version of the rules the page showed. `logo` is the stored name, or null. */
export function w4FieldsOf(f: W4Form, agreement: string): MkShopFields {
  const opt = (k: W4Key): string | null => valueOf(f, k) || null;
  return {
    name_en: valueOf(f, "name_en"), name_ar: opt("name_ar"),
    cr_no: valueOf(f, "cr_no"), cr_activity: valueOf(f, "cr_activity"), vat_no: opt("vat_no"),
    city: valueOf(f, "city"), address: opt("address"), map_url: opt("map_url"),
    phone: opt("phone"), whatsapp: opt("whatsapp"),
    about_en: opt("about_en"), about_ar: opt("about_ar"), returns_en: opt("returns_en"), returns_ar: opt("returns_ar"),
    sells: opt("sells"), logo: w4LogoOk(f.logo) ? f.logo : null, agreement,
  };
}

/** An approved shop's edit: the owner's changes on top of the shop as it is, the five locked values exactly as the
 *  database has them (a different one is refused). */
export function w4EditFieldsOf(shop: MkShopMine, f: W4Form, agreement: string): MkShopFields {
  const typed = w4FieldsOf(f, agreement);
  return { ...typed, name_en: shop.name_en, cr_no: shop.cr_no, cr_activity: shop.cr_activity, vat_no: shop.vat_no ?? null, city: shop.city };
}

/* ------------------------------------------------------------------ the route's body */

const VERSION = /^[A-Za-z0-9._-]{1,20}$/;
const TEXT_KEYS = ["name_en", "name_ar", "cr_no", "cr_activity", "vat_no", "address", "map_url", "phone", "whatsapp", "about_en", "about_ar", "returns_en", "returns_ar", "sells"] as const;
const REQUIRED: readonly string[] = ["name_en", "cr_no", "cr_activity"];

/** POST /api/market/shop/apply's `fields`, checked before any database call: an object of the application's own keys
 *  and nothing else, each a text of a sane length (or null for an empty optional one), a city of the list, a logo of
 *  the marketplace's own naming, and the rules' version. Null for anything else (the route answers "invalid"). What
 *  the values say is the database's to judge. */
export function w4BodyFields(v: unknown): MkShopFields | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const b = v as Record<string, unknown>;
  const out: Record<string, string | null> = {};
  for (const k of TEXT_KEYS) {
    const x = b[k];
    if (x === undefined || x === null || x === "") {
      if (REQUIRED.includes(k)) return null;
      out[k] = null;
      continue;
    }
    if (typeof x !== "string" || x.length > W4_MAX[k] * 4 + 40) return null;
    out[k] = x;
  }
  if (!isMkCity(b.city)) return null;
  if (!(b.logo === undefined || b.logo === null || w4LogoOk(b.logo))) return null;
  if (typeof b.agreement !== "string" || !VERSION.test(b.agreement)) return null;
  return {
    name_en: out.name_en as string, name_ar: out.name_ar, cr_no: out.cr_no as string, cr_activity: out.cr_activity as string, vat_no: out.vat_no,
    city: b.city, address: out.address, map_url: out.map_url, phone: out.phone, whatsapp: out.whatsapp,
    about_en: out.about_en, about_ar: out.about_ar, returns_en: out.returns_en, returns_ar: out.returns_ar, sells: out.sells,
    logo: typeof b.logo === "string" ? b.logo : null, agreement: b.agreement,
  };
}

/* ------------------------------------------------------------------ a refusal */

/** The field a refusal is about, from its detail word (the database names the key after the code's colon:
 *  "MKT_INPUT: cr_no", "MKT_LINK: about_en", "MKT_DUP: cr"), or null when it is about the whole form. */
export function w4RefusalField(error: string, detail: string): W4Field | null {
  if (error === "dup") return detail === "cr" ? "cr_no" : null;
  if (error === "terms" || error === "consent") return "agreement";
  if (error !== "input" && error !== "link" && error !== "phone") return null;
  if (detail === "agreement") return "agreement";
  return (W4_KEYS as readonly string[]).includes(detail) ? (detail as W4Key) : null;
}

/** The form's own issue that says the same as a refusal about one field, so both read in the same words; null when
 *  the refusal has words of its own (the shared ones). */
export function w4RefusalIssue(error: string, detail: string): W4IssueKey | null {
  if (error === "link") return "link";
  if (error === "phone") return "phone_text";
  if (error !== "input") return null;
  switch (detail) {
    case "cr_no": return "cr";
    case "vat_no": return "vat";
    case "map_url": return "map";
    case "phone": return "phone";
    case "whatsapp": return "whatsapp";
    case "city": return "city";
    case "name_en": case "name_ar": case "cr_activity": return "short";
    case "about_en": case "about_ar": case "returns_en": case "returns_ar": case "sells": case "address": return "long";
    default: return null;
  }
}

/* ------------------------------------------------------------------ the application's state */

/** What the pages show for a shop: none yet, waiting, open, not approved (it can be sent again), or paused. */
export type W4State = "none" | MkShopStatus;
export const w4State = (shop: Pick<MkShopMine, "status"> | null | undefined): W4State =>
  shop && (["pending", "approved", "rejected", "suspended"] as const).includes(shop.status) ? shop.status : "none";
/** Whether the owner can change the whole application and send it (again): no shop yet, one waiting, one not approved. */
export const w4CanApply = (s: W4State): boolean => s === "none" || s === "pending" || s === "rejected";
/** Whether the owner can change the details an approved shop leaves open. */
export const w4CanEdit = (s: W4State): boolean => s === "approved";
/** The shared status chip's colour for a shop's state (market.css .mk-status-<x>). */
export const w4StatusClass = (s: MkShopStatus): string => ({ pending: "held", approved: "live", rejected: "hidden", suspended: "hidden" })[s];

/** Whether the agreement's tick is asked for: always for an application; for an approved shop's edit only when the
 *  rules changed since the shop agreed to them. */
export const w4NeedAgree = (shop: Pick<MkShopMine, "status" | "agreement_version"> | null, termsVersion: string): boolean =>
  !shop || shop.status !== "approved" || shop.agreement_version !== termsVersion;

/* ------------------------------------------------------------------ the form kept in this browser */

export const W4_DRAFT_DAYS = 30;
/** Where an account's unsent application is kept in its browser. `tag` is the account's own, made on the server from
 *  its session (lib/market/w4-server.ts): another account on the same phone never reads it. */
export const w4DraftKey = (tag: string): string => `mk-w4-shop:${/^[0-9a-f]{8,64}$/.test(tag) ? tag : "x"}`;

/** What is written: the typed text and when. The logo is never kept (a picture is chosen again). */
export function w4DraftWrite(f: W4Form, now: number = Date.now()): string {
  const form: Partial<W4Form> = {};
  for (const k of W4_KEYS) if (k !== "logo" && f[k]) form[k] = f[k];
  return JSON.stringify({ at: now, form });
}
/** What was kept, laid over `base` (the shop as the database has it, or the empty form): only the form's own keys,
 *  only text, nothing older than thirty days, and never a locked value of an approved shop. Anything unreadable is
 *  `base` itself. */
export function w4DraftRead(raw: string | null | undefined, base: W4Form, o: { locked?: boolean; now?: number } = {}): W4Form {
  if (!raw) return base;
  try {
    const b = JSON.parse(raw) as { at?: unknown; form?: unknown };
    const now = o.now ?? Date.now();
    if (typeof b.at !== "number" || !(now - b.at < W4_DRAFT_DAYS * 86_400_000) || !b.form || typeof b.form !== "object" || Array.isArray(b.form)) return base;
    const kept = b.form as Record<string, unknown>;
    const out = { ...base };
    for (const k of W4_KEYS) {
      if (k === "logo" || (o.locked && w4IsLocked(k))) continue;
      const v = kept[k];
      if (typeof v === "string" && v.length <= W4_MAX[k] * 4 + 40) out[k] = k === "city" ? (isMkCity(v) ? v : base.city) : v;
    }
    return out;
  } catch {
    return base;
  }
}

/** The cities of the form's picker, in the reader's alphabet. */
export const w4Cities = (locale: string): { key: string; name: string }[] =>
  SA_CITIES.map((c) => ({ key: c.key, name: locale === "ar" || locale === "ur" ? c.ar : c.en }));

/* ------------------------------------------------------------------ the footer's link to the rules */

/** The footer's columns with a way to the Marketplace's rules: as they are when one of their links already opens
 *  /marketplace/rules (the built-in list has it; staff may have moved or reworded it), else with the link added to the
 *  end of the last column. The footer calls it only while the Marketplace is on. */
export function w4FooterWithRules<C extends { links: { label: string; href: string }[] }>(columns: C[], label: string): C[] {
  const opensRules = (href: string) => href.replace(/[?#].*$/, "").replace(/\/$/, "") === MK_RULES;
  if (!label || columns.length === 0 || columns.some((c) => c.links.some((l) => opensRules(l.href)))) return columns;
  const last = columns.length - 1;
  return columns.map((c, i) => (i === last ? { ...c, links: [...c.links, { label, href: MK_RULES }] } : c));
}
