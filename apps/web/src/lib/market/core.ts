// The Marketplace (micromobility.sa/marketplace): people sell sports gear to each other, and the site only shows the
// listings - the sale is between the two of them. This file is the part that is the same on the server and in the
// browser: every shape the database answers with (the booking app's migration 20261121300000_marketplace.sql, the
// interface in the build's CONTRACT.md), the fixed lists, and the plain rules, so they can be tested. It imports
// nothing that only a server has; lib/market/server.ts and lib/market/route.ts are the server's.
//
// The database's own field names are kept as they are (snake_case): a shape read here is the shape the function
// answered with, so nothing is renamed on the way to a page.

/* ------------------------------------------------------------------ the launch switch */

export const MK_ON_KEY = "marketplace.on";
type Content = Record<string, unknown> | null | undefined;
/** The launch switch as staff set it: on only with an explicit true. lib/site.ts marketplaceOn adds the tests' own
 *  switch (MM_TEST_MARKET_ON) and is what the menus read. */
export const marketSwitch = (content: Content): boolean => content?.[MK_ON_KEY] === true;

/* ------------------------------------------------------------------ addresses */

export const MK_HOME = "/marketplace";
export const MK_RULES = "/marketplace/rules";
export const MK_SELL = "/marketplace/sell";
export const MK_MINE = "/marketplace/mine";
export const MK_INBOX = "/marketplace/inbox";
export const MK_MY_SHOP = "/marketplace/my-shop";
export const MK_SHOP_APPLY = "/marketplace/shops/apply";

