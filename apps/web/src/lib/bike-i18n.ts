import { filled } from "./filled";
import { LOCALE_CODES, intlOf, isRtl, type Locale } from "@/i18n/locales";
import { dictOf } from "@/i18n/dicts";
import { fill, tr } from "@/i18n/tx";
// The bike page carries its own language rather than a locale segment: the NFC chips hold
// /b/42 and must keep holding it, so language is a preference on the device, not part of the
// tag URL. It speaks every language the site does (i18n/locales.ts): English and Arabic are
// written here, and every other language translates the English through the site's own
// dictionaries (src/i18n/tx/<code>.json) - nothing on this page is hardcoded in one language.
export const BIKE_LANGS = LOCALE_CODES;
export type BikeLang = Locale;

export function isBikeLang(v: unknown): v is BikeLang {
  return typeof v === "string" && (BIKE_LANGS as readonly string[]).includes(v);
}
export const dirOf = (l: BikeLang) => (isRtl(l) ? "rtl" : "ltr");

/** The first of a phone's languages (its Accept-Language, best first) that the page speaks.
 *  "fil" is Filipino, which the site offers as Tagalog; "in" is Indonesian's old code. */
export function fromAcceptLanguage(header: string | null | undefined): BikeLang | null {
  for (const part of String(header ?? "").toLowerCase().split(",")) {
    const base = part.split(";")[0].trim().split("-")[0];
    const code = base === "fil" ? "tl" : base === "in" ? "id" : base;
    if (isBikeLang(code)) return code;
  }
  return null;
}

type Dict = Record<string, string>;

const EN: Dict = {
  lang: "Language",
  book: "Book an Experience",
  store: "See this bike in the store",
  price: "Ride price",
  catSize: "size {0}",
  listSep: ", ",
  specs: "Specification",
  service: "Service",
  errTitle: "We can’t load this bike right now",
  errBody: "Something went wrong at our end. Check your connection and try again.",
  errCta: "Try again",
  unknownTitle: "We don’t recognise this tag",
  unknownBody: "This sticker isn’t linked to a bike yet.",
  unknownCta: "Go to micromobility.sa",
  holdNotice: "This bike is resting. It’s out of service right now, so it can’t be booked — any other bike in the fleet can.",
  outNotice: "This bike is out on a ride right now.",
  // states
  stAvailable: "Available", stStaged: "Reserved", stOut: "On a ride",
  stReturned: "Being prepared", stHold: "Out of service",
  // field labels
  fBrand: "Brand", fModel: "Model", fFrame: "Frame material", fSize: "Size",
  fGroupset: "Groupset", fSpeeds: "Speeds", fWheels: "Wheels", fBrakes: "Brakes",
  fWeight: "Weight", fColour: "Colour", fInService: "In service since", fLastService: "Last service",
  // values
  vRoad: "Road", vMountain: "Mountain", vHybrid: "Hybrid",
  vAluminum: "Aluminium", vCarbon: "Carbon",
  unitKg: "kg",
  // Headline for a bike whose name is still the auto-generated fleet code.
  tRoad: "Road bike", tMountain: "Mountain bike", tHybrid: "Hybrid bike", tGravel: "Gravel bike", tKids: "Kids bike",
};

const AR: Dict = {
  lang: "اللغة",
  book: "احجز تجربة",
  store: "شاهد هذه الدراجة في المتجر",
  price: "سعر الجولة",
  catSize: "مقاس {0}",
  listSep: "، ",
  specs: "المواصفات",
  service: "الصيانة",
  errTitle: "لا يمكننا تحميل بيانات هذه الدراجة الآن",
  errBody: "حدث خلل لدينا. تحقق من اتصالك وحاول مرة أخرى.",
  errCta: "حاول مرة أخرى",
  unknownTitle: "لا نتعرف على هذه الشريحة",
  unknownBody: "هذا الملصق غير مرتبط بدراجة بعد.",
  unknownCta: "اذهب إلى micromobility.sa",
  holdNotice: "هذه الدراجة في راحة. إنها خارج الخدمة حالياً ولا يمكن حجزها، ويمكنك حجز أي دراجة أخرى في الأسطول.",
  outNotice: "هذه الدراجة في جولة الآن.",
  stAvailable: "متاحة", stStaged: "محجوزة", stOut: "في جولة",
  stReturned: "قيد التجهيز", stHold: "خارج الخدمة",
  fBrand: "الماركة", fModel: "الموديل", fFrame: "خامة الهيكل", fSize: "المقاس",
  fGroupset: "مجموعة النقل", fSpeeds: "السرعات", fWheels: "العجلات", fBrakes: "الفرامل",
  fWeight: "الوزن", fColour: "اللون", fInService: "في الخدمة منذ", fLastService: "آخر صيانة",
  vRoad: "طريق", vMountain: "جبلية", vHybrid: "هجينة",
  vAluminum: "ألمنيوم", vCarbon: "كربون",
  unitKg: "كجم",
  // Headline for a bike whose name is still the auto-generated fleet code.
  tRoad: "دراجة طريق", tMountain: "دراجة جبلية", tHybrid: "دراجة هجينة", tGravel: "دراجة غرافل", tKids: "دراجة أطفال",
};

/** The English texts, for the site's list of what is translated (src/i18n/extract.ts). */
export const BIKE_EN: Readonly<Dict> = EN;

/** Falls back to English rather than showing a key, so a missed string is never visible. */
export function tFor(lang: BikeLang) {
  const dict = lang === "en" || lang === "ar" ? null : dictOf(lang);
  return (key: string): string => {
    const en = EN[key];
    if (en === undefined) return key;
    return lang === "ar" ? (AR[key] ?? en) : tr(lang, dict, en);
  };
}

