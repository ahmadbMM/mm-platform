import { bi, type PageSchema } from "@/content/types";

// What each kind of session is like, as facts on its rows and its own page (the Experiences build of 2026-11-18, the
// user: "do all" of the store and Experiences research; its EF04-EF06, EF30, EF03, EF31, EF24, EF16, EF35 and EF23).
// Staff edit these in the staff page's Website editor (it builds itself from /api/site-schema, so this page shows up
// there with no staff-page change), stored as site_content "xp.<kind>.<field>". Every fact is empty until staff write
// it, and an empty fact is left out of the page: nothing here is a value the owner has not given (the pace bands, for
// one, are still owed). What the site knows from the session itself (its times, its place, its price, who may book it,
// men or women only, the helmet that comes with every ride, the minimum age of 5) is said without staff writing it.
const txt = <I extends string>(id: I, max: number, en: string, ar: string, hEn = "", hAr = "") =>
  ({ id, type: "text" as const, max, optional: true, label: bi(en, ar), ...(hEn ? { hint: bi(hEn, hAr) } : {}), def: bi("", "") });
const long = <I extends string>(id: I, max: number, en: string, ar: string, hEn = "", hAr = "") =>
  ({ id, type: "longtext" as const, max, optional: true, label: bi(en, ar), ...(hEn ? { hint: bi(hEn, hAr) } : {}), def: bi("", "") });
const num = <I extends string>(id: I, en: string, ar: string, max: number, hEn: string, hAr: string) =>
  ({ id, type: "number" as const, label: bi(en, ar), hint: bi(hEn, hAr), def: 0, min: 0, max, step: 5 });

/** One kind's facts: the same fields for every kind. */
const kindFields = [
  txt("meet", 80, "Meeting point", "نقطة التجمع", "Said when the session itself names no place.", "تظهر عندما لا تحدد الجلسة مكانها."),
  { id: "pin", type: "text" as const, max: 40, mono: true, optional: true, label: bi("Map pin", "موقع الخريطة"),
    hint: bi("Latitude,longitude, for the map and Directions (21.624565,39.106812).", "خط العرض,خط الطول للخريطة والاتجاهات."), def: bi("", "") },
  num("gather", "Gather before the start (minutes)", "التجمع قبل البداية (دقائق)", 120, "0: not said. Used when the session has a start and an end.", "0: لا يُذكر."),
  num("minutes", "How long it lasts (minutes)", "المدة (دقائق)", 600, "0: not said. Used when the session has a gathering and a start.", "0: لا تُذكر."),
  long("needs", 400, "Requirements, one per line", "المتطلبات، سطر لكل منها"),
  long("bring", 400, "What to bring, one per line", "ما تحضره معك، سطر لكل منها"),
  long("included", 300, "What's included, one per line", "ما هو مشمول، سطر لكل منها", "The helmet that comes with every ride is said already.", "الخوذة المجانية مع كل جولة مذكورة مسبقاً."),
  txt("lang", 60, "Language", "اللغة", "Arabic and English", "العربية والإنجليزية"),
  txt("pace", 80, "Pace and level", "السرعة والمستوى", "Parts split by · (Easy · 22-25 km/h · No-drop).", "افصل الأجزاء بـ ·"),
  txt("terms", 160, "Cancellation", "الإلغاء", "As the Terms say it for this kind.", "كما تذكرها الشروط لهذا النوع."),
] as const;

/** The kinds staff can describe, in the order the editor lists them (lib/rides.ts RideKind, and test rides). */
export const XP_KINDS = [
  ["saturday", "Saturday Social Ride", "جولة السبت الاجتماعية"],
  ["jcc", "Circuit nights", "ليالي الحلبة"],
  ["swim", "Pool", "المسبح"],
  ["workshop", "Workshop", "الورشة"],
  ["event", "Ticketed events", "الفعاليات"],
  ["petromin", "Petromin nights", "ليالي بترومين"],
  ["snd96", "National Day ride", "جولة اليوم الوطني"],
  ["runher", "Run for Her", "Run for Her"],
  ["defe5k", "DEFE 5KM Run", "سباق دفء 5 كم"],
  ["vlap", "Victory Lap", "Victory Lap"],
  ["arena", "Arena Heros", "Arena Heros"],
  ["blood", "Blood Donation", "التبرع بالدم"],
  ["yoga", "Yoga", "اليوغا"],
  ["farm", "Farm House Night", "ليلة المزرعة"],
  ["testride", "Test rides", "تجربة الدراجات"],
] as const;
export type XpKind = (typeof XP_KINDS)[number][0];

export const xpSchema = {
  page: "xp",
  label: bi("Experiences: session facts", "التجارب: معلومات الجلسات"),
  sections: [
    {
      id: "general",
      label: bi("All sessions", "كل الجلسات"),
      fields: [
        { id: "privateOn", type: "toggle" as const, label: bi("Private group requests", "طلبات المجموعات الخاصة"),
          hint: bi("A WhatsApp request for a private group or a company on each session's page.", "طلب عبر واتساب لمجموعة خاصة أو شركة في صفحة كل جلسة."), def: true },
        { id: "calendars", type: "toggle" as const, label: bi("Calendar subscriptions", "الاشتراك في التقويم"),
          hint: bi("Add every date of a kind to a phone's calendar (no personal data).", "إضافة كل مواعيد نوع إلى تقويم الهاتف (بلا بيانات شخصية)."), def: true },
        { id: "weatherDays", type: "number" as const, label: bi("Weather on sessions this many days ahead", "الطقس للجلسات خلال هذه الأيام"),
          hint: bi("0 turns it off. MET Norway's forecast, at the start time.", "0 لإيقافه."), def: 5, min: 0, max: 7, step: 1 },
        { id: "ratingMin", type: "number" as const, label: bi("Fewest ratings before a kind's average shows", "أقل عدد تقييمات لإظهار المتوسط"),
          def: 20, min: 5, max: 1000, step: 1 },
        { id: "testRides", type: "toggle" as const, label: bi("List test rides", "عرض تجربة الدراجات"),
          hint: bi("Sessions staff make with the test-ride kind; off hides them.", "الجلسات التي ينشئها الفريق بنوع تجربة الدراجات."), def: false },
      ],
    },
    ...XP_KINDS.map(([id, en, ar]) => ({ id, label: bi(en, ar), fields: kindFields })),
  ],
} as const satisfies PageSchema;