/** A listing's page: /marketplace/<its number>. */
export const listingHref = (id: number): string => `${MK_HOME}/${id}`;
/** A shop's page: /marketplace/shop/<its slug>. */
export const shopHref = (slug: string): string => `${MK_HOME}/shop/${encodeURIComponent(slug)}`;
/** The selling form: a new listing, or one of the seller's own to edit. */
export const sellHref = (id?: number | null): string => (id ? `${MK_SELL}/${id}` : MK_SELL);
/** The inbox, or one thread in it. */
export const inboxHref = (thread?: number | null): string => (thread ? `${MK_INBOX}/${thread}` : MK_INBOX);
/** A listing's number as its address carries it ("123"), or null: digits only, a positive whole number. */
export function listingIdOf(v: unknown): number | null {
  if (typeof v !== "string" || !/^[1-9]\d{0,14}$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}

/* ------------------------------------------------------------------ the fixed lists (the database's own values) */

export const MK_CONDITIONS = ["new", "excellent", "good", "fair", "parts"] as const;
export type MkCondition = (typeof MK_CONDITIONS)[number];
export const MK_STATUSES = ["draft", "live", "held", "reserved", "sold", "expired", "hidden", "deleted"] as const;
export type MkStatus = (typeof MK_STATUSES)[number];
export const MK_SELLER_KINDS = ["private", "shop", "company"] as const;
export type MkSellerKind = (typeof MK_SELLER_KINDS)[number];
export const MK_TIERS = ["open", "new_only", "declare"] as const;
export type MkTier = (typeof MK_TIERS)[number];
/** How a person is named to the other side: first name and last initial, or not at all. */
export const MK_NAME_MODES = ["short", "none"] as const;
export type MkNameMode = (typeof MK_NAME_MODES)[number];
export const MK_HOLD_REASONS = ["words", "reports", "serial", "staff"] as const;
export type MkHoldReason = (typeof MK_HOLD_REASONS)[number];
export const MK_SHOP_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type MkShopStatus = (typeof MK_SHOP_STATUSES)[number];
/** What a seller does to their own listing (market_listing_state). */
export const MK_ACTIONS = ["reserved", "live", "sold", "deleted", "renew"] as const;
export type MkAction = (typeof MK_ACTIONS)[number];
export const MK_SORTS = ["new", "price_asc", "price_desc"] as const;
export type MkSort = (typeof MK_SORTS)[number];
/** The structured facts a category may ask for (market_categories.facts names some of these). */
export const MK_FACT_KEYS = ["brand", "model", "year", "frame_size", "wheel_size", "size", "for_whom"] as const;
export type MkFactKey = (typeof MK_FACT_KEYS)[number];
export const MK_WHEEL_SIZES = ["12", "14", "16", "20", "24", "26", "27.5", "29", "650b", "700c", "other"] as const;
export const MK_FOR_WHOM = ["men", "women", "unisex", "kids"] as const;
/** The four ticks a "declare" category (e-bikes, e-scooters) needs: a complete device, not modified, top assisted speed
 *  25 km/h or less, the original charger included. */
export const MK_DECLARATIONS = ["complete", "unmodified", "speed_25", "charger"] as const;
export type MkDeclaration = (typeof MK_DECLARATIONS)[number];
export const MK_REPORT_REASONS = ["prohibited", "counterfeit", "stolen", "misleading", "scam", "abuse", "spam", "other"] as const;
export type MkReportReason = (typeof MK_REPORT_REASONS)[number];
export const MK_REPORT_TARGETS = ["listing", "thread"] as const;
export type MkReportTarget = (typeof MK_REPORT_TARGETS)[number];

const oneOf = <T extends string>(list: readonly T[]) => (v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
export const isMkCondition = oneOf(MK_CONDITIONS);
export const isMkStatus = oneOf(MK_STATUSES);
export const isMkSellerKind = oneOf(MK_SELLER_KINDS);
export const isMkNameMode = oneOf(MK_NAME_MODES);
export const isMkAction = oneOf(MK_ACTIONS);
export const isMkSort = oneOf(MK_SORTS);
export const isMkReportReason = oneOf(MK_REPORT_REASONS);
export const isMkReportTarget = oneOf(MK_REPORT_TARGETS);

/* ------------------------------------------------------------------ the limits (the table's own checks) */

export const MK_TITLE_MIN = 3;
export const MK_TITLE_MAX = 80;
export const MK_DESC_MIN = 10;
export const MK_DESC_MAX = 2000;
export const MK_FAULTS_MAX = 500;
export const MK_PRICE_MIN = 1;
export const MK_PRICE_MAX = 500_000;
export const MK_SERIAL_MIN = 4;
export const MK_SERIAL_MAX = 40;
export const MK_PHOTOS_MAX = 10;
export const MK_MESSAGE_MAX = 1000;
export const MK_NOTE_MAX = 300;
/** A page of the browse grid (market_browse's own). */
export const MK_PAGE = 24;
/** A photo as the bucket takes it: JPEG or WebP, 800,000 bytes at most; the full copy's longest side is 1600, and a
 *  small copy (longest side 480, 200,000 bytes at most) is stored beside it. Both are made in the browser. */
export const MK_PHOTO_BYTES = 800_000;
export const MK_PHOTO_SIDE = 1600;
export const MK_SMALL_SIDE = 480;
export const MK_SMALL_BYTES = 200_000;
/** A sold listing's page still opens (as Sold) for this many days. */
export const MK_SOLD_SHOWN_DAYS = 14;
/** The renew card shows in a listing's last days. */
export const MK_RENEW_DAYS = 7;

/* ------------------------------------------------------------------ settings (site_content, read for the pages) */

export type MkLimitsSetting = {
  new_days: number;
  new: { live: number; price_max: number; threads_day: number; wa_day: number };
  established: { live: number; threads_day: number; wa_day: number };
  shop: { live_first: number; first_days: number; live: number };
  messages_day: number;
};
export const MK_LIMITS_DEFAULT: MkLimitsSetting = {
  new_days: 14,
  new: { live: 2, price_max: 3000, threads_day: 5, wa_day: 0 },
  established: { live: 10, threads_day: 20, wa_day: 10 },
  shop: { live_first: 20, first_days: 14, live: 200 },
  messages_day: 200,
};
export const MK_COMMISSION_PCT_DEFAULT = 1;
export const MK_LISTING_DAYS_DEFAULT = 60;
export const MK_AUTO_HOLD_DEFAULT = 3;
export const MK_TERMS_VERSION_DEFAULT = "2026-11-21";

export type MkSettings = {
  on: boolean;
  /** The honour commission, a percentage of the sold price; 0 switches it off. */
  commissionPct: number;
  /** How staff ask for it to be paid, in English and Arabic. */
  commissionHow: { en: string; ar: string };
  limits: MkLimitsSetting;
  listingDays: number;
  autoHoldReports: number;
  termsVersion: string;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const numIn = (v: unknown, lo: number, hi: number, d: number, whole = true): number => {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= lo && n <= hi && (!whole || Number.isInteger(n)) ? n : d;
};
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

/** The marketplace's settings as staff set them (site_content marketplace.*), each falling back to the default the
 *  database also uses when a value is missing or not of its shape. The database decides; this is for what a page shows. */
export function mkSettings(content: Content): MkSettings {
  const c = content ?? {};
  const how = isObj(c["marketplace.commission_how"]) ? c["marketplace.commission_how"] : {};
  const l = isObj(c["marketplace.limits"]) ? c["marketplace.limits"] : {};
  const part = (k: string) => (isObj(l[k]) ? (l[k] as Record<string, unknown>) : {});
  const d = MK_LIMITS_DEFAULT;
  const n = part("new"), e = part("established"), s = part("shop");
  const version = c["marketplace.terms_version"];
  return {
    on: marketSwitch(c),
    commissionPct: numIn(c["marketplace.commission_pct"], 0, 20, MK_COMMISSION_PCT_DEFAULT, false),
    commissionHow: { en: text(how.en, 600), ar: text(how.ar, 600) },
    limits: {
      new_days: numIn(l.new_days, 0, 365, d.new_days),
      new: { live: numIn(n.live, 0, 1000, d.new.live), price_max: numIn(n.price_max, 1, MK_PRICE_MAX, d.new.price_max), threads_day: numIn(n.threads_day, 0, 1000, d.new.threads_day), wa_day: numIn(n.wa_day, 0, 1000, d.new.wa_day) },
      established: { live: numIn(e.live, 0, 1000, d.established.live), threads_day: numIn(e.threads_day, 0, 1000, d.established.threads_day), wa_day: numIn(e.wa_day, 0, 1000, d.established.wa_day) },
      shop: { live_first: numIn(s.live_first, 0, 10_000, d.shop.live_first), first_days: numIn(s.first_days, 0, 365, d.shop.first_days), live: numIn(s.live, 0, 10_000, d.shop.live) },
      messages_day: numIn(l.messages_day, 1, 10_000, d.messages_day),
    },
    listingDays: numIn(c["marketplace.listing_days"], 7, 180, MK_LISTING_DAYS_DEFAULT),
    autoHoldReports: numIn(c["marketplace.auto_hold_reports"], 2, 20, MK_AUTO_HOLD_DEFAULT),
    termsVersion: typeof version === "string" && /^[A-Za-z0-9._-]{1,20}$/.test(version) ? version : MK_TERMS_VERSION_DEFAULT,
  };
}

/* ------------------------------------------------------------------ cities */

/** The cities a listing or a shop can name, by the key the database stores. English and Arabic only: a city's name
 *  is a proper noun and is not run through the other languages' dictionaries (they read the English). The database
 *  holds the same keys (_mkt_cities). */
export const SA_CITIES = [
  { key: "jeddah", en: "Jeddah", ar: "جدة" },
  { key: "riyadh", en: "Riyadh", ar: "الرياض" },
  { key: "makkah", en: "Makkah", ar: "مكة المكرمة" },
  { key: "madinah", en: "Madinah", ar: "المدينة المنورة" },
  { key: "dammam", en: "Dammam", ar: "الدمام" },
  { key: "khobar", en: "Al Khobar", ar: "الخبر" },
  { key: "dhahran", en: "Dhahran", ar: "الظهران" },
  { key: "taif", en: "Taif", ar: "الطائف" },
  { key: "tabuk", en: "Tabuk", ar: "تبوك" },
  { key: "buraydah", en: "Buraydah", ar: "بريدة" },
  { key: "unaizah", en: "Unaizah", ar: "عنيزة" },
  { key: "hail", en: "Hail", ar: "حائل" },
  { key: "abha", en: "Abha", ar: "أبها" },
  { key: "khamis-mushait", en: "Khamis Mushait", ar: "خميس مشيط" },
  { key: "jazan", en: "Jazan", ar: "جازان" },
  { key: "najran", en: "Najran", ar: "نجران" },
  { key: "al-bahah", en: "Al Bahah", ar: "الباحة" },
  { key: "bisha", en: "Bisha", ar: "بيشة" },
  { key: "yanbu", en: "Yanbu", ar: "ينبع" },
  { key: "rabigh", en: "Rabigh", ar: "رابغ" },
  { key: "thuwal", en: "Thuwal", ar: "ثول" },
  { key: "kaec", en: "King Abdullah Economic City", ar: "مدينة الملك عبدالله الاقتصادية" },
  { key: "jubail", en: "Jubail", ar: "الجبيل" },
  { key: "al-ahsa", en: "Al Ahsa", ar: "الأحساء" },
  { key: "qatif", en: "Qatif", ar: "القطيف" },
  { key: "hafar-al-batin", en: "Hafar Al Batin", ar: "حفر الباطن" },
  { key: "al-kharj", en: "Al Kharj", ar: "الخرج" },
  { key: "arar", en: "Arar", ar: "عرعر" },
  { key: "sakaka", en: "Sakaka", ar: "سكاكا" },
  { key: "alula", en: "AlUla", ar: "العلا" },
  { key: "other", en: "Another city", ar: "مدينة أخرى" },
] as const;
export type MkCity = (typeof SA_CITIES)[number]["key"];
export const isMkCity = (v: unknown): v is MkCity => typeof v === "string" && SA_CITIES.some((c) => c.key === v);
/** A city's name in the reader's alphabet: Arabic on the Arabic and Urdu pages, English everywhere else; a key the
 *  list does not know reads as it is. */
export function mkCityName(key: string, locale: string): string {
  const c = SA_CITIES.find((x) => x.key === key);
  return c ? (locale === "ar" || locale === "ur" ? c.ar : c.en) : key;
}
/** Where the "Can we meet at the MicroMobility hub?" quick reply is offered. */
export const MK_HUB_CITY: MkCity = "jeddah";

/* ------------------------------------------------------------------ categories */

/** One row of market_categories as the public reads it. `parent` null: a sport; else a product type of that sport. */
export type MkCategory = {
  slug: string; parent: string | null; name_en: string; name_ar: string; sort: number;
  tier: MkTier; needs_serial: boolean; min_photos: number; facts: MkFactKey[];
};
/** One row, read safely; null for anything that is not one. */
export function mkCategory(v: unknown): MkCategory | null {
  if (!isObj(v) || typeof v.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug)) return null;
  const name_en = text(v.name_en, 60).trim();
  if (!name_en) return null;
  const facts = (Array.isArray(v.facts) ? v.facts : []).filter((f): f is MkFactKey => (MK_FACT_KEYS as readonly unknown[]).includes(f));
  return {
    slug: v.slug, parent: typeof v.parent === "string" && v.parent ? v.parent : null, name_en, name_ar: text(v.name_ar, 60).trim() || name_en,
    sort: numIn(v.sort, -100_000, 100_000, 0), tier: oneOf(MK_TIERS)(v.tier) ? v.tier : "open",
    needs_serial: v.needs_serial === true, min_photos: numIn(v.min_photos, 1, MK_PHOTOS_MAX, 1), facts,
  };
}
const bySort = (a: MkCategory, b: MkCategory) => a.sort - b.sort || a.name_en.localeCompare(b.name_en);
/** The sports, in staff's order. */
export const mkSports = (cats: readonly MkCategory[]): MkCategory[] => cats.filter((c) => c.parent === null).sort(bySort);
/** A sport's product types, in staff's order. */
export const mkTypesOf = (cats: readonly MkCategory[], sport: string): MkCategory[] => cats.filter((c) => c.parent === sport).sort(bySort);
export const mkCategoryOf = (cats: readonly MkCategory[], slug: string | null | undefined): MkCategory | null => cats.find((c) => c.slug === slug) ?? null;
/** A category's name: Arabic on the Arabic and Urdu pages, English everywhere else (as product names are). */
export const mkCatName = (c: Pick<MkCategory, "name_en" | "name_ar">, locale: string): string => (locale === "ar" || locale === "ur" ? c.name_ar || c.name_en : c.name_en);
/** A name staff or a shop wrote in two languages, in the reader's: Arabic when written and read, else English. */
export const mkPick = (locale: string, en: string | null | undefined, ar: string | null | undefined): string =>
  ((locale === "ar" || locale === "ur") && ar && ar.trim() ? ar : en ?? "") || "";

/* ------------------------------------------------------------------ the shapes the database answers with */

export type MkFacts = Partial<Record<MkFactKey, string | number>>;
export type MkDeclarations = Partial<Record<MkDeclaration, boolean>>;
/** A shop as a card, a listing or a thread names it. */
export type MkShopRef = { slug: string; name_en: string; name_ar: string | null; logo: string | null };
/** Everything another person is told about a seller: the kind, the name the seller chose for this listing (null:
 *  "Private seller"), and for a shop its trade name. Never an id, a phone, an email, a photo or a date. */
export type MkSellerView = { kind: MkSellerKind; name: string | null; shop: MkShopRef | null };

/** A listing on the browse grid (market_browse). */
export type MkCard = {
  id: number; title: string; price: number; negotiable: boolean; condition: MkCondition; city: string;
  category: string; sport: string; size: string | null; photo: string | null; status: "live" | "reserved";
  seller_kind: MkSellerKind; shop: MkShopRef | null; checked: boolean; published_at: string;
};
/** market_browse's answer. `next`: the cursor of the next page (pass it back as `after` with the same filters), or
 *  null on the last one. `sports` and `categories`: the slugs that have something to show, for the chips. */
export type MkBrowse = { items: MkCard[]; next: string | null; sports: string[]; categories: string[] };
export const MK_BROWSE_EMPTY: MkBrowse = { items: [], next: null, sports: [], categories: [] };
/** market_browse's `p`. Every key is optional. */
export type MkBrowseQuery = {
  sport?: string; category?: string; kind?: MkSellerKind; city?: string; condition?: MkCondition;
  price_min?: number; price_max?: number; q?: string; sort?: MkSort; after?: string; shop?: string; limit?: number;
};

/** One of the seller's own listings (market_my_listings; what save, publish and a state change answer). A draft may
 *  still lack anything the form has not been given. */
export type MkListingMine = {
  id: number; status: MkStatus; seller_kind: "private" | "shop";
  category: string | null; sport: string | null; title: string | null; description: string | null;
  condition: MkCondition | null; faults: string | null; price: number | null; negotiable: boolean; city: string | null;
  facts: MkFacts; serial: string | null; declarations: MkDeclarations; photos: string[];
  name_mode: MkNameMode | null; display_name: string | null;
  hold_reason: MkHoldReason | null; hidden_reason: string | null;
  published_at: string | null; expires_at: string | null; sold_at: string | null; sold_price: number | null;
  commission_pct: number | null; commission_due: number | null; commission_received: boolean;
  checked_at: string | null; renewable: boolean; threads: number; unread: number; created_at: string; updated_at: string;
};
/** A listing's page (market_listing_get). To everyone: live, reserved, or sold in the last 14 days. To its seller: any
 *  state but a draft or a deleted one, with `mine` true and `own` filled. */
export type MkListing = {
  id: number; status: MkStatus; title: string; description: string; condition: MkCondition; faults: string | null;
  price: number; negotiable: boolean; city: string; category: string; sport: string;
  facts: MkFacts; serial_masked: string | null; declarations: MkDeclarations; photos: string[];
  seller: MkSellerView; checked_at: string | null; published_at: string; sold_at: string | null;
  /** The reader is its seller. */
  mine: boolean; own: MkListingMine | null;
  /** The reader's own thread on it, their report of it, and whether a message can be sent (false for the seller, for a
   *  MicroMobility listing, between two people one of whom blocked the other, and once it is no longer on sale). A
   *  visitor who is not signed in reads null, false and what a signed-in stranger would. */
  thread_id: number | null; reported: boolean; can_message: boolean;
};
/** What a listing's fields are sent as (market_listing_save's `p`): a key left out stays as it is, null clears it. */
export type MkListingFields = Partial<{
  category: string | null; title: string | null; description: string | null; condition: MkCondition | null;
  faults: string | null; price: number | null; negotiable: boolean; city: string | null;
  facts: MkFacts; serial: string | null; declarations: MkDeclarations; photos: string[];
}>;
/** The honour commission as the "sold" pop-up shows it; null when the percentage is 0. */
export type MkCommission = { pct: number; due: number; how_en: string; how_ar: string };

/** market_me's limits for this account today. */
export type MkLimits = {
  live: number; live_used: number; drafts: number; drafts_used: number; price_max: number;
  threads_day: number; threads_used: number; wa_day: number; wa_used: number; messages_day: number; messages_used: number;
};
/** market_me: what the signed-in account may do, and what its forms need. */
export type MkMe = {
  on: boolean;
  /** 18 or older by the birth date on file; null when the account has none. */
  adult: boolean | null;
  established: boolean;
  seller: { status: "ok" | "suspended"; terms_ok: boolean };
  terms_version: string;
  /** The name "first name and last initial" would show; null when the account has none to show. */
  names: { short: string | null };
  has_whatsapp: boolean;
  shop: { id: number; slug: string; status: MkShopStatus; name_en: string; name_ar: string | null } | null;
  limits: MkLimits;
  unread: number;
  commission_pct: number;
  listing_days: number;
};

/** An approved shop's page (market_shop_get). Its phone and WhatsApp are not here: market_shop_contact, signed in. */
export type MkShop = MkShopRef & {
  cr_no: string; cr_activity: string; vat_no: string | null; city: string; address: string | null; map_url: string | null;
  about_en: string | null; about_ar: string | null; returns_en: string | null; returns_ar: string | null;
  sells: string | null; approved_at: string;
};
/** market_shops: the approved shops, by name. */
export type MkShopRow = MkShopRef & { city: string; sells: string | null };
export type MkShopContact = { phone: string | null; whatsapp: string | null };
/** What a shop application sends (market_shop_apply's `p`). */
export type MkShopFields = {
  name_en: string; name_ar?: string | null; cr_no: string; cr_activity: string; vat_no?: string | null; city: string;
  address?: string | null; map_url?: string | null; phone?: string | null; whatsapp?: string | null;
  about_en?: string | null; about_ar?: string | null; returns_en?: string | null; returns_ar?: string | null;
  sells?: string | null; logo?: string | null; agreement: string;
};
/** The account's own shop or application (market_shop_mine). */
export type MkShopMine = Omit<MkShopFields, "agreement"> & {
  id: number; slug: string; status: MkShopStatus; decision_note: string | null; approved_at: string | null;
  agreement_version: string; live: number; live_cap: number; created_at: string; updated_at: string;
};

/** The listing a thread is about, as both sides see it there. */
export type MkThreadListing = { id: number; title: string; price: number; photo: string | null; status: MkStatus; city: string };
/** The other person in a thread: a buyer or a private seller by the name they chose (null: no name), a shop by its trade name. */
export type MkOther = { kind: "buyer" | "private" | "shop"; name: string | null; shop: MkShopRef | null };
/** One thread in the inbox (market_threads). */
export type MkThreadRow = {
  id: number; role: "buyer" | "seller"; listing: MkThreadListing; other: MkOther;
  last_at: string; last_body: string; last_mine: boolean; unread: number; blocked_by_me: boolean;
};
export type MkMessage = { id: number; mine: boolean; body: string; at: string };
/** One thread, open (market_thread_get). `other_wa`: the other person's WhatsApp number (digits, country code first),
 *  only once they shared it in this thread. `hub`: the listing is in Jeddah. */
export type MkThread = {
  id: number; role: "buyer" | "seller"; listing: MkThreadListing; other: MkOther;
  can_send: boolean; blocked_by_me: boolean; reported: boolean;
  can_share_wa: boolean; my_wa_shared: boolean; other_wa: string | null; hub: boolean;
};
export type MkThreadGet = { thread: MkThread; messages: MkMessage[]; more: boolean };

/** market_index: what the sitemap and the site's search list. */
export type MkIndex = { listings: { id: number; title: string }[]; shops: { slug: string; name_en: string; name_ar: string | null }[] };
/** What the site's search holds for one result (app/[locale]/search-index.ts SearchItem). */
export type MkSearchItem = { title: string; text: string; href: string; words?: string };

/* ------------------------------------------------------------------ reading an answer safely */

/** A whole number from JSON (a bigint may come as a string). */
export const mkInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d{1,15}$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) ? n : null;
};
export const mkIsObj = isObj;
/** Is this an answer with a positive `id`: the least a listing, a card, a thread or a message must be. */
export const mkHasId = (v: unknown): v is Record<string, unknown> & { id: number } => isObj(v) && typeof v.id === "number" && Number.isSafeInteger(v.id) && v.id > 0;
/** market_browse's answer, with anything that is not a card left out; no answer is the empty page. */
export function mkBrowseOf(raw: unknown): MkBrowse {
  if (!isObj(raw)) return MK_BROWSE_EMPTY;
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const items = (Array.isArray(raw.items) ? raw.items : []).filter((x): x is MkCard => mkHasId(x) && typeof x.title === "string" && typeof x.price === "number");
  return { items, next: typeof raw.next === "string" && raw.next ? raw.next : null, sports: strs(raw.sports), categories: strs(raw.categories) };
}