/**
 * Fleet values are free text typed by staff, so a translation is offered when we know the
 * word and the original is kept when we don't. A bike is never blanked for lack of a phrase.
 *
 * Sizes are deliberately absent from this map. "M" is an international frame code, the same
 * letter that is printed on the bike and written on the booking — expanding it to "Medium"
 * would be translating a code that has no translation, and rewriting what staff typed.
 */
export function translateValue(v: string, t: (k: string) => string): string {
  const key: string = ({
    road: "vRoad", mountain: "vMountain", hybrid: "vHybrid",
    aluminum: "vAluminum", aluminium: "vAluminum", carbon: "vCarbon",
  } as Record<string, string>)[v.trim().toLowerCase()] ?? "";
  return key ? t(key) : v;
}

/**
 * Dates are pinned to the Gregorian calendar and Latin digits on purpose. "ar-SA" resolves to
 * the Umm al-Qura calendar in most browsers, so a service date a staffer typed as 1 March 2026
 * would reach an Arabic reader as a Hijri date they never entered. Latin digits also keep the
 * date consistent with the weights, speeds and the bike number beside it, which the handoff
 * spec asks to stay latin and left-to-right.
 */
export function fmtDate(iso: string, lang: BikeLang): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(intlOf(lang), {
      year: "numeric", month: "short", day: "numeric",
      calendar: "gregory", numberingSystem: "latn",
      // last_serviced_at is a timestamptz and the Worker runs in UTC, so a service logged at
      // 01:30 Riyadh time would otherwise print as the previous day to the rider reading it.
      timeZone: "Asia/Riyadh",
    }).format(d);
  } catch { return iso; }
}

/** Same reasoning as fmtDate: one numeral system across the whole page. */
export function fmtPrice(amount: number, lang: BikeLang): string {
  try {
    return new Intl.NumberFormat(intlOf(lang), {
      style: "currency", currency: "SAR", numberingSystem: "latn",
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch { return `SAR ${amount}`; }
}

/**
 * The Fleet form auto-generates `name` from genBikeName() — "R-AL-0042-M": a type letter, a
 * frame code, the padded number and the size. That is a warehouse label, not something to put
 * at the top of a page a customer reached by tapping the bike. Detect it so the title can fall
 * back to something a person would actually say.
 */
const AUTO_NAME = /^[A-Z]-[A-Z]{0,2}-\d{4}-[A-Z]{0,3}$/;

export type BikeTitle = { title: string; fromBrandModel: boolean; fromType: boolean };

/**
 * What to call this bike, best first: the name a staffer typed, then brand + model, then the
 * kind of bike it is, and only then its number. Nothing here invents information — each step
 * just reaches for the next thing that was actually filled in.
 */
export function bikeTitle(
  row: { name?: string | null; brand?: string | null; model?: string | null;
         type?: string | null; bike_number?: number | null },
  t: (k: string) => string,
): BikeTitle {
  const typed = filled(row.name) ? String(row.name).trim() : "";
  if (typed && !AUTO_NAME.test(typed)) return { title: typed, fromBrandModel: false, fromType: false };

  // filled(), not bare truthiness: a brand of "-" must not become the headline, and must not
  // set fromBrandModel, which would drop the genuine Model row from the grid below.
  const brandModel = [row.brand, row.model]
    .filter(filled)
    .map((v) => String(v).trim())
    .join(" ");
  if (brandModel) return { title: brandModel, fromBrandModel: true, fromType: false };

  const key = `t${String(row.type ?? "").trim()}`;
  const named = t(key);
  if (named !== key) return { title: named, fromBrandModel: false, fromType: true };

  return { title: `#${row.bike_number ?? ""}`, fromBrandModel: false, fromType: false };
}

/**
 * "22 speed" was wrong, and so was "1 velocidades". Speeds is the only counted noun on the
 * page, and every language counts it its own way - Arabic distinguishes one, two, few and many,
 * Russian one, few and many, and Chinese, Japanese, Indonesian and Malay do not change the noun
 * at all - so the count picks the form through Intl.PluralRules rather than a bolted-on "s".
 * Each form is the whole phrase, because "21速" and "21段" take no space.
 */
const SPEED_FORMS: Record<BikeLang, Partial<Record<Intl.LDMLPluralRule, string>>> = {
  en: { one: "{0} speed", other: "{0} speeds" },
  ar: { one: "{0} سرعة", two: "{0} سرعتان", few: "{0} سرعات", many: "{0} سرعة", other: "{0} سرعة", zero: "{0} سرعة" },
  id: { other: "{0} speed" }, // as Indonesian shops write it ("21 speed"); "kecepatan" reads as velocity
  ms: { other: "{0} kelajuan" },
  de: { one: "{0} Gang", other: "{0} Gänge" },
  es: { one: "{0} velocidad", other: "{0} velocidades" },
  fr: { one: "{0} vitesse", other: "{0} vitesses" },
  pt: { one: "{0} marcha", other: "{0} marchas" },
  tl: { other: "{0} speed" },
  ru: { one: "{0} скорость", few: "{0} скорости", many: "{0} скоростей", other: "{0} скорости" },
  ur: { other: "{0} گیئر" },
  hi: { other: "{0} गियर" },
  ne: { other: "{0} गियर" },
  bn: { other: "{0} গিয়ার" },
  zh: { other: "{0}速" },
  ja: { other: "{0}段" },
};

export function speedsLabel(n: number, lang: BikeLang): string {
  const forms = SPEED_FORMS[lang] ?? SPEED_FORMS.en;
  let rule: Intl.LDMLPluralRule = "other";
  try {
    rule = new Intl.PluralRules(lang).select(n);
  } catch {
    /* an engine without the locale still gets a sensible word below */
  }
  return fill(forms[rule] ?? forms.other ?? "{0}", n);
}
