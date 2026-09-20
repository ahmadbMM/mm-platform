import { filled } from "./filled";
// The bike page carries its own dictionary rather than a locale segment: the NFC chips hold
// /b/42 and must keep holding it, so language is a preference on the device, not part of the
// tag URL. Every string ships in all three languages — nothing on this page is hardcoded.
export const BIKE_LANGS = ["en", "ar", "es"] as const;
export type BikeLang = (typeof BIKE_LANGS)[number];

export function isBikeLang(v: unknown): v is BikeLang {
  return typeof v === "string" && (BIKE_LANGS as readonly string[]).includes(v);
}
export function nextLang(l: BikeLang): BikeLang {
  return BIKE_LANGS[(BIKE_LANGS.indexOf(l) + 1) % BIKE_LANGS.length];
}
export const dirOf = (l: BikeLang) => (l === "ar" ? "rtl" : "ltr");

type Dict = Record<string, string>;

const EN: Dict = {
  langName: "English",
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
  langName: "العربية",
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

const ES: Dict = {
  langName: "Español",
  book: "Reserva una experiencia",
  store: "Ver esta bici en la tienda",
  price: "Precio del paseo",
  catSize: "talla {0}",
  listSep: ", ",
  specs: "Especificaciones",
  service: "Mantenimiento",
  errTitle: "No podemos cargar esta bici ahora mismo",
  errBody: "Ha fallado algo por nuestra parte. Comprueba tu conexión e inténtalo de nuevo.",
  errCta: "Reintentar",
  unknownTitle: "No reconocemos esta etiqueta",
  unknownBody: "Esta pegatina aún no está vinculada a ninguna bici.",
  unknownCta: "Ir a micromobility.sa",
  holdNotice: "Esta bici está descansando. Ahora mismo está fuera de servicio y no se puede reservar; cualquier otra bici de la flota sí.",
  outNotice: "Esta bici está en ruta ahora mismo.",
  stAvailable: "Disponible", stStaged: "Reservada", stOut: "En ruta",
  stReturned: "En preparación", stHold: "Fuera de servicio",
  fBrand: "Marca", fModel: "Modelo", fFrame: "Material del cuadro", fSize: "Talla",
  fGroupset: "Grupo", fSpeeds: "Velocidades", fWheels: "Ruedas", fBrakes: "Frenos",
  fWeight: "Peso", fColour: "Color", fInService: "En servicio desde", fLastService: "Último mantenimiento",
  vRoad: "Carretera", vMountain: "Montaña", vHybrid: "Híbrida",
  vAluminum: "Aluminio", vCarbon: "Carbono",
  unitKg: "kg",
  // Headline for a bike whose name is still the auto-generated fleet code.
  tRoad: "Bicicleta de carretera", tMountain: "Bicicleta de montaña", tHybrid: "Bicicleta híbrida", tGravel: "Bicicleta de gravel", tKids: "Bicicleta infantil",
};

const DICTS: Record<BikeLang, Dict> = { en: EN, ar: AR, es: ES };

/** Falls back to English rather than showing a key, so a missed string is never visible. */
export function tFor(lang: BikeLang) {
  const d = DICTS[lang] ?? EN;
  return (key: string): string => d[key] ?? EN[key] ?? key;
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
  const tag = lang === "ar" ? "ar" : lang === "es" ? "es-ES" : "en-GB";
  try {
    return new Intl.DateTimeFormat(tag, {
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
  const tag = lang === "ar" ? "ar" : lang === "es" ? "es-ES" : "en-GB";
  try {
    return new Intl.NumberFormat(tag, {
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
 * page, but it is counted in three languages with three different plural systems — Arabic
 * alone distinguishes one, two, few and many — so the count picks the form through
 * Intl.PluralRules rather than through a bolted-on "s".
 */
const SPEED_FORMS: Record<BikeLang, Partial<Record<Intl.LDMLPluralRule, string>>> = {
  en: { one: "speed", other: "speeds" },
  es: { one: "velocidad", other: "velocidades" },
  ar: { one: "سرعة", two: "سرعتان", few: "سرعات", many: "سرعة", other: "سرعة", zero: "سرعة" },
};
const PLURAL_LOCALE: Record<BikeLang, string> = { en: "en", es: "es", ar: "ar" };

export function speedsLabel(n: number, lang: BikeLang): string {
  const forms = SPEED_FORMS[lang] ?? SPEED_FORMS.en;
  let rule: Intl.LDMLPluralRule = "other";
  try {
    rule = new Intl.PluralRules(PLURAL_LOCALE[lang]).select(n);
  } catch {
    /* an engine without the locale still gets a sensible word below */
  }
  return `${n} ${forms[rule] ?? forms.other ?? ""}`.trim();
}