/* ------------------------------------------------------------------ small rules */

/** A frame or serial number as other people see it: its last three characters ("•••X42"); null when there is none. */
export function maskSerial(serial: string | null | undefined): string | null {
  const s = (serial ?? "").trim();
  return s ? `•••${s.slice(-3)}` : null;
}
/** A serial number as the database keeps it: letters, digits and dashes, upper case, no spaces; null when what is left
 *  is not 4 to 40 characters. */
export function mkSerial(v: unknown): string | null {
  const s = typeof v === "string" ? v.replace(/\s+/g, "").toUpperCase() : "";
  return s.length >= MK_SERIAL_MIN && s.length <= MK_SERIAL_MAX && /^[A-Z0-9-]+$/.test(s) ? s : null;
}

/** The text keys of a condition: its name and the definition written inside its picker option (Market.text.ts). */
export type MkConditionKeys = { label: `cond_${MkCondition}`; def: `cond_${MkCondition}_def` };
export const conditionKeys = (c: MkCondition): MkConditionKeys => ({ label: `cond_${c}`, def: `cond_${c}_def` });
/** The text key of a seller's label: "Private seller", "Shop", "Sold by MicroMobility". */
export const sellerLabelKey = (kind: MkSellerKind): `seller_${MkSellerKind}` => `seller_${kind}`;
/** The text key of a listing's state, as its seller reads it. */
export const statusKey = (s: MkStatus): `status_${MkStatus}` => `status_${s}`;

