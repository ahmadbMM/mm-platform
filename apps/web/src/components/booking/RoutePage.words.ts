// The route's own page on the ticket (TicketCard, TicketRoutePage; the booking app's _rtBtn and route-page.js, 2026-11-13,
// new features F11) in every language the site speaks: the ticket's button (open), the facts' names (dist, surface,
// level), the turn points' heading (turns), the GPX button (gpx) and the line's name for a screen reader (lineAlt). The
// ten languages the booking app speaks take its own words word for word (rtOpen: English and Arabic in app.src.html, the
// others in its i18n/<code>.json; the rest in route-page.js RTP_T). Indonesian, Malay, German, Russian, Chinese and
// Japanese, which it does not speak, follow src/i18n/TRANSLATING.md (Distance, Surface and Level as the site's
// dictionaries already say them). Route, "{0} km", Open the map and Close are the ticket's own words. Change a text here
// in every language at once.
import type { Locale } from "@/i18n/locales";

export type RoutePageWords = { open: string; dist: string; surface: string; level: string; turns: string; gpx: string; lineAlt: string };

export const ROUTE_PAGE_WORDS: Record<Locale, RoutePageWords> = {
  en: { open: "Route details", dist: "Distance", surface: "Surface", level: "Level", turns: "Turn points", gpx: "Save GPX file", lineAlt: "The route as a line, north at the top" },
  ar: { open: "تفاصيل المسار", dist: "المسافة", surface: "السطح", level: "المستوى", turns: "نقاط الانعطاف", gpx: "حفظ ملف GPX", lineAlt: "المسار مرسومًا كخط، والشمال في الأعلى" },
  id: { open: "Detail rute", dist: "Jarak", surface: "Permukaan", level: "Tingkat", turns: "Titik belok", gpx: "Simpan file GPX", lineAlt: "Rute sebagai garis, utara di atas" },
  ms: { open: "Butiran laluan", dist: "Jarak", surface: "Permukaan", level: "Tahap", turns: "Titik selekoh", gpx: "Simpan fail GPX", lineAlt: "Laluan sebagai garisan, utara di atas" },
  de: { open: "Streckendetails", dist: "Distanz", surface: "Untergrund", level: "Niveau", turns: "Abbiegepunkte", gpx: "GPX-Datei speichern", lineAlt: "Die Strecke als Linie, Norden oben" },
  es: { open: "Detalles de la ruta", dist: "Distancia", surface: "Superficie", level: "Nivel", turns: "Puntos de giro", gpx: "Guardar archivo GPX", lineAlt: "La ruta dibujada, con el norte arriba" },
  fr: { open: "Détails du parcours", dist: "Distance", surface: "Revêtement", level: "Niveau", turns: "Points de virage", gpx: "Enregistrer le fichier GPX", lineAlt: "Le parcours tracé, le nord en haut" },
  pt: { open: "Detalhes do percurso", dist: "Distância", surface: "Piso", level: "Nível", turns: "Pontos de viragem", gpx: "Guardar ficheiro GPX", lineAlt: "O percurso desenhado, com o norte em cima" },
  tl: { open: "Mga detalye ng ruta", dist: "Distansya", surface: "Uri ng daan", level: "Antas", turns: "Mga likuan", gpx: "I-save ang GPX file", lineAlt: "Ang ruta bilang linya, hilaga sa itaas" },
  ru: { open: "О маршруте", dist: "Дистанция", surface: "Покрытие", level: "Уровень", turns: "Точки поворота", gpx: "Сохранить файл GPX", lineAlt: "Маршрут линией, север вверху" },
  ur: { open: "راستے کی تفصیلات", dist: "فاصلہ", surface: "سطح", level: "درجہ", turns: "موڑ کے مقامات", gpx: "GPX فائل محفوظ کریں", lineAlt: "راستہ لکیر کی صورت میں، شمال اوپر" },
  hi: { open: "रूट का विवरण", dist: "दूरी", surface: "सतह", level: "स्तर", turns: "मोड़ के स्थान", gpx: "GPX फ़ाइल सहेजें", lineAlt: "रेखा के रूप में रूट, उत्तर ऊपर" },
  ne: { open: "रुटको विवरण", dist: "दूरी", surface: "सतह", level: "स्तर", turns: "मोडका ठाउँहरू", gpx: "GPX फाइल बचत गर्नुहोस्", lineAlt: "रेखाको रूपमा रुट, उत्तर माथि" },
  bn: { open: "রুটের বিস্তারিত", dist: "দূরত্ব", surface: "রাস্তার ধরন", level: "স্তর", turns: "মোড়ের স্থান", gpx: "GPX ফাইল সংরক্ষণ করুন", lineAlt: "রেখা হিসেবে রুট, উত্তর উপরে" },
  zh: { open: "路线详情", dist: "距离", surface: "路面", level: "级别", turns: "转弯点", gpx: "保存 GPX 文件", lineAlt: "路线示意线，上方为北" },
  ja: { open: "ルートの詳細", dist: "距離", surface: "路面", level: "レベル", turns: "曲がり角", gpx: "GPXファイルを保存", lineAlt: "ルートの線（上が北）" },
};

export const routePageWords = (locale: string): RoutePageWords => ROUTE_PAGE_WORDS[locale as Locale] ?? ROUTE_PAGE_WORDS.en;
