import { bi, type PageSchema } from "@/content/types";

// Routes (Routes.dc.html): places to ride in and around Jeddah. The design drew each route on a
// map with made-up distances, climbs and times (and a "Friday sunrise ride" that does not
// exist), so the routes start with what is true of each place; distance, climb and time show
// once staff fill them in. The circuit's lap is the Jeddah Corniche Circuit's own 6.174 km.
const txt = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "text" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const long = (id: string, max: number, en: string, ar: string, dEn: string, dAr: string) => ({ id, type: "longtext" as const, max, label: bi(en, ar), def: bi(dEn, dAr) });
const num = (id: string, en: string, ar: string, max: number, step: number) => ({ id, type: "number" as const, min: 0, max, step, label: bi(en, ar), hint: bi("0 hides it.", "صفر يخفيه."), def: 0 });
const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const route = (name: [string, string], area: [string, string], level: [string, string], surface: [string, string], text: [string, string], href: string, km = 0) =>
  ({ name: bi(...name), area: bi(...area), level: bi(...level), surface: bi(...surface), text: bi(...text), km, climb: 0, minutes: 0, href: { href } });

export const routesSchema: PageSchema = {
  page: "routes",
  label: bi("Routes", "المسارات"),
  sections: [
    {
      id: "hero",
      label: bi("Top of the page", "أعلى الصفحة"),
      fields: [
        txt("eyebrow", 40, "Small label", "العبارة الصغيرة", "Routes", "المسارات"),
        txt("title", 60, "Title", "العنوان", "Where to ride in Jeddah.", "أين تركب في جدة."),
        long("text", 240, "Text", "النص", "From the Corniche Circuit to the old city and the desert beyond - a few of the places our riders love.", "من حلبة الكورنيش إلى المدينة القديمة والصحراء خلفها - بعض الأماكن التي يحبها راكبونا."),
      ],
    },
    {
      id: "routes",
      label: bi("Routes", "المسارات"),
      fields: [
        {
          id: "items", type: "list", maxItems: 12, label: bi("Routes", "المسارات"),
          item: [
            txt("name", 50, "Name", "الاسم", "", ""), txt("area", 50, "Area", "المنطقة", "", ""), txt("level", 20, "Level", "المستوى", "", ""),
            txt("surface", 30, "Surface", "السطح", "", ""), long("text", 300, "Description", "الوصف", "", ""),
            num("km", "Distance (km)", "المسافة (كم)", 500, 0.1), num("climb", "Climb (m)", "الصعود (م)", 5000, 1), num("minutes", "Time (minutes)", "الوقت (دقائق)", 1440, 5),
            { id: "href", type: "link", label: bi("Map link", "رابط الخريطة"), def: "" },
          ],
          def: [
            route(["Jeddah Corniche Circuit", "حلبة كورنيش جدة"], ["Corniche", "الكورنيش"], ["Easy", "سهل"], ["Race track", "حلبة سباق"],
              ["Ride the Formula 1 track on our evening sessions - smooth tarmac, floodlit at night. Rent a bike there; no bike of your own needed.", "اركب حلبة الفورمولا 1 في جلساتنا المسائية - إسفلت ناعم وإضاءة ليلية. استأجر دراجتك هناك، ولا تحتاج دراجة خاصة."],
              "https://maps.app.goo.gl/RgRGuy6gDT4F6Lve8", 6.174),
            route(["The Corniche", "الكورنيش"], ["Jeddah Waterfront", "واجهة جدة البحرية"], ["Easy", "سهل"], ["Paved", "مُعبّد"],
              ["A flat coastal ride along the Red Sea, with the sea breeze all the way.", "جولة ساحلية مسطّحة على البحر الأحمر مع نسيم البحر طوال الطريق."], maps("Jeddah Waterfront")),
            route(["Al-Balad heritage ride", "جولة البلد التراثية"], ["Historic Jeddah", "جدة التاريخية"], ["Easy", "سهل"], ["Paved", "مُعبّد"],
              ["A slow, flat ride through old Jeddah - coral-stone houses, the souq and coffee stops.", "جولة هادئة ومسطّحة في جدة القديمة - بيوت الحجر المنقبي والسوق ومحطات القهوة."], maps("Al-Balad, Jeddah")),
            route(["Obhur coast", "ساحل أبحر"], ["North Obhur", "أبحر الشمالية"], ["Moderate", "متوسط"], ["Paved", "مُعبّد"],
              ["A longer coastal road north to the Obhur marinas.", "طريق ساحلي أطول شمالاً حتى مراسي أبحر."], maps("Obhur, Jeddah")),
            route(["Asfan desert gravel", "حصى عسفان الصحراوي"], ["Northeast of Jeddah", "شمال شرق جدة"], ["Hard", "صعب"], ["Gravel track", "طريق حصوي"],
              ["Off-road in the desert beyond Asfan - loose gravel and long climbs. Bring spares and plenty of water.", "طريق وعر في الصحراء خلف عسفان - حصى متحرّك وصعود طويل. أحضر قطع غيار وماءً وفيراً."], maps("Asfan, Saudi Arabia")),
          ],
        },
      ],
    },
    {
      id: "cta",
      label: bi("Bottom of the page", "أسفل الصفحة"),
      fields: [
        txt("title", 60, "Title", "العنوان", "No bike yet?", "ما عندك دراجة؟"),
        long("text", 200, "Text", "النص", "Rent one on our evening sessions at the Corniche Circuit.", "استأجر دراجة في جلساتنا المسائية على حلبة الكورنيش."),
        txt("button", 30, "Button", "الزر", "See the rides", "شاهد الجولات"),
        { id: "href", type: "link", label: bi("Button link", "رابط الزر"), def: "/experiences" },
      ],
    },
  ],
};