/** A price as the pages write it: whole riyals, thousands grouped, Western digits ("12,500"). */
export function mkNum(n: number): string {
  const v = Math.round(Number(n) || 0);
  const grouped = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return v < 0 ? `-${grouped}` : grouped;
}
/** The amount as text, where a sentence takes it: the riyal sign, then the number, isolated left to right. */
export const mkAmtText = (n: number): string => `⁦⃁ ${mkNum(n)}⁩`;
/** The honour commission on a sold price: a percentage, to the nearest whole riyal (a half goes up); 0 when the
 *  percentage is 0. The database does the same sum. */
export function mkCommission(soldPrice: number, pct: number): number {
  if (!(pct > 0) || !(soldPrice > 0)) return 0;
  return Math.floor((soldPrice * pct) / 100 + 0.5);
}

/** Whole days until a listing expires (0 on its last day, negative once it has); null without a date. */
export function mkDaysLeft(expiresAt: string | null | undefined, now: number = Date.now()): number | null {
  const t = expiresAt ? Date.parse(expiresAt) : NaN;
  return Number.isFinite(t) ? Math.floor((t - now) / 86_400_000) : null;
}
/** Whether the renew card shows: a live or reserved listing in its last week, or an expired one. The database's own
 *  `renewable` decides; this is for a page that only holds the dates. */
export function mkRenewable(l: { status: MkStatus; expires_at: string | null }, now: number = Date.now()): boolean {
  if (l.status === "expired") return true;
  if (l.status !== "live" && l.status !== "reserved") return false;
  const d = mkDaysLeft(l.expires_at, now);
  return d !== null && d < MK_RENEW_DAYS;
}
/** A sold listing's page still opens for 14 days. */
export function mkSoldShown(soldAt: string | null | undefined, now: number = Date.now()): boolean {
  const t = soldAt ? Date.parse(soldAt) : NaN;
  return Number.isFinite(t) && now - t < MK_SOLD_SHOWN_DAYS * 86_400_000;
}

/** A WhatsApp link to a number (digits, country code first), with a message ready: https://wa.me/9665...?text=... */
export function mkWaHref(digits: string, message = ""): string | null {
  const d = digits.replace(/\D/g, "");
  if (d.length < 8 || d.length > 15) return null;
  return `https://wa.me/${d}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** The digits of a wa.me link ("https://wa.me/966566668818" is "966566668818"), or null: MicroMobility's own number
 *  as staff set it for the site (the site's social links), for the button of its own listings. */
export function mkWaDigits(link: string | null | undefined): string | null {
  const m = /^https:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?\+?(\d{8,15})(?:\D|$)/.exec((link ?? "").trim());
  return m ? m[1] : null;
}

/* ------------------------------------------------------------------ user text: the same checks the database makes */

const ZERO_WIDTH = /[​-‏‪-‮⁦-⁩﻿️]/g;
const PICTOGRAPHS = /[☀-➿\u{1F000}-\u{1FAFF}]/gu;
/** Text as the database keeps it (_ask_text): no control or direction characters, no pictographs, runs of spaces as
 *  one, trimmed. Line breaks become spaces, as they do there. It is for what a form shows while it is typed in (a
 *  counter, an early refusal); what is stored is what the database made of the text. */
export function mkClean(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(ZERO_WIDTH, "").replace(PICTOGRAPHS, "").replace(/\s+/g, " ").replace(/[\u0000-\u001F\u007F]/g, "").trim();
}
/** A link, as the database reads one (_ask_has_link): refused in a listing's text and in a message. */
export const mkHasLink = (v: string): boolean => /(https?:|www\.|[a-z0-9-]+\.(com|net|org|sa|io|me|ly|co|app|xyz|info|link)(\W|$))/i.test(v);
const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
/** A phone number, as the database reads one (_mkt_has_phone): with Arabic and Persian digits read as Western ones, a
 *  Saudi number with its country code (+966 5..., 00966 5..., 966 5...), a Saudi mobile written 05 and eight more
 *  digits (a single space, dot or dash allowed before each), or any nine digits in a row. Refused in a listing's text
 *  and in a message. */
export function mkHasPhone(v: string): boolean {
  const s = toLatinDigits(v);
  return /(?:\+|00)?966[ .-]?5(?:[ .-]?\d){8}/.test(s) || /(?:^|\D)05(?:[ .-]?\d){8}(?!\d)/.test(s) || /\d{9,}/.test(s);
}

/* ------------------------------------------------------------------ photos */

/** A photo in the marketplace's own bucket: l<listing>/<32 hex>.jpg|webp, or a shop's logo s<shop>/<32 hex>.jpg|webp. */
export const MK_PHOTO_NAME = /^[ls][0-9]{1,12}\/[0-9a-f]{32}\.(?:jpg|webp)$/;
/** A photo staff uploaded for one of MicroMobility's own listings: a path of the site's media (/media/market/...). */
export const MK_MEDIA_PATH = /^\/media\/market\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:jpe?g|png|webp)$/;
export const isMkPhotoName = (v: unknown): v is string => typeof v === "string" && MK_PHOTO_NAME.test(v);
export const isMkMediaPath = (v: unknown): v is string => typeof v === "string" && MK_MEDIA_PATH.test(v) && !v.includes("..");
/** The small copy's name beside a photo: l12/<hex>.jpg -> l12/<hex>.w480.jpg. */
export const mkSmallName = (name: string): string => name.replace(/\.(jpg|webp)$/, ".w480.$1");
/** Where a listing's photo is shown from: the site's own address for either kind (/mkt/... for the marketplace's
 *  bucket, /media/... for staff's), the small copy when `small` (a card, a thumbnail); null for a name that is neither. */
export function mkPhotoSrc(name: string | null | undefined, small = false): string | null {
  if (isMkPhotoName(name)) return `/mkt/${name}${small ? `?w=${MK_SMALL_SIDE}` : ""}`;
  if (isMkMediaPath(name)) return `${name}${small ? "?w=640" : ""}`;
  return null;
}
/** A picture's kind by its first bytes, never its name: "jpg", "webp", or null for anything else. */
export function mkImageKind(b: Uint8Array): "jpg" | "webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}
/** Whether a JPEG still carries a camera's Exif block (where a phone writes the place a photo was taken). A photo the
 *  browser re-drew has none; one that does was not re-drawn and is not stored. Reads the segments before the picture. */
export function mkHasExif(b: Uint8Array): boolean {
  if (mkImageKind(b) !== "jpg") return false;
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) return false; // the picture itself begins: no Exif before it
    const len = (b[i + 2] << 8) | b[i + 3];
    if (marker === 0xe1 && i + 10 <= b.length && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) return true;
    if (len < 2) return false;
    i += 2 + len;
  }
  return false;
}
/** The size a photo is drawn at so its longest side is `side` at most (never larger than it is). */
export function mkFit(w: number, h: number, side: number = MK_PHOTO_SIDE): { w: number; h: number } {
  const long = Math.max(w, h);
  if (!(long > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, side / long);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/* ------------------------------------------------------------------ refusals */

/** The database's refusal codes (a raised message starts with one: "MKT_LIMIT: live"), each with the error id the
 *  site's routes answer and the HTTP status. */
export const MK_REFUSALS = {
  MKT_SIGNIN: { error: "signin", status: 401 },
  MKT_BUSY: { error: "busy", status: 429 },
  MKT_BIRTH: { error: "birth", status: 409 },
  MKT_ADULT: { error: "adult", status: 403 },
  MKT_SUSPENDED: { error: "suspended", status: 403 },
  MKT_TERMS: { error: "terms", status: 409 },
  MKT_CONSENT: { error: "consent", status: 400 },
  MKT_INPUT: { error: "input", status: 400 },
  MKT_LINK: { error: "link", status: 400 },
  MKT_PHONE: { error: "phone", status: 400 },
  MKT_PHOTOS: { error: "photos", status: 400 },
  MKT_SERIAL: { error: "serial", status: 400 },
  MKT_DECLARE: { error: "declare", status: 400 },
  MKT_NEW_ONLY: { error: "new_only", status: 400 },
  MKT_PRICE: { error: "price", status: 403 },
  MKT_LIMIT: { error: "limit", status: 429 },
  MKT_NEW: { error: "new", status: 403 },
  MKT_NOPHONE: { error: "nophone", status: 409 },
  MKT_BLOCKED: { error: "blocked", status: 403 },
  MKT_OWN: { error: "own", status: 409 },
  MKT_DUP: { error: "dup", status: 409 },
  MKT_STATE: { error: "state", status: 409 },
  MKT_GONE: { error: "gone", status: 404 },
} as const;
export type MkCode = keyof typeof MK_REFUSALS;
/** The site's own refusals, beside the database's: another site's page, a body that is not the action's, one too
 *  large, a database without the marketplace yet, and no answer. */
export const MK_SITE_ERRORS = ["origin", "invalid", "too_big", "absent", "generic"] as const;
export type MkError = (typeof MK_REFUSALS)[MkCode]["error"] | (typeof MK_SITE_ERRORS)[number];
export const MK_ERRORS: readonly MkError[] = [...new Set<MkError>([...Object.values(MK_REFUSALS).map((r) => r.error), ...MK_SITE_ERRORS])];
export const isMkError = (v: unknown): v is MkError => typeof v === "string" && (MK_ERRORS as readonly string[]).includes(v);
/** What MKT_LIMIT names after its colon. */
export const MK_LIMIT_DETAILS = ["live", "drafts", "threads", "messages", "wait", "whatsapp", "reports", "photos", "contacts", "shop"] as const;
export type MkLimitDetail = (typeof MK_LIMIT_DETAILS)[number];

/** A raised message as the database wrote it, taken apart: "MKT_LIMIT: live" is { code: "MKT_LIMIT", detail: "live" };
 *  null when it does not start with one of the marketplace's codes. */
export function mkRefusal(message: string | null | undefined): { code: MkCode; detail: string } | null {
  const m = /^(MKT_[A-Z_]+)(?::\s*(.{0,80}))?/.exec((message ?? "").trim());
  if (!m || !(m[1] in MK_REFUSALS)) return null;
  return { code: m[1] as MkCode, detail: (m[2] ?? "").trim() };
}
/** What a route answers for a database call that did not succeed (lib/account.ts rpcServer's result): the error id,
 *  the detail after the code's colon, and the HTTP status. No answer or a server error is "generic" (502); a database
 *  without the function is "absent" (404); a refusal that is not the marketplace's is "generic" (502). */
export function mkErrorOf(r: { status: number; message?: string; code?: string }): { error: MkError; detail: string; status: number } {
  if (r.status === 0 || r.status >= 500) return { error: "generic", detail: "", status: 502 };
  if (r.code === "PGRST202" || /could not find the function/i.test(r.message ?? "")) return { error: "absent", detail: "", status: 404 };
  const hit = mkRefusal(r.message);
  if (!hit) return { error: "generic", detail: "", status: 502 };
  return { ...MK_REFUSALS[hit.code], detail: hit.detail };
}
/** The text key (Market.text.ts `errors`) that says an error: a limit by what it limits ("limit_live"), a text refusal
 *  by itself, anything unknown as "generic". */
export function mkErrorKey(error: unknown, detail?: unknown): string {
  if (!isMkError(error)) return "generic";
  if (error === "limit") return (MK_LIMIT_DETAILS as readonly unknown[]).includes(detail) ? `limit_${detail as MkLimitDetail}` : "limit";
  return error;
}
